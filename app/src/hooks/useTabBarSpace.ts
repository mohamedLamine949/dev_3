import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '../constants/theme';

/**
 * Source unique de verite pour la place occupee par la tab bar flottante.
 *
 * La barre est en `position: absolute` au-dessus du contenu : sans reserver
 * cet espace en bas des ecrans, les derniers elements (bouton "Publier",
 * carte du programme partenaire...) passent sous la barre et deviennent
 * intouchables — surtout sur iPhone ou l'indicateur home ajoute une marge.
 */

// Contenu de la barre : tabItem (minHeight 48) + paddingVertical (SPACING.sm x2)
export const TAB_BAR_HEIGHT = 48 + SPACING.sm * 2;

// Le bouton "+" central deborde vers le haut (fabWrapper marginTop: -22) :
// sans ce supplement il recouvre encore le milieu des boutons pleine largeur.
export const TAB_BAR_FAB_OVERHANG = 22;

/** Marge sous la barre : zone sure iOS (indicateur home) ou marge fixe Android. */
export function useTabBarBottomPadding() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 8) : 12;
}

/**
 * Hauteur totale a reserver en bas d'un ecran affiche sous la tab bar.
 * A utiliser en `paddingBottom` du contentContainerStyle des listes/scrolls,
 * ou en `bottom` d'une barre d'action collee en bas.
 */
export function useTabBarSpace() {
  const bottomPadding = useTabBarBottomPadding();
  return TAB_BAR_HEIGHT + TAB_BAR_FAB_OVERHANG + bottomPadding;
}
