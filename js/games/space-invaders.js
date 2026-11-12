/*
 * ARBEST ARCADE — STAR WARS / SPACE INVADERS UPGRADE
 * Canvas 2D only: detailed vector spacecraft, layered space background,
 * particle effects, enemy formations, boss waves and responsive controls.
 * Compatible with the Arbest game shell (startSpaceGame / currentGameLoop).
 */
function startSpaceGame() {
  if (window.GameMobile) window.GameMobile.reset();

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width || 600;
  const H = canvas.height || 400;
  const scoreElement = document.getElementById('current-score');
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const random = (min, max) => min + Math.random() * (max - min);
  const play = (freq, duration = 0.06, type = 'sine') => {
    try { if (typeof playSound === 'function') playSound(freq, duration, type); } catch (_) {}
  };

  let running = true;
  let paused = false;
  let frame = 0;
  let score = 0;
  let wave = 1;
  let waveBanner = 145;
  let playerFireTimer = 0;
  let pointerDown = false;
  let pointerX = null;
  let keys = Object.create(null);
  let gameEnded = false;
  let hitFlash = 0;

  const player = {
    x: W / 2,
    y: H - 55,
    width: 54,
    lives: 3,
    invulnerable: 150,
    speed: 5.5
  };

  let playerBullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let stars = [];
  let pickups = [];

  for (let i = 0; i < 125; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      z: random(0.3, 1.8),
      size: random(0.5, 1.8),
      phase: random(0, Math.PI * 2)
    });
  }

  function setScore(value) {
    score = value;
    if (scoreElement) scoreElement.textContent = String(score);
  }

  function addExplosion(x, y, color, amount = 24, power = 1) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = random(0.8, 4.2) * power;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(22, 48),
        maxLife: 48,
        size: random(1.5, 4.2),
        color,
        drag: random(0.96, 0.985)
      });
    }
    particles.push({ x, y, vx: 0, vy: 0, life: 12, maxLife: 12, size: 3, color: '#ffffff', drag: 1, flash: true });
  }

  function addSparks(x, y, color) {
    for (let i = 0; i < 7; i++) {
      particles.push({
        x, y, vx: random(-2, 2), vy: random(-2, 2),
        life: random(8, 18), maxLife: 18, size: random(1, 2.5), color, drag: 0.94
      });
    }
  }

  function spawnWave(number) {
    enemies = [];
    enemyBullets = [];
    const isBossWave = number % 5 === 0;

    if (isBossWave) {
      enemies.push({
        type: 'boss', x: W / 2, y: 90, baseX: W / 2, baseY: 90,
        hp: 22 + number * 3, maxHp: 22 + number * 3,
        alive: true, phase: random(0, Math.PI * 2), fireTimer: 70,
        score: 500 + number * 35, dive: false, width: 112
      });
      for (let i = 0; i < 2; i++) {
        enemies.push({
          type: 'scout', x: 125 + i * 350, y: 155, baseX: 125 + i * 350, baseY: 155,
          hp: 1 + Math.floor(number / 7), maxHp: 1 + Math.floor(number / 7),
          alive: true, phase: random(0, 6), fireTimer: random(100, 160),
          score: 35, dive: false, diveTimer: 0
        });
      }
    } else {
      const cols = 7;
      const rows = 3;
      const gapX = 80;
      const startX = (W - (cols - 1) * gapX) / 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const heavy = row === 0 && (number > 1 || col % 3 === 0);
          const hp = heavy ? 2 + Math.floor(number / 4) : 1 + (number >= 8 && row === 1 ? 1 : 0);
          enemies.push({
            type: heavy ? 'heavy' : 'scout',
            x: startX + col * gapX,
            y: 78 + row * 48,
            baseX: startX + col * gapX,
            baseY: 78 + row * 48,
            hp, maxHp: hp,
            alive: true,
            phase: random(0, Math.PI * 2),
            fireTimer: random(75, 185) / Math.min(2, 1 + number * 0.04),
            dive: false,
            diveTimer: 0,
            score: heavy ? 65 : 25,
            width: heavy ? 48 : 37
          });
        }
      }
    }

    waveBanner = 145;
    player.invulnerable = Math.max(player.invulnerable, 75);
    play(isBossWave ? 260 : 640, 0.18, 'triangle');
  }

  function movePlayerTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const localX = (clientX - rect.left) * (W / rect.width);
    pointerX = clamp(localX, 30, W - 30);
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.buttons || pointerDown) {
      movePlayerTo(e.clientX);
    } else if (e.pointerType === 'mouse' && canvas.matches(':hover')) {
      movePlayerTo(e.clientX);
    }
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    pointerDown = true;
    movePlayerTo(e.clientX);
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    if (e.cancelable) e.preventDefault();
  }

  function onPointerUp() { pointerDown = false; }
  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' ', 'arrowup', 'arrowdown'].includes(key)) e.preventDefault();
    keys[key] = true;
    if (key === 'p' || key === 'escape') paused = !paused;
    if (key === ' ' || key === 'enter') keys.shoot = true;
  }
  function onKeyUp(e) {
    const key = e.key.toLowerCase();
    keys[key] = false;
    if (key === ' ' || key === 'enter') keys.shoot = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  function cleanup() {
    running = false;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.style.touchAction = previousTouchAction;
    if (currentGameLoop) {
      cancelAnimationFrame(currentGameLoop);
      currentGameLoop = null;
    }
    if (window._spaceCleanup === cleanup) delete window._spaceCleanup;
  }
  window._spaceCleanup = cleanup;

  // ---------- BACKGROUND ----------
  function drawNebula(x, y, radius, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color.replace('ALPHA', String(alpha)));
    g.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawPlanet() {
    const px = W - 94;
    const py = 102;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.23);
    ctx.strokeStyle = 'rgba(119,159,255,0.24)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(0, 7, 66, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(163,196,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 66, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
    const planet = ctx.createRadialGradient(-17, -19, 4, 0, 0, 44);
    planet.addColorStop(0, '#9cb7df');
    planet.addColorStop(0.35, '#4d6d9c');
    planet.addColorStop(0.78, '#25385f');
    planet.addColorStop(1, '#111b38');
    ctx.fillStyle = planet;
    ctx.shadowColor = '#638cff';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 41, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(184,211,255,0.2)';
    ctx.lineWidth = 5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(-2, i * 13, 46, 7, -0.12, -0.3, Math.PI + 0.4);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#050918');
    bg.addColorStop(0.55, '#0a1027');
    bg.addColorStop(1, '#090718');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawNebula(100, 140, 190, 'rgba(29,92,190,ALPHA)', 0.22);
    drawNebula(430, 265, 210, 'rgba(103,35,150,ALPHA)', 0.16);
    drawNebula(310, 30, 135, 'rgba(14,151,173,ALPHA)', 0.10);
    drawPlanet();

    for (const star of stars) {
      star.y += star.z * 0.38;
      if (star.y > H + 2) {
        star.y = -3;
        star.x = Math.random() * W;
      }
      const twinkle = 0.55 + Math.sin(frame * 0.035 + star.phase) * 0.35;
      ctx.globalAlpha = clamp(twinkle, 0.12, 0.95);
      ctx.fillStyle = star.z > 1.35 ? '#d8f6ff' : '#91b6e8';
      ctx.fillRect(star.x, star.y, star.size * star.z, star.size * star.z);
      if (star.z > 1.65) {
        ctx.globalAlpha *= 0.35;
        ctx.fillRect(star.x - 3, star.y + 0.5, 7, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Fine scanlines and vignette give the scene depth without obscuring ships.
    ctx.fillStyle = 'rgba(130,180,255,0.025)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 90, W / 2, H / 2, 390);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- SHIP ART ----------
  function drawPlayerShip(x, y, time, blinking) {
    ctx.save();
    ctx.translate(x, y);
    const flicker = 0.82 + Math.sin(time * 0.45) * 0.18;

    // Twin engine exhausts behind the hull.
    for (const side of [-1, 1]) {
      const ex = side * 11;
      const flame = 13 + Math.sin(time * 0.7 + side) * 5;
      const exhaust = ctx.createLinearGradient(ex, 8, ex, 8 + flame + 12);
      exhaust.addColorStop(0, '#eaffff');
      exhaust.addColorStop(0.28, '#49eaff');
      exhaust.addColorStop(0.68, 'rgba(32,113,255,0.8)');
      exhaust.addColorStop(1, 'rgba(32,113,255,0)');
      ctx.fillStyle = exhaust;
      ctx.shadowColor = '#25dfff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(ex - 4, 8);
      ctx.lineTo(ex + 4, 8);
      ctx.lineTo(ex + 2, 8 + flame + 9);
      ctx.lineTo(ex, 8 + flame + 13);
      ctx.lineTo(ex - 2, 8 + flame + 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Wing armor.
    const wingGrad = ctx.createLinearGradient(-31, -8, 31, 19);
    wingGrad.addColorStop(0, '#315b91');
    wingGrad.addColorStop(0.45, '#a8d9ec');
    wingGrad.addColorStop(1, '#234267');
    ctx.fillStyle = wingGrad;
    ctx.strokeStyle = '#8beaff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-30, 4);
    ctx.lineTo(-26, 17);
    ctx.lineTo(-11, 12);
    ctx.lineTo(-7, 22);
    ctx.lineTo(7, 22);
    ctx.lineTo(11, 12);
    ctx.lineTo(26, 17);
    ctx.lineTo(30, 4);
    ctx.lineTo(10, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Outer wing panels and weapon rails.
    ctx.fillStyle = '#18314f';
    ctx.beginPath();
    ctx.moveTo(-24, 5); ctx.lineTo(-42, 13); ctx.lineTo(-38, 20); ctx.lineTo(-20, 16); ctx.closePath();
    ctx.moveTo(24, 5); ctx.lineTo(42, 13); ctx.lineTo(38, 20); ctx.lineTo(20, 16); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4f9cc5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-26, 9); ctx.lineTo(-39, 15);
    ctx.moveTo(26, 9); ctx.lineTo(39, 15);
    ctx.stroke();

    // Main fuselage, pointed nose facing upwards.
    const hull = ctx.createLinearGradient(-13, -26, 14, 24);
    hull.addColorStop(0, '#f1ffff');
    hull.addColorStop(0.18, '#83d9ef');
    hull.addColorStop(0.48, '#3d79ad');
    hull.addColorStop(0.78, '#1b3458');
    hull.addColorStop(1, '#101d36');
    ctx.fillStyle = hull;
    ctx.shadowColor = '#43ddff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(7, -17);
    ctx.lineTo(10, 3);
    ctx.lineTo(7, 19);
    ctx.lineTo(0, 24);
    ctx.lineTo(-7, 19);
    ctx.lineTo(-10, 3);
    ctx.lineTo(-7, -17);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d5fbff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Cockpit glass.
    const glass = ctx.createLinearGradient(-6, -17, 7, 5);
    glass.addColorStop(0, '#efffff');
    glass.addColorStop(0.22, '#70e9ff');
    glass.addColorStop(0.55, '#176b9e');
    glass.addColorStop(1, '#081a36');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.quadraticCurveTo(8, -7, 5, 3);
    ctx.lineTo(0, 8);
    ctx.lineTo(-5, 3);
    ctx.quadraticCurveTo(-8, -7, 0, -17);
    ctx.fill();
    ctx.strokeStyle = 'rgba(221,255,255,0.8)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Panel seams, wing lights and cannons.
    ctx.strokeStyle = 'rgba(220,250,255,0.62)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, 1); ctx.lineTo(-22, 12);
    ctx.moveTo(8, 1); ctx.lineTo(22, 12);
    ctx.moveTo(-5, 14); ctx.lineTo(5, 14);
    ctx.stroke();
    ctx.fillStyle = '#ffdc78';
    ctx.shadowColor = '#ffb84d';
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(-31, 15, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(31, 15, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dffcff';
    ctx.fillRect(-9, 22, 5, 3);
    ctx.fillRect(4, 22, 5, 3);

    if (blinking) {
      ctx.strokeStyle = `rgba(87,255,214,${0.35 + flicker * 0.4})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#57ffd6';
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.ellipse(0, 0, 41, 39, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawScoutShip(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.sin(frame * 0.018 + e.phase) * 0.045);
    const hull = ctx.createLinearGradient(0, -20, 0, 22);
    hull.addColorStop(0, '#fff0da');
    hull.addColorStop(0.2, '#f28a72');
    hull.addColorStop(0.58, '#a93b55');
    hull.addColorStop(1, '#351e43');

    // Engine pods.
    for (const s of [-1, 1]) {
      const flame = 7 + Math.sin(frame * 0.3 + s) * 3;
      const fg = ctx.createLinearGradient(s * 15, -3, s * 15, 13 + flame);
      fg.addColorStop(0, '#fff3a5'); fg.addColorStop(0.45, '#ff734d'); fg.addColorStop(1, 'rgba(255,65,72,0)');
      ctx.fillStyle = fg;
      ctx.shadowColor = '#ff563d'; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.moveTo(s * 12, -1); ctx.lineTo(s * 19, 2); ctx.lineTo(s * 16, 14 + flame); ctx.lineTo(s * 9, 9); ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Broad angular wings.
    ctx.fillStyle = '#6a2948';
    ctx.strokeStyle = '#ffad91'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -19); ctx.lineTo(11, -8); ctx.lineTo(31, 8); ctx.lineTo(25, 17);
    ctx.lineTo(9, 12); ctx.lineTo(0, 21); ctx.lineTo(-9, 12); ctx.lineTo(-25, 17);
    ctx.lineTo(-31, 8); ctx.lineTo(-11, -8); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Armor plates.
    ctx.fillStyle = '#c85b68';
    ctx.beginPath();
    ctx.moveTo(-22, 7); ctx.lineTo(-31, 8); ctx.lineTo(-23, 13); ctx.lineTo(-12, 9); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, 7); ctx.lineTo(31, 8); ctx.lineTo(23, 13); ctx.lineTo(12, 9); ctx.closePath(); ctx.fill();

    // Central armored hull, facing down.
    ctx.fillStyle = hull;
    ctx.shadowColor = '#ff685c'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, 23); ctx.lineTo(-9, 8); ctx.lineTo(-8, -11); ctx.lineTo(0, -20);
    ctx.lineTo(8, -11); ctx.lineTo(9, 8); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffd2b4'; ctx.lineWidth = 1; ctx.stroke();

    // Sensor canopy and details.
    const canopy = ctx.createLinearGradient(-6, -8, 6, 9);
    canopy.addColorStop(0, '#fff6d4'); canopy.addColorStop(0.4, '#ffbe7b'); canopy.addColorStop(1, '#442d52');
    ctx.fillStyle = canopy;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(7, 1, 4, 9); ctx.lineTo(-4, 9); ctx.quadraticCurveTo(-7, 1, 0, -8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,238,210,0.8)'; ctx.stroke();
    ctx.fillStyle = '#ffe6a1';
    ctx.fillRect(-2, 14, 4, 3);
    ctx.strokeStyle = 'rgba(255,211,173,0.7)';
    ctx.beginPath(); ctx.moveTo(-13, -1); ctx.lineTo(-24, 8); ctx.moveTo(13, -1); ctx.lineTo(24, 8); ctx.stroke();
    ctx.restore();
  }

  function drawHeavyShip(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.sin(frame * 0.013 + e.phase) * 0.025);
    const armor = ctx.createLinearGradient(0, -22, 0, 24);
    armor.addColorStop(0, '#fff3bd'); armor.addColorStop(0.24, '#e5b45a');
    armor.addColorStop(0.62, '#876039'); armor.addColorStop(1, '#35263a');

    // Heavy engine nacelles.
    for (const s of [-1, 1]) {
      const eg = ctx.createLinearGradient(s * 20, 2, s * 20, 25);
      eg.addColorStop(0, '#fff3a4'); eg.addColorStop(0.45, '#ff9a43'); eg.addColorStop(1, 'rgba(255,95,32,0)');
      ctx.fillStyle = eg; ctx.shadowColor = '#ff9e43'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(s * 17, 0); ctx.lineTo(s * 25, 5); ctx.lineTo(s * 23, 25); ctx.lineTo(s * 13, 17); ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#5c4937'; ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -23); ctx.lineTo(12, -11); ctx.lineTo(27, -5); ctx.lineTo(24, 12);
    ctx.lineTo(12, 17); ctx.lineTo(0, 25); ctx.lineTo(-12, 17); ctx.lineTo(-24, 12);
    ctx.lineTo(-27, -5); ctx.lineTo(-12, -11); ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = armor; ctx.shadowColor = '#ffcc68'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(10, -8); ctx.lineTo(8, 17); ctx.lineTo(0, 22); ctx.lineTo(-8, 17); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff1c2'; ctx.beginPath(); ctx.ellipse(0, -4, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e58a3e'; ctx.fillRect(-2, 12, 4, 5);
    ctx.strokeStyle = 'rgba(255,238,190,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(-8, 4); ctx.moveTo(18, -2); ctx.lineTo(8, 4); ctx.stroke();
    ctx.restore();
  }

  function drawBossShip(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const pulse = 0.75 + Math.sin(frame * 0.09) * 0.25;
    // Long engine trails at the rear.
    for (const s of [-1, 1]) {
      const flame = 18 + Math.sin(frame * 0.25 + s) * 6;
      const g = ctx.createLinearGradient(s * 37, 14, s * 37, 42 + flame);
      g.addColorStop(0, '#fff0ae'); g.addColorStop(0.35, '#ff6e52'); g.addColorStop(1, 'rgba(255,43,80,0)');
      ctx.fillStyle = g; ctx.shadowColor = '#ff4b71'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(s * 31, 13); ctx.lineTo(s * 44, 17); ctx.lineTo(s * 41, 40 + flame); ctx.lineTo(s * 27, 30); ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Main wings and command hull.
    const wing = ctx.createLinearGradient(0, -27, 0, 26);
    wing.addColorStop(0, '#ffb8a3'); wing.addColorStop(0.35, '#bd526f'); wing.addColorStop(1, '#351c48');
    ctx.fillStyle = wing; ctx.strokeStyle = '#ffc5b7'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -27); ctx.lineTo(22, -13); ctx.lineTo(58, -4); ctx.lineTo(49, 16);
    ctx.lineTo(27, 12); ctx.lineTo(15, 25); ctx.lineTo(0, 19); ctx.lineTo(-15, 25);
    ctx.lineTo(-27, 12); ctx.lineTo(-49, 16); ctx.lineTo(-58, -4); ctx.lineTo(-22, -13); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#722d55';
    ctx.beginPath(); ctx.moveTo(-49, -4); ctx.lineTo(-65, 7); ctx.lineTo(-48, 12); ctx.lineTo(-35, 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(49, -4); ctx.lineTo(65, 7); ctx.lineTo(48, 12); ctx.lineTo(35, 5); ctx.closePath(); ctx.fill();

    const core = ctx.createLinearGradient(0, -24, 0, 24);
    core.addColorStop(0, '#fff4d8'); core.addColorStop(0.2, '#ffad82'); core.addColorStop(0.65, '#953e63'); core.addColorStop(1, '#301c42');
    ctx.fillStyle = core; ctx.shadowColor = '#ff557f'; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.moveTo(0, -31); ctx.lineTo(15, -8); ctx.lineTo(12, 18); ctx.lineTo(0, 28); ctx.lineTo(-12, 18); ctx.lineTo(-15, -8); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffdccb'; ctx.stroke();

    const canopy = ctx.createLinearGradient(-10, -19, 10, 8);
    canopy.addColorStop(0, '#fff8e5'); canopy.addColorStop(0.3, '#ffcfac'); canopy.addColorStop(1, '#361f50');
    ctx.fillStyle = canopy; ctx.beginPath(); ctx.ellipse(0, -7, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();

    for (const s of [-1, 1]) {
      ctx.fillStyle = `rgba(255,224,133,${pulse})`;
      ctx.shadowColor = '#ffcf78'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(s * 37, 4, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawEnemy(e) {
    if (e.type === 'boss') drawBossShip(e);
    else if (e.type === 'heavy') drawHeavyShip(e);
    else drawScoutShip(e);

    if (e.hp < e.maxHp && e.type !== 'boss') {
      const width = e.type === 'heavy' ? 36 : 27;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(e.x - width / 2, e.y + 25, width, 3);
      ctx.fillStyle = '#ffcc68';
      ctx.fillRect(e.x - width / 2, e.y + 25, width * (e.hp / e.maxHp), 3);
    }
  }

  // ---------- PROJECTILES / HUD ----------
  function firePlayerWeapons() {
    playerBullets.push({ x: player.x - 13, y: player.y - 18, vy: 10.5, damage: 1 });
    playerBullets.push({ x: player.x + 13, y: player.y - 18, vy: 10.5, damage: 1 });
    if (wave >= 4 && wave % 2 === 0) {
      playerBullets.push({ x: player.x, y: player.y - 27, vy: 11.5, damage: 1, power: true });
    }
    if (frame % 3 === 0) play(760, 0.035, 'square');
  }

  function drawPlayerBullet(b) {
    ctx.save();
    const g = ctx.createLinearGradient(b.x, b.y - 12, b.x, b.y + 5);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#7ef8ff'); g.addColorStop(1, 'rgba(29,135,255,0)');
    ctx.fillStyle = g; ctx.shadowColor = '#53eaff'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 12); ctx.lineTo(b.x + 3.5, b.y - 1); ctx.lineTo(b.x + 1.5, b.y + 5);
    ctx.lineTo(b.x - 1.5, b.y + 5); ctx.lineTo(b.x - 3.5, b.y - 1); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawEnemyBullet(b) {
    ctx.save();
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 8);
    g.addColorStop(0, '#fff5e8'); g.addColorStop(0.25, '#ffb26e'); g.addColorStop(1, 'rgba(255,63,103,0)');
    ctx.fillStyle = g; ctx.shadowColor = '#ff527c'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4d7'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.font = 'bold 11px Rajdhani, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(5,12,29,0.68)';
    ctx.strokeStyle = 'rgba(103,203,255,0.35)';
    ctx.lineWidth = 1;
    roundRect(12, 11, 142, 31, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#86eaff'; ctx.fillText('SCORE', 23, 22);
    ctx.font = 'bold 15px Rajdhani, Arial, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.fillText(String(score).padStart(5, '0'), 65, 27);

    ctx.font = 'bold 12px Rajdhani, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5,12,29,0.68)';
    roundRect(W / 2 - 53, 11, 106, 31, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e1f6ff'; ctx.fillText(`SECTEUR ${String(wave).padStart(2, '0')}`, W / 2, 27);

    ctx.textAlign = 'right';
    ctx.font = 'bold 11px Rajdhani, Arial, sans-serif';
    ctx.fillStyle = '#9eb9d8'; ctx.fillText('COQUE', W - 75, 18);
    for (let i = 0; i < player.lives; i++) {
      const x = W - 61 + i * 17;
      ctx.save(); ctx.translate(x, 29); ctx.scale(0.25, 0.25);
      ctx.fillStyle = '#78edff'; ctx.strokeStyle = '#e2ffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(13, 10); ctx.lineTo(5, 7); ctx.lineTo(0, 13); ctx.lineTo(-5, 7); ctx.lineTo(-13, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    if (enemies.some(e => e.alive && e.type === 'boss')) {
      const boss = enemies.find(e => e.alive && e.type === 'boss');
      const barW = 230;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      roundRect(W / 2 - barW / 2, 51, barW, 9, 4); ctx.fill();
      const hpGrad = ctx.createLinearGradient(W / 2 - barW / 2, 0, W / 2 + barW / 2, 0);
      hpGrad.addColorStop(0, '#ff536f'); hpGrad.addColorStop(1, '#ffbd75');
      ctx.fillStyle = hpGrad;
      roundRect(W / 2 - barW / 2, 51, barW * (boss.hp / boss.maxHp), 9, 4); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd5cf'; ctx.font = 'bold 9px Rajdhani, Arial';
      ctx.fillText('VAISSEAU AMIRAL', W / 2, 69);
    }
    ctx.restore();
  }

  function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= p.drag; p.vy *= p.drag;
      p.life--;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.flash) {
        ctx.shadowColor = p.color; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - alpha) * 2), 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowColor = p.color; ctx.shadowBlur = 8;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawWaveBanner() {
    if (waveBanner <= 0) return;
    const alpha = Math.min(1, waveBanner / 25);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.shadowColor = wave % 5 === 0 ? '#ff5d85' : '#42eaff';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#f3fbff';
    ctx.font = '900 27px Orbitron, Arial, sans-serif';
    ctx.fillText(wave % 5 === 0 ? 'VAISSEAU AMIRAL' : `SECTEUR ${wave}`, W / 2, H / 2 - 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9ac4dc';
    ctx.font = 'bold 12px Rajdhani, Arial, sans-serif';
    ctx.fillText(wave % 5 === 0 ? 'MENACE PRIORITAIRE — DÉTRUISEZ-LE' : 'ESCOUADE HOSTILE DÉTECTÉE', W / 2, H / 2 + 20);
    ctx.restore();
    waveBanner--;
  }

  function damagePlayer() {
    if (player.invulnerable > 0 || gameEnded) return;
    player.lives--;
    player.invulnerable = 145;
    hitFlash = 14;
    addExplosion(player.x, player.y, '#62efff', 30, 1.15);
    play(125, 0.22, 'sawtooth');
    if (player.lives <= 0) {
      gameEnded = true;
      running = false;
      try { if (typeof triggerGameOver === 'function') triggerGameOver(score); } catch (_) {}
      return;
    }
    player.x = W / 2;
    playerBullets = [];
  }

  function updateEnemies() {
    const multiplier = 1 + (wave - 1) * 0.13;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.type === 'boss') {
        e.x = W / 2 + Math.sin(frame * 0.012 + e.phase) * Math.min(175, 125 + wave * 2);
        e.y = e.baseY + Math.sin(frame * 0.033) * 9;
        e.fireTimer--;
        if (e.fireTimer <= 0) {
          const aim = Math.atan2(player.y - e.y, player.x - e.x);
          for (const offset of [-0.22, 0, 0.22]) {
            const a = aim + offset;
            const speed = 2.3 + Math.min(1.4, wave * 0.06);
            enemyBullets.push({ x: e.x, y: e.y + 24, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius: 5 });
          }
          e.fireTimer = Math.max(38, 78 - wave * 2);
          play(190, 0.07, 'triangle');
        }
      } else if (e.dive) {
        e.y += e.diveSpeed;
        e.x += Math.sin(frame * 0.09 + e.phase) * 2.3;
        if (e.y > H + 32) {
          e.y = -25; e.x = e.baseX; e.dive = false;
        }
      } else {
        const formation = Math.sin(frame * 0.012 + wave * 0.25) * 24;
        e.x = e.baseX + formation + Math.sin(frame * 0.027 + e.phase) * 5;
        e.y = e.baseY + Math.sin(frame * 0.035 + e.phase) * 5;
        if (player.invulnerable <= 0 && Math.random() < 0.00055 * multiplier) {
          e.dive = true;
          e.diveSpeed = random(1.8, 2.7) * Math.min(2.1, multiplier);
        }
      }

      if (e.type !== 'boss') {
        e.fireTimer--;
        if (e.fireTimer <= 0) {
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const speed = (e.type === 'heavy' ? 2.9 : 2.35) * Math.min(1.9, multiplier);
          enemyBullets.push({ x: e.x, y: e.y + 13, vx: dx / length * speed, vy: dy / length * speed, radius: 3.5 });
          e.fireTimer = random(105, 205) / Math.min(1.8, multiplier);
        }
      }

      if (player.invulnerable <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < (e.type === 'boss' ? 54 : 26)) {
        e.alive = false;
        addExplosion(e.x, e.y, e.type === 'boss' ? '#ff6c91' : '#ffbd69', e.type === 'boss' ? 65 : 24, 1.2);
        damagePlayer();
      }
    }
  }

  function updatePlayerBullets() {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.y -= b.vy;
      let consumed = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        const hitRadius = e.type === 'boss' ? 59 : e.type === 'heavy' ? 27 : 22;
        if (Math.abs(b.x - e.x) < hitRadius && Math.abs(b.y - e.y) < (e.type === 'boss' ? 30 : 22)) {
          e.hp -= b.damage;
          consumed = true;
          addSparks(b.x, b.y, e.type === 'boss' ? '#ff9cae' : '#ffe19a');
          if (e.hp <= 0) {
            e.alive = false;
            setScore(score + e.score);
            addExplosion(e.x, e.y, e.type === 'boss' ? '#ff638d' : e.type === 'heavy' ? '#ffc45f' : '#ff806c', e.type === 'boss' ? 90 : 34, e.type === 'boss' ? 1.8 : 1.1);
            play(e.type === 'boss' ? 95 : 330, e.type === 'boss' ? 0.45 : 0.11, 'triangle');
          } else {
            play(220, 0.035, 'square');
          }
          break;
        }
      }
      if (consumed || b.y < -20) playerBullets.splice(i, 1);
    }
  }

  function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx; b.y += b.vy;
      if (player.invulnerable <= 0 && Math.hypot(b.x - player.x, b.y - player.y) < 19) {
        enemyBullets.splice(i, 1);
        damagePlayer();
        continue;
      }
      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) enemyBullets.splice(i, 1);
    }
  }

  function updatePlayer() {
    if (keys.arrowleft || keys.a || keys.q) player.x -= player.speed;
    if (keys.arrowright || keys.d) player.x += player.speed;
    if (pointerX !== null) {
      const delta = pointerX - player.x;
      player.x += clamp(delta, -player.speed * 1.8, player.speed * 1.8);
    }
    player.x = clamp(player.x, 30, W - 30);
    if (player.invulnerable > 0) player.invulnerable--;
    if (hitFlash > 0) hitFlash--;

    const firing = keys[' '] || keys.enter || keys.shoot || pointerDown;
    if (firing && !gameEnded) {
      if (playerFireTimer <= 0) {
        firePlayerWeapons();
        playerFireTimer = wave >= 6 ? 8 : 10;
      }
    }
    if (playerFireTimer > 0) playerFireTimer--;
  }

  function drawScene() {
    drawBackground();

    // Enemy ships first so projectiles and player remain visually in front.
    for (const e of enemies) if (e.alive) drawEnemy(e);

    for (const b of playerBullets) drawPlayerBullet(b);
    for (const b of enemyBullets) drawEnemyBullet(b);

    drawParticles();

    const blink = player.invulnerable > 0 && Math.floor(frame / 5) % 2 === 0;
    if (!blink || player.invulnerable < 20) drawPlayerShip(player.x, player.y, frame, player.invulnerable > 0);
    drawHUD();
    drawWaveBanner();

    if (paused) {
      ctx.fillStyle = 'rgba(3,8,20,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.shadowColor = '#51eaff'; ctx.shadowBlur = 20;
      ctx.fillStyle = '#ffffff'; ctx.font = '900 28px Orbitron, Arial'; ctx.fillText('PAUSE', W / 2, H / 2 - 4);
      ctx.shadowBlur = 0; ctx.fillStyle = '#a9c6df'; ctx.font = 'bold 13px Rajdhani, Arial';
      ctx.fillText('Appuie sur P ou ÉCHAP pour reprendre', W / 2, H / 2 + 23);
    }

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,65,105,${hitFlash / 85})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function update() {
    if (!running || gameEnded) return;
    frame++;

    if (!paused) {
      updatePlayer();
      updateEnemies();
      updatePlayerBullets();
      updateEnemyBullets();

      if (enemies.length && enemies.every(e => !e.alive)) {
        wave++;
        setScore(score + 100 * wave);
        if (wave % 3 === 0 && player.lives < 5) player.lives++;
        spawnWave(wave);
      }
    }

    drawScene();
    if (running && !gameEnded) currentGameLoop = requestAnimationFrame(update);
  }

  // Start cleanly, without relying on any external image or sprite file.
  setScore(0);
  spawnWave(wave);
  if (window.GameMobile) {
    try { window.GameMobile.start('space'); } catch (_) {}
  }
  currentGameLoop = requestAnimationFrame(update);
}
