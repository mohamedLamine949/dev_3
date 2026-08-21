/**
 * Contrôle à passer AVANT toute publication (`eas update` ou `eas build`).
 *
 * Les valeurs de configuration vivent dans `app/.env`, qui n'est pas versionné.
 * Publier sans lui produit un bundle où l'adresse du serveur est vide :
 * l'application ne joint plus rien, pour tous les utilisateurs, et la
 * publication n'affiche aucune erreur. Ce script transforme cette panne
 * silencieuse en refus immédiat.
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

// Même ordre de priorité qu'Expo : .env.local écrase .env.
const env = { ...lireEnv('.env'), ...lireEnv('.env.local'), ...process.env };
const manquantes = REQUISES.filter(cle => !env[cle]);

if (manquantes.length > 0) {
  console.error('\n  ✖  CONFIGURATION INCOMPLÈTE — ne publiez pas.\n');
  manquantes.forEach(cle => console.error(`     manquante : ${cle}`));
  console.error(
    '\n  Le fichier app/.env est absent ou incomplet. Il n\'est pas dans le' +
    '\n  dépôt : demandez-le à un membre de l\'équipe, ou reprenez les valeurs' +
    '\n  du bloc "env" de app/eas.json.' +
    '\n\n  Publier en l\'état enverrait à TOUS les utilisateurs un bundle' +
    '\n  incapable de joindre le serveur, sans aucun message d\'erreur.\n'
  );
  process.exit(1);
}

console.log('\n  ✔  Configuration complète — publication possible.\n');
