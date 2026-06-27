import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { navigationRef } from '../navigation/AppNavigator';

/**
 * Intercepte les liens profonds (deep links) ouverts par les e-mails Supabase :
 *  - flashmarket://reset-password  -> réinitialisation du mot de passe
 *  - flashmarket://auth-callback   -> confirmation de l'e-mail de secours
 *
 * Le client supabase est configuré avec detectSessionInUrl:false : on établit
 * donc la session manuellement à partir des jetons présents dans l'URL.
 */
function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  let frag = '';
  if (hashIndex >= 0) frag = url.substring(hashIndex + 1);
  else if (queryIndex >= 0) frag = url.substring(queryIndex + 1);
  if (!frag) return out;
  frag.split('&').forEach((pair) => {
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
  });
  return out;
}

async function handleUrl(url: string | null) {
  if (!url || (!url.includes('reset-password') && !url.includes('auth-callback'))) return;

  const isRecovery = url.includes('reset-password');
  const params = parseParams(url);

  try {
    if (params.access_token && params.refresh_token) {
      // Flux implicite : jetons directement dans l'URL
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (error) throw error;
    } else if (params.code) {
      // Flux PKCE : échange du code contre une session
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) throw error;
    } else {
      return;
    }

    if (isRecovery && navigationRef.isReady()) {
      navigationRef.navigate('ResetPassword' as never);
    }
  } catch (e: any) {
    console.warn('[DeepLink] auth link error:', e?.message || e);
  }
}

export default function DeepLinkHandler() {
  const handled = useRef<string | null>(null);

  useEffect(() => {
    // Lien ayant lancé l'application à froid
    Linking.getInitialURL().then((url) => {
      if (url && url !== handled.current) {
        handled.current = url;
        handleUrl(url);
      }
    });

    // Liens reçus pendant que l'application est ouverte
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url !== handled.current) {
        handled.current = url;
        handleUrl(url);
      }
    });

    return () => sub.remove();
  }, []);

  return null;
}
