/* ============================================================
   FLASH MARKET — Tour complet de l'app (9:16, ~1 min 43)
   Un utilisateur se sert vraiment de l'appli : curseur souris,
   clics, écrans qui s'ouvrent, frappe clavier, scroll.
   Téléphone 3D qui flotte + scènes graphiques intercalées.
   ============================================================ */

const params = new URLSearchParams(location.search);
const CLEAN  = params.has('clean');
const MUTE   = params.has('mute');
const RENDER = params.has('render');   // mode export MP4 : plein cadre, sons journalisés

/* Horloge de la timeline (Date.now suit le temps virtuel pendant l'export) */
let T0 = null;
const SFX_LOG = [];

/* ---------------- SFX ----------------
   Chaque son est défini indépendamment du contexte audio : il peut donc être
   joué en direct OU re-synthétisé hors-ligne pour la bande-son du MP4.        */
const Sfx = (() => {
  let live = null;
  const liveCtx = () => { if(!live) live = new (window.AudioContext || window.webkitAudioContext)(); return live; };

  const nbuf = (c,d) => { const n=Math.max(1,Math.floor(c.sampleRate*d)), b=c.createBuffer(1,n,c.sampleRate), a=b.getChannelData(0);
    for(let i=0;i<n;i++) a[i]=Math.random()*2-1; return b; };
  const env = (g,t,a,d,p) => { g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(p,t+a); g.gain.exponentialRampToValueAtTime(.0001,t+a+d); };
  const tone = (c,out,t,f,d,type='sine',g=.25,glide=null) => {
    const o=c.createOscillator(), ga=c.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t); if(glide) o.frequency.exponentialRampToValueAtTime(glide,t+d);
    env(ga,t,.01,d,g); o.connect(ga); ga.connect(out); o.start(t); o.stop(t+d+.05);
  };
  const noise = (c,out,t,d,f0,f1,g=.2,q=1) => {
    const s=c.createBufferSource(); s.buffer=nbuf(c,d+.05);
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=q;
    bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(f1,t+d);
    const ga=c.createGain(); env(ga,t,.008,d,g); s.connect(bp); bp.connect(ga); ga.connect(out);
    s.start(t); s.stop(t+d+.05);
  };

  const SOUNDS = {
    key:  (c,o,t)=> tone(c,o,t,2100,.026,'square',.045),
    click:(c,o,t)=>{ tone(c,o,t,1800,.035,'sine',.13); noise(c,o,t,.045,3200,1400,.07,2); },
    pop:  (c,o,t,p=520)=> tone(c,o,t,p*1.5,.11,'sine',.17,p),
    soft: (c,o,t)=> tone(c,o,t,660,.13,'sine',.12,880),
    push: (c,o,t)=> noise(c,o,t,.28,500,1900,.11,.8),
    back: (c,o,t)=> noise(c,o,t,.26,1900,500,.10,.8),
    swipe:(c,o,t)=> noise(c,o,t,.22,1500,600,.09,.9),
    sent: (c,o,t)=> tone(c,o,t,880,.14,'sine',.16,1320),
    recv: (c,o,t)=> tone(c,o,t,560,.16,'sine',.15,760),
    deal: (c,o,t)=>{ tone(c,o,t,784,.28,'triangle',.19); tone(c,o,t+.08,1175,.32,'triangle',.17); },
    sheet:(c,o,t)=> noise(c,o,t,.34,300,1200,.11,.7),
    rise: (c,o,t)=> noise(c,o,t,1.1,300,2600,.10,.7),
    chime:(c,o,t)=> [880,1175,1568].forEach((f,i)=> tone(c,o,t+i*.06,f,.7,'triangle',.14)),
    tada: (c,o,t)=> [523,659,784,1046].forEach((f,i)=> tone(c,o,t+i*.08,f,.3,'triangle',.14)),
  };

  const api = { resume(){ if(!RENDER && !MUTE){ try{ liveCtx().resume(); }catch(e){} } } };

  Object.keys(SOUNDS).forEach(name => {
    api[name] = (arg) => {
      if (T0 !== null) SFX_LOG.push({ n:name, t:(Date.now()-T0)/1000, a:arg });
      if (RENDER || MUTE) return;                    // export : on journalise sans jouer
      const c = liveCtx();
      const out = c.createGain(); out.gain.value = 1; out.connect(c.destination);
      SOUNDS[name](c, out, c.currentTime, arg);
    };
  });

  /* Re-synthétise toute la bande-son hors-ligne -> WAV (base64) */
  api.renderWav = async (log, durSec) => {
    const sr = 44100;
    const oc = new OfflineAudioContext(1, Math.ceil(sr * durSec), sr);
    const out = oc.createGain(); out.gain.value = .9; out.connect(oc.destination);
    log.forEach(e => { const f = SOUNDS[e.n]; if (f) { try { f(oc, out, e.t, e.a); } catch(_){} } });
    const buf = await oc.startRendering();
    const d = buf.getChannelData(0), n = d.length;
    const ab = new ArrayBuffer(44 + n*2), v = new DataView(ab);
    const S = (o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
    S(0,'RIFF'); v.setUint32(4, 36+n*2, true); S(8,'WAVEfmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
    S(36,'data'); v.setUint32(40, n*2, true);
    for(let i=0;i<n;i++){ const s=Math.max(-1,Math.min(1,d[i])); v.setInt16(44+i*2, s<0?s*0x8000:s*0x7FFF, true); }
    let bin=''; const u8=new Uint8Array(ab);
    for(let i=0;i<u8.length;i+=0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i,i+0x8000));
    return btoa(bin);
  };
  return api;
})();

