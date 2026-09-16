import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import GardeVersion from './src/components/GardeVersion';
import GardeTutoriel from './src/components/GardeTutoriel';
import { useOtaUpdates } from './src/hooks/useOtaUpdates';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // Mises à jour OTA : au démarrage à froid ET au retour d'une longue absence.
  // Voir useOtaUpdates pour le détail — sans le second déclencheur, un iPhone
  // qui ne redémarre jamais l'application ne reçoit jamais rien.
  useOtaUpdates();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Filet de sécurité pour ce que l'OTA ne peut pas atteindre :
            un binaire de store trop ancien. Invisible par défaut. */}
        <GardeVersion>
          <AuthProvider>
            {/* Guide d'accueil au premier lancement. Il précède l'application
                plutôt que d'en être un écran : rien ne peut y ramener. */}
            <GardeTutoriel>
              <AppNavigator />
            </GardeTutoriel>
          </AuthProvider>
        </GardeVersion>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
