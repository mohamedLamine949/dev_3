import { getSousCategorieSearchText, getCategorieLabel } from '../constants/theme';

/**
 * Moteur de recherche par mots-clés — annonces et profils.
 *
 * Principe : ce que l'utilisateur tape décrit un PRODUIT, pas un rayon.
 * Une annonce n'est retenue que si les mots de la requête se retrouvent
 * dans son TITRE ou sa DESCRIPTION. La catégorie, la sous-catégorie et la
 * ville ne peuvent JAMAIS à elles seules faire entrer une annonce dans les
 * résultats : elles ne servent qu'à départager deux annonces qui matchent
 * déjà sur le texte.
 *
 * (Avant, les mots-clés de sous-catégorie — « iphone », « samsung »,
 * « playstation »… — suffisaient à passer le filtre : chercher « iPhone 17 »
 * remontait tout le rayon téléphonie.)
 *
 * Le score encode un NIVEAU de correspondance, pour ne jamais mélanger du
 * bon et de l'approximatif :
 *
 *   TIER_EXACT   (>= 1000) : tous les mots trouvés dans le titre/description
 *   TIER_PARTIAL (>=  500) : une partie des mots seulement
 *   TIER_WEAK    (>    0)  : rien dans le texte, juste la catégorie/la ville
 *
 * `filterByRelevance()` ne garde que le meilleur niveau disponible : on
 * n'affiche de l'approximatif que s'il n'y a rien de mieux.
 */

export const TIER_EXACT = 1000;
export const TIER_PARTIAL = 500;
export const TIER_WEAK = 0;

// Mots vides : jamais exigés pour retenir une annonce.
const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'au',
  'aux', 'en', 'pour', 'avec', 'sur', 'dans', 'par', 'chez', 'mon', 'ma',
  'mes', 'ce', 'cet', 'cette', 'est', 'sont', 'vends', 'vend', 'vendre',
  'cherche', 'achete', 'acheter',
]);

/** Minuscules, sans accents, ponctuation remplacée par des espaces. */
export function normalize(s: any): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Forme collée : « play station 3 » → « playstation3 ». */
function squash(s: any): string {
  return normalize(s).replace(/ /g, '');
}

/** Distance de Levenshtein bornée : renvoie max+1 dès qu'on dépasse. */
function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Abréviations courantes → écriture complète. Volontairement limité à des
 * équivalences 1 pour 1 sur un PRODUIT précis. On n'y met jamais de marques
 * ni de familles de produits : « iphone » ne doit pas ramener « samsung ».
 */
const ALIASES: Record<string, string[]> = {
  ps: ['playstation'],
  ps2: ['playstation2', 'playstation'],
  ps3: ['playstation3', 'playstation'],
  ps4: ['playstation4', 'playstation'],
  ps5: ['playstation5', 'playstation'],
  pc: ['ordinateur', 'laptop'],
  ordi: ['ordinateur'],
  tel: ['telephone'],
  tv: ['television'],
  clim: ['climatiseur'],
  frigo: ['refrigerateur'],
  velo: ['bicyclette'],
};

/** Tolérance aux fautes de frappe, proportionnelle à la longueur du mot. */
function typoBudget(word: string): number {
  if (word.length >= 8) return 2;
  if (word.length >= 5) return 1;
  return 0;
}

interface Haystack {
  titleTokens: string[];
  titleNorm: string;
  titleSquashed: string;
  descTokens: string[];
  descNorm: string;
  weakText: string;
}

/**
 * Score d'un mot sur le TEXTE (titre + description).
 * 0 = le mot n'est pas dans le texte → l'annonce ne peut pas être « exacte ».
 */
function strongWordScore(word: string, h: Haystack, allowAlias = true): number {
  // Titre — mot entier
  if (h.titleTokens.includes(word)) return 40;

  // Titre — début de mot (« sams » → « samsung »)
  if (word.length >= 3 && h.titleTokens.some(t => t.startsWith(word))) return 30;

  // Titre — écriture collée ou séparée (« playstation » ↔ « play station »)
  if (word.length >= 4 && h.titleSquashed.includes(word)) return 28;

  // Titre — faute de frappe
  const budget = typoBudget(word);
  if (budget > 0 && h.titleTokens.some(t => levenshtein(word, t, budget) <= budget)) return 18;

  // Description — mot entier, puis fragment, puis faute de frappe
  if (h.descTokens.includes(word)) return 10;
  if (word.length >= 4 && h.descNorm.includes(word)) return 6;
  if (budget > 0 && h.descTokens.some(t => levenshtein(word, t, budget) <= budget)) return 4;

  // Abréviation : « ps3 » → « play station 3 ». Score minoré, et sans
  // récursion (une abréviation ne se ré-étend pas).
  if (allowAlias && ALIASES[word]) {
    // Les alias sont classés du plus précis au plus générique : « ps3 » doit
    // préférer « play station 3 » à n'importe quelle PlayStation.
    let best = 0;
    ALIASES[word].forEach((alias, i) => {
      const factor = i === 0 ? 0.7 : 0.5;
      best = Math.max(best, strongWordScore(alias, h, false) * factor);
    });
    if (best > 0) return Math.round(best);
  }

  return 0;
}

