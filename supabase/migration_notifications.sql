-- Script de migration pour le système de notifications
BEGIN;

-- 1. Table Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  type TEXT NOT NULL, -- 'chat', 'annonce_validee', 'paiement_requis', 'annonce_vendue', 'favori', 'compte_pro_active'
  donnees JSONB DEFAULT '{}'::jsonb,
  lu BOOLEAN DEFAULT FALSE,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour des requêtes performantes
CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON public.notifications(user_id, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_lu ON public.notifications(user_id, lu) WHERE lu = FALSE;

-- Activation de la sécurité RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications 
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. Fonction d'envoi de push via l'API Expo (pg_net)
CREATE OR REPLACE FUNCTION public.send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_push_token TEXT;
  payload JSONB;
  has_net_extension BOOLEAN;
BEGIN
  -- Récupérer le token de push du destinataire
  SELECT push_token INTO recipient_push_token
  FROM public.users
  WHERE id = NEW.user_id;

  -- Envoyer uniquement si le token est valide pour Expo
  IF recipient_push_token IS NOT NULL AND recipient_push_token != '' AND recipient_push_token LIKE 'ExponentPushToken[%]' THEN
    payload := jsonb_build_object(
      'to', recipient_push_token,
      'sound', 'default',
      'title', NEW.titre,
      'body', CASE 
        WHEN NEW.type = 'chat' THEN NEW.contenu -- Pour le chat, on affiche le message directement
        ELSE NEW.contenu
      END,
      'data', COALESCE(NEW.donnees, '{}'::jsonb)
    );

    -- Vérifier si l'extension pg_net est installée dans le schéma 'net'
    SELECT EXISTS (
      SELECT 1 FROM pg_namespace WHERE nspname = 'net'
    ) INTO has_net_extension;

    IF has_net_extension THEN
      BEGIN
        -- Requête HTTP POST asynchrone
        PERFORM net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := payload::text,
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        -- Intercepter les erreurs pour ne pas bloquer les transactions SQL principales
        RAISE WARNING 'Échec de l''envoi du push via pg_net: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_notification ON public.notifications;
CREATE TRIGGER on_new_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_notification();

-- 3. Trigger sur Nouveau Message
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
  annonce_titre TEXT;
  conv_record RECORD;
BEGIN
  -- Récupérer les informations de la conversation
  SELECT acheteur_id, vendeur_id, annonce_id INTO conv_record
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF conv_record IS NOT NULL THEN
    -- Déterminer le destinataire
    IF NEW.expediteur_id = conv_record.acheteur_id THEN
      recipient_id := conv_record.vendeur_id;
    ELSE
      recipient_id := conv_record.acheteur_id;
    END IF;

    -- Nom de l'expéditeur
    SELECT COALESCE(NULLIF(TRIM(prenom || ' ' || nom), ''), 'Quelqu''un') INTO sender_name
    FROM public.users
    WHERE id = NEW.expediteur_id;

    -- Titre de l'annonce
    SELECT titre INTO annonce_titre
    FROM public.annonces
    WHERE id = conv_record.annonce_id;

    -- Insérer la notification in-app
    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (
      recipient_id,
      sender_name,
      NEW.contenu,
      'chat',
      jsonb_build_object(
        'conversationId', NEW.conversation_id,
        'titreAnnonce', COALESCE(annonce_titre, 'Annonce')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
CREATE TRIGGER on_new_message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message_notification();

-- 4. Trigger sur Annonces (Création / Validation Paiement / Vente)
CREATE OR REPLACE FUNCTION public.handle_annonce_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Cas 1 : Insertion d'une nouvelle annonce
  IF (TG_OP = 'INSERT') THEN
    IF NEW.est_payee = TRUE OR NEW.statut = 'active' THEN
      INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
      VALUES (
        NEW.user_id,
        'Annonce en ligne 🚀',
        'Votre annonce "' || NEW.titre || '" est publiée avec succès.',
        'annonce_validee',
        jsonb_build_object('annonceId', NEW.id)
      );
    ELSE
      INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
      VALUES (
        NEW.user_id,
        'Paiement requis 💳',
        'Votre annonce "' || NEW.titre || '" a été enregistrée. Payez les frais de mise en ligne pour la publier.',
        'paiement_requis',
        jsonb_build_object('annonceId', NEW.id)
      );
    END IF;

  -- Cas 2 : Modification d'une annonce
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Si le paiement passe de non-payé à payé
    IF OLD.est_payee = FALSE AND NEW.est_payee = TRUE THEN
      INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
      VALUES (
        NEW.user_id,
        'Paiement validé ✅',
        'Votre paiement a été validé ! Votre annonce "' || NEW.titre || '" est désormais en ligne.',
        'annonce_validee',
        jsonb_build_object('annonceId', NEW.id)
      );
    -- Si le statut devient actif (approuvé par admin) séparément de la validation du paiement
    ELSIF OLD.statut != 'active' AND NEW.statut = 'active' AND NOT (OLD.est_payee = FALSE AND NEW.est_payee = TRUE) THEN
      INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
      VALUES (
        NEW.user_id,
        'Annonce validée 🎉',
        'Votre annonce "' || NEW.titre || '" est active et visible par tous.',
        'annonce_validee',
        jsonb_build_object('annonceId', NEW.id)
      );
    -- Si le statut devient vendu
    ELSIF OLD.statut != 'vendu' AND NEW.statut = 'vendu' THEN
      INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
      VALUES (
        NEW.user_id,
        'Félicitations 🌟',
        'Votre annonce "' || NEW.titre || '" est marquée comme vendue. Merci d''avoir choisi Chap Chap !',
        'annonce_vendue',
        jsonb_build_object('annonceId', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_annonce_notification ON public.annonces;
CREATE TRIGGER on_annonce_notification
  AFTER INSERT OR UPDATE ON public.annonces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_annonce_notification();

-- 5. Trigger sur Ajout Favoris
CREATE OR REPLACE FUNCTION public.handle_favori_notification()
RETURNS TRIGGER AS $$
DECLARE
  annonce_titre TEXT;
  annonce_owner_id UUID;
  favorited_by_name TEXT;
BEGIN
  -- Récupérer le titre et le propriétaire de l'annonce
  SELECT titre, user_id INTO annonce_titre, annonce_owner_id
  FROM public.annonces
  WHERE id = NEW.annonce_id;

  -- Pas de notification si le propriétaire ajoute sa propre annonce aux favoris
  IF annonce_owner_id IS NOT NULL AND NEW.user_id != annonce_owner_id THEN
    -- Récupérer le nom de la personne qui a favorisé
    SELECT COALESCE(NULLIF(TRIM(prenom || ' ' || nom), ''), 'Un utilisateur') INTO favorited_by_name
    FROM public.users
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (
      annonce_owner_id,
      'Nouveau favori ⭐',
      favorited_by_name || ' a ajouté votre annonce "' || COALESCE(annonce_titre, '') || '" à ses favoris.',
      'favori',
      jsonb_build_object('annonceId', NEW.annonce_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_favori_notification ON public.favoris;
CREATE TRIGGER on_favori_notification
  AFTER INSERT ON public.favoris
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_favori_notification();

-- 6. Trigger sur Compte Professionnel
CREATE OR REPLACE FUNCTION public.handle_user_compte_pro_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le type de compte passe de particulier à professionnel
  IF OLD.type_compte = 'particulier' AND NEW.type_compte = 'professionnel' THEN
    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (
      NEW.id,
      'Compte Pro Activé 💼',
      'Félicitations ! Votre vitrine professionnelle est prête. Personnalisez votre profil dès maintenant.',
      'compte_pro_active',
      jsonb_build_object('userId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_compte_pro_notification ON public.users;
CREATE TRIGGER on_user_compte_pro_notification
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_compte_pro_notification();

COMMIT;
