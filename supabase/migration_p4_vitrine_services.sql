-- =========================================================================
-- VITRINE SERVICES v2 — identité, disponibilité, réalisations, devis guidé
-- Spécification du 20 août 2026 (lot « vitrine Services »). Idempotente.
-- Prérequis : migration_p2_services.sql.
-- =========================================================================
-- La première version rendait une prestation publiable sans stock et sans
-- prix ferme. Ce lot va plus loin : la page d'un prestataire doit se lire
-- comme une fiche de professionnel, pas comme une étagère de produits.
--
-- Ce que la migration ajoute :
--   1. `users.disponibilite` — « Disponible aujourd'hui », « Sur rendez-vous ».
--      C'est la première question que se pose un client qui a une fuite d'eau.
--   2. `users.verification_status` — le badge « Vérifié » cesse d'être une
--      promesse creuse et devient un état distinct du badge Pro.
--   3. `annonces.duree_indicative` et `condition_deplacement` sur une
--      prestation.
--   4. `realisations` — le portfolio avant/après, qui est ce qu'un artisan
--      montre en premier quand on lui demande ce qu'il sait faire.
--   5. la réponse du professionnel à un avis.
--   6. les champs de la demande de devis guidée en trois étapes.
--
-- ── Badge Pro et badge Vérifié : deux choses différentes ──────────────────
-- « Le badge Pro signifie abonnement actif ; le badge Vérifié signifie
-- identité ou activité contrôlée. » Les confondre trompe l'acheteur sur la
-- seule chose qui compte pour lui : peut-il faire confiance ? Aucun compte
-- n'est vérifié par défaut, et rien dans l'application ne peut accorder ce
-- statut — il se pose à la main, après contrôle.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Disponibilité du prestataire
-- =========================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS disponibilite TEXT NOT NULL DEFAULT 'rdv';

