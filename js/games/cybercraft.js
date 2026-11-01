// ============================================================
// CYBERCRAFT 3D v3
// - MONDE OUVERT INFINI : chunks générés et affichés autour du joueur
// - Optimisé : maillage par chunks, faces cachées supprimées, budget de temps par image,
//   chargement progressif, qualité automatique si ça lag
// - Craft à la façon Minecraft : grille 2x2 (touche E) et table de craft (grille 3x3),
//   four avec combustible, livre de recettes cliquable
// - Menu : commandes personnalisables, audio, graphismes, options
// - Sauvegarde automatique (graine + modifications) dans le navigateur
// ============================================================

let mcScene, mcCamera, mcRenderer;

// ---------- Dimensions & physique ----------
const MC_WORLD_H = 48;
const MC_CHUNK = 16;
const MC_COL = MC_CHUNK * MC_CHUNK;
const MC_VOL = MC_COL * MC_WORLD_H;
const PLAYER_HEIGHT = 1.62;   // yeux -> pieds
const PLAYER_HEAD = 0.18;     // yeux -> sommet de la tête
const PLAYER_RADIUS = 0.3;
const MC_WALL = 255;          // sous le monde (y < 0)
const MC_UNLOADED = 254;      // chunk pas encore généré
const MC_REACH = 5;
const MC_DAY_SECONDS = 600;
const MC_TABLE_SIZE = 3;      // grille de la table de craft : 3 = 3x3 (mets 4, 5 ou 6 pour l'agrandir)
const MC_SAVE_KEY = 'cybercraft_save_v3';
const MC_SET_KEY = 'cybercraft_settings_v3';

// ---------- Monde infini, découpé en chunks de 16x16 ----------
const mcChunkMap = new Map();   // clé -> { cx, cz, data, top, solid, glass, meshed, dirty }
const mcEdits = new Map();      // clé de chunk -> Map(indexLocal -> type) : modifications du joueur
let mcSeed = 1;
let mcReady = false;
let mcStarted = false;
let mcLastCh = null;            // cache du dernier chunk lu
let mcGenQueue = [], mcMeshQueue = [];
let mcCenterCx = 1e9, mcCenterCz = 1e9;

const mcCK = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const mcBi = (v) => Math.floor(v + 0.5);   // un bloc d'index i occupe [i-0.5 ; i+0.5]

// Bloc à (x,y,z) : 0 = air, 254 = chunk pas encore chargé, 255 = sous le monde
function mcGet(x, y, z) {
  if (y < 0) return MC_WALL;
  if (y >= MC_WORLD_H) return 0;
  const cx = x >> 4, cz = z >> 4;
  let ch = mcLastCh;
  if (!ch || ch.cx !== cx || ch.cz !== cz) {
    ch = mcChunkMap.get(mcCK(cx, cz));
    if (!ch || !ch.data) return MC_UNLOADED;
    mcLastCh = ch;
  }
  return ch.data[(y << 8) | ((z & 15) << 4) | (x & 15)];
}
function mcInside(x, y, z) {
  if (y < 0 || y >= MC_WORLD_H) return false;
  const ch = mcChunkMap.get(mcCK(x >> 4, z >> 4));
  return !!(ch && ch.data);
}
function mcTopAt(x, z) {
  const ch = mcChunkMap.get(mcCK(x >> 4, z >> 4));
  return ch && ch.top ? ch.top[((z & 15) << 4) | (x & 15)] : 0;
}

// ---------- État du jeu ----------
let mcIsPaused = true;
let mcOutlineMesh = null, mcCrackMesh = null, mcHandGroup = null, mcHandArm = null, mcHeldBlock = null;
let mcMiningProgress = 0, mcTargetKey = null, mcMining = false;
let mcTarget = null;
let mcSelectedIndex = 0;
let mcTime = 0.22;
let mcRunId = 0;
let mcCleanups = [];
let mcToastTimer = null, mcSlotNameTimer = null;
let mcTouchMode = false;
let mcTab = 'inv';
let mcCapture = null;
let mcSwingT = 0;
let mcBobPhase = 0;
let mcStepDist = 0;
let mcHitSoundT = 0;
let mcDeniedT = 0;
let mcSaveT = 0;
let mcConfirmReset = false;
const mcTouch = { x: 0, y: 0, jump: false, run: false };
const mcKeys = {};

let mcPlayer = {
  pos: new THREE.Vector3(0, 30, 0),
  velocity: new THREE.Vector3(),
  onGround: false,
  pitch: 0,
  yaw: 0
};

// ============================================================
// TEXTURES (atlas 16x16 par tuile)
// ============================================================
const MC_TILE = 16, MC_COLS = 8, MC_ROWS = 4;
const MC_T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, LOG_SIDE: 4, LOG_TOP: 5, LEAVES: 6,
  COAL: 7, IRON: 8, DIAMOND: 9, DEBRIS_SIDE: 10, DEBRIS_TOP: 11, PLANKS: 12, BRICKS: 13,
  SAND: 14, GLASS: 15, BEDROCK: 16, TABLE_TOP: 17, TABLE_SIDE: 18, FURNACE_SIDE: 19, FURNACE_TOP: 20
};
let mcAtlasCanvas = null, mcAtlasTex = null;
const mcTileAvg = {};
let mcIcons = {};
const mcCrackTex = [];

const mcHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mcPal = (...hx) => hx.map(mcHex);
const PAL = {
  DIRT: mcPal('#866043', '#79553a', '#6d4a31', '#8f684a', '#5f412c'),
  STONE: mcPal('#7f7f7f', '#767676', '#707070', '#868686', '#6a6a6a'),
  GRASS: mcPal('#5fa03a', '#579633', '#68a841', '#4e8a2d', '#72b04a'),
  SAND: mcPal('#dbd09a', '#d3c68d', '#e2d8a6', '#cabd83', '#d9cc94'),
  BARK: mcPal('#5a4328', '#4b3720', '#6a512f', '#3e2d19'),
  PLANK: mcPal('#b8945f', '#ad8a56', '#c29e69', '#b28e5a'),
  LEAF: mcPal('#2f6f20', '#3a8228', '#285e1b', '#47932f', '#33771f'),
  BEDROCK: mcPal('#3d3d3d', '#2c2c2c', '#4b4b4b', '#202020', '#353535'),
  DEBRIS: mcPal('#5c4637', '#4f3b2e', '#6a5242', '#44322a')
};

function mcMulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dessine une tuile 16x16 -> tableau RGBA
function mcDrawTile(tile, rng) {
  const px = new Uint8ClampedArray(16 * 16 * 4);
  const set = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
    const i = (y * 16 + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = (a === undefined ? 255 : a);
  };
  const pick = (pal) => pal[Math.floor(rng() * pal.length)];
  const fill = (pal) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, pick(pal)); };
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

  const stoneBase = () => {
    fill(PAL.STONE);
    for (let k = 0; k < 3; k++) {          // petites fissures
      let x = Math.floor(rng() * 14) + 1, y = Math.floor(rng() * 14) + 1;
      for (let s = 0; s < 4; s++) {
        set(x, y, mcHex('#5d5d5d'));
        x += Math.floor(rng() * 3) - 1; y += Math.floor(rng() * 2);
      }
    }
  };
  const blobs = (cols, n) => {
    const shapes = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    for (let k = 0; k < n; k++) {
      const cx = 2 + Math.floor(rng() * 12), cy = 2 + Math.floor(rng() * 12);
      const cnt = 3 + Math.floor(rng() * 2);
      for (let s = 0; s < cnt; s++) {
        const o = shapes[Math.floor(rng() * shapes.length)];
        set(cx + o[0], cy + o[1], pick(cols));
      }
    }
  };

  switch (tile) {
    case MC_T.DIRT:
      fill(PAL.DIRT);
      for (let k = 0; k < 10; k++) set(Math.floor(rng() * 16), Math.floor(rng() * 16), mcHex(rng() > 0.5 ? '#9a7a5a' : '#54382a'));
      break;
    case MC_T.STONE: stoneBase(); break;
    case MC_T.GRASS_TOP:
      fill(PAL.GRASS);
      for (let k = 0; k < 14; k++) set(Math.floor(rng() * 16), Math.floor(rng() * 16), mcHex(rng() > 0.5 ? '#3f7a24' : '#85c05a'));
      break;
    case MC_T.GRASS_SIDE:
      fill(PAL.DIRT);
      for (let x = 0; x < 16; x++) {
        const d = 3 + Math.floor(rng() * 3);
        for (let y = 0; y < d; y++) set(x, y, pick(PAL.GRASS));
        if (rng() > 0.5) set(x, d, mcHex('#4e8a2d'));
      }
      break;
    case MC_T.LOG_SIDE:
      for (let x = 0; x < 16; x++) {
        let c = pick(PAL.BARK);
        for (let y = 0; y < 16; y++) {
          if (rng() < 0.25) c = pick(PAL.BARK);
          set(x, y, c);
        }
      }
      break;
    case MC_T.LOG_TOP:
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          let c;
          if (d > 6.5) c = pick(PAL.BARK);
          else c = (Math.floor(d) % 2 === 0) ? mcHex('#a58553') : mcHex('#8e6f42');
          set(x, y, shade(c, 0.94 + rng() * 0.12));
        }
      }
      break;
    case MC_T.LEAVES:
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (rng() < 0.13) set(x, y, [0, 0, 0], 0);
          else set(x, y, pick(PAL.LEAF));
        }
      }
      break;
    case MC_T.COAL: stoneBase(); blobs(mcPal('#2b2b2b', '#1a1a1a', '#3a3a3a'), 5); break;
    case MC_T.IRON: stoneBase(); blobs(mcPal('#d8af93', '#c49a7c', '#e6c3a8'), 5); break;
    case MC_T.DIAMOND: stoneBase(); blobs(mcPal('#4dedf4', '#2bc9d0', '#9ffaff'), 4); break;
    case MC_T.DEBRIS_SIDE:
      fill(PAL.DEBRIS);
      for (const row of [3, 7, 11]) {
        for (let x = 0; x < 16; x++) set(x, row, rng() > 0.2 ? mcHex('#8c6f5c') : mcHex('#3b2b20'));
      }
      for (let k = 0; k < 6; k++) set(Math.floor(rng() * 16), Math.floor(rng() * 16), mcHex('#c9a36a'));
      break;
    case MC_T.DEBRIS_TOP:
      fill(PAL.DEBRIS);
      for (let i = 2; i < 14; i++) {
        set(i, 2, mcHex('#3b2b20')); set(i, 13, mcHex('#3b2b20'));
        set(2, i, mcHex('#3b2b20')); set(13, i, mcHex('#3b2b20'));
      }
      for (let k = 0; k < 5; k++) set(4 + Math.floor(rng() * 8), 4 + Math.floor(rng() * 8), mcHex('#c9a36a'));
      break;
    case MC_T.PLANKS:
      fill(PAL.PLANK);
      for (let b = 0; b < 4; b++) {
        for (let x = 0; x < 16; x++) set(x, b * 4 + 3, mcHex('#8a6a3a'));
        const jx = (b * 7 + 3) % 16;
        for (let y = 0; y < 3; y++) set(jx, b * 4 + y, mcHex('#9a7746'));
        for (let k = 0; k < 2; k++) {
          const gx = Math.floor(rng() * 12), gy = b * 4 + Math.floor(rng() * 3);
          for (let s = 0; s < 4; s++) set(gx + s, gy, mcHex('#a58553'));
        }
      }
      break;
    case MC_T.BRICKS:
      fill(mcPal('#8a8a8a', '#818181', '#939393'));
      for (let r = 0; r < 4; r++) {
        for (let x = 0; x < 16; x++) set(x, r * 4 + 3, mcHex('#5d5d5d'));
        const off = (r % 2) * 8;
        for (let y = 0; y < 3; y++) set((off + 0) % 16, r * 4 + y, mcHex('#5d5d5d'));
      }
      break;
    case MC_T.SAND:
      fill(PAL.SAND);
      break;
    case MC_T.GLASS:
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const edge = x === 0 || y === 0 || x === 15 || y === 15;
          if (edge) set(x, y, mcHex('#d6f0f7'), 230);
          else set(x, y, mcHex('#c8ebf5'), 40);
        }
      }
      for (const [x, y] of [[3, 3], [4, 4], [5, 5], [3, 5], [4, 6], [11, 10], [12, 11]]) set(x, y, [255, 255, 255], 200);
      break;
    case MC_T.TABLE_TOP: {
      fill(PAL.PLANK);
      const dk = mcHex('#6b4e2a'), md = mcHex('#7a5a30');
      for (let i = 0; i < 16; i++) {
        set(i, 0, dk); set(i, 15, dk); set(0, i, dk); set(15, i, dk);
        set(i, 5, md); set(i, 10, md); set(5, i, md); set(10, i, md);
      }
      break;
    }
    case MC_T.TABLE_SIDE: {
      fill(PAL.PLANK);
      const dk = mcHex('#6b4e2a'), md = mcHex('#7a5a30');
      for (let x = 0; x < 16; x++) { set(x, 0, dk); set(x, 1, md); set(x, 2, md); set(x, 15, dk); }
      for (let y = 3; y < 15; y++) { set(0, y, dk); set(15, y, dk); }
      for (let x = 3; x < 8; x++) { set(x, 6, mcHex('#bdbdbd')); set(x, 7, mcHex('#9a9a9a')); }   // scie
      for (let y = 5; y < 11; y++) set(4, y + 3, mcHex('#4a3720'));
      for (let y = 6; y < 11; y++) set(11, y, mcHex('#4a3720'));                                  // marteau
      for (let x = 9; x < 14; x++) set(x, 5, mcHex('#8a8a8a'));
      break;
    }
    case MC_T.FURNACE_SIDE: {
      stoneBase();
      for (let i = 0; i < 16; i++) { set(i, 0, mcHex('#5a5a5a')); set(i, 15, mcHex('#5a5a5a')); set(0, i, mcHex('#5a5a5a')); set(15, i, mcHex('#5a5a5a')); }
      for (let y = 6; y <= 12; y++) for (let x = 4; x <= 11; x++) set(x, y, mcHex('#1b1b1b'));
      for (let x = 5; x <= 10; x++) set(x, 11, mcHex(x % 2 ? '#ff8a1f' : '#ffd34d'));
      for (let x = 6; x <= 9; x++) set(x, 10, mcHex('#ff5a00'));
      break;
    }
    case MC_T.FURNACE_TOP: {
      stoneBase();
      for (let i = 0; i < 16; i++) { set(i, 0, mcHex('#5a5a5a')); set(i, 15, mcHex('#5a5a5a')); set(0, i, mcHex('#5a5a5a')); set(15, i, mcHex('#5a5a5a')); }
      for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) set(x, y, mcHex('#4a4a4a'));
      break;
    }
    case MC_T.BEDROCK:
      fill(PAL.BEDROCK);
      blobs(mcPal('#171717', '#555555'), 6);
      break;
    default:
      fill(PAL.STONE);
  }
  return px;
}

function mcBuildAtlas() {
  const rng = mcMulberry(20260101);
  const canvas = document.createElement('canvas');
  canvas.width = MC_COLS * MC_TILE;
  canvas.height = MC_ROWS * MC_TILE;
  const ctx = canvas.getContext('2d');
  const total = Object.keys(MC_T).length;
  for (let t = 0; t < total; t++) {
    const px = mcDrawTile(t, rng);
    ctx.putImageData(new ImageData(px, MC_TILE, MC_TILE), (t % MC_COLS) * MC_TILE, Math.floor(t / MC_COLS) * MC_TILE);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 100) { r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
    }
    n = n || 1;
    mcTileAvg[t] = [r / n / 255, g / n / 255, b / n / 255];
  }
  mcAtlasCanvas = canvas;
  return canvas;
}

function mcApplyTexFilter(tex) {
  const f = mcSettings.smoothTextures ? THREE.LinearFilter : THREE.NearestFilter;
  tex.magFilter = f;
  tex.minFilter = f;
  tex.needsUpdate = true;
}

function mcMakeCrackTextures() {
  mcCrackTex.length = 0;
  const rng = mcMulberry(777);
  const pts = [];
  const branches = [];
  for (let b = 0; b < 7; b++) branches.push({ x: 7.5, y: 7.5, a: rng() * Math.PI * 2 });
  for (let s = 0; s < 9; s++) {
    for (const br of branches) {
      br.x += Math.cos(br.a); br.y += Math.sin(br.a);
      br.a += (rng() - 0.5) * 0.9;
      pts.push([Math.round(br.x), Math.round(br.y)]);
    }
  }
  for (let stage = 0; stage < 10; stage++) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const count = Math.round(pts.length * (stage + 1) / 10);
    for (let i = 0; i < count; i++) ctx.fillRect(pts[i][0], pts[i][1], 1, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    mcCrackTex.push(tex);
  }
}

