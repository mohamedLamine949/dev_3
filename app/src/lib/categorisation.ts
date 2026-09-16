/**
 * Détection automatique de la catégorie d'une annonce à partir de son texte.
 *
 * Le problème qu'il résout : à la publication, le vendeur choisit lui-même sa
 * catégorie dans une liste de neuf pastilles. Beaucoup tapent la première
 * venue — on retrouve des montres et des cuisinières dans « Téléphonie ».
 * Tant que le rangement est faux, aucun rayon d'accueil ne peut être propre :
 * un rayon « Téléphonie » rempli de cuisinières est PIRE qu'un fil mélangé,
 * parce qu'il promet un rangement qu'il ne tient pas.
 *
 * Deux usages, un seul détecteur :
 *   - à la publication : proposer la catégorie devinée, à confirmer d'un tap ;
 *   - sur l'existant : repérer les annonces mal rangées
 *     (scripts/rapport-categories.js).
 *
 * ── Ce que le détecteur ne fait PAS ──────────────────────────────────────
 * Il ne décide jamais seul. Il rend une confiance ; c'est l'appelant qui
 * choisit quoi en faire. Une détection « faible » ne doit jamais rien
 * corriger automatiquement : mieux vaut laisser une annonce mal rangée que
 * déplacer une annonce bien rangée.
 */

import { SUBCATEGORIES } from '../constants/theme';
import { normalize } from './relevance';

export type Confiance = 'forte' | 'moyenne' | 'faible' | 'aucune';

export interface Detection {
  categorie: string | null;
  sousCategorie: string | null;
  confiance: Confiance;
  /** Score de la catégorie gagnante (échelle interne, ~10 par mot du titre). */
  score: number;
  /** Score de la deuxième catégorie : dit si le choix était disputé. */
  scoreSuivant: number;
  /** Les mots qui ont décidé, pour pouvoir expliquer/vérifier une correction. */
  indices: string[];
  /** Au moins un indice vient du titre (et pas seulement de la description). */
  indiceDansTitre: boolean;
}

// ─────────────────────────────────────────────
// Mots trop ambigus pour classer
// ─────────────────────────────────────────────

/**
 * Ces mots existent dans les `keywords` de recherche (où ils sont utiles et
 * sans danger : la recherche ne s'appuie jamais sur eux seuls) mais ils
 * enverraient n'importe quoi n'importe où s'ils classaient une annonce.
 *
 *   « vente », « vendre »  : tout le monde vend quelque chose ;
 *   « or », « argent »     : « or » est un mot de liaison, « argent » un prix ;
 *   « livraison », « boutique », « magasin », « disponible » : formules de
 *     description commerciales, présentes dans une annonce sur deux ;
 *   « salon », « table », « porte », « machine », « bois », « ensemble »,
 *   « chambre », « jeu », « lot », « piece » : mots courants dont le sens
 *     dépend du contexte (« chambre a coucher » = meuble, « chambre a
 *     louer » = immobilier ; voir les expressions plus bas, qui les
 *     rattrapent une fois désambiguïsés).
 */
const MOTS_IGNORES = new Set([
  'or', 'argent', 'lot', 'jeu', 'jeux', 'vente', 'vendre', 'ensemble',
  'salon', 'machine', 'table', 'porte', 'bois', 'local', 'flash', 'chambre',
  'boutique', 'magasin', 'livraison', 'piece', 'pieces', 'neuf', 'occasion',
  'promo', 'qualite', 'disponible', 'plaque', 'course', 'maison',
]);

// ─────────────────────────────────────────────
// Vocabulaire propre à la catégorisation
// ─────────────────────────────────────────────

/**
 * Compléments aux `keywords` de `SUBCATEGORIES` (qui, eux, servent à la
 * recherche et restent volontairement courts). Ici on peut être généreux :
 * marques, mots maliens du quotidien (bazin, djakarta, tabaski), et surtout
 * des EXPRESSIONS de deux ou trois mots, qui lèvent l'ambiguïté des mots
 * bannis ci-dessus.
 *
 * Table séparée exprès : y toucher ne change RIEN au moteur de recherche.
 */
