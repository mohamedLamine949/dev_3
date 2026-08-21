import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useBoutiqueFollow(boutiqueId: string | undefined, followerId: string | undefined) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    if (!boutiqueId) return;
    setLoading(true);
    const [compteurRes, followingRes] = await Promise.all([
      // Le compteur passe par la vue d'agregats et non par un comptage de
      // lignes : depuis migration_p5, un visiteur ne VOIT aucune ligne
      // d'abonnement — qui suit quelle boutique n'est plus public. Compter
      // les lignes renverrait donc 0 abonne a tout le monde sauf au
      // proprietaire. La vue, elle, n'expose qu'un nombre.
      supabase
        .from('v_boutique_abonnes')
        .select('nb_abonnes')
        .eq('boutique_id', boutiqueId)
        .maybeSingle(),
      followerId
        ? supabase
            .from('boutique_follows')
            .select('id')
            .eq('boutique_id', boutiqueId)
            .eq('follower_id', followerId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    // Repli sur un comptage de lignes tant que la vue n'existe pas.
    if (compteurRes.error) {
      const { count } = await supabase
        .from('boutique_follows')
        .select('id', { count: 'exact', head: true })
        .eq('boutique_id', boutiqueId);
      setFollowerCount(count || 0);
    } else {
      setFollowerCount((compteurRes.data as any)?.nb_abonnes || 0);
    }
    setIsFollowing(!!followingRes.data);
    setLoading(false);
  }, [boutiqueId, followerId]);

  useEffect(() => { refetch(); }, [refetch]);

  const toggleFollow = useCallback(async () => {
    if (!boutiqueId || !followerId || busy) return;
    setBusy(true);
    if (isFollowing) {
      await supabase
        .from('boutique_follows')
        .delete()
        .eq('boutique_id', boutiqueId)
        .eq('follower_id', followerId);
      setIsFollowing(false);
      setFollowerCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('boutique_follows').insert({ boutique_id: boutiqueId, follower_id: followerId });
      setIsFollowing(true);
      setFollowerCount(c => c + 1);
    }
    setBusy(false);
    // La vue d'agregats est la source de verite : on se recale dessus apres
    // la mise a jour optimiste.
    refetch();
  }, [boutiqueId, followerId, isFollowing, busy, refetch]);

  return { isFollowing, followerCount, loading, busy, toggleFollow };
}

export interface BoutiqueFollower {
  id: string;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
  date_creation: string;
}

// Liste des abonnés d'une boutique, pour l'affichage côté PRO ("qui me suit").
// Distinct de useBoutiqueFollow (qui ne renvoie que le compteur + l'état de
// l'utilisateur courant) pour ne rien changer à son comportement existant.
export function useShopFollowers(boutiqueId: string | undefined) {
  const [followers, setFollowers] = useState<BoutiqueFollower[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!boutiqueId) return;
    setLoading(true);
    const { data } = await supabase
      .from('boutique_follows')
      .select('date_creation, follower:follower_id(id, prenom, nom, avatar_url)')
      .eq('boutique_id', boutiqueId)
      .order('date_creation', { ascending: false });
    const list = (data || [])
      .map((row: any) => row.follower ? { ...row.follower, date_creation: row.date_creation } : null)
      .filter(Boolean) as BoutiqueFollower[];
    setFollowers(list);
    setLoading(false);
  }, [boutiqueId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { followers, count: followers.length, loading, refetch };
}
