-- =========================================================================
-- PHASE 2 — Activité de services : prestations, zone, devis
-- Dossier directeur §4.1, §8.4, §8.5, §8.6, §12.3. Idempotente.
-- Prérequis : migration_p1_entitlements.sql (colonne listing_kind).
-- =========================================================================
-- Un menuisier, un mécanicien ou un soudeur n'a pas de « stock ». Aujourd'hui
-- il doit déguiser ses réalisations en produits avec un prix, ce qui est à la
-- fois faux et décourageant. Le §8.4 impose un modèle distinct.
--
-- Choix d'architecture : on NE crée PAS de table `prestations`. Une prestation
-- est une publication de type `pro_service` dans `annonces`, exactement comme
-- un produit de boutique est un `pro_product`. Raison : recherche, favoris,
-- messagerie, avis, signalements, images et statistiques fonctionnent déjà sur
-- `annonces` — dupliquer la table obligerait à dupliquer les huit mécaniques
-- qui s'y branchent. C'est `listing_kind` qui porte la différence, ce pour
-- quoi il a été créé.
--
-- Ce que la migration ajoute :
--   1. `users.type_activite` — produits / services / mixte (§4.1) ;
--   2. l'identité de prestataire : zone d'intervention, déplacement, délai
--      de réponse ;
--   3. `annonces.mode_tarif` — fixe / à partir de / sur devis ;
--   4. le circuit de demande de devis, greffé sur `commandes` (§8.6).
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Type d'activité (§4.1)
-- =========================================================================
-- Axe INDÉPENDANT du plan commercial et de l'identité du compte : un
-- prestataire peut être au plan gratuit, une entreprise peut vendre des
-- produits. On cesse de coder la logique commerciale dans un champ identitaire.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS type_activite     TEXT NOT NULL DEFAULT 'produits',
  ADD COLUMN IF NOT EXISTS zone_intervention TEXT,
  ADD COLUMN IF NOT EXISTS accepte_deplacement BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS delai_reponse     TEXT;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_type_activite_check
    CHECK (type_activite IN ('produits', 'services', 'mixte'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.users.type_activite IS
  'produits / services / mixte. Configure les formulaires et la vitrine, '
  'independamment du plan paye et du type de compte (§4.1).';
COMMENT ON COLUMN public.users.zone_intervention IS
  'Zone ou le prestataire se deplace, en texte libre (« Bamako et environs »). '
  'Jamais une adresse exacte : le §9.6 interdit de l''exposer.';

-- =========================================================================
-- 2. Mode de tarification d'une prestation (§8.4)
-- =========================================================================
-- « Prix fixe, negociable ou sur devis » (§7.6). Un prestataire qui ne peut
-- pas annoncer un prix ferme doit pouvoir publier quand meme : sans cela il
-- invente un prix faux, et l'acheteur se sent trompe au premier contact.
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS mode_tarif TEXT NOT NULL DEFAULT 'fixe';

DO $$
BEGIN
  ALTER TABLE public.annonces
    ADD CONSTRAINT annonces_mode_tarif_check
    CHECK (mode_tarif IN ('fixe', 'a_partir_de', 'sur_devis'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.annonces.mode_tarif IS
  'fixe : le prix affiche est le prix. a_partir_de : point de depart. '
  'sur_devis : le prix n''est pas affiche, seul le contact compte.';

-- =========================================================================
-- 3. Demandes de devis (§8.6)
-- =========================================================================
-- Le circuit produit et le circuit service partagent la meme table : ce sont
-- deux accords commerciaux a confirmer entre deux personnes, sans encaissement.
-- Seuls les statuts different, d'ou la colonne `type_demande`.
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS type_demande  TEXT NOT NULL DEFAULT 'commande',
  ADD COLUMN IF NOT EXISTS montant_devis INTEGER,
  ADD COLUMN IF NOT EXISTS date_souhaitee DATE;

DO $$
BEGIN
  ALTER TABLE public.commandes
    ADD CONSTRAINT commandes_type_demande_check
    CHECK (type_demande IN ('commande', 'devis'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- Elargir les statuts : le circuit service a ses propres etapes.
--   produits : nouvelle -> confirmee -> livree                (+ refusee, annulee)
--   services : nouvelle -> precisions -> devis_envoye -> accepte -> en_cours
--              -> termine                                     (+ refusee, annulee)
DO $$
DECLARE nom_contrainte TEXT;
BEGIN
  SELECT conname INTO nom_contrainte
  FROM pg_constraint
  WHERE conrelid = 'public.commandes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%statut%'
    AND pg_get_constraintdef(oid) ILIKE '%nouvelle%';

  IF nom_contrainte IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.commandes DROP CONSTRAINT %I', nom_contrainte);
  END IF;
END;
$$;

ALTER TABLE public.commandes
  ADD CONSTRAINT commandes_statut_check
  CHECK (statut IN (
    'nouvelle', 'confirmee', 'livree', 'refusee', 'annulee',
    'precisions', 'devis_envoye', 'accepte', 'en_cours', 'termine'
  ));

-- `prix` reste NOT NULL : une demande de devis y stocke 0 tant qu'aucun
-- montant n'est propose. Le montant reellement chiffre va dans `montant_devis`.
COMMENT ON COLUMN public.commandes.montant_devis IS
  'Montant chiffre par le prestataire, renseigne au passage en devis_envoye. '
  'Distinct de `prix`, qui vaut 0 pour une demande de devis initiale.';

-- =========================================================================
-- 4. Reprise de l'existant
-- =========================================================================
-- Les boutiques deja en ligne vendent des produits : c'est la valeur par
-- defaut, rien a faire.
--
-- Une seule categorie metier existante releve du service : « Professionnels du
-- metier ». On la bascule en `mixte` et non en `services`, volontairement :
-- ces comptes ont deja publie des articles avec un prix, qui restent
-- parfaitement valides comme produits. Les basculer en `services` ferait
-- disparaitre leur catalogue existant derriere un onglet vide.
UPDATE public.users
SET type_activite = 'mixte'
WHERE type_compte = 'professionnel'
  AND type_activite = 'produits'
  AND categorie_metier = 'professionnels_metier';

-- Aucune publication existante n'est convertie en prestation. Ce que le
-- vendeur a saisi comme un produit reste un produit ; seules les prestations
-- creees via le nouveau formulaire portent `pro_service`. Convertir
-- automatiquement reviendrait a reinterpreter son travail a sa place.

COMMIT;

-- =========================================================================
-- 5. Vérification
-- =========================================================================
SELECT type_activite, COUNT(*) FROM public.users
WHERE type_compte = 'professionnel' GROUP BY type_activite;

SELECT listing_kind, COUNT(*) FROM public.annonces GROUP BY listing_kind ORDER BY 2 DESC;

SELECT mode_tarif, COUNT(*) FROM public.annonces GROUP BY mode_tarif;

SELECT pg_get_constraintdef(oid) AS statuts_autorises
FROM pg_constraint WHERE conname = 'commandes_statut_check';

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- Aucune donnée n'est détruite ; le retour arrière retire les ajouts.
-- Attention : rétablir l'ancienne contrainte de statut échouera s'il existe
-- déjà des demandes de devis. Les repasser en 'annulee' d'abord.
--
-- ALTER TABLE public.commandes DROP CONSTRAINT IF EXISTS commandes_statut_check;
-- ALTER TABLE public.commandes
--   ADD CONSTRAINT commandes_statut_check
--   CHECK (statut IN ('nouvelle','confirmee','livree','refusee','annulee'));
-- ALTER TABLE public.commandes
--   DROP COLUMN IF EXISTS type_demande,
--   DROP COLUMN IF EXISTS montant_devis,
--   DROP COLUMN IF EXISTS date_souhaitee;
-- ALTER TABLE public.annonces DROP COLUMN IF EXISTS mode_tarif;
-- ALTER TABLE public.users
--   DROP COLUMN IF EXISTS type_activite,
--   DROP COLUMN IF EXISTS zone_intervention,
--   DROP COLUMN IF EXISTS accepte_deplacement,
--   DROP COLUMN IF EXISTS delai_reponse;
