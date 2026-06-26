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

export default function LinkEmailScreen({ navigation }: any) {
  const { session, refreshUser } = useAuth();
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Verification states
  const [showVerification, setShowVerification] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const isEmailValid = email.includes('@') && email.includes('.');

  const handleLinkEmail = async () => {
    if (!isEmailValid || !session) return;
    
    setLoading(true);
    try {
      const trimmedEmail = email.toLowerCase().trim();
      
      // Simuler l'envoi d'un e-mail avec un code à 4 chiffres
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedCode(code);
      
      Alert.alert(
        'Code de validation (Simulation)',
        `Un e-mail automatique contenant votre code de vérification a été envoyé à ${trimmedEmail}.\n\nCode de validation : ${code}`,
        [
          { text: 'OK', onPress: () => setShowVerification(true) }
        ]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || 'Impossible d\'envoyer le code de validation.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!session) return;
    if (verificationCode !== generatedCode) {
      Alert.alert('Code invalide', 'Le code saisi ne correspond pas à celui envoyé par e-mail. Veuillez réessayer.');
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.toLowerCase().trim();

      // 1. Mettre à jour l'email dans l'authentification Supabase (auth.users)
      const { error: authError } = await supabase.auth.updateUser({
        email: trimmedEmail,
      });

      if (authError) throw authError;

      // 2. Mettre à jour la table publique 'users'
      const { error: dbError } = await supabase
        .from('users')
        .update({ email: trimmedEmail })
        .eq('id', session.user.id);

      if (dbError) throw dbError;

      await refreshUser();

      Alert.alert(
        'Succès',
        'Votre adresse e-mail a été liée et votre numéro de téléphone a été authentifié avec succès !',
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
      Alert.alert('Erreur', err.message || 'Impossible d\'associer l\'adresse e-mail.');
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
        {showVerification ? (
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={48} color={theme.primary} />
            </View>

            <Text style={[styles.title, { color: theme.textPrimary }]}>Vérifier l'e-mail</Text>
            
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Entrez le code à 4 chiffres envoyé à {email.toLowerCase().trim()} pour lier votre compte et authentifier votre numéro de téléphone.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Code de validation</Text>
              <View style={[styles.inputWithIcon, { borderColor: theme.borderLight, backgroundColor: theme.surface, justifyContent: 'center' }]}>
                <TextInput
                  style={[styles.inputFlex, { color: theme.textPrimary, textAlign: 'center', fontSize: FONTS.lg, letterSpacing: 8 }]}
                  placeholder="0000"
                  placeholderTextColor={theme.textMuted}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus={true}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: theme.primary }, verificationCode.length < 4 && styles.ctaBtnDisabled]}
              onPress={handleVerifyCode}
              disabled={verificationCode.length < 4 || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Valider et lier mon compte</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.skipBtnOutline, { borderColor: theme.borderLight }]} 
              onPress={() => { setShowVerification(false); setVerificationCode(''); }}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.skipTextOutline, { color: theme.textSecondary }]}>Modifier l'adresse e-mail</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-unread" size={48} color={theme.primary} />
            </View>

            <Text style={[styles.title, { color: theme.textPrimary }]}>Sécurisez votre compte</Text>
            
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Associer une adresse e-mail est le seul moyen de certifier et authentifier votre numéro de téléphone. C'est également indispensable pour pouvoir récupérer votre compte en cas d'oubli de mot de passe.
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
                <Text style={styles.ctaText}>Associer mon adresse e-mail</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.skipBtnOutline, { borderColor: theme.borderLight }]} 
              onPress={handleSkip}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.skipTextOutline, { color: theme.textSecondary }]}>Plus tard (ignorer)</Text>
            </TouchableOpacity>
          </View>
        )}
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
