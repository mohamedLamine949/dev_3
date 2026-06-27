import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import {
  isValidMaliPhone, formatPhoneE164, phoneToSyntheticEmail,
  getLoginEmailForPhone, sanitizePhoneDigits,
} from '../lib/phoneAuth';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const phoneOk = isValidMaliPhone(phone);
  const isLoginValid = phoneOk && password.length >= 6;
  const isRegisterValid = isLoginValid && prenom.trim().length >= 2 && nom.trim().length >= 2;
  const canSubmit = mode === 'login' ? isLoginValid : isRegisterValid;

  async function handleLogin() {
    const email = await getLoginEmailForPhone(phone);
    if (!email) {
      throw new Error("Aucun compte n'est associé à ce numéro. Vérifiez le numéro ou inscrivez-vous.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Message générique pour ne pas révéler si c'est le numéro ou le mot de passe
      throw new Error('Numéro ou mot de passe incorrect.');
    }
    navigation.goBack();
  }

  async function handleRegister() {
    const formattedPhone = formatPhoneE164(phone);

    // 1. Vérifier que le numéro n'est pas déjà utilisé
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('num_telephone', formattedPhone)
      .maybeSingle();
    if (checkError) throw checkError;
    if (existing) throw new Error('Ce numéro de téléphone est déjà enregistré.');

    // 2. Créer le compte avec un e-mail technique dérivé du numéro
    const { data, error } = await supabase.auth.signUp({
      email: phoneToSyntheticEmail(phone),
      password,
      options: {
        data: {
          phone: formattedPhone,
          first_name: prenom.trim(),
          last_name: nom.trim(),
        },
      },
    });
    if (error) throw error;

    if (!data.session) {
      // Devrait être immédiat si "Confirm email" est désactivé côté Supabase
      Alert.alert(
        'Compte créé',
        "Votre compte a été créé. Vous pouvez maintenant vous connecter."
      );
      setMode('login');
      setPassword('');
      return;
    }

    // 3. Inviter à renseigner un e-mail de secours (récupération de mot de passe)
    navigation.replace('EmailRecovery', { firstTime: true });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.toggle}>
            <TouchableOpacity style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]} onPress={() => setMode('login')}>
              <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Se connecter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]} onPress={() => setMode('register')}>
              <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>S'inscrire</Text>
            </TouchableOpacity>
          </View>

          {mode === 'register' && (
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput style={styles.input} placeholder="Amadou" placeholderTextColor={theme.textMuted} value={prenom} onChangeText={setPrenom} autoCapitalize="words" />
              </View>
              <View style={styles.rowSpacer} />
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Nom</Text>
                <TextInput style={styles.input} placeholder="Coulibaly" placeholderTextColor={theme.textMuted} value={nom} onChangeText={setNom} autoCapitalize="words" />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <View style={styles.inputWithIcon}>
              <View style={styles.dialCode}>
                <Text style={styles.dialCodeText}>+223</Text>
              </View>
              <TextInput
                style={styles.inputFlex}
                placeholder="70 00 00 00"
                placeholderTextColor={theme.textMuted}
                value={phone}
                onChangeText={(t) => setPhone(sanitizePhoneDigits(t).slice(0, 8))}
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>
            {phone.length > 0 && !phoneOk && (
              <Text style={styles.hint}>Le numéro doit contenir exactement 8 chiffres.</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.inputFlex}
                placeholder="6 caractères minimum"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword', { phone })}
            >
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.ctaBtn, !canSubmit && styles.ctaBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit || loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</Text>}
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'cgu' })}>
              <Text style={styles.footerLink}>CGU</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}> • </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'cgv' })}>
              <Text style={styles.footerLink}>CGV</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}> • </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'privacy' })}>
              <Text style={styles.footerLink}>Protection des données</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footerCopyright}>© 2026 Flash Market. Tous droits réservés.</Text>
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
  toggle: { flexDirection: 'row', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.lg, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md },
  toggleBtnActive: { backgroundColor: theme.surface, ...SHADOWS.sm },
  toggleText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textMuted },
  toggleTextActive: { color: theme.primary },
  row: { flexDirection: 'row' },
  rowSpacer: { width: SPACING.md },
  inputGroup: { gap: 6 },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderLight },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  dialCode: { paddingRight: SPACING.sm, marginRight: SPACING.sm, borderRightWidth: 1, borderRightColor: theme.borderLight, paddingVertical: 13 },
  dialCodeText: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  eyeBtn: { padding: 4 },
  hint: { fontSize: FONTS.xs, color: COLORS.error },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -SPACING.sm },
  forgotText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary },
  ctaBtn: { height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
  },
  footerLink: { color: theme.primary, fontSize: FONTS.xs, fontWeight: FONTS.semibold },
  footerDot: { color: theme.textMuted, marginHorizontal: 4, fontSize: FONTS.xs },
  footerCopyright: {
    fontSize: 10,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
});
