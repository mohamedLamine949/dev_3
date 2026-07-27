import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useParrainage } from '../hooks/useParrainage';

interface Props {
  navigation: any;
  route: any;
}

/**
 * Saisie du code de parrainage par un filleul.
 * - Proposé juste après l'inscription (route.params.fromSignup = true → bouton
 *   "Continuer sans code" qui ramène à l'accueil).
 * - Accessible aussi depuis le profil tant qu'aucun parrain n'est enregistré.
 * Le lien parrain↔filleul est verrouillé à vie côté serveur.
 */
export default function SaisirCodeParrainageScreen({ navigation, route }: Props) {
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const { saisirCode } = useParrainage(session?.user?.id);
  const fromSignup: boolean = route?.params?.fromSignup === true;

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const canSubmit = cleanCode.length === 6 && !submitting;

  function leave() {
    if (fromSignup) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      navigation.goBack();
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await saisirCode(cleanCode);
      setFeedback({ ok: !!res.ok, message: res.message || (res.ok ? 'Code accepté !' : 'Code invalide') });
      if (res.ok) {
        // Laisser le message de succès visible un instant puis sortir
        setTimeout(leave, 2500);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={leave} activeOpacity={0.8}>
          <Ionicons name={fromSignup ? 'close' : 'arrow-back'} size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Code de parrainage</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.body}>
          <Text style={styles.emoji}>🎟️</Text>
          <Text style={styles.title}>Quelqu'un vous a invité ?</Text>
          <Text style={styles.subtitle}>
            Si un proche vous a partagé son code de parrainage Flash Market, entrez-le ici.
            Vous ne pourrez plus le changer ensuite.
          </Text>

          <TextInput
            style={styles.codeInput}
            placeholder="ABC123"
            placeholderTextColor={theme.textMuted}
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase().replace(/[^A-Za-z0-9]/g, '').slice(0, 6));
              setFeedback(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />

          {feedback && (
            <View style={[styles.feedbackBox, feedback.ok ? styles.feedbackOk : styles.feedbackKo]}>
              <Ionicons
                name={feedback.ok ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={feedback.ok ? theme.primary : '#dc2626'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.feedbackText, { color: feedback.ok ? theme.primary : '#dc2626' }]}>
                {feedback.message}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.ctaBtn, !canSubmit && styles.ctaBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Valider le code</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={leave} activeOpacity={0.7}>
            <Text style={styles.skipText}>{fromSignup ? 'Continuer sans code' : 'Annuler'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  body: { flex: 1, alignItems: 'center', padding: SPACING.xxl, paddingTop: 48 },
  emoji: { fontSize: 44, marginBottom: SPACING.md },
  title: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: theme.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center',
    lineHeight: 20, marginTop: SPACING.sm, marginBottom: SPACING.xl,
  },
  codeInput: {
    width: '100%', backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    borderWidth: 2, borderColor: theme.borderLight,
    paddingVertical: 16, fontSize: 28, fontWeight: FONTS.extrabold,
    color: theme.textPrimary, textAlign: 'center', letterSpacing: 8,
  },
  feedbackBox: {
    flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
  },
  feedbackOk: { backgroundColor: theme.primary + '15' },
  feedbackKo: { backgroundColor: '#dc262615' },
  feedbackText: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, lineHeight: 18 },
  ctaBtn: {
    width: '100%', height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center', marginTop: SPACING.xl, ...SHADOWS.colored,
  },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  skipBtn: { marginTop: SPACING.lg, padding: SPACING.sm },
  skipText: { fontSize: FONTS.sm, color: theme.textSecondary, fontWeight: FONTS.medium, textDecorationLine: 'underline' },
});
