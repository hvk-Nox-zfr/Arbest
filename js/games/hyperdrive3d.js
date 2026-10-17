// ============================================================
// BOUNCE RUSH — la balle avance toute seule et rebondit de plateforme en plateforme.
// Tu la diriges de gauche à droite pour retomber PILE sur chaque plateforme.
//
//  • plateformes flottantes dans un ciel qui change (aurore, lagon, éclipse, cosmos)
//  • chaque rebond joue une note : plus tu es précis, plus la mélodie s'enrichit
//  • atterrissage parfait = combo (jusqu'à ×8) ; pad doré = super-saut au-dessus d'un vide
//  • plateformes mobiles, qui s'effondrent, de plus en plus étroites, de plus en plus vite
//  • gemmes à ramasser -> débloquent 4 billes ; record sauvegardé
//  • contrôles : glisser le doigt / souris, ou ← → (ou Q D) ; qualité auto-adaptative
//
// Remplace l'ancien Hyperdrive 3D (même nom de fonction : startHyperDrive3D).
// ============================================================
window.startHyperDrive3D = function () {
  if (window.GameMobile) GameMobile.reset();
  if (window.__hyperdriveStop) window.__hyperdriveStop();

  // Three.js : chargé à la demande s'il n'est pas déjà sur la page
  if (typeof THREE === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => window.startHyperDrive3D();
    document.head.appendChild(s);
    return;
  }

  let canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const memBoard = document.getElementById('memory-board');
  if (memBoard) memBoard.classList.add('hidden');
  canvas.classList.remove('hidden');
  if (canvas.__ctxKind === '2d' && canvas.parentNode) {
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const IS_TOUCH = !!(window.GameMobile && GameMobile.isTouch);
  const LI = parseInt(THREE.REVISION, 10) >= 155 ? Math.PI : 1;

  const lastSnd = {};
  const snd = (key, f, d, t) => {
    const now = performance.now();
    if (typeof playSound !== 'function' || now - (lastSnd[key] || 0) < 40) return;
    lastSnd[key] = now;
    playSound(f, d, t);
  };

  // ---------- données ----------
  const SAVE_KEY = 'bounce_rush_v1';
  const SKINS = [
    { name: 'SOLEIL',    color: '#ffd23c', glow: '#ff9a1a', cost: 0 },
    { name: 'LAVE',      color: '#ff5a5f', glow: '#ff2a3a', cost: 120 },
    { name: 'JADE',      color: '#4dffb4', glow: '#12d68c', cost: 350 },
    { name: 'NÉBULEUSE', color: '#c58bff', glow: '#8a5bff', cost: 800 }
  ];
  function loadSave() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { s = {}; }
    const o = Object.assign({ best: 0, gems: 0, skin: 0, owned: [true, false, false, false], runs: 0 }, s);
    if (!Array.isArray(o.owned) || o.owned.length < SKINS.length) o.owned = [true, false, false, false];
    return o;
  }
  const SV = loadSave();
  const saveGame = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) { /* ignore */ } };

  const C = h => new THREE.Color(h);
  const PAL = [
    { name: 'AURORE',  top: C('#5a6cff'), bot: C('#ffc7a6'), sun: C('#ffe3c2'), hemiS: C('#ffe7d6'), hemiG: C('#7a6aa8'), plat: C('#3f3b8f'), glow: C('#ff7ab0'), island: C('#7fd18f'), night: 0,    light: 1.1 },
    { name: 'LAGON',   top: C('#0a9fd8'), bot: C('#c9fff1'), sun: C('#fffbe0'), hemiS: C('#e6fbff'), hemiG: C('#3f8f9c'), plat: C('#0e5f78'), glow: C('#1be8c0'), island: C('#4fd6a0'), night: 0,    light: 1.2 },
    { name: 'ÉCLIPSE', top: C('#1c1148'), bot: C('#ff8f63'), sun: C('#ffa070'), hemiS: C('#ffb8a0'), hemiG: C('#2e2152'), plat: C('#3a2470'), glow: C('#c27bff'), island: C('#6d5fb8'), night: 0.25, light: 0.95 },
    { name: 'COSMOS',  top: C('#02030f'), bot: C('#182c6e'), sun: C('#d6e4ff'), hemiS: C('#7a90d8'), hemiG: C('#141a38'), plat: C('#2b4696'), glow: C('#5ab8ff'), island: C('#3b4a8a'), night: 1,    light: 0.85 }
  ];
  const BIOME_LEN = 40, BIOME_FADE = 8;           // en nombre de plateformes
  const cur = { top: C('#000'), bot: C('#000'), sun: C('#000'), hemiS: C('#000'), hemiG: C('#000'), plat: C('#000'), glow: C('#000'), island: C('#000'), night: 0, light: 1, idx: 0, name: '' };
  function paletteAt(p) {
    const d = Math.max(0, p);
    const idx = Math.floor(d / BIOME_LEN) % PAL.length, nxt = (idx + 1) % PAL.length, within = d % BIOME_LEN;
    const f = within > BIOME_LEN - BIOME_FADE ? smooth((within - (BIOME_LEN - BIOME_FADE)) / BIOME_FADE) : 0;
    const a = PAL[idx], b = PAL[nxt];
    ['top', 'bot', 'sun', 'hemiS', 'hemiG', 'plat', 'glow', 'island'].forEach(k => cur[k].copy(a[k]).lerp(b[k], f));
    cur.night = lerp(a.night, b.night, f);
    cur.light = lerp(a.light, b.light, f);
    cur.idx = f > 0.5 ? nxt : idx;
    cur.name = PAL[cur.idx].name;
  }

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
  scene.fog = new THREE.Fog(0xffffff, 40, 190);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  scene.add(camera);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.9 * LI);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.9 * LI);
  sunLight.position.set(-20, 40, 20);
  scene.add(sunLight, sunLight.target);

  // courbure du monde : les plateformes plongent dans la brume au loin
  const bendU = { uCurveY: { value: 0.0009 }, uCurveX: { value: 0 } };
  function bend(mat) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uCurveY = bendU.uCurveY;
      sh.uniforms.uCurveX = bendU.uCurveX;
      sh.vertexShader = 'uniform float uCurveY;\nuniform float uCurveX;\n' +
        sh.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\n mvPosition.y -= uCurveY * mvPosition.z * mvPosition.z;\n mvPosition.x += uCurveX * mvPosition.z * mvPosition.z;\n gl_Position = projectionMatrix * mvPosition;');
    };
    mat.customProgramCacheKey = () => 'bouncebend';
    return mat;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 16; i++) {
      const x = w * (0.2 + Math.random() * 0.6), y = h * (0.35 + Math.random() * 0.3), r = h * (0.25 + Math.random() * 0.3);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });

  // ---------- ciel, soleil, étoiles, nuages, îles, poussière ----------
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
      const t = clamp((pos.getY(i) / SKY_R + 0.25) / 1.0, 0, 1);
      tmpC.copy(cur.bot).lerp(cur.top, Math.pow(t, 0.7));
      col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
    }
    col.needsUpdate = true;
  }
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  sunSprite.renderOrder = -9; sunSprite.frustumCulled = false;
  scene.add(sunSprite);

  const starPos = new Float32Array(320 * 3);
  for (let i = 0; i < 320; i++) {
    const a = Math.random() * TAU, e = Math.random() * 1.5 - 0.2;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * 400; starPos[i * 3 + 1] = Math.sin(e) * 400; starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 400;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  stars.frustumCulled = false; stars.renderOrder = -9;
  scene.add(stars);

  // mer de nuages sous les plateformes (positions dans le monde : on les dépasse = sensation de vitesse)
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false }));
    const sc = rand(90, 200);
    s.scale.set(sc * 2, sc, 1);
    s.position.set(rand(-190, 190), rand(-46, -24), -rand(0, 300));
    s.frustumCulled = false;
    scene.add(s); clouds.push(s);
  }
  // îles flottantes
  const islandMat = bend(new THREE.MeshStandardMaterial({ color: 0x7fd18f, roughness: 1, flatShading: true }));
  const rockMat = bend(new THREE.MeshStandardMaterial({ color: 0x6a6f86, roughness: 1, flatShading: true }));
  const islands = [];
  function placeIsland(g, z) {
    const sc = rand(0.8, 2.4), side = Math.random() < 0.5 ? -1 : 1;
    g.position.set(side * rand(11, 46), rand(-16, -3), z);
    g.scale.setScalar(sc);
    g.rotation.y = rand(0, TAU);
  }
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(rand(2.5, 4), rand(2.2, 3.4), 0.7, 9), islandMat); top.frustumCulled = false;
    const under = new THREE.Mesh(new THREE.ConeGeometry(rand(2.2, 3.4), rand(4, 8), 8), rockMat); under.rotation.x = Math.PI; under.position.y = -0.35 - 3; under.frustumCulled = false;
    g.add(top, under);
    placeIsland(g, -rand(0, 260));
    scene.add(g); islands.push(g);
  }
  // poussière lumineuse (profondeur)
  const MOTES = 150;
  const mPos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) { mPos[i * 3] = rand(-26, 26); mPos[i * 3 + 1] = rand(-6, 14); mPos[i * 3 + 2] = -rand(0, 120); }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const motes = new THREE.Points(mGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false;
  scene.add(motes);

  // ---------- plateformes ----------
  const PW = 2.6, PD = 3.2, PTH = 0.34;
  function slabGeo(w, d, r, depth, bevel) {
    const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -depth, 0);
    return g;
  }
  const bodyGeo = slabGeo(PW, PD, 0.55, PTH, 0.05);
  const insetGeo = slabGeo(PW - 0.55, PD - 0.55, 0.4, 0.03, 0);
  const underGeo = new THREE.ConeGeometry(1.2, 2.4, 6); underGeo.rotateX(Math.PI);
  const platMat = bend(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.15 }));
  const underMat = bend(new THREE.MeshStandardMaterial({ color: 0x5b6280, roughness: 0.9, flatShading: true }));
  const arrowGeo = new THREE.ConeGeometry(0.28, 0.6, 3); arrowGeo.rotateX(-Math.PI / 2);

  const plats = [];            // plateformes actives (ordre de génération)
  const poolPlat = [];
  function makePlatObj() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, platMat);
    const inset = new THREE.Mesh(insetGeo, bend(new THREE.MeshBasicMaterial({ color: 0xffffff })));
    inset.position.y = 0.045;
    const under = new THREE.Mesh(underGeo, underMat); under.position.y = -PTH - 1.2;
    const arrows = new THREE.Group();
    [-0.55, 0.15, 0.85].forEach(z => { const a = new THREE.Mesh(arrowGeo, bend(new THREE.MeshBasicMaterial({ color: 0xffd23c }))); a.position.set(0, 0.2, z); arrows.add(a); });
    g.add(body, inset, under, arrows);
    g.children.forEach(c => { c.frustumCulled = false; });
    arrows.children.forEach(c => { c.frustumCulled = false; });
    scene.add(g);
    return { g, inset, under, arrows };
  }
  function getPlatObj() { const o = poolPlat.pop() || makePlatObj(); o.g.visible = true; return o; }

  // ---------- balle ----------
  const R = 0.42, REST = 0.5;
  const ball = new THREE.Group();
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.25, emissive: 0xff9a1a, emissiveIntensity: 0.45 });
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 18), ballMat);
  ballMesh.frustumCulled = false;
  const ballOutline = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 24, 18), new THREE.MeshBasicMaterial({ color: 0x0c1022, side: THREE.BackSide }));
  ballOutline.frustumCulled = false;
  ballMesh.add(ballOutline);
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7fd8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7, fog: false }));
  ballGlow.scale.set(2.6, 2.6, 1);
  ball.add(ballMesh, ballGlow);
  scene.add(ball);
  const ghosts = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(R * 0.9, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.frustumCulled = false; scene.add(m); ghosts.push(m);
  }
  const hist = []; // positions passées de la balle
  function applySkin(i) {
    ballMat.color.set(SKINS[i].color); ballMat.emissive.set(SKINS[i].glow);
    ballGlow.material.color.set(SKINS[i].glow);
    ghosts.forEach(g => g.material.color.set(SKINS[i].glow));
  }
  // repère de visée : montre où la balle va retomber (vert = sur la plateforme, rouge = dans le vide)
  const aim = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 28), bend(new THREE.MeshBasicMaterial({ color: 0x7dffb2, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })));
  aim.rotation.x = -Math.PI / 2; aim.frustumCulled = false; aim.visible = false; scene.add(aim);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.frustumCulled = false; blob.visible = false; scene.add(blob);

  // anneaux d'onde à l'atterrissage
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.55, 0.68, 36);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(ringGeo, bend(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.frustumCulled = false; m.userData = { t: 1, big: 1 };
    scene.add(m); rings.push(m);
  }
  let ringHead = 0;
  function spawnRing(x, z, color, size) {
    const m = rings[ringHead]; ringHead = (ringHead + 1) % rings.length;
    m.position.set(x, 0.12, z); m.material.color.set(color); m.userData.t = 0; m.userData.big = size; m.visible = true;
  }

  // gemmes
  const gemGeo = new THREE.OctahedronGeometry(0.28, 0);
  const gemMat = bend(new THREE.MeshStandardMaterial({ color: 0x7dffe0, emissive: 0x14c9a6, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.2 }));
  const gems = [], poolGem = [];
  function getGem() {
    let g = poolGem.pop();
    if (!g) { g = new THREE.Mesh(gemGeo, gemMat); g.frustumCulled = false; scene.add(g); }
    g.visible = true; gems.push(g);
    return g;
  }

  // particules
  const PN = 260;
  const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pBase = new Float32Array(PN * 3);
  const pLife = new Float32Array(PN), pMax = new Float32Array(PN).fill(1);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; scene.add(points);
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
        pLife[i] -= dt; pVel[i * 3 + 1] -= 8 * dt;
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        const f = Math.max(0, pLife[i] / pMax[i]);
        pCol[i * 3] = pBase[i * 3] * f; pCol[i * 3 + 1] = pBase[i * 3 + 1] * f; pCol[i * 3 + 2] = pBase[i * 3 + 2] * f;
      } else { pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; }
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }

  // ---------- état du jeu ----------
  const B = { x: 0, tx: 0, y: REST, z: 0 };
  let state = 'ready';              // ready | playing | falling | over
  let paused = false, stopped = false;
  let hopIdx = 0, hopA = null, hopB = null, u = 0, T = 0.5, H = 1.6, vz = 14;
  let score = 0, combo = 0, perfectRun = 0, runGems = 0, landings = 0;
  let fallT = 0, fallVy = 0, shake = 0, squash = 0, beat = 0, boostKick = 0, lastBiome = 0;
  let idleT = 0, camInit = false, fov = 62, quality = 0, nextIdx = 0;
  const camPos = new THREE.Vector3(0, 4, 8), camLook = new THREE.Vector3();
  const LIM = 4.3, D = 7.2;

  // vitesse : démarre à ~60 % puis monte progressivement (les 14 premiers rebonds servent d'échauffement)
  const speedFor = i => (13.5 + 12 * (1 - Math.exp(-i / 110))) * (0.6 + 0.4 * smooth(clamp(i / 14, 0, 1)));
  function hopParams(i, dist) {
    const v = speedFor(i), t = dist / v;
    return { v, t, h: clamp(7.5 * t * t, 1.25, dist > D * 1.5 ? 5.4 : 3.0) };
  }

  // ---------- génération des plateformes ----------
  function addPlatform() {
    const i = nextIdx++;
    const prev = plats.length ? plats[plats.length - 1] : null;
    const o = getPlatObj();
    const p = { i, obj: o, g: o.g, x0: 0, x: 0, z: 0, w: PW, type: 'normal', amp: 0, freq: 0, phase: 0, long: false, pulse: 0, crumble: -1, fall: 0, gone: false };

    const gap = prev && prev.type === 'boost' ? 2 * D : D;
    p.long = !!(prev && prev.type === 'boost');
    p.z = prev ? prev.z - gap : 0;

    // type
    let type = 'normal';
    if (i > 5) {
      const r = Math.random();
      const mv = i > 14 ? 0.13 : 0, cr = i > 10 ? 0.12 : 0, bo = i > 8 ? 0.09 : 0;
      if (prev && (prev.type === 'boost' || prev.type === 'moving')) type = 'normal';
      else if (r < bo) type = 'boost';
      else if (r < bo + mv) type = 'moving';
      else if (r < bo + mv + cr) type = 'crumble';
    }
    p.type = type;

    // largeur : se réduit avec la progression
    const base = i < 8 ? 3.0 : lerp(2.7, 1.8, clamp(i / 220, 0, 1));
    p.w = i === 0 ? 3.4 : (p.long ? Math.max(base, 2.6) : base) * rand(0.92, 1.08);

    // position latérale en zigzag gauche / droite
    if (!prev) p.x0 = 0;
    else {
      const hp = hopParams(i, gap), maxLat = 10 * hp.t;
      const swing = i < 6 ? rand(0.8, 1.6) : rand(1.7, clamp(maxLat * 0.85, 2.0, 5.6));
      let dir = prev.x0 >= 0 ? -1 : 1;
      if (Math.random() < 0.2) dir = -dir;
      let x = prev.x0 + dir * swing;
      if (Math.abs(x) > 3.9) x = clamp(prev.x0 - dir * swing, -3.9, 3.9);
      p.x0 = clamp(x, -3.9, 3.9);
    }
    if (type === 'moving') { p.amp = rand(1.0, 1.7); p.freq = rand(0.8, 1.3); p.phase = rand(0, TAU); p.x0 = clamp(p.x0, -2.4, 2.4); }
    p.x = p.x0;

    // visuel
    p.g.position.set(p.x, 0, p.z);
    p.g.scale.set(1, 1, 1);
    p.g.rotation.set(0, 0, 0);
    p.obj.body = p.obj.g.children[0];
    p.obj.body.scale.x = p.w / PW;
    p.obj.inset.scale.x = p.w / PW;
    p.obj.arrows.visible = type === 'boost';
    p.obj.under.scale.set(p.w / PW, 1, 1);
    p.obj.under.material = underMat;
    const col = type === 'boost' ? 0xffd23c : type === 'moving' ? 0xc58bff : type === 'crumble' ? 0xff8a6a : null;
    p.glowCol = col;
    plats.push(p);

    // gemmes sur la trajectoire idéale du saut qui mène à cette plateforme
    if (prev && Math.random() < 0.7) {
      const n = p.long ? 6 : 3, hp = hopParams(i, gap);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1), gm = getGem();
        gm.position.set(lerp(prev.x0, p.x0, t), REST + 4 * hp.h * t * (1 - t) + 0.25, lerp(prev.z, p.z, t));
      }
    }
    return p;
  }
  function ensureAhead() { while (!plats.length || plats[plats.length - 1].z > B.z - 200) addPlatform(); }

  function recycleBehind() {
    for (let i = plats.length - 1; i >= 0; i--) {
      const p = plats[i];
      if (p.z > B.z + 14 || p.gone) {
        p.g.visible = false; p.g.position.y = 0; p.g.scale.set(1, 1, 1);
        poolPlat.push(p.obj);
        plats.splice(i, 1);
      }
    }
    for (let i = gems.length - 1; i >= 0; i--) {
      if (gems[i].position.z > B.z + 10) { gems[i].visible = false; poolGem.push(gems[i]); gems.splice(i, 1); }
    }
  }

  // ---------- interface ----------
  if (!document.getElementById('bn-style')) {
    const st = document.createElement('style');
    st.id = 'bn-style';
    st.textContent = `
.bn-hud{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;font-family:'Rajdhani','Segoe UI',system-ui,sans-serif;color:#fff;overflow:hidden;-webkit-user-select:none;user-select:none}
.bn-ui{pointer-events:auto}
.bn-top{position:absolute;top:10px;left:0;right:0;text-align:center}
.bn-score{font-size:46px;font-weight:800;line-height:1;text-shadow:0 3px 16px rgba(0,0,0,.45);letter-spacing:1px}
.bn-mult{display:inline-block;margin-top:4px;padding:2px 12px;border-radius:999px;font-weight:800;font-size:18px;background:rgba(15,18,30,.45);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .2s}
.bn-gems{position:absolute;top:12px;left:12px;display:flex;align-items:center;gap:6px;font-weight:700;font-size:18px;text-shadow:0 1px 8px rgba(0,0,0,.5)}
.bn-gems i{width:13px;height:13px;transform:rotate(45deg);background:linear-gradient(135deg,#d6fff6,#14c9a6);display:inline-block;box-shadow:0 0 8px rgba(20,201,166,.8)}
.bn-pausebtn{position:absolute;top:10px;right:54px;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(15,18,30,.45);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#fff;font-size:15px;pointer-events:auto;cursor:pointer;padding:0}
.bn-pop{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-weight:800;font-size:28px;letter-spacing:2px;text-shadow:0 3px 16px rgba(0,0,0,.55);animation:bnpop 1s ease-out forwards;white-space:nowrap}
@keyframes bnpop{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}15%{opacity:1;transform:translate(-50%,0) scale(1.1)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-30px) scale(1)}}
.bn-count{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);font-size:120px;font-weight:900;color:#fff;text-shadow:0 6px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none}
.bn-count.go{animation:bncount .7s ease-out forwards}
@keyframes bncount{0%{opacity:0;transform:translate(-50%,-50%) scale(1.8)}25%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(.85)}}
.bn-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,0) 40%,rgba(255,255,255,.5));opacity:0;transition:opacity .25s}
.bn-hint{position:absolute;left:50%;bottom:11%;transform:translateX(-50%);padding:10px 16px;border-radius:14px;background:rgba(15,18,30,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-weight:700;font-size:16px;text-align:center;transition:opacity .6s}
.bn-start{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;padding:14px;box-sizing:border-box;overflow-y:auto;max-height:100%}
.bn-card{margin-top:auto;width:min(94%,420px);padding:16px;border-radius:22px;background:rgba(12,16,32,.68);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.16);box-shadow:0 20px 60px rgba(0,0,0,.4);box-sizing:border-box;text-align:center}
.bn-title{font-size:36px;font-weight:900;letter-spacing:4px;line-height:1;background:linear-gradient(90deg,#9be7ff,#c58bff 60%,#ff8fb8);-webkit-background-clip:text;background-clip:text;color:transparent}
.bn-title span{display:block;font-size:17px;letter-spacing:9px;color:#fff;-webkit-text-fill-color:#fff;opacity:.85;margin-top:4px}
.bn-stats{display:flex;justify-content:center;gap:28px;margin:10px 0}
.bn-stats b{display:block;font-size:22px}.bn-stats small{font-size:11px;letter-spacing:2px;opacity:.65}
.bn-skins{display:flex;gap:8px;justify-content:center;margin:6px 0 12px}
.bn-skin{flex:1;min-width:0;padding:8px 4px;border-radius:12px;background:rgba(255,255,255,.07);border:2px solid transparent;color:#fff;font-family:inherit;font-weight:700;font-size:11px;letter-spacing:.5px;cursor:pointer}
.bn-skin.on{border-color:#9be7ff}
.bn-skin .sw{width:26px;height:26px;border-radius:50%;margin:0 auto 5px;box-shadow:0 0 10px currentColor}
.bn-play{width:100%;padding:14px;border:none;border-radius:14px;font-family:inherit;font-weight:900;font-size:22px;letter-spacing:3px;color:#10142a;background:linear-gradient(90deg,#9be7ff,#c58bff);box-shadow:0 8px 24px rgba(155,160,255,.45);cursor:pointer}
.bn-play:active{transform:scale(.98)}
.bn-keys{margin-top:8px;font-size:12px;opacity:.65;letter-spacing:.5px}
.bn-pause{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,10,24,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.bn-pause .bn-card{width:min(86%,320px);margin:0}
.bn-pause .bn-play{margin-top:10px}
@media (orientation:landscape) and (max-height:520px){
  .bn-start{align-items:center}.bn-card{margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;width:min(96%,720px);text-align:left;align-items:center}
  .bn-card .bn-title{font-size:28px}.bn-score{font-size:36px}
}`;
    document.head.appendChild(st);
  }
  const hud = document.createElement('div');
  hud.className = 'gm-hud bn-hud';
  hud.innerHTML = `
    <div class="bn-top" id="bn-top" style="display:none"><div class="bn-score" id="bn-score">0</div><div class="bn-mult" id="bn-mult">×1</div></div>
    <div class="bn-gems" id="bn-gemsbox" style="display:none"><i></i><b id="bn-gems">0</b></div>
    <button class="bn-pausebtn bn-ui" id="bn-pausebtn" style="display:none" aria-label="Pause">❚❚</button>
    <div class="bn-count" id="bn-count"></div>
    <div class="bn-flash" id="bn-flash"></div>
    <div class="bn-hint" id="bn-hint" style="display:none"></div>
    <div class="bn-start" id="bn-start">
      <div class="bn-card bn-ui gm-scroll">
        <div><div class="bn-title">BOUNCE<span>RUSH</span></div>
          <div class="bn-stats"><div><b id="bn-best">0</b><small>RECORD</small></div><div><b id="bn-bank">0</b><small>GEMMES</small></div></div></div>
        <div><div class="bn-skins" id="bn-skins"></div>
          <button class="bn-play" id="bn-play">JOUER</button>
          <div class="bn-keys">${IS_TOUCH ? 'Glisse le doigt à gauche / droite pour viser' : '← → ou glisse la souris pour viser'}</div></div>
      </div>
    </div>
    <div class="bn-pause bn-ui" id="bn-pause"><div class="bn-card"><div class="bn-title" style="font-size:30px">PAUSE</div>
      <button class="bn-play" id="bn-resume">REPRENDRE</button>
      <button class="bn-play" id="bn-quit" style="background:rgba(255,255,255,.14);color:#fff;box-shadow:none;font-size:15px;margin-top:8px">TERMINER LA PARTIE</button></div></div>`;
  container.appendChild(hud);
  const $ = id => hud.querySelector('#' + id);
  const elScore = $('bn-score'), elMult = $('bn-mult'), elGems = $('bn-gems'), elFlash = $('bn-flash'), elStart = $('bn-start'), elSkins = $('bn-skins');
  const elCount = $('bn-count'), elTop = $('bn-top'), elGemBox = $('bn-gemsbox'), elPauseBtn = $('bn-pausebtn'), elHint = $('bn-hint'), elPause = $('bn-pause');

  function pop(text, color) {
    const e = document.createElement('div');
    e.className = 'bn-pop'; e.textContent = text;
    if (color) e.style.color = color;
    e.addEventListener('animationend', () => e.remove());
    hud.appendChild(e);
    while (hud.querySelectorAll('.bn-pop').length > 3) hud.querySelector('.bn-pop').remove();
  }
  function renderStart() {
    $('bn-best').textContent = SV.best;
    $('bn-bank').textContent = SV.gems;
    elSkins.innerHTML = SKINS.map((s, i) => {
      const owned = SV.owned[i], on = SV.skin === i;
      return `<button class="bn-skin ${on ? 'on' : ''}" data-skin="${i}"><div class="sw" style="background:${s.color};color:${s.glow}"></div>${s.name}<br><span style="opacity:.7">${on ? 'ÉQUIPÉE' : owned ? 'CHOISIR' : '◆ ' + s.cost}</span></button>`;
    }).join('');
  }
  elStart.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'bn-play') { beginCountdown(); return; }
    if (b.dataset.skin !== undefined) {
      const i = +b.dataset.skin;
      if (!SV.owned[i]) {
        if (SV.gems < SKINS[i].cost) { pop('Pas assez de gemmes', '#ff9a8a'); return; }
        SV.gems -= SKINS[i].cost; SV.owned[i] = true; snd('buy', 880, 0.12, 'triangle');
      }
      SV.skin = i; applySkin(i); saveGame(); renderStart();
    }
  });
  elPauseBtn.addEventListener('click', () => setPause(true));
  $('bn-resume').addEventListener('click', () => setPause(false));
  $('bn-quit').addEventListener('click', () => { setPause(false); endRun(); });
  function setPause(v) {
    if (state !== 'playing') return;
    paused = v;
    elPause.style.display = v ? 'flex' : 'none';
  }

  // ---------- déroulement d'une partie ----------
  function beginHop() {
    // on repart de la plateforme où l'on vient d'atterrir (les plus anciennes sont recyclées, donc pas d'index fixe)
    hopA = hopB || plats[0];
    hopB = plats[plats.indexOf(hopA) + 1];
    const dist = hopA.z - hopB.z, hp = hopParams(hopB.i, dist);
    vz = hp.v * (boostKick > 0.5 ? 1.08 : 1);
    T = dist / vz;
    H = hp.h;
    u = 0;
  }

  // 1) le joueur touche l'écran : compte à rebours 3-2-1 pendant que la balle rebondit sur place
  let cdT = 0, cdShown = -1, launchEase = 0;
  function beginCountdown() {
    if (state !== 'ready') return;
    state = 'countdown'; cdT = 0; cdShown = -1;
    elStart.style.display = 'none';
    elTop.style.display = 'block'; elGemBox.style.display = 'flex';
    elHint.style.display = 'block'; elHint.style.opacity = 1;
    elHint.innerHTML = IS_TOUCH ? 'Glisse à gauche / droite pour viser<br>Retombe au centre des plateformes' : '← → pour viser<br>Retombe au centre des plateformes';
    snd('go', 440, 0.1, 'triangle');
  }
  function showCount(txt) {
    elCount.textContent = txt;
    elCount.classList.remove('go'); void elCount.offsetWidth; elCount.classList.add('go');
  }
  // 2) la balle atterrit sur la plateforme de départ puis la partie démarre
  function startRun() {
    if (state !== 'countdown') return;
    state = 'playing';
    launchEase = 1.4;
    hopIdx = 0; score = 0; combo = 0; perfectRun = 0; runGems = 0; landings = 0; hopA = hopB = null;
    B.y = REST; B.z = 0;   // on garde la position latérale choisie pendant le compte à rebours
    ensureAhead();
    beginHop();
    elPauseBtn.style.display = 'block';
    setTimeout(() => { elHint.style.opacity = 0; setTimeout(() => { elHint.style.display = 'none'; }, 700); }, 2600);
    snd('go', 784, 0.2, 'triangle');
  }

  const MELODY = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 7, 5, 4, 2, 3];
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
  function noteSound(perfect) {
    const n = MELODY[landings % MELODY.length];
    snd('note', SCALE[n], 0.2, 'triangle');
    if (perfect) snd('note2', SCALE[Math.min(7, n + 2)], 0.16, 'sine');
    if (landings % 4 === 0) snd('bass', 130.8, 0.28, 'sine');
  }
  const mult = () => Math.min(8, 1 + Math.floor(perfectRun / 3));

  function land(p, dx) {
    const half = p.w / 2 + 0.08;
    const perfect = Math.abs(dx) < half * 0.42;
    landings++;
    if (perfect) { perfectRun++; combo++; } else { perfectRun = 0; combo = 0; }
    const m = mult();
    score += (10 + (perfect ? 5 : 0)) * m;
    p.pulse = 1; beat = 1; squash = 1;
    spawnRing(B.x, p.z, perfect ? 0xffd23c : cur.glow.getHex(), perfect ? 2.6 : 1.7);
    emit(B.x, 0.3, p.z, perfect ? new THREE.Color(0xffe27a) : cur.glow, perfect ? 16 : 7, 5, 3.5, 0.55);
    noteSound(perfect);
    if (perfect && perfectRun > 0 && perfectRun % 5 === 0) pop('SÉRIE ×' + m, '#ffd23c');
    else if (perfect) pop('PARFAIT', '#ffe27a');
    if (p.type === 'crumble') p.crumble = 0.35;
    if (p.type === 'boost') { boostKick = 1; shake = Math.max(shake, 0.2); snd('boost', 360, 0.3, 'sawtooth'); pop('SUPER SAUT !', '#ffd23c'); emit(B.x, 0.4, p.z, new THREE.Color(0xffd23c), 24, 7, 6, 0.8); }
    hopIdx++;
    if (hopIdx >= 1 && (hopIdx % BIOME_LEN) === 0) { /* changement d'ambiance annoncé par paletteAt */ }
  }

  function miss(p) {
    state = 'falling'; fallT = 0;
    fallVy = Math.min(4 * H * (1 - 2 * Math.min(1, u)) / T, -2);   // vitesse verticale au moment de l'impact
    shake = 1; snd('miss', 140, 0.5, 'sawtooth');
    elFlash.style.opacity = 1; setTimeout(() => { elFlash.style.opacity = 0; }, 240);
    elPauseBtn.style.display = 'none';
    pop('RATÉ !', '#ff8a8a');
  }

  function endRun() {
    if (state === 'over') return;
    if (state === 'ready') return;
    state = 'over';
    const finalScore = Math.floor(score);
    if (finalScore > SV.best) { SV.best = finalScore; }
    SV.gems += runGems;
    SV.runs++;
    saveGame();
    elTop.style.display = 'none'; elGemBox.style.display = 'none';
    stopped = true;
    if (typeof triggerGameOver === 'function') triggerGameOver(finalScore);
  }

  function updatePlaying(dt, time) {
    u += dt / T;
    let guard = 0;
    while (u >= 1 && state === 'playing' && guard++ < 3) {
      const rem = (u - 1) * T;
      B.z = hopB.z;
      const dx = B.x - hopB.x;
      if (Math.abs(dx) <= hopB.w / 2 + 0.08) {
        land(hopB, dx);
        beginHop();
        u = rem / T;
      } else { B.y = REST; miss(hopB); u = Math.min(u, 1.0001); break; }
    }
    if (state !== 'playing') return;
    const uu = Math.min(u, 1);
    B.z = lerp(hopA.z, hopB.z, uu);
    B.y = REST + 4 * H * uu * (1 - uu);
    // pad doré : léger fondu de l'effet
    boostKick = Math.max(0, boostKick - dt * 0.8);
  }

  function updateBallControl(dt) {
    if (keyL) B.tx -= 11 * dt;
    if (keyR) B.tx += 11 * dt;
    B.tx = clamp(B.tx, -LIM, LIM);
    B.x += (B.tx - B.x) * (1 - Math.exp(-20 * dt));
  }

  // ---------- entrées ----------
  let keyL = false, keyR = false;
  function onKeyDown(e) {
    const left = e.code === 'ArrowLeft' || e.code === 'KeyA', right = e.code === 'ArrowRight' || e.code === 'KeyD';
    if (left || right || e.code === 'Space') e.preventDefault();
    if (left) keyL = true;
    if (right) keyR = true;
    if ((left || right || e.code === 'Space') && state === 'ready' && !e.repeat) beginCountdown();
    if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'playing') setPause(!paused);
  }
  const onKeyUp = e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyL = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keyR = false;
  };
  let drag = null;
  const inGame = t => !!t && (t === canvas || (t.closest && (t.closest('#gm-stage') || t.closest('.bn-hud'))));
  const rayV = new THREE.Vector3();
  function worldXAt(clientX) {
    const r = canvas.getBoundingClientRect();
    const ndc = ((clientX - r.left) / r.width) * 2 - 1;
    camera.updateMatrixWorld();
    rayV.set(ndc, 0, 0.5).unproject(camera).sub(camera.position).normalize();
    const t = (B.z - camera.position.z) / (rayV.z || -1);
    return camera.position.x + rayV.x * t;
  }
  function onPD(e) {
    if (!inGame(e.target) || (e.target.closest && e.target.closest('.bn-ui'))) return;
    if (state === 'ready') beginCountdown();
    drag = { id: e.pointerId, wx: worldXAt(e.clientX), tx: B.tx };
  }
  function onPM(e) {
    if (!drag || drag.id !== e.pointerId || paused) return;
    B.tx = clamp(drag.tx + (worldXAt(e.clientX) - drag.wx) * 1.15, -LIM, LIM);
  }
  const onPU = e => { if (drag && drag.id === e.pointerId) drag = null; };
  const onVis = () => { if (document.hidden) { saveGame(); if (state === 'playing') setPause(true); } };
  const onPageHide = () => saveGame();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPD);
  window.addEventListener('pointermove', onPM);
  window.addEventListener('pointerup', onPU);
  window.addEventListener('pointercancel', onPU);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onPageHide);

  // ---------- mise à jour de la scène ----------
  const platCol = new THREE.Color();
  function updatePlatforms(dt, time) {
    for (const p of plats) {
      if (p.type === 'moving') { p.x = p.x0 + Math.sin(time * 0.001 * p.freq * TAU * 0.5 + p.phase) * p.amp; p.g.position.x = p.x; }
      if (p.crumble > 0) { p.crumble -= dt; if (p.crumble <= 0) { p.fall = 0.001; } }
      if (p.fall > 0) { p.fall += dt; p.g.position.y = -p.fall * p.fall * 18; p.g.rotation.z = p.fall * 0.8; if (p.fall > 1.6) p.gone = true; }
      p.pulse = Math.max(0, p.pulse - dt * 2.6);
      const k = 1 + p.pulse * 0.5;
      if (p.pulse > 0) p.g.scale.y = 1 - p.pulse * 0.12; else p.g.scale.y = 1;
      // couleur du liseré : ambiance / type, plus lumineux au pulse
      if (p.glowCol) platCol.setHex(p.glowCol); else platCol.copy(cur.glow);
      platCol.multiplyScalar(0.75 + p.pulse * 0.9 + beat * 0.15);
      p.obj.inset.material.color.copy(platCol);
      if (p.type === 'boost') p.obj.arrows.position.z = Math.sin(time * 0.01) * 0.15;
    }
  }

  function updateBallVisual(dt, time) {
    ball.position.set(B.x, B.y, B.z);
    // squash & stretch
    squash = Math.max(0, squash - dt * 7);
    const vy = state === 'playing' ? 4 * H * (1 - 2 * Math.min(u, 1)) / T : fallVy;
    const stretch = clamp(1 + Math.abs(vy) * 0.016, 1, 1.3);
    const sq = squash > 0 ? 1 - 0.32 * smooth(squash) : 1;
    const sy = squash > 0 ? sq : stretch, sxz = 1 / Math.sqrt(sy);
    ballMesh.scale.set(sxz, sy, sxz);
    ballMesh.rotation.x -= dt * vz * 0.5;
    ballGlow.material.opacity = 0.55 + beat * 0.4;
    ballGlow.scale.setScalar(2.4 + beat * 1.0);
    // traînée
    hist.unshift(ball.position.clone());
    if (hist.length > 40) hist.pop();
    ghosts.forEach((g, i) => {
      const h = hist[Math.min(hist.length - 1, (i + 1) * 3)];
      if (h && state !== 'ready' && state !== 'countdown') { g.position.copy(h); g.material.opacity = (0.28 - i * 0.04) * (state === 'playing' ? 1 : 0.4); g.scale.setScalar(1 - i * 0.12); }
      else g.material.opacity = 0;
    });
    // repère de visée + ombre
    if (state === 'playing' && hopB) {
      aim.visible = true; blob.visible = true;
      const inside = Math.abs(B.x - hopB.x) <= hopB.w / 2 + 0.08;
      aim.position.set(B.x, 0.14, hopB.z);
      aim.material.color.set(inside ? 0x7dffb2 : 0xff7a7a);
      aim.material.opacity = 0.55 + Math.sin(time * 0.012) * 0.2;
      aim.scale.setScalar(0.9 + (1 - Math.min(u, 1)) * 0.5);
      blob.position.set(B.x, 0.13, B.z);
      const bs = clamp(1.25 - (B.y - REST) * 0.15, 0.35, 1.25);
      blob.scale.set(bs, bs, 1);
      blob.material.opacity = 0.32;
    } else {
      aim.visible = false;
      blob.visible = state === 'ready' || state === 'countdown';
      if (state === 'ready' || state === 'countdown') { blob.position.set(B.x, 0.13, B.z); const bs = clamp(1.25 - (B.y - REST) * 0.2, 0.4, 1.25); blob.scale.set(bs, bs, 1); }
    }
  }

  function updateRings(dt) {
    rings.forEach(m => {
      if (!m.visible) return;
      m.userData.t += dt * 2.2;
      const t = m.userData.t;
      if (t >= 1) { m.visible = false; return; }
      m.scale.setScalar(1 + t * m.userData.big * 2);
      m.material.opacity = (1 - t) * 0.8;
    });
  }

  function updateGems(dt, time) {
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.rotation.y += dt * 3; g.position.y += Math.sin(time * 0.006 + g.position.z) * 0.002;
      if (state === 'playing') {
        const dx = g.position.x - B.x, dy = g.position.y - B.y, dz = g.position.z - B.z;
        if (dx * dx + dy * dy + dz * dz < 1.0) {
          g.visible = false; poolGem.push(g); gems.splice(i, 1);
          runGems++; score += 5 * mult();
          snd('gem', 1200 + Math.min(8, runGems % 10) * 60, 0.05, 'sine');
          emit(g.position.x, g.position.y, g.position.z, new THREE.Color(0x7dffe0), 5, 3, 3, 0.4);
        }
      }
    }
  }

  function updateCamera(dt, rdt) {
    const aspect = camera.aspect;
    const baseFov = aspect < 1 ? 62 + (1 - aspect) * 42 : 62;
    const portrait = aspect < 1;
    const pos = new THREE.Vector3(B.x * 0.45, 4.5 + (portrait ? 1.0 : 0) + clamp(B.y - REST, 0, 3) * 0.12, B.z + 7.6 + (portrait ? 2.4 : 0));
    const look = new THREE.Vector3(B.x * 0.6, 0.5, B.z - 11);
    if (state === 'ready' || state === 'countdown') { pos.set(Math.sin(idleT * 0.35) * 1.2, 3.4, B.z + 6.2 + (portrait ? 2.0 : 0)); look.set(0, 0.9, B.z - 7); }
    if (!camInit) { camPos.copy(pos); camLook.copy(look); camInit = true; }
    launchEase = Math.max(0, launchEase - rdt);
    const kk = 1 - Math.exp(-(state === 'ready' || state === 'countdown' ? 3 : launchEase > 0 ? 3.5 : 8) * rdt);
    camPos.lerp(pos, kk); camLook.lerp(look, kk);
    camera.position.copy(camPos);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; shake = Math.max(0, shake - rdt * 2.2); }
    camera.lookAt(camLook);
    camera.rotateZ((B.tx - B.x) * 0.01);
    const tf = baseFov + (state === 'playing' ? clamp((vz - 13) / 12, 0, 1) * 10 : 0) + boostKick * 14;
    fov += (tf - fov) * Math.min(1, rdt * 4);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  let skyT = 0;
  const WHITE = new THREE.Color(1, 1, 1);
  function updateEnvironment(rdt, time) {
    const progress = hopIdx + (state === 'playing' ? Math.min(u, 1) : 0);
    paletteAt(progress);
    if (cur.idx !== lastBiome) { if (state === 'playing') pop(cur.name, '#ffffff'); lastBiome = cur.idx; }
    beat = Math.max(0, beat - rdt * 3);
    scene.fog.color.copy(cur.bot);
    hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = (0.95 + beat * 0.15) * cur.light * LI;
    sunLight.color.copy(cur.sun); sunLight.intensity = (0.55 + 0.45 * (1 - cur.night)) * cur.light * LI;
    sunLight.position.set(B.x - 22, 40, B.z + 22); sunLight.target.position.set(B.x, 0, B.z - 8); sunLight.target.updateMatrixWorld();
    platMat.color.copy(cur.plat);
    islandMat.color.copy(cur.island);
    rockMat.color.copy(cur.hemiG).lerp(WHITE, 0.2);
    underMat.color.copy(cur.hemiG).lerp(cur.plat, 0.15);
    skyT -= rdt;
    if (skyT <= 0) { paintSky(); skyT = 0.12; }
    sky.position.copy(camera.position);
    sunSprite.position.set(camera.position.x + 60, camera.position.y + 45, camera.position.z - 330);
    sunSprite.material.color.copy(cur.sun);
    const s = lerp(170, 80, cur.night); sunSprite.scale.set(s, s, 1);
    stars.position.copy(camera.position);
    stars.material.opacity = clamp(cur.night * 1.1, 0, 1);

    // nuages / îles / poussière : recyclés vers l'avant
    const cz = camera.position.z;
    clouds.forEach(c => {
      if (c.position.z > cz + 60) { c.position.set(rand(-190, 190), rand(-46, -24), cz - rand(220, 320)); }
      c.material.color.copy(cur.hemiS).lerp(WHITE, 0.5).multiplyScalar(0.5 + 0.5 * cur.light * (1 - cur.night * 0.6));
      c.material.opacity = 0.85 - cur.night * 0.45;
    });
    islands.forEach(g => { if (g.position.z > cz + 30) placeIsland(g, cz - rand(150, 260)); g.rotation.y += rdt * 0.05; });
    for (let i = 0; i < MOTES; i++) {
      mPos[i * 3 + 1] += Math.sin(time * 0.001 + i) * 0.003;
      if (mPos[i * 3 + 2] > cz + 8) { mPos[i * 3] = camera.position.x + rand(-26, 26); mPos[i * 3 + 1] = rand(-6, 14); mPos[i * 3 + 2] = cz - rand(60, 130); }
    }
    mGeo.attributes.position.needsUpdate = true;
    motes.material.opacity = 0.35 + cur.night * 0.35;
    bendU.uCurveX.value = Math.sin(hopIdx * 0.07) * 0.0005;
  }

  // ---------- HUD, taille, qualité ----------
  let lastScore = -1, lastGems = -1, lastMult = -1;
  function updateHud() {
    const sc = Math.floor(score);
    if (sc !== lastScore) { lastScore = sc; elScore.textContent = sc; const el = document.getElementById('current-score'); if (el) el.innerText = sc; }
    if (runGems !== lastGems) { lastGems = runGems; elGems.textContent = runGems; }
    const m = mult();
    if (m !== lastMult) {
      lastMult = m;
      elMult.textContent = '×' + m;
      elMult.style.opacity = m > 1 ? 1 : 0;
      elMult.style.color = m >= 6 ? '#ff8fb8' : m >= 3 ? '#ffd23c' : '#9be7ff';
    }
  }
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
    const h = inStage ? Math.max(200, p.clientHeight || window.innerHeight) : Math.round(clamp(w * 1.3, 320, window.innerHeight * 0.82));
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
    const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
    if (avg > 0.028 && quality < 2) {
      quality++;
      pixelRatio = quality === 1 ? Math.min(pixelRatio, 1.25) : 0.85;
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
  }

  // ---------- boucle ----------
  let last = 0;
  function frame(ts) {
    if (stopped) return;
    currentGameLoop = requestAnimationFrame(frame);
    const rdt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    adaptQuality(rdt);
    if (!paused) {
      idleT += rdt;
      if (state === 'ready' || state === 'countdown') {
        // la balle rebondit sur place (en attendant le toucher, puis pendant le compte à rebours)
        const ph = (idleT % 0.75) / 0.75;
        const landedNow = ph < rdt / 0.75;
        B.y = REST + 4 * 1.1 * ph * (1 - ph);
        if (landedNow) { squash = 1; spawnRing(B.x, 0, cur.glow.getHex(), 1.3); snd('idle', 523.25, 0.12, 'triangle'); }
        B.z = 0; vz = 14;
        if (state === 'countdown') {
          updateBallControl(rdt);
          cdT += rdt;
          const n = 3 - Math.floor(cdT / 0.75);
          if (n >= 1 && n !== cdShown) { cdShown = n; showCount(String(n)); snd('cd', 392 + (3 - n) * 100, 0.12, 'sine'); }
          if (cdT >= 2.25 && landedNow) { showCount('GO !'); startRun(); }
        } else B.x = 0;
      } else if (state === 'playing') {
        updateBallControl(rdt);
        updatePlaying(rdt, ts);
        if (state === 'playing') { ensureAhead(); recycleBehind(); }
      } else if (state === 'falling') {
        fallT += rdt;
        fallVy -= 32 * rdt;
        B.y += fallVy * rdt;
        B.z -= vz * rdt * 0.5;
        B.x += (B.tx - B.x) * (1 - Math.exp(-6 * rdt));
        if (fallT > 1.3) endRun();
      }
      stepParticles(rdt);
      updatePlatforms(rdt, ts);
      updateGems(rdt, ts);
      updateRings(rdt);
      updateBallVisual(rdt, ts);
      updateCamera(rdt, rdt);
      updateEnvironment(rdt, ts);
      if (state === 'playing') updateHud();
    }
    renderer.render(scene, camera);
  }

  // ---------- arrêt propre ----------
  window.__hyperdriveStop = function () {
    stopped = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('pointerdown', onPD);
    window.removeEventListener('pointermove', onPM);
    window.removeEventListener('pointerup', onPU);
    window.removeEventListener('pointercancel', onPU);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVis);
    saveGame();
    if (hud.parentNode) hud.parentNode.removeChild(hud);
    try { renderer.dispose(); } catch (e) { /* ignore */ }
    window.__hyperdriveStop = null;
  };

  // ---------- démarrage ----------
  applySkin(SV.skin);
  paletteAt(0); paintSky();
  addPlatform();            // plateforme de départ (large, au centre)
  ensureAhead();
  renderStart();
  resize();
  if (window.GameMobile) GameMobile.start('hyperdrive', { fluid: true, noScore: true });
  currentGameLoop = requestAnimationFrame(frame);
};