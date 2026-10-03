// ============================================================
// CYBER WORM - ADVANCED AI, EXPANDED VIEW & SHOP
// ============================================================

let wormCanvas, wormCtx;
let wormAnimationId = null;
let isWormRunning = false;
let frameCount = 0;
let gameState = 'MENU'; // 'MENU' | 'PLAYING' | 'GAMEOVER'
let lastGameScore = 0;

// Configuration du Monde
const WORLD_SIZE = 3600;
const INITIAL_FOOD_COUNT = 550;
const BOT_COUNT = 12;
const POWERUP_COUNT = 8;

// Système de Sauvegarde, Monnaie & Boutique
let playerCoins = parseInt(localStorage.getItem('user_coins')) || 0;
let playerName = localStorage.getItem('player_nickname') || 'JOUEUR';
let selectedSkinIndex = parseInt(localStorage.getItem('selected_skin')) || 0;
let unlockedSkins = JSON.parse(localStorage.getItem('unlocked_skins')) || [0];

// Catalogue de skins avec tarifs en pièces
const NEON_COLORS = [
  { id: 0, name: 'Cyber Blue',   head: '#00f3ff', body: '#0066ff', price: 0 },
  { id: 1, name: 'Neon Pink',    head: '#ff0055', body: '#ff00aa', price: 100 },
  { id: 2, name: 'Toxic Green',  head: '#00ff66', body: '#009933', price: 250 },
  { id: 3, name: 'Gold Blaze',   head: '#ffaa00', body: '#ff5500', price: 500 },
  { id: 4, name: 'Ultra Violet', head: '#b000ff', body: '#7700cc', price: 1000 },
  { id: 5, name: 'Red Crimson',  head: '#ff2222', body: '#990000', price: 1500 }
];

const POWERUP_TYPES = {
  MAGNET: { color: '#00f3ff', label: 'AIMANT' },
  SHIELD: { color: '#38bdf8', label: 'BOUCLIER' },
  TURBO:  { color: '#facc15', label: 'TURBO' },
  DOUBLE: { color: '#ec4899', label: 'SCORE 2X' }
};

const BOT_NAMES = [
  'Vortex_99', 'NeonKilla', 'CyberGhost', 'Shadow_FR', 'AlphaWorm',
  'ByteCruncher', 'Matrix_User', 'ZeroCool', 'PixelHunter', 'Glitch_01'
];

const BOT_CHAT_MESSAGES = ['NICE TRY!', 'OOF!', 'GET REKT', 'TARGET LOCKED', 'GG', 'EZ'];

let camera = { x: 0, y: 0, zoom: 0.55, targetZoom: 0.55, shake: 0 };
let playerWorm = null;
let botWorms = [];
let foodPellets = [];
let powerUps = [];
let deathParticles = [];
let floatingTexts = [];
let wormMouse = { angle: 0, isBoosting: false };

function addCoins(amount) {
  playerCoins += amount;
  localStorage.setItem('user_coins', playerCoins);
}

// ------------------------------------------------------------
// INITIALISATION ET GESTION DU LOBBY
// ------------------------------------------------------------
function startWormGame() {
  const memoryBoard = document.getElementById('memory-board');
  if (memoryBoard) memoryBoard.classList.add('hidden');

  wormCanvas = document.getElementById('game-canvas');
  if (!wormCanvas) return;

  wormCanvas.classList.remove('hidden');
  wormCtx = wormCanvas.getContext('2d');

  resizeWormCanvas();
  window.removeEventListener('resize', resizeWormCanvas);
  window.addEventListener('resize', resizeWormCanvas);

  // Événements contrôles
  window.addEventListener('mousemove', handleWormMouseMove);
  window.addEventListener('mousedown', handleWormMouseDown);
  window.addEventListener('mouseup', (e) => { if (e.button === 0) wormMouse.isBoosting = false; });
  window.addEventListener('touchstart', handleWormTouch, { passive: false });
  window.addEventListener('touchmove', handleWormTouch, { passive: false });
  window.addEventListener('touchend', () => { wormMouse.isBoosting = false; });

  // Ouvre immédiatement le menu au lieu d'entrer directement en jeu
  openCustomizationMenu(false);
}

