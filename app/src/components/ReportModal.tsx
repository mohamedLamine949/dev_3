import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface ReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  annonceId?: string;
  cibleUserId?: string;
  targetName: string; // e.g. the ad title or the user's name
}

/**
 * Motifs de signalement (§16.4). Le `code` n'est pas cosmetique : il fixe la
 * priorite de traitement dans la file de moderation. Une fraude et un danger
 * passent devant un doublon.
 */
const MOTIFS = [
  { code: 'fraude',           label: 'Fraude ou arnaque' },
  { code: 'danger',           label: 'Danger pour les personnes' },
  { code: 'contenu_interdit', label: 'Contenu interdit ou choquant' },
  { code: 'harcelement',      label: 'Harcèlement' },
  { code: 'doublon',          label: 'Annonce en double' },
  { code: 'info_incorrecte',  label: 'Information incorrecte' },
] as const;

export default function ReportModal({
  isVisible,
  onClose,
  annonceId,
  cibleUserId,
  targetName,
}: ReportModalProps) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const [selectedMotif, setSelectedMotif] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedMotif) {
      Alert.alert('Motif requis', 'Veuillez sélectionner un motif de signalement.');
      return;
    }

    try {
      setSubmitting(true);

      const motif = MOTIFS.find(m => m.code === selectedMotif);
      const reportData = {
        signataire_id: session?.user?.id || null, // peut être anonyme si non connecté, ou lié
        annonce_id: annonceId || null,
        cible_user_id: cibleUserId || null,
        // Cible explicite : la file de moderation traite annonces, profils,
        // boutiques, messages et avis dans une seule liste (§16.4).
        cible_type: annonceId ? 'annonce' : 'profil',
        cible_id: annonceId || cibleUserId || null,
        motif_code: selectedMotif,
        motif: motif?.label || selectedMotif,
        details: details.trim() || null,
      };

      let { error } = await supabase.from('signalements').insert(reportData);

      // Repli : tant que la migration de moderation n'est pas appliquee, les
      // colonnes cible_type / cible_id / motif_code n'existent pas. Un
      // signalement qui echoue est pire qu'inutile — l'utilisateur croit avoir
      // alerte alors que rien n'est parti. On reessaie donc au format ancien.
      if (error) {
        const { cible_type, cible_id, motif_code, ...ancienFormat } = reportData as any;
        const secondEssai = await supabase.from('signalements').insert(ancienFormat);
        error = secondEssai.error;
      }

      if (error) throw error;

      Alert.alert(
        'Signalement envoyé',
        'Merci pour votre signalement. Notre équipe de modération va examiner le contenu et prendre les mesures nécessaires.'
      );
      
      // Reset form and close
      setSelectedMotif(null);
      setDetails('');
      onClose();
    } catch (error: any) {
      console.error('Erreur lors du signalement:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'envoyer le signalement. Veuillez réessayer.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const styles = React.useMemo(() => {
    return StyleSheet.create({
      overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
      },
      content: {
        backgroundColor: theme.surface,
        borderTopLeftRadius: RADIUS.xxl,
        borderTopRightRadius: RADIUS.xxl,
        padding: SPACING.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
        maxHeight: '90%',
        ...SHADOWS.lg,
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.lg,
      },
      title: {
        fontSize: FONTS.lg,
        fontWeight: FONTS.bold,
        color: theme.textPrimary,
        flex: 1,
      },
      subtitle: {
        fontSize: 13,
        color: theme.textSecondary,
        marginBottom: SPACING.lg,
      },
      sectionTitle: {
        fontSize: 12,
        fontWeight: FONTS.bold,
        color: theme.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.md,
      },
      motifList: {
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
      },
      motifButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        backgroundColor: theme.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.borderLight,
      },
      motifButtonSelected: {
        borderColor: theme.primary,
        backgroundColor: isDark ? 'rgba(22, 163, 74, 0.1)' : 'rgba(21, 128, 61, 0.05)',
      },
      motifText: {
        fontSize: FONTS.md,
        color: theme.textPrimary,
      },
      motifTextSelected: {
        fontWeight: FONTS.semibold,
        color: theme.primary,
      },
      input: {
        backgroundColor: theme.surfaceMuted,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        fontSize: FONTS.md,
        color: theme.textPrimary,
        borderWidth: 1,
        borderColor: theme.borderLight,
        height: 80,
        textAlignVertical: 'top',
        marginBottom: SPACING.xl,
      },
      submitButton: {
        backgroundColor: theme.error,
        borderRadius: RADIUS.lg,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: SPACING.sm,
      },
      submitButtonText: {
        color: '#fff',
        fontSize: FONTS.md,
        fontWeight: FONTS.bold,
      },
    });
  }, [theme, isDark]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {annonceId ? 'Signaler l\'annonce' : 'Signaler le vendeur'}
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={28} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle} numberOfLines={2}>
              Cible : <Text style={{ fontWeight: 'bold' }}>{targetName}</Text>
            </Text>

            {/* Motifs */}
            <Text style={styles.sectionTitle}>Motif du signalement *</Text>
            <View style={styles.motifList}>
              {MOTIFS.map((m) => {
                const motif = m.label;
                const isSelected = selectedMotif === m.code;
                return (
                  <TouchableOpacity
                    key={m.code}
                    style={[styles.motifButton, isSelected && styles.motifButtonSelected]}
                    onPress={() => setSelectedMotif(m.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.motifText, isSelected && styles.motifTextSelected]}>
                      {motif}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Details */}
            <Text style={styles.sectionTitle}>Détails supplémentaires (facultatif)</Text>
            <TextInput
              style={styles.input}
              placeholder="Précisez votre signalement..."
              placeholderTextColor={theme.textMuted}
              multiline
              value={details}
              onChangeText={setDetails}
              maxLength={300}
            />

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="alert-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Envoyer le signalement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
