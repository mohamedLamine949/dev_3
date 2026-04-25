import React from 'react';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import NotificationManager from './src/components/NotificationManager';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationManager />
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
