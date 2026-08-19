import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../lib/supabase';

// Petit aperçu de boutiques PRO + total, pour la carte CTA de l'Accueil.
export function useDecouverteProPreview(limit: number = 5) {
  const [shops, setShops] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from('users')
          .select('id, prenom, nom, nom_boutique, avatar_url')
          .eq('type_compte', 'professionnel')
          .order('date_creation', { ascending: false })
          .limit(limit),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('type_compte', 'professionnel'),
      ]);
      if (cancelled) return;
      setShops((data as User[]) || []);
      setTotal(count || 0);
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
        .select('categorie_metier')
        .eq('type_compte', 'professionnel')
        .not('categorie_metier', 'is', null);
      if (cancelled) return;
      const acc: Record<string, number> = {};
      (data || []).forEach((row: { categorie_metier: string | null }) => {
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

    const shopList = (users as User[]) || [];
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
