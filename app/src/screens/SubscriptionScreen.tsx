import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { getEffectivePlanKey, isSubscriptionActive } from '../lib/subscription';
import PaiementProModal from '../components/PaiementProModal';
import { useAppConfig } from '../hooks/useAppConfig';

type PlanKey = 'vendeur' | 'service' | 'professionnel';

const PLANS: {
  key: PlanKey;
  icone: keyof typeof Ionicons.glyphMap;
  nom: string;
  prix: number;
  recommande: boolean;
  accroche: string;
  avantages: string[];
  typeCompte: 'professionnel' | 'vendeur';
  planAchete: 'pro' | 'service' | 'vendeur';
  typeActiviteParDefaut?: 'produits' | 'services' | 'mixte';
}[] = [
  {
    key: 'professionnel',
    icone: 'storefront-outline',
    nom: 'PRO / Boutique',
    prix: 5000,
    recommande: true,
    accroche: 'Pour les vrais commerces',
    avantages: [
      'Boutique complète, à vie — aucun renouvellement',
      'Annonces illimitées et permanentes',
      'Badge Pro affiché sur vos produits et votre vitrine',
      'Visibilité maximale dans la recherche',
      'Commandes structurées et statistiques',
    ],
    typeCompte: 'professionnel',
    planAchete: 'pro',
  },
  {
    key: 'service',
    icone: 'construct-outline',
    nom: 'Prestataire de service',
    prix: 2500,
    recommande: false,
    accroche: 'Mécanicien, photographe, coiffeur, réparateur… un annuaire pour votre activité',
    avantages: [
      'Page professionnelle à vie — aucun renouvellement',
      'Vos horaires et votre disponibilité affichés',
      'Ce que vous proposez, mis en avant',
      'Vous pouvez aussi publier des annonces',
      'Badge Pro affiché sur votre profil',
    ],
    typeCompte: 'professionnel',
    planAchete: 'service',
    typeActiviteParDefaut: 'services',
  },
  {
    key: 'vendeur',
    icone: 'pricetags-outline',
    nom: 'Vendeur',
    prix: 2000,
    recommande: false,
    accroche: 'Pour ceux qui vendent beaucoup',
    avantages: [
      '15 annonces par mois, à vie — aucun renouvellement',
      'Statistiques de vues',
      "Idéal pour l'achat-revente régulier",
    ],
    typeCompte: 'vendeur',
    planAchete: 'vendeur',
  },
];

interface Props {
  navigation: any;
}

const LABEL_PLAN_ACHETE: Record<string, string> = {
  pro: 'PRO / Boutique',
  service: 'Prestataire de service',
  vendeur: 'Vendeur',
};

