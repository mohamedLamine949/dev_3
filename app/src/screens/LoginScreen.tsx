import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface Props {
  navigation: any;
}

type AuthMethod = 'phone' | 'email';

export default function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [identifier, setIdentifier] = useState(''); // phone or email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP State
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [userOtp, setUserOtp] = useState('');

  const isEmail = (val: string) => val.includes('@');
  
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 8) return `+223${cleaned}`; // Mali default
    return cleaned;
  };

  const isIdentifierValid = authMethod === 'email' 
    ? identifier.includes('@') && identifier.includes('.')
    : identifier.replace(/[^0-9]/g, '').length >= 8;

  const isLoginValid = isIdentifierValid && password.length >= 6;
  const isRegisterValid = isLoginValid && prenom.length >= 2 && nom.length >= 2;
  const canSubmit = mode === 'login' ? isLoginValid : isRegisterValid;

  async function handleSubmit() {
    if (!canSubmit) return;
    
    setLoading(true);
    const formattedIdentifier = authMethod === 'phone' ? formatPhone(identifier) : identifier.toLowerCase().trim();

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          [authMethod]: formattedIdentifier,
          password,
        } as any);

        if (error) throw error;
        
        if (data.session) {
          navigation.goBack();
        } else {
          Alert.alert('Vérification requise', 'Veuillez vérifier votre compte.');
        }
      } else {
        // Inscription
        const { data, error } = await supabase.auth.signUp({
          [authMethod]: formattedIdentifier,
          password,
          options: {
            data: {
              first_name: prenom.trim(),
              last_name: nom.trim(),
            }
          }
        } as any);

        // Si erreur de fournisseur SMS, on simule quand même pour le dev
        if (error) {
          if (authMethod === 'phone' && (error.message.includes('SMS') || error.message.includes('provider'))) {
            console.warn("SMS Provider non configuré. Mode simulation activé.");
            setShowOtpInput(true);
            return;
          }
          throw error;
        }

        if (authMethod === 'phone') {
          // Si Supabase est configuré sans confirmation (auto-confirm), data.session existe déjà
          // Mais on affiche l'écran OTP pour la simulation demandée
          setShowOtpInput(true);
          if (data.session) {
             console.log("Compte auto-confirmé, mais on affiche l'OTP pour simulation");
          }
        } else {
          Alert.alert('Succès', 'Veuillez vérifier votre email pour confirmer l\'inscription.');
          setMode('login');
        }
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!userOtp || userOtp.length < 6) return;

    setLoading(true);
    try {
      // Simulation pour le moment
      if (userOtp === '123456') {
        Alert.alert('Succès (Simulation)', 'Votre numéro a été vérifié.');
        navigation.goBack();
        return;
      }

      const formattedPhone = formatPhone(identifier);
      const { data, error } = await supabase.auth.verifyOTP({
        phone: formattedPhone,
        token: userOtp,
        type: 'sms',
      });

      if (error) throw error;

      if (data.session) {
        Alert.alert('Succès', 'Votre compte a été créé avec succès.');
        navigation.goBack();
      }
    } catch (err: any) {
      console.error(err);
      // En mode simulation, on accepte n'importe quel code si l'erreur vient du manque de provider
      Alert.alert('Note', 'Mode simulation : utilisez 123456');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

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
          {!showOtpInput && (
            <View style={styles.toggle}>
              <TouchableOpacity style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]} onPress={() => setMode('login')}>
                <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Se connecter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]} onPress={() => setMode('register')}>
                <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>S'inscrire</Text>
              </TouchableOpacity>
            </View>
          )}

          {showOtpInput ? (
            <View style={styles.otpContainer}>
              <Text style={styles.otpTitle}>Vérification du numéro</Text>
              <Text style={styles.otpSubtitle}>
                Un code à 6 chiffres a été envoyé par SMS au {formatPhone(identifier)}.
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Code de validation</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={COLORS.textMuted}
                  value={userOtp}
                  onChangeText={setUserOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                style={[styles.ctaBtn, userOtp.length < 6 && styles.ctaBtnDisabled]}
                onPress={handleVerifyOtp}
                disabled={userOtp.length < 6 || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Valider et s'inscrire</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowOtpInput(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Auth Method Selector */}
              <View style={styles.methodSelector}>
                <TouchableOpacity 
                  style={[styles.methodBtn, authMethod === 'phone' && styles.methodBtnActive]} 
                  onPress={() => { setAuthMethod('phone'); setIdentifier(''); }}
                >
                  <Ionicons name="call" size={16} color={authMethod === 'phone' ? COLORS.primary : COLORS.textMuted} />
                  <Text style={[styles.methodText, authMethod === 'phone' && styles.methodTextActive]}>Téléphone</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.methodBtn, authMethod === 'email' && styles.methodBtnActive]} 
                  onPress={() => { setAuthMethod('email'); setIdentifier(''); }}
                >
                  <Ionicons name="mail" size={16} color={authMethod === 'email' ? COLORS.primary : COLORS.textMuted} />
                  <Text style={[styles.methodText, authMethod === 'email' && styles.methodTextActive]}>Email</Text>
                </TouchableOpacity>
              </View>

              {mode === 'register' && (
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Prénom</Text>
                    <TextInput style={styles.input} placeholder="Amadou" placeholderTextColor={COLORS.textMuted} value={prenom} onChangeText={setPrenom} autoCapitalize="words" />
                  </View>
                  <View style={styles.rowSpacer} />
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Nom</Text>
                    <TextInput style={styles.input} placeholder="Coulibaly" placeholderTextColor={COLORS.textMuted} value={nom} onChangeText={setNom} autoCapitalize="words" />
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{authMethod === 'phone' ? 'Numéro de téléphone' : 'Adresse Email'}</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name={authMethod === 'phone' ? "call-outline" : "mail-outline"} size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    placeholder={authMethod === 'phone' ? "Ex: 70 00 00 00" : "exemple@gmail.com"}
                    placeholderTextColor={COLORS.textMuted}
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType={authMethod === 'phone' ? "phone-pad" : "email-address"}
                    autoCapitalize="none"
                  />
                </View>
              </View>

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
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={[styles.ctaBtn, !canSubmit && styles.ctaBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit || loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</Text>}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.footer}>En continuant, vous acceptez nos <Text style={styles.footerLink}>Conditions d'utilisation</Text></Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
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
  card: { flex: 1, backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  cardContent: { padding: SPACING.xxl, paddingBottom: 40, gap: SPACING.lg },
  toggle: { flexDirection: 'row', backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.lg, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md },
  toggleBtnActive: { backgroundColor: COLORS.surface, ...SHADOWS.sm },
  toggleText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.primary },
  methodSelector: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xs },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.surface },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  methodText: { fontSize: FONTS.sm, fontWeight: FONTS.medium, color: COLORS.textMuted },
  methodTextActive: { color: COLORS.primary },
  row: { flexDirection: 'row' },
  rowSpacer: { width: SPACING.md },
  inputGroup: { gap: 6 },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 13, fontSize: FONTS.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.borderLight },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: COLORS.textPrimary },
  eyeBtn: { padding: 4 },
  ctaBtn: { height: 54, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: COLORS.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  footer: { fontSize: FONTS.xs, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, marginTop: SPACING.sm },
  footerLink: { color: COLORS.primary, fontWeight: FONTS.medium },
  otpContainer: { gap: SPACING.lg, paddingVertical: SPACING.md },
  otpTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  otpSubtitle: { fontSize: FONTS.sm, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.md },
  cancelBtn: { alignItems: 'center', padding: SPACING.sm },
  cancelText: { color: COLORS.textMuted, fontSize: FONTS.sm, fontWeight: FONTS.medium },
});
