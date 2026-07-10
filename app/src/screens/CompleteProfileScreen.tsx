import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  navigation: any;
  route: any;
}

/**
 * Écran affiché après la PREMIÈRE connexion sociale (Google/Apple).
 * Google/Apple fournissent le nom + l'e-mail (déjà vérifiés) ; il ne
 * reste qu'à récupérer le numéro de téléphone de contact, indispensable
 * pour une marketplace (les acheteurs appellent les vendeurs).
 */
export default function CompleteProfileScreen({ navigation, route }: Props) {
  const { theme, isDark } = useTheme();
  const { session, user, refreshUser } = useAuth();

  const meta = session?.user?.user_metadata || {};
  const prefillName: string = route?.params?.prefillName || meta.full_name || meta.name || '';
  const [first = '', ...rest] = prefillName.trim().split(' ');

  const [prenom, setPrenom] = useState(user?.prenom || meta.given_name || first || '');
  const [nom, setNom] = useState(user?.nom || meta.family_name || rest.join(' ') || '');
  const [telephone, setTelephone] = useState(user?.telephone || '');
  const [acceptCgv, setAcceptCgv] = useState(false);
  const [loading, setLoading] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const phoneDigits = telephone.replace(/[^0-9]/g, '');
  const canSubmit =
    prenom.trim().length >= 2 &&
    nom.trim().length >= 2 &&
    phoneDigits.length === 8 &&
    acceptCgv;

  async function handleSave() {
    if (!canSubmit || !session) return;
    setLoading(true);
    try {
      const formattedPhone = '+223' + phoneDigits;
      const { error } = await supabase.from('users').upsert(
        {
          id: session.user.id,
          prenom: prenom.trim(),
          nom: nom.trim(),
          telephone: formattedPhone,
          email: session.user.email || null,
        },
        { onConflict: 'id' }
      );
      if (error) throw error;
      await refreshUser();

      // Programme de parrainage : si une campagne est active et que ce compte
      // n'a pas encore de parrain, on propose la saisie du code (skippable).
      // En cas d'échec de lecture (table absente, réseau), parcours normal.
      let proposerCode = false;
      try {
        const { data: camp } = await supabase
          .from('campagnes_parrainage')
          .select('id')
          .eq('active', true)
          .maybeSingle();
        if (camp) {
          const { data: dejaParraine } = await supabase
            .from('parrainages')
            .select('id')
            .eq('filleul_id', session.user.id)
            .maybeSingle();
          proposerCode = !dejaParraine;
        }
      } catch {}

      if (proposerCode) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'SaisirCodeParrainage', params: { fromSignup: true } }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Profil' } }],
        });
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', err.message || "Impossible d'enregistrer votre profil.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
        </View>
        <Text style={styles.appName}>Presque terminé !</Text>
        <Text style={styles.tagline}>Complétez votre profil pour commencer</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                placeholder="Amadou"
                placeholderTextColor={theme.textMuted}
                value={prenom}
                onChangeText={setPrenom}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.rowSpacer} />
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={styles.input}
                placeholder="Coulibaly"
                placeholderTextColor={theme.textMuted}
                value={nom}
                onChangeText={setNom}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="call-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
              <Text style={{ fontSize: FONTS.md, fontWeight: '700', color: theme.textPrimary, marginRight: 6 }}>+223</Text>
              <TextInput
                style={styles.inputFlex}
                placeholder="70 00 00 00"
                placeholderTextColor={theme.textMuted}
                value={telephone}
                onChangeText={(t) => setTelephone(t.replace(/[^0-9]/g, '').slice(0, 8))}
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>
            <Text style={styles.hint}>Ce numéro sera visible par les acheteurs pour vous contacter.</Text>
          </View>

          <View style={styles.cgvContainer}>
            <TouchableOpacity style={styles.cgvCheckbox} onPress={() => setAcceptCgv(!acceptCgv)} activeOpacity={0.7}>
              <Ionicons
                name={acceptCgv ? 'checkbox' : 'square-outline'}
                size={20}
                color={acceptCgv ? theme.primary : theme.textMuted}
              />
            </TouchableOpacity>
            <Text style={styles.cgvText}>
              J'accepte les{' '}
              <Text style={styles.cgvLink} onPress={() => navigation.navigate('Legal', { type: 'cgv' })}>
                CGV
              </Text>{' '}
              et les{' '}
              <Text style={styles.cgvLink} onPress={() => navigation.navigate('Legal', { type: 'cgu' })}>
                CGU
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.ctaBtn, !canSubmit && styles.ctaBtnDisabled]}
            onPress={handleSave}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Continuer</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.primary },
  header: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: SPACING.xxl },
  logoContainer: { width: 80, height: 80, borderRadius: RADIUS.xxl, overflow: 'hidden', marginBottom: SPACING.lg },
  logoImage: { width: 80, height: 80 },
  appName: { fontSize: FONTS.xxxl, fontWeight: FONTS.extrabold, color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  cardWrapper: { flex: 1 },
  card: { flex: 1, backgroundColor: theme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  cardContent: { padding: SPACING.xxl, paddingBottom: 40, gap: SPACING.lg },
  row: { flexDirection: 'row' },
  rowSpacer: { width: SPACING.md },
  inputGroup: { gap: 6 },
  label: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderLight },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: SPACING.lg },
  inputIcon: { marginRight: SPACING.sm },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: FONTS.md, color: theme.textPrimary },
  hint: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 2 },
  ctaBtn: { height: 54, backgroundColor: theme.primary, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.colored },
  ctaBtnDisabled: { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  cgvContainer: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, paddingHorizontal: 4 },
  cgvCheckbox: { marginRight: SPACING.sm, padding: 2 },
  cgvText: { flex: 1, fontSize: FONTS.sm, color: theme.textSecondary, lineHeight: 18 },
  cgvLink: { color: theme.primary, fontWeight: FONTS.semibold, textDecorationLine: 'underline' },
});
