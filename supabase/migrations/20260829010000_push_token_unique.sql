-- =========================================================================
-- FIX : un jeton Expo ne peut appartenir qu'a un seul compte
--
-- Un meme telephone reutilise pour plusieurs comptes conservait son
-- push_token sur chacun d'eux. Les envois marketing parcourant les comptes,
-- le telephone recevait alors le meme push autant de fois (souvent 3).
-- =========================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;

-- Nettoie les doublons deja presents. Le compte utilise le plus recemment
-- conserve le jeton ; a defaut, le compte cree le plus recemment le conserve.
WITH tokens_classes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY push_token
      ORDER BY derniere_connexion DESC NULLS LAST, date_creation DESC NULLS LAST, id
    ) AS rang
  FROM public.users
  WHERE push_token IS NOT NULL AND BTRIM(push_token) <> ''
)
UPDATE public.users AS u
SET push_token = NULL
FROM tokens_classes AS t
WHERE u.id = t.id AND t.rang > 1;

UPDATE public.users
SET push_token = NULL
WHERE push_token IS NOT NULL AND BTRIM(push_token) = '';

-- Filet de securite permanent contre toute autre ecriture concurrente.
CREATE UNIQUE INDEX IF NOT EXISTS users_push_token_unique
  ON public.users (push_token)
  WHERE push_token IS NOT NULL;

-- Attribution atomique appelee par l'app. SECURITY DEFINER permet de retirer
-- le jeton des anciens comptes malgre la RLS, mais uniquement pour le compte
-- actuellement authentifie.
CREATE OR REPLACE FUNCTION public.claim_push_token(p_push_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  token TEXT := NULLIF(BTRIM(p_push_token), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF token IS NULL OR token NOT LIKE 'ExponentPushToken[%]' THEN
    RAISE EXCEPTION 'Jeton Expo invalide';
  END IF;

  UPDATE public.users
  SET push_token = NULL
  WHERE push_token = token AND id <> uid;

  UPDATE public.users
  SET push_token = token
  WHERE id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push_token(TEXT) TO authenticated;

COMMIT;