const MOTS_EN_PLUS: Record<string, string[]> = {
  // Téléphonie & Électronique
  telephones: ['telephone', 'oppo', 'xiaomi', 'huawei', 'nokia', 'vivo', 'realme', 'techno'],
  tablettes: ['galaxy tab'],
  ordinateurs: ['asus', 'acer', 'toshiba', 'core i5', 'core i7', 'clavier'],
  tv_audio: ['smart tv', 'home cinema', 'ampli', 'haut parleur', 'barre de son', 'woofer', 'microphone', 'micro lavalliere'],
  consoles_jeux_video: ['compte playstation', 'fifa', 'gta', 'psn', 'carte psn', 'efootball', 'free fire'],
  accessoires_electronique: [
    'ecouteur', 'airpods', 'protecteur ecran', 'support telephone', 'power bank',
    'wifi', 'routeur', 'modem', 'repetiteur wifi', 'repeteur wifi', 'cle wifi',
    'trepied', 'tripied', 'camera', 'drone',
  ],
  // Comptes et abonnements numeriques : tres frequents au Mali (PlayStation,
  // Netflix, IPTV). Faute de rayon dedie, ils vivent dans « Autre » de la
  // categorie electronique, la ou les vendeurs les rangent deja.
  autre_telephonie_electronique: ['netflix', 'compte netflix', 'iptv', 'canal plus'],

  // Mode & Beauté
  vetements_homme: ['veste', 'jean', 'survetement', 'maillot', 'grand boubou'],
  vetements_femme: ['bazin', 'basin', 'hijab', 'abaya', 'foulard', 'tenue femme', 'jube', 'khimar', 'tissu'],
  chaussures: ['babouche', 'mocassin', 'escarpin', 'sandale', 'puma', 'converse'],
  sacs_accessoires: ['portefeuille', 'valise', 'sac a main', 'sac a dos'],
  beaute_cosmetiques: [
    'savon', 'gel douche', 'vernis', 'rouge a levres', 'fond de teint',
    'eau de parfum', 'eau de toilette', 'coffret parfum', 'deodorant', 'lotion',
    'karite', 'tissage', 'faux cils', 'soin visage', 'shampoing', 'gommage',
    'serum', 'encens', 'woussoulan', 'wusulan',
    // « huile » seul est alimentaire autant que cosmetique : ce sont les
    // expressions qui tranchent (la regle du mot-cle le plus precis s'en
    // charge, voir retenirLesPlusPrecis).
    'huile de ricin', 'huile de coco', 'huile de macadamia', 'huile capillaire',
    'huile essentielle',
  ],
  montres_bijoux: [
    'bracelet', 'boucle oreille', 'boucles oreilles', 'pendentif',
    'alliance', 'rolex', 'chaine en or',
  ],

  // Maison & Électroménager
  meubles: [
    'fauteuil', 'buffet', 'commode', 'etagere', 'chambre a coucher',
    'salon complet', 'table a manger',
  ],
  electromenager: [
    'micro onde', 'micro ondes', 'four', 'mixeur', 'blender', 'fer a repasser',
    'chauffe eau', 'machine a laver', 'machine a coudre', 'brasseur', 'split',
    'gaziniere', 'rechaud', 'gaz', 'bouteille de gaz', 'rechaud a gaz',
  ],
  decoration: ['lampe', 'lustre', 'cadre photo', 'vase', 'moustiquaire'],
  materiaux_construction: ['brique', 'gravier', 'sable', 'grillage', 'tuyau', 'robinet', 'sac de ciment'],

  // Voitures / Motos
  voitures_vente: [
    'voiture', 'vehicule', 'peugeot', 'renault', 'nissan', 'honda', 'ford',
    'audi', 'volkswagen', 'mitsubishi', 'land cruiser', 'hilux', 'yaris',
    'picanto', 'sonata', 'elantra', 'camry',
  ],
  pieces_auto: ['retroviseur', 'embrayage', 'radiateur', 'alternateur', 'demarreur', 'piece auto'],
  motos_scooters: ['moto', 'yamaha', 'kymco', 'mbk', 'tricycle', 'kantaka', 'sanya', 'sanili'],
  pieces_moto: ['piece moto'],

  // Immobilier
  location_residentiel: ['a louer', 'loyer', 'chambre a louer', 'maison a louer', 'chambre salon', 'mise en location'],
  vente_maisons: ['maison a vendre', 'villa a vendre', 'duplex'],
  vente_terrains: ['titre foncier', 'lettre attribution', 'concession', 'parcelle'],
  bureaux_commerces: ['hangar', 'entrepot', 'local commercial'],

  // Alimentation
  restaurants: ['pizza', 'shawarma', 'chawarma', 'poulet braise', 'gateau', 'patisserie', 'burger', 'jus naturel'],
  supermarches: ['farine', 'lait', 'sac de riz', 'spaghetti', 'sucre en poudre'],

  // Services
  reparation_electronique: ['reparation telephone', 'deblocage', 'installation logiciel'],
  mecanique: ['diagnostic auto', 'reparation voiture', 'reparation moto'],
  construction_btp: ['plomberie', 'forage', 'batiment', 'chantier'],
  couture_tailleur: ['couturiere', 'brodeur'],
  coiffure_esthetique: ['maquilleuse', 'barbier', 'pedicure', 'manucure', 'massage'],
  cours_formation: ['repetiteur', 'coran', 'cours particulier'],
  transport_demenagement: ['camion', 'benne', 'transporteur', 'coursier', 'chauffeur', 'taxi'],
  photo_video: ['montage video', 'photographie', 'couverture mediatique'],
  informatique_design: ['community manager', 'application mobile', 'creation site'],
};

