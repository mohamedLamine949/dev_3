-- =========================================================================
-- MIGRATION : Notifications v3 — calendrier d'engagement (3 push/jour max)
-- À exécuter dans le SQL Editor. Idempotente. REMPLACE la v2 (la contient) :
-- si vous n'avez pas encore exécuté migration_notifications_v2.sql, exécutez
-- SEULEMENT ce fichier.
-- =========================================================================
-- Philosophie : régulier comme TikTok, mais jamais creux.
--   10h00  Nudge vente     — « vendez vos objets du quotidien » (7 messages,
--          un par jour de semaine, zéro répétition) pour ceux qui n'ont pas
--          d'annonce en ligne ; stats de vues (lun & jeu) pour les vendeurs.
--   13h00  Pépite du jour  — la meilleure annonce des dernières 48h.
--   18h00  Digest          — « X nouvelles annonces aujourd'hui » (si ≥ 3).
--
-- Deux familles de notifications :
--   - TRANSACTIONNELLES (chat, favori, annonce, parrainage…) : insérées dans
--     la table notifications → in-app + badge + push (trigger existant).
--   - MARKETING (les 3 créneaux ci-dessus) : PUSH DIRECT via pg_net, sans
--     insertion en base → la liste in-app et le badge restent réservés aux
--     vraies notifications personnelles. Pas de pollution, pas d'accoutumance.
--
-- Interrupteur d'urgence : app_config.marketing_notifs_enabled = FALSE coupe
-- les 3 créneaux instantanément, sans toucher aux transactionnelles.
-- =========================================================================

-- 1. LE FIX HISTORIQUE : sans pg_net, aucun push ne part depuis le début
CREATE EXTENSION IF NOT EXISTS pg_net;

BEGIN;

-- 2. Dernière ouverture de l'app (mise à jour par l'app — AuthContext)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_derniere_connexion ON public.users(derniere_connexion);

-- 3. Interrupteur des notifications marketing (pilotable à distance)
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS marketing_notifs_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- -------------------------------------------------------------------------
-- 4. HELPER : envoi direct d'un lot de push à l'API Expo (par paquets de 90)
-- -------------------------------------------------------------------------
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
        body := chunk::text,
        timeout_milliseconds := 8000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push_direct: échec envoi lot %: %', i, SQLERRM;
    END;

    i := i + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cible marketing : joignable, actif, marketing autorisé
CREATE OR REPLACE FUNCTION public.marketing_actif()
RETURNS boolean AS $$
  SELECT COALESCE((SELECT marketing_notifs_enabled FROM public.app_config WHERE id = 1), TRUE);
$$ LANGUAGE sql STABLE;

-- -------------------------------------------------------------------------
-- 5. CRÉNEAU 10h00 — NUDGE VENTE (« vendez vos objets du quotidien »)
--    7 messages, un par jour de la semaine : jamais deux fois le même dans
--    la semaine. Cible : utilisateurs SANS annonce active.
--    Les vendeurs actifs reçoivent, lundi et jeudi, leurs stats de vues.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.envoyer_nudge_vente()
RETURNS void AS $$
DECLARE
  dow INTEGER;
  titres TEXT[] := ARRAY[
    'Un dimanche tranquille ? 📦',
    'Nouvelle semaine, nouveau gain 💼',
    'Le saviez-vous ? 💡',
    'Ça dort chez vous, ça manque à quelqu''un 🔄',
    'Le week-end approche 🛒',
    'Petit rangement, gros gain 🧹',
    'C''est jour de marché ! 🌍'
  ];
  corps TEXT[] := ARRAY[
    'Faites le tour de la maison : ce que vous n''utilisez plus peut rapporter. Photographiez, publiez, vendez.',
    'Un téléphone inutilisé, un habit jamais porté ? Publiez-le aujourd''hui, il peut être vendu avant le week-end.',
    'Ce sont les objets du quotidien qui se vendent le mieux : ustensiles, habits, électronique. Les vôtres attendent peut-être un acheteur.',
    'Ce ventilateur, ce sac, cette montre… Donnez-leur une seconde vie et empochez le prix.',
    'Les acheteurs cherchent surtout le week-end. Publiez maintenant pour être visible au bon moment.',
    'En rangeant ce week-end, mettez de côté ce que vous n''utilisez plus — et vendez-le sur Flash Market.',
    'Le marché est dans votre poche : publiez une annonce aujourd''hui et faites-la voir à tout Bamako.'
  ];
  lot JSONB;
