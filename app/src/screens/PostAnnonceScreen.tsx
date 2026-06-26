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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES, ETAT_ARTICLE, CATEGORY_PRICES } from '../constants/theme';
import { WebView } from 'react-native-webview';
import { createAnnonce } from '../hooks/useAnnonces';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';

const MAX_IMAGES = 5;

interface Props {
  navigation: any;
}

export default function PostAnnonceScreen({ navigation }: any) {
  const { session, user } = useAuth();
  const { location } = useLocation();
  const { theme, isDark } = useTheme();

  const [images, setImages] = useState<string[]>([]);
  const [titre, setTitre] = useState('');
  const [prix, setPrix] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEtat, setSelectedEtat] = useState<string | null>(null);
  const [quartier, setQuartier] = useState('');

  const price = selectedCategory ? (CATEGORY_PRICES[selectedCategory] || 250) : 250;

  // Payment Modal State
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentStep, setPaymentStep] = useState<'form' | 'init_payment' | 'webview' | 'processing' | 'success' | 'error'>('form');
  const [transactionId, setTransactionId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const isProcessingRef = React.useRef(false);

  // Pre-fill phone from user profile
  useEffect(() => {
    if (user?.telephone) {
      const cleaned = user.telephone.replace(/[^0-9]/g, '');
      const last8 = cleaned.length >= 8 ? cleaned.substring(cleaned.length - 8) : cleaned;
      setPaymentPhone(last8);
    }
  }, [user]);

  // Auto-fill ville/quartier from GPS when location becomes available
  useEffect(() => {
    if (location?.quartier) setQuartier(location.quartier);
  }, [location]);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // Gate doux — afficher un écran d'invitation si non connecté
  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <Text style={{ fontSize: 56, marginBottom: SPACING.xl }}>📢</Text>
        <Text style={{ fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary, textAlign: 'center', marginBottom: SPACING.md }}>
          Publiez votre annonce
        </Text>
        <Text style={{ fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xxxl }}>
          Créez un compte gratuit et publiez votre première annonce en quelques minutes.
        </Text>
        <TouchableOpacity
          style={{ width: '100%', height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' }}>Se connecter / S'inscrire</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: FONTS.xs, color: theme.textMuted, marginTop: SPACING.xl, textAlign: 'center' }}>
          La navigation et le contact vendeur sont gratuits sans compte.
        </Text>
      </View>
    );
  }

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
    setQuartier('');
  };

  const handlePreSubmit = () => {
    if (!session?.user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour publier une annonce.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => navigation.navigate('Login') }
      ]);
      return;
    }

    if (!titre || !prix || !selectedCategory || images.length === 0) {
      Alert.alert('Champs manquants', 'Titre, prix, catégorie et au moins une photo sont requis.');
      return;
    }
    isProcessingRef.current = false;
    setPaymentError('');
    setPaymentStep('form');
    setPaymentModalVisible(true);
  };

  const performPaymentAndUpload = async () => {
    if (paymentPhone.length < 8) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro valide de 8 chiffres.');
      return;
    }

    setPaymentStep('init_payment');
    setPaymentError('');

    const refNum = `CC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setTransactionId(refNum);

    try {
      const response = await fetch('https://www.paiementpro.net/webservice/onlinepayment/init/curl-init.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: 'PP-F92288',
          amount: price,
          description: `Chap Chap - Publication annonce: ${titre.substring(0, 50)}`,
          referenceNumber: refNum,
          customerEmail: session?.user?.email || 'client@chapchap.ml',
          customerFirstName: user?.prenom || 'Client',
          customerLastname: user?.nom || 'Chap Chap',
          customerPhoneNumber: paymentPhone,
          notificationURL: 'https://chapchap.ml/payment/notify',
          returnURL: 'https://chapchap.ml/payment/success',
        }),
      });

      const text = await response.text();
      console.log('Paiement Pro Response Text:', text);
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Format de réponse invalide de la part de la passerelle de paiement.");
      }

      if (data.success && data.url) {
        setPaymentUrl(data.url);
        setPaymentStep('webview');
      } else {
        throw new Error(data.message || "Impossible d'initialiser le paiement.");
      }
    } catch (error: any) {
      console.error("Erreur d'initialisation du paiement:", error);
      setPaymentError(error.message || "Une erreur est survenue lors de l'initialisation du paiement.");
      setPaymentStep('error');
    }
  };

  const handlePaymentSuccess = async () => {
    setPaymentStep('processing');

    const annonceData = {
      titre,
      description: description || null,
      prix: parseInt(prix, 10),
      categorie: selectedCategory!,
      etat_article: selectedEtat || 'non_specifie',
      ville: location?.ville || 'Mali',
      quartier: quartier || null,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      est_payee: true,
      statut: 'active',
      id_transaction_paiement: transactionId,
      user_id: session?.user?.id,
    };

    const { error } = await createAnnonce(annonceData as any, images);

    if (error) {
      console.error(error);
      setPaymentError("L'annonce a été payée avec succès, mais la publication a échoué. " + error);
      setPaymentStep('error');
      return;
    }

    setPaymentStep('success');
    
    setTimeout(() => {
      setPaymentModalVisible(false);
      resetForm();
      navigation.navigate('Accueil');
    }, 3000);
  };

  const handlePaymentFailure = (message: string) => {
    isProcessingRef.current = false;
    setPaymentError(message);
    setPaymentStep('error');
  };

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;
    console.log('WebView Navigation State Change:', url);

    if (url.includes('responsecode=0')) {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      handlePaymentSuccess();
    } else if (url.includes('responsecode=-1')) {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      handlePaymentFailure("Le paiement a été annulé ou a échoué.");
    }
  };

  const isFormValid = titre && prix && selectedCategory && images.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="close" size={26} color={theme.textPrimary} />
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
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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

          {/* Quartier (optionnel, auto-rempli GPS) */}
          <Text style={styles.sectionTitle}>
            Quartier / Zone{location ? ' 📍' : ''} <Text style={styles.optionalLabel}>(facultatif)</Text>
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

          {/* Coût */}
          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Frais de publication</Text>
              <Text style={styles.costValue}>{price} FCFA</Text>
            </View>
            <View style={styles.costDivider} />
            <View style={styles.costInfo}>
              <Ionicons name="information-circle-outline" size={16} color={theme.textMuted} />
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
          <Ionicons name="flash" size={20} color={theme.textInverse} />
          <Text style={styles.ctaText}>Publier pour {price} FCFA</Text>
        </TouchableOpacity>
      </View>

      {/* REAL PAYMENT MODAL */}
      <Modal
        visible={isPaymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (paymentStep !== 'processing' && paymentStep !== 'init_payment') setPaymentModalVisible(false);
        }}
      >
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {paymentStep !== 'webview' && (
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => {
              if (paymentStep !== 'processing' && paymentStep !== 'init_payment') setPaymentModalVisible(false);
            }} />
          )}
          
          <View style={[
            styles.modalContent,
            paymentStep === 'webview' && { height: '90%', borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, paddingBottom: 20 }
          ]}>
            {/* Header du Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {paymentStep === 'webview' ? 'Portail de Paiement' : 'Paiement Mobile Money'}
              </Text>
              {(paymentStep !== 'processing' && paymentStep !== 'init_payment') && (
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={theme.textMuted} />
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
                    <Text style={styles.costValue}>{price} FCFA</Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Numéro de téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 76 00 00 00"
                  placeholderTextColor={theme.textMuted}
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
                  <Ionicons name="lock-closed" size={20} color={theme.textInverse} />
                  <Text style={styles.ctaText}>Payer avec Orange Money</Text>
                </TouchableOpacity>
              </View>
            )}

            {paymentStep === 'init_payment' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.processingTitle}>Initialisation du paiement...</Text>
                <Text style={styles.processingText}>Connexion sécurisée avec la passerelle de paiement en cours. Veuillez patienter.</Text>
              </View>
            )}

            {paymentStep === 'webview' && paymentUrl ? (
              <View style={{ flex: 1, overflow: 'hidden', borderRadius: RADIUS.md }}>
                <WebView
                  source={{ uri: paymentUrl }}
                  onNavigationStateChange={handleNavigationStateChange}
                  style={{ flex: 1 }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
                      <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                  )}
                />
              </View>
            ) : null}

            {paymentStep === 'processing' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.processingTitle}>Publication en cours...</Text>
                <Text style={styles.processingText}>Validation de votre paiement et mise en ligne de votre annonce. Ne quittez pas l'application.</Text>
              </View>
            )}

            {paymentStep === 'success' && (
              <View style={styles.processingContainer}>
                <Ionicons name="checkmark-circle" size={80} color={theme.success} />
                <Text style={[styles.processingTitle, { color: theme.success }]}>Paiement Réussi !</Text>
                <Text style={styles.processingText}>Votre paiement de {price} FCFA a été validé. Votre annonce est maintenant en ligne.</Text>
              </View>
            )}

            {paymentStep === 'error' && (
              <View style={styles.processingContainer}>
                <Ionicons name="alert-circle" size={80} color={theme.error} />
                <Text style={[styles.processingTitle, { color: theme.error }]}>Échec du paiement</Text>
                <Text style={styles.processingText}>
                  {paymentError || "Le paiement n'a pas pu être validé. Veuillez réessayer."}
                </Text>
                <TouchableOpacity
                  style={[styles.ctaButton, { marginTop: SPACING.xl, width: '100%' }]}
                  onPress={() => setPaymentStep('form')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ctaText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  costCard: { backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.xxl, ...SHADOWS.sm },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costLabel: { fontSize: FONTS.md, color: theme.textSecondary },
  costValue: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.primary },
  costDivider: { height: 1, backgroundColor: theme.borderLight, marginVertical: SPACING.md },
  costInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  costInfoText: { flex: 1, fontSize: FONTS.sm, color: theme.textMuted, lineHeight: 20 },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: Platform.OS === 'ios' ? 34 : 14, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.borderLight },
  ctaButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, backgroundColor: theme.primary, borderRadius: RADIUS.lg, gap: SPACING.sm, ...SHADOWS.colored },
  ctaButtonDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textInverse },

  // Modal Styles
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: theme.background, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, padding: SPACING.xl, paddingBottom: 60, ...SHADOWS.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  paymentSummaryCard: { backgroundColor: theme.surfaceMuted, padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.lg, borderWidth: 1, borderColor: theme.borderLight },
  paymentSummaryLabel: { fontSize: FONTS.xs, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  paymentSummaryTitle: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary },
  processingContainer: { paddingVertical: SPACING.xxl, alignItems: 'center', justifyContent: 'center' },
  processingTitle: { fontSize: FONTS.xl, fontWeight: FONTS.bold, color: theme.textPrimary, marginTop: SPACING.xl, marginBottom: SPACING.sm, textAlign: 'center' },
  processingText: { fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: SPACING.lg },
});
