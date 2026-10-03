function startSnakeGame() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 20;
  const tileCount = canvas.width / gridSize;

  let snake = [{ x: 10, y: 10 }];
  let dx = 0, dy = 0; // Immobile au départ
  let gameStarted = false;
  let food = { x: 15, y: 15 };
  let score = 0;
  let pulse = 0;

  window.onkeydown = (e) => {
    if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -1; gameStarted = true; }
    if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = 1; gameStarted = true; }
    if (e.key === 'ArrowLeft' && dx === 0) { dx = -1; dy = 0; gameStarted = true; }
    if (e.key === 'ArrowRight' && dx === 0) { dx = 1; dy = 0; gameStarted = true; }
  };

  let lastTime = 0;
  function gameStep(timestamp) {
    // Vitesse ralentie : mise à jour toutes les 130 ms au lieu de 80 ms
    if (gameStarted && timestamp - lastTime > 130) {
      lastTime = timestamp;
      const head = { x: snake[0].x + dx, y: snake[0].y + dy };

      // Collisions Murs & Serpent
      if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= canvas.height / gridSize ||
          snake.some(s => s.x === head.x && s.y === head.y)) {
        triggerGameOver(score);
        return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('current-score').innerText = score;
        playSound(600, 0.1);
        food = {
          x: Math.floor(Math.random() * tileCount),
          y: Math.floor(Math.random() * (canvas.height / gridSize))
        };
      } else {
        snake.pop();
      }
    }

    // Animation & Rendu
    pulse += 0.05;
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grille Laser
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Nourriture
    const foodRadius = (gridSize / 2 - 2) + Math.sin(pulse * 3) * 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0055';
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, foodRadius, 0, Math.PI * 2);
    ctx.fill();

    // Serpent
    snake.forEach((segment, idx) => {
      const isHead = idx === 0;
      const alpha = 1 - (idx / snake.length) * 0.5;
      ctx.shadowBlur = isHead ? 20 : 10;
      ctx.shadowColor = isHead ? '#00f3ff' : '#9d00ff';
      ctx.fillStyle = isHead ? '#ffffff' : `rgba(0, 243, 255, ${alpha})`;

      const px = segment.x * gridSize + 2;
      const py = segment.y * gridSize + 2;
      const size = gridSize - 4;

      ctx.beginPath();
      ctx.roundRect(px, py, size, size, isHead ? 6 : 3);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Message d'attente au lancement
    if (!gameStarted) {
      ctx.font = '12px "Press Start 2P"';
      ctx.fillStyle = '#00f3ff';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f3ff';
      ctx.fillText('APPUYEZ SUR UNE FLÈCHE POUR JOUER', canvas.width / 2, canvas.height / 2 + 60);
      ctx.shadowBlur = 0;
    }

    currentGameLoop = requestAnimationFrame(gameStep);
  }

  currentGameLoop = requestAnimationFrame(gameStep);
}