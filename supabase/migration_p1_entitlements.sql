-- =========================================================================
-- PHASE 1 — Socle métier : plans, droits effectifs, modes de monétisation
-- Dossier directeur §5, §11.1, §11.3, §12.2, §12.3. Idempotente.
-- =========================================================================
-- NE CHANGE AUCUN COMPORTEMENT VISIBLE. Tant que `monetization_mode` vaut
-- FREE_LAUNCH, `get_effective_entitlements()` renvoie exactement ce que
-- l'application fait déjà : publication libre, aucun quota, aucun blocage.
-- Cette migration installe la plomberie ; l'activation se fera plus tard en
-- changeant une seule valeur.
--
-- Ce qu'elle apporte :
--   1. `monetization_mode` à 5 valeurs, avec `payments_enabled` maintenu en
--      miroir pour que les anciennes versions de l'app continuent de marcher ;
--   2. les tables `plans` et `plan_entitlements` (droits versionnés) ;
--   3. `subscriptions`, alimentée sans perte depuis users.type_compte ;
--   4. `listing_kind` sur `annonces` : une annonce de particulier et un
--      produit de boutique cessent d'être indiscernables ;
--   5. `publication_ledger` : le journal des crédits consommés ;
--   6. `get_effective_entitlements(user_id)` — SOURCE UNIQUE des droits ;
--   7. `v_entitlements_publics` — ce que les autres utilisateurs ont le droit
--      de savoir d'un compte (badge Pro, rien d'autre).
--
-- Rappel de la décision produit du 2026-08-20 : rien n'expire. `listing_kind`
-- est ajouté parce que la distinction sert à bien d'autres choses que
-- l'expiration (quotas, vitrine, recherche, boosts) — pas pour rouvrir
-- l'expiration, qui reste déplanifiée.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Mode de monétisation (§11.1)
-- =========================================================================
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS monetization_mode TEXT NOT NULL DEFAULT 'FREE_LAUNCH',
  ADD COLUMN IF NOT EXISTS config_version    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pro_grace_hours   INTEGER NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS minimum_monetization_safe_version TEXT;