// Icône de cube isométrique pour la barre d'objets / inventaire
function mcMakeCubeIcon(topTile, sideTile) {
  const c = document.createElement('canvas');
  c.width = 40; c.height = 40;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const w = 17, u = [w, w / 2], v = [-w, w / 2], h = 18, T = [20, 2];
  const draw = (tile, m, dark) => {
    ctx.save();
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(mcAtlasCanvas, (tile % MC_COLS) * MC_TILE, Math.floor(tile / MC_COLS) * MC_TILE, MC_TILE, MC_TILE, 0, 0, MC_TILE, MC_TILE);
    if (dark) { ctx.fillStyle = 'rgba(0,0,0,' + dark + ')'; ctx.fillRect(0, 0, MC_TILE, MC_TILE); }
    ctx.restore();
  };
  draw(topTile, [u[0] / 16, u[1] / 16, v[0] / 16, v[1] / 16, T[0], T[1]], 0);
  draw(sideTile, [u[0] / 16, u[1] / 16, 0, h / 16, T[0] + v[0], T[1] + v[1]], 0.22);
  draw(sideTile, [-v[0] / 16, -v[1] / 16, 0, h / 16, T[0] + u[0] + v[0], T[1] + u[1] + v[1]], 0.42);
  return c.toDataURL();
}

// ============================================================
// BLOCS, OBJETS, OUTILS, RECETTES
// ============================================================
const MC_B = { GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAVES: 5, COAL: 6, IRON: 7, DIAMOND: 8, DEBRIS: 9, PLANKS: 10, BRICKS: 11, SAND: 12, GLASS: 13, BEDROCK: 14 };

const BLOCK_TYPES = {
  1: { name: 'Herbe', tiles: [MC_T.GRASS_TOP, MC_T.GRASS_SIDE, MC_T.DIRT], hardness: 0.6, tool: 'SHOVEL', minLevel: 0, drop: '2', sound: 'grass' },
  2: { name: 'Terre', tiles: [MC_T.DIRT, MC_T.DIRT, MC_T.DIRT], hardness: 0.5, tool: 'SHOVEL', minLevel: 0, drop: '2', sound: 'grass' },
  3: { name: 'Roche', tiles: [MC_T.STONE, MC_T.STONE, MC_T.STONE], hardness: 1.5, tool: 'PICKAXE', minLevel: 1, drop: '3', sound: 'stone' },
  4: { name: 'Bois', tiles: [MC_T.LOG_TOP, MC_T.LOG_SIDE, MC_T.LOG_TOP], hardness: 1.2, tool: 'AXE', minLevel: 0, drop: '4', sound: 'wood' },
  5: { name: 'Feuilles', tiles: [MC_T.LEAVES, MC_T.LEAVES, MC_T.LEAVES], hardness: 0.2, tool: null, minLevel: 0, drop: '5', sound: 'leaves', transparent: true },
  6: { name: 'Minerai de charbon', tiles: [MC_T.COAL, MC_T.COAL, MC_T.COAL], hardness: 1.8, tool: 'PICKAXE', minLevel: 1, drop: 'CHARBON', sound: 'stone' },
  7: { name: 'Minerai de fer', tiles: [MC_T.IRON, MC_T.IRON, MC_T.IRON], hardness: 2.2, tool: 'PICKAXE', minLevel: 2, drop: 'FER_ORE', sound: 'stone' },
  8: { name: 'Minerai de diamant', tiles: [MC_T.DIAMOND, MC_T.DIAMOND, MC_T.DIAMOND], hardness: 3.0, tool: 'PICKAXE', minLevel: 3, drop: 'DIAMOND', sound: 'stone' },
  9: { name: 'Débris antiques', tiles: [MC_T.DEBRIS_TOP, MC_T.DEBRIS_SIDE, MC_T.DEBRIS_TOP], hardness: 4.0, tool: 'PICKAXE', minLevel: 4, drop: 'ANCIENT_DEBRIS', sound: 'stone' },
  10: { name: 'Planches', tiles: [MC_T.PLANKS, MC_T.PLANKS, MC_T.PLANKS], hardness: 1.0, tool: 'AXE', minLevel: 0, drop: '10', sound: 'wood' },
  11: { name: 'Briques', tiles: [MC_T.BRICKS, MC_T.BRICKS, MC_T.BRICKS], hardness: 2.0, tool: 'PICKAXE', minLevel: 1, drop: '11', sound: 'stone' },
  12: { name: 'Sable', tiles: [MC_T.SAND, MC_T.SAND, MC_T.SAND], hardness: 0.5, tool: 'SHOVEL', minLevel: 0, drop: '12', sound: 'sand' },
  13: { name: 'Verre', tiles: [MC_T.GLASS, MC_T.GLASS, MC_T.GLASS], hardness: 0.3, tool: null, minLevel: 0, drop: '13', sound: 'glass', transparent: true, glass: true },
  15: { name: 'Table de craft', tiles: [MC_T.TABLE_TOP, MC_T.TABLE_SIDE, MC_T.PLANKS], hardness: 1.2, tool: 'AXE', minLevel: 0, drop: '15', sound: 'wood' },
  16: { name: 'Four', tiles: [MC_T.FURNACE_TOP, MC_T.FURNACE_SIDE, MC_T.FURNACE_TOP], hardness: 2.0, tool: 'PICKAXE', minLevel: 1, drop: '16', sound: 'stone' },
  14: { name: 'Roche mère', tiles: [MC_T.BEDROCK, MC_T.BEDROCK, MC_T.BEDROCK], hardness: Infinity, tool: null, minLevel: 0, drop: null, sound: 'stone' }
};

const MC_PLACEABLE = [1, 2, 3, 4, 5, 10, 11, 12, 13, 15, 16];
let mcHotbar = [1, 2, 3, 4, 5, 0, 0, 0, 0];   // 9 cases personnalisables (0 = vide)

const MC_ITEMS = {
  STICK: { n: 'Bâton', i: '🥢' },
  CHARBON: { n: 'Charbon', i: '⚫' },
  FER_ORE: { n: 'Minerai de fer', i: '🟤' },
  IRON_INGOT: { n: 'Lingot de fer', i: '⛓️' },
  DIAMOND: { n: 'Diamant', i: '💎' },
  ANCIENT_DEBRIS: { n: 'Débris antiques', i: '🟫' },
  NETHERITE_SCRAP: { n: 'Fragment de nétherite', i: '🔸' },
  NETHERITE_INGOT: { n: 'Lingot de nétherite', i: '🟪' }
};

const MC_TIERS = [
  { id: 'WOOD', n: 'bois', mat: '10', mult: 2.0 },
  { id: 'STONE', n: 'pierre', mat: '3', mult: 3.2 },
  { id: 'IRON', n: 'fer', mat: 'IRON_INGOT', mult: 4.4 },
  { id: 'DIAMOND', n: 'diamant', mat: 'DIAMOND', mult: 5.6 },
  { id: 'NETHERITE', n: 'nétherite', mat: null, mult: 6.6 }
];
const MC_TOOLS = [
  { id: 'PICKAXE', n: 'Pioche', i: '⛏️', mats: 3 },
  { id: 'AXE', n: 'Hache', i: '🪓', mats: 3 },
  { id: 'SHOVEL', n: 'Pelle', i: '🥄', mats: 1 }
];

// ---------- Recettes : on les fabrique en posant les objets sur une grille ----------
const MC_RECIPES = [];
(function buildRecipes() {
  const add = (rec) => {
    if (rec.shape) { rec.h = rec.shape.length; rec.w = rec.shape[0].length; rec.big = rec.h > 2 || rec.w > 2; }
    else rec.big = rec.shapeless.length > 4;
    MC_RECIPES.push(rec);
  };
  add({ id: 'planks', name: 'Planches', shapeless: ['4'], out: { k: '10', n: 4 } });
  add({ id: 'sticks', name: 'Bâtons', shape: [['10'], ['10']], out: { k: 'STICK', n: 4 } });
  add({ id: 'table', name: 'Table de craft', shape: [['10', '10'], ['10', '10']], out: { k: '15', n: 1 } });
  add({ id: 'furnace', name: 'Four', shape: [['3', '3', '3'], ['3', null, '3'], ['3', '3', '3']], out: { k: '16', n: 1 } });
  add({ id: 'bricks', name: 'Briques', shape: [['3', '3'], ['3', '3']], out: { k: '11', n: 4 } });
  add({ id: 'ingot_neth', name: 'Lingot de nétherite', shapeless: ['NETHERITE_SCRAP', 'NETHERITE_SCRAP', 'NETHERITE_SCRAP', 'NETHERITE_SCRAP'], out: { k: 'NETHERITE_INGOT', n: 1 } });
  MC_TOOLS.forEach(tl => {
    MC_TIERS.forEach((t, ti) => {
      const key = t.id + '_' + tl.id;
      const name = tl.n + ' en ' + t.n;
      if (ti < 4) {
        const M = t.mat, S = 'STICK';
        const shape = tl.id === 'PICKAXE' ? [[M, M, M], [null, S, null], [null, S, null]]
          : tl.id === 'AXE' ? [[M, M], [M, S], [null, S]]
            : [[M], [S], [S]];
        add({ id: key, name, shape, out: { k: key, n: 1 }, tool: tl.id, tier: ti + 1 });
      } else {
        add({ id: key, name, shapeless: ['DIAMOND_' + tl.id, 'NETHERITE_INGOT'], out: { k: key, n: 1 }, tool: tl.id, tier: 5 });
      }
    });
  });
})();

const MC_TIER_COL = { WOOD: '#c08a4a', STONE: '#b8b8b8', IRON: '#ffffff', DIAMOND: '#4df0ff', NETHERITE: '#b070ff' };

// Four : ce qui cuit, et ce qui brûle (secondes de chauffe)
const MC_SMELT = { FER_ORE: 'IRON_INGOT', ANCIENT_DEBRIS: 'NETHERITE_SCRAP', '12': '13', '4': 'CHARBON' };
const MC_FUEL = { CHARBON: 40, '4': 12, '10': 6, STICK: 3 };
const MC_SMELT_TIME = 5;
let mcFurnace = { inp: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0 };
function mcResetFurnace() { mcFurnace = { inp: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0 }; }

let mcInventory = {};
function mcResetInventory() {
  mcInventory = {
    '1': 64, '2': 64, '3': 0, '4': 0, '5': 0, '10': 0, '11': 0, '12': 0, '13': 0, '15': 0, '16': 0,
    STICK: 0, CHARBON: 0, FER_ORE: 0, IRON_INGOT: 0, DIAMOND: 0, ANCIENT_DEBRIS: 0,
    NETHERITE_SCRAP: 0, NETHERITE_INGOT: 0
  };
  MC_TIERS.forEach(t => MC_TOOLS.forEach(tl => { mcInventory[t.id + '_' + tl.id] = 0; }));
}
mcResetInventory();

function mcToolTier(tool) {
  for (let i = MC_TIERS.length - 1; i >= 0; i--) {
    if (mcInventory[MC_TIERS[i].id + '_' + tool] > 0) return i + 1;
  }
  return 0;
}
function getBestPickaxeLevel() { return mcToolTier('PICKAXE'); }

function mcItemName(k) {
  if (BLOCK_TYPES[k]) return BLOCK_TYPES[k].name;
  if (MC_ITEMS[k]) return MC_ITEMS[k].n;
  const parts = String(k).split('_');
  const t = MC_TIERS.find(x => x.id === parts[0]);
  const tl = MC_TOOLS.find(x => x.id === parts[1]);
  if (t && tl) return tl.n + ' en ' + t.n;
  return String(k);
}

// Donne un objet au joueur (et l'ajoute à la barre d'objets si c'est un bloc posable)
function mcGive(k, n) {
  mcInventory[k] = (mcInventory[k] || 0) + n;
  const id = parseInt(k, 10);
  if (BLOCK_TYPES[k] && MC_PLACEABLE.indexOf(id) >= 0 && mcHotbar.indexOf(id) < 0) {
    const free = mcHotbar.indexOf(0);
    if (free >= 0) mcHotbar[free] = id;
  }
}

// ---------- Grille de fabrication ----------
let mcGridSize = 2, mcGrid = [], mcCraftMode = 'inv', mcCursor = null;
function mcInitGrid(mode) {
  mcCraftMode = mode;
  mcGridSize = mode === 'table' ? MC_TABLE_SIZE : 2;
  mcGrid = new Array(mcGridSize * mcGridSize).fill(null);
}
mcInitGrid('inv');

function mcReturnGrid() {
  mcGrid.forEach((c, i) => { if (c) { mcGive(c.k, c.n); mcGrid[i] = null; } });
}

// Quelle recette correspond à ce qu'il y a dans la grille ? (la forme compte, pas la position)
function mcGridResult() {
  const N = mcGridSize;
  let r0 = N, r1 = -1, c0 = N, c1 = -1;
  const items = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = mcGrid[r * N + c];
      if (cell) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); items.push(cell.k); }
    }
  }
  if (!items.length) return null;
  const h = r1 - r0 + 1, w = c1 - c0 + 1;
  const sorted = items.slice().sort().join('|');
  for (const rec of MC_RECIPES) {
    if (rec.shapeless) {
      if (rec.shapeless.length === items.length && rec.shapeless.slice().sort().join('|') === sorted) return rec;
      continue;
    }
    if (rec.h !== h || rec.w !== w) continue;
    for (let mir = 0; mir < 2; mir++) {
      let ok = true;
      for (let r = 0; r < h && ok; r++) {
        for (let c = 0; c < w; c++) {
          const want = rec.shape[r][mir ? w - 1 - c : c] || null;
          const cell = mcGrid[(r0 + r) * N + c0 + c];
          if (want !== (cell ? cell.k : null)) { ok = false; break; }
        }
      }
      if (ok) return rec;
    }
  }
  return null;
}

function mcTakeResult() {
  const rec = mcGridResult();
  if (!rec) return false;
  mcGrid.forEach((c, i) => { if (c) { c.n--; if (c.n <= 0) mcGrid[i] = null; } });
  mcGive(rec.out.k, rec.out.n);
  mcPlayCraft();
  return true;
}
function mcTakeAll() {
  let n = 0, last = null;
  while (n < 64) {
    const rec = mcGridResult();
    if (!rec) break;
    last = rec; mcTakeResult(); n++;
  }
  if (last) mcToast('Fabriqué : ' + n + '× ' + last.name);
}

// Pose 1 objet du curseur dans une case (ou reprend ce qu'il y a dedans)
function mcPutCell(i) {
  const cell = mcGrid[i];
  if (mcCursor) {
    if ((mcInventory[mcCursor] || 0) <= 0) { mcCursor = null; return; }
    if (cell && cell.k !== mcCursor) { mcGive(cell.k, cell.n); mcGrid[i] = null; }
    if (mcGrid[i]) mcGrid[i].n++; else mcGrid[i] = { k: mcCursor, n: 1 };
    mcInventory[mcCursor]--;
    if (mcInventory[mcCursor] <= 0) mcCursor = null;
  } else if (cell) {
    mcGive(cell.k, cell.n);
    mcGrid[i] = null;
  }
}

// Remplit la grille avec une recette (prend les objets dans l'inventaire)
function mcAutoFill(id) {
  const rec = MC_RECIPES.find(r => r.id === id);
  if (!rec) return;
  if (rec.big && mcGridSize < 3) { mcToast('Il faut une table de craft : clic droit sur une table !'); return; }
  mcReturnGrid();
  const N = mcGridSize, cells = [];
  if (rec.shapeless) rec.shapeless.forEach((k, i) => cells.push([i, k]));
  else {
    for (let r = 0; r < rec.h; r++) for (let c = 0; c < rec.w; c++) if (rec.shape[r][c]) cells.push([r * N + c, rec.shape[r][c]]);
  }
  const need = {};
  cells.forEach(([, k]) => { need[k] = (need[k] || 0) + 1; });
  const missing = Object.keys(need).filter(k => (mcInventory[k] || 0) < need[k]);
  if (missing.length) {
    mcToast('Il manque : ' + missing.map(k => (need[k] - (mcInventory[k] || 0)) + ' ' + mcItemName(k)).join(', '));
    return;
  }
  cells.forEach(([i, k]) => { mcGrid[i] = { k, n: 1 }; mcInventory[k]--; });
}

// ---------- Four ----------
function mcPutFurnace(slot) {
  const f = mcFurnace, cell = f[slot];
  if (mcCursor) {
    if (slot === 'inp' && !MC_SMELT[mcCursor]) { mcToast('Ça ne peut pas être cuit.'); return; }
    if (slot === 'fuel' && !MC_FUEL[mcCursor]) { mcToast('Ça ne peut pas brûler.'); return; }
    if ((mcInventory[mcCursor] || 0) <= 0) { mcCursor = null; return; }
    if (cell && cell.k !== mcCursor) { mcGive(cell.k, cell.n); f[slot] = null; }
    if (f[slot]) f[slot].n++; else f[slot] = { k: mcCursor, n: 1 };
    mcInventory[mcCursor]--;
    if (mcInventory[mcCursor] <= 0) mcCursor = null;
  } else if (cell) {
    mcGive(cell.k, cell.n);
    f[slot] = null;
  }
}
function mcTakeFurnaceOut() {
  const f = mcFurnace;
  if (f.out) { mcGive(f.out.k, f.out.n); f.out = null; mcPlayCraft(); }
}
function mcFurnaceTick(dt) {
  const f = mcFurnace;
  const rec = f.inp && MC_SMELT[f.inp.k];
  const canOut = rec && (!f.out || (f.out.k === rec && f.out.n < 64));
  if (rec && canOut) {
    if (f.burn <= 0 && f.fuel && MC_FUEL[f.fuel.k]) {
      f.burnMax = f.burn = MC_FUEL[f.fuel.k];
      f.fuel.n--; if (f.fuel.n <= 0) f.fuel = null;
    }
    if (f.burn > 0) {
      f.burn -= dt; f.prog += dt;
      if (f.prog >= MC_SMELT_TIME) {
        f.prog = 0;
        f.inp.n--; if (f.inp.n <= 0) f.inp = null;
        if (f.out) f.out.n++; else f.out = { k: rec, n: 1 };
      }
    } else f.prog = Math.max(0, f.prog - dt * 2);
  } else {
    if (f.burn > 0) f.burn = Math.max(0, f.burn - dt);
    f.prog = 0;
  }
}

