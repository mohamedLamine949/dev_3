import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { COUNTRIES, Country, onlyDigits } from '../constants/countries';

interface Props {
  value: Country;
  onChange: (country: Country) => void;
}

/**
 * Sélecteur d'indicatif pays. Affiche un bouton compact (drapeau + indicatif)
 * qui ouvre une liste recherchable de tous les pays. Utilisé à la création de
 * compte pour ne plus figer le +223.
 */
export default function CountryCodePicker({ value, onChange }: Props) {
  const { theme, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const qDigits = onlyDigits(q);
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        (qDigits.length > 0 && c.dial.includes(qDigits))
    );
  }, [query]);

  function select(country: Country) {
    onChange(country);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Indicatif pays : ${value.name} ${value.dial}`}
      >
        <Text style={styles.triggerFlag}>{value.flag}</Text>
        <Text style={styles.triggerDial}>{value.dial}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheet}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Choisir un indicatif</Text>
              <TouchableOpacity onPress={() => setOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={28} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: SPACING.sm }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un pays ou un indicatif…"
                placeholderTextColor={theme.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.iso}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const selected = item.iso === value.iso;
                return (
                  <TouchableOpacity
                    style={[styles.row, selected && styles.rowSelected]}
                    onPress={() => select(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowDial}>{item.dial}</Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} style={{ marginLeft: SPACING.sm }} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>Aucun pays trouvé.</Text>
              }
            />
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingRight: SPACING.sm,
      marginRight: SPACING.sm,
      borderRightWidth: 1,
      borderRightColor: theme.borderLight,
    },
    triggerFlag: { fontSize: FONTS.lg },
    triggerDial: { fontSize: FONTS.md, fontWeight: '700', color: theme.textPrimary },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: RADIUS.xxl,
      borderTopRightRadius: RADIUS.xxl,
      paddingTop: SPACING.xl,
      paddingHorizontal: SPACING.xl,
      paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
      maxHeight: '85%',
      ...SHADOWS.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.lg,
    },
    title: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceMuted,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: FONTS.md, color: theme.textPrimary },
    list: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.md,
    },
    rowSelected: {
      backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : 'rgba(21,128,61,0.06)',
    },
    rowFlag: { fontSize: FONTS.xl, marginRight: SPACING.md },
    rowName: { flex: 1, fontSize: FONTS.md, color: theme.textPrimary },
    rowDial: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },
    empty: { textAlign: 'center', color: theme.textMuted, paddingVertical: SPACING.xl },
  });
