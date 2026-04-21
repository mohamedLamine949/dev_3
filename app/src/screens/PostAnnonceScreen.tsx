import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES, ETAT_ARTICLE } from '../constants/theme';

const MAX_IMAGES = 5;

interface Props {
  navigation: any;
}

export default function PostAnnonceScreen({ navigation }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [titre, setTitre] = useState('');
  const [prix, setPrix] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEtat, setSelectedEtat] = useState<string | null>(null);
  const [ville, setVille] = useState('Bamako');

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum atteint', `Vous pouvez ajouter ${MAX_IMAGES} photos maximum.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const handleSubmit = () => {
    if (!titre || !prix || !selectedCategory || !selectedEtat || images.length === 0) {
      Alert.alert(
        'Champs manquants',
        'Veuillez remplir tous les champs et ajouter au moins une photo.'
      );
      return;
    }
    // TODO: Envoyer vers Supabase, puis rediriger vers le paiement
    Alert.alert(
      'Paiement requis 💳',
      'Votre annonce sera publiée après le paiement de 500 FCFA via Orange Money.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Payer & Publier', onPress: () => console.log('Payment flow') },
      ]
    );
  };

  const isFormValid = titre && prix && selectedCategory && selectedEtat && images.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="close" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Déposer une annonce</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Photos */}
          <Text style={styles.sectionTitle}>Photos *</Text>
          <Text style={styles.sectionHint}>
            Ajoutez jusqu'à {MAX_IMAGES} photos. La première sera la photo principale.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageRow}
          >
            {/* Bouton ajouter */}
            <TouchableOpacity
              style={styles.imageAddButton}
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={28} color={COLORS.primary} />
              <Text style={styles.imageAddText}>
                {images.length}/{MAX_IMAGES}
              </Text>
            </TouchableOpacity>

            {/* Images sélectionnées */}
            {images.map((uri, index) => (
              <View key={index} style={styles.imagePreviewContainer}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.imageRemoveButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={22} color={COLORS.error} />
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
            placeholderTextColor={COLORS.textMuted}
            value={titre}
            onChangeText={setTitre}
            maxLength={80}
          />
          <Text style={styles.charCount}>{titre.length}/80</Text>

          {/* Catégorie */}
          <Text style={styles.sectionTitle}>Catégorie *</Text>
          <View style={styles.chipsContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  selectedCategory === cat.id && styles.chipSelected,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedCategory === cat.id && styles.chipTextSelected,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* État */}
          <Text style={styles.sectionTitle}>État de l'article *</Text>
          <View style={styles.chipsContainer}>
            {ETAT_ARTICLE.map((etat) => (
              <TouchableOpacity
                key={etat.id}
                style={[
                  styles.chip,
                  selectedEtat === etat.id && styles.chipSelected,
                ]}
                onPress={() => setSelectedEtat(etat.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedEtat === etat.id && styles.chipTextSelected,
                  ]}
                >
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
              placeholder="Ex: 650000"
              placeholderTextColor={COLORS.textMuted}
              value={prix}
              onChangeText={setPrix}
              keyboardType="numeric"
            />
            <Text style={styles.prixSuffix}>FCFA</Text>
          </View>

          {/* Ville */}
          <Text style={styles.sectionTitle}>Ville</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Bamako"
            placeholderTextColor={COLORS.textMuted}
            value={ville}
            onChangeText={setVille}
          />

          {/* Description */}
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Décrivez votre article en quelques lignes..."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>

          {/* Coût */}
          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Frais de publication</Text>
              <Text style={styles.costValue}>500 FCFA</Text>
            </View>
            <View style={styles.costDivider} />
            <View style={styles.costInfo}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.costInfoText}>
                Le paiement se fait par Orange Money ou Moov Money.
              </Text>
            </View>
          </View>

          {/* Espacement */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !isFormValid && styles.ctaButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={20} color={COLORS.textInverse} />
          <Text style={styles.ctaText}>Publier pour 500 FCFA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },

  // Section
  sectionTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xl,
  },
  sectionHint: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },

  // Images
  imageRow: {
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  imageAddButton: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  imageAddText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: COLORS.primary,
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.lg,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  mainPhotoText: {
    fontSize: 9,
    fontWeight: FONTS.bold,
    color: '#fff',
    textTransform: 'uppercase',
  },

  // Input
  input: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  charCount: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  // Chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.medium,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.textInverse,
  },

  // Prix
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingRight: SPACING.lg,
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  prixSuffix: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.textMuted,
  },

  // Cost card
  costCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.xxl,
    ...SHADOWS.sm,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
  },
  costValue: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.primary,
  },
  costDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.md,
  },
  costInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  costInfoText: {
    flex: 1,
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    lineHeight: 20,
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 34,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    ...SHADOWS.colored,
  },
  ctaButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: COLORS.textInverse,
  },
});
