import { supabase } from './supabase';

/**
 * Authentification "téléphone" sans fournisseur SMS.
 *
 * Au Mali aucun fournisseur SMS/WhatsApp fiable n'est disponible via Supabase.
 * On contourne le problème en créant le compte Supabase avec un e-mail
 * TECHNIQUE déterministe dérivé du numéro (ex: 70000000@phone.chapchap.app).
 * Le vrai numéro est stocké dans public.users.num_telephone, et l'utilisateur
 * peut plus tard ajouter un vrai e-mail (récupération de mot de passe).
 */

// Domaine technique des e-mails dérivés du numéro. Ne doit JAMAIS recevoir de courrier.
export const PHONE_EMAIL_DOMAIN = 'phone.chapchap.app';

// Indicatif pays Mali
export const MALI_DIAL_CODE = '+223';

/** Garde uniquement les chiffres d'une saisie. */
export function sanitizePhoneDigits(input: string): string {
  return (input || '').replace(/\D/g, '');
}

/** Un numéro malien valide = exactement 8 chiffres (aucune lettre, aucun symbole). */
export function isValidMaliPhone(input: string): boolean {
  return /^\d{8}$/.test(sanitizePhoneDigits(input));
}

/** Format E.164 stocké en base : +22370000000. */
export function formatPhoneE164(input: string): string {
  return `${MALI_DIAL_CODE}${sanitizePhoneDigits(input)}`;
}

/** E-mail technique utilisé comme identifiant Supabase pour un numéro. */
export function phoneToSyntheticEmail(input: string): string {
  return `${sanitizePhoneDigits(input)}@${PHONE_EMAIL_DOMAIN}`;
}

/** True si l'e-mail est un e-mail technique (et non un vrai e-mail utilisateur). */
export function isSyntheticEmail(email?: string | null): boolean {
  return !!email && email.endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

/**
 * Retrouve l'e-mail d'authentification courant pour un numéro.
 * Renvoie l'e-mail technique tant que l'utilisateur n'a pas renseigné de vrai
 * e-mail, sinon le vrai e-mail. null si aucun compte n'existe pour ce numéro.
 */
export async function getLoginEmailForPhone(phone: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_login_email', {
    p_phone: formatPhoneE164(phone),
  });
  if (error) {
    console.warn('[phoneAuth] get_login_email error:', error.message);
    return null;
  }
  return (data as string) || null;
}