/* ---------------- Raccourcis ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const stage = $('#stage'), phoneStage = $('#phoneStage'), mouse = $('#mouse'),
      prog = $('#prog'), cap = $('#cap'), bgfx = $('#bgfx'),
      stepTag = $('#stepTag'), stepNum = $('#stepNum'), stepLbl = $('#stepLbl'),
      miniBrand = $('#miniBrand');

let timers = [];
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

/* ---------------- Barres de navigation ---------------- */
const ICO = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  msg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H8l-4 4V5Z"/></svg>',
  profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};
function buildNav(el, active){
  el.innerHTML =
    `<span class="tab${active==='home'?' act':''}" data-tab="home">${ICO.home}Accueil</span>`+
    `<span class="tab${active==='search'?' act':''}" data-tab="search">${ICO.search}Recherche</span>`+
    `<span class="fab">${ICO.plus}</span>`+
    `<span class="tab${active==='msg'?' act':''}" data-tab="msg">${ICO.msg}Messages</span>`+
    `<span class="tab${active==='profile'?' act':''}" data-tab="profile">${ICO.profile}Profil</span>`;
}
buildNav($('#navHome'),'home'); buildNav($('#navSearch'),'search');
buildNav($('#navMsg'),'msg');   buildNav($('#navProfile'),'profile');

/* ---------------- Géométrie / curseur ---------------- */
function centerPct(el){
  const b = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { x: ((b.left+b.right)/2 - s.left)/s.width*100, y: ((b.top+b.bottom)/2 - s.top)/s.height*100 };
}
function mouseShow(on){ mouse.classList.toggle('on', !!on); }
function mouseAt(x,y){ mouse.style.transition='none'; mouse.style.left=x+'%'; mouse.style.top=y+'%'; void mouse.offsetWidth; }
function moveTo(x,y,dur=750){
  mouse.style.transition = `left ${dur}ms var(--ease), top ${dur}ms var(--ease), opacity .35s var(--ease)`;
  mouse.style.left = x+'%'; mouse.style.top = y+'%';
}
function moveToEl(el, dur=750){ const p = centerPct(el); moveTo(p.x, p.y, dur); return p; }
function clickFx(x,y){
  mouse.classList.add('click'); later(()=>mouse.classList.remove('click'), 190);
  ['clickring','clickdot'].forEach(cls => {
    const e = document.createElement('div'); e.className = cls;
    e.style.left = x+'%'; e.style.top = y+'%';
    stage.appendChild(e); void e.offsetWidth; e.classList.add('go');
    later(()=>e.remove(), 720);
  });
  Sfx.click();
}
/* Le téléphone flotte : on recale le curseur juste avant de cliquer */
function snapClick(el, cb, press){
  const p = centerPct(el); moveTo(p.x, p.y, 130);
  later(()=>{
    const q = centerPct(el); clickFx(q.x, q.y);
    if (press){ press.classList.add('pressed'); later(()=>press.classList.remove('pressed'), 320); }
    if (cb) later(cb, 200);
  }, 150);
}
/* Va sur un élément puis clique. Renvoie l'instant où l'action se produit. */
function clickEl(el, tMove, opts = {}){
  const { moveDur = 750, hold = 240, then = null, press = null } = opts;
  later(()=> moveToEl(el, moveDur), tMove);
  later(()=> snapClick(el, then, press), tMove + moveDur + hold);
  return tMove + moveDur + hold + 350;
}

