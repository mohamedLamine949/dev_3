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
 * Composition du fil d'accueil à partir de l'INDEX complet des annonces
 * (id, vendeur, catégorie, boost, date — pas les images, voir useAnnonces).
 *
 * Pourquoi l'index entier plutôt que la page affichée : `diversifierParVendeur`
 * ne répartit que ce qui est déjà chargé. Or les vingt premières annonces
 * arrivent triées par date, et une vendeuse qui a publié 85 annonces d'affilée
 * les occupe TOUTES — il n'y a rien à répartir, la page ne contient qu'elle.
 * Sur 248 annonces actives, une seule personne en représente 34 % et les trois
 * premiers vendeurs 47 % : l'acheteur qui ouvre l'application fait défiler le
 * catalogue d'une seule boutique et croit que c'est là toute l'offre. Celui
 * qui vend son ancien téléphone n'est jamais vu.
 *
 * La composition se fait donc sur l'index, AVANT le découpage en pages :
 *
 *   1. les annonces sont groupées par vendeur, chacune de ces piles triée
 *      (boost actif d'abord, puis la plus récente) ;
 *   2. les vendeurs sont classés pour le premier tour : celui qui a payé un
 *      boost passe devant, puis celui dont la catégorie a déjà été consultée,
 *      puis le plus récent ;
 *   3. on sert une annonce par vendeur, à tour de rôle, jusqu'à épuisement.
 *
 * Résultat : la première page montre autant de vendeurs différents qu'il y a
 * de cartes, et deux annonces consécutives ne viennent jamais du même vendeur
 * tant qu'il reste quelqu'un d'autre à servir. Personne ne perd sa visibilité
 * — les 85 annonces restent toutes dans le fil, réparties au lieu d'être
 * empilées.
 */
export interface LigneIndex {
  id: string;
  user_id?: string | null;
  categorie?: string | null;
  boost_expire_le?: string | null;
  date_creation?: string | null;
}

export function composerFil(
  lignes: LigneIndex[],
  options?: { categoriesPreferees?: string[] }
): string[] {
  if (lignes.length === 0) return [];

  const maintenant = Date.now();
  const estBoostee = (l: LigneIndex) =>
    !!l.boost_expire_le && new Date(l.boost_expire_le).getTime() > maintenant;
  const quand = (l: LigneIndex) => (l.date_creation ? new Date(l.date_creation).getTime() : 0);

  // Poids des catégories déjà consultées : les plus récemment vues comptent
  // le plus. Ce poids ne sert QU'À classer les vendeurs entre eux — il ne
  // peut donc jamais casser l'alternance, contrairement à un tri appliqué
  // après coup sur les vingt premières cartes.
  const preferees = options?.categoriesPreferees || [];
  const poidsCategorie: Record<string, number> = {};
  preferees.forEach((c, i) => {
    if (c) poidsCategorie[c] = Math.max(poidsCategorie[c] || 0, preferees.length - i);
  });

  const piles = new Map<string, LigneIndex[]>();
  lignes.forEach((l, i) => {
    // Une annonce sans vendeur (cas limite) forme sa propre pile : elle ne
    // doit se regrouper avec aucune autre.
    const vendeur = l.user_id || `__sans_vendeur_${i}`;
    const pile = piles.get(vendeur) || [];
    pile.push(l);
    piles.set(vendeur, pile);
  });

  piles.forEach(pile => {
    pile.sort((a, b) => {
      const boost = Number(estBoostee(b)) - Number(estBoostee(a));
      return boost !== 0 ? boost : quand(b) - quand(a);
    });
  });

  const ordreVendeurs = [...piles.entries()]
    .map(([vendeur, pile]) => ({
      vendeur,
      boostee: estBoostee(pile[0]),
      interet: poidsCategorie[pile[0].categorie || ''] || 0,
      date: quand(pile[0]),
    }))
    .sort((a, b) =>
      Number(b.boostee) - Number(a.boostee) ||
      b.interet - a.interet ||
      b.date - a.date
    )
    .map(v => v.vendeur);

  const ordre: string[] = [];
  let restant = lignes.length;
  while (restant > 0) {
    for (const vendeur of ordreVendeurs) {
      const pile = piles.get(vendeur)!;
      if (pile.length === 0) continue;
      ordre.push(pile.shift()!.id);
      restant--;
    }
  }
  return ordre;
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
