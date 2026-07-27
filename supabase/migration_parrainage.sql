-- =========================================================================
-- MIGRATION : Programme de parrainage rémunéré (Campagne 1)
-- À exécuter dans le SQL Editor du dashboard Supabase. Idempotente.
-- =========================================================================
-- Règles (spec définitive 2026-07-10) :
--   - Accès parrain sur invitation : l'admin active chaque parrain à la main.
--   - Le parrain renseigne son n° Orange Money puis génère son code (6 car.).
--     Le tracking de ses annonces démarre à la génération du code.
--   - Parrain éligible : 2 annonces valides publiées APRÈS la génération du
--     code (porte unique : une fois éligible, acquis à vie, jamais repris).
--   - Cycle validé : le filleul saisit le code PUIS publie 1 annonce valide.
--     Récompense 1 000 F, plafond 5 filleuls/parrain, 50 parrains max,
--     budget 250 000 F — le tout piloté par la table campagnes_parrainage.
--   - Annonce valide = statut IN ('active','vendu') (passée par le flux
--     paiement/modération). Les annonces sont purgées à J+60 (cf. migration
--     expiration) : l'éligibilité et les validations ne sont JAMAIS
--     recalculées à la baisse, et la preuve (annonce_validante_id) survit
--     en SET NULL avec ses dates.
--   - Toute la logique vit ici (triggers + SECURITY DEFINER) : l'app ne
--     décide de rien, elle affiche.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. CAMPAGNES : les règles du jeu, pilotables à distance (pattern app_config)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campagnes_parrainage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  recompense INTEGER NOT NULL DEFAULT 1000,          -- FCFA par cycle validé
  annonces_requises INTEGER NOT NULL DEFAULT 2,      -- pour l'éligibilité parrain
  plafond_filleuls INTEGER NOT NULL DEFAULT 5,       -- filleuls payés max / parrain
  max_parrains INTEGER NOT NULL DEFAULT 50,          -- places dans la campagne
  budget_total INTEGER NOT NULL DEFAULT 250000,      -- enveloppe absolue FCFA
  active BOOLEAN NOT NULL DEFAULT TRUE,              -- interrupteur d'urgence
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une seule campagne active à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_campagne_active_unique
  ON public.campagnes_parrainage (active) WHERE active;

