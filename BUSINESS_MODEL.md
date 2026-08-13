# Business Model — Flash Market (Chap Chap)

> Document de référence pour l'exécution. Formalise le modèle de monétisation,
> la structure des offres, le fonctionnement de la recherche, de la page d'accueil
> et l'expérience professionnelle.
>
> **Statut de chaque point :** ✅ = verrouillé · 🟡 = à trancher (voir §11).

---

## 1. Principe directeur

L'application est une **marketplace à deux côtés**. Une seule règle gouverne tout le reste :

> **L'acheteur ne paie jamais. On monétise uniquement le vendeur.**
> Rechercher, parcourir, filtrer, contacter un vendeur → **gratuit à vie.**

La demande (les acheteurs) est ce qui donne de la valeur à l'offre. On ne met **aucune**
barrière côté acheteur. Toute la monétisation se joue côté vendeur.

Deuxième principe, pour l'amorçage : **l'offre d'abord, la lumière ensuite.**
On remplit d'abord le catalogue (côté vendeur), on monétise ensuite les vendeurs qui
gagnent de la visibilité et des clients. On ne fait **jamais** payer l'offre avant que
la demande existe (voir §9).

---

## 2. L'application fonctionne en DEUX modes

C'est la clé de toute la structure. Les catégories ne se comportent pas de la même façon :

### Mode A — Marché de biens
Pro et particulier **coexistent** et se concurrencent.
Exemples : téléphones, électronique légère, mode, montres, voiture, immobilier, électroménager.
Quand on cherche « iPhone 15 », les annonces de particuliers (occasion) et de pros (neuf)
se mélangent → **la recherche doit les départager** (voir §7).

### Mode B — Annuaire de services / pros
**Tout le monde est un professionnel.** Il n'y a pas de « particulier concurrent ».
Exemples : électricien, menuisier, mécanicien, soudeur, plombier, transport d'eau, etc.
Ici on ne fait **pas** des annonces jetables qui expirent : chaque pro a une
**vitrine professionnelle permanente** (voir §6.2).

| | Mode A — Biens | Mode B — Services |
|---|---|---|
| Acteurs | Pro **+** particulier | Pros uniquement |
| Objet publié | Annonce (produit) | Vitrine (profil pro) |
| Durée de vie | Expire (sauf PRO) | Permanente |
| Enjeu de la recherche | Départager pro/particulier | Trouver + proximité + confiance |

---

## 3. Structure des offres (abonnements)

Trois niveaux. **Pas plus** — l'audience est peu lectrice, la simplicité prime.
On vend des **identités** (occasionnel → vendeur → business), pas des « nombres d'annonces ».

| | **Gratuit** | **Vendeur** | **PRO / Boutique** |
|---|---|---|---|
| **Prix** ✅ | 0 F | **2 000 F / mois** | **5 000 F / mois** |
| Cible | Vend de temps en temps | Fait du volume (achat-revente) | Vrai commerce structuré |
| Mises en ligne / mois ✅ | **3** | **30** | **Illimité** |
| Durée de l'annonce ✅ | Expire à **30 j** | Expire à **30 j** | **N'expire jamais** |
| Boutique / catalogue | ❌ | ❌ | ✅ |
| Badge « Vérifié » | ❌ | ❌ | ✅ |
| Visibilité (boost recherche + carrousel) | Normale | Léger | Maximale |
| Commandes structurées | ❌ | ❌ | ✅ |
| Statistiques | ❌ | Vues de base | Complètes + ranking |

> ⚠️ Le mot **« illimité »** est réservé au PRO. Le Vendeur reste plafonné (30) pour
> préserver la valeur du palier à 5 000 F et pousser le vendeur industriel vers le PRO.

---

## 4. Mécanique des quotas & expiration