function launchMatch() {
  savePlayerInput();
  const modal = document.getElementById('custom-menu-modal');
  if (modal) modal.style.display = 'none';

  gameState = 'PLAYING';
  initWormWorld();

  if (wormAnimationId) cancelAnimationFrame(wormAnimationId);
  isWormRunning = true;
  wormGameLoop();
}

function resizeWormCanvas() {
  if (!wormCanvas) return;
  const parent = wormCanvas.parentElement || document.body;
  wormCanvas.width = parent.clientWidth || window.innerWidth;
  wormCanvas.height = parent.clientHeight || window.innerHeight;
}

function initWormWorld() {
  foodPellets = [];
  powerUps = [];
  deathParticles = [];
  floatingTexts = [];
  botWorms = [];

  for (let i = 0; i < INITIAL_FOOD_COUNT; i++) spawnFood();
  for (let i = 0; i < POWERUP_COUNT; i++) spawnPowerUp();

  const activeSkin = NEON_COLORS.find(s => s.id === selectedSkinIndex) || NEON_COLORS[0];
  playerWorm = createWorm(WORLD_SIZE / 2, WORLD_SIZE / 2, playerName, activeSkin, false);

  for (let i = 0; i < BOT_COUNT; i++) {
    spawnBot(BOT_NAMES[i % BOT_NAMES.length]);
  }
}

function spawnBot(name) {
  const x = Math.random() * (WORLD_SIZE - 600) + 300;
  const y = Math.random() * (WORLD_SIZE - 600) + 300;
  const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
  botWorms.push(createWorm(x, y, name, color, true));
}

function createWorm(x, y, name, colorPalette, isBot) {
  const initialLength = 20;
  const segments = [];
  for (let i = 0; i < initialLength; i++) {
    segments.push({ x: x - i * 6, y: y });
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: name,
    isBot: isBot,
    color: colorPalette,
    x: x, y: y,
    angle: Math.random() * Math.PI * 2,
    targetAngle: 0,
    speed: 3.8,
    baseSpeed: 3.8,
    boostSpeed: 7.5,
    radius: 13,
    segments: segments,
    score: 0,
    isDead: false,
    isBoosting: false,
    shieldTimer: 0,
    magnetTimer: 0,
    turboTimer: 0,
    doubleTimer: 0,
    chatText: '',
    chatTimer: 0,
    aiStateTimer: 0,
    aiTarget: null
  };
}

function spawnFood(x, y, value = 1, isBig = false) {
  foodPellets.push({
    x: x !== undefined ? x : Math.random() * WORLD_SIZE,
    y: y !== undefined ? y : Math.random() * WORLD_SIZE,
    radius: isBig ? Math.random() * 3 + 6 : Math.random() * 2 + 3,
    color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)].head,
    value: value
  });
}

function spawnPowerUp() {
  const keys = Object.keys(POWERUP_TYPES);
  const typeKey = keys[Math.floor(Math.random() * keys.length)];
  powerUps.push({
    x: Math.random() * (WORLD_SIZE - 400) + 200,
    y: Math.random() * (WORLD_SIZE - 400) + 200,
    type: typeKey,
    info: POWERUP_TYPES[typeKey]
  });
}

function addFloatingText(x, y, text, color = '#00f3ff') {
  floatingTexts.push({ x, y, text, color, alpha: 1.0, vy: -1.5 });
}

// ------------------------------------------------------------
// CONTROLES & EVENEMENTS
// ------------------------------------------------------------
function handleWormMouseMove(e) {
  if (!wormCanvas || !playerWorm || gameState !== 'PLAYING') return;

  const rect = wormCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const dx = mouseX - (wormCanvas.width / 2);
  const dy = mouseY - (wormCanvas.height / 2);
  wormMouse.angle = Math.atan2(dy, dx);
}

function handleWormMouseDown(e) {
  if (e.button !== 0 || gameState !== 'PLAYING') return;
  wormMouse.isBoosting = true;
}

function handleWormTouch(e) {
  if (e.touches.length > 0 && wormCanvas && gameState === 'PLAYING') {
    const rect = wormCanvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const touchY = e.touches[0].clientY - rect.top;

    const dx = touchX - (wormCanvas.width / 2);
    const dy = touchY - (wormCanvas.height / 2);
    wormMouse.angle = Math.atan2(dy, dx);
    wormMouse.isBoosting = e.touches.length > 1;
  }
}

