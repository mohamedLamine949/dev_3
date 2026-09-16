import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { guideDejaVu } from '../lib/tutoriel';
import TutorielScreen from '../screens/TutorielScreen';

/**
 * Montre le guide d'accueil au premier lancement, puis s'efface.
 *
 * Placé au-dessus de la navigation plutôt qu'en écran de celle-ci : le guide
 * n'est pas une destination, c'est ce qui précède l'application, et aucun
 * bouton « retour » ne peut donc y ramener.
 *
 * Contrepartie assumée : au tout premier lancement, la navigation n'existe
 * pas encore tant que le guide est affiché. Quelqu'un qui installerait
 * l'application puis l'ouvrirait depuis une notification verrait le guide
 * avant le contenu visé. Le cas ne peut se produire qu'une seule fois, et
 * seulement avant d'avoir jamais ouvert l'application.
 *
 * Tous les utilisateurs actuels le verront une fois, puisqu'aucun n'a encore
 * la clé enregistrée. C'est voulu : ce sont précisément eux qui n'ont jamais
 * eu d'explication sur les catégories ni sur le boost.
 */
export default function GardeTutoriel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  // `null` = on ne sait pas encore. Afficher le guide pendant ce court instant
  // le ferait clignoter devant ceux qui l'ont déjà passé.
  const [dejaVu, setDejaVu] = useState<boolean | null>(null);

  useEffect(() => {
    let monte = true;
    guideDejaVu().then(vu => {
      if (monte) setDejaVu(vu);
    });
    return () => { monte = false; };
  }, []);

  // Lecture du stockage : quelques millisecondes. On tient le fond du thème
  // plutôt qu'un écran blanc.
  if (dejaVu === null) {
    return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  }

  if (!dejaVu) {
    return <TutorielScreen onTermine={() => setDejaVu(true)} />;
  }

  return <>{children}</>;
}
