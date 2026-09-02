-- =========================================================================
-- MIGRATION : séparer le paiement du BOOST du paiement des ACCÈS
-- À exécuter dans le SQL Editor Supabase (projet prod). Idempotente.
-- Prérequis : migration_p1_entitlements.sql (app_config),
--             migration_paiements.sql (table paiements + triggers).
-- =========================================================================
-- POURQUOI
--
-- `app_config.payments_enabled` était un interrupteur UNIQUE : il ouvrait ou
-- fermait d'un coup les offres d'accès (devenir Pro / boutique / vendeur) ET
-- le boost d'annonce. Le retour en offre de lancement du 2026-09-01 a donc
-- rendu le boost gratuit sans que ce soit voulu — résultat : n'importe qui
-- peut booster n'importe quelle annonce, et la mise en avant ne vaut plus
-- rien puisque tout le monde peut l'avoir.
--
-- Décision (2026-09-02) :
--   • devenir professionnel, créer sa boutique et ses catalogues : GRATUIT
--     pendant le lancement — c'est ce qui remplit l'application ;
--   • booster une annonce : PAYANT dès maintenant — c'est une place limitée
--     en tête de fil, elle doit se mériter ou se payer.
--
-- D'où deux interrupteurs indépendants. `payments_enabled` garde son sens
-- (accès), `boost_payments_enabled` gouverne le boost.
--
-- SUITE PRÉVUE (non implémentée ici) : le jour où les accès deviendront
-- payants, un compte qui vient d'acheter sa boutique recevra DEUX boosts
-- offerts. Le support existe déjà — `plans.credits_boost`, lu par
-- `get_effective_entitlements()` et exposé par `useEntitlements` — mais rien
-- ne le consomme aujourd'hui. Ne pas l'activer sans instruction explicite.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Le second interrupteur
-- =========================================================================
-- Défaut TRUE : en cas de doute, le boost est payant. L'inverse offrirait la
-- mise en avant à tout le monde sans que personne ne l'ait décidé.
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS boost_payments_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.app_config.boost_payments_enabled IS
  'Le boost d''annonce passe-t-il par PaiementPro ? Indépendant de payments_enabled, qui ne gouverne que les offres d''accès (Pro/Service/Vendeur). FALSE = boost offert à tout le monde.';

COMMENT ON COLUMN public.app_config.payments_enabled IS
  'Les offres d''ACCÈS (Pro / Service / Vendeur) sont-elles payantes ? Ne gouverne PAS le boost — voir boost_payments_enabled.';

-- État voulu au 2026-09-02 : accès gratuits, boost payant.
-- `payments_enabled` n'est volontairement PAS modifié ici : l'offre de
-- lancement gratuite reste en vigueur, c'est une décision produit distincte.
UPDATE public.app_config
   SET boost_payments_enabled = TRUE,
       updated_at = NOW()
 WHERE id = 1;

-- =========================================================================
-- 2. Le garde-fou du journal suit le bon interrupteur
-- =========================================================================
-- Le prix du boost est décidé par le téléphone : un appareil resté sur un
-- ancien bundle JS écrit 250 F même sur un boost offert. La base tranche donc
-- elle-même. Mais elle doit regarder l'interrupteur DU BOOST : brancher ce
-- garde-fou sur `payments_enabled` ferait silencieusement disparaître les
-- boosts réellement payés à partir d'aujourd'hui, puisque les accès, eux,
-- restent gratuits.
CREATE OR REPLACE FUNCTION public.enregistrer_paiement_boost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.boost_paye_le IS NOT NULL
     AND COALESCE(NEW.boost_prix, 0) > 0
     AND COALESCE((SELECT boost_payments_enabled FROM public.app_config WHERE id = 1), TRUE)
     AND (TG_OP = 'INSERT'
          OR OLD.boost_paye_le IS DISTINCT FROM NEW.boost_paye_le)
  THEN
    INSERT INTO public.paiements
      (user_id, type, montant_fcfa, annonce_id, transaction_id,
       date_paiement, source, note)
    VALUES
      (NEW.user_id, 'boost', NEW.boost_prix, NEW.id,
       NULLIF(NEW.boost_transaction_id, ''), NEW.boost_paye_le,
       'paiementpro', 'Boost de mise en avant (48 h)')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMIT;

-- =========================================================================
-- VÉRIFICATION (à lancer après)
-- =========================================================================
-- Attendu : payments_enabled = false (accès gratuits),
--           boost_payments_enabled = true (boost payant).
-- SELECT payments_enabled, boost_payments_enabled, monetization_mode, updated_at
--   FROM public.app_config WHERE id = 1;
