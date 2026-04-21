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

// On utilise de la fausse donnée en attendant l'Auth et l'insertion dans Supabase
const DEMO_MES_ANNONCES: Annonce[] = [
  {
    id: 'a1',
    user_id: 'u1',
    titre: 'iPhone 15 Pro Max',
    description: 'Neuf, jamais utilisé.',
    prix: 650000,
    categorie: 'telephonie',
    etat_article: 'neuf',
    statut: 'active',
    est_payee: true,
    ville: 'Bamako',
    date_creation: new Date().toISOString(),
    images: [{ id: 'i1', annonce_id: 'a1', image_url: 'https://picsum.photos/200/200?random=20', ordre: 0 }],
  },
  {
    id: 'a2',
    user_id: 'u1',
    titre: 'Canapé en cuir',
    description: 'Très bon état',
    prix: 180000,
    categorie: 'maison',
    etat_article: 'bon_etat',
    statut: 'en_attente',
    est_payee: false,
    ville: 'Bamako',
    date_creation: new Date(Date.now() - 86400000).toISOString(),
    images: [{ id: 'i2', annonce_id: 'a2', image_url: 'https://picsum.photos/200/200?random=21', ordre: 0 }],
  },
];

function formatPrix(prix: number): string {
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function getStatusBadge(statut: string, est_payee: boolean) {
  if (statut === 'vendu') return { bg: COLORS.surfaceMuted, text: COLORS.textMuted, label: 'Vendu' };
  if (!est_payee) return { bg: 'rgba(253, 203, 110, 0.2)', text: COLORS.warning, label: 'Attente Paiement' };
  if (statut === 'active') return { bg: 'rgba(0, 184, 148, 0.2)', text: COLORS.success, label: 'En ligne' };
  return { bg: COLORS.surfaceMuted, text: COLORS.textSecondary, label: statut };
}

export default function MesAnnoncesScreen({ navigation }: any) {
  const [annonces, setAnnonces] = useState<Annonce[]>(DEMO_MES_ANNONCES);

  const renderItem = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || 'https://picsum.photos/200';
    const badge = getStatusBadge(item.statut, item.est_payee);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <Image source={{ uri: imageUrl }} style={styles.image} />
        <View style={styles.info}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>{item.titre}</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          </View>
          <Text style={styles.price}>{formatPrix(item.prix)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.statText}>12</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.statText}>3</Text>
            </View>
          </View>
        </View>
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
        <Text style={styles.headerTitle}>Mes Annonces</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={annonces}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
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
    ...SHADOWS.sm,
  },
  image: {
    width: 80, height: 80, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceMuted
  },
  info: {
    flex: 1, marginLeft: SPACING.md, justifyContent: 'space-between', paddingVertical: 4
  },
  headerRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' 
  },
  title: {
    flex: 1, fontSize: FONTS.md, fontWeight: FONTS.semibold, color: COLORS.textPrimary, marginRight: 8
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm
  },
  badgeText: { fontSize: 10, fontWeight: FONTS.bold },
  price: {
    fontSize: FONTS.md, fontWeight: FONTS.bold, color: COLORS.primary
  },
  statsRow: { flexDirection: 'row', gap: SPACING.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FONTS.xs, color: COLORS.textMuted }
});
