import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, Platform, Alert, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Share, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase, Annonce } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  navigation: any;
}

const LIVRAISON_OPTIONS = [
  { key: 'disponible', label: 'Livraison disponible', icon: 'bicycle-outline' },
  { key: 'a_discuter', label: 'À discuter', icon: 'chatbubble-ellipses-outline' },
  { key: 'retrait', label: 'Retrait en boutique', icon: 'storefront-outline' },
] as const;

/** Slug URL à partir du nom de boutique : « Chez Fatim Élec » → chez-fatim-elec */
function slugify(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Gestion de la boutique PRO : identité (nom, lien, quartier, horaires,
 * livraison) + catalogue avec stock et masquage par produit.
 * Réservé aux comptes professionnels.
 */
export default function MaBoutiqueScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { session, user, refreshUser } = useAuth();

  const [produits, setProduits] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Champs d'édition
  const [nomBoutique, setNomBoutique] = useState('');
  const [quartier, setQuartier] = useState('');
  const [adresse, setAdresse] = useState('');
  const [horaires, setHoraires] = useState('');
  const [livraison, setLivraison] = useState<string | null>(null);
  const [fraisLivraison, setFraisLivraison] = useState('');

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const isPro = user?.type_compte === 'professionnel';

  const fetchProduits = useCallback(() => {
    if (!session) return;
    supabase
      .from('annonces')
      .select('*, images:images_annonce(image_url, ordre)')
      .eq('user_id', session.user.id)
      .in('statut', ['active', 'vendu'])
      .order('date_creation', { ascending: false })
      .then(({ data }) => {
        if (data) setProduits(data as Annonce[]);
        setLoading(false);
      });
  }, [session]);

  useEffect(() => {
    fetchProduits();
  }, [fetchProduits]);

  function openEdit() {
    setNomBoutique(user?.nom_boutique || '');
    setQuartier(user?.quartier_boutique || '');
    setAdresse(user?.adresse_boutique || '');
    setHoraires(user?.horaires || '');
    setLivraison(user?.livraison || null);
    setFraisLivraison(user?.frais_livraison || '');
    setEditVisible(true);
  }

  async function saveBoutique() {
    if (!session) return;
    if (nomBoutique.trim().length < 3) {
      Alert.alert('Nom requis', 'Donnez un nom à votre boutique (min. 3 caractères).');
      return;
    }
    setSaving(true);
    try {
      // Slug : généré à partir du nom, conservé s'il existe déjà (le lien
      // partagé ne doit pas casser), suffixe numérique en cas de collision.
      let slug = user?.boutique_slug || slugify(nomBoutique.trim());
      let updated = false;
      for (let tentative = 0; tentative < 4 && !updated; tentative++) {
        const { error } = await supabase
          .from('users')
          .update({
            nom_boutique: nomBoutique.trim(),
            boutique_slug: slug,
            quartier_boutique: quartier.trim() || null,
            adresse_boutique: adresse.trim() || null,
            horaires: horaires.trim() || null,
            livraison: livraison,
            frais_livraison: fraisLivraison.trim() || null,
          })
          .eq('id', session.user.id);
        if (!error) {
          updated = true;
        } else if (error.code === '23505') {
          slug = slugify(nomBoutique.trim()) + '-' + Math.floor(10 + Math.random() * 90);
        } else {
          throw error;
        }
      }
      if (!updated) throw new Error('Impossible de générer un lien unique, réessayez.');
      await refreshUser();
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'enregistrer la boutique.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduit(id: string, patch: Partial<Annonce>) {
    // Optimiste : l'UI répond immédiatement, rollback si erreur
    const avant = produits;
    setProduits(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from('annonces').update(patch).eq('id', id);
    if (error) {
      setProduits(avant);
      Alert.alert('Erreur', error.message);
    }
  }

  async function shareBoutique() {
    const lien = user?.boutique_slug
      ? `https://app-flashmarket.com/b/${user.boutique_slug}`
      : 'https://app-flashmarket.com';
    try {
      await Share.share({
        message: `Découvre ma boutique « ${user?.nom_boutique || 'Flash Market'} » sur Flash Market : ${lien}`,
      });
    } catch {}
  }

  // Complétude : chaque info remplie donne envie de finir
  const completude = [
    !!user?.nom_boutique,
    !!user?.banniere_url,
    !!user?.quartier_boutique,
    !!user?.horaires,
    !!user?.livraison,
    produits.length > 0,
  ].filter(Boolean).length;
  const completudePct = Math.round((completude / 6) * 100);

  function renderHeader() {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ma boutique</Text>
        <TouchableOpacity style={styles.backBtn} onPress={shareBoutique} activeOpacity={0.8}>
          <Ionicons name="share-social-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  // Garde : réservé aux comptes PRO
  if (!isPro) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        {renderHeader()}
        <View style={styles.centerBox}>
          <Ionicons name="storefront-outline" size={48} color={theme.textMuted} />
          <Text style={styles.centerTitle}>Réservé aux boutiques PRO</Text>
          <Text style={styles.centerText}>
            Passez votre compte en mode « Professionnel » depuis votre profil pour créer votre boutique.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Retour au profil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ---- Carte identité ---- */}
        <View style={styles.identityCard}>
          {user?.banniere_url ? (
            <Image source={{ uri: user.banniere_url }} style={styles.banner} />
          ) : (
            <View style={[styles.banner, styles.bannerPlaceholder]}>
              <Ionicons name="image-outline" size={22} color="rgba(255,255,255,.8)" />
              <Text style={styles.bannerPlaceholderText}>Ajoutez une bannière depuis « Modifier le profil »</Text>
            </View>
          )}
          <View style={styles.identityBody}>
            <View style={styles.logoWrap}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoFallback]}>
                  <Text style={styles.logoInitial}>{(user?.nom_boutique || user?.prenom || '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.identityText}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.boutiqueName} numberOfLines={1}>
                  {user?.nom_boutique || 'Nommez votre boutique'}
                </Text>
                <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
              </View>
              <Text style={styles.boutiqueMeta} numberOfLines={1}>
                {user?.quartier_boutique
                  ? `📍 ${user.quartier_boutique}${user?.horaires ? ' · 🕒 ' + user.horaires : ''}`
                  : 'Quartier et horaires à renseigner'}
              </Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {/* Jauge de complétude */}
          <View style={styles.completudeWrap}>
            <View style={styles.completudeHead}>
              <Text style={styles.completudeLabel}>
                {completudePct === 100 ? 'Boutique complète 🎉' : `Boutique complète à ${completudePct} %`}
              </Text>
            </View>
            <View style={styles.completudeBarBg}>
              <View style={[styles.completudeBarFill, { width: `${completudePct}%` }]} />
            </View>
            {completudePct < 100 && (
              <Text style={styles.completudeHint}>
                {!user?.nom_boutique ? 'Commencez par nommer votre boutique.'
                  : !user?.banniere_url ? 'Ajoutez une bannière (Modifier le profil).'
                  : !user?.quartier_boutique ? 'Indiquez votre quartier.'
                  : !user?.horaires ? 'Renseignez vos horaires.'
                  : !user?.livraison ? 'Précisez votre politique de livraison.'
                  : 'Ajoutez votre premier produit.'}
              </Text>
            )}
          </View>
        </View>

        {/* ---- Lien partageable ---- */}
        {user?.boutique_slug && (
          <TouchableOpacity style={styles.linkCard} onPress={shareBoutique} activeOpacity={0.8}>
            <Ionicons name="link-outline" size={18} color={theme.primary} />
            <Text style={styles.linkText} numberOfLines={1}>app-flashmarket.com/b/{user.boutique_slug}</Text>
            <Ionicons name="share-social-outline" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}

        {/* ---- Livraison ---- */}
        {user?.livraison && (
          <View style={styles.livraisonCard}>
            <Ionicons
              name={LIVRAISON_OPTIONS.find(o => o.key === user.livraison)?.icon as any}
              size={18} color={theme.primary}
            />
            <Text style={styles.livraisonText}>
              {LIVRAISON_OPTIONS.find(o => o.key === user.livraison)?.label}
              {user?.frais_livraison ? ` · ${user.frais_livraison}` : ''}
            </Text>
          </View>
        )}

        {/* ---- Aperçu client ---- */}
        <TouchableOpacity
          style={styles.previewBtn}
          onPress={() => navigation.navigate('Boutique', { vendeurId: session?.user.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="eye-outline" size={17} color={theme.primary} style={{ marginRight: 8 }} />
          <Text style={styles.previewBtnText}>Voir ma boutique comme un client</Text>
        </TouchableOpacity>

        {/* ---- Catalogue ---- */}
        <View style={styles.catalogueHead}>
          <Text style={styles.sectionLabel}>Catalogue ({produits.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Publier' })} activeOpacity={0.8}>
            <Text style={styles.addLink}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
        ) : produits.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={40} color={theme.borderLight} />
            <Text style={styles.emptyText}>Votre catalogue est vide.</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Main', { screen: 'Publier' })} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Ajouter mon premier produit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          produits.map(p => {
            const img = p.images && p.images.length > 0
              ? [...p.images].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))[0].image_url
              : null;
            const enRupture = p.stock === 0;
            const masque = p.visible === false;
            return (
              <View key={p.id} style={[styles.produitCard, masque && styles.produitCardMasque]}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.produitImg} />
                ) : (
                  <View style={[styles.produitImg, styles.produitImgFallback]}>
                    <Ionicons name="image-outline" size={20} color={theme.textMuted} />
                  </View>
                )}
                <View style={styles.produitBody}>
                  <Text style={styles.produitTitre} numberOfLines={1}>{p.titre}</Text>
                  <Text style={styles.produitPrix}>{Number(p.prix).toLocaleString('fr-FR')} FCFA</Text>
                  <View style={styles.produitMetaRow}>
                    <Text style={styles.produitMeta}>👁 {p.nombre_vues || 0}</Text>
                    {p.statut === 'vendu' && <View style={[styles.badge, styles.badgeGris]}><Text style={styles.badgeText}>Vendu</Text></View>}
                    {enRupture && p.statut !== 'vendu' && <View style={[styles.badge, styles.badgeRouge]}><Text style={styles.badgeText}>Rupture</Text></View>}
                    {masque && <View style={[styles.badge, styles.badgeGris]}><Text style={styles.badgeText}>Masqué</Text></View>}
                  </View>

                  {/* Stock : − x + */}
                  <View style={styles.stockRow}>
                    <Text style={styles.stockLabel}>Stock</Text>
                    <TouchableOpacity
                      style={styles.stockBtn}
                      onPress={() => updateProduit(p.id, { stock: Math.max(0, (p.stock ?? 1) - 1) })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.stockValue}>{p.stock ?? '—'}</Text>
                    <TouchableOpacity
                      style={styles.stockBtn}
                      onPress={() => updateProduit(p.id, { stock: (p.stock ?? 0) + 1 })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <Ionicons name={masque ? 'eye-off-outline' : 'eye-outline'} size={15} color={theme.textMuted} />
                    <Switch
                      value={!masque}
                      onValueChange={(v) => updateProduit(p.id, { visible: v })}
                      trackColor={{ false: theme.borderLight, true: theme.primary }}
                      thumbColor="#fff"
                      style={{ transform: [{ scale: 0.8 }] }}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ---- Modal édition infos boutique ---- */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Infos de la boutique</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Nom de la boutique</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. Chez Fatim Électronique"
                placeholderTextColor={theme.textMuted}
                value={nomBoutique}
                onChangeText={setNomBoutique}
                maxLength={40}
              />
              <Text style={styles.fieldLabel}>Quartier</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. Lafiabougou"
                placeholderTextColor={theme.textMuted}
                value={quartier}
                onChangeText={setQuartier}
                maxLength={40}
              />
              <Text style={styles.fieldLabel}>Adresse / point de repère</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. En face de la pharmacie du marché"
                placeholderTextColor={theme.textMuted}
                value={adresse}
                onChangeText={setAdresse}
                maxLength={80}
              />
              <Text style={styles.fieldLabel}>Horaires</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. Lun–Sam, 8h – 19h"
                placeholderTextColor={theme.textMuted}
                value={horaires}
                onChangeText={setHoraires}
                maxLength={60}
              />
              <Text style={styles.fieldLabel}>Livraison</Text>
              <View style={styles.chipsRow}>
                {LIVRAISON_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.chip, livraison === o.key && styles.chipActive]}
                    onPress={() => setLivraison(livraison === o.key ? null : o.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={o.icon as any} size={14} color={livraison === o.key ? '#fff' : theme.textSecondary} />
                    <Text style={[styles.chipText, livraison === o.key && styles.chipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {livraison === 'disponible' && (
                <>
                  <Text style={styles.fieldLabel}>Frais de livraison (indicatif)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ex. 500 – 1 500 F selon le quartier"
                    placeholderTextColor={theme.textMuted}
                    value={fraisLivraison}
                    onChangeText={setFraisLivraison}
                    maxLength={60}
                  />
                </>
              )}
              <TouchableOpacity
                style={[styles.ctaBtn, { marginTop: SPACING.lg }]}
                onPress={saveBoutique}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer</Text>}
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  scrollContent: { padding: SPACING.lg, paddingBottom: 40 },
  centerBox: { alignItems: 'center', padding: SPACING.xxl, marginTop: 40, gap: SPACING.md },
  centerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  centerText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

  identityCard: { backgroundColor: theme.surface, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.md },
  banner: { width: '100%', height: 110, backgroundColor: theme.primaryDark },
  bannerPlaceholder: {
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: theme.primaryDark,
  },
  bannerPlaceholderText: { fontSize: FONTS.xs, color: 'rgba(255,255,255,.85)', fontWeight: FONTS.medium },
  identityBody: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, paddingTop: 0, marginTop: -26 },
  logoWrap: { borderRadius: RADIUS.lg, padding: 3, backgroundColor: theme.surface, ...SHADOWS.sm },
  logo: { width: 56, height: 56, borderRadius: RADIUS.md },
  logoFallback: { backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  logoInitial: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: theme.primary },
  identityText: { flex: 1, marginLeft: SPACING.md, marginTop: 22 },
  boutiqueName: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary, flexShrink: 1 },
  proBadge: { backgroundColor: theme.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs },
  proBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  boutiqueMeta: { fontSize: FONTS.xs, color: theme.textSecondary, marginTop: 2 },
  editBtn: {
    width: 36, height: 36, borderRadius: 18, marginTop: 22,
    backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center',
  },

  completudeWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  completudeHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  completudeLabel: { fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textSecondary },
  completudeBarBg: { height: 6, backgroundColor: theme.surfaceMuted, borderRadius: 3, overflow: 'hidden' },
  completudeBarFill: { height: 6, backgroundColor: theme.primary, borderRadius: 3 },
  completudeHint: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 6 },

  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: theme.primaryFaded, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.md,
  },
  linkText: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary },

  livraisonCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: theme.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.sm, ...SHADOWS.sm,
  },
  livraisonText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, fontWeight: FONTS.medium },

  previewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: theme.primary, borderRadius: RADIUS.md,
    paddingVertical: 12, marginTop: SPACING.md,
  },
  previewBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },

  catalogueHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  addLink: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },

  emptyBox: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyText: { fontSize: FONTS.sm, color: theme.textSecondary },

  produitCard: {
    flexDirection: 'row', backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  produitCardMasque: { opacity: 0.55 },
  produitImg: { width: 84, height: 84, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted },
  produitImgFallback: { justifyContent: 'center', alignItems: 'center' },
  produitBody: { flex: 1, marginLeft: SPACING.md },
  produitTitre: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary },
  produitPrix: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: theme.primary, marginTop: 1 },
  produitMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  produitMeta: { fontSize: FONTS.xs, color: theme.textMuted },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.xs },
  badgeGris: { backgroundColor: theme.surfaceMuted },
  badgeRouge: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 10, fontWeight: FONTS.bold, color: theme.textSecondary },

  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stockLabel: { fontSize: FONTS.xs, color: theme.textSecondary, fontWeight: FONTS.semibold },
  stockBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center',
  },
  stockValue: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary, minWidth: 22, textAlign: 'center' },

  ctaBtn: {
    height: 50, backgroundColor: theme.primary, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl, ...SHADOWS.colored,
  },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.xl, maxHeight: '88%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  fieldLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg,
    paddingVertical: 12, fontSize: FONTS.md, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.borderLight,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderLight,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary },
  chipTextActive: { color: '#fff' },
});
