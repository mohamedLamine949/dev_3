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
import { Annonce } from '../lib/supabase';

const DEMO_FAVORIS: Annonce[] = [
  {
    id: 'f1',
    user_id: 'u2',
    titre: 'Toyota Corolla 2019',
    description: 'Voiture en très bon état.',
    prix: 12500000,
    categorie: 'vehicules',
    etat_article: 'bon_etat',
    statut: 'active',
    est_payee: true,
    ville: 'Bamako',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i2', annonce_id: 'f1', image_url: 'https://picsum.photos/200/200?random=2', ordre: 0 }],
  }
];

function formatPrix(prix: number): string {
  if (prix >= 1000000) return (prix / 1000000).toFixed(1) + 'M FCFA';
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

export default function FavorisScreen({ navigation }: any) {
  const [favoris, setFavoris] = useState<Annonce[]>(DEMO_FAVORIS);

  const removeFavori = (id: string) => {
    setFavoris(favoris.filter(f => f.id !== id));
  };

  const renderItem = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || 'https://picsum.photos/200';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <Image source={{ uri: imageUrl }} style={styles.image} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.price}>{formatPrix(item.prix)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => removeFavori(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={favoris}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Aucun favori</Text>
            <Text style={styles.emptyText}>Vos annonces sauvegardées apparaîtront ici.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center'
  },
  headerTitle: {
    fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary
  },
  list: { padding: SPACING.lg },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  image: {
    width: 60, height: 60, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceMuted
  },
  info: {
    flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm
  },
  title: {
    fontSize: FONTS.md, fontWeight: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 4
  },
  price: {
    fontSize: FONTS.md, fontWeight: FONTS.bold, color: COLORS.primary
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  emptyContainer: {
    paddingVertical: 100, alignItems: 'center', justifyContent: 'center'
  },
  emptyTitle: {
    fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary, marginTop: SPACING.md
  },
  emptyText: {
    fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: SPACING.xs
  }
});
