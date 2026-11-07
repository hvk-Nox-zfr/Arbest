/* Rope Swing — jeu de balancier à la corde (format des jeux du site)
 * Lancement : startRopeSwingGame()
 * Utilise : #game-canvas, #current-score, triggerGameOver(score), currentGameLoop
 * Contrôles : maintenir (clic, doigt, Espace, ↑ ou W) = s'accrocher / relâcher = lâcher la corde
 */
function startRopeSwingGame() {
  if (window.__ropeSwingStop) { try { window.__ropeSwingStop(); } catch (e) {} }
  const cv = document.getElementById('game-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('current-score');
  cv.style.touchAction = 'none';
  /* ----- Plein écran (bouton ⛶ dans le canvas, touche F) ----- */
  const FSK = (function () {
    const box = cv.parentElement || cv, bsaved = box.getAttribute('style');
    let pseudo = false, on = false;
    const nat = () => document.fullscreenElement || document.webkitFullscreenElement;
    const req = box.requestFullscreen || box.webkitRequestFullscreen;
    function sync() {
      const now = !!nat() || pseudo;
      if (pseudo) box.style.cssText = (bsaved || '') + ';position:fixed;inset:0;z-index:9999;width:100vw;height:100vh;max-width:none;margin:0;background:#000';
      else if (box !== cv) { if (bsaved === null) box.removeAttribute('style'); else box.setAttribute('style', bsaved); }
      if (now) {
        if (cv.dataset.os === undefined) cv.dataset.os = cv.getAttribute('style') || '';
        cv.style.cssText = cv.dataset.os + ';display:block;width:100%;height:100%;max-width:none;max-height:none;aspect-ratio:auto;border-radius:0;margin:0;touch-action:none';
      } else if (cv.dataset.os !== undefined) {
        const o = cv.dataset.os; delete cv.dataset.os;
        if (o) cv.setAttribute('style', o); else cv.removeAttribute('style');
        cv.style.touchAction = 'none'; cv.width = 600; cv.height = 400;
      }
      on = now;
    }
    function toggle() {
      if (nat()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
      else if (pseudo) { pseudo = false; sync(); }
      else if (req) { try { const r = req.call(box); if (r && r.catch) r.catch(() => { pseudo = true; sync(); }); } catch (e) { pseudo = true; sync(); } }
      else { pseudo = true; sync(); }
    }
    function fit() {
      if (!on) return;
      const d = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
      if (w > 0 && h > 0 && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
    }
    const rect = () => { const k = Math.max(1, Math.min(cv.width, cv.height) / 400); return { x: cv.width - 42 * k, y: 8 * k, s: 32 * k, k }; };
    function draw(c) {
      const r = rect(), cx = r.x + r.s / 2, cy = r.y + r.s / 2, a = 8 * r.k, b = 3 * r.k;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = .8; c.fillStyle = 'rgba(0,0,0,.45)';
      c.beginPath(); c.arc(cx, cy, r.s / 2, 0, 6.283); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2 * r.k; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(cx + sx * a, cy + sy * b); c.lineTo(cx + sx * a, cy + sy * a); c.lineTo(cx + sx * b, cy + sy * a); c.stroke(); }
      c.restore();
    }
    function hit(e) {
      const rc = cv.getBoundingClientRect(), px = (e.clientX - rc.left) * cv.width / rc.width, py = (e.clientY - rc.top) * cv.height / rc.height, r = rect();
      return px >= r.x - 6 && px <= r.x + r.s + 6 && py >= r.y - 6 && py <= r.y + r.s + 6;
    }
    function off() {
      document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync);
      if (pseudo) { pseudo = false; sync(); }
    }
    document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return { toggle, fit, draw, hit, off };
  })();
  const isTyping = e => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  const snd = (f, d, t) => { try { if (typeof playSound === 'function') playSound(f, d, t); } catch (e) {} };
  const restartClick = () => { const b = document.getElementById('btn-restart'); if (b) b.click(); };

  // Monde en "unités de design" : hauteur 600, mise à l'échelle selon le canvas
  const DH = 600, G = 1900, REACH = 340, LAVA = 555, R = 11, VMAX = 1050;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let W, H, u, offY, raf = 0, alive = true, over = false, dead = false, deadT = 0, held = false;
  let p, att, L, anchors, stars, parts, trail, camX, shake, meters, bonus, score, startX, hint, best = 0, lastT = performance.now(), pt = 0, time = 0;
  try { best = +localStorage.getItem('ropeswing_best') || 0; } catch (e) {}

  function sfx(f, d = .1, ty = 'triangle') { snd(f, d, ty); }

  function addAnchor() {
    const l = anchors[anchors.length - 1], sp = rnd(170, 250) + Math.min(meters * .8, 70);
    const a = { x: l.x + sp, y: rnd(70, 230) };
    anchors.push(a);
    if (Math.random() < .45) stars.push({ x: l.x + sp / 2 + rnd(-30, 30), y: rnd(250, 430), a: rnd(0, 6) });
  }
  function reset() {
    anchors = [{ x: 200, y: 120 }]; stars = []; parts = []; trail = [];
    meters = 0; bonus = 0; score = 0; shake = 0; dead = false; over = false; hint = 5; held = false;
    p = { x: 90, y: 270, vx: 280, vy: 0 }; startX = p.x;
    att = anchors[0]; L = Math.hypot(p.x - att.x, p.y - att.y);
    for (let i = 0; i < 8; i++) addAnchor();
    camX = p.x - 200; if (scoreEl) scoreEl.textContent = 0;
  }
  function cand() {
    let best = null, bx = -1e9;
    for (const a of anchors) {
      const dx = a.x - p.x, dy = a.y - p.y;
      if (dx < 30 || dy > -30 || Math.hypot(dx, dy) > REACH) continue;
      if (a.x > bx) { bx = a.x; best = a; }
    }
    if (!best) {
      let bd = 1e9;
      for (const a of anchors) {
        const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy);
        if (dy > -30 || dx < -60 || d > REACH) continue;
        if (d < bd) { bd = d; best = a; }
      }
    }
    return best;
  }
  function burst(x, y, n, c) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rnd(60, 300);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.4, .9), max: .9, c });
    }
  }
  function press() {
    if (over) { reset(); return; }
    if (dead) return;
    held = true;
    if (!att) {
      const a = cand();
      if (!a) { sfx(120, .1, 'square', .06); return; }
      att = a; L = Math.max(70, Math.hypot(p.x - a.x, p.y - a.y) * .94);
      sfx(520, .08); burst(a.x, a.y, 6, '#7fe3ff');
    }
  }
  function releaseKey() {
    held = false;
    if (att && !dead) { att = null; hint = 0; sfx(300, .08, 'sine', .1); }
  }
  function die() {
    dead = true; deadT = .7; att = null; shake = 10;
    burst(p.x, p.y, 36, '#ff9a3d'); sfx(90, .5, 'sawtooth', .15);
    if (score > best) { best = score; try { localStorage.setItem('ropeswing_best', best); } catch (e) {} }
  }
  function finish() {
    over = true;
    if (typeof triggerGameOver === 'function') { cleanup(); triggerGameOver(score); }
  }

  function update(dt) {
    time += dt; shake *= .88;
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; q.life -= dt; }
    parts = parts.filter(q => q.life > 0);
    if (over) return;
    if (dead) { deadT -= dt; if (deadT <= 0) finish(); return; }
    const n = 2, h = dt / n;
    for (let i = 0; i < n; i++) {
      p.vy += G * h;
      if (att && p.vx > 0) p.vx += 260 * h;
      p.x += p.vx * h; p.y += p.vy * h;
      if (att) {
        const dx = p.x - att.x, dy = p.y - att.y, d = Math.hypot(dx, dy);
        if (d > L) {
          const nx = dx / d, ny = dy / d;
          p.x = att.x + nx * L; p.y = att.y + ny * L;
          const vn = p.vx * nx + p.vy * ny;
          if (vn > 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
        }
      }
    }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > VMAX) { p.vx *= VMAX / sp; p.vy *= VMAX / sp; }
    if (p.y < 10) { p.y = 10; p.vy = Math.abs(p.vy) * .3; }
    trail.push({ x: p.x, y: p.y }); if (trail.length > 16) trail.shift();
    for (const s of stars) {
      if (!s.got && Math.hypot(p.x - s.x, p.y - s.y) < 24) {
        s.got = true; bonus += 5; burst(s.x, s.y, 12, '#ffe066'); sfx(880, .15);
      }
    }
    camX += (p.x - (W / u) * .3 - camX) * Math.min(1, dt * 4);
    while (anchors[anchors.length - 1].x < camX + W / u + 600) addAnchor();
    anchors = anchors.filter(a => a.x > camX - 300 || a === att);
    stars = stars.filter(s => !s.got && s.x > camX - 300);
    meters = Math.max(meters, Math.floor((p.x - startX) / 45));
    const sc = meters + bonus;
    if (sc !== score) { score = sc; if (scoreEl) scoreEl.textContent = score; }
    if (p.y > LAVA - 4 || p.x < camX - 80) die();
  }

  function ridge(par, base, amp, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 14; sx += 14) {
      const wx = sx / u + camX * par;
      const y = base - amp * (Math.sin(wx * .006) + .6 * Math.sin(wx * .017 + 2) + .3 * Math.sin(wx * .041));
      ctx.lineTo(sx, offY + y * u);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function draw() {
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1040'); g.addColorStop(.6, '#7a2f6b'); g.addColorStop(1, '#ff7a59');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(W * .75, offY + 380 * u, 44 * u, 0, 6.283); ctx.fill();
    ridge(.1, 470, 60, '#3a1d5c'); ridge(.25, 520, 45, '#2a1250');
    if (shake > .4) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
    ctx.translate(0, offY); ctx.scale(u, u); ctx.translate(-camX, 0);
    const vis = W / u;
    // ancres + chaînes
    const c = (!att && !dead) ? cand() : null;
    for (const a of anchors) {
      if (a.x < camX - 40 || a.x > camX + vis + 40) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, -300); ctx.stroke();
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(a.x, a.y, 7, 0, 6.283); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = a === att ? '#7fe3ff' : 'rgba(255,209,102,.5)';
      ctx.beginPath(); ctx.arc(a.x, a.y, 14 + 2 * Math.sin(time * 4 + a.x), 0, 6.283); ctx.stroke();
      if (a === c) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(a.x, a.y, 23, 0, 6.283); ctx.stroke(); }
    }
    // étoiles
    for (const s of stars) {
      if (s.x < camX - 40 || s.x > camX + vis + 40) continue;
      ctx.save(); ctx.translate(s.x, s.y + Math.sin(time * 3 + s.a) * 4); ctx.rotate(time + s.a);
      ctx.fillStyle = '#ffe066'; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 : 13, a = i / 8 * 6.283; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // corde
    if (att && !dead) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(att.x, att.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    // écharpe (traînée) + joueur
    if (!dead) {
      for (let i = 1; i < trail.length; i++) {
        ctx.strokeStyle = `rgba(255,77,109,${i / trail.length * .8})`; ctx.lineWidth = 2 + i / trail.length * 6;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.clip(); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(-R, -R * .55, R * 2, 5); ctx.restore();
      const d = p.vx >= 0 ? 1 : -1;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(d * 4, 2, 3.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(d * 5, 2, 1.5, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    for (const q of parts) { ctx.globalAlpha = q.life / q.max; ctx.fillStyle = q.c; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); }
    ctx.globalAlpha = 1;
    // lave (devant)
    const ly = LAVA, bot = DH + (H - offY) / u + 10, lg = ctx.createLinearGradient(0, ly - 60, 0, bot);
    lg.addColorStop(0, 'rgba(255,106,43,0)'); lg.addColorStop(.25, 'rgba(255,106,43,.55)'); lg.addColorStop(.26, '#ff6a2b'); lg.addColorStop(1, '#8f1308');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(camX - 10, bot);
    for (let x = camX - 10; x <= camX + vis + 10; x += 16) ctx.lineTo(x, ly + Math.sin(x * .03 + time * 3) * 4);
    ctx.lineTo(camX + vis + 10, bot); ctx.closePath(); ctx.fill();
    ctx.restore();
    // interface
    const fs = Math.max(12, 16 * u);
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    if (hint > 0 && !over) {
      ctx.globalAlpha = Math.min(1, hint);
      ctx.fillText('Maintiens pour t’accrocher · Relâche pour lâcher', W / 2, H * .88);
      ctx.globalAlpha = 1;
    }
    ctx.font = `800 ${fs * 2.6}px system-ui, sans-serif`; ctx.fillText(score, W / 2, fs * 3);
    ctx.textAlign = 'left'; ctx.font = `600 ${fs * .85}px system-ui, sans-serif`;
    ctx.fillText('Record ' + best, 12, fs * 1.6);
    if (over && typeof triggerGameOver !== 'function') {
      ctx.textAlign = 'center'; ctx.font = `700 ${fs * 1.6}px system-ui, sans-serif`;
      ctx.fillText('Perdu — touche pour rejouer', W / 2, H / 2);
    }
    ctx.restore();
    FSK.draw(ctx);
  }

  function loop(ts) {
    if (!alive) return;
    lastT = performance.now();
    const dt = Math.min(.033, (ts - pt) / 1000 || 0); pt = ts;
    FSK.fit(); W = cv.width; H = cv.height; u = Math.min(H / DH, W / 760); offY = Math.max(0, (H - DH * u) / 2);
    if (hint > 0 && !att) hint -= dt * .2;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
    try { currentGameLoop = raf; } catch (e) {}
  }

  const stale = () => !cv.isConnected || (!document.hidden && performance.now() - lastT > 3000);
  const typing = isTyping;
  const isKey = e => e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
  const onDown = e => { e.preventDefault(); if (FSK.hit(e)) return; press(); };
  const onClick = e => { if (FSK.hit(e)) FSK.toggle(); };
  const onUp = () => { if (alive) releaseKey(); };
  const onKeyDown = e => {
    if (stale()) { cleanup(); return; }
    if (e.code === 'KeyF' && !typing(e)) { FSK.toggle(); return; }
    if (!isKey(e) || typing(e)) return;
    e.preventDefault(); if (!e.repeat) press();
  };
  const onKeyUp = e => { if (alive && isKey(e)) releaseKey(); };
  function cleanup() {
    alive = false; cancelAnimationFrame(raf);
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('click', onClick); FSK.off();
    window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
    if (window.__ropeSwingStop === cleanup) window.__ropeSwingStop = null;
  }
  window.__ropeSwingStop = cleanup;
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('click', onClick);
  window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);

  reset();
  raf = requestAnimationFrame(loop);
  try { currentGameLoop = raf; } catch (e) {}
}