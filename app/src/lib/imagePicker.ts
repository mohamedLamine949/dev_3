import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { optimizeImage, IMAGE_SIZES, OptimizeOptions } from './imageOptimizer';

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
 * - Chaque photo retenue est redimensionnée et ré-encodée en JPEG ici, avant
 *   de remonter aux écrans (voir imageOptimizer). C'est le point de passage
 *   unique : aucun écran n'a donc à se soucier du poids des photos.
 *
 * Retourne le tableau d'assets sélectionnés, ou null si annulé / erreur.
 */
export async function pickImages(
  options: Partial<ImagePicker.ImagePickerOptions> = {},
  optimizeOptions: OptimizeOptions = {}
): Promise<ImagePicker.ImagePickerAsset[] | null> {
  try {
    // Le base64 demandé par l'appelant est régénéré sur l'image OPTIMISÉE :
    // inutile (et coûteux en mémoire) de le faire produire par le sélecteur
    // sur l'original pleine résolution.
    const { base64: wantsBase64, ...pickerOptions } = options;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Pas de recompression ici : la qualité est appliquée après
      // redimensionnement, où elle coûte beaucoup moins cher en octets.
      quality: 1,
      ...pickerOptions,
      base64: false,
    });
    if (result.canceled) return null;

    const assets = result.assets ?? [];
    if (assets.length === 0) return null;

    return await Promise.all(
      assets.map((asset) =>
        optimizeAsset(asset, {
          maxSize: IMAGE_SIZES.annonce,
          ...optimizeOptions,
          base64: !!wantsBase64,
        })
      )
    );
  } catch (e: any) {
    Alert.alert(
      'Impossible d’ouvrir la galerie',
      (e?.message || String(e)) + '\n\nRéessayez, et si le problème persiste vérifiez les autorisations de l’application dans les réglages de votre téléphone.'
    );
    return null;
  }
}

/**
 * Applique l'optimisation à un asset du sélecteur en conservant sa forme
 * (uri / base64 / dimensions), pour que les écrans appelants n'aient rien à
 * changer. En cas d'échec, l'asset d'origine est renvoyé intact.
 */
async function optimizeAsset(
  asset: ImagePicker.ImagePickerAsset,
  options: OptimizeOptions
): Promise<ImagePicker.ImagePickerAsset> {
  const optimized = await optimizeImage(asset.uri, options);

  if (!optimized) {
    // Repli : on n'a plus demandé le base64 au sélecteur, il faut donc le
    // relire nous-mêmes, sinon l'écran appelant croit que l'utilisateur a
    // annulé et la photo est perdue.
    if (options.base64 && !asset.base64) {
      try {
        return {
          ...asset,
          base64: await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any }),
        };
      } catch (e) {
        console.warn('[pickImages] Lecture base64 de repli impossible :', e);
      }
    }
    return asset;
  }

  return {
    ...asset,
    uri: optimized.uri,
    width: optimized.width,
    height: optimized.height,
    base64: optimized.base64 ?? asset.base64,
    mimeType: 'image/jpeg',
  };
}
