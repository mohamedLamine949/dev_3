-- =====================================================================
-- INSCRIPTIONS BÊTA-TESTEURS (page web « Devenir testeur »)
-- À exécuter dans le SQL Editor Supabase (projet prod kmydbkaytrxtcequngnn).
-- Idempotent : ré-exécutable sans risque.
--
-- La page https://app-flashmarket.com/testeurs.html insère ici via la clé
-- anon. Lecture PUBLIQUE INTERDITE (e-mails privés) : consultation et
-- export uniquement depuis le dashboard (SQL Editor) — voir les requêtes
-- d'export en bas de ce fichier.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.beta_testers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL CHECK (char_length(prenom) BETWEEN 1 AND 60),
  nom TEXT NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 60),
  email TEXT NOT NULL UNIQUE CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  -- Passe à TRUE quand tu as ajouté la personne dans TestFlight / Play
  -- Console, pour ne ré-exporter que les nouveaux à chaque fois.
  invite BOOLEAN NOT NULL DEFAULT FALSE,
  date_inscription TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_testers_platform ON public.beta_testers(platform, invite, date_inscription);

ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;

-- Le site (anon) peut UNIQUEMENT insérer. Jamais lire, modifier ou supprimer.
DROP POLICY IF EXISTS "Anyone can register as tester" ON public.beta_testers;
CREATE POLICY "Anyone can register as tester" ON public.beta_testers
  FOR INSERT TO anon
  WITH CHECK (platform IN ('ios', 'android'));

-- =====================================================================
-- EXPORTS CSV (à lancer dans le SQL Editor, puis bouton « Download CSV »
-- sur le résultat). Après import dans le store, lance la requête de
-- marquage pour ne pas ré-exporter les mêmes personnes la fois suivante.
-- =====================================================================

-- 1) EXPORT APPLE (TestFlight — colonnes attendues par App Store Connect) :
-- SELECT prenom AS "First Name", nom AS "Last Name", email AS "Email"
-- FROM public.beta_testers
-- WHERE platform = 'ios' AND invite = FALSE
-- ORDER BY date_inscription;

-- 2) EXPORT GOOGLE (Play Console — une adresse par ligne) :
-- SELECT email
-- FROM public.beta_testers
-- WHERE platform = 'android' AND invite = FALSE
-- ORDER BY date_inscription;

-- 3) APRÈS IMPORT — marquer comme invités (par plateforme) :
-- UPDATE public.beta_testers SET invite = TRUE WHERE platform = 'ios'     AND invite = FALSE;
-- UPDATE public.beta_testers SET invite = TRUE WHERE platform = 'android' AND invite = FALSE;

-- 4) VUE D'ENSEMBLE (compteurs) :
-- SELECT platform, invite, COUNT(*) FROM public.beta_testers GROUP BY platform, invite ORDER BY platform;
