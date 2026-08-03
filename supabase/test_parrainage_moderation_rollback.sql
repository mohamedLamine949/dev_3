-- =====================================================================
-- TEST COMPLET ANTI-FRAUDE PARRAINAGE (modération) — SANS RIEN PERSISTER
-- À exécuter dans le SQL Editor. Enveloppé dans BEGIN…ROLLBACK.
--
-- Parcours testé :
--   1. Un parrain + un filleul publient des annonces -> elles passent
--      automatiquement 'en_revue' (trigger). => RIEN n'est éligible/validé.
--   2. L'admin APPROUVE les 3 annonces -> parrain éligible + cycle validé
--      (1000 F dus).
--   3. L'admin REJETTE l'annonce validante du filleul -> le cycle RETOMBE
--      'en_attente' (0 F).
--   4. L'admin REJETTE une annonce du parrain -> il repasse sous 2 approuvées
--      -> il PERD son éligibilité.
--
-- On appelle les VRAIES fonctions RPC (moderer_annonce_campagne) : on se donne
-- un contexte admin le temps de la transaction. Tout est annulé à la fin.
--
-- Pré-requis : migration_parrainage.sql + migration_parrainage_antifraude.sql
-- appliquées, et comptes "Aminata Diallo" (parrain) & "Aminata Daou" (filleul).
-- =====================================================================
BEGIN;

-- Table temporaire pour capturer l'état après chaque phase (une seule sortie finale)
CREATE TEMP TABLE preuve (
  ordre INT, etape TEXT, parrain_eligible BOOLEAN, cycle_statut TEXT, montant_du INT
) ON COMMIT DROP;

-- --- Contexte admin (le temps de la transaction) ----------------------
DO $$
DECLARE v_admin UUID;
BEGIN
  SELECT id INTO v_admin FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1;
  INSERT INTO public.admin_users (user_id) VALUES (v_admin) ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
END $$;

-- --- 1) Parrain activé + code (tracking depuis 1h) --------------------
INSERT INTO public.parrains (user_id, campagne_id, code, date_generation_code, om_numero, om_titulaire, autorise_par)
SELECT u.id, c.id, 'TEST01', NOW() - INTERVAL '1 hour', '70000000', 'Aminata Diallo', NULL
FROM public.users u, public.campagnes_parrainage c
WHERE u.prenom='Aminata' AND u.nom='Diallo' AND c.active
ON CONFLICT (user_id) DO UPDATE SET code='TEST01', date_generation_code=NOW()-INTERVAL '1 hour', eligible=FALSE;

-- --- 2) Le parrain publie 2 annonces (trigger => 'en_revue') ----------
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation)
SELECT x.id, u.id, x.titre, x.descr, x.prix, x.cat, 'bon_etat', 'active', TRUE, 'TEST-MOD', 0, 'Bamako', 'Hamdallaye', NOW()
FROM public.users u,
  (VALUES
    ('11111111-1111-1111-1111-111111111101'::uuid, 'Ventilateur sur pied', 'Tres bon etat, silencieux.', 15000, 'maison_electromenager'),
    ('11111111-1111-1111-1111-111111111102'::uuid, 'Casque Bluetooth', 'Comme neuf avec boite.', 12000, 'telephonie_electronique')
  ) AS x(id, titre, descr, prix, cat)
WHERE u.prenom='Aminata' AND u.nom='Diallo';

-- --- 3) Le filleul saisit le code (parrainage en attente) -------------
INSERT INTO public.parrainages (campagne_id, parrain_id, filleul_id, date_saisie_code, statut)
SELECT c.id, pa.id, fi.id, NOW() - INTERVAL '30 minutes', 'en_attente'
FROM public.campagnes_parrainage c, public.users pa, public.users fi
WHERE c.active AND pa.prenom='Aminata' AND pa.nom='Diallo' AND fi.prenom='Aminata' AND fi.nom='Daou';

