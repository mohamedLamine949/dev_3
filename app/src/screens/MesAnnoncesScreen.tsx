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

import AnnonceActionsSheet, { ActionAnnonce } from '../components/AnnonceActionsSheet';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { formatPrix } from '../lib/format';


function getStatusBadge(statut: string, est_payee: boolean, theme: any) {
  if (statut === 'vendu') return { bg: theme.surfaceMuted, text: theme.textMuted, label: 'Vendu' };
  if (!est_payee) return { bg: 'rgba(253, 203, 110, 0.2)', text: theme.warning || '#f1c40f', label: 'Attente Paiement' };
  if (statut === 'active') return { bg: 'rgba(0, 184, 148, 0.2)', text: theme.success || '#2ecc71', label: 'En ligne' };
  if (statut === 'expire') return { bg: 'rgba(231, 76, 60, 0.15)', text: theme.error || '#e74c3c', label: 'Expirée — à renouveler' };
  return { bg: theme.surfaceMuted, text: theme.textSecondary, label: statut };
}

export default function MesAnnoncesScreen({ navigation }: any) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const { annonces, loading, refetch } = useMesAnnonces(session?.user?.id);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  // Place reservee sous la tab bar flottante.
  const tabBarSpace = useTabBarSpace();

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetch();
    });
    return unsubscribe;
  }, [navigation, refetch]);

  // Annonce dont la feuille d'actions est ouverte (null = fermee).
  const [annonceGeree, setAnnonceGeree] = React.useState<Annonce | null>(null);

  // Renouvelable des 15 jours, ou a tout moment si deja expiree.
  const peutRenouveler = (annonce: Annonce) => {
    const jours = Math.floor((Date.now() - new Date(annonce.date_creation).getTime()) / (1000 * 60 * 60 * 24));
    return (jours >= 15 || annonce.statut === 'expire') && annonce.statut !== 'vendu';
  };

  const actionsPour = (annonce: Annonce): ActionAnnonce[] => {
    const actions: ActionAnnonce[] = [];
    if (peutRenouveler(annonce)) {
      actions.push({
        cle: 'renouveler',
        icone: 'refresh-outline',
        titre: "Renouveler l'annonce",
        detail: 'Gratuit — elle repart pour 30 jours et remonte dans le fil',
      });
    }
    actions.push({
      cle: 'vendu',
      icone: annonce.statut === 'vendu' ? 'pricetag-outline' : 'checkmark-done-outline',
      titre: annonce.statut === 'vendu' ? 'Remettre en vente' : 'Marquer comme vendu',
      detail: annonce.statut === 'vendu'
        ? "L'annonce redevient visible par les acheteurs"
        : "L'annonce reste dans votre historique mais n'est plus proposee",
    });
    actions.push({
      cle: 'supprimer',
      icone: 'trash-outline',
      titre: "Supprimer l'annonce",
      detail: 'Definitif : photos et statistiques sont perdues',
      destructive: true,
    });
    return actions;
  };

  const executerAction = async (annonce: Annonce, cle: string) => {
    setAnnonceGeree(null);

    if (cle === 'renouveler') {
      const { error } = await supabase
        .from('annonces')
        .update({
          date_creation: new Date().toISOString(),
          statut: 'active',
          // Rearme la notification d'expiration pour le nouveau cycle de 30 jours
          expiration_notifiee: false,
        })
        .eq('id', annonce.id);
      if (error) Alert.alert('Erreur', error.message);
      else {
        Alert.alert('Annonce renouvelee', 'Votre annonce est remise en avant, gratuitement.');
        refetch();
      }
      return;
    }

    if (cle === 'vendu') {
      await updateAnnonceStatus(annonce.id, annonce.statut === 'vendu' ? 'active' : 'vendu');
      refetch();
      return;
    }

    if (cle === 'supprimer') {
      // Deux boutons seulement : une alerte de confirmation les affiche
      // correctement sur Android comme sur iOS.
      Alert.alert("Supprimer l'annonce ?", 'Cette action est definitive.', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteAnnonceById(annonce.id);
            refetch();
          },
        },
      ]);
    }
  };

  const renderItem = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    const badge = getStatusBadge(item.statut, item.est_payee, theme);
    // Une annonce sans photo passe inapercue et n'est presque jamais
    // contactee. Le vendeur doit le voir ici, avec le bouton pour corriger
    // juste en dessous — pas le decouvrir par un acheteur mecontent.
    const sansPhoto = !imageUrl;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardTop}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
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
                <Text style={styles.statText}>{(item as any).nombre_vues || 0} vue(s)</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {sansPhoto && (
          <View style={styles.alertePhoto}>
            <Ionicons name="alert-circle" size={16} color={theme.error} />
            <Text style={styles.alertePhotoText}>
              Aucune photo. Appuyez sur Modifier pour en ajouter.
            </Text>
          </View>
        )}

        {/* Deux boutons ecrits en toutes lettres. « Modifier » etait cache
            derriere un appui long et une petite icone « … » : des vendeurs
            ont supprime puis republie leur annonce faute de le trouver. */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('EditAnnonce', { annonce: item })}
          >
            <Ionicons name="create-outline" size={18} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={() => setAnnonceGeree(item)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>Plus</Text>
          </TouchableOpacity>
        </View>
      </View>
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
          contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace + SPACING.lg }]}
          refreshing={loading}
          onRefresh={refetch}
        />
      )}

      <AnnonceActionsSheet
        visible={!!annonceGeree}
        titreAnnonce={annonceGeree?.titre}
        actions={annonceGeree ? actionsPour(annonceGeree) : []}
        onChoisir={cle => { if (annonceGeree) executerAction(annonceGeree, cle); }}
        onFermer={() => setAnnonceGeree(null)}
      />
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
    backgroundColor: theme.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row' },
  alertePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
  },
  alertePhotoText: { flex: 1, fontSize: FONTS.xs, color: theme.error, fontWeight: FONTS.semibold },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  actionBtnPrimary: { borderColor: theme.primary, backgroundColor: theme.primaryFaded },
  actionText: { fontSize: FONTS.sm, fontWeight: FONTS.bold },
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
