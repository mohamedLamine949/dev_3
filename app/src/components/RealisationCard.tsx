import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import type { Realisation } from '../hooks/useRealisations';

/**
 * Une réalisation, montrée avant / après.
 *
 * Les deux photos sont affichées **côte à côte, étiquetées**, et non
 * superposées avec un curseur à faire glisser. Un curseur est joli mais c'est
 * un geste caché : l'utilisateur qui ne le découvre pas ne voit qu'une moitié
 * du travail. La règle de conception l'interdit, et pour ce public la version
 * évidente vaut mieux que la version élégante.
 *
 * Quand il n'y a pas de photo « avant » — le cas le plus fréquent, personne
 * ne pense à photographier avant de commencer — on montre simplement le
 * résultat en pleine largeur, sans case vide ni point d'interrogation.
 */

interface Props {
  realisation: Realisation;
  /** Affiche un bouton de suppression : réservé au propriétaire. */
  onSupprimer?: () => void;
}

export default function RealisationCard({ realisation, onSupprimer }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const aAvant = !!realisation.image_avant;

  return (
    <View style={styles.carte}>
      <View style={styles.photos}>
        {aAvant && (
          <View style={styles.moitie}>
            <Image source={{ uri: realisation.image_avant! }} style={styles.photo} />
            <View style={styles.etiquette}>
              <Text style={styles.etiquetteTexte}>Avant</Text>
            </View>
          </View>
        )}
        <View style={aAvant ? styles.moitie : styles.pleine}>
          <Image source={{ uri: realisation.image_apres }} style={styles.photo} />
          <View style={[styles.etiquette, styles.etiquetteApres]}>
            <Text style={styles.etiquetteTexte}>Après</Text>
          </View>
        </View>
      </View>

      {(!!realisation.titre || onSupprimer) && (
        <View style={styles.pied}>
          <Text style={styles.titre} numberOfLines={1}>
            {realisation.titre || 'Réalisation'}
          </Text>
          {onSupprimer && (
            <TouchableOpacity
              onPress={onSupprimer}
              activeOpacity={0.8}
              style={styles.supprimer}
              accessibilityRole="button"
              accessibilityLabel="Supprimer cette réalisation"
            >
              <Ionicons name="trash-outline" size={17} color={theme.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    carte: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
      overflow: 'hidden',
      marginBottom: SPACING.md,
    },
    photos: { flexDirection: 'row', gap: 2 },
    moitie: { flex: 1, position: 'relative' },
    pleine: { flex: 1, position: 'relative' },
    photo: { width: '100%', height: 168, backgroundColor: theme.surfaceMuted },
    etiquette: {
      position: 'absolute',
      left: SPACING.sm,
      bottom: SPACING.sm,
      backgroundColor: 'rgba(0,0,0,0.62)',
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    etiquetteApres: { backgroundColor: theme.primary },
    etiquetteTexte: { fontSize: 11, fontWeight: FONTS.extrabold, color: '#fff' },
    pied: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      minHeight: 48,
    },
    titre: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
    supprimer: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center',
    },
  });
