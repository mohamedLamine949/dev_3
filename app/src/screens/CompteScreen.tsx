import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarSpace } from '../hooks/useTabBarSpace';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useParrainage } from '../hooks/useParrainage';
import { useEntitlements } from '../hooks/useEntitlements';
import { useAppConfig } from '../hooks/useAppConfig';
import { supabase } from '../lib/supabase';
import { sellerDisplayName, sellerInitial } from '../lib/seller';

/**
 * Espace Compte — le tableau de bord PRIVÉ (§6.3).
 *
 * L'ancien écran Profil empilait l'identité publique, l'édition, la boutique,
 * les achats, le parrainage et la gestion sur une seule page. Le §7.8 le juge
 * illisible et le §6.3 impose quatre blocs, pas plus :
 *
 *   1. identité et accès au profil public ;
 *   2. activité de vente : annonces, favoris, achats et demandes ;
 *   3. « Mon activité professionnelle », pour les comptes concernés ;
 *   4. abonnement, paramètres et assistance.
 *
 * Le parrainage et l'administration descendent dans « Plus » : ce sont des
 * fonctions occasionnelles, elles ne doivent pas concurrencer les tâches
 * quotidiennes.
 *
 * La grande bannière de couverture reste sur le PROFIL PUBLIC, où elle a un
 * sens pour l'acheteur — pas en en-tête d'un espace privé (§7.8).
 */

interface Props {
  navigation: any;
}

interface Ligne {
  cle: string;
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  detail?: string;
  badge?: number;
  onPress: () => void;
}

