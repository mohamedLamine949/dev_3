import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useMesAnnonces } from '../hooks/useAnnonces';
import { Annonce } from '../lib/supabase';
import { formatPrix } from '../lib/format';
import { BOOST_PRIX, BOOST_DURATION_HOURS, isBoostActif, aDejaEteBoostee } from '../hooks/useBoost';

interface Props {
  navigation: any;
}

const ARGUMENTS = [
  { icon: 'trending-up-outline', text: 'Priorité dans le fil et la recherche' },
  { icon: 'eye-outline', text: 'Beaucoup plus de vues que la normale' },
  { icon: 'stats-chart-outline', text: 'Résultats détaillés : vues, WhatsApp, appels, messages' },
];

/**
 * Page dédiée « Booster mes annonces » (§ boost 250 FCFA) : un pitch, puis
 * la liste des annonces actives pour choisir laquelle booster. Accessible
 * en un tap depuis l'espace Compte (carte visuelle, pas une ligne perdue
 * dans un menu).
 */
export default function BoosterMesAnnoncesScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { annonces, loading } = useMesAnnonces(session?.user?.id);

  const actives = annonces.filter(a => a.statut === 'active');

  const ouvrirAnnonce = (annonce: Annonce) => {
    if (aDejaEteBoostee(annonce)) {
      navigation.navigate('BoostResultats', { annonceId: annonce.id, annonceTitre: annonce.titre });
    } else {
      navigation.navigate('BoostAnnonce', { annonce });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booster mes annonces</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.pitch}>
          <View style={styles.pitchIcon}>
            <Ionicons name="rocket" size={26} color="#fff" />
          </View>
          <Text style={styles.pitchTitre}>Plus de vues, plus vite</Text>
          <Text style={styles.pitchTexte}>
            Pour {formatPrix(BOOST_PRIX)}, une annonce passe devant les autres pendant {BOOST_DURATION_HOURS}h
            — dans le fil d'accueil et dans la recherche.
          </Text>
          <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
            {ARGUMENTS.map((a, i) => (
              <View key={i} style={styles.pitchLigne}>
                <Ionicons name={a.icon as any} size={16} color="#fff" />
                <Text style={styles.pitchLigneTexte}>{a.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Choisissez l'annonce à booster</Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: SPACING.xl }} />
        ) : actives.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="megaphone-outline" size={28} color={theme.textMuted} />
            <Text style={styles.emptyText}>
              Vous n'avez aucune annonce active pour l'instant. Publiez-en une pour pouvoir la booster.
            </Text>
          </View>
        ) : (
          actives.map(annonce => {
            const photo = annonce.images?.[0]?.image_url;
            const actif = isBoostActif(annonce);
            const dejaBooste = aDejaEteBoostee(annonce);
            return (
              <TouchableOpacity
                key={annonce.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => ouvrirAnnonce(annonce)}
              >
                {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <View style={[styles.photo, styles.photoFallback]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.annonceTitre} numberOfLines={1}>{annonce.titre}</Text>
                  <Text style={styles.annoncePrix}>{formatPrix(annonce.prix)}</Text>
                  {actif && (
                    <View style={styles.badgeActif}>
                      <Ionicons name="rocket" size={11} color={theme.primary} />
                      <Text style={styles.badgeActifText}>Boostée en ce moment</Text>
                    </View>
                  )}
                </View>
                <View style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>
                    {actif ? 'Résultats' : dejaBooste ? 'Résultats' : 'Booster'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  pitch: {
    backgroundColor: theme.secondary, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.xl, ...SHADOWS.md,
  },
  pitchIcon: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  pitchTitre: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: '#fff' },
  pitchTexte: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.92)', marginTop: 6, lineHeight: 20 },
  pitchLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pitchLigneTexte: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.92)', fontWeight: FONTS.semibold },
  sectionTitle: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: SPACING.md },
  emptyBox: {
    alignItems: 'center', gap: SPACING.sm, backgroundColor: theme.surface,
    borderRadius: RADIUS.lg, padding: SPACING.xl, borderWidth: 1, borderColor: theme.borderLight,
  },
  emptyText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: theme.borderLight, ...SHADOWS.sm,
  },
  photo: { width: 56, height: 56, borderRadius: RADIUS.md },
  photoFallback: { backgroundColor: theme.surfaceMuted },
  annonceTitre: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary },
  annoncePrix: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: theme.primary, marginTop: 2 },
  badgeActif: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: theme.primaryFaded, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start',
  },
  badgeActifText: { fontSize: 10, fontWeight: FONTS.bold, color: theme.primary },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtnText: { fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.primary },
});
