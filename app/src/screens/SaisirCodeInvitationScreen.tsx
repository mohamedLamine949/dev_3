import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Gradient from '../components/Gradient';
import { FONTS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { saisirCodeInvitation } from '../hooks/useInvitations';
import { hapticLight } from '../lib/haptics';

/**
 * Saisie du code de parrainage, proposée juste après l'inscription.
 *
 * Toujours facultative et toujours passable : quelqu'un qui n'a pas de code
 * ne doit pas rester bloqué à l'entrée de l'application. C'est aussi
 * pourquoi un code refusé n'empêche jamais d'avancer.
 */
export default function SaisirCodeInvitationScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const depuisInscription = route?.params?.fromSignup === true;

  const [code, setCode] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const continuer = () => {
    if (depuisInscription) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      navigation.goBack();
    }
  };

  const valider = async () => {
    if (code.trim().length < 4) return;
    hapticLight();
    setEnvoi(true);
    const reponse = await saisirCodeInvitation(code.trim().toUpperCase());
    setEnvoi(false);

    if (!reponse.ok) {
      Alert.alert('Code non accepté', reponse.message);
      return;
    }
    Alert.alert('C\'est bon !', reponse.message, [{ text: 'Continuer', onPress: continuer }]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.ecran}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.contenu, { paddingTop: insets.top + SPACING.xl }]}>
        <View style={styles.icone}>
          <Ionicons name="gift" size={36} color={theme.primary} />
        </View>

        <Text style={styles.titre}>Quelqu'un vous a invité ?</Text>
        <Text style={styles.texte}>
          Saisissez son code. Quand vous publierez votre première annonce, cette
          personne recevra un boost gratuit.
        </Text>

        <TextInput
          style={styles.champ}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={valider}
        />

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={valider}
          disabled={envoi || code.trim().length < 4}
          style={{ width: '100%', opacity: code.trim().length < 4 ? 0.5 : 1 }}
        >
          <Gradient
            colors={['#0b4023', '#15803d', '#1f9450']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bouton}
          >
            {envoi
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.boutonTexte}>Valider le code</Text>}
          </Gradient>
        </TouchableOpacity>

        {/* Zone tactile large, jamais grisée : la sortie doit être aussi
            facile que l'entrée. */}
        <TouchableOpacity onPress={continuer} style={styles.passerZone} activeOpacity={0.7}>
          <Text style={styles.passer}>
            {depuisInscription ? "Je n'ai pas de code" : 'Annuler'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: theme.background },
  contenu: { flex: 1, paddingHorizontal: SPACING.xl, alignItems: 'center' },
  icone: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: theme.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  titre: { ...TYPOGRAPHY.h2, color: theme.textPrimary, textAlign: 'center' },
  texte: {
    fontSize: FONTS.md,
    lineHeight: 22,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  champ: {
    width: '100%',
    height: 64,
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: theme.borderLight,
    backgroundColor: theme.surface,
    color: theme.textPrimary,
    fontSize: 26,
    fontWeight: FONTS.bold,
    letterSpacing: 6,
    textAlign: 'center',
  },
  bouton: {
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonTexte: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  passerZone: { paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  passer: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textMuted },
});
