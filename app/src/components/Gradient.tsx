import React from 'react';
import { View, StyleSheet, NativeModules, StyleProp, ViewStyle } from 'react-native';

/**
 * Dégradé sûr pour les mises à jour OTA.
 *
 * `expo-linear-gradient` est un module NATIF : il n'existe pas dans les builds
 * déjà installés (1.0.2). L'utiliser directement ferait planter l'écran d'accueil
 * dès la mise à jour OTA — même piège que BlurView (commit 78a8405).
 *
 * Ce composant :
 *  - utilise le vrai LinearGradient si le module natif est présent (builds futurs) ;
 *  - sinon dessine le dégradé en JS pur (bandes de couleurs interpolées),
 *    visuellement très proche et sans aucune dépendance native.
 *
 * Même API que LinearGradient pour les cas utilisés ici : colors / start / end.
 */

interface GradientProps {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// --- Détection du module natif (jamais d'exception, faux par défaut) ---------
let nativeGradient: any = null;
let nativeChecked = false;

function getNativeGradient(): any {
  if (nativeChecked) return nativeGradient;
  nativeChecked = true;
  try {
    const metadata = (NativeModules as any)?.NativeUnimoduleProxy?.viewManagersMetadata;
    const available = !!metadata && !!metadata.ExpoLinearGradient;
    if (available) {
      nativeGradient = require('expo-linear-gradient').LinearGradient;
    }
  } catch {
    nativeGradient = null;
  }
  return nativeGradient;
}

// --- Interpolation de couleurs ----------------------------------------------
function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BANDS = 14;

function buildBands(colors: readonly string[]): string[] | null {
  const stops = colors.map(parseHex);
  if (stops.length < 2 || stops.some(s => s === null)) return null;
  const out: string[] = [];
  for (let i = 0; i < BANDS; i++) {
    const t = i / (BANDS - 1);
    const pos = t * (stops.length - 1);
    const idx = Math.min(Math.floor(pos), stops.length - 2);
    const local = pos - idx;
    const a = stops[idx] as [number, number, number];
    const b = stops[idx + 1] as [number, number, number];
    const r = Math.round(a[0] + (b[0] - a[0]) * local);
    const g = Math.round(a[1] + (b[1] - a[1]) * local);
    const bl = Math.round(a[2] + (b[2] - a[2]) * local);
    out.push(`rgb(${r},${g},${bl})`);
  }
  return out;
}

export default function Gradient({ colors, start, end, style, children }: GradientProps) {
  const Native = getNativeGradient();
  if (Native) {
    return (
      <Native colors={colors as string[]} start={start} end={end} style={style}>
        {children}
      </Native>
    );
  }

  const bands = buildBands(colors);
  const dx = Math.abs((end?.x ?? 1) - (start?.x ?? 0));
  const dy = Math.abs((end?.y ?? 0) - (start?.y ?? 0));
  const horizontal = dx >= dy;

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors[0] }, style]}>
      {bands && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { flexDirection: horizontal ? 'row' : 'column' }]}
        >
          {bands.map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
      )}
      {children}
    </View>
  );
}
