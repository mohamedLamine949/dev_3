import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import Gradient from '../components/Gradient';
import { FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES, SUBCATEGORIES, TYPOGRAPHY } from '../constants/theme';
import { useAnnonces, ANNONCES_PAGE_SIZE } from '../hooks/useAnnonces';
import { Annonce } from '../lib/supabase';
import { useLocation, getDistance, formatDistance } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { useProStatus, estPro } from '../hooks/useProStatus';
import { useFavoris, toggleFavori } from '../hooks/useFavoris';
import { getRecentAnnonces } from '../lib/recentStorage';
import { SkeletonCard, SkeletonCategories } from '../components/SkeletonLoader';
import { useDecouverteProPreview } from '../hooks/useDecouvertePro';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md) / 2;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────


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

import { hapticLight, hapticMedium } from '../lib/haptics';
import { formatPrixCompact as formatPrix } from '../lib/format';
import { diversifierParVendeur } from '../lib/feed';
import EtatEcran from '../components/EtatEcran';

// Couleur de fond pour les cercles catégorie
const CAT_CIRCLE_COLORS: Record<string, string> = {
  telephonie_electronique: '#3B82F6',
  mode_beaute:             '#EC4899',
  maison_electromenager:   '#06B6D4',
  voitures:                '#F59E0B',
  motos:                   '#F97316',
  immobilier:              '#8B5CF6',
  alimentation:            '#EF4444',
  animaux:                 '#A16207',
  services:                '#059669',
};

// ─────────────────────────────────────────────
// Animated Card Wrapper
// ─────────────────────────────────────────────

