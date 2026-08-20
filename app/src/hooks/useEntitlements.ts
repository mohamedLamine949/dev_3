import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { getEffectivePlanKey, subscriptionExpiryDate } from '../lib/subscription';
import { PLANS_CONFIG } from '../constants/theme';

/**
 * Droits effectifs de l'utilisateur — lus SUR LE SERVEUR.
 *
 * Principe non négociable du dossier directeur (§11.3) : le serveur est
 * l'autorité sur les quotas, abonnements et blocages ; le client ne fait
 * qu'afficher la décision. Un paywall implémenté uniquement dans l'interface
 * se contourne avec une ancienne version de l'application.
 *
 * Repli : tant que `migration_p1_entitlements.sql` n'est pas appliquée, la RPC
 * `mes_droits` n'existe pas. On retombe alors exactement sur le calcul local
 * actuel — même comportement qu'aujourd'hui, aucune régression. Le repli est
 * signalé par `source: 'local'` pour qu'on puisse le voir en débogage.
 */

export type MonetizationMode =
  | 'FREE_LAUNCH'
  | 'SHADOW'
  | 'SOFT_PAYWALL'
  | 'LIVE'
  | 'PAUSED';

export interface Entitlements {
  monetizationMode: MonetizationMode;
  planCode: 'gratuit' | 'vendeur' | 'pro';
  planStatut: string;
  validUntil: Date | null;
  enGrace: boolean;
  /** true en SOFT_PAYWALL et LIVE : l'offre et le décompte de crédits s'affichent. */
  paywallVisible: boolean;
  /** true en LIVE seulement : la publication est réellement refusée hors quota. */
  blocageActif: boolean;
  /** null = illimité (plan Pro). */
  creditsMensuels: number | null;
  creditsUtilises: number;
  creditsRestants: number | null;
  peutPublier: boolean;
  peutAvoirBoutique: boolean;
  peutVoirStats: boolean;
  creditsBoost: number;
  badgePublic: 'aucun' | 'pro';
  prochaineRemiseAZero: Date | null;
  source: 'serveur' | 'local';
}

/** Correspondance entre l'ancien `type_compte` et les codes de plan. */
const PLAN_DEPUIS_TYPE: Record<string, 'gratuit' | 'vendeur' | 'pro'> = {
  particulier: 'gratuit',
  vendeur: 'vendeur',
  professionnel: 'pro',
};

/** Repli local : reproduit à l'identique le comportement d'avant la phase 1. */
function calculLocal(user: any, monthlyCount: number, paymentsEnabled: boolean): Entitlements {
  const planKey = getEffectivePlanKey(user);
  const plan = PLANS_CONFIG[planKey as keyof typeof PLANS_CONFIG] || PLANS_CONFIG.particulier;
  const quota = plan.quotaMensuel === Infinity ? null : plan.quotaMensuel;
  const expiry = subscriptionExpiryDate(user);
  const debutMoisProchain = new Date();
  debutMoisProchain.setMonth(debutMoisProchain.getMonth() + 1, 1);
  debutMoisProchain.setHours(0, 0, 0, 0);

  return {
    monetizationMode: paymentsEnabled ? 'LIVE' : 'FREE_LAUNCH',
    planCode: PLAN_DEPUIS_TYPE[planKey] || 'gratuit',
    planStatut: planKey === 'particulier' ? 'aucun' : 'actif',
    validUntil: expiry,
    enGrace: false,
    paywallVisible: paymentsEnabled,
    blocageActif: paymentsEnabled,
    creditsMensuels: quota,
    creditsUtilises: monthlyCount,
    creditsRestants: quota === null ? null : Math.max(quota - monthlyCount, 0),
    peutPublier: !paymentsEnabled || quota === null || monthlyCount < quota,
    peutAvoirBoutique: planKey === 'professionnel',
    peutVoirStats: planKey !== 'particulier',
    creditsBoost: 0,
    badgePublic: planKey === 'professionnel' ? 'pro' : 'aucun',
    prochaineRemiseAZero: debutMoisProchain,
    source: 'local',
  };
}

function depuisServeur(d: any): Entitlements {
  return {
    monetizationMode: d.monetization_mode,
    planCode: d.plan_code,
    planStatut: d.plan_statut,
    validUntil: d.valid_until ? new Date(d.valid_until) : null,
    enGrace: !!d.en_grace,
    paywallVisible: !!d.paywall_visible,
    blocageActif: !!d.blocage_actif,
    creditsMensuels: d.credits_mensuels ?? null,
    creditsUtilises: d.credits_utilises ?? 0,
    creditsRestants: d.credits_restants ?? null,
    peutPublier: d.peut_publier !== false,
    peutAvoirBoutique: !!d.peut_avoir_boutique,
    peutVoirStats: !!d.peut_voir_stats,
    creditsBoost: d.credits_boost ?? 0,
    badgePublic: d.badge_public === 'pro' ? 'pro' : 'aucun',
    prochaineRemiseAZero: d.prochaine_remise_a_zero ? new Date(d.prochaine_remise_a_zero) : null,
    source: 'serveur',
  };
}

export function useEntitlements(
  user: any,
  monthlyCount: number,
  paymentsEnabled: boolean
): { entitlements: Entitlements; loading: boolean; refresh: () => Promise<void> } {
  const [serveur, setServeur] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  // Une fois la RPC connue absente, inutile de la rappeler à chaque écran.
  const rpcIndisponible = useRef(false);

  const refresh = useCallback(async () => {
    if (!user?.id || rpcIndisponible.current) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('mes_droits');
      if (error || !data) {
        // 404/42883 = la migration n'est pas encore appliquée : repli silencieux.
        rpcIndisponible.current = true;
        setServeur(null);
      } else {
        setServeur(depuisServeur(data));
      }
    } catch {
      rpcIndisponible.current = true;
      setServeur(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Le mode de monétisation peut changer à distance pendant que l'app est
  // ouverte : on relit les droits au retour au premier plan (§11.2).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Le compteur du mois vient du serveur quand il répond ; sinon du comptage
  // local déjà fait par l'écran de publication.
  const entitlements = serveur ?? calculLocal(user, monthlyCount, paymentsEnabled);

  return { entitlements, loading, refresh };
}