/** Score « faible » : catégorie, sous-catégorie, ville. Jamais décisif. */
function weakWordScore(word: string, h: Haystack): number {
  if (word.length < 3) return 0;
  return h.weakText.includes(word) ? 3 : 0;
}

function queryWords(queryNorm: string): string[] {
  const all = queryNorm.split(' ');
  const required = all.filter(w => !STOPWORDS.has(w));
  // Si la requête n'est faite que de mots vides (« la maison »), on les garde.
  return required.length > 0 ? required : all;
}

export function scoreAnnonce(query: string, item: any): number {
  const queryNorm = normalize(query);
  if (!queryNorm) return 0;
  const words = queryWords(queryNorm);

  const titleNorm = normalize(item.titre);
  const descNorm = normalize(item.description);
  const h: Haystack = {
    titleTokens: titleNorm ? titleNorm.split(' ') : [],
    titleNorm,
    titleSquashed: titleNorm.replace(/ /g, ''),
    descTokens: descNorm ? descNorm.split(' ') : [],
    descNorm,
    weakText: normalize(
      [
        getCategorieLabel(item.categorie) || item.categorie,
        getSousCategorieSearchText(item.sous_categorie),
        item.ville,
        item.quartier,
      ]
        .filter(Boolean)
        .join(' ')
    ),
  };

  let textScore = 0;
  let weakScore = 0;
  let matchedInText = 0;

  for (const word of words) {
    const strong = strongWordScore(word, h);
    if (strong > 0) {
      textScore += strong;
      matchedInText++;
    } else {
      weakScore += weakWordScore(word, h);
    }
  }

  // Bonus de phrase : la requête complète, telle quelle, dans le titre.
  if (matchedInText > 0) {
    if (titleNorm === queryNorm) textScore += 80;
    else if (titleNorm.startsWith(queryNorm)) textScore += 50;
    else if (titleNorm.includes(queryNorm)) textScore += 35;
    else if (h.titleSquashed.includes(squash(query))) textScore += 25;
  }

  // Tous les mots sont dans le texte → résultat exact. La catégorie n'ajoute
  // qu'un filet de départage plafonné.
  if (matchedInText === words.length) {
    return TIER_EXACT + textScore + Math.min(weakScore, 6);
  }

  // Une partie des mots seulement.
  if (matchedInText > 0) {
    return TIER_PARTIAL + textScore * (matchedInText / words.length);
  }

  // Rien dans le texte : catégorie/ville seules. Dernier recours.
  return weakScore > 0 ? weakScore : 0;
}

/**
 * Ne conserve que le meilleur niveau de correspondance présent dans la liste,
 * puis trie par score décroissant. C'est ici qu'on empêche « iPhone 17 » de
 * ramener tout le rayon téléphonie : dès qu'une annonce exacte existe, les
 * résultats de catégorie disparaissent.
 */
export function filterByRelevance<T extends { searchScore?: number }>(items: T[]): T[] {
  const scored = items.filter(i => (i.searchScore || 0) > 0);
  if (scored.length === 0) return [];
  let best = 0;
  for (const i of scored) best = Math.max(best, i.searchScore || 0);
  const floor = best >= TIER_EXACT ? TIER_EXACT : best >= TIER_PARTIAL ? TIER_PARTIAL : 0.0001;
  return scored
    .filter(i => (i.searchScore || 0) >= floor)
    .sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
}

/** Niveau des résultats, pour prévenir l'utilisateur quand c'est approximatif. */
export function relevanceTier(
  items: { searchScore?: number }[]
): 'exact' | 'partial' | 'weak' | 'none' {
  if (items.length === 0) return 'none';
  let best = 0;
  for (const i of items) best = Math.max(best, i.searchScore || 0);
  if (best >= TIER_EXACT) return 'exact';
  if (best >= TIER_PARTIAL) return 'partial';
  return best > 0 ? 'weak' : 'none';
}

/**
 * Score d'un profil vendeur / boutique. Même logique : le nom de la boutique
 * et le nom de la personne forment le texte fort, la bio est secondaire.
 */
export function scoreUser(query: string, user: any): number {
  const queryNorm = normalize(query);
  if (!queryNorm) return 0;
  const words = queryWords(queryNorm);

  const nameNorm = normalize(`${user.nom_boutique || ''} ${user.prenom || ''} ${user.nom || ''}`);
  const bioNorm = normalize(user.bio);
  const h: Haystack = {
    titleTokens: nameNorm ? nameNorm.split(' ') : [],
    titleNorm: nameNorm,
    titleSquashed: nameNorm.replace(/ /g, ''),
    descTokens: bioNorm ? bioNorm.split(' ') : [],
    descNorm: bioNorm,
    weakText: '',
  };

  let textScore = 0;
  let matched = 0;
  for (const word of words) {
    const s = strongWordScore(word, h);
    if (s > 0) {
      textScore += s;
      matched++;
    }
  }

  if (matched === 0) return 0;

  if (nameNorm === queryNorm) textScore += 80;
  else if (nameNorm.startsWith(queryNorm)) textScore += 40;
  else if (nameNorm.includes(queryNorm)) textScore += 25;

  if (matched === words.length) return TIER_EXACT + textScore;
  return TIER_PARTIAL + textScore * (matched / words.length);
}
