import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import Gradient from '../components/Gradient';
import { FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES, SUBCATEGORIES, TYPOGRAPHY, getSousCategorieLabel, getCategorieDeSousCategorie } from '../constants/theme';
import { useAnnonces, ANNONCES_PAGE_SIZE } from '../hooks/useAnnonces';
import { Annonce } from '../lib/supabase';
import { useLocation, getDistance, formatDistance } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { useProStatus, estPro } from '../hooks/useProStatus';
import { useFavoris, toggleFavori } from '../hooks/useFavoris';
import { getRecentAnnonces } from '../lib/recentStorage';
import { SkeletonCard, SkeletonCategories } from '../components/SkeletonLoader';
import { useDecouverteProPreview } from '../hooks/useDecouvertePro';
import { useRayons, RayonAffiche } from '../hooks/useRayons';
import { useInvitations } from '../hooks/useInvitations';
import { CONCOURS_MONTANT } from '../lib/partageInvitation';
import MessageCampagne from '../components/MessageCampagne';


/** Fenetre du bouton « Nouveautes » de l'accueil : les 3 derniers jours. */
const NOUVEAUTES_HEURES = 72;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md) / 2;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────


function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return `${Math.floor(diff / 604800)}sem`;
}

import { hapticLight, hapticMedium } from '../lib/haptics';
import { formatPrixCompact as formatPrix } from '../lib/format';
import { diversifierParVendeur, personnaliserParCategorie } from '../lib/feed';
import EtatEcran from '../components/EtatEcran';

// Couleur de fond pour les cercles catégorie
const CAT_CIRCLE_COLORS: Record<string, string> = {
  telephonie_electronique: '#3B82F6',
  mode_beaute:             '#EC4899',
  maison_electromenager:   '#06B6D4',
  voitures:                '#F59E0B',
  motos:                   '#F97316',
  immobilier:              '#8B5CF6',
  alimentation:            '#EF4444',
  animaux:                 '#A16207',
  services:                '#059669',
};

// ─────────────────────────────────────────────
// Animated Card Wrapper
// ─────────────────────────────────────────────

