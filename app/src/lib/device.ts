import { Platform } from 'react-native';

/**
 * Identifiant d'appareil (anti multi-comptes campagne parrainage).
 * Android : SSAID (stable par appareil + clé de signature, change au factory reset).
 * iOS : identifierForVendor (stable tant qu'une app du vendeur reste installée).
 * Sert UNIQUEMENT de signal/drapeau côté admin (voir v_moderation_campagne),
 * jamais de blocage automatique.
 *
 * `expo-application` est un module natif : la capture ne fonctionne que dans un
 * build (dev-client / production), pas sur un JS OTA seul. On importe en lazy
 * pour ne jamais crasher si le module n'est pas présent.
 */
export async function getDeviceId(): Promise<string | null> {
  try {
    const Application = await import('expo-application');
    if (Platform.OS === 'android') {
      return (Application.getAndroidId?.() as string) || null;
    }
    if (Platform.OS === 'ios') {
      return (await Application.getIosIdForVendorAsync?.()) || null;
    }
    return null;
  } catch (e) {
    return null;
  }
}
