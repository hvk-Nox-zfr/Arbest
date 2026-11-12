// ============================================================
// SKYLINE RUSH — runner 3D moderne (Three.js)
//
//  • monde courbe façon "planète" (shader), brouillard atmosphérique
//  • cycle aube → plein jour → crépuscule → nuit (ville qui s'allume)
//  • héros animé : course, saut, glissade, jetpack, tenues débloquables
//  • style Subway Surfers : voies ferrées, trains colorés, RAMPES pour monter sur les toits,
//    wagons bas sur lesquels atterrir, pièces sur les toits, GARDE qui te poursuit (1er choc = trébuchement)
//  • obstacles variés et DENSES : barrières, portiques, conteneurs, trains, slaloms, haies enchaînées
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
    { name: 'RUSH',   main: '#e5301f', accent: '#ffb020', cost: 0 },
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
    { name: 'PLEIN JOUR',  top: C('#0a7ef0'), bot: C('#a8dcff'), sun: C('#fff8e6'), hemiS: C('#e8f7ff'), hemiG: C('#73839a'), ground: C('#8f6b68'), build: C('#edf6ff'), light: 1.25, night: 0, city: true,  sunS: 115 },
    { name: 'CRÉPUSCULE',  top: C('#2c1a58'), bot: C('#ff7a5e'), sun: C('#ff9362'), hemiS: C('#ffb59a'), hemiG: C('#3a2a50'), ground: C('#4a3f5e'), build: C('#c4a8c6'), light: 0.95, night: 0, city: true,  sunS: 190 },
    { name: 'NUIT',        top: C('#03061a'), bot: C('#18244f'), sun: C('#d2e2ff'), hemiS: C('#7088cc'), hemiG: C('#151b37'), ground: C('#0d1227'), build: C('#7580b4'), light: 0.85, night: 1, city: true,  sunS: 70 },
    { name: 'AUBE',        top: C('#34418f'), bot: C('#ffb28a'), sun: C('#ffd9a8'), hemiS: C('#ffd9c4'), hemiG: C('#4c4460'), ground: C('#4e4a66'), build: C('#c9b9d4'), light: 1.0,  night: 0, city: true,  sunS: 150 }
  ];
  const BIOME_LEN = 1000000, BIOME_FADE = 240; // conserver le plein jour lumineux du visuel de référence
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
  scene.fog = new THREE.Fog(0xffffff, 60, 340);
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
    const puffs = [[60,84,28],[100,68,38],[148,60,42],[196,74,34],[228,90,22],[128,88,40],[82,94,26],[176,94,30]];
    g.fillStyle = '#fff';
    puffs.forEach(q => { g.beginPath(); g.arc(q[0], q[1], q[2], 0, TAU); g.fill(); });
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 40, 0, 125);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(140,180,240,0.8)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
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
  const farTex = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(110,150,210,' + (0.25 + Math.random() * 0.35) + ')'; g.fillRect(4 + (i % 6) * 10, 6 + Math.floor(i / 6) * 12, 5, 7); }
  });
  const mountMat = new THREE.MeshBasicMaterial({ color: 0x334466, map: farTex, fog: false });
  for (let i = 0; i < 36; i++) {
    const h = rand(100, 250), m = new THREE.Mesh(new THREE.BoxGeometry(rand(16, 34), h, rand(16, 34)), mountMat);
    m.position.set(-500 + i * 28 + rand(-6, 6), h / 2 - 45, rand(-40, 20));
    mountains.add(m);
    if (Math.random() < 0.5) { const sp = new THREE.Mesh(new THREE.ConeGeometry(2.2, rand(14, 34), 6), mountMat); sp.position.set(m.position.x, h - 45 + 10, m.position.z); mountains.add(sp); }
  }
  mountains.frustumCulled = false;
  scene.add(mountains);
  // Hélicoptère orange de la jaquette, volant au-dessus des immeubles.
  const helicopter = new THREE.Group();
  const heliOrange = new THREE.MeshStandardMaterial({color:0xe98b32, roughness:0.48, metalness:0.18});
  const heliGlass = new THREE.MeshStandardMaterial({color:0x174b83, emissive:0x0b254b, roughness:0.2, metalness:0.25});
  const heliBody = new THREE.Mesh(new THREE.SphereGeometry(1,16,12),heliOrange); heliBody.scale.set(1.35,0.62,0.72); helicopter.add(heliBody);
  const heliNose = new THREE.Mesh(new THREE.SphereGeometry(0.52,14,10),heliGlass); heliNose.scale.set(1.05,0.72,0.68); heliNose.position.set(0,0.08,-0.53); helicopter.add(heliNose);
  const heliTail = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.22,2.25,8),heliOrange); heliTail.rotation.x=Math.PI/2; heliTail.position.set(0,0.1,1.48); helicopter.add(heliTail);
  const heliFin = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.65,0.38),heliOrange); heliFin.position.set(0,0.42,2.45); helicopter.add(heliFin);
  const heliSkidMat = new THREE.MeshStandardMaterial({color:0x292d3d,metalness:0.55,roughness:0.42});
  [-0.65,0.65].forEach(x=>{const s=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,2.15,8),heliSkidMat);s.rotation.z=Math.PI/2;s.position.set(x,-0.65,0);helicopter.add(s);});
  const heliMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.55,8),heliSkidMat); heliMast.position.y=0.72; helicopter.add(heliMast);
  const heliRotor = new THREE.Group();
  for(let i=0;i<4;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.035,4.8),heliSkidMat);blade.rotation.y=i*Math.PI/2;heliRotor.add(blade);}
  heliRotor.position.y=1.02; helicopter.add(heliRotor);
  const tailRotor = new THREE.Group();
  for(let i=0;i<3;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.0,0.07),heliSkidMat);b.rotation.z=i*Math.PI/3;tailRotor.add(b);}
  tailRotor.position.set(0,0.1,2.5); helicopter.add(tailRotor);
  scene.add(helicopter);


  // ---------- matériaux du monde ----------
  // voies ferrées : ballast + traverses + rails (une paire de rails par voie, façon Subway Surfers)
  const roadTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7d5649'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const v = 78 + Math.random() * 105 | 0;
      g.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.35 + Math.random() * 0.4})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    const u = x => w * (0.5 + x / 8.4);
    [-2.4, 0, 2.4].forEach(cx => {
      for (let k = 0; k < 8; k++) {
        const y = k * h / 8 + 3;
        g.fillStyle = '#4f3226'; g.fillRect(u(cx - 1.02), y, u(cx + 1.02) - u(cx - 1.02), 10);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(u(cx - 1.02), y + 8, u(cx + 1.02) - u(cx - 1.02), 2);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(u(cx - 1.02), y, u(cx + 1.02) - u(cx - 1.02), 2);
      }
      [-0.55, 0.55].forEach(dx => {
        g.fillStyle = '#7f8cab'; g.fillRect(u(cx + dx) - 3.5, 0, 7, h);
        g.fillStyle = 'rgba(225,238,255,0.9)'; g.fillRect(u(cx + dx) - 1, 0, 1.5, h);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(u(cx + dx) + 2.5, 0, 1.5, h);
      });
    });
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 3);
  const roadMat = bend(new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9, metalness: 0 }));
  const groundMat = bend(new THREE.MeshStandardMaterial({ color: 0x766477, roughness: 1, metalness: 0 }));
  const wallTex = canvasTex(512, 128, (g, w, h) => {
    const bgW = g.createLinearGradient(0, 0, 0, h); bgW.addColorStop(0, '#6f72d8'); bgW.addColorStop(1, '#4a46b0'); g.fillStyle = bgW; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    const cols = ['#ff3d6e', '#ffd23c', '#2fd0ff', '#7dff6a', '#b35cff', '#ff8a2a'];
    const words = ['SKY', 'RUSH', 'ZAP', 'RUN', 'GO!', 'WOW', 'JET', 'FLY', 'MAX'];
    for (let i = 0; i < 2; i++) {
      const wd = pick(words);
      g.save(); g.translate(10 + i * 290, 90); g.rotate((Math.random() - 0.5) * 0.2);
      g.font = '900 60px Arial';
      g.lineWidth = 6; g.strokeStyle = '#1a1a24'; g.strokeText(wd, 0, 0);
      g.fillStyle = pick(cols); g.fillText(wd, 0, 0); g.restore();
    }
    g.save(); g.translate(w * 0.5, 44); g.strokeStyle = '#ffd23c'; g.lineWidth = 7; g.lineJoin = 'round'; g.shadowColor = '#ffb300'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(-26, 40); g.lineTo(-32, 6); g.lineTo(-14, 22); g.lineTo(0, -6); g.lineTo(14, 22); g.lineTo(32, 6); g.lineTo(26, 40); g.closePath(); g.stroke(); g.restore();
    g.fillStyle = '#e9e9ef'; g.fillRect(0, 0, w, 7);
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(5, 1);
  const curbMat = bend(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }));

  // fenêtres : 1 texture couleur (jour) + 1 texture émissive (nuit), même disposition
  const winLayout = []; for (let i = 0; i < 16; i++) winLayout.push(Math.random() < 0.55);
  const winColTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#405b91'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = winLayout[r * 4 + c] ? pick(['#79dcff','#ffe08a','#ffb6d7','#c6b5ff']) : '#283f70'; g.fillRect(c * 32 + 4, r * 32 + 5, 24, 20); g.fillStyle='rgba(255,255,255,.28)'; g.fillRect(c*32+5,r*32+6,22,2); }
  });
  const winEmitTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (winLayout[r * 4 + c]) { g.fillStyle = pick(['#ffe3a0', '#fff1c8', '#ffd480', '#cfe6ff']); g.fillRect(c * 32 + 5, r * 32 + 6, 22, 18); }
  });
  [winColTex, winEmitTex].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const buildMat = bend(new THREE.MeshStandardMaterial({ map: winColTex, emissiveMap: winEmitTex, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.7, metalness: 0.1 }));

  const FACADES = [
    { base: '#4a98ee', base2: '#2a66cc', win: '#b4e6ff', dark: '#1d4a9a' },
    { base: '#f6bd94', base2: '#e89a76', win: '#7aa8e6', dark: '#3c5e9e' },
    { base: '#f2f6fc', base2: '#cbdaf0', win: '#5aaaf2', dark: '#2d6ab8' },
    { base: '#a384ec', base2: '#7656cc', win: '#ffe8a4', dark: '#47348f' },
    { base: '#52cdd0', base2: '#2fa2b4', win: '#eafcff', dark: '#1f6f86' },
    { base: '#f592b8', base2: '#da6a92', win: '#fff2c8', dark: '#9a3d66' }
  ];
  const bMats = FACADES.map(f => {
    const lay = []; for (let i = 0; i < 16; i++) lay.push(Math.random() < 0.5);
    const col = canvasTex(128, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, f.base); gr.addColorStop(1, f.base2);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const x = c * 32 + 4, y = r * 32 + 4;
        g.fillStyle = f.dark; g.fillRect(x - 1, y - 1, 26, 26);
        g.fillStyle = f.win; g.fillRect(x, y, 24, 24);
        g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x, y, 24, 7);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, r * 32 + 30, w, 2);
      }
    });
    const em = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (lay[r * 4 + c]) { g.fillStyle = '#ffe3a0'; g.fillRect(c * 32 + 4, r * 32 + 4, 24, 24); }
    });
    [col, em].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    return bend(new THREE.MeshStandardMaterial({ map: col, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.65 }));
  });
  const skirtMat = bend(new THREE.MeshStandardMaterial({ color: 0xb9b4c8, roughness: 0.9 }));

  function buildingGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const su = f < 2 ? d / 6 : f < 4 ? w / 6 : w / 6;
      const sv = f < 2 ? h / 12 : f < 4 ? d / 6 : h / 12;
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
    }
    g.translate(0, h / 2, 0);
    return g;
  }
  const BUILD_GEOS = [[8, 18, 8], [9, 26, 8], [8, 36, 9], [12, 22, 10], [8, 40, 8], [10, 30, 9], [14, 15, 11], [9, 32, 8]].map(a => buildingGeo(a[0], a[1], a[2]));

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

  const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.translate(0, 0.5, 0);
  const spireGeo = new THREE.ConeGeometry(0.5, 1, 6); spireGeo.translate(0, 0.5, 0);
  const spireMat = bend(new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.3, metalness: 0.7 }));
  const railMat = bend(new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0x7a3000, emissiveIntensity: 0.35, roughness: 0.45 }));

  // ---------- tronçons de monde recyclés ----------
  const ROAD_W = 8.4, CH_LEN = 30, NCH = 9, SLOTS = 4;
  const roadGeo = new THREE.PlaneGeometry(ROAD_W, CH_LEN); roadGeo.rotateX(-Math.PI / 2);
  const sideGeo = new THREE.PlaneGeometry(90, CH_LEN); sideGeo.rotateX(-Math.PI / 2);
  const curbGeo = new THREE.BoxGeometry(0.5, 1.5, CH_LEN);
  const chunks = [];
  const nofrustum = o => { o.frustumCulled = false; return o; };

  function makeChunk() {
    const g = new THREE.Group();
    g.add(nofrustum(new THREE.Mesh(roadGeo, roadMat)));
    [-1, 1].forEach(s => {
      const side = nofrustum(new THREE.Mesh(sideGeo, groundMat)); side.position.set(s * (ROAD_W / 2 + 45), -8.06, 0); g.add(side);
      const skirt = nofrustum(new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, CH_LEN), skirtMat)); skirt.position.set(s * (ROAD_W / 2 + 0.7), -4, 0); g.add(skirt);
      const curb = nofrustum(new THREE.Mesh(curbGeo, curbMat)); curb.position.set(s * (ROAD_W / 2 + 0.7), 0.75, 0); g.add(curb);
      const rail = nofrustum(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, CH_LEN), railMat)); rail.position.set(s * (ROAD_W / 2 + 0.7), 2.05, 0); g.add(rail);
      for (let k = 0; k < 5; k++) { const po = nofrustum(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), poleMat)); po.position.set(s * (ROAD_W / 2 + 0.7), 1.75, -CH_LEN / 2 + 3 + k * 6); g.add(po); }
    });
    const slots = [];
    [-1, 1].forEach(s => {
      for (let i = 0; i < SLOTS; i++) {
        const b = nofrustum(new THREE.Mesh(BUILD_GEOS[0], buildMat));
        const topB = nofrustum(new THREE.Mesh(unitBox, buildMat)), spire = nofrustum(new THREE.Mesh(spireGeo, spireMat));
        b.add(topB, spire); b.userData.top = topB; b.userData.spire = spire;
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
        sl.b.material = pick(bMats);
        const w = sl.b.geometry.boundingBox.max.x * 2;
        sl.b.position.set(sl.side * (ROAD_W / 2 + 3.5 + w / 2 + rand(0, 9)), -8, lz + rand(-1, 1));
        sl.b.visible = true;
        {
          const bb = sl.b.geometry.boundingBox, bw = bb.max.x * 2, bd = bb.max.z * 2, bh = bb.max.y;
          const tp = sl.b.userData.top, sp = sl.b.userData.spire;
          tp.material = sl.b.material;
          if (bh > 20) {
            const th = bh * 0.22;
            tp.visible = true; tp.scale.set(bw * 0.66, th, bd * 0.66); tp.position.y = bh;
            sp.visible = Math.random() < 0.7; sp.scale.set(bw * 0.16, bh * 0.2, bw * 0.16); sp.position.y = bh + th;
          } else { tp.visible = false; sp.visible = false; }
        }
        if (sl.i % 2 === 0 && quality < 2) { sl.lamp.position.set(sl.side * (ROAD_W / 2 + 1.7), 0, lz); sl.lamp.visible = true; }
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
  const matJeans = new THREE.MeshStandardMaterial({ color: 0x262d5c, roughness: 0.8 });
  const matJeansL = new THREE.MeshStandardMaterial({ color: 0x3a4482, roughness: 0.8 });
  const matShoe = new THREE.MeshStandardMaterial({ color: 0xe8262c, roughness: 0.4 });
  const matSole = new THREE.MeshStandardMaterial({ color: 0xf6f1e8, roughness: 0.55 });
  const matCap = new THREE.MeshStandardMaterial({ color: 0x16171f, roughness: 0.5 });
  const matShirt = new THREE.MeshStandardMaterial({ color: 0xf4f1f6, roughness: 0.7 });
  const matLine = new THREE.MeshBasicMaterial({ color: 0x2a0d1c, side: THREE.BackSide });
  const crownTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#262a38'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffb020'; g.lineWidth = 9; g.lineJoin = 'round'; g.shadowColor = '#ff9a00'; g.shadowBlur = 14;
    g.beginPath(); g.moveTo(26, 88); g.lineTo(20, 42); g.lineTo(48, 64); g.lineTo(64, 30); g.lineTo(80, 64); g.lineTo(108, 42); g.lineTo(102, 88); g.closePath(); g.stroke();
  });
  const matPack = new THREE.MeshStandardMaterial({ map: crownTex, emissiveMap: crownTex, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.5 });
  function roundBox(w, h, d, r, bev) {
    const W = w - 2 * bev, H = h - 2 * bev, x = -W / 2, y = -H / 2, sh = new THREE.Shape();
    sh.moveTo(x + r, y); sh.lineTo(x + W - r, y); sh.quadraticCurveTo(x + W, y, x + W, y + r); sh.lineTo(x + W, y + H - r);
    sh.quadraticCurveTo(x + W, y + H, x + W - r, y + H); sh.lineTo(x + r, y + H); sh.quadraticCurveTo(x, y + H, x, y + H - r);
    sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    const D = d - 2 * bev;
    const g = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -D / 2);
    return g;
  }
  const capG = (r, len) => THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(r, len, 6, 14) : new THREE.CylinderGeometry(r, r, len + 2 * r, 14);
  const body = new THREE.Group(); body.position.y = 0.92; pose.add(body);
  const mk = (geo, mat, x, y, z, parent, line) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || body).add(m); m.frustumCulled = false;
    if (line) { const o = new THREE.Mesh(geo, matLine); o.scale.setScalar(line); o.frustumCulled = false; m.add(o); }
    return m;
  };
  // sweat à capuche
  mk(roundBox(0.68, 0.62, 0.46, 0.16, 0.08), matSuit, 0, 0.34, 0, body, 1.05);
  mk(roundBox(0.72, 0.13, 0.5, 0.05, 0.05), matSuit, 0, 0.05, 0, body, 1.05);
  mk(roundBox(0.62, 0.08, 0.42, 0.03, 0.03), matShirt, 0, -0.04, 0);
  mk(roundBox(0.56, 0.16, 0.4, 0.06, 0.06), matSuit, 0, 0.66, 0.03, body, 1.05);                                // col de la capuche
  // sac à dos + bretelles
  mk(roundBox(0.42, 0.48, 0.15, 0.08, 0.05), matDark, 0, 0.42, 0.29, body, 1.04);
  mk(new THREE.PlaneGeometry(0.32, 0.36), matPack, 0, 0.42, 0.37);
  [-0.2, 0.2].forEach(x => mk(new THREE.BoxGeometry(0.06, 0.34, 0.05), matDark, x, 0.5, 0.25));
  // tête : visage + capuche relevée + casquette
  const head = new THREE.Group(); head.position.set(0, 0.9, 0); body.add(head);
  mk(new THREE.SphereGeometry(0.19, 16, 12), matSkin, 0, -0.02, -0.04, head);
  const hood = mk(new THREE.SphereGeometry(0.27, 20, 16), matSuit, 0, 0.04, 0.06, head, 1.05); hood.scale.set(1.0, 0.98, 0.95);
  mk(roundBox(0.44, 0.32, 0.22, 0.1, 0.06), matSuit, 0, -0.1, 0.22, head, 1.05);                                // retombée de capuche
  mk(new THREE.TorusGeometry(0.2, 0.05, 8, 20), matSuit, 0, 0.0, -0.17, head);                                  // bord avant de la capuche
  const brim = mk(roundBox(0.3, 0.05, 0.22, 0.04, 0.02), matCap, 0.04, 0.02, -0.3, head, 1.08); brim.rotation.y = -0.15;
  // membres arrondis (bras : épaule + avant-bras plié + manchette + main)
  function armR_(x) {
    const g = new THREE.Group(); g.position.set(x, 0.58, 0); g.rotation.z = Math.sign(x) * 0.1;
    mk(capG(0.1, 0.2), matSuit, 0, -0.17, 0, g, 1.07);
    const fore = new THREE.Group(); fore.position.y = -0.3; fore.rotation.x = -0.4; g.add(fore);
    mk(capG(0.092, 0.16), matSuit, 0, -0.12, 0, fore, 1.07);
    mk(new THREE.SphereGeometry(0.105, 12, 10), matSuit, 0, -0.27, 0, fore);
    mk(new THREE.SphereGeometry(0.09, 12, 10), matSkin, 0, -0.35, 0, fore);
    mk(new THREE.SphereGeometry(0.04, 8, 6), matSkin, Math.sign(x) * -0.07, -0.33, -0.04, fore);
    return g;
  }
  function legR_(x) {
    const g = new THREE.Group(); g.position.set(x, 0, 0);
    mk(capG(0.115, 0.5), matJeans, 0, -0.38, 0, g, 1.06);
    mk(new THREE.CylinderGeometry(0.128, 0.135, 0.07, 14), matJeansL, 0, -0.68, 0, g);
    mk(roundBox(0.25, 0.17, 0.44, 0.08, 0.05), matShoe, 0, -0.8, -0.07, g, 1.06);
    mk(roundBox(0.27, 0.07, 0.46, 0.03, 0.03), matSole, 0, -0.9, -0.07, g);
    mk(new THREE.SphereGeometry(0.1, 10, 8), matSole, 0, -0.82, -0.24, g).scale.set(1, 0.8, 0.7);
    return g;
  }
  const armL = armR_(-0.4), armR = armR_(0.4);
  const legL = legR_(-0.15), legR = legR_(0.15);
  function limb(x, y, len, r, mat, endMat) {      // membres simples (utilisés par le garde)
    const g = new THREE.Group(); g.position.set(x, y, 0);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 10), mat); seg.position.y = -len / 2; seg.frustumCulled = false;
    const end = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 10, 8), endMat); end.position.y = -len; end.frustumCulled = false;
    g.add(seg, end);
    return g;
  }
  body.add(armL, armR, legL, legR);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI / 2; flame.position.set(0, 0.1, 0.62); flame.visible = false; body.add(flame);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), new THREE.MeshBasicMaterial({ color: 0x59d8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  bubble.position.y = 0.95; bubble.visible = false; hero.add(bubble);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; scene.add(blob);
  scene.add(hero);
  pose.scale.setScalar(1.2);
  function applySkin(i) { matSuit.color.set(SKINS[i].main); matAcc.color.set(SKINS[i].accent); matAcc.emissive.set(SKINS[i].accent); }

  // ---------- le garde qui te poursuit (trébuchement) ----------
  const guard = new THREE.Group(); guard.visible = false;
  const gSuit = new THREE.MeshStandardMaterial({ color: 0x2b4fd6, roughness: 0.6 });
  const gPants = new THREE.MeshStandardMaterial({ color: 0x1b2a6b, roughness: 0.7 });
  const gCap = new THREE.MeshStandardMaterial({ color: 0xd9262f, roughness: 0.5 });
  const gBody = new THREE.Group(); gBody.position.y = 0.92; guard.add(gBody);
  const gm = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || gBody).add(m); m.frustumCulled = false; return m; };
  gm(new THREE.CylinderGeometry(0.3, 0.26, 0.68, 12), gSuit, 0, 0.34, 0);
  gm(new THREE.SphereGeometry(0.21, 14, 10), matSkin, 0, 0.95, 0);
  gm(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 12), gCap, 0, 1.1, 0);
  gm(new THREE.BoxGeometry(0.3, 0.04, 0.22), gCap, 0, 1.06, -0.2);
  const gArmL = limb(-0.37, 0.6, 0.55, 0.08, gSuit, matSkin), gArmR = limb(0.37, 0.6, 0.55, 0.08, gSuit, matSkin);
  const gLegL = limb(-0.14, 0, 0.82, 0.1, gPants, matDark), gLegR = limb(0.14, 0, 0.82, 0.1, gPants, matDark);
  gBody.add(gArmL, gArmR, gLegL, gLegR);
  scene.add(guard);
  let guardZ = 40, guardX = 0;
  function updateGuard(dt) {
    const chasing = (state === 'playing' && P.stumble > 0) || state === 'dying';
    const target = chasing ? P.z + (state === 'dying' ? 1.6 : 3.6) : P.z + 26;
    guardZ += (target - guardZ) * Math.min(1, dt * (chasing ? 5 : 2));
    guardX += (P.x - guardX) * Math.min(1, dt * 6);
    guard.visible = state !== 'menu' && guardZ < P.z + 20;
    if (!guard.visible) return;
    const t = performance.now() * 0.014 * (state === 'dying' ? 0.2 : 1);
    const a = Math.sin(t);
    gLegL.rotation.x = a; gLegR.rotation.x = -a; gArmL.rotation.x = -a * 0.9; gArmR.rotation.x = a * 0.9;
    gBody.rotation.x = -0.16;
    guard.position.set(guardX, P.floor, guardZ);
  }

  // ---------- obstacles & objets ----------
  function hazardTex() {
    return canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#fff8ed'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f52e3d';
      for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
    });
  }
  const hazMat = bend(new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.7 }));
  const concreteMat = bend(new THREE.MeshStandardMaterial({ color: 0xdcdcd6, roughness: 0.85 }));
  const lampOrange = new THREE.MeshBasicMaterial({ color: 0xff9a2a });
  const signTex = canvasTex(256, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#13b8ff'); gr.addColorStop(1,'#0873da');
    g.fillStyle = gr; g.fillRect(0,0,w,h); g.strokeStyle='#dff8ff'; g.lineWidth=17; g.lineJoin='round';
    for (let i=0;i<3;i++){ const y=28+i*44; g.beginPath(); g.moveTo(65,y+22); g.lineTo(128,y-5); g.lineTo(191,y+22); g.stroke(); }
    g.strokeStyle='rgba(255,255,255,.4)'; g.lineWidth=4; g.strokeRect(5,5,w-10,h-10);
  });
  const signMat = bend(new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 }));
  const frameMat = bend(new THREE.MeshStandardMaterial({ color: 0x3a3f4e, roughness: 0.5, metalness: 0.6 }));
  const CONTAINER_COLORS = ['#d9462f', '#2f7bd9', '#e0a21a', '#2fa56a', '#7b5bd6'];
  const containerMats = CONTAINER_COLORS.map(col => {
    const tex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let x = 0; x < w; x += 12) g.fillRect(x, 0, 4, h);
      g.fillStyle = 'rgba(245,251,255,0.95)'; g.fillRect(14, h - 26, 70, 10);
    });
    return bend(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.25 }));
  });
  const roofMat = bend(new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.6, metalness: 0.4 }));
  const trainBodyMats = ['#dce6f1', '#eef1f6', '#cbd8e8'].map(c => bend(new THREE.MeshStandardMaterial({ color: c, roughness: 0.36, metalness: 0.46 })));
  const trainStripeMat = bend(new THREE.MeshStandardMaterial({ color: 0xff9b24, emissive: 0xb74b00, emissiveIntensity: 0.22, roughness: 0.38, metalness: 0.25 }));
  const rampMat = bend(new THREE.MeshStandardMaterial({ color: 0xe9c43a, roughness: 0.6, metalness: 0.2 }));
  const trainTrimMat = bend(new THREE.MeshStandardMaterial({ color: 0xd9e5eb, roughness: 0.32, metalness: 0.72 }));
  const trainGlassMat = bend(new THREE.MeshStandardMaterial({ color: 0x2f7fd0, emissive: 0x0e4a96, roughness: 0.18, metalness: 0.25 }));
  const trainLightMat = new THREE.MeshBasicMaterial({ color: 0xffe7a0 });

  const obstacles = [], coins = [], powers = [];
  const poolObs = { barrier: [], gantry: [], block: [], train: [], low: [], ramp: [] };
  const poolCoin = [];
  const poolPow = { magnet: [], shield: [], double: [], jet: [] };

  function makeObstacle(type) {
    const g = new THREE.Group();
    let o;
    if (type === 'barrier') {
      const mats = [concreteMat, concreteMat, concreteMat, concreteMat, hazMat, hazMat];
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.6), mats); b.position.y = 0.55; g.add(b);
      [-0.72, 0.72].forEach(x => { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.5,0.34),concreteMat); foot.position.set(x,0.25,0); g.add(foot); const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lampOrange); l.position.set(x, 1.08, 0); g.add(l); });
      o = { hw: 1.0, hl: 0.35, y0: 0, y1: 0.9 };
    } else if (type === 'gantry') {
      [-1.0, 1.0].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.22), frameMat); p.position.set(x, 1.3, 0); g.add(p); });
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 0.26), signMat); s.position.y = 1.8; g.add(s);
      o = { hw: 1.05, hl: 0.3, y0: 1.2, y1: 2.6 };
    } else if (type === 'train') {
      // Rame de métro (longueur et couleur variables). On peut courir sur son toit via une rampe.
      const L = pick([7.6, 10.8, 10.8]);
      const bodyMat = pick(trainBodyMats);
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.05, 3.05, L), bodyMat);
      car.position.y = 1.58; g.add(car);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, L - 0.35), roofMat);
      roof.position.set(0, 3.18, 0); g.add(roof);
      const lowerStripe = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.25, L + 0.02), trainStripeMat);
      lowerStripe.position.set(0, 0.72, 0); g.add(lowerStripe);
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.9, 0.07), trainGlassMat);
      windshield.position.set(0, 2.35, L / 2 + 0.05); g.add(windshield);
      const glassDivider = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.88,0.085),trainTrimMat); glassDivider.position.set(0,2.35,L/2+0.10); g.add(glassDivider);
      const destination = new THREE.Mesh(new THREE.BoxGeometry(0.78,0.16,0.08),new THREE.MeshBasicMaterial({color:0xffcf59})); destination.position.set(0,2.91,L/2+0.08); g.add(destination);
      const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.08), trainStripeMat);
      noseStripe.position.set(0, 1.55, L / 2 + 0.07); g.add(noseStripe);
      [-0.62, 0.62].forEach(x => {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), trainLightMat);
        lamp.position.set(x, 1.18, L / 2 + 0.08); g.add(lamp);
      });
      [-1, 1].forEach(side => {
        for (let z = -(L / 2 - 1.25); z <= L / 2 - 1.45; z += 1.65) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.72, 1.05), trainGlassMat);
          win.position.set(side * 1.035, 2.25, z); g.add(win);
          const frame = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 1.12), trainTrimMat);
          frame.position.set(side * 1.045, 2.64, z); g.add(frame);
        }
      });
      [-1, 1].forEach(side => {
        [-(L / 2 - 1.6), L / 2 - 1.6].forEach(z => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 12), frameMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(side * 1.02, 0.38, z); g.add(wheel);
        });
      });
      o = { hw: 1.08, hl: L / 2 + 0.05, y0: 0, y1: 3.25, flat: true };
    } else if (type === 'low') {
      // Wagon bas : on peut sauter dessus et courir sur son toit.
      const m = pick(containerMats);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 4.4), [m, m, roofMat, roofMat, m, m]); b.position.y = 0.65; g.add(b);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.1, 4.48), trainTrimMat); rim.position.y = 1.3; g.add(rim);
      o = { hw: 1.05, hl: 2.2, y0: 0, y1: 1.3, flat: true };
    } else if (type === 'ramp') {
      // Rampe : mène au toit d'un train (hauteur H sur RL mètres).
      const H = 3.25, RL = 8;
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(RL, 0); sh.lineTo(RL, H); sh.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 2.0, bevelEnabled: false });
      geo.translate(0, 0, -1.0); geo.rotateY(Math.PI / 2); geo.translate(0, 0, RL / 2);
      const w = new THREE.Mesh(geo, rampMat); g.add(w);
      [-0.85, 0.85].forEach(x => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lampOrange); l.position.set(x, 0.2, RL / 2 + 0.05); g.add(l); });
      o = { hw: 1.0, hl: RL / 2, y0: 0, y1: H, H, ramp: true };
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
  const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 28);
  const starShape = new THREE.Shape();
  for (let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, r=i%2===0?0.235:0.105, x=Math.cos(a)*r, y=Math.sin(a)*r; if(i===0) starShape.moveTo(x,y); else starShape.lineTo(x,y); }
  starShape.closePath();
  const coinStarGeo = new THREE.ShapeGeometry(starShape);
  const coinStarMat = new THREE.MeshBasicMaterial({color:0xffec74, side:THREE.DoubleSide});
  const coinRimGeo = new THREE.TorusGeometry(0.42, 0.05, 8, 28);
  const coinRimMat = bend(new THREE.MeshStandardMaterial({ color: 0xe89a00, emissive: 0x8a4a00, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.6 }));
  function getCoin() {
    let c = poolCoin.pop();
    if (!c) {
      c = new THREE.Group();
      const disc = new THREE.Mesh(coinGeo, goldMat); disc.rotation.x = Math.PI / 2; c.add(disc);
      const star = new THREE.Mesh(coinStarGeo, coinStarMat); star.position.z = 0.062; star.scale.setScalar(1.2); c.add(star);
      const star2 = new THREE.Mesh(coinStarGeo, coinStarMat); star2.position.z = -0.062; star2.scale.setScalar(1.2); c.add(star2);
      const rimF = new THREE.Mesh(coinRimGeo, coinRimMat); c.add(rimF);
      const gl = glowSprite(0xffc83a, 1.7); gl.material = gl.material.clone(); gl.material.opacity = 0.35; c.add(gl);
      c.frustumCulled = false; scene.add(c);
    }
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
  const P = { x: 0, z: 0, y: 0, vy: 0, lane: 1, sliding: false, slideT: 0, speed: 0, dist: 0, inv: 0, jet: 0, jetEnd: 0, phase: 0, coyote: 0, jumpBuf: 0, airDive: false, floor: 0, stumble: 0 };
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

  // Étendue de chaque motif [vers le joueur, vers l'horizon] — sert à espacer les rangées sans chevauchement.
  const EXT = {
    coins: [0, 13], block1: [3.2, 3.2], blockPair: [3.2, 3.2], barriers: [3.5, 3.5], barrierAll: [3.5, 3.5],
    gantry: [3.5, 5], gantryAll: [3.5, 5], train: [5.6, 5.6], mixed: [3.5, 3.5], trainMix: [5.6, 5.6],
    lowcar: [2.4, 2.4], rampTrain: [14, 5.6], slalom: [2, 22], hurdles: [2, 14], trainWall: [5.6, 5.6], power: [1, 8]
  };
  function spawnRow(zNear) {
    const d = P.dist, diff = clamp(d / 3500, 0, 1);
    let kind;
    if (d < 100) kind = pick(['coins', 'block1', 'barriers', 'barriers', 'gantry']);
    else {
      // Beaucoup plus d'obstacles : peu de rangées de pièces seules, des motifs enchaînés
      // (slalom, haies, rampes + trains) et des combinaisons multi-voies de plus en plus fréquentes.
      const w = [
        ['coins',      0.07 - 0.04 * diff],
        ['block1',     0.08],
        ['barriers',   0.12],
        ['gantry',     0.09],
        ['barrierAll', 0.04 + 0.03 * diff],
        ['blockPair',  0.06 + 0.06 * diff],
        ['gantryAll',  0.04 + 0.03 * diff],
        ['train',      0.10 + 0.04 * diff],
        ['mixed',      0.07 + 0.08 * diff],
        ['trainMix',   0.05 + 0.08 * diff],
        ['trainWall',  0.03 + 0.07 * diff],
        ['lowcar',     0.09],
        ['rampTrain',  0.07 + 0.03 * diff],
        ['slalom',     0.07 + 0.05 * diff],
        ['hurdles',    0.06 + 0.02 * diff]
      ];
      if (d - lastPowerDist > 520) w.push(['power', 0.22]);
      let tot = 0; w.forEach(x => { tot += x[1]; });
      let r = Math.random() * tot;
      kind = w[0][0];
      for (const x of w) { r -= x[1]; if (r <= 0) { kind = x[0]; break; } }
      const hardRows = ['blockPair', 'gantryAll', 'barrierAll', 'mixed', 'trainMix', 'trainWall', 'rampTrain', 'slalom'];
      if (kind === lastRow && hardRows.includes(kind)) kind = pick(['barriers', 'gantry', 'lowcar', 'train']);
    }
    lastRow = kind;
    const ext = EXT[kind];
    const z = zNear - ext[0];                      // z = centre du motif
    const lanes = shuffle([0, 1, 2]);
    const trainTop = 3.25;
    switch (kind) {
      case 'coins': { coinLine(lanes[0], z, randi(5, 8)); if (Math.random() < 0.4) coinLine(lanes[1], z - rand(2, 5), randi(4, 6)); break; }
      case 'block1': { addObstacle('block', lanes[0], z); coinLine(lanes[1], z + 2, randi(5, 8)); if (Math.random() < 0.5) addObstacle('barrier', lanes[2], z - 1); break; }
      case 'blockPair': { addObstacle('block', lanes[0], z); addObstacle('block', lanes[1], z); coinLine(lanes[2], z + 3, 8); break; }
      case 'barriers': { const n = randi(1, 3); for (let i = 0; i < n; i++) { addObstacle('barrier', lanes[i], z); if (i === 0) coinArc(lanes[i], z); } if (n < 3) coinLine(lanes[2], z + 3, 6); break; }
      case 'barrierAll': { [0, 1, 2].forEach(l => addObstacle('barrier', l, z)); coinArc(lanes[0], z); break; }
      case 'gantry': { const n = randi(1, 2); for (let i = 0; i < n; i++) { addObstacle('gantry', lanes[i], z); coinLine(lanes[i], z + 4, 5); } if (n === 1) { addObstacle('barrier', lanes[1], z - 1); coinArc(lanes[1], z - 1); } break; }
      case 'gantryAll': { [0, 1, 2].forEach(l => addObstacle('gantry', l, z)); [0, 1, 2].forEach(l => coinAt(l, z + 3, 0.5)); break; }
      case 'train': {
        addObstacle('train', lanes[0], z);
        coinLine(lanes[1], z + 2, 7);
        addObstacle(pick(['barrier', 'gantry', 'low']), lanes[2], z - 1.5);
        break;
      }
      case 'mixed': {
        addObstacle('block', lanes[0], z);
        addObstacle('barrier', lanes[1], z);
        addObstacle('gantry', lanes[2], z);
        coinArc(lanes[1], z);
        break;
      }
      case 'trainMix': {
        addObstacle('train', lanes[0], z);
        addObstacle('barrier', lanes[1], z);
        addObstacle('gantry', lanes[2], z);
        coinLine(lanes[1], z + 3, 5);
        break;
      }
      case 'trainWall': {
        // Deux trains côte à côte : une seule voie libre, avec un obstacle à franchir.
        addObstacle('train', lanes[0], z); addObstacle('train', lanes[1], z);
        addObstacle(pick(['barrier', 'gantry']), lanes[2], z + 1);
        coinLine(lanes[2], z + 4, 5);
        break;
      }
      case 'lowcar': {
        // Wagon bas : saute dessus et ramasse les pièces du toit.
        const lc = addObstacle('low', lanes[0], z);
        for (let i = 0; i < 4; i++) coinAt(lanes[0], z + 1.6 - i * 1.5, 1.3 + 0.85);
        addObstacle(pick(['barrier', 'gantry', 'block']), lanes[1], z);
        if (Math.random() < 0.6) addObstacle('barrier', lanes[2], z + 1);
        else coinLine(lanes[2], z + 2, 6);
        break;
      }
      case 'rampTrain': {
        // Rampe + train : monte sur le toit (pièces en hauteur), ou évite par les autres voies.
        const t = addObstacle('train', lanes[0], z);
        const ramp = addObstacle('ramp', lanes[0], z + t.hl + 0.3 + 4);
        const n = Math.floor((t.hl * 2 - 1.2) / 1.9);
        for (let i = 0; i < n; i++) coinAt(lanes[0], z + t.hl - 0.8 - i * 1.9, trainTop + 0.85);
        addObstacle(pick(['barrier', 'gantry', 'block']), lanes[1], z + 3);
        addObstacle(pick(['barrier', 'gantry']), lanes[2], z - 2);
        break;
      }
      case 'slalom': {
        // Une seule voie libre qui se décale à chaque étape : il faut slalomer.
        let free = randi(0, 2);
        for (let k = 0; k < 4; k++) {
          const zz = z - k * 7;
          [0, 1, 2].forEach(l => { if (l !== free) addObstacle(k % 2 ? 'gantry' : 'barrier', l, zz); });
          coinAt(free, zz, 0.85); coinAt(free, zz - 2.2, 0.85);
          const step = free === 0 ? 1 : free === 2 ? -1 : (Math.random() < 0.5 ? -1 : 1);
          free += step;
        }
        break;
      }
      case 'hurdles': {
        // Haies enchaînées sur les trois voies : un bon saut en franchit plusieurs.
        for (let k = 0; k < 3; k++) { [0, 1, 2].forEach(l => addObstacle('barrier', l, z - k * 6.2)); coinAt(1, z - k * 6.2, 1.9); }
        break;
      }
      case 'power': {
        const types = ['magnet', 'magnet', 'double', 'double', 'shield', 'shield', 'jet'];
        addPower(pick(types), lanes[0], z); coinLine(lanes[1], z + 2, 6);
        addObstacle(pick(['barrier', 'gantry']), lanes[2], z - 3);
        lastPowerDist = P.dist; break;
      }
      default: break;
    }
    // Écart de réaction court mais jouable (≈0,3 s) — nettement plus dense qu'avant.
    const clear = Math.max(6.5, P.speed * 0.30) + rand(0, 1.8);
    nextRowZ = z - ext[1] - clear;
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
.sk-card{margin:auto;width:min(94%,430px);padding:18px;border-radius:22px;background:rgba(28,18,70,.72);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 60px rgba(0,0,0,.45);box-sizing:border-box}
.sk-title{font-size:46px;font-weight:900;font-style:italic;letter-spacing:2px;text-align:center;line-height:.95;background:linear-gradient(180deg,#fff,#8fdcff 55%,#2a8cff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #3a1a8a) drop-shadow(0 0 8px rgba(130,70,255,.7))}
.sk-title span{display:block;font-size:60px;letter-spacing:3px;margin-top:2px;background:linear-gradient(180deg,#fff27a,#ffb31a 55%,#ff7a12);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;opacity:1}
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
    P.x = 0; P.lane = 1; P.y = 0; P.vy = 0; P.sliding = false; P.slideT = 0; P.speed = 6; P.dist = 0; P.inv = 0; P.jet = 0; P.z = 0; P.coyote = 0; P.jumpBuf = 0; P.floor = 0; P.stumble = 0; guardZ = 40; guard.visible = false;
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
      elHint.innerHTML = IS_TOUCH ? 'Glisse à gauche / droite pour changer de voie<br>↑ pour sauter · ↓ pour rouler<br>Monte sur les trains par les rampes !' : '← → pour changer de voie<br>↑ pour sauter · ↓ pour rouler<br>Monte sur les trains par les rampes !';
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
    if (!forced && P.stumble <= 0) {
      // 1er choc : tu trébuches, le garde se rapproche. Un 2e choc rapide = fin de partie.
      P.stumble = 9; P.inv = 1.5; P.speed *= 0.72; shake = 0.7; guardZ = Math.min(guardZ, P.z + 9);
      snd('shield', 180, 0.22, 'sawtooth');
      emit(P.x, 1, P.z, new THREE.Color(0xffb04a), 22, 7, 5, 0.6);
      pop('ATTENTION !', '#ff9a7a');
      elFlash.style.opacity = 0.45; setTimeout(() => { elFlash.style.opacity = 0; }, 150);
      return;
    }
    state = 'dying'; deathT = 0; shake = 1; guardZ = P.z + 1.6;
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
    if (P.y <= P.floor + 0.05 || P.coyote > 0) {
      P.vy = 10.4; P.y = Math.max(P.y, P.floor + 0.001); P.sliding = false; P.slideT = 0; P.coyote = 0; P.jumpBuf = 0;
      R.jumps++;
      snd('jump', 420, 0.08, 'triangle');
      emit(P.x, 0.1, P.z, new THREE.Color(0xffffff), 6, 2.5, 1.5, 0.4);
    } else { P.jumpBuf = 0.14; }
  }
  function doSlide() {
    if (state !== 'playing' || paused || P.jet > 0) return;
    if (P.y > P.floor + 0.05) { P.vy = -20; P.airDive = true; return; }
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
  // Hauteur du sol sous le joueur : 0, ou le toit d'un train / wagon bas / une rampe.
  function floorAt(x, z, y) {
    let f = 0;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!o.flat && !o.ramp) continue;
      if (Math.abs(x - o.x) >= o.hw + 0.12) continue;
      if (o.ramp) {
        if (z > o.z + o.hl || z < o.z - o.hl - 0.7) continue;
        const sf = o.H * clamp((o.z + o.hl - z) / (2 * o.hl), 0, 1);
        if (y >= sf - 0.5 && sf > f) f = sf;
      } else {
        if (Math.abs(z - o.z) >= o.hl + 0.2) continue;
        if (y >= o.y1 - 0.1 && o.y1 > f) f = o.y1;
      }
    }
    return f;
  }
  const boxHit = (o) => {
    const px0 = P.x - 0.34, px1 = P.x + 0.34;
    const py0 = P.y, py1 = P.y + (P.sliding ? 0.75 : 1.65);
    if (!(px1 > o.x - o.hw && px0 < o.x + o.hw)) return false;
    if (o.ramp) {
      // la rampe ne tue que si on la heurte par en dessous / de côté, pas en la montant
      if (P.z > o.z + o.hl || P.z < o.z - o.hl) return false;
      const sf = o.H * clamp((o.z + o.hl - P.z) / (2 * o.hl), 0, 1);
      return py0 < sf - 0.55;
    }
    const top = o.flat ? o.y1 - 0.08 : o.y1;
    return Math.abs(P.z - o.z) < o.hl + 0.32 && py1 > o.y0 && py0 < top;
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
    P.x += (tx - P.x) * (1 - Math.exp(-18 * dt));

    // saut / chute / glissade / jet
    if (P.jet > 0) {
      P.jet -= dt;
      P.y += (4.1 - P.y) * (1 - Math.exp(-4 * dt));
      P.vy = 0; P.sliding = false;
      if (P.jet <= 0) { P.jet = 0; P.inv = 1.6; pop('ATTERRISSAGE', '#ffffff'); }
      P.floor = 0;
    } else {
      const fl = floorAt(P.x, P.z, P.y);
      P.floor = fl;
      if (P.y > fl + 0.001 || P.vy > 0) {
        P.vy -= 33 * dt;
        P.y += P.vy * dt;
        P.coyote = 0;
        if (P.y <= fl && P.vy <= 0) {
          P.y = fl; P.vy = 0;
          emit(P.x, 0.1, P.z, new THREE.Color(0xffffff), 8, 3, 1.5, 0.45);
          if (P.airDive) { P.airDive = false; P.sliding = true; P.slideT = 0.6; shake = Math.max(shake, 0.15); R.slides++; }
          if (P.jumpBuf > 0) doJump();
        }
      } else { P.y = fl; P.vy = 0; P.coyote = 0.08; }
      if (P.sliding) { P.slideT -= dt; if (P.slideT <= 0) P.sliding = false; }
    }
    if (P.jumpBuf > 0) P.jumpBuf -= dt;
    if (P.inv > 0) P.inv -= dt;
    if (P.stumble > 0) { P.stumble -= dt; if (P.stumble <= 0) { P.stumble = 0; pop('SEMÉ !', '#9dffb8'); } }
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
      else if (P.y > P.floor + 0.05) mode = 'air';
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

    const runBob = mode === 'run' ? Math.abs(Math.sin(t)) * 0.10 : mode === 'idle' ? Math.sin(performance.now() * 0.002) * 0.025 : 0;
    hero.position.set(P.x, P.y, P.z);
    hero.rotation.z = (state === 'playing') ? clamp((P.x - LANES[P.lane]) * -0.12, -0.35, 0.35) : 0;
    hero.rotation.y = state === 'menu' ? Math.sin(performance.now() * 0.0008) * 0.35 : clamp((P.x - LANES[P.lane]) * 0.08, -0.3, 0.3);
    bubble.visible = pw.shield && state !== 'dying';
    if (bubble.visible) bubble.scale.setScalar(1 + Math.sin(performance.now() * 0.006) * 0.03);
    hero.visible = !(P.inv > 0 && state === 'playing' && Math.floor(performance.now() / 70) % 2 === 0);
    blob.position.set(P.x, P.floor + 0.04, P.z);
    const hh = Math.max(0, P.y - P.floor);
    const bs = clamp(1.25 - hh * 0.12, 0.5, 1.25);
    blob.scale.set(bs, bs, 1);
    blob.material.opacity = clamp(0.5 - hh * 0.06, 0.15, 0.5);

    // poussière / sillage
    if (state === 'playing' && mode === 'run' && Math.random() < dt * 22) emit(P.x + rand(-0.15, 0.15), P.floor + 0.1, P.z + 0.3, new THREE.Color(SKINS[SV.skin].accent), 1, 1, 0.8, 0.35);
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
      pos = new THREE.Vector3(P.x * 0.5, 3.7 + up, P.z + 7.2 - sp * 0.8 + (aspect < 1 ? 1.5 : 0));
      look = new THREE.Vector3(P.x * 0.65, 1.2 + P.y * 0.55, P.z - 10);
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
    bMats.forEach(m => { m.color.copy(cur.build); m.emissiveIntensity = 0.06 + cur.night * 1.15; });
    leafMat.color.setRGB(lerp(0.18, 0.1, cur.night) * cur.light, lerp(0.48, 0.2, cur.night) * cur.light, lerp(0.27, 0.16, cur.night) * cur.light);
    bulbMat.color.setRGB(1, 0.89, 0.63).multiplyScalar(0.35 + cur.night * 0.65);
    haloMat.opacity = cur.night * 0.85;
    skyT -= dt;
    if (skyT <= 0) { paintSky(); skyT = 0.12; }
    sky.position.copy(camera.position);
    helicopter.position.set(camera.position.x - 22, camera.position.y + 18, camera.position.z - 48);
    helicopter.rotation.y = -0.18 + Math.sin(timeNow * 0.00035) * 0.08;
    const rotorRate = state === 'playing' ? 18 : 8;
    heliRotor.rotation.y += dt * rotorRate; tailRotor.rotation.z += dt * rotorRate * 1.6;
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
      updateGuard(rdt);
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