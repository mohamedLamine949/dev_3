import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, Alert, ActivityIndicator, Image, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
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
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Profil' } }] });
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

      <View style={styles.header}>
        {navigation.canGoBack() && step === 'choice' && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
        </View>
        <Text style={styles.appName}>Flash Market</Text>
        <Text style={styles.tagline}>Achetez & Vendez en toute confiance</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'choice' ? (
            <>
              <View style={{ marginBottom: SPACING.md }}>
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
              <View style={{ marginBottom: SPACING.md }}>
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
                <Text style={styles.backLinkText}>Autres méthodes de connexion</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ marginBottom: SPACING.md }}>
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
                <Text style={styles.backLinkText}>Modifier l'adresse</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.primary },
  header: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: SPACING.xxl },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 70 : 50, left: SPACING.lg,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoContainer: { width: 80, height: 80, borderRadius: RADIUS.xxl, overflow: 'hidden', marginBottom: SPACING.lg },
  logoImage: { width: 80, height: 80 },
  appName: { fontSize: FONTS.xxxl, fontWeight: FONTS.extrabold, color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  cardWrapper: { flex: 1 },
  card: { flex: 1, backgroundColor: theme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  cardContent: { padding: SPACING.xxl, paddingBottom: 40, gap: SPACING.lg },
  title: { fontSize: FONTS.lg + 2, fontWeight: FONTS.extrabold, color: theme.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FONTS.sm, color: theme.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: SPACING.md },
  socialBtn: {
    height: 54, borderRadius: RADIUS.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.borderLight },
  googleBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#1F1F1F' },
  appleBtn: { backgroundColor: '#000' },
  appleBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  emailBtn: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.primary },
  emailBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginVertical: SPACING.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.borderLight },
  dividerText: { fontSize: FONTS.xs, color: theme.textMuted, fontWeight: FONTS.semibold },
  inputGroup: { gap: 6 },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  ctaBtn: { height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  backLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  backLinkText: { fontSize: FONTS.sm, color: theme.textMuted, fontWeight: FONTS.semibold },
  consentText: { fontSize: FONTS.xs, color: theme.textMuted, textAlign: 'center', lineHeight: 18, marginTop: SPACING.sm },
  consentLink: { color: theme.primary, fontWeight: FONTS.semibold },
  footerCopyright: { fontSize: 10, color: theme.textMuted, textAlign: 'center', marginTop: SPACING.xl },
});
