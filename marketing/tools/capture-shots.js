/* ============================================================
   Génère la banque d'images de référence pour la vidéo IA 30 s.
   Capture des moments précis de l'explainer en 1080x1920 (PNG),
   sans les habillages vidéo (légendes, badge d'étape, progression).
   Usage : node capture-shots.js
   ============================================================ */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HERE = __dirname;
const PAGE = path.resolve(HERE, '..', 'explainer-tour.html');
const ROOT = path.resolve(HERE, '..', 'video-30s');
const STEP = 40;                       // pas de temps virtuel (ms)

/* Moments à capturer, rangés par SCÈNE (1 scène = 1 génération de 10 s).
   Le préfixe numérique donne l'ordre d'apparition dans la scène.        */
const S1 = 'scene-1-accroche-decouverte';
const S2 = 'scene-2-recherche-negociation';
const S3 = 'scene-3-publication-telechargement';
const RS = 'reserve';

const SHOTS = [
  // Scène 1 — accroche & découverte
  { t:  2300, dir:S1, f:'1-A1-logo-marque.png' },
  { t:  5300, dir:S1, f:'2-A2-accroche-tout-sachete.png' },
  { t:  9600, dir:S1, f:'3-B1-accueil-annonces.png' },
  // Scène 2 — cherche & négocie
  { t: 31200, dir:S2, f:'1-B3-recherche-resultats.png' },
  { t: 36600, dir:S2, f:'2-B4-fiche-annonce.png' },
  { t: 54200, dir:S2, f:'4-B5-conversation-negociation.png' },
  // Scène 3 — vends & télécharge
  { t: 80200, dir:S3, f:'1-B7-publier-annonce.png' },
  { t: 86200, dir:S3, f:'2-E2-timer-2-minutes.png' },
  { t: 59900, dir:S3, f:'3-A3-trouve-negocie-vendu.png' },
  { t:101200, dir:S3, f:'4-A5-carton-final-stores.png' },
  // Réserve — plans de secours si une scène a besoin d'une image de plus
  { t: 18600, dir:RS, f:'E1-courbe-croissance.png' },
  { t: 23600, dir:RS, f:'B2-categories.png' },
  { t: 66600, dir:RS, f:'B6-messagerie.png' },
  { t: 92200, dir:RS, f:'B8-profil-vendeur.png' },
  { t: 96900, dir:RS, f:'A4-arguments-cles.png' },
];

function findChrome(){
  return [ process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(),'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome',
  ].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch(_) { return false; } });
}
function advance(client, ms){
  return new Promise((res, rej) => {
    const to = setTimeout(()=>rej(new Error('temps virtuel bloqué')), 30000);
    client.once('Emulation.virtualTimeBudgetExpired', ()=>{ clearTimeout(to); res(); });
    client.send('Emulation.setVirtualTimePolicy',{policy:'advance',budget:ms}).catch(e=>{clearTimeout(to);rej(e);});
  });
}

(async () => {
  const chrome = findChrome();
  if (!chrome){ console.error('Chrome introuvable.'); process.exit(1); }

  SHOTS.forEach(s => fs.mkdirSync(path.join(ROOT, s.dir), { recursive:true }));

  const browser = await puppeteer.launch({ executablePath: chrome, headless:'shell',
    args:['--hide-scrollbars','--mute-audio','--force-color-profile=srgb',
          '--font-render-hinting=none','--disable-lcd-text','--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width:1080, height:1920, deviceScaleFactor:1 });
  await page.goto('file:///' + PAGE.replace(/\\/g,'/') + '?render&mute', { waitUntil:'networkidle0', timeout:60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(i=>!i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r; })));
    // retire les habillages propres à la vidéo : on veut des images « nues »
    const s = document.createElement('style');
    s.textContent = '.cap,.step-tag,.prog{display:none!important;}';
    document.head.appendChild(s);
  });

  const client = await page.createCDPSession();
  await client.send('Emulation.setVirtualTimePolicy',{policy:'pause'});
  await page.evaluate(()=>window.__begin());

  const targets = [...SHOTS].sort((a,b)=>a.t-b.t);
  let vt = 0, done = 0;
  for (const shot of targets){
    while (vt < shot.t){
      const d = Math.min(STEP, shot.t - vt);
      await page.evaluate(()=>window.__fixAnims());
      await advance(client, d);
      vt += d;
    }
    await page.evaluate(()=>window.__fixAnims());
    const out = path.join(ROOT, shot.dir, shot.f);
    await page.screenshot({ path: out, type:'png' });
    done++;
    console.log(`  [${String(done).padStart(2)}/${targets.length}] ${shot.dir}/${shot.f}  (t=${(shot.t/1000).toFixed(1)}s)`);
  }
  await browser.close();
  console.log(`\n✅ ${done} images générées dans ${ROOT}`);
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });
