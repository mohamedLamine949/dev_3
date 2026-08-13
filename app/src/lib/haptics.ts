/**
 * Flash Market — Helper Haptic Feedback
 * Fournit un feedback tactile fluide sur iOS et Android.
 * Évite les crashs si le matériel ne prend pas en charge les haptics.
 */
import * as Haptics from 'expo-haptics';

export function hapticLight() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {
    // Non supporté ou désactivé sur l'appareil
  }
}

export function hapticMedium() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (e) {
    // Non supporté
  }
}

export function hapticSuccess() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {
    // Non supporté
  }
}

export function hapticError() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (e) {
    // Non supporté
  }
}
