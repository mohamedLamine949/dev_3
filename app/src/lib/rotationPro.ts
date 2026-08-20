/**
 * Rotation équitable des boutiques professionnelles.
 *
 * Aujourd'hui l'annuaire et la carte d'accueil montrent les boutiques les plus
 * RÉCEMMENT INSCRITES. Conséquence : ce sont toujours les mêmes trois, et une
 * boutique inscrite en juillet ne sera jamais vue. Pour un professionnel qui
 * paie son abonnement, c'est une promesse non tenue ; pour l'acheteur, c'est
 * un annuaire qui paraît minuscule.
 *
 * La rotation est un **avantage de l'abonnement Pro**, pas un boost payé. Elle
 * n'achète donc rien : elle répartit une exposition à laquelle tous les Pro
 * actifs ont droit.
 *
 * ── Comment l'équité est obtenue ─────────────────────────────────────────
 * Un simple tri par score figerait l'ordre : la meilleure boutique passerait
 * toujours en tête. On classe donc la qualité en **trois paliers** seulement,
 * puis on mélange À L'INTÉRIEUR d'un palier avec une empreinte qui change
 * toutes les six heures. Une boutique bien tenue reste devant une boutique
 * bâclée — c'est mérité — mais deux boutiques équivalentes se relaient.
 *
 * Le mélange est déterministe : tous les appareils voient le même ordre au
 * même moment. Sans cela, impossible de vérifier ou d'expliquer un classement.
 */

export interface BoutiqueRotation {
  id: string;
  nom_boutique?: string | null;
  avatar_url?: string | null;
  banniere_url?: string | null;
  quartier_boutique?: string | null;
  horaires?: string | null;
  categorie_metier?: string | null;
  disponibilite?: string | null;
  ouvert_maintenant?: boolean;
  /** Date de la publication la plus récente, si connue. */
  derniere_publication?: string | null;
  nbProduits?: number;
}

/** Durée d'un tour de rotation. Six heures : assez pour être stable dans une
 *  session, assez court pour que chacun passe devant dans la journée. */
const DUREE_TOUR_MS = 6 * 60 * 60 * 1000;

/** Empreinte stable et déterministe d'un identifiant pour un tour donné. */
function empreinte(id: string, tour: number): number {
  let h = 2166136261 ^ tour;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 pour rester positif, puis normalisation dans [0, 1[.
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Qualité d'une boutique, de 0 à 1. Quatre critères, ceux de la spécification :
 * profil complet, disponibilité, boutique ouverte, catalogue frais.
 */
export function qualiteBoutique(b: BoutiqueRotation): number {
  let points = 0;
  let total = 0;

  // Profil complet — ce que l'acheteur voit avant de cliquer.
  const champs = [b.nom_boutique, b.avatar_url, b.banniere_url, b.quartier_boutique, b.horaires];
  total += champs.length;
  points += champs.filter(Boolean).length;

  // Disponibilité annoncée.
  total += 1;
  if (b.disponibilite === 'aujourdhui') points += 1;
  else if (b.disponibilite === 'semaine') points += 0.6;
  else if (b.disponibilite === 'rdv') points += 0.4;

  // Boutique ouverte maintenant.
  total += 1;
  if (b.ouvert_maintenant !== false) points += 1;

  // Catalogue non vide, et récent.
  total += 2;
  if ((b.nbProduits ?? 0) > 0) points += 1;
  if (b.derniere_publication) {
    const jours = (Date.now() - new Date(b.derniere_publication).getTime()) / 86400000;
    if (jours <= 14) points += 1;
    else if (jours <= 45) points += 0.5;
  }

  return total === 0 ? 0 : points / total;
}

/**
 * Ordonne les boutiques : trois paliers de qualité, mélange équitable à
 * l'intérieur de chaque palier.
 *
 * @param maintenant injectable pour les tests — jamais fourni par l'appelant.
 */
export function rotationEquitable<T extends BoutiqueRotation>(
  boutiques: T[],
  maintenant: number = Date.now(),
  placesVisibles?: number
): T[] {
  if (boutiques.length <= 1) return boutiques;
  const tour = Math.floor(maintenant / DUREE_TOUR_MS);

  const classees = [...boutiques]
    .map(b => {
      const q = qualiteBoutique(b);
      // Trois paliers seulement : au-delà, le score fige l'ordre et la
      // rotation n'existe plus.
      const palier = q >= 0.75 ? 0 : q >= 0.45 ? 1 : 2;
      return { b, palier, tirage: empreinte(b.id, tour) };
    })
    .sort((x, y) => (x.palier - y.palier) || (x.tirage - y.tirage))
    .map(x => x.b);

  // ── Quota d'exploration ────────────────────────────────────────────────
  // Sans lui, quand le nombre de boutiques bien tenues dépasse le nombre de
  // places visibles, ce sont toujours les mêmes qui passent — la rotation ne
  // sert plus à rien pour les autres, qui n'ont alors aucune raison de
  // compléter leur profil puisqu'ils ne seront jamais vus.
  //
  // On réserve donc la DERNIÈRE place visible à une boutique tirée du reste
  // de la liste, en changeant à chaque tour. Une place sur trois, pas
  // davantage : l'acheteur doit continuer de voir d'abord ce qui est bien
  // tenu. Le principe est celui du §9.5 pour les annonces.
  if (placesVisibles && classees.length > placesVisibles && placesVisibles >= 2) {
    const reste = classees.slice(placesVisibles);
    const choisie = reste[Math.floor(empreinte('exploration', tour) * reste.length)];
    if (choisie) {
      const tete = classees.slice(0, placesVisibles - 1);
      const autres = classees.slice(placesVisibles - 1).filter(b => b.id !== choisie.id);
      return [...tete, choisie, ...autres];
    }
  }

  return classees;
}
