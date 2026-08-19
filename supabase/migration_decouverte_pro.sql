-- =========================================================================
-- MIGRATION : Découverte Pro — catégorie métier des boutiques
-- Idempotente. Indépendante de migration_boutiques*.sql.
-- =========================================================================
-- Ajoute la catégorie "métier" d'une boutique PRO (Téléphonie, Services,
-- Restaurants...), utilisée par la nouvelle interface de découverte des
-- professionnels. Volontairement séparée de `catalogues.categorie` (qui
-- classe les PRODUITS pour la recherche classique) : une boutique peut
-- vendre dans plusieurs catégories produit tout en n'ayant qu'un seul
-- métier affiché dans l'annuaire. Pas de CHECK figé ici : la liste des
-- métiers vit côté app (METIER_CATEGORIES, app/src/constants/theme.ts)
-- pour rester facile à faire évoluer sans nouvelle migration.
-- =========================================================================

BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS categorie_metier TEXT;

COMMIT;
