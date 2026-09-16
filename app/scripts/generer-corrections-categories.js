/**
 * Génère le SQL de correction des catégories, à relire puis à exécuter dans
 * l'éditeur SQL du dashboard Supabase.
 *
 * Pourquoi passer par un fichier SQL plutôt qu'écrire directement :
 *   - corriger les annonces des AUTRES demande la clé de service ; la faire
 *     transiter par un script local, c'est se tromper une fois de trop ;
 *   - un fichier se relit avant de s'exécuter. Ces annonces appartiennent à
 *     des vendeurs : un déplacement à tort est une annonce qui disparaît de
 *     là où son propriétaire est allé la chercher.
 *
 * Le SQL produit est prudent par construction :
 *   - il sauvegarde l'ancien rangement dans une table dédiée (retour arrière
 *     possible à tout moment, la requête est fournie en fin de fichier) ;
 *   - chaque UPDATE porte sur un id précis ET vérifie l'ancienne valeur : si
 *     le vendeur a corrigé son annonce entre-temps, la ligne n'est pas
 *     touchée ;
 *   - tout est dans une transaction : ça passe en entier ou pas du tout.
 *
 *   node scripts/generer-corrections-categories.js
 */
require('./charger-ts');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { analyserAnnonce } = require('../src/lib/categorisation.ts');
const { CATEGORIES, getSousCategorieLabel } = require('../src/constants/theme.ts');

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
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const CLE = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !CLE) {
  console.error('Configuration Supabase absente (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY).');
  process.exit(1);
}

const labelCategorie = id => CATEGORIES.find(c => c.id === id)?.label || id || '(vide)';
const labelSous = id => getSousCategorieLabel(id) || id || '(vide)';

/** Un titre part en commentaire SQL : ni retour à la ligne, ni fin de ligne. */
const commentaire = texte =>
  String(texte || '').replace(/\s+/g, ' ').replace(/--/g, '—').trim().slice(0, 90);

const sqlTexte = valeur => (valeur === null || valeur === undefined ? 'NULL' : `'${String(valeur).replace(/'/g, "''")}'`);

/**
 * Filet pour les annonces qu'aucun mot ne décrit — les parfums nommés par
 * leur marque (« Black Opium », « 1 Million »), qui sont pourtant la majorité
 * du catalogue. Un vendeur qui a déjà rangé vingt annonces dans
 * « Beauté & Cosmétiques » range la vingt-et-unième au même endroit : on
 * hérite de sa sous-catégorie habituelle, à condition qu'elle soit franche
 * (au moins trois annonces et 70 % de ses annonces de cette catégorie).
 */
function habitudesVendeur(annonces) {
  const comptes = new Map(); // user_id|categorie -> Map(sous_categorie -> n)
  annonces.forEach(a => {
    if (!a.sous_categorie || !a.user_id) return;
    const cle = `${a.user_id}|${a.categorie}`;
    const parSous = comptes.get(cle) || new Map();
    parSous.set(a.sous_categorie, (parSous.get(a.sous_categorie) || 0) + 1);
    comptes.set(cle, parSous);
  });

  const habituelle = new Map();
  comptes.forEach((parSous, cle) => {
    const total = [...parSous.values()].reduce((s, n) => s + n, 0);
    const [sous, n] = [...parSous.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 3 && n / total >= 0.7) habituelle.set(cle, { sous, n, total });
  });
  return habituelle;
}

