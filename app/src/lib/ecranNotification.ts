/**
 * Écran à ouvrir quand on touche une notification.
 *
 * Les messages envoyés depuis la console admin (type « campagne ») portent
 * `donnees.ecran`. Liste FERMÉE, identique à celle que vérifie la fonction
 * `admin_envoyer_campagne` en base : une valeur inconnue n'ouvre rien plutôt
 * que de faire planter la navigation.
 */
const ECRANS: Record<string, [string, object?]> = {
  Invitations: ['Invitations'],
  Publier: ['Main', { screen: 'Publier' }],
  BoosterMesAnnonces: ['BoosterMesAnnonces'],
  MesAnnonces: ['Main', { screen: 'Compte', params: { screen: 'MesAnnonces' } }],
};

/** Écran visé par une notification, ou null. */
export function ecranDeNotification(type?: string, donnees?: any): string | null {
  // « Vous avez gagné un boost » : on l'emmène là où il le voit et l'utilise.
  // Dans un push, seul `donnees` arrive (pas le type) : on reconnaît alors
  // cette notification à son `invitation_id`.
  if (type === 'invitation_validee' || donnees?.invitation_id) return 'Invitations';
  const ecran = donnees?.ecran;
  return typeof ecran === 'string' && ECRANS[ecran] ? ecran : null;
}

/** Ouvre l'écran ; renvoie faux si la notification n'en vise aucun. */
export function ouvrirEcranNotification(navigation: any, type?: string, donnees?: any): boolean {
  const ecran = ecranDeNotification(type, donnees);
  if (!ecran || !navigation) return false;
  const [nom, params] = ECRANS[ecran];
  navigation.navigate(nom, params);
  return true;
}
