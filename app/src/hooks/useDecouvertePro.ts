import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../lib/supabase';
import { rotationEquitable } from '../lib/rotationPro';
import { METIER_CATEGORIES } from '../constants/theme';

/**
 * Restreint une liste de comptes aux PRO REELLEMENT valides.
 *
 * L'annuaire lisait `type_compte = 'professionnel'`, qui ne verifie aucune
 * date : une boutique dont l'abonnement a expire y restait affichee. Le §11.7
 * l'interdit — a l'expiration, « la boutique est retiree de l'annuaire et du
 * classement public », les donnees restant intactes cote proprietaire.
 *
 * Repli : si la vue `v_entitlements_publics` n'existe pas encore (migration de
 * phase 1 non appliquee), on renvoie la liste telle quelle.
 */
async function filtrerProsValides<T extends { id: string }>(comptes: T[]): Promise<T[]> {
  if (comptes.length === 0) return comptes;
  const { data, error } = await supabase
    .from('v_entitlements_publics')
    .select('user_id')
    .eq('plan_public', 'pro')
    .in('user_id', comptes.map(c => c.id));
  if (error || !data) return comptes; // vue absente : ancien comportement
  const valides = new Set(data.map((r: any) => r.user_id as string));
  return comptes.filter(c => valides.has(c.id));
}

// ─────────────────────────────────────────────────────────────────────────
// Repertoire des boutiques : une seule source pour l'accueil, les compteurs
// et les listes par metier.
// ─────────────────────────────────────────────────────────────────────────
// Chacun des trois ecrans posait sa propre question a la base, avec des
// filtres differents : l'accueil comptait TOUS les PRO valides, les tuiles ne
// comptaient que ceux ayant renseigne `categorie_metier`. D'ou « 17 boutiques »
// a l'accueil et 11 seulement atteignables dans les tuiles — les comptes PRO
// qui n'ont jamais choisi leur metier n'apparaissaient nulle part, catalogue
// compris. Une seule fonction decide desormais qui est une boutique et dans
// quelle tuile elle tombe : les deux affichages ne peuvent plus se contredire.

/** Champs necessaires aux cartes de l'annuaire et au classement equitable. */
const CHAMPS_BOUTIQUE =
  'id, prenom, nom, nom_boutique, boutique_slug, avatar_url, banniere_url, ' +
  'quartier_boutique, adresse_boutique, horaires, disponibilite, ' +
  'ouvert_maintenant, categorie_metier, type_activite, bio';

/**
 * Metier deduit de la categorie des produits publies, pour une boutique qui
 * n'a jamais choisi le sien. On ne mappe que les correspondances evidentes :
 * mieux vaut « Autres boutiques » qu'un vendeur d'alimentation range dans
 * « Restaurants » ou un vendeur de motos dans « Voitures ».
 */
const METIER_PAR_CATEGORIE_PRODUIT: Record<string, string> = {
  telephonie_electronique: 'telephonie_electronique_pro',
  mode_beaute: 'mode_beaute_pro',
  voitures: 'voitures_concessionnaires',
  immobilier: 'immobilier_pro',
  services: 'professionnels_metier',
};

const METIERS_CONNUS = new Set(METIER_CATEGORIES.map(m => m.id));

/** Tuile fourre-tout : aucune boutique ne doit rester introuvable. */
export const METIER_AUTRES = 'autres_pro';

export interface BoutiqueAnnuaire extends User {
  nbProduits: number;
  /** Tuile dans laquelle la boutique est rangee. Jamais nul. */
  metier: string;
  derniere_publication?: string | null;
}

/**
 * Une fiche vide n'est pas une boutique : un compte passe PRO qui n'a ni nom
 * de boutique ni produit actif afficherait une carte anonyme menant a une
 * vitrine vide. On l'exclut de l'annuaire — et donc aussi du total annonce a
 * l'accueil, qui doit promettre exactement ce que l'acheteur va trouver.
 */
function estBoutiqueVisible(b: { nom_boutique?: string | null; nbProduits: number }): boolean {
  return Boolean((b.nom_boutique || '').trim()) || b.nbProduits > 0;
}

/** Categorie produit dominante d'une boutique, a egalite la plus fournie. */
function metierDeduit(categories: Record<string, number>): string | null {
  let meilleure: string | null = null;
  let max = 0;
  Object.entries(categories).forEach(([cat, n]) => {
    const metier = METIER_PAR_CATEGORIE_PRODUIT[cat];
    if (metier && n > max) { meilleure = metier; max = n; }
  });
  return meilleure;
}

