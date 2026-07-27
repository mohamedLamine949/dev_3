-- Migration pour ajouter la catégorie 'animaux' dans Chap Chap

BEGIN;

-- Mise à jour idempotente des montants des frais de dépôt pour les annonces de la catégorie 'animaux' (au cas où)
UPDATE public.annonces 
SET montant_depot = 250
WHERE categorie = 'animaux' AND est_payee = TRUE AND montant_depot IS NULL;

COMMIT;
