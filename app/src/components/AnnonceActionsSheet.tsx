import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Feuille d'actions sur une annonce (renouveler, marquer vendu, supprimer).
 *
 * Pourquoi ce composant plutôt qu'un `Alert.alert` :
 * la gestion d'une annonce passait par une alerte système à cinq boutons.
 * **Android n'en affiche que trois** — au-delà, React Native les ignore
 * silencieusement. Selon les cas, « Supprimer » ou « Marquer comme vendu »
 * n'apparaissaient donc jamais, et l'alerte ne s'ouvrait elle-même que sur un
 * appui long ou une icône « … » de 20 px. Le §1.4 l'interdit : « une action
 * importante ne dépend jamais d'un double appui, d'un appui long ou d'un
 * geste caché ».
 *
 * Ici : options écrites en toutes lettres, expliquées, hauteur tactile
 * confortable, sans limite de nombre.
 */

export interface ActionAnnonce {
  cle: string;
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  detail: string;
  /** Rouge, et placée en dernier : suppression. */
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  titreAnnonce?: string;
  actions: ActionAnnonce[];
  onChoisir: (cle: string) => void;
  onFermer: () => void;
}

export default function AnnonceActionsSheet({ visible, titreAnnonce, actions, onChoisir, onFermer }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.overlay} onPress={onFermer} accessibilityLabel="Fermer">
        {/* Le contenu ne doit pas fermer la feuille quand on le touche. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.poignee} />
          <Text style={styles.titre} numberOfLines={1}>
            {titreAnnonce || 'Gérer l\'annonce'}
          </Text>

          {actions.map(action => (
            <TouchableOpacity
              key={action.cle}
              style={[styles.option, action.destructive && styles.optionDestructive]}
              onPress={() => onChoisir(action.cle)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={action.titre}
            >
              <View style={[styles.optionIcone, action.destructive && styles.optionIconeDestructive]}>
                <Ionicons
                  name={action.icone}
                  size={24}
                  color={action.destructive ? theme.error : theme.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitre, action.destructive && { color: theme.error }]}>
                  {action.titre}
                </Text>
                <Text style={styles.optionDetail}>{action.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.annuler} onPress={onFermer} activeOpacity={0.7}>
            <Text style={styles.annulerTexte}>Annuler</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xxl,
      ...SHADOWS.lg,
    },
    poignee: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.borderLight,
      alignSelf: 'center', marginBottom: SPACING.lg,
    },
    titre: {
      fontSize: FONTS.lg, fontWeight: FONTS.bold,
      color: theme.textPrimary, marginBottom: SPACING.lg,
    },
    option: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      backgroundColor: theme.background,
      borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: theme.borderLight,
      padding: SPACING.lg, marginBottom: SPACING.md,
      // Zone tactile confortable (§15.4)
      minHeight: 72,
    },
    optionDestructive: { borderColor: theme.error },
    optionIcone: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: theme.primaryFaded,
      justifyContent: 'center', alignItems: 'center',
    },
    optionIconeDestructive: { backgroundColor: 'rgba(231, 76, 60, 0.12)' },
    optionTitre: {
      fontSize: FONTS.md, fontWeight: FONTS.bold,
      color: theme.textPrimary, marginBottom: 2,
    },
    optionDetail: { fontSize: FONTS.xs, color: theme.textSecondary, lineHeight: 17 },
    annuler: {
      alignItems: 'center', paddingVertical: SPACING.md,
      minHeight: 48, justifyContent: 'center',
    },
    annulerTexte: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },
  });
