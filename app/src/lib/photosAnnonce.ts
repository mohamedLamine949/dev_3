import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { UPLOAD_CACHE_CONTROL } from './imageOptimizer';

/**
 * Téléversement des photos d'une annonce — un seul endroit, pour tout le monde.
 *
 * Pourquoi ce module :
 * la publication et la modification avaient chacune leur copie du même code,
 * et toutes les deux **avalaient les échecs** : un `continue` sur erreur
 * d'upload, un `console.error` sur l'insertion en base, puis « Succès » à
 * l'écran. Sur une connexion faible, le vendeur voyait donc son annonce
 * publiée alors qu'aucune photo n'était partie — c'est exactement ce qui est
 * arrivé à une vendeuse le 2026-09-02, qui a cru l'application cassée et a
 * supprimé puis republié son annonce.
 *
 * Règle : une photo qui n'est pas partie DOIT être signalée à l'appelant.
 * Une annonce sans photo est invendable ; mentir sur ce point coûte plus cher
 * qu'un message d'erreur.
 */

const BUCKET = 'annonces-images';

export interface ResultatPhotos {
  /** URLs publiques, dans l'ordre demandé, des photos réellement en ligne. */
  urls: string[];
  /** Nombre de photos qui n'ont pas pu être envoyées. */
  echecs: number;
}

/**
 * Envoie une photo locale et renvoie son URL publique, ou `null`.
 * Une seconde tentative est faite avant d'abandonner : sur un réseau mobile
 * malien, un échec isolé est le cas courant, pas l'exception.
 */
async function televerserUne(annonceId: string, uri: string, index: number): Promise<string | null> {
  for (let tentative = 0; tentative < 2; tentative++) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      // `Date.now()` dans le nom : deux modifications successives ne doivent
      // pas écraser un fichier encore référencé par l'annonce.
      const fileName = `${annonceId}/${Date.now()}_${index}.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
          // Cache CDN 1 an : sans ça Supabase applique max-age=3600 et la même
          // photo est re-téléchargée toutes les heures par chaque utilisateur
          // (première cause de l'egress).
          cacheControl: UPLOAD_CACHE_CONTROL,
        });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e) {
      console.warn(`[photos] echec upload ${index} (tentative ${tentative + 1}) :`, e);
    }
  }
  return null;
}

/**
 * Met en ligne les photos d'une annonce.
 *
 * Les URI qui commencent par `http` sont des photos DÉJÀ en ligne (cas de la
 * modification) : elles sont conservées telles quelles, sans re-téléversement
 * — inutile et coûteux en egress.
 */
export async function televerserPhotosAnnonce(annonceId: string, uris: string[]): Promise<ResultatPhotos> {
  const urls: string[] = [];
  let echecs = 0;

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    if (uri.startsWith('http')) {
      urls.push(uri);
      continue;
    }
    const url = await televerserUne(annonceId, uri, i);
    if (url) urls.push(url);
    else echecs += 1;
  }

  return { urls, echecs };
}

/**
 * Réécrit la liste des photos d'une annonce, dans l'ordre donné.
 * Renvoie le nombre de lignes réellement enregistrées.
 */
export async function remplacerPhotosAnnonce(annonceId: string, urls: string[]): Promise<number> {
  const { error: deleteError } = await supabase
    .from('images_annonce')
    .delete()
    .eq('annonce_id', annonceId);
  if (deleteError) throw deleteError;

  if (urls.length === 0) return 0;

  const { error: insertError } = await supabase
    .from('images_annonce')
    .insert(urls.map((image_url, ordre) => ({ annonce_id: annonceId, image_url, ordre })));
  if (insertError) throw insertError;

  return urls.length;
}
