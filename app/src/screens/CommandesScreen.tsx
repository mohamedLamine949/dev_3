import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  Platform, Alert, ActivityIndicator, Linking, Modal, TextInput,
  KeyboardAvoidingView, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase, Commande, CommandeStatut } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  navigation: any;
  route: any;
}

const STATUT_META: Record<CommandeStatut, { label: string; color: string; bg: string; icon: string }> = {
  nouvelle: { label: 'Nouvelle', color: '#d97706', bg: '#fef3c7', icon: 'sparkles-outline' },
  confirmee: { label: 'Confirmée', color: '#15803d', bg: '#dcfce7', icon: 'checkmark-circle-outline' },
  livree: { label: 'Livrée', color: '#0369a1', bg: '#e0f2fe', icon: 'cube-outline' },
  refusee: { label: 'Refusée', color: '#dc2626', bg: '#fee2e2', icon: 'close-circle-outline' },
  annulee: { label: 'Annulée', color: '#6b7280', bg: '#f3f4f6', icon: 'ban-outline' },
};

const FILTRES_VENDEUR = [
  { key: 'nouvelle', label: 'Nouvelles' },
  { key: 'confirmee', label: 'En cours' },
  { key: 'all', label: 'Toutes' },
] as const;

const REPONSE_DEFAUT = 'Commande bien reçue ✅ Nous vous contactons pour organiser la remise.';

/**
 * Gestion des commandes de boutique.
 * mode 'vendeur' : les commandes reçues, triées par statut, avec réponse,
 *   confirmation, refus, livraison, appel du client.
 * mode 'client' : le suivi de ses commandes passées, annulation, discussion.
 */
