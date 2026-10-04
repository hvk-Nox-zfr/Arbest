// ============================================================
// CYBERCRAFT 3D - ENGINE COMPLET (COLLISIONS, CRAFTS & TEXTURES)
// ============================================================

let mcScene, mcCamera, mcRenderer, mcRaycaster;
let mcBlocks = [];
let mcBlockMap = new Map();

// Dimensions & Physique
const WORLD_SIZE = 60; // Grande carte
const PLAYER_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.28;

let mcSelectedSlot = 1;
let mcIsPaused = false;
let mcOutlineMesh = null;
let mcHandGroup = null;

let mcMiningProgress = 0;
let mcTargetKey = null;
let mcCrackMesh = null;

let mcSettings = { sensitivity: 0.002, fov: 75 };

let mcPlayer = {
  pos: new THREE.Vector3(WORLD_SIZE / 2, 15, WORLD_SIZE / 2),
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
  if (pos.x - PLAYER_RADIUS < 0 || pos.x + PLAYER_RADIUS >= WORLD_SIZE) return true;
  if (pos.z - PLAYER_RADIUS < 0 || pos.z + PLAYER_RADIUS >= WORLD_SIZE) return true;

  const minX = Math.floor(pos.x - PLAYER_RADIUS);
  const maxX = Math.floor(pos.x + PLAYER_RADIUS);
  const minY = Math.floor(pos.y - PLAYER_HEIGHT);
  const maxY = Math.floor(pos.y + 0.1);
  const minZ = Math.floor(pos.z - PLAYER_RADIUS);
  const maxZ = Math.floor(pos.z + PLAYER_RADIUS);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (mcBlockMap.has(`${x},${y},${z}`)) return true;
      }
    }
  }
  return false;
}

