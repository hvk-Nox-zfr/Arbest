/* ============================================================
   ARBEST CITY — mini GTA 3D en monde ouvert (Three.js r128)
   Fichier : js/games/gta.js   |   Init : startGTAGame()
   ============================================================ */
function startGTAGame() {
  'use strict';
  if (typeof THREE === 'undefined') { console.error('[GTA] Three.js manquant'); return; }
  if (typeof window._gtaCleanup === 'function') window._gtaCleanup();

  // ---------- Helpers ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const R = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  let seed = 20261017;
  const wr = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hex2rgb = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const snd = (f, d, t) => { try { if (typeof playSound === 'function') playSound(f, d, t); } catch (e) {} };
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  const disposables = [];

  // ---------- Canvas neuf (un canvas WebGL ne peut pas redevenir 2D) ----------
  const oldCanvas = document.getElementById('game-canvas');
  const container = oldCanvas.parentElement;
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas'; canvas.width = 960; canvas.height = 540;
  container.replaceChild(canvas, oldCanvas);
  container.style.maxWidth = '960px';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(960, 540, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 960 / 540, 0.8, 800);
  const skyCol = new THREE.Color(0x87c3ff);
  scene.background = skyCol;
  scene.fog = new THREE.Fog(0x87c3ff, 90, 430);
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x556655, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(120, 200, 80); scene.add(sun);

  // ---------- Batch de géométrie : tout dans un seul mesh ----------
  const TILE = 16;
  function Batch() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; }
  Batch.prototype.quad = function (v, n, rgb, uv) {
    const o = this.p.length / 3;
    for (let k = 0; k < 4; k++) {
      this.p.push(v[k][0], v[k][1], v[k][2]);
      this.n.push(n[0], n[1], n[2]);
      this.c.push(rgb[0], rgb[1], rgb[2]);
      this.u.push(uv[k][0], uv[k][1]);
    }
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const ZUV = [[0, 0], [0, 0], [0, 0], [0, 0]];
  Batch.prototype.box = function (cx, cy, cz, sx, sy, sz, color, tile, uo, vo) {
    const base = Array.isArray(color) ? color : hex2rgb(color);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const F = [
      [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], sz, sy],
      [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], sz, sy],
      [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], sx, sz],
      [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], sx, sz],
      [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], sx, sy],
      [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], sx, sy]
    ];
    for (const f of F) {
      const n = f[0];
      const v = f[1].map(a => [a[0] + cx, a[1] + cy, a[2] + cz]);
      const sh = n[1] === 1 ? 0.7 : n[1] === -1 ? 0.4 : 1;
      const col = tile ? [base[0] * sh, base[1] * sh, base[2] * sh] : base;
      let uv = ZUV;
      if (tile && n[1] === 0) { const a = f[2] / TILE, b = f[3] / TILE; uv = [[uo, vo], [uo + a, vo], [uo + a, vo + b], [uo, vo + b]]; }
      this.quad(v, n, col, uv);
    }
  };
  Batch.prototype.flat = function (cx, cy, cz, sx, sz, color) {
    const c = Array.isArray(color) ? color : hex2rgb(color);
    const hx = sx / 2, hz = sz / 2;
    this.quad([[cx - hx, cy, cz + hz], [cx + hx, cy, cz + hz], [cx + hx, cy, cz - hz], [cx - hx, cy, cz - hz]], [0, 1, 0], c, ZUV);
  };
  Batch.prototype.mesh = function (mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    disposables.push(g);
    return new THREE.Mesh(g, mat);
  };

  // ---------- Textures de fenêtres ----------
  function winTex(emissive) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = emissive ? '#000' : '#e9ebef'; g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const lit = ((r * 31 + c * 17 + r * c * 7) % 5) < 2;
      if (emissive) { if (lit) { g.fillStyle = '#ffd27a'; g.fillRect(c * 64 + 14, r * 64 + 14, 36, 36); } }
      else { g.fillStyle = lit ? '#6f8fae' : '#3a5472'; g.fillRect(c * 64 + 14, r * 64 + 14, 36, 36); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(c * 64 + 14, r * 64 + 14, 36, 10); }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    disposables.push(t);
    return t;
  }
  const bMat = new THREE.MeshLambertMaterial({ map: winTex(false), emissiveMap: winTex(true), emissive: 0x000000, vertexColors: true });
  const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  disposables.push(bMat, plainMat, roadMat);

  // ---------- Dimensions de la ville ----------
  const N = 8, BLOCK = 64, ROAD = 18, PITCH = BLOCK + ROAD;
  const HALF = N * PITCH / 2, LIM = HALF + 40;
  const lineC = k => (k - N / 2) * PITCH;
  const blockC = k => (k + 0.5 - N / 2) * PITCH;
  const cellOf = v => Math.floor((v + HALF) / PITCH);
  const cells = Array.from({ length: N * N }, () => []);
  const markers = [];
  const labels = [];

  function addRect(x0, x1, z0, z1, h) {
    const ci = cellOf((x0 + x1) / 2), cj = cellOf((z0 + z1) / 2);
    if (ci < 0 || ci >= N || cj < 0 || cj >= N) return;
    cells[ci * N + cj].push({ x0, x1, z0, z1, h });
  }

  const bB = new Batch(), pB = new Batch(), rB = new Batch();
  const BCOLS = [0xffffff, 0xf1e3c8, 0xcfe0f5, 0xf3d6d6, 0xd9d9d9, 0xbfd3c1, 0xe6d3f0, 0xa9b9cc];
  const ASPH = 0x2b2d33, SIDEW = 0x9a9a96, GRASS = 0x4f8a3c;

  function addLot(x0, x1, z0, z1, h, color) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = x1 - x0, sz = z1 - z0;
    bB.box(cx, h / 2 + 0.18, cz, sx, h, sz, color, true, Math.floor(wr() * 4) / 4, Math.floor(wr() * 4) / 4);
    addRect(x0, x1, z0, z1, h);
    if (h > 14 && wr() < 0.6) pB.box(cx + (wr() - 0.5) * sx * 0.4, h + 1.2, cz + (wr() - 0.5) * sz * 0.4, 4, 2, 4, 0x555a60);
  }

  function fillRegion(bi, bj, x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0, g = 3, m = wr(), L = [];
    if (w < 8 || d < 8) return;
    if (m < 0.3) L.push([x0, x1, z0, z1]);
    else if (m < 0.58) { const a = x0 + w * (0.35 + wr() * 0.3); L.push([x0, a - g / 2, z0, z1], [a + g / 2, x1, z0, z1]); }
    else if (m < 0.82) { const a = z0 + d * (0.35 + wr() * 0.3); L.push([x0, x1, z0, a - g / 2], [x0, x1, a + g / 2, z1]); }
    else { const ax = x0 + w * 0.5, az = z0 + d * 0.5; L.push([x0, ax - g / 2, z0, az - g / 2], [ax + g / 2, x1, z0, az - g / 2], [x0, ax - g / 2, az + g / 2, z1], [ax + g / 2, x1, az + g / 2, z1]); }
    const dc = Math.hypot(bi - 3.5, bj - 3.5);
    for (const l of L) {
      const h = Math.max(9, 11 + wr() * 20 + Math.max(0, 4.6 - dc) * 8 + (wr() < 0.12 ? 25 : 0));
      addLot(l[0], l[1], l[2], l[3], h, BCOLS[(wr() * BCOLS.length) | 0]);
    }
  }

  function makeLabel(text, color, w) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(4, 4, 504, 120);
    g.fillStyle = '#fff'; g.font = 'bold 60px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(w, w / 4, 1);
    disposables.push(tex, sp.material);
    return sp;
  }
  function addLabel(x, y, z, text, color, w) { const s = makeLabel(text, color, w); s.position.set(x, y, z); scene.add(s); labels.push(s); }

  function addMarker(o) {
    const m = Object.assign({ cool: 0, r: 3.4 }, o);
    const ring = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.5, m.r, 40), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, 0.32, m.z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(m.r * 0.85, m.r * 0.85, 16, 20, 1, true), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(m.x, 8, m.z);
    scene.add(ring); scene.add(beam);
    m.ring = ring; m.beam = beam;
    disposables.push(ring.geometry, ring.material, beam.geometry, beam.material);
    markers.push(m);
    return m;
  }

  // ---------- Construction du monde ----------
  const SPECIAL = {
    '4,4': 'bank', '6,1': 'police', '1,6': 'hospital', '2,3': 'gun',
    '1,1': 'store0', '6,3': 'store1', '5,6': 'store2', '3,6': 'jewel',
    '3,3': 'park', '5,2': 'park', '2,5': 'park', '6,6': 'park', '7,4': 'park', '0,3': 'park', '4,0': 'park'
  };
  const HEISTS = {
    store0: { name: 'SUPÉRETTE', col: 0x2ecc71, min: 300, max: 900, dur: 6, heat: 34, roof: 0x3fa35c },
    store1: { name: 'STATION SERVICE', col: 0xe67e22, min: 400, max: 1100, dur: 7, heat: 36, roof: 0xd9822b },
    store2: { name: 'SUPÉRETTE', col: 0x3498db, min: 300, max: 900, dur: 6, heat: 34, roof: 0x3a86c8 },
    jewel: { name: 'BIJOUTERIE', col: 0xb86bff, min: 1800, max: 3600, dur: 9, heat: 55, roof: 0x6b3fa0 },
    bank: { name: 'BANQUE', col: 0x2ecc71, min: 7000, max: 13000, dur: 14, heat: 95, roof: 0xefe3c9 }
  };
  let respawnHosp = { x: 0, z: 0 }, respawnPolice = { x: 0, z: 0 }, spawnPt = { x: 0, z: 0 };

  function buildBlock(bi, bj) {
    const bx = blockC(bi), bz = blockC(bj), t = SPECIAL[bi + ',' + bj] || 'std';
    pB.box(bx, 0.09, bz, BLOCK, 0.18, BLOCK, SIDEW);
    if (t === 'std') { fillRegion(bi, bj, bx - 27, bx + 27, bz - 27, bz + 27); return; }
    if (t === 'park') {
      pB.flat(bx, 0.19, bz, 56, 56, GRASS);
      for (let k = 0; k < 18; k++) {
        const tx = bx + (wr() - 0.5) * 50, tz = bz + (wr() - 0.5) * 50, s = 0.8 + wr() * 0.6;
        pB.box(tx, 1.7, tz, 0.7, 3, 0.7, 0x6b4a2f);
        pB.box(tx, 4.6, tz, 4 * s, 3.2 * s, 4 * s, wr() < 0.5 ? 0x2f7d32 : 0x3f9a3a);
        pB.box(tx, 6.6, tz, 2.4 * s, 1.8 * s, 2.4 * s, 0x2a6e2c);
        addRect(tx - 0.7, tx + 0.7, tz - 0.7, tz + 0.7, 3);
      }
      return;
    }
    const front = (x0, x1, z0, z1, h, color) => addLot(x0, x1, z0, z1, h, color);
    const hz = HEISTS[t];
    if (t === 'bank') {
      front(bx - 27, bx + 27, bz - 27, bz + 24, 26, 0xefe3c9);
      for (let k = -2; k <= 2; k++) { pB.box(bx + k * 10, 8, bz + 25.5, 1.8, 15.6, 1.8, 0xffffff); addRect(bx + k * 10 - 0.9, bx + k * 10 + 0.9, bz + 24.6, bz + 26.4, 15); }
      pB.box(bx, 16.4, bz + 25, 50, 1, 3.6, 0xdcd2b8);
      addLabel(bx, 21, bz + 26.5, 'BANQUE ARBEST', '#2ecc71', 22);
      addMarker({ type: 'heist', key: 'bank', x: bx, z: bz + 30, color: 0x2ecc71, name: hz.name });
    } else if (hz) {
      fillRegion(bi, bj, bx - 27, bx + 27, bz - 27, bz - 2);
      front(bx - 24, bx + 24, bz + 1, bz + 25, 9, hz.roof);
      pB.box(bx, 9.5, bz + 25.8, 49, 0.6, 1.6, 0x222222);
      addLabel(bx, 13, bz + 26.5, hz.name, '#' + hz.col.toString(16).padStart(6, '0'), 16);
      addMarker({ type: 'heist', key: t, x: bx, z: bz + 30, color: hz.col, name: hz.name });
    } else if (t === 'gun') {
      fillRegion(bi, bj, bx - 27, bx + 27, bz - 27, bz - 2);
      front(bx - 18, bx + 18, bz + 1, bz + 25, 8, 0x6a2424);
      addLabel(bx, 12, bz + 26.5, 'ARMURERIE', '#ff5533', 15);
      addMarker({ type: 'shop', x: bx, z: bz + 30, color: 0xff5533, name: 'ARMURERIE' });
    } else if (t === 'hospital') {
      fillRegion(bi, bj, bx - 27, bx + 27, bz - 27, bz - 2);
      front(bx - 27, bx + 27, bz + 1, bz + 25, 20, 0xffffff);
      pB.box(bx, 21, bz + 13, 12, 0.5, 3, 0xe53935); pB.box(bx, 21, bz + 13, 3, 0.5, 12, 0xe53935);
      addLabel(bx, 24, bz + 26.5, 'HÔPITAL', '#ff4d4d', 16);
      addMarker({ type: 'hospital', x: bx, z: bz + 30, color: 0xff4d4d, name: 'HÔPITAL' });
      respawnHosp = { x: bx, z: bz + 34 };
    } else if (t === 'police') {
      fillRegion(bi, bj, bx - 27, bx + 27, bz - 27, bz - 2);
      front(bx - 27, bx + 27, bz + 1, bz + 25, 14, 0x3b5fa0);
      pB.box(bx, 14.6, bz + 13, 54, 0.4, 3, 0x1d2b4a);
      addLabel(bx, 18, bz + 26.5, 'POLICE', '#4da3ff', 14);
      addMarker({ type: 'police', x: bx, z: bz + 30, color: 0x4da3ff, name: 'POLICE' });
      respawnPolice = { x: bx, z: bz + 34 };
    }
  }

  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) buildBlock(bi, bj);
  spawnPt = { x: blockC(3) + 30, z: blockC(3) - 6 };

  // Routes + marquages
  const nearInt = v => { const m = (((v + HALF) % PITCH) + PITCH) % PITCH; return m < ROAD / 2 + 1 || m > PITCH - ROAD / 2 - 1; };
  for (let k = 0; k <= N; k++) {
    const c = lineC(k);
    rB.flat(0, 0.06, c, 2 * HALF + ROAD, ROAD, ASPH);
    rB.flat(c, 0.06, 0, ROAD, 2 * HALF + ROAD, ASPH);
    for (let x = -HALF + 4; x < HALF; x += 8) {
      if (nearInt(x)) continue;
      rB.flat(x, 0.09, c, 3.5, 0.25, 0xe8c200);
      rB.flat(c, 0.09, x, 0.25, 3.5, 0xe8c200);
    }
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const cx = lineC(i), cz = lineC(j), o = ROAD / 2 + 2;
    for (let s = -7.5; s <= 7.5; s += 1.7) {
      if (i < N) rB.flat(cx + o, 0.09, cz + s, 2.2, 0.8, 0xf2f2f2);
      if (i > 0) rB.flat(cx - o, 0.09, cz + s, 2.2, 0.8, 0xf2f2f2);
      if (j < N) rB.flat(cx + s, 0.09, cz + o, 0.8, 2.2, 0xf2f2f2);
      if (j > 0) rB.flat(cx + s, 0.09, cz - o, 0.8, 2.2, 0xf2f2f2);
    }
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * LIM + 60, 2 * LIM + 60), new THREE.MeshLambertMaterial({ color: 0x4d7f3d }));
  ground.rotation.x = -Math.PI / 2;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x1d5a86 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.8;
  disposables.push(ground.geometry, ground.material, sea.geometry, sea.material);
  scene.add(ground); scene.add(sea);
  scene.add(bB.mesh(bMat)); scene.add(pB.mesh(plainMat)); scene.add(rB.mesh(roadMat));

  // ---------- Collisions statiques ----------
  function pushCircle(x, z, r) {
    const ci = cellOf(x), cj = cellOf(z);
    if (ci < 0 || ci >= N || cj < 0 || cj >= N) return null;
    let ox = 0, oz = 0, hit = false;
    for (const q of cells[ci * N + cj]) {
      const px = clamp(x, q.x0, q.x1), pz = clamp(z, q.z0, q.z1);
      const dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2), pen = r - d; ox += dx / d * pen; oz += dz / d * pen; }
        else {
          const l = x - q.x0, rr = q.x1 - x, t = z - q.z0, b = q.z1 - z, m = Math.min(l, rr, t, b);
          if (m === l) ox -= l + r; else if (m === rr) ox += rr + r; else if (m === t) oz -= t + r; else oz += b + r;
        }
        hit = true;
      }
    }
    return hit ? [ox, oz] : null;
  }
  function groundY(x, z) {
    const ci = cellOf(x), cj = cellOf(z);
    if (ci < 0 || ci >= N || cj < 0 || cj >= N) return 0;
    return (Math.abs(x - blockC(ci)) < 32 && Math.abs(z - blockC(cj)) < 32) ? 0.18 : 0;
  }
  function camBlocked(x, y, z) {
    const ci = cellOf(x), cj = cellOf(z);
    if (ci < 0 || ci >= N || cj < 0 || cj >= N) return false;
    for (const q of cells[ci * N + cj]) if (y < q.h + 0.3 && x > q.x0 - 0.5 && x < q.x1 + 0.5 && z > q.z0 - 0.5 && z < q.z1 + 0.5) return true;
    return false;
  }

  // ---------- Matériaux / géométries partagés ----------
  const matCache = {};
  const mat = h => { if (!matCache[h]) { matCache[h] = new THREE.MeshLambertMaterial({ color: h }); disposables.push(matCache[h]); } return matCache[h]; };
  const wreckMat = mat(0x1b1b1b);
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const barGeo = new THREE.BoxGeometry(0.5, 0.18, 0.35);
  const PG = {
    leg: new THREE.BoxGeometry(0.26, 0.8, 0.28).translate(0, -0.4, 0),
    arm: new THREE.BoxGeometry(0.2, 0.7, 0.2).translate(0, -0.35, 0),
    torso: new THREE.BoxGeometry(0.58, 0.72, 0.34),
    head: new THREE.BoxGeometry(0.32, 0.34, 0.32),
    hat: new THREE.BoxGeometry(0.38, 0.12, 0.38),
    gun: new THREE.BoxGeometry(0.1, 0.14, 0.42)
  };
  disposables.push(shadowGeo, shadowMat, barGeo, PG.leg, PG.arm, PG.torso, PG.head, PG.hat, PG.gun);
  function makeShadow(w, l) { const s = new THREE.Mesh(shadowGeo, shadowMat); s.rotation.x = -Math.PI / 2; s.scale.set(w, l, 1); s.position.y = 0.22; return s; }

  // ---------- Voitures ----------
  const STYLES = {
    sedan: { L: 4.5, W: 1.9, bh: 0.72, ch: 0.62, cl: 2.4, co: -0.2, vmax: 34, acc: 15, cols: [0xc0392b, 0x2c5fa8, 0x2e8b57, 0xd0d0d0, 0x222222, 0x8e44ad, 0xe08a1e] },
    sport: { L: 4.3, W: 1.95, bh: 0.55, ch: 0.5, cl: 1.9, co: -0.25, vmax: 47, acc: 24, cols: [0xff3b30, 0xffd60a, 0x0a84ff, 0x151515, 0xff9f0a] },
    suv: { L: 4.7, W: 2.05, bh: 0.95, ch: 0.7, cl: 2.8, co: -0.3, vmax: 30, acc: 13, cols: [0x3a3f47, 0x6b4a2f, 0xd8d8d8, 0x1d3b2a] },
    van: { L: 5.2, W: 2.1, bh: 1.25, ch: 0.85, cl: 3.6, co: -0.5, vmax: 26, acc: 10, cols: [0xf0f0f0, 0x3b6ea8, 0xa83232] },
    taxi: { L: 4.5, W: 1.9, bh: 0.72, ch: 0.62, cl: 2.4, co: -0.2, vmax: 31, acc: 15, cols: [0xffcc00] },
    police: { L: 4.6, W: 1.95, bh: 0.72, ch: 0.62, cl: 2.4, co: -0.2, vmax: 36, acc: 19, cols: [0xf4f4f4] }
  };
  const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'suv', 'van', 'taxi', 'sport'];
  const shade = (c, k) => { const a = hex2rgb(c); return [clamp(a[0] * k, 0, 1), clamp(a[1] * k, 0, 1), clamp(a[2] * k, 0, 1)]; };

  function buildCar(st, color, kind) {
    const B = new Batch(), L = st.L, W = st.W, y0 = 0.32;
    B.box(0, y0 + st.bh / 2, 0, W, st.bh, L - 0.1, color);
    B.box(0, y0 + st.bh + st.ch / 2, st.co, W - 0.18, st.ch, st.cl, 0x1c2b38);
    B.box(0, y0 + st.bh + st.ch + 0.04, st.co, W - 0.22, 0.08, st.cl + 0.12, shade(color, 1.12));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(sx * (W / 2 - 0.12), 0.36, sz * L * 0.31, 0.3, 0.72, 0.72, 0x111111);
    for (const sx of [-1, 1]) {
      B.box(sx * (W / 2 - 0.4), y0 + st.bh * 0.55, L / 2 - 0.02, 0.5, 0.2, 0.08, 0xfff3b0);
      B.box(sx * (W / 2 - 0.4), y0 + st.bh * 0.55, -L / 2 + 0.02, 0.5, 0.2, 0.08, 0xe02020);
    }
    if (kind === 'police') B.box(0, y0 + 0.3, 0, W + 0.03, 0.22, L * 0.5, 0x15181d);
    if (kind === 'taxi') B.box(0, y0 + st.bh + st.ch + 0.28, st.co, 0.7, 0.22, 0.35, 0xfff2a0);
    const g = new THREE.Group();
    const m = B.mesh(plainMat);
    g.add(m);
    g.add(makeShadow(W * 1.25, L * 1.15));
    let bars = null;
    if (kind === 'police') {
      const mr = new THREE.MeshBasicMaterial({ color: 0xff2222 }), mb = new THREE.MeshBasicMaterial({ color: 0x2266ff });
      disposables.push(mr, mb);
      const yb = y0 + st.bh + st.ch + 0.18;
      const a = new THREE.Mesh(barGeo, mr), b = new THREE.Mesh(barGeo, mb);
      a.position.set(-0.28, yb, st.co); b.position.set(0.28, yb, st.co);
      g.add(a); g.add(b);
      bars = { a, b, mr, mb };
    }
    return { g, m, bars };
  }

  const cars = [];
  let carId = 0;
  function makeCar(styleKey, x, z, ang, kind) {
    const st = STYLES[styleKey];
    const color = pick(st.cols);
    const b = buildCar(st, color, styleKey);
    b.g.position.set(x, 0, z); b.g.rotation.y = ang;
    scene.add(b.g);
    const c = { id: ++carId, sk: styleKey, st, g: b.g, mesh: b.m, bars: b.bars, x, z, ang, speed: 0, hp: styleKey === 'van' ? 130 : 100, kind, ai: null, stuck: 0, cruise: R(9, 14), copSpeed: 26, direct: false, noDirect: 0, revT: 0, wreckT: 0, hitCd: 0, lastBlink: 0, deploy: 0, smokeT: 0 };
    cars.push(c);
    return c;
  }
  function carCircles(c) {
    const off = c.st.L / 2 - c.st.W / 2 - 0.1, s = Math.sin(c.ang), co = Math.cos(c.ang), r = c.st.W / 2 + 0.12;
    return [{ x: c.x + s * off, z: c.z + co * off, r }, { x: c.x - s * off, z: c.z - co * off, r }];
  }
  function removeCar(c) {
    scene.remove(c.g);
    const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1);
  }

  // ---------- Piétons / policiers à pied ----------
  const peds = [];
  const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0xe67e22, 0x16a085, 0xff7ab8];
  const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x1b1b1b, 0x607d8b];
  const SKINS = [0xf3c9a5, 0xd9a577, 0x9c6b46, 0x6e4a31, 0xffdbb4];
  function buildHuman(shirt, pants, skin, hat, gun) {
    const g = new THREE.Group();
    const legL = new THREE.Mesh(PG.leg, mat(pants)), legR = new THREE.Mesh(PG.leg, mat(pants));
    legL.position.set(-0.15, 0.8, 0); legR.position.set(0.15, 0.8, 0);
    const torso = new THREE.Mesh(PG.torso, mat(shirt)); torso.position.y = 1.16;
    const head = new THREE.Mesh(PG.head, mat(skin)); head.position.y = 1.7;
    const armL = new THREE.Mesh(PG.arm, mat(shirt)), armR = new THREE.Mesh(PG.arm, mat(shirt));
    armL.position.set(-0.4, 1.5, 0); armR.position.set(0.4, 1.5, 0);
    const gm = new THREE.Mesh(PG.gun, mat(0x111111)); gm.position.set(0, -0.62, 0.22); gm.visible = !!gun; armR.add(gm);
    g.add(legL); g.add(legR); g.add(torso); g.add(head); g.add(armL); g.add(armR);
    if (hat) { const h = new THREE.Mesh(PG.hat, mat(hat)); h.position.y = 1.93; g.add(h); }
    g.add(makeShadow(0.9, 0.9));
    return { g, legL, legR, armL, armR, gm };
  }

  // ---------- Particules & traces de tirs ----------
  const partMats = {
    fire: new THREE.MeshBasicMaterial({ color: 0xff8a1f }),
    smoke: new THREE.MeshBasicMaterial({ color: 0x555555 }),
    blood: new THREE.MeshBasicMaterial({ color: 0xb01212 }),
    spark: new THREE.MeshBasicMaterial({ color: 0xfff1a8 }),
    debris: new THREE.MeshBasicMaterial({ color: 0x3a3a3a })
  };
  const partGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  disposables.push(partGeo, partMats.fire, partMats.smoke, partMats.blood, partMats.spark, partMats.debris);
  const particles = [];
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(partGeo, partMats.fire); m.visible = false; scene.add(m);
    particles.push({ m, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 9, s: 1 });
  }
  let partI = 0;
  function burst(x, y, z, n, kind, spd) {
    spd = spd || 6;
    for (let k = 0; k < n; k++) {
      const p = particles[partI++ % particles.length];
      p.m.material = partMats[kind]; p.m.visible = true;
      p.x = x; p.y = y; p.z = z;
      p.vx = R(-1, 1) * spd; p.vz = R(-1, 1) * spd;
      p.vy = kind === 'smoke' ? R(1.5, 4) : R(1, 1.2) * spd * 0.7;
      p.g = kind === 'smoke' ? -1 : 11;
      p.life = kind === 'smoke' ? R(0.8, 1.6) : R(0.35, 0.9);
      p.s = kind === 'fire' ? R(1.2, 2.4) : 1;
      p.m.position.set(x, y, z);
    }
  }
  function updateParticles(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y = Math.max(0.1, p.y + p.vy * dt); p.z += p.vz * dt;
      p.m.position.set(p.x, p.y, p.z);
      const s = Math.max(0.2, p.life) * p.s; p.m.scale.set(s, s, s);
    }
  }
  const tracers = []; let tracerI = 0;
  for (let i = 0; i < 10; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mt = new THREE.LineBasicMaterial({ color: 0xffee88 });
    const line = new THREE.Line(geo, mt); line.visible = false; line.frustumCulled = false; scene.add(line);
    disposables.push(geo, mt);
    tracers.push({ line, life: 0 });
  }
  function tracer(x1, y1, z1, x2, y2, z2, col) {
    const t = tracers[tracerI++ % tracers.length];
    const a = t.line.geometry.attributes.position;
    a.setXYZ(0, x1, y1, z1); a.setXYZ(1, x2, y2, z2); a.needsUpdate = true;
    t.line.material.color.setHex(col || 0xffee88);
    t.line.visible = true; t.life = 0.07;
  }

  // ---------- Armes & sauvegarde ----------
  const WEAPONS = {
    fist: { name: 'POINGS', melee: true, dmg: 12, rate: 0.42 },
    pistol: { name: 'PISTOLET', dmg: 26, rate: 0.3, range: 90, spread: 0.012, pack: 30, price: 60 },
    smg: { name: 'SMG', dmg: 13, rate: 0.085, range: 80, spread: 0.045, auto: true, pack: 90, price: 150, buy: 900 },
    shotgun: { name: 'FUSIL À POMPE', dmg: 10, pellets: 7, rate: 0.85, range: 40, spread: 0.1, pack: 16, price: 120, buy: 1400 }
  };
  const WORDER = ['fist', 'pistol', 'smg', 'shotgun'];
  let sv = { money: 500, earned: 0, own: { fist: 1, pistol: 1 }, ammo: { pistol: 48 } };
  try { const s = JSON.parse(localStorage.getItem('gta_save') || 'null'); if (s && typeof s.money === 'number') sv = Object.assign(sv, s); } catch (e) {}
  let money = sv.money, earned = sv.earned || 0;
  const own = sv.own, ammo = sv.ammo;
  function saveGame() { try { localStorage.setItem('gta_save', JSON.stringify({ money, earned, own, ammo })); } catch (e) {} }

  // ---------- Joueur ----------
  const P = { x: spawnPt.x, z: spawnPt.z, y: 0.18, vx: 0, vz: 0, vy: 0, yaw: Math.PI, hp: 100, armor: 0, mode: 'foot', car: null, weapon: 'pistol', fireT: 0, anim: 0, hurtT: 0, arrest: 0, carjackCd: 0 };
  const pm = buildHuman(0xff7a1a, 0x23325a, 0xf3c9a5, null, true);
  P.mesh = pm; scene.add(pm.g);

  // ---------- État global ----------
  let state = 'play', stateT = 0, started = false, paused = false, menuOpen = false, running = true, noLock = false;
  let heat = 0, stars = 0, unseenT = 0, tod = 0.4, shake = 0, aimT = 0, hornT = 0, lastLook = 0, saveT = 0;
  let camYaw = Math.PI, camPitch = 0.28, camD = 6, camPos = [0, 5, 0], camDir = [0, 0, 1];
  const STAR_T = [0, 10, 30, 60, 100, 150];
  const starsOf = h => { let s = 0; for (let i = 1; i < 6; i++) if (h >= STAR_T[i]) s = i; return s; };
  function gainMoney(v) { money += v; if (v > 0) earned += v; }

  // ============================================================
  //  UI minimale nécessaire à la logique (toasts / prompts)
  // ============================================================
  let hud = null, toastsEl = null;
  function toast(msg, color) {
    if (!toastsEl) return;
    const d = document.createElement('div');
    d.textContent = msg; d.style.color = color || '#fff';
    toastsEl.appendChild(d);
    while (toastsEl.children.length > 4) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
  }

  // ============================================================
  //  CRIMES / RECHERCHE
  // ============================================================
  function addHeat(v) {
    if (state !== 'play') return;
    const before = stars;
    heat = Math.min(200, heat + v);
    stars = starsOf(heat);
    unseenT = 0;
    if (stars > before) toast('★ Niveau de recherche : ' + stars, '#ffd23f');
  }
  function hurtPlayer(d) {
    if (state !== 'play') return;
    if (P.armor > 0) { const a = Math.min(P.armor, d * 0.7); P.armor -= a; d -= a; }
    P.hp -= d; P.hurtT = 0.25;
    if (P.hp <= 0) die('wasted');
  }

  // ============================================================
  //  TRAFIC / IA DES VOITURES
  // ============================================================
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const LANE = 4.5;
  const inGrid = (i, j) => i >= 0 && i <= N && j >= 0 && j <= N;
  const validDirs = (i, j) => DIRS.filter(d => inGrid(i + d[0], j + d[1]));

  function placeOnRoad(c, i, j, d, t) {
    c.x = lineC(i) + d[0] * t - d[1] * LANE;
    c.z = lineC(j) + d[1] * t + d[0] * LANE;
    c.ang = Math.atan2(d[0], d[1]);
    c.ai = { i: i + d[0], j: j + d[1], d, wp: [] };
    c.stuck = 0; c.revT = 0;
  }
  function setupTraffic(c, minDist) {
    for (let t = 0; t < 25; t++) {
      const i = rint(0, N), j = rint(0, N), d = pick(validDirs(i, j)), along = R(0.2, 0.7) * PITCH;
      const x = lineC(i) + d[0] * along, z = lineC(j) + d[1] * along;
      if (Math.hypot(x - P.x, z - P.z) < minDist) continue;
      if (Math.hypot(x - P.x, z - P.z) > 230 && t < 20) continue;
      placeOnRoad(c, i, j, d, along); c.speed = R(6, 11); return;
    }
    const i = rint(0, N), j = rint(0, N), d = pick(validDirs(i, j));
    placeOnRoad(c, i, j, d, 0.5 * PITCH); c.speed = 5;
  }
  function aiPlan(c, cop) {
    const a = c.ai, cx = lineC(a.i), cz = lineC(a.j), d = a.d, E = ROAD / 2 + 3;
    a.wp.push({ x: cx - d[0] * E - d[1] * LANE, z: cz - d[1] * E + d[0] * LANE });
    const opts = [d, [d[1], -d[0]], [-d[1], d[0]]].filter(o => inGrid(a.i + o[0], a.j + o[1]));
    let nd;
    if (!opts.length) nd = [-d[0], -d[1]];
    else if (cop) {
      let best = 1e9;
      for (const o of opts) {
        const dd = Math.hypot(lineC(a.i + o[0]) - P.x, lineC(a.j + o[1]) - P.z) + (Math.random() < 0.15 ? R(0, 90) : 0);
        if (dd < best) { best = dd; nd = o; }
      }
    } else {
      let tot = 0; const w = opts.map(o => { const v = o === d ? 3 : 1; tot += v; return v; });
      let r = Math.random() * tot; nd = opts[0];
      for (let k = 0; k < opts.length; k++) { r -= w[k]; if (r <= 0) { nd = opts[k]; break; } }
    }
    a.wp.push({ x: cx + nd[0] * E - nd[1] * LANE, z: cz + nd[1] * E + nd[0] * LANE });
    a.i += nd[0]; a.j += nd[1]; a.d = nd;
  }
  function obstacleSpeed(c, ignorePlayerCar) {
    let best = 99; const fx = Math.sin(c.ang), fz = Math.cos(c.ang);
    for (const o of cars) {
      if (o === c || (ignorePlayerCar && o.kind === 'player')) continue;
      const dx = o.x - c.x, dz = o.z - c.z, f = dx * fx + dz * fz;
      if (f < 0 || f > 14) continue;
      if (Math.abs(dx * fz - dz * fx) > 2.4) continue;
      best = Math.min(best, f < 4.8 ? 0 : (f - 4.8) * 1.1 + Math.max(o.speed, 0) * 0.6);
    }
    for (const p of peds) {
      if (p.dead || p.state === 'walk') continue;
      const dx = p.x - c.x, dz = p.z - c.z, f = dx * fx + dz * fz;
      if (f < 0 || f > 10) continue;
      if (Math.abs(dx * fz - dz * fx) > 1.8) continue;
      best = Math.min(best, f < 4 ? 0 : (f - 4) * 1.2);
    }
    if (P.mode === 'foot' && P.hp > 0) {
      const dx = P.x - c.x, dz = P.z - c.z, f = dx * fx + dz * fz;
      if (f > 0 && f < 10 && Math.abs(dx * fz - dz * fx) < 1.8) best = Math.min(best, f < 4 ? 0 : (f - 4) * 1.2);
    }
    return best;
  }
  function aiDrive(c, dt, cop) {
    const a = c.ai;
    if (!a.wp.length) aiPlan(c, cop);
    const direct = cop && c.direct && c.noDirect <= 0;
    let tx, tz;
    if (direct) { tx = P.x; tz = P.z; } else { tx = a.wp[0].x; tz = a.wp[0].z; }
    const des = Math.atan2(tx - c.x, tz - c.z), diff = angDiff(c.ang, des), d = Math.hypot(tx - c.x, tz - c.z);
    if (!direct && d < 6) { a.wp.shift(); if (a.wp.length < 2) aiPlan(c, cop); }
    let tv = cop ? c.copSpeed : c.cruise;
    if (Math.abs(diff) > 0.5) tv = Math.min(tv, 7);
    tv = Math.min(tv, obstacleSpeed(c, cop));
    if (cop && P.mode === 'foot' && Math.hypot(P.x - c.x, P.z - c.z) < 11) tv = 0;
    let steer = clamp(diff * 3, -1, 1), sgn = 1;
    if (c.revT > 0) { c.revT -= dt; tv = -6; steer = -steer; sgn = -1; }
    const acc = c.st.acc * 0.8;
    c.speed += clamp(tv - c.speed, -30 * dt, acc * dt);
    const sf = clamp(Math.abs(c.speed) / 5, 0, 1) * (c.speed < 0 ? -1 : 1);
    c.ang += 2.3 * steer * sf * dt;
    c.x += Math.sin(c.ang) * c.speed * dt; c.z += Math.cos(c.ang) * c.speed * dt;
    // coincé ?
    if (Math.abs(c.speed) < 1 && tv > 2) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt);
    if (cop && c.stuck > 1.2 && c.revT <= 0) { c.revT = 1.1; c.noDirect = 4; c.stuck = 0; c.ai.wp.length = 0; }
    if (c.noDirect > 0) c.noDirect -= dt;
  }
  function driveCar(c, dt, gas, brake, steerIn, hb) {
    const st = c.st, maxF = st.vmax, maxR = -9;
    if (gas > 0) {
      c.speed += st.acc * (1 - clamp(c.speed / maxF, 0, 1) * 0.9) * gas * dt;
      if (c.speed < 0) c.speed += 25 * dt;
    }
    if (brake > 0) { if (c.speed > 0.5) c.speed -= 34 * dt * brake; else c.speed = Math.max(c.speed - 14 * dt * brake, maxR); }
    if (gas <= 0 && brake <= 0) { c.speed -= c.speed * 0.5 * dt + Math.sign(c.speed) * 1.4 * dt; if (Math.abs(c.speed) < 0.35) c.speed = 0; }
    if (hb) c.speed *= Math.max(0, 1 - 2.6 * dt);
    c.speed = clamp(c.speed, maxR, maxF);
    const sf = clamp(Math.abs(c.speed) / 6, 0, 1) * (c.speed < 0 ? -1 : 1);
    c.ang += 2.2 * (1 - 0.55 * Math.abs(c.speed) / maxF) * steerIn * sf * dt;
    c.x += Math.sin(c.ang) * c.speed * dt; c.z += Math.cos(c.ang) * c.speed * dt;
  }
  function carVsWorld(c) {
    const cs = carCircles(c);
    for (const cc of cs) {
      const pc = pushCircle(cc.x, cc.z, cc.r);
      if (!pc) continue;
      c.x += pc[0]; c.z += pc[1]; cc.x += pc[0]; cc.z += pc[1];
      const l = Math.hypot(pc[0], pc[1]) || 1, nx = pc[0] / l, nz = pc[1] / l;
      const dotf = Math.sin(c.ang) * nx + Math.cos(c.ang) * nz;
      const vn = c.speed * dotf;
      if (Math.abs(vn) > 2.5) {
        const dmg = Math.abs(vn) * 1.3;
        if (c.kind !== 'wreck') { c.hp -= dmg; if (c.kind === 'player') { shake = Math.max(shake, Math.min(0.9, dmg * 0.03)); snd(90, 0.12, 'sawtooth'); } }
      }
      c.speed *= 1 - 0.55 * Math.abs(dotf);
    }
    if (Math.abs(c.x) > LIM) { c.x = clamp(c.x, -LIM, LIM); c.speed *= 0.6; }
    if (Math.abs(c.z) > LIM) { c.z = clamp(c.z, -LIM, LIM); c.speed *= 0.6; }
  }
  const cweight = c => (c.kind === 'parked' ? 0.35 : c.kind === 'wreck' ? 0.2 : 1);
  function carVsCar(a, b) {
    const ca = carCircles(a), cb = carCircles(b);
    for (const p of ca) for (const q of cb) {
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), m = p.r + q.r;
      if (d >= m) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, pen = m - d;
      const wa = cweight(a), wb = cweight(b), sum = wa + wb;
      a.x -= nx * pen * wa / sum; a.z -= nz * pen * wa / sum;
      b.x += nx * pen * wb / sum; b.z += nz * pen * wb / sum;
      const va = a.speed * (Math.sin(a.ang) * nx + Math.cos(a.ang) * nz), vb = b.speed * (Math.sin(b.ang) * nx + Math.cos(b.ang) * nz);
      const rel = va - vb;
      if (rel > 1) {
        a.speed *= 0.75; b.speed *= 0.75;
        if (a.kind === 'parked' || b.kind === 'parked') { a.speed *= 0.8; }
        if (rel > 4.5) {
          if (a.hitCd <= 0 && b.hitCd <= 0) {
            a.hitCd = b.hitCd = 0.25;
            if (a.kind !== 'wreck') a.hp -= rel * 0.8;
            if (b.kind !== 'wreck') b.hp -= rel * 0.8;
            burst((p.x + q.x) / 2, 0.8, (p.z + q.z) / 2, 5, 'spark', 4);
            const pl = a.kind === 'player' ? a : b.kind === 'player' ? b : null;
            if (pl) { shake = Math.max(shake, Math.min(0.9, rel * 0.04)); snd(80, 0.15, 'sawtooth'); const o = pl === a ? b : a; if (o.kind === 'traffic' && rel > 7) addHeat(5); if (o.kind === 'cop' && rel > 7) addHeat(6); }
          }
        }
      }
    }
  }

  // ---------- Création des voitures du monde ----------
  function spawnParked() {
    for (let k = 0; k < 16; k++) {
      const i = rint(0, N), j = rint(0, N), d = pick(validDirs(i, j)), along = R(0.25, 0.75) * PITCH;
      const c = makeCar(pick(['sedan', 'sedan', 'suv', 'sport', 'van']), 0, 0, 0, 'parked');
      c.x = lineC(i) + d[0] * along + (-d[1]) * 7.4; c.z = lineC(j) + d[1] * along + d[0] * 7.4;
      c.ang = Math.atan2(d[0], d[1]);
      if (Math.hypot(c.x - P.x, c.z - P.z) < 20) { c.x += 80; }
    }
  }
  const starter = makeCar('sport', blockC(3) + 36.5, blockC(3) + 8, 0, 'parked');
  starter.mesh.material = plainMat;
  for (let k = 0; k < 28; k++) { const c = makeCar(pick(TRAFFIC_KINDS), 0, 0, 0, 'traffic'); setupTraffic(c, 30); }
  spawnParked();

  // ============================================================
  //  PIÉTONS
  // ============================================================
  const RH = 30;
  function ringPos(bx, bz, s) {
    const T = 8 * RH; s = ((s % T) + T) % T;
    if (s < 2 * RH) return [bx - RH + s, bz - RH];
    if (s < 4 * RH) return [bx + RH, bz - RH + (s - 2 * RH)];
    if (s < 6 * RH) return [bx + RH - (s - 4 * RH), bz + RH];
    return [bx - RH, bz + RH - (s - 6 * RH)];
  }
  function ringParam(dx, dz) {
    const m = Math.max(Math.abs(dx), Math.abs(dz)) || 1, x = dx / m * RH, z = dz / m * RH;
    if (Math.abs(dz) >= Math.abs(dx)) return dz < 0 ? x + RH : 4 * RH + (RH - x);
    return dx > 0 ? 2 * RH + (z + RH) : 6 * RH + (RH - z);
  }
  function makePed(kind) {
    const cop = kind === 'cop';
    const h = cop ? buildHuman(0x2a4a8c, 0x14213d, pick(SKINS), 0x101820, true) : buildHuman(pick(SHIRTS), pick(PANTS), pick(SKINS), Math.random() < 0.25 ? pick(SHIRTS) : null, false);
    scene.add(h.g);
    const p = { kind, h, g: h.g, x: 0, z: 0, y: 0.18, yaw: 0, state: 'walk', hp: cop ? 70 : 40, bi: 0, bj: 0, s: 0, dir: 1, speed: R(1.3, 2.1), t: 0, anim: Math.random() * 6, dead: false, deadT: 0, fx: 0, fz: 0, shootT: R(0.5, 1.2), retT: 0 };
    peds.push(p);
    return p;
  }
  function placePed(p, minD, maxD) {
    for (let t = 0; t < 20; t++) {
      const bi = rint(0, N - 1), bj = rint(0, N - 1), s = R(0, 8 * RH), pos = ringPos(blockC(bi), blockC(bj), s);
      const d = Math.hypot(pos[0] - P.x, pos[1] - P.z);
      if (d < minD || d > maxD) continue;
      p.bi = bi; p.bj = bj; p.s = s; p.x = pos[0]; p.z = pos[1]; p.dir = Math.random() < 0.5 ? 1 : -1; p.state = 'walk'; return;
    }
    const bi = rint(0, N - 1), bj = rint(0, N - 1); p.bi = bi; p.bj = bj; p.s = R(0, 8 * RH);
    const pos = ringPos(blockC(bi), blockC(bj), p.s); p.x = pos[0]; p.z = pos[1];
  }
  for (let k = 0; k < 44; k++) { const p = makePed('ped'); placePed(p, 8, 260); }

  function scarePeds(x, z, r) {
    for (const p of peds) {
      if (p.dead || p.kind === 'cop') continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d < r) { p.state = 'flee'; p.t = R(4, 7); const l = d || 1; p.fx = dx / l; p.fz = dz / l; }
    }
  }
  const pickups = [];
  const cashGeo = new THREE.BoxGeometry(0.8, 0.14, 0.5), hpGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  disposables.push(cashGeo, hpGeo);
  function addPickup(type, x, z, val, temp) {
    const m = new THREE.Mesh(type === 'cash' ? cashGeo : hpGeo, mat(type === 'cash' ? 0x3ddc57 : type === 'hp' ? 0xff4d6d : 0x4da3ff));
    m.position.set(x, 0.8, z); scene.add(m);
    pickups.push({ type, m, x, z, val, temp: !!temp, life: temp ? 45 : 0, respawn: 0, on: true, ph: Math.random() * 6 });
  }
  for (let k = 0; k < 26; k++) { const pos = ringPos(blockC(rint(0, N - 1)), blockC(rint(0, N - 1)), R(0, 8 * RH)); addPickup('cash', pos[0], pos[1], rint(40, 180)); }
  for (let k = 0; k < 9; k++) { const pos = ringPos(blockC(rint(0, N - 1)), blockC(rint(0, N - 1)), R(0, 8 * RH)); addPickup(k % 3 === 0 ? 'armor' : 'hp', pos[0], pos[1], k % 3 === 0 ? 50 : 50); }

  function killPed(p, byPlayer, dir) {
    if (p.dead) return;
    p.dead = true; p.deadT = 0; p.hp = 0;
    p.g.rotation.set(-Math.PI / 2, p.yaw, 0); p.g.position.set(p.x, 0.35, p.z);
    burst(p.x, 1, p.z, 7, 'blood', 3);
    if (byPlayer) addHeat(p.kind === 'cop' ? 22 : 12);
    addPickup('cash', p.x + R(-0.5, 0.5), p.z + R(-0.5, 0.5), p.kind === 'cop' ? rint(100, 250) : rint(15, 110), true);
    scarePeds(p.x, p.z, 25);
  }
  function damagePed(p, dmg, byPlayer) {
    if (p.dead) return;
    p.hp -= dmg;
    if (p.kind === 'ped' && p.state === 'walk') { p.state = 'flee'; p.t = R(5, 8); const dx = p.x - P.x, dz = p.z - P.z, l = Math.hypot(dx, dz) || 1; p.fx = dx / l; p.fz = dz / l; }
    if (p.hp <= 0) killPed(p, byPlayer);
    else burst(p.x, 1.2, p.z, 3, 'blood', 2);
  }
  function updatePeds(dt) {
    for (const p of peds) {
      if (p.dead) {
        p.deadT += dt; if (p.deadT > 22) { p.g.visible = false; p.recycle = true; }
        continue;
      }
      const ox = p.x, oz = p.z;
      if (p.kind === 'ped') {
        // danger : voiture lancée vers lui
        if (P.mode === 'car' && P.car && Math.abs(P.car.speed) > 7 && p.state === 'walk') {
          const dx = p.x - P.car.x, dz = p.z - P.car.z;
          if (dx * dx + dz * dz < 150) { p.state = 'flee'; p.t = R(3, 5); const l = Math.hypot(dx, dz) || 1; p.fx = dx / l; p.fz = dz / l; }
        }
        if (p.state === 'walk') {
          p.s += p.dir * p.speed * dt;
          const pos = ringPos(blockC(p.bi), blockC(p.bj), p.s); p.x = pos[0]; p.z = pos[1];
          p.anim += p.speed * dt * 3.2;
        } else if (p.state === 'flee') {
          p.t -= dt;
          const sp = 5.6; p.x += p.fx * sp * dt; p.z += p.fz * sp * dt;
          const pc = pushCircle(p.x, p.z, 0.4); if (pc) { p.x += pc[0]; p.z += pc[1]; }
          p.anim += sp * dt * 2.2;
          if (p.t <= 0) { p.state = 'return'; p.retT = 9; }
        } else if (p.state === 'return') {
          const ci = clamp(cellOf(p.x), 0, N - 1), cj = clamp(cellOf(p.z), 0, N - 1);
          const bx = blockC(ci), bz = blockC(cj), s = ringParam(p.x - bx, p.z - bz), tp = ringPos(bx, bz, s);
          const dx = tp[0] - p.x, dz = tp[1] - p.z, d = Math.hypot(dx, dz);
          p.retT -= dt;
          if (d < 1.2 || p.retT <= 0) { p.bi = ci; p.bj = cj; p.s = s; p.state = 'walk'; }
          else { p.x += dx / d * 2.8 * dt; p.z += dz / d * 2.8 * dt; const pc = pushCircle(p.x, p.z, 0.4); if (pc) { p.x += pc[0]; p.z += pc[1]; } p.anim += dt * 7; }
        }
        // recyclage loin du joueur
        if (Math.hypot(p.x - P.x, p.z - P.z) > 230) { placePed(p, 90, 200); p.g.visible = true; }
      } else {
        updateOfficer(p, dt);
      }
      const mvx = p.x - ox, mvz = p.z - oz;
      if (mvx * mvx + mvz * mvz > 1e-6) p.yaw += angDiff(p.yaw, Math.atan2(mvx, mvz)) * Math.min(1, dt * 10);
      const gy = groundY(p.x, p.z);
      p.y = gy;
      p.g.position.set(p.x, p.y, p.z); p.g.rotation.set(0, p.yaw, 0);
      const sw = Math.sin(p.anim) * 0.7, moving = (mvx * mvx + mvz * mvz) > 1e-6;
      p.h.legL.rotation.x = moving ? sw : 0; p.h.legR.rotation.x = moving ? -sw : 0;
      p.h.armL.rotation.x = moving ? -sw * 0.8 : 0; p.h.armR.rotation.x = p.kind === 'cop' && p.aim ? -1.4 : (moving ? sw * 0.8 : 0);
    }
    for (let i = peds.length - 1; i >= 0; i--) if (peds[i].recycle) { scene.remove(peds[i].g); peds.splice(i, 1); }
    // re-population
    let nPed = 0; for (const p of peds) if (p.kind === 'ped' && !p.dead) nPed++;
    if (nPed < 40) { const p = makePed('ped'); placePed(p, 90, 200); }
  }

  // ---------- Policiers à pied ----------
  function spawnOfficer(x, z) {
    const o = makePed('cop'); o.x = x; o.z = z; o.state = 'chase'; o.speed = 5.3;
    o.g.position.set(x, 0, z); return o;
  }
  function updateOfficer(p, dt) {
    p.aim = false;
    if (stars === 0) { p.leaveT = (p.leaveT || 0) + dt; if (p.leaveT > 4) { p.recycle = true; } }
    else p.leaveT = 0;
    if (state !== 'play') return;
    const tx = P.x, tz = P.z, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (P.mode === 'car' && d < 4 && Math.abs(P.car.speed) > 3) { /* évite la voiture */ }
    if (d > 2.2) {
      const sp = d > 26 ? 6.2 : 4.6; p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; p.anim += dt * 9;
      const pc = pushCircle(p.x, p.z, 0.4); if (pc) { p.x += pc[0]; p.z += pc[1]; }
    }
    if (d < 28 && d > 3) {
      p.aim = true; p.shootT -= dt;
      if (p.shootT <= 0) {
        p.shootT = R(0.8, 1.5);
        const hit = Math.random() < (P.mode === 'car' ? 0.2 : 0.35);
        tracer(p.x, 1.4, p.z, P.x + (hit ? 0 : R(-2, 2)), 1.2, P.z + (hit ? 0 : R(-2, 2)), 0xffcc66);
        snd(300, 0.06, 'square');
        if (hit) { if (P.mode === 'car' && P.car) P.car.hp -= 3; else hurtPlayer(6); }
      }
    }
    if (Math.hypot(p.x - P.x, p.z - P.z) > 300) p.recycle = true;
  }

  // ============================================================
  //  EXPLOSIONS / DÉGÂTS
  // ============================================================
  const boomQ = [];
  function explode(x, z, power, byPlayer) {
    burst(x, 1, z, 22, 'fire', 7); burst(x, 1.5, z, 14, 'smoke', 3); burst(x, 1, z, 8, 'debris', 8);
    snd(60, 0.7, 'sawtooth'); snd(130, 0.4, 'square');
    const dp = Math.hypot(P.x - x, P.z - z);
    shake = Math.max(shake, Math.max(0, 1 - dp / 50));
    if (dp < 10 && P.hp > 0) hurtPlayer((1 - dp / 10) * power);
    for (const c of cars) {
      if (c.kind === 'wreck') continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < 9 && d > 0.1) { c.hp -= (1 - d / 9) * power * 1.3; c.byPlayer = byPlayer; }
    }
    for (const p of peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 9) damagePed(p, (1 - d / 9) * power * 2, byPlayer);
    }
    scarePeds(x, z, 40);
  }
  function killCar(c, byPlayer) {
    if (c.kind === 'wreck') return;
    const wasPlayer = c.kind === 'player';
    if (byPlayer) addHeat(c.kind === 'cop' ? 25 : 8);
    if (wasPlayer) leaveCar(true);
    c.kind = 'wreck'; c.hp = 0; c.wreckT = 30; c.ai = null; c.speed *= 0.3;
    c.mesh.material = wreckMat;
    if (c.bars) { c.bars.a.visible = false; c.bars.b.visible = false; }
    boomQ.push({ x: c.x, z: c.z, t: 0.05, byPlayer });
  }
  function damageCar(c, dmg, byPlayer) {
    if (c.kind === 'wreck') return;
    c.hp -= dmg; c.byPlayer = byPlayer;
    if (byPlayer && c.kind === 'cop') addHeat(3);
    burst(c.x, 1, c.z, 2, 'spark', 3);
  }

  // ============================================================
  //  TIRS
  // ============================================================
  function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
    const lx = cx - ox, ly = cy - oy, lz = cz - oz, tca = lx * dx + ly * dy + lz * dz;
    if (tca < 0) return Infinity;
    const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
    if (d2 > r * r) return Infinity;
    return tca - Math.sqrt(r * r - d2);
  }
  function rayBox(ox, oy, oz, dx, dy, dz, x0, x1, y0, y1, z0, z1) {
    let tmin = 0, tmax = 1e9;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-8) { if (o[k] < mn[k] || o[k] > mx[k]) return Infinity; }
      else {
        let t1 = (mn[k] - o[k]) / d[k], t2 = (mx[k] - o[k]) / d[k];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return Infinity;
      }
    }
    return tmin;
  }
  function castRay(ox, oy, oz, dx, dy, dz, maxT) {
    let best = { t: maxT, type: null, ent: null };
    if (dy < -1e-4) { const t = (0.15 - oy) / dy; if (t > 0 && t < best.t) best = { t, type: 'ground', ent: null }; }
    const seen = {};
    for (let s = 0; s <= maxT; s += 15) {
      const ci = cellOf(ox + dx * s), cj = cellOf(oz + dz * s);
      if (ci < 0 || ci >= N || cj < 0 || cj >= N) continue;
      const key = ci * N + cj; if (seen[key]) continue; seen[key] = 1;
      for (const q of cells[key]) { const t = rayBox(ox, oy, oz, dx, dy, dz, q.x0, q.x1, 0, q.h + 0.18, q.z0, q.z1); if (t < best.t) best = { t, type: 'wall', ent: null }; }
    }
    for (const p of peds) { if (p.dead) continue; const t = raySphere(ox, oy, oz, dx, dy, dz, p.x, p.y + 1, p.z, 0.6); if (t < best.t) best = { t, type: 'ped', ent: p }; }
    for (const c of cars) { if (c.kind === 'player') continue; const t = raySphere(ox, oy, oz, dx, dy, dz, c.x, 0.9, c.z, 1.9); if (t < best.t) best = { t, type: 'car', ent: c }; }
    return best;
  }

  let firing = false;
  const keys = {}; const pressed = {};
  let jx = 0, jy = 0;
  function fireWeapon(dt) {
    P.fireT -= dt;
    if (!(firing || keys.fire) || P.fireT > 0 || P.mode !== 'foot' || state !== 'play') return;
    const w = WEAPONS[P.weapon];
    aimT = 2.5; P.fireT = w.rate;
    if (w.melee) {
      let best = null, bd = 2.4;
      for (const p of peds) {
        if (p.dead) continue;
        const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
        if (d < bd && dx * Math.sin(camYaw) + dz * Math.cos(camYaw) > 0) { bd = d; best = p; }
      }
      P.punch = 0.2; snd(160, 0.06, 'square');
      if (best) { damagePed(best, w.dmg, true); addHeat(best.kind === 'cop' ? 8 : 1.5); burst(best.x, 1.4, best.z, 3, 'blood', 2); }
      return;
    }
    if ((ammo[P.weapon] | 0) <= 0) { toast('Plus de munitions !', '#ffd23f'); P.fireT = 0.5; return; }
    ammo[P.weapon]--;
    const mx = P.x + Math.sin(camYaw) * 0.5, my = P.y + 1.35, mz = P.z + Math.cos(camYaw) * 0.5;
    let dx = camPos[0] + camDir[0] * 60 - mx, dy = camPos[1] + camDir[1] * 60 - my, dz = camPos[2] + camDir[2] * 60 - mz;
    const l0 = Math.hypot(dx, dy, dz); dx /= l0; dy /= l0; dz /= l0;
    for (let k = 0; k < (w.pellets || 1); k++) {
      let ex = dx + R(-w.spread, w.spread), ey = dy + R(-w.spread, w.spread), ez = dz + R(-w.spread, w.spread);
      const l = Math.hypot(ex, ey, ez); ex /= l; ey /= l; ez /= l;
      const hit = castRay(mx, my, mz, ex, ey, ez, w.range);
      tracer(mx, my, mz, mx + ex * hit.t, my + ey * hit.t, mz + ez * hit.t);
      if (hit.type === 'ped') damagePed(hit.ent, w.dmg, true);
      else if (hit.type === 'car') damageCar(hit.ent, w.dmg * 1.1, true);
      else if (hit.type) burst(mx + ex * hit.t, my + ey * hit.t, mz + ez * hit.t, 2, 'spark', 3);
    }
    snd(w.auto ? 260 : 190, 0.07, 'square');
    shake = Math.max(shake, w.pellets ? 0.25 : 0.06);
    scarePeds(P.x, P.z, 30);
    addHeat(w.pellets ? 0.8 : 0.35);
  }

  // ============================================================
  //  VÉHICULES : monter / descendre
  // ============================================================
  function enterCar(c) {
    if (c.kind === 'traffic' || c.kind === 'cop') {
      addHeat(c.kind === 'cop' ? 30 : 16); toast('Carjacking !', '#ff5555');
      const p = makePed('ped');
      p.x = c.x + Math.cos(c.ang) * 2.4; p.z = c.z - Math.sin(c.ang) * 2.4;
      p.bi = clamp(cellOf(p.x), 0, N - 1); p.bj = clamp(cellOf(p.z), 0, N - 1);
      p.state = 'flee'; p.t = 6; const l = Math.hypot(p.x - c.x, p.z - c.z) || 1; p.fx = (p.x - c.x) / l; p.fz = (p.z - c.z) / l;
    }
    c.kind = 'player'; c.ai = null; c.direct = false; c.revT = 0;
    P.mode = 'car'; P.car = c; P.vx = P.vz = 0; pm.g.visible = false;
    camYaw = c.ang; snd(300, 0.08, 'square');
  }
  function leaveCar() {
    const c = P.car; if (!c) return;
    const lx = Math.cos(c.ang), lz = -Math.sin(c.ang), fx = Math.sin(c.ang), fz = Math.cos(c.ang);
    const tries = [[lx, lz, 2.4], [-lx, -lz, 2.4], [-fx, -fz, 3.4], [fx, fz, 3.4]];
    let px = c.x + lx * 2.4, pz = c.z + lz * 2.4;
    for (const t of tries) { const x = c.x + t[0] * t[2], z = c.z + t[1] * t[2]; if (!pushCircle(x, z, 0.5)) { px = x; pz = z; break; } }
    P.x = px; P.z = pz; P.y = groundY(px, pz); P.mode = 'foot'; P.vx = P.vz = 0; P.car = null;
    if (c.kind === 'player') c.kind = 'parked';
    pm.g.visible = true;
  }
  function nearestCar(r) {
    let best = null, bd = r;
    for (const c of cars) { if (c.kind === 'wreck') continue; const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  // ============================================================
  //  BRAQUAGES / MAGASIN
  // ============================================================
  let heist = null, curMarker = null, shopEl = null;
  function startHeist(m) {
    const h = HEISTS[m.key];
    if (m.cool > 0) { toast('Déjà braqué récemment…', '#ffd23f'); return; }
    if (P.weapon === 'fist') { toast('Sors une arme (touches 2 à 4) pour braquer', '#ffd23f'); return; }
    heist = { m, t: 0, dur: h.dur, h };
    addHeat(h.heat); toast('BRAQUAGE EN COURS — reste dans la zone !', '#ff5555'); snd(520, 0.2, 'square');
  }
  function updateHeist(dt) {
    if (!heist) return;
    const m = heist.m;
    if (P.mode !== 'foot' || state !== 'play' || Math.hypot(P.x - m.x, P.z - m.z) > m.r + 1.5) { toast('Braquage raté…', '#ff5555'); heist = null; return; }
    heist.t += dt;
    if (heist.t >= heist.dur) {
      const gain = Math.floor(R(heist.h.min, heist.h.max));
      gainMoney(gain); toast('+$' + gain + ' — Fuis avant la police !', '#7CFF7C');
      m.cool = m.key === 'bank' ? 240 : 120; heist = null; snd(880, 0.3, 'sine');
      if (stars < 3 && m.key === 'bank') addHeat(40);
    }
  }
  function buy(it) {
    if (money < it.price) { toast('Pas assez d\'argent', '#ff5555'); return; }
    money -= it.price; it.apply(); snd(660, 0.1, 'sine'); renderShop(); saveGame();
  }
  const SHOP_ITEMS = () => [
    { label: 'Munitions pistolet (+30)', price: 60, apply: () => { ammo.pistol = (ammo.pistol | 0) + 30; } },
    own.smg ? { label: 'Munitions SMG (+90)', price: 150, apply: () => { ammo.smg = (ammo.smg | 0) + 90; } } : { label: 'Acheter SMG (+90 balles)', price: 900, apply: () => { own.smg = 1; ammo.smg = (ammo.smg | 0) + 90; } },
    own.shotgun ? { label: 'Cartouches fusil (+16)', price: 120, apply: () => { ammo.shotgun = (ammo.shotgun | 0) + 16; } } : { label: 'Acheter fusil à pompe (+16)', price: 1400, apply: () => { own.shotgun = 1; ammo.shotgun = (ammo.shotgun | 0) + 16; } },
    { label: 'Gilet pare-balles', price: 300, apply: () => { P.armor = 100; } }
  ];
  function renderShop() {
    if (!shopEl) return;
    shopEl.innerHTML = '<div class="g-shopbox"><h3>ARMURERIE</h3><div class="g-shopmoney">$' + money + '</div></div>';
    const box = shopEl.firstChild;
    for (const it of SHOP_ITEMS()) {
      const b = document.createElement('button');
      b.textContent = it.label + '  —  $' + it.price;
      b.addEventListener('click', () => buy(it));
      box.appendChild(b);
    }
    const c = document.createElement('button'); c.className = 'g-close'; c.textContent = 'FERMER';
    c.addEventListener('click', closeShop); box.appendChild(c);
  }
  function openShop() {
    menuOpen = true; if (document.exitPointerLock) document.exitPointerLock();
    renderShop(); shopEl.style.display = 'flex';
  }
  function closeShop() {
    menuOpen = false; shopEl.style.display = 'none';
    if (!isTouch && !noLock && canvas.requestPointerLock) canvas.requestPointerLock();
  }

  // ============================================================
  //  JOUEUR
  // ============================================================
  function handleAct() {
    if (state !== 'play') return;
    if (P.mode === 'car') {
      if (Math.abs(P.car.speed) > 9) { toast('Ralentis pour descendre', '#ffd23f'); return; }
      leaveCar(); return;
    }
    if (curMarker) {
      if (curMarker.type === 'heist') startHeist(curMarker);
      else if (curMarker.type === 'shop') openShop();
      return;
    }
    const c = nearestCar(3.8);
    if (c) enterCar(c);
  }
  function cycleWeapon(dir) {
    const avail = WORDER.filter(k => own[k]);
    let i = avail.indexOf(P.weapon); i = (i + dir + avail.length) % avail.length;
    P.weapon = avail[i];
  }
  function updatePlayer(dt) {
    P.hurtT = Math.max(0, P.hurtT - dt); aimT -= dt; P.punch = Math.max(0, (P.punch || 0) - dt);
    if (pressed.act) { pressed.act = false; handleAct(); }
    if (pressed.wpn) { pressed.wpn = false; cycleWeapon(1); }
    for (let k = 1; k <= 4; k++) if (pressed['w' + k]) { pressed['w' + k] = false; if (own[WORDER[k - 1]]) P.weapon = WORDER[k - 1]; }
    if (state !== 'play') { pressed.jump = false; return; }
    if (P.mode === 'car') {
      P.x = P.car.x; P.z = P.car.z; P.y = 0;
      if (keys.horn && hornT <= 0) { hornT = 0.35; snd(330, 0.3, 'square'); }
      return;
    }
    // ----- à pied -----
    let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + jx;
    const iy = (keys.up ? 1 : 0) - (keys.down ? 1 : 0) + jy;
    if (noLock && !isTouch) { camYaw -= ix * 2.2 * dt; ix = 0; }
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    const mx = fx * iy + rx * ix, mz = fz * iy + rz * ix, ml = Math.hypot(mx, mz);
    const sprint = keys.sprint || (isTouch && Math.hypot(jx, jy) > 0.92);
    const spd = sprint ? 8.2 : 5.2;
    let tvx = 0, tvz = 0;
    if (ml > 0.05) { const k = Math.min(1, ml) / ml * spd; tvx = mx * k; tvz = mz * k; }
    const a = Math.min(1, dt * 12);
    P.vx += (tvx - P.vx) * a; P.vz += (tvz - P.vz) * a;
    P.x += P.vx * dt; P.z += P.vz * dt;
    const pc = pushCircle(P.x, P.z, 0.45); if (pc) { P.x += pc[0]; P.z += pc[1]; }
    // voitures : on est poussé, et blessé si elles roulent vite
    for (const c of cars) {
      const dx = P.x - c.x, dz = P.z - c.z; if (dx * dx + dz * dz > 30) continue;
      for (const cc of carCircles(c)) {
        const ex = P.x - cc.x, ez = P.z - cc.z, d = Math.hypot(ex, ez), m = cc.r + 0.45;
        if (d < m) {
          const l = d || 1; P.x += ex / l * (m - d); P.z += ez / l * (m - d);
          if (Math.abs(c.speed) > 4 && c.hitCd <= 0 && c.kind !== 'parked') { c.hitCd = 0.5; hurtPlayer(Math.abs(c.speed) * 2.2); P.vx += ex / l * 6; P.vz += ez / l * 6; }
        }
      }
    }
    P.x = clamp(P.x, -LIM, LIM); P.z = clamp(P.z, -LIM, LIM);
    const gy = groundY(P.x, P.z);
    if (pressed.jump && P.y <= gy + 0.05) P.vy = 8;
    pressed.jump = false;
    if (P.y > gy || P.vy > 0) { P.vy -= 24 * dt; P.y += P.vy * dt; if (P.y <= gy) { P.y = gy; P.vy = 0; } }
    else P.y = lerp(P.y, gy, Math.min(1, dt * 20));
    const sp = Math.hypot(P.vx, P.vz);
    let ty = P.yaw;
    if (aimT > 0 && WEAPONS[P.weapon] && !WEAPONS[P.weapon].melee) ty = camYaw; else if (sp > 0.5) ty = Math.atan2(P.vx, P.vz);
    P.yaw += angDiff(P.yaw, ty) * Math.min(1, dt * 12);
    P.anim += sp * dt * 1.7;
    fireWeapon(dt);
    // ----- ramasser (voiture ou à pied) géré dans updatePickups -----
  }
  function updatePlayerMesh() {
    const g = pm.g;
    if (!g.visible) return;
    if (state !== 'play') { g.position.set(P.x, 0.3, P.z); g.rotation.set(-Math.PI / 2, P.yaw, 0); return; }
    g.position.set(P.x, P.y, P.z); g.rotation.set(0, P.yaw, 0);
    const sp = Math.hypot(P.vx, P.vz), sw = Math.sin(P.anim) * 0.8 * Math.min(1, sp / 3);
    pm.legL.rotation.x = sw; pm.legR.rotation.x = -sw; pm.armL.rotation.x = -sw;
    const armed = !WEAPONS[P.weapon].melee;
    pm.gm.visible = armed;
    pm.armR.rotation.x = armed ? (aimT > 0 ? -1.45 : -0.5) : (P.punch > 0 ? -1.5 : sw);
  }

  // ============================================================
  //  VOITURES : mise à jour globale
  // ============================================================
  let now = 0;
  function updateCars(dt) {
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.hitCd -= dt;
      if (c.kind === 'player') {
        if (state === 'play') {
          const gas = Math.max(keys.up ? 1 : 0, jy > 0.25 ? jy : 0), brake = Math.max(keys.down ? 1 : 0, jy < -0.25 ? -jy : 0);
          const steer = clamp((keys.left ? 1 : 0) - (keys.right ? 1 : 0) - jx, -1, 1);
          driveCar(c, dt, gas, brake, steer, keys.jump);
        } else driveCar(c, dt, 0, 0.5, 0, false);
      } else if (c.kind === 'traffic') {
        aiDrive(c, dt, false);
        const d = Math.hypot(c.x - P.x, c.z - P.z);
        if (d > 270 || c.stuck > 10) setupTraffic(c, 110);
      } else if (c.kind === 'cop') {
        copUpdate(c, dt);
      } else if (c.kind === 'parked') {
        if (Math.abs(c.speed) > 0.05) { c.speed *= Math.max(0, 1 - 2 * dt); c.x += Math.sin(c.ang) * c.speed * dt; c.z += Math.cos(c.ang) * c.speed * dt; }
      } else if (c.kind === 'wreck') {
        c.speed *= Math.max(0, 1 - 3 * dt); c.x += Math.sin(c.ang) * c.speed * dt; c.z += Math.cos(c.ang) * c.speed * dt;
        c.wreckT -= dt; if (c.wreckT <= 0) { removeCar(c); const n = makeCar(pick(TRAFFIC_KINDS), 0, 0, 0, 'traffic'); setupTraffic(n, 110); continue; }
        if (Math.random() < dt * 6) burst(c.x, 1.2, c.z, 1, 'smoke', 1.5);
      }
      if (c.kind !== 'wreck') {
        if (c.hp <= 0) killCar(c, !!c.byPlayer);
        else if (c.hp < 35 && (c.smokeT -= dt) <= 0) { c.smokeT = 0.18; burst(c.x + Math.sin(c.ang) * 1.5, 1.2, c.z + Math.cos(c.ang) * 1.5, 1, 'smoke', 1); }
      }
      // gyrophares
      if (c.bars && c.kind !== 'wreck') {
        const ph = ((now * 6) | 0) % 2;
        if (ph !== c.lastBlink) { c.lastBlink = ph; c.bars.mr.color.setHex(ph ? 0xff2222 : 0x330000); c.bars.mb.color.setHex(ph ? 0x001133 : 0x2266ff); }
      }
    }
    // collisions
    for (const c of cars) carVsWorld(c);
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j], dx = a.x - b.x, dz = a.z - b.z;
        if (dx * dx + dz * dz > 40) continue;
        carVsCar(a, b);
      }
    }
    // piétons écrasés
    const pc = P.car;
    if (pc && Math.abs(pc.speed) > 3.5) {
      for (const p of peds) {
        if (p.dead) continue;
        for (const cc of carCircles(pc)) {
          if (Math.hypot(p.x - cc.x, p.z - cc.z) < cc.r + 0.45) { killPed(p, true); pc.speed *= 0.94; snd(140, 0.1, 'square'); shake = Math.max(shake, 0.3); break; }
        }
      }
    }
    // explosions en attente
    for (let i = boomQ.length - 1; i >= 0; i--) { boomQ[i].t -= dt; if (boomQ[i].t <= 0) { const b = boomQ.splice(i, 1)[0]; explode(b.x, b.z, 60, b.byPlayer); } }
    for (const c of cars) { c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.ang; }
  }

  // ============================================================
  //  POLICE
  // ============================================================
  function officerCount() { let n = 0; for (const p of peds) if (p.kind === 'cop' && !p.dead) n++; return n; }
  function copUpdate(c, dt) {
    if (!c.ai) setupTraffic(c, 110);
    const d = Math.hypot(P.x - c.x, P.z - c.z);
    c.copSpeed = 24 + stars * 2.4;
    c.direct = d < 50;
    if (stars === 0) {
      c.calmT = (c.calmT || 0) + dt;
      if (c.calmT > 3) { c.kind = 'traffic'; c.cruise = R(9, 12); c.ai.wp.length = 0; return; }
    } else c.calmT = 0;
    aiDrive(c, dt, true);
    if (P.mode === 'foot' && d < 16 && c.speed < 3 && stars >= 1 && state === 'play') {
      c.deploy -= dt;
      if (c.deploy <= 0) {
        c.deploy = 6;
        if (officerCount() < 3 + stars) {
          spawnOfficer(c.x + Math.cos(c.ang) * 2.4, c.z - Math.sin(c.ang) * 2.4);
          if (stars >= 3) spawnOfficer(c.x - Math.cos(c.ang) * 2.4, c.z + Math.sin(c.ang) * 2.4);
        }
      }
    }
  }
  function spawnCop() {
    for (let t = 0; t < 16; t++) {
      const i = rint(0, N), j = rint(0, N), d = Math.hypot(lineC(i) - P.x, lineC(j) - P.z);
      if (d < 110 || d > 260) continue;
      const c = makeCar('police', 0, 0, 0, 'cop');
      placeOnRoad(c, i, j, pick(validDirs(i, j)), R(0.2, 0.6) * PITCH); c.speed = 8;
      return c;
    }
    return null;
  }
  let copTimer = 0;
  function updateWanted(dt) {
    if (heat > 0 && state === 'play') {
      let near = false;
      for (const c of cars) if (c.kind === 'cop' && Math.hypot(c.x - P.x, c.z - P.z) < 75) { near = true; break; }
      if (!near) for (const p of peds) if (p.kind === 'cop' && !p.dead && Math.hypot(p.x - P.x, p.z - P.z) < 60) { near = true; break; }
      if (near) unseenT = 0; else unseenT += dt;
      heat = Math.max(0, heat - (near ? 0.25 : unseenT > 5 ? 7 : 0.5) * dt);
      const s = starsOf(heat);
      if (s < stars) { stars = s; toast(s === 0 ? 'Recherche perdue !' : '★ Niveau de recherche : ' + s, s === 0 ? '#7CFF7C' : '#ffd23f'); }
    }
    const target = [0, 1, 2, 3, 5, 7][stars];
    let n = 0; for (const c of cars) if (c.kind === 'cop') n++;
    copTimer -= dt;
    if (n < target && copTimer <= 0 && state === 'play') { spawnCop(); copTimer = 2.2; }
    if (n > target) for (const c of cars) if (c.kind === 'cop' && Math.hypot(c.x - P.x, c.z - P.z) > 150) { removeCar(c); break; }
    if (stars > 0 && state === 'play') {
      let cnt = 0;
      if (P.mode === 'foot') {
        for (const p of peds) if (p.kind === 'cop' && !p.dead && Math.hypot(p.x - P.x, p.z - P.z) < 2.4) cnt++;
        P.arrest = cnt > 0 ? P.arrest + dt : Math.max(0, P.arrest - dt * 2);
      } else {
        if (Math.abs(P.car.speed) < 3) for (const c of cars) if (c.kind === 'cop' && Math.hypot(c.x - P.x, c.z - P.z) < 7) cnt++;
        P.arrest = cnt >= 2 ? P.arrest + dt : Math.max(0, P.arrest - dt * 2);
      }
      if (P.arrest > 2.8) die('busted');
    } else P.arrest = 0;
  }

  // ============================================================
  //  MORT / ARRESTATION / RESPAWN
  // ============================================================
  let bigEl = null;
  function showBig(t, col, sub) { if (!bigEl) return; bigEl.innerHTML = '<b style="color:' + col + '">' + t + '</b><small>' + (sub || '') + '</small>'; bigEl.style.display = 'flex'; }
  function die(kind) {
    if (state !== 'play') return;
    heist = null;
    const loss = kind === 'busted' ? Math.floor(money * 0.2) : Math.min(money, Math.floor(money * 0.1) + 100);
    money -= loss;
    if (P.mode === 'car') leaveCar();
    state = kind; stateT = 3.4; P.hp = Math.max(P.hp, 0);
    showBig(kind === 'busted' ? 'ARRÊTÉ' : 'WASTED', kind === 'busted' ? '#4da3ff' : '#ff3b3b', '−$' + loss);
    snd(100, 0.7, 'sawtooth');
    try { if (typeof updateHighScore === 'function') updateHighScore('gta', earned); } catch (e) {}
    saveGame();
  }
  function respawn() {
    const pt = state === 'busted' ? respawnPolice : respawnHosp;
    P.x = pt.x; P.z = pt.z; P.y = 0.18; P.hp = 100; P.armor = 0; P.vx = P.vz = 0; P.arrest = 0;
    heat = 0; stars = 0; state = 'play';
    for (const p of peds) if (p.kind === 'cop') p.recycle = true;
    if (bigEl) bigEl.style.display = 'none';
    pm.g.visible = true;
  }

  // ============================================================
  //  CIEL / JOUR-NUIT
  // ============================================================
  function updateSky(dt) {
    tod = (tod + dt / 300) % 1;
    const s = Math.sin(TAU * (tod - 0.25));
    const day = clamp((s + 0.12) / 0.4, 0, 1), dusk = Math.max(0, 1 - Math.abs(s) / 0.3);
    const nc = [0.03, 0.05, 0.14], dc = [0.5, 0.75, 1.0], sc = [1.0, 0.5, 0.3];
    const c = [0, 1, 2].map(i => lerp(nc[i], dc[i], day) * (1 - dusk * 0.5) + sc[i] * dusk * 0.5);
    skyCol.setRGB(c[0], c[1], c[2]); scene.fog.color.setRGB(c[0], c[1], c[2]);
    hemi.intensity = 0.32 + 0.55 * day; sun.intensity = 0.08 + 0.85 * day;
    sun.position.set(Math.cos(TAU * (tod - 0.25)) * 160, Math.max(s, 0.1) * 220, 90);
    const em = clamp(1 - day * 1.4, 0, 1);
    bMat.emissive.setRGB(em, 0.85 * em, 0.5 * em);
  }

  // ============================================================
  //  MARQUEURS / RAMASSAGES
  // ============================================================
  function updateMarkers(dt) {
    let near = null;
    for (const m of markers) {
      if (m.cool > 0) m.cool -= dt;
      const off = m.cool > 0;
      m.ring.material.opacity = off ? 0.2 : 0.7 + Math.sin(now * 4) * 0.2;
      m.beam.visible = !off;
      if (state === 'play' && P.mode === 'foot' && Math.hypot(P.x - m.x, P.z - m.z) < m.r + 0.3) near = m;
    }
    curMarker = near;
    if (near && near.type === 'hospital' && P.hp < 100) P.hp = Math.min(100, P.hp + 25 * dt);
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const k = pickups[i];
      if (!k.on) {
        if (k.temp) { scene.remove(k.m); pickups.splice(i, 1); continue; }
        k.respawn -= dt; if (k.respawn <= 0) { k.on = true; k.m.visible = true; }
        continue;
      }
      if (k.temp) { k.life -= dt; if (k.life <= 0) { k.on = false; k.m.visible = false; continue; } }
      k.m.rotation.y += dt * 2; k.m.position.y = 0.8 + Math.sin(now * 3 + k.ph) * 0.12;
      if (state !== 'play') continue;
      if (Math.hypot(P.x - k.x, P.z - k.z) < (P.mode === 'car' ? 3 : 1.8)) {
        if (k.type === 'cash') { gainMoney(k.val); snd(900, 0.06, 'sine'); }
        else if (k.type === 'hp') { if (P.hp >= 100) continue; P.hp = Math.min(100, P.hp + k.val); snd(600, 0.08, 'sine'); toast('+ Santé', '#ff8aa0'); }
        else { if (P.armor >= 100) continue; P.armor = Math.min(100, P.armor + k.val); snd(500, 0.08, 'sine'); toast('+ Armure', '#7fbaff'); }
        k.on = false; k.m.visible = false; k.respawn = 90;
      }
    }
  }

  // ============================================================
  //  CAMÉRA
  // ============================================================
  function updateCamera(dt) {
    const car = P.mode === 'car' ? P.car : null;
    const tx = P.x, tz = P.z, ty = car ? 1.5 : P.y + 1.55;
    const dist = car ? 8.2 + Math.min(Math.abs(car.speed) * 0.05, 2.2) : 5.0;
    if (car && now - lastLook > 1.5 && Math.abs(car.speed) > 2) {
      camYaw += angDiff(camYaw, car.ang + (car.speed < -1 ? Math.PI : 0)) * Math.min(1, dt * 2.5);
      camPitch += (0.2 - camPitch) * Math.min(1, dt * 1.5);
    }
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const dx = -Math.sin(camYaw) * cp, dz = -Math.cos(camYaw) * cp, dy = sp;
    let d = dist;
    for (let s = 1; s <= 10; s++) {
      const t = dist * s / 10;
      if (camBlocked(tx + dx * t, ty + dy * t, tz + dz * t) || ty + dy * t < 0.5) { d = Math.max(1.3, t - dist * 0.15); break; }
    }
    camD = d < camD ? d : lerp(camD, d, Math.min(1, dt * 4));
    shake = Math.max(0, shake - dt * 1.6);
    const ox = (Math.random() - 0.5) * shake * 0.6, oy = (Math.random() - 0.5) * shake * 0.6;
    camPos = [tx + dx * camD + ox, Math.max(0.6, ty + dy * camD + oy), tz + dz * camD];
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    camera.lookAt(tx, ty, tz);
    const vx = tx - camPos[0], vy = ty - camPos[1], vz = tz - camPos[2], vl = Math.hypot(vx, vy, vz) || 1;
    camDir = [vx / vl, vy / vl, vz / vl];
    const fov = 65 + (car ? Math.min(Math.abs(car.speed), 40) * 0.4 : 0);
    if (Math.abs(camera.fov - fov) > 0.15) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 5)); camera.updateProjectionMatrix(); }
  }

  // ============================================================
  //  HUD
  // ============================================================
  const styleEl = document.createElement('style'); styleEl.id = 'gta-style';
  styleEl.textContent = `
  .gta-hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-family:'Rajdhani',sans-serif;text-shadow:0 1px 3px #000;user-select:none;-webkit-user-select:none}
  .gta-hud button{pointer-events:auto;font-family:'Rajdhani',sans-serif;cursor:pointer}
  .g-map{position:absolute;left:10px;top:10px;width:132px;height:132px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px #000;background:#111}
  .g-money{position:absolute;left:152px;top:8px;font-weight:900;font-size:26px;color:#7CFF7C;letter-spacing:1px}
  .g-toasts{position:absolute;left:152px;top:42px;font-weight:700;font-size:17px;max-width:55%}
  .g-top{position:absolute;right:12px;top:10px;text-align:right}
  .g-stars{font-size:26px;letter-spacing:3px;color:#444}
  .g-stars .on{color:#ffd23f;text-shadow:0 0 8px #ff9800}
  .g-weapon{font-weight:700;font-size:17px}
  .g-bars{position:absolute;left:12px;bottom:12px;width:170px}
  .g-bar{height:12px;background:rgba(0,0,0,.55);border:1px solid #fff;margin-top:4px}
  .g-bar i{display:block;height:100%;width:100%}
  .g-bar.hp i{background:#e53935}.g-bar.ar i{background:#4da3ff}
  .g-speed{position:absolute;right:14px;bottom:10px;font-weight:900;font-size:28px}
  .g-cross{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid #fff;border-radius:50%;opacity:.8;display:none}
  .g-prompt{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);background:rgba(0,0,0,.6);padding:4px 12px;border-radius:6px;font-weight:700;font-size:18px;white-space:nowrap;display:none}
  .g-prog{position:absolute;left:50%;top:62%;transform:translateX(-50%);width:240px;height:16px;border:2px solid #fff;background:rgba(0,0,0,.6);display:none}
  .g-prog i{display:block;height:100%;width:0;background:#ff5252}
  .g-prog span{position:absolute;left:0;right:0;top:-24px;text-align:center;font-weight:700}
  .g-big{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}
  .g-big b{font:400 42px 'Press Start 2P',cursive;text-shadow:0 0 18px #000}
  .g-big small{font-weight:700;font-size:24px;margin-top:12px}
  .g-fs{position:absolute;right:12px;bottom:50px;background:rgba(0,0,0,.5);border:1px solid #fff;color:#fff;border-radius:6px;font-size:18px;padding:2px 8px}
  .g-shop{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);pointer-events:auto}
  .g-shopbox{background:#12122a;border:2px solid #ff5533;border-radius:10px;padding:16px 20px;min-width:300px;display:flex;flex-direction:column;gap:8px}
  .g-shopbox h3{margin:0;font:400 14px 'Press Start 2P',cursive;color:#ff5533}
  .g-shopmoney{color:#7CFF7C;font-weight:900;font-size:20px}
  .g-shopbox button{background:#1f1f44;color:#fff;border:1px solid #ff5533;border-radius:6px;padding:8px 10px;font-size:16px;font-weight:700}
  .g-shopbox button:hover{background:#ff5533}
  .g-shopbox .g-close{border-color:#888}
  .g-start{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,20,.84);pointer-events:auto;text-align:center;padding:12px}
  .g-start h2{font:400 20px 'Press Start 2P',cursive;color:#00f3ff;margin-bottom:10px;text-shadow:0 0 12px #00f3ff}
  .g-start p{font-size:16px;line-height:1.35;max-width:600px;margin:2px 0;color:#ddd}
  .g-start button{margin-top:14px;padding:10px 22px;font:400 13px 'Press Start 2P',cursive;color:#00f3ff;background:transparent;border:2px solid #00f3ff;border-radius:4px}
  .g-touch{position:absolute;inset:0;pointer-events:none}
  .g-look{position:absolute;right:0;top:0;width:55%;height:100%;pointer-events:auto;touch-action:none}
  .g-joy{position:absolute;left:18px;bottom:18px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.4);pointer-events:auto;touch-action:none}
  .g-joy i{position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.45)}
  .g-b{position:absolute;pointer-events:auto;touch-action:none;width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.5);border:2px solid #fff;color:#fff;font-size:18px;font-weight:900}
  .g-b.g-fire{right:14px;bottom:60px;width:66px;height:66px;background:rgba(229,57,53,.6)}
  .g-b.g-act{right:90px;bottom:18px}.g-b.g-jump{right:14px;bottom:8px}.g-b.g-wpn{right:90px;bottom:74px}
  @media (pointer:coarse){.g-bars{bottom:150px}.g-fs{bottom:auto;top:150px;right:12px}.g-speed{bottom:150px}}
  `;
  document.head.appendChild(styleEl);

  hud = document.createElement('div'); hud.className = 'gta-hud';
  const helpDesktop = '<p><b>ZQSD / flèches</b> : bouger ou conduire &nbsp;·&nbsp; <b>Souris</b> : caméra &nbsp;·&nbsp; <b>Clic / X</b> : tirer</p><p><b>E</b> : monter / descendre, braquer, acheter &nbsp;·&nbsp; <b>Maj</b> : courir &nbsp;·&nbsp; <b>Espace</b> : sauter / frein à main</p><p><b>1-4</b> ou <b>R</b> : armes &nbsp;·&nbsp; <b>H</b> : klaxon &nbsp;·&nbsp; <b>Échap</b> : libérer la souris</p>';
  const helpTouch = '<p>Joystick à gauche : bouger / conduire. Glisse à droite : caméra.</p><p>🔫 tirer · E : monter, braquer, acheter · ⤒ sauter / frein · 🔁 arme</p>';
  hud.innerHTML = '<canvas class="g-map" width="132" height="132"></canvas>' +
    '<div class="g-money">$<span class="v-money">0</span></div><div class="g-toasts"></div>' +
    '<div class="g-top"><div class="g-stars"></div><div class="g-weapon"></div></div>' +
    '<div class="g-bars"><div class="g-bar hp"><i></i></div><div class="g-bar ar"><i></i></div></div>' +
    '<div class="g-speed"></div><div class="g-cross"></div><div class="g-prompt"></div>' +
    '<div class="g-prog"><span></span><i></i></div><div class="g-big"></div>' +
    '<button class="g-fs" title="Plein écran">⛶</button><div class="g-shop"></div>' +
    '<div class="g-start"><h2>ARBEST CITY</h2><p>Ville ouverte : vole des voitures, braque la banque et les magasins, fuis la police. Gagne un maximum d\'argent !</p>' +
    (isTouch ? helpTouch : helpDesktop) + '<button class="g-go">JOUER</button></div>';
  container.appendChild(hud);
  const q = s => hud.querySelector(s);
  toastsEl = q('.g-toasts'); shopEl = q('.g-shop'); bigEl = q('.g-big');
  const H = { money: q('.v-money'), stars: q('.g-stars'), weapon: q('.g-weapon'), hp: q('.g-bar.hp i'), ar: q('.g-bar.ar i'), speed: q('.g-speed'), cross: q('.g-cross'), prompt: q('.g-prompt'), prog: q('.g-prog'), progI: q('.g-prog i'), progT: q('.g-prog span'), start: q('.g-start'), map: q('.g-map') };
  const mctx = H.map.getContext('2d');
  const scoreEl = document.getElementById('current-score');
  const hc = {};
  const setT = (el, k, v) => { if (hc[k] !== v) { hc[k] = v; el.textContent = v; } };
  const setD = (el, k, v) => { if (hc[k] !== v) { hc[k] = v; el.style.display = v; } };

  function drawMap() {
    const g = mctx, W = 132, c = W / 2, s = 0.55;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, W);
    g.save(); g.beginPath(); g.arc(c, c, c - 2, 0, TAU); g.clip();
    g.fillStyle = '#243a28'; g.fillRect(0, 0, W, W);
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
    const a = -cy * s, b = -sy * s, cc = sy * s, d = -cy * s;
    g.setTransform(a, b, cc, d, c - (a * P.x + cc * P.z), c - (b * P.x + d * P.z));
    g.fillStyle = '#8d939c';
    for (let k = 0; k <= N; k++) { g.fillRect(lineC(k) - 9, -HALF - 9, 18, 2 * HALF + 18); g.fillRect(-HALF - 9, lineC(k) - 9, 2 * HALF + 18, 18); }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const bx = blockC(i), bz = blockC(j);
      if (Math.abs(bx - P.x) > 150 || Math.abs(bz - P.z) > 150) continue;
      g.fillStyle = SPECIAL[i + ',' + j] === 'park' ? '#3e7a3a' : '#51565e';
      g.fillRect(bx - 32, bz - 32, 64, 64);
    }
    for (const m of markers) {
      g.fillStyle = '#' + m.color.toString(16).padStart(6, '0');
      g.globalAlpha = m.cool > 0 ? 0.3 : 1;
      g.beginPath(); g.arc(m.x, m.z, 9, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    }
    g.globalAlpha = 1;
    const ph = ((now * 6) | 0) % 2;
    for (const car of cars) if (car.kind === 'cop') { g.fillStyle = ph ? '#ff2a2a' : '#2a5bff'; g.beginPath(); g.arc(car.x, car.z, 6, 0, TAU); g.fill(); }
    for (const p of peds) if (p.kind === 'cop' && !p.dead) { g.fillStyle = '#4da3ff'; g.beginPath(); g.arc(p.x, p.z, 4, 0, TAU); g.fill(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(c, c); g.rotate(-(P.yaw - camYaw));
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  function updateHud() {
    setT(H.money, 'money', String(Math.floor(money)));
    if (scoreEl && hc.score !== earned) { hc.score = earned; scoreEl.innerText = earned; }
    if (hc.stars !== stars) { hc.stars = stars; let h = ''; for (let i = 0; i < 5; i++) h += '<span class="' + (i < stars ? 'on' : '') + '">★</span>'; H.stars.innerHTML = h; }
    const w = WEAPONS[P.weapon];
    setT(H.weapon, 'wpn', w.name + (w.melee ? '' : '  ' + (ammo[P.weapon] | 0)));
    const hp = Math.max(0, P.hp) + '%', ar = P.armor + '%';
    if (hc.hp !== hp) { hc.hp = hp; H.hp.style.width = hp; }
    if (hc.ar !== ar) { hc.ar = ar; H.ar.style.width = ar; }
    const inCar = P.mode === 'car' && P.car;
    setT(H.speed, 'spd', inCar ? Math.round(Math.abs(P.car.speed) * 3.6) + ' km/h' : '');
    setD(H.cross, 'cross', (!inCar && !w.melee && state === 'play' && started) ? 'block' : 'none');
    // invite contextuelle
    let pr = '';
    if (state === 'play') {
      if (inCar) pr = Math.abs(P.car.speed) < 9 ? 'E : Descendre' : '';
      else if (curMarker) {
        const m = curMarker;
        if (m.type === 'heist') pr = m.cool > 0 ? 'Déjà braqué récemment' : (P.weapon === 'fist' ? 'Sors une arme (2-4) puis E : braquer ' + m.name : 'E : Braquer — ' + m.name);
        else if (m.type === 'shop') pr = 'E : Armurerie';
        else if (m.type === 'hospital') pr = 'Soins en cours…';
        else pr = 'Commissariat — évite-le !';
      } else { const c = nearestCar(3.8); if (c) pr = (c.kind === 'traffic' || c.kind === 'cop') ? 'E : Voler le véhicule' : 'E : Monter'; }
    }
    setT(H.prompt, 'prompt', pr); setD(H.prompt, 'promptd', pr ? 'block' : 'none');
    // jauge (braquage / arrestation)
    let pv = -1, pl = '';
    if (heist) { pv = heist.t / heist.dur; pl = 'BRAQUAGE…'; }
    else if (P.arrest > 0.2) { pv = P.arrest / 2.8; pl = 'ARRESTATION !'; }
    setD(H.prog, 'progd', pv >= 0 ? 'block' : 'none');
    if (pv >= 0) { H.progI.style.width = Math.min(100, pv * 100) + '%'; setT(H.progT, 'progt', pl); }
  }

  // ============================================================
  //  ENTRÉES
  // ============================================================
  const KMAP = { z: 'up', w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', q: 'left', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', shift: 'sprint', ' ': 'jump', x: 'fire', h: 'horn' };
  const isLocked = () => document.pointerLockElement === canvas;
  function onKeyDown(e) {
    if (!running) return;
    const k = e.key.toLowerCase();
    if (KMAP[k]) { keys[KMAP[k]] = true; if (k.indexOf('arrow') === 0 || k === ' ') e.preventDefault(); }
    if (e.repeat) return;
    if (k === ' ') pressed.jump = true;
    if (k === 'e' || k === 'f') pressed.act = true;
    if (k === 'r') pressed.wpn = true;
    if (k.length === 1 && k >= '1' && k <= '4') pressed['w' + k] = true;
    if (k === 'escape' && menuOpen) closeShop();
  }
  function onKeyUp(e) { const k = e.key.toLowerCase(); if (KMAP[k]) keys[KMAP[k]] = false; }
  function onBlur() { for (const k in keys) keys[k] = false; firing = false; }
  function onMouseMove(e) {
    if (!isLocked() || paused || menuOpen) return;
    camYaw -= e.movementX * 0.0025; camPitch = clamp(camPitch + e.movementY * 0.0022, -0.2, 1.15); lastLook = now;
  }
  function onMouseDown(e) {
    if (!started || paused || menuOpen) return;
    if (!isLocked() && !isTouch && !noLock) { if (canvas.requestPointerLock) canvas.requestPointerLock(); return; }
    if (e.button === 0) firing = true;
  }
  function onMouseUp(e) { if (e.button === 0) firing = false; }
  function onLockChange() {
    if (!running) return;
    if (isLocked()) { paused = false; H.start.style.display = 'none'; }
    else if (started && !menuOpen && !isTouch && !noLock) { paused = true; showPause(); }
  }
  function onLockError() { noLock = true; paused = false; H.start.style.display = 'none'; toast('Souris non verrouillable : ← → tournent la caméra', '#ffd23f'); }
  function onWheel(e) { if (started && !paused && !menuOpen && e.deltaY !== 0) cycleWeapon(e.deltaY > 0 ? 1 : -1); }
  let eng = null;
  function engineStart() {
    if (eng) return;
    try {
      if (typeof audioCtx === 'undefined') return;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 45; g.gain.value = 0; o.connect(g); g.connect(audioCtx.destination); o.start(); eng = { o, g };
    } catch (e) {}
  }
  function engineUpdate(on) {
    if (!eng) return;
    try {
      const snd_ok = (typeof soundEnabled === 'undefined') || soundEnabled;
      const act = on && P.mode === 'car' && P.car && state === 'play' && snd_ok, sp = act ? Math.abs(P.car.speed) : 0;
      eng.g.gain.value = act ? 0.018 + Math.min(sp, 40) / 40 * 0.03 : 0; eng.o.frequency.value = 38 + sp * 3.2;
    } catch (e) {}
  }
  function begin() {
    started = true; paused = false; H.start.style.display = 'none';
    engineStart();
    if (!isTouch && !noLock && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  }
  function showPause() {
    H.start.querySelector('h2').textContent = 'PAUSE';
    H.start.querySelector('.g-go').textContent = 'REPRENDRE';
    H.start.style.display = 'flex';
  }
  H.start.querySelector('.g-go').addEventListener('click', begin);
  q('.g-fs').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (container.requestFullscreen) container.requestFullscreen();
  });
  function setSize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function onFullscreen() {
    if (!running) return;
    if (document.fullscreenElement === container) {
      container.style.maxWidth = 'none'; container.style.width = '100vw'; container.style.height = '100vh'; container.style.border = '0'; container.style.borderRadius = '0';
      canvas.style.height = '100%';
      const k = Math.min(1, 1280 / window.innerWidth); setSize(Math.round(window.innerWidth * k), Math.round(window.innerHeight * k));
    } else {
      container.style.maxWidth = '960px'; container.style.width = ''; container.style.height = ''; container.style.border = ''; container.style.borderRadius = '';
      canvas.style.height = ''; setSize(960, 540);
    }
  }
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange); document.addEventListener('pointerlockerror', onLockError);
  document.addEventListener('fullscreenchange', onFullscreen); canvas.addEventListener('wheel', onWheel, { passive: true });

  if (isTouch) {
    const t = document.createElement('div'); t.className = 'g-touch';
    t.innerHTML = '<div class="g-look"></div><div class="g-joy"><i></i></div><button class="g-b g-fire">🔫</button><button class="g-b g-act">E</button><button class="g-b g-jump">⤒</button><button class="g-b g-wpn">🔁</button>';
    hud.appendChild(t);
    const joy = t.querySelector('.g-joy'), knob = joy.querySelector('i'), look = t.querySelector('.g-look');
    let joyId = null, lookId = null, lx = 0, ly = 0;
    const moveJoy = e => {
      const r = joy.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const m = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)), a = Math.atan2(dy, dx);
      jx = Math.cos(a) * m; jy = -Math.sin(a) * m;
      knob.style.transform = 'translate(' + (jx * 35) + 'px,' + (-jy * 35) + 'px)';
    };
    joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); moveJoy(e); e.preventDefault(); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
    const endJoy = e => { if (e.pointerId === joyId) { joyId = null; jx = jy = 0; knob.style.transform = ''; } };
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
    look.addEventListener('pointerdown', e => { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(e.pointerId); e.preventDefault(); });
    look.addEventListener('pointermove', e => {
      if (e.pointerId !== lookId) return;
      camYaw -= (e.clientX - lx) * 0.006; camPitch = clamp(camPitch + (e.clientY - ly) * 0.005, -0.2, 1.15);
      lx = e.clientX; ly = e.clientY; lastLook = now;
    });
    const endLook = e => { if (e.pointerId === lookId) lookId = null; };
    look.addEventListener('pointerup', endLook); look.addEventListener('pointercancel', endLook);
    const bind = (sel, down, up) => {
      const b = t.querySelector(sel);
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); down(); });
      const u = () => { if (up) up(); };
      b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u);
    };
    bind('.g-fire', () => { firing = true; }, () => { firing = false; });
    bind('.g-act', () => { pressed.act = true; });
    bind('.g-jump', () => { pressed.jump = true; keys.jump = true; }, () => { keys.jump = false; });
    bind('.g-wpn', () => { pressed.wpn = true; });
  }

  // ============================================================
  //  BOUCLE PRINCIPALE
  // ============================================================
  let loopId = 0, last = 0;
  function step(dt) {
    now += dt; hornT -= dt;
    updateSky(dt);
    if (state !== 'play') { stateT -= dt; if (stateT <= 0) respawn(); }
    updatePlayer(dt);
    updateCars(dt);
    if (P.mode === 'car' && P.car) { P.x = P.car.x; P.z = P.car.z; P.yaw = P.car.ang; }
    updatePeds(dt);
    updateMarkers(dt);
    updateHeist(dt);
    updatePickups(dt);
    updateWanted(dt);
    updateParticles(dt);
    for (const t of tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; }
    updatePlayerMesh();
    updateCamera(dt);
    updateHud();
    engineUpdate(true);
    saveT += dt; if (saveT > 12) { saveT = 0; saveGame(); try { if (typeof updateHighScore === 'function') updateHighScore('gta', earned); } catch (e) {} }
  }
  function frame(ts) {
    if (!running) return;
    loopId = requestAnimationFrame(frame);
    try { currentGameLoop = loopId; } catch (e) {}
    const dt = Math.min(0.05, ((ts - last) / 1000) || 0.016); last = ts;
    if (started && !paused && !menuOpen) step(dt);
    else { updatePlayerMesh(); updateCamera(0.016); updateHud(); engineUpdate(false); }
    drawMap();
    renderer.render(scene, camera);
  }

  // ============================================================
  //  NETTOYAGE (appelé par stopAllGames)
  // ============================================================
  window._gtaCleanup = function () {
    if (!running) return;
    running = false;
    try { cancelAnimationFrame(loopId); } catch (e) {}
    saveGame();
    try { if (typeof updateHighScore === 'function') updateHighScore('gta', earned); } catch (e) {}
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    document.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('pointerlockchange', onLockChange); document.removeEventListener('pointerlockerror', onLockError);
    document.removeEventListener('fullscreenchange', onFullscreen);
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    try { if (eng) { eng.g.gain.value = 0; eng.o.stop(); eng = null; } } catch (e) {}
    try { if (hud && hud.parentNode) hud.parentNode.removeChild(hud); if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); } catch (e) {}
    try { for (const d of disposables) if (d && d.dispose) d.dispose(); } catch (e) {}
    try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    const fresh = document.createElement('canvas');
    fresh.id = 'game-canvas'; fresh.width = 600; fresh.height = 400;
    if (canvas.parentNode) canvas.parentNode.replaceChild(fresh, canvas);
    container.style.maxWidth = ''; container.style.width = ''; container.style.height = ''; container.style.border = ''; container.style.borderRadius = '';
    window._gtaCleanup = null;
  };

  // ---------- Lancement ----------
  setTimeout(() => toast('Ta voiture de sport est garée juste à côté — E pour monter', '#7fe8ff'), 400);
  loopId = requestAnimationFrame(frame);
  try { currentGameLoop = loopId; } catch (e) {}
}