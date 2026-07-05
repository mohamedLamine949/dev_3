-- Migration : sous-catégories d'annonces
-- Ajoute une colonne facultative sous_categorie sur annonces.
-- Les annonces existantes restent valides (sous_categorie NULL = classée
-- uniquement dans la catégorie principale).
-- À exécuter dans le SQL Editor du dashboard Supabase.

BEGIN;

ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS sous_categorie TEXT;

CREATE INDEX IF NOT EXISTS idx_annonces_sous_categorie ON public.annonces(sous_categorie);

COMMIT;
