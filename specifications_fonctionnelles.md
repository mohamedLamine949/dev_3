# Spécifications Fonctionnelles et Logique Métier

## 1. Vision Globale du Projet
Le projet vise à créer une plateforme de petites annonces (type "Le Bon Coin") spécifiquement adaptée au marché malien. La plateforme se veut extrêmement simple, épurée et va à l'essentiel : mettre en relation des vendeurs et des acheteurs sans intermédiaire complexe dans la transaction finale ou la livraison.

## 2. Modèle Économique (Business Model)
Le modèle de monétisation est direct et simple :
- **Acheteurs** : Accès et utilisation 100% gratuits.
- **Vendeurs** : Le dépôt d'une annonce est **payant**. Un tarif fixe et unique est facturé au moment de la soumission de l'annonce sur la plateforme.
- **Logistique/Transaction** : La plateforme ne prend aucune commission sur les ventes et ne gère pas la livraison. La transaction finale se fait de gré à gré entre l'acheteur et le vendeur (physiquement ou via un mode convenu entre eux).

## 3. Les Parcours Utilisateurs (User Journeys)

### 3.1. Le Vendeur
1. **Connexion/Inscription** : Il s'authentifie sur la plateforme (l'utilisation d'un numéro de téléphone avec code SMS/OTP est recommandée pour une meilleure adoption).
2. **Dépôt de l'annonce** : Il renseigne les informations de son article (Photos, Titre, Catégorie, État, Prix, Description courte).
3. **Paiement** : Il paye les frais de mise en ligne via une solution de **Mobile Money** (Orange Money, Moov, etc.).
4. **Mise en ligne** : L'annonce est publiée (immédiatement ou après modération).
5. **Négociation** : Il reçoit des messages d'acheteurs intéressés via le chat interne.
6. **Vente** : Il échange ses coordonnées (Numéro, WhatsApp) avec l'acheteur pour finaliser la vente en dehors de la plateforme. Il retire ensuite son annonce.

### 3.2. L'Acheteur
1. **Exploration** : Il navigue sur le site et recherche des produits par mots-clés ou catégories (Téléphonie, Électroménager, Véhicules, etc.) sans avoir besoin de créer de compte.
2. **Prise d'intérêt** : Il consulte les détails d'une annonce.
3. **Prise de contact** : Il crée un compte (ou se connecte) pour ouvrir un canal de messagerie avec le vendeur.
4. **Finalisation** : Il s'arrange avec le vendeur (lieu de rencontre, paiement direct) et achète l'objet.

## 4. Fonctionnalités Clés Détaillées

### A. Gestion du Catalogue (Core)
- Liste des annonces triées par date (les plus récentes en premier).
- Système de recherche par mots-clés et filtres (Catégorie, Fourchette de prix).
- Pages de catégories claires et accessibles.

### B. Système de Messagerie (Chat)
- Messagerie en temps réel très basique.
- Possibilité d'envoyer du texte uniquement (suffisant pour échanger un numéro/WhatsApp).
- Notifications (par email ou SMS) lorsqu'un nouveau message est reçu.

### C. Processus de Paiement au Dépôt
- Interface connectée à un agrégateur de Mobile Money (indispensable au Mali).
- Validation automatique du paiement pour mettre l'annonce en ligne.

### D. Espace Administration (Back-office)
- Modération : Bloquer/Supprimer des annonces frauduleuses ou illégales.
- Suivi financier : Historique des paiements de dépôts d'annonces reçus.
- Gestion des utilisateurs.
