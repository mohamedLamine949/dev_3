import React, { useState } from 'react';
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
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useConversations } from '../hooks/useChat';

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Maint.';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

interface Props {
  navigation: any;
}

export default function MessagesScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const userId = session?.user?.id;
  
  const { conversations, loading, refetch } = useConversations(userId);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const renderConversation = ({ item }: { item: any }) => {
    const imageUrl = item.annonce?.images?.[0]?.image_url || null;
    const hasUnread = (item.unread_count || 0) > 0;

    return (
      <TouchableOpacity
        style={[styles.conversationCard, hasUnread && styles.conversationCardUnread]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('ChatConversation', {
            conversationId: item.id,
            titrAnnonce: item.annonce?.titre,
          })
        }
      >
        {/* Image de l'annonce */}
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={styles.conversationImage} />
          : <View style={[styles.conversationImage, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="pricetag-outline" size={20} color={theme.border} />
            </View>
        }

        {/* Contenu */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationTop}>
            <Text style={[styles.conversationTitle, hasUnread && styles.textBold]} numberOfLines={1}>
              {item.annonce?.titre || 'Annonce supprimée'}
            </Text>
            <Text style={[styles.conversationTime, hasUnread && { color: theme.primary }]}>
              {timeAgo(item.date_dernier_message)}
            </Text>
          </View>
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

  if (!userId) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="log-in-outline" size={56} color={theme.textMuted} />
        <Text style={styles.emptyTitle}>Non connecté</Text>
        <Text style={styles.emptyText}>Connectez-vous pour voir vos messages.</Text>
        <TouchableOpacity 
          style={{ marginTop: 20, backgroundColor: theme.primary, padding: 12, borderRadius: 8 }}
          onPress={() => navigation.navigate('Profil')}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading && conversations.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refetch}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={56} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>Pas encore de messages</Text>
              <Text style={styles.emptyText}>
                Contactez un vendeur pour commencer une conversation
              </Text>
            </View>
          }
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
    fontSize: FONTS.xxl,
    fontWeight: FONTS.extrabold,
    color: theme.textPrimary,
  },

  listContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginLeft: 76,
  },

  // Conversation card
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
    marginBottom: 4,
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
    color: theme.textInverse,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.section * 2,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  emptyText: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
    maxWidth: 250,
  },
});