export default function CompteScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { session, user } = useAuth();
  const tabBarSpace = useTabBarSpace();
  const { isAdmin } = useIsAdmin(session?.user?.id);
  const { campagne, parrain: parrainRow, monParrainage } = useParrainage(session?.user?.id);
  const { paymentsEnabled } = useAppConfig();
  const { entitlements } = useEntitlements(user, 0, paymentsEnabled);

  const [nbAnnonces, setNbAnnonces] = useState(0);
  const [nbFavoris, setNbFavoris] = useState(0);
  const [nbDemandesRecues, setNbDemandesRecues] = useState(0);
  const [nbMesDemandes, setNbMesDemandes] = useState(0);
  const [chargement, setChargement] = useState(true);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const estPro = entitlements.planCode === 'pro';
  const nom = sellerDisplayName(user, 'Mon compte');

  const chargerCompteurs = useCallback(async () => {
    if (!session?.user?.id) {
      setChargement(false);
      return;
    }
    const uid = session.user.id;
    // Compteurs en `head: true` : on ne rapatrie aucune ligne, juste le nombre.
    const [annonces, favoris, recues, miennes] = await Promise.all([
      supabase.from('annonces').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('statut', 'active'),
      supabase.from('favoris').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('commandes').select('id', { count: 'exact', head: true })
        .eq('vendeur_id', uid).eq('statut', 'nouvelle'),
      supabase.from('commandes').select('id', { count: 'exact', head: true }).eq('client_id', uid),
    ]);
    setNbAnnonces(annonces.count || 0);
    setNbFavoris(favoris.count || 0);
    setNbDemandesRecues(recues.count || 0);
    setNbMesDemandes(miennes.count || 0);
    setChargement(false);
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => { chargerCompteurs(); }, [chargerCompteurs]));

  // ─── Invité : une seule proposition, claire ───────────────────────────
  if (!session) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <View style={styles.invite}>
          <View style={styles.inviteIcone}>
            <Ionicons name="person-outline" size={34} color={theme.primary} />
          </View>
          <Text style={styles.inviteTitre}>Votre compte</Text>
          <Text style={styles.inviteTexte}>
            Créez un compte gratuit pour publier, enregistrer vos favoris et suivre
            vos commandes. Parcourir et contacter un vendeur restent gratuits.
          </Text>
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.inviteBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const rendreGroupe = (titre: string, lignes: Ligne[]) => {
    if (lignes.length === 0) return null;
    return (
      <View style={styles.groupe}>
        <Text style={styles.groupeTitre}>{titre}</Text>
        <View style={styles.carte}>
          {lignes.map((l, i) => (
            <TouchableOpacity
              key={l.cle}
              style={[styles.ligne, i > 0 && styles.ligneSeparee]}
              onPress={l.onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={l.titre}
            >
              <View style={styles.ligneIcone}>
                <Ionicons name={l.icone} size={19} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ligneTitre}>{l.titre}</Text>
                {!!l.detail && <Text style={styles.ligneDetail}>{l.detail}</Text>}
              </View>
              {l.badge ? (
                <View style={styles.pastille}>
                  <Text style={styles.pastilleTexte}>{l.badge}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // ─── Bloc 2 : activité de vente ───────────────────────────────────────
  const lignesVente: Ligne[] = [
    {
      cle: 'annonces',
      icone: 'list-outline',
      titre: 'Mes annonces',
      detail: chargement ? '…' : `${nbAnnonces} en ligne`,
      onPress: () => navigation.navigate('MesAnnonces'),
    },
    {
      cle: 'favoris',
      icone: 'heart-outline',
      titre: 'Mes favoris',
      detail: chargement ? '…' : `${nbFavoris} enregistré${nbFavoris > 1 ? 's' : ''}`,
      onPress: () => navigation.navigate('Favoris'),
    },
    {
      cle: 'mes-demandes',
      icone: 'bag-handle-outline',
      titre: 'Mes commandes et demandes',
      detail: chargement ? '…' : nbMesDemandes > 0 ? `${nbMesDemandes} au total` : 'Aucune pour le moment',
      onPress: () => navigation.navigate('Commandes', { mode: 'client' }),
    },
  ];

  // ─── Bloc 3 : activité professionnelle ────────────────────────────────
  const lignesPro: Ligne[] = estPro
    ? [
        {
          cle: 'boutique',
          icone: 'storefront-outline',
          titre: 'Ma boutique',
          detail: user?.ouvert_maintenant === false ? 'Fermée en ce moment' : 'Ouverte',
          onPress: () => navigation.navigate('MaBoutique'),
        },
        {
          cle: 'demandes',
          icone: 'receipt-outline',
          titre: 'Demandes reçues',
          detail: nbDemandesRecues > 0 ? 'À traiter' : 'Rien en attente',
          badge: nbDemandesRecues || undefined,
          onPress: () => navigation.navigate('Commandes', { mode: 'vendeur' }),
        },
      ]
    : [];

  // ─── Bloc 4 : compte, abonnement, aide ────────────────────────────────
  const lignesCompte: Ligne[] = [
    {
      cle: 'abonnement',
      icone: 'card-outline',
      titre: 'Mon abonnement',
      detail:
        entitlements.planCode === 'pro' ? 'Flash Pro'
        : entitlements.planCode === 'vendeur' ? 'Flash Vendeur'
        : 'Gratuit',
      onPress: () => navigation.navigate('Subscription'),
    },
    {
      cle: 'parametres',
      icone: 'settings-outline',
      titre: 'Paramètres',
      onPress: () => navigation.navigate('Settings'),
    },
    {
      cle: 'aide',
      icone: 'help-circle-outline',
      titre: 'Aide et conditions',
      onPress: () => navigation.navigate('Legal', { type: 'cgu' }),
    },
  ];

  // ─── « Plus » : fonctions occasionnelles, hors du chemin principal ────
  const lignesPlus: Ligne[] = [];
  if (campagne?.active && parrainRow) {
    lignesPlus.push({
      cle: 'partenaire',
      icone: 'gift-outline',
      titre: 'Programme partenaire',
      detail: parrainRow.code ? `Code ${parrainRow.code}` : 'Vous êtes invité',
      onPress: () => navigation.navigate('DevenirPartenaire'),
    });
  }
  if (campagne?.active && !parrainRow && !monParrainage) {
    lignesPlus.push({
      cle: 'code',
      icone: 'ticket-outline',
      titre: 'J\'ai un code de parrainage',
      onPress: () => navigation.navigate('SaisirCodeParrainage'),
    });
  }
  if (isAdmin) {
    lignesPlus.push({
      cle: 'signalements',
      icone: 'flag-outline',
      titre: 'Signalements',
      detail: 'File de modération',
      onPress: () => navigation.navigate('Signalements'),
    });
    lignesPlus.push({
      cle: 'moderation',
      icone: 'shield-checkmark-outline',
      titre: 'Modération campagne',
      detail: 'Annonces du programme partenaire',
      onPress: () => navigation.navigate('AdminModeration'),
    });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Bloc 1 : identité, sans bannière (§7.8) ─── */}
        <View style={styles.entete}>
          <View style={styles.identite}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarVide]}>
                <Text style={styles.avatarInitiale}>{sellerInitial(user, 'M')}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.nom} numberOfLines={1}>{nom}</Text>
              <View style={styles.badgesRow}>
                {estPro && (
                  <View style={styles.badgePro}>
                    <Text style={styles.badgeProTexte}>PRO</Text>
                  </View>
                )}
                <Text style={styles.sousNom}>
                  {user?.telephone || user?.num_telephone || 'Profil à compléter'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsIdentite}>
            <TouchableOpacity
              style={styles.actionSecondaire}
              onPress={() => navigation.navigate('MonProfil')}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={17} color={theme.primary} />
              <Text style={styles.actionSecondaireTexte}>Modifier mon profil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSecondaire}
              onPress={() => navigation.navigate('VendeurProfile', { vendeurId: session.user.id })}
              activeOpacity={0.85}
            >
              <Ionicons name="eye-outline" size={17} color={theme.primary} />
              <Text style={styles.actionSecondaireTexte}>Voir comme un client</Text>
            </TouchableOpacity>
          </View>
        </View>

        {chargement && (
          <ActivityIndicator color={theme.primary} style={{ marginTop: SPACING.lg }} />
        )}

        {rendreGroupe('Mon activité de vente', lignesVente)}
        {rendreGroupe('Mon activité professionnelle', lignesPro)}
        {rendreGroupe('Mon compte', lignesCompte)}
        {rendreGroupe('Plus', lignesPlus)}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    entete: {
      paddingTop: SPACING.xxxl,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.lg,
      gap: SPACING.lg,
    },
    identite: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    avatar: { width: 62, height: 62, borderRadius: 31 },
    avatarVide: {
      backgroundColor: theme.primaryFaded,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitiale: { fontSize: 24, fontWeight: FONTS.extrabold, color: theme.primary },
    nom: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: theme.textPrimary },
    badgesRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 3 },
    badgePro: {
      backgroundColor: theme.primary,
      borderRadius: RADIUS.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeProTexte: { fontSize: 10, fontWeight: FONTS.extrabold, color: '#fff', letterSpacing: 0.5 },
    sousNom: { fontSize: FONTS.sm, color: theme.textSecondary, flexShrink: 1 },

    actionsIdentite: { flexDirection: 'row', gap: SPACING.md },
    actionSecondaire: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 46,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
      backgroundColor: theme.surface,
    },
    actionSecondaireTexte: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary },

    groupe: { marginTop: SPACING.lg, paddingHorizontal: SPACING.lg },
    groupeTitre: {
      fontSize: FONTS.xs,
      fontWeight: FONTS.bold,
      color: theme.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: SPACING.sm,
      marginLeft: 2,
    },
    carte: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
      overflow: 'hidden',
      ...SHADOWS.sm,
    },
    ligne: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
      // Zone tactile confortable (§15.4)
      minHeight: 60,
    },
    ligneSeparee: { borderTopWidth: 1, borderTopColor: theme.borderLight },
    ligneIcone: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.primaryFaded,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ligneTitre: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary },
    ligneDetail: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 1 },
    pastille: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: theme.error,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pastilleTexte: { fontSize: 11, fontWeight: FONTS.bold, color: '#fff' },

    invite: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl, gap: SPACING.lg },
    inviteIcone: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center',
    },
    inviteTitre: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary },
    inviteTexte: {
      fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 22,
    },
    inviteBtn: {
      width: '100%', height: 52, borderRadius: RADIUS.lg, backgroundColor: theme.primary,
      justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md,
    },
    inviteBtnText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  });
