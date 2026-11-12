/* =========================================================
   ARBEST ARCADE — MORPION / module autonome
   Aucun changement requis dans les autres jeux.
   ========================================================= */
(function () {
  'use strict';

  if (window.__arbestMorpion && typeof window.__arbestMorpion.destroy === 'function') {
    window.__arbestMorpion.destroy();
  }

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const state = {
    root: null,
    container: null,
    canvas: null,
    memory: null,
    overlay: null,
    previous: null,
    board: Array(9).fill(''),
    turn: 'X',
    over: false,
    mode: 'menu',
    difficulty: 'easy',
    score: { X: 0, O: 0, D: 0 },
    botTimer: null,
    peer: null,
    channel: null,
    roomCode: null,
    peerScriptPromise: null,
    connectionTimer: null,
    host: false,
    connected: false,
    clickHandler: null,
    keyHandler: null,
    destroyed: false
  };

  const $ = (selector) => state.root && state.root.querySelector(selector);

  function getResult(board) {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
    return board.every(Boolean) ? { winner: 'D', line: [] } : null;
  }

  function mount() {
    if (state.root && state.root.isConnected) return;

    const container = document.querySelector('.canvas-container');
    const canvas = document.getElementById('game-canvas');
    const memory = document.getElementById('memory-board');
    const overlay = document.getElementById('game-overlay');
    if (!container || !canvas || !memory) {
      throw new Error('Arbest : .canvas-container, #game-canvas ou #memory-board introuvable.');
    }

    state.container = container;
    state.canvas = canvas;
    state.memory = memory;
    state.overlay = overlay;
    state.previous = {
      canvasHidden: canvas.classList.contains('hidden'),
      memoryHidden: memory.classList.contains('hidden'),
      overlayHidden: !overlay || overlay.classList.contains('hidden'),
      hostClass: container.classList.contains('am-morpion-host')
    };

    canvas.classList.add('hidden');
    memory.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
    container.classList.add('am-morpion-host');

    const root = document.createElement('section');
    root.id = 'arbest-morpion';
    root.setAttribute('aria-label', 'Jeu Morpion');
    root.innerHTML = `
      <style>
        .canvas-container.am-morpion-host {
          display:block!important; position:relative!important; height:auto!important;
          min-height:0!important; max-height:none!important; overflow:visible!important;
          padding:clamp(10px,2vw,22px)!important; background:#07101d!important;
          border:1px solid rgba(75,210,255,.22)!important; border-radius:20px!important;
          box-shadow:0 18px 55px rgba(0,0,0,.32), inset 0 0 50px rgba(19,91,145,.08)!important;
        }
        #arbest-morpion, #arbest-morpion * { box-sizing:border-box; }
        #arbest-morpion {
          --am-bg:#081321; --am-panel:#0e1c30; --am-panel2:#12243b;
          --am-border:rgba(127,170,215,.19); --am-text:#eef5ff;
          --am-muted:#91a7c4; --am-cyan:#4bd8ff; --am-blue:#568cff;
          width:100%; min-height:560px; position:relative; isolation:isolate;
          overflow:hidden; padding:clamp(18px,3.2vw,38px);
          color:var(--am-text); border:1px solid rgba(76,214,255,.48);
          border-radius:16px; background:
            radial-gradient(ellipse at 50% -20%,rgba(40,137,205,.25),transparent 55%),
            radial-gradient(circle at 0% 100%,rgba(39,91,151,.13),transparent 35%),
            linear-gradient(145deg,#0b1728,#07101c 72%);
          font-family:Rajdhani,Arial,sans-serif; text-align:left;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
        }
        #arbest-morpion:before { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none;
          opacity:.15; background-image:linear-gradient(rgba(120,174,220,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(120,174,220,.13) 1px,transparent 1px);
          background-size:34px 34px; mask-image:linear-gradient(to bottom,black,transparent 92%); }
        #arbest-morpion button, #arbest-morpion input, #arbest-morpion textarea { font:inherit; }
        #arbest-morpion button { -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
        #arbest-morpion .am-shell { max-width:1050px; margin:0 auto; }
        #arbest-morpion .am-topline { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:15px; }
        #arbest-morpion .am-brand { display:flex; align-items:center; gap:10px; color:#9cb4d2; font-size:12px; font-weight:800; letter-spacing:2.4px; text-transform:uppercase; }
        #arbest-morpion .am-brand-mark { width:9px; height:9px; border-radius:3px; background:var(--am-cyan); box-shadow:0 0 17px rgba(75,216,255,.9); transform:rotate(45deg); }
        #arbest-morpion .am-version { color:#6f87a7; border:1px solid var(--am-border); border-radius:99px; padding:5px 10px; font-size:11px; letter-spacing:1.2px; }
        #arbest-morpion .am-heading { text-align:center; margin:14px auto 26px; }
        #arbest-morpion .am-title { margin:0; font:900 clamp(34px,6vw,62px)/1 Orbitron,Arial,sans-serif; letter-spacing:clamp(2px,.6vw,7px); color:#f1f6ff; text-shadow:0 8px 35px rgba(55,158,226,.16); }
        #arbest-morpion .am-title span { color:var(--am-cyan); }
        #arbest-morpion .am-subtitle { color:#90a6c3; margin:12px 0 0; font-size:clamp(15px,2.1vw,19px); letter-spacing:.5px; }
        #arbest-morpion .am-panel { position:relative; max-width:850px; margin:0 auto; padding:clamp(17px,3vw,30px); border:1px solid var(--am-border); border-radius:18px; background:linear-gradient(145deg,rgba(18,34,55,.95),rgba(10,22,38,.95)); box-shadow:0 17px 45px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.035); }
        #arbest-morpion .am-panel-title { margin:0 0 20px; text-align:center; font:800 clamp(21px,3vw,29px) Orbitron,Arial,sans-serif; letter-spacing:.3px; }
        #arbest-morpion .am-mode-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        #arbest-morpion .am-mode { min-height:105px; display:flex; align-items:center; gap:15px; padding:17px; text-align:left; color:var(--am-text); cursor:pointer; border:1px solid rgba(123,165,210,.22); border-radius:13px; background:linear-gradient(145deg,rgba(27,49,76,.9),rgba(17,33,54,.92)); transition:transform .18s,border-color .18s,background .18s,box-shadow .18s; }
        #arbest-morpion .am-mode:hover { transform:translateY(-3px); border-color:rgba(75,216,255,.65); background:linear-gradient(145deg,#1b3a5b,#122b48); box-shadow:0 12px 25px rgba(0,0,0,.2),0 0 22px rgba(75,216,255,.08); }
        #arbest-morpion .am-mode:focus-visible, #arbest-morpion .am-btn:focus-visible, #arbest-morpion .am-cell:focus-visible { outline:3px solid var(--am-cyan); outline-offset:3px; }
        #arbest-morpion .am-mode-icon { width:48px; height:48px; flex:0 0 48px; display:grid; place-items:center; border-radius:12px; background:rgba(78,172,235,.12); border:1px solid rgba(100,185,255,.16); font-size:24px; }
        #arbest-morpion .am-mode-copy { min-width:0; }
        #arbest-morpion .am-mode-name { display:block; font:800 14px Orbitron,Arial,sans-serif; letter-spacing:.35px; }
        #arbest-morpion .am-mode-desc { display:block; color:#8fa8c6; margin-top:7px; font-size:14px; line-height:1.25; }
        #arbest-morpion .am-mode.online { grid-column:1/-1; min-height:76px; border-color:rgba(48,208,185,.3); background:linear-gradient(100deg,rgba(15,94,91,.48),rgba(20,59,76,.86)); }
        #arbest-morpion .am-mode.online .am-mode-icon { background:rgba(49,223,194,.13); border-color:rgba(49,223,194,.24); }
        #arbest-morpion .am-mode.online:hover { border-color:rgba(49,223,194,.75); }
        #arbest-morpion .am-footnote { text-align:center; color:#8198b7; font-size:14px; line-height:1.55; margin:17px 0 0; }
        #arbest-morpion .am-hidden { display:none!important; }
        #arbest-morpion .am-btn { min-height:43px; padding:10px 16px; border:1px solid rgba(123,165,210,.26); border-radius:10px; background:#182d49; color:#edf5ff; font-size:13px; font-weight:800; letter-spacing:.65px; cursor:pointer; transition:background .16s,border-color .16s,transform .16s; }
        #arbest-morpion .am-btn:hover { background:#23466f; border-color:rgba(75,216,255,.55); }
        #arbest-morpion .am-btn:active { transform:scale(.98); }
        #arbest-morpion .am-btn.primary { background:linear-gradient(105deg,#176dbb,#277fce); border-color:#419ce9; box-shadow:0 6px 18px rgba(24,111,190,.2); }
        #arbest-morpion .am-btn.primary:hover { background:linear-gradient(105deg,#2185d8,#3699e8); }
        #arbest-morpion .am-btn.ghost { background:rgba(255,255,255,.035); }
        #arbest-morpion .am-btn.wide { width:100%; }
        #arbest-morpion .am-muted { color:var(--am-muted); font-size:14px; line-height:1.55; }
        #arbest-morpion .am-online-actions { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:17px; }
        #arbest-morpion .am-online-card { padding:16px; border:1px solid var(--am-border); border-radius:13px; background:rgba(7,17,30,.48); min-width:0; }
        #arbest-morpion .am-online-card h3 { margin:0 0 7px; font:800 14px Orbitron,Arial,sans-serif; }
        #arbest-morpion .am-online-card p { margin:0 0 12px; }
        #arbest-morpion .am-field { display:block; width:100%; min-width:0; color:#edf5ff; background:#071321; border:1px solid #294765; border-radius:9px; padding:12px; margin:9px 0; font:13px/1.45 ui-monospace,Menlo,monospace; resize:vertical; }
        #arbest-morpion textarea.am-field { min-height:100px; }
        #arbest-morpion .am-field:focus { outline:2px solid rgba(75,216,255,.45); border-color:#4bd8ff; }
        #arbest-morpion .am-room-code { min-height:58px; text-align:center; font:900 30px/1.2 Orbitron,Arial,sans-serif; letter-spacing:8px; resize:none; }
        #arbest-morpion .am-room-code { min-height:58px; text-align:center; font:900 30px/1.2 Orbitron,Arial,sans-serif; letter-spacing:8px; resize:none; }
        #arbest-morpion .am-statusline { min-height:23px; margin:14px 0 0; color:#66e2bf; text-align:center; font-size:14px; }
        #arbest-morpion .am-warning { margin-top:13px; padding:11px 13px; color:#a9bdd5; background:rgba(10,23,39,.7); border:1px solid var(--am-border); border-radius:9px; font-size:13px; line-height:1.5; }
        #arbest-morpion .am-backline { margin-top:13px; }
        #arbest-morpion .am-game-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:20px; }
        #arbest-morpion .am-game-label { color:#88a4c5; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-weight:800; }
        #arbest-morpion .am-turn { margin-top:7px; font:800 clamp(18px,3vw,25px) Orbitron,Arial,sans-serif; }
        #arbest-morpion .am-turn .x { color:#55caff; }
        #arbest-morpion .am-turn .o { color:#ff83bd; }
        #arbest-morpion .am-scorebar { display:flex; gap:8px; }
        #arbest-morpion .am-score { min-width:72px; padding:9px 11px; text-align:center; border:1px solid var(--am-border); border-radius:10px; background:rgba(7,17,30,.55); }
        #arbest-morpion .am-score strong { display:block; font:800 20px Orbitron,Arial,sans-serif; }
        #arbest-morpion .am-score span { display:block; margin-top:3px; color:#8299b7; font-size:10px; letter-spacing:1px; }
        #arbest-morpion .am-score.x strong { color:#55caff; }
        #arbest-morpion .am-score.o strong { color:#ff83bd; }
        #arbest-morpion .am-score.draw strong { color:#c4d2e4; }
        #arbest-morpion .am-board-wrap { width:100%; max-width:465px; margin:0 auto; padding:12px; border:1px solid rgba(91,155,210,.22); border-radius:18px; background:linear-gradient(145deg,rgba(6,16,29,.9),rgba(15,32,53,.8)); box-shadow:inset 0 0 32px rgba(29,103,163,.08),0 12px 30px rgba(0,0,0,.18); }
        #arbest-morpion .am-board { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
        #arbest-morpion .am-cell { position:relative; display:grid; place-items:center; aspect-ratio:1; min-width:0; padding:0; overflow:hidden; cursor:pointer; border:1px solid rgba(113,158,203,.24); border-radius:12px; color:white; background:linear-gradient(145deg,#162d49,#0d1d31); box-shadow:inset 0 1px 0 rgba(255,255,255,.035); transition:background .16s,border-color .16s,transform .16s; }
        #arbest-morpion .am-cell:not(:disabled):hover { border-color:rgba(75,216,255,.72); background:linear-gradient(145deg,#1d3e60,#132a44); transform:translateY(-2px); }
        #arbest-morpion .am-cell:disabled { cursor:default; }
        #arbest-morpion .am-symbol { font:900 clamp(38px,9vw,76px)/1 Orbitron,Arial,sans-serif; transform:translateY(-2px); }
        #arbest-morpion .am-cell.x .am-symbol { color:#57caff; text-shadow:0 0 22px rgba(54,184,255,.42); }
        #arbest-morpion .am-cell.o .am-symbol { color:#ff83bd; text-shadow:0 0 22px rgba(255,98,170,.38); }
        #arbest-morpion .am-cell.winner { border-color:#65e9b5; background:linear-gradient(145deg,rgba(30,104,83,.72),rgba(15,53,50,.9)); box-shadow:0 0 19px rgba(67,226,164,.12),inset 0 0 20px rgba(67,226,164,.1); }
        #arbest-morpion .am-cell.winner .am-symbol { color:#8af0bf; text-shadow:0 0 20px rgba(67,226,164,.5); }
        #arbest-morpion .am-game-bottom { display:flex; justify-content:center; flex-wrap:wrap; gap:10px; margin-top:19px; }
        #arbest-morpion .am-playerline { color:#91a7c4; text-align:center; margin:13px 0 0; font-size:14px; }
        #arbest-morpion .am-game-message { text-align:center; min-height:24px; color:#8fa7c5; margin-top:12px; font-size:13px; }
        #arbest-morpion .am-result { margin:17px auto 0; max-width:465px; padding:14px; text-align:center; border:1px solid rgba(75,216,255,.25); border-radius:12px; background:rgba(10,31,51,.65); }
        #arbest-morpion .am-result strong { display:block; font:800 18px Orbitron,Arial,sans-serif; }
        #arbest-morpion .am-result span { display:block; margin-top:5px; color:#91a7c4; font-size:13px; }
        @media(max-width:620px) {
          #arbest-morpion { min-height:0; padding:15px; }
          #arbest-morpion .am-topline { margin-bottom:8px; }
          #arbest-morpion .am-heading { margin:18px auto 22px; }
          #arbest-morpion .am-mode-grid { gap:9px; }
          #arbest-morpion .am-mode { min-height:94px; padding:12px; gap:10px; }
          #arbest-morpion .am-mode-icon { width:40px; height:40px; flex-basis:40px; font-size:20px; }
          #arbest-morpion .am-mode-name { font-size:11px; }
          #arbest-morpion .am-mode-desc { font-size:12px; }
          #arbest-morpion .am-online-actions { grid-template-columns:1fr; }
          #arbest-morpion .am-room-code { font-size:25px; letter-spacing:5px; }
          #arbest-morpion .am-score { min-width:58px; padding:7px; }
          #arbest-morpion .am-score strong { font-size:17px; }
          #arbest-morpion .am-board-wrap { padding:8px; }
          #arbest-morpion .am-board { gap:6px; }
        }
        @media(max-width:390px) {
          #arbest-morpion .am-mode-grid { grid-template-columns:1fr; }
          #arbest-morpion .am-mode.online { grid-column:auto; }
          #arbest-morpion .am-mode { min-height:76px; }
          #arbest-morpion .am-game-head { align-items:flex-start; }
          #arbest-morpion .am-scorebar { width:100%; }
          #arbest-morpion .am-score { flex:1; }
        }
      </style>

      <div class="am-shell">
        <div class="am-topline">
          <div class="am-brand"><i class="am-brand-mark"></i> ARBEST ARCADE</div>
          <div class="am-version">DUEL · 01</div>
        </div>

        <header class="am-heading">
          <h1 class="am-title">MOR<span>PI</span>ON</h1>
          <p class="am-subtitle">La stratégie tient dans neuf cases.</p>
        </header>

        <section class="am-panel" data-screen="menu">
          <h2 class="am-panel-title">Choisis ton mode</h2>
          <div class="am-mode-grid">
            <button type="button" class="am-mode" data-action="start" data-mode="easy">
              <span class="am-mode-icon">🤖</span><span class="am-mode-copy"><strong class="am-mode-name">BOT FACILE</strong><span class="am-mode-desc">Pour se détendre</span></span>
            </button>
            <button type="button" class="am-mode" data-action="start" data-mode="medium">
              <span class="am-mode-icon">🧠</span><span class="am-mode-copy"><strong class="am-mode-name">BOT MOYEN</strong><span class="am-mode-desc">Il sait attaquer et bloquer</span></span>
            </button>
            <button type="button" class="am-mode" data-action="start" data-mode="hard">
              <span class="am-mode-icon">🔥</span><span class="am-mode-copy"><strong class="am-mode-name">BOT DIFFICILE</strong><span class="am-mode-desc">Stratégie optimale</span></span>
            </button>
            <button type="button" class="am-mode" data-action="start" data-mode="local">
              <span class="am-mode-icon">👥</span><span class="am-mode-copy"><strong class="am-mode-name">2 JOUEURS LOCAL</strong><span class="am-mode-desc">Un écran, deux joueurs</span></span>
            </button>
            <button type="button" class="am-mode online" data-action="online">
              <span class="am-mode-icon">🌐</span><span class="am-mode-copy"><strong class="am-mode-name">JOUER EN LIGNE</strong><span class="am-mode-desc">Invite un ami avec un code de connexion</span></span>
            </button>
          </div>
          <p class="am-footnote">Facile : coups aléatoires · Moyen : tactique · Difficile : ne perd jamais.</p>
        </section>

        <section class="am-panel am-hidden" data-screen="online">
          <h2 class="am-panel-title">Jouer avec un ami</h2>
          <p class="am-muted" style="text-align:center;margin:-7px 0 22px">Un code à 6 chiffres. Rien à copier d'autre.</p>
          <div class="am-online-actions">
            <div class="am-online-card">
              <h3>Créer une partie</h3>
              <p class="am-muted">Crée un salon et envoie le code à ton ami.</p>
              <button type="button" class="am-btn primary wide" data-action="create-room">GÉNÉRER UN CODE</button>
              <div class="am-hidden" data-show="host" style="margin-top:15px">
                <label class="am-muted" for="am-room-code">TON CODE DE PARTIE</label>
                <input class="am-field am-room-code" id="am-room-code" type="text" readonly value="" aria-label="Code de partie">
                <button type="button" class="am-btn wide" data-action="copy" data-copy="am-room-code">📋 COPIER LE CODE</button>
                <p class="am-muted" style="margin:12px 0 0">En attente de ton ami… Garde cette fenêtre ouverte.</p>
              </div>
            </div>
            <div class="am-online-card">
              <h3>Rejoindre une partie</h3>
              <p class="am-muted">Entre les 6 chiffres que ton ami t'a envoyés.</p>
              <label class="am-muted" for="am-room-input">CODE DE TON AMI</label>
              <input class="am-field am-room-code" id="am-room-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" aria-label="Code à six chiffres">
              <button type="button" class="am-btn primary wide" data-action="join-room">REJOINDRE LA PARTIE</button>
            </div>
          </div>
          <div class="am-statusline" data-role="connection-status" aria-live="polite">Prêt à créer ou rejoindre une partie.</div>
          <div class="am-warning">La connexion utilise le service de mise en relation PeerJS, puis les coups sont échangés directement entre les deux navigateurs. Aucun serveur de jeu personnel à installer.</div>
          <div class="am-backline"><button type="button" class="am-btn ghost" data-action="back-menu">← RETOUR AUX MODES</button></div>
        </section>

        <section class="am-panel am-hidden" data-screen="game">
          <div class="am-game-head">
            <div><div class="am-game-label" data-role="mode-label">PARTIE EN COURS</div><div class="am-turn" data-role="turn">Au tour de X</div></div>
            <div class="am-scorebar" aria-label="Scores">
              <div class="am-score x"><strong data-score="X">0</strong><span>JOUEUR X</span></div>
              <div class="am-score o"><strong data-score="O">0</strong><span>JOUEUR O</span></div>
              <div class="am-score draw"><strong data-score="D">0</strong><span>NULS</span></div>
            </div>
          </div>
          <div class="am-board-wrap"><div class="am-board" data-role="board" role="group" aria-label="Plateau de morpion"></div></div>
          <p class="am-playerline" data-role="players">Joueur X contre joueur O</p>
          <div class="am-result am-hidden" data-role="result"><strong></strong><span></span></div>
          <div class="am-game-message" data-role="game-message" aria-live="polite"></div>
          <div class="am-game-bottom">
            <button type="button" class="am-btn primary" data-action="restart">↻ REJOUER</button>
            <button type="button" class="am-btn ghost" data-action="menu">MENU DU JEU</button>
          </div>
        </section>
      </div>`;

    state.root = root;
    container.appendChild(root);

    // Délégation en phase capture : les clics restent fiables même si un style ou
    // un gestionnaire global du site interrompt la propagation en phase normale.
    state.clickHandler = handleClick;
    root.addEventListener('click', state.clickHandler, true);
    state.keyHandler = handleKeydown;
    root.addEventListener('keydown', state.keyHandler, true);

    showScreen('menu');
  }

  function showScreen(name) {
    if (!state.root) return;
    state.root.querySelectorAll('[data-screen]').forEach((screen) => {
      screen.classList.toggle('am-hidden', screen.dataset.screen !== name);
    });
  }

  function setConnectionStatus(message, error) {
    const el = $('[data-role="connection-status"]');
    if (el) {
      el.textContent = message;
      el.style.color = error ? '#ff9aa9' : '#66e2bf';
    }
  }

  function handleClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-action],button[data-cell]');
    if (!button || !state.root.contains(button) || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();

    if (button.dataset.cell !== undefined) {
      play(Number(button.dataset.cell));
      return;
    }

    switch (button.dataset.action) {
      case 'start': startGame(button.dataset.mode); break;
      case 'online': showScreen('online'); break;
      case 'back-menu': disconnect(); showScreen('menu'); break;
      case 'create-room': createRoom(); break;
      case 'join-room': joinRoom(); break;
      case 'copy': copyCode(button.dataset.copy); break;
      case 'restart': restart(); break;
      case 'menu': backToMenu(); break;
      default: break;
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && state.root && !state.root.querySelector('[data-screen="game"]').classList.contains('am-hidden')) {
      backToMenu();
    }
  }

  function startGame(mode) {
    disconnect();
    clearBotTimer();
    state.mode = mode;
    state.difficulty = mode;
    state.score = { X: 0, O: 0, D: 0 };
    const descriptions = {
      easy: 'Toi (X) contre le bot facile (O)',
      medium: 'Toi (X) contre le bot moyen (O)',
      hard: 'Toi (X) contre le bot difficile (O)',
      local: 'Joueur X contre joueur O'
    };
    $('[data-role="players"]').textContent = descriptions[mode] || '';
    $('[data-role="mode-label"]').textContent = mode === 'local' ? 'DUEL LOCAL' : 'DÉFI CONTRE IA · ' + mode.toUpperCase();
    showScreen('game');
    resetBoard(false);
  }

  function backToMenu() {
    disconnect();
    clearBotTimer();
    showScreen('menu');
  }

  function clearBotTimer() {
    if (state.botTimer !== null) {
      clearTimeout(state.botTimer);
      state.botTimer = null;
    }
  }

  function resetBoard(notifyPeer) {
    clearBotTimer();
    state.board = Array(9).fill('');
    state.turn = 'X';
    state.over = false;
    renderGame();
    if (notifyPeer && state.mode === 'online' && state.host) send({ type: 'reset' });
  }

  function restart() {
    if (state.mode === 'online') {
      if (!state.connected) return;
      if (state.host) resetBoard(true);
      else send({ type: 'reset-request' });
      return;
    }
    resetBoard(false);
  }

  function renderGame() {
    const boardEl = $('[data-role="board"]');
    if (!boardEl) return;
    const result = getResult(state.board);
    boardEl.replaceChildren();

    state.board.forEach((symbol, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'am-cell' + (symbol ? ' ' + symbol.toLowerCase() : '');
      if (result && result.line.includes(index)) cell.classList.add('winner');
      cell.dataset.cell = String(index);
      cell.setAttribute('aria-label', `Case ${index + 1}${symbol ? ', ' + symbol : ', vide'}`);
      cell.disabled = state.over || !!symbol || !canCurrentPlayerMove();
      const mark = document.createElement('span');
      mark.className = 'am-symbol';
      mark.textContent = symbol;
      cell.appendChild(mark);
      boardEl.appendChild(cell);
    });

    const turnEl = $('[data-role="turn"]');
    if (turnEl) {
      if (state.over && result) {
        turnEl.textContent = result.winner === 'D' ? 'MATCH NUL' : result.winner + ' REMPORTE LA PARTIE';
        turnEl.style.color = result.winner === 'X' ? '#57caff' : result.winner === 'O' ? '#ff83bd' : '#d5e4f5';
      } else {
        turnEl.innerHTML = `AU TOUR DE <span class="${state.turn.toLowerCase()}">${state.turn}</span>`;
        turnEl.style.color = '';
      }
    }

    state.root.querySelector('[data-score="X"]').textContent = String(state.score.X);
    state.root.querySelector('[data-score="O"]').textContent = String(state.score.O);
    state.root.querySelector('[data-score="D"]').textContent = String(state.score.D);

    const resultBox = $('[data-role="result"]');
    if (state.over && result) {
      resultBox.classList.remove('am-hidden');
      resultBox.querySelector('strong').textContent = result.winner === 'D' ? 'ÉGALITÉ' : (result.winner === 'X' ? '✦ VICTOIRE DE X' : '✦ VICTOIRE DE O');
      resultBox.querySelector('span').textContent = result.winner === 'D' ? 'Personne ne marque ce point.' : 'Belle partie. Prêt pour la revanche ?';
    } else {
      resultBox.classList.add('am-hidden');
    }

    const message = $('[data-role="game-message"]');
    if (message) {
      message.textContent = state.mode === 'online'
        ? (state.connected ? (state.host ? 'Tu es X · Ton ami est O' : 'Ton ami est X · Tu es O') : 'Connexion perdue.')
        : (state.mode === 'local' ? 'Chacun joue à son tour sur cet écran.' : 'Le bot joue après ton coup.');
    }
  }

  function canCurrentPlayerMove() {
    if (state.mode === 'online') return state.connected && state.turn === (state.host ? 'X' : 'O');
    return state.mode === 'local' || state.turn === 'X';
  }

  function play(index) {
    if (!Number.isInteger(index) || index < 0 || index > 8 || state.over || state.board[index] || !canCurrentPlayerMove()) return;
    const symbol = state.turn;
    state.board[index] = symbol;
    finishMove();

    if (state.mode === 'online') {
      send({ type: 'move', index, symbol });
      return;
    }

    if (state.mode !== 'local' && !state.over && state.turn === 'O') {
      clearBotTimer();
      state.botTimer = setTimeout(() => {
        state.botTimer = null;
        botMove();
      }, 420);
    }
  }

  function finishMove() {
    const result = getResult(state.board);
    if (result) {
      state.over = true;
      state.score[result.winner] += 1;
    } else {
      state.turn = state.turn === 'X' ? 'O' : 'X';
    }
    renderGame();
  }

  function botMove() {
    if (state.over || state.mode === 'local' || state.mode === 'online' || state.turn !== 'O') return;
    const empty = state.board.map((value, index) => value ? -1 : index).filter((index) => index >= 0);
    if (!empty.length) return;
    let move;
    if (state.difficulty === 'easy') move = empty[Math.floor(Math.random() * empty.length)];
    else if (state.difficulty === 'medium') move = mediumMove();
    else move = hardMove();
    state.board[move] = 'O';
    finishMove();
  }

  function winningMove(board, symbol) {
    for (let i = 0; i < 9; i += 1) {
      if (board[i]) continue;
      board[i] = symbol;
      const result = getResult(board);
      board[i] = '';
      if (result && result.winner === symbol) return i;
    }
    return -1;
  }

  function mediumMove() {
    let move = winningMove(state.board, 'O');
    if (move >= 0) return move;
    move = winningMove(state.board, 'X');
    if (move >= 0) return move;
    if (!state.board[4]) return 4;
    const corners = [0, 2, 6, 8].filter((i) => !state.board[i]);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    const sides = [1, 3, 5, 7].filter((i) => !state.board[i]);
    return sides[Math.floor(Math.random() * sides.length)];
  }

  function minimax(board, player, depth, alpha, beta) {
    const result = getResult(board);
    if (result) {
      if (result.winner === 'O') return 10 - depth;
      if (result.winner === 'X') return depth - 10;
      return 0;
    }
    if (player === 'O') {
      let best = -Infinity;
      for (let i = 0; i < 9; i += 1) {
        if (board[i]) continue;
        board[i] = 'O';
        best = Math.max(best, minimax(board, 'X', depth + 1, alpha, beta));
        board[i] = '';
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (let i = 0; i < 9; i += 1) {
      if (board[i]) continue;
      board[i] = 'X';
      best = Math.min(best, minimax(board, 'O', depth + 1, alpha, beta));
      board[i] = '';
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  function hardMove() {
    let bestScore = -Infinity;
    let bestMoves = [];
    for (let i = 0; i < 9; i += 1) {
      if (state.board[i]) continue;
      state.board[i] = 'O';
      const value = minimax(state.board, 'X', 1, -Infinity, Infinity);
      state.board[i] = '';
      if (value > bestScore) {
        bestScore = value;
        bestMoves = [i];
      } else if (value === bestScore) bestMoves.push(i);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function status(message, isError) { setConnectionStatus(message, !!isError); }

  const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
  const PEER_OPTIONS = { host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 1 };

  function loadPeerJS() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (state.peerScriptPromise) return state.peerScriptPromise;
    state.peerScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PEERJS_URL;
      script.async = true;
      script.onload = () => window.Peer ? resolve(window.Peer) : reject(new Error('La bibliothèque PeerJS ne s’est pas chargée.'));
      script.onerror = () => reject(new Error('Impossible de charger PeerJS. Vérifie ta connexion Internet ou le bloqueur de contenu.'));
      document.head.appendChild(script);
    }).catch((error) => {
      state.peerScriptPromise = null;
      throw error;
    });
    return state.peerScriptPromise;
  }

  function waitForPeerOpen(peer, timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish(new Error('Le service de connexion ne répond pas. Réessaie.')), timeoutMs || 15000);
      const finish = (error, id) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(id);
      };
      peer.on('open', (id) => finish(null, id));
      peer.on('error', (error) => {
        if (!settled) finish(error);
        else if (state.peer === peer) status(peerErrorMessage(error), true);
      });
    });
  }

  function peerErrorMessage(error) {
    const type = error && error.type;
    if (type === 'peer-unavailable') return 'Code introuvable. Vérifie les 6 chiffres et réessaie.';
    if (type === 'unavailable-id') return 'Ce code est déjà utilisé. Génère-en un autre.';
    if (type === 'network') return 'Connexion au service impossible. Vérifie Internet.';
    if (type === 'server-error') return 'Le service de connexion rencontre un problème. Réessaie.';
    return (error && error.message) || 'Une erreur de connexion est survenue.';
  }

  function setupChannel(channel) {
    if (state.channel && state.channel !== channel && state.channel.open) {
      try { channel.close(); } catch (_) {}
      return;
    }
    state.channel = channel;
    channel.on('open', () => {
      if (state.channel !== channel) return;
      state.connected = true;
      state.mode = 'online';
      state.score = { X: 0, O: 0, D: 0 };
      $('[data-role="players"]').textContent = state.host ? 'Tu es X · Ton ami est O' : 'Ton ami est X · Tu es O';
      $('[data-role="mode-label"]').textContent = 'DUEL EN LIGNE';
      showScreen('game');
      resetBoard(false);
      status('Connectés ! Bonne partie.');
    });
    channel.on('data', (data) => {
      try {
        if (typeof data === 'string') data = JSON.parse(data);
        if (!data || typeof data !== 'object') return;
        if (data.type === 'move') {
          const remoteSymbol = state.host ? 'O' : 'X';
          if (state.mode !== 'online' || !state.connected || state.over || data.symbol !== remoteSymbol || data.symbol !== state.turn || !Number.isInteger(data.index) || data.index < 0 || data.index > 8 || state.board[data.index]) return;
          state.board[data.index] = data.symbol;
          finishMove();
        } else if (data.type === 'reset' && state.mode === 'online') {
          resetBoard(false);
        } else if (data.type === 'reset-request' && state.mode === 'online' && state.host) {
          resetBoard(true);
        }
      } catch (_) {
        status('Message reçu invalide.', true);
      }
    });
    channel.on('close', () => {
      if (state.channel !== channel) return;
      state.connected = false;
      status('Ton ami a quitté la partie.', true);
      if (state.mode === 'online') renderGame();
    });
    channel.on('error', (error) => status(peerErrorMessage(error), true));
  }

  function send(data) {
    if (state.channel && state.channel.open) {
      try { state.channel.send(JSON.stringify(data)); return true; }
      catch (_) { status('Envoi impossible : la connexion a été interrompue.', true); }
    }
    return false;
  }

  function randomRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async function createRoom() {
    disconnect();
    state.host = true;
    status('Connexion au service…');
    const createButton = $('[data-action="create-room"]');
    if (createButton) createButton.disabled = true;
    try {
      const Peer = await loadPeerJS();
      let opened = false;
      let lastError = null;
      for (let attempt = 0; attempt < 8 && !opened; attempt += 1) {
        const code = randomRoomCode();
        const peer = new Peer(code, PEER_OPTIONS);
        state.peer = peer;
        peer.on('connection', (connection) => {
          if (state.peer !== peer || !state.host) { connection.close(); return; }
          if (state.channel && state.channel.open) { connection.close(); return; }
          setupChannel(connection);
        });
        try {
          await waitForPeerOpen(peer, 15000);
          state.roomCode = code;
          opened = true;
          $('#am-room-code').value = code;
          $('[data-show="host"]').classList.remove('am-hidden');
          status('Ton salon est prêt. Envoie le code à ton ami.');
        } catch (error) {
          lastError = error;
          try { peer.destroy(); } catch (_) {}
          if (state.peer === peer) state.peer = null;
          if (!error || error.type !== 'unavailable-id') throw error;
        }
      }
      if (!opened) throw lastError || new Error('Impossible de réserver un code. Réessaie.');
    } catch (error) {
      status(peerErrorMessage(error), true);
    } finally {
      if (createButton) createButton.disabled = false;
    }
  }

  async function joinRoom() {
    const code = String($('#am-room-input').value || '').replace(/\D/g, '').slice(0, 6);
    $('#am-room-input').value = code;
    if (!/^\d{6}$/.test(code)) {
      status('Entre un code composé exactement de 6 chiffres.', true);
      return;
    }
    disconnect();
    state.host = false;
    status('Recherche de la partie ' + code + '…');
    const joinButton = $('[data-action="join-room"]');
    if (joinButton) joinButton.disabled = true;
    try {
      const Peer = await loadPeerJS();
      const peer = new Peer(PEER_OPTIONS);
      state.peer = peer;
      await waitForPeerOpen(peer, 15000);
      if (state.peer !== peer) return;
      const connection = peer.connect(code, { reliable: true });
      setupChannel(connection);
      state.connectionTimer = setTimeout(() => {
        state.connectionTimer = null;
        if (state.peer === peer && !state.connected) status('Aucune partie trouvée avec ce code. Vérifie-le puis réessaie.', true);
      }, 18000);
      connection.on('open', () => { clearTimeout(state.connectionTimer); state.connectionTimer = null; });
      connection.on('error', () => { clearTimeout(state.connectionTimer); state.connectionTimer = null; });
    } catch (error) {
      status(peerErrorMessage(error), true);
    } finally {
      if (joinButton) joinButton.disabled = false;
    }
  }

  async function copyCode(id) {
    const field = document.getElementById(id);
    if (!field || !field.value) { status('Aucun code à copier pour le moment.', true); return; }
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(field.value);
      else throw new Error('Presse-papiers non disponible');
      status('Code copié ! Envoie-le à ton ami.');
    } catch (_) {
      field.focus();
      field.select();
      try {
        const copied = document.execCommand('copy');
        status(copied ? 'Code copié !' : 'Code sélectionné : copie-le manuellement.');
      } catch (__) { status('Code sélectionné : copie-le manuellement.'); }
    }
  }

  function disconnect() {
    state.connected = false;
    state.roomCode = null;
    if (state.connectionTimer) { clearTimeout(state.connectionTimer); state.connectionTimer = null; }
    clearBotTimer();
    if (state.channel) {
      try { state.channel.close(); } catch (_) {}
    }
    if (state.peer) {
      try { state.peer.destroy(); } catch (_) {}
    }
    state.channel = null;
    state.peer = null;
    if (state.root) {
      const hostBox = $('[data-show="host"]');
      if (hostBox) hostBox.classList.add('am-hidden');
      const roomCode = $('#am-room-code');
      if (roomCode) roomCode.value = '';
    }
  }

  function restoreHost() {
    if (state.canvas && state.previous && !state.previous.canvasHidden) state.canvas.classList.remove('hidden');
    if (state.memory && state.previous && !state.previous.memoryHidden) state.memory.classList.remove('hidden');
    if (state.overlay && state.previous && !state.previous.overlayHidden) state.overlay.classList.remove('hidden');
    if (state.container && state.previous && !state.previous.hostClass) state.container.classList.remove('am-morpion-host');
  }

  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true;
    disconnect();
    if (state.root) {
      if (state.clickHandler) state.root.removeEventListener('click', state.clickHandler, true);
      if (state.keyHandler) state.root.removeEventListener('keydown', state.keyHandler, true);
      state.root.remove();
    }
    restoreHost();
    state.root = null;
    state.container = null;
    state.canvas = null;
    state.memory = null;
    state.overlay = null;
  }

  window.__arbestMorpion = { destroy };
  window.startMorpionGame = function () {
    state.destroyed = false;
    mount();
    state.mode = 'menu';
    state.score = { X: 0, O: 0, D: 0 };
    showScreen('menu');
  };
  window._morpionCleanup = destroy;
})();
