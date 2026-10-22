/* ============================================================
   ARBEST CITY — GTA-like 3D en monde ouvert (Three.js r128)
   Fichier : js/games/gta.js   |   Init : startGTAGame()
   v2 : rendu PBR, ombres, ciel dynamique, textures procédurales
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
  const s2l = v => Math.pow(v, 2.2);
  const hex2rgb = h => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  const snd = (f, d, t) => { try { if (typeof playSound === 'function') playSound(f, d, t); } catch (e) {} };
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  let qPref = null; try { qPref = localStorage.getItem('gta_q'); } catch (e) {}
  const qHigh = (qPref || (isTouch ? 'low' : 'high')) === 'high';
  const disposables = [];

  // ---------- Canvas neuf (un canvas WebGL ne peut pas redevenir 2D) ----------
  const oldCanvas = document.getElementById('game-canvas');
  const container = oldCanvas.parentElement;
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas'; canvas.width = 960; canvas.height = 540;
  container.replaceChild(canvas, oldCanvas);
  container.style.maxWidth = '960px';
  const scanEl = (document.querySelector && document.querySelector('.scanline-overlay')) || null, scanPrev = scanEl ? scanEl.style.display : '';
  if (scanEl) scanEl.style.display = 'none';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: qHigh, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(960, 540, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  if (qHigh) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  const aniso = Math.min(8, +renderer.capabilities.getMaxAnisotropy() || 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 960 / 540, 0.6, 1800);
  const skyCol = new THREE.Color(0x87c3ff);
  scene.background = skyCol;
  scene.fog = new THREE.Fog(0xbcd4ee, 160, 760);
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5a48, 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(120, 200, 80); scene.add(sun); scene.add(sun.target);
  if (qHigh) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 20; sc.far = 520;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  }

  // ---------- Ciel (dégradé, soleil, nuages, étoiles) ----------
  const SKY_FRAG = `
    uniform vec3 uSun; uniform float uDay; uniform vec3 uHorizon; uniform vec3 uZenith; uniform float uTime; uniform float uLinear; uniform float uWet;
    varying vec3 vDir;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x), f.y); }
    float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
    void main(){
      vec3 d = normalize(vDir);
      float h = clamp(d.y, 0.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
      float sd = max(dot(d, uSun), 0.0);
      vec3 sunCol = mix(vec3(1.0,0.5,0.25), vec3(1.0,0.93,0.78), clamp(uSun.y*2.0,0.0,1.0));
      col += sunCol * (pow(sd, 900.0) * 4.0 + pow(sd, 18.0) * 0.28) * smoothstep(-0.05, 0.1, uSun.y) * (1.0 - uWet * 0.92);
      if (d.y > 0.0) {
        vec2 uv = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
        float c = smoothstep(0.48 - uWet * 0.32, 0.85 - uWet * 0.3, fbm(uv));
        vec3 cc = mix(vec3(0.10,0.11,0.17), mix(vec3(0.95,0.7,0.6), vec3(1.0,0.99,0.97), clamp(uSun.y*2.5,0.0,1.0)), uDay);
        cc = mix(cc, uHorizon, 0.25);
        cc = mix(cc, vec3(0.32,0.34,0.38) * (0.35 + 0.65 * uDay), uWet * 0.8);
        col = mix(col, cc, c * smoothstep(0.0, 0.2, d.y) * 0.9);
        float st = step(0.9965, hash(floor(d.xz / (d.y + 1.0) * 220.0)));
        col += vec3(st) * (1.0 - uDay) * smoothstep(0.08, 0.35, d.y) * 0.9;
      }
      col = mix(col, vec3(dot(col, vec3(0.33))) * 0.8, uWet * 0.6);
      if (uLinear > 0.5) col = pow(col, vec3(2.2)) * 1.2;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const SKY_VERT = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  function makeSkyMat() {
    return new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uDay: { value: 1 }, uHorizon: { value: new THREE.Vector3(0.72, 0.84, 0.96) }, uZenith: { value: new THREE.Vector3(0.25, 0.5, 0.9) }, uTime: { value: 0 }, uLinear: { value: 0 }, uWet: { value: 0 } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false
    });
  }
  const skyMat = makeSkyMat();
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat);
  skyMesh.frustumCulled = false; skyMesh.renderOrder = -10; scene.add(skyMesh);
  disposables.push(skyMesh.geometry, skyMat);
  const envMats = [];
  try {
    const em = makeSkyMat(); em.uniforms.uSun.value.set(0.5, 0.75, 0.3).normalize();
    const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), em));
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(es); scene.environment = rt.texture;
    disposables.push(rt, em); pm.dispose();
  } catch (e) { console.warn('[GTA] environnement indisponible', e); }

  // ---------- Batch de géométrie : tout dans un seul mesh ----------
  function Batch() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; this.si = []; this.sw = []; this.sk = -1; }
  Batch.prototype.quad = function (v, n, rgb, uv) {
    const o = this.p.length / 3;
    for (let k = 0; k < 4; k++) {
      this.p.push(v[k][0], v[k][1], v[k][2]); this.n.push(n[0], n[1], n[2]);
      this.c.push(rgb[0], rgb[1], rgb[2]); this.u.push(uv[k][0], uv[k][1]);
      if (this.sk >= 0) { this.si.push(this.sk, 0, 0, 0); this.sw.push(1, 0, 0, 0); }
    }
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const ZUV = [[0, 0], [0, 0], [0, 0], [0, 0]];
  // o : { tu, tv (mètres par unité UV), uo, vo, top (UV planaires sur le dessus), shade }
  Batch.prototype.box = function (cx, cy, cz, sx, sy, sz, color, o) {
    o = o || {};
    const base = Array.isArray(color) ? color : hex2rgb(color);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, tu = o.tu || 0, tv = o.tv || tu;
    const F = [
      [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], sz, sy],
      [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], sz, sy],
      [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], sx, sz],
      [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], sx, sz],
      [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], sx, sy],
      [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], sx, sy]
    ];
    for (const f of F) {
      const n = f[0], v = f[1].map(a => [a[0] + cx, a[1] + cy, a[2] + cz]);
      const sh = o.shade ? (n[1] === 1 ? 0.8 : n[1] === -1 ? 0.4 : 1) : 1;
      const col = sh === 1 ? base : [base[0] * sh, base[1] * sh, base[2] * sh];
      let uv = ZUV;
      if (tu) {
        if (n[1] === 0) { const a = f[2] / tu, b = f[3] / tv, uo = o.uo || 0, vo = o.vo || 0; uv = [[uo, vo], [uo + a, vo], [uo + a, vo + b], [uo, vo + b]]; }
        else if (o.top && n[1] === 1) uv = v.map(p => [p[0] / tu, p[2] / tv]);
      }
      this.quad(v, n, col, uv);
    }
  };
  Batch.prototype.flat = function (cx, cy, cz, sx, sz, color, tu) {
    const c = Array.isArray(color) ? color : hex2rgb(color);
    const hx = sx / 2, hz = sz / 2;
    const v = [[cx - hx, cy, cz + hz], [cx + hx, cy, cz + hz], [cx + hx, cy, cz - hz], [cx - hx, cy, cz - hz]];
    this.quad(v, [0, 1, 0], c, tu ? v.map(p => [p[0] / tu, p[2] / tu]) : ZUV);
  };
  // maillage lisse : V = sommets, T = triangles, dir(c) = direction « vers l'extérieur » au centre du triangle
  Batch.prototype.emit = function (V, T, color, dir, colFn, skinFn, uvFn) {
    const base = Array.isArray(color) ? color : hex2rgb(color);
    const o = this.p.length / 3, nrm = V.map(() => [0, 0, 0]);
    for (const t of T) {
      const a = V[t[0]], b = V[t[1]], c = V[t[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const d = dir([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
      if (nx * d[0] + ny * d[1] + nz * d[2] < 0) { const tmp = t[1]; t[1] = t[2]; t[2] = tmp; nx = -nx; ny = -ny; nz = -nz; }
      for (let k = 0; k < 3; k++) { const q = nrm[t[k]]; q[0] += nx; q[1] += ny; q[2] += nz; }
    }
    for (let i = 0; i < V.length; i++) {
      const q = nrm[i], l = Math.hypot(q[0], q[1], q[2]) || 1, c = colFn ? colFn(V[i]) : base;
      this.p.push(V[i][0], V[i][1], V[i][2]); this.n.push(q[0] / l, q[1] / l, q[2] / l);
      this.c.push(c[0], c[1], c[2]);
      if (uvFn) { const t = uvFn(V[i]); this.u.push(t[0], t[1]); } else this.u.push(0, 0);
      if (skinFn) { const sk = skinFn(V[i]); this.si.push(sk[0], sk[1], 0, 0); this.sw.push(sk[2], 1 - sk[2], 0, 0); }
      else if (this.sk >= 0) { this.si.push(this.sk, 0, 0, 0); this.sw.push(1, 0, 0, 0); }
    }
    for (const t of T) this.i.push(o + t[0], o + t[1], o + t[2]);
  };
  // cylindre d'axe Y (rayons elliptiques bas/haut)
  Batch.prototype.cyl = function (cx, yb, cz, rxb, rzb, rxt, rzt, h, seg, color, caps) {
    const V = [], T = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      V.push([cx + ca * rxb, yb, cz + sa * rzb], [cx + ca * rxt, yb + h, cz + sa * rzt]);
    }
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; T.push([i * 2, j * 2, j * 2 + 1], [i * 2, j * 2 + 1, i * 2 + 1]); }
    this.emit(V, T, color, c => [c[0] - cx, 0, c[2] - cz]);
    if (caps !== false) {
      for (const top of [true, false]) {
        const y = top ? yb + h : yb, rx = top ? rxt : rxb, rz = top ? rzt : rzb, W = [[cx, y, cz]], U = [];
        for (let i = 0; i < seg; i++) { const a = i / seg * TAU; W.push([cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz]); }
        for (let i = 0; i < seg; i++) U.push([0, 1 + i, 1 + (i + 1) % seg]);
        this.emit(W, U, color, () => [0, top ? 1 : -1, 0]);
      }
    }
  };
  Batch.prototype.sphere = function (cx, cy, cz, rx, ry, rz, color, sw, sh, jit) {
    sw = sw || 8; sh = sh || 6;
    const V = [], T = [];
    for (let j = 0; j <= sh; j++) {
      const v = j / sh * Math.PI, y = Math.cos(v), r = Math.sin(v);
      for (let i = 0; i < sw; i++) {
        const a = i / sw * TAU, k = jit ? 1 + (wr() - 0.5) * jit : 1;
        V.push([cx + Math.cos(a) * r * rx * k, cy + y * ry * k, cz + Math.sin(a) * r * rz * k]);
      }
    }
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const a = j * sw + i, b = j * sw + (i + 1) % sw, c = (j + 1) * sw + i, d = (j + 1) * sw + (i + 1) % sw;
      T.push([a, b, d], [a, d, c]);
    }
    this.emit(V, T, color, c => [c[0] - cx, c[1] - cy, c[2] - cz]);
  };
  // roue : axe X
  Batch.prototype.wheel = function (cx, cy, cz, r, hw, seg, tire, rim) {
    const V = [], T = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * TAU, y = cy + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      V.push([cx - hw, y, z], [cx + hw, y, z]);
    }
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; T.push([i * 2, j * 2, j * 2 + 1], [i * 2, j * 2 + 1, i * 2 + 1]); }
    this.emit(V, T, tire, c => [0, c[1] - cy, c[2] - cz]);
    const sgn = cx >= 0 ? 1 : -1, x = cx + sgn * (hw + 0.004);
    const W = [[x, cy, cz]], U = [];
    for (let i = 0; i < seg; i++) { const a = i / seg * TAU; W.push([x, cy + Math.cos(a) * r * 0.62, cz + Math.sin(a) * r * 0.62]); }
    for (let i = 0; i < seg; i++) U.push([0, 1 + i, 1 + (i + 1) % seg]);
    this.emit(W, U, rim, () => [sgn, 0, 0]);
  };
  Batch.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.si.length) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4)); }
    g.setIndex(this.i);
    disposables.push(g);
    return g;
  };
  Batch.prototype.mesh = function (mat, cast, recv) {
    const m = new THREE.Mesh(this.geo(), mat);
    if (qHigh) { m.castShadow = !!cast; m.receiveShadow = !!recv; }
    return m;
  };

  // ---------- Textures procédurales ----------
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function tex(c, srgb) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    if (srgb !== false) t.encoding = THREE.sRGBEncoding;
    disposables.push(t); return t;
  }
  const hashLit = (r, c, k) => ((r * 31 + c * 17 + r * c * 7 + k * 13) % 7);
  function paintWindow(g, x, y, w, h, lit, emissive, shine) {
    if (emissive) {
      if (!lit) return;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, lit === 2 ? '#fff4d0' : '#ffd98a'); gr.addColorStop(1, lit === 2 ? '#e8d8b0' : '#e0a050');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, w * 0.18, h);
      return;
    }
    const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h);
    if (lit) { gr.addColorStop(0, '#f0d9a0'); gr.addColorStop(1, '#b98a4a'); }
    else if (shine) { gr.addColorStop(0, '#9cc2e6'); gr.addColorStop(0.5, '#4f7498'); gr.addColorStop(1, '#27394f'); }
    else { gr.addColorStop(0, '#7fa6cc'); gr.addColorStop(1, '#2d445c'); }
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  function dressWindow(g, x, y, w, h, hl) {
    const r = (hl * 37) % 10;
    if (r < 3) {
      const hh = h * (0.2 + (hl % 5) * 0.14);
      g.fillStyle = 'rgba(232,228,214,.92)'; g.fillRect(x, y, w, hh);
      g.fillStyle = 'rgba(120,115,100,.5)'; for (let yy = y + 3; yy < y + hh; yy += 4) g.fillRect(x, yy, w, 1);
    } else if (r < 5) {
      g.fillStyle = ['#b8434a', '#d9c7a0', '#4a6d8c', '#e8e0d0'][hl % 4]; g.fillRect(x, y, w * 0.28, h); g.fillRect(x + w * 0.72, y, w * 0.28, h);
    }
    g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(x + 2, y + h + 8, w - 4, 22);
  }
  function facadeTex(style, emissive) {
    const S = 1024, c = mkCanvas(S, S), g = c.getContext('2d');
    const rnd = () => wr();
    if (!emissive) {
      if (style === 'brick') {
        g.fillStyle = '#b4a592'; g.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 12) { const off = ((y / 12) % 2) ? 16 : 0; for (let x = -32; x < S; x += 32) { const v = rnd(); g.fillStyle = 'rgb(' + (140 + v * 50 | 0) + ',' + (68 + v * 30 | 0) + ',' + (48 + v * 22 | 0) + ')'; g.fillRect(x + off + 1, y + 1, 30, 10); } }
      } else if (style === 'concrete') {
        g.fillStyle = '#b3b6ba'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.03 + rnd() * 0.05) + ')'; g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 10, 2 + rnd() * 5); }
        for (let r = 0; r < 8; r++) { g.fillStyle = '#9a9da2'; g.fillRect(0, r * 128 + 104, S, 24); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, r * 128 + 126, S, 2); }
        for (let x = 0; x < S; x += 256) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 2, S); }
      } else if (style === 'glass') {
        g.fillStyle = '#2a3b4d'; g.fillRect(0, 0, S, S);
      } else {
        g.fillStyle = '#efe6d6'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 6000; i++) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,255,255' : '90,70,50') + ',' + (0.03 + rnd() * 0.05) + ')'; g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 6, 2 + rnd() * 6); }
        for (let r = 0; r < 8; r++) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, r * 128 + 120, S, 8); }
      }
    } else { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); }
    for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
      const x0 = col * 128, y0 = r * 128, hl = hashLit(r, col, style.length), lit = hl < 2 ? 1 : hl === 2 ? 2 : 0;
      if (style === 'brick') {
        if (!emissive) { g.fillStyle = '#d9d2c4'; g.fillRect(x0 + 24, y0 + 18, 80, 14); g.fillRect(x0 + 24, y0 + 100, 80, 8); g.fillStyle = '#3b2a22'; g.fillRect(x0 + 28, y0 + 30, 72, 72); }
        paintWindow(g, x0 + 32, y0 + 34, 64, 66, lit, emissive, true);
        if (!emissive) dressWindow(g, x0 + 32, y0 + 34, 64, 66, hl + 3);
        if (!emissive) { g.fillStyle = '#2b211b'; g.fillRect(x0 + 62, y0 + 34, 4, 66); g.fillRect(x0 + 32, y0 + 64, 64, 4); }
      } else if (style === 'concrete') {
        if (!emissive) { g.fillStyle = '#4a4e54'; g.fillRect(x0 + 2, y0 + 20, 124, 76); }
        for (let k = 0; k < 3; k++) paintWindow(g, x0 + 6 + k * 40, y0 + 24, 36, 68, ((hl + k) % 5) < 2 ? 1 : 0, emissive, true);
      } else if (style === 'glass') {
        const t = (hl % 3), tint = t === 0 ? ['#8fc4e8', '#2d5a80'] : t === 1 ? ['#9fd4d0', '#2c6b6e'] : ['#a8b8e8', '#323f78'];
        if (!emissive) {
          const gr = g.createLinearGradient(x0, y0, x0 + 128, y0 + 128); gr.addColorStop(0, tint[0]); gr.addColorStop(1, tint[1]);
          g.fillStyle = gr; g.fillRect(x0, y0, 128, 100);
          g.fillStyle = '#5d6f80'; g.fillRect(x0, y0 + 100, 128, 28);
          g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x0, y0 + 90); g.lineTo(x0 + 70, y0); g.lineTo(x0 + 100, y0); g.lineTo(x0 + 20, y0 + 100); g.fill();
          g.fillStyle = '#18222c'; g.fillRect(x0, y0, 128, 3); g.fillRect(x0, y0, 3, 128); g.fillRect(x0 + 64, y0, 2, 100);
        } else if (lit) { g.fillStyle = lit === 2 ? '#fff1c8' : '#ffc56e'; g.fillRect(x0 + 4, y0 + 6, 56, 92); if (hl % 2) g.fillRect(x0 + 68, y0 + 6, 56, 92); }
      } else {
        if (!emissive) {
          g.fillStyle = '#e9e2d4'; g.fillRect(x0 + 26, y0 + 22, 76, 8); g.fillRect(x0 + 26, y0 + 98, 76, 10);
          g.fillStyle = (hl % 2) ? '#3f6b57' : '#7a3b2e'; g.fillRect(x0 + 10, y0 + 30, 16, 68); g.fillRect(x0 + 102, y0 + 30, 16, 68);
          g.fillStyle = '#4a3a30'; g.fillRect(x0 + 30, y0 + 30, 68, 68);
        }
        paintWindow(g, x0 + 32, y0 + 32, 64, 64, lit, emissive, false);
        if (!emissive) dressWindow(g, x0 + 32, y0 + 32, 64, 64, hl + 5);
        if (!emissive) { g.fillStyle = '#f1ebe0'; g.fillRect(x0 + 62, y0 + 32, 4, 64); g.fillRect(x0 + 32, y0 + 62, 64, 4); }
      }
    }
    return tex(c, !emissive);
  }
  function shopTex(emissive) {
    const c = mkCanvas(512, 256), g = c.getContext('2d');
    g.fillStyle = emissive ? '#000' : '#4b4a48'; g.fillRect(0, 0, 512, 256);
    if (!emissive) {
      g.fillStyle = '#efefef'; g.fillRect(0, 6, 512, 40);
      g.fillStyle = '#222'; for (let i = 0; i < 6; i++) g.fillRect(40 + i * 70 + wr() * 10, 18, 40 + wr() * 20, 14);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f4f4f4' : '#cfcfcf'; g.fillRect(i * 32, 48, 32, 30); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 78, 512, 6);
      g.fillStyle = '#1b1b1d'; g.fillRect(18, 88, 352, 156); g.fillRect(392, 92, 94, 164);
      const gr = g.createLinearGradient(0, 92, 0, 240); gr.addColorStop(0, '#caa86a'); gr.addColorStop(1, '#6d5532');
      g.fillStyle = gr; g.fillRect(24, 94, 340, 144);
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.1 + wr() * 0.15) + ')'; g.fillRect(34 + i * 36, 120 + wr() * 60, 22, 18 + wr() * 30); }
      g.fillStyle = '#2a3440'; g.fillRect(398, 98, 82, 150); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(404, 104, 20, 140);
      g.fillStyle = '#1b1b1d'; g.fillRect(190, 94, 6, 144);
      const gg = g.createLinearGradient(0, 196, 0, 256); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(12,9,6,.6)');
      g.fillStyle = gg; g.fillRect(0, 196, 512, 60);
    } else {
      g.fillStyle = '#e8e8e0'; g.fillRect(0, 6, 512, 40);
      g.fillStyle = '#ffd890'; g.fillRect(24, 94, 340, 144);
      g.fillStyle = '#a8c0d8'; g.fillRect(398, 98, 82, 150);
    }
    return tex(c, !emissive);
  }
  function asphaltTex() {
    const c = mkCanvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#3c3e43'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const v = 40 + wr() * 50 | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',' + (0.25 + wr() * 0.4) + ')'; g.fillRect(wr() * 512, wr() * 512, 1 + wr() * 3, 1 + wr() * 3); }
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(15,15,18,.45)'; g.lineWidth = 1 + wr(); g.beginPath(); let x = wr() * 512, y = wr() * 512; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (wr() - 0.5) * 60; y += (wr() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(20,20,22,.18)'; g.beginPath(); g.ellipse(wr() * 512, wr() * 512, 20 + wr() * 40, 10 + wr() * 25, wr() * 3, 0, TAU); g.fill(); }
    return tex(c);
  }
  function walkTex() {
    const c = mkCanvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#85847f'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const v = 124 + wr() * 16 | 0; g.fillStyle = 'rgb(' + v + ',' + (v - 1) + ',' + (v - 6) + ')'; g.fillRect(x * 256 + 3, y * 256 + 3, 250, 250); }
    for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(' + (wr() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.04 + wr() * 0.05) + ')'; g.fillRect(wr() * 512, wr() * 512, 1 + wr() * 3, 1 + wr() * 3); }
    return tex(c);
  }
  function grassTex() {
    const c = mkCanvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#3d672d'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) { const v = wr(); g.fillStyle = 'rgba(' + (50 + v * 60 | 0) + ',' + (100 + v * 70 | 0) + ',' + (40 + v * 30 | 0) + ',.55)'; g.fillRect(wr() * 512, wr() * 512, 1 + wr() * 2, 2 + wr() * 4); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(70,90,40,.15)'; g.beginPath(); g.ellipse(wr() * 512, wr() * 512, 30 + wr() * 50, 20 + wr() * 40, wr() * 3, 0, TAU); g.fill(); }
    return tex(c);
  }
  function leafTex() {
    const c = mkCanvas(128, 128), g = c.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const x = 20 + Math.random() * 88, y = 20 + Math.random() * 88, a = Math.random() * TAU, v = 0.55 + Math.random() * 0.45;
      g.fillStyle = 'rgb(' + (62 * v | 0) + ',' + (135 * v | 0) + ',' + (45 * v | 0) + ')';
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 11, 5.5, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,70,25,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke(); g.restore();
    }
    return tex(c, true);
  }
  function glowTex() {
    const c = mkCanvas(64, 64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,230,170,.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c, false);
  }

  // ---------- Matériaux ----------
  function ormTex(style) {
    const S = 1024, c = mkCanvas(S, S), g = c.getContext('2d');
    g.fillStyle = 'rgb(255,215,0)'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
      const x0 = col * 128, y0 = r * 128; g.fillStyle = 'rgb(255,28,215)';
      if (style === 'brick') g.fillRect(x0 + 32, y0 + 34, 64, 66);
      else if (style === 'concrete') { for (let k = 0; k < 3; k++) g.fillRect(x0 + 6 + k * 40, y0 + 24, 36, 68); }
      else if (style === 'glass') { g.fillRect(x0, y0, 128, 100); g.fillStyle = 'rgb(255,120,150)'; g.fillRect(x0, y0 + 100, 128, 28); }
      else g.fillRect(x0 + 32, y0 + 32, 64, 64);
    }
    return tex(c, false);
  }
  const facade = {};
  for (const k of ['brick', 'concrete', 'glass', 'stucco']) {
    const dif = facadeTex(k, false), em = facadeTex(k, true), orm = ormTex(k);
    facade[k] = { b: new Batch(), mat: new THREE.MeshStandardMaterial({ map: dif, emissiveMap: em, emissive: new THREE.Color(0, 0, 0), vertexColors: true, roughness: 1, metalness: 1, roughnessMap: orm, metalnessMap: orm, bumpMap: k === 'glass' ? null : dif, bumpScale: k === 'brick' ? 1.6 : 0.8 }) };
    disposables.push(facade[k].mat); envMats.push(facade[k].mat);
  }
  const leafB = new Batch();
  const leafMap = leafTex();
  const leafMat = new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 });
  disposables.push(leafMap, leafMat); envMats.push(leafMat);
  const shopB = new Batch(), plainB = new Batch(), walkB = new Batch(), roadB = new Batch(), markB = new Batch(), grassB = new Batch(), lampB = new Batch();
  const shopMat = new THREE.MeshStandardMaterial({ map: shopTex(false), emissiveMap: shopTex(true), emissive: new THREE.Color(0, 0, 0), vertexColors: true, roughness: 0.6, metalness: 0.1 });
  const plainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
  const asphaltMap = asphaltTex();
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltMap, bumpMap: asphaltMap, bumpScale: 0.6, vertexColors: true, roughness: 0.88, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const walkMap = walkTex();
  const walkMat = new THREE.MeshStandardMaterial({ map: walkMap, bumpMap: walkMap, bumpScale: 0.5, vertexColors: true, roughness: 0.9 });
  const grassMap = grassTex();
  const grassMat = new THREE.MeshStandardMaterial({ map: grassMap, vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(shopMat, plainMat, roadMat, markMat, walkMat, grassMat, lampMat, asphaltMap, walkMap, grassMap);
  envMats.push(shopMat, plainMat, roadMat, walkMat);

  // ---------- Dimensions : réseau hiérarchisé (autoroute, avenues, rues, ruelles) ----------
  const NX = 9, NZ = 9;
  const BWX = [124, 100, 76, 62, 58, 64, 78, 100, 124], BWZ = BWX.slice().reverse();
  const RW = [38, 12, 18, 26, 18, 18, 26, 18, 12, 38];      // largeur des routes (0 et 9 = autoroute)
  const mkLines = bw => { const xs = [0]; for (let i = 0; i < bw.length; i++) xs.push(xs[i] + RW[i] / 2 + bw[i] + RW[i + 1] / 2); const c = xs[xs.length - 1] / 2; return xs.map(v => v - c); };
  const XS = mkLines(BWX), ZS = mkLines(BWZ), HALF = XS[NX], LIM = HALF + 40;
  const RAMPS = [2, 6];
  const rclass = w => (w >= 36 ? 'hw' : w >= 24 ? 'av' : w >= 16 ? 'st' : 'ln');
  const RSPEED = { hw: 30, av: 17, st: 12, ln: 9 };
  const BL = [];
  for (let i = 0; i < NX; i++) {
    BL[i] = [];
    for (let j = 0; j < NZ; j++) {
      const x0 = XS[i] + RW[i] / 2, x1 = XS[i + 1] - RW[i + 1] / 2, z0 = ZS[j] + RW[j] / 2, z1 = ZS[j + 1] - RW[j + 1] / 2;
      BL[i][j] = { i, j, x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, type: '' };
    }
  }
  function blockAt(x, z) {
    let i = -1, j = -1;
    for (let k = 0; k < NX; k++) if (x >= BL[k][0].x0 && x <= BL[k][0].x1) { i = k; break; }
    if (i < 0) return null;
    for (let k = 0; k < NZ; k++) if (z >= BL[0][k].z0 && z <= BL[0][k].z1) { j = k; break; }
    return j < 0 ? null : BL[i][j];
  }
  function nearestBlock(x, z) {
    let i = 0; while (i < NX - 1 && x > XS[i + 1]) i++;
    let j = 0; while (j < NZ - 1 && z > ZS[j + 1]) j++;
    return BL[i][j];
  }
  // collisions statiques : tables de hachage spatiales
  const CELL = 40, rectMap = new Map(), EMPTYR = [];
  const ckey = (ix, iz) => (ix + 200) * 1000 + (iz + 200);
  function addRect(x0, x1, z0, z1, h) {
    const r = { x0, x1, z0, z1, h }, m = 3;
    for (let ix = Math.floor((x0 - m) / CELL); ix <= Math.floor((x1 + m) / CELL); ix++) for (let iz = Math.floor((z0 - m) / CELL); iz <= Math.floor((z1 + m) / CELL); iz++) {
      const k = ckey(ix, iz); let a = rectMap.get(k); if (!a) { a = []; rectMap.set(k, a); } a.push(r);
    }
  }
  const rectsAt = (x, z) => rectMap.get(ckey(Math.floor(x / CELL), Math.floor(z / CELL))) || EMPTYR;
  const markers = [];
  const labels = [];
  const glowPts = [];
  const BLD = [];
  const WHITE = [1, 1, 1];

  function roofDetails(cx, cz, sx, sz, top, style) {
    plainB.box(cx, top + 0.08, cz, sx - 0.3, 0.16, sz - 0.3, 0x4a4d52);
    if (style !== 'glass') {
      plainB.box(cx, top + 0.5, cz - sz / 2 + 0.15, sx, 0.9, 0.3, 0xcfc9bd); plainB.box(cx, top + 0.5, cz + sz / 2 - 0.15, sx, 0.9, 0.3, 0xcfc9bd);
      plainB.box(cx - sx / 2 + 0.15, top + 0.5, cz, 0.3, 0.9, sz, 0xcfc9bd); plainB.box(cx + sx / 2 - 0.15, top + 0.5, cz, 0.3, 0.9, sz, 0xcfc9bd);
    }
    const n = 1 + Math.floor(wr() * 3);
    for (let k = 0; k < n; k++) {
      const ax = cx + (wr() - 0.5) * (sx - 8), az = cz + (wr() - 0.5) * (sz - 8);
      plainB.box(ax, top + 0.9, az, 2.4, 1.5, 1.8, 0x8f959b); plainB.box(ax, top + 1.8, az, 1.6, 0.25, 1.2, 0x5d6268);
    }
    if (wr() < 0.35) { const ax = cx + (wr() - 0.5) * (sx - 8), az = cz + (wr() - 0.5) * (sz - 8); plainB.cyl(ax, top + 0.2, az, 1.5, 1.5, 1.5, 1.5, 2.8, 10, 0x7a5a3c); plainB.cyl(ax, top + 3, az, 1.6, 1.6, 0.1, 0.1, 1.1, 10, 0x4a4036); }
    if (wr() < 0.3) { const ax = cx + (wr() - 0.5) * (sx - 6), az = cz + (wr() - 0.5) * (sz - 6); plainB.box(ax, top + 4.5, az, 0.18, 9, 0.18, 0x666a70); lampB.box(ax, top + 9.2, az, 0.4, 0.4, 0.4, 0xff3030); glowPts.push([ax, top + 9.2, az, 1]); }
    if (wr() < 0.12 && sx > 20) { const ax = cx, az = cz + sz / 2 - 3; plainB.box(ax, top + 3.4, az, 11, 5, 0.4, 0x2a2a2e); plainB.box(ax, top + 3.4, az + 0.25, 10.2, 4.2, 0.1, [0xe74c3c, 0x2e86de, 0xf1c40f, 0x27ae60][(wr() * 4) | 0]); plainB.box(ax - 3, top + 0.8, az - 0.1, 0.3, 1.6, 0.3, 0x333333); plainB.box(ax + 3, top + 0.8, az - 0.1, 0.3, 1.6, 0.3, 0x333333); }
  }

  // ---------- Éléments d'architecture ----------
  const SHOP_TINTS = [[1, 1, 1], hex2rgb(0xffe0d0), hex2rgb(0xd8e8ff), hex2rgb(0xe8ffe0), hex2rgb(0xfff0b8)];
  const TINTS = {
    glass: [0xffffff, 0xd8ecff, 0xc8eee6, 0xe6e6f4],
    concrete: [0xffffff, 0xece6dc, 0xdadfe4],
    brick: [0xffffff, 0xf3d9c6, 0xdcb9a0, 0xffe7d2],
    stucco: [0xfff1d6, 0xf8d9d2, 0xd8e8f2, 0xe3efd1, 0xf4e4ff]
  };
  function facePoly(B, pts, out, color) {
    const T = [];
    for (let i = 1; i < pts.length - 1; i++) T.push([0, i, i + 1]);
    B.emit(pts, T, color, () => out);
  }
  function pyramid(cx, cz, sx, sz, y, h, color) {
    const V = [[cx - sx / 2, y, cz - sz / 2], [cx + sx / 2, y, cz - sz / 2], [cx + sx / 2, y, cz + sz / 2], [cx - sx / 2, y, cz + sz / 2], [cx, y + h, cz]];
    plainB.emit(V, [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]], color, c => [c[0] - cx, c[1] - (y + h * 0.3), c[2] - cz]);
  }
  function gableRoof(cx, cz, sx, sz, y, h, tile, wall) {
    const alongX = sx >= sz, hx = sx / 2 + 0.3, hz = sz / 2 + 0.3;
    if (alongX) {
      const r0 = [cx - hx, y + h, cz], r1 = [cx + hx, y + h, cz];
      facePoly(plainB, [[cx - hx, y, cz + hz], [cx + hx, y, cz + hz], r1, r0], [0, hz, h], tile);
      facePoly(plainB, [[cx + hx, y, cz - hz], [cx - hx, y, cz - hz], r0, r1], [0, hz, -h], tile);
      facePoly(plainB, [[cx + sx / 2, y, cz - sz / 2], [cx + sx / 2, y, cz + sz / 2], [cx + sx / 2, y + h * 0.96, cz]], [1, 0, 0], wall);
      facePoly(plainB, [[cx - sx / 2, y, cz + sz / 2], [cx - sx / 2, y, cz - sz / 2], [cx - sx / 2, y + h * 0.96, cz]], [-1, 0, 0], wall);
      plainB.box(cx + sx * 0.25, y + h * 0.7, cz + hz * 0.2, 0.9, h * 0.9, 0.9, 0x8a5a44);
    } else {
      const r0 = [cx, y + h, cz - hz], r1 = [cx, y + h, cz + hz];
      facePoly(plainB, [[cx + hx, y, cz + hz], [cx + hx, y, cz - hz], r0, r1], [hx, h, 0], tile);
      facePoly(plainB, [[cx - hx, y, cz - hz], [cx - hx, y, cz + hz], r1, r0], [-hx, h, 0], tile);
      facePoly(plainB, [[cx - sx / 2, y, cz + sz / 2], [cx + sx / 2, y, cz + sz / 2], [cx, y + h * 0.96, cz + sz / 2]], [0, 0, 1], wall);
      facePoly(plainB, [[cx + sx / 2, y, cz - sz / 2], [cx - sx / 2, y, cz - sz / 2], [cx, y + h * 0.96, cz - sz / 2]], [0, 0, -1], wall);
      plainB.box(cx + hx * 0.2, y + h * 0.7, cz + sz * 0.25, 0.9, h * 0.9, 0.9, 0x8a5a44);
    }
  }
  function addBalconies(x0, x1, z0, z1, ybot, h, faces) {
    const nf = Math.floor(h / 4), RAIL = 0x2c3036, SLAB = 0xcfc9bd;
    for (const face of faces) {
      const horiz = face === '+z' || face === '-z', len = horiz ? x1 - x0 : z1 - z0;
      for (let f = 1; f < nf; f += 2) {
        const yy = ybot + f * 4 + 0.78;
        for (let d = 2; d < len - 1; d += 4) {
          let bx, bz, sx = 3.0, sz = 0.9, ox = 0, oz = 0;
          if (face === '+z') { bx = x0 + d; bz = z1; oz = 1; }
          else if (face === '-z') { bx = x1 - d; bz = z0; oz = -1; }
          else if (face === '+x') { bx = x1; bz = z1 - d; ox = 1; sx = 0.9; sz = 3.0; }
          else { bx = x0; bz = z0 + d; ox = -1; sx = 0.9; sz = 3.0; }
          const cx = bx + ox * 0.45, cz = bz + oz * 0.45;
          plainB.box(cx, yy, cz, sx, 0.14, sz, SLAB);
          if (horiz) {
            plainB.box(cx, yy + 0.5, bz + oz * 0.88, sx, 0.9, 0.05, RAIL);
            plainB.box(cx - sx / 2 + 0.03, yy + 0.5, cz, 0.05, 0.9, sz, RAIL); plainB.box(cx + sx / 2 - 0.03, yy + 0.5, cz, 0.05, 0.9, sz, RAIL);
          } else {
            plainB.box(bx + ox * 0.88, yy + 0.5, cz, 0.05, 0.9, sz, RAIL);
            plainB.box(cx, yy + 0.5, cz - sz / 2 + 0.03, sx, 0.9, 0.05, RAIL); plainB.box(cx, yy + 0.5, cz + sz / 2 - 0.03, sx, 0.9, 0.05, RAIL);
          }
        }
      }
    }
  }
  function addAwnings(x0, x1, z0, z1, faces) {
    for (const face of faces) {
      const horiz = face === '+z' || face === '-z', len = horiz ? x1 - x0 : z1 - z0, n = Math.max(1, Math.floor(len / 4));
      for (let k = 0; k < n; k++) {
        const col = (k % 2) ? 0xe9e4d8 : [0xc0392b, 0x2c6fbb, 0x2e8b57, 0xd9a21b][(wr() * 4) | 0];
        const t0 = len / n * k, t1 = len / n * (k + 1);
        let a, b, c, d, out;
        if (face === '+z') { a = [x0 + t0, 3.75, z1]; b = [x0 + t1, 3.75, z1]; c = [x0 + t1, 3.1, z1 + 1.1]; d = [x0 + t0, 3.1, z1 + 1.1]; out = [0, 1, 0.6]; }
        else if (face === '-z') { a = [x1 - t0, 3.75, z0]; b = [x1 - t1, 3.75, z0]; c = [x1 - t1, 3.1, z0 - 1.1]; d = [x1 - t0, 3.1, z0 - 1.1]; out = [0, 1, -0.6]; }
        else if (face === '+x') { a = [x1, 3.75, z1 - t0]; b = [x1, 3.75, z1 - t1]; c = [x1 + 1.1, 3.1, z1 - t1]; d = [x1 + 1.1, 3.1, z1 - t0]; out = [0.6, 1, 0]; }
        else { a = [x0, 3.75, z0 + t0]; b = [x0, 3.75, z0 + t1]; c = [x0 - 1.1, 3.1, z0 + t1]; d = [x0 - 1.1, 3.1, z0 + t0]; out = [-0.6, 1, 0]; }
        facePoly(plainB, [a, b, c, d], out, col);
        facePoly(plainB, [d, c, b, a], [-out[0], -out[1], -out[2]], 0x2a2a2a);
      }
    }
  }
  function addBladeSign(x0, x1, z0, z1, faces) {
    if (!faces.length) return;
    const face = faces[(wr() * faces.length) | 0], col = [0xff3b6b, 0x35e0ff, 0xffd23b, 0x7dff6b, 0xff8a1f][(wr() * 5) | 0];
    let x, z, ox = 0, oz = 0;
    if (face === '+z') { x = x0 + 1 + wr() * (x1 - x0 - 2); z = z1; oz = 1; }
    else if (face === '-z') { x = x0 + 1 + wr() * (x1 - x0 - 2); z = z0; oz = -1; }
    else if (face === '+x') { z = z0 + 1 + wr() * (z1 - z0 - 2); x = x1; ox = 1; }
    else { z = z0 + 1 + wr() * (z1 - z0 - 2); x = x0; ox = -1; }
    plainB.box(x + ox * 0.5, 3.9, z + oz * 0.5, ox ? 1 : 0.06, 0.06, oz ? 1 : 0.06, 0x2c3036);
    const sx = x + ox * 1.0, sz = z + oz * 1.0;
    lampB.box(sx, 3.9, sz, ox ? 0.12 : 0.6, 0.9, oz ? 0.12 : 0.6, col);
    glowPts.push([sx, 3.9, sz, 2]);
  }
  function addCylTower(cx, cz, r, h, yb, tint) {
    const seg = 28, y0 = 0.18 + yb, V = [], T = [], col = hex2rgb(tint), F = facade.glass.b;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * TAU, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, u = i / seg * TAU * r / 32;
      V.push([x, y0, z, col, null, [u, 0]], [x, y0 + h, z, col, null, [u, h / 32]]);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; T.push([a, a + 2, a + 3], [a, a + 3, a + 1]); }
    F.emit(V, T, col, c => [c[0] - cx, 0, c[2] - cz], v => v[3], null, v => v[5]);
    plainB.cyl(cx, y0 + h, cz, r, r, r * 0.96, r * 0.96, 0.8, 28, 0x555a60);
    plainB.cyl(cx, y0 + h + 0.8, cz, 0.3, 0.3, 0.2, 0.2, 9, 8, 0x777b80);
    lampB.box(cx, y0 + h + 9.8, cz, 0.4, 0.4, 0.4, 0xff3030); glowPts.push([cx, y0 + h + 9.8, cz, 1]);
    addRect(cx - r * 0.8, cx + r * 0.8, cz - r * 0.8, cz + r * 0.8, h + yb);
  }
  function pickStyle(dc) {
    const r = wr();
    if (dc < 2.4) return r < 0.5 ? 'glass' : r < 0.85 ? 'concrete' : 'brick';
    if (dc < 4.2) return r < 0.3 ? 'concrete' : r < 0.65 ? 'brick' : r < 0.9 ? 'stucco' : 'glass';
    return r < 0.55 ? 'brick' : r < 0.95 ? 'stucco' : 'concrete';
  }
  function podiumTower(l, dc) {
    const hb = 9 + wr() * 5, ht = 40 + wr() * 45 + Math.max(0, 3.5 - dc) * 10;
    addBuilding(l[0], l[1], l[2], l[3], hb, pick(['concrete', 'brick']), pick(TINTS.concrete), { noTier: true, balc: false });
    addBuilding(l[0] + 4, l[1] - 4, l[2] + 4, l[3] - 4, ht, 'glass', pick(TINTS.glass), { yBase: hb, noTier: true });
  }
  function crownTower(l) {
    let x0 = l[0], x1 = l[1], z0 = l[2], z1 = l[3], yb = 0;
    const style = pick(['concrete', 'glass']), tint = pick(TINTS[style]);
    const tiers = [[0, 30 + wr() * 30], [3.5, 12 + wr() * 10], [3.5, 8 + wr() * 8]];
    for (const t of tiers) {
      x0 += t[0]; x1 -= t[0]; z0 += t[0]; z1 -= t[0];
      addBuilding(x0, x1, z0, z1, t[1], style, tint, { yBase: yb, noTier: true, roof: 'none', noShop: yb > 0 });
      yb += t[1];
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    pyramid(cx, cz, x1 - x0, z1 - z0, 0.18 + yb, 8, 0x5b8f7a);
    plainB.box(cx, 0.18 + yb + 13, cz, 0.35, 10, 0.35, 0x777b80);
    lampB.box(cx, 0.18 + yb + 18.2, cz, 0.4, 0.4, 0.4, 0xff3030); glowPts.push([cx, 0.18 + yb + 18.2, cz, 1]);
  }
  function cylTower(l, dc) {
    const cx = (l[0] + l[1]) / 2, cz = (l[2] + l[3]) / 2, r = Math.min(l[1] - l[0], l[3] - l[2]) / 2 - 1.2, h = 40 + wr() * 50 + Math.max(0, 3 - dc) * 10;
    plainB.cyl(cx, 0.18, cz, r + 1, r + 1, r + 0.8, r + 0.8, 6, 28, 0x8d9298);
    addCylTower(cx, cz, r, h, 6, pick(TINTS.glass));
  }
  function lShape(l, dc) {
    const w = l[1] - l[0], d = l[3] - l[2], st = pickStyle(dc), tint = pick(TINTS[st]), h = 14 + wr() * 22;
    addBuilding(l[0], l[0] + w * 0.58, l[2], l[3], h, st, tint, { balc: true });
    addBuilding(l[0] + w * 0.58, l[1], l[2], l[2] + d * 0.55, h * 0.7, st, tint, { balc: wr() < 0.5 });
  }
  function house(l) {
    const st = wr() < 0.5 ? 'stucco' : 'brick', h = 7 + wr() * 6;
    addBuilding(l[0], l[1], l[2], l[3], h, st, pick(TINTS[st]), { roof: 'gable', balc: wr() < 0.5 });
  }
  function warehouse(l) {
    const h = 8 + wr() * 3;
    addBuilding(l[0], l[1], l[2], l[3], h, 'concrete', pick(TINTS.concrete), { noShop: true });
    const cx = (l[0] + l[1]) / 2, n = Math.max(2, Math.floor((l[1] - l[0]) / 8));
    for (let k = 0; k < n; k++) plainB.box(l[0] + (k + 0.5) * (l[1] - l[0]) / n, 2.0, l[3] + 0.1, 4, 3.6, 0.2, 0x4a525a);
  }
  function placeBuilding(bi, bj, l, dc) {
    const w = l[1] - l[0], d = l[3] - l[2], r = wr(), big = w > 22 && d > 22;
    if (dc < 2.6) {
      if (big && r < 0.18) return podiumTower(l, dc);
      if (big && r < 0.38) return crownTower(l);
      if (big && r < 0.55) return cylTower(l, dc);
    } else if (dc < 4.4) {
      if (big && r < 0.1) return podiumTower(l, dc);
      if (big && r < 0.24) return lShape(l, dc);
      if (r < 0.42 && w < 40 && d < 40) return house(l);
      if (r > 0.9) return warehouse(l);
    } else {
      if (r < 0.3 && w < 40 && d < 40) return house(l);
      if (r < 0.45) return warehouse(l);
      if (big && r < 0.6) return lShape(l, dc);
    }
    const st = pickStyle(dc);
    const base = st === 'glass' ? 30 + wr() * 40 : st === 'brick' || st === 'stucco' ? 12 + wr() * 16 : 16 + wr() * 30;
    const h = Math.max(10, base + Math.max(0, 4.6 - dc) * (st === 'glass' ? 9 : 5));
    addBuilding(l[0], l[1], l[2], l[3], h, st, pick(TINTS[st]), { balc: st !== 'glass' && wr() < 0.55 });
  }
  function streetFaces(x0, x1, z0, z1) {
    const bl = blockAt((x0 + x1) / 2, (z0 + z1) / 2), f = [];
    if (!bl) return f;
    if (z1 > bl.z1 - 8) f.push('+z'); if (z0 < bl.z0 + 8) f.push('-z'); if (x1 > bl.x1 - 8) f.push('+x'); if (x0 < bl.x0 + 8) f.push('-x');
    return f;
  }
  function addBuilding(x0, x1, z0, z1, h, style, tint, o) {
    if (typeof o !== 'object' || o === null) o = { noShop: !!o };
    const yb = o.yBase || 0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = x1 - x0, sz = z1 - z0, y0 = 0.18 + yb;
    const noShop = o.noShop || yb > 0, SF = noShop ? 0 : Math.min(4.6, h), F = facade[style].b, col = tint || 0xffffff;
    const faces = streetFaces(x0, x1, z0, z1), bodyH = h - SF, uo = Math.floor(wr() * 8) / 8;
    const det = style !== 'glass' && bodyH >= 8 && !o.noDetail && sx > 6 && sz > 6, inset = det ? 0.32 : 0;
    if (!noShop) shopB.box(cx, y0 + SF / 2, cz, sx, SF, sz, pick(SHOP_TINTS), { tu: 8, tv: SF, uo: Math.floor(wr() * 4) / 4 });
    if (bodyH > 0) F.box(cx, y0 + SF + bodyH / 2, cz, sx - inset * 2, bodyH, sz - inset * 2, col, { tu: 32, tv: 32, uo, vo: 0, shade: 1 });
    if (det) BLD.push({ x0, x1, z0, z1, cx, cz, y0: y0 + SF, h: bodyH, style, tint: col, front: o.front || null, seed: (wr() * 1000) | 0, det: null });
    if (style !== 'glass') {
      if (!noShop) plainB.box(cx, y0 + SF + 0.12, cz, sx + 0.4, 0.4, sz + 0.4, 0xcfc9bd);
      plainB.box(cx, y0 + h - 0.3, cz, sx + 0.6, 0.6, sz + 0.6, 0xd6d0c4);
      for (const px of [x0, x1]) for (const pz of [z0, z1]) plainB.box(px, y0 + h / 2, pz, 0.6, h, 0.6, 0xc8c2b6);
    }
    addRect(x0, x1, z0, z1, h + yb);
    if (!noShop) { if (o.awn !== false) addAwnings(x0, x1, z0, z1, faces); if (wr() < 0.5) addBladeSign(x0, x1, z0, z1, faces); }
    if (o.balc && style !== 'glass' && bodyH > 9) addBalconies(x0, x1, z0, z1, y0 + SF, bodyH, faces);
    if (!noShop && style !== 'glass' && faces.length && bodyH > 8 && wr() < 0.6) {
      for (let k = 0; k < 2 + ((wr() * 4) | 0); k++) {
        const face = faces[(wr() * faces.length) | 0], horiz = face === '+z' || face === '-z', len = horiz ? sx : sz, t = 2 + Math.floor(wr() * Math.max(1, (len - 4) / 4)) * 4;
        const yy = y0 + SF + 4 * (1 + Math.floor(wr() * Math.max(1, bodyH / 4 - 1))) + 0.55;
        let ax, az, ox = 0, oz = 0;
        if (face === '+z') { ax = x0 + t; az = z1; oz = 1; } else if (face === '-z') { ax = x1 - t; az = z0; oz = -1; } else if (face === '+x') { ax = x1; az = z1 - t; ox = 1; } else { ax = x0; az = z0 + t; ox = -1; }
        plainB.box(ax + ox * 0.28, yy, az + oz * 0.28, ox ? 0.5 : 0.8, 0.55, oz ? 0.5 : 0.8, 0xb8bcc0);
        plainB.box(ax + ox * 0.55, yy, az + oz * 0.55, ox ? 0.04 : 0.6, 0.4, oz ? 0.04 : 0.6, 0x3a3d42);
      }
    }
    let top = y0 + h, tsx = sx, tsz = sz, tcx = cx, tcz = cz;
    if (o.roof === 'gable') { const gh = 2.6 + Math.min(sx, sz) * 0.18; gableRoof(cx, cz, sx, sz, top, gh, wr() < 0.5 ? 0x9a4a33 : 0x4b4f58, 0xe7dfd0); addRect(x0, x1, z0, z1, h + yb + gh * 0.5); return; }
    if (o.roof === 'none') return;
    if (!o.noTier && h > 36 && sx > 22 && sz > 22) {
      const k = 0.62 + wr() * 0.12, h2 = 8 + wr() * 14, nx = sx * k, nz = sz * k;
      tcx = cx + (wr() - 0.5) * (sx - nx) * 0.6; tcz = cz + (wr() - 0.5) * (sz - nz) * 0.6;
      roofDetails(cx, cz, sx, sz, top, 'glass');
      F.box(tcx, top + h2 / 2, tcz, nx, h2, nz, col, { tu: 32, tv: 32, uo: Math.floor(wr() * 8) / 8, vo: 0, shade: 1 });
      top += h2; tsx = nx; tsz = nz;
      addRect(tcx - nx / 2, tcx + nx / 2, tcz - nz / 2, tcz + nz / 2, h + yb + h2);
    }
    roofDetails(tcx, tcz, tsx, tsz, top, style);
  }
  function fillRegion(bi, bj, x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0, g = 3, L = [], bl = BL[bi][bj], dc = Math.hypot(bl.cx, bl.cz) / 82;
    let m = wr();
    if (w < 8 || d < 8) return;
    if (dc > 4.4 && w > 40 && wr() < 0.55) m = 0.9;
    if (m < 0.3) L.push([x0, x1, z0, z1]);
    else if (m < 0.58) { const a = x0 + w * (0.35 + wr() * 0.3); L.push([x0, a - g / 2, z0, z1], [a + g / 2, x1, z0, z1]); }
    else if (m < 0.82) { const a = z0 + d * (0.35 + wr() * 0.3); L.push([x0, x1, z0, a - g / 2], [x0, x1, a + g / 2, z1]); }
    else { const ax = x0 + w * 0.5, az = z0 + d * 0.5; L.push([x0, ax - g / 2, z0, az - g / 2], [ax + g / 2, x1, z0, az - g / 2], [x0, ax - g / 2, az + g / 2, z1], [ax + g / 2, x1, az + g / 2, z1]); }
    for (const l of L) placeBuilding(bi, bj, l, dc);
  }

  // ---------- Mobilier urbain ----------
  function addLamp(x, z, nx, nz) {
    plainB.cyl(x, 0.18, z, 0.13, 0.13, 0.08, 0.08, 7.2, 8, 0x3b3f45);
    const ax = x + nx * 1.9, az = z + nz * 1.9;
    plainB.box(x + nx * 0.95, 7.35, z + nz * 0.95, Math.abs(nx) * 1.9 + 0.12, 0.12, Math.abs(nz) * 1.9 + 0.12, 0x3b3f45);
    lampB.box(ax, 7.25, az, 0.7, 0.14, 0.4, 0xfff1c8);
    glowPts.push([ax, 7.1, az, 0]);
    addRect(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 7);
  }
  function branch(B, x0, y0, z0, x1, y1, z1, r0, r1, col) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz) || 1, ux = dx / L, uy = dy / L, uz = dz / L;
    const rf = Math.abs(uy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let px = uy * rf[2] - uz * rf[1], py = uz * rf[0] - ux * rf[2], pz = ux * rf[1] - uy * rf[0];
    const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
    const qx = uy * pz - uz * py, qy = uz * px - ux * pz, qz = ux * py - uy * px, seg = 6, V = [], T = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      V.push([x0 + (px * ca + qx * sa) * r0, y0 + (py * ca + qy * sa) * r0, z0 + (pz * ca + qz * sa) * r0], [x1 + (px * ca + qx * sa) * r1, y1 + (py * ca + qy * sa) * r1, z1 + (pz * ca + qz * sa) * r1]);
    }
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; T.push([i * 2, j * 2, j * 2 + 1], [i * 2, j * 2 + 1, i * 2 + 1]); }
    B.emit(V, T, col, c => { const wx = c[0] - x0, wy = c[1] - y0, wz = c[2] - z0, d = wx * ux + wy * uy + wz * uz; return [wx - d * ux, wy - d * uy, wz - d * uz]; });
  }
  function addTree(x, z, s) {
    const h = (3.4 + wr() * 1.2) * s, lean = (wr() - 0.5) * 0.6, tc = hex2rgb(0x4a3a2b), tx = x + lean * 0.5, tz = z + lean * 0.35, cy = 0.18 + h;
    branch(plainB, x, 0.18, z, tx, cy, tz, 0.3 * s, 0.15 * s, tc);
    const nb = 4 + ((wr() * 3) | 0);
    for (let k = 0; k < nb; k++) {
      const a = wr() * TAU, el = 0.5 + wr() * 0.7, len = (1.6 + wr() * 1.4) * s, ce = Math.cos(el), by = cy - 0.4 * s;
      branch(plainB, tx, by, tz, tx + Math.cos(a) * len * ce, by + Math.sin(el) * len, tz + Math.sin(a) * len * ce, 0.1 * s, 0.035 * s, tc);
    }
    const Rr = 2.6 * s, cy2 = cy + 1.7 * s, tint = pick([[1, 1, 0.9], [0.85, 1, 0.75], [0.95, 1, 0.8], [1.15, 0.95, 0.55], [0.8, 0.95, 0.7]]);
    for (let k = 0; k < 34; k++) {
      let px, py, pz; do { px = wr() * 2 - 1; py = wr() * 2 - 1; pz = wr() * 2 - 1; } while (px * px + py * py + pz * pz > 1);
      const cx = tx + px * Rr, cyy = cy2 + py * Rr * 0.8, cz = tz + pz * Rr;
      let nx = wr() * 2 - 1, ny = wr() * 2 - 1, nz = wr() * 2 - 1; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      let ux = ny * 0 - nz * 1, uy = nz * 0 - nx * 0, uz = nx * 1 - ny * 0; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux, sz = (1.1 + wr() * 0.9) * s;
      const lt = 0.78 + (py * 0.5 + 0.5) * 0.4, col = [s2l(tint[0] * lt), s2l(tint[1] * lt), s2l(tint[2] * lt)];
      let sn = [px, py + 0.35, pz]; const sl = Math.hypot(sn[0], sn[1], sn[2]) || 1; sn = [sn[0] / sl, sn[1] / sl, sn[2] / sl];
      leafB.quad([[cx - ux * sz - vx * sz, cyy - uy * sz - vy * sz, cz - uz * sz - vz * sz], [cx + ux * sz - vx * sz, cyy + uy * sz - vy * sz, cz + uz * sz - vz * sz],
        [cx + ux * sz + vx * sz, cyy + uy * sz + vy * sz, cz + uz * sz + vz * sz], [cx - ux * sz + vx * sz, cyy - uy * sz + vy * sz, cz - uz * sz + vz * sz]], sn, col, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    addRect(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 4);
  }
  function addTrafficLight(x, z, sx, sz, greenAxisX) {
    plainB.cyl(x, 0.18, z, 0.1, 0.1, 0.07, 0.07, 5.4, 8, 0x30343a);
    plainB.box(x - sx * 0.9, 5.4, z - sz * 0.9, Math.abs(sx) * 1.8 + 0.14, 0.14, Math.abs(sz) * 1.8 + 0.14, 0x30343a);
    const hx = x - sx * 1.8, hz = z - sz * 1.8;
    plainB.box(hx, 5.0, hz, 0.42, 1.2, 0.42, 0x1a1c20);
    lampB.box(hx, 5.4, hz, 0.22, 0.22, 0.45, greenAxisX ? 0x30e060 : 0xff3030);
    lampB.box(hx, 5.0, hz, 0.22, 0.22, 0.45, 0x403a10);
    lampB.box(hx, 4.6, hz, 0.22, 0.22, 0.45, greenAxisX ? 0x103a18 : 0x401010);
    addRect(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 5);
  }


  // ---------- Trottoirs : lampadaires, arbres, accessoires ----------
  function sidesOf(bl) {
    return [
      { s: 'N', hw: bl.j === 0, ax: 'x', a0: bl.x0, a1: bl.x1, e: bl.z0, nx: 0, nz: -1 },
      { s: 'S', hw: bl.j === NZ - 1, ax: 'x', a0: bl.x0, a1: bl.x1, e: bl.z1, nx: 0, nz: 1 },
      { s: 'W', hw: bl.i === 0, ax: 'z', a0: bl.z0, a1: bl.z1, e: bl.x0, nx: -1, nz: 0 },
      { s: 'E', hw: bl.i === NX - 1, ax: 'z', a0: bl.z0, a1: bl.z1, e: bl.x1, nx: 1, nz: 0 }
    ];
  }
  const sidePt = (sd, t, inset) => (sd.ax === 'x' ? [t, sd.e - sd.nz * inset] : [sd.e - sd.nx * inset, t]);
  function furniture(bl, type) {
    for (const sd of sidesOf(bl)) {
      if (sd.hw) continue;
      for (let t = sd.a0 + 16; t < sd.a1 - 8; t += 34) { const p = sidePt(sd, t, 1.3); addLamp(p[0], p[1], sd.nx, sd.nz); }
      if (type === 'down' || type === 'mid') for (let t = sd.a0 + 9 + wr() * 6; t < sd.a1 - 8; t += 26) { const p = sidePt(sd, t, 2.8); addTree(p[0], p[1], 0.8 + wr() * 0.3); }
      for (let k = 0; k < 3; k++) {
        if (wr() > 0.45) continue;
        const t = sd.a0 + 8 + wr() * (sd.a1 - sd.a0 - 16), p = sidePt(sd, t, 1.5), r = wr(), px = p[0], pz = p[1];
        if (r < 0.34) { plainB.cyl(px, 0.18, pz, 0.13, 0.13, 0.11, 0.11, 0.55, 8, 0xc0392b); plainB.cyl(px, 0.73, pz, 0.15, 0.15, 0.15, 0.15, 0.1, 8, 0xa93226); addRect(px - 0.2, px + 0.2, pz - 0.2, pz + 0.2, 0.8); }
        else if (r < 0.67) { plainB.cyl(px, 0.18, pz, 0.28, 0.26, 0.26, 0.26, 0.85, 10, 0x2f4f3f); plainB.cyl(px, 1.03, pz, 0.3, 0.3, 0.3, 0.3, 0.07, 10, 0x1f3a2c); addRect(px - 0.3, px + 0.3, pz - 0.3, pz + 0.3, 1); }
        else { plainB.cyl(px, 0.18, pz, 0.04, 0.04, 0.04, 0.04, 1.15, 6, 0x555a60); plainB.box(px, 1.4, pz, 0.2, 0.28, 0.12, 0x2d3036); }
      }
      if (sd.ax === 'x' && type !== 'suburb' && wr() < 0.4) {
        const t = sd.a0 + 20 + wr() * (sd.a1 - sd.a0 - 40), p = sidePt(sd, t, 1.6), sx = p[0], sz = p[1], k = -sd.nz;
        plainB.box(sx, 2.55, sz, 3.6, 0.1, 1.5, 0x2c3036);
        for (const e of [-1.6, 1.6]) plainB.box(sx + e, 1.35, sz, 0.08, 2.4, 0.08, 0x2c3036);
        plainB.box(sx, 1.4, sz - k * 0.65, 3.2, 2.2, 0.04, 0x6f8a99);
        plainB.box(sx, 0.62, sz - k * 0.3, 2.6, 0.08, 0.4, 0x7a5a3c);
        addRect(sx - 1.8, sx + 1.8, sz - 0.9, sz + 0.9, 2.5);
      }
    }
  }

  // ---------- Données des lieux ----------
  const SPECIAL = {
    '4,4': 'bank', '5,3': 'police', '3,5': 'hospital', '3,3': 'gun', '2,2': 'store0', '6,3': 'store1', '5,6': 'store2', '4,2': 'jewel',
    '2,4': 'park', '6,5': 'park', '4,6': 'park', '1,3': 'park', '7,2': 'park', '3,1': 'park'
  };
  const HEISTS = {
    store0: { name: 'SUPÉRETTE', col: 0x2ecc71, min: 300, max: 900, dur: 6, heat: 34, roof: 0xd8f0dc },
    store1: { name: 'STATION SERVICE', col: 0xe67e22, min: 400, max: 1100, dur: 7, heat: 36, roof: 0xf8dcc0 },
    store2: { name: 'SUPÉRETTE', col: 0x3498db, min: 300, max: 900, dur: 6, heat: 34, roof: 0xd0e4f8 },
    jewel: { name: 'BIJOUTERIE', col: 0xb86bff, min: 1800, max: 3600, dur: 9, heat: 55, roof: 0xe8d8f8 },
    bank: { name: 'BANQUE', col: 0x2ecc71, min: 7000, max: 13000, dur: 14, heat: 95, roof: 0xefe3c9 }
  };
  function makeLabel(text, color, w) {
    const cv = mkCanvas(512, 128), g = cv.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(4, 4, 504, 120);
    g.fillStyle = '#fff'; g.font = 'bold 60px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
    const t = tex(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
    sp.scale.set(w, w / 4, 1);
    disposables.push(sp.material);
    return sp;
  }
  function addLabel(x, y, z, text, color, w) { const s = makeLabel(text, color, w); s.position.set(x, y, z); scene.add(s); labels.push(s); }
  function addMarker(o) {
    const m = Object.assign({ cool: 0, r: 3.4 }, o);
    const ring = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.5, m.r, 40), new THREE.MeshBasicMaterial({ color: lin(m.color), transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, 0.34, m.z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(m.r * 0.85, m.r * 0.85, 16, 20, 1, true), new THREE.MeshBasicMaterial({ color: lin(m.color), transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(m.x, 8, m.z);
    scene.add(ring); scene.add(beam);
    m.ring = ring; m.beam = beam;
    disposables.push(ring.geometry, ring.material, beam.geometry, beam.material);
    markers.push(m); return m;
  }
  let respawnHosp = { x: 0, z: 0 }, respawnPolice = { x: 0, z: 0 }, spawnPt = { x: 0, z: 0 }, STARTER = { x: 0, z: 0, ang: 0 };

  function specialBlock(bl, t) {
    const hz = HEISTS[t], mx = bl.cx, ix0 = bl.x0 + 4, ix1 = bl.x1 - 4, iz0 = bl.z0 + 4;
    const fw = Math.min(t === 'gun' ? 18 : 24, bl.hx - 5), fd = Math.min(25, bl.hz * 2 - 18), fz1 = bl.z1 - 6, fz0 = fz1 - fd, mz = bl.z1 - 2;
    const backFill = () => { if (fz0 - 3 - iz0 >= 10) fillRegion(bl.i, bl.j, ix0, ix1, iz0, fz0 - 3); };
    if (t === 'bank') {
      const hw = Math.min(27, bl.hx - 5), z0 = bl.z0 + 5, z1 = bl.z1 - 8;
      addBuilding(mx - hw, mx + hw, z0, z1, 26, 'concrete', 0xf2e8d0, { noShop: true });
      for (let k = -2; k <= 2; k++) { const cxk = mx + k * (hw / 2.7); plainB.cyl(cxk, 0.18, z1 + 1.5, 0.9, 0.9, 0.9, 0.9, 15.6, 14, 0xf4f1ea); addRect(cxk - 0.9, cxk + 0.9, z1 + 0.6, z1 + 2.4, 15); }
      plainB.box(mx, 16.4, z1 + 1, hw * 2 - 4, 1, 3.6, 0xdcd2b8); plainB.box(mx, 0.35, z1 + 3, hw * 2, 0.4, 7, 0xd8d2c4); plainB.box(mx, 0.55, z1 + 4.5, hw * 1.1, 0.4, 3, 0xd8d2c4);
      addLabel(mx, 21, z1 + 2.5, 'BANQUE ARBEST', '#2ecc71', 22);
      addMarker({ type: 'heist', key: 'bank', x: mx, z: mz, color: 0x2ecc71, name: hz.name });
    } else if (hz) {
      backFill();
      addBuilding(mx - fw, mx + fw, fz0, fz1, 9, t === 'jewel' ? 'concrete' : 'stucco', hz.roof, { noDetail: true });
      plainB.box(mx, 4.9, fz1 + 1.2, fw * 2 + 1, 0.3, 2.4, 0x2a2a2e);
      addLabel(mx, 13, fz1 + 1.5, hz.name, '#' + hz.col.toString(16).padStart(6, '0'), 16);
      addMarker({ type: 'heist', key: t, x: mx, z: mz, color: hz.col, name: hz.name });
    } else if (t === 'gun') {
      backFill();
      addBuilding(mx - fw, mx + fw, fz0, fz1, 8, 'brick', 0xb86868, { noDetail: true });
      addLabel(mx, 12, fz1 + 1.5, 'ARMURERIE', '#ff5533', 15);
      addMarker({ type: 'shop', x: mx, z: mz, color: 0xff5533, name: 'ARMURERIE' });
    } else if (t === 'hospital') {
      backFill();
      const hw = Math.min(27, bl.hx - 5);
      addBuilding(mx - hw, mx + hw, fz0, fz1, 20, 'concrete', 0xffffff, {});
      plainB.box(mx, 21.3, (fz0 + fz1) / 2, 12, 0.5, 3, 0xe53935); plainB.box(mx, 21.3, (fz0 + fz1) / 2, 3, 0.5, 12, 0xe53935);
      addLabel(mx, 24, fz1 + 1.5, 'HÔPITAL', '#ff4d4d', 16);
      addMarker({ type: 'hospital', x: mx, z: mz, color: 0xff4d4d, name: 'HÔPITAL' });
      respawnHosp = { x: mx, z: mz };
    } else if (t === 'police') {
      backFill();
      const hw = Math.min(27, bl.hx - 5);
      addBuilding(mx - hw, mx + hw, fz0, fz1, 14, 'concrete', 0x9fb4d8, {});
      addLabel(mx, 18, fz1 + 1.5, 'POLICE', '#4da3ff', 14);
      addMarker({ type: 'police', x: mx, z: mz, color: 0x4da3ff, name: 'POLICE' });
      respawnPolice = { x: mx, z: mz };
    }
  }

  function parkBlock(bl) {
    const ix0 = bl.x0 + 4, ix1 = bl.x1 - 4, iz0 = bl.z0 + 4, iz1 = bl.z1 - 4, w = ix1 - ix0, d = iz1 - iz0, cx = bl.cx, cz = bl.cz;
    grassB.flat(cx, 0.19, cz, w, d, WHITE, 6);
    plainB.flat(cx, 0.2, cz, 3.4, d, 0xb9a98b); plainB.flat(cx, 0.2, cz, w, 3.4, 0xb9a98b);
    plainB.cyl(cx, 0.2, cz, 5, 5, 5, 5, 0.5, 20, 0xa9a9a4); plainB.cyl(cx, 0.7, cz, 4.2, 4.2, 4.2, 4.2, 0.12, 20, 0x2b6e9e);
    plainB.cyl(cx, 0.7, cz, 0.5, 0.5, 0.3, 0.3, 2.2, 8, 0xc9c9c4); addRect(cx - 5, cx + 5, cz - 5, cz + 5, 1);
    const px = cx + w * 0.25, pz = cz - d * 0.22;
    if (w > 50) { plainB.cyl(px, 0.19, pz, 9, 7, 9, 7, 0.12, 24, 0x3b84b8); addRect(px - 7, px + 7, pz - 5.5, pz + 5.5, 0.3); }
    if (w > 70 && d > 50) {
      const fx = cx - w * 0.25, fz = cz + d * 0.22, L = 36, Wd = 22;
      plainB.flat(fx, 0.21, fz, L + 4, Wd + 4, 0x3f7a35);
      for (const s of [-1, 1]) { plainB.flat(fx, 0.22, fz + s * Wd / 2, L, 0.25, 0xf2f2f2); plainB.flat(fx + s * L / 2, 0.22, fz, 0.25, Wd, 0xf2f2f2); plainB.box(fx + s * (L / 2 + 0.1), 1.2, fz, 0.15, 2.4, 7, 0xeeeeee); }
      plainB.flat(fx, 0.22, fz, 0.25, Wd, 0xf2f2f2);
    }
    const n = Math.floor(w * d / 110);
    for (let k = 0; k < n; k++) {
      const tx = ix0 + 3 + wr() * (w - 6), tz = iz0 + 3 + wr() * (d - 6);
      if (Math.abs(tx - cx) < 7 && Math.abs(tz - cz) < 7) continue;
      if (Math.abs(tx - cx) < 2.5 || Math.abs(tz - cz) < 2.5) continue;
      if (w > 50 && Math.hypot(tx - px, tz - pz) < 11) continue;
      if (w > 70 && Math.abs(tx - (cx - w * 0.25)) < 21 && Math.abs(tz - (cz + d * 0.22)) < 14) continue;
      addTree(tx, tz, 0.9 + wr() * 0.6);
    }
    for (const s of [-1, 1]) { plainB.box(cx + s * 9, 0.7, cz + 2.2, 2, 0.12, 0.6, 0x7a5a3c); plainB.box(cx + s * 9, 1.1, cz + 2.5, 2, 0.5, 0.1, 0x7a5a3c); plainB.box(cx + s * 9 - 0.8, 0.45, cz + 2.2, 0.1, 0.5, 0.5, 0x333333); plainB.box(cx + s * 9 + 0.8, 0.45, cz + 2.2, 0.1, 0.5, 0.5, 0x333333); }
  }

  function suburbLot(side, base, a0, wl, D, ix0, ix1, iz0, iz1) {
    const tf = (a, b) => (side === 'N' ? [base + a0 + a, iz0 + b] : side === 'S' ? [base + a0 + a, iz1 - b] : side === 'W' ? [ix0 + b, base + a0 + a] : [ix1 - b, base + a0 + a]);
    const rect = (aa, bb, b0, b1) => { const p = tf(aa, b0), q = tf(bb, b1); return [Math.min(p[0], q[0]), Math.max(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[1], q[1])]; };
    const front = side === 'N' ? '-z' : side === 'S' ? '+z' : side === 'W' ? '-x' : '+x';
    const hd = 8 + wr() * 4, st = wr() < 0.5 ? 'stucco' : 'brick', R = rect(3.5, wl - 3.5, 8, 8 + hd);
    addBuilding(R[0], R[1], R[2], R[3], 8, st, pick(TINTS[st]), { roof: 'gable', noShop: true, front, noTier: true });
    if (wl > 19) {
      const G = rect(wl - 3.4, wl - 0.4, 8, 15), gx = (G[0] + G[1]) / 2, gz = (G[2] + G[3]) / 2;
      plainB.box(gx, 1.7, gz, G[1] - G[0], 3.4, G[3] - G[2], 0xe8e2d6); plainB.box(gx, 3.5, gz, G[1] - G[0] + 0.3, 0.2, G[3] - G[2] + 0.3, 0x6a6e74);
      addRect(G[0], G[1], G[2], G[3], 3.5);
      if (side === 'N') plainB.box(gx, 1.3, G[2] - 0.03, 2.5, 2.4, 0.06, 0x7a7f86); else if (side === 'S') plainB.box(gx, 1.3, G[3] + 0.03, 2.5, 2.4, 0.06, 0x7a7f86);
      else if (side === 'W') plainB.box(G[0] - 0.03, 1.3, gz, 0.06, 2.4, 2.5, 0x7a7f86); else plainB.box(G[1] + 0.03, 1.3, gz, 0.06, 2.4, 2.5, 0x7a7f86);
      const V = rect(wl - 3.2, wl - 0.5, 0, 8); plainB.flat((V[0] + V[1]) / 2, 0.2, (V[2] + V[3]) / 2, V[1] - V[0], V[3] - V[2], 0x8d8b86);
    }
    for (const aa of [0, wl]) { const F = rect(aa - 0.05, aa + 0.05, 8, D); plainB.box((F[0] + F[1]) / 2, 0.55, (F[2] + F[3]) / 2, F[1] - F[0], 1.1, F[3] - F[2], 0xf3f1ea); }
    if (wr() < 0.75) { const p = tf(wl * (0.2 + wr() * 0.25), 3.5 + wr() * 2); addTree(p[0], p[1], 0.8 + wr() * 0.3); }
    if (wr() < 0.6) { const p = tf(wl * 0.5, D - 5); addTree(p[0], p[1], 0.9 + wr() * 0.3); }
    { const p = tf(wl * 0.45, 0.9); plainB.cyl(p[0], 0.18, p[1], 0.04, 0.04, 0.04, 0.04, 1.0, 6, 0x555a60); plainB.box(p[0], 1.28, p[1], 0.34, 0.26, 0.2, 0x2c6fbb); }
    if (wr() < 0.25) { const P = rect(5, wl - 5, 17, 25); plainB.flat((P[0] + P[1]) / 2, 0.22, (P[2] + P[3]) / 2, P[1] - P[0], P[3] - P[2], 0x2b9ad8); }
  }
  function suburbBlock(bl) {
    const ix0 = bl.x0 + 4, ix1 = bl.x1 - 4, iz0 = bl.z0 + 4, iz1 = bl.z1 - 4, D = 30;
    grassB.flat((ix0 + ix1) / 2, 0.19, (iz0 + iz1) / 2, ix1 - ix0, iz1 - iz0, WHITE, 6);
    const defs = [['N', ix0, ix1 - ix0, bl.j === 0], ['S', ix0, ix1 - ix0, bl.j === NZ - 1], ['W', iz0 + D, iz1 - iz0 - 2 * D, bl.i === 0], ['E', iz0 + D, iz1 - iz0 - 2 * D, bl.i === NX - 1]];
    for (const [side, base, len, hw] of defs) {
      if (len < 18) continue;
      if (hw) continue;
      let a0 = 0;
      while (a0 < len - 13) {
        const wl = Math.min(len - a0, 17 + wr() * 7);
        if (wl < 13) break;
        suburbLot(side, base, a0, wl, D, ix0, ix1, iz0, iz1);
        a0 += wl;
      }
    }
    const cw = ix1 - ix0 - 2 * D, cd = iz1 - iz0 - 2 * D;
    if (cw > 8 && cd > 8) for (let k = 0; k < cw * cd / 160; k++) addTree(ix0 + D + wr() * cw, iz0 + D + wr() * cd, 0.9 + wr() * 0.5);
    for (const sd of sidesOf(bl)) if (sd.hw) for (let t = sd.a0 + 8; t < sd.a1 - 6; t += 9 + wr() * 4) { const p = sidePt(sd, t, 3.2); addTree(p[0], p[1], 1 + wr() * 0.4); }
  }

  function industrialBlock(bl) {
    const ix0 = bl.x0 + 4, ix1 = bl.x1 - 4, iz0 = bl.z0 + 4, iz1 = bl.z1 - 4, w = ix1 - ix0, d = iz1 - iz0;
    plainB.flat(bl.cx, 0.2, bl.cz, w, d, 0x4a4c50);
    for (const s of [-1, 1]) { plainB.box(bl.cx, 1.1, bl.cz + s * (d / 2 - 0.5), w, 2.2, 0.1, 0x6b7078); plainB.box(bl.cx + s * (w / 2 - 0.5), 1.1, bl.cz, 0.1, 2.2, d, 0x6b7078); }
    for (let t = ix0; t < ix1; t += 6) for (const s of [-1, 1]) plainB.box(t, 1.15, bl.cz + s * (d / 2 - 0.5), 0.15, 2.3, 0.15, 0x555a60);
    const half = d > 60 ? 2 : 1;
    for (let k = 0; k < half; k++) {
      const z0 = iz0 + 3 + k * (d / half), z1 = z0 + Math.min(34, d / half - 18), x0 = ix0 + 6, x1 = ix0 + 6 + Math.min(w * 0.5, 56);
      warehouse([x0, x1, z0, z1]);
    }
    const cx0 = ix0 + Math.min(w * 0.5, 56) + 14;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = cx0 + c * 13.5, z = iz0 + 8 + r * 7;
      if (x + 6.5 > ix1 - 2) continue;
      const stack = 1 + ((wr() * 3) | 0), col = [0xc0392b, 0x2c6fbb, 0x2e8b57, 0xd9a21b, 0x8e5bb0, 0xe0e0e0][(wr() * 6) | 0];
      for (let s = 0; s < stack; s++) plainB.box(x, 0.2 + 1.3 + s * 2.6, z, 12.2, 2.5, 2.4, col);
      addRect(x - 6.1, x + 6.1, z - 1.2, z + 1.2, stack * 2.6);
    }
    for (let k = 0; k < 2; k++) { const tx = ix1 - 12 - k * 15, tz = iz1 - 12; if (tx > ix0 + 20) { plainB.cyl(tx, 0.2, tz, 6, 6, 6, 6, 12, 18, 0xc8ccd0); plainB.cyl(tx, 12.2, tz, 6, 6, 4.5, 4.5, 1.2, 18, 0xb0b4b8); addRect(tx - 6, tx + 6, tz - 6, tz + 6, 13); } }
    const chx = ix1 - 8, chz = iz0 + 12;
    plainB.cyl(chx, 0.2, chz, 2.2, 2.2, 1.5, 1.5, 32, 14, 0xb8b2a8); plainB.cyl(chx, 28, chz, 1.55, 1.55, 1.55, 1.55, 3, 14, 0xc0392b); lampB.box(chx, 35.5, chz, 0.5, 0.5, 0.5, 0xff3030); glowPts.push([chx, 35.5, chz, 1]);
    addRect(chx - 2.2, chx + 2.2, chz - 2.2, chz + 2.2, 32);
  }

  function buildBlock(bl) {
    bl.type = SPECIAL[bl.i + ',' + bl.j] || (() => {
      const e = Math.min(bl.i, NX - 1 - bl.i, bl.j, NZ - 1 - bl.j);
      if (e === 0) return 'suburb';
      if (bl.i >= 6 && bl.j >= 6) return 'industrial';
      if (e === 1) return wr() < 0.55 ? 'suburb' : 'mid';
      return (Math.abs(bl.i - 4) <= 1 && Math.abs(bl.j - 4) <= 1) ? 'down' : 'mid';
    })();
    const t = bl.type;
    walkB.box(bl.cx, 0.09, bl.cz, 2 * bl.hx, 0.18, 2 * bl.hz, WHITE, { tu: 4, top: true });
    furniture(bl, t);
    // murs anti-bruit côté autoroute
    for (const sd of sidesOf(bl)) if (sd.hw) {
      const len = sd.a1 - sd.a0, mid = (sd.a0 + sd.a1) / 2;
      if (sd.ax === 'x') { plainB.box(mid, 1.7, sd.e - sd.nz * -0.0 + sd.nz * 0.3, len, 3.4, 0.5, 0xb9b6ae); plainB.box(mid, 3.5, sd.e + sd.nz * 0.3, len, 0.2, 0.7, 0x9a978f); addRect(sd.a0, sd.a1, sd.e + sd.nz * 0.3 - 0.3, sd.e + sd.nz * 0.3 + 0.3, 3.4); }
      else { plainB.box(sd.e + sd.nx * 0.3, 1.7, mid, 0.5, 3.4, len, 0xb9b6ae); plainB.box(sd.e + sd.nx * 0.3, 3.5, mid, 0.7, 0.2, len, 0x9a978f); addRect(sd.e + sd.nx * 0.3 - 0.3, sd.e + sd.nx * 0.3 + 0.3, sd.a0, sd.a1, 3.4); }
    }
    if (t === 'down' || t === 'mid') fillRegion(bl.i, bl.j, bl.x0 + 4, bl.x1 - 4, bl.z0 + 4, bl.z1 - 4);
    else if (t === 'suburb') suburbBlock(bl);
    else if (t === 'industrial') industrialBlock(bl);
    else if (t === 'park') parkBlock(bl);
    else specialBlock(bl, t);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) buildBlock(BL[i][j]);
  { const pk = BL[2][4]; spawnPt = { x: pk.x1 - 2.5, z: pk.cz - 6 }; STARTER = { x: XS[3] - RW[3] / 4, z: pk.cz + 10, ang: 0 }; }

  // ---------- Routes (par tronçon) ----------
  const YEL = 0xe8c200, WHT = 0xf2f2f2;
  function roadMarks(axis, line, k) {
    const W = RW[line], cl = rclass(W);
    const a = (axis === 'z' ? ZS[k] + RW[k] / 2 : XS[k] + RW[k] / 2) + 0.8, b = (axis === 'z' ? ZS[k + 1] - RW[k + 1] / 2 : XS[k + 1] - RW[k + 1] / 2) - 0.8;
    if (b - a < 4) return;
    const c0 = axis === 'z' ? XS[line] : ZS[line];
    const L = (off, wd, col, dashed) => {
      if (!dashed) { const mid = (a + b) / 2, len = b - a; if (axis === 'z') markB.flat(c0 + off, 0.09, mid, wd, len, col); else markB.flat(mid, 0.09, c0 + off, len, wd, col); }
      else for (let t = a; t < b - 3.5; t += 8) { const m = t + 1.75; if (axis === 'z') markB.flat(c0 + off, 0.09, m, wd, 3.5, col); else markB.flat(m, 0.09, c0 + off, 3.5, wd, col); }
    };
    if (cl === 'hw') {
      for (const s of [-1, 1]) { L(s * (W / 2 - 0.7), 0.2, WHT, false); L(s * 2.9, 0.2, YEL, false); L(s * (2.9 + (W / 2 - 3.6) / 3), 0.16, WHT, true); L(s * (2.9 + 2 * (W / 2 - 3.6) / 3), 0.16, WHT, true); }
    } else if (cl === 'av') {
      L(-0.25, 0.14, YEL, false); L(0.25, 0.14, YEL, false);
      for (const s of [-1, 1]) { L(s * (W / 2 - 0.7), 0.16, WHT, false); L(s * W / 4, 0.14, WHT, true); }
    } else if (cl === 'st') {
      L(0, 0.2, YEL, true); for (const s of [-1, 1]) L(s * (W / 2 - 0.7), 0.15, WHT, false);
    } else L(0, 0.14, WHT, true);
  }
  for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) { roadB.flat(XS[i], 0.06, (ZS[j] + ZS[j + 1]) / 2, RW[i], ZS[j + 1] - ZS[j], WHITE, 8); roadMarks('z', i, j); }
  for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) { roadB.flat((XS[i] + XS[i + 1]) / 2, 0.06, ZS[j], XS[i + 1] - XS[i], RW[j], WHITE, 8); roadMarks('x', j, i); }
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) roadB.flat(XS[i], 0.06, ZS[j], RW[i], RW[j], WHITE, 8);
  // passages piétons, lignes d'arrêt, feux
  for (let i = 1; i < NX; i++) for (let j = 1; j < NZ; j++) {
    const cx = XS[i], cz = ZS[j], hx = RW[i] / 2, hz = RW[j] / 2;
    for (let s = -(hz - 1.4); s <= hz - 1.4; s += 1.7) { markB.flat(cx + hx + 2, 0.09, cz + s, 2.2, 0.8, WHT); markB.flat(cx - hx - 2, 0.09, cz + s, 2.2, 0.8, WHT); }
    for (let s = -(hx - 1.4); s <= hx - 1.4; s += 1.7) { markB.flat(cx + s, 0.09, cz + hz + 2, 0.8, 2.2, WHT); markB.flat(cx + s, 0.09, cz - hz - 2, 0.8, 2.2, WHT); }
    markB.flat(cx + hx + 4.8, 0.09, cz + hz / 2, 0.5, hz - 0.8, WHT); markB.flat(cx - hx - 4.8, 0.09, cz - hz / 2, 0.5, hz - 0.8, WHT);
    markB.flat(cx - hx / 2, 0.09, cz + hz + 4.8, hx - 0.8, 0.5, WHT); markB.flat(cx + hx / 2, 0.09, cz - hz - 4.8, hx - 0.8, 0.5, WHT);
    const qx = hx + 1.3, qz = hz + 1.3;
    addTrafficLight(cx + qx, cz + qz, 1, 0, false); addTrafficLight(cx - qx, cz - qz, -1, 0, false);
    addTrafficLight(cx + qx, cz - qz, 0, -1, true); addTrafficLight(cx - qx, cz + qz, 0, 1, true);
  }

  // ---------- Autoroute : séparateur central, glissières, éclairage, portiques ----------
  const GANTRY_TXT = ['A1 · CENTRE-VILLE', 'SORTIE 2 · ZONE EST', 'A1 · PORT', 'SORTIE 6 · AÉROPORT', 'PÉRIPHÉRIQUE', 'A1 · NORD'];
  function highwayLine(axis, line) {
    const W = RW[line], c = axis === 'z' ? XS[line] : ZS[line];
    const a = axis === 'z' ? ZS[0] + RW[0] / 2 : XS[0] + RW[0] / 2, b = axis === 'z' ? ZS[NZ] - RW[NZ] / 2 : XS[NX] - RW[NX] / 2, len = b - a, mid = (a + b) / 2;
    const bx = (off, y, wd, h, ln, col, p) => { if (axis === 'z') plainB.box(c + off, y, p, wd, h, ln, col); else plainB.box(p, y, c + off, ln, h, wd, col); };
    const pt = (off, p) => (axis === 'z' ? [c + off, p] : [p, c + off]);
    bx(0, 0.5, 1.1, 0.95, len, 0xb5b2aa, mid);
    if (axis === 'z') addRect(c - 0.55, c + 0.55, a, b, 1); else addRect(a, b, c - 0.55, c + 0.55, 1);
    for (const s of [-1, 1]) {
      bx(s * (W / 2 - 0.3), 0.6, 0.14, 0.6, len, 0x9aa0a6, mid);
      for (let t = a + 4; t < b; t += 9) bx(s * (W / 2 - 0.3), 0.5, 0.12, 0.9, 0.12, 0x70757c, t);
    }
    for (let t = a + 22; t < b - 10; t += 44) {
      const p = pt(0, t);
      plainB.cyl(p[0], 0.18, p[1], 0.16, 0.16, 0.1, 0.1, 10, 8, 0x4a4f55); addRect(p[0] - 0.3, p[0] + 0.3, p[1] - 0.3, p[1] + 0.3, 10);
      for (const s of [-1, 1]) {
        const q = pt(s * 2.6, t), e = pt(s * 5, t);
        if (axis === 'z') plainB.box(q[0], 10.1, q[1], 5.2, 0.14, 0.14, 0x4a4f55); else plainB.box(q[0], 10.1, q[1], 0.14, 0.14, 5.2, 0x4a4f55);
        lampB.box(e[0], 10, e[1], axis === 'z' ? 0.8 : 0.4, 0.14, axis === 'z' ? 0.4 : 0.8, 0xfff1c8); glowPts.push([e[0], 9.9, e[1], 0]);
      }
    }
    [0.25, 0.5, 0.75].forEach((f, idx) => {
      const p = a + len * f;
      for (const s of [-1, 1]) { bx(s * (W / 2 - 1.2), 3.8, 0.5, 7.6, 0.5, 0x777c82, p); const q = pt(s * (W / 2 - 1.2), p); addRect(q[0] - 0.3, q[0] + 0.3, q[1] - 0.3, q[1] + 0.3, 7.6); }
      bx(0, 7.7, W - 1, 0.7, 0.6, 0x777c82, p);
      for (const s of [-1, 1]) { const q = pt(s * W / 4, p); addLabel(q[0], 9.6, q[1], GANTRY_TXT[(line * 2 + idx + (s > 0 ? 1 : 0)) % GANTRY_TXT.length], '#1f9d55', 11); }
    });
  }
  highwayLine('z', 0); highwayLine('z', NX); highwayLine('x', 0); highwayLine('x', NZ);
  // barrières aux rues sans accès à l'autoroute
  for (let i = 1; i < NX; i++) if (!RAMPS.includes(i)) for (const z of [ZS[0] + RW[0] / 2 + 0.5, ZS[NZ] - RW[NZ] / 2 - 0.5]) {
    plainB.box(XS[i], 0.5, z, RW[i], 1, 0.8, 0xb5b2aa); plainB.box(XS[i], 1.05, z, RW[i], 0.1, 0.82, 0xff7a1a); addRect(XS[i] - RW[i] / 2, XS[i] + RW[i] / 2, z - 0.4, z + 0.4, 1);
  }
  for (let j = 1; j < NZ; j++) if (!RAMPS.includes(j)) for (const x of [XS[0] + RW[0] / 2 + 0.5, XS[NX] - RW[NX] / 2 - 0.5]) {
    plainB.box(x, 0.5, ZS[j], 0.8, 1, RW[j], 0xb5b2aa); plainB.box(x, 1.05, ZS[j], 0.82, 0.1, RW[j], 0xff7a1a); addRect(x - 0.4, x + 0.4, ZS[j] - RW[j] / 2, ZS[j] + RW[j] / 2, 1);
  }

  // ---------- Terrain, mer, plage, collines ----------
  const groundMap = grassTex(); groundMap.repeat.set((2 * LIM + 60) / 8, (2 * LIM + 60) / 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * LIM + 60, 2 * LIM + 60), new THREE.MeshStandardMaterial({ map: groundMap, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  const seaMat = new THREE.MeshStandardMaterial({ color: lin(0x1d6a96), roughness: 0.15, metalness: 0.3 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.8;
  if (qHigh) ground.receiveShadow = true;
  disposables.push(ground.geometry, ground.material, sea.geometry, seaMat, groundMap); envMats.push(seaMat);
  scene.add(ground); scene.add(sea);
  { const SAND = 0xdcca98, sb = LIM + 30;
    plainB.flat(0, 0.04, -(LIM + 7), 2 * sb, 46, SAND); plainB.flat(0, 0.04, LIM + 7, 2 * sb, 46, SAND);
    plainB.flat(-(LIM + 7), 0.04, 0, 46, 2 * (LIM - 16), SAND); plainB.flat(LIM + 7, 0.04, 0, 46, 2 * (LIM - 16), SAND); }
  const hillB = new Batch();
  for (const lay of [[HALF + 400, 1.0, 0.0], [HALF + 500, 1.5, 2.0]]) {
    const segs = 160, V = [], T = [], r0 = lay[0];
    for (let i = 0; i < segs; i++) {
      const a = i / segs * TAU, hh = Math.max(30, (80 + 42 * Math.sin(3 * a + lay[2]) + 26 * Math.sin(7 * a + 1 + lay[2]) + 14 * Math.sin(13 * a + 2) + 8 * Math.sin(29 * a)) * lay[1]);
      V.push([Math.cos(a) * r0, -10, Math.sin(a) * r0], [Math.cos(a) * (r0 - hh * 0.9), hh, Math.sin(a) * (r0 - hh * 0.9)]);
    }
    for (let i = 0; i < segs; i++) { const j = (i + 1) % segs; T.push([i * 2, j * 2, j * 2 + 1], [i * 2, j * 2 + 1, i * 2 + 1]); }
    hillB.emit(V, T, 0x3d5a3c, c => [-c[0], 30, -c[2]], v => (v[1] > 60 ? hex2rgb(0x587a52) : hex2rgb(0x34502f)));
  }
  const hillMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  disposables.push(hillMat);
  scene.add(hillB.mesh(hillMat, false, false));
  for (const k in facade) scene.add(facade[k].b.mesh(facade[k].mat, true, true));
  scene.add(shopB.mesh(shopMat, true, true)); scene.add(plainB.mesh(plainMat, true, true));
  scene.add(walkB.mesh(walkMat, false, true)); scene.add(roadB.mesh(roadMat, false, true));
  scene.add(markB.mesh(markMat, false, true)); scene.add(grassB.mesh(grassMat, false, true));
  scene.add(lampB.mesh(lampMat, false, false)); scene.add(leafB.mesh(leafMat, true, false));
  const glowArr = []; for (const p of glowPts) glowArr.push(p[0], p[1], p[2]);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowArr, 3));
  const glowMat = new THREE.PointsMaterial({ map: glowTex(), size: 4.5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: lin(0xffd9a0), opacity: 0 });
  scene.add(new THREE.Points(glowGeo, glowMat));
  disposables.push(glowGeo, glowMat);

  // ---------- Collisions statiques ----------
  function pushCircle(x, z, r) {
    let ox = 0, oz = 0, hit = false;
    for (const q of rectsAt(x, z)) {
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
  function groundY(x, z) { return blockAt(x, z) ? 0.18 : 0; }
  function camBlocked(x, y, z) {
    for (const q of rectsAt(x, z)) if (q.h > 3.5 && y < q.h + 0.3 && x > q.x0 - 0.5 && x < q.x1 + 0.5 && z > q.z0 - 0.5 && z < q.z1 + 0.5) return true;
    return false;
  }

  // ---------- Détail 3D des fenêtres près du joueur ----------
  function wallTexture(style) {
    const c = mkCanvas(256, 256), g = c.getContext('2d');
    if (style === 'brick') {
      g.fillStyle = '#b4a592'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 12) { const off = ((y / 12) % 2) ? 16 : 0; for (let x = -32; x < 256; x += 32) { const v = Math.random(); g.fillStyle = 'rgb(' + (140 + v * 50 | 0) + ',' + (68 + v * 30 | 0) + ',' + (48 + v * 22 | 0) + ')'; g.fillRect(x + off + 1, y + 1, 30, 10); } }
    } else if (style === 'concrete') {
      g.fillStyle = '#b3b6ba'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.03 + Math.random() * 0.05) + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 8, 2 + Math.random() * 4); }
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 0, 2, 256); g.fillRect(128, 0, 2, 256);
    } else {
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '90,70,50') + ',' + (0.03 + Math.random() * 0.05) + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4); }
    }
    return tex(c, true);
  }
  const wallMats = {};
  for (const k of ['brick', 'concrete', 'stucco']) {
    const m = wallTexture(k);
    wallMats[k] = new THREE.MeshStandardMaterial({ map: m, bumpMap: m, bumpScale: k === 'brick' ? 1.4 : 0.5, vertexColors: true, roughness: 0.9 });
    disposables.push(m, wallMats[k]); envMats.push(wallMats[k]);
  }
  const winGlassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.4, depthWrite: false });
  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: new THREE.Color(1, 0.8, 0.5), emissiveIntensity: 0 });
  disposables.push(winGlassMat, litMat); envMats.push(winGlassMat);
  const CURT = [0x201c18, 0x3a2f28, 0xcfc4a8, 0x5a6e86, 0x8a3b3b, 0xe8e4da, 0x2a3a2e].map(hex2rgb);
  function Qd(B, a, b2, c, d, n, col, uv) {
    const ux = b2[0] - a[0], uy = b2[1] - a[1], uz = b2[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) B.quad([a, b2, c, d], n, col, uv || ZUV);
    else B.quad([d, c, b2, a], n, col, uv ? [uv[3], uv[2], uv[1], uv[0]] : ZUV);
  }
  function buildDetail(b) {
    const Wb = new Batch(), Fb = new Batch(), Ib = new Batch(), Lb = new Batch(), Gb = new Batch();
    const wallC = hex2rgb(b.tint), stone = hex2rgb(0xcfc9bd), frameC = hex2rgb([0xf1eee6, 0x2e3238, 0xe4dccb][b.seed % 3]), glassC = hex2rgb(0x2a4258), litC = hex2rgb(0xffd98a), doorC = hex2rgb(0x4a2f20);
    const nf = Math.floor(b.h / 4), top = b.y0 + b.h;
    const faces = [{ o: [b.x0, b.z1], t: [1, 0], n: [0, 1], L: b.x1 - b.x0, key: '+z' }, { o: [b.x1, b.z0], t: [-1, 0], n: [0, -1], L: b.x1 - b.x0, key: '-z' },
      { o: [b.x1, b.z1], t: [0, -1], n: [1, 0], L: b.z1 - b.z0, key: '+x' }, { o: [b.x0, b.z0], t: [0, 1], n: [-1, 0], L: b.z1 - b.z0, key: '-x' }];
    for (const fc of faces) {
      const L = fc.L; if (L < 5) continue;
      const O = fc.o, T = fc.t, Nn = fc.n, nrm = [Nn[0], 0, Nn[1]], nL = [-T[0], 0, -T[1]], nR = [T[0], 0, T[1]];
      const P = (u, v, w) => [O[0] + T[0] * u + Nn[0] * w, v, O[1] + T[1] * u + Nn[1] * w];
      const wbox = (B, u0, u1, v0, v1, w0, w1, col, m, tile) => {
        const mk = m || [1, 1, 1, 1, 1], t8 = tile ? 1 / 8 : 0;
        const uvO = t8 ? [[u0 * t8, v0 * t8], [u1 * t8, v0 * t8], [u1 * t8, v1 * t8], [u0 * t8, v1 * t8]] : null;
        const uvS = t8 ? [[w0 * t8, v0 * t8], [w1 * t8, v0 * t8], [w1 * t8, v1 * t8], [w0 * t8, v1 * t8]] : null;
        const uvT = t8 ? [[u0 * t8, w0 * t8], [u1 * t8, w0 * t8], [u1 * t8, w1 * t8], [u0 * t8, w1 * t8]] : null;
        if (mk[0]) Qd(B, P(u0, v0, w1), P(u1, v0, w1), P(u1, v1, w1), P(u0, v1, w1), nrm, col, uvO);
        if (mk[1]) Qd(B, P(u0, v0, w0), P(u0, v0, w1), P(u0, v1, w1), P(u0, v1, w0), nL, col, uvS);
        if (mk[2]) Qd(B, P(u1, v0, w1), P(u1, v0, w0), P(u1, v1, w0), P(u1, v1, w1), nR, col, uvS);
        if (mk[3]) Qd(B, P(u0, v1, w1), P(u1, v1, w1), P(u1, v1, w0), P(u0, v1, w0), [0, 1, 0], col, uvT);
        if (mk[4]) Qd(B, P(u0, v0, w0), P(u1, v0, w0), P(u1, v0, w1), P(u0, v0, w1), [0, -1, 0], col, uvT);
      };
      const nb = Math.max(0, Math.floor((L - 3.6) / 4) + 1), uc = k => 2 + 4 * k;
      const k0 = Math.floor(nb / 2), isFront = b.front === fc.key;
      for (let f = 0; f < nf; f++) {
        const v0 = b.y0 + 4 * f, vs = v0 + 0.875, vt = vs + 2.06;
        wbox(Wb, 0, L, v0, vs, -0.34, 0, wallC, [1, 1, 1, 1, 0], true);
        wbox(Wb, 0, L, vt, v0 + 4, -0.34, 0, wallC, [1, 1, 1, 0, 1], true);
        for (let k = 0; k <= nb; k++) {
          const ua = k === 0 ? 0 : uc(k - 1) + 1, ub = k === nb ? L : uc(k) - 1;
          if (ub - ua > 0.05) wbox(Wb, ua, ub, vs, vt, -0.34, 0, wallC, [1, k > 0 ? 1 : 0, k < nb ? 1 : 0, 0, 0], true);
        }
        for (let k = 0; k < nb; k++) {
          const u = uc(k), u0 = u - 1, u1 = u + 1;
          if (isFront && f === 0 && k === k0) {
            wbox(Wb, u0, u1, vs, vt, -0.34, -0.1, wallC, [1, 0, 0, 0, 0], true);
            wbox(Fb, u - 0.55, u + 0.55, b.y0, b.y0 + 2.15, 0, 0.07, doorC);
            wbox(Fb, u - 0.66, u - 0.55, b.y0, b.y0 + 2.26, 0, 0.1, frameC); wbox(Fb, u + 0.55, u + 0.66, b.y0, b.y0 + 2.26, 0, 0.1, frameC); wbox(Fb, u - 0.66, u + 0.66, b.y0 + 2.15, b.y0 + 2.26, 0, 0.1, frameC);
            wbox(Fb, u - 1.5, u + 1.5, b.y0 - 0.15, b.y0 + 0.06, 0.07, 1.5, stone); wbox(Fb, u - 1.3, u + 1.3, b.y0 - 0.3, b.y0 - 0.15, 0.5, 1.9, stone);
            wbox(Fb, u - 1.5, u + 1.5, b.y0 + 2.5, b.y0 + 2.64, 0, 1.6, hex2rgb(0x4b4f58));
            continue;
          }
          const lit = ((f * 31 + k * 17 + f * k * 7 + b.seed) % 7) < 2;
          Qd(Gb, P(u0, vs, -0.18), P(u1, vs, -0.18), P(u1, vt, -0.18), P(u0, vt, -0.18), nrm, glassC);
          if (lit) Qd(Lb, P(u0, vs, -0.3), P(u1, vs, -0.3), P(u1, vt, -0.3), P(u0, vt, -0.3), nrm, litC);
          else {
            const cc = CURT[(f * 5 + k * 3 + b.seed) % CURT.length];
            Qd(Ib, P(u0, vs, -0.3), P(u1, vs, -0.3), P(u1, vt, -0.3), P(u0, vt, -0.3), nrm, cc);
            if ((f + k + b.seed) % 3 === 0) Qd(Ib, P(u0, vs + 1.2, -0.28), P(u1, vs + 1.2, -0.28), P(u1, vt, -0.28), P(u0, vt, -0.28), nrm, CURT[5]);
          }
          const fw = 0.07;
          Qd(Fb, P(u0, vs, -0.12), P(u0 + fw, vs, -0.12), P(u0 + fw, vt, -0.12), P(u0, vt, -0.12), nrm, frameC);
          Qd(Fb, P(u1 - fw, vs, -0.12), P(u1, vs, -0.12), P(u1, vt, -0.12), P(u1 - fw, vt, -0.12), nrm, frameC);
          Qd(Fb, P(u0, vs, -0.12), P(u1, vs, -0.12), P(u1, vs + fw, -0.12), P(u0, vs + fw, -0.12), nrm, frameC);
          Qd(Fb, P(u0, vt - fw, -0.12), P(u1, vt - fw, -0.12), P(u1, vt, -0.12), P(u0, vt, -0.12), nrm, frameC);
          Qd(Fb, P(u - 0.03, vs, -0.12), P(u + 0.03, vs, -0.12), P(u + 0.03, vt, -0.12), P(u - 0.03, vt, -0.12), nrm, frameC);
          wbox(Fb, u0 - 0.1, u1 + 0.1, vs - 0.07, vs + 0.03, -0.1, 0.14, stone);
        }
      }
      const rem = top - (b.y0 + 4 * nf);
      if (rem > 0.3) wbox(Wb, 0, L, b.y0 + 4 * nf, top, -0.34, 0, wallC, [1, 1, 1, 1, 0], true);
    }
    const out = [];
    const add = (B, mat) => { if (!B.i.length) return; const m = new THREE.Mesh(B.geo(), mat); if (qHigh) m.receiveShadow = true; scene.add(m); out.push(m); };
    add(Wb, wallMats[b.style] || wallMats.stucco); add(Fb, plainMat); add(Ib, plainMat); add(Lb, litMat); add(Gb, winGlassMat);
    return out;
  }
  let detailCount = 0;
  const DR_BUILD = 80, DR_DROP = 115, DMAX = 30;
  const rectDist = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
  function dropDetail(b) {
    if (!b.det) return;
    for (const m of b.det) { scene.remove(m); if (m.geometry) m.geometry.dispose(); }
    b.det = null; detailCount--;
  }
  function updateDetail() {
    let best = null, bd = DR_BUILD, far = null, fd = 0;
    for (const b of BLD) {
      const d = rectDist(b, P.x, P.z);
      if (b.det) { if (d > DR_DROP) dropDetail(b); else if (d > fd) { fd = d; far = b; } }
      else if (d < bd) { bd = d; best = b; }
    }
    if (best) {
      if (detailCount >= DMAX) { if (far && fd > bd + 8) dropDetail(far); else return; }
      best.det = buildDetail(best); detailCount++;
    }
  }
  function disposeDetail() { for (const b of BLD) dropDetail(b); }

  // ---------- Matériaux / géométries partagés ----------
  const matCache = {}, bmatCache = {};
  const mat = h => { if (!matCache[h]) { matCache[h] = new THREE.MeshStandardMaterial({ color: lin(h), roughness: 0.8, metalness: 0.05 }); disposables.push(matCache[h]); } return matCache[h]; };
  const bmat = h => { if (!bmatCache[h]) { bmatCache[h] = new THREE.MeshBasicMaterial({ color: lin(h) }); disposables.push(bmatCache[h]); } return bmatCache[h]; };
  const wreckMat = new THREE.MeshStandardMaterial({ color: lin(0x1b1b1b), roughness: 0.95, metalness: 0.1 });
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.4, depthWrite: false });
  const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const humanMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, skinning: true });
  const CAR_MATS = [paintMat, glassMat, trimMat, lightMat];
  disposables.push(wreckMat, paintMat, glassMat, trimMat, lightMat, humanMat);
  envMats.push(paintMat, glassMat, trimMat);
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const barGeo = new THREE.BoxGeometry(0.5, 0.16, 0.3);
  const gunGeo = new THREE.BoxGeometry(0.07, 0.1, 0.32), phoneGeo = new THREE.BoxGeometry(0.05, 0.1, 0.012);
  disposables.push(shadowGeo, shadowMat, barGeo, gunGeo);
  function makeShadow(w, l) { const s = new THREE.Mesh(shadowGeo, shadowMat); s.rotation.x = -Math.PI / 2; s.scale.set(w, l, 1); s.position.y = 0.22; return s; }

  // ---------- Voitures (carrosserie lissée par sections) ----------
  const STYLES = {
    sedan: { L: 4.6, W: 1.85, y0: 0.3, hood: 0.86, belt: 1.0, deck: 0.98, roof: 1.46, cabF: 0.65, cabR: -1.4, runF: 0.85, runR: 0.6, wr: 0.34, vmax: 34, acc: 15, cols: [0xb8231b, 0x1f4f9a, 0x1f7a4a, 0xc8ccd0, 0x1a1a1c, 0x6e2c8e, 0xd97a12, 0x8a8f96] },
    sport: { L: 4.4, W: 1.95, y0: 0.25, hood: 0.68, belt: 0.82, deck: 0.8, roof: 1.2, cabF: 0.35, cabR: -1.15, runF: 0.7, runR: 0.6, wr: 0.33, vmax: 47, acc: 24, cols: [0xe0261b, 0xf2c200, 0x0a6fe0, 0x111113, 0xff7a00, 0xe8e8e8] },
    suv: { L: 4.8, W: 2.0, y0: 0.4, hood: 1.08, belt: 1.22, deck: 1.22, roof: 1.86, cabF: 0.9, cabR: -1.6, runF: 0.75, runR: 0.25, wr: 0.42, vmax: 30, acc: 13, cols: [0x30353d, 0x5b3d26, 0xd0d0d0, 0x1a3a28, 0x7a1f1f] },
    van: { L: 5.3, W: 2.05, y0: 0.4, hood: 0.98, belt: 1.38, deck: 1.38, roof: 2.25, cabF: 1.55, cabR: 0.25, runF: 0.5, runR: 0.15, wr: 0.4, vmax: 26, acc: 10, cargo: true, cols: [0xf0f0f0, 0x3b6ea8, 0xa83232] },
    taxi: { L: 4.6, W: 1.85, y0: 0.3, hood: 0.86, belt: 1.0, deck: 0.98, roof: 1.46, cabF: 0.65, cabR: -1.4, runF: 0.85, runR: 0.6, wr: 0.34, vmax: 31, acc: 15, cols: [0xf2b800] },
    police: { L: 4.6, W: 1.95, y0: 0.3, hood: 0.86, belt: 1.0, deck: 0.98, roof: 1.46, cabF: 0.65, cabR: -1.4, runF: 0.85, runR: 0.6, wr: 0.35, vmax: 36, acc: 19, cols: [0xf2f2f2] }
  };
  const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'suv', 'van', 'taxi', 'sport'];
  function carStations(st) {
    const L = st.L, y0 = st.y0, cf = st.cabF, cr = Math.max(st.cabR, -L / 2 + 0.8);
    const hoodEnd = Math.min(cf + 0.6, L / 2 - 0.5);
    return [
      { z: L / 2, top: st.hood - 0.22, wf: 0.74, yb: y0 + 0.16 }, { z: L / 2 - 0.07, top: st.hood - 0.1, wf: 0.93, yb: y0 + 0.06 },
      { z: L / 2 - 0.4, top: st.hood - 0.02, wf: 1, yb: y0 }, { z: hoodEnd, top: st.hood, wf: 1, yb: y0 },
      { z: cf, top: st.belt, wf: 1, yb: y0 }, { z: cr, top: st.belt, wf: 1, yb: y0 },
      { z: cr - 0.35, top: st.deck, wf: 1, yb: y0 }, { z: -L / 2 + 0.4, top: st.deck - 0.02, wf: 1, yb: y0 },
      { z: -L / 2 + 0.07, top: st.deck - 0.1, wf: 0.93, yb: y0 + 0.06 }, { z: -L / 2, top: st.deck - 0.24, wf: 0.76, yb: y0 + 0.16 }
    ];
  }
  function carRing(hw, s) {
    const w = hw * s.wf, yb = s.yb, yt = s.top, h = yt - yb;
    const half = [[0, yb], [w * 0.82, yb], [w, yb + h * 0.2], [w, yb + h * 0.62], [w * 0.96, yb + h * 0.88], [w * 0.72, yt], [0, yt]];
    const pts = half.slice();
    for (let i = half.length - 2; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
    return pts;
  }
  function combine(batches) {
    const g = new THREE.BufferGeometry(), p = [], n = [], c = [], u = [], idx = [], groups = [];
    let vo = 0;
    batches.forEach((b, mi) => {
      const start = idx.length;
      for (let i = 0; i < b.i.length; i++) idx.push(b.i[i] + vo);
      for (let i = 0; i < b.p.length; i++) { p.push(b.p[i]); n.push(b.n[i]); c.push(b.c[i]); }
      for (let i = 0; i < b.u.length; i++) u.push(b.u[i]);
      if (b.i.length) groups.push([start, b.i.length, mi]);
      vo += b.p.length / 3;
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setIndex(idx);
    for (const gr of groups) g.addGroup(gr[0], gr[1], gr[2]);
    disposables.push(g);
    return g;
  }
  function shade(c, k) { return [clamp(c[0] * k, 0, 1), clamp(c[1] * k, 0, 1), clamp(c[2] * k, 0, 1)]; }
  function buildCar(st, color, kind) {
    const PB = new Batch(), GB = new Batch(), TB = new Batch(), LB = new Batch();
    const L = st.L, hw = st.W / 2, y0 = st.y0, paint = hex2rgb(color), dark = hex2rgb(0x0d0d0f), glass = hex2rgb(0x1a2d40), intr = hex2rgb(0x1f2023);
    const cf = st.cabF, cr = Math.max(st.cabR, -L / 2 + 0.8);
    // carrosserie basse
    const S = carStations(st), V = [], T = [];
    for (const s of S) for (const p of carRing(hw, s)) V.push([p[0], p[1], s.z]);
    const NR = 12, ymid = y0 + 0.35;
    for (let k = 0; k < S.length - 1; k++) for (let i = 0; i < NR; i++) {
      const a = k * NR + i, b = k * NR + (i + 1) % NR, c = (k + 1) * NR + i, d = (k + 1) * NR + (i + 1) % NR;
      T.push([a, b, d], [a, d, c]);
    }
    const stMid = z => { let best = S[0], bd = 1e9; for (const q of S) { const d = Math.abs(q.z - z); if (d < bd) { bd = d; best = q; } } return (best.yb + best.top) / 2; };
    PB.emit(V, T, paint, c => [c[0], c[1] - stMid(c[2]), 0], v => (v[1] < y0 + 0.03 ? dark : (v[1] > st.belt - 0.02 && v[2] <= cf + 0.001 && v[2] >= cr - 0.001 ? intr : paint)));
    for (const end of [0, S.length - 1]) {
      const ring = carRing(hw, S[end]), z = S[end].z, W = [[0, (S[end].yb + S[end].top) / 2, z]], U = [];
      for (const p of ring) W.push([p[0], p[1], z]);
      for (let i = 0; i < NR; i++) U.push([0, 1 + i, 1 + (i + 1) % NR]);
      PB.emit(W, U, paint, () => [0, 0, end === 0 ? 1 : -1], v => (v[1] < y0 + 0.2 ? dark : paint));
    }
    // habitacle (verre) + toit (peinture)
    let c1 = cf - st.runF, c2 = cr + st.runR;
    if (c1 - c2 < 0.3) { const m = (c1 + c2) / 2; c1 = m + 0.15; c2 = m - 0.15; }
    const CS = [{ z: cf - 0.05, top: st.belt + 0.01, wt: hw * 0.86 }, { z: c1, top: st.roof, wt: hw * 0.7 }, { z: c2, top: st.roof, wt: hw * 0.7 }, { z: cr + 0.05, top: st.belt + 0.01, wt: hw * 0.84 }];
    const wb = hw * 0.92, CV = [];
    for (const s of CS) CV.push([-wb, st.belt, s.z], [-s.wt, s.top, s.z], [s.wt, s.top, s.z], [wb, st.belt, s.z]);
    const CD = [[-1, 0, 0], [0, 1, 0], [1, 0, 0]];
    for (let i = 0; i < 3; i++) {
      const Tg = [], Tp = [];
      for (let k = 0; k < 3; k++) {
        const a = k * 4 + i, b = k * 4 + i + 1, c = (k + 1) * 4 + i, d = (k + 1) * 4 + i + 1;
        ((k === 1 && i === 1) ? Tp : Tg).push([a, b, d], [a, d, c]);
      }
      if (Tg.length) GB.emit(CV, Tg, glass, () => CD[i]);
      if (Tp.length) PB.emit(CV, Tp, paint, () => CD[i]);
    }
    for (const sx of [-1, 1]) TB.box(sx * hw * 0.8, (st.belt + st.roof) / 2, (c1 + c2) / 2 - 0.1, 0.05, st.roof - st.belt, 0.08, dark);
    if (st.cargo) PB.box(0, (st.belt + st.roof) / 2, (cr - L / 2 + 0.1) / 2 + 0.02, st.W * 0.97, st.roof - st.belt, cr + L / 2 - 0.1, paint);
    // roues
    const wrr = st.wr;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) TB.wheel(sx * (hw - 0.12), wrr, sz * L * 0.31, wrr, 0.13, 14, hex2rgb(0x131315), hex2rgb(0xaab0b8));
    // feux, calandre, pare-chocs, plaques, rétros, joints de portes
    for (const sx of [-1, 1]) {
      LB.box(sx * hw * 0.66, st.hood - 0.3, L / 2 - 0.01, 0.4, 0.14, 0.08, 0xfff6e0);
      LB.box(sx * hw * 0.7, st.deck - 0.3, -L / 2 + 0.01, 0.42, 0.12, 0.08, 0xff2a2a);
      TB.box(sx * (hw + 0.1), st.belt + 0.1, cf - 0.1, 0.14, 0.1, 0.2, dark);
    }
    TB.box(0, y0 + 0.22, L / 2 - 0.02, st.W * 0.94, 0.18, 0.12, dark);
    TB.box(0, y0 + 0.22, -L / 2 + 0.02, st.W * 0.94, 0.18, 0.12, dark);
    TB.box(0, st.hood - 0.34, L / 2 + 0.005, hw * 0.7, 0.12, 0.06, 0x16171a);
    TB.box(0, y0 + 0.42, L / 2 + 0.03, 0.5, 0.12, 0.03, 0xe8e8e0);
    TB.box(0, y0 + 0.42, -L / 2 - 0.03, 0.5, 0.12, 0.03, 0xe8e8e0);
    const wallLo = y0 + (st.belt - y0) * 0.2, wallH = (st.belt - y0) * 0.42;
    for (const sx of [-1, 1]) for (const zz of [cf - 0.2, (cf + cr) / 2, cr + 0.2]) TB.box(sx * (hw + 0.002), wallLo + wallH / 2, zz, 0.012, wallH, 0.014, dark);
    // intérieur visible à travers les vitres
    const seatC = hex2rgb(0x2a2a2e), seatX = st.W * 0.21, seatZ = cf - 0.95, hrH = Math.min(0.44, st.roof - st.belt - 0.03);
    for (const sx of [-1, 1]) { TB.box(sx * seatX, st.belt + 0.1, seatZ - 0.28, 0.5, 0.26, 0.12, seatC); TB.box(sx * seatX, st.belt + hrH - 0.1, seatZ - 0.28, 0.24, 0.2, 0.1, seatC); }
    if (!st.cargo && cr < seatZ - 0.9) TB.box(0, st.belt + 0.1, cr + 0.4, st.W * 0.8, 0.22, 0.12, seatC);
    TB.box(0, st.belt + 0.07, cf - 0.3, st.W * 0.8, 0.14, 0.5, 0x232326);
    const wz = cf - 0.62, wy = st.belt + 0.27, WV = [[seatX, wy, wz]], WU = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; WV.push([seatX + Math.cos(a) * 0.17, wy + Math.sin(a) * 0.17, wz]); }
    for (let i = 0; i < 12; i++) WU.push([0, 1 + i, 1 + (i + 1) % 12]);
    TB.emit(WV, WU, 0x151518, () => [0, 0, -1]);
    if (kind === 'police') {
      for (const sx of [-1, 1]) TB.box(sx * (hw + 0.004), y0 + (st.belt - y0) * 0.4, (cf + cr) / 2, 0.01, 0.24, L * 0.45, 0x14171c);
      TB.box(0, st.roof + 0.06, (c1 + c2) / 2, 1.0, 0.06, 0.34, dark);
    }
    if (kind === 'taxi') LB.box(0, st.roof + 0.15, (c1 + c2) / 2, 0.6, 0.18, 0.28, 0xfff0a0);
    const g = new THREE.Group();
    const m = new THREE.Mesh(combine([PB, GB, TB, LB]), CAR_MATS);
    if (qHigh) m.castShadow = true;
    g.add(makeShadow(st.W * 1.15, L * 1.05));
    g.add(m);
    let bars = null;
    if (kind === 'police') {
      const mr = new THREE.MeshBasicMaterial({ color: lin(0xff2222) }), mb = new THREE.MeshBasicMaterial({ color: lin(0x2266ff) });
      disposables.push(mr, mb);
      const yb = st.roof + 0.17, zc = (c1 + c2) / 2;
      const a = new THREE.Mesh(barGeo, mr), b = new THREE.Mesh(barGeo, mb);
      a.scale.set(0.9, 1, 1); b.scale.set(0.9, 1, 1);
      a.position.set(-0.24, yb, zc); b.position.set(0.24, yb, zc);
      g.add(a); g.add(b);
      bars = { a, b, mr, mb };
    }
    return { g, m, bars, paint };
  }

  const cars = [];
  let carId = 0;
  function makeCar(styleKey, x, z, ang, kind) {
    const st = STYLES[styleKey];
    const b = buildCar(st, pick(st.cols), styleKey);
    b.g.rotation.order = 'YXZ'; b.g.position.set(x, 0, z); b.g.rotation.y = ang;
    scene.add(b.g);
    const c = { paint: b.paint, driver: null, door: null, steerVis: 0, id: ++carId, sk: styleKey, st, g: b.g, mesh: b.m, bars: b.bars, x, z, ang, speed: 0, hp: styleKey === 'van' ? 130 : 100, kind, ai: null, stuck: 0, cruise: R(9, 14), copSpeed: 26, direct: false, noDirect: 0, revT: 0, wreckT: 0, hitCd: 0, lastBlink: 0, deploy: 0, smokeT: 0, pitch: 0, roll: 0, lastSpeed: 0, lastAng: ang };
    cars.push(c);
    if (kind === 'traffic' || kind === 'cop') attachDriver(c);
    return c;
  }
  const seatOf = c => ({ x: c.st.W * 0.21, z: c.st.cabF - 0.95, y: Math.max(c.st.y0 + 0.12, c.st.roof - 0.9) });
  function attachDriver(c) {
    const cop = c.kind === 'cop' || c.sk === 'police', h = buildHuman(cop ? COP_OUTFIT : randomOutfit(), false), seat = seatOf(c);
    h.g.position.set(seat.x, 0, seat.z); h.g.scale.set(0.95, 0.95, 0.95);
    animateHuman(h, { mode: 'drive', hipY: seat.y }, 1);
    h.mesh.castShadow = false; c.g.add(h.g); c.driver = h;
  }
  function ensureDoor(c) {
    if (c.door) return c.door;
    const st = c.st, hw = st.W / 2, seat = seatOf(c), hz = seat.z + 0.75, len = 1.15;
    const PBd = new Batch(), GBd = new Batch(), yb = st.y0 + 0.2, yt = st.belt - 0.02;
    PBd.box(0.03, (yb + yt) / 2, -len / 2, 0.06, yt - yb, len, c.paint);
    facePoly(GBd, [[-hw * 0.07, st.belt, -0.05], [-hw * 0.07, st.belt, -len + 0.1], [-hw * 0.28, st.roof - 0.06, -len + 0.3], [-hw * 0.28, st.roof - 0.06, -0.15]], [1, 0.3, 0], hex2rgb(0x1a2d40));
    facePoly(GBd, [[-hw * 0.28, st.roof - 0.06, -0.15], [-hw * 0.28, st.roof - 0.06, -len + 0.3], [-hw * 0.07, st.belt, -len + 0.1], [-hw * 0.07, st.belt, -0.05]], [-1, -0.3, 0], hex2rgb(0x1a2d40));
    const g = new THREE.Group(); g.position.set(hw, 0, hz);
    g.add(new THREE.Mesh(PBd.geo(), paintMat)); g.add(new THREE.Mesh(GBd.geo(), glassMat));
    g.visible = false; c.g.add(g); c.door = { g, open: 0 };
    return c.door;
  }
  function setDoor(c, open) { if (!c.door) return; c.door.open = open; c.door.g.rotation.y = -open * 1.15; c.door.g.visible = open > 0.001; }
  function carCircles(c) {
    const off = c.st.L / 2 - c.st.W / 2 - 0.1, s = Math.sin(c.ang), co = Math.cos(c.ang), r = c.st.W / 2 + 0.12;
    return [{ x: c.x + s * off, z: c.z + co * off, r }, { x: c.x - s * off, z: c.z - co * off, r }];
  }
  function removeCar(c) {
    scene.remove(c.g);
    const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1);
  }

  // ---------- Humains : modèle anatomique détaillé sur squelette ----------
  const peds = [];
  const SHIRTS = [0xd94a3c, 0x3f7fc4, 0x3aa86a, 0xe8c23a, 0x8e5bb0, 0xe8ecef, 0xe0802a, 0x1f9a88, 0xf08ab8, 0x2b2f38, 0x6b7a8f, 0xb8c4d0];
  const PANTS = [0x3a5a8a, 0x2b3f63, 0x1f2a3d, 0x1b1b1b, 0x6b5a3a, 0x4a4a4a, 0x56667a];
  const SKINS = [0xf1c6a0, 0xd9a577, 0xa87048, 0x6e4a31, 0xffdbb4, 0xc68b5e];
  const HAIRS = [0x16110d, 0x3a2a1e, 0x6a4a2a, 0xb08a4a, 0x8a8a8a, 0x2a1810, 0x7a3a1a];
  const BN = ['hips', 'spine', 'chest', 'neck', 'head', 'uL', 'fL', 'hL', 'uR', 'fR', 'hR', 'tL', 'sL', 'ftL', 'tR', 'sR', 'ftR'];
  const BI = {}; BN.forEach((n, i) => { BI[n] = i; });
  const RJ = [[0, 0.95, 0, -1], [0, 1.06, 0, 0], [0, 1.24, 0, 1], [0, 1.5, 0, 2], [0, 1.58, 0, 3],
    [0.2, 1.45, 0, 2], [0.2, 1.15, 0, 5], [0.2, 0.9, 0, 6], [-0.2, 1.45, 0, 2], [-0.2, 1.15, 0, 8], [-0.2, 0.9, 0, 9],
    [0.09, 0.93, 0, 0], [0.09, 0.5, 0, 11], [0.09, 0.08, 0, 12], [-0.09, 0.93, 0, 0], [-0.09, 0.5, 0, 14], [-0.09, 0.08, 0, 15]];
  const humanCache = {};
  const Wt = (a, b, w) => [BI[a], BI[b], w];
  const rgbs = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mulc = (a, k) => [clamp(a[0] * k, 0, 255) | 0, clamp(a[1] * k, 0, 255) | 0, clamp(a[2] * k, 0, 255) | 0];
  const mixc = (a, b, t) => [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0];
  const css = (a, al) => 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + (al === undefined ? 1 : al) + ')';

  // --- paramètres de la tête (ellipsoïde + traits du visage) ---
  const HCY = 1.685, HCZ = 0.005, HRX = 0.082, HRY = 0.115, HRZ = 0.098, HN = 32, HM = 26;
  const FEAT = [[0, 0.005, 0.011, 0.034, 0.011], [0, -0.03, 0.014, 0.013, 0.017], [0.017, -0.034, 0.008, 0.008, 0.007], [-0.017, -0.034, 0.008, 0.008, 0.007],
    [0.03, 0.042, 0.026, 0.01, 0.007], [-0.03, 0.042, 0.026, 0.01, 0.007], [0, 0.042, 0.02, 0.01, 0.006],
    [0.034, 0.012, 0.017, 0.012, -0.007], [-0.034, 0.012, 0.017, 0.012, -0.007], [0.054, -0.02, 0.022, 0.02, 0.005], [-0.054, -0.02, 0.022, 0.02, 0.005],
    [0, -0.05, 0.022, 0.006, 0.009], [0, -0.062, 0.02, 0.007, 0.007], [0, -0.1, 0.022, 0.016, 0.012]];
  function headPoint(a, vv) {
    const y = Math.cos(vv) * HRY, r = Math.sin(vv);
    let x = HRX * r * Math.cos(a), z = HRZ * r * Math.sin(a);
    const t = clamp((-y - 0.04) / 0.08, 0, 1); x *= 1 - 0.26 * t * t; z *= 1 - 0.1 * t * t;
    let yy = y; if (y > 0.06) z -= (y - 0.06) * 0.32;
    return [x, yy, z];
  }
  function headVertex(a, vv) {
    let p = headPoint(a, vv);
    if (p[2] > 0) {
      const nx = p[0] / (HRX * HRX), ny = p[1] / (HRY * HRY), nz = p[2] / (HRZ * HRZ), nl = Math.hypot(nx, ny, nz) || 1;
      let d = 0;
      for (const f of FEAT) { const dx = (p[0] - f[0]) / f[2], dy = (p[1] - f[1]) / f[3]; d += f[4] * Math.exp(-(dx * dx + dy * dy)); }
      p = [p[0] + nx / nl * d, p[1] + ny / nl * d, p[2] + nz / nl * d];
    }
    return [p[0], p[1] + HCY, p[2] + HCZ];
  }

  // --- textures ---
  function fabricTex() {
    const c = mkCanvas(256, 256), g = c.getContext('2d');
    g.fillStyle = 'rgb(190,190,190)'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) for (let x = 0; x < 256; x += 2) { const v = 184 + (((x + y) / 2) % 2 ? 9 : -5) + Math.random() * 7 | 0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, y, 2, 2); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.03) + ')'; g.fillRect(Math.random() * 256, 0, 1, 256); }
    return tex(c, true);
  }
  function denimTex() {
    const c = mkCanvas(256, 256), g = c.getContext('2d');
    g.fillStyle = 'rgb(176,180,190)'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x += 2) { const v = 172 + Math.sin((x + y) * 0.75) * 12 + Math.random() * 12 | 0; g.fillStyle = 'rgb(' + v + ',' + (v + 3) + ',' + (v + 9) + ')'; g.fillRect(x, y, 2, 1); }
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(235,240,250,' + (0.06 + Math.random() * 0.08) + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 3 + Math.random() * 5); }
    return tex(c, true);
  }
  function hairTex() {
    const c = mkCanvas(256, 256), g = c.getContext('2d');
    g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const v = 95 + Math.random() * 150 | 0, x = Math.random() * 256; g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',.55)'; g.fillRect(x, Math.random() * 256, 1 + (Math.random() < 0.3 ? 1 : 0), 20 + Math.random() * 90); }
    return tex(c, true);
  }
  function faceTex(skinHex, hairHex, female, beard) {
    const S = 512, K = S / 256, FH = S * 240 / 256, c = mkCanvas(S, S), g = c.getContext('2d'), sk = rgbs(skinHex), hc = rgbs(hairHex);
    g.fillStyle = css(sk); g.fillRect(0, 0, S, S);
    const gr = g.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, css(mulc(sk, 1.05))); gr.addColorStop(0.5, css(sk)); gr.addColorStop(1, css(mulc(sk, 0.84)));
    g.fillStyle = gr; g.fillRect(0, 0, S, FH); g.fillStyle = css(sk); g.fillRect(0, FH, S, S - FH);
    for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,235,220' : '120,70,50') + ',' + (0.025 + Math.random() * 0.04) + ')'; g.fillRect(Math.random() * S, Math.random() * FH, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5); }
    const P = (x, y) => { const rr = HRX * Math.sqrt(Math.max(0.0001, 1 - (y / HRY) * (y / HRY))), a = Math.acos(clamp(x / rr, -1, 1)); return [(1 - a / TAU) * S, Math.acos(clamp(y / HRY, -1, 1)) / Math.PI * FH]; };
    const iris = pick([[95, 62, 30], [62, 98, 128], [72, 118, 78], [42, 30, 20], [112, 88, 52]]);
    for (const sx of [1, -1]) {
      const [bx, by] = P(sx * 0.052, -0.02); const bl = g.createRadialGradient(bx, by, 0, bx, by, 28); bl.addColorStop(0, 'rgba(215,100,95,.16)'); bl.addColorStop(1, 'rgba(215,100,95,0)'); g.fillStyle = bl; g.fillRect(bx - 30, by - 30, 60, 60);
      const [ex, ey] = P(sx * 0.034, 0.012);
      g.fillStyle = css(mulc(sk, 0.8), 0.42); g.beginPath(); g.ellipse(ex, ey - K, 11.5 * K, 7 * K, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgb(241,237,231)'; g.beginPath(); g.ellipse(ex, ey, 8.6 * K, 4.6 * K, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(215,150,150,.8)'; g.beginPath(); g.arc(ex - sx * 7.4 * K, ey + 0.4 * K, 1.5 * K, 0, TAU); g.fill();
      const ir = g.createRadialGradient(ex, ey, 0, ex, ey, 4 * K); ir.addColorStop(0, css(mulc(iris, 1.15))); ir.addColorStop(0.75, css(iris)); ir.addColorStop(1, css(mulc(iris, 0.45)));
      g.fillStyle = ir; g.beginPath(); g.arc(ex, ey, 4 * K, 0, TAU); g.fill();
      g.fillStyle = 'rgb(8,6,6)'; g.beginPath(); g.arc(ex, ey, 1.9 * K, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(ex - 1.8 * K, ey - 2 * K, 1.3 * K, 1.3 * K);
      g.save(); g.beginPath(); g.ellipse(ex, ey, 8.6 * K, 4.6 * K, 0, 0, TAU); g.clip();
      g.fillStyle = css(mulc(sk, 0.75), 0.5); g.fillRect(ex - 10 * K, ey - 6 * K, 20 * K, 3 * K); g.restore();
      g.strokeStyle = 'rgba(25,15,12,.88)'; g.lineWidth = (female ? 2.4 : 1.7) * K; g.lineCap = 'round'; g.beginPath(); g.ellipse(ex, ey, 8.7 * K, 4.7 * K, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
      g.strokeStyle = css(mulc(sk, 0.6), 0.35); g.lineWidth = 1.2 * K; g.beginPath(); g.ellipse(ex, ey - 2.2 * K, 8.4 * K, 4.3 * K, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.strokeStyle = 'rgba(25,15,12,.28)'; g.lineWidth = 1 * K; g.beginPath(); g.ellipse(ex, ey, 8.4 * K, 4.3 * K, 0, 0.1, Math.PI - 0.1); g.stroke();
      if (female) { g.strokeStyle = 'rgba(15,8,6,.8)'; g.lineWidth = 0.9 * K; for (let i = 0; i < 9; i++) { const a = Math.PI * (1.1 + i * 0.1), px = ex + Math.cos(a) * 8.7 * K, py = ey + Math.sin(a) * 4.7 * K; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * 2.6 * K, py + Math.sin(a) * 3.4 * K - 1.2 * K); g.stroke(); } }
      const [b0x, b0y] = P(sx * 0.012, 0.042), [b1x, b1y] = P(sx * 0.054, 0.05);
      g.lineCap = 'round'; for (let i = 0; i < 60; i++) { const t = Math.random(), x = lerp(b0x, b1x, t), y = lerp(b0y, b1y, t) - Math.sin(Math.PI * t) * 3.2 * K + (Math.random() - 0.5) * (female ? 2.2 : 3.6) * K; g.strokeStyle = css(mulc(hc, 0.7 + Math.random() * 0.4), 0.8); g.lineWidth = 1 * K; g.beginPath(); g.moveTo(x, y); g.lineTo(x + sx * 3.4 * K, y - 1.3 * K * (t < 0.5 ? 1 : -0.3)); g.stroke(); }
      const [nx0, ny0] = P(sx * 0.016, -0.034); g.fillStyle = 'rgba(40,20,18,.6)'; g.beginPath(); g.ellipse(nx0, ny0, 2.6 * K, 1.6 * K, 0, 0, TAU); g.fill();
      const [s0x, s0y] = P(sx * 0.014, 0.0), [s1x, s1y] = P(sx * 0.024, -0.032); g.strokeStyle = 'rgba(60,30,25,.14)'; g.lineWidth = 2.2 * K; g.beginPath(); g.moveTo(s0x, s0y); g.lineTo(s1x, s1y); g.stroke();
      const [m0x, m0y] = P(sx * 0.026, -0.04), [m1x, m1y] = P(sx * 0.031, -0.068); g.strokeStyle = 'rgba(60,30,25,.09)'; g.lineWidth = 2.2 * K; g.beginPath(); g.moveTo(m0x, m0y); g.lineTo(m1x, m1y); g.stroke();
    }
    const [tx, ty] = P(0, -0.03); g.fillStyle = 'rgba(255,230,210,.16)'; g.beginPath(); g.ellipse(tx, ty, 4 * K, 3 * K, 0, 0, TAU); g.fill();
    const lip = mixc(sk, female ? [188, 58, 70] : [165, 85, 85], female ? 0.66 : 0.5);
    const [ux, uy] = P(0, -0.052), [lx, ly] = P(0, -0.064), [mx0, my0] = P(-0.024, -0.057), [mx1, my1] = P(0.024, -0.057);
    g.fillStyle = css(mulc(lip, 0.88), 0.92); g.beginPath(); g.ellipse(ux, uy, 10 * K, 3 * K, 0, 0, TAU); g.fill();
    g.fillStyle = css(lip, 0.88); g.beginPath(); g.ellipse(lx, ly, 9 * K, 3.5 * K, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(lx, ly - 0.5 * K, 4 * K, 1 * K, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,20,22,.85)'; g.lineWidth = 1.5 * K; g.beginPath(); g.moveTo(mx0, my0); g.quadraticCurveTo((mx0 + mx1) / 2, my0 + 0.8 * K, mx1, my1); g.stroke();
    if (beard || (!female && Math.random() < 0.3)) for (let i = 0; i < 1400; i++) { const [px, py] = P((Math.random() - 0.5) * 0.12, -0.11 + Math.random() * 0.058); g.fillStyle = 'rgba(30,22,18,' + (0.08 + Math.random() * 0.1) + ')'; g.fillRect(px, py, 1.1, 1.1); }
    if (Math.random() < 0.25) for (let i = 0; i < 70; i++) { const [px, py] = P((Math.random() - 0.5) * 0.09, -0.03 + Math.random() * 0.035); g.fillStyle = 'rgba(150,90,60,.25)'; g.fillRect(px, py, 1.6, 1.6); }
    return tex(c, true);
  }

  // --- matériaux (5 groupes : peau, tissu, jean, cheveux, accessoires) ---
  const fabMap = fabricTex(), denMap = denimTex(), hairMap = hairTex();
  const clothMat = new THREE.MeshStandardMaterial({ map: fabMap, bumpMap: fabMap, bumpScale: 0.22, vertexColors: true, roughness: 0.92, metalness: 0, skinning: true });
  const denimMat = new THREE.MeshStandardMaterial({ map: denMap, bumpMap: denMap, bumpScale: 0.35, vertexColors: true, roughness: 0.88, metalness: 0, skinning: true });
  const hairMat = new THREE.MeshStandardMaterial({ map: hairMap, bumpMap: hairMap, bumpScale: 0.4, vertexColors: true, roughness: 0.5, metalness: 0.08, skinning: true });
  const trimH = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, skinning: true });
  disposables.push(fabMap, denMap, hairMap, clothMat, denimMat, hairMat, trimH); envMats.push(clothMat, denimMat, hairMat, trimH);
  const skinMats = {};
  function skinMatFor(sp) {
    const hh = (sp.hair === null || sp.hair === undefined) ? 0x2a1810 : sp.hair;
    const key = sp.skin + '_' + hh + '_' + (sp.female ? 1 : 0) + (sp.beard ? 'b' : '');
    if (!skinMats[key]) { const m = new THREE.MeshStandardMaterial({ map: faceTex(sp.skin, hh, !!sp.female, !!sp.beard), vertexColors: true, roughness: 0.6, metalness: 0, skinning: true }); disposables.push(m); envMats.push(m); skinMats[key] = m; }
    return skinMats[key];
  }

  // --- constructeurs de formes ---
  function tubeA(B, rings, seg, o) {
    o = o || {};
    const V = [], T = [], tile = o.tile || 0.25, n = seg + 1, o0 = B.p.length / 3;
    let vAcc = 0;
    rings.forEach((r, k) => {
      if (k > 0) vAcc += Math.abs(r.y - rings[k - 1].y) / tile;
      const per = TAU * (r.rx + (r.rzf + r.rzb) / 2) / 2 / tile;
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), bl = 0.5 + 0.5 * clamp(sa * 3, -1, 1), rz = lerp(r.rzb, r.rzf, bl);
        const w = r.wob ? 1 + r.wob * Math.sin(a * 5 + r.y * 37) : 1;
        V.push([r.x + ca * r.rx * w, r.y, r.z + sa * rz * w, r.col, r.sk, o.skin ? [0.5, 0.023] : [i / seg * per, vAcc]]);
      }
    });
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) { const a = k * n + i, b = a + 1, c = (k + 1) * n + i, d = c + 1; T.push([a, b, d], [a, d, c]); }
    const dir = c => { let best = rings[0], bd = 1e9; for (const r of rings) { const d = Math.abs(r.y - c[1]); if (d < bd) { bd = d; best = r; } } return [c[0] - best.x, 0, c[2] - best.z]; };
    B.emit(V, T, [1, 1, 1], dir, v => v[3], v => v[4], v => v[5]);
    for (let k = 0; k < rings.length; k++) {
      const i0 = (o0 + k * n) * 3, i1 = (o0 + k * n + seg) * 3;
      const ax = B.n[i0] + B.n[i1], ay = B.n[i0 + 1] + B.n[i1 + 1], az = B.n[i0 + 2] + B.n[i1 + 2], l = Math.hypot(ax, ay, az) || 1;
      B.n[i0] = B.n[i1] = ax / l; B.n[i0 + 1] = B.n[i1 + 1] = ay / l; B.n[i0 + 2] = B.n[i1 + 2] = az / l;
    }
    if (o.capBottom) {
      const r = rings[0], W = [[r.x, r.y, r.z, r.col, r.sk, [0, 0]]], U = [];
      for (let i = 0; i < seg; i++) { const a = i / seg * TAU; W.push([r.x + Math.cos(a) * r.rx, r.y, r.z + Math.sin(a) * r.rzf, r.col, r.sk, [0, 0]]); }
      for (let i = 0; i < seg; i++) U.push([0, 1 + i, 1 + (i + 1) % seg]);
      B.emit(W, U, [1, 1, 1], () => [0, -1, 0], v => v[3], v => v[4], v => v[5]);
    }
  }
  function loftShoe(B, x0, col, sole) {
    const st = [{ z: -0.075, w: 0.034, h: 0.026, y: 0.042 }, { z: -0.055, w: 0.044, h: 0.04, y: 0.054 }, { z: -0.01, w: 0.05, h: 0.044, y: 0.062 }, { z: 0.05, w: 0.052, h: 0.036, y: 0.054 },
      { z: 0.115, w: 0.05, h: 0.027, y: 0.044 }, { z: 0.17, w: 0.04, h: 0.021, y: 0.036 }, { z: 0.2, w: 0.028, h: 0.017, y: 0.032 }];
    const seg = 10, n = seg, V = [], T = [];
    for (const s of st) for (let i = 0; i < seg; i++) { const a = i / seg * TAU; V.push([x0 + Math.cos(a) * s.w, Math.max(0.018, s.y + Math.sin(a) * s.h), s.z, col, [BI[x0 > 0 ? 'ftL' : 'ftR'], 0, 1], [0, 0]]); }
    for (let k = 0; k < st.length - 1; k++) for (let i = 0; i < seg; i++) { const j = (i + 1) % seg, a = k * n + i, b = k * n + j, c = (k + 1) * n + i, d = (k + 1) * n + j; T.push([a, b, d], [a, d, c]); }
    B.emit(V, T, [1, 1, 1], c => [c[0] - x0, c[1] - 0.05, 0], v => v[3], v => v[4], v => v[5]);
    for (const end of [0, st.length - 1]) {
      const s = st[end], W = [[x0, s.y, s.z, col, [BI[x0 > 0 ? 'ftL' : 'ftR'], 0, 1], [0, 0]]], U = [];
      for (let i = 0; i < seg; i++) { const a = i / seg * TAU; W.push([x0 + Math.cos(a) * s.w, Math.max(0.018, s.y + Math.sin(a) * s.h), s.z, col, [BI[x0 > 0 ? 'ftL' : 'ftR'], 0, 1], [0, 0]]); }
      for (let i = 0; i < seg; i++) U.push([0, 1 + i, 1 + (i + 1) % seg]);
      B.emit(W, U, [1, 1, 1], () => [0, 0, end === 0 ? -1 : 1], v => v[3], v => v[4], v => v[5]);
    }
  }
  function ringR(y, rx, rzf, rzb, zc, col, sk, x, wob) { return { x: x || 0, y, z: zc || 0, rx, rzf, rzb, col, sk, wob: (wob || 0) * 0.3 }; }

  function humanGeom(sp) {
    const key = JSON.stringify(sp);
    if (humanCache[key]) return humanCache[key];
    const SB = new Batch(), CB = new Batch(), DB = new Batch(), HB = new Batch(), TB2 = new Batch();
    const setSk = i => { SB.sk = CB.sk = DB.sk = HB.sk = TB2.sk = i; };
    const f = sp.fat || 1, fem = !!sp.female, sh = fem ? 0.9 : 1, hp = fem ? 1.08 : 1, bust = fem ? 0.022 : 0;
    const WHITE3 = [1, 1, 1], shirt = hex2rgb(sp.shirt), pants = hex2rgb(sp.pants), shoeC = hex2rgb(sp.shoes), beltC = hex2rgb(0x20160f), collar = shade(shirt, 1.12);
    const hairC = (sp.hair === null || sp.hair === undefined) ? hex2rgb(0x2a1810) : hex2rgb(sp.hair);
    const Wh = Wt('hips', 'hips', 1);
    // pantalon (bassin)
    tubeA(DB, [ringR(0.82, 0.15 * hp * f, 0.1, 0.112, 0, pants, Wh, 0, 0.01), ringR(0.9, 0.172 * hp * f, 0.106, 0.124, 0, pants, Wh, 0, 0.01), ringR(0.97, 0.164 * hp * f, 0.102, 0.114, 0, pants, Wh, 0, 0.012), ringR(1.0, 0.152 * f, 0.097, 0.102, 0, pants, Wt('hips', 'spine', 0.4))], 16, { capBottom: true });
    tubeA(TB2, [ringR(0.985, 0.155 * f, 0.099, 0.104, 0, beltC, Wt('hips', 'spine', 0.6)), ringR(1.007, 0.154 * f, 0.099, 0.104, 0, beltC, Wt('hips', 'spine', 0.6))], 16);
    // haut
    tubeA(CB, [ringR(0.9, 0.178 * hp * f, 0.11, 0.128, 0, shirt, Wh, 0, 0.014), ringR(0.97, 0.17 * hp * f, 0.106, 0.118, 0, shirt, Wh, 0, 0.016), ringR(1.04, 0.152 * f, 0.098, 0.104, 0, shirt, Wt('hips', 'spine', 0.5), 0, 0.02),
      ringR(1.12, 0.15 * f, 0.098, 0.098, 0, shirt, Wt('spine', 'spine', 1), 0, 0.02), ringR(1.22, 0.15 * f, 0.108, 0.102, 0.004, shirt, Wt('spine', 'chest', 0.5), 0, 0.014), ringR(1.32, 0.166 * sh * f, 0.118 + bust, 0.106, 0.008, shirt, Wt('chest', 'chest', 1), 0, 0.01),
      ringR(1.4, 0.184 * sh * f, 0.112 + bust * 0.5, 0.108, 0, shirt, Wt('chest', 'chest', 1)), ringR(1.45, 0.178 * sh * f, 0.102, 0.1, -0.004, shirt, Wt('chest', 'chest', 1)), ringR(1.485, 0.112 * sh, 0.078, 0.076, -0.004, shirt, Wt('chest', 'chest', 1)),
      ringR(1.515, 0.082, 0.066, 0.066, 0, collar, Wt('chest', 'neck', 0.5))], 16);
    tubeA(SB, [ringR(1.5, 0.056, 0.056, 0.056, 0, WHITE3, Wt('chest', 'neck', 0.5)), ringR(1.55, 0.05, 0.05, 0.05, 0, WHITE3, Wt('neck', 'neck', 1)), ringR(1.6, 0.049, 0.049, 0.049, 0, WHITE3, Wt('neck', 'head', 0.5))], 12, { skin: true });
    const wArm = (u, fo, hd) => y => (y >= 1.22 ? Wt(u, u, 1) : y >= 1.12 ? Wt(u, fo, (y - 1.12) / 0.1) : y > 0.97 ? Wt(fo, fo, 1) : y > 0.91 ? Wt(fo, hd, (y - 0.91) / 0.06) : Wt(hd, hd, 1));
    const wLeg = (th, sh2, ft) => y => (y >= 0.56 ? Wt(th, th, 1) : y >= 0.44 ? Wt(th, sh2, (y - 0.44) / 0.12) : y >= 0.14 ? Wt(sh2, sh2, 1) : Wt(sh2, ft, clamp((y - 0.08) / 0.06, 0, 1)));
    for (const sg of [1, -1]) {
      const u = sg > 0 ? 'uL' : 'uR', fo = sg > 0 ? 'fL' : 'fR', hd = sg > 0 ? 'hL' : 'hR', ax = sg * 0.2, wa = wArm(u, fo, hd);
      const slY = sp.long ? [1.47, 1.42, 1.36, 1.28, 1.2, 1.17, 1.13, 1.05, 0.985] : [1.47, 1.42, 1.36, 1.3, 1.275];
      const slR = sp.long ? [0.064, 0.062, 0.056, 0.049, 0.044, 0.0425, 0.041, 0.037, 0.04] : [0.064, 0.062, 0.057, 0.052, 0.057];
      tubeA(CB, slY.map((y, i) => ringR(y, slR[i], slR[i], slR[i], 0, shirt, wa(y), ax, 0.02)), 12);
      const skY = sp.long ? [0.985, 0.96, 0.94] : [1.28, 1.2, 1.17, 1.13, 1.08, 1.03, 0.99, 0.96, 0.94], skR = sp.long ? [0.036, 0.032, 0.03] : [0.05, 0.046, 0.0435, 0.041, 0.04, 0.037, 0.034, 0.031, 0.029];
      tubeA(SB, skY.map((y, i) => ringR(y, skR[i], skR[i], skR[i], 0, WHITE3, wa(y), ax)), 10, { skin: true });
      if (sp.top === 'jacket' || sp.top === 'blazer') { const cc = shade(shirt, 0.55); tubeA(TB2, [ringR(1.05, 0.04, 0.04, 0.04, 0, cc, wa(1.05), ax), ringR(0.985, 0.042, 0.042, 0.042, 0, cc, wa(0.985), ax)], 10); }
      setSk(BI[u]); CB.sphere(ax, 1.455, 0, 0.06, 0.066, 0.06, shirt, 10, 8);
      setSk(BI[hd]); SB.sphere(ax, 0.845, 0.008, 0.034, 0.05, 0.016, WHITE3, 10, 8);
      for (let k = 0; k < 4; k++) {
        const fx = ax + sg * (-0.021 + k * 0.014), L = k === 1 || k === 2 ? 1 : 0.9, rr = [0.0095, 0.0088, 0.0078, 0.0068];
        tubeA(SB, [0, 1, 2, 3].map(j => ringR(0.8 - j * 0.035 * L, rr[j], rr[j], rr[j], 0.012 + 0.004 * j * j * 0.5 * L, WHITE3, Wt(hd, hd, 1), fx)), 6, { skin: true });
        setSk(BI[hd]); SB.sphere(fx, 0.8 - 3.4 * 0.035 * L, 0.012 + 0.004 * 9 * 0.5 * L, 0.0066, 0.0066, 0.0066, WHITE3, 5, 4);
      }
      tubeA(SB, [0, 1, 2].map(j => ringR(0.865 - j * 0.028, 0.0115 - j * 0.0015, 0.0115 - j * 0.0015, 0.0115 - j * 0.0015, 0.018 + j * 0.01, WHITE3, Wt(hd, hd, 1), ax - sg * (0.032 - j * 0.003))), 6, { skin: true });
      // jambes
      const th = sg > 0 ? 'tL' : 'tR', sh2 = sg > 0 ? 'sL' : 'sR', ft = sg > 0 ? 'ftL' : 'ftR', lx = sg * 0.09, wl = wLeg(th, sh2, ft);
      const lg = [[0.99, 0.094, 0.102, 0.108], [0.92, 0.092, 0.1, 0.108], [0.82, 0.083, 0.09, 0.098], [0.72, 0.074, 0.08, 0.086], [0.62, 0.066, 0.07, 0.074], [0.55, 0.06, 0.064, 0.066], [0.5, 0.058, 0.062, 0.062], [0.45, 0.058, 0.064, 0.064],
        [0.4, 0.062, 0.07, 0.076], [0.33, 0.063, 0.066, 0.082], [0.25, 0.054, 0.056, 0.066], [0.17, 0.047, 0.05, 0.052], [0.11, 0.05, 0.054, 0.054], [0.095, 0.052, 0.056, 0.056]];
      const lgP = sp.shorts ? lg.filter(r => r[0] >= 0.52).concat([[0.5, 0.064, 0.068, 0.068]]) : lg;
      tubeA(DB, lgP.map(r => ringR(r[0], r[1] * (r[0] > 0.6 ? f : 1), r[2], r[3], 0, pants, wl(r[0]), lx, 0.018)), 14);
      if (sp.shorts) tubeA(SB, lg.filter(r => r[0] <= 0.5 && r[0] >= 0.11).map(r => ringR(r[0], r[1] * 0.9, r[2] * 0.9, r[3] * 0.92, 0, WHITE3, wl(r[0]), lx)), 12, { skin: true });
      loftShoe(TB2, lx, shoeC);
      setSk(BI[ft]); TB2.box(lx, 0.011, 0.062, 0.1, 0.024, 0.3, sp.shoes > 0xaaaaaa ? 0xefece4 : 0x15110e);
      for (let k = 0; k < 3; k++) TB2.box(lx, 0.085 - k * 0.0, 0.0 + k * 0.03, 0.05, 0.006, 0.012, 0xe8e4dc);
    }
    // détails du torse
    setSk(BI.hips); TB2.box(0, 0.996, 0.104, 0.04, 0.026, 0.012, 0xc9a227);
    setSk(BI.chest);
    const hemC = shade(shirt, 0.5);
    if (sp.top === 'jacket' || sp.top === 'blazer') tubeA(TB2, [ringR(0.9, 0.18 * hp * f, 0.112, 0.13, 0, hemC, Wh), ringR(0.955, 0.176 * hp * f, 0.11, 0.123, 0, hemC, Wh)], 16);
    if (sp.top === 'jacket') for (const sx of [-1, 1]) CB.box(sx * 0.1, 1.06, 0.108, 0.075, 0.026, 0.016, shade(shirt, 0.8));
    if (sp.top === 'hoodie') {
      tubeA(CB, [ringR(1.47, 0.1, 0.05, 0.09, -0.03, shirt, Wt('chest', 'neck', 0.5)), ringR(1.54, 0.105, 0.045, 0.12, -0.06, shirt, Wt('neck', 'neck', 1)), ringR(1.62, 0.095, 0.04, 0.115, -0.075, shirt, Wt('neck', 'head', 0.5)), ringR(1.68, 0.075, 0.03, 0.1, -0.08, shirt, Wt('head', 'head', 1))], 12);
      CB.box(0, 1.02, 0.108, 0.24, 0.1, 0.03, shade(shirt, 0.92));
      for (const sx of [-1, 1]) CB.box(sx * 0.035, 1.38, 0.115, 0.008, 0.14, 0.008, 0xe8e4dc);
    }
    if (sp.jacket) { CB.box(0, 1.28, 0.121, 0.012, 0.34, 0.012, 0x15151a); for (const sx of [-1, 1]) CB.box(sx * 0.036, 1.49, 0.07, 0.07, 0.04, 0.03, shade(shirt, 0.85)); }
    if (sp.pack) { CB.box(0, 1.3, -0.15, 0.3, 0.4, 0.12, 0x3a4a5c); for (const sx of [-1, 1]) CB.box(sx * 0.1, 1.38, 0, 0.04, 0.3, 0.2, 0x2f3b4a); }
    if (sp.badge) { TB2.sphere(0.11, 1.36, 0.118, 0.015, 0.015, 0.008, 0xd4af37, 6, 4); for (const sx of [-1, 1]) TB2.box(sx * 0.2, 1.47, 0, 0.09, 0.02, 0.11, 0x0b1324); }
    // tête
    setSk(BI.head);
    {
      const V = [], T = [], n = HN + 1;
      for (let j = 0; j <= HM; j++) for (let i = 0; i <= HN; i++) { const a = i / HN * TAU, vv = j / HM * Math.PI; V.push([...headVertex(a, vv), WHITE3, Wt('head', 'head', 1), [1 - i / HN, 1 - (j / HM) * (240 / 256)]]); }
      for (let j = 0; j < HM; j++) for (let i = 0; i < HN; i++) { const a = j * n + i, b = a + 1, c = (j + 1) * n + i, d = c + 1; T.push([a, b, d], [a, d, c]); }
      const o0 = SB.p.length / 3;
      SB.emit(V, T, WHITE3, c => [c[0], c[1] - HCY, c[2] - HCZ], v => v[3], v => v[4], v => v[5]);
      for (let j = 0; j <= HM; j++) { const i0 = (o0 + j * n) * 3, i1 = (o0 + j * n + HN) * 3, ax = SB.n[i0] + SB.n[i1], ay = SB.n[i0 + 1] + SB.n[i1 + 1], az = SB.n[i0 + 2] + SB.n[i1 + 2], l = Math.hypot(ax, ay, az) || 1; SB.n[i0] = SB.n[i1] = ax / l; SB.n[i0 + 1] = SB.n[i1 + 1] = ay / l; SB.n[i0 + 2] = SB.n[i1 + 2] = az / l; }
    }
    for (const sx of [-1, 1]) { SB.sphere(sx * 0.081, HCY + 0.002, HCZ - 0.004, 0.012, 0.03, 0.021, WHITE3, 8, 6); }
    // cheveux / barbe
    const shell = (mask, k, uvk, col) => {
      const V = [], T = [], n = HN + 1;
      for (let j = 0; j <= HM; j++) for (let i = 0; i <= HN; i++) {
        const a = i / HN * TAU, vv = j / HM * Math.PI, p = headPoint(a, vv), q = 1 + (Math.sin(i * 2.3 + j * 1.7) * 0.012);
        V.push([p[0] * k * q, (p[1]) * k * q + HCY, p[2] * k * q + HCZ, col, Wt('head', 'head', 1), [i / HN * uvk, p[1] * 7], mask(p)]);
      }
      for (let j = 0; j < HM; j++) for (let i = 0; i < HN; i++) {
        const a = j * n + i, b = a + 1, c = (j + 1) * n + i, d = c + 1;
        if (V[a][6] && V[b][6] && V[c][6] && V[d][6]) T.push([a, b, d], [a, d, c]);
      }
      return { V, T };
    };
    const hs = sp.hs || 'short';
    if (hs !== 'bald' && sp.hair !== null && sp.hair !== undefined) {
      const thick = hs === 'buzz' ? 1.02 : hs === 'long' ? 1.07 : 1.055;
      const hl = p => lerp(hs === 'long' ? -0.085 : -0.05, hs === 'buzz' ? 0.085 : 0.074, clamp((p[2] + 0.03) / 0.08, 0, 1));
      const hr = shell(p => p[1] > hl(p) && !(p[2] > 0.02 && p[1] < 0.07), thick, 3, hairC);
      HB.emit(hr.V, hr.T, [1, 1, 1], c => [c[0], c[1] - HCY, c[2] - HCZ], v => v[3], v => v[4], v => v[5]);
      if (hs === 'long') tubeA(HB, [ringR(1.62, 0.088, 0.02, 0.044, -0.05, hairC, Wt('head', 'head', 1)), ringR(1.54, 0.09, 0.022, 0.046, -0.06, hairC, Wt('neck', 'chest', 0.5)), ringR(1.46, 0.086, 0.022, 0.04, -0.07, hairC, Wt('chest', 'chest', 1)), ringR(1.38, 0.072, 0.018, 0.03, -0.07, hairC, Wt('chest', 'chest', 1))], 12, { tile: 0.2 });
      if (hs === 'bun') { setSk(BI.head); HB.sphere(0, HCY + 0.1, HCZ - 0.075, 0.045, 0.04, 0.045, hairC, 10, 8); }
      if (hs === 'pony') tubeA(HB, [ringR(1.76, 0.026, 0.026, 0.026, -0.1, hairC, Wt('head', 'head', 1)), ringR(1.66, 0.026, 0.026, 0.026, -0.14, hairC, Wt('head', 'head', 1)), ringR(1.54, 0.02, 0.02, 0.02, -0.15, hairC, Wt('neck', 'chest', 0.5)), ringR(1.46, 0.012, 0.012, 0.012, -0.14, hairC, Wt('chest', 'chest', 1))], 8, { tile: 0.2 });
    }
    if (sp.beard) {
      const br = shell(p => p[1] < -0.036 && p[1] > -0.11 && p[2] > -0.005 && Math.abs(p[0]) < 0.066, 1.035, 3, hairC);
      HB.emit(br.V, br.T, [1, 1, 1], c => [c[0], c[1] - HCY, c[2] - HCZ], v => v[3], v => v[4], v => v[5]);
    }
    setSk(BI.head);
    if (sp.glasses) { for (const sx of [-1, 1]) TB2.box(sx * 0.036, HCY + 0.02, HCZ + 0.1, 0.04, 0.026, 0.006, 0x101014); TB2.box(0, HCY + 0.025, HCZ + 0.102, 0.02, 0.005, 0.005, 0x101014); }
    if (sp.hat) {
      const hc = hex2rgb(sp.hat);
      TB2.cyl(0, HCY + 0.07, 0, 0.105, 0.105, 0.1, 0.1, 0.065, 14, hc); TB2.cyl(0, HCY + 0.06, 0, 0.12, 0.13, 0.12, 0.13, 0.02, 14, hc); TB2.box(0, HCY + 0.067, 0.125, 0.21, 0.012, 0.095, hc);
    }
    setSk(-1);
    const geo = combineSkinned([SB, CB, DB, HB, TB2]);
    humanCache[key] = geo; return geo;
  }
  function combineSkinned(batches) {
    const g = new THREE.BufferGeometry(), p = [], n = [], c = [], u = [], si = [], sw = [], idx = [], groups = [];
    let vo = 0;
    batches.forEach((b, mi) => {
      const start = idx.length;
      for (let i = 0; i < b.i.length; i++) idx.push(b.i[i] + vo);
      for (let i = 0; i < b.p.length; i++) { p.push(b.p[i]); n.push(b.n[i]); c.push(b.c[i]); }
      for (let i = 0; i < b.u.length; i++) u.push(b.u[i]);
      for (let i = 0; i < b.si.length; i++) { si.push(b.si[i]); sw.push(b.sw[i]); }
      if (b.i.length) groups.push([start, b.i.length, mi]);
      vo += b.p.length / 3;
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    for (const gr of groups) g.addGroup(gr[0], gr[1], gr[2]);
    g.computeBoundingSphere(); if (g.boundingSphere) g.boundingSphere.radius += 0.6;
    disposables.push(g);
    return g;
  }
  function makeOutfit() {
    const female = Math.random() < 0.4, hs = female ? pick(['long', 'long', 'pony', 'bun', 'short']) : pick(['short', 'short', 'buzz', 'bald', 'short']);
    const top = pick(['tee', 'tee', 'long', 'hoodie', 'jacket', 'blazer']);
    return { shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS), hair: pick(HAIRS), hs, female, top, long: top !== 'tee', shorts: Math.random() < (female ? 0.22 : 0.12), shoes: pick([0x1a1a1a, 0xf0f0f0, 0x4a3020, 0x2a3a5a]), fat: Math.round(R(0.92, 1.18) * 100) / 100, beard: !female && Math.random() < 0.18, glasses: Math.random() < 0.15, jacket: top === 'jacket' || top === 'blazer', pack: Math.random() < 0.15 };
  }
  const OUTFITS = []; for (let i = 0; i < 30; i++) OUTFITS.push(makeOutfit());
  const randomOutfit = () => pick(OUTFITS);
  const COP_OUTFIT = { shirt: 0x2a4a8c, pants: 0x14213d, skin: 0xe8bb98, hair: 0x2a1810, hs: 'buzz', top: 'long', long: true, shoes: 0x0a0a0a, hat: 0x101820, badge: true, fat: 1.05 };
  const PLAYER_OUTFIT = { shirt: 0xff7a1a, pants: 0x2b3f63, skin: 0xf1c6a0, hair: 0x3a2a1e, hs: 'short', top: 'jacket', long: true, shoes: 0xe8e8e8, jacket: true, fat: 1.04, beard: true };
  function makeBones() {
    const bones = RJ.map(() => new THREE.Bone());
    RJ.forEach((j, i) => {
      const p = j[3], pp = p >= 0 ? RJ[p] : [0, 0, 0];
      bones[i].position.set(j[0] - pp[0], j[1] - pp[1], j[2] - pp[2]);
      if (p >= 0) bones[p].add(bones[i]);
    });
    return bones;
  }
  function buildHuman(sp, gun) {
    const g = new THREE.Group(), geo = humanGeom(sp), bones = makeBones();
    const mesh = new THREE.SkinnedMesh(geo, [skinMatFor(sp), clothMat, denimMat, hairMat, trimH]);
    mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones));
    if (qHigh) mesh.castShadow = true;
    g.add(mesh);
    const b = {}; BN.forEach((n, i) => { b[n] = bones[i]; });
    const gm = new THREE.Mesh(gunGeo, mat(0x111111)); gm.rotation.x = Math.PI / 2; gm.position.set(0, -0.12, 0.03); gm.visible = !!gun; b.hR.add(gm);
    g.add(makeShadow(0.7, 0.7));
    const ph = new THREE.Mesh(phoneGeo, mat(0x15151a)); ph.position.set(0, -0.07, 0.03); ph.rotation.x = -0.6; ph.visible = false; b.hR.add(ph);
    return { g, mesh, b, gm, ph, phase: Math.random() * 6, t: 0 };
  }

  // ---------- Animation procédurale du squelette ----------
  function animateHuman(h, a, dt) {
    const b = h.b, k = Math.min(1, dt * 12), mode = a.mode || 'idle', sp = a.speed || 0;
    h.t += dt;
    if (sp > 0.05) h.phase += dt * sp * (sp > 3.2 ? 1.75 : 4.1 - clamp(sp - 1.4, 0, 1.8) * 0.9);
    const ph = h.phase, amp = clamp(sp / 6, 0.2, 1);
    const tg = new Map();
    const S = (bn, x, y, z) => { tg.set(bn, [x, y, z]); };
    let hipY = a.hipY !== undefined ? a.hipY : 0.95, lean = 0;
    if (mode === 'walk' || mode === 'run' || mode === 'scared') {
      const s = Math.sin(ph), c = Math.cos(ph), run = mode === 'walk' ? 0 : 1, A = 0.42 + 0.55 * amp;
      S(b.tL, -s * A, 0, 0.03); S(b.tR, s * A, 0, -0.03);
      S(b.sL, Math.max(0, c) * (0.55 + 0.9 * amp) + 0.06, 0, 0); S(b.sR, Math.max(0, -c) * (0.55 + 0.9 * amp) + 0.06, 0, 0);
      S(b.ftL, Math.max(0, -c) * 0.25, 0, 0); S(b.ftR, Math.max(0, c) * 0.25, 0, 0);
      hipY += -0.015 - Math.abs(c) * 0.03 * (0.4 + amp);
      lean = 0.03 + 0.2 * amp * run;
      S(b.spine, lean, s * 0.14 * amp, 0); S(b.chest, 0.02, -s * 0.09 * amp, 0); S(b.hips, 0, -s * 0.1 * amp, Math.sin(ph) * 0.045 * amp); S(b.head, -lean * 1.1, s * 0.05, -Math.sin(ph) * 0.03 * amp);
      if (mode === 'scared') {
        S(b.uL, -2.5 + Math.sin(ph * 2) * 0.25, 0, 0.35); S(b.uR, -2.5 + Math.sin(ph * 2 + 1) * 0.25, 0, -0.35); S(b.fL, -0.5, 0, 0); S(b.fR, -0.5, 0, 0);
      } else {
        const ea = 0.2 + 0.9 * amp * run + 0.15;
        S(b.uL, s * (0.35 + 0.55 * amp), 0, 0.06); S(b.uR, -s * (0.35 + 0.55 * amp), 0, -0.06); S(b.fL, -ea, 0, 0); S(b.fR, -ea, 0, 0);
      }
    } else if (mode === 'drive') {
      const st = a.steer || 0;
      S(b.tL, -1.5, 0, 0.08); S(b.tR, -1.45, 0, -0.08); S(b.sL, 1.55, 0, 0); S(b.sR, 1.45 - (a.gas ? 0.2 : 0), 0, 0); S(b.ftL, 0, 0, 0); S(b.ftR, 0.15, 0, 0);
      S(b.uL, -0.85, st * 0.3, 0.12); S(b.uR, -0.85, st * 0.3, -0.12); S(b.fL, -0.85, 0, 0); S(b.fR, -0.85, 0, 0);
      S(b.spine, -0.05, st * 0.08, 0); S(b.chest, 0, 0, 0); S(b.hips, 0, 0, 0); S(b.head, 0.02, st * 0.35, 0);
    } else if (mode === 'jump') {
      S(b.tL, -0.9, 0, 0.05); S(b.tR, -0.5, 0, -0.05); S(b.sL, 1.1, 0, 0); S(b.sR, 0.7, 0, 0);
      S(b.uL, -2.6, 0, 0.3); S(b.uR, -2.6, 0, -0.3); S(b.fL, -0.3, 0, 0); S(b.fR, -0.3, 0, 0); S(b.spine, 0.05, 0, 0); S(b.head, -0.1, 0, 0);
    } else if (mode === 'dead') {
      S(b.uL, -0.4, 0, 0.9); S(b.uR, 0.3, 0, -1.0); S(b.fL, -0.5, 0, 0); S(b.fR, -0.2, 0, 0); S(b.tL, -0.3, 0, 0.25); S(b.tR, 0.2, 0, -0.3);
      S(b.sL, 0.4, 0, 0); S(b.sR, 0.1, 0, 0); S(b.head, 0.2, 0.4, 0); S(b.spine, 0, 0.1, 0); S(b.chest, 0, 0, 0);
    } else if (mode === 'yank') {
      const fl = Math.sin(h.t * 22);
      S(b.tL, -0.9 + fl * 0.2, 0, 0.1); S(b.tR, -0.7 - fl * 0.2, 0, -0.1); S(b.sL, 0.9, 0, 0); S(b.sR, 0.6, 0, 0);
      S(b.uL, -1.9 + fl * 0.3, 0, 0.5); S(b.uR, -1.7 - fl * 0.3, 0, -0.5); S(b.fL, -0.4, 0, 0); S(b.fR, -0.4, 0, 0);
      S(b.spine, -0.3, 0, 0.1); S(b.head, 0.2, fl * 0.15, 0);
    } else {
      const br = Math.sin(h.t * 1.8) * 0.02, st = a.upper === 'aim';
      S(b.tL, st ? -0.3 : 0, 0, st ? 0.12 : 0.03); S(b.tR, st ? 0.18 : 0, 0, st ? -0.1 : -0.03); S(b.sL, st ? 0.22 : 0.04, 0, 0); S(b.sR, st ? 0.28 : 0.04, 0, 0); S(b.ftL, 0, 0, 0); S(b.ftR, 0, 0, 0);
      S(b.uL, 0.04 + br, 0, 0.08); S(b.uR, 0.04 - br, 0, -0.08); S(b.fL, -0.25, 0, 0); S(b.fR, -0.25, 0, 0);
      S(b.spine, br, 0, 0); S(b.chest, br * 1.5, 0, 0); S(b.hips, 0, 0, Math.sin(h.t * 0.6) * 0.02); S(b.head, -0.02, 0, 0);
      if (a.idle === 'phone') { S(b.uL, -0.75, 0, -0.15); S(b.uR, -0.75, 0, 0.15); S(b.fL, -1.5, 0, 0); S(b.fR, -1.5, 0, 0); S(b.head, 0.4, 0, 0); S(b.spine, 0.06, 0, 0); }
      else if (a.idle === 'look') { S(b.head, -0.02, Math.sin(h.t * 0.7) * 0.7, 0); S(b.spine, br, Math.sin(h.t * 0.7) * 0.2, 0); }
      else if (a.look) S(b.head, -0.02, Math.sin(h.t * 0.5) * 0.25, 0);
    }
    if (a.upper === 'aim') {
      S(b.uR, -1.5 - (a.recoil || 0) * 0.3, 0, -0.05); S(b.fR, -0.08, 0, 0); S(b.uL, -1.28, 0, -0.28); S(b.fL, -0.75, 0, 0);
      S(b.spine, lean - 0.04, -0.12, 0); S(b.head, -0.05 - (a.recoil || 0) * 0.1, 0.06, 0);
    } else if (a.upper === 'punch') {
      const p = clamp(a.punch || 0, 0, 1);
      const ux = p < 0.3 ? lerp(0, 0.6, p / 0.3) : p < 0.55 ? lerp(0.6, -1.55, (p - 0.3) / 0.25) : lerp(-1.55, 0, (p - 0.55) / 0.45);
      const fx = p < 0.3 ? -0.9 : p < 0.55 ? lerp(-0.9, -0.1, (p - 0.3) / 0.25) : lerp(-0.1, -0.5, (p - 0.55) / 0.45);
      S(b.uR, ux, 0, -0.1); S(b.fR, fx, 0, 0); S(b.uL, -0.9, 0, -0.3); S(b.fL, -1.0, 0, 0); S(b.spine, lean, p > 0.3 && p < 0.7 ? 0.3 : -0.2, 0);
    } else if (a.upper === 'reach') {
      S(b.uR, -1.3, 0, -0.1); S(b.fR, -0.3, 0, 0);
    } else if (a.upper === 'grab') {
      const pl = Math.sin(h.t * 14) * 0.15;
      S(b.uL, -1.35 + pl, 0, -0.1); S(b.uR, -1.35 - pl, 0, 0.1); S(b.fL, -0.7, 0, 0); S(b.fR, -0.7, 0, 0); S(b.spine, 0.28, 0, 0); S(b.head, -0.2, 0, 0);
    }
    tg.forEach((v, bn) => { const r = bn.rotation; r.x += (v[0] - r.x) * k; r.y += (v[1] - r.y) * k; r.z += (v[2] - r.z) * k; });
    if (a.flinch > 0) b.spine.rotation.x += 0.4 * a.flinch;
    h.ph.visible = mode === 'idle' && a.idle === 'phone';
    b.hips.position.y += (hipY - b.hips.position.y) * Math.min(1, dt * 14);
    h.gm.visible = !!a.gun;
  }

  // ---------- Particules & traces de tirs ----------
  const partMats = {
    fire: new THREE.MeshBasicMaterial({ color: lin(0xff8a1f) }),
    smoke: new THREE.MeshBasicMaterial({ color: lin(0x555555) }),
    blood: new THREE.MeshBasicMaterial({ color: lin(0xb01212) }),
    spark: new THREE.MeshBasicMaterial({ color: lin(0xfff1a8) }),
    debris: new THREE.MeshBasicMaterial({ color: lin(0x3a3a3a) })
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
    const mt = new THREE.LineBasicMaterial({ color: lin(0xffee88) });
    const line = new THREE.Line(geo, mt); line.visible = false; line.frustumCulled = false; scene.add(line);
    disposables.push(geo, mt);
    tracers.push({ line, life: 0 });
  }
  function tracer(x1, y1, z1, x2, y2, z2, col) {
    const t = tracers[tracerI++ % tracers.length];
    const a = t.line.geometry.attributes.position;
    a.setXYZ(0, x1, y1, z1); a.setXYZ(1, x2, y2, z2); a.needsUpdate = true;
    t.line.material.color.copy(lin(col || 0xffee88));
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
  const pm = buildHuman(PLAYER_OUTFIT, true);
  P.mesh = pm; scene.add(pm.g);

  // ---------- État global ----------
  let aimHold = false, camSO = 0;
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
  const inGrid = (i, j) => i >= 0 && i <= NX && j >= 0 && j <= NZ;
  const wAlong = (d, i, j) => (d[0] !== 0 ? RW[j] : RW[i]);
  const wCross = (d, i, j) => (d[0] !== 0 ? RW[i] : RW[j]);
  const segLen = (i, j, d) => (d[0] !== 0 ? Math.abs(XS[i + d[0]] - XS[i]) : Math.abs(ZS[j + d[1]] - ZS[j]));
  function canGo(i, j, d) {
    const ni = i + d[0], nj = j + d[1];
    if (!inGrid(ni, nj)) return false;
    if (d[0] !== 0) { if (j === 0 || j === NZ) return true; if (i === 0 || ni === 0 || i === NX || ni === NX) return RAMPS.includes(j); }
    else { if (i === 0 || i === NX) return true; if (j === 0 || nj === 0 || j === NZ || nj === NZ) return RAMPS.includes(i); }
    return true;
  }
  const validDirs = (i, j) => DIRS.filter(d => canGo(i, j, d));
  function placeOnRoad(c, i, j, d, along) {
    const lane = wAlong(d, i, j) / 4;
    c.x = XS[i] + d[0] * along - d[1] * lane;
    c.z = ZS[j] + d[1] * along + d[0] * lane;
    c.ang = Math.atan2(d[0], d[1]);
    c.ai = { i: i + d[0], j: j + d[1], d, wp: [] };
    c.cruise = RSPEED[rclass(wAlong(d, i, j))] * R(0.85, 1.1);
    c.stuck = 0; c.revT = 0;
  }
  function setupTraffic(c, minDist) {
    for (let t = 0; t < 25; t++) {
      const i = rint(0, NX), j = rint(0, NZ), ds = validDirs(i, j); if (!ds.length) continue;
      const d = pick(ds), along = R(0.2, 0.7) * segLen(i, j, d), x = XS[i] + d[0] * along, z = ZS[j] + d[1] * along;
      if (Math.hypot(x - P.x, z - P.z) < minDist) continue;
      if (Math.hypot(x - P.x, z - P.z) > 230 && t < 20) continue;
      placeOnRoad(c, i, j, d, along); c.speed = R(6, 11); return;
    }
    const i = rint(1, NX - 1), j = rint(1, NZ - 1), d = pick(validDirs(i, j));
    placeOnRoad(c, i, j, d, 0.5 * segLen(i, j, d)); c.speed = 5;
  }
  function aiPlan(c, cop) {
    const a = c.ai, cx = XS[a.i], cz = ZS[a.j], d = a.d;
    const E1 = wCross(d, a.i, a.j) / 2 + 3, L1 = wAlong(d, a.i, a.j) / 4;
    a.wp.push({ x: cx - d[0] * E1 - d[1] * L1, z: cz - d[1] * E1 + d[0] * L1 });
    const opts = [d, [d[1], -d[0]], [-d[1], d[0]]].filter(o => canGo(a.i, a.j, o));
    let nd;
    if (!opts.length) nd = [-d[0], -d[1]];
    else if (cop) {
      let best = 1e9;
      for (const o of opts) {
        const dd = Math.hypot(XS[a.i + o[0]] - P.x, ZS[a.j + o[1]] - P.z) + (Math.random() < 0.15 ? R(0, 90) : 0);
        if (dd < best) { best = dd; nd = o; }
      }
    } else {
      const hwNow = rclass(wAlong(d, a.i, a.j)) === 'hw';
      let tot = 0; const w = opts.map(o => { const v = o === d ? (hwNow ? 8 : 3) : (hwNow ? 0.35 : 1); tot += v; return v; });
      let r = Math.random() * tot; nd = opts[0];
      for (let k = 0; k < opts.length; k++) { r -= w[k]; if (r <= 0) { nd = opts[k]; break; } }
    }
    const E2 = wCross(nd, a.i, a.j) / 2 + 3, L2 = wAlong(nd, a.i, a.j) / 4;
    a.wp.push({ x: cx + nd[0] * E2 - nd[1] * L2, z: cz + nd[1] * E2 + nd[0] * L2 });
    if (!cop) c.cruise = RSPEED[rclass(wAlong(nd, a.i, a.j))] * R(0.85, 1.1);
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
      if (p.dead || p.state === 'walk' || p.state === 'stand') continue;
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
    for (let k = 0; k < 26; k++) {
      const i = rint(0, NX), j = rint(0, NZ), ds = validDirs(i, j); if (!ds.length) continue;
      const d = pick(ds), w = wAlong(d, i, j); if (rclass(w) === 'hw') continue;
      const along = R(0.25, 0.75) * segLen(i, j, d), off = w / 2 - 2.3;
      const c = makeCar(pick(['sedan', 'sedan', 'suv', 'sport', 'van']), 0, 0, 0, 'parked');
      c.x = XS[i] + d[0] * along - d[1] * off; c.z = ZS[j] + d[1] * along + d[0] * off;
      c.ang = Math.atan2(d[0], d[1]);
      if (Math.hypot(c.x - P.x, c.z - P.z) < 20) { c.x += 80; }
    }
  }
  const starter = makeCar('sport', STARTER.x, STARTER.z, STARTER.ang, 'parked');
  for (let k = 0; k < 40; k++) { const c = makeCar(pick(TRAFFIC_KINDS), 0, 0, 0, 'traffic'); setupTraffic(c, 30); }
  spawnParked();

  // ============================================================
  //  PIÉTONS
  // ============================================================
  function ringPos(bl, s) {
    const a = bl.hx - 2, b = bl.hz - 2, T = 4 * (a + b); s = ((s % T) + T) % T;
    if (s < 2 * a) return [bl.cx - a + s, bl.cz - b];
    if (s < 2 * a + 2 * b) return [bl.cx + a, bl.cz - b + (s - 2 * a)];
    if (s < 4 * a + 2 * b) return [bl.cx + a - (s - 2 * a - 2 * b), bl.cz + b];
    return [bl.cx - a, bl.cz + b - (s - 4 * a - 2 * b)];
  }
  const ringLen = bl => 4 * (bl.hx + bl.hz - 4);
  function ringParam(bl, dx, dz) {
    const a = bl.hx - 2, b = bl.hz - 2, m = Math.max(Math.abs(dx) / a, Math.abs(dz) / b) || 1, x = dx / m, z = dz / m;
    if (Math.abs(z) / b >= Math.abs(x) / a) return z < 0 ? x + a : 2 * a + 2 * b + (a - x);
    return x > 0 ? 2 * a + (z + b) : 4 * a + 2 * b + (b - z);
  }
  function makePed(kind, human) {
    const cop = kind === 'cop';
    const h = human || (cop ? buildHuman(COP_OUTFIT, true) : buildHuman(randomOutfit(), false));
    if (!cop) { const sc = R(0.94, 1.06); h.g.scale.set(sc, sc, sc); } else h.g.scale.set(1, 1, 1);
    scene.add(h.g);
    const p = { kind, h, g: h.g, x: 0, z: 0, y: 0.18, yaw: 0, state: 'walk', hp: cop ? 70 : 40, bi: 0, bj: 0, s: 0, dir: 1, speed: R(1.3, 2.1), t: 0, anim: Math.random() * 6, dead: false, deadT: 0, fx: 0, fz: 0, shootT: R(0.5, 1.2), retT: 0, fallT: 0, flinch: 0, cine: null, y2: 0.18 };
    peds.push(p);
    return p;
  }
  function placePed(p, minD, maxD) {
    for (let t = 0; t < 20; t++) {
      const bl = BL[rint(0, NX - 1)][rint(0, NZ - 1)], s = R(0, ringLen(bl)), pos = ringPos(bl, s);
      const d = Math.hypot(pos[0] - P.x, pos[1] - P.z);
      if (d < minD || d > maxD) continue;
      p.bi = bl.i; p.bj = bl.j; p.s = s; p.x = pos[0]; p.z = pos[1]; p.dir = Math.random() < 0.5 ? 1 : -1; p.state = 'walk'; return;
    }
    const bl = BL[rint(0, NX - 1)][rint(0, NZ - 1)]; p.bi = bl.i; p.bj = bl.j; p.s = R(0, ringLen(bl));
    const pos = ringPos(bl, p.s); p.x = pos[0]; p.z = pos[1];
  }
  for (let k = 0; k < 84; k++) { const p = makePed('ped'); placePed(p, 8, 260); }

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
    const m = new THREE.Mesh(type === 'cash' ? cashGeo : hpGeo, bmat(type === 'cash' ? 0x3ddc57 : type === 'hp' ? 0xff4d6d : 0x4da3ff));
    m.position.set(x, 0.8, z); scene.add(m);
    pickups.push({ type, m, x, z, val, temp: !!temp, life: temp ? 45 : 0, respawn: 0, on: true, ph: Math.random() * 6 });
  }
  for (let k = 0; k < 26; k++) { const pos = ringPos(BL[rint(0, NX - 1)][rint(0, NZ - 1)], R(0, 1000)); addPickup('cash', pos[0], pos[1], rint(40, 180)); }
  for (let k = 0; k < 9; k++) { const pos = ringPos(BL[rint(0, NX - 1)][rint(0, NZ - 1)], R(0, 1000)); addPickup(k % 3 === 0 ? 'armor' : 'hp', pos[0], pos[1], k % 3 === 0 ? 50 : 50); }

  function killPed(p, byPlayer, dir) {
    if (p.dead) return;
    p.dead = true; p.deadT = 0; p.hp = 0;
    p.fallT = 0; p.sprawl = R(-0.5, 0.5);
    burst(p.x, 1, p.z, 7, 'blood', 3);
    if (byPlayer) addHeat(p.kind === 'cop' ? 22 : 12);
    addPickup('cash', p.x + R(-0.5, 0.5), p.z + R(-0.5, 0.5), p.kind === 'cop' ? rint(100, 250) : rint(15, 110), true);
    scarePeds(p.x, p.z, 25);
  }
  function damagePed(p, dmg, byPlayer) {
    if (p.dead) return;
    p.hp -= dmg; p.flinch = 1;
    if (p.kind === 'ped' && p.state === 'walk') { p.state = 'flee'; p.t = R(5, 8); const dx = p.x - P.x, dz = p.z - P.z, l = Math.hypot(dx, dz) || 1; p.fx = dx / l; p.fz = dz / l; }
    if (p.hp <= 0) killPed(p, byPlayer);
    else burst(p.x, 1.2, p.z, 3, 'blood', 2);
  }
  function updatePeds(dt) {
    for (const p of peds) {
      if (p.dead) {
        p.deadT += dt; p.fallT += dt;
        if (p.deadT > 22) { p.g.visible = false; p.recycle = true; }
        const q = Math.min(1, p.fallT / 0.5), e = q * q * (3 - 2 * q);
        animateHuman(p.h, { mode: 'dead', speed: 0 }, dt);
        p.g.position.set(p.x, lerp(p.y2, 0.22, e), p.z); p.g.rotation.set(-Math.PI / 2 * e, p.yaw + p.sprawl * e, 0);
        continue;
      }
      if (p.state === 'cine') {
        p.flinch = 0;
        animateHuman(p.h, p.cine || { mode: 'idle' }, dt);
        p.g.position.set(p.x, p.y2, p.z); p.g.rotation.set(0, p.yaw, 0);
        continue;
      }
      const ox = p.x, oz = p.z;
      if (p.kind === 'ped') {
        // danger : voiture lancée vers lui
        if (P.mode === 'car' && P.car && Math.abs(P.car.speed) > 7 && (p.state === 'walk' || p.state === 'stand')) {
          const dx = p.x - P.car.x, dz = p.z - P.car.z;
          if (dx * dx + dz * dz < 150) { p.state = 'flee'; p.t = R(3, 5); const l = Math.hypot(dx, dz) || 1; p.fx = dx / l; p.fz = dz / l; }
        }
        if (p.state === 'walk' && Math.random() < dt * 0.03) { p.state = 'stand'; p.t = R(4, 11); p.idleKind = pick(['phone', 'look', 'look']); }
        if (p.state === 'stand') { p.t -= dt; if (p.t <= 0) p.state = 'walk'; }
        else if (p.state === 'walk') {
          p.s += p.dir * p.speed * dt;
          const pos = ringPos(BL[p.bi][p.bj], p.s); p.x = pos[0]; p.z = pos[1];
          p.anim += p.speed * dt * 3.2;
        } else if (p.state === 'flee') {
          p.t -= dt;
          const sp = 5.6; p.x += p.fx * sp * dt; p.z += p.fz * sp * dt;
          const pc = pushCircle(p.x, p.z, 0.4); if (pc) { p.x += pc[0]; p.z += pc[1]; }
          p.anim += sp * dt * 2.2;
          if (p.t <= 0) { p.state = 'return'; p.retT = 9; }
        } else if (p.state === 'return') {
          const nb = nearestBlock(p.x, p.z), ci = nb.i, cj = nb.j, s = ringParam(nb, p.x - nb.cx, p.z - nb.cz), tp = ringPos(nb, s);
          const dx = tp[0] - p.x, dz = tp[1] - p.z, d = Math.hypot(dx, dz);
          p.retT -= dt;
          if (d < 1.2 || p.retT <= 0) { p.bi = ci; p.bj = cj; p.s = s; p.state = 'walk'; }
          else { p.x += dx / d * 2.8 * dt; p.z += dz / d * 2.8 * dt; const pc = pushCircle(p.x, p.z, 0.4); if (pc) { p.x += pc[0]; p.z += pc[1]; } p.anim += dt * 7; }
        }
        // recyclage loin du joueur
        if (Math.hypot(p.x - P.x, p.z - P.z) > 190) { placePed(p, 30, 150); p.g.visible = true; }
      } else {
        updateOfficer(p, dt);
      }
      const mvx = p.x - ox, mvz = p.z - oz;
      if (mvx * mvx + mvz * mvz > 1e-6) p.yaw += angDiff(p.yaw, Math.atan2(mvx, mvz)) * Math.min(1, dt * 10);
      const dd = Math.hypot(p.x - P.x, p.z - P.z);
      p.g.visible = dd < 150; p.h.mesh.castShadow = qHigh && dd < 70;
      const gy = groundY(p.x, p.z);
      p.y = gy;
      p.g.position.set(p.x, p.y, p.z); p.g.rotation.set(0, p.yaw, 0);
      const spd = Math.hypot(mvx, mvz) / Math.max(dt, 1e-4);
      p.flinch = Math.max(0, p.flinch - dt * 4);
      const mode = p.state === 'flee' ? 'scared' : spd > 3.4 ? 'run' : spd > 0.25 ? 'walk' : 'idle';
      const idle = p.state === 'stand' ? p.idleKind : null;
      animateHuman(p.h, { mode, speed: spd, gun: p.kind === 'cop', upper: p.kind === 'cop' && p.aim ? 'aim' : null, flinch: p.flinch, look: 1, idle }, dt);
    }
    for (let i = peds.length - 1; i >= 0; i--) if (peds[i].recycle) { scene.remove(peds[i].g); peds.splice(i, 1); }
    // re-population
    let nPed = 0; for (const p of peds) if (p.kind === 'ped' && !p.dead) nPed++;
    if (nPed < 78) { const p = makePed('ped'); placePed(p, 40, 160); }
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
    if (cine && cine.c === c) cancelCine();
    if (c.driver) c.driver.g.visible = false;
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
    const seen = new Set();
    for (let s = 0; s <= maxT; s += 15) {
      const arr = rectsAt(ox + dx * s, oz + dz * s);
      if (seen.has(arr)) continue; seen.add(arr);
      for (const q of arr) { const t = rayBox(ox, oy, oz, dx, dy, dz, q.x0, q.x1, 0, q.h + 0.18, q.z0, q.z1); if (t < best.t) best = { t, type: 'wall', ent: null }; }
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
    if (!(firing || keys.fire) || P.fireT > 0 || P.mode !== 'foot' || state !== 'play' || cine) return;
    const w = WEAPONS[P.weapon];
    aimT = 2.5; P.fireT = w.rate;
    if (w.melee) {
      let best = null, bd = 2.4;
      for (const p of peds) {
        if (p.dead) continue;
        const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
        if (d < bd && dx * Math.sin(camYaw) + dz * Math.cos(camYaw) > 0) { bd = d; best = p; }
      }
      P.punch = 0.35; snd(160, 0.06, 'square');
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
    snd(w.auto ? 260 : 190, 0.07, 'square'); P.recoil = 1;
    shake = Math.max(shake, w.pellets ? 0.25 : 0.06);
    scarePeds(P.x, P.z, 30);
    addHeat(w.pellets ? 0.8 : 0.35);
  }

  // ============================================================
  //  VÉHICULES : monter / descendre
  // ============================================================
  // ---------- Animations d'entrée / sortie / carjacking ----------
  let cine = null;
  const toWorld = (c, lx, lz) => { const s = Math.sin(c.ang), co = Math.cos(c.ang); return [c.x + co * lx + s * lz, c.z - s * lx + co * lz]; };
  const easeIO = q => q * q * (3 - 2 * q);
  function takeDriver(c) {
    const h = c.driver; c.driver = null;
    const seat = seatOf(c), S = toWorld(c, seat.x, seat.z), p = makePed('ped', h);
    p.x = S[0]; p.z = S[1]; p.yaw = c.ang; p.y2 = 0; p.state = 'cine'; p.cine = { mode: 'drive', hipY: seat.y };
    { const nb = nearestBlock(p.x, p.z); p.bi = nb.i; p.bj = nb.j; }
    return p;
  }
  function startEnter(c) {
    if (cine || state !== 'play' || P.mode !== 'foot') return;
    const jack = (c.kind === 'traffic' || c.kind === 'cop') && !!c.driver;
    if (c.kind === 'traffic' || c.kind === 'cop') { addHeat(c.kind === 'cop' ? 30 : 16); toast('Carjacking !', '#ff5555'); }
    c.speed = 0; c.kind = 'parked'; c.ai = null; c.direct = false; c.revT = 0;
    ensureDoor(c);
    cine = { type: 'enter', c, t: 0, dur: jack ? 1.8 : 1.0, jack, fx: P.x, fz: P.z, victim: null, released: false };
    P.vx = P.vz = 0; firing = false; heist = null; snd(300, 0.06, 'square');
  }
  const enterCar = startEnter;
  function startExit() {
    const c = P.car; if (!c || cine || state !== 'play') return;
    if (Math.abs(c.speed) > 9) { toast('Ralentis pour descendre', '#ffd23f'); return; }
    c.kind = 'parked'; ensureDoor(c);
    const seat = seatOf(c), S = toWorld(c, seat.x, seat.z);
    c.g.remove(pm.g); scene.add(pm.g); pm.g.scale.set(1, 1, 1);
    P.x = S[0]; P.z = S[1]; P.y = 0; P.yaw = c.ang; P.mode = 'foot'; P.car = null; P.vx = P.vz = 0;
    pm.g.position.set(P.x, P.y, P.z); pm.g.rotation.set(0, P.yaw, 0);
    cine = { type: 'exit', c, t: 0, dur: 0.95 };
  }
  function cancelCine() {
    if (!cine) return;
    const k = cine; cine = null;
    setDoor(k.c, 0);
    if (k.victim && !k.released) { k.released = true; k.victim.state = 'flee'; k.victim.t = 6; k.victim.cine = null; k.victim.fx = 1; k.victim.fz = 0; }
    if (pm.g.parent === k.c.g) { k.c.g.remove(pm.g); scene.add(pm.g); pm.g.scale.set(1, 1, 1); }
  }
  function finishEnter() {
    const c = cine.c; cine = null;
    scene.remove(pm.g); c.g.add(pm.g);
    const seat = seatOf(c);
    pm.g.position.set(seat.x, 0, seat.z); pm.g.rotation.set(0, 0, 0); pm.g.scale.set(0.95, 0.95, 0.95); pm.g.visible = true;
    c.kind = 'player'; P.mode = 'car'; P.car = c; P.vx = P.vz = 0; camYaw = c.ang; setDoor(c, 0);
  }
  function updateCine(dt) {
    const k = cine, c = k.c, hw = c.st.W / 2, seat = seatOf(c);
    k.t += dt;
    const t = k.t, D = toWorld(c, hw + 0.62, seat.z + 0.2), S = toWorld(c, seat.x, seat.z);
    const faceYaw = Math.atan2(-Math.cos(c.ang), Math.sin(c.ang));
    let door = 0, pose = null, y = P.y;
    if (k.type === 'enter') {
      const t0 = 0.3, t1 = k.jack ? 0.6 : 0.5, tin0 = k.jack ? 1.1 : 0.5, tin1 = k.jack ? 1.5 : 0.8;
      if (t < t0) door = 0; else if (t < t1) door = easeIO((t - t0) / (t1 - t0)); else if (t < tin1 + 0.05) door = 1; else door = 1 - easeIO((t - tin1 - 0.05) / Math.max(0.01, k.dur - tin1 - 0.05));
      if (t < t0) { const q = easeIO(t / t0); P.x = lerp(k.fx, D[0], q); P.z = lerp(k.fz, D[1], q); P.yaw += angDiff(P.yaw, faceYaw) * Math.min(1, dt * 10); y = 0.18; pose = { mode: 'walk', speed: 2.2 }; }
      else if (t < tin0) { P.x = D[0]; P.z = D[1]; P.yaw += angDiff(P.yaw, faceYaw) * Math.min(1, dt * 12); y = 0.18; pose = { mode: 'idle', upper: k.jack ? 'grab' : 'reach' }; }
      else if (t < tin1) { const q = easeIO((t - tin0) / (tin1 - tin0)); P.x = lerp(D[0], S[0], q); P.z = lerp(D[1], S[1], q); P.yaw += angDiff(P.yaw, c.ang) * Math.min(1, dt * 10); y = lerp(0.18, 0, q); pose = { mode: 'drive', hipY: lerp(0.95, seat.y, q) }; }
      else { P.x = S[0]; P.z = S[1]; P.yaw = c.ang; y = 0; pose = { mode: 'drive', hipY: seat.y }; }
      if (k.jack && c.driver && t >= 0.5 && !k.victim) k.victim = takeDriver(c);
      if (k.victim && !k.released) {
        const v = k.victim, q = clamp((t - 0.5) / 0.6, 0, 1), e = easeIO(q), out = toWorld(c, hw + 1.1, seat.z + 0.2);
        v.x = lerp(S[0], out[0], e); v.z = lerp(S[1], out[1], e); v.y2 = lerp(0, 0.18, e);
        v.yaw += angDiff(v.yaw, faceYaw + Math.PI) * Math.min(1, dt * 8);
        v.cine = { mode: q < 1 ? 'yank' : 'idle', hipY: lerp(seat.y, 0.95, e) };
        if (q >= 1) {
          k.released = true; v.state = 'flee'; v.t = 7; v.cine = null; v.y2 = 0.18;
          const dx = out[0] - c.x, dz = out[1] - c.z, l = Math.hypot(dx, dz) || 1; v.fx = dx / l; v.fz = dz / l; snd(140, 0.1, 'square');
        }
      }
    } else {
      const tA = 0.25, tB = 0.65;
      door = t < tA ? easeIO(t / tA) : t < tB ? 1 : 1 - easeIO((t - tB) / (k.dur - tB));
      if (t < tA) { P.x = S[0]; P.z = S[1]; y = 0; pose = { mode: 'drive', hipY: seat.y }; }
      else if (t < tB) { const q = easeIO((t - tA) / (tB - tA)); P.x = lerp(S[0], D[0], q); P.z = lerp(S[1], D[1], q); P.yaw += angDiff(P.yaw, faceYaw) * Math.min(1, dt * 10); y = lerp(0, 0.18, q); pose = { mode: q < 0.5 ? 'drive' : 'idle', hipY: lerp(seat.y, 0.95, q) }; }
      else { P.x = D[0]; P.z = D[1]; y = 0.18; pose = { mode: 'idle' }; }
    }
    P.y = y;
    pm.g.position.set(P.x, P.y, P.z); pm.g.rotation.set(0, P.yaw, 0);
    animateHuman(pm, Object.assign({ gun: false }, pose), dt);
    setDoor(c, door);
    if (t >= k.dur) { if (k.type === 'enter') finishEnter(); else { cine = null; setDoor(c, 0); P.y = groundY(P.x, P.z); } }
  }
  function leaveCar() {
    const c = P.car; if (!c) return;
    const lx = Math.cos(c.ang), lz = -Math.sin(c.ang), fx = Math.sin(c.ang), fz = Math.cos(c.ang);
    const tries = [[lx, lz, 2.4], [-lx, -lz, 2.4], [-fx, -fz, 3.4], [fx, fz, 3.4]];
    let px = c.x + lx * 2.4, pz = c.z + lz * 2.4;
    for (const t of tries) { const x = c.x + t[0] * t[2], z = c.z + t[1] * t[2]; if (!pushCircle(x, z, 0.5)) { px = x; pz = z; break; } }
    P.x = px; P.z = pz; P.y = groundY(px, pz); P.mode = 'foot'; P.vx = P.vz = 0; P.car = null;
    if (c.kind === 'player') c.kind = 'parked';
    if (pm.g.parent === c.g) { c.g.remove(pm.g); scene.add(pm.g); pm.g.scale.set(1, 1, 1); }
    pm.g.visible = true; pm.g.position.set(P.x, P.y, P.z); setDoor(c, 0);
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
    if (P.mode === 'car') { startExit(); return; }
    if (curMarker) {
      if (curMarker.type === 'heist') startHeist(curMarker);
      else if (curMarker.type === 'shop') openShop();
      return;
    }
    const c = nearestCar(3.8);
    if (c) startEnter(c);
  }
  function cycleWeapon(dir) {
    const avail = WORDER.filter(k => own[k]);
    let i = avail.indexOf(P.weapon); i = (i + dir + avail.length) % avail.length;
    P.weapon = avail[i];
  }
  function updatePlayer(dt) {
    P.hurtT = Math.max(0, P.hurtT - dt); aimT -= dt; P.punch = Math.max(0, (P.punch || 0) - dt);
    if (aimHold && P.mode === 'foot' && !cine) aimT = Math.max(aimT, 0.25);
    if (cine) { pressed.act = false; pressed.jump = false; pressed.wpn = false; updateCine(dt); return; }
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
  function updatePlayerMesh(dt) {
    dt = dt || 0.016;
    const g = pm.g, w = WEAPONS[P.weapon], armed = !w.melee;
    P.recoil = Math.max(0, (P.recoil || 0) - dt * 6);
    if (cine) return;
    if (P.mode === 'car' && P.car) {
      const c = P.car, seat = seatOf(c);
      animateHuman(pm, { mode: 'drive', hipY: seat.y, steer: c.steerVis, gas: keys.up, speed: 0 }, dt);
      return;
    }
    if (state !== 'play') {
      const q = clamp((3.4 - stateT) / 0.5, 0, 1), e = q * q * (3 - 2 * q);
      animateHuman(pm, { mode: 'dead', speed: 0 }, dt);
      g.position.set(P.x, lerp(P.y, 0.22, e), P.z); g.rotation.set(-Math.PI / 2 * e, P.yaw, 0);
      return;
    }
    const sp = Math.hypot(P.vx, P.vz), air = P.y > groundY(P.x, P.z) + 0.08;
    const mode = air ? 'jump' : sp > 3.6 ? 'run' : sp > 0.3 ? 'walk' : 'idle';
    const upper = P.punch > 0 ? 'punch' : (armed && aimT > 0 ? 'aim' : null);
    animateHuman(pm, { mode, speed: sp, gun: armed, upper, punch: 1 - P.punch / 0.35, recoil: P.recoil, flinch: P.hurtT > 0 ? P.hurtT * 3 : 0 }, dt);
    g.position.set(P.x, P.y, P.z); g.rotation.set(0, P.yaw, 0);
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
          c.steerVis = lerp(c.steerVis, steer, Math.min(1, dt * 8));
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
    for (const c of cars) {
      const d2 = (c.x - P.x) * (c.x - P.x) + (c.z - P.z) * (c.z - P.z);
      c.g.visible = d2 < 62500 || c.kind === 'player';
      if (d2 < 14400 && dt > 0) {
        const ac = (c.speed - c.lastSpeed) / dt, yr = angDiff(c.lastAng, c.ang) / dt, k = Math.min(1, dt * 6);
        c.pitch += (clamp(-ac * 0.0035, -0.06, 0.06) - c.pitch) * k;
        c.roll += (clamp(yr * c.speed * 0.0045, -0.07, 0.07) - c.roll) * k;
      }
      c.lastSpeed = c.speed; c.lastAng = c.ang;
      c.g.position.set(c.x, 0, c.z); c.g.rotation.set(c.pitch, c.ang, c.roll);
    }
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
      const i = rint(0, NX), j = rint(0, NZ), d = Math.hypot(XS[i] - P.x, ZS[j] - P.z);
      if (d < 110 || d > 260) continue;
      const ds = validDirs(i, j); if (!ds.length) continue;
      const c = makeCar('police', 0, 0, 0, 'cop'), dd = pick(ds);
      placeOnRoad(c, i, j, dd, R(0.2, 0.6) * segLen(i, j, dd)); c.speed = 8;
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
    heist = null; cancelCine();
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
  //  POST-TRAITEMENT HDR : MSAA, bloom, étalonnage ciné, flou de vitesse
  // ============================================================
  let post = null;
  function initPost() {
    if (!qHigh) return null;
    try {
      if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) return null;
      const W = 960, H = 540;
      const opt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      const sceneRT = new THREE.WebGLMultisampleRenderTarget(W, H, opt); sceneRT.samples = 4;
      const mk = (w, h) => new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), Object.assign({ depthBuffer: false }, opt));
      const b1 = mk(W >> 2, H >> 2), b2 = mk(W >> 2, H >> 2), c1 = mk(W >> 3, H >> 3), c2 = mk(W >> 3, H >> 3);
      const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      const mkMat = (uniforms, fs) => { const m = new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false }); disposables.push(m); return m; };
      const bright = mkMat({ tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uThresh: { value: 1.15 } }, `
        uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uThresh; varying vec2 vUv;
        vec3 f(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; float l = max(max(c.r, c.g), c.b); float k = max(l - uThresh, 0.0) / (l + 0.0001); return c * k; }
        void main(){ vec3 a = f(vUv + uTexel * vec2(-1.5, -1.5)) + f(vUv + uTexel * vec2(1.5, -1.5)) + f(vUv + uTexel * vec2(-1.5, 1.5)) + f(vUv + uTexel * vec2(1.5, 1.5));
          gl_FragColor = vec4(min(a * 0.25, vec3(8.0)), 1.0); }`);
      const blur = mkMat({ tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } }, `
        uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
          c += (texture2D(tDiffuse, vUv + uDir * 1.3846).rgb + texture2D(tDiffuse, vUv - uDir * 1.3846).rgb) * 0.3162162;
          c += (texture2D(tDiffuse, vUv + uDir * 3.2308).rgb + texture2D(tDiffuse, vUv - uDir * 3.2308).rgb) * 0.0702702;
          gl_FragColor = vec4(c, 1.0); }`);
      const comp = mkMat({
        tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, uBloom: { value: 0.6 }, uTime: { value: 0 }, uBlur: { value: 0 },
        uAspect: { value: 16 / 9 }, uExposure: { value: 1.1 }, uVig: { value: 0.5 }, uGrain: { value: 0.016 }, uSat: { value: 1.12 }, uHurt: { value: 0 }, uWet: { value: 0 }
      }, `
        uniform sampler2D tScene, tB1, tB2; uniform float uBloom, uTime, uBlur, uAspect, uExposure, uVig, uGrain, uSat, uHurt, uWet; varying vec2 vUv;
        vec3 RRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 aces(vec3 c){
          mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
          mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
          c *= uExposure / 0.6; c = inM * c; c = RRT(c); c = outM * c; return clamp(c, 0.0, 1.0); }
        void main(){
          vec2 uv = vUv, d = uv - 0.5; float r2 = dot(d, d);
          vec3 col;
          if (uBlur > 0.02) {
            vec3 acc = vec3(0.0);
            for (int i = 0; i < 9; i++) { float t = float(i) / 8.0; acc += texture2D(tScene, 0.5 + d * (1.0 - uBlur * 0.09 * t)).rgb; }
            col = acc / 9.0;
          } else {
            float ca = 0.0016 * r2 * 4.0;
            col = vec3(texture2D(tScene, uv + d * ca).r, texture2D(tScene, uv).g, texture2D(tScene, uv - d * ca).b);
          }
          col += (texture2D(tB1, uv).rgb * 0.5 + texture2D(tB2, uv).rgb * 0.6) * uBloom;
          col = aces(col);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat * (1.0 - uWet * 0.12));
          col = mix(col * vec3(0.95, 1.0, 1.05), col * vec3(1.05, 1.0, 0.94), smoothstep(0.25, 0.85, l));
          col = (col - 0.5) * 1.1 + 0.5;
          float vg = smoothstep(0.95, 0.2, length(d * vec2(uAspect, 1.0) * 0.85));
          col *= mix(1.0, vg, uVig);
          col = mix(col, vec3(0.75, 0.04, 0.04), uHurt * (1.0 - vg * 0.7) * 0.7);
          float g = fract(sin(dot(uv * vec2(1920.0, 1080.0) + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
          col += (g - 0.5) * uGrain;
          gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
        }`);
      const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright); quad.frustumCulled = false; qs.add(quad);
      disposables.push(quad.geometry, sceneRT, b1, b2, c1, c2);
      let W0 = W, H0 = H;
      const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qs, qc); };
      const p = {
        u: comp.uniforms,
        resize(w, h) { W0 = w; H0 = h; sceneRT.setSize(w, h); b1.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2)); b2.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2)); c1.setSize(Math.max(2, w >> 3), Math.max(2, h >> 3)); c2.setSize(Math.max(2, w >> 3), Math.max(2, h >> 3)); bright.uniforms.uTexel.value.set(1 / w, 1 / h); comp.uniforms.uAspect.value = w / h; },
        render() {
          renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
          bright.uniforms.tDiffuse.value = sceneRT.texture; pass(bright, b1);
          blur.uniforms.tDiffuse.value = b1.texture; blur.uniforms.uDir.value.set(1 / (W0 >> 2), 0); pass(blur, b2);
          blur.uniforms.tDiffuse.value = b2.texture; blur.uniforms.uDir.value.set(0, 1 / (H0 >> 2)); pass(blur, b1);
          blur.uniforms.tDiffuse.value = b1.texture; blur.uniforms.uDir.value.set(1 / (W0 >> 2), 0); pass(blur, c1);
          blur.uniforms.tDiffuse.value = c1.texture; blur.uniforms.uDir.value.set(0, 1 / (H0 >> 3)); pass(blur, c2);
          comp.uniforms.tScene.value = sceneRT.texture; comp.uniforms.tB1.value = b1.texture; comp.uniforms.tB2.value = c2.texture;
          pass(comp, null);
        },
        dispose() { try { sceneRT.dispose(); b1.dispose(); b2.dispose(); c1.dispose(); c2.dispose(); } catch (e) {} }
      };
      renderer.toneMapping = THREE.NoToneMapping;
      skyMat.uniforms.uLinear.value = 1;
      return p;
    } catch (e) { console.warn('[GTA] post-traitement indisponible', e); renderer.toneMapping = THREE.ACESFilmicToneMapping; skyMat.uniforms.uLinear.value = 0; return null; }
  }
  function disablePost() {
    try { if (post) post.dispose(); } catch (e) {}
    post = null;
    try { renderer.setRenderTarget(null); } catch (e) {}
    renderer.toneMapping = THREE.ACESFilmicToneMapping; skyMat.uniforms.uLinear.value = 0;
  }

  // ============================================================
  //  MÉTÉO : pluie, routes mouillées, ciel couvert
  // ============================================================
  let wet = 0, wetTarget = 0, weatherT = 70 + Math.random() * 60;
  const RN = 420, rainPos = new Float32Array(RN * 3), rainGeo = new THREE.BufferGeometry();
  for (let i = 0; i < RN; i++) { rainPos[i * 3] = R(-25, 25); rainPos[i * 3 + 1] = R(0, 22); rainPos[i * 3 + 2] = R(-25, 25); }
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(RN * 6), 3));
  const rainMat = new THREE.LineBasicMaterial({ color: lin(0xc8d8e8), transparent: true, opacity: 0, depthWrite: false });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false; scene.add(rainLines);
  disposables.push(rainGeo, rainMat);
  let rainSnd = null;
  function rainStart() {
    if (rainSnd) return;
    try {
      if (typeof audioCtx === 'undefined') return;
      const len = audioCtx.sampleRate * 2, buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
      src.buffer = buf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 3200; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(audioCtx.destination); src.start(); rainSnd = { src, g };
    } catch (e) {}
  }
  function updateWeather(dt, cx, cz) {
    weatherT -= dt;
    if (weatherT <= 0) {
      wetTarget = wetTarget > 0 ? 0 : (Math.random() < 0.65 ? 1 : 0);
      weatherT = R(80, 170);
      if (wetTarget > 0) toast('☔ Il commence à pleuvoir', '#9fd3ff'); else if (wet > 0.3) toast('Le ciel se dégage', '#9fd3ff');
    }
    wet += clamp(wetTarget - wet, -dt * 0.04, dt * 0.04);
    roadMat.roughness = lerp(0.88, 0.28, wet); roadMat.metalness = lerp(0, 0.18, wet);
    walkMat.roughness = lerp(0.9, 0.45, wet);
    skyMat.uniforms.uWet.value = wet;
    scene.fog.near = lerp(160, 50, wet); scene.fog.far = lerp(760, 320, wet);
    rainMat.opacity = 0.42 * wet; rainLines.visible = wet > 0.04;
    if (wet > 0.04) {
      const a = rainGeo.attributes.position.array;
      for (let i = 0; i < RN; i++) {
        let y = rainPos[i * 3 + 1] - 26 * dt, x = rainPos[i * 3] + 3 * dt, z = rainPos[i * 3 + 2];
        if (y < 0 || Math.abs(x - cx) > 26 || Math.abs(z - cz) > 26) { x = cx + R(-25, 25); z = cz + R(-25, 25); y = R(10, 22); }
        rainPos[i * 3] = x; rainPos[i * 3 + 1] = y; rainPos[i * 3 + 2] = z;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - 0.12; a[i * 6 + 4] = y + 0.75; a[i * 6 + 5] = z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    try { if (rainSnd) { const ok = (typeof soundEnabled === 'undefined') || soundEnabled; rainSnd.g.gain.value = ok ? 0.05 * wet : 0; } } catch (e) {}
  }

  // ============================================================
  //  CIEL / JOUR-NUIT
  // ============================================================
  let lightDir = [0.4, 0.8, 0.3];
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const HZ = { day: [0.72, 0.84, 0.96], dusk: [1.0, 0.55, 0.32], night: [0.04, 0.06, 0.14] };
  const ZN = { day: [0.22, 0.46, 0.88], dusk: [0.28, 0.3, 0.55], night: [0.01, 0.015, 0.05] };
  function updateSky(dt) {
    tod = (tod + dt / 300) % 1;
    const ang = TAU * (tod - 0.25), s = Math.sin(ang);
    let sd = [Math.cos(ang) * 0.85, s, 0.35]; const sl = Math.hypot(sd[0], sd[1], sd[2]); sd = [sd[0] / sl, sd[1] / sl, sd[2] / sl];
    const day = clamp((s + 0.12) / 0.4, 0, 1), dusk = Math.max(0, 1 - Math.abs(s) / 0.3);
    const hz = mix3(mix3(HZ.night, HZ.day, day), HZ.dusk, dusk * 0.7), zn = mix3(mix3(ZN.night, ZN.day, day), ZN.dusk, dusk * 0.6);
    const u = skyMat.uniforms;
    u.uSun.value.set(sd[0], sd[1], sd[2]); u.uDay.value = day; u.uHorizon.value.set(hz[0], hz[1], hz[2]); u.uZenith.value.set(zn[0], zn[1], zn[2]); u.uTime.value = now;
    const fl = [s2l(hz[0]), s2l(hz[1]), s2l(hz[2])];
    scene.fog.color.setRGB(fl[0], fl[1], fl[2]); skyCol.setRGB(fl[0], fl[1], fl[2]);
    if (s > 0.02) {
      const w = clamp(s * 2.5, 0, 1);
      sun.color.setRGB(1, lerp(0.62, 0.95, w), lerp(0.38, 0.86, w));
      sun.intensity = 2.2 * clamp(s * 3, 0, 1);
      lightDir = [sd[0], Math.max(sd[1], 0.2), sd[2]];
    } else {
      sun.color.setRGB(0.6, 0.7, 1.0); sun.intensity = 0.8;
      lightDir = [-sd[0], Math.max(-sd[1], 0.3), -sd[2]];
    }
    hemi.intensity = 0.34 + 0.5 * day;
    const em = clamp(1 - day * 1.5, 0, 1);
    for (const m of envMats) m.envMapIntensity = 0.3 + 0.4 * day;
    for (const k in facade) facade[k].mat.emissive.setRGB(em, em * 0.9, em * 0.7);
    shopMat.emissive.setRGB(em * 1.1, em, em * 0.8); litMat.emissiveIntensity = em * 1.4;
    glowMat.opacity = em * 0.5;
    const lc = 0.3 + 0.7 * em; lampMat.color.setRGB(lc, lc, lc);
    renderer.toneMappingExposure = 0.9 + 0.5 * em;
    sun.intensity *= (1 - wet * 0.65); hemi.intensity *= (1 - wet * 0.2);
    const hdr = post ? 1 : 0;
    lampMat.color.setRGB(lc * (1 + 0.8 * em * hdr), lc * (1 + 0.8 * em * hdr), lc * (1 + 0.8 * em * hdr));
    const lg = 1 + 0.6 * em * hdr; lightMat.color.setRGB(lg, lg, lg);
    nightK = em;
  }
  let nightK = 0;
  const hlights = [];
  for (let k = 0; k < 2; k++) {
    const sl = new THREE.SpotLight(0xfff0d0, 0, 45, 0.45, 0.85, 1.6);
    scene.add(sl); scene.add(sl.target); hlights.push(sl);
  }
  function afterCamera() {
    skyMesh.position.set(camPos[0], camPos[1], camPos[2]);
    sun.position.set(P.x + lightDir[0] * 160, lightDir[1] * 160, P.z + lightDir[2] * 160);
    sun.target.position.set(P.x, 0, P.z);
    const c = (P.mode === 'car' && P.car && state === 'play') ? P.car : null;
    for (let k = 0; k < 2; k++) {
      const sl = hlights[k];
      if (!c || nightK < 0.05) { sl.intensity = 0; continue; }
      const sx = k ? 1 : -1, s = Math.sin(c.ang), co = Math.cos(c.ang);
      const px = c.x + s * 2.0 + co * sx * 0.6, pz = c.z + co * 2.0 - s * sx * 0.6;
      sl.intensity = 2.6 * nightK; sl.position.set(px, 0.8, pz); sl.target.position.set(px + s * 24, 0, pz + co * 24);
    }
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
    const car = P.mode === 'car' ? P.car : null, aim = !car && !cine && (aimHold || aimT > 0.05);
    let tx = P.x, tz = P.z;
    const ty = car ? 1.5 : P.y + 1.5;
    const dist = car ? 8.2 + Math.min(Math.abs(car.speed) * 0.05, 2.2) : (aim ? 1.9 : 3.4);
    camSO += ((car ? 0 : (aim ? 0.78 : 0.52)) - camSO) * Math.min(1, dt * 8);
    tx += -Math.cos(camYaw) * camSO; tz += Math.sin(camYaw) * camSO;
    if (car && now - lastLook > 1.5 && Math.abs(car.speed) > 2) {
      camYaw += angDiff(camYaw, car.ang + (car.speed < -1 ? Math.PI : 0)) * Math.min(1, dt * 2.5);
      camPitch += (0.2 - camPitch) * Math.min(1, dt * 1.5);
    }
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const dx = -Math.sin(camYaw) * cp, dz = -Math.cos(camYaw) * cp, dy = sp;
    let d = dist;
    for (let s = 1; s <= 10; s++) {
      const t = dist * s / 10;
      if (camBlocked(tx + dx * t, ty + dy * t, tz + dz * t) || ty + dy * t < 0.5) { d = Math.max(0.9, t - dist * 0.15); break; }
    }
    camD = d < camD ? d : lerp(camD, d, Math.min(1, dt * 4));
    shake = Math.max(0, shake - dt * 1.6);
    const ox = (Math.random() - 0.5) * shake * 0.6, oy = (Math.random() - 0.5) * shake * 0.6;
    camPos = [tx + dx * camD + ox, Math.max(0.6, ty + dy * camD + oy), tz + dz * camD];
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    camera.lookAt(tx, ty, tz);
    const vx = tx - camPos[0], vy = ty - camPos[1], vz = tz - camPos[2], vl = Math.hypot(vx, vy, vz) || 1;
    camDir = [vx / vl, vy / vl, vz / vl];
    const fov = car ? 65 + Math.min(Math.abs(car.speed), 40) * 0.4 : (aim ? 46 : 58);
    if (Math.abs(camera.fov - fov) > 0.15) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 6)); camera.updateProjectionMatrix(); }
  }

  // ============================================================
  //  HUD
  // ============================================================
  const styleEl = document.createElement('style'); styleEl.id = 'gta-style';
  styleEl.textContent = `
  .gta-hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-family:'Rajdhani',sans-serif;text-shadow:0 1px 3px #000;user-select:none;-webkit-user-select:none}
  .gta-hud button{pointer-events:auto;font-family:'Rajdhani',sans-serif;cursor:pointer}
  .g-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 58%,rgba(0,0,0,.42) 100%)}
  .g-start .g-q{margin-top:8px;font-size:10px;padding:7px 12px;border-color:#888;color:#bbb}
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
  const helpDesktop = '<p><b>ZQSD / flèches</b> : bouger ou conduire &nbsp;·&nbsp; <b>Souris</b> : caméra &nbsp;·&nbsp; <b>Clic / X</b> : tirer &nbsp;·&nbsp; <b>Clic droit</b> : viser</p><p><b>E</b> : monter / descendre, braquer, acheter &nbsp;·&nbsp; <b>Maj</b> : courir &nbsp;·&nbsp; <b>Espace</b> : sauter / frein à main</p><p><b>1-4</b> ou <b>R</b> : armes &nbsp;·&nbsp; <b>H</b> : klaxon &nbsp;·&nbsp; <b>Échap</b> : libérer la souris</p>';
  const helpTouch = '<p>Joystick à gauche : bouger / conduire. Glisse à droite : caméra.</p><p>🔫 tirer · E : monter, braquer, acheter · ⤒ sauter / frein · 🔁 arme</p>';
  hud.innerHTML = '<div class="g-vig"></div><canvas class="g-map" width="132" height="132"></canvas>' +
    '<div class="g-money">$<span class="v-money">0</span></div><div class="g-toasts"></div>' +
    '<div class="g-top"><div class="g-stars"></div><div class="g-weapon"></div></div>' +
    '<div class="g-bars"><div class="g-bar hp"><i></i></div><div class="g-bar ar"><i></i></div></div>' +
    '<div class="g-speed"></div><div class="g-cross"></div><div class="g-prompt"></div>' +
    '<div class="g-prog"><span></span><i></i></div><div class="g-big"></div>' +
    '<button class="g-fs" title="Plein écran">⛶</button><div class="g-shop"></div>' +
    '<div class="g-start"><h2>ARBEST CITY</h2><p>Ville ouverte : vole des voitures, braque la banque et les magasins, fuis la police. Gagne un maximum d\'argent !</p>' +
    (isTouch ? helpTouch : helpDesktop) + '<button class="g-go">JOUER</button><button class="g-q">GRAPHISMES : ' + (qHigh ? 'ÉLEVÉS' : 'NORMAUX') + '</button></div>';
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
    for (let i = 0; i <= NX; i++) { g.fillStyle = RW[i] >= 36 ? '#b9a27a' : '#8d939c'; g.fillRect(XS[i] - RW[i] / 2, -HALF - RW[0] / 2, RW[i], 2 * HALF + RW[0]); }
    for (let j = 0; j <= NZ; j++) { g.fillStyle = RW[j] >= 36 ? '#b9a27a' : '#8d939c'; g.fillRect(-HALF - RW[0] / 2, ZS[j] - RW[j] / 2, 2 * HALF + RW[0], RW[j]); }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const bl = BL[i][j];
      if (Math.abs(bl.cx - P.x) > 230 || Math.abs(bl.cz - P.z) > 230) continue;
      g.fillStyle = bl.type === 'park' ? '#3e7a3a' : bl.type === 'suburb' ? '#5a6a52' : bl.type === 'industrial' ? '#6a5f55' : '#51565e';
      g.fillRect(bl.x0, bl.z0, 2 * bl.hx, 2 * bl.hz);
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
    setD(H.cross, 'cross', (!inCar && !w.melee && state === 'play' && started && !cine && (aimHold || aimT > 0)) ? 'block' : 'none');
    // invite contextuelle
    let pr = '';
    if (state === 'play' && !cine) {
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
    if (e.button === 0) firing = true; else if (e.button === 2) aimHold = true;
  }
  function onMouseUp(e) { if (e.button === 0) firing = false; if (e.button === 2) aimHold = false; }
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
    engineStart(); rainStart();
    if (!isTouch && !noLock && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  }
  function showPause() {
    H.start.querySelector('h2').textContent = 'PAUSE';
    H.start.querySelector('.g-go').textContent = 'REPRENDRE';
    H.start.style.display = 'flex';
  }
  H.start.querySelector('.g-go').addEventListener('click', begin);
  H.start.querySelector('.g-q').addEventListener('click', () => {
    try { localStorage.setItem('gta_q', qHigh ? 'low' : 'high'); } catch (e) {}
    const f = window._gtaCleanup; if (typeof f === 'function') f();
    startGTAGame();
  });
  q('.g-fs').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (container.requestFullscreen) container.requestFullscreen();
  });
  function setSize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (post) post.resize(w, h); }
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
  document.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onMouseDown); canvas.addEventListener('contextmenu', e => e.preventDefault()); window.addEventListener('mouseup', onMouseUp);
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
    updateWeather(dt, camPos[0], camPos[2]);
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
    updatePlayerMesh(dt);
    updateCamera(dt);
    updateDetail();
    afterCamera();
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
    else { updatePlayerMesh(dt); updateCamera(0.016); afterCamera(); updateHud(); engineUpdate(false); }
    drawMap();
    if (post) {
      try {
        const u = post.u, inCar = P.mode === 'car' && P.car;
        u.uTime.value = now; u.uExposure.value = renderer.toneMappingExposure; u.uWet.value = wet;
        u.uBlur.value = inCar ? clamp((Math.abs(P.car.speed) - 22) / 22, 0, 1) : 0;
        u.uBloom.value = 0.3 + 0.05 * nightK; u.uHurt.value = P.hurtT > 0 ? clamp(P.hurtT * 4, 0, 1) : 0;
        post.render();
      } catch (e) { console.warn('[GTA] post-traitement désactivé', e); disablePost(); renderer.render(scene, camera); }
    } else renderer.render(scene, camera);
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
    try { if (scanEl) scanEl.style.display = scanPrev; } catch (e) {}
    try { if (hud && hud.parentNode) hud.parentNode.removeChild(hud); if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); } catch (e) {}
    try { for (const d of disposables) if (d && d.dispose) d.dispose(); } catch (e) {}
    try { disposeDetail(); } catch (e) {}
    try { if (post) post.dispose(); } catch (e) {}
    try { if (rainSnd) { rainSnd.g.gain.value = 0; rainSnd.src.stop(); rainSnd = null; } } catch (e) {}
    try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    const fresh = document.createElement('canvas');
    fresh.id = 'game-canvas'; fresh.width = 600; fresh.height = 400;
    if (canvas.parentNode) canvas.parentNode.replaceChild(fresh, canvas);
    container.style.maxWidth = ''; container.style.width = ''; container.style.height = ''; container.style.border = ''; container.style.borderRadius = '';
    window._gtaCleanup = null;
  };

  // ---------- Lancement ----------
  post = initPost();
  if (post) { const v = hud.querySelector('.g-vig'); if (v) v.style.display = 'none'; }
  setTimeout(() => toast('Ta voiture de sport est garée juste à côté — E pour monter', '#7fe8ff'), 400);
  loopId = requestAnimationFrame(frame);
  try { currentGameLoop = loopId; } catch (e) {}
}