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
-- EXPORTS CSV « TOUT-EN-UN » (à sauvegarder comme requêtes dans le SQL
-- Editor). Chaque Run renvoie UNIQUEMENT les nouveaux inscrits ET les
-- marque comme invités dans la même opération : le Run suivant ne
-- ressortira jamais les mêmes personnes. Bouton « Download CSV » sur le
-- résultat, puis import direct dans le store.
-- =====================================================================

-- 1) EXPORT APPLE (TestFlight — ordre du dialogue ASC : e-mail, prénom, nom).
--    Renvoie les nouveaux testeurs iOS et les marque invités d'un coup :
-- UPDATE public.beta_testers
-- SET invite = TRUE
-- WHERE platform = 'ios' AND invite = FALSE
-- RETURNING email, prenom, nom;

-- 2) EXPORT GOOGLE (Play Console — une adresse par ligne).
--    Renvoie les nouveaux testeurs Android et les marque invités d'un coup :
-- UPDATE public.beta_testers
-- SET invite = TRUE
-- WHERE platform = 'android' AND invite = FALSE
-- RETURNING email;

-- 3) RATTRAPAGE : si tu as lancé l'export mais perdu/raté le fichier CSV,
--    remets les personnes concernées en « non invitées » puis relance :
-- UPDATE public.beta_testers SET invite = FALSE WHERE email IN ('adresse1@...', 'adresse2@...');
--    ou tout ré-exporter depuis le début (re-marque TOUT comme nouveau) :
-- UPDATE public.beta_testers SET invite = FALSE;

-- 4) VUE D'ENSEMBLE (compteurs par plateforme) :
-- SELECT platform, invite, COUNT(*) FROM public.beta_testers GROUP BY platform, invite ORDER BY platform;

-- 5) TOUT VOIR (consultation simple, ne modifie rien) :
-- SELECT prenom, nom, email, platform, invite, date_inscription
-- FROM public.beta_testers ORDER BY date_inscription DESC;
