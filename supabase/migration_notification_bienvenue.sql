-- Migration : notification de bienvenue à la création d'un compte
-- Se déclenche une seule fois, quand une ligne est créée dans public.users
-- (soit par le trigger on_auth_user_created, soit par l'upsert de l'app à l'inscription).
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  VALUES (
    NEW.id,
    'Bienvenue sur Flash Market 👋',
    'Votre compte est prêt ! Publiez votre première annonce et commencez à vendre en toute confiance.',
    'bienvenue',
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_user_welcome_notification ON public.users;
CREATE TRIGGER on_new_user_welcome_notification
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_welcome_notification();

COMMIT;
