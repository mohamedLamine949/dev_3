-- Migration : Système de Signalements & Modération Admin
-- À exécuter dans la console SQL de votre dashboard Supabase.

BEGIN;

-- 1. Ajouter le champ statut sur les utilisateurs
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'actif';

-- Index de performance sur le statut
CREATE INDEX IF NOT EXISTS idx_users_statut ON public.users(statut);

-- 2. Créer la table des signalements
CREATE TABLE IF NOT EXISTS public.signalements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signataire_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  annonce_id UUID REFERENCES public.annonces(id) ON DELETE CASCADE,
  cible_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  motif TEXT NOT NULL,
  details TEXT,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour accélérer les jointures et requêtes admin
CREATE INDEX IF NOT EXISTS idx_signalements_annonce ON public.signalements(annonce_id);
CREATE INDEX IF NOT EXISTS idx_signalements_cible ON public.signalements(cible_user_id);
CREATE INDEX IF NOT EXISTS idx_signalements_date ON public.signalements(date_creation DESC);

-- Activer RLS pour la sécurité
ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

-- 3. Politiques RLS pour 'signalements'
DROP POLICY IF EXISTS "Users can create reports" ON public.signalements;
CREATE POLICY "Users can create reports" ON public.signalements
  FOR INSERT WITH CHECK (auth.uid() = signataire_id);

DROP POLICY IF EXISTS "Admins can read all reports" ON public.signalements;
CREATE POLICY "Admins can read all reports" ON public.signalements
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all reports" ON public.signalements;
CREATE POLICY "Admins can update all reports" ON public.signalements
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all reports" ON public.signalements;
CREATE POLICY "Admins can delete all reports" ON public.signalements
  FOR DELETE USING (public.is_admin());

-- 4. Politiques RLS additionnelles pour les Admins sur 'users' et 'annonces'
-- UPDATE
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
CREATE POLICY "Admins can update all profiles" ON public.users
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all ads" ON public.annonces;
CREATE POLICY "Admins can update all ads" ON public.annonces
  FOR UPDATE USING (public.is_admin());

-- DELETE
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.users;
CREATE POLICY "Admins can delete all profiles" ON public.users
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all ads" ON public.annonces;
CREATE POLICY "Admins can delete all ads" ON public.annonces
  FOR DELETE USING (public.is_admin());

COMMIT;
