import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES } from '../constants/theme';
import { Annonce } from '../lib/supabase';
import { useAnnonces } from '../hooks/useAnnonces';
import { useLocation, getDistance, formatDistance } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { useFavoris, toggleFavori } from '../hooks/useFavoris';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md) / 2;

function formatPrix(prix: number): string {
  if (prix >= 1000000) {
    return (prix / 1000000).toFixed(prix % 1000000 === 0 ? 0 : 1) + 'M FCFA';
  }
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return `${Math.floor(diff / 604800)}sem`;
}

interface Props {
  navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Debounce search query to avoid spamming Supabase
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { annonces, loading, error, refetch } = useAnnonces({
    categorie: selectedCategory,
    search: debouncedSearch,
  });
  const { location } = useLocation();
  const { session } = useAuth();
  const { favorisIds, refetch: refetchFavoris } = useFavoris(session?.user?.id);

  const handleToggleFavori = async (annonceId: string) => {
    if (!session) { navigation.navigate('Login'); return; }
    await toggleFavori(session.user.id, annonceId);
    refetchFavoris();
  };

  const renderCategoryItem = ({ item }: { item: typeof CATEGORIES[0] }) => {
    const isSelected = selectedCategory === item.id;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.categoryChip,
          isSelected && styles.categoryChipSelected,
        ]}
        onPress={() => setSelectedCategory(isSelected ? null : item.id)}
      >
        <Feather
          name={item.icon as any}
          size={16}
          color={isSelected ? COLORS.textInverse : COLORS.textSecondary}
        />
        <Text
          style={[
            styles.categoryLabel,
            isSelected && styles.categoryLabelSelected,
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderAnnonceCard = ({ item, index }: { item: Annonce; index: number }) => {
    const imageUrl = item.images?.[0]?.image_url || 'https://picsum.photos/400/400?random=99';
    const dist =
      location && (item as any).latitude && (item as any).longitude
        ? getDistance(location.latitude, location.longitude, (item as any).latitude, (item as any).longitude)
        : null;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          styles.card,
          { marginLeft: index % 2 === 0 ? 0 : SPACING.md },
        ]}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        {/* Image */}
        <View style={styles.cardImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.cardImage} />
          {/* Badge état */}
          {item.etat_article === 'neuf' && (
            <View style={styles.badgeNeuf}>
              <Text style={styles.badgeText}>NEUF</Text>
            </View>
          )}
          {/* Bouton favori */}
          <TouchableOpacity
            style={styles.favoriteButton}
            activeOpacity={0.7}
            onPress={() => handleToggleFavori(item.id)}
          >
            <Ionicons
              name={favorisIds.has(item.id) ? 'heart' : 'heart-outline'}
              size={18}
              color={favorisIds.has(item.id) ? '#ef4444' : COLORS.textInverse}
            />
          </TouchableOpacity>
        </View>

        {/* Infos */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.cardPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {(item as any).quartier || item.ville}
            </Text>
            {dist !== null && (
              <>
                <Text style={styles.cardMetaDot}>·</Text>
                <Text style={[styles.cardMetaText, { color: COLORS.primary }]}>
                  {formatDistance(dist)}
                </Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>⚡ Flash Market</Text>
          <Text style={styles.heroSubtitle}>Achetez & Vendez en un Flash</Text>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Que cherchez-vous ?"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Catégories */}
      <FlatList
        data={CATEGORIES}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      />

      {/* Section titre */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Annonces récentes</Text>
        <TouchableOpacity>
          <Text style={styles.sectionLink}>Voir tout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      {loading && annonces.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ fontSize: FONTS.sm, color: COLORS.textMuted }}>Chargement des annonces…</Text>
        </View>
      ) : error && annonces.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl, gap: 16 }}>
          <Feather name="wifi-off" size={48} color={COLORS.textMuted} />
          <Text style={{ fontSize: FONTS.md, fontWeight: FONTS.semibold, color: COLORS.textPrimary, textAlign: 'center' }}>
            Connexion impossible
          </Text>
          <Text style={{ fontSize: FONTS.sm, color: COLORS.textMuted, textAlign: 'center' }}>
            {error || 'Vérifiez votre connexion internet ou réessayez dans quelques instants.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: RADIUS.lg }}
            onPress={refetch}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontWeight: FONTS.bold, fontSize: FONTS.md }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={annonces}
          renderItem={renderAnnonceCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetch}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucune annonce trouvée</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },

  // Hero
  heroSection: {
    paddingTop: 60,
    paddingBottom: SPACING.xl,
  },
  heroContent: {},
  heroTitle: {
    fontSize: FONTS.xxxl,
    fontWeight: FONTS.extrabold,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },

  // Recherche
  searchContainer: {
    marginBottom: SPACING.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
    padding: 0,
  },

  // Catégories
  categoriesContainer: {
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.medium,
    color: COLORS.textSecondary,
  },
  categoryLabelSelected: {
    color: COLORS.textInverse,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  sectionLink: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.primary,
  },

  // Card annonce
  card: {
    width: CARD_WIDTH,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardImageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceMuted,
  },
  badgeNeuf: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: FONTS.bold,
    color: COLORS.textInverse,
    letterSpacing: 0.5,
  },
  favoriteButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    padding: SPACING.md,
  },
  cardTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  cardPrice: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardMetaText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  cardMetaDot: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginHorizontal: 2,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.section * 2,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
  },
});
