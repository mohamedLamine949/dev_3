import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Annonce, ImageAnnonce } from '../lib/supabase';
import { scoreAnnonce, filterByRelevance } from '../lib/relevance';
import { televerserPhotosAnnonce } from '../lib/photosAnnonce';
import { composerFil } from '../lib/feed';

/** Nombre d'annonces chargées par page sur les listes paginées. */
export const ANNONCES_PAGE_SIZE = 20;

/**
 * Colonnes d'une carte d'annonce. Le type de compte du vendeur est joint pour
 * afficher le badge PRO (il dérive du type_compte : les annonces déjà en ligne
 * d'un compte pro l'obtiennent automatiquement).
 */
const SELECT_CARTE =
  '*, images:images_annonce(id, image_url, ordre), user:users!annonces_user_id_fkey(id, prenom, nom, nom_boutique, avatar_url, type_compte)';

/**
 * Colonnes de l'INDEX du fil : de quoi décider d'un ordre, rien de plus.
 * Une ligne pèse une centaine d'octets et ne déclenche aucun téléchargement
 * d'image — c'est ce qui permet de classer tout le catalogue d'un coup sans
 * peser sur le quota (les photos, elles, ne partent que pour les cartes
 * effectivement affichées par la FlatList).
 */
const SELECT_INDEX = 'id, user_id, categorie, boost_expire_le, date_creation';

/**
 * Hook pour récupérer les annonces actives avec filtrage
 */