BEGIN
  IF NOT public.marketing_actif() THEN RETURN; END IF;
  dow := EXTRACT(DOW FROM NOW())::int; -- 0 = dimanche … 6 = samedi

  -- a) Sans annonce active : invitation à vendre (message du jour)
  SELECT jsonb_agg(jsonb_build_object(
    'to', u.push_token, 'sound', 'default',
    'title', titres[dow + 1], 'body', corps[dow + 1]
  )) INTO lot
  FROM public.users u
  WHERE u.push_token LIKE 'ExponentPushToken[%]'
    AND COALESCE(u.statut, 'actif') = 'actif'
    AND NOT EXISTS (
      SELECT 1 FROM public.annonces a
      WHERE a.user_id = u.id AND a.statut IN ('active', 'vendu')
    );
  PERFORM public.push_direct(lot);

  -- b) Vendeurs actifs : stats de vues, lundi (1) et jeudi (4) seulement
  IF dow IN (1, 4) THEN
    SELECT jsonb_agg(jsonb_build_object(
      'to', s.push_token, 'sound', 'default',
      'title', 'Vos annonces attirent l''œil 👀',
      'body', format('Vos annonces ont été vues %s fois au total. Publiez-en une nouvelle pour vendre encore plus !', s.total_vues)
    )) INTO lot
    FROM (
      SELECT u.push_token, SUM(COALESCE(a.nombre_vues, 0)) AS total_vues
      FROM public.users u
      JOIN public.annonces a ON a.user_id = u.id AND a.statut IN ('active', 'vendu')
      WHERE u.push_token LIKE 'ExponentPushToken[%]'
        AND COALESCE(u.statut, 'actif') = 'actif'
      GROUP BY u.push_token
      HAVING SUM(COALESCE(a.nombre_vues, 0)) >= 10
    ) s;
    PERFORM public.push_direct(lot);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- 6. CRÉNEAU 13h00 — PÉPITE DU JOUR (meilleure annonce des dernières 48h)
--    Personne ne la reçoit s'il n'y a rien de frais : jamais de notif creuse.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.envoyer_pepite_du_jour()
RETURNS void AS $$
DECLARE
  pepite RECORD;
  lot JSONB;
BEGIN
  IF NOT public.marketing_actif() THEN RETURN; END IF;

  SELECT a.id, a.user_id, a.titre, a.prix INTO pepite
  FROM public.annonces a
  WHERE a.statut = 'active'
    AND a.date_creation >= NOW() - INTERVAL '48 hours'
  ORDER BY COALESCE(a.nombre_vues, 0) DESC, a.date_creation DESC
  LIMIT 1;

  IF pepite IS NULL THEN RETURN; END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'to', u.push_token, 'sound', 'default',
    'title', 'La pépite du jour 🔥',
    'body', format('« %s » à %s FCFA — premier arrivé, premier servi !',
                   pepite.titre, TO_CHAR(pepite.prix, 'FM999G999G999')),
    'data', jsonb_build_object('annonceId', pepite.id)
  )) INTO lot
  FROM public.users u
  WHERE u.push_token LIKE 'ExponentPushToken[%]'
    AND COALESCE(u.statut, 'actif') = 'actif'
    AND u.id <> pepite.user_id; -- pas au propriétaire de l'annonce

  PERFORM public.push_direct(lot);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- 7. CRÉNEAU 18h00 — DIGEST « X nouvelles annonces aujourd'hui » (si ≥ 3)
