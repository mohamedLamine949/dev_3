-- =====================================================================
-- MIGRATION : ANTI-FRAUDE PARRAINAGE (modération admin + device-ID)
-- À exécuter dans le SQL Editor. Idempotente. À appliquer APRÈS
-- migration_parrainage.sql.
--
-- Principe (révision de la spec initiale, décidé 2026-07-28) :
--   - Une annonce d'un PARTICIPANT (parrain avec code, ou filleul) passe en
--     `campagne_statut = 'en_revue'`. Elle reste une annonce normale, visible
--     dans le marché — mais elle NE COMPTE PAS pour la campagne tant que
--     l'admin ne l'a pas APPROUVÉE. Le junk ne rapporte donc jamais rien.
--   - La validation ne compte QUE les annonces `campagne_statut='approuvee'`.
--   - L'admin peut REJETER ou SUPPRIMER une annonce ; le cycle correspondant
--     est alors rétrogradé automatiquement (sauf 'paye', terminal).
--   - L'expiration naturelle J+60 ne rétrograde JAMAIS (elle ne passe pas par
--     ces fonctions) : un vrai gagnant ne perd pas sa prime.
--   - device_id : capté côté app, stocké sur users, sert à SIGNALER (drapeau)
--     les collisions parrain/filleuls à l'admin. Pas de blocage automatique.
-- =====================================================================
BEGIN;

-- -------------------------------------------------------------------------
-- 1. COLONNES
-- -------------------------------------------------------------------------
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS campagne_statut TEXT
    CHECK (campagne_statut IN ('en_revue','approuvee','rejetee')),
  ADD COLUMN IF NOT EXISTS campagne_moderee_par UUID,
  ADD COLUMN IF NOT EXISTS campagne_moderee_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campagne_raison TEXT;

CREATE INDEX IF NOT EXISTS idx_annonces_campagne_statut
  ON public.annonces(campagne_statut) WHERE campagne_statut IS NOT NULL;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_device_id
  ON public.users(device_id) WHERE device_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. TRIGGER : marquer 'en_revue' toute annonce d'un participant campagne
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marquer_annonce_en_revue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.campagne_statut IS NULL AND NEW.statut IN ('active','vendu') THEN
    IF EXISTS (SELECT 1 FROM public.parrains p
               WHERE p.user_id = NEW.user_id AND p.code IS NOT NULL)
       OR EXISTS (SELECT 1 FROM public.parrainages g
                  WHERE g.filleul_id = NEW.user_id) THEN
      NEW.campagne_statut := 'en_revue';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_annonce_en_revue ON public.annonces;
CREATE TRIGGER trg_annonce_en_revue
  BEFORE INSERT ON public.annonces
  FOR EACH ROW EXECUTE FUNCTION public.marquer_annonce_en_revue();

