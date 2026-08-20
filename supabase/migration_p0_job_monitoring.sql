-- =========================================================================
-- PHASE 0 — Journalisation et surveillance des tâches planifiées
-- Dossier directeur §13.3 et §18.1. Idempotente. Non destructive.
-- =========================================================================
-- Aujourd'hui, les tâches pg_cron s'exécutent en aveugle : rien n'indique
-- si elles tournent, combien de lignes elles traitent, ni si elles échouent.
-- C'est ainsi que l'expiration des annonces a pu rester inerte pendant sept
-- semaines sans que personne le voie.
--
-- Cette migration :
--   1. crée une table `job_runs` (début, fin, durée, lignes, erreur) ;
--   2. crée `run_job()` qui exécute une tâche en la journalisant et sans
--      jamais laisser une erreur tuer silencieusement l'ordonnanceur ;
--   3. crée la vue `v_job_sante` (dernier passage, échecs consécutifs, retard) ;
--   4. replanifie les tâches existantes à travers ce wrapper ;
--   5. DÉPLANIFIE explicitement `annonces-expiration`.
--
-- ⚠️ POINT CRITIQUE — pourquoi l'expiration est déplanifiée ici
--
-- Deux raisons, une technique et une produit.
--
-- Technique : `process_annonces_expiration()` ne fait aucune exception pour
-- les comptes professionnels, et les produits de boutique sont stockés dans
-- la même table que les annonces. La réactiver en l'état ferait passer les
-- catalogues PRO en `expire` à 30 jours puis les SUPPRIMERAIT à 60 jours —
-- exactement la permanence que le PRO paie 5 000 F/mois.
--
-- Produit (décision du 2026-08-20) : AUCUNE annonce n'expire, pour personne,
-- tant que le catalogue reste petit. Avec une quarantaine d'annonces actives,
-- appliquer une durée de vie de 30 jours viderait la vitrine au moment précis
-- où elle doit paraître pleine. L'expiration sera rouverte quand le trafic et
-- le volume la justifieront — pas avant.
--
-- La réactivation suppose donc DEUX conditions, pas une : le volume atteint,
-- ET des règles de durée de vie par type de publication (`listing_kind`) qui
-- protègent les catalogues PRO.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Journal des exécutions
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_runs (
  id            BIGSERIAL PRIMARY KEY,
  job_name      TEXT        NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  duration_ms   INTEGER,
  rows_affected INTEGER,
  status        TEXT        NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'success', 'error')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_date
  ON public.job_runs(job_name, started_at DESC);

-- Le journal ne concerne que l'exploitation : personne ne le lit depuis l'app.
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_runs invisible aux clients" ON public.job_runs;
-- Aucune policy permissive : sans policy, RLS refuse tout accès aux rôles
-- anon/authenticated. Les fonctions SECURITY DEFINER et le rôle service
-- continuent d'écrire normalement.

-- -------------------------------------------------------------------------
-- 2. Wrapper d'exécution journalisée
-- -------------------------------------------------------------------------
-- Exécute `sql_command`, mesure la durée, compte les lignes touchées et
-- enregistre le résultat. Une erreur est journalisée puis ravalée : une tâche
-- qui plante ne doit pas empêcher les suivantes de s'exécuter, mais elle doit
-- laisser une trace visible dans `v_job_sante`.
CREATE OR REPLACE FUNCTION public.run_job(job_name TEXT, sql_command TEXT)
RETURNS void AS $$
DECLARE
  v_run_id BIGINT;
  v_start  TIMESTAMPTZ := clock_timestamp();
  v_rows   INTEGER := 0;
BEGIN
  INSERT INTO public.job_runs (job_name, started_at, status)
  VALUES (job_name, v_start, 'running')
  RETURNING id INTO v_run_id;

  BEGIN
    EXECUTE sql_command;
    -- ROW_COUNT compte les lignes RENVOYÉES par la commande, pas les lignes
    -- métier traitées : pour `SELECT public.fn()` il vaudra 1. Le vrai volume
    -- se lira dans les compteurs propres à chaque tâche.
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    UPDATE public.job_runs
    SET finished_at   = clock_timestamp(),
        duration_ms   = (EXTRACT(EPOCH FROM clock_timestamp() - v_start) * 1000)::INTEGER,
        rows_affected = v_rows,
        status        = 'success'
    WHERE id = v_run_id;

  EXCEPTION WHEN OTHERS THEN
    UPDATE public.job_runs
    SET finished_at   = clock_timestamp(),
        duration_ms   = (EXTRACT(EPOCH FROM clock_timestamp() - v_start) * 1000)::INTEGER,
        status        = 'error',
        error_message = SQLERRM
    WHERE id = v_run_id;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
-- NB : `search_path = ''` (recommandation Supabase pour les fonctions SECURITY
-- DEFINER) casserait ici les tâches existantes, qui n'ont pas été écrites avec
-- des noms pleinement qualifiés et hériteraient du search_path du wrapper.
-- Le risque d'injection de search_path est neutralisé autrement : `run_job`
-- n'est appelable ni par anon ni par authenticated (REVOKE ci-dessous).

