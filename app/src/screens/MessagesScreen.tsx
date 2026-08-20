import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { useConversations } from '../hooks/useChat';

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Maint.';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

export default function MessagesScreen({ navigation }: any) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const userId = session?.user?.id;
  
  const { conversations, loading, refetch } = useConversations(userId);
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  // Place reservee sous la tab bar flottante.
  const tabBarSpace = useTabBarSpace();

  const renderConversation = ({ item }: { item: any }) => {
    const imageUrl = item.annonce?.images?.[0]?.image_url || null;
    const hasUnread = (item.unread_count || 0) > 0;
    const interlocuteur = item.acheteur_id === userId ? item.vendeur : item.acheteur;
    const interlocuteurNom = [interlocuteur?.prenom, interlocuteur?.nom].filter(Boolean).join(' ').trim();

    return (
      <TouchableOpacity
        style={[styles.conversationCard, hasUnread && styles.conversationCardUnread]}
        activeOpacity={0.75}
        onPress={() =>
          navigation.navigate('ChatConversation', {
            conversationId: item.id,
            titreAnnonce: item.annonce?.titre,
            interlocuteur: interlocuteur || undefined,
          })
        }
      >
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={styles.conversationImage} />
          : <View style={[styles.conversationImage, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="pricetag-outline" size={22} color={theme.textMuted} />
            </View>
        }

        <View style={styles.conversationContent}>
          <View style={styles.conversationTop}>
            <Text style={[styles.conversationTitle, hasUnread && styles.textBold]} numberOfLines={1}>
              {interlocuteurNom || item.annonce?.titre || 'Annonce supprimée'}
            </Text>
            <Text style={[styles.conversationTime, hasUnread && { color: theme.primary, fontWeight: FONTS.semibold }]}>
              {timeAgo(item.date_dernier_message)}
            </Text>
          </View>
          {interlocuteurNom ? (
            <Text style={styles.conversationAnnonce} numberOfLines={1}>
              {item.annonce?.titre || 'Annonce supprimée'}
            </Text>
          ) : null}
          <View style={styles.conversationBottom}>
            <Text
              style={[styles.conversationMessage, hasUnread && styles.textBold]}
              numberOfLines={1}
            >
              {item.dernier_message}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.reloadBtn} onPress={refetch} activeOpacity={0.7}>
          <Ionicons name="reload" size={18} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {!userId ? (
        <View style={[styles.container, styles.emptyContainer]}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="lock-closed-outline" size={32} color={theme.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyText}>Connectez-vous pour accéder à vos messages.</Text>
          <TouchableOpacity 
            style={styles.connectBtn}
            onPress={() => navigation.navigate('Compte')}
            activeOpacity={0.8}
          >
            <Text style={styles.connectBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      ) : loading && conversations.length === 0 ? (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          refreshing={loading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={32} color={theme.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Pas encore de messages</Text>
              <Text style={styles.emptyText}>Vos conversations avec les acheteurs et vendeurs apparaîtront ici.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={[styles.listContainer, { paddingBottom: tabBarSpace + SPACING.lg }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={loading}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: theme.background,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: theme.textPrimary,
  },
  reloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    // paddingBottom ajoute a l'usage : hauteur reelle de la tab bar flottante
  },
  separator: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginLeft: 72,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  conversationCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
    paddingLeft: SPACING.md - 3,
  },
  conversationImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: theme.surfaceMuted,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  conversationTitle: {
    flex: 1,
    fontSize: FONTS.md,
    fontWeight: FONTS.medium,
    color: theme.textPrimary,
    marginRight: SPACING.sm,
  },
  conversationTime: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
  },
  conversationAnnonce: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    marginBottom: 3,
  },
  conversationBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationMessage: {
    flex: 1,
    fontSize: FONTS.sm,
    color: theme.textMuted,
    marginRight: SPACING.sm,
  },
  textBold: {
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: FONTS.bold,
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.section * 1.5,
    gap: SPACING.md,
  },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
  },
  emptyText: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  connectBtn: {
    marginTop: SPACING.md,
    backgroundColor: theme.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    ...SHADOWS.colored,
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: FONTS.bold,
    fontSize: FONTS.md,
  },
});
