/**
 * Chap Chap - Design System & Theme
 * Palette vibrante, moderne, avec support Mode Sombre
 */

export const LIGHT_COLORS = {
  primary: '#15803d',
  primaryLight: '#16a34a',
  primaryDark: '#166534',
  primaryFaded: 'rgba(21, 128, 61, 0.12)',

  secondary: '#ca8a04',
  secondaryLight: '#eab308',
  secondaryDark: '#a16207',

  accent: '#34d399',
  accentDark: '#10b981',

  background: '#FAFBFD',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F4F5F7',

  textPrimary: '#1A1D26',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF6B6B',
  info: '#74B9FF',

  border: '#E8ECF1',
  borderLight: '#F0F2F5',
  divider: '#F0F2F5',

  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};

export const DARK_COLORS = {
  primary: '#16a34a', // Slightly brighter in dark mode
  primaryLight: '#22c55e',
  primaryDark: '#15803d',
  primaryFaded: 'rgba(22, 163, 74, 0.15)',

  secondary: '#eab308',
  secondaryLight: '#facc15',
  secondaryDark: '#ca8a04',

  accent: '#34d399',
  accentDark: '#10b981',

  background: '#0F172A',
  surface: '#1E293B',
  surfaceElevated: '#334155',
  surfaceMuted: '#1E293B',

  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF6B6B',
  info: '#74B9FF',

  border: '#334155',
  borderLight: '#1E293B',
  divider: '#334155',

  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
};

export type ThemeColors = typeof LIGHT_COLORS;

// Par défaut pour la compatibilité
export const COLORS = LIGHT_COLORS;

export const FONTS = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  colored: {
    shadowColor: '#15803d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const CATEGORIES = [
  { id: 'telephonie_electronique', label: 'Téléphonie & Électronique', icon: 'phone-portrait-outline' },
  { id: 'mode_beaute', label: 'Mode & Beauté', icon: 'shirt-outline' },
  { id: 'maison_electromenager', label: 'Maison & Électroménager', icon: 'cube-outline' },
  { id: 'voitures', label: 'Voitures', icon: 'car-outline' },
  { id: 'motos', label: 'Motos', icon: 'bicycle-outline' },
  { id: 'immobilier', label: 'Immobilier', icon: 'business-outline' },
  { id: 'nourriture', label: 'Nourriture', icon: 'cafe-outline' },
  { id: 'services', label: 'Services', icon: 'build-outline' },
];

export const CATEGORY_PRICES: Record<string, number> = {
  telephonie_electronique: 250,
  mode_beaute:             250,
  maison_electromenager:   250,
  voitures:                5000,
  motos:                   1000,
  immobilier:              2500,
  nourriture:              500,
  services:                500,
};

export const ETAT_ARTICLE = [
  { id: 'neuf', label: 'Neuf' },
  { id: 'comme_neuf', label: 'Comme neuf' },
  { id: 'bon_etat', label: 'Bon état' },
  { id: 'etat_moyen', label: 'État moyen' },
  { id: 'non_specifie', label: 'Non précisé' },
];
