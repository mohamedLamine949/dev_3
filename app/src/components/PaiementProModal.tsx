import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface Customer {
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface Props {
  visible: boolean;
  amount: number;
  description: string;
  customer: Customer;
  /** Appelé quand le paiement est confirmé. Doit effectuer la mise à jour métier
   *  (ex: activation de l'abonnement). Si ça throw, le modal affiche une erreur. */
  onSuccess: () => void | Promise<void>;
  onClose: () => void;
  /** Titres personnalisables — par défaut ceux de l'abonnement PRO, pour ne
   *  rien changer aux appels existants. */
  title?: string;
  successTitle?: string;
  successText?: string;
}

type Step = 'init' | 'webview' | 'processing' | 'success' | 'error';

/**
 * Modal de paiement (PaiementPro). On NE force AUCUN channel : la passerelle
 * affiche alors la page avec tous les moyens disponibles (carte bancaire,
 * Orange Money Mali, OM Côte d'Ivoire, MTN, Moov…) et le client choisit.
 * Ainsi un utilisateur hors Mali n'est plus bloqué sur OM Mali.
 * Réutilisable : se charge de l'init, du WebView et de la détection de succès.
 * La logique métier post-paiement est déléguée à `onSuccess`.
 */
export default function PaiementProModal({
  visible, amount, description, customer, onSuccess, onClose,
  title = 'Abonnement', successTitle = 'Abonnement activé', successText = 'Votre abonnement est maintenant actif. Merci !',
}: Props) {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>('init');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [error, setError] = useState('');
  const processingRef = useRef(false);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (visible) {
      processingRef.current = false;
      setError('');
      setPaymentUrl('');
      initPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const initPayment = async () => {
    setStep('init');
    setError('');
    // Numéro transmis à titre informatif à la passerelle. On garde les chiffres
    // tels quels (sans tronquer aux 8 derniers, ce qui mutilait les numéros
    // internationaux) ; le client choisira son moyen de paiement sur la page.
    let finalPhone = '00000000';
    if (customer.phone) {
      const cleaned = customer.phone.replace(/[^0-9]/g, '');
      if (cleaned.length > 0) finalPhone = cleaned;
    }
    const refNum = `CC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const response = await fetch('https://www.paiementpro.net/webservice/onlinepayment/init/curl-init.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: 'PP-F92288',
          amount,
          description,
          referenceNumber: refNum,
          customerEmail: customer.email || 'client@app-flashmarket.com',
          customerFirstName: customer.firstName || 'Client',
          customerLastname: customer.lastName || 'Chap Chap',
          customerPhoneNumber: finalPhone,
          // Pas de `channel` : PaiementPro affiche tous les moyens de paiement
          // (carte, OM Mali, OM CI, MTN, Moov…) et le client choisit.
          notificationURL: 'https://app-flashmarket.com/payment/notify',
          returnURL: 'https://app-flashmarket.com/payment/success',
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Format de réponse invalide de la passerelle de paiement.');
      }

      if (data.success && data.url) {
        setPaymentUrl(data.url);
        setStep('webview');
      } else {
        throw new Error(data.message || "Impossible d'initialiser le paiement.");
      }
    } catch (e: any) {
      setError(e.message || "Une erreur est survenue lors de l'initialisation du paiement.");
      setStep('error');
    }
  };

  const confirmSuccess = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setStep('processing');
    try {
      await onSuccess();
      setStep('success');
      setTimeout(() => { onClose(); }, 2500);
    } catch (e: any) {
      setError(e.message || 'Le paiement a été validé mais la mise à jour a échoué. Contactez le support.');
      setStep('error');
    }
  };

  const onNavStateChange = (navState: any) => {
    const url = navState?.url || '';
    if (url.includes('responsecode=0')) {
      confirmSuccess();
    } else if (url.includes('responsecode=-1')) {
      if (processingRef.current) return;
      processingRef.current = true;
      setError('Le paiement a été annulé ou a échoué.');
      setStep('error');
    }
  };

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && data.status === 'success') confirmSuccess();
    } catch (e) {
      // ignore
    }
  };

  const canClose = step !== 'processing' && step !== 'init';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (canClose) onClose(); }}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step !== 'webview' && (
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => { if (canClose) onClose(); }} />
        )}

        <View style={[styles.content, step === 'webview' && { height: '90%', paddingBottom: 20 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 'webview' ? 'Paiement Mobile Money' : step === 'success' ? successTitle : title}
            </Text>
            {canClose && (
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {step === 'init' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.pTitle}>Initialisation du paiement...</Text>
              <Text style={styles.pText}>Connexion sécurisée à PaiementPro ({amount} FCFA). Veuillez patienter.</Text>
            </View>
          )}

          {step === 'webview' && paymentUrl ? (
            <View style={{ flex: 1, overflow: 'hidden', borderRadius: RADIUS.md }}>
              <WebView
                source={{ uri: paymentUrl }}
                onNavigationStateChange={onNavStateChange}
                onMessage={onMessage}
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
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                )}
              />
            </View>
          ) : null}

          {step === 'processing' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.pTitle}>Activation en cours...</Text>
              <Text style={styles.pText}>Validation de votre paiement. Ne quittez pas l'application.</Text>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.center}>
              <Ionicons name="checkmark-circle" size={80} color={theme.success} />
              <Text style={[styles.pTitle, { color: theme.success }]}>{successTitle} !</Text>
              <Text style={styles.pText}>{successText}</Text>
            </View>
          )}

          {step === 'error' && (
            <View style={styles.center}>
              <Ionicons name="alert-circle" size={80} color={theme.error} />
              <Text style={[styles.pTitle, { color: theme.error }]}>Échec de l'opération</Text>
              <Text style={styles.pText}>{error || "Le paiement n'a pas pu aboutir. Veuillez réessayer."}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={initPayment} activeOpacity={0.85}>
                <Text style={styles.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  content: { backgroundColor: theme.background, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, padding: SPACING.xl, paddingBottom: 60, ...SHADOWS.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  title: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  center: { paddingVertical: SPACING.xxl, alignItems: 'center', justifyContent: 'center' },
  pTitle: { fontSize: FONTS.xl, fontWeight: FONTS.bold, color: theme.textPrimary, marginTop: SPACING.xl, marginBottom: SPACING.sm, textAlign: 'center' },
  pText: { fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: SPACING.lg },
  retryBtn: { marginTop: SPACING.xl, width: '100%', height: 52, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  retryText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
