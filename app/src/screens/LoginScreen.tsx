import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

  const isLoginValid = email.includes('@') && password.length >= 6;
  const isRegisterValid = isLoginValid && prenom.length >= 2 && nom.length >= 2;
  const canSubmit = mode === 'login' ? isLoginValid : isRegisterValid;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) {
          Alert.alert('Connexion impossible', 'Email ou mot de passe incorrect.');
          return;
        }
      } else {
        const { error } = await signUpWithEmail(email.trim(), password, prenom.trim(), nom.trim());
        if (error) {
          Alert.alert('Inscription impossible', error.message || 'Vérifiez vos informations.');
          return;
        }
        Alert.alert('Compte créé !', 'Vérifiez votre email pour confirmer votre compte.');
        return;
      }
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setSocialLoading('google');
    const { error } = await signInWithGoogle();
    setSocialLoading(null);
    if (error) Alert.alert('Erreur Google', error.message || 'Connexion Google impossible.');
    else navigation.goBack();
  }

  async function handleApple() {
    setSocialLoading('apple');
    const { error } = await signInWithApple();
    setSocialLoading(null);
    if (error && error.message !== 'The user canceled the authorization attempt') {
      Alert.alert('Erreur Apple', error.message || 'Connexion Apple impossible.');
    } else if (!error) {
      navigation.goBack();
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header vert */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>⚡</Text>
        </View>
        <Text style={styles.appName}>Chap Chap</Text>
        <Text style={styles.tagline}>La marketplace du Mali</Text>
      </View>

      {/* Card blanche */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.cardWrapper}
      >
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Toggle Login / Register */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>
                Se connecter
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>
                S'inscrire
              </Text>
            </TouchableOpacity>
          </View>

          {/* Champs inscription */}
          {mode === 'register' && (
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Amadou"
                  placeholderTextColor={COLORS.textMuted}
                  value={prenom}
                  onChangeText={setPrenom}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.rowSpacer} />
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Nom</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Coulibaly"
                  placeholderTextColor={COLORS.textMuted}
                  value={nom}
                  onChangeText={setNom}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse email</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.inputFlex}
                placeholder="vous@exemple.com"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.inputFlex}
                placeholder="6 caractères minimum"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton principal */}
          <TouchableOpacity
            style={[styles.ctaBtn, !canSubmit && styles.ctaBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={handleGoogle}
            disabled={socialLoading !== null}
            activeOpacity={0.85}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color={COLORS.textPrimary} />
            ) : (
              <>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialText}>Continuer avec Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple (iOS uniquement) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleBtn}
              onPress={handleApple}
              disabled={socialLoading !== null}
              activeOpacity={0.85}
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={styles.appleBtnText}>Continuer avec Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            En continuant, vous acceptez nos{' '}
            <Text style={styles.footerLink}>Conditions d'utilisation</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },

  // Header vert
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: SPACING.xxl,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoEmoji: { fontSize: 36 },
  appName: {
    fontSize: FONTS.xxxl,
    fontWeight: FONTS.extrabold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },

  // Card blanche arrondie
  cardWrapper: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardContent: {
    padding: SPACING.xxl,
    paddingBottom: 40,
    gap: SPACING.lg,
  },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  toggleText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.textMuted,
  },
  toggleTextActive: { color: COLORS.primary },

  // Inputs
  row: { flexDirection: 'row' },
  rowSpacer: { width: SPACING.md },
  inputGroup: { gap: 6 },
  label: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: SPACING.lg,
  },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: {
    flex: 1,
    paddingVertical: 13,
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
  },
  eyeBtn: { padding: 4 },

  // CTA
  ctaBtn: {
    height: 54,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.colored,
  },
  ctaBtnDisabled: {
    backgroundColor: COLORS.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: '#fff',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  dividerText: { fontSize: FONTS.xs, color: COLORS.textMuted },

  // Social
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  googleG: {
    fontSize: 18,
    fontWeight: FONTS.bold,
    color: '#4285F4',
    fontStyle: 'italic',
  },
  socialText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: RADIUS.lg,
    backgroundColor: '#000',
    gap: SPACING.md,
  },
  appleBtnText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: '#fff',
  },

  // Footer
  footer: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: FONTS.medium,
  },
});