export function useAnnonces(options?: {
  categorie?: string | null;
  sousCategorie?: string | null;
  search?: string;
  limit?: number;
  /**
   * Active la pagination : la liste démarre avec `pageSize` annonces puis
   * s'agrandit via `loadMore()`. Sans cette option, tout est chargé d'un coup
   * (comportement historique, conservé pour la recherche).
   */
  pageSize?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  etat?: string | null;
  orderBy?: 'newest' | 'price_asc' | 'price_desc';
  /**
   * Ne garder que les annonces publiees depuis moins de N heures
   * (bouton « Nouveautes » de l'accueil : 72 h). `null`/absent = tout.
   */
  depuisHeures?: number | null;
  /**
   * Fil d'accueil : compose l'ordre à partir de l'index complet plutôt que de
   * servir les annonces par date (voir composerFil). Sans effet sur une
   * recherche, où c'est la pertinence qui commande.
   */
  diversifie?: boolean;
  /** Catégories déjà consultées, pour classer les vendeurs du premier tour. */
  categoriesPreferees?: string[];
}) {
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Vrai quand l'ordre affiché vient de `composerFil`. L'écran s'en sert pour
   * savoir s'il doit encore répartir les vendeurs lui-même : inutile ici, et
   * indispensable si l'index n'a pas pu être lu.
   */
  const [compose, setCompose] = useState(false);
  const pageRef = useRef(0);
  const fetchingMoreRef = useRef(false);
  /**
   * Borne basse de la fenetre « Nouveautes », figee au moment du chargement
   * de la premiere page. Si on la recalculait a chaque appel, `loadMore()`
   * interrogerait une fenetre legerement decalee quelques secondes plus tard
   * et pourrait sauter ou repeter une annonce a la frontiere des pages.
   */
  const depuisRef = useRef<string | null>(null);
  /**
   * Ordre du fil composé (ids), décidé une fois sur l'index complet. Les
   * pages suivantes y puisent : sans lui, `loadMore` repartirait du tri par
   * date et ramènerait le paquet d'annonces qu'on venait justement d'étaler.
   */
  const ordreRef = useRef<string[]>([]);

  const searchTerm = options?.search?.trim() ?? '';
  const isSearching = searchTerm.length > 0;
  const pageSize = options?.pageSize;
  const depuisHeures = options?.depuisHeures ?? null;
  // La recherche est scorée côté client (pertinence fuzzy) : elle a besoin du
  // corpus complet, on ne pagine donc pas dans ce cas. Ce sont les images —
  // virtualisées par la FlatList — qui coûtent cher, pas les lignes.
  const paginated = !!pageSize && !isSearching;
  // Une recherche répond à une demande précise : c'est la pertinence qui
  // ordonne, pas la diversité des vendeurs.
  const diversifie = !!options?.diversifie && paginated;
  // Les catégories arrivent dans un tableau recréé à chaque rendu : on
  // dépend de son CONTENU, sinon chaque rendu relancerait un chargement.
  const cleCategories = (options?.categoriesPreferees || []).join(',');

  /**
   * Filtres communs à la liste affichée et à l'index du fil : les deux doivent
   * porter exactement sur le même périmètre, sinon l'ordre composé désignerait
   * des annonces que la liste ne sait pas charger.
   */
  const appliquerFiltres = useCallback((requete: any) => {
    let query = requete.eq('statut', 'active').eq('est_payee', true);

    if (options?.categorie) {
      query = query.eq('categorie', options.categorie);
    }

    if (options?.sousCategorie) {
      query = query.eq('sous_categorie', options.sousCategorie);
    }

    // La recherche textuelle est effectuée côté client pour être plus flexible (pertinence fuzzy)

    if (options?.minPrice !== undefined && options?.minPrice !== null) {
      query = query.gte('prix', options.minPrice);
    }

    if (options?.maxPrice !== undefined && options?.maxPrice !== null) {
      query = query.lte('prix', options.maxPrice);
    }

    if (options?.etat) {
      query = query.eq('etat_article', options.etat);
    }

    // Fenetre « Nouveautes » : la borne vient de `depuisRef` (posee par
    // fetchAnnonces) pour rester identique entre la page 1 et les suivantes.
    if (depuisHeures && depuisRef.current) {
      query = query.gte('date_creation', depuisRef.current);
    }

    return query;
  }, [
    options?.categorie,
    options?.sousCategorie,
    options?.minPrice,
    options?.maxPrice,
    options?.etat,
    depuisHeures,
  ]);

  const buildQuery = useCallback(() => {
    let query = appliquerFiltres(supabase.from('annonces').select(SELECT_CARTE));

    // Tri
    const sort = options?.orderBy || 'newest';
    if (sort === 'newest') {
      // Boost payant (§ boost 250 FCFA) : une annonce boostée passe devant
      // le fil chronologique. `expirerBoostsSiBesoin()` (appelée dans
      // fetchAnnonces) nettoie les boosts expirés avant cette requête, sinon
      // une annonce dont le boost est terminé resterait coincée en tête —
      // sa colonne resterait non-NULL sans ce nettoyage.
      query = query
        .order('boost_expire_le', { ascending: false, nullsFirst: false })
        .order('date_creation', { ascending: false });
    } else if (sort === 'price_asc') {
      query = query.order('prix', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('prix', { ascending: false });
    }

    // `limit` et `range` ne se combinent pas : en mode paginé c'est `range`
    // qui découpe le résultat.
    if (options?.limit && !paginated) {
      query = query.limit(options.limit);
    }

    return query;
  }, [appliquerFiltres, options?.limit, options?.orderBy, paginated]);

  /**
   * Retire du fil et de la recherche ce que la moderation a limite (§16.6).
   *
   * « Une annonce limitee n'est pas forcement supprimee : elle peut etre
   * retiree des recommandations en attendant une verification. » Elle reste
   * accessible par son lien direct — le proprietaire ne perd rien — mais elle
   * cesse d'etre poussee aux acheteurs.
   *
   * Le filtre est applique APRES la requete et non dedans : si la migration de
   * moderation n'est pas encore appliquee, la colonne n'existe pas et une
   * clause SQL la referencant casserait tout le fil d'accueil.
   */
  const retirerLesLimitees = (rows: Annonce[]) =>
    rows.filter(a => {
      const statut = (a as any).moderation_status;
      return !statut || statut === 'approved';
    });

  /**
   * Charge les cartes d'une page du fil composé, dans l'ordre demandé.
   *
   * `.in('id', ...)` ne garantit aucun ordre : c'est ici qu'on rétablit celui
   * de `composerFil`. Les filtres de base sont réappliqués car une annonce
   * peut avoir été vendue ou retirée entre la lecture de l'index et celle des
   * cartes ; dans ce cas elle disparaît simplement de la page.
   */
  const chargerParIds = useCallback(async (ids: string[]): Promise<Annonce[]> => {
    if (ids.length === 0) return [];
    const { data, error: fetchError } = await supabase
      .from('annonces')
      .select(SELECT_CARTE)
      .in('id', ids)
      .eq('statut', 'active')
      .eq('est_payee', true);
    if (fetchError) throw fetchError;

    const parId = new Map((data as Annonce[]).map(a => [a.id, a]));
    return ids.map(id => parId.get(id)).filter(Boolean) as Annonce[];
  }, []);

  const applySearch = useCallback((rows: Annonce[]) => {
    if (!isSearching) return rows;
    // filterByRelevance ne garde que le meilleur niveau de correspondance :
    // s'il existe une annonce dont le titre contient les mots cherchés, les
    // simples voisines de catégorie sont écartées.
    return filterByRelevance(
      rows.map(a => ({ ...a, searchScore: scoreAnnonce(searchTerm, a) }))
    ) as Annonce[];
  }, [isSearching, searchTerm]);

  const fetchAnnonces = useCallback(async () => {
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      console.error('⏱️ Timeout Supabase — requête bloquée après 10s');
      setError('Impossible de charger les annonces. Vérifiez votre connexion.');
      setLoading(false);
    }, 10000);

    try {
      setLoading(true);
      setError(null);

      depuisRef.current = depuisHeures
        ? new Date(Date.now() - depuisHeures * 3600 * 1000).toISOString()
        : null;

      // Nettoie les boosts expirés avant de trier dessus (voir buildQuery).
      // Best-effort : si la migration n'est pas encore appliquée, la RPC est
      // absente et on l'ignore silencieusement plutôt que de casser le fil.
      supabase.rpc('expirer_boosts').then(({ error: e }) => {
        if (e && !rpcAbsente(e)) console.warn('expirer_boosts:', e.message);
      });

      // Fil d'accueil : on lit d'abord l'index complet (léger, sans image)
      // pour composer un ordre où les vendeurs alternent, puis on ne charge
      // que la première page de cet ordre.
      if (diversifie) {
        const { data: index, error: indexError } = await appliquerFiltres(
          supabase.from('annonces').select(SELECT_INDEX)
        );

        if (timedOut) return;

        if (!indexError && index) {
          ordreRef.current = composerFil(index as any[], {
            categoriesPreferees: cleCategories ? cleCategories.split(',') : [],
          });
          const rows = await chargerParIds(ordreRef.current.slice(0, pageSize!));

          if (timedOut) return;
          clearTimeout(timeoutId);

          pageRef.current = 1;
          setHasMore(ordreRef.current.length > pageSize!);
          setCompose(true);
          setAnnonces(retirerLesLimitees(rows));
          return;
        }

        // L'index n'a pas pu être lu : plutôt qu'un écran vide, on sert le
        // fil chronologique habituel.
        console.warn('Index du fil indisponible, retour au tri par date:', indexError?.message);
        ordreRef.current = [];
        setCompose(false);
      }

      let query = buildQuery();
      if (paginated) {
        query = query.range(0, pageSize! - 1);
      }

      const { data, error: fetchError } = await query;

      if (timedOut) return;
      clearTimeout(timeoutId);

      if (fetchError) {
        console.error('❌ Supabase error:', JSON.stringify(fetchError));
        throw fetchError;
      }

      const rows = (data as Annonce[]) || [];
      console.log('✅ Annonces reçues:', rows.length);

      pageRef.current = 1;
      setHasMore(paginated && rows.length === pageSize);
      setCompose(false);
      setAnnonces(applySearch(retirerLesLimitees(rows)));
    } catch (err: any) {
      if (timedOut) return;
      clearTimeout(timeoutId);
      setError(err.message || 'Erreur lors du chargement');
      console.error('Erreur fetchAnnonces:', err);
    } finally {
      if (!timedOut) setLoading(false);
    }
  }, [buildQuery, applySearch, paginated, pageSize, depuisHeures, diversifie, appliquerFiltres, chargerParIds, cleCategories]);

  /**
   * Charge la page suivante et l'ajoute à la liste. Sans effet si la
   * pagination est désactivée, si tout est déjà chargé, ou si un chargement
   * est déjà en cours (la FlatList peut déclencher onEndReached en rafale).
   */
  const loadMore = useCallback(async () => {
    if (!paginated || !hasMore || loading || fetchingMoreRef.current) return;

    fetchingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const from = pageRef.current * pageSize!;

      // Fil composé : la suite est déjà décidée, il n'y a qu'à charger la
      // tranche d'ids suivante.
      if (diversifie && ordreRef.current.length > 0) {
        const suite = ordreRef.current.slice(from, from + pageSize!);
        const rows = await chargerParIds(suite);
        pageRef.current += 1;
        setHasMore(ordreRef.current.length > from + pageSize!);
        setAnnonces(prev => {
          const seen = new Set(prev.map(a => a.id));
          return [...prev, ...retirerLesLimitees(rows).filter(a => !seen.has(a.id))];
        });
        return;
      }

      const { data, error: fetchError } = await buildQuery().range(from, from + pageSize! - 1);
      if (fetchError) throw fetchError;

      const rows = (data as Annonce[]) || [];
      pageRef.current += 1;
      setHasMore(rows.length === pageSize);

      // Dédoublonnage : une annonce publiée entre deux pages décale le
      // classement et peut faire réapparaître une ligne déjà affichée.
      setAnnonces(prev => {
        const seen = new Set(prev.map(a => a.id));
        return [...prev, ...retirerLesLimitees(rows).filter(a => !seen.has(a.id))];
      });
    } catch (err) {
      console.error('Erreur loadMore annonces:', err);
    } finally {
      fetchingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [buildQuery, paginated, hasMore, loading, pageSize, diversifie, chargerParIds]);

  useEffect(() => {
    fetchAnnonces();
  }, [fetchAnnonces]);

  return { annonces, loading, loadingMore, hasMore, error, compose, refetch: fetchAnnonces, loadMore };
}

