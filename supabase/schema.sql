-- 0. MIGRATION TEXT TO UUID
DO $$ 
BEGIN
    -- 1. Suppression de TOUTES les contraintes de clés étrangères dépendantes
    ALTER TABLE IF EXISTS public.annonces DROP CONSTRAINT IF EXISTS annonces_user_id_fkey;
    ALTER TABLE IF EXISTS public.conversations DROP CONSTRAINT IF EXISTS conversations_acheteur_id_fkey;
    ALTER TABLE IF EXISTS public.conversations DROP CONSTRAINT IF EXISTS conversations_vendeur_id_fkey;
    ALTER TABLE IF EXISTS public.conversations DROP CONSTRAINT IF EXISTS conversations_annonce_id_fkey;
    ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_expediteur_id_fkey;
    ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
    ALTER TABLE IF EXISTS public.images_annonce DROP CONSTRAINT IF EXISTS images_annonce_annonce_id_fkey;

    -- 2. Conversion des colonnes de public.users
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'text') THEN
        ALTER TABLE public.users ALTER COLUMN id TYPE UUID USING id::uuid;
    END IF;

    -- 3. Conversion des colonnes de public.annonces
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'annonces' AND column_name = 'user_id' AND data_type = 'text') THEN
        ALTER TABLE public.annonces ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
    END IF;

    -- 4. Conversion des colonnes de public.conversations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'acheteur_id' AND data_type = 'text') THEN
        ALTER TABLE public.conversations ALTER COLUMN acheteur_id TYPE UUID USING acheteur_id::uuid;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'vendeur_id' AND data_type = 'text') THEN
        ALTER TABLE public.conversations ALTER COLUMN vendeur_id TYPE UUID USING vendeur_id::uuid;
    END IF;

    -- 5. Conversion des colonnes de public.messages
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'expediteur_id' AND data_type = 'text') THEN
        ALTER TABLE public.messages ALTER COLUMN expediteur_id TYPE UUID USING expediteur_id::uuid;
    END IF;

    -- 6. Recréation des contraintes de clés étrangères
    -- (On les ajoute ici pour être sûr qu'elles sont recréées même si les tables existent déjà)
    ALTER TABLE IF EXISTS public.annonces 
        ADD CONSTRAINT annonces_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    
    ALTER TABLE IF EXISTS public.images_annonce 
        ADD CONSTRAINT images_annonce_annonce_id_fkey FOREIGN KEY (annonce_id) REFERENCES public.annonces(id) ON DELETE CASCADE;

    ALTER TABLE IF EXISTS public.conversations 
        ADD CONSTRAINT conversations_acheteur_id_fkey FOREIGN KEY (acheteur_id) REFERENCES public.users(id) ON DELETE CASCADE,
        ADD CONSTRAINT conversations_vendeur_id_fkey FOREIGN KEY (vendeur_id) REFERENCES public.users(id) ON DELETE CASCADE,
        ADD CONSTRAINT conversations_annonce_id_fkey FOREIGN KEY (annonce_id) REFERENCES public.annonces(id) ON DELETE CASCADE;

    ALTER TABLE IF EXISTS public.messages 
        ADD CONSTRAINT messages_expediteur_id_fkey FOREIGN KEY (expediteur_id) REFERENCES public.users(id) ON DELETE CASCADE,
        ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

END $$;

-- 1. Table Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  num_telephone TEXT UNIQUE,
  email TEXT UNIQUE,
  prenom TEXT,
  nom TEXT,
  bio TEXT,
  avatar_url TEXT,
  whatsapp TEXT,
  instagram TEXT,
  tiktok TEXT,
  facebook TEXT,
  push_token TEXT,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Assurer que la clé étrangère vers auth.users existe
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Table Annonces
CREATE TABLE IF NOT EXISTS annonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  prix INTEGER NOT NULL,
  categorie TEXT NOT NULL, -- telephonie_electronique, mode_beaute, maison_electromenager, voitures, motos, immobilier, nourriture, services
  etat_article TEXT NOT NULL,
  statut TEXT DEFAULT 'en_attente', -- en_attente, active, vendu, expire
  est_payee BOOLEAN DEFAULT FALSE,
  id_transaction_paiement TEXT,
  ville TEXT DEFAULT 'Bamako',
  quartier TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations pour la table annonces
ALTER TABLE annonces ADD COLUMN IF NOT EXISTS quartier TEXT;
ALTER TABLE annonces ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE annonces ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 3. Table Images d'annonces
CREATE TABLE IF NOT EXISTS images_annonce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id UUID REFERENCES annonces(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  ordre INTEGER DEFAULT 0
);

-- 4. Table Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acheteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vendeur_id UUID REFERENCES users(id) ON DELETE CASCADE,
  annonce_id UUID REFERENCES annonces(id) ON DELETE CASCADE,
  dernier_message TEXT,
  date_dernier_message TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(acheteur_id, vendeur_id, annonce_id)
);

-- 5. Table Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  expediteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contenu TEXT NOT NULL,
  date_envoi TIMESTAMPTZ DEFAULT NOW(),
  lu BOOLEAN DEFAULT FALSE
);

