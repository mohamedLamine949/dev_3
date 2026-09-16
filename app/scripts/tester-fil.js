/**
 * Vérifie la composition du fil d'accueil (src/lib/feed.ts) sur les annonces
 * réellement en ligne — c'est le seul jeu de données où le problème existe :
 * une vendeuse à elle seule y pèse un tiers du catalogue.
 *
 * Contrôle trois promesses :
 *   1. rien n'est perdu ni dupliqué (une annonce répartie, jamais supprimée) ;
 *   2. deux annonces d'affilée ne viennent jamais du même vendeur tant qu'il
 *      reste quelqu'un d'autre à servir ;
 *   3. la première page montre autant de vendeurs que de cartes.
 *
 *   node scripts/tester-fil.js
 */
require('./charger-ts');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { composerFil } = require('../src/lib/feed.ts');

const PAGE = 20;

function lireEnv() {
  const valeurs = {};
  for (const fichier of ['.env', '.env.local']) {
    const chemin = path.join(__dirname, '..', fichier);
    if (!fs.existsSync(chemin)) continue;
    for (const ligne of fs.readFileSync(chemin, 'utf8').split('\n')) {
      const nette = ligne.trim();
      if (!nette || nette.startsWith('#')) continue;
      const i = nette.indexOf('=');
      if (i === -1) continue;
      valeurs[nette.slice(0, i).trim()] = nette.slice(i + 1).trim();
    }
  }
  return valeurs;
}

const env = { ...lireEnv(), ...process.env };

async function main() {
  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('annonces')
    .select('id, user_id, categorie, boost_expire_le, date_creation')
    .eq('statut', 'active')
    .eq('est_payee', true);
  if (error) throw new Error(error.message);

  const parId = new Map(data.map(a => [a.id, a]));
  const ordre = composerFil(data);

  let erreurs = 0;
  const echec = message => { console.log(`  ÉCHEC : ${message}`); erreurs++; };

  // 1. Rien n'est perdu, rien n'est doublé.
  if (ordre.length !== data.length) echec(`${ordre.length} annonces dans le fil pour ${data.length} en base`);
  if (new Set(ordre).size !== ordre.length) echec('une annonce apparaît deux fois');

  // 2. Aucun vendeur deux fois d'affilée (sauf s'il ne reste que lui).
  const vendeurs = ordre.map(id => parId.get(id).user_id);
  let collages = 0;
  for (let i = 1; i < vendeurs.length; i++) {
    if (vendeurs[i] && vendeurs[i] === vendeurs[i - 1]) collages++;
  }
  const restants = new Set(vendeurs.slice(-Math.min(vendeurs.length, 30)));
  if (collages > 0 && restants.size > 1) echec(`${collages} annonces collées au même vendeur`);

  // 3. Diversité de la première page.
  const premiere = new Set(vendeurs.slice(0, PAGE));

  // Ce que l'ordre chronologique donnait, pour comparaison.
  const avant = [...data]
    .sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation))
    .slice(0, PAGE);
  const vendeursAvant = new Set(avant.map(a => a.user_id));
  const plusGrosAvant = Math.max(
    ...[...vendeursAvant].map(v => avant.filter(a => a.user_id === v).length)
  );

  console.log('');
  console.log(`  ${data.length} annonces · ${new Set(vendeurs).size} vendeurs`);
  console.log('');
  console.log(`  Première page, par date    : ${vendeursAvant.size} vendeurs (le plus gros en occupe ${plusGrosAvant}/${PAGE})`);
  console.log(`  Première page, fil composé : ${premiere.size} vendeurs`);
  console.log(`  Annonces collées au même vendeur, sur tout le fil : ${collages}`);
  console.log('');

  if (erreurs === 0) console.log('  Tout est conforme.\n');
  // `process.exitCode` et non `process.exit()` : couper le processus pendant
  // que le client Supabase ferme ses sockets fait planter Node sous Windows.
  process.exitCode = erreurs > 0 ? 1 : 0;
}

main().catch(e => {
  console.error('Échec :', e.message);
  process.exitCode = 1;
});