// ------------------------------------------------------------
// BOUCLE ET PHYSIQUE
// ------------------------------------------------------------
function wormGameLoop() {
  if (!isWormRunning) return;
  frameCount++;
  if (gameState === 'PLAYING') updateWormGame();
  renderWormGame();
  wormAnimationId = requestAnimationFrame(wormGameLoop);
}

function updateWormGame() {
  if (playerWorm && !playerWorm.isDead) {
    playerWorm.targetAngle = wormMouse.angle;
    playerWorm.isBoosting = (wormMouse.isBoosting || playerWorm.turboTimer > 0) && playerWorm.segments.length > 8;
    updateWormPhysics(playerWorm);
  }

  botWorms.forEach((bot, index) => {
    if (!bot.isDead) {
      if ((frameCount + index) % 2 === 0) updateBotAI(bot);
      updateWormPhysics(bot);
    }
  });

  botWorms = botWorms.filter(b => !b.isDead);
  while (botWorms.length < BOT_COUNT) {
    spawnBot(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  }

  if (foodPellets.length < INITIAL_FOOD_COUNT) spawnFood();
  if (powerUps.length < POWERUP_COUNT) spawnPowerUp();

  deathParticles.forEach(p => { p.x += p.vx; p.y += p.vy; p.alpha -= 0.03; });
  deathParticles = deathParticles.filter(p => p.alpha > 0);

  floatingTexts.forEach(t => { t.y += t.vy; t.alpha -= 0.02; });
  floatingTexts = floatingTexts.filter(t => t.alpha > 0);

  if (playerWorm && !playerWorm.isDead) {
    camera.x += (playerWorm.x - camera.x) * 0.1;
    camera.y += (playerWorm.y - camera.y) * 0.1;

    camera.targetZoom = Math.max(0.35, 0.55 - (playerWorm.segments.length * 0.0008));
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.05;
  }

  if (camera.shake > 0) camera.shake *= 0.85;
}

function updateBotAI(bot) {
  if (bot.chatTimer > 0) bot.chatTimer--;

  const allWorms = [playerWorm, ...botWorms].filter(w => w && !w.isDead && w.id !== bot.id);

  bot.aiStateTimer--;
  if (bot.aiStateTimer <= 0 || !bot.aiTarget) {
    bot.aiStateTimer = 40 + Math.floor(Math.random() * 30);
    let bestTarget = null;
    let minDstSq = 360000;

    for (let p of powerUps) {
      const dSq = (bot.x - p.x) ** 2 + (bot.y - p.y) ** 2;
      if (dSq < minDstSq) { minDstSq = dSq; bestTarget = p; }
    }

    if (!bestTarget) {
      for (let i = 0; i < foodPellets.length; i += 5) {
        const f = foodPellets[i];
        if (f.value > 1) {
          const dSq = (bot.x - f.x) ** 2 + (bot.y - f.y) ** 2;
          if (dSq < minDstSq) { minDstSq = dSq; bestTarget = f; }
        }
      }
    }
    bot.aiTarget = bestTarget;
  }

  let desiredAngle = bot.angle;
  if (bot.aiTarget) {
    desiredAngle = Math.atan2(bot.aiTarget.y - bot.y, bot.aiTarget.x - bot.x);
  } else {
    desiredAngle = bot.angle + (Math.sin(frameCount * 0.04 + bot.id.charCodeAt(0)) * 0.08);
  }

  const numRays = 9;
  const spread = Math.PI * 0.8;
  let bestAngle = desiredAngle;
  let highestScore = -Infinity;

  for (let i = 0; i < numRays; i++) {
    const rayAngle = bot.angle - (spread / 2) + (i * (spread / (numRays - 1)));
    let rayDist = 320;
    let isDanger = false;

    for (let step = 30; step <= rayDist; step += 40) {
      const tx = bot.x + Math.cos(rayAngle) * step;
      const ty = bot.y + Math.sin(rayAngle) * step;

      if (tx < 120 || tx > WORLD_SIZE - 120 || ty < 120 || ty > WORLD_SIZE - 120) {
        rayDist = step;
        isDanger = true;
        break;
      }

      for (let other of allWorms) {
        const checkStep = other.segments.length > 25 ? 3 : 2;
        for (let s = 0; s < other.segments.length; s += checkStep) {
          const seg = other.segments[s];
          const dx = tx - seg.x, dy = ty - seg.y;
          if (dx * dx + dy * dy < 2025) {
            rayDist = step;
            isDanger = true;
            break;
          }
        }
        if (isDanger) break;
      }
      if (isDanger) break;
    }

    let angleDiff = Math.abs(rayAngle - desiredAngle);
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    angleDiff = Math.abs(angleDiff);

    let score = rayDist * 2.5 - (angleDiff * 90);
    if (score > highestScore) {
      highestScore = score;
      bestAngle = rayAngle;
    }
  }

  bot.targetAngle = bestAngle;

  if (highestScore > 450 && bot.aiTarget && bot.segments.length > 15) {
    const distSq = (bot.x - bot.aiTarget.x) ** 2 + (bot.y - bot.aiTarget.y) ** 2;
    bot.isBoosting = distSq < 100000;
  } else {
    bot.isBoosting = false;
  }
}

function updateWormPhysics(worm) {
  if (worm.shieldTimer > 0) worm.shieldTimer--;
  if (worm.magnetTimer > 0) worm.magnetTimer--;
  if (worm.turboTimer > 0) worm.turboTimer--;
  if (worm.doubleTimer > 0) worm.doubleTimer--;

  let diff = worm.targetAngle - worm.angle;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  worm.angle += diff * 0.18;

  const isBoostActive = (worm.isBoosting || worm.turboTimer > 0) && worm.segments.length > 8;
  worm.speed = isBoostActive ? worm.boostSpeed : worm.baseSpeed;

  if (isBoostActive && worm.turboTimer === 0 && Math.random() < 0.1) {
    const tail = worm.segments[worm.segments.length - 1];
    spawnFood(tail.x, tail.y, 1, false);
    worm.segments.pop();
  }

  worm.x += Math.cos(worm.angle) * worm.speed;
  worm.y += Math.sin(worm.angle) * worm.speed;

  worm.x = Math.max(20, Math.min(WORLD_SIZE - 20, worm.x));
  worm.y = Math.max(20, Math.min(WORLD_SIZE - 20, worm.y));

  let prevX = worm.x, prevY = worm.y;
  const segDist = 8;
  for (let i = 0; i < worm.segments.length; i++) {
    const seg = worm.segments[i];
    const dx = prevX - seg.x, dy = prevY - seg.y;
    const dist = Math.hypot(dx, dy);
    if (dist > segDist) {
      const angle = Math.atan2(dy, dx);
      seg.x = prevX - Math.cos(angle) * segDist;
      seg.y = prevY - Math.sin(angle) * segDist;
    }
    prevX = seg.x; prevY = seg.y;
  }

  const magnetRangeSq = worm.magnetTimer > 0 ? 60000 : (worm.radius + 8) * (worm.radius + 8);
  for (let i = foodPellets.length - 1; i >= 0; i--) {
    const f = foodPellets[i];
    const dx = worm.x - f.x, dy = worm.y - f.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < magnetRangeSq) {
      if (worm.magnetTimer > 0 && distSq > worm.radius * worm.radius) {
        f.x += (worm.x - f.x) * 0.18;
        f.y += (worm.y - f.y) * 0.18;
      } else {
        const points = (f.value * 10) * (worm.doubleTimer > 0 ? 2 : 1);
        worm.score += points;
        if (!worm.isBot) addFloatingText(f.x, f.y, `+${points}`, worm.doubleTimer > 0 ? '#ec4899' : '#00f3ff');

        for (let g = 0; g < f.value; g++) {
          const last = worm.segments[worm.segments.length - 1];
          worm.segments.push({ x: last.x, y: last.y });
        }
        foodPellets.splice(i, 1);
      }
    }
  }

  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    const dx = worm.x - p.x, dy = worm.y - p.y;
    if (dx * dx + dy * dy < (worm.radius + 18) * (worm.radius + 18)) {
      applyPowerUp(worm, p.type);
      addFloatingText(p.x, p.y, p.info.label, p.info.color);
      powerUps.splice(i, 1);
    }
  }

  const allWorms = [playerWorm, ...botWorms].filter(w => w && !w.isDead);
  for (let other of allWorms) {
    if (other.id === worm.id) continue;

    for (let i = 0; i < other.segments.length; i += 2) {
      const seg = other.segments[i];
      const dx = worm.x - seg.x, dy = worm.y - seg.y;
      if (dx * dx + dy * dy < (worm.radius + 4) * (worm.radius + 4)) {
        if (worm.shieldTimer > 0) {
          worm.shieldTimer = 0;
          addFloatingText(worm.x, worm.y, 'BOUCLIER BRISÉ!', '#38bdf8');
          worm.angle += Math.PI;
          return;
        }
        killWorm(worm, other);
        return;
      }
    }
  }
}

