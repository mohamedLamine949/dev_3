-- =========================================================================
-- PHASE 1b — Publication atomique côté serveur
-- Dossier directeur §12.5, §13.4, §19.3. Idempotente.
-- Prérequis : migration_p1_entitlements.sql doit être appliquée avant.
-- =========================================================================
-- Aujourd'hui, publier une annonce est un simple INSERT depuis le téléphone.
-- Trois conséquences :
--   - deux appuis rapides créent deux annonces et consomment deux crédits ;
--   - le quota n'est vérifié que dans l'interface, donc contournable ;
--   - `listing_kind` dépend du bon vouloir du client.
--
-- `publier_annonce()` reprend la main : elle verrouille le compte, relit le
-- mode de monétisation et les droits DANS LA MÊME TRANSACTION que l'insertion,
-- débite le journal de crédits, et refuse si le quota est dépassé en LIVE.
-- Une clé d'idempotence rend l'appel rejouable sans effet de bord.
--
-- Elle ne s'occupe QUE de la ligne `annonces`. Les photos continuent d'être
-- envoyées ensuite par le client, comme aujourd'hui : le flux d'upload n'est
-- pas modifié.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Colonnes de cycle de vie (§12.2)
-- -------------------------------------------------------------------------
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key  UUID;

-- Reprise : les annonces existantes ont ete publiees a leur creation.
UPDATE public.annonces
SET published_at = date_creation
WHERE published_at IS NULL AND statut = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_annonces_idempotency
  ON public.annonces(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.annonces.expires_at IS
  'Date de fin de visibilite. Volontairement NULL pour TOUTES les publications '
  '(decision produit du 2026-08-20 : rien n''expire tant que le volume est '
  'faible). La colonne existe pour que la mecanique soit prete le jour ou la '
  'decision changera, sans nouvelle migration structurelle.';

-- -------------------------------------------------------------------------
-- 2. Durée de vie par type de publication
-- -------------------------------------------------------------------------
-- Centralise la règle en un seul endroit. Aujourd'hui elle renvoie NULL pour
-- tout le monde ; le jour où l'expiration sera rouverte, c'est ICI qu'on
-- changera la valeur — et les produits de boutique resteront à NULL.
CREATE OR REPLACE FUNCTION public.duree_de_vie(p_listing_kind TEXT)
RETURNS INTERVAL AS $$
BEGIN
  RETURN CASE p_listing_kind
    -- Un produit ou une prestation de boutique ne peut JAMAIS expirer :
    -- la permanence est ce que le plan Pro achete (§5.5).
    WHEN 'pro_product' THEN NULL
    WHEN 'pro_service' THEN NULL
    -- Annonces de particulier et de vendeur : NULL aujourd'hui par decision
    -- produit. Remettre INTERVAL '30 days' pour rouvrir l'expiration.
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- -------------------------------------------------------------------------
-- 3. Publication atomique
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publier_annonce(
  p_annonce         JSONB,
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_droits       JSONB;
  v_kind         TEXT;
  v_existante    public.annonces%ROWTYPE;
  v_nouvelle_id  UUID;
  v_duree        INTERVAL;
  v_prix         NUMERIC;
  v_titre        TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUISE' USING HINT = 'Connectez-vous pour publier.';
  END IF;

  -- 3.1 Rejeu : meme cle => on renvoie l'annonce deja creee, sans rien debiter.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existante
    FROM public.annonces
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'annonce_id',   v_existante.id,
        'listing_kind', v_existante.listing_kind,
        'deja_publiee', TRUE
      );
    END IF;
  END IF;

  -- 3.2 Verrou par compte : deux appuis simultanes se serialisent ici, donc
  --     le second voit le credit deja consomme par le premier.
  PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;

  -- 3.3 Validation du contenu. On ne fait jamais confiance au client :
  --     `user_id`, `statut` et `listing_kind` sont imposes par le serveur.
  v_titre := NULLIF(TRIM(COALESCE(p_annonce->>'titre', '')), '');
  v_prix  := NULLIF(p_annonce->>'prix', '')::NUMERIC;

  IF v_titre IS NULL THEN
    RAISE EXCEPTION 'TITRE_REQUIS' USING HINT = 'Donnez un titre a votre annonce.';
  END IF;
  IF v_prix IS NULL OR v_prix < 0 THEN
    RAISE EXCEPTION 'PRIX_INVALIDE' USING HINT = 'Indiquez un prix valide.';
  END IF;
  IF NULLIF(TRIM(COALESCE(p_annonce->>'categorie', '')), '') IS NULL THEN
    RAISE EXCEPTION 'CATEGORIE_REQUISE' USING HINT = 'Choisissez une categorie.';
  END IF;

  -- 3.4 Droits relus MAINTENANT, dans la meme transaction que l'insertion.
  v_droits := public.get_effective_entitlements(v_uid);

  -- Le type de publication decoule du plan, pas de ce que dit le client.
  v_kind := CASE v_droits->>'plan_code'
              WHEN 'pro'     THEN 'pro_product'
              WHEN 'vendeur' THEN 'seller_ad'
              ELSE 'private_ad'
            END;

  -- 3.5 Blocage effectif. `peut_publier` vaut deja true hors LIVE : c'est le
  --     serveur qui decide, l'interface ne fait que l'annoncer a l'avance.
  --     Une annonce payee a l'unite porte une reference de transaction et
  --     echappe au quota.
  IF (v_droits->>'blocage_actif')::BOOLEAN
     AND NOT (v_droits->>'peut_publier')::BOOLEAN
     AND COALESCE(p_annonce->>'id_transaction_paiement', 'FREE_QUOTA')
         IN ('FREE_QUOTA', '')
  THEN
    RAISE EXCEPTION 'QUOTA_EPUISE'
      USING HINT = 'Vos credits de publication du mois sont epuises.';
  END IF;

  v_duree := public.duree_de_vie(v_kind);

  -- 3.6 Insertion
  INSERT INTO public.annonces (
    user_id, titre, description, prix, categorie, sous_categorie,
    etat_article, ville, quartier, latitude, longitude,
    statut, est_payee, id_transaction_paiement, montant_depot,
    listing_kind, stock, visible, catalogue_id,
    published_at, expires_at, idempotency_key
  ) VALUES (
    v_uid,
    v_titre,
    NULLIF(p_annonce->>'description', ''),
    v_prix,
    p_annonce->>'categorie',
    NULLIF(p_annonce->>'sous_categorie', ''),
    COALESCE(NULLIF(p_annonce->>'etat_article', ''), 'non_specifie'),
    COALESCE(NULLIF(p_annonce->>'ville', ''), 'Mali'),
    NULLIF(p_annonce->>'quartier', ''),
    NULLIF(p_annonce->>'latitude', '')::DOUBLE PRECISION,
    NULLIF(p_annonce->>'longitude', '')::DOUBLE PRECISION,
    'active',
    TRUE,
    COALESCE(NULLIF(p_annonce->>'id_transaction_paiement', ''), 'FREE_QUOTA'),
    COALESCE(NULLIF(p_annonce->>'montant_depot', ''), '0')::NUMERIC,
    v_kind,
    -- Un produit de boutique porte un stock, une visibilite et un rayon :
    -- les omettre les faisait disparaitre du catalogue a la publication.
    NULLIF(p_annonce->>'stock', '')::INTEGER,
    COALESCE(NULLIF(p_annonce->>'visible', '')::BOOLEAN, TRUE),
    NULLIF(p_annonce->>'catalogue_id', '')::UUID,
    NOW(),
    CASE WHEN v_duree IS NULL THEN NULL ELSE NOW() + v_duree END,
    p_idempotency_key
  )
  RETURNING id INTO v_nouvelle_id;

  -- 3.7 Debit du journal — uniquement pour les publications qui consomment
  --     un credit. Un produit de boutique n'en consomme pas (§5.2).
  IF v_kind IN ('private_ad', 'seller_ad') THEN
    INSERT INTO public.publication_ledger (user_id, annonce_id, delta, raison)
    VALUES (v_uid, v_nouvelle_id, -1, 'publication');
  END IF;

  -- 3.8 Etat renvoye au client, recalcule apres insertion.
  v_droits := public.get_effective_entitlements(v_uid);

  RETURN jsonb_build_object(
    'annonce_id',       v_nouvelle_id,
    'listing_kind',     v_kind,
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
-- 4. Vérification
-- =========================================================================
SELECT proname, pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN ('publier_annonce', 'duree_de_vie', 'get_effective_entitlements', 'mes_droits')
ORDER BY proname;

-- Toutes les durées de vie doivent être NULL aujourd'hui :
SELECT k AS listing_kind, public.duree_de_vie(k) AS duree_de_vie
FROM unnest(ARRAY['private_ad','seller_ad','pro_product','pro_service']) AS k;

SELECT COUNT(*) AS annonces_sans_published_at
FROM public.annonces WHERE published_at IS NULL AND statut = 'active';

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- DROP FUNCTION IF EXISTS public.publier_annonce(JSONB, UUID);
-- DROP FUNCTION IF EXISTS public.duree_de_vie(TEXT);
-- DROP INDEX IF EXISTS idx_annonces_idempotency;
-- ALTER TABLE public.annonces
--   DROP COLUMN IF EXISTS published_at,
--   DROP COLUMN IF EXISTS expires_at,
--   DROP COLUMN IF EXISTS idempotency_key;
