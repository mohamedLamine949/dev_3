import { Platform, Linking } from 'react-native';

/**
 * Version du BINAIRE installé (celle du store), à ne pas confondre avec la
 * version du JS livré par OTA. C'est la seule qui dit si l'utilisateur peut
 * encore recevoir nos mises à jour : un binaire trop ancien est hors de portée
 * d'`eas update`, quoi qu'on publie.
 *
 * `expo-application` est un module natif : import paresseux et échec silencieux,
 * comme dans `device.ts`. Renvoyer `null` signifie « on ne sait pas » — et dans
 * le doute on ne bloque JAMAIS l'application.
 */
export async function getVersionNative(): Promise<string | null> {
  try {
    const Application = await import('expo-application');
    return Application.nativeApplicationVersion || null;
  } catch {
    return null;
  }
}

/**
 * Compare deux versions « 1.2.3 ». Renvoie vrai si `version` est strictement
 * antérieure à `minimum`. Toute valeur illisible renvoie faux : on préfère
 * laisser passer quelqu'un qui devrait mettre à jour plutôt que bloquer
 * quelqu'un qui est à jour.
 */
export function estVersionInferieure(version: string, minimum: string): boolean {
  const decouper = (v: string) => v.trim().split('.').map(n => parseInt(n, 10));
  const a = decouper(version);
  const b = decouper(minimum);
  if (a.some(isNaN) || b.some(isNaN) || a.length === 0 || b.length === 0) return false;
  const taille = Math.max(a.length, b.length);
  for (let i = 0; i < taille; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

const URL_APP_STORE = 'https://apps.apple.com/app/flash-market/id6784725073';
const URL_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.chapchap.flashmarket';

/** Ouvre la fiche du store correspondant au téléphone. */
export function ouvrirStore() {
  const url = Platform.OS === 'ios' ? URL_APP_STORE : URL_PLAY_STORE;
  Linking.openURL(url).catch(() => {});
}