/* ---------------- Navigation ---------------- */
const SCR = { home:'#scr-home', search:'#scr-search', msg:'#scr-msg', profile:'#scr-profile',
              detail:'#scr-detail', chat:'#scr-chat' };
const TABS = ['home','search','msg','profile'];
let currentTab = 'home';
let stack = [];

function hardSet(el, tf, op, z){
  el.style.transition='none'; el.style.transform=tf; el.style.opacity=op; el.style.zIndex=z; void el.offsetWidth;
}
function showTab(name, animate = true){
  stack.forEach(n => hardSet($(SCR[n]), 'translateX(100%)', '1', 5));
  stack = [];
  TABS.forEach(k => {
    const el = $(SCR[k]);
    if (k === name){
      hardSet(el, 'translateX(0)', animate ? '0' : '1', 2);
      if (animate){ el.style.transition='opacity .3s var(--ease)'; el.style.opacity='1'; }
    } else hardSet(el, 'translateX(100%)', '1', 1);
  });
  currentTab = name;
}
function topEl(){ return $(SCR[stack.length ? stack[stack.length-1] : currentTab]); }
function push(name){
  const under = topEl(), el = $(SCR[name]);
  hardSet(el, 'translateX(100%)', '1', 5 + stack.length);
  el.style.transition = 'transform .5s var(--smooth)';
  el.style.transform = 'translateX(0)';
  under.style.transition = 'transform .5s var(--smooth), opacity .5s var(--smooth)';
  under.style.transform = 'translateX(-28%)'; under.style.opacity = '.5';
  stack.push(name); Sfx.push();
}
function pop(){
  const name = stack.pop(); if (!name) return;
  const el = $(SCR[name]), under = topEl();
  el.style.transition = 'transform .45s var(--smooth)';
  el.style.transform = 'translateX(100%)';
  under.style.transition = 'transform .45s var(--smooth), opacity .45s var(--smooth)';
  under.style.transform = 'translateX(0)'; under.style.opacity = '1';
  Sfx.back();
}

/* ---------------- Frappe clavier ---------------- */
function typeHuman(el, text, startDelay, done, opts = {}){
  const { cursor = true, cls = null } = opts;
  const CUR = cursor ? '<span class="cur"></span>' : '';
  el.classList.remove('empty'); if (cls) el.classList.add(cls);
  el.innerHTML = CUR;
  let i = 0;
  const step = () => {
    el.innerHTML = text.slice(0, i) + CUR;
    if (i > 0 && text[i-1] !== ' ') Sfx.key();
    i++;
    if (i <= text.length) later(step, (text[i-2] === ' ' ? 145 : 68) + Math.random() * 65);
    else { if (!cursor) el.innerHTML = text; if (done) later(done, 260); }
  };
  later(step, startDelay);
}