function applyPowerUp(worm, type) {
  if (type === 'MAGNET') worm.magnetTimer = 360;
  if (type === 'SHIELD') worm.shieldTimer = 400;
  if (type === 'TURBO')  worm.turboTimer = 300;
  if (type === 'DOUBLE') worm.doubleTimer = 360;

  if (worm.isBot) {
    worm.chatText = `POWERUP: ${POWERUP_TYPES[type].label}`;
    worm.chatTimer = 80;
  }
}

function killWorm(worm, killer) {
  worm.isDead = true;

  if (killer && killer.id === playerWorm?.id) {
    addFloatingText(worm.x, worm.y, 'KILL! +500', '#ff0055');
    playerWorm.score += 500;
  }

  if (killer && killer.isBot) {
    killer.chatText = BOT_CHAT_MESSAGES[Math.floor(Math.random() * BOT_CHAT_MESSAGES.length)];
    killer.chatTimer = 90;
  }

  worm.segments.forEach(seg => {
    if (Math.random() < 0.6) {
      spawnFood(seg.x + (Math.random() - 0.5) * 10, seg.y + (Math.random() - 0.5) * 10, 2, true);
    }
  });

  // Détection de la mort du joueur principal
  if (worm.id === playerWorm?.id) {
    camera.shake = 15;
    lastGameScore = playerWorm.score;
    const earnedCoins = Math.floor(lastGameScore / 10);
    if (earnedCoins > 0) {
      addCoins(earnedCoins);
    }

    gameState = 'GAMEOVER';

    // Ouvre le menu automatique après un court délai visuel (1.2 sec)
    setTimeout(() => {
      openCustomizationMenu(true);
    }, 1200);
  }
}

