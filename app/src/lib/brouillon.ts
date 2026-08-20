import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Brouillons de formulaire conservés sur l'appareil (§7.10).
 *
 * « Les erreurs réseau ne doivent jamais faire perdre un formulaire. Les
 * brouillons sont enregistrés localement et repris au retour de la connexion. »
 *
 * Ce n'est pas un confort. Sur une connexion irrégulière — le cas normal ici —
 * remplir un formulaire d'annonce prend plusieurs minutes, photos comprises.
 * Le perdre sur une coupure suffit à faire abandonner la publication, et donc
 * à faire perdre une annonce au catalogue. C'est directement le problème de
 * liquidité du produit.
 *
 * Volontairement simple : pas de file d'attente ni d'envoi différé, juste la
 * saisie conservée. Un envoi automatique en arrière-plan publierait des
 * annonces sans que l'utilisateur l'ait décidé — mauvaise idée.
 */

const PREFIXE = 'brouillon:';

/** Un brouillon plus vieux que ça n'est plus proposé : il a perdu son sens. */
const DUREE_VIE_MS = 7 * 24 * 60 * 60 * 1000;

interface Enveloppe<T> {
  enregistreLe: number;
  donnees: T;
}

export async function sauverBrouillon<T>(cle: string, donnees: T): Promise<void> {
  try {
    const enveloppe: Enveloppe<T> = { enregistreLe: Date.now(), donnees };
    await AsyncStorage.setItem(PREFIXE + cle, JSON.stringify(enveloppe));
  } catch {
    // Stockage plein ou indisponible : on ne casse jamais la saisie en cours.
  }
}

export async function lireBrouillon<T>(cle: string): Promise<T | null> {
  try {
    const brut = await AsyncStorage.getItem(PREFIXE + cle);
    if (!brut) return null;
    const enveloppe = JSON.parse(brut) as Enveloppe<T>;
    if (!enveloppe?.enregistreLe || Date.now() - enveloppe.enregistreLe > DUREE_VIE_MS) {
      await AsyncStorage.removeItem(PREFIXE + cle);
      return null;
    }
    return enveloppe.donnees;
  } catch {
    return null;
  }
}

export async function effacerBrouillon(cle: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIXE + cle);
  } catch {
    // sans conséquence
  }
}

/** Clés utilisées, regroupées pour éviter les collisions silencieuses. */
export const BROUILLON_ANNONCE = 'annonce';
export const BROUILLON_PRODUIT = 'produit';