export default function SubscriptionScreen({ navigation }: Props) {
  const { session, user, refreshUser } = useAuth();
  const { theme, isDark } = useTheme();
  const { paymentsEnabled } = useAppConfig();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<PlanKey | null>(null);
  const [activationLibreEnCours, setActivationLibreEnCours] = useState<PlanKey | null>(null);

  const effectiveKey = getEffectivePlanKey(user);
  const active = isSubscriptionActive(user);
  const plan = PLANS.find(p => p.key === selected);
  const labelActuel = (user?.plan_achete && LABEL_PLAN_ACHETE[user.plan_achete])
    || (effectiveKey === 'professionnel' ? 'PRO / Boutique' : effectiveKey === 'vendeur' ? 'Vendeur' : '');

  const appliquerOffre = async (p: typeof PLANS[number]) => {
    if (!session?.user) return;
    const updates: Record<string, any> = {
      type_compte: p.typeCompte,
      date_abonnement: new Date().toISOString(),
      plan_achete: p.planAchete,
    };
    if (p.typeActiviteParDefaut) updates.type_activite = p.typeActiviteParDefaut;
    const { error } = await supabase.from('users').update(updates).eq('id', session.user.id);
    if (error) throw new Error(error.message);
    await refreshUser();
  };

  const choisirOffre = async (key: PlanKey) => {
    if (!session?.user) {
      navigation.navigate('Login');
      return;
    }
    const p = PLANS.find(x => x.key === key);
    if (!p) return;

    // Offre de lancement (§ payments_enabled) : on active directement, sans
    // paiement — même interrupteur que le reste de la monétisation.
    if (!paymentsEnabled) {
      setActivationLibreEnCours(key);
      try {
        await appliquerOffre(p);
        Alert.alert('C\'est fait !', `Vous êtes maintenant ${p.nom} — gratuitement, pendant le lancement.`);
      } catch (e: any) {
        Alert.alert('Erreur', e.message || "Impossible d'activer l'offre pour l'instant.");
      } finally {
        setActivationLibreEnCours(null);
      }
      return;
    }

    setSelected(key);
    setModalVisible(true);
  };

  const handleSuccess = async (reference: string) => {
    if (!plan) return;
    await appliquerOffre(plan);

    // L'encaissement est journalisé APRÈS l'ouverture des droits, et sans
    // jamais faire échouer le parcours : le client a payé, il doit obtenir son
    // accès même si l'écriture du journal échoue. Sans cet appel, un achat
    // payé ne laisserait aucune trace du montant ni de la transaction — c'est
    // ce qui rendait le chiffre d'affaires impossible à établir. Le montant
    // n'est pas transmis : il est lu dans `plans` côté base.
    const { error: journalError } = await supabase.rpc('enregistrer_paiement_acces', {
      p_plan_code: plan.planAchete,
      p_transaction_id: reference,
    });
    if (journalError) {
      console.error('Paiement encaissé mais non journalisé :', journalError.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Services payants</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Un paiement unique, en Mobile Money, pour un accès à vie — aucun renouvellement à prévoir.
        </Text>

        {active && effectiveKey !== 'particulier' && (
          <View style={styles.currentBox}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
            <Text style={styles.currentText}>Vous êtes {labelActuel} — accès à vie.</Text>
          </View>
        )}

        {!paymentsEnabled && (
          <View style={styles.launchBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="gift-outline" size={20} color={theme.primary} />
              <Text style={styles.launchTitle}>Gratuit pendant le lancement 🎉</Text>
            </View>
            <Text style={styles.launchText}>
              Le temps que Flash Market se remplisse de boutiques et de vendeurs, ouvrez un
              compte PRO, prestataire ou vendeur gratuitement — les prix ci-dessous
              s'appliqueront plus tard, une fois le lancement terminé.
            </Text>
          </View>
        )}

        {PLANS.map((p) => (
          <View key={p.key} style={[styles.card, p.recommande && styles.cardReco]}>
            <View style={styles.cardHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={p.icone} size={20} color={theme.primary} />
                <Text style={styles.cardTitle}>{p.nom}</Text>
              </View>
              {p.recommande && (
                <View style={styles.recoBadge}>
                  <Text style={styles.recoText}>RECOMMANDÉ</Text>
                </View>
              )}
            </View>
            <Text style={styles.accroche}>{p.accroche}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={[styles.prix, !paymentsEnabled && styles.prixBarre]}>
                {p.prix.toLocaleString('fr-FR')} FCFA
              </Text>
              {!paymentsEnabled && <Text style={styles.prixGratuit}>Gratuit pour l'instant</Text>}
            </View>
            {paymentsEnabled && <Text style={styles.prixUnit}>Paiement unique</Text>}

            <View style={{ marginVertical: SPACING.md }}>
              {p.avantages.map((a, i) => (
                <View key={i} style={styles.avRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={{ marginTop: 1 }} />
                  <Text style={styles.avText}>{a}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.subBtn,
                p.recommande
                  ? { backgroundColor: theme.primary }
                  : { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.primary },
                activationLibreEnCours === p.key && { opacity: 0.7 },
              ]}
              onPress={() => choisirOffre(p.key)}
              activeOpacity={0.85}
              disabled={activationLibreEnCours === p.key}
            >
              <Text style={[styles.subBtnText, { color: p.recommande ? '#fff' : theme.primary }]}>
                {paymentsEnabled
                  ? `Débloquer (${p.prix.toLocaleString('fr-FR')} FCFA)`
                  : activationLibreEnCours === p.key ? 'Activation…' : 'Devenir ' + p.nom + ' gratuitement'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.note}>
          {paymentsEnabled
            ? "Paiement unique via Mobile Money (Orange Money). Vos avantages restent actifs à vie — aucun renouvellement, aucun prélèvement automatique."
            : "Gratuit pendant le lancement. Vos avantages resteront acquis à vie, même quand les prix ci-dessus entreront en vigueur."}
        </Text>

        <TouchableOpacity
          style={styles.boostPromo}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('BoosterMesAnnonces')}
        >
          <Ionicons name="rocket-outline" size={20} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.boostPromoTitre}>Envie de plus de visibilité tout de suite ?</Text>
            <Text style={styles.boostPromoTexte}>Boostez une annonce précise dès maintenant — 250 FCFA</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      <PaiementProModal
        visible={modalVisible}
        amount={plan?.prix || 0}
        description={`Chap Chap - ${plan?.nom || ''}`}
        title={plan?.nom}
        successTitle="Offre activée"
        successText="Votre accès est actif dès maintenant, à vie."
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
  prixBarre: { color: theme.textMuted, textDecorationLine: 'line-through', fontSize: FONTS.lg },
  prixGratuit: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.success },
  prixUnit: { fontSize: FONTS.sm, fontWeight: '400', color: theme.textSecondary, marginTop: -2 },
  avRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  avText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, lineHeight: 20 },
  subBtn: { paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.sm },
  subBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold },
  note: { fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 18, marginTop: SPACING.sm, textAlign: 'center' },
  boostPromo: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.xl, borderWidth: 1, borderColor: theme.borderLight,
  },
  boostPromoTitre: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary },
  boostPromoTexte: { fontSize: FONTS.xs, color: theme.textSecondary, marginTop: 2 },
});
