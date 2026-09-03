import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import Gradient from '../components/Gradient';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, METIER_CATEGORIES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useMetierCounts, METIER_AUTRES } from '../hooks/useDecouvertePro';

interface Props {
  navigation: any;
}

export default function DecouverteProScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { counts, loading } = useMetierCounts();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nos Professionnels</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Trouvez le bon prestataire, la bonne boutique</Text>

        {METIER_CATEGORIES.map(cat => {
          const count = counts[cat.id] || 0;
          // « Autres boutiques » n'a de sens que s'il y en a : une tuile vide
          // en permanence serait du bruit, alors que les métiers annoncés
          // (Immobilier, Restaurants…) valent comme invitation même à zéro.
          if (cat.id === METIER_AUTRES && count === 0) return null;
          return (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.88}
              style={styles.tileWrapper}
              onPress={() => navigation.navigate('DecouverteProShopList', { categorieMetier: cat.id, label: cat.label })}
            >
              <Gradient
                colors={cat.gradient as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tile}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={cat.icon as any} size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tileLabel}>{cat.label}</Text>
                  <Text style={styles.tileCount}>
                    {loading ? '…' : `${count} boutique${count !== 1 ? 's' : ''}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
              </Gradient>
            </TouchableOpacity>
          );
        })}

        {/* Fin de la liste : le meilleur moment pour proposer à un visiteur
            qui vient de parcourir tous les métiers de rejoindre lui-même. */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Subscription')}
          style={styles.devenirProCard}
        >
          <View style={styles.devenirProIcon}>
            <Ionicons name="ribbon-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.devenirProTitle}>Vous êtes un professionnel ?</Text>
            <Text style={styles.devenirProSubtitle}>Rejoignez-les et créez votre vitrine</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  subtitle: { fontSize: FONTS.sm, color: theme.textMuted, marginBottom: SPACING.lg },

  tileWrapper: { borderRadius: RADIUS.xl, marginBottom: SPACING.md, ...SHADOWS.md },
  tile: {
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    minHeight: 84,
  },
  tileIcon: {
    width: 44, height: 44, borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  tileLabel: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: '#fff', marginBottom: 2 },
  tileCount: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.85)' },

  devenirProCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: theme.info, borderRadius: RADIUS.xl,
    padding: SPACING.lg, marginTop: SPACING.sm, minHeight: 80,
    ...SHADOWS.md,
  },
  devenirProIcon: {
    width: 44, height: 44, borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  devenirProTitle: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: '#fff' },
  devenirProSubtitle: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
});
