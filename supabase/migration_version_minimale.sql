-- =====================================================================
-- VERSION MINIMALE EXIGÉE (garde-fou des mises à jour de store)
-- À exécuter dans le SQL Editor Supabase (projet prod kmydbkaytrxtcequngnn).
-- Idempotent : ré-exécutable sans risque.
--
-- POURQUOI
-- Une mise à jour OTA (eas update) ne peut PAS atteindre un téléphone dont le
-- binaire installé est trop ancien : chaque binaire n'accepte que les mises à
-- jour publiées pour SA runtimeVersion. Un utilisateur resté en 1.0.1 n'a donc
-- jamais reçu le boost payant ni la refonte — et rien dans l'app ne le lui
-- disait. Il pouvait rester des mois sur une version morte sans le savoir.
--
-- Ce drapeau permet, le jour où un nouveau binaire est publié sur les stores,
-- d'afficher un écran clair « Mettez à jour Flash Market » avec un bouton qui
-- ouvre directement la fiche du store.
--
-- RÈGLE D'USAGE
--   version_minimale = NULL  -> aucun blocage (valeur par défaut, état normal)
--   version_minimale = '1.1.0' -> tout binaire < 1.1.0 voit l'écran de mise à jour
--
-- Ne renseigner cette valeur QU'APRÈS que la nouvelle version soit réellement
-- disponible et validée sur l'App Store ET sur le Play Store. La renseigner
-- trop tôt bloquerait des gens devant une mise à jour qui n'existe pas encore.
--
--   UPDATE public.app_config SET version_minimale = '1.1.0', updated_at = NOW() WHERE id = 1;
-- Pour lever le blocage :
--   UPDATE public.app_config SET version_minimale = NULL, updated_at = NOW() WHERE id = 1;
-- =====================================================================

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS version_minimale TEXT;

-- État normal : personne n'est bloqué.
UPDATE public.app_config SET version_minimale = NULL WHERE id = 1 AND version_minimale IS NULL;

-- La lecture publique existante (policy "app_config is public readable")
-- couvre déjà cette colonne : l'app lit la ligne entière avec `select('*')`.
-- Toujours aucune policy d'écriture : seul le dashboard peut poser le seuil.
