# Banque d'images — vidéo IA 30 s (3 × 10 s)

**Un dossier = une scène = une génération de 10 s.**
Tu déposes le contenu du dossier dans l'outil, dans l'ordre des numéros.

```
marketing/video-30s/
├── scene-1-accroche-decouverte/          5 images
├── scene-2-recherche-negociation/        4 images
├── scene-3-publication-telechargement/   4 images
└── reserve/                             14 images (plans de secours)
```

Les rendus d'écran sont en **1080 × 1920 pile (9:16)**, générés depuis l'app réelle et
**débarrassés de tout habillage vidéo** (légendes, badge d'étape, barre de progression) :
l'outil de génération ne risque donc pas de recopier un texte parasite.

Le **code court** (`A1`, `B3`, `D5`…) reste dans chaque nom de fichier : c'est comme ça
que je désignerai les images dans les prompts, sans ambiguïté.

Pour régénérer les rendus après une modif de l'app :
`cd marketing/tools && node capture-shots.js`

---

## 🎬 Scène 1 — Accroche & découverte (0–10 s)
> On plante la marque, puis l'abondance d'annonces.

| Ordre | Fichier | Ce qu'on voit |
|---|---|---|
| 1 | `1-A1-logo-marque.png` | Logo Flash Market (tuile verte, sac + éclair) + nom + « Le marché du Mali, dans ta poche » |
| 2 | `2-A2-accroche-tout-sachete.png` | Typo plein cadre : **TOUT S'ACHÈTE. TOUT SE VEND.** (soulignés rouges) |
| 3 | `3-B1-accueil-annonces.png` | Téléphone 3D — Accueil : « Salut, Aminata ! », bandeau sécurité, grille d'annonces avec **vraies photos** |
| 4 | `4-D2-sac-cuir-rouge.png` | Photo produit : sac à main en cuir rouge (belle lumière) |
| 5 | `5-D5-voiture-avant.jpg` | Photo produit : voiture de face — **contexte malien** (terre rouge, plaque locale) |

## 🎬 Scène 2 — Cherche & négocie (10–20 s)
> Le cœur du produit : trouver près de soi, puis discuter le prix.

| Ordre | Fichier | Ce qu'on voit |
|---|---|---|
| 1 | `1-B3-recherche-resultats.png` | Recherche « téléphone » tapée + 3 résultats (photo, lieu, distance, prix) |
| 2 | `2-B4-fiche-annonce.png` | Fiche annonce : grande photo, **285 000 F**, Hamdallaye · 2 km, vendeur vérifié 4,8★ |
| 3 | `3-D1-iphone-13-pro.png` | Photo produit : iPhone posé sur un ordinateur portable (plan d'insert) |
| 4 | `4-B5-conversation-negociation.png` | Conversation : la négociation jusqu'à l'accord |

## 🎬 Scène 3 — Vends & télécharge (20–30 s)
> Publier en 2 minutes, puis l'appel à l'action.

| Ordre | Fichier | Ce qu'on voit |
|---|---|---|
| 1 | `1-B7-publier-annonce.png` | Publier : photo de la voiture ajoutée, titre + prix remplis, bouton « Publier mon annonce » |
| 2 | `2-E2-timer-2-minutes.png` | Anneau de progression + « 2 min pour publier ton annonce » |
| 3 | `3-A3-trouve-negocie-vendu.png` | Typo plein cadre : **TROUVÉ. NÉGOCIÉ. VENDU.** |
| 4 | `4-A5-carton-final-stores.png` | Carton final : logo + « Achète. Vends. Près de toi. » + App Store & Google Play + URL |

---

## 📦 Réserve
À piocher si une scène a besoin d'un plan de plus.

**Écrans de l'app (téléphone 3D)**
| Code | Fichier | Contenu |
|---|---|---|
| B2 | `B2-categories.png` | 6 catégories colorées (Maison, Voitures, Motos, Immobilier, Alimentation, Services) |
| B6 | `B6-messagerie.png` | Liste des discussions, vignettes produits, badges non-lus |
| B8 | `B8-profil-vendeur.png` | Profil : avatar, stats, menu |

**Cartons texte / graphiques**
| Code | Fichier | Contenu |
|---|---|---|
| A4 | `A4-arguments-cles.png` | 4 arguments : gratuit · près de toi · négocie en direct · annonce en 2 min |
| E1 | `E1-courbe-croissance.png` | Grand nombre + courbe Jan→Juin — ⚠️ **chiffre d'illustration, à remplacer par le vrai** |

**Captures brutes de l'app** (1170 × 2532, sans cadre de téléphone)
| Code | Fichier | Remarque |
|---|---|---|
| C1 | `C1-accueil-reel.png` | ✅ |
| C2 | `C2-recherche-reel-ATTENTION-adresse-France.png` | ⚠️ **À ÉVITER** — affiche « 2 Place du Haut Montoir, **Cergy** » (France) + « Scanner de code ». Prendre **B2** à la place |
| C3 | `C3-conversation-reelle.png` | ✅ négociation réelle jusqu'à 410 000 FCFA — très crédible |
| C4 | `C4-messagerie-reelle.png` | ✅ |
| C5 | `C5-profil-reel.png` | ✅ |

**Photos produits**
| Code | Fichier | Sujet |
|---|---|---|
| D3 | `D3-samsung-galaxy.png` | Samsung Galaxy sur fond noir |
| D4 | `D4-tablette.png` | Tablette |
| D6 | `D6-voiture-cote.jpg` | Voiture de profil (même véhicule que D5) |
| D7 | `D7-macbook.jpg` | MacBook ouvert |
