/**
 * Gestion des abonnements AUTO-GÉRÉS (PaiementPro, pas de prélèvement récurrent).
 *
 * On ne stocke que la date du dernier paiement (`users.date_abonnement`).
 * L'abonnement est valable 30 jours. Passé ce délai, le "plan effectif"
 * retombe automatiquement sur 'particulier' (gratuit) → le paywall réapparaît,
 * SANS jamais détruire `type_compte` : la data (boutique, badge, identité PRO)
 * reste stockée et un nouveau paiement réactive tout instantanément.
 *
 * NB : quand les fonctionnalités serveur consommeront `type_compte`
 * (carrousel PRO, boost recherche, badge public…), elles devront appliquer
 * la MÊME règle `date_abonnement + 30j` (idéalement via une vue/cron non
 * destructif) pour ne pas laisser un abonnement expiré garder ses avantages.
 */

export const SUBSCRIPTION_DURATION_DAYS = 30;

type SubUser = { type_compte?: string | null; date_abonnement?: string | null } | null | undefined;

const PAID_TYPES = ['vendeur', 'professionnel'];

/** Date d'expiration de l'abonnement en cours (dernier paiement + 30j), ou null. */
export function subscriptionExpiryDate(user: SubUser): Date | null {
  if (!user?.date_abonnement) return null;
  const start = new Date(user.date_abonnement).getTime();
  if (isNaN(start)) return null;
  return new Date(start + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

/** true si l'utilisateur a un abonnement payant encore valable (< 30j). */
export function isSubscriptionActive(user: SubUser): boolean {
  if (!user || !user.type_compte || !PAID_TYPES.includes(user.type_compte)) return false;
  const expiry = subscriptionExpiryDate(user);
  return expiry != null && Date.now() < expiry.getTime();
}

/**
 * Plan réellement appliqué : le type payé s'il est encore valable,
 * sinon retour à 'particulier' (gratuit) = paywall réaffiché.
 */
export function getEffectivePlanKey(user: SubUser): 'particulier' | 'vendeur' | 'professionnel' {
  const raw = (user?.type_compte as 'particulier' | 'vendeur' | 'professionnel') || 'particulier';
  if (!PAID_TYPES.includes(raw)) return 'particulier';
  return isSubscriptionActive(user) ? raw : 'particulier';
}

/** true si l'utilisateur a DÉJÀ été abonné mais que son abonnement a expiré. */
export function isSubscriptionExpired(user: SubUser): boolean {
  if (!user || !user.type_compte || !PAID_TYPES.includes(user.type_compte)) return false;
  return !isSubscriptionActive(user);
}
