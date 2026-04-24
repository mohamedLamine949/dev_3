# ⚡ Chap Chap 🇲🇱

> **La plateforme de petites annonces 100% mobile, conçue pour le Mali.**

Chap Chap permet aux Maliens d'acheter et de vendre facilement depuis leur smartphone. Pas de site web, pas de complexité — juste une application rapide, intuitive et adaptée aux réalités locales (paiement par **Mobile Money**, interface en français, monnaie **FCFA**).

---

## 📱 Nouveautés (Avril 2024)

Cette version marque la transition complète vers une architecture **Supabase-native** ultra-performante :
- **Authentification locale** : Migration réussie de Clerk vers **Supabase Auth** (support Téléphone + Email).
- **Profil complet** : Personnalisation du profil (photo, bio) et liens vers réseaux sociaux (WhatsApp, Instagram, TikTok, Facebook).
- **Chat temps réel** : Système de messagerie instantanée intégré avec Supabase Realtime.
- **Gestion des favoris** : Possibilité de sauvegarder des annonces pour plus tard.
- **Sécurité renforcée** : Mise en place de politiques de sécurité (RLS) pour protéger les données utilisateurs.

---

## 🏗️ Architecture technique

```
chap-chap/
├── supabase/
│   └── schema.sql             # Schéma complet de la base de données (Tables, RLS, Triggers)
├── app/                       # Application React Native (Expo)
│   ├── App.tsx                # Point d'entrée
│   └── src/
│       ├── contexts/AuthContext.tsx    # Gestion de session Supabase
│       ├── lib/supabase.ts            # Client Supabase configuré
│       ├── hooks/                     # Hooks personnalisés (useChat, useAnnonces, useFavoris)
│       └── screens/
│           ├── HomeScreen.tsx          # Feed d'annonces avec GPS
│           ├── PostAnnonceScreen.tsx   # Dépôt d'annonce avec upload & paiement
│           ├── ChatConversationScreen.tsx # Chat temps réel
│           └── ProfileScreen.tsx       # Profil & gestion sociale
```

---

## 🛠️ Stack technologique

| Composant | Technologie |
|-----------|------------|
| **Mobile** | React Native + Expo (TypeScript) |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| **Paiement** | Simulation Mobile Money (Orange/Moov) |
| **Stockage** | Supabase Storage (Avatars & Images d'annonces) |

---

## 🚀 Installation & Lancement

```bash
# 1. Cloner le dépôt
git clone https://github.com/mohamedLamine949/dev_3.git
cd dev_3/app

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
# Créez un fichier .env avec :
# EXPO_PUBLIC_SUPABASE_URL=votre_url
# EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_clef

# 4. Lancer l'application
npx expo start
```

---

## ⚙️ Configuration Base de Données

Toute la configuration de la base de données est centralisée dans [supabase/schema.sql](file:///c:/Users/Mohamed-Lamine/OneDrive/Bureau/dev_/chap%20chap/supabase/schema.sql). Elle inclut :
- La création des tables (`users`, `annonces`, `messages`, etc.).
- Les index de performance.
- Les triggers d'auto-création de profil.
- Les politiques de sécurité (RLS) pour isoler les données des utilisateurs.
- L'activation du mode "Realtime" pour le chat.

---

## 📋 Roadmap

- [x] Structure du projet & Design system
- [x] Migration Clerk → Supabase Auth
- [x] Profil utilisateur (Bio, Photos, Réseaux)
- [x] Chat temps réel fonctionnel
- [x] Upload d'images (Annonces & Avatars)
- [x] Gestion des favoris
- [ ] Intégration paiement Mobile Money réelle (API Orange/Moov)
- [ ] Notifications push (Expo Notifications)
- [ ] Filtrage par distance GPS
- [ ] Publication sur les stores

---

## 👨‍💻 Auteur

**Mohamed Lamine** — [@mohamedLamine949](https://github.com/mohamedLamine949)

---

<p align="center">
  Fait avec ❤️ pour le 🇲🇱
</p>
