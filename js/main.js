let currentGameId = null;
let currentGameLoop = null;
let soundEnabled = true;
const loadedScripts = new Set();

// ============================================================
// REGISTRE DES JEUX
// ============================================================
const GAMES_REGISTRY = {
  snake: {
    title: 'SNAKE DOG',
    badge: 'RETRO',
    desc: "Dévorez les orbes d'énergie et survivez dans la matrice.",
    script: 'js/games/snake.js',
    initFn: 'startSnakeGame',
    controls: '💡 Flèches : Déplacement'
  },
  pong: {
    title: 'PLOUF PONG',
    badge: 'VS IA',
    desc: 'Un duel laser à haute vitesse contre le processeur central.',
    script: 'js/games/pong.js',
    initFn: 'startPongGame',
    controls: '💡 Flèches Haut/Bas : Déplacer raquette'
  },
  memory: {
    title: 'MEMORY',
    badge: 'PUZZLE',
    desc: 'Synchronisez votre mémoire quantique pour retrouver les paires.',
    script: 'js/games/memory.js',
    initFn: 'startMemoryGame',
    controls: '💡 Clic : Retourner les cartes'
  },
  tetris: {
    title: 'TETRIS DE LA HESS',
    badge: 'ARCADE',
    desc: 'Empilez les blocs d\'énergie avant la surchauffe.',
    script: 'js/games/tetris.js',
    initFn: 'startTetrisGame',
    controls: '💡 Flèches : Déplacer / Bas : Accélérer / Haut : Tourner'
  },
  space: {
    title: 'STAR WOUARS',
    badge: 'SHOOTER',
    desc: 'Repoussez l\'invasion extraterrestre du secteur binaire.',
    script: 'js/games/space-invaders.js',
    initFn: 'startSpaceGame',
    controls: '💡 Flèches Gauche/Droite : Déplacer | Espace : Tirer'
  },
  runner: {
    title: 'BLOCK DOUSK',
    badge: 'ACTION',
    desc: 'Fuyez la purge en esquivant les obstacles holographiques.',
    script: 'js/games/runner.js',
    initFn: 'startRunnerGame',
    controls: '💡 Espace / Flèche Haut : Sauter'
  },
  cybercraft: {
    title: 'MANECROUTE',
    badge: 'EN DEV',
    desc: 'En cours de développement — Arrive bientôt !',
    script: 'js/games/cybercraft.js',
    initFn: 'startCybercraftGame',
    controls: '💡 Bientôt disponible',
    disabled: true
  },
  chess: {
    title: 'ECHEQUE',
    badge: 'STRATÉGIE',
    desc: 'Affrontez l\'IA de la matrice dans un duel d\'échecs tactique.',
    script: 'js/games/chess.js',
    initFn: 'startChessGame',
    controls: '💡 Clic : Sélectionner et déplacer les pièces'
  },
  worm: {
    title: 'MANGE MOI',
    badge: 'ACTION',
    desc: 'Affrontez les autres joueurs dans une arène et ne vous faites pas manger.',
    script: 'js/games/worm.js',
    initFn: 'startWormGame',
    controls: '💡 Souris : Déplacez-vous avec la souris'
  },
  moto: {
    title: 'MOTO X3M NEON',
    badge: 'CASCADE',
    desc: 'Domptez les rampes néon, réalisez des flips et franchissez l\'arrivée.',
    script: 'js/games/moto.js',
    initFn: 'startMotoGame',
    controls: '💡 Z / ↑ : Gaz | S / ↓ : Frein | Q-D / ← → : Pencher | R : Recommencer'
  },
  flappy: {
    title: 'FLAPPY POULET',
    badge: 'ARCADE',
    desc: 'Guidez le poulet cosmique à travers les tuyaux sans heurter les obstacles !',
    script: 'js/games/flappy.js',
    initFn: 'startFlappyGame',
    controls: '💡 Espace / Clic : Faire voler le poulet'
  },
};

// Synthétiseur audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, duration = 0.1, type = 'sine') {
  if (!soundEnabled) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// 1. GÉNÉRATION AUTOMATIQUE DU HUB