-- --- 4) Le filleul publie 1 annonce (trigger => 'en_revue') -----------
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation)
SELECT '11111111-1111-1111-1111-111111111103'::uuid, u.id, 'Chaussures enfant', 'Portees 2 fois.', 8000, 'mode_beaute', 'comme_neuf', 'active', TRUE, 'TEST-MOD', 0, 'Bamako', 'Faladie', NOW()
FROM public.users u WHERE u.prenom='Aminata' AND u.nom='Daou';

-- PREUVE PHASE 1 : rien n'est validé tant que non approuvé
INSERT INTO preuve
SELECT 1, '1. Publie (en_revue) : rien ne compte',
  (SELECT eligible FROM public.parrains WHERE code='TEST01'),
  (SELECT statut FROM public.parrainages pg JOIN public.parrains p ON p.user_id=pg.parrain_id WHERE p.code='TEST01' LIMIT 1),
  (SELECT COALESCE(montant_du,0)::int FROM public.v_parrains_dashboard WHERE code='TEST01');

-- --- 5) L'admin APPROUVE les 3 annonces (vraies RPC) ------------------
DO $$
BEGIN
  PERFORM public.moderer_annonce_campagne('11111111-1111-1111-1111-111111111101', 'approuvee', NULL);
  PERFORM public.moderer_annonce_campagne('11111111-1111-1111-1111-111111111102', 'approuvee', NULL);
  PERFORM public.moderer_annonce_campagne('11111111-1111-1111-1111-111111111103', 'approuvee', NULL);
END $$;

-- PREUVE PHASE 2 : parrain eligible + cycle validé (1000 F)
INSERT INTO preuve
SELECT 2, '2. Apres approbation : cycle valide',
  (SELECT eligible FROM public.parrains WHERE code='TEST01'),
  (SELECT statut FROM public.parrainages pg JOIN public.parrains p ON p.user_id=pg.parrain_id WHERE p.code='TEST01' LIMIT 1),
  (SELECT COALESCE(montant_du,0)::int FROM public.v_parrains_dashboard WHERE code='TEST01');

-- --- 6) L'admin REJETTE l'annonce validante du filleul ---------------
DO $$
BEGIN
  PERFORM public.moderer_annonce_campagne('11111111-1111-1111-1111-111111111103', 'rejetee', 'Photo non conforme (test)');
END $$;

-- PREUVE PHASE 3 : le cycle RETOMBE en attente (0 F)
INSERT INTO preuve
SELECT 3, '3. Rejet annonce filleul : cycle retrograde',
  (SELECT eligible FROM public.parrains WHERE code='TEST01'),
  (SELECT statut FROM public.parrainages pg JOIN public.parrains p ON p.user_id=pg.parrain_id WHERE p.code='TEST01' LIMIT 1),
  (SELECT COALESCE(montant_du,0)::int FROM public.v_parrains_dashboard WHERE code='TEST01');

-- --- 7) L'admin REJETTE une annonce du parrain (< 2 approuvees) -------
DO $$
BEGIN
  PERFORM public.moderer_annonce_campagne('11111111-1111-1111-1111-111111111101', 'rejetee', 'Doublon (test)');
END $$;

-- PREUVE PHASE 4 : le parrain PERD son eligibilite
INSERT INTO preuve
SELECT 4, '4. Rejet annonce parrain : eligibilite revoquee',
  (SELECT eligible FROM public.parrains WHERE code='TEST01'),
  (SELECT statut FROM public.parrainages pg JOIN public.parrains p ON p.user_id=pg.parrain_id WHERE p.code='TEST01' LIMIT 1),
  (SELECT COALESCE(montant_du,0)::int FROM public.v_parrains_dashboard WHERE code='TEST01');

-- =====================================================================
-- RÉSULTAT (doit se lire de haut en bas comme l'histoire du cycle)
--   1. Publie          -> eligible=false, cycle=en_attente, montant=0
--   2. Approuve        -> eligible=true,  cycle=valide,     montant=1000
--   3. Rejet filleul   -> eligible=true,  cycle=en_attente, montant=0
--   4. Rejet parrain   -> eligible=false, cycle=en_attente, montant=0
-- =====================================================================
SELECT * FROM preuve ORDER BY ordre;

ROLLBACK;
