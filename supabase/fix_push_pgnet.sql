-- =========================================================================
-- FIX CRITIQUE : les push pg_net ne partaient JAMAIS (signature body)
-- À exécuter dans le SQL Editor. Idempotent.
-- =========================================================================
-- BUG : net.http_post attend body JSONB, mais send_push_notification
-- (migration_notifications.sql) et push_direct (v3) passaient body::TEXT.
-- Aucune fonction ne correspond à cette signature -> exception à chaque
-- appel, avalée par le bloc EXCEPTION (voulu pour ne jamais bloquer les
-- transactions) -> AUCUN push n'est jamais parti via pg_net, même après
-- l'activation de l'extension. Les messages de chat, commandes, parrainage,
-- digest… n'ont donc jamais déclenché de push.
--
-- DIAGNOSTIC (exécuter d'abord pour confirmer) :
--   SELECT COUNT(*) FROM net._http_response;
--   -- 0 ligne = aucun appel n'a jamais abouti -> le bug est confirmé.
-- =========================================================================

BEGIN;

-- 1. Réécriture de send_push_notification avec body JSONB
CREATE OR REPLACE FUNCTION public.send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_push_token TEXT;
  payload JSONB;
  has_net_extension BOOLEAN;
BEGIN
  SELECT push_token INTO recipient_push_token
  FROM public.users
  WHERE id = NEW.user_id;

  IF recipient_push_token IS NOT NULL
     AND recipient_push_token LIKE 'ExponentPushToken[%]' THEN
    payload := jsonb_build_object(
      'to', recipient_push_token,
      'sound', 'default',
      'title', NEW.titre,
      'body', NEW.contenu,
      'data', COALESCE(NEW.donnees, '{}'::jsonb)
    );

    SELECT EXISTS (
      SELECT 1 FROM pg_namespace WHERE nspname = 'net'
    ) INTO has_net_extension;

    IF has_net_extension THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := payload,                    -- JSONB : la correction
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Échec de l''envoi du push via pg_net: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (le trigger on_new_notification existant pointe déjà sur cette fonction)

-- 2. Réécriture de push_direct (notifications marketing v3) avec body JSONB
CREATE OR REPLACE FUNCTION public.push_direct(messages JSONB)
RETURNS void AS $$
DECLARE
  total INTEGER;
  i INTEGER := 0;
  chunk JSONB;
BEGIN
  total := COALESCE(jsonb_array_length(messages), 0);
  IF total = 0 THEN RETURN; END IF;

  WHILE i * 90 < total LOOP
    SELECT jsonb_agg(e) INTO chunk
    FROM (
      SELECT e FROM jsonb_array_elements(messages) WITH ORDINALITY t(e, n)
      WHERE n > i * 90 AND n <= (i + 1) * 90
    ) s;

    BEGIN
      PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := chunk,                        -- JSONB : la correction
        timeout_milliseconds := 8000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push_direct: échec envoi lot %: %', i, SQLERRM;
    END;

    i := i + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- =========================================================================
-- TEST IMMÉDIAT (remplace l'e-mail si besoin) — tu dois recevoir un push :
--
--   INSERT INTO public.notifications (user_id, titre, contenu, type)
--   SELECT id, 'Test push réparé ✅', 'Si vous voyez ceci sur votre téléphone, la chaîne pg_net fonctionne enfin de bout en bout.', 'test'
--   FROM public.users WHERE email = 'kmohamedlamine949@gmail.com';
--
-- Puis vérifier la réponse d'Expo (status 200 + "ok") :
--   SELECT id, status_code, LEFT(content::text, 200) AS reponse
--   FROM net._http_response ORDER BY id DESC LIMIT 5;
-- =========================================================================
