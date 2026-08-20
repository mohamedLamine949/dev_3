import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../lib/supabase';

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

// Petit aperçu de boutiques PRO + total, pour la carte CTA de l'Accueil.
export function useDecouverteProPreview(limit: number = 5) {
  const [shops, setShops] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Le total doit refleter les boutiques REELLEMENT visibles : on compte
      // apres filtrage, sinon la carte annonce « 12 boutiques » alors que
      // l'annuaire n'en montre que 8.
      const [{ data }, { data: tousLesPros }] = await Promise.all([
        supabase
          .from('users')
          .select('id, prenom, nom, nom_boutique, avatar_url')
          .eq('type_compte', 'professionnel')
          .order('date_creation', { ascending: false })
          .limit(limit),
        supabase
          .from('users')
          .select('id')
          .eq('type_compte', 'professionnel'),
      ]);
      if (cancelled) return;
      const [apercu, totalValides] = await Promise.all([
        filtrerProsValides(((data as User[]) || []) as any),
        filtrerProsValides(((tousLesPros as { id: string }[]) || []) as any),
      ]);
      if (cancelled) return;
      setShops(apercu as User[]);
      setTotal(totalValides.length);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [limit]);

  return { shops, total, loading };
}

// Nombre de boutiques PRO par catégorie métier, pour les compteurs des
// tuiles de l'écran Découverte Pro.
export function useMetierCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, categorie_metier')
        .eq('type_compte', 'professionnel')
        .not('categorie_metier', 'is', null);
      if (cancelled) return;
      // Une boutique dont l'abonnement a expire ne doit plus etre comptee dans
      // les tuiles : le compteur annoncerait des boutiques introuvables.
      const valides = await filtrerProsValides((data || []) as any[]);
      if (cancelled) return;
      const acc: Record<string, number> = {};
      (valides || []).forEach((row: { categorie_metier: string | null }) => {
        if (!row.categorie_metier) return;
        acc[row.categorie_metier] = (acc[row.categorie_metier] || 0) + 1;
      });
      setCounts(acc);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { counts, loading };
}

export interface ProShopWithCount extends User {
  nbProduits: number;
}

// Boutiques PRO d'une catégorie métier donnée, avec leur nombre de
// produits actifs (pour la grille de l'écran Découverte Pro > un métier).
export function useProShopsByMetier(categorieMetier: string | undefined) {
  const [shops, setShops] = useState<ProShopWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!categorieMetier) return;
    setLoading(true);
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('type_compte', 'professionnel')
      .eq('categorie_metier', categorieMetier)
      .order('date_creation', { ascending: false });

    const shopList = await filtrerProsValides((((users as User[]) || []) as any)) as User[];
    if (shopList.length === 0) {
      setShops([]);
      setLoading(false);
      return;
    }

    const { data: annonces } = await supabase
      .from('annonces')
      .select('user_id')
      .eq('statut', 'active')
      .in('user_id', shopList.map(s => s.id));

    const counts: Record<string, number> = {};
    (annonces || []).forEach((a: { user_id: string }) => {
      counts[a.user_id] = (counts[a.user_id] || 0) + 1;
    });

    setShops(shopList.map(s => ({ ...s, nbProduits: counts[s.id] || 0 })));
    setLoading(false);
  }, [categorieMetier]);

  useEffect(() => { refetch(); }, [refetch]);

  return { shops, loading, refetch };
}
