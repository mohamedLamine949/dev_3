import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface Props {
  navigation: any;
}

export default function SettingsScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);

  // Le DELETE direct sur storage.objects est interdit côté SQL par Supabase :
  // la purge des fichiers doit passer par l'API Storage, avant la RPC.
  // Best-effort : un échec ici ne doit jamais bloquer la suppression du compte.
  const purgeStorage = async (uid: string) => {
    try {
      const { data: avatarFiles } = await supabase.storage.from('avatars').list(uid);
      if (avatarFiles && avatarFiles.length > 0) {
        await supabase.storage.from('avatars').remove(avatarFiles.map(f => `${uid}/${f.name}`));
      }
      const { data: annonces } = await supabase.from('annonces').select('id').eq('user_id', uid);
      for (const annonce of annonces || []) {
        const { data: imgs } = await supabase.storage.from('annonces-images').list(annonce.id);
        if (imgs && imgs.length > 0) {
          await supabase.storage.from('annonces-images').remove(imgs.map(f => `${annonce.id}/${f.name}`));
        }
      }
    } catch {}
  };

  const performAccountDeletion = async () => {
    try {
      setIsDeletingAccount(true);
      if (session?.user?.id) await purgeStorage(session.user.id);
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Accueil' } }],
      });
      setTimeout(() => {
        Alert.alert(
          'Compte supprimé',
          'Votre compte et toutes vos données ont été définitivement supprimés.'
        );
      }, 400);
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        err?.message || 'La suppression du compte a échoué. Veuillez réessayer.'
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!session) {
      navigation.navigate('Login');
      return;
    }
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est définitive et irréversible. Toutes vos données seront supprimées : profil, annonces et leurs photos, conversations, messages, avis, favoris et notifications.\n\nVoulez-vous continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmation définitive',
              'Dernière étape : votre compte sera supprimé immédiatement et ne pourra pas être récupéré.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer définitivement', style: 'destructive', onPress: performAccountDeletion },
              ]
            );
          },
        },
      ]
    );
  };

  const MENU_ITEMS = [
    {
      section: 'Mon compte',
      items: [
        { icon: 'list', label: 'Mes annonces', screen: 'MesAnnonces', private: true },
        { icon: 'credit-card', label: 'Historique des paiements', screen: 'HistoriquePaiements', private: true },
        { icon: 'heart', label: 'Mes favoris', screen: 'Favoris', private: true },
        { icon: 'mail', label: 'E-mail de secours', screen: 'LinkEmail', private: true },
      ],
    },
    {
      section: 'Paramètres',
      items: [
        { icon: 'moon', label: 'Mode Sombre', type: 'toggle' },
      ],
    },
    {
      section: 'Informations',
      items: [
        { icon: 'file-text', label: 'CGU', screen: 'Legal', params: { type: 'cgu' } },
        { icon: 'shopping-cart', label: 'CGV', screen: 'Legal', params: { type: 'cgv' } },
        { icon: 'shield', label: 'Protection des données', screen: 'Legal', params: { type: 'privacy' } },
      ],
    },
  ];

  const onMenuItemPress = (item: any) => {
    if (item.private && !session) {
      navigation.navigate('Login');
      return;
    }
    if (item.screen) {
      navigation.navigate(item.screen, item.params || {});
    } else {
      navigation.navigate('Placeholder', { title: item.label });
    }
  };

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {MENU_ITEMS.map((section) => (
          <View key={section.section} style={styles.menuSection}>
            <Text style={styles.sectionLabel}>{section.section}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && styles.menuItemBorder
                  ]}
                  activeOpacity={0.7}
                  onPress={() => (item as any).type === 'toggle' ? toggleTheme() : onMenuItemPress(item)}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIconBox}>
                      <Feather name={item.icon as any} size={17} color={theme.primary} />
                    </View>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.menuItemRight}>
                    {(item as any).type === 'toggle' ? (
                      <View style={[styles.toggleContainer, { backgroundColor: isDark ? theme.primary : theme.border }]}>
                        <View style={[styles.toggleCircle, { transform: [{ translateX: isDark ? 20 : 0 }] }]} />
                      </View>
                    ) : (
                      <>
                        {'value' in item && <Text style={styles.menuItemValue}>{(item as any).value}</Text>}
                        <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Bouton de Déconnexion / Connexion */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            if (!session) {
              navigation.navigate('Login');
              return;
            }
            Alert.alert('Déconnexion', 'Êtes-vous sûr ?', [
              { text: 'Annuler', style: 'cancel' },
              { 
                text: 'Déconnexion', 
                style: 'destructive', 
                onPress: async () => {
                  await signOut();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main', params: { screen: 'Accueil' } }]
                  });
                }
              },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Feather name={session ? 'log-out' : 'log-in'} size={18} color={session ? COLORS.error : theme.primary} />
          <Text style={[styles.logoutText, { color: session ? COLORS.error : theme.primary }]}>
            {session ? 'Déconnexion' : 'Se connecter'}
          </Text>
        </TouchableOpacity>

        {/* Suppression de compte (App Store Guideline 5.1.1(v)) */}
        {session && (
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            activeOpacity={0.7}
          >
            {isDeletingAccount ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <>
                <Feather name="trash-2" size={18} color={COLORS.error} />
                <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.version}>Flash Market v2.0</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 60,
  },
  menuSection: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semibold,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: FONTS.md,
    fontWeight: FONTS.medium,
    color: theme.textPrimary,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  menuItemValue: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
  },
  toggleContainer: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: theme.borderLight,
    marginTop: SPACING.md,
    ...SHADOWS.sm,
  },
  logoutText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.error,
    marginTop: SPACING.md,
    ...SHADOWS.sm,
  },
  deleteAccountText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.error,
  },
  version: {
    textAlign: 'center',
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginTop: SPACING.xl,
  },
});
