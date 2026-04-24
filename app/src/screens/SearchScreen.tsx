import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, CATEGORIES, SHADOWS } from '../constants/theme';
import { Annonce } from '../lib/supabase';
import { useAnnonces } from '../hooks/useAnnonces';
import { useLocation, getDistance, formatDistance } from '../hooks/useLocation';

const { width: W } = Dimensions.get('window');
const TILE_SIZE = (W - SPACING.lg * 2 - SPACING.md) / 2;

function formatPrix(prix: number): string {
  if (prix >= 1000000) return (prix / 1000000).toFixed(prix % 1000000 === 0 ? 0 : 1) + 'M FCFA';
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

// Couleur par catégorie
const CAT_COLORS: Record<string, string> = {
  telephonie:  '#2563eb',
  electronique:'#7c3aed',
  vehicules:   '#d97706',
  immobilier:  '#0891b2',
  nourriture:  '#dc2626',
  agriculture: '#65a30d',
  mode:        '#db2777',
  beaute:      '#c026d3',
  electromenager: '#0284c7',
  materiaux:   '#78350f',
  maison:      '#92400e',
  services:    '#15803d',
  loisirs:     '#ea580c',
  autres:      '#475569',
};

const CAT_EMOJIS: Record<string, string> = {
  telephonie:  '📱',
  electronique:'💻',
  vehicules:   '🚗',
  immobilier:  '🏠',
  nourriture:  '🍽️',
  agriculture: '🌾',
  mode:        '👕',
  beaute:      '💄',
  electromenager: '🏠',
  materiaux:   '🧱',
  maison:      '🛋️',
  services:    '🔧',
  loisirs:     '🎮',
  autres:      '📦',
};

interface Props {
  navigation: any;
}

export default function SearchScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { location } = useLocation();
  const inResultsMode = debouncedSearch.length > 0 || selectedCategory !== null;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { annonces, loading } = useAnnonces({
    categorie: selectedCategory,
    search: debouncedSearch || undefined,
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
  };

  // ---- Rendu carte résultat ----
  const renderResult = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    const dist =
      location && (item as any).latitude && (item as any).longitude
        ? getDistance(location.latitude, location.longitude, (item as any).latitude, (item as any).longitude)
        : null;

    return (
      <TouchableOpacity
        style={styles.resultCard}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={styles.resultImage} />
          : <View style={[styles.resultImage, { backgroundColor: COLORS.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={24} color={COLORS.border} />
            </View>
        }
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.resultPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.resultMeta}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.resultMetaText}>
              {item.quartier ? `${item.quartier}, ` : ''}{item.ville}
            </Text>
            {dist !== null && (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="navigate-outline" size={11} color={COLORS.primary} />
                <Text style={[styles.resultMetaText, { color: COLORS.primary }]}>
                  {formatDistance(dist)}
                </Text>
              </>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.borderLight} />
      </TouchableOpacity>
    );
  };

  // ---- Rendu tuile catégorie ----
  const renderCategoryTile = (cat: typeof CATEGORIES[0]) => {
    const color = CAT_COLORS[cat.id] || COLORS.primary;
    const emoji = CAT_EMOJIS[cat.id] || '📦';
    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.tile, { backgroundColor: color }]}
        activeOpacity={0.8}
        onPress={() => setSelectedCategory(cat.id)}
      >
        <Text style={styles.tileEmoji}>{emoji}</Text>
        <Text style={styles.tileLabel}>{cat.label}</Text>
      </TouchableOpacity>
    );
  };

  const activeCatLabel = selectedCategory
    ? CATEGORIES.find(c => c.id === selectedCategory)?.label
    : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>

        {/* Localisation */}
        {location && (
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={13} color={COLORS.primary} />
            <Text style={styles.locationText}>
              {location.quartier ? `${location.quartier}, ` : ''}{location.ville || 'Mali'}
            </Text>
          </View>
        )}

        {/* Barre de recherche */}
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeCatLabel ? `Rechercher dans ${activeCatLabel}…` : 'Que cherchez-vous ?'}
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Chip catégorie active */}
        {selectedCategory && (
          <View style={styles.activeFilter}>
            <View style={[styles.activeCatChip, { backgroundColor: CAT_COLORS[selectedCategory] + '22', borderColor: CAT_COLORS[selectedCategory] }]}>
              <Text style={[styles.activeCatText, { color: CAT_COLORS[selectedCategory] }]}>
                {CAT_EMOJIS[selectedCategory]} {activeCatLabel}
              </Text>
              <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                <Ionicons name="close" size={15} color={CAT_COLORS[selectedCategory]} />
              </TouchableOpacity>
            </View>
            {!inResultsMode || (
              <Text style={styles.resultCount}>
                {loading ? '…' : `${annonces.length} résultat${annonces.length !== 1 ? 's' : ''}`}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* MODE GRILLE CATÉGORIES */}
      {!inResultsMode ? (
        <ScrollView
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.browseTitle}>Parcourir par catégorie</Text>
          <View style={styles.grid}>
            {CATEGORIES.map(renderCategoryTile)}
          </View>

          {/* Annonces près de moi si GPS dispo */}
          {location && (
            <View style={styles.nearbySection}>
              <View style={styles.nearbySectionHeader}>
                <Ionicons name="navigate" size={16} color={COLORS.primary} />
                <Text style={styles.nearbyTitle}>Près de moi</Text>
              </View>
              <Text style={styles.nearbySubtitle}>
                {location.quartier || location.ville} · Toutes catégories
              </Text>
              <TouchableOpacity
                style={styles.nearbyBtn}
                onPress={() => setDebouncedSearch(' ')}
                activeOpacity={0.8}
              >
                <Text style={styles.nearbyBtnText}>Voir les annonces à proximité</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        /* MODE RÉSULTATS */
        loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={annonces}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              annonces.length > 0 ? (
                <Text style={styles.resultCount}>
                  {annonces.length} résultat{annonces.length !== 1 ? 's' : ''}
                  {activeCatLabel ? ` · ${activeCatLabel}` : ''}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="search" size={48} color={COLORS.border} />
                <Text style={styles.emptyTitle}>Aucun résultat</Text>
                <Text style={styles.emptyText}>
                  Essayez avec d'autres mots-clés ou une autre catégorie.
                </Text>
                <TouchableOpacity style={styles.emptyBackBtn} onPress={clearFilters}>
                  <Text style={styles.emptyBackText}>Retour aux catégories</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.extrabold,
    color: COLORS.textPrimary,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: FONTS.semibold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
    padding: 0,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  activeCatText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
  },
  resultCount: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.medium,
  },

  // Grille catégories
  gridContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  browseTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 0.65,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  tileEmoji: { fontSize: 28 },
  tileLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
  },

  // Nearby section
  nearbySection: {
    marginTop: SPACING.xxl,
    backgroundColor: COLORS.primaryFaded,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  nearbySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nearbyTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.primary,
  },
  nearbySubtitle: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
  },
  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    marginTop: SPACING.sm,
  },
  nearbyBtnText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
  },

  // Résultats
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultsList: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  resultImage: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
  },
  resultInfo: { flex: 1, marginLeft: SPACING.md, gap: 3 },
  resultTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  resultPrice: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: COLORS.primary,
  },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resultMetaText: { fontSize: FONTS.xs, color: COLORS.textMuted },
  dot: { fontSize: FONTS.xs, color: COLORS.textMuted, marginHorizontal: 1 },

  // Empty
  emptyContainer: { paddingVertical: 80, alignItems: 'center' },
  emptyTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  emptyBackBtn: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primaryFaded,
    borderRadius: RADIUS.lg,
  },
  emptyBackText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.primary,
  },
});
