/* ============================================================
   GAME RUNTIME — isolation et nettoyage automatique des jeux
   (doit rester tout en haut : charge avant les scripts de jeux)

   Pendant qu'un jeu est ouvert, on "marque" tout ce qu'il démarre :
   requestAnimationFrame, setTimeout/setInterval, écouteurs sur
   window/document/body/canvas, contextes WebGL, sons et <audio>.
   À la fermeture, TOUT est coupé d'un coup : un jeu fermé ne peut
   plus tourner en fond ni "se relancer" dans le jeu suivant.
   ============================================================ */
const GameRuntime = (function () {
  const nAdd = EventTarget.prototype.addEventListener;
  const nRemove = EventTarget.prototype.removeEventListener;
  const nRAF = window.requestAnimationFrame.bind(window);
  const nCAF = window.cancelAnimationFrame.bind(window);
  const nST = window.setTimeout.bind(window);
  const nCT = window.clearTimeout.bind(window);
  const nSI = window.setInterval.bind(window);
  const nCI = window.clearInterval.bind(window);
  const nGetContext = HTMLCanvasElement.prototype.getContext;
  const nPlay = HTMLMediaElement.prototype.play;

  let tracking = false;
  let session = 0;
  let phase = 'run';          // 'load' = exécution du script du jeu, 'run' = pendant la partie
  let curScript = null;
  let staticIds = null;

  const rafs = new Set();
  const timers = new Map();   // id -> 't' | 'i'
  const listeners = [];       // écouteurs ajoutés par le jeu
  const loadStore = new Map(); // script -> Set(écouteurs posés au chargement du script)
  const glList = [];
  const audios = [];
  const medias = new Set();

  function trackable(t) {
    if (t === window || t === document || t === document.body || t === document.documentElement) return true;
    return !!(staticIds && t instanceof Element && t.id && staticIds.has(t.id));
  }

  // --- requestAnimationFrame
  window.requestAnimationFrame = function (cb) {
    if (!tracking || typeof cb !== 'function') return nRAF(cb);
    const s = session;
    const id = nRAF(function (t) {
      rafs.delete(id);
      if (s !== session) return;      // boucle d'un ancien jeu : on la laisse mourir
      cb(t);
    });
    rafs.add(id);
    return id;
  };
  window.cancelAnimationFrame = function (id) { rafs.delete(id); nCAF(id); };

  // --- timers
  window.setTimeout = function (fn, delay, ...args) {
    if (!tracking || typeof fn !== 'function') return nST(fn, delay, ...args);
    const s = session;
    const id = nST(function () {
      timers.delete(id);
      if (s !== session) return;
      fn.apply(this, args);
    }, delay);
    timers.set(id, 't');
    return id;
  };
  window.setInterval = function (fn, delay, ...args) {
    if (!tracking || typeof fn !== 'function') return nSI(fn, delay, ...args);
    const s = session;
    const id = nSI(function () {
      if (s !== session) { nCI(id); timers.delete(id); return; }
      fn.apply(this, args);
    }, delay);
    timers.set(id, 'i');
    return id;
  };
  window.clearTimeout = function (id) { timers.delete(id); nCT(id); };
  window.clearInterval = function (id) { timers.delete(id); nCI(id); };

  // --- écouteurs d'événements
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const t = this || window;
    if (tracking && fn && trackable(t)) {
      const rec = { t, type, fn, opts, phase, script: curScript };
      listeners.push(rec);
      if (phase === 'load' && curScript) {
        if (!loadStore.has(curScript)) loadStore.set(curScript, new Set());
        loadStore.get(curScript).add(rec);
      }
    }
    return nAdd.call(t, type, fn, opts);
  };

  // --- WebGL (évite l'accumulation de contextes -> lags / écran noir)
  HTMLCanvasElement.prototype.getContext = function (type) {
    const ctx = nGetContext.apply(this, arguments);
    if (tracking && ctx && /webgl/i.test(String(type)) && glList.indexOf(ctx) === -1) glList.push(ctx);
    return ctx;
  };

  // --- audio : contextes créés par les jeux + <audio>/<video>
  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    const Orig = window[name];
    if (!Orig) return;
    const Wrapped = function () {
      const c = new (Function.prototype.bind.apply(Orig, [null].concat([].slice.call(arguments))))();
      if (tracking) { c.__game = curScript; audios.push(c); }
      return c;
    };
    Wrapped.prototype = Orig.prototype;
    window[name] = Wrapped;
  });
  HTMLMediaElement.prototype.play = function () {
    if (tracking) medias.add(this);
    return nPlay.apply(this, arguments);
  };

  // --- API
  return {
    begin(script) {
      if (!staticIds) staticIds = new Set(Array.from(document.querySelectorAll('[id]')).map(e => e.id));
      curScript = script || null;
      tracking = true;
      audios.forEach(c => { if (c.__game === curScript && c.state === 'suspended') { try { c.resume(); } catch (e) {} } });
    },
    setPhase(p) { phase = p; },
    // Rejoue les écouteurs posés une seule fois au chargement du script (script déjà en cache)
    replay(script) {
      const set = loadStore.get(script);
      if (!set) return;
      set.forEach(rec => {
        if (rec.t instanceof Node && rec.t !== document && rec.t !== document.body && rec.t !== document.documentElement && !rec.t.isConnected) return;
        nAdd.call(rec.t, rec.type, rec.fn, rec.opts);
        listeners.push(rec);
      });
    },
    isStale(token, current) { return token !== current; },
    stopAll() {
      tracking = false;
      session++;                                   // invalide toutes les boucles/timers en attente
      rafs.forEach(id => nCAF(id)); rafs.clear();
      timers.forEach((kind, id) => { kind === 'i' ? nCI(id) : nCT(id); }); timers.clear();
      listeners.splice(0).forEach(rec => { try { nRemove.call(rec.t, rec.type, rec.fn, rec.opts); } catch (e) {} });
      glList.splice(0).forEach(gl => {
        try { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
      });
      audios.forEach(c => { try { if (c.state === 'running') c.suspend(); } catch (e) {} });
      medias.forEach(m => { try { m.pause(); } catch (e) {} }); medias.clear();
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    }
  };
})();

