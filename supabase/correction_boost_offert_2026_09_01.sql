-- =========================================================================
-- CORRECTION : un boost OFFERT enregistré comme un encaissement de 250 F
-- À exécuter dans le SQL Editor Supabase (projet prod). Idempotente.
-- Prérequis : migration_paiements.sql.
-- =========================================================================
-- CE QUI S'EST PASSÉ
--
-- 2026-09-01 12:07 UTC : `app_config` repasse en FREE_LAUNCH
-- (`payments_enabled = false`) — offre de lancement gratuite. Depuis cet
-- instant, le bouton « Booster » active le boost SANS passer par
-- PaiementPro, pour tout le monde (particuliers comme professionnels : il
-- n'existe aucun jeton de boost gratuit réservé aux Pro).
--
-- 2026-09-01 15:25 UTC : boost de l'annonce « Stanley » (Djeneba Traoré),
-- donc offert, aucun franc encaissé — rien dans le relevé PaiementPro.
-- Mais `activerBoost` écrivait alors `boost_prix = 250` en dur, quel que
-- soit le mode. Le backfill de migration_paiements.sql a donc importé cette
-- ligne comme un encaissement réel, et la console affichait 500 F de
-- chiffre d'affaires au lieu de 250 F.
--
-- Le seul encaissement réel reste le boost de Mamadou Camara du
-- 2026-08-31 23:23 UTC (250 F), fait pendant que la monétisation était LIVE
-- — celui-là est bien dans le relevé PaiementPro.
--
-- Le correctif applicatif est déjà en production (`activerBoost` reçoit le
-- prix réel, 0 quand le boost est offert). Ce script répare les données
-- déjà écrites, puis ferme la porte côté base : tant que les paiements sont
-- désactivés, aucun boost ne peut plus créer de ligne d'encaissement, même
-- écrit par un téléphone resté sur un ancien bundle JS.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Le prix réellement payé pour ce boost était 0
-- =========================================================================
-- Ciblage explicite : cette annonce, ce boost-là. La condition sur
-- `boost_paye_le` évite de toucher un boost ultérieur de la même annonce.
UPDATE public.annonces
   SET boost_prix = 0
 WHERE id = '7122a0b2-d2a6-44ea-ab01-e724babab6e5'
   AND boost_paye_le = '2026-09-01T15:25:56.641+00:00';

-- =========================================================================
-- 2. Supprimer l'encaissement fictif
-- =========================================================================
-- On ne « rembourse » pas (statut `rembourse`) : il n'y a jamais eu
-- d'argent. Une ligne remboursée raconterait un encaissement qui n'a pas eu
-- lieu. Le journal ne doit contenir que du réel.
DELETE FROM public.paiements
 WHERE type = 'boost'
   AND annonce_id = '7122a0b2-d2a6-44ea-ab01-e724babab6e5'
   AND date_paiement = '2026-09-01T15:25:56.641+00:00'
   AND transaction_id IS NULL;   -- jamais rapproché d'une transaction réelle

-- =========================================================================
-- 3. Garde-fou : pas d'encaissement pendant une période gratuite
-- =========================================================================
-- Le prix du boost est décidé par le téléphone. Un appareil resté sur un
-- ancien bundle JS continue d'écrire 250 sur un boost offert — le correctif
-- applicatif ne protège que les appareils à jour. La base tranche donc
-- elle-même : quand `payments_enabled` est faux, aucun boost n'est un
-- encaissement. Défaut TRUE si la config est illisible, pour ne jamais
-- perdre un vrai paiement.
CREATE OR REPLACE FUNCTION public.enregistrer_paiement_boost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.boost_paye_le IS NOT NULL
     AND COALESCE(NEW.boost_prix, 0) > 0
     AND COALESCE((SELECT payments_enabled FROM public.app_config WHERE id = 1), TRUE)
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
-- Attendu : une seule ligne, le boost de 250 F du 2026-08-31 23:23.
-- SELECT date_paiement, type, montant_fcfa, transaction_id
--   FROM public.paiements ORDER BY date_paiement DESC;
