// ============================================================
// CYBERCRAFT 3D - ENGINE COMPLET (COLLISIONS, CRAFTS & TEXTURES)
// Version mobile : joystick + glisser pour regarder + boutons,
// rendu allégé (seuls les blocs visibles sont dessinés), plein écran paysage.
// ============================================================

let mcScene, mcCamera, mcRenderer, mcRaycaster;
let mcBlocks = [];                 // meshes visibles (raycast)
let mcBlockMap = new Map();        // clé -> mesh visible
const mcData = new Map();          // clé -> type, TOUS les blocs (collisions, génération)

// Dimensions & Physique
const MC_WORLD_SIZE = 60; // Grande carte
const PLAYER_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.28;

let mcSelectedSlot = 1;
let mcIsPaused = false;
let mcOutlineMesh = null;
let mcHandGroup = null;

let mcMiningProgress = 0;
let mcTargetKey = null;
let mcCrackMesh = null;
let mcMining = false;              // clic gauche maintenu / bouton ⛏ maintenu

let mcSettings = { sensitivity: 0.002, fov: 75 };

let mcTouchMode = false;
const mcTouch = { x: 0, y: 0, jump: false };

let mcRunId = 0;
let mcCleanups = [];
let mcBlockGeo = null;
let mcMaterials = {};
const mcCrackCache = {};
let mcToastTimer = null;

let mcPlayer = {
  pos: new THREE.Vector3(MC_WORLD_SIZE / 2, 15, MC_WORLD_SIZE / 2),
  velocity: new THREE.Vector3(),
  onGround: false,
  pitch: 0,
  yaw: 0
};

// Inventaire
let mcInventory = {
  '1': 64, '2': 64, '3': 0, '4': 0, '5': 0,
  'STICK': 0, 'CHARBON': 0, 'FER_ORE': 0, 'IRON_INGOT': 0,
  'DIAMOND': 0, 'ANCIENT_DEBRIS': 0, 'NETHERITE_SCRAP': 0, 'NETHERITE_INGOT': 0,
  'WOOD_PICKAXE': 0, 'STONE_PICKAXE': 0, 'IRON_PICKAXE': 0, 'DIAMOND_PICKAXE': 0, 'NETHERITE_PICKAXE': 0
};

// Types de blocs
const BLOCK_TYPES = {
  1: { name: 'Herbe', color: '#5b8731', sideColor: '#79553a', hardness: 0.6, minLevel: 0, drop: '2' },
  2: { name: 'Terre', color: '#79553a', sideColor: '#79553a', hardness: 0.5, minLevel: 0, drop: '2' },
  3: { name: 'Roche', color: '#686868', sideColor: '#686868', hardness: 1.5, minLevel: 1, drop: '3' },
  4: { name: 'Bois', color: '#674d2f', sideColor: '#533c23', hardness: 1.2, minLevel: 0, drop: '4' },
  5: { name: 'Feuilles', color: '#315c1e', sideColor: '#315c1e', hardness: 0.2, minLevel: 0, drop: '5' },
  6: { name: 'Minerai Charbon', color: '#686868', spotColor: '#1c1c1c', hardness: 1.8, minLevel: 1, drop: 'CHARBON' },
  7: { name: 'Minerai Fer', color: '#686868', spotColor: '#d8af93', hardness: 2.2, minLevel: 2, drop: 'FER_ORE' },
  8: { name: 'Minerai Diamant', color: '#686868', spotColor: '#4dedf4', hardness: 3.0, minLevel: 3, drop: 'DIAMOND' },
  9: { name: 'Débris Antiques', color: '#5c4637', spotColor: '#3b2b20', hardness: 4.0, minLevel: 4, drop: 'ANCIENT_DEBRIS' }
};

