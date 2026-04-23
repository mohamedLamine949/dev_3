import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jmoudxygkbmxnsquevps.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptb3VkeHlna2JteG5zcXVldnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzE4NjUsImV4cCI6MjA5MjM0Nzg2NX0.5FzzePiknM9GGH6KxtcCUHM1kD99FNcKM0BcD7NL5N4';

// Détection web vs natif — sur web on n'utilise PAS AsyncStorage (bloque les requêtes)
const isWeb = typeof document !== 'undefined';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: isWeb
    ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    : { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

/**
 * Types pour la base de données Supabase
 */
export interface User {
  id: string;
  prenom: string;
  nom: string;
  bio?: string;
  avatar_url?: string;
  telephone?: string;
  whatsapp?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  date_creation?: string;
}

export interface Annonce {
  id: string;
  user_id: string;
  titre: string;
  description: string;
  prix: number;
  categorie: string;
  etat_article: string;
  statut: 'en_attente' | 'active' | 'vendu' | 'expire';
  est_payee: boolean;
  id_transaction_paiement?: string;
  ville: string;
  quartier?: string;
  latitude?: number;
  longitude?: number;
  date_creation: string;
  // Joined
  images?: ImageAnnonce[];
  user?: User;
}

export interface ImageAnnonce {
  id: string;
  annonce_id: string;
  image_url: string;
  ordre: number;
}

export interface Conversation {
  id: string;
  acheteur_id: string;
  vendeur_id: string;
  annonce_id: string;
  dernier_message?: string;
  date_dernier_message: string;
  // Joined
  annonce?: Annonce;
  acheteur?: User;
  vendeur?: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  expediteur_id: string;
  contenu: string;
  date_envoi: string;
  lu: boolean;
}
