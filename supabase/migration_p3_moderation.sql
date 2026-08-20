-- =========================================================================
-- MODÉRATION — file unique de signalements et journal immuable
-- Dossier directeur §16.4, §16.6, §12.2, §12.3. Idempotente.
-- =========================================================================
-- Aujourd'hui un signalement est un cul-de-sac : la table `signalements`
-- enregistre un motif et une date, sans statut, sans priorité, sans décision.
-- L'écran d'administration, lui, ne lit que `v_moderation_campagne` — les
-- annonces de la campagne de parrainage. Autrement dit, un utilisateur qui
-- signale une arnaque écrit dans un tiroir que personne n'ouvre.
--
-- Cette migration transforme le tiroir en file de travail :
--   1. la cible d'un signalement devient explicite (annonce, profil,
--      boutique, message, avis) ;
--   2. le signalement porte un cycle de vie et une priorité (§16.4) ;
--   3. `moderation_actions` journalise chaque décision, sans retour possible ;
--   4. `annonces.moderation_status` permet de LIMITER sans supprimer (§16.6) ;
--   5. une RPC applique la décision et l'écrit au journal dans la même
--      transaction — on ne peut pas agir sans laisser de trace.
--
-- ── Pourquoi un journal immuable ─────────────────────────────────────────
-- La modération décide de retirer le gagne-pain de quelqu'un. Sans trace
-- infalsifiable, aucune contestation n'est possible et aucun abus n'est
-- détectable — y compris de la part d'un administrateur. Le journal n'a donc
-- AUCUNE politique de mise à jour ni de suppression, et un déclencheur les
-- refuse explicitement.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. La cible et le cycle de vie d'un signalement (§16.4)
-- =========================================================================
ALTER TABLE public.signalements
  ADD COLUMN IF NOT EXISTS cible_type      TEXT NOT NULL DEFAULT 'annonce',
  ADD COLUMN IF NOT EXISTS cible_id        UUID,
  ADD COLUMN IF NOT EXISTS motif_code      TEXT NOT NULL DEFAULT 'info_incorrecte',
  ADD COLUMN IF NOT EXISTS statut          TEXT NOT NULL DEFAULT 'nouveau',
  ADD COLUMN IF NOT EXISTS decision        TEXT,
  ADD COLUMN IF NOT EXISTS traite_par      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_traitement TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.signalements ADD CONSTRAINT signalements_cible_type_check
    CHECK (cible_type IN ('annonce', 'profil', 'boutique', 'message', 'avis'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  -- Les six motifs du §16.4. Ils servent AUSSI de priorite : fraude et danger
  -- passent devant, un doublon peut attendre.
  ALTER TABLE public.signalements ADD CONSTRAINT signalements_motif_code_check
    CHECK (motif_code IN ('fraude', 'danger', 'contenu_interdit',
                          'harcelement', 'doublon', 'info_incorrecte'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.signalements ADD CONSTRAINT signalements_statut_check
    CHECK (statut IN ('nouveau', 'trie', 'en_enquete', 'actionne', 'rejete', 'clos'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- Reprise : les signalements existants visaient tous une annonce.
UPDATE public.signalements
SET cible_id = annonce_id
WHERE cible_id IS NULL AND annonce_id IS NOT NULL;

UPDATE public.signalements
SET cible_type = 'profil', cible_id = cible_user_id
WHERE cible_id IS NULL AND cible_user_id IS NOT NULL;

-- Reprise des motifs saisis en texte libre vers les codes.
UPDATE public.signalements SET motif_code = CASE
  WHEN motif ILIKE '%fraude%' OR motif ILIKE '%arnaque%' THEN 'fraude'
  WHEN motif ILIKE '%harc%'                              THEN 'harcelement'
  WHEN motif ILIKE '%interdit%' OR motif ILIKE '%illegal%' OR motif ILIKE '%illégal%'
                                                         THEN 'contenu_interdit'
  WHEN motif ILIKE '%inappropri%' OR motif ILIKE '%injuri%' THEN 'contenu_interdit'
  ELSE 'info_incorrecte'
END
WHERE motif_code = 'info_incorrecte' AND motif IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signalements_file
  ON public.signalements(statut, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_cible_generique
  ON public.signalements(cible_type, cible_id);

-- Le signaleur peut relire SON signalement : sans cela il ne sait jamais si
-- son geste a servi a quelque chose, et il cesse de signaler.
DROP POLICY IF EXISTS "Chacun relit ses signalements" ON public.signalements;
CREATE POLICY "Chacun relit ses signalements" ON public.signalements
  FOR SELECT USING (auth.uid() = signataire_id);

-- =========================================================================
-- 2. Statut de modération d'une publication (§12.3, §16.6)
-- =========================================================================
-- « Une annonce limitée n'est pas forcément supprimée : elle peut être
-- retirée des recommandations en attendant une vérification. » C'est la
-- sanction proportionnée qui manquait : aujourd'hui on ne peut que laisser
-- ou supprimer.
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  ALTER TABLE public.annonces ADD CONSTRAINT annonces_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'limited', 'rejected', 'under_review'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.annonces.moderation_status IS
  'approved : visible partout. limited : visible sur sa page mais retiree du '
  'fil et de la recherche, en attente de verification. under_review : idem, '
  'enquete en cours. rejected : retiree du public, conservee pour le '
  'proprietaire et la tracabilite. pending : jamais publiee.';

-- Tout ce qui est en ligne aujourd'hui a ete accepte de fait.
UPDATE public.annonces SET moderation_status = 'approved'
WHERE moderation_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_annonces_moderation
  ON public.annonces(moderation_status) WHERE moderation_status <> 'approved';

-- =========================================================================
-- 3. Journal immuable des décisions (§16.4)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id             BIGSERIAL PRIMARY KEY,
  signalement_id UUID REFERENCES public.signalements(id) ON DELETE SET NULL,
  admin_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cible_type     TEXT NOT NULL,
  cible_id       UUID,
  action         TEXT NOT NULL,
  note           TEXT,
  date_creation  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_cible
  ON public.moderation_actions(cible_type, cible_id, date_creation DESC);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les admins lisent le journal" ON public.moderation_actions;
CREATE POLICY "Les admins lisent le journal" ON public.moderation_actions
  FOR SELECT USING (public.is_admin());

-- Aucune politique d'INSERT depuis le client : seule la RPC ecrit.
-- Aucune politique d'UPDATE ni de DELETE, et le declencheur ci-dessous les
-- refuse meme au proprietaire de la table : un journal qui peut etre
-- reecrit ne prouve rien.
CREATE OR REPLACE FUNCTION public.refuser_modification_journal()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'JOURNAL_IMMUABLE'
    USING HINT = 'Le journal de moderation ne peut etre ni modifie ni supprime.';
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_journal_immuable ON public.moderation_actions;
CREATE TRIGGER trg_journal_immuable
  BEFORE UPDATE OR DELETE ON public.moderation_actions
  FOR EACH ROW EXECUTE FUNCTION public.refuser_modification_journal();

-- =========================================================================
-- 4. Appliquer une décision — action et trace, indissociables
-- =========================================================================
CREATE OR REPLACE FUNCTION public.moderer_signalement(
  p_signalement_id UUID,
  p_action         TEXT,   -- limiter | approuver | rejeter_contenu | suspendre_compte | classer_sans_suite
  p_note           TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin  UUID := auth.uid();
  v_sig    public.signalements%ROWTYPE;
  v_statut TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'ACCES_REFUSE' USING HINT = 'Reserve aux administrateurs.';
  END IF;

  SELECT * INTO v_sig FROM public.signalements WHERE id = p_signalement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SIGNALEMENT_INTROUVABLE';
  END IF;

  IF p_action NOT IN ('limiter', 'approuver', 'rejeter_contenu',
                      'suspendre_compte', 'classer_sans_suite') THEN
    RAISE EXCEPTION 'ACTION_INCONNUE';
  END IF;

  -- Effet sur la cible. On ne SUPPRIME jamais : on retire de la visibilite
  -- publique en conservant la donnee, pour que la decision soit reversible
  -- et contestable.
  IF v_sig.cible_type = 'annonce' AND v_sig.cible_id IS NOT NULL THEN
    IF p_action = 'limiter' THEN
      UPDATE public.annonces SET moderation_status = 'limited' WHERE id = v_sig.cible_id;
    ELSIF p_action = 'rejeter_contenu' THEN
      UPDATE public.annonces SET moderation_status = 'rejected' WHERE id = v_sig.cible_id;
    ELSIF p_action = 'approuver' THEN
      UPDATE public.annonces SET moderation_status = 'approved' WHERE id = v_sig.cible_id;
    END IF;
  END IF;

  IF p_action = 'suspendre_compte' THEN
    UPDATE public.users SET statut = 'suspendu'
    WHERE id = COALESCE(
      v_sig.cible_user_id,
      (SELECT user_id FROM public.annonces WHERE id = v_sig.cible_id)
    );
  END IF;

  v_statut := CASE
    WHEN p_action = 'classer_sans_suite' THEN 'rejete'
    WHEN p_action = 'approuver'          THEN 'clos'
    ELSE 'actionne'
  END;

  UPDATE public.signalements
  SET statut = v_statut,
      decision = p_action,
      traite_par = v_admin,
      date_traitement = NOW()
  WHERE id = p_signalement_id;

  -- La trace part dans la MEME transaction que l'effet : on ne peut pas agir
  -- sans laisser de trace, ni tracer une action qui n'a pas eu lieu.
  INSERT INTO public.moderation_actions
    (signalement_id, admin_id, cible_type, cible_id, action, note)
  VALUES
    (p_signalement_id, v_admin, v_sig.cible_type, v_sig.cible_id, p_action, p_note);

  RETURN jsonb_build_object('signalement_id', p_signalement_id, 'statut', v_statut);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.moderer_signalement(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderer_signalement(UUID, TEXT, TEXT) TO authenticated;

-- Changer un signalement d'etat sans decision (tri, mise en enquete).
CREATE OR REPLACE FUNCTION public.trier_signalement(
  p_signalement_id UUID,
  p_statut         TEXT
)
RETURNS void AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'ACCES_REFUSE';
  END IF;
  IF p_statut NOT IN ('nouveau', 'trie', 'en_enquete') THEN
    RAISE EXCEPTION 'STATUT_INVALIDE'
      USING HINT = 'Fermer un signalement passe par moderer_signalement, qui journalise.';
  END IF;
  UPDATE public.signalements SET statut = p_statut WHERE id = p_signalement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.trier_signalement(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trier_signalement(UUID, TEXT) TO authenticated;

-- =========================================================================
-- 5. La file, prête à afficher (§16.4)
-- =========================================================================
-- « L'admin voit historique, preuves minimales, utilisateur concerne,
-- decisions anterieures et action possible. »
CREATE OR REPLACE VIEW public.v_file_moderation
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.cible_type,
  s.cible_id,
  s.motif_code,
  s.motif,
  s.details,
  s.statut,
  s.decision,
  s.date_creation,
  s.date_traitement,
  -- Priorite d'affichage : fraude et danger d'abord (§16.4).
  CASE s.motif_code
    WHEN 'fraude'            THEN 1
    WHEN 'danger'            THEN 1
    WHEN 'contenu_interdit'  THEN 2
    WHEN 'harcelement'       THEN 2
    WHEN 'doublon'           THEN 4
    ELSE 3
  END                                    AS rang_priorite,
  a.titre                                AS annonce_titre,
  a.prix                                 AS annonce_prix,
  a.moderation_status                    AS annonce_statut_moderation,
  COALESCE(cible.id, a.user_id)          AS proprietaire_id,
  prop.prenom                            AS proprietaire_prenom,
  prop.nom                               AS proprietaire_nom,
  prop.statut                            AS proprietaire_statut,
  auteur.prenom                          AS signaleur_prenom,
  -- Decisions anterieures sur la meme cible : un recidiviste ne doit pas
  -- etre traite comme un premier signalement.
  (SELECT COUNT(*) FROM public.moderation_actions m
    WHERE m.cible_type = s.cible_type AND m.cible_id = s.cible_id) AS actions_anterieures,
  (SELECT COUNT(*) FROM public.signalements s2
    WHERE s2.cible_type = s.cible_type AND s2.cible_id = s.cible_id) AS signalements_sur_la_cible
FROM public.signalements s
LEFT JOIN public.annonces a  ON s.cible_type = 'annonce' AND a.id = s.cible_id
LEFT JOIN public.users cible ON s.cible_user_id = cible.id
LEFT JOIN public.users prop  ON prop.id = COALESCE(s.cible_user_id, a.user_id)
LEFT JOIN public.users auteur ON auteur.id = s.signataire_id;

GRANT SELECT ON public.v_file_moderation TO authenticated;
REVOKE ALL ON public.v_file_moderation FROM anon;

COMMIT;

-- =========================================================================
-- 6. Vérification
-- =========================================================================
SELECT statut, COUNT(*) FROM public.signalements GROUP BY statut;
SELECT motif_code, COUNT(*) FROM public.signalements GROUP BY motif_code;
SELECT moderation_status, COUNT(*) FROM public.annonces GROUP BY moderation_status;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('v_file_moderation', 'moderation_actions')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- Le journal doit refuser toute modification :
-- UPDATE public.moderation_actions SET note = 'test';  -->  JOURNAL_IMMUABLE

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- DROP VIEW IF EXISTS public.v_file_moderation;
-- DROP FUNCTION IF EXISTS public.trier_signalement(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.moderer_signalement(UUID, TEXT, TEXT);
-- DROP TRIGGER IF EXISTS trg_journal_immuable ON public.moderation_actions;
-- DROP FUNCTION IF EXISTS public.refuser_modification_journal();
-- DROP TABLE IF EXISTS public.moderation_actions;
-- ALTER TABLE public.annonces DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.signalements
--   DROP COLUMN IF EXISTS cible_type, DROP COLUMN IF EXISTS cible_id,
--   DROP COLUMN IF EXISTS motif_code, DROP COLUMN IF EXISTS statut,
--   DROP COLUMN IF EXISTS decision, DROP COLUMN IF EXISTS traite_par,
--   DROP COLUMN IF EXISTS date_traitement;