export default function CommandesScreen({ navigation, route }: Props) {
  const mode: 'vendeur' | 'client' = route.params?.mode === 'client' ? 'client' : 'vendeur';
  const { theme, isDark } = useTheme();
  const { session } = useAuth();

  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre] = useState<string>(mode === 'vendeur' ? 'nouvelle' : 'all');

  // Modal de confirmation (réponse du vendeur)
  const [reponseTarget, setReponseTarget] = useState<Commande | null>(null);
  const [reponseText, setReponseText] = useState(REPONSE_DEFAUT);
  const [sending, setSending] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const fetchCommandes = useCallback(async () => {
    if (!session) return;
    const embed = mode === 'vendeur'
      ? 'client:users!commandes_client_id_fkey(prenom, nom, num_telephone, telephone, avatar_url)'
      : 'vendeur:users!commandes_vendeur_id_fkey(prenom, nom, nom_boutique, num_telephone, telephone, avatar_url)';
    const { data } = await supabase
      .from('commandes')
      .select(`*, ${embed}`)
      .eq(mode === 'vendeur' ? 'vendeur_id' : 'client_id', session.user.id)
      .order('date_creation', { ascending: false });
    setCommandes((data as unknown as Commande[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [session, mode]);

  useFocusEffect(
    useCallback(() => {
      fetchCommandes();
    }, [fetchCommandes])
  );

  async function updateCommande(c: Commande, patch: Partial<Commande>, confirmMsg?: string) {
    const doIt = async () => {
      const { error } = await supabase.from('commandes').update(patch).eq('id', c.id);
      if (error) Alert.alert('Erreur', error.message);
      else fetchCommandes();
    };
    if (confirmMsg) {
      Alert.alert('Confirmer', confirmMsg, [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui', onPress: doIt },
      ]);
    } else {
      await doIt();
    }
  }

  async function confirmerCommande() {
    if (!reponseTarget) return;
    setSending(true);
    const { error } = await supabase
      .from('commandes')
      .update({ statut: 'confirmee', reponse_vendeur: reponseText.trim() || REPONSE_DEFAUT })
      .eq('id', reponseTarget.id);
    setSending(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      setReponseTarget(null);
      setReponseText(REPONSE_DEFAUT);
      fetchCommandes();
    }
  }

  const list = filtre === 'all' ? commandes : commandes.filter(c => c.statut === filtre);
  const nbNouvelles = commandes.filter(c => c.statut === 'nouvelle').length;

  function renderCommande({ item: c }: { item: Commande }) {
    const meta = STATUT_META[c.statut];
    const autre = mode === 'vendeur' ? c.client : c.vendeur;
    const autreNom = mode === 'vendeur'
      ? `${autre?.prenom || ''} ${autre?.nom || ''}`.trim() || 'Client'
      : autre?.nom_boutique || `${autre?.prenom || ''} ${autre?.nom || ''}`.trim() || 'Boutique';
    const autrePhone = autre?.telephone || autre?.num_telephone;

    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitre} numberOfLines={1}>{c.produit_titre}</Text>
            <Text style={styles.cardPrix}>
              {c.quantite > 1 ? `${c.quantite} × ` : ''}{Number(c.prix).toLocaleString('fr-FR')} FCFA
              {c.quantite > 1 ? `  =  ${(c.quantite * c.prix).toLocaleString('fr-FR')} F` : ''}
            </Text>
          </View>
          <View style={[styles.statutBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={12} color={meta.color} />
            <Text style={[styles.statutText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {/* L'autre partie */}
        <TouchableOpacity
          style={styles.autreRow}
          onPress={() => {
            const autreId = mode === 'vendeur' ? c.client_id : c.vendeur_id;
            navigation.navigate('VendeurProfile', { vendeurId: autreId });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="person-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={styles.autreNom}>{autreNom}</Text>
          <Text style={styles.cardDate}>
            {new Date(c.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>

        {c.note_client ? (
          <Text style={styles.note}>💬 {c.note_client}</Text>
        ) : null}
        {c.reponse_vendeur && c.statut !== 'nouvelle' ? (
          <Text style={[styles.note, { color: theme.primary }]}>↩️ {c.reponse_vendeur}</Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {mode === 'vendeur' && c.statut === 'nouvelle' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={() => { setReponseTarget(c); setReponseText(REPONSE_DEFAUT); }}
                activeOpacity={0.85}
              >
                <Text style={styles.actionPrimaryText}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDanger]}
                onPress={() => updateCommande(c, { statut: 'refusee' }, 'Refuser cette commande ? Le client sera notifié.')}
                activeOpacity={0.85}
              >
                <Text style={styles.actionDangerText}>Refuser</Text>
              </TouchableOpacity>
            </>
          )}
          {mode === 'vendeur' && c.statut === 'confirmee' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => updateCommande(c, { statut: 'livree' }, 'Marquer cette commande comme livrée ?')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionPrimaryText}>Marquer livrée</Text>
            </TouchableOpacity>
          )}
          {mode === 'client' && c.statut === 'nouvelle' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDanger]}
              onPress={() => updateCommande(c, { statut: 'annulee' }, 'Annuler votre commande ?')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionDangerText}>Annuler</Text>
            </TouchableOpacity>
          )}
          {mode === 'client' && c.produit_id && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionGhost]}
              onPress={() => navigation.navigate('ChatConversation', {
                annonceId: c.produit_id,
                vendeurId: c.vendeur_id,
                titreAnnonce: c.produit_titre,
                interlocuteur: c.vendeur,
              })}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-outline" size={13} color={theme.textSecondary} />
              <Text style={styles.actionGhostText}>Discuter</Text>
            </TouchableOpacity>
          )}
          {autrePhone && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionGhost]}
              onPress={() => Linking.openURL(`tel:${autrePhone}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="call-outline" size={13} color={theme.textSecondary} />
              <Text style={styles.actionGhostText}>Appeler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'vendeur' ? `Commandes reçues${nbNouvelles > 0 ? ` (${nbNouvelles})` : ''}` : 'Mes commandes'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {mode === 'vendeur' && (
        <View style={styles.filtresRow}>
          {FILTRES_VENDEUR.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filtre, filtre === f.key && styles.filtreActive]}
              onPress={() => setFiltre(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filtreText, filtre === f.key && styles.filtreTextActive]}>
                {f.label}{f.key === 'nouvelle' && nbNouvelles > 0 ? ` · ${nbNouvelles}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={c => c.id}
          renderItem={renderCommande}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCommandes(); }} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={44} color={theme.borderLight} />
              <Text style={styles.emptyText}>
                {mode === 'vendeur'
                  ? (filtre === 'nouvelle' ? 'Aucune nouvelle commande.' : 'Aucune commande pour le moment.')
                  : "Vous n'avez pas encore passé de commande."}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal réponse de confirmation */}
      <Modal visible={!!reponseTarget} animationType="fade" transparent onRequestClose={() => setReponseTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmer la commande</Text>
            <Text style={styles.modalSub} numberOfLines={1}>{reponseTarget?.produit_titre}</Text>
            <TextInput
              style={[styles.reponseInput]}
              value={reponseText}
              onChangeText={setReponseText}
              multiline
              maxLength={500}
              placeholder="Votre message au client…"
              placeholderTextColor={theme.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setReponseTarget(null)} activeOpacity={0.8}>
                <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={confirmerCommande} disabled={sending} activeOpacity={0.8}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnText}>Confirmer ✓</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },

  filtresRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  filtre: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight,
  },
  filtreActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filtreText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textSecondary },
  filtreTextActive: { color: '#fff' },

  card: { backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardTitre: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  cardPrix: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: theme.primary, marginTop: 1 },
  statutBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  statutText: { fontSize: 11, fontWeight: FONTS.bold },

  autreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  autreNom: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  cardDate: { fontSize: FONTS.xs, color: theme.textMuted },
  note: { fontSize: FONTS.sm, color: theme.textSecondary, marginTop: 6, lineHeight: 19 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.md },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md,
  },
  actionPrimary: { backgroundColor: theme.primary },
  actionPrimaryText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },
  actionDanger: { backgroundColor: '#fee2e2' },
  actionDangerText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#dc2626' },
  actionGhost: { backgroundColor: theme.surfaceMuted },
  actionGhostText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textSecondary },

  emptyBox: { alignItems: 'center', marginTop: 70, gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', padding: SPACING.xl },
  modalBox: { backgroundColor: theme.background, borderRadius: RADIUS.xl, padding: SPACING.xl },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  modalSub: { fontSize: FONTS.sm, color: theme.textSecondary, marginTop: 2, marginBottom: SPACING.md },
  reponseInput: {
    backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, padding: SPACING.lg,
    fontSize: FONTS.md, color: theme.textPrimary, height: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: theme.borderLight,
  },
  modalBtn: {
    flex: 1, height: 44, borderRadius: RADIUS.md, backgroundColor: theme.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: theme.surfaceMuted },
  modalBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },
});
