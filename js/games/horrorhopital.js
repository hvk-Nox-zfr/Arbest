
(async function SILENCE_V3() {
  if (window.__SILENCE_V3__) return;
  window.__SILENCE_V3__ = true;

  // ============================================================
  // 1. CHARGEMENT DU MOTEUR 3D
  // ============================================================

  let THREE, GLTFLoader;

  try {
    THREE = await import('https://esm.sh/three@0.186.1');

    ({ GLTFLoader } = await import(
      'https://esm.sh/three@0.186.1/examples/jsm/loaders/GLTFLoader.js'
    ));
  } catch (e) {
    console.error(e);
    alert(
      'Impossible de charger le moteur 3D. Vérifie ta connexion Internet et les autorisations de ton site.'
    );
    window.__SILENCE_V3__ = false;
    return;
  }

  // ============================================================
  // 2. INTERFACE
  // ============================================================

  document.getElementById('silence-v3')?.remove();
  document.getElementById('silence-v3-style')?.remove();

  const root = document.createElement('div');
  root.id = 'silence-v3';

  root.innerHTML = `
    <div id="s3-world"></div>
    <div id="s3-vignette"></div>
    <div id="s3-flash"></div>

    <div id="s3-menu" class="s3-screen">
      <div class="s3-kicker">ARCHIVES CLASSÉES · 2004</div>
      <h1>SILENCE</h1>
      <div class="s3-subtitle">CHAMBRE 09</div>
      <div class="s3-line"></div>

      <p class="s3-intro">
        IL N'A JAMAIS QUITTÉ L'HÔPITAL.
      </p>

      <p class="s3-story">
        Ta sœur Inès a disparu à l'hôpital Saint-Vincent.
        Vingt-deux ans plus tard, une enveloppe arrive chez toi.
        À l'intérieur : une photographie, une clé et une phrase
        écrite à la main.

        <br><br>
        « Si tu entends trois coups, ne réponds pas. »
      </p>

      <button id="s3-start">ENTRER DANS L'HÔPITAL</button>

      <p class="s3-hint">
        Joue au casque. Certaines choses ne s'entendent pas devant toi.
      </p>

      <div class="s3-controls">
        <span>ZQSD</span> Déplacement
        <span>SOURIS</span> Regard
        <span>MAJ</span> Courir
        <span>E</span> Interagir
        <span>F</span> Lampe
        <span>J</span> Journal
      </div>
    </div>

    <div id="s3-hud" class="s3-hidden">
      <div class="s3-top">
        <span>SAINT-VINCENT</span>
        <span>03:17</span>
        <span id="s3-lamp-label">TORCHE : ALLUMÉE</span>
      </div>

      <div class="s3-objective">
        <div class="s3-label">OBJECTIF</div>
        <div id="s3-objective-text">Retrouve le dossier d'Inès.</div>
        <div id="s3-objective-sub">Aile Ouest</div>
      </div>

      <div class="s3-crosshair">
        <i></i><b></b>
      </div>

      <div id="s3-prompt"></div>
      <div id="s3-message"></div>

      <div class="s3-bottom">
        ZQSD : se déplacer · Souris : regarder · MAJ : courir
        <br>E : interagir · F : lampe torche · J : journal
      </div>

      <div id="s3-journal">
        <button id="s3-close-journal">×</button>
        <div class="s3-label">DOCUMENTS TROUVÉS</div>
        <h2>Journal d'enquête</h2>
        <div id="s3-notes"></div>
      </div>
    </div>

    <div id="s3-pause" class="s3-screen s3-hidden">
      <div class="s3-kicker">SIGNAL INTERROMPU</div>
      <h2>PAUSE</h2>
      <p>Tu entends encore les néons bourdonner.</p>
      <button id="s3-resume">REPRENDRE</button>
    </div>

    <div id="s3-ending" class="s3-screen s3-hidden">
      <div class="s3-kicker">DOSSIER 09 · FIN</div>
      <h2 id="s3-end-title">TU ES SORTI.</h2>
      <p id="s3-end-text"></p>
      <button id="s3-restart">RECOMMENCER</button>
    </div>
  `;

  const css = document.createElement('style');
  css.id = 'silence-v3-style';

  css.textContent = `
    #silence-v3 {
      position:fixed; inset:0; z-index:999999;
      overflow:hidden; isolation:isolate;
      color:#e0e8e0; background:#030504;
      font-family:Inter,system-ui,-apple-system,sans-serif;
    }

    #silence-v3 * {box-sizing:border-box}

    #s3-world {position:absolute;inset:0}
    #s3-world canvas {display:block;width:100%;height:100%;outline:none}

    .s3-screen {
      position:absolute;inset:0;z-index:10;
      display:flex;flex-direction:column;align-items:center;
      justify-content:center;text-align:center;padding:24px;
      background:radial-gradient(ellipse at center,
        rgba(12,18,15,.70),rgba(1,3,2,.97) 80%);
    }

    #s3-menu {
      background:
        linear-gradient(90deg,rgba(0,2,1,.91),rgba(1,4,3,.74)),
        radial-gradient(ellipse at center,#26352c,#020302 82%);
    }

    .s3-hidden {display:none!important}

    .s3-kicker {
      font-size:10px;letter-spacing:.33em;
      color:#9ba99d;margin-bottom:21px;
    }

    .s3-screen h1 {
      font-size:clamp(55px,10vw,105px);
      font-weight:950;letter-spacing:.18em;
      margin:0;text-shadow:0 0 38px #1b2920;
    }

    .s3-subtitle {
      margin-top:11px;font-size:13px;letter-spacing:.65em;
      color:#9ca99f;
    }

    .s3-line {
      width:min(400px,75vw);height:1px;
      background:linear-gradient(90deg,transparent,#65756a,transparent);
      margin:29px 0;
    }

    .s3-intro {
      font-size:16px;letter-spacing:.12em;color:#e4e8e1;
    }

    .s3-story {
      max-width:550px;font-size:13px;
      line-height:1.9;color:#aab7ac;margin:8px 0 27px;
    }

    #silence-v3 button {cursor:pointer}

    #s3-start,#s3-resume,#s3-restart {
      border:0;border-radius:2px;
      background:#d8e0d8;color:#101611;
      padding:15px 24px;font-size:11px;
      font-weight:850;letter-spacing:.14em;
      transition:background .2s,transform .2s;
    }

    #s3-start:hover,#s3-resume:hover,#s3-restart:hover {
      background:#fff;transform:translateY(-1px);
    }

    .s3-hint {
      color:#77857b;font-size:10px;margin-top:19px;
    }

    .s3-controls {
      display:flex;align-items:center;justify-content:center;
      flex-wrap:wrap;gap:8px;color:#8f9b91;
      font-size:10px;margin-top:21px;
    }

    .s3-controls span {
      border:1px solid #455247;padding:5px 7px;
      color:#dce5dc;font-weight:750;
    }

    #s3-hud {position:absolute;inset:0;pointer-events:none}

    .s3-top {
      position:absolute;left:22px;right:22px;top:18px;
      display:flex;justify-content:space-between;gap:12px;
      font-size:9px;letter-spacing:.2em;color:#c6d1c7;
      text-shadow:0 2px 8px #000;
    }

    .s3-objective {
      position:absolute;left:22px;top:53px;
      width:min(330px,calc(100vw - 44px));
      padding:13px 15px;
      border-left:2px solid #809083;
      background:linear-gradient(90deg,rgba(4,8,5,.82),transparent);
      text-shadow:0 1px 8px #000;
    }

    .s3-label {
      font-size:9px;letter-spacing:.22em;
      color:#9aaa9d;margin-bottom:8px;
    }

    #s3-objective-text {
      font-size:14px;font-weight:750;line-height:1.5;
    }

    #s3-objective-sub {
      font-size:10px;color:#a0aea1;margin-top:5px;
    }

    .s3-crosshair {
      position:absolute;left:50%;top:50%;
      width:12px;height:12px;transform:translate(-50%,-50%);
      opacity:.78;
    }

    .s3-crosshair i,.s3-crosshair b {
      position:absolute;display:block;background:#edf3ec;
      box-shadow:0 0 5px #000;
    }

    .s3-crosshair i {width:1px;height:10px;left:5px;top:1px}
    .s3-crosshair b {height:1px;width:10px;left:1px;top:5px}

    #s3-prompt {
      position:absolute;left:50%;bottom:14%;
      transform:translateX(-50%);padding:10px 15px;
      white-space:nowrap;background:rgba(2,5,3,.84);
      border:1px solid #455146;font-size:12px;
      color:#e2eae1;text-shadow:0 1px 8px #000;
    }

    #s3-prompt:empty {display:none}

    #s3-message {
      position:absolute;left:50%;top:26%;
      transform:translateX(-50%);
      width:min(620px,88vw);text-align:center;
      font-size:clamp(14px,2vw,22px);
      font-weight:750;letter-spacing:.05em;
      line-height:1.6;color:#e6ece3;
      text-shadow:0 2px 12px #000;
      opacity:0;transition:opacity .25s;
    }

    #s3-message.show {opacity:1}
    #s3-message.danger {
      color:#f0d0c9;text-shadow:0 0 18px #700d0a,0 2px 12px #000;
    }

    .s3-bottom {
      position:absolute;bottom:13px;left:12px;right:12px;
      text-align:center;font-size:9px;line-height:1.8;
      color:rgba(224,234,223,.57);text-shadow:0 1px 8px #000;
    }

    #s3-journal {
      pointer-events:auto;display:none;
      position:absolute;right:20px;top:67px;
      width:min(390px,calc(100vw - 40px));
      max-height:72vh;overflow:auto;padding:23px;
      background:rgba(4,8,5,.97);border:1px solid #4a584b;
      box-shadow:0 15px 60px #000;
    }

    #s3-journal.open {display:block}

    #s3-journal h2 {font-size:22px;margin:0 0 20px}

    #s3-close-journal {
      float:right;background:none;border:0;
      color:#dce6db;font-size:26px;
    }

    .s3-entry {
      border-top:1px solid #273329;padding:13px 0;
      font-size:12px;line-height:1.7;color:#c3cec3;
    }

    .s3-entry strong {
      display:block;color:#e3eae1;
      font-size:10px;letter-spacing:.13em;margin-bottom:5px;
    }

    .s3-screen h2 {
      font-size:clamp(32px,6vw,58px);
      letter-spacing:.15em;margin:0 0 15px;
    }

    .s3-screen p {max-width:540px;color:#afbbb0;line-height:1.8}

    #s3-vignette {
      pointer-events:none;position:absolute;inset:-4px;z-index:2;
      background:radial-gradient(ellipse at center,transparent 15%,
        rgba(0,0,0,.32) 57%,rgba(0,0,0,.95) 100%);
      opacity:.88;transition:opacity .2s;
    }

    #s3-flash {
      pointer-events:none;position:absolute;inset:0;z-index:4;
      background:#891510;opacity:0;
    }

    @media(max-width:600px) {
      .s3-top {left:10px;right:10px;font-size:8px}
      .s3-objective {left:10px;top:48px}
      .s3-story {font-size:12px}
      #s3-journal {right:10px}
    }
  `;

  document.head.appendChild(css);
  document.body.appendChild(root);

  const $ = q => root.querySelector(q);

  // ============================================================
  // 3. SCÈNE 3D
  // ============================================================

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050807);
  scene.fog = new THREE.FogExp2(0x070c09, 0.028);

  const camera = new THREE.PerspectiveCamera(
    76, innerWidth / innerHeight, 0.06, 90
  );

  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  $('#s3-world').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0x809185, 0x080a08, 0.22));

  const ambientLight = new THREE.AmbientLight(0x68786a, 0.12);
  scene.add(ambientLight);

  // ============================================================
  // 4. TEXTURES PROCÉDURALES
  // ============================================================

  function noiseTexture(base, variation, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;

    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);

    for (let i = 0; i < image.data.length; i += 4) {
      const n = Math.max(
        0, Math.min(255, base + (Math.random() - .5) * variation)
      );

      image.data[i] = n;
      image.data[i + 1] = n * 1.02;
      image.data[i + 2] = n * .98;
      image.data[i + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);

    for (let i = 0; i < 95; i++) {
      ctx.fillStyle = `rgba(5,9,6,${Math.random() * .24})`;
      ctx.fillRect(
        Math.random() * size, Math.random() * size,
        1 + Math.random() * 28, 1 + Math.random() * 8
      );
    }

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function tileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#414b43';
    ctx.fillRect(0, 0, 512, 512);

    for (let y = 0; y < 512; y += 64) {
      for (let x = 0; x < 512; x += 64) {
        const k = 58 + Math.random() * 18;

        ctx.fillStyle = `rgb(${k},${k + 7},${k - 3})`;
        ctx.fillRect(x + 2, y + 2, 60, 60);

        for (let j = 0; j < 30; j++) {
          ctx.fillStyle = `rgba(0,0,0,${Math.random() * .14})`;
          ctx.fillRect(
            x + Math.random() * 60,
            y + Math.random() * 60,
            Math.random() * 6 + 1,
            Math.random() * 4 + 1
          );
        }
      }
    }

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x92988d,
    map: noiseTexture(124, 48),
    roughness: .95
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa097,
    map: tileTexture(),
    roughness: .42,
    metalness: .025
  });

  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0x141b16,
    map: noiseTexture(39, 25),
    roughness: 1,
    side: THREE.DoubleSide
  });

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x444d47, metalness: .67, roughness: .44
  });

  const clothMaterial = new THREE.MeshStandardMaterial({
    color: 0xc1c4b9,
    map: noiseTexture(183, 28),
    roughness: .98
  });

  // ============================================================
  // 5. HÔPITAL
  // ============================================================

  const CELL = 4;
  const WALL_HEIGHT = 3.7;

  const MAP = [
    '#################',
    '#.....#.....#...#',
    '#.....#.....#...#',
    '#...............#',
    '###.###.###.###.#',
    '#...#...#...#...#',
    '#...#...#...#...#',
    '#...............#',
    '#.###.###.###.###',
    '#...#.....#.....#',
    '#...#.....#.....#',
    '#...............#',
    '###.###.###.###.#',
    '#.....#...#.....#',
    '#.....#...#.....#',
    '#...............#',
    '########.########'
  ];

  const ROWS = MAP.length;
  const COLS = MAP[0].length;
  const WORLD_W = COLS * CELL;
  const WORLD_D = ROWS * CELL;

  function openCell(r, c) {
    return r >= 0 && r < ROWS &&
      c >= 0 && c < COLS &&
      MAP[r][c] !== '#';
  }

  function cellWorld(r, c) {
    return {
      x: (c - (COLS - 1) / 2) * CELL,
      z: (r - (ROWS - 1) / 2) * CELL
    };
  }

  function worldCell(x, z) {
    return {
      c: Math.floor((x + WORLD_W / 2) / CELL),
      r: Math.floor((z + WORLD_D / 2) / CELL)
    };
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_W, WORLD_D),
    floorMaterial
  );

  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.06;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_W, WORLD_D),
    ceilingMaterial
  );

  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT;
  scene.add(ceiling);

  const horizontalWalls = [];
  const verticalWalls = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!openCell(r, c)) continue;

      const p = cellWorld(r, c);

      if (!openCell(r - 1, c)) {
        horizontalWalls.push({ x:p.x, z:p.z - CELL/2 });
      }

      if (!openCell(r + 1, c)) {
        horizontalWalls.push({ x:p.x, z:p.z + CELL/2 });
      }

      if (!openCell(r, c - 1)) {
        verticalWalls.push({ x:p.x - CELL/2, z:p.z });
      }

      if (!openCell(r, c + 1)) {
        verticalWalls.push({ x:p.x + CELL/2, z:p.z });
      }
    }
  }

  function addWallInstances(data, horizontal) {
    const mesh = new THREE.InstancedMesh(
      horizontal
        ? new THREE.BoxGeometry(CELL + .04, WALL_HEIGHT, .18)
        : new THREE.BoxGeometry(.18, WALL_HEIGHT, CELL + .04),
      wallMaterial,
      data.length
    );

    const dummy = new THREE.Object3D();

    data.forEach((wall, i) => {
      dummy.position.set(wall.x, WALL_HEIGHT / 2, wall.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  addWallInstances(horizontalWalls, true);
  addWallInstances(verticalWalls, false);

  // Taches d'humidité et zones de peinture arrachée.
  const damageMaterial = new THREE.MeshStandardMaterial({
    color: 0x323c33, roughness: 1,
    transparent: true, opacity: .64, side: THREE.DoubleSide
  });

  const damageGeometry = new THREE.PlaneGeometry(1.1, 1.5);

  for (let i = 0; i < 75; i++) {
    const r = 1 + Math.floor(Math.random() * 15);
    const c = 1 + Math.floor(Math.random() * 15);

    if (!openCell(r, c)) continue;

    const p = cellWorld(r, c);
    const decal = new THREE.Mesh(damageGeometry, damageMaterial);

    const side = Math.floor(Math.random() * 4);

    if (side === 0) {
      decal.position.set(p.x, .95 + Math.random(), p.z - CELL/2 + .1);
    } else if (side === 1) {
      decal.position.set(p.x, .95 + Math.random(), p.z + CELL/2 - .1);
      decal.rotation.y = Math.PI;
    } else if (side === 2) {
      decal.position.set(p.x - CELL/2 + .1, .95 + Math.random(), p.z);
      decal.rotation.y = Math.PI/2;
    } else {
      decal.position.set(p.x + CELL/2 - .1, .95 + Math.random(), p.z);
      decal.rotation.y = -Math.PI/2;
    }

    decal.scale.set(
      .25 + Math.random() * 1.6,
      .4 + Math.random() * 1.4,
      1
    );

    scene.add(decal);
  }

  // ============================================================
  // 6. MOBILIER DÉTAILLÉ ET COLLISIONS
  // ============================================================

  const solidBoxes = [];

  function addBox(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d), mat
    );

    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addSolid(x, z, halfX, halfZ) {
    const box = {
      minX:x-halfX, maxX:x+halfX,
      minZ:z-halfZ, maxZ:z+halfZ,
      enabled:true
    };

    solidBoxes.push(box);
    return box;
  }

  function makeFallbackBed(x, z, rotation = 0) {
    const g = new THREE.Group();
    const p = cellWorld(x, z);

    g.position.set(p.x, 0, p.z);
    g.rotation.y = rotation;
    scene.add(g);

    addBox(g, 1.15, .15, 2.1, metalMaterial, 0, .33, 0);
    addBox(g, 1.08, .19, 2.0, clothMaterial, 0, .51, 0);

    addBox(g, .76, .11, .34, clothMaterial, 0, .66, -.76);

    for (const xx of [-.51, .51]) {
      for (const zz of [-.86, .86]) {
        addBox(g, .075, .31, .075, metalMaterial, xx, .15, zz);

        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(.072, .072, .06, 10),
          new THREE.MeshStandardMaterial({
            color:0x171b18, roughness:.85
          })
        );

        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(xx, .045, zz);
        g.add(wheel);
      }
    }

    addSolid(
      p.x, p.z,
      Math.abs(rotation) > .1 ? 1.13 : .72,
      Math.abs(rotation) > .1 ? .72 : 1.13
    );

    return g;
  }

  function makeCabinetModel(x, z, falling = false) {
    const p = cellWorld(x, z);

    const g = new THREE.Group();
    g.position.set(p.x, .45, p.z);

    const cabinetMat = new THREE.MeshStandardMaterial({
      color:0x8b9689,
      map:noiseTexture(138,24),
      roughness:.86,
      metalness:.12
    });

    addBox(g,.72,.88,.62,cabinetMat,0,0,0);

    addBox(g,.65,.025,.025,metalMaterial,0,.14,.325);
    addBox(g,.65,.025,.025,metalMaterial,0,-.16,.325);

    for (const yy of [.2, -.1]) {
      addBox(g,.14,.035,.045,metalMaterial,.16,yy,.34);
    }

    scene.add(g);

    const collider = addSolid(p.x,p.z,.44,.38);

    return {group:g,collider};
  }

  // Quelques objets positionnés dans les chambres latérales.
  makeFallbackBed(5,2,0);
  makeFallbackBed(5,6,0);
  makeFallbackBed(10,7,0);
  makeFallbackBed(14,12,0);

  makeCabinetModel(6,2);
  makeCabinetModel(6,6);
  makeCabinetModel(10,2);
  makeCabinetModel(14,13);

  // ============================================================
  // 7. MODÈLES 3D CC0 AVEC SECOURS AUTOMATIQUE
  // ============================================================

  const loader = new GLTFLoader();

  const bedURL =
    'https://www.innerscene.com/api/library/hospital-bed-flat-mattress-44fc9faf/download';

  const cabinetURL =
    'https://www.innerscene.com/api/library/patient-bedside-cabinet-19c0b99c/download';

  async function loadDetailedAsset(url, r, c, kind, rotation = 0) {
    const p = cellWorld(r,c);

    try {
      const gltf = await loader.loadAsync(url);
      const model = gltf.scene;

      model.rotation.y = rotation;

      let bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());

      const target = kind === 'bed'
        ? new THREE.Vector3(2.1,1.3,1.2)
        : new THREE.Vector3(.76,.95,.72);

      const factors = [];

      if (size.x > 0) factors.push(target.x / size.x);
      if (size.y > 0) factors.push(target.y / size.y);
      if (size.z > 0) factors.push(target.z / size.z);

      const scale = Math.min(...factors);

      model.scale.setScalar(scale);
      model.updateMatrixWorld(true);

      bounds = new THREE.Box3().setFromObject(model);

      model.position.set(
        p.x - (bounds.min.x + bounds.max.x)/2,
        -bounds.min.y,
        p.z - (bounds.min.z + bounds.max.z)/2
      );

      model.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;

          if (o.material) {
            const mats = Array.isArray(o.material)
              ? o.material
              : [o.material];

            mats.forEach(mat => {
              if ('roughness' in mat) {
                mat.roughness = Math.max(.3,mat.roughness);
              }
            });
          }
        }
      });

      scene.add(model);

      addSolid(
        p.x,p.z,
        kind==='bed'?.73:.42,
        kind==='bed'?1.08:.38
      );

    } catch (error) {
      console.warn('Modèle externe indisponible :', url, error);

      if (kind === 'bed') {
        makeFallbackBed(r,c,rotation);
      } else {
        makeCabinetModel(r,c);
      }
    }
  }

  // Ces modèles arrivent en arrière-plan pendant l'exploration.
  // Les secours géométriques ci-dessus assurent que le jeu reste jouable.
  loadDetailedAsset(bedURL,2,2,'bed',0);
  loadDetailedAsset(bedURL,9,2,'bed',Math.PI/2);
  loadDetailedAsset(cabinetURL,2,4,'cabinet');

  // ============================================================
  // 8. NÉONS ET LAMPE QUI TOMBE
  // ============================================================

  const lampData = [];

  function makeCeilingLamp(r,c) {
    const p = cellWorld(r,c);

    const group = new THREE.Group();
    group.position.set(p.x,WALL_HEIGHT-.05,p.z);
    scene.add(group);

    const cordMat = new THREE.MeshStandardMaterial({
      color:0x202620, metalness:.4, roughness:.7
    });

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(.015,.015,.18,6),
      cordMat
    );

    cord.position.y=-.09;
    group.add(cord);

    const housingMat = new THREE.MeshStandardMaterial({
      color:0xa8b1a6,
      emissive:0xd4e2d3,
      emissiveIntensity:.35,
      roughness:.65
    });

    const housing = addBox(
      group,.82,.08,.28,housingMat,0,-.2,0
    );

    const bulb = new THREE.Mesh(
      new THREE.BoxGeometry(.67,.035,.18),
      new THREE.MeshBasicMaterial({color:0xd3ebcf})
    );

    bulb.position.y=-.26;
    group.add(bulb);

    const light = new THREE.PointLight(0xcfe0ce,.6,8,2);
    light.position.set(0,-.37,0);
    group.add(light);

    const entry = {
      group,light,housing,bulb,housingMat,
      r,c,x:p.x,z:p.z,
      baseY:WALL_HEIGHT-.05,
      seed:Math.random()*100,
      falling:false,triggered:false,
      timer:0,progress:0,fallen:false
    };

    lampData.push(entry);
    return entry;
  }

  const lampCells = [
    [2,2],[3,7],[3,12],[5,2],[5,6],
    [5,10],[7,4],[7,9],[7,14],
    [11,2],[11,7],[11,12],[14,8]
  ];

  lampCells.forEach(([r,c]) => {
    if (openCell(r,c)) makeCeilingLamp(r,c);
  });

  // La lampe qui tombe sera celle du couloir principal.
  const fallingLamp = lampData.find(l=>l.r===3&&l.c===7);

  const lightFlickerArea = new THREE.PointLight(0x9cae9b,.18,7,2);
  const flickerPoint = cellWorld(7,11);
  lightFlickerArea.position.set(flickerPoint.x,2,flickerPoint.z);
  scene.add(lightFlickerArea);

  // ============================================================
  // 9. POUSSIÈRE
  // ============================================================

  const dustCount = 260;
  const dustPos = new Float32Array(dustCount*3);

  for(let i=0;i<dustCount;i++) {
    dustPos[i*3]=(Math.random()-.5)*WORLD_W*.85;
    dustPos[i*3+1]=Math.random()*3.5;
    dustPos[i*3+2]=(Math.random()-.5)*WORLD_D*.85;
  }

  const dustGeo = new THREE.BufferGeometry();

  dustGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(dustPos,3)
  );

  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color:0xc7d5c7,size:.023,
      transparent:true,opacity:.23,depthWrite:false
    })
  );

  scene.add(dust);

  // ============================================================
  // 10. LAMPE TORCHE DU JOUEUR
  // ============================================================

  const flashlight = new THREE.SpotLight(
    0xe4f2e2, 48, 24, Math.PI/7.5, .68, 1.5
  );

  flashlight.castShadow = true;
  flashlight.shadow.mapSize.set(512,512);
  flashlight.shadow.bias=-.0002;
  flashlight.position.set(0,-.07,0);

  const torchTarget = new THREE.Object3D();
  torchTarget.position.set(0,0,-1);

  camera.add(flashlight);
  camera.add(torchTarget);
  flashlight.target=torchTarget;

  scene.add(camera);

  // ============================================================
  // 11. CRÉATURE
  // ============================================================

  const monster = new THREE.Group();

  const monsterSkin = new THREE.MeshStandardMaterial({
    color:0x151914,roughness:.98
  });

  const monsterFace = new THREE.MeshStandardMaterial({
    color:0x30342d,roughness:.95
  });

  const redEyes = new THREE.MeshStandardMaterial({
    color:0x63110d,
    emissive:0xc3130c,
    emissiveIntensity:1.8,
    roughness:.25
  });

  function monsterPart(geometry, material, x,y,z) {
    const m=new THREE.Mesh(geometry,material);
    m.position.set(x,y,z);
    m.castShadow=true;
    monster.add(m);
    return m;
  }

  monsterPart(
    new THREE.CapsuleGeometry(.30,.86,5,9),
    monsterSkin,0,1.15,0
  );

  monsterPart(
    new THREE.CylinderGeometry(.09,.12,.32,10),
    monsterSkin,0,1.75,0
  );

  monsterPart(
    new THREE.SphereGeometry(.25,16,14),
    monsterFace,0,2.02,.04
  );

  for (const x of [-.1,.1]) {
    monsterPart(
      new THREE.SphereGeometry(.039,8,8),
      redEyes,x,2.06,.26
    );
  }

  const mouth = monsterPart(
    new THREE.SphereGeometry(.105,12,8),
    new THREE.MeshStandardMaterial({
      color:0x020302,roughness:1
    }),
    0,1.91,.24
  );

  mouth.scale.set(.72,1.2,.3);

  const boneMaterial = new THREE.MeshStandardMaterial({
    color:0x9d9f91,roughness:.9
  });

  for(let i=0;i<5;i++) {
    const tooth=monsterPart(
      new THREE.ConeGeometry(.025,.085,5),
      boneMaterial,
      -.07+i*.035,1.94,.277
    );
    tooth.rotation.x=Math.PI;
  }

  const leftArm=monsterPart(
    new THREE.CapsuleGeometry(.065,.86,4,7),
    monsterSkin,-.42,1.07,0
  );

  leftArm.rotation.z=-.15;

  const rightArm=monsterPart(
    new THREE.CapsuleGeometry(.065,.86,4,7),
    monsterSkin,.42,1.07,0
  );

  rightArm.rotation.z=.15;

  monsterPart(
    new THREE.CapsuleGeometry(.10,.65,4,7),
    monsterSkin,-.16,.43,0
  );

  monsterPart(
    new THREE.CapsuleGeometry(.10,.65,4,7),
    monsterSkin,.16,.43,0
  );

  const monsterStart=cellWorld(1,14);
  monster.position.set(monsterStart.x,0,monsterStart.z);
  monster.visible=false;
  scene.add(monster);

  let monsterAwake=false;
  let monsterPath=[];
  let monsterPathTimer=0;
  let monsterNearTimer=0;
  let monsterExtraSpeed=1;

  // ============================================================
  // 12. SCREAMER EN 3D DEVANT LA CAMÉRA
  // ============================================================

  const jumpscareRig = new THREE.Group();
  jumpscareRig.position.set(0,0,-.76);
  jumpscareRig.visible=false;

  const scareSkin=new THREE.MeshStandardMaterial({
    color:0x111410,roughness:.98
  });

  const scareFace=new THREE.MeshStandardMaterial({
    color:0x35382f,roughness:.9
  });

  const scareEyes=new THREE.MeshStandardMaterial({
    color:0x8f0b08,
    emissive:0xf51a0b,
    emissiveIntensity:2.4
  });

  function scarePart(geo,mat,x,y,z) {
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(x,y,z);
    jumpscareRig.add(mesh);
    return mesh;
  }

  scarePart(
    new THREE.SphereGeometry(.25,16,12),
    scareFace,0,0,0
  );

  scarePart(
    new THREE.CapsuleGeometry(.15,.4,4,7),
    scareSkin,0,-.34,0
  );

  for(const x of [-.105,.105]) {
    scarePart(
      new THREE.SphereGeometry(.052,10,8),
      scareEyes,x,.035,-.22
    );
  }

  const openMouth=scarePart(
    new THREE.SphereGeometry(.11,12,8),
    new THREE.MeshBasicMaterial({color:0x000000}),
    0,-.105,-.22
  );

  openMouth.scale.set(.78,1.4,.45);

  for(let i=0;i<6;i++) {
    const tooth=scarePart(
      new THREE.ConeGeometry(.025,.075,5),
      boneMaterial,
      -.065+i*.026,-.065,-.25
    );
    tooth.rotation.x=Math.PI;
  }

  const clawMat=new THREE.MeshStandardMaterial({
    color:0x252922,roughness:.98
  });

  for(const side of [-1,1]) {
    const arm=scarePart(
      new THREE.CapsuleGeometry(.06,.56,4,7),
      scareSkin,side*.35,-.28,.03
    );

    arm.rotation.z=side*.32;

    for(let i=0;i<3;i++) {
      scarePart(
        new THREE.ConeGeometry(.028,.15,5),
        clawMat,
        side*.43+(i-1)*.045,-.57,-.025
      );
    }
  }

  camera.add(jumpscareRig);
  jumpscareRig.scale.setScalar(.001);

  let jumpscareActive=false;
  let jumpscareTime=0;
  let jumpscareCount=0;
  let cameraShake=0;

  function triggerJumpscare() {
    if(jumpscareActive||jumpscareCount>=2||dead||won) return;

    jumpscareActive=true;
    jumpscareTime=0;
    jumpscareCount++;
    cameraShake=1;

    jumpscareRig.visible=true;
    jumpscareRig.scale.setScalar(.02);

    $('#s3-flash').style.transition='none';
    $('#s3-flash').style.opacity='.7';

    setTimeout(()=>{
      $('#s3-flash').style.transition='opacity .5s';
      $('#s3-flash').style.opacity='0';
    },70);

    playScream();
  }

  // ============================================================
  // 13. PORTE DE SORTIE
  // ============================================================

  const exitCell=cellWorld(15,8);
  const outsideCell=cellWorld(16,8);
  const doorZ=(exitCell.z+outsideCell.z)/2;

  const exitGroup=new THREE.Group();
  exitGroup.position.set(exitCell.x,0,doorZ);
  scene.add(exitGroup);

  const frameMaterial=new THREE.MeshStandardMaterial({
    color:0x303a31,metalness:.45,roughness:.68
  });

  addBox(exitGroup,.16,3.2,.24,frameMaterial,-1.4,1.6,0);
  addBox(exitGroup,.16,3.2,.24,frameMaterial,1.4,1.6,0);
  addBox(exitGroup,2.96,.16,.24,frameMaterial,0,3.2,0);

  const doorPanel=addBox(
    exitGroup,2.58,3,.14,
    new THREE.MeshStandardMaterial({
      color:0x192019,roughness:.8,metalness:.24
    }),
    0,1.5,0
  );

  addBox(exitGroup,.10,.56,.06,metalMaterial,1,1.4,-.09);

  const exitRedLight=new THREE.PointLight(0x862b22,.7,4,2);
  exitRedLight.position.set(0,2.7,-.4);
  exitGroup.add(exitRedLight);

  const doorCollider=addSolid(exitCell.x,doorZ,.13,.14);

  // ============================================================
  // 14. SCÉNARIO ET OBJETS À RAMASSER
  // ============================================================

  const items=[];
  const notes=[
    {
      title:'ENTRÉE — 03 H 17',
      text:'L’hôpital est censé être vide. La porte derrière moi vient de se refermer.'
    }
  ];

  let stage=0;
  let started=false;
  let paused=false;
  let dead=false;
  let won=false;
  let fuseTaken=false;
  let powerOn=false;
  let exitUnlocked=false;
  let torchOn=true;
  let gameTime=0;
  let lastFootstep=0;
  let toastTimer=0;
  let jumpZoneTriggered=false;
  let lampScareStarted=false;
  let cabinetScareStarted=false;
  let apparitionTriggered=false;
  let scheduledJumpAt=-1;
  let lampFallTimer=0;
  let cabinetFallTimer=0;
  let cabinetFall=null;
  let sparkParticles=[];

  function createMarker(x,z) {
    const marker=new THREE.Mesh(
      new THREE.TorusGeometry(.35,.015,6,28),
      new THREE.MeshStandardMaterial({
        color:0xc1a76b,
        emissive:0x81622d,
        emissiveIntensity:.25,
        transparent:true,
        opacity:.75
      })
    );

    marker.rotation.x=-Math.PI/2;
    marker.position.set(x,.035,z);
    scene.add(marker);
    return marker;
  }

  function createPaper(r,c) {
    const p=cellWorld(r,c);
    const group=new THREE.Group();
    group.position.set(p.x,0,p.z);

    const paper=new THREE.MeshStandardMaterial({
      color:0xd0cbbb,map:noiseTexture(194,22),roughness:1
    });

    addBox(group,.48,.025,.62,paper,0,.68,0);

    for(let i=0;i<4;i++) {
      addBox(
        group,.30,.003,.008,
        new THREE.MeshStandardMaterial({color:0x656458}),
        0,.698,-.16+i*.09
      );
    }

    scene.add(group);
    return group;
  }

  function createFuse(r,c) {
    const p=cellWorld(r,c);
    const group=new THREE.Group();
    group.position.set(p.x,0,p.z);
    scene.add(group);

    const tube=new THREE.Mesh(
      new THREE.CylinderGeometry(.07,.07,.42,12),
      new THREE.MeshStandardMaterial({
        color:0xa9b4a9,metalness:.78,roughness:.3
      })
    );

    tube.rotation.z=Math.PI/2;
    tube.position.y=.72;
    group.add(tube);

    for(const x of [-.22,.22]) {
      const cap=new THREE.Mesh(
        new THREE.CylinderGeometry(.085,.085,.07,12),
        metalMaterial
      );
      cap.rotation.z=Math.PI/2;
      cap.position.set(x,.72,0);
      group.add(cap);
    }

    return group;
  }

  function createKey(r,c) {
    const p=cellWorld(r,c);
    const group=new THREE.Group();
    group.position.set(p.x,0,p.z);
    scene.add(group);

    const keyMaterial=new THREE.MeshStandardMaterial({
      color:0xb4a06e,metalness:.8,roughness:.2
    });

    const ring=new THREE.Mesh(
      new THREE.TorusGeometry(.09,.022,8,18),
      keyMaterial
    );

    ring.position.set(-.13,.72,0);
    group.add(ring);

    addBox(group,.36,.035,.035,keyMaterial,.06,.72,0);
    addBox(group,.06,.10,.035,keyMaterial,.19,.68,0);
    addBox(group,.06,.07,.035,keyMaterial,.11,.68,0);

    return group;
  }

  function createElectricalPanel(r,c) {
    const p=cellWorld(r,c);
    const group=new THREE.Group();
    group.position.set(p.x,0,p.z);
    scene.add(group);

    addBox(group,.77,1.3,.23,metalMaterial,0,1.15,0);

    addBox(
      group,.53,.73,.04,
      new THREE.MeshStandardMaterial({
        color:0x1d251e,roughness:.9
      }),
      0,1.15,.135
    );

    addBox(group,.12,.28,.07,frameMaterial,.04,1.12,.18);
    addBox(
      group,.21,.05,.025,
      new THREE.MeshStandardMaterial({
        color:0x832a22,emissive:0x2d0705
      }),
      0,1.53,.17
    );

    return group;
  }

  function addItem(cfg) {
    const p=cellWorld(cfg.r,cfg.c);
    const group=cfg.create(cfg.r,cfg.c);
    const marker=createMarker(p.x,p.z);

    items.push({
      ...cfg,
      x:p.x,z:p.z,group,marker,collected:false
    });
  }

  addItem({
    title:'DOSSIER D’INÈS',
    prompt:'E — Examiner le dossier',
    r:2,c:3,stage:0,create:createPaper,

    action:()=>{
      stage=1;
      monsterAwake=true;
      monster.visible=true;

      notes.push({
        title:'DOSSIER D’ADMISSION',
        text:'Inès Moreau, admise à 03 h 17. Chambre 09. Le document porte une annotation : « Ne rétablissez pas le courant si vous entendez votre nom. »'
      });

      updateNotes();
      updateObjective();

      showMessage(
        'Un bruit de pas résonne dans le couloir. Mais tu es seul.',
        4,true
      );

      sting();
    }
  });

  addItem({
    title:'FUSIBLE INDUSTRIEL',
    prompt:'E — Ramasser le fusible',
    r:5,c:13,stage:1,create:createFuse,

    action:()=>{
      fuseTaken=true;
      stage=2;

      notes.push({
        title:'FUSIBLE',
        text:'Le fusible appartient au tableau principal. En le ramassant, tu entends une respiration lente juste derrière le mur.'
      });

      updateNotes();
      updateObjective();

      showMessage('Quelque chose vient de bouger dans le couloir.',3,true);
      soundImpact();
    }
  });

  addItem({
    title:'TABLEAU ÉLECTRIQUE',
    prompt:'E — Installer le fusible',
    r:9,c:13,stage:2,create:createElectricalPanel,

    action:()=>{
      powerOn=true;
      stage=3;

      notes.push({
        title:'COURANT RÉTABLI',
        text:'Les néons se rallument. Au loin, une silhouette apparaît devant une porte. Quand la lumière revient, elle a disparu.'
      });

      updateNotes();
      updateObjective();

      showMessage(
        'Les néons clignotent. Quelqu’un court au bout du couloir.',
        4,true
      );

      scheduledJumpAt=gameTime+3.8;
      sting();
    }
  });

  addItem({
    title:'CLÉ DE SORTIE',
    prompt:'E — Récupérer la clé',
    r:13,c:3,stage:3,create:createKey,

    action:()=>{
      exitUnlocked=true;
      stage=4;

      doorPanel.visible=false;
      doorCollider.enabled=false;

      notes.push({
        title:'CLÉ PRINCIPALE',
        text:'La clé est froide. Un dernier message est gravé dessus : « Ne regarde pas derrière toi. »'
      });

      updateNotes();
      updateObjective();

      showMessage('La sortie est ouverte. COURS.',3,true);

      scheduledJumpAt=gameTime+.9;
      monsterExtraSpeed=1.45;
    }
  });

  addItem({
    title:'SORTIE PRINCIPALE',
    prompt:'E — Quitter l’hôpital',
    r:15,c:8,stage:4,

    create:(r,c)=>{
      const g=new THREE.Group();
      const p=cellWorld(r,c);
      g.position.set(p.x,0,p.z);
      scene.add(g);
      return g;
    },

    action:()=>{
      won=true;

      if(document.pointerLockElement) {
        document.exitPointerLock();
      }

      $('#s3-end-title').textContent='TU ES SORTI.';

      $('#s3-end-text').textContent=
        'Tu franchis la porte et cours jusqu’à la route. L’hôpital s’éteint derrière toi. Dans la photographie d’Inès, son visage a disparu. Puis ton téléphone sonne. Le numéro affiché est celui de la chambre 09.';

      $('#s3-ending').classList.remove('s3-hidden');
    }
  });

  addItem({
    title:'NOTE D’INFIRMIÈRE',
    prompt:'E — Lire la note',
    r:5,c:2,stage:-1,create:createPaper,

    text:
      '« J’ai entendu la sonnette de la chambre 09. Le patient n’existe dans aucun registre. Je vais arrêter mes rondes. Je crois qu’il m’attend. »'
  });

  addItem({
    title:'RAPPORT DU GARDIEN',
    prompt:'E — Lire le rapport',
    r:10,c:2,stage:-1,create:createPaper,

    text:
      '« Sur les caméras, une silhouette se tient au bout du couloir. Dans la pièce, il n’y a personne. Je viens de voir la silhouette sur l’écran qui filme derrière moi. »'
  });

  // ============================================================
  // 15. JOURNAL ET OBJECTIFS
  // ============================================================

  const objectives=[
    ['Retrouve le dossier d’Inès.','Archives · Aile Ouest'],
    ['Trouve un fusible.','Aile Est · Couloir technique'],
    ['Remets le courant.','Tableau électrique'],
    ['Trouve la clé de sortie.','Infirmerie · Aile Ouest'],
    ['Atteins la porte principale.','Sortie du bâtiment'],
    ['Tu as survécu.','Fin du dossier']
  ];

  function updateObjective() {
    const o=objectives[Math.min(stage,5)];

    $('#s3-objective-text').textContent=o[0];
    $('#s3-objective-sub').textContent=o[1];

    $('#s3-lamp-label').textContent=
      torchOn?'TORCHE : ALLUMÉE':'TORCHE : ÉTEINTE';
  }

  function updateNotes() {
    const host=$('#s3-notes');
    host.replaceChildren();

    notes.forEach(note=>{
      const item=document.createElement('div');
      item.className='s3-entry';

      const title=document.createElement('strong');
      title.textContent=note.title;

      const body=document.createElement('div');
      body.textContent=note.text;

      item.append(title,body);
      host.appendChild(item);
    });
  }

  let journalOpen=false;

  function toggleJournal(forceClose=false) {
    journalOpen=forceClose?false:!journalOpen;
    $('#s3-journal').classList.toggle('open',journalOpen);
  }

  // ============================================================
  // 16. SONS D'HORREUR
  // ============================================================

  let audio=null;
  let master=null;

  function initAudio() {
    if(audio) {
      audio.resume().catch(()=>{});
      return;
    }

    const AudioClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioClass) return;

    audio=new AudioClass();

    master=audio.createGain();
    master.gain.value=.30;
    master.connect(audio.destination);

    const drone=audio.createOscillator();
    drone.type='sine';
    drone.frequency.value=41;

    const droneGain=audio.createGain();
    droneGain.gain.value=.14;

    drone.connect(droneGain).connect(master);
    drone.start();

    const drone2=audio.createOscillator();
    drone2.type='triangle';
    drone2.frequency.value=57;

    const droneGain2=audio.createGain();
    droneGain2.gain.value=.035;

    drone2.connect(droneGain2).connect(master);
    drone2.start();

    const buffer=audio.createBuffer(
      1,audio.sampleRate*2,audio.sampleRate
    );

    const channel=buffer.getChannelData(0);

    for(let i=0;i<channel.length;i++) {
      channel[i]=(Math.random()*2-1)*.5;
    }

    const noise=audio.createBufferSource();
    noise.buffer=buffer;
    noise.loop=true;

    const filter=audio.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=280;

    const noiseGain=audio.createGain();
    noiseGain.gain.value=.085;

    noise.connect(filter).connect(noiseGain).connect(master);
    noise.start();
  }

  function tone(freq,duration,volume=.06,type='sine') {
    if(!audio||!master) return;

    const now=audio.currentTime;
    const osc=audio.createOscillator();
    const gain=audio.createGain();

    osc.type=type;
    osc.frequency.setValueAtTime(freq,now);

    gain.gain.setValueAtTime(Math.max(.0001,volume),now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now+duration+.03);
  }

  function playScream() {
    if(!audio||!master) return;

    const now=audio.currentTime;

    const osc=audio.createOscillator();
    osc.type='sawtooth';
    osc.frequency.setValueAtTime(410,now);
    osc.frequency.exponentialRampToValueAtTime(75,now+.68);

    const gain=audio.createGain();
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(.17,now+.035);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.8);

    const filter=audio.createBiquadFilter();
    filter.type='bandpass';
    filter.frequency.value=1050;
    filter.Q.value=.7;

    osc.connect(filter).connect(gain).connect(master);
    osc.start(now);
    osc.stop(now+.85);

    // Crié un bruit bref à partir du bruit blanc, sans fichier audio.
    const buffer=audio.createBuffer(
      1,Math.floor(audio.sampleRate*.55),audio.sampleRate
    );

    const data=buffer.getChannelData(0);

    for(let i=0;i<data.length;i++) {
      data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,1.6);
    }

    const source=audio.createBufferSource();
    source.buffer=buffer;

    const noiseFilter=audio.createBiquadFilter();
    noiseFilter.type='bandpass';
    noiseFilter.frequency.value=1400;

    const noiseGain=audio.createGain();
    noiseGain.gain.value=.09;

    source.connect(noiseFilter).connect(noiseGain).connect(master);
    source.start();
  }

  function thud(volume=.06,freq=64) {
    if(!audio||!master) return;

    const now=audio.currentTime;
    const osc=audio.createOscillator();
    const gain=audio.createGain();

    osc.type='sine';
    osc.frequency.setValueAtTime(freq,now);
    osc.frequency.exponentialRampToValueAtTime(freq*.5,now+.14);

    gain.gain.setValueAtTime(volume,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.18);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now+.2);
  }

  function heartbeat() {
    thud(.09,62);
    setTimeout(()=>thud(.065,52),170);
  }

  function sting() {
    tone(84,.8,.12,'sawtooth');
    tone(330,.36,.035,'sawtooth');
    tone(47,1.1,.09,'triangle');
  }

  function soundImpact() {
    thud(.20,49);
    tone(145,.24,.08,'square');
    setTimeout(()=>tone(68,.35,.09,'triangle'),100);
  }

  function creakingSound() {
    tone(168,1.0,.028,'sawtooth');
    tone(121,.7,.023,'triangle');
  }

  function showMessage(text,duration=3,danger=false) {
    const el=$('#s3-message');
    el.textContent=text;
    el.classList.add('show');
    el.classList.toggle('danger',danger);
    toastTimer=duration;
  }

  // ============================================================
  // 17. LAMPE QUI TOMBE ET ÉTINCELLES
  // ============================================================

  function createSparks(x,y,z) {
    const orangeMat=new THREE.MeshBasicMaterial({color:0xffbc54});
    const redMat=new THREE.MeshBasicMaterial({color:0xff5b27});

    for(let i=0;i<20;i++) {
      const mesh=new THREE.Mesh(
        new THREE.SphereGeometry(.025+Math.random()*.018,5,5),
        i%3===0?redMat:orangeMat
      );

      mesh.position.set(x,y,z);
      scene.add(mesh);

      sparkParticles.push({
        mesh,
        vx:(Math.random()-.5)*3.5,
        vy:Math.random()*3.0,
        vz:(Math.random()-.5)*3.5,
        life:.5+Math.random()*.6
      });
    }
  }

  function triggerLampFall(lamp) {
    if(!lamp||lamp.triggered) return;

    lamp.triggered=true;
    lamp.falling=true;
    lamp.timer=0;
    lamp.progress=0;
    lampFallTimer=0;

    showMessage('LE NÉON AU-DESSUS DE TOI CRAQUE.',2.3,true);
    tone(230,.5,.05,'sawtooth');
  }

  // ============================================================
  // 18. MEUBLE QUI BASCULE ET S'ÉCRASE AU SOL
  // ============================================================

  const fallingCabinet=makeCabinetModel(7,11,true);

  function triggerCabinetFall() {
    if(cabinetScareStarted) return;

    cabinetScareStarted=true;
    cabinetFall={
      group:fallingCabinet.group,
      collider:fallingCabinet.collider,
      elapsed:0,
      startX:fallingCabinet.group.position.x,
      startZ:fallingCabinet.group.position.z
    };

    fallingCabinet.collider.enabled=false;

    showMessage('UN GRINCEMENT MÉTALLIQUE RÉSONNE DANS LE COULOIR.',3,true);
    creakingSound();
  }

  // ============================================================
  // 19. DÉPLACEMENT AZERTY CORRIGÉ
  // ============================================================

  const player={
    x:cellWorld(1,2).x,
    y:1.64,
    z:cellWorld(1,2).z,
    yaw:Math.PI,
    pitch:0,
    stamina:1
  };

  camera.position.set(player.x,player.y,player.z);
  camera.rotation.set(0,player.yaw,0,'YXZ');

  const keys=Object.create(null);

  function keyDown(...names) {
    return names.some(n=>keys[n]===true);
  }

  function canMove(x,z) {
    const radius=.29;

    for(const ox of [-radius,radius]) {
      for(const oz of [-radius,radius]) {
        const c=worldCell(x+ox,z+oz);
        if(!openCell(c.r,c.c)) return false;
      }
    }

    for(const b of solidBoxes) {
      if(!b.enabled) continue;

      if(
        x+radius>b.minX&&x-radius<b.maxX&&
        z+radius>b.minZ&&z-radius<b.maxZ
      ) return false;
    }

    return true;
  }

  function movePlayer(dx,dz) {
    if(canMove(player.x+dx,player.z)) player.x+=dx;
    if(canMove(player.x,player.z+dz)) player.z+=dz;
  }

  function handleInteraction() {
    if(!started||paused||won||dead||journalOpen) return;

    let best=null;
    let bestDist=Infinity;

    for(const item of items) {
      if(item.collected) continue;
      if(item.stage!==-1&&item.stage!==stage) continue;

      const dist=Math.hypot(
        player.x-item.x,
        player.z-item.z
      );

      if(dist<2.0&&dist<bestDist) {
        best=item;
        bestDist=dist;
      }
    }

    if(!best) {
      showMessage('Rien à portée de main.',1.2);
      return;
    }

    best.collected=true;
    best.group.visible=false;
    best.marker.visible=false;

    if(best.action) best.action();

    if(best.text) {
      notes.push({title:best.title,text:best.text});
      updateNotes();
      showMessage(best.text,6);
    }

    tone(440,.12,.025,'triangle');
  }

  function nearestItem() {
    let closest=null;
    let bestDist=Infinity;

    for(const item of items) {
      if(item.collected) continue;
      if(item.stage!==-1&&item.stage!==stage) continue;

      const dist=Math.hypot(
        player.x-item.x,
        player.z-item.z
      );

      if(dist<2.0&&dist<bestDist) {
        closest=item;
        bestDist=dist;
      }
    }

    return closest;
  }

  function startGame() {
    if(started) return;

    started=true;
    initAudio();

    $('#s3-menu').classList.add('s3-hidden');
    $('#s3-hud').classList.remove('s3-hidden');

    renderer.domElement.requestPointerLock?.();

    showMessage(
      'Le bâtiment est silencieux. Pour le moment.',
      3.5
    );
  }

  $('#s3-start').addEventListener('click',startGame);

  $('#s3-resume').addEventListener('click',()=>{
    renderer.domElement.requestPointerLock?.();
  });

  $('#s3-restart').addEventListener('click',()=>location.reload());

  $('#s3-close-journal').addEventListener(
    'click',()=>toggleJournal(true)
  );

  document.addEventListener('pointerlockchange',()=>{
    const locked=document.pointerLockElement===renderer.domElement;

    if(locked) {
      paused=false;
      $('#s3-pause').classList.add('s3-hidden');
    } else if(started&&!won&&!dead) {
      paused=true;
      $('#s3-pause').classList.remove('s3-hidden');

      for(const k in keys) keys[k]=false;
    }
  });

  renderer.domElement.addEventListener('click',()=>{
    if(started&&paused&&!won&&!dead) {
      renderer.domElement.requestPointerLock?.();
    }
  });

  // event.key = caractère du clavier courant.
  // event.code = emplacement physique : KeyW correspond au Z
  // physique sur beaucoup de claviers AZERTY.
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();

    if([
      'z','q','s','d','arrowup','arrowdown',
      'arrowleft','arrowright',' '
    ].includes(k)) e.preventDefault();

    keys[k]=true;
    keys[e.code]=true;

    if(e.repeat) return;

    if(k==='e') handleInteraction();

    if(k==='f'&&started&&!dead&&!won) {
      torchOn=!torchOn;
      flashlight.visible=torchOn;
      updateObjective();
      tone(torchOn?510:240,.08,.025,'square');
    }

    if(k==='j'&&started&&!dead&&!won) toggleJournal();
    if(k==='escape'&&journalOpen) toggleJournal(true);
  });

  window.addEventListener('keyup',e=>{
    keys[e.key.toLowerCase()]=false;
    keys[e.code]=false;
  });

  window.addEventListener('blur',()=>{
    for(const k in keys) keys[k]=false;
  });

  document.addEventListener('mousemove',e=>{
    if(!started||paused||dead||won||journalOpen) return;
    if(document.pointerLockElement!==renderer.domElement) return;

    // La souris vers la droite fait regarder vers la droite.
    player.yaw-=e.movementX*.0020;
    player.pitch-=e.movementY*.0017;

    player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch));
  });

  // ============================================================
  // 20. IA DE LA CRÉATURE
  // ============================================================

  function findPath(sr,sc,gr,gc) {
    if(!openCell(gr,gc)) return [];

    const start=sr+','+sc;
    const goal=gr+','+gc;

    const queue=[[sr,sc]];
    const previous=new Map([[start,null]]);
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];

    let found=false;

    for(let i=0;i<queue.length;i++) {
      const [r,c]=queue[i];
      const k=r+','+c;

      if(k===goal) {
        found=true;
        break;
      }

      for(const [dr,dc] of dirs) {
        const nr=r+dr,nc=c+dc;
        const nk=nr+','+nc;

        if(!openCell(nr,nc)||previous.has(nk)) continue;

        previous.set(nk,k);
        queue.push([nr,nc]);
      }
    }

    if(!found) return [];

    const path=[];
    let current=goal;

    while(current) {
      const [r,c]=current.split(',').map(Number);
      path.push(cellWorld(r,c));
      current=previous.get(current);
    }

    path.reverse();
    path.shift();
    return path;
  }

  // ============================================================
  // 21. MORT ET SCÉNARIO FINAL
  // ============================================================

  function killPlayer() {
    if(dead||won) return;

    dead=true;

    if(document.pointerLockElement) {
      document.exitPointerLock();
    }

    $('#s3-end-title').textContent='IL T’A RETROUVÉ.';

    $('#s3-end-text').textContent=
      'Le couloir plonge dans le noir. Le lendemain, le gardien retrouve une enveloppe devant la chambre 09. À l’intérieur, une photographie porte maintenant ton nom.';

    $('#s3-ending').classList.remove('s3-hidden');
    sting();
  }

  updateNotes();
  updateObjective();

  // ============================================================
  // 22. BOUCLE ANIMÉE
  // ============================================================

  const clock=new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const dt=Math.min(clock.getDelta(),.035);

    if(started&&!paused&&!dead&&!won) {
      gameTime+=dt;

      // Vecteur AVANT correspondant réellement au regard Three.js.
      // Le signe négatif est crucial : la caméra regarde selon -Z.
      const forward=
        (keyDown('z','KeyW','ArrowUp')?1:0)-
        (keyDown('s','KeyS','ArrowDown')?1:0);

      const strafe=
        (keyDown('d','KeyD','ArrowRight')?1:0)-
        (keyDown('q','KeyA','ArrowLeft')?1:0);

      const magnitude=Math.hypot(forward,strafe);
      const f=magnitude?forward/magnitude:0;
      const s=magnitude?strafe/magnitude:0;

      const sprint=
        keyDown('shift','ShiftLeft','ShiftRight')&&
        player.stamina>.035&&magnitude>0;

      const speed=sprint?5.55:3.3;

      if(sprint) {
        player.stamina=Math.max(0,player.stamina-dt*.22);
      } else {
        player.stamina=Math.min(1,player.stamina+dt*.13);
      }

      // IMPORTANT : le vecteur avant utilise -sin(yaw), -cos(yaw).
      // D et Q utilisent le vecteur horizontal droit de la caméra.
      const forwardX=-Math.sin(player.yaw);
      const forwardZ=-Math.cos(player.yaw);

      const rightX=Math.cos(player.yaw);
      const rightZ=-Math.sin(player.yaw);

      const dx=(forwardX*f+rightX*s)*speed*dt;
      const dz=(forwardZ*f+rightZ*s)*speed*dt;

      movePlayer(dx,dz);

      const bob=magnitude>0
        ?Math.sin(gameTime*(sprint?14:9))*(sprint?.045:.021)
        :Math.sin(gameTime*1.6)*.005;

      camera.position.set(player.x,player.y+bob,player.z);
      camera.rotation.set(player.pitch,player.yaw,0,'YXZ');

      if(cameraShake>0) {
        camera.position.x+=(Math.random()-.5)*cameraShake*.11;
        camera.position.y+=(Math.random()-.5)*cameraShake*.09;
        cameraShake=Math.max(0,cameraShake-dt*2.8);
      }

      if(magnitude>0&&gameTime-lastFootstep>(sprint?.34:.53)) {
        lastFootstep=gameTime;
        thud(sprint?.045:.022,sprint?84:64);
      }

      // --------------------------------------------------------
      // Lumières qui grésillent indépendamment.
      // --------------------------------------------------------

      const monsterDistance=Math.hypot(
        player.x-monster.position.x,
        player.z-monster.position.z
      );

      for(const lamp of lampData) {
        if(lamp.falling||lamp.fallen) continue;

        const nearMonster=monsterAwake&&monsterDistance<9;
        const power=powerOn?1.0:.48;

        const flicker=nearMonster
          ?(Math.random()<.12?.015:.7+Math.random()*.2)
          :(power*(Math.random()<.022?.025:
             .78+Math.sin(gameTime*6+lamp.seed)*.15));

        lamp.light.intensity=flicker;
        lamp.housingMat.emissiveIntensity=flicker*.55;

        if(Math.random()<.0005) {
          lamp.light.intensity=0;
          tone(430,.04,.01,'square');
        }
      }

      // --------------------------------------------------------
      // Lampe du plafond : grésillement, chute, choc et étincelles.
      // --------------------------------------------------------

      if(lampScareStarted&&fallingLamp&&!fallingLamp.fallen) {
        lampFallTimer+=dt;

        if(!fallingLamp.falling) {
          fallingLamp.falling=true;
          fallingLamp.timer=0;
        }

        fallingLamp.timer+=dt;

        if(fallingLamp.timer<1.35) {
          fallingLamp.light.intensity=Math.random()<.30
            ?.01
            :1.6*Math.random();

          fallingLamp.housingMat.emissiveIntensity=
            Math.random()*.9;

        } else {
          const p=Math.min(1,(fallingLamp.timer-1.35)/.78);

          fallingLamp.progress=p;
          fallingLamp.group.position.y=
            fallingLamp.baseY-p*(fallingLamp.baseY-.56);

          fallingLamp.group.rotation.z=p*1.1;
          fallingLamp.group.rotation.x=Math.sin(p*4)*.12;

          fallingLamp.light.intensity=(1-p)*1.2;

          if(p>=1) {
            fallingLamp.fallen=true;
            fallingLamp.light.intensity=0;

            createSparks(
              fallingLamp.group.position.x,
              .18,
              fallingLamp.group.position.z
            );

            soundImpact();
            cameraShake=.8;

            showMessage(
              'LA LAMPE S’ÉCRASE JUSTE DEVANT TOI.',
              2.7,true
            );
          }
        }
      }

      // --------------------------------------------------------
      // Meuble qui bascule avec collision retirée.
      // --------------------------------------------------------

      if(cabinetFall) {
        cabinetFall.elapsed+=dt;

        const p=Math.min(1,cabinetFall.elapsed/.82);
        const ease=1-Math.pow(1-p,2.6);

        cabinetFall.group.rotation.z=ease*1.22;
        cabinetFall.group.rotation.x=Math.sin(ease*2.1)*.13;
        cabinetFall.group.position.y=.45-.04*ease;

        if(p>=1&&!cabinetFall.finished) {
          cabinetFall.finished=true;
          soundImpact();
          cameraShake=.7;
          createSparks(
            cabinetFall.group.position.x,
            .18,
            cabinetFall.group.position.z
          );

          showMessage('LE MEUBLE VIENT DE S’EFFONDRER.',2,true);
        }
      }

      // --------------------------------------------------------
      // Déclencheurs : tout dépend de la position du joueur.
      // --------------------------------------------------------

      function distanceToCell(r,c) {
        const p=cellWorld(r,c);
        return Math.hypot(player.x-p.x,player.z-p.z);
      }

      if(
        stage>=1&&!lampScareStarted&&
        distanceToCell(3,7)<2.3
      ) {
        lampScareStarted=true;
        triggerLampFall(fallingLamp);
      }

      if(
        stage>=1&&!cabinetScareStarted&&
        distanceToCell(7,11)<2.0
      ) {
        triggerCabinetFall();
      }

      if(
        stage>=1&&stage<=2&&!jumpZoneTriggered&&
        distanceToCell(5,12)<1.8
      ) {
        jumpZoneTriggered=true;

        showMessage('TU AS ENTENDU ÇA ?',1.6,true);
        triggerJumpscare();
      }

      if(scheduledJumpAt>=0&&gameTime>=scheduledJumpAt) {
        scheduledJumpAt=-1;
        triggerJumpscare();
      }

      // --------------------------------------------------------
      // IA : recherche de chemin dans les couloirs.
      // --------------------------------------------------------

      if(monsterAwake) {
        monsterPathTimer-=dt;

        const pc=worldCell(player.x,player.z);
        const mc=worldCell(monster.position.x,monster.position.z);

        if(monsterPathTimer<=0) {
          monsterPath=findPath(mc.r,mc.c,pc.r,pc.c);
          monsterPathTimer=.38;
        }

        let tx=player.x;
        let tz=player.z;

        if(monsterPath.length) {
          tx=monsterPath[0].x;
          tz=monsterPath[0].z;

          if(Math.hypot(
            monster.position.x-tx,
            monster.position.z-tz
          )<.32) {
            monsterPath.shift();
          }
        }

        const vx=tx-monster.position.x;
        const vz=tz-monster.position.z;
        const len=Math.hypot(vx,vz);

        if(len>.001) {
          const speedMonster=
            (monsterDistance<8?3.0:2.25)*monsterExtraSpeed;

          const step=Math.min(len,speedMonster*dt);

          monster.position.x+=vx/len*step;
          monster.position.z+=vz/len*step;
        }

        monster.position.y=Math.sin(gameTime*6)*.028;

        monster.rotation.y=Math.atan2(
          player.x-monster.position.x,
          player.z-monster.position.z
        );

        leftArm.rotation.x=Math.sin(gameTime*7)*.25;
        rightArm.rotation.x=-Math.sin(gameTime*7)*.25;

        if(monsterDistance<8.5) {
          $('#s3-vignette').style.opacity=
            String(Math.min(.99,.88+(8.5-monsterDistance)*.018));

          if(gameTime-monsterNearTimer>1.25) {
            monsterNearTimer=gameTime;
            heartbeat();
          }
        } else {
          $('#s3-vignette').style.opacity='.88';
        }

        if(monsterDistance<1.1) killPlayer();
      }

      // --------------------------------------------------------
      // Screamer : apparition brutale en gros plan.
      // --------------------------------------------------------

      if(jumpscareActive) {
        jumpscareTime+=dt;

        if(jumpscareTime<.11) {
          jumpscareRig.scale.setScalar(
            .02+(jumpscareTime/.11)*1.65
          );
        } else if(jumpscareTime<.43) {
          jumpscareRig.scale.setScalar(1.67);
          jumpscareRig.rotation.z=Math.sin(jumpscareTime*55)*.06;
        } else if(jumpscareTime<.95) {
          jumpscareRig.scale.setScalar(
            1.67*(1-(jumpscareTime-.43)/.52)
          );
        } else {
          jumpscareRig.visible=false;
          jumpscareRig.scale.setScalar(.001);
          jumpscareRig.rotation.set(0,0,0);
          jumpscareActive=false;
          cameraShake=.35;
        }
      }

      // Particules d'étincelles.
      for(let i=sparkParticles.length-1;i>=0;i--) {
        const sp=sparkParticles[i];
        sp.life-=dt;

        sp.vy-=7*dt;

        sp.mesh.position.x+=sp.vx*dt;
        sp.mesh.position.y+=sp.vy*dt;
        sp.mesh.position.z+=sp.vz*dt;

        if(sp.mesh.position.y<.04) {
          sp.mesh.position.y=.04;
          sp.vy=Math.abs(sp.vy)*.24;
        }

        if(sp.life<=0) {
          scene.remove(sp.mesh);
          sparkParticles.splice(i,1);
        }
      }

      // Poussière en suspension.
      const dustPositions=dustGeo.attributes.position.array;

      for(let i=0;i<dustCount;i++) {
        dustPositions[i*3+1]+=.002*Math.sin(gameTime+i);

        if(dustPositions[i*3+1]>3.55) {
          dustPositions[i*3+1]=.15;
        }
      }

      dustGeo.attributes.position.needsUpdate=true;

      // Interaction.
      const near=nearestItem();
      $('#s3-prompt').textContent=near?near.prompt:'';

      for(const item of items) {
        if(item.collected) continue;

        const isCurrent=
          item.stage===stage||item.stage===-1;

        item.marker.material.emissiveIntensity=
          isCurrent?.3+Math.sin(gameTime*3)*.22:.08;
      }

      if(toastTimer>0) {
        toastTimer-=dt;

        if(toastTimer<=0) {
          $('#s3-message').classList.remove('show');
        }
      }

      // Une ambiance sonore ponctuelle, sans faire un jumpscare à chaque fois.
      if(Math.random()<.0008) {
        creakingSound();
      }
    } else {
      $('#s3-prompt').textContent='';
    }

    renderer.render(scene,camera);
  }

  animate();

  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(innerWidth,innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  });

})();
