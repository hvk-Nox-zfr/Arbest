/*
 * SNAKE DOG — Édition Propre (Grille synchronisée et design soigné)
 * Remplacement direct de l'ancien snake.js.
 */
function startSnakeGame() {
  if (window.__snakeDogCleanup) window.__snakeDogCleanup();
  if (window.GameMobile) GameMobile.reset();

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  
  // NOUVELLES BASES : Grille fixe pour garantir les proportions
  const cols = 15;
  const rows = 12;
  const cw = W / cols;
  const ch = H / rows;
  const cell = Math.min(cw, ch);
  
  // L'aire de jeu commence après le ciel (à la ligne 4)
  const minPlayY = 4; 
  const horizon = minPlayY * ch;

  let score = 0;
  let pulse = 0;
  let gameStarted = false;
  let gameEnded = false;
  let dx = 1, dy = 0;
  let lastTime = 0;
  let stepDelay = 145;
  let raf = 0;
  let prevSnake = [];
  let cloudDrift = 0;

  // Position de départ
  const startX = Math.floor(cols / 2);
  const startY = Math.floor((rows + minPlayY) / 2);
  let snake = Array.from({ length: 5 }, (_, i) => ({ x: startX - i, y: startY }));

  function randFood() {
    let p;
    do {
      p = { x: Math.floor(Math.random() * cols), y: minPlayY + Math.floor(Math.random() * (rows - minPlayY)) };
    } while (snake.some(s => s.x === p.x && s.y === p.y));
    return p;
  }
  let food = randFood();

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function setDirection(x, y) {
    if (gameEnded) return;
    if (x === -dx && y === -dy) return;
    if (gameStarted && x !== 0 && dx !== 0) return;
    if (gameStarted && y !== 0 && dy !== 0) return;
    dx = x; dy = y;
    gameStarted = true;
  }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    const keys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '];
    if (keys.includes(k)) e.preventDefault();
    if (k === 'arrowup' || k === 'w') setDirection(0, -1);
    else if (k === 'arrowdown' || k === 's') setDirection(0, 1);
    else if (k === 'arrowleft' || k === 'a') setDirection(-1, 0);
    else if (k === 'arrowright' || k === 'd' || k === ' ') setDirection(1, 0);
  }
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.__snakeDogCleanup = () => {
    window.removeEventListener('keydown', onKeyDown);
    if (raf) cancelAnimationFrame(raf);
    if (typeof currentGameLoop !== 'undefined' && currentGameLoop) cancelAnimationFrame(currentGameLoop);
  };

  function drawBackground() {
    // Ciel
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#00aeff');
    sky.addColorStop(1, '#8be2ff');
    ctx.fillStyle = sky; 
    ctx.fillRect(0, 0, W, horizon);

    // Nuages simplifiés
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * W / 3 + cloudDrift) % (W + 100)) - 50;
      const cy = (i % 2 === 0) ? ch : ch * 1.5;
      const cr = ch * 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.arc(cx - cr * 0.8, cy + cr * 0.3, cr * 0.7, 0, Math.PI * 2);
      ctx.arc(cx + cr * 0.8, cy + cr * 0.3, cr * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ligne d'horizon (collines douces)
    ctx.fillStyle = '#63d548';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, horizon - Math.abs(Math.sin(x * 0.05)) * 10);
    }
    ctx.lineTo(W, horizon);
    ctx.fill();

    // NOUVEAU DAMIER : Strictement aligné sur la grille (cols x rows)
    for (let r = minPlayY; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Alternance parfaite des couleurs
        ctx.fillStyle = (r + c) % 2 === 0 ? '#8ce52e' : '#77cc20';
        // Ajout de 0.5 pour combler les micro-lignes entre les cases
        ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
      }
    }
  }

  function drawApple(gx, gy) {
    const x = gx * cw + cw / 2;
    const y = gy * ch + ch / 2;
    const r = cell * 0.4;
    const bounce = Math.sin(pulse * 4) * 2;

    ctx.save();
    ctx.translate(x, y - bounce);
    
    // Ombre sous la pomme
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 4 + bounce;

    // Corps de la pomme
    const red = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    red.addColorStop(0, '#ff6a5c');
    red.addColorStop(0.7, '#e60000');
    red.addColorStop(1, '#9b0000');
    
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = 'transparent'; // stop shadow
    
    // Tige
    ctx.strokeStyle = '#4a2411';
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.quadraticCurveTo(r * 0.2, -r * 1.5, r * 0.4, -r * 1.5);
    ctx.stroke();

    // Feuille
    ctx.fillStyle = '#5bd929';
    ctx.beginPath();
    ctx.ellipse(r * 0.6, -r * 1.2, r * 0.4, r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Reflet brillant
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.2, r * 0.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  function drawBody(timestamp) {
    const t = gameStarted && !gameEnded ? clamp((timestamp - lastTime) / stepDelay, 0, 1) : 1;
    const positions = snake.map((s, i) => {
      const p = prevSnake[i] || s;
      return { 
        x: lerp(p.x, s.x, t) * cw + cw / 2, 
        y: lerp(p.y, s.y, t) * ch + ch / 2 
      };
    });

    const rad = cell * 0.45; // Taille parfaitement proportionnelle à la case

    // Dessin du corps (de la queue vers la tête)
    for (let i = positions.length - 1; i >= 1; i--) {
      const p = positions[i];
      const cream = i % 2 !== 0;
      
      ctx.save();
      const grad = ctx.createRadialGradient(p.x - rad * 0.2, p.y - rad * 0.2, 0, p.x, p.y, rad);
      if (cream) {
        grad.addColorStop(0, '#fff6de'); grad.addColorStop(1, '#d19752');
      } else {
        grad.addColorStop(0, '#ffad42'); grad.addColorStop(1, '#a6440f');
      }
      
      ctx.fillStyle = grad;
      // Contour fin et subtil, pas de lignes noires épaisses
      ctx.strokeStyle = 'rgba(100, 40, 10, 0.3)';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Tête
    const head = positions[0];
    let angle = 0;
    if (dx === -1) angle = Math.PI;
    else if (dy === -1) angle = -Math.PI / 2;
    else if (dy === 1) angle = Math.PI / 2;

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);

    // Forme de la tête (un peu plus ovale)
    ctx.fillStyle = '#de721c';
    ctx.beginPath();
    ctx.ellipse(0, 0, rad * 1.2, rad * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Museau
    ctx.fillStyle = '#fff6de';
    ctx.beginPath();
    ctx.ellipse(rad * 0.5, 0, rad * 0.8, rad * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Oreilles
    ctx.fillStyle = '#7a3308';
    ctx.beginPath(); ctx.ellipse(-rad * 0.3, rad * 0.6, rad * 0.6, rad * 0.3, 0.5, 0, Math.PI * 2); ctx.fill(); // Droite
    ctx.beginPath(); ctx.ellipse(-rad * 0.3, -rad * 0.6, rad * 0.6, rad * 0.3, -0.5, 0, Math.PI * 2); ctx.fill(); // Gauche

    // Truffe
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(rad * 1.2, 0, rad * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Yeux
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(rad * 0.2, -rad * 0.35, rad * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rad * 0.2, rad * 0.35, rad * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(rad * 0.25, -rad * 0.35, rad * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rad * 0.25, rad * 0.35, rad * 0.12, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    // Le HUD se place dans la zone "ciel" pour ne pas gêner le jeu
    const x = 20, y = 15, ww = 120, hh = 40;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    roundRect(x, y, ww, hh, 20); 
    ctx.fill();
    
    ctx.fillStyle = '#c75604'; 
    ctx.font = `bold 20px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'middle';
    ctx.fillText('🍎  ' + score, x + 15, y + hh / 2 + 2);
    ctx.restore();
  }

  function drawStartHint() {
    if (gameStarted) return;
    ctx.save();
    const txt = window.GameMobile && GameMobile.isTouch ? 'GLISSE POUR JOUER' : 'UTILISE LES FLÈCHES';
    ctx.font = `bold 18px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
    const w = ctx.measureText(txt).width + 60;
    const x = (W - w) / 2;
    const y = H - 60;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    roundRect(x, y, w, 40, 20);
    ctx.fill();
    
    ctx.fillStyle = '#c75604'; 
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, W / 2, y + 20);
    ctx.restore();
  }

  function step() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    const willEat = head.x === food.x && head.y === food.y;
    const body = willEat ? snake : snake.slice(0, -1);
    
    // Vérification des collisions (attention au minPlayY pour la bordure haute)
    if (head.x < 0 || head.x >= cols || head.y < minPlayY || head.y >= rows || body.some(s => s.x === head.x && s.y === head.y)) {
      gameEnded = true;
      if (typeof triggerGameOver === 'function') triggerGameOver(score);
      return false;
    }
    
    prevSnake = [snake[0], ...snake.slice(1)].map(s => ({ x: s.x, y: s.y }));
    snake.unshift(head);
    
    if (willEat) {
      score += 10;
      const scoreEl = document.getElementById('current-score');
      if (scoreEl) scoreEl.innerText = score;
      if (typeof playSound === 'function') playSound(660, .1);
      food = randFood();
      stepDelay = Math.max(88, 145 - Math.floor(score / 50) * 5);
    } else {
      snake.pop();
    }
    return true;
  }

  function gameLoop(timestamp) {
    if (gameStarted && !gameEnded && timestamp - lastTime >= stepDelay) {
      lastTime = timestamp;
      if (!step()) return;
    }
    pulse += 0.05;
    cloudDrift += 0.2;
    drawBackground();
    drawApple(food.x, food.y);
    drawBody(timestamp);
    drawHUD();
    drawStartHint();
    raf = requestAnimationFrame(gameLoop);
    currentGameLoop = raf;
  }

  const scoreEl = document.getElementById('current-score');
  if (scoreEl) scoreEl.innerText = '0';
  if (window.GameMobile) GameMobile.start('snake', { swipe: true, left: { dpad: true } });
  raf = requestAnimationFrame(gameLoop);
  currentGameLoop = raf;
}