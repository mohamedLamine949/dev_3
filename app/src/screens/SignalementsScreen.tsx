import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { supabase } from '../lib/supabase';
import { formatPrix } from '../lib/format';
import EtatEcran from '../components/EtatEcran';

/**
 * File de modération unique (§16.4).
 *
 * Avant, un signalement partait dans une table que personne ne consultait :
 * l'écran d'administration ne montrait que les annonces de la campagne de
 * parrainage. Un utilisateur qui signalait une arnaque écrivait dans le vide.
 *
 * Trois principes portés par cet écran :
 *
 * 1. **Une seule file**, triée par gravité. Fraude et danger passent devant ;
 *    un doublon peut attendre. L'ordre n'est pas chronologique parce qu'un
 *    signalement de fraude vieux d'une heure est plus urgent qu'un doublon
 *    vieux d'une minute.
 *
 * 2. **Le contexte avant la décision.** Chaque carte montre combien de fois
 *    la cible a déjà été signalée et combien de décisions ont déjà été prises
 *    à son sujet : un récidiviste ne se traite pas comme un premier cas.
 *
 * 3. **Limiter avant de supprimer.** L'action par défaut retire la
 *    publication du fil et de la recherche sans la détruire, le temps de
 *    vérifier (§16.6). On ne détruit jamais le gagne-pain de quelqu'un sur
 *    un simple soupçon.
 *
 * Chaque décision est journalisée par le serveur dans une table que personne
 * ne peut réécrire — y compris un administrateur.
 */

interface Props { navigation: any; }

interface LigneFile {
  id: string;
  cible_type: string;
  cible_id: string | null;
  motif_code: string;
  motif: string | null;
  details: string | null;
  statut: string;
  decision: string | null;
  date_creation: string;
  rang_priorite: number;
  annonce_titre: string | null;
  annonce_prix: number | null;
  annonce_statut_moderation: string | null;
  proprietaire_prenom: string | null;
  proprietaire_nom: string | null;
  proprietaire_statut: string | null;
  signaleur_prenom: string | null;
  actions_anterieures: number;
  signalements_sur_la_cible: number;
}

const FILTRES = [
  { cle: 'ouverts', label: 'À traiter' },
  { cle: 'en_enquete', label: 'En enquête' },
  { cle: 'traites', label: 'Traités' },
  { cle: 'tous', label: 'Tous' },
] as const;

const MOTIF_META: Record<string, { label: string; couleur: string }> = {
  fraude:           { label: 'Fraude',            couleur: '#dc2626' },
  danger:           { label: 'Danger',            couleur: '#dc2626' },
  contenu_interdit: { label: 'Contenu interdit',  couleur: '#d97706' },
  harcelement:      { label: 'Harcèlement',       couleur: '#d97706' },
  doublon:          { label: 'Doublon',           couleur: '#6b7280' },
  info_incorrecte:  { label: 'Info incorrecte',   couleur: '#6b7280' },
};

const ACTIONS: { cle: string; label: string; aide: string; danger?: boolean }[] = [
  { cle: 'limiter', label: 'Limiter', aide: 'Retirée du fil et de la recherche, le temps de vérifier. Rien n’est supprimé.' },
  { cle: 'rejeter_contenu', label: 'Retirer du public', aide: 'La publication n’est plus visible. Elle reste accessible à son auteur.', danger: true },
  { cle: 'suspendre_compte', label: 'Suspendre le compte', aide: 'Mesure lourde : réservée à la fraude avérée et au danger.', danger: true },
  { cle: 'approuver', label: 'Tout va bien', aide: 'La publication est rétablie et le signalement clos.' },
  { cle: 'classer_sans_suite', label: 'Classer sans suite', aide: 'Le signalement est écarté sans toucher à la publication.' },
];

