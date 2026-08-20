import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Modal,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, CATEGORIES, SUBCATEGORIES, getSousCategorieLabel, ETAT_ARTICLE } from '../constants/theme';
import { scoreAnnonce, scoreUser, filterByRelevance, relevanceTier } from '../lib/relevance';
import { supabase, Annonce, User } from '../lib/supabase';
import { useAnnonces } from '../hooks/useAnnonces';
import { useFavoris, toggleFavori } from '../hooks/useFavoris';
import { useLocation, getDistance, formatDistance } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { useProStatus, estPro } from '../hooks/useProStatus';
import { SkeletonCard } from '../components/SkeletonLoader';
import { formatPrixCompact as formatPrix } from '../lib/format';

const { width: W } = Dimensions.get('window');
const TILE_SIZE = (W - SPACING.lg * 2 - SPACING.md) / 2;
const CARD_WIDTH = (W - SPACING.lg * 2 - SPACING.md) / 2;


const CAT_COLORS: Record<string, string> = {
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

// L'entrelacement d'un profil vendeur toutes les trois annonces a ete retire :
// il fragmentait la comparaison des offres, que l'acheteur fait justement en
// balayant la grille (§7.3). Les vendeurs correspondants vivent desormais dans
// un rail horizontal au-dessus des resultats.

interface Props {
  navigation: any;
}

export default function SearchScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSousCategorie, setSelectedSousCategorie] = useState<string | null>(null);
  const [subcatPickerCat, setSubcatPickerCat] = useState<string | null>(null);

  // Filtres avancés
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedEtat, setSelectedEtat] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  // Filtre « qui vend » (§7.3, §7.4) : repond a une intention acheteur reelle
  // (« je veux du neuf, pas de l'occasion entre particuliers ») et donne au
  // professionnel une surface legitime, sans toucher a la pertinence.
  const [typeVendeur, setTypeVendeur] = useState<'tous' | 'particulier' | 'professionnel'>('tous');

  // Recherche par pertinence
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [vendeursTrouves, setVendeursTrouves] = useState<any[]>([]);
  // Niveau de correspondance des résultats : sert à prévenir l'utilisateur
  // quand on n'a pas trouvé son mot exact et qu'on propose des approchants.
  const [searchTier, setSearchTier] = useState<'exact' | 'partial' | 'weak' | 'none'>('exact');

  const { location } = useLocation();
  const { session } = useAuth();
  const { favorisIds, refetch: refetchFavoris } = useFavoris(session?.user?.id);
  // Statut PRO valide par le serveur : un abonnement expire ne doit plus
  // beneficier du bonus de recherche ni du carrousel boutiques (§11.7).
  const { proIds } = useProStatus();
  const inResultsMode = debouncedSearch.length > 0 || selectedCategory !== null;

  const handleToggleFavori = async (annonceId: string) => {
    if (!session) { navigation.navigate('Login'); return; }
    await toggleFavori(session.user.id, annonceId);
    refetchFavoris();
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { annonces, loading: loadingAnnonces } = useAnnonces({
    categorie: selectedCategory,
    sousCategorie: selectedSousCategorie,
    search: debouncedSearch || undefined,
    minPrice: minPrice ? parseInt(minPrice) : null,
    maxPrice: maxPrice ? parseInt(maxPrice) : null,
    etat: selectedEtat,
    orderBy: orderBy,
  });

  useEffect(() => {
    const cleanSearch = debouncedSearch.trim();
    if (cleanSearch.length > 0 || selectedCategory) {
      setLoadingUsers(true);
      const fetchUsers = async () => {
        try {
          // Colonnes strictement nécessaires au scoring et à la carte vendeur
          // (un `select('*')` sur tous les utilisateurs à chaque frappe pesait
          // lourd en egress pour rien).
          const { data, error } = await supabase
            .from('users')
            .select('id, prenom, nom, nom_boutique, bio, avatar_url, type_compte, categorie_metier');
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
  }, [debouncedSearch, selectedCategory]);

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query) {
      setSearchTier('exact');
      setVendeursTrouves([]);
      setSearchResults(annonces.map(a => ({ ...a, isUserProfile: false })));
      return;
    }

    const proIdsEffectifs = new Set(users.filter(u => estPro(u, proIds)).map(u => u.id));
    // Le bonus PRO s'ajoute au score, il ne le multiplie pas : sinon il
    // franchissait les paliers de pertinence et faisait remonter une annonce
    // approximative d'un PRO au-dessus d'une correspondance exacte.
    const scoredAnnonces = filterByRelevance(
      annonces.map(annonce => ({
        ...annonce,
        isUserProfile: false,
        searchScore: scoreAnnonce(query, annonce) + (proIdsEffectifs.has(annonce.user_id) ? 3 : 0),
      }))
    );

    const scoredUsers = filterByRelevance(
      users.map(user => ({ ...user, isUserProfile: true, searchScore: scoreUser(query, user) }))
    );

    setSearchTier(relevanceTier(scoredAnnonces));
    setVendeursTrouves(scoredUsers);
    setSearchResults(scoredAnnonces);
  }, [annonces, users, debouncedSearch, proIds]);

  const loading = loadingAnnonces || loadingUsers;

  const boutiquesMatch = React.useMemo(() => {
    if (users.length === 0) return [] as (User & { nbProduits: number })[];
    const counts: Record<string, number> = {};
    searchResults.forEach((r: any) => {
      if (!r.isUserProfile && r.user_id) counts[r.user_id] = (counts[r.user_id] || 0) + 1;
    });
    return users
      .filter(u => estPro(u, proIds) && counts[u.id])
      .map(u => ({ ...u, nbProduits: counts[u.id] }))
      .sort((a, b) => b.nbProduits - a.nbProduits)
      .slice(0, 8);
  }, [users, searchResults, proIds]);

  // Rail « Professionnels correspondants » (§7.3) : les boutiques dont des
  // produits matchent, plus les vendeurs dont le NOM matche, dedoublonnes.
  const vendeursRail = React.useMemo(() => {
    const vus = new Set<string>();
    const rail: any[] = [];
    for (const b of boutiquesMatch) {
      if (vus.has(b.id)) continue;
      vus.add(b.id);
      rail.push(b);
    }
    for (const u of vendeursTrouves) {
      if (vus.has(u.id)) continue;
      vus.add(u.id);
      rail.push({ ...u, nbProduits: 0 });
    }
    return rail.slice(0, 10);
  }, [boutiquesMatch, vendeursTrouves]);

  // Filtre « qui vend » applique apres le scoring : il restreint, il ne
  // reclasse pas. La pertinence reste intacte (§7.3).
  const resultatsAffiches = React.useMemo(() => {
    if (typeVendeur === 'tous') return searchResults;
    return searchResults.filter((r: any) => {
      const pro = estPro(r.user, proIds);
      return typeVendeur === 'professionnel' ? pro : !pro;
    });
  }, [searchResults, typeVendeur, proIds]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedSousCategorie(null);
    setTypeVendeur('tous');
    setSelectedEtat(null);
    setMinPrice('');
    setMaxPrice('');
    setOrderBy('newest');
  };

  const renderResult = ({ item, index }: { item: any; index: number }) => {
    const marginStyle = { marginLeft: index % 2 === 0 ? 0 : SPACING.md };

    if (item.isUserProfile) {
      const authorName = `${item.prenom || ''} ${item.nom || ''}`.trim() || 'Utilisateur';
      const isPro = estPro(item, proIds);

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.card, marginStyle]}
          onPress={() => navigation.navigate('VendeurProfile', { vendeurId: item.id })}
        >
          <View style={styles.cardImageContainer}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.imagePlaceholder]}>
                <Text style={{ fontSize: 32, fontWeight: FONTS.bold, color: theme.primary }}>
                  {authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isPro && (
              <View style={[styles.proBadge, styles.cardBadgePos]}>
                <Ionicons name="checkmark-circle" size={10} color="#fff" style={{ marginRight: 2 }} />
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{authorName}</Text>
            <View style={styles.cardMeta}>
              <Ionicons name="storefront-outline" size={12} color={theme.textMuted} />
              <Text style={styles.cardMetaText} numberOfLines={1}>Voir la vitrine</Text>
            </View>
          </View>
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
        activeOpacity={0.85}
        style={[styles.card, marginStyle]}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <View style={styles.cardImageContainer}>
          {imageUrl
            ? <Image source={{ uri: imageUrl }} style={styles.cardImage} />
            : <View style={[styles.cardImage, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={32} color={theme.border} />
              </View>
          }
          {estPro(item.user, proIds) && (
            <View style={[styles.proBadge, styles.cardBadgePos]}>
              <Ionicons name="checkmark-circle" size={10} color="#fff" style={{ marginRight: 2 }} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.favoriteButton}
            activeOpacity={0.7}
            onPress={() => handleToggleFavori(item.id)}
          >
            <Ionicons
              name={favorisIds.has(item.id) ? 'heart' : 'heart-outline'}
              size={18}
              color={favorisIds.has(item.id) ? '#ef4444' : '#fff'}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.cardPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color={theme.textMuted} />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {item.quartier ? `${item.quartier}, ` : ''}{item.ville}
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
      </TouchableOpacity>
    );
  };

  const renderCategoryTile = (cat: typeof CATEGORIES[0]) => {
    const color = CAT_COLORS[cat.id] || theme.primary;
    return (
      <TouchableOpacity
        key={cat.id}
        // §7.2 et §14.6 : la couleur passe sur l'icone et le contour, plus sur
        // un pave sature qui couvre la moitie de l'ecran et casse le langage
        // visuel du reste de l'application.
        style={[styles.tile, { borderColor: color + '55' }]}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={cat.label}
        onPress={() => {
          if (SUBCATEGORIES[cat.id]?.length > 0) {
            setSubcatPickerCat(cat.id);
          } else {
            setSelectedSousCategorie(null);
            setSelectedCategory(cat.id);
          }
        }}
      >
        <View style={[styles.tileIcone, { backgroundColor: color + '1F' }]}>
          <Ionicons name={cat.icon as any} size={24} color={color} />
        </View>
        <Text style={styles.tileLabel} numberOfLines={2}>{cat.label}</Text>
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
  // Place reservee sous la tab bar flottante.
  const tabBarSpace = useTabBarSpace();

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
            style={[styles.filterBtn, (minPrice || maxPrice || selectedEtat || orderBy !== 'newest' || typeVendeur !== 'tous') && styles.filterBtnActive]} 
            onPress={() => setShowFilters(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={22} color={(minPrice || maxPrice || selectedEtat || orderBy !== 'newest' || typeVendeur !== 'tous') ? '#fff' : theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Chip catégorie active */}
        {selectedCategory && (
          <View style={styles.activeFilter}>
            <View style={[styles.activeCatChip, { backgroundColor: (CAT_COLORS[selectedCategory] || theme.primary) + '22', borderColor: CAT_COLORS[selectedCategory] || theme.primary }]}>
              <Text style={[styles.activeCatText, { color: CAT_COLORS[selectedCategory] || theme.primary }]}>
                {activeCatLabel}{activeSousCatLabel ? ` · ${activeSousCatLabel}` : ''}
              </Text>
              <TouchableOpacity onPress={() => { setSelectedCategory(null); setSelectedSousCategorie(null); }}>
                <Ionicons name="close" size={15} color={CAT_COLORS[selectedCategory] || theme.primary} />
              </TouchableOpacity>
            </View>
            {!inResultsMode || (
              <Text style={styles.resultCount}>
                {loading ? '…' : `${resultatsAffiches.length} résultat${resultatsAffiches.length !== 1 ? 's' : ''}`}
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
          contentContainerStyle={[styles.gridContainer, { paddingBottom: tabBarSpace + SPACING.lg }]}
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

          <View style={{ height: 120 }} />
        </ScrollView>
      ) : (
        /* MODE RÉSULTATS */
        loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={resultatsAffiches}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            numColumns={2}
            contentContainerStyle={[styles.resultsList, { paddingBottom: tabBarSpace + SPACING.lg }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              resultatsAffiches.length > 0 || vendeursRail.length > 0 ? (
                <View>
                  {/* Carrousel Boutiques */}
                  {vendeursRail.length > 0 && (
                    <View style={{ marginBottom: SPACING.md }}>
                      <Text style={styles.sectionSubHeaderTitle}>
                        Professionnels correspondants
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                          {vendeursRail.map(b => (
                            <TouchableOpacity
                              key={b.id}
                              style={styles.boutiqueCard}
                              onPress={() => navigation.navigate('Boutique', { vendeurId: b.id })}
                              activeOpacity={0.85}
                            >
                              {b.avatar_url ? (
                                <Image source={{ uri: b.avatar_url }} style={styles.boutiqueAvatar} />
                              ) : (
                                <View style={styles.boutiqueAvatarPlaceholder}>
                                  <Text style={styles.boutiqueAvatarText}>
                                    {(b.nom_boutique || b.prenom || '?').charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <Text
                                numberOfLines={1}
                                style={styles.boutiqueName}
                              >
                                {b.nom_boutique || `${b.prenom || ''} ${b.nom || ''}`.trim()}
                              </Text>
                              <View style={styles.boutiqueBadge}>
                                <Text style={styles.boutiqueBadgeText}>PRO</Text>
                              </View>
                              <Text style={styles.boutiqueCount}>
                                {b.nbProduits} produit{b.nbProduits > 1 ? 's' : ''}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                  {/* Honnêteté des résultats : on dit clairement quand le mot
                      cherché n'a pas été trouvé et qu'on montre des proches. */}
                  {debouncedSearch.trim().length > 0 && searchTier !== 'exact' && (
                    <View style={styles.approxBanner}>
                      <Ionicons name="information-circle" size={17} color={theme.primary} />
                      <Text style={styles.approxText}>
                        {searchTier === 'weak'
                          ? `Aucune annonce ne contient « ${debouncedSearch.trim()} ». Voici la catégorie la plus proche.`
                          : `Rien d'exact pour « ${debouncedSearch.trim()} ». Voici les annonces les plus proches.`}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.resultCount}>
                    {resultatsAffiches.length} résultat{resultatsAffiches.length !== 1 ? 's' : ''}
                    {activeCatLabel ? ` · ${activeCatLabel}` : ''}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="search" size={32} color={theme.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Aucun résultat</Text>
                <Text style={styles.emptyText}>
                  Essayez avec d'autres mots-clés ou une autre catégorie.
                </Text>
                <TouchableOpacity style={styles.emptyBackBtn} onPress={clearFilters} activeOpacity={0.8}>
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

            {/* Qui vend — repond a une intention acheteur reelle (§7.4) */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Qui vend</Text>
              <View style={styles.chipRow}>
                {([
                  { cle: 'tous', label: 'Tous' },
                  { cle: 'professionnel', label: 'Professionnels' },
                  { cle: 'particulier', label: 'Particuliers' },
                ] as const).map(opt => (
                  <TouchableOpacity
                    key={opt.cle}
                    style={[styles.chip, typeVendeur === opt.cle && styles.chipSelected]}
                    onPress={() => setTypeVendeur(opt.cle)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: typeVendeur === opt.cle }}
                  >
                    <Text style={[styles.chipText, typeVendeur === opt.cle && styles.chipTextSelected]}>
                      {opt.label}
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

      {/* Bottom sheet entonnoir : sous-catégories */}
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
                  {CATEGORIES.find(c => c.id === subcatPickerCat)?.label}
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
    ...TYPOGRAPHY.h1,
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

  approxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: theme.primary + '14',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  approxText: {
    flex: 1,
    fontSize: FONTS.sm,
    color: theme.text,
    fontWeight: FONTS.medium,
  },

  // Subcategories
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

  // Sheet
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
    ...TYPOGRAPHY.h2,
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

  // Category tiles
  gridContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  browseTitle: {
    ...TYPOGRAPHY.h3,
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
    height: TILE_SIZE * 0.72,
    borderRadius: RADIUS.xl,
    backgroundColor: theme.surface,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    // Marges constantes : plusieurs libelles affleuraient les bords (§7.2).
    paddingHorizontal: SPACING.md,
    ...SHADOWS.sm,
  },
  tileIcone: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
    textAlign: 'center',
  },

  // Nearby
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
    paddingVertical: 13,
    marginTop: SPACING.sm,
    ...SHADOWS.colored,
  },
  nearbyBtnText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
  },

  // Results
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultsList: {
    padding: SPACING.lg,
    // paddingBottom ajoute a l'usage : hauteur reelle de la tab bar flottante
  },
  dot: { fontSize: FONTS.xs, color: theme.textMuted, marginHorizontal: 1 },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardBadgePos: { position: 'absolute', top: SPACING.sm, left: SPACING.sm },

  // Grille de résultats (même carte que l'accueil)
  card: {
    width: CARD_WIDTH, marginBottom: SPACING.lg,
    backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', borderWidth: isDark ? 1 : 0, borderColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  cardImageContainer: { width: '100%', height: CARD_WIDTH, position: 'relative' },
  cardImage: { width: '100%', height: '100%', backgroundColor: theme.surfaceMuted },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  favoriteButton: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { padding: SPACING.md },
  cardTitle: {
    fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary,
    lineHeight: 18, marginBottom: SPACING.xs,
  },
  cardPrice: { ...TYPOGRAPHY.price, fontSize: FONTS.md, color: theme.primary, marginBottom: SPACING.xs },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardMetaText: { fontSize: FONTS.xs, color: theme.textMuted },
  cardMetaDot: { fontSize: FONTS.xs, color: theme.textMuted, marginHorizontal: 2 },

  // Boutiques
  sectionSubHeaderTitle: {
    ...TYPOGRAPHY.overline,
    color: theme.textSecondary,
    marginBottom: SPACING.sm,
  },
  boutiqueCard: {
    width: 128, alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
    borderWidth: 1, borderColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  boutiqueAvatar: { width: 48, height: 48, borderRadius: 24 },
  boutiqueAvatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center', alignItems: 'center',
  },
  boutiqueAvatarText: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.primary },
  boutiqueName: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary, marginTop: 6, maxWidth: 112 },
  boutiqueBadge: {
    backgroundColor: theme.primary, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: RADIUS.xs, marginTop: 3,
  },
  boutiqueBadgeText: { fontSize: 9, fontWeight: FONTS.bold, color: '#fff' },
  boutiqueCount: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 3 },

  // Empty state
  emptyContainer: { paddingVertical: 80, alignItems: 'center' },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
    marginBottom: SPACING.xs,
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
    paddingVertical: 12,
    backgroundColor: theme.primaryFaded,
    borderRadius: RADIUS.lg,
  },
  emptyBackText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
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
  modalTitle: { ...TYPOGRAPHY.h2, color: theme.textPrimary },
  modalReset: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.error },
  modalBody: { padding: SPACING.xl },
  filterSection: { marginBottom: SPACING.xxl },
  filterLabel: { ...TYPOGRAPHY.overline, color: theme.textSecondary, marginBottom: SPACING.md },
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
