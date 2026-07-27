-- =========================================================================
-- DIAGNOSTIC NOTIFICATIONS — à exécuter dans le SQL Editor (lecture seule)
-- Chaque bloc répond à une question. Exécutez tout, lisez les résultats.
-- =========================================================================

-- Q1. pg_net est-il activé ? (suspect n°1 — si 0 ligne : AUCUN push ne part)
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';

-- Q2. pg_cron est-il activé ? (nécessaire pour digest/relance/expiration)
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';

-- Q3. Les notifications s'écrivent-elles en base ? (volumes par type, 30 j)
SELECT type, COUNT(*) AS nb, MAX(date_creation) AS derniere
FROM public.notifications
WHERE date_creation >= NOW() - INTERVAL '30 days'
GROUP BY type ORDER BY nb DESC;

-- Q4. Combien d'utilisateurs joignables par push ?
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE push_token LIKE 'ExponentPushToken[%]') AS avec_token_valide
FROM public.users;

-- Q5. Si pg_net est actif : les derniers appels HTTP vers Expo et leurs
--     réponses (status 200 + "ok" = envoyé ; erreurs = à investiguer).
--     (Ne renvoie rien si pg_net vient d'être activé : la table est vide.)
SELECT id, status_code, LEFT(content::text, 200) AS reponse
FROM net._http_response
ORDER BY id DESC
LIMIT 10;

-- Q6. Les tâches planifiées existantes
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
