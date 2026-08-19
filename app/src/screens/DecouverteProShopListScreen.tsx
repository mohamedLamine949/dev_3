import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, StatusBar, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useProShopsByMetier, ProShopWithCount } from '../hooks/useDecouvertePro';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - SPACING.lg * 2 - SPACING.md) / 2;

interface Props {
  navigation: any;
  route: any;
}

export default function DecouverteProShopListScreen({ navigation, route }: Props) {
  const { categorieMetier, label } = route.params as { categorieMetier: string; label: string };
  const { theme } = useTheme();
  const { shops, loading } = useProShopsByMetier(categorieMetier);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const renderShop = ({ item, index }: { item: ProShopWithCount; index: number }) => {
    const shopName = item.nom_boutique || `${item.prenom || ''} ${item.nom || ''}`.trim() || 'Boutique';
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, { marginLeft: index % 2 === 0 ? 0 : SPACING.md }]}
        onPress={() => navigation.navigate('Boutique', { vendeurId: item.id })}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.imagePlaceholder]}>
            <Text style={styles.avatarInitial}>{shopName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{shopName}</Text>
          <Text style={styles.cardMeta}>
            {item.nbProduits} produit{item.nbProduits !== 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{label}</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={shops}
        keyExtractor={s => s.id}
        renderItem={renderShop}
        numColumns={2}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          !loading ? (
            <Text style={styles.resultCount}>
              {shops.length} boutique{shops.length !== 1 ? 's' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={44} color={theme.borderLight} />
              <Text style={styles.emptyText}>Aucune boutique dans cette catégorie pour l'instant.</Text>
            </View>
          ) : null
        }
      />
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
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: SPACING.sm, fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  resultCount: { fontSize: FONTS.sm, color: theme.textMuted, marginBottom: SPACING.md, fontWeight: FONTS.semibold },

  card: {
    width: CARD_W, marginBottom: SPACING.lg,
    backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.sm,
  },
  cardImage: { width: '100%', height: CARD_W * 0.8, backgroundColor: theme.surfaceMuted },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: FONTS.bold, color: theme.primary },
  cardInfo: { padding: SPACING.md },
  cardTitle: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary, marginBottom: 3 },
  cardMeta: { fontSize: FONTS.xs, color: theme.textMuted },

  emptyBox: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyText: { fontSize: FONTS.sm, color: theme.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
