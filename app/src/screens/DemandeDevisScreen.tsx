import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Platform, Image, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS, DATES_SOUHAITEES, libellePrix } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, Annonce } from '../lib/supabase';
import { formatPrix } from '../lib/format';
import { pickImages } from '../lib/imagePicker';
import { IMAGE_SIZES, UPLOAD_CACHE_CONTROL } from '../lib/imageOptimizer';
import { decode } from 'base64-arraybuffer';
import { enregistrerContact, enregistrerContactBoutique } from '../lib/contactTracking';

/**
 * Demande de devis en TROIS étapes — pas une de plus.
 *
 *   1. Besoin        : quelle prestation
 *   2. Précisions    : une photo et/ou une courte description
 *   3. Intervention  : zone, date souhaitée, téléphone
 *
 * Chaque étape tient sur un écran et n'a qu'une action principale, conforme
 * à la règle de conception permanente : un public qui lit peu abandonne un
 * formulaire long bien avant de l'avoir fini. Découper coûte des écrans mais
 * fait aboutir les demandes.
 *
 * La photo passe avant la description : montrer une fuite d'eau est plus
 * rapide, plus juste et plus accessible que la décrire.
 *
 * Le message vocal envisagé au départ a été écarté : la photo remplit le même
 * rôle d'accessibilité pour un public qui lit peu, sans coûter un module natif
 * ni un passage par les stores.
 */

interface Props {
  navigation: any;
  route: any;
}

type Etape = 1 | 2 | 3;

