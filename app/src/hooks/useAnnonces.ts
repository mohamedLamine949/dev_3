import { useState, useEffect, useCallback } from 'react';
import { supabase, Annonce, ImageAnnonce } from '../lib/supabase';
import { getSousCategorieSearchText } from '../constants/theme';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

function calculatePostRelevance(query: string, item: any): number {
  if (!query) return 0;
  const cleanQuery = query.toLowerCase().trim();
  const queryWords = cleanQuery.split(/[\s,.-]+/).filter(w => w.length > 0);
  if (queryWords.length === 0) return 0;
  
  let score = 0;
  const title = (item.titre || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const category = (item.categorie || '').toLowerCase();
  const sousCategorie = getSousCategorieSearchText(item.sous_categorie);
  const location = `${item.ville || ''} ${item.quartier || ''}`.toLowerCase();
  
  if (title.includes(cleanQuery)) {
    score += 20;
  } else if (desc.includes(cleanQuery)) {
    score += 10;
  }
  
  let matchingWordsCount = 0;
  queryWords.forEach(word => {
    let wordMatched = false;
    if (title.includes(word)) {
      score += 8;
      wordMatched = true;
      if (title.split(/[\s,.-]+/).includes(word)) {
        score += 4;
      }
    }
    if (desc.includes(word)) {
      score += 3;
      wordMatched = true;
      if (desc.split(/[\s,.-]+/).includes(word)) {
        score += 1.5;
      }
    }
    if (category.includes(word)) {
      score += 4;
      wordMatched = true;
    }
    if (sousCategorie && sousCategorie.includes(word)) {
      score += 5;
      wordMatched = true;
    }
    if (location.includes(word)) {
      score += 2;
      wordMatched = true;
    }
    if (!wordMatched && word.length > 2) {
      const titleWords = title.split(/[\s,.-]+/);
      const partialMatch = titleWords.some((tw: string) => tw.includes(word) || word.includes(tw));
      if (partialMatch) {
        score += 2.5;
      }
    }
    if (wordMatched) {
      matchingWordsCount++;
    }
  });
  
  if (queryWords.length > 1 && matchingWordsCount > 0) {
    score += (matchingWordsCount / queryWords.length) * 10;
  }
  
  return score;
}

/**
 * Hook pour récupérer les annonces actives avec filtrage
 */
export function useAnnonces(options?: {
  categorie?: string | null;
  sousCategorie?: string | null;
  search?: string;
  limit?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  etat?: string | null;
  orderBy?: 'newest' | 'price_asc' | 'price_desc';
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
        .select('*, images:images_annonce(id, image_url, ordre)')
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
      if (data && data.length > 0) {
        console.log('📸 [DEBUG] Première annonce - images:', JSON.stringify(data[0].images));
      }

      let finalData = (data as Annonce[]) || [];
      if (options?.search) {
        finalData = finalData
          .map(a => ({ ...a, searchScore: calculatePostRelevance(options.search!, a) }))
          .filter(a => (a as any).searchScore > 0)
          .sort((a, b) => (b as any).searchScore - (a as any).searchScore);
      }

      setAnnonces(finalData);
    } catch (err: any) {
      if (timedOut) return;
      clearTimeout(timeoutId);
      setError(err.message || 'Erreur lors du chargement');
      console.error('Erreur fetchAnnonces:', err);
    } finally {
      if (!timedOut) setLoading(false);
    }
  }, [options?.categorie, options?.sousCategorie, options?.search, options?.limit, options?.minPrice, options?.maxPrice, options?.etat, options?.orderBy]);

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
    console.log("📝 [CreateAnnonce] Insertion de l'annonce...", annonceData.titre);
    const { data: annonce, error: insertError } = await supabase
      .from('annonces')
      .insert(annonceData)
      .select()
      .single();

    if (insertError) {
      console.error("❌ [CreateAnnonce Error] Insertion annonce:", insertError);
      throw insertError;
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
              upsert: true
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
