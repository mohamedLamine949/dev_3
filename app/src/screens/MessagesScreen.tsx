import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { Conversation } from '../lib/supabase';

// Données de démo
const DEMO_CONVERSATIONS: (Conversation & { unread?: number })[] = [
  {
    id: 'c1',
    acheteur_id: 'u1',
    vendeur_id: 'u2',
    annonce_id: '1',
    dernier_message: 'Bonjour, est-ce que le téléphone est encore disponible ?',
    date_dernier_message: new Date(Date.now() - 300000).toISOString(),
    unread: 2,
    annonce: {
      id: '1', user_id: 'u2', titre: 'iPhone 15 Pro Max 256GB',
      description: '', prix: 650000, categorie: 'telephonie',
      etat_article: 'comme_neuf', statut: 'active', est_payee: true,
      ville: 'Bamako', date_creation: new Date().toISOString(),
      images: [{ id: 'i1', annonce_id: '1', image_url: 'https://picsum.photos/100/100?random=10', ordre: 0 }],
    },
  },
  {
    id: 'c2',
    acheteur_id: 'u3',
    vendeur_id: 'u1',
    annonce_id: '3',
    dernier_message: 'D\'accord, on peut se retrouver demain au marché ?',
    date_dernier_message: new Date(Date.now() - 3600000).toISOString(),
    unread: 0,
    annonce: {
      id: '3', user_id: 'u1', titre: 'Appartement 3 pièces - ACI 2000',
      description: '', prix: 350000, categorie: 'immobilier',
      etat_article: 'bon_etat', statut: 'active', est_payee: true,
      ville: 'Bamako', date_creation: new Date().toISOString(),
      images: [{ id: 'i3', annonce_id: '3', image_url: 'https://picsum.photos/100/100?random=11', ordre: 0 }],
    },
  },
  {
    id: 'c3',
    acheteur_id: 'u4',
    vendeur_id: 'u1',
    annonce_id: '5',
    dernier_message: 'C\'est mon dernier prix 700 000. Intéressé ?',
    date_dernier_message: new Date(Date.now() - 86400000).toISOString(),
    unread: 1,
    annonce: {
      id: '5', user_id: 'u1', titre: 'MacBook Air M2 2023',
      description: '', prix: 750000, categorie: 'electronique',
      etat_article: 'comme_neuf', statut: 'active', est_payee: true,
      ville: 'Sikasso', date_creation: new Date().toISOString(),
      images: [{ id: 'i5', annonce_id: '5', image_url: 'https://picsum.photos/100/100?random=12', ordre: 0 }],
    },
  },
];

function timeAgo(dateStr: string): string {
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
  const [conversations] = useState(DEMO_CONVERSATIONS);

  const renderConversation = ({ item }: { item: typeof DEMO_CONVERSATIONS[0] }) => {
    const imageUrl = item.annonce?.images?.[0]?.image_url || 'https://picsum.photos/100/100';
    const hasUnread = (item.unread ?? 0) > 0;

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
        <Image source={{ uri: imageUrl }} style={styles.conversationImage} />

        {/* Contenu */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationTop}>
            <Text style={[styles.conversationTitle, hasUnread && styles.textBold]} numberOfLines={1}>
              {item.annonce?.titre || 'Annonce'}
            </Text>
            <Text style={[styles.conversationTime, hasUnread && { color: COLORS.primary }]}>
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
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={56} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Pas encore de messages</Text>
            <Text style={styles.emptyText}>
              Contactez un vendeur pour commencer une conversation
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.extrabold,
    color: COLORS.textPrimary,
  },

  listContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.divider,
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
    // Subtle highlight
  },
  conversationImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
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
    color: COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  conversationTime: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  conversationBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationMessage: {
    flex: 1,
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginRight: SPACING.sm,
  },
  textBold: {
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: FONTS.bold,
    color: COLORS.textInverse,
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
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 250,
  },
});