--    + purge d'hygiène des notifications in-app de plus de 60 jours
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.envoyer_digest_quotidien()
RETURNS void AS $$
DECLARE
  nb_annonces INTEGER;
  idx INTEGER;
  titres TEXT[] := ARRAY[
    'Ça a bougé aujourd''hui 🔥',
    'Du nouveau près de chez vous 🛍️',
    'Ne ratez pas les nouveautés 📢'
  ];
  corps TEXT[] := ARRAY[
    '%s nouvelles annonces publiées aujourd''hui. Venez jeter un œil avant les autres !',
    '%s annonces fraîches vous attendent : téléphones, mode, maison et plus encore.',
    '%s nouvelles offres aujourd''hui. La bonne affaire du jour est peut-être pour vous !'
  ];
  lot JSONB;
BEGIN
  -- Purge d'hygiène (indépendante de l'interrupteur marketing)
  DELETE FROM public.notifications WHERE date_creation < NOW() - INTERVAL '60 days';

  IF NOT public.marketing_actif() THEN RETURN; END IF;

  SELECT COUNT(*) INTO nb_annonces
  FROM public.annonces
  WHERE statut = 'active'
    AND date_creation >= NOW() - INTERVAL '24 hours';

  IF nb_annonces < 3 THEN RETURN; END IF; -- pas de notif creuse

  idx := 1 + (EXTRACT(DAY FROM NOW())::int % 3);

  SELECT jsonb_agg(jsonb_build_object(
    'to', u.push_token, 'sound', 'default',
    'title', titres[idx], 'body', format(corps[idx], nb_annonces)
  )) INTO lot
  FROM public.users u
  WHERE u.push_token LIKE 'ExponentPushToken[%]'
    AND COALESCE(u.statut, 'actif') = 'actif';

  PERFORM public.push_direct(lot);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction relance v2 devenue inutile (les 3 créneaux couvrent tout le monde,
-- inactifs compris) : on la supprime proprement si elle existe.
DROP FUNCTION IF EXISTS public.envoyer_relance_inactifs();

COMMIT;

-- -------------------------------------------------------------------------
-- 8. PLANIFICATION pg_cron (heures de Bamako = UTC)
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN PERFORM cron.unschedule('notifications-relance'); EXCEPTION WHEN OTHERS THEN NULL; END; $$;
DO $$ BEGIN PERFORM cron.unschedule('notifications-nudge');   EXCEPTION WHEN OTHERS THEN NULL; END; $$;
DO $$ BEGIN PERFORM cron.unschedule('notifications-pepite');  EXCEPTION WHEN OTHERS THEN NULL; END; $$;
DO $$ BEGIN PERFORM cron.unschedule('notifications-digest');  EXCEPTION WHEN OTHERS THEN NULL; END; $$;

SELECT cron.schedule('notifications-nudge',  '0 10 * * *', $$SELECT public.envoyer_nudge_vente()$$);
SELECT cron.schedule('notifications-pepite', '0 13 * * *', $$SELECT public.envoyer_pepite_du_jour()$$);
SELECT cron.schedule('notifications-digest', '0 18 * * *', $$SELECT public.envoyer_digest_quotidien()$$);

-- =========================================================================
-- TESTS IMMÉDIATS après exécution :
--   SELECT public.envoyer_nudge_vente();      -- envoie le nudge du jour
--   SELECT public.envoyer_pepite_du_jour();   -- envoie la pépite (si annonce <48h)
-- Vérifier les réponses d'Expo :
--   SELECT id, status_code, LEFT(content::text, 300)
--   FROM net._http_response ORDER BY id DESC LIMIT 5;
-- Couper le marketing en urgence :
--   UPDATE public.app_config SET marketing_notifs_enabled = FALSE WHERE id = 1;
-- =========================================================================
