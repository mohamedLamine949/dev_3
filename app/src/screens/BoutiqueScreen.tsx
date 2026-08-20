import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, Platform, Alert, ActivityIndicator, Linking, Dimensions, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { supabase, Annonce, User, Catalogue } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSellerAvis } from '../hooks/useAvis';
import { useBoutiqueFollow } from '../hooks/useBoutiqueFollow';
import { formatPrix } from '../lib/format';
import { libellePrix, DISPONIBILITES, METIER_CATEGORIES } from '../constants/theme';
import { useRealisations } from '../hooks/useRealisations';
import RealisationCard from '../components/RealisationCard';
import { enregistrerContact, enregistrerContactBoutique } from '../lib/contactTracking';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - SPACING.lg * 2 - SPACING.md) / 2;

interface Props {
  navigation: any;
  route: any;
}

const LIVRAISON_LABELS: Record<string, { label: string; icon: string }> = {
  disponible: { label: 'Livraison disponible', icon: 'bicycle-outline' },
  a_discuter: { label: 'Livraison à discuter', icon: 'chatbubble-ellipses-outline' },
  retrait: { label: 'Retrait en boutique', icon: 'storefront-outline' },
};

/**
 * Page boutique publique : la vitrine que voit un client.
 * Bannière, identité, note, infos pratiques, contact et catalogue avec
 * bouton « Commander » (→ conversation pré-remplie, spec refonte PRO v1).
 */
