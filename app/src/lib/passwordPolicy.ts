/**
 * Politique de mot de passe alignée sur la configuration Supabase du projet :
 * minimum 8 caractères, avec au moins une minuscule, une majuscule,
 * un chiffre et un caractère spécial.
 * (Vérifiée côté serveur : error_code "weak_password" sinon.)
 */

// Jeu de caractères spéciaux accepté par Supabase
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"|<>?,./`~\\]/;

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES_HINT =
  '8 caractères min., avec majuscule, minuscule, chiffre et caractère spécial (ex. !@#$)';

/** Retourne la liste des critères manquants (vide = mot de passe valide). */
export function getPasswordErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push('8 caractères minimum');
  if (!/[a-z]/.test(password)) errors.push('une minuscule');
  if (!/[A-Z]/.test(password)) errors.push('une majuscule');
  if (!/[0-9]/.test(password)) errors.push('un chiffre');
  if (!SPECIAL_CHARS.test(password)) errors.push('un caractère spécial (ex. !@#$)');
  return errors;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordErrors(password).length === 0;
}

/** Traduit les erreurs Supabase Auth courantes en messages français lisibles. */
export function translateAuthError(err: any): string {
  const code = err?.code || err?.error_code || '';
  const msg = (err?.message || '').toLowerCase();

  if (code === 'weak_password' || msg.includes('password should')) {
    return `Mot de passe trop faible. Il doit contenir : ${PASSWORD_RULES_HINT}.`;
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Numéro de téléphone ou mot de passe incorrect.';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return 'Un compte existe déjà avec ce numéro. Veuillez vous connecter.';
  }
  if (code === 'over_request_rate_limit' || msg.includes('rate limit')) {
    return 'Trop de tentatives. Veuillez patienter quelques minutes puis réessayer.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Problème de connexion Internet. Vérifiez votre réseau puis réessayez.';
  }
  return err?.message || 'Une erreur est survenue. Veuillez réessayer.';
}
