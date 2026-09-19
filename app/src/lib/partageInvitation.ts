import { Linking, Share } from 'react-native';

/**
 * Partage du code de parrainage — un seul texte pour toute l'application
 * (écran Parrainage, invitation après la première annonce).
 *
 * WhatsApp d'abord : c'est là que tout se partage au Mali. Si l'application
 * n'est pas installée, on retombe sur le partage du téléphone.
 */

/** Montant du concours de lancement. */
export const CONCOURS_MONTANT = '100 000 FCFA';

/**
 * Filleuls validés qui rapportent un boost gratuit (règle du 2026-09-19,
 * migration_parrainage_paliers.sql) : un boost au 3e, un second au 5e — qui
 * ouvre aussi le tirage. Au plus deux boosts par parrain. La base décide ;
 * l'application ne fait que l'afficher.
 */
export const PALIERS_BOOST = [3, 5];

/** « Encore N pour… » : le prochain objectif, en clair. */
export function prochainObjectif(valides: number): string {
  if (valides < 3) return `Encore ${3 - valides} pour votre boost gratuit`;
  if (valides < 5) return `Encore ${5 - valides} pour le tirage et un 2e boost`;
  return 'Vous participez au tirage';
}

/** Page d'accueil du site : elle renvoie vers le bon magasin d'applications. */
const LIEN_APPLI = 'https://app-flashmarket.com';

export function messageInvitation(code: string): string {
  return (
    `Rejoins-moi sur Flash Market : on y achète et on y vend de tout, près de chez nous.\n\n` +
    `A l'inscription, saisis mon code : *${code}*\n\n` +
    `Télécharge l'application ici : ${LIEN_APPLI}`
  );
}

export async function partagerSurWhatsApp(code: string): Promise<void> {
  const texte = messageInvitation(code);
  const url = `whatsapp://send?text=${encodeURIComponent(texte)}`;
  // Pas de `canOpenURL` : sur iOS et Android 11+, il répond « non » tant que
  // le schéma n'est pas déclaré dans le binaire — ce qu'une mise à jour OTA
  // ne peut pas faire. `openURL` échoue proprement si WhatsApp est absent.
  try {
    await Linking.openURL(url);
  } catch {
    await partagerAutrement(code);
  }
}

export async function partagerAutrement(code: string): Promise<void> {
  try {
    await Share.share({ message: messageInvitation(code) });
  } catch {
    // La personne a fermé la feuille de partage : rien à faire.
  }
}
