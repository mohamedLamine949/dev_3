import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES, SUBCATEGORIES, ETAT_ARTICLE } from '../constants/theme';
import { supabase, Annonce } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

const MAX_IMAGES = 10;

interface Props {
  route: any;
  navigation: any;
}

export default function EditAnnonceScreen({ route, navigation }: Props) {
  const { annonce } = route.params as { annonce: Annonce };
  const { theme, isDark } = useTheme();

  const [images, setImages] = useState<string[]>([]);
  const [titre, setTitre] = useState(annonce.titre || '');
  const [prix, setPrix] = useState(annonce.prix ? annonce.prix.toString() : '');
  const [description, setDescription] = useState(annonce.description || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(annonce.categorie || null);
  const [selectedSousCategorie, setSelectedSousCategorie] = useState<string | null>(annonce.sous_categorie || null);
  const [selectedEtat, setSelectedEtat] = useState<string | null>(annonce.etat_article || null);
  const [quartier, setQuartier] = useState(annonce.quartier || '');
  const [isSaving, setIsSaving] = useState(false);

  // Charger les images existantes au chargement de l'écran
  useEffect(() => {
    if (annonce.images) {
      const sorted = [...annonce.images]
        .sort((a: any, b: any) => (a.ordre || 0) - (b.ordre || 0))
        .map((img: any) => img.image_url);
      setImages(sorted);
    }
  }, [annonce.images]);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum atteint', `Vous pouvez ajouter ${MAX_IMAGES} photos maximum.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: MAX_IMAGES - images.length,
    });

    if (!result.canceled) {
      const newImages = result.assets.map((a) => a.uri);
      setImages([...images, ...newImages].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!titre || !prix || !selectedCategory || images.length === 0) {
      Alert.alert('Champs manquants', 'Titre, prix, catégorie et au moins une photo sont requis.');
      return;
    }

    try {
      setIsSaving(true);

      // 1. Mettre à jour l'annonce dans la table 'annonces'
      const { error: updateError } = await supabase
        .from('annonces')
        .update({
          titre,
          prix: parseInt(prix, 10),
          description: description || null,
          categorie: selectedCategory,
          sous_categorie: selectedSousCategorie,
          etat_article: selectedEtat || 'non_specifie',
          quartier: quartier || null,
        })
        .eq('id', annonce.id);

      if (updateError) throw updateError;

      // 2. Mettre à jour les images dans la table 'images_annonce'
      // Étape a : Supprimer toutes les images actuelles en base de données pour cette annonce
      const { error: deleteImagesError } = await supabase
        .from('images_annonce')
        .delete()
        .eq('annonce_id', annonce.id);

      if (deleteImagesError) throw deleteImagesError;

      // Étape b : Ré-insérer les images dans l'ordre (téléverser les nouvelles images locales)
      for (let i = 0; i < images.length; i++) {
        const uri = images[i];
        let url = uri;

        if (!uri.startsWith('http')) {
          // C'est une nouvelle image locale, il faut la téléverser dans Supabase Storage
          const fileExt = 'jpg';
          const fileName = `${annonce.id}/${Date.now()}_${i}.${fileExt}`;

          const base64 = await FileSystem.readAsStringAsync(uri, { 
            encoding: 'base64' as any
          });

          const { error: uploadError } = await supabase.storage
            .from('annonces-images')
            .upload(fileName, decode(base64), { 
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error(`Erreur upload image ${i}:`, uploadError);
            continue;
          }

          // Récupérer l'URL publique
          const { data: urlData } = supabase.storage
            .from('annonces-images')
            .getPublicUrl(fileName);
          
          url = urlData.publicUrl;
        }

        // Insérer la référence dans la table images_annonce
        const { error: insertImgError } = await supabase
          .from('images_annonce')
          .insert({
            annonce_id: annonce.id,
            image_url: url,
            ordre: i,
          });

        if (insertImgError) {
          console.error(`Erreur d'insertion en BDD pour l'image ${i}:`, insertImgError);
        }
      }

      Alert.alert('Succès', 'Votre annonce a été modifiée avec succès.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      console.error('Erreur lors de la modification:', err);
      Alert.alert('Erreur', err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = titre && prix && selectedCategory && images.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.headerBtn}>
          <Ionicons name="close" size={26} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier l'annonce</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Photos */}
          <Text style={styles.sectionTitle}>Photos *</Text>
          <Text style={styles.sectionHint}>Ajoutez jusqu'à {MAX_IMAGES} photos. La première sera la photo principale.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
            <TouchableOpacity style={styles.imageAddButton} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="camera" size={28} color={theme.primary} />
              <Text style={styles.imageAddText}>{images.length}/{MAX_IMAGES}</Text>
            </TouchableOpacity>

            {images.map((uri, index) => (
              <View key={index} style={styles.imagePreviewContainer}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.imageRemoveButton} onPress={() => removeImage(index)}>
                  <Ionicons name="close-circle" size={22} color={theme.error} />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.mainPhotoBadge}>
                    <Text style={styles.mainPhotoText}>Principale</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Titre */}
          <Text style={styles.sectionTitle}>Titre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: iPhone 15 Pro Max 256GB"
            placeholderTextColor={theme.textMuted}
            value={titre}
            onChangeText={setTitre}
            maxLength={80}
          />

          {/* Catégorie */}
          <Text style={styles.sectionTitle}>Catégorie *</Text>
          <View style={styles.chipsContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, selectedCategory === cat.id && styles.chipSelected]}
                onPress={() => {
                  if (selectedCategory !== cat.id) setSelectedSousCategorie(null);
                  setSelectedCategory(cat.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sous-catégorie (optionnel, dépend de la catégorie choisie) */}
          {selectedCategory && SUBCATEGORIES[selectedCategory]?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Sous-catégorie <Text style={styles.optionalLabel}>(facultatif)</Text></Text>
              <View style={styles.chipsContainer}>
                {SUBCATEGORIES[selectedCategory].map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.chip, selectedSousCategorie === sub.id && styles.chipSelected]}
                    onPress={() => setSelectedSousCategorie(selectedSousCategorie === sub.id ? null : sub.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selectedSousCategorie === sub.id && styles.chipTextSelected]}>
                      {sub.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* État (optionnel) */}
          <Text style={styles.sectionTitle}>État de l'article <Text style={styles.optionalLabel}>(facultatif)</Text></Text>
          <View style={styles.chipsContainer}>
            {ETAT_ARTICLE.map((etat) => (
              <TouchableOpacity
                key={etat.id}
                style={[styles.chip, selectedEtat === etat.id && styles.chipSelected]}
                onPress={() => setSelectedEtat(selectedEtat === etat.id ? null : etat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedEtat === etat.id && styles.chipTextSelected]}>
                  {etat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Prix */}
          <Text style={styles.sectionTitle}>Prix (FCFA) *</Text>
          <View style={styles.priceInputContainer}>
            <TextInput
              style={styles.priceInput}
              placeholder="Ex: 15000"
              placeholderTextColor={theme.textMuted}
              value={prix}
              onChangeText={setPrix}
              keyboardType="numeric"
            />
            <Text style={styles.prixSuffix}>FCFA</Text>
          </View>

          {/* Quartier (optionnel) */}
          <Text style={styles.sectionTitle}>
            Quartier / Zone <Text style={styles.optionalLabel}>(facultatif)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: ACI 2000, Badalabougou..."
            placeholderTextColor={theme.textMuted}
            value={quartier}
            onChangeText={setQuartier}
          />

          {/* Description (optionnel) */}
          <Text style={styles.sectionTitle}>Description <Text style={styles.optionalLabel}>(facultatif)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Décrivez votre article en quelques lignes..."
            placeholderTextColor={theme.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, (!isFormValid || isSaving) && styles.ctaButtonDisabled]}
          onPress={handleSave}
          disabled={!isFormValid || isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color={theme.textInverse} />
              <Text style={styles.ctaText}>Enregistrer les modifications</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  sectionTitle: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.xl },
  optionalLabel: { fontSize: FONTS.xs, fontWeight: '400', color: theme.textMuted },
  sectionHint: { fontSize: FONTS.sm, color: theme.textMuted, marginBottom: SPACING.md },
  imageRow: { gap: SPACING.md, paddingVertical: SPACING.sm },
  imageAddButton: { width: 100, height: 100, borderRadius: RADIUS.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.primary, backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center', gap: 4 },
  imageAddText: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.primary },
  imagePreviewContainer: { position: 'relative' },
  imagePreview: { width: 100, height: 100, borderRadius: RADIUS.lg },
  imageRemoveButton: { position: 'absolute', top: -6, right: -6, backgroundColor: theme.surface, borderRadius: 12 },
  mainPhotoBadge: { position: 'absolute', bottom: 4, left: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 2, borderRadius: 4, alignItems: 'center' },
  mainPhotoText: { fontSize: 9, fontWeight: FONTS.bold, color: '#fff', textTransform: 'uppercase' },
  input: { backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: 14, fontSize: FONTS.md, color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderLight },
  textArea: { height: 120, paddingTop: 14 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.full, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderLight },
  chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: FONTS.sm, fontWeight: FONTS.medium, color: theme.textSecondary },
  chipTextSelected: { color: theme.textInverse },
  priceInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: theme.borderLight, paddingRight: SPACING.lg },
  priceInput: { flex: 1, paddingHorizontal: SPACING.lg, paddingVertical: 14, fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  prixSuffix: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textMuted },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: Platform.OS === 'ios' ? 34 : 14, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.borderLight },
  ctaButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, backgroundColor: theme.primary, borderRadius: RADIUS.lg, gap: SPACING.sm, ...SHADOWS.colored },
  ctaButtonDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textInverse },
});