export default function BoutiqueScreen({ navigation, route }: Props) {
  const { vendeurId } = route.params || {};
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const { avis, avgNote } = useSellerAvis(vendeurId);
  const { isFollowing, followerCount, busy: followBusy, toggleFollow } = useBoutiqueFollow(vendeurId, session?.user?.id);

  const [vendeur, setVendeur] = useState<User | null>(null);
  const [produits, setProduits] = useState<Annonce[]>([]);
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandeEnCours, setCommandeEnCours] = useState<string | null>(null);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const isOwner = session?.user?.id === vendeurId;

  useEffect(() => {
    if (!vendeurId) return;
    Promise.all([
      supabase.from('users').select('*').eq('id', vendeurId).single(),
      supabase
        .from('annonces')
        .select('*, images:images_annonce(image_url, ordre)')
        .eq('user_id', vendeurId)
        .eq('statut', 'active')
        .order('date_creation', { ascending: false }),
      supabase
        .from('catalogues')
        .select('*')
        .eq('user_id', vendeurId)
        .order('ordre', { ascending: true })
        .order('date_creation', { ascending: true }),
    ]).then(([{ data: u }, { data: a }, { data: c }]) => {
      setVendeur((u as User) || null);
      setProduits((a as Annonce[]) || []);
      setCatalogues((c as Catalogue[]) || []);
      setLoading(false);
    });
  }, [vendeurId]);

  // Commander = créer une VRAIE commande (pas un message) : le vendeur la
  // gère depuis « Commandes reçues », le client la suit depuis « Mes commandes ».
  // Une vitrine de services se lit comme une fiche de professionnel : action
  // principale unique et collee en bas, pas un bouton par carte.
  const estPrestataire =
    vendeur?.type_activite === 'services' || vendeur?.type_activite === 'mixte';
  const dispo = DISPONIBILITES.find(d => d.id === (vendeur?.disponibilite || 'rdv'));
  const metier = METIER_CATEGORIES.find(m => m.id === vendeur?.categorie_metier);
  const premierePrestation = produits.find(p => p.listing_kind === 'pro_service');
  const { realisations } = useRealisations(vendeurId);

  function commander(p: Annonce) {
    // Une prestation ne se « commande » pas : on demande un devis (§8.4).
    const estPrestation = p.listing_kind === 'pro_service';
    if (!session) {
      Alert.alert('Connexion requise', estPrestation
        ? 'Créez un compte pour demander un devis à ce professionnel.'
        : 'Créez un compte pour commander auprès de cette boutique.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    if (isOwner || commandeEnCours) return;
    Alert.alert(
      estPrestation ? 'Demander un devis ?' : 'Commander ce produit ?',
      estPrestation
        ? `${p.titre}
Le professionnel sera notifié et vous proposera un montant.`
        : `${p.titre} — ${formatPrix(p.prix)}
La boutique sera notifiée et vous répondra.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: estPrestation ? 'Demander un devis' : 'Commander',
          onPress: async () => {
            setCommandeEnCours(p.id);
            enregistrerContact(p.id, estPrestation ? 'devis' : 'commande');
            const { error } = await supabase.from('commandes').insert({
              vendeur_id: vendeurId,
              client_id: session.user.id,
              produit_id: p.id,
              catalogue_id: p.catalogue_id || null,
              produit_titre: p.titre,
              // Une demande de devis part sans montant : le prestataire le
              // chiffrera dans `montant_devis`.
              prix: estPrestation ? 0 : p.prix,
              quantite: 1,
              type_demande: estPrestation ? 'devis' : 'commande',
            });
            setCommandeEnCours(null);
            if (error) {
              Alert.alert('Erreur', error.message);
            } else {
              Alert.alert(estPrestation ? 'Demande envoyée' : 'Commande envoyée', 'La boutique vient d\'être notifiée. Suivez votre commande dans « Mes commandes ».', [
                { text: 'OK' },
                { text: 'Mes commandes', onPress: () => navigation.navigate('Commandes', { mode: 'client' }) },
              ]);
            }
          },
        },
      ]
    );
  }

  async function partager() {
    const lien = vendeur?.boutique_slug
      ? `https://app-flashmarket.com/b/${vendeur.boutique_slug}`
      : 'https://app-flashmarket.com';
    try {
      await Share.share({ message: `Découvre la boutique « ${nomBoutique} » sur Flash Market : ${lien}` });
    } catch {}
  }

  const nomBoutique = vendeur?.nom_boutique || `${vendeur?.prenom || ''} ${vendeur?.nom || ''}`.trim() || 'Boutique';
  const livraisonMeta = vendeur?.livraison ? LIVRAISON_LABELS[vendeur.livraison] : null;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ---- Bannière + navigation ---- */}
        <View style={styles.bannerWrap}>
          {vendeur?.banniere_url ? (
            <Image source={{ uri: vendeur.banniere_url }} style={styles.banner} />
          ) : (
            <View style={[styles.banner, { backgroundColor: theme.primaryDark }]} />
          )}
          <View style={styles.bannerOverlay} />
          <TouchableOpacity style={[styles.roundBtn, styles.backPos]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundBtn, styles.sharePos]} onPress={partager} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ---- Identité ---- */}
        <View style={styles.identity}>
          {vendeur?.avatar_url ? (
            <Image source={{ uri: vendeur.avatar_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoInitial}>{nomBoutique.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm }}>
            <Text style={styles.nom}>{nomBoutique}</Text>
            {/* Deux badges DISTINCTS : « Pro » dit abonnement actif,
                « Vérifié » dit identité contrôlée. Les confondre trompe
                l'acheteur sur la seule chose qui compte pour lui. */}
            <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
            {vendeur?.verification_status === 'verified' && (
              <View style={styles.verifieBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#fff" />
                <Text style={styles.verifieBadgeText}>Vérifié</Text>
              </View>
            )}
            <View style={[styles.ouvertBadge, vendeur?.ouvert_maintenant === false && styles.ouvertBadgeFerme]}>
              <View style={[styles.ouvertBadgeDot, { backgroundColor: vendeur?.ouvert_maintenant !== false ? '#4ade80' : '#9ca3af' }]} />
              <Text style={styles.ouvertBadgeText}>{vendeur?.ouvert_maintenant !== false ? 'Ouvert' : 'Fermé'}</Text>
            </View>
          </View>
          {avgNote !== null && (
            <View style={styles.noteRow}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.noteText}>{avgNote.toFixed(1)} / 5 · {avis.length} avis</Text>
            </View>
          )}
          {/* Le metier, juste sous le nom : c'est ce qui dit en un mot ce que
              fait ce professionnel, avant meme la disponibilite. */}
          {metier && (
            <View style={styles.metierRow}>
              <Ionicons name={metier.icon as any} size={14} color={theme.textSecondary} />
              <Text style={styles.metierTexte}>{metier.label}</Text>
            </View>
          )}

          {/* La premiere question d'un client qui a une fuite d'eau. */}
          {estPrestataire && dispo && (
            <View style={[styles.dispoChip, { backgroundColor: dispo.couleur + '18' }]}>
              <Ionicons name={dispo.icon as any} size={14} color={dispo.couleur} />
              <Text style={[styles.dispoTexte, { color: dispo.couleur }]}>{dispo.label}</Text>
            </View>
          )}
          {vendeur?.bio ? <Text style={styles.bio} numberOfLines={3}>{vendeur.bio}</Text> : null}
        </View>

        {/* ---- Infos pratiques ---- */}
        <View style={styles.infosCard}>
          {(vendeur?.quartier_boutique || vendeur?.adresse_boutique) && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={17} color={theme.primary} />
              <Text style={styles.infoText}>
                {[vendeur?.quartier_boutique, vendeur?.adresse_boutique].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
          {vendeur?.horaires && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={17} color={theme.primary} />
              <Text style={styles.infoText}>{vendeur.horaires}</Text>
            </View>
          )}
          {/* Les deux informations qu'un client cherche chez un prestataire :
              jusqu'ou il se deplace, et sous combien de temps il repond. */}
          {vendeur?.zone_intervention && (
            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={17} color={theme.primary} />
              <Text style={styles.infoText}>Intervient : {vendeur.zone_intervention}</Text>
            </View>
          )}
          {vendeur?.delai_reponse && (
            <View style={styles.infoRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={theme.primary} />
              <Text style={styles.infoText}>Répond {vendeur.delai_reponse}</Text>
            </View>
          )}
          {livraisonMeta && (
            <View style={styles.infoRow}>
              <Ionicons name={livraisonMeta.icon as any} size={17} color={theme.primary} />
              <Text style={styles.infoText}>
                {livraisonMeta.label}
                {vendeur?.frais_livraison ? ` · ${vendeur.frais_livraison}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ---- Suivre ---- */}
        {!isOwner && session && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={toggleFollow}
            disabled={followBusy}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isFollowing ? 'checkmark' : 'add'}
              size={16}
              color={isFollowing ? theme.primary : '#fff'}
            />
            <Text style={[styles.followBtnText, isFollowing && { color: theme.primary }]}>
              {isFollowing ? 'Suivi' : 'Suivre'}
            </Text>
            {followerCount > 0 && (
              <Text style={[styles.followCount, isFollowing && { color: theme.primary }]}>
                · {followerCount}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ---- Abonnés (vue du propriétaire sur sa propre vitrine) ---- */}
        {isOwner && (
          <View style={styles.followerInfoRow}>
            <Ionicons name="people-outline" size={16} color={theme.primary} />
            <Text style={styles.followerInfoText}>
              {followerCount > 0
                ? `${followerCount} abonné${followerCount > 1 ? 's' : ''}`
                : "Aucun abonné pour l'instant"}
            </Text>
          </View>
        )}

        {/* ---- Contact ---- */}
        {!isOwner && (vendeur?.telephone || vendeur?.whatsapp) && (
          <View style={styles.contactRow}>
            {vendeur?.telephone && (
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => {
                  enregistrerContactBoutique(vendeurId, 'appel');
                  Linking.openURL(`tel:${vendeur.telephone}`);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={16} color="#fff" />
                <Text style={styles.contactBtnText}>Appeler</Text>
              </TouchableOpacity>
            )}
            {vendeur?.whatsapp && (
              <TouchableOpacity
                style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
                onPress={() => {
                  enregistrerContactBoutique(vendeurId, 'whatsapp');
                  Linking.openURL(`https://wa.me/${vendeur.whatsapp?.replace(/[^0-9]/g, '')}`);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                <Text style={styles.contactBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ---- Réalisations : ce qu'un artisan montre en premier ---- */}
        {estPrestataire && realisations.length > 0 && (
          <View style={{ paddingHorizontal: SPACING.lg }}>
            <Text style={styles.sectionLabel}>Réalisations ({realisations.length})</Text>
            {realisations.map(r => (
              <RealisationCard key={r.id} realisation={r} />
            ))}
          </View>
        )}

        {/* ---- Catalogue par rayons ---- */}
        {produits.length === 0 ? (
          <>
            <Text style={styles.sectionLabel}>
              {vendeur?.type_activite === 'services' ? 'Prestations' : 'Catalogue'}
            </Text>
            <View style={styles.emptyBox}>
              <Ionicons
                name={vendeur?.type_activite === 'services' ? 'construct-outline' : 'cube-outline'}
                size={40}
                color={theme.borderLight}
              />
              <Text style={styles.emptyText}>
                {vendeur?.type_activite === 'services'
                  ? "Ce professionnel n'a pas encore publié de prestation."
                  : "Cette boutique n'a pas encore de produits en ligne."}
              </Text>
            </View>
          </>
        ) : (
          (() => {
            const renderCard = (p: Annonce) => {
              const img = p.images && p.images.length > 0
                ? [...p.images].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))[0].image_url
                : null;
              // `stock === 0` seulement : une prestation a un stock NULL et ne
              // doit jamais afficher « Rupture ».
              const enRupture = p.stock === 0;
              const estPrestation = p.listing_kind === 'pro_service';
              const masque = p.visible === false; // visible seulement en aperçu propriétaire
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.card, masque && { opacity: 0.55 }]}
                  onPress={() => navigation.navigate('AnnonceDetail', { annonce: p })}
                  activeOpacity={0.9}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={styles.cardImg} />
                  ) : (
                    <View style={[styles.cardImg, styles.cardImgFallback]}>
                      <Ionicons name="image-outline" size={24} color={theme.textMuted} />
                    </View>
                  )}
                  {enRupture && (
                    <View style={styles.ruptureBadge}><Text style={styles.ruptureBadgeText}>Rupture</Text></View>
                  )}
                  {masque && (
                    <View style={[styles.ruptureBadge, { backgroundColor: theme.textMuted }]}>
                      <Text style={styles.ruptureBadgeText}>Masqué</Text>
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitre} numberOfLines={1}>{p.titre}</Text>
                    <Text style={styles.cardPrix} numberOfLines={1}>
                      {libellePrix(p.prix, p.mode_tarif, formatPrix)}
                    </Text>
                    {/* Ce qu'un client veut savoir avant de demander : combien
                        de temps, et jusqu'ou le pro se deplace. */}
                    {!!p.duree_indicative && (
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="time-outline" size={11} color={theme.textMuted} />
                        <Text style={styles.cardMeta} numberOfLines={1}>{p.duree_indicative}</Text>
                      </View>
                    )}
                    {!!p.condition_deplacement && (
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="navigate-outline" size={11} color={theme.textMuted} />
                        <Text style={styles.cardMeta} numberOfLines={1}>{p.condition_deplacement}</Text>
                      </View>
                    )}
                    {!isOwner && (
                      <TouchableOpacity
                        style={[styles.commanderBtn, enRupture && styles.commanderBtnOff]}
                        onPress={() => commander(p)}
                        disabled={enRupture || commandeEnCours === p.id}
                        activeOpacity={0.85}
                      >
                        {commandeEnCours === p.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons
                              name={estPrestation ? 'document-text-outline' : 'bag-check-outline'}
                              size={13}
                              color={enRupture ? theme.textMuted : '#fff'}
                            />
                            <Text style={[styles.commanderText, enRupture && { color: theme.textMuted }]}>
                              {enRupture ? 'Épuisé' : estPrestation ? 'Demander un devis' : 'Commander'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            };

            // Regroupe par rayon (catalogue) ; les produits non rangés vont dans « Autres »
            // §8.5 demande deux onglets Produits / Services pour une activite
            // mixte. On prefere deux SECTIONS nommees a des onglets : pour un
            // public peu lecteur, un onglet cache la moitie de l'offre derriere
            // une interaction, ce que la regle « zero interaction cachee »
            // deconseille. Tout reste visible en faisant defiler.
            const prestations = produits.filter(p => p.listing_kind === 'pro_service');
            const articles = produits.filter(p => p.listing_kind !== 'pro_service');

            const groupesDe = (liste: Annonce[], suffixe: string) => [
              ...catalogues
                .map(c => ({
                  nom: c.nom + suffixe,
                  items: liste.filter(p => p.catalogue_id === c.id),
                }))
                .filter(g => g.items.length > 0),
              {
                nom: (catalogues.length > 0 ? 'Autres' : 'Catalogue') + suffixe,
                items: liste.filter(p => !p.catalogue_id || !catalogues.some(c => c.id === p.catalogue_id)),
              },
            ].filter(g => g.items.length > 0);

            type Groupe = { nom: string; items: Annonce[]; entete?: boolean };
            const melange: Groupe[] = [
              { nom: 'Produits', items: [], entete: true },
              ...groupesDe(articles, ''),
              { nom: 'Prestations', items: [], entete: true },
              ...groupesDe(prestations, ''),
            ];
            const groupes: Groupe[] = prestations.length > 0 && articles.length > 0
              ? melange.filter(g => g.entete || g.items.length > 0)
              : groupesDe(produits, '');

            return groupes.map(g => (
              <View key={g.nom}>
                <Text style={g.entete ? styles.familleLabel : styles.sectionLabel}>
                  {g.entete ? g.nom : `${g.nom} (${g.items.length})`}
                </Text>
                <View style={styles.grid}>{g.items.map(renderCard)}</View>
              </View>
            ));
          })()
        )}
      </ScrollView>

      {/* Action principale FIXE (règle de conception : une action principale
          par écran, toujours visible et explicitement nommée). Un client qui
          fait défiler un portfolio ne doit jamais avoir à remonter pour
          demander un devis. Réservée aux prestataires : sur une boutique de
          produits, l'action porte sur un article précis, pas sur la boutique. */}
      {estPrestataire && !isOwner && (
        <View style={styles.barreAction}>
          {vendeur?.telephone ? (
            <TouchableOpacity
              style={styles.actionSecondaire}
              onPress={() => {
                enregistrerContactBoutique(vendeurId, 'appel');
                Linking.openURL(`tel:${vendeur.telephone}`);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Appeler"
            >
              <Ionicons name="call" size={19} color={theme.primary} />
              <Text style={styles.actionSecondaireTexte}>Appeler</Text>
            </TouchableOpacity>
          ) : null}
          {vendeur?.whatsapp ? (
            <TouchableOpacity
              style={styles.actionSecondaire}
              onPress={() => {
                enregistrerContactBoutique(vendeurId, 'whatsapp');
                Linking.openURL(`https://wa.me/${vendeur.whatsapp?.replace(/[^0-9]/g, '')}`);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="WhatsApp"
            >
              <Ionicons name="logo-whatsapp" size={19} color={theme.primary} />
              <Text style={styles.actionSecondaireTexte}>WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.actionPrincipale}
            onPress={() => navigation.navigate('DemandeDevis', {
              vendeurId,
              vendeurNom: nomBoutique,
              prestations: produits.filter(p => p.listing_kind === 'pro_service'),
            })}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Demander un devis"
          >
            <Ionicons name="document-text-outline" size={19} color="#fff" />
            <Text style={styles.actionPrincipaleTexte}>Demander un devis</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  bannerWrap: { position: 'relative' },
  banner: { width: '100%', height: 170 },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  roundBtn: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
  backPos: { top: Platform.OS === 'ios' ? 56 : 42, left: SPACING.lg },
  sharePos: { top: Platform.OS === 'ios' ? 56 : 42, right: SPACING.lg },

  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardMeta: { flex: 1, fontSize: 11, color: theme.textMuted },
  metierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', marginTop: 4,
  },
  metierTexte: { fontSize: FONTS.sm, color: theme.textSecondary, fontWeight: FONTS.medium },
  verifieBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#0369a1', borderRadius: RADIUS.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  verifieBadgeText: { fontSize: 10, fontWeight: FONTS.extrabold, color: '#fff' },
  dispoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  dispoTexte: { fontSize: FONTS.sm, fontWeight: FONTS.bold },
  barreAction: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.lg,
    backgroundColor: theme.surface,
    borderTopWidth: 1, borderTopColor: theme.borderLight,
  },
  actionSecondaire: {
    width: 62, minHeight: 52, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: theme.borderLight,
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  actionSecondaireTexte: { fontSize: 10, fontWeight: FONTS.semibold, color: theme.primary },
  actionPrincipale: {
    flex: 1, minHeight: 52, borderRadius: RADIUS.lg, backgroundColor: theme.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  actionPrincipaleTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  identity: { alignItems: 'center', marginTop: -34, paddingHorizontal: SPACING.lg },
  logo: {
    width: 68, height: 68, borderRadius: RADIUS.lg,
    borderWidth: 3, borderColor: theme.background, backgroundColor: theme.surfaceMuted,
  },
  logoFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.primaryFaded },
  logoInitial: { fontSize: FONTS.xxl, fontWeight: FONTS.extrabold, color: theme.primary },
  nom: { fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  proBadge: { backgroundColor: theme.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs },
  proBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  ouvertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(74,222,128,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs,
  },
  ouvertBadgeFerme: { backgroundColor: theme.surfaceMuted },
  ouvertBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  ouvertBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: theme.textSecondary },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  noteText: { fontSize: FONTS.xs, color: theme.textSecondary, fontWeight: FONTS.semibold },
  bio: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 19 },

  infosCard: {
    backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg,
    padding: SPACING.lg, gap: SPACING.sm, ...SHADOWS.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  infoText: { flex: 1, fontSize: FONTS.sm, color: theme.textPrimary },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: theme.primary, borderRadius: RADIUS.md, paddingVertical: 10,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
  },
  followBtnActive: { backgroundColor: theme.primaryFaded },
  followBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },
  followCount: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: 'rgba(255,255,255,0.85)' },
  followerInfoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
  },
  followerInfoText: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.primary },

  contactRow: { flexDirection: 'row', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginTop: SPACING.sm },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.primary, borderRadius: RADIUS.md, paddingVertical: 11,
  },
  contactBtnText: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: '#fff' },

  familleLabel: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.extrabold,
    color: theme.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.xs,
  },
  sectionLabel: {
    fontSize: FONTS.xs, fontWeight: FONTS.bold, color: theme.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: SPACING.lg, marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },
  emptyBox: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: CARD_W, backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.sm,
  },
  cardImg: { width: '100%', height: CARD_W * 0.9, backgroundColor: theme.surfaceMuted },
  cardImgFallback: { justifyContent: 'center', alignItems: 'center' },
  ruptureBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#dc2626', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs,
  },
  ruptureBadgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  cardBody: { padding: SPACING.md },
  cardTitre: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  cardPrix: { fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.primary, marginTop: 2 },
  commanderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: theme.primary, borderRadius: RADIUS.sm,
    paddingVertical: 8, marginTop: SPACING.sm,
  },
  commanderBtnOff: { backgroundColor: theme.surfaceMuted },
  commanderText: { fontSize: FONTS.xs, fontWeight: FONTS.bold, color: '#fff' },
});
