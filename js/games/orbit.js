/* Orbit — saute d'orbite en orbite entre des planètes low poly.
 * Format du site : startOrbitGame() · #game-canvas · #current-score · triggerGameOver(score) · playSound
 * Contrôles : clic / toucher / Espace = lâcher la balle · F ou bouton ⛶ = plein écran
 */
function startOrbitGame() {
  if (window.__orbitStop) { try { window.__orbitStop(); } catch (e) {} }
  const cv = document.getElementById('game-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d'), scoreEl = document.getElementById('current-score');
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
  const TAU = Math.PI * 2, SPD = 440, CATCH = 18;
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hs = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
  const note = c => 294 * 2 ** (([0, 2, 4, 7, 9][c % 5] + 12 * Math.floor(c / 5)) / 12);

  /* ---------- Planètes low poly : disque triangulé (24 facettes) ---------- */
  const TYPES = ['terre', 'lave', 'glace', 'desert', 'gaz', 'lune'];
  const HUE = { terre: 205, lave: 15, glace: 190, desert: 35, gaz: 300, lune: 215 };
  const PAL = {
    terre: () => Math.random() < .4 ? [112 + rnd(-10, 10), 48, 44] : [208, 72, 50],
    lave: () => Math.random() < .3 ? [32, 92, 56] : [Math.random() < .5 ? 6 : 14, 80, 32],
    glace: () => [196 + rnd(-6, 6), 45, 78],
    desert: () => Math.random() < .3 ? [18, 62, 46] : [32, 68, 60],
    gaz: (x, y) => { const b = Math.floor((y + 1) * 2.5); return b % 2 ? [285, 50, 58] : [320, 50, 46]; },
    lune: () => [220, 6, Math.random() < .5 ? 62 : 50]
  };
  function mk(type) {
    const o = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * TAU, r = 1 + rnd(-.03, .03); return [Math.cos(a) * r, Math.sin(a) * r]; });
    const m = Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU, r = .55 + rnd(-.08, .08); return [Math.cos(a) * r, Math.sin(a) * r]; });
    const tr = [];
    for (let j = 0; j < 6; j++) {
      const j2 = (j + 1) % 6;
      tr.push([[0, 0], m[j], m[j2]], [m[j], o[2 * j], o[2 * j + 1]], [m[j], o[2 * j + 1], m[j2]], [m[j2], o[2 * j + 1], o[(2 * j + 2) % 12]]);
    }
    return tr.map(t => {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const c = PAL[type](cx, cy); const l = clamp(c[2] - 18 * (cx * .6 + cy * .5) + rnd(-4, 4), 8, 92);
      return { p: t, s: hs(c[0], c[1], l) };
    });
  }

  let W, H, sc, hu, st = 'play', pl = [], stars = [], cur = 0, from = 0, flyT = 0, score = 0, combo = 0, parts = [], rings = [], pops = [],
    cam = { x: 0, y: 0 }, shake = 0, lt = 0, T = 0, hue = 215, hint = 5, msgT = 0, msgTxt = '', raf = 0, alive = true, timer = 0,
    b = { x: 0, y: 0, a: 0, dir: 1, rr: 60, vx: 0, vy: 0, mode: 'orbit' };
  const bgStars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(.2, 1) }));
  const deco = Array.from({ length: 3 }, (_, i) => { const t = TYPES[Math.floor(Math.random() * 6)]; return { fx: Math.random(), fy: .15 + i * .3 + rnd(-.08, .08), R: rnd(60, 120), mesh: mk(t) }; });

  function gen() {
    const l = pl[pl.length - 1], r = Math.random(), type = TYPES[Math.floor(Math.random() * 6)];
    const rb = r < .35 ? rnd(16, 24) : r < .75 ? rnd(28, 40) : rnd(46, 62), ro = rb + 26;
    const a = -Math.PI / 2 + rnd(-.85, .85), d = Math.max(rnd(190, 250) + Math.min(score * 2, 60), l.ro + ro + 80);
    const p = { x: l.x + Math.cos(a) * d, y: l.y + Math.sin(a) * d, rb, ro, type, mesh: mk(type), h: HUE[type],
      ring: type === 'gaz' ? Math.random() < .7 : Math.random() < .08, tilt: rnd(-.5, .5), pulse: 0 };
    pl.push(p);
    if (Math.random() < .55) {
      const nx = -(p.y - l.y), ny = p.x - l.x, nl = Math.hypot(nx, ny), o = rnd(-50, 50);
      stars.push({ x: (l.x + p.x) / 2 + nx / nl * o, y: (l.y + p.y) / 2 + ny / nl * o, a: rnd(0, 6) });
    }
  }
  function newRun() {
    score = 0; combo = 0; hint = 5; st = 'play'; stars = []; parts = []; rings = []; pops = [];
    pl = [{ x: 0, y: 0, rb: 40, ro: 66, type: 'terre', mesh: mk('terre'), h: HUE.terre, ring: false, tilt: 0, pulse: 0 }]; cur = 0;
    while (pl.length < 4) gen();
    b = { x: 0, y: 66, a: Math.PI / 2, dir: 1, rr: 66, vx: 0, vy: 0, mode: 'orbit' };
    cam.x = 0; cam.y = -.22 * 400 / 1; if (scoreEl) scoreEl.textContent = 0;
  }
  function burst(x, y, h, n, l = 70, s = 80) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(s, s + 180); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(.4, .8), max: .8, s: rnd(3, 6), h, l }); }
  }
  function setScore(v) { score = v; if (scoreEl) scoreEl.textContent = score; }
  function release() {
    if (b.mode !== 'orbit' || st !== 'play') return;
    b.vx = -Math.sin(b.a) * b.dir * SPD; b.vy = Math.cos(b.a) * b.dir * SPD; b.mode = 'fly'; flyT = 0; from = cur; hint = 0; snd(260, .07, 'sine');
  }
  function capture(i, d) {
    const q = pl[i], rx = b.x - q.x, ry = b.y - q.y, cr = rx * b.vy - ry * b.vx, off = Math.abs(cr) / SPD;
    b.dir = cr > 0 ? 1 : -1; b.a = Math.atan2(ry, rx); b.rr = d; b.mode = 'orbit'; cur = i;
    const pf = off < q.rb * .55 + 6; combo = pf ? combo + 1 : 0; setScore(score + (pf ? 2 : 1));
    q.pulse = 1; burst(b.x, b.y, q.h, pf ? 22 : 12); rings.push({ x: q.x, y: q.y, r: q.ro, t: 0, h: q.h });
    if (pf) { msgTxt = combo > 1 ? 'Parfait ×' + combo : 'Parfait'; msgT = 1.1; }
    snd(note(pf ? combo : 0), .25, 'sine');
    while (pl.length < cur + 4) gen();
    while (cur > 3) { pl.shift(); cur--; }
  }
  function die() {
    st = 'over'; b.mode = 'dead'; burst(b.x, b.y, 0, 34, 95, 100); shake = 12; snd(90, .5, 'sawtooth');
    timer = setTimeout(() => { if (typeof triggerGameOver === 'function') triggerGameOver(score); }, 750);
  }

  function update(dt) {
    T += dt;
    const p = pl[cur], k = Math.min(1, dt * 3);
    cam.x += (p.x - cam.x) * k; cam.y += (p.y - .22 * H / sc - cam.y) * k;
    hue += ((215 + score * 5) - hue) * Math.min(1, dt * 1.5); shake *= .88; msgT = Math.max(0, msgT - dt); if (hint > 0 && b.mode === 'orbit') hint -= dt * .2;
    for (const o of pl) o.pulse *= Math.pow(.02, dt);
    if (b.mode === 'orbit') {
      const w = (2.1 + Math.min(score * .04, 1.5)) * Math.sqrt(66 / p.ro);
      b.a += b.dir * w * dt; b.rr += (p.ro - b.rr) * Math.min(1, dt * 10);
      b.x = p.x + Math.cos(b.a) * b.rr; b.y = p.y + Math.sin(b.a) * b.rr;
    } else if (b.mode === 'fly') {
      b.x += b.vx * dt; b.y += b.vy * dt; flyT += dt;
      for (let i = cur + 1; i < pl.length; i++) { const o = pl[i], d = Math.hypot(b.x - o.x, b.y - o.y); if (d <= o.ro + CATCH) { capture(i, d); break; } }
      if (b.mode === 'fly' && (Math.hypot(b.x - pl[from].x, b.y - pl[from].y) > 520 || flyT > 2.2)) die();
    }
    if (b.mode !== 'dead') {
      for (const s of stars) if (!s.got && Math.hypot(b.x - s.x, b.y - s.y) < 22) {
        s.got = true; setScore(score + 3); burst(s.x, s.y, 48, 10, 65); pops.push({ x: s.x, y: s.y - 10, t: 0 }); snd(880, .15, 'triangle');
      }
      parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: .45, max: .45, s: b.mode === 'fly' ? 6 : 4, h: pl[cur].h, l: 75 });
    }
    stars = stars.filter(s => !s.got && Math.hypot(s.x - cam.x, s.y - cam.y) < 1200);
    for (const o of parts) { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= .96; o.vy *= .96; o.life -= dt; }
    parts = parts.filter(o => o.life > 0);
    for (const r of rings) r.t += dt * 1.8; rings = rings.filter(r => r.t < 1);
    for (const o of pops) o.t += dt; pops = pops.filter(o => o.t < 1);
  }

  function drawMesh(mesh, x, y, R, alpha) {
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    for (const t of mesh) {
      ctx.fillStyle = ctx.strokeStyle = t.s; ctx.beginPath();
      ctx.moveTo(x + t.p[0][0] * R, y + t.p[0][1] * R); ctx.lineTo(x + t.p[1][0] * R, y + t.p[1][1] * R); ctx.lineTo(x + t.p[2][0] * R, y + t.p[2][1] * R);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function ringArc(q, x, y, R, front) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(q.tilt); ctx.lineCap = 'butt';
    ctx.strokeStyle = hs(q.h, 45, 72, .6); ctx.lineWidth = R * .2; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.7, R * .5, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
    ctx.strokeStyle = hs(q.h, 35, 85, .5); ctx.lineWidth = R * .08; ctx.beginPath(); ctx.ellipse(0, 0, R * 2.05, R * .6, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
    ctx.restore();
  }
  function starShape(x, y, r, rot) {
    for (let i = 0; i < 10; i++) {
      const a1 = rot + i / 10 * TAU - 1.57, a2 = rot + (i + 1) / 10 * TAU - 1.57, r1 = i % 2 ? r * .45 : r, r2 = i % 2 ? r : r * .45;
      ctx.fillStyle = ctx.strokeStyle = i % 2 ? '#ffc233' : '#ffe066'; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a1) * r1, y + Math.sin(a1) * r1); ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  function draw() {
    ctx.save();
    if (shake > .4) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hs(hue, 45, 7)); g.addColorStop(1, hs(hue + 25, 50, 15));
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    for (const d of deco) {
      const x = (((d.fx * W * 1.4 - cam.x * sc * .04) % (W * 1.4)) + W * 1.4) % (W * 1.4) - W * .2, y = (((d.fy * H * 1.3 - cam.y * sc * .04) % (H * 1.3)) + H * 1.3) % (H * 1.3) - H * .15;
      drawMesh(d.mesh, x, y, d.R * sc, .22);
    }
    for (const s of bgStars) {
      const x = ((s.x * W - cam.x * sc * .08 * s.z) % W + W) % W, y = ((s.y * H - cam.y * sc * .08 * s.z) % H + H) % H, tw = .5 + .5 * Math.sin(T * 2 + s.x * 20);
      ctx.fillStyle = `rgba(255,255,255,${(.25 + .5 * s.z) * tw})`; ctx.fillRect(x, y, s.z * 2.2, s.z * 2.2);
      if (s.z > .85) { ctx.fillRect(x - 3, y + .6, 8, 1); ctx.fillRect(x + .6, y - 3, 1, 8); }
    }
    const X = v => W / 2 + (v - cam.x) * sc, Y = v => H / 2 + (v - cam.y) * sc;
    for (const s of stars) {
      const x = X(s.x), y = Y(s.y); if (y < -40 || y > H + 40) continue;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 26 * sc); gl.addColorStop(0, 'rgba(255,224,102,.45)'); gl.addColorStop(1, 'rgba(255,224,102,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 26 * sc, y - 26 * sc, 52 * sc, 52 * sc); starShape(x, y, 11 * sc, Math.sin(T * 2 + s.a) * .3);
    }
    for (let i = Math.max(0, cur - 1); i < pl.length; i++) {
      const q = pl[i], x = X(q.x), y = Y(q.y); if (y < -200 || y > H + 200) continue;
      const R = q.rb * sc * (1 + .06 * q.pulse), O = q.ro * (1 + .04 * q.pulse) * sc, act = i === cur, nxt = i === cur + 1;
      const gl = ctx.createRadialGradient(x, y, R * .6, x, y, R * 2.3); gl.addColorStop(0, hs(q.h, 70, 55, .3)); gl.addColorStop(1, hs(q.h, 70, 55, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, R * 2.3, 0, TAU); ctx.fill();
      if (q.ring) ringArc(q, x, y, R, false);
      drawMesh(q.mesh, x, y, R);
      if (q.ring) ringArc(q, x, y, R, true);
      ctx.lineWidth = (act ? 3 : 2) * sc; ctx.strokeStyle = hs(q.h, 70, 65, act ? .95 : nxt ? .65 : .3);
      ctx.setLineDash(act ? [] : [8 * sc, 9 * sc]); ctx.beginPath(); ctx.arc(x, y, O, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const r of rings) { ctx.lineWidth = 3 * sc; ctx.strokeStyle = hs(r.h, 70, 70, 1 - r.t); ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), (r.r + r.t * 80) * sc, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    for (const o of parts) { const a = o.life / o.max; ctx.fillStyle = o.h ? hs(o.h, 85, o.l, a * .8) : `rgba(255,255,255,${a * .8})`; ctx.beginPath(); ctx.arc(X(o.x), Y(o.y), o.s * a * sc, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    if (b.mode !== 'dead') {
      const bx = X(b.x), by = Y(b.y);
      if (b.mode === 'orbit' && st === 'play') {
        const tx = -Math.sin(b.a) * b.dir, ty = Math.cos(b.a) * b.dir;
        ctx.setLineDash([3, 10]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + tx * 230 * sc, by + ty * 230 * sc); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.shadowBlur = 20; ctx.shadowColor = hs(pl[cur].h, 80, 60); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 7 * sc, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffe066'; ctx.font = `700 ${Math.round(18 * hu)}px system-ui,sans-serif`;
    for (const o of pops) { ctx.globalAlpha = 1 - o.t; ctx.fillText('+3', X(o.x), Y(o.y) - o.t * 40 * sc); } ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(120,180,255,.7)'; ctx.shadowBlur = 14 * hu; ctx.font = `300 ${Math.round(58 * hu)}px system-ui,sans-serif`;
    ctx.fillText(score, W / 2, 62 * hu); ctx.shadowBlur = 0;
    if (msgT > 0) { ctx.globalAlpha = Math.min(1, msgT * 2); ctx.font = `600 ${Math.round(24 * hu)}px system-ui,sans-serif`; ctx.fillText(msgTxt, W / 2, H * .3 - (1.1 - msgT) * 30); ctx.globalAlpha = 1; }
    if (hint > 0 && st === 'play') { ctx.globalAlpha = Math.min(1, hint); ctx.font = `600 ${Math.round(15 * hu)}px system-ui,sans-serif`; ctx.fillText('Touche pour lâcher la balle quand le pointillé vise une planète', W / 2, H - 22 * hu); ctx.globalAlpha = 1; }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function loop(ts) {
    if (!alive) return;
    const dt = Math.min(.033, (ts - lt) / 1000 || 0); lt = ts;
    FSK.fit(); W = cv.width; H = cv.height; sc = Math.min(W, H) / 520; hu = Math.max(.8, Math.min(W, H) / 400);
    update(dt); draw(); FSK.draw(ctx);
    raf = requestAnimationFrame(loop);
    try { currentGameLoop = raf; } catch (e) {}
  }
  const onDown = e => { e.preventDefault(); if (FSK.hit(e)) return; release(); };
  const onClick = e => { if (FSK.hit(e)) FSK.toggle(); };
  const onKey = e => {
    if (isTyping(e)) return;
    if (e.code === 'KeyF') { FSK.toggle(); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (e.repeat) return; if (st === 'over') restartClick(); else release(); }
  };
  function cleanup() {
    alive = false; cancelAnimationFrame(raf); clearTimeout(timer);
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey);
    FSK.off(); if (window.__orbitStop === cleanup) window.__orbitStop = null;
  }
  window.__orbitStop = cleanup;
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('click', onClick); window.addEventListener('keydown', onKey);

  W = cv.width; H = cv.height; sc = Math.min(W, H) / 520; hu = Math.max(.8, Math.min(W, H) / 400);
  newRun(); cam.y = -.22 * H / sc;
  raf = requestAnimationFrame(loop);
  try { currentGameLoop = raf; } catch (e) {}
}