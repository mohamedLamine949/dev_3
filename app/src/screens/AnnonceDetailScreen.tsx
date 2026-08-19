import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  Share,
  FlatList,
  Alert,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, CATEGORIES, getSousCategorieLabel, ETAT_ARTICLE } from '../constants/theme';
import { Annonce } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { submitAvis, useSellerAvis } from '../hooks/useAvis';
import { toggleFavori } from '../hooks/useFavoris';
import ReportModal from '../components/ReportModal';
import { useTheme } from '../contexts/ThemeContext';
import { addToRecent } from '../lib/recentStorage';
import { hapticMedium } from '../lib/haptics';
import { sellerDisplayName, sellerInitial } from '../lib/seller';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatPrix(prix: number): string {
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

interface Props {
  route: any;
  navigation: any;
}

export default function AnnonceDetailScreen({ route, navigation }: Props) {
  const { annonce } = route.params as { annonce: Annonce };
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [seller, setSeller] = useState<any>((annonce as any).user || null);
  // Note moyenne du vendeur : signal de confiance affiche des la fiche annonce.
  const { avis, avgNote, refetch: refetchAvis } = useSellerAvis(annonce.user_id);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNote, setReviewNote] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Visionneuse d'images plein écran
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerScrollRef = useRef<ScrollView>(null);

  const favScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (viewerVisible) {
      setTimeout(() => {
        viewerScrollRef.current?.scrollTo({ x: viewerIndex * SCREEN_WIDTH, animated: false });
      }, 100);
    }
  }, [viewerVisible]);

  // La liste ne joint qu'un vendeur partiel (identite seule) : on complete
  // toujours avec les contacts et la bio, puis on fusionne. Un simple
  // `if (!seller)` bloquait la requete et laissait « Vendeur » a l'ecran.
  useEffect(() => {
    if (!annonce.user_id) return;
    supabase
      .from('users')
      .select('id, prenom, nom, nom_boutique, bio, avatar_url, telephone, whatsapp, instagram, tiktok, facebook, type_compte')
      .eq('id', annonce.user_id)
      .single()
      .then(({ data }) => { if (data) setSeller((prev: any) => ({ ...prev, ...data })); });
  }, [annonce.user_id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('favoris')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('annonce_id', annonce.id)
      .maybeSingle()
      .then(({ data }) => setIsFavorite(!!data));
  }, [session?.user?.id, annonce.id]);

  useEffect(() => {
    if (annonce) {
      addToRecent(annonce);
      supabase.rpc('increment_views', { annonce_id: annonce.id })
        .then(({ error }) => {
          if (error) console.log("Failed to increment views:", error.message);
        });
    }
  }, [annonce?.id]);

  const handleToggleFavori = async () => {
    if (!session) { navigation.navigate('Login'); return; }
    hapticMedium();
    Animated.sequence([
      Animated.spring(favScale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(favScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
    ]).start();
    const nowFav = await toggleFavori(session.user.id, annonce.id);
    setIsFavorite(nowFav);
  };

  const images = annonce.images?.length
    ? annonce.images.map((img) => img.image_url)
    : [];

  const sousCategorieLabel = getSousCategorieLabel(annonce.sous_categorie);
  const categoryLabel =
    (CATEGORIES.find((c) => c.id === annonce.categorie)?.label || annonce.categorie) +
    (sousCategorieLabel ? ` · ${sousCategorieLabel}` : '');
  const etatLabel =
    ETAT_ARTICLE.find((e) => e.id === annonce.etat_article)?.label || annonce.etat_article;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${annonce.titre} - ${formatPrix(annonce.prix)} sur Flash Market 🇲🇱`,
      });
    } catch {}
  };

  const handleSubmitReview = async () => {
    if (!session || reviewNote === 0) return;
    setSubmittingReview(true);
    const { error } = await submitAvis({
      auteurId: session.user.id,
      vendeurId: annonce.user_id,
      annonceId: annonce.id,
      note: reviewNote,
      commentaire: reviewComment,
    });
    setSubmittingReview(false);
    if (error) {
      if ((error as any).code === '23505') {
        Alert.alert('Avis déjà envoyé', 'Vous avez déjà laissé un avis pour cette annonce.');
      } else {
        Alert.alert('Erreur', 'Impossible d\'envoyer l\'avis. Réessayez.');
      }
    } else {
      setShowReviewModal(false);
      setReviewNote(0);
      setReviewComment('');
      refetchAvis();
      Alert.alert('Merci !', 'Votre avis a bien été enregistré.');
    }
  };

  const handleContact = () => {
    if (!session) {
      Alert.alert(
        'Connexion rapide',
        'Créez un compte gratuit pour contacter le vendeur.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }
    navigation.navigate('ChatConversation', {
      annonceId: annonce.id,
      vendeurId: annonce.user_id,
      titreAnnonce: annonce.titre,
      interlocuteur: seller
        ? { id: seller.id, prenom: seller.prenom, nom: seller.nom, avatar_url: seller.avatar_url }
        : undefined,
    });
  };

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Carrousel d'images */}
        <View style={styles.imageCarousel}>
          {images.length === 0 ? (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={64} color={theme.border} />
              <Text style={styles.imagePlaceholderText}>Aucune photo</Text>
            </View>
          ) : (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(index);
              }}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => {
                    setViewerIndex(index);
                    setViewerVisible(true);
                  }}
                >
                  <Image source={{ uri: item }} style={styles.carouselImage} />
                </TouchableOpacity>
              )}
              keyExtractor={(_, i) => String(i)}
            />
          )}

          {/* Dots indicateur */}
          {images.length > 1 && (
            <View style={styles.dotsContainer}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentImageIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Photo count badge */}
          {images.length > 0 && (
            <View style={styles.photoCountBadge}>
              <Ionicons name="camera-outline" size={13} color="#fff" />
              <Text style={styles.photoCountText}>
                {currentImageIndex + 1}/{images.length}
              </Text>
            </View>
          )}
        </View>

        {/* Boutons retour / partage / favori - flottants */}
        <View style={styles.floatingHeader}>
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.floatingRight}>
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={handleToggleFavori}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: favScale }] }}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFavorite ? '#EF4444' : '#fff'}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenu détail */}
        <View style={styles.detailContainer}>
          {/* Prix et titre */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrix(annonce.prix)}</Text>
            <View style={styles.negotiableBadge}>
              <Text style={styles.negotiableText}>Négociable</Text>
            </View>
          </View>
          <Text style={styles.title}>{annonce.titre}</Text>

          {/* Tags */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Feather name="tag" size={12} color={theme.primary} />
              <Text style={styles.tagText}>{categoryLabel}</Text>
            </View>
            <View style={styles.tag}>
              <Feather name="check-circle" size={12} color={theme.secondary} />
              <Text style={styles.tagText}>{etatLabel}</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
              <Text style={styles.tagText}>
                {(annonce as any).quartier ? `${(annonce as any).quartier}, ${annonce.ville}` : annonce.ville}
              </Text>
            </View>
          </View>

          {/* Séparateur */}
          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{annonce.description}</Text>

          {/* Séparateur */}
          <View style={styles.divider} />

          {/* Vendeur */}
          <Text style={styles.sectionTitle}>Vendeur</Text>
          {(() => {
            const sellerName = sellerDisplayName(seller);
            return (
              <View style={styles.sellerSection}>
                {/* Carte identité — cliquable pour voir le profil */}
                <TouchableOpacity
                  style={styles.sellerCard}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('VendeurProfile', { vendeurId: annonce.user_id })}
                >
                  {seller?.avatar_url ? (
                    <Image source={{ uri: seller.avatar_url }} style={styles.sellerAvatarImg} />
                  ) : (
                    <View style={styles.sellerAvatar}>
                      <Text style={styles.sellerAvatarText}>{sellerInitial(seller)}</Text>
                    </View>
                  )}
                  <View style={styles.sellerInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.sellerName}>{sellerName}</Text>
                      {seller?.type_compte === 'professionnel' && (
                        <View style={styles.badgePro}>
                          <Ionicons name="checkmark-circle" size={10} color="#fff" style={{ marginRight: 2 }} />
                          <Text style={styles.badgeProText}>PRO</Text>
                        </View>
                      )}
                    </View>
                    {avgNote !== null ? (
                      <View style={styles.sellerRatingRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Ionicons
                            key={i}
                            name={i <= Math.round(avgNote) ? 'star' : 'star-outline'}
                            size={12}
                            color={i <= Math.round(avgNote) ? '#F59E0B' : theme.border}
                          />
                        ))}
                        <Text style={[styles.sellerMeta, { marginTop: 0, marginLeft: 4 }]}>
                          {avgNote.toFixed(1)} ({avis.length})
                        </Text>
                      </View>
                    ) : null}
                    {seller?.bio ? (
                      <Text style={styles.sellerBio} numberOfLines={2}>{seller.bio}</Text>
                    ) : null}
                    <Text style={styles.sellerLink}>Voir le profil du vendeur</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* Bouton laisser un avis */}
          {session && session.user.id !== annonce.user_id && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => setShowReviewModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="star-outline" size={16} color={theme.secondary} />
              <Text style={styles.reviewBtnText}>Laisser un avis sur ce vendeur</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.secondary} />
            </TouchableOpacity>
          )}

          {/* Sécurité */}
          <View style={styles.securityCard}>
            <Ionicons name="shield-checkmark" size={22} color={theme.secondary} />
            <View style={styles.securityInfo}>
              <Text style={styles.securityTitle}>Conseils de sécurité 🛡️</Text>
              <Text style={styles.securityText}>
                Rencontrez le vendeur dans un lieu public. Ne payez jamais avant d'avoir vérifié l'article.
              </Text>
            </View>
          </View>

          {/* Signaler l'annonce */}
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => setShowReportModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="flag-outline" size={16} color={theme.textMuted} />
            <Text style={styles.reportBtnText}>Signaler cette annonce</Text>
          </TouchableOpacity>

          {/* Espacement pour le CTA sticky */}
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Modal avis */}
      <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Laisser un avis</Text>
              {seller && (
                <Text style={styles.modalSubtitle}>
                  Pour {sellerDisplayName(seller, 'ce vendeur')}
                </Text>
              )}

              {/* Étoiles interactives */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <TouchableOpacity key={i} onPress={() => setReviewNote(i)} activeOpacity={0.7}>
                    <Ionicons
                      name={i <= reviewNote ? 'star' : 'star-outline'}
                      size={38}
                      color={i <= reviewNote ? '#F59E0B' : theme.border}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {reviewNote > 0 && (
                <Text style={styles.noteLabel}>
                  {['', 'Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent'][reviewNote]}
                </Text>
              )}

              {/* Commentaire */}
              <TextInput
                style={styles.reviewInput}
                placeholder="Commentaire (facultatif)…"
                placeholderTextColor={theme.textMuted}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowReviewModal(false)}>
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, reviewNote === 0 && { opacity: 0.4 }]}
                  onPress={handleSubmitReview}
                  disabled={reviewNote === 0 || submittingReview}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalSubmitText}>
                    {submittingReview ? 'Envoi…' : 'Envoyer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Visionneuse d'images plein écran */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerIndexText}>{viewerIndex + 1} / {images.length}</Text>
            <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={viewerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
            }}
          >
            {images.map((imgUrl, idx) => (
              <View key={idx} style={styles.viewerImageWrapper}>
                <Image source={{ uri: imgUrl }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* STICKY CTA FIXE EN BAS */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.ctaPhoneButton}
          activeOpacity={0.8}
          onPress={() => {
            if (seller?.telephone) {
              Linking.openURL(`tel:${seller.telephone}`);
            } else if (seller?.whatsapp) {
              Linking.openURL(`https://wa.me/${seller.whatsapp.replace(/[^0-9]/g, '')}`);
            } else {
              handleContact();
            }
          }}
        >
          <Ionicons name="call-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctaMessageButton}
          onPress={handleContact}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
          <Text style={styles.ctaMessageText}>Contacter le vendeur</Text>
        </TouchableOpacity>
      </View>

      <ReportModal
        isVisible={showReportModal}
        onClose={() => setShowReportModal(false)}
        annonceId={annonce.id}
        targetName={annonce.titre}
      />
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },

  // Visionneuse d'images plein écran
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 30,
    left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  viewerIndexText: { color: '#fff', fontSize: FONTS.md, fontWeight: FONTS.bold },
  viewerCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerImageWrapper: {
    width: SCREEN_WIDTH, height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerImage: { width: SCREEN_WIDTH, height: '100%' },

  // Image carousel
  imageCarousel: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
    backgroundColor: theme.surfaceMuted,
    position: 'relative',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
  },
  dotsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: SPACING.lg + 10,
    alignSelf: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 22,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: SPACING.lg + 10,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  photoCountText: {
    color: '#fff',
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
  },

  imagePlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
    gap: SPACING.sm,
  },
  imagePlaceholderText: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
  },

  // Floating header
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  floatingRight: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  floatingButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },

  // Detail container
  detailContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    backgroundColor: theme.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    marginTop: -SPACING.xl,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  price: {
    ...TYPOGRAPHY.display,
    fontSize: 28,
    color: theme.primary,
  },
  negotiableBadge: {
    backgroundColor: theme.primaryFaded,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  negotiableText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: theme.primary,
  },

  title: {
    ...TYPOGRAPHY.h2,
    color: theme.textPrimary,
    lineHeight: 28,
    marginBottom: SPACING.lg,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  tagText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.medium,
    color: theme.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginVertical: SPACING.xl,
  },

  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: theme.textPrimary,
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: FONTS.md,
    color: theme.textSecondary,
    lineHeight: 24,
  },

  // Vendeur
  sellerSection: { gap: SPACING.md },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: isDark ? 1 : 0,
    borderColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  sellerAvatarImg: {
    width: 50, height: 50, borderRadius: 25, marginRight: SPACING.md,
  },
  sellerAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.md,
  },
  sellerAvatarText: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.primary },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  sellerBio: { fontSize: FONTS.sm, color: theme.textSecondary, marginTop: 2, lineHeight: 18 },
  sellerMeta: { fontSize: FONTS.sm, color: theme.textMuted, marginTop: 2 },
  sellerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  sellerLink: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary, marginTop: 3 },
  badgePro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  badgeProText: { fontSize: 9, fontWeight: FONTS.bold, color: '#fff' },

  contactButtons: { flexDirection: 'row', gap: SPACING.md },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: RADIUS.lg, borderWidth: 1.5,
  },
  contactBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold },
  sellerSocials: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  socialChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SPACING.md, paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  socialChipText: { fontSize: FONTS.xs, fontWeight: FONTS.semibold },

  // Sécurité
  securityCard: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
  },
  securityInfo: {
    flex: 1,
  },
  securityTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
    marginBottom: 4,
  },
  securityText: {
    fontSize: FONTS.sm,
    color: theme.textSecondary,
    lineHeight: 20,
  },

  // Bouton avis
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1, borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: 14,
    marginTop: SPACING.lg,
  },
  reviewBtnText: {
    flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.secondary,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  reportBtnText: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    fontWeight: FONTS.semibold,
  },

  // Modal avis
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.xl, paddingBottom: 40, paddingTop: SPACING.lg,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border, marginBottom: SPACING.xl,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: theme.textPrimary, marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: FONTS.sm, color: theme.textMuted, marginBottom: SPACING.xl,
  },
  starsRow: {
    flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm,
  },
  noteLabel: {
    fontSize: FONTS.sm, fontWeight: FONTS.semibold,
    color: theme.secondary, marginBottom: SPACING.xl,
  },
  reviewInput: {
    width: '100%', height: 90,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1, borderColor: theme.borderLight,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    fontSize: FONTS.md, color: theme.textPrimary,
    marginBottom: SPACING.xl,
  },
  modalActions: {
    flexDirection: 'row', gap: SPACING.md, width: '100%',
  },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg,
    backgroundColor: theme.surfaceMuted, alignItems: 'center',
  },
  modalCancelText: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },
  modalSubmitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: RADIUS.lg,
    backgroundColor: theme.secondary, alignItems: 'center',
  },
  modalSubmitText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },

  // STICKY CTA FIXE EN BAS
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : 14,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    gap: SPACING.md,
    ...SHADOWS.lg,
  },
  ctaPhoneButton: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaMessageButton: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    ...SHADOWS.colored,
  },
  ctaMessageText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: '#FFFFFF',
  },
});
