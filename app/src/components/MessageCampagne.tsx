import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import Gradient from './Gradient';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { hapticLight } from '../lib/haptics';
import { ecranDeNotification, ouvrirEcranNotification } from '../lib/ecranNotification';

/**
 * Message de Flash Market, affiché sur l'accueil.
 *
 * Les messages ciblés envoyés depuis la console (type « campagne ») partent
 * aussi en notification push, mais beaucoup de téléphones refusent les
 * notifications, et l'application n'a pas d'écran « Notifications ». Sans
 * cette carte, ces personnes ne verraient jamais le message.
 *
 * Un seul message à la fois (le plus récent non lu, de moins de 14 jours),
 * avec deux boutons visibles : l'action, et « OK » qui le range. Aucun geste
 * caché.
 */
interface Message {
  id: string;
  titre: string;
  contenu: string;
  donnees: any;
}

const DUREE_JOURS = 14;

export default function MessageCampagne({ userId, navigation }: { userId?: string; navigation: any }) {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [message, setMessage] = useState<Message | null>(null);

  const charger = useCallback(async () => {
    if (!userId) { setMessage(null); return; }
    const depuis = new Date(Date.now() - DUREE_JOURS * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, titre, contenu, donnees')
      .eq('user_id', userId)
      .eq('type', 'campagne')
      .eq('lu', false)
      .gte('date_creation', depuis)
      .order('date_creation', { ascending: false })
      .limit(1);
    if (error) return;
    setMessage((data?.[0] as Message) || null);
  }, [userId]);

  // Rechargé à chaque retour sur l'accueil : un message envoyé pendant que
  // l'application est ouverte apparaît sans la redémarrer.
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  const ranger = async () => {
    if (!message) return;
    const id = message.id;
    setMessage(null);
    await supabase.from('notifications').update({ lu: true }).eq('id', id);
  };

  if (!message) return null;

  const aUnEcran = !!ecranDeNotification('campagne', message.donnees);

  const agir = () => {
    hapticLight();
    ouvrirEcranNotification(navigation, 'campagne', message.donnees);
    ranger();
  };

  const icone = ICONES[message.donnees?.ecran] || 'megaphone';

  return (
    <Gradient
      colors={['#0b4023', '#15803d', '#1f9450']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.carte}
    >
      <Ionicons name={icone as any} size={110} color="rgba(255,255,255,0.12)" style={styles.filigrane} />
      <View style={styles.entete}>
        <View style={styles.icone}>
          <Ionicons name={icone as any} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.surtitre}>Message de Flash Market</Text>
          <Text style={styles.titre} numberOfLines={2}>{message.titre}</Text>
        </View>
      </View>
      <Text style={styles.contenu}>{message.contenu}</Text>
      <View style={styles.boutons}>
        {aUnEcran && (
          <TouchableOpacity activeOpacity={0.9} onPress={agir} style={styles.boutonAction}>
            <Text style={styles.boutonActionTexte}>Voir</Text>
            <Ionicons name="arrow-forward" size={16} color="#15803d" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { hapticLight(); ranger(); }}
          style={[styles.boutonOk, !aUnEcran && { flex: 1 }]}
        >
          <Text style={styles.boutonOkTexte}>OK</Text>
        </TouchableOpacity>
      </View>
    </Gradient>
  );
}

// L'icône dit d'un coup d'œil de quoi parle le message, avant toute lecture.
const ICONES: Record<string, string> = {
  Invitations: 'gift',
  Publier: 'camera',
  BoosterMesAnnonces: 'flame',
  MesAnnonces: 'pricetags',
};

// Même gabarit que la bannière du concours juste en dessous (dégradé,
// grande icône en filigrane, texte blanc), dans le vert de l'application
// pour qu'on distingue les deux cartes.
const createStyles = (_theme: any, _isDark: boolean) => StyleSheet.create({
  carte: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  filigrane: {
    position: 'absolute',
    right: -14,
    bottom: -20,
    transform: [{ rotate: '12deg' }],
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icone: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  surtitre: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  titre: { fontSize: FONTS.lg, fontWeight: FONTS.extrabold, color: '#fff', marginTop: 2 },
  contenu: {
    fontSize: FONTS.md,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.95)',
    marginTop: SPACING.md,
  },
  boutons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  boutonAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#fff',
  },
  boutonActionTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#15803d' },
  boutonOk: {
    minWidth: 88,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  boutonOkTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
});
