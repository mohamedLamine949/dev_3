/**
 * Indicatifs téléphoniques internationaux.
 *
 * Flash Market est né au Mali (+223) mais des utilisateurs de la diaspora
 * (France, Côte d'Ivoire, USA…) créent un compte pour acheter au Mali et faire
 * récupérer l'article par un proche sur place. L'indicatif n'est donc plus
 * figé : il est sélectionnable, avec le Mali en valeur par défaut.
 *
 * `min` / `max` = nombre de chiffres du numéro NATIONAL (hors indicatif).
 * Volontairement tolérants : on veut valider un format plausible, pas rejeter
 * un numéro valide sur une longueur trop stricte. Le Mali reste à 8 chiffres.
 */

export interface Country {
  name: string;
  iso: string; // ISO 3166-1 alpha-2
  dial: string; // indicatif E.164, ex: '+223'
  flag: string; // emoji drapeau
  min: number; // longueur min du numéro national
  max: number; // longueur max du numéro national
}

/** Pays par défaut : Mali. */
export const DEFAULT_COUNTRY_ISO = 'ML';

export const COUNTRIES: Country[] = [
  // Mali en premier (défaut)
  { name: 'Mali', iso: 'ML', dial: '+223', flag: '🇲🇱', min: 8, max: 8 },

  // Afrique de l'Ouest & voisins (fort trafic diaspora / cross-border)
  { name: "Côte d'Ivoire", iso: 'CI', dial: '+225', flag: '🇨🇮', min: 8, max: 10 },
  { name: 'Sénégal', iso: 'SN', dial: '+221', flag: '🇸🇳', min: 9, max: 9 },
  { name: 'Burkina Faso', iso: 'BF', dial: '+226', flag: '🇧🇫', min: 8, max: 8 },
  { name: 'Guinée', iso: 'GN', dial: '+224', flag: '🇬🇳', min: 8, max: 9 },
  { name: 'Niger', iso: 'NE', dial: '+227', flag: '🇳🇪', min: 8, max: 8 },
  { name: 'Mauritanie', iso: 'MR', dial: '+222', flag: '🇲🇷', min: 8, max: 8 },
  { name: 'Togo', iso: 'TG', dial: '+228', flag: '🇹🇬', min: 8, max: 8 },
  { name: 'Bénin', iso: 'BJ', dial: '+229', flag: '🇧🇯', min: 8, max: 10 },
  { name: 'Ghana', iso: 'GH', dial: '+233', flag: '🇬🇭', min: 9, max: 9 },
  { name: 'Nigeria', iso: 'NG', dial: '+234', flag: '🇳🇬', min: 7, max: 11 },
  { name: 'Gambie', iso: 'GM', dial: '+220', flag: '🇬🇲', min: 7, max: 7 },
  { name: 'Guinée-Bissau', iso: 'GW', dial: '+245', flag: '🇬🇼', min: 7, max: 9 },
  { name: 'Sierra Leone', iso: 'SL', dial: '+232', flag: '🇸🇱', min: 8, max: 8 },
  { name: 'Liberia', iso: 'LR', dial: '+231', flag: '🇱🇷', min: 7, max: 9 },
  { name: 'Cap-Vert', iso: 'CV', dial: '+238', flag: '🇨🇻', min: 7, max: 7 },

  // Afrique centrale & autres
  { name: 'Cameroun', iso: 'CM', dial: '+237', flag: '🇨🇲', min: 8, max: 9 },
  { name: 'Gabon', iso: 'GA', dial: '+241', flag: '🇬🇦', min: 6, max: 8 },
  { name: 'Congo', iso: 'CG', dial: '+242', flag: '🇨🇬', min: 9, max: 9 },
  { name: 'RD Congo', iso: 'CD', dial: '+243', flag: '🇨🇩', min: 9, max: 9 },
  { name: 'Tchad', iso: 'TD', dial: '+235', flag: '🇹🇩', min: 8, max: 8 },
  { name: 'Maroc', iso: 'MA', dial: '+212', flag: '🇲🇦', min: 9, max: 9 },
  { name: 'Algérie', iso: 'DZ', dial: '+213', flag: '🇩🇿', min: 9, max: 9 },
  { name: 'Tunisie', iso: 'TN', dial: '+216', flag: '🇹🇳', min: 8, max: 8 },
  { name: 'Égypte', iso: 'EG', dial: '+20', flag: '🇪🇬', min: 9, max: 10 },
  { name: 'Kenya', iso: 'KE', dial: '+254', flag: '🇰🇪', min: 9, max: 9 },
  { name: 'Afrique du Sud', iso: 'ZA', dial: '+27', flag: '🇿🇦', min: 9, max: 9 },

  // Europe (diaspora)
  { name: 'France', iso: 'FR', dial: '+33', flag: '🇫🇷', min: 9, max: 9 },
  { name: 'Belgique', iso: 'BE', dial: '+32', flag: '🇧🇪', min: 8, max: 9 },
  { name: 'Suisse', iso: 'CH', dial: '+41', flag: '🇨🇭', min: 9, max: 9 },
  { name: 'Espagne', iso: 'ES', dial: '+34', flag: '🇪🇸', min: 9, max: 9 },
  { name: 'Italie', iso: 'IT', dial: '+39', flag: '🇮🇹', min: 9, max: 10 },
  { name: 'Allemagne', iso: 'DE', dial: '+49', flag: '🇩🇪', min: 10, max: 11 },
  { name: 'Royaume-Uni', iso: 'GB', dial: '+44', flag: '🇬🇧', min: 10, max: 10 },
  { name: 'Portugal', iso: 'PT', dial: '+351', flag: '🇵🇹', min: 9, max: 9 },
  { name: 'Pays-Bas', iso: 'NL', dial: '+31', flag: '🇳🇱', min: 9, max: 9 },
  { name: 'Suède', iso: 'SE', dial: '+46', flag: '🇸🇪', min: 7, max: 9 },

  // Amérique du Nord & Moyen-Orient / Asie (diaspora)
  { name: 'États-Unis', iso: 'US', dial: '+1', flag: '🇺🇸', min: 10, max: 10 },
  { name: 'Canada', iso: 'CA', dial: '+1', flag: '🇨🇦', min: 10, max: 10 },
  { name: 'Émirats arabes unis', iso: 'AE', dial: '+971', flag: '🇦🇪', min: 8, max: 9 },
  { name: 'Arabie saoudite', iso: 'SA', dial: '+966', flag: '🇸🇦', min: 9, max: 9 },
  { name: 'Turquie', iso: 'TR', dial: '+90', flag: '🇹🇷', min: 10, max: 10 },
  { name: 'Chine', iso: 'CN', dial: '+86', flag: '🇨🇳', min: 11, max: 11 },
  { name: 'Inde', iso: 'IN', dial: '+91', flag: '🇮🇳', min: 10, max: 10 },
];

/** Pays par défaut (Mali), garanti présent. */
export const DEFAULT_COUNTRY: Country =
  COUNTRIES.find((c) => c.iso === DEFAULT_COUNTRY_ISO) ?? COUNTRIES[0];

/** Retourne le pays correspondant à un code ISO, ou le défaut. */
export function countryByIso(iso?: string | null): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;
}

/** Garde uniquement les chiffres d'une saisie. */
export function onlyDigits(input: string): string {
  return (input || '').replace(/\D/g, '');
}

/**
 * Valide un numéro NATIONAL (sans indicatif) pour un pays donné :
 * uniquement des chiffres, dans la plage de longueur attendue.
 */
export function isValidNationalNumber(digits: string, country: Country): boolean {
  const d = onlyDigits(digits);
  return d.length >= country.min && d.length <= country.max;
}

/** Numéro complet au format E.164 : indicatif + numéro national. Ex: +22370000000 */
export function toE164(country: Country, nationalDigits: string): string {
  return `${country.dial}${onlyDigits(nationalDigits)}`;
}