// 1. GÉNÉRATEUR DE TEXTURES MINECRAFT 16x16
function generateMcTexture(type, face = 'side') {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  const conf = BLOCK_TYPES[type];
  let baseColor = conf.color;
  if (type === 1 && face === 'side') baseColor = conf.sideColor;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 16, 16);

  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      const noise = (Math.random() - 0.5) * 0.18;
      ctx.fillStyle = noise > 0 ? `rgba(255,255,255,${noise})` : `rgba(0,0,0,${-noise})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (type === 1 && face === 'side') {
    ctx.fillStyle = conf.color;
    ctx.fillRect(0, 0, 16, 4);
    for (let x = 0; x < 16; x += 2) {
      if (Math.random() > 0.3) ctx.fillRect(x, 4, 1, 2);
    }
  }

  if (conf.spotColor) {
    ctx.fillStyle = conf.spotColor;
    const spots = [[3, 4], [4, 4], [10, 3], [11, 4], [6, 10], [7, 10], [12, 11]];
    spots.forEach(([sx, sy]) => ctx.fillRect(sx, sy, 2, 2));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function generateCrackTexture(stage) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.8)';

  const count = stage * 4;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 16);
    const y = Math.floor(Math.random() * 16);
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

// Les textures de fissures sont mises en cache (avant : une nouvelle texture à chaque image)
function getCrackTexture(stage) {
  if (!mcCrackCache[stage]) mcCrackCache[stage] = generateCrackTexture(stage);
  return mcCrackCache[stage];
}

function getBestPickaxeLevel() {
  if (mcInventory.NETHERITE_PICKAXE > 0) return 5;
  if (mcInventory.DIAMOND_PICKAXE > 0) return 4;
  if (mcInventory.IRON_PICKAXE > 0) return 3;
  if (mcInventory.STONE_PICKAXE > 0) return 2;
  if (mcInventory.WOOD_PICKAXE > 0) return 1;
  return 0;
}

// 2. MAIN DU JOUEUR & ANIMATIONS
function createPlayerHand() {
  mcHandGroup = new THREE.Group();

  const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
  const armMat = new THREE.MeshLambertMaterial({ color: 0xc89666 });
  const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x00a8ff });

  const sleeveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.22), sleeveMat);
  sleeveMesh.position.y = 0.12;
  const armMesh = new THREE.Mesh(armGeo, armMat);

  const fullArm = new THREE.Group();
  fullArm.add(armMesh);
  fullArm.add(sleeveMesh);

  fullArm.position.set(0.35, -0.35, -0.5);
  fullArm.rotation.set(-0.3, -0.2, 0);

  mcHandGroup.add(fullArm);
  mcCamera.add(mcHandGroup);
}

function animateHandSwing() {
  if (!mcHandGroup) return;
  const arm = mcHandGroup.children[0];
  let step = 0;

  const swingInterval = setInterval(() => {
    step += 0.25;
    arm.rotation.x = -0.3 - Math.sin(step) * 0.4;
    arm.rotation.y = -0.2 + Math.sin(step) * 0.15;
    if (step >= Math.PI) {
      arm.rotation.set(-0.3, -0.2, 0);
      clearInterval(swingInterval);
    }
  }, 16);
}

// 3. DETECTION DES COLLISIONS STRICTES & BORDURES
function checkCollision(pos) {
  // Limites strictes du monde
  if (pos.x - PLAYER_RADIUS < 0 || pos.x + PLAYER_RADIUS >= MC_WORLD_SIZE) return true;
  if (pos.z - PLAYER_RADIUS < 0 || pos.z + PLAYER_RADIUS >= MC_WORLD_SIZE) return true;

  const minX = Math.floor(pos.x - PLAYER_RADIUS);
  const maxX = Math.floor(pos.x + PLAYER_RADIUS);
  const minY = Math.floor(pos.y - PLAYER_HEIGHT);
  const maxY = Math.floor(pos.y + 0.1);
  const minZ = Math.floor(pos.z - PLAYER_RADIUS);
  const maxZ = Math.floor(pos.z + PLAYER_RADIUS);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (mcData.has(`${x},${y},${z}`)) return true;
      }
    }
  }
  return false;
}

// 4. BLOCS : seuls les blocs en contact avec l'air ont un mesh (énorme gain de perf sur mobile)
const MC_NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function mcIsExposed(x, y, z) {
  for (const [dx, dy, dz] of MC_NEIGHBORS) {
    if (!mcData.has(`${x + dx},${y + dy},${z + dz}`)) return true;
  }
  return false;
}

function mcSpawnMesh(x, y, z, type) {
  const key = `${x},${y},${z}`;
  if (mcBlockMap.has(key)) return;
  const mesh = new THREE.Mesh(mcBlockGeo, mcMaterials[type]);
  mesh.position.set(x, y, z);
  mesh.userData = { type, key, x, y, z };
  mcScene.add(mesh);
  mcBlocks.push(mesh);
  mcBlockMap.set(key, mesh);
}

// Ajout en cours de partie (pose d'un bloc)
function mcAddBlock(x, y, z, type) {
  const key = `${x},${y},${z}`;
  if (mcData.has(key)) return false;
  mcData.set(key, type);
  if (mcIsExposed(x, y, z)) mcSpawnMesh(x, y, z, type);
  return true;
}

// Retrait d'un bloc : révèle les voisins qui étaient cachés
function mcRemoveBlock(mesh) {
  const { x, y, z, key } = mesh.userData;
  mcScene.remove(mesh);
  const i = mcBlocks.indexOf(mesh);
  if (i > -1) { mcBlocks[i] = mcBlocks[mcBlocks.length - 1]; mcBlocks.pop(); }
  mcBlockMap.delete(key);
  mcData.delete(key);
  for (const [dx, dy, dz] of MC_NEIGHBORS) {
    const nx = x + dx, ny = y + dy, nz = z + dz;
    const t = mcData.get(`${nx},${ny},${nz}`);
    if (t !== undefined) mcSpawnMesh(nx, ny, nz, t);
  }
}

function mcPlaceBlock() {
  if (!mcRaycaster || mcIsPaused) return;
  mcRaycaster.setFromCamera(new THREE.Vector2(0, 0), mcCamera);
  const intersects = mcRaycaster.intersectObjects(mcBlocks);
  if (intersects.length > 0 && intersects[0].distance <= 5) {
    if ((mcInventory[mcSelectedSlot] || 0) > 0) {
      const hit = intersects[0];
      const normal = hit.face.normal;
      const tx = Math.round(hit.object.userData.x + normal.x);
      const ty = Math.round(hit.object.userData.y + normal.y);
      const tz = Math.round(hit.object.userData.z + normal.z);

      // Ne pas poser sur le joueur
      const p = mcPlayer.pos;
      if (Math.abs(p.x - tx) > 0.6 || Math.abs(p.z - tz) > 0.6 || Math.abs(p.y - ty) > 1.2) {
        if (mcAddBlock(tx, ty, tz, mcSelectedSlot)) {
          mcInventory[mcSelectedSlot]--;
          updateInventoryUI();
          animateHandSwing();
        }
      }
    }
  }
}

function mcSetPaused(p) {
  mcIsPaused = p;
  const menu = document.getElementById('mc-pause-menu');
  if (menu) menu.style.display = p ? 'flex' : 'none';
  if (p) {
    mcMining = false;
    mcMiningProgress = 0;
    mcTouch.x = 0; mcTouch.y = 0; mcTouch.jump = false;
    if (mcCrackMesh) mcCrackMesh.visible = false;
  }
}

// Redimensionne le rendu sur la taille réelle du conteneur (rotation, plein écran…)
function mcResize() {
  if (!mcRenderer || !mcCamera) return;
  const cv = mcRenderer.domElement;
  const p = cv.parentElement;
  const w = (p && p.clientWidth) || 800;
  const h = (p && p.clientHeight) || 500;
  mcRenderer.setSize(w, h);
  mcCamera.aspect = w / h;
  mcCamera.updateProjectionMatrix();
}

// 5. MOTEUR DU JEU
function startCybercraftGame() {
  if (window.GameMobile) GameMobile.reset();

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const container = canvas.parentElement;

  // Nettoyage d'une éventuelle partie précédente
  mcRunId++;
  const runId = mcRunId;
  mcCleanups.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  mcCleanups = [];
  if (mcRenderer) { try { mcRenderer.dispose(); } catch (e) { /* ignore */ } }
  mcMining = false; mcMiningProgress = 0; mcTargetKey = null;
  mcPlayer.velocity.set(0, 0, 0);
  mcPlayer.pitch = 0; mcPlayer.yaw = 0; mcPlayer.onGround = false;
  mcTouch.x = 0; mcTouch.y = 0; mcTouch.jump = false;

  mcTouchMode = !!(window.GameMobile
    ? GameMobile.isTouch
    : (window.matchMedia && matchMedia('(pointer: coarse)').matches));

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    mcCleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  mcScene = new THREE.Scene();
  mcScene.background = new THREE.Color(0x78a7ff);
  mcScene.fog = new THREE.FogExp2(0x78a7ff, 0.012);

  mcCamera = new THREE.PerspectiveCamera(mcSettings.fov, 1, 0.1, 1000);
  mcRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  mcResize();

  mcScene.add(mcCamera);
  mcScene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
  dirLight.position.set(50, 80, 30);
  mcScene.add(dirLight);

  createPlayerHand();
  setupCybercraftUI(container, canvas);

  // Préparation des matériaux avec textures
  mcBlockGeo = new THREE.BoxGeometry(1, 1, 1);
  mcMaterials = {};
  Object.keys(BLOCK_TYPES).forEach(type => {
    const sideMat = new THREE.MeshLambertMaterial({ map: generateMcTexture(parseInt(type), 'side') });
    const topMat = new THREE.MeshLambertMaterial({ map: generateMcTexture(parseInt(type), 'top') });
    mcMaterials[type] = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
  });

  // Wireframe & Surbrillance
  mcOutlineMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.005, 1.005, 1.005),
    new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true })
  );
  mcOutlineMesh.visible = false;
  mcScene.add(mcOutlineMesh);

  mcCrackMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7 })
  );
  mcCrackMesh.visible = false;
  mcScene.add(mcCrackMesh);

  // Génération du monde (données d'abord, meshes ensuite)
  mcBlocks = [];
  mcBlockMap.clear();
  mcData.clear();

  const setData = (x, y, z, type) => {
    const key = `${x},${y},${z}`;
    if (!mcData.has(key)) mcData.set(key, type);
  };

  // Terrain
  for (let x = 0; x < MC_WORLD_SIZE; x++) {
    for (let z = 0; z < MC_WORLD_SIZE; z++) {
      const height = Math.floor(Math.sin(x * 0.1) * Math.cos(z * 0.1) * 4 + 7);
      for (let y = 0; y <= height; y++) {
        let type = 2;
        if (y === height) type = 1;
        else if (y < height - 2) {
          type = 3;
          const rand = Math.random();
          if (y <= 2 && rand < 0.04) type = 9;
          else if (y <= 3 && rand < 0.08) type = 8;
          else if (y <= 5 && rand < 0.18) type = 7;
          else if (rand < 0.3) type = 6;
        }
        setData(x, y, z, type);
      }
    }
  }

  // Arbres
  for (let tx = 4; tx < MC_WORLD_SIZE - 4; tx += 7) {
    for (let tz = 4; tz < MC_WORLD_SIZE - 4; tz += 7) {
      if (Math.random() > 0.35) {
        let gy = 0;
        for (let y = 25; y >= 0; y--) {
          if (mcData.has(`${tx},${y},${tz}`)) { gy = y; break; }
        }
        if (gy > 0) {
          for (let h = 1; h <= 4; h++) setData(tx, gy + h, tz, 4);
          for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
              for (let ly = 3; ly <= 5; ly++) {
                if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                if (lx === 0 && lz === 0 && ly < 5) continue;
                setData(tx + lx, gy + ly, tz + lz, 5);
              }
            }
          }
        }
      }
    }
  }

  // Seuls les blocs en contact avec l'air sont dessinés
  mcData.forEach((type, key) => {
    const [x, y, z] = key.split(',').map(Number);
    if (mcIsExposed(x, y, z)) mcSpawnMesh(x, y, z, type);
  });

  mcPlayer.pos.set(MC_WORLD_SIZE / 2, 16, MC_WORLD_SIZE / 2);

  // Contrôles
  const keys = {};
  mcRaycaster = new THREE.Raycaster();

  if (!mcTouchMode) {
    // --- Souris (PC) ---
    on(document, 'mousemove', (e) => {
      if (document.pointerLockElement === canvas && !mcIsPaused) {
        mcPlayer.yaw -= e.movementX * mcSettings.sensitivity;
        mcPlayer.pitch -= e.movementY * mcSettings.sensitivity;
        mcPlayer.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, mcPlayer.pitch));
      }
    });

    on(canvas, 'mousedown', (e) => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        return;
      }
      if (mcIsPaused) return;

      if (e.button === 0) {
        mcMining = true;
        animateHandSwing();
      } else if (e.button === 2) {
        mcPlaceBlock();
      }
    });

    on(window, 'mouseup', (e) => {
      if (e.button === 0) {
        mcMining = false;
        mcMiningProgress = 0;
        mcCrackMesh.visible = false;
      }
    });

    on(document, 'pointerlockchange', () => {
      mcSetPaused(document.pointerLockElement !== canvas);
    });
  } else {
    // --- Tactile : un doigt qui glisse sur l'écran = regarder autour ---
    let lookId = null, lx = 0, ly = 0;
    on(canvas, 'pointerdown', (e) => {
      if (mcIsPaused || lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
    });
    on(canvas, 'pointermove', (e) => {
      if (e.pointerId !== lookId || mcIsPaused) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      mcPlayer.yaw -= dx * mcSettings.sensitivity * 3;
      mcPlayer.pitch -= dy * mcSettings.sensitivity * 3;
      mcPlayer.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, mcPlayer.pitch));
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    on(canvas, 'pointerup', endLook);
    on(canvas, 'pointercancel', endLook);

    // Joueur en pause au départ : le menu propose "REPRENDRE" (pas de pointer lock sur mobile)
    mcSetPaused(true);
  }

  on(window, 'keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' && !mcIsPaused) e.preventDefault();
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      mcSelectedSlot = parseInt(e.key);
      updateHotbarUI();
    }
  });
  on(window, 'keyup', e => { keys[e.key.toLowerCase()] = false; });
  on(canvas, 'contextmenu', e => e.preventDefault());
  on(window, 'resize', mcResize);

  // BOUCLE D'ANIMATION & PHYSIQUE
  function animate() {
    if (runId !== mcRunId) return; // une nouvelle partie a pris le relais

    if (!mcIsPaused) {
      const speed = keys['shift'] ? 0.14 : 0.08;
      const move = new THREE.Vector3();

      if (keys['z'] || keys['w'] || keys['arrowup']) move.z -= 1;
      if (keys['s'] || keys['arrowdown']) move.z += 1;
      if (keys['q'] || keys['a'] || keys['arrowleft']) move.x -= 1;
      if (keys['d'] || keys['arrowright']) move.x += 1;
      if (mcTouchMode) { move.x += mcTouch.x; move.z += mcTouch.y; }

      if (move.lengthSq() > 0) {
        const mag = Math.min(1, move.length());   // joystick analogique
        move.normalize().multiplyScalar(mag).applyAxisAngle(new THREE.Vector3(0, 1, 0), mcPlayer.yaw);

        const nx = mcPlayer.pos.clone(); nx.x += move.x * speed;
        if (!checkCollision(nx)) mcPlayer.pos.x = nx.x;

        const nz = mcPlayer.pos.clone(); nz.z += move.z * speed;
        if (!checkCollision(nz)) mcPlayer.pos.z = nz.z;
      }

      if ((keys[' '] || mcTouch.jump) && mcPlayer.onGround) {
        mcPlayer.velocity.y = 0.15;
        mcPlayer.onGround = false;
      }

      mcPlayer.velocity.y -= 0.008;
      const ny = mcPlayer.pos.clone(); ny.y += mcPlayer.velocity.y;

      if (checkCollision(ny)) {
        if (mcPlayer.velocity.y < 0) mcPlayer.onGround = true;
        mcPlayer.velocity.y = 0;
      } else {
        mcPlayer.pos.y = ny.y;
        mcPlayer.onGround = false;
      }

      if (mcPlayer.pos.y < -10) mcPlayer.pos.set(MC_WORLD_SIZE / 2, 16, MC_WORLD_SIZE / 2);

      mcCamera.position.copy(mcPlayer.pos);
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.x = mcPlayer.pitch; euler.y = mcPlayer.yaw;
      mcCamera.quaternion.setFromEuler(euler);

      // CASSE DE BLOCS CONTINU
      mcRaycaster.setFromCamera(new THREE.Vector2(0, 0), mcCamera);
      const intersects = mcRaycaster.intersectObjects(mcBlocks);

      if (intersects.length > 0 && intersects[0].distance <= 5) {
        const hit = intersects[0].object;
        mcOutlineMesh.position.copy(hit.position);
        mcOutlineMesh.visible = true;

        if (mcMining) {
          const bData = BLOCK_TYPES[hit.userData.type];
          if (mcTargetKey !== hit.userData.key) {
            mcTargetKey = hit.userData.key;
            mcMiningProgress = 0;
          }

          const toolLevel = getBestPickaxeLevel();
          const speedMultiplier = 1 + toolLevel * 0.8;
          mcMiningProgress += (0.02 * speedMultiplier) / bData.hardness;

          mcCrackMesh.position.copy(hit.position);
          const stage = Math.min(9, Math.floor(mcMiningProgress * 10));
          mcCrackMesh.material.map = getCrackTexture(stage);
          mcCrackMesh.material.needsUpdate = true;
          mcCrackMesh.visible = true;

          if (mcMiningProgress >= 1.0) {
            if (toolLevel >= bData.minLevel) {
              mcInventory[bData.drop] = (mcInventory[bData.drop] || 0) + 1;
            } else {
              mcToast(`Il faut une meilleure pioche pour miner du ${bData.name} !`);
            }
            mcRemoveBlock(hit);
            mcCrackMesh.visible = false;
            mcMiningProgress = 0;
            mcTargetKey = null;
            updateInventoryUI();
          }
        } else {
          mcCrackMesh.visible = false;
        }
      } else {
        mcOutlineMesh.visible = false;
        mcCrackMesh.visible = false;
      }
    }

    mcRenderer.render(mcScene, mcCamera);
    currentGameLoop = requestAnimationFrame(animate);
  }

  currentGameLoop = requestAnimationFrame(animate);

  // Mobile : plein écran en paysage
  mcResize();
  if (window.GameMobile) GameMobile.start('cybercraft', { fluid: true, noScore: true, hint: true });
}

// 6. INTERFACE & CRAFTS
function mcToast(msg) {
  const hud = document.getElementById('mc-hud-container');
  if (!hud) return;
  let t = document.getElementById('mc-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'mc-toast';
    t.style.cssText = 'position:absolute;top:14%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.78);color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;border:1px solid #00f3ff;pointer-events:none;max-width:92%;text-align:center;z-index:5;';
    hud.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(mcToastTimer);
  mcToastTimer = setTimeout(() => { t.style.display = 'none'; }, 1900);
}

function setupCybercraftUI(container, canvas) {
  const oldHud = document.getElementById('mc-hud-container');
  if (oldHud) oldHud.remove();

  const hudContainer = document.createElement('div');
  hudContainer.id = 'mc-hud-container';
  hudContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;font-family:sans-serif;';

  hudContainer.innerHTML = `
    <style>
      #mc-pause-menu button { cursor:pointer; }
      #mc-pause-menu .mc-craft-btn { padding:8px 10px; font-size:12px; text-align:left; }
      #mc-touch-ui { position:absolute; inset:0; pointer-events:none; touch-action:none; }
      #mc-joy, #mc-btns { bottom:92px; }
      @media (min-width: 640px) { #mc-joy, #mc-btns { bottom:18px; } }
    </style>

    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:24px;font-weight:bold;">+</div>

    <div id="mc-hotbar" style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);display:flex;gap:6px;background:rgba(0,0,0,0.7);padding:6px;border:2px solid #555;border-radius:6px;pointer-events:auto;touch-action:manipulation;">
      ${[1, 2, 3, 4, 5].map(i => `
        <div id="mc-slot-${i}" style="width:50px;height:50px;border:2px solid #333;background:rgba(255,255,255,0.05);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:10px;position:relative;">
          <span style="position:absolute;top:2px;left:4px;color:#aaa;">${i}</span>
          <span id="mc-count-${i}">0</span>
        </div>
      `).join('')}
    </div>

    <div id="mc-pause-menu" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(10,10,20,0.88);display:flex;pointer-events:auto;overflow-y:auto;box-sizing:border-box;padding:10px;">
      <div style="margin:auto;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:100%;">
        <h2 style="color:#00f3ff;margin:0;">PAUSE & CRAFTS</h2>
        <button id="mc-btn-resume" style="padding:12px 26px;background:#00f3ff;border:none;font-weight:bold;font-size:15px;border-radius:6px;">REPRENDRE</button>

        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:15px;background:rgba(255,255,255,0.05);padding:15px;border-radius:8px;max-width:100%;box-sizing:border-box;">
          <div style="color:#fff;font-size:11px;min-width:140px;">
            <h4 style="color:#ffcc00;margin:0 0 5px 0;">INVENTAIRE</h4>
            <div id="mc-inv-list"></div>
          </div>

          <div style="color:#fff;font-size:11px;display:flex;flex-direction:column;gap:6px;">
            <h4 style="color:#00f3ff;margin:0 0 5px 0;">CRAFTS</h4>
            <button class="mc-craft-btn" onclick="craftItem('STICK')">4 Bâtons (1 Bois)</button>
            <button class="mc-craft-btn" onclick="craftItem('WOOD_PICKAXE')">Pioche Bois (3 Bois + 2 Bâtons)</button>
            <button class="mc-craft-btn" onclick="craftItem('STONE_PICKAXE')">Pioche Pierre (3 Pierre + 2 Bâtons)</button>
            <button class="mc-craft-btn" onclick="craftItem('IRON_PICKAXE')">Pioche Fer (3 Lingots Fer + 2 Bâtons)</button>
            <button class="mc-craft-btn" onclick="craftItem('DIAMOND_PICKAXE')">Pioche Diamant (3 Diamants + 2 Bâtons)</button>
            <button class="mc-craft-btn" onclick="craftItem('NETHERITE_INGOT')">Lingot Nétherite (4 Débris)</button>
            <button class="mc-craft-btn" onclick="craftItem('NETHERITE_PICKAXE')">Pioche Nétherite (1 Pioche Diamant + 1 Lingot)</button>
          </div>

          <div style="color:#fff;font-size:11px;display:flex;flex-direction:column;gap:6px;">
            <h4 style="color:#ff0055;margin:0 0 5px 0;">FOUR</h4>
            <button class="mc-craft-btn" onclick="smeltItem('FER')">Fondre Fer (1 Minerai Fer + 1 Charbon)</button>
            <button class="mc-craft-btn" onclick="smeltItem('NETHERITE')">Fondre Débris (1 Débris + 1 Charbon)</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.style.position = 'relative';
  container.appendChild(hudContainer);

  // Choix du slot au doigt / à la souris
  [1, 2, 3, 4, 5].forEach(i => {
    const slot = document.getElementById(`mc-slot-${i}`);
    if (slot) slot.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      mcSelectedSlot = i;
      updateHotbarUI();
    });
  });

  document.getElementById('mc-btn-resume').addEventListener('click', () => {
    if (mcTouchMode) mcSetPaused(false);
    else canvas.requestPointerLock();
  });

  if (mcTouchMode) setupCybercraftTouchUI(hudContainer);

  updateInventoryUI();
}

