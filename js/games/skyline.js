// ============================================================
// SKYLINE RUSH — runner 3D moderne (Three.js)
//
//  • monde courbe façon "planète" (shader), brouillard atmosphérique
//  • cycle aube → plein jour → crépuscule → nuit (ville qui s'allume)
//  • héros animé : course, saut, glissade, jetpack, tenues débloquables
//  • obstacles variés : barrières (sauter), portiques (glisser), conteneurs (esquiver)
//  • power-ups : aimant, bouclier, score ×2, JET (vol au-dessus de tout)
//  • missions, boutique d'améliorations, tenues — progression sauvegardée
//  • contrôles : glisser le doigt / flèches / ZQSD ; qualité auto-adaptative
//
// Dépend de Three.js (déjà utilisé par Cybercraft). Aucune autre librairie.
// ============================================================
function startSkylineGame() {
  if (window.GameMobile) GameMobile.reset();
  if (window._skyCleanup) window._skyCleanup();
  if (typeof THREE === 'undefined') { console.error('[Skyline Rush] Three.js est introuvable'); return; }

  let canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const memBoard = document.getElementById('memory-board');
  if (memBoard) memBoard.classList.add('hidden');
  canvas.classList.remove('hidden');
  if (canvas.__ctxKind === '2d' && canvas.parentNode) {            // canvas déjà utilisé en 2D par un autre jeu
    const n = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(n, canvas);
    canvas = n;
  }
  const container = canvas.parentElement;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  // ---------- utilitaires ----------
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const IS_TOUCH = !!(window.GameMobile && GameMobile.isTouch);
  const LI = parseInt(THREE.REVISION, 10) >= 155 ? Math.PI : 1;     // intensité des lumières selon la version de Three

  let lastSnd = {};
  const snd = (key, f, d, t) => {
    const now = performance.now();
    if (typeof playSound !== 'function' || now - (lastSnd[key] || 0) < 55) return;
    lastSnd[key] = now;
    playSound(f, d, t);
  };

  // ---------- données de jeu ----------
  const SAVE_KEY = 'skyline_rush_v1';
  const LANE_W = 2.4;
  const LANES = [-LANE_W, 0, LANE_W];

  const SKINS = [
    { name: 'AURORE', main: '#f4f6ff', accent: '#ff7a3d', cost: 0 },
    { name: 'OCÉAN',  main: '#e6f8ff', accent: '#18b4ff', cost: 400 },
    { name: 'JADE',   main: '#e8fff2', accent: '#18d68c', cost: 1200 },
    { name: 'ONYX',   main: '#2b2f3f', accent: '#c58bff', cost: 3000 }
  ];
  const UPGRADES = [
    { id: 'magnet', name: 'Aimant',          desc: 'Durée +2 s par niveau',      max: 5, base: 250 },
    { id: 'double', name: 'Score ×2',        desc: 'Durée +2 s par niveau',      max: 5, base: 250 },
    { id: 'jet',    name: 'Jetpack',         desc: 'Durée +1 s par niveau',      max: 5, base: 400 },
    { id: 'shield', name: 'Bouclier de départ', desc: 'Tu démarres protégé',     max: 1, base: 1500 }
  ];
  const MISSION_POOL = [
    { stat: 'distance', targets: [800, 1500, 2500, 4000], text: t => `Cours ${t} m en une partie` },
    { stat: 'coins',    targets: [60, 120, 200, 320],     text: t => `Ramasse ${t} pièces en une partie` },
    { stat: 'jumps',    targets: [15, 30, 50],            text: t => `Saute ${t} fois en une partie` },
    { stat: 'slides',   targets: [10, 20, 35],            text: t => `Glisse ${t} fois en une partie` },
    { stat: 'powerups', targets: [3, 5, 8],               text: t => `Attrape ${t} power-ups en une partie` },
    { stat: 'score',    targets: [3000, 8000, 15000],     text: t => `Fais ${t} points en une partie` }
  ];
  function newMission(existing) {
    const used = new Set(existing.map(m => m.stat));
    const pool = MISSION_POOL.filter(p => !used.has(p.stat));
    const p = pick(pool.length ? pool : MISSION_POOL);
    const ti = randi(0, p.targets.length - 1);
    return { stat: p.stat, target: p.targets[ti], reward: 120 + ti * 110, done: false };
  }
  const missionText = m => MISSION_POOL.find(p => p.stat === m.stat).text(m.target);

  function loadSave() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { s = {}; }
    const d = { coins: 0, best: 0, runs: 0, skin: 0, owned: [true, false, false, false], upg: { magnet: 0, double: 0, jet: 0, shield: 0 }, missions: null, tuto: false };
    const o = Object.assign(d, s);
    o.upg = Object.assign({ magnet: 0, double: 0, jet: 0, shield: 0 }, s.upg || {});
    if (!Array.isArray(o.owned) || o.owned.length < SKINS.length) o.owned = d.owned;
    if (!Array.isArray(o.missions) || o.missions.length < 3) {
      o.missions = [];
      while (o.missions.length < 3) o.missions.push(newMission(o.missions));
    }
    return o;
  }
  const SV = loadSave();
  const saveGame = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) { /* ignore */ } };
  const upgCost = u => Math.round(u.base * Math.pow(SV.upg[u.id] + 1, 1.6));

  // ---------- ambiances (aube, jour, crépuscule, nuit) ----------
  const C = h => new THREE.Color(h);
  const PAL = [
    { name: 'AUBE',        top: C('#34418f'), bot: C('#ffb28a'), sun: C('#ffd9a8'), hemiS: C('#ffd9c4'), hemiG: C('#4c4460'), ground: C('#3c3a58'), build: C('#a9b0d4'), light: 1.0,  night: 0, city: true,  sunS: 150 },
    { name: 'PLEIN JOUR',  top: C('#2878e6'), bot: C('#c6e7ff'), sun: C('#fff6dc'), hemiS: C('#e8f4ff'), hemiG: C('#628f50'), ground: C('#5aa34f'), build: C('#d2deee'), light: 1.15, night: 0, city: false, sunS: 120 },
    { name: 'CRÉPUSCULE',  top: C('#2c1a58'), bot: C('#ff7a5e'), sun: C('#ff9362'), hemiS: C('#ffb59a'), hemiG: C('#3a2a50'), ground: C('#2f2849'), build: C('#a592c6'), light: 0.92, night: 0, city: true,  sunS: 190 },
    { name: 'NUIT',        top: C('#03061a'), bot: C('#18244f'), sun: C('#d2e2ff'), hemiS: C('#7088cc'), hemiG: C('#151b37'), ground: C('#0d1227'), build: C('#7580b4'), light: 0.82, night: 1, city: true,  sunS: 70 }
  ];
  const BIOME_LEN = 1100, BIOME_FADE = 240;
  const cur = { top: new THREE.Color(), bot: new THREE.Color(), sun: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), ground: new THREE.Color(), build: new THREE.Color(), light: 1, night: 0, sunS: 100, name: '', idx: 0 };
  function paletteAt(dist) {
    const d = Math.max(0, dist);
    const idx = Math.floor(d / BIOME_LEN) % PAL.length, nxt = (idx + 1) % PAL.length, within = d % BIOME_LEN;
    const f = within > BIOME_LEN - BIOME_FADE ? smooth((within - (BIOME_LEN - BIOME_FADE)) / BIOME_FADE) : 0;
    const a = PAL[idx], b = PAL[nxt];
    ['top', 'bot', 'sun', 'hemiS', 'hemiG', 'ground', 'build'].forEach(k => cur[k].copy(a[k]).lerp(b[k], f));
    cur.light = lerp(a.light, b.light, f);
    cur.night = lerp(a.night, b.night, f);
    cur.sunS = lerp(a.sunS, b.sunS, f);
    cur.name = f > 0.5 ? b.name : a.name;
    cur.idx = f > 0.5 ? nxt : idx;
  }
  const biomeCity = dist => PAL[Math.floor(Math.max(0, dist) / BIOME_LEN) % PAL.length].city;

  // ---------- rendu ----------
  let renderer;
  const makeRenderer = cv => new THREE.WebGLRenderer({ canvas: cv, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
  try { renderer = makeRenderer(canvas); }
  catch (e) {
    try {
      const n = canvas.cloneNode(false);
      canvas.parentNode.replaceChild(n, canvas);
      canvas = n;
      renderer = makeRenderer(canvas);
    } catch (e2) {
      container.insertAdjacentHTML('beforeend', '<div style="padding:20px;color:#fff;text-align:center">Ton navigateur ne gère pas WebGL : impossible de lancer ce jeu.</div>');
      return;
    }
  }
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 45, 270);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.9 * LI);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.9 * LI);
  sunLight.position.set(-30, 55, 25);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // courbure du monde (déformation dans le vertex shader)
  const bendU = { uCurveY: { value: 0.0007 }, uCurveX: { value: 0 } };
  function bend(mat) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uCurveY = bendU.uCurveY;
      sh.uniforms.uCurveX = bendU.uCurveX;
      sh.vertexShader = 'uniform float uCurveY;\nuniform float uCurveX;\n' +
        sh.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\n mvPosition.y -= uCurveY * mvPosition.z * mvPosition.z;\n mvPosition.x += uCurveX * mvPosition.z * mvPosition.z;\n gl_Position = projectionMatrix * mvPosition;');
    };
    mat.customProgramCacheKey = () => 'skybend';
    return mat;
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 16; i++) {
      const x = w * (0.2 + Math.random() * 0.6), y = h * (0.35 + Math.random() * 0.3), r = h * (0.25 + Math.random() * 0.3);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });

  // ---------- ciel, soleil, étoiles, nuages, montagnes ----------
  const SKY_R = 420;
  const skyGeo = new THREE.SphereGeometry(SKY_R, 22, 14);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);
  const tmpC = new THREE.Color();
  function paintSky() {
    const pos = skyGeo.attributes.position, col = skyGeo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const t = clamp((pos.getY(i) / SKY_R + 0.05) / 0.8, 0, 1);
      tmpC.copy(cur.bot).lerp(cur.top, Math.pow(t, 0.65));
      col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
    }
    col.needsUpdate = true;
  }

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  sunSprite.renderOrder = -9; sunSprite.frustumCulled = false;
  scene.add(sunSprite);

  const starPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * TAU, e = Math.random() * 1.25 + 0.12;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * 400; starPos[i * 3 + 1] = Math.sin(e) * 400; starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 400;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  stars.frustumCulled = false; stars.renderOrder = -9;
  scene.add(stars);

  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    const sc = rand(90, 190);
    s.scale.set(sc * 2, sc, 1);
    s.userData = { ox: rand(-330, 330), oy: rand(55, 120), oz: -rand(150, 380), v: rand(0.4, 1.4) };
    s.frustumCulled = false; s.renderOrder = -8;
    scene.add(s); clouds.push(s);
  }

  const mountains = new THREE.Group();
  const mountMat = new THREE.MeshBasicMaterial({ color: 0x334466, fog: false });
  for (let i = 0; i < 16; i++) {
    const h = rand(55, 150), m = new THREE.Mesh(new THREE.ConeGeometry(rand(50, 110), h, 5), mountMat);
    m.position.set(-420 + i * 56 + rand(-20, 20), h / 2 - 8, rand(-40, 20));
    m.rotation.y = rand(0, TAU);
    mountains.add(m);
  }
  mountains.frustumCulled = false;
  scene.add(mountains);

  // ---------- matériaux du monde ----------
  const roadTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2b2e39'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      const lit = Math.random() > 0.5;
      g.fillStyle = `rgba(${lit ? 255 : 0},${lit ? 255 : 0},${lit ? 255 : 0},${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    const u = x => w * (0.5 + x / 8.4);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(u(-3.8) - 3, 0, 6, h); g.fillRect(u(3.8) - 3, 0, 6, h);                 // lignes de rive
    g.fillStyle = 'rgba(255,255,255,0.55)';
    [-1.2, 1.2].forEach(x => { for (let k = 0; k < 2; k++) g.fillRect(u(x) - 2.5, k * h / 2 + h * 0.06, 5, h * 0.26); });
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 3);
  const roadMat = bend(new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9, metalness: 0 }));
  const groundMat = bend(new THREE.MeshStandardMaterial({ color: 0x3c3a58, roughness: 1, metalness: 0 }));
  const curbMat = bend(new THREE.MeshStandardMaterial({ color: 0xcfd3dc, roughness: 0.8 }));

  // fenêtres : 1 texture couleur (jour) + 1 texture émissive (nuit), même disposition
  const winLayout = []; for (let i = 0; i < 16; i++) winLayout.push(Math.random() < 0.55);
  const winColTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c4cad8'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = winLayout[r * 4 + c] ? '#8fb4d8' : '#58688a'; g.fillRect(c * 32 + 5, r * 32 + 6, 22, 18); }
  });
  const winEmitTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (winLayout[r * 4 + c]) { g.fillStyle = pick(['#ffe3a0', '#fff1c8', '#ffd480', '#cfe6ff']); g.fillRect(c * 32 + 5, r * 32 + 6, 22, 18); }
  });
  [winColTex, winEmitTex].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const buildMat = bend(new THREE.MeshStandardMaterial({ map: winColTex, emissiveMap: winEmitTex, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.7, metalness: 0.1 }));

  function buildingGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const su = f < 2 ? d / 4 : f < 4 ? w / 4 : w / 4;
      const sv = f < 2 ? h / 4 : f < 4 ? d / 4 : h / 4;
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
    }
    g.translate(0, h / 2, 0);
    return g;
  }
  const BUILD_GEOS = [[6, 14, 6], [8, 22, 7], [7, 32, 8], [10, 18, 9], [6, 40, 6], [9, 26, 8], [12, 12, 10]].map(a => buildingGeo(a[0], a[1], a[2]));

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1.8, 7);
  const coneGeoA = new THREE.ConeGeometry(2.1, 4.6, 8);
  const coneGeoB = new THREE.ConeGeometry(1.5, 3.8, 8);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const trunkMat = bend(new THREE.MeshStandardMaterial({ color: 0x5b3f2a, roughness: 1 }));
  const leafMat = bend(new THREE.MeshStandardMaterial({ color: 0x2f7d46, roughness: 0.9 }));
  const rockMat = bend(new THREE.MeshStandardMaterial({ color: 0x8a8f9c, roughness: 1, flatShading: true }));
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.4, 6);
  const armGeo = new THREE.BoxGeometry(1.1, 0.08, 0.08);
  const bulbGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const poleMat = bend(new THREE.MeshStandardMaterial({ color: 0x4a4f5e, roughness: 0.6, metalness: 0.5 }));
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false });
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false });

  // ---------- tronçons de monde recyclés ----------
  const ROAD_W = 8.4, CH_LEN = 30, NCH = 9, SLOTS = 4;
  const roadGeo = new THREE.PlaneGeometry(ROAD_W, CH_LEN); roadGeo.rotateX(-Math.PI / 2);
  const sideGeo = new THREE.PlaneGeometry(90, CH_LEN); sideGeo.rotateX(-Math.PI / 2);
  const curbGeo = new THREE.BoxGeometry(0.35, 0.28, CH_LEN);
  const chunks = [];
  const nofrustum = o => { o.frustumCulled = false; return o; };

  function makeChunk() {
    const g = new THREE.Group();
    g.add(nofrustum(new THREE.Mesh(roadGeo, roadMat)));
    [-1, 1].forEach(s => {
      const side = nofrustum(new THREE.Mesh(sideGeo, groundMat)); side.position.set(s * (ROAD_W / 2 + 45), -0.06, 0); g.add(side);
      const curb = nofrustum(new THREE.Mesh(curbGeo, curbMat)); curb.position.set(s * (ROAD_W / 2 + 0.17), 0.14, 0); g.add(curb);
    });
    const slots = [];
    [-1, 1].forEach(s => {
      for (let i = 0; i < SLOTS; i++) {
        const b = nofrustum(new THREE.Mesh(BUILD_GEOS[0], buildMat));
        const tree = new THREE.Group();
        const tk = nofrustum(new THREE.Mesh(trunkGeo, trunkMat)); tk.position.y = 0.9;
        const c1 = nofrustum(new THREE.Mesh(coneGeoA, leafMat)); c1.position.y = 4.0;
        const c2 = nofrustum(new THREE.Mesh(coneGeoB, leafMat)); c2.position.y = 6.2;
        tree.add(tk, c1, c2);
        const rock = nofrustum(new THREE.Mesh(rockGeo, rockMat));
        const lamp = new THREE.Group();
        const pole = nofrustum(new THREE.Mesh(poleGeo, poleMat)); pole.position.y = 2.7;
        const arm = nofrustum(new THREE.Mesh(armGeo, poleMat)); arm.position.set(-s * 0.5, 5.4, 0);
        const bulb = nofrustum(new THREE.Mesh(bulbGeo, bulbMat)); bulb.position.set(-s * 1.0, 5.25, 0);
        const halo = new THREE.Sprite(haloMat); halo.scale.set(3.2, 3.2, 1); halo.position.set(-s * 1.0, 5.25, 0); halo.frustumCulled = false;
        lamp.add(pole, arm, bulb, halo);
        g.add(b, tree, rock, lamp);
        slots.push({ side: s, i, b, tree, rock, lamp });
      }
    });
    scene.add(g);
    return { g, slots, z0: 0 };
  }

  let quality = 0;                     // 0 = max, 1 = moyen, 2 = économe (réglé automatiquement)
  function layoutChunk(ch, z0) {
    ch.z0 = z0;
    ch.g.position.z = z0 - CH_LEN / 2;
    const city = biomeCity(-z0);
    ch.slots.forEach(sl => {
      const lz = -CH_LEN / 2 + (sl.i + 0.5) * (CH_LEN / SLOTS);
      const skip = quality >= 2 && sl.i % 2 === 1;
      sl.b.visible = sl.tree.visible = sl.rock.visible = sl.lamp.visible = false;
      if (skip) return;
      if (city) {
        const gi = randi(0, BUILD_GEOS.length - 1);
        sl.b.geometry = BUILD_GEOS[gi];
        sl.b.geometry.computeBoundingBox();
        const w = sl.b.geometry.boundingBox.max.x * 2;
        sl.b.position.set(sl.side * (ROAD_W / 2 + 2.6 + w / 2 + rand(0, 5)), 0, lz + rand(-1, 1));
        sl.b.visible = true;
        if (sl.i % 2 === 0 && quality < 2) { sl.lamp.position.set(sl.side * (ROAD_W / 2 + 0.9), 0, lz); sl.lamp.visible = true; }
      } else {
        if (Math.random() < 0.85) {
          const sc = rand(0.8, 1.6);
          sl.tree.position.set(sl.side * (6 + rand(0, 26)), 0, lz + rand(-2, 2));
          sl.tree.scale.setScalar(sc);
          sl.tree.visible = true;
        }
        if (Math.random() < 0.35) {
          const sc = rand(0.5, 1.4);
          sl.rock.position.set(sl.side * (5 + rand(0, 14)), sc * 0.4, lz + rand(-3, 3));
          sl.rock.scale.set(sc, sc * 0.7, sc);
          sl.rock.rotation.set(rand(0, 3), rand(0, 3), 0);
          sl.rock.visible = true;
        }
      }
    });
  }
  for (let i = 0; i < NCH; i++) { const ch = makeChunk(); chunks.push(ch); layoutChunk(ch, 30 - i * CH_LEN); }

  // ---------- héros ----------
  const hero = new THREE.Group();
  const pose = new THREE.Group();
  hero.add(pose);
  const matSuit = new THREE.MeshStandardMaterial({ color: SKINS[SV.skin].main, roughness: 0.55, metalness: 0.1 });
  const matAcc = new THREE.MeshStandardMaterial({ color: SKINS[SV.skin].accent, roughness: 0.4, metalness: 0.2, emissive: SKINS[SV.skin].accent, emissiveIntensity: 0.18 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.3, metalness: 0.5 });
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xe8b894, roughness: 0.7 });
  const body = new THREE.Group(); body.position.y = 0.92; pose.add(body);
  const mk = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || body).add(m); m.frustumCulled = false; return m; };
  mk(new THREE.CylinderGeometry(0.26, 0.22, 0.62, 14), matSuit, 0, 0.34, 0);
  mk(new THREE.CylinderGeometry(0.265, 0.265, 0.1, 14), matAcc, 0, 0.45, 0);
  mk(new THREE.BoxGeometry(0.34, 0.42, 0.16), matDark, 0, 0.38, 0.22);                 // sac à dos / jet
  mk(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), matAcc, -0.1, 0.12, 0.25);
  mk(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), matAcc, 0.1, 0.12, 0.25);
  const head = new THREE.Group(); head.position.set(0, 0.86, 0); body.add(head);
  mk(new THREE.SphereGeometry(0.21, 16, 12), matSuit, 0, 0, 0, head);
  const visor = mk(new THREE.SphereGeometry(0.19, 14, 10), matDark, 0, 0.01, -0.07, head); visor.scale.set(1, 0.55, 0.65);
  mk(new THREE.BoxGeometry(0.1, 0.03, 0.02), matAcc, 0, 0.02, -0.2, head);
  function limb(x, y, len, r, mat, endMat) {
    const g = new THREE.Group(); g.position.set(x, y, 0);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 10), mat); seg.position.y = -len / 2; seg.frustumCulled = false;
    const end = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 10, 8), endMat); end.position.y = -len; end.frustumCulled = false;
    g.add(seg, end);
    return g;
  }
  const armL = limb(-0.33, 0.6, 0.55, 0.075, matSuit, matSkin), armR = limb(0.33, 0.6, 0.55, 0.075, matSuit, matSkin);
  const legL = limb(-0.13, 0, 0.82, 0.095, matSuit, matAcc), legR = limb(0.13, 0, 0.82, 0.095, matSuit, matAcc);
  body.add(armL, armR, legL, legR);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI / 2; flame.position.set(0, 0.1, 0.62); flame.visible = false; body.add(flame);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), new THREE.MeshBasicMaterial({ color: 0x59d8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  bubble.position.y = 0.95; bubble.visible = false; hero.add(bubble);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; scene.add(blob);
  scene.add(hero);
  function applySkin(i) { matSuit.color.set(SKINS[i].main); matAcc.color.set(SKINS[i].accent); matAcc.emissive.set(SKINS[i].accent); }

  // ---------- obstacles & objets ----------
  function hazardTex() {
    return canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#f3f3ee'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff7a1a';
      for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
    });
  }
  const hazMat = bend(new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.7 }));
  const concreteMat = bend(new THREE.MeshStandardMaterial({ color: 0xdcdcd6, roughness: 0.85 }));
  const lampOrange = new THREE.MeshBasicMaterial({ color: 0xff9a2a });
  const signTex = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#10192e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd23c'; g.lineWidth = 10; g.lineJoin = 'round';
    for (let i = 0; i < 4; i++) { const x = 30 + i * 62; g.beginPath(); g.moveTo(x, 26); g.lineTo(x + 26, 48); g.lineTo(x, 70); g.stroke(); }
    g.fillStyle = '#ffd23c'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7);
  });
  const signMat = bend(new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 }));
  const frameMat = bend(new THREE.MeshStandardMaterial({ color: 0x3a3f4e, roughness: 0.5, metalness: 0.6 }));
  const CONTAINER_COLORS = ['#d9462f', '#2f7bd9', '#e0a21a', '#2fa56a', '#7b5bd6'];
  const containerMats = CONTAINER_COLORS.map(col => {
    const tex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let x = 0; x < w; x += 12) g.fillRect(x, 0, 4, h);
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(14, h - 26, 70, 10);
    });
    return bend(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.25 }));
  });
  const roofMat = bend(new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.6, metalness: 0.4 }));

  const obstacles = [], coins = [], powers = [];
  const poolObs = { barrier: [], gantry: [], block: [] };
  const poolCoin = [];
  const poolPow = { magnet: [], shield: [], double: [], jet: [] };

  function makeObstacle(type) {
    const g = new THREE.Group();
    let o;
    if (type === 'barrier') {
      const mats = [concreteMat, concreteMat, concreteMat, concreteMat, hazMat, hazMat];
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.6), mats); b.position.y = 0.45; g.add(b);
      [-0.8, 0.8].forEach(x => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lampOrange); l.position.set(x, 1.0, 0); g.add(l); });
      o = { hw: 1.0, hl: 0.35, y0: 0, y1: 0.9 };
    } else if (type === 'gantry') {
      [-1.0, 1.0].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.22), frameMat); p.position.set(x, 1.3, 0); g.add(p); });
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 0.26), signMat); s.position.y = 1.8; g.add(s);
      o = { hw: 1.05, hl: 0.3, y0: 1.2, y1: 2.6 };
    } else {
      const m = pick(containerMats);
      const mats = [m, m, roofMat, roofMat, m, m];
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.7, 6.2), mats); b.position.y = 1.35; g.add(b);
      o = { hw: 1.05, hl: 3.1, y0: 0, y1: 2.7 };
    }
    g.children.forEach(c => { c.frustumCulled = false; });
    scene.add(g);
    return Object.assign(o, { type, mesh: g, x: 0, z: 0 });
  }
  function getObstacle(type) {
    const o = poolObs[type].pop() || makeObstacle(type);
    o.mesh.visible = true; o.hit = false;
    obstacles.push(o);
    return o;
  }

  const goldMat = bend(new THREE.MeshStandardMaterial({ color: 0xffc623, emissive: 0xb87a00, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.5 }));
  const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20);
  function getCoin() {
    let c = poolCoin.pop();
    if (!c) { c = new THREE.Mesh(coinGeo, goldMat); c.rotation.x = Math.PI / 2; c.frustumCulled = false; scene.add(c); }
    c.visible = true; c.userData.pulled = false;
    coins.push(c);
    return c;
  }

  function glowSprite(color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.85, fog: false }));
    s.scale.set(size, size, 1);
    return s;
  }
  const iconTex = (txt, c1, c2) => canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.font = '900 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3);
  });
  function makePower(type) {
    const g = new THREE.Group();
    if (type === 'magnet') {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 10, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xff3b4a, roughness: 0.35, metalness: 0.4 }));
      arc.position.y = 0.05; g.add(arc);
      [-0.3, 0.3].forEach(x => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), new THREE.MeshStandardMaterial({ color: 0xe8ecf4, metalness: 0.6, roughness: 0.3 })); t.position.set(x, -0.1, 0); g.add(t); });
      g.add(glowSprite(0xff4a5a, 2.4));
    } else if (type === 'shield') {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), new THREE.MeshStandardMaterial({ color: 0x59d8ff, emissive: 0x1e90c8, emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.2 }));
      g.add(s);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 28), new THREE.MeshBasicMaterial({ color: 0xbff0ff })); r.rotation.x = Math.PI / 2; g.add(r);
      g.add(glowSprite(0x59d8ff, 2.4));
    } else if (type === 'double') {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: iconTex('×2', '#ffd94a', '#e28a00'), transparent: true, side: THREE.DoubleSide }));
      g.add(p);
      g.add(glowSprite(0xffc83a, 2.4));
    } else {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.62, 12), new THREE.MeshStandardMaterial({ color: 0xf0f2f8, roughness: 0.4, metalness: 0.3 }));
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xff4a3a, roughness: 0.4 })); nose.position.y = 0.46;
      g.add(body, nose);
      [0, 1, 2].forEach(i => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.2), new THREE.MeshStandardMaterial({ color: 0xff4a3a })); f.position.set(Math.sin(i * 2.09) * 0.2, -0.22, Math.cos(i * 2.09) * 0.2); f.rotation.y = i * 2.09; g.add(f); });
      g.rotation.z = 0.5;
      g.add(glowSprite(0xff9a3c, 2.6));
    }
    g.children.forEach(c => { c.frustumCulled = false; });
    scene.add(g);
    return { type, mesh: g, x: 0, z: 0, y: 1.1 };
  }
  function getPower(type) {
    const p = poolPow[type].pop() || makePower(type);
    p.mesh.visible = true;
    powers.push(p);
    return p;
  }

  // ---------- particules & lignes de vitesse ----------
  const PN = 280;
  const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pBase = new Float32Array(PN * 3);
  const pLife = new Float32Array(PN), pMax = new Float32Array(PN).fill(1);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  scene.add(points);
  let pHead = 0;
  function emit(x, y, z, color, n, spread, up, life) {
    for (let k = 0; k < n; k++) {
      const i = pHead; pHead = (pHead + 1) % PN;
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
      pVel[i * 3] = (Math.random() - 0.5) * spread; pVel[i * 3 + 1] = Math.random() * up; pVel[i * 3 + 2] = (Math.random() - 0.5) * spread;
      pLife[i] = pMax[i] = life * (0.6 + Math.random() * 0.6);
      pBase[i * 3] = color.r; pBase[i * 3 + 1] = color.g; pBase[i * 3 + 2] = color.b;
    }
  }
  function stepParticles(dt) {
    for (let i = 0; i < PN; i++) {
      if (pLife[i] > 0) {
        pLife[i] -= dt;
        pVel[i * 3 + 1] -= 9 * dt;
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        const f = Math.max(0, pLife[i] / pMax[i]);
        pCol[i * 3] = pBase[i * 3] * f; pCol[i * 3 + 1] = pBase[i * 3 + 1] * f; pCol[i * 3 + 2] = pBase[i * 3 + 2] * f;
      } else { pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; }
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  const slMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const slGeo = new THREE.BoxGeometry(0.03, 0.03, 3.2);
  const speedLines = [];
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(slGeo, slMat); m.frustumCulled = false; scene.add(m); speedLines.push(m); }
  function placeLine(m, z) { m.position.set(rand(-8, 8), rand(0.4, 6.5), z); if (Math.abs(m.position.x) < 2.6 && m.position.y < 2.2) m.position.y += 3; }

  // ---------- état de la partie ----------
  const P = { x: 0, z: 0, y: 0, vy: 0, lane: 1, sliding: false, slideT: 0, speed: 0, dist: 0, inv: 0, jet: 0, jetEnd: 0, phase: 0, coyote: 0, jumpBuf: 0, airDive: false };
  const pw = { magnet: 0, double: 0, shield: false, jet: 0, magnetMax: 1, doubleMax: 1, jetMax: 1 };
  let R = null;                      // stats de la partie en cours
  let state = 'menu';                // menu | playing | dying | over
  let paused = false, stopped = false, timeScale = 1, shake = 0, deathT = 0, nextRowZ = -80, lastPowerDist = 0;
  let menuAng = 0, camPos = new THREE.Vector3(0, 2, 8), camLook = new THREE.Vector3(), camInit = false;
  let lastBiome = -1, tutoShown = false, fov = 62;
  let lastRow = '';

  const maxSpeed = 36;
  const speedFor = d => 15 + (maxSpeed - 15) * (1 - Math.exp(-d / 2800));

  function newRun() {
    return { coins: 0, score: 0, jumps: 0, slides: 0, power: 0, streak: 0, streakT: 0, mile: 0, done: {} };
  }

  // ---------- génération des rangées ----------
  const coinAt = (lane, z, y) => { const c = getCoin(); c.position.set(LANES[lane], y === undefined ? 0.85 : y, z); return c; };
  const coinLine = (lane, z, n) => { for (let i = 0; i < n; i++) coinAt(lane, z - i * 1.9); };
  const coinArc = (lane, z) => { const hs = [0.9, 1.55, 1.95, 1.55, 0.9]; hs.forEach((h, i) => coinAt(lane, z + (2 - i) * 1.7, h)); };
  function addObstacle(type, lane, z) { const o = getObstacle(type); o.x = LANES[lane]; o.z = z; o.mesh.position.set(o.x, 0, z); return o; }
  function addPower(type, lane, z) { const p = getPower(type); p.x = LANES[lane]; p.z = z; p.mesh.position.set(p.x, p.y, z); return p; }

  function spawnRow(z) {
    const d = P.dist, diff = clamp(d / 4500, 0, 1);
    let kind;
    if (d < 120) kind = pick(['coins', 'coins', 'block1']);
    else {
      const w = [['coins', 0.26 - 0.08 * diff], ['block1', 0.18 + 0.06 * diff], ['barriers', 0.2], ['gantry', 0.11 + 0.05 * diff], ['barrierAll', 0.07], ['blockPair', 0.03 + 0.14 * diff], ['gantryAll', 0.04 + 0.04 * diff]];
      if (d - lastPowerDist > 520) w.push(['power', 0.3]);
      let tot = 0; w.forEach(x => { tot += x[1]; });
      let r = Math.random() * tot;
      kind = w[0][0];
      for (const x of w) { r -= x[1]; if (r <= 0) { kind = x[0]; break; } }
      if (kind === lastRow && (kind === 'blockPair' || kind === 'gantryAll' || kind === 'barrierAll')) kind = 'coins';
    }
    lastRow = kind;
    let extra = 0;
    const lanes = shuffle([0, 1, 2]);
    switch (kind) {
      case 'coins': { coinLine(lanes[0], z, randi(7, 12)); if (Math.random() < 0.45) coinLine(lanes[1], z - rand(2, 8), randi(5, 8)); extra = 14; break; }
      case 'block1': { addObstacle('block', lanes[0], z); coinLine(lanes[1], z + 2, randi(6, 9)); extra = 6; break; }
      case 'blockPair': { addObstacle('block', lanes[0], z); addObstacle('block', lanes[1], z); coinLine(lanes[2], z + 4, 10); extra = 6; break; }
      case 'barriers': { const n = randi(1, 2); for (let i = 0; i < n; i++) { addObstacle('barrier', lanes[i], z); coinArc(lanes[i], z); } if (n === 1) coinLine(lanes[1], z + 3, 7); break; }
      case 'barrierAll': { [0, 1, 2].forEach(l => addObstacle('barrier', l, z)); coinArc(lanes[0], z); break; }
      case 'gantry': { const n = randi(1, 2); for (let i = 0; i < n; i++) { addObstacle('gantry', lanes[i], z); coinLine(lanes[i], z + 4, 5); } if (n === 1) coinLine(lanes[1], z + 3, 6); break; }
      case 'gantryAll': { [0, 1, 2].forEach(l => addObstacle('gantry', l, z)); [0, 1, 2].forEach(l => coinAt(l, z + 3, 0.5)); break; }
      case 'power': {
        const types = ['magnet', 'magnet', 'double', 'double', 'shield', 'shield', 'jet'];
        addPower(pick(types), lanes[0], z); coinLine(lanes[1], z + 2, 6);
        lastPowerDist = P.dist; break;
      }
      default: break;
    }
    const gap = Math.max(17, P.speed * 0.66) + rand(0, 6) + extra * 0.2;
    nextRowZ = z - gap - (kind === 'block1' || kind === 'blockPair' ? 6 : 0);
  }

  // ---------- interface (HUD + menu) ----------
  if (!document.getElementById('sk-style')) {
    const st = document.createElement('style');
    st.id = 'sk-style';
    st.textContent = `
