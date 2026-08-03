-- =====================================================================
-- TEST DE BOUT EN BOUT DU PARRAINAGE — SANS RIEN PERSISTER
-- A executer dans le SQL Editor de Supabase.
--
-- Le script simule un cycle complet (parrain + filleul + annonces),
-- laisse le trigger valider, AFFICHE les preuves, puis fait ROLLBACK :
-- => AUCUNE donnee n'est enregistree, AUCUNE annonce n'est visible.
--
-- Pre-requis : la migration `migration_parrainage.sql` doit etre appliquee,
-- et les comptes de demo "Aminata Diallo" (parrain) et "Aminata Daou"
-- (filleul) doivent exister (memes comptes que seed_demo_screenshots.sql).
-- Adaptez les prenom/nom ci-dessous si vous voulez d'autres comptes.
-- =====================================================================
BEGIN;

-- --- 0) Reperage des deux comptes de test -----------------------------
-- (Aminata Diallo = PARRAIN, Aminata Daou = FILLEUL)

-- --- 1) Le parrain est active + a genere son code (tracking depuis 1h) -
INSERT INTO public.parrains (user_id, campagne_id, code, date_generation_code, om_numero, om_titulaire, autorise_par)
SELECT u.id, c.id, 'TEST01', NOW() - INTERVAL '1 hour', '70000000', 'Aminata Diallo', NULL
FROM public.users u, public.campagnes_parrainage c
WHERE u.prenom = 'Aminata' AND u.nom = 'Diallo' AND c.active
ON CONFLICT (user_id) DO UPDATE
  SET code = 'TEST01', date_generation_code = NOW() - INTERVAL '1 hour';

-- --- 2) Le parrain publie ses 2 annonces valides (=> devient eligible) -
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation)
SELECT x.id, u.id, x.titre, x.descr, x.prix, x.cat, 'bon_etat', 'active', TRUE, 'TEST-PARRAINAGE', 0, 'Bamako', 'Hamdallaye', NOW()
FROM public.users u,
  (VALUES
    ('11111111-1111-1111-1111-111111111101'::uuid, 'Ventilateur sur pied 3 vitesses', 'Tres bon etat, silencieux, ideal saison chaude.', 15000, 'maison_electromenager'),
    ('11111111-1111-1111-1111-111111111102'::uuid, 'Casque audio Bluetooth', 'Sans fil, autonomie 20h, comme neuf avec boite.', 12000, 'telephonie_electronique')
  ) AS x(id, titre, descr, prix, cat)
WHERE u.prenom = 'Aminata' AND u.nom = 'Diallo';

-- --- 3) Le filleul saisit le code (parrainage en attente, il y a 30 min)
INSERT INTO public.parrainages (campagne_id, parrain_id, filleul_id, date_saisie_code, statut)
SELECT c.id, pa.id, fi.id, NOW() - INTERVAL '30 minutes', 'en_attente'
FROM public.campagnes_parrainage c,
     public.users pa,
     public.users fi
WHERE c.active
  AND pa.prenom = 'Aminata' AND pa.nom = 'Diallo'
  AND fi.prenom = 'Aminata' AND fi.nom = 'Daou';

-- --- 4) Le filleul publie 1 annonce valide (=> declenche la validation) -
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation)
SELECT '11111111-1111-1111-1111-111111111103'::uuid, u.id, 'Chaussures enfant pointure 30', 'Portees 2 fois, tres bon etat.', 8000, 'mode_beaute', 'comme_neuf', 'active', TRUE, 'TEST-PARRAINAGE', 0, 'Bamako', 'Faladie', NOW()
FROM public.users u
WHERE u.prenom = 'Aminata' AND u.nom = 'Daou';

-- --- 5) Images (pour des annonces completes, comme en vrai) ------------
INSERT INTO public.images_annonce (id, annonce_id, image_url, ordre) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111101', 'https://images.unsplash.com/photo-1565374392946-2f22a8f4e6b3?auto=format&fit=crop&w=800&q=70', 0),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111102', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=70', 0),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111103', 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=70', 0)
ON CONFLICT (id) DO NOTHING;

-- --- 6) Filet de securite : on relance la validation explicitement -----
SELECT public.executer_validation_parrainages();

-- =====================================================================
-- 7) LES PREUVES (ce que tu dois voir)
-- =====================================================================
-- (a) Le parrain est-il devenu eligible ? -> eligible = true
SELECT 'PARRAIN ELIGIBLE ?' AS test, code, eligible, date_eligibilite
FROM public.parrains WHERE code = 'TEST01';

-- (b) Le cycle est-il valide ? -> statut = 'valide'
SELECT 'CYCLE VALIDE ?' AS test, pg.statut, pg.date_validation, pg.annonce_validante_id
FROM public.parrainages pg
JOIN public.parrains p ON p.user_id = pg.parrain_id
WHERE p.code = 'TEST01';

-- (c) Combien doit-on au parrain ? -> montant_du = 1000, filleuls_valides = 1
SELECT 'MONTANT DU PARRAIN' AS test, filleuls_valides, montant_du
FROM public.v_parrains_dashboard WHERE code = 'TEST01';

-- (d) Sante de la campagne -> cycles_a_payer = 1, budget_engage = 1000
SELECT 'SANTE CAMPAGNE' AS test, cycles_a_payer, budget_engage, budget_restant
FROM public.v_campagne_sante WHERE active;

-- =====================================================================
-- 8) ON ANNULE TOUT : rien n'est enregistre, rien n'est visible.
--    (Remplace ROLLBACK par COMMIT UNIQUEMENT si tu veux garder les
--     donnees — a ne PAS faire pour un simple test.)
-- =====================================================================
ROLLBACK;