// 4. MOTEUR DU JEU
function startCybercraftGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const container = canvas.parentElement;

  mcScene = new THREE.Scene();
  mcScene.background = new THREE.Color(0x78a7ff);
  mcScene.fog = new THREE.FogExp2(0x78a7ff, 0.012);

  mcCamera = new THREE.PerspectiveCamera(mcSettings.fov, container.clientWidth / container.clientHeight, 0.1, 1000);
  mcRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  mcRenderer.setSize(container.clientWidth || 800, container.clientHeight || 500);

  mcScene.add(mcCamera);
  mcScene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
  dirLight.position.set(50, 80, 30);
  mcScene.add(dirLight);

  createPlayerHand();
  setupCybercraftUI(container, canvas);

  function resizeCybercraft() {
    const s = window.MobileKit ? MobileKit.size(container) : { w: container.clientWidth, h: container.clientHeight };
    if (!s.w || !s.h || !mcRenderer) return;
    const inFs = window.MobileKit && MobileKit.isFullscreen();
    mcRenderer.setSize(s.w, s.h, !inFs);
    if (inFs) { canvas.style.width = '100%'; canvas.style.height = '100%'; }
    mcCamera.aspect = s.w / s.h;
    mcCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resizeCybercraft);

  // Préparation des matériaux avec textures
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const materials = {};
  Object.keys(BLOCK_TYPES).forEach(type => {
    const sideMat = new THREE.MeshLambertMaterial({ map: generateMcTexture(parseInt(type), 'side') });
    const topMat = new THREE.MeshLambertMaterial({ map: generateMcTexture(parseInt(type), 'top') });
    materials[type] = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
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

  // Génération du monde
  mcBlocks = [];
  mcBlockMap.clear();

  function addBlock(x, y, z, type) {
    const key = `${x},${y},${z}`;
    if (mcBlockMap.has(key)) return;

    const mesh = new THREE.Mesh(blockGeo, materials[type]);
    mesh.position.set(x, y, z);
    mesh.userData = { type, key, x, y, z };

    mcScene.add(mesh);
    mcBlocks.push(mesh);
    mcBlockMap.set(key, mesh);
  }

  // Terrain
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
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
        addBlock(x, y, z, type);
      }
    }
  }

  // Arbres
  for (let tx = 4; tx < WORLD_SIZE - 4; tx += 7) {
    for (let tz = 4; tz < WORLD_SIZE - 4; tz += 7) {
      if (Math.random() > 0.35) {
        let gy = 0;
        for (let y = 25; y >= 0; y--) {
          if (mcBlockMap.has(`${tx},${y},${tz}`)) { gy = y; break; }
        }
        if (gy > 0) {
          for (let h = 1; h <= 4; h++) addBlock(tx, gy + h, tz, 4);
          for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
              for (let ly = 3; ly <= 5; ly++) {
                if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                if (lx === 0 && lz === 0 && ly < 5) continue;
                addBlock(tx + lx, gy + ly, tz + lz, 5);
              }
            }
          }
        }
      }
    }
  }

  mcPlayer.pos.set(WORLD_SIZE / 2, 16, WORLD_SIZE / 2);

  // Contrôles
  const keys = {};
  let isMouseDown = false;
  mcRaycaster = new THREE.Raycaster();

  // Pose d'un bloc (bouton tactile) : même logique que le clic droit
  function placeBlockTouch() {
    if (mcIsPaused) return;
    mcRaycaster.setFromCamera(new THREE.Vector2(0, 0), mcCamera);
    const intersects = mcRaycaster.intersectObjects(mcBlocks);
    if (intersects.length > 0 && intersects[0].distance <= 5 && (mcInventory[mcSelectedSlot] || 0) > 0) {
      const hit = intersects[0];
      const normal = hit.face.normal;
      const tx = Math.round(hit.object.userData.x + normal.x);
      const ty = Math.round(hit.object.userData.y + normal.y);
      const tz = Math.round(hit.object.userData.z + normal.z);
      const p = mcPlayer.pos;
      if (Math.abs(p.x - tx) > 0.6 || Math.abs(p.z - tz) > 0.6 || Math.abs(p.y - ty) > 1.2) {
        addBlock(tx, ty, tz, mcSelectedSlot);
        mcInventory[mcSelectedSlot]--;
        updateInventoryUI();
        animateHandSwing();
      }
    }
  }

  if (window.MobileKit) {
    MobileKit.setup({ mode: 'fluid', controls: 'cyber', isPaused: () => mcIsPaused, onResize: resizeCybercraft });
    MobileKit.actions.place = placeBlockTouch;
    MobileKit.actions.menu = () => {
      mcIsPaused = true;
      const m = document.getElementById('mc-pause-menu');
      if (m) m.style.display = 'flex';
    };
    if (MobileKit.isTouch) mcIsPaused = true; // le menu s'affiche, on appuie sur REPRENDRE
  }
  let wasMining = false;

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas && !mcIsPaused) {
      mcPlayer.yaw -= e.movementX * mcSettings.sensitivity;
      mcPlayer.pitch -= e.movementY * mcSettings.sensitivity;
      mcPlayer.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, mcPlayer.pitch));
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
      return;
    }
    if (mcIsPaused) return;

    if (e.button === 0) {
      isMouseDown = true;
      animateHandSwing();
    } else if (e.button === 2) {
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
          const testPos = mcPlayer.pos.clone();
          if (Math.abs(testPos.x - tx) > 0.6 || Math.abs(testPos.z - tz) > 0.6 || Math.abs(testPos.y - ty) > 1.2) {
            addBlock(tx, ty, tz, mcSelectedSlot);
            mcInventory[mcSelectedSlot]--;
            updateInventoryUI();
            animateHandSwing();
          }
        }
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      isMouseDown = false;
      mcMiningProgress = 0;
      mcCrackMesh.visible = false;
    }
  });

  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      mcSelectedSlot = parseInt(e.key);
      updateHotbarUI();
    }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    const menu = document.getElementById('mc-pause-menu');
    if (document.pointerLockElement === canvas) {
      mcIsPaused = false;
      if (menu) menu.style.display = 'none';
    } else {
      mcIsPaused = true;
      if (menu) menu.style.display = 'flex';
    }
  });

  // BOUCLE D'ANIMATION & PHYSIQUE
  function animate() {
    if (!mcIsPaused) {
      const mt = window.MobileKit;
      if (mt) {
        if (mt.look.dx || mt.look.dy) {
          const sens = mcSettings.sensitivity * 2.2;
          mcPlayer.yaw -= mt.look.dx * sens;
          mcPlayer.pitch -= mt.look.dy * sens;
          mcPlayer.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, mcPlayer.pitch));
          mt.look.dx = 0; mt.look.dy = 0;
        }
        if (mt.hold.mine !== wasMining) {
          wasMining = mt.hold.mine;
          if (wasMining) animateHandSwing();
          else { mcMiningProgress = 0; mcCrackMesh.visible = false; }
        }
      }
      const speed = keys['shift'] ? 0.14 : 0.08;
      const move = new THREE.Vector3();

      if (keys['z'] || keys['w'] || keys['arrowup']) move.z -= 1;
      if (keys['s'] || keys['arrowdown']) move.z += 1;
      if (keys['q'] || keys['a'] || keys['arrowleft']) move.x -= 1;
      if (keys['d'] || keys['arrowright']) move.x += 1;

      if (mt) { move.x += mt.joy.x; move.z += mt.joy.y; }

      if (move.lengthSq() > 0) {
        move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), mcPlayer.yaw);
        
        const nx = mcPlayer.pos.clone(); nx.x += move.x * speed;
        if (!checkCollision(nx)) mcPlayer.pos.x = nx.x;
        
        const nz = mcPlayer.pos.clone(); nz.z += move.z * speed;
        if (!checkCollision(nz)) mcPlayer.pos.z = nz.z;
      }

      if ((keys[' '] || (mt && mt.hold.jump)) && mcPlayer.onGround) {
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

      if (mcPlayer.pos.y < -10) mcPlayer.pos.set(WORLD_SIZE / 2, 16, WORLD_SIZE / 2);

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

        if (isMouseDown || (mt && mt.hold.mine)) {
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
          mcCrackMesh.material.map = generateCrackTexture(stage);
          mcCrackMesh.material.needsUpdate = true;
          mcCrackMesh.visible = true;

          if (mcMiningProgress >= 1.0) {
            if (toolLevel >= bData.minLevel) {
              mcInventory[bData.drop] = (mcInventory[bData.drop] || 0) + 1;
            } else {
              alert(`Il faut une meilleure pioche pour miner du ${bData.name} !`);
            }
            mcScene.remove(hit);
            mcBlocks = mcBlocks.filter(b => b !== hit);
            mcBlockMap.delete(hit.userData.key);
            mcCrackMesh.visible = false;
            mcMiningProgress = 0;
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
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

// 5. INTERFACE & CRAFTS
function setupCybercraftUI(container, canvas) {
  const oldHud = document.getElementById('mc-hud-container');
  if (oldHud) oldHud.remove();

  const hudContainer = document.createElement('div');
  hudContainer.id = 'mc-hud-container';
  hudContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;font-family:sans-serif;';

  hudContainer.innerHTML = `
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:24px;font-weight:bold;">+</div>

    <div id="mc-hotbar" style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);display:flex;gap:6px;background:rgba(0,0,0,0.7);padding:6px;border:2px solid #555;border-radius:6px;pointer-events:auto;">
      ${[1, 2, 3, 4, 5].map(i => `
        <div id="mc-slot-${i}" style="width:50px;height:50px;border:2px solid #333;background:rgba(255,255,255,0.05);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:10px;position:relative;">
          <span style="position:absolute;top:2px;left:4px;color:#aaa;">${i}</span>
          <span id="mc-count-${i}">0</span>
        </div>
      `).join('')}
    </div>

    <div id="mc-pause-menu" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(10,10,20,0.85);display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:15px;pointer-events:auto;overflow-y:auto;box-sizing:border-box;padding:10px;">
      <h2 style="color:#00f3ff;margin:0;">PAUSE & CRAFTS</h2>
      <button id="mc-btn-resume" style="padding:10px 20px;background:#00f3ff;border:none;font-weight:bold;cursor:pointer;">REPRENDRE</button>

      <div style="display:flex;gap:15px;background:rgba(255,255,255,0.05);padding:15px;border-radius:8px;max-width:90%;flex-wrap:wrap;justify-content:center;">
        <div style="color:#fff;font-size:11px;min-width:140px;">
          <h4 style="color:#ffcc00;margin:0 0 5px 0;">INVENTAIRE</h4>
          <div id="mc-inv-list"></div>
        </div>

        <div style="color:#fff;font-size:11px;display:flex;flex-direction:column;gap:6px;">
          <h4 style="color:#00f3ff;margin:0 0 5px 0;">CRAFTS</h4>
          <button onclick="craftItem('STICK')">4 Bâtons (1 Bois)</button>
          <button onclick="craftItem('WOOD_PICKAXE')">Pioche Bois (3 Bois + 2 Bâtons)</button>
          <button onclick="craftItem('STONE_PICKAXE')">Pioche Pierre (3 Pierre + 2 Bâtons)</button>
          <button onclick="craftItem('IRON_PICKAXE')">Pioche Fer (3 Lingots Fer + 2 Bâtons)</button>
          <button onclick="craftItem('DIAMOND_PICKAXE')">Pioche Diamant (3 Diamants + 2 Bâtons)</button>
          <button onclick="craftItem('NETHERITE_INGOT')">Lingot Nétherite (4 Débris)</button>
          <button onclick="craftItem('NETHERITE_PICKAXE')">Pioche Nétherite (1 Pioche Diamant + 1 Lingot)</button>
        </div>

        <div style="color:#fff;font-size:11px;display:flex;flex-direction:column;gap:6px;">
          <h4 style="color:#ff0055;margin:0 0 5px 0;">FOUR</h4>
          <button onclick="smeltItem('FER')">Fondre Fer (1 Minerai Fer + 1 Charbon)</button>
          <button onclick="smeltItem('NETHERITE')">Fondre Débris (1 Débris + 1 Charbon)</button>
        </div>
      </div>
    </div>
  `;

  container.style.position = 'relative';
  container.appendChild(hudContainer);

  document.getElementById('mc-btn-resume').addEventListener('click', () => {
    if (window.MobileKit && MobileKit.isTouch) {
      mcIsPaused = false;
      const menu = document.getElementById('mc-pause-menu');
      if (menu) menu.style.display = 'none';
    } else {
      canvas.requestPointerLock();
    }
  });

  // Sélection des slots au toucher
  for (let i = 1; i <= 5; i++) {
    const slot = document.getElementById('mc-slot-' + i);
    if (slot) slot.addEventListener('click', () => { mcSelectedSlot = i; updateHotbarUI(); });
  }

  updateInventoryUI();
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
    alert("Ressources insuffisantes !");
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
    alert("Il faut le minerai brut ET du charbon !");
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