// ============================================================
// PARAMÈTRES & TOUCHES
// ============================================================
const MC_ACTIONS = [
  { id: 'forward', l: 'Avancer' },
  { id: 'back', l: 'Reculer' },
  { id: 'left', l: 'Aller à gauche' },
  { id: 'right', l: 'Aller à droite' },
  { id: 'jump', l: 'Sauter' },
  { id: 'sprint', l: 'Courir' },
  { id: 'menu', l: 'Menu / Crafts' },
  { id: 'mine', l: 'Casser (clavier)' },
  { id: 'place', l: 'Poser (clavier)' }
];

function mcDefaultKeys() {
  const fr = /^(fr|be)/i.test((typeof navigator !== 'undefined' && navigator.language) || '');
  return {
    forward: [fr ? 'z' : 'w', 'arrowup'],
    back: ['s', 'arrowdown'],
    left: [fr ? 'q' : 'a', 'arrowleft'],
    right: ['d', 'arrowright'],
    jump: [' ', ''],
    sprint: ['shift', ''],
    menu: ['e', ''],
    mine: ['x', ''],
    place: ['c', '']
  };
}

const MC_DEFAULTS = {
  sens: 27, touchSens: 100, invertY: false, fov: 75,
  renderDist: 6, resolution: 100, brightness: 100, autoQuality: true,
  smoothTextures: false, ao: true, fog: true, clouds: true, dayNight: true,
  particles: true, bobbing: true, showHand: true, showFps: false,
  volMaster: 80, volSfx: 100, volMusic: 35, stepSounds: true,
  autoJump: false, touchScale: 100, autosave: true
};
let mcSettings = Object.assign({}, MC_DEFAULTS, { keys: mcDefaultKeys() });

const MC_UI = {
  audio: [
    { k: 'volMaster', t: 'range', l: 'Volume général', min: 0, max: 100, s: 1, f: v => v + ' %' },
    { k: 'volSfx', t: 'range', l: 'Effets sonores', min: 0, max: 100, s: 1, f: v => v + ' %' },
    { k: 'volMusic', t: 'range', l: "Musique d'ambiance", min: 0, max: 100, s: 1, f: v => v + ' %' },
    { k: 'stepSounds', t: 'check', l: 'Bruits de pas' }
  ],
  graphics: [
    { k: 'renderDist', t: 'range', l: "Distance d'affichage (monde infini)", min: 2, max: 12, s: 1, f: v => v + ' chunks · ' + (v * 16) + ' blocs' },
    { k: 'autoQuality', t: 'check', l: 'Qualité automatique (baisse si ça lag)' },
    { k: 'fov', t: 'range', l: 'Champ de vision (FOV)', min: 50, max: 110, s: 1, f: v => v + '°' },
    { k: 'resolution', t: 'range', l: 'Résolution du rendu', min: 40, max: 100, s: 5, f: v => v + ' %' },
    { k: 'brightness', t: 'range', l: 'Luminosité', min: 60, max: 140, s: 5, f: v => v + ' %' },
    { k: 'smoothTextures', t: 'check', l: 'Textures lissées (au lieu de pixelisées)' },
    { k: 'ao', t: 'check', l: 'Ombres douces (occlusion ambiante)' },
    { k: 'fog', t: 'check', l: 'Brouillard' },
    { k: 'clouds', t: 'check', l: 'Nuages' },
    { k: 'dayNight', t: 'check', l: 'Cycle jour / nuit' },
    { k: 'particles', t: 'check', l: 'Particules (blocs cassés)' },
    { k: 'bobbing', t: 'check', l: 'Balancement de la caméra' },
    { k: 'showHand', t: 'check', l: 'Afficher la main' },
    { k: 'showFps', t: 'check', l: 'Afficher FPS et coordonnées' }
  ],
  options: [
    { k: 'sens', t: 'range', l: 'Sensibilité de la souris', min: 1, max: 100, s: 1, f: v => v },
    { k: 'touchSens', t: 'range', l: 'Sensibilité tactile', min: 40, max: 250, s: 5, f: v => v + ' %' },
    { k: 'invertY', t: 'check', l: 'Inverser l’axe vertical' },
    { k: 'autoJump', t: 'check', l: 'Saut automatique (marches de 1 bloc)' },
    { k: 'touchScale', t: 'range', l: 'Taille des boutons tactiles', min: 70, max: 140, s: 5, f: v => v + ' %' },
    { k: 'autosave', t: 'check', l: 'Sauvegarde automatique du monde' }
  ]
};
const MC_DEFS = {};
Object.keys(MC_UI).forEach(g => MC_UI[g].forEach(d => { MC_DEFS[d.k] = d; }));

function mcLoadSettings() {
  const base = Object.assign({}, MC_DEFAULTS, { keys: mcDefaultKeys() });
  if (mcTouchMode) { base.renderDist = 4; base.resolution = 75; base.autoJump = true; }
  try {
    const raw = localStorage.getItem(MC_SET_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      Object.keys(base).forEach(k => {
        if (k === 'keys') return;
        if (s[k] !== undefined && typeof s[k] === typeof base[k]) base[k] = s[k];
      });
      if (s.keys && typeof s.keys === 'object') {
        MC_ACTIONS.forEach(a => {
          if (Array.isArray(s.keys[a.id])) base.keys[a.id] = [String(s.keys[a.id][0] || ''), String(s.keys[a.id][1] || '')];
        });
      }
    }
  } catch (e) { /* ignore */ }
  mcSettings = base;
}
function mcSaveSettings() {
  try { localStorage.setItem(MC_SET_KEY, JSON.stringify(mcSettings)); } catch (e) { /* ignore */ }
}
const mcMouseSens = () => 0.0005 + (mcSettings.sens / 100) * 0.0055;
const mcDown = (action) => mcSettings.keys[action].some(k => k && mcKeys[k]);

function mcKeyLabel(k) {
  if (!k) return '—';
  const m = { ' ': 'Espace', shift: 'Maj', control: 'Ctrl', alt: 'Alt', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', tab: 'Tab', enter: 'Entrée', escape: 'Échap' };
  return m[k] || (k.length === 1 ? k.toUpperCase() : k);
}

// ============================================================
// MONDE : bruit, génération, sauvegarde
// ============================================================
function mcHash(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function mcNoise2(x, z, s) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = x - x0, fz = z - z0;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = mcHash(x0, 0, z0, s), b = mcHash(x0 + 1, 0, z0, s);
  const c = mcHash(x0, 0, z0 + 1, s), d = mcHash(x0 + 1, 0, z0 + 1, s);
  const top = a + (b - a) * u, bot = c + (d - c) * u;
  return top + (bot - top) * v;
}
function mcNoise3(x, y, z, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c000 = mcHash(x0, y0, z0, s), c100 = mcHash(x0 + 1, y0, z0, s);
  const c010 = mcHash(x0, y0 + 1, z0, s), c110 = mcHash(x0 + 1, y0 + 1, z0, s);
  const c001 = mcHash(x0, y0, z0 + 1, s), c101 = mcHash(x0 + 1, y0, z0 + 1, s);
  const c011 = mcHash(x0, y0 + 1, z0 + 1, s), c111 = mcHash(x0 + 1, y0 + 1, z0 + 1, s);
  return l(l(l(c000, c100, u), l(c010, c110, u), v), l(l(c001, c101, u), l(c011, c111, u), v), w);
}
function mcFbm2(x, z, s) {
  return mcNoise2(x, z, s) * 0.55 + mcNoise2(x * 2.1, z * 2.1, s + 11) * 0.3 + mcNoise2(x * 4.3, z * 4.3, s + 23) * 0.15;
}

// Hauteur du terrain et type de surface d'une colonne (résultat dans mcColH / mcColSand)
let mcColH = 0, mcColSand = false;
function mcColumn(wx, wz) {
  const s = mcSeed & 0xffff;
  const c = mcFbm2(wx * 0.0065, wz * 0.0065, s);        // grandes formes : montagnes / plaines
  const d = mcFbm2(wx * 0.035, wz * 0.035, s + 5);      // relief local
  const h = Math.floor(13 + (c - 0.5) * 42 + (d - 0.5) * 9);
  mcColH = Math.max(4, Math.min(MC_WORLD_H - 12, h));
  mcColSand = mcColH <= 8 || mcNoise2(wx * 0.05 + 100, wz * 0.05 + 100, s + 7) > 0.68;
}

// Génère un chunk (16x16 colonnes) de façon déterministe à partir de la graine
function mcGenChunk(cx, cz) {
  const key = mcCK(cx, cz);
  let ch = mcChunkMap.get(key);
  if (!ch) {
    ch = { cx, cz, data: null, top: null, solid: null, glass: null, meshed: false, dirty: false };
    mcChunkMap.set(key, ch);
  }
  const data = new Uint8Array(MC_VOL);
  const top = new Int16Array(MC_COL);
  const s = mcSeed & 0xffff;
  const x0 = cx * 16, z0 = cz * 16;

  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      mcColumn(wx, wz);
      const h = mcColH, sandy = mcColSand;
      for (let y = 0; y <= h; y++) {
        let t;
        if (y === 0) t = 14;
        else if (y === h) t = sandy ? 12 : 1;
        else if (y >= h - 3) t = sandy ? 12 : 2;
        else {
          t = 3;
          if (y >= 2 && mcNoise3(wx * 0.09, y * 0.13, wz * 0.09, s + 3) > 0.71) t = 0;   // grottes
        }
        if (t) data[(y << 8) | (lz << 4) | lx] = t;
      }
    }
  }

  // Minerais (filons) : graine propre à chaque chunk
  const rng = mcMulberry((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(mcSeed, 83492791)) >>> 0);
  const vein = (type, count, minS, maxS, maxY) => {
    for (let i = 0; i < count; i++) {
      let x = Math.floor(rng() * 16), z = Math.floor(rng() * 16), y = 1 + Math.floor(rng() * maxY);
      const size = minS + Math.floor(rng() * (maxS - minS + 1));
      for (let k = 0; k < size; k++) {
        if (x >= 0 && x < 16 && z >= 0 && z < 16 && y >= 1 && y < MC_WORLD_H) {
          const i2 = (y << 8) | (z << 4) | x;
          if (data[i2] === 3) data[i2] = type;
        }
        x += Math.floor(rng() * 3) - 1;
        y += Math.floor(rng() * 3) - 1;
        z += Math.floor(rng() * 3) - 1;
      }
    }
  };
  vein(6, 5, 3, 7, 16);
  vein(7, 3, 2, 5, 12);
  if (rng() < 0.9) vein(8, 1, 1, 3, 6);
  if (rng() < 0.5) vein(9, 1, 1, 2, 3);

  // Arbres : un arbre possible par case de 6x6, position fixée par la graine
  const CELL = 6;
  for (let gz = Math.floor((z0 - 2) / CELL); gz <= Math.floor((z0 + 17) / CELL); gz++) {
    for (let gx = Math.floor((x0 - 2) / CELL); gx <= Math.floor((x0 + 17) / CELL); gx++) {
      if (mcHash(gx, 0, gz, s + 500) > 0.45) continue;
      const tx = gx * CELL + Math.floor(mcHash(gx, 1, gz, s + 501) * CELL);
      const tz = gz * CELL + Math.floor(mcHash(gx, 2, gz, s + 502) * CELL);
      if (Math.abs(tx) < 4 && Math.abs(tz) < 4) continue;                    // zone de départ dégagée
      if (tx < x0 - 2 || tx > x0 + 17 || tz < z0 - 2 || tz > z0 + 17) continue;
      mcColumn(tx, tz);
      if (mcColSand || mcColH < 9) continue;
      const base = mcColH;
      const th = 4 + Math.floor(mcHash(gx, 3, gz, s + 503) * 2.99);
      if (base + th + 3 >= MC_WORLD_H) continue;
      for (let ly = base + th - 2; ly <= base + th + 1; ly++) {
        const dy = ly - (base + th);
        const rad = dy <= -1 ? 2 : 1;
        for (let lx = -rad; lx <= rad; lx++) {
          for (let lz = -rad; lz <= rad; lz++) {
            if (rad === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2 && mcHash(tx + lx, ly, tz + lz, s + 777) > 0.35) continue;
            if (dy === 1 && Math.abs(lx) + Math.abs(lz) > 1) continue;
            const wx = tx + lx, wz = tz + lz;
            if (wx < x0 || wx >= x0 + 16 || wz < z0 || wz >= z0 + 16) continue;
            const i2 = (ly << 8) | ((wz - z0) << 4) | (wx - x0);
            if (data[i2] === 0) data[i2] = 5;
          }
        }
      }
      if (tx >= x0 && tx < x0 + 16 && tz >= z0 && tz < z0 + 16) {
        for (let h = 1; h <= th; h++) data[((base + h) << 8) | ((tz - z0) << 4) | (tx - x0)] = 4;
      }
    }
  }

  // Modifications du joueur
  const ed = mcEdits.get(key);
  if (ed) ed.forEach((t, li) => { data[li] = t; });

  for (let i = 0; i < MC_COL; i++) {
    let y = MC_WORLD_H - 1;
    while (y > 0 && data[(y << 8) | i] === 0) y--;
    top[i] = y;
  }
  ch.data = data; ch.top = top; ch.meshed = false; ch.dirty = false;
  return ch;
}

function mcUnloadChunk(ch) {
  if (ch.solid) { mcScene.remove(ch.solid); ch.solid.geometry.dispose(); ch.solid = null; }
  if (ch.glass) { mcScene.remove(ch.glass); ch.glass.geometry.dispose(); ch.glass = null; }
  mcChunkMap.delete(mcCK(ch.cx, ch.cz));
  mcLastCh = null;
}

function mcSpawnPos() {
  const top = mcTopAt(0, 0);
  return { x: 0, y: top + 0.5 + PLAYER_HEIGHT + 0.05, z: 0 };
}

// ---------- Chargement progressif autour du joueur ----------
function mcNeighborsReady(cx, cz) {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const c = mcChunkMap.get(mcCK(cx + dx, cz + dz));
      if (!c || !c.data) return false;
    }
  }
  return true;
}

// Prépare les listes : chunks à générer (rayon R+1) et à mailler (rayon R), les plus proches d'abord
function mcPlanStreaming(pcx, pcz) {
  const R = mcSettings.renderDist, G = R + 2;   // +2 : tous les voisins d'un chunk à mailler sont générés
  mcGenQueue = []; mcMeshQueue = [];
  for (let dz = -G; dz <= G; dz++) {
    for (let dx = -G; dx <= G; dx++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > (G + 0.2) * (G + 0.2)) continue;
      const cx = pcx + dx, cz = pcz + dz;
      const ch = mcChunkMap.get(mcCK(cx, cz));
      if (!ch || !ch.data) mcGenQueue.push({ cx, cz, d2 });
      if (d2 <= (R + 0.5) * (R + 0.5) && (!ch || !ch.meshed || ch.dirty)) mcMeshQueue.push({ cx, cz, d2 });
    }
  }
  const cmp = (a, b) => a.d2 - b.d2;
  mcGenQueue.sort(cmp); mcMeshQueue.sort(cmp);
  const U = R + 3;
  mcChunkMap.forEach(ch => {
    const dd = Math.hypot(ch.cx - pcx, ch.cz - pcz);
    if (dd > U) mcUnloadChunk(ch);
    else {
      const vis = dd <= R + 0.5;
      if (ch.solid) ch.solid.visible = vis;
      if (ch.glass) ch.glass.visible = vis;
    }
  });
}

// Travaille un peu (budget en ms) : maille un chunk prêt, sinon génère le plus proche manquant
function mcStreamStep(budget) {
  const t0 = performance.now();
  let ops = 0;
  while (ops < 80) {
    if (ops > 0 && performance.now() - t0 >= budget) break;
    let did = false;
    const lim = Math.min(24, mcMeshQueue.length);
    for (let i = 0; i < lim; i++) {
      const m = mcMeshQueue[i];
      const ch = mcChunkMap.get(mcCK(m.cx, m.cz));
      if (!ch || !ch.data) continue;
      if (ch.meshed && !ch.dirty) { mcMeshQueue.splice(i, 1); did = true; break; }
      if (mcNeighborsReady(m.cx, m.cz)) { mcMeshChunk(ch); mcMeshQueue.splice(i, 1); did = true; break; }
    }
    if (!did && mcGenQueue.length) {
      const g = mcGenQueue.shift();
      const ex = mcChunkMap.get(mcCK(g.cx, g.cz));
      if (!ex || !ex.data) mcGenChunk(g.cx, g.cz);
      did = true;
    }
    if (!did) break;
    ops++;
  }
}

