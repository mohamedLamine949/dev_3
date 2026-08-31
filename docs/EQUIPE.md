# Travailler à plusieurs sur Flash Market

> Comment donner à quelqu'un le droit de publier, et ce qu'il doit savoir
> avant de le faire. À lire entièrement une fois — publier touche tous les
> utilisateurs en quelques secondes.

---

## 1. Le compte Expo

Depuis le 21 août 2026, **`mohamedlamine_404` est une organisation**, pas un
compte personnel. Le compte personnel du propriétaire s'appelle désormais
`@mohamedlamine_404-2`.

Le projet est rattaché à l'organisation : `app/app.json` contient déjà
`"owner": "mohamedlamine_404"`. **Ne pas y toucher** — c'est ce qui relie le
dépôt au bon compte EAS.

### Ajouter un membre

Depuis le tableau de bord Expo, en étant connecté avec le compte propriétaire :

1. ouvrir **expo.dev → organisation `mohamedlamine_404` → Members** ;
2. **Invite member**, avec l'adresse e-mail de la personne ;
3. choisir le rôle :

| Rôle | Peut publier une mise à jour | Peut lancer un build | Peut gérer membres et facturation |
|---|---|---|---|
| Viewer | non | non | non |
| **Developer** | **oui** | **oui** | non |
| Admin | oui | oui | oui |
| Owner | oui | oui | oui, et supprimer l'organisation |

**Developer suffit** pour travailler sur le projet. Ne donner Admin que si la
personne doit aussi gérer les accès ou la facturation.

L'invité accepte l'invitation, puis se connecte en ligne de commande avec
**son propre compte** :

```bash
npx eas-cli login
```

Il ne partage jamais le mot de passe du propriétaire. Chaque action publiée
reste attribuée à son auteur, ce qui permet de savoir qui a envoyé quoi.

---

## 2. Installer le projet

```bash
git clone https://github.com/mohamedLamine949/dev_3.git
```

```bash
cd "dev_3/app" && npm install
```

### La configuration : rien à demander à personne

Les valeurs de configuration vivent **sur EAS**, par environnement. Il n'y a
donc rien à réclamer ni à recopier après le clone.

Pour **publier**, il suffit d'ajouter `--environment` à la commande (voir §3) :
les valeurs sont récupérées automatiquement.

Pour **développer en local** avec `npx expo start`, récupérer une fois le
fichier :

```bash
npx eas-cli env:pull --environment development
```

Il crée `app/.env`, qui n'est pas versionné et n'a pas à l'être.

> **Le piège que ce dispositif ferme.** Avant, publier sans fichier `.env` ne
> provoquait aucune erreur : la commande réussissait, la mise à jour partait,
> et tous les utilisateurs recevaient une application incapable de joindre le
> serveur. Aucun message, juste des écrans qui ne chargent jamais. C'est pour
> cela que `--environment` n'est pas facultatif dans les commandes ci-dessous,
> et qu'un contrôle refuse de publier si quelque chose manque.

---

## 3. Publier une mise à jour

### Toujours, dans cet ordre

```bash
npm run verifier-config
```

S'il refuse, **s'arrêter là** : la configuration est incomplète.

```bash
npx tsc --noEmit -p tsconfig.json
```

Puis vérifier qu'aucune dépendance native n'a été ajoutée depuis le dernier
build installé :

```bash
git diff 31288b3 -- app/package.json
```

Toute ligne ajoutée qui correspond à un module natif **interdit la
publication par mise à jour** : elle exige un build. Voir
[EXPLOITATION.md](EXPLOITATION.md) §4 bis.

### Publier

Sur les **deux** canaux, jamais un seul — des testeurs utilisent l'APK interne
et resteraient en arrière :

```bash
npx eas-cli update --branch production --environment production --platform all --message "ce qui change"
```

```bash
npx eas-cli update --branch preview --environment preview --platform all --message "ce qui change"
```

`--environment` n'est pas décoratif : sans lui, la commande retombe sur le
fichier local, et s'il est absent elle publie un bundle sans configuration.

L'application applique la mise à jour au lancement suivant. Compter quelques
secondes après avoir fermé et rouvert.

---

## 4. Trois choses à ne jamais faire sans demander

**Ne pas lancer `eas build`.** Un build produit une version pour les stores et
consomme du quota. Il ne se lance que sur demande explicite du propriétaire.

**Ne pas modifier `version` dans `app.json`.** Le numéro de version détermine
le *runtime* visé par les mises à jour. Le changer sans faire le build
correspondant fait viser un runtime qu'aucun téléphone ne possède : la mise à
jour part sans erreur et n'atteint personne.

**Ne pas lancer `npx expo install --fix` avant une mise à jour.** L'opération
est saine avant un build, mais une mise à jour n'emporte que le JavaScript :
la partie native reste celle du build installé. On enverrait alors du code
plus récent que le natif qui l'exécute — et si cela touche `expo-updates`,
plus aucune correction ne peut passer à distance.

---

## 5. La base de données

Les migrations SQL vivent dans `supabase/`. Elles ne s'appliquent pas toutes
seules : quelqu'un les colle dans l'éditeur SQL du tableau de bord Supabase.

**Une migration s'exécute par le propriétaire du projet**, pas par un
contributeur, et jamais sans avoir lu le fichier en entier. Chacune se termine
par ses propres requêtes de vérification et porte son script de retour arrière
en commentaire.

Quand une fonctionnalité a besoin d'une migration, le code doit continuer de
fonctionner **sans elle**, en mode dégradé. C'est la règle suivie partout dans
ce projet : une colonne absente ne doit jamais casser un écran.

---

## 6. En cas de doute

Tout ce qui concerne l'annulation d'une publication, la surveillance des
tâches planifiées, les incidents de paiement et les décisions produit à ne pas
contourner est dans [EXPLOITATION.md](EXPLOITATION.md).
