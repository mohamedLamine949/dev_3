import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Configuration de la gestion des notifications au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const { session } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
      if (token && session?.user?.id) {
        saveTokenToSupabase(token, session.user.id);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification interaction:', response);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [session?.user?.id]);

  async function saveTokenToSupabase(token: string, userId: string) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ push_token: token })
        .eq('id', userId);
      
      if (error) throw error;
      console.log('Push token saved to Supabase');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    try {
        const projectId = 
          Constants?.expoConfig?.extra?.eas?.projectId ?? 
          Constants?.easConfig?.projectId ??
          ''; // Laissez vide si non trouvé, l'erreur sera gérée plus bas
          
        if (!projectId && Device.isDevice) {
            console.warn('Project ID non trouvé dans la configuration Expo. Les notifications distantes pourraient ne pas fonctionner sans projectId dans app.json.');
        }

        token = (await Notifications.getExpoPushTokenAsync({
            ...(projectId ? { projectId } : {}),
        })).data;
    } catch (e) {
        console.log('Erreur lors de la récupération du push token (normal en simulateur ou sans config EAS):', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
