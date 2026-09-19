import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { hapticLight } from '../lib/haptics';

/**
 * « Comment avez-vous connu Flash Market ? » — posée une seule fois, sur
 * l'accueil, aux nouveaux comme aux anciens.
 *
 * C'est la seule mesure dont on dispose pour savoir ce que rapporte chaque
 * canal (publicité TikTok, Facebook, influenceurs, bouche-à-oreille) tant
 * qu'aucun outil de suivi n'est installé. Réponses lues dans la console
 * admin, page Statistiques.
 *
 * Un appui = une réponse (logos reconnaissables, pas besoin de lire). Seuls
 * « Un influenceur » et « Autre » proposent un champ facultatif, pour savoir
 * lequel. « Passer » est visible : on ne force personne.
 *
 * La carte n'apparaît que si la colonne existe et est vide
 * (`source_acquisition === null`) : tant que la migration n'est pas passée,
 * la valeur est `undefined` et rien ne s'affiche.
 */

type Choix = { id: string; label: string; icone: string; couleur: string; precision?: string };

const CHOIX: Choix[] = [
  { id: 'tiktok', label: 'TikTok', icone: 'logo-tiktok', couleur: '#111111' },
  { id: 'facebook', label: 'Facebook', icone: 'logo-facebook', couleur: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icone: 'logo-instagram', couleur: '#D62976' },
  { id: 'influenceur', label: 'Un influenceur', icone: 'star', couleur: '#D97706', precision: 'Lequel ? (facultatif)' },
  { id: 'ami', label: 'Un ami, un proche', icone: 'people', couleur: '#15803d' },
  { id: 'whatsapp', label: 'WhatsApp', icone: 'logo-whatsapp', couleur: '#25D366' },
  { id: 'store', label: 'En cherchant dans le store', icone: 'storefront', couleur: '#0369A1' },
  { id: 'autre', label: 'Autre', icone: 'ellipsis-horizontal', couleur: '#6B7280', precision: 'Où ? (facultatif)' },
];

export default function QuestionSource() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [fini, setFini] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [choixPrecis, setChoixPrecis] = useState<Choix | null>(null);
  const [detail, setDetail] = useState('');

  if (fini || !user || (user as any).source_acquisition !== null) return null;

  const enregistrer = async (source: string, precision?: string) => {
    hapticLight();
    setEnvoi(true);
    await supabase.rpc('enregistrer_source_acquisition', { p_source: source, p_detail: precision || null });
    // Même en cas d'échec réseau on range la carte : mieux vaut perdre une
    // réponse que reposer la question en boucle.
    setFini(true);
  };

  const choisir = (c: Choix) => {
    if (c.precision) {
      hapticLight();
      setChoixPrecis(c);
      return;
    }
    enregistrer(c.id);
  };

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>Comment avez-vous connu Flash Market ?</Text>
      <Text style={styles.sousTitre}>Un seul appui. Ça nous aide à faire venir plus d'acheteurs.</Text>

      {envoi ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: SPACING.xl }} />
      ) : choixPrecis ? (
        <View style={{ marginTop: SPACING.md }}>
          <View style={styles.rappel}>
            <Ionicons name={choixPrecis.icone as any} size={20} color={choixPrecis.couleur} />
            <Text style={styles.rappelTexte}>{choixPrecis.label}</Text>
          </View>
          <TextInput
            style={styles.champ}
            placeholder={choixPrecis.precision}
            placeholderTextColor={theme.textMuted}
            value={detail}
            onChangeText={setDetail}
            maxLength={80}
            autoFocus
          />
          <View style={styles.ligneBoutons}>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setChoixPrecis(null); setDetail(''); }}>
              <Text style={styles.boutonSecondaireTexte}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonPrincipal} onPress={() => enregistrer(choixPrecis.id, detail)}>
              <Text style={styles.boutonPrincipalTexte}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.grille}>
            {CHOIX.map(c => (
              <TouchableOpacity key={c.id} activeOpacity={0.8} style={styles.choix} onPress={() => choisir(c)}>
                <View style={[styles.choixIcone, { backgroundColor: c.couleur }]}>
                  <Ionicons name={c.icone as any} size={20} color="#fff" />
                </View>
                <Text style={styles.choixTexte} numberOfLines={2}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.passer} onPress={() => enregistrer('sans_reponse')}>
            <Text style={styles.passerTexte}>Passer</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  carte: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderLight,
    ...SHADOWS.sm,
  },
  titre: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  sousTitre: { fontSize: FONTS.sm, color: theme.textSecondary, marginTop: 2 },
  grille: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
    marginTop: SPACING.md,
  },
  choix: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 52,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: theme.borderLight,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FAFAFA',
  },
  choixIcone: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  choixTexte: { flex: 1, fontSize: FONTS.sm, fontWeight: FONTS.semibold, color: theme.textPrimary },
  passer: { alignSelf: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, marginTop: SPACING.sm },
  passerTexte: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textMuted },
  rappel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rappelTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: theme.textPrimary },
  champ: {
    marginTop: SPACING.md,
    height: 50,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.textPrimary,
    fontSize: FONTS.md,
    backgroundColor: theme.background,
  },
  ligneBoutons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  boutonSecondaire: {
    flex: 1, height: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  boutonSecondaireTexte: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },
  boutonPrincipal: {
    flex: 2, height: 48, borderRadius: RADIUS.md, backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  boutonPrincipalTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
