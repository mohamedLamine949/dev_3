import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase, User } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_STORAGE_KEY = 'chapchap_session';
const isNative = typeof document === 'undefined';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithEmail: (email: string, password: string, prenom: string, nom: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Sur natif : on restaure la session depuis AsyncStorage SANS bloquer Supabase.
    // Le client Supabase est en persistSession:false → les requêtes partent immédiatement.
    const init = async () => {
      if (isNative) {
        try {
          const saved = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
          if (saved && mounted) {
            const parsed = JSON.parse(saved);
            const { error } = await supabase.auth.setSession(parsed);
            if (error) await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
            // onAuthStateChange se charge de setIsLoading(false)
            return;
          }
        } catch {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
      // Pas de session sauvegardée (ou web)
      if (mounted) setIsLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        await fetchOrCreateProfile(session.user);
        // Sauvegarder la session sur natif
        if (isNative) {
          AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }));
        }
      } else {
        setUser(null);
        if (isNative) AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      }
      if (mounted) setIsLoading(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function fetchOrCreateProfile(authUser: any) {
    const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (data) {
      setUser(data as User);
      return;
    }
    // Nouveau user OAuth — créer le profil automatiquement
    const meta = authUser.user_metadata || {};
    const { data: newUser } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        prenom: meta.given_name || meta.full_name?.split(' ')[0] || '',
        nom: meta.family_name || meta.full_name?.split(' ').slice(1).join(' ') || '',
        avatar_url: meta.avatar_url || null,
      })
      .select()
      .single();
    if (newUser) setUser(newUser as User);
  }

  async function signInWithEmail(email: string, password: string) {
    const timeout = new Promise<{ error: any }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'Délai dépassé. Vérifiez votre connexion.' } }), 12000)
    );
    const request = supabase.auth.signInWithPassword({ email, password });
    const { error } = await Promise.race([request, timeout]);
    return { error };
  }

  async function signUpWithEmail(email: string, password: string, prenom: string, nom: string) {
    const timeout = new Promise<{ data: any; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'Délai dépassé. Vérifiez votre connexion.' } }), 12000)
    );
    const request = supabase.auth.signUp({ email, password });
    const { data, error } = await Promise.race([request, timeout]);
    if (error) return { error };
    if (data?.user) {
      await supabase.from('users').insert({ id: data.user.id, prenom, nom });
    }
    return { error: null };
  }

  async function signInWithGoogle() {
    try {
      const redirectUrl = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) return { error };
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success') {
          const url = new URL(result.url);
          const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
          const refreshToken = url.hash.match(/refresh_token=([^&]+)/)?.[1];
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }

  async function signInWithApple() {
    if (Platform.OS !== 'ios') return { error: { message: 'Apple Sign In est disponible sur iOS uniquement' } };
    try {
      const AppleAuth = require('expo-apple-authentication');
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }

  async function refreshUser() {
    if (session?.user) await fetchOrCreateProfile(session.user);
  }

  return (
    <AuthContext.Provider value={{
      session, user, isLoading,
      signInWithEmail, signUpWithEmail,
      signInWithGoogle, signInWithApple,
      signOut, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
