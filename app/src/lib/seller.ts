/**
 * Identite affichable d'un vendeur.
 *
 * Les profils sont incomplets en base (comptes crees avant l'ecran de
 * completion) : sans repli explicite l'app affichait « Vendeur » partout,
 * on ne savait plus a qui on parlait.
 */

export type SellerLike = {
  prenom?: string | null;
  nom?: string | null;
  nom_boutique?: string | null;
} | null | undefined;

/** Nom a afficher : nom de boutique (PRO) > prenom + nom > repli. */
export function sellerDisplayName(seller: SellerLike, fallback = 'Vendeur'): string {
  if (!seller) return fallback;
  const boutique = seller.nom_boutique?.trim();
  if (boutique) return boutique;
  const complet = `${seller.prenom || ''} ${seller.nom || ''}`.trim();
  return complet || fallback;
}

/** Initiale pour l'avatar de repli (quand le vendeur n'a pas de photo). */
export function sellerInitial(seller: SellerLike, fallback = 'Vendeur'): string {
  return sellerDisplayName(seller, fallback).charAt(0).toUpperCase();
}
