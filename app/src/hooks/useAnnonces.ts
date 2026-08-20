import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Annonce, ImageAnnonce } from '../lib/supabase';
import { scoreAnnonce, filterByRelevance } from '../lib/relevance';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { UPLOAD_CACHE_CONTROL } from '../lib/imageOptimizer';

/** Nombre d'annonces chargées par page sur les listes paginées. */
export const ANNONCES_PAGE_SIZE = 20;

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
}) {
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(0);
  const fetchingMoreRef = useRef(false);

  const searchTerm = options?.search?.trim() ?? '';
  const isSearching = searchTerm.length > 0;
  const pageSize = options?.pageSize;
  // La recherche est scorée côté client (pertinence fuzzy) : elle a besoin du
  // corpus complet, on ne pagine donc pas dans ce cas. Ce sont les images —
  // virtualisées par la FlatList — qui coûtent cher, pas les lignes.
  const paginated = !!pageSize && !isSearching;

  const buildQuery = useCallback(() => {
    let query = supabase
      .from('annonces')
      // On joint le type de compte du vendeur pour afficher le badge PRO sur
      // les cartes (le badge dérive du type_compte : les annonces déjà en
      // ligne d'un compte pro l'obtiennent automatiquement).
      .select('*, images:images_annonce(id, image_url, ordre), user:users!annonces_user_id_fkey(id, prenom, nom, nom_boutique, avatar_url, type_compte)')
      .eq('statut', 'active')
      .eq('est_payee', true);

    // Tri
    const sort = options?.orderBy || 'newest';
    if (sort === 'newest') {
      query = query.order('date_creation', { ascending: false });
    } else if (sort === 'price_asc') {
      query = query.order('prix', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('prix', { ascending: false });
    }

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

    // `limit` et `range` ne se combinent pas : en mode paginé c'est `range`
    // qui découpe le résultat.
    if (options?.limit && !paginated) {
      query = query.limit(options.limit);
    }

    return query;
  }, [
    options?.categorie,
    options?.sousCategorie,
    options?.limit,
    options?.minPrice,
    options?.maxPrice,
    options?.etat,
    options?.orderBy,
    paginated,
  ]);

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
      setAnnonces(applySearch(rows));
    } catch (err: any) {
      if (timedOut) return;
      clearTimeout(timeoutId);
      setError(err.message || 'Erreur lors du chargement');
      console.error('Erreur fetchAnnonces:', err);
    } finally {
      if (!timedOut) setLoading(false);
    }
  }, [buildQuery, applySearch, paginated, pageSize]);

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
      const { data, error: fetchError } = await buildQuery().range(from, from + pageSize! - 1);
      if (fetchError) throw fetchError;

      const rows = (data as Annonce[]) || [];
      pageRef.current += 1;
      setHasMore(rows.length === pageSize);

      // Dédoublonnage : une annonce publiée entre deux pages décale le
      // classement et peut faire réapparaître une ligne déjà affichée.
      setAnnonces(prev => {
        const seen = new Set(prev.map(a => a.id));
        return [...prev, ...rows.filter(a => !seen.has(a.id))];
      });
    } catch (err) {
      console.error('Erreur loadMore annonces:', err);
    } finally {
      fetchingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [buildQuery, paginated, hasMore, loading, pageSize]);

  useEffect(() => {
    fetchAnnonces();
  }, [fetchAnnonces]);

  return { annonces, loading, loadingMore, hasMore, error, refetch: fetchAnnonces, loadMore };
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
): Promise<{ annonce: Annonce | null; error: string | null }> {
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

    // 2. Upload des images et insertion des URLs
    if (annonce && imageUris.length > 0) {
      for (let i = 0; i < imageUris.length; i++) {
        const uri = imageUris[i];
        const fileExt = 'jpg';
        const fileName = `${annonce.id}/${i}.${fileExt}`;

        console.log(`📤 [CreateAnnonce] Upload image ${i+1}/${imageUris.length}...`);

        try {
          // Upload vers Supabase Storage via Base64 pour React Native
          const base64 = await FileSystem.readAsStringAsync(uri, { 
            encoding: 'base64' as any
          });

          const { error: uploadError } = await supabase.storage
            .from('annonces-images')
            .upload(fileName, decode(base64), { 
              contentType: 'image/jpeg',
              upsert: true,
              // Cache CDN 1 an : sans ça Supabase applique max-age=3600 et la
              // même photo est re-téléchargée toutes les heures par chaque
              // utilisateur (première cause de l'egress).
              cacheControl: UPLOAD_CACHE_CONTROL,
            });

          if (uploadError) {
            console.error(`❌ [CreateAnnonce Error] Upload image ${i}:`, uploadError);
            continue;
          }

          // Récupérer l'URL publique
          const { data: urlData } = supabase.storage
            .from('annonces-images')
            .getPublicUrl(fileName);

          console.log(`🔗 [CreateAnnonce] Image ${i} URL:`, urlData.publicUrl);

          // Insérer la référence dans images_annonce
          const { error: imgTableError } = await supabase.from('images_annonce').insert({
            annonce_id: annonce.id,
            image_url: urlData.publicUrl,
            ordre: i,
          });

          if (imgTableError) {
            console.error(`❌ [CreateAnnonce Error] Table images_annonce:`, imgTableError);
          }
        } catch (uploadErr) {
          console.error(`❌ [CreateAnnonce Exception] Image ${i}:`, uploadErr);
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
      return { annonce: annonce as Annonce, error: null };
    }

    console.log("✨ [CreateAnnonce] Annonce complète prête !");
    return { annonce: finalAnnonce as Annonce, error: null };
  } catch (err: any) {
    console.error("🔥 [CreateAnnonce Exception]:", err);
    return { annonce: null, error: err.message || 'Erreur lors de la création' };
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
