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
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, CATEGORIES, SUBCATEGORIES, getSousCategorieLabel, SHADOWS, ETAT_ARTICLE } from '../constants/theme';
import { scoreAnnonce, scoreUser } from '../lib/relevance';
import { supabase, Annonce, User } from '../lib/supabase';
import { useAnnonces } from '../hooks/useAnnonces';
import { useLocation, getDistance, formatDistance } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { Modal } from 'react-native';

const { width: W } = Dimensions.get('window');
const TILE_SIZE = (W - SPACING.lg * 2 - SPACING.md) / 2;

function formatPrix(prix: number): string {
  if (prix >= 1000000) return (prix / 1000000).toFixed(prix % 1000000 === 0 ? 0 : 1) + 'M FCFA';
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

// Couleur par catégorie
const CAT_COLORS: Record<string, string> = {
  telephonie_electronique: '#2563eb',
  mode_beaute:             '#db2777',
  maison_electromenager:   '#0284c7',
  voitures:                '#d97706',
  motos:                   '#ea580c',
  immobilier:              '#0891b2',
  alimentation:            '#dc2626',
  animaux:                 '#854d0e',
  services:                '#15803d',
};

const CAT_EMOJIS: Record<string, string> = {
  telephonie_electronique: '📱',
  mode_beaute:             '👕',
  maison_electromenager:   '🛋️',
  voitures:                '🚗',
  motos:                   '🏍️',
  immobilier:              '🏠',
  alimentation:            '🍽️',
  animaux:                 '🐾',
  services:                '🔧',
};

// Scoring de pertinence : voir src/lib/relevance.ts (scoreAnnonce / scoreUser),
// partagé avec l'écran d'accueil. Score 0 = résultat exclu (filtre strict).

function mergeResults(posts: any[], users: any[]): any[] {
  const merged: any[] = [];
  let postIndex = 0;
  let userIndex = 0;
  
  while (postIndex < posts.length || userIndex < users.length) {
    // Add up to 3 posts
    let postsAdded = 0;
    while (postsAdded < 3 && postIndex < posts.length) {
      merged.push(posts[postIndex]);
      postIndex++;
      postsAdded++;
    }
    
    // Add 1 user profile
    if (userIndex < users.length) {
      merged.push(users[userIndex]);
      userIndex++;
    }
  }
  
  return merged;
}

interface Props {
  navigation: any;
}

export default function SearchScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSousCategorie, setSelectedSousCategorie] = useState<string | null>(null);
  // Catégorie dont le panneau de sous-catégories (entonnoir) est ouvert
  const [subcatPickerCat, setSubcatPickerCat] = useState<string | null>(null);

  // Filtres avancés
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedEtat, setSelectedEtat] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  // Nouvelle recherche par pertinence
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { location } = useLocation();
  const inResultsMode = debouncedSearch.length > 0 || selectedCategory !== null;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch les annonces correspondant aux critères
  const { annonces, loading: loadingAnnonces } = useAnnonces({
    categorie: selectedCategory,
    sousCategorie: selectedSousCategorie,
    search: debouncedSearch || undefined,
    minPrice: minPrice ? parseInt(minPrice) : null,
    maxPrice: maxPrice ? parseInt(maxPrice) : null,
    etat: selectedEtat,
    orderBy: orderBy,
  });

  // Fetch les utilisateurs en parallèle quand une requête texte est présente
  useEffect(() => {
    const cleanSearch = debouncedSearch.trim();
    if (cleanSearch.length > 0) {
      setLoadingUsers(true);
      const fetchUsers = async () => {
        try {
          const { data, error } = await supabase.from('users').select('*');
          if (data) {
            setUsers(data as User[]);
          } else if (error) {
            console.error('Error fetching users for search:', error);
          }
        } catch (e) {
          console.error('Exception fetching users:', e);
        } finally {
          setLoadingUsers(false);
        }
      };
      fetchUsers();
    } else {
      setUsers([]);
    }
  }, [debouncedSearch]);

  // Calcul de la pertinence et entrelacement (Ratio 3/4 posts, 1/4 profils)
  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query) {
      setSearchResults(annonces.map(a => ({ ...a, isUserProfile: false })));
      return;
    }

    // 1. Noter les posts
    const scoredAnnonces = annonces
      .map(annonce => {
        const score = scoreAnnonce(query, annonce);
        return { ...annonce, isUserProfile: false, searchScore: score };
      })
      .filter(a => a.searchScore > 0);

    // 2. Noter les utilisateurs
    const scoredUsers = users
      .map(user => {
        const score = scoreUser(query, user);
        return { ...user, isUserProfile: true, searchScore: score };
      })
      .filter(u => u.searchScore > 0);

    // 3. Trier par pertinence décroissante
    scoredAnnonces.sort((a, b) => b.searchScore - a.searchScore);
    scoredUsers.sort((a, b) => b.searchScore - a.searchScore);

    // 4. Fusionner avec le ratio
    const merged = mergeResults(scoredAnnonces, scoredUsers);
    setSearchResults(merged);
  }, [annonces, users, debouncedSearch]);

  const loading = loadingAnnonces || loadingUsers;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedSousCategorie(null);
  };

  // ---- Rendu carte résultat ----
  const renderResult = ({ item }: { item: any }) => {
    if (item.isUserProfile) {
      const authorName = `${item.prenom || ''} ${item.nom || ''}`.trim() || 'Utilisateur';
      const isPro = item.type_compte === 'professionnel';
      
      return (
        <TouchableOpacity
          style={[styles.resultCard, styles.profileCardBorder]}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('VendeurProfile', { vendeurId: item.id })}
        >
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.resultImageProfile} />
          ) : (
            <View style={[styles.resultImageProfile, { backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 24, fontWeight: FONTS.bold, color: theme.primary }}>{authorName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.resultInfo}>
            <View style={styles.profileHeaderRow}>
              <Text style={styles.profileName} numberOfLines={1}>{authorName}</Text>
              {isPro ? (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              ) : (
                <View style={styles.particulierBadge}>
                  <Text style={styles.particulierBadgeText}>Particulier</Text>
                </View>
              )}
            </View>
            <Text style={styles.profileBio} numberOfLines={1}>{item.bio || 'Aucune description disponible.'}</Text>
            <View style={styles.resultMeta}>
              <Ionicons name="storefront-outline" size={12} color={theme.textMuted} />
              <Text style={styles.resultMetaText}>Voir la vitrine de l'utilisateur</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.primary} />
        </TouchableOpacity>
      );
    }

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
          : <View style={[styles.resultImage, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={24} color={theme.border} />
            </View>
        }
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.resultPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.resultMeta}>
            <Ionicons name="location-outline" size={12} color={theme.textMuted} />
            <Text style={styles.resultMetaText}>
              {item.quartier ? `${item.quartier}, ` : ''}{item.ville}
            </Text>
            {dist !== null && (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="navigate-outline" size={11} color={theme.primary} />
                <Text style={[styles.resultMetaText, { color: theme.primary }]}>
                  {formatDistance(dist)}
                </Text>
              </>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.borderLight} />
      </TouchableOpacity>
    );
  };

  // ---- Rendu tuile catégorie ----
  const renderCategoryTile = (cat: typeof CATEGORIES[0]) => {
    const color = CAT_COLORS[cat.id] || theme.primary;
    const emoji = CAT_EMOJIS[cat.id] || '📦';
    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.tile, { backgroundColor: color }]}
        activeOpacity={0.8}
        onPress={() => {
          // Entonnoir : si la catégorie a des sous-catégories, on propose
          // d'abord de préciser ; sinon on filtre directement.
          if (SUBCATEGORIES[cat.id]?.length > 0) {
            setSubcatPickerCat(cat.id);
          } else {
            setSelectedSousCategorie(null);
            setSelectedCategory(cat.id);
          }
        }}
      >
        <Text style={styles.tileEmoji}>{emoji}</Text>
        <Text style={styles.tileLabel}>{cat.label}</Text>
      </TouchableOpacity>
    );
  };

  const selectFromPicker = (categoryId: string, sousCategorieId: string | null) => {
    setSelectedCategory(categoryId);
    setSelectedSousCategorie(sousCategorieId);
    setSubcatPickerCat(null);
  };

  const activeCatLabel = selectedCategory
    ? CATEGORIES.find(c => c.id === selectedCategory)?.label
    : null;
  const activeSousCatLabel = getSousCategorieLabel(selectedSousCategorie);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>

        {/* Localisation */}
        {location && (
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={13} color={theme.primary} />
            <Text style={styles.locationText}>
              {location.quartier ? `${location.quartier}, ` : ''}{location.ville || 'Mali'}
            </Text>
          </View>
        )}

        {/* Barre de recherche */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={activeCatLabel ? `Rechercher dans ${activeCatLabel}…` : 'Que cherchez-vous ?'}
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterBtn, (minPrice || maxPrice || selectedEtat || orderBy !== 'newest') && styles.filterBtnActive]} 
            onPress={() => setShowFilters(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={22} color={(minPrice || maxPrice || selectedEtat || orderBy !== 'newest') ? '#fff' : theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Chip catégorie active */}
        {selectedCategory && (
          <View style={styles.activeFilter}>
            <View style={[styles.activeCatChip, { backgroundColor: CAT_COLORS[selectedCategory] + '22', borderColor: CAT_COLORS[selectedCategory] }]}>
              <Text style={[styles.activeCatText, { color: CAT_COLORS[selectedCategory] }]}>
                {CAT_EMOJIS[selectedCategory]} {activeCatLabel}{activeSousCatLabel ? ` · ${activeSousCatLabel}` : ''}
              </Text>
              <TouchableOpacity onPress={() => { setSelectedCategory(null); setSelectedSousCategorie(null); }}>
                <Ionicons name="close" size={15} color={CAT_COLORS[selectedCategory]} />
              </TouchableOpacity>
            </View>
            {!inResultsMode || (
              <Text style={styles.resultCount}>
                {loading ? '…' : `${searchResults.length} résultat${searchResults.length !== 1 ? 's' : ''}`}
              </Text>
            )}
          </View>
        )}

        {/* Chips de sous-catégories pour affiner dans les résultats */}
        {selectedCategory && SUBCATEGORIES[selectedCategory]?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subcatRow}>
            <TouchableOpacity
              style={[styles.subcatChip, !selectedSousCategorie && styles.subcatChipSelected]}
              onPress={() => setSelectedSousCategorie(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subcatChipText, !selectedSousCategorie && styles.subcatChipTextSelected]}>Tout</Text>
            </TouchableOpacity>
            {SUBCATEGORIES[selectedCategory].map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subcatChip, selectedSousCategorie === sub.id && styles.subcatChipSelected]}
                onPress={() => setSelectedSousCategorie(selectedSousCategorie === sub.id ? null : sub.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.subcatChipText, selectedSousCategorie === sub.id && styles.subcatChipTextSelected]}>
                  {sub.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
                <Ionicons name="navigate" size={16} color={theme.primary} />
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
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              searchResults.length > 0 ? (
                <Text style={styles.resultCount}>
                  {searchResults.length} résultat{searchResults.length !== 1 ? 's' : ''}
                  {activeCatLabel ? ` · ${activeCatLabel}` : ''}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="search" size={48} color={theme.border} />
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

      {/* Modal Filtres */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filtres</Text>
            <TouchableOpacity onPress={() => {
              setMinPrice('');
              setMaxPrice('');
              setSelectedEtat(null);
              setOrderBy('newest');
            }}>
              <Text style={styles.modalReset}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Prix */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Prix (FCFA)</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={minPrice}
                  onChangeText={setMinPrice}
                />
                <View style={styles.priceSeparator} />
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                />
              </View>
            </View>

            {/* État */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>État de l'article</Text>
              <View style={styles.chipRow}>
                {ETAT_ARTICLE.map(etat => (
                  <TouchableOpacity
                    key={etat.id}
                    style={[styles.chip, selectedEtat === etat.id && styles.chipSelected]}
                    onPress={() => setSelectedEtat(selectedEtat === etat.id ? null : etat.id)}
                  >
                    <Text style={[styles.chipText, selectedEtat === etat.id && styles.chipTextSelected]}>
                      {etat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Tri */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Trier par</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, orderBy === 'newest' && styles.chipSelected]}
                  onPress={() => setOrderBy('newest')}
                >
                  <Text style={[styles.chipText, orderBy === 'newest' && styles.chipTextSelected]}>Plus récent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, orderBy === 'price_asc' && styles.chipSelected]}
                  onPress={() => setOrderBy('price_asc')}
                >
                  <Text style={[styles.chipText, orderBy === 'price_asc' && styles.chipTextSelected]}>Prix croissant</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, orderBy === 'price_desc' && styles.chipSelected]}
                  onPress={() => setOrderBy('price_desc')}
                >
                  <Text style={[styles.chipText, orderBy === 'price_desc' && styles.chipTextSelected]}>Prix décroissant</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyBtnText}>Appliquer les filtres</Text>
            </TouchableOpacity>
            
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Bottom sheet entonnoir : sous-catégories de la catégorie tapée */}
      <Modal
        visible={subcatPickerCat !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSubcatPickerCat(null)}
      >
        <View style={styles.sheetContainer}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSubcatPickerCat(null)} />
          {subcatPickerCat && (
            <View style={styles.sheetContent}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {CAT_EMOJIS[subcatPickerCat]} {CATEGORIES.find(c => c.id === subcatPickerCat)?.label}
                </Text>
                <TouchableOpacity onPress={() => setSubcatPickerCat(null)}>
                  <Ionicons name="close-circle" size={26} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={() => selectFromPicker(subcatPickerCat, null)}
                >
                  <Text style={[styles.sheetRowText, { fontWeight: FONTS.bold, color: theme.primary }]}>
                    Tout voir dans cette catégorie
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.primary} />
                </TouchableOpacity>
                {SUBCATEGORIES[subcatPickerCat]?.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={styles.sheetRow}
                    activeOpacity={0.7}
                    onPress={() => selectFromPicker(subcatPickerCat, sub.id)}
                  >
                    <Text style={styles.sheetRowText}>{sub.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.borderLight} />
                  </TouchableOpacity>
                ))}
                <View style={{ height: 30 }} />
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.extrabold,
    color: theme.textPrimary,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: FONTS.xs,
    color: theme.primary,
    fontWeight: FONTS.semibold,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: theme.borderLight,
    gap: SPACING.sm,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.md,
    color: theme.textPrimary,
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
    color: theme.textMuted,
    fontWeight: FONTS.medium,
  },

  // Chips de sous-catégories (affinage dans les résultats)
  subcatRow: {
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  subcatChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  subcatChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  subcatChipText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.medium,
    color: theme.textSecondary,
  },
  subcatChipTextSelected: {
    color: '#fff',
  },

  // Bottom sheet sous-catégories (entonnoir)
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '75%',
    ...SHADOWS.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.borderLight,
    marginBottom: SPACING.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sheetTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  sheetRowText: {
    fontSize: FONTS.md,
    color: theme.textPrimary,
  },

  // Grille catégories
  gridContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  browseTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: theme.textSecondary,
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
    backgroundColor: isDark ? theme.surface : theme.primaryFaded,
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
    color: theme.primary,
  },
  nearbySubtitle: {
    fontSize: FONTS.sm,
    color: theme.textSecondary,
  },
  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: theme.primary,
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
    backgroundColor: theme.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  resultImage: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.md,
    backgroundColor: theme.surfaceMuted,
  },
  resultInfo: { flex: 1, marginLeft: SPACING.md, gap: 3 },
  resultTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
  },
  resultPrice: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.primary,
  },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resultMetaText: { fontSize: FONTS.xs, color: theme.textMuted },
  dot: { fontSize: FONTS.xs, color: theme.textMuted, marginHorizontal: 1 },
  profileCardBorder: {
    borderColor: theme.primary + '33',
    borderWidth: 1,
  },
  resultImageProfile: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.full,
    backgroundColor: theme.surfaceMuted,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-start',
  },
  profileName: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
    flexShrink: 1,
  },
  proBadge: {
    backgroundColor: theme.primaryFaded,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    color: theme.primary,
    fontSize: 9,
    fontWeight: 'bold',
  },
  particulierBadge: {
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  particulierBadgeText: {
    color: theme.textMuted,
    fontSize: 9,
    fontWeight: 'semibold',
  },
  profileBio: {
    color: theme.textMuted,
    fontSize: FONTS.sm,
    marginTop: 2,
    marginBottom: 4,
  },

  // Empty
  emptyContainer: { paddingVertical: 80, alignItems: 'center' },
  emptyTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  emptyBackBtn: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    backgroundColor: theme.primaryFaded,
    borderRadius: RADIUS.lg,
  },
  emptyBackText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.primary,
  },

  // Modal Filtres
  modal: { flex: 1, backgroundColor: theme.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  modalReset: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.error },
  modalBody: { padding: SPACING.xl },
  filterSection: { marginBottom: SPACING.xxl },
  filterLabel: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textSecondary, textTransform: 'uppercase', marginBottom: SPACING.lg },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  priceInput: {
    flex: 1,
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: FONTS.md,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  priceSeparator: { width: 10, height: 1, backgroundColor: theme.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  chipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: { fontSize: FONTS.sm, color: theme.textSecondary, fontWeight: FONTS.medium },
  chipTextSelected: { color: '#fff' },
  applyBtn: {
    backgroundColor: theme.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: SPACING.xl,
    ...SHADOWS.colored,
  },
  applyBtnText: { color: '#fff', fontSize: FONTS.md, fontWeight: FONTS.bold },
});
