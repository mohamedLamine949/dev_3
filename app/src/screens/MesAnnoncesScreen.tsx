import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { Annonce } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMesAnnonces, updateAnnonceStatus, deleteAnnonceById } from '../hooks/useAnnonces';

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
  const { session } = useAuth();
  const { annonces, loading, refetch } = useMesAnnonces(session?.user?.id);

  const handleManage = (annonce: Annonce) => {
    Alert.alert(
      'Gérer l\'annonce',
      `Que souhaitez-vous faire avec "${annonce.titre}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Marquer comme vendu', 
          onPress: async () => {
            await updateAnnonceStatus(annonce.id, 'vendu');
            refetch();
          } 
        },
        { 
          text: 'Supprimer', 
          style: 'destructive', 
          onPress: () => {
            Alert.alert('Confirmer', 'La suppression est définitive.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Oui, supprimer', style: 'destructive', onPress: async () => {
                 await deleteAnnonceById(annonce.id);
                 refetch();
              }}
            ])
          } 
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    const badge = getStatusBadge(item.statut, item.est_payee);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
        onLongPress={() => handleManage(item)}
      >
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={styles.image} />
          : <View style={[styles.image, { backgroundColor: COLORS.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={24} color={COLORS.border} />
            </View>
        }
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
              <Text style={styles.statText}>0</Text>
            </View>
            <View style={styles.stat}>
              <TouchableOpacity onPress={() => handleManage(item)}>
                <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
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
        <TouchableOpacity onPress={refetch} style={styles.backButton}>
           <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
           <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : annonces.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}>
           <Ionicons name="albums-outline" size={60} color={COLORS.textMuted} style={{ marginBottom: SPACING.md }} />
           <Text style={{ fontSize: FONTS.md, color: COLORS.textSecondary, textAlign: 'center' }}>Vous n'avez publié aucune annonce pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          data={annonces}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={refetch}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
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
