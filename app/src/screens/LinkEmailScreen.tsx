import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

// Validation stricte du format e-mail (rejette les saisies fantaisistes)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LinkEmailScreen({ navigation }: any) {
  const { session, user } = useAuth();
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleLinkEmail = async () => {
    if (!isEmailValid || !session) return;
    
    setLoading(true);
    try {
      const trimmedEmail = email.toLowerCase().trim();

      // Envoi d'un lien de confirmation au nouvel e-mail : preuve de propriété.
      // L'adresse ne devient l'e-mail de récupération qu'APRÈS le clic sur le
      // lien (capté par le DeepLinkHandler via flashmarket://auth-callback).
      const { error } = await supabase.auth.updateUser(
        { email: trimmedEmail },
        { emailRedirectTo: Linking.createURL('auth-callback') }
      );

      if (error) throw error;

      Alert.alert(
        'Vérifiez votre boîte mail 📩',
        `Un lien de confirmation a été envoyé à ${trimmedEmail}.\n\nOuvrez-le pour activer la récupération de votre mot de passe. Tant que vous n'avez pas cliqué sur ce lien, l'adresse n'est pas active.`,
        [
          {
            text: 'Compris',
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
      const raw = (err?.message || '').toLowerCase();
      const msg = raw.includes('already') || err?.code === '23505'
        ? 'Cette adresse e-mail est déjà utilisée par un autre compte. Veuillez en choisir une autre.'
        : err.message || "Impossible d'envoyer le lien de confirmation.";
      Alert.alert('Erreur', msg);
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
            onPress={handleLinkEmail}
            disabled={!isEmailValid || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                {user?.email ? "Modifier mon adresse e-mail" : "Associer mon adresse e-mail"}
              </Text>
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
