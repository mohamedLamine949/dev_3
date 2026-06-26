import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, StatusBar, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useFavorisAnnonces, toggleFavori } from '../hooks/useFavoris';

import { useTheme } from '../contexts/ThemeContext';

function formatPrix(prix: number): string {
  if (prix >= 1000000) return (prix / 1000000).toFixed(1) + 'M FCFA';
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

export default function FavorisScreen({ navigation }: any) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const { annonces, loading, refetch } = useFavorisAnnonces(session?.user?.id);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const handleRemove = async (annonceId: string) => {
    if (!session) return;
    await toggleFavori(session.user.id, annonceId);
    refetch();
  };

  const renderItem = ({ item }: { item: any }) => {
    const imageUrl = item.images?.[0]?.image_url || null;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={styles.image} />
          : <View style={[styles.image, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={22} color={theme.borderLight} />
            </View>
        }
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.titre}</Text>
          <Text style={styles.price}>{formatPrix(item.prix)}</Text>
          <Text style={styles.location} numberOfLines={1}>
            {item.quartier ? `${item.quartier}, ` : ''}{item.ville}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemove(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="heart" size={22} color={theme.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.surface} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <View style={{ width: 40 }} />
      </View>

      {!session ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={48} color={theme.borderLight} />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptyText}>Connectez-vous pour sauvegarder des annonces.</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={annonces}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={48} color={theme.borderLight} />
              <Text style={styles.emptyTitle}>Aucun favori</Text>
              <Text style={styles.emptyText}>Appuyez sur ❤ sur une annonce pour la sauvegarder.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  list: { padding: SPACING.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row', backgroundColor: theme.surface,
    borderRadius: RADIUS.lg, padding: SPACING.sm,
    marginBottom: SPACING.md, alignItems: 'center',
    ...SHADOWS.sm,
  },
  image: { width: 68, height: 68, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted },
  info: { flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm },
  title: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary, marginBottom: 3 },
  price: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.primary, marginBottom: 2 },
  location: { fontSize: FONTS.xs, color: theme.textMuted },
  removeButton: { padding: SPACING.sm },
  emptyContainer: {
    flex: 1, paddingVertical: 100, alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
  },
  emptyTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  emptyText: { fontSize: FONTS.sm, color: theme.textMuted, textAlign: 'center', maxWidth: 260 },
  loginBtn: {
    marginTop: SPACING.sm, backgroundColor: theme.primary,
    paddingHorizontal: SPACING.xxl, paddingVertical: 12, borderRadius: RADIUS.full,
  },
  loginBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: FONTS.md },
});
