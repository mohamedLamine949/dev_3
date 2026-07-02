-- =========================================================================
-- MIGRATION : Système d'expiration et de renouvellement des annonces
-- =========================================================================
-- Cycle de vie d'une annonce :
--   J0        : publication (statut 'active')
--   J+20      : notification "il reste 10 jours, renouvelez gratuitement"
--   J+30      : expiration automatique (statut 'expire', invisible au public)
--   J+60      : suppression définitive (avec images/conversations en cascade)
-- Le renouvellement (gratuit, depuis "Mes annonces") remet date_creation à
-- maintenant et le statut à 'active', ce qui repart pour 30 jours.
-- =========================================================================

BEGIN;

-- 1. Colonne anti-doublon pour la notification d'expiration
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS expiration_notifiee BOOLEAN DEFAULT FALSE;

-- 2. Fonction de traitement quotidien
CREATE OR REPLACE FUNCTION public.process_annonces_expiration()
RETURNS void AS $$
BEGIN
  -- a) Notifier les annonces qui expirent dans 10 jours (une seule fois)
  WITH a_notifier AS (
    UPDATE public.annonces
    SET expiration_notifiee = TRUE
    WHERE statut = 'active'
      AND date_creation <= NOW() - INTERVAL '20 days'
      AND expiration_notifiee = FALSE
    RETURNING id, user_id, titre
  )
  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  SELECT
    user_id,
    'Votre annonce expire bientôt ⏳',
    'Votre annonce "' || titre || '" expire dans 10 jours. Renouvelez-la gratuitement depuis "Mes annonces" pour la garder en ligne.',
    'expiration_bientot',
    jsonb_build_object('annonceId', id)
  FROM a_notifier
  WHERE user_id IS NOT NULL; -- annonces orphelines : pas de destinataire à notifier

  -- b) Expirer les annonces de plus de 30 jours (retirées du public,
  --    encore renouvelables depuis "Mes annonces")
  WITH a_expirer AS (
    UPDATE public.annonces
    SET statut = 'expire'
    WHERE statut = 'active'
      AND date_creation <= NOW() - INTERVAL '30 days'
    RETURNING id, user_id, titre
  )
  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  SELECT
    user_id,
    'Annonce expirée 📦',
    'Votre annonce "' || titre || '" a expiré après 30 jours. Vous pouvez encore la renouveler gratuitement depuis "Mes annonces".',
    'annonce_expiree',
    jsonb_build_object('annonceId', id)
  FROM a_expirer
  WHERE user_id IS NOT NULL; -- annonces orphelines : pas de destinataire à notifier

  -- c) Supprimer définitivement les annonces expirées depuis plus de 30 jours
  --    (soit 60 jours après publication ; images et conversations suivent en cascade)
  DELETE FROM public.annonces
  WHERE statut = 'expire'
    AND date_creation <= NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- 3. Planification quotidienne à 08h00 UTC (08h00 à Bamako) via pg_cron
--    (extension disponible sur Supabase : Dashboard > Database > Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Supprimer l'ancienne tâche si elle existe, puis (re)planifier
DO $$
BEGIN
  PERFORM cron.unschedule('annonces-expiration');
EXCEPTION WHEN OTHERS THEN
  NULL; -- la tâche n'existait pas encore
END;
$$;

SELECT cron.schedule(
  'annonces-expiration',
  '0 8 * * *',
  $$SELECT public.process_annonces_expiration()$$
);

-- 4. Exécution immédiate pour rattraper l'existant (optionnel mais recommandé)
SELECT public.process_annonces_expiration();
