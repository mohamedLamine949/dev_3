import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useFavorisAnnonces, toggleFavori } from '../hooks/useFavoris';

function formatPrix(prix: number): string {
  if (prix >= 1000000) return (prix / 1000000).toFixed(1) + 'M FCFA';
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

export default function FavorisScreen({ navigation }: any) {
  const { session } = useAuth();
  const { annonces, loading, refetch } = useFavorisAnnonces(session?.user?.id);

  const handleRemove = async (annonceId: string) => {
    if (!session) return;
    await toggleFavori(session.user.id, annonceId);
    refetch();
  };

  const renderItem = ({ item }: { item: any }) => {
    const imageUrl = item.images?.[0]?.image_url || `https://picsum.photos/seed/${item.id}/200/200`;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
      >
        <Image source={{ uri: imageUrl }} style={styles.image} />
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
          <Ionicons name="heart" size={22} color={COLORS.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <View style={{ width: 40 }} />
      </View>

      {!session ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={48} color={COLORS.border} />
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
          <ActivityIndicator size="large" color={COLORS.primary} />
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
              <Ionicons name="heart-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>Aucun favori</Text>
              <Text style={styles.emptyText}>Appuyez sur ❤ sur une annonce pour la sauvegarder.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary },
  list: { padding: SPACING.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.sm,
    marginBottom: SPACING.md, alignItems: 'center',
    ...SHADOWS.sm,
  },
  image: { width: 68, height: 68, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceMuted },
  info: { flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm },
  title: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 3 },
  price: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 2 },
  location: { fontSize: FONTS.xs, color: COLORS.textMuted },
  removeButton: { padding: SPACING.sm },
  emptyContainer: {
    flex: 1, paddingVertical: 100, alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
  },
  emptyTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: COLORS.textPrimary },
  emptyText: { fontSize: FONTS.sm, color: COLORS.textMuted, textAlign: 'center', maxWidth: 260 },
  loginBtn: {
    marginTop: SPACING.sm, backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl, paddingVertical: 12, borderRadius: RADIUS.full,
  },
  loginBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: FONTS.md },
});
