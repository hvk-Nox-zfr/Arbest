function startRunnerGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (window.MobileKit) MobileKit.setup({ mode: 'canvas', controls: 'tap' });

  const W = canvas.width;
  const H = canvas.height;
  const groundY = H - 35;

  // Définition des 3 Niveaux (Maps)
const LEVELS = [
    {
      name: 'NIVEAU 1 : NEON DASH',
      color: '#00f3ff',
      bgGrad: ['#090a18', '#121530'],
      speed: 5.5,
      length: 2200,
      obstacles: [
        { type: 'spike', x: 450 },
        { type: 'block', x: 650, y: 0, w: 90, h: 32 },
        { type: 'spike', x: 850 },
        { type: 'spike', x: 880 },
        { type: 'block', x: 1050, y: 0, w: 60, h: 32 },
        { type: 'block', x: 1110, y: 0, w: 60, h: 64 },
        { type: 'pad', x: 1280 },
        { type: 'block', x: 1380, y: 65, w: 120, h: 32 },
        { type: 'spike', x: 1410, y: 97 },
        { type: 'spike', x: 1650 },
        { type: 'spike', x: 1680 },
        { type: 'block', x: 1850, y: 0, w: 90, h: 32 }
      ]
    },
    {
      name: 'NIVEAU 2 : CYBER BLOCK',
      color: '#ff0055',
      bgGrad: ['#180511', '#300a22'],
      speed: 5.8,
      length: 2400,
      obstacles: [
        { type: 'spike', x: 450 },
        { type: 'block', x: 650, y: 0, w: 48, h: 32 },
        { type: 'block', x: 698, y: 0, w: 48, h: 64 },
        { type: 'spike', x: 920 },
        { type: 'pad', x: 1100 },
        { type: 'block', x: 1220, y: 60, w: 140, h: 32 },
        { type: 'spike', x: 1480 },
        { type: 'block', x: 1650, y: 0, w: 80, h: 32 },
        { type: 'pad', x: 1850 },
        { type: 'block', x: 1980, y: 70, w: 120, h: 32 },
        { type: 'spike', x: 2200 }
      ]
    },
    {
      name: 'NIVEAU 3 : ELECTRO HELL',
      color: '#ffe600',
      bgGrad: ['#1a1600', '#332c00'],
      speed: 6.8,
      length: 3000,
      obstacles: [
        { type: 'spike', x: 400 },
        { type: 'spike', x: 430 },
        { type: 'block', x: 600, y: 0, w: 64, h: 32 },
        { type: 'spike', x: 616, y: 32 },
        { type: 'pad', x: 800 },
        { type: 'block', x: 920, y: 80, w: 96, h: 32 },
        { type: 'spike', x: 1100 },
        { type: 'spike', x: 1130 },
        { type: 'spike', x: 1160 },
        { type: 'block', x: 1350, y: 0, w: 120, h: 32 },
        { type: 'block', x: 1550, y: 0, w: 32, h: 64 },
        { type: 'pad', x: 1700 },
        { type: 'block', x: 1820, y: 85, w: 160, h: 32 },
        { type: 'spike', x: 1880, y: 117 },
        { type: 'spike', x: 2150 },
        { type: 'spike', x: 2180 },
        { type: 'block', x: 2350, y: 0, w: 96, h: 32 },
        { type: 'spike', x: 2600 },
        { type: 'spike', x: 2630 }
      ]
    }
  ];

  // Récupère le dernier niveau atteint ou démarre au niveau 0
  let currentLevelIdx = window.lastRunnerLevel !== undefined ? window.lastRunnerLevel : 0;
  let level = LEVELS[currentLevelIdx];

  // Joueur
  const player = {
    x: 80,
    y: groundY - 28,
    w: 28,
    h: 28,
    vy: 0,
    gravity: 0.75,
    jumpForce: -12.5,
    isGrounded: false,
    rotation: 0,
    trail: []
  };

  let isHoldingInput = false;
  let jumpBufferTimer = 0;
  let coyoteTimer = 0;

  let cameraX = 0;
  let score = 0;
  let isGameOver = false;
  let levelCompleted = false;
  let levelBannerTimer = 120;

  function resetLevel(idx) {
    currentLevelIdx = idx;
    window.lastRunnerLevel = idx; // Sauvegarde du niveau en cours pour le respawn
    level = LEVELS[currentLevelIdx];
    cameraX = 0;
    player.y = groundY - player.h;
    player.vy = 0;
    player.isGrounded = true;
    player.rotation = 0;
    player.trail = [];
    isHoldingInput = false;
    jumpBufferTimer = 0;
    coyoteTimer = 0;
    levelCompleted = false;
    levelBannerTimer = 120;
  }

  function handleInputDown(e) {
    if (e.type === 'keydown' && e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'KeyW') return;
    if (e.repeat) return;
    
    if (levelCompleted) {
      if (currentLevelIdx < LEVELS.length - 1) {
        resetLevel(currentLevelIdx + 1);
      } else {
        window.lastRunnerLevel = 0; // Réinitialise au niveau 1 si tout le jeu est fini
        triggerGameOver(score);
      }
      return;
    }

    isHoldingInput = true;
    jumpBufferTimer = 10;
  }

  function handleInputUp(e) {
    if (e.type === 'keyup' && e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'KeyW') return;
    isHoldingInput = false;
  }

  if (window._runnerDownHandler) {
    window.removeEventListener('keydown', window._runnerDownHandler);
    window.removeEventListener('keyup', window._runnerUpHandler);
    window.removeEventListener('pointerdown', window._runnerDownHandler);
    window.removeEventListener('pointerup', window._runnerUpHandler);
  }

  window._runnerDownHandler = handleInputDown;
  window._runnerUpHandler = handleInputUp;

  window.addEventListener('keydown', handleInputDown);
  window.addEventListener('keyup', handleInputUp);
  window.addEventListener('pointerdown', handleInputDown);
  window.addEventListener('pointerup', handleInputUp);

  function update() {
    if (isGameOver) return;

    ctx.save();

    // Fond
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, level.bgGrad[0]);
    bgGrad.addColorStop(1, level.bgGrad[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Grille rétro
    ctx.strokeStyle = level.color + '15';
    ctx.lineWidth = 1;
    const gridOffset = (cameraX * 0.5) % 30;
    for (let x = -gridOffset; x < W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    if (!levelCompleted) {
      cameraX += level.speed;
      score += 1;
      const scoreEl = document.getElementById('current-score');
      if (scoreEl) scoreEl.innerText = score;

      player.vy += player.gravity;
      const prevY = player.y;
      player.y += player.vy;

      player.isGrounded = false;

      if (player.y + player.h >= groundY) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.isGrounded = true;
      }

      const pBox = {
        left: player.x + 4,
        right: player.x + player.w - 4,
        top: player.y + 4,
        bottom: player.y + player.h
      };

      for (let obs of level.obstacles) {
        const obsWorldX = obs.x - cameraX;
        if (obsWorldX < -100 || obsWorldX > W + 100) continue;

        if (obs.type === 'block') {
          const bTop = groundY - obs.h - (obs.y || 0);
          const bBox = {
            left: obsWorldX,
            right: obsWorldX + obs.w,
            top: bTop,
            bottom: bTop + obs.h
          };

          if (
            pBox.right > bBox.left &&
            pBox.left < bBox.right &&
            pBox.bottom > bBox.top &&
            pBox.top < bBox.bottom
          ) {
            if (prevY + player.h <= bBox.top + 12 && player.vy >= 0) {
              player.y = bBox.top - player.h;
              player.vy = 0;
              player.isGrounded = true;
            } else {
              gameOver();
              return;
            }
          }
        } else if (obs.type === 'spike') {
          const sTop = groundY - 26 - (obs.y || 0);
          const sBox = {
            left: obsWorldX + 4,
            right: obsWorldX + 22,
            top: sTop + 4,
            bottom: sTop + 26
          };

          if (
            pBox.right > sBox.left &&
            pBox.left < sBox.right &&
            pBox.bottom > sBox.top &&
            pBox.top < sBox.bottom
          ) {
            gameOver();
            return;
          }
        } else if (obs.type === 'pad') {
          const padX = obsWorldX;
          const padY = groundY - 8;
          if (
            player.x + player.w > padX &&
            player.x < padX + 26 &&
            player.y + player.h >= padY - 5
          ) {
            player.vy = -14.5;
            player.isGrounded = false;
            jumpBufferTimer = 0;
            if (typeof playSound === 'function') {
              playSound(880, 0.08, 'sine');
            }
          }
        }
      }

      if (player.isGrounded) {
        coyoteTimer = 6;
      } else if (coyoteTimer > 0) {
        coyoteTimer--;
      }

      if (jumpBufferTimer > 0) {
        jumpBufferTimer--;
      }

      if ((jumpBufferTimer > 0 || isHoldingInput) && (player.isGrounded || coyoteTimer > 0)) {
        player.vy = player.jumpForce;
        player.isGrounded = false;
        coyoteTimer = 0;
        jumpBufferTimer = 0;
        if (typeof playSound === 'function') {
          playSound(620, 0.06, 'square');
        }
      }

      if (Math.random() < 0.6) {
        player.trail.push({
          x: player.x - 5,
          y: player.y + player.h - Math.random() * 8,
          size: Math.random() * 6 + 2,
          alpha: 1
        });
      }

      if (cameraX >= level.length) {
        levelCompleted = true;
        if (typeof playSound === 'function') {
          playSound(987, 0.15, 'triangle');
        }
      }
    }

    // Rendu du Sol
    ctx.shadowBlur = 12;
    ctx.shadowColor = level.color;
    ctx.strokeStyle = level.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    ctx.strokeStyle = level.color + '40';
    ctx.lineWidth = 1;
    const groundStripe = (cameraX) % 16;
    for (let x = -groundStripe; x < W + 16; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 8, H);
      ctx.stroke();
    }

    // Obstacles
    for (let obs of level.obstacles) {
      const obsX = obs.x - cameraX;
      if (obsX < -150 || obsX > W + 50) continue;

      if (obs.type === 'block') {
        const bY = groundY - obs.h - (obs.y || 0);

        ctx.fillStyle = '#0e1222';
        ctx.fillRect(obsX, bY, obs.w, obs.h);

        ctx.strokeStyle = level.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(obsX, bY, obs.w, obs.h);

        ctx.strokeStyle = level.color + '50';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obsX, bY);
        ctx.lineTo(obsX + obs.w, bY + obs.h);
        ctx.moveTo(obsX + obs.w, bY);
        ctx.lineTo(obsX, bY + obs.h);
        ctx.stroke();
      } else if (obs.type === 'spike') {
        const sY = groundY - (obs.y || 0);

        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(obsX, sY);
        ctx.lineTo(obsX + 13, sY - 26);
        ctx.lineTo(obsX + 26, sY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (obs.type === 'pad') {
        const pY = groundY - 6;

        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(obsX + 13, pY, 13, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Portail
    const portalX = level.length - cameraX;
    if (portalX < W + 100) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff88';
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(portalX, groundY - 50, 15, 45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Particules
    for (let i = player.trail.length - 1; i >= 0; i--) {
      const p = player.trail[i];
      p.x -= level.speed * 0.4;
      p.alpha -= 0.04;
      if (p.alpha <= 0) {
        player.trail.splice(i, 1);
        continue;
      }
      ctx.fillStyle = level.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
      ctx.shadowBlur = 6;
      ctx.shadowColor = level.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    // Joueur
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);

    if (!player.isGrounded) {
      player.rotation += 0.14;
    } else {
      player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
    }
    ctx.rotate(player.rotation);

    ctx.shadowBlur = 15;
    ctx.shadowColor = level.color;
    ctx.fillStyle = level.color;
    ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-player.w / 2 + 2, -player.h / 2 + 2, player.w - 4, player.h - 4);

    ctx.fillStyle = '#000000';
    ctx.fillRect(-8, -6, 5, 5);
    ctx.fillRect(3, -6, 5, 5);
    ctx.restore();

    // Progression UI
    const progress = Math.min(1, cameraX / level.length);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(W / 2 - 120, 12, 240, 8);

    ctx.fillStyle = level.color;
    ctx.fillRect(W / 2 - 120, 12, 240 * progress, 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(level.name, W / 2, 32);

    if (levelBannerTimer > 0) {
      levelBannerTimer--;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(W / 2 - 150, H / 2 - 30, 300, 45);
      ctx.fillStyle = level.color;
      ctx.font = '900 18px "Rajdhani", sans-serif';
      ctx.fillText(level.name, W / 2, H / 2 - 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 12px "Rajdhani", sans-serif';
      ctx.fillText('APPUYEZ POUR SAUTER ET ÉVITER LES BLOCS', W / 2, H / 2 + 14);
    }

    if (levelCompleted) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#00ff88';
      ctx.font = '900 24px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';

      if (currentLevelIdx < LEVELS.length - 1) {
        ctx.fillText('MAP COMPLÉTÉE !', W / 2, H / 2 - 15);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 15px "Rajdhani", sans-serif';
        ctx.fillText('CLIQUE OU TAPE POUR LA MAP SUIVANTE', W / 2, H / 2 + 20);
      } else {
        ctx.fillText('TOUS LES NIVEAUX RÉUSSIS !', W / 2, H / 2 - 15);
        ctx.fillStyle = '#ffe600';
        ctx.font = '600 15px "Rajdhani", sans-serif';
        ctx.fillText('SCORE FINAL : ' + score, W / 2, H / 2 + 20);
      }
    }

    ctx.restore();

    if (!isGameOver) {
      currentGameLoop = requestAnimationFrame(update);
    }
  }

  function gameOver() {
    isGameOver = true;
    if (typeof triggerGameOver === 'function') {
      triggerGameOver(score);
    }
  }

  resetLevel(currentLevelIdx);
  currentGameLoop = requestAnimationFrame(update);
}