/* =====================================================================
   BARBER TYCOON 3D — Arbest Arcade
   Three.js r128 (chargé par ton main.js quand needs3D: true) + interface DOM.

   Lancement :   startBarber()        // appelé par openGame() (initFn: 'startBarber')
   Fermeture :   _barberCleanup()     // détecté et appelé par stopAllGames()

   - Se cale exactement sur #game-canvas (gabarit invisible) : ta mise en page,
     ton plein écran mobile et le redimensionnement de la fenêtre sont suivis.
   - Respecte le bouton SON du site (window.soundEnabled) et enregistre le record
     (updateHighScore) = argent total gagné.
   - Une tête 3D, ~2600 mèches en instances, mèches qui tombent avec physique,
     fauteuil pivotant (flèches / A-D / boutons / clic droit), caméra qui s'adapte.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const backOut = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const smooth = (t) => t * t * (3 - 2 * t);
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR') + ' €';
  const TAU = Math.PI * 2;
  const FONT = '"Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

  /* ------------------------------------------------------------- constantes */
  const SAVE_KEY = 'arbest_barber_tycoon_v1';
  const K = 0.01;                          // 1 "px" de longueur de mèche = 0.01 unité 3D
  const HR = { x: 0.96, y: 1.18, z: 1.05 }; // rayons de la tête (ellipsoïde)
  const HEAD_Y = 1.95;                     // hauteur du centre de la tête
  const CAPE_PTS = [[0.42, 0.9], [0.6, 0.84], [1.0, 0.7], [1.15, 0.46], [1.25, 0.14], [1.3, -0.02]];
  const CAPE_R = 1.3, CAPE_SX = 1.2, CAPE_SZ = 0.95;   // profil normalisé, étiré en largeur (épaules)
  const CLIP_LV = [2, 6, 11, 17, 24];
  const SCI_LV = [26, 34, 42, 52];

  const SKINS = ['#f6d2b5', '#eebf9a', '#d9a173', '#b97b50', '#8a5636', '#5a3622'];
  const HAIRS = [
    { c: ['#5a3a24', '#4a2e1c', '#33200f'] },
    { c: ['#2a2a30', '#1d1d22', '#111114'] },
    { c: ['#ecd07c', '#e3c36b', '#c79e45'] },
    { c: ['#c95b2a', '#b5481f', '#8f3512'] },
    { c: ['#d2d5da', '#b9bcc2', '#8e929a'] },
    { c: ['#5a9bff', '#2e7bff', '#1d55c4'], rare: true },
    { c: ['#ff86be', '#ff5fa8', '#d63a86'], rare: true },
    { c: ['#6ee08f', '#3ec96a', '#229a48'], rare: true }
  ];
  const NAMES = ['Léa', 'Hugo', 'Inès', 'Maxime', 'Jade', 'Lucas', 'Camille', 'Nathan', 'Zoé', 'Tom', 'Manon', 'Enzo', 'Sarah', 'Yanis', 'Chloé', 'Théo', 'Lina', 'Sacha', 'Emma', 'Mehdi', 'Lola', 'Rayan', 'Eva', 'Jules'];

  /* Styles : t(x, y, z) = longueur voulue (px). x = gauche/droite, y = -hauteur (haut = -1), z = avant/arrière */
  const STYLES = [
    { id: 'fade', name: 'Dégradé', price: 30, unlock: 0, say: 'Un dégradé bien net, s\'il te plaît !',
      t: (x, y) => { if (Math.abs(x) <= 0.45) return 34; const g = (-y - 0.09) / 0.4; return Math.min(34, Math.max(2, 2 + g * 18)); } },
    { id: 'buzz', name: 'Brosse courte', price: 18, unlock: 0, say: 'Une brosse courte et propre.', t: () => 6 },
    { id: 'bald', name: 'Tout rasé', price: 24, unlock: 5, say: 'Tout à zéro. Je suis prêt.', t: () => 2 },
    { id: 'crew', name: 'Coupe militaire', price: 34, unlock: 10, say: 'Coupe militaire, comme papa.', t: (x, y) => (Math.abs(x) > 0.6 || y > -0.25 ? 6 : 17) },
    { id: 'trim', name: 'Mi-longs', price: 40, unlock: 16, say: 'Juste rafraîchir les longueurs.', t: () => 42 },
    { id: 'under', name: 'Undercut', price: 55, unlock: 25, say: 'Côté gauche rasé, le reste long. Rebelle !', t: (x) => (x < -0.15 ? 2 : 40) },
    { id: 'bowl', name: 'Coupe au bol', price: 50, unlock: 32, say: 'Coupe au bol. Ne me juge pas.', t: (x, y) => (y > -0.33 ? 2 : 34) },
    { id: 'mohawk', name: 'Crête punk', price: 80, unlock: 42, say: 'Une crête ! Je veux être un punk !', t: (x) => (Math.abs(x) < 0.26 ? 52 : 2) },
    { id: 'pomp', name: 'Banane rockabilly', price: 100, unlock: 55, say: 'Le grand banane, façon rockabilly.',
      t: (x, y, z) => (Math.abs(x) < 0.65 && y < -0.3 ? (y < -0.55 && z > -0.2 ? 52 : 42) : 4) }
  ];

  const ITEMS = [
    { id: 'c1', cat: 'c', name: 'Tondeuse rouillée', price: 0, r: 20, col: '#9aa0a6', ic: '⚡', desc: 'Fait le job. Doucement.' },
    { id: 'c2', cat: 'c', name: 'Tondeuse Pro', price: 150, r: 28, col: '#e0463c', ic: '⚡', desc: 'Lame plus large, moteur costaud.' },
    { id: 'c3', cat: 'c', name: 'Turbo X', price: 600, r: 36, col: '#2a7fd6', ic: '⚡', desc: 'Ça tond vite. Très vite.' },
    { id: 'c4', cat: 'c', name: 'Tondeuse dorée', price: 2200, r: 46, col: '#e1b04a', ic: '✨', desc: 'Des étincelles à chaque passage.' },
    { id: 'c5', cat: 'c', name: 'Laser 9000', price: 7500, r: 58, col: '#17d6e8', ic: '🔷', desc: 'La lame la plus large du quartier.' },
    { id: 's1', cat: 's', name: 'Ciseaux rouillés', price: 0, r: 12, col: '#9aa0a6', ic: '✂️', desc: 'Petits, précis, un peu lents.', rate: 0.15 },
    { id: 's2', cat: 's', name: 'Ciseaux en acier', price: 120, r: 16, col: '#c9d2dc', ic: '✂️', desc: 'Des snips plus rapides.', rate: 0.12 },
    { id: 's3', cat: 's', name: 'Ciseaux précision', price: 500, r: 21, col: '#6fb7ff', ic: '✂️', desc: 'Lames japonaises, snip nerveux.', rate: 0.095 },
    { id: 's4', cat: 's', name: 'Ciseaux diamant', price: 1800, r: 27, col: '#d98cff', ic: '💎', desc: 'Ils coupent comme du beurre.', rate: 0.075 },
    { id: 'r1', cat: 'r', name: 'Rasoir coupe-chou', price: 250, r: 12, col: '#c9d2dc', ic: '🪒', desc: 'Rase à blanc. Attention aux oreilles.' },
    { id: 'r2', cat: 'r', name: 'Rasoir électrique', price: 1200, r: 18, col: '#7ee0a0', ic: '🪒', desc: 'Large, silencieux, impitoyable.' },
    { id: 'ch1', cat: 'ch', name: 'Chaise de cuisine', price: 0, mult: 1, col: '#8a5a38', ic: '🪑', desc: 'Pas très confortable…' },
    { id: 'ch2', cat: 'ch', name: 'Fauteuil confort', price: 300, mult: 1.15, col: '#c0392b', ic: '🛋️', desc: 'Les clients restent plus longtemps.' },
    { id: 'ch3', cat: 'ch', name: 'Cuir vintage', price: 1500, mult: 1.35, col: '#6b3b22', ic: '💺', desc: 'Le vrai fauteuil de barbier.' },
    { id: 'ch4', cat: 'ch', name: 'Trône royal', price: 6000, mult: 1.7, col: '#e1b04a', ic: '👑', desc: 'Ils paient pour s\'asseoir dessus.' },
    { id: 'd5', cat: 'd', name: 'Plantes vertes', price: 120, mult: 1.04, col: '#3ec96a', ic: '🪴', desc: 'Un salon plus accueillant.' },
    { id: 'd1', cat: 'd', name: 'Miroir doré', price: 250, mult: 1.06, col: '#e1b04a', ic: '🪞', desc: 'Grand miroir au mur.' },
    { id: 'd2', cat: 'd', name: 'Enseigne néon', price: 600, mult: 1.08, col: '#ff4fa0', ic: '💡', desc: 'BARBER en lettres lumineuses.' },
    { id: 'd4', cat: 'd', name: 'Robot aspirateur', price: 400, mult: 1, col: '#9aa0a6', ic: '🤖', desc: 'Nettoie le sol tout seul après chaque client.' },
    { id: 'd3', cat: 'd', name: 'Lustre en cristal', price: 2500, mult: 1.12, col: '#bfe6ff', ic: '🔆', desc: 'Le salon des stars.' }
  ];
  const ITEM = {}; ITEMS.forEach((i) => (ITEM[i.id] = i));
  const TABS = [['c', 'Tondeuses'], ['s', 'Ciseaux'], ['r', 'Rasoirs'], ['ch', 'Fauteuils'], ['d', 'Déco']];

  /* Zone de cheveux : au-dessus de cette hauteur (ey) on a des cheveux */
  function hairMin(ex, ez) {
    const front = 0.47 - 0.47 * ex * ex, t = smooth(clamp(-ez / 0.6, 0, 1));
    return lerp(front, -0.22, t);
  }
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(TAU * Math.random());

  /* Racines des mèches (calculées une seule fois) */
  const BASE = (function () {
    const a = []; let tries = 0;
    while (a.length < 4200 && tries < 150000) {
      tries++;
      let x = gauss(), y = gauss(), z = gauss(); const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      if (y < -0.35 || y < hairMin(x, z) + 0.01) continue;
      let nx = x / HR.x, ny = y / HR.y, nz = z / HR.z; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      a.push({ ex: x, ey: y, ez: z, x: x * HR.x, y: y * HR.y, z: z * HR.z, nx, ny, nz, jx: rnd(-0.24, 0.24), jy: rnd(-0.1, 0.1), jz: rnd(-0.24, 0.24), bx: rnd(-1, 1), bz: rnd(-1, 1), sh: (Math.random() * 3) | 0 });
    }
    return a;
  })();
  const N = BASE.length;

  /* ====================================================================== */
  function start(host) {
    if (global._barberCleanup) { try { global._barberCleanup(); } catch (e) { /* ignore */ } }

    // cible : #game-canvas du site (sert de gabarit de taille) ou un conteneur passé en argument
    let ph = null;
    if (!host) host = document.getElementById('game-canvas') || document.getElementById('game-container') || document.body;
    if (host.tagName === 'CANVAS') { ph = host; host = ph.parentElement || document.body; }
    const prevPos = host.style.position, prevVis = ph ? ph.style.visibility : '';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (ph) ph.style.visibility = 'hidden';   // visibility (pas display) : le gabarit garde sa taille

    /* ----------------------------------------------------------- sauvegarde */
    const defSave = () => ({ money: 0, rep: 0, served: 0, earned: 0, owned: ['c1', 's1', 'ch1'],
      eq: { c: 'c1', s: 's1', r: null, ch: 'ch1' }, lvl: { c: 1, s: 1, r: 0 }, guide: true, sound: true, best: 0 });
    let S = defSave();
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (raw && typeof raw === 'object') { S = Object.assign(defSave(), raw); S.eq = Object.assign(defSave().eq, raw.eq || {}); S.lvl = Object.assign(defSave().lvl, raw.lvl || {}); }
    } catch (e) { /* ignore */ }
    let saveT = 0;
    const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
    const owns = (id) => S.owned.indexOf(id) >= 0;

    /* ---------------------------------------------------------------- DOM */
    const box = document.createElement('div');
    box.className = 'bt-box';
    box.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:20;overflow:hidden;background:#14202e';
    const glCanvas = document.createElement('canvas');
    const ov = document.createElement('canvas');           // calque 2D : carte de commande, résultats, outil, pièces…
    // !important : le CSS du site (ex. « canvas { background:#000 } ») ne doit jamais masquer la 3D ni déformer nos canvas
    const lockStyle = (el, extra) => {
      const base = { position: 'absolute', left: '0', top: '0', right: 'auto', bottom: 'auto', width: '100%', height: '100%', 'max-width': 'none', 'max-height': 'none',
        margin: '0', padding: '0', border: '0', 'border-radius': '0', 'box-shadow': 'none', background: 'transparent', filter: 'none', 'aspect-ratio': 'auto',
        display: 'block', outline: 'none', opacity: '1', transform: 'none', 'image-rendering': 'auto', '-webkit-user-select': 'none', 'user-select': 'none' };
      Object.keys(base).forEach((k) => el.style.setProperty(k, base[k], 'important'));
      if (extra) Object.keys(extra).forEach((k) => el.style.setProperty(k, extra[k], 'important'));
    };
    lockStyle(glCanvas, { 'z-index': '0' });
    lockStyle(ov, { 'touch-action': 'none', 'z-index': '1' });
    ov.tabIndex = 0;
    box.style.isolation = 'isolate';
    box.setAttribute('data-barber', '1');
    box.appendChild(glCanvas); box.appendChild(ov);
    host.appendChild(box);
    const ctx = ov.getContext('2d');

    const root = document.createElement('div');
    root.className = 'bt-root';
    root.innerHTML =
      '<style>' +
      '.bt-root{position:absolute;inset:0;z-index:5;pointer-events:none;font-family:' + FONT + ';color:#fff;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
      '.bt-root *{box-sizing:border-box}' +
      '.bt-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;padding:8px 10px;align-items:center}' +
      '.bt-sp{flex:1}' +
      '.bt-chip{background:rgba(20,32,46,.86);border:2px solid #e1b04a;border-radius:14px;padding:5px 12px;font-size:16px;white-space:nowrap}' +
      '.bt-chip b{color:#ffd978;font-size:18px}' +
      '.bt-btn{pointer-events:auto;touch-action:manipulation;cursor:pointer;background:rgba(20,32,46,.9);border:2px solid #3b5573;color:#fff;border-radius:12px;padding:7px 11px;font:inherit;font-size:15px;line-height:1.1}' +
      '.bt-btn:active{transform:scale(.94)}' +
      '.bt-btn.on{border-color:#e1b04a;background:#d6334a}' +
      '.bt-btn[disabled]{opacity:.45}' +
      '.bt-left{position:absolute;left:8px;top:58px;display:flex;flex-direction:column;gap:7px;width:104px}' +
      '.bt-left .bt-btn{text-align:left;display:flex;gap:6px;align-items:center;padding:8px 9px}' +
      '.bt-lv{pointer-events:auto;display:flex;align-items:center;justify-content:space-between;gap:4px;background:rgba(20,32,46,.86);border:2px solid #3b5573;border-radius:12px;padding:4px;font-size:13px;text-align:center}' +
      '.bt-lv button{width:30px;height:30px;border-radius:9px;border:0;background:#e1b04a;color:#14202e;font:inherit;font-size:20px;line-height:1;cursor:pointer;touch-action:manipulation}' +
      '.bt-lv span{flex:1;line-height:1.15}' +
      '.bt-bar{height:5px;border-radius:3px;background:#2a3d52;margin-top:3px;overflow:hidden}.bt-bar i{display:block;height:100%;background:#7ee0a0}' +
      '.bt-right{position:absolute;right:8px;bottom:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}' +
      '.bt-rot{position:absolute;left:8px;bottom:12px;display:flex;gap:8px}' +
      '.bt-rot .bt-btn{font-size:22px;padding:8px 14px;touch-action:none}' +
      '.bt-big{font-size:19px;padding:12px 18px;background:#1fa35a;border-color:#8af0b3}' +
      '.bt-toast{position:absolute;left:50%;top:60px;transform:translate(-50%,-14px);background:#14202e;border:2px solid #e1b04a;border-radius:14px;padding:8px 16px;font-size:15px;opacity:0;transition:.25s;text-align:center;max-width:86%}' +
      '.bt-toast.show{opacity:1;transform:translate(-50%,0)}' +
      '.bt-shop{position:absolute;inset:0;background:rgba(8,14,22,.8);display:none;align-items:center;justify-content:center;pointer-events:auto}' +
      '.bt-shop.on{display:flex}' +
      '.bt-pn{width:min(760px,95%);max-height:93%;display:flex;flex-direction:column;background:#14202e;border:3px solid #e1b04a;border-radius:18px;overflow:hidden}' +
      '.bt-hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:2px solid #263a52}.bt-hd h2{margin:0;font-size:20px;flex:1}' +
      '.bt-tabs{display:flex;gap:6px;padding:8px 10px;overflow-x:auto;touch-action:pan-x}' +
      '.bt-tabs .bt-btn{flex:0 0 auto}' +
      '.bt-ls{overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:6px 10px 12px;display:flex;flex-direction:column;gap:8px}' +
      '.bt-it{display:flex;gap:10px;align-items:center;background:#1b2b3f;border:2px solid #2c4562;border-radius:14px;padding:8px}' +
      '.bt-ic{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;flex:0 0 auto}' +
      '.bt-in{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.bt-in span{font-size:13px;opacity:.8}.bt-in i{font-size:12px;color:#ffd978;font-style:normal}' +
      '.bt-it .bt-btn{flex:0 0 auto;min-width:104px;background:#1fa35a;border-color:#8af0b3}' +
      '.bt-it .bt-btn.eq{background:#2a3d52;border-color:#3b5573}.bt-it .bt-btn.cant{background:#3a2a2a;border-color:#6b4545}' +
      '.bt-root.cp .bt-left{width:auto;top:46px;gap:5px}.bt-root.cp .bt-left .bt-btn em{display:none}.bt-root.cp .bt-lv{flex-direction:column;font-size:11px}.bt-root.cp .bt-lv button{width:26px;height:26px;font-size:17px}.bt-root.cp .bt-chip{padding:3px 8px;font-size:13px}.bt-root.cp .bt-chip b{font-size:15px}.bt-root.cp .bt-btn{padding:6px 9px;font-size:13px}.bt-root.cp .bt-big{font-size:15px;padding:9px 13px}.bt-root.cp .bt-top{padding:5px 6px;gap:5px}.bt-root.cp .bt-toast{top:44px;font-size:13px}.bt-root.cp .bt-it .bt-btn{min-width:84px}.bt-root.cp .bt-rot .bt-btn{font-size:18px;padding:6px 11px}' +
      '</style>' +
      '<div class="bt-top">' +
      '<div class="bt-chip" data-id="money">💶 <b>0 €</b></div>' +
      '<div class="bt-chip" data-id="rep">⭐ <b>0</b></div>' +
      '<div class="bt-sp"></div>' +
      '<button class="bt-btn" data-act="shop">🛒 Boutique</button>' +
      '<button class="bt-btn" data-act="guide" data-id="guide">💡</button>' +
      '<button class="bt-btn" data-act="sound" data-id="sound">🔊</button>' +
      '<button class="bt-btn" data-act="fs">⛶</button>' +
      '</div>' +
      '<div class="bt-left">' +
      '<button class="bt-btn" data-act="tool:c" data-id="t-c">⚡<em>Tondeuse</em></button>' +
      '<button class="bt-btn" data-act="tool:s" data-id="t-s">✂️<em>Ciseaux</em></button>' +
      '<button class="bt-btn" data-act="tool:r" data-id="t-r">🪒<em>Rasoir</em></button>' +
      '<div class="bt-lv"><button data-act="lvl:-1">−</button><span data-id="lvl">Sabot 2<div class="bt-bar"><i></i></div></span><button data-act="lvl:1">+</button></div>' +
      '</div>' +
      '<div class="bt-rot"><button class="bt-btn" data-hold="-1" title="Tourner le fauteuil">⟲</button><button class="bt-btn" data-hold="1" title="Tourner le fauteuil">⟳</button></div>' +
      '<div class="bt-right">' +
      '<button class="bt-btn" data-act="broom" data-id="broom">🧹 Balai</button>' +
      '<button class="bt-btn bt-big" data-act="done" data-id="done">Terminé ✓</button>' +
      '</div>' +
      '<div class="bt-toast" data-id="toast"></div>' +
      '<div class="bt-shop" data-id="shop"><div class="bt-pn">' +
      '<div class="bt-hd"><h2>🛒 Boutique du salon</h2><div class="bt-chip" data-id="smoney">0 €</div><button class="bt-btn" data-act="close">✕</button></div>' +
      '<div class="bt-tabs" data-id="tabs"></div><div class="bt-ls" data-id="list"></div>' +
      '</div></div>';
    box.appendChild(root);
    const $ = (id) => root.querySelector('[data-id="' + id + '"]');
    const elMoney = $('money').firstElementChild, elRep = $('rep').firstElementChild, elDone = $('done'), elLvl = $('lvl');
    const elToast = $('toast'), elShop = $('shop'), elList = $('list'), elTabs = $('tabs'), elSMoney = $('smoney');

    /* --------------------------------------------------------------- audio */
    let AC = null, master = null, buzzG = null, o1 = null, o2 = null, noiseBuf = null, lastTick = 0;
    const snd = () => S.sound && global.soundEnabled !== false;   // bouton SON du site + bouton du jeu
    function initAudio() {
      if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
      try {
        AC = new (global.AudioContext || global.webkitAudioContext)();
        master = AC.createGain(); master.gain.value = snd() ? 0.55 : 0; master.connect(AC.destination);
        buzzG = AC.createGain(); buzzG.gain.value = 0;
        const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
        o1 = AC.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 110;
        o2 = AC.createOscillator(); o2.type = 'square'; o2.frequency.value = 223;
        const g2 = AC.createGain(); g2.gain.value = 0.35;
        o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(buzzG); buzzG.connect(master);
        o1.start(); o2.start();
        noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { AC = null; }
    }
    function tone(f, dur, vol, type, f2, delay) {
      if (!AC || !snd()) return;
      const t0 = AC.currentTime + (delay || 0);
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function noise(freq, q, dur, vol, type, delay) {
      if (!AC || !snd() || !noiseBuf) return;
      const t0 = AC.currentTime + (delay || 0);
      const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = AC.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
    }
    const sfx = {
      snip() { noise(5200, 0.8, 0.06, 0.2, 'highpass'); tone(2300, 0.035, 0.05, 'square', 1500); },
      crunch() { noise(2600, 1.2, 0.04, 0.09, 'bandpass'); },
      bell() { tone(988, 0.5, 0.12, 'sine'); tone(1480, 0.6, 0.09, 'sine', 0, 0.12); },
      coin() { tone(1250, 0.09, 0.07, 'square'); tone(1880, 0.16, 0.07, 'square', 0, 0.07); },
      star(i) { tone(520 * Math.pow(1.19, i), 0.25, 0.14, 'triangle'); },
      ouch() { tone(520, 0.3, 0.14, 'sawtooth', 160); },
      buy() { tone(660, 0.1, 0.1, 'triangle'); tone(880, 0.1, 0.1, 'triangle', 0, 0.09); tone(1320, 0.2, 0.1, 'triangle', 0, 0.18); },
      sweep() { noise(900, 0.5, 0.9, 0.22, 'bandpass'); },
      bad() { tone(300, 0.35, 0.14, 'sawtooth', 110); tone(220, 0.4, 0.12, 'sawtooth', 80, 0.15); },
      pop() { tone(700, 0.08, 0.08, 'sine', 1100); }
    };

    /* ----------------------------------------------------------- état du jeu */
    let cw = 600, ch = 400, dpr = 1, uiS = 1, alive = true, raf = 0, last = 0, T = 0, frameN = 0;
    let phase = 'enter', pt = 0;                 // enter | cut | result | leave
    let cust = null, res = null;
    let tool = 'c', pDown = false, hasPtr = false, rotDrag = false;
    let px = 0, py = 0, lx = 0, ly = 0, pvx = 0, pvy = 0, vib = 0, snipT = 0, snipAnim = 0;
    let flow = 0, cutTotal = 0, moodT = 0, accLive = 0, overLive = 0, dispMoney = S.money, coinsDone = false;
    let sweep = null, shopTab = 'c', shopOpen = false, toastT = 0, lastHud = '';
    let ang = 0, angVel = 0, rotKey = 0, shk = 0;
    const fx = [];
    let THREE = global.THREE, renderer = null, scene = null, camera = null;
    let rig, swivel, head, headMat, hairMesh, guidePts, fallMesh, floorMesh, capeMesh, chairGroup, sweeper, poleTex, neonMat, ground;
    const len = new Float32Array(N), tgt = new Float32Array(N), gcol = new Float32Array(N * 3);
    let hairDirty = false, guideDirty = false, bendArr, bendAttr, irisCanvas, irisTex, lidMat, eyes = [], glassesG;
    let faceCanvas = null, faceCtx = null, baseCanvas = null, faceTex = null, faceKey = '', faceT = 0;
    let thumb = null;
    let falls = [], floorN = 0, floorX = new Float32Array(3600), capeN = 0, capeList = [], floorCount = 0;
    const FALL_MAX = 480, FLOOR_MAX = 3600, CAPE_MAX = 900;
    let _m, _q, _p, _s, _d, _up, _v, _c, _raycaster, _ndc, _inv;
    let camDist = 6.6, camTx = 0, camLookY = 1.85, ppu = 100, infoSide = false, infoU = 1;
    let ro = null, lastBox = '';

    /* ---------------------------------------------------------- mise à l'échelle */
    function resize() {
      cw = Math.max(200, box.clientWidth || 600); ch = Math.max(160, box.clientHeight || 400);
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      ov.width = Math.round(cw * dpr); ov.height = Math.round(ch * dpr);
      root.classList.toggle('cp', cw < 720 || ch < 460);
      uiS = clamp(Math.min(cw / 640, ch / 430), 0.62, 1.35);
      const cp = cw < 720 || ch < 460;
      infoSide = cw >= 760 && cw / ch > 1.25;                       // grande fenêtre : carte à droite ; sinon carte compacte en haut
      infoU = infoSide ? Math.min(uiS, 1.15) : Math.min(uiS, (cw - 16) / (cp ? 330 : 360));
      if (renderer) {
        renderer.setPixelRatio(Math.min(dpr, 1.75));
        renderer.setSize(cw, ch, false);
        const reserveL = cp ? 64 : 118, reserveR = infoSide ? 360 * infoU + 22 : 0;
        const topR = infoSide ? 50 : 50 + (cp ? 62 : 110) * infoU + 6;
        const availW = Math.max(120, cw - reserveL - reserveR - 12), availH = Math.max(120, ch - topR - 6);
        const tv = Math.tan(20 * Math.PI / 180);
        const pp = Math.max(30, Math.min(availW / 3.7, availH / 4.1));       // pixels par unité 3D : la tête + les cheveux tiennent toujours
        camera.aspect = cw / ch; camera.fov = 40;
        camDist = Math.max(4.5, ch / (2 * tv * pp));
        const xc = reserveL + (cw - reserveL - reserveR) / 2, yc = topR + availH / 2;
        camTx = (cw / 2 - xc) / pp;
        camLookY = 2.0 + (yc - ch / 2) / pp;
        camera.updateProjectionMatrix();
      }
    }
    function layout() {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      const inFs = !!(fsEl && fsEl.contains(box));
      let css;
      if (inFs) css = 'position:fixed;left:0;top:0;width:100vw;height:100vh;';
      else if (ph) {
        const pr = ph.getBoundingClientRect(), hr = host.getBoundingClientRect();
        if (pr.width < 40 || pr.height < 40) css = 'position:absolute;left:0;top:0;width:100%;height:' + Math.max(300, host.clientHeight) + 'px;';
        else css = 'position:absolute;left:' + (pr.left - hr.left - host.clientLeft + host.scrollLeft) + 'px;top:' + (pr.top - hr.top - host.clientTop + host.scrollTop) + 'px;width:' + pr.width + 'px;height:' + pr.height + 'px;';
      } else css = 'position:absolute;left:0;top:0;width:100%;height:' + Math.max(300, host.clientHeight) + 'px;';
      if (ph && !inFs) { try { css += 'border-radius:' + getComputedStyle(ph).borderRadius + ';'; } catch (e) { /* ignore */ } }
      if (css !== lastBox) { lastBox = css; box.style.cssText = css + 'z-index:20;overflow:hidden;background:#14202e;isolation:isolate'; resize(); }
    }

    /* ======================================================================
       SCÈNE 3D
       ====================================================================== */
    const L = (hex) => new THREE.Color(hex).convertSRGBToLinear();        // couleur « écran » -> linéaire (rendu correct)
    function canvasTex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
    }
    const M = (o) => {
      if (typeof o.color === 'string') o.color = L(o.color);
      if (typeof o.emissive === 'string') o.emissive = L(o.emissive);
      return new THREE.MeshStandardMaterial(o);
    };

    function buildScene() {
      scene = new THREE.Scene();
      scene.background = L('#1d3f44');
      scene.fog = new THREE.Fog(L('#1d3f44'), 12, 26);
      camera = new THREE.PerspectiveCamera(40, cw / ch, 0.1, 60);
      _m = new THREE.Matrix4(); _q = new THREE.Quaternion(); _p = new THREE.Vector3(); _s = new THREE.Vector3();
      _d = new THREE.Vector3(); _up = new THREE.Vector3(0, 1, 0); _v = new THREE.Vector3(); _c = new THREE.Color();
      _raycaster = new THREE.Raycaster(); _ndc = new THREE.Vector2(); _inv = new THREE.Matrix4();

      // lumières
      scene.add(new THREE.HemisphereLight(L('#fff6e5'), L('#47606a'), 0.8));
      const sun = new THREE.DirectionalLight(L('#fff4e6'), 1.35);
      sun.position.set(3.2, 7, 6); sun.target.position.set(0, 1.8, 0);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 5; sc.bottom = -2; sc.near = 1; sc.far = 20; sun.shadow.bias = -0.0008; sc.updateProjectionMatrix();
      scene.add(sun); scene.add(sun.target);
      const rim = new THREE.DirectionalLight(L('#7fd8ff'), 0.6); rim.position.set(-5, 4, -4); scene.add(rim);
      const warm = new THREE.PointLight(L('#ffb866'), 0.9, 14); warm.position.set(-3.5, 4.2, 3); scene.add(warm);

      // sol damier
      const floorTex = canvasTex(512, 512, (g, w, h) => {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#e8eee9' : '#1f2c3a'; g.fillRect(x * w / 8, y * h / 8, w / 8, h / 8); }
      });
      floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 4);
      ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), M({ map: floorTex, roughness: 0.35, metalness: 0.05 }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 3); ground.receiveShadow = true; scene.add(ground);

      // mur du fond
      const wallTex = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#2b625f'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.05)';
        for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
      });
      wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(10, 3);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), M({ map: wallTex, roughness: 0.9 }));
      wall.position.set(0, 6, -5); wall.receiveShadow = true; scene.add(wall);
      const wains = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 0.2), M({ color: '#16393a', roughness: 0.8 }));
      wains.position.set(0, 1, -4.95); scene.add(wains);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 0.3), M({ color: '#e1b04a', roughness: 0.35, metalness: 0.5 }));
      rail.position.set(0, 2.05, -4.9); scene.add(rail);

      // fenêtre
      const winF = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.1, 0.15), M({ color: '#e1b04a', roughness: 0.4, metalness: 0.5 }));
      winF.position.set(-5.2, 3.7, -4.9); scene.add(winF);
      const skyTex = canvasTex(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fd3ff'); gr.addColorStop(1, '#e3f5ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.8), new THREE.MeshBasicMaterial({ map: skyTex }));
      glass.position.set(-5.2, 3.7, -4.8); scene.add(glass);
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.1), M({ color: '#e1b04a' })); bar1.position.set(-5.2, 3.7, -4.75); scene.add(bar1);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.8, 0.1), M({ color: '#e1b04a' })); bar2.position.set(-5.2, 3.7, -4.75); scene.add(bar2);

      // étagère + flacons
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.6), M({ color: '#6b4a30', roughness: 0.7 }));
      shelf.position.set(4.3, 3.0, -4.6); shelf.castShadow = true; scene.add(shelf);
      const bc = ['#d6334a', '#2a7fd6', '#3ec96a', '#e1b04a', '#b86bff'];
      for (let i = 0; i < 5; i++) {
        const h = 0.55 + (i % 2) * 0.2;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, h, 14), M({ color: bc[i], roughness: 0.25, metalness: 0.2 }));
        b.position.set(3.4 + i * 0.45, 3.06 + h / 2, -4.6); b.castShadow = true; scene.add(b);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10), M({ color: '#f2f2f2' })); cap.position.set(3.4 + i * 0.45, 3.06 + h + 0.07, -4.6); scene.add(cap);
      }

      // poteau de barbier
      poleTex = canvasTex(64, 256, (g, w, h) => {
        g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h);
        for (let i = -2; i < 6; i++) { g.fillStyle = i % 2 ? '#d6334a' : '#2a5db0'; g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64 + 32); g.lineTo(w, i * 64 + 64); g.lineTo(0, i * 64 + 32); g.fill(); }
      });
      poleTex.wrapS = poleTex.wrapT = THREE.RepeatWrapping; poleTex.repeat.set(1, 3);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.6, 24), M({ map: poleTex, roughness: 0.25 }));
      pole.position.set(6.2, 2.3, -4.2); pole.castShadow = true; scene.add(pole);
      for (const yy of [0.45, 4.15]) { const capP = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 20), M({ color: '#e1b04a', roughness: 0.3, metalness: 0.5 })); capP.position.set(6.2, yy, -4.2); scene.add(capP); }

      // affiche (ou miroir si acheté)
      if (owns('d1')) {
        const fr = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 40), M({ color: '#e1b04a', roughness: 0.25, metalness: 0.5 }));
        fr.rotation.x = Math.PI / 2; fr.scale.set(1, 1, 1.45); fr.position.set(-2.6, 3.9, -4.85); scene.add(fr);
        const mir = new THREE.Mesh(new THREE.CircleGeometry(1, 40), M({ color: '#bfe3f2', roughness: 0.05, metalness: 0.5, emissive: '#35586a', emissiveIntensity: 0.35 }));
        mir.scale.set(1, 1.4, 1); mir.position.set(-2.6, 3.9, -4.77); scene.add(mir);
      } else {
        const post = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.08), M({ color: '#e8dcc0', roughness: 0.9 })); post.position.set(-2.8, 3.8, -4.85); scene.add(post);
        const ptex = canvasTex(128, 170, (g, w, h) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#d6334a'; g.font = 'bold 80px sans-serif'; g.textAlign = 'center'; g.fillText('✂', w / 2, 90); g.fillStyle = '#14202e'; g.font = 'bold 20px sans-serif'; g.fillText('COUPES', w / 2, 135); });
        const pp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.9), new THREE.MeshBasicMaterial({ map: ptex })); pp.position.set(-2.8, 3.8, -4.8); scene.add(pp);
      }
      // néon
      if (owns('d2')) {
        const ntex = canvasTex(512, 128, (g, w, h) => { g.font = 'bold 96px "Arial Rounded MT Bold",sans-serif'; g.textAlign = 'center'; g.shadowColor = '#ff4fa0'; g.shadowBlur = 30; g.fillStyle = '#ffd0e8'; g.fillText('BARBER', w / 2, 98); g.fillText('BARBER', w / 2, 98); });
        neonMat = new THREE.MeshBasicMaterial({ map: ntex, transparent: true, depthWrite: false });
        const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), neonMat); neon.position.set(1.6, 4.9, -4.7); scene.add(neon);
        const nl = new THREE.PointLight('#ff4fa0', 0.5, 7); nl.position.set(1.6, 4.5, -3.5); scene.add(nl);
      }
      // lustre
      if (owns('d3')) {
        const ch3 = new THREE.Group(); ch3.position.set(3.4, 5.2, -1.2);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), M({ color: '#e1b04a', metalness: 0.5, roughness: 0.3 })); chain.position.y = 0.7; ch3.add(chain);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 28), M({ color: '#e1b04a', metalness: 0.5, roughness: 0.25 })); ring.rotation.x = Math.PI / 2; ch3.add(ring);
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU, cr = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 5), M({ color: '#cfeeff', emissive: '#9fd8ff', emissiveIntensity: 0.9, roughness: 0.1 }));
          cr.rotation.x = Math.PI; cr.position.set(Math.cos(a) * 0.7, -0.2, Math.sin(a) * 0.7); ch3.add(cr);
        }
        const cl = new THREE.PointLight(L('#cfeeff'), 0.8, 10); cl.position.y = -0.3; ch3.add(cl);
        scene.add(ch3);
      }
      // plantes
      if (owns('d5')) {
        for (const x of [-6.2, 7.0]) {
          const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.7, 14), M({ color: '#b5683a', roughness: 0.8 })); pot.position.set(x, 0.35, -3.2); pot.castShadow = true; scene.add(pot);
          for (let i = 0; i < 7; i++) {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), M({ color: i % 2 ? '#2f9e55' : '#3ec96a', roughness: 0.7 }));
            leaf.scale.set(0.5, 1.5, 0.5); leaf.position.set(x + Math.cos(i * 0.9) * 0.28, 1.2 + (i % 3) * 0.15, -3.2 + Math.sin(i * 0.9) * 0.28);
            leaf.rotation.set(Math.sin(i) * 0.5, 0, Math.cos(i * 1.7) * 0.5); leaf.castShadow = true; scene.add(leaf);
          }
        }
      }
      // balai / robot
      sweeper = new THREE.Group(); sweeper.visible = false; scene.add(sweeper);

      /* --- rig client : chaise + cape + tête --- */
      rig = new THREE.Group(); scene.add(rig);
      swivel = new THREE.Group(); rig.add(swivel);
      buildChair();

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.5, 24), M({ color: '#d9a173', roughness: 0.6 }));
      neck.position.y = 1.0; neck.castShadow = true; swivel.add(neck); swivel.userData.neck = neck;
      // cape : tissu avec plis, épaules plus larges que la poitrine
      const capeTex = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#2f64b8'; g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, 0, 10, h); }
        for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,' + (0.03 + 0.03 * ((y * 7) % 5) / 5) + ')'; g.fillRect(0, y, w, 1); }
      });
      const capeGeo = new THREE.LatheGeometry(CAPE_PTS.map((p) => new THREE.Vector2(p[0], p[1])).reverse(), 72);
      {
        const pa = capeGeo.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), t = clamp((0.9 - y) / 0.9, 0, 1);
          const f = 1 + t * (0.05 * Math.sin(a * 11 + y * 2.5) + 0.03 * Math.sin(a * 5 - y * 1.7) + 0.015 * Math.sin(a * 23));
          pa.setXYZ(i, Math.cos(a) * r * f, y, Math.sin(a) * r * f);
        }
        capeGeo.computeVertexNormals();
      }
      const cape = new THREE.Mesh(capeGeo, M({ map: capeTex, roughness: 0.82, side: THREE.DoubleSide }));
      cape.scale.set(CAPE_SX, 1, CAPE_SZ); cape.castShadow = true; cape.receiveShadow = true; swivel.add(cape);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.07, 12, 40), M({ color: '#f4f4f4', roughness: 0.6 }));
      collar.rotation.x = Math.PI / 2; collar.position.y = 0.9; collar.scale.set(1.08, 1, 0.88); swivel.add(collar);
      // ombre de contact au sol
      const shTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const csh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
      csh.rotation.x = -Math.PI / 2; csh.position.y = 0.006; rig.add(csh);

      // tête : sphère remodelée (mâchoire, menton, pommettes) + texture visage + grain de peau
      head = new THREE.Group(); head.position.y = HEAD_Y; swivel.add(head);
      faceCanvas = document.createElement('canvas'); faceCanvas.width = 1024; faceCanvas.height = 512; faceCtx = faceCanvas.getContext('2d');
      baseCanvas = document.createElement('canvas'); baseCanvas.width = 512; baseCanvas.height = 256;
      faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.anisotropy = 8; faceTex.encoding = THREE.sRGBEncoding;
      const poreC = document.createElement('canvas'); poreC.width = 512; poreC.height = 256;
      { const g = poreC.getContext('2d'), im = g.createImageData(512, 256);
        for (let i = 0; i < 512 * 256; i++) { const v = 128 + (Math.random() - 0.5) * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
        g.putImageData(im, 0, 0); }
      const poreTex = new THREE.CanvasTexture(poreC);
      headMat = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.55, bumpMap: poreTex, bumpScale: 0.35 });
      const hgeo = new THREE.SphereGeometry(1, 64, 48);
      {
        const pa = hgeo.attributes.position, WS = 64, HS = 48;
        for (let i = 0; i < pa.count; i++) {
          let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          const j = smooth(clamp((0.05 - y) / 0.95, 0, 1)), wf = smooth(clamp((z + 0.15) / 0.55, 0, 1));
          x *= 1 - 0.2 * j * (0.55 + 0.45 * wf);                         // mâchoire plus étroite
          z *= 1 - 0.05 * j * wf;
          if (y < -0.45 && z > 0) z += 0.07 * j * wf;                    // menton
          x *= 1 + 0.045 * Math.exp(-Math.pow((y + 0.3) / 0.22, 2)) * wf; // pommettes
          pa.setXYZ(i, x, y, z);
        }
        hgeo.computeVertexNormals();
        const na = hgeo.attributes.normal;                               // couture : même normale des deux côtés
        for (let r = 0; r <= HS; r++) {
          const i0 = r * (WS + 1), i1 = i0 + WS, nx = (na.getX(i0) + na.getX(i1)) / 2, ny = (na.getY(i0) + na.getY(i1)) / 2, nz = (na.getZ(i0) + na.getZ(i1)) / 2;
          na.setXYZ(i0, nx, ny, nz); na.setXYZ(i1, nx, ny, nz);
        }
      }
      const headMesh = new THREE.Mesh(hgeo, headMat);
      headMesh.scale.set(HR.x, HR.y, HR.z); headMesh.castShadow = true; headMesh.receiveShadow = true; head.add(headMesh);
      head.userData.skinMats = [];
      const skinM = (rough) => { const m = M({ color: '#d9a173', roughness: rough || 0.62 }); head.userData.skinMats.push(m); return m; };
      for (const sx of [-1, 1]) {   // oreilles (pavillon + creux)
        const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skinM(0.65));
        ear.scale.set(0.085, 0.22, 0.14); ear.position.set(sx * HR.x * 0.995, -0.06 * HR.y, -0.04); ear.rotation.z = sx * 0.12; ear.castShadow = true; head.add(ear);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), M({ color: '#a8643f', roughness: 0.8 }));
        inner.scale.set(0.04, 0.12, 0.08); inner.position.set(sx * (HR.x * 0.995 + 0.045), -0.06 * HR.y, -0.02); head.add(inner);
      }
      // nez : arête, bout, ailes
      const nb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skinM()); nb.scale.set(0.05, 0.17, 0.065); nb.position.set(0, -0.2, 1.0); nb.castShadow = true; head.add(nb);
      const nt = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skinM()); nt.scale.set(0.085, 0.075, 0.085); nt.position.set(0, -0.37, 1.04); nt.castShadow = true; head.add(nt);
      for (const sx of [-1, 1]) { const al = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), skinM()); al.scale.set(0.055, 0.05, 0.06); al.position.set(sx * 0.075, -0.385, 1.01); head.add(al); }
      // yeux 3D : globe + iris, paupières qui clignent, regard qui suit la souris
      irisCanvas = document.createElement('canvas'); irisCanvas.width = 256; irisCanvas.height = 128;
      irisTex = new THREE.CanvasTexture(irisCanvas); irisTex.encoding = THREE.sRGBEncoding;
      const eyeMat = new THREE.MeshPhysicalMaterial({ map: irisTex, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
      lidMat = M({ color: '#d9a173', roughness: 0.6 }); head.userData.skinMats.push(lidMat);
      eyes = [];
      for (const sx of [-1, 1]) {
        const g = new THREE.Group(); g.position.set(sx * 0.345, -0.083, 0.9); head.add(g);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), eyeMat); g.add(ball);
        const lid = new THREE.Mesh(new THREE.SphereGeometry(0.123, 24, 14, 0, TAU, 0, Math.PI / 2), lidMat); lid.rotation.x = -1.3; lid.castShadow = true; g.add(lid);
        eyes.push({ ball, lid });
      }
      // lunettes
      glassesG = new THREE.Group();
      { const gm = M({ color: '#1a1a1e', roughness: 0.25 });
        for (const sx of [-1, 1]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.017, 10, 36), gm); ring.position.set(sx * 0.345, -0.083, 1.06); glassesG.add(ring);
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 6), gm); arm.rotation.x = Math.PI / 2; arm.position.set(sx * 0.545, -0.06, 0.55); glassesG.add(arm);
        }
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6), gm); br.rotation.z = Math.PI / 2; br.position.set(0, -0.06, 1.07); glassesG.add(br); }
      glassesG.visible = false; head.add(glassesG);

      // mèches (instances) : fines, courbes, racines assombries
      const hg = new THREE.CylinderGeometry(0.006, 0.022, 1, 5, 5); hg.translate(0, 0.5, 0);
      bendArr = new Float32Array(N * 2); bendAttr = new THREE.InstancedBufferAttribute(bendArr, 2); hg.setAttribute('aBend', bendAttr);
      const hairMat = M({ color: '#ffffff', roughness: 0.48, metalness: 0.02 });
      hairMat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec2 aBend; varying float vH;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y; transformed.x += aBend.x * position.y * position.y; transformed.z += aBend.y * position.y * position.y;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vH;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.28, 1.0, smoothstep(0.0, 0.6, vH));');
      };
      hairMesh = new THREE.InstancedMesh(hg, hairMat, N);
      hairMesh.frustumCulled = false; hairMesh.castShadow = true;
      for (let i = 0; i < N; i++) hairMesh.setColorAt(i, _c.set('#ffffff'));
      head.add(hairMesh);

      // points-guide (vert / orange / rouge)
      const pg = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), nr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const b = BASE[i];
        pos[i * 3] = b.x + b.nx * 0.02; pos[i * 3 + 1] = b.y + b.ny * 0.02; pos[i * 3 + 2] = b.z + b.nz * 0.02;
        nr[i * 3] = b.nx; nr[i * 3 + 1] = b.ny; nr[i * 3 + 2] = b.nz;
      }
      pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pg.setAttribute('nrm', new THREE.BufferAttribute(nr, 3));
      pg.setAttribute('gc', new THREE.BufferAttribute(gcol, 3));
      guidePts = new THREE.Points(pg, new THREE.ShaderMaterial({
        transparent: true, depthTest: false, depthWrite: false,
        uniforms: { uPx: { value: 8 } },
        vertexShader: 'attribute vec3 nrm; attribute vec3 gc; uniform float uPx; varying vec3 vC; varying float vF;' +
          'void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vec3 wn = normalize(mat3(modelMatrix) * nrm);' +
          'vF = smoothstep(0.02, 0.3, dot(wn, normalize(cameraPosition - wp.xyz))); vC = gc;' +
          'vec4 mv = viewMatrix * wp; gl_PointSize = uPx * (6.0 / max(0.5, -mv.z)); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec3 vC; varying float vF; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5 || vF < 0.02) discard; float a = (vC.r > 0.9) ? 0.85 : 0.28; gl_FragColor = vec4(vC, a * vF * (1.0 - smoothstep(0.3, 0.5, r))); }'
      }));
      guidePts.frustumCulled = false; guidePts.renderOrder = 10; head.add(guidePts);

      // pièces de cheveux : en chute (monde), posées au sol (monde), posées sur la cape (repère fauteuil)
      const pgeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 4, 1); pgeo.translate(0, 0.5, 0);
      const pmat = M({ color: '#ffffff', roughness: 0.7 });
      fallMesh = new THREE.InstancedMesh(pgeo, pmat, FALL_MAX); fallMesh.frustumCulled = false; fallMesh.count = 0;
      floorMesh = new THREE.InstancedMesh(pgeo, pmat, FLOOR_MAX); floorMesh.frustumCulled = false; floorMesh.count = 0;
      capeMesh = new THREE.InstancedMesh(pgeo, pmat, CAPE_MAX); capeMesh.frustumCulled = false; capeMesh.count = 0;
      for (const m of [fallMesh, floorMesh, capeMesh]) for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, _c.set('#ffffff'));
      scene.add(fallMesh); scene.add(floorMesh); swivel.add(capeMesh);
    }

    function buildChair() {
      if (chairGroup) { swivel.remove(chairGroup); chairGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
      const it = ITEM[S.eq.ch], g = new THREE.Group(); chairGroup = g;
      const col = it.col, dark = L(col).multiplyScalar(0.7);
      const mat = M({ color: col, roughness: it.id === 'ch3' ? 0.35 : 0.7, metalness: it.id === 'ch4' ? 0.7 : 0.05 });
      const matD = M({ color: dark, roughness: 0.7, metalness: it.id === 'ch4' ? 0.6 : 0.05 });
      const chrome = M({ color: '#cfd6dd', roughness: 0.25, metalness: 0.5 });
      const add = (geo, m, x, y, z, rx) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
      add(new THREE.CylinderGeometry(0.9, 1.0, 0.1, 28), chrome, 0, 0.05, 0);
      add(new THREE.CylinderGeometry(0.2, 0.28, 0.45, 16), chrome, 0, 0.3, 0);
      add(new THREE.BoxGeometry(1.5, 0.2, 1.4), mat, 0, 0.42, 0.1);               // assise (sous la cape)
      add(new THREE.BoxGeometry(1.8, 0.8, 0.28), mat, 0, 0.95, -1.15);            // dossier bas : laisse la nuque visible de dos
      if (it.id === 'ch4') {
        add(new THREE.BoxGeometry(2.0, 0.9, 0.26), matD, 0, 1.1, -1.35);
        const gold = M({ color: '#e1b04a', metalness: 0.5, roughness: 0.25 });
        for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.16, 12, 10), gold, sx * 1.0, 1.6, -1.35);
        for (let i = -2; i <= 2; i++) add(new THREE.ConeGeometry(0.1, 0.3 + (i === 0 ? 0.15 : 0), 5), gold, i * 0.38, 1.7 + (i === 0 ? 0.07 : 0), -1.35);
      }
      for (const sx of [-1, 1]) {
        add(new THREE.BoxGeometry(0.26, 0.14, 1.2), matD, sx * 1.08, 0.98, 0.05);  // accoudoir
        add(new THREE.BoxGeometry(0.14, 0.55, 0.14), chrome, sx * 1.08, 0.7, 0.55);
      }
      if (it.id === 'ch3') for (let i = -3; i <= 3; i++) add(new THREE.SphereGeometry(0.035, 8, 6), M({ color: '#e1b04a', metalness: 0.5, roughness: 0.3 }), i * 0.24, 1.2, -0.99);
      add(new THREE.BoxGeometry(1.0, 0.1, 0.5), chrome, 0, 0.18, 1.0, 0.0);        // repose-pieds
      swivel.add(g);
    }

    /* --------------------------------------------------------------- mèches */
    function dirOf(i, Lpx, out) {
      const b = BASE[i], d = Lpx / 60, g = d * d * 0.55;
      return out.set(b.nx + b.jx, b.ny + 0.12 + b.jy - g, b.nz + b.jz).normalize();
    }
    function setStrand(i) {
      const L = len[i] * K, b = BASE[i];
      if (L < 0.006) _s.set(0, 0, 0); else _s.set(1, L, 1);
      dirOf(i, len[i], _d); _q.setFromUnitVectors(_up, _d); _p.set(b.x, b.y, b.z);
      bendArr[i * 2] = b.bx * L * 0.45; bendArr[i * 2 + 1] = b.bz * L * 0.45;
      _m.compose(_p, _q, _s); hairMesh.setMatrixAt(i, _m); hairDirty = true;
    }
    function setGuide(i) {
      const d = len[i] - tgt[i], tol = 4 + 0.12 * tgt[i];
      if (d > tol) { gcol[i * 3] = 1; gcol[i * 3 + 1] = 0.69; gcol[i * 3 + 2] = 0.12; }
      else if (d < -tol) { gcol[i * 3] = 1; gcol[i * 3 + 1] = 0.3; gcol[i * 3 + 2] = 0.3; }
      else { gcol[i * 3] = 0.3; gcol[i * 3 + 1] = 0.85; gcol[i * 3 + 2] = 0.4; }
      guideDirty = true;
    }

    /* ------------------------------------------------------------ le visage */
    function buildBase(c) {
      const bx = baseCanvas.getContext('2d'), W = 512, Hh = 256;
      bx.fillStyle = c.skin; bx.fillRect(0, 0, W, Hh);
      const img = bx.getImageData(0, 0, W, Hh), dta = img.data;
      const sk = parseInt(c.skin.slice(1), 16), hc = parseInt(c.hair.c[2].slice(1), 16);
      const sr = (sk >> 16) & 255, sg = (sk >> 8) & 255, sb = sk & 255, hr = (hc >> 16) & 255, hg2 = (hc >> 8) & 255, hb = hc & 255;
      for (let y = 0; y < Hh; y++) {
        const th = (y + 0.5) / Hh * Math.PI, ey = Math.cos(th), sn = Math.sin(th);
        for (let x = 0; x < W; x++) {
          const phi = (x + 0.5) / W * TAU, ex = -Math.cos(phi) * sn, ez = Math.sin(phi) * sn;
          const o = (y * W + x) * 4;
          const inZone = ey > hairMin(ex, ez) && ey > -0.35;
          const a = inZone ? 0.26 : 0;
          dta[o] = sr + (hr - sr) * a; dta[o + 1] = sg + (hg2 - sg) * a; dta[o + 2] = sb + (hb - sb) * a; dta[o + 3] = 255;
        }
      }
      bx.putImageData(img, 0, 0);
    }
    function fp(ex, ey) {
      const sn = Math.sqrt(Math.max(1e-4, 1 - ey * ey)), phi = Math.acos(clamp(-ex / sn, -1, 1)), th = Math.acos(clamp(ey, -1, 1));
      return { X: phi / TAU * 1024, Y: th / Math.PI * 512, sx: 1024 / (TAU * sn * Math.max(0.25, Math.sin(phi))), sy: 512 / (Math.PI * sn) };
    }
    function at(g, ex, ey, fn) { const p = fp(ex, ey); g.save(); g.translate(p.X, p.Y); g.scale(p.sx, p.sy); fn(); g.restore(); }

    function paintFace(c, mood, blink) {
      const g = faceCtx, ink = '#1e232b';
      g.clearRect(0, 0, 1024, 512); g.drawImage(baseCanvas, 0, 0, 1024, 512);
      g.lineCap = 'round'; g.lineJoin = 'round';
      // joues, taches de rousseur
      if (mood === 'happy' || mood === 'cry') for (const sx of [-1, 1]) at(g, sx * 0.56, -0.34, () => { g.fillStyle = 'rgba(255,90,110,.28)'; g.beginPath(); g.ellipse(0, 0, 0.13, 0.07, 0, 0, TAU); g.fill(); });
      if (c.freckles) at(g, 0, -0.2, () => { g.fillStyle = 'rgba(120,60,30,.5)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc((i % 2 ? 1 : -1) * (0.3 + (i * 0.037) % 0.22), (i * 0.021) % 0.1 - 0.02, 0.012, 0, TAU); g.fill(); } });
      // orbites (les yeux sont en 3D)
      for (const sx of [-1, 1]) at(g, sx * 0.36, -0.06, () => {
        const gr = g.createRadialGradient(0, 0, 0.06, 0, 0, 0.3); gr.addColorStop(0, 'rgba(90,40,30,0)'); gr.addColorStop(0.6, 'rgba(90,40,30,.17)'); gr.addColorStop(1, 'rgba(90,40,30,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 0.3, 0.22, 0, 0, TAU); g.fill();
      });
      if (mood === 'cry') for (const sx of [-1, 1]) at(g, sx * 0.36, -0.07, () => {
        const f = (T * 1.6 + (sx > 0 ? 0.4 : 0)) % 1; g.fillStyle = 'rgba(120,195,255,.9)'; g.fillRect(-0.025, 0.1, 0.05, 0.3 * f); g.beginPath(); g.arc(0, 0.11 + 0.3 * f, 0.04, 0, TAU); g.fill();
      });
      // sourcils
      const bc = c.hair.rare ? '#3a2a20' : c.hair.c[2];
      for (const sx of [-1, 1]) at(g, sx * 0.36, 0.14, () => {
        let yi = 0, yo = 0, ym = -0.04;
        if (mood === 'worry') { yi = -0.1; yo = 0.04; ym = -0.05; }
        if (mood === 'angry') { yi = 0.08; yo = -0.08; ym = 0.0; }
        if (mood === 'happy') { yi = -0.06; yo = -0.04; ym = -0.12; }
        if (mood === 'ouch') { yi = 0.06; yo = -0.02; ym = 0.02; }
        g.strokeStyle = bc; g.lineWidth = 0.062; g.beginPath(); g.moveTo(sx * 0.12, yo); g.quadraticCurveTo(0, ym, -sx * 0.12, yi); g.stroke();
      });
      // bouche
      at(g, 0, -0.58, () => {
        g.lineWidth = 0.035; g.strokeStyle = '#7a2230'; g.fillStyle = '#6d1626';
        if (mood === 'happy') { g.beginPath(); g.moveTo(-0.2, -0.03); g.quadraticCurveTo(0, 0.26, 0.2, -0.03); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-0.18, -0.02); g.quadraticCurveTo(0, 0.05, 0.18, -0.02); g.lineTo(0.16, 0.025); g.quadraticCurveTo(0, 0.09, -0.16, 0.025); g.fill(); }
        else if (mood === 'worry') { g.beginPath(); g.moveTo(-0.14, 0); for (let i = 0; i <= 6; i++) g.lineTo(-0.14 + i * 0.047, i % 2 ? -0.025 : 0.025); g.stroke(); }
        else if (mood === 'angry') { g.beginPath(); g.moveTo(-0.17, 0.06); g.quadraticCurveTo(0, -0.08, 0.17, 0.06); g.stroke(); }
        else if (mood === 'cry') { g.beginPath(); g.ellipse(0, 0.04, 0.12, 0.09 + Math.sin(T * 14) * 0.015, 0, 0, TAU); g.fill(); }
        else if (mood === 'ouch') { g.beginPath(); g.ellipse(0, 0.04, 0.085, 0.12, 0, 0, TAU); g.fill(); }
        else {
          g.fillStyle = 'rgba(170,78,88,.92)'; g.beginPath(); g.moveTo(-0.15, 0.012); g.quadraticCurveTo(-0.07, -0.05, 0, -0.02); g.quadraticCurveTo(0.07, -0.05, 0.15, 0.012); g.quadraticCurveTo(0, 0.035, -0.15, 0.012); g.fill();
          g.fillStyle = 'rgba(196,98,108,.95)'; g.beginPath(); g.moveTo(-0.14, 0.012); g.quadraticCurveTo(0, 0.105, 0.14, 0.012); g.quadraticCurveTo(0, 0.035, -0.14, 0.012); g.fill();
          g.strokeStyle = 'rgba(80,25,35,.75)'; g.lineWidth = 0.013; g.beginPath(); g.moveTo(-0.15, 0.012); g.quadraticCurveTo(0, 0.04, 0.15, 0.012); g.stroke(); }
      });
      faceTex.needsUpdate = true;
    }

    /* ------------------------------------------------------------- clients */
    function makeCustomer() {
      const avail = STYLES.filter((s) => S.rep >= s.unlock);
      const style = pick(avail);
      const hair = Math.random() < 0.15 ? pick(HAIRS.filter((h) => h.rare)) : pick(HAIRS.filter((h) => !h.rare));
      return { name: pick(NAMES), skin: pick(SKINS), hair, style, mood: 'neutral', glasses: Math.random() < 0.25, freckles: Math.random() < 0.2,
        seed: rnd(0, 3000), nicks: 0, ouchT: 0, time: 0, cuts: 0, lookX: 0, lookY: 0, cols: hair.c.map((h) => L(h)), iris: pick(['#5a3a24', '#3b7a57', '#3a6ea5', '#7a6a2a', '#4a4036']) };
    }

    function renderThumb(c) {
      const t = document.createElement('canvas'); t.width = 130; t.height = 140; const g = t.getContext('2d');
      const s = 40, ox = 65, oy = 70;
      g.fillStyle = c.skin; g.beginPath(); g.ellipse(ox - HR.x * s, oy + 4, 5, 10, 0, 0, TAU); g.ellipse(ox + HR.x * s, oy + 4, 5, 10, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(ox, oy, HR.x * s, HR.y * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#1e232b'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(ox + sx * 14, oy + 4, 3.5, 4.6, 0, 0, TAU); g.fill(); }
      g.strokeStyle = '#7a2230'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 8, oy + 28); g.quadraticCurveTo(ox, oy + 34, ox + 8, oy + 28); g.stroke();
      g.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        g.lineWidth = pass ? 1.7 : 3;
        for (let sh = 0; sh < 3; sh++) {
          g.strokeStyle = pass ? c.hair.c[sh] : c.hair.c[2]; g.beginPath();
          for (let i = 0; i < N; i++) {
            const b = BASE[i]; if (b.sh !== sh || b.ez < -0.1) continue;
            const L = tgt[i]; if (L < 0.8) continue;
            dirOf(i, L, _d);
            g.moveTo(ox + b.x * s, oy - b.y * s); g.lineTo(ox + (b.x + _d.x * L * K) * s, oy - (b.y + _d.y * L * K) * s);
          }
          g.stroke();
        }
      }
      return t;
    }

    function nextCustomer() {
      cust = makeCustomer(); res = null; phase = 'enter'; pt = 0;
      const st = cust.style, start0 = rnd(60, 68);
      for (let i = 0; i < N; i++) {
        const b = BASE[i];
        len[i] = start0 * rnd(0.94, 1.04); tgt[i] = st.t(b.ex, -b.ey, b.ez);
        hairMesh.setColorAt(i, cust.cols[b.sh]);
        setStrand(i); setGuide(i);
      }
      hairMesh.instanceColor.needsUpdate = true; hairMesh.instanceMatrix.needsUpdate = true; bendAttr.needsUpdate = true; guidePts.geometry.attributes.gc.needsUpdate = true; hairDirty = guideDirty = false;
      const sc = L(cust.skin);
      headMat.needsUpdate = true;
      const sm = L(cust.skin).multiplyScalar(0.93);
      head.userData.skinMats.forEach((m) => m.color.copy(sm));
      lidMat.color.copy(L(cust.skin)); glassesG.visible = !!cust.glasses; paintIris(cust.iris);   // paupières = même teinte que le visage
      swivel.userData.neck.material.color.copy(sc).multiplyScalar(0.85);
      buildBase(cust); faceKey = ''; paintFaceIfNeeded(true);
      thumb = renderThumb(cust);
      // cape propre
      capeN = 0; capeMesh.count = 0; capeList = [];
      ang = -TAU; angVel = 0; rig.position.x = 9;
      sfx.bell(); cutTotal = 0; flow = 0; accLive = 0; overLive = 0; coinsDone = false; shopOpen = false; elShop.classList.remove('on');
    }

    function paintIris(col) {
      const g = irisCanvas.getContext('2d'); g.fillStyle = '#f3efe8'; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = 'rgba(200,90,90,.18)'; g.lineWidth = 1; for (let i = 0; i < 14; i++) { const a = rnd(0, TAU), r0 = 34 + rnd(0, 20); g.beginPath(); g.moveTo(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24); g.lineTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); g.stroke(); }
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 22); gr.addColorStop(0, col); gr.addColorStop(0.75, col); gr.addColorStop(1, '#14100e');
      g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 22, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.2; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.beginPath(); g.moveTo(64 + Math.cos(a) * 9, 64 + Math.sin(a) * 9); g.lineTo(64 + Math.cos(a) * 19, 64 + Math.sin(a) * 19); g.stroke(); }
      g.fillStyle = '#070606'; g.beginPath(); g.arc(64, 64, 8.5, 0, TAU); g.fill();
      irisTex.needsUpdate = true;
    }
    function paintFaceIfNeeded(force) {
      const key = cust.mood + '|' + (cust.mood === 'cry' ? Math.floor(T * 8) : 0);
      if (!force && key === faceKey) return;
      faceKey = key; paintFace(cust, cust.mood, false);
    }

    /* --------------------------------------------------- caméra & lancer de rayon */
    function updateCamera() {
      const sway = Math.sin(T * 0.35) * 0.12, par = hasPtr ? (px / cw - 0.5) * 0.4 : 0;
      camera.position.set(camTx + sway + par, camLookY + 1.6, camDist);
      camera.lookAt(camTx, camLookY + (hasPtr ? (0.5 - py / ch) * 0.12 : 0), 0);
      camera.updateMatrixWorld(true);
      const hd = camera.position.distanceTo(_v.set(0, HEAD_Y, 0));
      ppu = ch / (2 * Math.tan(camera.fov * Math.PI / 360) * hd);
    }
    let Ox, Oy, Oz, Dx, Dy, Dz, tHit, tLim, hx, hy, hz;
    function castLocal(sx, sy) {
      _ndc.set(sx / cw * 2 - 1, -(sy / ch) * 2 + 1);
      _raycaster.setFromCamera(_ndc, camera);
      const o = _raycaster.ray.origin, d = _raycaster.ray.direction;
      _v.copy(o).applyMatrix4(_inv); Ox = _v.x; Oy = _v.y; Oz = _v.z;
      _v.copy(d).transformDirection(_inv); Dx = _v.x; Dy = _v.y; Dz = _v.z;
      // intersection avec l'ellipsoïde de la tête (légèrement gonflé)
      const rx = HR.x * 1.03, ry = HR.y * 1.03, rz = HR.z * 1.03;
      const ox = Ox / rx, oy = Oy / ry, oz = Oz / rz, dx = Dx / rx, dy = Dy / ry, dz = Dz / rz;
      const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz), c = ox * ox + oy * oy + oz * oz - 1, disc = b * b - 4 * a * c;
      tLim = -(Ox * Dx + Oy * Dy + Oz * Dz) + 0.05;   // plan du centre de la tête (si on rate l'ellipsoïde)
      if (disc < 0) { tHit = -1; return; }
      tHit = (-b - Math.sqrt(disc)) / (2 * a); tLim = tHit + 0.18;
      hx = (Ox + Dx * tHit) / HR.x; hy = (Oy + Dy * tHit) / HR.y; hz = (Oz + Dz * tHit) / HR.z;
    }
    function rayDist2(X, Y, Z) {   // distance² du point au rayon, + profondeur
      const vx = X - Ox, vy = Y - Oy, vz = Z - Oz, s = vx * Dx + vy * Dy + vz * Dz;
      const qx = vx - Dx * s, qy = vy - Dy * s, qz = vz - Dz * s;
      rayDist2.s = s; return qx * qx + qy * qy + qz * qz;
    }

    /* ---------------------------------------------------------------- pièces */
    function spawnPiece(i, lv, old) {
      if (falls.length >= FALL_MAX) return;
      const delta = old - lv, t = rnd(0.3, 1), Lp = (lv + delta * t) * K, b = BASE[i];
      dirOf(i, lv + delta * t, _d);
      _v.set(b.x + _d.x * Lp, b.y + _d.y * Lp, b.z + _d.z * Lp); head.localToWorld(_v);
      falls.push({ x: _v.x, y: _v.y, z: _v.z, vx: rnd(-0.35, 0.35) + pvx * 0.0007, vy: rnd(0.2, 0.9), vz: rnd(-0.1, 0.5),
        ax: rnd(0, TAU), ay: rnd(0, TAU), avx: rnd(-6, 6), avy: rnd(-6, 6), l: Math.max(0.03, Math.min(delta * rnd(0.5, 1) * K, 0.26)),
        col: cust.cols[b.sh], ph: rnd(0, TAU), sl: false, nc: false });
    }
    function lay(mesh, idx, x, y, z, a, l, col, yaw) {
      _d.set(Math.cos(a), rnd(0, 0.15), Math.sin(a)).normalize(); _q.setFromUnitVectors(_up, _d);
      _p.set(x, y, z); _s.set(1, l, 1); _m.compose(_p, _q, _s); mesh.setMatrixAt(idx, _m); mesh.setColorAt(idx, col);
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    }
    const capeY = (r) => {
      if (r >= CAPE_R) return -9;
      if (r <= CAPE_PTS[0][0]) return CAPE_PTS[0][1];
      for (let i = 1; i < CAPE_PTS.length; i++) if (r <= CAPE_PTS[i][0]) { const a = CAPE_PTS[i - 1], b = CAPE_PTS[i]; return lerp(a[1], b[1], (r - a[0]) / (b[0] - a[0])); }
      return -9;
    };

    function updatePieces(dt) {
      swivel.updateMatrixWorld(true);
      for (let i = falls.length - 1; i >= 0; i--) {
        const p = falls[i];
        if (p.sl) {
          // glisse le long de la cape
          _v.set(p.x, p.y, p.z); swivel.worldToLocal(_v);
          const nx0 = _v.x / CAPE_SX, nz0 = _v.z / CAPE_SZ, r = Math.hypot(nx0, nz0) + 0.5 * dt, a = Math.atan2(nz0, nx0);
          _v.set(Math.cos(a) * r * CAPE_SX, capeY(r) + 0.012, Math.sin(a) * r * CAPE_SZ); swivel.localToWorld(_v);
          p.x = _v.x; p.y = _v.y; p.z = _v.z; p.ax += p.avx * dt;
          if (r >= CAPE_R) { p.sl = false; p.nc = true; p.vy = -0.2; p.vx = 0; p.vz = 0; }
          continue;
        }
        p.vy -= 9 * dt; p.vx += Math.sin(p.ph + T * 7) * 0.9 * dt; p.vz += Math.cos(p.ph + T * 6) * 0.9 * dt;
        p.vx *= 1 - 0.9 * dt; p.vz *= 1 - 0.9 * dt; if (p.vy < -3.2) p.vy = -3.2;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.ax += p.avx * dt; p.ay += p.avy * dt;
        {   // ne traverse pas la tête : glisse autour du crâne
          const hxw = rig.position.x, dy = p.y - HEAD_Y, ddx = p.x - hxw, ddz = p.z;
          if (dy > -1.25 && dy < 1.25) {
            const k2 = (ddx * ddx) / (1.0 * 1.0) + (dy * dy) / (1.22 * 1.22) + (ddz * ddz) / (1.08 * 1.08);
            if (k2 < 1) { const rr0 = Math.hypot(ddx, ddz) || 0.01, rxz = 1.02 * Math.sqrt(Math.max(0, 1 - (dy * dy) / (1.22 * 1.22))) + 0.03; p.x = hxw + ddx / rr0 * rxz; p.z = ddz / rr0 * rxz; p.vx = ddx / rr0 * 0.3; p.vz = ddz / rr0 * 0.3; }
          }
        }
        let remove = false;
        if (!p.nc && phase !== 'enter' && p.vy < 0) {
          _v.set(p.x, p.y, p.z); swivel.worldToLocal(_v);
          const r = Math.hypot(_v.x / CAPE_SX, _v.z / CAPE_SZ), cy = capeY(r);
          if (r < CAPE_R && _v.y <= cy + 0.01 && _v.y > cy - 0.5) {
            if (Math.random() < 0.6 && capeN < 1e9) {
              const idx = capeN % CAPE_MAX; capeN++; capeMesh.count = Math.min(capeN, CAPE_MAX);
              lay(capeMesh, idx, _v.x, cy + 0.01, _v.z, rnd(0, TAU), p.l, p.col);
              capeList.push({ x: _v.x, y: cy + 0.01, z: _v.z, l: p.l, col: p.col }); if (capeList.length > 450) capeList.shift();
              remove = true;
            } else { p.sl = true; }
          }
        }
        if (!remove && !p.sl && p.y <= 0.012) {
          const idx = floorN % FLOOR_MAX; floorX[idx] = p.x; floorN++; floorMesh.count = Math.min(floorN, FLOOR_MAX); floorCount++;
          lay(floorMesh, idx, p.x, 0.012, p.z, rnd(0, TAU), p.l, p.col); remove = true;
        }
        if (remove) { falls[i] = falls[falls.length - 1]; falls.pop(); }
      }
      // matrices des pièces en chute
      const n = falls.length; fallMesh.count = n;
      for (let i = 0; i < n; i++) {
        const p = falls[i];
        _d.set(Math.cos(p.ax) * Math.cos(p.ay), Math.sin(p.ax), Math.sin(p.ay) * Math.cos(p.ax)).normalize(); _q.setFromUnitVectors(_up, _d);
        _p.set(p.x, p.y, p.z); _s.set(1, p.l, 1); _m.compose(_p, _q, _s); fallMesh.setMatrixAt(i, _m); fallMesh.setColorAt(i, p.col);
      }
      if (n) { fallMesh.instanceMatrix.needsUpdate = true; fallMesh.instanceColor.needsUpdate = true; }
    }

    function dust() {
      swivel.updateMatrixWorld(true);
      const n = Math.min(capeList.length, 150);
      for (let i = 0; i < n && falls.length < FALL_MAX; i++) {
        const c = capeList[(Math.random() * capeList.length) | 0];
        _v.set(c.x, c.y, c.z); swivel.localToWorld(_v);
        falls.push({ x: _v.x, y: _v.y + 0.05, z: _v.z, vx: rnd(-1, 1), vy: rnd(0.5, 1.6), vz: rnd(-0.2, 1.1), ax: rnd(0, TAU), ay: rnd(0, TAU), avx: rnd(-8, 8), avy: rnd(-8, 8), l: c.l, col: c.col, ph: rnd(0, TAU), sl: false, nc: true });
      }
      capeN = 0; capeMesh.count = 0; capeList = [];
    }

    /* ---------------------------------------------------------------- outils */
    function toolItem() { return ITEM[S.eq[tool]]; }
    function levels() { return tool === 'c' ? CLIP_LV : tool === 's' ? SCI_LV : [0]; }
    function curLen() { const lv = levels(); return lv[clamp(S.lvl[tool], 0, lv.length - 1)]; }

    function cutRay(rw, lv, pw) {
      let n = 0; const r2 = rw * rw, limit = tLim;
      for (let i = 0; i < N; i++) {
        if (len[i] <= lv + 0.4) continue;
        const b = BASE[i], reach = Math.min(len[i] * K * 0.5, 0.26);
        dirOf(i, len[i], _d);
        let hit = false;
        for (let k = 0; k < 3 && !hit; k++) {
          const f = k * 0.5 * reach;
          const d2 = rayDist2(b.x + _d.x * f, b.y + _d.y * f, b.z + _d.z * f);
          if (d2 <= r2 && rayDist2.s > 0 && rayDist2.s <= limit) hit = true;
        }
        if (!hit) continue;
        const old = len[i]; len[i] = lv; n++;
        setStrand(i); setGuide(i);
        if (Math.random() < pw) spawnPiece(i, lv, old);
      }
      return n;
    }

    function sparks(x, y, n, col) {
      for (let i = 0; i < n && fx.length < 320; i++) {
        const a = rnd(0, TAU), v = rnd(40, 200);
        fx.push({ k: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: rnd(0.25, 0.6), r: rnd(1.5, 3.2), col });
      }
    }
    function floatText(x, y, s, col, size) { fx.push({ k: 'txt', x, y, vy: -46, t: 0, life: 1.2, s, col: col || '#fff', size: size || 24 }); }
    function headScreen() {
      _v.set(0, HEAD_Y + 0.2, 0.9); swivel.localToWorld(_v); _v.project(camera);
      return { x: (_v.x * 0.5 + 0.5) * cw, y: (-_v.y * 0.5 + 0.5) * ch };
    }
    function nick(x, y) {
      cust.nicks++; cust.ouchT = 0.9; shk = 0.5; cust.mood = 'ouch';
      const hs = headScreen(); floatText(hs.x + rnd(-30, 30), hs.y - 10, 'Aïe !', '#ff7a7a', 30 * uiS);
      sparks(x, y, 10, '#ff8a8a'); sfx.ouch();
      if (navigator.vibrate) navigator.vibrate(60);
    }
    function skinZone() {   // le dernier rayon touche-t-il de la peau (visage, oreille, nuque) ?
      if (tHit < 0) return false;
      const ex = hx, ey = hy, ez = hz;
      if (ey < -0.9) return false;
      if (Math.abs(ex) > 0.88 && Math.abs(ey + 0.06) < 0.26 && Math.abs(ez) < 0.4) return true;   // oreilles
      return ey < hairMin(ex, ez) - 0.03;
    }

    function updateCutting(dt) {
      const it = toolItem(); if (!it) return;
      const rw = it.r * K, lv = curLen(), rpx = rw * ppu;
      updateCamera(); head.updateMatrixWorld(true); _inv.copy(head.matrixWorld).invert();
      let n = 0;
      const speed = Math.hypot(pvx, pvy);
      if (tool === 'c' || tool === 'r') {
        const dist = Math.hypot(px - lx, py - ly), steps = Math.max(1, Math.min(14, Math.ceil(dist / Math.max(6, rpx * 0.6))));
        for (let i = 1; i <= steps; i++) { castLocal(lerp(lx, px, i / steps), lerp(ly, py, i / steps)); n += cutRay(rw, lv, 0.5); }
        vib = lerp(vib, 1, 0.3);
      } else {
        snipT -= dt;
        if (snipT <= 0) {
          snipT = it.rate; snipAnim = 1; castLocal(px, py);
          n += cutRay(rw, lv, 0.95);
          sfx.snip(); if (navigator.vibrate && n) navigator.vibrate(8);
        } else castLocal(px, py);
      }
      if (n > 0) {
        hairDirty = true; cutTotal += n; cust.cuts += n; flow = clamp(flow + n * 0.004, 0, 1);
        sparks(px + rnd(-rpx, rpx) * 0.6, py + rnd(-6, 6), Math.min(5, 1 + (n / 14 | 0)), it.id === 'c4' ? '#ffd978' : it.id === 'c5' ? '#17d6e8' : '#ffffff');
        if (it.id === 'c4' && Math.random() < 0.6) sparks(px, py, 2, '#ffe9a8');
        if (T - lastTick > 0.07) { lastTick = T; sfx.crunch(); if (tool !== 's' && navigator.vibrate && Math.random() < 0.2) navigator.vibrate(5); }
      } else if (cust.ouchT <= 0 && (speed > 30 || tool === 's') && skinZone()) nick(px, py);
    }

    function liveStats() {
      let sum = 0, over = 0;
      for (let i = 0; i < N; i++) {
        const d = len[i] - tgt[i], tol = 4 + 0.12 * tgt[i]; let e = 0;
        if (d > tol) e = Math.min(1, (d - tol) / 22); else if (d < -tol) { e = Math.min(1, (-d - tol) / 14); if (-d - tol > 6) over++; }
        sum += e;
      }
      accLive = 1 - sum / N; overLive = over / N;
    }

    function evaluate() {
      liveStats();
      const acc = accLive;
      let stars = acc >= 0.95 ? 5 : acc >= 0.86 ? 4 : acc >= 0.72 ? 3 : acc >= 0.55 ? 2 : acc >= 0.35 ? 1 : 0;
      stars = Math.min(stars, cust.nicks === 0 ? 5 : cust.nicks <= 2 ? 4 : cust.nicks <= 4 ? 3 : 2);
      const st = cust.style, notes = [];
      const salon = (ITEM[S.eq.ch].mult || 1) * ITEMS.filter((i) => i.cat === 'd' && owns(i.id)).reduce((m, i) => m * (i.mult || 1), 1) * (1 + S.rep * 0.004);
      const clean = floorCount < 40 ? 1.08 : floorCount > 450 ? 0.9 : 1;
      let pay = st.price * [0, 0.3, 0.55, 0.8, 1, 1.35][stars] * salon * clean;
      let tip = stars >= 4 ? st.price * 0.25 * (stars - 3) * salon : 0;
      if (stars >= 4 && cust.time < 45) { pay *= 1.15; notes.push('Rapide ⚡ +15 %'); }
      if (!S.guide && stars >= 3) { pay *= 1.25; tip *= 1.25; notes.push('Sans guide +25 %'); }
      if (clean > 1) notes.push('Sol propre +8 %'); else if (clean < 1) notes.push('Sol sale −10 %');
      if (cust.nicks) notes.push(cust.nicks + ' coupure' + (cust.nicks > 1 ? 's' : ''));
      pay = Math.round(pay); tip = Math.round(tip);
      let viral = 0;
      if (stars === 0 && Math.random() < 0.45) { viral = Math.round(rnd(30, 90)); notes.push('Vidéo virale ! 📱'); }
      const msgs = {
        5: ['Parfait !! Exactement ce que je voulais !', 'Waouh, je ne me reconnais plus !', 'Tu es un artiste !'],
        4: ['Super boulot, merci !', 'J\'adore, presque parfait.'],
        3: ['C\'est pas mal du tout.', 'Ça fera l\'affaire !'],
        2: ['Hmm… c\'est un peu bizarre.', 'Ce n\'est pas tout à fait ça…'],
        1: ['Euh… c\'était pas ça du tout.', 'Mes amis vont se moquer de moi.'],
        0: ['MES CHEVEUX !!! 😭', 'Je vais te faire un procès !', 'Pourquoi je suis comme ça ?!']
      };
      const rep = [-6, -2, 0, 1, 2, 4][stars] + (viral ? 3 : 0);
      res = { stars, acc, pay: pay + tip + viral, base: pay, tip, viral, notes, msg: pick(msgs[stars]), rep, newStyles: [] };
      const oldRep = S.rep;
      S.rep = Math.max(0, S.rep + rep); S.served++; S.money += res.pay; S.earned += res.pay; S.best = Math.max(S.best, stars);
      STYLES.forEach((s) => { if (s.unlock > oldRep && s.unlock <= S.rep) res.newStyles.push(s.name); });
      try {
        const sc = document.getElementById('current-score'); if (sc) sc.innerText = S.earned;
        if (typeof updateHighScore === 'function') updateHighScore('barber', S.earned);   // record = argent total gagné
      } catch (e) { /* ignore */ }
      cust.mood = stars >= 4 ? 'happy' : stars === 3 ? 'neutral' : stars === 2 ? 'worry' : stars === 1 ? 'angry' : 'cry';
      save();
    }

    function finishCut() {
      if (phase !== 'cut') return;
      phase = 'result'; pt = 0; pDown = false; coinsDone = false; evaluate();
    }
    function leave() {
      if (phase !== 'result') return;
      phase = 'leave'; pt = 0; dust();
      if (owns('d4')) startSweep(true);
    }

    function startSweep(auto) {
      if (sweep) return;
      sweep = { t: 0, auto: !!auto, last: -9 }; sfx.sweep();
      while (sweeper.children.length) sweeper.remove(sweeper.children[0]);
      if (auto) {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 24), M({ color: '#c9d2dc', roughness: 0.3, metalness: 0.5 })); body.position.y = 0.14; body.castShadow = true; sweeper.add(body);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), M({ color: '#2a3d52' })); top.position.y = 0.27; sweeper.add(top);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: L('#4cd964') })); led.position.set(0.2, 0.31, 0); sweeper.add(led);
      } else {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), M({ color: '#8a5a38' })); handle.position.set(0, 1.2, 0); handle.rotation.z = 0.25; sweeper.add(handle);
        const bh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.28), M({ color: '#e1b04a', roughness: 0.8 })); bh.position.y = 0.12; sweeper.add(bh);
      }
      sweeper.visible = true;
    }

    /* ----------------------------------------------------------- mise à jour */
    function moneyTarget() {
      const r = elMoney.getBoundingClientRect(), b = ov.getBoundingClientRect();
      return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
    }
    function infoRect() {   // emplacement de la carte de commande / du résultat (suit la fenêtre)
      return { side: infoSide, u: infoU };
    }
    function infoPos(w) {
      const u = infoU;
      return infoSide ? { x: cw - w * u - 10, y: 54, u } : { x: (cw - w * u) / 2, y: 48, u };
    }

    function update(dt) {
      T += dt; pt += dt;
      if (hasPtr) { pvx = lerp(pvx, (px - lx) / Math.max(dt, 0.001), 0.35); pvy = lerp(pvy, (py - ly) / Math.max(dt, 0.001), 0.35); }
      if (!cust) nextCustomer();

      // fauteuil pivotant
      if (!rotDrag) { angVel += rotKey * 7 * dt; angVel *= Math.pow(0.05, dt); ang += angVel * dt; }
      if (phase === 'enter') {
        const u = clamp(pt / 1.0, 0, 1); rig.position.x = lerp(9, 0, ease(u)); ang = lerp(-TAU, 0, ease(u)) * 1 + (u >= 1 ? 0 : 0);
        if (u >= 1) { rig.position.x = 0; ang = 0; phase = 'cut'; pt = 0; }
      } else if (phase === 'cut') {
        cust.time += dt;
        if (pDown && hasPtr && !shopOpen && !rotDrag) updateCutting(dt); else { vib = lerp(vib, 0, 0.3); if (hasPtr) { updateCamera(); } }
        moodT -= dt;
        if (moodT <= 0) {
          moodT = 0.3; liveStats();
          if (cust.ouchT > 0) cust.mood = 'ouch';
          else if (overLive > 0.28) cust.mood = 'angry';
          else if (overLive > 0.1) cust.mood = 'worry';
          else cust.mood = accLive > 0.8 ? 'happy' : 'neutral';
        }
      } else if (phase === 'result') {
        if (!coinsDone && pt > 2.0) {
          coinsDone = true;
          const ir = infoPos(infoSide ? 360 : 330), tg = moneyTarget(), n = clamp(Math.round(res.pay / 8), 4, 16);
          for (let i = 0; i < n; i++) fx.push({ k: 'coin', sx: ir.x + 165 * ir.u + rnd(-30, 30), sy: ir.y + 80 * ir.u, x: ir.x + 165 * ir.u, y: ir.y + 80 * ir.u, tx: tg.x, ty: tg.y, t: 0, delay: i * 0.05, dur: 0.7, life: 5 });
          sfx.coin();
        }
        if (pt > 0.5 && pt - dt <= 0.5 && res.stars <= 1) sfx.bad();
        if (pt > 0.3 && pt - dt <= 0.3) for (let i = 0; i < 24; i++) { const hs = headScreen(); sparks(hs.x + rnd(-90, 90), hs.y + rnd(-60, 60), 1, res.stars >= 4 ? '#ffd978' : '#9aa8ba'); }
      } else if (phase === 'leave') {
        const u = clamp(pt / 0.9, 0, 1); rig.position.x = lerp(0, -9, ease(u)); ang += dt * 3 * u;
        if (u >= 1) nextCustomer();
      }
      swivel.rotation.y = ang;
      shk = Math.max(0, shk - dt); head.rotation.y = shk > 0 ? Math.sin(shk * 60) * shk * 0.35 : 0; head.rotation.z = shk > 0 ? Math.sin(shk * 47) * shk * 0.12 : 0;
      cust.ouchT = Math.max(0, cust.ouchT - dt);
      faceT += dt; if (faceT > 0.09) { faceT = 0; paintFaceIfNeeded(false); }

      lx = px; ly = py; flow = Math.max(0, flow - dt * 0.35); vib *= 0.9; snipAnim = Math.max(0, snipAnim - dt * 7);
      scene.updateMatrixWorld(true);
      animEyes(dt);
      updatePieces(dt); updateFx(dt);

      if (hairDirty) { hairMesh.instanceMatrix.needsUpdate = true; bendAttr.needsUpdate = true; hairDirty = false; }
      if (guideDirty) { guidePts.geometry.attributes.gc.needsUpdate = true; guideDirty = false; }
      guidePts.visible = phase === 'cut' && S.guide;
      guidePts.material.uniforms.uPx.value = ch * 0.0058 * Math.min(dpr, 1.75);

      if (sweep) {
        sweep.t += dt / (sweep.auto ? 1.5 : 0.9);
        const p = ease(clamp(sweep.t, 0, 1)), x = lerp(-9, 9, p);
        sweeper.position.set(x, 0, 1.6); if (!sweep.auto) sweeper.rotation.y = Math.sin(T * 25) * 0.15;
        const zero = new THREE.Matrix4().makeScale(0, 0, 0);
        const lim = Math.min(floorN, FLOOR_MAX);
        for (let i = 0; i < lim; i++) if (floorX[i] < x + 0.6 && floorX[i] > -50) { floorMesh.setMatrixAt(i, zero); floorX[i] = -999; }
        floorMesh.instanceMatrix.needsUpdate = true;
        if (Math.random() < 0.5) sparks(cw * (x + 9) / 18, ch * 0.9, 1, '#ffffff');
        if (sweep.t >= 1) { floorN = 0; floorMesh.count = 0; floorCount = 0; sweeper.visible = false; sweep = null; }
      }

      // audio : bourdonnement de la tondeuse
      if (AC && buzzG) {
        master.gain.value = snd() ? 0.55 : 0;
        const on = phase === 'cut' && pDown && hasPtr && (tool === 'c' || tool === 'r') && !shopOpen && !rotDrag;
        const sp = clamp(Math.hypot(pvx, pvy) / 900, 0, 1);
        const base = tool === 'r' ? 170 : 100 + (S.lvl.c || 0) * 2 + (ITEM[S.eq.c] ? ITEM[S.eq.c].r * 0.5 : 0);
        buzzG.gain.setTargetAtTime(on ? 0.07 + 0.05 * sp : 0, AC.currentTime, 0.05);
        o1.frequency.setTargetAtTime(base + sp * 35, AC.currentTime, 0.08);
        o2.frequency.setTargetAtTime((base + sp * 35) * 2.03, AC.currentTime, 0.08);
      }

      poleTex.offset.y = (poleTex.offset.y - dt * 0.18) % 1;
      if (neonMat) neonMat.opacity = Math.sin(T * 3) > -0.92 ? 1 : 0.55;

      const tgtMoney = (phase === 'result' && pt < 2.4 && res) ? S.money - res.pay : S.money;
      dispMoney = Math.abs(dispMoney - tgtMoney) < 1 ? tgtMoney : lerp(dispMoney, tgtMoney, 0.12);
      saveT += dt; if (saveT > 8) { saveT = 0; save(); }
      updateHud();
    }

    function animEyes(dt) {
      if (!eyes.length || !cust) return;
      const m = cust.mood, blink = ((T * 1000 + cust.seed) % 3600) < 140;
      let open = -1.3;
      if (m === 'happy') open = 0.85; else if (m === 'ouch') open = 1.45; else if (m === 'worry') open = -1.45; else if (m === 'angry') open = -0.35; else if (m === 'cry') open = -0.6;
      if (blink && m !== 'ouch') open = 1.45;
      let yaw = 0, pitch = 0;
      if (hasPtr) { const hs = headScreen(); yaw = clamp((px - hs.x) / (cw * 0.3), -1, 1) * 0.5; pitch = clamp((py - hs.y) / (ch * 0.3), -1, 1) * 0.3; }
      const kL = Math.min(1, dt * 20), kB = Math.min(1, dt * 10);
      for (const e of eyes) {
        e.lid.rotation.x += (open - e.lid.rotation.x) * kL;
        e.ball.rotation.y += (yaw - e.ball.rotation.y) * kB; e.ball.rotation.x += (pitch - e.ball.rotation.x) * kB;
      }
    }
    function updateFx(dt) {
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.t += dt;
        if (f.k === 'dot') { f.vy += 600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
        else if (f.k === 'txt') { f.y += f.vy * dt; }
        else if (f.k === 'coin') {
          if (f.t < f.delay) continue;
          const u = clamp((f.t - f.delay) / f.dur, 0, 1), e = ease(u);
          f.x = lerp(f.sx, f.tx, e); f.y = lerp(f.sy, f.ty, e) - Math.sin(u * Math.PI) * 60;
          if (u >= 1) { f.t = 999; if (T - lastTick > 0.05) { lastTick = T; sfx.coin(); } }
        }
        if (f.t > (f.life || 999)) { fx[i] = fx[fx.length - 1]; fx.pop(); }
      }
    }

    /* ------------------------------------------------- calque 2D (HUD en scène) */
    function rr(x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function wrap(text, x, y, maxW, lh, maxLines) {
      const words = text.split(' '); let line = '', yy = y, n = 0;
      for (let i = 0; i < words.length; i++) {
        const test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i]; yy += lh; n++; if (n >= maxLines) return; }
        else line = test;
      }
      ctx.fillText(line, x, yy);
    }
    function star(x, y, r, fill) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
    }

    function drawTool() {
      if (!hasPtr || shopOpen || rotDrag) return;
      const it = toolItem(); if (!it) return;
      const rpx = Math.max(8, it.r * K * ppu), active = pDown && phase === 'cut', u = clamp(ch / 420, 0.7, 1.4);
      ctx.save(); ctx.translate(px, py);
      ctx.strokeStyle = active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(0, 0, rpx, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (flow > 0.5) { ctx.strokeStyle = 'rgba(255,217,120,' + (flow - 0.4) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, rpx + 5, 0, TAU); ctx.stroke(); }
      const jit = vib * 1.6; ctx.translate(rnd(-jit, jit), rnd(-jit, jit)); ctx.scale(u, u);
      const rr0 = rpx / u;
      if (tool === 'c') {
        ctx.rotate(clamp(pvx / 1600, -0.45, 0.45));
        const bw = Math.max(40, rr0 * 2), col = it.col;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(-bw * .42 + 5, -80 + 6, bw * .84, 78, 14); ctx.fill();
        const gr = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)');
        ctx.fillStyle = col; rr(-bw * .42, -82, bw * .84, 80, 14); ctx.fill(); ctx.fillStyle = gr; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(-bw * .3, -76, bw * .12, 60, 6); ctx.fill();
        ctx.fillStyle = '#d9dee4'; ctx.fillRect(-bw / 2, -8, bw, 11);
        ctx.fillStyle = '#6a7380'; for (let x = -bw / 2 + 2; x < bw / 2 - 2; x += 5) ctx.fillRect(x, -2, 2.4, 8);
        ctx.fillStyle = '#14202e'; rr(-8, -66, 16, 12, 5); ctx.fill();
        if (it.id === 'c5') { ctx.fillStyle = '#17d6e8'; ctx.shadowColor = '#17d6e8'; ctx.shadowBlur = 14; ctx.fillRect(-bw / 2, 3, bw, 3); ctx.shadowBlur = 0; }
      } else if (tool === 's') {
        ctx.rotate(-0.55);
        const open = 0.06 + 0.42 * (snipAnim > 0 ? snipAnim : 0.35);
        for (const sg of [-1, 1]) {
          ctx.save(); ctx.translate(0, -44); ctx.rotate(sg * open);
          ctx.fillStyle = it.col; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(sg * 1.5, 46); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.strokeStyle = '#d6334a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(sg * 12, -34, 11, 15, sg * 0.25, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, -44, 4, 0, TAU); ctx.fill();
      } else {
        ctx.rotate(0.45);
        ctx.fillStyle = '#5a3a24'; rr(-6, -86, 12, 70, 6); ctx.fill();
        ctx.fillStyle = '#c9d2dc'; rr(-rr0 * 0.8, -16, rr0 * 1.6, 12, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.globalAlpha = .6; ctx.fillRect(-rr0 * 0.7, -14, rr0 * 1.4, 3); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    function drawCard() {
      const c = cust, st = c.style, comp = !infoSide, w = comp ? 300 : 340, h = comp ? 58 : 100, ir = infoPos(w);
      const slide = phase === 'enter' ? clamp(pt / 1.0, 0, 1) : phase === 'leave' ? 1 - clamp(pt / 0.5, 0, 1) : 1;
      if (slide <= 0) return;
      ctx.save(); ctx.globalAlpha = slide; ctx.translate(ir.x, ir.y + (1 - slide) * -30); ctx.scale(ir.u, ir.u);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(4, 6, w, h, 16); ctx.fill();
      ctx.fillStyle = 'rgba(20,32,46,.94)'; rr(0, 0, w, h, 16); ctx.fill(); ctx.strokeStyle = '#e1b04a'; ctx.lineWidth = 3; ctx.stroke();
      const R = comp ? 24 : 40, cx0 = comp ? 32 : 54, cy0 = comp ? 29 : 50;
      ctx.fillStyle = '#e6edf3'; ctx.beginPath(); ctx.arc(cx0, cy0, R, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx0, cy0, R, 0, TAU); ctx.clip(); if (thumb) ctx.drawImage(thumb, cx0 - R * 1.3, cy0 - R * 1.4, R * 2.6, R * 2.8); ctx.restore();
      const tx = comp ? 66 : 106;
      ctx.textAlign = 'left'; ctx.fillStyle = '#ffd978'; ctx.font = 'bold ' + (comp ? 17 : 20) + 'px ' + FONT; ctx.fillText(st.name, tx, comp ? 23 : 28);
      ctx.fillStyle = '#fff'; ctx.font = (comp ? 12 : 13) + 'px ' + FONT;
      if (comp) ctx.fillText(c.name + ' · ' + st.price + ' €', tx, 40); else wrap(c.name + ' : « ' + st.say + ' »', tx, 47, w - 118, 16, 2);
      if (phase === 'cut' && S.guide) {
        const by = comp ? 46 : 78, bw = w - tx - 18;
        ctx.fillStyle = '#26394f'; rr(tx, by, bw, comp ? 7 : 9, 4); ctx.fill();
        ctx.fillStyle = accLive > 0.86 ? '#4cd964' : accLive > 0.55 ? '#ffb020' : '#ff6a5a'; rr(tx, by, Math.max(8, bw * clamp(accLive, 0, 1)), comp ? 7 : 9, 4); ctx.fill();
      }
      ctx.restore();
    }

    function drawResult() {
      const comp = !infoSide, w = comp ? 330 : 360, h = comp ? 100 : 130, ir = infoPos(w), a = clamp(pt / 0.3, 0, 1), cx2 = w / 2;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(ir.x, ir.y); ctx.scale(ir.u, ir.u);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(4, 6, w, h, 18); ctx.fill();
      ctx.fillStyle = 'rgba(20,32,46,.95)'; rr(0, 0, w, h, 18); ctx.fill(); ctx.strokeStyle = res.stars >= 4 ? '#e1b04a' : '#6b7a8d'; ctx.lineWidth = 3; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = (comp ? 13 : 14) + 'px ' + FONT;
      if (pt > 0.3) wrap(res.msg, cx2, comp ? 22 : 24, w - 30, 17, 1);
      const sr = comp ? 13 : 17, sp = comp ? 31 : 44, sx0 = comp ? 36 : cx2 - 2 * sp, sy = comp ? 62 : 62;
      for (let i = 0; i < 5; i++) {
        const t0 = 0.6 + i * 0.28, u = clamp((pt - t0) / 0.35, 0, 1), on = i < res.stars, sx = sx0 + i * sp;
        if (u > 0) star(sx, sy, sr * (on ? backOut(u) : 1), on ? '#ffd23f' : '#3a475a');
        if (on && pt >= t0 && !res['s' + i]) { res['s' + i] = 1; sfx.star(i); sparks(ir.x + sx * ir.u, ir.y + sy * ir.u, 8, '#ffd978'); }
      }
      if (pt > 1.9) {
        const u = clamp((pt - 1.9) / 0.5, 0, 1), px2 = comp ? w - 80 : cx2, py2 = comp ? 70 : 108;
        ctx.fillStyle = '#7ee0a0'; ctx.font = 'bold ' + Math.round((comp ? 20 : 24) * (0.8 + 0.2 * backOut(u))) + 'px ' + FONT;
        ctx.fillText('+ ' + fmt(res.pay * u), px2, py2);
        ctx.fillStyle = '#c4d0de'; ctx.font = '12px ' + FONT;
        const line = (res.tip ? 'pourboire ' + res.tip + ' €' : '') + (res.notes.length ? (res.tip ? ' · ' : '') + res.notes.join(' · ') : '');
        if (line) ctx.fillText(line.length > 64 ? line.slice(0, 62) + '…' : line, cx2, h + 20);
        if (res.newStyles.length) { ctx.fillStyle = '#ffd978'; ctx.font = 'bold 13px ' + FONT; ctx.fillText('Nouvelle coupe : ' + res.newStyles.join(', '), cx2, h + 40); }
      }
      ctx.restore();
    }

    function drawFx() {
      for (const f of fx) {
        if (f.k === 'dot') { ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1); ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); }
        else if (f.k === 'txt') { ctx.globalAlpha = clamp(1.4 - f.t / f.life * 1.4, 0, 1); ctx.font = 'bold ' + f.size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.s, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.s, f.x, f.y); }
        else if (f.k === 'coin' && f.t >= f.delay) {
          ctx.globalAlpha = 1; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(f.x, f.y, 11, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#c28a14'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#c28a14'; ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('€', f.x, f.y + 4.5);
        }
      }
      ctx.globalAlpha = 1;
    }

    function renderOverlay() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (cust && (phase === 'cut' || phase === 'enter' || phase === 'leave')) drawCard();
      if (phase === 'result' && res) drawResult();
      drawFx();
      if (phase === 'cut') drawTool();
      if (flow > 0.05 && phase === 'cut') {
        const fw = 160 * uiS, fx0 = cw / 2 - fw / 2, fy0 = ch - 30 * uiS;
        ctx.fillStyle = 'rgba(20,32,46,.8)'; rr(fx0, fy0, fw, 14 * uiS, 7); ctx.fill();
        const gr = ctx.createLinearGradient(fx0, 0, fx0 + fw, 0); gr.addColorStop(0, '#4cd964'); gr.addColorStop(1, '#ffd23f');
        ctx.fillStyle = gr; rr(fx0, fy0, fw * flow, 14 * uiS, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(11 * uiS) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(flow > 0.8 ? 'FLOW !!' : 'FLOW', cw / 2, fy0 + 11 * uiS);
      }
      if (phase === 'cut' && S.served < 2 && cutTotal < 40) {
        const bw = Math.min(cw - 24, 470 * uiS), by = ch - 92 * uiS;
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(cw / 2 - bw / 2, by, bw, 46 * uiS, 12); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(14 * uiS) + 'px ' + FONT; ctx.fillText('Maintiens et glisse sur les cheveux', cw / 2, by + 19 * uiS);
        ctx.fillStyle = '#c4d0de'; ctx.font = Math.round(12 * uiS) + 'px ' + FONT; ctx.fillText('Points : vert = bon · orange = trop long · rouge = trop court · ⟲ ⟳ tourne le fauteuil', cw / 2, by + 37 * uiS, bw - 10);
      }
    }

    function frame(ts) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
      if ((frameN++ & 7) === 0) layout();
      update(dt);
      if (phase !== 'cut' || !(pDown && hasPtr)) updateCamera();
      renderer.render(scene, camera);
      renderOverlay();
    }

    /* ----------------------------------------------------------------- HUD */
    function updateHud() {
      const key = [Math.round(dispMoney), S.rep, tool, S.lvl[tool], S.guide, S.sound, phase, S.eq.r, floorCount > 40 ? 1 : 0].join('|');
      if (key === lastHud) return; lastHud = key;
      elMoney.textContent = fmt(dispMoney); elRep.textContent = S.rep; elSMoney.textContent = fmt(S.money);
      const nxt = STYLES.find((s) => s.unlock > S.rep);
      $('rep').title = nxt ? 'Prochaine coupe : ' + nxt.name + ' (réputation ' + nxt.unlock + ')' : 'Toutes les coupes sont débloquées !';
      ['c', 's', 'r'].forEach((t) => { const b = $('t-' + t); b.classList.toggle('on', tool === t); b.style.opacity = (t === 'r' && !S.eq.r) ? 0.5 : 1; });
      const lv = levels(), idx = clamp(S.lvl[tool], 0, lv.length - 1);
      const lab = tool === 'c' ? 'Sabot ' + (idx + 1) : tool === 's' ? 'Cran ' + (idx + 1) : 'À blanc';
      const pct = tool === 'r' ? 4 : Math.round((lv[idx] / 56) * 100);
      elLvl.innerHTML = lab + '<div class="bt-bar"><i style="width:' + pct + '%"></i></div>';
      $('guide').classList.toggle('on', S.guide); $('sound').textContent = S.sound ? '🔊' : '🔇';
      elDone.textContent = phase === 'result' ? 'Client suivant ▶' : 'Terminé ✓';
      elDone.disabled = phase === 'enter' || phase === 'leave';
      $('broom').style.display = floorCount > 40 ? '' : 'none';
    }
    function toast(msg) { elToast.textContent = msg; elToast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => elToast.classList.remove('show'), 2400); }

    /* ------------------------------------------------------------ boutique */
    function renderShop() {
      elTabs.innerHTML = TABS.map((t) => '<button class="bt-btn' + (t[0] === shopTab ? ' on' : '') + '" data-act="tab:' + t[0] + '">' + t[1] + '</button>').join('');
      elSMoney.textContent = fmt(S.money);
      elList.innerHTML = ITEMS.filter((i) => i.cat === shopTab).map((i) => {
        const o = owns(i.id), eqd = S.eq[i.cat] === i.id;
        let stat = '';
        if (i.r) stat = 'Largeur de coupe : ' + i.r * 2 + (i.rate ? ' · snip toutes les ' + Math.round(i.rate * 1000) + ' ms' : '');
        if (i.mult && i.mult > 1) stat = 'Paie ×' + i.mult;
        if (i.id === 'd4') stat = 'Sol toujours propre (+8 %)';
        let btn;
        if (['c', 's', 'r', 'ch'].indexOf(i.cat) >= 0) {
          if (o) btn = eqd ? '<button class="bt-btn eq" disabled>Équipé</button>' : '<button class="bt-btn" data-act="eq:' + i.id + '">Équiper</button>';
          else btn = '<button class="bt-btn' + (S.money < i.price ? ' cant' : '') + '" data-act="buy:' + i.id + '">' + fmt(i.price) + '</button>';
        } else btn = o ? '<button class="bt-btn eq" disabled>Possédé ✓</button>' : '<button class="bt-btn' + (S.money < i.price ? ' cant' : '') + '" data-act="buy:' + i.id + '">' + fmt(i.price) + '</button>';
        return '<div class="bt-it"><div class="bt-ic" style="background:' + i.col + '">' + i.ic + '</div><div class="bt-in"><b>' + i.name + '</b><span>' + i.desc + '</span><i>' + stat + '</i></div>' + btn + '</div>';
      }).join('');
    }
    function buy(id) {
      const i = ITEM[id]; if (!i || owns(id)) return;
      if (S.money < i.price) { toast('Il te manque ' + fmt(i.price - S.money) + ' !'); return; }
      S.money -= i.price; dispMoney = S.money; S.owned.push(id);
      if (['c', 's', 'r', 'ch'].indexOf(i.cat) >= 0) S.eq[i.cat] = id;
      if (i.cat === 'ch') buildChair();
      sfx.buy(); save(); lastHud = ''; renderShop(); toast(i.name + ' acheté !');
      if (i.cat === 'd') toast(i.name + ' acheté ! (visible au prochain client)');
    }

    /* --------------------------------------------------------------- actions */
    function setTool(t) {
      if (t === 'r' && !S.eq.r) { toast('🪒 Le rasoir s\'achète en boutique'); return; }
      tool = t; snipT = 0; lastHud = '';
    }
    function act(a) {
      initAudio();
      const p = a.split(':');
      switch (p[0]) {
        case 'shop': shopOpen = !shopOpen; elShop.classList.toggle('on', shopOpen); pDown = false; if (shopOpen) renderShop(); break;
        case 'close': shopOpen = false; elShop.classList.remove('on'); break;
        case 'tab': shopTab = p[1]; renderShop(); break;
        case 'buy': buy(p[1]); break;
        case 'eq': { const i = ITEM[p[1]]; if (i && owns(i.id)) { S.eq[i.cat] = i.id; if (i.cat === 'ch') buildChair(); sfx.pop(); save(); renderShop(); lastHud = ''; } break; }
        case 'tool': setTool(p[1]); break;
        case 'lvl': { const lv = levels(); S.lvl[tool] = clamp(S.lvl[tool] + (+p[1]), 0, lv.length - 1); lastHud = ''; sfx.pop(); break; }
        case 'guide': S.guide = !S.guide; save(); lastHud = ''; toast(S.guide ? 'Guide activé' : 'Guide désactivé : +25 % de gains !'); break;
        case 'sound': S.sound = !S.sound; if (master) master.gain.value = snd() ? 0.55 : 0; save(); lastHud = ''; break;
        case 'fs': toggleFs(); break;
        case 'done': if (phase === 'cut') finishCut(); else if (phase === 'result') leave(); break;
        case 'broom': startSweep(false); break;
        default: break;
      }
    }
    function toggleFs() {
      const d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
      const gv = document.getElementById('game-view');
      const fsT = (gv && gv.contains(box)) ? gv : host;
      const rq = fsT.requestFullscreen || fsT.webkitRequestFullscreen;
      if (rq) {
        const pr = rq.call(fsT);
        const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } };
        if (pr && pr.then) pr.then(lock).catch(() => {}); else lock();
      }
    }
    const onClick = (e) => { const b = e.target.closest ? e.target.closest('[data-act]') : null; if (b && !b.disabled) act(b.getAttribute('data-act')); };
    root.addEventListener('click', onClick);
    // boutons de rotation (maintenir)
    const holdDown = (e) => { const b = e.target.closest ? e.target.closest('[data-hold]') : null; if (b) { initAudio(); rotKey = +b.getAttribute('data-hold'); e.preventDefault(); } };
    const holdUp = () => { rotKey = 0; };
    root.addEventListener('pointerdown', holdDown);
    global.addEventListener('pointerup', holdUp); global.addEventListener('pointercancel', holdUp);

    /* ---------------------------------------------------------------- entrées */
    function toLocalPt(e) {
      const r = ov.getBoundingClientRect();
      const x = (e.clientX - r.left) * (cw / Math.max(1, r.width)), y = (e.clientY - r.top) * (ch / Math.max(1, r.height));
      return { x, y: e.pointerType === 'touch' ? y - 42 * uiS : y };   // l'outil dépasse au-dessus du doigt
    }
    const onDown = (e) => {
      initAudio();
      if (e.button === 2 || e.button === 1) { rotDrag = true; pDown = false; angVel = 0; lx = e.clientX; e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } return; }
      if (e.button > 0) return;
      const p = toLocalPt(e); px = lx = p.x; py = ly = p.y; hasPtr = true; pDown = true; snipT = 0;
      try { ov.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      if (phase === 'result' && pt > 1.2 && !shopOpen) leave();
      e.preventDefault();
    };
    const onMove = (e) => {
      if (rotDrag) { const dx = e.clientX - lx; lx = e.clientX; ang += dx * 0.012; angVel = dx * 0.6; e.preventDefault(); return; }
      const p = toLocalPt(e); if (!hasPtr) { lx = p.x; ly = p.y; } px = p.x; py = p.y; hasPtr = true; e.preventDefault();
    };
    const onUp = (e) => { pDown = false; rotDrag = false; try { ov.releasePointerCapture(e.pointerId); } catch (er) { /* ignore */ } };
    const stop = (e) => e.preventDefault();
    ov.addEventListener('pointerdown', onDown); ov.addEventListener('pointermove', onMove);
    ov.addEventListener('pointerup', onUp); ov.addEventListener('pointercancel', onUp);
    ov.addEventListener('contextmenu', stop);
    ov.addEventListener('touchstart', stop, { passive: false }); ov.addEventListener('touchmove', stop, { passive: false });
    ov.addEventListener('gesturestart', stop);

    const onKey = (e) => {
      if (!alive) return;
      const k = e.key, down = e.type === 'keydown';
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { rotKey = down ? -1 : (rotKey === -1 ? 0 : rotKey); return; }
      if (k === 'ArrowRight' || k === 'd' || k === 'D') { rotKey = down ? 1 : (rotKey === 1 ? 0 : rotKey); return; }
      if (!down) return;
      if (k === 'Escape' && shopOpen) { act('close'); return; }
      if (shopOpen) return;
      if (k === '1') act('tool:c'); else if (k === '2') act('tool:s'); else if (k === '3') act('tool:r');
      else if (k === 'q' || k === 'Q') act('lvl:-1'); else if (k === 'e' || k === 'E') act('lvl:1');
      else if (k === 'Enter') act('done'); else if (k === 'b' || k === 'B') act('shop');
    };
    global.addEventListener('keydown', onKey); global.addEventListener('keyup', onKey);
    const onBlur = () => { pDown = false; rotKey = 0; rotDrag = false; };
    global.addEventListener('blur', onBlur);

    /* --------------------------------------------------------- nettoyage */
    function destroy() {
      if (!alive) return; alive = false;
      cancelAnimationFrame(raf); save();
      global.removeEventListener('resize', layout); document.removeEventListener('fullscreenchange', layout); document.removeEventListener('webkitfullscreenchange', layout);
      global.removeEventListener('keydown', onKey); global.removeEventListener('keyup', onKey); global.removeEventListener('blur', onBlur);
      global.removeEventListener('pointerup', holdUp); global.removeEventListener('pointercancel', holdUp);
      if (ro) ro.disconnect();
      clearTimeout(toastT);
      try { if (buzzG) buzzG.gain.value = 0; if (o1) o1.stop(); if (o2) o2.stop(); if (AC) AC.close(); } catch (e) { /* ignore */ }
      AC = null;
      try {
        if (scene) scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
        });
        if (renderer) { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); }
      } catch (e) { /* ignore */ }
      try { if (document.fullscreenElement === host && document.exitFullscreen) document.exitFullscreen(); } catch (e) { /* ignore */ }
      box.remove();
      if (ph) ph.style.visibility = prevVis;
      host.style.position = prevPos;
      if (global._barberCleanup === destroy) global._barberCleanup = null;
    }
    global._barberCleanup = destroy;

    /* ------------------------------------------------------------ démarrage */
    function boot() {
      if (!alive) return;
      THREE = global.THREE;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
      } catch (e) { renderer = null; }
      if (!renderer) {
        toast('WebGL indisponible sur cet appareil'); ctx.fillStyle = '#fff'; ctx.font = '18px ' + FONT; ctx.fillText('WebGL indisponible : le jeu 3D ne peut pas démarrer.', 20, 90);
        return;
      }
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      buildScene();
      layout(); resize();
      try { const sc = document.getElementById('current-score'); if (sc) sc.innerText = S.earned; } catch (e) { /* ignore */ }
      nextCustomer(); updateHud();
      raf = requestAnimationFrame(frame);
    }
    layout();
    if (global.THREE) boot();
    else {
      const s = document.createElement('script'); s.src = THREE_URL;
      s.onload = boot; s.onerror = () => { toast('Impossible de charger Three.js'); };
      document.body.appendChild(s);
    }
    return destroy;
  }

  global.startBarber = start;
})(typeof window !== 'undefined' ? window : globalThis);