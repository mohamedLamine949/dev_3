-- =========================================================================
-- MIGRATION : Push hebdomadaire de preuve aux vendeurs PRO
-- À exécuter dans le SQL Editor. Idempotente.
-- =========================================================================
-- « Dans un marché où personne ne paie sans preuve, on livre la preuve
--   toutes les semaines. » (spec refonte PRO, 2026-07-12)
--
-- Chaque lundi 9h (Bamako), chaque vendeur PRO actif reçoit :
--   « 📊 Votre boutique cette semaine : 340 vues, 3 commandes, 45 000 F »
--
-- - Les vues d'annonces sont un compteur CUMULÉ (annonces.nombre_vues) :
--   on prend un instantané par vendeur chaque semaine et la différence
--   donne les vues de la semaine.
-- - Jamais de notification creuse : si rien ne s'est passé (0 vue,
--   0 commande), on ne dérange pas.
-- - Push direct via push_direct() (migration_notifications_v3) : pas de
--   pollution de la liste in-app.
-- =========================================================================

BEGIN;

-- 1. Instantanés hebdomadaires des vues cumulées par vendeur
CREATE TABLE IF NOT EXISTS public.boutique_vues_snapshots (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date_snapshot DATE NOT NULL DEFAULT CURRENT_DATE,
  total_vues BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_snapshot)
);

-- Table interne : personne n'y accède via l'API
ALTER TABLE public.boutique_vues_snapshots ENABLE ROW LEVEL SECURITY;

-- 2. La fonction hebdomadaire
CREATE OR REPLACE FUNCTION public.envoyer_stats_hebdo_vendeurs()
RETURNS void AS $$
DECLARE
  v RECORD;
  vues_semaine BIGINT;
  parties TEXT[];
  corps TEXT;
  lot JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.marketing_actif() THEN RETURN; END IF;

  FOR v IN
    SELECT
      u.id, u.push_token,
      -- total de vues cumulées sur ses annonces en ligne
      COALESCE((SELECT SUM(COALESCE(a.nombre_vues, 0)) FROM public.annonces a
                WHERE a.user_id = u.id AND a.statut IN ('active', 'vendu')), 0) AS vues_total,
      -- dernier instantané connu
      (SELECT s.total_vues FROM public.boutique_vues_snapshots s
       WHERE s.user_id = u.id ORDER BY s.date_snapshot DESC LIMIT 1) AS vues_snapshot,
      -- commandes reçues sur 7 jours (hors annulées/refusées)
      (SELECT COUNT(*) FROM public.commandes c
       WHERE c.vendeur_id = u.id
         AND c.date_creation >= NOW() - INTERVAL '7 days'
         AND c.statut NOT IN ('annulee', 'refusee')) AS commandes_semaine,
      -- recettes des commandes livrées sur 7 jours
      COALESCE((SELECT SUM(c.prix * c.quantite) FROM public.commandes c
                WHERE c.vendeur_id = u.id
                  AND c.statut = 'livree'
                  AND c.date_maj >= NOW() - INTERVAL '7 days'), 0) AS recettes_semaine
    FROM public.users u
    WHERE u.type_compte = 'professionnel'
      AND COALESCE(u.statut, 'actif') = 'actif'
      AND u.push_token LIKE 'ExponentPushToken[%]'
      AND EXISTS (SELECT 1 FROM public.annonces a
                  WHERE a.user_id = u.id AND a.statut IN ('active', 'vendu'))
  LOOP
    -- Vues de la semaine = cumul actuel - dernier instantané
    -- (1re semaine : pas d'instantané -> on ne peut pas encore parler de vues)
    vues_semaine := CASE
      WHEN v.vues_snapshot IS NULL THEN NULL
      ELSE GREATEST(0, v.vues_total - v.vues_snapshot)
    END;

    -- Enregistre l'instantané de cette semaine (idempotent sur le jour)
    INSERT INTO public.boutique_vues_snapshots (user_id, date_snapshot, total_vues)
    VALUES (v.id, CURRENT_DATE, v.vues_total)
    ON CONFLICT (user_id, date_snapshot) DO UPDATE SET total_vues = EXCLUDED.total_vues;

    -- Compose le message avec uniquement ce qui est non nul (jamais creux)
    parties := ARRAY[]::TEXT[];
    IF vues_semaine IS NOT NULL AND vues_semaine > 0 THEN
      parties := parties || (vues_semaine || ' personnes ont vu vos produits');
    END IF;
    IF v.commandes_semaine > 0 THEN
      parties := parties || (v.commandes_semaine || ' commande' || CASE WHEN v.commandes_semaine > 1 THEN 's' ELSE '' END || ' reçue' || CASE WHEN v.commandes_semaine > 1 THEN 's' ELSE '' END);
    END IF;
    IF v.recettes_semaine > 0 THEN
      parties := parties || (TO_CHAR(v.recettes_semaine, 'FM999G999G999') || ' F de recettes');
    END IF;

    CONTINUE WHEN COALESCE(array_length(parties, 1), 0) = 0;

    corps := array_to_string(parties, ' · ') || '. Continuez comme ça 💪';

    lot := lot || jsonb_build_object(
      'to', v.push_token, 'sound', 'default',
      'title', 'Votre boutique cette semaine 📊',
      'body', corps
    );
  END LOOP;

  PERFORM public.push_direct(lot);

  -- Hygiène : on garde 12 semaines d'instantanés
  DELETE FROM public.boutique_vues_snapshots
  WHERE date_snapshot < CURRENT_DATE - INTERVAL '84 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- 3. Planification : chaque lundi 9h00 (Bamako = UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN PERFORM cron.unschedule('boutiques-stats-hebdo'); EXCEPTION WHEN OTHERS THEN NULL; END; $$;
SELECT cron.schedule('boutiques-stats-hebdo', '0 9 * * 1',
  $$SELECT public.envoyer_stats_hebdo_vendeurs()$$);

-- =========================================================================
-- TEST IMMÉDIAT (crée les premiers instantanés ; les vues n'apparaîtront
-- qu'à partir de la 2e exécution, les commandes/recettes tout de suite) :
--   SELECT public.envoyer_stats_hebdo_vendeurs();
-- =========================================================================
