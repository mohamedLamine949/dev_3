-- Migration : Ajouter le compteur de vues réel sur les annonces

-- 1. Ajouter la colonne 'nombre_vues' à la table 'annonces' si elle n'existe pas
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS nombre_vues INTEGER DEFAULT 0;

-- 2. Créer une fonction de procédure stockée (RPC) pour incrémenter le compteur de vues de façon sécurisée
CREATE OR REPLACE FUNCTION public.increment_views(annonce_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.annonces
  SET nombre_vues = COALESCE(nombre_vues, 0) + 1
  WHERE id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