/**
 * Hook pour récupérer les annonces d'un vendeur
 */
export function useMesAnnonces(userId: string | undefined) {
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMesAnnonces = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('annonces')
        .select(`
          *,
          images:images_annonce(id, image_url, ordre)
        `)
        .eq('user_id', userId)
        .order('date_creation', { ascending: false });

      if (error) throw error;
      setAnnonces((data as Annonce[]) || []);
    } catch (err) {
      console.error('Erreur fetchMesAnnonces:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMesAnnonces();
  }, [fetchMesAnnonces]);

  return { annonces, loading, refetch: fetchMesAnnonces };
}

/**
 * Créer une nouvelle annonce
 */
/** UUID v4 sans dépendance native — sert de clé d'idempotence de publication. */
function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** La RPC n'existe pas encore : migration de phase 1b non appliquée. */
function rpcAbsente(error: any): boolean {
  const code = error?.code || '';
  const message = String(error?.message || '');
  return code === '42883' || code === 'PGRST202' || /Could not find the function/i.test(message);
}

export async function createAnnonce(
  annonceData: Omit<Annonce, 'id' | 'date_creation' | 'images' | 'user'>,
  imageUris: string[]
): Promise<{ annonce: Annonce | null; error: string | null; photosEchouees: number }> {
  try {
    // 1. Publier l'annonce.
    //
    // La publication passe par une RPC transactionnelle (§12.5) : elle
    // verrouille le compte, relit les droits et insère dans la même
    // transaction. Deux appuis rapides ne créent donc qu'une annonce et ne
    // consomment qu'un crédit, et un client modifié ne peut pas contourner le
    // quota. La clé d'idempotence rend l'appel rejouable après une coupure
    // réseau sans risquer un doublon.
    //
    // Repli : tant que `migration_p1b_publication.sql` n'est pas appliquée,
    // on retombe sur l'insertion directe d'avant — comportement identique.
    console.log("📝 [CreateAnnonce] Publication de l'annonce...", annonceData.titre);

    let annonce: any = null;
    const cleIdempotence = uuidV4();

    const { data: resultat, error: rpcError } = await supabase.rpc('publier_annonce', {
      p_annonce: annonceData,
      p_idempotency_key: cleIdempotence,
    });

    if (rpcError && !rpcAbsente(rpcError)) {
      console.error("❌ [CreateAnnonce Error] publier_annonce:", rpcError);
      throw rpcError;
    }

    if (!rpcError && resultat?.annonce_id) {
      const { data: ligne, error: relectureError } = await supabase
        .from('annonces')
        .select('*')
        .eq('id', resultat.annonce_id)
        .single();
      if (relectureError) throw relectureError;
      annonce = ligne;
      console.log(
        "✅ [CreateAnnonce] Publiee par le serveur — credits restants :",
        resultat.credits_restants
      );
    } else {
      // Repli : insertion directe (comportement d'avant la phase 1b).
      const { data: insere, error: insertError } = await supabase
        .from('annonces')
        .insert(annonceData)
        .select()
        .single();

      if (insertError) {
        console.error("❌ [CreateAnnonce Error] Insertion annonce:", insertError);
        throw insertError;
      }
      annonce = insere;
      console.log("✅ [CreateAnnonce] Inseree en repli local");
    }

    console.log("✅ [CreateAnnonce] Annonce créée avec ID:", annonce.id);

    // 2. Photos. Les echecs ne sont plus avales : une annonce sans photo est
    // invendable, et le vendeur doit savoir tout de suite qu'il lui en manque
    // pour pouvoir les rajouter (§ modification d'annonce).
    let photosEchouees = 0;
    if (annonce && imageUris.length > 0) {
      const { urls, echecs } = await televerserPhotosAnnonce(annonce.id, imageUris);
      photosEchouees = echecs;
      if (urls.length > 0) {
        const { error: imgTableError } = await supabase.from('images_annonce').insert(
          urls.map((image_url, ordre) => ({ annonce_id: annonce.id, image_url, ordre }))
        );
        if (imgTableError) {
          console.error('[CreateAnnonce] Table images_annonce:', imgTableError);
          photosEchouees = imageUris.length;
        }
      }
    }

    // 3. Récupérer l'annonce complète avec ses images pour le retour
    console.log("🔄 [CreateAnnonce] Récupération de l'annonce finale...");
    const { data: finalAnnonce, error: finalError } = await supabase
      .from('annonces')
      .select(`
        *,
        images:images_annonce(image_url, ordre)
      `)
      .eq('id', annonce.id)
      .single();

    if (finalError) {
      console.warn("⚠️ [CreateAnnonce] Erreur récup finale (non bloquant):", finalError);
      return { annonce: annonce as Annonce, error: null, photosEchouees };
    }

    console.log("✨ [CreateAnnonce] Annonce complète prête !");
    return { annonce: finalAnnonce as Annonce, error: null, photosEchouees };
  } catch (err: any) {
    console.error("🔥 [CreateAnnonce Exception]:", err);
    return { annonce: null, error: err.message || 'Erreur lors de la création', photosEchouees: 0 };
  }
}

/**
 * Marquer une annonce comme vendue
 */
export async function markAsSold(annonceId: string) {
  const { error } = await supabase
    .from('annonces')
    .update({ statut: 'vendu' })
    .eq('id', annonceId);
  return { error };
}

/**
 * Supprimer une annonce
 */
export async function toggleFavori(annonceId: string, userId: string): Promise<boolean> {
  // TODO: Implémenter logic favoris
  return false;
}

export async function updateAnnonceStatus(id: string, statut: 'active' | 'vendu' | 'inactive'): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('annonces')
      .update({ statut })
      .eq('id', id);
    return { error };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteAnnonceById(id: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('annonces')
      .delete()
      .eq('id', id);
    return { error };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Supprimer une annonce
 */
export async function deleteAnnonce(annonceId: string) {
  // Les images seront supprimées par CASCADE
  const { error } = await supabase
    .from('annonces')
    .delete()
    .eq('id', annonceId);
  return { error };
}
