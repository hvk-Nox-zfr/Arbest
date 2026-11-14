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
      #memory-board[data-game="clicker"] { scrollbar-width: thin; scrollbar-color: #5664b8 #111832; }
      #memory-board[data-game="clicker"] button { font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      #memory-board[data-game="clicker"] .cl-shell { min-height: 100%; padding: 4px 2px 10px; color: #f6f7ff; }
      #memory-board[data-game="clicker"] .cl-topline { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:4px 3px 12px; }
      #memory-board[data-game="clicker"] .cl-brand { display:flex; align-items:center; gap:9px; text-align:left; }
      #memory-board[data-game="clicker"] .cl-brand-icon { display:grid; place-items:center; width:39px; height:39px; border-radius:13px; font-size:23px; background:linear-gradient(145deg,#273e83,#151c42); border:1px solid #637cf4; box-shadow:0 5px 15px #05091c; }
      #memory-board[data-game="clicker"] .cl-brand b { display:block; font-family:system-ui,sans-serif; font-size:15px; font-weight:1000; letter-spacing:1.5px; color:#fff; text-shadow:0 2px 0 #26346d; }
      #memory-board[data-game="clicker"] .cl-brand small { display:block; margin-top:1px; color:#8c9bd0; font:700 9px system-ui,sans-serif; letter-spacing:1.7px; }
      #memory-board[data-game="clicker"] .cl-level { padding:7px 10px; border:1px solid #5265b4; border-radius:999px; color:#cbd5ff; background:#18234a; font:800 10px system-ui,sans-serif; letter-spacing:1px; white-space:nowrap; }
      #memory-board[data-game="clicker"] .cl-wallet { position:relative; display:flex; align-items:center; justify-content:space-between; overflow:hidden; padding:14px 16px; margin-bottom:10px; border:1px solid #586bd0; border-radius:19px; background:linear-gradient(120deg,#222e68 0%,#263f8c 52%,#452d83 100%); box-shadow:0 8px 22px #05091b, inset 0 1px 0 #ffffff2b; }
      #memory-board[data-game="clicker"] .cl-wallet:after { content:""; position:absolute; width:160px; height:160px; right:-54px; top:-82px; border-radius:50%; background:#9eb9ff18; border:1px solid #b4c5ff24; }
      #memory-board[data-game="clicker"] .cl-wallet-label { color:#c3d0ff; font:900 10px system-ui,sans-serif; letter-spacing:2px; }
      #memory-board[data-game="clicker"] .cl-coins { margin-top:3px; font:1000 clamp(27px,7vw,38px)/1.05 system-ui,sans-serif; color:#ffe58a; text-shadow:0 3px 0 #88551c,0 0 18px #ffc84d45; letter-spacing:-1px; }
      #memory-board[data-game="clicker"] .cl-cps { margin-top:5px; color:#c5d7ff; font:700 11px system-ui,sans-serif; }
      #memory-board[data-game="clicker"] .cl-wallet-gem { z-index:1; display:grid; place-items:center; width:54px; height:54px; border-radius:17px; font-size:31px; background:linear-gradient(145deg,#667af7,#29378c); border:1px solid #a4b6ff; box-shadow:0 7px 18px #07112c; transform:rotate(7deg); }
      #memory-board[data-game="clicker"] .cl-core-panel { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:220px; margin:0 0 10px; padding:10px 8px 13px; border:1px solid #5268be; border-radius:22px; background:radial-gradient(ellipse at 50% 58%,#294c8e 0%,#172754 46%,#101a39 100%); box-shadow:inset 0 1px 0 #ffffff20,0 9px 20px #05091a; }
      #memory-board[data-game="clicker"] .cl-core-panel:before { content:""; position:absolute; inset:0; opacity:.24; background-image:radial-gradient(#a9c8ff 1px,transparent 1px); background-size:19px 19px; mask-image:linear-gradient(transparent,#000 20%,#000 80%,transparent); pointer-events:none; }
      #memory-board[data-game="clicker"] .cl-core-panel:after { content:""; position:absolute; width:220px; height:90px; bottom:30px; border-radius:50%; border:1px solid #62dcff59; box-shadow:0 0 25px #3fbaff25,inset 0 0 24px #38c9ff18; transform:perspective(100px) rotateX(55deg); pointer-events:none; }
      #memory-board[data-game="clicker"] .cl-core-label { z-index:1; margin:2px 0 0; color:#dce8ff; font:900 10px system-ui,sans-serif; letter-spacing:2.3px; text-align:center; }
      #memory-board[data-game="clicker"] .cl-core-title { display:inline-flex; align-items:center; justify-content:center; gap:7px; margin:2px 0 7px; padding:8px 14px; border:1px solid #ffe27a; border-radius:999px; background:linear-gradient(180deg,#fff0a8,#ffbd3d); color:#53300b; font:1000 11px system-ui,sans-serif; letter-spacing:.8px; text-shadow:0 1px 0 #fff8d6; box-shadow:0 4px 0 #a85e1d,0 0 18px #ffc64b55; }
      #memory-board[data-game="clicker"] .cl-core-wrap { position:relative; display:flex; align-items:center; justify-content:center; width:100%; min-height:174px; }
      #memory-board[data-game="clicker"] .cl-core { z-index:1; position:relative; display:grid; place-items:center; width:190px; height:164px; padding:0; border:2px solid #65eaff; border-radius:30px; outline:0; background:radial-gradient(ellipse at 50% 30%,#427ed1 0%,#244b91 68%,#172c5e 100%); box-shadow:0 7px 0 #10224e,0 0 0 5px #64eaff20,0 0 28px #42dfff70,inset 0 2px 0 #ffffff55; cursor:pointer; touch-action:manipulation; filter:drop-shadow(0 10px 9px #05091b88); transition:transform .12s ease,filter .12s ease,box-shadow .12s ease; animation:clbuttonpulse 1.8s ease-in-out infinite; }
      #memory-board[data-game="clicker"] .cl-core:hover { transform:translateY(-3px) scale(1.025); filter:drop-shadow(0 13px 13px #05091baa); box-shadow:0 10px 0 #10224e,0 0 0 6px #64eaff30,0 0 36px #42dfffaa,inset 0 2px 0 #ffffff66; }
      #memory-board[data-game="clicker"] .cl-core:active { transform:scale(.92) translateY(3px); box-shadow:0 2px 0 #10224e,0 0 26px #ffe276aa,inset 0 2px 0 #ffffff66; animation:none; }
      #memory-board[data-game="clicker"] .cl-core:focus-visible { outline:3px solid #fff2a0; outline-offset:5px; }
      #memory-board[data-game="clicker"] .cl-tap-hint { position:absolute; z-index:3; right:calc(50% - 142px); top:18px; display:flex; align-items:center; gap:4px; padding:7px 10px; border:2px solid #fff0a3; border-radius:12px; background:linear-gradient(135deg,#ffdd63,#ff9d32); color:#48280c; font:1000 11px system-ui,sans-serif; box-shadow:0 4px 0 #9e5219,0 0 16px #ffcf4d88; pointer-events:none; animation:clhintbounce 1s ease-in-out infinite; }
      #memory-board[data-game="clicker"] .cl-core-foot { margin-top:7px; color:#c9dcff; font:800 10px system-ui,sans-serif; letter-spacing:.6px; }
      @keyframes clbuttonpulse { 0%,100%{box-shadow:0 7px 0 #10224e,0 0 0 4px #64eaff18,0 0 20px #42dfff55,inset 0 2px 0 #ffffff55} 50%{box-shadow:0 7px 0 #10224e,0 0 0 8px #64eaff08,0 0 34px #42dfff99,inset 0 2px 0 #ffffff70} }
      @keyframes clhintbounce { 0%,100%{transform:translateY(0) rotate(2deg)} 50%{transform:translateY(-6px) rotate(-2deg)} }
      #memory-board[data-game="clicker"] .cl-mascot { width:100%; height:100%; overflow:visible; animation:clbob 2.2s ease-in-out infinite; transform-origin:50% 70%; }
      #memory-board[data-game="clicker"] .cl-core:active .cl-mascot { animation:none; }
      #memory-board[data-game="clicker"] .cl-eye { transform-box:fill-box; transform-origin:center; animation:clblink 4.8s infinite; }
      #memory-board[data-game="clicker"] .cl-arm-l { transform-box:fill-box; transform-origin:90% 20%; animation:clwave 1.8s ease-in-out infinite; }
      #memory-board[data-game="clicker"] .cl-arm-r { transform-box:fill-box; transform-origin:10% 20%; animation:clwave 1.8s ease-in-out -.9s infinite; }
      #memory-board[data-game="clicker"] .cl-spark { animation:clspark 2.2s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
      @keyframes clbob { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-7px) rotate(1deg)} }
      @keyframes clblink { 0%,45%,49%,100%{transform:scaleY(1)} 47%{transform:scaleY(.12)} }
      @keyframes clwave { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-8deg)} }
      @keyframes clspark { 0%,100%{opacity:.55;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
      #memory-board[data-game="clicker"] .cl-float { position:absolute; z-index:4; top:15%; pointer-events:none; font:1000 19px system-ui,sans-serif; color:#ffe889; text-shadow:0 2px 0 #563d17,0 0 12px #ffca47; animation:clfloat .85s ease-out forwards; }
      @keyframes clfloat { to { transform:translateY(-68px) scale(1.12); opacity:0; } }
      #memory-board[data-game="clicker"] .cl-banner { display:none; margin:7px 0; padding:10px 12px; border-radius:13px; font:800 12px system-ui,sans-serif; text-align:center; }
      #memory-board[data-game="clicker"] .cl-frenzy { background:linear-gradient(90deg,#622e42,#8a431e); border:1px solid #ff985e; color:#ffe1b9; box-shadow:0 0 15px #ff713522; }
      #memory-board[data-game="clicker"] .cl-toast { background:#113e46; border:1px solid #45d6b3; color:#b3ffe8; }
      #memory-board[data-game="clicker"] .cl-daily { display:none; width:100%; margin:7px 0; padding:12px; border-radius:14px; border:1px solid #e4b951; background:linear-gradient(100deg,#5b4422,#302a49); color:#ffe69a; font:900 12px system-ui,sans-serif; box-shadow:0 5px 13px #070b1d; }
      #memory-board[data-game="clicker"] .cl-qty { display:flex; gap:6px; justify-content:space-between; margin:7px 0 12px; padding:5px; border:1px solid #303e70; border-radius:13px; background:#101a36; }
      #memory-board[data-game="clicker"] .cl-qty button { flex:1; padding:8px 4px; border-radius:9px; border:1px solid transparent; background:transparent; color:#aab7e7; font:900 11px system-ui,sans-serif; }
      #memory-board[data-game="clicker"] .cl-qty button.on { border-color:#57d8ff; color:#fff; background:linear-gradient(135deg,#27639b,#35439a); box-shadow:0 0 12px #3caaff35; }
      #memory-board[data-game="clicker"] .cl-section { margin:14px 0 7px; display:flex; align-items:center; gap:8px; color:#b5c7ff; font:1000 11px system-ui,sans-serif; letter-spacing:2px; }
      #memory-board[data-game="clicker"] .cl-section:after { content:""; height:1px; flex:1; background:linear-gradient(90deg,#5368ae55,transparent); }
      #memory-board[data-game="clicker"] .cl-row { position:relative; display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:10px; margin-bottom:7px; border-radius:14px; border:1px solid #34436f; background:linear-gradient(110deg,#1a2548,#151e3a); color:#fff; box-shadow:0 4px 10px #05091a65,inset 0 1px 0 #ffffff0b; transition:transform .12s,border-color .12s,background .12s; }
      #memory-board[data-game="clicker"] .cl-row:active { transform:scale(.985); }
      #memory-board[data-game="clicker"] .cl-row.can { border-color:#48c9c1; background:linear-gradient(110deg,#173c54,#1b3150); box-shadow:0 0 13px #34d2ce17,inset 0 1px 0 #ffffff13; }
      #memory-board[data-game="clicker"] .cl-row.no { opacity:.72; }
      #memory-board[data-game="clicker"] .cl-ico { display:grid; place-items:center; font-size:25px; width:42px; height:42px; border-radius:12px; flex:none; background:linear-gradient(145deg,#344a82,#202c57); border:1px solid #556ba4; box-shadow:inset 0 1px 0 #ffffff20; }
      #memory-board[data-game="clicker"] .cl-info { flex:1; min-width:0; }
      #memory-board[data-game="clicker"] .cl-name { font:900 13px system-ui,sans-serif; color:#f2f5ff; }
      #memory-board[data-game="clicker"] .cl-sub { margin-top:3px; font:600 10px/1.35 system-ui,sans-serif; color:#9eadd7; }
      #memory-board[data-game="clicker"] .cl-cost { font:1000 12px system-ui,sans-serif; color:#ffdf83; white-space:nowrap; }
      #memory-board[data-game="clicker"] .cl-end { width:100%; margin-top:15px; padding:12px; border-radius:13px; border:1px solid #bd5975; background:linear-gradient(100deg,#542842,#342241); color:#ffc4d3; font:900 11px system-ui,sans-serif; letter-spacing:.5px; }
      @media (max-width:420px) { #memory-board[data-game="clicker"] .cl-core { width:164px;height:145px } #memory-board[data-game="clicker"] .cl-wallet { padding:12px } #memory-board[data-game="clicker"] .cl-name {font-size:12px} }
      @media (prefers-reduced-motion: reduce) { #memory-board[data-game="clicker"] .cl-mascot,#memory-board[data-game="clicker"] .cl-eye,#memory-board[data-game="clicker"] .cl-arm-l,#memory-board[data-game="clicker"] .cl-arm-r,#memory-board[data-game="clicker"] .cl-spark,#memory-board[data-game="clicker"] .cl-core,#memory-board[data-game="clicker"] .cl-tap-hint { animation:none; } }
    </style>

    <div class="cl-shell">
      <div class="cl-topline">
        <div class="cl-brand"><span class="cl-brand-icon">⛏️</span><div><b>CYBER MINER</b><small>GALAXY CLICKER</small></div></div>
        <span class="cl-level">✦ MINER EN CHEF</span>
      </div>

      <div class="cl-wallet">
        <div><div class="cl-wallet-label">TES CRÉDITS</div><div class="cl-coins" id="cl-coins">0</div><div class="cl-cps" id="cl-cps">0 pièce / seconde</div></div>
        <div class="cl-wallet-gem">💎</div>
      </div>

      <div class="cl-core-panel">
        <div class="cl-core-label cl-core-title">👆 CLIQUE SUR LE ROBOT POUR MINER</div>
        <div class="cl-core-wrap">
          <div class="cl-tap-hint">CLIQUE !</div>
          <button class="cl-core" id="cl-core" type="button" title="Clique ici pour gagner des crédits" aria-label="Cliquer sur le robot pour gagner des crédits">
            <svg class="cl-mascot" viewBox="0 0 220 190" role="img" aria-label="Petit robot mineur" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="clBotBody" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".55" stop-color="#d8e8ff"/><stop offset="1" stop-color="#829fd8"/></linearGradient>
                <linearGradient id="clBotBlue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#69efff"/><stop offset="1" stop-color="#2784dc"/></linearGradient>
                <linearGradient id="clBotGold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe999"/><stop offset="1" stop-color="#f3a52e"/></linearGradient>
              </defs>
              <g class="cl-spark" fill="#9ff6ff"><path d="M28 48l5 12 12 5-12 5-5 12-5-12-12-5 12-5z"/><circle cx="190" cy="63" r="4"/><path d="M178 125l4 9 9 4-9 4-4 9-4-9-9-4 9-4z"/></g>
              <ellipse cx="110" cy="169" rx="65" ry="10" fill="#07142f" opacity=".5"/>
              <g class="cl-arm-l"><path d="M57 108Q32 117 29 139" fill="none" stroke="#263d78" stroke-width="21" stroke-linecap="round"/><path d="M57 108Q32 117 29 139" fill="none" stroke="url(#clBotBody)" stroke-width="14" stroke-linecap="round"/><circle cx="27" cy="144" r="12" fill="#eaf4ff" stroke="#4765a6" stroke-width="4"/></g>
              <g class="cl-arm-r"><path d="M161 106Q188 114 191 136" fill="none" stroke="#263d78" stroke-width="21" stroke-linecap="round"/><path d="M161 106Q188 114 191 136" fill="none" stroke="url(#clBotBody)" stroke-width="14" stroke-linecap="round"/><circle cx="193" cy="141" r="12" fill="#eaf4ff" stroke="#4765a6" stroke-width="4"/></g>
              <path d="M80 139l-7 22q-2 8 8 8h22l6-24zM129 145l7 20q3 7 11 4l18-8-11-22z" fill="#405a9a"/>
              <path d="M85 143l-4 18h19l5-18zM137 146l6 16 15-6-8-15z" fill="url(#clBotBlue)"/>
              <rect x="51" y="53" width="118" height="99" rx="31" fill="#26396f" stroke="#101d49" stroke-width="7"/>
              <rect x="57" y="49" width="106" height="94" rx="28" fill="url(#clBotBody)" stroke="#f8fbff" stroke-width="3"/>
              <path d="M67 72Q110 45 153 72" fill="none" stroke="#fff" stroke-width="7" opacity=".65" stroke-linecap="round"/>
              <rect x="70" y="78" width="80" height="43" rx="19" fill="#18284e" stroke="#607bb8" stroke-width="3"/>
              <g class="cl-eye"><ellipse cx="93" cy="98" rx="8" ry="11" fill="#7bf4ff"/><ellipse cx="127" cy="98" rx="8" ry="11" fill="#7bf4ff"/><circle cx="95" cy="95" r="3" fill="#fff"/><circle cx="129" cy="95" r="3" fill="#fff"/></g>
              <path d="M99 111q11 9 22 0" fill="none" stroke="#6c91c9" stroke-width="3" stroke-linecap="round"/>
              <rect x="94" y="130" width="32" height="14" rx="7" fill="#253d7b"/><path d="M102 132h16l-8 9z" fill="url(#clBotBlue)"/>
              <path d="M108 48V32" stroke="#d9eaff" stroke-width="6" stroke-linecap="round"/><circle cx="108" cy="25" r="10" fill="#ffcb65" stroke="#fff0b8" stroke-width="3"/>
              <path d="M47 79q-14-14-8-29 13-7 22 4M173 78q14-14 8-29-13-7-22 4" fill="#6ddff7" stroke="#d7f7ff" stroke-width="4"/>
              <g transform="translate(153 17) rotate(28)"><path d="M0 7h48" stroke="#b4c9e8" stroke-width="7" stroke-linecap="round"/><path d="M40 -7l17 14-17 14" fill="none" stroke="#ffd06b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 -3l12 10-12 10" fill="none" stroke="#fff0b6" stroke-width="3" stroke-linecap="round"/></g>
            </svg>
          </button>
        </div>
        <div class="cl-core-label cl-core-foot">Chaque clic te rapporte des crédits • ESPACE / ENTRÉE</div>
      </div>

      <div class="cl-banner cl-frenzy" id="cl-frenzy"></div>
      <div class="cl-banner cl-toast" id="cl-toast"></div>
      <button class="cl-daily" id="cl-daily"></button>

      <div class="cl-qty" id="cl-qty">
        <button data-q="1" class="on">×1</button><button data-q="10">×10</button><button data-q="100">×100</button><button data-q="0">MAX</button>
      </div>

      <div class="cl-section">⚡ AMÉLIORER TON CLIC</div>
      <button class="cl-row" id="cl-clickup"></button>

      <div class="cl-section">🛠️ TES GÉNÉRATEURS</div>
      <div id="cl-gens"></div>

      <div class="cl-section">✨ TECHNOLOGIES À DÉBLOQUER</div>
      <div id="cl-upgs"></div>

      <div class="cl-section">🚀 OVERCLOCK</div>
      <div id="cl-prestige"></div>

      <button class="cl-end" id="cl-end">TERMINER LA SESSION ET ENREGISTRER MON SCORE</button>
    </div>
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
