-- =========================================================================
-- CONFIDENTIALITÉ — qui suit quelle boutique cesse d'être public
-- Idempotente. À exécuter avant la mise en avant des abonnés côté PRO.
-- =========================================================================
-- Constaté le 2026-08-21 sur la base de production : un appel ANONYME à
-- l'API renvoie la liste complète des abonnements, jointure sur les profils
-- comprise — donc « Soumaila Touré suit telle boutique », lisible par
-- n'importe qui, sans compte.
--
-- Ce n'est pas un oubli du code applicatif : c'est la politique RLS elle-même
-- qui autorise tout le monde. Elle contredit d'ailleurs son propre
-- commentaire d'origine, qui annonçait « chacun ne voit le détail (qui suit
-- quoi) que pour ses propres follows ». Seule la première moitié de
-- l'intention avait été écrite.
--
-- Pourquoi ça compte : les abonnements d'une personne dessinent ses centres
-- d'intérêt et ses habitudes d'achat. Sur un marché où tout le monde se
-- connaît, savoir qui suit la boutique d'électronique, la pharmacie ou le
-- concessionnaire n'est pas anodin. Et l'utilisateur n'a jamais été prévenu
-- que ce geste était public.
--
-- ── Ce que la migration change ───────────────────────────────────────────
--   1. la liste nominative devient visible du SEUL abonné et du SEUL
--      propriétaire de la boutique concernée ;
--   2. le COMPTEUR, lui, reste public — il doit s'afficher sur la vitrine
--      pour tout visiteur. Il passe par une vue d'agrégats qui n'expose
--      aucune identité.
--
-- ⚠️ La contrepartie est côté application : compter les lignes ne fonctionne
-- plus pour un visiteur, puisqu'il n'en voit aucune. `useBoutiqueFollow` doit
-- lire le compteur dans la vue. Les deux vont ensemble.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. La lecture nominative se restreint
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Follows publics en lecture" ON public.boutique_follows;

DROP POLICY IF EXISTS "Chacun voit ses abonnements" ON public.boutique_follows;
CREATE POLICY "Chacun voit ses abonnements" ON public.boutique_follows
  FOR SELECT USING (auth.uid() = follower_id);

-- Le professionnel voit qui le suit : c'est la fonctionnalite ajoutee cote PRO.
DROP POLICY IF EXISTS "La boutique voit ses abonnes" ON public.boutique_follows;
CREATE POLICY "La boutique voit ses abonnes" ON public.boutique_follows
  FOR SELECT USING (auth.uid() = boutique_id);

-- -------------------------------------------------------------------------
-- 2. Le compteur reste public, sans aucune identité
-- -------------------------------------------------------------------------
-- Vue SANS `security_invoker` : elle s'exécute avec les droits de son
-- propriétaire et voit donc toutes les lignes — c'est voulu ici, puisqu'elle
-- n'expose qu'un nombre. C'est exactement le mécanisme qui avait causé une
-- fuite sur `v_job_sante` ; utilisé sciemment, il rend le service inverse.
CREATE OR REPLACE VIEW public.v_boutique_abonnes AS
SELECT boutique_id, COUNT(*)::INTEGER AS nb_abonnes
FROM public.boutique_follows
GROUP BY boutique_id;

COMMENT ON VIEW public.v_boutique_abonnes IS
  'Nombre d''abonnes par boutique, sans aucune identite. Publique a dessein : '
  'le compteur s''affiche sur chaque vitrine. Ne JAMAIS y ajouter follower_id.';

GRANT SELECT ON public.v_boutique_abonnes TO anon, authenticated;

COMMIT;

-- =========================================================================
-- 3. Vérification
-- =========================================================================
-- Politiques en place sur la table :
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'boutique_follows'
ORDER BY policyname;

-- Le compteur reste lisible :
SELECT * FROM public.v_boutique_abonnes ORDER BY nb_abonnes DESC LIMIT 5;

-- À refaire depuis l'extérieur avec la clé anonyme : la première requête doit
-- renvoyer un tableau VIDE, la seconde doit continuer de répondre.
--   GET /rest/v1/boutique_follows?select=follower_id
--   GET /rest/v1/v_boutique_abonnes?select=boutique_id,nb_abonnes

-- =========================================================================
-- ROLLBACK (rétablit la fuite — à n'utiliser qu'en cas d'urgence)
-- =========================================================================
-- DROP VIEW IF EXISTS public.v_boutique_abonnes;
-- DROP POLICY IF EXISTS "Chacun voit ses abonnements" ON public.boutique_follows;
-- DROP POLICY IF EXISTS "La boutique voit ses abonnes" ON public.boutique_follows;
-- CREATE POLICY "Follows publics en lecture" ON public.boutique_follows
--   FOR SELECT USING (true);