// Joystick + boutons d'action (mobile)
function setupCybercraftTouchUI(hud) {
  const wrap = document.createElement('div');
  wrap.id = 'mc-touch-ui';

  const circle = 'border-radius:50%;background:rgba(5,5,16,0.55);border:2px solid rgba(0,243,255,0.6);color:#00f3ff;font-weight:700;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;';
  wrap.innerHTML = `
    <div id="mc-joy" style="position:absolute;left:16px;width:124px;height:124px;border-radius:50%;background:rgba(255,255,255,0.10);border:2px solid rgba(255,255,255,0.35);pointer-events:auto;touch-action:none;">
      <div id="mc-joy-knob" style="position:absolute;left:36px;top:36px;width:50px;height:50px;border-radius:50%;background:rgba(0,243,255,0.55);border:2px solid #00f3ff;pointer-events:none;"></div>
    </div>

    <div id="mc-btns" style="position:absolute;right:16px;width:170px;height:160px;pointer-events:none;">
      <div id="mc-btn-mine"  style="position:absolute;right:0;bottom:0;width:84px;height:84px;font-size:32px;${circle}">⛏</div>
      <div id="mc-btn-place" style="position:absolute;right:6px;bottom:96px;width:64px;height:64px;font-size:26px;${circle}">▣</div>
      <div id="mc-btn-jump"  style="position:absolute;right:98px;bottom:10px;width:64px;height:64px;font-size:26px;${circle}">⤒</div>
    </div>

    <div id="mc-btn-menu" style="position:absolute;left:14px;top:14px;width:44px;height:44px;font-size:22px;border-radius:10px;background:rgba(5,5,16,0.55);border:2px solid rgba(0,243,255,0.6);color:#00f3ff;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;">☰</div>
  `;
  hud.appendChild(wrap);

  // --- Joystick ---
  const joy = wrap.querySelector('#mc-joy');
  const knob = wrap.querySelector('#mc-joy-knob');
  let joyId = null;

  const updateJoy = (e) => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    const dead = 0.14;
    mcTouch.x = Math.abs(dx) < dead ? 0 : dx;
    mcTouch.y = Math.abs(dy) < dead ? 0 : dy;
  };
  const endJoy = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    mcTouch.x = 0; mcTouch.y = 0;
    knob.style.transform = 'translate(0, 0)';
  };
  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (joyId !== null) return;
    joyId = e.pointerId;
    try { joy.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    updateJoy(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) updateJoy(e); });
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);

  // --- Boutons (appui maintenu ou simple toucher) ---
  const bind = (id, onDown, onUp) => {
    const el = wrap.querySelector(id);
    let pid = null;
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      el.style.background = 'rgba(5,5,16,0.55)';
      if (onUp) onUp();
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (pid !== null) return;
      pid = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      el.style.background = 'rgba(0,243,255,0.38)';
      onDown();
    });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  bind('#mc-btn-mine',
    () => { if (mcIsPaused) return; mcMining = true; animateHandSwing(); },
    () => { mcMining = false; mcMiningProgress = 0; if (mcCrackMesh) mcCrackMesh.visible = false; });
  bind('#mc-btn-place', () => mcPlaceBlock());
  bind('#mc-btn-jump', () => { mcTouch.jump = true; }, () => { mcTouch.jump = false; });
  bind('#mc-btn-menu', () => mcSetPaused(true));
}

