import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
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

/** Montant du concours de lancement, en FCFA. */
const CONCOURS_MONTANT = '100 000 F';

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

  const partager = async () => {
    if (!stats?.code) return;
    hapticLight();
    await Share.share({
      message:
        `Rejoins-moi sur Flash Market ! Achete et vends pres de chez toi.\n\n` +
        `Mon code de parrainage : ${stats.code}\n` +
        `Saisis-le a l'inscription.`,
    });
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

  const progression = Math.min(stats.filleulsValides / stats.concoursRequis, 1);

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

      {/* 1. Le code — l'élément le plus gros de l'écran : c'est ce qu'on
          vient chercher, et il doit se lire à voix haute sans hésiter. */}
      <View style={styles.carteCode}>
        <Text style={styles.carteCodeLabel}>Votre code</Text>
        <Text style={styles.code}>{stats.code}</Text>
        <TouchableOpacity activeOpacity={0.9} onPress={partager}>
          <Gradient
            colors={['#0b4023', '#15803d', '#1f9450']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.boutonPartage}
          >
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={styles.boutonPartageTexte}>Partager mon code</Text>
          </Gradient>
        </TouchableOpacity>
      </View>

      {/* 2. La règle, en une phrase et en image. */}
      <View style={styles.bloc}>
        <View style={styles.regleLigne}>
          <View style={styles.regleIcone}>
            <Ionicons name="person-add" size={20} color={theme.primary} />
          </View>
          <Text style={styles.regleTexte}>
            Une personne s'inscrit avec votre code et publie sa première annonce
          </Text>
        </View>
        <Ionicons name="arrow-down" size={20} color={theme.textMuted} style={{ alignSelf: 'center' }} />
        <View style={styles.regleLigne}>
          <View style={[styles.regleIcone, { backgroundColor: 'rgba(234,88,12,0.12)' }]}>
            <Ionicons name="flame" size={20} color="#EA580C" />
          </View>
          <Text style={styles.regleTexte}>Vous gagnez un boost gratuit de 48 h</Text>
        </View>
      </View>

      {/* 3. Ce que ça a donné. */}
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

      {/* 4. Le concours. */}
      <View style={styles.concours}>
        <View style={styles.concoursEntete}>
          <Ionicons name="trophy" size={22} color="#B45309" />
          <Text style={styles.concoursTitre}>Concours de lancement</Text>
        </View>
        <Text style={styles.concoursTexte}>
          {stats.concoursParticipe
            ? `Vous participez au tirage. Un gagnant recevra ${CONCOURS_MONTANT} en main propre, en vidéo.`
            : `Parrainez ${stats.concoursRequis} personnes pour participer au tirage de ${CONCOURS_MONTANT}, remis en main propre et filmé.`}
        </Text>

        <View style={styles.jauge}>
          <View style={[styles.jaugeRemplie, { width: `${progression * 100}%` }]} />
        </View>
        <Text style={styles.jaugeTexte}>
          {stats.concoursParticipe
            ? 'Vous êtes inscrit au tirage'
            : `${stats.filleulsValides} sur ${stats.concoursRequis} — encore ${stats.concoursManque}`}
        </Text>
      </View>
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
    margin: SPACING.lg,
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
    marginHorizontal: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: isDark ? 'rgba(180,83,9,0.12)' : '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  concoursEntete: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  concoursTitre: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  concoursTexte: {
    fontSize: FONTS.md,
    color: theme.textSecondary,
    lineHeight: 21,
    marginTop: SPACING.sm,
  },
  jauge: {
    height: 10,
    borderRadius: 5,
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#FDE68A',
    marginTop: SPACING.lg,
    overflow: 'hidden',
  },
  jaugeRemplie: { height: '100%', borderRadius: 5, backgroundColor: '#B45309' },
  jaugeTexte: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    marginTop: SPACING.sm,
    textAlign: 'center',
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
