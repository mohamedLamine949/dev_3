import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, Alert, ActivityIndicator, Image, Platform,
  KeyboardAvoidingView, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import {
  signInWithGoogle,
  signInWithApple,
  isAppleAuthSupported,
  sendEmailOtp,
  verifyEmailOtp,
  UserCancelledError,
} from '../lib/socialAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Validation stricte du format e-mail (rejette les saisies fantaisistes)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | 'email' | null>(null);

  // Flux e-mail OTP : 'choice' (boutons) -> 'email' (saisie adresse) -> 'code'
  const [step, setStep] = useState<'choice' | 'email' | 'code'>('choice');
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');

  // Animations d'entrée
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 6 }),
      Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
    ]).start();
  }, []);

  // Re-animate on step change
  const contentFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    contentFade.setValue(0);
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [step]);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // Après connexion : router vers la complétion de profil si le téléphone
  // de contact manque, sinon directement dans l'app.
  async function routeAfterSignIn(userId: string, prefillName?: string) {
    const { data } = await supabase
      .from('users')
      .select('telephone, prenom')
      .eq('id', userId)
      .maybeSingle();

    const needsCompletion = !data?.telephone || !data?.prenom;
    if (needsCompletion) {
      navigation.reset({ index: 0, routes: [{ name: 'CompleteProfile', params: { prefillName } }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Compte' } }] });
    }
  }

  async function handleGoogle() {
    setLoadingProvider('google');
    try {
      const data = await signInWithGoogle();
      if (data?.user) await routeAfterSignIn(data.user.id);
    } catch (err: any) {
      if (!(err instanceof UserCancelledError)) {
        console.error(err);
        Alert.alert('Connexion impossible', err.message || 'Réessayez dans un instant.');
      }
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleApple() {
    setLoadingProvider('apple');
    try {
      const { data, appleFullName } = await signInWithApple();
      if (data?.user) await routeAfterSignIn(data.user.id, appleFullName);
    } catch (err: any) {
      if (!(err instanceof UserCancelledError)) {
        console.error(err);
        Alert.alert('Connexion impossible', err.message || 'Réessayez dans un instant.');
      }
    } finally {
      setLoadingProvider(null);
    }
  }

  const trimmedEmail = email.trim();
  const isEmailValid = EMAIL_REGEX.test(trimmedEmail);

  async function handleSendCode() {
    if (!isEmailValid) return;
    setLoadingProvider('email');
    try {
      await sendEmailOtp(trimmedEmail);
      setPendingEmail(trimmedEmail.toLowerCase());
      setCode('');
      setStep('code');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || "Impossible d'envoyer le code. Réessayez.");
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleVerifyCode() {
    if (code.length < 6) return;
    setLoadingProvider('email');
    try {
      const data = await verifyEmailOtp(pendingEmail, code);
      if (data?.user) await routeAfterSignIn(data.user.id);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Code refusé', err.message || 'Code incorrect ou expiré. Réessayez.');
    } finally {
      setLoadingProvider(null);
    }
  }

  const busy = loadingProvider !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      {/* Header avec gradient simulé */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        {navigation.canGoBack() && step === 'choice' && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
        </Animated.View>
        <Text style={styles.appName}>Flash Market</Text>
        <Text style={styles.tagline}>Achetez & Vendez en toute confiance</Text>
      </Animated.View>

      {/* Card content */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: contentFade }}>
            {step === 'choice' ? (
              <>
                <View style={{ marginBottom: SPACING.xl, alignItems: 'center' }}>
                  <Text style={styles.title}>Bienvenue</Text>
                  <Text style={styles.subtitle}>Connectez-vous ou créez un compte en un instant</Text>
                </View>

                {/* Google */}
                <TouchableOpacity
                  style={[styles.socialBtn, styles.googleBtn]}
                  onPress={handleGoogle}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  {loadingProvider === 'google' ? (
                    <ActivityIndicator color="#1F1F1F" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={20} color="#4285F4" style={{ marginRight: 10 }} />
                      <Text style={styles.googleBtnText}>Continuer avec Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Apple (iOS uniquement) */}
                {isAppleAuthSupported && (
                  <TouchableOpacity
                    style={[styles.socialBtn, styles.appleBtn]}
                    onPress={handleApple}
                    disabled={busy}
                    activeOpacity={0.85}
                  >
                    {loadingProvider === 'apple' ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={20} color="#fff" style={{ marginRight: 10 }} />
                        <Text style={styles.appleBtnText}>Continuer avec Apple</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Séparateur */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* E-mail */}
                <TouchableOpacity
                  style={[styles.socialBtn, styles.emailBtn]}
                  onPress={() => setStep('email')}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mail-outline" size={20} color={theme.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.emailBtnText, { color: theme.primary }]}>Continuer avec un e-mail</Text>
                </TouchableOpacity>

                <Text style={styles.consentText}>
                  En continuant, vous acceptez nos{' '}
                  <Text style={styles.consentLink} onPress={() => navigation.navigate('Legal', { type: 'cgu' })}>
                    CGU
                  </Text>
                  ,{' '}
                  <Text style={styles.consentLink} onPress={() => navigation.navigate('Legal', { type: 'cgv' })}>
                    CGV
                  </Text>{' '}
                  et notre{' '}
                  <Text style={styles.consentLink} onPress={() => navigation.navigate('Legal', { type: 'privacy' })}>
                    politique de confidentialité
                  </Text>
                  .
                </Text>

                <Text style={styles.footerCopyright}>© 2026 Flash Market. Tous droits réservés.</Text>
              </>
            ) : step === 'email' ? (
              <>
                <View style={{ marginBottom: SPACING.xl, alignItems: 'center' }}>
                  <View style={styles.stepIconCircle}>
                    <Ionicons name="mail" size={28} color={theme.primary} />
                  </View>
                  <Text style={styles.title}>Votre e-mail</Text>
                  <Text style={styles.subtitle}>Nous vous enverrons un code à 6 chiffres pour vous connecter.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Adresse e-mail</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="mail-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="exemple@gmail.com"
                      placeholderTextColor={theme.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.ctaBtn, !isEmailValid && styles.ctaBtnDisabled]}
                  onPress={handleSendCode}
                  disabled={!isEmailValid || busy}
                  activeOpacity={0.85}
                >
                  {loadingProvider === 'email' ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Recevoir le code</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={() => setStep('choice')} disabled={busy}>
                  <Ionicons name="arrow-back" size={16} color={theme.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.backLinkText}>Autres méthodes de connexion</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ marginBottom: SPACING.xl, alignItems: 'center' }}>
                  <View style={styles.stepIconCircle}>
                    <Ionicons name="key" size={28} color={theme.primary} />
                  </View>
                  <Text style={styles.title}>Code de vérification</Text>
                  <Text style={styles.subtitle}>Un code à 6 chiffres a été envoyé à {pendingEmail}.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Code reçu par e-mail</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="key-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="123456"
                      placeholderTextColor={theme.textMuted}
                      value={code}
                      onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 10))}
                      keyboardType="number-pad"
                      maxLength={10}
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.ctaBtn, code.length < 6 && styles.ctaBtnDisabled]}
                  onPress={handleVerifyCode}
                  disabled={code.length < 6 || busy}
                  activeOpacity={0.85}
                >
                  {loadingProvider === 'email' ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Se connecter</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={handleSendCode} disabled={busy}>
                  <Text style={[styles.backLinkText, { color: theme.primary }]}>Renvoyer le code</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backLink} onPress={() => { setStep('email'); setCode(''); }} disabled={busy}>
                  <Ionicons name="arrow-back" size={16} color={theme.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.backLinkText}>Modifier l'adresse</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.primary },
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: SPACING.xxxl,
  },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 70 : 50, left: SPACING.lg,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoContainer: {
    width: 84, height: 84, borderRadius: 42, overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
    ...SHADOWS.lg,
  },
  logoImage: { width: 84, height: 84 },
  appName: {
    ...TYPOGRAPHY.display,
    fontSize: 30,
    color: '#fff',
  },
  tagline: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  cardWrapper: { flex: 1 },
  card: {
    flex: 1, backgroundColor: theme.background,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
  },
  cardContent: { padding: SPACING.xxl, paddingBottom: 40, gap: SPACING.lg },
  title: {
    ...TYPOGRAPHY.h2,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sm, color: theme.textMuted, textAlign: 'center',
    marginTop: 6, paddingHorizontal: SPACING.md, lineHeight: 20,
  },

  // Step icon circle
  stepIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg,
  },

  // Social buttons
  socialBtn: {
    height: 56, borderRadius: RADIUS.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.borderLight },
  googleBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#1F1F1F' },
  appleBtn: { backgroundColor: '#000' },
  appleBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  emailBtn: { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.primary },
  emailBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginVertical: SPACING.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.borderLight },
  dividerText: { fontSize: FONTS.xs, color: theme.textMuted, fontWeight: FONTS.semibold },

  // Input
  inputGroup: { gap: 8 },
  label: {
    ...TYPOGRAPHY.overline,
    color: theme.textSecondary,
  },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: theme.borderLight,
    paddingHorizontal: SPACING.lg,
  },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: FONTS.md, color: theme.textPrimary },

  // CTA
  ctaBtn: {
    height: 56, backgroundColor: theme.primary,
    borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.colored,
  },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },

  // Links
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  backLinkText: { fontSize: FONTS.sm, color: theme.textMuted, fontWeight: FONTS.semibold },

  // Consent
  consentText: {
    fontSize: FONTS.xs, color: theme.textMuted, textAlign: 'center',
    lineHeight: 18, marginTop: SPACING.md,
  },
  consentLink: { color: theme.primary, fontWeight: FONTS.semibold },
  footerCopyright: { fontSize: 10, color: theme.textMuted, textAlign: 'center', marginTop: SPACING.xl },
});
