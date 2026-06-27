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

import { useTheme } from '../contexts/ThemeContext';

export default function LoginScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [identifier, setIdentifier] = useState(''); // 8-digit phone or email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP State (Keep variables for compatibility, but bypass during register)
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [userOtp, setUserOtp] = useState('');

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordPhone, setForgotPasswordPhone] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const [acceptCgv, setAcceptCgv] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const isEmail = (val: string) => val.includes('@');
  
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 8) return `+223${cleaned}`;
    return cleaned;
  };

  const isIdentifierValid = (mode === 'register' || authMethod === 'phone')
    ? identifier.replace(/[^0-9]/g, '').length === 8 // Mali phone numbers have exactly 8 digits
    : identifier.includes('@') && identifier.includes('.');

  const isLoginValid = isIdentifierValid && password.length >= 6;
  const isRegisterValid = isLoginValid && prenom.length >= 2 && nom.length >= 2 && acceptCgv;
  const canSubmit = mode === 'login' ? isLoginValid : isRegisterValid;

  async function handleSubmit() {
    if (!canSubmit) return;
    
    setLoading(true);
    const formattedIdentifier = (mode === 'register' || authMethod === 'phone') 
      ? "+223" + identifier.replace(/[^0-9]/g, '') 
      : identifier.toLowerCase().trim();

    try {
      if (mode === 'login') {
        let loginParams: any = {
          password,
        };

        if (authMethod === 'phone') {
          // 1. Vérifier si un e-mail personnalisé est lié à ce téléphone dans public.users
          const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('email')
            .eq('num_telephone', formattedIdentifier);

          if (dbUser && dbUser.length > 0 && dbUser[0].email) {
            // Un e-mail personnalisé est associé à ce téléphone, on l'utilise pour s'authentifier
            loginParams.email = dbUser[0].email;
          } else {
            // Aucun email lié, on utilise le format par défaut @phone.market (sans le '+' au début)
            loginParams.email = formattedIdentifier.replace('+', '') + "@phone.market";
          }
        } else {
          loginParams.email = formattedIdentifier;
        }

        const { data, error } = await supabase.auth.signInWithPassword(loginParams);

        if (error) {
          // Si l'erreur provient de la méthode mail de secours et qu'on utilise le téléphone
          if (authMethod === 'phone') {
            const { data: phoneData, error: phoneError } = await supabase.auth.signInWithPassword({
              phone: formattedIdentifier,
              password,
            } as any);

            if (phoneError) throw error; // on lève l'erreur originale
            if (phoneData.session) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main', params: { screen: 'Profil' } }]
              });
              return;
            }
          }
          throw error;
        }
        
        if (data.session) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main', params: { screen: 'Profil' } }]
          });
        } else {
          Alert.alert('Vérification requise', 'Veuillez vérifier votre compte.');
        }
      } else {
        // Inscription (sans OTP, création directe)
        let signUpParams: any = {
          email: formattedIdentifier.replace('+', '') + "@phone.market",
          password,
          options: {
            data: {
              first_name: prenom.trim(),
              last_name: nom.trim(),
              phone: formattedIdentifier,
            }
          }
        };

        const { data, error } = await supabase.auth.signUp(signUpParams);

        if (error) throw error;

        if (data.user) {
          // Insérer le profil directement dans la table publique 'users'
          const { error: upsertError } = await supabase.from('users').upsert({
            id: data.user.id,
            num_telephone: formattedIdentifier,
            prenom: prenom.trim(),
            nom: nom.trim(),
          }, { onConflict: 'id' });

          if (upsertError) {
            console.error("Erreur lors de l'initialisation du profil public:", upsertError.message);
          }

          // Connexion automatique de l'utilisateur si aucune session n'est générée immédiatement
          if (!data.session) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: formattedIdentifier.replace('+', '') + "@phone.market",
              password: password,
            });
            if (signInError) {
              console.error("Erreur de connexion auto:", signInError.message);
            }
          }

          Alert.alert('Succès', 'Votre compte a été créé avec succès.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'LinkEmail' }]
          });
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
      if (userOtp === '123456') {
        const formattedPhone = formatPhone(identifier);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formattedPhone.replace('+', '') + "@phone.market",
          password: password,
        });
        if (error) {
          console.log("Erreur de connexion simulation:", error.message);
        } else if (data.user) {
          const { error: upsertError } = await supabase.from('users').upsert({
            id: data.user.id,
            num_telephone: formattedPhone,
            prenom: prenom.trim(),
            nom: nom.trim(),
          }, { onConflict: 'id' });
          if (upsertError) {
            console.error("Erreur d'initialisation du profil public:", upsertError.message);
          }
        }
        Alert.alert('Succès (Simulation)', 'Votre numéro a été vérifié.');
        navigation.replace('LinkEmail');
        return;
      }

      const formattedPhone = formatPhone(identifier);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: userOtp,
        type: 'sms',
      });

      if (error) throw error;

      if (data.user) {
        const { error: upsertError } = await supabase.from('users').upsert({
          id: data.user.id,
          num_telephone: formattedPhone,
          prenom: prenom.trim(),
          nom: nom.trim(),
        }, { onConflict: 'id' });
        if (upsertError) {
          console.error("Erreur d'initialisation du profil public:", upsertError.message);
        }
      }

      if (data.session || data.user) {
        Alert.alert('Succès', 'Votre compte a été créé avec succès.');
        navigation.replace('LinkEmail');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Note', 'Mode simulation : utilisez 123456');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanPhone = forgotPasswordPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 8) {
      Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone valide à 8 chiffres.');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const formattedPhone = '+223' + cleanPhone;

      // 1. Rechercher l'email associé à ce numéro de téléphone dans la table publique 'users'
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('num_telephone', formattedPhone)
        .maybeSingle();

      if (error) throw error;

      // Si l'e-mail n'existe pas ou s'il s'agit de l'e-mail technique de type @phone.market ou @phone.chapchap.app
      const hasNoValidEmail = !data || !data.email || 
                              data.email.endsWith('@phone.market') || 
                              data.email.endsWith('@phone.chapchap.app');

      if (hasNoValidEmail) {
        Alert.alert(
          'Compte non récupérable',
          "Vous n'avez aucun e-mail associé à ce numéro de téléphone. Nous vous invitons à créer un nouveau compte."
        );
        return;
      }

      // 2. Envoyer l'email de réinitialisation via Supabase
      const emailToReset = data.email.toLowerCase().trim();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailToReset);
      if (resetError) throw resetError;

      // Masquer une partie de l'e-mail pour la confidentialité (ex: d***@domain.com)
      const parts = emailToReset.split('@');
      const hiddenLocal = parts[0].length > 2 
        ? parts[0][0] + '*'.repeat(parts[0].length - 2) + parts[0][parts[0].length - 1]
        : parts[0][0] + '*';
      const maskedEmail = hiddenLocal + '@' + parts[1];

      Alert.alert(
        'E-mail envoyé',
        `Un e-mail contenant un lien de réinitialisation de mot de passe a été envoyé à l'adresse associée : ${maskedEmail}.\n\nVeuillez vérifier votre boîte de réception.`,
        [
          { text: 'OK', onPress: () => setShowForgotPassword(false) }
        ]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || "Une erreur est survenue lors de l'envoi.");
    } finally {
      setForgotPasswordLoading(false);
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
          {showForgotPassword ? (
            <View style={styles.otpContainer}>
              <Text style={styles.otpTitle}>Mot de passe oublié</Text>
              <Text style={styles.otpSubtitle}>
                Saisissez le numéro de téléphone lié à votre compte. Si un e-mail de récupération y est associé, vous recevrez un lien pour réinitialiser votre mot de passe.
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Numéro de téléphone</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="call-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                  <Text style={{ fontSize: FONTS.md, fontWeight: '700', color: theme.textPrimary, marginRight: 6 }}>+223</Text>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="70 00 00 00"
                    placeholderTextColor={theme.textMuted}
                    value={forgotPasswordPhone}
                    onChangeText={(t) => setForgotPasswordPhone(t.replace(/[^0-9]/g, '').slice(0, 8))}
                    keyboardType="phone-pad"
                    maxLength={8}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.ctaBtn, forgotPasswordPhone.length !== 8 && styles.ctaBtnDisabled]}
                onPress={handleForgotPassword}
                disabled={forgotPasswordPhone.length !== 8 || forgotPasswordLoading}
              >
                {forgotPasswordLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Envoyer le lien de réinitialisation</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForgotPassword(false)}>
                <Text style={styles.cancelText}>Retour à la connexion</Text>
              </TouchableOpacity>
            </View>
          ) : showOtpInput ? (
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
                  placeholderTextColor={theme.textMuted}
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
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ fontSize: FONTS.lg + 2, fontWeight: FONTS.extrabold, color: theme.textPrimary, textAlign: 'center' }}>
                  {mode === 'login' ? "Bon retour !" : "Créer un compte"}
                </Text>
                <Text style={{ fontSize: FONTS.sm, color: theme.textMuted, textAlign: 'center', marginTop: 4 }}>
                  {mode === 'login' ? "Connectez-vous pour continuer" : "Inscrivez-vous en 1 minute par numéro de téléphone"}
                </Text>
              </View>

              {/* Toggle S'inscrire / Se connecter */}
              <View style={[styles.toggle, { marginBottom: SPACING.xs }]}>
                <TouchableOpacity 
                  style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]} 
                  onPress={() => { setMode('register'); setIdentifier(''); setPassword(''); }}
                >
                  <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>S'inscrire</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]} 
                  onPress={() => { setMode('login'); setIdentifier(''); setPassword(''); }}
                >
                  <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Se connecter</Text>
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

              {mode === 'login' && (
                <View style={styles.methodSelector}>
                  <TouchableOpacity 
                    style={[styles.methodBtn, authMethod === 'phone' && styles.methodBtnActive]} 
                    onPress={() => { setAuthMethod('phone'); setIdentifier(''); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call-outline" size={16} color={authMethod === 'phone' ? theme.primary : theme.textMuted} />
                    <Text style={[styles.methodText, authMethod === 'phone' && styles.methodTextActive]}>Téléphone</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.methodBtn, authMethod === 'email' && styles.methodBtnActive]} 
                    onPress={() => { setAuthMethod('email'); setIdentifier(''); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="mail-outline" size={16} color={authMethod === 'email' ? theme.primary : theme.textMuted} />
                    <Text style={[styles.methodText, authMethod === 'email' && styles.methodTextActive]}>E-mail</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {mode === 'register' || authMethod === 'phone' ? 'Numéro de téléphone' : 'Adresse e-mail'}
                </Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons 
                    name={mode === 'register' || authMethod === 'phone' ? 'call-outline' : 'mail-outline'} 
                    size={18} 
                    color={theme.textMuted} 
                    style={styles.inputIcon} 
                  />
                  {(mode === 'register' || authMethod === 'phone') && (
                    <Text style={{ fontSize: FONTS.md, fontWeight: '700', color: theme.textPrimary, marginRight: 6 }}>+223</Text>
                  )}
                  <TextInput
                    style={styles.inputFlex}
                    placeholder={mode === 'register' || authMethod === 'phone' ? '70 00 00 00' : 'exemple@gmail.com'}
                    placeholderTextColor={theme.textMuted}
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType={mode === 'register' || authMethod === 'phone' ? 'number-pad' : 'email-address'}
                    autoCapitalize="none"
                    maxLength={mode === 'register' || authMethod === 'phone' ? 8 : undefined}
                    autoCorrect={false}
                  />
                </View>
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
                  onPress={() => {
                    setShowForgotPassword(true);
                    setForgotPasswordPhone('');
                  }}
                >
                  <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              )}

              {mode === 'register' && (
                <View style={styles.cgvContainer}>
                  <TouchableOpacity 
                    style={styles.cgvCheckbox} 
                    onPress={() => setAcceptCgv(!acceptCgv)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={acceptCgv ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={acceptCgv ? theme.primary : theme.textMuted} 
                    />
                  </TouchableOpacity>
                  <Text style={styles.cgvText}>
                    J'accepte les{' '}
                    <Text 
                      style={styles.cgvLink} 
                      onPress={() => navigation.navigate('Legal', { type: 'cgv' })}
                    >
                      Conditions Générales de Vente (CGV)
                    </Text>
                  </Text>
                </View>
              )}

              <TouchableOpacity style={[styles.ctaBtn, !canSubmit && styles.ctaBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit || loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.switchModeBtn} 
                onPress={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setIdentifier('');
                  setPassword('');
                  setPrenom('');
                  setNom('');
                  setAuthMethod('phone');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.switchModeText}>
                  {mode === 'login' ? "Nouveau sur Flash Market ? S'inscrire" : "Déjà membre ? Se connecter"}
                </Text>
              </TouchableOpacity>
            </>
          )}

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
  methodSelector: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xs },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, backgroundColor: theme.surface },
  methodBtnActive: { borderColor: theme.primary, backgroundColor: theme.surface },
  methodText: { fontSize: FONTS.sm, fontWeight: FONTS.medium, color: theme.textMuted },
  methodTextActive: { color: theme.primary },
  row: { flexDirection: 'row' },
  rowSpacer: { width: SPACING.md },
  inputGroup: { gap: 6 },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderLight },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  eyeBtn: { padding: 4 },
  ctaBtn: { height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 8 },
  forgotText: { fontSize: FONTS.xs, color: theme.primary, fontWeight: FONTS.semibold },
  switchModeBtn: { alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.sm },
  switchModeText: { fontSize: FONTS.sm, color: theme.primary, fontWeight: FONTS.bold },
  footerLinks: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: SPACING.md,
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
  },
  footerLink: { 
    color: theme.primary, 
    fontSize: FONTS.xs, 
    fontWeight: FONTS.semibold 
  },
  footerDot: { 
    color: theme.textMuted, 
    marginHorizontal: 4,
    fontSize: FONTS.xs,
  },
  footerCopyright: { 
    fontSize: 10, 
    color: theme.textMuted, 
    textAlign: 'center', 
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  otpContainer: { gap: SPACING.lg, paddingVertical: SPACING.md },
  otpTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary, textAlign: 'center' },
  otpSubtitle: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.md },
  cancelBtn: { alignItems: 'center', padding: SPACING.sm },
  cancelText: { color: theme.textMuted, fontSize: FONTS.sm, fontWeight: FONTS.medium },
  cgvContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  cgvCheckbox: {
    marginRight: SPACING.sm,
    padding: 2,
  },
  cgvText: {
    flex: 1,
    fontSize: FONTS.sm,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  cgvLink: {
    color: theme.primary,
    fontWeight: FONTS.semibold,
    textDecorationLine: 'underline',
  },
});
