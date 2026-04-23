import { useState, useEffect, useCallback } from 'react';
import { supabase, Annonce, ImageAnnonce } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

/**
 * Hook pour récupérer les annonces actives avec filtrage
 */
export function useAnnonces(options?: {
  categorie?: string | null;
  search?: string;
  limit?: number;
}) {
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      let query = supabase
        .from('annonces')
        .select('*')
        .eq('statut', 'active')
        .eq('est_payee', true)
        .order('date_creation', { ascending: false });

      if (options?.categorie) {
        query = query.eq('categorie', options.categorie);
      }

      if (options?.search) {
        query = query.ilike('titre', `%${options.search}%`);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;

      if (timedOut) return;
      clearTimeout(timeoutId);

      if (fetchError) {
        console.error('❌ Supabase error:', JSON.stringify(fetchError));
        throw fetchError;
      }
      console.log('✅ Annonces reçues:', data?.length ?? 0);
      setAnnonces((data as Annonce[]) || []);
    } catch (err: any) {
      if (timedOut) return;
      clearTimeout(timeoutId);
      setError(err.message || 'Erreur lors du chargement');
      console.error('Erreur fetchAnnonces:', err);
    } finally {
      if (!timedOut) setLoading(false);
    }
  }, [options?.categorie, options?.search, options?.limit]);

  useEffect(() => {
    fetchAnnonces();
  }, [fetchAnnonces]);

  return { annonces, loading, error, refetch: fetchAnnonces };
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
export async function createAnnonce(
  annonceData: Omit<Annonce, 'id' | 'date_creation' | 'images' | 'user'>,
  imageUris: string[]
): Promise<{ annonce: Annonce | null; error: string | null }> {
  try {
    // 1. Insérer l'annonce
    const { data: annonce, error: insertError } = await supabase
      .from('annonces')
      .insert(annonceData)
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Upload des images et insertion des URLs
    if (annonce && imageUris.length > 0) {
      for (let i = 0; i < imageUris.length; i++) {
        const uri = imageUris[i];
        const fileExt = 'jpg';
        const fileName = `${annonce.id}/${i}.${fileExt}`;

        // Upload vers Supabase Storage via Base64 pour React Native
        const base64 = await FileSystem.readAsStringAsync(uri, { 
          encoding: 'base64' as any
        });

        const { error: uploadError } = await supabase.storage
          .from('annonces-images')
          .upload(fileName, decode(base64), { 
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Erreur upload image:', uploadError);
          continue;
        }

        // Récupérer l'URL publique
        const { data: urlData } = supabase.storage
          .from('annonces-images')
          .getPublicUrl(fileName);

        // Insérer la référence dans images_annonce
        await supabase.from('images_annonce').insert({
          annonce_id: annonce.id,
          image_url: urlData.publicUrl,
          ordre: i,
        });
      }
    }

    return { annonce: annonce as Annonce, error: null };
  } catch (err: any) {
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