DO $$
BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_disponibilite_check
    CHECK (disponibilite IN ('aujourdhui', 'semaine', 'rdv', 'indisponible'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.users.disponibilite IS
  'aujourdhui : peut intervenir dans la journee. semaine : dans les jours qui '
  'viennent. rdv : uniquement sur rendez-vous. indisponible : ne prend pas de '
  'nouvelle demande. Choix manuel, pas de calendrier — au lancement, un '
  'agenda complet serait abandonne avant d''etre rempli.';

-- =========================================================================
-- 2. Vérification — distincte de l'abonnement
-- =========================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_note   TEXT,
  ADD COLUMN IF NOT EXISTS date_verification   TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_verification_status_check
    CHECK (verification_status IN ('unverified', 'phone_verified',
                                   'document_pending', 'verified', 'rejected', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.users.verification_status IS
  'Etat de CONTROLE, sans aucun rapport avec l''abonnement. Seul « verified » '
  'affiche le badge Verifie. Il se pose a la main apres verification reelle : '
  'aucun parcours applicatif ne l''accorde, sinon le badge redeviendrait la '
  'promesse creuse qu''il etait.';

-- =========================================================================
-- 3. Ce qui décrit une prestation
-- =========================================================================
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS duree_indicative      TEXT,
  ADD COLUMN IF NOT EXISTS condition_deplacement TEXT;

COMMENT ON COLUMN public.annonces.duree_indicative IS
  'Texte libre court : « 1 a 2 heures », « une demi-journee ». Volontairement '
  'pas un nombre de minutes : un artisan raisonne en ordre de grandeur.';

-- =========================================================================
-- 4. Réalisations — le portfolio avant/après
-- =========================================================================
-- Ce qu'un artisan montre en premier quand on lui demande ce qu'il sait
-- faire. La photo « apres » est obligatoire, la photo « avant » ne l'est pas :
-- exiger les deux ferait renoncer la moitie des prestataires.
CREATE TABLE IF NOT EXISTS public.realisations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  titre         TEXT,
  image_avant   TEXT,
  image_apres   TEXT NOT NULL,
  categorie     TEXT,
  ordre         INTEGER NOT NULL DEFAULT 0,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realisations_user
  ON public.realisations(user_id, ordre, date_creation DESC);

ALTER TABLE public.realisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Realisations visibles par tous" ON public.realisations;
CREATE POLICY "Realisations visibles par tous" ON public.realisations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Chacun gere ses realisations" ON public.realisations;
CREATE POLICY "Chacun gere ses realisations" ON public.realisations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chacun modifie ses realisations" ON public.realisations;
CREATE POLICY "Chacun modifie ses realisations" ON public.realisations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chacun supprime ses realisations" ON public.realisations;
CREATE POLICY "Chacun supprime ses realisations" ON public.realisations
  FOR DELETE USING (auth.uid() = user_id);

-- =========================================================================
-- 5. Réponse du professionnel à un avis
-- =========================================================================
-- Un avis négatif sans droit de réponse est une condamnation sans procès, et
-- le professionnel n'a alors aucune raison de rester.
ALTER TABLE public.avis
  ADD COLUMN IF NOT EXISTS reponse_pro  TEXT,
  ADD COLUMN IF NOT EXISTS date_reponse TIMESTAMPTZ;

DROP POLICY IF EXISTS "Le vendeur repond a ses avis" ON public.avis;
CREATE POLICY "Le vendeur repond a ses avis" ON public.avis
  FOR UPDATE USING (auth.uid() = vendeur_id) WITH CHECK (auth.uid() = vendeur_id);

-- =========================================================================
-- 6. Demande de devis guidée (trois étapes)
-- =========================================================================
-- Étape 1 « Besoin » : la prestation choisie — déjà porté par `produit_id`.
-- Étape 2 « Précisions » : description, photo, et plus tard message vocal.
-- Étape 3 « Intervention » : zone, date souhaitée, téléphone.
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS photo_url        TEXT,
  ADD COLUMN IF NOT EXISTS audio_url        TEXT,
  ADD COLUMN IF NOT EXISTS zone_demandee    TEXT,
  ADD COLUMN IF NOT EXISTS telephone_client TEXT;

COMMENT ON COLUMN public.commandes.audio_url IS
  'Message vocal du client. Le champ existe des maintenant pour que la base '
  'soit prete, mais l''enregistrement audio exige un module natif et donc un '
  'nouveau build : il ne peut pas arriver par mise a jour a distance.';

-- =========================================================================
-- 6 bis. La publication doit transporter les nouveaux champs
-- =========================================================================
-- `publier_annonce()` construit son INSERT colonne par colonne : tout champ
-- non cité y est silencieusement perdu. C'est ce qui avait fait disparaître
-- le rayon et le stock, puis le mode de tarification. On ajoute donc la durée
-- et la condition de déplacement, plutôt que de les découvrir absentes.
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

  v_kind_demande := p_annonce->>'listing_kind';
  IF v_droits->>'plan_code' = 'pro' THEN
    v_kind := CASE WHEN v_kind_demande = 'pro_service' THEN 'pro_service' ELSE 'pro_product' END;
  ELSIF v_droits->>'plan_code' = 'vendeur' THEN
    v_kind := 'seller_ad';
  ELSE
    v_kind := 'private_ad';
  END IF;

  v_mode_tarif := COALESCE(NULLIF(p_annonce->>'mode_tarif', ''), 'fixe');
  IF v_kind <> 'pro_service' OR v_mode_tarif NOT IN ('fixe', 'a_partir_de', 'sur_devis') THEN
    v_mode_tarif := 'fixe';
  END IF;

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
    listing_kind, mode_tarif, duree_indicative, condition_deplacement,
    stock, visible, catalogue_id,
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
    CASE WHEN v_kind = 'pro_service' THEN NULLIF(p_annonce->>'duree_indicative', '') END,
    CASE WHEN v_kind = 'pro_service' THEN NULLIF(p_annonce->>'condition_deplacement', '') END,
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
-- 7. Vérification
-- =========================================================================
SELECT disponibilite, COUNT(*) FROM public.users
WHERE type_compte = 'professionnel' GROUP BY disponibilite;

SELECT verification_status, COUNT(*) FROM public.users GROUP BY verification_status;

SELECT COUNT(*) AS realisations FROM public.realisations;

-- Pour verifier un compte a la main, apres controle reel :
-- UPDATE public.users
-- SET verification_status = 'verified',
--     date_verification = NOW(),
--     verification_note = 'Registre de commerce vu le ...'
-- WHERE id = '<user_id>';

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- DROP TABLE IF EXISTS public.realisations;
-- ALTER TABLE public.avis DROP COLUMN IF EXISTS reponse_pro, DROP COLUMN IF EXISTS date_reponse;
-- ALTER TABLE public.commandes
--   DROP COLUMN IF EXISTS photo_url, DROP COLUMN IF EXISTS audio_url,
--   DROP COLUMN IF EXISTS zone_demandee, DROP COLUMN IF EXISTS telephone_client;
-- ALTER TABLE public.annonces
--   DROP COLUMN IF EXISTS duree_indicative, DROP COLUMN IF EXISTS condition_deplacement;
-- ALTER TABLE public.users
--   DROP COLUMN IF EXISTS disponibilite, DROP COLUMN IF EXISTS verification_status,
--   DROP COLUMN IF EXISTS verification_note, DROP COLUMN IF EXISTS date_verification;