-- -------------------------------------------------------------------------
-- 3. VALIDATION (UPGRADES only) : ne compte QUE les annonces approuvées.
--    Redéfinit executer_validation_parrainages avec le filtre campagne.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.executer_validation_parrainages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  r RECORD;
  annonce_valide UUID;
  cycles_engages INTEGER;
  filleuls_valides_parrain INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('parrainage_validation'));

  SELECT * INTO c FROM public.campagnes_parrainage WHERE active LIMIT 1;
  IF c IS NULL THEN RETURN; END IF;

  -- a) Éligibilité parrain : >= N annonces APPROUVÉES depuis génération du code
  FOR r IN
    UPDATE public.parrains p
    SET eligible = TRUE, date_eligibilite = NOW()
    WHERE p.campagne_id = c.id
      AND p.code IS NOT NULL
      AND p.eligible = FALSE
      AND (SELECT COUNT(*) FROM public.annonces a
           WHERE a.user_id = p.user_id
             AND a.statut IN ('active','vendu')
             AND a.campagne_statut = 'approuvee'
             AND a.date_creation >= p.date_generation_code) >= c.annonces_requises
    RETURNING p.user_id
  LOOP
    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (r.user_id, 'Vous êtes éligible ✅',
      'Vos annonces ont été validées ! Chaque filleul qui publie une annonce validée vous rapporte ' || c.recompense || ' F.',
      'parrainage', '{}'::jsonb);
  END LOOP;

  -- b) Validation des parrainages en attente (annonce filleul APPROUVÉE)
  FOR r IN
    SELECT pg.*
    FROM public.parrainages pg
    JOIN public.parrains pa ON pa.user_id = pg.parrain_id
    JOIN public.users u ON u.id = pg.filleul_id
    JOIN public.users up ON up.id = pg.parrain_id
    WHERE pg.campagne_id = c.id
      AND pg.statut = 'en_attente'
      AND pa.eligible = TRUE
      AND COALESCE(u.statut, 'actif') = 'actif'
      AND COALESCE(up.statut, 'actif') = 'actif'
    ORDER BY pg.date_saisie_code
  LOOP
    SELECT a.id INTO annonce_valide
    FROM public.annonces a
    WHERE a.user_id = r.filleul_id
      AND a.statut IN ('active','vendu')
      AND a.campagne_statut = 'approuvee'
      AND a.date_creation >= r.date_saisie_code
    ORDER BY a.date_creation
    LIMIT 1;
    CONTINUE WHEN annonce_valide IS NULL;

    SELECT COUNT(*) INTO filleuls_valides_parrain
    FROM public.parrainages
    WHERE parrain_id = r.parrain_id AND statut IN ('valide','paye');
    CONTINUE WHEN filleuls_valides_parrain >= c.plafond_filleuls;

    SELECT COUNT(*) INTO cycles_engages
    FROM public.parrainages
    WHERE campagne_id = c.id AND statut IN ('valide','paye');
    EXIT WHEN (cycles_engages + 1) * c.recompense > c.budget_total;

    UPDATE public.parrainages
    SET statut = 'valide', annonce_validante_id = annonce_valide, date_validation = NOW()
    WHERE id = r.id;

    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (r.parrain_id, 'Cycle validé 🎉',
      'Le cycle est validé : +' || c.recompense || ' F à recevoir sur votre compte Orange Money.',
      'parrainage', '{}'::jsonb);
  END LOOP;
END;
$$;

