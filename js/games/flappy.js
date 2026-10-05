function startFlappyGame() {
  if (window.GameMobile) GameMobile.reset();
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  // Variables du jeu
  let score = 0;
  let isGameOver = false;
  let gameStarted = false;
  let frameCount = 0;

  // Poulet taille réduite (proportions identiques à Flappy Bird)
  const chicken = {
    x: 100,
    y: H / 2,
    radius: 10, // Taille réduite
    vy: 0,
    gravity: 0.38,
    jump: -6.5,
    rotation: 0,
    wingPhase: 0
  };

  // Tuyaux
  const pipes = [];
  const pipeWidth = 50;
  const pipeGap = 120;
  const pipeSpeed = 2.4;

  function createPipe() {
    const minHeight = 40;
    const maxHeight = H - pipeGap - minHeight - 40;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    pipes.push({
      x: W,
      topHeight: topHeight,
      bottomY: topHeight + pipeGap,
      passed: false
    });
  }

  // Saut instantané
  function jump() {
    if (isGameOver) return;
    if (!gameStarted) {
      gameStarted = true;
    }
    chicken.vy = chicken.jump;
    chicken.wingPhase = Math.PI;
    if (typeof playSound === 'function') {
      playSound(580, 0.05, 'square');
    }
  }

  // Gestion des entrées sans latence (PointerDown / KeyDown)
  function handleInput(e) {
    if (e.type === 'keydown') {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      if (e.repeat) return;
      e.preventDefault();
      jump();
    } else if (e.type === 'pointerdown') {
      // Toucher sur le canvas OU sur les bandes noires du plein écran
      const t = e.target;
      const inGame = t === canvas || (t.closest && t.closest('#gm-stage'));
      if (!inGame) return;
      e.preventDefault();
      jump();
    }
  }

  if (window._flappyInputHandler) {
    window.removeEventListener('keydown', window._flappyInputHandler);
    window.removeEventListener('pointerdown', window._flappyInputHandler);
    canvas.removeEventListener('pointerdown', window._flappyInputHandler);
  }

  window._flappyInputHandler = handleInput;
  window.addEventListener('keydown', handleInput);
  window.addEventListener('pointerdown', handleInput);

  // Décor rétro exact de Flappy Bird
  function drawBackground() {
    // 1. Ciel bleu rétro
    ctx.fillStyle = '#4ec0ca';
    ctx.fillRect(0, 0, W, H);

    // 2. Silhouettes d'immeubles / arrière-plan distant
    ctx.fillStyle = '#b0e0e6';
    const cityOffset = (frameCount * 0.2) % 60;
    for (let x = -60; x < W + 60; x += 30) {
      const h = 25 + ((x * 13) % 20);
      ctx.fillRect(x - cityOffset, H - 75 - h, 22, h);
    }

    // 3. Nuages
    ctx.fillStyle = '#ffffff';
    const cloudOffset = (frameCount * 0.3) % W;
    [50, 200, 380, 540].forEach(cx => {
      const x = (cx - cloudOffset + W) % W;
      ctx.beginPath();
      ctx.arc(x, H - 90, 18, 0, Math.PI * 2);
      ctx.arc(x + 12, H - 98, 14, 0, Math.PI * 2);
      ctx.arc(x - 12, H - 94, 12, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Buissons verts au pied de la ville
    ctx.fillStyle = '#55d070';
    ctx.fillRect(0, H - 52, W, 17);
    ctx.fillStyle = '#3eb858';
    ctx.fillRect(0, H - 38, W, 3);

    // 5. Sol (Bande d'herbe supérieure + terre défilante)
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(0, H - 35, W, 10);
    ctx.fillStyle = '#9ce659';
    ctx.fillRect(0, H - 35, W, 3); // Ligne claire herbe

    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, H - 25, W, 25);

    // Stries du sol
    ctx.strokeStyle = '#cbb86b';
    ctx.lineWidth = 3;
    const groundOffset = (frameCount * pipeSpeed) % 14;
    for (let x = -14; x < W + 14; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x - groundOffset, H - 25);
      ctx.lineTo(x - groundOffset + 7, H);
      ctx.stroke();
    }
  }

  // Rendu des tuyaux style Flappy Bird d'origine
  function drawPipe(p) {
    const mainGreen = '#73bf2e';
    const lightGreen = '#9de64e';
    const darkGreen = '#558022';
    const border = '#283810';
    const capHeight = 20;
    const capOverflow = 3;

    // --- Tuyau Haut ---
    ctx.fillStyle = mainGreen;
    ctx.fillRect(p.x, 0, pipeWidth, p.topHeight - capHeight);
    ctx.fillStyle = lightGreen;
    ctx.fillRect(p.x + 3, 0, 4, p.topHeight - capHeight);
    ctx.fillStyle = darkGreen;
    ctx.fillRect(p.x + pipeWidth - 7, 0, 4, p.topHeight - capHeight);
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, 0, pipeWidth, p.topHeight - capHeight);

    // Chapeau Haut
    ctx.fillStyle = mainGreen;
    ctx.fillRect(p.x - capOverflow, p.topHeight - capHeight, pipeWidth + capOverflow * 2, capHeight);
    ctx.fillStyle = lightGreen;
    ctx.fillRect(p.x - capOverflow + 3, p.topHeight - capHeight, 4, capHeight);
    ctx.fillStyle = darkGreen;
    ctx.fillRect(p.x + pipeWidth + capOverflow - 7, p.topHeight - capHeight, 4, capHeight);
    ctx.strokeRect(p.x - capOverflow, p.topHeight - capHeight, pipeWidth + capOverflow * 2, capHeight);

    // --- Tuyau Bas ---
    const bottomHeight = H - 35 - p.bottomY;
    ctx.fillStyle = mainGreen;
    ctx.fillRect(p.x - capOverflow, p.bottomY, pipeWidth + capOverflow * 2, capHeight);
    ctx.fillStyle = lightGreen;
    ctx.fillRect(p.x - capOverflow + 3, p.bottomY, 4, capHeight);
    ctx.fillStyle = darkGreen;
    ctx.fillRect(p.x + pipeWidth + capOverflow - 7, p.bottomY, 4, capHeight);
    ctx.strokeRect(p.x - capOverflow, p.bottomY, pipeWidth + capOverflow * 2, capHeight);

    ctx.fillStyle = mainGreen;
    ctx.fillRect(p.x, p.bottomY + capHeight, pipeWidth, bottomHeight - capHeight);
    ctx.fillStyle = lightGreen;
    ctx.fillRect(p.x + 3, p.bottomY + capHeight, 4, bottomHeight - capHeight);
    ctx.fillStyle = darkGreen;
    ctx.fillRect(p.x + pipeWidth - 7, p.bottomY + capHeight, 4, bottomHeight - capHeight);
    ctx.strokeRect(p.x, p.bottomY + capHeight, pipeWidth, bottomHeight - capHeight);
  }

  // Poulet miniature Flappy (Proportions ajustées)
  function drawChicken() {
    ctx.save();
    ctx.translate(chicken.x, chicken.y);

    // Rotation selon la vitesse
    chicken.rotation = Math.min(Math.PI / 2.8, Math.max(-Math.PI / 5, chicken.vy * 0.1));
    ctx.rotate(chicken.rotation);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000000';

    // 1. Crête rouge
    ctx.fillStyle = '#e62222';
    ctx.beginPath();
    ctx.arc(-2, -10, 3.5, 0, Math.PI * 2);
    ctx.arc(2, -11, 4, 0, Math.PI * 2);
    ctx.arc(6, -9, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Corps Jaune compact
    ctx.fillStyle = '#f8d038';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Ventre clair
    ctx.fillStyle = '#fff4b0';
    ctx.beginPath();
    ctx.arc(-1, 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // 4. Barbillon sous le bec
    ctx.fillStyle = '#e62222';
    ctx.beginPath();
    ctx.arc(7, 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Bec Orange
    ctx.fillStyle = '#f88020';
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(15, 1);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Grand œil Flappy
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(5.5, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Reflet œil
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6, -4, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // 7. Aile blanche animée
    const wingY = Math.sin(chicken.wingPhase) * 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-3, 1 + wingY, 6, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Boucle principale
  function update() {
    frameCount++;

    if (chicken.wingPhase > 0) {
      chicken.wingPhase -= 0.25;
    }

    if (gameStarted && !isGameOver) {
      chicken.vy += chicken.gravity;
      chicken.y += chicken.vy;

      if (frameCount % 105 === 0) {
        createPipe();
      }

      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= pipeSpeed;

        if (!p.passed && p.x + pipeWidth < chicken.x) {
          p.passed = true;
          score++;
          document.getElementById('current-score').innerText = score;
          if (typeof playSound === 'function') {
            playSound(880, 0.08, 'sine');
          }
        }

        if (p.x < -pipeWidth - 10) {
          pipes.splice(i, 1);
        }

        // Test de collision ajusté au petit poulet
        const capOverflow = 3;
        const chickenBox = {
          left: chicken.x - 8,
          right: chicken.x + 8,
          top: chicken.y - 8,
          bottom: chicken.y + 8
        };

        if (chickenBox.right > p.x - capOverflow && chickenBox.left < p.x + pipeWidth + capOverflow) {
          if (chickenBox.top < p.topHeight || chickenBox.bottom > p.bottomY) {
            gameOver();
          }
        }
      }

      if (chicken.y + chicken.radius >= H - 35 || chicken.y - chicken.radius <= 0) {
        gameOver();
      }
    }

    drawBackground();
    pipes.forEach(drawPipe);
    drawChicken();

    if (!gameStarted && !isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(W / 2 - 160, H / 2 - 30, 320, 55);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 15px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TOUCHEZ OU APPUYEZ SUR ESPACE', W / 2, H / 2 - 5);
      ctx.fillStyle = '#ffe600';
      ctx.fillText('POUR FAIRE VOLER LE POULET', W / 2, H / 2 + 15);
    }

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

  if (window.GameMobile) GameMobile.start('flappy');
  update();
}