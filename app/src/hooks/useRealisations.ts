import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Réalisations d'un prestataire — le portfolio avant/après.
 *
 * C'est ce qu'un artisan montre en premier quand on lui demande ce qu'il sait
 * faire, et c'est ce qu'un client regarde avant de décrocher son téléphone.
 * Un menuisier n'a pas de « stock » à exposer ; il a des chantiers finis.
 *
 * La photo « après » est obligatoire, la photo « avant » ne l'est pas :
 * exiger les deux ferait renoncer la moitié des prestataires, qui n'ont pas
 * pensé à photographier avant de commencer.
 */

export interface Realisation {
  id: string;
  user_id: string;
  titre: string | null;
  image_avant: string | null;
  image_apres: string;
  categorie: string | null;
  ordre: number;
  date_creation: string;
}

export function useRealisations(userId: string | undefined) {
  const [realisations, setRealisations] = useState<Realisation[]>([]);
  const [loading, setLoading] = useState(false);
  /** `true` tant que la migration n'est pas appliquée : on masque la section. */
  const [indisponible, setIndisponible] = useState(false);

  const refetch = useCallback(async () => {
    if (!userId) {
      setRealisations([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('realisations')
      .select('*')
      .eq('user_id', userId)
      .order('ordre', { ascending: true })
      .order('date_creation', { ascending: false });

    if (error) {
      // Table absente : on ne montre pas une section vide qui laisserait
      // croire que le professionnel n'a rien réalisé.
      setIndisponible(true);
      setRealisations([]);
    } else {
      setIndisponible(false);
      setRealisations((data as Realisation[]) || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { realisations, loading, indisponible, refetch };
}

export async function supprimerRealisation(id: string): Promise<string | null> {
  const { error } = await supabase.from('realisations').delete().eq('id', id);
  return error ? error.message : null;
}
