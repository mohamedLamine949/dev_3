/* ============================================================
   Flash Market — Export MP4 de l'explainer
   Rendu DÉTERMINISTE : on fige l'horloge de Chrome (temps virtuel)
   et on avance image par image. Aucune frame perdue, quelle que
   soit la puissance de la machine.
   La bande-son (SFX WebAudio) est re-synthétisée hors-ligne puis muxée.

   Usage :  node render-video.js [--fps=60] [--scale=1] [--clean] [--no-audio]
   ============================================================ */

const puppeteer  = require('puppeteer-core');
const ffmpegPath = require('ffmpeg-static');
const { spawn }  = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

/* ---------------- Options ---------------- */
const arg = (k, def) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split('=')[1] : def;
};
const has = k => process.argv.includes(`--${k}`);

const FPS      = parseInt(arg('fps', '60'), 10);
const SCALE    = parseFloat(arg('scale', '1'));
const CLEAN    = has('clean');            // sans les textes (sous-titres au montage)
const NO_AUDIO = has('no-audio');
const W = 1080, H = 1920;

const HERE     = __dirname;
const PAGE     = path.resolve(HERE, '..', 'explainer-tour.html');
const OUT_DIR  = path.resolve(HERE, '..', 'export');
const OUT_FILE = path.join(OUT_DIR, CLEAN ? 'flashmarket-explainer-clean.mp4' : 'flashmarket-explainer.mp4');

if (!fs.existsSync(PAGE)) { console.error('Introuvable :', PAGE); process.exit(1); }
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ---------------- Chrome ---------------- */
function findChrome(){
  const c = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  return c.find(p => { try { return fs.existsSync(p); } catch(_) { return false; } });
}

/* Avance le temps virtuel de `ms` puis attend que le budget soit épuisé */
function advance(client, ms){
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('temps virtuel bloqué')), 30000);
    client.once('Emulation.virtualTimeBudgetExpired', () => { clearTimeout(to); resolve(); });
    client.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: ms })
          .catch(e => { clearTimeout(to); reject(e); });
  });
}

const fmt = s => `${Math.floor(s/60)}m ${String(Math.round(s%60)).padStart(2,'0')}s`;

(async () => {
  const chrome = findChrome();
  if (!chrome) { console.error('Chrome introuvable. Définis CHROME_PATH.'); process.exit(1); }

  const url = 'file:///' + PAGE.replace(/\\/g,'/') + '?render&mute' + (CLEAN ? '&clean' : '');
  console.log('▶ Page   :', path.basename(PAGE) + (CLEAN ? ' (clean)' : ''));
  console.log('▶ Sortie :', OUT_FILE);
  console.log('▶ Format : %dx%d @ %d fps%s', W*SCALE, H*SCALE, FPS, NO_AUDIO ? ' (sans son)' : ' + son');

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'shell',
    args: ['--hide-scrollbars','--mute-audio','--force-color-profile=srgb',
           '--font-render-hinting=none','--disable-lcd-text','--allow-file-access-from-files'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });

  console.log('\n⏳ Chargement (page, polices, images)…');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images]
      .filter(i => !i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r; })));
  });

  const total = await page.evaluate(() => window.__TOTAL);
  const nFrames = Math.round(total / 1000 * FPS);
  const step = 1000 / FPS;
  console.log(`   durée ${(total/1000).toFixed(1)}s → ${nFrames} images\n`);

  /* --- ffmpeg : les frames arrivent par stdin, aucun fichier temporaire --- */
  const silent = path.join(OUT_DIR, '.video-tmp.mp4');
  const ff = spawn(ffmpegPath, [
    '-y','-loglevel','error',
    '-f','image2pipe','-framerate',String(FPS),'-c:v','png','-i','pipe:0',
    '-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p',
    '-movflags','+faststart', silent,
  ]);
  ff.stderr.on('data', d => process.stderr.write(d));
  const ffDone = new Promise((res, rej) =>
    ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg (vidéo) a échoué : ' + c))));
  ff.stdin.on('error', () => {});

  const write = buf => ff.stdin.write(buf) ? Promise.resolve()
                     : new Promise(r => ff.stdin.once('drain', r));

  /* --- Temps virtuel : on fige, on démarre, puis on avance frame par frame --- */
  const client = await page.createCDPSession();
  await client.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  await page.evaluate(() => window.__begin());

  const t0 = Date.now();
  const fixAnims = () => page.evaluate(() => window.__fixAnims());

  for (let i = 0; i < nFrames; i++){
    await fixAnims();                                  // amorce les animations nées à cette frame
    await write(await page.screenshot({ type: 'png', optimizeForSpeed: true }));
    await advance(client, step);

    if (i % Math.round(FPS * 2) === 0 || i === nFrames - 1){
      const done = i + 1, el = (Date.now()-t0)/1000;
      const eta = done > 8 ? fmt(el/done * (nFrames-done)) : '…';
      process.stdout.write(`\r   image ${done}/${nFrames}  (${(done/nFrames*100).toFixed(1)}%)  reste ~${eta}   `);
    }
  }
  ff.stdin.end();
  console.log('\n\n⏳ Encodage vidéo…');
  await ffDone;

  /* --- Bande-son : re-synthèse hors-ligne des mêmes SFX --- */
  let wav = null;
  if (!NO_AUDIO){
    console.log('⏳ Bande-son (re-synthèse hors-ligne)…');
    const log = await page.evaluate(() => window.__sfxLog());
    await client.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 1e9 });
    const audioPage = await browser.newPage();
    await audioPage.goto(url, { waitUntil: 'networkidle0' });
    const b64 = await audioPage.evaluate(
      (l, d) => window.__renderWav(l, d), log, total/1000 + 1);
    wav = path.join(OUT_DIR, '.audio-tmp.wav');
    fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    console.log(`   ${log.length} sons rendus (${(fs.statSync(wav).size/1e6).toFixed(1)} Mo)`);
  }

  await browser.close();

  /* --- Mux final --- */
  console.log('⏳ Assemblage final…');
  const muxArgs = wav
    ? ['-y','-loglevel','error','-i',silent,'-i',wav,
       '-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart', OUT_FILE]
    : ['-y','-loglevel','error','-i',silent,'-c','copy','-movflags','+faststart', OUT_FILE];

  await new Promise((res, rej) => {
    const m = spawn(ffmpegPath, muxArgs);
    m.stderr.on('data', d => process.stderr.write(d));
    m.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg (mux) a échoué : ' + c)));
  });

  fs.unlinkSync(silent);
  if (wav) fs.unlinkSync(wav);

  const mb = (fs.statSync(OUT_FILE).size / 1e6).toFixed(1);
  console.log(`\n✅ Terminé en ${fmt((Date.now()-t0)/1000)}`);
  console.log(`   ${OUT_FILE}`);
  console.log(`   ${W*SCALE}x${H*SCALE} · ${FPS} fps · ${(total/1000).toFixed(1)}s · ${mb} Mo\n`);
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });
