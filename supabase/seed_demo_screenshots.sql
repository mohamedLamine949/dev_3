-- =====================================================================
-- SEED DEMO POUR CAPTURES PLAY STORE - Flash Market
-- A executer dans le SQL Editor de Supabase (bypass RLS).
-- 100% re-executable (UUID fixes + ON CONFLICT). N'affecte PAS vos vrais
-- comptes. Pour tout supprimer apres les captures : voir le bloc CLEANUP
-- en bas du fichier (a de-commenter).
-- Pre-requis : le compte Aminata Diallo doit exister (deja le cas).
-- =====================================================================
BEGIN;

-- 1) Vendeurs fictifs ----------------------------------------------------
INSERT INTO public.users (id, prenom, nom, num_telephone, date_creation) VALUES
  ('f0b09050-740e-4d37-ba73-ba2c7fc037f8','Ibrahim','Toure','+22390000001', NOW() - INTERVAL '3 days'),
  ('903c97f0-648b-4937-9396-bda95af74a9c','Fatoumata','Coulibaly','+22390000002', NOW() - INTERVAL '3 days'),
  ('4183faf4-7548-4e5d-b592-b4dda7ce6722','Moussa','Keita','+22390000003', NOW() - INTERVAL '3 days'),
  ('15b47bed-9209-4fc8-9bd7-16a2dba587c2','Sekou','Diarra','+22390000004', NOW() - INTERVAL '3 days'),
  ('3a08fb5b-38f8-487f-b5f9-2060597bb608','Oumar','Cisse','+22390000005', NOW() - INTERVAL '3 days'),
  ('c5eb18ff-5c7c-43ce-b327-add0fecbae63','Mariam','Traore','+22390000006', NOW() - INTERVAL '3 days'),
  ('d23cd3f2-5c0e-43f3-bf94-fc3bdf8d1650','Awa','Sangare','+22390000007', NOW() - INTERVAL '3 days'),
  ('5da83e3e-bda9-434b-9b67-825f95bccc89','Kadiatou','Sidibe','+22390000008', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- 2) Annonces des vendeurs (page d'accueil) ------------------------------
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation) VALUES
  ('b4c09d30-5718-44a4-9b70-bc88731019ae', 'f0b09050-740e-4d37-ba73-ba2c7fc037f8', 'iPhone 13 Pro 128 Go', 'Tres bon etat, debloque tous operateurs, avec chargeur.', 285000, 'telephonie_electronique', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Hamdallaye', NOW() - INTERVAL '0 minutes'),
  ('3d47e383-9fea-4101-af20-982436fd9f5e', '903c97f0-648b-4937-9396-bda95af74a9c', 'MacBook Air M1 2020', '13 pouces, 8 Go RAM, 256 Go SSD. Parfait pour le travail.', 525000, 'telephonie_electronique', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'ACI 2000', NOW() - INTERVAL '7 minutes'),
  ('a8e5e36b-d3a9-46d2-9560-6f52ff7cf43d', '4183faf4-7548-4e5d-b592-b4dda7ce6722', 'Toyota Corolla 2014', 'Essence, climatisation, papiers a jour. Tres propre.', 5500000, 'voitures', 'bon_etat', 'active', TRUE, 'SEED-DEMO', 5000, 'Bamako', 'Faladie', NOW() - INTERVAL '14 minutes'),
  ('46106bb8-c8c7-407c-b635-521b4f2b4c00', '15b47bed-9209-4fc8-9bd7-16a2dba587c2', 'Toyota RAV4 2017', '4x4, full options, premiere main, entretien a jour.', 9800000, 'voitures', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 5000, 'Bamako', 'Badalabougou', NOW() - INTERVAL '21 minutes'),
  ('70bf1325-97dd-4bd0-9cdb-7e8bcd7586e5', '3a08fb5b-38f8-487f-b5f9-2060597bb608', 'Yamaha YBR 125', 'Moto fiable et economique, ideale pour la ville.', 850000, 'motos', 'bon_etat', 'active', TRUE, 'SEED-DEMO', 1000, 'Bamako', 'Magnambougou', NOW() - INTERVAL '28 minutes'),
  ('a8355fe9-fd51-40db-b6c9-cbc205de28c5', 'c5eb18ff-5c7c-43ce-b327-add0fecbae63', 'Appartement meuble 2 chambres', 'Salon, cuisine equipee, a ACI 2000. Disponible.', 200000, 'immobilier', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 2500, 'Bamako', 'ACI 2000', NOW() - INTERVAL '35 minutes'),
  ('b6cac06f-cd91-44db-8b9f-cfac1f292097', '5da83e3e-bda9-434b-9b67-825f95bccc89', 'Villa 4 chambres avec jardin', 'Quartier calme a Badalabougou, garage 2 voitures.', 65000000, 'immobilier', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 2500, 'Bamako', 'Badalabougou', NOW() - INTERVAL '42 minutes'),
  ('df9704e7-3c2f-43a9-a585-92a3e11c5fbb', 'f0b09050-740e-4d37-ba73-ba2c7fc037f8', 'TV Samsung 55 pouces 4K UHD', 'Smart TV, comme neuve, telecommande et support inclus.', 245000, 'maison_electromenager', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Hamdallaye', NOW() - INTERVAL '49 minutes'),
  ('6a0469e6-79c7-4b80-8164-73d7fc58373f', '903c97f0-648b-4937-9396-bda95af74a9c', 'Refrigerateur Samsung 2 portes', 'Grande capacite, tres bon etat, peu utilise.', 185000, 'maison_electromenager', 'bon_etat', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Sebenikoro', NOW() - INTERVAL '56 minutes'),
  ('383e618a-d0ff-4729-9572-b21159e8536f', 'd23cd3f2-5c0e-43f3-bf94-fc3bdf8d1650', 'Baskets Adidas Samba OG', 'Pointure 42, authentiques, portees 2 fois.', 28000, 'mode_beaute', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Kalaban Coura', NOW() - INTERVAL '63 minutes'),
  ('9c7e9cec-138e-496b-80da-237a0fde8195', '4183faf4-7548-4e5d-b592-b4dda7ce6722', 'Montre homme classique', 'Acier inoxydable, etanche, avec boite.', 35000, 'mode_beaute', 'neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Faladie', NOW() - INTERVAL '70 minutes'),
  ('1eca51e2-c5f5-48b5-a870-ddffc6ca5087', 'd23cd3f2-5c0e-43f3-bf94-fc3bdf8d1650', 'Photographe evenementiel', 'Mariages, baptemes, evenements. Photos HD + retouches.', 50000, 'services', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 500, 'Bamako', 'Bamako', NOW() - INTERVAL '77 minutes'),
  ('db565058-ab4e-48d2-966e-39b8108703b7', 'c5eb18ff-5c7c-43ce-b327-add0fecbae63', 'Panier de provisions (riz, huile, sucre)', 'Sac de riz 25kg + 5L huile + 4kg sucre. Livraison possible.', 25000, 'alimentation', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 500, 'Bamako', 'Magnambougou', NOW() - INTERVAL '84 minutes')
ON CONFLICT (id) DO NOTHING;

-- 3) Annonces d'Aminata Diallo (sujets des conversations) ----------------
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation) VALUES
  ('27632c50-f16e-4279-bf1c-7ad5bd0ec39c', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'iPhone 14 Pro Max 256 Go', 'Noir sideral, comme neuf, batterie 96%, aucune rayure.', 425000, 'telephonie_electronique', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'ACI 2000', NOW() - INTERVAL '2 minutes'),
  ('e02cf7c2-3f40-450b-b28e-f466406a6092', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Sac a main en cuir veritable', 'Elegant et spacieux, parfait etat, couleur marron.', 40000, 'mode_beaute', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'ACI 2000', NOW() - INTERVAL '2 minutes')
ON CONFLICT (id) DO NOTHING;

-- 4) Images des annonces -------------------------------------------------
INSERT INTO public.images_annonce (id, annonce_id, image_url, ordre) VALUES
  ('29aa668b-2490-4fb7-8977-2c49193d7798', 'b4c09d30-5718-44a4-9b70-bc88731019ae', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=70', 0),
  ('3c2a0299-74d9-4bbd-a818-3230a14d33c0', '3d47e383-9fea-4101-af20-982436fd9f5e', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=70', 0),
  ('d97d95b3-c6e5-4e4b-b2ba-50113b0dfbf8', 'a8e5e36b-d3a9-46d2-9560-6f52ff7cf43d', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=70', 0),
  ('ff8a5708-a261-44d4-ad3a-da67962742f3', '46106bb8-c8c7-407c-b635-521b4f2b4c00', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=70', 0),
  ('11dbf8fe-d128-4b58-9697-63d7e9e59b40', '70bf1325-97dd-4bd0-9cdb-7e8bcd7586e5', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=70', 0),
  ('416ec9d4-5b2f-4e93-ad99-014c211a66ff', 'a8355fe9-fd51-40db-b6c9-cbc205de28c5', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=70', 0),
  ('db172f8b-db99-4e6a-9642-d5b0487a8835', 'b6cac06f-cd91-44db-8b9f-cfac1f292097', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=70', 0),
  ('24db65cf-1098-42a4-aec7-38fb7e297cda', 'df9704e7-3c2f-43a9-a585-92a3e11c5fbb', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=70', 0),
  ('faeff394-542a-4973-a89b-cd68eea4bf5c', '6a0469e6-79c7-4b80-8164-73d7fc58373f', 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=70', 0),
  ('9d8b4f42-4667-4ad9-ab89-d9932816b8f2', '383e618a-d0ff-4729-9572-b21159e8536f', 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=800&q=70', 0),
  ('0055db75-e50c-4f4c-bb08-76a7b8273a22', '9c7e9cec-138e-496b-80da-237a0fde8195', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=70', 0),
  ('5e2d4703-cb27-4967-85fb-149e0e374be7', '1eca51e2-c5f5-48b5-a870-ddffc6ca5087', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=70', 0),
  ('8a3b289c-791f-48f0-9feb-1940afeb4258', 'db565058-ab4e-48d2-966e-39b8108703b7', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=70', 0),
  ('0bef28a7-a017-4b26-ba53-2478f17a6b8a', '27632c50-f16e-4279-bf1c-7ad5bd0ec39c', 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=70', 0),
  ('def2efb5-d3bb-4872-881d-e636ef68f32f', 'e02cf7c2-3f40-450b-b28e-f466406a6092', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=70', 0)
ON CONFLICT (id) DO NOTHING;

-- 5) Conversations recues par Aminata Diallo -----------------------------
INSERT INTO public.conversations (id, acheteur_id, vendeur_id, annonce_id, dernier_message, date_dernier_message) VALUES
  ('11515cc1-2fb4-45a7-8213-f6482077b9b2', '4183faf4-7548-4e5d-b592-b4dda7ce6722', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), '27632c50-f16e-4279-bf1c-7ad5bd0ec39c', 'Ca marche, je peux passer demain a ACI 2000 ?', NOW() - INTERVAL '3 minutes'),
  ('7932a849-1b75-457a-9cc6-2b62f6709cf7', '3a08fb5b-38f8-487f-b5f9-2060597bb608', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'e02cf7c2-3f40-450b-b28e-f466406a6092', 'Bonjour, le sac est-il encore disponible ?', NOW() - INTERVAL '40 minutes')
ON CONFLICT (acheteur_id, vendeur_id, annonce_id) DO NOTHING;

-- 6) Messages des conversations -----------------------------------------
INSERT INTO public.messages (id, conversation_id, expediteur_id, contenu, lu, date_envoi) VALUES
  ('3077eb86-de5b-4246-b811-9e16aea0192e', '11515cc1-2fb4-45a7-8213-f6482077b9b2', '4183faf4-7548-4e5d-b592-b4dda7ce6722', 'Bonjour, est-ce que l''iPhone 14 Pro Max est toujours disponible ?', true, NOW() - INTERVAL '26 minutes'),
  ('ef4b0454-b214-43f3-8985-182eb5db708d', '11515cc1-2fb4-45a7-8213-f6482077b9b2', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Bonjour ! Oui, il est encore disponible.', true, NOW() - INTERVAL '24 minutes'),
  ('a0e6df65-6b7e-4f34-903b-ee8cd7a8fbf6', '11515cc1-2fb4-45a7-8213-f6482077b9b2', '4183faf4-7548-4e5d-b592-b4dda7ce6722', 'Super ! Il est en bon etat ? La batterie tient bien ?', true, NOW() - INTERVAL '22 minutes'),
  ('3a769aa2-4276-42b3-85c6-5a1bedeb7b91', '11515cc1-2fb4-45a7-8213-f6482077b9b2', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Oui, comme neuf. Batterie a 96%, aucune rayure.', true, NOW() - INTERVAL '20 minutes'),
  ('a43a6107-04d8-43c0-81ba-a2287dad5f55', '11515cc1-2fb4-45a7-8213-f6482077b9b2', '4183faf4-7548-4e5d-b592-b4dda7ce6722', 'D''accord. Vous pouvez faire un petit geste sur le prix ?', true, NOW() - INTERVAL '12 minutes'),
  ('f0f2e3c0-5824-487c-b024-720aa4395b96', '11515cc1-2fb4-45a7-8213-f6482077b9b2', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Je peux descendre a 410 000 FCFA, c''est mon dernier prix.', true, NOW() - INTERVAL '10 minutes'),
  ('a382e923-13c0-4107-aec9-135015ee9701', '11515cc1-2fb4-45a7-8213-f6482077b9b2', '4183faf4-7548-4e5d-b592-b4dda7ce6722', 'Ca marche, je peux passer demain a ACI 2000 ?', false, NOW() - INTERVAL '3 minutes'),
  ('2d6dc3bf-78e7-47fd-9483-59872c8555fc', '7932a849-1b75-457a-9cc6-2b62f6709cf7', '3a08fb5b-38f8-487f-b5f9-2060597bb608', 'Bonjour, le sac est-il encore disponible ?', false, NOW() - INTERVAL '40 minutes')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =====================================================================
-- CLEANUP (optionnel) - a executer pour SUPPRIMER toutes les donnees demo
-- apres avoir pris vos captures. De-commentez les 3 lignes puis executez.
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.annonces WHERE id_transaction_paiement = 'SEED-DEMO';
-- DELETE FROM public.users WHERE num_telephone LIKE '+22390000%';
-- COMMIT;
