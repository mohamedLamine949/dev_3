import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/**
 * Sélection de photo(s) robuste et centralisée.
 *
 * Pourquoi ce helper :
 * - On utilise le sélecteur système (PHPicker sur iOS 14+, Photo Picker sur
 *   Android 13+/backport). Ces sélecteurs s'exécutent hors-process et ne
 *   nécessitent AUCUNE permission d'accès à la galerie → on n'appelle donc
 *   pas requestMediaLibraryPermissionsAsync (qui, sans la chaîne Info.plist,
 *   faisait planter iOS et, en build standalone, bloquait Android sur un
 *   statut "denied").
 * - Tout est enveloppé dans un try/catch qui AFFICHE l'erreur réelle au lieu
 *   d'échouer silencieusement (symptôme : « rien ne se passe »).
 *
 * Retourne le tableau d'assets sélectionnés, ou null si annulé / erreur.
 */
export async function pickImages(
  options: Partial<ImagePicker.ImagePickerOptions> = {}
): Promise<ImagePicker.ImagePickerAsset[] | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      ...options,
    });
    if (result.canceled) return null;
    return result.assets ?? null;
  } catch (e: any) {
    Alert.alert(
      'Impossible d’ouvrir la galerie',
      (e?.message || String(e)) + '\n\nRéessayez, et si le problème persiste vérifiez les autorisations de l’application dans les réglages de votre téléphone.'
    );
    return null;
  }
}
