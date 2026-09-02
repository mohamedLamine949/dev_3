import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { Annonce } from '../lib/supabase';
import { formatPrix } from '../lib/format';
import { BOOST_PRIX, BOOST_DURATION_HOURS, activerBoost, isBoostActif } from '../hooks/useBoost';
import PaiementProModal from '../components/PaiementProModal';

interface Props {
  navigation: any;
  route: any;
}

const AVANTAGES = [
  { icon: 'rocket-outline', text: `Priorité dans le fil d'accueil et la recherche pendant ${BOOST_DURATION_HOURS}h` },
  { icon: 'eye-outline', text: 'Bien plus de vues qu\'une annonce classique' },
  { icon: 'stats-chart-outline', text: 'Résultats détaillés : vues avant / après le boost' },
];

/**
 * Payer pour booster UNE annonce précise (§ boost 250 FCFA). Réutilise le
 * même modal de paiement que l'abonnement PRO, avec des textes dédiés.
 */
export default function BoostAnnonceScreen({ navigation, route }: Props) {
  const { annonce } = route.params as { annonce: Annonce };
  const { session, user } = useAuth();
  const { theme, isDark } = useTheme();
  // Interrupteur DU BOOST, distinct de celui des offres d'acces : depuis le
  // 2026-09-02, devenir professionnel est gratuit mais booster est payant.
  const { boostPaymentsEnabled } = useAppConfig();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [modalVisible, setModalVisible] = useState(false);
  const [activating, setActivating] = useState(false);
  const dejaActif = isBoostActif(annonce);
  const photo = annonce.images?.[0]?.image_url;

  // `reference` n'est fournie que par PaiementPro. Sans paiement (offre de
  // lancement), le boost est offert : on l'enregistre au prix réel, 0 F.
  const handleSuccess = async (reference?: string) => {
    await activerBoost(annonce, {
      prix: boostPaymentsEnabled ? BOOST_PRIX : 0,
      reference: reference || null,
    });
    navigation.replace('BoostResultats', { annonceId: annonce.id, annonceTitre: annonce.titre });
  };

  // Même interrupteur que le reste de la monétisation (§ offre de
  // lancement) : quand les paiements sont désactivés, le boost s'active
  // directement sans passer par PaiementPro — sert aussi à tester tout le
  // parcours (résultats, expiration…) sans payer.
  const handlePressBoost = async () => {
    if (!session?.user) {
      navigation.navigate('Login');
      return;
    }
    if (!boostPaymentsEnabled) {
      setActivating(true);
      try {
        await handleSuccess();
      } catch (e: any) {
        Alert.alert('Erreur', e.message || "Impossible d'activer le boost.");
      } finally {
        setActivating(false);
      }
      return;
    }
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booster mon annonce</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {!boostPaymentsEnabled && (
          <View style={styles.activeBox}>
            <Ionicons name="flask-outline" size={18} color={theme.primary} />
            <Text style={styles.activeText}>Mode test : le boost s'active gratuitement, sans paiement.</Text>
          </View>
        )}

        {dejaActif && (
          <View style={styles.activeBox}>
            <Ionicons name="rocket" size={18} color={theme.primary} />
            <Text style={styles.activeText}>Cette annonce est déjà boostée en ce moment.</Text>
          </View>
        )}

        <View style={styles.card}>
          {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <View style={[styles.photo, styles.photoFallback]} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.annonceTitre} numberOfLines={2}>{annonce.titre}</Text>
            <Text style={styles.annoncePrix}>{formatPrix(annonce.prix)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ce que le boost change</Text>
        {AVANTAGES.map((a, i) => (
          <View key={i} style={styles.avRow}>
            <View style={styles.avIcon}>
              <Ionicons name={a.icon as any} size={18} color={theme.primary} />
            </View>
            <Text style={styles.avText}>{a.text}</Text>
          </View>
        ))}

        <Text style={styles.note}>
          Le boost rend l'annonce prioritaire dans le fil et la recherche — ce n'est pas
          un simple rafraîchissement de date. Il reste actif {BOOST_DURATION_HOURS}h, puis l'annonce
          reprend son classement normal. Vous pouvez consulter les résultats à tout moment
          depuis la fiche de l'annonce.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.boostBtn, activating && { opacity: 0.7 }]}
          activeOpacity={0.85}
          disabled={activating}
          onPress={handlePressBoost}
        >
          <Ionicons name="rocket-outline" size={20} color="#fff" />
          <Text style={styles.boostBtnText}>
            {boostPaymentsEnabled ? `Booster maintenant — ${formatPrix(BOOST_PRIX)}` : 'Booster gratuitement (test)'}
          </Text>
        </TouchableOpacity>
      </View>

      <PaiementProModal
        visible={modalVisible}
        amount={BOOST_PRIX}
        description={`Chap Chap - Boost annonce "${annonce.titre}"`}
        title="Boost annonce"
        successTitle="Annonce boostée"
        successText={`Votre annonce est maintenant prioritaire pour les ${BOOST_DURATION_HOURS} prochaines heures.`}
        customer={{
          phone: user?.telephone || user?.num_telephone,
          email: session?.user?.email,
          firstName: user?.prenom,
          lastName: user?.nom,
        }}
        onSuccess={handleSuccess}
        onClose={() => setModalVisible(false)}
      />
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
  activeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primaryFaded, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  activeText: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  card: {
    flexDirection: 'row', gap: SPACING.md, alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.xl, borderWidth: 1, borderColor: theme.borderLight, ...SHADOWS.sm,
  },
  photo: { width: 64, height: 64, borderRadius: RADIUS.md },
  photoFallback: { backgroundColor: theme.surfaceMuted },
  annonceTitre: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  annoncePrix: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.primary, marginTop: 4 },
  sectionTitle: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: SPACING.md },
  avRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  avIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primaryFaded,
    alignItems: 'center', justifyContent: 'center',
  },
  avText: { flex: 1, fontSize: FONTS.sm, color: theme.textSecondary, lineHeight: 20 },
  note: { fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 18, marginTop: SPACING.lg },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: SPACING.xl, paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.xl,
    backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.borderLight,
  },
  boostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: RADIUS.lg, paddingVertical: 16,
  },
  boostBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
