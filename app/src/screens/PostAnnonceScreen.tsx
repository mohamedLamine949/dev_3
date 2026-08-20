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
import { pickImages } from '../lib/imagePicker';
import { PLANS_CONFIG, COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORIES, SUBCATEGORIES, ETAT_ARTICLE, CATEGORY_PRICES } from '../constants/theme';
import { WebView } from 'react-native-webview';
import { createAnnonce } from '../hooks/useAnnonces';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useAppConfig } from '../hooks/useAppConfig';
import { getEffectivePlanKey } from '../lib/subscription';
import { useEntitlements } from '../hooks/useEntitlements';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { formatPrix } from '../lib/format';

const MAX_IMAGES = 10;

interface Props {
  navigation: any;
}

export default function PostAnnonceScreen({ navigation }: any) {
  const { session, user, refreshUser } = useAuth();
  const { location } = useLocation();
  const { theme, isDark } = useTheme();
  const { paymentsEnabled } = useAppConfig();
  // La tab bar flottante recouvre le bas de l'ecran : on remonte le CTA au-dessus.
  const tabBarSpace = useTabBarSpace();

  const [images, setImages] = useState<string[]>([]);
  const [titre, setTitre] = useState('');
  const [prix, setPrix] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSousCategorie, setSelectedSousCategorie] = useState<string | null>(null);
  const [selectedEtat, setSelectedEtat] = useState<string | null>(null);
  const [quartier, setQuartier] = useState('');

  const unitPrice = selectedCategory ? (CATEGORY_PRICES[selectedCategory] || 250) : 250;

  // Monthly Quota state
  const [monthlyCount, setMonthlyCount] = useState<number>(0);
  const [checkingQuota, setCheckingQuota] = useState(false);

  // Payment & Subscription Modal State
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentType, setPaymentType] = useState<'unit_ad' | 'subscription_vendeur' | 'subscription_pro'>('unit_ad');
  const [paymentAmount, setPaymentAmount] = useState(unitPrice);
  const [paymentStep, setPaymentStep] = useState<'quota_choice' | 'init_payment' | 'webview' | 'processing' | 'success' | 'error'>('quota_choice');
  const [transactionId, setTransactionId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isFreePublish, setIsFreePublish] = useState(false); // publication gratuite (paiement désactivé)
  const isProcessingRef = React.useRef(false);

  // User current plan definition — plan EFFECTIF : un abonnement expiré (J+30)
  // retombe automatiquement sur 'particulier' → le paywall se réaffiche.
  const currentPlanKey = getEffectivePlanKey(user);
  const currentPlan = PLANS_CONFIG[currentPlanKey as keyof typeof PLANS_CONFIG] || PLANS_CONFIG.particulier;

  // Droits effectifs — le serveur decide, l'ecran affiche (§11.3). Tant que la
  // migration de phase 1 n'est pas appliquee, `ent` retombe automatiquement sur
  // le calcul local ci-dessus : comportement strictement identique.
  const { entitlements: ent, refresh: refreshDroits } = useEntitlements(user, monthlyCount, paymentsEnabled);
  const quotaLabel = ent.creditsMensuels === null ? 'illimite' : String(ent.creditsMensuels);
  const planLabel = ent.planCode === 'pro' ? 'Flash Pro'
                  : ent.planCode === 'vendeur' ? 'Flash Vendeur'
                  : currentPlan.nom;

  // Pre-fill phone from user profile & check monthly posts count
  useEffect(() => {
    const rawPhone = user?.telephone || user?.num_telephone;
    if (rawPhone) {
      const cleaned = rawPhone.replace(/[^0-9]/g, '');
      const last8 = cleaned.length >= 8 ? cleaned.substring(cleaned.length - 8) : cleaned;
      setPaymentPhone(last8);
    } else {
      setPaymentPhone('00000000');
    }
  }, [user]);

  // Fetch monthly posts count whenever screen or session changes
  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchQuota = async () => {
      setCheckingQuota(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count, error } = await supabase
        .from('annonces')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .gte('date_creation', startOfMonth);
      
      if (!error && count !== null) {
        setMonthlyCount(count);
      }
      setCheckingQuota(false);
    };
    fetchQuota();
  }, [session?.user?.id]);

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

    const assets = await pickImages({
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
    });

    if (assets) {
      const newImages = assets.map((a) => a.uri);
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
    setSelectedSousCategorie(null);
    setSelectedEtat(null);
    setQuartier('');
  };

  // Direct free publication helper
  const publishAnnonceDirectly = async (montantDepot = 0, transactionRef = 'FREE_QUOTA') => {
    setPaymentModalVisible(true);
    setPaymentStep('processing');

    const annonceData = {
      titre,
      description: description || null,
      prix: parseInt(prix, 10),
      categorie: selectedCategory!,
      sous_categorie: selectedSousCategorie,
      etat_article: selectedEtat || 'non_specifie',
      ville: location?.ville || 'Mali',
      quartier: quartier || null,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      est_payee: true,
      statut: 'active',
      id_transaction_paiement: transactionRef,
      montant_depot: montantDepot,
      user_id: session?.user?.id,
    };

    const { error } = await createAnnonce(annonceData as any, images);

    if (error) {
      console.error(error);
      setPaymentError("La publication a échoué. " + error);
      setPaymentStep('error');
      return;
    }

    setPaymentStep('success');
    
    setTimeout(() => {
      setPaymentModalVisible(false);
      resetForm();
      navigation.navigate('Accueil');
    }, 2500);
  };

  // Initiate Mobile Money payment flow (Unit Ad, Vendeur or PRO subscription)
  const performPaymentAndUpload = async (type: 'unit_ad' | 'subscription_vendeur' | 'subscription_pro', amount: number) => {
    isProcessingRef.current = false;
    setPaymentType(type);
    setPaymentAmount(amount);
    setPaymentStep('init_payment');
    setPaymentError('');

    const rawPhone = user?.telephone || user?.num_telephone;
    let finalPhone = '00000000';
    if (rawPhone) {
      const cleaned = rawPhone.replace(/[^0-9]/g, '');
      finalPhone = cleaned.length >= 8 ? cleaned.substring(cleaned.length - 8) : cleaned;
    }

    const refNum = `CC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setTransactionId(refNum);

    const payDesc = type === 'subscription_pro'
      ? 'Chap Chap - Abonnement PRO / Boutique (annonces illimitees)'
      : type === 'subscription_vendeur'
      ? 'Chap Chap - Abonnement Vendeur (30 annonces/mois)'
      : `Chap Chap - Publication annonce: ${titre.substring(0, 40)}`;

    try {
      const response = await fetch('https://www.paiementpro.net/webservice/onlinepayment/init/curl-init.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: 'PP-F92288',
          amount: amount,
          description: payDesc,
          referenceNumber: refNum,
          customerEmail: session?.user?.email || 'client@app-flashmarket.com',
          customerFirstName: user?.prenom || 'Client',
          customerLastname: user?.nom || 'Chap Chap',
          customerPhoneNumber: finalPhone,
          channel: 'OMML',
          notificationURL: 'https://app-flashmarket.com/payment/notify',
          returnURL: 'https://app-flashmarket.com/payment/success',
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

  const handlePreSubmit = () => {
    if (!session?.user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour publier une annonce.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => navigation.navigate('Login') }
      ]);
      return;
    }

    if (!titre || !prix || !selectedCategory || !selectedSousCategorie || images.length === 0) {
      Alert.alert('Champs manquants', 'Titre, prix, catégorie, sous-catégorie et au moins une photo sont requis.');
      return;
    }

    // La decision vient du serveur. En FREE_LAUNCH et SHADOW, `blocageActif`
    // est faux : on publie sans quota, comme aujourd'hui. En SOFT_PAYWALL,
    // l'offre s'affiche mais la publication reste autorisee (§11.1) ; seul
    // LIVE refuse effectivement.
    if (!ent.blocageActif) {
      publishFree();
      return;
    }

    const illimite = ent.creditsMensuels === null;

    if (ent.peutPublier) {
      if (!illimite) setMonthlyCount((c) => c + 1); // maj optimiste du compteur mensuel
      publishAnnonceDirectly(0, illimite ? 'PLAN_PRO' : `QUOTA_${ent.planCode.toUpperCase()}`);
    } else {
      // Quota exceeded! Show subscription options modal
      isProcessingRef.current = false;
      setPaymentError('');
      setPaymentStep('quota_choice');
      setPaymentModalVisible(true);
    }
  };

  // Publication gratuite : crée l'annonce sans passer par le paiement.
  const publishFree = async () => {
    setIsFreePublish(true);
    setPaymentError('');
    setPaymentStep('processing');
    setPaymentModalVisible(true);

    const annonceData = {
      titre,
      description: description || null,
      prix: parseInt(prix, 10),
      categorie: selectedCategory!,
      sous_categorie: selectedSousCategorie,
      etat_article: selectedEtat || 'non_specifie',
      ville: location?.ville || 'Mali',
      quartier: quartier || null,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      est_payee: true,
      statut: 'active',
      id_transaction_paiement: null,
      montant_depot: 0,
      user_id: session?.user?.id,
    };

    const { error } = await createAnnonce(annonceData as any, images);

    if (error) {
      console.error(error);
      setPaymentError('La publication a échoué. ' + error);
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

  const handlePaymentSuccess = async () => {
    setPaymentStep('processing');

    // If subscription payment, update user profile first
    if (paymentType === 'subscription_vendeur' || paymentType === 'subscription_pro') {
      try {
        await supabase
          .from('users')
          .update({
            type_compte: paymentType === 'subscription_pro' ? 'professionnel' : 'vendeur',
            date_abonnement: new Date().toISOString(),
          })
          .eq('id', session.user.id);
        await refreshUser();
      } catch (e) {
        console.error("Error updating subscription status:", e);
      }
    }

    // Publish advertisement
    const annonceData = {
      titre,
      description: description || null,
      prix: parseInt(prix, 10),
      categorie: selectedCategory!,
      sous_categorie: selectedSousCategorie,
      etat_article: selectedEtat || 'non_specifie',
      ville: location?.ville || 'Mali',
      quartier: quartier || null,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      est_payee: true,
      statut: 'active',
      id_transaction_paiement: transactionId,
      montant_depot: paymentAmount,
      user_id: session?.user?.id,
    };

    const { error } = await createAnnonce(annonceData as any, images);

    if (error) {
      console.error(error);
      setPaymentError("Le paiement a été validé avec succès, mais la publication de l'annonce a échoué. " + error);
      setPaymentStep('error');
      return;
    }

    setPaymentStep('success');
    
    setTimeout(() => {
      setPaymentModalVisible(false);
      resetForm();
      navigation.navigate('Accueil');
    }, 2500);
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

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView Message received:', data);
      if (data && data.status === 'success') {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        handlePaymentSuccess();
      }
    } catch (e) {
      console.warn("Failed to parse message from WebView:", e);
    }
  };

  const isFormValid = titre && prix && selectedCategory && selectedSousCategorie && images.length > 0;


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

          {/* Sous-catégorie (obligatoire, dépend de la catégorie choisie) */}
          {selectedCategory && SUBCATEGORIES[selectedCategory]?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Sous-catégorie *</Text>
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

          {/* Coût & Quota Info */}
          {!ent.paywallVisible ? (
            <View style={styles.costCard}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Frais de publication</Text>
                <Text style={styles.costValue}>Gratuit</Text>
              </View>
              <View style={styles.costDivider} />
              <View style={styles.costInfo}>
                <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                <Text style={styles.costInfoText}>
                  Publication gratuite et illimitée pendant la période de lancement.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.costCard}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Formule actuelle</Text>
                <Text style={[styles.costValue, { fontSize: FONTS.md }]}>{planLabel}</Text>
              </View>
              <View style={styles.costDivider} />
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Frais de dépôt cette annonce</Text>
                <Text style={styles.costValue}>
                  {ent.creditsMensuels === null
                    ? '0 FCFA (illimité avec Flash Pro)'
                    : ent.peutPublier
                      ? '0 FCFA (inclus dans vos crédits)'
                      : formatPrix(unitPrice)}
                </Text>
              </View>
              <View style={styles.costDivider} />
              <View style={styles.costInfo}>
                <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                <Text style={styles.costInfoText}>
                  {ent.creditsMensuels === null
                    ? 'Avec Flash Pro, toutes vos publications sont incluses.'
                    : `Vous avez publié ${ent.creditsUtilises} annonce${ent.creditsUtilises > 1 ? 's' : ''} sur ${quotaLabel} ce mois-ci. Vos crédits se remettent à zéro le 1er du mois.`}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: tabBarSpace + 90 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: tabBarSpace }]}>
        <TouchableOpacity
          style={[styles.ctaButton, !isFormValid && styles.ctaButtonDisabled]}
          onPress={handlePreSubmit}
          disabled={!isFormValid}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={20} color={theme.textInverse} />
          <Text style={styles.ctaText}>
            {/* §7.5 : le bouton annonce « gratuitement » ou le prix exact,
                jamais un libelle vague avant l'ouverture du paiement. */}
            {!ent.blocageActif
              ? 'Publier gratuitement'
              : ent.creditsMensuels === null
              ? 'Publier gratuitement'
              : ent.peutPublier
              ? `Publier (1 crédit sur ${ent.creditsRestants} restants)`
              : `Publier — ${formatPrix(unitPrice)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* PAYMENT & SUBSCRIPTION MODAL */}
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
                {paymentStep === 'quota_choice' ? 'Quota mensuel atteint' : paymentStep === 'webview' ? 'Portail de Paiement Mobile Money' : 'Publication & Paiement'}
              </Text>
              {(paymentStep !== 'processing' && paymentStep !== 'init_payment') && (
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* STEP: Quota Exceeded Choice Modal */}
            {paymentStep === 'quota_choice' && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                <Text style={{ fontSize: FONTS.sm, color: theme.textSecondary, marginBottom: SPACING.lg, lineHeight: 20 }}>
                  Vous avez utilisé vos {quotaLabel} crédits de publication ce mois-ci ({ent.creditsUtilises}/{quotaLabel}). Choisissez une formule pour publier votre annonce :
                </Text>

                {/* Option PRO 5000 FCFA (Recommandée) */}
                <View style={{ backgroundColor: theme.primaryFaded, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 2, borderColor: theme.primary, marginBottom: SPACING.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.primary }}>
                      🌟 Plan PRO / Boutique
                    </Text>
                    <View style={{ backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: FONTS.bold, color: '#fff' }}>RECOMMANDE</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: theme.primary, marginBottom: 6 }}>
                    5 000 FCFA <Text style={{ fontSize: FONTS.xs, fontWeight: 'normal', color: theme.textSecondary }}>/ mois</Text>
                  </Text>
                  <Text style={{ fontSize: FONTS.xs, color: theme.textSecondary, marginBottom: SPACING.md, lineHeight: 18 }}>
                    • Annonces illimitées & permanentes (n'expirent jamais){'\n'}
                    • Vitrine professionnelle & badge Pro{'\n'}
                    • Visibilité maximale dans la recherche
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: theme.primary, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' }}
                    onPress={() => performPaymentAndUpload('subscription_pro', 5000)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' }}>
                      S'abonner PRO (5 000 FCFA)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Option Vendeur 2000 FCFA */}
                <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: theme.borderLight, marginBottom: SPACING.md }}>
                  <Text style={{ fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: 4 }}>
                    💼 Plan Vendeur
                  </Text>
                  <Text style={{ fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: 6 }}>
                    2 000 FCFA <Text style={{ fontSize: FONTS.xs, fontWeight: 'normal', color: theme.textMuted }}>/ mois</Text>
                  </Text>
                  <Text style={{ fontSize: FONTS.xs, color: theme.textSecondary, marginBottom: SPACING.md }}>
                    30 annonces par mois + Statistiques de vues
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.primary, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' }}
                    onPress={() => performPaymentAndUpload('subscription_vendeur', 2000)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary }}>
                      S'abonner Vendeur (2 000 FCFA)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Option Unité {unitPrice} FCFA */}
                <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: theme.borderLight, marginBottom: SPACING.lg }}>
                  <Text style={{ fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: 4 }}>
                    🏷️ Paiement à l'unité
                  </Text>
                  <Text style={{ fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: 6 }}>
                    {formatPrix(unitPrice)}
                  </Text>
                  <Text style={{ fontSize: FONTS.xs, color: theme.textSecondary, marginBottom: SPACING.md }}>
                    Publier uniquement cette annonce sans abonnement
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderLight, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' }}
                    onPress={() => performPaymentAndUpload('unit_ad', unitPrice)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary }}>
                      Payer {formatPrix(unitPrice)} via Mobile Money
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {paymentStep === 'init_payment' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.processingTitle}>Initialisation du paiement...</Text>
                <Text style={styles.processingText}>Connexion sécurisée à PaiementPro en cours ({paymentAmount} FCFA). Veuillez patienter.</Text>
              </View>
            )}

            {paymentStep === 'webview' && paymentUrl ? (
              <View style={{ flex: 1, overflow: 'hidden', borderRadius: RADIUS.md }}>
                <WebView
                  source={{ uri: paymentUrl }}
                  onNavigationStateChange={handleNavigationStateChange}
                  onMessage={handleMessage}
                  injectedJavaScript={`
                    (function() {
                      function checkPayment() {
                        var bodyText = document.body ? document.body.innerText : '';
                        var clean = bodyText.toLowerCase();
                        if (clean.normalize) {
                          clean = clean.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
                        }
                        if (
                          clean.indexOf('votre paiement est confirme') !== -1 ||
                          clean.indexOf('paiement reussi') !== -1 ||
                          clean.indexOf('paiement effectue') !== -1
                        ) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success' }));
                        }
                      }
                      setInterval(checkPayment, 1000);
                      checkPayment();
                    })();
                    true;
                  `}
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
                <Text style={styles.processingText}>Validation de votre demande et mise en ligne de votre annonce. Ne quittez pas l'application.</Text>
              </View>
            )}

            {paymentStep === 'success' && (
              <View style={styles.processingContainer}>
                <Ionicons name="checkmark-circle" size={80} color={theme.success} />
                <Text style={[styles.processingTitle, { color: theme.success }]}>Annonce Publiée !</Text>
                <Text style={styles.processingText}>
                  {paymentType === 'subscription_pro'
                    ? "Félicitations ! Votre abonnement PRO est actif : annonces illimitées, vitrine boutique et badge Pro."
                    : paymentType === 'subscription_vendeur'
                    ? "Félicitations ! Votre abonnement Vendeur est actif et votre annonce est en ligne !"
                    : "Votre annonce est maintenant en ligne et visible par tous les acheteurs."}
                </Text>
              </View>
            )}

            {paymentStep === 'error' && (
              <View style={styles.processingContainer}>
                <Ionicons name="alert-circle" size={80} color={theme.error} />
                <Text style={[styles.processingTitle, { color: theme.error }]}>Échec de l'opération</Text>
                <Text style={styles.processingText}>
                  {paymentError || "Le paiement ou la publication n'a pas pu être validé. Veuillez réessayer."}
                </Text>
                <TouchableOpacity
                  style={[styles.ctaButton, { marginTop: SPACING.xl, width: '100%' }]}
                  onPress={() => setPaymentStep('quota_choice')}
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
  // `paddingBottom` est surcharge a l'usage : le fond descend jusqu'au bord de
  // l'ecran mais le bouton remonte au-dessus de la tab bar flottante.
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.lg, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.borderLight },
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