-- 6. Table Favoris
CREATE TABLE IF NOT EXISTS favoris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  annonce_id UUID REFERENCES annonces(id) ON DELETE CASCADE,
  date_ajout TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, annonce_id)
);

-- INDEXES POUR LES PERFORMANCES (Point crucial pour une DB rapide)
CREATE INDEX IF NOT EXISTS idx_annonces_categorie ON annonces(categorie);
CREATE INDEX IF NOT EXISTS idx_annonces_statut ON annonces(statut);
CREATE INDEX IF NOT EXISTS idx_annonces_date ON annonces(date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_annonces_est_payee ON annonces(est_payee);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(acheteur_id, vendeur_id);
CREATE INDEX IF NOT EXISTS idx_favoris_user ON favoris(user_id);
CREATE INDEX IF NOT EXISTS idx_favoris_annonce ON favoris(annonce_id);

-- POLICIES (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE images_annonce ENABLE ROW LEVEL SECURITY;

-- 1. Policies pour 'users'
DROP POLICY IF EXISTS "Profiles are public" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Profiles are public" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Policies pour 'annonces'
DROP POLICY IF EXISTS "Ads are public" ON annonces;
DROP POLICY IF EXISTS "Users can insert own ads" ON annonces;
DROP POLICY IF EXISTS "Users can update own ads" ON annonces;
DROP POLICY IF EXISTS "Users can delete own ads" ON annonces;
CREATE POLICY "Ads are public" ON annonces FOR SELECT USING (true);
CREATE POLICY "Users can insert own ads" ON annonces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ads" ON annonces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ads" ON annonces FOR DELETE USING (auth.uid() = user_id);

-- 3. Policies pour 'images_annonce'
DROP POLICY IF EXISTS "Ad images are public" ON images_annonce;
DROP POLICY IF EXISTS "Users can insert images for their ads" ON images_annonce;
DROP POLICY IF EXISTS "Users can delete images for their ads" ON images_annonce;
CREATE POLICY "Ad images are public" ON images_annonce FOR SELECT USING (true);
CREATE POLICY "Users can insert images for their ads" ON images_annonce FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM annonces
    WHERE id = annonce_id AND user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete images for their ads" ON images_annonce FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM annonces
    WHERE id = annonce_id AND user_id = auth.uid()
  )
);

-- 4. Policies pour 'conversations'
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Buyers can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversation" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT
  USING (auth.uid() = acheteur_id OR auth.uid() = vendeur_id);
CREATE POLICY "Buyers can create conversations" ON conversations FOR INSERT
  WITH CHECK (auth.uid() = acheteur_id);
CREATE POLICY "Participants can update conversation" ON conversations FOR UPDATE
  USING (auth.uid() = acheteur_id OR auth.uid() = vendeur_id);

-- 5. Policies pour 'messages'
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;
CREATE POLICY "Participants can view messages" ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (auth.uid() = acheteur_id OR auth.uid() = vendeur_id)
    )
  );
CREATE POLICY "Participants can send messages" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = expediteur_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (auth.uid() = acheteur_id OR auth.uid() = vendeur_id)
    )
  );
CREATE POLICY "Recipients can mark messages as read" ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (auth.uid() = acheteur_id OR auth.uid() = vendeur_id)
    )
  );

-- 6. Policies pour 'favoris'
ALTER TABLE favoris ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own favoris" ON favoris;
DROP POLICY IF EXISTS "Users can insert favoris" ON favoris;
DROP POLICY IF EXISTS "Users can delete favoris" ON favoris;
CREATE POLICY "Users can view own favoris" ON favoris FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert favoris" ON favoris FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete favoris" ON favoris FOR DELETE USING (auth.uid() = user_id);

-- TRIGGER: Auto-create public.users row on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, num_telephone, email, prenom, nom)
  VALUES (
    new.id, 
    new.phone,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. STORAGE CONFIGURATION
-- Note: Ces commandes peuvent nécessiter des privilèges élevés sur le dashboard Supabase
-- Bucket pour les avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket pour les images d'annonces
INSERT INTO storage.buckets (id, name, public) 
VALUES ('annonces-images', 'annonces-images', true)
ON CONFLICT (id) DO NOTHING;

-- POLITIQUES D'ACCÈS PUBLIC
CREATE POLICY "Avatar public access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Ads images public access" ON storage.objects FOR SELECT USING (bucket_id = 'annonces-images');

-- POLITIQUES D'UPLOAD POUR UTILISATEURS AUTHENTIFIÉS
-- Avatars : Un utilisateur ne peut modifier que son propre dossier (nommé par son ID)
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Annonces : Les utilisateurs authentifiés peuvent uploader des photos d'annonces
CREATE POLICY "Users can upload ad images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'annonces-images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own ad images" ON storage.objects FOR UPDATE USING (
  bucket_id = 'annonces-images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own ad images" ON storage.objects FOR DELETE USING (
  bucket_id = 'annonces-images' AND auth.role() = 'authenticated'
);
