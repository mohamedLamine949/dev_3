/**
 * Chap Chap - Design System & Theme
 * Palette vibrante, moderne, inspirée de l'Afrique de l'Ouest
 */

export const COLORS = {
  // Couleur principale - Vert argent (marketplace premium)
  primary: '#15803d',
  primaryLight: '#16a34a',
  primaryDark: '#166534',
  primaryFaded: 'rgba(21, 128, 61, 0.12)',

  // Couleur secondaire - Or premium
  secondary: '#ca8a04',
  secondaryLight: '#eab308',
  secondaryDark: '#a16207',

  // Couleur d'accent - Émeraude
  accent: '#34d399',
  accentDark: '#10b981',

  // Arrière-plans
  background: '#FAFBFD',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F4F5F7',

  // Textes
  textPrimary: '#1A1D26',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // États
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF6B6B',
  info: '#74B9FF',

  // Bordures & séparateurs
  border: '#E8ECF1',
  borderLight: '#F0F2F5',
  divider: '#F0F2F5',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};

export const FONTS = {
  // Tailles
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,

  // Poids
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
  { id: 'telephonie', label: 'Téléphones', icon: 'smartphone' },
  { id: 'electronique', label: 'Électronique', icon: 'monitor' },
  { id: 'vehicules', label: 'Véhicules', icon: 'truck' },
  { id: 'immobilier', label: 'Immobilier', icon: 'home' },
  { id: 'nourriture', label: 'Nourriture', icon: 'coffee' },
  { id: 'agriculture', label: 'Agriculture & Élevage', icon: 'sun' },
  { id: 'mode', label: 'Mode', icon: 'shopping-bag' },
  { id: 'beaute', label: 'Beauté & Cosmétiques', icon: 'feather' },
  { id: 'electromenager', label: 'Électroménager', icon: 'zap' },
  { id: 'materiaux', label: 'Matériaux & Construction', icon: 'layers' },
  { id: 'maison', label: 'Maison', icon: 'box' },
  { id: 'services', label: 'Services', icon: 'tool' },
  { id: 'loisirs', label: 'Loisirs', icon: 'play-circle' },
  { id: 'autres', label: 'Autres', icon: 'grid' },
];

export const ETAT_ARTICLE = [
  { id: 'neuf', label: 'Neuf' },
  { id: 'comme_neuf', label: 'Comme neuf' },
  { id: 'bon_etat', label: 'Bon état' },
  { id: 'etat_moyen', label: 'État moyen' },
  { id: 'non_specifie', label: 'Non précisé' },
];
