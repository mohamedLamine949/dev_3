-- =========================================================================
-- MIGRATION : Notifications v2 — FIX du push + notifications d'engagement
-- À exécuter dans le SQL Editor du dashboard Supabase. Idempotente.
-- =========================================================================
-- DIAGNOSTIC (2026-07-10) : les tokens push sont bien enregistrés (32/43
-- utilisateurs) et la chaîne Expo → FCM → téléphones fonctionne (test réel :
-- 10/12 livrés). Le maillon cassé est EN AMONT : l'extension pg_net n'a
-- jamais été activée, donc le trigger send_push_notification (voir
-- migration_notifications.sql) saute l'envoi EN SILENCE depuis le début.
-- Les notifications s'écrivaient en base (visibles dans l'app) mais aucun
-- push n'est jamais parti.
--
-- Cette migration :
--   1. Active pg_net  ← LE FIX
--   2. Ajoute users.derniere_connexion (mise à jour par l'app à l'ouverture)
--   3. Digest quotidien 18h : « X nouvelles annonces aujourd'hui »
--   4. Relance des inactifs (7 jours sans ouvrir l'app), max 1 par semaine
--   5. Purge des notifications de plus de 60 jours
-- =========================================================================

-- 1. LE FIX : sans pg_net, aucun push ne part (échec silencieux du trigger)
CREATE EXTENSION IF NOT EXISTS pg_net;

BEGIN;

-- 2. Suivi de la dernière ouverture de l'app (pour cibler les inactifs)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_derniere_connexion ON public.users(derniere_connexion);

-- -------------------------------------------------------------------------
-- 3. DIGEST QUOTIDIEN : « X nouvelles annonces aujourd'hui »
--    Envoyé seulement s'il y a au moins 3 nouvelles annonces (sinon silence :
--    une notif vide de contenu fait désinstaller). Messages en rotation pour
--    ne pas lasser. Chaque insert dans notifications déclenche le push.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.envoyer_digest_quotidien()
RETURNS void AS $$
DECLARE
  nb_annonces INTEGER;
  modeles_titre TEXT[] := ARRAY[
    'Ça bouge sur Flash Market 🔥',
    'Du nouveau près de chez vous 🛍️',
    'Ne ratez pas les nouveautés 📢'
  ];
  modeles_corps TEXT[] := ARRAY[
    '%s nouvelles annonces publiées aujourd''hui. Venez jeter un œil avant les autres !',
    '%s annonces fraîches vous attendent : téléphones, mode, maison et plus encore.',
    '%s nouvelles offres aujourd''hui. La bonne affaire du jour est peut-être pour vous !'
  ];
  idx INTEGER;
BEGIN
  -- Annonces publiées dans les dernières 24h
  SELECT COUNT(*) INTO nb_annonces
  FROM public.annonces
  WHERE statut = 'active'
    AND date_creation >= NOW() - INTERVAL '24 hours';

  IF nb_annonces < 3 THEN
    RETURN; -- pas assez de contenu : on ne dérange personne
  END IF;

  idx := 1 + (EXTRACT(DAY FROM NOW())::int % 3);

  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  SELECT
    u.id,
    modeles_titre[idx],
    format(modeles_corps[idx], nb_annonces),
    'digest',
    jsonb_build_object('ecran', 'Accueil')
  FROM public.users u
  WHERE u.push_token LIKE 'ExponentPushToken[%]'
    AND COALESCE(u.statut, 'actif') = 'actif'
    -- anti-doublon : jamais deux digests en moins de 20h
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = u.id AND n.type = 'digest'
        AND n.date_creation >= NOW() - INTERVAL '20 hours'
    );

  -- Hygiène : purge des notifications de plus de 60 jours
  DELETE FROM public.notifications WHERE date_creation < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- 4. RELANCE DES INACTIFS : 7 jours sans ouvrir l'app, max 1 relance/semaine
--    (ne cible que ceux dont on connaît la dernière connexion, donc la
--    colonne se remplit au fil des ouvertures après l'update OTA)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.envoyer_relance_inactifs()
RETURNS void AS $$
DECLARE
  modeles_titre TEXT[] := ARRAY[
    'On ne vous a pas vu cette semaine 👋',
    'Votre marché vous attend 🛒',
    'De belles affaires vous ont manqué 💎'
  ];
  modeles_corps TEXT[] := ARRAY[
    'De nouvelles annonces ont été publiées depuis votre dernière visite. Revenez faire un tour !',
    'Les bonnes affaires partent vite sur Flash Market. Ouvrez l''app pour ne rien manquer.',
    'Téléphones, mode, maison… le choix s''est agrandi depuis votre dernier passage.'
  ];
  idx INTEGER;
BEGIN
  idx := 1 + (EXTRACT(WEEK FROM NOW())::int % 3);

  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  SELECT
    u.id,
    modeles_titre[idx],
    modeles_corps[idx],
    'relance',
    jsonb_build_object('ecran', 'Accueil')
  FROM public.users u
  WHERE u.push_token LIKE 'ExponentPushToken[%]'
    AND COALESCE(u.statut, 'actif') = 'actif'
    AND u.derniere_connexion IS NOT NULL
    AND u.derniere_connexion < NOW() - INTERVAL '7 days'
    -- max une relance par semaine
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = u.id AND n.type = 'relance'
        AND n.date_creation >= NOW() - INTERVAL '7 days'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- -------------------------------------------------------------------------
-- 5. PLANIFICATION pg_cron (heures de Bamako = UTC)
--    Digest à 18h00 (fin de journée, pic d'usage) ; relance à 12h30.
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('notifications-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule('notifications-digest', '0 18 * * *',
  $$SELECT public.envoyer_digest_quotidien()$$);

DO $$
BEGIN
  PERFORM cron.unschedule('notifications-relance');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule('notifications-relance', '30 12 * * *',
  $$SELECT public.envoyer_relance_inactifs()$$);

-- =========================================================================
-- TEST IMMÉDIAT (à exécuter après cette migration pour vérifier le fix) :
--
--   INSERT INTO public.notifications (user_id, titre, contenu, type)
--   SELECT id, 'Test push ✅', 'Le système de notifications est réparé !', 'test'
--   FROM public.users WHERE email = 'kmohamedlamine949@gmail.com';
--
-- Puis vérifier la réponse d'Expo (statut HTTP + corps) :
--   SELECT id, status_code, content::text
--   FROM net._http_response ORDER BY id DESC LIMIT 5;
-- =========================================================================
