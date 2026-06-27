import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { FONTS, SPACING, RADIUS, SHADOWS, COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  navigation: any;
  route: any;
}

const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

export default function EmailRecoveryScreen({ navigation, route }: Props) {
  const { theme, isDark } = useTheme();
  const { refreshUser } = useAuth();
  const firstTime = route?.params?.firstTime ?? false;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const emailOk = isValidEmail(email);

  function finish() {
    // Retour à l'application principale
    navigation.navigate('Main');
  }

  function handleSkip() {
    if (!firstTime) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Êtes-vous sûr ?',
      "Sans e-mail, vous ne pourrez PAS récupérer votre mot de passe si vous l'oubliez. Vous pourrez l'ajouter plus tard depuis les paramètres.",
      [
        { text: 'Ajouter un e-mail', style: 'cancel' },
        { text: 'Plus tard', style: 'destructive', onPress: finish },
      ]
    );
  }

  async function handleSave() {
    if (!emailOk || loading) return;
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      // 1. Définir l'e-mail comme identité Supabase réelle (déclenche un lien
      //    de confirmation envoyé à cette adresse).
      const redirectTo = Linking.createURL('auth-callback');
      const { error } = await supabase.auth.updateUser(
        { email: cleanEmail },
        { emailRedirectTo: redirectTo }
      );
      if (error) throw error;

      // 2. Refléter l'e-mail dans le profil public (affichage).
      await supabase.rpc('set_recovery_email', { p_email: cleanEmail });
      await refreshUser();

      Alert.alert(
        'Presque terminé !',
        `Un lien de confirmation a été envoyé à ${cleanEmail}. Ouvrez votre boîte mail et cliquez sur le lien pour activer la récupération de votre mot de passe.`,
        [{ text: 'Compris', onPress: finish }]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || "Impossible d'enregistrer l'e-mail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={40} color={theme.primary} />
          </View>

          <Text style={styles.title}>Sécurisez votre compte</Text>
          <Text style={styles.subtitle}>
            Ajoutez une adresse e-mail pour pouvoir récupérer votre mot de passe en cas d'oubli.
          </Text>

          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={18} color={COLORS.error} />
            <Text style={styles.warningText}>
              Sans e-mail, il n'existe aucun moyen de récupérer votre compte si vous perdez votre mot de passe.
            </Text>
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
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.ctaBtn, !emailOk && styles.ctaBtnDisabled]}
            onPress={handleSave}
            disabled={!emailOk || loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer l'e-mail</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={loading}>
            <Text style={styles.skipText}>{firstTime ? 'Plus tard' : 'Annuler'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: SPACING.xxl, paddingTop: Platform.OS === 'ios' ? 90 : 70, gap: SPACING.lg, alignItems: 'stretch' },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, alignSelf: 'center',
    backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  warningBox: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
  },
  warningText: { flex: 1, fontSize: FONTS.sm, color: isDark ? '#FCA5A5' : '#B91C1C', lineHeight: 19 },
  inputGroup: { gap: 6, marginTop: SPACING.sm },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  ctaBtn: { height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  skipBtn: { alignItems: 'center', padding: SPACING.sm },
  skipText: { color: theme.textMuted, fontSize: FONTS.sm, fontWeight: FONTS.medium },
});
