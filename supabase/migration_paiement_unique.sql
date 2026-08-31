-- =========================================================================
-- PAIEMENT UNIQUE — l'abonnement mensuel devient un paiement à vie
-- Dossier directeur : suite de migration_p1_entitlements.sql, dont le
-- commentaire d'origine disait déjà « décision produit du 2026-08-20 :
-- rien n'expire ». Cette migration finit le travail : les deux derniers
-- endroits qui recalculaient encore une échéance à 30 jours (le repli
-- utilisé pour tout compte payé via `users.date_abonnement`, hors de la
-- table `subscriptions`) sont retirés. Idempotente.
--
-- Ne change AUCUNE autre règle : mêmes quotas, mêmes droits par plan
-- (`plan_entitlements` intact), même distinction Pro/Vendeur/Gratuit.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. get_effective_entitlements — le repli sur date_abonnement ne vérifie
--    plus aucune date pour un compte payant : il reste actif tant que
--    type_compte n'est pas retiré manuellement (accès à vie, cf. offre).
-- -------------------------------------------------------------------------
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
  -- Monetisation active : un abonnement explicite (table `subscriptions`,
  -- table historique/versionnee) prime toujours s'il existe et couvre
  -- encore la periode de grace.
  -- ------------------------------------------------------------------
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
    -- Repli sur `users.type_compte` / `date_abonnement` : c'est le chemin
    -- emprunte par TOUS les paiements actuels (rien n'ecrit plus dans
    -- `subscriptions`). Paiement unique = aucune date a verifier ici.
    SELECT CASE u.type_compte WHEN 'professionnel' THEN 'pro'
                              WHEN 'vendeur'       THEN 'vendeur'
                              ELSE 'gratuit' END
      INTO v_plan_code
    FROM public.users u WHERE u.id = p_user_id;

    v_plan_code   := COALESCE(v_plan_code, 'gratuit');
    v_valid_until := NULL;
    IF v_plan_code <> 'gratuit' THEN
      v_statut := 'actif';
    END IF;
  END IF;

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
    'valid_until',        v_valid_until,
    'en_grace',           (v_statut = 'grace'),
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

-- -------------------------------------------------------------------------
-- 2. v_entitlements_publics — même correction : le badge Pro/Vendeur public
--    ne s'éteint plus après 30 jours pour un compte payé hors `subscriptions`.
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_entitlements_publics AS
SELECT
  u.id AS user_id,
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
      WHEN u.type_compte = 'professionnel' THEN 'pro'
      WHEN u.type_compte = 'vendeur'       THEN 'vendeur'
      ELSE 'gratuit'
    END
  ) END AS plan_public
FROM public.users u
CROSS JOIN LATERAL (
  SELECT COALESCE((SELECT ac.pro_grace_hours FROM public.app_config ac WHERE ac.id = 1), 72)
         AS pro_grace_hours,
         COALESCE((SELECT ac.monetization_mode FROM public.app_config ac WHERE ac.id = 1), 'FREE_LAUNCH')
         AS mode
) c;

GRANT SELECT ON public.v_entitlements_publics TO anon, authenticated;

COMMENT ON VIEW public.v_entitlements_publics IS
  'Plan reellement valide d''un compte. Paiement unique (2026-08-31) : plus '
  'aucune date n''est verifiee pour un compte paye hors table subscriptions.';

-- -------------------------------------------------------------------------
-- 3. Traçabilité de l'offre achetée (bookkeeping seul, ne conditionne
--    aucun droit — 'service' donne exactement les mêmes droits que 'pro',
--    voir plan_entitlements, seul le prix et la présentation diffèrent).
-- -------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_achete TEXT;

-- -------------------------------------------------------------------------
-- 4. Réactivation des paiements (demandée explicitement) — LIVE applique
--    paywall + quotas + blocage. Repasser en SOFT_PAYWALL ou FREE_LAUNCH
--    à tout moment en rejouant cette ligne avec une autre valeur.
-- -------------------------------------------------------------------------
UPDATE public.app_config SET monetization_mode = 'LIVE' WHERE id = 1;

COMMIT;

-- =========================================================================
-- Vérification
-- =========================================================================
SELECT monetization_mode, payments_enabled, pro_grace_hours FROM public.app_config WHERE id = 1;
SELECT code, nom, prix_fcfa FROM public.plans ORDER BY ordre;
