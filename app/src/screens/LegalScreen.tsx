import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

interface Props {
  navigation: any;
  route: {
    params: {
      type: 'cgu' | 'cgv' | 'privacy';
    };
  };
}

import { useTheme } from '../contexts/ThemeContext';

export default function LegalScreen({ navigation, route }: Props) {
  const { type } = route.params;
  const { theme, isDark } = useTheme();

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const getContent = () => {
    switch (type) {
      case 'cgu':
        return {
          title: "Conditions Générales d'Utilisation",
          lastUpdate: "25 Avril 2026",
          sections: [
            {
              title: "1. Acceptation des conditions",
              content: "En accédant et en utilisant Flash Market, vous acceptez d'être lié par les présentes Conditions Générales d'Utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services."
            },
            {
              title: "2. Description du service",
              content: "Flash Market est une plateforme de mise en relation entre acheteurs et vendeurs au Mali. Nous facilitons la publication d'annonces et la communication, mais nous n'intervenons pas dans les transactions finales."
            },
            {
              title: "3. Compte utilisateur",
              content: "Pour utiliser certaines fonctionnalités, vous devez créer un compte. Vous êtes responsable du maintien de la confidentialité de vos identifiants et de toutes les activités liées à votre compte."
            },
            {
              title: "4. Règles de publication",
              content: "Les utilisateurs s'engagent à ne publier que des informations véridiques, à ne pas proposer de produits illégaux ou interdits, et à respecter les droits de propriété intellectuelle des tiers."
            },
            {
              title: "5. Limitation de responsabilité",
              content: "Flash Market ne peut être tenu responsable de la qualité, de la sécurité ou de la légalité des articles proposés, ni de la capacité des vendeurs à vendre ou des acheteurs à payer."
            }
          ]
        };
      case 'cgv':
        return {
          title: "Conditions Générales de Vente",
          lastUpdate: "25 Avril 2026",
          sections: [
            {
              title: "1. Nature des transactions",
              content: "Flash Market n'est pas le vendeur des produits listés. Les contrats de vente sont conclus directement entre l'acheteur et le vendeur. Les conditions de vente (prix, livraison, garantie) sont déterminées par les parties."
            },
            {
              title: "2. Paiements",
              content: "Flash Market peut proposer des services de paiement sécurisés. Les frais éventuels liés à ces services sont indiqués lors de la transaction."
            },
            {
              title: "3. Livraison",
              content: "La livraison des articles est de la responsabilité du vendeur et de l'acheteur. Flash Market encourage les rencontres dans des lieux publics pour les remises en main propre."
            },
            {
              title: "4. Litiges",
              content: "En cas de litige entre un acheteur et un vendeur, Flash Market pourra tenter une médiation mais n'a aucune obligation de résultat."
            }
          ]
        };
      case 'privacy':
        return {
          title: "Protection des données",
          lastUpdate: "25 Avril 2026",
          sections: [
            {
              title: "1. Collecte des données",
              content: "Nous collectons les informations que vous nous fournissez lors de la création de votre compte (nom, prénom, numéro de téléphone) et lors de l'utilisation de nos services (annonces, messages, localisation)."
            },
            {
              title: "2. Utilisation des données",
              content: "Vos données sont utilisées pour assurer le bon fonctionnement de la plateforme, améliorer nos services, assurer la sécurité des utilisateurs et vous envoyer des notifications pertinentes."
            },
            {
              title: "3. Partage des données",
              content: "Nous ne vendons pas vos données personnelles à des tiers. Vos informations de contact ne sont partagées avec d'autres utilisateurs que dans le cadre des transactions que vous initiez."
            },
            {
              title: "4. Vos droits",
              content: "Conformément à la législation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles. Vous pouvez exercer ces droits depuis les paramètres de votre compte."
            },
            {
              title: "5. Cookies",
              content: "Nous utilisons des cookies et des technologies similaires pour améliorer votre expérience, analyser le trafic et personnaliser le contenu."
            }
          ]
        };
      default:
        return { title: "Document Légal", lastUpdate: "", sections: [] };
    }
  };

  const data = getContent();

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.surface} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Légal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.lastUpdate}>Dernière mise à jour : {data.lastUpdate}</Text>

        {data.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionText}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Flash Market - Marketplace Malienne
          </Text>
          <Text style={styles.footerCopyright}>
            © 2026 Tous droits réservés
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
  },
  headerTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: SPACING.xl,
    paddingBottom: 60,
  },
  title: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.extrabold,
    color: theme.textPrimary,
    marginBottom: SPACING.xs,
  },
  lastUpdate: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    marginBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
    marginBottom: SPACING.sm,
  },
  sectionText: {
    fontSize: FONTS.md,
    color: theme.textSecondary,
    lineHeight: 24,
  },
  footer: {
    marginTop: SPACING.xxxl,
    paddingTop: SPACING.xxl,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: theme.textMuted,
  },
  footerCopyright: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginTop: 4,
  },
});
