import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useFavoris(userId: string | undefined) {
  const [favorisIds, setFavorisIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavoris = useCallback(async () => {
    if (!userId) { setFavorisIds(new Set()); setLoading(false); return; }
    const { data } = await supabase
      .from('favoris')
      .select('annonce_id')
      .eq('user_id', userId);
    setFavorisIds(new Set((data || []).map((f: any) => f.annonce_id)));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchFavoris(); }, [fetchFavoris]);

  return { favorisIds, loading, refetch: fetchFavoris };
}

export async function toggleFavori(userId: string, annonceId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('favoris')
    .select('id')
    .eq('user_id', userId)
    .eq('annonce_id', annonceId)
    .maybeSingle();

  if (existing) {
    await supabase.from('favoris').delete().eq('id', existing.id);
    return false;
  }
  await supabase.from('favoris').insert({ user_id: userId, annonce_id: annonceId });
  return true;
}

export function useFavorisAnnonces(userId: string | undefined) {
  const [annonces, setAnnonces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorisAnnonces = useCallback(async () => {
    if (!userId) { setAnnonces([]); setLoading(false); return; }
    const { data } = await supabase
      .from('favoris')
      .select(`
        annonce_id,
        annonce:annonces(*, images:images_annonce(image_url, ordre))
      `)
      .eq('user_id', userId)
      .order('date_ajout', { ascending: false });
    setAnnonces((data || []).map((f: any) => f.annonce).filter(Boolean));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchFavorisAnnonces(); }, [fetchFavorisAnnonces]);

  return { annonces, loading, refetch: fetchFavorisAnnonces };
}