window.craftItem = function(target) {
  if (target === 'STICK' && mcInventory['4'] >= 1) {
    mcInventory['4'] -= 1; 
    mcInventory['STICK'] += 4;
  } else if (target === 'WOOD_PICKAXE' && mcInventory['4'] >= 3 && mcInventory['STICK'] >= 2) {
    mcInventory['4'] -= 3; 
    mcInventory['STICK'] -= 2; 
    mcInventory.WOOD_PICKAXE = 1;
  } else if (target === 'STONE_PICKAXE' && mcInventory['3'] >= 3 && mcInventory['STICK'] >= 2) {
    mcInventory['3'] -= 3; 
    mcInventory['STICK'] -= 2; 
    mcInventory.STONE_PICKAXE = 1;
  } else if (target === 'IRON_PICKAXE' && mcInventory['IRON_INGOT'] >= 3 && mcInventory['STICK'] >= 2) {
    mcInventory['IRON_INGOT'] -= 3; 
    mcInventory['STICK'] -= 2; 
    mcInventory.IRON_PICKAXE = 1;
  } else if (target === 'DIAMOND_PICKAXE' && mcInventory['DIAMOND'] >= 3 && mcInventory['STICK'] >= 2) {
    mcInventory['DIAMOND'] -= 3; 
    mcInventory['STICK'] -= 2; 
    mcInventory.DIAMOND_PICKAXE = 1;
  } else if (target === 'NETHERITE_INGOT' && mcInventory['NETHERITE_SCRAP'] >= 4) {
    mcInventory['NETHERITE_SCRAP'] -= 4; 
    mcInventory['NETHERITE_INGOT'] += 1;
  } else if (target === 'NETHERITE_PICKAXE' && mcInventory.DIAMOND_PICKAXE >= 1 && mcInventory['NETHERITE_INGOT'] >= 1) {
    mcInventory.DIAMOND_PICKAXE = 0; 
    mcInventory['NETHERITE_INGOT'] -= 1; 
    mcInventory.NETHERITE_PICKAXE = 1;
  } else {
    mcToast('Ressources insuffisantes !');
  }
  updateInventoryUI();
};