### 4.1 La métrique = le FLUX, pas le stock ✅
Le quota gratuit se compte en **nombre de mises en ligne par mois** (créations
d'annonces), **pas** en nombre d'annonces actives simultanément.

**Pourquoi c'est crucial :** un revendeur qui plafonne à « 3 annonces actives à la fois »
vend ses 3 articles en 3 jours, les slots se libèrent, il repost, et il tourne ainsi
**30 fois par mois gratuitement**. Un plafond « stock » ne le touche jamais → il ne paie
jamais. Ce qui définit le revendeur, c'est le **flux** (il poste beaucoup dans le temps).
C'est donc le flux qu'on plafonne.

- Le compteur mesure les **créations** d'annonces, remis à zéro **chaque mois**.
- Une annonce qui reste en ligne compte **une seule fois** (à sa création).
- Remettre en ligne un article vendu = **recompte**.

### 4.2 Segmentation obtenue
- **Occasionnel** (1 annonce/mois, parfois rien) → ne touche jamais le mur → reste gratuit, content.
- **Revendeur** → veut poster sa 4ᵉ annonce en 2 jours → **mur** → s'abonne.
  Le « blocage » n'est pas un bug : c'est le **déclencheur de conversion**. Quelqu'un qui
  veut poster une 4ᵉ annonce dans le mois n'est **par définition plus** un occasionnel.

### 4.3 Expiration ✅
- **Gratuit** : l'annonce disparaît à **30 jours**.
- **Vendeur** : l'annonce disparaît à **30 jours**.
- **PRO** : l'annonce **n'expire jamais** — permanente.

La **permanence** est un des moats les plus forts du PRO : le particulier et le vendeur
doivent re-poster sans cesse (et re-consommer leur quota) ; le PRO reste **toujours là**,
sa boutique existe même quand il dort.

---

## 5. Paiement à l'annonce — l'alternative-ancrage ✅

Au-delà de son quota gratuit, l'utilisateur a **deux portes** :
1. **Prendre un abonnement** (Vendeur ou PRO), ou
2. **Payer l'annonce à l'unité**, au **tarif par catégorie** déjà défini
   (ex. voiture ≈ 5 000 F, immobilier ≈ X, etc.).

Ce paiement à l'unité joue **trois rôles** :

1. **Ancrage psychologique.** Si une seule annonce voiture coûte 5 000 F et que le PRO
   coûte 5 000 F/mois pour l'illimité → l'abonnement devient **évident**. Le prix à
   l'unité existe surtout pour faire briller l'abonnement.
2. **Capture le vendeur cher et occasionnel.** Celui qui vend UNE voiture par an ne
   s'abonnera jamais, mais son annonce vaut cher → le paiement à l'unité récupère ses 5 000 F.
3. **Capture le têtu.** Celui qui refuse par principe tout abonnement paie quand même à l'acte.

### Pas d'exception de catégorie pour le quota gratuit ✅
Les catégories chères (voiture, immobilier) **restent incluses** dans les 3 annonces
gratuites, comme tout le monde. Raison : dans la voiture, la **méfiance envers le
particulier est maximale** — l'acheteur veut un vendeur qui a l'air pro. Offrir 3 annonces
auto gratuites ne coûte pas de l'argent, ça **fabrique un candidat PRO**. Le tirage vers
l'abonnement y est encore plus fort qu'ailleurs. On garde donc la règle unique, zéro exception.

---

## 6. L'expérience PRO en détail

### 6.1 PRO — Mode A (biens)
Ce qu'on vend n'est **pas** « un petit catalogue » ni « 50 publications ». C'est :
**permanence + confiance + surface.** Un occasionnel poste une annonce qui disparaît ;
le PRO **est une boutique permanente, trouvable et vérifiée**, qui travaille 24/7.

Fonctionnalités :
- **Boutique / catalogue** structuré (rayons, produits) — *déjà codé (v2)*.
- **Badge « Vérifié »** — signal de confiance, filtrable par l'acheteur.
- **Annonces permanentes** (n'expirent jamais).
- **Boost de visibilité** : carrousel Boutiques + bonus léger en recherche — *déjà codé*.
- **Commandes structurées** (statuts, notifications) — *déjà codé (v2)*.
- **Statistiques** complètes (vues, contacts) + ranking.
- **Push de preuve hebdo** au vendeur — *déjà codé*.

### 6.2 PRO — Mode B (services) — la vitrine professionnelle
Pour un menuisier, un mécanicien, un soudeur, une boutique dédiée : **aucun sens** de
faire des annonces jetables. Chaque pro — **même un auto-entrepreneur seul** — doit avoir
une **vitrine professionnelle permanente** contenant :
- **Bannière** + nom / logo
- **Description** du service
- **Tarifs**
- **Horaires**
- **Numéro(s) de contact**
- **Portfolio** (photos de réalisations)
- **Badge « Vérifié »** + **avis** clients

Quand quelqu'un cherche « soudeur », l'algorithme comprend qu'il est en catégorie service
et **ne montre que des pros**, triés par pertinence et proximité (voir §7).

> **Pourquoi les services = la rente PRO la plus propre :** il n'y a personne pour
> sous-coter le pro avec du gratuit. 100 % des participants sérieux sont des candidats
> abonnement. Le modèle par défaut des services est donc le **profil PRO permanent**
> (au mieux une version gratuite minimale juste pour exister — voir §9).

---

## 7. La recherche — le nerf de la guerre

Sur les petites annonces, l'acheteur arrive avec une **intention** et va **droit à la
barre de recherche**. C'est là (et non sur l'accueil) que tout se joue.

### 7.1 Règle d'or : la pertinence est un mur, pas une variable ✅
On n'affiche **que** ce qui correspond vraiment à la requête. Une annonce PRO hors-sujet
ne remonte **jamais**. Le bonus PRO travaille **à l'intérieur** des résultats pertinents,
jamais au-dessus de la pertinence. Si l'acheteur voit du bruit en haut, il fuit.

### 7.2 Ordre des résultats (mode A — biens)
1. **1 à 2 emplacements « Sponsorisé / PRO »** en tête, **clairement étiquetés**, et
   seulement s'ils matchent la requête.
2. Puis tri par défaut = mélange **fraîcheur + proximité + léger bonus PRO**.
3. **L'acheteur reprend la main** : tri explicite « prix croissant », « plus proche »,
   « plus récent ». Dès qu'il choisit un tri, **le bonus PRO s'efface** — on respecte son choix.

### 7.3 Filtres (visuels, peu nombreux) ✅
- **Prix** (fourchette)
- **Localisation / « près de moi »** — signal de premier rang (contexte livraison/coursier)
- **Sous-catégorie**
- **État** : neuf / occasion
- **« Professionnel uniquement »** — voir ci-dessous

> Pertinence + localisation + sous-catégorie + état **priment** sur le bonus PRO.

### 7.4 Le filtre « Professionnel uniquement » ✅ — double coup gagnant
- **Pour l'acheteur** : « je veux un téléphone **neuf**, pas d'occasion » → il coche Pro,
  il ne voit que les boutiques. Intention réelle et fréquente.
- **Pour le PRO** : une surface **où le particulier n'existe plus**, sans casser la
  pertinence pour les autres.
- En **mode B (services)**, ce filtre est quasiment l'**état par défaut** de la recherche.

### 7.5 Accessibilité — public peu lecteur 🟡
Taper « manette PS5 » est déjà une barrière pour une partie des utilisateurs. Prévoir :
- **Recherche vocale** (parler au lieu de taper)
- **Tuiles catégories visuelles** comme portes d'entrée à côté de la barre

Potentiellement le différenciateur d'usage n°1 sur ce marché. Priorité à trancher (§11).

---

## 8. La page d'accueil (secondaire — pour les flâneurs)

L'accueil est **moins fondamental que la recherche** (les acheteurs à intention vont direct
chercher). Il sert les **flâneurs** / chercheurs d'opportunités.

