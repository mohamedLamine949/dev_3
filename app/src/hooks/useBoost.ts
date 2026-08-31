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