export default function DemandeDevisScreen({ navigation, route }: Props) {
  const { vendeurId, vendeurNom, prestations = [] } = route.params || {};
  const { theme, isDark } = useTheme();
  const { session, user } = useAuth();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [etape, setEtape] = useState<Etape>(1);
  const [prestation, setPrestation] = useState<Annonce | null>(
    prestations.length === 1 ? prestations[0] : null
  );
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [zone, setZone] = useState('');
  const [quand, setQuand] = useState<string>('semaine');
  const [telephone, setTelephone] = useState(user?.telephone || user?.num_telephone || '');
  const [envoi, setEnvoi] = useState(false);

  const listePrestations: Annonce[] = prestations;

  async function choisirPhoto() {
    const assets = await pickImages(
      { allowsMultipleSelection: false, base64: true },
      { maxSize: IMAGE_SIZES.annonce, base64: true }
    );
    if (assets && assets.length > 0) {
      setPhoto({ uri: assets[0].uri, base64: (assets[0] as any).base64 });
    }
  }

  async function envoyerPhoto(): Promise<string | null> {
    if (!photo?.base64 || !session) return null;
    const nom = `devis/${session.user.id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('annonces-images')
      .upload(nom, decode(photo.base64), {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: UPLOAD_CACHE_CONTROL,
      });
    if (error) return null;
    return supabase.storage.from('annonces-images').getPublicUrl(nom).data.publicUrl;
  }

  async function envoyer() {
    if (!session) {
      navigation.navigate('Login');
      return;
    }
    setEnvoi(true);
    const photoUrl = await envoyerPhoto();

    const charge: any = {
      vendeur_id: vendeurId,
      client_id: session.user.id,
      produit_id: prestation?.id || null,
      produit_titre: prestation?.titre || 'Demande de devis',
      prix: 0,
      quantite: 1,
      type_demande: 'devis',
      note_client: description.trim() || null,
      zone_demandee: zone.trim() || null,
      telephone_client: telephone.trim() || null,
      photo_url: photoUrl,
      date_souhaitee: quand === 'aujourdhui'
        ? new Date().toISOString().slice(0, 10)
        : quand === 'demain'
          ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
          : null,
    };

    let { error } = await supabase.from('commandes').insert(charge);

    // Repli : tant que la migration de la vitrine v2 n'est pas appliquée, les
    // colonnes de la demande guidée n'existent pas. Une demande qui échoue est
    // pire qu'inutile — le client croit avoir contacté le professionnel.
    if (error) {
      const { zone_demandee, telephone_client, photo_url, ...ancien } = charge;
      // La zone et le téléphone rejoignent la note pour ne pas être perdus.
      ancien.note_client = [description.trim(), zone.trim() && `Zone : ${zone.trim()}`,
        telephone.trim() && `Tél : ${telephone.trim()}`].filter(Boolean).join(' — ') || null;
      const second = await supabase.from('commandes').insert(ancien);
      error = second.error;
    }

    setEnvoi(false);

    if (error) {
      Alert.alert('Envoi impossible', "Votre demande n'a pas pu partir. Réessayez dans un instant.");
      return;
    }

    if (prestation?.id) enregistrerContact(prestation.id, 'devis');
    else enregistrerContactBoutique(vendeurId, 'devis');

    Alert.alert(
      'Demande envoyée',
      `${vendeurNom || 'Le professionnel'} vient d'être prévenu. Vous recevrez sa réponse dans « Mes commandes ».`,
      [{ text: 'Voir mes demandes', onPress: () => navigation.replace('Commandes', { mode: 'client' }) },
       { text: 'Terminé', onPress: () => navigation.goBack() }]
    );
  }

  const peutContinuer =
    etape === 1 ? (listePrestations.length === 0 || !!prestation)
    : etape === 2 ? (!!photo || description.trim().length >= 3)
    : telephone.trim().length >= 6;

  const TITRES: Record<Etape, string> = {
    1: 'De quoi avez-vous besoin ?',
    2: 'Montrez ou expliquez',
    3: 'Où et quand ?',
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <View style={styles.entete}>
        <TouchableOpacity
          style={styles.retour}
          onPress={() => (etape === 1 ? navigation.goBack() : setEtape((etape - 1) as Etape))}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.enteteTitre}>Demander un devis</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Progression : le numéro autant que la couleur, pour rester lisible
          sans dépendre d'une seule dimension (règle de conception 11). */}
      <View style={styles.progression}>
        {[1, 2, 3].map(n => (
          <View key={n} style={styles.etapeBloc}>
            <View style={[styles.etapePastille, n <= etape && styles.etapePastilleActive]}>
              {n < etape ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text style={[styles.etapeNum, n <= etape && styles.etapeNumActif]}>{n}</Text>
              )}
            </View>
            {n < 3 && <View style={[styles.etapeTrait, n < etape && styles.etapeTraitActif]} />}
          </View>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.corps}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.titreEtape}>{TITRES[etape]}</Text>

          {/* ── Étape 1 : le besoin ── */}
          {etape === 1 && (
            listePrestations.length === 0 ? (
              <Text style={styles.aide}>
                Ce professionnel n'a pas encore détaillé ses prestations. Décrivez
                votre besoin à l'étape suivante.
              </Text>
            ) : (
              <>
                <Text style={styles.aide}>Choisissez la prestation qui s'en rapproche le plus.</Text>
                {listePrestations.map((p: Annonce) => {
                  const choisi = prestation?.id === p.id;
                  const img = p.images && p.images.length > 0 ? p.images[0].image_url : null;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.optionPrestation, choisi && styles.optionChoisie]}
                      onPress={() => setPrestation(p)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: choisi }}
                    >
                      {img ? (
                        <Image source={{ uri: img }} style={styles.vignette} />
                      ) : (
                        <View style={[styles.vignette, styles.vignetteVide]}>
                          <Ionicons name="construct-outline" size={22} color={theme.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optionTitre} numberOfLines={2}>{p.titre}</Text>
                        <Text style={styles.optionPrix}>
                          {libellePrix(p.prix, p.mode_tarif, formatPrix)}
                        </Text>
                        {!!p.duree_indicative && (
                          <Text style={styles.optionMeta}>Durée : {p.duree_indicative}</Text>
                        )}
                      </View>
                      <Ionicons
                        name={choisi ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={choisi ? theme.primary : theme.borderLight}
                      />
                    </TouchableOpacity>
                  );
                })}
              </>
            )
          )}

          {/* ── Étape 2 : précisions — la photo d'abord ── */}
          {etape === 2 && (
            <>
              <Text style={styles.aide}>
                Une photo vaut mieux qu'un long message. Vous pouvez aussi écrire
                quelques mots.
              </Text>

              {photo ? (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.photoRetirer}
                    onPress={() => setPhoto(null)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Retirer la photo"
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={choisirPhoto}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Ionicons name="camera-outline" size={26} color={theme.primary} />
                  <Text style={styles.photoBtnTexte}>Ajouter une photo</Text>
                </TouchableOpacity>
              )}

              <TextInput
                style={styles.zoneTexte}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex. Fuite sous l'évier de la cuisine depuis hier"
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={400}
              />
            </>
          )}

          {/* ── Étape 3 : intervention ── */}
          {etape === 3 && (
            <>
              <Text style={styles.libelle}>Où ?</Text>
              <TextInput
                style={styles.champ}
                value={zone}
                onChangeText={setZone}
                placeholder="Votre quartier"
                placeholderTextColor={theme.textMuted}
                maxLength={60}
              />

              <Text style={styles.libelle}>Quand ?</Text>
              <View style={styles.datesRow}>
                {DATES_SOUHAITEES.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.dateChip, quand === d.id && styles.dateChipActif]}
                    onPress={() => setQuand(d.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: quand === d.id }}
                  >
                    <Text style={[styles.dateTexte, quand === d.id && styles.dateTexteActif]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.libelle}>Votre téléphone</Text>
              <TextInput
                style={styles.champ}
                value={telephone}
                onChangeText={setTelephone}
                placeholder="Pour être rappelé"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <Text style={styles.aidePetite}>
                Le professionnel confirme ensuite votre rendez-vous. Rien n'est payé
                dans l'application.
              </Text>
            </>
          )}
        </ScrollView>

        {/* Une seule action principale, toujours visible et nommée */}
        <View style={styles.barre}>
          <TouchableOpacity
            style={[styles.principal, (!peutContinuer || envoi) && styles.principalInactif]}
            onPress={() => (etape < 3 ? setEtape((etape + 1) as Etape) : envoyer())}
            disabled={!peutContinuer || envoi}
            activeOpacity={0.9}
            accessibilityRole="button"
          >
            {envoi ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.principalTexte}>
                {etape < 3 ? 'Continuer' : 'Envoyer ma demande'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    retour: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.18)',
      justifyContent: 'center', alignItems: 'center',
    },
    enteteTitre: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: '#fff' },

    progression: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: SPACING.lg,
    },
    etapeBloc: { flexDirection: 'row', alignItems: 'center' },
    etapePastille: {
      width: 30, height: 30, borderRadius: 15,
      borderWidth: 2, borderColor: theme.borderLight,
      justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface,
    },
    etapePastilleActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    etapeNum: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textMuted },
    etapeNumActif: { color: '#fff' },
    etapeTrait: { width: 44, height: 2, backgroundColor: theme.borderLight },
    etapeTraitActif: { backgroundColor: theme.primary },

    corps: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
    titreEtape: {
      fontSize: FONTS.xl, fontWeight: FONTS.extrabold, color: theme.textPrimary,
      marginBottom: SPACING.sm,
    },
    aide: { fontSize: FONTS.sm, color: theme.textSecondary, lineHeight: 20, marginBottom: SPACING.lg },
    aidePetite: { fontSize: FONTS.xs, color: theme.textMuted, lineHeight: 17, marginTop: SPACING.md },
    libelle: {
      fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.textPrimary,
      marginTop: SPACING.lg, marginBottom: SPACING.sm,
    },

    optionPrestation: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      backgroundColor: theme.surface, borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: theme.borderLight,
      padding: SPACING.md, marginBottom: SPACING.md, minHeight: 84,
    },
    optionChoisie: { borderColor: theme.primary, backgroundColor: theme.primaryFaded },
    vignette: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: theme.surfaceMuted },
    vignetteVide: { justifyContent: 'center', alignItems: 'center' },
    optionTitre: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary },
    optionPrix: { fontSize: FONTS.sm, fontWeight: FONTS.bold, color: theme.primary, marginTop: 2 },
    optionMeta: { fontSize: FONTS.xs, color: theme.textMuted, marginTop: 1 },

    photoBtn: {
      height: 130, borderRadius: RADIUS.lg,
      borderWidth: 2, borderStyle: 'dashed', borderColor: theme.borderLight,
      justifyContent: 'center', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: theme.surface,
    },
    photoBtnTexte: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.primary },
    photoWrap: { position: 'relative' },
    photo: { width: '100%', height: 190, borderRadius: RADIUS.lg },
    photoRetirer: {
      position: 'absolute', top: 8, right: 8,
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
    },
    zoneTexte: {
      marginTop: SPACING.lg,
      backgroundColor: theme.surface, borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: theme.borderLight,
      padding: SPACING.md, minHeight: 96, textAlignVertical: 'top',
      fontSize: FONTS.md, color: theme.textPrimary,
    },
    champ: {
      backgroundColor: theme.surface, borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: theme.borderLight,
      paddingHorizontal: SPACING.md, minHeight: 52,
      fontSize: FONTS.md, color: theme.textPrimary,
    },
    datesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    dateChip: {
      paddingHorizontal: SPACING.lg, minHeight: 48, justifyContent: 'center',
      borderRadius: RADIUS.full, borderWidth: 1, borderColor: theme.borderLight,
      backgroundColor: theme.surface,
    },
    dateChipActif: { backgroundColor: theme.primary, borderColor: theme.primary },
    dateTexte: { fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textSecondary },
    dateTexteActif: { color: '#fff' },

    barre: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.lg,
      backgroundColor: theme.surface,
      borderTopWidth: 1, borderTopColor: theme.borderLight,
    },
    principal: {
      minHeight: 54, borderRadius: RADIUS.lg, backgroundColor: theme.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    principalInactif: { opacity: 0.45 },
    principalTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  });