function PressableCard({ children, style, onPress }: { children: React.ReactNode; style?: any; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    hapticLight();
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Animated Favorite Button
// ─────────────────────────────────────────────

function FavoriteButton({ isFavorite, onPress }: { isFavorite: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { theme } = useTheme();

  const handlePress = () => {
    hapticMedium();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={favStyles.button}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={18}
          color={isFavorite ? '#EF4444' : '#FFFFFF'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const favStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

interface Props {
  navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSousCategorie, setSelectedSousCategorie] = useState<string | null>(null);
  // Bouton « Nouveautes » : ne montrer que ce qui a ete publie depuis 72 h.
  const [nouveautes, setNouveautes] = useState(false);

  // Debounce search query to avoid spamming Supabase
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [recentAnnonces, setRecentAnnonces] = useState<Annonce[]>([]);

  // Catégories déjà consultées, de la plus récente à la plus ancienne. Elles
  // ne filtrent rien : elles départagent les vendeurs du premier tour du fil.
  // En mode « Nouveautés », on ne les transmet pas — ce bouton promet l'ordre
  // chronologique, pas un classement par affinité.
  const categoriesPreferees = React.useMemo(
    () => (nouveautes ? [] : recentAnnonces.map(a => a.categorie).filter(Boolean) as string[]),
    [recentAnnonces, nouveautes]
  );

  const { annonces, loading, loadingMore, hasMore, error, compose, index, refetch, loadMore } = useAnnonces({
    categorie: selectedCategory,
    sousCategorie: selectedSousCategorie,
    search: debouncedSearch,
    depuisHeures: nouveautes ? NOUVEAUTES_HEURES : null,
    // Le fil ne se sert plus par ordre d'arrivée : l'ordre est composé sur le
    // catalogue entier pour que les vendeurs alternent (voir composerFil).
    diversifie: true,
    categoriesPreferees,
    // Le fil chargeait toutes les annonces actives d'un coup : on charge par
    // paquets de 20, la suite arrive au scroll.
    pageSize: ANNONCES_PAGE_SIZE,
  });
  // Rayons de l'accueil : des rangees par sous-categorie, construites sur
  // l'index deja lu par useAnnonces. Masques des qu'on filtre ou qu'on
  // cherche : l'ecran repond alors a une demande precise, pas a une flanerie.
  const sousCategoriesPreferees = React.useMemo(
    () => recentAnnonces.map(a => a.sous_categorie).filter(Boolean) as string[],
    [recentAnnonces]
  );
  const { rayons, tendances } = useRayons(index, {
    sousCategoriesPreferees,
    actif: !nouveautes && !selectedCategory && !debouncedSearch,
  });

  const ouvrirRayon = useCallback((sousCategorie: string) => {
    hapticLight();
    setSelectedCategory(getCategorieDeSousCategorie(sousCategorie));
    setSelectedSousCategorie(sousCategorie);
  }, []);

  const { location } = useLocation();
  const { session, user } = useAuth();
  // Parrainage : la banniere n'existe que si le programme est en place en
  // base. Elle change de texte selon l'avancee — un compteur fige a « 0/5 »
  // ne donne envie a personne.
  const { stats: invitations } = useInvitations(session?.user?.id);

  const { favorisIds, refetch: refetchFavoris } = useFavoris(session?.user?.id);
  const { shops: proShops, total: proTotal } = useDecouverteProPreview();
  // Badge PRO valide par le serveur : un abonnement expire ne le porte plus (§11.7).
  const { proIds } = useProStatus();

  // Quand le fil est composé (cas normal), l'ordre a déjà été décidé sur le
  // catalogue entier : deux annonces du même vendeur ne peuvent pas se
  // suivre, et les catégories consultées ont déjà pesé. Il n'y a rien à
  // retoucher ici — le refaire ne ferait que regrouper à nouveau.
  //
  // Les fonctions ci-dessous ne servent donc plus que de filet, quand l'index
  // n'a pas pu être lu et que le fil est retombé sur l'ordre chronologique.
  const filAffiche = React.useMemo(() => {
    if (compose) return annonces;
    return nouveautes
      ? diversifierParVendeur(annonces)
      : personnaliserParCategorie(diversifierParVendeur(annonces), recentAnnonces);
  }, [annonces, recentAnnonces, nouveautes, compose]);

  const loadRecent = useCallback(async () => {
    const list = await getRecentAnnonces();
    setRecentAnnonces(list);
  }, []);

  useEffect(() => {
    loadRecent();
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecent();
    });
    return unsubscribe;
  }, [navigation, loadRecent]);

  const handleToggleFavori = async (annonceId: string) => {
    if (!session) { navigation.navigate('Login'); return; }
    await toggleFavori(session.user.id, annonceId);
    refetchFavoris();
  };

  // ─────────────────────────────────────────────
  // Render: Category Circles
  // ─────────────────────────────────────────────

  const renderCategoryCircle = ({ item }: { item: typeof CATEGORIES[0] }) => {
    const isSelected = selectedCategory === item.id;
    const circleColor = CAT_CIRCLE_COLORS[item.id] || theme.primary;
    // Raccourcir le label pour les cercles
    const shortLabel = item.label.split(' & ')[0].split(' ')[0];

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.categoryCircleWrapper}
        onPress={() => {
          setSelectedSousCategorie(null);
          setSelectedCategory(isSelected ? null : item.id);
        }}
      >
        <View
          style={[
            styles.categoryCircle,
            {
              // Retour utilisateur : le fond gris neutre faisait paraitre
              // l'appli trop blanche/basique. Non selectionne = teinte legere
              // de la couleur PROPRE a la categorie (pas un gris generique) ;
              // selectionne = la meme couleur pleine, donc plus foncee. Pas
              // de contour : juste le cercle teinte (retour utilisateur).
              backgroundColor: isSelected ? circleColor : circleColor + '1F',
            },
          ]}
        >
          <Ionicons
            name={item.icon as any}
            size={22}
            color={isSelected ? '#FFFFFF' : circleColor}
          />
        </View>
        <Text
          style={[
            styles.categoryCircleLabel,
            { color: isSelected ? theme.textPrimary : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {shortLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────
  // Render: Annonce Card (Premium)
  // ─────────────────────────────────────────────

  const renderAnnonceCard = ({ item, index }: { item: Annonce; index: number }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    const dist =
      location && (item as any).latitude && (item as any).longitude
        ? getDistance(location.latitude, location.longitude, (item as any).latitude, (item as any).longitude)
        : null;

    return (
      <PressableCard
        style={[
          styles.card,
          { marginLeft: index % 2 === 0 ? 0 : SPACING.md },
        ]}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        {/* Image */}
        <View style={styles.cardImageContainer}>
          {imageUrl
            // `key` force un remontage propre par URL : sans lui, une image
            // en cours de telechargement sur une cellule recyclee peut se
            // terminer APRES qu'une autre image ait deja commence a charger
            // sur la meme cellule, et "gagner" la course a l'affichage.
            ? <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.cardImage} />
            : <View style={[styles.cardImage, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={32} color={theme.border} />
              </View>
          }
          {/* Badges : PRO + NEUF */}
          <View style={styles.badgeStack}>
            {estPro((item as any).user, proIds) && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark-circle" size={10} color="#fff" style={{ marginRight: 2 }} />
                <Text style={styles.badgeText}>PRO</Text>
              </View>
            )}
            {item.etat_article === 'neuf' && (
              <View style={[styles.badge, { backgroundColor: theme.secondary }]}>
                <Text style={styles.badgeText}>NEUF</Text>
              </View>
            )}
          </View>
          {/* Bouton favori animé */}
          <FavoriteButton
            isFavorite={favorisIds.has(item.id)}
            onPress={() => handleToggleFavori(item.id)}
          />
        </View>

        {/* Infos */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.cardPrice}>{formatPrix(item.prix)}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={11} color={theme.textMuted} />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {(item as any).quartier || item.ville}
            </Text>
            {dist !== null && (
              <>
                <Text style={styles.cardMetaDot}>·</Text>
                <Text style={[styles.cardMetaText, { color: theme.primary }]}>
                  {formatDistance(dist)}
                </Text>
              </>
            )}
          </View>
        </View>
      </PressableCard>
    );
  };

  // ─────────────────────────────────────────────
  // Render: Recent Card
  // ─────────────────────────────────────────────

  const renderTendanceCard = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    return (
      <PressableCard
        style={styles.tendanceCard}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <View style={styles.tendanceImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.rayonImage} />
          ) : (
            <View style={styles.rayonImagePlaceholder}>
              <Ionicons name="image-outline" size={28} color={theme.border} />
            </View>
          )}
          {/* La mise en avant est payante : elle s'annonce, l'acheteur doit
              pouvoir faire la difference avec le reste du fil. */}
          <View style={styles.tendanceBadge}>
            <Ionicons name="flame" size={11} color="#fff" />
            <Text style={styles.tendanceBadgeTexte}>En avant</Text>
          </View>
        </View>
        <Text style={styles.rayonCardTitle} numberOfLines={2}>{item.titre}</Text>
        <Text style={styles.rayonCardPrice} numberOfLines={1}>{formatPrix(item.prix)}</Text>
      </PressableCard>
    );
  };

  const renderRayonCard = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    return (
      <PressableCard
        style={styles.rayonCard}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <View style={styles.rayonImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.rayonImage} />
          ) : (
            <View style={styles.rayonImagePlaceholder}>
              <Ionicons name="image-outline" size={28} color={theme.border} />
            </View>
          )}
        </View>
        <Text style={styles.rayonCardTitle} numberOfLines={2}>{item.titre}</Text>
        <Text style={styles.rayonCardPrice} numberOfLines={1}>{formatPrix(item.prix)}</Text>
      </PressableCard>
    );
  };

  const renderRayon = (rayon: RayonAffiche) => (
    <View key={rayon.sousCategorie} style={styles.recentSection}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{getSousCategorieLabel(rayon.sousCategorie)}</Text>
          {rayon.suggerePourVous && (
            <Text style={styles.rayonSousTitre}>D'apres ce que vous avez regarde</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => ouvrirRayon(rayon.sousCategorie)} activeOpacity={0.7}>
          <Text style={styles.sectionLink}>Voir les {rayon.total}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={rayon.annonces}
        renderItem={renderRayonCard}
        keyExtractor={(item) => `${rayon.sousCategorie}-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentListContainer}
      />
    </View>
  );

  const renderRecentCard = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    return (
      <PressableCard
        style={styles.recentCard}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <View style={styles.recentImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.recentImage} />
          ) : (
            <View style={styles.recentImagePlaceholder}>
              <Ionicons name="image-outline" size={24} color={theme.border} />
            </View>
          )}
        </View>
        <Text style={styles.recentCardTitle} numberOfLines={1}>
          {item.titre}
        </Text>
        <Text style={styles.recentCardPrice} numberOfLines={1}>
          {formatPrix(item.prix)}
        </Text>
      </PressableCard>
    );
  };

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  // Place reservee sous la tab bar flottante (variable selon la zone sure iOS).
  const tabBarSpace = useTabBarSpace();

  // ─────────────────────────────────────────────
  // Skeleton Loading
  // ─────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {/* Header skeleton */}
      <View style={[styles.heroSection, { gap: SPACING.lg }]}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1, gap: SPACING.sm }}>
            <View style={{ width: 180, height: 24, borderRadius: RADIUS.sm, backgroundColor: theme.surfaceMuted }} />
            <View style={{ width: 220, height: 14, borderRadius: RADIUS.xs, backgroundColor: theme.surfaceMuted }} />
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surfaceMuted }} />
        </View>
      </View>
      {/* Search skeleton */}
      <View style={{ height: 50, borderRadius: RADIUS.lg, backgroundColor: theme.surfaceMuted, marginBottom: SPACING.lg }} />
      {/* Categories skeleton */}
      <SkeletonCategories />
      {/* Cards skeleton */}
      <View style={{ flexDirection: 'row', gap: SPACING.md }}>
        <SkeletonCard cardWidth={CARD_WIDTH} />
        <SkeletonCard cardWidth={CARD_WIDTH} />
      </View>
      <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg }}>
        <SkeletonCard cardWidth={CARD_WIDTH} />
        <SkeletonCard cardWidth={CARD_WIDTH} />
      </View>
    </View>
  );

  // ─────────────────────────────────────────────
  // List Header
  // ─────────────────────────────────────────────

  // Rendu comme ÉLÉMENT (et non comme composant inline) : un composant défini
  // ici serait recréé à chaque frappe dans la barre de recherche, ce qui
  // démonterait le TextInput et fermerait le clavier.
  const welcomeText = user?.prenom ? `Salut, ${user.prenom} ! 👋` : "Bienvenue ! 👋";
  const listHeader = (
      <View>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroWelcome}>{welcomeText}</Text>
              <Text style={styles.heroSubtitle}>Que cherchez-vous aujourd'hui ?</Text>
            </View>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Profile')}
              style={styles.profileIndicator}
            >
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.profileAvatar} />
              ) : (
                <View style={styles.profileAvatarPlaceholder}>
                  <Ionicons name="person" size={20} color={theme.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Feather name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Que cherchez-vous ?"
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Message de Flash Market (envoyé depuis la console) : en premier,
            c'est une information adressée à cette personne. */}
        {!nouveautes && <MessageCampagne userId={session?.user?.id} navigation={navigation} />}

        {/* Concours de parrainage : juste sous la recherche, visible sans
            faire défiler. Le montant est le titre, en gros : c'est lui qui
            donne envie. Visible aussi sans compte (l'écran Parrainage propose
            alors de se connecter) ; masquée en mode « Nouveautés », et tant
            que le programme n'est pas actif en base. */}
        {!nouveautes && (invitations || !session) && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { hapticLight(); navigation.navigate('Invitations'); }}
            style={styles.parrainageCta}
          >
            <Gradient
              colors={['#7C2D12', '#B45309', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.parrainageInner}
            >
              <Ionicons
                name="trophy"
                size={110}
                color="rgba(255,255,255,0.13)"
                style={styles.nouveautesWatermark}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.parrainageSurtitre}>Concours de lancement</Text>
                <Text style={styles.parrainageMontant} numberOfLines={1} adjustsFontSizeToFit>Gagnez {CONCOURS_MONTANT}</Text>
                <Text style={styles.parrainageTexte}>
                  {invitations?.concoursParticipe
                    ? 'Vous participez au tirage !'
                    : 'Invitez 5 amis qui publient une annonce'}
                </Text>
                {invitations && (
                  <View style={styles.parrainageRonds}>
                    {Array.from({ length: invitations.concoursRequis }).map((_, i) => (
                      <View
                        key={i}
                        style={[styles.parrainageRond, i < invitations.filleulsValides && styles.parrainageRondPlein]}
                      />
                    ))}
                    {invitations.boostsDisponibles > 0 && (
                      <View style={styles.parrainageBoost}>
                        <Ionicons name="flame" size={12} color="#B45309" />
                        <Text style={styles.parrainageBoostTexte}>
                          {invitations.boostsDisponibles} boost{invitations.boostsDisponibles > 1 ? 's' : ''} offert{invitations.boostsDisponibles > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.parrainageFleche}>
                <Ionicons name="chevron-forward" size={20} color="#B45309" />
              </View>
            </Gradient>
          </TouchableOpacity>
        )}

        {/* Catégories en cercles */}
        <FlatList
          data={CATEGORIES}
          renderItem={renderCategoryCircle}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        />

        {/* Sous-catégories de la catégorie sélectionnée */}
        {selectedCategory && SUBCATEGORIES[selectedCategory]?.length > 0 && (
          <FlatList
            data={[{ id: '__tout__', label: 'Tout' }, ...SUBCATEGORIES[selectedCategory]]}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcategoriesContainer}
            renderItem={({ item }) => {
              const isTout = item.id === '__tout__';
              const isSelected = isTout ? selectedSousCategorie === null : selectedSousCategorie === item.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.subcategoryChip, isSelected && styles.subcategoryChipSelected]}
                  onPress={() => setSelectedSousCategorie(isTout ? null : (isSelected ? null : item.id))}
                >
                  <Text style={[styles.subcategoryLabel, isSelected && styles.subcategoryLabelSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Tendances : les annonces dont le vendeur a paye une mise en avant.
            Placees tout en haut, juste sous les categories — c'est la
            contrepartie visible du boost, et ce que voient les vendeurs qui
            hesitent a en prendre un. La section n'existe pas tant que
            personne n'a boost : pas de rangee vide. */}
        {tendances.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.tendanceTitreLigne}>
                  <Ionicons name="flame" size={18} color="#EA580C" />
                  <Text style={styles.sectionTitle}>Tendances</Text>
                </View>
                <Text style={styles.rayonSousTitre}>Mises en avant par leurs vendeurs</Text>
              </View>
              <TouchableOpacity
                onPress={() => { hapticLight(); navigation.navigate('BoosterMesAnnonces'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.tendanceLien}>Booster la mienne</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={tendances}
              renderItem={renderTendanceCard}
              keyExtractor={(item) => `tendance-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentListContainer}
            />
          </View>
        )}

        {/* Nouveautés : un seul appui pour ne voir que les annonces publiées
            dans les 72 dernières heures. Placé haut, juste sous les
            catégories, pour être visible sans faire défiler l'écran. */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { hapticLight(); setNouveautes(v => !v); }}
          style={styles.nouveautesCta}
        >
          <Gradient
            colors={nouveautes ? ['#7C2D12', '#C2410C', '#EA580C'] : ['#B45309', '#F59E0B', '#FBBF24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nouveautesInner}
          >
            <Ionicons
              name="flash"
              size={96}
              color="rgba(255,255,255,0.13)"
              style={styles.nouveautesWatermark}
            />
            <View style={styles.nouveautesIcon}>
              <Ionicons name={nouveautes ? 'checkmark' : 'flash'} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nouveautesTitle}>
                {nouveautes ? 'Nouveautés des 3 derniers jours' : 'Voir les nouveautés'}
              </Text>
              <Text style={styles.nouveautesSubtitle}>
                {nouveautes
                  ? 'Appuyez pour revoir toutes les annonces'
                  : 'Tout ce qui a été publié depuis 3 jours'}
              </Text>
            </View>
            <Ionicons
              name={nouveautes ? 'close-circle' : 'chevron-forward'}
              size={nouveautes ? 22 : 18}
              color="#fff"
            />
          </Gradient>
        </TouchableOpacity>

        {/* Découverte Pro : point d'entrée vers l'annuaire des boutiques PRO.
            Masqué en mode Nouveautés : le bouton doit mener DIRECTEMENT aux
            annonces récentes, pas les repousser sous deux bannières. */}
        {!nouveautes && (
        <View style={styles.bannerContainer}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('DecouvertePro')}>
            <Gradient
              colors={['#0b4023', '#15803d', '#1f9450']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proCta}
            >
              {/* Motifs decoratifs discrets : sans eux la carte est un aplat
                  de couleur uni, ce qui la fait paraitre "basique" (retour
                  utilisateur). Purement visuel, pointerEvents="none" pour ne
                  jamais intercepter le tap. */}
              <View style={styles.proCtaGlow} pointerEvents="none" />
              <Ionicons
                name="storefront"
                size={130}
                color="rgba(255,255,255,0.10)"
                style={styles.proCtaWatermark}
              />
              <View style={styles.proCtaTop}>
                <View style={styles.proCtaIcon}>
                  <Ionicons name="storefront" size={19} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.proCtaTitle}>Découvrez nos professionnels</Text>
                  <Text style={styles.proCtaSubtitle}>
                    Boutiques, restaurants, agences, prestataires — le bon pro près de chez vous.
                  </Text>
                </View>
              </View>
              <View style={styles.proCtaFacesRow}>
                {proShops.slice(0, 3).map((s, i) => (
                  <View key={s.id} style={[styles.proCtaFace, i > 0 && { marginLeft: -8 }]}>
                    {s.avatar_url ? (
                      <Image source={{ uri: s.avatar_url }} style={styles.proCtaFaceImg} />
                    ) : (
                      <Text style={styles.proCtaFaceInitial}>
                        {(s.nom_boutique || s.prenom || '?').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                ))}
                {proTotal > 0 && (
                  <Text style={styles.proCtaCount}>{proTotal} boutique{proTotal !== 1 ? 's' : ''}</Text>
                )}
                <View style={styles.proCtaExplore}>
                  <Text style={styles.proCtaExploreText}>Explorer</Text>
                  <Ionicons name="arrow-forward" size={13} color="#fff" />
                </View>
              </View>
            </Gradient>
          </TouchableOpacity>

          {/* Incitation à ouvrir un compte pro — juste sous la découverte des
              pros existants, là où le visiteur vient de voir ce que ça donne. */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Subscription')}
            style={styles.devenirProCard}
          >
            <Ionicons
              name="ribbon"
              size={100}
              color="rgba(255,255,255,0.12)"
              style={styles.devenirProWatermark}
            />
            <View style={styles.devenirProIcon}>
              <Ionicons name="ribbon-outline" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.devenirProTitle}>Vous êtes un professionnel ?</Text>
              <Text style={styles.devenirProSubtitle}>Créez votre vitrine et gagnez en visibilité</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>
        )}

        {/* Récemment consultés */}
        {/* §7.1 : une seule carte laisse un grand vide — on n'affiche la
            section qu'a partir de deux elements. */}
        {!nouveautes && recentAnnonces.length >= 2 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Récemment consultés</Text>
              <TouchableOpacity onPress={async () => {
                const { clearRecentAnnonces } = await import('../lib/recentStorage');
                await clearRecentAnnonces();
                loadRecent();
              }}>
                <Text style={styles.clearRecentLink}>Effacer</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recentAnnonces}
              renderItem={renderRecentCard}
              keyExtractor={(item) => `recent-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentListContainer}
            />
          </View>
        )}

        {/* Rayons : une rangee par sous-categorie, pour que l'accueil se
            parcoure comme un magasin et non comme un tas. Chaque rangee
            alterne les vendeurs, comme le fil. */}
        {rayons.map(renderRayon)}

        {/* Section titre */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {nouveautes
              ? 'Publiées ces 3 derniers jours'
              : rayons.length > 0
                ? 'Toutes les annonces'
                : 'Annonces récentes'}
          </Text>
          <TouchableOpacity
            onPress={() => nouveautes
              ? setNouveautes(false)
              : navigation.navigate('Recherche', { screen: 'SearchMain' })}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionLink}>{nouveautes ? 'Tout voir' : 'Voir tout'}</Text>
          </TouchableOpacity>
        </View>

        {/* Rappel de sécurité juste au-dessus des annonces : c'est ici, au
            moment de parcourir les articles, qu'il est le plus utile —
            pas seulement enterré dans chaque fiche produit. */}
        <View style={styles.safetyNote}>
          <Ionicons name="shield-checkmark-outline" size={15} color={theme.textSecondary} />
          <Text style={styles.safetyNoteText}>
            Remise en main propre conseillée — vérifiez l'article avant de payer.
          </Text>
        </View>
      </View>
  );

  // ─────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      {loading && annonces.length === 0 ? (
        renderSkeleton()
      ) : error && annonces.length === 0 ? (
        <EtatEcran
          variante="hors_ligne"
          message={error || undefined}
          onAction={refetch}
        />
      ) : (
        <FlatList
          data={filAffiche}
          renderItem={renderAnnonceCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContainer, { paddingBottom: tabBarSpace + SPACING.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          // `windowSize` à 5 (contre 21 par défaut) économisait de la bande
          // passante, mais avec si peu de marge, un scroll rapide fait
          // sortir des cartes de la fenêtre montée puis les fait remonter
          // aussitôt dès que le flick décélère et oscille légèrement — deux
          // cartes pile à la frontière se démontent/remontent en boucle et
          // rechargent leur image à chaque fois, d'où le clignotement. On
          // remonte la marge pour que ça n'arrive plus ; le gain de bande
          // passante ne vaut pas ce glitch.
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
          // `removeClippedSubviews` retiré : c'est un bug connu de React
          // Native (surtout Android) — recyclage trop agressif des cellules
          // pendant un scroll rapide, qui fait clignoter/alterner deux
          // images sur la même carte.
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : !hasMore && annonces.length > 0 ? (
              <Text style={styles.footerEndText}>Vous avez tout vu</Text>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetch}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            /* §7.10 : un etat vide propose toujours une action realiste.
               « Modifiez vos criteres » n'en est pas une quand il n'y a
               aucun critere : c'est une impasse. */
            nouveautes ? (
              <EtatEcran
                variante="vide"
                icone="flash-outline"
                titre="Rien de neuf ces 3 derniers jours"
                message="Aucune annonce n'a été publiée récemment. Regardez tout ce qui est déjà en ligne."
                actionLabel="Voir toutes les annonces"
                onAction={() => setNouveautes(false)}
              />
            ) : selectedCategory ? (
              <EtatEcran
                variante="vide"
                titre="Rien dans cette catégorie"
                message="Personne n'a encore publié ici. Revenez bientôt, ou regardez les autres catégories."
                actionLabel="Voir toutes les annonces"
                onAction={() => { setSelectedCategory(null); setSelectedSousCategorie(null); }}
              />
            ) : (
              <EtatEcran
                variante="vide"
                icone="storefront-outline"
                titre="Le marché est encore vide"
                message="Soyez le premier à publier : votre annonce sera vue par tous les visiteurs."
                actionLabel="Publier une annonce"
                onAction={() => navigation.navigate('Publier')}
              />
            )
          }
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// 🎨 Styles
// ─────────────────────────────────────────────

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  footerLoader: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  footerEndText: {
    paddingVertical: SPACING.xl,
    textAlign: 'center',
    fontSize: FONTS.sm,
    color: theme.textMuted,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    // paddingBottom ajoute a l'usage : hauteur reelle de la tab bar flottante
  },

  // Hero
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: SPACING.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroWelcome: {
    ...TYPOGRAPHY.h1,
    color: theme.textPrimary,
  },
  heroSubtitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.regular,
    color: theme.textSecondary,
    marginTop: 4,
  },
  profileIndicator: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: theme.primary,
    ...SHADOWS.sm,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  profileAvatarPlaceholder: {
    flex: 1,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Recherche
  searchContainer: {
    marginBottom: SPACING.xl,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.md,
    color: theme.textPrimary,
    padding: 0,
  },

  // Catégories — cercles colorés
  categoriesContainer: {
    paddingBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  categoryCircleWrapper: {
    alignItems: 'center',
    width: 64,
  },
  categoryCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  categoryCircleLabel: {
    fontSize: 10,
    fontWeight: FONTS.semibold,
    textAlign: 'center',
  },

  // Sous-catégories
  subcategoriesContainer: {
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  subcategoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 1,
    borderRadius: RADIUS.full,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  subcategoryChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  subcategoryLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.medium,
    color: theme.textSecondary,
  },
  subcategoryLabelSelected: {
    color: theme.textInverse,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
  },
  sectionLink: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.primary,
  },

  // Card annonce — premium
  card: {
    width: CARD_WIDTH,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    overflow: 'hidden',
    borderWidth: isDark ? 1 : 0,
    borderColor: theme.borderLight,
    ...SHADOWS.md,
  },
  cardImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.85,  // Aspect ratio 4:3ish — plus de contenu visible
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceMuted,
  },
  badgeStack: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: FONTS.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardInfo: {
    padding: SPACING.md,
    gap: 3,
  },
  cardTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    lineHeight: 18,
  },
  cardPrice: {
    ...TYPOGRAPHY.price,
    fontSize: FONTS.md,
    color: theme.primary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  cardMetaText: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
  },
  imagePlaceholder: {
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMetaDot: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginHorizontal: 2,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.section * 1.5,
    gap: SPACING.md,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
  },
  emptySubtitle: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  errorTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
    ...SHADOWS.colored,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: FONTS.bold,
    fontSize: FONTS.md,
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },

  // Nouveautés (72 h)
  nouveautesCta: {
    marginBottom: SPACING.lg,
  },
  // L'ombre est portee par le degrade lui-meme (comme proCta) : sur Android,
  // `elevation` sur un conteneur transparent ne dessine rien.
  nouveautesInner: {
    ...SHADOWS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: 64,
    overflow: 'hidden',
  },
  nouveautesWatermark: {
    position: 'absolute',
    right: -12, bottom: -18,
    transform: [{ rotate: '12deg' }],
  },
  nouveautesIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  nouveautesTitle: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: '#fff' },
  nouveautesSubtitle: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  // Bannière
  bannerContainer: {
    marginBottom: SPACING.lg,
  },
  proCta: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.colored,
  },
  // Motifs decoratifs (retour "trop basique, juste un aplat de couleur") :
  // un halo doux en haut a droite + une grande icone en filigrane, tous deux
  // pointerEvents="none" pour rester purement visuels.
  proCtaGlow: {
    position: 'absolute',
    top: -50, right: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  proCtaWatermark: {
    position: 'absolute',
    right: -16, bottom: -20,
    transform: [{ rotate: '-12deg' }],
  },
  proCtaTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  proCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proCtaTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.extrabold,
    color: '#fff',
    marginBottom: 3,
  },
  proCtaSubtitle: {
    fontSize: FONTS.xs,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
  },
  proCtaFacesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  proCtaFace: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#0b4023',
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  proCtaFaceImg: { width: '100%', height: '100%' },
  proCtaFaceInitial: { fontSize: 10, fontWeight: FONTS.bold, color: '#0b4023' },
  proCtaCount: {
    fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: 'rgba(255,255,255,0.85)',
    marginLeft: SPACING.sm,
  },
  proCtaExplore: {
    marginLeft: 'auto',
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  proCtaExploreText: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: '#fff' },

  devenirProCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: theme.info, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginTop: SPACING.sm, minHeight: 60,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  devenirProWatermark: {
    position: 'absolute',
    right: -14, bottom: -18,
    transform: [{ rotate: '14deg' }],
  },
  devenirProIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  devenirProTitle: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: '#fff' },
  devenirProSubtitle: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  safetyNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  safetyNoteText: { flex: 1, fontSize: FONTS.xs, color: theme.textSecondary, lineHeight: 16 },

  // Récemment vus
  recentSection: {
    marginBottom: SPACING.xl,
  },
  clearRecentLink: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: theme.textMuted,
  },
  recentListContainer: {
    gap: SPACING.md,
    paddingRight: SPACING.lg,
  },
  recentCard: {
    width: 140,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.borderLight,
    paddingBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  recentImageContainer: {
    width: '100%',
    height: 95,
  },
  recentImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceMuted,
  },
  recentImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentCardTitle: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.sm,
  },
  // Meme gabarit que la carte « Nouveautes » juste en dessous : la liste
  // porte deja le retrait horizontal, et l'ombre va sur le degrade (sur
  // Android, `elevation` sur un conteneur transparent ne dessine rien).
  parrainageCta: {
    marginBottom: SPACING.lg,
  },
  parrainageInner: {
    ...SHADOWS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  parrainageSurtitre: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  parrainageMontant: {
    fontSize: FONTS.xxl + 2,
    fontWeight: FONTS.extrabold,
    color: '#fff',
    marginTop: 2,
  },
  parrainageTexte: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 2,
  },
  parrainageRonds: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  parrainageRond: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  parrainageRondPlein: { backgroundColor: '#fff', borderColor: '#fff' },
  parrainageBoost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: '#fff',
  },
  parrainageBoostTexte: { fontSize: FONTS.xs, fontWeight: FONTS.bold, color: '#B45309' },
  parrainageFleche: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tendanceTitreLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  tendanceLien: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: '#EA580C',
  },
  tendanceCard: {
    width: 170,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  tendanceImageContainer: {
    width: '100%',
    height: 170,
    backgroundColor: theme.surfaceMuted,
  },
  tendanceBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: '#EA580C',
  },
  tendanceBadgeTexte: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  rayonSousTitre: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginTop: 2,
  },
  rayonCard: {
    width: 160,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.borderLight,
    paddingBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  rayonImageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: theme.surfaceMuted,
  },
  rayonImage: {
    width: '100%',
    height: '100%',
  },
  rayonImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rayonCardTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.sm,
    minHeight: 34,
  },
  rayonCardPrice: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.primary,
    marginTop: 2,
    marginHorizontal: SPACING.sm,
  },
  recentCardPrice: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: theme.primary,
    marginTop: 2,
    marginHorizontal: SPACING.sm,
  },
});
