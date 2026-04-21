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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES, ETAT_ARTICLE } from '../constants/theme';
import { createAnnonce } from '../hooks/useAnnonces';
import { useAuth } from '../contexts/AuthContext';

const MAX_IMAGES = 5;

interface Props {
  navigation: any;
}

export default function PostAnnonceScreen({ navigation }: any) {
  const { session } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [titre, setTitre] = useState('');
  const [prix, setPrix] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEtat, setSelectedEtat] = useState<string | null>(null);
  const [ville, setVille] = useState('Bamako');

  // Payment Modal State
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentStep, setPaymentStep] = useState<'form' | 'processing' | 'success'>('form');

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

  const resetForm = () => {
    setImages([]);
    setTitre('');
    setPrix('');
    setDescription('');
    setSelectedCategory(null);
    setSelectedEtat(null);
    setVille('Bamako');
  };

  const handlePreSubmit = () => {
    if (!session?.user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour publier une annonce.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => navigation.navigate('Login') }
      ]);
      return;
    }

    if (!titre || !prix || !selectedCategory || !selectedEtat || images.length === 0) {
      Alert.alert(
        'Champs manquants',
        'Veuillez remplir tous les champs et ajouter au moins une photo.'
      );
      return;
    }
    // Ouvrir le modal de paiement
    setPaymentStep('form');
    setPaymentModalVisible(true);
  };

  const performPaymentAndUpload = async () => {
    if (paymentPhone.length < 8) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro valide de 8 chiffres.');
      return;
    }

    setPaymentStep('processing');

    // MOCK: Simulation d'un délai réseau pour l'API Orange Money (2 secondes)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Création de l'objet annonce pour Supabase
    // On simule que le paiement est réussi
    const annonceData = {
      titre,
      description,
      prix: parseInt(prix, 10),
      categorie: selectedCategory!,
      etat_article: selectedEtat!,
      ville,
      est_payee: true, // Payé !
      statut: 'active',
      id_transaction_paiement: `OM-${Math.floor(Math.random() * 1000000)}`,
      user_id: session?.user.id, 
    };

    const { error } = await createAnnonce(annonceData as any, images);

    if (error) {
      console.error(error);
      Alert.alert('Erreur de publication', "L'annonce n'a pas pu être publiée. " + error);
      setPaymentModalVisible(false);
      return;
    }

    // Succès !
    setPaymentStep('success');
    
    // Fermer après 3 secondes et rediriger vers Accueil
    setTimeout(() => {
      setPaymentModalVisible(false);
      resetForm();
      navigation.navigate('Accueil');
    }, 3000);
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Photos */}
          <Text style={styles.sectionTitle}>Photos *</Text>
          <Text style={styles.sectionHint}>Ajoutez jusqu'à {MAX_IMAGES} photos. La première sera la photo principale.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
            <TouchableOpacity style={styles.imageAddButton} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="camera" size={28} color={COLORS.primary} />
              <Text style={styles.imageAddText}>{images.length}/{MAX_IMAGES}</Text>
            </TouchableOpacity>

            {images.map((uri, index) => (
              <View key={index} style={styles.imagePreviewContainer}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.imageRemoveButton} onPress={() => removeImage(index)}>
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

          {/* Catégorie */}
          <Text style={styles.sectionTitle}>Catégorie *</Text>
          <View style={styles.chipsContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, selectedCategory === cat.id && styles.chipSelected]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextSelected]}>
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
                style={[styles.chip, selectedEtat === etat.id && styles.chipSelected]}
                onPress={() => setSelectedEtat(etat.id)}
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
          />

          {/* Coût */}
          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Frais de publication</Text>
              <Text style={styles.costValue}>500 FCFA</Text>
            </View>
            <View style={styles.costDivider} />
            <View style={styles.costInfo}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.costInfoText}>Le paiement s'effectuera via Mobile Money.</Text>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !isFormValid && styles.ctaButtonDisabled]}
          onPress={handlePreSubmit}
          disabled={!isFormValid}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={20} color={COLORS.textInverse} />
          <Text style={styles.ctaText}>Publier pour 500 FCFA</Text>
        </TouchableOpacity>
      </View>

      {/* MOCK PAYMENT MODAL */}
      <Modal
        visible={isPaymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (paymentStep !== 'processing') setPaymentModalVisible(false);
        }}
      >
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => {
            if (paymentStep !== 'processing') setPaymentModalVisible(false);
          }} />
          
          <View style={styles.modalContent}>
            {/* Header du Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Paiement Mobile Money</Text>
              {paymentStep !== 'processing' && paymentStep !== 'success' && (
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {paymentStep === 'form' && (
              <View>
                <View style={styles.paymentSummaryCard}>
                  <Text style={styles.paymentSummaryLabel}>Annonce</Text>
                  <Text style={styles.paymentSummaryTitle} numberOfLines={1}>{titre}</Text>
                  <View style={styles.costDivider} />
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Total à payer :</Text>
                    <Text style={styles.costValue}>500 FCFA</Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Numéro de téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 76 00 00 00"
                  keyboardType="numeric"
                  value={paymentPhone}
                  onChangeText={setPaymentPhone}
                  maxLength={8}
                />
                
                <TouchableOpacity 
                  style={[styles.ctaButton, { marginTop: SPACING.xl, backgroundColor: '#FF6600' }]} 
                  onPress={performPaymentAndUpload}
                  activeOpacity={0.8}
                >
                  <Ionicons name="lock-closed" size={20} color={COLORS.textInverse} />
                  <Text style={styles.ctaText}>Payer avec Orange Money</Text>
                </TouchableOpacity>
              </View>
            )}

            {paymentStep === 'processing' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.processingTitle}>Traitement en cours...</Text>
                <Text style={styles.processingText}>Communication avec Orange Money et upload de vos photos. Ne quittez pas cette page.</Text>
              </View>
            )}

            {paymentStep === 'success' && (
              <View style={styles.processingContainer}>
                <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
                <Text style={[styles.processingTitle, { color: COLORS.success }]}>Paiement Réussi !</Text>
                <Text style={styles.processingText}>Votre paiement de 500 FCFA a été validé. Votre annonce est maintenant en ligne.</Text>
              </View>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  sectionTitle: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.xl },
  sectionHint: { fontSize: FONTS.sm, color: COLORS.textMuted, marginBottom: SPACING.md },
  imageRow: { gap: SPACING.md, paddingVertical: SPACING.sm },
  imageAddButton: { width: 100, height: 100, borderRadius: RADIUS.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded, justifyContent: 'center', alignItems: 'center', gap: 4 },
  imageAddText: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: COLORS.primary },
  imagePreviewContainer: { position: 'relative' },
  imagePreview: { width: 100, height: 100, borderRadius: RADIUS.lg },
  imageRemoveButton: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.surface, borderRadius: 12 },
  mainPhotoBadge: { position: 'absolute', bottom: 4, left: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 2, borderRadius: 4, alignItems: 'center' },
  mainPhotoText: { fontSize: 9, fontWeight: FONTS.bold, color: '#fff', textTransform: 'uppercase' },
  input: { backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: 14, fontSize: FONTS.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.borderLight },
  textArea: { height: 120, paddingTop: 14 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.borderLight },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONTS.sm, fontWeight: FONTS.medium, color: COLORS.textSecondary },
  chipTextSelected: { color: COLORS.textInverse },
  priceInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight, paddingRight: SPACING.lg },
  priceInput: { flex: 1, paddingHorizontal: SPACING.lg, paddingVertical: 14, fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary },
  prixSuffix: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: COLORS.textMuted },
  costCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.xxl, ...SHADOWS.sm },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costLabel: { fontSize: FONTS.md, color: COLORS.textSecondary },
  costValue: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.primary },
  costDivider: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.md },
  costInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  costInfoText: { flex: 1, fontSize: FONTS.sm, color: COLORS.textMuted, lineHeight: 20 },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 34, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  ctaButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, gap: SPACING.sm, ...SHADOWS.colored },
  ctaButtonDisabled: { backgroundColor: COLORS.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: COLORS.textInverse },

  // Modal Styles
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, padding: SPACING.xl, paddingBottom: 60, ...SHADOWS.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary },
  paymentSummaryCard: { backgroundColor: COLORS.surfaceMuted, padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderLight },
  paymentSummaryLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  paymentSummaryTitle: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: COLORS.textPrimary },
  processingContainer: { paddingVertical: SPACING.xxl, alignItems: 'center', justifyContent: 'center' },
  processingTitle: { fontSize: FONTS.xl, fontWeight: FONTS.bold, color: COLORS.textPrimary, marginTop: SPACING.xl, marginBottom: SPACING.sm, textAlign: 'center' },
  processingText: { fontSize: FONTS.md, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: SPACING.lg },
});
