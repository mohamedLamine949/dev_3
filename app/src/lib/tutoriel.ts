import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mémoire du guide d'accueil : affiché une fois, puis plus jamais — sauf si
 * la personne le redemande depuis son compte.
 *
 * La clé porte un numéro de version. Le jour où le guide change vraiment (un
 * nouveau service payant, un parcours de publication différent), passer à
 * `v2` le remontre à tout le monde, y compris à ceux qui l'ont déjà vu. Ne
 * pas le faire pour une correction de faute : ce serait imposer cinq écrans
 * à des gens qui savent déjà s'en servir.
 */
const CLE_GUIDE = 'tutoriel_vu_v1';

/**
 * `null` tant qu'on ne sait pas encore (lecture en cours) : l'appelant doit
 * attendre plutôt que d'afficher le guide par défaut, sinon il clignoterait à
 * chaque lancement devant ceux qui l'ont déjà vu.
 */
export async function guideDejaVu(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLE_GUIDE)) === 'oui';
  } catch (e) {
    // Stockage illisible : on considère le guide comme vu. Mieux vaut ne pas
    // le montrer que le remontrer en boucle à quelqu'un qui l'a déjà passé.
    console.warn('Lecture du guide impossible:', e);
    return true;
  }
}

export async function marquerGuideVu(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_GUIDE, 'oui');
  } catch (e) {
    console.warn('Enregistrement du guide impossible:', e);
  }
}

/** « Revoir le guide », depuis l'écran Compte. */
export async function reinitialiserGuide(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLE_GUIDE);
  } catch (e) {
    console.warn('Reinitialisation du guide impossible:', e);
  }
}
