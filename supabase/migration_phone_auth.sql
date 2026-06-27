-- =====================================================================
-- Migration : Authentification téléphone simplifiée (sans fournisseur SMS)
-- ---------------------------------------------------------------------
-- Stratégie : on n'utilise PLUS l'OTP WhatsApp ni le provider téléphone
-- de Supabase. Chaque compte est créé avec un e-mail TECHNIQUE dérivé du
-- numéro (ex: 70000000@phone.chapchap.app). Le vrai numéro vit dans
-- public.users.num_telephone. L'utilisateur peut ajouter un vrai e-mail
-- plus tard pour la récupération du mot de passe.
--
-- PRÉREQUIS DASHBOARD SUPABASE (à faire manuellement) :
--   1. Auth > Providers > Email : activé, "Confirm email" DÉSACTIVÉ
--   2. Auth > "Secure email change" DÉSACTIVÉ
--   3. Auth > URL Configuration > Redirect URLs :
--        flashmarket://reset-password
--        flashmarket://auth-callback
--   4. Auth > SMTP : configurer un expéditeur (Resend / Brevo ...)
-- =====================================================================
BEGIN;

-- 1. Nettoyage de l'ancien système OTP WhatsApp / D7 -------------------
DROP FUNCTION IF EXISTS public.generate_and_send_otp(text);
DROP FUNCTION IF EXISTS public.verify_whatsapp_otp(text, text);
DROP TABLE IF EXISTS public.otp_verifications;
-- system_config n'est plus utilisée par l'app ; on la garde par prudence
-- (décommentez la ligne suivante pour la supprimer définitivement) :
-- DROP TABLE IF EXISTS public.system_config;

-- 2. Trigger de création de profil ------------------------------------
-- Gère les comptes créés via e-mail technique (num dans les métadonnées)
-- ET les éventuels anciens comptes créés via le provider téléphone natif.
-- On ne stocke jamais l'e-mail technique dans public.users.email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, num_telephone, email, prenom, nom)
  VALUES (
    new.id,
    COALESCE(new.phone, new.raw_user_meta_data->>'phone'),
    CASE
      WHEN new.email LIKE '%@phone.chapchap.app' OR new.email LIKE '%@phone.market' THEN NULL
      ELSE new.email
    END,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. RPC : résout l'e-mail de connexion à partir d'un numéro ----------
-- Renvoie l'e-mail d'auth courant (technique ou réel) pour permettre la
-- connexion par numéro de téléphone. SECURITY DEFINER car lit auth.users.
CREATE OR REPLACE FUNCTION public.get_login_email(p_phone text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT au.email
  FROM public.users pu
  JOIN auth.users au ON au.id = pu.id
  WHERE pu.num_telephone = p_phone
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;

-- 4. RPC : synchronise l'e-mail réel dans public.users ---------------
-- Appelée après updateUser({email}) pour refléter l'e-mail de secours
-- dans le profil public (affichage). Mise à jour limitée à soi-même.
CREATE OR REPLACE FUNCTION public.set_recovery_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email = p_email
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_recovery_email(text) TO authenticated;

COMMIT;
