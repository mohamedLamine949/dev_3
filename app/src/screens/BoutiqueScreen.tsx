import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, Platform, Alert, ActivityIndicator, Linking, Dimensions, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase, Annonce, User, Catalogue } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSellerAvis } from '../hooks/useAvis';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - SPACING.lg * 2 - SPACING.md) / 2;

interface Props {
  navigation: any;
  route: any;
}

const LIVRAISON_LABELS: Record<string, { label: string; icon: string }> = {
  disponible: { label: 'Livraison disponible', icon: 'bicycle-outline' },
  a_discuter: { label: 'Livraison à discuter', icon: 'chatbubble-ellipses-outline' },
  retrait: { label: 'Retrait en boutique', icon: 'storefront-outline' },
};

/**
 * Page boutique publique : la vitrine que voit un client.
 * Bannière, identité, note, infos pratiques, contact et catalogue avec
 * bouton « Commander » (→ conversation pré-remplie, spec refonte PRO v1).
 */
export default function BoutiqueScreen({ navigation, route }: Props) {
  const { vendeurId } = route.params || {};
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const { avis, avgNote } = useSellerAvis(vendeurId);

  const [vendeur, setVendeur] = useState<User | null>(null);
  const [produits, setProduits] = useState<Annonce[]>([]);
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandeEnCours, setCommandeEnCours] = useState<string | null>(null);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const isOwner = session?.user?.id === vendeurId;

  useEffect(() => {
    if (!vendeurId) return;
    Promise.all([
      supabase.from('users').select('*').eq('id', vendeurId).single(),
      supabase
        .from('annonces')
        .select('*, images:images_annonce(image_url, ordre)')
        .eq('user_id', vendeurId)
        .eq('statut', 'active')
        .order('date_creation', { ascending: false }),
      supabase
        .from('catalogues')
        .select('*')
        .eq('user_id', vendeurId)
        .order('ordre', { ascending: true })
        .order('date_creation', { ascending: true }),
    ]).then(([{ data: u }, { data: a }, { data: c }]) => {
      setVendeur((u as User) || null);
      setProduits((a as Annonce[]) || []);
      setCatalogues((c as Catalogue[]) || []);
      setLoading(false);
    });
  }, [vendeurId]);

  // Commander = créer une VRAIE commande (pas un message) : le vendeur la
  // gère depuis « Commandes reçues », le client la suit depuis « Mes commandes ».
  function commander(p: Annonce) {
    if (!session) {
      Alert.alert('Connexion requise', 'Créez un compte pour commander auprès de cette boutique.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    if (isOwner || commandeEnCours) return;
    Alert.alert(
      'Commander ce produit ?',
      `${p.titre} — ${Number(p.prix).toLocaleString('fr-FR')} FCFA\nLa boutique sera notifiée et vous répondra.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Commander',
          onPress: async () => {
            setCommandeEnCours(p.id);
            const { error } = await supabase.from('commandes').insert({
              vendeur_id: vendeurId,
              client_id: session.user.id,
              produit_id: p.id,
              catalogue_id: p.catalogue_id || null,
              produit_titre: p.titre,
              prix: p.prix,
              quantite: 1,
            });
            setCommandeEnCours(null);
            if (error) {
              Alert.alert('Erreur', error.message);
            } else {
              Alert.alert('Commande envoyée ✅', 'La boutique vient d\'être notifiée. Suivez votre commande dans « Mes commandes ».', [
                { text: 'OK' },
                { text: 'Mes commandes', onPress: () => navigation.navigate('Commandes', { mode: 'client' }) },
              ]);
            }
          },
        },
      ]
    );
  }

  async function partager() {
    const lien = vendeur?.boutique_slug
      ? `https://app-flashmarket.com/b/${vendeur.boutique_slug}`
      : 'https://app-flashmarket.com';
    try {
      await Share.share({ message: `Découvre la boutique « ${nomBoutique} » sur Flash Market : ${lien}` });
    } catch {}
  }

  const nomBoutique = vendeur?.nom_boutique || `${vendeur?.prenom || ''} ${vendeur?.nom || ''}`.trim() || 'Boutique';
  const livraisonMeta = vendeur?.livraison ? LIVRAISON_LABELS[vendeur.livraison] : null;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ---- Bannière + navigation ---- */}
        <View style={styles.bannerWrap}>
          {vendeur?.banniere_url ? (
            <Image source={{ uri: vendeur.banniere_url }} style={styles.banner} />
          ) : (
            <View style={[styles.banner, { backgroundColor: theme.primaryDark }]} />
          )}
          <View style={styles.bannerOverlay} />
          <TouchableOpacity style={[styles.roundBtn, styles.backPos]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundBtn, styles.sharePos]} onPress={partager} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ---- Identité ---- */}
        <View style={styles.identity}>
          {vendeur?.avatar_url ? (
            <Image source={{ uri: vendeur.avatar_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoInitial}>{nomBoutique.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm }}>
            <Text style={styles.nom}>{nomBoutique}</Text>
            <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
          </View>
          {avgNote !== null && (
            <View style={styles.noteRow}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.noteText}>{avgNote.toFixed(1)} / 5 · {avis.length} avis</Text>
            </View>
          )}
          {vendeur?.bio ? <Text style={styles.bio} numberOfLines={3}>{vendeur.bio}</Text> : null}
        </View>

        {/* ---- Infos pratiques ---- */}
        <View style={styles.infosCard}>
          {(vendeur?.quartier_boutique || vendeur?.adresse_boutique) && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={17} color={theme.primary} />
              <Text style={styles.infoText}>
                {[vendeur?.quartier_boutique, vendeur?.adresse_boutique].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
          {vendeur?.horaires && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={17} color={theme.primary} />
              <Text style={styles.infoText}>{vendeur.horaires}</Text>
            </View>
          )}
          {livraisonMeta && (
            <View style={styles.infoRow}>
              <Ionicons name={livraisonMeta.icon as any} size={17} color={theme.primary} />
              <Text style={styles.infoText}>
                {livraisonMeta.label}
                {vendeur?.frais_livraison ? ` · ${vendeur.frais_livraison}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ---- Contact ---- */}
        {!isOwner && (vendeur?.telephone || vendeur?.whatsapp) && (
          <View style={styles.contactRow}>
            {vendeur?.telephone && (
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`tel:${vendeur.telephone}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={16} color="#fff" />
                <Text style={styles.contactBtnText}>Appeler</Text>
              </TouchableOpacity>
            )}
            {vendeur?.whatsapp && (
              <TouchableOpacity
                style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
                onPress={() => Linking.openURL(`https://wa.me/${vendeur.whatsapp?.replace(/[^0-9]/g, '')}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                <Text style={styles.contactBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ---- Catalogue par rayons ---- */}
        {produits.length === 0 ? (
          <>
            <Text style={styles.sectionLabel}>Catalogue</Text>
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={40} color={theme.borderLight} />
              <Text style={styles.emptyText}>Cette boutique n'a pas encore de produits en ligne.</Text>
            </View>
          </>
        ) : (
          (() => {
            const renderCard = (p: Annonce) => {
              const img = p.images && p.images.length > 0
                ? [...p.images].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))[0].image_url
                : null;
              const enRupture = p.stock === 0;
              const masque = p.visible === false; // visible seulement en aperçu propriétaire
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.card, masque && { opacity: 0.55 }]}
                  onPress={() => navigation.navigate('AnnonceDetail', { annonce: p })}
                  activeOpacity={0.9}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={styles.cardImg} />
                  ) : (
                    <View style={[styles.cardImg, styles.cardImgFallback]}>
                      <Ionicons name="image-outline" size={24} color={theme.textMuted} />
                    </View>
                  )}
                  {enRupture && (
                    <View style={styles.ruptureBadge}><Text style={styles.ruptureBadgeText}>Rupture</Text></View>
                  )}
                  {masque && (
                    <View style={[styles.ruptureBadge, { backgroundColor: theme.textMuted }]}>
                      <Text style={styles.ruptureBadgeText}>Masqué</Text>
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitre} numberOfLines={1}>{p.titre}</Text>
                    <Text style={styles.cardPrix}>{Number(p.prix).toLocaleString('fr-FR')} F</Text>
                    {!isOwner && (
                      <TouchableOpacity
                        style={[styles.commanderBtn, enRupture && styles.commanderBtnOff]}
                        onPress={() => commander(p)}
                        disabled={enRupture || commandeEnCours === p.id}
                        activeOpacity={0.85}
                      >
                        {commandeEnCours === p.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="bag-check-outline" size={13} color={enRupture ? theme.textMuted : '#fff'} />
                            <Text style={[styles.commanderText, enRupture && { color: theme.textMuted }]}>
                              {enRupture ? 'Épuisé' : 'Commander'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            };

            // Regroupe par rayon (catalogue) ; les produits non rangés vont dans « Autres »
            const groupes = [
              ...catalogues
                .map(c => ({ nom: c.nom, items: produits.filter(p => p.catalogue_id === c.id) }))
                .filter(g => g.items.length > 0),
              {
                nom: catalogues.length > 0 ? 'Autres' : 'Catalogue',
                items: produits.filter(p => !p.catalogue_id || !catalogues.some(c => c.id === p.catalogue_id)),
              },
            ].filter(g => g.items.length > 0);

            return groupes.map(g => (
              <View key={g.nom}>
                <Text style={styles.sectionLabel}>{g.nom} ({g.items.length})</Text>
                <View style={styles.grid}>{g.items.map(renderCard)}</View>
              </View>
            ));
          })()
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  bannerWrap: { position: 'relative' },
  banner: { width: '100%', height: 170 },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  roundBtn: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
  backPos: { top: Platform.OS === 'ios' ? 56 : 42, left: SPACING.lg },
  sharePos: { top: Platform.OS === 'ios' ? 56 : 42, right: SPACING.lg },

  identity: { alignItems: 'center', marginTop: -34, paddingHorizontal: SPACING.lg },
  logo: {
    width: 68, height: 68, borderRadius: RADIUS.lg,
    borderWidth: 3, borderColor: theme.background, backgroundColor: theme.surfaceMuted,
  },
  logoFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.primaryFaded },
  logoInitial: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.primary },
  nom: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  proBadge: { backgroundColor: theme.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs },
  proBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  noteText: { fontSize: FONTS.xs, color: theme.textSecondary, fontWeight: FONTS.semibold },
  bio: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 19 },

  infosCard: {
    backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg,
    padding: SPACING.lg, gap: SPACING.sm, ...SHADOWS.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  infoText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary },

  contactRow: { flexDirection: 'row', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginTop: SPACING.sm },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.primary, borderRadius: RADIUS.md, paddingVertical: 11,
  },
  contactBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },

  sectionLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: SPACING.lg, marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },
  emptyBox: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: CARD_W, backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.sm,
  },
  cardImg: { width: '100%', height: CARD_W * 0.9, backgroundColor: theme.surfaceMuted },
  cardImgFallback: { justifyContent: 'center', alignItems: 'center' },
  ruptureBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#dc2626', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs,
  },
  ruptureBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  cardBody: { padding: SPACING.md },
  cardTitre: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  cardPrix: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.primary, marginTop: 2 },
  commanderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: theme.primary, borderRadius: RADIUS.sm,
    paddingVertical: 8, marginTop: SPACING.sm,
  },
  commanderBtnOff: { backgroundColor: theme.surfaceMuted },
  commanderText: { fontSize: FONTS.xs, fontWeight: FONTS.bold, color: '#fff' },
});
