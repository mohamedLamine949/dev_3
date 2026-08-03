import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/device';

/**
 * Capte l'identifiant d'appareil une fois connecté et le stocke sur users.device_id
 * (anti multi-comptes campagne parrainage). Silencieux : aucun rendu, aucune
 * erreur remontée à l'utilisateur. Monté au niveau racine (voir AppNavigator).
 */
export default function DeviceIdSync() {
  const { session, user } = useAuth();

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let cancelled = false;

    (async () => {
      const id = await getDeviceId();
      if (!id || cancelled) return;
      if (user?.device_id === id) return; // déjà à jour
      await supabase.from('users').update({ device_id: id }).eq('id', uid);
    })();

    return () => { cancelled = true; };
  }, [session?.user?.id, user?.device_id]);

  return null;
}
