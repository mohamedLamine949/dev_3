-- =========================================================================
-- MIGRATION : PARRAINAGE OUVERT (« Invitations ») + CONCOURS DE LANCEMENT
-- =========================================================================
--
-- Ce programme est OUVERT À TOUS et entièrement automatique. Il ne remplace
-- pas l'ancien (campagnes_parrainage / parrains / parrainages, activé à la
-- main par l'admin et payé 1000 F par cycle) : celui-là reste en place et
-- intact, il pourra resservir. Les deux ne partagent aucune table.
--
-- Règles, décidées le 2026-09-16 :
--
--   1. Chaque utilisateur obtient un code d'invitation, sans démarche.
--   2. Un nouvel inscrit saisit ce code ; il est rattaché à son parrain à vie.
--   3. Le parrainage ne compte QUE lorsque le filleul publie sa première
--      annonce. Créer cinq faux comptes ne rapporte donc rien : il faut cinq
--      vraies annonces, avec photos, visibles de tous et modérables.
--   4. Chaque parrainage validé donne au parrain UN BOOST GRATUIT (48 h),
--      utilisable sur l'annonce de son choix.
--   5. À partir de CINQ parrainages validés, le parrain participe au concours
--      de lancement (100 000 FCFA, un gagnant tiré parmi les participants).
--
-- Anti-fraude automatique :
--   - on ne peut pas se parrainer soi-même, ni être parrainé deux fois ;
--   - seul un compte NEUF peut saisir un code (moins de 7 jours, aucune
--     annonce publiée) : sans cette borne, les comptes déjà inscrits se
--     parraineraient mutuellement ;
--   - deux comptes qui partagent le même téléphone (device_id) sont
--     ENREGISTRÉS MAIS BLOQUÉS : ni boost, ni point concours, tant qu'un
--     admin n'a pas validé à la main (debloquer_invitation). C'est le seul
--     geste manuel du programme.
--
-- Toute la logique vit ici, en SECURITY DEFINER : l'application ne fait
-- qu'appeler des fonctions et lire ses propres lignes. Aucun client ne peut
-- s'attribuer un crédit.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. CODES — un par utilisateur, créé à la demande
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 2. INVITATIONS — une ligne = un filleul rattaché à un parrain, à vie
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parrain_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filleul_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  date_saisie TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_validation TIMESTAMPTZ,
  annonce_validante_id UUID REFERENCES public.annonces(id) ON DELETE SET NULL,
  -- Renseigné quand le filleul partage son téléphone avec le parrain ou avec
  -- un autre filleul du même parrain. Sert à expliquer le blocage en admin.
  motif_blocage TEXT,
  CONSTRAINT invitation_pas_soi_meme CHECK (parrain_id <> filleul_id),
  CONSTRAINT invitation_statut_valide
    CHECK (statut IN ('en_attente', 'validee', 'bloquee', 'rejetee'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_parrain ON public.invitations(parrain_id);
CREATE INDEX IF NOT EXISTS idx_invitations_statut ON public.invitations(statut);

-- -------------------------------------------------------------------------
-- 3. CRÉDITS DE BOOST — la récompense, traçable un par un
-- -------------------------------------------------------------------------
-- Un compteur sur `users` aurait suffi à afficher un nombre, mais pas à
-- répondre à « d'où vient ce boost ? » ni à « ce crédit a-t-il déjà servi ? ».
-- Ici chaque crédit a une origine et, une fois consommé, l'annonce qu'il a
-- boostée. `invitation_id` est UNIQUE : un parrainage ne peut jamais créditer
-- deux fois, même si le trigger repasse.
CREATE TABLE IF NOT EXISTS public.credits_boost (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  origine TEXT NOT NULL DEFAULT 'invitation',
  invitation_id UUID UNIQUE REFERENCES public.invitations(id) ON DELETE SET NULL,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  utilise_le TIMESTAMPTZ,
  annonce_id UUID REFERENCES public.annonces(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_credits_boost_dispo
  ON public.credits_boost(user_id) WHERE utilise_le IS NULL;

-- -------------------------------------------------------------------------
-- 4. GÉNÉRATION DU CODE
-- -------------------------------------------------------------------------
-- Alphabet sans O/0/I/1/L : le code se lit à voix haute et se recopie à la
-- main, souvent sur un clavier de téléphone, parfois par quelqu'un qui lit
-- peu. Une confusion « O » / « zéro » fait perdre le parrainage.
CREATE OR REPLACE FUNCTION public.generer_code_invitation()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code TEXT;
  v_i INT;
  v_essais INT := 0;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::INT, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invitation_codes WHERE code = v_code);

    v_essais := v_essais + 1;
    IF v_essais > 50 THEN
      RAISE EXCEPTION 'Impossible de generer un code unique';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

-- -------------------------------------------------------------------------
-- 5. MON CODE — créé au premier appel, stable ensuite
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mon_code_invitation()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT code INTO v_code FROM public.invitation_codes WHERE user_id = v_uid;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := public.generer_code_invitation();
  INSERT INTO public.invitation_codes (user_id, code)
  VALUES (v_uid, v_code)
  -- Deux appels simultanés (deux écrans ouverts) ne doivent pas échouer :
  -- le second récupère simplement le code déjà écrit.
  ON CONFLICT (user_id) DO NOTHING;

  SELECT code INTO v_code FROM public.invitation_codes WHERE user_id = v_uid;
  RETURN v_code;
END;
$$;

-- -------------------------------------------------------------------------
-- 6. SAISIR UN CODE — réservé aux comptes neufs
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.saisir_code_invitation(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := upper(trim(coalesce(p_code, '')));
  v_parrain UUID;
  v_cree TIMESTAMPTZ;
  v_annonces INT;
  v_device TEXT;
  v_statut TEXT := 'en_attente';
  v_motif TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Connexion requise');
  END IF;

  IF EXISTS (SELECT 1 FROM public.invitations WHERE filleul_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Vous avez deja utilise un code');
  END IF;

  SELECT user_id INTO v_parrain FROM public.invitation_codes WHERE code = v_code;
  IF v_parrain IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Ce code n''existe pas');
  END IF;

  IF v_parrain = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'C''est votre propre code');
  END IF;

  -- Un code s'utilise en arrivant. Sans cette borne, les comptes déjà
  -- installés se parraineraient entre eux et le programme ne ferait venir
  -- personne de nouveau.
  SELECT date_creation, device_id INTO v_cree, v_device
  FROM public.users WHERE id = v_uid;

  IF v_cree IS NOT NULL AND v_cree < NOW() - INTERVAL '7 days' THEN
    RETURN jsonb_build_object('ok', false, 'erreur',
      'Un code ne peut etre saisi que dans les 7 jours suivant l''inscription');
  END IF;

  SELECT count(*) INTO v_annonces FROM public.annonces WHERE user_id = v_uid;
  IF v_annonces > 0 THEN
    RETURN jsonb_build_object('ok', false, 'erreur',
      'Vous avez deja publie une annonce : le code devait etre saisi avant');
  END IF;

  -- Même téléphone que le parrain, ou qu'un filleul déjà rattaché à ce
  -- parrain : on enregistre quand même (pour garder la trace du lien) mais
  -- rien n'est accordé tant qu'un admin n'a pas tranché.
  IF v_device IS NOT NULL AND v_device <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = v_parrain AND u.device_id = v_device
    ) THEN
      v_statut := 'bloquee';
      v_motif := 'Meme appareil que le parrain';
    ELSIF EXISTS (
      SELECT 1
      FROM public.invitations i
      JOIN public.users u ON u.id = i.filleul_id
      WHERE i.parrain_id = v_parrain AND u.device_id = v_device
    ) THEN
      v_statut := 'bloquee';
      v_motif := 'Meme appareil qu''un autre filleul de ce parrain';
    END IF;
  END IF;

  INSERT INTO public.invitations (parrain_id, filleul_id, statut, motif_blocage)
  VALUES (v_parrain, v_uid, v_statut, v_motif);

  RETURN jsonb_build_object(
    'ok', true,
    'statut', v_statut,
    -- L'application n'affiche jamais « bloquée » au filleul : il n'y est pour
    -- rien et n'a aucun moyen d'agir. Elle dit seulement ce qu'il doit faire.
    'message', 'Code accepte. Publiez votre premiere annonce pour que votre parrain recoive son boost.'
  );
END;
$$;

-- -------------------------------------------------------------------------
-- 7. VALIDATION AUTOMATIQUE — déclenchée par la première annonce du filleul
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valider_invitation_par_annonce()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
BEGIN
  -- Seule une annonce réellement en ligne compte.
  IF NEW.statut IS DISTINCT FROM 'active' OR NEW.est_payee IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE filleul_id = NEW.user_id AND statut = 'en_attente'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.invitations
  SET statut = 'validee',
      date_validation = NOW(),
      annonce_validante_id = NEW.id
  WHERE id = v_invitation.id;

  -- `invitation_id` est UNIQUE : si le trigger repasse (mise à jour du
  -- statut de l'annonce), aucun second crédit n'est créé.
  INSERT INTO public.credits_boost (user_id, origine, invitation_id)
  VALUES (v_invitation.parrain_id, 'invitation', v_invitation.id)
  ON CONFLICT (invitation_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  VALUES (
    v_invitation.parrain_id,
    'Vous avez gagne un boost gratuit',
    'Une personne que vous avez invitee vient de publier sa premiere annonce. Votre boost vous attend.',
    'invitation_validee',
    jsonb_build_object('invitation_id', v_invitation.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valider_invitation ON public.annonces;
CREATE TRIGGER trg_valider_invitation
  AFTER INSERT OR UPDATE OF statut, est_payee ON public.annonces
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_invitation_par_annonce();

-- -------------------------------------------------------------------------
-- 8. MES STATISTIQUES — tout ce que l'écran affiche, en un appel
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mes_stats_invitation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_valides INT;
  v_attente INT;
  v_credits INT;
  v_requis CONSTANT INT := 5;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT
    count(*) FILTER (WHERE statut = 'validee'),
    -- « bloquee » est compté avec l'attente : le parrain n'a pas à savoir
    -- qu'un de ses filleuls est suspecté, et il n'y peut rien.
    count(*) FILTER (WHERE statut IN ('en_attente', 'bloquee'))
  INTO v_valides, v_attente
  FROM public.invitations WHERE parrain_id = v_uid;

  SELECT count(*) INTO v_credits
  FROM public.credits_boost
  WHERE user_id = v_uid AND utilise_le IS NULL;

  RETURN jsonb_build_object(
    'code', public.mon_code_invitation(),
    'filleuls_valides', v_valides,
    'filleuls_en_attente', v_attente,
    'boosts_disponibles', v_credits,
    'concours_requis', v_requis,
    'concours_participe', v_valides >= v_requis,
    'concours_manque', GREATEST(v_requis - v_valides, 0)
  );
END;
$$;

-- -------------------------------------------------------------------------
-- 9. UTILISER UN BOOST GRATUIT
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.utiliser_credit_boost(p_annonce_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_credit UUID;
  v_vues INT;
  v_expire TIMESTAMPTZ := NOW() + INTERVAL '48 hours';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Connexion requise');
  END IF;

  SELECT coalesce(nombre_vues, 0) INTO v_vues
  FROM public.annonces
  WHERE id = p_annonce_id AND user_id = v_uid AND statut = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Annonce introuvable');
  END IF;

  -- `FOR UPDATE SKIP LOCKED` : deux appuis rapides sur le bouton ne peuvent
  -- pas consommer deux fois le même crédit.
  SELECT id INTO v_credit
  FROM public.credits_boost
  WHERE user_id = v_uid AND utilise_le IS NULL
  ORDER BY date_creation
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_credit IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Aucun boost gratuit disponible');
  END IF;

  -- `boost_prix` DOIT valoir 0 : un trigger journalise tout boost au prix non
  -- nul comme un encaissement réel. Écrire 250 ici fabriquerait un chiffre
  -- d'affaires qui n'a jamais été encaissé.
  UPDATE public.annonces
  SET boost_expire_le = v_expire,
      boost_paye_le = NOW(),
      boost_vues_avant = v_vues,
      boost_prix = 0,
      boost_transaction_id = NULL
  WHERE id = p_annonce_id;

  UPDATE public.credits_boost
  SET utilise_le = NOW(), annonce_id = p_annonce_id
  WHERE id = v_credit;

  RETURN jsonb_build_object('ok', true, 'expire_le', v_expire);
END;
$$;

-- -------------------------------------------------------------------------
-- 10. CÔTÉ ADMIN — concours et déblocages
-- -------------------------------------------------------------------------
-- Les participants au tirage : cinq parrainages validés au minimum.
CREATE OR REPLACE VIEW public.v_concours_participants AS
SELECT
  i.parrain_id,
  u.prenom,
  u.nom,
  u.num_telephone,
  u.telephone,
  count(*) FILTER (WHERE i.statut = 'validee') AS filleuls_valides,
  max(i.date_validation) FILTER (WHERE i.statut = 'validee') AS dernier_parrainage
FROM public.invitations i
JOIN public.users u ON u.id = i.parrain_id
GROUP BY i.parrain_id, u.prenom, u.nom, u.num_telephone, u.telephone
HAVING count(*) FILTER (WHERE i.statut = 'validee') >= 5;

-- Les parrainages mis de côté pour appareil partagé, à trancher à la main.
CREATE OR REPLACE VIEW public.v_invitations_bloquees AS
SELECT
  i.id,
  i.date_saisie,
  i.motif_blocage,
  p.prenom AS parrain_prenom,
  p.nom AS parrain_nom,
  p.device_id AS parrain_device,
  f.prenom AS filleul_prenom,
  f.nom AS filleul_nom,
  f.device_id AS filleul_device
FROM public.invitations i
JOIN public.users p ON p.id = i.parrain_id
JOIN public.users f ON f.id = i.filleul_id
WHERE i.statut = 'bloquee';

-- Débloquer : le parrainage repart en attente et suivra le chemin normal
-- (il sera validé quand le filleul publiera, ou l'est immédiatement s'il a
-- déjà publié entre-temps).
CREATE OR REPLACE FUNCTION public.debloquer_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
  v_annonce UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Reserve a l''administration');
  END IF;

  SELECT * INTO v_invitation FROM public.invitations
  WHERE id = p_invitation_id AND statut = 'bloquee';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Parrainage introuvable ou deja traite');
  END IF;

  SELECT id INTO v_annonce FROM public.annonces
  WHERE user_id = v_invitation.filleul_id AND statut = 'active' AND est_payee
  ORDER BY date_creation LIMIT 1;

  IF v_annonce IS NULL THEN
    UPDATE public.invitations SET statut = 'en_attente', motif_blocage = NULL
    WHERE id = p_invitation_id;
    RETURN jsonb_build_object('ok', true, 'statut', 'en_attente');
  END IF;

  UPDATE public.invitations
  SET statut = 'validee', date_validation = NOW(),
      annonce_validante_id = v_annonce, motif_blocage = NULL
  WHERE id = p_invitation_id;

  INSERT INTO public.credits_boost (user_id, origine, invitation_id)
  VALUES (v_invitation.parrain_id, 'invitation', v_invitation.id)
  ON CONFLICT (invitation_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'statut', 'validee');
END;
$$;

-- -------------------------------------------------------------------------
-- 11. RLS — on lit ce qui nous concerne, on n'écrit jamais directement
-- -------------------------------------------------------------------------
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_boost ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitation_codes_lecture ON public.invitation_codes;
CREATE POLICY invitation_codes_lecture ON public.invitation_codes
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS invitations_lecture ON public.invitations;
CREATE POLICY invitations_lecture ON public.invitations
  FOR SELECT USING (parrain_id = auth.uid() OR filleul_id = auth.uid());

DROP POLICY IF EXISTS credits_boost_lecture ON public.credits_boost;
CREATE POLICY credits_boost_lecture ON public.credits_boost
  FOR SELECT USING (user_id = auth.uid());

-- Aucune policy d'INSERT/UPDATE/DELETE : tout passe par les fonctions
-- SECURITY DEFINER ci-dessus. Un client qui tenterait d'écrire un crédit
-- lui-même se verrait simplement refuser.

-- Les deux vues d'administration portent des noms et des numeros de
-- telephone. Supabase accorde par defaut la lecture des nouvelles tables aux
-- roles anon et authenticated : sans ces revocations, n'importe quel compte
-- connecte pourrait lire l'annuaire des participants au concours.
REVOKE ALL ON public.v_concours_participants FROM anon, authenticated;
REVOKE ALL ON public.v_invitations_bloquees FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mon_code_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.saisir_code_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mes_stats_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.utiliser_credit_boost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debloquer_invitation(UUID) TO authenticated;

COMMIT;