function mcMarkAllDirty() {
  mcChunkMap.forEach(ch => { if (ch.meshed) ch.dirty = true; });
  mcCenterCx = 1e9;   // force un nouveau plan
}

// ---------- Sauvegarde ----------
function mcSaveGame(force) {
  if (!mcReady) return;
  if (!force && !mcSettings.autosave) return;
  try {
    const ed = [];
    mcEdits.forEach((m, k) => {
      const kx = Math.floor(k / 65536);
      const flat = [];
      m.forEach((t, li) => { flat.push(li, t); });
      ed.push([kx - 32768, k - kx * 65536 - 32768, flat]);
    });
    localStorage.setItem(MC_SAVE_KEY, JSON.stringify({
      v: 3, seed: mcSeed, edits: ed, inv: mcInventory, hot: mcHotbar, furn: mcFurnace,
      pos: [mcPlayer.pos.x, mcPlayer.pos.y, mcPlayer.pos.z],
      yaw: mcPlayer.yaw, pitch: mcPlayer.pitch, time: mcTime, slot: mcSelectedIndex
    }));
  } catch (e) { /* ignore */ }
}
function mcLoadGame() {
  try {
    const raw = localStorage.getItem(MC_SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.v === 3 ? d : null;
  } catch (e) { return null; }
}

// ============================================================
// MAILLAGE PAR CHUNKS (faces cachées supprimées, ombrage + AO)
// ============================================================
const MC_FACES = [
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], shade: 1.0, t: 0 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.5, t: 2 },
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], shade: 0.7, t: 1 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.7, t: 1 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.85, t: 1 },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], shade: 0.85, t: 1 }
];
const MC_CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const MC_AO = [0.55, 0.72, 0.86, 1.0];
const MC_AOA = new Int8Array(4);

// Tampons de maillage réutilisés (aucune allocation à chaque chunk)
function mcMakeBuf(cap) {
  return { cap, f: 0, pos: new Float32Array(cap * 12), uv: new Float32Array(cap * 8), col: new Float32Array(cap * 12), idx: new Uint32Array(cap * 6) };
}
function mcGrowBuf(B) {
  const cap = B.cap * 2;
  const np = new Float32Array(cap * 12); np.set(B.pos); B.pos = np;
  const nu = new Float32Array(cap * 8); nu.set(B.uv); B.uv = nu;
  const nc = new Float32Array(cap * 12); nc.set(B.col); B.col = nc;
  const ni = new Uint32Array(cap * 6); ni.set(B.idx); B.idx = ni;
  B.cap = cap;
}

// Types de blocs : transparent (feuilles, verre) ou opaque, pour cacher les faces et calculer l'ombre
const MC_TRANSP = new Uint8Array(256);
const MC_OPAQ = new Uint8Array(256);
Object.keys(BLOCK_TYPES).forEach(id => { if (BLOCK_TYPES[id].transparent) MC_TRANSP[id] = 1; else MC_OPAQ[id] = 1; });
MC_OPAQ[254] = 1; MC_OPAQ[255] = 1;

let mcMatSolid = null, mcMatGlass = null, mcMatHand = null;

function mcPushFace(B, x, y, z, f, tile, ao, light) {
  if (B.f >= B.cap) mcGrowBuf(B);
  const fi = B.f, p = fi * 12, u = fi * 8, vi = fi * 4, ii = fi * 6;
  const tx = tile % MC_COLS, ty = (tile / MC_COLS) | 0;
  const e = 0.002;
  const u0 = tx / MC_COLS + e, u1 = (tx + 1) / MC_COLS - e;
  const vT = 1 - ty / MC_ROWS - e, vB = 1 - (ty + 1) / MC_ROWS + e;
  const n = f.n, fu = f.u, fv = f.v;
  for (let i = 0; i < 4; i++) {
    const su = MC_CORNERS[i][0], sv = MC_CORNERS[i][1];
    const q = p + i * 3;
    B.pos[q] = x + 0.5 * n[0] + 0.5 * su * fu[0] + 0.5 * sv * fv[0];
    B.pos[q + 1] = y + 0.5 * n[1] + 0.5 * su * fu[1] + 0.5 * sv * fv[1];
    B.pos[q + 2] = z + 0.5 * n[2] + 0.5 * su * fu[2] + 0.5 * sv * fv[2];
    B.uv[u + i * 2] = su > 0 ? u1 : u0;
    B.uv[u + i * 2 + 1] = sv > 0 ? vT : vB;
    const c = f.shade * light * MC_AO[ao ? MC_AOA[i] : 3];
    B.col[q] = c; B.col[q + 1] = c; B.col[q + 2] = c;
  }
  if (ao && MC_AOA[0] + MC_AOA[2] > MC_AOA[1] + MC_AOA[3]) {
    B.idx[ii] = vi + 1; B.idx[ii + 1] = vi + 2; B.idx[ii + 2] = vi + 3;
    B.idx[ii + 3] = vi + 1; B.idx[ii + 4] = vi + 3; B.idx[ii + 5] = vi;
  } else {
    B.idx[ii] = vi; B.idx[ii + 1] = vi + 1; B.idx[ii + 2] = vi + 2;
    B.idx[ii + 3] = vi; B.idx[ii + 4] = vi + 2; B.idx[ii + 5] = vi + 3;
  }
  B.f++;
}

// Copie le chunk + une bordure de 1 bloc des voisins dans un tampon 18x48x18 (lecture ultra rapide)
const PW = 18;
const mcPad = new Uint8Array(PW * MC_WORLD_H * PW);
const mcPadTop = new Int16Array(PW * PW);
function mcFillPad(cx, cz) {
  for (let dcz = -1; dcz <= 1; dcz++) {
    for (let dcx = -1; dcx <= 1; dcx++) {
      const ch = mcChunkMap.get(mcCK(cx + dcx, cz + dcz));
      const d = ch && ch.data, tp = ch && ch.top;
      const px0 = dcx < 0 ? 0 : (dcx === 0 ? 1 : 17), px1 = dcx < 0 ? 0 : (dcx === 0 ? 16 : 17);
      const pz0 = dcz < 0 ? 0 : (dcz === 0 ? 1 : 17), pz1 = dcz < 0 ? 0 : (dcz === 0 ? 16 : 17);
      for (let pz = pz0; pz <= pz1; pz++) {
        const lz = pz - 1 - dcz * 16;
        for (let px = px0; px <= px1; px++) {
          const lx = px - 1 - dcx * 16;
          const col = (lz << 4) | lx;
          mcPadTop[pz * PW + px] = tp ? tp[col] : 0;
          for (let y = 0; y < MC_WORLD_H; y++) mcPad[(y * PW + pz) * PW + px] = d ? d[(y << 8) | col] : MC_UNLOADED;
        }
      }
    }
  }
}
function mcOccP(px, y, pz) {
  if (y < 0) return 1;
  if (y >= MC_WORLD_H) return 0;
  return MC_OPAQ[mcPad[(y * PW + pz) * PW + px]];
}
function mcFaceAO(px, y, pz, f) {
  const nx = px + f.n[0], ny = y + f.n[1], nz = pz + f.n[2];
  for (let i = 0; i < 4; i++) {
    const su = MC_CORNERS[i][0], sv = MC_CORNERS[i][1];
    const s1 = mcOccP(nx + su * f.u[0], ny + su * f.u[1], nz + su * f.u[2]);
    const s2 = mcOccP(nx + sv * f.v[0], ny + sv * f.v[1], nz + sv * f.v[2]);
    const c = mcOccP(nx + su * f.u[0] + sv * f.v[0], ny + su * f.u[1] + sv * f.v[1], nz + su * f.u[2] + sv * f.v[2]);
    MC_AOA[i] = (s1 && s2) ? 0 : 3 - (s1 + s2 + c);
  }
}

const MC_BS = mcMakeBuf(6000), MC_BG = mcMakeBuf(1500);

function mcApplyGeo(ch, key, B, mat, order) {
  if (ch[key]) {
    mcScene.remove(ch[key]);
    ch[key].geometry.dispose();
    ch[key] = null;
  }
  if (!B.f) return;
  const nv = B.f * 4;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(B.pos.slice(0, B.f * 12), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(B.uv.slice(0, B.f * 8), 2));
  g.setAttribute('color', new THREE.BufferAttribute(B.col.slice(0, B.f * 12), 3));
  const idx = nv > 65535 ? new Uint32Array(B.f * 6) : new Uint16Array(B.f * 6);
  for (let i = 0; i < idx.length; i++) idx[i] = B.idx[i];
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.position.set(ch.cx * 16, 0, ch.cz * 16);
  m.matrixAutoUpdate = false;
  m.updateMatrix();
  m.renderOrder = order;
  mcScene.add(m);
  ch[key] = m;
}

// Construit le maillage d'un chunk (suppose que ses 8 voisins sont chargés)
function mcMeshChunk(ch) {
  mcFillPad(ch.cx, ch.cz);
  const S = MC_BS, G = MC_BG;
  S.f = 0; G.f = 0;
  const useAO = !!mcSettings.ao;
  const top = ch.top;
  for (let lz = 0; lz < 16; lz++) {
    const pz = lz + 1;
    for (let lx = 0; lx < 16; lx++) {
      const px = lx + 1;
      const colTop = top[(lz << 4) | lx];
      for (let y = 0; y <= colTop; y++) {
        const base = (y * PW + pz) * PW + px;
        const id = mcPad[base];
        if (!id) continue;
        const def = BLOCK_TYPES[id];
        const B = def.glass ? G : S;
        const ao = useAO && !def.transparent;
        for (let fi = 0; fi < 6; fi++) {
          const f = MC_FACES[fi];
          let nb;
          if (f.n[1] !== 0) {
            const ny = y + f.n[1];
            if (ny < 0) continue;
            nb = ny >= MC_WORLD_H ? 0 : mcPad[base + f.n[1] * PW * PW];
          } else nb = mcPad[base + f.n[0] + f.n[2] * PW];
          if (nb !== 0 && (nb >= 200 || !MC_TRANSP[nb] || nb === id)) continue;
          if (ao) mcFaceAO(px, y, pz, f);
          let light = 1;
          if (useAO) {
            const t = mcPadTop[(pz + f.n[2]) * PW + px + f.n[0]];
            const ny = y + f.n[1];
            if (ny <= t) light = Math.max(0.3, 1 - (t - ny + 1) * 0.07);
          }
          mcPushFace(B, lx, y, lz, f, def.tiles[f.t], ao, light);
        }
      }
    }
  }
  mcApplyGeo(ch, 'solid', S, mcMatSolid, 0);
  mcApplyGeo(ch, 'glass', G, mcMatGlass, 1);
  ch.meshed = true;
  ch.dirty = false;
}

// Casse / pose un bloc : met à jour les données, la hauteur, la sauvegarde et re-maille les chunks touchés
function mcSetBlock(x, y, z, t) {
  if (y < 0 || y >= MC_WORLD_H) return false;
  const cx = x >> 4, cz = z >> 4;
  const ch = mcChunkMap.get(mcCK(cx, cz));
  if (!ch || !ch.data) return false;
  const lx = x & 15, lz = z & 15, col = (lz << 4) | lx, li = (y << 8) | col;
  ch.data[li] = t;
  if (t !== 0) { if (y > ch.top[col]) ch.top[col] = y; }
  else if (y === ch.top[col]) {
    let yy = y - 1;
    while (yy > 0 && ch.data[(yy << 8) | col] === 0) yy--;
    ch.top[col] = yy;
  }
  const key = mcCK(cx, cz);
  let ed = mcEdits.get(key);
  if (!ed) { ed = new Map(); mcEdits.set(key, ed); }
  ed.set(li, t);

  const done = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = (x + dx) >> 4, nz = (z + dz) >> 4;
      const k2 = mcCK(nx, nz);
      if (done.indexOf(k2) >= 0) continue;
      done.push(k2);
      const c2 = mcChunkMap.get(k2);
      if (!c2 || !c2.data || !c2.meshed) continue;
      if (mcNeighborsReady(nx, nz)) mcMeshChunk(c2); else c2.dirty = true;
    }
  }
  return true;
}

// Géométrie d'un seul bloc (pour la main)
function mcBlockGeometry(id) {
  const def = BLOCK_TYPES[id];
  const B = mcMakeBuf(6);
  for (let fi = 0; fi < 6; fi++) mcPushFace(B, 0, 0, 0, MC_FACES[fi], def.tiles[MC_FACES[fi].t], false, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(B.pos.slice(0, 72), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(B.uv.slice(0, 48), 2));
  g.setAttribute('color', new THREE.BufferAttribute(B.col.slice(0, 72), 3));
  const idx = new Uint16Array(36);
  for (let i = 0; i < 36; i++) idx[i] = B.idx[i];
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ============================================================
// RAYON (DDA voxel) & COLLISIONS
// ============================================================
function mcRaycast(ox, oy, oz, dx, dy, dz, maxDist) {
  const x = ox + 0.5, y = oy + 0.5, z = oz + 0.5;
  let ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx > 0 ? (ix + 1 - x) / dx : (dx < 0 ? (x - ix) / -dx : Infinity);
  let tmy = dy > 0 ? (iy + 1 - y) / dy : (dy < 0 ? (y - iy) / -dy : Infinity);
  let tmz = dz > 0 ? (iz + 1 - z) / dz : (dz < 0 ? (z - iz) / -dz : Infinity);
  let t = 0, nx = 0, ny = 0, nz = 0;
  while (t <= maxDist) {
    const b = mcGet(ix, iy, iz);
    if (b > 0 && b < 200 && (nx || ny || nz)) return { x: ix, y: iy, z: iz, type: b, nx, ny, nz, dist: t };
    if (tmx < tmy && tmx < tmz) { ix += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz) { iy += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
    else { iz += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}
function mcCastFromCamera() {
  const p = mcPlayer, cp = Math.cos(p.pitch);
  return mcRaycast(p.pos.x, p.pos.y, p.pos.z, -Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp, MC_REACH);
}

function mcSolidAt(x, y, z) {
  return mcGet(x, y, z) !== 0;   // inclut les chunks pas encore chargés (solides) et le dessous du monde
}
// Le joueur (boîte AABB) touche-t-il un bloc à cette position (position des yeux) ?
function mcBoxHits(px, py, pz) {
  const r = PLAYER_RADIUS, e = 1e-6;
  const x0 = mcBi(px - r), x1 = mcBi(px + r - e);
  const y0 = mcBi(py - PLAYER_HEIGHT), y1 = mcBi(py + PLAYER_HEAD - e);
  const z0 = mcBi(pz - r), z1 = mcBi(pz + r - e);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        if (mcSolidAt(x, y, z)) return true;
      }
    }
  }
  return false;
}

const MC_GRAVITY = 28, MC_JUMP = 8.6, MC_WALK = 4.5, MC_RUN = 7.0;

function mcPhysics(dt, ax, az, sprint, jump) {
  const p = mcPlayer;
  const pos = p.pos;
  const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
  let mx = 0, mz = 0, mag = 0;
  const len = Math.hypot(ax, az);
  if (len > 0) {
    mag = Math.min(1, len);
    const nx = ax / len, nz = az / len;
    mx = (nx * cos + nz * sin) * mag;
    mz = (-nx * sin + nz * cos) * mag;
  }
  const speed = sprint ? MC_RUN : MC_WALK;

  if (jump && p.onGround) {
    p.velocity.y = MC_JUMP;
    p.onGround = false;
    mcPlayTone(220, 0.1, 'sine', 0.08, 330);
  }
  p.velocity.y = Math.max(-50, p.velocity.y - MC_GRAVITY * dt);

  const dx = mx * speed * dt, dz = mz * speed * dt, dy = p.velocity.y * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.2));
  const sx = dx / steps, sy = dy / steps, sz = dz / steps;
  let blocked = false;
  const wasVy = p.velocity.y;

  for (let i = 0; i < steps; i++) {
    if (sx) { pos.x += sx; if (mcBoxHits(pos.x, pos.y, pos.z)) { pos.x -= sx; blocked = true; } }
    if (sz) { pos.z += sz; if (mcBoxHits(pos.x, pos.y, pos.z)) { pos.z -= sz; blocked = true; } }
    if (sy) {
      pos.y += sy;
      if (mcBoxHits(pos.x, pos.y, pos.z)) {
        if (sy < 0) {
          const r = mcBi(pos.y - PLAYER_HEIGHT);
          pos.y = r + 0.5 + PLAYER_HEIGHT + 1e-4;
        } else {
          const r = mcBi(pos.y + PLAYER_HEAD - 1e-6);
          pos.y = r - 0.5 - PLAYER_HEAD - 1e-4;
        }
        p.velocity.y = 0;
        break;
      }
    }
  }

  const grounded = p.velocity.y <= 0 && mcBoxHits(pos.x, pos.y - 0.03, pos.z);
  if (grounded && !p.onGround && wasVy < -9) {
    mcPlayBlockSound(mcGroundSound(), 'break', 0.6);
  }
  p.onGround = grounded;

  // Saut automatique contre une marche d'un bloc
  if (blocked && p.onGround && mcSettings.autoJump && mag > 0.3) {
    if (!mcBoxHits(pos.x + mx * 0.4, pos.y + 1.05, pos.z + mz * 0.4)) {
      p.velocity.y = MC_JUMP;
      p.onGround = false;
    }
  }
  return { moving: mag > 0, speed: Math.hypot(mx, mz) * speed };
}

function mcGroundSound() {
  const b = mcGet(mcBi(mcPlayer.pos.x), mcBi(mcPlayer.pos.y - PLAYER_HEIGHT - 0.1), mcBi(mcPlayer.pos.z));
  return (BLOCK_TYPES[b] && BLOCK_TYPES[b].sound) || 'stone';
}

// ============================================================
// AUDIO (synthétisé, aucun fichier)
// ============================================================
const mcAudio = { ctx: null, master: null, sfx: null, music: null, noise: null, musicTimer: null };

function mcAudioEnsure() {
  if (mcAudio.ctx) {
    if (mcAudio.ctx.state === 'suspended') { try { mcAudio.ctx.resume(); } catch (e) { /* ignore */ } }
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    mcAudio.ctx = ctx;
    mcAudio.master = ctx.createGain();
    mcAudio.sfx = ctx.createGain();
    mcAudio.music = ctx.createGain();
    mcAudio.sfx.connect(mcAudio.master);
    mcAudio.music.connect(mcAudio.master);
    mcAudio.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    mcAudio.noise = buf;
    mcAudioVolumes();
    mcStartMusic();
    return true;
  } catch (e) { mcAudio.ctx = null; return false; }
}
function mcAudioVolumes() {
  if (!mcAudio.ctx) return;
  mcAudio.master.gain.value = mcSettings.volMaster / 100;
  mcAudio.sfx.gain.value = mcSettings.volSfx / 100;
  mcAudio.music.gain.value = mcSettings.volMusic / 100;
}

function mcNoiseBurst(o) {
  const a = mcAudio;
  if (!a.ctx || a.ctx.state !== 'running') return;
  const dur = o.dur || 0.12, gain = o.gain || 0.3;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = a.ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 800, t);
  f.Q.value = o.q || 1;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(a.sfx);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}
function mcPlayTone(freq, dur, type, gain, toFreq, dest, attack) {
  const a = mcAudio;
  if (!a.ctx || a.ctx.state !== 'running') return;
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), t + dur);
  const g = a.ctx.createGain();
  const at = attack || 0.006;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.2), t + at);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest === 'music' ? a.music : a.sfx);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function mcPlayBlockSound(kind, action, vol) {
  const v = vol === undefined ? 1 : vol;
  const step = action === 'step', brk = action === 'break', hit = action === 'hit';
  const g = (step ? 0.10 : hit ? 0.2 : 0.4) * v;
  const d = brk ? 0.22 : action === 'place' ? 0.14 : hit ? 0.08 : 0.07;
  switch (kind) {
    case 'stone':
      mcNoiseBurst({ freq: brk ? 500 : 1100, q: 1.2, dur: d, gain: g });
      if (!step) mcPlayTone(brk ? 110 : 160, d, 'triangle', g * 0.6, brk ? 60 : 110);
      break;
    case 'grass':
      mcNoiseBurst({ freq: 380, q: 0.7, dur: d, gain: g, type: 'lowpass' });
      break;
    case 'wood':
      mcPlayTone(brk ? 130 : 190, d, 'triangle', g * 0.8, brk ? 80 : 130);
      mcNoiseBurst({ freq: 700, q: 1, dur: d * 0.7, gain: g * 0.5 });
      break;
    case 'leaves':
      mcNoiseBurst({ freq: 3000, q: 0.5, dur: d * 1.2, gain: g * 0.6, type: 'highpass' });
      break;
    case 'sand':
      mcNoiseBurst({ freq: 1500, q: 0.6, dur: d * 1.3, gain: g * 0.8 });
      break;
    case 'glass':
      mcPlayTone(2400 + Math.random() * 600, d * 2, 'sine', g * 0.5);
      mcPlayTone(3700 + Math.random() * 500, d * 1.6, 'sine', g * 0.3);
      if (brk) mcNoiseBurst({ freq: 4500, q: 0.6, dur: d, gain: g * 0.5, type: 'highpass' });
      break;
    default:
      mcNoiseBurst({ freq: 800, dur: d, gain: g });
  }
}
function mcPlayCraft() {
  mcPlayTone(660, 0.12, 'sine', 0.25);
  setTimeout(() => mcPlayTone(880, 0.18, 'sine', 0.25), 90);
}
function mcPlayClick() { mcPlayTone(520, 0.05, 'square', 0.05); }

const MC_SCALE = [0, 2, 4, 7, 9];
function mcMusicStep() {
  if (!mcAudio.ctx || mcSettings.volMusic <= 0) return;
  const notes = Math.random() > 0.5 ? 2 : 1;
  for (let k = 0; k < notes; k++) {
    const deg = MC_SCALE[Math.floor(Math.random() * MC_SCALE.length)] + (Math.random() > 0.6 ? 12 : 0);
    const f = 220 * Math.pow(2, deg / 12);
    setTimeout(() => {
      mcPlayTone(f, 4.2, 'sine', 0.16, 0, 'music', 1.2);
      mcPlayTone(f * 2, 3.4, 'triangle', 0.04, 0, 'music', 1.4);
    }, k * 1400);
  }
}
function mcStartMusic() {
  if (mcAudio.musicTimer) return;
  mcAudio.musicTimer = setInterval(mcMusicStep, 5200);
  mcMusicStep();
}
function mcStopMusic() {
  if (mcAudio.musicTimer) { clearInterval(mcAudio.musicTimer); mcAudio.musicTimer = null; }
}

// ============================================================
// PARTICULES, CIEL, MAIN
// ============================================================
const mcParticles = [];
let mcSun = null, mcMoon = null, mcStars = null, mcCloudMesh = null, mcCloudTex = null;
let mcDaylight = 1;

function mcInitParticles() {
  mcParticles.length = 0;
  const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false;
    mcScene.add(m);
    mcParticles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
  }
}
function mcSpawnParticles(x, y, z, tile) {
  if (!mcSettings.particles) return;
  const c = mcTileAvg[tile] || [0.5, 0.5, 0.5];
  let n = 0;
  for (const p of mcParticles) {
    if (p.life > 0) continue;
    p.life = 0.5 + Math.random() * 0.4;
    p.mesh.visible = true;
    p.mesh.position.set(x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 0.8);
    const k = 0.75 + Math.random() * 0.4;
    p.mesh.material.color.setRGB(c[0] * k * mcDaylight, c[1] * k * mcDaylight, c[2] * k * mcDaylight);
    p.mesh.scale.set(1, 1, 1);
    p.vx = (Math.random() - 0.5) * 3; p.vy = 1 + Math.random() * 3; p.vz = (Math.random() - 0.5) * 3;
    if (++n >= 10) break;
  }
}
function mcUpdateParticles(dt) {
  for (const p of mcParticles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.vy -= 18 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    const s = Math.min(1, p.life * 2.5);
    p.mesh.scale.set(s, s, s);
  }
}

const mcSmooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function mcCreateSky() {
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false, depthWrite: false });
  mcSun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), sunMat);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false, depthWrite: false });
  mcMoon = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), moonMat);
  mcScene.add(mcSun); mcScene.add(mcMoon);

  const rng = mcMulberry(99);
  const pos = [];
  for (let i = 0; i < 320; i++) {
    const a = rng() * Math.PI * 2, b = Math.acos(2 * rng() - 1);
    pos.push(Math.sin(b) * Math.cos(a) * 450, Math.cos(b) * 450, Math.sin(b) * Math.sin(a) * 450);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  mcStars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
  mcStars.frustumCulled = false;
  mcScene.add(mcStars);

  // Nuages : un plan texturé qui suit le joueur
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  const cn = (gx, gy) => mcHash(((gx % 8) + 8) % 8, 0, ((gy % 8) + 8) % 8, 4242);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const fx = x / 4, fy = y / 4, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = cn(x0, y0), b = cn(x0 + 1, y0), cc = cn(x0, y0 + 1), d = cn(x0 + 1, y0 + 1);
      const top = a + (b - a) * sx, bot = cc + (d - cc) * sx;
      const val = top + (bot - top) * sy;
      if (val > 0.58) { ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(x, y, 1, 1); }
    }
  }
  mcCloudTex = new THREE.CanvasTexture(c);
  mcCloudTex.wrapS = THREE.RepeatWrapping;
  mcCloudTex.wrapT = THREE.RepeatWrapping;
  mcCloudTex.magFilter = THREE.NearestFilter;
  mcCloudTex.minFilter = THREE.NearestFilter;
  mcCloudTex.repeat.set(2, 2);
  mcCloudMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(768, 768),
    new THREE.MeshBasicMaterial({ map: mcCloudTex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })
  );
  mcCloudMesh.rotation.x = -Math.PI / 2;
  mcCloudMesh.position.y = MC_WORLD_H + 14;
  mcCloudMesh.frustumCulled = false;
  mcScene.add(mcCloudMesh);
}

function mcUpdateSky(dt) {
  if (mcSettings.dayNight && !mcIsPaused) mcTime = (mcTime + dt / MC_DAY_SECONDS) % 1;
  const a = mcTime * Math.PI * 2;
  const sunY = Math.sin(a);
  const d = mcSmooth(-0.12, 0.28, sunY);
  let r = 0.02 + 0.45 * d, g = 0.03 + 0.62 * d, b = 0.08 + 0.92 * d;
  const k = Math.max(0, 1 - Math.abs(sunY) / 0.28) * 0.5;
  r += (1.0 - r) * k; g += (0.55 - g) * k; b += (0.33 - b) * k;
  mcScene.background.setRGB(r, g, b);
  if (mcScene.fog) mcScene.fog.color.setRGB(r, g, b);

  mcDaylight = 0.32 + 0.68 * d;
  const br = mcDaylight * mcSettings.brightness / 100;
  mcMatSolid.color.setRGB(br, br, br);
  mcMatGlass.color.setRGB(br, br, br);
  const hb = Math.max(0.55, br);
  mcMatHand.color.setRGB(hb, hb, hb);
  mcCloudMesh.material.color.setRGB(mcDaylight, mcDaylight, Math.min(1, mcDaylight * 1.05));

  const cp = mcCamera.position;
  mcSun.position.set(cp.x + Math.cos(a) * 300, cp.y + Math.sin(a) * 300, cp.z + 80);
  mcSun.lookAt(cp);
  mcSun.visible = sunY > -0.05;
  mcMoon.position.set(cp.x - Math.cos(a) * 300, cp.y - Math.sin(a) * 300, cp.z - 80);
  mcMoon.lookAt(cp);
  mcMoon.visible = sunY < 0.05;
  mcStars.position.copy(cp);
  const so = Math.max(0, 0.95 - d * 1.7);
  mcStars.material.opacity = so;
  mcStars.visible = so > 0.02;

  mcCloudMesh.visible = !!mcSettings.clouds;
  if (mcSettings.clouds) {
    const W = 768, rep = 2, drift = mcTime * MC_DAY_SECONDS * 1.5;
    mcCloudMesh.position.x = cp.x;
    mcCloudMesh.position.z = cp.z;
    mcCloudTex.offset.x = (cp.x + drift) * rep / W - rep / 2;
    mcCloudTex.offset.y = -cp.z * rep / W - rep / 2;
  }
}

function createPlayerHand() {
  mcHandGroup = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89666 });
  const sleeve = new THREE.MeshLambertMaterial({ color: 0x00a8ff });
  const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), skin);
  const sleeveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.22), sleeve);
  sleeveMesh.position.y = 0.12;
  mcHandArm = new THREE.Group();
  mcHandArm.add(armMesh);
  mcHandArm.add(sleeveMesh);
  mcHandArm.position.set(0.38, -0.38, -0.55);
  mcHandArm.rotation.set(-0.3, -0.2, 0);
  mcHandGroup.add(mcHandArm);
  mcCamera.add(mcHandGroup);
  mcHeldBlock = null;
  mcRefreshHeld();
}
function mcRefreshHeld() {
  if (!mcHandGroup) return;
  const id = mcHotbar[mcSelectedIndex];
  if (mcHeldBlock) { mcHandGroup.remove(mcHeldBlock); mcHeldBlock.geometry.dispose(); mcHeldBlock = null; }
  const has = !!id && (mcInventory[id] || 0) > 0;
  if (has) {
    mcHeldBlock = new THREE.Mesh(mcBlockGeometry(id), mcMatHand);
    mcHeldBlock.scale.set(0.24, 0.24, 0.24);
    mcHeldBlock.position.set(0.4, -0.3, -0.62);
    mcHeldBlock.rotation.set(0.25, 0.7, 0);
    mcHandGroup.add(mcHeldBlock);
  }
  mcHandArm.visible = !has;
}

// ---------- Ouverture de l'inventaire / table / four ----------
function animateHandSwing() { mcSwingT = 1; }
function mcUpdateHand(dt, moving, speedNorm) {
  mcHandGroup.visible = !!mcSettings.showHand;
  if (mcSwingT > 0) mcSwingT = Math.max(0, mcSwingT - dt / 0.28);
  const sw = Math.sin((1 - mcSwingT) * Math.PI) * (mcSwingT > 0 ? 1 : 0);
  let bx = 0, by = 0;
  if (mcSettings.bobbing && moving && mcPlayer.onGround) {
    mcBobPhase += dt * (6 + speedNorm * 1.2);
    bx = Math.cos(mcBobPhase) * 0.012;
    by = Math.abs(Math.sin(mcBobPhase)) * 0.016;
  }
  mcHandGroup.position.set(bx - sw * 0.1, -by - sw * 0.12, -sw * 0.18);
  mcHandGroup.rotation.set(-sw * 0.9, -sw * 0.25, 0);
  mcCamera.position.y = mcPlayer.pos.y + (mcSettings.bobbing && moving && mcPlayer.onGround ? by * 1.6 : 0);
}

// ============================================================
// INTERFACE
// ============================================================
function mcToast(msg) {
  const hud = document.getElementById('mc-hud-container');
  if (!hud) return;
  let t = document.getElementById('mc-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'mc-toast';
    t.style.cssText = 'position:absolute;top:14%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.78);color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;border:1px solid #00f3ff;pointer-events:none;max-width:92%;text-align:center;z-index:30;';
    hud.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(mcToastTimer);
  mcToastTimer = setTimeout(() => { t.style.display = 'none'; }, 1900);
}

function mcShowSlotName() {
  const el = document.getElementById('mc-slotname');
  if (!el) return;
  const id = mcHotbar[mcSelectedIndex];
  el.textContent = id ? BLOCK_TYPES[id].name : '';
  el.style.opacity = id ? '1' : '0';
  clearTimeout(mcSlotNameTimer);
  mcSlotNameTimer = setTimeout(() => { el.style.opacity = '0'; }, 1300);
}
function mcSelectSlot(i, silent) {
  mcSelectedIndex = (i + mcHotbar.length) % mcHotbar.length;
  updateHotbarUI();
  mcRefreshHeld();
  if (!silent) mcShowSlotName();
}

function setupCybercraftUI(container, canvas) {
  const oldHud = document.getElementById('mc-hud-container');
  if (oldHud) oldHud.remove();

  const hud = document.createElement('div');
  hud.id = 'mc-hud-container';
  hud.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;font-family:system-ui,sans-serif;overflow:hidden;' + (mcTouchMode ? '--mcslot:38px;' : '--mcslot:50px;');

  hud.innerHTML = `
    <style>
      #mc-hud-container *{box-sizing:border-box}
      #mc-cross{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:26px;font-weight:700;mix-blend-mode:difference}
      #mc-target{position:absolute;top:10px;left:50%;transform:translateX(-50%);color:#fff;font-size:12px;background:rgba(0,0,0,.45);padding:3px 9px;border-radius:6px;display:none}
      #mc-fps{position:absolute;top:8px;right:10px;color:#9dffb0;font:11px monospace;text-align:right;background:rgba(0,0,0,.4);padding:3px 7px;border-radius:5px;display:none;white-space:pre}
      #mc-hotbar{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(0,0,0,.65);padding:5px;border:2px solid #555;border-radius:8px;pointer-events:auto;touch-action:manipulation}
      .mc-slot{position:relative;width:var(--mcslot);height:var(--mcslot);border:2px solid #333;background:rgba(255,255,255,.06);border-radius:5px;display:flex;align-items:center;justify-content:center;cursor:pointer}
      .mc-slot.sel{border-color:#00f3ff;box-shadow:0 0 8px #00f3ff;background:rgba(0,243,255,.14)}
      .mc-slot img{width:72%;height:72%;image-rendering:pixelated;pointer-events:none}
      .mc-slot .k{position:absolute;top:0;left:3px;font-size:9px;color:#aaa}
      .mc-slot .c{position:absolute;bottom:0;right:3px;font-size:11px;color:#fff;font-weight:700;text-shadow:1px 1px 0 #000}
      #mc-slotname{position:absolute;bottom:calc(var(--mcslot) + 36px);left:50%;transform:translateX(-50%);color:#fff;font-size:13px;text-shadow:1px 1px 2px #000;opacity:0;transition:opacity .3s}
      #mc-loading{position:absolute;inset:0;background:#070a14;color:#00f3ff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:40;pointer-events:auto}
      #mc-loadbar{width:min(260px,70%);height:8px;background:#1b2238;border-radius:4px;overflow:hidden}
      #mc-loadfill{height:100%;width:0;background:#00f3ff;transition:width .1s}
      #mc-pause-menu{position:absolute;inset:0;background:rgba(6,8,18,.92);display:flex;pointer-events:auto;overflow-y:auto;padding:10px;color:#fff;z-index:20}
      .mc-panel{margin:auto;width:min(760px,100%);display:flex;flex-direction:column;gap:10px}
      .mc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .mc-head h2{margin:0;color:#00f3ff;font-size:20px;letter-spacing:1px}
      .mc-btn{cursor:pointer;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(0,243,255,.45);border-radius:6px;padding:8px 12px;font-size:13px}
      .mc-btn:hover{background:rgba(0,243,255,.18)}
      .mc-btn.main{background:#00f3ff;color:#001018;border:none;font-weight:700;font-size:15px;padding:10px 24px}
      .mc-btn.danger{border-color:#ff0055;color:#ff7aa5}
      #mc-tabs{display:flex;flex-wrap:wrap;gap:6px}
      #mc-tabs .mc-btn.active{background:rgba(0,243,255,.25);border-color:#00f3ff}
      #mc-tab-body{background:rgba(255,255,255,.05);border-radius:8px;padding:12px;font-size:13px;min-height:120px}
      .mc-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}
      .mc-row:last-child{border-bottom:none}
      .mc-row input[type=range]{width:46%;accent-color:#00f3ff}
      .mc-row input[type=checkbox]{width:20px;height:20px;accent-color:#00f3ff}
      .mc-val{color:#00f3ff;min-width:64px;text-align:right}
      .mc-grid{display:flex;flex-wrap:wrap;gap:8px}
      .mc-cell{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.35);border-radius:6px;padding:5px 9px;font-size:12px}
      .mc-cell img{width:24px;height:24px;image-rendering:pixelated}
      .mc-cols{display:flex;flex-wrap:wrap;gap:16px}
      .mc-col{flex:1 1 280px;display:flex;flex-direction:column;gap:6px}
      .mc-col h4{margin:0 0 4px;font-size:13px}
      .mc-recipe{text-align:left;cursor:pointer;background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:7px 10px;font-size:12px;display:flex;flex-direction:column;gap:2px}
      .mc-recipe small{color:#9fb2c8}
      .mc-recipe.ok{border-color:#00f3ff}
      .mc-recipe.no{opacity:.45}
      .mc-recipe.own{opacity:.6;border-color:#58ff8a}
      .mc-key{min-width:78px;cursor:pointer;background:rgba(0,0,0,.4);color:#00f3ff;border:1px solid #00f3ff;border-radius:6px;padding:6px 8px;font-size:12px}
      .mc-key.wait{background:#00f3ff;color:#001018}
      .mc-note{color:#9fb2c8;font-size:12px;line-height:1.5}
      .mc-us{position:relative;width:46px;height:46px;border:2px solid #3a4666;background:rgba(0,0,0,.4);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;color:#fff;font-size:11px;flex:0 0 auto}
      .mc-us img{width:76%;height:76%;image-rendering:pixelated;pointer-events:none}
      .mc-us .mc-emo{font-size:24px;pointer-events:none}
      .mc-us .c{position:absolute;right:3px;bottom:0;font-size:11px;font-weight:700;text-shadow:1px 1px 0 #000;pointer-events:none}
      .mc-us .mc-hint{font-size:9px;color:#7d8bb0;pointer-events:none}
      .mc-us.sel{border-color:#00f3ff;box-shadow:0 0 8px #00f3ff;background:rgba(0,243,255,.14)}
      .mc-us.tgt{border-color:#58ff8a}
      .mc-us.res{border-color:#ffcc00;width:54px;height:54px}
      .mc-ugrid{display:grid;gap:4px}
      .mc-craftrow{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      .mc-col2{display:flex;flex-direction:column;gap:6px;align-items:center}
      .mc-arrow{font-size:26px;color:#9fb2c8;text-align:center}
      .mc-palette{display:flex;flex-wrap:wrap;gap:4px}
      .mc-flame{width:10px;height:22px;background:#2a1a10;border-radius:3px;position:relative;overflow:hidden}
      .mc-flame div{position:absolute;bottom:0;left:0;width:100%;background:linear-gradient(#ffd34d,#ff5a00)}
      .mc-prog{width:60px;height:6px;background:#222;border-radius:3px;overflow:hidden}
      .mc-prog div{height:100%;background:#58ff8a}
      .mc-book{display:flex;flex-direction:column;gap:5px;max-height:300px;overflow-y:auto}
      .mc-recipe{display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:5px 9px;font-size:12px}
      .mc-recipe:hover{border-color:#00f3ff}
      .mc-recipe.no{opacity:.5}
      .mc-recipe small{color:#9fb2c8}
      .mc-mini{display:grid;gap:1px}
      .mc-mc{width:22px;height:22px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:14px}
      .mc-mc img{width:18px;height:18px;image-rendering:pixelated}
      #mc-touch-ui{position:absolute;inset:0;pointer-events:none;touch-action:none}
      #mc-joy,#mc-btns{bottom:92px}
      @media (min-width:640px){#mc-joy,#mc-btns{bottom:18px}}
    </style>

    <div id="mc-cross">+</div>
    <div id="mc-target"></div>
    <div id="mc-fps"></div>
    <div id="mc-slotname"></div>
    <div id="mc-hotbar">
      ${mcHotbar.map((id, i) => `
        <div class="mc-slot" id="mc-slot-${i}">
          <span class="k">${i + 1}</span>
          <img id="mc-img-${i}" src="${mcIcons[id] || ''}" alt="">
          <span class="c" id="mc-count-${i}">0</span>
        </div>`).join('')}
    </div>

    <div id="mc-pause-menu">
      <div class="mc-panel">
        <div class="mc-head">
          <h2>CYBERCRAFT</h2>
          <button class="mc-btn main" id="mc-btn-resume">▶ REPRENDRE</button>
        </div>
        <div id="mc-tabs">
          <button class="mc-btn" data-tab="inv">🎒 Inventaire &amp; Crafts</button>
          <button class="mc-btn" data-tab="controls">🎮 Commandes</button>
          <button class="mc-btn" data-tab="audio">🔊 Audio</button>
          <button class="mc-btn" data-tab="graphics">🖥 Graphismes</button>
          <button class="mc-btn" data-tab="options">⚙ Options</button>
        </div>
        <div id="mc-tab-body"></div>
      </div>
    </div>

    <div id="mc-loading">
      <div style="font-size:18px;font-weight:700;letter-spacing:1px">GÉNÉRATION DU MONDE…</div>
      <div id="mc-loadbar"><div id="mc-loadfill"></div></div>
    </div>
  `;

  container.style.position = 'relative';
  container.appendChild(hud);

  mcHotbar.forEach((id, i) => {
    const slot = document.getElementById('mc-slot-' + i);
    if (slot) slot.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      mcSelectSlot(i);
    });
  });

  hud.querySelectorAll('#mc-tabs [data-tab]').forEach(b => {
    b.addEventListener('click', () => { mcPlayClick(); mcShowTab(b.dataset.tab); });
  });

  document.getElementById('mc-btn-resume').addEventListener('click', () => {
    mcAudioEnsure();
    if (!mcReady) return;
    if (mcTouchMode) mcSetPaused(false);
    else mcLock(canvas);
  });

  if (mcTouchMode) setupCybercraftTouchUI(hud);
  mcShowTab(mcTab);
  updateInventoryUI();
  mcApplyTouchScale();
}

function mcLock(canvas) {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => { /* ignore */ });
  } catch (e) { /* ignore */ }
}

function mcSetPaused(p, tab) {
  mcIsPaused = p;
  const menu = document.getElementById('mc-pause-menu');
  if (menu) menu.style.display = p ? 'flex' : 'none';
  if (p) {
    mcMining = false; mcMiningProgress = 0; mcTargetKey = null;
    mcTouch.x = 0; mcTouch.y = 0; mcTouch.jump = false;
    for (const k in mcKeys) mcKeys[k] = false;
    if (mcCrackMesh) mcCrackMesh.visible = false;
    mcCapture = null;
    mcConfirmReset = false;
    mcShowTab(tab || mcTab);
    mcSaveGame();
  } else {
    mcReturnGrid();
    mcCursor = null;
    updateHotbarUI();
    mcRefreshHeld();
  }
}

function mcOpenInventory(mode) {
  mcReturnGrid();
  mcInitGrid(mode);
  mcCursor = null;
  if (document.exitPointerLock) document.exitPointerLock();
  mcSetPaused(true, 'inv');
}

function mcItemHtml(k, n) {
  let inner = '';
  if (mcIcons[k]) inner = '<img src="' + mcIcons[k] + '" alt="">';
  else if (MC_ITEMS[k]) inner = '<span class="mc-emo">' + MC_ITEMS[k].i + '</span>';
  else {
    const p = String(k).split('_');
    const tl = MC_TOOLS.find(x => x.id === p[1]);
    inner = tl ? '<span class="mc-emo" style="text-shadow:0 0 6px ' + (MC_TIER_COL[p[0]] || '#fff') + ',0 0 2px #000">' + tl.i + '</span>' : '?';
  }
  return inner + (n > 1 ? '<span class="c">' + n + '</span>' : '');
}

function mcMini(k) {
  if (!k) return '<span class="mc-mc"></span>';
  let inner;
  if (mcIcons[k]) inner = '<img src="' + mcIcons[k] + '" alt="">';
  else if (MC_ITEMS[k]) inner = '<span>' + MC_ITEMS[k].i + '</span>';
  else {
    const p = String(k).split('_');
    const tl = MC_TOOLS.find(x => x.id === p[1]);
    inner = '<span style="text-shadow:0 0 5px ' + (MC_TIER_COL[p[0]] || '#fff') + '">' + (tl ? tl.i : '?') + '</span>';
  }
  return '<span class="mc-mc" title="' + mcItemName(k) + '">' + inner + '</span>';
}

function mcHtmlInventory() {
  const mode = mcCraftMode;
  let craft = '';
  if (mode === 'furnace') {
    const f = mcFurnace;
    const pb = f.burnMax ? Math.round(f.burn / f.burnMax * 100) : 0;
    const pp = Math.round(f.prog / MC_SMELT_TIME * 100);
    const slot = (attr, c, hint) => '<button class="mc-us' + (mcCursor ? ' tgt' : '') + '" ' + attr + '>' + (c ? mcItemHtml(c.k, c.n) : '<span class="mc-hint">' + hint + '</span>') + '</button>';
    craft = '<h4 style="margin:0 0 8px;color:#ff7a2a">🔥 FOUR</h4><div class="mc-craftrow">' +
      '<div class="mc-col2">' + slot('data-fslot="inp"', f.inp, 'À cuire') +
      '<div class="mc-flame"><div id="mc-flame-fill" style="height:' + pb + '%"></div></div>' +
      slot('data-fslot="fuel"', f.fuel, 'Fuel') + '</div>' +
      '<div class="mc-arrow">➜<div class="mc-prog"><div id="mc-prog-fill" style="width:' + pp + '%"></div></div></div>' +
      '<button class="mc-us res" data-fout="1">' + (f.out ? mcItemHtml(f.out.k, f.out.n) : '') + '</button></div>' +
      '<p class="mc-note">Combustibles : charbon, bois, planches, bâtons. Se cuisent : minerai de fer, débris antiques, sable (→ verre), bois (→ charbon de bois). Le four continue de cuire même menu fermé.</p>';
  } else {
    const N = mcGridSize;
    const cells = mcGrid.map((c, i) => '<button class="mc-us' + (mcCursor ? ' tgt' : '') + '" data-cell="' + i + '">' + (c ? mcItemHtml(c.k, c.n) : '') + '</button>').join('');
    const res = mcGridResult();
    craft = '<h4 style="margin:0 0 8px;color:#00f3ff">' + (mode === 'table' ? '🔨 TABLE DE CRAFT ' + N + '×' + N : '🧰 FABRICATION 2×2') + '</h4>' +
      '<div class="mc-craftrow"><div class="mc-ugrid" style="grid-template-columns:repeat(' + N + ',46px)">' + cells + '</div>' +
      '<div class="mc-arrow">➜</div>' +
      '<button class="mc-us res" data-result="1" title="' + (res ? res.name : '') + '">' + (res ? mcItemHtml(res.out.k, res.out.n) : '') + '</button>' +
      '<div class="mc-col2"><button class="mc-btn" data-act="craftall">Tout fabriquer</button><button class="mc-btn" data-act="clear">Vider la grille</button></div></div>' +
      '<p class="mc-note">' + (mcCursor ? 'Objet en main : <b>' + mcItemName(mcCursor) + '</b> — touche une case pour le poser.' : '1) Touche un objet de ton inventaire · 2) touche une case de la grille · 3) touche le résultat pour le prendre.') +
      (mode === 'inv' ? ' Pose une <b>table de craft</b> et fais un clic droit dessus pour une grille ' + MC_TABLE_SIZE + '×' + MC_TABLE_SIZE + ' (pioches, haches, pelles, four).' : '') + '</p>';
  }

  const hot = mcHotbar.map((id, i) => '<button class="mc-us' + (i === mcSelectedIndex ? ' sel' : '') + '" data-hot="' + i + '" title="Case ' + (i + 1) + '">' +
    (id ? '<span style="opacity:' + ((mcInventory[id] || 0) > 0 ? 1 : 0.4) + '">' + mcItemHtml(String(id), mcInventory[id] || 0) + '</span>' : '') + '</button>').join('');
  const pal = Object.keys(mcInventory).filter(k => mcInventory[k] > 0).map(k =>
    '<button class="mc-us' + (mcCursor === k ? ' sel' : '') + '" data-pal="' + k + '" title="' + mcItemName(k) + '">' + mcItemHtml(k, mcInventory[k]) + '</button>').join('');

  let book = '';
  if (mode !== 'furnace') {
    book = '<h4 style="margin:14px 0 6px;color:#ffcc00">LIVRE DE RECETTES <span class="mc-note">(touche une recette pour remplir la grille)</span></h4><div class="mc-book">' +
      MC_RECIPES.map(r => {
        const locked = r.big && mcGridSize < 3;
        let pat;
        if (r.shapeless) pat = '<div class="mc-mini" style="grid-template-columns:repeat(' + Math.min(4, r.shapeless.length) + ',22px)">' + r.shapeless.map(mcMini).join('') + '</div>';
        else pat = '<div class="mc-mini" style="grid-template-columns:repeat(' + r.w + ',22px)">' + r.shape.map(row => row.map(mcMini).join('')).join('') + '</div>';
        return '<button class="mc-recipe' + (locked ? ' no' : '') + '" data-recipe="' + r.id + '">' + pat + '<span>➜</span>' + mcMini(r.out.k) +
          '<span><b>' + (r.out.n > 1 ? r.out.n + '× ' : '') + r.name + '</b>' + (locked ? '<br><small>🔨 Table requise</small>' : '') + '</span></button>';
      }).join('') + '</div>';
  }

  return craft + '<h4 style="margin:14px 0 6px;color:#9dffb0">BARRE D\'OBJETS <span class="mc-note">(touche un objet puis une case pour l\'y mettre)</span></h4><div class="mc-palette">' + hot + '</div>' +
    '<h4 style="margin:14px 0 6px;color:#ffcc00">INVENTAIRE</h4><div class="mc-palette">' + (pal || '<span class="mc-note">Vide</span>') + '</div>' + book;
}