// ─────────────────────────────────────────────
// Index mot → sous-catégories
// ─────────────────────────────────────────────

interface Entree {
  categorie: string;
  sousCategorie: string;
}

/** mot normalisé → toutes les sous-catégories qui le revendiquent. */
const INDEX: Map<string, Entree[]> = (() => {
  const index = new Map<string, Entree[]>();

  const ajouter = (mot: string, categorie: string, sousCategorie: string) => {
    const cle = normalize(mot);
    // Un mot vidé par la normalisation (ponctuation seule) est écarté, tout
    // comme les mots jugés trop ambigus pour classer.
    if (!cle || MOTS_IGNORES.has(cle)) return;
    const liste = index.get(cle) || [];
    // Le même mot arrive parfois deux fois (écriture accentuée et non
    // accentuée) : une seule entrée par sous-catégorie, sinon il compterait
    // double.
    if (!liste.some(e => e.sousCategorie === sousCategorie)) {
      liste.push({ categorie, sousCategorie });
    }
    index.set(cle, liste);
  };

  Object.entries(SUBCATEGORIES).forEach(([categorie, sousCategories]) => {
    sousCategories.forEach(sous => {
      (sous.keywords || []).forEach(mot => ajouter(mot, categorie, sous.id));
      (MOTS_EN_PLUS[sous.id] || []).forEach(mot => ajouter(mot, categorie, sous.id));
    });
  });

  return index;
})();

/**
 * Un mot revendiqué par plusieurs CATÉGORIES ne doit pas les départager :
 * « pneu » (voitures et motos) ou « casque » (audio et moto) valent donc
 * moitié moins pour chacune. Le mot continue de compter — il dit bien quelque
 * chose — mais c'est un autre mot qui tranchera.
 */
function specificite(entrees: Entree[]): number {
  const categories = new Set(entrees.map(e => e.categorie));
  return 1 / categories.size;
}

// ─────────────────────────────────────────────
// Détection
// ─────────────────────────────────────────────

/** Le titre décrit l'objet ; la description parle souvent de la boutique. */
const POIDS_TITRE = 10;
const POIDS_DESCRIPTION = 3;

const SEUIL_DETECTION = 8;

/**
 * Écart minimum avec la deuxième catégorie pour qu'une détection soit dite
 * « forte », donc applicable sans relecture. Calibré sur le catalogue réel :
 * « Gaz manette portable » (un réchaud à gaz, bien rangé en Maison) marquait
 * pile le double pour Téléphonie à cause de « manette » et « portable ». Un
 * simple doublement ne suffit donc pas à prouver quoi que ce soit.
 */
