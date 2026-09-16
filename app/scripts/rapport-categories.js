/**
 * Rapport de rangement des annonces en ligne — LECTURE SEULE.
 *
 * Passe toutes les annonces actives au détecteur (src/lib/categorisation.ts)
 * et compare avec la catégorie choisie par le vendeur. Rien n'est modifié :
 * on regarde d'abord l'ampleur du problème et on vérifie que le détecteur ne
 * raconte pas n'importe quoi, AVANT d'envisager la moindre correction.
 *
 *   node scripts/rapport-categories.js
 *   node scripts/rapport-categories.js --exemples 30   (plus d'exemples affichés)
 *
 * Produit `rapport-categories.csv` (ouvrable dans Excel) à la racine de app/.
 * Ne lit que du texte : aucune image n'est téléchargée, l'impact sur le quota
 * Supabase est négligeable.
 */
require('./charger-ts');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { analyserAnnonce } = require('../src/lib/categorisation.ts');
const { CATEGORIES, getSousCategorieLabel } = require('../src/constants/theme.ts');

// ── Configuration ────────────────────────────────────────────────────────

function lireEnv() {
  // `.env.local` d'abord : c'est le fichier qui gagne côté Expo.
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
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const CLE = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !CLE) {
  console.error('Configuration Supabase absente (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY).');
  process.exit(1);
}

const NB_EXEMPLES = (() => {
  const i = process.argv.indexOf('--exemples');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) || 15 : 15;
})();

const labelCategorie = id => CATEGORIES.find(c => c.id === id)?.label || id || '(vide)';

// ── Lecture des annonces ─────────────────────────────────────────────────

async function chargerAnnonces(supabase) {
  const PAGE = 1000;
  const toutes = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('annonces')
      // Texte uniquement : ni images, ni jointure vendeur.
      .select('id, titre, description, categorie, sous_categorie, date_creation')
      .eq('statut', 'active')
      .eq('est_payee', true)
      .order('date_creation', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);

    if (error) throw new Error(error.message);
    toutes.push(...data);
    if (data.length < PAGE) return toutes;
  }
}

// ── Rapport ──────────────────────────────────────────────────────────────

function csvChamp(valeur) {
  const texte = String(valeur ?? '').replace(/"/g, '""');
  return `"${texte}"`;
}

async function main() {
  const supabase = createClient(URL, CLE, { auth: { persistSession: false } });

  console.log('Lecture des annonces actives…');
  const annonces = await chargerAnnonces(supabase);
  console.log(`${annonces.length} annonces analysées.\n`);

  const resultats = annonces.map(a => ({ annonce: a, analyse: analyserAnnonce(a) }));

  const desaccords = resultats.filter(r => !r.analyse.accord);
  const corrigeables = resultats.filter(r => r.analyse.corrigeable);
  const aVerifier = desaccords.filter(r => !r.analyse.corrigeable);
  const nonDetectees = resultats.filter(r => r.analyse.confiance === 'aucune');
  const sousCatSeule = resultats.filter(r => r.analyse.accord && !r.analyse.accordSousCategorie);

  const pct = n => (annonces.length ? Math.round((n / annonces.length) * 1000) / 10 : 0);

  console.log('─────────────────────────────────────────────');
  console.log(`Catégorie confirmée par le texte : ${resultats.length - desaccords.length - nonDetectees.length} (${pct(resultats.length - desaccords.length - nonDetectees.length)} %)`);
  console.log(`Aucun mot reconnu (rien à dire)  : ${nonDetectees.length} (${pct(nonDetectees.length)} %)`);
  console.log(`Catégorie CONTREDITE par le texte: ${desaccords.length} (${pct(desaccords.length)} %)`);
  console.log(`   dont sûres (corrigeables)     : ${corrigeables.length}`);
  console.log(`   dont à vérifier à la main     : ${aVerifier.length}`);
  console.log(`Bonne catégorie, sous-catégorie à revoir : ${sousCatSeule.length}`);
  console.log('─────────────────────────────────────────────\n');

  // Les déplacements les plus fréquents : c'est ce tableau qui dit où est le
  // vrai désordre (« Téléphonie → Mode & Beauté : 42 annonces »).
  const mouvements = new Map();
  corrigeables.forEach(r => {
    const cle = `${labelCategorie(r.annonce.categorie)} → ${labelCategorie(r.analyse.categorie)}`;
    mouvements.set(cle, (mouvements.get(cle) || 0) + 1);
  });
  if (mouvements.size > 0) {
    console.log('Déplacements sûrs les plus fréquents :');
    [...mouvements.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([cle, n]) => console.log(`  ${String(n).padStart(4)}  ${cle}`));
    console.log('');
  }

  if (corrigeables.length > 0) {
    console.log(`Exemples de corrections sûres (${Math.min(NB_EXEMPLES, corrigeables.length)} sur ${corrigeables.length}) :`);
    corrigeables.slice(0, NB_EXEMPLES).forEach(r => {
      console.log(`  « ${r.annonce.titre} »`);
      console.log(`      ${labelCategorie(r.annonce.categorie)} → ${labelCategorie(r.analyse.categorie)}`
        + ` / ${getSousCategorieLabel(r.analyse.sousCategorie) || '?'}`
        + `   (mots : ${r.analyse.indices.slice(0, 5).join(', ')})`);
    });
    console.log('');
  }

  // ── CSV complet ────────────────────────────────────────────────────────
  const lignes = [
    [
      'id', 'titre', 'categorie_actuelle', 'categorie_detectee',
      'sous_categorie_actuelle', 'sous_categorie_detectee',
      'confiance', 'corrigeable', 'score', 'score_suivant', 'mots_trouves',
    ].join(';'),
  ];

  resultats
    // D'abord ce qui mérite un regard : les désaccords, les plus sûrs en tête.
    .sort((a, b) => {
      const rang = r => (r.analyse.corrigeable ? 0 : !r.analyse.accord ? 1 : !r.analyse.accordSousCategorie ? 2 : 3);
      return rang(a) - rang(b) || b.analyse.score - a.analyse.score;
    })
    .forEach(({ annonce, analyse }) => {
      lignes.push([
        csvChamp(annonce.id),
        csvChamp(annonce.titre),
        csvChamp(labelCategorie(annonce.categorie)),
        csvChamp(analyse.categorie ? labelCategorie(analyse.categorie) : ''),
        csvChamp(getSousCategorieLabel(annonce.sous_categorie) || annonce.sous_categorie || ''),
        csvChamp(getSousCategorieLabel(analyse.sousCategorie) || ''),
        csvChamp(analyse.confiance),
        csvChamp(analyse.corrigeable ? 'oui' : ''),
        csvChamp(analyse.score),
        csvChamp(analyse.scoreSuivant),
        csvChamp(analyse.indices.join(' ')),
      ].join(';'));
    });

  const sortie = path.join(__dirname, '..', 'rapport-categories.csv');
  // BOM : sans lui, Excel affiche « MontrÃ¨s » à l'ouverture.
  fs.writeFileSync(sortie, '﻿' + lignes.join('\n'), 'utf8');
  console.log(`Rapport complet : ${sortie}`);
}

main().catch(e => {
  console.error('Échec :', e.message);
  process.exit(1);
});
