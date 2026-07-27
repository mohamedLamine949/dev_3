import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, User } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Alert } from 'react-native';

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
        if (data.statut === 'suspendu') {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          Alert.alert(
            "Compte suspendu",
            "Votre compte a été suspendu par un administrateur pour non-respect des règles de la communauté."
          );
        } else {
          setUser(data as User);
          // Trace la dernière ouverture de l'app (cible les relances push
          // des inactifs — voir migration_notifications_v2.sql). Silencieux :
          // la colonne peut ne pas exister tant que la migration n'est pas passée.
          supabase
            .from('users')
            .update({ derniere_connexion: new Date().toISOString() })
            .eq('id', userId)
            .then(() => {});
        }
      } else {
        if (error && error.code === 'PGRST116') {
          // Le profil n'existe pas encore, on l'initialise à la volée avec les métadonnées de la session active
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user) {
            const userMetadata = currentSession.user.user_metadata || {};
            let numPhone = currentSession.user.email?.endsWith('@phone.market')
              ? currentSession.user.email.split('@')[0]
              : userMetadata.phone || null;
            
            if (numPhone && !numPhone.startsWith('+')) {
              numPhone = '+' + numPhone;
            }

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