// ----- Onglets du menu -----
function mcShowTab(tab) {
  if (tab === 'game' || tab === 'craft') tab = 'inv';
  mcTab = tab;
  document.querySelectorAll('#mc-tabs [data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const body = document.getElementById('mc-tab-body');
  if (!body) return;
  if (tab === 'inv') body.innerHTML = mcHtmlInventory();
  else if (tab === 'controls') body.innerHTML = mcHtmlControls();
  else body.innerHTML = mcHtmlSettings(tab);
  mcWireTab(body, tab);
}

function mcHtmlControls() {
  const rows = MC_ACTIONS.map(a => `
    <div class="mc-row"><span>${a.l}</span>
      <span style="display:flex;gap:6px">
        <button class="mc-key" data-bind="${a.id}:0">${mcKeyLabel(mcSettings.keys[a.id][0])}</button>
        <button class="mc-key" data-bind="${a.id}:1">${mcKeyLabel(mcSettings.keys[a.id][1])}</button>
      </span></div>`).join('');
  return `${rows}
    <p class="mc-note" style="margin-top:10px">Clique sur une touche puis appuie sur la nouvelle touche (Échap : annuler, Retour arrière : effacer). Souris : clic gauche casser, clic droit poser, clic molette copier le bloc visé, molette changer d'objet. Les chiffres 1 à 9 choisissent l'objet.</p>
    <button class="mc-btn" id="mc-keys-reset">↺ Touches par défaut</button>`;
}

function mcSettingRow(d) {
  const v = mcSettings[d.k];
  if (d.t === 'check') return `<label class="mc-row"><span>${d.l}</span><input type="checkbox" data-k="${d.k}" ${v ? 'checked' : ''}></label>`;
  return `<div class="mc-row"><span>${d.l}</span><span class="mc-val" id="mc-val-${d.k}">${d.f(v)}</span><input type="range" data-k="${d.k}" min="${d.min}" max="${d.max}" step="${d.s}" value="${v}"></div>`;
}
function mcHtmlSettings(group) {
  const defs = MC_UI[group] || [];
  const list = group === 'options' && !mcTouchMode ? defs.filter(d => d.k !== 'touchSens' && d.k !== 'touchScale') : defs;
  let html = list.map(mcSettingRow).join('');
  if (group === 'graphics') html += '<p class="mc-note">Le monde est infini : il se charge autour de toi. Baisse la distance d\'affichage (et la résolution) si ça saccade. Le jeu le fait aussi tout seul en cas de lag.</p>';
  if (group === 'options') {
    const k = (a) => mcSettings.keys[a].filter(Boolean).map(mcKeyLabel).join(' / ');
    const help = mcTouchMode
      ? 'Joystick : bouger · Glisser : regarder · ⛏ casser (maintenir) · ▣ poser / utiliser une table ou un four · ⤒ sauter · 🏃 courir · ☰ inventaire'
      : k('forward') + ' ' + k('left') + ' ' + k('back') + ' ' + k('right') + ' : bouger · ' + k('jump') + ' : sauter · ' + k('sprint') + ' : courir · Clic gauche : casser · Clic droit : poser / utiliser table ou four · Molette ou 1-9 : objet · ' + k('menu') + ' : inventaire';
    html += '<p class="mc-note" style="margin-top:12px">' + help + '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="mc-btn" id="mc-save-now">💾 Sauvegarder</button>' +
      '<button class="mc-btn danger" id="mc-new-world">' + (mcConfirmReset ? '⚠ Confirmer : tout effacer ?' : '🗑 Nouveau monde') + '</button></div>';
  }
  return html;
}

function mcWireTab(body, tab) {
  body.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k;
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      const def = MC_DEFS[k];
      if (el.type === 'checkbox') mcSettings[k] = el.checked;
      else {
        mcSettings[k] = parseFloat(el.value);
        const lab = document.getElementById('mc-val-' + k);
        if (lab && def) lab.textContent = def.f(mcSettings[k]);
      }
      mcApplySettings(k);
      mcSaveSettings();
    });
  });
  const rerender = () => updateInventoryUI();
  body.querySelectorAll('[data-pal]').forEach(el => el.addEventListener('click', () => {
    mcCursor = mcCursor === el.dataset.pal ? null : el.dataset.pal;
    mcPlayClick(); rerender();
  }));
  body.querySelectorAll('[data-cell]').forEach(el => el.addEventListener('click', () => {
    mcPutCell(parseInt(el.dataset.cell, 10)); mcPlayClick(); rerender();
  }));
  body.querySelectorAll('[data-result]').forEach(el => el.addEventListener('click', () => { mcTakeResult(); rerender(); }));
  body.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
    if (el.dataset.act === 'craftall') mcTakeAll(); else mcReturnGrid();
    rerender();
  }));
  body.querySelectorAll('[data-hot]').forEach(el => el.addEventListener('click', () => {
    const i = parseInt(el.dataset.hot, 10);
    if (mcCursor) {
      const id = parseInt(mcCursor, 10);
      if (BLOCK_TYPES[mcCursor] && MC_PLACEABLE.indexOf(id) >= 0) {
        mcHotbar[i] = id;
        mcSelectedIndex = i;
      } else mcToast('Seuls les blocs se mettent dans la barre d\'objets.');
    } else mcSelectedIndex = i;
    mcPlayClick(); rerender(); mcRefreshHeld();
  }));
  body.querySelectorAll('[data-recipe]').forEach(el => el.addEventListener('click', () => {
    mcAutoFill(el.dataset.recipe); mcPlayClick(); rerender();
  }));
  body.querySelectorAll('[data-fslot]').forEach(el => el.addEventListener('click', () => {
    mcPutFurnace(el.dataset.fslot); mcPlayClick(); rerender();
  }));
  body.querySelectorAll('[data-fout]').forEach(el => el.addEventListener('click', () => { mcTakeFurnaceOut(); rerender(); }));

  body.querySelectorAll('[data-bind]').forEach(el => {
    el.addEventListener('click', () => {
      const [action, slot] = el.dataset.bind.split(':');
      mcCapture = { action, slot: parseInt(slot, 10) };
      body.querySelectorAll('.mc-key').forEach(b => b.classList.remove('wait'));
      el.classList.add('wait');
      el.textContent = 'Appuie…';
    });
  });
  const reset = body.querySelector('#mc-keys-reset');
  if (reset) reset.addEventListener('click', () => {
    mcSettings.keys = mcDefaultKeys();
    mcSaveSettings();
    mcShowTab('controls');
  });
  const save = body.querySelector('#mc-save-now');
  if (save) save.addEventListener('click', () => { mcSaveGame(true); mcToast('Monde sauvegardé 💾'); });
  const nw = body.querySelector('#mc-new-world');
  if (nw) nw.addEventListener('click', () => {
    if (!mcConfirmReset) { mcConfirmReset = true; mcShowTab('options'); return; }
    try { localStorage.removeItem(MC_SAVE_KEY); } catch (e) { /* ignore */ }
    mcConfirmReset = false;
    startCybercraftGame(true);
  });
}

function mcAssignKey(action, slot, key) {
  MC_ACTIONS.forEach(a => {
    for (let i = 0; i < 2; i++) {
      if (key && mcSettings.keys[a.id][i] === key) mcSettings.keys[a.id][i] = '';
    }
  });
  mcSettings.keys[action][slot] = key;
  mcSaveSettings();
}

function mcApplySettings(key) {
  if (mcCamera) { mcCamera.fov = mcSettings.fov; mcCamera.updateProjectionMatrix(); }
  if (mcRenderer) mcResize();
  mcApplyFog();
  if (mcAtlasTex) mcApplyTexFilter(mcAtlasTex);
  mcAudioVolumes();
  const fps = document.getElementById('mc-fps');
  if (fps) fps.style.display = mcSettings.showFps ? 'block' : 'none';
  mcApplyTouchScale();
  if (key === 'renderDist') mcCenterCx = 1e9;
  if (key === 'ao' && mcReady) mcMarkAllDirty();
}
function mcApplyFog() {
  if (!mcScene || !mcScene.fog) return;
  const far = Math.max(24, (mcSettings.renderDist - 0.6) * 16);
  mcScene.fog.near = mcSettings.fog ? far * 0.5 : 1e5;
  mcScene.fog.far = mcSettings.fog ? far : 2e5;
}
function mcApplyTouchScale() {
  const s = (mcSettings.touchScale || 100) / 100;
  const joy = document.getElementById('mc-joy');
  const btns = document.getElementById('mc-btns');
  if (joy) { joy.style.transformOrigin = 'left bottom'; joy.style.transform = 'scale(' + s + ')'; }
  if (btns) { btns.style.transformOrigin = 'right bottom'; btns.style.transform = 'scale(' + s + ')'; }
}

