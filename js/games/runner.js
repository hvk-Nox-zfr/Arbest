function startRunnerGame() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  let player = { y: canvas.height - 50, vy: 0, isJumping: false };
  let obstacleX = canvas.width;
  let score = 0;
  let gridOffset = 0;

  window.onkeydown = (e) => {
    if ((e.key === ' ' || e.key === 'ArrowUp') && !player.isJumping) {
      player.vy = -13;
      player.isJumping = true;
      playSound(550);
    }
  };

  function update() {
    player.y += player.vy;
    player.vy += 0.7;

    if (player.y >= canvas.height - 50) {
      player.y = canvas.height - 50;
      player.isJumping = false;
    }

    obstacleX -= 7;
    if (obstacleX < -30) {
      obstacleX = canvas.width;
      score += 10;
      document.getElementById('current-score').innerText = score;
    }

    if (obstacleX < 50 && obstacleX > 20 && player.y > canvas.height - 70) {
      triggerGameOver(score);
      return;
    }

    // Défilement du sol
    gridOffset = (gridOffset + 7) % 30;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Lignes de perspective au sol (Style Synthwave/Outrun)
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.3)';
    ctx.lineWidth = 2;
    for (let x = -gridOffset; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - 20);
      ctx.lineTo(x - 20, canvas.height);
      ctx.stroke();
    }

    // Sol Néon principal
    ctx.strokeStyle = '#00f3ff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f3ff';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 20);
    ctx.lineTo(canvas.width, canvas.height - 20);
    ctx.stroke();

    // Joueur Cyber
    ctx.shadowColor = '#00f3ff';
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.roundRect(30, player.y, 22, 30, 4);
    ctx.fill();

    // Obstacle Laser
    ctx.shadowColor = '#ff0055';
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.moveTo(obstacleX, canvas.height - 20);
    ctx.lineTo(obstacleX + 12, canvas.height - 55);
    ctx.lineTo(obstacleX + 24, canvas.height - 20);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    currentGameLoop = requestAnimationFrame(update);
  }

  currentGameLoop = requestAnimationFrame(update);
}