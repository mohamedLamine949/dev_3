import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, CATEGORIES, SHADOWS } from '../constants/theme';
import { Annonce } from '../lib/supabase';

function formatPrix(prix: number): string {
  if (prix >= 1000000) {
    return (prix / 1000000).toFixed(prix % 1000000 === 0 ? 0 : 1) + 'M FCFA';
  }
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Maint.';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

interface Props {
  navigation: any;
}

export default function SearchScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Pour l'instant on utilise des données vides / nulles pour la recherche
  // TODO: Remplacer par const { annonces, loading } = useAnnonces({ search: searchQuery, categorie: selectedCategory });
  const searchResults: Annonce[] = [];

  const handleSearch = () => {
    // Action de recherche si nécessaire
  };

  const renderResultItem = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || 'https://picsum.photos/200/200';
    return (
      <TouchableOpacity
        style={styles.resultCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <Image source={{ uri: imageUrl }} style={styles.resultImage} />
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.resultPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.resultMeta}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.resultMetaText}>{item.ville}</Text>
            <Text style={styles.resultMetaDot}>•</Text>
            <Text style={styles.resultMetaText}>{timeAgo(item.date_creation)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header / Search Bar */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Que cherchez-vous ?"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Categories Filter Horizontally */}
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                onPress={() => setSelectedCategory(isSelected ? null : item.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Results List */}
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={renderResultItem}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Effectuez une recherche</Text>
            <Text style={styles.emptyText}>Utilisez la barre ci-dessus pour trouver des biens pertinents.</Text>
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
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
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
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: SPACING.sm,
  },
  categoriesList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.medium,
    color: COLORS.textSecondary,
  },
  categoryTextSelected: {
    color: COLORS.textInverse,
    fontWeight: FONTS.semibold,
  },
  resultsList: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  resultImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
  },
  resultInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  resultPrice: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: COLORS.primary,
    marginBottom: 8,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultMetaText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  resultMetaDot: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  },
});
