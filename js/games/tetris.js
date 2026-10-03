function startTetrisGame() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = canvas.height / ROWS;

  // Décalage du plateau pour laisser de la place au panneau latéral (HUD "Suivant / Stats")
  const BOARD_X = 40; 
  const SIDEBAR_X = BOARD_X + COLS * BLOCK_SIZE + 30;

  // Matrice du plateau (0 = vide, couleur = bloc fixe)
  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  let score = 0;
  let linesCleared = 0;
  let level = 1;
  let dropCounter = 0;
  let dropInterval = 600; // ms entre chaque descente
  let lastTime = 0;

  // Définition des 7 Tetrominos originaux
  const TETROMINOS = {
    I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00f3ff' }, // Cyan
    J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#0055ff' },                 // Bleu
    L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#ffaa00' },                 // Orange
    O: { shape: [[1,1],[1,1]], color: '#ffe600' },                             // Jaune
    S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#00ff66' },                 // Vert
    T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#9d00ff' },                 // Violet
    Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#ff0055' }                  // Rouge
  };

  const PIECE_KEYS = Object.keys(TETROMINOS);

  function getRandomPiece() {
    const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
    const proto = TETROMINOS[key];
    return {
      shape: proto.shape.map(row => [...row]),
      color: proto.color,
      x: Math.floor((COLS - proto.shape[0].length) / 2),
      y: 0
    };
  }

  let currentPiece = getRandomPiece();
  let nextPiece = getRandomPiece();

  // Rotation de matrice 90°
  function rotateMatrix(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  // Vérification de collision
  function collide(piece, offsetX = 0, offsetY = 0, customShape = null) {
    const shape = customShape || piece.shape;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const newX = piece.x + c + offsetX;
          const newY = piece.y + r + offsetY;

          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && grid[newY][newX] !== 0) return true;
        }
      }
    }
    return false;
  }

  // Fusionner la pièce gelée dans la grille
  function lockPiece() {
    const shape = currentPiece.shape;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const py = currentPiece.y + r;
          const px = currentPiece.x + c;
          if (py < 0) {
            triggerGameOver(score);
            return;
          }
          grid[py][px] = currentPiece.color;
        }
      }
    }

    clearLines();

    // Passer à la pièce suivante
    currentPiece = nextPiece;
    nextPiece = getRandomPiece();

    if (collide(currentPiece)) {
      triggerGameOver(score);
    }
  }

  // Nettoyage des lignes pleines
  function clearLines() {
    let linesFound = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(cell => cell !== 0)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(0));
        linesFound++;
        r++; // Re-tester la même ligne après décalage
      }
    }

    if (linesFound > 0) {
      playSound(650, 0.15);
      const points = [0, 100, 300, 500, 800];
      score += (points[linesFound] || 1000) * level;
      linesCleared += linesFound;
      level = Math.floor(linesCleared / 10) + 1;
      dropInterval = Math.max(100, 600 - (level - 1) * 50);

      document.getElementById('current-score').innerText = score;
    }
  }

  // Contrôles Clavier
  window.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') {
      if (!collide(currentPiece, -1, 0)) currentPiece.x--;
    } else if (e.key === 'ArrowRight') {
      if (!collide(currentPiece, 1, 0)) currentPiece.x++;
    } else if (e.key === 'ArrowDown') {
      if (!collide(currentPiece, 0, 1)) {
        currentPiece.y++;
        score += 1;
        document.getElementById('current-score').innerText = score;
      }
    } else if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') {
      const rotated = rotateMatrix(currentPiece.shape);
      if (!collide(currentPiece, 0, 0, rotated)) {
        currentPiece.shape = rotated;
        playSound(400, 0.03);
      }
    } else if (e.key === ' ') { // Hard Drop
      while (!collide(currentPiece, 0, 1)) {
        currentPiece.y++;
        score += 2;
      }
      document.getElementById('current-score').innerText = score;
      playSound(500, 0.08);
      lockPiece();
    }
  };

  // Rendu graphique de bloc
  function drawBlock(x, y, color, isGhost = false) {
    ctx.shadowBlur = isGhost ? 0 : 10;
    ctx.shadowColor = color;

    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

      // Reflet interne
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x + 3, y + 3, BLOCK_SIZE - 6, 3);
    }
    ctx.shadowBlur = 0;
  }

  function gameLoop(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
      if (!collide(currentPiece, 0, 1)) {
        currentPiece.y++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }

    // Effacer le canvas
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- FOND & GRILLE DU PLATEAU ---
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(BOARD_X, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, r * BLOCK_SIZE);
      ctx.lineTo(BOARD_X + COLS * BLOCK_SIZE, r * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * BLOCK_SIZE, 0);
      ctx.lineTo(BOARD_X + c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.stroke();
    }

    // Bordure lumineuse du plateau
    ctx.strokeStyle = '#00f3ff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00f3ff';
    ctx.strokeRect(BOARD_X, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    ctx.shadowBlur = 0;

    // --- RENDU DE LA GRILLE DE JEU (BLOCS FIXES) ---
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== 0) {
          drawBlock(BOARD_X + c * BLOCK_SIZE, r * BLOCK_SIZE, grid[r][c]);
        }
      }
    }

    // --- GHOST PIECE (Projection en bas) ---
    let ghostY = currentPiece.y;
    while (!collide(currentPiece, 0, ghostY - currentPiece.y + 1)) {
      ghostY++;
    }
    currentPiece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val !== 0) {
          drawBlock(
            BOARD_X + (currentPiece.x + c) * BLOCK_SIZE,
            (ghostY + r) * BLOCK_SIZE,
            currentPiece.color,
            true
          );
        }
      });
    });

    // --- RENDU DE LA PIÈCE EN COURS ---
    currentPiece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val !== 0) {
          drawBlock(
            BOARD_X + (currentPiece.x + c) * BLOCK_SIZE,
            (currentPiece.y + r) * BLOCK_SIZE,
            currentPiece.color
          );
        }
      });
    });

    // --- INTERFACE LATÉRALE (HUD) ---
    // Cadre Pièce Suivante
    ctx.strokeStyle = '#9d00ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#9d00ff';
    ctx.strokeRect(SIDEBAR_X, 20, 160, 120);

    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = '#9d00ff';
    ctx.fillText('SUIVANT', SIDEBAR_X + 15, 42);

    // Dessin de la pièce suivante
    nextPiece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val !== 0) {
          const px = SIDEBAR_X + 45 + c * (BLOCK_SIZE * 0.8);
          const py = 60 + r * (BLOCK_SIZE * 0.8);
          ctx.fillStyle = nextPiece.color;
          ctx.fillRect(px, py, BLOCK_SIZE * 0.8 - 2, BLOCK_SIZE * 0.8 - 2);
        }
      });
    });

    // Cadre Statistiques (Niveau & Lignes)
    ctx.strokeStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.strokeRect(SIDEBAR_X, 160, 160, 180);

    ctx.fillStyle = '#ff0055';
    ctx.fillText('NIVEAU', SIDEBAR_X + 15, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Press Start 2P"';
    ctx.fillText(level.toString(), SIDEBAR_X + 15, 220);

    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = '#ff0055';
    ctx.fillText('LIGNES', SIDEBAR_X + 15, 260);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Press Start 2P"';
    ctx.fillText(linesCleared.toString(), SIDEBAR_X + 15, 290);

    ctx.shadowBlur = 0;

    currentGameLoop = requestAnimationFrame(gameLoop);
  }

  currentGameLoop = requestAnimationFrame(gameLoop);
}