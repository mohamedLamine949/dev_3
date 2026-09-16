import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Parrainage ouvert (voir supabase/migration_invitations.sql).
 *
 * Toute la logique — attribution du boost, comptage du concours, détection
 * des appareils partagés — vit en base, dans des fonctions SECURITY DEFINER.
 * Ce hook ne fait que lire et appeler : il ne décide rien, et un client
 * modifié ne pourrait pas s'attribuer un crédit.
 */

export interface StatsInvitation {
  code: string;
  filleulsValides: number;
  filleulsEnAttente: number;
  boostsDisponibles: number;
  concoursRequis: number;
  concoursParticipe: boolean;
  concoursManque: number;
}

/** Vrai tant que la migration n'est pas appliquée : on masque alors le programme. */
function fonctionAbsente(error: any): boolean {
  const code = error?.code || '';
  return code === '42883' || code === 'PGRST202' ||
    /Could not find the function/i.test(String(error?.message || ''));
}

export function useInvitations(userId?: string) {
  const [stats, setStats] = useState<StatsInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [indisponible, setIndisponible] = useState(false);

  const charger = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('mes_stats_invitation');

    if (error) {
      // Migration pas encore passée : le programme n'existe pas encore, on
      // n'affiche rien plutôt qu'une erreur incompréhensible.
      if (fonctionAbsente(error)) setIndisponible(true);
      else console.warn('Stats parrainage:', error.message);
      setStats(null);
      setLoading(false);
      return;
    }

    const d = data as any;
    setStats({
      code: d.code,
      filleulsValides: d.filleuls_valides ?? 0,
      filleulsEnAttente: d.filleuls_en_attente ?? 0,
      boostsDisponibles: d.boosts_disponibles ?? 0,
      concoursRequis: d.concours_requis ?? 5,
      concoursParticipe: !!d.concours_participe,
      concoursManque: d.concours_manque ?? 5,
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => { charger(); }, [charger]);

  return { stats, loading, indisponible, refetch: charger };
}

/** Rattache le compte courant à un parrain. Renvoie un message à afficher. */
export async function saisirCodeInvitation(code: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc('saisir_code_invitation', { p_code: code });
  if (error) {
    return { ok: false, message: fonctionAbsente(error) ? "Le programme n'est pas encore actif." : error.message };
  }
  const d = data as any;
  return { ok: !!d?.ok, message: d?.ok ? d.message : (d?.erreur || 'Code refuse') };
}

/** Consomme un boost gagné. La base vérifie la propriété de l'annonce. */
export async function utiliserBoostGratuit(annonceId: string): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('utiliser_credit_boost', { p_annonce_id: annonceId });
  if (error) return { ok: false, message: error.message };
  const d = data as any;
  return { ok: !!d?.ok, message: d?.erreur };
}
