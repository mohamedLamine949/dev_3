import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  StatusBar, Platform, Alert, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useParrainage, FilleulRow } from '../hooks/useParrainage';

interface Props {
  navigation: any;
}

const STATUT_FILLEUL: Record<string, { label: string; icon: string; color: string }> = {
  en_attente: { label: 'Inscrit — en attente de sa 1ʳᵉ annonce', icon: 'hourglass-outline', color: '#d97706' },
  valide: { label: 'Validé — récompense à recevoir', icon: 'checkmark-circle', color: '#15803d' },
  paye: { label: 'Payé sur votre Orange Money', icon: 'cash', color: '#15803d' },
  rejete: { label: 'Rejeté', icon: 'close-circle', color: '#dc2626' },
};

/**
 * Écran "Devenir partenaire" (programme de parrainage sur invitation).
 * - Pas encore de code : explication + n° Orange Money + génération du code.
 * - Code généré : tableau de bord (code, progression annonces, filleuls, gains).
 * La validation des cycles est entièrement gérée en base (triggers).
 */
export default function DevenirPartenaireScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const {
    campagne, parrain, filleuls, annoncesValides, loading, genererCode, refresh,
  } = useParrainage(session?.user?.id);

  const [omNumero, setOmNumero] = useState('');
  const [omTitulaire, setOmTitulaire] = useState('');
  const [generating, setGenerating] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const recompense = campagne?.recompense ?? 1000;
  const annoncesRequises = campagne?.annonces_requises ?? 2;
  const plafond = campagne?.plafond_filleuls ?? 5;

  const nbValides = filleuls.filter(f => f.statut === 'valide').length;
  const nbPayes = filleuls.filter(f => f.statut === 'paye').length;
  const montantDu = nbValides * recompense;
  const montantPaye = nbPayes * recompense;

  const omDigits = omNumero.replace(/[^0-9]/g, '');
  const canGenerate = omDigits.length === 8 && omTitulaire.trim().length >= 3;

  async function handleGenerer() {
    if (!canGenerate || generating) return;
    setGenerating(true);
    try {
      const res = await genererCode('+223' + omDigits, omTitulaire.trim());
      if (!res.ok) {
        Alert.alert('Impossible de générer le code', res.message || 'Réessayez plus tard.');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    if (!parrain?.code) return;
    try {
      await Share.share({
        message:
          `Télécharge Flash Market, l'appli pour acheter et vendre au Mali ! ` +
          `À l'inscription, entre mon code de parrainage : ${parrain.code}`,
      });
    } catch {}
  }

  function renderHeader(title: string) {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        {renderHeader('Programme partenaire')}
        <ActivityIndicator color={theme.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  // Garde : accessible uniquement sur invitation (la ligne parrains existe)
  if (!parrain || !campagne?.active) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        {renderHeader('Programme partenaire')}
        <View style={styles.centerBox}>
          <Ionicons name="lock-closed-outline" size={48} color={theme.textMuted} />
          <Text style={styles.centerTitle}>Programme sur invitation</Text>
          <Text style={styles.centerText}>
            Le programme partenaire est réservé aux membres invités par l'équipe Flash Market.
          </Text>
        </View>
      </View>
    );
  }

  // ============ ÉTAPE 1 : pas encore de code → explication + Orange Money ============
  if (!parrain.code) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        {renderHeader('Devenir partenaire')}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <Text style={styles.heroEmoji}>🤝</Text>
            <Text style={styles.heroTitle}>Gagnez {recompense.toLocaleString('fr-FR')} F par personne parrainée</Text>
            <Text style={styles.heroText}>
              Faites découvrir Flash Market autour de vous et recevez votre récompense directement sur Orange Money.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Comment ça marche</Text>
          <View style={styles.stepsCard}>
            {[
              { num: '1', text: `Générez votre code personnel ci-dessous` },
              { num: '2', text: `Publiez ${annoncesRequises} annonces pour activer vos gains` },
              { num: '3', text: `Partagez votre code : vos proches l'entrent à l'inscription` },
              { num: '4', text: `Dès qu'un filleul publie une annonce : +${recompense.toLocaleString('fr-FR')} F pour vous (jusqu'à ${plafond} filleuls)` },
            ].map(s => (
              <View key={s.num} style={styles.stepRow}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{s.num}</Text></View>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Votre compte Orange Money</Text>
          <Text style={styles.sectionHint}>
            C'est sur ce compte que nous enverrons vos récompenses. Vérifiez bien le numéro.
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numéro Orange Money</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="call-outline" size={18} color={theme.textMuted} style={{ marginRight: SPACING.sm }} />
              <Text style={styles.prefix}>+223</Text>
              <TextInput
                style={styles.inputFlex}
                placeholder="70 00 00 00"
                placeholderTextColor={theme.textMuted}
                value={omNumero}
                onChangeText={(t) => setOmNumero(t.replace(/[^0-9]/g, '').slice(0, 8))}
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du titulaire du compte</Text>
            <TextInput
              style={styles.input}
              placeholder="Prénom et nom exacts"
              placeholderTextColor={theme.textMuted}
              value={omTitulaire}
              onChangeText={setOmTitulaire}
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            style={[styles.ctaBtn, !canGenerate && styles.ctaBtnDisabled]}
            onPress={handleGenerer}
            disabled={!canGenerate || generating}
            activeOpacity={0.85}
          >
            {generating
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaText}>Générer mon code partenaire</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ============ ÉTAPE 2 : code généré → tableau de bord ============
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      {renderHeader('Mon programme partenaire')}
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Code + partage */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Votre code de parrainage</Text>
          <Text style={styles.codeValue}>{parrain.code}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.shareBtnText}>Partager mon code</Text>
          </TouchableOpacity>
        </View>

        {/* Progression éligibilité */}
        <Text style={styles.sectionLabel}>Étape 1 — Vos annonces</Text>
        <View style={styles.card}>
          {parrain.eligible ? (
            <View style={styles.eligibleRow}>
              <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
              <Text style={styles.eligibleText}>
                Vous êtes éligible ! Chaque filleul validé vous rapporte {recompense.toLocaleString('fr-FR')} F.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.progressText}>
                Publiez {annoncesRequises} annonces pour activer vos gains : {Math.min(annoncesValides, annoncesRequises)} / {annoncesRequises}
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, (annoncesValides / annoncesRequises) * 100)}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                Vos filleuls sont bien enregistrés dès maintenant, mais les récompenses ne seront validées qu'une fois vos {annoncesRequises} annonces publiées.
              </Text>
            </>
          )}
        </View>

        {/* Gains */}
        <Text style={styles.sectionLabel}>Vos gains</Text>
        <View style={styles.gainsRow}>
          <View style={styles.gainCard}>
            <Text style={styles.gainValue}>{montantDu.toLocaleString('fr-FR')} F</Text>
            <Text style={styles.gainLabel}>À recevoir</Text>
          </View>
          <View style={styles.gainCard}>
            <Text style={[styles.gainValue, { color: theme.primary }]}>{montantPaye.toLocaleString('fr-FR')} F</Text>
            <Text style={styles.gainLabel}>Déjà payé</Text>
          </View>
          <View style={styles.gainCard}>
            <Text style={styles.gainValue}>{nbValides + nbPayes} / {plafond}</Text>
            <Text style={styles.gainLabel}>Filleuls validés</Text>
          </View>
        </View>

        {/* Filleuls */}
        <Text style={styles.sectionLabel}>Étape 2 — Vos filleuls ({filleuls.length})</Text>
        <View style={[styles.card, { padding: 0 }]}>
          {filleuls.length === 0 ? (
            <View style={styles.emptyFilleuls}>
              <Ionicons name="people-outline" size={32} color={theme.textMuted} />
              <Text style={styles.emptyFilleulsText}>
                Personne n'a encore utilisé votre code. Partagez-le : chaque personne qui s'inscrit avec votre code et publie une annonce vous rapporte {recompense.toLocaleString('fr-FR')} F.
              </Text>
            </View>
          ) : (
            filleuls.map((f: FilleulRow, idx) => {
              const meta = STATUT_FILLEUL[f.statut] || STATUT_FILLEUL.en_attente;
              const name = `${f.users?.prenom || 'Filleul'} ${f.users?.nom || ''}`.trim();
              return (
                <View key={f.id} style={[styles.filleulRow, idx > 0 && styles.filleulRowBorder]}>
                  <Ionicons name={meta.icon as any} size={20} color={meta.color} style={{ marginRight: SPACING.md }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filleulName}>{name}</Text>
                    <Text style={[styles.filleulStatus, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  {(f.statut === 'valide' || f.statut === 'paye') && (
                    <Text style={styles.filleulGain}>+{recompense.toLocaleString('fr-FR')} F</Text>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Paiement */}
        <Text style={styles.sectionLabel}>Paiement</Text>
        <View style={styles.card}>
          <View style={styles.omRow}>
            <Ionicons name="wallet-outline" size={18} color={theme.primary} style={{ marginRight: SPACING.sm }} />
            <Text style={styles.omText}>
              Orange Money : <Text style={styles.omStrong}>{parrain.om_numero}</Text> ({parrain.om_titulaire})
            </Text>
          </View>
          <Text style={styles.progressHint}>
            Les récompenses validées sont envoyées manuellement par l'équipe Flash Market. Vous recevrez une notification à chaque paiement.
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={refresh} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={15} color={theme.textSecondary} style={{ marginRight: 6 }} />
          <Text style={styles.refreshText}>Actualiser</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  scrollContent: { padding: SPACING.lg, paddingBottom: 40 },
  centerBox: { alignItems: 'center', padding: SPACING.xxl, marginTop: 40, gap: SPACING.md },
  centerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  centerText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

  heroCard: {
    backgroundColor: theme.primary, borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', marginBottom: SPACING.xl, ...SHADOWS.colored,
  },
  heroEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  heroTitle: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: '#fff', textAlign: 'center' },
  heroText: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: SPACING.sm, lineHeight: 20 },

  sectionLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: SPACING.sm, marginTop: SPACING.lg,
  },
  sectionHint: { fontSize: FONTS.xs, color: theme.textMuted, marginBottom: SPACING.md, lineHeight: 18 },

  stepsCard: { backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md, ...SHADOWS.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: theme.primary + '18',
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  stepBadgeText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },
  stepText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, lineHeight: 19 },

  inputGroup: { gap: 6, marginBottom: SPACING.md },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg,
    paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderLight,
  },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg,
  },
  prefix: { fontSize: FONTS.md, fontWeight: '700', color: theme.textPrimary, marginRight: 6 },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  ctaBtn: {
    height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center', marginTop: SPACING.lg, ...SHADOWS.colored,
  },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },

  codeCard: {
    backgroundColor: theme.surface, borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', borderWidth: 2, borderColor: theme.primary, borderStyle: 'dashed',
  },
  codeLabel: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { fontSize: 36, fontWeight: FONTS.extrabold, color: theme.textPrimary, letterSpacing: 6, marginVertical: SPACING.sm },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary,
    paddingHorizontal: SPACING.xl, paddingVertical: 10, borderRadius: RADIUS.lg, marginTop: SPACING.xs,
  },
  shareBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },

  card: { backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm },
  eligibleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  eligibleText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, fontWeight: FONTS.semibold, lineHeight: 19 },
  progressText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  progressBarBg: { height: 8, backgroundColor: theme.surfaceMuted, borderRadius: 4, marginTop: SPACING.sm, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: theme.primary, borderRadius: 4 },
  progressHint: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: SPACING.sm, lineHeight: 17 },

  gainsRow: { flexDirection: 'row', gap: SPACING.sm },
  gainCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg, alignItems: 'center', ...SHADOWS.sm,
  },
  gainValue: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  gainLabel: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 2 },

  emptyFilleuls: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyFilleulsText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
  filleulRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg },
  filleulRowBorder: { borderTopWidth: 1, borderTopColor: theme.borderLight },
  filleulName: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  filleulStatus: { fontSize: FONTS.xs, marginTop: 1 },
  filleulGain: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },

  omRow: { flexDirection: 'row', alignItems: 'center' },
  omText: { flex: 1, fontSize: FONTS.sm, color: theme.textSecondary },
  omStrong: { fontWeight: FONTS.bold, color: theme.textPrimary },

  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl, padding: SPACING.sm },
  refreshText: { fontSize: FONTS.sm, color: theme.textSecondary, fontWeight: FONTS.medium },
});