// ------------------------------------------------------------
// RENDU GRAPHIQUE
// ------------------------------------------------------------
function renderWormGame() {
  wormCtx.clearRect(0, 0, wormCanvas.width, wormCanvas.height);
  wormCtx.save();

  const shakeX = camera.shake > 0.5 ? (Math.random() - 0.5) * camera.shake : 0;
  const shakeY = camera.shake > 0.5 ? (Math.random() - 0.5) * camera.shake : 0;

  wormCtx.translate(wormCanvas.width / 2 + shakeX, wormCanvas.height / 2 + shakeY);
  wormCtx.scale(camera.zoom, camera.zoom);
  wormCtx.translate(-camera.x, -camera.y);

  const viewW = (wormCanvas.width / camera.zoom) / 2 + 100;
  const viewH = (wormCanvas.height / camera.zoom) / 2 + 100;
  const minX = camera.x - viewW, maxX = camera.x + viewW;
  const minY = camera.y - viewH, maxY = camera.y + viewH;

  renderGrid(minX, maxX, minY, maxY);

  wormCtx.strokeStyle = '#ff0055';
  wormCtx.lineWidth = 6;
  wormCtx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

  powerUps.forEach(p => {
    if (p.x > minX && p.x < maxX && p.y > minY && p.y < maxY) {
      wormCtx.beginPath();
      wormCtx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      wormCtx.fillStyle = p.info.color;
      wormCtx.fill();

      wormCtx.font = 'bold 11px sans-serif';
      wormCtx.fillStyle = '#000000';
      wormCtx.textAlign = 'center';
      wormCtx.fillText(p.info.label.substring(0, 3), p.x, p.y + 4);
    }
  });

  for (let i = 0; i < foodPellets.length; i++) {
    const f = foodPellets[i];
    if (f.x > minX && f.x < maxX && f.y > minY && f.y < maxY) {
      wormCtx.beginPath();
      wormCtx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      wormCtx.fillStyle = f.color;
      wormCtx.fill();
    }
  }

  const allWorms = [...botWorms, playerWorm].filter(w => w && !w.isDead);
  allWorms.forEach(w => renderWorm(w, minX, maxX, minY, maxY));

  floatingTexts.forEach(t => {
    wormCtx.font = 'bold 16px "Rajdhani", sans-serif';
    wormCtx.fillStyle = t.color;
    wormCtx.globalAlpha = t.alpha;
    wormCtx.fillText(t.text, t.x, t.y);
  });
  wormCtx.globalAlpha = 1.0;

  wormCtx.restore();

  if (gameState === 'PLAYING') {
    renderHUD();
  }
}

