import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

// Validation stricte du format e-mail (rejette les saisies fantaisistes)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LinkEmailScreen({ navigation }: any) {
  const { session, user, refreshUser } = useAuth();
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [pendingEmail, setPendingEmail] = useState(''); // e-mail en attente de confirmation
  const [code, setCode] = useState('');

  React.useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const trimmedInput = email.trim();
  const hasEmailChanged = trimmedInput.toLowerCase() !== (user?.email || '').toLowerCase().trim();
  const isFormatValid = EMAIL_REGEX.test(trimmedInput);
  const isEmailValid = isFormatValid && hasEmailChanged;
  const showFormatError = trimmedInput.length > 0 && !isFormatValid;

  // Étape 1 : envoyer un code de confirmation au nouvel e-mail
  const handleSendCode = async () => {
    if (!isEmailValid || !session) return;

    setLoading(true);
    try {
      const trimmedEmail = email.toLowerCase().trim();

      // updateUser({email}) déclenche l'envoi d'un code (OTP) au nouvel e-mail.
      const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (error) throw error;

      setPendingEmail(trimmedEmail);
      setCode('');
      setStep('code');
    } catch (err: any) {
      console.error(err);
      const raw = (err?.message || '').toLowerCase();
      const msg = raw.includes('already') || err?.code === '23505'
        ? 'Cette adresse e-mail est déjà utilisée par un autre compte. Veuillez en choisir une autre.'
        : err.message || "Impossible d'envoyer le code de confirmation.";
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 : vérifier le code -> l'e-mail devient l'identité de récupération
  const handleVerifyCode = async () => {
    if (code.length < 6) return;

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: code,
        type: 'email_change',
      });
      if (verifyError) throw new Error('Code incorrect ou expiré. Veuillez réessayer.');

      // Synchroniser l'e-mail confirmé dans le profil public
      await supabase.rpc('set_recovery_email', { p_email: pendingEmail });
      await refreshUser();

      Alert.alert(
        'E-mail confirmé ✅',
        `Votre adresse e-mail de secours (${pendingEmail}) est maintenant active. Vous pourrez l'utiliser pour récupérer votre mot de passe.`,
        [
          {
            text: 'Super',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.replace('Main', { screen: 'Profil' });
              }
            }
          }
        ]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || 'Impossible de confirmer le code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Main', { screen: 'Profil' });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail-unread" size={48} color={theme.primary} />
          </View>

          {step === 'email' ? (
            <>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {user?.email ? "E-mail de secours" : "Sécurisez votre compte"}
              </Text>

              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {user?.email
                  ? `Votre adresse e-mail actuelle est : ${user.email}. Saisissez une nouvelle adresse ci-dessous pour la modifier.`
                  : "Associer une adresse e-mail est le seul moyen de certifier et authentifier votre numéro de téléphone. C'est également indispensable pour pouvoir récupérer votre compte en cas d'oubli de mot de passe."}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Adresse Email</Text>
                <View style={[styles.inputWithIcon, { borderColor: theme.borderLight, backgroundColor: theme.surface }]}>
                  <Ionicons name="mail-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputFlex, { color: theme.textPrimary }]}
                    placeholder="exemple@gmail.com"
                    placeholderTextColor={theme.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {showFormatError && (
                  <Text style={styles.errorHint}>Format d'e-mail invalide (ex : nom@domaine.com).</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: theme.primary }, !isEmailValid && styles.ctaBtnDisabled]}
                onPress={handleSendCode}
                disabled={!isEmailValid || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>Envoyer le code de confirmation</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.skipBtnOutline, { borderColor: theme.borderLight }]}
                onPress={handleSkip}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.skipTextOutline, { color: theme.textSecondary }]}>
                  {user?.email ? "Annuler" : "Plus tard (ignorer)"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Confirmez votre e-mail</Text>

              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Un code à 6 chiffres a été envoyé à {pendingEmail}. Saisissez-le ci-dessous pour activer cette adresse.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Code de confirmation</Text>
                <View style={[styles.inputWithIcon, { borderColor: theme.borderLight, backgroundColor: theme.surface }]}>
                  <Ionicons name="key-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputFlex, { color: theme.textPrimary }]}
                    placeholder="123456"
                    placeholderTextColor={theme.textMuted}
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 10))}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: theme.primary }, code.length < 6 && styles.ctaBtnDisabled]}
                onPress={handleVerifyCode}
                disabled={code.length < 6 || loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Confirmer</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendCode} disabled={loading} style={styles.linkBtn}>
                <Text style={[styles.skipTextOutline, { color: theme.primary }]}>Renvoyer le code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.skipBtnOutline, { borderColor: theme.borderLight }]}
                onPress={() => { setStep('email'); setCode(''); }}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.skipTextOutline, { color: theme.textSecondary }]}>Modifier l'adresse</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(21, 128, 61, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONTS.lg + 2,
    fontWeight: FONTS.extrabold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.md,
  },
  inputGroup: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    marginBottom: 6,
  },
  errorHint: {
    fontSize: FONTS.xs,
    color: COLORS.error,
    marginTop: 6,
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: 4,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputFlex: {
    flex: 1,
    fontSize: FONTS.md,
    height: '100%',
  },
  ctaBtn: {
    width: '100%',
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  skipBtnOutline: {
    width: '100%',
    height: 48,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  skipTextOutline: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
  },
});
