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

/**
 * Personnalisation légère du fil à partir des dernières annonces VUES
 * (recentStorage.ts, côté appareil — aucun appel Supabase, aucun coût de
 * quota). Les catégories les plus consultées remontent légèrement dans le
 * fil : c'est un tri stable (à poids égal, l'ordre d'origine — fraîcheur ou
 * pertinence — est conservé), jamais un filtre.
 *
 * Une annonce boostée (payante) n'est jamais repoussée par ce tri : elle
 * est retirée avant, puis remise en tête telle quelle.
 */
export function personnaliserParCategorie<T extends { categorie?: string; boost_expire_le?: string | null }>(
  annonces: T[],
  vues: { categorie?: string }[],
  fenetre: number = FENETRE
): T[] {
  if (annonces.length === 0 || vues.length === 0) return annonces;

  // Poids par catégorie : les vues les plus récentes comptent davantage.
  const poids: Record<string, number> = {};
  vues.forEach((v, i) => {
    if (!v.categorie) return;
    poids[v.categorie] = (poids[v.categorie] || 0) + (vues.length - i);
  });
  if (Object.keys(poids).length === 0) return annonces;

  const estBoostee = (a: T) =>
    !!a.boost_expire_le && new Date(a.boost_expire_le).getTime() > Date.now();
  const boostees = annonces.filter(estBoostee);
  const reste = annonces.filter(a => !estBoostee(a));

  const tete = reste.slice(0, fenetre);
  const suite = reste.slice(fenetre);

  const teteTriee = tete
    .map((a, i) => ({ a, i, score: (a.categorie && poids[a.categorie]) || 0 }))
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .map(x => x.a);

  return [...boostees, ...teteTriee, ...suite];
}
