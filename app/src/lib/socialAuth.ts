import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Identifiants OAuth (à renseigner dans .env / eas.json — voir README auth).
//   - WEB client ID : sert d'« audience » ; c'est lui que Supabase valide.
//   - iOS client ID : requis par la lib native Google sur iOS.
// ---------------------------------------------------------------------------
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID, // audience validée côté Supabase
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
  googleConfigured = true;
}

/** L'utilisateur a annulé volontairement le dialogue natif (pas une vraie erreur). */
export class UserCancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'UserCancelledError';
  }
}

/**
 * Connexion Google via jeton natif → échange avec Supabase (signInWithIdToken).
 * Disponible sur iOS et Android.
 */
export async function signInWithGoogle() {
  ensureGoogleConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result: any = await GoogleSignin.signIn();

    // La forme du retour varie selon la version de la lib : idToken peut être
    // à la racine (anciennes) ou sous `data` (v13+).
    const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;
    if (!idToken) {
      throw new Error("Google n'a pas renvoyé de jeton d'identité.");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
    return data;
  } catch (err: any) {
    if (
      err?.code === statusCodes.SIGN_IN_CANCELLED ||
      err?.code === statusCodes.IN_PROGRESS
    ) {
      throw new UserCancelledError();
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Connexion par e-mail (OTP à 6 chiffres, SANS mot de passe).
//   signInWithOtp crée le compte s'il n'existe pas, ou connecte s'il existe :
//   « s'inscrire » et « se connecter » sont donc le même flux.
//   Prérequis dashboard : le template e-mail « Magic Link » de Supabase doit
//   contenir {{ .Token }} pour envoyer le CODE (et non un lien).
// ---------------------------------------------------------------------------

/** Envoie un code OTP à 6 chiffres à l'adresse e-mail. */
export async function sendEmailOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Vérifie le code OTP e-mail → ouvre (ou crée) la session. */
export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw error;
  return data;
}

/** Sign in with Apple n'est disponible que sur iOS (≥ 13). */
export const isAppleAuthSupported = Platform.OS === 'ios';

/**
 * Connexion Apple → échange avec Supabase (signInWithIdToken).
 * Le nom complet n'est fourni par Apple qu'à la TOUTE PREMIÈRE connexion :
 * on le renvoie pour pouvoir compléter le profil.
 */
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple n'a pas renvoyé de jeton d'identité.");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;

    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ')
          .trim()
      : '';

    return { data, appleFullName: fullName };
  } catch (err: any) {
    // expo-apple-authentication lève ERR_REQUEST_CANCELED si l'utilisateur annule
    if (err?.code === 'ERR_REQUEST_CANCELED') {
      throw new UserCancelledError();
    }
    throw err;
  }
}
