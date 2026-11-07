/* Tower Stack+ — empile les blocs, un monde low poly tiré au sort à chaque partie.
 * Format du site : startTowerStackGame() · #game-canvas · #current-score · triggerGameOver(score) · playSound
 * Contrôles : clic / toucher / Espace = poser le bloc · F ou bouton ⛶ = plein écran
 */
function startTowerStackGame() {
  if (window.__towerStop) { try { window.__towerStop(); } catch (e) {} }
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
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hsl = (h, s, l) => `hsl(${h % 360},${s}%,${clamp(l, 0, 100)}%)`;
  const note = c => 330 * 2 ** (([0, 2, 4, 7, 9][c % 5] + 12 * Math.floor(c / 5)) / 12);
  const WD = [
    { n: 'Prairie', p: 34, r: 'Commun', rc: '#c5ced6', sky: ['#63b8ff', '#e9f9ff'], h0: 200, st: 10, s: 55, l: 56, g: '#5bb34f', cl: '#fff', fx: 'none',
      L: [{ k: .12, c: ['#a6d3c4', '#8cc0b0'], hh: [110, 170], ww: [220, 340] }, { k: .28, c: ['#74c566', '#5cae52'], hh: [55, 95], ww: [200, 320] }] },
    { n: 'Désert', p: 22, r: 'Peu commun', rc: '#8be28b', sky: ['#ff9a5c', '#ffe8b4'], h0: 175, st: 8, s: 60, l: 52, g: '#dfa257', cl: '#fff0d4', fx: 'sun',
      L: [{ k: .12, c: ['#f1b66c', '#d99a4f'], hh: [40, 80], ww: [320, 480] }, { k: .28, c: ['#e8a95c', '#cb8a40'], hh: [30, 60], ww: [280, 440] }] },
    { n: 'Banquise', p: 16, r: 'Peu commun', rc: '#8be28b', sky: ['#8fa8ff', '#eef5ff'], h0: 335, st: 8, s: 62, l: 62, g: '#f2f8ff', cl: '#fff', fx: 'snow',
      L: [{ k: .12, c: ['#c4d6fb', '#a1b8ea'], hh: [130, 210], ww: [220, 330], cap: ['#fff', '#dfe9fa'] }, { k: .28, c: ['#e4eefc', '#c3d3ee'], hh: [60, 110], ww: [200, 300] }] },
    { n: 'Abysses', p: 12, r: 'Rare', rc: '#6cb8ff', sky: ['#0f86ad', '#031d33'], h0: 10, st: 8, s: 78, l: 60, g: '#a58d57', fx: 'bubble',
      L: [{ k: .12, c: ['#0a5878', '#07435f'], hh: [110, 180], ww: [220, 340] }, { k: .28, c: ['#0d7a8a', '#0a6574'], hh: [50, 90], ww: [200, 300] }] },
    { n: 'Volcan', p: 10, r: 'Très rare', rc: '#ff9a3d', sky: ['#220808', '#c2410f'], h0: 45, st: 7, s: 85, l: 56, g: '#2b1613', lava: '#ff7a1f', fx: 'ember',
      L: [{ k: .12, c: ['#4d2a22', '#34191a'], hh: [170, 270], ww: [260, 380], cap: ['#ff9a3d', '#e25517'] }, { k: .28, c: ['#3b1f1c', '#281312'], hh: [70, 120], ww: [220, 320] }] },
    { n: 'Espace', p: 6, r: 'Légendaire', rc: '#ffd84a', sky: ['#03041a', '#241a63'], h0: 160, st: 11, s: 75, l: 62, g: ['#6d5bd0', '#5846b6'], fx: 'stars', L: [] }
  ];
  const HH = 18, BW = 100, RANGE = 135;
  let W, H, k, sc, pr, wd = WD[0], st = 'play', blocks = [], cur = null, axis = 0, dir = 1, cam = 0, camT = 0, Z = 1, ZT = 1, score = 0, combo = 0,
    debris = [], rings = [], P = [], pk = [], clouds = [], shake = 0, lt = 0, T = 0, bannerT = 0, msgT = 0, msgTxt = '', raf = 0, alive = true, timer = 0;

  function roll() { let r = Math.random() * 100; for (const w of WD) { if ((r -= w.p) < 0) return w; } return WD[0]; }
  function setWorld(w) {
    wd = w; P = [];
    const n = w.fx === 'stars' ? 80 : ['snow', 'ember', 'bubble'].includes(w.fx) ? 30 : 0;
    for (let i = 0; i < n; i++) P.push({ x: Math.random(), y: Math.random(), s: rnd(.6, 1.6), v: rnd(.02, .07), a: Math.random() * 6 });
    clouds = []; if (w.cl) for (let i = 0; i < 4; i++) clouds.push({ x: Math.random(), y: rnd(.08, .45), s: rnd(.7, 1.4), v: rnd(.004, .012) });
    pk = w.L.map(l => { const a = []; let x = 0; while (x < 1700) { const ww = rnd(...l.ww); a.push({ x, w: ww, h: rnd(...l.hh) }); x += ww * rnd(.45, .7); } return a; });
  }
  function spawn() {
    const t = blocks[blocks.length - 1]; axis = blocks.length % 2; dir = Math.random() < .5 ? 1 : -1;
    cur = { x: t.x, z: t.z, w: t.w, d: t.d, y: t.y + HH, i: blocks.length, f: 0 }; cur[axis ? 'z' : 'x'] -= dir * RANGE; camT = cur.y;
  }
  function newRun() {
    blocks = [{ x: 0, z: 0, w: BW, d: BW, y: 0, i: 0, f: 0 }]; debris = []; rings = []; score = 0; combo = 0; Z = ZT = 1; st = 'play';
    spawn(); cam = camT; if (scoreEl) scoreEl.textContent = 0; bannerT = 2.6;
  }
  function msg(t) { msgTxt = t; msgT = 1; }
  function over() {
    st = 'over'; const n = blocks.length;
    ZT = clamp(H * .5 / ((n * HH + 170) * k), .3, 1); camT = n * HH / 2 - .24 * H / (k * ZT);
    timer = setTimeout(() => { if (typeof triggerGameOver === 'function') triggerGameOver(score); }, 900);
  }
  function place() {
    if (!cur || st !== 'play') return;
    const top = blocks[blocks.length - 1], a = axis ? 'z' : 'x', s = axis ? 'd' : 'w', dl = cur[a] - top[a], ad = Math.abs(dl);
    if (ad >= top[s] - .5) { debris.push({ ...cur, vy: 0, vx: dl > 0 ? 40 : -40, ax: a }); cur = null; combo = 0; shake = 9; snd(110, .45, 'sawtooth'); return over(); }
    if (ad <= 4.5) {
      cur[a] = top[a]; combo++; let g = 0; if (combo >= 3 && cur[s] < BW) { cur[s] = Math.min(BW, cur[s] + 6); g = 1; }
      cur.f = 1; rings.push({ ...cur, t: 0 }); setScore(score + 2); msg('Parfait ×' + combo + (g ? ' · bloc élargi' : '')); snd(note(combo), .22, 'triangle');
    } else {
      combo = 0; const oc = (cur[a] + top[a]) / 2, sg = Math.sign(dl), db = { ...cur, vy: 0, vx: sg * 30, ax: a };
      db[s] = ad; db[a] = oc + sg * top[s] / 2; debris.push(db); cur[a] = oc; cur[s] = top[s] - ad; shake = 6; setScore(score + 1); snd(200, .12, 'triangle');
    }
    blocks.push(cur); cur = null; spawn();
  }
  function setScore(v) { score = v; if (scoreEl) scoreEl.textContent = v; }
  const sp = () => Math.min(110 + blocks.length * 2.4, 260);

  function update(dt) {
    T += dt;
    if (st === 'play' && cur) {
      const a = axis ? 'z' : 'x', c = blocks[blocks.length - 1][a]; cur[a] += dir * sp() * dt;
      if (cur[a] - c > RANGE) { cur[a] = c + RANGE; dir = -1; } else if (cur[a] - c < -RANGE) { cur[a] = c - RANGE; dir = 1; }
    }
    cam += (camT - cam) * Math.min(1, dt * 4); Z += (ZT - Z) * Math.min(1, dt * 3);
    for (const b of blocks.slice(-3)) if (b.f > 0) b.f = Math.max(0, b.f - dt * 3);
    if (cur && cur.f > 0) cur.f = Math.max(0, cur.f - dt * 3);
    for (const d of debris) { d.vy -= 900 * dt; d.y += d.vy * dt; d[d.ax] += d.vx * dt; }
    debris = debris.filter(d => d.y > cam - 900);
    for (const r of rings) r.t += dt * 2.2; rings = rings.filter(r => r.t < 1);
    shake *= .88; bannerT = Math.max(0, bannerT - dt); msgT = Math.max(0, msgT - dt);
    for (const c of clouds) { c.x += c.v * dt; if (c.x > 1.2) c.x = -.2; }
    for (const p of P) { if (wd.fx === 'snow') p.y += p.v * dt; else if (wd.fx !== 'stars') p.y -= p.v * dt; p.y = (p.y + 1) % 1; }
  }
  function disc(x, y, R, n, c1, c2, rot = 0) {
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * 6.283, b = rot + (i + 1) / n * 6.283; ctx.fillStyle = ctx.strokeStyle = i % 2 ? c1 : c2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.lineTo(x + Math.cos(b) * R, y + Math.sin(b) * R); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  function tri(a, b, c, col) { ctx.fillStyle = ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function bg() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, wd.sky[0]); g.addColorStop(1, wd.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const kk = k * Z, cy = H * .62, r = cam * kk; ctx.lineWidth = 1;
    if (wd.fx === 'stars') {
      ctx.fillStyle = '#fff';
      for (const p of P) { ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(T * p.s + p.a)); ctx.fillRect(p.x * W, (p.y * H + r * .05 * p.s) % H, p.s * 1.7, p.s * 1.7); }
      ctx.globalAlpha = 1; const py = H * .2 + r * .03; disc(W * .78, py, 46 * sc, 8, '#ff8fb1', '#d96a95', T * .05);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(W * .78, py, 74 * sc, 16 * sc, -.4, 0, 6.283); ctx.stroke();
    }
    if (wd.fx === 'sun') disc(W * .78, H * .22 + r * .05, 48 * sc, 10, '#fff4c2', '#ffe28a', T * .1);
    if (wd.fx === 'bubble') { ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 4; i++) { const x = W * (.1 + .25 * i); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 180, H); ctx.lineTo(x - 60, H); ctx.fill(); } }
    for (const c of clouds) {
      const x = c.x * (W + 300) - 150, y = c.y * H + r * .08, q = c.s * sc; ctx.fillStyle = wd.cl; ctx.globalAlpha = .9; ctx.beginPath();
      [[0, 0], [14, -14], [38, -24], [62, -12], [80, -20], [102, 0]].forEach(([a, b], i) => i ? ctx.lineTo(x + a * q, y + b * q) : ctx.moveTo(x + a * q, y + b * q)); ctx.fill();
      ctx.globalAlpha = .35; ctx.fillStyle = '#8aa5c7'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 102 * q, y); ctx.lineTo(x + 86 * q, y + 8 * q); ctx.lineTo(x + 16 * q, y + 8 * q); ctx.fill(); ctx.globalAlpha = 1;
    }
    wd.L.forEach((l, j) => {
      const b = cy - (70 - j * 26) * kk + r * l.k;
      for (const p of pk[j]) {
        const ax = p.x * sc + W / 2 - 850 * sc, ww = p.w * sc, hh = p.h * sc; if (ax + ww / 2 < 0 || ax - ww / 2 > W) continue;
        tri([ax - ww / 2, b], [ax, b - hh], [ax, b], l.c[0]); tri([ax, b - hh], [ax + ww / 2, b], [ax, b], l.c[1]);
        if (l.cap) { const q = .36; tri([ax - ww * q / 2, b - hh * (1 - q)], [ax, b - hh], [ax, b - hh * (1 - q) + hh * .05], l.cap[0]); tri([ax, b - hh], [ax + ww * q / 2, b - hh * (1 - q)], [ax, b - hh * (1 - q) + hh * .05], l.cap[1]); }
      }
      ctx.fillStyle = l.c[1]; ctx.fillRect(0, b, W, H - b + 2);
    });
    const fl = cy - 34 * kk + r * .6;
    if (wd.fx === 'stars') disc(W / 2, fl + W * 1.1, W * 1.1, 44, wd.g[0], wd.g[1], .02);
    else { ctx.fillStyle = wd.g; ctx.fillRect(0, fl, W, H - fl + 2); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, fl, W, 6 * kk); if (wd.lava) { ctx.fillStyle = wd.lava; ctx.fillRect(0, fl, W, 7 * kk); } }
  }
  function box(b) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y0 = b.y, y1 = b.y + HH, h = wd.h0 + b.i * wd.st, s = wd.s, l = wd.l + (b.f || 0) * 22;
    const A = pr(x0, z0, y1), B = pr(x1, z0, y1), C = pr(x1, z1, y1), D = pr(x0, z1, y1), E = pr(x0, z1, y0), F = pr(x1, z1, y0), G = pr(x1, z0, y0);
    tri(D, C, E, hsl(h, s, l - 4)); tri(C, F, E, hsl(h, s, l - 9)); tri(B, C, G, hsl(h, s, l - 13)); tri(C, F, G, hsl(h, s, l - 18));
    tri(A, B, D, hsl(h, s, l + 11)); tri(B, C, D, hsl(h, s, l + 6));
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(...D); ctx.lineTo(...C); ctx.lineTo(...B); ctx.stroke();
  }
  function fxf() {
    for (const p of P) {
      if (wd.fx === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(p.x * W + Math.sin(T + p.a) * 12, p.y * H, p.s * 2.6, p.s * 2.6); }
      else if (wd.fx === 'ember') { ctx.fillStyle = `rgba(255,${120 + p.s * 50 | 0},40,${.4 + .4 * Math.sin(T * 3 + p.a)})`; ctx.fillRect(p.x * W + Math.sin(T + p.a) * 14, p.y * H, p.s * 3, p.s * 3); }
      else if (wd.fx === 'bubble') { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x * W + Math.sin(T + p.a) * 10, p.y * H, p.s * 4, 0, 6.283); ctx.stroke(); }
    }
  }
  function draw() {
    ctx.save(); if (shake > .4) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
    bg(); const kk = k * Z, cx = W / 2, cy = H * .62; pr = (x, z, y) => [cx + (x - z) * .866 * kk, cy + (x + z) * .5 * kk - (y - cam) * kk];
    for (const b of blocks) { const y = cy - (b.y - cam) * kk; if (y > -60 * kk && y < H + 120 * kk) box(b); }
    for (const d of debris) box(d); if (cur) box(cur);
    ctx.lineWidth = 3;
    for (const r of rings) {
      const e = 1 + r.t * .55, x0 = r.x - r.w / 2 * e, x1 = r.x + r.w / 2 * e, z0 = r.z - r.d / 2 * e, z1 = r.z + r.d / 2 * e, y = r.y + HH;
      ctx.strokeStyle = `rgba(255,255,255,${1 - r.t})`; ctx.beginPath(); [pr(x0, z0, y), pr(x1, z0, y), pr(x1, z1, y), pr(x0, z1, y)].forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.stroke();
    }
    fxf(); ctx.restore();
    const hu = Math.max(.8, Math.min(W, H) / 400); ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `900 ${Math.round(54 * hu)}px Impact,"Arial Black",sans-serif`; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 7 * hu; ctx.strokeText(score, W / 2, 62 * hu); ctx.fillStyle = '#fff'; ctx.fillText(score, W / 2, 62 * hu);
    ctx.font = `bold ${Math.round(13 * hu)}px system-ui,sans-serif`; const tw = ctx.measureText(wd.n).width + 26 * hu;
    ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - tw / 2, 74 * hu, tw, 24 * hu, 12 * hu) : ctx.rect(W / 2 - tw / 2, 74 * hu, tw, 24 * hu); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(wd.n, W / 2, 91 * hu);
    if (msgT > 0) { ctx.globalAlpha = Math.min(1, msgT * 2); ctx.font = `900 ${Math.round(26 * hu)}px Impact,"Arial Black",sans-serif`; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 6 * hu; ctx.strokeText(msgTxt, W / 2, H * .3 - (1 - msgT) * 24); ctx.fillText(msgTxt, W / 2, H * .3 - (1 - msgT) * 24); ctx.globalAlpha = 1; }
    if (bannerT > 0) {
      const a = bannerT > 2.2 ? (2.6 - bannerT) / .4 : Math.min(1, bannerT / .6); ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `900 ${Math.round(46 * hu)}px Impact,"Arial Black",sans-serif`; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 8 * hu; ctx.strokeText(wd.n, W / 2, H * .22); ctx.fillStyle = '#fff'; ctx.fillText(wd.n, W / 2, H * .22);
      ctx.font = `bold ${Math.round(16 * hu)}px system-ui,sans-serif`; ctx.fillStyle = wd.rc; ctx.strokeText(wd.r + ' · ' + wd.p + ' % de chance', W / 2, H * .22 + 28 * hu); ctx.fillText(wd.r + ' · ' + wd.p + ' % de chance', W / 2, H * .22 + 28 * hu); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function loop(ts) {
    if (!alive) return;
    const dt = Math.min(.033, (ts - lt) / 1000 || 0); lt = ts;
    FSK.fit(); W = cv.width; H = cv.height; k = Math.min(W * .003, H * .0026); sc = clamp(W / 700, .55, 1.3);
    update(dt); draw(); FSK.draw(ctx);
    raf = requestAnimationFrame(loop);
    try { currentGameLoop = raf; } catch (e) {}
  }
  const onDown = e => { e.preventDefault(); if (FSK.hit(e)) return; place(); };
  const onClick = e => { if (FSK.hit(e)) FSK.toggle(); };
  const onKey = e => {
    if (isTyping(e)) return;
    if (e.code === 'KeyF') { FSK.toggle(); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (e.repeat) return; if (st === 'over') restartClick(); else place(); }
  };
  function cleanup() {
    alive = false; cancelAnimationFrame(raf); clearTimeout(timer);
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey);
    FSK.off(); if (window.__towerStop === cleanup) window.__towerStop = null;
  }
  window.__towerStop = cleanup;
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('click', onClick); window.addEventListener('keydown', onKey);

  W = cv.width; H = cv.height; k = Math.min(W * .003, H * .0026); sc = clamp(W / 700, .55, 1.3);
  setWorld(roll()); newRun();
  raf = requestAnimationFrame(loop);
  try { currentGameLoop = raf; } catch (e) {}
}