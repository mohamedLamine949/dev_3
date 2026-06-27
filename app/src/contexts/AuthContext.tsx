import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, User } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null; // Profil depuis notre BD Supabase
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setUser(data as User);
      } else {
        if (error && error.code === 'PGRST116') {
          // Le profil n'existe pas encore, on l'initialise à la volée avec les métadonnées de la session active
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user) {
            const userMetadata = currentSession.user.user_metadata || {};
            const numPhone = currentSession.user.email?.endsWith('@phone.market')
              ? currentSession.user.email.split('@')[0]
              : userMetadata.phone || null;

            const newProfile = {
              id: userId,
              prenom: userMetadata.first_name || 'Utilisateur',
              nom: userMetadata.last_name || 'Market',
              num_telephone: numPhone,
              email: currentSession.user.email?.endsWith('@phone.market') ? null : currentSession.user.email,
            };

            const { data: upsertData, error: upsertError } = await supabase
              .from('users')
              .upsert(newProfile)
              .select()
              .single();

            if (upsertData) {
              setUser(upsertData as User);
              return;
            } else if (upsertError) {
              console.log("[Auth] Profil auto-creation error:", upsertError.message);
            }
          }
        }
        console.log("[Auth] Profile not found or query error:", error?.message);
      }
    } catch (e) {
      console.log("[Auth] Exception fetching profile:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }

  async function refreshUser() {
    if (session?.user) await fetchProfile(session.user.id);
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      isLoading,
      signOut,
      refreshUser,
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
