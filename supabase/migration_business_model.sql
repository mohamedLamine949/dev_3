-- =====================================================================
-- MIGRATION BUSINESS MODEL - FLASH MARKET (CHAP CHAP)
-- =====================================================================

-- 1. Ajout de la colonne date_abonnement sur public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_abonnement TIMESTAMPTZ DEFAULT NOW();

-- 2. Assurer les valeurs de type_compte ('particulier', 'vendeur', 'professionnel')
-- Défaut: 'particulier'
ALTER TABLE public.users ALTER COLUMN type_compte SET DEFAULT 'particulier';

-- 3. Migration des anciens profils PRO éventuels
UPDATE public.users SET date_abonnement = NOW() WHERE type_compte = 'professionnel' AND date_abonnement IS NULL;

-- 4. Index sur type_compte et est_payee pour des recherches et tris ultra-rapides
CREATE INDEX IF NOT EXISTS idx_users_type_compte ON public.users(type_compte);
CREATE INDEX IF NOT EXISTS idx_annonces_user_date ON public.annonces(user_id, date_creation DESC);
