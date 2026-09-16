/**
 * Garde-fou du détecteur de catégorie (src/lib/categorisation.ts).
 *
 * Chaque cas est un titre réel ou réaliste dont on connaît la bonne
 * catégorie. Le détecteur va servir à déplacer des annonces qui ne nous
 * appartiennent pas : avant d'ajouter un mot au vocabulaire, on relance ce
 * fichier pour vérifier qu'on n'a rien cassé ailleurs.
 *
 *   node scripts/tester-categorisation.js
 */
require('./charger-ts');
const { detecterCategorie } = require('../src/lib/categorisation.ts');

// [titre, description, catégorie attendue]
const CAS = [
  // Les erreurs de rangement constatées dans l'application
  ['Montre homme classe', '', 'mode_beaute'],
  ['Cuisinière gaz 4 feux', 'Neuve dans son carton', 'maison_electromenager'],
  ['Parfum femme original', 'Livraison gratuite à Bamako', 'mode_beaute'],
  ['Compte PlayStation 5', 'Avec plusieurs jeux', 'telephonie_electronique'],

  // Téléphonie / électronique
  ['iPhone 13 Pro Max 256go', '', 'telephonie_electronique'],
  ['Pc portable HP core i5', '', 'telephonie_electronique'],
  ['Smart TV 43 pouces', '', 'telephonie_electronique'],

  // Maison
  ['Ventilateur sur pied', '', 'maison_electromenager'],
  ['Chambre à coucher complète', '', 'maison_electromenager'],
  ['Ciment Diamond 50kg', 'Sac de ciment disponible', 'maison_electromenager'],
  ['Canapé 7 places', '', 'maison_electromenager'],

  // Immobilier
  ['Terrain à vendre à Kalaban', 'Titre foncier disponible', 'immobilier'],
  ['Chambre à louer Badalabougou', '', 'immobilier'],
  ['Villa duplex à vendre', '', 'immobilier'],
  ['Maison à vendre à Kati', '', 'immobilier'],

  // Mode
  ['Bazin riche 10 mètres', '', 'mode_beaute'],
  ['Chaussures Nike homme', '', 'mode_beaute'],
  ['Sac à main femme', '', 'mode_beaute'],

  // Véhicules
  ['Toyota Corolla 2010', '', 'voitures'],
  ['Djakarta TVS 2023', '', 'motos'],

  // Animaux / alimentation
  ['Mouton Tabaski', '', 'animaux'],
  ['Poulet braisé maison', 'Restaurant ouvert tous les jours', 'alimentation'],
  ['Sac de riz 50kg', '', 'alimentation'],

  // Cas repris du catalogue reel (voir rapport-categories.js)
  ['Carte psn 100 euros', '', 'telephonie_electronique'],
  ['Power bank 20000mah', '', 'telephonie_electronique'],
  ['Compte Netflix 1 mois', '', 'telephonie_electronique'],
  ['Ensemble jube coton brodé', '', 'mode_beaute'],
  ["L'huile de macadamia shampoing", '', 'mode_beaute'],
  ['Moustiquaire pliable', '', 'maison_electromenager'],
  ['Bouteille de gaz 6kg', '', 'maison_electromenager'],

  // Services
  ['Réparation téléphone à domicile', '', 'services'],
  ['Coiffure à domicile tresses', '', 'services'],
  ['Couturier sur mesure', '', 'services'],
  ['Transport et déménagement camion', '', 'services'],
];

let reussis = 0;
const echecs = [];

for (const [titre, description, attendue] of CAS) {
  const d = detecterCategorie(titre, description);
  if (d.categorie === attendue) {
    reussis++;
  } else {
    echecs.push({ titre, attendue, obtenue: d.categorie, confiance: d.confiance, indices: d.indices });
  }
}

console.log(`\n${reussis}/${CAS.length} cas classés correctement.\n`);

if (echecs.length > 0) {
  console.log('Échecs :');
  for (const e of echecs) {
    console.log(`  « ${e.titre} »`);
    console.log(`     attendu : ${e.attendue}`);
    console.log(`     obtenu  : ${e.obtenue || '(rien)'} [${e.confiance}] — indices : ${e.indices.join(', ') || 'aucun'}`);
  }
  console.log('');
}

// Détail des confiances : une détection juste mais « faible » ne corrigera
// rien automatiquement, c'est une information aussi importante que l'échec.
const parConfiance = {};
for (const [titre, description] of CAS) {
  const c = detecterCategorie(titre, description).confiance;
  parConfiance[c] = (parConfiance[c] || 0) + 1;
}
console.log('Confiances :', parConfiance, '\n');

process.exit(echecs.length > 0 ? 1 : 0);