let currentGameId = null;
let currentGameLoop = null;
let openToken = 0;          // invalide les ouvertures de jeu devenues obsolètes (clic rapide, retour hub...)
let canvasUsed = false;      // le canvas a déjà servi à un jeu
let lastGameWas3D = false;  // le dernier jeu utilisait WebGL
let soundEnabled = true;
let currentCategoryFilter = 'all';
const loadedScripts = new Set();

const MOBILE_SCRIPT = 'js/games/mobile.js';
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

// ============================================================
// REGISTRE DES JEUX ET CATÉGORIES
// ============================================================
const GAMES_REGISTRY = {
  trounoir: {
    title: 'Trou Noir',
    badge: '3D lopoly',
    category: 'battle',
    desc: 'Mange tous se qu\'il y a sur ton passage',
    script: 'js/games/trounoir.js',
    initFn: 'startBlackHoleGame',
    controls: 'Souris : dirige ton trou noir',
    needs3D: true,
    disabled: false,
    isNew: true
  },
  stickman: {
    title: 'Stickman',
    badge: '2D',
    category: 'record',
    desc: 'Prend la bonne décision pour finir l\'histoire plusieurs histoire sont à trouver !',
    script: 'js/games/stickman.js',
    initFn: 'startStickmanGame',
    controls: 'click : choisir une direction d\'histoire',
    needs3D: true,
    disabled: false,
    isNew: true
  },
  ropeswing: {
    title: 'Ropeswing',
    badge: '2D',
    category: 'record',
    desc: 'Avance le plus possible en t\'accrochant !',
    script: 'js/games/ropeswing.js',
    initFn: 'startRopeSwingGame',
    controls: 'click : s\'accrocher',
    needs3D: true,
    disabled: false,
    isNew: true
  },
  orbit: {
    title: 'Orbit',
    badge: 'SPACE 3D',
    category: 'record',
    desc: 'Avance le plus possible dans les en se mettant en orbit sur les planètes !',
    script: 'js/games/orbit.js',
    initFn: 'startOrbitGame',
    controls: 'click : change d\'orbit',
    needs3D: true,
    disabled: false,
    isNew: true
  },
  toxerstack: {
    title: 'Tower Stack',
    badge: '3D',
    category: 'record',
    desc: 'Fait la plus haute tour possible en empilant les blocs avec précision.',
    script: 'js/games/tower-stack.js',
    initFn: 'startTowerStackGame',
    controls: 'click : poser un bloc | espace : recommencer',
    needs3D: true,
    disabled: false,
    isNew: true
  },
  horror: {
    title: 'PATIENTE 13',
    badge: 'HORREUR 3D',
    category: '3d',
    desc: "Piégé dans un asile abandonné, trouve 5 fusibles pour rouvrir la sortie… sans que ELLE ne t'entende.",
    script: 'js/games/horror.js',
    initFn: 'startHorrorGame',
    controls: "💡 ZQSD : bouger | Souris : regarder | Maj : courir | F : lampe | E : se cacher",
    needs3D: true
  },
  gta: {
    title: 'GTA OU PAS',
    badge: 'OPEN WORLD 3D',
    category: '3d',
    desc: 'Ville ouverte : conduis, braque la banque, fuis la police et deviens le roi de la ville.',
    script: 'js/games/gta.js',
    initFn: 'startGTAGame',
    controls: '💡 ZQSD : bouger/conduire | Souris : caméra | Clic : tirer | E : monter | Espace : sauter',
    needs3D: true,
    disabled: false,
    isNew: true
  },
  skyline: {
    title: 'SKYLINE RUSH',
    badge: '3D NEXT-GEN',
    category: '3d',
    desc: 'Cours au-dessus de la ville, esquive, vole en jetpack et traverse le jour et la nuit.',
    script: 'js/games/skyline.js',
    initFn: 'startSkylineGame',
    controls: '💡 Glisse (ou flèches / ZQSD) : changer de voie, sauter, glisser',
    needs3D: true
  },
  snake: {
    title: 'SNAKE DOG',
    badge: 'RETRO',
    category: 'retro',
    desc: "Dévorez les orbes d'énergie et survivez dans la matrice.",
    script: 'js/games/snake.js',
    initFn: 'startSnakeGame',
    controls: '💡 Flèches : Déplacement'
  },
  pong: {
    title: 'PLOUF PONG',
    badge: 'VS IA',
    category: 'arcade',
    desc: 'Un duel laser à haute vitesse contre le processeur central.',
    script: 'js/games/pong.js',
    initFn: 'startPongGame',
    controls: '💡 Flèches Haut/Bas : Déplacer raquette'
  },
  memory: {
    title: 'MEMORY',
    badge: 'PUZZLE',
    category: 'reflexion',
    desc: 'Synchronisez votre mémoire quantique pour retrouver les paires.',
    script: 'js/games/memory.js',
    initFn: 'startMemoryGame',
    controls: '💡 Clic : Retourner les cartes'
  },
  tetris: {
    title: 'TETRIS DE LA HESS',
    badge: 'ARCADE',
    category: 'arcade',
    desc: 'Empilez les blocs d\'énergie avant la surchauffe.',
    script: 'js/games/tetris.js',
    initFn: 'startTetrisGame',
    controls: '💡 Flèches : Déplacer / Bas : Accélérer / Haut : Tourner'
  },
  space: {
    title: 'STAR WOUARS',
    badge: 'SHOOTER',
    category: 'action',
    desc: 'Repoussez l\'invasion extraterrestre du secteur binaire.',
    script: 'js/games/space-invaders.js',
    initFn: 'startSpaceGame',
    controls: '💡 Flèches Gauche/Droite : Déplacer | Espace : Tirer'
  },
  runner: {
    title: 'BLOCK DOUSK',
    badge: 'ACTION',
    category: 'action',
    desc: 'Fuyez la purge en esquivant les obstacles holographiques.',
    script: 'js/games/runner.js',
    initFn: 'startRunnerGame',
    controls: '💡 Espace / Flèche Haut : Sauter'
  },
  cybercraft: {
    title: 'MANECROUTE',
    badge: 'EN DEV',
    category: '3d',
    desc: 'Mine, construis et fabrique dans un monde 3D !',
    script: 'js/games/cybercraft.js',
    initFn: 'startCybercraftGame',
    controls: '💡 ZQSD / joystick : bouger · Clic gauche : casser · Clic droit : poser · E : menu & crafts',
    disabled: false,
    needs3D: true,
    isNew: true
  },
  chess: {
    title: 'ECHEQUE',
    badge: 'STRATÉGIE',
    category: 'reflexion',
    desc: 'Affrontez l\'IA de la matrice dans un duel d\'échecs tactique.',
    script: 'js/games/chess.js',
    initFn: 'startChessGame',
    controls: '💡 Clic : Sélectionner et déplacer les pièces'
  },
  worm: {
    title: 'MANGE MOI',
    badge: 'ACTION',
    category: 'action',
    desc: 'Affrontez les autres joueurs dans une arène et ne vous faites pas manger.',
    script: 'js/games/worm.js',
    initFn: 'startWormGame',
    controls: '💡 Souris : Déplacez-vous avec la souris'
  },
  moto: {
    title: 'MOTO X3M NEON',
    badge: 'CASCADE',
    category: 'action',
    desc: 'Domptez les rampes néon, réalisez des flips et franchissez l\'arrivée.',
    script: 'js/games/moto.js',
    initFn: 'startMotoGame',
    controls: '💡 Z / ↑ : Gaz | S / ↓ : Frein | Q-D / ← → : Pencher | R : Recommencer'
  },
  flappy: {
    title: 'FLAPPY POULET',
    badge: 'ARCADE',
    category: 'arcade',
    desc: 'Guidez le poulet cosmique à travers les tuyaux sans heurter les obstacles !',
    script: 'js/games/flappy.js',
    initFn: 'startFlappyGame',
    controls: '💡 Espace / Clic : Faire voler le poulet'
  },
  clicker: {
    title: 'SNICKERS',
    badge: 'SIMULATION',
    category: 'arcade',
    desc: 'Minez, achetez des machines et revenez chaque jour : ta progression est sauvegardée.',
    script: 'js/games/clicker.js',
    initFn: 'startClickerGame',
    controls: '💡 Clic / toucher : miner — achète des générateurs'
  },
  game2048: {
    title: '2048',
    badge: 'RÉFLEXION',
    category: 'reflexion',
    desc: 'Fusionnez les tuiles pour atteindre 2048 et aller encore plus loin.',
    script: 'js/games/game2048.js',
    initFn: 'start2048Game',
    controls: '💡 Flèches ou glisse le doigt : déplacer les tuiles'
  },
  survivors: {
    title: 'SURVIVORS',
    badge: 'SURVIE',
    category: 'action',
    desc: 'Survis à des vagues sans fin, monte de niveau et choisis tes améliorations.',
    script: 'js/games/survivors.js',
    initFn: 'startSurvivorGame',
    controls: '💡 ZQSD / flèches : se déplacer — tir automatique'
  },
  quiz: {
    title: 'QUIZ BLOCUS',
    badge: 'CULTURE',
    category: 'reflexion',
    desc: 'Testez vos connaissances sur la vie lycéenne et les mouvements de contestation.',
    script: 'js/games/quiz.js',
    initFn: 'startQuizGame',
    controls: '💡 Clic : Sélectionner la bonne réponse'
  },
  dada: {
    title: 'JEU DES DADAS',
    badge: 'SOCIÉTÉ',
    category: 'reflexion',
    desc: 'Sortez vos petits chevaux, évitez l\'IA et grimpez l\'escalier en premier !',
    script: 'js/games/dada.js',
    initFn: 'startDadaGame',
    controls: '💡 Clic sur le Dé pour lancer'
  },
  mario: {
    title: 'MARIO C\'EST LE BOSS',
    badge: 'RETRO 8-BIT',
    category: 'retro',
    desc: 'Parcours les mondes classiques (1-1, souterrain) avec la physique NES.',
    script: 'js/games/mario2d.js',
    initFn: 'startMarioGame',
    controls: '💡 Flèches / Q-D : Se déplacer | Espace : Sauter',
    needs3D: false
  },
  beamdrive: {
    title: 'VOITURE 3D',
    badge: '3D PHYSIQUE',
    category: '3d',
    desc: 'Simulateur de conduite réaliste : testez la physique et les chocs.',
    script: 'js/games/beam.js',
    initFn: 'startBeamDrive',
    controls: '💡 Flèches / ZQSD : Conduire | Choc en temps réel',
    needs3D: true,
    disabled: true
  },
  physics: {
    title: 'GRAVITY DRAW',
    badge: 'PHYSIQUE',
    category: 'reflexion',
    desc: 'Trace des lignes avec la souris pour guider la balle soumise à la gravité vers sa cible !',
    script: 'js/games/physics.js',
    initFn: 'startPhysicsGame',
    controls: '💡 Clic GAUCHE : Tracer une ligne | ESPACE : Lancer la balle | R : Recommencer'
  },
  horrorhopital: {
    title: 'HORROR HOPITAL',
    badge: 'HORROR',
    category: 'horror',
    desc: 'Survivez aux horreurs de l\'hôpital et échappez-vous avant qu\'il ne soit trop tard !',
    script: 'js/games/horrorhopital.js',
    initFn: 'startHorrorHopitalGame',
    controls: '💡 Clic GAUCHE : Tracer une ligne | ESPACE : Lancer la balle | R : Recommencer',
    disabled: true
  },
    ecoletycoon: {
    title: 'ÉCOLE TYCOON',
    badge: 'OPEN WORLD 3D',
    category: 'simulation',
    desc: 'Explore une école en 3D, fais-toi des amis, joue au basket et vis ta vie scolaire avec des IA qui ont leur personnalité et leur mémoire !',
    script: 'js/games/ecole-tycoon.js',
    initFn: 'startEcoleTycoonGame',
    controls: '💡 ZQSD/WASD : bouger | Souris droite : caméra | Maj : courir | E : interagir | Espace : utiliser un objet / sauter',
    needs3D: true,
    disabled: false
  },
};

