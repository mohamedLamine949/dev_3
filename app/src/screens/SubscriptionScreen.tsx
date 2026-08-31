import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { getEffectivePlanKey, subscriptionExpiryDate, isSubscriptionActive } from '../lib/subscription';
import PaiementProModal from '../components/PaiementProModal';
import { useAppConfig } from '../hooks/useAppConfig';

type PlanKey = 'vendeur' | 'professionnel';

const PLANS: {
  key: PlanKey;
  emoji: string;
  nom: string;
  prix: number;
  recommande: boolean;
  accroche: string;
  avantages: string[];
}[] = [
  {
    key: 'professionnel',
    emoji: '🌟',
    nom: 'PRO / Boutique',
    prix: 5000,
    recommande: true,
    accroche: 'Pour les vrais commerces',
    avantages: [
      "Annonces illimitées et permanentes (n'expirent jamais)",
      'Vitrine boutique professionnelle',
      'Badge Pro affiché sur vos produits et votre vitrine',
      'Visibilité maximale dans la recherche',
      'Commandes structurées et statistiques',
    ],
  },
  {
    key: 'vendeur',
    emoji: '💼',
    nom: 'Vendeur',
    prix: 2000,
    recommande: false,
    accroche: "Pour ceux qui vendent beaucoup",
    avantages: [
      '30 annonces par mois',
      'Statistiques de vues',
      "Idéal pour l'achat-revente régulier",
    ],
  },
];

interface Props {
  navigation: any;
}

export default function SubscriptionScreen({ navigation }: Props) {
  const { session, user, refreshUser } = useAuth();
  const { theme, isDark } = useTheme();
  const { paymentsEnabled } = useAppConfig();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<{ type: PlanKey; amount: number } | null>(null);

  const effectiveKey = getEffectivePlanKey(user);
  const expiry = subscriptionExpiryDate(user);
  const active = isSubscriptionActive(user);

  const openPayment = (type: PlanKey, amount: number) => {
    if (!session?.user) {
      navigation.navigate('Login');
      return;
    }
    setSelected({ type, amount });
    setModalVisible(true);
  };

  const handleSuccess = async () => {
    if (!selected || !session?.user) return;
    const { error } = await supabase
      .from('users')
      .update({ type_compte: selected.type, date_abonnement: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) throw new Error(error.message);
    await refreshUser();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nos abonnements</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Choisissez la formule adaptée à votre activité et payez directement en Mobile Money. Débloquez plus de visibilité et vendez plus vite.
        </Text>

        {active && effectiveKey !== 'particulier' && (
          <View style={styles.currentBox}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
            <Text style={styles.currentText}>
              Vous êtes {effectiveKey === 'professionnel' ? 'PRO' : 'Vendeur'}
              {expiry ? ` jusqu'au ${expiry.toLocaleDateString('fr-FR')}` : ''}.
            </Text>
          </View>
        )}

        {!paymentsEnabled && (
          <View style={styles.launchBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="gift-outline" size={20} color={theme.primary} />
              <Text style={styles.launchTitle}>Offre de lancement 🎉</Text>
            </View>
            <Text style={styles.launchText}>
              Les abonnements payants sont temporairement suspendus. Toutes les
              fonctionnalités sont gratuites pendant le lancement.
            </Text>
          </View>
        )}

        {paymentsEnabled && PLANS.map((plan) => (
          <View key={plan.key} style={[styles.card, plan.recommande && styles.cardReco]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{plan.emoji} {plan.nom}</Text>
              {plan.recommande && (
                <View style={styles.recoBadge}>
                  <Text style={styles.recoText}>RECOMMANDÉ</Text>
                </View>
              )}
            </View>
            <Text style={styles.accroche}>{plan.accroche}</Text>
            <Text style={styles.prix}>
              {plan.prix.toLocaleString('fr-FR')} <Text style={styles.prixUnit}>FCFA / mois</Text>
            </Text>

            <View style={{ marginVertical: SPACING.md }}>
              {plan.avantages.map((a, i) => (
                <View key={i} style={styles.avRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={{ marginTop: 1 }} />
                  <Text style={styles.avText}>{a}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.subBtn,
                plan.recommande
                  ? { backgroundColor: theme.primary }
                  : { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.primary },
              ]}
              onPress={() => openPayment(plan.key, plan.prix)}
              activeOpacity={0.85}
            >
              <Text style={[styles.subBtnText, { color: plan.recommande ? '#fff' : theme.primary }]}>
                S'abonner ({plan.prix.toLocaleString('fr-FR')} FCFA)
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {paymentsEnabled && (
          <Text style={styles.note}>
            Paiement unique via Mobile Money (Orange Money). Le renouvellement n'est pas automatique : au bout de 30 jours, vous pourrez renouveler si vous le souhaitez. Votre boutique et vos données sont conservées entre-temps.
          </Text>
        )}
      </ScrollView>

      <PaiementProModal
        visible={modalVisible}
        amount={selected?.amount || 0}
        description={selected?.type === 'professionnel' ? 'Chap Chap - Abonnement PRO / Boutique' : 'Chap Chap - Abonnement Vendeur'}
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
  intro: { fontSize: FONTS.md, color: theme.textSecondary, lineHeight: 22, marginBottom: SPACING.lg },
  currentBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primaryFaded, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  currentText: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  launchBox: {
    backgroundColor: theme.primaryFaded, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: theme.primary, ...SHADOWS.sm,
  },
  launchTitle: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  launchText: { fontSize: FONTS.xs, color: theme.textSecondary, lineHeight: 18 },
  card: {
    backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: theme.borderLight, ...SHADOWS.sm,
  },
  cardReco: { borderWidth: 2, borderColor: theme.primary, backgroundColor: theme.primaryFaded },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  recoBadge: { backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  recoText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  accroche: { fontSize: FONTS.sm, color: theme.textSecondary, marginBottom: SPACING.sm },
  prix: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.primary },
  prixUnit: { fontSize: FONTS.sm, fontWeight: '400', color: theme.textSecondary },
  avRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  avText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, lineHeight: 20 },
  subBtn: { paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.sm },
  subBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold },
  note: { fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 18, marginTop: SPACING.sm, textAlign: 'center' },
});
