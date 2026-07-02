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
import { supabase, Annonce } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMesAnnonces, updateAnnonceStatus, deleteAnnonceById } from '../hooks/useAnnonces';

import { useTheme } from '../contexts/ThemeContext';

function formatPrix(prix: number): string {
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function getStatusBadge(statut: string, est_payee: boolean, theme: any) {
  if (statut === 'vendu') return { bg: theme.surfaceMuted, text: theme.textMuted, label: 'Vendu' };
  if (!est_payee) return { bg: 'rgba(253, 203, 110, 0.2)', text: theme.warning || '#f1c40f', label: 'Attente Paiement' };
  if (statut === 'active') return { bg: 'rgba(0, 184, 148, 0.2)', text: theme.success || '#2ecc71', label: 'En ligne' };
  return { bg: theme.surfaceMuted, text: theme.textSecondary, label: statut };
}

export default function MesAnnoncesScreen({ navigation }: any) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const { annonces, loading, refetch } = useMesAnnonces(session?.user?.id);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetch();
    });
    return unsubscribe;
  }, [navigation, refetch]);

  const handleManage = (annonce: Annonce) => {
    const diffDays = Math.floor((Date.now() - new Date(annonce.date_creation).getTime()) / (1000 * 60 * 60 * 24));
    const showRenew = diffDays >= 15 && annonce.statut !== 'vendu';

    const actions: any[] = [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Modifier les détails',
        onPress: () => navigation.navigate('EditAnnonce', { annonce })
      }
    ];

    if (showRenew) {
      actions.push({
        text: 'Renouveler l\'annonce (Gratuit)',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('annonces')
              .update({
                date_creation: new Date().toISOString(),
                statut: 'active'
              })
              .eq('id', annonce.id);

            if (error) {
              Alert.alert('Erreur', error.message);
            } else {
              Alert.alert('Succès', 'Votre annonce a été renouvelée et remise en avant gratuitement.');
              refetch();
            }
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Une erreur est survenue.');
          }
        }
      });
    }

    actions.push(
      { 
        text: annonce.statut === 'vendu' ? 'Marquer comme disponible' : 'Marquer comme vendu', 
        onPress: async () => {
          const newStatus = annonce.statut === 'vendu' ? 'active' : 'vendu';
          await updateAnnonceStatus(annonce.id, newStatus);
          refetch();
        } 
      },
      { 
        text: 'Supprimer', 
        style: 'destructive' as const, 
        onPress: () => {
          Alert.alert('Confirmer la suppression', 'Cette action est définitive.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Oui, supprimer', style: 'destructive', onPress: async () => {
               await deleteAnnonceById(annonce.id);
               refetch();
            }}
          ])
        } 
      }
    );

    Alert.alert(
      'Gérer l\'annonce',
      `Que souhaitez-vous faire avec "${annonce.titre}" ?`,
      actions
    );
  };

  const renderItem = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    const badge = getStatusBadge(item.statut, item.est_payee, theme);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
        onLongPress={() => handleManage(item)}
      >
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={styles.image} />
          : <View style={[styles.image, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={24} color={theme.borderLight} />
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
              <Ionicons name="eye-outline" size={14} color={theme.textMuted} />
              <Text style={styles.statText}>{(item as any).nombre_vues || 0}</Text>
            </View>
            <View style={styles.stat}>
              <TouchableOpacity onPress={() => handleManage(item)}>
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Annonces</Text>
        <TouchableOpacity onPress={refetch} style={styles.backButton}>
           <Ionicons name="refresh" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
           <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : annonces.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}>
           <Ionicons name="albums-outline" size={60} color={theme.textMuted} style={{ marginBottom: SPACING.md }} />
           <Text style={{ fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center' }}>Vous n'avez publié aucune annonce pour le moment.</Text>
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

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  backButton: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center'
  },
  headerTitle: {
    fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary
  },
  list: { padding: SPACING.lg },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  image: {
    width: 80, height: 80, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted
  },
  info: {
    flex: 1, marginLeft: SPACING.md, justifyContent: 'space-between', paddingVertical: 4
  },
  headerRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' 
  },
  title: {
    flex: 1, fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary, marginRight: 8
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm
  },
  badgeText: { fontSize: 10, fontWeight: FONTS.bold },
  price: {
    fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.primary
  },
  statsRow: { flexDirection: 'row', gap: SPACING.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FONTS.xs, color: theme.textMuted }
});