function PressableCard({ children, style, onPress }: { children: React.ReactNode; style?: any; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    hapticLight();
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Animated Favorite Button
// ─────────────────────────────────────────────

function FavoriteButton({ isFavorite, onPress }: { isFavorite: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { theme } = useTheme();

  const handlePress = () => {
    hapticMedium();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={favStyles.button}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={18}
          color={isFavorite ? '#EF4444' : '#FFFFFF'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const favStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

interface Props {
  navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSousCategorie, setSelectedSousCategorie] = useState<string | null>(null);

  // Debounce search query to avoid spamming Supabase
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { annonces, loading, loadingMore, hasMore, error, refetch, loadMore } = useAnnonces({
    categorie: selectedCategory,
    sousCategorie: selectedSousCategorie,
    search: debouncedSearch,
    // Le fil chargeait toutes les annonces actives d'un coup : on charge par
    // paquets de 20, la suite arrive au scroll.
    pageSize: ANNONCES_PAGE_SIZE,
  });
  const { location } = useLocation();
  const { session, user } = useAuth();
  const { favorisIds, refetch: refetchFavoris } = useFavoris(session?.user?.id);
  const { shops: proShops, total: proTotal } = useDecouverteProPreview();
  // Badge PRO valide par le serveur : un abonnement expire ne le porte plus (§11.7).
  const { proIds } = useProStatus();

  // §7.1 : pas plus de deux annonces du meme vendeur dans les vingt premieres
  // cartes. Les suivantes sont repoussees plus bas, jamais supprimees.
  const filAffiche = React.useMemo(() => diversifierParVendeur(annonces), [annonces]);
  const [recentAnnonces, setRecentAnnonces] = useState<Annonce[]>([]);

  const loadRecent = useCallback(async () => {
    const list = await getRecentAnnonces();
    setRecentAnnonces(list);
  }, []);

  useEffect(() => {
    loadRecent();
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecent();
    });
    return unsubscribe;
  }, [navigation, loadRecent]);

  const handleToggleFavori = async (annonceId: string) => {
    if (!session) { navigation.navigate('Login'); return; }
    await toggleFavori(session.user.id, annonceId);
    refetchFavoris();
  };

  // ─────────────────────────────────────────────
  // Render: Category Circles
  // ─────────────────────────────────────────────

  const renderCategoryCircle = ({ item }: { item: typeof CATEGORIES[0] }) => {
    const isSelected = selectedCategory === item.id;
    const circleColor = CAT_CIRCLE_COLORS[item.id] || theme.primary;
    // Raccourcir le label pour les cercles
    const shortLabel = item.label.split(' & ')[0].split(' ')[0];

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.categoryCircleWrapper}
        onPress={() => {
          setSelectedSousCategorie(null);
          setSelectedCategory(isSelected ? null : item.id);
        }}
      >
        <View
          style={[
            styles.categoryCircle,
            {
              backgroundColor: isSelected ? circleColor : (isDark ? theme.surfaceElevated : theme.surfaceMuted),
              borderColor: isSelected ? circleColor : 'transparent',
            },
          ]}
        >
          <Ionicons
            name={item.icon as any}
            size={22}
            color={isSelected ? '#FFFFFF' : circleColor}
          />
        </View>
        <Text
          style={[
            styles.categoryCircleLabel,
            { color: isSelected ? theme.textPrimary : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {shortLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────
  // Render: Annonce Card (Premium)
  // ─────────────────────────────────────────────

  const renderAnnonceCard = ({ item, index }: { item: Annonce; index: number }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    const dist =
      location && (item as any).latitude && (item as any).longitude
        ? getDistance(location.latitude, location.longitude, (item as any).latitude, (item as any).longitude)
        : null;

    return (
      <PressableCard
        style={[
          styles.card,
          { marginLeft: index % 2 === 0 ? 0 : SPACING.md },
        ]}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        {/* Image */}
        <View style={styles.cardImageContainer}>
          {imageUrl
            ? <Image source={{ uri: imageUrl }} style={styles.cardImage} />
            : <View style={[styles.cardImage, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={32} color={theme.border} />
              </View>
          }
          {/* Badges : PRO + NEUF */}
          <View style={styles.badgeStack}>
            {estPro((item as any).user, proIds) && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark-circle" size={10} color="#fff" style={{ marginRight: 2 }} />
                <Text style={styles.badgeText}>PRO</Text>
              </View>
            )}
            {item.etat_article === 'neuf' && (
              <View style={[styles.badge, { backgroundColor: theme.secondary }]}>
                <Text style={styles.badgeText}>NEUF</Text>
              </View>
            )}
          </View>
          {/* Bouton favori animé */}
          <FavoriteButton
            isFavorite={favorisIds.has(item.id)}
            onPress={() => handleToggleFavori(item.id)}
          />
        </View>

        {/* Infos */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.cardPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={11} color={theme.textMuted} />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {(item as any).quartier || item.ville}
            </Text>
            {dist !== null && (
              <>
                <Text style={styles.cardMetaDot}>·</Text>
                <Text style={[styles.cardMetaText, { color: theme.primary }]}>
                  {formatDistance(dist)}
                </Text>
              </>
            )}
          </View>
        </View>
      </PressableCard>
    );
  };

  // ─────────────────────────────────────────────
  // Render: Recent Card
  // ─────────────────────────────────────────────

  const renderRecentCard = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    return (
      <PressableCard
        style={styles.recentCard}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <View style={styles.recentImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.recentImage} />
          ) : (
            <View style={styles.recentImagePlaceholder}>
              <Ionicons name="image-outline" size={24} color={theme.border} />
            </View>
          )}
        </View>
        <Text style={styles.recentCardTitle} numberOfLines={1}>
          {item.titre}
        </Text>
        <Text style={styles.recentCardPrice} numberOfLines={1}>
          {formatPrix(item.prix)}
        </Text>
      </PressableCard>
    );
  };

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  // Place reservee sous la tab bar flottante (variable selon la zone sure iOS).
  const tabBarSpace = useTabBarSpace();

  // ─────────────────────────────────────────────
  // Skeleton Loading
  // ─────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {/* Header skeleton */}
      <View style={[styles.heroSection, { gap: SPACING.lg }]}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1, gap: SPACING.sm }}>
            <View style={{ width: 180, height: 24, borderRadius: RADIUS.sm, backgroundColor: theme.surfaceMuted }} />
            <View style={{ width: 220, height: 14, borderRadius: RADIUS.xs, backgroundColor: theme.surfaceMuted }} />
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surfaceMuted }} />
        </View>
      </View>
      {/* Search skeleton */}
      <View style={{ height: 50, borderRadius: RADIUS.lg, backgroundColor: theme.surfaceMuted, marginBottom: SPACING.lg }} />
      {/* Categories skeleton */}
      <SkeletonCategories />
      {/* Cards skeleton */}
      <View style={{ flexDirection: 'row', gap: SPACING.md }}>
        <SkeletonCard cardWidth={CARD_WIDTH} />
        <SkeletonCard cardWidth={CARD_WIDTH} />
      </View>
      <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg }}>
        <SkeletonCard cardWidth={CARD_WIDTH} />
        <SkeletonCard cardWidth={CARD_WIDTH} />
      </View>
    </View>
  );

  // ─────────────────────────────────────────────
  // List Header
  // ─────────────────────────────────────────────

  // Rendu comme ÉLÉMENT (et non comme composant inline) : un composant défini
  // ici serait recréé à chaque frappe dans la barre de recherche, ce qui
  // démonterait le TextInput et fermerait le clavier.
  const welcomeText = user?.prenom ? `Salut, ${user.prenom} ! 👋` : "Bienvenue ! 👋";
  const listHeader = (
      <View>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroWelcome}>{welcomeText}</Text>
              <Text style={styles.heroSubtitle}>Que cherchez-vous aujourd'hui ?</Text>
            </View>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile')}
              style={styles.profileIndicator}
            >
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.profileAvatar} />
              ) : (
                <View style={styles.profileAvatarPlaceholder}>
                  <Ionicons name="person" size={20} color={theme.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Feather name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Que cherchez-vous ?"
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Catégories en cercles */}
        <FlatList
          data={CATEGORIES}
          renderItem={renderCategoryCircle}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        />

        {/* Sous-catégories de la catégorie sélectionnée */}
        {selectedCategory && SUBCATEGORIES[selectedCategory]?.length > 0 && (
          <FlatList
            data={[{ id: '__tout__', label: 'Tout' }, ...SUBCATEGORIES[selectedCategory]]}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcategoriesContainer}
            renderItem={({ item }) => {
              const isTout = item.id === '__tout__';
              const isSelected = isTout ? selectedSousCategorie === null : selectedSousCategorie === item.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.subcategoryChip, isSelected && styles.subcategoryChipSelected]}
                  onPress={() => setSelectedSousCategorie(isTout ? null : (isSelected ? null : item.id))}
                >
                  <Text style={[styles.subcategoryLabel, isSelected && styles.subcategoryLabelSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Découverte Pro : point d'entrée vers l'annuaire des boutiques PRO */}
        <View style={styles.bannerContainer}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('DecouvertePro')}>
            <Gradient
              colors={['#0b4023', '#15803d', '#1f9450']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proCta}
            >
              <View style={styles.proCtaTop}>
                <View style={styles.proCtaIcon}>
                  <Ionicons name="storefront" size={19} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.proCtaTitle}>Découvrez nos professionnels</Text>
                  <Text style={styles.proCtaSubtitle}>
                    Boutiques, restaurants, agences, prestataires — le bon pro près de chez vous.
                  </Text>
                </View>
              </View>
              <View style={styles.proCtaFacesRow}>
                {proShops.slice(0, 3).map((s, i) => (
                  <View key={s.id} style={[styles.proCtaFace, i > 0 && { marginLeft: -8 }]}>
                    {s.avatar_url ? (
                      <Image source={{ uri: s.avatar_url }} style={styles.proCtaFaceImg} />
                    ) : (
                      <Text style={styles.proCtaFaceInitial}>
                        {(s.nom_boutique || s.prenom || '?').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                ))}
                {proTotal > 0 && (
                  <Text style={styles.proCtaCount}>{proTotal} boutique{proTotal !== 1 ? 's' : ''}</Text>
                )}
                <View style={styles.proCtaExplore}>
                  <Text style={styles.proCtaExploreText}>Explorer</Text>
                  <Ionicons name="arrow-forward" size={13} color="#fff" />
                </View>
              </View>
            </Gradient>
          </TouchableOpacity>
        </View>

        {/* Récemment consultés */}
        {/* §7.1 : une seule carte laisse un grand vide — on n'affiche la
            section qu'a partir de deux elements. */}
        {recentAnnonces.length >= 2 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Récemment consultés</Text>
              <TouchableOpacity onPress={async () => {
                const { clearRecentAnnonces } = await import('../lib/recentStorage');
                await clearRecentAnnonces();
                loadRecent();
              }}>
                <Text style={styles.clearRecentLink}>Effacer</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recentAnnonces}
              renderItem={renderRecentCard}
              keyExtractor={(item) => `recent-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentListContainer}
            />
          </View>
        )}

        {/* Section titre */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Annonces récentes</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Voir tout</Text>
          </TouchableOpacity>
        </View>
      </View>
  );

  // ─────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      {loading && annonces.length === 0 ? (
        renderSkeleton()
      ) : error && annonces.length === 0 ? (
        <EtatEcran
          variante="hors_ligne"
          message={error || undefined}
          onAction={refetch}
        />
      ) : (
        <FlatList
          data={filAffiche}
          renderItem={renderAnnonceCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContainer, { paddingBottom: tabBarSpace + SPACING.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          // Fenêtre de rendu resserrée : par défaut la FlatList monte
          // plusieurs écrans de cartes d'avance, donc autant d'images
          // téléchargées avant même d'être vues.
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : !hasMore && annonces.length > 0 ? (
              <Text style={styles.footerEndText}>Vous avez tout vu</Text>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetch}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            /* §7.10 : un etat vide propose toujours une action realiste.
               « Modifiez vos criteres » n'en est pas une quand il n'y a
               aucun critere : c'est une impasse. */
            selectedCategory ? (
              <EtatEcran
                variante="vide"
                titre="Rien dans cette catégorie"
                message="Personne n'a encore publié ici. Revenez bientôt, ou regardez les autres catégories."
                actionLabel="Voir toutes les annonces"
                onAction={() => { setSelectedCategory(null); setSelectedSousCategorie(null); }}
              />
            ) : (
              <EtatEcran
                variante="vide"
                icone="storefront-outline"
                titre="Le marché est encore vide"
                message="Soyez le premier à publier : votre annonce sera vue par tous les visiteurs."
                actionLabel="Publier une annonce"
                onAction={() => navigation.navigate('Publier')}
              />
            )
          }
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// 🎨 Styles
// ─────────────────────────────────────────────

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  footerLoader: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  footerEndText: {
    paddingVertical: SPACING.xl,
    textAlign: 'center',
    fontSize: FONTS.sm,
    color: theme.textMuted,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    // paddingBottom ajoute a l'usage : hauteur reelle de la tab bar flottante
  },

  // Hero
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: SPACING.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroWelcome: {
    ...TYPOGRAPHY.h1,
    color: theme.textPrimary,
  },
  heroSubtitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.regular,
    color: theme.textSecondary,
    marginTop: 4,
  },
  profileIndicator: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: theme.primary,
    ...SHADOWS.sm,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  profileAvatarPlaceholder: {
    flex: 1,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Recherche
  searchContainer: {
    marginBottom: SPACING.xl,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.md,
    color: theme.textPrimary,
    padding: 0,
  },

  // Catégories — cercles colorés
  categoriesContainer: {
    paddingBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  categoryCircleWrapper: {
    alignItems: 'center',
    width: 64,
  },
  categoryCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: SPACING.xs,
  },
  categoryCircleLabel: {
    fontSize: 10,
    fontWeight: FONTS.semibold,
    textAlign: 'center',
  },

  // Sous-catégories
  subcategoriesContainer: {
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  subcategoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 1,
    borderRadius: RADIUS.full,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  subcategoryChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  subcategoryLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.medium,
    color: theme.textSecondary,
  },
  subcategoryLabelSelected: {
    color: theme.textInverse,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
  },
  sectionLink: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.primary,
  },

  // Card annonce — premium
  card: {
    width: CARD_WIDTH,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    overflow: 'hidden',
    borderWidth: isDark ? 1 : 0,
    borderColor: theme.borderLight,
    ...SHADOWS.md,
  },
  cardImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.85,  // Aspect ratio 4:3ish — plus de contenu visible
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceMuted,
  },
  badgeStack: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: FONTS.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardInfo: {
    padding: SPACING.md,
    gap: 3,
  },
  cardTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    lineHeight: 18,
  },
  cardPrice: {
    ...TYPOGRAPHY.price,
    fontSize: FONTS.md,
    color: theme.primary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  cardMetaText: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
  },
  imagePlaceholder: {
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMetaDot: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginHorizontal: 2,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.section * 1.5,
    gap: SPACING.md,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
  },
  emptySubtitle: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  errorTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
    ...SHADOWS.colored,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: FONTS.bold,
    fontSize: FONTS.md,
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },

  // Bannière
  bannerContainer: {
    marginBottom: SPACING.xl,
  },
  proCta: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.colored,
  },
  proCtaTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  proCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proCtaTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.extrabold,
    color: '#fff',
    marginBottom: 3,
  },
  proCtaSubtitle: {
    fontSize: FONTS.xs,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
  },
  proCtaFacesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  proCtaFace: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#0b4023',
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  proCtaFaceImg: { width: '100%', height: '100%' },
  proCtaFaceInitial: { fontSize: 10, fontWeight: FONTS.bold, color: '#0b4023' },
  proCtaCount: {
    fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: 'rgba(255,255,255,0.85)',
    marginLeft: SPACING.sm,
  },
  proCtaExplore: {
    marginLeft: 'auto',
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  proCtaExploreText: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: '#fff' },

  // Récemment vus
  recentSection: {
    marginBottom: SPACING.xl,
  },
  clearRecentLink: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: theme.textMuted,
  },
  recentListContainer: {
    gap: SPACING.md,
    paddingRight: SPACING.lg,
  },
  recentCard: {
    width: 140,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.borderLight,
    paddingBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  recentImageContainer: {
    width: '100%',
    height: 95,
  },
  recentImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceMuted,
  },
  recentImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentCardTitle: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.sm,
  },
  recentCardPrice: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: theme.primary,
    marginTop: 2,
    marginHorizontal: SPACING.sm,
  },
});