-- Campagne 1 (créée seulement si aucune campagne n'existe)
INSERT INTO public.campagnes_parrainage (nom)
SELECT 'Campagne 1'
WHERE NOT EXISTS (SELECT 1 FROM public.campagnes_parrainage);

-- -------------------------------------------------------------------------
-- 2. PARRAINS : une ligne = une personne invitée par l'admin
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parrains (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  campagne_id UUID NOT NULL REFERENCES public.campagnes_parrainage(id),
  date_autorisation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  autorise_par UUID,                                 -- uid admin qui a activé
  code TEXT UNIQUE,                                  -- NULL tant que non généré
  date_generation_code TIMESTAMPTZ,                  -- début du tracking
  om_numero TEXT,
  om_titulaire TEXT,
  eligible BOOLEAN NOT NULL DEFAULT FALSE,           -- 2 annonces : porte unique
  date_eligibilite TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_parrains_campagne ON public.parrains(campagne_id);
CREATE INDEX IF NOT EXISTS idx_parrains_code ON public.parrains(code);

-- -------------------------------------------------------------------------
-- 3. PARRAINAGES : une ligne = un filleul rattaché à un parrain (à vie)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parrainages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id UUID NOT NULL REFERENCES public.campagnes_parrainage(id),
  parrain_id UUID NOT NULL REFERENCES public.parrains(user_id) ON DELETE CASCADE,
  filleul_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  date_saisie_code TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  statut TEXT NOT NULL DEFAULT 'en_attente',         -- en_attente | valide | paye | rejete
  annonce_validante_id UUID REFERENCES public.annonces(id) ON DELETE SET NULL,
  date_validation TIMESTAMPTZ,
  date_paiement TIMESTAMPTZ,
  paye_par UUID,                                     -- uid admin qui a marqué payé
  CONSTRAINT parrainage_pas_soi_meme CHECK (parrain_id <> filleul_id),
  CONSTRAINT parrainage_statut_valide CHECK (statut IN ('en_attente','valide','paye','rejete'))
);

CREATE INDEX IF NOT EXISTS idx_parrainages_parrain ON public.parrainages(parrain_id);
CREATE INDEX IF NOT EXISTS idx_parrainages_statut ON public.parrainages(statut);

-- -------------------------------------------------------------------------
-- 4. FONCTION ADMIN : activer un parrain (whitelist, respecte max_parrains)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activer_parrain(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  nb_actifs INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;

  SELECT * INTO c FROM public.campagnes_parrainage WHERE active LIMIT 1;
  IF c IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Aucune campagne active');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Utilisateur introuvable');
  END IF;

  IF EXISTS (SELECT 1 FROM public.parrains WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Déjà parrain');
  END IF;

  SELECT COUNT(*) INTO nb_actifs FROM public.parrains WHERE campagne_id = c.id;
  IF nb_actifs >= c.max_parrains THEN
    RETURN jsonb_build_object('ok', false,
      'message', 'Limite atteinte : ' || c.max_parrains || ' parrains');
  END IF;

  INSERT INTO public.parrains (user_id, campagne_id, autorise_par)
  VALUES (p_user_id, c.id, auth.uid());

  -- Prévenir la personne dans l'app (push automatique via trigger notifications)
  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  VALUES (p_user_id, 'Programme partenaire 🤝',
    'Vous êtes invité au programme partenaire ! Ouvrez votre profil > Devenir partenaire pour générer votre code.',
    'parrainage', '{}'::jsonb);

  RETURN jsonb_build_object('ok', true, 'message', 'Parrain activé',
    'parrains_actives', nb_actifs + 1, 'max_parrains', c.max_parrains);
END;
$$;

-- -------------------------------------------------------------------------
-- 5. FONCTION PARRAIN : renseigner Orange Money + générer son code (une fois)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generer_code_parrain(p_om_numero TEXT, p_om_titulaire TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  nouveau_code TEXT;
  -- alphabet sans caractères ambigus (pas de O/0, I/1/L)
  alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i INTEGER;
BEGIN
  SELECT * INTO p FROM public.parrains WHERE user_id = auth.uid();
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Vous n''êtes pas invité au programme');
  END IF;
  IF p.code IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'code', p.code, 'message', 'Code déjà généré');
  END IF;
  IF COALESCE(TRIM(p_om_numero), '') = '' OR COALESCE(TRIM(p_om_titulaire), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Numéro Orange Money et nom du titulaire obligatoires');
  END IF;

  -- Génération d'un code unique de 6 caractères
  LOOP
    nouveau_code := '';
    FOR i IN 1..6 LOOP
      nouveau_code := nouveau_code ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.parrains WHERE code = nouveau_code);
  END LOOP;

  UPDATE public.parrains
  SET code = nouveau_code,
      date_generation_code = NOW(),
      om_numero = TRIM(p_om_numero),
      om_titulaire = TRIM(p_om_titulaire)
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'code', nouveau_code);
END;
$$;

-- -------------------------------------------------------------------------
-- 6. FONCTION FILLEUL : saisir un code (sans pouvoir énumérer les codes)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.saisir_code_parrainage(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  p RECORD;
  parrain_nom TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Connexion requise');
  END IF;

  SELECT * INTO c FROM public.campagnes_parrainage WHERE active LIMIT 1;
  IF c IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Le programme de parrainage est terminé');
  END IF;

  IF EXISTS (SELECT 1 FROM public.parrainages WHERE filleul_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Vous avez déjà un parrain');
  END IF;

  SELECT * INTO p FROM public.parrains
  WHERE code = UPPER(TRIM(p_code)) AND campagne_id = c.id;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Code invalide');
  END IF;
  IF p.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Vous ne pouvez pas saisir votre propre code');
  END IF;

  INSERT INTO public.parrainages (campagne_id, parrain_id, filleul_id)
  VALUES (c.id, p.user_id, auth.uid());

  SELECT COALESCE(NULLIF(TRIM(prenom || ' ' || COALESCE(nom, '')), ''), 'votre parrain')
  INTO parrain_nom FROM public.users WHERE id = p.user_id;

  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  VALUES (p.user_id, 'Nouveau filleul 👋',
    'Une personne a saisi votre code. Dès qu''elle publie une annonce, le cycle sera validé.',
    'parrainage', '{}'::jsonb);

  RETURN jsonb_build_object('ok', true,
    'message', 'Code accepté ! Publiez une annonce pour valider le parrainage de ' || parrain_nom || '.');
END;
$$;

-- -------------------------------------------------------------------------
-- 7. LE CŒUR : validation automatique (appelée par trigger sur annonces)
--    Balaye tous les parrainages en attente et valide ceux qui remplissent
--    TOUTES les conditions, dans la limite du plafond et du budget.
--    Volumes minuscules (≤50 parrains, ≤250 filleuls) : le scan complet est
--    voulu — idempotent et auto-réparateur.
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
  -- Sérialise les validations concurrentes (deux filleuls qui postent en
  -- même temps ne peuvent pas dépasser le budget)
  PERFORM pg_advisory_xact_lock(hashtext('parrainage_validation'));

  SELECT * INTO c FROM public.campagnes_parrainage WHERE active LIMIT 1;
  IF c IS NULL THEN RETURN; END IF;

  -- a) Éligibilité des parrains : 2 annonces valides depuis la génération du
  --    code. Porte unique : on ne repasse JAMAIS eligible à FALSE.
  FOR r IN
    UPDATE public.parrains p
    SET eligible = TRUE, date_eligibilite = NOW()
    WHERE p.campagne_id = c.id
      AND p.code IS NOT NULL
      AND p.eligible = FALSE
      AND (SELECT COUNT(*) FROM public.annonces a
           WHERE a.user_id = p.user_id
             AND a.statut IN ('active','vendu')
             AND a.date_creation >= p.date_generation_code) >= c.annonces_requises
    RETURNING p.user_id
  LOOP
    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (r.user_id, 'Vous êtes éligible ✅',
      'Vos ' || c.annonces_requises || ' annonces sont publiées ! Chaque filleul qui publie une annonce vous rapporte maintenant ' || c.recompense || ' F.',
      'parrainage', '{}'::jsonb);
  END LOOP;

  -- b) Validation des parrainages en attente (ordre d'arrivée = équité)
  FOR r IN
    SELECT pg.*, u.statut AS statut_filleul
    FROM public.parrainages pg
    JOIN public.parrains pa ON pa.user_id = pg.parrain_id
    JOIN public.users u ON u.id = pg.filleul_id
    JOIN public.users up ON up.id = pg.parrain_id
    WHERE pg.campagne_id = c.id
      AND pg.statut = 'en_attente'
      AND pa.eligible = TRUE
      AND COALESCE(u.statut, 'actif') = 'actif'    -- filleul non suspendu
      AND COALESCE(up.statut, 'actif') = 'actif'   -- parrain non suspendu
    ORDER BY pg.date_saisie_code
  LOOP
    -- Le filleul doit avoir publié une annonce valide APRÈS la saisie du code
    SELECT a.id INTO annonce_valide
    FROM public.annonces a
    WHERE a.user_id = r.filleul_id
      AND a.statut IN ('active','vendu')
      AND a.date_creation >= r.date_saisie_code
    ORDER BY a.date_creation
    LIMIT 1;
    CONTINUE WHEN annonce_valide IS NULL;

    -- Plafond du parrain (filleuls validés + payés)
    SELECT COUNT(*) INTO filleuls_valides_parrain
    FROM public.parrainages
    WHERE parrain_id = r.parrain_id AND statut IN ('valide','paye');
    CONTINUE WHEN filleuls_valides_parrain >= c.plafond_filleuls;

    -- Budget global de la campagne
    SELECT COUNT(*) INTO cycles_engages
    FROM public.parrainages
    WHERE campagne_id = c.id AND statut IN ('valide','paye');
    EXIT WHEN (cycles_engages + 1) * c.recompense > c.budget_total;

    UPDATE public.parrainages
    SET statut = 'valide',
        annonce_validante_id = annonce_valide,
        date_validation = NOW()
    WHERE id = r.id;

    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (r.parrain_id, 'Cycle validé 🎉',
      'Votre filleul a publié son annonce : +' || c.recompense || ' F à recevoir sur votre compte Orange Money.',
      'parrainage', '{}'::jsonb);
  END LOOP;
END;
$$;

-- Trigger : chaque annonce qui devient valide relance la validation
CREATE OR REPLACE FUNCTION public.trigger_parrainage_annonce()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.executer_validation_parrainages();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_annonce_valide_parrainage ON public.annonces;
CREATE TRIGGER on_annonce_valide_parrainage
  AFTER INSERT OR UPDATE OF statut ON public.annonces
  FOR EACH ROW
  WHEN (NEW.statut IN ('active','vendu'))
  EXECUTE FUNCTION public.trigger_parrainage_annonce();

-- -------------------------------------------------------------------------
-- 8. FONCTION ADMIN : marquer un parrainage comme payé (après virement OM)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marquer_parrainage_paye(p_parrainage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;

  UPDATE public.parrainages
  SET statut = 'paye', date_paiement = NOW(), paye_par = auth.uid()
  WHERE id = p_parrainage_id AND statut = 'valide'
  RETURNING * INTO r;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Parrainage introuvable ou non validé');
  END IF;

  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  VALUES (r.parrain_id, 'Paiement envoyé 💸',
    'Votre récompense de parrainage a été envoyée sur votre compte Orange Money. Merci de faire vivre Flash Market !',
    'parrainage', '{}'::jsonb);

  RETURN jsonb_build_object('ok', true, 'message', 'Marqué payé');
END;
$$;

-- -------------------------------------------------------------------------
-- 9. RLS
-- -------------------------------------------------------------------------
ALTER TABLE public.campagnes_parrainage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parrains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parrainages ENABLE ROW LEVEL SECURITY;

-- Campagne : lecture publique (l'app affiche les règles : montant, plafond…)
DROP POLICY IF EXISTS "Campagne lisible par tous" ON public.campagnes_parrainage;
CREATE POLICY "Campagne lisible par tous" ON public.campagnes_parrainage
  FOR SELECT USING (true);
-- Aucune policy d'écriture : seule la service-role / le SQL Editor modifie.

-- Parrains : chacun voit SA ligne ; l'admin voit tout.
-- Aucune policy INSERT/UPDATE : tout passe par les fonctions SECURITY DEFINER
-- (activer_parrain, generer_code_parrain) qui portent les contrôles.
DROP POLICY IF EXISTS "Parrain lit sa ligne" ON public.parrains;
CREATE POLICY "Parrain lit sa ligne" ON public.parrains
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admin supprime un parrain" ON public.parrains;
CREATE POLICY "Admin supprime un parrain" ON public.parrains
  FOR DELETE USING (public.is_admin());

-- Parrainages : parrain et filleul voient leurs lignes ; admin voit tout.
DROP POLICY IF EXISTS "Acteurs lisent leurs parrainages" ON public.parrainages;
CREATE POLICY "Acteurs lisent leurs parrainages" ON public.parrainages
  FOR SELECT USING (
    auth.uid() = parrain_id OR auth.uid() = filleul_id OR public.is_admin()
  );
DROP POLICY IF EXISTS "Admin met à jour les parrainages" ON public.parrainages;
CREATE POLICY "Admin met à jour les parrainages" ON public.parrainages
  FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "Admin supprime un parrainage" ON public.parrainages;
CREATE POLICY "Admin supprime un parrainage" ON public.parrainages
  FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------------
-- 10. VUES DE PILOTAGE (security_invoker : la RLS des tables s'applique,
--     donc seuls les admins voient l'ensemble)
-- -------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_parrains_dashboard;
CREATE VIEW public.v_parrains_dashboard
WITH (security_invoker = true) AS
SELECT
  p.user_id,
  u.prenom, u.nom, u.num_telephone, u.email, u.avatar_url,
  p.code, p.om_numero, p.om_titulaire,
  p.date_autorisation, p.date_generation_code,
  (SELECT COUNT(*) FROM public.annonces a
   WHERE a.user_id = p.user_id AND a.statut IN ('active','vendu')
     AND p.date_generation_code IS NOT NULL
     AND a.date_creation >= p.date_generation_code) AS annonces_valides,
  c.annonces_requises,
  p.eligible, p.date_eligibilite,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.parrain_id = p.user_id) AS filleuls_inscrits,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.parrain_id = p.user_id AND g.statut = 'valide') AS filleuls_valides,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.parrain_id = p.user_id AND g.statut = 'paye') AS filleuls_payes,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.parrain_id = p.user_id AND g.statut = 'valide') * c.recompense AS montant_du,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.parrain_id = p.user_id AND g.statut = 'paye') * c.recompense AS montant_paye
