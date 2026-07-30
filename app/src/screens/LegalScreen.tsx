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

export default function LegalScreen({ navigation, route }: any) {
  const { type } = route.params || { type: 'cgu' };
  const { theme, isDark } = useTheme();

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const getContent = () => {
    switch (type) {
      case 'cgu':
        return {
          title: "Conditions Générales d'Utilisation",
          lastUpdate: "30 juillet 2026",
          sections: [
            {
              title: "1. Objet et acceptation",
              content: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'usage de l'application Flash Market. En créant un compte ou en utilisant l'application, vous reconnaissez avoir lu, compris et accepté ces CGU. Si vous ne les acceptez pas, vous ne devez pas utiliser Flash Market."
            },
            {
              title: "2. Nature du service : une simple mise en relation",
              content: "Flash Market est une plateforme technique de mise en relation entre des utilisateurs qui souhaitent acheter, vendre ou proposer des biens et des services. Flash Market agit uniquement comme hébergeur des annonces et fournisseur d'outils de communication. Flash Market n'est ni vendeur, ni acheteur, ni intermédiaire de paiement, ni transporteur, ni mandataire des utilisateurs. Aucun contrat de vente n'est conclu avec Flash Market : les contrats se forment exclusivement entre les utilisateurs eux-mêmes."
            },
            {
              title: "3. Compte et identité",
              content: "L'accès se fait via un compte créé avec Google, Apple ou une adresse e-mail. Un numéro de téléphone de contact est requis pour permettre aux autres utilisateurs de vous joindre. Vous vous engagez à fournir des informations exactes et à jour, à garder votre compte confidentiel et à assumer la responsabilité de toutes les activités réalisées depuis celui-ci. L'application est réservée aux personnes majeures ou juridiquement capables."
            },
            {
              title: "4. Règles de publication et de conduite",
              content: "Vous vous engagez à ne publier que des annonces véridiques, précises et correspondant à un bien ou un service réellement disponible. Sont notamment interdits : les objets illégaux, dangereux ou réglementés (armes, drogues, médicaments, espèces protégées), les contrefaçons, les contenus frauduleux, trompeurs, injurieux ou portant atteinte aux droits d'autrui, ainsi que toute tentative d'arnaque, de spam ou de manipulation de la plateforme. Vous êtes seul responsable du contenu que vous publiez."
            },
            {
              title: "5. Transactions entre utilisateurs",
              content: "Toutes les transactions (négociation, prix, paiement, remise du bien, livraison, garanties, service après-vente) se déroulent directement et exclusivement entre les utilisateurs concernés. Flash Market n'est pas partie à ces transactions, ne les contrôle pas et n'en garantit ni la bonne fin, ni la qualité, ni la légalité, ni la sécurité."
            },
            {
              title: "6. Remises en main propre : votre responsabilité",
              content: "Lorsque des utilisateurs choisissent de se rencontrer pour une remise en main propre, ils le font sous leur seule et entière responsabilité. Flash Market n'organise pas ces rencontres et n'y participe pas. Il vous appartient d'agir de manière responsable et prudente : privilégiez un lieu public et fréquenté, en journée, accompagné si possible ; vérifiez soigneusement l'article ET le paiement (état réel du bien, authenticité des billets ou confirmation effective du transfert Mobile Money) AVANT de conclure. Flash Market ne pourra en aucun cas être tenu responsable d'un vol, d'une agression, d'un litige, d'une arnaque, de faux billets, d'un impayé, d'un bien non conforme ou de tout dommage survenu à l'occasion d'une rencontre ou d'un échange entre utilisateurs."
            },
            {
              title: "7. Rôle et limitation de responsabilité de Flash Market",
              content: "En sa qualité d'hébergeur, Flash Market ne vérifie pas a priori les annonces, l'identité réelle des utilisateurs, ni leur solvabilité. Flash Market est tenu à une simple obligation de moyens sur la disponibilité technique du service et ne saurait être responsable des contenus publiés par les utilisateurs, des comportements des utilisateurs, ni des dommages directs ou indirects résultant de l'usage de l'application ou des transactions qui y sont initiées."
            },
            {
              title: "8. Signalement et modération",
              content: "Des outils de signalement sont mis à votre disposition pour nous alerter sur une annonce ou un utilisateur. Flash Market se réserve le droit, sans préavis, de retirer une annonce, de suspendre ou de supprimer un compte qui contreviendrait aux présentes CGU ou à la loi, sans que cela n'ouvre droit à indemnité."
            },
            {
              title: "9. Propriété intellectuelle",
              content: "Vous conservez vos droits sur les contenus que vous publiez, mais vous accordez à Flash Market une licence gratuite et non exclusive pour les héberger et les afficher dans le cadre du service. La marque Flash Market, son logo et l'application demeurent la propriété exclusive de leur titulaire."
            },
            {
              title: "10. Services payants",
              content: "Certaines fonctionnalités (publication d'annonces selon la catégorie, abonnements Vendeur ou PRO) sont payantes. Elles sont régies par les Conditions Générales de Vente, que vous acceptez au moment de la souscription."
            },
            {
              title: "11. Modification des CGU et droit applicable",
              content: "Flash Market peut faire évoluer les présentes CGU ; la version applicable est celle en vigueur au moment de votre utilisation. Les CGU sont soumises au droit malien. À défaut de résolution amiable, tout litige relèvera des tribunaux compétents de Bamako."
            }
          ]
        };
      case 'cgv':
        return {
          title: "Conditions Générales de Vente",
          lastUpdate: "30 juillet 2026",
          sections: [
            {
              title: "1. Champ d'application",
              content: "Les présentes Conditions Générales de Vente (CGV) couvrent deux réalités distinctes : (A) les transactions conclues entre utilisateurs via la mise en relation Flash Market, auxquelles Flash Market n'est PAS partie ; et (B) les services payants vendus directement par Flash Market (publication d'annonces, abonnements Vendeur et PRO). Seuls les services du point (B) sont vendus par Flash Market."
            },
            {
              title: "2. Transactions entre utilisateurs (Flash Market n'est pas vendeur)",
              content: "Pour les biens et services proposés dans les annonces, le contrat de vente est conclu directement entre l'acheteur et le vendeur. Le prix, les modalités de paiement, la remise, la livraison éventuelle et les garanties sont librement fixés entre eux. Flash Market n'encaisse pas le prix de ces ventes, n'en est pas garant et n'offre aucune garantie de conformité, de qualité ou de bonne fin."
            },
            {
              title: "3. Remise en main propre et paiement direct",
              content: "Les paiements entre utilisateurs (espèces, Mobile Money ou autre) et les remises de biens s'effectuent en dehors de Flash Market, sous la responsabilité exclusive des parties. Avant de conclure, vérifiez impérativement l'article et l'effectivité du paiement. Flash Market ne peut être tenu responsable d'un impayé, de faux billets, d'un transfert non reçu, d'un bien non conforme ou non livré, ni d'aucun préjudice lié à un échange entre utilisateurs. Chacun doit gérer sa transaction de manière responsable."
            },
            {
              title: "4. Services payants de Flash Market",
              content: "Flash Market vend des services numériques permettant de valoriser vos annonces : frais de publication (variables selon la catégorie) et abonnements (Vendeur, PRO / Boutique) donnant accès à un quota d'annonces, à une visibilité renforcée et à des fonctionnalités additionnelles. Les caractéristiques et prix, exprimés en francs CFA (FCFA), sont indiqués dans l'application avant tout paiement."
            },
            {
              title: "5. Paiement des services",
              content: "Le paiement des services payants s'effectue via notre prestataire de paiement (PaiementPro), qui propose plusieurs moyens (carte bancaire, Orange Money et autres portefeuilles mobiles selon disponibilité). Le service est activé après confirmation du paiement. Flash Market ne conserve pas vos données bancaires, traitées par le prestataire de paiement."
            },
            {
              title: "6. Durée des abonnements",
              content: "Les abonnements sont souscrits pour une durée déterminée (par défaut 30 jours). Ils ne font l'objet d'aucune reconduction automatique ni de prélèvement récurrent : à l'échéance, l'abonnement expire et vous restez libre de le renouveler manuellement."
            },
            {
              title: "7. Rétractation et remboursement",
              content: "Les services payants sont des contenus numériques exécutés immédiatement (publication ou activation instantanée) : en conséquence, une fois l'annonce publiée ou l'abonnement activé, le service est réputé fourni et n'est pas remboursable. Un remboursement pourra être étudié uniquement en cas de dysfonctionnement technique imputable à Flash Market ayant empêché la fourniture du service payé."
            },
            {
              title: "8. Litiges entre utilisateurs",
              content: "En cas de litige lié à une transaction entre utilisateurs, Flash Market pourra, à titre de simple courtoisie, faciliter le dialogue, sans y être obligé et sans aucune obligation de résultat. La résolution du litige incombe aux utilisateurs concernés."
            },
            {
              title: "9. Droit applicable",
              content: "Les présentes CGV sont soumises au droit malien. À défaut d'accord amiable, tout litige relatif aux services payants relèvera des tribunaux compétents de Bamako."
            }
          ]
        };
      case 'privacy':
        return {
          title: "Protection des données",
          lastUpdate: "30 juillet 2026",
          sections: [
            {
              title: "1. Responsable du traitement",
              content: "Flash Market est responsable du traitement des données personnelles collectées via l'application. La présente politique explique quelles données nous traitons, pourquoi, avec qui elles sont partagées et quels sont vos droits."
            },
            {
              title: "2. Données que nous collectons",
              content: "Nous traitons : les données d'identité fournies lors de la connexion via Google, Apple ou e-mail (nom, prénom, adresse e-mail) ; votre numéro de téléphone de contact ; votre position géographique si vous l'autorisez ; le contenu que vous publiez (annonces, photos, description de boutique) ; vos messages échangés avec d'autres utilisateurs ; et des données techniques nécessaires au fonctionnement (identifiant de l'appareil, jeton de notification)."
            },
            {
              title: "3. Pourquoi nous les utilisons",
              content: "Vos données servent à : créer et gérer votre compte ; publier vos annonces et vous mettre en relation avec d'autres utilisateurs ; afficher les annonces proches de vous et calculer les distances lorsque la localisation est activée ; assurer la sécurité, la modération et la prévention des fraudes ; vous envoyer des notifications utiles (messages, suivi d'annonces) ; et traiter le paiement des services payants."
            },
            {
              title: "4. Numéro de téléphone visible",
              content: "Votre numéro de téléphone de contact est, par nature du service, communiqué aux autres utilisateurs intéressés par vos annonces afin qu'ils puissent vous joindre. C'est une caractéristique essentielle d'une marketplace de proximité. Ne renseignez que le numéro par lequel vous acceptez d'être contacté."
            },
            {
              title: "5. Partage avec des prestataires",
              content: "Nous ne vendons jamais vos données. Nous nous appuyons sur des prestataires techniques agissant pour notre compte : Supabase (hébergement de la base de données et des fichiers), PaiementPro (traitement des paiements des services payants), ainsi que les services d'Apple, Google et Expo (authentification et notifications push). Ces prestataires n'accèdent qu'aux données nécessaires à leur mission."
            },
            {
              title: "6. Localisation",
              content: "La localisation n'est utilisée que si vous l'autorisez, pour trier et afficher les annonces proches de vous. Vous pouvez la désactiver à tout moment dans les réglages de votre téléphone ; l'application reste utilisable sans elle."
            },
            {
              title: "7. Durée de conservation",
              content: "Vos données sont conservées tant que votre compte est actif. Lorsque vous supprimez votre compte, vos données personnelles sont supprimées ou anonymisées, sous réserve des obligations légales de conservation éventuelles (par exemple justificatifs de paiement)."
            },
            {
              title: "8. Sécurité",
              content: "Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour protéger vos données contre l'accès non autorisé, la perte ou l'altération. Aucun système n'étant infaillible, nous ne pouvons toutefois garantir une sécurité absolue."
            },
            {
              title: "9. Vos droits",
              content: "Vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition sur vos données. Vous pouvez modifier vos informations depuis votre profil et demander la suppression de votre compte. Pour toute demande, contactez-nous via l'application."
            },
            {
              title: "10. Mineurs et modifications",
              content: "L'application est réservée aux personnes majeures ou juridiquement capables ; nous ne collectons pas sciemment de données de mineurs. La présente politique peut être mise à jour ; la version applicable est celle affichée dans l'application au moment de votre utilisation."
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