function renderGrid(minX, maxX, minY, maxY) {
  wormCtx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
  wormCtx.lineWidth = 1;
  const gridSize = 100;

  const startX = Math.max(0, Math.floor(minX / gridSize) * gridSize);
  const endX = Math.min(WORLD_SIZE, Math.ceil(maxX / gridSize) * gridSize);
  const startY = Math.max(0, Math.floor(minY / gridSize) * gridSize);
  const endY = Math.min(WORLD_SIZE, Math.ceil(maxY / gridSize) * gridSize);

  for (let x = startX; x <= endX; x += gridSize) {
    wormCtx.beginPath(); wormCtx.moveTo(x, startY); wormCtx.lineTo(x, endY); wormCtx.stroke();
  }
  for (let y = startY; y <= endY; y += gridSize) {
    wormCtx.beginPath(); wormCtx.moveTo(startX, y); wormCtx.lineTo(endX, y); wormCtx.stroke();
  }
}

function renderWorm(worm, minX, maxX, minY, maxY) {
  if (worm.shieldTimer > 0) {
    wormCtx.beginPath();
    wormCtx.arc(worm.x, worm.y, worm.radius + 10, 0, Math.PI * 2);
    wormCtx.fillStyle = 'rgba(56, 189, 248, 0.3)';
    wormCtx.strokeStyle = '#38bdf8';
    wormCtx.lineWidth = 2;
    wormCtx.fill();
    wormCtx.stroke();
  }

  for (let i = worm.segments.length - 1; i >= 0; i--) {
    const seg = worm.segments[i];
    if (seg.x > minX && seg.x < maxX && seg.y > minY && seg.y < maxY) {
      wormCtx.beginPath();
      wormCtx.arc(seg.x, seg.y, worm.radius * 0.85, 0, Math.PI * 2);
      wormCtx.fillStyle = i % 2 === 0 ? worm.color.body : worm.color.head;
      wormCtx.fill();
    }
  }

  if (worm.x > minX && worm.x < maxX && worm.y > minY && worm.y < maxY) {
    wormCtx.beginPath();
    wormCtx.arc(worm.x, worm.y, worm.radius, 0, Math.PI * 2);
    wormCtx.fillStyle = worm.color.head;
    wormCtx.fill();

    const eyeOffset = worm.radius * 0.5;
    const leftEyeX = worm.x + Math.cos(worm.angle - 0.5) * eyeOffset;
    const leftEyeY = worm.y + Math.sin(worm.angle - 0.5) * eyeOffset;
    const rightEyeX = worm.x + Math.cos(worm.angle + 0.5) * eyeOffset;
    const rightEyeY = worm.y + Math.sin(worm.angle + 0.5) * eyeOffset;

    wormCtx.fillStyle = '#ffffff';
    wormCtx.beginPath();
    wormCtx.arc(leftEyeX, leftEyeY, 3, 0, Math.PI * 2);
    wormCtx.arc(rightEyeX, rightEyeY, 3, 0, Math.PI * 2);
    wormCtx.fill();

    if (worm.chatTimer > 0 && worm.chatText) {
      wormCtx.fillStyle = 'rgba(0,0,0,0.85)';
      wormCtx.fillRect(worm.x - 45, worm.y - worm.radius - 30, 90, 18);
      wormCtx.font = 'bold 11px sans-serif';
      wormCtx.fillStyle = '#00f3ff';
      wormCtx.textAlign = 'center';
      wormCtx.fillText(worm.chatText, worm.x, worm.y - worm.radius - 17);
    } else {
      wormCtx.font = '12px "Rajdhani", sans-serif';
      wormCtx.fillStyle = '#ffffff';
      wormCtx.textAlign = 'center';
      wormCtx.fillText(worm.name, worm.x, worm.y - worm.radius - 8);
    }
  }
}

