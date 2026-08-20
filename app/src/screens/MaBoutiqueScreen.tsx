import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, Platform, Alert, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Share, Switch, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, METIER_CATEGORIES, TYPES_ACTIVITE, DISPONIBILITES } from '../constants/theme';
import { supabase, Annonce, Catalogue } from '../lib/supabase';
import TintedChip from '../components/TintedChip';
import { formatNombre } from '../lib/format';
import { useRealisations, supprimerRealisation } from '../hooks/useRealisations';
import RealisationCard from '../components/RealisationCard';
import { pickImages } from '../lib/imagePicker';
import { IMAGE_SIZES, UPLOAD_CACHE_CONTROL } from '../lib/imageOptimizer';
import { decode } from 'base64-arraybuffer';
import ProduitGestionSheet from '../components/ProduitGestionSheet';
import { useShopFollowers } from '../hooks/useBoutiqueFollow';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - SPACING.lg * 2 - SPACING.md) / 2;
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  navigation: any;
}

// §6.4 : cinq entrees. « Demandes » ouvre l'ecran dedie plutot que de
// dupliquer une liste deja complete ailleurs.
const ONGLETS_PRO = [
  { cle: 'apercu',       label: "Vue d'ensemble", icone: 'speedometer-outline' },
  { cle: 'catalogue',    label: 'Catalogue',      icone: 'grid-outline' },
  { cle: 'demandes',     label: 'Demandes',       icone: 'receipt-outline' },
  { cle: 'performances', label: 'Performances',   icone: 'stats-chart-outline' },
  { cle: 'vitrine',      label: 'Ma vitrine',     icone: 'eye-outline' },
] as const;

const LIVRAISON_OPTIONS = [
  { key: 'disponible', label: 'Livraison disponible', icon: 'bicycle-outline' },
  { key: 'a_discuter', label: 'À discuter', icon: 'chatbubble-ellipses-outline' },
  { key: 'retrait', label: 'Retrait en boutique', icon: 'storefront-outline' },
] as const;

