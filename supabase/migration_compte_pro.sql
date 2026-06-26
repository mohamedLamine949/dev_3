-- Script de migration pour ajouter le support des profils professionnels / vitrines
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS type_compte TEXT DEFAULT 'particulier';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banniere_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS images_business TEXT[] DEFAULT '{}';

COMMIT;
