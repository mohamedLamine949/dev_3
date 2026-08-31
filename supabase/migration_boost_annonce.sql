-- =====================================================================
-- BOOST PAYANT D'ANNONCE (250 FCFA)
-- À exécuter dans le SQL Editor Supabase. Idempotent : ré-exécutable sans
-- risque.
--
-- Un vendeur paie pour rendre UNE annonce prioritaire dans le fil d'accueil
-- et dans la recherche pendant sa durée (voir BOOST_DURATION_HOURS côté
-- app, app/src/hooks/useBoost.ts). `boost_vues_avant` capture le nombre de
-- vues au moment du paiement pour pouvoir calculer, sur l'écran de
-- résultats, les vues gagnées DEPUIS le boost.
-- =====================================================================

ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS boost_expire_le TIMESTAMPTZ;
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS boost_paye_le TIMESTAMPTZ;
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS boost_vues_avant INTEGER;
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS boost_prix INTEGER;

CREATE INDEX IF NOT EXISTS idx_annonces_boost_expire
  ON public.annonces(boost_expire_le) WHERE boost_expire_le IS NOT NULL;

-- Purge paresseuse des boosts expirés. Un boost actif fait remonter
-- l'annonce (tri par boost_expire_le avant date_creation) ; sans purge, une
-- annonce dont le boost est terminé resterait en tête indéfiniment car la
-- colonne resterait non-NULL. Plutôt qu'un cron (pg_cron pas garanti sur
-- tous les plans Supabase), l'app appelle cette RPC à chaque chargement du
-- fil (useAnnonces.ts) — coût quasi nul, l'index ne retient que les lignes
-- encore boostées.
--
-- SECURITY DEFINER : un visiteur qui charge le fil doit pouvoir nettoyer le
-- boost expiré d'une annonce qui n'est pas la sienne (la policy normale
-- "Users can update own ads" ne l'y autoriserait pas). La fonction ne fait
-- qu'UNE seule chose, sur une seule colonne, uniquement quand la date est
-- déjà dépassée — aucune donnée manipulable par l'appelant.
CREATE OR REPLACE FUNCTION public.expirer_boosts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.annonces
  SET boost_expire_le = NULL
  WHERE boost_expire_le IS NOT NULL AND boost_expire_le < NOW();
$$;

GRANT EXECUTE ON FUNCTION public.expirer_boosts() TO anon, authenticated;
