import { useState, useEffect, useRef, useCallback } from 'react';
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

export interface NotificationData {
  id: string;
  user_id: string;
  titre: string;
  contenu: string;
  type: string; // 'chat' | 'annonce_validee' | 'paiement_requis' | 'annonce_vendue' | 'favori' | 'avis' | 'compte_pro_active' | 'bienvenue'
  donnees: any;
  lu: boolean;
  date_creation: string;
}

export function useNotificationsList(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('date_creation', { ascending: false });

      if (error) throw error;

      const items = (data || []) as NotificationData[];
      setNotifications(items);
      setUnreadCount(items.filter(n => !n.lu).length);
    } catch (err) {
      console.error('Erreur fetchNotifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();

    if (!userId) return;

    const channel = supabase
      .channel(`notifications_changes_${userId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${userId}` 
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ lu: true })
        .eq('user_id', userId)
        .eq('lu', false);

      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      console.error('Erreur markAllAsRead:', err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ lu: true })
        .eq('id', notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      console.error('Erreur markAsRead:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      console.error('Erreur deleteNotification:', err);
    }
  };

  return { notifications, loading, unreadCount, markAllAsRead, markAsRead, deleteNotification, refetch: fetchNotifications };
}
