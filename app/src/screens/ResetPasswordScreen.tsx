import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { isPasswordValid, getPasswordErrors, translateAuthError } from '../lib/passwordPolicy';

interface Props {
  navigation: any;
}

export default function ResetPasswordScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const valid = isPasswordValid(password) && password === confirm;

  async function handleReset() {
    if (!valid || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert(
        'Mot de passe modifié',
        'Votre nouveau mot de passe a été enregistré.',
        [{ text: 'Continuer', onPress: () => navigation.navigate('Main') }]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', translateAuthError(err));
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
            <Ionicons name="key-outline" size={40} color={theme.primary} />
          </View>
          <Text style={styles.title}>Nouveau mot de passe</Text>

          {!session ? (
            <>
              <Text style={styles.subtitle}>
                Ce lien de réinitialisation est invalide ou a expiré. Veuillez recommencer la procédure « Mot de passe oublié ».
              </Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Main')}>
                <Text style={styles.ctaText}>Retour</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>Choisissez un nouveau mot de passe pour votre compte.</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nouveau mot de passe</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="8 caractères min. (ex. MonPass1!)"
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
                {password.length > 0 && !isPasswordValid(password) && (
                  <Text style={styles.hint}>
                    Il manque : {getPasswordErrors(password).join(', ')}
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="Retapez le mot de passe"
                    placeholderTextColor={theme.textMuted}
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
                {confirm.length > 0 && password !== confirm && (
                  <Text style={styles.hint}>Les mots de passe ne correspondent pas.</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.ctaBtn, !valid && styles.ctaBtnDisabled]}
                onPress={handleReset}
                disabled={!valid || loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer</Text>}
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
  content: { padding: SPACING.xxl, paddingTop: Platform.OS === 'ios' ? 90 : 70, gap: SPACING.lg },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, alignSelf: 'center',
    backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  title: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  inputGroup: { gap: 6 },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  eyeBtn: { padding: 4 },
  hint: { fontSize: FONTS.xs, color: '#EF4444' },
  ctaBtn: { height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
