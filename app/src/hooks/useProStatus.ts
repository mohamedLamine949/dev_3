import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Qui est RÉELLEMENT professionnel, aux yeux du public.
 *
 * `users.type_compte` ne vérifie aucune date : un abonnement expiré depuis
 * trois mois y reste « professionnel » et conserve son badge, sa place dans
 * l'annuaire Découverte Pro et son bonus de recherche. C'est l'écart n° 3 du
 * dossier produit, repris au §11.7 du dossier directeur : « le statut brut du
 * compte ne reste pas l'autorité ».
 *
 * La vue serveur `v_entitlements_publics` tranche, période de grâce comprise.
 * Elle n'expose que le plan public — aucune donnée de quota ni de paiement.
 *
 * Repli : tant que la migration de phase 1 n'est pas appliquée, la vue
 * n'existe pas ; `proIds` vaut alors `null`, ce qui signifie « je ne sais
 * pas, utilise l'ancien critère ». `estPro()` s'en charge.
 */

let cache: { ids: Set<string> | null; expire: number } | null = null;
const DUREE_CACHE_MS = 5 * 60 * 1000;

async function chargerProIds(): Promise<Set<string> | null> {
  if (cache && cache.expire > Date.now()) return cache.ids;
  try {
    const { data, error } = await supabase
      .from('v_entitlements_publics')
      .select('user_id')
      .eq('plan_public', 'pro');

    // Vue absente (migration non appliquée) : on le mémorise pour ne pas
    // rappeler à chaque écran, et on laisse l'appelant retomber sur type_compte.
    const ids = error || !data ? null : new Set(data.map((r: any) => r.user_id as string));
    cache = { ids, expire: Date.now() + DUREE_CACHE_MS };
    return ids;
  } catch {
    cache = { ids: null, expire: Date.now() + DUREE_CACHE_MS };
    return null;
  }
}

/**
 * Le compte est-il professionnel aux yeux du public ?
 * @param proIds ensemble renvoyé par `useProStatus`, ou `null` si indisponible.
 */
export function estPro(user: { id?: string; type_compte?: string | null } | null | undefined,
                       proIds: Set<string> | null): boolean {
  if (!user) return false;
  // Le serveur a répondu : lui seul fait foi.
  if (proIds) return !!user.id && proIds.has(user.id);
  // Repli : ancien critère, sans vérification de date.
  return user.type_compte === 'professionnel';
}

export function useProStatus(): { proIds: Set<string> | null; loading: boolean } {
  const [proIds, setProIds] = useState<Set<string> | null>(cache?.ids ?? null);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let annule = false;
    chargerProIds().then(ids => {
      if (annule) return;
      setProIds(ids);
      setLoading(false);
    });
    return () => { annule = true; };
  }, []);

  return { proIds, loading };
}