DO $$
BEGIN
  ALTER TABLE public.app_config
    ADD CONSTRAINT app_config_monetization_mode_check
    CHECK (monetization_mode IN ('FREE_LAUNCH','SHADOW','SOFT_PAYWALL','LIVE','PAUSED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.app_config.monetization_mode IS
  'FREE_LAUNCH: aucun blocage. SHADOW: quotas calcules et journalises, aucun blocage. '
  'SOFT_PAYWALL: offre visible, publication encore autorisee. LIVE: tout applique. '
  'PAUSED: aucun nouveau paiement, droits deja payes conserves.';

-- Alignement initial sur l'etat reel : payments_enabled=false => FREE_LAUNCH.
UPDATE public.app_config
SET monetization_mode = CASE WHEN payments_enabled THEN 'LIVE' ELSE 'FREE_LAUNCH' END
WHERE id = 1 AND monetization_mode = 'FREE_LAUNCH' AND payments_enabled IS TRUE;

-- Miroir descendant : une ancienne version de l'app ne lit que
-- `payments_enabled`. On le maintient synchronise pour qu'elle se comporte
-- correctement sans mise a jour (§13.6).
CREATE OR REPLACE FUNCTION public.sync_payments_enabled()
RETURNS TRIGGER AS $$
BEGIN
  -- Une ancienne version de l'app ne connait qu'un booleen bloquant/non
  -- bloquant : on ne le met a true que pour LIVE, sinon SOFT_PAYWALL
  -- bloquerait chez elle alors qu'il ne doit qu'afficher l'offre.
  NEW.payments_enabled := (NEW.monetization_mode = 'LIVE');
  NEW.config_version   := COALESCE(OLD.config_version, 0) + 1;
  NEW.updated_at       := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_payments_enabled ON public.app_config;
CREATE TRIGGER trg_sync_payments_enabled
  BEFORE UPDATE OF monetization_mode ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.sync_payments_enabled();

-- =========================================================================
-- 2. Plans et droits (§5.1, §12.2)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.plans (
  code         TEXT PRIMARY KEY,
  nom          TEXT    NOT NULL,
  prix_fcfa    INTEGER NOT NULL DEFAULT 0,
  duree_jours  INTEGER NOT NULL DEFAULT 30,
  ordre        INTEGER NOT NULL DEFAULT 0,
  actif        BOOLEAN NOT NULL DEFAULT TRUE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Droits versionnes : on ne modifie jamais une version, on en cree une
-- nouvelle. Un abonnement paye garde les droits de sa version.
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id                 BIGSERIAL PRIMARY KEY,
  plan_code          TEXT NOT NULL REFERENCES public.plans(code) ON DELETE CASCADE,
  version            INTEGER NOT NULL DEFAULT 1,
  credits_mensuels   INTEGER,              -- NULL = illimite
  peut_avoir_boutique BOOLEAN NOT NULL DEFAULT FALSE,
  peut_voir_stats    BOOLEAN NOT NULL DEFAULT FALSE,
  credits_boost      INTEGER NOT NULL DEFAULT 0,
  badge_public       TEXT    NOT NULL DEFAULT 'aucun'
                     CHECK (badge_public IN ('aucun', 'pro')),
  plafond_publications_actives INTEGER,    -- fair use invisible (§5.3)
  date_creation      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_code, version)
);

INSERT INTO public.plans (code, nom, prix_fcfa, duree_jours, ordre) VALUES
  ('gratuit', 'Flash Gratuit',  0,    30, 0),
  ('vendeur', 'Flash Vendeur',  2000, 30, 1),
  ('pro',     'Flash Pro',      5000, 30, 2)
ON CONFLICT (code) DO UPDATE
  SET nom = EXCLUDED.nom, prix_fcfa = EXCLUDED.prix_fcfa,
      duree_jours = EXCLUDED.duree_jours, ordre = EXCLUDED.ordre;

-- Valeurs du §5.1 : 3 credits au lancement, 15 pour Vendeur (et non 30 :
-- le document recommande de demarrer bas tant que la marketplace est petite),
-- Pro etendu sous fair use.
INSERT INTO public.plan_entitlements
  (plan_code, version, credits_mensuels, peut_avoir_boutique, peut_voir_stats,
   credits_boost, badge_public, plafond_publications_actives)
VALUES
  ('gratuit', 1, 3,    FALSE, FALSE, 0, 'aucun', NULL),
  ('vendeur', 1, 15,   FALSE, TRUE,  2, 'aucun', NULL),
  ('pro',     1, NULL, TRUE,  TRUE,  5, 'pro',   500)
ON CONFLICT (plan_code, version) DO UPDATE
  SET credits_mensuels    = EXCLUDED.credits_mensuels,
      peut_avoir_boutique = EXCLUDED.peut_avoir_boutique,
      peut_voir_stats     = EXCLUDED.peut_voir_stats,
      credits_boost       = EXCLUDED.credits_boost,
      badge_public        = EXCLUDED.badge_public,
      plafond_publications_actives = EXCLUDED.plafond_publications_actives;

-- =========================================================================
-- 3. Abonnements (§12.2)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_code     TEXT NOT NULL REFERENCES public.plans(code),
  plan_version  INTEGER NOT NULL DEFAULT 1,
  statut        TEXT NOT NULL DEFAULT 'active'
                CHECK (statut IN ('pending','active','grace','expired','cancelled','refunded')),
  valid_from    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until   TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL DEFAULT 'paiementpro',
  transaction_id TEXT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_valid
  ON public.subscriptions(user_id, valid_until DESC);

-- Reprise sans perte de l'existant : chaque compte payant connu recoit un
-- abonnement correspondant a ce qu'il a deja paye. `users.type_compte` et
-- `users.date_abonnement` ne sont NI modifies NI supprimes — ils restent la
-- reference tant que le client n'a pas bascule.
INSERT INTO public.subscriptions (user_id, plan_code, valid_from, valid_until, statut, source)
SELECT u.id,
       CASE u.type_compte WHEN 'professionnel' THEN 'pro' ELSE 'vendeur' END,
       u.date_abonnement,
       u.date_abonnement + INTERVAL '30 days',
       CASE WHEN u.date_abonnement + INTERVAL '30 days' > NOW() THEN 'active' ELSE 'expired' END,
       'reprise_migration'
FROM public.users u
WHERE u.type_compte IN ('vendeur', 'professionnel')
  AND u.date_abonnement IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = u.id AND s.source = 'reprise_migration'
  );