async function main() {
  const supabase = createClient(URL, CLE, { auth: { persistSession: false } });

  const PAGE = 1000;
  const annonces = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('annonces')
      .select('id, user_id, titre, description, categorie, sous_categorie')
      .eq('statut', 'active')
      .eq('est_payee', true)
      .order('date_creation', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    annonces.push(...data);
    if (data.length < PAGE) break;
  }

  const habituelle = habitudesVendeur(annonces);

  const categorieCorrigee = [];   // catégorie contredite, détection sûre
  const sousManquante = [];       // aucune sous-catégorie, texte explicite
  const sousHeritee = [];         // aucune sous-catégorie, habitude du vendeur
  const sousContredite = [];      // catégorie bonne, sous-catégorie fausse
  const douteux = [];             // désaccord non concluant → décision humaine
  const restant = [];             // toujours sans sous-catégorie → à trancher

  annonces.forEach(a => {
    const d = analyserAnnonce(a);

    if (d.corrigeable) {
      categorieCorrigee.push({ a, d });
      return;
    }
    if (!d.accord) {
      douteux.push({ a, d });
      return;
    }

    if (!a.sous_categorie) {
      if (d.sousCategorie && d.confiance === 'forte') {
        sousManquante.push({ a, d });
      } else {
        const habitude = habituelle.get(`${a.user_id}|${a.categorie}`);
        if (habitude) sousHeritee.push({ a, d, habitude });
        else restant.push({ a, d });
      }
    } else if (!d.accordSousCategorie && d.confiance === 'forte') {
      // `accordSousCategorie` — et non une simple comparaison — pour ne pas
      // deplacer un rayon quand le texte ne tranche pas entre plusieurs
      // (« Ensemble Pantalon » : homme et femme sont aussi defendables).
      sousContredite.push({ a, d });
    }
  });

  // ── Écriture du SQL ────────────────────────────────────────────────────
  const l = [];
  const idsTouches = new Set();

  const bloc = (titre, explication) => {
    l.push('', `-- ${'─'.repeat(70)}`, `-- ${titre}`, `-- ${explication}`, `-- ${'─'.repeat(70)}`, '');
  };

  const update = ({ a }, champs, condition) => {
    idsTouches.add(a.id);
    const set = Object.entries(champs).map(([c, v]) => `${c} = ${sqlTexte(v)}`).join(', ');
    l.push(`UPDATE public.annonces SET ${set}`);
    l.push(`  WHERE id = '${a.id}' AND ${condition};`);
  };

  l.push('-- Correction du rangement des annonces — généré par');
  l.push('-- app/scripts/generer-corrections-categories.js');
  l.push(`-- Généré le ${new Date().toISOString().slice(0, 10)} sur ${annonces.length} annonces actives.`);
  l.push('--');
  l.push('-- À exécuter dans l\'éditeur SQL du dashboard Supabase, APRÈS relecture.');
  l.push('-- Chaque UPDATE vérifie l\'ancienne valeur : une annonce modifiée par son');
  l.push('-- vendeur depuis la génération de ce fichier ne sera pas touchée.');
  l.push('');
  l.push('BEGIN;');

  bloc('SAUVEGARDE', 'Le rangement actuel, pour pouvoir revenir en arrière (requête en fin de fichier).');
  l.push('CREATE TABLE IF NOT EXISTS public.annonces_categories_sauvegarde (');
  l.push('  id UUID PRIMARY KEY,');
  l.push('  categorie TEXT,');
  l.push('  sous_categorie TEXT,');
  l.push('  sauvegarde_le TIMESTAMPTZ DEFAULT NOW()');
  l.push(');');
  l.push('');
  const placeholderSauvegarde = l.length;
  l.push('__SAUVEGARDE__');

  bloc(
    `1. CATÉGORIE CONTREDITE PAR LE TEXTE — ${categorieCorrigee.length} annonces`,
    'Le titre dit clairement autre chose que la catégorie choisie.'
  );
  categorieCorrigee.forEach(item => {
    const { a, d } = item;
    l.push(`-- « ${commentaire(a.titre)} »`);
    l.push(`--   ${labelCategorie(a.categorie)} → ${labelCategorie(d.categorie)} / ${labelSous(d.sousCategorie)}   (mots : ${d.indices.slice(0, 5).join(', ')})`);
    const champs = { categorie: d.categorie };
    if (d.sousCategorie) champs.sous_categorie = d.sousCategorie;
    update(item, champs, `categorie = ${sqlTexte(a.categorie)}`);
    l.push('');
  });

  bloc(
    `2. SOUS-CATÉGORIE ABSENTE, DEVINÉE PAR LE TITRE — ${sousManquante.length} annonces`,
    'Annonces publiées avant les sous-catégories : sans rayon, elles seront invisibles dans le nouvel accueil.'
  );
  sousManquante.forEach(item => {
    const { a, d } = item;
    l.push(`-- « ${commentaire(a.titre)} »  →  ${labelSous(d.sousCategorie)}   (mots : ${d.indices.slice(0, 4).join(', ')})`);
    update(item, { sous_categorie: d.sousCategorie }, 'sous_categorie IS NULL');
    l.push('');
  });

  bloc(
    `3. SOUS-CATÉGORIE ABSENTE, HÉRITÉE DU VENDEUR — ${sousHeritee.length} annonces`,
    'Aucun mot reconnaissable (parfums nommés par leur marque) : on reprend le rayon habituel du vendeur.'
  );
  sousHeritee.forEach(item => {
    const { a, habitude } = item;
    l.push(`-- « ${commentaire(a.titre)} »  →  ${labelSous(habitude.sous)}   (ce vendeur y range déjà ${habitude.n}/${habitude.total} de ses annonces)`);
    update(item, { sous_categorie: habitude.sous }, 'sous_categorie IS NULL');
    l.push('');
  });

  bloc(
    `4. SOUS-CATÉGORIE À CORRIGER — ${sousContredite.length} annonces`,
    'Bonne catégorie, mauvais rayon à l\'intérieur.'
  );
  sousContredite.forEach(item => {
    const { a, d } = item;
    l.push(`-- « ${commentaire(a.titre)} »  ${labelSous(a.sous_categorie)} → ${labelSous(d.sousCategorie)}   (mots : ${d.indices.slice(0, 4).join(', ')})`);
    update(item, { sous_categorie: d.sousCategorie }, `sous_categorie = ${sqlTexte(a.sous_categorie)}`);
    l.push('');
  });

  l.push('COMMIT;');

  // La sauvegarde ne concerne que les annonces réellement touchées.
  const listeIds = [...idsTouches].map(id => `'${id}'`).join(',\n    ');
  l[placeholderSauvegarde] = idsTouches.size === 0
    ? '-- Aucune annonce à corriger.'
    : [
        'INSERT INTO public.annonces_categories_sauvegarde (id, categorie, sous_categorie)',
        'SELECT id, categorie, sous_categorie FROM public.annonces',
        `WHERE id IN (\n    ${listeIds}\n  )`,
        'ON CONFLICT (id) DO NOTHING;',
      ].join('\n');

  // ── Ce que le SQL ne corrige pas : la liste des décisions humaines ─────
  l.push('');
  l.push(`-- ${'═'.repeat(70)}`);
  l.push('-- RESTE À TRANCHER À LA MAIN (aucun UPDATE ci-dessous)');
  l.push(`-- ${'═'.repeat(70)}`);
  l.push('');
  l.push(`-- A. Désaccords non concluants — ${douteux.length} annonces.`);
  l.push('--    Le texte suggère autre chose, mais pas assez nettement pour agir seul.');
  douteux.forEach(({ a, d }) => {
    l.push(`--    « ${commentaire(a.titre)} »  ${labelCategorie(a.categorie)} → ${labelCategorie(d.categorie)} ? [${d.confiance}]`);
    l.push(`--      UPDATE public.annonces SET categorie = '${d.categorie}', sous_categorie = ${sqlTexte(d.sousCategorie)} WHERE id = '${a.id}';`);
  });
  l.push('');
  l.push(`-- B. Toujours sans sous-catégorie — ${restant.length} annonces.`);
  l.push('--    Ni le titre ni l\'habitude du vendeur ne permettent de conclure.');
  restant.forEach(({ a }) => {
    l.push(`--    « ${commentaire(a.titre)} »  (${labelCategorie(a.categorie)})`);
    l.push(`--      UPDATE public.annonces SET sous_categorie = '???' WHERE id = '${a.id}';`);
  });
  l.push('');
  l.push(`-- ${'═'.repeat(70)}`);
  l.push('-- RETOUR ARRIÈRE (à exécuter seulement en cas de problème)');
  l.push(`-- ${'═'.repeat(70)}`);
  l.push('-- UPDATE public.annonces a');
  l.push('--   SET categorie = s.categorie, sous_categorie = s.sous_categorie');
  l.push('--   FROM public.annonces_categories_sauvegarde s');
  l.push('--   WHERE a.id = s.id;');
  l.push('');

  const sortie = path.join(__dirname, '..', '..', 'supabase', 'corrections_categories.sql');
  fs.writeFileSync(sortie, l.join('\n'), 'utf8');

  console.log('');
  console.log(`  1. Catégorie corrigée .................. ${categorieCorrigee.length}`);
  console.log(`  2. Sous-catégorie devinée par le titre . ${sousManquante.length}`);
  console.log(`  3. Sous-catégorie héritée du vendeur ... ${sousHeritee.length}`);
  console.log(`  4. Sous-catégorie corrigée ............. ${sousContredite.length}`);
  console.log(`     ─────────────────────────────────────────`);
  console.log(`     Total des annonces modifiées ....... ${idsTouches.size}`);
  console.log('');
  console.log(`  À trancher à la main : ${douteux.length} désaccords + ${restant.length} sans sous-catégorie`);
  console.log('');
  console.log(`Fichier : ${sortie}`);
}

main().catch(e => {
  console.error('Échec :', e.message);
  process.exit(1);
});