// Les trois hooks se montent quasi simultanement (accueil, puis annuaire) :
// sans ce cache tres court, la meme paire de requetes partirait trois fois.
// L'egress Supabase est une ressource comptee.
const DUREE_CACHE_MS = 30_000;
let cache: { t: number; data: BoutiqueAnnuaire[] } | null = null;

async function chargerAnnuairePro(force = false): Promise<BoutiqueAnnuaire[]> {
  if (!force && cache && Date.now() - cache.t < DUREE_CACHE_MS) return cache.data;

  const { data } = await supabase
    .from('users')
    .select(CHAMPS_BOUTIQUE)
    .eq('type_compte', 'professionnel');
  const pros = (await filtrerProsValides(((data as unknown as User[]) || []) as any)) as User[];
  if (pros.length === 0) {
    cache = { t: Date.now(), data: [] };
    return [];
  }

  const { data: annonces } = await supabase
    .from('annonces')
    .select('user_id, categorie, date_creation')
    .eq('statut', 'active')
    .in('user_id', pros.map(p => p.id));

  const parVendeur: Record<string, { n: number; cats: Record<string, number>; derniere: string | null }> = {};
  (annonces || []).forEach((a: { user_id: string; categorie: string | null; date_creation: string | null }) => {
    const e = parVendeur[a.user_id] || (parVendeur[a.user_id] = { n: 0, cats: {}, derniere: null });
    e.n += 1;
    if (a.categorie) e.cats[a.categorie] = (e.cats[a.categorie] || 0) + 1;
    if (a.date_creation && (!e.derniere || a.date_creation > e.derniere)) e.derniere = a.date_creation;
  });

  const boutiques = pros
    .map(p => {
      const e = parVendeur[p.id];
      const choisi = p.categorie_metier && METIERS_CONNUS.has(p.categorie_metier) ? p.categorie_metier : null;
      return {
        ...p,
        nbProduits: e?.n || 0,
        derniere_publication: e?.derniere || null,
        metier: choisi || metierDeduit(e?.cats || {}) || METIER_AUTRES,
      } as BoutiqueAnnuaire;
    })
    .filter(estBoutiqueVisible);

  cache = { t: Date.now(), data: boutiques };
  return boutiques;
}

// Petit aperçu de boutiques PRO + total, pour la carte CTA de l'Accueil.
export function useDecouverteProPreview(limit: number = 5) {
  const [shops, setShops] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Le total doit refleter les boutiques REELLEMENT atteignables : c'est
      // le meme repertoire qui alimente les tuiles, donc la carte ne peut plus
      // annoncer « 17 boutiques » quand l'annuaire n'en montre que 11.
      // On charge TOUTES les boutiques valides puis on fait tourner, au lieu
      // de prendre les plus recemment inscrites : sinon ce sont toujours les
      // trois memes qui sont vues, et une boutique de juillet ne l'est jamais.
      const boutiques = await chargerAnnuairePro();
      if (cancelled) return;
      setShops(rotationEquitable(boutiques as any, Date.now(), limit).slice(0, limit) as User[]);
      setTotal(boutiques.length);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [limit]);

  return { shops, total, loading };
}

// Nombre de boutiques PRO par catégorie métier, pour les compteurs des
// tuiles de l'écran Découverte Pro. La somme des tuiles vaut exactement le
// total affiche a l'accueil : toute boutique tombe dans une tuile, au pire
// « Autres boutiques ».
export function useMetierCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const boutiques = await chargerAnnuairePro();
      if (cancelled) return;
      const acc: Record<string, number> = {};
      boutiques.forEach(b => { acc[b.metier] = (acc[b.metier] || 0) + 1; });
      setCounts(acc);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { counts, loading };
}

export interface ProShopWithCount extends BoutiqueAnnuaire {}

// Boutiques PRO d'une catégorie métier donnée, avec leur nombre de
// produits actifs (pour la grille de l'écran Découverte Pro > un métier).
export function useProShopsByMetier(categorieMetier: string | undefined) {
  const [shops, setShops] = useState<ProShopWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!categorieMetier) return;
    setLoading(true);
    // `force` : on arrive ici par un geste explicite (ouverture d'une tuile,
    // tirer-pour-rafraichir), le cache ne doit pas masquer une nouveaute.
    const boutiques = await chargerAnnuairePro(true);
    // La rotation prend en compte la qualite du profil, la disponibilite et
    // la fraicheur du catalogue — et fait tourner a qualite egale.
    const duMetier = boutiques.filter(b => b.metier === categorieMetier);
    setShops(rotationEquitable(duMetier as any) as ProShopWithCount[]);
    setLoading(false);
  }, [categorieMetier]);

  useEffect(() => { refetch(); }, [refetch]);

  return { shops, loading, refetch };
}
