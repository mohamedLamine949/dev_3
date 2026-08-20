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

-- =========================================================================
-- 4 bis. La publication atomique doit connaître les prestations
-- =========================================================================
-- `publier_annonce()` (phase 1b) imposait `pro_product` à tout compte PRO et
-- ignorait `mode_tarif` : une prestation « sur devis » aurait été enregistrée
-- comme un produit à prix fixe de 0 FCFA. On la remplace pour qu'elle
-- reconnaisse le type demandé et le mode de tarification.
CREATE OR REPLACE FUNCTION public.publier_annonce(
  p_annonce         JSONB,
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_droits       JSONB;
  v_kind         TEXT;
  v_kind_demande TEXT;
  v_mode_tarif   TEXT;
  v_existante    public.annonces%ROWTYPE;
  v_nouvelle_id  UUID;
  v_duree        INTERVAL;
  v_prix         NUMERIC;
  v_titre        TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUISE' USING HINT = 'Connectez-vous pour publier.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existante FROM public.annonces WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'annonce_id', v_existante.id, 'listing_kind', v_existante.listing_kind, 'deja_publiee', TRUE);
    END IF;
  END IF;

  PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;

  v_titre := NULLIF(TRIM(COALESCE(p_annonce->>'titre', '')), '');
  v_prix  := COALESCE(NULLIF(p_annonce->>'prix', ''), '0')::NUMERIC;

  IF v_titre IS NULL THEN
    RAISE EXCEPTION 'TITRE_REQUIS' USING HINT = 'Donnez un titre a votre annonce.';
  END IF;
  IF v_prix < 0 THEN
    RAISE EXCEPTION 'PRIX_INVALIDE' USING HINT = 'Indiquez un prix valide.';
  END IF;
  IF NULLIF(TRIM(COALESCE(p_annonce->>'categorie', '')), '') IS NULL THEN
    RAISE EXCEPTION 'CATEGORIE_REQUISE' USING HINT = 'Choisissez une categorie.';
  END IF;

  v_droits := public.get_effective_entitlements(v_uid);

  -- Le client peut DEMANDER une prestation ; il ne peut pas s'auto-attribuer
  -- un type reserve au plan Pro. Le serveur arbitre.
  v_kind_demande := p_annonce->>'listing_kind';
  IF v_droits->>'plan_code' = 'pro' THEN
    v_kind := CASE WHEN v_kind_demande = 'pro_service' THEN 'pro_service' ELSE 'pro_product' END;
  ELSIF v_droits->>'plan_code' = 'vendeur' THEN
    v_kind := 'seller_ad';
  ELSE
    v_kind := 'private_ad';
  END IF;

  -- Le mode de tarification n'a de sens que pour une prestation.
  v_mode_tarif := COALESCE(NULLIF(p_annonce->>'mode_tarif', ''), 'fixe');
  IF v_kind <> 'pro_service' OR v_mode_tarif NOT IN ('fixe', 'a_partir_de', 'sur_devis') THEN
    v_mode_tarif := 'fixe';
  END IF;

  -- Un prix nul n'est acceptable que « sur devis ».
  IF v_prix = 0 AND v_mode_tarif <> 'sur_devis' THEN
    RAISE EXCEPTION 'PRIX_INVALIDE' USING HINT = 'Indiquez un prix, ou choisissez « sur devis ».';
  END IF;

  IF (v_droits->>'blocage_actif')::BOOLEAN
     AND NOT (v_droits->>'peut_publier')::BOOLEAN
     AND COALESCE(p_annonce->>'id_transaction_paiement', 'FREE_QUOTA') IN ('FREE_QUOTA', '')
  THEN
    RAISE EXCEPTION 'QUOTA_EPUISE' USING HINT = 'Vos credits de publication du mois sont epuises.';
  END IF;

  v_duree := public.duree_de_vie(v_kind);

  INSERT INTO public.annonces (
    user_id, titre, description, prix, categorie, sous_categorie,
    etat_article, ville, quartier, latitude, longitude,
    statut, est_payee, id_transaction_paiement, montant_depot,
    listing_kind, mode_tarif, stock, visible, catalogue_id,
    published_at, expires_at, idempotency_key
  ) VALUES (
    v_uid, v_titre,
    NULLIF(p_annonce->>'description', ''),
    v_prix,
    p_annonce->>'categorie',
    NULLIF(p_annonce->>'sous_categorie', ''),
    COALESCE(NULLIF(p_annonce->>'etat_article', ''), 'non_specifie'),
    COALESCE(NULLIF(p_annonce->>'ville', ''), 'Mali'),
    NULLIF(p_annonce->>'quartier', ''),
    NULLIF(p_annonce->>'latitude', '')::DOUBLE PRECISION,
    NULLIF(p_annonce->>'longitude', '')::DOUBLE PRECISION,
    'active', TRUE,
    COALESCE(NULLIF(p_annonce->>'id_transaction_paiement', ''), 'FREE_QUOTA'),
    COALESCE(NULLIF(p_annonce->>'montant_depot', ''), '0')::NUMERIC,
    v_kind, v_mode_tarif,
    -- Une prestation n'a pas de stock : NULL, jamais 0 qui afficherait
    -- « Rupture » sur la vitrine.
    CASE WHEN v_kind = 'pro_service' THEN NULL
         ELSE NULLIF(p_annonce->>'stock', '')::INTEGER END,
    COALESCE(NULLIF(p_annonce->>'visible', '')::BOOLEAN, TRUE),
    NULLIF(p_annonce->>'catalogue_id', '')::UUID,
    NOW(),
    CASE WHEN v_duree IS NULL THEN NULL ELSE NOW() + v_duree END,
    p_idempotency_key
  )
  RETURNING id INTO v_nouvelle_id;

  IF v_kind IN ('private_ad', 'seller_ad') THEN
    INSERT INTO public.publication_ledger (user_id, annonce_id, delta, raison)
    VALUES (v_uid, v_nouvelle_id, -1, 'publication');
  END IF;

  v_droits := public.get_effective_entitlements(v_uid);

  RETURN jsonb_build_object(
    'annonce_id',       v_nouvelle_id,
    'listing_kind',     v_kind,
    'mode_tarif',       v_mode_tarif,
    'deja_publiee',     FALSE,
    'credits_restants', v_droits->'credits_restants',
    'credits_utilises', v_droits->'credits_utilises'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.publier_annonce(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_annonce(JSONB, UUID) TO authenticated;

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
