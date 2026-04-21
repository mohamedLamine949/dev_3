import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface Props {
  navigation: any;
}

const MENU_ITEMS = [
  {
    section: 'Mon compte',
    items: [
      { icon: 'list', label: 'Mes annonces', screen: 'MesAnnonces', badge: '3' },
      { icon: 'heart', label: 'Mes favoris', screen: 'Favoris' },
      { icon: 'clock', label: 'Historique', screen: 'Historique' },
    ],
  },
  {
    section: 'Paramètres',
    items: [
      { icon: 'bell', label: 'Notifications', screen: 'Notifications' },
      { icon: 'globe', label: 'Langue', screen: 'Langue', value: 'Français' },
      { icon: 'shield', label: 'Confidentialité', screen: 'Confidentialite' },
    ],
  },
  {
    section: 'Aide',
    items: [
      { icon: 'help-circle', label: 'Centre d\'aide', screen: 'Aide' },
      { icon: 'message-circle', label: 'Nous contacter', screen: 'Contact' },
      { icon: 'info', label: 'À propos', screen: 'APropos' },
    ],
  },
];

export default function ProfileScreen({ navigation }: Props) {
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: () => console.log('Logout') },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>

        {/* Avatar & Infos */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>ML</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Mohamed Lamine</Text>
            <Text style={styles.profilePhone}>+223 76 XX XX XX</Text>
          </View>
          <TouchableOpacity style={styles.editButton} activeOpacity={0.7}>
            <Feather name="edit-2" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Annonces</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Ventes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Note ⭐</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {MENU_ITEMS.map((section) => (
          <View key={section.section} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.section}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIconContainer}>
                      <Feather name={item.icon as any} size={18} color={COLORS.primary} />
                    </View>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.menuItemRight}>
                    {'value' in item && (
                      <Text style={styles.menuItemValue}>{(item as any).value}</Text>
                    )}
                    {'badge' in item && (
                      <View style={styles.menuBadge}>
                        <Text style={styles.menuBadgeText}>{(item as any).badge}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Chap Chap v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
  },
  header: {
    paddingTop: 60,
    paddingBottom: SPACING.xl,
  },
  headerTitle: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.extrabold,
    color: COLORS.textPrimary,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    ...SHADOWS.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  avatarText: {
    fontSize: FONTS.xl,
    fontWeight: FONTS.bold,
    color: COLORS.textInverse,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  profilePhone: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    marginTop: SPACING.lg,
    ...SHADOWS.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.extrabold,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.divider,
  },

  // Menu
  menuSection: {
    marginTop: SPACING.xxl,
  },
  menuSectionTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
    marginLeft: SPACING.xs,
  },
  menuCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: FONTS.md,
    fontWeight: FONTS.medium,
    color: COLORS.textPrimary,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  menuItemValue: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
  },
  menuBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: FONTS.bold,
    color: COLORS.textInverse,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xxxl,
    paddingVertical: SPACING.lg,
  },
  logoutText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: COLORS.error,
  },
  versionText: {
    textAlign: 'center',
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});