**Piège mortel à éviter : le feed « qui paie est en haut ».** Un mur de pub tue la confiance
de l'acheteur. **Le feed sert l'acheteur d'abord ; la monétisation roule par-dessus, à dose bornée.**

- **Feed principal = tri par fraîcheur.** L'annonce fraîchement postée/renouvelée remonte.
  C'est juste : même le gratuit passe en haut au moment où il poste, puis redescend. C'est
  ce qui garde les vendeurs gratuits en vie.
- **Boutiques PRO en rotation** : carrousel de boutiques mises en avant, en **rotation**
  (pas toujours les mêmes → justice).
- **Emplacements « en avant » à positions fixes**, clairement identifiés, **dose bornée**
  (démarrer à ~**1 sponsorisé pour 5 organiques**, augmenter seulement si la confiance tient).
- **« Remonter en tête »** : le gratuit remonte quand il crée ; le Vendeur/PRO peut faire
  remonter ses annonces → c'est la différence de visibilité **ressentie** qui justifie
  l'abonnement à l'œil nu.

---

## 9. Go-to-market / amorçage (le piège du cold-start)

Le problème réel : **un pro qui vient de télécharger ne paiera pas un abonnement à froid**
— il n'a pas de preuve que ça vaut la peine. Et c'est le piège classique du deux-côtés :

