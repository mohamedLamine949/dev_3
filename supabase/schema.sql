-- 1. Table Utilisateurs
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_telephone TEXT UNIQUE NOT NULL,
  prenom TEXT,
  nom TEXT,
  avatar_url TEXT,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table Annonces
CREATE TABLE annonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  prix INTEGER NOT NULL,
  categorie TEXT NOT NULL,
  etat_article TEXT NOT NULL,
  statut TEXT DEFAULT 'en_attente', -- en_attente, active, vendu, expire
  est_payee BOOLEAN DEFAULT FALSE,
  id_transaction_paiement TEXT,
  ville TEXT DEFAULT 'Bamako',
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table Images d'annonces
CREATE TABLE images_annonce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id UUID REFERENCES annonces(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  ordre INTEGER DEFAULT 0
);

-- 4. Table Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acheteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vendeur_id UUID REFERENCES users(id) ON DELETE CASCADE,
  annonce_id UUID REFERENCES annonces(id) ON DELETE CASCADE,
  dernier_message TEXT,
  date_dernier_message TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(acheteur_id, vendeur_id, annonce_id)
);

-- 5. Table Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  expediteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contenu TEXT NOT NULL,
  date_envoi TIMESTAMPTZ DEFAULT NOW(),
  lu BOOLEAN DEFAULT FALSE
);

-- INDEXES POUR LES PERFORMANCES (Point crucial pour une DB rapide)
CREATE INDEX idx_annonces_categorie ON annonces(categorie);
CREATE INDEX idx_annonces_statut ON annonces(statut);
CREATE INDEX idx_annonces_date ON annonces(date_creation DESC);
CREATE INDEX idx_annonces_est_payee ON annonces(est_payee);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_conversations_user ON conversations(acheteur_id, vendeur_id);

-- POLICIES (Row Level Security - Optionnel mais recommandé)
-- ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;
-- Vous pouvez définir les RLS via le dashboard Supabase.
-- Exemple : `CREATE POLICY "Public Annonces are viewable by everyone" ON annonces FOR SELECT USING (statut = 'active' AND est_payee = true);`
