/* =====================================================================
   FERME TYCOON 3D — « Ma Petite Ferme » v2 — style cartoon (Three.js)
   Pour Arbest Arcade. Un seul fichier, JS pur.

   Utilisation :
     startFermeTycoon(div_ou_canvas)   // le jeu prend la taille de TA zone de jeu
     startFermeTycoon()                // cherche #gameCanvas / #game-container…
                                       // sinon fenêtre centrée (Échap = fermer)
   Retourne une fonction de fermeture (cleanup). Aussi : window._fermeCleanup().
   Three.js : utilise window.THREE s'il existe, sinon le charge tout seul (cdnjs r128).
   Commandes : ZQSD / WASD / flèches, ou glisser le doigt / la souris (joystick).
               B = ouvrir la liste des améliorations.
   ===================================================================== */
(function () {
  'use strict';

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var SAVE_KEY = 'arbest_ferme_save_v2';
  var FONT = "'Baloo 2','Fredoka','Trebuchet MS','Comic Sans MS',sans-serif";
  var PI = Math.PI;

  function startFermeTycoon(target) {
    if (window._fermeCleanup) { try { window._fermeCleanup(); } catch (e) {} }
    var disposed = false, inner = null;
    function cleanup() {
      if (disposed) return;
      disposed = true;
      if (inner && inner.cleanup) { try { inner.cleanup(); } catch (e) { console.error(e); } }
      if (window._fermeCleanup === cleanup) window._fermeCleanup = null;
    }
    window._fermeCleanup = cleanup;
    ensureThree(function (err) {
      if (disposed) return;
      if (err) { console.error('[Ferme] ' + err.message); return; }
      inner = initGame(target, cleanup);
    });
    return cleanup;
  }

  function ensureThree(cb) {
    if (window.THREE && window.THREE.WebGLRenderer) return cb();
    var s = document.createElement('script');
    s.src = THREE_URL;
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error('Three.js introuvable')); };
    document.head.appendChild(s);
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* =================================================================== */
  function initGame(target, closeFn) {
    var T = window.THREE;
    var rand = Math.random;

    /* ---------- conteneur ---------- */
    var root = document.createElement('div');
    var baseCss = 'position:relative;width:100%;height:100%;overflow:hidden;background:#bfe9ff;touch-action:none;' +
      'user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;border-radius:16px;font-family:' + FONT + ';';
    root.style.cssText = baseCss;
    var passedCanvas = null, overlay = false, autoH = false;
    if (!(target && target.nodeType === 1)) {
      target = document.querySelector('#gameCanvas,#game-canvas,#game-container,#gameContainer,#game-area,#gameArea,.game-container,.game-area');
    }
    if (target && target.tagName === 'CANVAS') {
      passedCanvas = target;
      var r0 = target.getBoundingClientRect();
      root.style.width = (r0.width || 900) + 'px'; root.style.height = (r0.height || 560) + 'px';
      target.parentNode.insertBefore(root, target);
      passedCanvas._fermeDisplay = target.style.display;
      target.style.display = 'none';
    } else if (target) {
      autoH = target.clientHeight < 300;
      target.appendChild(root);
    } else {
      overlay = true;
      root.style.cssText = baseCss + 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(96vw,1000px);' +
        'height:min(92vh,660px);z-index:9999;border-radius:20px;box-shadow:0 0 0 100vmax rgba(10,8,40,.78),0 20px 60px rgba(0,0,0,.5);';
      document.body.appendChild(root);
    }
    try {
      if (!document.getElementById('fm-font')) {
        var lk = document.createElement('link'); lk.id = 'fm-font'; lk.rel = 'stylesheet';
        lk.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&display=swap'; document.head.appendChild(lk);
      }
    } catch (e) {}

    var renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      root.innerHTML = '<div style="padding:30px;text-align:center;color:#444">WebGL n\'est pas disponible sur cet appareil.</div>';
      return { cleanup: function () { removeRoot(); } };
    }
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    root.appendChild(renderer.domElement);
    var canvasEl = renderer.domElement;

    function removeRoot() {
      if (root.parentNode) root.parentNode.removeChild(root);
      if (passedCanvas) passedCanvas.style.display = passedCanvas._fermeDisplay || '';
    }

    /* ---------- scène ---------- */
    var scene = new T.Scene();
    scene.background = new T.Color(0xaee3ff);
    scene.fog = new T.Fog(0xaee3ff, 60, 120);
    var camera = new T.PerspectiveCamera(42, 1, 0.5, 220);
    var LI = (parseInt(T.REVISION, 10) >= 155) ? PI : 1;
    scene.add(new T.HemisphereLight(0xffffff, 0xa6d884, 1.0 * LI));
    var sun = new T.DirectionalLight(0xfff0d0, 0.85 * LI);
    sun.position.set(10, 22, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
    scene.add(sun); scene.add(sun.target);

    /* ---------- helpers géométrie ---------- */
    function flat(g) { if (g.index) g = g.toNonIndexed(); g.computeVertexNormals(); return g; }
    var matCache = {};
    var toonGrad = (function () {
      var d = new T.DataTexture(new Uint8Array([105, 180, 255]), 3, 1, T.RedFormat || T.LuminanceFormat);
      d.minFilter = d.magFilter = T.NearestFilter; d.needsUpdate = true; return d;
    })();
    function M(c) { return matCache[c] || (matCache[c] = new T.MeshToonMaterial({ color: c, gradientMap: toonGrad })); }
    var G = {
      box: new T.BoxGeometry(1, 1, 1),
      s: new T.SphereGeometry(1, 16, 12),
      sl: new T.SphereGeometry(1, 10, 8),
      cyl: new T.CylinderGeometry(1, 1, 1, 14),
      cone: new T.ConeGeometry(1, 1, 12),
      ico: flat(new T.IcosahedronGeometry(1, 0)),
      oct: new T.OctahedronGeometry(1, 0),
      smile: new T.TorusGeometry(0.09, 0.02, 6, 12, PI),
      ring: new T.TorusGeometry(1, 0.12, 6, 16),
      cap: new T.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI * 0.55)
    };
    var eggG = new T.SphereGeometry(1, 12, 10); eggG.scale(0.2, 0.26, 0.2);
    var OUTM = new T.MeshBasicMaterial({ color: 0x2a1d33, side: T.BackSide });
    function add(parent, geo, col, x, y, z, sx, sy, sz, cast) {
      var m = new T.Mesh(geo, M(col));
      m.position.set(x || 0, y || 0, z || 0);
      m.scale.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz);
      if (cast) m.castShadow = true;
      parent.add(m); return m;
    }
    function box(p, w, h, d, c, x, y, z, cast) { return add(p, G.box, c, x, y, z, w, h, d, cast); }
    function ell(p, c, x, y, z, sx, sy, sz, cast) { return add(p, G.s, c, x, y, z, sx, sy, sz, cast); }
    function cyl(p, c, x, y, z, rx, h, rz, cast) { return add(p, G.cyl, c, x, y, z, rx, h, rz, cast); }
    function outline(m, k) { var o = new T.Mesh(m.geometry, OUTM); o.scale.setScalar(k || 1.07); m.add(o); return o; }

    /* ---------- étiquettes canvas ---------- */
    function mkTex(w, h) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      return { c: c, x: c.getContext('2d'), tex: new T.CanvasTexture(c) };
    }
    function rrPath(x, a, b, w, h, r) {
      x.beginPath(); x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r);
      x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h);
      x.quadraticCurveTo(a, b + h, a, b + h - r); x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
    }
    function mkSprite(L, w, h) {
      var s = new T.Sprite(new T.SpriteMaterial({ map: L.tex, transparent: true, depthTest: false, depthWrite: false }));
      s.scale.set(w, h, 1); s.renderOrder = 20; return s;
    }
    function txt(x, s, px, py, size, fill, stroke, align) {
      x.font = '800 ' + size + 'px ' + FONT; x.textAlign = align || 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      if (stroke) { x.lineWidth = size * 0.2; x.strokeStyle = stroke; x.strokeText(s, px, py); }
      x.fillStyle = fill; x.fillText(s, px, py);
    }
    function starPath(x, cx, cy, r, rot) {
      x.beginPath();
      for (var k = 0; k < 10; k++) { var rad = k % 2 ? r * 0.46 : r, a = (rot || 0) + k * PI / 5 - PI / 2; x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
      x.closePath();
    }
    function eggIcon(x, cx, cy, s, col, edge) {
      x.save(); x.translate(cx, cy); x.beginPath(); x.ellipse(0, 0, s * 0.78, s, 0, 0, PI * 2);
      x.fillStyle = col || '#fff6dc'; x.fill(); x.lineWidth = s * 0.14; x.strokeStyle = edge || '#c9a36a'; x.stroke();
      x.beginPath(); x.ellipse(-s * 0.28, -s * 0.38, s * 0.14, s * 0.26, 0.5, 0, PI * 2); x.fillStyle = 'rgba(255,255,255,.8)'; x.fill();
      x.restore();
    }
    function coinIcon(x, cx, cy, s) {
      x.beginPath(); x.arc(cx, cy, s, 0, PI * 2); x.fillStyle = '#ffcb2f'; x.fill();
      x.lineWidth = s * 0.2; x.strokeStyle = '#c98200'; x.stroke();
      x.beginPath(); x.arc(cx, cy, s * 0.55, 0, PI * 2); x.lineWidth = s * 0.1; x.strokeStyle = 'rgba(170,105,0,.6)'; x.stroke();
    }
    function drawIcon(x, id, cx, cy, s) {
      x.save(); x.translate(cx, cy); x.lineCap = 'round'; x.lineJoin = 'round';
      var i;
      if (id === 'hen') {
        x.fillStyle = '#fff'; x.strokeStyle = '#8a7a6a'; x.lineWidth = s * 0.07;
        x.beginPath(); x.ellipse(0, s * 0.15, s * 0.62, s * 0.5, 0, 0, PI * 2); x.fill(); x.stroke();
        x.beginPath(); x.arc(s * 0.35, -s * 0.35, s * 0.28, 0, PI * 2); x.fill(); x.stroke();
        x.fillStyle = '#e0443c'; x.beginPath(); x.arc(s * 0.35, -s * 0.66, s * 0.1, 0, PI * 2); x.fill();
        x.fillStyle = '#ff9d2f'; x.beginPath(); x.moveTo(s * 0.6, -s * 0.38); x.lineTo(s * 0.86, -s * 0.3); x.lineTo(s * 0.6, -s * 0.22); x.fill();
        x.fillStyle = '#2a1d33'; x.beginPath(); x.arc(s * 0.42, -s * 0.4, s * 0.05, 0, PI * 2); x.fill();
      } else if (id === 'incu') {
        eggIcon(x, 0, s * 0.28, s * 0.42, '#fff6dc');
        x.strokeStyle = '#ff7a2f'; x.lineWidth = s * 0.1;
        for (i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(i * s * 0.32, -s * 0.2); x.bezierCurveTo(i * s * 0.32 - s * 0.12, -s * 0.4, i * s * 0.32 + s * 0.12, -s * 0.5, i * s * 0.32, -s * 0.75); x.stroke(); }
      } else if (id === 'gold') {
        eggIcon(x, 0, s * 0.05, s * 0.6, '#ffd23a', '#c98200');
        x.fillStyle = '#fff'; starPath(x, s * 0.45, -s * 0.5, s * 0.22, 0.3); x.fill();
        starPath(x, -s * 0.5, -s * 0.3, s * 0.14, 0); x.fill();
      } else if (id === 'bag') {
        x.fillStyle = '#b9805a'; x.strokeStyle = '#6e4121'; x.lineWidth = s * 0.08;
        rrPath(x, -s * 0.55, -s * 0.35, s * 1.1, s * 0.95, s * 0.2); x.fill(); x.stroke();
        x.beginPath(); x.arc(0, -s * 0.35, s * 0.3, PI, 0); x.stroke();
        eggIcon(x, 0, s * 0.12, s * 0.3);
      } else if (id === 'speed') {
        x.fillStyle = '#6b4a2f'; x.strokeStyle = '#3b2616'; x.lineWidth = s * 0.07;
        x.beginPath(); x.moveTo(-s * 0.35, -s * 0.6); x.lineTo(s * 0.1, -s * 0.6); x.lineTo(s * 0.1, s * 0.1); x.lineTo(s * 0.62, s * 0.3);
        x.lineTo(s * 0.62, s * 0.58); x.lineTo(-s * 0.35, s * 0.58); x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = '#38d6f5'; x.lineWidth = s * 0.1;
        for (i = 0; i < 2; i++) { x.beginPath(); x.moveTo(-s * 0.9, -s * 0.2 + i * s * 0.35); x.lineTo(-s * 0.5, -s * 0.2 + i * s * 0.35); x.stroke(); }
      } else if (id === 'magnet') {
        x.strokeStyle = '#e0504a'; x.lineWidth = s * 0.3; x.beginPath(); x.arc(0, -s * 0.05, s * 0.45, PI, 0, false); x.lineTo(s * 0.45, s * 0.3); x.moveTo(-s * 0.45, -s * 0.05); x.lineTo(-s * 0.45, s * 0.3); x.stroke();
        x.strokeStyle = '#e8eef5'; x.lineWidth = s * 0.3; x.beginPath(); x.moveTo(-s * 0.45, s * 0.3); x.lineTo(-s * 0.45, s * 0.6); x.moveTo(s * 0.45, s * 0.3); x.lineTo(s * 0.45, s * 0.6); x.stroke();
      } else if (id === 'price') {
        coinIcon(x, 0, 0, s * 0.7); txt(x, '$', 0, s * 0.04, s * 0.9, '#a86b00');
      } else if (id === 'cashier') {
        x.fillStyle = '#5a6a8a'; rrPath(x, -s * 0.6, -s * 0.05, s * 1.2, s * 0.65, s * 0.1); x.fill();
        x.fillStyle = '#2a3550'; rrPath(x, -s * 0.45, -s * 0.55, s * 0.9, s * 0.45, s * 0.08); x.fill();
        txt(x, '$', 0, -s * 0.32, s * 0.4, '#4ddc8c');
        x.fillStyle = '#8be04e'; x.fillRect(-s * 0.4, s * 0.1, s * 0.8, s * 0.12);
      } else if (id === 'stalls') {
        for (i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#d94f4f'; x.fillRect(-s * 0.6 + i * s * 0.2, -s * 0.6, s * 0.2, s * 0.4); }
        x.fillStyle = '#d94f4f'; for (i = 0; i < 6; i += 2) { x.beginPath(); x.arc(-s * 0.5 + i * s * 0.2, -s * 0.2, s * 0.1, 0, PI); x.fill(); }
        x.fillStyle = '#b9805a'; x.fillRect(-s * 0.5, s * 0.15, s * 1.0, s * 0.45); x.fillRect(-s * 0.55, -s * 0.1, s * 0.08, s * 0.7); x.fillRect(s * 0.47, -s * 0.1, s * 0.08, s * 0.7);
      } else if (id === 'picker') {
        x.fillStyle = '#ffd5b0'; x.beginPath(); x.arc(0, -s * 0.28, s * 0.32, 0, PI * 2); x.fill();
        x.fillStyle = '#2a56c8'; x.beginPath(); x.arc(0, -s * 0.38, s * 0.34, PI, 0); x.fill(); x.fillRect(-s * 0.34, -s * 0.4, s * 0.68, s * 0.06);
        x.fillStyle = '#4f86ff'; rrPath(x, -s * 0.5, s * 0.12, s, s * 0.6, s * 0.2); x.fill();
      } else if (id === 'ads') {
        x.fillStyle = '#ff7ebd'; x.beginPath(); x.moveTo(-s * 0.55, -s * 0.2); x.lineTo(s * 0.3, -s * 0.65); x.lineTo(s * 0.3, s * 0.65); x.lineTo(-s * 0.55, s * 0.2); x.closePath(); x.fill();
        x.fillStyle = '#c9407f'; x.fillRect(-s * 0.7, -s * 0.2, s * 0.2, s * 0.4);
        x.strokeStyle = '#ff7ebd'; x.lineWidth = s * 0.1; for (i = 1; i <= 2; i++) { x.beginPath(); x.arc(s * 0.3, 0, s * 0.3 * i, -0.8, 0.8); x.stroke(); }
      } else if (id === 'serve') {
        x.fillStyle = '#fff'; x.strokeStyle = '#2b7fc7'; x.lineWidth = s * 0.14; x.beginPath(); x.arc(0, 0, s * 0.62, 0, PI * 2); x.fill(); x.stroke();
        x.strokeStyle = '#2b7fc7'; x.lineWidth = s * 0.12; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -s * 0.4); x.moveTo(0, 0); x.lineTo(s * 0.3, s * 0.12); x.stroke();
        x.fillStyle = '#ffcb2f'; x.beginPath(); x.arc(s * 0.55, -s * 0.5, s * 0.2, 0, PI * 2); x.fill();
      } else if (id === 'lock') {
        x.strokeStyle = '#7d7d99'; x.lineWidth = s * 0.16; x.beginPath(); x.arc(0, -s * 0.15, s * 0.3, PI, 0); x.stroke();
        x.fillStyle = '#9a9ab5'; rrPath(x, -s * 0.45, -s * 0.15, s * 0.9, s * 0.75, s * 0.14); x.fill();
        x.fillStyle = '#5d5d78'; x.beginPath(); x.arc(0, s * 0.17, s * 0.1, 0, PI * 2); x.fill(); x.fillRect(-s * 0.04, s * 0.17, s * 0.08, s * 0.25);
      } else if (id === 'check') {
        x.strokeStyle = '#2e9d57'; x.lineWidth = s * 0.22; x.beginPath(); x.moveTo(-s * 0.5, 0); x.lineTo(-s * 0.12, s * 0.4); x.lineTo(s * 0.55, -s * 0.4); x.stroke();
      }
      x.restore();
    }

    /* ---------- état / sauvegarde ---------- */
    var save = {};
    try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { save = {}; }
    var lv = { hen: 0, incu: 0, gold: 0, bag: 0, speed: 0, magnet: 0, price: 0, cashier: 0, serve: 0, stalls: 0, picker: 0, ads: 0 };
    if (save.lv) for (var k in lv) if (save.lv[k]) lv[k] = save.lv[k] | 0;
    var money = save.money > 0 ? save.money : 0, inflight = 0;
    var padProg = save.pad || {};
    var stats = { picked: 0, deposited: 0, sold: 0, served: 0, purchases: 0, gold: 0, earned: 0 };
    if (save.stats) for (var sk in stats) if (save.stats[sk]) stats[sk] = save.stats[sk];
    var qi = save.qi | 0, eqn = save.eqn | 0;
    var firstSale = stats.sold > 0, muted = !!save.muted;

    var STOCK_CAP = 40, MAX_GROUND = 40;
    var COUNTER = { x0: 7, x1: 25, z0: -2.5, z1: -0.5, cx: 16, cz: -1.5 };
    var DEPOT = { x: 11, z: 2.4 }, SELLP = { x: 20, z: 2.4 };
    var PEN = { x0: -29, x1: -15, z0: -6, z1: 4 }, GATE_Z = 0.4;
    var SLOT_X = [], ORD = [1, 3, 5, 7, 9, 11, 4, 6, 2, 8, 0, 10], SLOT_Z = -3.8, ROAD_Z = -6.6, LEAVE_Z = -7.6, QX0 = 29;
    for (var sxi = 0; sxi < 12; sxi++) SLOT_X.push(8.4 + sxi * 1.45);
    var BOUNDS = { x0: -31, x1: 33, z0: -12, z1: 12 };

    function henCount() { return 3 + lv.hen; }
    function bagCap() { return 6 + 4 * lv.bag; }
    function moveSpeed() { return 6.2 + 0.6 * lv.speed; }
    function eggPrice() { return 5 + 2 * lv.price; }
    function serviceFactor() { return Math.pow(0.85, lv.serve); }
    function sellTime() { return 1.2 * serviceFactor(); }                     // secondes par œuf servi (toi)
    function cashierTime() { return [99, 2.2, 1.5, 1.0][lv.cashier] * serviceFactor(); }
    function pickRadius() { return 1.25 + 0.55 * lv.magnet; }
    function goldChance() { return 0.04 + 0.04 * lv.gold; }
    function layFactor() { return Math.pow(0.85, lv.incu); }
    function activeSlots() { return ORD.slice(0, Math.min(12, 6 + lv.stalls)); }

    var NODES = [
      { id: 'hen', name: 'Poule', loc: 'Poulailler', col: '#ff8a5c', max: 10, x: -26, z: 2.4, desc: 'Une nouvelle poule pondeuse', cost: function (l) { return Math.round(25 * Math.pow(1.33, l)); }, req: [] },
      { id: 'incu', name: 'Couveuse', loc: 'Poulailler', col: '#ffb938', max: 5, x: -22, z: 2.4, desc: 'Les poules pondent plus vite', cost: function (l) { return Math.round(80 * Math.pow(1.9, l)); }, req: [['hen', 2]] },
      { id: 'gold', name: 'Nid doré', loc: 'Poulailler', col: '#ffd23a', max: 4, x: -18, z: 2.4, desc: 'Plus d’œufs dorés (valent ×5)', cost: function (l) { return Math.round(200 * Math.pow(2.1, l)); }, req: [['incu', 1]] },
      { id: 'bag', name: 'Grand sac', loc: 'Atelier', col: '#c58a5a', max: 5, x: -12, z: -8.8, desc: 'Porte plus d’œufs dans le dos', cost: function (l) { return Math.round(45 * Math.pow(1.8, l)); }, req: [['hen', 1]] },
      { id: 'speed', name: 'Bottes', loc: 'Atelier', col: '#38d6f5', max: 6, x: -8, z: -8.8, desc: 'Tu cours plus vite', cost: function (l) { return Math.round(40 * Math.pow(1.7, l)); }, req: [['bag', 1]] },
      { id: 'magnet', name: 'Aimant', loc: 'Atelier', col: '#e0504a', max: 4, x: -4, z: -8.8, desc: 'Ramasse les œufs de plus loin', cost: function (l) { return Math.round(120 * Math.pow(2.0, l)); }, req: [['speed', 2]] },
      { id: 'price', name: 'Prix', loc: 'Étal', col: '#ffcb2f', max: 8, x: 9, z: 8.2, desc: 'Les œufs se vendent plus cher', cost: function (l) { return Math.round(70 * Math.pow(1.6, l)); }, req: [['hen', 1]] },
      { id: 'cashier', name: 'Caissier', loc: 'Étal', col: '#8be04e', max: 3, x: 13.5, z: 8.2, desc: 'Vend les œufs tout seul', cost: function (l) { return Math.round(130 * Math.pow(2.3, l)); }, req: [['price', 1]] },
      { id: 'stalls', name: 'Places', loc: 'Étal', col: '#a66bff', max: 6, x: 22.5, z: 8.2, desc: 'Plus de clients en même temps', cost: function (l) { return Math.round(150 * Math.pow(2.0, l)); }, req: [['price', 2]] },
      { id: 'serve', name: 'Service', loc: 'Étal', col: '#38b6ff', max: 5, x: 18, z: 8.2, desc: 'Servir chaque client prend moins de temps', cost: function (l) { return Math.round(90 * Math.pow(1.8, l)); }, req: [['cashier', 1]] },
      { id: 'picker', name: 'Ramasseur', loc: 'Grange', col: '#4f86ff', max: 4, x: 6, z: -11.2, desc: 'Un employé ramasse et dépose les œufs', cost: function (l) { return Math.round(180 * Math.pow(2.2, l)); }, req: [['cashier', 1], ['hen', 3]] },
      { id: 'ads', name: 'Affiche', loc: 'Route', col: '#ff7ebd', max: 5, x: 29.5, z: -0.5, desc: 'Plus de clients arrivent', cost: function (l) { return Math.round(100 * Math.pow(1.9, l)); }, req: [['stalls', 1]] }
    ];
    var NODE = {}; NODES.forEach(function (n) { NODE[n.id] = n; });
    var LOCS = ['Poulailler', 'Atelier', 'Étal', 'Grange', 'Route'];
    function reqMet(n) { return n.req.every(function (r) { return lv[r[0]] >= r[1]; }); }
    function reqText(n) {
      for (var i = 0; i < n.req.length; i++) if (lv[n.req[i][0]] < n.req[i][1]) return NODE[n.req[i][0]].name + ' niv.' + n.req[i][1];
      return '';
    }
    function nodeState(n) { return !reqMet(n) ? 'locked' : (lv[n.id] >= n.max ? 'max' : 'open'); }

    var QUESTS = [
      { t: 'Ramasse 6 œufs', k: 'picked', n: 6, r: 10 },
      { t: 'Dépose 6 œufs sur le comptoir', k: 'deposited', n: 6, r: 10 },
      { t: 'Vends 6 œufs', k: 'sold', n: 6, r: 20 },
      { t: 'Achète ta 1ère amélioration', k: 'purchases', n: 1, r: 30 },
      { t: 'Sers 8 clients', k: 'served', n: 8, r: 40 },
      { t: 'Fais 4 achats', k: 'purchases', n: 4, r: 60 },
      { t: 'Ramasse un œuf doré', k: 'gold', n: 1, r: 80 },
      { t: 'Sers 25 clients', k: 'served', n: 25, r: 120 },
      { t: 'Aie 6 poules', k: 'hens', n: 6, r: 150 },
      { t: 'Engage ton 1er ramasseur', k: 'picker', n: 1, r: 200 },
      { t: 'Gagne 3000 pièces', k: 'earned', n: 3000, r: 400 },
      { t: 'Sers 80 clients', k: 'served', n: 80, r: 500 }
    ];
    function curQuest() {
      if (qi < QUESTS.length) return QUESTS[qi];
      if (!eqn || eqn <= stats.served) eqn = stats.served + 40;
      return { t: 'Sers ' + eqn + ' clients', k: 'served', n: eqn, r: 400 + 25 * (qi - QUESTS.length) };
    }
    function qVal(q) { return q.k === 'hens' ? henCount() : (q.k === 'picker' ? lv.picker : stats[q.k]); }
    function farmLevel() { return 1 + Math.floor(Math.sqrt(stats.earned / 60)); }

    function doSave() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ money: Math.floor(money), lv: lv, pad: padProg, stats: stats, qi: qi, eqn: eqn, muted: muted }));
      } catch (e) {}
    }

    /* ---------- HUD (DOM) ---------- */
    var css = document.createElement('style');
    css.textContent =
      '.fm-money{position:absolute;left:12px;top:12px;display:flex;align-items:center;gap:8px;background:linear-gradient(#fffdf2,#fff2c4);border:3px solid #ffcb2f;border-radius:999px;padding:4px 20px 4px 5px;font-weight:800;font-size:26px;color:#7a4a00;box-shadow:0 4px 0 rgba(120,80,0,.35);pointer-events:none}' +
      '.fm-coin{width:34px;height:34px;border-radius:50%;box-sizing:border-box;background:radial-gradient(circle at 35% 30%,#fff3a6,#ffcb2f 55%,#e09a00);border:3px solid #c98200;position:relative;flex:none}' +
      '.fm-coin:after{content:"";position:absolute;inset:6px;border-radius:50%;border:2px solid rgba(160,100,0,.45)}' +
      '.fm-bump{animation:fmbump .22s}@keyframes fmbump{50%{transform:scale(1.18)}}' +
      '.fm-lvl{position:absolute;left:14px;top:62px;display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.92);border-radius:999px;padding:3px 12px 3px 4px;font-weight:800;font-size:15px;color:#5b3d9e;box-shadow:0 3px 0 rgba(0,0,0,.18);pointer-events:none}' +
      '.fm-lvl .st{width:26px;height:26px;border-radius:50%;background:linear-gradient(#ffe36a,#ffb400);color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;text-shadow:0 1px 0 #b07a00;border:2px solid #fff}' +
      '.fm-lbar{width:70px;height:9px;border-radius:5px;background:rgba(91,61,158,.2);overflow:hidden}.fm-lbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#a66bff,#ff7ebd);transition:width .3s}' +
      '.fm-tc{position:absolute;left:50%;top:10px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:min(44%,440px)}' +
      '.fm-quest{position:absolute;left:12px;top:100px;width:min(46%,270px);box-sizing:border-box;background:rgba(255,255,255,.95);border:3px solid #a66bff;border-radius:16px;padding:5px 9px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 0 rgba(60,30,120,.3);pointer-events:none}' +
      '.fm-quest.done{animation:fmbump .4s}' +
      '.fm-qi{width:30px;height:30px;border-radius:50%;background:#a66bff;color:#fff;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;flex:none}' +
      '.fm-qb{flex:1;min-width:0}.fm-qt{font-weight:800;font-size:13px;color:#4a3a7a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.fm-qbar{height:11px;border-radius:6px;background:rgba(166,107,255,.2);overflow:hidden;margin-top:3px;position:relative}.fm-qbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#8be04e,#38d6f5);transition:width .25s}' +
      '.fm-qr{display:flex;align-items:center;gap:3px;font-weight:800;font-size:15px;color:#a86b00;flex:none}.fm-qr .fm-coin{width:20px;height:20px;border-width:2px}.fm-qr .fm-coin:after{inset:3px;border-width:1px}' +
      '.fm-toast{background:#4a3a7a;color:#fff;font-weight:800;font-size:15px;padding:7px 16px;border-radius:999px;box-shadow:0 4px 0 rgba(0,0,0,.25);animation:fmtoast 2.8s forwards;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
      '.fm-toast.good{background:linear-gradient(#5be08e,#2ebd6a)}.fm-toast.gold{background:linear-gradient(#ffd54a,#ff9f1c);color:#5a3500}.fm-toast.bad{background:linear-gradient(#ff7a72,#e0504a)}' +
      '@keyframes fmtoast{0%{transform:translateY(-14px) scale(.8);opacity:0}8%{transform:none;opacity:1}85%{opacity:1}100%{opacity:0;transform:translateY(-6px)}}' +
      '.fm-btns{position:absolute;right:12px;top:12px;display:flex;gap:8px;pointer-events:auto}' +
      '.fm-btn{position:relative;width:46px;height:46px;border-radius:15px;background:#fff;border:0;box-shadow:0 4px 0 rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}' +
      '.fm-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.22)}.fm-btn.shop{background:linear-gradient(#ffe36a,#ffb400)}' +
      '.fm-badge{position:absolute;right:-6px;top:-6px;min-width:22px;height:22px;border-radius:11px;background:#ff4d5e;color:#fff;font-weight:800;font-size:13px;display:none;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;padding:0 4px;animation:fmbump .9s infinite}' +
      '.fm-bl{position:absolute;left:12px;bottom:12px;display:flex;gap:8px;pointer-events:none}' +
      '.fm-chip{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.93);border-radius:999px;padding:4px 14px 4px 6px;font-weight:800;font-size:17px;color:#7a4a00;box-shadow:0 3px 0 rgba(0,0,0,.2)}' +
      '.fm-ppl{width:22px;height:26px;position:relative;flex:none}.fm-ppl:before{content:"";position:absolute;left:6px;top:0;width:10px;height:10px;border-radius:50%;background:#e8453c;border:2px solid #7a4a00;box-sizing:content-box}.fm-ppl:after{content:"";position:absolute;left:2px;top:14px;width:18px;height:12px;border-radius:9px 9px 3px 3px;background:#4f86ff;border:2px solid #7a4a00;box-sizing:content-box;margin-left:-2px}' +
      '.fm-egg{width:20px;height:25px;background:#fff6dc;border:3px solid #c9a36a;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;box-sizing:border-box}' +
      '.fm-hint{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(255,255,255,.96);border:3px solid #ffcb2f;border-radius:999px;padding:8px 20px;font-weight:800;font-size:18px;color:#5b3d9e;box-shadow:0 4px 0 rgba(0,0,0,.2);pointer-events:none;transition:opacity .3s;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}' +
      '.fm-rush{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:linear-gradient(#ff7a72,#e0504a);color:#fff;font-weight:800;font-size:19px;padding:6px 20px;border-radius:999px;border:3px solid #fff;box-shadow:0 4px 0 rgba(0,0,0,.25);display:none;pointer-events:none;animation:fmbump .6s infinite;text-shadow:0 2px 0 rgba(0,0,0,.25)}' +
      '.fm-float{position:absolute;pointer-events:none;font-weight:800;font-size:22px;color:#fff;text-shadow:0 2px 0 #b07a00,0 0 6px rgba(0,0,0,.4);animation:fmfloat .95s ease-out forwards;white-space:nowrap}' +
      '@keyframes fmfloat{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}20%{transform:translate(-50%,-80%) scale(1.15);opacity:1}100%{transform:translate(-50%,-190%) scale(1);opacity:0}}' +
      '.fm-fcoin{position:absolute;width:22px;height:22px;border-radius:50%;box-sizing:border-box;background:radial-gradient(circle at 35% 30%,#fff3a6,#ffcb2f 55%,#e09a00);border:2px solid #c98200;pointer-events:none}' +
      '.fm-joy{position:absolute;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;background:rgba(255,255,255,.22);border:3px solid rgba(255,255,255,.55);pointer-events:none;display:none}' +
      '.fm-knob{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:rgba(255,255,255,.88);box-shadow:0 3px 0 rgba(0,0,0,.2)}' +
      '.fm-shop{position:absolute;inset:0;background:rgba(30,20,70,.55);display:none;align-items:center;justify-content:center;pointer-events:auto;z-index:5}' +
      '.fm-sc{width:min(94%,640px);max-height:88%;background:#fff8e8;border:4px solid #ffcb2f;border-radius:24px;box-shadow:0 8px 0 rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden}' +
      '.fm-sh{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 10px 20px;background:linear-gradient(#ffe36a,#ffb400);font-weight:800;font-size:24px;color:#6b3f00}' +
      '.fm-x{width:38px;height:38px;border-radius:12px;border:0;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
      '.fm-sl{overflow-y:auto;padding:8px 12px 14px;-webkit-overflow-scrolling:touch}' +
      '.fm-loc{font-weight:800;font-size:15px;color:#a86b00;margin:10px 4px 6px;text-transform:uppercase;letter-spacing:1px}' +
      '.fm-card{display:flex;align-items:center;gap:10px;background:#fff;border:3px solid var(--c);border-radius:16px;padding:7px 10px;margin-bottom:7px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.12)}' +
      '.fm-card:active{transform:translateY(2px)}.fm-card.lk{background:#ececf4;border-color:#b5b5cc;filter:grayscale(.5)}.fm-card.mx{border-color:#4ddc8c}' +
      '.fm-ci{width:52px;height:52px;border-radius:14px;background:var(--c);display:flex;align-items:center;justify-content:center;flex:none}.fm-card.lk .fm-ci{background:#b5b5cc}' +
      '.fm-cb{flex:1;min-width:0}.fm-cn{font-weight:800;font-size:18px;color:#4a3a7a}.fm-cd{font-weight:600;font-size:13px;color:#7d6d9e;line-height:1.15}' +
      '.fm-pips{display:flex;gap:3px;margin-top:4px}.fm-pips i{width:10px;height:10px;border-radius:50%;background:rgba(0,0,0,.14)}.fm-pips i.on{background:var(--c)}' +
      '.fm-cp{font-weight:800;font-size:17px;color:#7a4a00;display:flex;align-items:center;gap:4px;flex:none;text-align:right}.fm-cp .fm-coin{width:22px;height:22px;border-width:2px}.fm-cp .fm-coin:after{inset:4px;border-width:1px}.fm-cp.ok{color:#2e9d57}.fm-cp.req{font-size:13px;color:#8a6a9a;max-width:96px;line-height:1.1}' +
      '@media (max-width:520px){.fm-tc{width:min(56%,300px)}.fm-money{font-size:21px}.fm-lvl{top:56px}.fm-btn{width:42px;height:42px}.fm-hint{font-size:15px}}';
    root.appendChild(css);
    var hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;';
    root.appendChild(hud);
    function el(cls, html, parent) { var d = document.createElement('div'); d.className = cls; if (html) d.innerHTML = html; (parent || hud).appendChild(d); return d; }

    var moneyBox = el('fm-money', '<div class="fm-coin"></div><span>0</span>');
    var coinEl = moneyBox.firstChild, moneyTxt = moneyBox.lastChild;
    var lvlBox = el('fm-lvl', '<div class="st">★</div><span>Niv. 1</span><div class="fm-lbar"><i></i></div>');
    var lvlTxt = lvlBox.children[1], lvlBar = lvlBox.children[2].firstChild;
    var tc = el('fm-tc');
    var questBox = el('fm-quest', '<div class="fm-qi">!</div><div class="fm-qb"><div class="fm-qt"></div><div class="fm-qbar"><i></i></div></div><div class="fm-qr"><div class="fm-coin"></div><span></span></div>');
    var qText = questBox.children[1].children[0], qBar = questBox.children[1].children[1].firstChild, qRew = questBox.children[2].lastChild;
    var rushEl = el('fm-rush', 'HEURE DE POINTE ! ×2');
    var btnBox = el('fm-btns');
    var bl = el('fm-bl');
    var stockChip = el('fm-chip', '<div class="fm-egg"></div><span>0/40</span>', bl);
    var stockTxt = stockChip.lastChild;
    var custChip = el('fm-chip', '<div class="fm-ppl"></div><span>0</span>', bl), custTxt = custChip.lastChild;
    var hintEl = el('fm-hint'); hintEl.style.opacity = '0';
    var joy = el('fm-joy'); var knob = el('fm-knob', '', joy);

    function svg(inner, w) { return '<svg width="' + (w || 26) + '" height="' + (w || 26) + '" viewBox="0 0 24 24" fill="none" stroke="#3a3590" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
    function sndSvg() { return svg('<path d="M4 9v6h4l5 4V5L8 9z" fill="#3a3590"/>' + (muted ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>')); }
    function fsSvg(inw) { return svg(inw ? '<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/>' : '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>'); }
    var shopSvg = svg('<path d="M3 9l1.6-5h14.8L21 9a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0z" fill="#fff"/><path d="M5 12.5V20h14v-7.5"/><path d="M10 20v-4h4v4"/>', 28);
    var shopBtn = document.createElement('button'); shopBtn.className = 'fm-btn shop'; shopBtn.innerHTML = shopSvg + '<div class="fm-badge"></div>';
    var badge = shopBtn.lastChild;
    var sndBtn = document.createElement('button'); sndBtn.className = 'fm-btn'; sndBtn.innerHTML = sndSvg();
    var fsBtn = document.createElement('button'); fsBtn.className = 'fm-btn'; fsBtn.innerHTML = fsSvg(false);
    btnBox.appendChild(shopBtn); btnBox.appendChild(sndBtn); btnBox.appendChild(fsBtn);

    function fmt(n) { n = Math.floor(n); return n >= 100000 ? (n / 1000).toFixed(0) + 'k' : (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n)); }
    function updateMoneyHud() { moneyTxt.textContent = fmt(money - inflight); }
    function bump() { updateMoneyHud(); moneyBox.classList.remove('fm-bump'); void moneyBox.offsetWidth; moneyBox.classList.add('fm-bump'); }
    updateMoneyHud();
    function toast(s, kind) {
      var t = el('fm-toast' + (kind ? ' ' + kind : ''), '', tc); t.textContent = s;
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2900);
      while (tc.children.length > 3) tc.removeChild(tc.children[0]);
    }
    var farmLv = farmLevel();
    function updateLevelHud() {
      var L = farmLevel(), lo = 60 * (L - 1) * (L - 1), hi = 60 * L * L;
      lvlTxt.textContent = 'Niv. ' + L; lvlBar.style.width = Math.max(0, Math.min(100, (stats.earned - lo) / (hi - lo) * 100)) + '%';
    }
    function updateQuestHud() {
      var q = curQuest(), v = Math.min(q.n, qVal(q));
      qText.textContent = q.t + ' (' + fmt(v) + '/' + fmt(q.n) + ')'; qBar.style.width = (v / q.n * 100) + '%'; qRew.textContent = '+' + q.r;
    }
    function updateStockHud() { stockTxt.textContent = stockCount + '/' + STOCK_CAP; }

    var tmpV = new T.Vector3();
    function toScreen(v) {
      tmpV.copy(v).project(camera);
      return { x: (tmpV.x * 0.5 + 0.5) * root.clientWidth, y: (-tmpV.y * 0.5 + 0.5) * root.clientHeight };
    }
    function floatAt(sx, sy, s, col) {
      var e = el('fm-float', '', hud); e.textContent = s; e.style.left = sx + 'px'; e.style.top = sy + 'px'; if (col) e.style.color = col;
      setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1000);
    }
    function floatText(v, s, col) { var p = toScreen(v); floatAt(p.x, p.y, s, col); }
    function flyCoinAt(sx, sy, amount) {
      inflight += amount;
      var e = el('fm-fcoin', '', hud); e.style.left = (sx - 11) + 'px'; e.style.top = (sy - 11) + 'px';
      var tr = coinEl.getBoundingClientRect(), rr = root.getBoundingClientRect();
      var tx = tr.left - rr.left + tr.width / 2 - sx, ty = tr.top - rr.top + tr.height / 2 - sy, dur = 520 + rand() * 200, finished = false;
      function done() { if (finished) return; finished = true; if (e.parentNode) e.parentNode.removeChild(e); inflight -= amount; bump(); }
      if (e.animate) {
        var a = e.animate([
          { transform: 'translate(0,0) scale(.6)', offset: 0 },
          { transform: 'translate(' + (rand() * 30 - 15) + 'px,-36px) scale(1.2)', offset: 0.28 },
          { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.8)', offset: 1 }
        ], { duration: dur, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
        a.onfinish = done;
      }
      setTimeout(done, dur + 80);
    }
    function addMoney(amount, v, label) {
      money += amount; stats.earned += amount;
      var p = toScreen(v); flyCoinAt(p.x, p.y, amount); floatAt(p.x, p.y, label || ('+' + amount));
    }
    function addMoneyScreen(amount, sx, sy, label) {
      money += amount; stats.earned += amount; flyCoinAt(sx, sy, amount); floatAt(sx, sy + 20, label || ('+' + amount), '#fff6a8');
    }

    /* ---------- son ---------- */
    var ac = null, combo = 0, comboT = 0;
    function initAudio() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    function tone(f, dur, type, vol, slide, delay) {
      if (muted || !ac) return;
      try {
        var o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + (delay || 0);
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
        g.gain.setValueAtTime(vol || 0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.03);
      } catch (e) {}
    }
    function comboF(base) { return base * Math.pow(1.06, Math.min(combo, 16)); }
    function hit() { combo++; comboT = 0.8; }
    var sfx = {
      pick: function () { hit(); tone(comboF(430), 0.1, 'sine', 0.16, comboF(430) * 1.5); },
      drop: function () { hit(); tone(comboF(330), 0.09, 'triangle', 0.16, comboF(330) * 0.8); },
      coin: function () { tone(1040, 0.09, 'square', 0.05); tone(1560, 0.16, 'square', 0.05, null, 0.07); },
      lay: function () { tone(520, 0.14, 'sawtooth', 0.04, 300); tone(300, 0.1, 'sine', 0.12, 150, 0.12); },
      pad: function (p) { tone(380 + p * 520, 0.06, 'triangle', 0.08); },
      buy: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.14, null, i * 0.07); }); },
      unlock: function () { [784, 988, 1175].forEach(function (f, i) { tone(f, 0.18, 'sine', 0.12, null, i * 0.09); }); },
      quest: function () { [659, 784, 988, 1319].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.13, null, i * 0.08); }); },
      happy: function () { tone(784, 0.12, 'sine', 0.12); tone(1175, 0.2, 'sine', 0.12, null, 0.09); },
      horn: function () { tone(330, 0.5, 'sawtooth', 0.07, 300); tone(415, 0.5, 'sawtooth', 0.06, 400); },
      bad: function () { tone(200, 0.2, 'square', 0.05, 120); },
      pop: function () { tone(700, 0.07, 'sine', 0.1, 1000); }
    };
    function vib(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

    /* =================================================================
       MONDE
       ================================================================= */
    var solids = [];
    function solid(x0, x1, z0, z1) { solids.push({ x0: x0, x1: x1, z0: z0, z1: z1 }); }
    function patch(x, z, w, d, col, y, parent) {
      var m = new T.Mesh(G.box, M(col)); m.scale.set(w, 0.05, d); m.position.set(x, y || 0.02, z); m.receiveShadow = true; (parent || scene).add(m); return m;
    }

    /* sol : pelouse tondue en bandes */
    (function buildGround() {
      var g = new T.PlaneGeometry(220, 120, 110, 60); g.rotateX(-PI / 2); g = g.toNonIndexed();
      var n = g.attributes.position.count, cols = new Float32Array(n * 3), r = rng(3);
      var a = new T.Color('#84e05a'), b = new T.Color('#6fcb4b');
      for (var q = 0; q < n / 6; q++) {
        var qx = q % 110, qz = Math.floor(q / 110);
        var tt = 0.5 + 0.5 * Math.sin(qx * 0.21) * Math.cos(qz * 0.29);
        var c = a.clone().lerp(b, tt * 0.85).offsetHSL(0, 0, (r() - 0.5) * 0.012);
        for (var v = 0; v < 6; v++) { cols[(q * 6 + v) * 3] = c.r; cols[(q * 6 + v) * 3 + 1] = c.g; cols[(q * 6 + v) * 3 + 2] = c.b; }
      }
      g.setAttribute('color', new T.BufferAttribute(cols, 3));
      g.computeVertexNormals();
      var m = new T.Mesh(g, new T.MeshToonMaterial({ vertexColors: true, gradientMap: toonGrad }));
      m.receiveShadow = true; scene.add(m);
    })();
    patch((PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2, PEN.x1 - PEN.x0, PEN.z1 - PEN.z0, '#e6c777', 0.03);
    patch(16, -1.0, 21, 9.6, '#e9dcc0', 0.03);          // place pavée de l'étal
    patch(16, -1.0, 21.4, 0.12, '#cdb98f', 0.035);
    patch(42, ROAD_Z, 56, 5.2, '#dcc08f', 0.03);          // route de terre
    patch(16, -5.6, 21, 5, '#dcc08f', 0.035);
    for (var si = 0; si < 22; si++) {                        // pas japonais du poulailler à l'étal
      var st = cyl(scene, '#cbbd9d', -13 + si * 1.15, 0.04, 0.5 + si * 0.09, 0.38, 0.06, 0.38); st.receiveShadow = true;
    }

    /* arbres, buissons, fleurs */
    function tree(x, z, s, near) {
      var g = new T.Group(); g.position.set(x, 0, z); s = s || 1;
      cyl(g, '#8a5a34', 0, 0.7 * s, 0, 0.26 * s, 1.4 * s, 0.26 * s, true);
      var gc = ['#3fae4e', '#4cc15a', '#5ad067'];
      ell(g, gc[0], 0, 2.0 * s, 0, 1.25 * s, 1.0 * s, 1.25 * s, true);
      ell(g, gc[1], 0.35 * s, 2.7 * s, 0.2 * s, 1.0 * s, 0.85 * s, 1.0 * s, true);
      ell(g, gc[2], -0.3 * s, 3.2 * s, -0.1 * s, 0.75 * s, 0.7 * s, 0.75 * s, true);
      if (near) g.children.slice().forEach(function (ch) { if (ch.scale.x > 0.5) outline(ch, 1.07); });
      g.rotation.y = rand() * 6; scene.add(g);
    }
    function pine(x, z, s) {
      var g = new T.Group(); g.position.set(x, 0, z); s = s || 1;
      cyl(g, '#7a4e2c', 0, 0.5 * s, 0, 0.2 * s, 1.0 * s, 0.2 * s, true);
      add(g, G.cone, '#2f9e55', 0, 1.7 * s, 0, 1.1 * s, 1.6 * s, 1.1 * s, true);
      add(g, G.cone, '#38b062', 0, 2.6 * s, 0, 0.85 * s, 1.4 * s, 0.85 * s, true);
      add(g, G.cone, '#44c46e', 0, 3.4 * s, 0, 0.55 * s, 1.1 * s, 0.55 * s, true);
      scene.add(g);
    }
    function bush(x, z, s, col) {
      var g = new T.Group(); g.position.set(x, 0, z); s = s || 1; col = col || '#46b84f';
      ell(g, col, 0, 0.35 * s, 0, 0.6 * s, 0.45 * s, 0.55 * s, true); ell(g, '#52c95b', 0.45 * s, 0.3 * s, 0.1 * s, 0.4 * s, 0.35 * s, 0.4 * s, true); ell(g, '#3da846', -0.4 * s, 0.28 * s, -0.05 * s, 0.38 * s, 0.32 * s, 0.38 * s, true);
      if (rand() < 0.5) for (var i = 0; i < 4; i++) ell(g, ['#ff7ebd', '#ffd93d', '#ffffff'][i % 3], (rand() - 0.5) * 0.9 * s, 0.4 * s + rand() * 0.3 * s, 0.4 * s, 0.07, 0.07, 0.07);
      g.children.slice().forEach(function (ch) { if (ch.scale.x > 0.3) outline(ch, 1.09); });
      scene.add(g);
    }
    var rs = rng(7);
    for (var ti = 0; ti < 190; ti++) {
      var tx = -90 + rs() * 180, tz = -42 + rs() * 80;
      if (tx > -36 && tx < 38 && tz > -22 && tz < 16) continue;
      if (rs() < 0.3) pine(tx, tz, 0.9 + rs() * 0.7); else tree(tx, tz, 0.9 + rs() * 0.7);
    }
    tree(-33, 8, 1.1, 1); tree(-33, -4, 1.0, 1); tree(35.5, 5, 1.1, 1); tree(35, -2, 0.9, 1); tree(32, 13.5, 1.0, 1); tree(-26, 13.5, 1.0, 1); tree(3, 14.5, 0.9, 1); tree(14, 15, 1.1, 1); tree(25, 14.5, 1.0, 1); tree(-8, 14, 1.0, 1);
    [[-30, 7], [-30.5, -2], [33, 8], [33.5, 1.5], [-3, 12.3], [18, 12.8], [-14, 12.6], [31, -9], [5, 12.5], [28, 12.4]].forEach(function (b) { bush(b[0], b[1], 1 + rand() * 0.5); });
    var flowerCols = ['#ff7ebd', '#ffd93d', '#ffffff', '#ff8a5c', '#a66bff'];
    for (var fi = 0; fi < 150; fi++) {
      var fx = -31 + rs() * 64, fz = -11 + rs() * 24;
      if (fx > PEN.x0 - 1 && fx < PEN.x1 + 1 && fz > PEN.z0 - 1 && fz < PEN.z1 + 1) continue;
      if (fz > -9 && fz < 5.5 && fx > 5 && fx < 28) continue;
      if (NODES.some(function (nn) { return Math.hypot(fx - nn.x, fz - nn.z) < 2.6; }) || Math.hypot(fx - DEPOT.x, fz - DEPOT.z) < 2.6 || Math.hypot(fx - SELLP.x, fz - SELLP.z) < 2.6) continue;
      if (fz > 0.3 && fz < 1.5 && fx > -15 && fx < 12) continue;
      var fl = new T.Group(); fl.position.set(fx, 0, fz);
      cyl(fl, '#4aa845', 0, 0.12, 0, 0.02, 0.24, 0.02);
      ell(fl, flowerCols[fi % 5], 0, 0.28, 0, 0.1, 0.07, 0.1); ell(fl, '#ffe14d', 0, 0.3, 0, 0.04, 0.04, 0.04);
      scene.add(fl);
    }
    [[-55, -42, 14], [-22, -46, 17], [14, -44, 15], [48, -42, 14], [78, -38, 13], [-82, -34, 13]].forEach(function (h, i) {
      ell(scene, i % 2 ? '#62b845' : '#70c64e', h[0], -h[2] * 0.35, h[1], h[2] * 1.6, h[2], h[2] * 1.3);
    });

    /* grange, silo, tracteur, moulin */
    var barnSign;
    (function barn() {
      var g = new T.Group(); g.position.set(6, 0, -17);
      outline(box(g, 9, 4.2, 6, '#e0504a', 0, 2.1, 0, true), 1.03);
      box(g, 9.3, 0.25, 6.3, '#fff', 0, 4.2, 0);
      var rf1 = box(g, 5.6, 0.4, 6.8, '#9a6a3c', -2.0, 5.55, 0, true); rf1.rotation.z = 0.72;
      var rf2 = box(g, 5.6, 0.4, 6.8, '#9a6a3c', 2.0, 5.55, 0, true); rf2.rotation.z = -0.72;
      box(g, 3.2, 3.2, 0.2, '#fff', 0, 1.65, 3.05); box(g, 2.8, 2.8, 0.22, '#c43d3d', 0, 1.65, 3.07);
      var x1 = box(g, 0.2, 3.6, 0.24, '#fff', 0, 1.65, 3.12); x1.rotation.z = 0.75; var x2 = box(g, 0.2, 3.6, 0.24, '#fff', 0, 1.65, 3.12); x2.rotation.z = -0.75;
      box(g, 1.3, 1.1, 0.2, '#fff', 0, 3.6, 3.05); box(g, 1.0, 0.8, 0.22, '#5a3a22', 0, 3.6, 3.07);
      scene.add(g);
      var s = new T.Group(); s.position.set(13, 0, -18);
      cyl(s, '#dfe6f2', 0, 3.4, 0, 1.4, 6.8, 1.4, true); ell(s, '#c0453f', 0, 6.8, 0, 1.45, 1.0, 1.45, true); scene.add(s);
      var tr = new T.Group(); tr.position.set(19, 0, -15); tr.rotation.y = -0.5;
      box(tr, 2.2, 1.0, 1.2, '#e0504a', 0, 1.1, 0, true); box(tr, 1.0, 1.2, 1.1, '#e0504a', -0.4, 2.0, 0, true); box(tr, 0.9, 0.9, 1.0, '#cfe9ff', -0.4, 2.2, 0);
      [[0.8, 0.8, 0.8], [0.8, 0.8, -0.8]].forEach(function (w) { var wh = cyl(tr, '#2a2a33', w[0], w[1], w[2], 0.7, 0.35, 0.7, true); wh.rotation.x = PI / 2; });
      [[-0.9, 0.55, 0.7], [-0.9, 0.55, -0.7]].forEach(function (w) { var wh = cyl(tr, '#2a2a33', w[0], w[1], w[2], 0.45, 0.3, 0.45, true); wh.rotation.x = PI / 2; });
      scene.add(tr);
    })();
    var mill = new T.Group(), blades = new T.Group();
    (function windmill() {
      mill.position.set(-40, 0, -16);
      cyl(mill, '#f4ead6', 0, 3.2, 0, 1.4, 6.4, 1.4, true);
      add(mill, G.cone, '#c4543a', 0, 7.1, 0, 1.8, 1.6, 1.8, true);
      blades.position.set(0, 6.0, 1.5);
      for (var i = 0; i < 4; i++) {
        var arm = new T.Group(); arm.rotation.z = i * PI / 2; box(arm, 0.7, 3.4, 0.12, '#fff', 0, 1.8, 0); blades.add(arm);
      }
      ell(blades, '#8a5a34', 0, 0, 0, 0.3, 0.3, 0.3);
      mill.add(blades); scene.add(mill);
    })();
    var clouds = [];
    for (var ci = 0; ci < 9; ci++) {
      var cg = new T.Group(); cg.position.set(-90 + ci * 22, 18 + (ci % 3) * 2, -24 + (ci % 2) * 16);
      ell(cg, '#fff', 0, 0, 0, 3, 1.3, 2); ell(cg, '#fff', 2.4, -0.2, 0.3, 2.2, 1.1, 1.6); ell(cg, '#fff', -2.4, -0.2, -0.2, 2, 1, 1.5); ell(cg, '#fff', 0.5, 0.7, 0, 1.8, 1, 1.3);
      scene.add(cg); clouds.push(cg);
    }

    /* poulailler : enclos, maison, foin, abreuvoir */
    var heatLamp = null, goldNest = null;
    (function pen() {
      var g = new T.Group(), h = 0.85;
      function rail(x0, z0, x1, z1) {
        var len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        [0.3, 0.62].forEach(function (y) { var r = box(g, 0.14, 0.14, len, '#d19a5e', mx, y, mz, true); r.rotation.y = a; });
        var n = Math.max(1, Math.round(len / 1.5));
        for (var i = 0; i <= n; i++) {
          var px = x0 + (x1 - x0) * i / n, pz = z0 + (z1 - z0) * i / n;
          box(g, 0.24, h, 0.24, '#b57a42', px, h / 2, pz, true); ell(g, '#d19a5e', px, h + 0.02, pz, 0.15, 0.1, 0.15);
        }
        solid(Math.min(x0, x1) - 0.12, Math.max(x0, x1) + 0.12, Math.min(z0, z1) - 0.12, Math.max(z0, z1) + 0.12);
      }
      rail(PEN.x0, PEN.z0, PEN.x1, PEN.z0); rail(PEN.x0, PEN.z1, PEN.x1, PEN.z1); rail(PEN.x0, PEN.z0, PEN.x0, PEN.z1);
      rail(PEN.x1, PEN.z0, PEN.x1, GATE_Z - 1.0); rail(PEN.x1, GATE_Z + 1.0, PEN.x1, PEN.z1);
      scene.add(g);
      // maison des poules
      var co = new T.Group(); co.position.set(PEN.x0 + 2.6, 0, PEN.z0 + 1.9);
      outline(box(co, 3.6, 1.9, 2.6, '#e0504a', 0, 0.95, 0, true), 1.05); box(co, 3.8, 0.2, 2.8, '#fff', 0, 0.05, 0);
      var a1 = box(co, 2.3, 0.22, 3.0, '#9a6a3c', -0.9, 2.35, 0, true); a1.rotation.z = 0.6;
      var a2 = box(co, 2.3, 0.22, 3.0, '#9a6a3c', 0.9, 2.35, 0, true); a2.rotation.z = -0.6;
      box(co, 0.9, 1.0, 0.1, '#3b2340', 0, 0.6, 1.31); box(co, 1.0, 0.16, 0.5, '#d19a5e', 0, 0.12, 1.55);
      ell(co, '#ffe14d', 1.2, 1.3, 1.32, 0.3, 0.3, 0.06); ell(co, '#ffe14d', -1.2, 1.3, 1.32, 0.3, 0.3, 0.06);
      scene.add(co); solid(co.position.x - 1.9, co.position.x + 1.9, co.position.z - 1.4, co.position.z + 1.4);
      var cs = mkTex(384, 110), x = cs.x;
      rrPath(x, 4, 4, 376, 102, 30); x.fillStyle = '#fff3d1'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#e0504a'; x.stroke();
      drawIcon(x, 'hen', 58, 56, 34); txt(x, 'POULAILLER', 232, 58, 52, '#e0504a', '#fff');
      var cpl = new T.Mesh(new T.PlaneGeometry(3.2, 0.92), new T.MeshBasicMaterial({ map: cs.tex, transparent: true })); cpl.position.set(0, 3.55, 1.45); co.add(cpl);
      // foin, abreuvoir, mangeoire
      [[PEN.x1 - 1.4, PEN.z0 + 1.2], [PEN.x1 - 2.8, PEN.z0 + 1.0], [PEN.x0 + 1.0, PEN.z1 - 1.4]].forEach(function (p) {
        var hb = cyl(scene, '#eecb62', p[0], 0.42, p[1], 0.56, 0.48, 0.56, true); hb.rotation.z = PI / 2; hb.rotation.y = rand() * 3;
        var hb2 = cyl(scene, '#c99a3a', p[0], 0.42, p[1], 0.575, 0.06, 0.575); hb2.rotation.z = PI / 2; hb2.rotation.y = hb.rotation.y;
        solid(p[0] - 0.65, p[0] + 0.65, p[1] - 0.65, p[1] + 0.65);
      });
      var tg = new T.Group(); tg.position.set(PEN.x1 - 1.4, 0, PEN.z1 - 1.4);
      box(tg, 1.8, 0.4, 0.7, '#b57a42', 0, 0.2, 0, true); box(tg, 1.5, 0.08, 0.45, '#5ec8ff', 0, 0.4, 0); scene.add(tg); solid(tg.position.x - 0.95, tg.position.x + 0.95, tg.position.z - 0.45, tg.position.z + 0.45);
      // lampe chauffante (apparaît avec la couveuse)
      heatLamp = new T.Group(); heatLamp.position.set(PEN.x0 + 5, 0, PEN.z0 + 3);
      cyl(heatLamp, '#8a5a34', 0, 1.2, 0, 0.07, 2.4, 0.07, true); box(heatLamp, 0.9, 0.08, 0.08, '#8a5a34', 0.35, 2.35, 0);
      var bulb = ell(heatLamp, '#ffb347', 0.7, 2.1, 0, 0.22, 0.22, 0.22); bulb.material = new T.MeshBasicMaterial({ color: 0xffc766 });
      var shade = add(heatLamp, G.cone, '#d94f4f', 0.7, 2.35, 0, 0.3, 0.2, 0.3); shade.rotation.x = PI;
      heatLamp.visible = false; scene.add(heatLamp);
      // nid doré
      goldNest = new T.Group(); goldNest.position.set(PEN.x1 - 3.2, 0, PEN.z1 - 1.0);
      cyl(goldNest, '#e8c25a', 0, 0.15, 0, 0.7, 0.3, 0.7, true);
      var ge = new T.Mesh(eggG, new T.MeshLambertMaterial({ color: '#ffd23a', emissive: '#8a5a00' })); ge.position.set(0, 0.45, 0); ge.scale.setScalar(1.6); goldNest.add(ge);
      goldNest.visible = false; scene.add(goldNest);
    })();

    /* atelier (cabane à outils) */
    (function shed() {
      var g = new T.Group(); g.position.set(-8, 0, -13);
      outline(box(g, 6.0, 2.6, 3.4, '#4f86ff', 0, 1.3, 0, true), 1.04); box(g, 6.3, 0.2, 3.7, '#fff', 0, 2.65, 0);
      var a1 = box(g, 3.5, 0.25, 3.9, '#c0453f', -1.5, 3.3, 0, true); a1.rotation.z = 0.45; var a2 = box(g, 3.5, 0.25, 3.9, '#c0453f', 1.5, 3.3, 0, true); a2.rotation.z = -0.45;
      box(g, 1.3, 1.9, 0.1, '#5a3a22', -1.3, 0.95, 1.72); box(g, 1.3, 1.0, 0.1, '#cfe9ff', 1.4, 1.5, 1.72); box(g, 1.5, 0.12, 0.2, '#fff', 1.4, 0.95, 1.8);
      scene.add(g); solid(-11.2, -4.8, -14.8, -11.2);
      var L = mkTex(384, 110), x = L.x;
      rrPath(x, 4, 4, 376, 102, 30); x.fillStyle = '#e8f1ff'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#4f86ff'; x.stroke();
      drawIcon(x, 'bag', 58, 56, 34); txt(x, 'ATELIER', 220, 58, 56, '#3b6fe0', '#fff');
      var spl = new T.Mesh(new T.PlaneGeometry(3.6, 1.03), new T.MeshBasicMaterial({ map: L.tex, transparent: true })); spl.position.set(0, 4.6, 1.4); g.add(spl);
      [[-4.4, -11.2], [-11.8, -11.2]].forEach(function (p) { var cr = box(scene, 0.9, 0.9, 0.9, '#c58a5a', p[0], 0.45, p[1], true); cr.rotation.y = rand(); });
      var br = cyl(scene, '#8a5a34', -12.6, 0.55, -11.2, 0.5, 1.1, 0.5, true); cyl(scene, '#5a3a22', -12.6, 0.6, -11.2, 0.52, 0.08, 0.52); cyl(scene, '#5a3a22', -12.6, 0.95, -11.2, 0.52, 0.08, 0.52);
    })();
    var barnPadSign;
    (function barnTag() {
      var L = mkTex(384, 110), x = L.x;
      rrPath(x, 4, 4, 376, 102, 30); x.fillStyle = '#fff3d1'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#c0453f'; x.stroke();
      drawIcon(x, 'picker', 58, 56, 34); txt(x, 'GRANGE', 222, 58, 56, '#c0453f', '#fff');
      var bpl = new T.Mesh(new T.PlaneGeometry(3.8, 1.1), new T.MeshBasicMaterial({ map: L.tex, transparent: true })); bpl.position.set(6, 5.2, -13.85); scene.add(bpl);
    })();

    /* étal / comptoir */
    var stockSlots = [], stockCount = 0, stockSprite, stockTex, priceTex, slotMats = [];
    for (var si0 = 0; si0 < STOCK_CAP; si0++) stockSlots.push(null);
    function slotPos(i, out) { var col = i % 3, row = Math.floor(i / 3); return out.set(COUNTER.cx - 3.2 + row * 0.5, 1.44, COUNTER.cz + (col - 1) * 0.5); }
    (function counter() {
      var g = new T.Group(), w = COUNTER.x1 - COUNTER.x0, d = COUNTER.z1 - COUNTER.z0;
      outline(box(g, w, 1.0, d, '#c58a4f', COUNTER.cx, 0.5, COUNTER.cz, true), 1.03);
      box(g, w + 0.3, 0.14, d + 0.3, '#eec17f', COUNTER.cx, 1.06, COUNTER.cz, true);
      box(g, w - 0.5, 0.05, d - 0.35, '#f7e8c6', COUNTER.cx, 1.15, COUNTER.cz);
      for (var i = 0; i < 14; i++) box(g, 0.08, 0.7, 0.04, '#a56a36', COUNTER.x0 + 0.5 + i * (w - 1) / 13, 0.5, COUNTER.z1 + 0.03);
      // auvent rayé sur le devant du comptoir
      for (var s = 0; s < 25; s++) { var st = box(g, 0.72, 0.1, 0.5, s % 2 ? '#ffffff' : '#e0504a', COUNTER.x0 + 0.1 + s * 0.72, 1.32, COUNTER.z1 + 0.05); st.rotation.x = 0.0; }
      // panneau en arrière-plan
      [COUNTER.cx - 8.8, COUNTER.cx + 8.8].forEach(function (x) { cyl(g, '#8a5a34', x, 2.7, -8.6, 0.15, 5.4, 0.15, true); solid(x - 0.2, x + 0.2, -8.8, -8.4); });
      var sg = mkTex(512, 128), x = sg.x;
      rrPath(x, 4, 4, 504, 120, 36); x.fillStyle = '#fff3d1'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#e0504a'; x.stroke();
      txt(x, 'ŒUFS FRAIS', 290, 66, 74, '#e0504a', '#fff'); eggIcon(x, 70, 64, 40);
      var sign = new T.Mesh(new T.PlaneGeometry(7.6, 1.9), new T.MeshBasicMaterial({ map: sg.tex, transparent: true }));
      sign.position.set(COUNTER.cx, 4.6, -8.45); g.add(sign);
      box(g, 17.6, 0.16, 0.2, '#8a5a34', COUNTER.cx, 5.7, -8.6, true);
      for (var f = 0; f < 21; f++) { var fl = add(g, G.cone, f % 2 ? '#ffd93d' : '#ff7ebd', COUNTER.cx - 8.4 + f * 0.84, 5.45, -8.4, 0.2, 0.34, 0.05); fl.rotation.z = PI; }
      scene.add(g);
      solid(COUNTER.x0 - 0.1, COUNTER.x1 + 0.1, COUNTER.z0 - 0.1, COUNTER.z1 + 0.1);
      stockTex = mkTex(256, 96); stockSprite = mkSprite(stockTex, 3.5, 1.31); stockSprite.position.set(COUNTER.cx, 2.5, COUNTER.cz); scene.add(stockSprite);
      // étiquette de prix sur le comptoir
      priceTex = mkTex(192, 96);
      var pt = new T.Mesh(new T.PlaneGeometry(1.4, 0.7), new T.MeshBasicMaterial({ map: priceTex.tex, transparent: true }));
      pt.position.set(COUNTER.x0 + 0.5, 1.6, -0.2); pt.rotation.x = -0.35; scene.add(pt);
      // tapis des places clients
      for (var j = 0; j < 12; j++) {
        var mat = patch(SLOT_X[j], SLOT_Z, 0.95, 0.9, j % 2 ? '#e0504a' : '#4f86ff', 0.05); mat.visible = false; slotMats[j] = mat;
      }
      // décor autour du comptoir
      [[COUNTER.x0 - 1, -1.5], [COUNTER.x1 + 1.2, -1.5]].forEach(function (p, i) {
        var cr = box(scene, 0.95, 0.95, 0.95, '#c58a5a', p[0], 0.48, p[1], true); cr.rotation.y = 0.2;
        ell(scene, ['#ff6b5a', '#8be04e'][i], p[0] - 0.2, 1.05, p[1], 0.25, 0.25, 0.25); ell(scene, ['#ff6b5a', '#8be04e'][i], p[0] + 0.2, 1.05, p[1] + 0.1, 0.25, 0.25, 0.25);
        solid(p[0] - 0.55, p[0] + 0.55, p[1] - 0.55, p[1] + 0.55);
      });
      var L = mkTex(320, 110), xx = L.x;
      rrPath(xx, 4, 4, 312, 102, 30); xx.fillStyle = '#fff3d1'; xx.fill(); xx.lineWidth = 7; xx.strokeStyle = '#a66bff'; xx.stroke(); drawIcon(xx, 'stalls', 52, 56, 32); txt(xx, 'ÉTAL', 190, 58, 56, '#8a4fe0', '#fff');
      
    })();
    var lastStockTxt = '', lastPrice = -1;
    function drawStock() {
      var s = stockCount + '/' + STOCK_CAP; if (s === lastStockTxt) return; lastStockTxt = s;
      var x = stockTex.x; x.clearRect(0, 0, 256, 96);
      rrPath(x, 6, 10, 244, 76, 38); x.fillStyle = 'rgba(255,255,255,.93)'; x.fill();
      x.lineWidth = 5; x.strokeStyle = stockCount >= STOCK_CAP ? '#e0504a' : '#e6b676'; x.stroke();
      eggIcon(x, 62, 48, 26); txt(x, s, 156, 50, 46, stockCount >= STOCK_CAP ? '#e0504a' : '#7a4a00'); stockTex.tex.needsUpdate = true; updateStockHud();
    }
    function drawPrice() {
      var p = eggPrice(); if (p === lastPrice) return; lastPrice = p;
      var x = priceTex.x; x.clearRect(0, 0, 192, 96);
      rrPath(x, 6, 6, 180, 84, 22); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#ffcb2f'; x.stroke();
      eggIcon(x, 44, 48, 22); txt(x, '= ' + p, 128, 50, 46, '#7a4a00'); coinIcon(x, 168, 50, 0.1); priceTex.tex.needsUpdate = true;
    }

    /* panneau publicitaire (route) */
    var billTex, lastAds = -1;
    (function billboard() {
      var g = new T.Group(); g.position.set(29.5, 0, -3.4);
      cyl(g, '#8a5a34', -2.0, 1.6, 0, 0.12, 3.2, 0.12, true); cyl(g, '#8a5a34', 2.0, 1.6, 0, 0.12, 3.2, 0.12, true);
      box(g, 4.6, 2.2, 0.2, '#fff', 0, 3.3, 0, true);
      billTex = mkTex(512, 256);
      var pl = new T.Mesh(new T.PlaneGeometry(4.4, 2.0), new T.MeshBasicMaterial({ map: billTex.tex })); pl.position.set(0, 3.3, 0.12); g.add(pl);
      scene.add(g); solid(27.2, 31.8, -3.6, -3.2);
    })();
    function drawBillboard() {
      if (lv.ads === lastAds) return; lastAds = lv.ads;
      var x = billTex.x; x.fillStyle = '#ffeaf4'; x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#ff7ebd'; x.fillRect(0, 0, 512, 22); x.fillRect(0, 234, 512, 22);
      txt(x, 'LES MEILLEURS ŒUFS !', 256, 90, 52, '#e0306f'); eggIcon(x, 96, 170, 36, '#fff6dc'); eggIcon(x, 416, 170, 36, '#ffd23a', '#c98200');
      for (var i = 0; i < 5; i++) { x.fillStyle = i < lv.ads ? '#ffcb2f' : 'rgba(0,0,0,.15)'; starPath(x, 156 + i * 50, 190, 22, 0); x.fill(); }
      billTex.tex.needsUpdate = true;
    }

    /* panneau indicateur au départ */
    (function signpost() {
      var g = new T.Group(); g.position.set(0, 0, 6.8);
      cyl(g, '#8a5a34', 0, 1.4, 0, 0.1, 2.8, 0.1, true);
      [['POULAILLER', -1, 2.45, '#e0504a'], ['ÉTAL', 1, 2.0, '#a66bff'], ['ATELIER', -1, 1.55, '#4f86ff']].forEach(function (b) {
        var L = mkTex(256, 64), x = L.x;
        x.fillStyle = b[3]; rrPath(x, 4, 4, 248, 56, 14); x.fill(); x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke();
        txt(x, (b[1] < 0 ? '← ' : '') + b[0] + (b[1] > 0 ? ' →' : ''), 128, 34, 30, '#fff', 'rgba(0,0,0,.25)');
        var pl = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshBasicMaterial({ map: L.tex, transparent: true })); pl.position.set(b[1] * 0.8, b[2], 0.12); g.add(pl);
      });
      scene.add(g);
    })();

    /* décors divers : lampadaires, boîte aux lettres, épouvantail, étang */
    function lamp(x, z) {
      var g = new T.Group(); g.position.set(x, 0, z);
      cyl(g, '#4a4a5a', 0, 1.5, 0, 0.07, 3.0, 0.07, true); var b = ell(g, '#fff3b0', 0, 3.1, 0, 0.26, 0.26, 0.26); b.material = new T.MeshBasicMaterial({ color: 0xfff3b0 });
      cyl(g, '#4a4a5a', 0, 0.06, 0, 0.2, 0.12, 0.2, true); scene.add(g);
    }
    lamp(-10, 3.5); lamp(0, 3.5); lamp(10, 5.5); lamp(21, 5.5); lamp(-8, -6.5); lamp(33, 3);
    (function scarecrow() {
      var g = new T.Group(); g.position.set(-12, 0, 9);
      cyl(g, '#8a5a34', 0, 1.2, 0, 0.07, 2.4, 0.07, true); box(g, 1.6, 0.1, 0.1, '#8a5a34', 0, 1.8, 0, true);
      ell(g, '#ffd5b0', 0, 2.5, 0, 0.3, 0.3, 0.3, true); cyl(g, '#f2d36b', 0, 2.78, 0, 0.5, 0.05, 0.5); cyl(g, '#f2d36b', 0, 2.92, 0, 0.26, 0.26, 0.26);
      ell(g, '#e0504a', 0, 1.6, 0.05, 0.4, 0.55, 0.22, true); scene.add(g);
    })();
    var pond = new T.Group();
    (function () {
      pond.position.set(-20, 0, 15); solid(-24.4, -15.6, 10.8, 19.5);
      var w = new T.Mesh(new T.CircleGeometry(4.2, 28), new T.MeshLambertMaterial({ color: '#6fd0ff' })); w.rotation.x = -PI / 2; w.position.y = 0.04; pond.add(w);
      var rim = new T.Mesh(new T.RingGeometry(4.2, 4.7, 28), new T.MeshLambertMaterial({ color: '#cbbd9d' })); rim.rotation.x = -PI / 2; rim.position.y = 0.03; pond.add(rim);
      [[1.2, 1.4], [-1.8, -0.6], [0.2, -2]].forEach(function (p) { var lp = new T.Mesh(new T.CircleGeometry(0.5, 10), M('#3fae4e')); lp.rotation.x = -PI / 2; lp.position.set(p[0], 0.06, p[1]); pond.add(lp); });
      scene.add(pond);
    })();

    /* =================================================================
       PERSONNAGES & ANIMAUX
       ================================================================= */
    function makePerson(o) {
      var g = new T.Group(), sc = (o.scale || 1) * 0.82;
      var skin = o.skin || '#ffd5b0', shirt = o.shirt || '#e8453c', pants = o.pants || '#3f66b8', hairC = o.hairCol || '#5a3b22';
      var torso = ell(g, shirt, 0, 1.08, 0, 0.44, 0.52, 0.36, true); outline(torso, 1.1);
      if (o.overalls) {
        box(g, 0.5, 0.44, 0.1, o.overalls, 0, 1.2, 0.31, true);
        [-1, 1].forEach(function (s) { var st = box(g, 0.1, 0.4, 0.08, o.overalls, s * 0.2, 1.5, 0.22); st.rotation.z = s * 0.1; ell(g, '#ffd23a', s * 0.2, 1.38, 0.34, 0.05, 0.05, 0.04); });
      }
      if (o.belt) box(g, 0.9, 0.08, 0.76, o.belt, 0, 0.7, 0);
      var head = new T.Group(); head.position.set(0, 2.0, 0); g.add(head);
      var hm = ell(head, skin, 0, 0, 0, 0.52, 0.48, 0.48, true); outline(hm, 1.08);
      [-1, 1].forEach(function (s) {
        ell(head, '#fff', s * 0.17, 0.02, 0.4, 0.115, 0.14, 0.05); ell(head, '#2a1d33', s * 0.17, 0.01, 0.44, 0.075, 0.095, 0.04); ell(head, '#fff', s * 0.15, 0.05, 0.47, 0.025, 0.03, 0.02);
        var br = box(head, 0.16, 0.035, 0.03, hairC, s * 0.17, 0.2, 0.42); br.rotation.z = s * -0.14;
        ell(head, '#ff9aa8', s * 0.31, -0.1, 0.36, 0.085, 0.05, 0.03);
        if (o.glasses) { var gl = new T.Mesh(G.ring, M('#2a1d33')); gl.scale.set(0.1, 0.1, 0.1); gl.position.set(s * 0.17, 0.02, 0.45); head.add(gl); }
      });
      ell(head, skin === '#ffd5b0' ? '#f4bf98' : '#e0a77c', 0, -0.04, 0.46, 0.06, 0.05, 0.05);
      var mo = new T.Mesh(G.smile, M('#8a2b3c')); mo.position.set(0, -0.12, 0.44); mo.rotation.z = PI; mo.scale.set(1.2, 1.2, 1); head.add(mo);
      var hs = o.hair || 'short';
      if (hs !== 'bald') {
        var cap = add(head, G.cap, hairC, 0, 0.04, -0.04, 0.54, 0.5, 0.5, true); cap.rotation.x = -0.12;
        ell(head, hairC, 0, 0.27, 0.3, 0.38, 0.12, 0.2);
        if (hs === 'long') ell(head, hairC, 0, -0.25, -0.3, 0.48, 0.62, 0.22, true);
        if (hs === 'bun') ell(head, hairC, 0, 0.56, -0.12, 0.2, 0.2, 0.2, true);
        if (hs === 'pony') { ell(head, hairC, 0, -0.1, -0.5, 0.15, 0.4, 0.15, true); }
        if (hs === 'puff') { ell(head, hairC, -0.38, 0.35, -0.05, 0.2, 0.2, 0.2, true); ell(head, hairC, 0.38, 0.35, -0.05, 0.2, 0.2, 0.2, true); }
      }
      if (o.hat === 'straw') {
        cyl(head, '#f2d36b', 0, 0.38, 0, 0.95, 0.06, 0.95, true); cyl(head, '#f2d36b', 0, 0.55, 0, 0.45, 0.32, 0.45, true); cyl(head, '#e0504a', 0, 0.45, 0, 0.465, 0.07, 0.465);
      } else if (o.hat === 'cap') {
        var c2 = add(head, G.cap, o.hatCol, 0, 0.06, -0.02, 0.56, 0.52, 0.52, true); c2.rotation.x = -0.1; box(head, 0.5, 0.05, 0.34, o.hatCol, 0, 0.18, 0.5, true);
      } else if (o.hat === 'beanie') {
        add(head, G.cap, o.hatCol, 0, 0.08, -0.02, 0.57, 0.55, 0.53, true); ell(head, '#fff', 0, 0.56, 0, 0.12, 0.12, 0.12);
      } else if (o.hat === 'top') {
        cyl(head, '#2a2a3a', 0, 0.42, 0, 0.7, 0.05, 0.7, true); cyl(head, '#2a2a3a', 0, 0.68, 0, 0.4, 0.5, 0.4, true); cyl(head, '#ffd23a', 0, 0.5, 0, 0.415, 0.09, 0.415);
      } else if (o.hat === 'crown') {
        cyl(head, '#ffd23a', 0, 0.5, 0, 0.42, 0.22, 0.42, true); for (var cn = 0; cn < 5; cn++) { var a = cn / 5 * PI * 2; add(head, G.cone, '#ffd23a', Math.cos(a) * 0.38, 0.72, Math.sin(a) * 0.38, 0.09, 0.2, 0.09); }
      }
      var arms = [-1, 1].map(function (s) {
        var p = new T.Group(); p.position.set(s * 0.52, 1.45, 0); p.rotation.z = s * 0.12; g.add(p);
        ell(p, shirt, 0, -0.25, 0, 0.12, 0.3, 0.12, true); ell(p, skin, 0, -0.56, 0, 0.115, 0.115, 0.115, true); return p;
      });
      var legs = [-1, 1].map(function (s) {
        var p = new T.Group(); p.position.set(s * 0.18, 0.68, 0); g.add(p);
        ell(p, pants, 0, -0.28, 0, 0.15, 0.36, 0.15, true); ell(p, o.boots || '#5a3a22', 0, -0.62, 0.07, 0.17, 0.11, 0.24, true); return p;
      });
      var anchor = new T.Object3D(); anchor.position.set(0, 1.05, -0.5); g.add(anchor);
      g.scale.setScalar(sc);
      return { g: g, arms: arms, legs: legs, anchor: anchor, torso: torso, head: head, phase: 0 };
    }
    function walkAnim(p, speed, dt, amt) {
      p.phase += speed * dt * 1.7;
      var a = Math.sin(p.phase) * 0.8 * amt;
      p.legs[0].rotation.x = a; p.legs[1].rotation.x = -a; p.arms[0].rotation.x = -a * 0.8; p.arms[1].rotation.x = a * 0.8;
      var bob = Math.abs(Math.sin(p.phase)) * 0.06 * amt;
      p.torso.position.y = 1.08 + bob; p.head.position.y = 2.0 + bob * 1.4; p.head.rotation.z = Math.sin(p.phase) * 0.06 * amt;
    }
    function turnTo(g, ang, dt, rate) {
      var d = ((ang - g.rotation.y + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
      g.rotation.y += d * (1 - Math.exp(-dt * (rate || 14)));
    }
    var SKINS = ['#ffd5b0', '#f1b98b', '#d79a6b', '#a06b46', '#ffdcc2'];
    var SHIRTS = ['#ff7e8b', '#6ab7ff', '#ffd05a', '#8be04e', '#b58cff', '#ff9f5a', '#4dd8c8', '#f4f4f4'];
    var HAIRS = ['#3b2a20', '#8a5a34', '#e0b050', '#c0392b', '#2b2b3a', '#6b3b5a'];
    function pick(a) { return a[Math.floor(rand() * a.length)]; }

    /* joueur */
    var player = makePerson({ shirt: '#fff3d1', pants: '#4f7cd9', overalls: '#4f7cd9', skin: '#ffd5b0', hat: 'straw', hair: 'short', hairCol: '#7a4a22', boots: '#6b4a2f' });
    player.g.position.set(4, 0, 4); scene.add(player.g); player.p = player;
    player.cap = bagCap(); player.bag = []; player.vx = 0; player.vz = 0;
    var rack = new T.Group(); rack.position.set(0, 0.6, -0.7); player.g.add(rack);
    box(rack, 1.0, 0.12, 0.7, '#b57a42', 0, 0, 0, true); box(rack, 1.0, 0.9, 0.08, '#c58a4f', 0, 0.5, -0.32, true);
    [-1, 1].forEach(function (s) { box(rack, 0.08, 0.5, 0.7, '#b57a42', s * 0.5, 0.22, 0, true); });
    box(rack, 0.7, 0.06, 0.06, '#8a5a34', 0, 0.95, -0.34);
    var bagTex = mkTex(160, 72), bagSprite = mkSprite(bagTex, 2.2, 0.99);
    bagSprite.position.set(0, 3.45, 0); player.g.add(bagSprite);
    var lastBagTxt = '', bagFlash = 0;
    function drawBagLabel(force) {
      var full = player.bag.length >= player.cap, s = full ? 'MAX' : player.bag.length + '/' + player.cap;
      var key = s + (bagFlash > 0 ? 'f' : ''); if (key === lastBagTxt && !force) return; lastBagTxt = key;
      var x = bagTex.x; x.clearRect(0, 0, 160, 72);
      rrPath(x, 6, 8, 148, 56, 28); x.fillStyle = full ? '#ff5a52' : 'rgba(255,255,255,.95)'; x.fill();
      x.lineWidth = 4; x.strokeStyle = full ? '#b3231d' : '#e6b676'; x.stroke();
      if (!full) eggIcon(x, 38, 36, 17);
      txt(x, s, full ? 80 : 98, 38, 34, full ? '#fff' : '#7a4a00'); bagTex.tex.needsUpdate = true;
    }

    /* poule */
    function makeHen(col, wingCol) {
      var g = new T.Group();
      var body = ell(g, col, 0, 0.62, 0, 0.52, 0.48, 0.6, true); outline(body, 1.1);
      ell(g, '#fffaf0', 0, 0.5, 0.2, 0.36, 0.3, 0.3);
      [-1, 1].forEach(function (s) { var w = ell(g, wingCol, s * 0.5, 0.66, -0.02, 0.1, 0.3, 0.42, true); w.rotation.z = s * 0.15; });
      for (var i = -1; i <= 1; i++) { var t = ell(g, wingCol, i * 0.16, 0.98, -0.58, 0.11, 0.3, 0.1, true); t.rotation.x = -0.5; t.rotation.z = i * -0.3; }
      var head = new T.Group(); head.position.set(0, 1.12, 0.4); g.add(head);
      var hh = ell(head, col, 0, 0, 0, 0.3, 0.28, 0.28, true); outline(hh, 1.08);
      var eyes = [];
      [-1, 1].forEach(function (s) {
        ell(head, '#fff', s * 0.16, 0.05, 0.2, 0.075, 0.09, 0.04); eyes.push(ell(head, '#2a1d33', s * 0.16, 0.05, 0.235, 0.055, 0.07, 0.035)); ell(head, '#fff', s * 0.145, 0.08, 0.26, 0.018, 0.022, 0.015);
        ell(head, '#ff9aa8', s * 0.22, -0.07, 0.17, 0.06, 0.04, 0.03);
      });
      var bk = add(head, G.cone, '#ff9d2f', 0, -0.03, 0.3, 0.09, 0.2, 0.08); bk.rotation.x = PI / 2;
      ell(head, '#ff7a30', 0, -0.07, 0.27, 0.06, 0.03, 0.08);
      [-1, 0, 1].forEach(function (i) { ell(head, '#e0443c', i * 0.07, 0.3 - Math.abs(i) * 0.03, 0.03, 0.065, 0.1, 0.07, true); });
      ell(head, '#e0443c', 0, -0.2, 0.24, 0.05, 0.09, 0.05);
      [-1, 1].forEach(function (s) { cyl(g, '#ff9d2f', s * 0.17, 0.17, 0.02, 0.035, 0.34, 0.035); box(g, 0.2, 0.04, 0.28, '#ff9d2f', s * 0.17, 0.03, 0.08); });
      return { g: g, head: head, body: body, eyes: eyes };
    }
    var hens = [], HEN_COLS = [['#ffffff', '#ececec'], ['#ffffff', '#e8e8e8'], ['#f3c58a', '#dba062'], ['#d79a5b', '#b87a3c'], ['#ffe9a8', '#e8cf7a']];
    function henRegion() { return { x0: PEN.x0 + 1.4, x1: PEN.x1 - 1.0, z0: PEN.z0 + 1.0, z1: 0.9 }; }
    function addHen() {
      var c = HEN_COLS[hens.length % HEN_COLS.length], h = makeHen(c[0], c[1]), R = henRegion();
      h.g.position.set(R.x0 + rand() * (R.x1 - R.x0), 0, R.z0 + 1 + rand() * (R.z1 - R.z0 - 1));
      h.g.rotation.y = rand() * 6; scene.add(h.g);
      h.state = 'idle'; h.timer = rand() * 2; h.eggT = 2 + rand() * 4; h.layT = 0; h.tx = 0; h.tz = 0; h.ph = rand() * 6; h.blink = 0;
      hens.push(h); return h;
    }

    /* animaux de décor */
    var critters = [];
    function makeCow() {
      var g = new T.Group();
      var body = ell(g, '#ffffff', 0, 1.15, 0, 0.62, 0.58, 1.0, true); outline(body, 1.06);
      ell(g, '#2a2a33', 0.35, 1.3, 0.2, 0.3, 0.3, 0.3); ell(g, '#2a2a33', -0.4, 1.1, -0.35, 0.28, 0.32, 0.4); ell(g, '#2a2a33', 0.2, 1.4, -0.5, 0.25, 0.2, 0.25);
      var head = new T.Group(); head.position.set(0, 1.5, 1.0); g.add(head);
      var hh = ell(head, '#ffffff', 0, 0, 0, 0.36, 0.34, 0.4, true); outline(hh, 1.07);
      ell(head, '#ffb3c1', 0, -0.12, 0.34, 0.26, 0.17, 0.14);
      [-1, 1].forEach(function (s) { ell(head, '#2a1d33', s * 0.17, 0.08, 0.3, 0.05, 0.065, 0.04); ell(head, '#fff', s * 0.55 * 0.6, 0.35, 0, 0.12, 0.07, 0.12); add(head, G.cone, '#f4e3bd', s * 0.22, 0.4, 0, 0.05, 0.16, 0.05); var ear = ell(head, '#2a2a33', s * 0.42, 0.12, -0.05, 0.14, 0.07, 0.1); ear.rotation.z = s * 0.3; });
      ell(g, '#ffb3c1', 0, 0.7, -0.5, 0.2, 0.15, 0.2);
      [[-0.3, 0.7], [0.3, 0.7], [-0.3, -0.7], [0.3, -0.7]].forEach(function (p) { cyl(g, '#ffffff', p[0], 0.4, p[1], 0.11, 0.8, 0.11, true); cyl(g, '#2a2a33', p[0], 0.06, p[1], 0.12, 0.12, 0.12); });
      var tail = cyl(g, '#2a2a33', 0, 1.2, -1.05, 0.04, 0.7, 0.04); tail.rotation.x = 0.4;
      return { g: g, head: head };
    }
    function makeSheep() {
      var g = new T.Group();
      var w = ell(g, '#fffdf5', 0, 0.9, 0, 0.62, 0.52, 0.72, true); outline(w, 1.06);
      for (var i = 0; i < 6; i++) ell(g, '#fffdf5', Math.cos(i) * 0.4, 1.1 + (i % 2) * 0.1, Math.sin(i) * 0.5, 0.3, 0.3, 0.3, true);
      var head = new T.Group(); head.position.set(0, 1.05, 0.78); g.add(head);
      var hh = ell(head, '#3b3340', 0, 0, 0, 0.25, 0.27, 0.3, true); outline(hh, 1.08);
      [-1, 1].forEach(function (s) { ell(head, '#fff', s * 0.12, 0.06, 0.22, 0.06, 0.07, 0.04); ell(head, '#111', s * 0.12, 0.06, 0.25, 0.035, 0.045, 0.03); var ear = ell(head, '#3b3340', s * 0.3, 0.05, -0.02, 0.14, 0.06, 0.09); ear.rotation.z = s * 0.4; });
      ell(head, '#fffdf5', 0, 0.26, 0, 0.2, 0.12, 0.2);
      [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]].forEach(function (p) { cyl(g, '#3b3340', p[0], 0.28, p[1], 0.07, 0.56, 0.07, true); });
      return { g: g, head: head };
    }
    function makeDuck() {
      var g = new T.Group();
      var body = ell(g, '#ffe14d', 0, 0.25, 0, 0.28, 0.24, 0.38, true); outline(body, 1.08);
      var head = new T.Group(); head.position.set(0, 0.55, 0.28); g.add(head);
      var hh = ell(head, '#ffe14d', 0, 0, 0, 0.19, 0.18, 0.18, true); outline(hh, 1.08);
      var bk = ell(head, '#ff9d2f', 0, -0.03, 0.2, 0.13, 0.04, 0.1);
      [-1, 1].forEach(function (s) { ell(head, '#2a1d33', s * 0.09, 0.05, 0.14, 0.03, 0.04, 0.03); });
      var tl = ell(g, '#ffe14d', 0, 0.35, -0.38, 0.1, 0.08, 0.1);
      return { g: g, head: head };
    }
    function addCritter(model, x, z, R, spd, kind) {
      model.g.position.set(x, 0, z); model.g.rotation.y = rand() * 6; scene.add(model.g);
      critters.push({ m: model, R: R, spd: spd, kind: kind, state: 'idle', t: rand() * 3, tx: x, tz: z, ph: rand() * 6 });
    }
    addCritter(makeCow(), 33, -12, { x0: 30.8, x1: 36.2, z0: -14, z1: -10.8 }, 0.7, 'cow');
    addCritter(makeCow(), 35.2, -12.6, { x0: 30.8, x1: 36.2, z0: -14, z1: -10.8 }, 0.7, 'cow');
    for (var shi = 0; shi < 3; shi++) addCritter(makeSheep(), -27 + shi * 2, -14 + shi, { x0: -29.5, x1: -18, z0: -16.5, z1: -11.8 }, 0.8, 'sheep');
    for (var di = 0; di < 3; di++) addCritter(makeDuck(), -21 + di, 14 + di * 0.5, { x0: -22.8, x1: -17.5, z0: 12.5, z1: 17.5 }, 0.6, 'duck');
    (function paddockFence() {
      var g = new T.Group();
      function rail(x0, z0, x1, z1) {
        var len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        [0.3, 0.62].forEach(function (y) { var r = box(g, 0.12, 0.12, len, '#d19a5e', mx, y, mz, true); r.rotation.y = a; });
        var n = Math.max(1, Math.round(len / 1.6));
        for (var i = 0; i <= n; i++) box(g, 0.2, 0.85, 0.2, '#b57a42', x0 + (x1 - x0) * i / n, 0.42, z0 + (z1 - z0) * i / n, true);
        solid(Math.min(x0, x1) - 0.1, Math.max(x0, x1) + 0.1, Math.min(z0, z1) - 0.1, Math.max(z0, z1) + 0.1);
      }
      rail(29.5, -9.8, 37.5, -9.8); rail(29.5, -9.8, 29.5, -15); rail(37.5, -9.8, 37.5, -15); rail(-31, -10.8, -17, -10.8); rail(-31, -10.8, -31, -17.5); rail(-17, -10.8, -17, -17.5); scene.add(g);
    })();
    var butterflies = [];
    for (var bi = 0; bi < 5; bi++) {
      var bf = new T.Group(); var wl = box(bf, 0.2, 0.02, 0.16, ['#ff7ebd', '#ffd93d', '#a66bff', '#38d6f5', '#ff9f5a'][bi], -0.1, 0, 0), wr = box(bf, 0.2, 0.02, 0.16, ['#ff7ebd', '#ffd93d', '#a66bff', '#38d6f5', '#ff9f5a'][bi], 0.1, 0, 0);
      scene.add(bf); butterflies.push({ g: bf, wl: wl, wr: wr, cx: -22 + bi * 12, cz: 9 + (bi % 3) * 1.5, ph: bi * 1.3 });
    }
    function updateCritters(dt) {
      critters.forEach(function (c) {
        var p = c.m.g.position; c.ph += dt;
        if (c.state === 'idle') {
          c.t -= dt; if (c.kind !== 'duck') c.m.head.rotation.x = Math.max(0, Math.sin(c.ph * 2.2)) * 0.5 * (c.kind === 'cow' ? 1 : 0.8);
          if (c.t <= 0) { c.state = 'walk'; c.tx = c.R.x0 + rand() * (c.R.x1 - c.R.x0); c.tz = c.R.z0 + rand() * (c.R.z1 - c.R.z0); c.m.head.rotation.x = 0; }
        } else {
          var dx = c.tx - p.x, dz = c.tz - p.z, d = Math.hypot(dx, dz);
          if (d < 0.15) { c.state = 'idle'; c.t = 1.5 + rand() * 4; }
          else { p.x += dx / d * c.spd * dt; p.z += dz / d * c.spd * dt; turnTo(c.m.g, Math.atan2(dx, dz), dt, 5); }
        }
        if (c.kind === 'duck') { p.y = 0.05 + Math.sin(c.ph * 3) * 0.02; c.m.g.rotation.z = Math.sin(c.ph * 3) * 0.05; }
        else if (c.state === 'walk') p.y = Math.abs(Math.sin(c.ph * 6)) * 0.05; else p.y = 0;
      });
      butterflies.forEach(function (b) {
        b.ph += dt * 1.4; b.g.position.set(b.cx + Math.cos(b.ph) * 2.6, 1.0 + Math.sin(b.ph * 2.1) * 0.35, b.cz + Math.sin(b.ph * 0.8) * 1.8);
        b.g.rotation.y = -b.ph; var f = Math.sin(b.ph * 22) * 0.9; b.wl.rotation.z = f; b.wr.rotation.z = -f;
      });
    }

    /* =================================================================
       SYSTÈMES DE JEU
       ================================================================= */
    var time = 0, paused = false;
    var fliers = [], _t = new T.Vector3(), _t2 = new T.Vector3();
    function easeIO(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
    function fly(o, to, dur, arc, done) { o.fl = { from: o.m.position.clone(), to: to, t: 0, dur: dur, arc: arc, done: done }; fliers.push(o); }
    function updateFliers(dt) {
      for (var i = fliers.length - 1; i >= 0; i--) {
        var o = fliers[i], f = o.fl; f.t += dt / f.dur;
        var e = Math.min(1, f.t), te = easeIO(e), tg = typeof f.to === 'function' ? f.to() : f.to, m = o.m;
        m.position.x = f.from.x + (tg.x - f.from.x) * te; m.position.z = f.from.z + (tg.z - f.from.z) * te;
        m.position.y = f.from.y + (tg.y - f.from.y) * te + Math.sin(e * PI) * f.arc;
        m.scale.setScalar(1 + Math.sin(e * PI) * 0.35); m.rotation.y += dt * 9; m.rotation.x = Math.sin(e * PI) * 0.5;
        if (e >= 1) { fliers.splice(i, 1); m.scale.setScalar(1); m.rotation.set(0, m.rotation.y, 0); o.fl = null; if (f.done) f.done(); }
      }
    }
    var parts = [];
    function burst(x, y, z, n, cols, spd, life, size, grav) {
      for (var i = 0; i < n && parts.length < 240; i++) {
        var m = new T.Mesh(G.oct, M(cols[i % cols.length])); m.scale.setScalar(size || 0.15); m.position.set(x, y, z); scene.add(m);
        var a = rand() * PI * 2, u = 0.4 + rand() * 0.6;
        parts.push({ m: m, vx: Math.cos(a) * spd * u, vz: Math.sin(a) * spd * u, vy: (0.5 + rand()) * spd * 0.9, life: life * (0.7 + rand() * 0.6), t: 0, s: size || 0.15, g: grav == null ? 12 : grav });
      }
    }
    function updateParts(dt) {
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.t += dt;
        if (p.t >= p.life) { scene.remove(p.m); parts.splice(i, 1); continue; }
        p.vy -= p.g * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
        if (p.m.position.y < 0.05 && p.g > 0) { p.m.position.y = 0.05; p.vy *= -0.4; }
        p.m.rotation.x += dt * 6; p.m.rotation.y += dt * 5; p.m.scale.setScalar(p.s * (1 - Math.pow(p.t / p.life, 2)));
      }
    }

    /* œufs */
    var EGG_MATS = [new T.MeshToonMaterial({ color: '#fff6e4', gradientMap: toonGrad }), new T.MeshToonMaterial({ color: '#e5ab70', gradientMap: toonGrad }), new T.MeshToonMaterial({ color: '#ffd23a', emissive: '#8a5a00', gradientMap: toonGrad })];
    var groundEggs = [];
    function newEgg(kind) {
      var m = new T.Mesh(eggG, EGG_MATS[kind]); m.castShadow = true; outline(m, 1.14); scene.add(m);
      return { m: m, kind: kind, state: 'ground', claimed: null, vy: 0, fl: null, born: 0 };
    }
    function layEgg(hen) {
      if (groundEggs.length >= MAX_GROUND) return;
      var r = rand(), kind = r < goldChance() ? 2 : (r < 0.5 ? 1 : 0), e = newEgg(kind);
      var bx = hen.g.position.x - Math.sin(hen.g.rotation.y) * 0.7, bz = hen.g.position.z - Math.cos(hen.g.rotation.y) * 0.7;
      bx = Math.max(PEN.x0 + 0.8, Math.min(PEN.x1 - 0.8, bx)); bz = Math.max(PEN.z0 + 0.8, Math.min(1.3, bz));
      e.m.position.set(bx, 0.7, bz); e.vy = 3.2; e.m.scale.setScalar(0.01);
      groundEggs.push(e); burst(bx, 0.4, bz, 7, ['#ffffff', '#fff6e4'], 2.2, 0.5, 0.18); sfx.lay();
    }
    function updateGroundEggs(dt) {
      for (var i = 0; i < groundEggs.length; i++) {
        var e = groundEggs[i]; if (e.state !== 'ground') continue;
        e.born += dt; var s = Math.min(1, e.born * 6); e.m.scale.setScalar(s * (1 + Math.sin(Math.min(1, e.born * 3) * PI) * 0.25));
        if ((e.kind !== 2 || e.born < 0.7) && (e.vy !== 0 || e.m.position.y > 0.261)) {
          e.vy -= 14 * dt; e.m.position.y += e.vy * dt;
          if (e.m.position.y <= 0.26) { e.m.position.y = 0.26; e.vy = Math.abs(e.vy) > 1.2 ? -e.vy * 0.4 : 0; }
        }
        if (e.kind === 2) { e.m.rotation.y += dt * 2.5; if (e.born > 0.7) e.m.position.y = 0.34 + Math.sin(time * 4 + i) * 0.06; if (rand() < dt * 3) burst(e.m.position.x, 0.5, e.m.position.z, 1, ['#fff3a6'], 0.6, 0.8, 0.1, 0); }
      }
    }

    /* piles d'œufs dans le dos */
    var BAGCOL = [0, -0.27, 0.27, -0.54, 0.54];
    function bagTarget(c, egg, out) {
      var idx = c.bag.indexOf(egg), col = Math.floor(idx / 8), row = idx % 8;
      c.p.anchor.getWorldPosition(out);
      var ang = c.p.g.rotation.y, cs = Math.cos(ang), sn = Math.sin(ang), off = BAGCOL[Math.min(col, 4)];
      out.x += cs * off; out.z += -sn * off; out.y = out.y - 0.15 + row * 0.27;
      return out;
    }
    function updateBag(c, dt) {
      for (var i = 0; i < c.bag.length; i++) {
        var e = c.bag[i]; if (e.state !== 'bag') continue;
        bagTarget(c, e, _t2);
        var k = 1 - Math.exp(-dt * Math.max(5, 24 - (i % 8) * 2.2));
        e.m.position.x += (_t2.x - e.m.position.x) * k; e.m.position.y += (_t2.y - e.m.position.y) * k; e.m.position.z += (_t2.z - e.m.position.z) * k;
        e.m.rotation.y = c.p.g.rotation.y; e.m.rotation.z = (e.m.position.x - _t2.x) * -1.2;
        if (e.pop > 0) { e.pop -= dt; e.m.scale.setScalar(1 + Math.sin(Math.max(0, e.pop) / 0.25 * PI) * 0.35); }
      }
    }
    function pickup(c, e) {
      if (c.bag.length >= c.cap) return false;
      e.state = 'fly'; groundEggs.splice(groundEggs.indexOf(e), 1); e.claimed = null; c.bag.push(e);
      if (c === player) { stats.picked++; if (e.kind === 2) { stats.gold++; toast('Œuf doré ! Il vaut ×5', 'gold'); sfx.unlock(); } }
      fly(e, function () { return bagTarget(c, e, _t); }, 0.3, 1.1, function () { e.state = 'bag'; e.pop = 0.25; });
      return true;
    }
    function depositOne(c) {
      if (!c.bag.length) return false;
      var e = c.bag[c.bag.length - 1]; if (e.state !== 'bag') return false;
      var slot = -1; for (var i = 0; i < STOCK_CAP; i++) if (!stockSlots[i]) { slot = i; break; }
      if (slot < 0) return false;
      c.bag.pop(); e.state = 'fly'; stockSlots[slot] = { egg: e, landed: false }; stockCount++; stats.deposited++;
      var tgt = slotPos(slot, new T.Vector3());
      fly(e, tgt, 0.36, 1.6, function () {
        e.state = 'stock'; if (stockSlots[slot]) stockSlots[slot].landed = true; e.m.rotation.set(0, rand() * 6, 0);
        burst(tgt.x, tgt.y, tgt.z, 3, ['#ffffff', '#ffe9b0'], 1.4, 0.4, 0.1); e.sq = 0.25;
      });
      return true;
    }

    /* poules : mise à jour */
    function updateHens(dt) {
      var R = henRegion();
      hens.forEach(function (h) {
        h.ph += dt; if (h.state !== 'walk') h.g.position.y = 0;
        h.blink -= dt; if (h.blink < -3 - rand() * 2) h.blink = 0.12;
        var ey = h.blink > 0 ? 0.1 : 1; h.eyes[0].scale.y = h.eyes[1].scale.y = 0.07 * ey;
        if (h.state !== 'lay') { h.eggT -= dt; if (h.eggT <= 0 && groundEggs.length < MAX_GROUND) { h.state = 'lay'; h.layT = 0.9; sfx.pop(); } else if (h.eggT <= 0) h.eggT = 2; }
        if (h.state === 'lay') {
          h.layT -= dt; h.g.rotation.z = Math.sin(h.ph * 45) * 0.14; h.g.scale.y = 1 + Math.sin(h.ph * 20) * 0.06;
          if (h.layT <= 0) { h.g.rotation.z = 0; h.g.scale.y = 1; layEgg(h); h.state = 'idle'; h.timer = 1; h.eggT = (4.0 + rand() * 2.5) * layFactor(); }
        } else if (h.state === 'idle') {
          h.timer -= dt; h.head.rotation.x = 0;
          if (h.timer <= 0) {
            if (rand() < 0.45) { h.state = 'peck'; h.timer = 0.9; }
            else { h.state = 'walk'; h.tx = R.x0 + rand() * (R.x1 - R.x0); h.tz = R.z0 + rand() * (R.z1 - R.z0); }
          }
        } else if (h.state === 'peck') {
          h.timer -= dt; h.head.rotation.x = Math.abs(Math.sin(h.ph * 11)) * 0.9;
          if (h.timer <= 0) { h.state = 'idle'; h.timer = 0.5 + rand() * 1.5; }
        } else if (h.state === 'walk') {
          var dx = h.tx - h.g.position.x, dz = h.tz - h.g.position.z, d = Math.hypot(dx, dz);
          if (d < 0.2) { h.state = 'idle'; h.timer = 0.4 + rand() * 1.5; }
          else {
            h.g.position.x += dx / d * 1.4 * dt; h.g.position.z += dz / d * 1.4 * dt; turnTo(h.g, Math.atan2(dx, dz), dt, 10);
            h.g.position.y = Math.abs(Math.sin(h.ph * 12)) * 0.08; h.head.rotation.x = Math.sin(h.ph * 12) * 0.2; h.g.rotation.z = Math.sin(h.ph * 12) * 0.07;
          }
        }
      });
    }

    /* collisions / navigation */
    function collide(p, r) {
      for (var i = 0; i < solids.length; i++) {
        var s = solids[i], cx = Math.max(s.x0, Math.min(p.x, s.x1)), cz = Math.max(s.z0, Math.min(p.z, s.z1));
        var dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) { if (d2 > 1e-6) { var d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; } else p.z = s.z1 + r; }
      }
    }
    function inPen(x, z) { return x < PEN.x1 && x > PEN.x0 && z > PEN.z0 && z < PEN.z1; }
    function route(px, pz, tx, tz) {
      var a = inPen(px, pz), b = inPen(tx, tz);
      if (a === b) return { x: tx, z: tz };
      return { x: PEN.x1 + (a ? -0.3 : 0.3), z: GATE_Z };
    }
    function stepTo(npc, tx, tz, sp, dt) {
      var p = npc.g.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) return d;
      var st = Math.min(d, sp * dt); p.x += dx / d * st; p.z += dz / d * st; turnTo(npc.g, Math.atan2(dx, dz), dt, 12);
      return d - st;
    }

    /* clients */
    var customers = [], slotCust = [null, null, null, null, null, null, null, null, null, null, null, null], spawnT = 2, rushT = 0, rushCd = 70 + rand() * 30;
    var CTYPES = [
      { id: 'normal', w: 62 }, { id: 'kid', w: 14 }, { id: 'granny', w: 14 }, { id: 'vip', w: 6 }, { id: 'farmer', w: 4 }
    ];
    function pickType() {
      var tot = 0; CTYPES.forEach(function (t) { tot += t.w; }); var r = rand() * tot;
      for (var i = 0; i < CTYPES.length; i++) { r -= CTYPES[i].w; if (r <= 0) return CTYPES[i].id; }
      return 'normal';
    }
    function bubbleDraw(c) {
      var x = c.bt.x; x.clearRect(0, 0, 160, 150);
      var angry = c.state === 'leaveAngry', happy = c.state === 'happy' || c.state === 'leave', vip = c.type === 'vip';
      rrPath(x, 8, 6, 144, 100, 28); x.fillStyle = angry ? '#ffb4ae' : (vip ? '#fff0b8' : 'rgba(255,255,255,.97)'); x.fill();
      x.lineWidth = 5; x.strokeStyle = angry ? '#d9453b' : (vip ? '#e0a800' : '#e6b676'); x.stroke();
      x.beginPath(); x.moveTo(66, 104); x.lineTo(80, 128); x.lineTo(94, 104); x.closePath(); x.fillStyle = angry ? '#ffb4ae' : (vip ? '#fff0b8' : '#fff'); x.fill();
      if (happy) { x.fillStyle = '#ff5a8a'; x.beginPath(); x.moveTo(80, 82); x.bezierCurveTo(30, 50, 56, 14, 80, 38); x.bezierCurveTo(104, 14, 130, 50, 80, 82); x.fill(); }
      else if (angry) txt(x, '!', 80, 56, 70, '#d9453b');
      else { eggIcon(x, 52, 56, 24); txt(x, '×' + (c.need - c.got), 108, 58, 46, '#7a4a00'); if (vip) { x.fillStyle = '#ffd23a'; starPath(x, 132, 24, 12, 0); x.fill(); } }
      if (c.state === 'wait' && c.srv > 0) {
        rrPath(x, 28, 88, 104, 11, 5); x.fillStyle = 'rgba(0,0,0,.16)'; x.fill();
        rrPath(x, 28, 88, Math.max(9, 104 * c.srv), 11, 5); x.fillStyle = '#35c97a'; x.fill();
      }
      if (c.state === 'wait') {
        var r = Math.max(0, c.pat / c.maxPat);
        rrPath(x, 24, 0, 112, 10, 5); x.fillStyle = 'rgba(0,0,0,.2)'; x.fill();
        rrPath(x, 24, 0, Math.max(10, 112 * r), 10, 5); x.fillStyle = r > 0.5 ? '#4ddc8c' : (r > 0.25 ? '#ffb938' : '#ff5a52'); x.fill();
      }
      c.bt.tex.needsUpdate = true;
    }
    function spawnCustomer() {
      var type = pickType(), L = farmLevel();
      var look = { shirt: pick(SHIRTS), pants: pick(['#3b4a6b', '#5a4632', '#2f6b4f', '#6b3b5a']), skin: pick(SKINS), hair: pick(['short', 'short', 'long', 'bun', 'pony', 'puff', 'bald']), hairCol: pick(HAIRS), hat: pick(['none', 'none', 'cap', 'beanie']), hatCol: pick(SHIRTS), scale: 0.95 + rand() * 0.12 };
      var need, tipMul = 1, payMul = 1, patBase = 65;
      if (type === 'kid') { look.scale = 0.7; look.hair = pick(['pony', 'puff', 'short']); look.hat = 'none'; need = 1 + Math.floor(rand() * 2); patBase = 70; }
      else if (type === 'granny') { look.hair = 'bun'; look.hairCol = '#d9d9e6'; look.glasses = true; look.shirt = pick(['#ff9fc8', '#b58cff', '#8be0c8']); look.hat = 'none'; need = 2 + Math.floor(rand() * 3); tipMul = 2.2; patBase = 80; }
      else if (type === 'vip') { look.hat = pick(['top', 'crown']); look.shirt = '#ffd23a'; look.belt = '#2a2a3a'; need = 3 + Math.floor(rand() * 4); payMul = 2; tipMul = 2; patBase = 65; }
      else if (type === 'farmer') { look.hat = 'straw'; look.overalls = '#3f66b8'; look.shirt = '#e8453c'; need = 2 + Math.floor(rand() * 2); }
      else need = 1 + Math.floor(rand() * Math.min(5, 2 + Math.floor(L / 3)));
      var p = makePerson(look);
      p.g.position.set(46, 0, ROAD_Z); p.g.rotation.y = -PI / 2; scene.add(p.g);
      var c = { p: p, g: p.g, slot: -1, need: need, got: 0, res: 0, paid: 0, type: type, tipMul: tipMul, payMul: payMul, state: 'queue', born: time, maxPat: patBase + need * 9, pat: 0, wps: [], arrived: 0, timer: 0, key: '', srv: 0, srvBy: null };
      c.pat = c.maxPat; c.bt = mkTex(160, 150); c.spr = mkSprite(c.bt, 2.3, 2.15); c.spr.position.set(0, 4.3, 0); p.g.add(c.spr);
      c.spr.visible = false; customers.push(c); bubbleDraw(c);
    }
    function makeHappy(c) {
      c.state = 'happy'; c.timer = 1.1; slotCust[c.slot] = null; firstSale = true; stats.served++;
      var pos = c.g.position;
      burst(pos.x, 2.4, pos.z, 12, ['#ff5a8a', '#ff8fb0', '#ffd93d'], 2.6, 0.9, 0.17, -2); sfx.happy();
      var tipBase = c.need >= 2 || c.type !== 'normal' ? 0.25 : 0;
      if (tipBase) {
        var tip = Math.max(1, Math.round(c.paid * tipBase * c.tipMul * (rushT > 0 ? 2 : 1) * (0.6 + 0.8 * Math.max(0, c.pat / c.maxPat))));
        _t.set(pos.x, 2.6, pos.z); addMoney(tip, _t, (rushT > 0 ? 'Pourboire ×2 +' : 'Pourboire +') + tip);
      }
      if (c.type === 'vip') { burst(pos.x, 1.5, pos.z, 20, ['#ffd23a', '#fff3a6'], 4, 1.1, 0.2); toast('Un client VIP est content !', 'gold'); }
      c.key = ''; bubbleDraw(c);
    }
    function updateCustomers(dt) {
      // rythme : plus de clients, événement « heure de pointe »
      rushCd -= dt;
      if (rushT > 0) { rushT -= dt; if (rushT <= 0) { rushEl.style.display = 'none'; toast('Fin de l’heure de pointe', null); } }
      else if (rushCd <= 0 && firstSale) { rushT = 20; rushCd = 80 + rand() * 40; rushEl.style.display = 'block'; sfx.horn(); toast('Heure de pointe ! Clients ×2.5', 'bad'); }
      var qList = customers.filter(function (c0) { return c0.state === 'queue'; }); qList.sort(function (a, b) { return a.born - b.born; });
      spawnT -= dt;
      if (spawnT <= 0) {
        var base = Math.max(1.0, 3.0 - 0.12 * Math.min(farmLevel(), 14)) * Math.pow(0.85, lv.ads) * (rushT > 0 ? 0.4 : 1);
        spawnT = base * (0.8 + rand() * 0.4); if (qList.length < 10) spawnCustomer();
      }
      custTxt.textContent = customers.filter(function (c0) { return c0.state === 'queue' || c0.state === 'in' || c0.state === 'wait'; }).length;
      for (var i = customers.length - 1; i >= 0; i--) {
        var c = customers[i], moving = false;
        if (c.state === 'queue') {
          var rank = qList.indexOf(c), took = false;
          if (rank === 0) {
            var fr = activeSlots().filter(function (k) { return !slotCust[k]; });
            if (fr.length) {
              var bs = fr[0], bd = 1e9; fr.forEach(function (k) { var dd = Math.abs(SLOT_X[k] - c.g.position.x); if (dd < bd) { bd = dd; bs = k; } });
              c.slot = bs; slotCust[bs] = c; c.state = 'in'; c.wps = [{ x: SLOT_X[bs], z: ROAD_Z }, { x: SLOT_X[bs], z: SLOT_Z }]; took = true;
            }
          }
          if (!took) { var dq = stepTo(c.p, QX0 + rank * 1.3, ROAD_Z, 4.4, dt); if (dq > 0.1) moving = true; else turnTo(c.g, -PI / 2, dt, 10); }
        } else if (c.state === 'in') {
          var w = c.wps[0], d = stepTo(c.p, w.x, w.z, 4.0, dt); moving = true;
          if (d < 0.08) { c.wps.shift(); if (!c.wps.length) { c.state = 'wait'; c.arrived = time; c.spr.visible = true; c.g.rotation.y = 0; bubbleDraw(c); sfx.pop(); } }
        } else if (c.state === 'wait') {
          turnTo(c.g, 0, dt, 10); c.pat -= dt;
          var key = (c.need - c.got) + ':' + Math.floor(c.pat / c.maxPat * 20) + ':' + Math.floor((c.srv || 0) * 16);
          if (key !== c.key) { c.key = key; bubbleDraw(c); }
          c.spr.position.y = 4.3 + Math.sin(time * 4 + i) * 0.06;
          c.p.arms[1].rotation.x = Math.sin(time * 3 + i) * 0.1;
          if (c.pat <= 0) { c.state = 'leaveAngry'; slotCust[c.slot] = null; c.wps = [{ x: SLOT_X[c.slot], z: LEAVE_Z }, { x: 48, z: LEAVE_Z }]; bubbleDraw(c); sfx.bad(); }
        } else if (c.state === 'happy') {
          c.timer -= dt; c.g.position.y = Math.abs(Math.sin(c.timer * 9)) * 0.5; turnTo(c.g, 0, dt, 10);
          c.p.arms[0].rotation.x = c.p.arms[1].rotation.x = -2.6;
          if (c.timer <= 0) { c.g.position.y = 0; c.p.arms[0].rotation.x = c.p.arms[1].rotation.x = 0; c.state = 'leave'; c.wps = [{ x: SLOT_X[c.slot], z: LEAVE_Z }, { x: 48, z: LEAVE_Z }]; }
        } else if (c.state === 'leave' || c.state === 'leaveAngry') {
          var w2 = c.wps[0], d2 = stepTo(c.p, w2.x, w2.z, 3.8, dt); moving = true;
          if (d2 < 0.08) { c.wps.shift(); if (!c.wps.length) { scene.remove(c.g); customers.splice(i, 1); continue; } }
        }
        if (moving) walkAnim(c.p, 3.6, dt, 1); else if (c.state === 'wait' || c.state === 'queue') walkAnim(c.p, 0, dt, 0);
      }
    }
    var playerSeller = { cur: null, t: 0, q: 0, sound: true };
    function hasStockEgg() { for (var i = STOCK_CAP - 1; i >= 0; i--) if (stockSlots[i] && stockSlots[i].landed) return true; return false; }
    function pickSellCustomer(S) {
      var best = null;
      customers.forEach(function (c) { if (c.state === 'wait' && c.got + c.res < c.need && (!c.srvBy || c.srvBy === S) && (!best || c.arrived < best.arrived)) best = c; });
      return best;
    }
    function releaseSeller(S) { if (S.cur) { S.cur.srvBy = null; S.cur.srv = 0; } S.cur = null; S.t = 0; S.q = 0; }
    function handEgg(c) {
      var si = -1; for (var i = STOCK_CAP - 1; i >= 0; i--) if (stockSlots[i] && stockSlots[i].landed) { si = i; break; }
      if (si < 0) return false;
      var e = stockSlots[si].egg; stockSlots[si] = null; stockCount--; c.res++; e.state = 'fly';
      fly(e, function () { _t.copy(c.g.position); _t.y += 1.5; return _t; }, 0.4, 1.5, function () {
        scene.remove(e.m); c.res--; c.got++; stats.sold++;
        var val = Math.round((e.kind === 2 ? eggPrice() * 5 : eggPrice()) * c.payMul); c.paid += val;
        _t.set(c.g.position.x, 2.4, c.g.position.z); addMoney(val, _t, e.kind === 2 ? '+' + val + ' ★' : null);
        burst(c.g.position.x, 1.8, c.g.position.z, 4, ['#ffd93d', '#ffffff'], 1.8, 0.5, 0.12); sfx.coin(); vib(6);
        c.key = ''; if (c.state === 'wait' && c.got >= c.need) makeHappy(c);
      });
      return true;
    }
    // un vendeur (toi ou le caissier) sert UN client à la fois : chaque œuf prend du temps
    function sellerTick(S, dt, tEgg) {
      if (S.cur && !(S.cur.state === 'wait' && S.cur.got + S.cur.res < S.cur.need)) releaseSeller(S);
      if (!S.cur) { var c = pickSellCustomer(S); if (!c) return false; S.cur = c; c.srvBy = S; S.t = 0; S.q = 0; }
      if (!hasStockEgg()) return true;                 // il n'y a plus d'œufs : le client attend
      S.t += dt; var c2 = S.cur; c2.srv = Math.min(1, S.t / tEgg);
      var q = Math.floor(c2.srv * 4); if (S.sound && q !== S.q && q < 4) { S.q = q; tone(480 + q * 110, 0.05, 'sine', 0.06); }
      if (S.t >= tEgg) { S.t = 0; S.q = 0; c2.srv = 0; handEgg(c2); }
      return true;
    }

    /* employés */
    var pickers = [], cashier = null;
    function addPicker() {
      var p = makePerson({ shirt: '#4f86ff', pants: '#2c3e6b', skin: SKINS[pickers.length % SKINS.length], hat: 'cap', hatCol: '#2a56c8', hair: 'short', hairCol: pick(HAIRS), overalls: '#ffd23a' });
      p.g.position.set(PEN.x1 + 1.2, 0, GATE_Z); scene.add(p.g);
      var w = { p: p, g: p.g, bag: [], cap: 8, state: 'seek', cd: 0, dep: 0, target: null };
      pickers.push(w); burst(p.g.position.x, 1, p.g.position.z, 12, ['#4f86ff', '#ffffff'], 3, 0.7, 0.15);
    }
    function nearestFreeEgg(x, z) {
      var best = null, bd = 1e9;
      groundEggs.forEach(function (e) { if (e.state === 'ground' && (!e.claimed || e.claimed.dead) && e.born > 0.3) { var d = Math.hypot(e.m.position.x - x, e.m.position.z - z); if (d < bd) { bd = d; best = e; } } });
      return best;
    }
    function updatePickers(dt) {
      var sp = 5.8 + 0.5 * lv.picker;
      pickers.forEach(function (w) {
        var pos = w.g.position, moving = false; w.cd -= dt;
        if (w.state === 'seek') {
          if (w.target && w.target.state !== 'ground') w.target = null;
          if (!w.target) { w.target = nearestFreeEgg(pos.x, pos.z); if (w.target) w.target.claimed = w; }
          if (w.bag.length >= w.cap || (!w.target && w.bag.length > 0)) { w.state = 'deliver'; if (w.target) { w.target.claimed = null; w.target = null; } }
          else if (w.target) {
            var rt = route(pos.x, pos.z, w.target.m.position.x, w.target.m.position.z);
            stepTo(w, rt.x, rt.z, sp, dt); moving = true; collide(pos, 0.4);
            if (Math.hypot(w.target.m.position.x - pos.x, w.target.m.position.z - pos.z) < 1.0 && w.cd <= 0) { if (pickup(w, w.target)) { sfx.pop(); w.cd = 0.12; } w.target = null; }
          } else { var rw = route(pos.x, pos.z, PEN.x1 + 1.5, GATE_Z + 1.5); stepTo(w, rw.x, rw.z, sp * 0.6, dt); moving = true; }
        } else if (w.state === 'deliver') {
          var rd = route(pos.x, pos.z, DEPOT.x, DEPOT.z), dd = stepTo(w, rd.x, rd.z, sp, dt); moving = dd > 0.2; collide(pos, 0.4);
          if (Math.hypot(pos.x - DEPOT.x, pos.z - DEPOT.z) < 1.2) {
            w.dep -= dt; moving = false;
            if (w.dep <= 0 && w.bag.length) { if (depositOne(w)) { sfx.drop(); w.dep = 0.09; } else w.dep = 0.3; }
            if (!w.bag.length) w.state = 'seek';
          }
        }
        if (moving) walkAnim(w.p, sp, dt, 1); else walkAnim(w.p, 0, dt, 0);
        updateBag(w, dt);
      });
    }
    function addCashier() {
      var p = makePerson({ shirt: '#ffffff', pants: '#3b4a6b', skin: '#f1b98b', hat: 'beanie', hatCol: '#4ddc8c', hair: 'long', hairCol: '#6b3b5a', belt: '#4ddc8c' });
      p.g.position.set(15.5, 0, 1.2); p.g.rotation.y = PI; scene.add(p.g);
      cashier = { p: p, g: p.g, cd: 0, anim: 0, S: { cur: null, t: 0, q: 0, sound: false } }; burst(15.5, 1, 1.2, 12, ['#8be04e', '#ffffff'], 3, 0.7, 0.15);
    }
    function updateCashier(dt) {
      if (!cashier) return;
      cashier.cd -= dt; cashier.anim = Math.max(0, cashier.anim - dt); turnTo(cashier.g, PI, dt, 10);
      sellerTick(cashier.S, dt, cashierTime());
      walkAnim(cashier.p, 0, dt, 0); if (cashier.S.cur) { cashier.p.arms[1].rotation.x = -1.1 + Math.sin(time * 8) * 0.2; cashier.p.head.rotation.x = 0.1; }
    }

    /* zones dépôt / comptoir */
    var zones = [];
    function makeZone(p, label, col) {
      var g = new T.Group(); g.position.set(p.x, 0.07, p.z);
      var ring = new T.Mesh(new T.RingGeometry(1.25, 1.5, 36), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 })); ring.rotation.x = -PI / 2; g.add(ring);
      var disc = new T.Mesh(new T.CircleGeometry(1.25, 36), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28 })); disc.rotation.x = -PI / 2; g.add(disc);
      var L = mkTex(256, 96), x = L.x; txt(x, label, 128, 50, 64, '#ffffff', 'rgba(40,30,80,.6)'); L.tex.needsUpdate = true;
      var lab = new T.Mesh(new T.PlaneGeometry(2.2, 0.82), new T.MeshBasicMaterial({ map: L.tex, transparent: true, depthWrite: false })); lab.rotation.x = -PI / 2; lab.position.y = 0.01; g.add(lab);
      scene.add(g); var z = { g: g, ring: ring, disc: disc, p: p, active: false, glow: 0 }; zones.push(z); return z;
    }
    var depotZone = makeZone(DEPOT, 'DÉPÔT', 0xffb938), sellZone = makeZone(SELLP, 'COMPTOIR', 0x4ddc8c);

    /* ---------- panneaux d'amélioration ---------- */
    var pads = [], PADBY = {}, tracked = '';
    function padInfo(p) { var n = p.n, l = lv[n.id], cost = n.cost(l), prog = padProg[n.id] || 0; return { n: n, l: l, st: nodeState(n), cost: cost, prog: prog, afford: (money - inflight) >= cost - prog }; }
    function fitTxt(x, s2, px, py, size, fill, maxW) {
      x.font = '800 ' + size + 'px ' + FONT; while (x.measureText(s2).width > maxW && size > 12) { size -= 1; x.font = '800 ' + size + 'px ' + FONT; }
      txt(x, s2, px, py, size, fill);
    }
    function drawPad(p) {
      var s = padInfo(p), n = s.n, key = s.st + ':' + s.l + ':' + Math.floor(s.prog) + ':' + (s.afford ? 1 : 0) + ':' + (tracked === n.id ? 1 : 0); if (key === p.key) return; p.key = key;
      var x = p.t.x, W = 360, H = 270; x.clearRect(0, 0, W, H);
      rrPath(x, 8, 8, W - 16, H - 16, 40); x.fillStyle = 'rgba(255,255,255,.98)'; x.fill(); x.lineWidth = 10; x.strokeStyle = tracked === n.id ? '#ffe14d' : n.col; x.stroke();
      x.beginPath(); x.arc(W / 2, 62, 46, 0, PI * 2); x.fillStyle = n.col; x.fill(); x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke(); drawIcon(x, n.id, W / 2, 62, 32);
      txt(x, n.name, W / 2, 128, 42, '#4a3a7a'); fitTxt(x, n.desc, W / 2, 160, 22, '#7d6d9e', W - 50);
      if (s.st === 'max') { drawIcon(x, 'check', W / 2 - 54, 205, 30); txt(x, 'MAX', W / 2 + 22, 207, 46, '#2e9d57'); }
      else {
        coinIcon(x, 112, 206, 21); txt(x, fmt(s.cost - s.prog), 196, 208, 46, s.afford ? '#2e9d57' : '#7a4a00');
        var pw = 190; for (var i = 0; i < n.max; i++) { x.fillStyle = i < s.l ? n.col : 'rgba(0,0,0,.14)'; x.beginPath(); x.arc(W / 2 - pw / 2 + (i + 0.5) * pw / n.max, 248, 5.5, 0, PI * 2); x.fill(); }
      }
      p.t.tex.needsUpdate = true;
    }
    function drawMini(p) {
      var s = padInfo(p), n = s.n, key = s.st + ':' + Math.floor(s.prog > 0 ? s.cost - s.prog : s.cost) + ':' + (s.afford ? 1 : 0) + ':' + (tracked === n.id ? 1 : 0); if (key === p.mkey) return; p.mkey = key;
      var x = p.mt.x, W = 200, H = 150; x.clearRect(0, 0, W, H);
      rrPath(x, 6, 6, W - 12, H - 12, 34); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 9; x.strokeStyle = tracked === n.id ? '#ffe14d' : n.col; x.stroke();
      x.beginPath(); x.arc(W / 2, 52, 38, 0, PI * 2); x.fillStyle = n.col; x.fill(); drawIcon(x, n.id, W / 2, 52, 27);
      if (s.st === 'max') { drawIcon(x, 'check', W / 2 - 30, 112, 20); txt(x, 'MAX', W / 2 + 18, 114, 34, '#2e9d57'); }
      else { coinIcon(x, 62, 113, 15); txt(x, fmt(s.cost - s.prog), 116, 115, 36, s.afford ? '#2e9d57' : '#7a4a00'); }
      p.mt.tex.needsUpdate = true;
    }
    NODES.forEach(function (n) {
      var g = new T.Group(); g.position.set(n.x, 0.07, n.z);
      var col = new T.Color(n.col);
      var ring = new T.Mesh(new T.RingGeometry(1.2, 1.45, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 })); ring.rotation.x = -PI / 2; g.add(ring);
      var base = new T.Mesh(new T.CircleGeometry(1.2, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22 })); base.rotation.x = -PI / 2; g.add(base);
      var fill = new T.Mesh(new T.CircleGeometry(1.2, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 })); fill.rotation.x = -PI / 2; fill.position.y = 0.01; fill.scale.set(0.001, 0.001, 0.001); g.add(fill);
      var t = mkTex(360, 270), spr = mkSprite(t, 3.5, 2.63); spr.position.set(0, 3.1, 0); spr.visible = false; g.add(spr);
      var mt = mkTex(200, 150), mini = mkSprite(mt, 1.9, 1.43); mini.position.set(0, 2.1, 0); g.add(mini);
      scene.add(g);
      var p = { n: n, g: g, ring: ring, fill: fill, spr: spr, t: t, mini: mini, mt: mt, x: n.x, z: n.z, key: '', mkey: '', tick: 0, flash: 0, pop: 0, bigS: 0, wasOpen: nodeState(n) !== 'locked' };
      g.visible = p.wasOpen; pads.push(p); PADBY[n.id] = p;
    });
    function visualsFor(id) {
      if (id === 'incu') heatLamp.visible = lv.incu > 0;
      if (id === 'gold') goldNest.visible = lv.gold > 0;
    }
    function slotMatsUpdate(pop) {
      var act = activeSlots();
      for (var i = 0; i < 12; i++) { var on = act.indexOf(i) >= 0; if (on && !slotMats[i].visible && pop) burst(SLOT_X[i], 0.3, SLOT_Z, 8, ['#a66bff', '#fff'], 2, 0.6, 0.14); slotMats[i].visible = on; }
    }
    function checkUnlocks(initial) {
      pads.forEach(function (p) {
        var open = nodeState(p.n) !== 'locked';
        if (open && !p.wasOpen) {
          p.wasOpen = true; p.key = ''; p.mkey = ''; p.g.visible = true;
          if (!initial) {
            p.pop = 1; sfx.unlock(); toast('Nouveau : ' + p.n.name + ' débloqué ! (' + p.n.loc + ')', 'good');
            burst(p.x, 0.6, p.z, 18, ['#ffffff', p.n.col, '#ffe14d'], 4, 0.9, 0.18);
          }
        }
      });
    }
    function applyUpgrade(p) {
      var n = p.n; lv[n.id]++; padProg[n.id] = 0; stats.purchases++;
      if (n.id === 'hen') { var h = addHen(); burst(h.g.position.x, 1, h.g.position.z, 14, ['#ffffff', '#ffd93d'], 3, 0.8, 0.16); }
      else if (n.id === 'bag') { player.cap = bagCap(); rack.scale.set(1, 1 + 0.12 * lv.bag, 1); }
      else if (n.id === 'picker') addPicker();
      else if (n.id === 'cashier' && lv.cashier === 1) addCashier();
      else if (n.id === 'stalls') slotMatsUpdate(true);
      visualsFor(n.id);
      if (tracked === n.id) tracked = '';
      p.flash = 1; p.key = ''; p.mkey = ''; sfx.buy(); vib(30); camShake = 0.35;
      burst(p.x, 0.5, p.z, 28, ['#ffd93d', '#ff7ebd', '#4ddc8c', '#38d6f5', '#a66bff'], 5, 1.0, 0.2);
      floatText(_t.set(p.x, 1.8, p.z), n.name + ' amélioré !', '#fff6a8');
      checkUnlocks(false); doSave(); refreshBadge(); if (shopOpen) renderShop();
    }
    function updatePads(dt) {
      var px = player.g.position.x, pz = player.g.position.z;
      pads.forEach(function (p, i) {
        var n = p.n, l = lv[n.id], st = nodeState(n), maxed = st === 'max';
        if (st === 'locked') { p.g.visible = false; return; }
        p.g.visible = true;
        var dist = Math.hypot(px - p.x, pz - p.z), on = !maxed && dist < 1.45;
        var prog = padProg[n.id] || 0, cost = n.cost(l);
        if (on) {
          p.tick -= dt;
          if (p.tick <= 0) {
            var chunk = Math.max(1, Math.ceil(cost / 22)); chunk = Math.min(chunk, cost - prog);
            if (money - inflight >= chunk) {
              money -= chunk; prog += chunk; padProg[n.id] = prog; updateMoneyHud(); p.tick = 0.045; p.key = ''; p.mkey = ''; sfx.pad(prog / cost);
              var coin = new T.Mesh(G.cyl, M('#ffcb2f')); coin.scale.set(0.22, 0.05, 0.22); coin.position.copy(player.g.position); coin.position.y = 1.6; scene.add(coin);
              (function (cn) { fly({ m: cn }, new T.Vector3(p.x, 0.6, p.z), 0.28, 1.3, function () { scene.remove(cn); }); })(coin);
              if (prog >= cost) applyUpgrade(p);
            } else p.tick = 0.3;
          }
        }
        p.fill.scale.setScalar(Math.max(0.001, maxed ? 0.001 : Math.min(1, (padProg[n.id] || 0) / cost)));
        var pulse = 1 + (on ? 0.07 : 0.025) * Math.sin(time * 5 + i) + (tracked === n.id ? 0.07 * Math.sin(time * 8) : 0); p.ring.scale.set(pulse, pulse, 1);
        p.flash = Math.max(0, p.flash - dt * 2);
        p.ring.material.color.set(p.flash > 0 ? '#ffffff' : (maxed ? '#4ddc8c' : n.col));
        p.pop = Math.max(0, p.pop - dt * 1.6);
        // grande carte seulement de près, petite icône sinon
        var near = dist < 3.6 || p.flash > 0 || p.pop > 0 ? 1 : 0;
        p.bigS += (near - p.bigS) * (1 - Math.exp(-dt * 12));
        var ps = p.pop > 0 ? 1 + Math.sin((1 - p.pop) * PI) * 0.4 : 1;
        p.spr.visible = p.bigS > 0.04; p.spr.scale.set(3.5 * p.bigS * ps, 2.63 * p.bigS * ps, 1);
        p.mini.visible = p.bigS < 0.96; var ms = (1 - p.bigS) * ps * (1 + (tracked === n.id ? 0.1 * Math.sin(time * 8) : 0)); p.mini.scale.set(1.9 * ms, 1.43 * ms, 1);
        p.mini.position.y = 2.1 + Math.sin(time * 2.4 + i) * 0.1 + p.flash * 0.3; p.spr.position.y = 3.1 + p.flash * 0.3;
        if (p.spr.visible) drawPad(p); if (p.mini.visible) drawMini(p);
      });
    }

    /* ---------- panneau de liste des améliorations ---------- */
    var shopOpen = false, shop = el('fm-shop', '<div class="fm-sc"><div class="fm-sh"><span>Améliorations</span><button class="fm-x">' + svg('<path d="M6 6l12 12M18 6L6 18"/>', 22) + '</button></div><div class="fm-sl"></div></div>');
    var shopList = shop.children[0].children[1], shopClose = shop.children[0].children[0].lastChild;
    function openShop() { shopOpen = true; renderShop(); shop.style.display = 'flex'; joyOn = false; joyV.x = joyV.z = 0; joy.style.display = 'none'; }
    function closeShop() { shopOpen = false; shop.style.display = 'none'; }
    function track(id) {
      var n = NODE[id]; tracked = id; closeShop();
      toast('Va au ' + n.loc.toLowerCase() + ' : ' + n.name, 'good'); PADBY[id].key = ''; PADBY[id].mkey = '';
    }
    function renderShop() {
      shopList.innerHTML = '';
      LOCS.forEach(function (loc) {
        var h = document.createElement('div'); h.className = 'fm-loc'; h.textContent = loc; shopList.appendChild(h);
        NODES.filter(function (n) { return n.loc === loc; }).forEach(function (n) {
          var st = nodeState(n), l = lv[n.id], cost = n.cost(l), prog = padProg[n.id] || 0, afford = (money - inflight) >= cost - prog;
          var c = document.createElement('div'); c.className = 'fm-card' + (st === 'locked' ? ' lk' : '') + (st === 'max' ? ' mx' : ''); c.style.setProperty('--c', n.col);
          var ic = document.createElement('div'); ic.className = 'fm-ci'; var cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; ic.appendChild(cv);
          drawIcon(cv.getContext('2d'), st === 'locked' ? 'lock' : n.id, 32, 34, 24); c.appendChild(ic);
          var b = document.createElement('div'); b.className = 'fm-cb';
          var pips = ''; for (var i = 0; i < n.max; i++) pips += '<i class="' + (i < l ? 'on' : '') + '"></i>';
          b.innerHTML = '<div class="fm-cn"></div><div class="fm-cd"></div><div class="fm-pips">' + pips + '</div>';
          b.children[0].textContent = n.name; b.children[1].textContent = n.desc; c.appendChild(b);
          var pr = document.createElement('div');
          if (st === 'locked') { pr.className = 'fm-cp req'; pr.textContent = 'Requiert ' + reqText(n); }
          else if (st === 'max') { pr.className = 'fm-cp ok'; pr.textContent = 'MAX'; }
          else { pr.className = 'fm-cp' + (afford ? ' ok' : ''); pr.innerHTML = '<div class="fm-coin"></div><span></span>'; pr.lastChild.textContent = fmt(cost - prog); }
          c.appendChild(pr);
          c.addEventListener('click', function () {
            if (st === 'locked') { toast('Débloque d’abord : ' + reqText(n), 'bad'); sfx.bad(); }
            else if (st === 'max') { toast(n.name + ' est au maximum', 'good'); }
            else track(n.id);
          });
          shopList.appendChild(c);
        });
      });
    }
    function refreshBadge() {
      var c = 0; NODES.forEach(function (n) { var st = nodeState(n); if (st === 'open' && (money - inflight) >= n.cost(lv[n.id]) - (padProg[n.id] || 0)) c++; });
      badge.style.display = c ? 'flex' : 'none'; badge.textContent = c;
    }
    shopBtn.addEventListener('click', function () { initAudio(); sfx.pop(); if (shopOpen) closeShop(); else openShop(); });
    shopClose.addEventListener('click', closeShop);
    shop.addEventListener('click', function (e) { if (e.target === shop) closeShop(); });

    /* ---------- quêtes / niveau ---------- */
    var qT = 0;
    function updateQuests(dt) {
      qT -= dt; if (qT > 0) return; qT = 0.25;
      var q = curQuest();
      if (qVal(q) >= q.n) {
        var r = questBox.getBoundingClientRect(), rr = root.getBoundingClientRect();
        qi++; if (qi >= QUESTS.length && eqn) eqn = 0;
        addMoneyScreen(q.r, r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2, '+' + q.r);
        toast('Quête terminée : ' + q.t, 'gold'); sfx.quest();
        questBox.classList.remove('done'); void questBox.offsetWidth; questBox.classList.add('done');
        burst(player.g.position.x, 2.2, player.g.position.z, 16, ['#ffd23a', '#fff', '#ff7ebd'], 4, 0.9, 0.18);
        doSave();
      }
      updateQuestHud();
      var L = farmLevel();
      if (L > farmLv) { farmLv = L; toast('Ta ferme passe niveau ' + L + ' !', 'gold'); sfx.quest(); burst(player.g.position.x, 2, player.g.position.z, 24, ['#ffd23a', '#a66bff', '#ff7ebd', '#38d6f5'], 5, 1.0, 0.2); camShake = 0.25; }
      updateLevelHud(); refreshBadge();
    }

    /* ---------- entrées ---------- */
    var keys = {}, joyOn = false, joyId = -1, joyOx = 0, joyOy = 0, joyV = { x: 0, z: 0 };
    function kd(e) {
      var k = e.key.toLowerCase(); keys[k] = true; initAudio();
      if (k === 'escape') { if (shopOpen) closeShop(); else if (pseudoFs) exitPseudo(); else if (overlay && !isFs()) closeFn(); }
      if (k === 'b') { if (shopOpen) closeShop(); else openShop(); }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    }
    function ku(e) { keys[e.key.toLowerCase()] = false; }
    function onDown(e) {
      initAudio(); if (e.target !== canvasEl || joyOn || shopOpen) return;
      joyOn = true; joyId = e.pointerId; joyOx = e.clientX; joyOy = e.clientY;
      var r = root.getBoundingClientRect(); joy.style.display = 'block'; joy.style.left = (joyOx - r.left) + 'px'; joy.style.top = (joyOy - r.top) + 'px'; knob.style.transform = 'translate(0,0)';
      try { canvasEl.setPointerCapture(e.pointerId); } catch (er) {}
    }
    function onMove(e) {
      if (!joyOn || e.pointerId !== joyId) return;
      var dx = e.clientX - joyOx, dy = e.clientY - joyOy, R = 52, d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; d = R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      var m = d / R; if (m < 0.12) m = 0; joyV.x = d ? dx / d * m : 0; joyV.z = d ? dy / d * m : 0;
    }
    function onUp(e) { if (!joyOn || e.pointerId !== joyId) return; joyOn = false; joyV.x = joyV.z = 0; joy.style.display = 'none'; }
    function inputVec() {
      var x = joyV.x, z = joyV.z;
      if (keys['arrowleft'] || keys['a'] || keys['q']) x -= 1; if (keys['arrowright'] || keys['d']) x += 1;
      if (keys['arrowup'] || keys['w'] || keys['z']) z -= 1; if (keys['arrowdown'] || keys['s']) z += 1;
      var l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } return { x: x, z: z };
    }
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
    canvasEl.addEventListener('pointerdown', onDown); canvasEl.addEventListener('pointermove', onMove);
    canvasEl.addEventListener('pointerup', onUp); canvasEl.addEventListener('pointercancel', onUp);
    function stopTouch(e) { e.preventDefault(); }
    canvasEl.addEventListener('touchmove', stopTouch, { passive: false }); canvasEl.addEventListener('contextmenu', stopTouch);
    sndBtn.addEventListener('click', function () { muted = !muted; sndBtn.innerHTML = sndSvg(); initAudio(); sfx.pop(); doSave(); });

    /* ---------- plein écran ---------- */
    var pseudoFs = false, savedCss = '';
    function isFs() { return pseudoFs || document.fullscreenElement === root || document.webkitFullscreenElement === root; }
    function enterPseudo() {
      if (pseudoFs) return; savedCss = root.style.cssText;
      root.style.cssText = savedCss + ';position:fixed;left:0;top:0;width:100vw;height:100vh;transform:none;border-radius:0;z-index:99999;box-shadow:none;';
      pseudoFs = true; fsBtn.innerHTML = fsSvg(true); resize();
    }
    function exitPseudo() { if (!pseudoFs) return; root.style.cssText = savedCss; pseudoFs = false; fsBtn.innerHTML = fsSvg(false); resize(); }
    function toggleFs() {
      if (isFs()) { if (pseudoFs) exitPseudo(); else { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) ex.call(document); } return; }
      var req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (req) { try { var p = req.call(root); if (p && p.catch) p.catch(enterPseudo); } catch (e) { enterPseudo(); } } else enterPseudo();
    }
    function onFsChange() {
      var f = !pseudoFs && (document.fullscreenElement === root || document.webkitFullscreenElement === root);
      root.style.borderRadius = f ? '0' : (overlay ? '20px' : '16px'); fsBtn.innerHTML = fsSvg(f || pseudoFs); resize();
    }
    fsBtn.addEventListener('click', toggleFs);
    document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange);

    /* ---------- caméra / resize ---------- */
    var camPos = new T.Vector3(0, 0, 3), camShake = 0, zoom = 1;
    function resize() {
      if (autoH && !isFs() && root.parentNode) {
        var pw = root.parentNode.clientWidth || 800;
        root.style.height = Math.round(Math.max(440, Math.min(pw * 0.62, window.innerHeight * 0.88))) + 'px';
      }
      var w = root.clientWidth || 800, h = root.clientHeight || 500;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix(); zoom = Math.max(1, Math.pow(1.7 / camera.aspect, 0.85));
    }
    window.addEventListener('resize', resize);
    var ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(root); }
    function updateCamera(dt) {
      var px = player.g.position.x, pz = player.g.position.z;
      var tx = Math.max(-19, Math.min(17, px * 0.85)), tz = Math.max(-4, Math.min(6, pz * 0.7 + 0.3));
      var k = 1 - Math.exp(-dt * 5); camPos.x += (tx - camPos.x) * k; camPos.z += (tz - camPos.z) * k;
      camShake = Math.max(0, camShake - dt * 1.4);
      var sx = (rand() - 0.5) * camShake * 0.5, sy = (rand() - 0.5) * camShake * 0.5;
      camera.position.set(camPos.x + sx, 19 * zoom + sy, camPos.z + 13.5 * zoom); camera.lookAt(camPos.x, 0, camPos.z - 0.6);
      sun.position.set(px + 10, 22, pz + 9); sun.target.position.set(px, 0, pz);
    }

    /* ---------- guide ---------- */
    var arrow = new T.Mesh(new T.ConeGeometry(0.45, 0.9, 8), new T.MeshBasicMaterial({ color: 0xffe14d }));
    arrow.rotation.x = PI; arrow.visible = false; arrow.scale.setScalar(1.4); scene.add(arrow);
    var gdots = [];
    for (var gd = 0; gd < 10; gd++) { var dm = new T.Mesh(new T.CircleGeometry(0.2, 10), new T.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9 })); dm.rotation.x = -PI / 2; dm.visible = false; scene.add(dm); gdots.push(dm); }
    var hintText = '';
    function setHint(s) { if (s === hintText) return; hintText = s; if (s) { hintEl.textContent = s; hintEl.style.opacity = '1'; } else hintEl.style.opacity = '0'; }
    var guideT = 0, guideTarget = null, guideCol = 0xffe14d;
    function updateGuide(dt) {
      guideT -= dt;
      if (guideT <= 0) {
        guideT = 0.25; guideTarget = null; var hint = '';
        if (tracked) {
          var tn = NODE[tracked]; guideTarget = { x: tn.x, z: tn.z }; hint = 'Va au ' + tn.loc.toLowerCase() + ' pour acheter : ' + tn.name;
        } else if (!firstSale) {
          var waiting = customers.some(function (c) { return c.state === 'wait'; });
          if (player.bag.length === 0 && stockCount === 0) {
            var e = nearestFreeEgg(player.g.position.x, player.g.position.z);
            if (e) { guideTarget = e.m.position; hint = 'Ramasse les œufs en passant dessus !'; } else hint = 'Attends que les poules pondent…';
          } else if (player.bag.length > 0) { guideTarget = DEPOT; hint = 'Dépose les œufs sur le comptoir !'; }
          else if (stockCount > 0) { guideTarget = SELLP; hint = playerSeller.cur ? 'Service en cours… reste sur le comptoir !' : (waiting ? 'Place-toi au comptoir : servir prend un peu de temps !' : 'Un client arrive…'); }
        } else if (stats.purchases === 0) {
          var cheap = null; pads.forEach(function (p) { if (nodeState(p.n) !== 'open') return; var c = p.n.cost(lv[p.n.id]); if (!cheap || c < cheap.c) cheap = { p: p, c: c }; });
          if (cheap) { guideTarget = { x: cheap.p.x, z: cheap.p.z }; hint = (money - inflight) >= cheap.c ? 'Tiens-toi sur un panneau pour acheter !' : 'Continue de vendre pour acheter ta 1ère amélioration !'; }
        }
        setHint(hint);
      }
      if (guideTarget) {
        arrow.visible = true; arrow.position.set(guideTarget.x, 3.4 + Math.sin(time * 5) * 0.25, guideTarget.z);
        if (guideTarget.y !== undefined) arrow.position.y = guideTarget.y + 1.8 + Math.sin(time * 5) * 0.25;
        arrow.rotation.y += dt * 3;
        var gx = guideTarget.x - player.g.position.x, gz = guideTarget.z - player.g.position.z, gl = Math.hypot(gx, gz);
        for (var di = 0; di < gdots.length; di++) {
          var u = ((di / gdots.length) + time * 0.35) % 1, dist = 1.6 + u * Math.max(0, gl - 3.0);
          gdots[di].visible = gl > 4.2; if (gl > 4.2) { gdots[di].position.set(player.g.position.x + gx / gl * dist, 0.1, player.g.position.z + gz / gl * dist); gdots[di].scale.setScalar(0.6 + Math.sin(u * PI) * 0.7); }
        }
      } else { arrow.visible = false; for (var dj = 0; dj < gdots.length; dj++) gdots[dj].visible = false; }
    }

    /* ---------- joueur ---------- */
    var pickCd = 0, depCd = 0, sellCd = 0, wasFull = false;
    function updatePlayer(dt) {
      var inp = shopOpen ? { x: 0, z: 0 } : inputVec(), sp = moveSpeed(), p = player.g.position, k = 1 - Math.exp(-dt * 12);
      player.vx += (inp.x * sp - player.vx) * k; player.vz += (inp.z * sp - player.vz) * k;
      p.x += player.vx * dt; p.z += player.vz * dt; collide(p, 0.4);
      p.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, p.x)); p.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, p.z));
      var spd = Math.hypot(player.vx, player.vz);
      if (spd > 0.4) turnTo(player.g, Math.atan2(player.vx, player.vz), dt, 14);
      walkAnim(player, spd, dt, Math.min(1, spd / 4)); if (spd < 0.3) walkAnim(player, 0, dt, 0);
      pickCd -= dt;
      if (pickCd <= 0) {
        var best = null, bd = pickRadius();
        for (var i = 0; i < groundEggs.length; i++) {
          var e = groundEggs[i]; if (e.state !== 'ground' || e.born < 0.25) continue;
          var d = Math.hypot(e.m.position.x - p.x, e.m.position.z - p.z); if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          if (player.bag.length < player.cap) { pickup(player, best); sfx.pick(); vib(5); pickCd = 0.07; }
          else { bagFlash = 0.4; if (!wasFull) { sfx.bad(); wasFull = true; toast('Sac plein ! Va au dépôt', 'bad'); } pickCd = 0.3; }
        }
      }
      if (player.bag.length < player.cap) wasFull = false;
      var inDepot = Math.hypot(p.x - DEPOT.x, p.z - DEPOT.z) < 1.5, inSell = Math.hypot(p.x - SELLP.x, p.z - SELLP.z) < 1.5;
      depotZone.active = inDepot; sellZone.active = inSell; depCd -= dt;
      if (inDepot && depCd <= 0 && player.bag.length) { if (depositOne(player)) { sfx.drop(); vib(4); depCd = 0.07; } else depCd = 0.25; }
      if (inSell) sellerTick(playerSeller, dt, sellTime()); else if (playerSeller.cur) releaseSeller(playerSeller);
      if (playerSeller.cur) { player.arms[1].rotation.x = -1.2 + Math.sin(time * 8) * 0.15; player.arms[0].rotation.x = -0.8; }
      updateBag(player, dt); bagFlash = Math.max(0, bagFlash - dt);
      bagSprite.position.y = 3.45 + (bagFlash > 0 ? Math.sin(time * 40) * 0.05 : 0); drawBagLabel();
    }

    /* ---------- boucle ---------- */
    var last = performance.now(), raf = 0, alive = true, saveT = 0;
    function updateDecor(dt) {
      blades.rotation.z -= dt * 0.9;
      clouds.forEach(function (c) { c.position.x += dt * 0.6; if (c.position.x > 100) c.position.x = -100; });
      zones.forEach(function (z) {
        z.glow += ((z.active ? 1 : 0) - z.glow) * (1 - Math.exp(-dt * 10));
        var s = 1 + z.glow * 0.08 + Math.sin(time * 3) * 0.02; z.g.scale.set(s, 1, s); z.disc.material.opacity = 0.25 + z.glow * 0.35;
      });
      for (var i = 0; i < STOCK_CAP; i++) {
        var s = stockSlots[i]; if (!s || !s.landed) continue;
        var e = s.egg; if (e.sq > 0) { e.sq -= dt; var q = Math.sin(Math.max(0, e.sq) / 0.25 * PI) * 0.25; e.m.scale.set(1 + q, 1 - q, 1); }
      }
      if (heatLamp.visible) heatLamp.children[2].material.color.setHex(Math.sin(time * 6) > 0 ? 0xffc766 : 0xffb347);
      if (goldNest.visible) { goldNest.children[1].rotation.y += dt * 1.5; goldNest.children[1].position.y = 0.55 + Math.sin(time * 3) * 0.05; if (rand() < dt * 2) burst(goldNest.position.x, 0.8, goldNest.position.z, 1, ['#fff3a6'], 0.6, 0.8, 0.1, 0); }
      drawStock(); drawPrice(); drawBillboard();
    }
    function frame() {
      if (!alive) return;
      if (!root.isConnected) { closeFn(); return; }
      raf = requestAnimationFrame(frame);
      var now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!paused && !shopOpen) {
        time += dt; comboT -= dt; if (comboT <= 0) combo = 0;
        updatePlayer(dt); updateHens(dt); updateGroundEggs(dt); updatePickers(dt); updateCashier(dt);
        updateCustomers(dt); updatePads(dt); updateFliers(dt); updateParts(dt); updateCritters(dt);
        updateQuests(dt); updateDecor(dt); updateGuide(dt); updateCamera(dt);
        saveT += dt; if (saveT > 4) { saveT = 0; doSave(); }
      }
      renderer.render(scene, camera);
    }

    /* ---------- démarrage ---------- */
    for (var h0 = 0; h0 < henCount(); h0++) addHen();
    for (var p0 = 0; p0 < lv.picker; p0++) addPicker();
    if (lv.cashier > 0) addCashier();
    player.cap = bagCap(); rack.scale.set(1, 1 + 0.12 * lv.bag, 1);
    visualsFor('incu'); visualsFor('gold'); slotMatsUpdate(false);
    for (var e0 = 0; e0 < 8; e0++) {
      var egg0 = newEgg(e0 === 4 ? 1 : 0); egg0.m.position.set(PEN.x1 - 1.6 - (e0 % 3) * 1.2, 0.26, GATE_Z - 1.4 + Math.floor(e0 / 3) * 1.4 + (e0 % 3) * 0.3); egg0.born = 1; egg0.m.scale.setScalar(1); groundEggs.push(egg0);
    }
    checkUnlocks(true); drawBagLabel(true); drawStock(); drawPrice(); drawBillboard(); pads.forEach(drawPad);
    updateQuestHud(); updateLevelHud(); refreshBadge();
    resize(); camPos.set(4, 0, 4);
    if (!stats.picked && !stats.purchases) toast('Bienvenue à la ferme !', 'good');
    function vis() { if (document.hidden) doSave(); }
    document.addEventListener('visibilitychange', vis);
    raf = requestAnimationFrame(frame);

    /* ---------- fermeture ---------- */
    function cleanup() {
      if (!alive) return; alive = false;
      cancelAnimationFrame(raf); doSave();
      document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku);
      document.removeEventListener('fullscreenchange', onFsChange); document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      if (document.fullscreenElement === root && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
      if (ac) { try { ac.close(); } catch (e) {} ac = null; }
      try { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {}
      removeRoot();
    }
    return { cleanup: cleanup };
  }

  window.startFermeTycoon = startFermeTycoon;
  if (typeof module !== 'undefined' && module.exports) module.exports = startFermeTycoon;
})();