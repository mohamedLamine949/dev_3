import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, CATEGORY_PRICES } from '../constants/theme';
import { supabase, Annonce } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

function formatPrix(prix: number): string {
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoriquePaiementsScreen({ navigation }: any) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const [transactions, setTransactions] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('annonces')
        .select('*, images:images_annonce(image_url, ordre)')
        .eq('user_id', session.user.id)
        .eq('est_payee', true)
        .order('date_creation', { ascending: false });

      if (error) throw error;
      setTransactions((data as Annonce[]) || []);
    } catch (err) {
      console.error('Erreur fetchTransactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [session?.user?.id]);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const renderItem = ({ item }: { item: Annonce }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    const fee = (item as any).montant_depot || CATEGORY_PRICES[item.categorie] || 250;

    return (
      <View style={styles.card}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image-outline" size={24} color={theme.borderLight} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.titre}</Text>
          <Text style={styles.refText}>Réf: {item.id_transaction_paiement || 'N/A'}</Text>
          <Text style={styles.dateText}>{formatDate(item.date_creation)}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amountText}>-{formatPrix(fee)}</Text>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={12} color={theme.success} />
            <Text style={styles.successText}>Succès</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des Paiements</Text>
        <TouchableOpacity onPress={fetchTransactions} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}>
          <Ionicons name="receipt-outline" size={60} color={theme.textMuted} style={{ marginBottom: SPACING.md }} />
          <Text style={{ fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', fontWeight: FONTS.medium }}>
            Aucun historique de paiement disponible.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchTransactions}
        />
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  backButton: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center'
  },
  headerTitle: {
    fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary
  },
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
  image: {
    width: 54, height: 54, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted
  },
  info: {
    flex: 1, marginLeft: SPACING.md, justifyContent: 'center'
  },
  title: {
    fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary, marginBottom: 2
  },
  refText: {
    fontSize: 10, color: theme.textMuted, marginBottom: 2
  },
  dateText: {
    fontSize: 11, color: theme.textSecondary
  },
  amountContainer: {
    alignItems: 'flex-end', justifyContent: 'center'
  },
  amountText: {
    fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.error, marginBottom: 4
  },
  successBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs, backgroundColor: 'rgba(0, 184, 148, 0.1)'
  },
  successText: {
    fontSize: 9, fontWeight: FONTS.bold, color: theme.success
  }
});