window.smeltItem = function(type) {
  if (type === 'FER' && mcInventory['FER_ORE'] >= 1 && mcInventory['CHARBON'] >= 1) {
    mcInventory['FER_ORE'] -= 1;
    mcInventory['CHARBON'] -= 1;
    mcInventory['IRON_INGOT'] += 1;
  } else if (type === 'NETHERITE' && mcInventory['ANCIENT_DEBRIS'] >= 1 && mcInventory['CHARBON'] >= 1) {
    mcInventory['ANCIENT_DEBRIS'] -= 1;
    mcInventory['CHARBON'] -= 1;
    mcInventory['NETHERITE_SCRAP'] += 1;
  } else {
    mcToast('Il faut le minerai brut ET du charbon !');
  }
  updateInventoryUI();
};

function updateInventoryUI() {
  const list = document.getElementById('mc-inv-list');
  if (list) {
    list.innerHTML = `
      Bois: ${mcInventory['4']}<br>
      Pierre: ${mcInventory['3']}<br>
      Bâtons: ${mcInventory['STICK']}<br>
      Charbon: ${mcInventory['CHARBON']}<br>
      Minerai Fer: ${mcInventory['FER_ORE']}<br>
      Lingot Fer: ${mcInventory['IRON_INGOT']}<br>
      Diamant: ${mcInventory['DIAMOND']}<br>
      Niveau Pioche: ${getBestPickaxeLevel()}/5
    `;
  }
  updateHotbarUI();
}

function updateHotbarUI() {
  for (let i = 1; i <= 5; i++) {
    const countElem = document.getElementById(`mc-count-${i}`);
    const slotElem = document.getElementById(`mc-slot-${i}`);
    if (countElem) countElem.innerText = `${BLOCK_TYPES[i].name.substring(0, 4)}: ${mcInventory[i] || 0}`;
    if (slotElem) {
      slotElem.style.borderColor = (i === mcSelectedSlot) ? '#00f3ff' : '#333';
    }
  }
}

// Lancement automatique
if (typeof startCybercraftGame === 'function') {
  window.addEventListener('DOMContentLoaded', () => {
    startCybercraftGame();
  });
}