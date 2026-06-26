-- Script de migration des catégories pour Chap Chap
-- Fusionne et nettoie les anciennes catégories d'annonces existantes vers les 8 nouvelles catégories.

BEGIN;

-- 1. Téléphonie & Électronique (Fusions de 'telephonie' et 'electronique')
UPDATE public.annonces 
SET categorie = 'telephonie_electronique' 
WHERE categorie IN ('telephonie', 'electronique');

-- 2. Mode & Beauté (Fusions de 'mode' et 'beaute')
UPDATE public.annonces 
SET categorie = 'mode_beaute' 
WHERE categorie IN ('mode', 'beaute');

-- 3. Maison & Électroménager (Fusions de 'maison', 'electromenager', 'materiaux')
UPDATE public.annonces 
SET categorie = 'maison_electromenager' 
WHERE categorie IN ('maison', 'electromenager', 'materiaux');

-- 4. Voitures (Les anciennes annonces 'vehicules' ou 'vehicule' sont migrées vers 'voitures')
UPDATE public.annonces 
SET categorie = 'voitures' 
WHERE categorie IN ('vehicules', 'vehicule', 'voiture', 'voitures');

-- 4b. Motos
UPDATE public.annonces 
SET categorie = 'motos' 
WHERE categorie IN ('moto', 'motos');

-- 5. Immobilier (Reste inchangé)
UPDATE public.annonces 
SET categorie = 'immobilier' 
WHERE categorie = 'immobilier';

-- 6. Nourriture (Reste inchangé)
UPDATE public.annonces 
SET categorie = 'nourriture' 
WHERE categorie = 'nourriture';

-- 7. Services (Les anciennes catégories obsolètes sans correspondance directe comme 'agriculture', 'loisirs', 'autres' sont fusionnées dans 'services')
UPDATE public.annonces 
SET categorie = 'services' 
WHERE categorie IN ('services', 'service', 'agriculture', 'loisirs', 'autres', 'autre');

COMMIT;
