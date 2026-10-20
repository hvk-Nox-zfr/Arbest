let currentGameId = null;
let currentGameLoop = null;
let soundEnabled = true;
let currentCategoryFilter = 'all';
const loadedScripts = new Set();

const MOBILE_SCRIPT = 'js/games/mobile.js';
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

// ============================================================
// REGISTRE DES JEUX ET CATÉGORIES
// ============================================================
const GAMES_REGISTRY = {
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
    title: 'GTA ARBEST CITY',
    badge: 'OPEN WORLD 3D',
    category: '3d',
    desc: 'Ville ouverte : conduis, braque la banque, fuis la police et deviens le roi de la ville.',
    script: 'js/games/gta.js',
    initFn: 'startGTAGame',
    controls: '💡 ZQSD : bouger/conduire | Souris : caméra | Clic : tirer | E : monter | Espace : sauter',
    needs3D: true,
    disabled: true
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
    desc: 'En cours de développement — Arrive bientôt !',
    script: 'js/games/cybercraft.js',
    initFn: 'startCybercraftGame',
    controls: '💡 Bientôt disponible',
    disabled: true,
    needs3D: true
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
};

// Synthétiseur audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, duration = 0.1, type = 'sine') {
  if (!window.soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

['pointerdown', 'touchend', 'keydown'].forEach(ev =>
  window.addEventListener(ev, () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { passive: true })
);

// 1. GÉNÉRATION DU HUB AVEC FILTRAGE
function renderHubGrid() {
  const grid = document.getElementById('game-grid');
  if (!grid) return;

  const searchQuery = (document.getElementById('game-search')?.value || '').toLowerCase();

  grid.innerHTML = Object.entries(GAMES_REGISTRY)
    .filter(([_, game]) => {
      const matchCategory = currentCategoryFilter === 'all' || game.category === currentCategoryFilter;
      const matchSearch = game.title.toLowerCase().includes(searchQuery) || game.desc.toLowerCase().includes(searchQuery);
      return matchCategory && matchSearch;
    })
    .map(([id, game]) => {
      const hs = localStorage.getItem(`hs_${id}`) || 0;
      const isDisabled = game.disabled || false;
      const btnText = isDisabled ? 'EN DEV' : 'JOUER';
      const cardClass = isDisabled ? 'game-card disabled' : 'game-card';
      const clickHandler = isDisabled ? '' : `onclick="openGame('${id}')"`;

      return `
        <div class="${cardClass}" ${clickHandler}>
          <div class="card-badge">${game.badge}</div>
          <h3>${game.title}</h3>
          <p>${game.desc}</p>
          <div class="card-footer">
            <div class="hs-tag">BEST: <span id="hs-${id}">${hs}</span></div>
            <button class="btn-neon sm" ${isDisabled ? 'disabled' : ''}>${btnText}</button>
          </div>
        </div>
      `;
    }).join('');
}

function setFilter(cat, btn) {
  currentCategoryFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHubGrid();
}

function filterGames() {
  renderHubGrid();
}

// 2. CHARGEUR DYNAMIQUE
function loadGameScript(scriptUrl) {
  return new Promise((resolve, reject) => {
    if (loadedScripts.has(scriptUrl)) return resolve();
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = () => { loadedScripts.add(scriptUrl); resolve(); };
    script.onerror = () => reject(`Erreur de chargement : ${scriptUrl}`);
    document.body.appendChild(script);
  });
}

// 3. ARRÊT PROPRE ET RADICAL DE TOUS LES JEUX EN COURS
function stopAllGames() {
  // Annule la boucle principale active
  if (currentGameLoop) {
    cancelAnimationFrame(currentGameLoop);
    currentGameLoop = null;
  }

  // Nettoyage de toutes les boucles connues des différents jeux
  if (window.cybercraftLoopId) cancelAnimationFrame(window.cybercraftLoopId);
  if (typeof window.__motoStop === 'function') window.__motoStop();
  if (typeof window.__wormStop === 'function') window.__wormStop();

  // Sécurité : Stoppe tous les timers / intervalles potentiels en cours (jusqu'à ID 9999)
  for (let i = 1; i < 9999; i++) {
    window.clearInterval(i);
    window.clearTimeout(i);
  }

  // Réinitialisation totale des écouteurs globaux
  window.onkeydown = null;
  window.onkeyup = null;
  window.onmousemove = null;
  window.onmousedown = null;
  window.onmouseup = null;

  // Appel des fonctions de nettoyage spécifiques exposées par certains jeux
  ['_survCleanup', '_g2048Cleanup', '_clickerCleanup', '_skyCleanup', '_gtaCleanup', '_horrorCleanup', '_beamCleanup', '_physicsCleanup'].forEach(k => {
  if (typeof window[k] === 'function') {
    try { window[k](); } catch (e) {}
  }
});

  if (window.GameMobile) GameMobile.reset();
  if (window.MobileKit) MobileKit.teardown();

  // Effet visuel immédiat : on nettoie le canvas pour éviter qu'une image figée reste affichée
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// 4. OUVERTURE D'UN JEU (avec réinitialisation propre du canvas)
async function openGame(gameId) {
  const gameConfig = GAMES_REGISTRY[gameId];
  if (!gameConfig || gameConfig.disabled) return;

  // 1. On stoppe tout d'abord proprement le jeu précédent
  stopAllGames();

  document.getElementById('hub-view').classList.remove('active');
  document.getElementById('game-view').classList.add('active');

  currentGameId = gameId;
  document.getElementById('game-overlay').classList.add('hidden');
  document.getElementById('current-score').innerText = '0';
  document.getElementById('game-title').innerText = gameConfig.title;
  document.getElementById('game-badge-current').innerText = gameConfig.badge;
  document.getElementById('controls-hint').innerText = gameConfig.controls;

  const canvas = document.getElementById('game-canvas');
  const memoryBoard = document.getElementById('memory-board');

  // Remet les dimensions de base du canvas
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
    await loadGameScript(MOBILE_SCRIPT).catch(() => {});
    if (gameConfig.needs3D && typeof THREE === 'undefined') await loadGameScript(THREE_URL);
    
    // Charge ou réexécute le script du jeu demandé
    await loadGameScript(gameConfig.script);
    
    // Lance l'initialisation du jeu frais
    if (typeof window[gameConfig.initFn] === 'function') {
      window[gameConfig.initFn]();
    }
  } catch (err) {
    console.error("Erreur au lancement du jeu :", err);
  }
}

function closeGame() {
  stopAllGames();
  document.getElementById('game-view').classList.remove('active');
  document.getElementById('hub-view').classList.add('active');
  updateHighScoresDisplay();
}

function updateHighScore(gameId, score) {
  const currentBest = localStorage.getItem(`hs_${gameId}`) || 0;
  if (score > currentBest) {
    localStorage.setItem(`hs_${gameId}`, score);
  }
  updateHighScoresDisplay();
}

function updateHighScoresDisplay() {
  let total = 0;
  Object.keys(GAMES_REGISTRY).forEach(id => {
    const hs = localStorage.getItem(`hs_${id}`) || 0;
    const elem = document.getElementById(`hs-${id}`);
    if (elem) elem.innerText = hs;
    total += parseInt(hs);
  });
  const totalElem = document.getElementById('total-score');
  if (totalElem) totalElem.innerText = total;
}

function triggerGameOver(score) {
  playSound(120, 0.5, 'sawtooth');
  updateHighScore(currentGameId, score);
  document.getElementById('final-score').innerText = score;
  document.getElementById('game-overlay').classList.remove('hidden');
}

// Événements
document.getElementById('sound-toggle')?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-icon').innerText = soundEnabled ? '🔊' : '🔇';
  document.getElementById('sound-toggle').innerText = soundEnabled ? '🔊 SON: ON' : '🔇 SON: OFF';
});

