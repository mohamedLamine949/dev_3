import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Gradient from '../components/Gradient';
import { FONTS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useInvitations } from '../hooks/useInvitations';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { hapticLight } from '../lib/haptics';
import { CONCOURS_MONTANT, PALIERS_BOOST, prochainObjectif, partagerSurWhatsApp, partagerAutrement } from '../lib/partageInvitation';

/**
 * Parrainage ouvert : mon code, mes filleuls, mes boosts gagnés, et ma
 * position dans le concours de lancement.
 *
 * L'écran répond à trois questions, dans cet ordre, parce que c'est l'ordre
 * dans lequel elles viennent : quel est mon code ? qu'est-ce que ça m'a
 * rapporté ? qu'est-ce qu'il me manque pour le concours ?
 */
export default function InvitationsScreen({ navigation }: { navigation: any }) {
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const { stats, loading, indisponible, refetch } = useInvitations(session?.user?.id);
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refetch);
    return unsubscribe;
  }, [navigation, refetch]);

  const partagerWhatsApp = () => {
    if (!stats?.code) return;
    hapticLight();
    partagerSurWhatsApp(stats.code);
  };

  const partagerAilleurs = () => {
    if (!stats?.code) return;
    hapticLight();
    partagerAutrement(stats.code);
  };

  if (!session) {
    return (
      <View style={[styles.ecran, styles.centre, { paddingTop: insets.top }]}>
        <Ionicons name="gift-outline" size={64} color={theme.textMuted} />
        <Text style={styles.videTitre}>Connectez-vous</Text>
        <Text style={styles.videTexte}>Le parrainage demande un compte.</Text>
        <TouchableOpacity style={styles.boutonPlein} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.boutonPleinTexte}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.ecran, styles.centre]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (indisponible || !stats) {
    return (
      <View style={[styles.ecran, styles.centre, { paddingTop: insets.top }]}>
        <Ionicons name="time-outline" size={64} color={theme.textMuted} />
        <Text style={styles.videTitre}>Bientôt disponible</Text>
        <Text style={styles.videTexte}>Le parrainage arrive très vite.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.ecran}
      contentContainerStyle={{ paddingBottom: tabBarSpace + SPACING.xl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.entete, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retour}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.enteteTitre}>Parrainage</Text>
      </View>

      {/* 1. Le concours, en tête : 100 000 FCFA est ce qui donne envie
          d'inviter. Le boost vient ensuite. Les cinq ronds se comptent
          d'un coup d'œil, sans avoir à lire. */}
      <Gradient
        colors={['#7C2D12', '#B45309', '#D97706']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.concours}
      >
        <Ionicons name="trophy" size={120} color="rgba(255,255,255,0.12)" style={styles.concoursFiligrane} />
        <Text style={styles.concoursSurtitre}>Concours de lancement</Text>
        <Text style={styles.concoursMontant} numberOfLines={1} adjustsFontSizeToFit>Gagnez {CONCOURS_MONTANT}</Text>
        <Text style={styles.concoursTexte}>
          {stats.concoursParticipe
            ? 'Vous participez au tirage. Continuez d\'inviter !'
            : `Invitez ${stats.concoursRequis} amis qui publient une annonce, et participez au tirage.`}
        </Text>
        <View style={styles.ronds}>
          {Array.from({ length: stats.concoursRequis }).map((_, i) => (
            <View key={i} style={[styles.rond, i < stats.filleulsValides && styles.rondPlein]}>
              {i < stats.filleulsValides
                ? <Ionicons name="checkmark" size={18} color="#B45309" />
                : PALIERS_BOOST.includes(i + 1) && <Ionicons name="flame" size={16} color="#fff" />}
            </View>
          ))}
        </View>
        <Text style={styles.concoursCompte}>
          {stats.concoursParticipe
            ? 'Vous êtes inscrit au tirage'
            : `${stats.filleulsValides} sur ${stats.concoursRequis} — ${prochainObjectif(stats.filleulsValides).toLowerCase()}`}
        </Text>
        {/* Règlement public : exigé par les stores pour tout concours dans une
            application, et c'est la preuve que les 100 000 FCFA sont réels. */}
        <TouchableOpacity
          onPress={() => Linking.openURL('https://app-flashmarket.com/concours.html')}
          style={styles.reglement}
          activeOpacity={0.7}
        >
          <Text style={styles.reglementTexte}>Lire le règlement</Text>
        </TouchableOpacity>
      </Gradient>

      {/* 2. Le code, gros et lisible à voix haute, avec le partage WhatsApp
          juste dessous : c'est là que les gens s'envoient tout. */}
      <View style={styles.carteCode}>
        <Text style={styles.carteCodeLabel}>Votre code</Text>
        <Text style={styles.code}>{stats.code}</Text>
        <TouchableOpacity activeOpacity={0.9} onPress={partagerWhatsApp} style={styles.boutonWhatsApp}>
          <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          <Text style={styles.boutonPartageTexte}>Envoyer sur WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={partagerAilleurs} style={styles.boutonAutre}>
          <Ionicons name="share-social-outline" size={18} color={theme.textSecondary} />
          <Text style={styles.boutonAutreTexte}>Partager autrement</Text>
        </TouchableOpacity>
      </View>

      {/* 3. La règle, en trois lignes et en images. Un ami ne compte que
          lorsqu'il a publié sa première annonce. */}
      <View style={styles.bloc}>
        <View style={styles.regleLigne}>
          <View style={styles.regleIcone}>
            <Ionicons name="person-add" size={20} color={theme.primary} />
          </View>
          <Text style={styles.regleTexte}>
            Un ami compte quand il s'inscrit avec votre code et publie sa première annonce
          </Text>
        </View>
        <View style={styles.regleLigne}>
          <View style={[styles.regleIcone, { backgroundColor: 'rgba(234,88,12,0.12)' }]}>
            <Ionicons name="flame" size={20} color="#EA580C" />
          </View>
          <Text style={styles.regleTexte}><Text style={styles.regleGras}>3 amis</Text> : un boost gratuit de 48 h</Text>
        </View>
        <View style={styles.regleLigne}>
          <View style={[styles.regleIcone, { backgroundColor: 'rgba(180,83,9,0.14)' }]}>
            <Ionicons name="trophy" size={20} color="#B45309" />
          </View>
          <Text style={styles.regleTexte}><Text style={styles.regleGras}>5 amis</Text> : un 2e boost et le tirage de {CONCOURS_MONTANT}</Text>
        </View>
      </View>

      {/* 4. Ce que ça a donné. */}
      <View style={styles.compteurs}>
        <View style={styles.compteur}>
          <Text style={styles.compteurValeur}>{stats.filleulsValides}</Text>
          <Text style={styles.compteurLabel}>Parrainages{'\n'}réussis</Text>
        </View>
        <View style={styles.compteur}>
          <Text style={styles.compteurValeur}>{stats.filleulsEnAttente}</Text>
          <Text style={styles.compteurLabel}>En attente{'\n'}d'annonce</Text>
        </View>
        <View style={[styles.compteur, styles.compteurBoost]}>
          <Text style={[styles.compteurValeur, { color: '#EA580C' }]}>{stats.boostsDisponibles}</Text>
          <Text style={styles.compteurLabel}>Boosts{'\n'}à utiliser</Text>
        </View>
      </View>

      {stats.boostsDisponibles > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.utiliserBoost}
          onPress={() => { hapticLight(); navigation.navigate('BoosterMesAnnonces'); }}
        >
          <Ionicons name="flame" size={20} color="#fff" />
          <Text style={styles.utiliserBoostTexte}>
            Utiliser {stats.boostsDisponibles > 1 ? 'mes boosts' : 'mon boost'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: theme.background },
  centre: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },

  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  retour: { padding: SPACING.xs },
  enteteTitre: { ...TYPOGRAPHY.h3, color: theme.textPrimary },

  carteCode: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  carteCodeLabel: {
    fontSize: FONTS.sm,
    color: theme.textSecondary,
    fontWeight: FONTS.semibold,
  },
  code: {
    fontSize: 44,
    fontWeight: FONTS.bold,
    letterSpacing: 6,
    color: theme.primary,
    marginVertical: SPACING.md,
  },
  boutonPartage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 52,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
  },
  boutonPartageTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  boutonWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 56,
    alignSelf: 'stretch',
    borderRadius: RADIUS.lg,
    backgroundColor: '#25D366',
  },
  boutonAutre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    height: 48,
    alignSelf: 'stretch',
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  boutonAutreTexte: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },

  bloc: {
    marginHorizontal: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
    gap: SPACING.sm,
  },
  regleLigne: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  regleIcone: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5',
    alignItems: 'center', justifyContent: 'center',
  },
  regleTexte: { flex: 1, fontSize: FONTS.md, color: theme.textPrimary, lineHeight: 21 },
  regleGras: { fontWeight: FONTS.extrabold },

  compteurs: {
    flexDirection: 'row',
    gap: SPACING.md,
    margin: SPACING.lg,
  },
  compteur: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
    alignItems: 'center',
  },
  compteurBoost: { borderColor: '#F59E0B', borderWidth: 1.5 },
  compteurValeur: { fontSize: 30, fontWeight: FONTS.bold, color: theme.textPrimary },
  compteurLabel: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  utiliserBoost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: '#EA580C',
  },
  utiliserBoostTexte: { flex: 1, fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },

  concours: {
    margin: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  concoursFiligrane: {
    position: 'absolute',
    right: -18,
    bottom: -22,
    transform: [{ rotate: '12deg' }],
  },
  concoursSurtitre: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  concoursMontant: {
    fontSize: 36,
    fontWeight: FONTS.extrabold,
    color: '#fff',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  concoursTexte: {
    fontSize: FONTS.md,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 21,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  ronds: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  rond: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rondPlein: { backgroundColor: '#fff', borderColor: '#fff' },
  reglement: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  reglementTexte: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff', textDecorationLine: 'underline' },
  concoursCompte: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
    marginTop: SPACING.md,
  },

  videTitre: { ...TYPOGRAPHY.h3, color: theme.textPrimary, marginTop: SPACING.lg },
  videTexte: {
    fontSize: FONTS.md,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  boutonPlein: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonPleinTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
