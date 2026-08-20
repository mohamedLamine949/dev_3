import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Choix explicite au moment de publier (§6.2).
 *
 * Avant, un compte professionnel qui appuyait sur « + » était redirigé
 * SILENCIEUSEMENT vers le formulaire produit : il croyait publier une annonce
 * et se retrouvait dans son catalogue, sans que rien ne l'explique. Le §1.4
 * l'interdit — « une action importante ne dépend jamais d'un double appui,
 * d'un appui long ou d'un geste caché » — et le §6.2 impose une feuille
 * d'action nommée.
 *
 * La feuille ne s'ouvre que quand il y a réellement un choix à faire. Un
 * particulier n'a qu'une seule option : lui imposer un écran intermédiaire
 * serait de la friction pure.
 */

export type ChoixPublication = 'annonce' | 'produit' | 'prestation';

interface Option {
  cle: ChoixPublication;
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  detail: string;
}

interface Props {
  visible: boolean;
  options: Option[];
  onChoisir: (cle: ChoixPublication) => void;
  onFermer: () => void;
}

export const OPTION_ANNONCE: Option = {
  cle: 'annonce',
  icone: 'pricetag-outline',
  titre: 'Vendre un objet',
  detail: 'Une annonce visible par tous les acheteurs',
};

export const OPTION_PRESTATION: Option = {
  cle: 'prestation',
  icone: 'construct-outline',
  titre: 'Ajouter une prestation',
  detail: 'Un service que vous proposez, avec ou sans prix fixe',
};

export const OPTION_PRODUIT: Option = {
  cle: 'produit',
  icone: 'storefront-outline',
  titre: 'Ajouter un produit à ma boutique',
  detail: 'Il rejoint votre catalogue et votre vitrine',
};

export default function PublierActionSheet({ visible, options, onChoisir, onFermer }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.overlay} onPress={onFermer} accessibilityLabel="Fermer">
        {/* Le contenu ne doit pas fermer la feuille quand on le touche. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.poignee} />
          <Text style={styles.titre}>Que voulez-vous publier ?</Text>

          {options.map(option => (
            <TouchableOpacity
              key={option.cle}
              style={styles.option}
              onPress={() => onChoisir(option.cle)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={option.titre}
            >
              <View style={styles.optionIcone}>
                <Ionicons name={option.icone} size={24} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitre}>{option.titre}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
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
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
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
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.borderLight,
      alignSelf: 'center',
      marginBottom: SPACING.lg,
    },
    titre: {
      fontSize: FONTS.lg,
      fontWeight: FONTS.bold,
      color: theme.textPrimary,
      marginBottom: SPACING.lg,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: theme.background,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      // Zone tactile confortable (§15.4)
      minHeight: 72,
    },
    optionIcone: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primaryFaded,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionTitre: {
      fontSize: FONTS.md,
      fontWeight: FONTS.bold,
      color: theme.textPrimary,
      marginBottom: 2,
    },
    optionDetail: {
      fontSize: FONTS.xs,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    annuler: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
      minHeight: 48,
      justifyContent: 'center',
    },
    annulerTexte: {
      fontSize: FONTS.md,
      fontWeight: FONTS.semibold,
      color: theme.textSecondary,
    },
  });
