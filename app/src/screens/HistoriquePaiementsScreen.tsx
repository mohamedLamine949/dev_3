import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useHistoriqueVentes, Vente } from '../hooks/useHistoriqueVentes';

function formatPrix(prix: number): string {
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoriquePaiementsScreen({ navigation }: any) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const { ventes, total, loading, refetch } = useHistoriqueVentes(session?.user?.id);
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const renderItem = ({ item }: { item: Vente }) => {
    const acheteurNom = item.acheteur
      ? `${item.acheteur.prenom || ''} ${item.acheteur.nom || ''}`.trim() || 'Client'
      : 'Client';
    return (
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="cube-outline" size={18} color="#0369a1" />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.produit_titre}</Text>
          <Text style={styles.acheteurText}>{acheteurNom}{item.quantite > 1 ? ` · ×${item.quantite}` : ''}</Text>
          <Text style={styles.dateText}>{formatDate(item.date_creation)}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amountText}>+{formatPrix(item.prix * item.quantite)}</Text>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#0369a1" />
            <Text style={styles.successText}>Livrée</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des ventes</Text>
        <TouchableOpacity onPress={refetch} style={styles.backButton} activeOpacity={0.8}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {!loading && ventes.length > 0 && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total des ventes livrées</Text>
          <Text style={styles.totalValue}>{formatPrix(total)}</Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : ventes.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}>
          <Ionicons name="receipt-outline" size={60} color={theme.textMuted} style={{ marginBottom: SPACING.md }} />
          <Text style={{ fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', fontWeight: FONTS.medium }}>
            Aucune vente livrée pour l'instant.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ventes}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={refetch}
        />
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },

  totalCard: {
    margin: SPACING.lg, marginBottom: 0,
    backgroundColor: theme.primaryFaded, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: theme.primary,
    padding: SPACING.lg,
  },
  totalLabel: { fontSize: FONTS.xs, color: theme.textSecondary, fontWeight: FONTS.semibold, marginBottom: 2 },
  totalValue: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.primary },

  list: { padding: SPACING.lg },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0f2fe',
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, marginLeft: SPACING.md, justifyContent: 'center' },
  title: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary, marginBottom: 2 },
  acheteurText: { fontSize: 11, color: theme.textSecondary, marginBottom: 2 },
  dateText: { fontSize: 11, color: theme.textMuted },
  amountContainer: { alignItems: 'flex-end', justifyContent: 'center' },
  amountText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary, marginBottom: 4 },
  successBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs, backgroundColor: '#e0f2fe',
  },
  successText: { fontSize: 9, fontWeight: FONTS.bold, color: '#0369a1' },
});
