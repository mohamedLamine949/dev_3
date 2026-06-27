import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotificationsList, NotificationData } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen({ navigation }: any) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const { 
    notifications, 
    loading, 
    unreadCount, 
    markAllAsRead, 
    markAsRead, 
    deleteNotification, 
    refetch 
  } = useNotificationsList(session?.user?.id);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const handleNotificationPress = async (item: NotificationData) => {
    if (!item.lu) {
      await markAsRead(item.id);
    }

    if (item.type === 'chat' && item.donnees?.conversationId) {
      navigation.navigate('ChatConversation', {
        conversationId: item.donnees.conversationId,
        titreAnnonce: item.donnees.titreAnnonce || 'Message'
      });
    } else if (item.donnees?.annonceId) {
      try {
        const { data: ad, error } = await supabase
          .from('annonces')
          .select('*, images:images_annonce(image_url, ordre)')
          .eq('id', item.donnees.annonceId)
          .single();

        if (ad && !error) {
          navigation.navigate('AnnonceDetail', { annonce: ad });
        } else {
          if (item.type === 'favori') {
            navigation.navigate('Favoris');
          } else {
            navigation.navigate('MesAnnonces');
          }
        }
      } catch (err) {
        console.error('Erreur redirection:', err);
      }
    } else if (item.type === 'compte_pro_active') {
      navigation.navigate('ProfileMain');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous supprimer cette notification ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteNotification(id) }
      ]
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return {
          name: 'chatbubble-ellipses',
          color: theme.primary,
          bg: isDark ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)'
        };
      case 'annonce_validee':
        return {
          name: 'checkmark-circle',
          color: '#16a34a',
          bg: isDark ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)'
        };
      case 'paiement_requis':
        return {
          name: 'card',
          color: '#d97706',
          bg: isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.08)'
        };
      case 'annonce_vendue':
        return {
          name: 'ribbon',
          color: '#2563eb',
          bg: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)'
        };
      case 'favori':
        return {
          name: 'star',
          color: '#eab308',
          bg: isDark ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.08)'
        };
      case 'compte_pro_active':
        return {
          name: 'briefcase',
          color: '#7c3aed',
          bg: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)'
        };
      default:
        return {
          name: 'notifications',
          color: theme.textMuted,
          bg: theme.surfaceMuted
        };
    }
  };

  const renderItem = ({ item }: { item: NotificationData }) => {
    const iconData = getNotificationIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.card, !item.lu && styles.unreadCard]}
        activeOpacity={0.8}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconWrapper, { backgroundColor: iconData.bg }]}>
          <Ionicons name={iconData.name as any} size={20} color={iconData.color} />
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, !item.lu && styles.unreadText]} numberOfLines={1}>
              {item.titre}
            </Text>
            <Text style={styles.time}>{timeAgo(item.date_creation)}</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {item.contenu}
          </Text>
        </View>

        <View style={styles.actions}>
          {!item.lu && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.surface} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        
        {session && unreadCount > 0 ? (
          <TouchableOpacity style={styles.markReadButton} onPress={markAllAsRead} activeOpacity={0.7}>
            <Ionicons name="checkmark-done" size={20} color={theme.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {!session ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={54} color={theme.borderLight} />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptyText}>Connectez-vous pour voir vos notifications d'annonces, de messages et d'activités.</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      ) : loading && notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={54} color={theme.borderLight} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Vous recevrez des alertes quand des acheteurs vous écriront ou quand vos annonces changeront de statut.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  markReadButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  list: { padding: SPACING.md, paddingBottom: 100 },
  card: {
    flexDirection: 'row', backgroundColor: theme.surface,
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.sm, alignItems: 'center',
    borderWidth: 1, borderColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  unreadCard: {
    borderColor: isDark ? 'rgba(22, 163, 74, 0.25)' : 'rgba(22, 163, 74, 0.1)',
    backgroundColor: isDark ? 'rgba(22, 163, 74, 0.03)' : 'rgba(22, 163, 74, 0.015)',
  },
  iconWrapper: { 
    width: 40, height: 40, borderRadius: RADIUS.full, 
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.md 
  },
  content: { flex: 1, marginRight: SPACING.sm },
  headerRow: { 
    flexDirection: 'row', justifyContent: 'space-between', 
    alignItems: 'baseline', marginBottom: 2 
  },
  title: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textSecondary },
  unreadText: { color: theme.textPrimary, fontWeight: FONTS.bold },
  time: { fontSize: 10, color: theme.textMuted },
  message: { fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 16 },
  actions: { 
    alignItems: 'center', justifyContent: 'center', 
    height: '100%', minWidth: 24, gap: SPACING.xs 
  },
  unreadDot: { width: 8, height: 8, borderRadius: RADIUS.full },
  deleteButton: { padding: 4 },
  emptyContainer: {
    flex: 1, paddingVertical: 120, paddingHorizontal: SPACING.xl,
    alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
  },
  emptyTitle: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  emptyText: { fontSize: FONTS.sm, color: theme.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
  loginBtn: {
    marginTop: SPACING.sm, backgroundColor: theme.primary,
    paddingHorizontal: SPACING.xxl, paddingVertical: 12, borderRadius: RADIUS.full,
  },
  loginBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: FONTS.md },
});
