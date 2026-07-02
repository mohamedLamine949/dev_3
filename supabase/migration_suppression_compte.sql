-- =====================================================================
-- SUPPRESSION DE COMPTE (App Store Guideline 5.1.1(v))
-- À exécuter dans le SQL Editor Supabase (projet prod kmydbkaytrxtcequngnn).
-- Idempotent : ré-exécutable sans risque.
--
-- Fonction RPC appelée par l'app : supabase.rpc('delete_own_account')
-- SECURITY DEFINER car elle doit supprimer la ligne auth.users (impossible
-- côté client). L'utilisateur ne peut supprimer QUE son propre compte
-- (auth.uid()).
--
-- NOTE : les fichiers Storage (avatars, photos d'annonces) ne peuvent pas
-- être supprimés ici — Supabase interdit le DELETE direct sur
-- storage.objects ("Use the Storage API instead"). C'est l'app qui purge
-- les fichiers via l'API Storage AVANT d'appeler cette fonction, d'où la
-- policy DELETE sur le bucket avatars ci-dessous.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- 1. Données applicatives. La plupart cascadent depuis public.users,
  --    mais on supprime explicitement pour ne pas dépendre des FK
  --    (ex. avis créée via le dashboard).
  DELETE FROM public.avis WHERE auteur_id = uid OR vendeur_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.favoris WHERE user_id = uid;
  DELETE FROM public.messages WHERE expediteur_id = uid;
  DELETE FROM public.conversations WHERE acheteur_id = uid OR vendeur_id = uid;
  DELETE FROM public.annonces WHERE user_id = uid;
  DELETE FROM public.users WHERE id = uid;

  -- 2. Compte d'authentification (cascade vers identities, sessions,
  --    refresh_tokens, admin_users).
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Seuls les utilisateurs connectés peuvent appeler la fonction.
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- Policy manquante : permettre à l'utilisateur de supprimer les fichiers
-- de SON dossier avatars (avatar, bannière, photos business) via l'API
-- Storage. Le bucket annonces-images a déjà une policy DELETE.
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
