import { useState, useEffect } from 'react';
import { supabase, Annonce } from '../lib/supabase';
import { composerRayons, composerTendances, LigneIndex } from '../lib/feed';
import { SELECT_CARTE } from './useAnnonces';

export interface RayonAffiche {
  sousCategorie: string;
  /** La sous-catégorie fait partie de celles que la personne a consultées. */
  suggerePourVous: boolean;
  /** Nombre total d'annonces du rayon (au-delà de celles montrées). */
  total: number;
  annonces: Annonce[];
}

/**
 * Charge les rayons de l'accueil à partir de l'index déjà lu par useAnnonces.
 *
 * Deux économies qui comptent, le quota Supabase ayant déjà été dépassé une
 * fois à cause des photos :
 *   - aucune requête d'index supplémentaire : on réutilise celle du fil ;
 *   - une seule requête pour TOUS les rayons (une trentaine d'ids d'un coup),
 *     au lieu d'une requête par rangée.
 *
 * Les photos de ces cartes sont, elles, les mêmes que celles du fil juste en
 * dessous : le cache image de React Native les sert sans second téléchargement.
 */
export function useRayons(
  index: LigneIndex[],
  options?: { sousCategoriesPreferees?: string[]; actif?: boolean }
) {
  const [rayons, setRayons] = useState<RayonAffiche[]>([]);
  /** Annonces boostées, vides tant que personne n'a payé de mise en avant. */
  const [tendances, setTendances] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(false);

  const actif = options?.actif !== false;
  // Dépendre du CONTENU et non du tableau, recréé à chaque rendu.
  const clePreferees = (options?.sousCategoriesPreferees || []).join(',');

  useEffect(() => {
    if (!actif || index.length === 0) {
      setRayons([]);
      setTendances([]);
      return;
    }

    let annule = false;

    const plan = composerRayons(index, {
      sousCategoriesPreferees: clePreferees ? clePreferees.split(',') : [],
    });
    // Les tendances voyagent avec les rayons : une seule requête pour tout ce
    // que l'accueil montre en haut.
    const idsTendances = composerTendances(index);
    const ids = [...new Set([...idsTendances, ...plan.flatMap(r => r.ids)])];
    if (ids.length === 0) {
      setRayons([]);
      setTendances([]);
      return;
    }

    setLoading(true);
    supabase
      .from('annonces')
      .select(SELECT_CARTE)
      .in('id', ids)
      .eq('statut', 'active')
      .eq('est_payee', true)
      .then(({ data, error }) => {
        if (annule) return;
        setLoading(false);
        if (error || !data) {
          // Un rayon absent n'empêche personne d'acheter : le fil complet
          // reste affiché juste en dessous.
          console.warn('Rayons indisponibles:', error?.message);
          setRayons([]);
          setTendances([]);
          return;
        }

        const parId = new Map((data as Annonce[]).map(a => [a.id, a]));
        setTendances(idsTendances.map(id => parId.get(id)).filter(Boolean) as Annonce[]);
        setRayons(
          plan
            .map(r => ({
              sousCategorie: r.sousCategorie,
              suggerePourVous: r.suggerePourVous,
              total: r.total,
              // `.in()` ne garantit pas l'ordre : on rétablit celui du plan,
              // où les vendeurs alternent déjà.
              annonces: r.ids.map(id => parId.get(id)).filter(Boolean) as Annonce[],
            }))
            // Une annonce vendue entre l'index et l'affichage peut vider une
            // rangée : on ne montre pas un rayon à moitié.
            .filter(r => r.annonces.length >= 4)
        );
      });

    return () => { annule = true; };
  }, [index, clePreferees, actif]);

  return { rayons, tendances, loading };
}
