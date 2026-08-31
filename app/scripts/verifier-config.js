/**
 * Contrôle à passer AVANT toute publication (`eas update` ou `eas build`).
 *
 * Depuis le 21 août 2026, les valeurs de configuration vivent AUSSI sur EAS,
 * par environnement. Une publication faite avec `--environment production` les
 * récupère toute seule : c'est la voie normale, et elle ne dépend d'aucun
 * fichier local.
 *
 * Ce script reste utile pour deux cas :
 *   - `npx expo start` en développement, qui lit encore `app/.env` ;
 *   - une publication lancée SANS `--environment`, qui retomberait sur le
 *     fichier local et produirait un bundle à l'adresse de serveur vide.
 *     L'application ne joindrait plus rien, pour tous les utilisateurs, et la
 *     commande n'afficherait aucune erreur — c'est cette panne silencieuse que
 *     le script transforme en refus immédiat.
 *
 * Pour vérifier ce que voit EAS plutôt que le disque :
 *   npx eas-cli env:exec production "node scripts/verifier-config.js"
 */
const fs = require('fs');
const path = require('path');

const REQUISES = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
];

function lireEnv(fichier) {
  const chemin = path.join(__dirname, '..', fichier);
  if (!fs.existsSync(chemin)) return {};
  const valeurs = {};
  for (const ligne of fs.readFileSync(chemin, 'utf8').split('\n')) {
    const nette = ligne.trim();
    if (!nette || nette.startsWith('#')) continue;
    const index = nette.indexOf('=');
    if (index === -1) continue;
    valeurs[nette.slice(0, index).trim()] = nette.slice(index + 1).trim();
  }
  return valeurs;
}

// Même ordre de priorité qu'Expo : .env.local écrase .env, et les variables
// déjà présentes dans l'environnement (donc celles injectées par EAS) priment.
const env = { ...lireEnv('.env'), ...lireEnv('.env.local'), ...process.env };
const manquantes = REQUISES.filter((cle) => !env[cle]);

if (manquantes.length > 0) {
  const aide = [
    '',
    '  ✖  CONFIGURATION INCOMPLÈTE — ne publiez pas.',
    '',
    ...manquantes.map((cle) => `     manquante : ${cle}`),
    '',
    '  Aucune valeur trouvée. Deux solutions :',
    '',
    '  - Pour PUBLIER : ajoutez  --environment production  (ou preview) à la',
    "    commande eas update. Les valeurs viennent alors d'EAS et aucun",
    "    fichier local n'est nécessaire. C'est la voie recommandée.",
    '',
    '  - Pour DÉVELOPPER en local : créez app/.env, ou récupérez les valeurs',
    '    avec  npx eas-cli env:pull --environment development',
    '',
    '  Publier sans --environment ET sans fichier local enverrait à TOUS les',
    '  utilisateurs un bundle incapable de joindre le serveur, sans aucun',
    "  message d'erreur.",
    '',
  ];
  console.error(aide.join('\n'));
  process.exit(1);
}

console.log('\n  ✔  Configuration complète — publication possible.\n');