/* ---------------- Compteur ---------------- */
/* Piloté par Date.now()+setTimeout (et non rAF) : fonctionne aussi à l'export MP4 */
function countTo(el, target, dur, decimals = 0, sep = false){
  const t0 = Date.now();
  const tick = () => {
    const p = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    const v = target * e;
    el.textContent = decimals ? v.toFixed(decimals).replace('.', ',')
                              : (sep ? Math.round(v).toLocaleString('fr-FR') : String(Math.round(v)));
    if (p < 1) later(tick, 16);
  };
  tick();
}

/* ---------------- Habillage ---------------- */
function setCap(html){
  if (CLEAN || !html){ cap.classList.remove('show'); cap.innerHTML=''; return; }
  cap.innerHTML = html; void cap.offsetWidth; cap.classList.add('show');
}
function setStep(num, lbl){
  if (!num){ stepTag.classList.remove('show'); return; }
  stepNum.textContent = num; stepLbl.textContent = lbl;
  stepTag.classList.remove('show'); void stepTag.offsetWidth; stepTag.classList.add('show');
}

/* ---------------- Courbe « annonces » ----------------
   Modifie STAT_DATA pour coller à tes vrais chiffres : le graphe,
   les repères et le compteur se recalculent tout seuls.            */
const STAT_DATA = [
  { m:'Jan', v:420 }, { m:'Fév', v:780 }, { m:'Mar', v:1250 },
  { m:'Avr', v:1850 }, { m:'Mai', v:2480 }, { m:'Juin', v:3200 },
];
const STAT_TARGET = STAT_DATA[STAT_DATA.length - 1].v;

