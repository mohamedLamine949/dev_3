import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Les quatre états que tout écran doit savoir montrer (§7.10) :
 * chargement, vide, erreur récupérable, hors connexion.
 *
 * Deux règles portées par ce composant :
 *
 * 1. **Un état vide propose toujours une action réaliste.** « Aucun résultat »
 *    tout seul est une impasse : l'utilisateur ne sait pas quoi faire et
 *    quitte. On lui donne toujours une sortie.
 *
 * 2. **Une erreur explique et permet de réessayer.** Sur une connexion
 *    irrégulière — le cas normal ici — l'échec est fréquent et sans gravité.
 *    Il ne doit ni ressembler à une panne définitive, ni obliger à
 *    recommencer depuis le début.
 *
 * Note : l'application n'embarque pas de détection réseau native, qui
 * exigerait un nouveau build. L'état « hors connexion » se déduit donc de
 * l'échec d'une requête, ce qui suffit pour le message à afficher.
 */

type Variante = 'chargement' | 'vide' | 'erreur' | 'hors_ligne';

interface Props {
  variante: Variante;
  titre?: string;
  message?: string;
  /** Libellé du bouton. Sans `onAction`, aucun bouton n'est affiché. */
  actionLabel?: string;
  onAction?: () => void;
  /** Icône de l'état vide ; les autres variantes ont la leur. */
  icone?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
}

const DEFAUTS: Record<Variante, {
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  message: string;
  action: string;
}> = {
  chargement: {
    icone: 'hourglass-outline',
    titre: 'Chargement…',
    message: '',
    action: '',
  },
  vide: {
    icone: 'file-tray-outline',
    titre: 'Rien à afficher',
    message: "Il n'y a encore rien ici.",
    action: '',
  },
  erreur: {
    icone: 'alert-circle-outline',
    titre: 'Ça n’a pas fonctionné',
    message: "Une erreur s'est produite. Vos informations n'ont pas été perdues.",
    action: 'Réessayer',
  },
  hors_ligne: {
    icone: 'cloud-offline-outline',
    titre: 'Pas de connexion',
    message: "Vérifiez votre connexion internet. Ce que vous avez saisi est conservé.",
    action: 'Réessayer',
  },
};

export default function EtatEcran({
  variante,
  titre,
  message,
  actionLabel,
  onAction,
  icone,
  compact = false,
}: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, compact), [theme, compact]);
  const d = DEFAUTS[variante];

  const estProbleme = variante === 'erreur' || variante === 'hors_ligne';
  const couleur = estProbleme ? theme.error : theme.textMuted;

  return (
    <View style={styles.bloc} accessibilityRole="summary">
      <View style={[styles.cercle, estProbleme && { backgroundColor: theme.error + '15' }]}>
        {variante === 'chargement' ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <Ionicons name={icone || d.icone} size={compact ? 26 : 32} color={couleur} />
        )}
      </View>

      <Text style={styles.titre}>{titre || d.titre}</Text>

      {(message || d.message) !== '' && (
        <Text style={styles.message}>{message || d.message}</Text>
      )}

      {onAction && (
        <TouchableOpacity
          style={styles.bouton}
          onPress={onAction}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.boutonTexte}>{actionLabel || d.action || 'Continuer'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (theme: any, compact: boolean) =>
  StyleSheet.create({
    bloc: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: compact ? SPACING.xl : SPACING.xxxl,
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.md,
    },
    cercle: {
      width: compact ? 56 : 72,
      height: compact ? 56 : 72,
      borderRadius: compact ? 28 : 36,
      backgroundColor: theme.surfaceMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    titre: {
      fontSize: compact ? FONTS.md : FONTS.lg,
      fontWeight: FONTS.bold,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    message: {
      fontSize: FONTS.sm,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 320,
    },
    bouton: {
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.xxl,
      minHeight: 46,
      justifyContent: 'center',
      borderRadius: RADIUS.lg,
      backgroundColor: theme.primary,
    },
    boutonTexte: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },
  });