const ECART_MINIMUM = 2.5;

/**
 * Un mot-clé matche un mot du texte s'il est identique, ou si le mot du texte
 * en est une extension (« montre » → « montres », « chaussure » →
 * « chaussures »). Cette tolérance ne vaut que pour les mots-clés d'au moins
 * cinq lettres : sans cette borne, « or » matcherait « ordinateur » et « tv »
 * matcherait « tvs ».
 *
 * Renvoie les positions occupées dans le texte, une entrée par occurrence —
 * c'est ce qui permet ensuite de n'attribuer chaque mot du texte qu'au
 * mot-clé le plus précis (voir `retenirLesPlusPrecis`).
 */
function positionsDe(cle: string, tokens: string[]): number[][] {
  const motsCle = cle.split(' ');
  const occurrences: number[][] = [];

  if (motsCle.length > 1) {
    for (let i = 0; i + motsCle.length <= tokens.length; i++) {
      const fenetre = tokens.slice(i, i + motsCle.length);
      if (fenetre.join(' ') === cle) {
        occurrences.push(fenetre.map((_, j) => i + j));
      }
    }
    return occurrences;
  }

  const correspond = (t: string) =>
    cle.length >= 5 ? t === cle || t.startsWith(cle) : t === cle;
  tokens.forEach((t, i) => {
    if (correspond(t)) occurrences.push([i]);
  });
  return occurrences;
}

interface Candidat {
  cle: string;
  entrees: Entree[];
  occurrences: number[][];
}

/**
 * Chaque mot du texte n'appartient qu'à UN mot-clé : le plus précis.
 *
 * Sans cette règle, « poulet braisé » compte trois fois — pour l'expression
 * « poulet braise » (restaurant), pour « poulet » et pour « poule »
 * (volailles, qui matche par préfixe) — et l'annonce part dans « Animaux »
 * alors que le texte dit clairement « restaurant ». On classe donc les
 * mots-clés du plus spécifique au plus générique (une expression d'abord,
 * puis le mot le plus long), et un mot-clé n'est retenu que s'il couvre au
 * moins un mot du texte que personne n'a encore réclamé.
 */
function retenirLesPlusPrecis(candidats: Candidat[]): Candidat[] {
  const pris = new Set<number>();
  return candidats
    .slice()
    .sort((a, b) => {
      const motsA = a.cle.split(' ').length;
      const motsB = b.cle.split(' ').length;
      return motsB - motsA || b.cle.length - a.cle.length;
    })
    .filter(c => {
      const retenues = c.occurrences.filter(occ => occ.some(i => !pris.has(i)));
      if (retenues.length === 0) return false;
      retenues.forEach(occ => occ.forEach(i => pris.add(i)));
      return true;
    });
}