-- =========================================================================
-- 4. Type de publication (§12.3) — la distinction qui manquait
-- =========================================================================
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS listing_kind TEXT;

DO $$
BEGIN
  ALTER TABLE public.annonces
    ADD CONSTRAINT annonces_listing_kind_check
    CHECK (listing_kind IS NULL OR listing_kind IN
           ('private_ad','seller_ad','pro_product','pro_service'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- Reprise : le type se deduit du proprietaire au moment de la migration.
UPDATE public.annonces a
SET listing_kind = CASE u.type_compte
                     WHEN 'professionnel' THEN 'pro_product'
                     WHEN 'vendeur'       THEN 'seller_ad'
                     ELSE 'private_ad'
                   END
FROM public.users u
WHERE u.id = a.user_id AND a.listing_kind IS NULL;

-- Les annonces orphelines (proprietaire supprime) restent des annonces privees.
UPDATE public.annonces SET listing_kind = 'private_ad' WHERE listing_kind IS NULL;

ALTER TABLE public.annonces ALTER COLUMN listing_kind SET DEFAULT 'private_ad';

CREATE INDEX IF NOT EXISTS idx_annonces_listing_kind
  ON public.annonces(listing_kind, statut);

COMMENT ON COLUMN public.annonces.listing_kind IS
  'private_ad / seller_ad / pro_product / pro_service. Permet de ne plus traiter '
  'un produit de boutique comme une annonce jetable. Aucune expiration n''est '
  'active a ce jour (decision produit du 2026-08-20).';

-- =========================================================================
-- 5. Journal des credits de publication (§12.2)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.publication_ledger (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  annonce_id   UUID REFERENCES public.annonces(id) ON DELETE SET NULL,
  delta        INTEGER NOT NULL,          -- -1 = credit consomme, +1 = rendu
  raison       TEXT NOT NULL,             -- publication / remboursement / offert
  periode      DATE NOT NULL DEFAULT date_trunc('month', NOW())::DATE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publication_ledger_user_periode
  ON public.publication_ledger(user_id, periode);

-- =========================================================================
-- 6. SOURCE UNIQUE DES DROITS (§11.3)
-- =========================================================================
-- Toute surface — publication, badge, annuaire, boutique, statistiques —
-- doit passer par ici. Le client n'a plus le droit de decider seul.
CREATE OR REPLACE FUNCTION public.get_effective_entitlements(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_mode         TEXT;
  v_grace_hours  INTEGER;
  v_sub          RECORD;
  v_ent          RECORD;
  v_plan_code    TEXT := 'gratuit';
  v_statut       TEXT := 'aucun';
  v_valid_until  TIMESTAMPTZ;
  v_utilises     INTEGER := 0;
  v_debut_mois   TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  SELECT monetization_mode, pro_grace_hours
    INTO v_mode, v_grace_hours
  FROM public.app_config WHERE id = 1;

  v_mode        := COALESCE(v_mode, 'FREE_LAUNCH');
  v_grace_hours := COALESCE(v_grace_hours, 72);

  -- ------------------------------------------------------------------
  -- OVERLAY DE LANCEMENT (§12.4)
  -- ------------------------------------------------------------------
  -- Tant qu'on ne facture personne, le statut declare suffit : on ne verifie
  -- AUCUNE date. Sans cela, un compte passe PRO pendant la phase gratuite
  -- perdrait sa boutique et sa place dans l'annuaire au bout de 30 jours,
  -- sanctionne pour un abonnement qu'on ne lui demande pas encore.
  -- Constat du 2026-08-20 qui a motive ce garde-fou : sur 12 comptes PRO,
  -- 1 n'a aucune date d'abonnement et 9 arrivaient a echeance sous 7 jours.
  IF v_mode IN ('FREE_LAUNCH', 'SHADOW') THEN
    SELECT CASE u.type_compte
             WHEN 'professionnel' THEN 'pro'
             WHEN 'vendeur'       THEN 'vendeur'
             ELSE 'gratuit'
           END
      INTO v_plan_code
    FROM public.users u WHERE u.id = p_user_id;

    v_plan_code := COALESCE(v_plan_code, 'gratuit');
    v_statut    := CASE WHEN v_plan_code = 'gratuit' THEN 'aucun' ELSE 'lancement' END;

    SELECT * INTO v_ent
    FROM public.plan_entitlements
    WHERE plan_code = v_plan_code
    ORDER BY version DESC LIMIT 1;

    SELECT COUNT(*) INTO v_utilises
    FROM public.annonces a
    WHERE a.user_id = p_user_id
      AND a.date_creation >= v_debut_mois
      AND COALESCE(a.listing_kind, 'private_ad') IN ('private_ad', 'seller_ad');

    RETURN jsonb_build_object(
      'user_id',            p_user_id,
      'monetization_mode',  v_mode,
      'plan_code',          v_plan_code,
      'plan_statut',        v_statut,
      'valid_until',        NULL,
      'en_grace',           FALSE,
      'paywall_visible',    FALSE,
      'blocage_actif',      FALSE,
      'credits_mensuels',   v_ent.credits_mensuels,
      'credits_utilises',   v_utilises,
      'credits_restants',   CASE WHEN v_ent.credits_mensuels IS NULL THEN NULL
                                 ELSE GREATEST(v_ent.credits_mensuels - v_utilises, 0) END,
      'peut_publier',       TRUE,
      'peut_avoir_boutique', COALESCE(v_ent.peut_avoir_boutique, FALSE),
      'peut_voir_stats',     COALESCE(v_ent.peut_voir_stats, FALSE),
      'credits_boost',       COALESCE(v_ent.credits_boost, 0),
      'badge_public',        COALESCE(v_ent.badge_public, 'aucun'),
      'prochaine_remise_a_zero', (v_debut_mois + INTERVAL '1 month')
    );
  END IF;

  -- ------------------------------------------------------------------
  -- Monetisation active : la date fait foi.
  -- ------------------------------------------------------------------
  -- Abonnement le plus favorable encore dans sa fenetre (grace comprise).
  SELECT s.plan_code, s.plan_version, s.valid_until
    INTO v_sub
  FROM public.subscriptions s
  JOIN public.plans p ON p.code = s.plan_code
  WHERE s.user_id = p_user_id
    AND s.statut IN ('active', 'grace')
    AND s.valid_until + (v_grace_hours || ' hours')::INTERVAL > NOW()
  ORDER BY p.ordre DESC, s.valid_until DESC
  LIMIT 1;

  IF v_sub.plan_code IS NOT NULL THEN
    v_plan_code   := v_sub.plan_code;
    v_valid_until := v_sub.valid_until;
    v_statut      := CASE WHEN v_sub.valid_until > NOW() THEN 'actif' ELSE 'grace' END;
  ELSE
    -- Repli sur l'ancien modele tant que tous les comptes n'ont pas
    -- d'abonnement en base (comptes crees hors du nouveau parcours).
    SELECT CASE u.type_compte WHEN 'professionnel' THEN 'pro'
                              WHEN 'vendeur'       THEN 'vendeur'
                              ELSE 'gratuit' END,
           u.date_abonnement + INTERVAL '30 days'
      INTO v_plan_code, v_valid_until
    FROM public.users u WHERE u.id = p_user_id;

    v_plan_code := COALESCE(v_plan_code, 'gratuit');

    IF v_plan_code <> 'gratuit' THEN
      IF v_valid_until IS NULL OR v_valid_until + (v_grace_hours || ' hours')::INTERVAL <= NOW() THEN
        v_plan_code := 'gratuit';
        v_statut    := 'expire';
      ELSE
        v_statut := CASE WHEN v_valid_until > NOW() THEN 'actif' ELSE 'grace' END;
      END IF;
    END IF;
  END IF;

  SELECT * INTO v_ent
  FROM public.plan_entitlements
  WHERE plan_code = v_plan_code
  ORDER BY version DESC LIMIT 1;

  -- Consommation du mois : les publications de type annonce uniquement.
  -- Un produit de boutique ne consomme pas de credit de publication.
  SELECT COUNT(*) INTO v_utilises
  FROM public.annonces a
  WHERE a.user_id = p_user_id
    AND a.date_creation >= v_debut_mois
    AND COALESCE(a.listing_kind, 'private_ad') IN ('private_ad', 'seller_ad');

  RETURN jsonb_build_object(
    'user_id',            p_user_id,
    'monetization_mode',  v_mode,
    'plan_code',          v_plan_code,
    'plan_statut',        v_statut,
    'valid_until',        v_valid_until,
    'en_grace',           (v_statut = 'grace'),
    -- Deux notions distinctes (§11.1) :
    --  - paywall_visible : on montre l'offre et le decompte de credits ;
    --  - blocage_actif   : on refuse effectivement la publication.
    -- En SOFT_PAYWALL l'offre s'affiche mais la publication reste autorisee ;
    -- seul LIVE bloque. FREE_LAUNCH et SHADOW ne montrent ni ne bloquent.
    'paywall_visible',    (v_mode IN ('SOFT_PAYWALL', 'LIVE')),
    'blocage_actif',      (v_mode = 'LIVE'),
    'credits_mensuels',   v_ent.credits_mensuels,
    'credits_utilises',   v_utilises,
    'credits_restants',   CASE WHEN v_ent.credits_mensuels IS NULL THEN NULL
                               ELSE GREATEST(v_ent.credits_mensuels - v_utilises, 0) END,
    'peut_publier',       (v_mode <> 'LIVE')
                          OR v_ent.credits_mensuels IS NULL
                          OR v_utilises < v_ent.credits_mensuels,
    'peut_avoir_boutique', COALESCE(v_ent.peut_avoir_boutique, FALSE),
    'peut_voir_stats',     COALESCE(v_ent.peut_voir_stats, FALSE),
    'credits_boost',       COALESCE(v_ent.credits_boost, 0),
    'badge_public',        COALESCE(v_ent.badge_public, 'aucun'),
    'prochaine_remise_a_zero', (v_debut_mois + INTERVAL '1 month')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Un utilisateur ne lit que ses propres droits ; le service les lit tous.
CREATE OR REPLACE FUNCTION public.mes_droits()
RETURNS JSONB AS $$
  SELECT public.get_effective_entitlements(auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_effective_entitlements(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_droits() TO authenticated;

-- =========================================================================
-- 7. Ce que le public a le droit de savoir d'un compte (§11.7)
-- =========================================================================
-- Le badge Pro, l'annuaire et le bonus de recherche doivent lire CECI et non
-- `users.type_compte` : sinon un abonnement expire garde ses avantages
-- publics. Aucune donnee de quota ni de paiement n'est exposee.
CREATE OR REPLACE VIEW public.v_entitlements_publics AS
SELECT
  u.id AS user_id,
  -- Overlay de lancement : tant qu'on ne facture personne, le statut declare
  -- suffit. Sinon une boutique disparaitrait de l'annuaire pour non-paiement
  -- d'un abonnement qu'on ne lui reclame pas (§12.4).
  CASE WHEN c.mode IN ('FREE_LAUNCH', 'SHADOW') THEN
    CASE u.type_compte
      WHEN 'professionnel' THEN 'pro'
      WHEN 'vendeur'       THEN 'vendeur'
      ELSE 'gratuit'
    END
  ELSE COALESCE(
    (SELECT p.code
     FROM public.subscriptions s
     JOIN public.plans p ON p.code = s.plan_code
     WHERE s.user_id = u.id
       AND s.statut IN ('active','grace')
       AND s.valid_until + (COALESCE(c.pro_grace_hours, 72) || ' hours')::INTERVAL > NOW()
     ORDER BY p.ordre DESC LIMIT 1),
    CASE
      WHEN u.type_compte = 'professionnel'
       AND u.date_abonnement IS NOT NULL
       AND u.date_abonnement + INTERVAL '30 days'
           + (COALESCE(c.pro_grace_hours, 72) || ' hours')::INTERVAL > NOW()
      THEN 'pro'
      WHEN u.type_compte = 'vendeur'
       AND u.date_abonnement IS NOT NULL
       AND u.date_abonnement + INTERVAL '30 days'
           + (COALESCE(c.pro_grace_hours, 72) || ' hours')::INTERVAL > NOW()
      THEN 'vendeur'
      ELSE 'gratuit'
    END
  ) END AS plan_public
FROM public.users u
CROSS JOIN LATERAL (
  -- COALESCE et non un simple SELECT : si la ligne de configuration venait a
  -- manquer, un CROSS JOIN classique renverrait zero ligne et ferait
  -- disparaitre TOUS les badges Pro d'un coup.
  SELECT COALESCE((SELECT ac.pro_grace_hours FROM public.app_config ac WHERE ac.id = 1), 72)
         AS pro_grace_hours,
         COALESCE((SELECT ac.monetization_mode FROM public.app_config ac WHERE ac.id = 1), 'FREE_LAUNCH')
         AS mode
) c;

GRANT SELECT ON public.v_entitlements_publics TO anon, authenticated;

COMMENT ON VIEW public.v_entitlements_publics IS
  'Plan reellement valide d''un compte, grace comprise. Toute surface publique '
  '(badge Pro, annuaire Decouverte Pro, bonus de recherche) doit lire cette vue '
  'et jamais users.type_compte, qui ne verifie aucune date.';

-- =========================================================================
-- 8. Verrouillage : personne ne s'octroie de droits depuis le client (§13.2)
-- =========================================================================
ALTER TABLE public.plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_ledger ENABLE ROW LEVEL SECURITY;

-- Les tarifs sont publics : l'ecran d'abonnement doit pouvoir les afficher.
DROP POLICY IF EXISTS "plans lisibles par tous" ON public.plans;
CREATE POLICY "plans lisibles par tous" ON public.plans FOR SELECT USING (actif);

DROP POLICY IF EXISTS "droits de plan lisibles par tous" ON public.plan_entitlements;
CREATE POLICY "droits de plan lisibles par tous" ON public.plan_entitlements FOR SELECT USING (true);

-- Un utilisateur voit ses abonnements et son journal, sans jamais les ecrire.
DROP POLICY IF EXISTS "chacun lit ses abonnements" ON public.subscriptions;
CREATE POLICY "chacun lit ses abonnements" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chacun lit son journal de credits" ON public.publication_ledger;
CREATE POLICY "chacun lit son journal de credits" ON public.publication_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Aucune policy d'INSERT/UPDATE/DELETE : seules les fonctions SECURITY
-- DEFINER et le role service ecrivent dans ces tables.

COMMIT;

-- =========================================================================
-- 9. Verification — a lire apres execution
-- =========================================================================
SELECT monetization_mode, payments_enabled, config_version, pro_grace_hours
FROM public.app_config WHERE id = 1;

SELECT p.code, p.prix_fcfa, e.credits_mensuels, e.peut_avoir_boutique, e.badge_public
FROM public.plans p
JOIN public.plan_entitlements e ON e.plan_code = p.code
ORDER BY p.ordre;

SELECT listing_kind, COUNT(*) FROM public.annonces GROUP BY listing_kind ORDER BY 2 DESC;

SELECT plan_public, COUNT(*) FROM public.v_entitlements_publics GROUP BY plan_public;

-- Droits effectifs d'un compte PRO au hasard (doit montrer peut_publier=true
-- et blocage_actif=false tant qu'on est en FREE_LAUNCH) :
SELECT public.get_effective_entitlements(id)
FROM public.users WHERE type_compte = 'professionnel' LIMIT 1;

-- =========================================================================
-- ROLLBACK (a n'executer que pour annuler entierement cette migration)
-- =========================================================================
-- Aucune donnee existante n'a ete modifiee : users, annonces et catalogues
-- sont intacts, `listing_kind` est une colonne ajoutee. Le retour arriere
-- consiste donc a retirer ce qui a ete ajoute, jamais a restaurer.
--
-- DROP VIEW IF EXISTS public.v_entitlements_publics;
-- DROP FUNCTION IF EXISTS public.mes_droits();
-- DROP FUNCTION IF EXISTS public.get_effective_entitlements(UUID);
-- DROP TRIGGER IF EXISTS trg_sync_payments_enabled ON public.app_config;
-- DROP FUNCTION IF EXISTS public.sync_payments_enabled();
-- DROP TABLE IF EXISTS public.publication_ledger;
-- DROP TABLE IF EXISTS public.subscriptions;
-- DROP TABLE IF EXISTS public.plan_entitlements;
-- DROP TABLE IF EXISTS public.plans;
-- ALTER TABLE public.annonces DROP COLUMN IF EXISTS listing_kind;
-- ALTER TABLE public.app_config
--   DROP COLUMN IF EXISTS monetization_mode,
--   DROP COLUMN IF EXISTS config_version,
--   DROP COLUMN IF EXISTS pro_grace_hours,
--   DROP COLUMN IF EXISTS minimum_monetization_safe_version;
