-- =========================================================================
-- MIGRATION : Statut "Ouvert maintenant" + Suivre une boutique
-- Idempotente. Indépendante de migration_boutiques*.sql.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Statut "Ouvert maintenant" — interrupteur manuel, pas d'horaires
--    structurés (choix produit : la boutique le bascule elle-même).
-- -------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ouvert_maintenant BOOLEAN NOT NULL DEFAULT true;

-- -------------------------------------------------------------------------
-- 2. Suivre une boutique
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boutique_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT follow_pas_soi_meme CHECK (follower_id <> boutique_id),
  CONSTRAINT follow_unique UNIQUE (follower_id, boutique_id)
);

CREATE INDEX IF NOT EXISTS idx_boutique_follows_follower ON public.boutique_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_boutique_follows_boutique ON public.boutique_follows(boutique_id);

ALTER TABLE public.boutique_follows ENABLE ROW LEVEL SECURITY;

-- Le compteur de followers d'une boutique doit être visible publiquement ;
-- chacun ne voit le détail (qui suit quoi) que pour ses propres follows.
DROP POLICY IF EXISTS "Follows publics en lecture" ON public.boutique_follows;
CREATE POLICY "Follows publics en lecture" ON public.boutique_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Un utilisateur gere ses follows" ON public.boutique_follows;
CREATE POLICY "Un utilisateur gere ses follows" ON public.boutique_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Un utilisateur supprime ses follows" ON public.boutique_follows;
CREATE POLICY "Un utilisateur supprime ses follows" ON public.boutique_follows
  FOR DELETE USING (auth.uid() = follower_id);

COMMIT;
