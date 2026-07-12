import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
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
  num_telephone?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  type_compte?: 'particulier' | 'professionnel';
  statut?: 'actif' | 'suspendu';
  banniere_url?: string;
  images_business?: string[];
  date_creation?: string;
  // Boutique PRO (migration_boutiques.sql)
  nom_boutique?: string | null;
  boutique_slug?: string | null;
  quartier_boutique?: string | null;
  adresse_boutique?: string | null;
  horaires?: string | null;
  livraison?: 'disponible' | 'a_discuter' | 'retrait' | null;
  frais_livraison?: string | null;
}

export interface Annonce {
  id: string;
  user_id: string;
  titre: string;
  description: string;
  prix: number;
  categorie: string;
  sous_categorie?: string | null;
  etat_article: string;
  statut: 'en_attente' | 'active' | 'vendu' | 'expire';
  est_payee: boolean;
  id_transaction_paiement?: string;
  montant_depot?: number;
  ville: string;
  quartier?: string;
  latitude?: number;
  longitude?: number;
  date_creation: string;
  nombre_vues?: number;
  // Boutique PRO (migration_boutiques.sql) : stock NULL = non géré
  stock?: number | null;
  visible?: boolean;
  catalogue_id?: string | null;
  // Joined
  images?: ImageAnnonce[];
  user?: User;
}

// Boutique PRO v2 (migration_boutiques_v2.sql)
export interface Catalogue {
  id: string;
  user_id: string;
  nom: string;
  categorie: string;
  ordre: number;
  date_creation: string;
}

export type CommandeStatut = 'nouvelle' | 'confirmee' | 'livree' | 'refusee' | 'annulee';

export interface Commande {
  id: string;
  vendeur_id: string;
  client_id: string;
  produit_id?: string | null;
  catalogue_id?: string | null;
  produit_titre: string;
  prix: number;
  quantite: number;
  note_client?: string | null;
  statut: CommandeStatut;
  reponse_vendeur?: string | null;
  date_creation: string;
  date_maj: string;
  // Joined
  client?: User;
  vendeur?: User;
  produit?: Annonce;
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
