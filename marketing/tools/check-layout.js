/* Contrôle de mise en page à la taille réelle du rendu (1080x1920) */
const puppeteer = require('puppeteer-core');
const path = require('path');
const PAGE = path.resolve(__dirname, '..', 'explainer-tour.html');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
    args: ['--hide-scrollbars','--mute-audio','--allow-file-access-from-files','--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('file:///' + PAGE.replace(/\\/g,'/') + '?render&mute', { waitUntil:'networkidle0' });
  await page.evaluate(async () => { await document.fonts.ready; });

  const res = await page.evaluate(() => {
    const st = document.getElementById('stage').getBoundingClientRect();
    const out = { viewport: Math.round(st.width) + 'x' + Math.round(st.height), captions: [], cta: null };

    // 1) chaque légende : nb de lignes + mot orphelin ?
    const caps = [
      'Des milliers d\'annonces <span class="redword">près de chez toi</span>',
      'Toutes les <span class="redword">catégories</span>, en un clic',
      'Tape ce que tu veux, <span class="redword">trouve tout de suite</span>',
      'Photos, prix, vendeur <span class="redword">vérifié</span>',
      'Contacte le vendeur et <span class="redword">négocie en direct</span>',
      'Toutes tes discussions <span class="redword">au même endroit</span>',
      'Publie ton annonce en <span class="redword">2 minutes</span>',
      'Ton profil, tes annonces, <span class="redword">tes favoris</span>',
    ];
    const cap = document.getElementById('cap');
    cap.classList.add('show');
    const lh = parseFloat(getComputedStyle(cap).lineHeight);
    for (const html of caps){
      cap.innerHTML = html;
      const h = cap.getBoundingClientRect().height;
      const lines = Math.round(h / lh);
      // detecte un dernier mot seul : on mesure la largeur du dernier mot vs la ligne
      const words = cap.textContent.trim().split(/\s+/);
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:'+getComputedStyle(cap).font;
      probe.textContent = words[words.length-1];
      document.body.appendChild(probe);
      const lastW = probe.getBoundingClientRect().width; probe.remove();
      out.captions.push({ texte: cap.textContent.slice(0,34), lignes: lines,
                          dernierMotPx: Math.round(lastW), largeurUtile: Math.round(st.width*0.84) });
    }
    cap.classList.remove('show'); cap.innerHTML = '';

    // 2) bouton CTA : tient-il sur une ligne, dans le cadre ?
    const sc = document.getElementById('s-cta'); sc.classList.add('on');
    const dl = document.getElementById('s-cta').querySelector('.dl');
    const b = dl.getBoundingClientRect(), cs = getComputedStyle(dl);
    out.cta = { largeurPx: Math.round(b.width), hauteurPx: Math.round(b.height),
                uneLigne: cs.whiteSpace === 'nowrap',
                depasse: b.left < st.left || b.right > st.right,
                margeGauchePx: Math.round(b.left - st.left) };
    sc.classList.remove('on');
    return out;
  });

  console.log('viewport :', res.viewport, '\n');
  console.table(res.captions);
  console.log('\nBouton CTA :', JSON.stringify(res.cta));
  const multi = res.captions.filter(c => c.lignes > 2);
  console.log(multi.length ? `\n⚠ ${multi.length} légende(s) sur >2 lignes` : '\n✅ toutes les légendes tiennent sur 1-2 lignes');
  console.log(res.cta.uneLigne && !res.cta.depasse ? '✅ CTA sur une ligne, dans le cadre' : '❌ CTA à revoir');
  await browser.close();
})().catch(e => { console.error('❌', e); process.exit(1); });