document.getElementById('btn-restart')?.addEventListener('click', () => {
  if (currentGameId) openGame(currentGameId);
});

window.onload = () => {
  renderHubGrid();
  updateHighScoresDisplay();
};

// Loader Cubes Glitch Animation
(function () {
  function initGlitchLoader() {
    const loader = document.getElementById('glitch-cubes-loader');
    if (!loader) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const cubes = [];
    const fragment = document.createDocumentFragment();

    for (let y = -50; y < screenHeight + 50; y += 60) {
      for (let x = -50; x < screenWidth + 50; x += 60) {
        const cubeSize = 35 + Math.floor(Math.random() * 40);
        const cube = document.createElement('div');
        cube.classList.add('glitch-cube-3d');

        cube.style.width = `${cubeSize}px`;
        cube.style.height = `${cubeSize}px`;
        cube.style.left = `${x}px`;
        cube.style.top = `${y}px`;

        fragment.appendChild(cube);
        cubes.push({ el: cube, y });
      }
    }

    loader.appendChild(fragment);

    setTimeout(() => {
      cubes.forEach((item, index) => {
        setTimeout(() => {
          item.el.classList.add('disappear');
        }, index * 2);
      });
      setTimeout(() => loader.remove(), 1000);
    }, 800);
  }

  if (document.readyState === 'complete') initGlitchLoader();
  else document.addEventListener('DOMContentLoaded', initGlitchLoader);
})();

// Camouflage Stealth System (Mode Panique)
(function initStealthSystem() {
  const ORIGINAL_TITLE = 'Arbest';

  document.addEventListener('keydown', (e) => {
    if ((e.shiftKey && e.key === 'Escape') || (e.altKey && (e.key === 'q' || e.key === 'Q'))) {
      window.location.href = 'https://docs.google.com';
    }
  });

  window.addEventListener('blur', () => {
    document.title = 'Google Docs — Document sans titre';
  });

  window.addEventListener('focus', () => {
    document.title = ORIGINAL_TITLE;
  });
})();

// ============================================================
// GESTION DU SON ET DU SUIVI SOURIS
// ============================================================
window.soundEnabled = true;

document.addEventListener('DOMContentLoaded', () => {
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      window.soundEnabled = !window.soundEnabled;
      soundEnabled = window.soundEnabled;
      soundToggle.innerHTML = `<span id="sound-icon">${soundEnabled ? '🔊' : '🔇'}</span> SON: ${soundEnabled ? 'ON' : 'OFF'}`;
    });
  }
});

// Suivi de la souris par le halo lumineux en arrière-plan
window.addEventListener('mousemove', (e) => {
  const cursorGlow = document.getElementById('cursor-glow');
  if (cursorGlow) {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
  }
});