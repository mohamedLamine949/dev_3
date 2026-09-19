-- =========================================================================
-- MIGRATION : PARRAINAGE — BOOSTS PAR PALIERS (3e et 5e filleul)
-- =========================================================================
-- Prérequis : migration_invitations.sql. Idempotente.
--
-- Décision du 2026-09-19. Avant : chaque filleul validé rapportait un boost.
-- Cinq filleuls = cinq boosts ; cent parrains = cinq cents boosts gratuits,
-- et le boost payant n'aurait plus aucune valeur.
--
-- Désormais :
--   - 3e filleul validé  -> 1 boost gratuit ;
--   - 5e filleul validé  -> 1 boost de plus ET participation au tirage ;
--   - au-delà : plus aucun boost. Au plus DEUX boosts par parrain.
--
-- Les boosts déjà gagnés sont conservés. Ils comptent dans le plafond de
-- deux : un parrain qui en a déjà reçu un avec l'ancienne règle n'en reçoit
-- pas au 3e filleul, mais reçoit le second au 5e. Personne ne dépasse deux.
--
-- Le tirage ne change pas : cinq filleuls validés (v_concours_participants).
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- Palier : appelé après chaque validation. Décide du boost et prévient le
-- parrain de sa progression (le boost n'étant plus immédiat, un parrainage
-- réussi sans message laisserait croire que rien ne s'est passé).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.appliquer_palier_invitation(
  p_parrain_id UUID,
  p_invitation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valides INT;
  v_credits INT;
  v_palier INT;          -- 1 au 3e filleul, 2 au 5e, sinon NULL
  v_boost BOOLEAN := false;
  v_titre TEXT;
  v_contenu TEXT;
BEGIN
  -- Deux filleuls qui publient au même instant ne doivent pas être comptés
  -- tous les deux « 3e » : on sérialise par parrain.
  PERFORM pg_advisory_xact_lock(hashtext('parrainage:' || p_parrain_id::text));

  SELECT count(*) INTO v_valides
  FROM public.invitations
  WHERE parrain_id = p_parrain_id AND statut = 'validee';

  v_palier := CASE v_valides WHEN 3 THEN 1 WHEN 5 THEN 2 ELSE NULL END;

  IF v_palier IS NOT NULL THEN
    SELECT count(*) INTO v_credits
    FROM public.credits_boost
    WHERE user_id = p_parrain_id AND origine = 'invitation';

    IF v_credits < v_palier THEN
      INSERT INTO public.credits_boost (user_id, origine, invitation_id)
      VALUES (p_parrain_id, 'invitation', p_invitation_id)
      ON CONFLICT (invitation_id) DO NOTHING;
      v_boost := FOUND;
    END IF;
  END IF;

  -- Textes sans emoji, comme toutes les notifications de l'application.
  IF v_valides = 5 THEN
    v_titre := 'Vous participez au tirage de 100 000 FCFA';
    v_contenu := CASE WHEN v_boost
      THEN 'Cinq personnes invitees ont publie une annonce. Vous etes inscrit au tirage, et un boost gratuit vous attend.'
      ELSE 'Cinq personnes invitees ont publie une annonce. Vous etes inscrit au tirage.' END;
  ELSIF v_valides = 3 AND v_boost THEN
    v_titre := 'Vous avez gagne un boost gratuit';
    v_contenu := 'Trois personnes invitees ont publie une annonce. Votre boost vous attend. Encore 2 pour participer au tirage de 100 000 FCFA.';
  ELSIF v_valides < 5 THEN
    v_titre := 'Parrainage reussi : ' || v_valides || ' sur 5';
    v_contenu := CASE
      WHEN v_valides < 3 THEN 'Une personne invitee vient de publier sa premiere annonce. Encore ' || (3 - v_valides) || ' pour gagner un boost gratuit.'
      ELSE 'Une personne invitee vient de publier sa premiere annonce. Encore ' || (5 - v_valides) || ' pour participer au tirage de 100 000 FCFA.' END;
  ELSE
    v_titre := 'Parrainage reussi';
    v_contenu := 'Une personne de plus a publie grace a vous : ' || v_valides || ' au total. Merci !';
  END IF;

  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  VALUES (
    p_parrain_id, v_titre, v_contenu, 'invitation_validee',
    jsonb_build_object('invitation_id', p_invitation_id)
  );
END;
$$;

-- La fonction n'est appelée que par les deux fonctions ci-dessous ; aucun
-- client ne doit pouvoir s'attribuer un palier.
REVOKE ALL ON FUNCTION public.appliquer_palier_invitation(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------------------
-- Validation automatique (première annonce du filleul) — même déclencheur,
-- mais le boost passe par le palier.
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

  PERFORM public.appliquer_palier_invitation(v_invitation.parrain_id, v_invitation.id);

  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------------
-- Déblocage admin (appareil partagé) — même règle de palier.
-- -------------------------------------------------------------------------
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

  PERFORM public.appliquer_palier_invitation(v_invitation.parrain_id, v_invitation.id);

  RETURN jsonb_build_object('ok', true, 'statut', 'validee');
END;
$$;

-- -------------------------------------------------------------------------
-- Statistiques de l'écran Parrainage : on ajoute les paliers, pour que
-- l'application affiche « encore N pour un boost » sans recalculer la règle.
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
    'concours_manque', GREATEST(v_requis - v_valides, 0),
    -- Filleuls qui débloquent un boost. L'application les marque d'une
    -- flamme sur la jauge.
    'paliers_boost', jsonb_build_array(3, 5)
  );
END;
$$;

COMMIT;
