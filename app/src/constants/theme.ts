/**
 * Flash Market — Premium Design System
 * Palette émeraude premium avec support Mode Sombre avancé.
 * Inspiré des design systems d'Uber (Base), Bolt, et Material Design 3.
 *
 * Principes :
 * - Tokens sémantiques (pas de couleurs hardcodées dans les composants)
 * - Élévation par surface en dark mode (pas d'ombres)
 * - Hiérarchie typographique complète
 * - Grille de spacing 4px
 */

// ─────────────────────────────────────────────
// 🎨 Palettes
// ─────────────────────────────────────────────

export const LIGHT_COLORS = {
  // Brand
  primary: '#059669',
  primaryLight: '#10B981',
  primaryDark: '#047857',
  primaryFaded: 'rgba(5, 150, 105, 0.08)',

  secondary: '#F59E0B',
  secondaryLight: '#FBBF24',
  secondaryDark: '#D97706',

  accent: '#34D399',
  accentDark: '#10B981',

  // Surfaces
  background: '#FAFBFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F5F7FA',

  // Texte
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Feedback
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Bordures
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#F3F4F6',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};

export const DARK_COLORS = {
  // Brand — plus lumineux sur fond sombre
  primary: '#34D399',
  primaryLight: '#6EE7B7',
  primaryDark: '#10B981',
  primaryFaded: 'rgba(52, 211, 153, 0.12)',

  secondary: '#FBBF24',
  secondaryLight: '#FCD34D',
  secondaryDark: '#F59E0B',

  accent: '#6EE7B7',
  accentDark: '#34D399',

  // Surfaces — élévation par luminosité progressive
  background: '#0A0F1A',
  surface: '#141B2D',
  surfaceElevated: '#1C2438',
  surfaceMuted: '#141B2D',

  // Texte — pas de blanc pur pour éviter la fatigue
  textPrimary: '#F9FAFB',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  // Feedback
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  // Bordures
  border: '#1E293B',
  borderLight: '#1C2438',
  divider: '#1E293B',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
};

export type ThemeColors = typeof LIGHT_COLORS;

// Compatibilité : les écrans qui importent `COLORS` directement
// continuent de fonctionner. Sera progressivement remplacé par `theme.*`
export const COLORS = LIGHT_COLORS;

// ─────────────────────────────────────────────
// 🔤 Typographie
// ─────────────────────────────────────────────

export const FONTS = {
  // Tailles — hiérarchie claire
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

/**
 * Tokens typographiques sémantiques.
 * Utilisation : `style={[TYPOGRAPHY.h1, { color: theme.textPrimary }]}`
 */
export const TYPOGRAPHY = {
  display: {
    fontSize: 32,
    fontWeight: '800' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 26,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodySemibold: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  price: {
    fontSize: 18,
    fontWeight: '800' as const,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
};

// ─────────────────────────────────────────────
// 📏 Spacing (grille 4px)
// ─────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 48,
};

// ─────────────────────────────────────────────
// 🔘 Border Radius — plus doux, plus premium
// ─────────────────────────────────────────────

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
  full: 9999,
};

// ─────────────────────────────────────────────
// 🌗 Shadows (light mode seulement — dark mode utilise l'élévation)
// ─────────────────────────────────────────────

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
  colored: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ─────────────────────────────────────────────
// 📂 Catégories & Sous-catégories
// ─────────────────────────────────────────────

export const CATEGORIES = [
  { id: 'telephonie_electronique', label: 'Téléphonie & Électronique', icon: 'phone-portrait-outline' },
  { id: 'mode_beaute', label: 'Mode & Beauté', icon: 'shirt-outline' },
  { id: 'maison_electromenager', label: 'Maison & Électroménager', icon: 'cube-outline' },
  { id: 'voitures', label: 'Voitures', icon: 'car-outline' },
  { id: 'motos', label: 'Motos', icon: 'bicycle-outline' },
  { id: 'immobilier', label: 'Immobilier', icon: 'business-outline' },
  { id: 'alimentation', label: 'Alimentation', icon: 'cafe-outline' },
  { id: 'animaux', label: 'Animaux', icon: 'paw-outline' },
  { id: 'services', label: 'Services', icon: 'build-outline' },
];

// Sous-catégories par catégorie principale. Même prix de publication que la
// catégorie parente — purement un niveau de navigation/filtrage supplémentaire.
// `keywords` : termes fréquents utilisés par le scoring de recherche textuelle
// pour faire remonter les annonces de la sous-catégorie (ex: "playstation").
export interface SousCategorie {
  id: string;
  label: string;
  keywords?: string[];
}

export const SUBCATEGORIES: Record<string, SousCategorie[]> = {
  telephonie_electronique: [
    { id: 'telephones', label: 'Téléphones', keywords: ['iphone', 'samsung', 'tecno', 'infinix', 'itel', 'redmi', 'smartphone', 'portable'] },
    { id: 'tablettes', label: 'Tablettes', keywords: ['ipad', 'tablette', 'tab'] },
    { id: 'ordinateurs', label: 'Ordinateurs', keywords: ['pc', 'laptop', 'macbook', 'hp', 'dell', 'lenovo', 'ordinateur'] },
    { id: 'tv_audio', label: 'TV & Audio', keywords: ['tv', 'television', 'télévision', 'ecran', 'écran', 'enceinte', 'baffle', 'casque', 'radio'] },
    { id: 'consoles_jeux_video', label: 'Consoles & Jeux vidéo', keywords: ['playstation', 'ps2', 'ps3', 'ps4', 'ps5', 'xbox', 'nintendo', 'manette', 'console', 'jeu', 'jeux'] },
    { id: 'accessoires_electronique', label: 'Accessoires', keywords: ['chargeur', 'cable', 'câble', 'coque', 'ecouteurs', 'écouteurs', 'batterie', 'powerbank'] },
    { id: 'autre_telephonie_electronique', label: 'Autre' },
  ],
  mode_beaute: [
    { id: 'vetements_homme', label: 'Vêtements homme', keywords: ['chemise', 'pantalon', 'boubou', 'costume', 'tshirt', 'polo'] },
    { id: 'vetements_femme', label: 'Vêtements femme', keywords: ['robe', 'pagne', 'wax', 'ensemble', 'jupe', 'voile'] },
    { id: 'chaussures', label: 'Chaussures', keywords: ['baskets', 'sneakers', 'sandales', 'talons', 'nike', 'adidas', 'chaussure'] },
    { id: 'sacs_accessoires', label: 'Sacs & Accessoires', keywords: ['sac', 'sacoche', 'ceinture', 'lunettes', 'casquette'] },
    { id: 'beaute_cosmetiques', label: 'Beauté & Cosmétiques', keywords: ['parfum', 'maquillage', 'creme', 'crème', 'meches', 'mèches', 'perruque'] },
    { id: 'montres_bijoux', label: 'Montres & Bijoux', keywords: ['montre', 'bijou', 'collier', 'bague', 'chaine', 'chaîne', 'or', 'argent'] },
    { id: 'autre_mode_beaute', label: 'Autre' },
  ],
  maison_electromenager: [
    { id: 'meubles', label: 'Meubles', keywords: ['canape', 'canapé', 'salon', 'lit', 'matelas', 'armoire', 'table', 'chaise'] },
    { id: 'electromenager', label: 'Électroménager', keywords: ['frigo', 'refrigerateur', 'réfrigérateur', 'congelateur', 'congélateur', 'climatiseur', 'clim', 'ventilateur', 'machine', 'cuisiniere', 'cuisinière'] },
    { id: 'decoration', label: 'Décoration', keywords: ['deco', 'déco', 'rideau', 'tapis', 'miroir', 'tableau'] },
    { id: 'materiaux_construction', label: 'Matériaux de construction', keywords: ['ciment', 'fer', 'tole', 'tôle', 'carreaux', 'peinture', 'porte', 'fenetre', 'fenêtre'] },
    { id: 'jardin', label: 'Jardin', keywords: ['jardin', 'plante', 'arrosage', 'fleurs'] },
    { id: 'autre_maison_electromenager', label: 'Autre' },
  ],
  voitures: [
    { id: 'voitures_vente', label: 'Voitures', keywords: ['toyota', 'mercedes', 'bmw', 'hyundai', 'kia', 'corolla', 'rav4', '4x4', 'berline', 'suv'] },
    { id: 'pieces_auto', label: 'Pièces & Accessoires auto', keywords: ['moteur', 'pneu', 'jante', 'batterie', 'phare', 'piece', 'pièce', 'pieces', 'pièces', 'amortisseur', 'pare-choc'] },
    { id: 'autre_voitures', label: 'Autre' },
  ],
  motos: [
    { id: 'motos_scooters', label: 'Motos & Scooters', keywords: ['djakarta', 'jakarta', 'scooter', 'tvs', 'apsonic', 'haojue'] },
    { id: 'pieces_moto', label: 'Pièces & Accessoires moto', keywords: ['casque', 'pneu', 'piece', 'pièce', 'pieces', 'pièces', 'pot', 'guidon', 'selle'] },
    { id: 'autre_motos', label: 'Autre' },
  ],
  immobilier: [
    { id: 'location_residentiel', label: 'Location maisons & appartements', keywords: ['louer', 'location', 'appartement', 'studio', 'chambre', 'villa'] },
    { id: 'vente_maisons', label: 'Vente de maisons', keywords: ['vente', 'vendre', 'maison', 'villa', 'duplex'] },
    { id: 'vente_terrains', label: 'Vente de terrains', keywords: ['terrain', 'parcelle', 'titre foncier', 'hectare', 'lot'] },
    { id: 'bureaux_commerces', label: 'Bureaux & Commerces', keywords: ['bureau', 'boutique', 'magasin', 'local', 'entrepot', 'entrepôt'] },
    { id: 'autre_immobilier', label: 'Autre' },
  ],
  alimentation: [
    { id: 'restaurants', label: 'Restaurants & Plats préparés', keywords: ['restaurant', 'plat', 'repas', 'traiteur', 'grillade', 'fast food'] },
    { id: 'supermarches', label: 'Supermarchés & Épicerie', keywords: ['supermarche', 'supermarché', 'epicerie', 'épicerie', 'riz', 'huile', 'sucre'] },
    { id: 'autre_alimentation', label: 'Autre' },
  ],
  animaux: [
    { id: 'boeufs_vaches', label: 'Bœufs & Vaches', keywords: ['boeuf', 'bœuf', 'vache', 'taureau', 'veau', 'betail', 'bétail'] },
    { id: 'moutons', label: 'Moutons', keywords: ['mouton', 'belier', 'bélier', 'brebis', 'agneau', 'tabaski'] },
    { id: 'chevres', label: 'Chèvres', keywords: ['chevre', 'chèvre', 'bouc', 'cabri'] },
    { id: 'volailles', label: 'Volailles & Poules', keywords: ['poule', 'coq', 'poulet', 'poussin', 'dinde', 'canard', 'pintade', 'oie'] },
    { id: 'pigeons', label: 'Pigeons & Oiseaux', keywords: ['pigeon', 'oiseau', 'perroquet', 'colombe'] },
    { id: 'autre_animaux', label: 'Autre', keywords: ['chien', 'chat', 'cheval', 'ane', 'âne', 'autruche'] },
  ],
  services: [
    { id: 'reparation_electronique', label: 'Réparation téléphones & électronique', keywords: ['reparation', 'réparation', 'reparateur', 'réparateur', 'flash', 'decodage', 'décodage'] },
    { id: 'mecanique', label: 'Mécanique auto & moto', keywords: ['mecanicien', 'mécanicien', 'garage', 'vidange'] },
    { id: 'construction_btp', label: 'Construction & BTP', keywords: ['macon', 'maçon', 'plombier', 'electricien', 'électricien', 'peintre', 'carreleur'] },
    { id: 'menuiserie_soudure', label: 'Menuiserie & Soudure', keywords: ['menuisier', 'soudeur', 'ferronnerie', 'bois'] },
    { id: 'couture_tailleur', label: 'Couture & Tailleur', keywords: ['couturier', 'couture', 'tailleur', 'broderie'] },
    { id: 'coiffure_esthetique', label: 'Coiffure & Esthétique', keywords: ['coiffeur', 'coiffure', 'salon', 'tresses', 'onglerie'] },
    { id: 'menage_nettoyage', label: 'Ménage & Nettoyage', keywords: ['menage', 'ménage', 'nettoyage', 'lessive'] },
    { id: 'cours_formation', label: 'Cours & Formation', keywords: ['cours', 'formation', 'professeur', 'soutien', 'langue'] },
    { id: 'evenementiel', label: 'Événementiel', keywords: ['mariage', 'bapteme', 'baptême', 'sonorisation', 'bache', 'bâche', 'chaises'] },
    { id: 'transport_demenagement', label: 'Transport & Déménagement', keywords: ['transport', 'demenagement', 'déménagement', 'livraison', 'location voiture'] },
    { id: 'photo_video', label: 'Photographie & Vidéo', keywords: ['photographe', 'video', 'vidéo', 'cameraman', 'shooting', 'drone'] },
    { id: 'informatique_design', label: 'Informatique & Design', keywords: ['site web', 'graphiste', 'logo', 'flyer', 'design', 'developpeur', 'développeur', 'reseaux sociaux', 'réseaux sociaux'] },
    { id: 'autres_services', label: 'Autres services' },
  ],
};

export function getSousCategorieLabel(id?: string | null): string | null {
  if (!id) return null;
  for (const subs of Object.values(SUBCATEGORIES)) {
    const found = subs.find((s) => s.id === id);
    if (found) return found.label;
  }
  return null;
}

// Texte de recherche (label + mots-clés, en minuscules) d'une sous-catégorie,
// utilisé par le scoring de pertinence des annonces.
export function getSousCategorieSearchText(id?: string | null): string {
  if (!id) return '';
  for (const subs of Object.values(SUBCATEGORIES)) {
    const found = subs.find((s) => s.id === id);
    if (found) return `${found.label} ${(found.keywords || []).join(' ')}`.toLowerCase();
  }
  return '';
}

// ─────────────────────────────────────────────
// 💰 Prix par catégorie
// ─────────────────────────────────────────────

export const CATEGORY_PRICES: Record<string, number> = {
  telephonie_electronique: 250,
  mode_beaute:             250,
  maison_electromenager:   250,
  voitures:                5000,
  motos:                   1000,
  immobilier:              2500,
  alimentation:            500,
  services:                500,
  animaux:                 250,
};

// ─────────────────────────────────────────────
// 📦 État article
// ─────────────────────────────────────────────

export const ETAT_ARTICLE = [
  { id: 'neuf', label: 'Neuf' },
  { id: 'comme_neuf', label: 'Comme neuf' },
  { id: 'bon_etat', label: 'Bon état' },
  { id: 'etat_moyen', label: 'État moyen' },
  { id: 'non_specifie', label: 'Non précisé' },
];

// ─────────────────────────────────────────────
// 📊 Plans d'abonnement
// ─────────────────────────────────────────────

export const PLANS_CONFIG = {
  particulier: {
    id: 'particulier',
    nom: 'Gratuit (Occasionnel)',
    prix: 0,
    quotaMensuel: 3,
    dureeAnnonceJours: 30,
    badgeVerifie: false,
    boutique: false,
    annoncesPermanentes: false,
    boost: 'Normale',
    stats: false,
  },
  vendeur: {
    id: 'vendeur',
    nom: 'Vendeur',
    prix: 2000,
    quotaMensuel: 30,
    dureeAnnonceJours: 30,
    badgeVerifie: false,
    boutique: false,
    annoncesPermanentes: false,
    boost: 'Léger',
    stats: true,
  },
  professionnel: {
    id: 'professionnel',
    nom: 'PRO / Boutique',
    prix: 5000, // Abonnement PRO (monétisation via interrupteur app_config.payments_enabled)
    quotaMensuel: Infinity,
    dureeAnnonceJours: null, // N'expire jamais
    badgeVerifie: true,
    boutique: true,
    annoncesPermanentes: true,
    boost: 'Maximale',
    stats: true,
  },
} as const;
