import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
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

  return (
    <View style={styles.carte}>
      <View style={styles.entete}>
        <View style={styles.icone}>
          <Ionicons name="megaphone" size={18} color="#fff" />
        </View>
        <Text style={styles.titre} numberOfLines={2}>{message.titre}</Text>
      </View>
      <Text style={styles.contenu}>{message.contenu}</Text>
      <View style={styles.boutons}>
        {aUnEcran && (
          <TouchableOpacity activeOpacity={0.9} onPress={agir} style={styles.boutonAction}>
            <Text style={styles.boutonActionTexte}>Voir</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
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
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  carte: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#F0FDF4',
    borderWidth: 1.5,
    borderColor: theme.primary,
    ...SHADOWS.sm,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  icone: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  titre: { flex: 1, fontSize: FONTS.md, fontWeight: FONTS.extrabold, color: theme.textPrimary },
  contenu: {
    fontSize: FONTS.md,
    lineHeight: 22,
    color: theme.textSecondary,
    marginTop: SPACING.sm,
  },
  boutons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  boutonAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: theme.primary,
  },
  boutonActionTexte: { fontSize: FONTS.md, fontWeight: FONTS.bold, color: '#fff' },
  boutonOk: {
    minWidth: 88,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  boutonOkTexte: { fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textSecondary },
});
