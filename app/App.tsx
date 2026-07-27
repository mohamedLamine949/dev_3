import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // Applique les mises à jour OTA dès le lancement : sans ça, un utilisateur
  // qui vient d'installer l'app depuis les stores garde le JS embarqué
  // (potentiellement obsolète) jusqu'au 2e redémarrage. Ici, la mise à jour
  // est téléchargée et appliquée en quelques secondes via un rechargement.
  useEffect(() => {
    async function applyOtaUpdate() {
      if (__DEV__ || !Updates.isEnabled) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // Pas de réseau ou serveur indisponible : on continue avec le JS actuel.
        console.log('OTA update check failed:', e);
      }
    }
    applyOtaUpdate();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
