import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Gradient from '../components/Gradient';
import { FONTS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { BOOST_PRIX, BOOST_DURATION_HOURS } from '../hooks/useBoost';
import { formatPrix } from '../lib/format';
import { hapticLight } from '../lib/haptics';
import { marquerGuideVu } from '../lib/tutoriel';
import { supabase, Annonce } from '../lib/supabase';
import { formatPrixCompact } from '../lib/format';
import { CONCOURS_MONTANT } from '../lib/partageInvitation';

/**
 * Guide d'accueil — sept écrans, une idée par écran.
 *
 * À quoi il sert, concrètement : deux boosts seulement ont été vendus depuis
 * l'ouverture, et beaucoup de vendeurs rangent leurs annonces au hasard
 * (montres en « Téléphonie »). Ce ne sont pas des problèmes de code : personne
 * n'a jamais expliqué à ces gens comment l'application fonctionne. Une
 * campagne d'acquisition est en cours ; les arrivants doivent comprendre en
 * moins d'une minute.
 *
 * Règles de conception suivies à la lettre (§ règles permanentes) :
 *   - une seule idée et un seul bouton par écran ;
 *   - tout se voit : chaque écran montre un dessin de ce dont il parle, le
 *     texte ne fait que confirmer — le public lit peu ;
 *   - aucun geste caché : on peut glisser, mais le bouton suffit ;
 *   - « Passer » est visible en permanence, jamais grisé ni caché.
 *
 * Les prix ne sont PAS écrits en dur : ils viennent de la configuration
 * (`app_config`). Publier est gratuit tant que la monétisation est en offre
 * de lancement, et l'écran doit le dire — un guide qui annonce un prix faux
 * est pire que pas de guide.
 */

const { width: LARGEUR } = Dimensions.get('window');

interface Props {
  /**
   * Fourni au premier lancement (GardeTutoriel). Absent quand le guide est
   * rouvert depuis le compte : on revient alors simplement en arrière.
   */
  onTermine?: () => void;
  navigation?: any;
}

interface Etape {
  cle: string;
  titre: string;
  texte: string;
  illustration: React.ReactNode;
}

export default function TutorielScreen({ onTermine, navigation }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { paymentsEnabled, boostPaymentsEnabled, loading: configEnCours } = useAppConfig();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [page, setPage] = useState(0);
  const listeRef = useRef<FlatList>(null);

  /**
   * Vraies annonces de Flash Market, pour illustrer le guide.
   *
   * Plutôt que des photos de banque d'images — étrangères au Mali, et dont
   * les droits se paient — le guide montre ce que les gens vendent
   * réellement ici. L'exemple devient une preuve : il y a déjà du monde.
   *
   * Si le réseau ne répond pas, les cartes gardent leur dessin : le guide
   * doit s'afficher même hors ligne, c'est le tout premier écran de
   * quelqu'un qui vient d'installer l'application.
   */
  const [exemples, setExemples] = useState<Annonce[]>([]);

  React.useEffect(() => {
    let monte = true;
    supabase
      .from('annonces')
      .select('id, titre, prix, images:images_annonce(image_url, ordre)')
      .eq('statut', 'active')
      .eq('est_payee', true)
      .order('date_creation', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!monte || error || !data) return;
        // Seules les annonces avec photo peuvent illustrer quoi que ce soit.
        setExemples((data as any[]).filter(a => a.images?.length > 0).slice(0, 4) as Annonce[]);
      });
    return () => { monte = false; };
  }, []);

  const terminer = async () => {
    hapticLight();
    await marquerGuideVu();
    if (onTermine) onTermine();
    else navigation?.goBack();
  };

  // ── Illustrations ────────────────────────────────────────────────────────
  // Dessinées en composants plutôt qu'en images : elles suivent le thème
  // sombre, ne pèsent rien dans le bundle, et ne se périment pas quand
  // l'interface change de couleur.

  const CarteExemple = ({
    titre, prix, badge, annonce,
  }: { titre: string; prix: string; badge?: boolean; annonce?: Annonce }) => {
    const photo = annonce?.images?.[0]?.image_url;
    return (
      <View style={styles.carteExemple}>
        <View style={styles.carteImage}>
          {photo
            ? <Image source={{ uri: photo }} style={styles.cartePhoto} />
            : <Ionicons name="image-outline" size={26} color={theme.border} />}
          {badge && (
            <View style={styles.carteBadge}>
              <Ionicons name="flame" size={10} color="#fff" />
              <Text style={styles.carteBadgeTexte}>En avant</Text>
            </View>
          )}
        </View>
        <Text style={styles.carteTitre} numberOfLines={1}>{annonce?.titre || titre}</Text>
        <Text style={styles.cartePrix}>
          {annonce ? formatPrixCompact(annonce.prix) : prix}
        </Text>
      </View>
    );
  };

  const illustrationBienvenue = (
    <View style={styles.rangee}>
      <CarteExemple titre="Téléphone" prix="75 000 F" annonce={exemples[0]} />
      <CarteExemple titre="Mouton" prix="150 000 F" annonce={exemples[1]} />
    </View>
  );

  const illustrationRecherche = (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.barreRecherche}>
        <Ionicons name="search" size={20} color={theme.textMuted} />
        <Text style={styles.barreRechercheTexte}>iPhone</Text>
      </View>
      <View style={styles.cerclesRangee}>
        {[
          { icone: 'phone-portrait-outline', couleur: '#3B82F6', nom: 'Téléphonie' },
          { icone: 'shirt-outline', couleur: '#EC4899', nom: 'Mode' },
          { icone: 'car-outline', couleur: '#F59E0B', nom: 'Voitures' },
        ].map(c => (
          <View key={c.nom} style={{ alignItems: 'center' }}>
            <View style={[styles.cercle, { backgroundColor: c.couleur }]}>
              <Ionicons name={c.icone as any} size={24} color="#fff" />
            </View>
            <Text style={styles.cercleTexte}>{c.nom}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const illustrationPublier = (
    <View style={{ width: '100%', gap: SPACING.md }}>
      {[
        { n: '1', icone: 'camera', texte: 'Une photo de l\'article' },
        { n: '2', icone: 'pricetag', texte: 'Un titre et un prix' },
        { n: '3', icone: 'grid', texte: 'La catégorie' },
      ].map(e => (
        <View key={e.n} style={styles.etapeLigne}>
          <View style={styles.etapeNumero}>
            <Text style={styles.etapeNumeroTexte}>{e.n}</Text>
          </View>
          <Ionicons name={e.icone as any} size={22} color={theme.primary} />
          <Text style={styles.etapeTexte}>{e.texte}</Text>
        </View>
      ))}
    </View>
  );

  const illustrationCategorie = (
    <View style={{ width: '100%', alignItems: 'center', gap: SPACING.md }}>
      <View style={styles.objetLigne}>
        <Ionicons name="watch-outline" size={30} color={theme.textPrimary} />
        <Text style={styles.objetTexte}>Une montre</Text>
      </View>
      <View style={[styles.choixLigne, styles.choixBon]}>
        <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
        <Text style={styles.choixTexte}>Mode & Beauté</Text>
      </View>
      <View style={[styles.choixLigne, styles.choixMauvais]}>
        <Ionicons name="close-circle" size={24} color="#DC2626" />
        <Text style={[styles.choixTexte, styles.choixTexteMauvais]}>Téléphonie</Text>
      </View>
    </View>
  );

  const illustrationBoost = (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.tendancesEntete}>
        <Ionicons name="flame" size={16} color="#EA580C" />
        <Text style={styles.tendancesTitre}>Tendances</Text>
      </View>
      <View style={styles.rangee}>
        <CarteExemple titre="Votre annonce" prix="25 000 F" badge annonce={exemples[2]} />
        <CarteExemple titre="Ordinateur" prix="120 000 F" badge annonce={exemples[3]} />
      </View>
    </View>
  );

  // Vraie photo contre image copiée sur Internet. Les images de Google
  // (photo de catalogue, fond blanc parfait) font fuir les acheteurs : ils
  // veulent voir l'article qu'ils vont réellement recevoir.
  const illustrationPhotos = (
    <View style={{ width: '100%', alignItems: 'center', gap: SPACING.md }}>
      <View style={[styles.choixLigne, styles.choixBon]}>
        <Ionicons name="camera" size={24} color="#16A34A" />
        <Text style={[styles.choixTexte, { flex: 1 }]}>Votre photo, prise par vous</Text>
        <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
      </View>
      <View style={[styles.choixLigne, styles.choixMauvais]}>
        <Ionicons name="globe-outline" size={24} color="#DC2626" />
        <Text style={[styles.choixTexte, styles.choixTexteMauvais, { flex: 1 }]}>Image trouvée sur Internet</Text>
        <Ionicons name="close-circle" size={24} color="#DC2626" />
      </View>
    </View>
  );

  // Le concours : le montant en très grand, et cinq ronds pour « 5 amis ».
  const illustrationConcours = (
    <Gradient
      colors={['#7C2D12', '#B45309', '#D97706']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.concoursCarte}
    >
      <Ionicons name="trophy" size={40} color="#fff" />
      <Text style={styles.concoursMontant}>{CONCOURS_MONTANT}</Text>
      <View style={styles.concoursRonds}>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={styles.concoursRond}>
            <Ionicons name="person" size={16} color="#B45309" />
          </View>
        ))}
      </View>
      <Text style={styles.concoursLegende}>5 amis = 1 ticket pour le tirage</Text>
    </Gradient>
  );

  // ── Contenu ──────────────────────────────────────────────────────────────

  const ETAPES: Etape[] = [
    {
      cle: 'bienvenue',
      titre: 'Bienvenue sur Flash Market',
      texte: 'Achetez et vendez tout ce que vous voulez, près de chez vous.',
      illustration: illustrationBienvenue,
    },
    {
      cle: 'chercher',
      titre: 'Cherchez ce que vous voulez',
      texte: 'Écrivez le nom de l\'article : « iPhone », « mouton », « terrain ». Ou touchez une catégorie.',
      illustration: illustrationRecherche,
    },
    {
      cle: 'publier',
      titre: 'Vendez en 3 étapes',
      // Tant que la configuration n'est pas lue, `paymentsEnabled` vaut `true`
      // par défaut : on ne promet donc la gratuité qu'une fois la réponse
      // arrivée. Annoncer « gratuit » à tort serait pire que ne rien dire.
      texte: !configEnCours && !paymentsEnabled
        ? 'Une photo, un titre, une catégorie. Publier est gratuit en ce moment.'
        : 'Une photo, un titre, une catégorie. Votre annonce est en ligne.',
      illustration: illustrationPublier,
    },
    {
      cle: 'photos',
      titre: 'Montrez le vrai article',
      texte: 'Prenez vous-même la photo de ce que vous vendez. Les images copiées sur Google font fuir les acheteurs : ils veulent voir ce qu\'ils vont recevoir.',
      illustration: illustrationPhotos,
    },
    {
      cle: 'categorie',
      titre: 'Choisissez la bonne catégorie',
      texte: 'Une montre va dans Mode & Beauté, pas dans Téléphonie. Bien rangée, votre annonce est trouvée par les acheteurs.',
      illustration: illustrationCategorie,
    },
    {
      cle: 'boost',
      titre: 'Boostez pour vendre plus vite',
      texte: boostPaymentsEnabled
        ? `Pour ${formatPrix(BOOST_PRIX)}, votre annonce passe dans « Tendances », tout en haut de l'accueil, pendant ${BOOST_DURATION_HOURS} heures.`
        : `Votre annonce passe dans « Tendances », tout en haut de l'accueil, pendant ${BOOST_DURATION_HOURS} heures. C'est offert en ce moment.`,
      illustration: illustrationBoost,
    },
    {
      cle: 'concours',
      titre: `Gagnez ${CONCOURS_MONTANT}`,
      texte: 'Donnez votre code à vos amis. Chaque ami qui publie une annonce vous offre un boost gratuit. À 5 amis, vous participez au tirage.',
      illustration: illustrationConcours,
    },
  ];

  const dernier = page === ETAPES.length - 1;

  const suivant = () => {
    if (dernier) {
      terminer();
      return;
    }
    hapticLight();
    listeRef.current?.scrollToIndex({ index: page + 1, animated: true });
  };

  // Chaque page défile verticalement : sur un petit écran (iPhone SE, vieux
  // Android), illustration + titre + texte dépassent la hauteur disponible et
  // seraient coupés, bouton compris. Sur un grand écran, `flexGrow` garde le
  // contenu centré comme s'il n'y avait pas de défilement.
  const renderEtape = ({ item }: { item: Etape }) => (
    <ScrollView
      style={{ width: LARGEUR }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.zoneIllustration}>{item.illustration}</View>
      <Text style={styles.titre}>{item.titre}</Text>
      <Text style={styles.texte}>{item.texte}</Text>
    </ScrollView>
  );

  return (
    <View style={[styles.ecran, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* « Passer » reste visible du premier au dernier écran : personne ne
          doit avoir l'impression d'être enfermé dans un tutoriel. */}
      <View style={styles.hautDePage}>
        <TouchableOpacity onPress={terminer} activeOpacity={0.7} style={styles.passerZone}>
          <Text style={styles.passer}>Passer</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listeRef}
        style={{ flex: 1 }}
        data={ETAPES}
        renderItem={renderEtape}
        keyExtractor={item => item.cle}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          setPage(Math.round(e.nativeEvent.contentOffset.x / LARGEUR));
        }}
        getItemLayout={(_, index) => ({ length: LARGEUR, offset: LARGEUR * index, index })}
      />

      <View style={[styles.basDePage, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <View style={styles.points}>
          {ETAPES.map((e, i) => (
            <View key={e.cle} style={[styles.point, i === page && styles.pointActif]} />
          ))}
        </View>

        {/* Un seul bouton, pleine largeur, toujours au même endroit. */}
        <TouchableOpacity activeOpacity={0.9} onPress={suivant}>
          <Gradient
            colors={['#0b4023', '#15803d', '#1f9450']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bouton}
          >
            <Text style={styles.boutonTexte}>{dernier ? 'C\'est parti' : 'Suivant'}</Text>
            <Ionicons name={dernier ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
          </Gradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: theme.background,
  },
  hautDePage: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  passerZone: {
    // Zone tactile large (§ règles de conception) : le mot seul serait trop
    // petit pour un doigt.
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  passer: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: theme.textMuted,
  },

  page: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneIllustration: {
    minHeight: 220,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titre: {
    ...TYPOGRAPHY.h2,
    color: theme.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  texte: {
    fontSize: FONTS.md,
    lineHeight: 24,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },

  // Cartes d'exemple
  rangee: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  carteExemple: {
    width: 130,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: theme.borderLight,
    paddingBottom: SPACING.sm,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  carteImage: {
    width: '100%',
    height: 100,
    backgroundColor: theme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartePhoto: {
    width: '100%',
    height: '100%',
  },
  carteBadge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: '#EA580C',
  },
  carteBadgeTexte: {
    fontSize: 9,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  carteTitre: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.sm,
  },
  cartePrix: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: theme.primary,
    marginHorizontal: SPACING.sm,
  },

  // Recherche
  barreRecherche: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  barreRechercheTexte: {
    fontSize: FONTS.md,
    color: theme.textPrimary,
    fontWeight: FONTS.semibold,
  },
  cerclesRangee: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.xl,
  },
  cercle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cercleTexte: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    marginTop: SPACING.xs,
  },

  // Étapes de publication
  etapeLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  etapeNumero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etapeNumeroTexte: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  etapeTexte: {
    flex: 1,
    fontSize: FONTS.md,
    color: theme.textPrimary,
    fontWeight: FONTS.semibold,
  },

  // Bonne catégorie
  objetLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  objetTexte: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  choixLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  choixBon: {
    backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#F0FDF4',
    borderColor: '#16A34A',
  },
  choixMauvais: {
    backgroundColor: isDark ? 'rgba(220,38,38,0.10)' : '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  choixTexte: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  choixTexteMauvais: {
    textDecorationLine: 'line-through',
    color: theme.textMuted,
  },

  // Boost
  tendancesEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  tendancesTitre: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },

  // Concours
  concoursCarte: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    ...SHADOWS.md,
  },
  concoursMontant: {
    fontSize: 40,
    fontWeight: FONTS.extrabold,
    color: '#fff',
    marginTop: SPACING.sm,
  },
  concoursRonds: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  concoursRond: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  concoursLegende: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
    marginTop: SPACING.md,
  },

  // Bas de page
  basDePage: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  points: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  point: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.border,
  },
  pointActif: {
    width: 24,
    backgroundColor: theme.primary,
  },
  bouton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 56,
    borderRadius: RADIUS.lg,
  },
  boutonTexte: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
});
