-- =====================================================================
-- SEED DEMO POUR CAPTURES PLAY STORE - Flash Market
-- A executer dans le SQL Editor de Supabase (bypass RLS).
-- Rattache des annonces de demonstration aux comptes EXISTANTS (Aminata
-- Diallo = vendeuse, Aminata Daou = acheteuse). Aucun compte cree => pas de
-- probleme de cle etrangere vers auth.users.
-- 100% re-executable (UUID fixes + ON CONFLICT). Bloc CLEANUP en bas.
-- Pre-requis : les comptes Aminata Diallo ET Aminata Daou doivent exister.
-- =====================================================================
BEGIN;

-- 1) Annonces de demonstration (page d'accueil) --------------------------
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation) VALUES
  ('0dbe5fe8-25b5-490c-9484-b2e8651065d6', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'iPhone 13 Pro 128 Go', 'Tres bon etat, debloque tous operateurs, avec chargeur.', 285000, 'telephonie_electronique', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Hamdallaye', NOW() - INTERVAL '0 minutes'),
  ('1c4736ef-982a-4ae4-9005-d47d28da475a', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'MacBook Air M1 2020', '13 pouces, 8 Go RAM, 256 Go SSD. Parfait pour le travail.', 525000, 'telephonie_electronique', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'ACI 2000', NOW() - INTERVAL '7 minutes'),
  ('053d86e3-b4b5-450e-8bf1-d1d305d26e2e', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Toyota Corolla 2014', 'Essence, climatisation, papiers a jour. Tres propre.', 5500000, 'voitures', 'bon_etat', 'active', TRUE, 'SEED-DEMO', 5000, 'Bamako', 'Faladie', NOW() - INTERVAL '14 minutes'),
  ('c3e8ba52-297b-4085-8435-151043809ecd', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Toyota RAV4 2017', '4x4, full options, premiere main, entretien a jour.', 9800000, 'voitures', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 5000, 'Bamako', 'Badalabougou', NOW() - INTERVAL '21 minutes'),
  ('55716f3f-dd06-48cd-bb61-8213f2c29bf8', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Yamaha YBR 125', 'Moto fiable et economique, ideale pour la ville.', 850000, 'motos', 'bon_etat', 'active', TRUE, 'SEED-DEMO', 1000, 'Bamako', 'Magnambougou', NOW() - INTERVAL '28 minutes'),
  ('0169cff9-1ae3-458d-b557-e1e0bd16470a', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Appartement meuble 2 chambres', 'Salon, cuisine equipee, a ACI 2000. Disponible.', 200000, 'immobilier', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 2500, 'Bamako', 'ACI 2000', NOW() - INTERVAL '35 minutes'),
  ('37dbfdbe-f205-445e-a4a2-76098eee5c28', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Villa 4 chambres avec jardin', 'Quartier calme a Badalabougou, garage 2 voitures.', 65000000, 'immobilier', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 2500, 'Bamako', 'Badalabougou', NOW() - INTERVAL '42 minutes'),
  ('5e1b2fc4-bc07-4e24-932a-58cd8ed0bac5', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'TV Samsung 55 pouces 4K UHD', 'Smart TV, comme neuve, telecommande et support inclus.', 245000, 'maison_electromenager', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Hamdallaye', NOW() - INTERVAL '49 minutes'),
  ('5657cadc-e094-4390-af61-31ababa58dbb', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Refrigerateur Samsung 2 portes', 'Grande capacite, tres bon etat, peu utilise.', 185000, 'maison_electromenager', 'bon_etat', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Sebenikoro', NOW() - INTERVAL '56 minutes'),
  ('10e0f7b2-8ac6-4cb6-a4cf-f32d9c64a1b4', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Baskets Adidas Samba OG', 'Pointure 42, authentiques, portees 2 fois.', 28000, 'mode_beaute', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Kalaban Coura', NOW() - INTERVAL '63 minutes'),
  ('71d2d3a0-3aa3-481c-9770-cf93dbf8986d', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Montre homme classique', 'Acier inoxydable, etanche, avec boite.', 35000, 'mode_beaute', 'neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'Faladie', NOW() - INTERVAL '70 minutes'),
  ('58c08ee5-e8ef-4c83-9199-0bf64e1fee3a', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Photographe evenementiel', 'Mariages, baptemes, evenements. Photos HD + retouches.', 50000, 'services', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 500, 'Bamako', 'Bamako', NOW() - INTERVAL '77 minutes'),
  ('5fa74aaa-aa86-4681-b8a4-f0d6fe5eafc3', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Panier de provisions (riz, huile, sucre)', 'Sac de riz 25kg + 5L huile + 4kg sucre. Livraison possible.', 25000, 'alimentation', 'non_specifie', 'active', TRUE, 'SEED-DEMO', 500, 'Bamako', 'Magnambougou', NOW() - INTERVAL '84 minutes')
ON CONFLICT (id) DO NOTHING;

-- 2) Annonces d'Aminata Diallo (sujets des conversations) ----------------
INSERT INTO public.annonces (id, user_id, titre, description, prix, categorie, etat_article, statut, est_payee, id_transaction_paiement, montant_depot, ville, quartier, date_creation) VALUES
  ('7d8cc202-279f-4538-a2fe-c1adc45ad48e', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'iPhone 14 Pro Max 256 Go', 'Noir sideral, comme neuf, batterie 96%, aucune rayure.', 425000, 'telephonie_electronique', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'ACI 2000', NOW() - INTERVAL '2 minutes'),
  ('67824e29-190c-4cc3-9340-261054d9e543', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Sac a main en cuir veritable', 'Elegant et spacieux, parfait etat, couleur marron.', 40000, 'mode_beaute', 'comme_neuf', 'active', TRUE, 'SEED-DEMO', 250, 'Bamako', 'ACI 2000', NOW() - INTERVAL '2 minutes')
ON CONFLICT (id) DO NOTHING;

-- 3) Images des annonces -------------------------------------------------
INSERT INTO public.images_annonce (id, annonce_id, image_url, ordre) VALUES
  ('12f9d90e-4f4b-4981-97ca-d39f93afa7c5', '0dbe5fe8-25b5-490c-9484-b2e8651065d6', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=70', 0),
  ('82395202-fe20-4f1c-b303-92818078f7f1', '1c4736ef-982a-4ae4-9005-d47d28da475a', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=70', 0),
  ('8d3a683b-04eb-4634-ad42-82dd0aad5961', '053d86e3-b4b5-450e-8bf1-d1d305d26e2e', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=70', 0),
  ('9319c300-ddc7-46b6-be58-6789a21eea0c', 'c3e8ba52-297b-4085-8435-151043809ecd', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=70', 0),
  ('a62d2896-a158-45e9-81fd-c5be6a665517', '55716f3f-dd06-48cd-bb61-8213f2c29bf8', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=70', 0),
  ('a09d94cd-33be-4e04-b607-fd2422d4ab62', '0169cff9-1ae3-458d-b557-e1e0bd16470a', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=70', 0),
  ('3a3eae88-5a68-4ccc-96fe-8e00b5dc675e', '37dbfdbe-f205-445e-a4a2-76098eee5c28', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=70', 0),
  ('2a644f6a-4d49-4c98-9d62-14ccd283e2e5', '5e1b2fc4-bc07-4e24-932a-58cd8ed0bac5', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=70', 0),
  ('d22a5fa1-6bdd-4dde-b203-3cef27a43cc2', '5657cadc-e094-4390-af61-31ababa58dbb', 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=70', 0),
  ('d9ddc864-8472-41ac-ae0e-70b4e897e539', '10e0f7b2-8ac6-4cb6-a4cf-f32d9c64a1b4', 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=800&q=70', 0),
  ('e5659264-5f96-4408-8f7c-14a33b54f977', '71d2d3a0-3aa3-481c-9770-cf93dbf8986d', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=70', 0),
  ('fa4dd434-e611-4632-ac1c-0bffa77146ec', '58c08ee5-e8ef-4c83-9199-0bf64e1fee3a', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=70', 0),
  ('565a873f-6687-40f0-9567-82cce683db8d', '5fa74aaa-aa86-4681-b8a4-f0d6fe5eafc3', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=70', 0),
  ('9127a24e-60cd-4adb-9c14-e37b7b176d76', '7d8cc202-279f-4538-a2fe-c1adc45ad48e', 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=70', 0),
  ('0ff72214-71bb-4a6c-8ff7-697c307e7233', '67824e29-190c-4cc3-9340-261054d9e543', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=70', 0)
ON CONFLICT (id) DO NOTHING;

-- 4) Conversations recues par Aminata Diallo (acheteuse = Aminata Daou) --
INSERT INTO public.conversations (id, acheteur_id, vendeur_id, annonce_id, dernier_message, date_dernier_message) VALUES
  ('ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), '7d8cc202-279f-4538-a2fe-c1adc45ad48e', 'Ca marche, je peux passer demain a ACI 2000 ?', NOW() - INTERVAL '3 minutes'),
  ('7de67791-170f-4c98-8b2e-5ac4e49f4ee9', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), '67824e29-190c-4cc3-9340-261054d9e543', 'Bonjour, le sac est-il encore disponible ?', NOW() - INTERVAL '40 minutes')
ON CONFLICT (acheteur_id, vendeur_id, annonce_id) DO NOTHING;

-- 5) Messages des conversations -----------------------------------------
INSERT INTO public.messages (id, conversation_id, expediteur_id, contenu, lu, date_envoi) VALUES
  ('b56e8c7d-4c3b-4127-8e60-e9c9888f82fe', 'ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Bonjour, est-ce que l''iPhone 14 Pro Max est toujours disponible ?', true, NOW() - INTERVAL '26 minutes'),
  ('73d9c8eb-0e14-4305-beef-6762c99eed61', 'ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Bonjour ! Oui, il est encore disponible.', true, NOW() - INTERVAL '24 minutes'),
  ('edfb3f1e-9ac5-4dc1-aa70-af2a6d936473', 'ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Super ! Il est en bon etat ? La batterie tient bien ?', true, NOW() - INTERVAL '22 minutes'),
  ('f92d0ea3-185f-4797-9eda-a218b2f83d75', 'ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Oui, comme neuf. Batterie a 96%, aucune rayure.', true, NOW() - INTERVAL '20 minutes'),
  ('e9c027b2-2e07-474c-9e7b-0389c432c9cc', 'ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'D''accord. Vous pouvez faire un petit geste sur le prix ?', true, NOW() - INTERVAL '12 minutes'),
  ('b033216e-f14b-413c-8342-629df04aa441', 'ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Diallo' ORDER BY date_creation LIMIT 1), 'Je peux descendre a 410 000 FCFA, c''est mon dernier prix.', true, NOW() - INTERVAL '10 minutes'),
  ('0ba533b5-0f7b-4d41-abd7-8564cef17c8a', 'ba6af478-8d34-425c-94c1-f7fb6ada03aa', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Ca marche, je peux passer demain a ACI 2000 ?', false, NOW() - INTERVAL '3 minutes'),
  ('f88da141-1eb4-47d8-9f71-59176f0d0add', '7de67791-170f-4c98-8b2e-5ac4e49f4ee9', (SELECT id FROM public.users WHERE prenom='Aminata' AND nom='Daou'   ORDER BY date_creation LIMIT 1), 'Bonjour, le sac est-il encore disponible ?', false, NOW() - INTERVAL '40 minutes')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =====================================================================
-- CLEANUP (optionnel) - a executer pour SUPPRIMER toutes les donnees demo
-- apres avoir pris vos captures. De-commentez les 2 lignes puis executez.
-- (supprime les annonces SEED-DEMO + en cascade leurs images, conversations
--  et messages). Vos comptes ne sont pas touches.
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.annonces WHERE id_transaction_paiement = 'SEED-DEMO';
-- COMMIT;
