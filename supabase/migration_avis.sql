-- =====================================================================
-- SYSTÈME D'AVIS VENDEURS
-- À exécuter dans le SQL Editor Supabase (projet prod kmydbkaytrxtcequngnn).
-- Idempotent : ré-exécutable sans risque.
--
-- La table avis n'a jamais été créée en production : l'app (useAvis.ts,
-- AnnonceDetailScreen, ProfileScreen, VendeurProfileScreen) échouait
-- silencieusement. Ce script crée la table telle que l'app l'attend :
--   - colonnes : id, auteur_id, vendeur_id, annonce_id (nullable), note,
--     commentaire (nullable), date_creation
--   - jointure PostgREST auteur:auteur_id(...) => FK vers public.users
--   - doublon d'avis détecté côté app via le code erreur 23505
--     => contrainte UNIQUE (auteur_id, annonce_id)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auteur_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendeur_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- SET NULL : l'avis survit à la suppression de l'annonce (l'app gère
  -- annonce_id null dans l'interface Avis)
  annonce_id UUID REFERENCES public.annonces(id) ON DELETE SET NULL,
  note INTEGER NOT NULL CHECK (note >= 1 AND note <= 5),
  commentaire TEXT CHECK (commentaire IS NULL OR char_length(commentaire) <= 1000),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Impossible de s'auto-évaluer
  CONSTRAINT avis_pas_auto_evaluation CHECK (auteur_id <> vendeur_id),
  -- Un seul avis par acheteur et par annonce (code 23505 attendu par l'app)
  CONSTRAINT avis_un_par_annonce UNIQUE (auteur_id, annonce_id)
);

CREATE INDEX IF NOT EXISTS idx_avis_vendeur ON public.avis(vendeur_id, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_avis_auteur ON public.avis(auteur_id);
CREATE INDEX IF NOT EXISTS idx_avis_annonce ON public.avis(annonce_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.avis ENABLE ROW LEVEL SECURITY;

-- Lecture publique : les avis sont visibles sur les profils vendeurs,
-- y compris pour les visiteurs non connectés.
DROP POLICY IF EXISTS "Avis are public" ON public.avis;
CREATE POLICY "Avis are public" ON public.avis FOR SELECT USING (true);

-- Insertion : uniquement en son propre nom, pas sur soi-même, et
-- l'annonce référencée doit bien appartenir au vendeur noté.
DROP POLICY IF EXISTS "Users can insert own avis" ON public.avis;
CREATE POLICY "Users can insert own avis" ON public.avis FOR INSERT WITH CHECK (
  auth.uid() = auteur_id
  AND auteur_id <> vendeur_id
  AND (
    annonce_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.annonces
      WHERE id = annonce_id AND user_id = vendeur_id
    )
  )
);

-- L'auteur peut retirer son propre avis.
DROP POLICY IF EXISTS "Users can delete own avis" ON public.avis;
CREATE POLICY "Users can delete own avis" ON public.avis FOR DELETE USING (
  auth.uid() = auteur_id
);

-- ---------------------------------------------------------------------
-- NOTIFICATION AU VENDEUR (le trigger on_new_notification existant
-- envoie ensuite le push Expo automatiquement)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_avis_notification()
RETURNS TRIGGER AS $$
DECLARE
  auteur_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(prenom || ' ' || nom), ''), 'Un utilisateur') INTO auteur_name
  FROM public.users WHERE id = NEW.auteur_id;

  INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
  VALUES (
    NEW.vendeur_id,
    'Nouvel avis reçu ⭐',
    auteur_name || ' vous a laissé un avis ' || NEW.note || '/5'
      || CASE
           WHEN NEW.commentaire IS NOT NULL AND TRIM(NEW.commentaire) <> ''
           THEN ' : « ' || LEFT(TRIM(NEW.commentaire), 80) || ' »'
           ELSE '.'
         END,
    'avis',
    jsonb_build_object('avisId', NEW.id, 'note', NEW.note)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_avis_notification ON public.avis;
CREATE TRIGGER on_avis_notification
  AFTER INSERT ON public.avis
  FOR EACH ROW EXECUTE FUNCTION public.handle_avis_notification();