export function detecterCategorie(titre?: string | null, description?: string | null): Detection {
  const titreNorm = normalize(titre);
  const descNorm = normalize(description);
  const titreTokens = titreNorm ? titreNorm.split(' ') : [];
  const descTokens = descNorm ? descNorm.split(' ') : [];

  const vide: Detection = {
    categorie: null, sousCategorie: null, confiance: 'aucune',
    score: 0, scoreSuivant: 0, indices: [], indiceDansTitre: false,
  };
  if (!titreNorm && !descNorm) return vide;

  const parSousCategorie = new Map<string, number>();
  const parCategorie = new Map<string, number>();
  const indices: string[] = [];
  let indiceDansTitre = false;

  // Titre et description sont analysés séparément : ce sont deux textes, et
  // un mot du titre ne doit pas « consommer » un mot de la description.
  const candidatsTitre: Candidat[] = [];
  const candidatsDesc: Candidat[] = [];
  INDEX.forEach((entrees, cle) => {
    const dansTitre = positionsDe(cle, titreTokens);
    if (dansTitre.length > 0) {
      candidatsTitre.push({ cle, entrees, occurrences: dansTitre });
      return; // le titre prime : inutile de recompter le mot en description
    }
    const dansDesc = positionsDe(cle, descTokens);
    if (dansDesc.length > 0) candidatsDesc.push({ cle, entrees, occurrences: dansDesc });
  });

  const compter = (candidats: Candidat[], poids: number, titre: boolean) => {
    retenirLesPlusPrecis(candidats).forEach(({ cle, entrees, occurrences }) => {
      // Une expression de plusieurs mots (« chambre a coucher ») est bien
      // plus sûre qu'un mot isolé : elle pèse davantage, et c'est elle qui
      // récupère les mots bannis une fois qu'ils sont désambiguïsés.
      const bonus = cle.includes(' ') ? 1.5 : cle.length >= 8 ? 1.2 : 1;
      // Un titre d'annonce commence presque toujours par l'objet vendu
      // (« Gaz manette portable », « Montre AP », « Cuisinière gaz 4 feux ») :
      // le premier mot en dit plus long que les qualificatifs qui suivent.
      const debut = titre && occurrences.some(occ => occ.includes(0)) ? 1.4 : 1;
      const base = poids * bonus * debut * specificite(entrees);

      indices.push(cle);
      if (titre) indiceDansTitre = true;

      entrees.forEach(({ categorie, sousCategorie }) => {
        parSousCategorie.set(sousCategorie, (parSousCategorie.get(sousCategorie) || 0) + base);
        parCategorie.set(categorie, (parCategorie.get(categorie) || 0) + base);
      });
    });
  };

  compter(candidatsTitre, POIDS_TITRE, true);
  compter(candidatsDesc, POIDS_DESCRIPTION, false);

  if (parCategorie.size === 0) return vide;

  const classement = [...parCategorie.entries()].sort((a, b) => b[1] - a[1]);
  const [categorie, score] = classement[0];
  const scoreSuivant = classement[1]?.[1] || 0;

  // Sous-catégorie : la meilleure PARMI celles de la catégorie gagnante.
  const sousCategories = (SUBCATEGORIES[categorie] || []).map(s => s.id);
  const meilleureSous = [...parSousCategorie.entries()]
    .filter(([id]) => sousCategories.includes(id))
    .sort((a, b) => b[1] - a[1])[0];

  /**
   * La confiance répond à une seule question : « peut-on corriger sans
   * demander ? ». D'où les deux exigences du niveau « forte » — un indice
   * dans le TITRE (une description contient des formules qui parlent d'autre
   * chose que de l'objet) et un écart net avec la deuxième catégorie (sinon
   * le choix relevait du tirage au sort).
   */
  let confiance: Confiance = 'faible';
  if (score >= SEUIL_DETECTION && indiceDansTitre && score >= scoreSuivant * ECART_MINIMUM) {
    confiance = 'forte';
  } else if (score >= SEUIL_DETECTION && indiceDansTitre) {
    confiance = 'moyenne';
  }

  return {
    categorie,
    sousCategorie: meilleureSous?.[0] || null,
    confiance,
    score: Math.round(score * 10) / 10,
    scoreSuivant: Math.round(scoreSuivant * 10) / 10,
    indices,
    indiceDansTitre,
  };
}

/**
 * Comparaison avec le rangement actuel d'une annonce. `corrigeable` n'est vrai
 * que si la détection est assez sûre pour être appliquée sans relecture
 * humaine — c'est le seul drapeau qu'un script de correction de masse a le
 * droit de regarder.
 */
export function analyserAnnonce(annonce: {
  titre?: string | null;
  description?: string | null;
  categorie?: string | null;
  sous_categorie?: string | null;
}): Detection & { accord: boolean; accordSousCategorie: boolean; corrigeable: boolean } {
  const detection = detecterCategorie(annonce.titre, annonce.description);
  const accord = !detection.categorie || detection.categorie === annonce.categorie;
  const accordSousCategorie =
    !detection.sousCategorie || detection.sousCategorie === annonce.sous_categorie;

  return {
    ...detection,
    accord,
    accordSousCategorie,
    corrigeable: !accord && detection.confiance === 'forte',
  };
}
