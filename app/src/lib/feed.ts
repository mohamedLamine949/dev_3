/**
 * Règles de composition du fil d'accueil (§7.1, §9.9).
 *
 * « Ne jamais afficher plus de deux annonces du même vendeur dans les vingt
 * premières cartes. » Sans cette règle, un vendeur qui publie dix articles
 * d'affilée occupe tout le premier écran : l'acheteur croit que l'application
 * est vide de variété et repart, et les autres vendeurs ne sont jamais vus.
 *
 * La règle ne SUPPRIME rien — elle repousse. Une annonce écartée du haut du
 * fil réapparaît plus bas, à la suite. Personne ne perd sa visibilité, elle
 * est seulement étalée.
 */

const MAX_PAR_VENDEUR = 2;
const FENETRE = 20;

export function diversifierParVendeur<T extends { user_id?: string }>(
  annonces: T[],
  maxParVendeur: number = MAX_PAR_VENDEUR,
  fenetre: number = FENETRE
): T[] {
  if (annonces.length <= maxParVendeur) return annonces;

  const tete: T[] = [];
  const repoussees: T[] = [];
  const compte: Record<string, number> = {};

  for (const a of annonces) {
    if (tete.length >= fenetre) {
      // Au-delà de la fenêtre, on ne réordonne plus : le tri d'origine
      // (fraîcheur ou pertinence) reprend la main.
      repoussees.push(a);
      continue;
    }
    const vendeur = a.user_id || '';
    const dejaVu = compte[vendeur] || 0;
    if (vendeur && dejaVu >= maxParVendeur) {
      repoussees.push(a);
    } else {
      compte[vendeur] = dejaVu + 1;
      tete.push(a);
    }
  }

  return [...tete, ...repoussees];
}
