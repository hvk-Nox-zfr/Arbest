window.startMotoGame = function () {
  if (window.__motoStop) window.__motoStop();
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  if (window.MobileKit) MobileKit.setup({ mode: 'canvas', controls: 'none' });

  // ================= CONSTANTES & UTILITAIRES =================
  const G = 0.44, SUB = 4, WR = 14, HALF = 28, L = HALF * 2, MAXV = 34, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function rng(s) {
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const THEMES = [
    { sky: ['#38bdf8', '#bae6fd', '#f0f9ff'], sun: '#fde047', hills: ['#93c5fd', '#60a5fa', '#3b82f6'], grass: '#4ade80', grassD: '#15803d', dirt: ['#92400e', '#3b1d08'], road: '#334155', decor: 'pine' },
    { sky: ['#4c1d95', '#db2777', '#fdba74'], sun: '#fef08a', hills: ['#7e22ce', '#6b21a8', '#3b0764'], grass: '#fb923c', grassD: '#9a3412', dirt: ['#7c2d12', '#2a0f06'], road: '#44403c', decor: 'cactus' },
    { sky: ['#020617', '#1e1b4b', '#312e81'], sun: '#e2e8f0', hills: ['#3730a3', '#27237a', '#13123a'], grass: '#22d3ee', grassD: '#0e7490', dirt: ['#1e293b', '#0b1220'], road: '#1e293b', decor: 'crystal', stars: true },
    { sky: ['#94a3b8', '#cbd5e1', '#f1f5f9'], sun: '#fff', hills: ['#e2e8f0', '#cbd5e1', '#94a3b8'], grass: '#f8fafc', grassD: '#94a3b8', dirt: ['#64748b', '#1e293b'], road: '#475569', decor: 'pine' }
  ];

  // ================= GÉNÉRATION DE PISTES =================
  function buildLoop(cx, cy, radius, segments = 90) {
    const pts = [], spiral = 60;
    for (let i = 0; i <= segments; i++) {
      const ratio = i / segments, a = Math.PI / 2 - ratio * TAU;
      pts.push({ x: cx + Math.cos(a) * radius + ratio * spiral, y: cy + Math.sin(a) * radius, layer: ratio > 0.48 ? 1 : 0, isLoop: true });
    }
    return pts;
  }

  function buildWhoops(sx, sy, count, width, height) {
    const pts = [];
    for (let i = 0; i <= count; i++) pts.push({ x: sx + i * width, y: sy - (i % 2 === 1 ? height : 0), layer: 0 });
    return pts;
  }

  const mk = (lv, theme) => (lv.theme = theme, lv);

  function createLevel1() {
    let pts = [{ x: 0, y: 350, layer: 0 }, { x: 200, y: 350, layer: 0 }];
    pts = pts.concat(buildWhoops(200, 350, 4, 25, 12).slice(1));
    pts.push({ x: 300, y: 350, layer: 0 }, { x: 950, y: 350, layer: 0 });
    const loop = buildLoop(1140, 160, 190);
    pts = pts.concat(loop);
    const e = loop[loop.length - 1].x;
    pts.push(
      { x: e + 120, y: 350, layer: 1 }, { x: e + 350, y: 350, layer: 0 }, { x: e + 500, y: 220, layer: 0 },
      { x: e + 580, y: 430, layer: 0 }, { x: e + 800, y: 430, layer: 0 }, { x: e + 1500, y: 350, layer: 0 }
    );
    return mk({ name: '1. INITIATION & GRAND LOOPING', start: { x: 80, y: 310 }, finishX: e + 1300, points: pts }, 0);
  }

  function createLevel2() {
    let pts = [{ x: 0, y: 350, layer: 0 }, { x: 700, y: 350, layer: 0 }];
    const l1 = buildLoop(890, 160, 190);
    pts = pts.concat(l1);
    let lx = l1[l1.length - 1].x;
    pts.push({ x: lx + 700, y: 350, layer: 0 });
    const l2 = buildLoop(lx + 890, 160, 190);
    pts = pts.concat(l2);
    lx = l2[l2.length - 1].x;
    pts.push({ x: lx + 100, y: 350, layer: 0 });
    pts = pts.concat(buildWhoops(lx + 100, 350, 8, 30, 22).slice(1));
    pts.push({ x: lx + 1100, y: 350, layer: 0 });
    return mk({ name: '2. DOUBLE LOOPING GÉANT', start: { x: 80, y: 310 }, finishX: lx + 900, points: pts }, 1);
  }

  function createLevel3() {
    let pts = [{ x: 0, y: 350, layer: 0 }, { x: 250, y: 350, layer: 0 }, { x: 450, y: 140, layer: 0 }, { x: 750, y: 420, layer: 0 }, { x: 850, y: 350, layer: 0 }, { x: 1550, y: 350, layer: 0 }];
    const loop = buildLoop(1740, 150, 200);
    pts = pts.concat(loop);
    const e = loop[loop.length - 1].x;
    pts.push(
      { x: e + 100, y: 350, layer: 0 }, { x: e + 250, y: 250, layer: 0 }, { x: e + 300, y: 350, layer: 0 },
      { x: e + 450, y: 220, layer: 0 }, { x: e + 500, y: 350, layer: 0 }, { x: e + 1200, y: 350, layer: 0 }
    );
    return mk({ name: '3. DÉFI SPATIAL', start: { x: 80, y: 310 }, finishX: e + 1000, points: pts }, 2);
  }

  function createRandom(seed) {
    const R = rng(seed), pts = [{ x: 0, y: 350, layer: 0 }];
    const lx = () => pts[pts.length - 1].x;
    const flat = n => pts.push({ x: lx() + n, y: 350, layer: 0 });
    flat(500);
    let loops = 0;
    for (let i = 0; i < 12; i++) {
      const k = R();
      if (k < 0.18 && loops < 2) {
        loops++; flat(850);
        const r = 130 + R() * 60, lp = buildLoop(lx(), 350 - r, r);
        pts.push(...lp.slice(1));
        const e = lx();
        pts.push({ x: e + 100, y: 350, layer: 1 }, { x: e + 260, y: 350, layer: 0 });
      } else if (k < 0.45) {
        flat(150 + R() * 150);
        const x = lx(), len = 300 + R() * 300, h = 50 + R() * 110;
        for (let j = 1; j <= 16; j++) { const t = j / 16; pts.push({ x: x + t * len, y: 350 - h * Math.pow(Math.sin(Math.PI * t), 2), layer: 0 }); }
      } else if (k < 0.68) {
        flat(150 + R() * 100);
        pts.push(...buildWhoops(lx(), 350, 2 * (2 + Math.floor(R() * 3)), 26 + R() * 10, 14 + R() * 14).slice(1));
      } else if (k < 0.9) {
        flat(250);
        const x = lx(), h = 36 + R() * 24, gap = 220 + R() * 260;
        for (let j = 1; j <= 6; j++) { const t = j / 6; pts.push({ x: x + t * 150, y: 350 - h * t * t, layer: 0 }); }
        pts.push({ x: x + 160, y: 470, layer: 0 }, { x: x + 160 + gap, y: 470, layer: 0 }, { x: x + 160 + gap + 300, y: 350, layer: 0 });
      } else flat(500);
    }
    flat(800);
    return mk({ name: '4. MAP ALÉATOIRE #' + (seed % 10000), start: { x: 80, y: 310 }, finishX: lx() - 450, points: pts }, Math.floor(R() * 4));
  }

  function prepare(lv) {
    const p = lv.points;
    p.unshift({ x: -1500, y: p[0].y, layer: 0 });
    p.push({ x: p[p.length - 1].x + 1500, y: p[p.length - 1].y, layer: 0 });
    lv.surface = p.filter((q, i) => !(q.isLoop && p[i - 1] && p[i - 1].isLoop && p[i + 1] && p[i + 1].isLoop));
    lv.maxY = Math.max(...p.map(q => q.y));
    lv.deathY = lv.maxY + 450;
    lv.loopPaths = [];
    let cur = null;
    for (let i = 0; i < p.length; i++) {
      if (!p[i].isLoop) { cur = null; continue; }
      if (!cur || cur.layer !== p[i].layer) {
        const prev = cur;
        cur = { layer: p[i].layer, pts: [] };
        if (prev) cur.pts.push(prev.pts[prev.pts.length - 1]);
        lv.loopPaths.push(cur);
      }
      cur.pts.push(p[i]);
    }
    lv.loopPaths.forEach(lp => {
      lp.off = lp.pts.map((q, i, a) => {
        const A = a[Math.max(i - 1, 0)], B = a[Math.min(i + 1, a.length - 1)];
        const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
        return { x: q.x - dy / l * 15, y: q.y + dx / l * 15 };
      });
    });
    const surfY = x => {
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        if (a.isLoop && b.isLoop) continue;
        if (x >= a.x && x <= b.x && b.x > a.x) {
          if (Math.abs(b.y - a.y) / (b.x - a.x) > 0.45) return null;
          return lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
        }
      }
      return null;
    };
    lv.zones = []; let z = null;
    p.forEach(q => {
      if (q.isLoop) { if (!z) { z = { a: q.x, b: q.x }; lv.zones.push(z); } z.a = Math.min(z.a, q.x); z.b = Math.max(z.b, q.x); }
      else z = null;
    });
    const R = rng(p.length * 7 + 3);
    lv.decor = [];
    for (let x = 60; x < p[p.length - 2].x; x += 80 + R() * 150) {
      const y = surfY(x);
      if (y !== null && y < lv.maxY - 5) lv.decor.push({ x, y, k: R(), s: 0.7 + R() * 0.8 });
    }
    lv.surfY = surfY;
  }

  const levels = [createLevel1(), createLevel2(), createLevel3()];

  // ================= ÉTAT DU JEU =================
  let level, levelIdx = 0, bike, rider = null, particles = [], popups = [];
  let score = 0, baseScore = 0, frames = 0, dead = false, win = false, deadT = 0, winT = 0, hintT = 0, shakeAmp = 0, shakeX = 0, shakeY = 0;
  const keys = {}, touchCtl = { gas: false, brake: false, left: false, right: false };
  const ctl = { gas: false, brake: false, left: false, right: false };
  const cam = { x: 0, y: 0, z: 1 };
  const clouds = Array.from({ length: 8 }, (_, i) => ({ x: i * 330 + Math.random() * 200, y: 30 + Math.random() * 170, s: 0.6 + Math.random() * 0.9 }));
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.5 + 0.3, p: Math.random() * 6 }));

  function resetBike() {
    const s = level.start;
    bike = {
      r: { x: s.x - HALF, y: s.y, vx: 0, vy: 0, c: null },
      f: { x: s.x + HALF, y: s.y, vx: 0, vy: 0, c: null },
      layer: 0, ang: 0, airRot: 0, airT: 0, wheelie: 0, spin: 0, lean: 0, impact: 0
    };
    rider = null;
  }

  const center = () => ({ x: (bike.r.x + bike.f.x) / 2, y: (bike.r.y + bike.f.y) / 2 });
  const speedOf = () => Math.hypot((bike.r.vx + bike.f.vx) / 2, (bike.r.vy + bike.f.vy) / 2);

  function loadLevel(lv, idx) {
    level = lv; levelIdx = idx;
    if (!lv.surface) prepare(lv);
    score = baseScore; frames = 0; dead = win = false; deadT = winT = 0; hintT = 0;
    particles = []; popups = []; resetBike();
    const c = center(); cam.x = c.x; cam.y = c.y; cam.z = 1;
  }

  function nextLevel() {
    baseScore = score;
    if (levelIdx < 2) loadLevel(levels[levelIdx + 1], levelIdx + 1);
    else loadLevel(createRandom(Math.floor(Math.random() * 1e9)), 3);
  }

  function newRandom() { loadLevel(createRandom(Math.floor(Math.random() * 1e9)), 3); }

  // ================= COLLISIONS & PHYSIQUE =================
  function closest(px, py, layer) {
    const pts = level.points;
    let best = null, minD = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      if ((p1.x < px - 45 && p2.x < px - 45) || (p1.x > px + 45 && p2.x > px + 45) ||
          (p1.y < py - 45 && p2.y < py - 45) || (p1.y > py + 45 && p2.y > py + 45)) continue;
      const loop = !!(p1.isLoop && p2.isLoop), sl = p1.layer || 0;
      if (loop && sl !== layer && Math.abs(px - p1.x) > 220) continue;
      const dx = p2.x - p1.x, dy = p2.y - p1.y, lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t0 = ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq, t = clamp(t0, 0, 1);
      const qx = p1.x + t * dx, qy = p1.y + t * dy, dist = Math.hypot(px - qx, py - qy);
      const pen = loop && sl !== layer ? 60 : 0;
      if (dist + pen < minD) {
        minD = dist + pen;
        const a = Math.atan2(dy, dx);
        let nx = Math.sin(a), ny = -Math.cos(a);
        if (loop && (px - qx) * nx + (py - qy) * ny < 0) { nx = -nx; ny = -ny; }
        best = { x: qx, y: qy, dist, nx, ny, ang: a, layer: sl, loop, end: t0 <= 0 || t0 >= 1 };
      }
    }
    return best;
  }

  function collide(w) {
    const c = closest(w.x, w.y, bike.layer);
    if (!c || c.dist > WR + 1.5) return;
    w.c = c;
    if (c.loop) bike.layer = c.layer;
    if (c.dist < WR) {
      let nx = c.nx, ny = c.ny;
      if (c.end && c.dist > 0.01 && (w.x - c.x) * nx + (w.y - c.y) * ny >= 0) { nx = (w.x - c.x) / c.dist; ny = (w.y - c.y) / c.dist; }
      w.x = c.x + nx * WR; w.y = c.y + ny * WR;
      const vn = w.vx * nx + w.vy * ny;
      if (vn < 0) {
        const e = vn < -3 ? 0.15 : 0;
        w.vx -= (1 + e) * vn * nx; w.vy -= (1 + e) * vn * ny;
        bike.impact = Math.max(bike.impact, -vn);
      }
    }
  }

  function solveRod() {
    const r = bike.r, f = bike.f;
    let dx = f.x - r.x, dy = f.y - r.y;
    const d = Math.hypot(dx, dy) || 1, k = (d - L) / d * 0.5;
    r.x += dx * k; r.y += dy * k; f.x -= dx * k; f.y -= dy * k;
    dx /= d; dy /= d;
    const rv = ((f.vx - r.vx) * dx + (f.vy - r.vy) * dy) * 0.5;
    r.vx += dx * rv; r.vy += dy * rv; f.vx -= dx * rv; f.vy -= dy * rv;
  }

  function physicsSub(dt) {
    const r = bike.r, f = bike.f;
    r.vy += G * dt; f.vy += G * dt;
    let dx = f.x - r.x, dy = f.y - r.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const px = -dy, py = dx, air = !r.c && !f.c;

    const lean = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
    if (lean) {
      const T = (air ? 0.30 : 0.12) * lean * dt;
      f.vx += px * T; f.vy += py * T; r.vx -= px * T; r.vy -= py * T;
    }
    const tang = c => { let tx = Math.cos(c.ang), ty = Math.sin(c.ang); if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; } return [tx, ty]; };
    if (ctl.gas && r.c) {
      const [tx, ty] = tang(r.c), along = r.vx * tx + r.vy * ty;
      const a = 0.65 * clamp(1 - along / MAXV, 0, 1) * dt;
      r.vx += tx * a; r.vy += ty * a;
      const pu = a * 0.22;
      f.vx -= px * pu; f.vy -= py * pu; r.vx += px * pu; r.vy += py * pu;
    }
    if (ctl.brake) {
      [r, f].forEach(w => {
        if (!w.c) return;
        const [tx, ty] = tang(w.c), al = w.vx * tx + w.vy * ty;
        w.vx -= tx * al * 0.06 * dt; w.vy -= ty * al * 0.06 * dt;
      });
      if (r.c) { const [tx, ty] = tang(r.c); if (r.vx * tx + r.vy * ty < 1) { r.vx -= tx * 0.25 * dt; r.vy -= ty * 0.25 * dt; } }
    }
    if (win) { r.vx *= 1 - 0.04 * dt; r.vy *= 1 - 0.02 * dt; f.vx *= 1 - 0.04 * dt; f.vy *= 1 - 0.02 * dt; }

    const vrel = (f.vx - r.vx) * px + (f.vy - r.vy) * py, kd = (air ? 0.09 : 0.015) * dt;
    f.vx -= px * vrel * kd * 0.5; f.vy -= py * vrel * kd * 0.5; r.vx += px * vrel * kd * 0.5; r.vy += py * vrel * kd * 0.5;
    const drag = 1 - (air ? 0.0008 : 0.0015) * dt;
    [r, f].forEach(w => {
      w.vx *= drag; w.vy *= drag;
      const sp = Math.hypot(w.vx, w.vy);
      if (sp > 40) { w.vx *= 40 / sp; w.vy *= 40 / sp; }
      w.x += w.vx * dt; w.y += w.vy * dt;
    });

    r.c = f.c = null;
    for (let it = 0; it < 2; it++) { solveRod(); collide(r); collide(f); }
  }

  function headPos() {
    const c = center(), a = bike.ang, l = bike.lean + 0.35;
    const lx = -10 + Math.sin(l) * 30, ly = -14 - Math.cos(l) * 30;
    return { x: c.x + lx * Math.cos(a) - ly * Math.sin(a), y: c.y + lx * Math.sin(a) + ly * Math.cos(a) };
  }

  function addP(x, y, vx, vy, color, size, life) { if (particles.length < 400) particles.push({ x, y, vx, vy, color, size, life, max: life }); }
  function popup(text) { const c = center(); popups.push({ text, x: c.x, y: c.y - 60, o: 1 }); }

  function crash(eject) {
    if (dead || win) return;
    dead = true; deadT = 0; shakeAmp = 14;
    const c = center(), h = headPos();
    if (eject) rider = { x: h.x, y: h.y, vx: (bike.r.vx + bike.f.vx) / 2 * 0.9 + (Math.random() - 0.5) * 3, vy: Math.min(-3, (bike.r.vy + bike.f.vy) / 2 - 3), rot: bike.ang, vr: (Math.random() - 0.5) * 0.5 };
    for (let i = 0; i < 30; i++) addP(c.x, c.y, (Math.random() - 0.5) * 12, -Math.random() * 8, Math.random() < 0.5 ? '#fbbf24' : '#f97316', 2 + Math.random() * 2, 30 + Math.random() * 20);
  }

  function afterStep() {
    const r = bike.r, f = bike.f, c = center();
    const ang = Math.atan2(f.y - r.y, f.x - r.x);
    let d = ang - bike.ang;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    bike.ang = ang;
    bike.spin += (r.vx * Math.cos(ang) + r.vy * Math.sin(ang)) / WR;
    const grounded = !!(r.c || f.c), th = THEMES[level.theme];
    if (!level.zones.some(z => c.x > z.a - 80 && c.x < z.b + 80)) bike.layer = 0;

    if (!dead) {
      const h = headPos(), hc = closest(h.x, h.y, bike.layer);
      if (hc && hc.dist < 9 && !(hc.loop && hc.layer !== bike.layer)) crash(true);
      if (bike.ang !== undefined && c.y > level.deathY) crash(false);
    }
    if (!grounded) { bike.airRot += d; bike.airT++; }
    else {
      if (bike.airT > 0 && !dead) {
        const flips = Math.round(Math.abs(bike.airRot) / TAU);
        if (Math.abs(bike.airRot) > 5.2 && flips >= 1) {
          const pts = flips * 500; score += pts;
          popup((bike.airRot < 0 ? 'BACKFLIP' : 'FRONTFLIP') + (flips > 1 ? ' x' + flips : '') + ' ! +' + pts);
        } else if (bike.airT > 50) { const pts = Math.round(bike.airT * 2); score += pts; popup('AIR TIME +' + pts); }
      }
      bike.airRot = 0; bike.airT = 0;
      if (r.c && !f.c) bike.wheelie++;
      else { if (bike.wheelie > 45 && !dead) { const pts = bike.wheelie * 2; score += pts; popup('WHEELIE +' + pts); } bike.wheelie = 0; }
    }
    if (bike.impact > 6) {
      shakeAmp = Math.max(shakeAmp, Math.min(10, bike.impact * 0.8));
      for (let i = 0; i < bike.impact; i++) addP(c.x, c.y + WR, (Math.random() - 0.5) * 6, -Math.random() * 3, th.dirt[0], 2 + Math.random() * 2, 25);
    }
    bike.impact = 0;
    if (ctl.gas && r.c && Math.random() < 0.5) addP(r.x, r.y + WR - 2, -r.vx * 0.15 + (Math.random() - 0.5) * 2, -Math.random() * 2.5, th.dirt[0], 2 + Math.random() * 2, 22);
    if (Math.random() < 0.25 && !dead) addP(r.x - Math.cos(ang) * 14, r.y - Math.sin(ang) * 14 - 4, -r.vx * 0.05, -0.3, 'rgba(180,180,180,0.5)', 3, 20);

    if (!win && !dead && c.x >= level.finishX) {
      win = true; winT = 0;
      const bonus = Math.max(0, Math.round((60 - frames / 60) * 20));
      score += 1000 + bonus; popup('ARRIVÉE ! +' + (1000 + bonus));
      for (let i = 0; i < 80; i++) addP(level.finishX + (Math.random() - 0.5) * 200, c.y - 150, (Math.random() - 0.5) * 8, -Math.random() * 6, ['#facc15', '#f43f5e', '#38bdf8', '#4ade80'][i % 4], 3, 90);
    }
  }

  function update() {
    hintT++;
    if (!dead && !win) frames++;
    const live = !dead && !win;
    ctl.gas = live && (!!(keys.ArrowUp || keys.KeyW || keys.KeyZ) || touchCtl.gas);
    ctl.brake = live && (!!(keys.ArrowDown || keys.KeyS) || touchCtl.brake);
    ctl.left = live && (!!(keys.ArrowLeft || keys.KeyA || keys.KeyQ) || touchCtl.left);
    ctl.right = live && (!!(keys.ArrowRight || keys.KeyD) || touchCtl.right);

    for (let i = 0; i < SUB; i++) physicsSub(1 / SUB);
    afterStep();
    bike.lean += ((ctl.right ? 0.55 : 0) - (ctl.left ? 0.55 : 0) + (ctl.gas ? 0.12 : 0) - (ctl.brake ? 0.15 : 0) - bike.lean) * 0.12;

    if (dead) deadT++;
    if (win) winT++;
    if (rider) {
      rider.vy += G; rider.x += rider.vx; rider.y += rider.vy; rider.rot += rider.vr;
      const c = closest(rider.x, rider.y, bike.layer);
      if (c && c.dist < 10) {
        rider.x = c.x + c.nx * 10; rider.y = c.y + c.ny * 10;
        const vn = rider.vx * c.nx + rider.vy * c.ny;
        if (vn < 0) { rider.vx -= 1.3 * vn * c.nx; rider.vy -= 1.3 * vn * c.ny; }
        rider.vx *= 0.92; rider.vr *= 0.9;
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += p.max > 60 ? 0.12 : 0.02; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.y -= 0.8; p.o -= 0.012; if (p.o <= 0) popups.splice(i, 1); }

    const c = center(), sp = speedOf();
    cam.x += (c.x + (bike.r.vx + bike.f.vx) * 6 - cam.x) * 0.1;
    cam.y += (c.y - 20 - cam.y) * 0.08;
    cam.z += (clamp(1.05 - sp * 0.012, 0.62, 1) - cam.z) * 0.04;
    shakeAmp *= 0.9;
    shakeX = (Math.random() - 0.5) * shakeAmp; shakeY = (Math.random() - 0.5) * shakeAmp;
    updateAudio();
  }

  // ================= MOTEUR AUDIO =================
  let audio = null, muted = false;
  function initAudio() {
    if (audio) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC(), o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; flt.type = 'lowpass'; g.gain.value = 0;
      o.connect(flt); flt.connect(g); g.connect(ac.destination); o.start();
      audio = { ac, o, g, flt };
    } catch (e) { audio = null; }
  }

  function resumeAudio() {
    initAudio();
    if (audio && audio.ac.state === 'suspended') audio.ac.resume();
  }

  function updateAudio() {
    if (!audio) return;
    const t = audio.ac.currentTime, sp = speedOf(), th = ctl.gas ? 1 : 0;
    audio.o.frequency.setTargetAtTime(55 + sp * 5 + th * 30, t, 0.05);
    audio.flt.frequency.setTargetAtTime(350 + sp * 25 + th * 300, t, 0.05);
    audio.g.gain.setTargetAtTime(muted || dead ? 0 : 0.025 + th * 0.03, t, 0.05);
  }

  // ================= RENDU DU JEU =================
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function outlined(text, x, y, color, size, align) {
    ctx.font = 'bold ' + size + 'px sans-serif'; ctx.textAlign = align || 'left';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.textAlign = 'left';
  }

  function drawSky(W, H, th) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const t = Date.now() / 1000;
    if (th.stars) stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 2 + s.p)})`; ctx.fillRect(s.x * W, s.y * H, s.r, s.r); });
    const sx = W * 0.78 - cam.x * 0.01, sy = H * 0.2;
    const sg = ctx.createRadialGradient(sx, sy, 5, sx, sy, 90);
    sg.addColorStop(0, th.sun); sg.addColorStop(0.25, th.sun); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.9; ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 90, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (!th.stars) {
      clouds.forEach(c => {
        const span = W + 500, x = ((c.x - cam.x * 0.12 - t * 8) % span + span) % span - 150;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        [[0, 0, 26], [28, -8, 32], [60, 0, 24], [30, 6, 26]].forEach(b => { ctx.beginPath(); ctx.arc(x + b[0] * c.s, c.y + b[1] * c.s, b[2] * c.s, 0, TAU); ctx.fill(); });
      });
    }
    const par = [0.08, 0.16, 0.3], amp = [120, 85, 55];
    for (let i = 0; i < 3; i++) {
      const base = H * 0.66 + i * 38 - (cam.y - 300) * 0.04 * (i + 1);
      ctx.fillStyle = th.hills[i]; ctx.beginPath(); ctx.moveTo(0, H);
      for (let sx2 = 0; sx2 <= W + 20; sx2 += 20) {
        const wx = sx2 + cam.x * par[i];
        ctx.lineTo(sx2, base - amp[i] * (0.5 + 0.5 * Math.sin(wx * 0.004 * (i + 1) + i * 2)) - amp[i] * 0.3 * Math.sin(wx * 0.011 + i));
      }
      ctx.lineTo(W, H); ctx.fill();
    }
  }

  function drawGround(th) {
    const s = level.surface, bottom = level.maxY + 1500;
    const g = ctx.createLinearGradient(0, 250, 0, level.maxY + 700);
    g.addColorStop(0, th.dirt[0]); g.addColorStop(1, th.dirt[1]);
    ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.lineTo(s[s.length - 1].x, bottom); ctx.lineTo(s[0].x, bottom); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save(); ctx.translate(0, 26); ctx.setLineDash([16, 20]); ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y); ctx.stroke(); ctx.restore();
    ctx.setLineDash([]);
    ctx.save(); ctx.translate(0, 5); ctx.strokeStyle = th.grassD; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = th.grass; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y); ctx.stroke();
  }

  function drawDecor(th) {
    const x0 = cam.x - 1200, x1 = cam.x + 1200;
    level.decor.forEach(d => {
      if (d.x < x0 || d.x > x1) return;
      ctx.save(); ctx.translate(d.x, d.y + 3); ctx.scale(d.s, d.s);
      if (d.k > 0.88) { ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.ellipse(0, -6, 16, 11, 0, Math.PI, 0); ctx.fill(); }
      else if (th.decor === 'pine') {
        ctx.fillStyle = '#78350f'; ctx.fillRect(-3, -14, 6, 16);
        for (let i = 0; i < 3; i++) {
          const top = -70 + i * 18, hw = 14 + i * 6;
          ctx.fillStyle = i % 2 ? '#166534' : '#15803d'; ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(-hw, top + 34); ctx.lineTo(hw, top + 34); ctx.fill();
        }
      } else if (th.decor === 'cactus') {
        ctx.fillStyle = '#16a34a'; ctx.fillRect(-5, -48, 10, 48); ctx.fillRect(-17, -30, 12, 5); ctx.fillRect(-17, -40, 5, 15); ctx.fillRect(5, -22, 12, 5); ctx.fillRect(12, -34, 5, 17);
      } else {
        const col = d.k < 0.5 ? '#22d3ee' : '#a78bfa';
        ctx.shadowBlur = 14; ctx.shadowColor = col; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(-10, -10); ctx.lineTo(0, 0); ctx.lineTo(10, -10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(14, -30); ctx.lineTo(8, -4); ctx.lineTo(20, -4); ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.restore();
    });
  }

  function drawLoops(layer, th) {
    level.loopPaths.forEach(lp => {
      if (lp.layer !== layer) return;
      const trace = pts => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); };
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      trace(lp.off); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 34; ctx.stroke();
      trace(lp.off); ctx.strokeStyle = th.road; ctx.lineWidth = 28; ctx.stroke();
      trace(lp.off); ctx.setLineDash([14, 16]); ctx.strokeStyle = 'rgba(250,204,21,0.55)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      trace(lp.pts); ctx.strokeStyle = th.grass; ctx.lineWidth = 4; ctx.stroke();
    });
  }

  function drawFinish() {
    const x = level.finishX, y = level.surfY(x) || 350;
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - 5, y - 280, 8, 280); ctx.fillRect(x + 125, y - 280, 8, 280);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111827' : '#fff'; ctx.fillRect(x + 3 + i * 7.6, y - 280 + j * 12, 7.6, 12); }
    for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#111827' : '#fff'; ctx.fillRect(x + i * 8, y - 3, 8, 6); }
  }

  function drawBike(c, ang, withRider) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(ang);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const wheel = x => {
      ctx.save(); ctx.translate(x, 0);
      ctx.fillStyle = '#0b0f19'; ctx.beginPath(); ctx.arc(0, 0, WR, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(0, 0, WR - 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0, 0, WR - 6, 0, TAU); ctx.fill();
      ctx.rotate(bike.spin); ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < 5; k++) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k * TAU / 5) * (WR - 5), Math.sin(k * TAU / 5) * (WR - 5)); }
      ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
      ctx.restore();
    };
    wheel(-HALF); wheel(HALF);
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-2, 3); ctx.lineTo(-24, 4); ctx.lineTo(-36, -3); ctx.stroke();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-HALF, 0); ctx.lineTo(-4, 1); ctx.stroke();
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(HALF, 0); ctx.lineTo(HALF - 11, -25); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(HALF - 11, -25); ctx.lineTo(HALF - 17, -28); ctx.stroke();
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(HALF, 0, WR + 3, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
    ctx.fillStyle = '#374151'; rr(-14, -8, 24, 15, 4); ctx.fill();
    ctx.fillStyle = '#4b5563'; ctx.fillRect(-9, -3, 14, 4);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(-4, -13); ctx.lineTo(14, -18); ctx.lineTo(21, -11); ctx.lineTo(6, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(-32, -8); ctx.lineTo(-18, -15); ctx.lineTo(-4, -13); ctx.lineTo(-6, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111827'; rr(-24, -15, 22, 5, 2); ctx.fill();
    ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(HALF - 7, -21, 4, 0, TAU); ctx.fill();
    if (withRider) {
      const l = bike.lean + 0.35, hip = { x: -10, y: -14 };
      const sh = { x: hip.x + Math.sin(l) * 20, y: hip.y - Math.cos(l) * 20 };
      const hd = { x: hip.x + Math.sin(l) * 30, y: hip.y - Math.cos(l) * 30 };
      ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(6, -4); ctx.lineTo(-2, 5); ctx.stroke();
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(3, 5); ctx.stroke();
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(sh.x, sh.y); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo((sh.x + HALF - 17) / 2 + 2, (sh.y - 27) / 2 + 5); ctx.lineTo(HALF - 17, -27); ctx.stroke();
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(hd.x, hd.y, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(hd.x + 3, hd.y + 1, 5, -0.9, 0.9); ctx.lineTo(hd.x + 3, hd.y + 1); ctx.fill();
    }
    ctx.restore();
  }

  function drawRider() {
    ctx.save(); ctx.translate(rider.x, rider.y); ctx.rotate(rider.rot);
    ctx.lineCap = 'round';
    const w = Math.sin(frames * 0.3 + deadT * 0.3) * 0.5;
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-12, -2 + w * 8); ctx.moveTo(0, -6); ctx.lineTo(12, -2 - w * 8); ctx.stroke();
    ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-8, 20 + w * 4); ctx.moveTo(0, 8); ctx.lineTo(8, 20 - w * 4); ctx.stroke();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, -16, 8, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ================= BOUTONS & INTERFACE =================
  function getTouchButtons(W, H) {
    const btnSize = Math.min(80, W * 0.13);
    const margin = 15;
    const bY = H - btnSize - margin;
    return {
      left: { x: margin, y: bY, w: btnSize, h: btnSize, label: '←', pressed: ctl.left },
      right: { x: margin + btnSize + 12, y: bY, w: btnSize, h: btnSize, label: '→', pressed: ctl.right },
      brake: { x: W - margin - btnSize * 2 - 12, y: bY, w: btnSize, h: btnSize, label: 'FREIN', pressed: ctl.brake, fontSize: 15 },
      gas: { x: W - margin - btnSize, y: bY, w: btnSize, h: btnSize, label: 'GAZ', pressed: ctl.gas, fontSize: 18 }
    };
  }

  function getTopButtons() {
    return {
      r: { x: 315, y: 12, w: 45, h: 40, label: '🔄', fontSize: 18 },
      n: { x: 368, y: 12, w: 45, h: 40, label: '🔀', fontSize: 18 },
      m: { x: 421, y: 12, w: 45, h: 40, label: muted ? '🔇' : '🔊', fontSize: 18 }
    };
  }

  function drawTouchBtn(btn, defaultColor) {
    ctx.save();
    ctx.fillStyle = btn.pressed ? 'rgba(250, 204, 21, 0.75)' : 'rgba(15, 23, 42, 0.6)';
    ctx.strokeStyle = btn.pressed ? '#facc15' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    rr(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fill();
    ctx.stroke();
    outlined(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + (btn.fontSize > 16 ? 6 : 5), btn.pressed ? '#000' : (defaultColor || '#fff'), btn.fontSize || 24, 'center');
    ctx.restore();
  }

  function drawHUD(W, H) {
    const sp = speedOf(), kmh = Math.round(sp * 7);
    ctx.fillStyle = 'rgba(15,23,42,0.6)'; rr(12, 12, 290, 92, 12); ctx.fill();
    outlined(level.name, 24, 38, '#fff', 16);
    outlined('SCORE : ' + score, 24, 62, '#facc15', 18);
    outlined('TEMPS : ' + (frames / 60).toFixed(1) + ' s', 24, 88, '#e2e8f0', 15);
    const bw = Math.min(360, W * 0.4), bx = W / 2 - bw / 2;
    ctx.fillStyle = 'rgba(15,23,42,0.6)'; rr(bx, 14, bw, 12, 6); ctx.fill();
    ctx.fillStyle = '#4ade80'; rr(bx, 14, Math.max(12, bw * clamp(center().x / level.finishX, 0, 1)), 12, 6); ctx.fill();
    const gx = W - 90, gy = 96;
    ctx.fillStyle = 'rgba(15,23,42,0.6)'; ctx.beginPath(); ctx.arc(gx, gy, 70, 0, TAU); ctx.fill();
    ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(gx, gy, 54, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    ctx.strokeStyle = sp > 24 ? '#ef4444' : sp > 14 ? '#facc15' : '#4ade80';
    ctx.beginPath(); ctx.arc(gx, gy, 54, Math.PI * 0.8, Math.PI * 0.8 + Math.PI * 1.4 * clamp(sp / MAXV, 0, 1)); ctx.stroke();
    outlined(String(kmh), gx, gy + 10, '#fff', 30, 'center'); outlined('km/h', gx, gy + 32, '#cbd5e1', 12, 'center');

    const btns = getTouchButtons(W, H);
    drawTouchBtn(btns.left);
    drawTouchBtn(btns.right);
    drawTouchBtn(btns.brake, '#f87171');
    drawTouchBtn(btns.gas, '#4ade80');

    const topBtns = getTopButtons();
    drawTouchBtn(topBtns.r);
    drawTouchBtn(topBtns.n);
    drawTouchBtn(topBtns.m);

    if (hintT < 480 && !dead && !win) {
      ctx.fillStyle = 'rgba(15,23,42,0.7)'; rr(W / 2 - 270, H - 60, 540, 40, 10); ctx.fill();
      outlined('Tactile : Boutons écran • Clavier : Flèches/ZQSD • R/N/M', W / 2, H - 34, '#fff', 13, 'center');
    }
    const over = (a, title, color, sub) => {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.72 * a) + ')'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = a;
      outlined(title, W / 2, H / 2 - 20, color, 46, 'center'); outlined(sub, W / 2, H / 2 + 28, '#fff', 20, 'center');
      outlined('Score : ' + score, W / 2, H / 2 + 62, '#facc15', 20, 'center'); ctx.globalAlpha = 1;
    };
    if (dead && deadT > 30) over(clamp((deadT - 30) / 30, 0, 1), 'CRASH !', '#ef4444', 'Touche l\'écran ou R pour recommencer');
    if (win && winT > 40) over(clamp((winT - 40) / 30, 0, 1), 'NIVEAU TERMINÉ !', '#4ade80', levelIdx < 2 ? 'Touche l\'écran pour le niveau suivant' : 'Touche l\'écran pour une nouvelle piste');
  }

  function render() {
    const W = canvas.width, H = canvas.height, th = THEMES[level.theme];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawSky(W, H, th);
    ctx.save();
    ctx.translate(W * 0.38 + shakeX, H * 0.6 + shakeY); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    drawGround(th); drawDecor(th); drawLoops(0, th); drawFinish();
    particles.forEach(p => { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); });
    ctx.globalAlpha = 1;
    const c = center();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + WR + 3, 40, 4, 0, 0, TAU); ctx.fill();
    drawBike(c, bike.ang, !rider);
    if (rider) drawRider();
    drawLoops(1, th);
    popups.forEach(p => { ctx.globalAlpha = clamp(p.o, 0, 1); outlined(p.text, p.x, p.y, '#facc15', 22, 'center'); });
    ctx.globalAlpha = 1;
    ctx.restore();
    drawHUD(W, H);
  }

  // ================= ENTRÉES SOURIS, TACTILES & CLAVIER =================
  function handleCanvasClick(x, y) {
    resumeAudio();
    if (dead && deadT > 30) { loadLevel(level, levelIdx); return true; }
    if (win && winT > 40) { nextLevel(); return true; }

    const topBtns = getTopButtons();
    if (x >= topBtns.r.x && x <= topBtns.r.x + topBtns.r.w && y >= topBtns.r.y && y <= topBtns.r.y + topBtns.r.h) {
      if (win) nextLevel(); else loadLevel(level, levelIdx);
      return true;
    }
    if (x >= topBtns.n.x && x <= topBtns.n.x + topBtns.n.w && y >= topBtns.n.y && y <= topBtns.n.y + topBtns.n.h) {
      newRandom();
      return true;
    }
    if (x >= topBtns.m.x && x <= topBtns.m.x + topBtns.m.w && y >= topBtns.m.y && y <= topBtns.m.y + topBtns.m.h) {
      muted = !muted;
      return true;
    }
    return false;
  }

  function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    handleCanvasClick(clickX, clickY);
  }

  function updateTouchControls(e) {
    touchCtl.gas = touchCtl.brake = touchCtl.left = touchCtl.right = false;
    if (!e || !e.touches) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const W = canvas.width, H = canvas.height;
    const btns = getTouchButtons(W, H);

    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      const tx = (t.clientX - rect.left) * scaleX;
      const ty = (t.clientY - rect.top) * scaleY;

      if (tx >= btns.left.x && tx <= btns.left.x + btns.left.w && ty >= btns.left.y && ty <= btns.left.y + btns.left.h) touchCtl.left = true;
      if (tx >= btns.right.x && tx <= btns.right.x + btns.right.w && ty >= btns.right.y && ty <= btns.right.y + btns.right.h) touchCtl.right = true;
      if (tx >= btns.brake.x && tx <= btns.brake.x + btns.brake.w && ty >= btns.brake.y && ty <= btns.brake.y + btns.brake.h) touchCtl.brake = true;
      if (tx >= btns.gas.x && tx <= btns.gas.x + btns.gas.w && ty >= btns.gas.y && ty <= btns.gas.y + btns.gas.h) touchCtl.gas = true;
    }
  }

  function onTouchStart(e) {
    if (e.cancelable) e.preventDefault();
    resumeAudio();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const tx = (t.clientX - rect.left) * scaleX;
      const ty = (t.clientY - rect.top) * scaleY;
      if (handleCanvasClick(tx, ty)) return;
    }
    updateTouchControls(e);
  }

  function onTouchMove(e) { if (e.cancelable) e.preventDefault(); updateTouchControls(e); }
  function onTouchEnd(e) { if (e.cancelable) e.preventDefault(); updateTouchControls(e); }

  const prevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  function onKeyDown(e) {
    if (prevent.indexOf(e.code) >= 0 && e.preventDefault) e.preventDefault();
    keys[e.code] = true;
    resumeAudio();
    if (e.code === 'KeyR') { if (win) nextLevel(); else loadLevel(level, levelIdx); }
    if (e.code === 'KeyN') newRandom();
    if (e.code === 'KeyM') muted = !muted;
  }

  function onKeyUp(e) { keys[e.code] = false; }
  function onBlur() { for (let k in keys) keys[k] = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // ================= BOUCLE PRINCIPALE =================
  let raf = 0, last = null, acc = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (last === null) last = now;
    acc += Math.min(100, now - last);
    last = now;
    let n = 0;
    while (acc >= 1000 / 60 && n < 5) { update(); acc -= 1000 / 60; n++; }
    if (n === 5) acc = 0;
    render();
  }

  window.__motoStop = function () {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
    if (audio) { try { audio.ac.close(); } catch (e) { } audio = null; }
    window.__motoStop = null;
  };

  window.__motoDebug = () => ({ bike, dead, win, level, score, frames, load: i => { i < 3 ? loadLevel(levels[i], i) : newRandom(); } });

  loadLevel(levels[0], 0);
  raf = requestAnimationFrame(loop);
};