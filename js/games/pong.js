function startPongGame() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // Dimensions & Raquettes
  let paddleHeight = 85;
  let paddleWidth = 12;
  let playerY = canvas.height / 2 - paddleHeight / 2;
  let playerVy = 0;
  let lastPlayerY = playerY;

  let aiY = canvas.height / 2 - paddleHeight / 2;
  let aiSpeed = 5.5;

  // Balle
  let ballX = canvas.width / 2;
  let ballY = canvas.height / 2;
  let ballSpeedX = 6.5;
  let ballSpeedY = (Math.random() - 0.5) * 6;
  let ballRadius = 8;
  let ballTrail = [];

  // Power-Ups
  let powerUp = null; // { x, y, type: 'BIG_PADDLE' | 'FAST_BALL' | 'EXTRA_POINTS' }
  let powerUpTimer = 0;

  // Scores & Particules
  let score = 0;
  let aiScore = 0;
  let particles = [];
  let shakeFrames = 0;

  // Contrôle à la souris / pavé tactile
  window.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const targetY = e.clientY - rect.top - paddleHeight / 2;
    playerVy = targetY - playerY;
    playerY = Math.max(10, Math.min(canvas.height - paddleHeight - 10, targetY));
  };

  // Effet de particule
  function addSparks(x, y, color) {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color: color
      });
    }
  }

  // Fait réapparaître un Power-Up aléatoire
  function spawnPowerUp() {
    const types = ['BIG_PADDLE', 'FAST_BALL', 'EXTRA_POINTS'];
    powerUp = {
      x: canvas.width / 4 + Math.random() * (canvas.width / 2),
      y: 50 + Math.random() * (canvas.height - 100),
      type: types[Math.floor(Math.random() * types.length)],
      radius: 12
    };
  }

  function resetBall(winner) {
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballSpeedX = (winner === 'player' ? -1 : 1) * 6.5;
    ballSpeedY = (Math.random() - 0.5) * 6;
    ballTrail = [];
  }

  function update() {
    // Gestion des secousses d'écran (Screen Shake)
    ctx.save();
    if (shakeFrames > 0) {
      shakeFrames--;
      const rx = (Math.random() - 0.5) * 6;
      const ry = (Math.random() - 0.5) * 6;
      ctx.translate(rx, ry);
    }

    // Fond néon
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ligne centrale néon
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- DEPLACEMENT DE LA BALLE ---
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Enregistrement de la traînée
    ballTrail.push({ x: ballX, y: ballY });
    if (ballTrail.length > 12) ballTrail.shift();

    // Rebond Haut / Bas
    if (ballY - ballRadius <= 0 || ballY + ballRadius >= canvas.height) {
      ballSpeedY = -ballSpeedY;
      addSparks(ballX, ballY, '#ffe600');
      playSound(300, 0.04);
    }

    // --- IA ADAPTATIVE & PRÉDICTIVE ---
    // Calcul de la position future de la balle
    let predictedY = ballY;
    if (ballSpeedX > 0) {
      let timeToImpact = (canvas.width - 20 - ballX) / ballSpeedX;
      predictedY = ballY + ballSpeedY * timeToImpact;
      // Prise en compte du rebond estimé
      if (predictedY < 0) predictedY = Math.abs(predictedY);
      if (predictedY > canvas.height) predictedY = canvas.height - (predictedY - canvas.height);
    } else {
      predictedY = canvas.height / 2; // Revient au centre si la balle s'éloigne
    }

    // Suivi IA fluide
    const aiCenter = aiY + paddleHeight / 2;
    if (aiCenter < predictedY - 12) {
      aiY += aiSpeed;
    } else if (aiCenter > predictedY + 12) {
      aiY -= aiSpeed;
    }
    aiY = Math.max(10, Math.min(canvas.height - paddleHeight - 10, aiY));

    // --- COLLISION JOUEUR (GAUCHE) ---
    if (
      ballX - ballRadius <= paddleWidth + 15 &&
      ballY >= playerY - 5 &&
      ballY <= playerY + paddleHeight + 5 &&
      ballSpeedX < 0
    ) {
      ballSpeedX = Math.abs(ballSpeedX) * 1.06; // Accélération
      // Imprimer un effet selon le mouvement de la raquette (Spin)
      ballSpeedY += playerVy * 0.25;

      addSparks(ballX, ballY, '#00f3ff');
      shakeFrames = 4;
      playSound(550, 0.08);
    }

    // --- COLLISION IA (DROITE) ---
    if (
      ballX + ballRadius >= canvas.width - paddleWidth - 15 &&
      ballY >= aiY - 5 &&
      ballY <= aiY + paddleHeight + 5 &&
      ballSpeedX > 0
    ) {
      ballSpeedX = -Math.abs(ballSpeedX) * 1.06;
      addSparks(ballX, ballY, '#ff0055');
      shakeFrames = 4;
      playSound(450, 0.08);
    }

    // --- GESTION POWER-UP ---
    powerUpTimer++;
    if (powerUpTimer > 400 && !powerUp) {
      spawnPowerUp();
      powerUpTimer = 0;
    }

    if (powerUp) {
      // Dessin du Power-Up
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00ff88';
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(powerUp.x, powerUp.y, powerUp.radius, 0, Math.PI * 2);
      ctx.fill();

      // Hitbox Power-Up avec la balle
      if (Math.hypot(ballX - powerUp.x, ballY - powerUp.y) < ballRadius + powerUp.radius) {
        if (powerUp.type === 'BIG_PADDLE') {
          paddleHeight = 120;
          setTimeout(() => paddleHeight = 85, 8000);
        } else if (powerUp.type === 'FAST_BALL') {
          ballSpeedX *= 1.4;
        } else if (powerUp.type === 'EXTRA_POINTS') {
          score += 3;
          document.getElementById('current-score').innerText = score;
        }
        addSparks(powerUp.x, powerUp.y, '#00ff88');
        playSound(800, 0.1);
        powerUp = null;
      }
    }

    // --- MARQUER UN POINT ---
    if (ballX < 0) { // L'IA marque
      aiScore++;
      shakeFrames = 10;
      addSparks(0, ballY, '#ff0055');
      playSound(200, 0.2);
      if (aiScore >= 5) {
        triggerGameOver(score);
        ctx.restore();
        return;
      }
      resetBall('ai');
    } else if (ballX > canvas.width) { // Le joueur marque
      score += 1;
      document.getElementById('current-score').innerText = score;
      shakeFrames = 10;
      addSparks(canvas.width, ballY, '#00f3ff');
      playSound(750, 0.2);
      resetBall('player');
    }

    // --- TRAÎNÉE DE LA BALLE ---
    ballTrail.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, (i / ballTrail.length) * (ballRadius - 1), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 230, 0, ${ (i / ballTrail.length) * 0.5 })`;
      ctx.fill();
    });

    // --- BALLE PRINCIPALE ---
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffe600';
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();

    // --- RAQUETTE JOUEUR (Bleu Cyan) ---
    ctx.shadowColor = '#00f3ff';
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.roundRect(10, playerY, paddleWidth, paddleHeight, 6);
    ctx.fill();

    // --- RAQUETTE IA (Rose Néon) ---
    ctx.shadowColor = '#ff0055';
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.roundRect(canvas.width - paddleWidth - 10, aiY, paddleWidth, paddleHeight, 6);
    ctx.fill();

    // --- PARTICULES & EXPLOSIONS ---
    particles.forEach((p, pIdx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;

      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1.0;

      if (p.life <= 0) particles.splice(pIdx, 1);
    });

    ctx.shadowBlur = 0;
    ctx.restore();

    currentGameLoop = requestAnimationFrame(update);
  }

  currentGameLoop = requestAnimationFrame(update);
}