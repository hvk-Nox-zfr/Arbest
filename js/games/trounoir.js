/* Trou Noir 3D — avale la ville ! Façon Hole.io, en vraie 3D (Three.js, déjà chargé par ton site avec needs3D: true).
 * Format du site : startBlackHoleGame() · #game-canvas · #current-score · triggerGameOver(score) · playSound
 * Contrôles : souris (le trou te suit) · doigt (joystick) · WASD / ZQSD / flèches · F = plein écran
 */
function startBlackHoleGame() {
  if (window.__holeStop) { try { window.__holeStop(); } catch (e) {} }
  const cv = document.getElementById('game-canvas');
  if (!cv) return;
  if (typeof THREE === 'undefined') { console.error('Three.js manquant : mets needs3D: true pour ce jeu'); return; }
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
  const TAU = Math.PI * 2, WS = 420, BL = 56, PITCH = 70, OFF = 7, NB = 6, GY = .25, TIME = 120, CELL = 20;
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const TY = {
    person: { need: 1.5, pts: 1, nm: 'les passants' }, small: { need: 2.1, pts: 2, nm: 'le mobilier' }, lamp: { need: 2.7, pts: 2, nm: 'les lampadaires' },
    tree: { need: 3.4, pts: 3, nm: 'les arbres' }, car: { need: 4.2, pts: 5, nm: 'les voitures' }, bus: { need: 6.5, pts: 10, nm: 'les bus' },
    house: { need: 8, pts: 15, nm: 'les maisons' }, shop: { need: 10.5, pts: 30, nm: 'les commerces' }, tower: { need: 14, pts: 60, nm: 'les tours' },
    sky: { need: 18, pts: 120, nm: 'les gratte-ciel' }, mega: { need: 24, pts: 250, nm: 'la tour géante' }
  };
  const NAMES = [['Nébula', '#ff5fa2', 330], ['Quasar', '#ff9f1c', 35], ['Vortex', '#43d17a', 145], ['Abysse', '#a855f7', 270]];
  const LV = [0, 8, 25, 55, 110, 200, 330, 500, 750, 1100, 1500, 2100];
  const Rof = p => 2.4 + .6 * Math.sqrt(p);
  const lvOf = p => { let l = 0; while (l + 1 < LV.length && p >= LV[l + 1]) l++; return l; };

  /* ---------- Moteur 3D ---------- */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); } catch (e) { console.error('WebGL indisponible', e); return; }
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(1); renderer.setClearColor(0xbfe4ff); renderer.shadowMap.enabled = !coarse; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.autoUpdate = false; scene.background = new THREE.Color(0xbfe4ff); scene.fog = new THREE.Fog(0xbfe4ff, 60, 320);
  const camera = new THREE.PerspectiveCamera(48, 1.5, .5, 1500);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d97a3, .95));
  const sun = new THREE.DirectionalLight(0xfff0d8, .8); sun.castShadow = !coarse; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0006; sun.shadow.camera.near = 1; sun.shadow.camera.far = 320;
  scene.add(sun); scene.add(sun.target);
  const lam = o => new THREE.MeshLambertMaterial(o);
  const ctex = (size, draw, rep) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (rep) t.repeat.set(rep, rep); return t; };

  /* ---------- Textures ---------- */
  const texAsphalt = ctex(128, (g, s) => { g.fillStyle = '#4a4c54'; g.fillRect(0, 0, s, s); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); } });
  const texSide = ctex(128, (g, s) => { g.fillStyle = '#d9d4c6'; g.fillRect(0, 0, s, s); g.strokeStyle = '#bfb9a8'; g.lineWidth = 3; g.strokeRect(0, 0, s / 2, s / 2); g.strokeRect(s / 2, 0, s / 2, s / 2); g.strokeRect(0, s / 2, s / 2, s / 2); g.strokeRect(s / 2, s / 2, s / 2, s / 2); });
  const texGrass = ctex(128, (g, s) => { g.fillStyle = '#79c45a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '40,120,40' : '190,240,120'},.12)`; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); } });
  const wallTex = (base, glass, brick) => ctex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    if (brick) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; for (let y = 0; y < s; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); for (let x = (y / 8 % 2) * 8; x < s; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } } }
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x = i * 64 + 14, y = j * 64 + 12; g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - 2, y - 2, 40, 46); g.fillStyle = glass; g.fillRect(x, y, 36, 42); g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(x, y + 42); g.lineTo(x + 36, y); g.lineTo(x + 36, y + 11); g.lineTo(x + 11, y + 42); g.fill(); }
  });
  const glassTex = (base, a, b) => ctex(128, (g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const gr = g.createLinearGradient(0, j * 32, 0, j * 32 + 30); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(i * 32 + 2, j * 32 + 2, 28, 27); } });
  const wallMats = [['#b5533c', '#5d7a99', 1], ['#e3d2b0', '#6a88a8'], ['#e9eaee', '#5a7aa0'], ['#9aa1ab', '#46607e'], ['#c9a679', '#5d7a99', 1], ['#a9bfa3', '#4f6f8f']].map(a => lam({ map: wallTex(a[0], a[1], a[2]) }));
  const glassMats = [['#262f43', '#5f86b3', '#2d4468'], ['#1f3a4d', '#58a6c4', '#245a74'], ['#2b2f3a', '#8aa0bd', '#41506a']].map(a => lam({ map: glassTex(a[0], a[1], a[2]) }));
  const roofMat = lam({ color: 0x80858e }), roofRed = lam({ color: 0xb04a36 }), roofBrown = lam({ color: 0x7d5a44 }), goldMat = lam({ color: 0xe8b94a }), vcMat = lam({ vertexColors: true });
  const awnMats = [0xd9534f, 0x3b82c4, 0x4aa86b, 0xe9a23b].map(c => lam({ color: c }));

  /* ---------- Constructeur de géométrie fusionnée (couleurs de sommets) ---------- */
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 8), CONE = new THREE.ConeGeometry(1, 1, 6), ICO = new THREE.IcosahedronGeometry(1, 0);
  function GB(uvs) {
    const P = [], N = [], Cc = [], U = [];
    return {
      add(geo, x, y, z, col, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
        geo = geo.index ? geo.toNonIndexed() : geo.clone();
        geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
        geo.computeVertexNormals(); const p = geo.attributes.position.array, n = geo.attributes.normal.array, c = new THREE.Color(col);
        for (let i = 0; i < p.length; i += 3) { P.push(p[i], p[i + 1], p[i + 2]); N.push(n[i], n[i + 1], n[i + 2]); Cc.push(c.r, c.g, c.b); if (uvs) U.push(p[i] / 6, p[i + 2] / 6); }
      },
      box(w, h, d, x, y, z, col) { this.add(BOX, x, y + h / 2, z, col, w, h, d); },
      cyl(r, h, x, y, z, col) { this.add(CYL, x, y + h / 2, z, col, r, h, r); },
      build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeBoundingSphere(); return g; }
    };
  }

  /* ---------- Modèles low poly (1 appel de dessin chacun) ---------- */
  const PERSON = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c'].map(c => { const b = GB(); b.box(.15, .8, .17, -.11, 0, 0, '#2f3a52'); b.box(.15, .8, .17, .11, 0, 0, '#2f3a52'); b.box(.48, .64, .27, 0, .8, 0, c); b.box(.13, .56, .15, -.32, .82, 0, c); b.box(.13, .56, .15, .32, .82, 0, c); b.add(ICO, 0, 1.64, 0, '#f1c9a0', .2, .2, .2); b.add(ICO, 0, 1.72, -.02, '#3b2a1a', .2, .14, .2); return b.build(); });
  const CAR = ['#e63946', '#2a6fdb', '#f4f4f4', '#222', '#f1c40f', '#2ecc71', '#8e44ad', '#ff8c42', '#9aa4b0'].map(c => {
    const b = GB(); b.box(4.3, .75, 1.85, 0, .3, 0, c); b.box(2.3, .6, 1.7, -.2, 1.0, 0, '#2d3b4d'); b.box(2.1, .12, 1.55, -.2, 1.56, 0, c); b.box(.1, .2, .4, 2.15, .55, .6, '#fff2a8'); b.box(.1, .2, .4, 2.15, .55, -.6, '#fff2a8');
    for (const [x, z] of [[1.4, .95], [-1.4, .95], [1.4, -.95], [-1.4, -.95]]) b.add(CYL, x, .38, z, '#17171b', .38, .3, .38, Math.PI / 2); return b.build(); });
  const BUS = ['#f2b705', '#2a6fdb', '#e8e8ee'].map(c => { const b = GB(); b.box(9.6, 2.7, 2.6, 0, .4, 0, c); b.box(9.7, .95, 2.65, 0, 1.55, 0, '#33506b'); b.box(.1, .3, 2.2, 4.8, 1.1, 0, '#fff2a8'); for (const x of [-3, 3]) for (const z of [-1.3, 1.3]) b.add(CYL, x, .5, z, '#17171b', .5, .4, .5, Math.PI / 2); return b.build(); });
  const TREE = (() => {
    const out = []; for (const g of ['#2f7d3a', '#3a8f45', '#26703a']) { const b = GB(); b.cyl(.3, 1.8, 0, 0, 0, '#6b4a2b'); b.add(CONE, 0, 2.7, 0, g, 2.2, 2.6, 2.2); b.add(CONE, 0, 4.1, 0, g, 1.7, 2.3, 1.7); b.add(CONE, 0, 5.3, 0, '#4fae5c', 1.1, 2, 1.1); out.push(b.build()); }
    for (const g of ['#5fb04c', '#7cc455', '#e0a030']) { const b = GB(); b.cyl(.32, 2.4, 0, 0, 0, '#74502f'); b.add(ICO, 0, 3.6, 0, g, 2.1, 1.9, 2.1); b.add(ICO, .6, 4.5, .3, '#8ed15f', 1.3, 1.2, 1.3); out.push(b.build()); } return out; })();
  const LAMP = (() => { const b = GB(); b.cyl(.13, 7.5, 0, 0, 0, '#5b606a'); b.box(2.4, .16, .18, 1.1, 7.4, 0, '#5b606a'); b.box(.95, .22, .45, 2.3, 7.28, 0, '#e8e8ee'); return b.build(); })();
  const PROPS = (() => {
    const mk = f => { const b = GB(); f(b); return b.build(); };
    return [mk(b => { b.cyl(.26, .75, 0, 0, 0, '#d63a3a'); b.cyl(.3, .12, 0, .75, 0, '#b32d2d'); b.box(.6, .16, .16, 0, .4, 0, '#d63a3a'); }),
      mk(b => { b.box(.7, 1.1, .55, 0, 0, 0, '#2d6fc4'); b.add(CYL, 0, 1.1, 0, '#2d6fc4', .35, .55, .27, Math.PI / 2); }),
      mk(b => { b.cyl(.42, .95, 0, 0, 0, '#5d636d'); b.cyl(.46, .1, 0, .95, 0, '#444'); }),
      mk(b => { b.box(1.8, .12, .5, 0, .5, 0, '#8a5a35'); b.box(1.8, .5, .1, 0, .6, -.22, '#8a5a35'); b.box(.1, .5, .4, -.8, 0, 0, '#333'); b.box(.1, .5, .4, .8, 0, 0, '#333'); }),
      mk(b => { b.box(1.1, 1.0, 1.1, 0, 0, 0, '#b98a54'); b.box(1.12, .12, 1.12, 0, .45, 0, '#9a6f3d'); }),
      mk(b => { b.add(CONE, 0, .4, 0, '#ff7a1a', .32, .8, .32); b.box(.7, .06, .7, 0, 0, 0, '#333'); }),
      mk(b => { b.box(1.5, 1.5, 1.2, 0, 0, 0, '#2f6f4f'); b.box(1.6, .12, 1.3, 0, 1.5, 0, '#244f3a'); })];
  })();

  /* ---------- Variables de jeu ---------- */
  let W = 600, H = 400, hu = 1, rw = 0, rh = 0, st = 'play', T = 0, timeLeft = TIME, lt = 0, raf = 0, alive = true, timer = 0, shake = 0, banner = 3.2, endMsg = '', lastSnd = 0, kills = 0;
  let objs = [], grid = new Map(), mv = [], swl = [], holes = [], me, pops = [], camDist = 22, camX = 0, camZ = 0;
  const mouse = { x: 0, y: 0, in: false, down: false, touch: false, ax: 0, ay: 0 }, keys = {}, v3 = new THREE.Vector3();
  const setScore = v => { if (scoreEl) scoreEl.textContent = v; };
  const gkey = (x, z) => Math.floor(x / CELL) * 100 + Math.floor(z / CELL);
  const ov = document.createElement('canvas'); ov.style.cssText = 'position:absolute;pointer-events:none;background:transparent;border:0;margin:0;padding:0;max-width:none;max-height:none;box-shadow:none;border-radius:0;'; cv.parentNode.insertBefore(ov, cv.nextSibling); const X = ov.getContext('2d');

  /* ---------- Particules ---------- */
  const NP = 260, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pV = new Float32Array(NP * 3), pL = new Float32Array(NP); let pIdx = 0;
  for (let i = 0; i < NP; i++) pPos[i * 3 + 1] = -100;
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pointsObj = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .7, vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })); pointsObj.frustumCulled = false; scene.add(pointsObj);
  function burst(x, y, z, col, n, sp) {
    const c = new THREE.Color(col);
    for (let i = 0; i < n; i++) { const k = pIdx++ % NP, a = Math.random() * TAU, s = rnd(.3, 1) * sp; pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z; pV[k * 3] = Math.cos(a) * s; pV[k * 3 + 1] = rnd(3, 9); pV[k * 3 + 2] = Math.sin(a) * s; pL[k] = rnd(.5, 1); pCol[k * 3] = c.r; pCol[k * 3 + 1] = c.g; pCol[k * 3 + 2] = c.b; }
  }

  /* ---------- La ville ---------- */
  function addStaticMesh(geo, mat, shadow) { const m = new THREE.Mesh(geo, mat); m.receiveShadow = !!shadow; scene.add(m); m.updateMatrixWorld(true); return m; }
  function buildWorld() {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), lam({ map: (() => { const t = texGrass.clone(); t.needsUpdate = true; t.repeat.set(250, 250); return t; })() })); outer.rotation.x = -Math.PI / 2; outer.position.set(WS / 2, -.12, WS / 2); scene.add(outer); outer.updateMatrixWorld(true);
    const base = new THREE.Mesh(new THREE.PlaneGeometry(WS, WS), lam({ map: (() => { const t = texAsphalt.clone(); t.needsUpdate = true; t.repeat.set(WS / 8, WS / 8); return t; })() })); base.rotation.x = -Math.PI / 2; base.position.set(WS / 2, 0, WS / 2); base.receiveShadow = true; scene.add(base); base.updateMatrixWorld(true);
    const side = GB(true), grass = GB(true), marks = GB(), deco = GB();
    const parks = [[0, 0], [0, 5], [5, 0], [5, 5]];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const bx = OFF + i * PITCH, bz = OFF + j * PITCH, park = parks.some(p => p[0] === i && p[1] === j), d = Math.max(Math.abs(i - 2.5), Math.abs(j - 2.5));
      side.box(BL, GY, BL, bx + BL / 2, 0, bz + BL / 2, '#ffffff');
      if (park || d > 2) grass.box(BL - 8, .05, BL - 8, bx + BL / 2, GY, bz + BL / 2, '#ffffff');
      if (park) { marks.box(3, .03, BL - 8, bx + BL / 2, GY + .05, bz + BL / 2, '#e8d9a8'); marks.box(BL - 8, .03, 3, bx + BL / 2, GY + .05, bz + BL / 2, '#e8d9a8'); }
    }
    for (let k = 1; k < NB; k++) {
      const c = k * PITCH;
      for (let t = 4; t < WS - 4; t += 7) { marks.box(.35, .03, 3.4, c, .02, t, '#f2c94c'); marks.box(3.4, .03, .35, t, .02, c, '#f2c94c'); }
      for (let m = 1; m < NB; m++) {
        const ic = m * PITCH;
        for (let s = 0; s < 6; s++) { const o = -5.2 + s * 2.1; for (const e of [-9, 9]) { marks.box(.7, .03, 3.2, c + o, .025, ic + e, '#f4f4f0'); marks.box(3.2, .03, .7, c + e, .025, ic + o, '#f4f4f0'); } }
      }
    }
    addStaticMesh(side.build(), lam({ map: texSide }), true); addStaticMesh(grass.build(), lam({ map: texGrass }), true); addStaticMesh(marks.build(), vcMat, true);
    const lakeX = OFF + 5 * PITCH + BL / 2, lakeZ = OFF + 5 * PITCH + BL / 2;
    const sand = new THREE.Mesh(new THREE.CircleGeometry(19, 20), lam({ color: 0xe9d9a0 })); sand.rotation.x = -Math.PI / 2; sand.position.set(lakeX, GY + .08, lakeZ); scene.add(sand); sand.updateMatrixWorld(true);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(16.5, 20), lam({ color: 0x3a9bd8 })); lake.rotation.x = -Math.PI / 2; lake.position.set(lakeX, GY + .1, lakeZ); scene.add(lake); lake.updateMatrixWorld(true);
    // décor lointain : montagnes, forêt
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * TAU + rnd(-.05, .05), r = rnd(330, 520), x = WS / 2 + Math.cos(a) * r, z = WS / 2 + Math.sin(a) * r, h = rnd(50, 130), w = h * rnd(.9, 1.4);
      deco.add(CONE, x, h / 2 - 4, z, '#8696ad', w, h, w, 0, rnd(0, 3)); if (h > 85) deco.add(CONE, x, h * .84 - 4, z, '#f4f8ff', w * .3, h * .32, w * .3);
    }
    for (let i = 0; i < 260; i++) { const a = rnd(0, TAU), r = rnd(250, 400), x = WS / 2 + Math.cos(a) * r, z = WS / 2 + Math.sin(a) * r; if (x > -10 && x < WS + 10 && z > -10 && z < WS + 10) continue; const s = rnd(.8, 1.6); deco.cyl(.3 * s, 1.8 * s, x, -.1, z, '#6b4a2b'); deco.add(CONE, x, 3.2 * s, z, pick(['#2f7d3a', '#3a8f45', '#4aa04f']), 2.2 * s, 4.4 * s, 2.2 * s); }
    addStaticMesh(deco.build(), vcMat, false);
  }

  /* ---------- Objets comestibles ---------- */
  function addObj(t, mesh, x, z, gy, rot, h, extra) {
    const ty = TY[t]; mesh.position.set(x, gy, z); mesh.rotation.y = rot || 0; mesh.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(mesh); mesh.updateMatrixWorld(true);
    const o = Object.assign({ t, mesh, x, z, gy, need: ty.need, pts: ty.pts, h, sw: null, dead: false, rot: rot || 0 }, extra || {});
    if (o.mv) mv.push(o); else { objs.push(o); const k = gkey(x, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); }
    return o;
  }
  function bGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) { if (f === 2 || f === 3) continue; const fw = f < 2 ? d : w; for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * fw / 8, uv.getY(k) * h / 8); } }
    g.translate(0, h / 2, 0); return g;
  }
  const mesh = (g, m) => new THREE.Mesh(g, m), boxM = (w, h, d, m, x, y, z) => { const b = mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); return b; };
  function mkHouse(x, z, w, d, rot) {
    const h = rnd(5, 6.5), g = new THREE.Group(), wm = pick(wallMats), rh = rnd(3, 4.2); g.add(mesh(bGeo(w, h, d), [wm, wm, roofMat, roofMat, wm, wm]));
    const rg = new THREE.ConeGeometry(.7071, 1, 4); rg.rotateY(Math.PI / 4); rg.scale(w * 1.14, rh, d * 1.14); rg.translate(0, h + rh / 2, 0); g.add(mesh(rg, Math.random() < .5 ? roofRed : roofBrown)); g.add(boxM(1, 2.2, 1, roofMat, w * .25, h + 1, d * .15));
    addObj('house', g, x, z, GY + .05, rot, h + rh, { r: Math.max(w, d) / 2 });
  }
  function mkShop(x, z, w, d, rot) {
    const h = rnd(9, 14), g = new THREE.Group(), wm = pick(wallMats); g.add(mesh(bGeo(w, h, d), [wm, wm, roofMat, roofMat, wm, wm]));
    g.add(boxM(w * .92, .5, 2.4, pick(awnMats), 0, 3.4, d / 2 + 1.1)); g.add(boxM(3, 1.6, 3, roofMat, -w * .2, h, 0)); addObj('shop', g, x, z, GY, rot, h + 1.6, { r: Math.max(w, d) / 2 });
  }
  function mkTower(x, z, w, d, h, rot) {
    const g = new THREE.Group(), gm = Math.random() < .55 ? pick(glassMats) : pick(wallMats); g.add(mesh(bGeo(w, h, d), [gm, gm, roofMat, roofMat, gm, gm])); g.add(boxM(w * .55, 3, d * .55, roofMat, 0, h, 0));
    g.add(boxM(.25, 6, .25, roofMat, w * .15, h + 3, 0)); addObj('tower', g, x, z, GY, rot, h + 9, { r: Math.max(w, d) / 2 });
  }
  function mkSky(x, z, w, d, h, rot) {
    const g = new THREE.Group(), gm = pick(glassMats), b = h * .64, u = h * .36; g.add(mesh(bGeo(w, b, d), [gm, gm, roofMat, roofMat, gm, gm]));
    const up = mesh(bGeo(w * .66, u, d * .66), [gm, gm, roofMat, roofMat, gm, gm]); up.position.y = b; g.add(up); g.add(boxM(.35, 10, .35, roofMat, 0, h, 0)); g.add(boxM(.8, .8, .8, lam({ color: 0xff3b3b }), 0, h + 10, 0));
    addObj('sky', g, x, z, GY, rot, h + 11, { r: Math.max(w, d) / 2 });
  }
  function mkMega(x, z) {
    const g = new THREE.Group(), gm = glassMats[1], w = 22, h1 = 55, h2 = 38, h3 = 22; g.add(mesh(bGeo(w, h1, w), [gm, gm, roofMat, roofMat, gm, gm]));
    const m2 = mesh(bGeo(w * .7, h2, w * .7), [gm, gm, roofMat, roofMat, gm, gm]); m2.position.y = h1; g.add(m2); const m3 = mesh(bGeo(w * .42, h3, w * .42), [gm, gm, roofMat, roofMat, gm, gm]); m3.position.y = h1 + h2; g.add(m3);
    const sp = mesh(new THREE.ConeGeometry(2.4, 26, 6), goldMat); sp.position.y = h1 + h2 + h3 + 13; g.add(sp); addObj('mega', g, x, z, GY, 0, h1 + h2 + h3 + 26, { r: w / 2 });
  }
  const mkTree = (x, z, gy) => addObj('tree', mesh(pick(TREE), vcMat), x, z, gy || GY, rnd(0, TAU), 6, { r: 1.6 });
  const mkProp = (x, z) => addObj('small', mesh(pick(PROPS), vcMat), x, z, GY, rnd(0, TAU), 1.5, { r: .6 });
  const mkLamp = (x, z, rot) => addObj('lamp', mesh(LAMP, vcMat), x, z, GY, rot, 7.6, { r: .4 });
  function populate() {
    objs = []; mv = []; grid = new Map();
    const parks = [[0, 0], [0, 5], [5, 0], [5, 5]];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const bx = OFF + i * PITCH, bz = OFF + j * PITCH, d = Math.max(Math.abs(i - 2.5), Math.abs(j - 2.5)), park = parks.some(p => p[0] === i && p[1] === j), lake = i === 5 && j === 5;
      if (park) {
        for (let n = 0; n < 16; n++) { const x = bx + rnd(6, 50), z = bz + rnd(6, 50); if (lake && Math.hypot(x - bx - 28, z - bz - 28) < 21) continue; mkTree(x, z, GY + .05); }
        for (let n = 0; n < 6; n++) { const x = bx + rnd(6, 50), z = bz + rnd(6, 50); if (!(lake && Math.hypot(x - bx - 28, z - bz - 28) < 21)) mkProp(x, z); }
      } else if (d < 1) {
        const cols = 2, lw = BL / cols;
        for (let a = 0; a < cols; a++) for (let b = 0; b < cols; b++) { const x = bx + lw * (a + .5), z = bz + lw * (b + .5); if (i === 3 && j === 3 && a === 0 && b === 0) mkMega(x, z); else mkSky(x, z, rnd(16, 20), rnd(16, 20), rnd(55, 95), 0); }
      } else if (d < 2) {
        const cols = 2, lw = BL / cols;
        for (let a = 0; a < cols; a++) for (let b = 0; b < cols; b++) { const x = bx + lw * (a + .5), z = bz + lw * (b + .5), r = Math.random();
          if (r < .6) mkTower(x, z, rnd(13, 17), rnd(13, 17), rnd(28, 48), 0); else if (r < .85) mkShop(x, z, rnd(16, 19), rnd(12, 15), 0); else mkHouse(x, z, rnd(10, 12), rnd(9, 11), 0); }
      } else {
        const cols = 3, lw = BL / cols;
        for (let a = 0; a < cols; a++) for (let b = 0; b < cols; b++) { const x = bx + lw * (a + .5), z = bz + lw * (b + .5), r = Math.random();
          if (r < .5) mkHouse(x, z, rnd(9, 11.5), rnd(8, 10.5), rnd(-.15, .15)); else if (r < .72) mkShop(x, z, rnd(12, 14.5), rnd(10, 12), 0); else { mkTree(x - 2, z - 1, GY + .05); mkTree(x + 3, z + 2, GY + .05); } }
      }
      for (const [x, z, r] of [[3, 3, 0], [BL - 3, 3, Math.PI], [3, BL - 3, 0], [BL - 3, BL - 3, Math.PI]]) mkLamp(bx + x, bz + z, r);
      for (let n = 0; n < 5; n++) { const e = Math.floor(rnd(0, 4)), t = rnd(5, BL - 5); const x = e < 2 ? bx + t : e === 2 ? bx + 2.5 : bx + BL - 2.5, z = e === 0 ? bz + 2.5 : e === 1 ? bz + BL - 2.5 : bz + t; if (Math.random() < .55) mkTree(x, z); else mkProp(x, z); }
    }
    for (let n = 0; n < 110; n++) {
      const bi = Math.floor(rnd(0, NB)), bj = Math.floor(rnd(0, NB)), e = Math.floor(rnd(0, 4)), t = rnd(3, BL - 3), bx = OFF + bi * PITCH, bz = OFF + bj * PITCH;
      const x = e < 2 ? bx + t : e === 2 ? bx + 1.4 : bx + BL - 1.4, z = e === 0 ? bz + 1.4 : e === 1 ? bz + BL - 1.4 : bz + t, hz = e < 2;
      const sp = rnd(.9, 1.5), dir = Math.random() < .5 ? 1 : -1;
      addObj('person', mesh(pick(PERSON), vcMat), x, z, GY, 0, 1.8, { mv: true, r: .4, hz, vx: hz ? sp * dir : 0, vz: hz ? 0 : sp * dir, lo: hz ? bx + 1 : bz + 1, hi: hz ? bx + BL - 1 : bz + BL - 1, wt: rnd(0, 3), ph: rnd(0, 6), fleeing: false });
    }
    for (let n = 0; n < 46; n++) {
      const hz = Math.random() < .5, k = 1 + Math.floor(rnd(0, NB - 1)), lane = Math.random() < .5 ? -3.5 : 3.5, dir = lane < 0 ? 1 : -1, bus = n % 7 === 0, sp = rnd(7, 12) * dir, pos = rnd(10, WS - 10);
      const m = mesh(bus ? pick(BUS) : pick(CAR), vcMat), c = k * PITCH + lane; const rot = hz ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      addObj(bus ? 'bus' : 'car', m, hz ? pos : c, hz ? c : pos, 0, rot, bus ? 3.2 : 1.8, { mv: true, r: bus ? 5 : 2.3, hz, dir, sp: Math.abs(sp) });
    }
  }

  /* ---------- Trous noirs ---------- */
  const swirlTex = hue => ctex(256, (g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s); const c = s / 2;
    for (let arm = 0; arm < 3; arm++) { g.strokeStyle = `hsla(${hue},90%,65%,.32)`; g.lineWidth = 5; g.beginPath(); for (let k = 0; k <= 30; k++) { const f = k / 30, a = arm * 2.094 + f * 4.6, r = c * (.96 - .86 * f); k ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.stroke(); }
    const e = g.createRadialGradient(c, c, c * .75, c, c, c); e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, `hsla(${hue},70%,18%,.9)`); g.fillStyle = e; g.fillRect(0, 0, s, s);
  });
  const glowTex = hue => ctex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, s * .2, s / 2, s / 2, s / 2); r.addColorStop(0, `hsla(${hue},95%,60%,.55)`); r.addColorStop(1, `hsla(${hue},95%,60%,0)`); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  function mkHoleMesh(color, hue) {
    const g = new THREE.Group(), flat = m => { m.rotation.x = -Math.PI / 2; return m; };
    const disc = flat(mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: swirlTex(hue) })));
    const ring = flat(mesh(new THREE.RingGeometry(.92, 1.07, 48), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))); ring.position.y = .01;
    const ring2 = flat(mesh(new THREE.RingGeometry(1.07, 1.2, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); ring2.position.y = .012;
    const glow = flat(mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: glowTex(hue), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); glow.position.y = .006;
    g.add(glow, disc, ring, ring2); scene.add(g); return { g, disc, ring, ring2, glow };
  }
  function mkHole(name, color, hue, ai) {
    const x = pick([70, 140, 210, 280, 350]), z = pick([70, 140, 210, 280, 350]), p = ai ? rnd(0, 25) : 0, m = mkHoleMesh(color, hue);
    return { name, color, hue, ai, x, z, vx: 0, vz: 0, pts: p, R: Rof(p), Rt: Rof(p), alive: true, resp: 0, tx: x, tz: z, tt: 0, fl: 0, m, spin: 0 };
  }
  function newGame() {
    populate(); swl = []; pops = []; timeLeft = TIME; st = 'play'; banner = 3.2; kills = 0; shake = 0;
    me = mkHole('Toi', '#2aa4ff', 205, false); me.x = me.z = 140; holes = [me]; for (const [n, c, h] of NAMES) holes.push(mkHole(n, c, h, true));
    camX = me.x; camZ = me.z; setScore(0);
  }

  /* ---------- Logique ---------- */
  function snd2(f, d, t) { if (T - lastSnd > .05) { lastSnd = T; snd(f, d, t); } }
  function startSwallow(o, h) {
    o.sw = { h, k: 0, d: .45 + o.need * .03, tx: rnd(-.5, .5), tz: rnd(-.5, .5), x0: o.x, z0: o.z }; o.mesh.matrixAutoUpdate = true; swl.push(o);
  }
  function finishSwallow(o) {
    const h = o.sw.h; o.dead = true; o.mesh.visible = false; scene.remove(o.mesh);
    if (h.alive) {
      h.pts += o.pts; h.Rt = Rof(h.pts); burst(h.x, .6, h.z, h.color, o.need > 8 ? 14 : 4, h.R * 1.4);
      if (h === me) { setScore(me.pts); pops.push({ x: h.x, y: 2, z: h.z - h.R, s: '+' + o.pts, t: 0 }); snd2(520 - Math.min(o.need, 24) * 12, .08 + o.need * .006, 'triangle'); if (o.need >= 14) shake = .5; }
    }
  }
  function eatStatic(h) {
    const r = h.R, x0 = Math.floor((h.x - r) / CELL), x1 = Math.floor((h.x + r) / CELL), z0 = Math.floor((h.z - r) / CELL), z1 = Math.floor((h.z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const a = grid.get(cx * 100 + cz); if (!a) continue; for (const o of a) { if (o.dead || o.sw || r < o.need) continue; if (Math.hypot(o.x - h.x, o.z - h.z) < r * .98) startSwallow(o, h); } }
  }
  function die(msg) { if (st !== 'play') return; st = 'over'; endMsg = msg; snd(90, .7, 'sawtooth'); shake = 1; timer = setTimeout(() => { if (typeof triggerGameOver === 'function') triggerGameOver(me.pts); }, 1800); }
  function aiThink(h) {
    h.fl = 0; let bs = -1, tx = h.x, tz = h.z;
    for (const o of holes) {
      if (o === h || !o.alive) continue; const d = Math.hypot(o.x - h.x, o.z - h.z);
      if (o.R > h.R * 1.15 && d < o.R * 3 + 14) { h.tx = clamp(h.x + (h.x - o.x), 8, WS - 8); h.tz = clamp(h.z + (h.z - o.z), 8, WS - 8); h.fl = 1; return; }
      if (h.R > o.R * 1.25 && d < 90) { const s = 60 / (d + 6); if (s > bs) { bs = s; tx = o.x; tz = o.z; } }
    }
    const x0 = Math.floor((h.x - 70) / CELL), x1 = Math.floor((h.x + 70) / CELL), z0 = Math.floor((h.z - 70) / CELL), z1 = Math.floor((h.z + 70) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const a = grid.get(cx * 100 + cz); if (!a) continue; for (const o of a) { if (o.dead || o.sw || o.need > h.R) continue; const s = (o.pts + 1) / (Math.hypot(o.x - h.x, o.z - h.z) + 8); if (s > bs) { bs = s; tx = o.x; tz = o.z; } } }
    if (bs < 0) { tx = rnd(30, WS - 30); tz = rnd(30, WS - 30); }
    h.tx = tx; h.tz = tz;
  }
  function toScreen(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H, v3.z]; }

  function update(dt) {
    T += dt; banner = Math.max(0, banner - dt); shake *= .9;
    if (st === 'play') { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; const rank = holes.filter(h => h.alive).sort((a, b) => b.pts - a.pts).indexOf(me) + 1; die(rank === 1 ? 'Victoire ! Tu es le plus gros trou noir !' : 'Temps écoulé ! Classement : ' + rank + 'e'); } }
    for (const h of holes) {
      if (!h.alive) { if (!h.ai) continue; h.resp -= dt; if (h.resp <= 0) { let x, z, tr = 0; do { x = pick([70, 140, 210, 280, 350]); z = pick([70, 140, 210, 280, 350]); } while (Math.hypot(x - me.x, z - me.z) < 80 && tr++ < 20); h.x = x; h.z = z; h.vx = h.vz = 0; h.pts = Math.min(h.pts * .3, 120); h.R = h.Rt = Rof(h.pts); h.alive = true; h.m.g.visible = true; } continue; }
      h.R += (h.Rt - h.R) * Math.min(1, dt * 5); h.spin += dt * 1.2;
      let ix = 0, iz = 0;
      if (h === me && st === 'play') {
        if (keys.l) ix -= 1; if (keys.r) ix += 1; if (keys.u) iz -= 1; if (keys.d) iz += 1;
        if (!ix && !iz) {
          if (mouse.touch && mouse.down) { ix = (mouse.x - mouse.ax) / (55 * hu); iz = (mouse.y - mouse.ay) / (55 * hu); }
          else if (!mouse.touch && mouse.in) { const s = toScreen(me.x, 0, me.z); ix = (mouse.x - s[0]) / (90 * hu); iz = (mouse.y - s[1]) / (90 * hu); }
          const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; } else if (m < .12) ix = iz = 0;
        }
      } else if (h.ai && st === 'play') {
        h.tt -= dt; if (h.tt <= 0) { h.tt = rnd(.45, .9); aiThink(h); }
        const dx = h.tx - h.x, dz = h.tz - h.z, m = Math.hypot(dx, dz); if (m > 1.5) { ix = dx / m * .68; iz = dz / m * .68; if (h.fl) { ix *= 1.1; iz *= 1.1; } }
      }
      const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
      const sp = 9 + h.R * .55; h.vx += (ix * sp - h.vx) * Math.min(1, dt * 8); h.vz += (iz * sp - h.vz) * Math.min(1, dt * 8);
      h.x = clamp(h.x + h.vx * dt, 3, WS - 3); h.z = clamp(h.z + h.vz * dt, 3, WS - 3);
      if (st === 'play') eatStatic(h);
    }
    for (const o of mv) {
      if (o.dead || o.sw) continue;
      if (o.t === 'person') {
        let fx = 0, fz = 0; for (const h of holes) { if (!h.alive) continue; const d = Math.hypot(o.x - h.x, o.z - h.z); if (d < h.R + 9) { fx += (o.x - h.x) / (d + .1); fz += (o.z - h.z) / (d + .1); } }
        const run = Math.hypot(fx, fz) > .01; let vx = o.vx, vz = o.vz; if (run) { vx = fx * 4.5; vz = fz * 4.5; }
        o.x = clamp(o.x + vx * dt, 2, WS - 2); o.z = clamp(o.z + vz * dt, 2, WS - 2);
        if (!run) { const c = o.hz ? o.x : o.z; if (c < o.lo || c > o.hi) { if (o.hz) o.vx = -o.vx; else o.vz = -o.vz; } }
        o.mesh.position.set(o.x, GY + Math.abs(Math.sin(T * (run ? 16 : 9) + o.ph)) * (run ? .16 : .07), o.z); if (vx || vz) o.mesh.rotation.y = Math.atan2(-vz, vx); o.mesh.updateMatrixWorld(true);
      } else {
        const d = o.sp * o.dir * dt; if (o.hz) { o.x += d; if (o.x < 2 || o.x > WS - 2) { o.dir = -o.dir; o.mesh.rotation.y = o.dir > 0 ? 0 : Math.PI; } } else { o.z += d; if (o.z < 2 || o.z > WS - 2) { o.dir = -o.dir; o.mesh.rotation.y = o.dir > 0 ? -Math.PI / 2 : Math.PI / 2; } }
        o.mesh.position.x = o.x; o.mesh.position.z = o.z; o.mesh.updateMatrixWorld(true);
      }
      if (st === 'play') for (const h of holes) { if (h.alive && h.R >= o.need && Math.hypot(o.x - h.x, o.z - h.z) < h.R * .98) { o.sw = { h, k: 0, d: .45 + o.need * .03, tx: rnd(-.5, .5), tz: rnd(-.5, .5), x0: o.x, z0: o.z }; swl.push(o); break; } }
    }
    mv = mv.filter(o => !o.dead);
    for (const o of swl) {
      const s = o.sw, h = s.h; s.k = Math.min(1, s.k + dt / s.d); const e = s.k * s.k, k = s.k;
      o.mesh.position.set(lerp(s.x0, h.x, e), o.gy - (o.h + 2) * Math.pow(k, 1.25), lerp(s.z0, h.z, e)); o.mesh.rotation.x = s.tz * k * 1.2; o.mesh.rotation.z = s.tx * k * 1.2; o.mesh.scale.setScalar(1 - k * .25); o.mesh.updateMatrixWorld(true);
      if (s.k >= 1) finishSwallow(o);
    }
    swl = swl.filter(o => !o.dead);
    if (st === 'play') for (const a of holes) { if (!a.alive) continue; for (const b of holes) {
      if (a === b || !b.alive) continue;
      if (a.R > b.R * 1.2 && Math.hypot(a.x - b.x, a.z - b.z) < a.R * .8) {
        a.pts += b.pts * .5 + 30; a.Rt = Rof(a.pts); burst(b.x, .8, b.z, b.color, 40, 14); shake = Math.max(shake, .7); b.alive = false; b.resp = 3.5; b.m.g.visible = false;
        if (a === me) { kills++; setScore(me.pts); pops.push({ x: me.x, y: 2, z: me.z - me.R, s: 'AVALÉ ' + b.name + ' !', t: 0 }); snd(160, .5, 'sawtooth'); }
        if (b === me) die('Avalé par ' + a.name + ' !');
      } } }
    for (let k = 0; k < NP; k++) if (pL[k] > 0) { pL[k] -= dt; pPos[k * 3] += pV[k * 3] * dt; pPos[k * 3 + 1] += pV[k * 3 + 1] * dt; pPos[k * 3 + 2] += pV[k * 3 + 2] * dt; pV[k * 3 + 1] -= 14 * dt; if (pL[k] <= 0) pPos[k * 3 + 1] = -100; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    for (const p of pops) p.t += dt; pops = pops.filter(p => p.t < 1.2);
    for (const h of holes) if (h.alive) {
      const g = h.m; g.g.position.set(h.x, .28, h.z); for (const m of [g.disc, g.ring, g.ring2]) m.scale.set(h.R, h.R, 1); g.glow.scale.set(h.R, h.R, 1); g.disc.rotation.z = h.spin; g.g.updateMatrixWorld(true);
    }
    const tgt = 21 + me.R * 3.3; camDist += (tgt - camDist) * Math.min(1, dt * 2.5); camX += (me.x - camX) * Math.min(1, dt * 7); camZ += (me.z - camZ) * Math.min(1, dt * 7);
    const pitch = 56 * Math.PI / 180, sh = shake * (Math.random() - .5);
    camera.position.set(camX + sh, camDist * Math.sin(pitch), camZ + camDist * Math.cos(pitch) + sh); camera.lookAt(camX, 0, camZ - camDist * .1); camera.updateMatrixWorld();
    sun.position.set(camX + 40, 90, camZ + 30); sun.target.position.set(camX, 0, camZ); sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera, ext = 30 + me.R * 2.6; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
    scene.fog.near = camDist * 1.4; scene.fog.far = camDist * 6;
  }

  /* ---------- Interface 2D par-dessus la 3D ---------- */
  function pill(x, y, w, h, c) { X.fillStyle = c; X.beginPath(); X.moveTo(x + h / 2, y); X.arcTo(x + w, y, x + w, y + h, h / 2); X.arcTo(x + w, y + h, x, y + h, h / 2); X.arcTo(x, y + h, x, y, h / 2); X.arcTo(x, y, x + w, y, h / 2); X.closePath(); X.fill(); }
  function stroked(t, x, y, fill, sw) { X.lineWidth = sw; X.strokeStyle = 'rgba(0,0,0,.65)'; X.strokeText(t, x, y); X.fillStyle = fill; X.fillText(t, x, y); }
  function hud() {
    X.clearRect(0, 0, W, H); X.save(); X.lineJoin = 'round'; X.textAlign = 'center';
    const IMP = 'Impact,"Arial Black",sans-serif';
    for (const h of holes) {
      if (!h.alive) continue; const s = toScreen(h.x, 0, h.z), e = toScreen(h.x, 0, h.z - h.R * 1.1);
      if (s[2] > 1) continue; const on = s[0] > -40 && s[0] < W + 40 && s[1] > -40 && s[1] < H + 40, lv = lvOf(h.pts);
      if (on) {
        const bx = s[0], by = e[1] - 6 * hu; X.font = `900 ${Math.round(17 * hu)}px ${IMP}`; stroked('LVL ' + (lv + 1), bx, by - (h === me ? 34 : 16) * hu, h.color, 5 * hu);
        X.font = `800 ${Math.round(12 * hu)}px system-ui,sans-serif`; stroked(h.name, bx, by - (h === me ? 18 : 2) * hu, '#fff', 4 * hu);
        if (h === me) { const w = 70 * hu, ph = 12 * hu, a = LV[lv], b = LV[lv + 1] || LV[lv] + 1, f = clamp((h.pts - a) / (b - a), 0, 1); pill(bx - w / 2, by - 12 * hu, w, ph, 'rgba(0,0,0,.65)'); if (f > .02) pill(bx - w / 2 + 1, by - 11 * hu, Math.max(ph - 2, (w - 2) * f), ph - 2, h.color); X.font = `800 ${Math.round(9 * hu)}px system-ui,sans-serif`; stroked(Math.floor(h.pts - a) + '/' + (b - a), bx, by - 2 * hu, '#fff', 3); }
      } else if (h !== me) {
        const cx = W / 2, cy = H / 2, ang = Math.atan2(s[1] - cy, s[0] - cx), ex = 0;
        X.save(); X.translate(clamp(s[0], 24 * hu, W - 24 * hu), clamp(s[1], 44 * hu, H - 24 * hu)); X.rotate(ang); X.fillStyle = h.color; X.beginPath(); X.moveTo(14 * hu, 0); X.lineTo(-6 * hu, -9 * hu); X.lineTo(-6 * hu, 9 * hu); X.closePath(); X.fill(); X.restore();
        X.font = `800 ${Math.round(11 * hu)}px system-ui,sans-serif`; stroked('LVL ' + (lv + 1), clamp(s[0], 40 * hu, W - 40 * hu), clamp(s[1], 44 * hu, H - 24 * hu) - 14 * hu, h.color, 4);
      }
    }
    X.font = `900 ${Math.round(18 * hu)}px ${IMP}`;
    for (const p of pops) { const s = toScreen(p.x, p.y, p.z); X.globalAlpha = 1 - p.t / 1.2; stroked(p.s, s[0], s[1] - p.t * 40, '#fff', 5); } X.globalAlpha = 1;
    // points (gauche)
    pill(10 * hu, 10 * hu, 110 * hu, 34 * hu, 'rgba(20,24,40,.55)'); X.textAlign = 'left'; X.font = `900 ${Math.round(22 * hu)}px ${IMP}`; stroked('★', 18 * hu, 35 * hu, '#ffd23f', 3); stroked(String(Math.floor(me.pts)), 44 * hu, 36 * hu, '#fff', 4);
    // chrono (centre)
    const mm = Math.floor(timeLeft / 60), ss = Math.floor(timeLeft % 60), tm = mm + ':' + (ss < 10 ? '0' : '') + ss; X.textAlign = 'center';
    pill(W / 2 - 62 * hu, 8 * hu, 124 * hu, 38 * hu, 'rgba(20,24,40,.6)'); X.fillStyle = '#ff9f1c'; X.beginPath(); X.arc(W / 2 - 38 * hu, 27 * hu, 12 * hu, 0, TAU); X.fill(); X.strokeStyle = '#fff'; X.lineWidth = 2 * hu; X.beginPath(); X.moveTo(W / 2 - 38 * hu, 27 * hu); X.lineTo(W / 2 - 38 * hu, 20 * hu); X.moveTo(W / 2 - 38 * hu, 27 * hu); X.lineTo(W / 2 - 32 * hu, 30 * hu); X.stroke();
    X.font = `900 ${Math.round(24 * hu)}px ${IMP}`; stroked(tm, W / 2 + 12 * hu, 36 * hu, timeLeft < 15 && Math.sin(T * 8) > 0 ? '#ff6b6b' : '#fff', 4);
    // éliminations (à gauche du bouton plein écran)
    const kx = W - 120 * hu; pill(kx, 10 * hu, 66 * hu, 32 * hu, 'rgba(20,24,40,.55)'); X.textAlign = 'left'; X.font = `900 ${Math.round(18 * hu)}px ${IMP}`; stroked('☠', kx + 10 * hu, 34 * hu, '#fff', 3); stroked(String(kills), kx + 36 * hu, 34 * hu, '#fff', 3);
    // classement
    const lb = holes.filter(h => h.alive).sort((a, b) => b.pts - a.pts), lx = W - 138 * hu, ly = 66 * hu; X.fillStyle = 'rgba(20,24,40,.45)'; X.fillRect(lx - 8 * hu, ly - 14 * hu, 140 * hu, (lb.length * 17 + 8) * hu);
    lb.forEach((h, i) => { X.font = `${h === me ? 800 : 600} ${Math.round(12 * hu)}px system-ui,sans-serif`; X.fillStyle = h.color; X.textAlign = 'left'; X.fillText((i + 1) + '. ' + h.name, lx, ly + i * 17 * hu); X.textAlign = 'right'; X.fillText(Math.floor(h.pts), lx + 124 * hu, ly + i * 17 * hu); });
    // minicarte
    const mw = 84 * hu, mx = 10 * hu, my = H - mw - 10 * hu; X.globalAlpha = .88; X.drawImage(mini, mx, my, mw, mw); X.globalAlpha = 1; X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 2; X.strokeRect(mx, my, mw, mw);
    for (const h of holes) if (h.alive) { X.fillStyle = h.color; X.beginPath(); X.arc(mx + h.x / WS * mw, my + h.z / WS * mw, h === me ? 4 : 3, 0, TAU); X.fill(); }
    X.textAlign = 'center'; X.font = `700 ${Math.round(12 * hu)}px system-ui,sans-serif`; const av = Object.values(TY).filter(t => t.need <= me.R).pop(); stroked('Tu peux avaler jusqu’à : ' + av.nm, W / 2, H - 10 * hu, '#fff', 4);
    if (banner > 0 && st === 'play') { X.globalAlpha = Math.min(1, banner); X.font = `900 ${Math.round(34 * hu)}px ${IMP}`; stroked('Dévore la ville !', W / 2, H * .28, '#fff', 7 * hu); X.font = `700 ${Math.round(14 * hu)}px system-ui,sans-serif`; stroked('Avale les petits objets pour grandir. Fuis les plus gros trous noirs !', W / 2, H * .28 + 26 * hu, '#fff', 4); X.globalAlpha = 1; }
    if (st === 'over') { X.fillStyle = 'rgba(0,0,0,.45)'; X.fillRect(0, 0, W, H); X.font = `900 ${Math.round(30 * hu)}px ${IMP}`; stroked(endMsg, W / 2, H / 2, '#fff', 7 * hu); }
    if (mouse.touch && mouse.down && st === 'play') { X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 3; X.beginPath(); X.arc(mouse.ax, mouse.ay, 55 * hu, 0, TAU); X.stroke(); const dx = mouse.x - mouse.ax, dy = mouse.y - mouse.ay, m = Math.min(1, Math.hypot(dx, dy) / (55 * hu)), an = Math.atan2(dy, dx); X.fillStyle = 'rgba(255,255,255,.85)'; X.beginPath(); X.arc(mouse.ax + Math.cos(an) * m * 55 * hu, mouse.ay + Math.sin(an) * m * 55 * hu, 24 * hu, 0, TAU); X.fill(); }
    X.restore();
  }
  const mini = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), s = 128 / WS; g.fillStyle = '#4a4c54'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) { const park = [[0, 0], [0, 5], [5, 0], [5, 5]].some(p => p[0] === i && p[1] === j), d = Math.max(Math.abs(i - 2.5), Math.abs(j - 2.5)); g.fillStyle = park ? '#79c45a' : d < 1 ? '#6f87a8' : d < 2 ? '#b9b3a2' : '#c9c2b0'; g.fillRect((OFF + i * PITCH) * s, (OFF + j * PITCH) * s, BL * s, BL * s); }
    g.fillStyle = '#3a9bd8'; g.beginPath(); g.arc((OFF + 5 * PITCH + 28) * s, (OFF + 5 * PITCH + 28) * s, 16 * s, 0, TAU); g.fill(); return c; })();

  function loop(ts) {
    if (!alive) return;
    const dt = Math.min(.05, (ts - lt) / 1000 || 0); lt = ts;
    FSK.fit(); const w = cv.width, h = cv.height;
    if (w !== rw || h !== rh) { rw = w; rh = h; W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); ov.width = w; ov.height = h; hu = Math.max(.8, Math.min(w, h) / 400); }
    ov.style.left = cv.offsetLeft + 'px'; ov.style.top = cv.offsetTop + 'px'; ov.style.width = cv.clientWidth + 'px'; ov.style.height = cv.clientHeight + 'px';
    update(dt); renderer.render(scene, camera); hud(); FSK.draw(X);
    raf = requestAnimationFrame(loop);
    try { currentGameLoop = raf; } catch (e) {}
  }
  const cpos = e => { const rc = cv.getBoundingClientRect(); return [(e.clientX - rc.left) * cv.width / rc.width, (e.clientY - rc.top) * cv.height / rc.height]; };
  const onDown = e => { e.preventDefault(); if (FSK.hit(e)) return; const p = cpos(e); mouse.down = true; mouse.touch = e.pointerType !== 'mouse'; mouse.x = mouse.ax = p[0]; mouse.y = mouse.ay = p[1]; };
  const onMove = e => { const p = cpos(e); mouse.x = p[0]; mouse.y = p[1]; mouse.in = true; if (e.pointerType === 'mouse') mouse.touch = false; };
  const onUp = () => { mouse.down = false; }, onLeave = () => { mouse.in = false; }, onClick = e => { if (FSK.hit(e)) FSK.toggle(); };
  const kmap = { ArrowLeft: 'l', KeyA: 'l', KeyQ: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', KeyZ: 'u', ArrowDown: 'd', KeyS: 'd' };
  const onKey = e => { if (isTyping(e)) return; if (e.code === 'KeyF') { FSK.toggle(); return; } if (kmap[e.code]) { keys[kmap[e.code]] = 1; e.preventDefault(); } else if ((e.code === 'Space' || e.code === 'Enter') && st === 'over') { e.preventDefault(); restartClick(); } };
  const onKeyUp = e => { if (kmap[e.code]) keys[kmap[e.code]] = 0; };
  function cleanup() {
    alive = false; cancelAnimationFrame(raf); clearTimeout(timer);
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerleave', onLeave); cv.removeEventListener('click', onClick);
    window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
    try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
    try { renderer.dispose(); } catch (e) {}
    FSK.off(); if (window.__holeStop === cleanup) window.__holeStop = null;
  }
  window.__holeStop = cleanup;
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerleave', onLeave); cv.addEventListener('click', onClick);
  window.addEventListener('pointerup', onUp); window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);

  buildWorld(); newGame();
  raf = requestAnimationFrame(loop);
  try { currentGameLoop = raf; } catch (e) {}
}