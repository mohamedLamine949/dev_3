# Spécifications Techniques et Architecture

## 1. Choix Technologiques (Tech Stack) recommandés

Pour assurer un développement rapide (Time-to-Market court), une réactivité optimale et des coûts d'infrastructure mesurés, nous recommandons une architecture moderne orientée **Serverless et BaaS (Backend as a Service)**.

### A. L'Application (100% Mobile)
L'application étant exclusivement mobile (pas de version Web), nous recommandons :
- **Framework** : **React Native** (avec **Expo**).
  - *Pourquoi ?* Permet de développer une application native (iOS et Android) à partir d'un même code source, avec des excellentes performances. Très adapté pour accéder aux composants natifs du téléphone (caméra, galerie, notifications).
- **Stylisation** : **NativeWind** (Tailwind pour React Native) ou **StyleSheet** natif.
  - *Pourquoi ?* Permet de créer une interface fluide et familière sur smartphone.
- **Déploiement** : Publication sur **Google Play Store** et **Apple App Store**.

### B. Le Backend & Base de Données (BaaS)
- **Solution recommandée** : **Supabase** (Alternative open-source à Firebase).
  - **Base de données** : PostgreSQL. Il sera crucial d'assurer une **base de données hautement performante** (via l'optimisation des requêtes, l'ajout d'Index sur les champs de recherche et filtrages).
  - **Authentification** : Gestion native des inscriptions (idéalement via SMS OTP pour une friction minimale sur mobile).
  - **Stockage (Storage)** : Stockage et optimisation des images compressées déposées par les vendeurs.
  - **Temps Réel (Realtime)** : Supabase gère le WebSocket nativement et permet une messagerie fluide et instantanée en temps réel.

### C. Passages de Paiement (Mobile Money)
La monétisation reposant sur le paiement direct lors du dépôt d'annonce, l'intégration du paiement mobile est vitale.
- **Options recommandées** : Soit l'intégration directe de l'**API Orange Money**, soit le passage par un des agrégateurs locaux comme **FedaPay**, **CinetPay**, ou **PayDunya**.
- *Fonctionnement* : L'application mobile déclenche la demande de paiement. Dès validation (via un webhook de confirmation reçu par le serveur backend), l'annonce bascule automatiquement au statut "active" et est publiée.

## 2. Modèle de Données Simplifié (Tables)

**1. `users`**
- id (UUID)
- num_telephone (ou email)
- prenom / nom
- date_creation

**2. `annonces`**
- id (UUID), user_id (FK)
- titre (ex: "iPhone 13 Pro Max")
- description
- prix
- etat (actif, en_attente, vendu)
- est_payee (Boolean)
- id_transaction_paiement
- date_creation

**3. `images_annonce`**
- id, annonce_id (FK), image_url

**4. `conversations` & `messages`**
- *conversations* : id, acheteur_id, vendeur_id, annonce_id
- *messages* : id, conversation_id, expediteur_id, contenu (Texte), date_envoi

## 3. Sécurité et Performances
- **Images** : Compresser obligatoirement les images côté client (sur le téléphone du vendeur) *avant* l'envoi au serveur pour économiser la bande passante et les coûts de stockage.
- **Pagination** : Implémenter le chargement infini (Infinite Scroll) sur la page d'accueil pour naviguer fluidement de 20 annonces en 20 annonces.
- **Architecture 100% Mobile** : Aucune application web n'étant prévue, l'ergonomie, les gestes (swipe to refresh, retour arrière) et les limitations (mémoire du smartphone, permissions, stockage local) doivent être parfaitement gérés comme une application pure iOS/Android.
