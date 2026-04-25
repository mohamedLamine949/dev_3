import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, Image, Modal, TextInput, ActivityIndicator,
  Linking, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

function StarRow({ note, size = 16, theme }: { note: number; size?: number; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(note) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(note) ? '#f59e0b' : theme.borderLight}
        />
      ))}
    </View>
  );
}
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

interface Props { navigation: any; }

const SOCIAL_FIELDS = [
  { key: 'telephone', label: 'Téléphone', icon: 'call-outline', color: '#15803d', prefix: 'tel:', placeholder: '+223 XX XX XX XX' },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: 'logo-whatsapp', color: '#25D366', prefix: 'https://wa.me/', placeholder: '+223XXXXXXXX' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C', prefix: 'https://instagram.com/', placeholder: '@votre_compte' },
  { key: 'tiktok',   label: 'TikTok',    icon: 'musical-notes-outline', color: '#010101', prefix: 'https://tiktok.com/@', placeholder: '@votre_compte' },
  { key: 'facebook', label: 'Facebook',  icon: 'logo-facebook', color: '#1877F2', prefix: 'https://facebook.com/', placeholder: 'Votre page' },
] as const;

const MENU_ITEMS = [
  {
    section: 'Mon compte',
    items: [
      { icon: 'list', label: 'Mes annonces', screen: 'MesAnnonces', private: true },
      { icon: 'heart', label: 'Mes favoris', screen: 'Favoris', private: true },
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

export default function ProfileScreen({ navigation }: Props) {
  const { session, user, signOut, refreshUser } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [editPrenom, setEditPrenom] = useState('');
  const [editNom, setEditNom] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editFacebook, setEditFacebook] = useState('');
  const [editAvatarBase64, setEditAvatarBase64] = useState<string | null>(null);
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [stats, setStats] = useState({ annonces: 0, avis: 0, avgNote: null as number | null });

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    Promise.all([
      supabase.from('annonces').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('statut', 'active'),
      supabase.from('avis').select('note').eq('vendeur_id', userId),
    ]).then(([annoncesRes, avisRes]) => {
      const annoncesCount = annoncesRes.count ?? 0;
      const avisData = (avisRes.data || []) as { note: number }[];
      const avgNote = avisData.length > 0
        ? avisData.reduce((s, a) => s + a.note, 0) / avisData.length
        : null;
      setStats({ annonces: annoncesCount, avis: avisData.length, avgNote });
    });
  }, [session?.user?.id]);

  const openEditModal = () => {
    if (!session) return;
    setEditPrenom(user?.prenom || '');
    setEditNom(user?.nom || '');
    setEditBio(user?.bio || '');
    setEditTelephone(user?.telephone || '');
    setEditWhatsapp(user?.whatsapp || '');
    setEditInstagram(user?.instagram || '');
    setEditTiktok(user?.tiktok || '');
    setEditFacebook(user?.facebook || '');
    setEditAvatarUri(user?.avatar_url || null);
    setEditAvatarBase64(null);
    setIsEditing(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise pour accéder aux photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setEditAvatarUri(result.assets[0].uri);
      setEditAvatarBase64(result.assets[0].base64);
    }
  };

  const handleAvatarPress = async () => {
    if (!session) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour changer votre photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;
    try {
      setIsUploadingAvatar(true);
      const filePath = `${session.user.id}/avatar.png`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(result.assets[0].base64), { contentType: 'image/png', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', session.user.id);
      if (error) throw error;
      await refreshUser();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d\'uploader la photo.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!session) return;
    const userId = session.user.id;
    try {
      setIsSaving(true);
      let avatarUrlToSave = user?.avatar_url || null;
      if (editAvatarBase64) {
        // On utilise un nom de fichier fixe pour éviter de multiplier les fichiers inutiles
        const filePath = `${userId}/avatar.png`;
        
        console.log("📤 [Upload] Tentative d'upload vers :", filePath);
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(editAvatarBase64), { 
            contentType: 'image/png', 
            upsert: true 
          });

        if (uploadError) {
          console.error("❌ [Upload Error] :", uploadError);
          throw new Error(`Erreur lors de l'upload de l'image: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrlToSave = `${data.publicUrl}?t=${Date.now()}`; // Ajout d'un cache-buster
        console.log("✅ [Upload Success] URL publique :", avatarUrlToSave);
      }
      const { error } = await supabase.from('users').upsert({
        id: userId,
        prenom: editPrenom.trim(),
        nom: editNom.trim(),
        bio: editBio.trim(),
        telephone: editTelephone.trim(),
        whatsapp: editWhatsapp.trim(),
        instagram: editInstagram.trim(),
        tiktok: editTiktok.trim(),
        facebook: editFacebook.trim(),
        avatar_url: avatarUrlToSave,
      }, { onConflict: 'id' });
      if (error) throw error;
      await refreshUser();
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder.');
    } finally {
      setIsSaving(false);
    }
  };

  const openLink = (prefix: string, value: string) => {
    if (!value) return;
    const url = value.startsWith('http') || value.startsWith('tel:') ? value : prefix + value.replace('@', '');
    Linking.openURL(url).catch(() => Alert.alert('Impossible d\'ouvrir ce lien.'));
  };

  const onMenuItemPress = (item: any) => {
    if (item.private && !session) { navigation.navigate('Login'); return; }
    if (item.screen) {
      navigation.navigate(item.screen, item.params || {});
    } else {
      navigation.navigate('Placeholder', { title: item.label });
    }
  };

  const displayName = session
    ? `${user?.prenom || 'Nouveau'} ${user?.nom || 'Client'}`.trim()
    : 'Invité';

  const activeSocials = SOCIAL_FIELDS.filter(f => user?.[f.key]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header vert avec avatar */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Profil</Text>
            {session && (
              <TouchableOpacity style={styles.editBtn} onPress={openEditModal} activeOpacity={0.8}>
                <Feather name="edit-2" size={16} color="#fff" />
                <Text style={styles.editBtnText}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={session ? handleAvatarPress : undefined}
            activeOpacity={0.9}
          >
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {session ? (user?.prenom?.charAt(0) || '?').toUpperCase() : '👤'}
                </Text>
              </View>
            )}
            {isUploadingAvatar ? (
              <View style={[styles.avatarCameraBadge, { backgroundColor: 'rgba(0,0,0,0.5)', width: 90, height: 90, borderRadius: 45, bottom: 0, right: 0, left: 0, top: 0 }]}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : session ? (
              <View style={styles.avatarCameraBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            ) : null}
          </TouchableOpacity>

          <Text style={styles.displayName}>{displayName}</Text>
          {user?.bio ? (
            <Text style={styles.bioText}>{user.bio}</Text>
          ) : session ? (
            <TouchableOpacity onPress={openEditModal}>
              <Text style={styles.addBioText}>+ Ajouter une bio</Text>
            </TouchableOpacity>
          ) : null}

          {/* Réseaux sociaux actifs */}
          {activeSocials.length > 0 && (
            <View style={styles.socialsRow}>
              {activeSocials.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.socialIcon, { backgroundColor: f.color }]}
                  onPress={() => openLink(f.prefix, user![f.key]!)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={f.icon as any} size={18} color="#fff" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!session && (
            <TouchableOpacity style={styles.loginPromptBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginPromptText}>Se connecter / S'inscrire</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          {/* Stats */}
          {session && (
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.annonces}</Text>
                <Text style={styles.statLabel}>Annonces</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.avis}</Text>
                <Text style={styles.statLabel}>Avis reçus</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                {stats.avgNote !== null ? (
                  <>
                    <StarRow note={stats.avgNote} size={14} theme={theme} />
                    <Text style={styles.statLabel}>{stats.avgNote.toFixed(1)} / 5</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.statValue}>—</Text>
                    <Text style={styles.statLabel}>Note</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Contacts rapides */}
          {session && (user?.telephone || user?.whatsapp) && (
            <View style={styles.contactCard}>
              <Text style={styles.sectionLabel}>Mes contacts publics</Text>
              {user.telephone && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => Linking.openURL(`tel:${user.telephone}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactIconBox, { backgroundColor: '#15803d22' }]}>
                    <Ionicons name="call-outline" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.contactText}>{user.telephone}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
              {user.whatsapp && (
                <TouchableOpacity
                  style={[styles.contactRow, !user.telephone && {}]}
                  onPress={() => Linking.openURL(`https://wa.me/${user.whatsapp?.replace(/[^0-9]/g, '')}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactIconBox, { backgroundColor: '#25D36622' }]}>
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  </View>
                  <Text style={styles.contactText}>{user.whatsapp}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Menu */}
          {MENU_ITEMS.map((section) => (
            <View key={section.section} style={styles.menuSection}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{section.section}</Text>
              <View style={[styles.menuCard, { backgroundColor: theme.surface }]}>
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.menuItem, index < section.items.length - 1 && [styles.menuItemBorder, { borderBottomColor: theme.divider }]]}
                    activeOpacity={0.7}
                    onPress={() => item.type === 'toggle' ? toggleTheme() : onMenuItemPress(item)}
                  >
                    <View style={styles.menuItemLeft}>
                      <View style={[styles.menuIconBox, { backgroundColor: theme.primaryFaded }]}>
                        <Feather name={item.icon as any} size={17} color={theme.primary} />
                      </View>
                      <Text style={[styles.menuItemLabel, { color: theme.textPrimary }]}>{item.label}</Text>
                    </View>
                    <View style={styles.menuItemRight}>
                      {item.type === 'toggle' ? (
                        <View style={[styles.toggleContainer, { backgroundColor: isDark ? theme.primary : theme.border }]}>
                          <View style={[styles.toggleCircle, { transform: [{ translateX: isDark ? 20 : 0 }] }]} />
                        </View>
                      ) : (
                        <>
                          {'value' in item && <Text style={[styles.menuItemValue, { color: theme.textMuted }]}>{(item as any).value}</Text>}
                          <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Déconnexion */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              if (!session) { navigation.navigate('Login'); return; }
              Alert.alert('Déconnexion', 'Êtes-vous sûr ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnexion', style: 'destructive', onPress: signOut },
              ]);
            }}
            activeOpacity={0.7}
          >
            <Feather name={session ? 'log-out' : 'log-in'} size={18} color={session ? COLORS.error : COLORS.primary} />
            <Text style={[styles.logoutText, !session && { color: COLORS.primary }]}>
              {session ? 'Déconnexion' : 'Se connecter'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { marginTop: SPACING.md, backgroundColor: theme.surface, borderRadius: RADIUS.lg }]}
            onPress={async () => {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "Nouveau message ! 📬",
                  body: "Vous avez reçu un message pour l'annonce 'iPhone 15 Pro'",
                  data: { conversationId: 'test-id', titreAnnonce: 'iPhone 15 Pro' },
                },
                trigger: { seconds: 2 },
              });
              Alert.alert("Notification test", "La notification arrivera dans 2 secondes. Fermez l'app ou attendez.");
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: theme.primaryFaded }]}>
                <Ionicons name="notifications-outline" size={17} color={theme.primary} />
              </View>
              <Text style={styles.menuItemLabel}>Tester les notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
          </TouchableOpacity>

          <Text style={styles.version}>Flash Market v2.0</Text>
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Modal d'édition */}
      <Modal visible={isEditing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditing(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Ionicons name="close" size={26} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Modifier le profil</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Text style={styles.modalSave}>Valider</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Avatar */}
            <TouchableOpacity style={styles.modalAvatar} onPress={pickImage} activeOpacity={0.8}>
              {editAvatarUri
                ? <Image source={{ uri: editAvatarUri }} style={styles.modalAvatarImage} />
                : <Ionicons name="camera" size={32} color={COLORS.textInverse} />
              }
              <View style={styles.modalAvatarOverlay}>
                <Ionicons name="pencil" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Identité */}
            <Text style={styles.modalSectionLabel}>Identité</Text>
            <View style={styles.modalRow}>
              <View style={[styles.modalField, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Prénom</Text>
                <TextInput style={styles.fieldInput} value={editPrenom} onChangeText={setEditPrenom} placeholder="Amadou" />
              </View>
              <View style={{ width: SPACING.md }} />
              <View style={[styles.modalField, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Nom</Text>
                <TextInput style={styles.fieldInput} value={editNom} onChangeText={setEditNom} placeholder="Coulibaly" />
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Bio / Description</Text>
              <TextInput
                style={[styles.fieldInput, { height: 80, textAlignVertical: 'top' }]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Vendeur de téléphones à Bamako · Livraison disponible"
                multiline
              />
            </View>

            {/* Contacts */}
            <Text style={styles.modalSectionLabel}>Contacts & Réseaux</Text>
            {SOCIAL_FIELDS.map(f => (
              <View key={f.key} style={styles.modalField}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name={f.icon as any} size={15} color={f.color} />
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                </View>
                <TextInput
                  style={styles.fieldInput}
                  value={
                    f.key === 'telephone' ? editTelephone :
                    f.key === 'whatsapp' ? editWhatsapp :
                    f.key === 'instagram' ? editInstagram :
                    f.key === 'tiktok' ? editTiktok : editFacebook
                  }
                  onChangeText={
                    f.key === 'telephone' ? setEditTelephone :
                    f.key === 'whatsapp' ? setEditWhatsapp :
                    f.key === 'instagram' ? setEditInstagram :
                    f.key === 'tiktok' ? setEditTiktok : setEditFacebook
                  }
                  placeholder={f.placeholder}
                  keyboardType={f.key === 'telephone' || f.key === 'whatsapp' ? 'phone-pad' : 'default'}
                  autoCapitalize="none"
                />
              </View>
            ))}
            <View style={{ height: 80 }} />
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // Header vert
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: '#fff' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md, paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  editBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: '#fff' },

  // Avatar
  avatarWrapper: { position: 'relative', marginBottom: SPACING.lg },
  avatarImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#fff' },
  avatarFallback: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  avatarInitial: { fontSize: FONTS.xxxl, fontWeight: FONTS.bold, color: '#fff' },
  avatarCameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.primaryDark,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  displayName: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: '#fff', marginBottom: 4 },
  bioText: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18, marginBottom: SPACING.md, paddingHorizontal: SPACING.lg },
  addBioText: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.6)', marginBottom: SPACING.md },

  socialsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  socialIcon: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },

  loginPromptBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xxl, paddingVertical: 11,
    backgroundColor: '#fff', borderRadius: RADIUS.full,
  },
  loginPromptText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },

  // Body
  body: { padding: SPACING.xl },

  // Stats
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  statLabel: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: theme.borderLight },

  // Contact card
  contactCard: {
    backgroundColor: theme.surface, borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl, overflow: 'hidden', ...SHADOWS.sm,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.borderLight,
    gap: SPACING.md,
  },
  contactIconBox: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  contactText: { flex: 1, fontSize: FONTS.md, color: theme.textPrimary, fontWeight: FONTS.medium },

  // Sections
  sectionLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.semibold,
    color: theme.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: SPACING.md, marginLeft: 2,
  },
  menuSection: { marginBottom: SPACING.xl },
  menuCard: { backgroundColor: theme.surface, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  menuIconBox: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  menuItemLabel: { fontSize: FONTS.md, fontWeight: FONTS.medium, color: theme.textPrimary },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  menuItemValue: { fontSize: FONTS.sm, color: theme.textMuted },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, marginTop: SPACING.md },
  logoutText: { fontSize: FONTS.md, fontWeight: FONTS.semibold },
  version: { textAlign: 'center', fontSize: FONTS.xs, color: theme.textMuted, marginTop: SPACING.sm },

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

  // Modal
  modal: { flex: 1, backgroundColor: theme.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.borderLight,
  },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  modalSave: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.primary },
  modalBody: { padding: SPACING.xl },
  modalAvatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: theme.primary,
    alignSelf: 'center', marginBottom: SPACING.xxl,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  modalAvatarImage: { width: '100%', height: '100%' },
  modalAvatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 26, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalSectionLabel: {
    fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: SPACING.md, marginTop: SPACING.xl,
  },
  modalRow: { flexDirection: 'row' },
  modalField: { marginBottom: SPACING.lg },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  fieldLabel: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: theme.surface, borderWidth: 1,
    borderColor: theme.borderLight, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONTS.md, color: theme.textPrimary,
  },
});
