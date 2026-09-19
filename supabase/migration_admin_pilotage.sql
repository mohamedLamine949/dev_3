-- =========================================================================
-- MIGRATION : CONSOLE ADMIN — PILOTAGE (parrainage ouvert + statistiques)
-- =========================================================================
-- Prérequis : migration_admin_rls.sql (is_admin), migration_invitations.sql,
--             migration_p2c_contacts.sql. Idempotente.
--
-- Le parrainage ouvert (migration_invitations.sql) ne laisse chaque compte
-- lire que SES lignes, et ses deux vues d'administration sont révoquées pour
-- `authenticated` — rôle sous lequel tourne la console. Résultat : l'admin
-- n'avait aucun moyen de savoir qui a parrainé qui, ni qui entre au tirage.
--
-- Même chose pour `contact_events` (mises en relation), lisible par le seul
-- vendeur : c'est pourtant LA métrique centrale du produit.
--
-- Ici on ajoute des policies de LECTURE réservées aux admins (is_admin()),
-- sur le modèle de migration_admin_rls.sql. Elles se combinent en OR avec
-- les policies existantes : rien ne change pour les utilisateurs. Aucune
-- écriture directe n'est ouverte ; le seul geste admin (rejeter un
-- parrainage frauduleux) passe par une fonction SECURITY DEFINER.
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS invitation_codes_admin_lecture ON public.invitation_codes;
CREATE POLICY invitation_codes_admin_lecture ON public.invitation_codes
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS invitations_admin_lecture ON public.invitations;
CREATE POLICY invitations_admin_lecture ON public.invitations
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS credits_boost_admin_lecture ON public.credits_boost;
CREATE POLICY credits_boost_admin_lecture ON public.credits_boost
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS contact_events_admin_lecture ON public.contact_events;
CREATE POLICY contact_events_admin_lecture ON public.contact_events
  FOR SELECT USING (public.is_admin());

-- -------------------------------------------------------------------------
-- REJETER UN PARRAINAGE — fraude avérée (faux compte, annonce bidon)
-- -------------------------------------------------------------------------
-- Un parrainage rejeté ne compte plus pour le tirage. Si le boost qu'il a
-- rapporté n'a pas encore servi, il est retiré ; s'il a déjà servi, on ne
-- touche pas à l'annonce boostée (le boost expire de lui-même en 48 h).
-- Le trigger de validation ne reprend que les lignes « en_attente » : un
-- rejet est donc définitif, même si le filleul republie.
CREATE OR REPLACE FUNCTION public.rejeter_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statut TEXT;
  v_credit_retire INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Reserve a l''administration');
  END IF;

  SELECT statut INTO v_statut FROM public.invitations
  WHERE id = p_invitation_id FOR UPDATE;

  IF v_statut IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Parrainage introuvable');
  END IF;
  IF v_statut = 'rejetee' THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Deja rejete');
  END IF;

  UPDATE public.invitations
  SET statut = 'rejetee',
      motif_blocage = coalesce(motif_blocage, 'Rejete par l''administration')
  WHERE id = p_invitation_id;

  DELETE FROM public.credits_boost
  WHERE invitation_id = p_invitation_id AND utilise_le IS NULL;
  GET DIAGNOSTICS v_credit_retire = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'credit_retire', v_credit_retire > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rejeter_invitation(UUID) TO authenticated;

-- -------------------------------------------------------------------------
-- SONDE — la console sait-elle lire ?
-- -------------------------------------------------------------------------
-- Sans policy, un SELECT ne renvoie pas d'erreur mais ZÉRO ligne : la
-- console afficherait « 0 parrainage, 0 contact » comme si c'était la
-- réalité. Elle appelle donc cette fonction d'abord : si elle n'existe pas,
-- la migration n'est pas passée et la console le dit au lieu d'afficher 0.
CREATE OR REPLACE FUNCTION public.admin_pilotage_installe()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

GRANT EXECUTE ON FUNCTION public.admin_pilotage_installe() TO authenticated;

COMMIT;
