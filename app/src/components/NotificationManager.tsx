import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationManager() {
  const navigation = useNavigation<any>();
  const { notification } = useNotifications();

  useEffect(() => {
    // Écouteur pour les interactions avec les notifications (clic)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data?.conversationId) {
        navigation.navigate('Messages', {
          screen: 'ChatConversation',
          params: { 
            conversationId: data.conversationId,
            titreAnnonce: data.titreAnnonce 
          },
        });
      }
    });

    return () => subscription.remove();
  }, [navigation]);
  
  return null;
}
