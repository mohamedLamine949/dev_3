import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Applique les mises à jour OTA sans que l'utilisateur ait à faire quoi que ce soit.
 *
 * Deux moments de vérification, parce qu'un seul ne suffit pas :
 *
 * 1. **Démarrage à froid.** C'est le comportement historique. Il ne couvre que
 *    les gens qui tuent l'application ou dont le téléphone la tue faute de
 *    mémoire. Sur iPhone, une application peut rester des semaines en
 *    arrière-plan sans jamais redémarrer : ces utilisateurs ne voyaient donc
 *    jamais nos publications.
 *
 * 2. **Retour au premier plan après une longue absence.** On recheck quand
 *    l'application revient du fond, mais seulement si elle y est restée
 *    assez longtemps pour qu'aucun travail ne soit en cours. Prendre une
 *    photo, se connecter avec Google ou répondre à un appel fait passer
 *    l'application en arrière-plan quelques secondes : recharger à ce
 *    moment-là effacerait l'annonce en cours de rédaction. D'où le délai
 *    généreux ci-dessous — au-delà, l'utilisateur a réellement quitté.
 *
 * Le rechargement est immédiat (`reloadAsync`) et non un simple téléchargement :
 * sans lui, la mise à jour ne s'appliquerait qu'au lancement SUIVANT, soit un
 * lancement de retard à chaque publication.
 */

/** Absence minimale en arrière-plan avant de retenter une mise à jour. */
const DELAI_ARRIERE_PLAN_MS = 15 * 60 * 1000;

export function useOtaUpdates() {
  const enCours = useRef(false);
  const partiA = useRef<number | null>(null);

  useEffect(() => {
    async function appliquerMiseAJour() {
      // `isEnabled` est faux en développement et dans un build sans OTA :
      // on ne tente rien plutôt que de faire échouer une requête inutile.
      if (__DEV__ || !Updates.isEnabled || enCours.current) return;
      enCours.current = true;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // Pas de réseau ou serveur indisponible : on continue avec le JS actuel.
        console.log('OTA update check failed:', e);
      } finally {
        enCours.current = false;
      }
    }

    appliquerMiseAJour();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') {
        // On ne retient que 'background'. 'inactive' arrive aussi pendant un
        // simple appel entrant ou l'ouverture du sélecteur d'applications.
        partiA.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const parti = partiA.current;
      partiA.current = null;
      if (parti !== null && Date.now() - parti >= DELAI_ARRIERE_PLAN_MS) {
        appliquerMiseAJour();
      }
    });

    return () => sub.remove();
  }, []);
}
