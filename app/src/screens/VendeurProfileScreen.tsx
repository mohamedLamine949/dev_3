import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, ActivityIndicator, Dimensions, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase, Annonce } from '../lib/supabase';
import { useSellerAvis, Avis } from '../hooks/useAvis';

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

function Stars({ note, size = 14 }: { note: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(note) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(note) ? '#f59e0b' : COLORS.borderLight}
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
    <View style={styles.avisCard}>
      <View style={styles.avisHeader}>
        {a.auteur?.avatar_url ? (
          <Image source={{ uri: a.auteur.avatar_url }} style={styles.avisAvatar} />
        ) : (
          <View style={[styles.avisAvatar, styles.avisAvatarFallback]}>
            <Text style={styles.avisAvatarText}>{authorName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.avisAuthor}>{authorName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Stars note={a.note} size={12} />
            <Text style={styles.avisDate}>{timeAgo(a.date_creation)}</Text>
          </View>
        </View>
      </View>
      {a.commentaire ? <Text style={styles.avisComment}>{a.commentaire}</Text> : null}
    </View>
  );
}

interface Props {
  route: any;
  navigation: any;
}

export default function VendeurProfileScreen({ route, navigation }: Props) {
  const { vendeurId } = route.params as { vendeurId: string };
  const [seller, setSeller] = useState<any>(null);
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [loadingAnnonces, setLoadingAnnonces] = useState(true);
  const { avis, avgNote, loading: loadingAvis } = useSellerAvis(vendeurId);

  useEffect(() => {
    supabase
      .from('users')
      .select('id, prenom, nom, bio, avatar_url, telephone, whatsapp')
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header vert */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          {seller?.avatar_url ? (
            <Image source={{ uri: seller.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{sellerName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <Text style={styles.sellerName}>{sellerName}</Text>
          {seller?.bio ? <Text style={styles.sellerBio}>{seller.bio}</Text> : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{loadingAnnonces ? '…' : annonces.length}</Text>
              <Text style={styles.statLabel}>Annonces</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{loadingAvis ? '…' : avis.length}</Text>
              <Text style={styles.statLabel}>Avis</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {loadingAvis ? '…' : avgNote !== null ? avgNote.toFixed(1) + ' ⭐' : '—'}
              </Text>
              <Text style={styles.statLabel}>Note</Text>
            </View>
          </View>

          {/* Boutons contact */}
          {(seller?.telephone || seller?.whatsapp) ? (
            <View style={styles.contactRow}>
              {seller.telephone ? (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(`tel:${seller.telephone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={16} color="#fff" />
                  <Text style={styles.contactBtnText}>Appeler</Text>
                </TouchableOpacity>
              ) : null}
              {seller.whatsapp ? (
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
                  onPress={() => Linking.openURL(`https://wa.me/${seller.whatsapp.replace(/[^0-9]/g, '')}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                  <Text style={styles.contactBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* Annonces */}
          <Text style={styles.sectionTitle}>
            Annonces ({loadingAnnonces ? '…' : annonces.length})
          </Text>
          {loadingAnnonces ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
          ) : annonces.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="pricetag-outline" size={32} color={COLORS.border} />
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
                      : <View style={[styles.cardImage, { backgroundColor: COLORS.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="image-outline" size={28} color={COLORS.border} />
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
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
          ) : avis.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="star-outline" size={32} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucun avis pour l'instant</Text>
            </View>
          ) : (
            avis.map(a => <AvisCard key={a.id} avis={a} />)
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  backBtn: {
    position: 'absolute',
    top: 54,
    left: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: '#fff',
    marginTop: SPACING.xl,
  },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
    marginTop: SPACING.xl,
  },
  avatarInitial: { fontSize: FONTS.xxxl, fontWeight: FONTS.bold, color: '#fff' },
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

  sectionTitle: {
    fontSize: FONTS.lg, fontWeight: FONTS.bold,
    color: COLORS.textPrimary, marginBottom: SPACING.lg,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    width: CARD_W, marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.sm,
  },
  cardImage: { width: '100%', height: CARD_W * 0.8, backgroundColor: COLORS.surfaceMuted },
  cardInfo: { padding: SPACING.md },
  cardTitle: {
    fontSize: FONTS.sm, fontWeight: FONTS.semibold,
    color: COLORS.textPrimary, lineHeight: 18, marginBottom: 3,
  },
  cardPrice: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: COLORS.primary },

  emptyCard: {
    alignItems: 'center', paddingVertical: SPACING.xxl,
    gap: SPACING.md, backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.xl,
  },
  emptyText: { fontSize: FONTS.sm, color: COLORS.textMuted },

  avisCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  avisHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  avisAvatar: { width: 40, height: 40, borderRadius: 20 },
  avisAvatarFallback: { backgroundColor: COLORS.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  avisAvatarText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: COLORS.primary },
  avisAuthor: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 3 },
  avisDate: { fontSize: FONTS.xs, color: COLORS.textMuted },
  avisComment: { fontSize: FONTS.sm, color: COLORS.textSecondary, lineHeight: 20, marginTop: SPACING.sm },
});
