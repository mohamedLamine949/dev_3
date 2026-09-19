-- =========================================================================
-- MIGRATION : « COMMENT AVEZ-VOUS CONNU FLASH MARKET ? »
-- =========================================================================
-- Prérequis : migration_admin_rls.sql (lecture admin de users). Idempotente.
--
-- Avant de mettre de l'argent en publicité, il faut savoir ce qui ramène
-- les gens : TikTok, Facebook, un influenceur, un ami… Aucun outil de suivi
-- n'est installé dans l'application ; on pose donc la question, une fois,
-- à chaque utilisateur (nouveaux ET anciens), sur l'accueil.
--
-- La réponse est écrite par une fonction plutôt que par un UPDATE direct :
--   - valeurs en liste fermée (des chiffres propres dans la console) ;
--   - une seule réponse par compte : on ne la réécrit pas (la première
--     réponse est la plus fiable, et un double appui ne fausse rien).
-- =========================================================================

BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS source_acquisition TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS source_detail TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS source_date TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_source_acquisition_check
    CHECK (source_acquisition IS NULL OR source_acquisition IN (
      'tiktok', 'facebook', 'instagram', 'influenceur', 'ami', 'whatsapp',
      'store', 'autre', 'sans_reponse'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_source_acquisition(
  p_source TEXT,
  p_detail TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Connexion requise');
  END IF;

  IF p_source NOT IN ('tiktok', 'facebook', 'instagram', 'influenceur', 'ami',
                      'whatsapp', 'store', 'autre', 'sans_reponse') THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Reponse inconnue');
  END IF;

  UPDATE public.users
  SET source_acquisition = p_source,
      source_detail = NULLIF(left(trim(coalesce(p_detail, '')), 80), ''),
      source_date = NOW()
  WHERE id = v_uid AND source_acquisition IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_source_acquisition(TEXT, TEXT) TO authenticated;

COMMIT;