// ============================================================
// AUDIO (créé à la demande : pas d'avertissement navigateur au chargement)
// ============================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSound(freq, duration = 0.1, type = 'sine') {
  if (!window.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

['pointerdown', 'touchend', 'keydown'].forEach(ev =>
  window.addEventListener(ev, () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { passive: true })
);

// ============================================================
// 1. HUB
// ============================================================
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------
// Miniatures : mets simplement images/<id-du-jeu>.jpg (ou .webp / .png)
// Exemple : images/snake.jpg, images/gta.webp, images/game2048.png
// Tu peux aussi forcer un fichier avec `image: 'images/autre.jpg'` dans le registre.
// Si aucune image n'existe, une vignette néon avec l'icône du jeu est affichée.
// ------------------------------------------------------------
const THUMB_EXTENSIONS = ['jpg', 'webp', 'png', 'jpeg'];

const CATEGORY_LABELS = {
  all: 'TOUS', '3d': '3D', action: 'ACTION', arcade: 'ARCADE', retro: 'RETRO',
  reflexion: 'RÉFLEXION', record: 'RECORD', horror: 'HORREUR', simulation: 'SIMULATION'
};
const CATEGORY_ICONS = {
  '3d': '🧊', action: '💥', arcade: '🕹️', retro: '👾', reflexion: '🧠',
  record: '🏆', horror: '👻', simulation: '🚗'
};

function thumbCandidates(id, game) {
  const list = [];
  if (game.image) list.push(game.image);
  THUMB_EXTENSIONS.forEach(ext => list.push(`images/${id}.${ext}`));
  return list;
}

// Appelée par onerror : essaie le format suivant, puis bascule sur la vignette de secours
function thumbFallback(img) {
  const list = (img.dataset.srcs || '').split('|').filter(Boolean);
  const next = (parseInt(img.dataset.i, 10) || 0) + 1;
  if (next < list.length) {
    img.dataset.i = next;
    img.src = list[next];
  } else {
    img.onerror = null;
    img.parentElement.classList.add('no-image');
    img.remove();
  }
}

function renderHubGrid() {
  const grid = document.getElementById('game-grid');
  if (!grid) return;

  const searchQuery = (document.getElementById('game-search')?.value || '').toLowerCase().trim();

  const entries = Object.entries(GAMES_REGISTRY)
    .filter(([_, game]) => {
      const matchCategory = currentCategoryFilter === 'all' || game.category === currentCategoryFilter;
      const matchSearch = !searchQuery || game.title.toLowerCase().includes(searchQuery) || game.desc.toLowerCase().includes(searchQuery);
      return matchCategory && matchSearch;
    })
    // les jeux « NOUVEAU » en premier, les jeux en développement à la fin
    .sort((a, b) => ((b[1].isNew ? 1 : 0) - (a[1].isNew ? 1 : 0)) || ((a[1].disabled ? 1 : 0) - (b[1].disabled ? 1 : 0)));

  if (!entries.length) {
    grid.innerHTML = '<div class="empty-state">😕 Aucun jeu trouvé… essaie un autre mot !</div>';
    return;
  }

  grid.innerHTML = entries.map(([id, game], index) => {
    const hs = parseInt(localStorage.getItem(`hs_${id}`), 10) || 0;
    const isDisabled = game.disabled || false;
    const btnText = isDisabled ? 'EN DEV' : '▶ JOUER';
    const cardClass = isDisabled ? 'game-card disabled' : 'game-card';
    const clickHandler = isDisabled ? '' : `onclick="openGame('${id}')"`;
    const newBadgeHTML = game.isNew ? '<div class="card-new-badge">NOUVEAU</div>' : '';
    const catLabel = CATEGORY_LABELS[game.category] || String(game.category || '').toUpperCase();
    const icon = CATEGORY_ICONS[game.category] || '🎮';
    const srcs = thumbCandidates(id, game);
    const hasRecord = hs > 0;

    return `
      <article class="${cardClass}" ${clickHandler} data-cat="${escapeHTML(game.category || '')}" style="--i:${Math.min(index, 14)}">
        <div class="card-thumb">
          <div class="thumb-fallback"><span class="thumb-icon">${icon}</span><span class="thumb-name">${escapeHTML(game.title)}</span></div>
          <img src="${srcs[0]}" data-srcs="${srcs.join('|')}" data-i="0" alt="Aperçu de ${escapeHTML(game.title)}" loading="lazy" decoding="async" onerror="thumbFallback(this)">
          <div class="thumb-shade"></div>
          ${newBadgeHTML}
          <div class="card-badge">${escapeHTML(game.badge)}</div>
          <div class="thumb-play"><span>${isDisabled ? '🔒' : '▶'}</span></div>
        </div>
        <div class="card-body">
          <div class="card-meta"><span class="cat-chip">${escapeHTML(catLabel)}</span>${hasRecord ? '<span class="record-chip">🏆 RECORD</span>' : ''}</div>
          <h3>${escapeHTML(game.title)}</h3>
          <p>${game.desc}</p>
          <div class="card-footer">
            <div class="hs-tag">BEST: <span id="hs-${id}">${hs}</span></div>
            <button class="btn-neon sm" ${isDisabled ? 'disabled' : ''}>${btnText}</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function setFilter(cat, btn) {
  currentCategoryFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHubGrid();
}

// Recherche avec anti-rebond : on ne reconstruit pas la grille à chaque lettre
let _filterTimer = null;
function filterGames() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(renderHubGrid, 150);
}

// ============================================================
// 2. CHARGEUR DYNAMIQUE (avec cache des promesses : pas de double chargement)
// ============================================================
const _loading = new Map();
function loadGameScript(scriptUrl, isGameScript) {
  if (loadedScripts.has(scriptUrl)) return Promise.resolve();
  if (_loading.has(scriptUrl)) return _loading.get(scriptUrl);

  const p = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = () => { loadedScripts.add(scriptUrl); _loading.delete(scriptUrl); if (isGameScript) GameRuntime.setPhase('run'); resolve(); };
    script.onerror = () => { _loading.delete(scriptUrl); script.remove(); if (isGameScript) GameRuntime.setPhase('run'); reject(`Erreur de chargement : ${scriptUrl}`); };
    if (isGameScript) GameRuntime.setPhase('load');
    document.body.appendChild(script);
  });
  _loading.set(scriptUrl, p);
  return p;
}

// ============================================================
// 3. ARRÊT PROPRE ET COMPLET DE TOUS LES JEUX
// ============================================================
const _HANDLER_PROPS = ['onkeydown', 'onkeyup', 'onkeypress', 'onmousemove', 'onmousedown', 'onmouseup', 'onclick',
  'oncontextmenu', 'onwheel', 'ontouchstart', 'ontouchmove', 'ontouchend', 'ontouchcancel',
  'onpointerdown', 'onpointermove', 'onpointerup'];

function stopAllGames() {
  // 1) Fonctions de nettoyage propres à chaque jeu (avant de couper les timers)
  const known = ['_survCleanup', '_g2048Cleanup', '_clickerCleanup', '_skyCleanup', '_gtaCleanup', '_horrorCleanup', '_beamCleanup', '_physicsCleanup'];
  const found = new Set(known);
  try { Object.keys(window).forEach(k => { if (/^_{1,2}\w*(Cleanup|Stop)$/.test(k)) found.add(k); }); } catch (e) {}
  found.forEach(k => {
    if (typeof window[k] === 'function') { try { window[k](); } catch (e) {} }
  });

  if (currentGameLoop) { cancelAnimationFrame(currentGameLoop); currentGameLoop = null; }
  if (window.cybercraftLoopId) cancelAnimationFrame(window.cybercraftLoopId);

  // 2) Coupe TOUT ce que le jeu a démarré (boucles, timers, écouteurs, WebGL, sons)
  GameRuntime.stopAll();

  // 3) Gestionnaires "onxxx" posés directement
  [window, document, document.body, document.getElementById('game-canvas'), document.getElementById('memory-board')]
    .forEach(t => { if (t) _HANDLER_PROPS.forEach(p => { try { t[p] = null; } catch (e) {} }); });

  const board = document.getElementById('memory-board');
  if (board) board.innerHTML = '';

  // Interfaces de jeu laissées dans la page (ex. Manecroute : HUD, menu paramètres / crafts)
  document.querySelectorAll('#mc-hud-container, #mc-pause-menu, #mc-touch-ui').forEach(el => el.remove());

  if (window.GameMobile) GameMobile.reset();
  if (window.MobileKit) MobileKit.teardown();
}

// ============================================================
// 4. OUVERTURE / FERMETURE D'UN JEU
// ============================================================
async function openGame(gameId) {
  const gameConfig = GAMES_REGISTRY[gameId];
  if (!gameConfig || gameConfig.disabled) return;

  const token = ++openToken;   // si l'utilisateur change de jeu / revient au hub pendant le chargement, ce token devient obsolète

  stopAllGames();

  document.getElementById('hub-view').classList.remove('active');
  document.getElementById('game-view').classList.add('active');
  document.body.classList.add('in-game');   // met en pause les animations de fond (moins de lag)
  window.scrollTo(0, 0);

  currentGameId = gameId;
  document.getElementById('game-overlay').classList.add('hidden');
  document.getElementById('current-score').innerText = '0';
  document.getElementById('game-title').innerText = gameConfig.title;
  document.getElementById('game-badge-current').innerText = gameConfig.badge;
  document.getElementById('controls-hint').innerText = gameConfig.controls;

  let canvas = document.getElementById('game-canvas');
  // Un canvas n'accepte qu'un seul type de contexte (2D ou WebGL) : on en met un neuf
  // quand on passe vers ou depuis un jeu 3D.
  if (canvasUsed && (gameConfig.needs3D || lastGameWas3D)) {
    const fresh = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(fresh, canvas);
    canvas = fresh;
  }
  canvasUsed = true;
  lastGameWas3D = !!gameConfig.needs3D;
  const memoryBoard = document.getElementById('memory-board');

  canvas.width = 600;
  canvas.height = 400;

  if (gameId === 'memory') {
    canvas.classList.add('hidden');
    memoryBoard.classList.remove('hidden');
  } else {
    canvas.classList.remove('hidden');
    memoryBoard.classList.add('hidden');
  }

  try {
    if (!window.GameMobile) await loadGameScript(MOBILE_SCRIPT).catch(() => {});
    if (token !== openToken) return;

    if (gameConfig.needs3D && typeof THREE === 'undefined') await loadGameScript(THREE_URL);
    if (token !== openToken) return;

    // À partir d'ici, tout ce que fait le jeu est suivi pour pouvoir être coupé proprement
    GameRuntime.begin(gameConfig.script);
    await loadGameScript(gameConfig.script, true);
    if (token !== openToken) return;   // l'utilisateur est parti pendant le chargement : on ne lance rien

    GameRuntime.replay(gameConfig.script);   // jeux déjà chargés : on remet leurs écouteurs
    if (typeof window[gameConfig.initFn] === 'function') {
      window[gameConfig.initFn]();
    }
  } catch (err) {
    console.error('Erreur au lancement du jeu :', err);
  }
}

function closeGame() {
  openToken++;                 // annule toute ouverture de jeu encore en cours de chargement
  stopAllGames();
  currentGameId = null;
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) {}
  document.body.classList.remove('in-game');
  document.getElementById('game-overlay').classList.add('hidden');
  document.getElementById('game-view').classList.remove('active');
  document.getElementById('hub-view').classList.add('active');
  updateHighScoresDisplay();
}

function updateHighScore(gameId, score) {
  if (!gameId) return;
  const currentBest = parseInt(localStorage.getItem(`hs_${gameId}`), 10) || 0;
  if (score > currentBest) {
    localStorage.setItem(`hs_${gameId}`, score);
  }
  updateHighScoresDisplay();
}

function updateHighScoresDisplay() {
  let total = 0;
  Object.keys(GAMES_REGISTRY).forEach(id => {
    const hs = parseInt(localStorage.getItem(`hs_${id}`), 10) || 0;
    const elem = document.getElementById(`hs-${id}`);
    if (elem) elem.innerText = hs;
    total += hs;
  });
  const totalElem = document.getElementById('total-score');
  if (totalElem) totalElem.innerText = total;
}

function triggerGameOver(score) {
  // Un jeu déjà fermé ne doit ni afficher l'écran de fin ni toucher aux scores
  if (!currentGameId || !document.getElementById('game-view').classList.contains('active')) return;
  playSound(120, 0.5, 'sawtooth');
  updateHighScore(currentGameId, score);
  document.getElementById('final-score').innerText = score;
  document.getElementById('game-overlay').classList.remove('hidden');
}

// ============================================================
// SON (un seul gestionnaire)
// ============================================================
window.soundEnabled = true;
document.getElementById('sound-toggle')?.addEventListener('click', () => {
  window.soundEnabled = !window.soundEnabled;
  soundEnabled = window.soundEnabled;
  document.getElementById('sound-toggle').innerHTML =
    `<span id="sound-icon">${soundEnabled ? '🔊' : '🔇'}</span> SON: ${soundEnabled ? 'ON' : 'OFF'}`;
});

document.getElementById('btn-restart')?.addEventListener('click', () => {
  if (currentGameId) openGame(currentGameId);
});

window.onload = () => {
  renderHubGrid();
  updateHighScoresDisplay();
};

// ============================================================
// Loader Cubes Glitch (allégé : moins de cubes, un seul timer)
// ============================================================
(function () {
  function initGlitchLoader() {
    const loader = document.getElementById('glitch-cubes-loader');
    if (!loader) return;

    const step = window.innerWidth < 768 ? 70 : 90;
    const cubes = [];
    const fragment = document.createDocumentFragment();

    for (let y = -50; y < window.innerHeight + 50; y += step) {
      for (let x = -50; x < window.innerWidth + 50; x += step) {
        const cubeSize = 50 + Math.floor(Math.random() * 45);
        const cube = document.createElement('div');
        cube.className = 'glitch-cube-3d';
        cube.style.cssText = `width:${cubeSize}px;height:${cubeSize}px;left:${x}px;top:${y}px`;
        fragment.appendChild(cube);
        cubes.push(cube);
      }
    }
    loader.appendChild(fragment);

    setTimeout(() => {
      // une seule passe : l'ordre est donné par un délai CSS, pas par des centaines de setTimeout
      cubes.forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 2, 450)}ms`; el.classList.add('disappear'); });
      setTimeout(() => loader.remove(), 1000);
    }, 700);
  }

  if (document.readyState === 'complete') initGlitchLoader();
  else document.addEventListener('DOMContentLoaded', initGlitchLoader);
})();

