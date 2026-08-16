import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Optimisation des images AVANT téléversement.
 *
 * Pourquoi ce module :
 * les photos sortaient du sélecteur en pleine résolution (4000×3000, 1,5 à 4 Mo
 * pièce) et les avatars partaient même en PNG (5 à 15 Mo). Multiplié par le
 * nombre de fois où une carte d'annonce est affichée, c'est ce qui a fait
 * exploser l'egress Supabase. On redimensionne donc systématiquement au plus
 * grand côté réellement utile à l'écran, et on force le JPEG.
 *
 * Règle : une image n'est JAMAIS agrandie — si elle est déjà plus petite que
 * la cible, on se contente de la ré-encoder en JPEG.
 */

/** Plus grand côté, en pixels, selon l'usage de l'image. */
export const IMAGE_SIZES = {
  /** Photos d'annonce / de produit : affichées en plein écran sur le détail. */
  annonce: 1280,
  /** Bannière de boutique : bandeau large. */
  banniere: 1280,
  /** Photo de profil : affichée au maximum dans un rond de ~120 px. */
  avatar: 512,
} as const;

/** Durée de cache CDN appliquée à tous les téléversements : 1 an. */
export const UPLOAD_CACHE_CONTROL = '31536000';

export type OptimizeOptions = {
  /** Plus grand côté toléré, en pixels. Défaut : 1280. */
  maxSize?: number;
  /** Qualité JPEG, de 0 à 1. Défaut : 0.7. */
  compress?: number;
  /** Renvoyer aussi le base64 de l'image optimisée. */
  base64?: boolean;
};

export type OptimizedImage = {
  uri: string;
  width: number;
  height: number;
  base64?: string;
};

/**
 * Redimensionne et ré-encode une image en JPEG.
 * Renvoie `null` si la manipulation échoue : l'appelant retombe alors sur
 * l'image d'origine plutôt que de perdre la photo de l'utilisateur.
 */
export async function optimizeImage(
  uri: string,
  options: OptimizeOptions = {}
): Promise<OptimizedImage | null> {
  const { maxSize = IMAGE_SIZES.annonce, compress = 0.7, base64 = false } = options;

  try {
    const source = await ImageManipulator.manipulate(uri).renderAsync();
    const longestSide = Math.max(source.width, source.height);

    const ref =
      longestSide > maxSize
        ? await ImageManipulator.manipulate(source)
            .resize(
              source.width >= source.height ? { width: maxSize } : { height: maxSize }
            )
            .renderAsync()
        : source;

    const result = await ref.saveAsync({
      format: SaveFormat.JPEG,
      compress,
      base64,
    });

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      base64: result.base64,
    };
  } catch (e) {
    console.warn('[optimizeImage] Optimisation impossible, image envoyée telle quelle :', e);
    return null;
  }
}
