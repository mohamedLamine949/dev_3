-- Migration : sécurisation de la console admin (RLS + is_admin)
-- Remplace le contrôle "email contient admin" (côté JS, contournable) par un
-- vrai contrôle EN BASE : seul un utilisateur listé dans admin_users peut lire
-- l'ensemble des users / annonces.
BEGIN;

-- 1. Table des administrateurs (par auth uid)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verrouillage total : personne ne lit/écrit cette table via l'API publique.
-- Seules les fonctions SECURITY DEFINER et la service-role y accèdent.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 2. Fonction helper : l'utilisateur courant est-il admin ?
--    SECURITY DEFINER => contourne la RLS de admin_users pour la vérification.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

-- 3. Politiques RLS additives : lecture GLOBALE réservée aux admins.
--    (Les policies RLS se combinent en OR : les policies utilisateur existantes
--     restent intactes, les admins gagnent juste un accès lecture complet.)
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all annonces" ON public.annonces;
CREATE POLICY "Admins can read all annonces" ON public.annonces
  FOR SELECT USING (public.is_admin());

COMMIT;

-- =====================================================================
-- POUR DÉSIGNER UN ADMIN (à exécuter manuellement après avoir créé le
-- compte admin dans Authentication > Users) :
--
--   INSERT INTO public.admin_users (user_id)
--   SELECT id FROM auth.users WHERE email = 'admin@flashmarket.app';
--
-- Pour retirer un admin :
--   DELETE FROM public.admin_users
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@flashmarket.app');
-- =====================================================================