function renderHUD() {
  const scoreElem = document.getElementById('current-score');
  if (scoreElem && playerWorm) scoreElem.innerText = playerWorm.score;

  wormCtx.save();

  // Leaderboard en haut à droite
  const leaderboard = [playerWorm, ...botWorms]
    .filter(w => w && !w.isDead)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  wormCtx.fillStyle = 'rgba(9, 13, 22, 0.85)';
  wormCtx.strokeStyle = '#00f3ff';
  wormCtx.fillRect(wormCanvas.width - 200, 15, 185, 135);
  wormCtx.strokeRect(wormCanvas.width - 200, 15, 185, 135);

  wormCtx.font = 'bold 13px "Rajdhani", sans-serif';
  wormCtx.fillStyle = '#00f3ff';
  wormCtx.textAlign = 'left';
  wormCtx.fillText('CLASSEMENT ARENA', wormCanvas.width - 185, 33);

  wormCtx.font = '12px "Rajdhani", sans-serif';
  leaderboard.forEach((w, idx) => {
    wormCtx.fillStyle = w.id === playerWorm?.id ? '#00f3ff' : '#ffffff';
    wormCtx.fillText(`${idx + 1}. ${w.name.substring(0, 9)} : ${w.score}`, wormCanvas.width - 185, 55 + idx * 18);
  });

  // Minimap
  const mapSize = 90;
  const mapX = wormCanvas.width - mapSize - 15;
  const mapY = wormCanvas.height - mapSize - 15;

  wormCtx.fillStyle = 'rgba(9, 13, 22, 0.85)';
  wormCtx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
  wormCtx.fillRect(mapX, mapY, mapSize, mapSize);
  wormCtx.strokeRect(mapX, mapY, mapSize, mapSize);

  [playerWorm, ...botWorms].forEach(w => {
    if (!w || w.isDead) return;
    const rx = mapX + (w.x / WORLD_SIZE) * mapSize;
    const ry = mapY + (w.y / WORLD_SIZE) * mapSize;
    wormCtx.fillStyle = w.id === playerWorm?.id ? '#00f3ff' : '#ff0055';
    wormCtx.fillRect(rx - 1, ry - 1, 3, 3);
  });

  wormCtx.restore();
}

// ------------------------------------------------------------
// MODAL MENU / GAMEOVER / BOUTIQUE
// ------------------------------------------------------------
function openCustomizationMenu(isGameOver = false) {
  let modal = document.getElementById('custom-menu-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'custom-menu-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:9999; backdrop-filter: blur(4px);';
    document.body.appendChild(modal);
  }

  renderCustomizationMenuHTML(modal, isGameOver);
  modal.style.display = 'flex';
}