-- -------------------------------------------------------------------------
-- 4. RÉTROGRADATION (explicite, admin seulement) : recalcule à la baisse
--    l'éligibilité d'un parrain et ses cycles non payés, à partir des
--    annonces APPROUVÉES restantes. Appelée par la modération/suppression.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retrograder_parrain(p_parrain_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  nb_ok INTEGER;
BEGIN
  SELECT * INTO c FROM public.campagnes_parrainage WHERE active LIMIT 1;
  IF c IS NULL THEN RETURN; END IF;

  -- L'éligibilité suit le nombre d'annonces approuvées (les deux sens)
  SELECT COUNT(*) INTO nb_ok
  FROM public.annonces a
  JOIN public.parrains p ON p.user_id = p_parrain_id
  WHERE a.user_id = p_parrain_id
    AND a.statut IN ('active','vendu')
    AND a.campagne_statut = 'approuvee'
    AND a.date_creation >= p.date_generation_code;

  UPDATE public.parrains
  SET eligible = (nb_ok >= c.annonces_requises),
      date_eligibilite = CASE WHEN nb_ok >= c.annonces_requises THEN date_eligibilite ELSE NULL END
  WHERE user_id = p_parrain_id;

  -- Si le parrain n'est plus éligible : ses cycles NON payés retombent en attente
  IF nb_ok < c.annonces_requises THEN
    UPDATE public.parrainages
    SET statut = 'en_attente', annonce_validante_id = NULL, date_validation = NULL
    WHERE parrain_id = p_parrain_id AND statut = 'valide';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------
-- 5. MODÉRER une annonce de campagne (admin) : approuver / rejeter
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderer_annonce_campagne(
  p_annonce_id UUID, p_decision TEXT, p_raison TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  IF p_decision NOT IN ('approuvee','rejetee') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Décision invalide');
  END IF;

  SELECT * INTO a FROM public.annonces WHERE id = p_annonce_id;
  IF a IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Annonce introuvable');
  END IF;

  UPDATE public.annonces
  SET campagne_statut = p_decision,
      campagne_moderee_par = auth.uid(),
      campagne_moderee_le = NOW(),
      campagne_raison = p_raison
  WHERE id = p_annonce_id;

  IF p_decision = 'rejetee' THEN
    -- Le cycle éventuellement validé par CETTE annonce retombe en attente
    UPDATE public.parrainages
    SET statut = 'en_attente', annonce_validante_id = NULL, date_validation = NULL
    WHERE annonce_validante_id = p_annonce_id AND statut = 'valide';
    -- Recalcule à la baisse l'éligibilité du parrain (si l'annonce était à lui)
    PERFORM public.retrograder_parrain(a.user_id);
  END IF;

  -- Re-propage les upgrades encore légitimes
  PERFORM public.executer_validation_parrainages();

  RETURN jsonb_build_object('ok', true, 'decision', p_decision);
END;
$$;

-- -------------------------------------------------------------------------
-- 6. SUPPRIMER une annonce de campagne (admin) : rétrograde puis DELETE
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supprimer_annonce_campagne(
  p_annonce_id UUID, p_raison TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;

  SELECT * INTO a FROM public.annonces WHERE id = p_annonce_id;
  IF a IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Annonce introuvable');
  END IF;

  -- Cycle validé par cette annonce -> retombe en attente (annonce_validante_id
  -- passera NULL via ON DELETE SET NULL, on force aussi le statut)
  UPDATE public.parrainages
  SET statut = 'en_attente', annonce_validante_id = NULL, date_validation = NULL
  WHERE annonce_validante_id = p_annonce_id AND statut = 'valide';

  DELETE FROM public.annonces WHERE id = p_annonce_id;

  PERFORM public.retrograder_parrain(a.user_id);
  PERFORM public.executer_validation_parrainages();

  RETURN jsonb_build_object('ok', true, 'message', 'Annonce supprimée');
END;
$$;

-- -------------------------------------------------------------------------
-- 7. VUE DE MODÉRATION (admin) : toutes les annonces de campagne à revoir,
--    avec auteur, rôle, images, et DRAPEAU device partagé dans le réseau.
-- -------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_moderation_campagne;
CREATE VIEW public.v_moderation_campagne
WITH (security_invoker = true) AS
SELECT
  a.id AS annonce_id,
  a.titre, a.description, a.prix, a.categorie, a.etat_article,
  a.ville, a.quartier, a.date_creation,
  a.campagne_statut, a.campagne_raison,
  a.user_id,
  u.prenom, u.nom, u.num_telephone, u.avatar_url, u.device_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.parrains p WHERE p.user_id = a.user_id AND p.code IS NOT NULL)
      THEN 'parrain' ELSE 'filleul'
  END AS role,
  (SELECT COUNT(*) FROM public.images_annonce i WHERE i.annonce_id = a.id) AS nb_images,
  (SELECT i.image_url FROM public.images_annonce i WHERE i.annonce_id = a.id ORDER BY i.ordre LIMIT 1) AS image_principale,
  -- Drapeau anti multi-comptes : device partagé avec une autre personne du même
  -- réseau de parrainage (parrain ou co-filleuls).
  (u.device_id IS NOT NULL AND EXISTS (
     SELECT 1
     FROM public.parrainages g
     JOIN public.users u2 ON u2.id IN (g.parrain_id, g.filleul_id)
     WHERE (g.filleul_id = a.user_id OR g.parrain_id = a.user_id
            OR g.parrain_id IN (SELECT parrain_id FROM public.parrainages WHERE filleul_id = a.user_id))
       AND u2.id <> a.user_id
       AND u2.device_id = u.device_id
  )) AS device_partage
FROM public.annonces a
JOIN public.users u ON u.id = a.user_id
WHERE a.campagne_statut IS NOT NULL
ORDER BY (a.campagne_statut = 'en_revue') DESC, a.date_creation DESC;

COMMIT;
