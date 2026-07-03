-- =====================================================================
-- CONFIG D'APPLICATION À DISTANCE (interrupteur paiement)
-- À exécuter dans le SQL Editor Supabase (projet prod kmydbkaytrxtcequngnn).
-- Idempotent : ré-exécutable sans risque.
--
-- Permet d'activer/désactiver le paiement des annonces SANS rebuild ni
-- soumission : l'app lit ce drapeau au moment de publier.
--   payments_enabled = TRUE  -> flux de paiement normal (défaut)
--   payments_enabled = FALSE -> publication gratuite directe
--
-- Pour BASCULER en gratuit (phase de lancement) :
--   UPDATE public.app_config SET payments_enabled = FALSE, updated_at = NOW() WHERE id = 1;
-- Pour REVENIR en payant :
--   UPDATE public.app_config SET payments_enabled = TRUE,  updated_at = NOW() WHERE id = 1;
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  payments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_config_single_row CHECK (id = 1)
);

-- Ligne unique, défaut = PAYANT.
INSERT INTO public.app_config (id, payments_enabled)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (l'app doit pouvoir lire le drapeau, même invité).
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config is public readable" ON public.app_config;
CREATE POLICY "app_config is public readable" ON public.app_config
  FOR SELECT USING (true);

-- Aucune policy d'écriture : seule la service_role / le dashboard peut
-- modifier le drapeau. Un utilisateur ne peut pas s'auto-passer en gratuit.