/** Slug URL à partir du nom de boutique : « Chez Fatim Élec » → chez-fatim-elec */
function slugify(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Gestion de la boutique PRO : identité (nom, lien, quartier, horaires,
 * livraison) + catalogue avec stock et masquage par produit.
 * Réservé aux comptes professionnels.
 */
export default function MaBoutiqueScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { session, user, refreshUser } = useAuth();

  const [produits, setProduits] = useState<Annonce[]>([]);
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [filtreCat, setFiltreCat] = useState<string>('all');
  const [commandes, setCommandes] = useState<{ statut: string; prix: number; quantite: number; produit_titre: string; date_creation: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Gestion d'un rayon (renommer / supprimer)
  const [catEditTarget, setCatEditTarget] = useState<Catalogue | null>(null);
  const [catEditNom, setCatEditNom] = useState('');
  const [catEditBusy, setCatEditBusy] = useState(false);
  const [gestionRayonsVisible, setGestionRayonsVisible] = useState(false);
  // Mises en relation sur 30 jours (§3.4). `null` = vue absente (migration pas
  // encore appliquee) : on affiche alors le message d'attente plutot que des
  // zeros, qui laisseraient croire que personne ne s'interesse a la boutique.
  const [contacts, setContacts] = useState<any | null>(null);
  // Navigation interne de l'Espace Pro (§6.4). « Demandes » n'est pas un
  // onglet de contenu : il ouvre l'ecran dedie, deja complet.
  const [onglet, setOnglet] = useState<'apercu' | 'catalogue' | 'performances' | 'vitrine'>('apercu');
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gestionTarget, setGestionTarget] = useState<Annonce | null>(null);

  // Champs d'édition
  const [nomBoutique, setNomBoutique] = useState('');
  const [quartier, setQuartier] = useState('');
  const [adresse, setAdresse] = useState('');
  const [horaires, setHoraires] = useState('');
  const [livraison, setLivraison] = useState<string | null>(null);
  const [fraisLivraison, setFraisLivraison] = useState('');
  const [categorieMetier, setCategorieMetier] = useState<string | null>(null);
  const [typeActivite, setTypeActivite] = useState<'produits' | 'services' | 'mixte'>('produits');
  const [zoneIntervention, setZoneIntervention] = useState('');
  const [delaiReponse, setDelaiReponse] = useState('');
  const [disponibilite, setDisponibilite] = useState<string>('rdv');

  // Portfolio avant/apres — ce qu'un artisan montre en premier.
  const { realisations, indisponible: realisationsIndispo, refetch: rechargerRealisations } =
    useRealisations(session?.user.id);
  // Abonnés de la boutique, visibles côté PRO dans l'onglet Performances.
  const { followers, count: followersCount, loading: followersLoading } =
    useShopFollowers(user?.id);
  const [ajoutRealisation, setAjoutRealisation] = useState(false);
  const [photoAvant, setPhotoAvant] = useState<{ uri: string; base64?: string } | null>(null);
  const [photoApres, setPhotoApres] = useState<{ uri: string; base64?: string } | null>(null);
  const [titreRealisation, setTitreRealisation] = useState('');
  const [envoiRealisation, setEnvoiRealisation] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const isPro = user?.type_compte === 'professionnel';

  const fetchProduits = useCallback(() => {
    if (!session) return;
    supabase
      .from('annonces')
      .select('*, images:images_annonce(image_url, ordre)')
      .eq('user_id', session.user.id)
      .in('statut', ['active', 'vendu'])
      .order('date_creation', { ascending: false })
      .then(({ data }) => {
        if (data) setProduits(data as Annonce[]);
        setLoading(false);
      });
    supabase
      .from('catalogues')
      .select('*')
      .eq('user_id', session.user.id)
      .order('ordre', { ascending: true })
      .order('date_creation', { ascending: true })
      .then(({ data }) => setCatalogues((data as Catalogue[]) || []));
    supabase
      .from('commandes')
      .select('statut, prix, quantite, produit_titre, date_creation')
      .eq('vendeur_id', session.user.id)
      .order('date_creation', { ascending: false })
      .limit(400)
      .then(({ data }) => setCommandes((data as any[]) || []));
    supabase
      .from('v_contacts_vendeur_30j')
      .select('*')
      .eq('vendeur_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => setContacts(error ? null : (data ?? { total: 0 })));
  }, [session]);

  useEffect(() => {
    fetchProduits();
  }, [fetchProduits]);

  async function choisirPhotoRealisation(quelle: 'avant' | 'apres') {
    const assets = await pickImages(
      { allowsMultipleSelection: false, base64: true },
      { maxSize: IMAGE_SIZES.annonce, base64: true }
    );
    if (!assets || assets.length === 0) return;
    const photo = { uri: assets[0].uri, base64: (assets[0] as any).base64 };
    if (quelle === 'avant') setPhotoAvant(photo);
    else setPhotoApres(photo);
  }

  async function envoyerPhoto(photo: { base64?: string } | null, suffixe: string): Promise<string | null> {
    if (!photo?.base64 || !session) return null;
    const nom = `realisations/${session.user.id}-${Date.now()}-${suffixe}.jpg`;
    const { error } = await supabase.storage
      .from('annonces-images')
      .upload(nom, decode(photo.base64), {
        contentType: 'image/jpeg', upsert: true, cacheControl: UPLOAD_CACHE_CONTROL,
      });
    if (error) return null;
    return supabase.storage.from('annonces-images').getPublicUrl(nom).data.publicUrl;
  }

  async function enregistrerRealisation() {
    if (!session || !photoApres) return;
    setEnvoiRealisation(true);
    const [avant, apres] = await Promise.all([
      envoyerPhoto(photoAvant, 'avant'),
      envoyerPhoto(photoApres, 'apres'),
    ]);
    if (!apres) {
      setEnvoiRealisation(false);
      Alert.alert('Envoi impossible', "La photo n'a pas pu être envoyée. Réessayez.");
      return;
    }
    const { error } = await supabase.from('realisations').insert({
      user_id: session.user.id,
      titre: titreRealisation.trim() || null,
      image_avant: avant,
      image_apres: apres,
      ordre: realisations.length,
    });
    setEnvoiRealisation(false);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setAjoutRealisation(false);
    setPhotoAvant(null);
    setPhotoApres(null);
    setTitreRealisation('');
    rechargerRealisations();
  }

  function confirmerSuppressionRealisation(id: string) {
    Alert.alert('Supprimer', 'Retirer cette réalisation de votre vitrine ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const err = await supprimerRealisation(id);
          if (err) Alert.alert('Erreur', err);
          else rechargerRealisations();
        },
      },
    ]);
  }

  async function toggleOuvert() {
    if (!session) return;
    const next = !(user?.ouvert_maintenant ?? true);
    await supabase.from('users').update({ ouvert_maintenant: next }).eq('id', session.user.id);
    refreshUser();
  }

  function openEdit() {
    setNomBoutique(user?.nom_boutique || '');
    setQuartier(user?.quartier_boutique || '');
    setAdresse(user?.adresse_boutique || '');
    setHoraires(user?.horaires || '');
    setLivraison(user?.livraison || null);
    setFraisLivraison(user?.frais_livraison || '');
    setCategorieMetier(user?.categorie_metier || null);
    setTypeActivite((user?.type_activite as any) || 'produits');
    setZoneIntervention(user?.zone_intervention || '');
    setDelaiReponse(user?.delai_reponse || '');
    setDisponibilite(user?.disponibilite || 'rdv');
    setEditVisible(true);
  }

  async function saveBoutique() {
    if (!session) return;
    if (nomBoutique.trim().length < 3) {
      Alert.alert('Nom requis', 'Donnez un nom à votre boutique (min. 3 caractères).');
      return;
    }
    setSaving(true);
    try {
      // Slug : généré à partir du nom, conservé s'il existe déjà (le lien
      // partagé ne doit pas casser), suffixe numérique en cas de collision.
      let slug = user?.boutique_slug || slugify(nomBoutique.trim());
      let updated = false;
      for (let tentative = 0; tentative < 4 && !updated; tentative++) {
        const { error } = await supabase
          .from('users')
          .update({
            nom_boutique: nomBoutique.trim(),
            boutique_slug: slug,
            quartier_boutique: quartier.trim() || null,
            adresse_boutique: adresse.trim() || null,
            horaires: horaires.trim() || null,
            livraison: livraison,
            frais_livraison: fraisLivraison.trim() || null,
            categorie_metier: categorieMetier,
            type_activite: typeActivite,
            zone_intervention: zoneIntervention.trim() || null,
            delai_reponse: delaiReponse.trim() || null,
            disponibilite: disponibilite,
          })
          .eq('id', session.user.id);
        if (!error) {
          updated = true;
        } else if (error.code === '23505') {
          slug = slugify(nomBoutique.trim()) + '-' + Math.floor(10 + Math.random() * 90);
        } else {
          throw error;
        }
      }
      if (!updated) throw new Error('Impossible de générer un lien unique, réessayez.');
      await refreshUser();
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'enregistrer la boutique.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduit(id: string, patch: Partial<Annonce>) {
    // Optimiste : l'UI répond immédiatement, rollback si erreur
    const avant = produits;
    setProduits(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from('annonces').update(patch).eq('id', id);
    if (error) {
      setProduits(avant);
      Alert.alert('Erreur', error.message);
    }
  }

  async function renommerRayon() {
    if (!catEditTarget || catEditNom.trim().length < 2) return;
    setCatEditBusy(true);
    const { error } = await supabase
      .from('catalogues')
      .update({ nom: catEditNom.trim() })
      .eq('id', catEditTarget.id);
    setCatEditBusy(false);
    if (error) {
      Alert.alert('Erreur', error.code === '23505'
        ? 'Vous avez déjà un rayon avec ce nom.'
        : error.message);
    } else {
      setCatEditTarget(null);
      fetchProduits();
    }
  }

  function supprimerRayon() {
    if (!catEditTarget) return;
    const nb = produits.filter(p => p.catalogue_id === catEditTarget.id).length;
    Alert.alert(
      'Supprimer ce rayon ?',
      nb > 0
        ? `Les ${nb} produit(s) du rayon « ${catEditTarget.nom} » ne seront pas supprimés : ils iront dans « Autres ».`
        : `Le rayon « ${catEditTarget.nom} » sera supprimé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('catalogues').delete().eq('id', catEditTarget.id);
            if (error) Alert.alert('Erreur', error.message);
            else {
              setCatEditTarget(null);
              setFiltreCat('all');
              fetchProduits();
            }
          },
        },
      ]
    );
  }

  async function shareBoutique() {
    const lien = user?.boutique_slug
      ? `https://app-flashmarket.com/b/${user.boutique_slug}`
      : 'https://app-flashmarket.com';
    try {
      await Share.share({
        message: `Découvre ma boutique « ${user?.nom_boutique || 'Flash Market'} » sur Flash Market : ${lien}`,
      });
    } catch {}
  }

  // Stats visuelles du mois en cours (règle : tout doit être visuel)
  const nbNouvellesCommandes = commandes.filter(c => c.statut === 'nouvelle').length;

  // §8.2 : « Les trois cartes Commandes, Livrees, Recettes sont insuffisantes
  // lorsque tout est a zero. Les vues et les favoris montrent de la valeur
  // avant la premiere vente. » Ces deux chiffres existent deja en base — il
  // suffisait de les afficher.
  const totalVues = produits.reduce((s, p) => s + (p.nombre_vues || 0), 0);
  const produitsLesPlusVus = [...produits]
    .sort((a, b) => (b.nombre_vues || 0) - (a.nombre_vues || 0))
    .slice(0, 5);
  const enRupture = produits.filter(p => p.stock === 0 && p.statut !== 'vendu');
  const masques = produits.filter(p => p.visible === false);

  // Taches prioritaires (§8.2) : ce qui demande une action, dans l'ordre ou
  // ca coute de l'argent au commercant.
  const taches: { cle: string; icone: string; texte: string; onPress: () => void }[] = [];
  if (nbNouvellesCommandes > 0) {
    taches.push({
      cle: 'demandes',
      icone: 'receipt-outline',
      texte: `${nbNouvellesCommandes} demande${nbNouvellesCommandes > 1 ? 's' : ''} sans reponse`,
      onPress: () => navigation.navigate('Commandes', { mode: 'vendeur' }),
    });
  }
  if (enRupture.length > 0) {
    taches.push({
      cle: 'rupture',
      icone: 'alert-circle-outline',
      texte: `${enRupture.length} produit${enRupture.length > 1 ? 's' : ''} en rupture`,
      onPress: () => setOnglet('catalogue'),
    });
  }
  if (produits.length === 0) {
    taches.push({
      cle: 'vide',
      icone: 'cube-outline',
      texte: 'Votre vitrine est vide : ajoutez votre premier article',
      onPress: () => navigation.navigate('AjouterProduit'),
    });
  }
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const commandesMois = commandes.filter(c =>
    new Date(c.date_creation) >= debutMois && c.statut !== 'annulee' && c.statut !== 'refusee'
  );
  const livreesMois = commandesMois.filter(c => c.statut === 'livree');
  const recettesMois = livreesMois.reduce((s, c) => s + c.prix * c.quantite, 0);
  const topProduit = (() => {
    const compte: Record<string, number> = {};
    commandesMois.forEach(c => { compte[c.produit_titre] = (compte[c.produit_titre] || 0) + 1; });
    const top = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] >= 2 ? top[0] : null;
  })();

  // Complétude : chaque info remplie donne envie de finir
  const completude = [
    !!user?.nom_boutique,
    !!user?.banniere_url,
    !!user?.quartier_boutique,
    !!user?.horaires,
    !!user?.livraison,
    produits.length > 0,
  ].filter(Boolean).length;
  const completudePct = Math.round((completude / 6) * 100);

  function renderHeader() {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ma boutique</Text>
        <TouchableOpacity style={styles.backBtn} onPress={shareBoutique} activeOpacity={0.8}>
          <Ionicons name="share-social-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  // Garde : réservé aux comptes PRO
  if (!isPro) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        {renderHeader()}
        <View style={styles.centerBox}>
          <Ionicons name="storefront-outline" size={48} color={theme.textMuted} />
          <Text style={styles.centerTitle}>Réservé aux boutiques PRO</Text>
          <Text style={styles.centerText}>
            Passez votre compte en mode « Professionnel » depuis votre profil pour créer votre boutique.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Retour au profil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ---- Bannière + navigation flottante ---- */}
        <View style={styles.heroWrap}>
          {user?.banniere_url ? (
            <Image source={{ uri: user.banniere_url }} style={styles.banner} />
          ) : (
            <View style={[styles.banner, styles.bannerPlaceholder]}>
              <Ionicons name="image-outline" size={22} color="rgba(255,255,255,.8)" />
              <Text style={styles.bannerPlaceholderText}>Ajoutez une bannière depuis « Modifier le profil »</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
          <TouchableOpacity style={[styles.roundBtn, styles.backPos]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundBtn, styles.sharePos]} onPress={shareBoutique} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

      <View style={styles.scrollContent}>
        {/* ---- Carte identité ---- */}
        <View style={styles.identityCard}>
          <View style={styles.identityBody}>
            <View style={styles.logoWrap}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoFallback]}>
                  <Text style={styles.logoInitial}>{(user?.nom_boutique || user?.prenom || '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.identityText}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.boutiqueName} numberOfLines={1}>
                  {user?.nom_boutique || 'Nommez votre boutique'}
                </Text>
                <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
              </View>
              {user?.quartier_boutique ? (
                <View style={styles.boutiqueMetaRow}>
                  <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                  <Text style={styles.boutiqueMeta} numberOfLines={1}>{user.quartier_boutique}</Text>
                  {user?.horaires && (
                    <>
                      <Text style={styles.boutiqueMetaDot}>·</Text>
                      <Ionicons name="time-outline" size={12} color={theme.textMuted} />
                      <Text style={styles.boutiqueMeta} numberOfLines={1}>{user.horaires}</Text>
                    </>
                  )}
                </View>
              ) : (
                <Text style={styles.boutiqueMeta} numberOfLines={1}>Quartier et horaires à renseigner</Text>
              )}
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {/* Jauge de complétude */}
          <View style={styles.completudeWrap}>
            <View style={styles.completudeHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {completudePct === 100 && (
                  <Ionicons name="checkmark-circle" size={15} color={theme.primary} style={{ marginRight: 5 }} />
                )}
                <Text style={styles.completudeLabel}>
                  {completudePct === 100 ? 'Boutique complète' : `Boutique complète à ${completudePct} %`}
                </Text>
              </View>
            </View>
            <View style={styles.completudeBarBg}>
              <View style={[styles.completudeBarFill, { width: `${completudePct}%` }]} />
            </View>
            {completudePct < 100 && (
              <Text style={styles.completudeHint}>
                {!user?.nom_boutique ? 'Commencez par nommer votre boutique.'
                  : !user?.banniere_url ? 'Ajoutez une bannière (Modifier le profil).'
                  : !user?.quartier_boutique ? 'Indiquez votre quartier.'
                  : !user?.horaires ? 'Renseignez vos horaires.'
                  : !user?.livraison ? 'Précisez votre politique de livraison.'
                  : 'Ajoutez votre premier produit.'}
              </Text>
            )}
          </View>
        </View>

        {/* ---- Navigation interne de l'Espace Pro (§6.4) ---- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ongletsRow}
        >
          {ONGLETS_PRO.map(o => (
            <TouchableOpacity
              key={o.cle}
              style={[styles.ongletChip, onglet === o.cle && styles.ongletChipActif]}
              onPress={() => {
                if (o.cle === 'demandes') {
                  navigation.navigate('Commandes', { mode: 'vendeur' });
                  return;
                }
                setOnglet(o.cle as any);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: onglet === o.cle }}
            >
              <Ionicons
                name={o.icone as any}
                size={15}
                color={onglet === o.cle ? '#fff' : theme.textSecondary}
              />
              <Text style={[styles.ongletTexte, onglet === o.cle && styles.ongletTexteActif]}>
                {o.label}
              </Text>
              {o.cle === 'demandes' && nbNouvellesCommandes > 0 && (
                <View style={styles.ongletPastille}>
                  <Text style={styles.ongletPastilleTexte}>{nbNouvellesCommandes}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ---- Vue d'ensemble : actions rapides puis taches (§8.2) ---- */}
        {onglet === 'apercu' && (
          <>
            <View style={styles.actionsRapides}>
              {[
                { cle: 'ajouter', icone: 'add-circle-outline', label: 'Ajouter',
                  onPress: () => navigation.navigate('AjouterProduit') },
                { cle: 'vitrine', icone: 'eye-outline', label: 'Ma vitrine',
                  onPress: () => navigation.navigate('Boutique', { vendeurId: session?.user.id }) },
                { cle: 'partager', icone: 'share-social-outline', label: 'Partager',
                  onPress: shareBoutique },
                { cle: 'demandes', icone: 'receipt-outline', label: 'Demandes',
                  onPress: () => navigation.navigate('Commandes', { mode: 'vendeur' }) },
              ].map(a => (
                <TouchableOpacity
                  key={a.cle}
                  style={styles.actionRapide}
                  onPress={a.onPress}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <View style={styles.actionRapideIcone}>
                    <Ionicons name={a.icone as any} size={20} color={theme.primary} />
                  </View>
                  <Text style={styles.actionRapideTexte}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {taches.length > 0 && (
              <View style={styles.tachesCard}>
                <Text style={styles.tachesTitre}>À faire</Text>
                {taches.map(t => (
                  <TouchableOpacity
                    key={t.cle}
                    style={styles.tacheRow}
                    onPress={t.onPress}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Ionicons name={t.icone as any} size={17} color={theme.secondary || '#d97706'} />
                    <Text style={styles.tacheTexte}>{t.texte}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {onglet === 'vitrine' && (
          <>
        {/* ---- Lien partageable ---- */}
        {user?.boutique_slug && (
          <TouchableOpacity style={styles.linkCard} onPress={shareBoutique} activeOpacity={0.8}>
            <Ionicons name="link-outline" size={18} color={theme.primary} />
            <Text style={styles.linkText} numberOfLines={1}>app-flashmarket.com/b/{user.boutique_slug}</Text>
            <Ionicons name="share-social-outline" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}

          </>
        )}
        {onglet === 'apercu' && (
          <>
        {/* ---- Ouvert maintenant ---- */}
        <View style={styles.ouvertCard}>
          <View style={[styles.ouvertDot, { backgroundColor: user?.ouvert_maintenant !== false ? theme.primary : theme.textMuted }]} />
          <Text style={styles.ouvertText}>
            {user?.ouvert_maintenant !== false ? 'Boutique ouverte' : 'Boutique fermée'}
          </Text>
          <Text style={styles.ouvertHint}>Visible sur votre page publique</Text>
          <Switch
            value={user?.ouvert_maintenant !== false}
            onValueChange={toggleOuvert}
            trackColor={{ false: theme.borderLight, true: theme.primaryFaded }}
            thumbColor={user?.ouvert_maintenant !== false ? theme.primary : theme.textMuted}
          />
        </View>

          </>
        )}
        {onglet === 'vitrine' && (
          <>
        {/* ---- Livraison ---- */}
        {user?.livraison && (
          <View style={styles.livraisonCard}>
            <Ionicons
              name={LIVRAISON_OPTIONS.find(o => o.key === user.livraison)?.icon as any}
              size={18} color={theme.primary}
            />
            <Text style={styles.livraisonText}>
              {LIVRAISON_OPTIONS.find(o => o.key === user.livraison)?.label}
              {user?.frais_livraison ? ` · ${user.frais_livraison}` : ''}
            </Text>
          </View>
        )}

          </>
        )}
        {onglet === 'apercu' && (
          <>
        {/* ---- Commandes reçues ---- */}
        <TouchableOpacity
          style={styles.commandesCard}
          onPress={() => navigation.navigate('Commandes', { mode: 'vendeur' })}
          activeOpacity={0.85}
        >
          <View style={styles.commandesIcon}>
            <Ionicons name="receipt-outline" size={20} color="#fff" />
            {nbNouvellesCommandes > 0 && (
              <View style={styles.commandesBadge}>
                <Text style={styles.commandesBadgeText}>{nbNouvellesCommandes}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.commandesTitle}>Commandes reçues</Text>
            <Text style={styles.commandesSub}>
              {nbNouvellesCommandes > 0
                ? `${nbNouvellesCommandes} nouvelle${nbNouvellesCommandes > 1 ? 's' : ''} commande${nbNouvellesCommandes > 1 ? 's' : ''} à traiter`
                : 'Aucune commande en attente'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>

          </>
        )}
        {(onglet === 'apercu' || onglet === 'performances') && (
          <>
        {/* ---- Ce mois-ci : le tableau de bord visuel du vendeur ---- */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>Ce mois-ci</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Ionicons name="cart-outline" size={16} color={theme.primary} />
            </View>
            <Text style={styles.statValue}>{commandesMois.length}</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Ionicons name="cube-outline" size={16} color={theme.primary} />
            </View>
            <Text style={styles.statValue}>{livreesMois.length}</Text>
            <Text style={styles.statLabel}>Livrées</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMoney]}>
            <View style={styles.statIconCircle}>
              <Ionicons name="cash-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.statValue, { color: theme.primary }]}>{recettesMois.toLocaleString('fr-FR')} F</Text>
            <Text style={styles.statLabel}>Recettes</Text>
          </View>
        </View>
        {topProduit && (
          <View style={styles.topProduitRow}>
            <Ionicons name="star" size={14} color={theme.secondary} />
            <Text style={styles.topProduitText} numberOfLines={1}>Produit star : {topProduit}</Text>
          </View>
        )}

          </>
        )}
        {/* ---- Performances : la preuve avant la premiere vente (§8.2) ---- */}
        {onglet === 'performances' && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <Ionicons name="eye-outline" size={16} color={theme.primary} />
                </View>
                <Text style={styles.statValue}>{formatNombre(totalVues)}</Text>
                <Text style={styles.statLabel}>Vues au total</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <Ionicons name="cube-outline" size={16} color={theme.primary} />
                </View>
                <Text style={styles.statValue}>{produits.length}</Text>
                <Text style={styles.statLabel}>En vitrine</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <Ionicons name="eye-off-outline" size={16} color={theme.primary} />
                </View>
                <Text style={styles.statValue}>{masques.length}</Text>
                <Text style={styles.statLabel}>Masqués</Text>
              </View>
            </View>

            {/* La metrique centrale du produit : combien de personnes vous ont
                reellement contacte (§3.4). Elle prime sur les vues. */}
            <View style={styles.perfCard}>
              <Text style={styles.tachesTitre}>Contacts reçus — 30 derniers jours</Text>
              {contacts === null ? (
                <Text style={styles.perfAide}>
                  La mesure des contacts n'est pas encore active sur votre boutique.
                </Text>
              ) : (
                <>
                  <View style={styles.perfLigne}>
                    <Ionicons name="people-outline" size={17} color={theme.primary} />
                    <Text style={styles.perfTitre}>Personnes qui vous ont contacté</Text>
                    <Text style={styles.perfValeur}>{formatNombre(contacts.total || 0)}</Text>
                  </View>
                  <View style={styles.perfLigne}>
                    <Ionicons name="logo-whatsapp" size={17} color={theme.textMuted} />
                    <Text style={styles.perfTitre}>WhatsApp</Text>
                    <Text style={styles.perfValeur}>{formatNombre(contacts.whatsapp || 0)}</Text>
                  </View>
                  <View style={styles.perfLigne}>
                    <Ionicons name="call-outline" size={17} color={theme.textMuted} />
                    <Text style={styles.perfTitre}>Appels</Text>
                    <Text style={styles.perfValeur}>{formatNombre(contacts.appels || 0)}</Text>
                  </View>
                  <View style={styles.perfLigne}>
                    <Ionicons name="chatbubble-outline" size={17} color={theme.textMuted} />
                    <Text style={styles.perfTitre}>Messages</Text>
                    <Text style={styles.perfValeur}>{formatNombre(contacts.messages || 0)}</Text>
                  </View>
                  <View style={styles.perfLigne}>
                    <Ionicons name="receipt-outline" size={17} color={theme.textMuted} />
                    <Text style={styles.perfTitre}>Commandes et devis</Text>
                    <Text style={styles.perfValeur}>{formatNombre(contacts.demandes || 0)}</Text>
                  </View>
                  <Text style={styles.perfAide}>
                    {(contacts.total || 0) === 0
                      ? "Personne ne vous a encore contacté sur cette période. Une photo nette et un prix clair changent beaucoup."
                      : "Un même visiteur qui revient dans la journée n’est compté qu’une fois."}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.perfCard}>
              <Text style={styles.tachesTitre}>Vos abonnés</Text>
              {followersLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : followersCount === 0 ? (
                <Text style={styles.perfAide}>
                  Personne ne suit encore votre boutique. Les clients qui vous suivent la
                  retrouvent plus facilement et voient vos nouveautés en premier.
                </Text>
              ) : (
                <>
                  <View style={styles.perfLigne}>
                    <Ionicons name="people-outline" size={17} color={theme.primary} />
                    <Text style={styles.perfTitre}>Personnes qui vous suivent</Text>
                    <Text style={styles.perfValeur}>{formatNombre(followersCount)}</Text>
                  </View>
                  {followers.slice(0, 8).map((f) => (
                    <View key={f.id} style={styles.perfLigne}>
                      <Ionicons name="person-circle-outline" size={17} color={theme.textMuted} />
                      <Text style={styles.perfTitre} numberOfLines={1}>
                        {[f.prenom, f.nom].filter(Boolean).join(' ') || 'Utilisateur'}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <View style={styles.perfCard}>
              <Text style={styles.tachesTitre}>Ce qui attire le plus</Text>
              {produitsLesPlusVus.length === 0 ? (
                <Text style={styles.perfAide}>
                  Rien à mesurer pour l'instant. Dès que vous publiez, vous verrez
                  ici ce que vos clients regardent le plus.
                </Text>
              ) : (
                <>
                  {produitsLesPlusVus.map((p, i) => (
                    <View key={p.id} style={styles.perfLigne}>
                      <Text style={styles.perfRang}>{i + 1}.</Text>
                      <Text style={styles.perfTitre} numberOfLines={1}>{p.titre}</Text>
                      <Text style={styles.perfValeur}>{formatNombre(p.nombre_vues || 0)} vues</Text>
                    </View>
                  ))}
                  <Text style={styles.perfAide}>
                    Un article très vu mais jamais commandé se joue souvent sur la
                    photo ou le prix.
                  </Text>
                </>
              )}
            </View>
          </>
        )}

        {/* ---- Réalisations : le portfolio du prestataire ---- */}
        {onglet === 'vitrine' && !realisationsIndispo &&
         (user?.type_activite === 'services' || user?.type_activite === 'mixte') && (
          <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            <View style={styles.catalogueHead}>
              <Text style={styles.sectionLabel}>Réalisations ({realisations.length})</Text>
              <TouchableOpacity onPress={() => setAjoutRealisation(true)} activeOpacity={0.8}>
                <Text style={styles.addLink}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>

            {realisations.length === 0 ? (
              <Text style={styles.rayonAide}>
                Montrez ce que vous savez faire. Une photo du résultat suffit — la
                photo « avant » est facultative.
              </Text>
            ) : (
              realisations.map(r => (
                <RealisationCard
                  key={r.id}
                  realisation={r}
                  onSupprimer={() => confirmerSuppressionRealisation(r.id)}
                />
              ))
            )}
          </View>
        )}

        {/* ---- Ma vitrine : voir ce que voit le client ---- */}
        {onglet === 'vitrine' && (
          <TouchableOpacity
            style={styles.apercuBtn}
            onPress={() => navigation.navigate('Boutique', { vendeurId: session?.user.id })}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="eye-outline" size={18} color="#fff" />
            <Text style={styles.apercuBtnTexte}>Voir ma vitrine comme un client</Text>
          </TouchableOpacity>
        )}

        {onglet === 'catalogue' && (
          <>
        {/* ---- Catalogue ---- */}
        <View style={styles.catalogueHead}>
          <Text style={styles.sectionLabel}>
            {user?.type_activite === 'services' ? 'Mes prestations' : 'Catalogue'} ({produits.length})
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.lg }}>
            {catalogues.length > 0 && (
              <TouchableOpacity
                onPress={() => setGestionRayonsVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Gérer les rayons"
              >
                <Text style={styles.gererLink}>Gérer les rayons</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('AjouterProduit')} activeOpacity={0.8}>
              <Text style={styles.addLink}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtre par rayon */}
        {catalogues.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.catChip, filtreCat === 'all' && styles.catChipActive]}
                onPress={() => setFiltreCat('all')}
                activeOpacity={0.8}
              >
                <Text style={[styles.catChipText, filtreCat === 'all' && styles.catChipTextActive]}>Tous</Text>
              </TouchableOpacity>
              {catalogues.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, filtreCat === c.id && styles.catChipActive]}
                  // Un appui = filtrer, point. La gestion du rayon passe par le
                  // bouton visible « Gerer les rayons » : le double appui etait
                  // une interaction cachee, interdite par le §1.4.
                  onPress={() => setFiltreCat(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catChipText, filtreCat === c.id && styles.catChipTextActive]}>{c.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
        ) : produits.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={40} color={theme.borderLight} />
            <Text style={styles.emptyText}>
              {user?.type_activite === 'services'
                ? "Vous n'avez pas encore publié de prestation."
                : 'Votre catalogue est vide.'}
            </Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('AjouterProduit')} activeOpacity={0.85}>
              <Text style={styles.ctaText}>
                {user?.type_activite === 'services'
                  ? 'Ajouter ma première prestation'
                  : 'Ajouter mon premier produit'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.produitsGrid}>
            {produits.filter(p => filtreCat === 'all' || p.catalogue_id === filtreCat).map((p, index) => {
              const img = p.images && p.images.length > 0
                ? [...p.images].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))[0].image_url
                : null;
              const enRupture = p.stock === 0;
              const masque = p.visible === false;
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.85}
                  style={[styles.produitCard, index % 2 === 1 && { marginLeft: SPACING.md }, masque && styles.produitCardMasque]}
                  onPress={() => setGestionTarget(p)}
                >
                  <View style={styles.produitImgWrap}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.produitImg} />
                    ) : (
                      <View style={[styles.produitImg, styles.produitImgFallback]}>
                        <Ionicons name="image-outline" size={22} color={theme.textMuted} />
                      </View>
                    )}
                    <View style={styles.badgeStack}>
                      {p.statut === 'vendu' && <View style={[styles.badge, styles.badgeGris]}><Text style={styles.badgeText}>Vendu</Text></View>}
                      {enRupture && p.statut !== 'vendu' && <View style={[styles.badge, styles.badgeRouge]}><Text style={styles.badgeText}>Rupture</Text></View>}
                      {masque && <View style={[styles.badge, styles.badgeGris]}><Text style={styles.badgeText}>Masqué</Text></View>}
                    </View>
                  </View>
                  <View style={styles.produitBody}>
                    <Text style={styles.produitTitre} numberOfLines={2}>{p.titre}</Text>
                    <Text style={styles.produitPrix}>{Number(p.prix).toLocaleString('fr-FR')} FCFA</Text>
                    <View style={styles.produitMetaRow}>
                      <Ionicons name="eye-outline" size={12} color={theme.textMuted} />
                      <Text style={styles.produitMeta}>{p.nombre_vues || 0}</Text>
                      <View style={{ flex: 1 }} />
                      <Ionicons name="cube-outline" size={12} color={theme.textMuted} />
                      <Text style={styles.produitMeta}>{p.stock ?? '—'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <ProduitGestionSheet
          produit={gestionTarget}
          theme={theme}
          onClose={() => setGestionTarget(null)}
          onUpdate={(id, patch) => {
            updateProduit(id, patch);
            setGestionTarget(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
          }}
          onEdit={(p) => {
            setGestionTarget(null);
            navigation.navigate('EditAnnonce', { annonce: p });
          }}
        />
          </>
        )}
        </View>
      </ScrollView>

      {/* ---- Ajout d'une réalisation ---- */}
      <Modal
        visible={ajoutRealisation}
        animationType="slide"
        transparent
        onRequestClose={() => setAjoutRealisation(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Nouvelle réalisation</Text>
              <TouchableOpacity onPress={() => setAjoutRealisation(false)} accessibilityLabel="Fermer">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.rayonAide}>
              La photo du résultat suffit. Ajoutez l'« avant » seulement si vous
              l'avez : personne ne pense à photographier avant de commencer.
            </Text>

            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              {(['avant', 'apres'] as const).map(quelle => {
                const photo = quelle === 'avant' ? photoAvant : photoApres;
                const obligatoire = quelle === 'apres';
                return (
                  <TouchableOpacity
                    key={quelle}
                    style={[styles.photoSlot, photo && { borderStyle: 'solid', borderColor: theme.primary }]}
                    onPress={() => choisirPhotoRealisation(quelle)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={quelle === 'avant' ? 'Photo avant' : 'Photo après'}
                  >
                    {photo ? (
                      <Image source={{ uri: photo.uri }} style={styles.photoSlotImg} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={22} color={theme.textMuted} />
                        <Text style={styles.photoSlotTexte}>
                          {quelle === 'avant' ? 'Avant' : 'Après'}
                          {obligatoire ? ' *' : ''}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Titre (facultatif)</Text>
            <TextInput
              style={styles.fieldInput}
              value={titreRealisation}
              onChangeText={setTitreRealisation}
              placeholder="Ex. Pose de carrelage à Badalabougou"
              placeholderTextColor={theme.textMuted}
              maxLength={60}
            />

            <TouchableOpacity
              style={[styles.ctaBtn, { marginTop: SPACING.lg }, (!photoApres || envoiRealisation) && { opacity: 0.45 }]}
              onPress={enregistrerRealisation}
              disabled={!photoApres || envoiRealisation}
              activeOpacity={0.85}
            >
              {envoiRealisation
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.ctaText}>Publier la réalisation</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---- Liste des rayons : point d'entree VISIBLE de la gestion ---- */}
      <Modal
        visible={gestionRayonsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setGestionRayonsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Gérer les rayons</Text>
              <TouchableOpacity
                onPress={() => setGestionRayonsVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.rayonAide}>
              Touchez un rayon pour le renommer ou le supprimer. Les produits qu'il
              contient ne sont jamais supprimés : ils repassent simplement sans rayon.
            </Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {catalogues.map(c => {
                const nbProduits = produits.filter(p => p.catalogue_id === c.id).length;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.rayonRow}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Modifier le rayon ${c.nom}`}
                    onPress={() => {
                      setGestionRayonsVisible(false);
                      setCatEditTarget(c);
                      setCatEditNom(c.nom);
                    }}
                  >
                    <Ionicons name="albums-outline" size={20} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rayonNom}>{c.nom}</Text>
                      <Text style={styles.rayonCompte}>
                        {nbProduits} produit{nbProduits !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Ionicons name="create-outline" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---- Modal gestion d'un rayon (renommer / supprimer) ---- */}
      <Modal visible={!!catEditTarget} animationType="fade" transparent onRequestClose={() => setCatEditTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { borderRadius: 24, maxHeight: undefined }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Rayon « {catEditTarget?.nom} »</Text>
              <TouchableOpacity onPress={() => setCatEditTarget(null)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Nom du rayon</Text>
            <TextInput
              style={styles.fieldInput}
              value={catEditNom}
              onChangeText={setCatEditNom}
              maxLength={40}
              autoFocus
              selectTextOnFocus
            />
            <TouchableOpacity
              style={[styles.ctaBtn, { marginTop: SPACING.lg }, (catEditNom.trim().length < 2 || catEditBusy) && { opacity: 0.5 }]}
              onPress={renommerRayon}
              disabled={catEditNom.trim().length < 2 || catEditBusy}
              activeOpacity={0.85}
            >
              {catEditBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Renommer</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteRayonBtn} onPress={supprimerRayon} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={15} color="#dc2626" style={{ marginRight: 6 }} />
              <Text style={styles.deleteRayonText}>Supprimer ce rayon</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---- Modal édition infos boutique ---- */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Infos de la boutique</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Nom de la boutique</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. Chez Fatim Électronique"
                placeholderTextColor={theme.textMuted}
                value={nomBoutique}
                onChangeText={setNomBoutique}
                maxLength={40}
              />
              <Text style={styles.fieldLabel}>Quartier</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. Lafiabougou"
                placeholderTextColor={theme.textMuted}
                value={quartier}
                onChangeText={setQuartier}
                maxLength={40}
              />
              <Text style={styles.fieldLabel}>Adresse / point de repère</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. En face de la pharmacie du marché"
                placeholderTextColor={theme.textMuted}
                value={adresse}
                onChangeText={setAdresse}
                maxLength={80}
              />
              <Text style={styles.fieldLabel}>Horaires</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex. Lun–Sam, 8h – 19h"
                placeholderTextColor={theme.textMuted}
                value={horaires}
                onChangeText={setHoraires}
                maxLength={60}
              />
              <Text style={styles.fieldLabel}>Livraison</Text>
              <View style={styles.chipsRow}>
                {LIVRAISON_OPTIONS.map(o => (
                  <TintedChip
                    key={o.key}
                    icon={o.icon}
                    label={o.label}
                    color={theme.primary}
                    active={livraison === o.key}
                    onPress={() => setLivraison(livraison === o.key ? null : o.key)}
                  />
                ))}
              </View>
              {livraison === 'disponible' && (
                <>
                  <Text style={styles.fieldLabel}>Frais de livraison (indicatif)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ex. 500 – 1 500 F selon le quartier"
                    placeholderTextColor={theme.textMuted}
                    value={fraisLivraison}
                    onChangeText={setFraisLivraison}
                    maxLength={60}
                  />
                </>
              )}
              <Text style={styles.fieldLabel}>Votre activité</Text>
              <Text style={styles.fieldHint}>
                Détermine ce que vous publiez et comment votre vitrine s'affiche.
              </Text>
              <View style={styles.chipsRow}>
                {TYPES_ACTIVITE.map(t => (
                  <TintedChip
                    key={t.id}
                    icon={t.icon}
                    label={t.label}
                    color={theme.primary}
                    active={typeActivite === t.id}
                    onPress={() => setTypeActivite(t.id as any)}
                  />
                ))}
              </View>

              {/* Champs propres au prestataire : le mot « stock » n'a aucun
                  sens pour lui, mais sa zone et son delai de reponse sont
                  les deux informations que l'acheteur cherche (§8.4). */}
              {typeActivite !== 'produits' && (
                <>
                  {/* La premiere question d'un client presse. Un choix simple
                      plutot qu'un agenda : au lancement, un calendrier complet
                      serait abandonne avant d'etre rempli. */}
                  <Text style={styles.fieldLabel}>Votre disponibilité</Text>
                  <View style={styles.chipsRow}>
                    {DISPONIBILITES.map(d => (
                      <TintedChip
                        key={d.id}
                        icon={d.icon}
                        label={d.label}
                        color={d.couleur}
                        active={disponibilite === d.id}
                        onPress={() => setDisponibilite(d.id)}
                      />
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Zone d'intervention</Text>
                  <Text style={styles.fieldHint}>
                    Où vous déplacez-vous ? Indiquez une zone, jamais votre adresse exacte.
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={zoneIntervention}
                    onChangeText={setZoneIntervention}
                    placeholder="Ex. Bamako et environs"
                    placeholderTextColor={theme.textMuted}
                    maxLength={80}
                  />
                  <Text style={styles.fieldLabel}>Délai de réponse habituel</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={delaiReponse}
                    onChangeText={setDelaiReponse}
                    placeholder="Ex. sous 2 heures"
                    placeholderTextColor={theme.textMuted}
                    maxLength={40}
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>Catégorie métier</Text>
              <Text style={styles.fieldHint}>
                Détermine où votre boutique apparaît dans « Nos Professionnels ».
              </Text>
              <View style={styles.chipsRow}>
                {METIER_CATEGORIES.map(m => (
                  <TintedChip
                    key={m.id}
                    icon={m.icon}
                    label={m.label}
                    color={m.gradient[0]}
                    active={categorieMetier === m.id}
                    onPress={() => setCategorieMetier(categorieMetier === m.id ? null : m.id)}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.ctaBtn, { marginTop: SPACING.lg }]}
                onPress={saveBoutique}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer</Text>}
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
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
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  centerBox: { alignItems: 'center', padding: SPACING.xxl, marginTop: 40, gap: SPACING.md },
  centerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  centerText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

  identityCard: { backgroundColor: theme.surface, borderRadius: RADIUS.xl, overflow: 'hidden', marginTop: -28, ...SHADOWS.md },
  heroWrap: { position: 'relative' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  roundBtn: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
  backPos: { top: Platform.OS === 'ios' ? 56 : 42, left: SPACING.lg },
  sharePos: { top: Platform.OS === 'ios' ? 56 : 42, right: SPACING.lg },
  banner: { width: '100%', height: 170, backgroundColor: theme.primaryDark },
  bannerPlaceholder: {
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: theme.primaryDark,
  },
  bannerPlaceholderText: { fontSize: FONTS.xs, color: 'rgba(255,255,255,.85)', fontWeight: FONTS.medium },
  identityBody: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, paddingTop: 0, marginTop: -18 },
  logoWrap: { borderRadius: RADIUS.lg, padding: 3, backgroundColor: theme.surface, ...SHADOWS.sm },
  logo: { width: 64, height: 64, borderRadius: RADIUS.md },
  logoFallback: { backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  logoInitial: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.primary },
  identityText: { flex: 1, marginLeft: SPACING.md, marginTop: 26 },
  boutiqueName: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary, flexShrink: 1 },
  proBadge: { backgroundColor: theme.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs },
  proBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  boutiqueMeta: { fontSize: FONTS.xs, color: theme.textSecondary },
  boutiqueMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexShrink: 1 },
  boutiqueMetaDot: { fontSize: FONTS.xs, color: theme.textMuted, marginHorizontal: 1 },
  editBtn: {
    width: 36, height: 36, borderRadius: 18, marginTop: 22,
    backgroundColor: theme.primaryFaded, justifyContent: 'center', alignItems: 'center',
  },

  completudeWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  completudeHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  completudeLabel: { fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textSecondary },
  completudeBarBg: { height: 6, backgroundColor: theme.surfaceMuted, borderRadius: 3, overflow: 'hidden' },
  completudeBarFill: { height: 6, backgroundColor: theme.primary, borderRadius: 3 },
  completudeHint: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 6 },

  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: theme.primaryFaded, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.md,
  },
  linkText: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary },

  ouvertCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: theme.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.sm, ...SHADOWS.sm,
  },
  ouvertDot: { width: 8, height: 8, borderRadius: 4 },
  ouvertText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  ouvertHint: { flex: 1, fontSize: FONTS.xs, color: theme.textMuted, textAlign: 'right', marginRight: SPACING.sm },
  livraisonCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: theme.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.sm, ...SHADOWS.sm,
  },
  livraisonText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, fontWeight: FONTS.medium },

  commandesCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: theme.primary, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.md, ...SHADOWS.colored,
  },
  commandesIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  commandesBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  commandesBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  commandesTitle: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: '#fff' },
  commandesSub: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  apercuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    minHeight: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.primary,
  },
  apercuBtnTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  actionsRapides: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  actionRapide: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
    minHeight: 78,
    justifyContent: 'center',
  },
  actionRapideIcone: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center', alignItems: 'center',
  },
  actionRapideTexte: {
    fontSize: 11, fontWeight: FONTS.semibold, color: theme.textSecondary, textAlign: 'center',
  },
  tachesCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  tachesTitre: {
    fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SPACING.sm,
  },
  tacheRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 48,
  },
  tacheTexte: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary, fontWeight: FONTS.medium },
  perfCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  perfLigne: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  perfRang: {
    width: 22, fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textMuted,
  },
  perfTitre: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary },
  perfValeur: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },
  perfAide: { fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 17, marginTop: SPACING.sm },
  photoSlot: {
    flex: 1, height: 116, borderRadius: RADIUS.lg,
    borderWidth: 2, borderStyle: 'dashed', borderColor: theme.borderLight,
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: theme.background, overflow: 'hidden',
  },
  photoSlotImg: { width: '100%', height: '100%' },
  photoSlotTexte: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textMuted },
  ongletsRow: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  ongletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: theme.borderLight,
    backgroundColor: theme.surface,
    // Zone tactile confortable meme sur petit ecran (§15.4)
    minHeight: 44,
  },
  ongletChipActif: { backgroundColor: theme.primary, borderColor: theme.primary },
  ongletTexte: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textSecondary },
  ongletTexteActif: { color: '#fff' },
  ongletPastille: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: theme.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  ongletPastilleTexte: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  gererLink: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semibold,
    color: theme.textSecondary,
  },
  rayonAide: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    lineHeight: 17,
    marginBottom: SPACING.md,
  },
  rayonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.borderLight,
    marginBottom: SPACING.sm,
    minHeight: 56,
  },
  rayonNom: {
    fontSize: FONTS.md,
    fontWeight: FONTS.semibold,
    color: theme.textPrimary,
  },
  rayonCompte: {
    fontSize: FONTS.xs,
    color: theme.textMuted,
    marginTop: 1,
  },
  catChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: theme.primaryFaded, borderWidth: 1, borderColor: `${theme.primary}40`,
  },
  catChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  catChipText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary },
  catChipTextActive: { color: '#fff' },

  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg, alignItems: 'center', ...SHADOWS.sm,
  },
  statCardMoney: { borderWidth: 1.5, borderColor: theme.primary },
  statIconCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: theme.primaryFaded,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  statValue: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  statLabel: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 1 },
  topProduitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.primaryFaded, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 10, marginTop: SPACING.sm,
  },
  topProduitText: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary },

  catalogueHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  addLink: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary },

  emptyBox: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyText: { fontSize: FONTS.sm, color: theme.textSecondary },

  produitsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  produitCard: {
    width: CARD_W, backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.sm,
  },
  produitCardMasque: { opacity: 0.55 },
  produitImgWrap: { position: 'relative' },
  produitImg: { width: '100%', height: CARD_W * 0.85, backgroundColor: theme.surfaceMuted },
  produitImgFallback: { justifyContent: 'center', alignItems: 'center' },
  produitBody: { padding: SPACING.md },
  produitTitre: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary, lineHeight: 18, marginBottom: 3 },
  produitPrix: { fontSize: FONTS.sm, fontWeight: FONTS.extrabold, color: theme.primary, marginBottom: 4 },
  produitMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  produitMeta: { fontSize: FONTS.xs, color: theme.textMuted },
  badgeStack: { position: 'absolute', top: 6, left: 6, gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.xs, alignSelf: 'flex-start' },
  badgeGris: { backgroundColor: 'rgba(15,23,42,0.75)' },
  badgeRouge: { backgroundColor: '#dc2626' },
  badgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },

  deleteRayonBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, marginTop: SPACING.sm,
  },
  deleteRayonText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#dc2626' },

  ctaBtn: {
    height: 50, backgroundColor: theme.primary, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl, ...SHADOWS.colored,
  },
  ctaText: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.xl, maxHeight: '88%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  fieldLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: 6,
  },
  fieldHint: {
    fontSize: FONTS.xs, color: theme.textMuted, marginTop: -4, marginBottom: SPACING.sm,
  },
  fieldInput: {
    backgroundColor: theme.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg,
    paddingVertical: 12, fontSize: FONTS.md, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.borderLight,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderLight,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: FONTS.xs, fontWeight: FONTS.semibold, color: theme.textSecondary },
  chipTextActive: { color: '#fff' },
});
