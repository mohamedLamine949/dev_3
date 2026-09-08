import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Lit la config d'application distante (table public.app_config).
 * Permet de basculer paiement <-> gratuit sans rebuild ni soumission.
 *
 * DEUX interrupteurs indépendants, pas un seul :
 *  - `paymentsEnabled`      → les offres d'ACCÈS (Pro / Service / Vendeur).
 *  - `boostPaymentsEnabled` → le BOOST d'une annonce.
 * Au 2026-09-02 : accès gratuits (offre de lancement), boost payant. Les
 * confondre revenait à offrir la mise en avant à tout le monde dès qu'on
 * ouvrait la porte aux comptes gratuits — une place en tête de fil que tout
 * le monde peut avoir ne vaut plus rien.
 *
 * Fallback = paiement ACTIVÉ pour les deux : si la config n'a pas pu être lue
 * (réseau, table absente, colonne pas encore migrée…), on ne donne pas la
 * publication ni le boost gratuitement par erreur. C'est aussi pourquoi on
 * lit la ligne entière (`*`) : une colonne manquante rendrait la requête
 * entière invalide, et la config lisible passerait pour illisible.
 *
 * `versionMinimale` obéit à la logique INVERSE : son fallback est « aucun
 * blocage ». Une config illisible ne doit jamais enfermer quelqu'un derrière un
 * écran de mise à jour dont il ne peut pas sortir.
 */
export function useAppConfig() {
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [boostPaymentsEnabled, setBoostPaymentsEnabled] = useState(true);
  const [versionMinimale, setVersionMinimale] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('app_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data && typeof data.payments_enabled === 'boolean') {
          setPaymentsEnabled(data.payments_enabled);
        }
        if (data && typeof data.boost_payments_enabled === 'boolean') {
          setBoostPaymentsEnabled(data.boost_payments_enabled);
        }
        if (data && typeof data.version_minimale === 'string' && data.version_minimale.trim()) {
          setVersionMinimale(data.version_minimale.trim());
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { paymentsEnabled, boostPaymentsEnabled, versionMinimale, loading };
}
