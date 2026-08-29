# Flash Market

> La marketplace mobile pensée pour acheter, vendre et trouver des professionnels au Mali.

Flash Market met en relation particuliers, vendeurs et professionnels dans une expérience simple, rapide et adaptée aux usages locaux. L'application permet de publier des annonces, découvrir des produits et services à proximité, échanger avec les vendeurs et gérer une véritable vitrine professionnelle.

L'interface est en français, les prix sont affichés en FCFA et les échanges peuvent se poursuivre directement dans l'application ou via les coordonnées du vendeur.

## Fonctionnalités

### Pour les acheteurs

- Parcours d'annonces par catégorie et sous-catégorie
- Recherche et filtres par prix, état, localisation et type de vendeur
- Tri par proximité grâce à la géolocalisation
- Fiches détaillées avec photos, prix et informations vendeur
- Favoris pour retrouver facilement une annonce
- Messagerie en temps réel
- Découverte des boutiques et professionnels
- Demandes de devis pour les prestations de services
- Avis et signalement de contenus

### Pour les vendeurs et professionnels

- Publication et modification d'annonces
- Gestion des annonces depuis un espace personnel
- Profil public avec photo, biographie et réseaux sociaux
- Boutique professionnelle avec catalogue de produits
- Vitrine de services, portfolio, disponibilités et tarifs
- Gestion des commandes et demandes clients
- Statistiques de visibilité et de contacts
- Notifications transactionnelles et push
- Programme de parrainage

### Plateforme

- Connexion par e-mail, téléphone, Google ou Apple
- Données synchronisées en temps réel
- Stockage sécurisé des images
- Politiques PostgreSQL RLS pour isoler les données privées
- Outils de modération et d'administration
- Pages publiques de présentation, support et informations légales

## Stack technique

| Domaine | Technologies |
| --- | --- |
| Application mobile | React Native, Expo, TypeScript |
| Navigation | React Navigation |
| Backend | Supabase, PostgreSQL |
| Authentification | Supabase Auth, Google Sign-In, Apple Sign-In |
| Temps réel | Supabase Realtime |
| Stockage | Supabase Storage |
| Notifications | Expo Notifications, Expo Push API, `pg_net` |
| Géolocalisation | Expo Location |
| Déploiement mobile | EAS Build et EAS Update |
| Administration | HTML, CSS et JavaScript |

## Structure du dépôt

```text
dev_3/
├── app/                  # Application mobile Expo / React Native
│   ├── assets/           # Icônes, splash screen et ressources visuelles
│   ├── scripts/          # Contrôles de configuration
│   └── src/
│       ├── components/   # Composants réutilisables
│       ├── contexts/     # Session et état global
│       ├── hooks/        # Accès aux données et logique métier
│       ├── navigation/   # Navigation principale
│       ├── screens/      # Écrans de l'application
│       └── lib/          # Clients et utilitaires
├── admin/                # Interface d'administration
├── supabase/             # Schéma, fonctions, migrations et diagnostics SQL
├── web/                  # Site public et pages légales
├── marketing/            # Ressources marketing
├── store-assets/         # Ressources destinées aux stores
└── docs/                 # Documentation produit et technique
```

## Installation locale

### Prérequis

- Node.js et npm
- Expo CLI via `npx`
- Un projet Supabase configuré
- Un appareil physique ou un émulateur Android/iOS

### 1. Cloner le dépôt

```bash
git clone https://github.com/mohamedLamine949/dev_3.git
cd dev_3/app
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Créez `app/.env` avec les variables suivantes :

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anonyme
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=votre_client_web_google
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=votre_client_ios_google
```

Vérifiez ensuite la configuration :

```bash
npm run verifier-config
```

Ne versionnez jamais les fichiers `.env` ni les clés privées.

### 4. Lancer l'application

```bash
npx expo start
```

Raccourcis disponibles :

```bash
npm run android
npm run ios
npm run web
```

## Base de données

Le dossier `supabase/` contient le schéma PostgreSQL, les politiques RLS, les fonctions, les triggers et les scripts historiques du projet. Les nouvelles migrations versionnées se trouvent dans `supabase/migrations/`.

Pour lier une instance Supabase puis appliquer les migrations :

```bash
npx supabase link --project-ref votre_project_ref
npx supabase db push
```

Examinez toujours l'aperçu avant un déploiement en production :

```bash
npx supabase db push --dry-run
```

## Vérifications avant publication

Depuis le dossier `app/` :

```bash
npm run verifier-config
npx tsc --noEmit
```

Pour une publication EAS, utilisez l'environnement approprié afin que les variables soient injectées depuis EAS :

```bash
npx eas-cli update --environment production
```

## Principes produit

- L'accès reste gratuit pour les acheteurs.
- Les annonces pertinentes priment toujours sur la promotion payante.
- Les vendeurs professionnels disposent d'une présence durable et identifiable.
- La proximité, la confiance et la simplicité guident l'expérience.
- Les données privées sont protégées côté serveur, pas uniquement dans l'interface.

La stratégie produit détaillée est documentée dans [`BUSINESS_MODEL.md`](BUSINESS_MODEL.md).

## Auteurs

- Sidi Oumar GANO — [@sdiprograms11](https://github.com/sdiprograms11)
- Mohamed Lamine — [@mohamedLamine949](https://github.com/mohamedLamine949)

---

<p align="center">
  Flash Market — conçu avec soin pour le Mali 🇲🇱
</p>
