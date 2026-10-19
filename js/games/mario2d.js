window.startMarioGame = function () {
  if (window.__marioStop) window.__marioStop();
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let camX = 0, score = 0, gameOver = false, gameWin = false, raf = 0, frameCount = 0;
  let currentLevel = 0;

  const player = {
    x: 40, y: 200, w: 28, h: 32,
    vx: 0, vy: 0,
    speed: 3.2,
    jumpForce: -11,
    grounded: false,
    facing: 'right',
    coyoteTime: 0,
    jumpBuffer: 0
  };

  const gravity = 0.5;
  const MAX_FALL = 12;
  const COYOTE_FRAMES = 6;
  const JUMP_BUFFER_FRAMES = 6;
  const keys = {};

  const marioPalette = {
    1: '#c40000', 2: '#fc9838', 3: '#000000', 4: '#0058f8', 5: '#fcfcfc'
  };

  const marioStand = [
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,3,3,3,2,2,2,3,0,0,0,0,0,0],
    [0,0,3,2,3,2,2,2,3,3,3,3,0,0,0,0],
    [0,0,3,2,3,3,2,2,2,3,3,3,3,0,0,0],
    [0,0,3,3,2,2,2,2,3,3,3,0,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,1,1,4,1,1,1,0,0,0,0,0,0,0],
    [0,0,1,1,1,4,1,1,4,1,1,1,0,0,0,0],
    [0,1,1,1,1,4,4,4,4,1,1,1,1,0,0,0],
    [0,2,2,1,4,3,4,4,3,4,1,2,2,0,0,0],
    [0,2,2,2,4,4,4,4,4,4,2,2,2,0,0,0],
    [0,0,2,4,4,4,4,4,4,4,2,0,0,0,0,0],
    [0,0,0,3,3,3,0,0,3,3,3,0,0,0,0,0],
    [0,0,3,3,3,3,0,0,3,3,3,3,0,0,0,0],
    [0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0]
  ];

  const marioWalk1 = [
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,3,3,3,2,2,2,3,0,0,0,0,0,0],
    [0,0,3,2,3,2,2,2,3,3,3,3,0,0,0,0],
    [0,0,3,2,3,3,2,2,2,3,3,3,3,0,0,0],
    [0,0,3,3,2,2,2,2,3,3,3,0,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,1,1,4,1,1,1,0,0,0,0,0,0,0],
    [0,0,1,1,1,4,1,1,4,1,1,1,0,0,0,0],
    [0,1,1,1,1,4,4,4,4,1,1,1,1,0,0,0],
    [0,2,2,1,4,3,4,4,3,4,1,2,2,0,0,0],
    [0,2,2,2,4,4,4,4,4,4,2,2,2,0,0,0],
    [0,0,2,4,4,4,4,4,4,4,2,0,0,0,0,0],
    [0,0,3,3,3,0,0,0,3,3,3,0,0,0,0,0],
    [0,3,3,3,0,0,0,0,0,3,3,3,3,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ];

  const marioJump = [
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,3,3,3,2,2,2,3,0,0,0,0,0,0],
    [0,0,3,2,3,2,2,2,3,3,3,3,0,0,0,0],
    [0,0,3,2,3,3,2,2,2,3,3,3,3,0,0,0],
    [0,0,3,3,2,2,2,2,3,3,3,0,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,1,1,1,4,1,1,1,1,1,0,0,0,0,0],
    [0,1,1,1,1,4,4,4,4,1,1,1,1,0,0,0],
    [0,2,2,1,4,3,4,4,3,4,1,2,2,0,0,0],
    [0,2,2,2,4,4,4,4,4,4,2,2,2,0,0,0],
    [0,0,2,4,4,4,4,4,4,4,2,0,0,0,0,0],
    [0,3,3,3,0,0,0,0,0,3,3,3,0,0,0,0],
    [3,3,3,0,0,0,0,0,0,0,3,3,3,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ];

  const goombaSprite = [
    [0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,3,1,1,1,1,1,1,3,0,0,0,0,0],
    [0,0,3,1,1,1,1,1,1,1,1,3,0,0,0,0],
    [0,3,1,1,3,3,1,1,3,3,1,1,3,0,0,0],
    [3,1,1,3,2,2,3,3,2,2,3,1,1,3,0,0],
    [3,1,1,3,2,2,3,3,2,2,3,1,1,3,0,0],
    [3,1,1,1,3,3,3,3,3,3,1,1,1,3,0,0],
    [0,3,1,1,1,1,1,1,1,1,1,1,3,0,0,0],
    [0,0,3,1,1,1,1,1,1,1,1,3,0,0,0,0],
    [0,0,0,3,3,2,2,2,2,3,3,0,0,0,0,0],
    [0,0,3,2,2,2,2,2,2,2,2,3,0,0,0,0],
    [0,3,2,2,2,2,2,2,2,2,2,2,3,0,0,0],
    [3,3,3,3,2,2,3,3,2,2,3,3,3,3,0,0],
    [3,0,0,3,3,3,0,0,3,3,3,0,0,3,0,0],
    [3,0,0,3,3,3,0,0,3,3,3,0,0,3,0,0],
    [0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,0]
  ];
  const goombaPalette = { 1: '#c84c0c', 2: '#fc9838', 3: '#000000' };

  function drawSprite(matrix, palette, x, y, scale = 2, flipX = false) {
    ctx.save();
    if (flipX) {
      ctx.translate(x + matrix[0].length * scale, y);
      ctx.scale(-1, 1);
      x = 0; y = 0;
    }
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        const code = matrix[r][c];
        if (code !== 0 && palette[code]) {
          ctx.fillStyle = palette[code];
          ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
        }
      }
    }
    ctx.restore();
  }

  const levelsData = [
    {
      name: "WORLD 1-1",
      bgColor: "#5c94fc",
      flagX: 2800,
      platforms: [
        { x: 0,    y: 320, w: 1280, h: 80, type: 'ground' },
        { x: 1344, y: 320, w: 640,  h: 80, type: 'ground' },
        { x: 2048, y: 320, w: 1200, h: 80, type: 'ground' },
        { x: 256, y: 208, w: 32, h: 32, type: 'question' },
        { x: 320, y: 208, w: 32, h: 32, type: 'brick' },
        { x: 352, y: 208, w: 32, h: 32, type: 'question' },
        { x: 384, y: 208, w: 32, h: 32, type: 'brick' },
        { x: 352, y: 96,  w: 32, h: 32, type: 'question' },
        { x: 800, y: 208, w: 32, h: 32, type: 'brick' },
        { x: 832, y: 208, w: 32, h: 32, type: 'question' },
        { x: 576,  y: 272, w: 48, h: 48, type: 'pipe' },
        { x: 736,  y: 256, w: 48, h: 64, type: 'pipe' },
        { x: 1152, y: 240, w: 48, h: 80, type: 'pipe' },
        { x: 1600, y: 272, w: 48, h: 48, type: 'pipe' }
      ],
      enemies: [
        { x: 400, y: 288, w: 32, h: 32, vx: -1.2, vy: 0, alive: true },
        { x: 900, y: 288, w: 32, h: 32, vx: -1.2, vy: 0, alive: true },
        { x: 1500, y: 288, w: 32, h: 32, vx: -1.4, vy: 0, alive: true }
      ]
    },
    {
      name: "WORLD 1-2 (SOUTERRAIN)",
      bgColor: "#000000",
      flagX: 2600,
      platforms: [
        { x: 0,    y: 320, w: 3000, h: 80, type: 'underground' },
        { x: 300,  y: 220, w: 160, h: 20, type: 'underground_brick' },
        { x: 600,  y: 160, w: 160, h: 20, type: 'underground_brick' },
        { x: 900,  y: 220, w: 192, h: 20, type: 'underground_brick' },
        { x: 1300, y: 180, w: 160, h: 20, type: 'underground_brick' },
        { x: 1700, y: 220, w: 224, h: 20, type: 'underground_brick' }
      ],
      enemies: [
        { x: 400, y: 288, w: 32, h: 32, vx: -1.4, vy: 0, alive: true },
        { x: 950, y: 188, w: 32, h: 32, vx: -1.4, vy: 0, alive: true },
        { x: 1400, y: 288, w: 32, h: 32, vx: -1.6, vy: 0, alive: true }
      ]
    },
    {
      name: "WORLD 1-3 (CHÂTEAU)",
      bgColor: "#200000",
      flagX: 2500,
      platforms: [
        { x: 0,    y: 320, w: 900,  h: 80, type: 'castle' },
        { x: 1050, y: 320, w: 500,  h: 80, type: 'castle' },
        { x: 1700, y: 320, w: 1000, h: 80, type: 'castle' },
        { x: 400,  y: 240, w: 128, h: 20, type: 'castle_brick' },
        { x: 700,  y: 180, w: 160, h: 20, type: 'castle_brick' },
        { x: 1200, y: 220, w: 160, h: 20, type: 'castle_brick' },
        { x: 1500, y: 160, w: 128, h: 20, type: 'castle_brick' }
      ],
      enemies: [
        { x: 500, y: 288, w: 32, h: 32, vx: -1.5, vy: 0, alive: true },
        { x: 1250, y: 288, w: 32, h: 32, vx: -1.6, vy: 0, alive: true },
        { x: 1800, y: 288, w: 32, h: 32, vx: -1.8, vy: 0, alive: true }
      ]
    }
  ];

  let activeLevel = levelsData[currentLevel];

  function loadLevel(index) {
    currentLevel = index;
    if (currentLevel >= levelsData.length) {
      gameWin = true;
      if (typeof updateHighScore === 'function') updateHighScore('mario', score);
      return;
    }
    activeLevel = levelsData[currentLevel];
    player.x = 40;
    player.y = 200;
    player.vx = 0;
    player.vy = 0;
    camX = 0;
  }

  function onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    const jumpPressed = ['ArrowUp','KeyW','KeyZ','Space'].includes(e.code);
    if (jumpPressed) player.jumpBuffer = JUMP_BUFFER_FRAMES;
  }
  function onKeyUp(e) { keys[e.code] = false; }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function rectIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update() {
    if (gameOver || gameWin) return;
    frameCount++;

    if (player.coyoteTime > 0) player.coyoteTime--;
    if (player.jumpBuffer > 0) player.jumpBuffer--;

    if (keys['ArrowLeft'] || keys['KeyA'] || keys['KeyQ']) {
      player.vx = -player.speed;
      player.facing = 'left';
    } else if (keys['ArrowRight'] || keys['KeyD']) {
      player.vx = player.speed;
      player.facing = 'right';
    } else {
      player.vx *= 0.75;
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }

    const canJump = player.grounded || player.coyoteTime > 0;
    if (player.jumpBuffer > 0 && canJump) {
      player.vy = player.jumpForce;
      player.grounded = false;
      player.coyoteTime = 0;
      player.jumpBuffer = 0;
      if (typeof playSound === 'function') playSound(650, 0.1, 'triangle');
    }

    player.vy += gravity;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    // Collision horizontale
    player.x += player.vx;
    activeLevel.platforms.forEach(p => {
      if (rectIntersect(player, p)) {
        if (player.vx > 0) player.x = p.x - player.w;
        else if (player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    });

    // Collision verticale & interaction avec les blocs (casser les briques / taper les points d'interrogation par en dessous)
    player.y += player.vy;
    const wasGrounded = player.grounded;
    player.grounded = false;
    
    // On parcourt les plateformes pour gérer les collisions et destructions de briques
    for (let i = activeLevel.platforms.length - 1; i >= 0; i--) {
      const p = activeLevel.platforms[i];
      if (rectIntersect(player, p)) {
        if (player.vy > 0) { // Atterrissage sur le bloc
          player.y = p.y - player.h;
          player.vy = 0;
          player.grounded = true;
        } else if (player.vy < 0) { // Mario tape le bloc par en dessous !
          player.y = p.y + p.h;
          player.vy = 0;

          if (p.type === 'brick') {
            // Supprime la brique (cassée par Mario)
            activeLevel.platforms.splice(i, 1);
            score += 50;
            if (typeof playSound === 'function') playSound(300, 0.12, 'square');
          } else if (p.type === 'question') {
            // Transforme le bloc question en bloc vide et donne un boost de points
            p.type = 'empty';
            score += 200;
            if (typeof playSound === 'function') playSound(900, 0.15, 'triangle');
          }
        }
      }
    }

    if (wasGrounded && !player.grounded && player.vy >= 0) {
      player.coyoteTime = COYOTE_FRAMES;
    }

    if (player.y > canvas.height + 50) triggerDeath();
    
    if (player.x >= activeLevel.flagX) {
      score += 1000;
      if (typeof playSound === 'function') playSound(800, 0.3, 'triangle');
      loadLevel(currentLevel + 1);
      return;
    }

    activeLevel.enemies.forEach(en => {
      if (!en.alive) return;
      en.vy += gravity;
      if (en.vy > MAX_FALL) en.vy = MAX_FALL;

      en.x += en.vx;
      activeLevel.platforms.forEach(p => {
        if (rectIntersect(en, p)) {
          if (en.vx > 0) en.x = p.x - en.w;
          else if (en.vx < 0) en.x = p.x + p.w;
          en.vx *= -1;
        }
      });

      en.y += en.vy;
      activeLevel.platforms.forEach(p => {
        if (rectIntersect(en, p)) {
          if (en.vy > 0) { en.y = p.y - en.h; en.vy = 0; }
          else if (en.vy < 0) { en.y = p.y + p.h; en.vy = 0; }
        }
      });

      if (rectIntersect(player, en)) {
        const playerBottom = player.y + player.h;
        const enemyTop = en.y;
        if (player.vy > 0 && playerBottom - player.vy <= enemyTop + 8) {
          en.alive = false;
          player.vy = -9;
          score += 200;
          if (typeof playSound === 'function') playSound(420, 0.1, 'sine');
        } else {
          triggerDeath();
        }
      }
    });

    camX = player.x - canvas.width / 3;
    if (camX < 0) camX = 0;
  }

  function triggerDeath() {
    gameOver = true;
    if (typeof playSound === 'function') playSound(110, 0.35, 'sawtooth');
    if (typeof triggerGameOver === 'function') triggerGameOver(score);
  }

  function draw() {
    ctx.fillStyle = activeLevel.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camX, 0);

    if (currentLevel === 0) {
      ctx.fillStyle = '#ffffff';
      [150, 650, 1300, 1950, 2550].forEach(cx => {
        ctx.fillRect(cx, 60, 48, 16);
        ctx.fillRect(cx - 16, 76, 80, 16);
      });
      ctx.fillStyle = '#00a800';
      [300, 1200, 2200].forEach(hx => {
        ctx.beginPath();
        ctx.moveTo(hx, 320);
        ctx.lineTo(hx + 64, 224);
        ctx.lineTo(hx + 128, 320);
        ctx.fill();
      });
    } else if (currentLevel === 1) {
      ctx.fillStyle = '#111133';
      for (let bx = 0; bx < 3000; bx += 140) {
        ctx.fillRect(bx, 60, 64, 260);
      }
    } else if (currentLevel === 2) {
      ctx.fillStyle = '#e52521';
      ctx.fillRect(0, 360, 3000, 40);
      ctx.fillStyle = '#000000';
      for (let lx = 0; lx < 3000; lx += 80) {
        ctx.fillRect(lx, 360, 16, 40);
      }
    }

    activeLevel.platforms.forEach(p => {
      if (p.type === 'ground') {
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#00a800';
        ctx.fillRect(p.x, p.y, p.w, 14);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      } else if (p.type === 'underground') {
        ctx.fillStyle = '#222255';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      } else if (p.type === 'castle') {
        ctx.fillStyle = '#555555';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      } else if (p.type === 'brick' || p.type === 'underground_brick' || p.type === 'castle_brick') {
        ctx.fillStyle = currentLevel === 2 ? '#884444' : '#b84010';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      } else if (p.type === 'question') {
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#000';
        ctx.fillRect(p.x + 10, p.y + 6, 10, 4);
        ctx.fillRect(p.x + 16, p.y + 10, 4, 6);
        ctx.fillRect(p.x + 10, p.y + 16, 10, 4);
        ctx.fillRect(p.x + 10, p.y + 24, 4, 4);
      } else if (p.type === 'empty') {
        // Bloc question déjà frappé (vide/inactif)
        ctx.fillStyle = '#7a421d';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      } else if (p.type === 'pipe') {
        ctx.fillStyle = '#00a800';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillRect(p.x - 4, p.y, p.w + 8, 22);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(p.x + 4, p.y + 2, 6, 18);
        ctx.fillRect(p.x + 8, p.y + 26, 6, p.h - 26);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.strokeRect(p.x - 4, p.y, p.w + 8, 22);
      }
    });

    const fX = activeLevel.flagX;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fX, 80, 8, 240);
    ctx.fillStyle = currentLevel === 2 ? '#ffcc00' : '#00a800';
    ctx.beginPath();
    ctx.arc(fX + 4, 80, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e52521';
    ctx.beginPath();
    ctx.moveTo(fX + 8, 90);
    ctx.lineTo(fX + 56, 110);
    ctx.lineTo(fX + 8, 130);
    ctx.fill();

    activeLevel.enemies.forEach(en => {
      if (!en.alive) return;
      drawSprite(goombaSprite, goombaPalette, en.x, en.y, 2, en.vx > 0);
    });

    let currentMarioFrame = marioStand;
    if (!player.grounded) {
      currentMarioFrame = marioJump;
    } else if (Math.abs(player.vx) > 0.2) {
      currentMarioFrame = (Math.floor(frameCount / 6) % 2 === 0) ? marioWalk1 : marioStand;
    }
    drawSprite(currentMarioFrame, marioPalette, player.x, player.y, 2, player.facing === 'left');

    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MARIO    SCORE', 30, 30);
    ctx.fillText(`000000   ${String(score).padStart(6, '0')}`, 30, 52);
    ctx.textAlign = 'right';
    ctx.fillText(activeLevel.name, canvas.width - 30, 30);

    if (gameWin) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8b800';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VICTOIRE TOTALE !', canvas.width/2, canvas.height/2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(`SCORE FINAL : ${score}`, canvas.width/2, canvas.height/2 + 20);
    }
  }

  function loop() { update(); draw(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  window.__marioStop = function () {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.__marioStop = null;
  };
};