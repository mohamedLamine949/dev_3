-- =====================================================================
-- Migration : authentification sociale (Google + Apple)
-- ---------------------------------------------------------------------
-- On remplace l'auth téléphone+mot de passe par Sign in with Google et
-- Sign in with Apple (jetons natifs échangés via supabase.auth
-- .signInWithIdToken). Le numéro de téléphone n'est plus l'identifiant :
-- il devient un simple champ de contact collecté à la complétion de profil
-- (public.users.telephone).
--
-- PRÉREQUIS DASHBOARD SUPABASE (à faire manuellement) :
--   1. Auth > Providers > Google : activé
--        - Client ID (Web)  = le client OAuth « Web » de Google Cloud
--        - Client Secret    = son secret
--        - Authorized Client IDs : y ajouter les client IDs iOS ET Android
--          (sinon le login natif par idToken est refusé)
--   2. Auth > Providers > Apple : activé
--        - Authorized Client IDs / Services IDs : ajouter le bundle
--          « com.chapchap.flashmarket »
--   3. (facultatif) Email provider peut rester activé pour les anciens
--      comptes, mais l'app ne l'utilise plus.
-- =====================================================================
BEGIN;

-- Trigger de création de profil : gère désormais les comptes OAuth.
-- Google fournit full_name / name / given_name / family_name / avatar_url
-- / picture / email (tous vérifiés). Apple ne fournit le nom qu'à la
-- première connexion (capté côté app et enregistré via CompleteProfile).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta JSONB := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  full_name TEXT := COALESCE(meta->>'full_name', meta->>'name', '');
BEGIN
  INSERT INTO public.users (id, num_telephone, email, prenom, nom, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.phone, meta->>'phone'),
    CASE
      WHEN new.email LIKE '%@phone.chapchap.app' OR new.email LIKE '%@phone.market' THEN NULL
      ELSE new.email
    END,
    -- prénom : métadonnées explicites, sinon given_name, sinon 1er mot du nom complet
    COALESCE(
      NULLIF(meta->>'first_name', ''),
      NULLIF(meta->>'given_name', ''),
      NULLIF(split_part(full_name, ' ', 1), ''),
      ''
    ),
    -- nom : métadonnées explicites, sinon family_name, sinon reste du nom complet
    COALESCE(
      NULLIF(meta->>'last_name', ''),
      NULLIF(meta->>'family_name', ''),
      NULLIF(NULLIF(TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name))), ''), ''),
      ''
    ),
    -- avatar : photo Google/Apple si présente
    COALESCE(NULLIF(meta->>'avatar_url', ''), NULLIF(meta->>'picture', ''))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;
