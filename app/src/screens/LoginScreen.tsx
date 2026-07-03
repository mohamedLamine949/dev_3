import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import {
  signInWithGoogle,
  signInWithApple,
  isAppleAuthSupported,
  UserCancelledError,
} from '../lib/socialAuth';

interface Props {
  navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

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

  const busy = loadingProvider !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <View style={styles.header}>
        {navigation.canGoBack() && (
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

      <View style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
      </View>
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
  subtitle: { fontSize: FONTS.sm, color: theme.textMuted, textAlign: 'center', marginTop: 4 },
  socialBtn: {
    height: 54, borderRadius: RADIUS.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.borderLight },
  googleBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#1F1F1F' },
  appleBtn: { backgroundColor: '#000' },
  appleBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  consentText: { fontSize: FONTS.xs, color: theme.textMuted, textAlign: 'center', lineHeight: 18, marginTop: SPACING.sm },
  consentLink: { color: theme.primary, fontWeight: FONTS.semibold },
  footerCopyright: { fontSize: 10, color: theme.textMuted, textAlign: 'center', marginTop: SPACING.xl },
});