function mcResize() {
  if (!mcRenderer || !mcCamera) return;
  const cv = mcRenderer.domElement;
  const p = cv.parentElement;
  const w = (p && p.clientWidth) || 800;
  const h = (p && p.clientHeight) || 500;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  mcRenderer.setPixelRatio(dpr * (mcSettings.resolution / 100));
  mcRenderer.setSize(w, h);
  mcCamera.aspect = w / h;
  mcCamera.updateProjectionMatrix();
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
      <div id="mc-btn-run"   style="position:absolute;right:98px;bottom:84px;width:50px;height:50px;font-size:20px;${circle}">🏃</div>
    </div>
    <div id="mc-btn-menu" style="position:absolute;left:14px;top:14px;width:44px;height:44px;font-size:22px;border-radius:10px;background:rgba(5,5,16,0.55);border:2px solid rgba(0,243,255,0.6);color:#00f3ff;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;">☰</div>
  `;
  hud.appendChild(wrap);

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

  const bind = (id, onDown, onUp) => {
    const el = wrap.querySelector(id);
    let pid = null;
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (id !== '#mc-btn-run') el.style.background = 'rgba(5,5,16,0.55)';
      if (onUp) onUp();
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      mcAudioEnsure();
      if (pid !== null) return;
      pid = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (id !== '#mc-btn-run') el.style.background = 'rgba(0,243,255,0.38)';
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
  bind('#mc-btn-run', () => {
    mcTouch.run = !mcTouch.run;
    wrap.querySelector('#mc-btn-run').style.background = mcTouch.run ? 'rgba(0,243,255,0.5)' : 'rgba(5,5,16,0.55)';
  });
  bind('#mc-btn-menu', () => mcOpenInventory('inv'));
}

function updateInventoryUI() {
  updateHotbarUI();
  if (mcIsPaused && mcTab === 'inv' && document.getElementById('mc-tab-body') && !mcCapture) mcShowTab('inv');
  mcRefreshHeld();
}
function updateHotbarUI() {
  mcHotbar.forEach((id, i) => {
    const c = document.getElementById('mc-count-' + i);
    const s = document.getElementById('mc-slot-' + i);
    const img = document.getElementById('mc-img-' + i);
    const n = id ? (mcInventory[id] || 0) : 0;
    if (c) c.textContent = id ? n : '';
    if (img) {
      if (img.dataset.id !== String(id)) { img.dataset.id = String(id); img.src = id ? (mcIcons[id] || '') : ''; }
      img.style.visibility = id ? 'visible' : 'hidden';
    }
    if (s) {
      s.classList.toggle('sel', i === mcSelectedIndex);
      s.style.opacity = (n > 0 || !id) ? '1' : '0.45';
    }
  });
}

// ============================================================
// ACTIONS : poser / casser
// ============================================================
function mcPlaceBlock() {
  if (!mcReady || mcIsPaused) return;
  const t = mcCastFromCamera();
  if (!t) return;
  if (t.type === 15) { mcOpenInventory('table'); return; }
  if (t.type === 16) { mcOpenInventory('furnace'); return; }
  const id = mcHotbar[mcSelectedIndex];
  if (!id || !((mcInventory[id] || 0) > 0)) return;
  const px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
  if (py < 0 || py >= MC_WORLD_H || mcGet(px, py, pz) !== 0) return;
  const p = mcPlayer.pos, r = PLAYER_RADIUS;
  const overlap = p.x + r > px - 0.5 && p.x - r < px + 0.5 &&
    p.z + r > pz - 0.5 && p.z - r < pz + 0.5 &&
    p.y - PLAYER_HEIGHT < py + 0.5 && p.y + PLAYER_HEAD > py - 0.5;
  if (overlap) return;
  if (!mcSetBlock(px, py, pz, id)) return;
  mcInventory[id]--;
  mcPlayBlockSound(BLOCK_TYPES[id].sound, 'place');
  animateHandSwing();
  updateInventoryUI();
}

function mcBreakBlock(t) {
  const def = BLOCK_TYPES[t.type];
  mcSpawnParticles(t.x, t.y, t.z, def.tiles[2]);
  mcPlayBlockSound(def.sound, 'break');
  mcSetBlock(t.x, t.y, t.z, 0);
  if (def.drop) mcGive(def.drop, 1);
  mcMiningProgress = 0;
  mcTargetKey = null;
  if (mcCrackMesh) mcCrackMesh.visible = false;
  updateInventoryUI();
}

function mcUpdateMining(dt, wantMine) {
  const t = mcTarget;
  if (!t) {
    mcOutlineMesh.visible = false;
    mcCrackMesh.visible = false;
    mcMiningProgress = 0; mcTargetKey = null;
    return;
  }
  mcOutlineMesh.position.set(t.x, t.y, t.z);
  mcOutlineMesh.visible = true;
  if (!wantMine) {
    mcCrackMesh.visible = false;
    mcMiningProgress = 0; mcTargetKey = null;
    return;
  }
  const def = BLOCK_TYPES[t.type];
  const key = t.x + ',' + t.y + ',' + t.z;
  if (mcTargetKey !== key) { mcTargetKey = key; mcMiningProgress = 0; }

  if (def.hardness === Infinity) {
    if (mcDeniedT <= 0) { mcToast('Ce bloc est incassable !'); mcDeniedT = 1.2; }
    return;
  }
  if (mcToolTier('PICKAXE') < def.minLevel) {
    if (mcDeniedT <= 0) {
      mcToast('Il faut une pioche en ' + MC_TIERS[def.minLevel - 1].n + ' (ou mieux) pour miner : ' + def.name);
      mcDeniedT = 1.5;
    }
    mcCrackMesh.visible = false;
    return;
  }
  const tier = def.tool ? mcToolTier(def.tool) : 0;
  const mult = tier > 0 ? MC_TIERS[tier - 1].mult : 1;
  mcMiningProgress += (1.2 * mult / def.hardness) * dt;

  mcCrackMesh.position.set(t.x, t.y, t.z);
  const stage = Math.min(9, Math.floor(mcMiningProgress * 10));
  if (mcCrackMesh.userData.stage !== stage) {
    mcCrackMesh.userData.stage = stage;
    mcCrackMesh.material.map = mcCrackTex[stage];
    mcCrackMesh.material.needsUpdate = true;
  }
  mcCrackMesh.visible = true;

  mcHitSoundT -= dt;
  if (mcHitSoundT <= 0) {
    mcPlayBlockSound(def.sound, 'hit');
    mcHitSoundT = 0.23;
    if (mcSwingT <= 0) animateHandSwing();
  }
  if (mcMiningProgress >= 1) mcBreakBlock(t);
}

// ============================================================
// MOTEUR DU JEU
// ============================================================
function startCybercraftGame(fresh) {
  if (window.GameMobile) GameMobile.reset();

  let canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const container = canvas.parentElement;

  // Un canvas déjà utilisé en 2D ne peut plus faire de WebGL : on le remplace par un neuf si besoin
  const tryRenderer = (cv) => {
    try { return new THREE.WebGLRenderer({ canvas: cv, antialias: false }); } catch (e) { return null; }
  };
  let newRenderer = tryRenderer(canvas);
  if (!newRenderer) {
    const fresh2 = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(fresh2, canvas);
    canvas = fresh2;
    newRenderer = tryRenderer(canvas);
  }
  if (!newRenderer) {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff7aa5;font:16px sans-serif;text-align:center;padding:20px;background:#070a14;';
    msg.textContent = 'WebGL indisponible sur cet appareil / navigateur : impossible d’afficher le jeu 3D.';
    container.style.position = 'relative';
    container.appendChild(msg);
    return;
  }

  // Nettoyage d'une éventuelle partie précédente
  mcRunId++;
  const runId = mcRunId;
  mcCleanups.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  mcCleanups = [];
  mcStopMusic();
  mcChunkMap.forEach(ch => {
    if (ch.solid) ch.solid.geometry.dispose();
    if (ch.glass) ch.glass.geometry.dispose();
  });
  mcChunkMap.clear();
  if (mcRenderer && mcRenderer !== newRenderer) { try { mcRenderer.dispose(); } catch (e) { /* ignore */ } }
  mcLastCh = null;
  mcGenQueue = []; mcMeshQueue = [];
  mcCenterCx = 1e9; mcCenterCz = 1e9;
  mcReady = false; mcStarted = false;
  mcIsPaused = true;
  mcMining = false; mcMiningProgress = 0; mcTargetKey = null; mcTarget = null;
  mcPlayer.velocity.set(0, 0, 0);
  mcPlayer.pitch = 0; mcPlayer.yaw = 0; mcPlayer.onGround = false;
  mcPlayer.pos.set(0, 30, 0);
  mcTouch.x = 0; mcTouch.y = 0; mcTouch.jump = false; mcTouch.run = false;
  for (const k in mcKeys) mcKeys[k] = false;
  mcCapture = null;
  mcTab = 'inv';
  mcSwingT = 0;
  mcCursor = null;
  mcInitGrid('inv');
  mcResetFurnace();

  mcTouchMode = !!(window.GameMobile
    ? GameMobile.isTouch
    : (window.matchMedia && matchMedia('(pointer: coarse)').matches));
  mcLoadSettings();

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    mcCleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  // Sauvegarde éventuelle
  mcEdits.clear();
  mcResetInventory();
  mcHotbar = [1, 2, 3, 4, 5, 0, 0, 0, 0];
  mcSelectedIndex = 0;
  mcTime = 0.22;
  const save = fresh ? null : mcLoadGame();
  if (save) {
    mcSeed = save.seed;
    (save.edits || []).forEach(e => {
      const m = new Map();
      for (let i = 0; i + 1 < e[2].length; i += 2) m.set(e[2][i], e[2][i + 1]);
      mcEdits.set(mcCK(e[0], e[1]), m);
    });
    Object.keys(save.inv || {}).forEach(k => { if (k in mcInventory) mcInventory[k] = save.inv[k] | 0; });
    if (Array.isArray(save.hot) && save.hot.length === 9) mcHotbar = save.hot.map(v => (BLOCK_TYPES[v] && MC_PLACEABLE.indexOf(v) >= 0) ? v : 0);
    if (save.furn && typeof save.furn === 'object') mcFurnace = Object.assign(mcFurnace, save.furn);
    mcTime = typeof save.time === 'number' ? save.time : 0.22;
    mcSelectedIndex = Math.max(0, Math.min(8, save.slot | 0));
  } else {
    mcSeed = Math.floor(Math.random() * 2147483647) + 1;
  }

  // Scène
  mcScene = new THREE.Scene();
  mcScene.background = new THREE.Color(0x78a7ff);
  mcScene.fog = new THREE.Fog(0x78a7ff, 40, 72);
  mcCamera = new THREE.PerspectiveCamera(mcSettings.fov, 1, 0.1, 700);
  mcCamera.rotation.order = 'YXZ';
  mcRenderer = newRenderer;
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  mcResize();
  mcApplyFog();

  mcScene.add(mcCamera);
  mcScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(0.5, 1, 0.4);
  mcScene.add(dirLight);

  // Textures & matériaux
  const atlas = mcBuildAtlas();
  mcAtlasTex = new THREE.CanvasTexture(atlas);
  mcAtlasTex.generateMipmaps = false;
  if (THREE.SRGBColorSpace) mcAtlasTex.colorSpace = THREE.SRGBColorSpace;
  mcApplyTexFilter(mcAtlasTex);
  mcMatSolid = new THREE.MeshBasicMaterial({ map: mcAtlasTex, vertexColors: true, alphaTest: 0.5 });
  mcMatGlass = new THREE.MeshBasicMaterial({ map: mcAtlasTex, vertexColors: true, transparent: true, alphaTest: 0.02, depthWrite: false });
  mcMatHand = new THREE.MeshBasicMaterial({ map: mcAtlasTex, vertexColors: true, alphaTest: 0.5, fog: false });
  mcMakeCrackTextures();
  mcIcons = {};
  MC_PLACEABLE.forEach(id => { mcIcons[id] = mcMakeCubeIcon(BLOCK_TYPES[id].tiles[0], BLOCK_TYPES[id].tiles[1]); });

  mcOutlineMesh = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000 })
  );
  mcOutlineMesh.visible = false;
  mcScene.add(mcOutlineMesh);
  mcCrackMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshBasicMaterial({ map: mcCrackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
  );
  mcCrackMesh.visible = false;
  mcScene.add(mcCrackMesh);

  mcCreateSky();
  mcInitParticles();
  createPlayerHand();
  setupCybercraftUI(container, canvas);
  mcApplySettings();

  // Point de départ : on génère tout de suite le chunk de départ, le reste se charge en direct
  setTimeout(() => {
    if (runId !== mcRunId) return;
    let sx = 0, sz = 0;
    if (save && save.pos) { sx = save.pos[0]; sz = save.pos[2]; }
    mcGenChunk(mcBi(sx) >> 4, mcBi(sz) >> 4);
    if (save && save.pos) {
      mcPlayer.pos.set(save.pos[0], save.pos[1], save.pos[2]);
      mcPlayer.yaw = save.yaw || 0;
      mcPlayer.pitch = save.pitch || 0;
    } else {
      if (!mcChunkMap.get(mcCK(0, 0))) mcGenChunk(0, 0);
      const sp = mcSpawnPos();
      mcPlayer.pos.set(sp.x, sp.y, sp.z);
    }
    mcStarted = true;
  }, 40);

  const startCx = () => mcBi(mcPlayer.pos.x) >> 4;
  const startCz = () => mcBi(mcPlayer.pos.z) >> 4;
  const loadFill = () => document.getElementById('mc-loadfill');

  const finishLoading = () => {
    let guard = 0;
    while (mcBoxHits(mcPlayer.pos.x, mcPlayer.pos.y, mcPlayer.pos.z) && guard++ < 60) mcPlayer.pos.y += 1;
    mcPlayer.velocity.set(0, 0, 0);
    mcReady = true;
    const l = document.getElementById('mc-loading');
    if (l) l.style.display = 'none';
    mcRefreshHeld();
    updateHotbarUI();
    if (!mcTouchMode) mcToast('Clique sur REPRENDRE pour jouer');
  };
  // Prêt quand les 5x5 chunks autour du joueur sont affichés
  const startReady = () => {
    const pcx = startCx(), pcz = startCz();
    let have = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const c = mcChunkMap.get(mcCK(pcx + dx, pcz + dz));
      if (c && c.meshed) have++;
    }
    return have;
  };

  // Contrôles
  if (!mcTouchMode) {
    on(document, 'mousemove', (e) => {
      if (document.pointerLockElement === canvas && !mcIsPaused) {
        mcPlayer.yaw -= e.movementX * mcMouseSens();
        mcPlayer.pitch -= e.movementY * mcMouseSens() * (mcSettings.invertY ? -1 : 1);
        mcPlayer.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, mcPlayer.pitch));
      }
    });
    on(canvas, 'mousedown', (e) => {
      mcAudioEnsure();
      if (document.pointerLockElement !== canvas) {
        if (mcReady && !mcIsPaused) mcLock(canvas);
        return;
      }
      if (mcIsPaused) return;
      if (e.button === 0) { mcMining = true; animateHandSwing(); }
      else if (e.button === 2) mcPlaceBlock();
      else if (e.button === 1) {
        e.preventDefault();
        const t = mcCastFromCamera();
        if (t) { const i = mcHotbar.indexOf(t.type); if (i >= 0) mcSelectSlot(i); }
      }
    });
    on(window, 'mouseup', (e) => {
      if (e.button === 0) { mcMining = false; mcMiningProgress = 0; if (mcCrackMesh) mcCrackMesh.visible = false; }
    });
    on(document, 'pointerlockchange', () => {
      if (!mcReady) return;
      mcSetPaused(document.pointerLockElement !== canvas);
    });
    on(canvas, 'wheel', (e) => {
      if (mcIsPaused) return;
      e.preventDefault();
      mcSelectSlot(mcSelectedIndex + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
  } else {
    let lookId = null, lx = 0, ly = 0;
    on(canvas, 'pointerdown', (e) => {
      mcAudioEnsure();
      if (mcIsPaused || lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
    });
    on(canvas, 'pointermove', (e) => {
      if (e.pointerId !== lookId || mcIsPaused) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      const k = mcMouseSens() * 3 * (mcSettings.touchSens / 100);
      mcPlayer.yaw -= dx * k;
      mcPlayer.pitch -= dy * k * (mcSettings.invertY ? -1 : 1);
      mcPlayer.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, mcPlayer.pitch));
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    on(canvas, 'pointerup', endLook);
    on(canvas, 'pointercancel', endLook);
  }

  // Clavier : capture d'une nouvelle touche (menu Commandes)
  on(window, 'keydown', (e) => {
    if (!mcCapture) return;
    e.preventDefault(); e.stopPropagation();
    const k = e.key.toLowerCase();
    if (k === 'escape') { /* annuler */ }
    else if (/^Digit[0-9]$/.test(e.code) || /^Numpad[0-9]$/.test(e.code)) mcToast('Les chiffres sont réservés à la barre d’objets');
    else if (k === 'backspace' || k === 'delete') mcAssignKey(mcCapture.action, mcCapture.slot, '');
    else mcAssignKey(mcCapture.action, mcCapture.slot, k);
    mcCapture = null;
    mcShowTab('controls');
  }, true);

  on(window, 'keydown', (e) => {
    if (mcCapture) return;
    mcAudioEnsure();
    const k = e.key.toLowerCase();
    const inField = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (mcIsPaused) {
      if (!inField && !mcTouchMode && mcReady && k && mcSettings.keys.menu.includes(k)) { e.preventDefault(); mcLock(canvas); }
      return;
    }
    mcKeys[k] = true;
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
    if (m) mcSelectSlot(parseInt(m[1], 10) - 1);
    if (k && mcSettings.keys.menu.includes(k) && !e.repeat) mcOpenInventory('inv');
    if (k && mcSettings.keys.place.includes(k) && !e.repeat) mcPlaceBlock();
  });
  on(window, 'keyup', (e) => { mcKeys[e.key.toLowerCase()] = false; });
  on(window, 'blur', () => { for (const k in mcKeys) mcKeys[k] = false; });
  on(window, 'pointerdown', () => mcAudioEnsure());
  on(canvas, 'contextmenu', e => e.preventDefault());
  on(window, 'resize', mcResize);
  on(window, 'pagehide', () => mcSaveGame());

  // Boucle d'animation
  let last = performance.now();
  let fpsT = 0, fpsN = 0, fpsShown = 60;
  let lowFpsCount = 0, lastTargetType = -1, furnUiT = 0, furnSig = '';
  let fovCur = mcSettings.fov;
  let autoQNotified = false;
  const elTarget = document.getElementById('mc-target');
  const elFps = document.getElementById('mc-fps');

  function animate(now) {
    if (runId !== mcRunId) return;
    const t = (typeof now === 'number') ? now : performance.now();
    const dt = Math.min(0.05, Math.max(0.0001, (t - last) / 1000));
    last = t;

    // Chargement du monde autour du joueur (progressif, sans bloquer l'affichage)
    if (mcStarted) {
      const pcx = startCx(), pcz = startCz();
      if (pcx !== mcCenterCx || pcz !== mcCenterCz) { mcCenterCx = pcx; mcCenterCz = pcz; mcPlanStreaming(pcx, pcz); }
      mcStreamStep(mcReady ? 5 : 40);
      if (!mcReady) {
        const have = startReady();
        const f = loadFill();
        if (f) f.style.width = Math.round(have / 25 * 100) + '%';
        if (have >= 25) finishLoading();
      }
    }

    let moving = false, spd = 0;
    if (mcReady) mcFurnaceTick(dt);
    if (mcReady && !mcIsPaused) {
      let ax = 0, az = 0;
      if (mcDown('forward')) az -= 1;
      if (mcDown('back')) az += 1;
      if (mcDown('left')) ax -= 1;
      if (mcDown('right')) ax += 1;
      if (mcTouchMode) { ax += mcTouch.x; az += mcTouch.y; }
      const sprint = mcDown('sprint') || mcTouch.run;
      const jump = mcDown('jump') || mcTouch.jump;
      const wasGround = mcPlayer.onGround;
      const r = mcPhysics(dt, ax, az, sprint, jump);
      moving = r.moving; spd = r.speed;

      // Bruits de pas
      if (moving && mcPlayer.onGround && wasGround) {
        mcStepDist += r.speed * dt;
        if (mcStepDist > (sprint ? 2.6 : 2.0)) {
          mcStepDist = 0;
          if (mcSettings.stepSounds) mcPlayBlockSound(mcGroundSound(), 'step');
        }
      }
      if (mcPlayer.pos.y < -10) {
        const top = mcTopAt(mcBi(mcPlayer.pos.x), mcBi(mcPlayer.pos.z));
        mcPlayer.pos.y = top + 0.5 + PLAYER_HEIGHT + 2;
        mcPlayer.velocity.set(0, 0, 0);
      }

      // FOV dynamique en sprint
      const wantFov = mcSettings.fov * ((sprint && moving) ? 1.08 : 1);
      fovCur += (wantFov - fovCur) * Math.min(1, dt * 8);
      if (Math.abs(mcCamera.fov - fovCur) > 0.02) { mcCamera.fov = fovCur; mcCamera.updateProjectionMatrix(); }

      mcCamera.position.copy(mcPlayer.pos);
      mcCamera.rotation.set(mcPlayer.pitch, mcPlayer.yaw, 0);

      // Visée et minage
      mcTarget = mcCastFromCamera();
      mcDeniedT -= dt;
      mcUpdateMining(dt, mcMining || mcDown('mine'));

      const ty = mcTarget ? mcTarget.type : 0;
      if (elTarget && ty !== lastTargetType) {
        lastTargetType = ty;
        if (ty) { elTarget.textContent = BLOCK_TYPES[ty].name + ((ty === 15 || ty === 16) ? ' — clic droit pour utiliser' : ''); elTarget.style.display = 'block'; }
        else elTarget.style.display = 'none';
      }

      mcUpdateParticles(dt);
      mcSaveT += dt;
      if (mcSaveT > 25) { mcSaveT = 0; mcSaveGame(); }
    } else if (mcReady) {
      mcCamera.position.copy(mcPlayer.pos);
      mcCamera.rotation.set(mcPlayer.pitch, mcPlayer.yaw, 0);
      mcCrackMesh.visible = false;
      mcOutlineMesh.visible = false;

      // Four ouvert : met à jour les barres de progression sans casser les clics
      if (mcTab === 'inv' && mcCraftMode === 'furnace' && !mcCapture) {
        furnUiT += dt;
        if (furnUiT > 0.25) {
          furnUiT = 0;
          const f = mcFurnace;
          const sig = JSON.stringify([f.inp, f.fuel, f.out]);
          if (sig !== furnSig) { furnSig = sig; mcShowTab('inv'); }
          else {
            const ff = document.getElementById('mc-flame-fill'), pf = document.getElementById('mc-prog-fill');
            if (ff) ff.style.height = (f.burnMax ? Math.round(f.burn / f.burnMax * 100) : 0) + '%';
            if (pf) pf.style.width = Math.round(f.prog / MC_SMELT_TIME * 100) + '%';
          }
        }
      }
    }

    if (mcReady) {
      mcUpdateHand(dt, moving, spd);
      mcUpdateSky(dt);
    }

    // FPS, coordonnées et qualité automatique
    fpsT += dt; fpsN++;
    if (fpsT >= 0.5) {
      fpsShown = Math.round(fpsN / fpsT);
      fpsT = 0; fpsN = 0;
      if (mcSettings.showFps && elFps) {
        elFps.textContent = fpsShown + ' FPS · ' + mcChunkMap.size + ' chunks\nXYZ ' + mcPlayer.pos.x.toFixed(1) + ' ' + (mcPlayer.pos.y - PLAYER_HEIGHT).toFixed(1) + ' ' + mcPlayer.pos.z.toFixed(1) + '\nHeure ' + Math.floor(((mcTime * 24 + 6) % 24)) + 'h';
      }
      if (mcSettings.autoQuality && mcReady && !mcIsPaused) {
        lowFpsCount = fpsShown < 32 ? lowFpsCount + 1 : 0;
        if (lowFpsCount >= 6) {
          lowFpsCount = 0;
          if (mcSettings.resolution > 60) mcSettings.resolution -= 10;
          else if (mcSettings.renderDist > 3) { mcSettings.renderDist -= 1; mcCenterCx = 1e9; }
          else mcSettings.particles = false;
          mcApplySettings();
          mcSaveSettings();
          if (!autoQNotified) { autoQNotified = true; mcToast('Qualité réduite automatiquement pour éviter les saccades'); }
        }
      }
    }

    mcRenderer.render(mcScene, mcCamera);
    const id = requestAnimationFrame(animate);
    try { currentGameLoop = id; } catch (e) { /* ignore */ }
  }

  const firstId = requestAnimationFrame(animate);
  try { currentGameLoop = firstId; } catch (e) { /* ignore */ }

  mcResize();
  if (window.GameMobile) GameMobile.start('cybercraft', { fluid: true, noScore: true, hint: true });
}

// Fermeture propre : appelée par main.js (stopAllGames) quand on quitte le jeu
window._cybercraftCleanup = function () {
  try { if (mcReady) mcSaveGame(); } catch (e) { /* ignore */ }
  mcRunId++;                                   // arrête les boucles liées à cette partie
  mcCleanups.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  mcCleanups = [];
  mcStopMusic();
  mcReady = false; mcStarted = false; mcIsPaused = true;
  mcMining = false;
  for (const k in mcKeys) mcKeys[k] = false;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
  // Interface (HUD, menu pause / paramètres / crafts, commandes tactiles)
  document.querySelectorAll('#mc-hud-container, #mc-pause-menu, #mc-touch-ui').forEach(el => el.remove());
  try {
    mcChunkMap.forEach(ch => {
      if (ch.solid) ch.solid.geometry.dispose();
      if (ch.glass) ch.glass.geometry.dispose();
    });
    mcChunkMap.clear();
    if (mcRenderer) mcRenderer.dispose();
  } catch (e) { /* ignore */ }
};

// Lancement automatique
if (typeof startCybercraftGame === 'function') {
  window.addEventListener('DOMContentLoaded', () => {
    startCybercraftGame();
  });
}