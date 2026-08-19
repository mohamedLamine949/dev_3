import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { Annonce } from '../lib/supabase';

interface Props {
  produit: Annonce | null;
  onClose: () => void;
  onUpdate: (id: string, patch: { stock?: number; visible?: boolean }) => void;
  onEdit: (produit: Annonce) => void;
  theme: any;
}

// Feuille de gestion d'un produit du catalogue — ouverte au tap sur la
// carte, regroupe stock/visibilité/édition au lieu de tout entasser dans
// la carte elle-même (touch targets trop petits sur une grille 2 colonnes).
export default function ProduitGestionSheet({ produit, onClose, onUpdate, onEdit, theme }: Props) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [stockText, setStockText] = useState('');

  if (!produit) return null;
  const masque = produit.visible === false;
  const img = produit.images && produit.images.length > 0
    ? [...produit.images].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))[0].image_url
    : null;

  return (
    <Modal visible={!!produit} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.head}>
            {img ? (
              <Image source={{ uri: img }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Ionicons name="image-outline" size={20} color={theme.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.titre} numberOfLines={2}>{produit.titre}</Text>
              <Text style={styles.prix}>{Number(produit.prix).toLocaleString('fr-FR')} FCFA</Text>
            </View>
          </View>

          <Text style={styles.label}>Stock</Text>
          <View style={styles.stockRow}>
            <TouchableOpacity
              style={styles.stockBtn}
              onPress={() => onUpdate(produit.id, { stock: Math.max(0, (produit.stock ?? 1) - 1) })}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <TextInput
              key={`stock-${produit.id}-${produit.stock ?? 'n'}`}
              style={styles.stockInput}
              defaultValue={produit.stock != null ? String(produit.stock) : ''}
              placeholder="—"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              selectTextOnFocus
              onChangeText={setStockText}
              onEndEditing={(e) => {
                const v = parseInt(e.nativeEvent.text.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(v) && v !== produit.stock) onUpdate(produit.id, { stock: v });
              }}
            />
            <TouchableOpacity
              style={styles.stockBtn}
              onPress={() => onUpdate(produit.id, { stock: (produit.stock ?? 0) + 1 })}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.visibleRow}>
            <Ionicons name={masque ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textSecondary} />
            <Text style={styles.visibleLabel}>{masque ? 'Masqué dans la boutique' : 'Visible dans la boutique'}</Text>
            <Switch
              value={!masque}
              onValueChange={(v) => onUpdate(produit.id, { visible: v })}
              trackColor={{ false: theme.borderLight, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(produit)} activeOpacity={0.85}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.editBtnText}>Modifier la fiche</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border,
    alignSelf: 'center', marginBottom: SPACING.lg,
  },
  head: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  thumb: { width: 64, height: 64, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted },
  thumbFallback: { justifyContent: 'center', alignItems: 'center' },
  titre: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary, marginBottom: 4 },
  prix: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.primary },
  label: {
    fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm,
  },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  stockBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  stockInput: {
    flex: 1, height: 44, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted,
    textAlign: 'center', fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary,
  },
  visibleRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: theme.borderLight,
    marginBottom: SPACING.lg,
  },
  visibleLabel: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, fontWeight: FONTS.medium },
  editBtn: {
    flexDirection: 'row', gap: 8, backgroundColor: theme.primary, borderRadius: RADIUS.lg,
    paddingVertical: 14, justifyContent: 'center', alignItems: 'center', ...SHADOWS.sm,
  },
  editBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