// ============================================================
// Camouflage Stealth System (Mode Panique)
// ============================================================
(function initStealthSystem() {
  const ORIGINAL_TITLE = 'Arbest';

  document.addEventListener('keydown', (e) => {
    if ((e.shiftKey && e.key === 'Escape') || (e.altKey && (e.key === 'q' || e.key === 'Q'))) {
      window.location.href = 'https://docs.google.com';
    }
  });

  window.addEventListener('blur', () => { document.title = 'Google Docs — Document sans titre'; });
  window.addEventListener('focus', () => { document.title = ORIGINAL_TITLE; });
})();

// ============================================================
// Halo qui suit la souris (limité à 1 mise à jour par image, via transform = pas de recalcul de mise en page)
// ============================================================
(function () {
  const glow = document.getElementById('cursor-glow');
  if (!glow || (window.matchMedia && window.matchMedia('(hover: none)').matches)) return;
  let x = 0, y = 0, queued = false;
  window.addEventListener('mousemove', (e) => {
    x = e.clientX; y = e.clientY;
    if (queued || document.body.classList.contains('in-game')) return;
    queued = true;
    requestAnimationFrame(() => {
      glow.style.transform = `translate3d(${x - 225}px, ${y - 225}px, 0)`;
      queued = false;
    });
  }, { passive: true });
})();