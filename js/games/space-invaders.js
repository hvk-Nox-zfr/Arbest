function startSpaceGame() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  let playerX = canvas.width / 2;
  let playerBullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let score = 0;
  let frameCount = 0;

  // Tir continu (maintien du clic)
  let isMouseDown = false;
  let shootCooldown = 0;
  const SHOOT_INTERVAL = 10; // Tir tous les 10 frames (~6 tirs par seconde)

  // Système de Vagues & Difficulté
  let currentWave = 1;
  let waveBannerFrames = 120; // Affichage du titre de la vague
  let spawnProtectionFrames = 180; // Protection initiale

  function spawnWave(waveNumber) {
    enemies = [];
    const cols = 6;
    const rows = 3;

    // Plus de bombardiers lourds au fil des vagues
    const heavyRows = Math.min(2, Math.floor((waveNumber - 1) / 2) + 1);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const isHeavy = j < heavyRows;
        enemies.push({
          baseX: 70 + i * 90,
          baseY: 40 + j * 40,
          x: 70 + i * 90,
          y: 40 + j * 40,
          type: isHeavy ? 'heavy' : 'scout',
          hp: isHeavy ? (2 + Math.floor(waveNumber / 3)) : 1, // Points de vie accrus pour les gros vaisseaux
          alive: true,
          // Accélération de la vitesse d'oscillation en fonction de la vague
          floatSpeed: (0.02 + Math.random() * 0.015) * (1 + (waveNumber - 1) * 0.15),
          floatRadiusX: 12 + Math.random() * 10,
          floatRadiusY: 6 + Math.random() * 8,
          phaseOffset: Math.random() * Math.PI * 2,
          isDiving: false,
          diveSpeedY: 0
        });
      }
    }

    waveBannerFrames = 120;
    spawnProtectionFrames = 120;
  }

  // Initialisation de la première vague
  spawnWave(currentWave);

  // Contrôle de position à la souris
  window.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    playerX = Math.max(25, Math.min(canvas.width - 25, e.clientX - rect.left));
  };

  // Gestion du tir continu (Clic enfoncé / relâché)
  window.onmousedown = () => {
    isMouseDown = true;
  };

  window.onmouseup = () => {
    isMouseDown = false;
  };

  // Fonction pour faire tirer le joueur
  function fireBullet() {
    playerBullets.push({ x: playerX - 12, y: canvas.height - 35 });
    playerBullets.push({ x: playerX + 12, y: canvas.height - 35 });
    playSound(700, 0.05);
  }

  // Effet d'explosion de particules
  function addExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1.0,
        color: color
      });
    }
  }

  function update() {
    frameCount++;
    if (spawnProtectionFrames > 0) spawnProtectionFrames--;
    if (waveBannerFrames > 0) waveBannerFrames--;

    // Tir automatique si la souris est maintenue
    if (isMouseDown) {
      if (shootCooldown <= 0) {
        fireBullet();
        shootCooldown = SHOOT_INTERVAL;
      } else {
        shootCooldown--;
      }
    } else {
      shootCooldown = 0;
    }

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const aliveEnemies = enemies.filter(e => e.alive);

    // Multiplicateurs de difficulté de la vague
    const waveMultiplier = 1 + (currentWave - 1) * 0.25;
    const diveProbability = 0.0006 * waveMultiplier;
    const shootProbability = 0.0015 * waveMultiplier;
    const bulletSpeed = 2.2 * Math.min(2.0, waveMultiplier);

    // --- LOGIQUE ET DEPLACEMENT DES ENNEMIS ---
    aliveEnemies.forEach((e) => {
      if (!e.isDiving) {
        e.x = e.baseX + Math.sin(frameCount * e.floatSpeed + e.phaseOffset) * e.floatRadiusX;
        e.y = e.baseY + Math.cos(frameCount * e.floatSpeed * 0.8 + e.phaseOffset) * e.floatRadiusY;

        // Attaque en plongée
        if (spawnProtectionFrames === 0 && Math.random() < diveProbability) {
          e.isDiving = true;
          e.diveSpeedY = (1.8 + Math.random() * 1) * waveMultiplier;
        }
      } else {
        e.y += e.diveSpeedY;
        e.x += Math.sin(frameCount * 0.08) * 2;

        if (e.y > canvas.height + 30) {
          e.y = -20;
          e.isDiving = false;
        }
      }

      // Tirs ennemis ajustés selon la vague
      if (spawnProtectionFrames === 0 && Math.random() < shootProbability) {
        const dx = playerX - e.x;
        const dy = (canvas.height - 30) - e.y;
        const angle = Math.atan2(dy, dx);

        enemyBullets.push({
          x: e.x,
          y: e.y + 12,
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed
        });
      }

      // Collision directe Ennemi / Joueur
      if (spawnProtectionFrames === 0 && Math.abs(e.x - playerX) < 20 && Math.abs(e.y - (canvas.height - 25)) < 20) {
        addExplosion(playerX, canvas.height - 25, '#00f3ff');
        triggerGameOver(score);
        return;
      }
    });

    // --- VAISSEAU JOUEUR ---
    const isProtected = spawnProtectionFrames > 0;
    
    if (!isProtected || Math.floor(frameCount / 6) % 2 === 0) {
      ctx.shadowBlur = isProtected ? 25 : 15;
      ctx.shadowColor = isProtected ? '#00ff88' : '#00f3ff';
      ctx.fillStyle = isProtected ? '#00ff88' : '#00f3ff';

      ctx.beginPath();
      ctx.moveTo(playerX, canvas.height - 40);
      ctx.lineTo(playerX - 20, canvas.height - 15);
      ctx.lineTo(playerX - 8, canvas.height - 10);
      ctx.lineTo(playerX + 8, canvas.height - 10);
      ctx.lineTo(playerX + 20, canvas.height - 15);
      ctx.closePath();
      ctx.fill();

      // Réacteur néon
      ctx.fillStyle = Math.random() > 0.5 ? '#ff0055' : '#ffe600';
      ctx.fillRect(playerX - 4, canvas.height - 10, 8, 6);
    }

    // --- TIRS DU JOUEUR ---
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00f3ff';
    ctx.fillStyle = '#00f3ff';
    playerBullets.forEach((b, bIdx) => {
      b.y -= 10;
      ctx.fillRect(b.x - 1.5, b.y, 3, 12);

      enemies.forEach(e => {
        if (e.alive && Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 18) {
          e.hp--;
          playerBullets.splice(bIdx, 1);

          if (e.hp <= 0) {
            e.alive = false;
            score += e.type === 'heavy' ? 50 : 20;
            document.getElementById('current-score').innerText = score;
            addExplosion(e.x, e.y, e.type === 'heavy' ? '#ffe600' : '#9d00ff');
            playSound(350);
          } else {
            playSound(200, 0.05);
          }
        }
      });

      if (b.y < -10) playerBullets.splice(bIdx, 1);
    });

    // --- TIRS DES ENNEMIS ---
    ctx.shadowColor = '#ff0055';
    ctx.fillStyle = '#ff0055';
    enemyBullets.forEach((eb, ebIdx) => {
      eb.x += eb.vx;
      eb.y += eb.vy;

      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 3, 0, Math.PI * 2);
      ctx.fill();

      if (spawnProtectionFrames === 0 && Math.abs(eb.x - playerX) < 15 && eb.y >= canvas.height - 35 && eb.y <= canvas.height - 10) {
        addExplosion(playerX, canvas.height - 25, '#ff0055');
        triggerGameOver(score);
        return;
      }

      if (eb.y > canvas.height + 10 || eb.x < -10 || eb.x > canvas.width + 10) {
        enemyBullets.splice(ebIdx, 1);
      }
    });

    // --- RENDU DES ENNEMIS ---
    enemies.forEach(e => {
      if (e.alive) {
        const color = e.type === 'heavy' ? '#ffe600' : '#9d00ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fillStyle = color;

        ctx.beginPath();
        if (e.type === 'heavy') {
          ctx.moveTo(e.x, e.y + 12);
          ctx.lineTo(e.x - 20, e.y - 10);
          ctx.lineTo(e.x + 20, e.y - 10);
        } else {
          ctx.arc(e.x, e.y, 12, Math.PI, 0);
          ctx.lineTo(e.x + 16, e.y + 8);
          ctx.lineTo(e.x - 16, e.y + 8);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(e.x - 2, e.y - 2, 4, 4);
      }
    });

    // --- RENDU DES PARTICULES ---
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

    // --- ANNONCE DE LA VAGUE NÉON ---
    if (waveBannerFrames > 0) {
      ctx.save();
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00f3ff';
      ctx.fillStyle = '#00f3ff';
      ctx.globalAlpha = Math.min(1.0, waveBannerFrames / 30);
      ctx.fillText(`VAGUE ${currentWave}`, canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }

    ctx.shadowBlur = 0;

    // --- PASSAGE À LA VAGUE SUIVANTE ---
    if (enemies.length > 0 && enemies.every(e => !e.alive)) {
      currentWave++;
      score += 100 * currentWave; // Bonus de vague
      document.getElementById('current-score').innerText = score;
      playSound(800, 0.2);
      spawnWave(currentWave);
    }

    currentGameLoop = requestAnimationFrame(update);
  }

  currentGameLoop = requestAnimationFrame(update);
}