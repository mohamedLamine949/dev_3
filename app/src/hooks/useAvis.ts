import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Avis {
  id: string;
  auteur_id: string;
  vendeur_id: string;
  annonce_id: string | null;
  note: number;
  commentaire: string | null;
  date_creation: string;
  // Reponse du professionnel (migration_p4_vitrine_services.sql)
  reponse_pro?: string | null;
  date_reponse?: string | null;
  auteur?: { prenom: string | null; nom: string | null; avatar_url: string | null };
}

export function useSellerAvis(vendeurId: string | undefined) {
  const [avis, setAvis] = useState<Avis[]>([]);
  const [avgNote, setAvgNote] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!vendeurId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('avis')
        .select('*, auteur:auteur_id(prenom, nom, avatar_url)')
        .eq('vendeur_id', vendeurId)
        .order('date_creation', { ascending: false });
      if (data) {
        setAvis(data as Avis[]);
        const notes = (data as Avis[]).map(a => a.note);
        setAvgNote(notes.length > 0 ? notes.reduce((s, n) => s + n, 0) / notes.length : null);
      }
    } finally {
      setLoading(false);
    }
  }, [vendeurId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { avis, avgNote, loading, refetch };
}

export async function submitAvis(params: {
  auteurId: string;
  vendeurId: string;
  annonceId: string | null;
  note: number;
  commentaire: string;
}) {
  const { error } = await supabase.from('avis').insert({
    auteur_id: params.auteurId,
    vendeur_id: params.vendeurId,
    annonce_id: params.annonceId || null,
    note: params.note,
    commentaire: params.commentaire.trim() || null,
  });
  return { error };
}

/**
 * Réponse publique du professionnel à un avis reçu.
 *
 * Un avis négatif sans droit de réponse est une condamnation sans procès :
 * le professionnel ne peut ni expliquer ni corriger, et n'a plus aucune
 * raison de rester. La réponse ne modifie jamais la note — elle s'ajoute.
 */
export async function repondreAvis(avisId: string, reponse: string): Promise<string | null> {
  const { error } = await supabase
    .from('avis')
    .update({ reponse_pro: reponse.trim() || null, date_reponse: new Date().toISOString() })
    .eq('id', avisId);
  return error ? error.message : null;
}
