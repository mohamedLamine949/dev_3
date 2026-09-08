/**
 * Règles de composition du fil d'accueil (§7.1, §9.9).
 *
 * Un vendeur qui publie dix articles d'affilée ne doit jamais occuper tout le
 * premier écran : l'acheteur croit que l'application est vide de variété et
 * repart, et les autres vendeurs ne sont jamais vus.
 *
 * Entrelacement round-robin plutôt qu'un simple plafond « 2 en tête » : une
 * version précédente capait bien le nombre en tête de fil, mais reléguait le
 * surplus d'un même vendeur EN BLOC juste après, toujours groupé — un
 * vendeur prolifique se retrouvait avec 2 annonces en haut puis un paquet de
 * 8 collées les unes aux autres un peu plus bas. Ici, on prend une annonce
 * de chaque vendeur encore actif, à tour de rôle, dans l'ordre où ils
 * apparaissaient déjà (donc les plus récents/boostés en premier). Dès qu'il
 * y a au moins deux vendeurs avec des annonces en attente, deux annonces
 * consécutives ne peuvent plus jamais venir du même vendeur — nulle part
 * dans le fil, pas seulement dans les vingt premières cartes.
 *
 * La règle ne SUPPRIME rien — elle répartit. Personne ne perd sa visibilité.
 */
export function diversifierParVendeur<T extends { user_id?: string }>(annonces: T[]): T[] {
  if (annonces.length <= 2) return annonces;

  // Groupes par vendeur, ordre interne préservé (fraîcheur/boost déjà
  // appliqués en amont, côté requête). `ordreVendeurs` fixe l'ordre de
  // passage du round-robin sur la première apparition de chaque vendeur.
  const ordreVendeurs: string[] = [];
  const groupes = new Map<string, T[]>();
  annonces.forEach((a, i) => {
    // Une annonce sans user_id (cas limite) ne se regroupe avec aucune
    // autre : elle reste seule dans son propre « groupe ».
    const vendeur = a.user_id || `__sans_vendeur_${i}`;
    if (!groupes.has(vendeur)) {
      groupes.set(vendeur, []);
      ordreVendeurs.push(vendeur);
    }
    groupes.get(vendeur)!.push(a);
  });

  const resultat: T[] = [];
  let restant = annonces.length;
  while (restant > 0) {
    for (const vendeur of ordreVendeurs) {
      const groupe = groupes.get(vendeur)!;
      if (groupe.length === 0) continue;
      resultat.push(groupe.shift()!);
      restant--;
    }
  }
  return resultat;
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
  fenetre: number = 20
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
