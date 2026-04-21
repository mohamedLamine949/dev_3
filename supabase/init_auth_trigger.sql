-- Ce script permet de synchroniser automatiquement les utilisateurs créés lors de l'authentification OTP
-- avec la table "users" publique (qui stocke les profils et est liée aux annonces).

-- 1. Créer la fonction qui copie l'utilisateur automatiquement
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, num_telephone)
  VALUES (NEW.id, NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attacher la fonction au système d'authentification Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Récupérer l'utilisateur de test que vous avez DÉJÀ créé et le mettre dans la table users
INSERT INTO public.users (id, num_telephone)
SELECT id, phone FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;
