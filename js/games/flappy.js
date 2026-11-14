function startFlappyGame() {
  if (window.GameMobile) GameMobile.reset();
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const groundY = H - 35;
  const scale = Math.max(0.72, Math.min(1.35, H / 500));

  let score = 0;
  let isGameOver = false;
  let gameStarted = false;
  let frameCount = 0;

  const chicken = {
    x: Math.max(78, W * 0.19),
    y: H / 2,
    radius: 24 * scale,
    vy: 0,
    gravity: 0.34 * scale,
    jump: -6.1 * scale,
    rotation: 0,
    wingPhase: 0,
    wingKick: 0
  };

  const pipes = [];
  const pipeWidth = 62 * scale;
  const pipeGap = Math.max(145 * scale, H * 0.31);
  const pipeSpeed = 2.35 * scale;

  function createPipe() {
    const minHeight = 48 * scale;
    const maxHeight = Math.max(minHeight + 10, groundY - pipeGap - minHeight - 20 * scale);
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    pipes.push({ x: W + 10, topHeight, bottomY: topHeight + pipeGap, passed: false });
  }

  // Un premier obstacle est visible dès l'écran d'accueil.
  // Il devient le premier obstacle jouable dès que la partie commence.
  pipes.push({
    x: W * 0.64,
    topHeight: H * 0.27,
    bottomY: H * 0.27 + pipeGap,
    passed: false
  });

  function jump() {
    if (isGameOver) return;
    if (!gameStarted) gameStarted = true;
    chicken.vy = chicken.jump;
    chicken.wingKick = 1;
    if (typeof playSound === 'function') playSound(580, 0.05, 'square');
  }

  function handleInput(e) {
    if (e.type === 'keydown') {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      if (e.repeat) return;
      e.preventDefault();
      jump();
    } else if (e.type === 'pointerdown') {
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

  function roundedRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCloud(x, y, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.beginPath();
    ctx.arc(x, y, 13*s, Math.PI, 0);
    ctx.arc(x + 13*s, y - 8*s, 17*s, Math.PI, 0);
    ctx.arc(x + 31*s, y - 2*s, 12*s, Math.PI, 0);
    ctx.lineTo(x + 43*s, y + 10*s);
    ctx.lineTo(x - 1*s, y + 10*s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(190,239,255,.65)';
    ctx.fillRect(x + 5*s, y + 5*s, 30*s, 3*s);
    ctx.restore();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0797f7');
    sky.addColorStop(.58, '#45d5ff');
    sky.addColorStop(1, '#b9f4ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Lumière douce derrière le décor
    const glow = ctx.createRadialGradient(W*.52, H*.43, 8, W*.52, H*.43, W*.62);
    glow.addColorStop(0, 'rgba(255,255,255,.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const cloudOffset = (frameCount * .32 * scale) % (W + 120*scale);
    drawCloud((W*.08 - cloudOffset + W + 120*scale) % (W + 120*scale) - 40*scale, H*.18, .85*scale);
    drawCloud((W*.55 - cloudOffset*.72 + W + 120*scale) % (W + 120*scale) - 30*scale, H*.57, .7*scale);
    drawCloud((W*.83 - cloudOffset*.5 + W + 120*scale) % (W + 120*scale) - 30*scale, H*.12, .55*scale);

    // Ville lointaine en silhouettes pixelisées
    const cityOffset = (frameCount * .22 * scale) % (48*scale);
    for (let i = -2; i < Math.ceil(W/(42*scale))+3; i++) {
      const x = i*42*scale - cityOffset;
      const bh = (38 + ((i*17 % 5 + 5) % 5)*13) * scale;
      ctx.fillStyle = i % 2 ? 'rgba(35,139,220,.25)' : 'rgba(30,117,205,.20)';
      ctx.fillRect(x, groundY - 18*scale - bh, 34*scale, bh);
      ctx.fillStyle = 'rgba(180,239,255,.25)';
      for (let wy = groundY - 12*scale - bh; wy < groundY - 22*scale; wy += 14*scale) {
        ctx.fillRect(x + 7*scale, wy, 4*scale, 5*scale);
        ctx.fillRect(x + 21*scale, wy, 4*scale, 5*scale);
      }
    }

    // Collines et buissons
    ctx.fillStyle = '#48c96c';
    ctx.beginPath();
    ctx.moveTo(0, groundY-20*scale);
    for (let x=0; x<=W+40; x+=40*scale) ctx.quadraticCurveTo(x+20*scale, groundY-54*scale, x+40*scale, groundY-20*scale);
    ctx.lineTo(W, groundY+5*scale); ctx.lineTo(0, groundY+5*scale); ctx.fill();

    // Sol : herbe vive et terre en pixels
    ctx.fillStyle = '#70df35';
    ctx.fillRect(0, groundY-10*scale, W, 12*scale);
    ctx.fillStyle = '#b6ff55';
    ctx.fillRect(0, groundY-10*scale, W, 4*scale);
    ctx.fillStyle = '#8b542b';
    ctx.fillRect(0, groundY+2*scale, W, H-groundY);
    ctx.fillStyle = '#5c351e';
    const soilOffset = (frameCount*pipeSpeed)%(24*scale);
    for (let x=-24*scale; x<W+24*scale; x+=24*scale) {
      ctx.fillRect(x-soilOffset, groundY+9*scale, 13*scale, 7*scale);
      ctx.fillRect(x-soilOffset+9*scale, groundY+23*scale, 11*scale, 6*scale);
    }
    ctx.fillStyle = '#4b9e27';
    for (let x=-10*scale; x<W+20*scale; x+=18*scale) {
      const xx = x - soilOffset*.55;
      ctx.fillRect(xx, groundY-2*scale, 7*scale, 4*scale);
    }
  }

  function drawPipe(p) {
    const capH = 23*scale;
    const over = 5*scale;
    const x = p.x;
    const bodyGrad = ctx.createLinearGradient(x, 0, x+pipeWidth, 0);
    bodyGrad.addColorStop(0, '#079d27');
    bodyGrad.addColorStop(.22, '#25d52e');
    bodyGrad.addColorStop(.58, '#73f32c');
    bodyGrad.addColorStop(.82, '#29c92b');
    bodyGrad.addColorStop(1, '#087b22');

    function section(y, h, cap=false) {
      if (h <= 0) return;
      const xx = cap ? x-over : x;
      const ww = cap ? pipeWidth+over*2 : pipeWidth;
      const grad = ctx.createLinearGradient(xx, 0, xx+ww, 0);
      grad.addColorStop(0, '#078d25');
      grad.addColorStop(.18, '#27d72e');
      grad.addColorStop(.52, '#83f83c');
      grad.addColorStop(.78, '#32d52d');
      grad.addColorStop(1, '#087b22');
      ctx.fillStyle = grad;
      ctx.fillRect(xx, y, ww, h);
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillRect(xx+ww*.18, y+2*scale, ww*.08, Math.max(0,h-4*scale));
      ctx.fillStyle = 'rgba(0,70,20,.22)';
      ctx.fillRect(xx+ww*.82, y, ww*.12, h);
      ctx.strokeStyle = '#064c1c';
      ctx.lineWidth = 3*scale;
      ctx.strokeRect(xx, y, ww, h);
      if (cap) {
        ctx.fillStyle = 'rgba(255,255,255,.24)';
        ctx.fillRect(xx+3*scale, y+3*scale, ww-6*scale, 3*scale);
        ctx.strokeStyle = '#064c1c';
        ctx.lineWidth = 2*scale;
        ctx.beginPath(); ctx.moveTo(xx+5*scale,y+h-4*scale); ctx.lineTo(xx+ww-5*scale,y+h-4*scale); ctx.stroke();
      }
    }

    // Tuyau du haut : corps puis large rebord
    section(0, Math.max(0,p.topHeight-capH), false);
    section(p.topHeight-capH, capH, true);
    // Tuyau du bas
    section(p.bottomY, capH, true);
    section(p.bottomY+capH, groundY-(p.bottomY+capH), false);
  }

  // Poulet dessiné en plusieurs couches Canvas pour obtenir une mascotte
  // cohérente, détaillée et réellement animée (ailes, pattes, corps et clignement).
  function drawChicken() {
    const s = scale;
    const blink = (frameCount % 210) < 6;
    const flap = Math.sin(frameCount * 0.34) * 0.52 - chicken.wingKick * 0.78;
    const bob = (!gameStarted ? Math.sin(frameCount * 0.075) * 2.2 : 0);
    const legSwing = Math.sin(frameCount * 0.42) * 3.2;

    ctx.save();
    chicken.rotation = Math.max(-0.25, Math.min(0.48, chicken.vy * 0.042));
    ctx.translate(chicken.x, chicken.y + bob * s);
    ctx.rotate(chicken.rotation);
    ctx.scale(s * 0.58, s * 0.58);

    // Ombre douce sous le personnage.
    ctx.save();
    ctx.fillStyle = 'rgba(15,55,95,.18)';
    ctx.beginPath(); ctx.ellipse(-2, 27, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Queue : trois plumes séparées derrière le corps.
    ctx.save();
    ctx.lineWidth = 3.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#423343';
    const tailGrad = ctx.createLinearGradient(-49, -15, -28, 12);
    tailGrad.addColorStop(0, '#fffdf4'); tailGrad.addColorStop(1, '#d8cdbd');
    ctx.fillStyle = tailGrad;
    ctx.beginPath(); ctx.moveTo(-28, -8); ctx.quadraticCurveTo(-53, -25, -49, -7); ctx.quadraticCurveTo(-43, 1, -27, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.quadraticCurveTo(-55, -3, -47, 12); ctx.quadraticCurveTo(-38, 17, -23, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-25, 8); ctx.quadraticCurveTo(-43, 18, -32, 23); ctx.quadraticCurveTo(-22, 22, -17, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Pattes et petits doigts animés.
    function drawLeg(x, swing) {
      ctx.save(); ctx.translate(x, 24); ctx.rotate(swing * 0.035);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#9b4c12'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, 8); ctx.stroke();
      const foot = ctx.createLinearGradient(0, 6, 0, 15);
      foot.addColorStop(0, '#ffc13a'); foot.addColorStop(1, '#e8780d');
      ctx.fillStyle = foot; ctx.strokeStyle = '#9b4c12'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(-4, 5, -8, 10); ctx.quadraticCurveTo(-9, 14, -2, 13); ctx.lineTo(4, 13); ctx.quadraticCurveTo(11, 16, 12, 11); ctx.quadraticCurveTo(10, 7, 4, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    drawLeg(-11, legSwing); drawLeg(14, -legSwing);

    // Corps principal avec ventre lumineux.
    const body = ctx.createRadialGradient(-15, -5, 4, -2, 6, 43);
    body.addColorStop(0, '#fffef8'); body.addColorStop(.62, '#fff5df'); body.addColorStop(1, '#d9c7aa');
    ctx.lineWidth = 4; ctx.strokeStyle = '#292337'; ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(-1, 7, 36, 27, -0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Reflet sur le dos et détails du ventre.
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-11, -3, 22, 3.55, 5.25); ctx.stroke();
    ctx.strokeStyle = 'rgba(196,174,145,.5)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-23, 18); ctx.quadraticCurveTo(-5, 25, 13, 18); ctx.stroke();
    ctx.restore();

    // Aile proche : pivotée à chaque battement.
    ctx.save();
    ctx.translate(-12, 6); ctx.rotate(flap);
    const wing = ctx.createLinearGradient(-22, -20, 10, 16);
    wing.addColorStop(0, '#ffffff'); wing.addColorStop(.58, '#f8f0e2'); wing.addColorStop(1, '#d8c8b5');
    ctx.fillStyle = wing; ctx.strokeStyle = '#292337'; ctx.lineWidth = 3.4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(8, 4); ctx.quadraticCurveTo(-2, -8, -12, -18);
    ctx.quadraticCurveTo(-20, -26, -27, -17); ctx.quadraticCurveTo(-31, -9, -22, -3);
    ctx.quadraticCurveTo(-32, -5, -34, 4); ctx.quadraticCurveTo(-34, 15, -21, 16);
    ctx.quadraticCurveTo(-8, 19, 8, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,174,153,.72)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-24, -11); ctx.quadraticCurveTo(-12, -2, -4, 7); ctx.moveTo(-28, 2); ctx.quadraticCurveTo(-14, 5, -5, 10); ctx.stroke();
    ctx.restore();

    // Tête ronde et joues.
    const head = ctx.createRadialGradient(3, -29, 4, 17, -12, 33);
    head.addColorStop(0, '#ffffff'); head.addColorStop(.68, '#fff7e8'); head.addColorStop(1, '#dfceb5');
    ctx.fillStyle = head; ctx.strokeStyle = '#292337'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(15, -14, 26, 27, .06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,170,155,.35)';
    ctx.beginPath(); ctx.ellipse(32, -2, 5, 3, 0, 0, Math.PI*2); ctx.fill();

    // Crête rouge composée de trois lobes, avec des reflets.
    const comb = ctx.createLinearGradient(0, -57, 0, -31);
    comb.addColorStop(0, '#ff6570'); comb.addColorStop(.55, '#f52f42'); comb.addColorStop(1, '#b90e2c');
    ctx.fillStyle = comb; ctx.strokeStyle = '#292337'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-4, -34);
    ctx.bezierCurveTo(-17, -48, -9, -62, 1, -53);
    ctx.bezierCurveTo(5, -65, 20, -61, 19, -46);
    ctx.bezierCurveTo(31, -54, 42, -43, 31, -31);
    ctx.quadraticCurveTo(15, -25, -4, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,175,178,.8)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-3, -45); ctx.quadraticCurveTo(1, -50, 5, -44); ctx.moveTo(12, -48); ctx.quadraticCurveTo(19, -53, 20, -44); ctx.stroke();

    // Yeux expressifs ; fermeture rapide de paupières pour le clignement.
    function drawEye(x, y, rx, ry, pupilShift) {
      ctx.save(); ctx.translate(x, y);
      if (blink) {
        ctx.strokeStyle = '#292337'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-rx, 1); ctx.quadraticCurveTo(0, 7, rx, 0); ctx.stroke();
      } else {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#292337'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, -.08, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#201d2b';
        ctx.beginPath(); ctx.ellipse(2 + pupilShift, 1, rx*.43, ry*.68, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4 + pupilShift, -5, 3.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-3, 2, 1.7, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    drawEye(23, -20, 10, 13, 1.5);
    drawEye(3, -19, 8, 11, 1);
    ctx.strokeStyle = '#292337'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(15, -37); ctx.quadraticCurveTo(24, -41, 31, -35); ctx.stroke();

    // Bec ouvert animé, deux parties orange et intérieur rouge.
    const beakOpen = 2.5 + Math.max(0, Math.sin(frameCount * .22)) * 3.2;
    const beak = ctx.createLinearGradient(35, -8, 58, 7);
    beak.addColorStop(0, '#ffd34b'); beak.addColorStop(1, '#e77a0b');
    ctx.fillStyle = beak; ctx.strokeStyle = '#292337'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(37, -10); ctx.quadraticCurveTo(47, -9, 57, -3); ctx.quadraticCurveTo(49, 5 + beakOpen, 36, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a92b25';
    ctx.beginPath(); ctx.moveTo(39, 0); ctx.quadraticCurveTo(47, 1, 53, -2); ctx.quadraticCurveTo(47, 5, 39, 4); ctx.closePath(); ctx.fill();

    // Barbillon rouge sous le bec.
    const wattle = ctx.createLinearGradient(24, 0, 35, 18);
    wattle.addColorStop(0, '#ff5260'); wattle.addColorStop(1, '#c91431');
    ctx.fillStyle = wattle; ctx.strokeStyle = '#292337'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(27, 5); ctx.bezierCurveTo(39, 5, 38, 19, 28, 21); ctx.bezierCurveTo(20, 20, 20, 10, 27, 5); ctx.fill(); ctx.stroke();

    // Petits reflets brillants pour le rendu cartoon.
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.ellipse(-5, -29, 7, 3, -.55, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-23, 5, 6, 2, -.4, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawOverlay() {
    if (!gameStarted && !isGameOver) {
      const boxW = Math.min(W-32, 330*scale);
      const boxH = 62*scale;
      const x = (W-boxW)/2, y = H*.70;
      ctx.save();
      ctx.fillStyle = 'rgba(0,48,105,.76)';
      roundedRect(x,y,boxW,boxH,14*scale); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2*scale; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.max(12,15*scale)}px Arial`;
      ctx.fillText('TOUCHEZ POUR VOLER',W/2,y+22*scale);
      ctx.fillStyle = '#ffe34b'; ctx.font = `900 ${Math.max(10,11*scale)}px Arial`;
      ctx.fillText('ESPACE  •  FLÈCHE HAUT',W/2,y+43*scale);
      ctx.restore();
    }
  }

  function update() {
    frameCount++;
    chicken.wingKick *= 0.88;
    if (chicken.wingKick < 0.015) chicken.wingKick = 0;

    if (gameStarted && !isGameOver) {
      chicken.vy += chicken.gravity;
      chicken.y += chicken.vy;
      if (frameCount % 105 === 0) createPipe();

      for (let i=pipes.length-1; i>=0; i--) {
        const p = pipes[i];
        p.x -= pipeSpeed;
        if (!p.passed && p.x+pipeWidth < chicken.x) {
          p.passed = true; score++;
          const scoreEl = document.getElementById('current-score');
          if (scoreEl) scoreEl.innerText = score;
          if (typeof playSound === 'function') playSound(880,.08,'sine');
        }
        if (p.x < -pipeWidth-12) pipes.splice(i,1);

        const box = { left: chicken.x-34*scale, right: chicken.x+34*scale, top: chicken.y-39*scale, bottom: chicken.y+24*scale };
        if (box.right > p.x-5*scale && box.left < p.x+pipeWidth+5*scale) {
          if (box.top < p.topHeight || box.bottom > p.bottomY) gameOver();
        }
      }
      if (chicken.y+chicken.radius >= groundY || chicken.y-41*scale <= 0) gameOver();
    }

    drawBackground();
    pipes.forEach(drawPipe);
    drawChicken();
    drawOverlay();

    if (!isGameOver) currentGameLoop = requestAnimationFrame(update);
  }

  function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    if (typeof triggerGameOver === 'function') triggerGameOver(score);
  }

  if (window.GameMobile) GameMobile.start('flappy');
  update();
}
