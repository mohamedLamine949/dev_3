import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Lit la config d'application distante (table public.app_config).
 * Permet de basculer paiement <-> gratuit sans rebuild ni soumission.
 *
 * Fallback = paiement ACTIVÉ : si la config n'a pas pu être lue (réseau,
 * table absente…), on ne donne pas la publication gratuite par erreur.
 */
export function useAppConfig() {
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('app_config')
      .select('payments_enabled')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data && typeof data.payments_enabled === 'boolean') {
          setPaymentsEnabled(data.payments_enabled);
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { paymentsEnabled, loading };
}
