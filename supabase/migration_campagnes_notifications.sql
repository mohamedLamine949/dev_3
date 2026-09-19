-- =========================================================================
-- MIGRATION : CAMPAGNES DE NOTIFICATIONS DEPUIS LA CONSOLE ADMIN
-- =========================================================================
-- Prérequis : migration_admin_rls.sql (is_admin), migration_notifications*.sql
--             (table notifications + push). Idempotente.
--
-- Décision du 2026-09-19 : on ne relance PAS les utilisateurs par WhatsApp
-- (intrusif, et depuis un numéro personnel). Les messages ciblés passent par
-- l'application : une ligne dans `notifications` = une notification dans
-- l'écran Notifications ET un push sur le téléphone (trigger existant).
--
-- La console compose un message par personne (prénom, code de parrainage…)
-- et les envoie en un appel. La fonction :
--   - refuse tout appelant non admin ;
--   - n'accepte qu'un écran de destination connu (liste fermée) ;
--   - garde une trace de chaque campagne (qui, quand, combien, quel groupe),
--     pour ne pas relancer deux fois les mêmes personnes par erreur.
-- =========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.campagnes_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL,
  titre TEXT NOT NULL,
  modele TEXT NOT NULL,
  ecran TEXT,
  nb_destinataires INT NOT NULL,
  envoye_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_envoi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campagnes_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campagnes_admin_lecture ON public.campagnes_notifications;
CREATE POLICY campagnes_admin_lecture ON public.campagnes_notifications
  FOR SELECT USING (public.is_admin());

-- p_messages : [{ "user_id": "...", "titre": "...", "contenu": "..." }, ...]
CREATE OR REPLACE FUNCTION public.admin_envoyer_campagne(
  p_segment  TEXT,
  p_modele   TEXT,
  p_ecran    TEXT,
  p_messages JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campagne UUID;
  v_nb INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Reserve a l''administration');
  END IF;

  -- Liste fermée : l'application ne sait ouvrir que ces écrans depuis une
  -- notification. Une valeur inconnue donnerait une notification morte.
  IF p_ecran IS NOT NULL AND p_ecran NOT IN ('Invitations', 'Publier', 'BoosterMesAnnonces', 'MesAnnonces') THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Ecran de destination inconnu');
  END IF;

  IF jsonb_typeof(p_messages) <> 'array' OR jsonb_array_length(p_messages) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Aucun destinataire');
  END IF;

  IF jsonb_array_length(p_messages) > 5000 THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'Trop de destinataires en une fois (5000 max)');
  END IF;

  INSERT INTO public.campagnes_notifications (segment, titre, modele, ecran, nb_destinataires, envoye_par)
  VALUES (
    p_segment,
    coalesce(p_messages->0->>'titre', ''),
    p_modele,
    p_ecran,
    jsonb_array_length(p_messages),
    auth.uid()
  )
  RETURNING id INTO v_campagne;

  -- Seuls les comptes qui existent encore reçoivent : un destinataire
  -- supprimé entre-temps est ignoré au lieu de faire échouer tout l'envoi.
  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  SELECT
    u.id,
    left(m->>'titre', 120),
    left(m->>'contenu', 1000),
    'campagne',
    jsonb_strip_nulls(jsonb_build_object('ecran', p_ecran, 'campagneId', v_campagne))
  FROM jsonb_array_elements(p_messages) AS m
  JOIN public.users u ON u.id = (m->>'user_id')::uuid
  WHERE coalesce(m->>'titre', '') <> '' AND coalesce(m->>'contenu', '') <> '';

  GET DIAGNOSTICS v_nb = ROW_COUNT;

  UPDATE public.campagnes_notifications SET nb_destinataires = v_nb WHERE id = v_campagne;

  RETURN jsonb_build_object('ok', true, 'envoyes', v_nb, 'campagne_id', v_campagne);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_envoyer_campagne(TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMIT;
