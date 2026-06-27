import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../hooks/useNotifications';
import { navigationRef } from '../navigation/navigationRef';

export default function NotificationManager() {
  const { notification } = useNotifications();

  useEffect(() => {
    // Écouteur pour les interactions avec les notifications (clic)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data?.conversationId && navigationRef.isReady()) {
        (navigationRef as any).navigate('Messages', {
          screen: 'ChatConversation',
          params: { 
            conversationId: data.conversationId,
            titreAnnonce: data.titreAnnonce 
          },
        });
      }
    });

    return () => subscription.remove();
  }, []);
  
  return null;
}