function renderCustomizationMenuHTML(modal, isGameOver = false) {
  const earnedCoins = isGameOver ? Math.floor(lastGameScore / 10) : 0;

  modal.innerHTML = `
    <div style="
      background: rgba(9, 13, 22, 0.95);
      border: 2px solid ${isGameOver ? '#ff0055' : '#00f3ff'};
      box-shadow: 0 0 30px ${isGameOver ? 'rgba(255, 0, 85, 0.4)' : 'rgba(0, 243, 255, 0.4)'};
      padding: 24px;
      border-radius: 12px;
      color: white;
      font-family: 'Rajdhani', sans-serif;
      width: 400px;
      max-width: 90vw;
      display: flex;
      flex-direction: column;
      gap: 16px;
    ">
      <div style="text-align: center;">
        <h2 style="margin:0; color:${isGameOver ? '#ff0055' : '#00f3ff'}; font-size: 26px; letter-spacing: 2px; text-transform: uppercase;">
          ${isGameOver ? 'GAME OVER' : 'CYBER WORM'}
        </h2>
        ${isGameOver ? `
          <div style="margin-top: 6px; font-size: 14px; color: #aaa;">
            SCORE : <span style="color:#00f3ff; font-weight:bold;">${lastGameScore}</span> | PIÈCES GAGNÉES : <span style="color:#facc15; font-weight:bold;">+${earnedCoins}</span>
          </div>
        ` : ''}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; background: #121826; padding: 10px 14px; border-radius: 6px;">
        <span style="font-size: 13px; color: #aaa; font-weight: bold;">VOS PIÈCES DISPONIBLES</span>
        <span style="color: #facc15; font-weight: bold; font-size: 18px;">${playerCoins} PTS</span>
      </div>

      <div>
        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 6px; font-weight: bold;">MON PSEUDO</label>
        <input type="text" id="player-name-input" value="${playerName}" maxlength="14" style="
          width: 100%;
          padding: 10px 12px;
          background: #121826;
          border: 1px solid #00f3ff;
          color: white;
          border-radius: 6px;
          box-sizing: border-box;
          font-weight: bold;
          outline: none;
        "/>
      </div>

      <div>
        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 8px; font-weight: bold;">CHOISIR / ACHETER UN SKIN</label>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
          ${NEON_COLORS.map(skin => {
            const isUnlocked = unlockedSkins.includes(skin.id);
            const isSelected = selectedSkinIndex === skin.id;

            return `
              <div style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                background: ${isSelected ? 'rgba(0, 243, 255, 0.15)' : '#121826'};
                border: 1px solid ${isSelected ? '#00f3ff' : '#222d42'};
                padding: 10px 12px;
                border-radius: 6px;
              ">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="
                    width: 20px; 
                    height: 20px; 
                    border-radius: 50%; 
                    background: ${skin.head};
                    box-shadow: 0 0 8px ${skin.head};
                  "></div>
                  <span style="font-size: 15px; font-weight: bold;">${skin.name}</span>
                </div>

                ${isUnlocked ? `
                  <button onclick="selectSkin(${skin.id}, ${isGameOver})" style="
                    background: ${isSelected ? '#00f3ff' : 'transparent'};
                    color: ${isSelected ? '#000' : '#00f3ff'};
                    border: 1px solid #00f3ff;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 12px;
                  ">${isSelected ? 'ÉQUIPÉ' : 'ÉQUIPER'}</button>
                ` : `
                  <button onclick="buySkin(${skin.id}, ${isGameOver})" style="
                    background: #facc15;
                    color: #000;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 12px;
                  ">ACHETER (${skin.price} PTS)</button>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <button onclick="launchMatch()" style="
        background: #00f3ff;
        color: #000;
        border: none;
        padding: 14px;
        font-weight: bold;
        font-size: 16px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 6px;
        letter-spacing: 1px;
        text-transform: uppercase;
        box-shadow: 0 0 15px rgba(0, 243, 255, 0.4);
      ">
        ${isGameOver ? 'REJOUER' : 'JOUER'}
      </button>
    </div>
  `;
}

function savePlayerInput() {
  const input = document.getElementById('player-name-input');
  if (input && input.value.trim() !== '') {
    playerName = input.value.trim();
    localStorage.setItem('player_nickname', playerName);
  }
}

function selectSkin(id, isGameOver) {
  savePlayerInput();
  selectedSkinIndex = id;
  localStorage.setItem('selected_skin', id);
  renderCustomizationMenuHTML(document.getElementById('custom-menu-modal'), isGameOver);
}

function buySkin(id, isGameOver) {
  savePlayerInput();
  const skin = NEON_COLORS.find(s => s.id === id);
  if (skin && playerCoins >= skin.price) {
    playerCoins -= skin.price;
    unlockedSkins.push(id);
    selectedSkinIndex = id;

    localStorage.setItem('user_coins', playerCoins);
    localStorage.setItem('unlocked_skins', JSON.stringify(unlockedSkins));
    localStorage.setItem('selected_skin', id);

    renderCustomizationMenuHTML(document.getElementById('custom-menu-modal'), isGameOver);
  }
}

// Exports globaux
window.startWormGame = startWormGame;
window.launchMatch = launchMatch;
window.addCoins = addCoins;
window.openCustomizationMenu = openCustomizationMenu;
window.selectSkin = selectSkin;
window.buySkin = buySkin;