import { supabase } from './supabase';

/**
 * Enregistrement d'une mise en relation qualifiée (§3.4).
 *
 * C'est la métrique centrale du produit : le nombre de fois où un acheteur
 * passe réellement à l'action après avoir consulté une publication. Elle
 * représente la valeur bien mieux que les installations ou les vues, et
 * c'est la seule preuve qu'on puisse montrer à un professionnel pour
 * justifier son abonnement.
 *
 * Le vendeur n'est jamais transmis : il est déduit de l'annonce côté
 * serveur, pour que personne ne puisse gonfler ses propres chiffres ni ceux
 * d'un concurrent. Un vendeur qui touche sa propre annonce n'est pas compté,
 * et un même utilisateur qui reclique ne compte qu'une fois par tranche de
 * six heures.
 *
 * L'appel ne bloque JAMAIS l'action de l'utilisateur : si la mesure échoue,
 * l'appel téléphonique ou l'ouverture de WhatsApp doit avoir lieu quand
 * même. On n'attend pas la réponse et on avale les erreurs.
 */

export type TypeContact = 'message' | 'whatsapp' | 'appel' | 'commande' | 'devis';

export function enregistrerContact(annonceId: string | undefined, type: TypeContact): void {
  if (!annonceId) return;
  // Volontairement sans `await` : mesurer ne doit jamais retarder l'action.
  supabase
    .rpc('enregistrer_contact', { p_annonce_id: annonceId, p_type: type })
    .then(({ error }) => {
      // Migration pas encore appliquée, ou réseau coupé : on ignore. Perdre
      // une mesure est sans conséquence ; bloquer un contact en aurait une.
      if (error && __DEV__) {
        console.log('[contact] non enregistré :', error.message);
      }
    });
}

/**
 * Contact au niveau BOUTIQUE, quand aucune publication précise n'est en jeu :
 * les boutons « Appeler » et « WhatsApp » d'une vitrine. Ce sont les mises en
 * relation les plus directes — les omettre viderait la mesure de son sens.
 */
export function enregistrerContactBoutique(vendeurId: string | undefined, type: TypeContact): void {
  if (!vendeurId) return;
  supabase
    .rpc('enregistrer_contact_boutique', { p_vendeur_id: vendeurId, p_type: type })
    .then(({ error }) => {
      if (error && __DEV__) {
        console.log('[contact boutique] non enregistré :', error.message);
      }
    });
}
