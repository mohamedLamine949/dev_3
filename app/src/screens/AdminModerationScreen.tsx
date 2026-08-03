import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  StatusBar, Platform, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { supabase } from '../lib/supabase';

type CampagneStatut = 'en_revue' | 'approuvee' | 'rejetee';

interface ModRow {
  annonce_id: string;
  titre: string;
  description: string | null;
  prix: number;
  categorie: string;
  ville: string | null;
  quartier: string | null;
  date_creation: string;
  campagne_statut: CampagneStatut;
  campagne_raison: string | null;
  user_id: string;
  prenom: string | null;
  nom: string | null;
  num_telephone: string | null;
  role: 'parrain' | 'filleul';
  nb_images: number;
  image_principale: string | null;
  device_partage: boolean;
}

const FILTRES: { key: CampagneStatut | 'toutes'; label: string }[] = [
  { key: 'en_revue', label: 'À revoir' },
  { key: 'approuvee', label: 'Approuvées' },
  { key: 'rejetee', label: 'Rejetées' },
  { key: 'toutes', label: 'Toutes' },
];

interface Props { navigation: any; }

export default function AdminModerationScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const { isAdmin, loading: adminLoading } = useIsAdmin(session?.user?.id);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [rows, setRows] = useState<ModRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<CampagneStatut | 'toutes'>('en_revue');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('v_moderation_campagne').select('*');
    if (filtre !== 'toutes') q = q.eq('campagne_statut', filtre);
    const { data, error } = await q;
    if (error) {
      console.error('[Moderation] load error:', error);
      Alert.alert('Erreur', error.message);
    }
    setRows((data as ModRow[]) || []);
    setLoading(false);
  }, [filtre]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const runAction = async (
    row: ModRow,
    rpc: 'moderer_annonce_campagne' | 'supprimer_annonce_campagne',
    params: Record<string, any>,
  ) => {
    setBusyId(row.annonce_id);
    const { data, error } = await supabase.rpc(rpc, params);
    setBusyId(null);
    if (error || (data && data.ok === false)) {
      Alert.alert('Erreur', error?.message || data?.message || "Action impossible.");
      return;
    }
    load();
  };

  const approuver = (row: ModRow) =>
    runAction(row, 'moderer_annonce_campagne', { p_annonce_id: row.annonce_id, p_decision: 'approuvee' });

  const rejeter = (row: ModRow) =>
    Alert.alert('Rejeter cette annonce ?', "Elle ne comptera pas pour la campagne. Le cycle éventuellement validé par cette annonce sera annulé.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Rejeter', style: 'destructive', onPress: () => runAction(row, 'moderer_annonce_campagne', { p_annonce_id: row.annonce_id, p_decision: 'rejetee' }) },
    ]);

  const supprimer = (row: ModRow) =>
    Alert.alert('Supprimer définitivement ?', "L'annonce sera effacée et le cycle correspondant annulé. Action irréversible.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => runAction(row, 'supprimer_annonce_campagne', { p_annonce_id: row.annonce_id }) },
    ]);

  // -- Gardes d'accès --------------------------------------------------
  if (adminLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center, { padding: SPACING.xxl }]}>
        <Ionicons name="lock-closed-outline" size={48} color={theme.textMuted} />
        <Text style={{ marginTop: SPACING.lg, fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center' }}>
          Accès réservé aux administrateurs.
        </Text>
        <TouchableOpacity style={{ marginTop: SPACING.xl }} onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.primary, fontWeight: FONTS.bold }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderCard = ({ item }: { item: ModRow }) => {
    const nom = `${item.prenom || ''} ${item.nom || ''}`.trim() || 'Utilisateur';
    const statutColor = item.campagne_statut === 'approuvee' ? theme.success : item.campagne_statut === 'rejetee' ? theme.error : theme.primary;
    const statutLabel = item.campagne_statut === 'approuvee' ? 'Approuvée' : item.campagne_statut === 'rejetee' ? 'Rejetée' : 'À revoir';
    const busy = busyId === item.annonce_id;

    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          {item.image_principale ? (
            <Image source={{ uri: item.image_principale }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="image-outline" size={24} color={theme.textMuted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.titre} numberOfLines={1}>{item.titre}</Text>
            <Text style={styles.prix}>{item.prix?.toLocaleString('fr-FR')} FCFA</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <View style={[styles.roleChip, { backgroundColor: item.role === 'parrain' ? theme.primaryFaded : theme.surfaceMuted }]}>
                <Text style={[styles.roleText, { color: item.role === 'parrain' ? theme.primary : theme.textSecondary }]}>
                  {item.role === 'parrain' ? 'Parrain' : 'Filleul'}
                </Text>
              </View>
              <Text style={styles.auteur} numberOfLines={1}>{nom}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.statutBadge, { backgroundColor: statutColor }]}>
                <Text style={styles.statutText}>{statutLabel}</Text>
              </View>
              {item.nb_images === 0 && (
                <Text style={styles.warn}>⚠ aucune photo</Text>
              )}
            </View>
          </View>
        </View>

        {item.device_partage && (
          <View style={styles.fraudFlag}>
            <Ionicons name="warning" size={16} color="#fff" />
            <Text style={styles.fraudText}>Appareil partagé avec le réseau de parrainage — vérifier fraude</Text>
          </View>
        )}

        {item.description ? (
          <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        {busy ? (
          <View style={{ paddingVertical: SPACING.md, alignItems: 'center' }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <View style={styles.actions}>
            {item.campagne_statut !== 'approuvee' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.success }]} onPress={() => approuver(item)}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.actionText}>Approuver</Text>
              </TouchableOpacity>
            )}
            {item.campagne_statut !== 'rejetee' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.error }]} onPress={() => rejeter(item)}>
                <Ionicons name="close" size={18} color={theme.error} />
                <Text style={[styles.actionText, { color: theme.error }]}>Rejeter</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.error }]} onPress={() => supprimer(item)}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modération campagne</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filters}>
        {FILTRES.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filtre === f.key && styles.filterChipActive]}
            onPress={() => setFiltre(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, filtre === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.annonce_id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={[styles.center, { paddingTop: 80 }]}>
              <Ionicons name="checkmark-done-outline" size={48} color={theme.textMuted} />
              <Text style={{ marginTop: SPACING.md, color: theme.textSecondary }}>Aucune annonce dans ce filtre.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  filters: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: theme.surfaceMuted },
  filterChipActive: { backgroundColor: theme.primary },
  filterText: { fontSize: FONTS.sm, fontWeight: FONTS.medium, color: theme.textSecondary },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: theme.borderLight, ...SHADOWS.sm },
  thumb: { width: 72, height: 72, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted },
  thumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  titre: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  prix: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary, marginTop: 2 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 8 },
  roleText: { fontSize: 10, fontWeight: FONTS.bold },
  auteur: { flex: 1, fontSize: FONTS.xs, color: theme.textSecondary },
  statutBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statutText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  warn: { fontSize: FONTS.xs, color: theme.error },
  fraudFlag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.error, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 6, marginTop: SPACING.md },
  fraudText: { flex: 1, fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: '#fff' },
  desc: { fontSize: FONTS.xs, color: theme.textSecondary, marginTop: SPACING.sm, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: RADIUS.md },
  actionText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },
});
