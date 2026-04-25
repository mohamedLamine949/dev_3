import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const TERMS_KEY = 'flash_market_terms_accepted_v1';

import { useTheme } from '../contexts/ThemeContext';

const TERMS_KEY = 'flash_market_terms_accepted_v1';

export default function TermsModal() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const { theme, isDark } = useTheme();

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  useEffect(() => {
    AsyncStorage.getItem(TERMS_KEY).then((val) => {
      if (!val) setVisible(true);
      setLoading(false);
    });
  }, []);

  const handleAccept = async () => {
    await AsyncStorage.setItem(TERMS_KEY, 'true');
    setVisible(false);
  };

  if (loading || !visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Ionicons name="flash" size={22} color={theme.primary} />
            <Text style={styles.appName}>Flash Market</Text>
          </View>
          <Text style={styles.title}>Conditions d'utilisation</Text>
          <Text style={styles.subtitle}>Lisez et acceptez avant de continuer</Text>
        </View>

        {/* Contenu */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
            if (isBottom) setScrolledToBottom(true);
          }}
          scrollEventThrottle={16}
        >
          <Section title="1. Présentation de la plateforme" styles={styles}>
            Flash Market est une plateforme de mise en relation entre acheteurs et vendeurs particuliers au Mali. Flash Market n'est pas un commerçant et n'intervient pas dans les transactions entre utilisateurs.
          </Section>

          <Section title="2. Responsabilité des transactions" styles={styles}>
            Flash Market n'est pas responsable des transactions effectuées entre utilisateurs. Toute vente, achat ou échange est conclu directement entre les parties. Flash Market décline toute responsabilité en cas de litige, fraude, produit non conforme ou non livraison.
          </Section>

          <Section title="3. Obligations des utilisateurs" styles={styles}>
            En utilisant Flash Market, vous vous engagez à :{'\n'}
            • Fournir des informations exactes et honnêtes{'\n'}
            • Ne pas publier d'annonces frauduleuses ou illégales{'\n'}
            • Respecter les autres utilisateurs{'\n'}
            • Ne pas vendre de produits contrefaits, interdits ou dangereux{'\n'}
            • Effectuer les transactions en toute bonne foi
          </Section>

          <Section title="4. Contenu des annonces" styles={styles}>
            Vous êtes seul responsable du contenu de vos annonces. Flash Market se réserve le droit de supprimer toute annonce qui violerait ces conditions ou la législation malienne.
          </Section>

          <Section title="5. Conseils de sécurité" styles={styles}>
            Nous vous recommandons fortement de :{'\n'}
            • Rencontrer le vendeur dans un lieu public{'\n'}
            • Vérifier l'article avant tout paiement{'\n'}
            • Ne jamais envoyer d'argent à l'avance sans voir le produit{'\n'}
            • Signaler tout comportement suspect
          </Section>

          <Section title="6. Données personnelles" styles={styles}>
            Vos données (nom, téléphone, localisation) sont utilisées uniquement pour le fonctionnement de la plateforme. Elles ne sont pas vendues à des tiers.
          </Section>

          <Section title="7. Modification des conditions" styles={styles}>
            Flash Market se réserve le droit de modifier ces conditions à tout moment. Une nouvelle acceptation pourra être requise en cas de changement majeur.
          </Section>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color={theme.textMuted} />
            <Text style={styles.disclaimerText}>
              Flash Market est une plateforme de mise en relation. Nous ne garantissons pas et ne sommes pas partie aux transactions entre utilisateurs.
            </Text>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {!scrolledToBottom && (
            <Text style={styles.scrollHint}>
              <Ionicons name="chevron-down" size={13} color={theme.textMuted} /> Faites défiler pour lire
            </Text>
          )}
          <TouchableOpacity
            style={[styles.acceptBtn, !scrolledToBottom && styles.acceptBtnDisabled]}
            onPress={handleAccept}
            disabled={!scrolledToBottom}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.acceptText}>J'accepte les conditions</Text>
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            En acceptant, vous confirmez avoir lu et compris ces conditions.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: any }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  header: {
    backgroundColor: theme.surface,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md,
  },
  appName: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.primary },
  title: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FONTS.sm, color: theme.textMuted },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.xl },

  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: SPACING.sm,
  },
  sectionText: {
    fontSize: FONTS.sm, color: theme.textSecondary, lineHeight: 22,
  },

  disclaimer: {
    flexDirection: 'row', gap: SPACING.sm,
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  disclaimerText: {
    flex: 1, fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 18,
  },

  footer: {
    backgroundColor: theme.surface,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    gap: SPACING.sm,
    ...SHADOWS.lg,
  },
  scrollHint: {
    textAlign: 'center', fontSize: FONTS.xs, color: theme.textMuted,
  },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: theme.primary,
    borderRadius: RADIUS.lg, paddingVertical: 16,
  },
  acceptBtnDisabled: {
    backgroundColor: theme.textMuted,
  },
  acceptText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  footerNote: {
    textAlign: 'center', fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 16,
  },
});
