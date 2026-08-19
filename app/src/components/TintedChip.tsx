import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';

interface Props {
  icon?: string;
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}

// Puce teintée réutilisable — reprend le traitement `socialChip` de
// VendeurProfileScreen.tsx (fond teinté 15%, bordure teintée 40%, icône et
// texte dans la couleur de la puce) plutôt que le binaire gris plat.
export default function TintedChip({ icon, label, color, active, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: `${color}15`, borderColor: `${color}40` },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && <Ionicons name={icon as any} size={14} color={active ? '#fff' : color} />}
      <Text style={[styles.text, { color: active ? '#fff' : color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  text: { fontSize: FONTS.sm, fontWeight: FONTS.semibold },
});