REVOKE ALL ON FUNCTION public.run_job(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_job(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.run_job(TEXT, TEXT) FROM authenticated;

-- -------------------------------------------------------------------------
-- 3. Attentes de fréquence et vue de santé
-- -------------------------------------------------------------------------
-- Déclare, pour chaque tâche, le délai au-delà duquel son silence est anormal.
CREATE TABLE IF NOT EXISTS public.job_expectations (
  job_name        TEXT PRIMARY KEY,
  max_silence     INTERVAL NOT NULL,
  description     TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.job_expectations (job_name, max_silence, description, enabled) VALUES
  ('notifications-nudge',    INTERVAL '2 days', 'Relance quotidienne des vendeurs inactifs',        TRUE),
  ('notifications-pepite',   INTERVAL '2 days', 'Pepite du jour',                                    TRUE),
  ('notifications-digest',   INTERVAL '2 days', 'Digest quotidien',                                  TRUE),
  ('notifications-relance',  INTERVAL '2 days', 'Relance des conversations sans reponse',            TRUE),
  ('boutiques-stats-hebdo',  INTERVAL '8 days', 'Recapitulatif hebdomadaire des boutiques PRO',      TRUE),
  ('annonces-expiration',    INTERVAL '2 days', 'DESACTIVE — decision produit : rien n''expire tant que le volume est faible', FALSE)
ON CONFLICT (job_name) DO UPDATE
  SET max_silence = EXCLUDED.max_silence,
      description = EXCLUDED.description,
      enabled     = EXCLUDED.enabled;

ALTER TABLE public.job_expectations ENABLE ROW LEVEL SECURITY;

-- Santé de chaque tâche : dernier passage, échecs consécutifs, retard.
CREATE OR REPLACE VIEW public.v_job_sante AS
WITH dernier AS (
  SELECT DISTINCT ON (job_name)
         job_name, started_at, finished_at, duration_ms, rows_affected, status, error_message
  FROM public.job_runs
  ORDER BY job_name, started_at DESC
),
echecs AS (
  -- Nombre d'échecs consécutifs en partant du plus récent.
  SELECT r.job_name, COUNT(*) AS echecs_consecutifs
  FROM (
    SELECT job_name, status,
           ROW_NUMBER() OVER (PARTITION BY job_name ORDER BY started_at DESC) AS rang,
           MIN(CASE WHEN status = 'success' THEN 1 ELSE 0 END)
             OVER (PARTITION BY job_name ORDER BY started_at DESC
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS vu_succes
    FROM public.job_runs
  ) r
  WHERE r.status = 'error' AND r.vu_succes = 0
  GROUP BY r.job_name
)
SELECT
  e.job_name,
  e.enabled                                        AS attendu,
  e.description,
  d.started_at                                     AS dernier_passage,
  d.status                                         AS dernier_statut,
  d.rows_affected                                  AS dernieres_lignes,
  d.duration_ms                                    AS derniere_duree_ms,
  d.error_message                                  AS derniere_erreur,
  COALESCE(f.echecs_consecutifs, 0)                AS echecs_consecutifs,
  CASE
    WHEN NOT e.enabled                                    THEN 'desactive'
    WHEN d.started_at IS NULL                             THEN 'jamais execute'
    WHEN NOW() - d.started_at > e.max_silence             THEN 'en retard'
    WHEN COALESCE(f.echecs_consecutifs, 0) >= 2           THEN 'en echec'
    WHEN d.status = 'error'                               THEN 'derniere execution en erreur'
    ELSE 'ok'
  END                                              AS alerte
FROM public.job_expectations e
LEFT JOIN dernier d ON d.job_name = e.job_name
LEFT JOIN echecs  f ON f.job_name = e.job_name;

COMMIT;

-- =========================================================================
-- 4. Replanification à travers le wrapper journalisé
--    (hors transaction : cron.schedule pose ses propres verrous)
-- =========================================================================

-- Déplanifie proprement une tâche sans échouer si elle n'existe pas.
DO $$
DECLARE j TEXT;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'annonces-expiration',
    'notifications-nudge',
    'notifications-pepite',
    'notifications-digest',
    'notifications-relance',
    'boutiques-stats-hebdo'
  ] LOOP
    BEGIN
      PERFORM cron.unschedule(j);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- la tâche n'était pas planifiée
    END;
  END LOOP;
END;
$$;

-- ⚠️ `annonces-expiration` n'est VOLONTAIREMENT pas replanifiée ici.
--    Voir l'en-tête. À réactiver en phase 1, une fois `listing_kind` en place.

SELECT cron.schedule('notifications-nudge',   '0 10 * * *',
  $$SELECT public.run_job('notifications-nudge',   'SELECT public.envoyer_nudge_vente()')$$);

SELECT cron.schedule('notifications-pepite',  '0 13 * * *',
  $$SELECT public.run_job('notifications-pepite',  'SELECT public.envoyer_pepite_du_jour()')$$);

SELECT cron.schedule('notifications-digest',  '0 18 * * *',
  $$SELECT public.run_job('notifications-digest',  'SELECT public.envoyer_digest_quotidien()')$$);

SELECT cron.schedule('notifications-relance', '30 12 * * *',
  $$SELECT public.run_job('notifications-relance', 'SELECT public.envoyer_relance_inactifs()')$$);

SELECT cron.schedule('boutiques-stats-hebdo', '0 9 * * 1',
  $$SELECT public.run_job('boutiques-stats-hebdo', 'SELECT public.envoyer_stats_hebdo_vendeurs()')$$);

-- =========================================================================
-- 5. Vérification — à lire après exécution
-- =========================================================================
-- Tâches réellement planifiées dans pg_cron :
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Santé (tout sera « jamais execute » tant qu'aucun passage n'a eu lieu) :
SELECT * FROM public.v_job_sante ORDER BY job_name;
