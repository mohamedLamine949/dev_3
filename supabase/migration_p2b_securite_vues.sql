-- =========================================================================
-- CORRECTIF DE SÉCURITÉ — la vue de supervision était lisible publiquement
-- Dossier directeur §13.2. Idempotente. Très court.
-- =========================================================================
-- Constaté après application de la phase 0 : `v_job_sante` répond à un appel
-- anonyme de l'API. Les tables `job_runs` et `job_expectations` sont pourtant
-- bien protégées par RLS et renvoient un tableau vide — mais une VUE Postgres
-- s'exécute avec les droits de son propriétaire et contourne donc la RLS des
-- tables qu'elle interroge. Activer RLS sur les tables ne suffit jamais à
-- protéger une vue construite au-dessus.
--
-- Ce qui fuitait : noms des tâches planifiées, horaires de passage, durées,
-- messages d'erreur. Rien d'exploitable directement, mais c'est de la donnée
-- d'exploitation qui n'a aucune raison d'être publique — et le message
-- d'erreur d'un job peut révéler la structure interne de la base.
--
-- Le correctif retire simplement le droit de lecture aux rôles clients. La
-- vue reste consultable depuis l'éditeur SQL du tableau de bord et par le
-- rôle de service, ce qui est son seul usage prévu.
-- =========================================================================

BEGIN;

REVOKE ALL ON public.v_job_sante FROM anon, authenticated;

-- Ceinture et bretelles : les deux tables sous-jacentes aussi, au cas où un
-- futur GRANT global sur le schéma les rendrait accessibles.
REVOKE ALL ON public.job_runs         FROM anon, authenticated;
REVOKE ALL ON public.job_expectations FROM anon, authenticated;

COMMENT ON VIEW public.v_job_sante IS
  'Supervision des taches planifiees. Reservee a l''exploitation : ne JAMAIS '
  'accorder de droit de lecture a anon ou authenticated. Une vue contourne la '
  'RLS des tables qu''elle interroge.';

COMMIT;

-- =========================================================================
-- Vérification — les trois requêtes doivent renvoyer 0 ligne de droits
-- =========================================================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('v_job_sante', 'job_runs', 'job_expectations')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- Contrôle inverse : ce qui DOIT rester lisible par les clients.
SELECT table_name, grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('plans', 'plan_entitlements', 'v_entitlements_publics')
  AND grantee = 'anon'
  AND privilege_type = 'SELECT'
ORDER BY table_name;

-- =========================================================================
-- ROLLBACK (aucune raison de le faire, mais pour mémoire)
-- =========================================================================
-- GRANT SELECT ON public.v_job_sante TO authenticated;
