import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { getVersionNative, estVersionInferieure, ouvrirStore } from '../lib/versionApp';

/**
 * Dernier recours quand une mise à jour OTA ne peut PAS faire le travail.
 *
 * 99 % des évolutions partent par `eas update` et arrivent toutes seules. Mais
 * une évolution du code natif (nouveau module, montée de SDK) exige un nouveau
 * binaire : les téléphones restés sur l'ancien ne recevront plus jamais rien,
 * silencieusement. C'est exactement ce qui est arrivé aux utilisateurs restés
 * en 1.0.1 : application figée pendant des semaines, sans le moindre signe.
 *
 * Cet écran est la seule chose qui puisse le leur dire. Il ne s'affiche que si
 * `app_config.version_minimale` est renseignée ET que le binaire installé est
 * plus ancien. Par défaut il ne s'affiche jamais.
 *
 * Il échoue TOUJOURS du côté ouvert : config illisible, version native
 * inconnue, comparaison douteuse → on laisse passer. Mieux vaut quelqu'un qui
 * garde une version ancienne qu'une porte fermée sur une application qui
 * marche.
 *
 * Une seule action à l'écran, un seul bouton plein largeur (§ règles de
 * conception) : ouvrir le store.
 */
export default function GardeVersion({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { versionMinimale, loading } = useAppConfig();
  const [versionNative, setVersionNative] = useState<string | null>(null);
  const [versionLue, setVersionLue] = useState(false);

  useEffect(() => {
    let monte = true;
    getVersionNative().then(v => {
      if (!monte) return;
      setVersionNative(v);
      setVersionLue(true);
    });
    return () => { monte = false; };
  }, []);

  const doitBloquer =
    !loading &&
    versionLue &&
    !!versionMinimale &&
    !!versionNative &&
    estVersionInferieure(versionNative, versionMinimale);

  if (!doitBloquer) return <>{children}</>;

  const styles = createStyles(theme);
  const nomStore = Platform.OS === 'ios' ? "l'App Store" : 'le Play Store';

  return (
    <View style={styles.ecran}>
      <View style={styles.cercle}>
        <Ionicons name="arrow-down-circle" size={64} color={theme.primary} />
      </View>

      <Text style={styles.titre}>Mettez à jour Flash Market</Text>
      <Text style={styles.message}>
        Votre version est trop ancienne. Installez la nouvelle depuis {nomStore} pour
        continuer.
      </Text>

      <TouchableOpacity
        style={styles.bouton}
        onPress={ouvrirStore}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Mettre à jour l'application"
      >
        <Ionicons name="cloud-download-outline" size={22} color={theme.textInverse} />
        <Text style={styles.boutonTexte}>Mettre à jour</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    ecran: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.lg,
    },
    cercle: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: theme.primaryFaded,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    titre: {
      fontSize: FONTS.xxl,
      fontWeight: FONTS.bold,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    message: {
      fontSize: FONTS.lg,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
    },
    bouton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      alignSelf: 'stretch',
      minHeight: 60,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.primary,
      marginTop: SPACING.lg,
    },
    boutonTexte: {
      fontSize: FONTS.lg,
      fontWeight: FONTS.bold,
      color: theme.textInverse,
    },
  });
