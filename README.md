# ⚡ Chap Chap 🇲🇱

> **La plateforme de petites annonces 100% mobile, conçue pour le Mali.**

Chap Chap permet aux Maliens d'acheter et de vendre facilement depuis leur smartphone. Pas de site web, pas de complexité — juste une application rapide, intuitive et adaptée aux réalités locales (paiement par **Mobile Money**, interface en français, monnaie **FCFA**).

---

## 📱 Aperçu des écrans

| Accueil | Détail annonce | Dépôt d'annonce | Messages |
|---------|---------------|-----------------|----------|
| Feed en grille, recherche, catégories | Carrousel photos, prix, CTA contact | Formulaire complet, paiement 500 FCFA | Conversations avec badges non-lus |

---

## 🏗️ Architecture technique

```
chap-chap/
├── specifications_fonctionnelles.md   # Specs métier & parcours utilisateurs
├── specifications_techniques.md       # Choix technologiques & modèle de données
├── app/                               # Application React Native (Expo)
│   ├── App.tsx                        # Point d'entrée
│   ├── app.json                       # Configuration Expo
│   └── src/
│       ├── constants/theme.ts         # Design system (couleurs, typo, shadows)
│       ├── contexts/AuthContext.tsx    # Authentification (OTP par SMS)
│       ├── lib/supabase.ts            # Client Supabase + types TypeScript
│       ├── navigation/AppNavigator.tsx # Navigation Tabs + Stacks
│       └── screens/
│           ├── HomeScreen.tsx          # Feed d'annonces
│           ├── AnnonceDetailScreen.tsx # Détail d'une annonce
│           ├── PostAnnonceScreen.tsx   # Formulaire de dépôt
│           ├── MessagesScreen.tsx      # Liste des conversations
│           ├── ChatConversationScreen.tsx # Chat temps réel
│           ├── ProfileScreen.tsx       # Profil utilisateur
│           └── LoginScreen.tsx         # Connexion par téléphone
```

---

## 🛠️ Stack technologique

| Composant | Technologie |
|-----------|------------|
| **Mobile** | React Native + Expo (TypeScript) |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| **Paiement** | Orange Money / FedaPay / CinetPay |
| **Navigation** | React Navigation (Bottom Tabs + Native Stack) |
| **Icônes** | Ionicons + Feather Icons |

---

## 💰 Modèle économique

- **Acheteurs** → Accès 100% gratuit
- **Vendeurs** → Frais de publication fixe de **500 FCFA** par annonce (via Mobile Money)
- **Plateforme** → Aucune commission sur les ventes, aucune gestion de livraison

---

## 🚀 Installation & Lancement

### Prérequis

- [Node.js](https://nodejs.org/) (v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Application **Expo Go** sur votre téléphone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/mohamedLamine949/dev_3.git
cd dev_3/app

# Installer les dépendances
npm install

# Lancer l'application
npx expo start
```

Scannez le **QR code** affiché dans le terminal avec l'app **Expo Go** pour voir l'application sur votre téléphone.

---

## ⚙️ Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Remplacez les clés dans `app/src/lib/supabase.ts` :

```typescript
const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';
```

3. Créez les tables dans l'éditeur SQL de Supabase :

```sql
-- Utilisateurs
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_telephone TEXT UNIQUE NOT NULL,
  prenom TEXT,
  nom TEXT,
  avatar_url TEXT,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Annonces
CREATE TABLE annonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  titre TEXT NOT NULL,
  description TEXT,
  prix INTEGER NOT NULL,
  categorie TEXT NOT NULL,
  etat_article TEXT NOT NULL,
  statut TEXT DEFAULT 'en_attente',
  est_payee BOOLEAN DEFAULT FALSE,
  id_transaction_paiement TEXT,
  ville TEXT DEFAULT 'Bamako',
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Images des annonces
CREATE TABLE images_annonce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id UUID REFERENCES annonces(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  ordre INTEGER DEFAULT 0
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acheteur_id UUID REFERENCES users(id),
  vendeur_id UUID REFERENCES users(id),
  annonce_id UUID REFERENCES annonces(id),
  dernier_message TEXT,
  date_dernier_message TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  expediteur_id UUID REFERENCES users(id),
  contenu TEXT NOT NULL,
  date_envoi TIMESTAMPTZ DEFAULT NOW(),
  lu BOOLEAN DEFAULT FALSE
);

-- Index pour la performance
CREATE INDEX idx_annonces_categorie ON annonces(categorie);
CREATE INDEX idx_annonces_statut ON annonces(statut);
CREATE INDEX idx_annonces_date ON annonces(date_creation DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

---

## 🎨 Design System

| Élément | Valeur |
|---------|--------|
| **Primaire** | `#FF6B35` (Orange) |
| **Secondaire** | `#00B894` (Vert) |
| **Accent** | `#FDCB6E` (Doré) |
| **Background** | `#FAFBFD` |
| **Typographie** | System font, 8 tailles (xs → hero) |

### Catégories disponibles

📱 Téléphones · 🖥️ Électronique · 🚗 Véhicules · 🏠 Immobilier · 👕 Mode · 🛋️ Maison · 💼 Emploi · 🔧 Services · 🎮 Loisirs · 📦 Autres

---

## 📄 Documentation

- [Spécifications fonctionnelles](./specifications_fonctionnelles.md) — Modèle économique, parcours utilisateurs, fonctionnalités
- [Spécifications techniques](./specifications_techniques.md) — Stack, architecture, schéma de données

---

## 📋 Roadmap

- [x] Structure du projet & Design system
- [x] 7 écrans principaux (Accueil, Détail, Dépôt, Messages, Chat, Profil, Login)
- [x] Navigation complète (Tabs + Stacks)
- [x] Contexte d'authentification (OTP SMS)
- [ ] Connexion Supabase (données réelles)
- [ ] Upload d'images avec compression
- [ ] Chat temps réel (Supabase Realtime)
- [ ] Intégration paiement Mobile Money
- [ ] Notifications push
- [ ] Publication sur Play Store / App Store

---

## 👨‍💻 Auteur

**Mohamed Lamine** — [@mohamedLamine949](https://github.com/mohamedLamine949)

---

<p align="center">
  Fait avec ❤️ pour le 🇲🇱
</p>
