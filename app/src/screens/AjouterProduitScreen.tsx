import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, Platform, Alert, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES } from '../constants/theme';
import { supabase, Catalogue } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { createAnnonce } from '../hooks/useAnnonces';
import { pickImages } from '../lib/imagePicker';

const MAX_IMAGES = 4;

interface Props {
  navigation: any;
}

/**
 * Ajout d'un produit de boutique PRO : formulaire volontairement allégé
 * (catalogue, nom, photos, description, prix, stock). Pas de localisation,
 * d'état ou de sous-catégorie : le produit hérite de la catégorie de son
 * catalogue et vit dans la table annonces (infra recherche réutilisée).
 */
export default function AjouterProduitScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { session, user } = useAuth();

  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [catalogueId, setCatalogueId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [stock, setStock] = useState('1');
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Création de catalogue inline
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCatNom, setNewCatNom] = useState('');
  const [newCatCategorie, setNewCatCategorie] = useState<string>('services');
  const [creatingCat, setCreatingCat] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const fetchCatalogues = useCallback(() => {
    if (!session) return;
    supabase
      .from('catalogues')
      .select('*')
      .eq('user_id', session.user.id)
      .order('ordre', { ascending: true })
      .order('date_creation', { ascending: true })
      .then(({ data }) => {
        const cats = (data as Catalogue[]) || [];
        setCatalogues(cats);
        if (!catalogueId && cats.length > 0) setCatalogueId(cats[0].id);
      });
  }, [session, catalogueId]);

  useEffect(() => {
    fetchCatalogues();
  }, [fetchCatalogues]);

  async function addPhotos() {
    if (images.length >= MAX_IMAGES) return;
    const assets = await pickImages({
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (assets) setImages(prev => [...prev, ...assets.map((a: any) => a.uri)].slice(0, MAX_IMAGES));
  }

  async function creerCatalogue() {
    if (!session || newCatNom.trim().length < 2) return;
    setCreatingCat(true);
    try {
      const { data, error } = await supabase
        .from('catalogues')
        .insert({
          user_id: session.user.id,
          nom: newCatNom.trim(),
          categorie: newCatCategorie,
          ordre: catalogues.length,
        })
        .select()
        .single();
      if (error) throw error;
      setCatalogues(prev => [...prev, data as Catalogue]);
      setCatalogueId((data as Catalogue).id);
      setCatModalVisible(false);
      setNewCatNom('');
    } catch (err: any) {
      Alert.alert('Erreur', err.code === '23505'
        ? 'Vous avez déjà un catalogue avec ce nom.'
        : err.message || 'Impossible de créer le catalogue.');
    } finally {
      setCreatingCat(false);
    }
  }

  const prixNum = parseInt(prix.replace(/[^0-9]/g, ''), 10) || 0;
  const stockNum = parseInt(stock.replace(/[^0-9]/g, ''), 10);
  const canSubmit =
    !!catalogueId && nom.trim().length >= 3 && prixNum > 0 &&
    images.length > 0 && !isNaN(stockNum) && !saving;

  async function publier() {
    if (!canSubmit || !session) return;
    const catalogue = catalogues.find(c => c.id === catalogueId);
    setSaving(true);
    try {
      const { annonce, error } = await createAnnonce(
        {
          user_id: session.user.id,
          titre: nom.trim(),
          description: description.trim(),
          prix: prixNum,
          categorie: catalogue?.categorie || 'services',
          etat_article: 'neuf',
          statut: 'active',
          est_payee: true, // produit de boutique : pas de frais de dépôt
          ville: 'Bamako',
          quartier: user?.quartier_boutique || undefined,
          stock: stockNum,
          visible: true,
          catalogue_id: catalogueId,
        } as any,
        images
      );
      if (error) throw new Error(error);
      Alert.alert('Produit en ligne 🎉', `« ${annonce?.titre} » est visible dans votre boutique.`, [
        { text: 'Ajouter un autre', onPress: () => { setNom(''); setDescription(''); setPrix(''); setStock('1'); setImages([]); } },
        { text: 'Voir ma boutique', onPress: () => navigation.replace('MaBoutique') },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de publier le produit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter un produit</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Catalogue */}
          <Text style={styles.fieldLabel}>Catalogue (rayon)</Text>
          <View style={styles.chipsRow}>
            {catalogues.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, catalogueId === c.id && styles.chipActive]}
                onPress={() => setCatalogueId(c.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, catalogueId === c.id && styles.chipTextActive]}>{c.nom}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.chip, styles.chipNew]} onPress={() => setCatModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={14} color={theme.primary} />
              <Text style={[styles.chipText, { color: theme.primary }]}>Nouveau</Text>
            </TouchableOpacity>
          </View>
          {catalogues.length === 0 && (
            <Text style={styles.hint}>Créez votre premier rayon (ex. « Téléphones », « Plats du jour »…).</Text>
          )}

          {/* Photos */}
          <Text style={styles.fieldLabel}>Photos ({images.length}/{MAX_IMAGES})</Text>
          <View style={styles.photosRow}>
            {images.map((uri, i) => (
              <View key={i} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity style={styles.photoAdd} onPress={addPhotos} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={22} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Nom */}
          <Text style={styles.fieldLabel}>Nom du produit</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Ex. iPhone 13 128 Go"
            placeholderTextColor={theme.textMuted}
            value={nom}
            onChangeText={setNom}
            maxLength={60}
          />

          {/* Prix + stock */}
          <View style={{ flexDirection: 'row', gap: SPACING.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Prix (FCFA)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="150 000"
                placeholderTextColor={theme.textMuted}
                value={prix}
                onChangeText={(t) => setPrix(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={9}
              />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.fieldLabel}>Stock</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="1"
                placeholderTextColor={theme.textMuted}
                value={stock}
                onChangeText={(t) => setStock(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>

          {/* Description */}
          <Text style={styles.fieldLabel}>Description (facultatif)</Text>
          <TextInput
            style={[styles.fieldInput, { height: 90, textAlignVertical: 'top' }]}
            placeholder="État, couleur, garantie…"
            placeholderTextColor={theme.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.ctaBtn, !canSubmit && styles.ctaBtnDisabled]}
            onPress={publier}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Mettre en ligne</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal nouveau catalogue */}
      <Modal visible={catModalVisible} animationType="fade" transparent onRequestClose={() => setCatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nouveau rayon</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Nom du rayon (ex. Téléphones)"
              placeholderTextColor={theme.textMuted}
              value={newCatNom}
              onChangeText={setNewCatNom}
              maxLength={40}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Catégorie de recherche associée</Text>
            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.catRow}
                  onPress={() => setNewCatCategorie(c.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={c.icon as any} size={16} color={newCatCategorie === c.id ? theme.primary : theme.textMuted} />
                  <Text style={[styles.catRowText, newCatCategorie === c.id && { color: theme.primary, fontWeight: FONTS.bold }]}>
                    {c.label}
                  </Text>
                  {newCatCategorie === c.id && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setCatModalVisible(false)} activeOpacity={0.8}>
                <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, newCatNom.trim().length < 2 && styles.ctaBtnDisabled]}
                onPress={creerCatalogue}
                disabled={newCatNom.trim().length < 2 || creatingCat}
                activeOpacity={0.8}
              >
                {creatingCat ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnText}>Créer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  scrollContent: { padding: SPACING.lg, paddingBottom: 40 },

  fieldLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: theme.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg,
    paddingVertical: 12, fontSize: FONTS.md, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.borderLight,
  },
  hint: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 6 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipNew: { borderStyle: 'dashed', borderColor: theme.primary, backgroundColor: theme.primaryFaded },
  chipText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textSecondary },
  chipTextActive: { color: '#fff' },

  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  photoWrap: { position: 'relative' },
  photo: { width: 74, height: 74, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted },
  photoRemove: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center',
  },
  photoAdd: {
    width: 74, height: 74, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.primary,
    backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center',
  },

  ctaBtn: {
    height: 52, backgroundColor: theme.primary, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center', marginTop: SPACING.xl, ...SHADOWS.colored,
  },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', padding: SPACING.xl },
  modalBox: { backgroundColor: theme.background, borderRadius: RADIUS.xl, padding: SPACING.xl },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary, marginBottom: SPACING.md },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10 },
  catRowText: { flex: 1, fontSize: FONTS.sm, color: theme.textSecondary },
  modalBtn: {
    flex: 1, height: 44, borderRadius: RADIUS.md, backgroundColor: theme.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: theme.surfaceMuted },
  modalBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },
});
