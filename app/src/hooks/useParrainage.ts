import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Programme de parrainage (voir supabase/migration_parrainage.sql).
 * Toute la logique (éligibilité, validation, plafond, budget) vit en base :
 * ce hook ne fait que lire l'état et appeler les fonctions SECURITY DEFINER.
 */

export interface CampagneParrainage {
  id: string;
  nom: string;
  recompense: number;
  annonces_requises: number;
  plafond_filleuls: number;
  max_parrains: number;
  active: boolean;
}

export interface ParrainRow {
  user_id: string;
  code: string | null;
  date_generation_code: string | null;
  om_numero: string | null;
  om_titulaire: string | null;
  eligible: boolean;
  date_eligibilite: string | null;
}

export interface FilleulRow {
  id: string;
  statut: 'en_attente' | 'valide' | 'paye' | 'rejete';
  date_saisie_code: string;
  date_validation: string | null;
  users?: { prenom: string | null; nom: string | null } | null;
}

export interface MonParrainage {
  id: string;
  statut: string;
  date_saisie_code: string;
}

export function useParrainage(userId?: string) {
  const [campagne, setCampagne] = useState<CampagneParrainage | null>(null);
  const [parrain, setParrain] = useState<ParrainRow | null>(null);
  const [filleuls, setFilleuls] = useState<FilleulRow[]>([]);
  const [monParrainage, setMonParrainage] = useState<MonParrainage | null>(null);
  const [annoncesValides, setAnnoncesValides] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: camp } = await supabase
        .from('campagnes_parrainage')
        .select('*')
        .eq('active', true)
        .maybeSingle();
      setCampagne(camp || null);

      if (!userId) {
        setParrain(null);
        setFilleuls([]);
        setMonParrainage(null);
        setAnnoncesValides(0);
        return;
      }

      const { data: p } = await supabase
        .from('parrains')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      setParrain(p || null);

      const { data: mp } = await supabase
        .from('parrainages')
        .select('id, statut, date_saisie_code')
        .eq('filleul_id', userId)
        .maybeSingle();
      setMonParrainage(mp || null);

      if (p?.code) {
        const { data: f } = await supabase
          .from('parrainages')
          .select('id, statut, date_saisie_code, date_validation, users(prenom, nom)')
          .eq('parrain_id', userId)
          .order('date_saisie_code', { ascending: false });
        setFilleuls((f as unknown as FilleulRow[]) || []);
      } else {
        setFilleuls([]);
      }

      if (p?.date_generation_code) {
        const { count } = await supabase
          .from('annonces')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('statut', ['active', 'vendu'])
          .gte('date_creation', p.date_generation_code);
        setAnnoncesValides(count || 0);
      } else {
        setAnnoncesValides(0);
      }
    } catch (err) {
      console.error('[Parrainage] Erreur de chargement:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Renseigne Orange Money et génère le code (une seule fois, côté serveur). */
  const genererCode = useCallback(
    async (omNumero: string, omTitulaire: string): Promise<{ ok: boolean; message?: string; code?: string }> => {
      const { data, error } = await supabase.rpc('generer_code_parrain', {
        p_om_numero: omNumero,
        p_om_titulaire: omTitulaire,
      });
      if (error) return { ok: false, message: error.message };
      if (data?.ok) await load();
      return data;
    },
    [load]
  );

  /** Saisit le code d'un parrain (filleul). Verrouillé à vie côté serveur. */
  const saisirCode = useCallback(
    async (code: string): Promise<{ ok: boolean; message?: string }> => {
      const { data, error } = await supabase.rpc('saisir_code_parrainage', { p_code: code });
      if (error) return { ok: false, message: error.message };
      if (data?.ok) await load();
      return data;
    },
    [load]
  );

  return {
    campagne,
    parrain,
    filleuls,
    monParrainage,
    annoncesValides,
    loading,
    genererCode,
    saisirCode,
    refresh: load,
  };
}
