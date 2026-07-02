-- =====================================================================
-- SUPPRESSION DE COMPTE (App Store Guideline 5.1.1(v))
-- À exécuter dans le SQL Editor Supabase (projet prod kmydbkaytrxtcequngnn).
-- Idempotent : ré-exécutable sans risque.
--
-- Fonction RPC appelée par l'app : supabase.rpc('delete_own_account')
-- SECURITY DEFINER car elle doit supprimer la ligne auth.users (impossible
-- côté client) et purger storage.objects. L'utilisateur ne peut supprimer
-- QUE son propre compte (auth.uid()).
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

  -- 1. Fichiers Storage : avatars/bannières (dossier = uid)
  --    et photos des annonces de l'utilisateur (dossier = annonce_id)
  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = uid::text;

  DELETE FROM storage.objects
  WHERE bucket_id = 'annonces-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.annonces WHERE user_id = uid
    );

  -- 2. Données applicatives. La plupart cascadent depuis public.users,
  --    mais on supprime explicitement pour ne pas dépendre des FK
  --    (ex. avis créée via le dashboard).
  DELETE FROM public.avis WHERE auteur_id = uid OR vendeur_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.favoris WHERE user_id = uid;
  DELETE FROM public.messages WHERE expediteur_id = uid;
  DELETE FROM public.conversations WHERE acheteur_id = uid OR vendeur_id = uid;
  DELETE FROM public.annonces WHERE user_id = uid;
  DELETE FROM public.users WHERE id = uid;

  -- 3. Compte d'authentification (cascade vers identities, sessions,
  --    refresh_tokens, admin_users).
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Seuls les utilisateurs connectés peuvent appeler la fonction.
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
