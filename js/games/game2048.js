// ============================================================
// CYBER 2048 — glisse (ou flèches) pour fusionner les tuiles.
// Meilleur score sauvegardé sur l'appareil. On peut continuer après 2048.
// ============================================================
function start2048Game() {
  if (window.GameMobile) GameMobile.reset();
  if (window._g2048Cleanup) window._g2048Cleanup();

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const N = 4;
  const ANIM_MS = 110;
  const PALETTE = ['#00f3ff', '#00ff9d', '#7dff00', '#ffe600', '#ffaa00', '#ff5500', '#ff0055', '#ff00aa', '#b000ff', '#6a5cff', '#00aaff'];

  let tiles = [];
  let score = 0;
  let best = 0;
  try { best = parseInt(localStorage.getItem('best_2048'), 10) || 0; } catch (e) { /* ignore */ }
  let animStart = -1000, animating = false;
  let over = false, won = false, bannerUntil = 0, stopped = false, overAt = 0;

  // ---------- géométrie du plateau ----------
  const topBar = 54;
  const bs = Math.max(120, Math.min(W - 24, H - topBar - 14));
  const bx = (W - bs) / 2;
  const by = topBar + (H - topBar - bs) / 2;
  const gap = bs * 0.03;
  const cell = (bs - gap * (N + 1)) / N;
  const cx = c => bx + gap + c * (cell + gap);
  const cy = r => by + gap + r * (cell + gap);

  // ---------- logique ----------
  const colorOf = v => PALETTE[Math.min(PALETTE.length - 1, Math.max(0, Math.log2(v) - 1))];

  function emptyCells() {
    const used = new Set();
    tiles.forEach(t => { if (!t.die) used.add(t.r * N + t.c); });
    const list = [];
    for (let i = 0; i < N * N; i++) if (!used.has(i)) list.push(i);
    return list;
  }

  function addTile(born) {
    const free = emptyCells();
    if (!free.length) return;
    const i = free[Math.floor(Math.random() * free.length)];
    const r = Math.floor(i / N), c = i % N;
    tiles.push({ v: Math.random() < 0.9 ? 2 : 4, r, c, fr: r, fc: c, die: false, born: !!born, pop: false });
  }

  function setScore(s) {
    score = s;
    if (score > best) {
      best = score;
      try { localStorage.setItem('best_2048', String(best)); } catch (e) { /* ignore */ }
    }
    const el = document.getElementById('current-score');
    if (el) el.innerText = score;
  }

  function canMove() {
    if (emptyCells().length) return true;
    const g = Array.from({ length: N }, () => Array(N).fill(0));
    tiles.forEach(t => { if (!t.die) g[t.r][t.c] = t.v; });
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (c + 1 < N && g[r][c] === g[r][c + 1]) return true;
        if (r + 1 < N && g[r][c] === g[r + 1][c]) return true;
      }
    }
    return false;
  }

  function finishAnim() {
    animating = false;
    tiles = tiles.filter(t => !t.die);
    tiles.forEach(t => { t.fr = t.r; t.fc = t.c; t.born = false; t.pop = false; });
    if (!won && tiles.some(t => t.v >= 2048)) {
      won = true;
      bannerUntil = performance.now() + 2600;
      if (typeof playSound === 'function') playSound(988, 0.25, 'triangle');
    }
    if (!over && !canMove()) {
      over = true;
      overAt = performance.now();
    }
  }

  function move(dr, dc) {
    if (over || stopped) return;
    if (animating) finishAnim();   // enchaîne vite si on spamme les glissements

    tiles.forEach(t => { t.fr = t.r; t.fc = t.c; t.born = false; t.pop = false; });
    let moved = false, gained = 0;

    for (let i = 0; i < N; i++) {
      // tuiles de la ligne / colonne i, classées depuis le bord vers lequel on pousse
      const line = tiles.filter(t => !t.die && (dr === 0 ? t.r === i : t.c === i));
      line.sort((a, b) => {
        const pa = dr === 0 ? a.c : a.r, pb = dr === 0 ? b.c : b.r;
        return (dr + dc) < 0 ? pa - pb : pb - pa;
      });
      let idx = 0, prev = null;
      for (const t of line) {
        if (prev && prev.v === t.v && !prev.merged) {
          t.r = prev.r; t.c = prev.c; t.die = true;
          prev.v *= 2; prev.merged = true; prev.pop = true;
          gained += prev.v; moved = true;
        } else {
          const nr = dr === 0 ? i : ((dr + dc) < 0 ? idx : N - 1 - idx);
          const nc = dr === 0 ? ((dr + dc) < 0 ? idx : N - 1 - idx) : i;
          if (nr !== t.r || nc !== t.c) moved = true;
          t.r = nr; t.c = nc;
          prev = t; idx++;
        }
      }
    }
    tiles.forEach(t => { t.merged = false; });

    if (!moved) { tiles.forEach(t => { t.fr = t.r; t.fc = t.c; }); return; }

    addTile(true);
    if (gained) setScore(score + gained);
    animating = true;
    animStart = performance.now();
    if (typeof playSound === 'function') playSound(gained ? 520 : 300, 0.04, gained ? 'triangle' : 'sine');
  }

  // ---------- entrées ----------
  function onKeyDown(e) {
    const map = {
      ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
      KeyA: [0, -1], KeyD: [0, 1], KeyW: [-1, 0], KeyS: [1, 0]
    };
    const m = map[e.code];
    if (!m) return;
    e.preventDefault();
    move(m[0], m[1]);
  }

  const inGame = t => !!t && (t === canvas || (t.closest && !!t.closest('#gm-stage')));
  let sw = null;
  function onPointerDown(e) {
    if (!inGame(e.target)) return;
    sw = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
  }
  function onPointerMove(e) {
    if (!sw || sw.id !== e.pointerId || sw.done) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    sw.done = true;   // un seul mouvement par glissement
    if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
    else move(dy > 0 ? 1 : -1, 0);
  }
  function onPointerUp(e) { if (sw && sw.id === e.pointerId) sw = null; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  window._g2048Cleanup = () => {
    stopped = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window._g2048Cleanup = null;
  };

  // ---------- rendu ----------
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawTile(t, p, scale) {
    const x = cx(0) + (t.fc + (t.c - t.fc) * p) * (cell + gap);
    const y = cy(0) + (t.fr + (t.r - t.fr) * p) * (cell + gap);
    const col = colorOf(t.v);
    const s = cell * scale, ox = x + (cell - s) / 2, oy = y + (cell - s) / 2;

    ctx.shadowBlur = t.v >= 128 ? 16 : 8;
    ctx.shadowColor = col;
    ctx.fillStyle = 'rgba(9,13,22,0.96)';
    rrect(ox, oy, s, s, s * 0.12); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
    ctx.shadowBlur = 0;

    const digits = String(t.v).length;
    const fs = s * (digits <= 2 ? 0.42 : digits === 3 ? 0.34 : 0.27);
    ctx.fillStyle = col;
    ctx.font = `900 ${Math.floor(fs)}px "Rajdhani", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(t.v), ox + s / 2, oy + s / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // en-tête centré (le score en surimpression du plein écran est en haut à gauche)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f3ff';
    ctx.font = '900 22px "Rajdhani", sans-serif';
    ctx.fillText('2048', W / 2, 24);
    ctx.fillStyle = '#d6dbe8';
    ctx.font = '700 14px "Rajdhani", sans-serif';
    ctx.fillText(`SCORE ${score}   •   MEILLEUR ${best}`, W / 2, 44);

    // plateau
    ctx.fillStyle = '#0a0a1a';
    rrect(bx, by, bs, bs, bs * 0.03); ctx.fill();
    ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = '#00f3ff'; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,243,255,0.06)';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { rrect(cx(c), cy(r), cell, cell, cell * 0.12); ctx.fill(); }

    // animation
    let p = 1;
    if (animating) {
      p = Math.min(1, (now - animStart) / ANIM_MS);
      if (p >= 1) finishAnim();
    }
    const e = 1 - Math.pow(1 - p, 3);   // easeOutCubic

    // tuiles qui disparaissent d'abord, puis les autres
    tiles.filter(t => t.die).forEach(t => drawTile(t, e, 1));
    tiles.filter(t => !t.die).forEach(t => {
      let scale = 1;
      if (t.born) scale = Math.max(0, Math.min(1, (p - 0.5) * 2));
      else if (t.pop && p > 0.4) scale = 1 + 0.16 * Math.sin(Math.PI * (p - 0.4) / 0.6);
      if (scale > 0) drawTile(t, e, scale);
    });

    // bannière de victoire
    if (now < bannerUntil) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by + bs / 2 - 34, bs, 68);
      ctx.fillStyle = '#ffe600'; ctx.font = '900 26px "Rajdhani", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('2048 ATTEINT !', W / 2, by + bs / 2 - 4);
      ctx.fillStyle = '#ffffff'; ctx.font = '700 14px "Rajdhani", sans-serif';
      ctx.fillText('Continue, il n’y a pas de limite', W / 2, by + bs / 2 + 20);
    }

    // fin de partie
    if (over) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(bx, by, bs, bs);
      ctx.fillStyle = '#ff0055'; ctx.font = '900 28px "Rajdhani", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PLUS DE MOUVEMENTS', W / 2, by + bs / 2);
    }
  }

  function loop(now) {
    if (stopped) return;
    draw(now);
    if (over && now - overAt > 1200) {
      stopped = true;
      if (typeof triggerGameOver === 'function') triggerGameOver(score);
      return;
    }
    currentGameLoop = requestAnimationFrame(loop);
  }

  addTile(false);
  addTile(false);
  setScore(0);
  if (window.GameMobile) GameMobile.start('2048', {});
  currentGameLoop = requestAnimationFrame(loop);
}