FROM public.parrains p
JOIN public.users u ON u.id = p.user_id
JOIN public.campagnes_parrainage c ON c.id = p.campagne_id;

DROP VIEW IF EXISTS public.v_campagne_sante;
CREATE VIEW public.v_campagne_sante
WITH (security_invoker = true) AS
SELECT
  c.id, c.nom, c.active,
  c.recompense, c.annonces_requises, c.plafond_filleuls,
  c.max_parrains, c.budget_total,
  (SELECT COUNT(*) FROM public.parrains p WHERE p.campagne_id = c.id) AS parrains_actives,
  (SELECT COUNT(*) FROM public.parrains p WHERE p.campagne_id = c.id AND p.code IS NOT NULL) AS codes_generes,
  (SELECT COUNT(*) FROM public.parrains p WHERE p.campagne_id = c.id AND p.eligible) AS parrains_eligibles,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.campagne_id = c.id AND g.statut = 'en_attente') AS filleuls_en_attente,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.campagne_id = c.id AND g.statut = 'valide') AS cycles_a_payer,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.campagne_id = c.id AND g.statut = 'paye') AS cycles_payes,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.campagne_id = c.id AND g.statut IN ('valide','paye')) * c.recompense AS budget_engage,
  (SELECT COUNT(*) FROM public.parrainages g WHERE g.campagne_id = c.id AND g.statut = 'paye') * c.recompense AS budget_paye,
  c.budget_total
    - (SELECT COUNT(*) FROM public.parrainages g WHERE g.campagne_id = c.id AND g.statut IN ('valide','paye')) * c.recompense
    AS budget_restant
FROM public.campagnes_parrainage c;

COMMIT;
