/**
 * Statut des offres payantes — PAIEMENT UNIQUE (décision produit du
 * 2026-08-20, confirmée le 2026-08-31 : « rien n'expire »).
 *
 * Un paiement (PaiementPro) passe `type_compte` à 'vendeur' ou
 * 'professionnel' et pose `date_abonnement`. Il n'y a plus de fenêtre de
 * 30 jours à surveiller ni de renouvellement à proposer : l'accès reste
 * actif tant que `type_compte` n'est pas retiré manuellement (ex. retour
 * volontaire à un compte particulier).
 *
 * Le serveur (RPC `mes_droits`, migration_paiement_unique.sql) applique la
 * même règle — ce module ne fait que refléter ce que le serveur décide déjà,
 * il ne recalcule aucune expiration de son côté.
 */

type SubUser = { type_compte?: string | null; date_abonnement?: string | null } | null | undefined;

const PAID_TYPES = ['vendeur', 'professionnel'];

/** Paiement unique : plus de date d'expiration à afficher. */
export function subscriptionExpiryDate(user: SubUser): Date | null {
  return null;
}

/** true si l'utilisateur a payé une offre (vendeur ou pro) — accès à vie. */
export function isSubscriptionActive(user: SubUser): boolean {
  if (!user || !user.type_compte || !PAID_TYPES.includes(user.type_compte)) return false;
  return true;
}

/** Plan réellement appliqué : le type payé (accès à vie), sinon 'particulier'. */
export function getEffectivePlanKey(user: SubUser): 'particulier' | 'vendeur' | 'professionnel' {
  const raw = (user?.type_compte as 'particulier' | 'vendeur' | 'professionnel') || 'particulier';
  return PAID_TYPES.includes(raw) ? raw : 'particulier';
}

/** Paiement unique : un compte payant n'expire jamais, donc jamais "expiré". */
export function isSubscriptionExpired(user: SubUser): boolean {
  return false;
}
