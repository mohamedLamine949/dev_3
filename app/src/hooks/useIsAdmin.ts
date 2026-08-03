import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Détermine si l'utilisateur courant est admin en appelant la fonction
 * SECURITY DEFINER `is_admin()` (basée sur la table admin_users côté serveur).
 * Purement pour l'UX (afficher/masquer l'entrée admin) : la vraie sécurité
 * reste en base (RLS + is_admin() dans chaque RPC).
 */
export function useIsAdmin(userId?: string) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!mounted) return;
      setIsAdmin(!error && data === true);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [userId]);

  return { isAdmin, loading };
}