function buildStatChart(){
  const X0=26, X1=276, Y0=26, Y1=126;               // zone de tracé
  const MAX = Math.max(...STAT_DATA.map(d=>d.v)) * 1.12;
  const n = STAT_DATA.length;
  const pts = STAT_DATA.map((d,i) => ({
    x: X0 + (X1-X0) * i/(n-1),
    y: Y1 - (Y1-Y0) * (d.v/MAX),
    m: d.m,
  }));

  /* Catmull-Rom → Bézier : courbe lissée qui passe par chaque point */
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i=0; i<n-1; i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||pts[i+1];
    d += ` C${(p1.x+(p2.x-p0.x)/6).toFixed(1)},${(p1.y+(p2.y-p0.y)/6).toFixed(1)}`
       + ` ${(p2.x-(p3.x-p1.x)/6).toFixed(1)},${(p2.y-(p3.y-p1.y)/6).toFixed(1)}`
       + ` ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  $('#statLine').setAttribute('d', d);
  $('#statArea').setAttribute('d', `${d} L${pts[n-1].x.toFixed(1)},${Y1} L${pts[0].x.toFixed(1)},${Y1} Z`);

  /* grille discrète (2 hairlines + ligne de base) */
  $('#statGrid').innerHTML = [0,1,2].map(i => {
    const y = Y0 + (Y1-Y0)*i/2;
    return `<line class="${i===2?'base':'grid'}" x1="${X0-12}" y1="${y.toFixed(1)}" x2="${X1+12}" y2="${y.toFixed(1)}"/>`;
  }).join('');

  /* repère vertical + points (le dernier est mis en valeur) */
  const last = pts[n-1];
  $('#statDots').innerHTML =
    `<line class="guide" x1="${last.x.toFixed(1)}" y1="${last.y.toFixed(1)}" x2="${last.x.toFixed(1)}" y2="${Y1}"/>` +
    `<circle class="halo" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="11"/>` +
    pts.map((p,i) => {
      const L = i===n-1;
      return `<circle class="dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${L?6:4.2}"`
           + ` fill="#16a34a" stroke="#fff" stroke-width="2.4"`
           + ` style="animation-delay:${(0.55 + i*0.16).toFixed(2)}s"/>`;
    }).join('');

  /* repères temporels sous l'axe */
  $('#statLabels').innerHTML = pts.map(p =>
    `<text class="xlab" x="${p.x.toFixed(1)}" y="${Y1+23}">${p.m}</text>`).join('');
}

/* ---------------- Données ---------------- */
const RESULTS = [
  { img:'img/iphone.png',   t:'iPhone 13 Pro 128 Go', m:'Hamdallaye · 2 km',  p:'285 000 F' },
  { img:'img/samsung.png',  t:'Samsung Galaxy S21',   m:'Kalaban · 4 km',     p:'195 000 F' },
  { img:'img/tablette.png', t:'Galaxy Tab A8 64 Go',  m:'Djicoroni · 5 km',   p:'85 000 F'  },
];
const CHAT = [
  { side:'me',   text:'Toujours dispo ?' },
  { side:'them', text:'Oui, comme neuf 👍' },
  { side:'me',   text:'270 000 F ?' },
  { side:'them', text:'Ok ça marche. Demain 16h ?' },
  { side:'me',   text:'Parfait, à demain ✓', deal:true },
];

/* ---------------- Reset ---------------- */
function resetAll(){
  showTab('home', false);
  $('#homeScroll').style.transition='none'; $('#homeScroll').style.transform='translateY(0)';
  $$('#homeGrid .gcard').forEach(c => c.classList.remove('show','pressed'));
  $('#cats').style.display='';
  $$('#cats .cat').forEach(c => { c.classList.remove('show','pressed'); c.style.opacity=''; c.style.transform=''; c.style.transition=''; });
  $('#rlist').innerHTML = '';
  const q = $('#searchQ'); q.className='q empty'; q.textContent='Que cherchez-vous ?';
  $('#searchSbar').classList.remove('focus');
  $$('#mlist .mrow').forEach(r => r.classList.remove('show'));
  $$('#pstats .pstat').forEach(s => { s.classList.remove('show'); s.querySelector('b').textContent='0'; });
  $$('#prows .prow').forEach(r => r.classList.remove('show'));
  $$('#cmsgs .msg').forEach(m => m.remove());
  $('#typing').classList.remove('show');
  const f = $('#chatField'); f.className='field'; f.textContent='Écrire un message…';
  $('#dfav').classList.remove('liked'); $('#dfav').textContent='🤍';
  $('#sheet').classList.remove('up');
  const pb = $('#photobox'); pb.className='photobox';
  pb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h3.5L8 6h8l1.5 2H21v11H3V8Z"/><circle cx="12" cy="13" r="3.6"/></svg><b>Ajouter des photos</b>';
  $('#vTitle').className='v'; $('#vTitle').textContent='Ex : iPhone 13 Pro';
  $('#vPrice').className='v'; $('#vPrice').textContent='0';
  $('#fldTitle').classList.remove('focus'); $('#fldPrice').classList.remove('focus');
  $('#toast').classList.remove('show');
  $$('.clickring,.clickdot,.confetti').forEach(e => e.remove());
  mouseShow(false); mouseAt(50, 108);
}

/* ============================================================
   SCÈNES — TÉLÉPHONE
   ============================================================ */
function scHome(){
  showTab('home', false);
  $$('#homeGrid .gcard').forEach((c,i) => later(()=>{ c.classList.add('show'); Sfx.pop(480 + i*40); }, 700 + i*110));
  later(()=>{ mouseShow(true); moveTo(50, 78, 900); }, 1500);
  later(()=>{
    $('#homeScroll').style.transition = 'transform 2.6s var(--smooth)';
    $('#homeScroll').style.transform = 'translateY(-20cqh)';
    Sfx.swipe(); moveTo(50, 52, 2400);
  }, 3200);
  later(()=>{
    $('#homeScroll').style.transition = 'transform 1.4s var(--smooth)';
    $('#homeScroll').style.transform = 'translateY(-7cqh)';
  }, 6600);
}

function scSearch(){
  const tab = $('#navHome .tab[data-tab="search"]');
  clickEl(tab, 300, { moveDur: 800, then: () => {
    showTab('search');
    $$('#cats .cat').forEach((c,i) => later(()=>{ c.classList.add('show'); Sfx.pop(460 + i*55); }, i*95));
  }});
  later(()=> moveTo(50, 46, 900), 2800);
}

function scType(){
  const sbar = $('#searchSbar');
  clickEl(sbar, 200, { moveDur: 750, then: () => {
    sbar.classList.add('focus');
    typeHuman($('#searchQ'), 'téléphone', 300, () => {
      $$('#cats .cat').forEach((c,i)=> later(()=>{
        c.style.transition='opacity .3s, transform .3s'; c.style.opacity='0'; c.style.transform='scale(.94)';
      }, i*40));
      later(()=>{
        $('#cats').style.display='none';
        $('#rlist').innerHTML = RESULTS.map(r => `
          <div class="acard"><img class="thumb" src="${r.img}" alt="">
            <div><div class="t">${r.t}</div>
              <div class="m"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/></svg> ${r.m}</div></div>
            <div class="price">${r.p}</div></div>`).join('');
        $$('#rlist .acard').forEach((c,i) => later(()=>{ c.classList.add('show'); Sfx.pop(500 + i*60); }, i*150));
      }, 350);
    });
  }});
}

function scDetail(){
  later(()=>{
    const card = $('#rlist .acard');
    if (card) clickEl(card, 0, { moveDur: 850, press: card, then: () => push('detail') });
  }, 200);
  later(()=>{
    const fav = $('#dfav');
    clickEl(fav, 0, { moveDur: 750, then: () => { fav.classList.add('liked'); fav.textContent='❤️'; Sfx.pop(760); } });
  }, 2700);
}

function scChat(){
  const cta = $('#dcta');
  clickEl(cta, 200, { moveDur: 800, press: cta, then: () => push('chat') });

  const box = $('#cmsgs'), typing = $('#typing'), field = $('#chatField'), send = $('#sendBtn');
  const addMsg = m => {
    const d = document.createElement('div');
    d.className = 'msg ' + m.side; d.textContent = m.text;
    box.insertBefore(d, typing); void d.offsetWidth; d.classList.add('show');
  };

  let t = 2200;
  CHAT.forEach(m => {
    if (m.side === 'me'){
      later(()=> moveToEl(field, 600), t); t += 700;
      later(()=> snapClick(field), t); t += 400;
      later(()=> typeHuman(field, m.text, 0, null, { cursor:false, cls:'typed' }), t);
      t += m.text.length * 85 + 350;
      later(()=> moveToEl(send, 450), t); t += 500;
      later(()=> snapClick(send, () => {
        addMsg(m); m.deal ? Sfx.deal() : Sfx.sent();
        field.className='field'; field.textContent='Écrire un message…';
      }, send), t);
      t += 800;
    } else {
      later(()=> typing.classList.add('show'), t); t += 950;
      later(()=>{ typing.classList.remove('show'); addMsg(m); Sfx.recv(); }, t); t += 800;
    }
  });
}

function scMessages(){
  clickEl($('#scr-chat .back'), 100, { moveDur: 650, then: () => pop() });
  later(()=> clickEl($('#scr-detail .dback'), 0, { moveDur: 650, then: () => pop() }), 1600);
  later(()=> clickEl($('#navSearch .tab[data-tab="msg"]'), 0, { moveDur: 800, then: () => {
      showTab('msg');
      $$('#mlist .mrow').forEach((r,i)=> later(()=>{ r.classList.add('show'); Sfx.pop(470 + i*50); }, i*130));
    }}), 3300);
}

function scPublish(){
  const fab = $('#navMsg .fab');
  clickEl(fab, 200, { moveDur: 800, press: fab, then: () => { $('#sheet').classList.add('up'); Sfx.sheet(); } });

  const box = $('#photobox');
  clickEl(box, 2200, { moveDur: 700, then: () => {
    box.classList.add('filled');
    box.innerHTML = '<img class="shot" src="img/voiture.jpg" alt="">';
    Sfx.pop(700);
  }});

  later(()=>{
    const fld = $('#fldTitle');
    clickEl(fld, 0, { moveDur: 650, then: () => {
      fld.classList.add('focus');
      typeHuman($('#vTitle'), 'Kia Optima 2013', 200, () => fld.classList.remove('focus'), { cursor:false, cls:'typed' });
    }});
  }, 4300);

  later(()=>{
    const fld = $('#fldPrice');
    clickEl(fld, 0, { moveDur: 650, then: () => {
      fld.classList.add('focus');
      typeHuman($('#vPrice'), '3 800 000', 200, () => fld.classList.remove('focus'), { cursor:false, cls:'typed' });
    }});
  }, 7500);

  later(()=>{
    const btn = $('#pubbtn');
    clickEl(btn, 0, { moveDur: 750, press: btn, then: () => {
      Sfx.deal();
      later(()=>{ $('#sheet').classList.remove('up'); $('#toast').classList.add('show'); Sfx.chime(); }, 450);
    }});
  }, 10200);
}

function scProfile(){
  later(()=> $('#toast').classList.remove('show'), 200);
  clickEl($('#navMsg .tab[data-tab="profile"]'), 500, { moveDur: 800, then: () => {
    showTab('profile');
    const stats = $$('#pstats .pstat');
    stats.forEach((s,i)=> later(()=>{ s.classList.add('show'); Sfx.pop(500 + i*70); }, i*140));
    later(()=>{
      countTo(stats[0].querySelector('b'), 13, 900);
      countTo(stats[1].querySelector('b'), 48, 900);
      countTo(stats[2].querySelector('b'), 4.9, 900, 1);
    }, 420);
    $$('#prows .prow').forEach((r,i)=> later(()=>{ r.classList.add('show'); Sfx.soft(); }, 600 + i*130));
  }});
  later(()=> moveTo(50, 40, 900), 3600);
}

/* ============================================================
   TIMELINE
   ============================================================ */
const scenes = [
  { id:'s-brand', dur:2600, full:true, run(){ Sfx.push(); later(()=>Sfx.chime(), 350); } },
  { id:'s-hook',  dur:3400, full:true, run(){ later(()=>Sfx.soft(),120); later(()=>Sfx.pop(700),720); later(()=>Sfx.pop(560),980); } },

  { dur:8600, step:['1','Découvre'], cap:'Des milliers d\'annonces <span class="redword">près de chez toi</span>',
    run: scHome, reset:true },

  { id:'s-stat', dur:5200, full:true, bg:true,
    run(){ Sfx.rise();
           later(()=> countTo($('#statNum'), STAT_TARGET, 1700, 0, true), 350);
           STAT_DATA.forEach((_,i)=> later(()=>Sfx.pop(470+i*55), 620+i*160));
           later(()=>Sfx.chime(), 1950); } },

  { dur:5200, step:['2','Explore'], cap:'Toutes les <span class="redword">catégories</span>, en un clic', run: scSearch },
  { dur:7200, step:['3','Cherche'], cap:'Tape ce que tu veux, <span class="redword">trouve tout de suite</span>', run: scType },
  { dur:6000, step:['4','Consulte'], cap:'Photos, prix, vendeur <span class="redword">vérifié</span>', run: scDetail },
  { dur:18500, step:['5','Négocie'], cap:'Contacte le vendeur et <span class="redword">négocie en direct</span>', run: scChat },

  { id:'s-words', dur:4800, full:true, bg:true,
    run(){ [0,1,2].forEach(i=>later(()=>Sfx.pop(560+i*120), 150+i*320)); later(()=>Sfx.deal(), 1250); } },

  { dur:6600, step:['6','Suis'], cap:'Toutes tes discussions <span class="redword">au même endroit</span>', run: scMessages },
  { dur:14500, step:['7','Vends'], cap:'Publie ton annonce en <span class="redword">2 minutes</span>', run: scPublish },

  { id:'s-timer', dur:4800, full:true, bg:true,
    run(){ Sfx.rise(); later(()=>Sfx.chime(), 1700); } },

  { dur:6200, step:['8','Gère'], cap:'Ton profil, tes annonces, <span class="redword">tes favoris</span>', run: scProfile },

  { id:'s-value', dur:4600, full:true, run(){ [0,1,2,3].forEach(i=>later(()=>Sfx.pop(500+i*90), 150+i*165)); } },
  { id:'s-cta',   dur:4600, full:true, run(){ Sfx.chime(); later(()=>Sfx.tada(),260); confetti(); } },
];
const TOTAL = scenes.reduce((s,x)=>s+x.dur, 0);

function confetti(){
  const cols = ['#16a34a','#0B0B0C','#FF2D2D','#22b558','#0B0B0C'];
  for (let i=0;i<44;i++){
    const c = document.createElement('div'); c.className='confetti';
    c.style.left = Math.random()*100+'%'; c.style.background = cols[i%cols.length];
    stage.appendChild(c);
    const dx=(Math.random()-.5)*40, dur=1900+Math.random()*1300, delay=Math.random()*350;
    c.animate([{transform:'translate(0,0) rotate(0)',opacity:1,offset:0},
               {transform:`translate(${dx}cqw,${stage.clientHeight+40}px) rotate(${Math.random()*720}deg)`,opacity:1,offset:1}],
      {duration:dur, delay, easing:'cubic-bezier(.3,.6,.4,1)', fill:'forwards'});
    later(()=>c.remove(), dur+delay+200);
  }
}

function runScene(idx){
  const s = scenes[idx];

  let before = 0; for (let k=0;k<idx;k++) before += scenes[k].dur;
  prog.style.transition='none'; prog.style.width=(before/TOTAL*100)+'%'; void prog.offsetWidth;
  prog.style.transition=`width ${s.dur}ms linear`; prog.style.width=((before+s.dur)/TOTAL*100)+'%';

  $$('.scene').forEach(el => el.classList.remove('on'));
  $$('.clickring,.clickdot').forEach(e => e.remove());
  bgfx.classList.toggle('on', !!s.bg);

  if (s.full){
    phoneStage.classList.remove('in');
    mouseShow(false);
    miniBrand.classList.toggle('show', s.id === 's-value' || !!s.bg);
    setStep(null); setCap(null);
    const el = $('#'+s.id); void el.offsetWidth; el.classList.add('on');
  } else {
    miniBrand.classList.add('show');
    if (s.reset) resetAll();
    phoneStage.classList.add('in');
    setStep(s.step[0], s.step[1]);
    setCap(s.cap);
  }

  if (s.run) s.run();
  later(()=> runScene((idx+1) % scenes.length), s.dur);
}

if (CLEAN){
  const css = document.createElement('style');
  css.textContent = '.display,.sub,.tl,.wm,#s-cta h2,.step-tag .lbl,.cap,#s-stat .lab,#s-timer .tl2{visibility:hidden!important;}';
  document.head.appendChild(css);
}

/* ---------------- Mode export MP4 ---------------- */
if (RENDER){
  const css = document.createElement('style');
  css.textContent = `
    html,body{padding:0!important;gap:0!important;margin:0!important;background:#fff!important;overflow:hidden!important;}
    .controls{display:none!important;}
    .stage{width:100vw!important;height:100vh!important;max-height:none!important;
           aspect-ratio:auto!important;border-radius:0!important;box-shadow:none!important;}`;
  document.head.appendChild(css);
}

function start(){
  clearTimers(); Sfx.resume();
  $$('.confetti,.clickring,.clickdot').forEach(e => e.remove());
  SFX_LOG.length = 0;
  resetAll();
  T0 = Date.now();
  runScene(0);
}
$('#replay').addEventListener('click', start);

/* API utilisée par tools/render-video.js */
window.__begin     = start;
window.__TOTAL     = TOTAL;
window.__sfxLog    = () => SFX_LOG;
window.__renderWav = (log, durSec) => Sfx.renderWav(log, durSec);

/* En temps virtuel, une animation créée pendant la capture n'obtient jamais de
   startTime (Chrome l'attend d'une vraie frame) et resterait figée. On l'amorce
   nous-mêmes sur la timeline courante, à chaque image. */
window.__fixAnims = () => {
  const now = document.timeline.currentTime;
  let n = 0;
  for (const a of document.getAnimations()){
    if (a.startTime === null){ try { a.startTime = now; n++; } catch(_){} }
  }
  return n;
};

buildStatChart();
resetAll();
$('#s-brand').classList.add('on');
