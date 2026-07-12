-- =========================================================================
-- MIGRATION : Boutiques PRO — Phase 1 (catalogue, stock, masquage, infos)
-- À exécuter dans le SQL Editor du dashboard Supabase. Idempotente.
-- =========================================================================
-- Spec (mémoire refonte-pro, 2026-07-12) :
--   - Produit boutique = annonce enrichie : stock + visible (pas de table
--     catalogue séparée, toute l'infra annonces est réutilisée).
--   - Masquage par RLS : un produit visible=FALSE disparaît de TOUTES les
--     surfaces publiques (recherche, accueil, favoris) sans modifier une
--     seule requête de l'app ; seuls le propriétaire et l'admin le voient.
--   - Les produits des comptes PRO n'expirent JAMAIS tant qu'ils sont en
--     stock (stock NULL = non géré = considéré en stock).
--   - Infos boutique portées par users : slug (lien partageable), quartier,
--     adresse, horaires (texte libre v1), politique de livraison + frais.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. ANNONCES : stock + masquage
-- -------------------------------------------------------------------------
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS stock INTEGER;
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_annonces_visible ON public.annonces(visible) WHERE NOT visible;

-- Masquage par RLS : remplace la lecture publique inconditionnelle.
-- (Policies en OR avec celles des admins : l'admin garde tout.)
DROP POLICY IF EXISTS "Ads are public" ON public.annonces;
CREATE POLICY "Ads are public" ON public.annonces
  FOR SELECT USING (visible OR auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 2. USERS : identité de la boutique
-- -------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nom_boutique TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS boutique_slug TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quartier_boutique TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS adresse_boutique TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS horaires TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS livraison TEXT
  CHECK (livraison IS NULL OR livraison IN ('disponible', 'a_discuter', 'retrait'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS frais_livraison TEXT;

-- Slug unique (lien partageable app-flashmarket.com/b/<slug>)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_boutique_slug
  ON public.users(boutique_slug) WHERE boutique_slug IS NOT NULL;

-- -------------------------------------------------------------------------
-- 3. EXPIRATION : les produits PRO en stock n'expirent jamais
--    (remplace process_annonces_expiration de migration_expiration.sql ;
--     même cycle J+20 notif / J+30 expire / J+60 purge pour les autres)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_annonces_expiration()
RETURNS void AS $$
BEGIN
  -- a) Notifier les annonces qui expirent dans 10 jours (une seule fois).
  --    Exclut les produits de boutiques PRO encore en stock.
  WITH a_notifier AS (
    UPDATE public.annonces a
    SET expiration_notifiee = TRUE
    FROM public.users u
    WHERE u.id = a.user_id
      AND a.statut = 'active'
      AND a.date_creation <= NOW() - INTERVAL '20 days'
      AND a.expiration_notifiee = FALSE
      AND NOT (COALESCE(u.type_compte, 'particulier') = 'professionnel'
               AND COALESCE(a.stock, 1) > 0)
    RETURNING a.id, a.user_id, a.titre
  )
  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  SELECT
    user_id,
    'Votre annonce expire bientôt ⏳',
    'Votre annonce "' || titre || '" expire dans 10 jours. Renouvelez-la gratuitement depuis "Mes annonces" pour la garder en ligne.',
    'expiration_bientot',
    jsonb_build_object('annonceId', id)
  FROM a_notifier
  WHERE user_id IS NOT NULL;

  -- b) Expirer les annonces de plus de 30 jours (hors produits PRO en stock)
  WITH a_expirer AS (
    UPDATE public.annonces a
    SET statut = 'expire'
    FROM public.users u
    WHERE u.id = a.user_id
      AND a.statut = 'active'
      AND a.date_creation <= NOW() - INTERVAL '30 days'
      AND NOT (COALESCE(u.type_compte, 'particulier') = 'professionnel'
               AND COALESCE(a.stock, 1) > 0)
    RETURNING a.id, a.user_id, a.titre
  )
  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  SELECT
    user_id,
    'Annonce expirée 📦',
    'Votre annonce "' || titre || '" a expiré après 30 jours. Vous pouvez encore la renouveler gratuitement depuis "Mes annonces".',
    'annonce_expiree',
    jsonb_build_object('annonceId', id)
  FROM a_expirer
  WHERE user_id IS NOT NULL;

  -- c) Purge définitive des annonces expirées depuis plus de 30 jours
  DELETE FROM public.annonces
  WHERE statut = 'expire'
    AND date_creation <= NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- =========================================================================
-- VÉRIFICATION RAPIDE après exécution :
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'annonces' AND column_name IN ('stock','visible');
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name LIKE '%boutique%';
-- =========================================================================
