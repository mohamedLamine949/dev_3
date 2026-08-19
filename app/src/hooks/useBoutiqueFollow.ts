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
    const [{ count }, followingRes] = await Promise.all([
      supabase
        .from('boutique_follows')
        .select('id', { count: 'exact', head: true })
        .eq('boutique_id', boutiqueId),
      followerId
        ? supabase
            .from('boutique_follows')
            .select('id')
            .eq('boutique_id', boutiqueId)
            .eq('follower_id', followerId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setFollowerCount(count || 0);
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
  }, [boutiqueId, followerId, isFollowing, busy]);

  return { isFollowing, followerCount, loading, busy, toggleFollow };
}
