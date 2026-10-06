// ============================================================
// CYBER MINER — jeu incrémental (idle / clicker)
// Progression SAUVEGARDÉE sur l'appareil : le joueur revient chaque jour.
//  - gains hors-ligne (jusqu'à 8 h)
//  - récompense quotidienne avec série
//  - bonus 💎 aléatoires
//  - "Overclock" (prestige) pour des bonus permanents
// S'affiche dans #memory-board (interface HTML, pas de canvas).
// ============================================================
function startClickerGame() {
  if (window.GameMobile) GameMobile.reset();
  if (window._clickerCleanup) window._clickerCleanup();

  const board = document.getElementById('memory-board');
  if (!board) return;
  const canvas = document.getElementById('game-canvas');
  if (canvas) canvas.classList.add('hidden');
  board.classList.remove('hidden');

  // Nettoie les styles laissés par un autre jeu puis applique ceux du jeu
  ['width', 'maxWidth', 'height', 'aspectRatio', 'margin', 'border', 'borderRadius', 'boxShadow',
   'boxSizing', 'background', 'display', 'flexDirection', 'alignItems', 'justifyContent',
   'gridTemplateColumns', 'gridTemplateRows', 'gap'].forEach(p => { board.style[p] = ''; });
  board.dataset.game = 'clicker';
  const tall = (window.CSS && CSS.supports && CSS.supports('height', '80dvh')) ? 'min(80dvh, 700px)' : 'min(80vh, 700px)';
  Object.assign(board.style, {
    display: 'block', width: '100%', maxWidth: '560px', height: tall, margin: '0 auto',
    overflowY: 'auto', boxSizing: 'border-box', padding: '12px', background: '#090d16',
    border: '2px solid #00f3ff', borderRadius: '10px', color: '#fff',
    fontFamily: "'Rajdhani', sans-serif", userSelect: 'none', webkitUserSelect: 'none'
  });
  board.style.webkitOverflowScrolling = 'touch';

  // ---------- données ----------
  const SAVE_KEY = 'cyber_miner_v1';
  const GENS = [
    { id: 'bot',   name: 'Nano-Bot',        icon: '🤖', base: 15,     cps: 0.1 },
    { id: 'drone', name: 'Drone Foreur',    icon: '🛸', base: 100,    cps: 1 },
    { id: 'rig',   name: 'Rig Minier',      icon: '⛏️', base: 1100,   cps: 8 },
    { id: 'srv',   name: 'Serveur Blindé',  icon: '🖥️', base: 12000,  cps: 47 },
    { id: 'qtm',   name: 'Noyau Quantique', icon: '🔮', base: 130000, cps: 260 },
    { id: 'rct',   name: 'Réacteur Fusion', icon: '☢️', base: 1.4e6,  cps: 1400 },
    { id: 'dys',   name: 'Sphère de Dyson', icon: '🌞', base: 2e7,    cps: 7800 },
    { id: 'sng',   name: 'Singularité',     icon: '🕳️', base: 3.3e8,  cps: 44000 }
  ];
  const UPGS = [
    { id: 'k1', name: 'Doigts cybernétiques', desc: 'Clic ×2',              cost: 300,    click: 2 },
    { id: 'u1', name: 'Refroidisseur',        desc: 'Production ×1,5',      cost: 500,    prod: 1.5 },
    { id: 'k2', name: 'Gants à impulsion',    desc: 'Clic ×3',              cost: 15000,  click: 3 },
    { id: 'u2', name: 'Circuits dorés',       desc: 'Production ×2',        cost: 10000,  prod: 2 },
    { id: 'k4', name: 'Résonance',            desc: 'Chaque clic ajoute 5% de ta production/s', cost: 5e5, resonance: true },
    { id: 'u3', name: 'IA prédictive',        desc: 'Production ×2',        cost: 250000, prod: 2 },
    { id: 'k3', name: 'Poing quantique',      desc: 'Clic ×5',              cost: 1.5e6,  click: 5 },
    { id: 'u4', name: 'Cœur quantique',       desc: 'Production ×3',        cost: 5e6,    prod: 3 },
    { id: 'u5', name: 'Horizon des événements', desc: 'Production ×5',      cost: 2e8,    prod: 5 }
  ];

  const fresh = () => ({
    coins: 0, total: 0, lifetime: 0, clicks: 0,
    gens: {}, clickLvl: 0, upgs: {},
    chips: 0, chipsEver: 0,
    lastSave: Date.now(), lastDaily: '', streak: 0
  });

  let S = fresh();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) S = Object.assign(fresh(), JSON.parse(raw));
  } catch (e) { S = fresh(); }

  let buyQty = 1;         // 1, 10, 100, 0 = max
  let frenzyT = 0;        // secondes restantes de ×7
  let goldenT = rand(40, 80);
  let goldenEl = null, goldenLife = 0;
  let lastTs = 0, saveT = 0, uiT = 0, stopped = false, toastT = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- calculs ----------
  const prestigeMult = () => 1 + S.chips * 0.1;
  const prodMult = () => UPGS.reduce((m, u) => m * (S.upgs[u.id] && u.prod ? u.prod : 1), 1) * prestigeMult() * (frenzyT > 0 ? 7 : 1);
  const baseCps = () => GENS.reduce((s, g) => s + (S.gens[g.id] || 0) * g.cps, 0);
  const cps = () => baseCps() * prodMult();
  function clickPower() {
    let p = (1 + S.clickLvl) * prestigeMult();
    UPGS.forEach(u => { if (S.upgs[u.id] && u.click) p *= u.click; });
    if (S.upgs.k4) p += cps() * 0.05;
    return p * (frenzyT > 0 ? 7 : 1);
  }
  const genCost = (g, owned, qty) => g.base * Math.pow(1.15, owned) * (Math.pow(1.15, qty) - 1) / 0.15;
  const clickCost = () => Math.floor(10 * Math.pow(1.4, S.clickLvl));
  const potentialChips = () => Math.max(0, Math.floor(Math.sqrt(S.lifetime / 1e6)) - S.chipsEver);

  function maxAffordable(g) {
    const owned = S.gens[g.id] || 0;
    let n = 0;
    while (n < 500 && genCost(g, owned, n + 1) <= S.coins) n++;
    return n;
  }

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return n < 10 ? n.toFixed(1).replace('.', ',') : String(Math.floor(n));
    const suf = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    let i = -1;
    while (n >= 1000 && i < suf.length - 1) { n /= 1000; i++; }
    return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace('.', ',') + ' ' + suf[i];
  }

  function save() {
    S.lastSave = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const yesterday = () => {
    const d = new Date(Date.now() - 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // ---------- interface ----------
  board.innerHTML = `
    <style>
      #memory-board[data-game="clicker"] button { font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      .cl-head { text-align: center; }
      .cl-coins { font-size: 34px; font-weight: 900; color: #ffe600; text-shadow: 0 0 12px rgba(255,230,0,.5); line-height: 1.1; }
      .cl-cps { color: #9aa4b8; font-size: 14px; font-weight: 600; }
      .cl-core-wrap { position: relative; display: flex; justify-content: center; margin: 10px 0 6px; }
      .cl-core { width: 128px; height: 128px; border-radius: 50%; font-size: 54px; color: #00f3ff; background: radial-gradient(circle at 35% 30%, rgba(0,243,255,.35), rgba(5,5,16,.9)); border: 3px solid #00f3ff; box-shadow: 0 0 24px rgba(0,243,255,.45); transition: transform .05s; padding: 0; }
      .cl-core:active { transform: scale(.93); }
      .cl-float { position: absolute; top: 18%; pointer-events: none; font-weight: 900; font-size: 20px; color: #ffe600; text-shadow: 0 0 6px #000; animation: clfloat .8s ease-out forwards; }
      @keyframes clfloat { to { transform: translateY(-70px); opacity: 0; } }
      .cl-banner { display: none; margin: 6px 0; padding: 8px 10px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; }
      .cl-frenzy { background: rgba(255,85,0,.18); border: 1px solid #ff5500; color: #ffb27a; }
      .cl-toast { background: rgba(0,255,157,.12); border: 1px solid #00ff9d; color: #8dffcf; }
      .cl-daily { display: none; width: 100%; margin: 6px 0; padding: 11px; border-radius: 8px; border: 1px solid #ffe600; background: rgba(255,230,0,.12); color: #ffe600; font-weight: 800; font-size: 15px; }
      .cl-qty { display: flex; gap: 6px; justify-content: center; margin: 8px 0; }
      .cl-qty button { padding: 6px 12px; border-radius: 6px; border: 1px solid #334; background: #121826; color: #aab; font-weight: 700; }
      .cl-qty button.on { border-color: #00f3ff; color: #00f3ff; background: rgba(0,243,255,.12); }
      .cl-h { margin: 14px 0 6px; font-size: 13px; letter-spacing: 2px; color: #00f3ff; }
      .cl-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 10px; margin-bottom: 6px; border-radius: 8px; border: 1px solid #222d42; background: #121826; color: #fff; }
      .cl-row.can { border-color: #00f3ff; background: rgba(0,243,255,.08); }
      .cl-row.no { opacity: .55; }
      .cl-ico { font-size: 26px; width: 34px; text-align: center; flex: none; }
      .cl-info { flex: 1; min-width: 0; }
      .cl-name { font-weight: 800; font-size: 15px; }
      .cl-sub { font-size: 12px; color: #9aa4b8; }
      .cl-cost { font-weight: 800; color: #ffe600; font-size: 14px; white-space: nowrap; }
      .cl-end { width: 100%; margin-top: 16px; padding: 12px; border-radius: 8px; border: 1px solid #ff0055; background: rgba(255,0,85,.1); color: #ff6b99; font-weight: 800; }
    </style>

    <div class="cl-head">
      <div class="cl-coins" id="cl-coins">0</div>
      <div class="cl-cps" id="cl-cps"></div>
    </div>

    <div class="cl-core-wrap">
      <button class="cl-core" id="cl-core" aria-label="Miner">⚡</button>
    </div>

    <div class="cl-banner cl-frenzy" id="cl-frenzy"></div>
    <div class="cl-banner cl-toast" id="cl-toast"></div>
    <button class="cl-daily" id="cl-daily"></button>

    <div class="cl-qty" id="cl-qty">
      <button data-q="1" class="on">×1</button><button data-q="10">×10</button><button data-q="100">×100</button><button data-q="0">MAX</button>
    </div>

    <div class="cl-h">CLIC</div>
    <button class="cl-row" id="cl-clickup"></button>

    <div class="cl-h">GÉNÉRATEURS</div>
    <div id="cl-gens"></div>

    <div class="cl-h">AMÉLIORATIONS</div>
    <div id="cl-upgs"></div>

    <div class="cl-h">OVERCLOCK</div>
    <div id="cl-prestige"></div>

    <button class="cl-end" id="cl-end">TERMINER LA SESSION ET ENREGISTRER MON SCORE</button>
  `;

  const $ = id => board.querySelector('#' + id);
  const elCoins = $('cl-coins'), elCps = $('cl-cps'), elCore = $('cl-core');
  const elFrenzy = $('cl-frenzy'), elToast = $('cl-toast'), elDaily = $('cl-daily');
  const elClickUp = $('cl-clickup'), elGens = $('cl-gens'), elUpgs = $('cl-upgs'), elPrestige = $('cl-prestige');

  function toast(msg, secs) {
    elToast.textContent = msg;
    elToast.style.display = 'block';
    toastT = secs || 5;
  }

  // Générateurs : lignes créées une seule fois, puis mises à jour
  elGens.innerHTML = GENS.map(g => `
    <button class="cl-row no" data-gen="${g.id}">
      <div class="cl-ico">${g.icon}</div>
      <div class="cl-info"><div class="cl-name">${g.name} <span data-own>×0</span></div><div class="cl-sub" data-sub></div></div>
      <div class="cl-cost" data-cost></div>
    </button>`).join('');

  function renderUpgs() {
    const avail = UPGS.filter(u => !S.upgs[u.id]).slice(0, 4);
    elUpgs.innerHTML = avail.length ? avail.map(u => `
      <button class="cl-row no" data-upg="${u.id}">
        <div class="cl-ico">✨</div>
        <div class="cl-info"><div class="cl-name">${u.name}</div><div class="cl-sub">${u.desc}</div></div>
        <div class="cl-cost">${fmt(u.cost)}</div>
      </button>`).join('') : '<div class="cl-sub">Toutes les améliorations sont achetées !</div>';
  }

  function renderPrestige() {
    const gain = potentialChips();
    elPrestige.innerHTML = `
      <button class="cl-row ${gain > 0 ? 'can' : 'no'}" data-prestige="1">
        <div class="cl-ico">🔁</div>
        <div class="cl-info">
          <div class="cl-name">Overclock — ${S.chips} puce${S.chips > 1 ? 's' : ''} (+${S.chips * 10}% de tout)</div>
          <div class="cl-sub">${gain > 0 ? `Recommence à zéro et gagne ${gain} puce${gain > 1 ? 's' : ''} permanente${gain > 1 ? 's' : ''}.` : 'Gagne 1 000 000 de pièces au total pour débloquer ton premier Overclock.'}</div>
        </div>
      </button>`;
  }

  function updateShop() {
    elClickUp.className = 'cl-row ' + (S.coins >= clickCost() ? 'can' : 'no');
    elClickUp.innerHTML = `
      <div class="cl-ico">👆</div>
      <div class="cl-info"><div class="cl-name">Puissance de clic (niv. ${S.clickLvl})</div><div class="cl-sub">+1 par clic de base — actuellement +${fmt(clickPower())}</div></div>
      <div class="cl-cost">${fmt(clickCost())}</div>`;

    GENS.forEach(g => {
      const row = elGens.querySelector(`[data-gen="${g.id}"]`);
      const owned = S.gens[g.id] || 0;
      const qty = buyQty === 0 ? Math.max(1, maxAffordable(g)) : buyQty;
      const cost = genCost(g, owned, qty);
      row.querySelector('[data-own]').textContent = '×' + owned;
      row.querySelector('[data-sub]').textContent = `+${fmt(g.cps * prodMult())}/s chacun${qty > 1 ? ` — achat ×${qty}` : ''}`;
      row.querySelector('[data-cost]').textContent = fmt(cost);
      row.className = 'cl-row ' + (S.coins >= cost ? 'can' : 'no');
    });
    elUpgs.querySelectorAll('[data-upg]').forEach(row => {
      const u = UPGS.find(x => x.id === row.dataset.upg);
      row.className = 'cl-row ' + (S.coins >= u.cost ? 'can' : 'no');
    });
    const gain = potentialChips();
    const pr = elPrestige.firstElementChild;
    if (pr) pr.className = 'cl-row ' + (gain > 0 ? 'can' : 'no');

    // récompense quotidienne
    if (S.lastDaily !== today()) {
      const streak = S.lastDaily === yesterday() ? S.streak + 1 : 1;
      elDaily.style.display = 'block';
      elDaily.textContent = `🎁 RÉCOMPENSE DU JOUR — série de ${streak} jour${streak > 1 ? 's' : ''} (+${fmt(dailyReward(streak))})`;
    } else {
      elDaily.style.display = 'none';
    }
  }

  const dailyReward = streak => Math.max(500, cps() * 900) * (1 + 0.25 * Math.min(streak - 1, 10));

  function floatText(txt) {
    const f = document.createElement('div');
    f.className = 'cl-float';
    f.textContent = txt;
    f.style.left = (35 + Math.random() * 30) + '%';
    f.addEventListener('animationend', () => f.remove());
    elCore.parentElement.appendChild(f);
    // jamais plus de 12 textes à l'écran
    while (elCore.parentElement.querySelectorAll('.cl-float').length > 12) elCore.parentElement.querySelector('.cl-float').remove();
  }

  // ---------- actions ----------
  function earn(n) { S.coins += n; S.total += n; S.lifetime += n; }

  function doClick() {
    const p = clickPower();
    earn(p);
    S.clicks++;
    floatText('+' + fmt(p));
    if (typeof playSound === 'function' && S.clicks % 3 === 0) playSound(500 + Math.random() * 120, 0.02, 'square');
  }

  function buyGen(id) {
    const g = GENS.find(x => x.id === id);
    const owned = S.gens[id] || 0;
    let qty = buyQty === 0 ? maxAffordable(g) : buyQty;
    if (qty < 1) return;
    const cost = genCost(g, owned, qty);
    if (S.coins < cost) return;
    S.coins -= cost;
    S.gens[id] = owned + qty;
    if (typeof playSound === 'function') playSound(660, 0.06, 'triangle');
    updateShop();
  }

  function buyUpg(id) {
    const u = UPGS.find(x => x.id === id);
    if (!u || S.upgs[id] || S.coins < u.cost) return;
    S.coins -= u.cost;
    S.upgs[id] = true;
    if (typeof playSound === 'function') playSound(880, 0.1, 'triangle');
    renderUpgs();
    updateShop();
  }

  function buyClickLevel() {
    const c = clickCost();
    if (S.coins < c) return;
    S.coins -= c;
    S.clickLvl++;
    if (typeof playSound === 'function') playSound(740, 0.05, 'triangle');
    updateShop();
  }

  function prestige() {
    const gain = potentialChips();
    if (gain < 1) { toast('Il te faut 1 000 000 de pièces au total pour ton premier Overclock.', 4); return; }
    if (!window.confirm(`Overclock : tu recommences à zéro mais tu gagnes ${gain} puce(s) permanente(s) (+${gain * 10}% de tout). Continuer ?`)) return;
    S.chips += gain;
    S.chipsEver += gain;
    S.coins = 0; S.total = 0; S.gens = {}; S.clickLvl = 0; S.upgs = {};
    renderUpgs(); renderPrestige(); updateShop(); save();
    toast(`Overclock ! Tu as maintenant ${S.chips} puce(s) : +${S.chips * 10}% de production et de clic.`, 6);
  }

  function claimDaily() {
    if (S.lastDaily === today()) return;
    const streak = S.lastDaily === yesterday() ? S.streak + 1 : 1;
    const reward = dailyReward(streak);
    S.streak = streak;
    S.lastDaily = today();
    earn(reward);
    toast(`🎁 +${fmt(reward)} pièces ! Série de ${streak} jour${streak > 1 ? 's' : ''} — reviens demain pour un bonus plus gros.`, 7);
    if (typeof playSound === 'function') playSound(988, 0.2, 'triangle');
    updateShop(); save();
  }

  // Bonus 💎
  function spawnGolden() {
    if (goldenEl) return;
    const b = board.getBoundingClientRect();
    const el = document.createElement('button');
    el.textContent = '💎';
    const x = b.left + 30 + Math.random() * Math.max(10, b.width - 100);
    const y = b.top + 90 + Math.random() * Math.max(10, b.height - 180);
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:62px;height:62px;font-size:34px;border-radius:50%;border:2px solid #ffe600;background:rgba(255,230,0,.2);box-shadow:0 0 22px rgba(255,230,0,.8);z-index:50;padding:0;touch-action:manipulation;`;
    el.addEventListener('pointerdown', e => { e.preventDefault(); takeGolden(); });
    board.appendChild(el);   // dans le plateau : caché automatiquement si on quitte le jeu
    goldenEl = el;
    goldenLife = 12;
  }
  function removeGolden() { if (goldenEl) { goldenEl.remove(); goldenEl = null; } }
  function takeGolden() {
    removeGolden();
    if (Math.random() < 0.6) {
      const g = Math.max(100, cps() * 120);
      earn(g);
      toast(`💎 Bonus ! +${fmt(g)} pièces (2 minutes de production)`, 5);
    } else {
      frenzyT = 20;
      toast('💎 FRÉNÉSIE ! Production et clics ×7 pendant 20 s', 5);
    }
    if (typeof playSound === 'function') playSound(1046, 0.15, 'triangle');
  }

  // ---------- événements ----------
  elCore.addEventListener('pointerdown', e => { e.preventDefault(); doClick(); });
  elCore.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); doClick(); } });
  elDaily.addEventListener('click', claimDaily);
  $('cl-qty').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    buyQty = parseInt(b.dataset.q, 10);
    $('cl-qty').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    updateShop();
  });
  elClickUp.addEventListener('click', buyClickLevel);
  elGens.addEventListener('click', e => { const r = e.target.closest('[data-gen]'); if (r) buyGen(r.dataset.gen); });
  elUpgs.addEventListener('click', e => { const r = e.target.closest('[data-upg]'); if (r) buyUpg(r.dataset.upg); });
  elPrestige.addEventListener('click', e => { if (e.target.closest('[data-prestige]')) prestige(); });
  $('cl-end').addEventListener('click', () => {
    save();
    stopped = true;
    if (typeof triggerGameOver === 'function') triggerGameOver(Math.min(2e9, Math.floor(S.lifetime)));
  });

  const onHide = () => { if (document.hidden) save(); };
  const onPageHide = () => save();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);

  window._clickerCleanup = () => {
    stopped = true;
    save();
    removeGolden();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
    window._clickerCleanup = null;
  };

  // ---------- gains hors-ligne ----------
  const away = Math.min(8 * 3600, Math.max(0, (Date.now() - S.lastSave) / 1000));
  if (away > 60 && baseCps() > 0) {
    const gain = cps() * away * 0.5;
    earn(gain);
    const mins = Math.floor(away / 60);
    toast(`Pendant ton absence (${mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min' : mins + ' min'}), tes machines ont miné +${fmt(gain)} pièces.`, 9);
  }

  renderUpgs();
  renderPrestige();
  updateShop();

  // ---------- boucle ----------
  function loop(ts) {
    if (stopped) return;
    const dt = lastTs ? Math.min(0.25, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    const visible = board.getClientRects().length > 0;

    earn(cps() * dt);
    elCoins.textContent = fmt(S.coins);
    elCps.textContent = `${fmt(cps())} pièces / seconde`;

    if (frenzyT > 0) {
      frenzyT -= dt;
      elFrenzy.style.display = 'block';
      elFrenzy.textContent = `🔥 FRÉNÉSIE ×7 — ${Math.ceil(Math.max(0, frenzyT))} s`;
    } else if (elFrenzy.style.display !== 'none') {
      elFrenzy.style.display = 'none';
    }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) elToast.style.display = 'none'; }

    // bonus 💎 (uniquement quand le jeu est à l'écran)
    if (visible) {
      if (goldenEl) { goldenLife -= dt; if (goldenLife <= 0) removeGolden(); }
      else { goldenT -= dt; if (goldenT <= 0) { goldenT = rand(50, 100); spawnGolden(); } }
    } else if (goldenEl) removeGolden();

    uiT -= dt;
    if (uiT <= 0) {
      uiT = 0.25;
      updateShop();
      const sc = document.getElementById('current-score');
      if (sc) sc.innerText = Math.floor(S.lifetime);
      if (S.lifetime > 0) renderPrestigeIfChanged();
    }
    saveT -= dt;
    if (saveT <= 0) { saveT = 3; save(); }

    currentGameLoop = requestAnimationFrame(loop);
  }

  let lastGain = -1;
  function renderPrestigeIfChanged() {
    const g = potentialChips();
    if (g !== lastGain) { lastGain = g; renderPrestige(); }
  }

  currentGameLoop = requestAnimationFrame(loop);
}
