import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { formatNombre, formatPrix } from '../lib/format';
import { useBoostStats, isBoostActif, BOOST_DURATION_HOURS } from '../hooks/useBoost';

interface Props {
  navigation: any;
  route: any;
}

/** Formate le temps restant d'un boost actif : « 1j 4h », « 6h », « 20min ». */
function tempsRestant(expireLe: string): string {
  const ms = new Date(expireLe).getTime() - Date.now();
  if (ms <= 0) return 'Terminé';
  const totalMin = Math.floor(ms / 60000);
  const jours = Math.floor(totalMin / (60 * 24));
  const heures = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (jours > 0) return `${jours}j ${heures}h`;
  if (heures > 0) return `${heures}h ${minutes}min`;
  return `${minutes}min`;
}

/**
 * Écran « voir les résultats de mon annonce boostée » (façon TikTok) :
 * vues totales, vues gagnées depuis le boost, statut/temps restant.
 */
export default function BoostResultsScreen({ navigation, route }: Props) {
  const { annonceId, annonceTitre } = route.params as { annonceId: string; annonceTitre?: string };
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { annonce, loading, refetch } = useBoostStats(annonceId);

  const actif = annonce ? isBoostActif(annonce) : false;
  const vuesAvant = annonce?.boost_vues_avant ?? 0;
  const vuesTotal = annonce?.nombre_vues ?? 0;
  const vuesGagnees = Math.max(0, vuesTotal - vuesAvant);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Résultats du boost</Text>
        <TouchableOpacity onPress={refetch} activeOpacity={0.7}>
          <Ionicons name="refresh" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading && !annonce ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
      ) : !annonce ? (
        <View style={styles.center}><Text style={styles.emptyText}>Annonce introuvable.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.annonceTitre} numberOfLines={2}>{annonceTitre || annonce.titre}</Text>

          <View style={[styles.statusBox, { backgroundColor: actif ? theme.primaryFaded : theme.surface, borderColor: actif ? theme.primary : theme.borderLight }]}>
            <Ionicons name={actif ? 'rocket' : 'checkmark-done-outline'} size={22} color={actif ? theme.primary : theme.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {actif ? 'Boost actif' : 'Boost terminé'}
              </Text>
              <Text style={styles.statusSub}>
                {actif
                  ? `Encore ${tempsRestant(annonce.boost_expire_le!)} — priorité dans le fil et la recherche`
                  : `Le boost de ${BOOST_DURATION_HOURS}h est arrivé à son terme`}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatNombre(vuesTotal)}</Text>
              <Text style={styles.statLabel}>Vues au total</Text>
            </View>
            <View style={[styles.statCard, styles.statCardAccent]}>
              <Text style={[styles.statValue, { color: theme.primary }]}>+{formatNombre(vuesGagnees)}</Text>
              <Text style={styles.statLabel}>Vues depuis le boost</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vues avant le boost</Text>
            <Text style={styles.detailValue}>{formatNombre(vuesAvant)}</Text>
          </View>
          {annonce.boost_prix != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Montant payé</Text>
              <Text style={styles.detailValue}>{formatPrix(annonce.boost_prix)}</Text>
            </View>
          )}
          {annonce.boost_paye_le && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Boosté le</Text>
              <Text style={styles.detailValue}>{new Date(annonce.boost_paye_le).toLocaleDateString('fr-FR')}</Text>
            </View>
          )}

          {!actif && (
            <TouchableOpacity
              style={styles.reboostBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BoostAnnonce', { annonce })}
            >
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={styles.reboostText}>Booster à nouveau</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FONTS.md, color: theme.textSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  annonceTitre: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary, marginBottom: SPACING.lg },
  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1.5, padding: SPACING.lg, marginBottom: SPACING.xl,
  },
  statusTitle: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  statusSub: { fontSize: FONTS.xs, color: theme.textSecondary, marginTop: 2, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xl },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg, alignItems: 'center', borderWidth: 1, borderColor: theme.borderLight, ...SHADOWS.sm,
  },
  statCardAccent: { borderColor: theme.primary, borderWidth: 1.5 },
  statValue: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  statLabel: { fontSize: FONTS.xs, color: theme.textSecondary, marginTop: 4, textAlign: 'center' },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  detailLabel: { fontSize: FONTS.sm, color: theme.textSecondary },
  detailValue: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary },
  reboostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: RADIUS.lg, paddingVertical: 15, marginTop: SPACING.xl,
  },
  reboostText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
