# Suivi publicitaire Meta et TikTok — préparation

Objectif : que Facebook, Instagram et TikTok sachent **qui installe l'application et qui publie une
annonce après avoir vu une publicité**. Sans ça, les plateformes optimisent sur des clics ; avec,
elles vont chercher des gens qui ressemblent à ceux qui publient — c'est ce qui fait baisser le coût
par utilisateur quand le budget augmente.

Ce suivi demande du **code natif** : il arrivera avec le prochain `eas build` (App Store + Play
Console), pas par mise à jour OTA. Rien n'est installé tant que les identifiants ci-dessous
n'existent pas : ajouter le SDK sans eux ferait échouer le build.

---

## Étape 1 — Créer les comptes (à faire par le fondateur)

### Meta (Facebook + Instagram)
1. **Page Facebook** Flash Market (si elle n'existe pas) et **compte Instagram professionnel**
   relié à la page.
2. **Meta Business Suite / Business Manager** : [business.facebook.com](https://business.facebook.com)
   → créer le portefeuille « Flash Market ».
3. Dans le Business Manager : **créer un compte publicitaire**, devise **EUR** (paiement par carte
   européenne), fuseau horaire **GMT** (Bamako).
4. **Enregistrer l'application** : [developers.facebook.com](https://developers.facebook.com) →
   Créer une app → type « Autre » / « Entreprise » → la rattacher au Business Manager.
   Ajouter les plateformes :
   - iOS : bundle `com.chapchap.flashmarket` et l'ID App Store
     `6784725073` ;
   - Android : package `com.chapchap.flashmarket`.
5. Me transmettre : **App ID** et **Client Token** (Paramètres › Général et Paramètres › Avancé).
   Ce ne sont pas des secrets au sens strict (ils sont embarqués dans l'application), mais ne les
   publiez pas.

### TikTok
1. **TikTok Business Center** : [business.tiktok.com](https://business.tiktok.com).
2. **TikTok Ads Manager** : [ads.tiktok.com](https://ads.tiktok.com) → créer un compte
   publicitaire. Vérifier à la création **quels pays sont ciblables** (Mali, Côte d'Ivoire,
   Sénégal) : si le Mali n'y est pas, les campagnes Mali continuent via « Promouvoir » dans
   l'application TikTok.
3. Dans Ads Manager › Outils › **Événements** › Application : ajouter l'application (App Store +
   Play Store). Me transmettre l'**App ID TikTok** et la clé fournie.

---

## Étape 2 — Ce que j'ajouterai dans l'application (prochain build)

| Brique | Rôle |
|---|---|
| `react-native-fbsdk-next` (plugin Expo) | SDK Meta : installations et événements vers Facebook/Instagram Ads |
| `expo-tracking-transparency` | Fenêtre iOS obligatoire « Autoriser le suivi ? » avant toute mesure publicitaire sur iPhone |
| SDK TikTok | Pas de SDK officiel React Native : soit un module natif léger, soit un outil d'attribution (AppsFlyer, Adjust) qui envoie aux deux plateformes. Choix à trancher quand les comptes existent. |

Événements envoyés (les mêmes aux deux plateformes) :

| Événement | Quand | Pourquoi |
|---|---|---|
| Installation | automatique | coût par installation |
| Inscription (`CompleteRegistration`) | compte créé | coût par inscrit |
| **Première annonce publiée** | 1re annonce en ligne | **l'événement sur lequel optimiser** : un inscrit qui publie vaut beaucoup plus qu'un inscrit |
| Achat (`Purchase`, avec le montant) | boost ou accès payé | retour sur dépense publicitaire |

Chaque appel sera protégé : si le module natif est absent (vieille version installée recevant un
OTA), l'application n'appelle rien et ne plante pas — même principe que `components/Gradient.tsx`.

---

## Étape 3 — Stores (au moment du build)

- **App Store Connect › Confidentialité de l'app** : déclarer « Identifiants (identifiant
  publicitaire) — utilisé pour le suivi » et « Données d'utilisation ».
- **Texte de la fenêtre iOS** (`NSUserTrackingUsageDescription`) : « Votre accord nous aide à
  montrer Flash Market aux personnes près de chez vous, sans rien changer à l'application. »
- **Play Console › Sécurité des données** : déclarer l'identifiant publicitaire et le partage avec
  Meta / TikTok à des fins publicitaires.
- **Politique de confidentialité** (`web/confidentialite.html`) : ajouter un paragraphe sur les
  outils de mesure publicitaire Meta et TikTok.

---

## En attendant : ce qui mesure déjà

- **« Comment avez-vous connu Flash Market ? »** : posée une fois sur l'accueil de chaque
  utilisateur ; résultats par canal dans la console admin (Statistiques › D'où viennent les
  utilisateurs), avec la part de chaque canal qui **publie** vraiment.
- **Codes de parrainage** : chaque filleul est rattaché à son parrain.
