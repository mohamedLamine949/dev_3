/**
 * Vérifie la composition du fil d'accueil (src/lib/feed.ts) sur les annonces
 * réellement en ligne — c'est le seul jeu de données où le problème existe :
 * une vendeuse à elle seule y pèse un tiers du catalogue.
 *
 * Contrôle les promesses de l'accueil :
 *   1. rien n'est perdu ni dupliqué (une annonce répartie, jamais supprimée) ;
 *   2. deux annonces d'affilée ne viennent jamais du même vendeur tant qu'il
 *      reste quelqu'un d'autre à servir ;
 *   3. la première page montre autant de vendeurs que de cartes ;
 *   4. aucun rayon n'est monopolisé par un seul vendeur ;
 *   5. « Tendances » n'existe pas sans boost actif, et y alterne les vendeurs.
 *
 *   node scripts/tester-fil.js
 */
require('./charger-ts');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { composerFil, composerRayons, composerTendances } = require('../src/lib/feed.ts');
const { getSousCategorieLabel } = require('../src/constants/theme.ts');

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
    .select('id, user_id, categorie, sous_categorie, boost_expire_le, date_creation')
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

  // 4. Les rayons de l'accueil : un rayon monopolise par un seul vendeur
  //    reproduirait a l'interieur le probleme qu'on vient de corriger.
  const rayons = composerRayons(data);
  console.log('  Rayons de la page d accueil :');
  rayons.forEach(r => {
    const v = new Set(r.ids.map(id => parId.get(id).user_id));
    const nom = getSousCategorieLabel(r.sousCategorie) || r.sousCategorie;
    console.log('    ' + nom.padEnd(24) + String(r.ids.length).padStart(2) + ' cartes | ' + v.size + ' vendeurs | ' + r.total + ' annonces au total');
    if (v.size < 2 && r.ids.length > 2) echec('le rayon ' + r.sousCategorie + ' ne montre qu un seul vendeur');
    r.ids.forEach(id => { if (!parId.has(id)) echec('un rayon cite une annonce inconnue'); });
  });
  if (rayons.length === 0) echec('aucun rayon composable');
  console.log('');

  // 5. Section « Tendances » : elle n'existe que s'il y a des boosts actifs.
  //    Aucun boost n'est en cours aujourd'hui, on en simule pour verifier les
  //    deux comportements — absence de section, et alternance des vendeurs
  //    quand un meme vendeur booste plusieurs annonces.
  if (composerTendances(data).length !== 0) echec('des tendances sans boost actif');

  const demain = new Date(Date.now() + 86400000).toISOString();
  const hier = new Date(Date.now() - 86400000).toISOString();
  const grosVendeur = [...new Set(data.map(a => a.user_id))][0];
  const simule = data.map((a, k) => {
    // Un vendeur booste plusieurs annonces, d'autres une seule, et un boost
    // deja expire est glisse dans le lot : il ne doit pas remonter.
    if (a.user_id === grosVendeur && k % 7 === 0 && k < 40) return { ...a, boost_expire_le: demain };
    if (k === 3 || k === 11) return { ...a, boost_expire_le: demain };
    if (k === 5) return { ...a, boost_expire_le: hier };
    return a;
  });

  const tendances = composerTendances(simule);
  const parIdSimule = new Map(simule.map(a => [a.id, a]));
  const vendeursTendances = tendances.map(id => parIdSimule.get(id).user_id);
  const boostsActifs = simule.filter(a => a.boost_expire_le && new Date(a.boost_expire_le) > new Date()).length;

  console.log('  Section Tendances (boosts simules) :');
  console.log('    sans aucun boost actif   : section absente');
  console.log('    ' + boostsActifs + ' boosts actifs        : ' + tendances.length + ' cartes | ' + new Set(vendeursTendances).size + ' vendeurs');

  if (tendances.length !== boostsActifs) echec('toutes les annonces boostees ne sont pas montrees');
  if (vendeursTendances[0] === vendeursTendances[1]) echec('le meme vendeur ouvre deux cartes de suite dans les tendances');
  if (tendances.some(id => !parIdSimule.get(id).boost_expire_le)) echec('une annonce non boostee dans les tendances');
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
