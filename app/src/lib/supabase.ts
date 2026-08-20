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
  type_compte?: 'particulier' | 'vendeur' | 'professionnel';
  date_abonnement?: string;
  device_id?: string | null;
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
  // Découverte Pro (migration_decouverte_pro.sql)
  categorie_metier?: string | null;
  // Statut boutique (migration_ouvert_et_follow.sql)
  ouvert_maintenant?: boolean;
  // Activite du professionnel (migration_p2_services.sql) — axe independant
  // du plan paye et du type de compte : configure formulaires et vitrine.
  type_activite?: 'produits' | 'services' | 'mixte';
  zone_intervention?: string | null;
  accepte_deplacement?: boolean;
  delai_reponse?: string | null;
  // Vitrine services v2 (migration_p4_vitrine_services.sql)
  disponibilite?: 'aujourdhui' | 'semaine' | 'rdv' | 'indisponible';
  // Etat de CONTROLE, sans rapport avec l'abonnement : seul 'verified'
  // affiche le badge Verifie.
  verification_status?: 'unverified' | 'phone_verified' | 'document_pending'
                      | 'verified' | 'rejected' | 'suspended';
  date_verification?: string | null;
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
  // Phase 1 : distingue une annonce de particulier d'un produit ou d'une
  // prestation de boutique (migration_p1_entitlements.sql).
  listing_kind?: 'private_ad' | 'seller_ad' | 'pro_product' | 'pro_service' | null;
  // Phase 2 : un prestataire ne peut pas toujours annoncer un prix ferme.
  mode_tarif?: 'fixe' | 'a_partir_de' | 'sur_devis';
  duree_indicative?: string | null;
  condition_deplacement?: string | null;
  moderation_status?: 'pending' | 'approved' | 'limited' | 'rejected' | 'under_review';
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

// Deux circuits partagent la table `commandes` (§8.6) :
//   produits : nouvelle -> confirmee -> livree
//   services : nouvelle -> precisions -> devis_envoye -> accepte -> en_cours -> termine
// Les deux peuvent finir en refusee ou annulee.
export type CommandeStatut =
  | 'nouvelle' | 'confirmee' | 'livree' | 'refusee' | 'annulee'
  | 'precisions' | 'devis_envoye' | 'accepte' | 'en_cours' | 'termine';

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
  // Demande de devis (migration_p2_services.sql)
  type_demande?: 'commande' | 'devis';
  montant_devis?: number | null;
  date_souhaitee?: string | null;
  // Demande de devis guidee (migration_p4)
  photo_url?: string | null;
  audio_url?: string | null;
  zone_demandee?: string | null;
  telephone_client?: string | null;
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
