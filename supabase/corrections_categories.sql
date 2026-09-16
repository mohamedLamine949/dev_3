-- Correction du rangement des annonces — généré par
-- app/scripts/generer-corrections-categories.js
-- Généré le 2026-09-16 sur 248 annonces actives.
--
-- À exécuter dans l'éditeur SQL du dashboard Supabase, APRÈS relecture.
-- Chaque UPDATE vérifie l'ancienne valeur : une annonce modifiée par son
-- vendeur depuis la génération de ce fichier ne sera pas touchée.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- SAUVEGARDE
-- Le rangement actuel, pour pouvoir revenir en arrière (requête en fin de fichier).
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.annonces_categories_sauvegarde (
  id UUID PRIMARY KEY,
  categorie TEXT,
  sous_categorie TEXT,
  sauvegarde_le TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.annonces_categories_sauvegarde (id, categorie, sous_categorie)
SELECT id, categorie, sous_categorie FROM public.annonces
WHERE id IN (
    'fafab3a1-4fc6-4122-8e9c-fd23d5fce12c',
    '42caa93a-ef5a-433c-9e03-635259f07b64',
    'd6f54f22-97ec-44b9-961e-d00837878b4e',
    'd05be292-ecb6-4866-b14c-bf81c809b5d8',
    '7d1296a2-fbc8-4249-9fb6-250a042517c7',
    'e8cf3b97-b488-40ea-934a-ae9ae811bded',
    'fcfd5109-5fe8-4f20-b6f4-c749780d93aa',
    '4efefec7-9bce-4897-8420-54ab8fd707cc',
    'af695df7-45bc-4167-9faa-91530edfa297',
    'e3bae614-8b9f-4d02-b59d-9171e77e3d02',
    'f9226ea6-6fca-4aa5-aac2-f79b19539328',
    '9339fd38-fbe7-4422-8398-79b829788c1e',
    'ed8ea991-241c-4796-965d-8b44b30a4055',
    'beb398ba-f00d-4f62-805b-e8a5bac1c3e7',
    '95ac4672-6de3-43e9-9b66-70b58f7d6cfc',
    'dbb78c64-48f0-4434-ad2a-622a9ab83709',
    '7a259500-c419-418f-bd21-d73e53e891b4',
    '76ed4381-6e8e-4549-aff3-44926433ae93',
    '8a1e6948-5873-44b9-8aa5-078fd78f1c5b',
    '1a32862e-a892-4a32-9876-2c88cf465bec',
    '78fa4bd5-d1ca-4b4d-b29a-b44b477b7e4e',
    'b1415d92-d063-46ce-95ee-564decac0602',
    '228a28d7-8373-4523-b97e-8dc906d38677',
    '408ba9b0-a2dd-4f9d-937e-972fcaa3bb8d',
    '74a8ad91-7c63-4270-9e8c-8160aa7bef2a',
    '7e38865d-df9f-45f4-b609-6b9386ba8f09',
    'bd30ba6f-cec6-4fcc-96d3-d188ac803954',
    'c250ee38-3ba2-4343-8014-01bc6d28566b',
    'c3a8b0da-3059-4f92-9bbb-d802ce47ec0e',
    'eeed1094-98aa-49e5-aa68-dd50af14eb55',
    'b3605115-bbc0-4705-b6fe-3bcab157124c',
    '52f21b6f-2516-44e2-b6cd-cbbd4f71f7c9',
    '1fa24476-1d6b-485d-b6c9-a4d1cf8a1018',
    '70e560f8-0aad-43d3-9b7b-3001ef8ed00e',
    'e734329e-7668-4096-b72a-f89b2bcd416c',
    '2b49424a-d3c6-4cc4-b17e-acd446031f37',
    'd61027db-1031-4a75-be88-6e556e7056a1',
    'fec68de2-e8a0-4f6b-a6a8-b9f64733968b',
    'b7955eae-4b9a-4b3f-8b11-56061898c622',
    'c6a1d694-ca81-4534-9c76-62e138b07063',
    'ed324612-4ec9-466c-9420-1b4d67cb4253',
    'fa675855-93d6-4d4e-b5d1-f1b50f5dcea4',
    'ebb4d549-2814-40fa-9136-45d06c5d351f',
    'ade6b1e8-4364-4b16-a713-7f344830613f',
    '00a5d0c5-baca-4e9f-9191-5c56ca061b89',
    'e490a3a0-68f6-4ab3-b5ba-31b6382650ad',
    '1a96fa99-3625-4aaa-97dd-11364efb5b1c',
    'b0152666-2a49-4200-870c-05f3ed2e780e',
    '157295f1-bcad-4476-ac80-0918f82a2926',
    '3594a6da-6a36-4197-8138-a5075157c0aa',
    '7e53a6e5-99d8-4dd3-8984-47425acaebd0',
    '11a91cf6-dd30-4f68-b90f-b5399b8fbd5c',
    '9ed51fda-f233-444e-ba0a-5757fda6859a',
    'b2db8000-64b6-4d0d-8fd9-f5e2768e8e53',
    'cf5a6bfc-caff-41b6-83bd-3e3e677ab6d1',
    '7ca2718b-9874-4d13-b199-11d8b67b0b08',
    '6d41e556-b70b-4455-bf96-3b29f89af7be',
    '54aa2770-805f-4ae0-9056-f8fb657dd772',
    '130ec478-d65d-4e9d-ac98-fba5592c132f',
    '16d16e06-1514-48e7-a699-f8cc8e8d2dd2',
    '143c0327-3442-421d-815b-dc0a5eef6a86',
    '6763dc95-19d0-4076-af49-04eb96713544',
    'd9c4a630-1a6b-4f27-8078-89717dd0f68e',
    'c43e6d67-3aa8-48d2-a2f1-a5d553ad3bc9',
    '30814807-afd3-44aa-aa57-5cf4ddd2f2ba',
    '6af19ca1-fe50-4dd8-9b8d-91ca717843ff',
    '99a19ae6-ca18-49d8-aded-8aa2e8e65334',
    'aa2e79d9-bd5d-42e5-a7b0-e880229b47ee'
  )
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────
-- 1. CATÉGORIE CONTREDITE PAR LE TEXTE — 18 annonces
-- Le titre dit clairement autre chose que la catégorie choisie.
-- ──────────────────────────────────────────────────────────────────────

-- « Cuisinière gaz 4 feux »
--   Téléphonie & Électronique → Maison & Électroménager / Électroménager   (mots : cuisiniere, gaz)
UPDATE public.annonces SET categorie = 'maison_electromenager', sous_categorie = 'electromenager'
  WHERE id = 'fafab3a1-4fc6-4122-8e9c-fd23d5fce12c' AND categorie = 'telephonie_electronique';

-- « Nems Pastel Mini pizza »
--   Services → Alimentation / Restaurants & Plats préparés   (mots : pizza)
UPDATE public.annonces SET categorie = 'alimentation', sous_categorie = 'restaurants'
  WHERE id = '42caa93a-ef5a-433c-9e03-635259f07b64' AND categorie = 'services';

-- « Box de Chawarma »
--   Services → Alimentation / Restaurants & Plats préparés   (mots : chawarma)
UPDATE public.annonces SET categorie = 'alimentation', sous_categorie = 'restaurants'
  WHERE id = 'd6f54f22-97ec-44b9-961e-d00837878b4e' AND categorie = 'services';

-- « VENTES DES MAILLOTS ORIGINAUX ET AUTHENTIQUES »
--   Services → Mode & Beauté / Vêtements homme   (mots : maillot)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'vetements_homme'
  WHERE id = 'd05be292-ecb6-4866-b14c-bf81c809b5d8' AND categorie = 'services';

-- « Montre origine Pour les gentleman »
--   Téléphonie & Électronique → Mode & Beauté / Montres & Bijoux   (mots : montre)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'montres_bijoux'
  WHERE id = '7d1296a2-fbc8-4249-9fb6-250a042517c7' AND categorie = 'telephonie_electronique';

-- « Montre AP »
--   Téléphonie & Électronique → Mode & Beauté / Montres & Bijoux   (mots : montre)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'montres_bijoux'
  WHERE id = 'e8cf3b97-b488-40ea-934a-ae9ae811bded' AND categorie = 'telephonie_electronique';

-- « Mini ventilateur rechargeable »
--   Téléphonie & Électronique → Maison & Électroménager / Électroménager   (mots : ventilateur)
UPDATE public.annonces SET categorie = 'maison_electromenager', sous_categorie = 'electromenager'
  WHERE id = 'fcfd5109-5fe8-4f20-b6f4-c749780d93aa' AND categorie = 'telephonie_electronique';

-- « Maillot version authentique »
--   Services → Mode & Beauté / Vêtements homme   (mots : maillot)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'vetements_homme'
  WHERE id = '4efefec7-9bce-4897-8420-54ab8fd707cc' AND categorie = 'services';

-- « Plomberies »
--   Maison & Électroménager → Services / Construction & BTP   (mots : plomberie)
UPDATE public.annonces SET categorie = 'services', sous_categorie = 'construction_btp'
  WHERE id = 'af695df7-45bc-4167-9faa-91530edfa297' AND categorie = 'maison_electromenager';

-- « Matelas Maeva by Dodo - Neuf, 2place épaisseurs 30 disponibles »
--   Téléphonie & Électronique → Maison & Électroménager / Meubles   (mots : matelas)
UPDATE public.annonces SET categorie = 'maison_electromenager', sous_categorie = 'meubles'
  WHERE id = 'e3bae614-8b9f-4d02-b59d-9171e77e3d02' AND categorie = 'telephonie_electronique';

-- « Diffuseur de parfum et huile essentielle »
--   Maison & Électroménager → Mode & Beauté / Beauté & Cosmétiques   (mots : huile essentielle, parfum)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'beaute_cosmetiques'
  WHERE id = 'f9226ea6-6fca-4aa5-aac2-f79b19539328' AND categorie = 'maison_electromenager';

-- « Compte Netflix illimité »
--   Services → Téléphonie & Électronique / Autre   (mots : compte netflix)
UPDATE public.annonces SET categorie = 'telephonie_electronique', sous_categorie = 'autre_telephonie_electronique'
  WHERE id = '9339fd38-fbe7-4422-8398-79b829788c1e' AND categorie = 'services';

-- « Montre Original »
--   Téléphonie & Électronique → Mode & Beauté / Montres & Bijoux   (mots : montre)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'montres_bijoux'
  WHERE id = 'ed8ea991-241c-4796-965d-8b44b30a4055' AND categorie = 'telephonie_electronique';

-- « Maillot original »
--   Services → Mode & Beauté / Vêtements homme   (mots : maillot)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'vetements_homme'
  WHERE id = 'beb398ba-f00d-4f62-805b-e8a5bac1c3e7' AND categorie = 'services';

-- « Vaseline grand »
--   Services → Mode & Beauté / Beauté & Cosmétiques   (mots : vaseline)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'beaute_cosmetiques'
  WHERE id = '95ac4672-6de3-43e9-9b66-70b58f7d6cfc' AND categorie = 'services';

-- « Maillot version automatique »
--   Services → Mode & Beauté / Vêtements homme   (mots : maillot)
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'vetements_homme'
  WHERE id = 'dbb78c64-48f0-4434-ad2a-622a9ab83709' AND categorie = 'services';

-- « Des comptes efootball »
--   Services → Téléphonie & Électronique / Consoles & Jeux vidéo   (mots : efootball)
UPDATE public.annonces SET categorie = 'telephonie_electronique', sous_categorie = 'consoles_jeux_video'
  WHERE id = '7a259500-c419-418f-bd21-d73e53e891b4' AND categorie = 'services';

-- « Autruche »
--   Alimentation → Animaux / Autre   (mots : autruche)
UPDATE public.annonces SET categorie = 'animaux', sous_categorie = 'autre_animaux'
  WHERE id = '76ed4381-6e8e-4549-aff3-44926433ae93' AND categorie = 'alimentation';


-- ──────────────────────────────────────────────────────────────────────
-- 2. SOUS-CATÉGORIE ABSENTE, DEVINÉE PAR LE TITRE — 21 annonces
-- Annonces publiées avant les sous-catégories : sans rayon, elles seront invisibles dans le nouvel accueil.
-- ──────────────────────────────────────────────────────────────────────

-- « Des bonnes qualités de voiture toute neuf le prix Seta discuter »  →  Voitures   (mots : voiture)
UPDATE public.annonces SET sous_categorie = 'voitures_vente'
  WHERE id = '8a1e6948-5873-44b9-8aa5-078fd78f1c5b' AND sous_categorie IS NULL;

-- « SAC À DOS »  →  Sacs & Accessoires   (mots : sac a dos)
UPDATE public.annonces SET sous_categorie = 'sacs_accessoires'
  WHERE id = '1a32862e-a892-4a32-9876-2c88cf465bec' AND sous_categorie IS NULL;

-- « Sac à dos »  →  Sacs & Accessoires   (mots : sac a dos)
UPDATE public.annonces SET sous_categorie = 'sacs_accessoires'
  WHERE id = '78fa4bd5-d1ca-4b4d-b29a-b44b477b7e4e' AND sous_categorie IS NULL;

-- « Lunettes anti-reflet »  →  Sacs & Accessoires   (mots : lunettes)
UPDATE public.annonces SET sous_categorie = 'sacs_accessoires'
  WHERE id = 'b1415d92-d063-46ce-95ee-564decac0602' AND sous_categorie IS NULL;

-- « Lunette Anti-reflet »  →  Sacs & Accessoires   (mots : lunettes)
UPDATE public.annonces SET sous_categorie = 'sacs_accessoires'
  WHERE id = '228a28d7-8373-4523-b97e-8dc906d38677' AND sous_categorie IS NULL;

-- « Lunettes »  →  Sacs & Accessoires   (mots : lunettes)
UPDATE public.annonces SET sous_categorie = 'sacs_accessoires'
  WHERE id = '408ba9b0-a2dd-4f9d-937e-972fcaa3bb8d' AND sous_categorie IS NULL;

-- « Maillot original »  →  Vêtements homme   (mots : maillot)
UPDATE public.annonces SET sous_categorie = 'vetements_homme'
  WHERE id = '74a8ad91-7c63-4270-9e8c-8160aa7bef2a' AND sous_categorie IS NULL;

-- « Maillot original disponible »  →  Vêtements homme   (mots : maillot)
UPDATE public.annonces SET sous_categorie = 'vetements_homme'
  WHERE id = '7e38865d-df9f-45f4-b609-6b9386ba8f09' AND sous_categorie IS NULL;

-- « Corolla S »  →  Voitures   (mots : corolla, moteur)
UPDATE public.annonces SET sous_categorie = 'voitures_vente'
  WHERE id = 'bd30ba6f-cec6-4fcc-96d3-d188ac803954' AND sous_categorie IS NULL;

-- « Xbox séries S + Manette Original »  →  Consoles & Jeux vidéo   (mots : manette, xbox, console)
UPDATE public.annonces SET sous_categorie = 'consoles_jeux_video'
  WHERE id = 'c250ee38-3ba2-4343-8014-01bc6d28566b' AND sous_categorie IS NULL;

-- « Maillot »  →  Vêtements homme   (mots : maillot)
UPDATE public.annonces SET sous_categorie = 'vetements_homme'
  WHERE id = 'c3a8b0da-3059-4f92-9bbb-d802ce47ec0e' AND sous_categorie IS NULL;

-- « Des broumousses et Abayas de qualité extraordinaire »  →  Vêtements femme   (mots : abaya)
UPDATE public.annonces SET sous_categorie = 'vetements_femme'
  WHERE id = 'eeed1094-98aa-49e5-aa68-dd50af14eb55' AND sous_categorie IS NULL;

-- « Kia k5 tout fini 6.500.00 »  →  Voitures   (mots : kia)
UPDATE public.annonces SET sous_categorie = 'voitures_vente'
  WHERE id = 'b3605115-bbc0-4705-b6fe-3bcab157124c' AND sous_categorie IS NULL;

-- « Chaussure de basketball »  →  Chaussures   (mots : chaussure, baskets)
UPDATE public.annonces SET sous_categorie = 'chaussures'
  WHERE id = '52f21b6f-2516-44e2-b6cd-cbbd4f71f7c9' AND sous_categorie IS NULL;

-- « Parfum »  →  Beauté & Cosmétiques   (mots : parfum)
UPDATE public.annonces SET sous_categorie = 'beaute_cosmetiques'
  WHERE id = '1fa24476-1d6b-485d-b6c9-a4d1cf8a1018' AND sous_categorie IS NULL;

-- « Casquette Fendi Authentique »  →  Sacs & Accessoires   (mots : casquette)
UPDATE public.annonces SET sous_categorie = 'sacs_accessoires'
  WHERE id = '70e560f8-0aad-43d3-9b7b-3001ef8ed00e' AND sous_categorie IS NULL;

-- « Play station 2 »  →  Consoles & Jeux vidéo   (mots : play station)
UPDATE public.annonces SET sous_categorie = 'consoles_jeux_video'
  WHERE id = 'e734329e-7668-4096-b72a-f89b2bcd416c' AND sous_categorie IS NULL;

-- « Air pod pro Max original »  →  Accessoires   (mots : air pod)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = '2b49424a-d3c6-4cc4-b17e-acd446031f37' AND sous_categorie IS NULL;

-- « Moto JAKARTA »  →  Motos & Scooters   (mots : jakarta, moto)
UPDATE public.annonces SET sous_categorie = 'motos_scooters'
  WHERE id = 'd61027db-1031-4a75-be88-6e556e7056a1' AND sous_categorie IS NULL;

-- « Ticket de Concert Trk »  →  Événementiel   (mots : concert, ticket)
UPDATE public.annonces SET sous_categorie = 'evenementiel'
  WHERE id = 'fec68de2-e8a0-4f6b-a6a8-b9f64733968b' AND sous_categorie IS NULL;

-- « Moto RATO »  →  Motos & Scooters   (mots : moto)
UPDATE public.annonces SET sous_categorie = 'motos_scooters'
  WHERE id = 'b7955eae-4b9a-4b3f-8b11-56061898c622' AND sous_categorie IS NULL;


-- ──────────────────────────────────────────────────────────────────────
-- 3. SOUS-CATÉGORIE ABSENTE, HÉRITÉE DU VENDEUR — 0 annonces
-- Aucun mot reconnaissable (parfums nommés par leur marque) : on reprend le rayon habituel du vendeur.
-- ──────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────
-- 4. SOUS-CATÉGORIE À CORRIGER — 19 annonces
-- Bonne catégorie, mauvais rayon à l'intérieur.
-- ──────────────────────────────────────────────────────────────────────

-- « Ensemble clavier, souris et support téléphone 3 en 1 »  Autre → Accessoires   (mots : support telephone, clavier)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = 'c6a1d694-ca81-4534-9c76-62e138b07063' AND sous_categorie = 'autre_telephonie_electronique';

-- « Amplificateur d'écran 3D pour smartphone »  Téléphones → TV & Audio   (mots : smartphone, ecran, ampli)
UPDATE public.annonces SET sous_categorie = 'tv_audio'
  WHERE id = 'ed324612-4ec9-466c-9420-1b4d67cb4253' AND sous_categorie = 'telephones';

-- « Tripied intelligente »  Autre → Accessoires   (mots : tripied)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = 'fa675855-93d6-4d4e-b5d1-f1b50f5dcea4' AND sous_categorie = 'autre_telephonie_electronique';

-- « Moustiquaire Royales »  Autre → Décoration   (mots : moustiquaire)
UPDATE public.annonces SET sous_categorie = 'decoration'
  WHERE id = 'ebb4d549-2814-40fa-9136-45d06c5d351f' AND sous_categorie = 'autre_maison_electromenager';

-- « Moustiquaire pliable »  Autre → Décoration   (mots : moustiquaire)
UPDATE public.annonces SET sous_categorie = 'decoration'
  WHERE id = 'ade6b1e8-4364-4b16-a713-7f344830613f' AND sous_categorie = 'autre_maison_electromenager';

-- « Sac à dos »  Vêtements femme → Sacs & Accessoires   (mots : sac a dos)
UPDATE public.annonces SET sous_categorie = 'sacs_accessoires'
  WHERE id = '00a5d0c5-baca-4e9f-9191-5c56ca061b89' AND sous_categorie = 'vetements_femme';

-- « Robe hijab »  Vêtements homme → Vêtements femme   (mots : hijab, robe)
UPDATE public.annonces SET sous_categorie = 'vetements_femme'
  WHERE id = 'e490a3a0-68f6-4ab3-b5ba-31b6382650ad' AND sous_categorie = 'vetements_homme';

-- « Bracelet et bague en acier inoxydable »  Sacs & Accessoires → Montres & Bijoux   (mots : bracelet, bague, bijou)
UPDATE public.annonces SET sous_categorie = 'montres_bijoux'
  WHERE id = '1a96fa99-3625-4aaa-97dd-11364efb5b1c' AND sous_categorie = 'sacs_accessoires';

-- « Écouteurs sans fil Q10 »  Autre → Accessoires   (mots : ecouteurs, design, cable)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = 'b0152666-2a49-4200-870c-05f3ed2e780e' AND sous_categorie = 'autre_telephonie_electronique';

-- « Kit montre complet »  Sacs & Accessoires → Montres & Bijoux   (mots : montre)
UPDATE public.annonces SET sous_categorie = 'montres_bijoux'
  WHERE id = '157295f1-bcad-4476-ac80-0918f82a2926' AND sous_categorie = 'sacs_accessoires';

-- « Tissu premium de haute qualité »  Vêtements homme → Vêtements femme   (mots : tissu)
UPDATE public.annonces SET sous_categorie = 'vetements_femme'
  WHERE id = '3594a6da-6a36-4197-8138-a5075157c0aa' AND sous_categorie = 'vetements_homme';

-- « Wifi portable 4/5G »  Autre → Accessoires   (mots : portable, wifi)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = '7e53a6e5-99d8-4dd3-8984-47425acaebd0' AND sous_categorie = 'autre_telephonie_electronique';

-- « MONTRE STYLE ROLEX »  Sacs & Accessoires → Montres & Bijoux   (mots : montre, rolex, design)
UPDATE public.annonces SET sous_categorie = 'montres_bijoux'
  WHERE id = '11a91cf6-dd30-4f68-b90f-b5399b8fbd5c' AND sous_categorie = 'sacs_accessoires';

-- « CAMÉRA DRONE »  Consoles & Jeux vidéo → Accessoires   (mots : camera, drone, batterie, video)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = '9ed51fda-f233-444e-ba0a-5757fda6859a' AND sous_categorie = 'consoles_jeux_video';

-- « Écouteurs type c »  Autre → Accessoires   (mots : ecouteurs)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = 'b2db8000-64b6-4d0d-8fd9-f5e2768e8e53' AND sous_categorie = 'autre_telephonie_electronique';

-- « Titre : Maillots de Football – De la nouvelle saison🔥 »  Autre → Vêtements homme   (mots : maillot)
UPDATE public.annonces SET sous_categorie = 'vetements_homme'
  WHERE id = 'cf5a6bfc-caff-41b6-83bd-3e3e677ab6d1' AND sous_categorie = 'autre_mode_beaute';

-- « Matelas Maeva by Dodo - Neuf,2place épaisseurs 10 »  Autre → Meubles   (mots : matelas)
UPDATE public.annonces SET sous_categorie = 'meubles'
  WHERE id = '7ca2718b-9874-4d13-b199-11d8b67b0b08' AND sous_categorie = 'autre_maison_electromenager';

-- « Matelas Maeva by Dodo - Neuf, toutes épaisseurs disponibles »  Autre → Meubles   (mots : matelas)
UPDATE public.annonces SET sous_categorie = 'meubles'
  WHERE id = '6d41e556-b70b-4455-bf96-3b29f89af7be' AND sous_categorie = 'autre_maison_electromenager';

-- « Super fast charging chargeur »  Autre → Accessoires   (mots : chargeur)
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = '54aa2770-805f-4ae0-9056-f8fb657dd772' AND sous_categorie = 'autre_telephonie_electronique';


-- ──────────────────────────────────────────────────────────────────────
-- 5. ARBITRAGES À LA MAIN — 10 annonces
-- Décidés en regardant l'annonce elle-même ; ils priment sur la détection.
-- ──────────────────────────────────────────────────────────────────────

-- « CAFÉ 100% africain en grains et en capsules. »
--   Alimentation / (vide) → Alimentation / Supermarchés & Épicerie
--   cafe en grains
UPDATE public.annonces SET sous_categorie = 'supermarches'
  WHERE id = '130ec478-d65d-4e9d-ac98-fba5592c132f' AND categorie = 'alimentation' AND sous_categorie IS NOT DISTINCT FROM NULL;

-- « Répétiteur de wifi »
--   Téléphonie & Électronique / Autre → Téléphonie & Électronique / Accessoires
--   appareil wifi : rayon Accessoires plutot que « Autre »
UPDATE public.annonces SET sous_categorie = 'accessoires_electronique'
  WHERE id = '16d16e06-1514-48e7-a699-f8cc8e8d2dd2' AND categorie = 'telephonie_electronique' AND sous_categorie IS NOT DISTINCT FROM 'autre_telephonie_electronique';

-- « 🛴⚡ HOVERBOARD »
--   Maison & Électroménager / Autre → Motos / Motos & Scooters
--   engin roulant, meme famille que les trottinettes
UPDATE public.annonces SET categorie = 'motos', sous_categorie = 'motos_scooters'
  WHERE id = '143c0327-3442-421d-815b-dc0a5eef6a86' AND categorie = 'maison_electromenager' AND sous_categorie IS NOT DISTINCT FROM 'autre_maison_electromenager';

-- « Sangles Élastiques Plates avec Crochets en Acier – Haute Résistance »
--   Motos / Autre → Maison & Électroménager / Autre
--   sangles d'arrimage : usage maison
UPDATE public.annonces SET categorie = 'maison_electromenager', sous_categorie = 'autre_maison_electromenager'
  WHERE id = '6763dc95-19d0-4076-af49-04eb96713544' AND categorie = 'motos' AND sous_categorie IS NOT DISTINCT FROM 'autre_motos';

-- « Formation Netflix illimité »
--   Téléphonie & Électronique / Autre → Services / Autres services
--   abonnement revendu : service, et non « Cours & Formation »
UPDATE public.annonces SET categorie = 'services', sous_categorie = 'autres_services'
  WHERE id = 'd9c4a630-1a6b-4f27-8078-89717dd0f68e' AND categorie = 'telephonie_electronique' AND sous_categorie IS NOT DISTINCT FROM 'autre_telephonie_electronique';

-- « Ensemble crochet pour enfants sur commande »
--   Mode & Beauté / (vide) → Mode & Beauté / Autre
--   vetements enfants : pas de rayon dedie
UPDATE public.annonces SET sous_categorie = 'autre_mode_beaute'
  WHERE id = 'c43e6d67-3aa8-48d2-a2f1-a5d553ad3bc9' AND categorie = 'mode_beaute' AND sous_categorie IS NOT DISTINCT FROM NULL;

-- « The Gingembre »
--   Mode & Beauté / Beauté & Cosmétiques → Alimentation / Supermarchés & Épicerie
--   the au gingembre
UPDATE public.annonces SET categorie = 'alimentation', sous_categorie = 'supermarches'
  WHERE id = '30814807-afd3-44aa-aa57-5cf4ddd2f2ba' AND categorie = 'mode_beaute' AND sous_categorie IS NOT DISTINCT FROM 'beaute_cosmetiques';

-- « TOUDY GRAND »
--   Services / (vide) → Mode & Beauté / Beauté & Cosmétiques
--   creme, rangee a tort dans les services
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'beaute_cosmetiques'
  WHERE id = '6af19ca1-fe50-4dd8-9b8d-91ca717843ff' AND categorie = 'services' AND sous_categorie IS NOT DISTINCT FROM NULL;

-- « Clair naturelle »
--   Mode & Beauté / (vide) → Mode & Beauté / Beauté & Cosmétiques
--   creme
UPDATE public.annonces SET sous_categorie = 'beaute_cosmetiques'
  WHERE id = '99a19ae6-ca18-49d8-aded-8aa2e8e65334' AND categorie = 'mode_beaute' AND sous_categorie IS NOT DISTINCT FROM NULL;

-- « Clair, naturel, carottes, et miel »
--   Services / (vide) → Mode & Beauté / Beauté & Cosmétiques
--   creme eclaircissante — DEDUIT, a verifier
UPDATE public.annonces SET categorie = 'mode_beaute', sous_categorie = 'beaute_cosmetiques'
  WHERE id = 'aa2e79d9-bd5d-42e5-a7b0-e880229b47ee' AND categorie = 'services' AND sous_categorie IS NOT DISTINCT FROM NULL;

-- Arbitrages « ne rien changer » (2) — le détecteur se trompait :
--   « Pink sugar » reste en Mode & Beauté / Beauté & Cosmétiques — Pink sugar est un parfum, pas un produit alimentaire
--   « Gaz manette portable » reste en Maison & Électroménager / Électroménager — rechaud a gaz, comme une gaziniere

COMMIT;

-- ══════════════════════════════════════════════════════════════════════
-- RESTE À TRANCHER À LA MAIN (aucun UPDATE ci-dessous)
-- ══════════════════════════════════════════════════════════════════════

-- A. Désaccords non concluants — 0 annonces.
--    Le texte suggère autre chose, mais pas assez nettement pour agir seul.

-- B. Toujours sans sous-catégorie — 1 annonces.
--    Ni le titre ni l'habitude du vendeur ne permettent de conclure.
--    « Shopping 🛍️ 🛍️🛒 »  (Mode & Beauté)
--      UPDATE public.annonces SET sous_categorie = '???' WHERE id = 'a215d451-169e-45f0-8b0b-6599b9c45df7';

-- ══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE (à exécuter seulement en cas de problème)
-- ══════════════════════════════════════════════════════════════════════
-- UPDATE public.annonces a
--   SET categorie = s.categorie, sous_categorie = s.sous_categorie
--   FROM public.annonces_categories_sauvegarde s
--   WHERE a.id = s.id;
