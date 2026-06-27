import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import * as Notifications from 'expo-notifications';

interface Props {
  navigation: any;
}

export default function SettingsScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  const MENU_ITEMS = [
    {
      section: 'Mon compte',
      items: [
        { icon: 'list', label: 'Mes annonces', screen: 'MesAnnonces', private: true },
        { icon: 'heart', label: 'Mes favoris', screen: 'Favoris', private: true },
        { icon: 'mail', label: 'E-mail de secours', screen: 'EmailRecovery', private: true },
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

  const handleTestNotifications = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert(
        "Permission refusée",
        "Vous devez autoriser les notifications dans les réglages de votre appareil pour tester cette fonctionnalité."
      );
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test de notification 🔔",
        body: "Ceci est un test local. Cliquez pour simuler l'ouverture d'un message.",
        data: { conversationId: 'test-id', titreAnnonce: 'Annonce Test' },
      },
      trigger: { seconds: 3 } as any,
    });
    
    Alert.alert(
      "Test lancé", 
      "La notification arrivera dans 3 secondes.\n\nCONSEIL : Verrouillez votre téléphone ou quittez l'application pour la voir apparaître comme une vraie notification."
    );
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

        {/* Tester les notifications */}
        <TouchableOpacity
          style={styles.notificationTestBtn}
          onPress={handleTestNotifications}
        >
          <View style={styles.menuItemLeft}>
            <View style={styles.menuIconBox}>
              <Ionicons name="notifications-outline" size={17} color={theme.primary} />
            </View>
            <Text style={styles.menuItemLabel}>Tester les notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
        </TouchableOpacity>

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
              { text: 'Déconnexion', style: 'destructive', onPress: signOut },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Feather name={session ? 'log-out' : 'log-in'} size={18} color={session ? COLORS.error : theme.primary} />
          <Text style={[styles.logoutText, { color: session ? COLORS.error : theme.primary }]}>
            {session ? 'Déconnexion' : 'Se connecter'}
          </Text>
        </TouchableOpacity>

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
  notificationTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
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
  version: {
    textAlign: 'center',
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginTop: SPACING.xl,
  },
});
