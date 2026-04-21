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
  ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES } from '../constants/theme';
import { supabase, Annonce } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md) / 2;

// Données de démo pour un affichage immédiat
const DEMO_ANNONCES: Annonce[] = [
  {
    id: '1',
    user_id: 'u1',
    titre: 'iPhone 15 Pro Max 256GB',
    description: 'iPhone en excellent état, tous les accessoires inclus. Batterie à 96%.',
    prix: 650000,
    categorie: 'telephonie',
    etat_article: 'comme_neuf',
    statut: 'active',
    est_payee: true,
    ville: 'Bamako',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i1', annonce_id: '1', image_url: 'https://picsum.photos/400/400?random=1', ordre: 0 }],
  },
  {
    id: '2',
    user_id: 'u2',
    titre: 'Toyota Corolla 2019',
    description: 'Voiture en très bon état, climatisation, boîte automatique.',
    prix: 12500000,
    categorie: 'vehicules',
    etat_article: 'bon_etat',
    statut: 'active',
    est_payee: true,
    ville: 'Bamako',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i2', annonce_id: '2', image_url: 'https://picsum.photos/400/400?random=2', ordre: 0 }],
  },
  {
    id: '3',
    user_id: 'u3',
    titre: 'Appartement 3 pièces - ACI 2000',
    description: 'Bel appartement meublé, 3 pièces avec salon, cuisine équipée.',
    prix: 350000,
    categorie: 'immobilier',
    etat_article: 'bon_etat',
    statut: 'active',
    est_payee: true,
    ville: 'Bamako',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i3', annonce_id: '3', image_url: 'https://picsum.photos/400/400?random=3', ordre: 0 }],
  },
  {
    id: '4',
    user_id: 'u4',
    titre: 'Samsung Galaxy S24 Ultra',
    description: 'Neuf sous emballage, garantie 1 an. Couleur Titanium Black.',
    prix: 580000,
    categorie: 'telephonie',
    etat_article: 'neuf',
    statut: 'active',
    est_payee: true,
    ville: 'Bamako',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i4', annonce_id: '4', image_url: 'https://picsum.photos/400/400?random=4', ordre: 0 }],
  },
  {
    id: '5',
    user_id: 'u5',
    titre: 'MacBook Air M2 2023',
    description: 'MacBook Air M2, 8GB RAM, 256GB SSD. Parfait état.',
    prix: 750000,
    categorie: 'electronique',
    etat_article: 'comme_neuf',
    statut: 'active',
    est_payee: true,
    ville: 'Sikasso',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i5', annonce_id: '5', image_url: 'https://picsum.photos/400/400?random=5', ordre: 0 }],
  },
  {
    id: '6',
    user_id: 'u6',
    titre: 'Canapé 3 places en cuir',
    description: 'Canapé en cuir véritable, couleur marron, très confortable.',
    prix: 180000,
    categorie: 'maison',
    etat_article: 'bon_etat',
    statut: 'active',
    est_payee: true,
    ville: 'Bamako',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i6', annonce_id: '6', image_url: 'https://picsum.photos/400/400?random=6', ordre: 0 }],
  },
];

function formatPrix(prix: number): string {
  if (prix >= 1000000) {
    return (prix / 1000000).toFixed(prix % 1000000 === 0 ? 0 : 1) + 'M FCFA';
  }
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return `${Math.floor(diff / 604800)}sem`;
}

interface Props {
  navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
  const [annonces, setAnnonces] = useState<Annonce[]>(DEMO_ANNONCES);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const scrollY = new Animated.Value(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch real data from Supabase
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const filteredAnnonces = annonces.filter((a) => {
    const matchSearch = !searchQuery ||
      a.titre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = !selectedCategory || a.categorie === selectedCategory;
    return matchSearch && matchCategory;
  });

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
          <TouchableOpacity style={styles.favoriteButton} activeOpacity={0.7}>
            <Ionicons name="heart-outline" size={18} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>

        {/* Infos */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.cardPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.cardMetaText}>{item.ville}</Text>
            <Text style={styles.cardMetaDot}>•</Text>
            <Text style={styles.cardMetaText}>{timeAgo(item.date_creation)}</Text>
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
          <Text style={styles.heroTitle}>Chap Chap 🇲🇱</Text>
          <Text style={styles.heroSubtitle}>Achetez & Vendez au Mali</Text>
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
      <FlatList
        data={filteredAnnonces}
        renderItem={renderAnnonceCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
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