> Un pro paie quand il reçoit des contacts → les contacts viennent des acheteurs →
> les acheteurs viennent si l'annuaire est **déjà rempli**. Paywall au jour 1 = annuaire
> vide = acheteurs qui repartent = **spirale de la mort**.

### Stratégie recommandée : vendre « la vitrine gratuite », faire GAGNER l'abonnement
1. **Phase lancement** : la vitrine pro (surtout services) est **gratuite pour tous** →
   on peuple l'annuaire, on donne une raison à l'acheteur de venir. Aucune barrière à l'entrée.
2. **Hameçon payant** — ce que le pro paie **une fois qu'il voit déjà des contacts arriver** :
   - **Badge « Vérifié »** (la confiance = tout dans les services)
   - **Boost** en recherche
   - **Photos / portfolio**
   - **Statistiques**
3. **Conversion à la preuve, pas au temps** 🟡 : plutôt qu'un essai « 30 jours » (pendant
   lesquels il n'y a pas encore d'acheteurs → pas de preuve → churn), préférer
   **« gratuit jusqu'aux premiers contacts, puis abonnement »**. Le pro ne paie qu'une
   fois que ça a **déjà** marché → l'objection « je ne sais pas si ça vaut la peine » disparaît.
4. **Statut « Pro fondateur »** pour les premiers inscrits (gratuit / tarif réduit à vie
   ou 6 mois offerts) → remplit l'annuaire vite et crée les premiers ambassadeurs.

---

## 10. Récapitulatif des prix ✅

| Offre | Prix | Quota mises en ligne | Expiration |
|---|---|---|---|
| Acheteur | **0 F à vie** | — | — |
| Vendeur gratuit | 0 F | 3 / mois | 30 jours |
| Vendeur | **2 000 F / mois** | 30 / mois | 30 jours |
| PRO / Boutique | **5 000 F / mois** | Illimité | Jamais |
| Annonce à l'unité | Tarif par catégorie (ex. voiture ≈ 5 000 F) | — | 30 jours |

---

## 11. Décisions encore ouvertes (à trancher)

| # | Décision | Piste recommandée |
|---|---|---|
| 1 | **Dosage du bonus PRO** dans le tri par défaut de la recherche | Léger : ressenti par le PRO, pas subi par l'acheteur |
| 2 | **Modèle des catégories services** : profil PRO permanent par défaut (vs annonces jetables) | Profil PRO permanent + version gratuite minimale pour exister |
| 3 | **Mécanique de conversion** des pros au lancement | « Gratuit jusqu'aux premiers contacts » (preuve) + Pro fondateur |
| 4 | **Recherche vocale + tuiles visuelles** : priorité de développement ? | Fort candidat n°1 pour l'usage (public peu lecteur) |
| 5 | **Tarifs par catégorie** du paiement à l'unité (grille exacte) | À caler selon le pouvoir d'achat observé |
| 6 | **Dose exacte** sponsorisé/organique sur l'accueil | Démarrer 1 pour 5, ajuster selon la confiance |

---

*Document issu du brainstorming produit. Les points ✅ sont validés ; les points 🟡
restent à décider avant exécution.*