export default function SignalementsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { theme, isDark } = useTheme();
  const { isAdmin, loading: chargementAdmin } = useIsAdmin(session?.user?.id);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [lignes, setLignes] = useState<LigneFile[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<typeof FILTRES[number]['cle']>('ouverts');

  const [cible, setCible] = useState<LigneFile | null>(null);
  const [note, setNote] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const { data, error } = await supabase
      .from('v_file_moderation')
      .select('*')
      .order('rang_priorite', { ascending: true })
      .order('date_creation', { ascending: false });

    if (error) {
      // Migration pas encore appliquée : on le dit, plutôt que d'afficher une
      // file vide qui laisserait croire qu'il n'y a rien à traiter.
      setErreur(error.message);
      setLignes([]);
    } else {
      setLignes((data as LigneFile[]) || []);
    }
    setChargement(false);
    setRafraichit(false);
  }, []);

  useEffect(() => { if (isAdmin) charger(); }, [isAdmin, charger]);

  const visibles = lignes.filter(l => {
    if (filtre === 'tous') return true;
    if (filtre === 'en_enquete') return l.statut === 'en_enquete';
    if (filtre === 'traites') return ['actionne', 'rejete', 'clos'].includes(l.statut);
    return ['nouveau', 'trie'].includes(l.statut);
  });

  async function appliquer(action: string) {
    if (!cible) return;
    setEnvoiEnCours(true);
    const { error } = await supabase.rpc('moderer_signalement', {
      p_signalement_id: cible.id,
      p_action: action,
      p_note: note.trim() || null,
    });
    setEnvoiEnCours(false);
    if (error) {
      Alert.alert('Action refusée', error.message);
      return;
    }
    setCible(null);
    setNote('');
    charger();
  }

  async function mettreEnEnquete(ligne: LigneFile) {
    const { error } = await supabase.rpc('trier_signalement', {
      p_signalement_id: ligne.id,
      p_statut: 'en_enquete',
    });
    if (error) Alert.alert('Erreur', error.message);
    else charger();
  }

  if (chargementAdmin) {
    return (
      <View style={styles.container}>
        <EtatEcran variante="chargement" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <EtatEcran
          variante="vide"
          icone="lock-closed-outline"
          titre="Réservé à l'équipe"
          message="Cet écran est accessible aux administrateurs."
          actionLabel="Retour"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const rendreCarte = ({ item }: { item: LigneFile }) => {
    const meta = MOTIF_META[item.motif_code] || MOTIF_META.info_incorrecte;
    const traite = ['actionne', 'rejete', 'clos'].includes(item.statut);
    const proprietaire = `${item.proprietaire_prenom || ''} ${item.proprietaire_nom || ''}`.trim();
    const recidive = item.signalements_sur_la_cible > 1 || item.actions_anterieures > 0;

    return (
      <View style={styles.carte}>
        <View style={styles.carteHaut}>
          <View style={[styles.motifChip, { backgroundColor: meta.couleur + '1A' }]}>
            <Text style={[styles.motifTexte, { color: meta.couleur }]}>{meta.label}</Text>
          </View>
          <Text style={styles.cibleType}>{item.cible_type}</Text>
          {traite && (
            <View style={styles.traiteChip}>
              <Ionicons name="checkmark" size={11} color={theme.primary} />
              <Text style={styles.traiteTexte}>{item.decision || item.statut}</Text>
            </View>
          )}
        </View>

        <Text style={styles.titreCible} numberOfLines={2}>
          {item.annonce_titre || proprietaire || 'Cible supprimée'}
        </Text>
        {item.annonce_prix != null && (
          <Text style={styles.prix}>{formatPrix(item.annonce_prix)}</Text>
        )}

        {!!item.details && <Text style={styles.details}>« {item.details} »</Text>}

        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={13} color={theme.textMuted} />
          <Text style={styles.metaTexte} numberOfLines={1}>
            {proprietaire || 'inconnu'}
            {item.proprietaire_statut === 'suspendu' ? ' · compte suspendu' : ''}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="flag-outline" size={13} color={theme.textMuted} />
          <Text style={styles.metaTexte}>
            signalé par {item.signaleur_prenom || 'un visiteur'}
          </Text>
        </View>

        {/* Le contexte qui change la decision : un recidiviste ne se traite
            pas comme un premier cas (§16.4). */}
        {recidive && (
          <View style={styles.recidiveBox}>
            <Ionicons name="alert-circle-outline" size={14} color={theme.error} />
            <Text style={styles.recidiveTexte}>
              {item.signalements_sur_la_cible} signalement
              {item.signalements_sur_la_cible > 1 ? 's' : ''} sur cette cible
              {item.actions_anterieures > 0
                ? ` · ${item.actions_anterieures} décision${item.actions_anterieures > 1 ? 's' : ''} déjà prise${item.actions_anterieures > 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>
        )}

        {item.annonce_statut_moderation && item.annonce_statut_moderation !== 'approved' && (
          <Text style={styles.statutModeration}>
            Publication actuellement : {item.annonce_statut_moderation}
          </Text>
        )}

        {!traite && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => mettreEnEnquete(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnGhostTexte}>En enquête</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPlein]}
              onPress={() => { setCible(item); setNote(''); }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPleinTexte}>Décider</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={styles.entete}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retour} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.enteteTitre}>Signalements</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.filtres}>
        {FILTRES.map(f => (
          <TouchableOpacity
            key={f.cle}
            style={[styles.filtreChip, filtre === f.cle && styles.filtreChipActif]}
            onPress={() => setFiltre(f.cle)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: filtre === f.cle }}
          >
            <Text style={[styles.filtreTexte, filtre === f.cle && styles.filtreTexteActif]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {chargement ? (
        <EtatEcran variante="chargement" />
      ) : erreur ? (
        <EtatEcran
          variante="erreur"
          titre="File indisponible"
          message="La file de modération n'est pas encore installée sur cette base."
          onAction={charger}
        />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={i => i.id}
          renderItem={rendreCarte}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={rafraichit}
              onRefresh={() => { setRafraichit(true); charger(); }}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <EtatEcran
              variante="vide"
              icone="shield-checkmark-outline"
              titre={filtre === 'ouverts' ? 'Rien à traiter' : 'Aucun signalement'}
              message={
                filtre === 'ouverts'
                  ? "La file est vide. C'est bon signe."
                  : 'Aucun signalement dans cette catégorie.'
              }
            />
          }
        />
      )}

      {/* Décision : chaque action est expliquée avant d'être prise */}
      <Modal visible={!!cible} transparent animationType="slide" onRequestClose={() => setCible(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalFond}
        >
          <View style={styles.modalCarte}>
            <Text style={styles.modalTitre}>Quelle décision ?</Text>
            <Text style={styles.modalSous} numberOfLines={2}>
              {cible?.annonce_titre || 'Signalement'}
            </Text>

            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Note interne (facultative, conservée au journal)"
              placeholderTextColor={theme.textMuted}
              multiline
            />

            {ACTIONS.map(a => (
              <TouchableOpacity
                key={a.cle}
                style={styles.actionLigne}
                onPress={() => appliquer(a.cle)}
                disabled={envoiEnCours}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionLabel, a.danger && { color: theme.error }]}>
                    {a.label}
                  </Text>
                  <Text style={styles.actionAide}>{a.aide}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.annuler}
              onPress={() => setCible(null)}
              activeOpacity={0.8}
            >
              {envoiEnCours
                ? <ActivityIndicator color={theme.textSecondary} />
                : <Text style={styles.annulerTexte}>Annuler</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    entete: {
      backgroundColor: theme.primary,
      paddingTop: Platform.OS === 'ios' ? 60 : 45,
      paddingBottom: SPACING.md,
      paddingHorizontal: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    retour: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.18)',
      justifyContent: 'center', alignItems: 'center',
    },
    enteteTitre: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },

    filtres: {
      flexDirection: 'row', gap: SPACING.sm,
      paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    },
    filtreChip: {
      paddingHorizontal: SPACING.md, minHeight: 38, justifyContent: 'center',
      borderRadius: RADIUS.full, borderWidth: 1, borderColor: theme.borderLight,
      backgroundColor: theme.surface,
    },
    filtreChipActif: { backgroundColor: theme.primary, borderColor: theme.primary },
    filtreTexte: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary },
    filtreTexteActif: { color: '#fff' },

    carte: {
      backgroundColor: theme.surface, borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: theme.borderLight,
      padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
    },
    carteHaut: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm, flexWrap: 'wrap' },
    motifChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.full },
    motifTexte: { fontSize: 11, fontWeight: FONTS.bold },
    cibleType: { fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    traiteChip: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: theme.primaryFaded, paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: RADIUS.full,
    },
    traiteTexte: { fontSize: 10, fontWeight: FONTS.bold, color: theme.primary },

    titreCible: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
    prix: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary, marginTop: 2 },
    details: {
      fontSize: FONTS.sm, color: theme.textSecondary, fontStyle: 'italic',
      marginTop: SPACING.sm, lineHeight: 19,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
    metaTexte: { fontSize: FONTS.xs, color: theme.textMuted, flex: 1 },

    recidiveBox: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: theme.error + '12', borderRadius: RADIUS.md,
      padding: SPACING.sm, marginTop: SPACING.sm,
    },
    recidiveTexte: { flex: 1, fontSize: FONTS.xs, color: theme.error, fontWeight: FONTS.semibold },
    statutModeration: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: SPACING.sm },

    actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
    btn: { flex: 1, minHeight: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
    btnGhost: { backgroundColor: theme.surfaceMuted },
    btnGhostTexte: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textSecondary },
    btnPlein: { backgroundColor: theme.primary },
    btnPleinTexte: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },

    modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCarte: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
      padding: SPACING.lg, paddingBottom: SPACING.xxl,
    },
    modalTitre: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
    modalSous: { fontSize: FONTS.sm, color: theme.textSecondary, marginTop: 2, marginBottom: SPACING.md },
    noteInput: {
      backgroundColor: theme.background, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: theme.borderLight,
      padding: SPACING.md, minHeight: 64, textAlignVertical: 'top',
      fontSize: FONTS.sm, color: theme.textPrimary, marginBottom: SPACING.md,
    },
    actionLigne: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingVertical: SPACING.md, minHeight: 60,
      borderTopWidth: 1, borderTopColor: theme.borderLight,
    },
    actionLabel: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary },
    actionAide: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 2, lineHeight: 16 },
    annuler: { alignItems: 'center', paddingVertical: SPACING.md, minHeight: 48, justifyContent: 'center' },
    annulerTexte: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },
  });