.sk-hud{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;font-family:'Rajdhani','Segoe UI',system-ui,sans-serif;color:#fff;overflow:hidden;-webkit-user-select:none;user-select:none}
.sk-ui{pointer-events:auto}
.sk-top{position:absolute;top:10px;left:12px;display:flex;flex-direction:column;gap:4px}
.sk-score{font-size:36px;font-weight:800;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.5);letter-spacing:.5px}
.sk-sub{display:flex;gap:12px;font-weight:700;font-size:16px;text-shadow:0 1px 8px rgba(0,0,0,.55);align-items:center}
.sk-coin{width:15px;height:15px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3b0,#f5b301 60%,#b97a00);display:inline-block;margin-right:5px;vertical-align:-2px;box-shadow:0 0 8px rgba(255,200,0,.6)}
.sk-pausebtn{position:absolute;top:10px;right:54px;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(15,18,30,.45);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#fff;font-size:15px;pointer-events:auto;cursor:pointer;padding:0}
.sk-chips{position:absolute;top:62px;left:12px;display:flex;flex-direction:column;gap:6px}
.sk-chip{display:flex;align-items:center;gap:8px;min-width:130px;padding:5px 10px;border-radius:10px;background:rgba(15,18,30,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-weight:700;font-size:14px;position:relative;overflow:hidden}
.sk-chip i{position:absolute;left:0;bottom:0;height:3px;background:currentColor;opacity:.9}
.sk-pop{position:absolute;left:50%;top:24%;transform:translateX(-50%);font-weight:800;font-size:30px;letter-spacing:1px;text-shadow:0 3px 16px rgba(0,0,0,.55);animation:skpop 1.2s ease-out forwards;white-space:nowrap}
@keyframes skpop{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}15%{opacity:1;transform:translate(-50%,0) scale(1.08)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-30px) scale(1)}}
.sk-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,40,70,0) 35%,rgba(255,40,70,.6));opacity:0;transition:opacity .3s}
.sk-hint{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);padding:10px 16px;border-radius:14px;background:rgba(15,18,30,.6);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-weight:700;font-size:16px;text-align:center;transition:opacity .6s}
.sk-menu{position:absolute;inset:0;display:flex;overflow-y:auto;padding:12px;box-sizing:border-box;background:linear-gradient(180deg,rgba(6,10,24,.15),rgba(6,10,24,.55))}
.sk-card{margin:auto;width:min(94%,430px);padding:18px;border-radius:22px;background:rgba(12,16,32,.72);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 60px rgba(0,0,0,.45);box-sizing:border-box}
.sk-title{font-size:38px;font-weight:900;letter-spacing:3px;text-align:center;line-height:1;background:linear-gradient(90deg,#ffd27a,#ff7a5e 55%,#c58bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.sk-title span{display:block;font-size:20px;letter-spacing:10px;color:#fff;-webkit-text-fill-color:#fff;opacity:.9;margin-top:4px}
.sk-stats{display:flex;justify-content:center;gap:28px;margin:14px 0 12px}
.sk-stats div{text-align:center}
.sk-stats b{display:block;font-size:24px}
.sk-stats small{font-size:11px;letter-spacing:2px;opacity:.65}
.sk-play{width:100%;padding:14px;border:none;border-radius:14px;font-family:inherit;font-weight:900;font-size:22px;letter-spacing:3px;color:#1a1020;background:linear-gradient(90deg,#ffd27a,#ff8a5e);box-shadow:0 8px 24px rgba(255,138,94,.45);cursor:pointer;-webkit-tap-highlight-color:transparent}
.sk-play:active{transform:scale(.98)}
.sk-tabs{display:flex;gap:6px;margin:14px 0 10px}
.sk-tabs button{flex:1;padding:8px 4px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#cfd6ea;font-family:inherit;font-weight:700;font-size:13px;letter-spacing:1px;cursor:pointer}
.sk-tabs button.on{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.4)}
.sk-row{display:flex;align-items:center;gap:10px;padding:9px 10px;margin-bottom:6px;border-radius:12px;background:rgba(255,255,255,.06);font-weight:600;font-size:14px}
.sk-row .t{flex:1;min-width:0}.sk-row small{display:block;opacity:.65;font-size:12px;font-weight:500}
.sk-row b{white-space:nowrap}
.sk-row.done{opacity:.55}
.sk-btn{padding:7px 12px;border-radius:10px;border:none;font-family:inherit;font-weight:800;font-size:13px;background:#ffd27a;color:#1a1020;cursor:pointer;white-space:nowrap}
.sk-btn[disabled]{opacity:.4;cursor:default}
.sk-btn.alt{background:rgba(255,255,255,.14);color:#fff}
.sk-skins{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.sk-skin{padding:10px;border-radius:12px;background:rgba(255,255,255,.06);border:2px solid transparent;text-align:center;font-weight:700;font-size:13px;cursor:pointer;color:#fff;font-family:inherit}
.sk-skin.on{border-color:#ffd27a}
.sk-skin .sw{width:38px;height:38px;border-radius:50%;margin:0 auto 6px;border:3px solid}
.sk-keys{margin-top:10px;text-align:center;font-size:12px;opacity:.6;letter-spacing:.5px}
.sk-pause{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,10,24,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.sk-pause .sk-card{width:min(86%,320px);text-align:center}
.sk-pause .sk-play{margin-top:10px}
@media (orientation:landscape) and (max-height:520px){
  .sk-card.menu{width:min(96%,820px);display:grid;grid-template-columns:1fr 1.15fr;gap:6px 18px;padding:14px}
  .sk-card.menu .sk-title{font-size:30px}
  .sk-card.menu .sk-left{align-self:center}
  .sk-card.menu .sk-tabs{margin-top:0}
  .sk-score{font-size:30px}
}`;
    document.head.appendChild(st);
  }

  const hud = document.createElement('div');
  hud.className = 'gm-hud sk-hud';
  hud.innerHTML = `
    <div class="sk-top" id="sk-top" style="display:none">
      <div class="sk-score" id="sk-score">0</div>
      <div class="sk-sub"><span><i class="sk-coin"></i><b id="sk-coins">0</b></span><span id="sk-dist">0 m</span></div>
    </div>
    <div class="sk-chips" id="sk-chips"></div>
    <button class="sk-pausebtn sk-ui" id="sk-pausebtn" style="display:none" aria-label="Pause">❚❚</button>
    <div class="sk-flash" id="sk-flash"></div>
    <div class="sk-hint" id="sk-hint" style="display:none"></div>

    <div class="sk-menu sk-ui gm-scroll" id="sk-menu">
      <div class="sk-card menu">
        <div class="sk-left">
          <div class="sk-title">SKYLINE<span>RUSH</span></div>
          <div class="sk-stats"><div><b id="sk-best">0</b><small>RECORD</small></div><div><b id="sk-bank">0</b><small>PIÈCES</small></div></div>
          <button class="sk-play" id="sk-play">JOUER</button>
          <div class="sk-keys">${IS_TOUCH ? 'Glisse : ← → voies · ↑ saut · ↓ glissade' : '← → voies · ↑ saut · ↓ glissade'}</div>
        </div>
        <div class="sk-right">
          <div class="sk-tabs" id="sk-tabs"><button data-tab="missions" class="on">MISSIONS</button><button data-tab="skins">TENUES</button><button data-tab="upg">BOUTIQUE</button></div>
          <div id="sk-panel"></div>
        </div>
      </div>
    </div>

    <div class="sk-pause sk-ui" id="sk-pause">
      <div class="sk-card"><div class="sk-title" style="font-size:30px">PAUSE</div>
        <button class="sk-play" id="sk-resume">REPRENDRE</button>
        <button class="sk-play" id="sk-quit" style="background:rgba(255,255,255,.14);color:#fff;box-shadow:none;font-size:15px;margin-top:8px">TERMINER LA PARTIE</button>
      </div>
    </div>`;
  container.appendChild(hud);
  const $ = id => hud.querySelector('#' + id);
  const elScore = $('sk-score'), elCoins = $('sk-coins'), elDist = $('sk-dist'), elChips = $('sk-chips'), elFlash = $('sk-flash');
  const elMenu = $('sk-menu'), elPanel = $('sk-panel'), elTop = $('sk-top'), elPauseBtn = $('sk-pausebtn'), elHint = $('sk-hint'), elPause = $('sk-pause');
  let tab = 'missions';

  function pop(text, color) {
    const e = document.createElement('div');
    e.className = 'sk-pop';
    e.textContent = text;
    if (color) e.style.color = color;
    e.addEventListener('animationend', () => e.remove());
    hud.appendChild(e);
    while (hud.querySelectorAll('.sk-pop').length > 3) hud.querySelector('.sk-pop').remove();
  }

  function renderMenu() {
    $('sk-best').textContent = SV.best;
    $('sk-bank').textContent = SV.coins;
    hud.querySelectorAll('#sk-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    let h = '';
    if (tab === 'missions') {
      h = SV.missions.map(m => `<div class="sk-row ${m.done ? 'done' : ''}"><div class="t">${missionText(m)}</div><b><i class="sk-coin"></i>+${m.reward}</b></div>`).join('') +
        '<div class="sk-keys" style="margin-top:4px">Une fois accomplie, une mission est remplacée par une nouvelle.</div>';
    } else if (tab === 'skins') {
      h = '<div class="sk-skins">' + SKINS.map((s, i) => {
        const owned = SV.owned[i], on = SV.skin === i;
        return `<button class="sk-skin ${on ? 'on' : ''}" data-skin="${i}"><div class="sw" style="background:${s.main};border-color:${s.accent}"></div>${s.name}<br><small style="opacity:.7">${on ? 'ÉQUIPÉE' : owned ? 'CHOISIR' : s.cost + ' pièces'}</small></button>`;
      }).join('') + '</div>';
    } else {
      h = UPGRADES.map(u => {
        const lvl = SV.upg[u.id], maxed = lvl >= u.max, cost = upgCost(u);
        return `<div class="sk-row"><div class="t">${u.name} <b style="opacity:.8">${u.max > 1 ? 'niv. ' + lvl + '/' + u.max : (lvl ? 'ACTIF' : '')}</b><small>${u.desc}</small></div>` +
          (maxed ? '<b>MAX</b>' : `<button class="sk-btn" data-upg="${u.id}" ${SV.coins < cost ? 'disabled' : ''}>${cost}</button>`) + '</div>';
      }).join('');
    }
    elPanel.innerHTML = h;
  }

  elMenu.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'sk-play') { startRun(); return; }
    if (t.dataset.tab) { tab = t.dataset.tab; renderMenu(); return; }
    if (t.dataset.skin !== undefined) {
      const i = +t.dataset.skin;
      if (!SV.owned[i]) { if (SV.coins < SKINS[i].cost) { pop('Pas assez de pièces', '#ff9a8a'); return; } SV.coins -= SKINS[i].cost; SV.owned[i] = true; snd('buy', 880, 0.12, 'triangle'); }
      SV.skin = i; applySkin(i); saveGame(); renderMenu(); return;
    }
    if (t.dataset.upg) {
      const u = UPGRADES.find(x => x.id === t.dataset.upg), cost = upgCost(u);
      if (SV.upg[u.id] >= u.max || SV.coins < cost) return;
      SV.coins -= cost; SV.upg[u.id]++; snd('buy', 880, 0.12, 'triangle'); saveGame(); renderMenu();
    }
  });
  elPauseBtn.addEventListener('click', () => setPause(true));
  $('sk-resume').addEventListener('click', () => setPause(false));
  $('sk-quit').addEventListener('click', () => { setPause(false); crash(true); });
  function setPause(v) {
    if (state !== 'playing') return;
    paused = v;
    elPause.style.display = v ? 'flex' : 'none';
  }

  let chipKey = '';
  function updateChips() {
    const defs = [];
    if (pw.magnet > 0) defs.push(['🧲', 'AIMANT', pw.magnet / pw.magnetMax, '#ff6a78']);
    if (pw.double > 0) defs.push(['×2', 'SCORE ×2', pw.double / pw.doubleMax, '#ffd04a']);
    if (pw.shield) defs.push(['🛡', 'BOUCLIER', 1, '#59d8ff']);
    if (P.jet > 0) defs.push(['🚀', 'JET', P.jet / pw.jetMax, '#ff9a3c']);
    const key = defs.map(d => d[1] + Math.round(d[2] * 20)).join('|');
    if (key === chipKey) return;
    chipKey = key;
    elChips.innerHTML = defs.map(d => `<div class="sk-chip" style="color:${d[3]}"><span>${d[0]}</span><span style="color:#fff">${d[1]}</span><i style="width:${Math.round(d[2] * 100)}%"></i></div>`).join('');
  }

  // ---------- logique de partie ----------
  function startRun() {
    state = 'playing';
    R = newRun();
    paused = false; timeScale = 1; shake = 0; deathT = 0;
    P.x = 0; P.lane = 1; P.y = 0; P.vy = 0; P.sliding = false; P.slideT = 0; P.speed = 6; P.dist = 0; P.inv = 0; P.jet = 0; P.z = 0; P.coyote = 0; P.jumpBuf = 0;
    pw.magnet = pw.double = pw.jet = 0; pw.shield = SV.upg.shield > 0;
    lastPowerDist = 0; lastRow = '';
    obstacles.splice(0).forEach(o => { o.mesh.visible = false; poolObs[o.type].push(o); });
    coins.splice(0).forEach(c => { c.visible = false; poolCoin.push(c); });
    powers.splice(0).forEach(p => { p.mesh.visible = false; poolPow[p.type].push(p); });
    nextRowZ = -85;
    while (nextRowZ > P.z - 190) spawnRow(nextRowZ);
    elMenu.style.display = 'none';
    elTop.style.display = 'block';
    elPauseBtn.style.display = 'block';
    if (!SV.tuto) {
      SV.tuto = true; saveGame();
      elHint.style.display = 'block'; elHint.style.opacity = 1;
      elHint.innerHTML = IS_TOUCH ? 'Glisse à gauche / droite pour changer de voie<br>↑ pour sauter · ↓ pour glisser' : '← → pour changer de voie<br>↑ pour sauter · ↓ pour glisser';
      tutoShown = true;
      setTimeout(() => { elHint.style.opacity = 0; setTimeout(() => { elHint.style.display = 'none'; }, 700); }, 5200);
    }
    snd('go', 520, 0.12, 'triangle');
    pop('C\'EST PARTI !', '#ffd27a');
  }

  function checkMissions() {
    SV.missions.forEach(m => {
      if (m.done || R.done[m.stat + m.target]) return;
      const v = { distance: P.dist, coins: R.coins, jumps: R.jumps, slides: R.slides, powerups: R.power, score: R.score }[m.stat];
      if (v >= m.target) {
        R.done[m.stat + m.target] = true;
        m.done = true;
        SV.coins += m.reward;
        pop('MISSION ACCOMPLIE  +' + m.reward, '#7dffb2');
        saveGame();
        snd('mission', 988, 0.22, 'triangle');
      }
    });
  }

  function collectCoin(c) {
    c.visible = false;
    const i = coins.indexOf(c); if (i > -1) coins.splice(i, 1);
    poolCoin.push(c);
    const mult = pw.double > 0 ? 2 : 1;
    R.coins++; SV.coins++;
    R.score += 10 * mult;
    R.streak++; R.streakT = 0.9;
    snd('coin', 560 + Math.min(10, R.streak) * 55, 0.05, 'sine');
    emit(c.position.x, c.position.y, c.position.z, new THREE.Color(0xffd34a), 4, 2.5, 3, 0.45);
  }

  function collectPower(p) {
    p.mesh.visible = false;
    const i = powers.indexOf(p); if (i > -1) powers.splice(i, 1);
    poolPow[p.type].push(p);
    R.power++;
    snd('power', 740, 0.18, 'triangle');
    emit(p.x, 1.2, p.z, new THREE.Color(0xffffff), 16, 5, 5, 0.7);
    if (p.type === 'magnet') { pw.magnetMax = pw.magnet = 8 + SV.upg.magnet * 2; pop('AIMANT', '#ff8d98'); }
    else if (p.type === 'double') { pw.doubleMax = pw.double = 10 + SV.upg.double * 2; pop('SCORE ×2', '#ffd04a'); }
    else if (p.type === 'shield') { pw.shield = true; pop('BOUCLIER', '#7fe3ff'); }
    else {
      pw.jetMax = P.jet = 5 + SV.upg.jet; pop('JET !', '#ffb06a');
      // traînée de pièces en altitude
      const n = Math.floor(P.jet * P.speed / 2.1);
      for (let k = 0; k < n; k++) { const c = getCoin(); c.position.set(Math.sin(k * 0.32) * LANE_W, 4.1 + Math.sin(k * 0.5) * 0.6, P.z - 14 - k * 2.1); }
    }
  }

  function crash(forced) {
    if (state !== 'playing') return;
    if (!forced && pw.shield) {
      pw.shield = false; P.inv = 1.4; shake = 0.5;
      snd('shield', 220, 0.2, 'sawtooth');
      emit(P.x, 1, P.z, new THREE.Color(0x59d8ff), 30, 9, 6, 0.7);
      pop('BOUCLIER BRISÉ', '#7fe3ff');
      elFlash.style.opacity = 0.5; setTimeout(() => { elFlash.style.opacity = 0; }, 160);
      return;
    }
    state = 'dying'; deathT = 0; shake = 1;
    snd('crash', 120, 0.4, 'sawtooth');
    emit(P.x, 1, P.z, new THREE.Color(0xff5a5a), 40, 9, 7, 0.9);
    elFlash.style.opacity = 1; setTimeout(() => { elFlash.style.opacity = 0; }, 260);
    elPauseBtn.style.display = 'none';
  }

  function endRun() {
    state = 'over';
    const finalScore = Math.floor(R.score);
    const record = finalScore > SV.best;
    if (record) SV.best = finalScore;
    SV.runs++;
    // les missions accomplies sont remplacées
    const kept = SV.missions.filter(m => !m.done);
    while (kept.length < 3) kept.push(newMission(kept));
    SV.missions = kept;
    saveGame();
    elTop.style.display = 'none';
    stopped = true;
    if (typeof triggerGameOver === 'function') triggerGameOver(finalScore);
  }

  // ---------- actions du joueur ----------
  function steer(dir) {
    if (state !== 'playing' || paused) return;
    const l = clamp(P.lane + dir, 0, 2);
    if (l !== P.lane) { P.lane = l; snd('steer', 330, 0.03, 'sine'); }
  }
  function doJump() {
    if (state !== 'playing' || paused || P.jet > 0) return;
    if (P.y <= 0.05 || P.coyote > 0) {
      P.vy = 10.4; P.y = Math.max(P.y, 0.001); P.sliding = false; P.slideT = 0; P.coyote = 0; P.jumpBuf = 0;
      R.jumps++;
      snd('jump', 420, 0.08, 'triangle');
      emit(P.x, 0.1, P.z, new THREE.Color(0xffffff), 6, 2.5, 1.5, 0.4);
    } else { P.jumpBuf = 0.14; }
  }
  function doSlide() {
    if (state !== 'playing' || paused || P.jet > 0) return;
    if (P.y > 0.05) { P.vy = -20; P.airDive = true; return; }
    if (!P.sliding) R.slides++;
    P.sliding = true; P.slideT = 0.75;
    snd('slide', 240, 0.12, 'sawtooth');
  }

  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', Space: 'U', ArrowDown: 'D', KeyS: 'D' };
  function onKey(e) {
    const k = KEYS[e.code];
    if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') setPause(!paused); return; }
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    if (k === 'L') steer(-1); else if (k === 'R') steer(1); else if (k === 'U') doJump(); else doSlide();
  }
  let sw = null;
  const inGame = t => !!t && (t === canvas || (t.closest && (t.closest('#gm-stage') || t.closest('.sk-hud'))));
  function onPD(e) {
    if (!inGame(e.target) || (e.target.closest && e.target.closest('.sk-ui'))) return;
    sw = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
  }
  function onPM(e) {
    if (!sw || sw.id !== e.pointerId || sw.done) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    sw.done = true;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1);
    else if (dy < 0) doJump(); else doSlide();
  }
  const onPU = e => { if (sw && sw.id === e.pointerId) sw = null; };
  const onVis = () => { if (document.hidden) { saveGame(); if (state === 'playing') setPause(true); } };
  const onPageHide = () => saveGame();
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPD);
  window.addEventListener('pointermove', onPM);
  window.addEventListener('pointerup', onPU);
  window.addEventListener('pointercancel', onPU);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onPageHide);

  // ---------- mise à jour de la partie ----------
  const boxHit = (o) => {
    const px0 = P.x - 0.34, px1 = P.x + 0.34;
    const py0 = P.y, py1 = P.y + (P.sliding ? 0.75 : 1.65);
    return px1 > o.x - o.hw && px0 < o.x + o.hw && Math.abs(P.z - o.z) < o.hl + 0.32 && py1 > o.y0 && py0 < o.y1;
  };

  function updateRun(dt) {
    // vitesse
    const target = speedFor(P.dist) * (P.jet > 0 ? 1.18 : 1);
    P.speed += (target - P.speed) * Math.min(1, dt * (P.speed < 12 ? 2.2 : 0.8));
    P.z -= P.speed * dt;
    P.dist = -P.z;
    const mult = pw.double > 0 ? 2 : 1;
    R.score += P.speed * dt * mult;

    // voie
    const tx = LANES[P.lane];
    P.x += (tx - P.x) * (1 - Math.exp(-15 * dt));

    // saut / chute / glissade / jet
    if (P.jet > 0) {
      P.jet -= dt;
      P.y += (4.1 - P.y) * (1 - Math.exp(-4 * dt));
      P.vy = 0; P.sliding = false;
      if (P.jet <= 0) { P.jet = 0; P.inv = 1.6; pop('ATTERRISSAGE', '#ffffff'); }
    } else {
      if (P.y > 0 || P.vy > 0) {
        P.vy -= 33 * dt;
        P.y += P.vy * dt;
        P.coyote = 0;
        if (P.y <= 0) {
          P.y = 0; P.vy = 0;
          emit(P.x, 0.1, P.z, new THREE.Color(0xffffff), 8, 3, 1.5, 0.45);
          if (P.airDive) { P.airDive = false; P.sliding = true; P.slideT = 0.6; shake = Math.max(shake, 0.15); R.slides++; }
          if (P.jumpBuf > 0) doJump();
        }
      } else { P.coyote = 0.08; }
      if (P.sliding) { P.slideT -= dt; if (P.slideT <= 0) P.sliding = false; }
    }
    if (P.jumpBuf > 0) P.jumpBuf -= dt;
    if (P.inv > 0) P.inv -= dt;
    ['magnet', 'double'].forEach(k => { if (pw[k] > 0) { pw[k] -= dt; if (pw[k] < 0) pw[k] = 0; } });

    // rangées d'obstacles à l'horizon
    while (nextRowZ > P.z - 190) spawnRow(nextRowZ);

    // obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o.z > P.z + 14) { o.mesh.visible = false; poolObs[o.type].push(o); obstacles.splice(i, 1); continue; }
      if (state === 'playing' && P.jet <= 0 && P.inv <= 0 && Math.abs(o.z - P.z) < o.hl + 1 && boxHit(o)) { crash(); if (state !== 'playing') return; }
    }

    // pièces
    const magnetOn = pw.magnet > 0;
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.rotation.z += dt * 4.5;
      if (c.position.z > P.z + 10) { c.visible = false; poolCoin.push(c); coins.splice(i, 1); continue; }
      const dx = P.x - c.position.x, dy = (P.y + 0.9) - c.position.y, dz = P.z - c.position.z;
      if (magnetOn && !c.userData.pulled && Math.abs(dz) < 9 && Math.abs(dx) < 4.5 && Math.abs(dy) < 3.5 && dz > -3) c.userData.pulled = true;
      if (c.userData.pulled) {
        const k = Math.min(1, dt * 12);
        c.position.x += dx * k; c.position.y += dy * k; c.position.z += (dz + 0.3) * k;
      }
      if (Math.abs(dx) < 0.85 && Math.abs(dz) < 0.9 && Math.abs(dy) < 1.15) collectCoin(c);
    }

    // power-ups
    for (let i = powers.length - 1; i >= 0; i--) {
      const p = powers[i];
      p.mesh.rotation.y += dt * 2.2;
      p.mesh.position.y = p.y + Math.sin(performance.now() * 0.004 + p.z) * 0.18;
      if (p.z > P.z + 10) { p.mesh.visible = false; poolPow[p.type].push(p); powers.splice(i, 1); continue; }
      if (Math.abs(p.x - P.x) < 1.0 && Math.abs(p.z - P.z) < 1.2 && Math.abs((p.y) - (P.y + 0.9)) < 1.6) collectPower(p);
    }

    // série de pièces
    if (R.streakT > 0) { R.streakT -= dt; if (R.streakT <= 0) R.streak = 0; }

    // paliers de distance + changement d'ambiance
    const mile = Math.floor(P.dist / 500);
    if (mile > R.mile) { R.mile = mile; pop(mile * 500 + ' m', '#ffffff'); snd('mile', 700, 0.12, 'triangle'); }
    if (cur.idx !== lastBiome) { if (lastBiome !== -1) pop(cur.name, '#ffd27a'); lastBiome = cur.idx; }

    checkMissions();
  }

  // ---------- animation du héros ----------
  function easeRot(o, v, k) { o.rotation.x += (v - o.rotation.x) * k; }
  function animateHero(dt) {
    const k = Math.min(1, dt * 14);
    let mode = 'idle';
    if (state === 'playing' || state === 'dying') {
      if (state === 'dying') mode = 'dead';
      else if (P.jet > 0) mode = 'jet';
      else if (P.sliding) mode = 'slide';
      else if (P.y > 0.05) mode = 'air';
      else mode = 'run';
    }
    P.phase += (state === 'playing' ? P.speed : 0) * dt * 0.62;
    const t = P.phase;
    flame.visible = mode === 'jet';
    if (mode === 'jet') { flame.scale.set(1 + Math.sin(performance.now() * 0.05) * 0.2, 1 + Math.random() * 0.5, 1); }

    if (mode === 'run') {
      const a = Math.sin(t) * 1.0;
      easeRot(legL, a, k); easeRot(legR, -a, k); easeRot(armL, -a * 0.9, k); easeRot(armR, a * 0.9, k);
      body.position.y = 0.92 + Math.abs(Math.cos(t)) * 0.07;
      easeRot(body, -0.14, k); easeRot(pose, 0, k);
      pose.position.y += (0 - pose.position.y) * k;
    } else if (mode === 'air') {
      easeRot(legL, -0.9, k); easeRot(legR, 0.5, k); easeRot(armL, -2.6, k); easeRot(armR, -2.4, k);
      body.position.y += (0.95 - body.position.y) * k; easeRot(body, -0.05, k); easeRot(pose, 0, k);
      pose.position.y += (0 - pose.position.y) * k;
    } else if (mode === 'slide') {
      easeRot(legL, -0.15, k); easeRot(legR, -0.1, k); easeRot(armL, -1.5, k); easeRot(armR, -1.5, k);
      easeRot(body, 0, k); body.position.y += (0.92 - body.position.y) * k;
      easeRot(pose, 1.2, Math.min(1, dt * 18)); pose.position.y += (0.58 - pose.position.y) * k;
    } else if (mode === 'jet') {
      easeRot(legL, 0.25, k); easeRot(legR, 0.1, k); easeRot(armL, -3.0, k); easeRot(armR, -3.0, k);
      easeRot(body, 0, k); body.position.y += (0.92 - body.position.y) * k;
      easeRot(pose, -1.25, k); pose.position.y += (0.75 - pose.position.y) * k;
    } else if (mode === 'dead') {
      pose.rotation.x += dt * 5; pose.position.y += (0.5 - pose.position.y) * k;
      easeRot(armL, -2.2, k); easeRot(armR, 2.2, k);
    } else {   // idle (menu)
      const b = Math.sin(performance.now() * 0.002) * 0.02;
      easeRot(legL, 0, k); easeRot(legR, 0, k); easeRot(armL, 0.12 + b * 6, k); easeRot(armR, -0.12 - b * 6, k);
      body.position.y = 0.92 + b; easeRot(body, 0, k); easeRot(pose, 0, k); pose.position.y += (0 - pose.position.y) * k;
    }

    hero.position.set(P.x, P.y, P.z);
    hero.rotation.z = (state === 'playing') ? clamp((P.x - LANES[P.lane]) * -0.12, -0.35, 0.35) : 0;
    hero.rotation.y = state === 'menu' ? Math.sin(performance.now() * 0.0008) * 0.35 : clamp((P.x - LANES[P.lane]) * 0.08, -0.3, 0.3);
    bubble.visible = pw.shield && state !== 'dying';
    if (bubble.visible) bubble.scale.setScalar(1 + Math.sin(performance.now() * 0.006) * 0.03);
    hero.visible = !(P.inv > 0 && state === 'playing' && Math.floor(performance.now() / 70) % 2 === 0);
    blob.position.set(P.x, 0.04, P.z);
    const bs = clamp(1.25 - P.y * 0.12, 0.5, 1.25);
    blob.scale.set(bs, bs, 1);
    blob.material.opacity = clamp(0.5 - P.y * 0.06, 0.15, 0.5);

    // poussière / sillage
    if (state === 'playing' && mode === 'run' && Math.random() < dt * 22) emit(P.x + rand(-0.15, 0.15), 0.1, P.z + 0.3, new THREE.Color(SKINS[SV.skin].accent), 1, 1, 0.8, 0.35);
    if (mode === 'jet') emit(P.x, P.y + 0.55, P.z + 0.7, new THREE.Color(0xffa24a), 2, 1.2, 0.5, 0.45);
  }

  // ---------- caméra ----------
  const lookV = new THREE.Vector3();
  function updateCamera(dt) {
    const aspect = camera.aspect;
    const baseFov = aspect < 1 ? 62 + (1 - aspect) * 40 : 62;
    let pos, look;
    if (state === 'menu') {
      menuAng += dt * 0.35;
      const a = 2.55 + Math.sin(menuAng) * 0.65;
      const portrait = aspect < 1;
      pos = new THREE.Vector3(Math.sin(a) * 3.6, 1.45, P.z + Math.cos(a) * 3.6);
      look = new THREE.Vector3(0, portrait ? 0.25 : 0.95, P.z);
      if (portrait) pos.multiplyScalar(1); 
      fov += (baseFov * 0.8 - fov) * Math.min(1, dt * 4);
    } else {
      const sp = clamp(P.speed / maxSpeed, 0, 1);
      const up = P.jet > 0 ? 1.3 : P.y * 0.45;
      pos = new THREE.Vector3(P.x * 0.55, 3.15 + up, P.z + 6.7 - sp * 0.8 + (aspect < 1 ? 1.5 : 0));
      look = new THREE.Vector3(P.x * 0.7, 1.3 + P.y * 0.5, P.z - 9);
      fov += (baseFov + sp * 13 - fov) * Math.min(1, dt * 3);
    }
    if (!camInit) { camPos.copy(pos); camLook.copy(look); camInit = true; }
    const kk = 1 - Math.exp(-(state === 'menu' ? 3 : 7) * dt);
    camPos.lerp(pos, kk); camLook.lerp(look, kk);
    camera.position.copy(camPos);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; shake = Math.max(0, shake - dt * 2.2); }
    camera.lookAt(camLook);
    if (state === 'playing') camera.rotateZ((P.x - LANES[P.lane]) * 0.012);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    lookV.copy(camera.position);
  }

  // ---------- environnement ----------
  let skyT = 0;
  const WHITE = new THREE.Color(1, 1, 1);
  function updateEnvironment(dt, timeNow) {
    paletteAt(P.dist);
    scene.fog.color.copy(cur.bot);
    hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = 0.95 * cur.light * LI;
    sunLight.color.copy(cur.sun); sunLight.intensity = (0.55 + 0.45 * (1 - cur.night)) * cur.light * LI;
    sunLight.position.set(P.x - 28, 55, P.z + 26); sunLight.target.position.set(P.x, 0, P.z - 10); sunLight.target.updateMatrixWorld();
    groundMat.color.copy(cur.ground);
    buildMat.color.copy(cur.build);
    buildMat.emissiveIntensity = 0.06 + cur.night * 1.15;
    leafMat.color.setRGB(lerp(0.18, 0.1, cur.night) * cur.light, lerp(0.48, 0.2, cur.night) * cur.light, lerp(0.27, 0.16, cur.night) * cur.light);
    bulbMat.color.setRGB(1, 0.89, 0.63).multiplyScalar(0.35 + cur.night * 0.65);
    haloMat.opacity = cur.night * 0.85;
    skyT -= dt;
    if (skyT <= 0) { paintSky(); skyT = 0.12; }
    sky.position.copy(camera.position);
    sunSprite.position.set(camera.position.x + 70, camera.position.y + 62, camera.position.z - 360);
    sunSprite.material.color.copy(cur.sun);
    const s = cur.sunS * 1.6; sunSprite.scale.set(s, s, 1);
    stars.position.copy(camera.position);
    stars.material.opacity = clamp(cur.night * 1.1, 0, 1);
    mountMat.color.copy(cur.bot).lerp(cur.top, 0.3).multiplyScalar(0.8);
    mountains.position.set(camera.position.x, 0, camera.position.z - 330);
    clouds.forEach(c => {
      const u = c.userData;
      u.ox += u.v * dt * 0.8; if (u.ox > 380) u.ox = -380;
      c.position.set(camera.position.x + u.ox, u.oy, camera.position.z + u.oz);
      c.material.color.copy(cur.hemiS).lerp(WHITE, 0.45).multiplyScalar(0.55 + 0.45 * cur.light * (1 - cur.night * 0.7));
      c.material.opacity = 0.75 - cur.night * 0.5;
    });
    // virage lent de la route (visuel uniquement)
    bendU.uCurveX.value = Math.sin(timeNow * 0.00006 + P.dist * 0.0009) * 0.00055;
    // recyclage des tronçons
    let maxZ = -Infinity, minZ = Infinity, back = null;
    chunks.forEach(ch => { if (ch.z0 > maxZ) { maxZ = ch.z0; back = ch; } if (ch.z0 < minZ) minZ = ch.z0; });
    while (back && back.z0 - CH_LEN > P.z + 22) {
      layoutChunk(back, minZ - CH_LEN);
      minZ -= CH_LEN;
      maxZ = -Infinity; back = null;
      chunks.forEach(ch => { if (ch.z0 > maxZ) { maxZ = ch.z0; back = ch; } });
    }
    // lignes de vitesse
    slMat.opacity = state === 'playing' ? clamp((P.speed - 15) / 16, 0, 1) * 0.3 : 0;
    if (slMat.opacity > 0) speedLines.forEach(m => { if (m.position.z > P.z + 8 || m.position.z === 0) placeLine(m, P.z - rand(8, 70)); });
  }

  // ---------- HUD ----------
  let lastScore = -1, lastCoinsTxt = -1, lastDistTxt = -1;
  function updateHud() {
    const sc = Math.floor(R ? R.score : 0);
    if (sc !== lastScore) { lastScore = sc; elScore.textContent = sc; const el = document.getElementById('current-score'); if (el) el.innerText = sc; }
    if (R && R.coins !== lastCoinsTxt) { lastCoinsTxt = R.coins; elCoins.textContent = R.coins; }
    const dm = Math.floor(P.dist);
    if (dm !== lastDistTxt) { lastDistTxt = dm; elDist.textContent = dm + ' m'; }
    updateChips();
  }

  // ---------- taille & qualité ----------
  function layoutHud() {
    const inStage = !!canvas.closest('#gm-stage');
    if (inStage) { hud.style.left = '0'; hud.style.top = '0'; hud.style.width = '100%'; hud.style.height = '100%'; }
    else { hud.style.left = canvas.offsetLeft + 'px'; hud.style.top = canvas.offsetTop + 'px'; hud.style.width = canvas.clientWidth + 'px'; hud.style.height = canvas.clientHeight + 'px'; }
  }
  function resize() {
    const p = canvas.parentElement;
    if (!p) return;
    const inStage = !!canvas.closest('#gm-stage');
    const w = Math.max(200, p.clientWidth || window.innerWidth);
    const h = inStage ? Math.max(200, p.clientHeight || window.innerHeight) : Math.round(clamp(w * 1.35, 320, window.innerHeight * 0.82));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layoutHud();
  }
  window.addEventListener('resize', resize);

  const perf = { acc: 0, n: 0 };
  function adaptQuality(dt) {
    perf.acc += dt; perf.n++;
    if (perf.n < 100) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0; perf.n = 0;
    if (avg > 0.028 && quality < 2) {
      quality++;
      pixelRatio = quality === 1 ? Math.min(pixelRatio, 1.25) : 0.85;
      renderer.setPixelRatio(pixelRatio);
      resize();
      chunks.forEach(ch => layoutChunk(ch, ch.z0));
    }
  }

  // ---------- boucle principale ----------
  let last = 0;
  function frame(ts) {
    if (stopped) return;
    currentGameLoop = requestAnimationFrame(frame);
    const rdt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    adaptQuality(rdt);
    let dt = rdt;
    if (state === 'dying') {
      deathT += rdt;
      timeScale = lerp(timeScale, 0.22, Math.min(1, rdt * 6));
      dt = rdt * timeScale;
      P.speed *= Math.exp(-rdt * 1.5);
      P.z -= P.speed * dt;
      if (deathT > 1.5) { endRun(); }
    }
    if (!paused) {
      if (state === 'playing') updateRun(dt);
      else if (state === 'dying') { P.y = Math.max(0, P.y + P.vy * dt); }
      stepParticles(dt);
      animateHero(dt);
      updateCamera(rdt);
      updateEnvironment(rdt, ts);
      if (R) updateHud();
    }
    renderer.render(scene, camera);
  }

  // ---------- arrêt propre ----------
  window._skyCleanup = () => {
    stopped = true;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onPD);
    window.removeEventListener('pointermove', onPM);
    window.removeEventListener('pointerup', onPU);
    window.removeEventListener('pointercancel', onPU);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', onPageHide);
    saveGame();
    if (hud.parentNode) hud.parentNode.removeChild(hud);
    try { renderer.dispose(); } catch (e) { /* ignore */ }
    window._skyCleanup = null;
  };

  // ---------- démarrage ----------
  applySkin(SV.skin);
  paletteAt(0); paintSky();
  renderMenu();
  resize();
  if (window.GameMobile) GameMobile.start('skyline', { fluid: true, noScore: true });
  currentGameLoop = requestAnimationFrame(frame);
}