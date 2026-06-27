import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  navigation: any;
}

const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const emailOk = isValidEmail(email);

  async function handleSend() {
    if (!emailOk || loading) return;
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || "Impossible d'envoyer l'e-mail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mot de passe oublié</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {sent ? (
            <View style={styles.successBox}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-unread-outline" size={40} color={theme.primary} />
              </View>
              <Text style={styles.title}>Vérifiez votre boîte mail</Text>
              <Text style={styles.subtitle}>
                Si un compte est associé à {email.trim().toLowerCase()}, un lien de réinitialisation vient d'y être envoyé. Cliquez dessus pour choisir un nouveau mot de passe.
              </Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.ctaText}>Retour à la connexion</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Saisissez l'adresse e-mail que vous avez associée à votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </Text>

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
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.ctaBtn, !emailOk && styles.ctaBtnDisabled]}
                onPress={handleSend}
                disabled={!emailOk || loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Envoyer le lien</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.borderLight, ...SHADOWS.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.full, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  content: { padding: SPACING.xxl, gap: SPACING.lg },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, alignSelf: 'center',
    backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  title: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  successBox: { gap: SPACING.lg, alignItems: 'stretch', marginTop: SPACING.xxl },
  inputGroup: { gap: 6 },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  ctaBtn: { height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
