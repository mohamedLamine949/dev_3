import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\s+/g, '');
    if (cleanPhone.length < 8) return;
    setIsLoading(true);

    try {
      const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : '+223' + cleanPhone;
      const { error } = await signInWithOtp(fullPhone);

      if (error) {
        setIsLoading(false);
        Alert.alert('Erreur', error.message || 'Impossible d\'envoyer le code SMS.');
        return;
      }

      setIsLoading(false);
      setStep('otp');
      fadeAnim.setValue(1);
    } catch (err: any) {
      setIsLoading(false);
      Alert.alert('Erreur système', err.message || 'Une erreur est survenue.');
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.replace(/\s+/g, '');
    if (cleanOtp.length < 6) return;
    setIsLoading(true);

    try {
      const cleanPhone = phone.replace(/\s+/g, '');
      const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : '+223' + cleanPhone;
      const { error } = await verifyOtp(fullPhone, cleanOtp);

      setIsLoading(false);
      if (error) {
        Alert.alert('Code invalide', 'Le code renseigné est incorrect ou expiré.');
        return;
      }

      // Navigation sur succès
      navigation.goBack();
    } catch (err: any) {
      setIsLoading(false);
      Alert.alert('Erreur', err.message || 'La vérification a échoué.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        {/* Logo & Titre */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>⚡</Text>
          </View>
          <Text style={styles.appName}>Chap Chap</Text>
          <Text style={styles.tagline}>
            {step === 'phone'
              ? 'Connectez-vous avec votre\nnuméro de téléphone'
              : `Code envoyé au\n+223 ${phone}`}
          </Text>
        </View>

        {/* Form */}
        <Animated.View style={[styles.formSection, { opacity: fadeAnim }]}>
          {step === 'phone' ? (
            <>
              <Text style={styles.inputLabel}>Numéro de téléphone</Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCode}>
                  <Text style={styles.flag}>🇲🇱</Text>
                  <Text style={styles.countryCodeText}>+223</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="76 XX XX XX"
                  placeholderTextColor={COLORS.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.ctaButton, phone.length < 8 && styles.ctaButtonDisabled]}
                onPress={handleSendOtp}
                disabled={phone.length < 8 || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <Text style={styles.ctaText}>Envoi en cours...</Text>
                ) : (
                  <>
                    <Text style={styles.ctaText}>Recevoir le code</Text>
                    <Ionicons name="arrow-forward" size={20} color={COLORS.textInverse} />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>Code de vérification</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="• • • • • •"
                placeholderTextColor={COLORS.textMuted}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.ctaButton, otp.length < 6 && styles.ctaButtonDisabled]}
                onPress={handleVerifyOtp}
                disabled={otp.length < 6 || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <Text style={styles.ctaText}>Vérification...</Text>
                ) : (
                  <>
                    <Text style={styles.ctaText}>Vérifier</Text>
                    <Ionicons name="checkmark" size={20} color={COLORS.textInverse} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => setStep('phone')}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>Modifier le numéro</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            En continuant, vous acceptez nos{' '}
            <Text style={styles.footerLink}>Conditions d'utilisation</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'center',
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.section,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: FONTS.xxxl,
    fontWeight: FONTS.extrabold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Form
  formSection: {
    gap: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: -SPACING.sm,
    marginLeft: SPACING.xs,
  },

  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderLight,
    gap: 6,
  },
  flag: {
    fontSize: 20,
  },
  countryCodeText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 16,
    fontSize: FONTS.lg,
    fontWeight: FONTS.semibold,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },

  otpInput: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 18,
    fontSize: FONTS.xxl,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 10,
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
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

  resendButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  resendText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.primary,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: SPACING.section,
  },
  footerText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: FONTS.medium,
  },
});
