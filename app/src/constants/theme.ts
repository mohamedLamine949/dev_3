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

export const ETAT_ARTICLE = [
  { id: 'neuf', label: 'Neuf' },
  { id: 'comme_neuf', label: 'Comme neuf' },
  { id: 'bon_etat', label: 'Bon état' },
  { id: 'etat_moyen', label: 'État moyen' },
  { id: 'non_specifie', label: 'Non précisé' },
];
