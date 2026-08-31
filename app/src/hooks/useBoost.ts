import { useCallback, useEffect, useState } from 'react';
import { supabase, Annonce } from '../lib/supabase';

/** Prix et durée du boost — un seul endroit à changer si ça évolue. */
export const BOOST_PRIX = 250;
export const BOOST_DURATION_HOURS = 48;

export function isBoostActif(annonce: Pick<Annonce, 'boost_expire_le'>): boolean {
  if (!annonce.boost_expire_le) return false;
  return new Date(annonce.boost_expire_le).getTime() > Date.now();
}

/** Une annonce déjà boostée au moins une fois a de quoi remplir l'écran de
 * résultats, même si le boost en cours est terminé (historique). */
export function aDejaEteBoostee(annonce: Pick<Annonce, 'boost_paye_le'>): boolean {
  return !!annonce.boost_paye_le;
}

/**
 * Active le boost sur une annonce : capture le nombre de vues actuel (pour
 * mesurer le gain plus tard) puis pose la date d'expiration. Appelé depuis
 * le `onSuccess` du paiement — si ça throw, PaiementProModal affiche
 * l'erreur et l'utilisateur n'a pas payé pour rien sans le savoir.
 */
export async function activerBoost(annonce: Annonce): Promise<void> {
  const expireLe = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000);
  const { error } = await supabase
    .from('annonces')
    .update({
      boost_expire_le: expireLe.toISOString(),
      boost_paye_le: new Date().toISOString(),
      boost_vues_avant: annonce.nombre_vues || 0,
      boost_prix: BOOST_PRIX,
    })
    .eq('id', annonce.id);
  if (error) throw error;
}

/** Relit l'annonce (vues + champs de boost à jour) pour l'écran de résultats. */
export function useBoostStats(annonceId: string | undefined) {
  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!annonceId) return;
    setLoading(true);
    const { data } = await supabase
      .from('annonces')
      .select('id, titre, prix, nombre_vues, boost_expire_le, boost_paye_le, boost_vues_avant, boost_prix')
      .eq('id', annonceId)
      .maybeSingle();
    setAnnonce((data as Annonce) || null);
    setLoading(false);
  }, [annonceId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { annonce, loading, refetch };
}

export interface BoostContactStats {
  depuisTotal: number;
  depuisWhatsapp: number;
  depuisAppels: number;
  depuisMessages: number;
  depuisDemandes: number; // commande + devis
  avantTotal: number;
}

/**
 * Détail des mises en relation (contact_events, migration_p2c_contacts) sur
 * UNE annonce, découpé avant / depuis le boost — au-delà des simples vues,
 * c'est ce qui répond vraiment à « est-ce que ça valait le coup de
 * booster ». RLS déjà en place : le vendeur lit ses propres contacts, pas
 * besoin de nouvelle policy.
 */
export function useBoostContactStats(annonceId: string | undefined, boostPayeLe: string | null | undefined) {
  const [stats, setStats] = useState<BoostContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [indisponible, setIndisponible] = useState(false);

  const refetch = useCallback(async () => {
    if (!annonceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_events')
      .select('type, date_creation')
      .eq('annonce_id', annonceId);

    // Migration pas encore appliquée (ou tout autre souci) : on ne casse pas
    // l'écran, on masque juste ce bloc — comme le fait déjà MaBoutiqueScreen.
    if (error) {
      setIndisponible(true);
      setStats(null);
      setLoading(false);
      return;
    }

    const rows = (data || []) as { type: string; date_creation: string }[];
    const cutoff = boostPayeLe ? new Date(boostPayeLe).getTime() : 0;
    const depuis = rows.filter(r => new Date(r.date_creation).getTime() >= cutoff);
    const avant = rows.filter(r => new Date(r.date_creation).getTime() < cutoff);
    const compte = (list: typeof rows, t: string) => list.filter(r => r.type === t).length;

    setStats({
      depuisTotal: depuis.length,
      depuisWhatsapp: compte(depuis, 'whatsapp'),
      depuisAppels: compte(depuis, 'appel'),
      depuisMessages: compte(depuis, 'message'),
      depuisDemandes: compte(depuis, 'commande') + compte(depuis, 'devis'),
      avantTotal: avant.length,
    });
    setIndisponible(false);
    setLoading(false);
  }, [annonceId, boostPayeLe]);

  useEffect(() => { refetch(); }, [refetch]);

  return { stats, loading, indisponible, refetch };
}
