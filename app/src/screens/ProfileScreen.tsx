import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

interface Props {
  navigation: any;
}

const MENU_ITEMS = [
  {
    section: 'Mon compte',
    items: [
      { icon: 'list', label: 'Mes annonces', screen: 'MesAnnonces', private: true },
      { icon: 'heart', label: 'Mes favoris', screen: 'Favoris', private: true },
      { icon: 'clock', label: 'Historique', screen: 'Historique', private: true },
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
  const { session, user, signOut, refreshUser } = useAuth();
  
  // States pour l'édition
  const [isEditing, setIsEditing] = useState(false);
  const [editPrenom, setEditPrenom] = useState('');
  const [editNom, setEditNom] = useState('');
  const [editAvatarBase64, setEditAvatarBase64] = useState<string | null>(null);
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openEditModal = () => {
    if (!session || !user) return;
    setEditPrenom(user.prenom || '');
    setEditNom(user.nom || '');
    setEditAvatarUri(user.avatar_url || null);
    setEditAvatarBase64(null);
    setIsEditing(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Permission requise pour accéder aux photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setEditAvatarUri(result.assets[0].uri);
      setEditAvatarBase64(result.assets[0].base64);
    }
  };

  const handleSaveProfile = async () => {
    if (!session || !user) return;
    try {
      setIsSaving(true);
      
      let avatarUrlToSave = user.avatar_url;

      // Upload de l'image si elle a changé
      if (editAvatarBase64) {
        const filePath = `${user.id}/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(editAvatarBase64), {
            contentType: 'image/png',
          });

        if (uploadError) {
          console.error('Erreur upload avatar:', uploadError);
        } else {
          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
          avatarUrlToSave = data.publicUrl;
        }
      }

      // Mise à jour de la table users
      const { error } = await supabase
        .from('users')
        .update({
          prenom: editPrenom.trim(),
          nom: editNom.trim(),
          avatar_url: avatarUrlToSave,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshUser();
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder le profil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthAction = () => {
    if (!session) {
      navigation.navigate('Login');
      return;
    }

    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const onMenuItemPress = (item: any) => {
    if (item.private && !session) {
      navigation.navigate('Login');
      return;
    }

    if (item.screen) {
      if (item.screen === 'MesAnnonces' || item.screen === 'Favoris') {
        navigation.navigate(item.screen);
      } else {
        navigation.navigate('Placeholder', { title: item.label });
      }
    }
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
        <TouchableOpacity 
          style={styles.profileCard} 
          activeOpacity={0.8}
          onPress={session ? openEditModal : () => navigation.navigate('Login')}
        >
          <View style={[styles.avatar, user?.avatar_url && { backgroundColor: 'transparent' }]}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {session ? user?.prenom?.charAt(0) || '👤' : '👤'}
              </Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {session ? `${user?.prenom || 'Nouveau'} ${user?.nom || 'Client'}`.trim() : 'Invité'}
            </Text>
            <Text style={styles.profilePhone}>
              {session ? user?.phone || session.user.phone : 'Connectez-vous pour continuer'}
            </Text>
          </View>
          {session ? (
            <TouchableOpacity style={styles.editButton} onPress={openEditModal} activeOpacity={0.7}>
              <Feather name="edit-2" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
          )}
        </TouchableOpacity>

        {/* Stats (Visible que si connecté) */}
        {session && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Annonces</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Ventes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>-</Text>
              <Text style={styles.statLabel}>Note ⭐</Text>
            </View>
          </View>
        )}

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
                  onPress={() => onMenuItemPress(item)}
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
                    {session && 'badge' in item && (
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

        {/* Action Auth */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleAuthAction} 
          activeOpacity={0.7}
        >
          <Feather name={session ? "log-out" : "log-in"} size={18} color={session ? COLORS.error : COLORS.primary} />
          <Text style={[styles.logoutText, !session && { color: COLORS.primary }]}>
            {session ? 'Déconnexion' : 'Se connecter'}
          </Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Chap Chap v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal d'édition de profil */}
      <Modal visible={isEditing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditing(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Modifier le profil</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.modalSaveButton}>Valider</Text>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            
            <View style={styles.editAvatarContainer}>
              <TouchableOpacity style={styles.editAvatarButton} onPress={pickImage}>
                {editAvatarUri ? (
                  <Image source={{ uri: editAvatarUri }} style={styles.editAvatarImage} />
                ) : (
                  <Ionicons name="camera" size={32} color={COLORS.textInverse} />
                )}
                <View style={styles.editAvatarOverlay}>
                  <Ionicons name="pencil" size={16} color={COLORS.textInverse} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Prénom</Text>
              <TextInput
                style={styles.textInput}
                value={editPrenom}
                onChangeText={setEditPrenom}
                placeholder="Votre prénom"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom</Text>
              <TextInput
                style={styles.textInput}
                value={editNom}
                onChangeText={setEditNom}
                placeholder="Votre nom"
              />
            </View>

          </ScrollView>
        </View>
      </Modal>
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

  // Modal Editing Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  modalSaveButton: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: COLORS.primary,
  },
  modalContent: {
    padding: SPACING.xl,
  },
  editAvatarContainer: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  editAvatarButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  editAvatarImage: {
    width: '100%',
    height: '100%',
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
