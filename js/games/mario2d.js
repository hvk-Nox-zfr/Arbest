window.startMarioGame = function () {
  if (window.__marioStop) window.__marioStop();
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let camX = 0, score = 0, gameOver = false, gameWin = false, raf = 0, frameCount = 0;

  const player = {
    x: 40, y: 200, w: 28, h: 32,
    vx: 0, vy: 0,
    speed: 3.5,
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

  // ⭐ Sprites améliorés - plus fidèles au style NES authentique
  const marioPalette = {
    1: '#b13425', // Rouge foncé (casquette)
    2: '#e52521', // Rouge vif
    3: '#f89838', // Peau
    4: '#000000', // Noir
    5: '#6b4423', // Marron (cheveux)
    6: '#0058f8', // Bleu salopette
    7: '#f8b800'  // Jaune (boutons)
  };

  const marioStand = [
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,5,5,5,4,4,4,3,0,0,0,0,0,0],
    [0,0,5,4,5,4,4,4,3,3,3,3,0,0,0,0],
    [0,0,5,4,5,5,4,4,4,3,3,3,3,0,0,0],
    [0,0,5,5,4,4,4,4,3,3,3,0,0,0,0,0],
    [0,0,0,0,4,4,4,4,4,4,0,0,0,0,0,0],
    [0,0,0,2,2,6,2,2,2,0,0,0,0,0,0,0],
    [0,0,2,2,2,6,2,2,6,2,2,2,0,0,0,0],
    [0,2,2,2,2,6,6,6,6,2,2,2,2,0,0,0],
    [0,3,3,2,6,4,6,6,4,6,2,3,3,0,0,0],
    [0,3,3,3,6,6,6,6,6,6,3,3,3,0,0,0],
    [0,0,3,6,6,6,6,6,6,6,3,0,0,0,0,0],
    [0,0,0,4,4,4,0,0,4,4,4,0,0,0,0,0],
    [0,0,4,4,4,4,0,0,4,4,4,4,0,0,0,0],
    [0,4,4,4,4,0,0,0,0,4,4,4,4,0,0,0]
  ];

  const marioWalk1 = [
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,5,5,5,4,4,4,3,0,0,0,0,0,0],
    [0,0,5,4,5,4,4,4,3,3,3,3,0,0,0,0],
    [0,0,5,4,5,5,4,4,4,3,3,3,3,0,0,0],
    [0,0,5,5,4,4,4,4,3,3,3,0,0,0,0,0],
    [0,0,0,0,4,4,4,4,4,4,0,0,0,0,0,0],
    [0,0,0,2,2,6,2,2,2,0,0,0,0,0,0,0],
    [0,0,2,2,2,6,2,2,6,2,2,0,0,0,0,0],
    [0,2,2,2,2,6,6,6,6,2,2,0,0,0,0,0],
    [0,3,3,2,6,4,6,6,4,6,2,0,0,0,0,0],
    [0,3,3,3,6,6,6,6,6,6,3,0,0,0,0,0],
    [0,0,3,6,6,6,6,6,6,6,3,0,0,0,0,0],
    [0,0,4,4,4,0,0,0,4,4,4,0,0,0,0,0],
    [0,4,4,4,0,0,0,0,0,4,4,4,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ];

  const marioJump = [
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,5,5,5,4,4,4,3,0,0,0,0,0,0],
    [0,0,5,4,5,4,4,4,3,3,3,3,0,0,0,0],
    [0,0,5,4,5,5,4,4,4,3,3,3,3,0,0,0],
    [0,0,5,5,4,4,4,4,3,3,3,0,0,0,0,0],
    [0,0,0,0,4,4,4,4,4,4,0,0,0,0,0,0],
    [0,0,2,2,2,6,2,2,2,2,2,0,0,0,0,0],
    [0,2,2,2,2,6,6,6,6,2,2,2,0,0,0,0],
    [0,3,3,2,6,4,6,6,4,6,2,2,0,0,0,0],
    [0,3,3,3,6,6,6,6,6,6,3,3,0,0,0,0],
    [0,0,3,6,6,6,6,6,6,6,3,0,0,0,0,0],
    [0,4,4,4,0,0,0,0,0,4,4,4,0,0,0,0],
    [4,4,4,0,0,0,0,0,0,0,4,4,4,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ];

  const goombaSprite = [
    [0,0,0,0,4,4,4,4,4,4,0,0,0,0,0,0],
    [0,0,0,4,1,1,1,1,1,1,4,0,0,0,0,0],
    [0,0,4,1,1,1,1,1,1,1,1,4,0,0,0,0],
    [0,4,1,1,4,4,1,1,4,4,1,1,4,0,0,0],
    [4,1,1,4,3,3,4,4,3,3,4,1,1,4,0,0],
    [4,1,1,4,3,3,4,4,3,3,4,1,1,4,0,0],
    [4,1,1,1,4,4,4,4,4,4,1,1,1,4,0,0],
    [0,4,1,1,1,1,1,1,1,1,1,1,4,0,0,0],
    [0,0,4,1,1,1,1,1,1,1,1,4,0,0,0,0],
    [0,0,0,4,4,3,3,3,3,4,4,0,0,0,0,0],
    [0,0,4,3,3,3,3,3,3,3,3,4,0,0,0,0],
    [0,4,3,3,3,3,3,3,3,3,3,3,4,0,0,0],
    [4,4,4,4,3,3,4,4,3,3,4,4,4,4,0,0],
    [4,0,0,4,4,4,0,0,4,4,4,0,0,4,0,0],
    [4,0,0,4,4,4,0,0,4,4,4,0,0,4,0,0],
    [0,0,0,4,4,0,0,0,0,4,4,0,0,0,0,0]
  ];
  const goombaPalette = { 1: '#a04000', 2: '#d97028', 3: '#f8b878', 4: '#000000' };

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

  // ⭐ NIVEAU CORRIGÉ - Espacements raisonnables
  const platforms = [
    // Sol avec trous de 64 pixels (facilement franchissables)
    { x: 0,    y: 320, w: 1280, h: 80, type: 'ground' },
    { x: 1344, y: 320, w: 640,  h: 80, type: 'ground' },
    { x: 2048, y: 320, w: 1600, h: 80, type: 'ground' },
    
    // Blocs - espacement correct
    { x: 256, y: 208, w: 32, h: 32, type: 'question' },
    { x: 320, y: 208, w: 32, h: 32, type: 'brick' },
    { x: 352, y: 208, w: 32, h: 32, type: 'question' },
    { x: 384, y: 208, w: 32, h: 32, type: 'brick' },
    { x: 416, y: 208, w: 32, h: 32, type: 'question' },
    { x: 352, y: 96,  w: 32, h: 32, type: 'question' },
    
    { x: 800, y: 208, w: 32, h: 32, type: 'brick' },
    { x: 832, y: 208, w: 32, h: 32, type: 'question' },
    { x: 864, y: 208, w: 32, h: 32, type: 'brick' },
    
    // Tuyaux - hauteur réduite pour être franchissables
    { x: 576,  y: 272, w: 48, h: 48, type: 'pipe' },
    { x: 736,  y: 256, w: 48, h: 64, type: 'pipe' },
    { x: 1152, y: 240, w: 48, h: 80, type: 'pipe' },
    { x: 1600, y: 272, w: 48, h: 48, type: 'pipe' },
    { x: 1920, y: 272, w: 48, h: 48, type: 'pipe' },
    
    // Escalier final
    { x: 2400, y: 288, w: 32, h: 32, type: 'brick' },
    { x: 2432, y: 256, w: 64, h: 64, type: 'brick' },
    { x: 2496, y: 224, w: 96, h: 96, type: 'brick' },
    { x: 2592, y: 192, w: 128, h: 128, type: 'brick' }
  ];

  let enemies = [
    { x: 400, y: 288, w: 32, h: 32, vx: -1.2, vy: 0, alive: true },
    { x: 900, y: 288, w: 32, h: 32, vx: -1.2, vy: 0, alive: true },
    { x: 1500, y: 288, w: 32, h: 32, vx: -1.4, vy: 0, alive: true },
    { x: 1800, y: 288, w: 32, h: 32, vx: -1.2, vy: 0, alive: true }
  ];

  const flagX = 3200;

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

    player.x += player.vx;
    platforms.forEach(p => {
      if (rectIntersect(player, p)) {
        if (player.vx > 0) player.x = p.x - player.w;
        else if (player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    });

    player.y += player.vy;
    const wasGrounded = player.grounded;
    player.grounded = false;
    platforms.forEach(p => {
      if (rectIntersect(player, p)) {
        if (player.vy > 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.grounded = true;
        } else if (player.vy < 0) {
          player.y = p.y + p.h;
          player.vy = 0;
        }
      }
    });

    if (wasGrounded && !player.grounded && player.vy >= 0) {
      player.coyoteTime = COYOTE_FRAMES;
    }

    if (player.y > canvas.height + 50) triggerDeath();
    if (player.x >= flagX) {
      gameWin = true;
      score += 4000;
      if (typeof updateHighScore === 'function') updateHighScore('mario', score);
    }

    enemies.forEach(en => {
      if (!en.alive) return;
      en.vy += gravity;
      if (en.vy > MAX_FALL) en.vy = MAX_FALL;

      en.x += en.vx;
      platforms.forEach(p => {
        if (rectIntersect(en, p)) {
          if (en.vx > 0) en.x = p.x - en.w;
          else if (en.vx < 0) en.x = p.x + p.w;
          en.vx *= -1;
        }
      });

      en.y += en.vy;
      platforms.forEach(p => {
        if (rectIntersect(en, p)) {
          if (en.vy > 0) { en.y = p.y - en.h; en.vy = 0; }
          else if (en.vy < 0) { en.y = p.y + p.h; en.vy = 0; }
        }
      });

      const footX = en.vx > 0 ? en.x + en.w + 2 : en.x - 2;
      const footY = en.y + en.h + 2;
      let groundAhead = false;
      platforms.forEach(p => {
        if (footX >= p.x && footX <= p.x + p.w && footY >= p.y && footY <= p.y + p.h) {
          groundAhead = true;
        }
      });
      if (!groundAhead && en.vy === 0) en.vx *= -1;

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
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camX, 0);

    // Nuages améliorés
    ctx.fillStyle = '#ffffff';
    [150, 650, 1300, 1950, 2550].forEach(cx => {
      ctx.fillRect(cx, 60, 48, 16);
      ctx.fillRect(cx - 16, 76, 80, 16);
      ctx.fillRect(cx - 8, 92, 64, 12);
    });

    // Collines avec dégradé
    [300, 1200, 2200].forEach(hx => {
      ctx.fillStyle = '#00a800';
      ctx.beginPath();
      ctx.moveTo(hx, 320);
      ctx.lineTo(hx + 64, 224);
      ctx.lineTo(hx + 128, 320);
      ctx.fill();
      
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.moveTo(hx + 32, 320);
      ctx.lineTo(hx + 64, 256);
      ctx.lineTo(hx + 96, 320);
      ctx.fill();
    });

    // Plateformes avec textures détaillées
    platforms.forEach(p => {
      if (p.type === 'ground') {
        // Sol avec texture de briques
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        
        // Herbe avec dégradé
        ctx.fillStyle = '#00a800';
        ctx.fillRect(p.x, p.y, p.w, 16);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(p.x, p.y, p.w, 8);
        
        // Lignes de briques
        ctx.strokeStyle = '#8b3000';
        ctx.lineWidth = 2;
        for (let i = 0; i < p.w; i += 32) {
          ctx.strokeRect(p.x + i, p.y + 16, 32, 32);
          ctx.strokeRect(p.x + i + 16, p.y + 48, 32, 32);
        }
      } else if (p.type === 'brick') {
        ctx.fillStyle = '#b84010';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        
        // Texture brique détaillée
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        
        ctx.fillStyle = '#d85820';
        ctx.fillRect(p.x + 2, p.y + 2, 14, 14);
        ctx.fillRect(p.x + 18, p.y + 2, 12, 14);
        ctx.fillRect(p.x + 2, p.y + 18, 12, 12);
        ctx.fillRect(p.x + 16, p.y + 18, 14, 12);
      } else if (p.type === 'question') {
        // Bloc question animé
        const pulse = Math.sin(frameCount * 0.1) * 0.1 + 1;
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        
        // Point d'interrogation détaillé
        ctx.fillStyle = '#000';
        ctx.fillRect(p.x + 10, p.y + 6, 12, 4);
        ctx.fillRect(p.x + 18, p.y + 10, 4, 6);
        ctx.fillRect(p.x + 10, p.y + 16, 12, 4);
        ctx.fillRect(p.x + 10, p.y + 24, 4, 4);
        
        // Reflet
        ctx.fillStyle = '#fcd878';
        ctx.fillRect(p.x + 2, p.y + 2, 4, 4);
      } else if (p.type === 'pipe') {
        // Tuyau avec dégradé et reflets
        ctx.fillStyle = '#00a800';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        
        // Partie supérieure plus large
        ctx.fillRect(p.x - 4, p.y, p.w + 8, 24);
        
        // Reflets
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(p.x - 2, p.y + 2, 8, 20);
        ctx.fillRect(p.x + 8, p.y + 26, 8, p.h - 26);
        
        // Ombres
        ctx.fillStyle = '#006800';
        ctx.fillRect(p.x + p.w - 8, p.y + 2, 8, 20);
        ctx.fillRect(p.x + p.w - 16, p.y + 26, 8, p.h - 26);
        
        // Contour
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.strokeRect(p.x - 4, p.y, p.w + 8, 24);
      }
    });

    // Drapeau amélioré
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(flagX, 80, 8, 240);
    ctx.fillStyle = '#00a800';
    ctx.beginPath();
    ctx.arc(flagX + 4, 80, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8b800';
    ctx.beginPath();
    ctx.arc(flagX + 4, 80, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Drapeau qui flotte
    const flagWave = Math.sin(frameCount * 0.15) * 4;
    ctx.fillStyle = '#e52521';
    ctx.beginPath();
    ctx.moveTo(flagX + 8, 90);
    ctx.lineTo(flagX + 56 + flagWave, 110);
    ctx.lineTo(flagX + 8, 130);
    ctx.fill();

    enemies.forEach(en => {
      if (!en.alive) return;
      drawSprite(goombaSprite, goombaPalette, en.x, en.y, 2, en.vx > 0);
    });

    let currentMarioFrame = marioStand;
    if (!player.grounded) currentMarioFrame = marioJump;
    else if (Math.abs(player.vx) > 0.2) {
      currentMarioFrame = (Math.floor(frameCount / 6) % 2 === 0) ? marioWalk1 : marioStand;
    }
    drawSprite(currentMarioFrame, marioPalette, player.x, player.y, 2, player.facing === 'left');

    ctx.restore();

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MARIO    SCORE', 30, 30);
    ctx.fillText(`000000   ${String(score).padStart(6, '0')}`, 30, 52);
    ctx.textAlign = 'right';
    ctx.fillText('WORLD 1-1', canvas.width - 30, 30);

    if (gameWin) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8b800';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE CLEAR !', canvas.width/2, canvas.height/2 - 20);
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