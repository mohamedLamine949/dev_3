import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, ActivityIndicator, Dimensions, Linking, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase, Annonce } from '../lib/supabase';
import { useSellerAvis, Avis } from '../hooks/useAvis';
import { useTheme } from '../contexts/ThemeContext';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - SPACING.lg * 2 - SPACING.md) / 2;

function formatPrix(prix: number): string {
  if (prix >= 1000000) return (prix / 1000000).toFixed(1) + 'M FCFA';
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return `${Math.floor(diff / 604800)}sem`;
}

export default function VendeurProfileScreen({ route, navigation }: any) {
  const { vendeurId } = route.params as { vendeurId: string };
  const { theme, isDark } = useTheme();
  const [seller, setSeller] = useState<any>(null);
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [loadingAnnonces, setLoadingAnnonces] = useState(true);
  const { avis, avgNote, loading: loadingAvis } = useSellerAvis(vendeurId);

  // Full-screen image viewer states
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerScrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    if (viewerVisible) {
      setTimeout(() => {
        viewerScrollViewRef.current?.scrollTo({ x: viewerIndex * W, animated: false });
      }, 100);
    }
  }, [viewerVisible]);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  function Stars({ note, size = 14 }: { note: number; size?: number }) {
    return (
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Ionicons
            key={i}
            name={i <= Math.round(note) ? 'star' : 'star-outline'}
            size={size}
            color={i <= Math.round(note) ? '#f59e0b' : theme.borderLight}
          />
        ))}
      </View>
    );
  }

  function AvisCard({ avis: a }: { avis: Avis }) {
    const authorName = a.auteur
      ? `${a.auteur.prenom || ''} ${a.auteur.nom || ''}`.trim() || 'Anonyme'
      : 'Anonyme';
    
    return (
      <View style={[styles.avisCard, { backgroundColor: theme.surface }]}>
        <View style={styles.avisHeader}>
          {a.auteur?.avatar_url ? (
            <Image source={{ uri: a.auteur.avatar_url }} style={styles.avisAvatar} />
          ) : (
            <View style={[styles.avisAvatar, { backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.primary }}>{authorName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary, marginBottom: 3 }}>{authorName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Stars note={a.note} size={12} />
              <Text style={{ fontSize: FONTS.xs, color: theme.textMuted }}>{timeAgo(a.date_creation)}</Text>
            </View>
          </View>
        </View>
        {a.commentaire ? <Text style={{ fontSize: FONTS.sm, color: theme.textSecondary, lineHeight: 20, marginTop: SPACING.sm }}>{a.commentaire}</Text> : null}
      </View>
    );
  }

  useEffect(() => {
    supabase
      .from('users')
      .select('id, prenom, nom, bio, avatar_url, telephone, whatsapp, instagram, tiktok, facebook, type_compte, banniere_url, images_business')
      .eq('id', vendeurId)
      .single()
      .then(({ data }) => {
        if (data) setSeller(data);
        setLoadingSeller(false);
      });
  }, [vendeurId]);

  useEffect(() => {
    supabase
      .from('annonces')
      .select('*, images:images_annonce(image_url, ordre)')
      .eq('user_id', vendeurId)
      .eq('statut', 'active')
      .eq('est_payee', true)
      .order('date_creation', { ascending: false })
      .then(({ data }) => {
        if (data) setAnnonces(data as Annonce[]);
        setLoadingAnnonces(false);
      });
  }, [vendeurId]);

  const sellerName = seller
    ? `${seller.prenom || ''} ${seller.nom || ''}`.trim() || 'Vendeur'
    : 'Vendeur';

  if (loadingSeller) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header avec bannière et avatar (PRO vs Particulier) */}
        <View style={[styles.header, seller?.type_compte === 'professionnel' && styles.proHeader, { overflow: 'hidden' }]}>
          {seller?.type_compte === 'professionnel' && seller?.banniere_url ? (
            <Image source={{ uri: seller.banniere_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
          {seller?.type_compte === 'professionnel' && seller?.banniere_url ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
          ) : null}
          
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Photo de profil */}
          <View style={styles.avatarWrapper}>
            {seller?.avatar_url ? (
              <Image source={{ uri: seller.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(sellerName?.charAt(0) || '?').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Nom et type de compte */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.xs }}>
            <Text style={styles.displayName}>{sellerName}</Text>
            {seller?.type_compte === 'professionnel' && (
              <View style={{ backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.xs }}>
                <Text style={{ fontSize: 10, fontWeight: FONTS.bold, color: '#fff' }}>
                  PRO
                </Text>
              </View>
            )}
          </View>

          {/* Note globale (étoiles) */}
          <View style={styles.ratingHeaderRow}>
            {avgNote !== null ? (
              <>
                <Stars note={avgNote} size={14} />
                <Text style={styles.ratingHeaderText}>{avgNote.toFixed(1)} / 5 ({avis.length} avis)</Text>
              </>
            ) : (
              <Text style={styles.ratingHeaderText}>Aucun avis reçu</Text>
            )}
          </View>

          {seller?.bio ? <Text style={styles.sellerBio}>{seller.bio}</Text> : null}

          {/* Boutons contact sous forme de capsules Snapchat */}
          {(seller?.telephone || seller?.whatsapp) ? (
            <View style={styles.contactRow}>
              {seller.telephone ? (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(`tel:${seller.telephone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={14} color="#fff" />
                  <Text style={styles.contactBtnText}>Appeler</Text>
                </TouchableOpacity>
              ) : null}
              {seller.whatsapp ? (
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
                  onPress={() => Linking.openURL(`https://wa.me/${seller.whatsapp.replace(/[^0-9]/g, '')}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                  <Text style={styles.contactBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>

          {/* === PROFIL PROFESSIONNEL === */}
          {seller?.type_compte === 'professionnel' && (
            <>
              {/* Section Vitrine Photos */}
              {seller.images_business && seller.images_business.length > 0 && (
                <View style={styles.vitrineSection}>
                  <View style={styles.vitrineTitleRow}>
                    <Ionicons name="storefront" size={18} color={theme.primary} />
                    <Text style={styles.sectionTitle}>Vitrine d'activité</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md, paddingVertical: SPACING.sm }}>
                    {seller.images_business.map((imgUrl: string, idx: number) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.9}
                        onPress={() => {
                          setViewerIndex(idx);
                          setViewerVisible(true);
                        }}
                      >
                        <Image source={{ uri: imgUrl }} style={styles.vitrineImage} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Bio / Description */}
              {seller.bio ? (
                <View style={styles.bioSection}>
                  <View style={styles.vitrineTitleRow}>
                    <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                    <Text style={styles.sectionTitle}>À propos</Text>
                  </View>
                  <Text style={styles.bioText}>{seller.bio}</Text>
                </View>
              ) : null}

              {/* Contacts & Réseaux (PRO) */}
              {(seller.telephone || seller.whatsapp || seller.instagram || seller.tiktok || seller.facebook) ? (
                <View style={styles.contactsSection}>
                  <View style={styles.vitrineTitleRow}>
                    <Ionicons name="call-outline" size={18} color={theme.primary} />
                    <Text style={styles.sectionTitle}>Contacts & Réseaux</Text>
                  </View>
                  <View style={styles.socialsGrid}>
                    {seller.telephone ? (
                      <TouchableOpacity style={[styles.socialChip, { backgroundColor: '#15803d15', borderColor: '#15803d40' }]} onPress={() => Linking.openURL(`tel:${seller.telephone}`)}>
                        <Ionicons name="call-outline" size={16} color="#15803d" />
                        <Text style={[styles.socialChipText, { color: '#15803d' }]}>{seller.telephone}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {seller.whatsapp ? (
                      <TouchableOpacity style={[styles.socialChip, { backgroundColor: '#25D36615', borderColor: '#25D36640' }]} onPress={() => Linking.openURL(`https://wa.me/${seller.whatsapp.replace(/[^0-9]/g, '')}`)}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                        <Text style={[styles.socialChipText, { color: '#25D366' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    ) : null}
                    {seller.instagram ? (
                      <TouchableOpacity style={[styles.socialChip, { backgroundColor: '#E1306C15', borderColor: '#E1306C40' }]} onPress={() => Linking.openURL(`https://instagram.com/${seller.instagram.replace('@', '')}`)}>
                        <Ionicons name="logo-instagram" size={16} color="#E1306C" />
                        <Text style={[styles.socialChipText, { color: '#E1306C' }]}>Instagram</Text>
                      </TouchableOpacity>
                    ) : null}
                    {seller.tiktok ? (
                      <TouchableOpacity style={[styles.socialChip, { backgroundColor: '#01010115', borderColor: '#01010140' }]} onPress={() => Linking.openURL(`https://tiktok.com/@${seller.tiktok.replace('@', '')}`)}>
                        <Ionicons name="musical-notes-outline" size={16} color={theme.textPrimary} />
                        <Text style={[styles.socialChipText, { color: theme.textPrimary }]}>TikTok</Text>
                      </TouchableOpacity>
                    ) : null}
                    {seller.facebook ? (
                      <TouchableOpacity style={[styles.socialChip, { backgroundColor: '#1877F215', borderColor: '#1877F240' }]} onPress={() => Linking.openURL(`https://facebook.com/${seller.facebook}`)}
                      >
                        <Ionicons name="logo-facebook" size={16} color="#1877F2" />
                        <Text style={[styles.socialChipText, { color: '#1877F2' }]}>Facebook</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.sectionDivider} />
            </>
          )}

          {/* Annonces */}
          <Text style={styles.sectionTitle}>
            Annonces ({loadingAnnonces ? '…' : annonces.length})
          </Text>
          {loadingAnnonces ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
          ) : annonces.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="pricetag-outline" size={32} color={theme.borderLight} />
              <Text style={styles.emptyText}>Aucune annonce active</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {annonces.map((item, index) => {
                const imageUrl = item.images?.[0]?.image_url || null;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.card, index % 2 === 1 && { marginLeft: SPACING.md }]}
                    onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
                    activeOpacity={0.8}
                  >
                    {imageUrl
                      ? <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                      : <View style={[styles.cardImage, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="image-outline" size={28} color={theme.borderLight} />
                        </View>
                    }
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{item.titre}</Text>
                      <Text style={styles.cardPrice}>{formatPrix(item.prix)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Avis */}
          <Text style={[styles.sectionTitle, { marginTop: SPACING.xxl }]}>
            Avis reçus ({loadingAvis ? '…' : avis.length})
          </Text>
          {loadingAvis ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
          ) : avis.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="star-outline" size={32} color={theme.borderLight} />
              <Text style={styles.emptyText}>Aucun avis pour l'instant</Text>
            </View>
          ) : (
            avis.map(a => <AvisCard key={a.id} avis={a} />)
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Full-screen Image Swiper Modal (Album Photo) */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          
          {/* Header */}
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerIndexText}>
              {viewerIndex + 1} / {seller?.images_business?.length || 0}
            </Text>
            <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Swiper ScrollView */}
          <ScrollView
            ref={viewerScrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / W);
              setViewerIndex(idx);
            }}
            style={styles.viewerScrollView}
          >
            {seller?.images_business?.map((imgUrl: string, idx: number) => (
              <View key={idx} style={styles.viewerImageWrapper}>
                <Image source={{ uri: imgUrl }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // PRO Snapchat style header styles
  proHeaderContainer: {
    backgroundColor: theme.background,
    width: '100%',
  },
  bannerContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    backgroundColor: theme.borderLight,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  proProfileInfoContainer: {
    alignItems: 'center',
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    width: '100%',
  },
  proAvatarWrapper: {
    marginTop: -44,
    marginBottom: 8,
    position: 'relative',
    zIndex: 10,
  },
  proAvatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: theme.background,
  },
  proAvatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.background,
  },
  proAvatarInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  proNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  proDisplayName: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.extrabold,
    color: theme.textPrimary,
  },
  proBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  proIdentifierText: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginBottom: 6,
  },
  proRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  proRatingText: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    fontWeight: FONTS.semibold,
  },
  proBioText: {
    fontSize: FONTS.sm,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: 12,
    lineHeight: 18,
  },
  proStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: 4,
    marginBottom: SPACING.md,
    width: '100%',
  },
  proStat: { flex: 1, alignItems: 'center' },
  proStatValue: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  proStatLabel: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 2 },
  proStatDivider: { width: 1, height: 24, backgroundColor: theme.borderLight },

  snapActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  snapBtnFilled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    maxWidth: 140,
    ...SHADOWS.sm,
  },
  snapBtnTextFilled: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  snapBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    maxWidth: 140,
  },
  snapBtnTextOutline: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: theme.primary,
  },

  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    position: 'relative',
    ...SHADOWS.md,
  },
  proHeader: {
    paddingTop: Platform.OS === 'ios' ? 70 : 55,
    paddingBottom: 40,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarInitial: { fontSize: FONTS.xxxl, fontWeight: FONTS.bold, color: '#fff' },
  displayName: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: '#fff' },
  ratingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  ratingHeaderText: { fontSize: FONTS.xs, color: '#fff', fontWeight: FONTS.semibold, opacity: 0.9 },
  sellerName: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: '#fff', marginTop: SPACING.sm },
  sellerBio: {
    fontSize: FONTS.sm, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', lineHeight: 18,
    paddingHorizontal: SPACING.lg,
  },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.xl, paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl, marginTop: SPACING.md,
    width: '100%',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: '#fff' },
  statLabel: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },

  contactRow: {
    flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm,
  },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: SPACING.xl, paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  contactBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },

  body: { padding: SPACING.lg },

  vitrineSection: {
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  bioSection: {
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  contactsSection: {
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  vitrineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  vitrineImage: {
    width: 150,
    height: 150,
    borderRadius: RADIUS.lg,
  },
  bioText: {
    fontSize: FONTS.md,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  socialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  socialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  socialChipText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginVertical: SPACING.lg,
  },

  sectionTitle: {
    fontSize: FONTS.lg, fontWeight: FONTS.bold,
    color: theme.textPrimary, marginBottom: SPACING.lg,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    width: CARD_W, marginBottom: SPACING.lg,
    backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.sm,
  },
  cardImage: { width: '100%', height: CARD_W * 0.8, backgroundColor: theme.surfaceMuted },
  cardInfo: { padding: SPACING.md },
  cardTitle: {
    fontSize: FONTS.sm, fontWeight: FONTS.semibold,
    color: theme.textPrimary, lineHeight: 18, marginBottom: 3,
  },
  cardPrice: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },

  emptyCard: {
    alignItems: 'center', paddingVertical: SPACING.xxl,
    gap: SPACING.md, backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.xl,
  },
  emptyText: { fontSize: FONTS.sm, color: theme.textMuted },

  avisCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  avisHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  avisAvatar: { width: 40, height: 40, borderRadius: 20 },

  // Fullscreen Viewer Styles
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    zIndex: 10,
  },
  viewerIndexText: {
    color: '#fff',
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
  },
  viewerCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerScrollView: {
    width: W,
    flex: 1,
  },
  viewerImageWrapper: {
    width: W,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: W,
    height: '100%',
  },
});
