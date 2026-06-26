import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform, Dimensions, Linking,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, Annonce } from '../lib/supabase';
import { useSellerAvis, Avis } from '../hooks/useAvis';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - SPACING.xl * 2 - SPACING.md) / 2;

function formatPrix(prix: number): string {
  if (prix >= 1000000) return (prix / 1000000).toFixed(1) + 'M FCFA';
  return prix.toLocaleString('fr-FR') + ' FCFA';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return `${Math.floor(diff / 604800)}sem`;
}

function StarRow({ note, size = 14, theme }: { note: number; size?: number; theme: any }) {
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

interface Props {
  navigation: any;
}

const SOCIAL_FIELDS = [
  { key: 'telephone', label: 'Téléphone', icon: 'call-outline', color: '#15803d', prefix: 'tel:', placeholder: '+223 XX XX XX XX' },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: 'logo-whatsapp', color: '#25D366', prefix: 'https://wa.me/', placeholder: '+223XXXXXXXX' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C', prefix: 'https://instagram.com/', placeholder: '@votre_compte' },
  { key: 'tiktok',   label: 'TikTok',    icon: 'musical-notes-outline', color: '#010101', prefix: 'https://tiktok.com/@', placeholder: '@votre_compte' },
  { key: 'facebook', label: 'Facebook',  icon: 'logo-facebook', color: '#1877F2', prefix: 'https://facebook.com/', placeholder: 'Votre page' },
] as const;

export default function ProfileScreen({ navigation }: Props) {
  const { session, user, signOut, refreshUser } = useAuth();
  const { theme, isDark } = useTheme();
  const { avis, avgNote, loading: loadingAvis } = useSellerAvis(session?.user?.id);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'vitrine' | 'annonces' | 'avis'>('vitrine');

  // Edit states
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
  const [editTypeCompte, setEditTypeCompte] = useState<'particulier' | 'professionnel'>('particulier');
  const [editBanniereUri, setEditBanniereUri] = useState<string | null>(null);
  const [editBanniereBase64, setEditBanniereBase64] = useState<string | null>(null);
  const [editImagesBusiness, setEditImagesBusiness] = useState<string[]>([]);
  const [editImagesBusinessBase64, setEditImagesBusinessBase64] = useState<(string | null)[]>([]);

  // User's listings states
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loadingAnnonces, setLoadingAnnonces] = useState(false);

  // Full-screen image viewer states
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerScrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    if (viewerVisible) {
      setTimeout(() => {
        viewerScrollViewRef.current?.scrollTo({ x: viewerIndex * W, animated: false });
      }, 100);
    }
  }, [viewerVisible]);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // Fetch own listings
  useEffect(() => {
    if (!session) return;
    setLoadingAnnonces(true);
    supabase
      .from('annonces')
      .select('*, images:images_annonce(image_url, ordre)')
      .eq('user_id', session.user.id)
      .eq('statut', 'active')
      .eq('est_payee', true)
      .order('date_creation', { ascending: false })
      .then(({ data }) => {
        if (data) setAnnonces(data as Annonce[]);
        setLoadingAnnonces(false);
      });
  }, [session?.user?.id, isEditing]);

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
    setEditTypeCompte(user?.type_compte || 'particulier');
    setEditBanniereUri(user?.banniere_url || null);
    setEditBanniereBase64(null);
    setEditImagesBusiness(user?.images_business || []);
    setEditImagesBusinessBase64((user?.images_business || []).map(() => null));
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

  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const handleBannerPress = async () => {
    if (!session) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour changer votre bannière.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [16, 9], quality: 0.7, base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;
    try {
      setIsUploadingBanner(true);
      const filePath = `${session.user.id}/banner.png`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(result.assets[0].base64), { contentType: 'image/png', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const banniereUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error } = await supabase.from('users').update({ banniere_url: banniereUrl }).eq('id', session.user.id);
      if (error) throw error;
      await refreshUser();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d\'uploader la bannière.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!session) return;
    const userId = session.user.id;
    try {
      setIsSaving(true);
      
      let avatarUrlToSave = user?.avatar_url || null;
      if (editAvatarBase64) {
        const filePath = `${userId}/avatar.png`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(editAvatarBase64), { 
            contentType: 'image/png', 
            upsert: true 
          });

        if (uploadError) {
          throw new Error(`Erreur lors de l'upload de l'avatar: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrlToSave = `${data.publicUrl}?t=${Date.now()}`;
      }

      let banniereUrlToSave = user?.banniere_url || null;
      if (editBanniereBase64) {
        const filePath = `${userId}/banner.png`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(editBanniereBase64), { 
            contentType: 'image/png', 
            upsert: true 
          });

        if (uploadError) {
          throw new Error(`Erreur lors de l'upload de la bannière: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        banniereUrlToSave = `${data.publicUrl}?t=${Date.now()}`;
      } else if (editTypeCompte === 'particulier') {
        banniereUrlToSave = null;
      }

      let businessUrlsToSave: string[] = [];
      if (editTypeCompte === 'professionnel') {
        for (let i = 0; i < editImagesBusiness.length; i++) {
          const uri = editImagesBusiness[i];
          const base64 = editImagesBusinessBase64[i];
          if (base64) {
            const filePath = `${userId}/business_${i}.png`;
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, decode(base64), { 
                contentType: 'image/png', 
                upsert: true 
              });
            if (uploadError) {
              throw new Error(`Erreur lors de l'upload de la photo business ${i+1}: ${uploadError.message}`);
            }
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            businessUrlsToSave.push(`${data.publicUrl}?t=${Date.now()}`);
          } else if (uri.startsWith('http')) {
            businessUrlsToSave.push(uri);
          }
        }
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
        type_compte: editTypeCompte,
        banniere_url: banniereUrlToSave,
        images_business: businessUrlsToSave,
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

  const displayName = session
    ? `${user?.prenom || 'Nouveau'} ${user?.nom || 'Client'}`.trim()
    : 'Invité';

  const activeSocials = SOCIAL_FIELDS.filter(f => user?.[f.key]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header avec bannière et avatar */}
        <View style={[styles.header, user?.type_compte === 'professionnel' && styles.proHeader]}>
          {user?.type_compte === 'professionnel' && user?.banniere_url ? (
            <Image source={{ uri: user.banniere_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
          {user?.type_compte === 'professionnel' && user?.banniere_url ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          ) : null}
          {isUploadingBanner && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}

          {/* Top Bar - Titre et Paramètres */}
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Profil</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {session && user?.type_compte === 'professionnel' && (
                <>
                  <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('VendeurProfile', { vendeurId: session.user.id })} activeOpacity={0.8}>
                    <Ionicons name="eye-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Photo de profil */}
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

          {/* Nom et type de compte */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.xs }}>
            <Text style={styles.displayName}>{displayName}</Text>
            {session && (
              <View style={{ backgroundColor: user?.type_compte === 'professionnel' ? theme.primary : 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.xs }}>
                <Text style={{ fontSize: 10, fontWeight: FONTS.bold, color: '#fff' }}>
                  {user?.type_compte === 'professionnel' ? 'PRO' : 'Particulier'}
                </Text>
              </View>
            )}
          </View>

          {/* Note globale (étoiles) */}
          {session && (
            <View style={styles.ratingHeaderRow}>
              {avgNote !== null ? (
                <>
                  <StarRow note={avgNote} size={14} theme={theme} />
                  <Text style={styles.ratingHeaderText}>{avgNote.toFixed(1)} / 5 ({avis.length} avis)</Text>
                </>
              ) : (
                <Text style={styles.ratingHeaderText}>Aucun avis reçu</Text>
              )}
            </View>
          )}

          {/* Boutons d'action principaux */}
          {session ? (
            <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal} activeOpacity={0.8}>
              <Feather name="edit-3" size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.editProfileBtnText}>
                {user?.type_compte === 'professionnel' ? 'Modifier le profil vitrine' : 'Modifier le profil'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginPromptBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginPromptText}>Se connecter / S'inscrire</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Body du Profil */}
        {session ? (
          <View style={styles.body}>

            {session && (!user?.email || user.email.endsWith('@phone.market')) && (
              <View style={styles.emailBanner}>
                <View style={styles.emailBannerContent}>
                  <View style={styles.emailBannerIcon}>
                    <Ionicons name="shield-half-outline" size={20} color={theme.primary} />
                  </View>
                  <View style={styles.emailBannerTextContainer}>
                    <Text style={styles.emailBannerTitle}>Sécurisez votre compte</Text>
                    <Text style={styles.emailBannerDesc}>
                      Associez une adresse e-mail pour certifier votre numéro de téléphone et récupérer votre compte en cas d'oubli de mot de passe.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.emailBannerBtn}
                  onPress={() => navigation.navigate('LinkEmail')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emailBannerBtnText}>Lier mon adresse e-mail</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Barre d'onglets (Vitrine, Annonces, Avis) */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'vitrine' && styles.tabButtonActive]} 
                onPress={() => setActiveTab('vitrine')}
              >
                <Ionicons name="storefront-outline" size={18} color={activeTab === 'vitrine' ? theme.primary : theme.textMuted} />
                <Text style={[styles.tabLabel, { color: activeTab === 'vitrine' ? theme.textPrimary : theme.textMuted }]}>Vitrine</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'annonces' && styles.tabButtonActive]} 
                onPress={() => setActiveTab('annonces')}
              >
                <Ionicons name="pricetags-outline" size={18} color={activeTab === 'annonces' ? theme.primary : theme.textMuted} />
                <Text style={[styles.tabLabel, { color: activeTab === 'annonces' ? theme.textPrimary : theme.textMuted }]}>
                  Annonces ({loadingAnnonces ? '…' : annonces.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'avis' && styles.tabButtonActive]} 
                onPress={() => setActiveTab('avis')}
              >
                <Ionicons name="star-outline" size={18} color={activeTab === 'avis' ? theme.primary : theme.textMuted} />
                <Text style={[styles.tabLabel, { color: activeTab === 'avis' ? theme.textPrimary : theme.textMuted }]}>
                  Avis ({loadingAvis ? '…' : avis.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Contenu de l'onglet actif */}
            {activeTab === 'vitrine' && (
              <View style={styles.tabContent}>
                
                {/* Section Biographie / Description de la boutique */}
                <Text style={styles.sectionLabel}>À propos / Biographie</Text>
                <View style={[styles.card, styles.bioCard]}>
                  {user?.bio ? (
                    <Text style={styles.bioText}>{user.bio}</Text>
                  ) : (
                    <TouchableOpacity onPress={openEditModal} style={styles.addBioPlaceholder}>
                      <Ionicons name="add-circle-outline" size={24} color={theme.textMuted} />
                      <Text style={styles.addBioPlaceholderText}>Ajouter une description pour votre boutique vitrine</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Section Photos d'activité (Vitrine) */}
                <Text style={styles.sectionLabel}>Photos d'activité (Vitrine)</Text>
                {user?.type_compte === 'professionnel' ? (
                  <View style={[styles.card, { paddingVertical: SPACING.md }]}>
                    {user.images_business && user.images_business.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md, paddingHorizontal: SPACING.lg }}>
                        {user.images_business.map((imgUrl, idx) => (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.9}
                            onPress={() => {
                              setViewerIndex(idx);
                              setViewerVisible(true);
                            }}
                          >
                            <Image source={{ uri: imgUrl }} style={styles.vitrineImage} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : (
                      <TouchableOpacity onPress={openEditModal} style={styles.addPhotosPlaceholder}>
                        <Ionicons name="images-outline" size={28} color={theme.primary} />
                        <Text style={styles.addPhotosPlaceholderText}>+ Ajouter des photos de vos produits/plats</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={[styles.card, styles.proOnlyCard]}>
                    <Ionicons name="lock-closed-outline" size={24} color={theme.textMuted} style={{ marginBottom: 4 }} />
                    <Text style={styles.proOnlyText}>Passez votre compte en mode "Professionnel" pour afficher des photos de votre vitrine d'activité.</Text>
                    <TouchableOpacity style={styles.upgradeBtn} onPress={openEditModal}>
                      <Text style={styles.upgradeBtnText}>Devenir Professionnel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Section Contacts Publics */}
                <Text style={styles.sectionLabel}>Contacts & Réseaux Sociaux</Text>
                <View style={[styles.card, { padding: 0 }]}>
                  {/* Téléphone */}
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={user?.telephone ? () => Linking.openURL(`tel:${user.telephone}`) : openEditModal}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.contactIconBox, { backgroundColor: '#15803d15' }]}>
                      <Ionicons name="call-outline" size={18} color={theme.primary} />
                    </View>
                    <Text style={[styles.contactText, !user?.telephone && { color: theme.textMuted }]}>
                      {user?.telephone || 'Ajouter un numéro de téléphone public'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                  </TouchableOpacity>

                  {/* WhatsApp */}
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={user?.whatsapp ? () => Linking.openURL(`https://wa.me/${user.whatsapp?.replace(/[^0-9]/g, '')}`) : openEditModal}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.contactIconBox, { backgroundColor: '#25D36615' }]}>
                      <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                    </View>
                    <Text style={[styles.contactText, !user?.whatsapp && { color: theme.textMuted }]}>
                      {user?.whatsapp || 'Ajouter un contact WhatsApp'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                  </TouchableOpacity>

                  {/* Réseaux sociaux actifs */}
                  {activeSocials.length > 0 ? (
                    <View style={styles.socialsBadgeContainer}>
                      {activeSocials.map(f => (
                        <TouchableOpacity
                          key={f.key}
                          style={[styles.socialBadge, { backgroundColor: f.color }]}
                          onPress={() => openLink(f.prefix, user![f.key]!)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={f.icon as any} size={15} color="#fff" />
                          <Text style={styles.socialBadgeLabel}>{f.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <TouchableOpacity onPress={openEditModal} style={styles.addSocialPlaceholder}>
                      <Ionicons name="logo-instagram" size={16} color={theme.textMuted} />
                      <Text style={styles.addSocialPlaceholderText}>Lier vos réseaux (Instagram, TikTok, Facebook...)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {activeTab === 'annonces' && (
              <View style={styles.tabContent}>
                {loadingAnnonces ? (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
                ) : annonces.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="pricetags-outline" size={48} color={theme.borderLight} />
                    <Text style={styles.emptyText}>Aucune annonce en ligne</Text>
                    <TouchableOpacity style={styles.publishPromptBtn} onPress={() => navigation.navigate('Publier')}>
                      <Text style={styles.publishPromptText}>Publier ma première annonce</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {annonces.map((item, index) => {
                      const imageUrl = item.images?.[0]?.image_url || null;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.annonceCard, index % 2 === 1 && { marginLeft: SPACING.md }]}
                          onPress={() => navigation.navigate('AnnonceDetail', { annonce: item })}
                          activeOpacity={0.8}
                        >
                          {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.annonceImage} />
                          ) : (
                            <View style={[styles.annonceImage, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
                              <Ionicons name="image-outline" size={28} color={theme.borderLight} />
                            </View>
                          )}
                          <View style={styles.annonceInfo}>
                            <Text style={styles.annonceTitle} numberOfLines={2}>{item.titre}</Text>
                            <Text style={styles.annoncePrice}>{formatPrix(item.prix)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {activeTab === 'avis' && (
              <View style={styles.tabContent}>
                {loadingAvis ? (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
                ) : avis.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.borderLight} />
                    <Text style={styles.emptyText}>Vous n'avez pas encore reçu d'avis.</Text>
                  </View>
                ) : (
                  <View style={{ gap: SPACING.md }}>
                    {avis.map((a: Avis) => {
                      const authorName = a.auteur
                        ? `${a.auteur.prenom || ''} ${a.auteur.nom || ''}`.trim() || 'Anonyme'
                        : 'Anonyme';
                      
                      return (
                        <View key={a.id} style={[styles.card, styles.avisCard]}>
                          <View style={styles.avisHeader}>
                            {a.auteur?.avatar_url ? (
                              <Image source={{ uri: a.auteur.avatar_url }} style={styles.avisAvatar} />
                            ) : (
                              <View style={[styles.avisAvatar, { backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.primary }}>{authorName.charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary, marginBottom: 2 }}>{authorName}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <StarRow note={a.note} size={12} theme={theme} />
                                <Text style={{ fontSize: FONTS.xs, color: theme.textMuted }}>{timeAgo(a.date_creation)}</Text>
                              </View>
                            </View>
                          </View>
                          {a.commentaire ? <Text style={styles.avisCommentaire}>{a.commentaire}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

          </View>
        ) : (
          <View style={styles.guestBody}>
            <Ionicons name="storefront-outline" size={64} color={theme.borderLight} style={{ marginBottom: SPACING.lg }} />
            <Text style={styles.guestTitle}>Votre Espace Vitrine</Text>
            <Text style={styles.guestText}>Connectez-vous pour configurer votre boutique vitrine, ajouter des photos de vos plats/produits, gérer vos annonces de vente et recevoir les avis de vos clients.</Text>
            <TouchableOpacity style={styles.guestLoginBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.guestLoginBtnText}>Créer ou connecter mon compte</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal d'édition */}
      <Modal visible={isEditing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditing(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Ionicons name="close" size={26} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Modifier le profil vitrine</Text>
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
                {editAvatarUri ? (
                  <Image source={{ uri: editAvatarUri }} style={styles.modalAvatarImage} />
                ) : (
                  <Ionicons name="camera" size={32} color={COLORS.textInverse} />
                )}
                <View style={styles.modalAvatarOverlay}>
                  <Ionicons name="pencil" size={14} color="#fff" />
                </View>
              </TouchableOpacity>

              {/* Type de compte */}
              <Text style={styles.modalSectionLabel}>Type de compte</Text>
              <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg }}>
                <TouchableOpacity
                  style={[
                    styles.accountTypeOption,
                    editTypeCompte === 'particulier' ? { backgroundColor: theme.primary, borderColor: theme.primary } : { backgroundColor: theme.surfaceMuted }
                  ]}
                  onPress={() => setEditTypeCompte('particulier')}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: FONTS.sm, fontWeight: FONTS.bold, color: editTypeCompte === 'particulier' ? '#fff' : theme.textSecondary }}>
                    Particulier
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.accountTypeOption,
                    editTypeCompte === 'professionnel' ? { backgroundColor: theme.primary, borderColor: theme.primary } : { backgroundColor: theme.surfaceMuted }
                  ]}
                  onPress={() => setEditTypeCompte('professionnel')}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: FONTS.sm, fontWeight: FONTS.bold, color: editTypeCompte === 'professionnel' ? '#fff' : theme.textSecondary }}>
                    Professionnel (Vitrine)
                  </Text>
                </TouchableOpacity>
              </View>

              {editTypeCompte === 'professionnel' && (
                <View>
                  {/* Couverture/Bannière */}
                  <Text style={styles.modalSectionLabel}>Bannière de couverture (Vitrine)</Text>
                  <TouchableOpacity
                    style={styles.modalBannerSelector}
                    onPress={async () => {
                      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (status !== 'granted') { Alert.alert('Permission requise pour accéder aux photos.'); return; }
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        allowsEditing: true, aspect: [16, 9], quality: 0.7, base64: true,
                      });
                      if (!result.canceled && result.assets[0].base64) {
                        setEditBanniereUri(result.assets[0].uri);
                        setEditBanniereBase64(result.assets[0].base64);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    {editBanniereUri ? (
                      <Image source={{ uri: editBanniereUri }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Ionicons name="image-outline" size={24} color={theme.primary} />
                        <Text style={{ fontSize: FONTS.xs, color: theme.primary, fontWeight: FONTS.semibold }}>
                          Choisir une bannière
                        </Text>
                      </View>
                    )}
                    {editBanniereUri && (
                      <TouchableOpacity
                        style={styles.deleteBannerBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          setEditBanniereUri(null);
                          setEditBanniereBase64(null);
                        }}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>

                  {/* Photos d'activité (20 max, multi-sélection) */}
                  <Text style={styles.modalSectionLabel}>Photos de vitrine</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.lg }}>
                    <TouchableOpacity
                      style={styles.modalActivityPhotoAdd}
                      onPress={async () => {
                        if (editImagesBusiness.length >= 20) {
                          Alert.alert('Maximum atteint', 'Vous avez atteint la limite de photos pour votre vitrine.');
                          return;
                        }
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') { Alert.alert('Permission requise pour accéder aux photos.'); return; }
                        const remaining = 20 - editImagesBusiness.length;
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsMultipleSelection: true,
                          selectionLimit: remaining,
                          quality: 0.7,
                          base64: true,
                        });
                        if (!result.canceled && result.assets.length > 0) {
                          const newUris = result.assets.map(a => a.uri);
                          const newBase64s = result.assets.map(a => a.base64 || null);
                          setEditImagesBusiness([...editImagesBusiness, ...newUris].slice(0, 20));
                          setEditImagesBusinessBase64([...editImagesBusinessBase64, ...newBase64s].slice(0, 20));
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="images" size={28} color={theme.primary} />
                      <Text style={{ fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.primary }}>
                        {editImagesBusiness.length > 0 ? `+${editImagesBusiness.length}` : '+'}
                      </Text>
                    </TouchableOpacity>

                    {editImagesBusiness.map((uri, idx) => (
                      <View key={idx} style={{ position: 'relative' }}>
                        <Image source={{ uri }} style={styles.modalActivityPhotoItem} />
                        <TouchableOpacity
                          style={styles.deleteActivityPhotoBtn}
                          onPress={() => {
                            setEditImagesBusiness(editImagesBusiness.filter((_, i) => i !== idx));
                            setEditImagesBusinessBase64(editImagesBusinessBase64.filter((_, i) => i !== idx));
                          }}
                        >
                          <Ionicons name="close-circle" size={22} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

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
                <Text style={styles.fieldLabel}>Bio / Description de la vitrine</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 100, textAlignVertical: 'top' }]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Vendeur de téléphones à Bamako · Livraison disponible · Boutique physique à Faladié"
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

      {/* Full-screen Image Swiper Modal (Album Photo) */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          
          {/* Header */}
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerIndexText}>
              {viewerIndex + 1} / {user?.images_business?.length || 0}
            </Text>
            <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Swiper ScrollView */}
          <ScrollView
            ref={viewerScrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / W);
              setViewerIndex(idx);
            }}
            style={styles.viewerScrollView}
          >
            {user?.images_business?.map((imgUrl, idx) => (
              <View key={idx} style={styles.viewerImageWrapper}>
                <Image source={{ uri: imgUrl }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  emailBanner: {
    backgroundColor: isDark ? '#1E293B' : '#ECFDF5',
    borderWidth: 1,
    borderColor: isDark ? '#065F46' : '#A7F3D0',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  emailBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  emailBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? '#065F46' : '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emailBannerTextContainer: {
    flex: 1,
  },
  emailBannerTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  emailBannerDesc: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  emailBannerBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBannerBtnText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#fff',
  },

  // PRO Snapchat style header styles
  proHeaderContainer: {
    backgroundColor: theme.background,
    width: '100%',
  },
  bannerContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    backgroundColor: theme.borderLight,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerEditBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 5,
  },
  bannerTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 12,
    right: 12,
    zIndex: 5,
  },
  settingsBtnBanner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proProfileInfoContainer: {
    alignItems: 'center',
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    width: '100%',
  },
  proAvatarWrapper: {
    marginTop: -44,
    marginBottom: 8,
    position: 'relative',
    zIndex: 10,
  },
  proAvatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: theme.background,
  },
  proAvatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.background,
  },
  proAvatarInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  proAvatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.background,
  },
  proNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  proDisplayName: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.extrabold,
    color: theme.textPrimary,
  },
  proBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  proIdentifierText: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginBottom: 6,
  },
  proRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  proRatingText: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    fontWeight: FONTS.semibold,
  },
  proBioText: {
    fontSize: FONTS.sm,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: 12,
    lineHeight: 18,
  },
  snapActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  snapBtnFilled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    maxWidth: 140,
    ...SHADOWS.sm,
  },
  snapBtnTextFilled: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  snapBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    maxWidth: 140,
  },
  snapBtnTextOutline: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: theme.primary,
  },

  // Header vert
  header: {
    backgroundColor: theme.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    position: 'relative',
    ...SHADOWS.md,
  },
  proHeader: {
    paddingTop: Platform.OS === 'ios' ? 70 : 55,
    paddingBottom: 40,
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: '#fff' },
  settingsBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerActionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Avatar
  avatarWrapper: { position: 'relative', marginBottom: SPACING.md },
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

  displayName: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: '#fff' },
  ratingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  ratingHeaderText: { fontSize: FONTS.xs, color: '#fff', fontWeight: FONTS.semibold, opacity: 0.9 },

  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: SPACING.xl, paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  editProfileBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },

  loginPromptBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xxl, paddingVertical: 11,
    backgroundColor: '#fff', borderRadius: RADIUS.full,
  },
  loginPromptText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },

  // Body
  body: { padding: SPACING.lg },

  // Tabs navigation
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    padding: 4,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
  },
  tabButtonActive: {
    backgroundColor: theme.primaryFaded,
  },
  tabLabel: { fontSize: FONTS.xs, fontWeight: FONTS.bold },
  tabContent: { gap: SPACING.md },

  // Cards & Layouts
  card: {
    backgroundColor: theme.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  bioCard: {
    paddingVertical: SPACING.xl,
  },
  bioText: {
    fontSize: FONTS.md,
    color: theme.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  addBioPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  addBioPlaceholderText: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    fontWeight: FONTS.medium,
  },
  sectionLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    marginLeft: 4,
  },

  // Pro features
  vitrineImage: {
    width: 140,
    height: 140,
    borderRadius: RADIUS.lg,
  },
  addPhotosPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.lg,
  },
  addPhotosPlaceholderText: {
    fontSize: FONTS.xs,
    color: theme.primary,
    fontWeight: FONTS.bold,
  },
  proOnlyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  proOnlyText: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  upgradeBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  upgradeBtnText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#fff',
  },

  // Contacts Publics
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    gap: SPACING.md,
  },
  contactIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactText: {
    flex: 1,
    fontSize: FONTS.md,
    color: theme.textPrimary,
    fontWeight: FONTS.medium,
  },
  socialsBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    padding: SPACING.lg,
  },
  socialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  socialBadgeLabel: {
    fontSize: FONTS.xs,
    color: '#fff',
    fontWeight: FONTS.bold,
  },
  addSocialPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.lg,
  },
  addSocialPlaceholderText: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    fontWeight: FONTS.semibold,
  },

  // Active listings Tab
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.md,
    color: theme.textMuted,
    fontWeight: FONTS.medium,
  },
  publishPromptBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  publishPromptText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: SPACING.md,
  },
  annonceCard: {
    width: CARD_W,
    backgroundColor: theme.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  annonceImage: {
    width: '100%',
    height: CARD_W,
  },
  annonceInfo: {
    padding: SPACING.md,
  },
  annonceTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
    height: 38,
    lineHeight: 18,
  },
  annoncePrice: {
    fontSize: FONTS.md,
    fontWeight: FONTS.extrabold,
    color: theme.primary,
    marginTop: 4,
  },

  // Reviews Tab
  avisCard: {
    padding: SPACING.lg,
  },
  avisHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
  },
  avisAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avisCommentaire: {
    fontSize: FONTS.sm,
    color: theme.textSecondary,
    lineHeight: 20,
    marginTop: SPACING.md,
    paddingLeft: 2,
  },

  // Guest Space styling
  guestBody: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    fontSize: FONTS.xl,
    fontWeight: FONTS.extrabold,
    color: theme.textPrimary,
    marginBottom: SPACING.sm,
  },
  guestText: {
    fontSize: FONTS.sm,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xxl,
  },
  guestLoginBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
  },
  guestLoginBtnText: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: '#fff',
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
  accountTypeOption: {
    flex: 1, height: 46, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border
  },
  modalBannerSelector: {
    width: '100%',
    height: 120,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.primary,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.lg
  },
  deleteBannerBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 2 },
  modalActivityPhotoAdd: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.primary,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  modalActivityPhotoItem: { width: 100, height: 100, borderRadius: RADIUS.lg },
  deleteActivityPhotoBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: theme.surface, borderRadius: 12 },
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

  // Fullscreen Viewer Styles
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    zIndex: 10,
  },
  viewerIndexText: {
    color: '#fff',
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
  },
  viewerCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerScrollView: {
    width: W,
    flex: 1,
  },
  viewerImageWrapper: {
    width: W,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: W,
    height: '100%',
  },
});