function renderHubGrid() {
  const grid = document.getElementById('game-grid');
  if (!grid) return;

  grid.innerHTML = Object.entries(GAMES_REGISTRY).map(([id, game]) => {
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
          <button class="btn-neon" ${isDisabled ? 'disabled' : ''}>${btnText}</button>
        </div>
      </div>
    `;
  }).join('');
}

// 2. CHARGEUR DYNAMIQUE DE SCRIPTS JS
function loadGameScript(scriptUrl) {
  return new Promise((resolve, reject) => {
    if (loadedScripts.has(scriptUrl)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = () => {
      loadedScripts.add(scriptUrl);
      resolve();
    };
    script.onerror = () => reject(`Erreur de chargement du script : ${scriptUrl}`);
    document.body.appendChild(script);
  });
}

// 3. OUVERTURE D'UN JEU
async function openGame(gameId) {
  const gameConfig = GAMES_REGISTRY[gameId];
  if (!gameConfig || gameConfig.disabled) return;

  if (currentGameLoop) cancelAnimationFrame(currentGameLoop);
  if (window.cybercraftLoopId) cancelAnimationFrame(window.cybercraftLoopId);

  document.getElementById('hub-view').classList.remove('active');
  document.getElementById('game-view').classList.add('active');

  currentGameId = gameId;
  document.getElementById('game-overlay').classList.add('hidden');
  document.getElementById('current-score').innerText = '0';
  document.getElementById('game-title').innerText = gameConfig.title;
  document.getElementById('controls-hint').innerText = gameConfig.controls;

  const canvas = document.getElementById('game-canvas');
  const memoryBoard = document.getElementById('memory-board');

  if (gameId === 'memory') {
    canvas.classList.add('hidden');
    memoryBoard.classList.remove('hidden');
  } else {
    canvas.classList.remove('hidden');
    memoryBoard.classList.add('hidden');
  }

  try {
    await loadGameScript(gameConfig.script);
    if (typeof window[gameConfig.initFn] === 'function') {
      window[gameConfig.initFn]();
    }
  } catch (err) {
    console.error(err);
  }
}

function closeGame() {
  if (currentGameLoop) cancelAnimationFrame(currentGameLoop);
  if (window.cybercraftLoopId) cancelAnimationFrame(window.cybercraftLoopId);
  currentGameLoop = null;

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
  document.getElementById('overlay-title').innerText = "SYSTEM FAILURE";
  document.getElementById('game-overlay').classList.remove('hidden');
}

// Événements
document.getElementById('sound-toggle')?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-toggle').innerText = soundEnabled ? '🔊 SON: ON' : '🔇 SON: OFF';
});

document.getElementById('btn-restart')?.addEventListener('click', () => {
  if (currentGameId) openGame(currentGameId);
});

window.onload = () => {
  renderHubGrid();
  updateHighScoresDisplay();
};

// ============================================================
// ANIMATION GLITCH CUBES LOADER
// ============================================================
(function () {
  function initGlitchLoader() {
    const loader = document.getElementById('glitch-cubes-loader');
    if (!loader) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const cubes = [];
    const stepX = 50;
    const stepY = 50;

    const fragment = document.createDocumentFragment();

    for (let y = -50; y < screenHeight + 50; y += stepY) {
      for (let x = -50; x < screenWidth + 50; x += stepX) {
        const cubeSize = 35 + Math.floor(Math.random() * 45);
        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 60;

        const cube = document.createElement('div');
        cube.classList.add('glitch-cube-3d');

        const rand = Math.random();
        if (rand < 0.28) cube.classList.add('cyan-heavy');
        else if (rand < 0.55) cube.classList.add('pink-heavy');
        else if (rand < 0.72) cube.classList.add('dark');

        const posX = x + offsetX;
        const posY = y + offsetY;

        cube.style.width = `${cubeSize}px`;
        cube.style.height = `${cubeSize}px`;
        cube.style.left = `${posX}px`;
        cube.style.top = `${posY}px`;
        cube.style.zIndex = Math.floor(posY * 2 + Math.random() * 200);

        const shiftX = (Math.random() - 0.5) * 140;
        const rot = (Math.random() - 0.5) * 100;
        cube.style.setProperty('--shift-x', `${shiftX}px`);
        cube.style.setProperty('--rot', `${rot}deg`);

        fragment.appendChild(cube);
        cubes.push({ el: cube, y: posY });
      }
    }

    loader.appendChild(fragment);
    cubes.sort((a, b) => b.y - a.y);

    setTimeout(() => {
      if (cubes.length === 0) return;
      const maxY = cubes[0].y;
      const minY = cubes[cubes.length - 1].y;
      const totalSpan = maxY - minY || 1;

      cubes.forEach(item => {
        const normalizedY = (maxY - item.y) / totalSpan;
        const baseDelay = normalizedY * 750;
        const randomGlitch = Math.random() * 100;

        setTimeout(() => {
          item.el.classList.add('disappear');
        }, baseDelay + randomGlitch);
      });

      setTimeout(() => {
        loader.remove();
      }, 1300);
    }, 1000);
  }

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initGlitchLoader();
  } else {
    document.addEventListener('DOMContentLoaded', initGlitchLoader);
  }
})();

// ============================================================
// SYSTÈME DE SÉCURITÉ ET CAMOUFLAGE (ARBEST STEALTH)
// ============================================================
(function initStealthSystem() {
  const ORIGINAL_TITLE = 'Arbest';

  // 1. Raccourcis Panique : Shift + Échap OU Alt + Q
  document.addEventListener('keydown', (e) => {
    const isShiftEscape = e.shiftKey && e.key === 'Escape';
    const isAltQ = e.altKey && (e.key === 'q' || e.key === 'Q');

    if (isShiftEscape || isAltQ) {
      window.location.href = 'https://docs.google.com';
    }
  });

  // 2. Camouflage de l'onglet si l'élève change d'application ou d'onglet
  window.addEventListener('blur', () => {
    document.title = 'Google Docs — Document sans titre';
  });

  // Remet le vrai nom quand il revient sur l'onglet
  window.addEventListener('focus', () => {
    document.title = ORIGINAL_TITLE;
  });
})();