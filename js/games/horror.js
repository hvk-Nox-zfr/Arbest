// ============================================================
// PATIENTE 13 — jeu d'horreur 3D à la première personne
// Three.js (r128) + audio 100 % procédural (aucun fichier externe)
// Point d'entrée : window.startHorrorGame()   Nettoyage : window._horrorCleanup()
// ============================================================
(function () {
  'use strict';

  const N = 9;          // taille du labyrinthe (N x N cellules)
  const S = 4;          // taille d'une cellule
  const H = 3.2;        // hauteur sous plafond
  const T = 0.35;       // épaisseur des murs
  const FUSES = 5;      // fusibles à trouver
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  window.startHorrorGame = function () {
    if (typeof THREE === 'undefined') { console.error('Three.js manquant'); return; }
    if (typeof window._horrorCleanup === 'function') window._horrorCleanup();

    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const container = document.querySelector('.canvas-container');
    const gameCanvas = document.getElementById('game-canvas');
    const prevMaxWidth = container.style.maxWidth;
    gameCanvas.classList.add('hidden');
    container.style.maxWidth = 'min(1000px, 100%)';

    // ------------------------------------------------------------
    // CSS + DOM
    // ------------------------------------------------------------
    const style = document.createElement('style');
    style.id = 'hz-style';
    style.textContent = `
      .hz-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none;color:#d8d0c0;font-family:'Rajdhani',sans-serif}
      .hz-wrap:fullscreen,.hz-wrap:-webkit-full-screen{aspect-ratio:auto;width:100vw;height:100vh}
      .hz-wrap.hz-pseudofs{position:fixed;inset:0;width:100vw;height:100dvh;aspect-ratio:auto;z-index:1000000}
      .hz-wrap canvas.hz-gl{position:absolute;inset:0;width:100%;height:100%;display:block}
      .hz-grain{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;mix-blend-mode:overlay;opacity:.22;pointer-events:none}
      .hz-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 38%,rgba(0,0,0,.9) 100%);opacity:.85}
      .hz-red{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 30%,rgba(120,0,0,.75) 100%);opacity:0}
      .hz-static{position:absolute;inset:0;pointer-events:none;opacity:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 3px)}
      .hz-flash{position:absolute;inset:0;pointer-events:none;background:#fff;opacity:0}
      .hz-slit{position:absolute;inset:0;pointer-events:none;display:none;background:linear-gradient(#000 0 44%,transparent 44% 56%,#000 56% 100%)}
      .hz-hud{position:absolute;inset:0;pointer-events:none}
      .hz-top{position:absolute;top:10px;left:14px;right:60px;display:flex;justify-content:space-between;font-weight:700;letter-spacing:2px;font-size:clamp(.7rem,1.8vw,1.05rem);text-shadow:0 0 6px #000}
      .hz-fuses{color:#ffb347}
      .hz-bars{position:absolute;left:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;width:min(190px,32%)}
      .hz-bar{height:7px;background:rgba(255,255,255,.12);border-radius:4px;overflow:hidden}
      .hz-bar i{display:block;height:100%;width:100%;background:#e8d9a0;transition:width .15s}
      .hz-bar.st i{background:#7fb6ff}
      .hz-lbl{font-size:.6rem;letter-spacing:2px;opacity:.7;margin-bottom:-3px}
      .hz-msg{position:absolute;left:0;right:0;bottom:16%;text-align:center;font-size:clamp(.85rem,2.2vw,1.35rem);letter-spacing:2px;color:#e6dcc4;text-shadow:0 0 8px #000,0 0 18px #000;opacity:0;transition:opacity .6s;padding:0 8%}
      .hz-prompt{position:absolute;left:0;right:0;top:60%;text-align:center;font-weight:700;letter-spacing:2px;font-size:clamp(.8rem,1.8vw,1.1rem);color:#fff;text-shadow:0 0 6px #000;opacity:0;transition:opacity .15s}
      .hz-cross{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:rgba(255,255,255,.45)}
      .hz-fsbtn{position:absolute;top:8px;right:10px;z-index:30;background:rgba(0,0,0,.55);color:#ddd;border:1px solid rgba(255,255,255,.35);border-radius:6px;font-size:1.2rem;line-height:1;padding:.35rem .6rem;cursor:pointer}
      .hz-fsbtn:hover{background:#7a0000;border-color:#f33}
      .hz-screen{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.9rem;text-align:center;padding:1rem;overflow:auto}
      .hz-screen h1{font-family:'Press Start 2P',cursive;font-size:clamp(1.1rem,4vw,2.4rem);color:#b30000;text-shadow:0 0 18px #700,2px 2px #000;letter-spacing:3px}
      .hz-screen h3{font-size:clamp(.8rem,1.8vw,1.1rem);letter-spacing:4px;color:#8a8a78;font-weight:500}
      .hz-screen p{max-width:640px;font-size:clamp(.8rem,1.7vw,1.05rem);line-height:1.4;color:#c4bba8}
      .hz-warn{color:#ff9b3d!important;font-weight:700}
      .hz-btn{background:transparent;color:#e8d9a0;border:2px solid #b30000;padding:.7rem 1.3rem;font-family:'Press Start 2P',cursive;font-size:clamp(.5rem,1.4vw,.75rem);cursor:pointer;border-radius:4px;box-shadow:0 0 12px rgba(179,0,0,.4);transition:all .15s}
      .hz-btn:hover{background:#b30000;color:#fff;box-shadow:0 0 24px #f00}
      .hz-touch{position:absolute;inset:0;display:none;z-index:10}
      .hz-zl,.hz-zr{position:absolute;top:0;bottom:0;touch-action:none}
      .hz-zl{left:0;width:42%}.hz-zr{right:0;width:58%}
      .hz-stick{position:absolute;width:96px;height:96px;margin:-48px;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);display:none}
      .hz-knob{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;background:rgba(255,255,255,.3)}
      .hz-tbtns{position:absolute;right:14px;bottom:14px;display:flex;gap:10px}
      .hz-tb{pointer-events:auto;width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.5);border:2px solid rgba(255,255,255,.35);color:#fff;font-size:1.1rem;font-weight:700}
      .hz-tb:active{background:rgba(179,0,0,.7)}
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'hz-wrap';
    wrap.innerHTML = `
      <canvas class="hz-gl"></canvas>
      <canvas class="hz-grain" width="160" height="90"></canvas>
      <div class="hz-vig"></div><div class="hz-red"></div><div class="hz-static"></div>
      <div class="hz-slit"></div><div class="hz-flash"></div>
      <div class="hz-hud">
        <div class="hz-top"><span class="hz-obj">TROUVE LES FUSIBLES</span><span class="hz-fuses">FUSIBLES 0/${FUSES}</span></div>
        <div class="hz-bars">
          <div class="hz-lbl">LAMPE</div><div class="hz-bar"><i class="hz-batt"></i></div>
          <div class="hz-lbl">ENDURANCE</div><div class="hz-bar st"><i class="hz-stam"></i></div>
        </div>
        <div class="hz-msg"></div><div class="hz-prompt"></div><div class="hz-cross"></div>
      </div>
      <div class="hz-touch">
        <div class="hz-zl"><div class="hz-stick"><div class="hz-knob"></div></div></div>
        <div class="hz-zr"></div>
        <div class="hz-tbtns">
          <button class="hz-tb" data-k="run">RUN</button>
          <button class="hz-tb" data-k="flash">💡</button>
          <button class="hz-tb" data-k="use">E</button>
        </div>
      </div>
      <button class="hz-fsbtn" title="Plein écran (touche G)">⛶</button>
      <div class="hz-screen hz-intro">
        <h3>ASILE SAINT-ARBEST — SOUS-SOL -2</h3>
        <h1>PATIENTE 13</h1>
        <p>Tu t'es réveillé dans les couloirs d'un asile abandonné. Le courant est coupé. Trouve les <b>${FUSES} fusibles</b> pour rouvrir la porte de sortie.<br>Mais <b>elle</b> rôde ici. Elle voit ta lampe, elle entend tes pas. Cache-toi dans les casiers. Ne cours que si tu n'as pas le choix.</p>
        <p class="hz-warn">⚠ Jeu d'horreur : jumpscares, flashs lumineux et sons forts. Casque conseillé, volume modéré.</p>
        <button class="hz-btn hz-go-fs">⛶ PLEIN ÉCRAN & JOUER</button>
        <button class="hz-btn hz-go">▶ JOUER EN FENÊTRE</button>
      </div>
      <div class="hz-screen hz-pause hidden">
        <h1>PAUSE</h1>
        <p>Elle attend… Clique pour reprendre.</p>
        <button class="hz-btn hz-resume">▶ REPRENDRE</button>
      </div>`;
    container.appendChild(wrap);
    const $ = s => wrap.querySelector(s);
    const glCanvas = $('.hz-gl'), grain = $('.hz-grain'), gctx = grain.getContext('2d');
    const elVig = $('.hz-vig'), elRed = $('.hz-red'), elStatic = $('.hz-static'), elFlash = $('.hz-flash'), elSlit = $('.hz-slit');
    const elMsg = $('.hz-msg'), elPrompt = $('.hz-prompt'), elObj = $('.hz-obj'), elFuses = $('.hz-fuses');
    const elBatt = $('.hz-batt'), elStam = $('.hz-stam');
    const scrIntro = $('.hz-intro'), scrPause = $('.hz-pause');
    if (isTouch) $('.hz-touch').style.display = 'block';

    // ------------------------------------------------------------
    // Génération du labyrinthe
    // ------------------------------------------------------------
    const vw = Array.from({ length: N }, () => Array(N + 1).fill(true));      // murs verticaux  vw[z][x]
    const hw = Array.from({ length: N + 1 }, () => Array(N).fill(true));      // murs horizontaux hw[z][x]
    (function carve() {
      const seen = Array.from({ length: N }, () => Array(N).fill(false));
      const stack = [[0, 0]]; seen[0][0] = true;
      while (stack.length) {
        const [x, z] = stack[stack.length - 1];
        const opts = [];
        if (x + 1 < N && !seen[z][x + 1]) opts.push([x + 1, z, () => vw[z][x + 1] = false]);
        if (x - 1 >= 0 && !seen[z][x - 1]) opts.push([x - 1, z, () => vw[z][x] = false]);
        if (z + 1 < N && !seen[z + 1][x]) opts.push([x, z + 1, () => hw[z + 1][x] = false]);
        if (z - 1 >= 0 && !seen[z - 1][x]) opts.push([x, z - 1, () => hw[z][x] = false]);
        if (!opts.length) { stack.pop(); continue; }
        const o = opts[(Math.random() * opts.length) | 0];
        o[2](); seen[o[1]][o[0]] = true; stack.push([o[0], o[1]]);
      }
      for (let i = 0; i < N * N * 0.22; i++) {   // boucles pour pouvoir fuir en rond
        if (Math.random() < 0.5) vw[(Math.random() * N) | 0][1 + ((Math.random() * (N - 1)) | 0)] = false;
        else hw[1 + ((Math.random() * (N - 1)) | 0)][(Math.random() * N) | 0] = false;
      }
    })();
    const canGo = (cx, cz, d) => d === 0 ? !vw[cz][cx + 1] : d === 1 ? !vw[cz][cx] : d === 2 ? !hw[cz + 1][cx] : !hw[cz][cx];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const cellOf = v => clamp(Math.floor(v / S), 0, N - 1);
    const cc = c => (c + 0.5) * S;

    function bfs(sx, sz) {
      const dist = Array.from({ length: N }, () => Array(N).fill(-1)), par = Array.from({ length: N }, () => Array(N).fill(null));
      const q = [[sx, sz]]; dist[sz][sx] = 0;
      while (q.length) {
        const [x, z] = q.shift();
        for (let d = 0; d < 4; d++) {
          if (!canGo(x, z, d)) continue;
          const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
          if (dist[nz][nx] >= 0) continue;
          dist[nz][nx] = dist[z][x] + 1; par[nz][nx] = [x, z]; q.push([nx, nz]);
        }
      }
      return { dist, par };
    }
    function pathTo(fx, fz, tx, tz) {
      const { par } = bfs(fx, fz), path = []; let cur = [tx, tz];
      while (cur && !(cur[0] === fx && cur[1] === fz)) { path.unshift(cur); cur = par[cur[1]][cur[0]]; }
      return path;
    }

    // Rectangles de collision
    const wallRects = [], propRects = [];
    const mkRect = (x0, x1, z0, z1) => ({ x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2 });
    const wallList = [];   // { rect, kind }
    for (let z = 0; z < N; z++) for (let x = 0; x <= N; x++) if (vw[z][x]) {
      const r = mkRect(x * S - T / 2, x * S + T / 2, z * S + T / 2, (z + 1) * S - T / 2); wallRects.push(r); wallList.push(r);
    }
    for (let z = 0; z <= N; z++) for (let x = 0; x < N; x++) if (hw[z][x]) {
      const r = mkRect(x * S + T / 2, (x + 1) * S - T / 2, z * S - T / 2, z * S + T / 2); wallRects.push(r);
      if (z === N && x === N - 1) r.door = true; else wallList.push(r);
    }
    const postRects = [];
    for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
      const touch = (z > 0 && vw[z - 1][x]) || (z < N && vw[z][x]) || (x > 0 && hw[z][x - 1]) || (x < N && hw[z][x]);
      if (touch) { const r = mkRect(x * S - T / 2, x * S + T / 2, z * S - T / 2, z * S + T / 2); wallRects.push(r); postRects.push(r); }
    }
    const doorRect = wallRects.find(r => r.door);

    // ------------------------------------------------------------
    // Textures procédurales
    // ------------------------------------------------------------
    function mkTex(w, h, draw, rep) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
      return t;
    }
    function speckle(g, w, h, n, cols) {
      for (let i = 0; i < n; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(1, 3)); }
    }
    const PHRASES = ['ELLE T\'ENTEND', 'NE COURS PAS', 'REGARDE DERRIÈRE TOI', 'AIDEZ-MOI', 'PATIENTE 13', 'ELLE NE DORT JAMAIS', 'SORTIE = MORT', 'ILS SONT DANS LES MURS'];
    function wallTex(variant) {
      return mkTex(256, 192, (g, w, h) => {
        g.fillStyle = '#7b8575'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#4b5849'; g.fillRect(0, h * 0.55, w, h * 0.45);
        g.fillStyle = '#262c25'; g.fillRect(0, h * 0.55 - 2, w, 4);
        speckle(g, w, h, 2600, ['rgba(0,0,0,.13)', 'rgba(255,255,255,.06)', 'rgba(50,35,10,.12)']);
        for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(45,30,10,${rnd(.07, .2)})`; g.fillRect(rnd(0, w), 0, rnd(5, 24), rnd(40, h)); }
        for (let i = 0; i < 5; i++) {   // peinture écaillée
          g.fillStyle = `rgba(190,190,170,${rnd(.1, .25)})`; g.beginPath();
          const px = rnd(0, w), py = rnd(0, h); g.moveTo(px, py);
          for (let k = 0; k < 6; k++) g.lineTo(px + rnd(-18, 18), py + rnd(-14, 14)); g.fill();
        }
        g.strokeStyle = 'rgba(10,10,10,.55)'; g.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          let x = rnd(0, w), y = rnd(0, h * .4); g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 7; k++) { x += rnd(-10, 10); y += rnd(6, 18); g.lineTo(x, y); } g.stroke();
        }
        if (variant === 1) {   // mains ensanglantées
          for (let i = 0; i < 3; i++) {
            const x = rnd(40, w - 40), y = rnd(30, h * .5);
            g.fillStyle = 'rgba(95,5,5,.85)'; g.beginPath(); g.ellipse(x, y, 11, 14, 0, 0, 7); g.fill();
            for (let f = 0; f < 5; f++) { g.beginPath(); g.ellipse(x - 12 + f * 6, y - 16 - (f % 3) * 2, 2.6, 9, 0, 0, 7); g.fill(); }
            g.fillRect(x - 3, y, 5, rnd(30, 80));
          }
        } else if (variant === 2 || variant === 5) {   // inscriptions
          g.fillStyle = '#5a0505'; g.font = 'bold 25px Rajdhani, Arial'; g.textAlign = 'center';
          const t = PHRASES[(Math.random() * PHRASES.length) | 0];
          g.save(); g.translate(w / 2, h * .38); g.rotate(rnd(-.08, .08)); g.fillText(t, 0, 0); g.restore();
          g.fillStyle = 'rgba(90,5,5,.8)';
          for (let i = 0; i < 9; i++) g.fillRect(rnd(w * .1, w * .9), h * .38, 2, rnd(8, 40));
        } else if (variant === 3) {   // moisissure
          const gr = g.createRadialGradient(w * .5, h * .4, 5, w * .5, h * .4, 90);
          gr.addColorStop(0, 'rgba(15,22,10,.8)'); gr.addColorStop(1, 'rgba(15,22,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        } else if (variant === 4) {   // griffures
          g.strokeStyle = 'rgba(20,12,8,.8)'; g.lineWidth = 2;
          for (let s = 0; s < 3; s++) { const x = rnd(30, w - 60), y = rnd(20, 60); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 7, y); g.lineTo(x + k * 7 + rnd(-6, 12), y + rnd(60, 100)); g.stroke(); } }
        }
      });
    }
    const wallVariants = [0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 2].map(v => {
      const tex = wallTex(v);
      return new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.8, roughness: 0.93, metalness: 0 });
    });
    const floorMat = new THREE.MeshStandardMaterial({
      roughness: 0.8, metalness: 0.05,
      map: mkTex(256, 256, (g, w, h) => {
        for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
          const v = 40 + ((Math.random() * 28) | 0); g.fillStyle = `rgb(${v},${v + 6},${v + 2})`; g.fillRect(tx * 64, ty * 64, 64, 64);
        }
        g.strokeStyle = '#0b0c0b'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
        speckle(g, w, h, 1800, ['rgba(0,0,0,.25)', 'rgba(70,55,30,.2)', 'rgba(255,255,255,.04)']);
        for (let i = 0; i < 4; i++) { const gr = g.createRadialGradient(rnd(0, w), rnd(0, h), 2, rnd(0, w), rnd(0, h), 40); g.fillStyle = 'rgba(15,10,5,.18)'; g.beginPath(); g.arc(rnd(0, w), rnd(0, h), rnd(10, 40), 0, 7); g.fill(); }
      }, [N * S / 4, N * S / 4])
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      roughness: 1,
      map: mkTex(256, 256, (g, w, h) => {
        g.fillStyle = '#2d2b27'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 4;
        for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
        speckle(g, w, h, 1500, ['rgba(0,0,0,.3)', 'rgba(60,45,20,.25)']);
      }, [N * S / 4, N * S / 4])
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3d38, roughness: 1 });
    const lockerFront = mkTex(128, 256, (g, w, h) => {
      g.fillStyle = '#4d5559'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, ['rgba(60,25,5,.35)', 'rgba(0,0,0,.2)']);
      g.fillStyle = '#1b1e1f'; for (let i = 0; i < 7; i++) g.fillRect(24, 28 + i * 9, 80, 3);
      g.fillStyle = '#222'; g.fillRect(100, 130, 8, 22);
      g.fillStyle = 'rgba(100,40,10,.35)'; g.fillRect(0, h - 40, w, 40);
    });
    const lockerFrontMat = new THREE.MeshStandardMaterial({ map: lockerFront, roughness: .6, metalness: .5 });
    const lockerSideMat = new THREE.MeshStandardMaterial({ color: 0x2d3235, roughness: .7, metalness: .4 });
    const doorMat = new THREE.MeshStandardMaterial({
      roughness: .6, metalness: .5, emissive: 0x000000,
      map: mkTex(256, 384, (g, w, h) => {
        g.fillStyle = '#3c4a3f'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, ['rgba(80,30,5,.35)', 'rgba(0,0,0,.25)']);
        g.fillStyle = '#222'; for (let i = 0; i < 5; i++) g.fillRect(14, 30 + i * 70, w - 28, 8);
        g.fillStyle = '#a00'; g.fillRect(40, 20, 176, 44); g.fillStyle = '#fff'; g.font = 'bold 34px Rajdhani, Arial'; g.textAlign = 'center'; g.fillText('SORTIE', w / 2, 55);
      })
    });

    // ------------------------------------------------------------
    // Scène Three.js
    // ------------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: !isTouch, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1 : 1.25));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x040405, 0.085);
    const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 60);
    camera.rotation.order = 'YXZ'; scene.add(camera);

    scene.add(new THREE.AmbientLight(0x23252f, 0.65));
    const spot = new THREE.SpotLight(0xfff0cc, 2.8, 26, 0.42, 0.6, 1.2);
    spot.position.set(0.15, -0.1, 0); camera.add(spot); spot.target.position.set(0, 0, -6); camera.add(spot.target);
    const bubble = new THREE.PointLight(0x7a7f9a, 0.55, 6, 2); camera.add(bubble);

    // Sol / plafond / murs
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(N * S, N * S), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(N * S / 2, 0, N * S / 2); scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(N * S, N * S), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(N * S / 2, H, N * S / 2); scene.add(ceil);
    wallList.forEach(r => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.hx * 2, H, r.hz * 2), wallVariants[(Math.random() * wallVariants.length) | 0]);
      m.position.set(r.cx, H / 2, r.cz); scene.add(m);
    });
    postRects.forEach(r => { const m = new THREE.Mesh(new THREE.BoxGeometry(r.hx * 2, H, r.hz * 2), postMat); m.position.set(r.cx, H / 2, r.cz); scene.add(m); });
    // porte de sortie
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorRect.hx * 2, H - 0.1, doorRect.hz * 2), doorMat);
    door.position.set(doorRect.cx, (H - 0.1) / 2, doorRect.cz); scene.add(door);
    const exitLight = new THREE.PointLight(0xff2200, 0.9, 9, 2); exitLight.position.set(doorRect.cx, 2.4, doorRect.cz - 1.2); scene.add(exitLight);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(S, H), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    outside.position.set(doorRect.cx, H / 2, N * S + 2.2); outside.rotation.y = Math.PI; outside.visible = false; scene.add(outside);

    // Lampes de plafond (émissives, sans vraie lumière) qui grésillent
    const lamps = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (Math.random() < 0.38) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xcfd6b0 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.28), mat); m.position.set(cc(x), H - 0.04, cc(z)); scene.add(m);
      lamps.push({ mat, base: 0x9fa488, dead: Math.random() < 0.45, t: rnd(0, 9) });
    }
    // Taches de sang au sol
    const bloodTex = mkTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 58); gr.addColorStop(0, 'rgba(70,0,0,.95)'); gr.addColorStop(.6, 'rgba(50,0,0,.7)'); gr.addColorStop(1, 'rgba(30,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(rnd(.8, 2), rnd(.8, 2)), new THREE.MeshStandardMaterial({ map: bloodTex, transparent: true, depthWrite: false, roughness: .3 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = rnd(0, 6); m.position.set(rnd(1, N * S - 1), 0.012, rnd(1, N * S - 1)); scene.add(m);
    }

    // Casiers (cachettes)
    const lockers = [];
    {
      const spots = [];
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (!(x < 2 && z < 2)) spots.push([x, z]);
      spots.sort(() => Math.random() - .5);
      for (let i = 0; i < 10 && i < spots.length; i++) {
        const [cx, cz] = spots[i];
        const sides = []; if (vw[cz][cx + 1]) sides.push(0); if (vw[cz][cx]) sides.push(1); if (hw[cz + 1][cx] && !(cz === N - 1 && cx === N - 1)) sides.push(2); if (hw[cz][cx]) sides.push(3);
        if (!sides.length) continue;
        const sd = sides[(Math.random() * sides.length) | 0];
        let lx = cc(cx), lz = cc(cz), fx = 0, fz = 0, rot = 0;
        if (sd === 0) { lx = (cx + 1) * S - T / 2 - .35; fx = -1; rot = -Math.PI / 2; }
        else if (sd === 1) { lx = cx * S + T / 2 + .35; fx = 1; rot = Math.PI / 2; }
        else if (sd === 2) { lz = (cz + 1) * S - T / 2 - .35; fz = -1; rot = Math.PI; }
        else { lz = cz * S + T / 2 + .35; fz = 1; rot = 0; }
        const mats = [lockerSideMat, lockerSideMat, lockerSideMat, lockerSideMat, lockerFrontMat, lockerSideMat];
        const m = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.1, .7), mats); m.position.set(lx, 1.05, lz); m.rotation.y = rot; scene.add(m);
        const hxr = fx ? .35 : .45, hzr = fx ? .45 : .35;
        propRects.push(mkRect(lx - hxr, lx + hxr, lz - hzr, lz + hzr));
        lockers.push({ x: lx, z: lz, fx, fz });
      }
    }

    // Objets à ramasser
    function glowSprite(color, scale) {
      const t = mkTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(scale, scale, 1); return s;
    }
    const pickups = [];
    const startDist = bfs(0, 0).dist;
    const far = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (startDist[z][x] >= 5) far.push([x, z]);
    far.sort(() => Math.random() - .5);
    const allCells = []; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (x + z > 1) allCells.push([x, z]);
    allCells.sort(() => Math.random() - .5);
    function addPickup(type, cx, cz) {
      const g = new THREE.Group();
      const col = type === 'fuse' ? 0xffaa33 : 0x44ff88;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, type === 'fuse' ? .3 : .22, 10), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.1, roughness: .3 }));
      const capGeo = new THREE.CylinderGeometry(.065, .065, .04, 10), capMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: .9, roughness: .3 });
      const c1 = new THREE.Mesh(capGeo, capMat), c2 = c1.clone(); c1.position.y = .17; c2.position.y = -.17;
      g.add(body, c1, c2, glowSprite(col, 1.3));
      const x = cc(cx) + rnd(-1.1, 1.1), z = cc(cz) + rnd(-1.1, 1.1);
      g.position.set(x, 1.0, z); scene.add(g); pickups.push({ type, g, x, z, taken: false, ph: rnd(0, 6) });
    }
    for (let i = 0; i < FUSES; i++) { const c = far[i % far.length] || allCells[i]; addPickup('fuse', c[0], c[1]); }
    for (let i = 0; i < 4; i++) { const c = allCells[(i * 7 + 3) % allCells.length]; addPickup('batt', c[0], c[1]); }

    // ------------------------------------------------------------
    // La Patiente (monstre procédural)
    // ------------------------------------------------------------
    const gownTex = mkTex(128, 128, (g, w, h) => {
      g.fillStyle = '#9a9684'; g.fillRect(0, 0, w, h); speckle(g, w, h, 800, ['rgba(90,70,40,.4)', 'rgba(40,0,0,.5)', 'rgba(0,0,0,.2)']);
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(80,0,0,${rnd(.25, .6)})`; g.fillRect(rnd(0, w), rnd(0, h * .6), rnd(3, 14), rnd(20, 70)); }
    });
    const mSkin = new THREE.MeshStandardMaterial({ color: 0xb9b5a8, roughness: .85 });
    const mGown = new THREE.MeshStandardMaterial({ map: gownTex, roughness: 1, side: THREE.DoubleSide });
    const mDark = new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 1 });
    const mEye = new THREE.MeshBasicMaterial({ color: 0xff2010 });
    const monster = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 1.1; monster.add(body);
    const gown = new THREE.Mesh(new THREE.CylinderGeometry(.2, .46, 1.25, 12, 1, true), mGown); gown.position.y = -.28; body.add(gown);
    const chest = new THREE.Group(); chest.position.y = .3; body.add(chest);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.19, .21, .75, 10), mGown); torso.position.y = .3; chest.add(torso);
    const headG = new THREE.Group(); headG.position.set(0, .78, .05); chest.add(headG);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 12), mSkin); head.scale.set(.82, 1.25, .95); headG.add(head);
    [-1, 1].forEach(s => {
      const soc = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 8), mDark); soc.position.set(s * .06, .05, .14); headG.add(soc);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(.016, 6, 6), mEye); pup.position.set(s * .06, .05, .185); headG.add(pup);
    });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 8), mDark); mouth.scale.set(1.1, 2.6, .5); mouth.position.set(0, -.09, .15); headG.add(mouth);
    for (let i = 0; i < 22; i++) {   // longs cheveux noirs
      const len = rnd(.55, 1.0), hair = new THREE.Mesh(new THREE.CylinderGeometry(.01, .006, len, 4), mDark);
      const a = rnd(0, Math.PI * 2), r = rnd(.1, .17);
      hair.position.set(Math.cos(a) * r, .12 - len / 2 + .05, Math.sin(a) * r - .02); headG.add(hair);
    }
    function makeArm(side) {
      const sh = new THREE.Group(); sh.position.set(side * .27, .62, 0); chest.add(sh);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(.04, .035, .75, 6), mSkin); up.position.y = -.375; sh.add(up);
      const el = new THREE.Group(); el.position.y = -.75; sh.add(el);
      const lo = new THREE.Mesh(new THREE.CylinderGeometry(.035, .03, .8, 6), mSkin); lo.position.y = -.4; el.add(lo);
      for (let f = 0; f < 5; f++) { const fi = new THREE.Mesh(new THREE.BoxGeometry(.012, .3, .012), mSkin); fi.position.set((f - 2) * .018, -.93, 0); fi.rotation.z = (f - 2) * .08; el.add(fi); }
      return { sh, el };
    }
    const armL = makeArm(-1), armR = makeArm(1);
    function makeLeg(side) {
      const hip = new THREE.Group(); hip.position.set(side * .12, -.1, 0); body.add(hip);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .04, 1.1, 6), mSkin); leg.position.y = -.55; hip.add(leg); return hip;
    }
    const legL = makeLeg(-1), legR = makeLeg(1);
    const mLight = new THREE.PointLight(0xff1a00, 0.5, 5, 2); mLight.position.set(0, 2.1, .3); monster.add(mLight);
    scene.add(monster);

    // ------------------------------------------------------------
    // Audio procédural
    // ------------------------------------------------------------
    const Au = { ctx: null };
    function audioOn() { return typeof soundEnabled === 'undefined' ? true : soundEnabled; }
    function initAudio() {
      if (Au.ctx) { Au.ctx.resume(); return; }
      try {
        const ctx = Au.ctx = new (window.AudioContext || window.webkitAudioContext)();
        Au.comp = ctx.createDynamicsCompressor(); Au.master = ctx.createGain(); Au.master.gain.value = .9;
        Au.master.connect(Au.comp); Au.comp.connect(ctx.destination);
        const len = ctx.sampleRate * 2; Au.nb = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = Au.nb.getChannelData(0); let last = 0;
        for (let i = 0; i < len; i++) { last = last * .6 + (Math.random() * 2 - 1) * .4; d[i] = last * 1.6; }
        const loopNoise = (dest) => { const s = ctx.createBufferSource(); s.buffer = Au.nb; s.loop = true; s.start(); s.connect(dest); return s; };
        // drone
        const mk = (type, f, g, dest) => { const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = type; o.frequency.value = f; gn.gain.value = g; o.connect(gn); gn.connect(dest); o.start(); return gn; };
        mk('sine', 41, .22, Au.master); mk('triangle', 43.4, .1, Au.master);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.connect(Au.master);
        Au.tens = mk('sawtooth', 82.4, 0, lp);
        Au.high = ctx.createGain(); Au.high.gain.value = 0; Au.high.connect(Au.master);
        [1318, 1397].forEach(f => { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = .5; o.connect(g); g.connect(Au.high); o.start(); });
        const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 6; tg.gain.value = .3; trem.connect(tg); tg.connect(Au.high.gain); trem.start();
        // vent
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = .7;
        const wg = ctx.createGain(); wg.gain.value = .07; loopNoise(bp); bp.connect(wg); wg.connect(Au.master);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .11; lg.gain.value = 250; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
        // monstre : spatialisé
        Au.pan = ctx.createPanner(); Au.pan.panningModel = 'HRTF'; Au.pan.distanceModel = 'inverse'; Au.pan.refDistance = 2; Au.pan.rolloffFactor = 1.3; Au.pan.connect(Au.master);
        const rb = ctx.createBiquadFilter(); rb.type = 'bandpass'; rb.frequency.value = 700; rb.Q.value = 2.5;
        Au.breath = ctx.createGain(); Au.breath.gain.value = 0; loopNoise(rb); rb.connect(Au.breath); Au.breath.connect(Au.pan);
        const bl = ctx.createOscillator(), bg = ctx.createGain(); bl.frequency.value = .55; bg.gain.value = .5; bl.connect(bg); bg.connect(Au.breath.gain); bl.start();
      } catch (e) { Au.ctx = null; }
    }
    function nz(dur, vol, type, f, q, dest, delay, slideF) {
      if (!Au.ctx) return; const ctx = Au.ctx, t = ctx.currentTime + (delay || 0);
      const s = ctx.createBufferSource(); s.buffer = Au.nb; s.loopStart = Math.random() * 1.5; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (slideF) fl.frequency.exponentialRampToValueAtTime(slideF, t + dur); fl.Q.value = q || 1;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.02, dur / 3)); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
      s.connect(fl); fl.connect(g); g.connect(dest || Au.master); s.start(t, s.loopStart); s.stop(t + dur + .05);
    }
    function tn(f, dur, type, vol, dest, delay, slideTo) {
      if (!Au.ctx) return; const ctx = Au.ctx, t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
      o.connect(g); g.connect(dest || Au.master); o.start(t); o.stop(t + dur + .05);
    }
    const sfx = {
      heart(v) { tn(58, .22, 'sine', v, null, 0, 34); tn(52, .2, 'sine', v * .75, null, .17, 32); },
      step(run) { const v = run ? .3 : .13; nz(.09, v, 'lowpass', 260, 1, null); tn(75, .1, 'sine', v * .8); },
      mstep() { nz(.14, .5, 'lowpass', 520, 1, Au.pan); nz(.1, .25, 'bandpass', 1100, 3, Au.pan, .02); tn(60, .12, 'sine', .4, Au.pan); },
      pick() { tn(520, .6, 'sine', .12); tn(780, .8, 'sine', .08, null, .08); tn(140, 1, 'triangle', .1); },
      door() { for (let i = 0; i < 4; i++) tn(110 + i * 40, 1.6, 'square', .04, null, i * .12); nz(1.4, .25, 'lowpass', 300, 1, null); },
      locker() { tn(95, .7, 'sawtooth', .06, null, 0, 60); nz(.12, .3, 'lowpass', 900, 1, null); },
      creak() { if (!Au.ctx) return; const p = Au.ctx.createStereoPanner(); p.pan.value = rnd(-1, 1); p.connect(Au.master); tn(rnd(70, 130), 1.6, 'sawtooth', .035, p, 0, rnd(45, 90)); nz(1.5, .05, 'bandpass', 600, 8, p, 0, 1300); },
      bang() { if (!Au.ctx) return; const p = Au.ctx.createStereoPanner(); p.pan.value = rnd(-1, 1); p.connect(Au.master); nz(.5, .35, 'lowpass', 400, 1, p, 0, 90); tn(130, .5, 'sine', .3, p, 0, 38); },
      whisper() { if (!Au.ctx) return; const p = Au.ctx.createStereoPanner(); p.pan.value = Math.random() < .5 ? -.9 : .9; p.connect(Au.master); for (let i = 0; i < 6; i++) nz(.18, .07, 'bandpass', rnd(900, 2600), 6, p, i * .16); },
      stinger() { tn(190, 1.1, 'sawtooth', .22, null, 0, 55); nz(.9, .3, 'highpass', 1200, 1, null, 0, 300); tn(1900, .6, 'sine', .08, null, 0, 700); },
      scream() {
        if (!Au.ctx) return;
        nz(1.8, .8, 'highpass', 900, 1, null); nz(1.4, .5, 'bandpass', 2200, 2, null, 0, 900);
        tn(300, 1.5, 'sawtooth', .5, null, 0, 2600); tn(440, 1.4, 'sawtooth', .35, null, .03, 3300); tn(40, 1.2, 'sine', .9, null, 0, 25);
      },
      win() { [392, 494, 587, 784].forEach((f, i) => tn(f, 2.2, 'sine', .12, null, i * .35)); }
    };
    function updateAudio(dt, fear, chase) {
      if (!Au.ctx) return;
      const t = Au.ctx.currentTime;
      Au.master.gain.setTargetAtTime(audioOn() ? .9 : 0, t, .05);
      Au.tens.gain.setTargetAtTime(fear * .12, t, .3);
      Au.high.gain.setTargetAtTime(fear > .5 ? (fear - .5) * .08 : 0, t, .3);
      Au.breath.gain.setTargetAtTime(chase ? .5 : clamp((fear - .2) * .5, 0, .3), t, .2);
      const L = Au.ctx.listener, p = camera.position, f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
      if (Au.pan.positionX) { Au.pan.positionX.value = M.x; Au.pan.positionY.value = 1.5; Au.pan.positionZ.value = M.z; } else Au.pan.setPosition(M.x, 1.5, M.z);
    }

    // ------------------------------------------------------------
    // État du jeu
    // ------------------------------------------------------------
    const P = { x: cc(0), z: cc(0), yaw: Math.PI, pitch: 0, hidden: null, running: false, moving: false, bob: 0, stepAcc: 0 };
    P.yaw = Math.atan2(0, 1); // regarde vers +z (la 1re cellule est ouverte soit vers +x soit vers +z)
    {
      const o = canGo(0, 0, 2) ? [0, 1] : [1, 0]; P.yaw = Math.atan2(-o[0], -o[1]);
    }
    let startFar = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (startDist[z][x] >= 8) startFar.push([x, z]);
    const sp = startFar.length ? startFar[(Math.random() * startFar.length) | 0] : [N - 1, 0];
    const M = { x: cc(sp[0]), z: cc(sp[1]), ang: 0, state: 'patrol', path: [], goal: null, wait: 2, lastSeen: null, lose: 0, sense: 0, dwell: 0, rolled: false, phase: 0, twitch: 0, los: false, detect: false, dist: 99 };

    const st = { state: 'intro', t: 0, fuses: 0, batt: 100, stam: 100, exhausted: false, flash: true, blink: 0, fear: 0, heartT: 0, nextEvent: 14, doorOpen: false, scareT: 0, msgT: 0, score: 0, locked: false, drag: false };
    let raf = 0, last = performance.now(), grainT = 0, disposed = false, usingDrag = false;
    const keys = {}, touchIn = { x: 0, y: 0, run: false };

    function showMsg(txt, ms) {
      elMsg.textContent = txt; elMsg.style.opacity = 1; st.msgT = (ms || 4000) / 1000;
    }
    function setObj() {
      elFuses.textContent = `FUSIBLES ${st.fuses}/${FUSES}`;
      elObj.textContent = st.fuses >= FUSES ? 'LA PORTE EST OUVERTE — SORS !' : 'TROUVE LES FUSIBLES';
      const sc = st.fuses * 150; document.getElementById('current-score').innerText = sc; st.score = sc;
    }

    // ------------------------------------------------------------
    // Collisions / vue
    // ------------------------------------------------------------
    function hitCircle(x, z, r) {
      for (let i = 0; i < wallRects.length; i++) {
        const w = wallRects[i]; if (Math.abs(x - w.cx) > w.hx + r || Math.abs(z - w.cz) > w.hz + r) continue;
        const nx = clamp(x, w.x0, w.x1), nz = clamp(z, w.z0, w.z1); if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
      }
      for (let i = 0; i < propRects.length; i++) {
        const w = propRects[i]; if (Math.abs(x - w.cx) > w.hx + r || Math.abs(z - w.cz) > w.hz + r) continue;
        const nx = clamp(x, w.x0, w.x1), nz = clamp(z, w.z0, w.z1); if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
      }
      return false;
    }
    function lineClear(x0, z0, x1, z1) {
      const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / .3);
      for (let i = 1; i < n; i++) {
        const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
        for (let k = 0; k < wallRects.length; k++) { const w = wallRects[k]; if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return false; }
      }
      return true;
    }

    // ------------------------------------------------------------
    // IA de la Patiente
    // ------------------------------------------------------------
    function pickPatrolGoal() {
      const pc = [cellOf(P.x), cellOf(P.z)];
      const mc = [cellOf(M.x), cellOf(M.z)];
      let c;
      if (Math.random() < .45) c = [clamp(pc[0] + ((Math.random() * 5) | 0) - 2, 0, N - 1), clamp(pc[1] + ((Math.random() * 5) | 0) - 2, 0, N - 1)];   // elle rôde dans ta zone
      else c = [(Math.random() * N) | 0, (Math.random() * N) | 0];
      if (c[0] === mc[0] && c[1] === mc[1]) c = [(Math.random() * N) | 0, (Math.random() * N) | 0];
      M.goal = c; M.path = pathTo(mc[0], mc[1], c[0], c[1]);
    }
    function moveM(dt, tx, tz, spd) {
      const dx = tx - M.x, dz = tz - M.z, d = Math.hypot(dx, dz);
      if (d < .02) return true;
      const s = Math.min(d, spd * dt); M.x += dx / d * s; M.z += dz / d * s;
      let da = Math.atan2(dx, dz) - M.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      M.ang += da * Math.min(1, dt * 8); M.phase += s * 2.3;
      return d - s < .12;
    }
    function followPath(dt, spd) {
      if (!M.path.length) return true;
      const n = M.path[0]; if (moveM(dt, cc(n[0]), cc(n[1]), spd)) M.path.shift();
      return !M.path.length;
    }
    function senseM() {
      M.dist = Math.hypot(P.x - M.x, P.z - M.z);
      M.los = lineClear(M.x, M.z, P.x, P.z);
      let detect = false;
      if (P.hidden) detect = false;
      else {
        const noise = P.running ? 13 : P.moving ? 5.5 : 1.6;
        const seen = M.los && M.dist < (st.flash && st.batt > 0 ? 17 : 7.5);
        const heard = M.dist < noise * .85;
        detect = seen || heard;
      }
      M.detect = detect && st.t > 18;
      if (M.detect) {
        if (M.state !== 'chase') { sfx.stinger(); }
        M.state = 'chase'; M.lose = 0; M.lastSeen = { x: P.x, z: P.z }; M.path = [];
      } else if (M.state === 'chase') {
        M.lose += .15; if (M.lose > 3.5) { M.state = 'search'; M.dwell = 0; M.rolled = false; M.path = []; }
      }
    }
    function updateM(dt) {
      M.sense -= dt; if (M.sense <= 0) { M.sense = .15; senseM(); }
      const spd = M.state === 'chase' ? 3.3 + st.fuses * .2 : M.state === 'search' ? 2.3 : 1.7;
      const mc = [cellOf(M.x), cellOf(M.z)];
      if (M.state === 'chase') {
        if (M.detect && M.los && !P.hidden) moveM(dt, P.x, P.z, spd);
        else if (M.lastSeen) {
          const lc = [cellOf(M.lastSeen.x), cellOf(M.lastSeen.z)];
          if (!M.path.length && (mc[0] !== lc[0] || mc[1] !== lc[1])) M.path = pathTo(mc[0], mc[1], lc[0], lc[1]);
          if (M.path.length) followPath(dt, spd); else moveM(dt, M.lastSeen.x, M.lastSeen.z, spd);
        }
        M.twitch = 1;
      } else if (M.state === 'search') {
        M.dwell += dt;
        if (M.lastSeen && !M.path.length && M.dwell < 2) {
          const lc = [cellOf(M.lastSeen.x), cellOf(M.lastSeen.z)];
          if (mc[0] !== lc[0] || mc[1] !== lc[1]) M.path = pathTo(mc[0], mc[1], lc[0], lc[1]);
        }
        if (M.path.length) followPath(dt, spd);
        else M.ang += Math.sin(st.t * 2.2) * dt * 2.2;     // elle scrute
        if (P.hidden && !M.rolled && M.dist < 2.6 && M.dwell > 2.2) {      // elle fouille ta cachette
          M.rolled = true; if (Math.random() < .5) startScare();
        }
        if (M.dwell > 9) { M.state = 'patrol'; M.goal = null; M.path = []; }
        else if (M.dwell > 4 && !M.path.length) { const c = [clamp(mc[0] + ((Math.random() * 5) | 0) - 2, 0, N - 1), clamp(mc[1] + ((Math.random() * 5) | 0) - 2, 0, N - 1)]; M.path = pathTo(mc[0], mc[1], c[0], c[1]); }
      } else {
        if (M.wait > 0) { M.wait -= dt; M.ang += Math.sin(st.t * 1.7) * dt; }
        else {
          if (!M.path.length) pickPatrolGoal();
          if (followPath(dt, spd)) M.wait = rnd(1, 3);
        }
      }
      // capture
      if (st.state === 'play' && !P.hidden && M.dist < 1.05 && M.los) startScare();
      if (st.state === 'play' && P.hidden && P.hiddenSeen && M.dist < 1.6) startScare();
      // animation
      const ph = M.phase, run = M.state === 'chase';
      legL.rotation.x = Math.sin(ph) * (run ? .9 : .5); legR.rotation.x = -Math.sin(ph) * (run ? .9 : .5);
      armL.sh.rotation.x = run ? -1.25 + Math.sin(ph * 2) * .15 : Math.sin(ph) * .25 - .1; armR.sh.rotation.x = run ? -1.15 - Math.sin(ph * 2) * .15 : -Math.sin(ph) * .25 - .1;
      armL.el.rotation.x = run ? -.3 : -.15; armR.el.rotation.x = run ? -.3 : -.15;
      chest.rotation.x = run ? .75 : .35; body.position.y = 1.1 + Math.abs(Math.sin(ph)) * .05;
      M.tw = (M.tw || 0) - dt; if (M.tw <= 0) { M.tw = rnd(.15, .8); M.hz = (Math.random() - .5) * .8; M.hy = (Math.random() - .5) * .9; }
      headG.rotation.z += (.35 + M.hz - headG.rotation.z) * Math.min(1, dt * 14); headG.rotation.y += (M.hy - headG.rotation.y) * Math.min(1, dt * 14);
      if (!(st.state === 'scare')) { monster.position.set(M.x, 0, M.z); monster.rotation.y = M.ang; }
      // pas
      const stepIdx = Math.floor(ph / Math.PI); if (stepIdx !== M.lastStep) { M.lastStep = stepIdx; if (M.dist < 20) sfx.mstep(); }
    }

    // ------------------------------------------------------------
    // Jumpscare / fin
    // ------------------------------------------------------------
    function releaseInput() {
      if (document.pointerLockElement) document.exitPointerLock();
      exitFS();
    }
    function startScare() {
      if (st.state !== 'play') return;
      st.state = 'scare'; st.scareT = 0;
      P.hidden && (P.hidden = null);
      elSlit.style.display = 'none';
      // la Patiente se plante devant la caméra
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      monster.position.set(P.x + fx * .75, 0, P.z + fz * .75); monster.rotation.y = Math.atan2(-fx, -fz);
      chest.rotation.x = .15; armL.sh.rotation.x = -1.5; armR.sh.rotation.x = -1.5; headG.rotation.z = 0; headG.rotation.y = 0;
      sfx.scream(); elFlash.style.opacity = .95; elRed.style.opacity = 1; elStatic.style.opacity = .8;
    }
    function endGame(win) {
      st.state = win ? 'win' : 'dead';
      releaseInput();
      let score = st.fuses * 150;
      if (win) score += 1000 + Math.max(0, Math.floor(900 - st.t * 2));
      document.getElementById('current-score').innerText = score;
      if (win) {
        updateHighScore(currentGameId, score);
        document.getElementById('final-score').innerText = score;
        document.getElementById('overlay-title').innerText = 'TU T\'ES ÉCHAPPÉ…';
        document.getElementById('game-overlay').classList.remove('hidden');
      } else {
        triggerGameOver(score);
        document.getElementById('overlay-title').innerText = 'ELLE T\'A TROUVÉ';
      }
    }

    // ------------------------------------------------------------
    // Boucle de mise à jour
    // ------------------------------------------------------------
    function interactTarget() {
      if (P.hidden) return { type: 'unhide' };
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      for (const l of lockers) {
        const px = l.x + l.fx * .9, pz = l.z + l.fz * .9, dx = l.x - P.x, dz = l.z - P.z, d = Math.hypot(dx, dz);
        if (d < 1.9 && (dx * fx + dz * fz) / (d || 1) > .55) return { type: 'hide', l, px, pz };
      }
      return null;
    }
    function useAction() {
      if (st.state !== 'play') return;
      const t = interactTarget(); if (!t) return;
      sfx.locker();
      if (t.type === 'hide') { P.hiddenSeen = (M.state === 'chase' && M.los && M.dist < 7); P.hidden = t.l; P.x = t.l.x; P.z = t.l.z; P.yaw = Math.atan2(-t.l.fx, -t.l.fz); P.pitch = 0; P.baseYaw = P.yaw; elSlit.style.display = 'block'; showMsg('Ne bouge pas… elle écoute.', 2500); }
      else { const l = P.hidden; P.hidden = null; P.x = l.x + l.fx * .95; P.z = l.z + l.fz * .95; elSlit.style.display = 'none'; }
    }
    function toggleFlash() { if (st.state === 'play') { st.flash = !st.flash; tn(900, .05, 'square', .05); } }

    function update(dt) {
      st.t += dt;
      if (st.msgT > 0) { st.msgT -= dt; if (st.msgT <= 0) elMsg.style.opacity = 0; }
      if (st.state === 'scare') {
        st.scareT += dt;
        const k = st.scareT, shake = Math.max(0, 1 - k / 1.6) * .08;
        camera.position.set(P.x + rnd(-shake, shake), 1.6 + rnd(-shake, shake), P.z + rnd(-shake, shake));
        const mx = monster.position.x, mz = monster.position.z;
        const want = Math.atan2(-(mx - P.x), -(mz - P.z)); let da = want - P.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        P.yaw += da * Math.min(1, dt * 14); P.pitch += (.2 - P.pitch) * Math.min(1, dt * 10);
        camera.rotation.set(P.pitch, P.yaw, rnd(-shake, shake) * 3);
        monster.position.x += (P.x - mx) * dt * .35; monster.position.z += (P.z - mz) * dt * .35;
        headG.position.x = rnd(-.02, .02); mouth.scale.y = 2.6 + Math.sin(k * 40) * .8;
        elFlash.style.opacity = Math.max(0, .95 - k * 3);
        spot.intensity = 1.5 + Math.random() * 3;
        if (k > 1.7) endGame(false);
        return;
      }
      if (st.state === 'win') return;
      if (st.state !== 'play') {   // intro : léger balancement
        camera.position.set(P.x, 1.6, P.z); camera.rotation.set(Math.sin(st.t * .4) * .05, P.yaw + Math.sin(st.t * .3) * .25, 0);
        spot.intensity = 2.4 + Math.sin(st.t * 30) * (Math.random() < .08 ? 1.2 : 0);
        return;
      }

      // --- déplacement ---
      let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + touchIn.y;
      let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touchIn.x;
      const mag = Math.hypot(f, s); if (mag > 1) { f /= mag; s /= mag; }
      P.moving = !P.hidden && mag > .1;
      const wantRun = (keys.ShiftLeft || keys.ShiftRight || touchIn.run) && P.moving;
      if (st.exhausted && st.stam > 25) st.exhausted = false;
      P.running = wantRun && !st.exhausted && st.stam > 0;
      if (P.running) { st.stam -= 24 * dt; if (st.stam <= 0) { st.stam = 0; st.exhausted = true; showMsg('Tu es à bout de souffle…', 2000); } }
      else st.stam = Math.min(100, st.stam + (P.moving ? 9 : 16) * dt);
      if (P.moving) {
        const sp = P.running ? 5.0 : 2.9, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
        const dx = (fx * f + rx * s) * sp * dt, dz = (fz * f + rz * s) * sp * dt, r = .34;
        if (!hitCircle(P.x + dx, P.z, r)) P.x += dx; if (!hitCircle(P.x, P.z + dz, r)) P.z += dz;
        P.bob += dt * (P.running ? 12 : 8); P.stepAcc += dt * (P.running ? 3.4 : 2.1);
        if (P.stepAcc >= 1) { P.stepAcc = 0; sfx.step(P.running); }
      }
      if (P.hidden) { P.x = P.hidden.x; P.z = P.hidden.z; P.yaw = clamp(P.yaw, P.baseYaw - .45, P.baseYaw + .45); P.pitch = clamp(P.pitch, -.2, .25); }

      // --- lampe ---
      if (st.flash && st.batt > 0) st.batt = Math.max(0, st.batt - .45 * dt);
      if (st.batt <= 0 && st.flash) { st.flash = false; showMsg('La lampe est morte…', 3000); }

      // --- monstre ---
      updateM(dt);
      const dM = M.dist || 99;
      let fear = clamp(1 - (dM - 1.5) / 14, 0, 1) * (M.state === 'chase' ? 1 : .55);
      if (M.state === 'chase' && !M.los) fear *= .7;
      st.fear += (fear - st.fear) * Math.min(1, dt * 2.5);
      const fr = st.fear;

      // lampe qui clignote avec la peur
      st.blink -= dt;
      if (st.blink <= 0 && Math.random() < dt * (.15 + fr * 6) && fr > .15) st.blink = rnd(.06, .22 + fr * .3);
      const lowBat = st.batt < 20 && st.batt > 0 ? (Math.random() < .12 ? .2 : 1) : 1;
      spot.intensity = st.flash && st.batt > 0 ? (st.blink > 0 ? .1 : 2.8) * lowBat : 0;
      bubble.intensity = st.flash ? .55 : .12;
      mLight.intensity = .35 + Math.random() * .35 * fr;

      // --- ramassage ---
      for (const p of pickups) {
        if (p.taken) continue;
        p.g.rotation.y += dt * 1.5; p.g.position.y = 1.0 + Math.sin(st.t * 2 + p.ph) * .07;
        if (Math.hypot(P.x - p.x, P.z - p.z) < 1.0 && !P.hidden) {
          p.taken = true; p.g.visible = false; sfx.pick();
          if (p.type === 'fuse') {
            st.fuses++; setObj();
            if (st.fuses >= FUSES) { openDoor(); } else showMsg(`Fusible ${st.fuses}/${FUSES}. Il en manque ${FUSES - st.fuses}.`, 3500);
          } else { st.batt = Math.min(100, st.batt + 35); showMsg('Piles récupérées.', 2000); }
        }
      }

      // --- victoire ---
      if (st.doorOpen && P.z > N * S + .2) { st.state = 'win'; sfx.win(); elFlash.style.opacity = 1; setTimeout(() => endGame(true), 1600); }

      // --- événements ambiants ---
      st.nextEvent -= dt;
      if (st.nextEvent <= 0) {
        st.nextEvent = rnd(9, 22); const r = Math.random();
        if (r < .3) sfx.creak(); else if (r < .55) sfx.bang(); else if (r < .75) sfx.whisper();
        else { st.blink = 1.1; sfx.bang(); }
      }

      // --- caméra ---
      const sh = fr * fr * .012 + (M.state === 'chase' && dM < 8 ? .008 : 0);
      const bobY = P.moving ? Math.sin(P.bob) * (P.running ? .075 : .04) : Math.sin(st.t * 1.4) * .008;
      const eye = P.hidden ? 1.5 : 1.62;
      camera.position.set(P.x + rnd(-sh, sh), eye + bobY + rnd(-sh, sh), P.z + rnd(-sh, sh));
      camera.rotation.set(P.pitch + rnd(-sh, sh) * .6, P.yaw, (P.moving ? Math.cos(P.bob * .5) * .012 : 0) + rnd(-sh, sh));

      // --- cœur / audio / HUD ---
      const beating = fr > .12 || P.hidden || M.state === 'chase';
      if (beating) { st.heartT -= dt; if (st.heartT <= 0) { st.heartT = lerp(1.15, .38, fr); sfx.heart(.12 + fr * .6); elRed.style.opacity = .12 + fr * .5; } }
      elRed.style.opacity = Math.max(0, parseFloat(elRed.style.opacity || 0) - dt * .8);
      elStatic.style.opacity = fr > .45 ? (fr - .45) * 1.2 : 0;
      elVig.style.opacity = .8 + fr * .2;
      updateAudio(dt, fr, M.state === 'chase');
      elBatt.style.width = st.batt + '%'; elBatt.style.background = st.batt < 20 ? '#c33' : '#e8d9a0';
      elStam.style.width = st.stam + '%';
      const it = interactTarget();
      if (it) { elPrompt.textContent = it.type === 'hide' ? '[E] SE CACHER' : '[E] SORTIR DU CASIER'; elPrompt.style.opacity = 1; }
      else if (st.fuses < FUSES && Math.hypot(P.x - doorRect.cx, P.z - doorRect.cz) < 3.2) { elPrompt.textContent = `PORTE VERROUILLÉE — ${FUSES - st.fuses} FUSIBLE(S) MANQUANT(S)`; elPrompt.style.opacity = 1; }
      else elPrompt.style.opacity = 0;
    }
    const lerp = (a, b, t) => a + (b - a) * t;

    function openDoor() {
      st.doorOpen = true; showMsg('Un grondement résonne… la porte de sortie s\'est ouverte !', 5000);
      sfx.door(); doorMat.emissive.setHex(0x00aa44); exitLight.color.setHex(0x44ff88); exitLight.intensity = 1.6;
      const i = wallRects.indexOf(doorRect); if (i >= 0) wallRects.splice(i, 1);
      door.visible = false; outside.visible = true;
      setObj();
      st.nextEvent = 3; M.state = 'chase'; M.lose = 0; M.lastSeen = { x: P.x, z: P.z }; M.detect = true;   // le bruit l'attire
    }

    // ------------------------------------------------------------
    // Rendu + effets
    // ------------------------------------------------------------
    function resize() {
      const w = wrap.clientWidth || 800, h = wrap.clientHeight || 450;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    function drawGrain() {
      const img = gctx.createImageData(160, 90), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      gctx.putImageData(img, 0, 0);
    }
    function frame(now) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (st.state !== 'paused') update(dt);
      // lampes de plafond
      for (const l of lamps) {
        l.t += dt; let v = l.dead ? 0 : (Math.random() < .03 + st.fear * .2 ? .1 : 1);
        if (l.dead && Math.random() < .004) v = .7;
        l.mat.color.setHex(0xffffff).multiplyScalar(v * .72);
      }
      grainT += dt; if (grainT > .07) { grainT = 0; drawGrain(); elStatic.style.transform = `translateY(${(Math.random() * 6) | 0}px)`; }
      renderer.render(scene, camera);
    }

    // ------------------------------------------------------------
    // Entrées : clavier, souris, tactile, plein écran
    // ------------------------------------------------------------
    function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function inFS() { return fsEl() === wrap || wrap.classList.contains('hz-pseudofs'); }
    function enterFS() {
      const fallback = () => { wrap.classList.add('hz-pseudofs'); setTimeout(resize, 50); };
      try {
        if (wrap.requestFullscreen) wrap.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(fallback);
        else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
        else fallback();
      } catch (e) { fallback(); }
    }
    function exitFS() {
      wrap.classList.remove('hz-pseudofs');
      try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { }
      try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) { }
      setTimeout(resize, 50);
    }
    function toggleFS() { inFS() ? exitFS() : enterFS(); }
    function lock() {
      if (isTouch) return;
      if (!glCanvas.requestPointerLock) { usingDrag = true; return; }
      try { const p = glCanvas.requestPointerLock(); if (p && p.catch) p.catch(() => { if (st.state === 'play') pause(); }); } catch (e) { usingDrag = true; }
    }
    function pause() {
      if (st.state !== 'play') return;
      st.state = 'paused'; scrPause.classList.remove('hidden'); for (const k in keys) keys[k] = false;
    }
    function resume() {
      scrPause.classList.add('hidden'); initAudio(); if (Au.ctx) Au.ctx.resume(); st.state = 'play'; last = performance.now(); lock();
    }
    function begin(fullscreen) {
      initAudio();
      scrIntro.classList.add('hidden');
      if (fullscreen) enterFS();
      lock();
      st.state = 'play'; last = performance.now(); setObj();
      showMsg('Trouve les fusibles. Reste discret…', 5000);
      setTimeout(() => { if (st.state === 'play') showMsg('[F] lampe   [Maj] courir   [E] se cacher   [G] plein écran', 5000); }, 5500);
    }

    const onKeyDown = e => {
      if (!document.body.contains(wrap)) return;
      keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && st.state !== 'intro') e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyE') useAction();
      else if (e.code === 'KeyF') toggleFlash();
      else if (e.code === 'KeyG') toggleFS();
      else if (e.code === 'KeyP' && st.state === 'play') pause();
    };
    const onKeyUp = e => { keys[e.code] = false; };
    const onMouseMove = e => {
      if (st.state !== 'play') return;
      if (document.pointerLockElement === glCanvas || (usingDrag && st.drag)) {
        P.yaw -= (e.movementX || 0) * .0022; P.pitch = clamp(P.pitch - (e.movementY || 0) * .0022, -1.25, 1.25);
      }
    };
    const onMouseDown = () => { if (usingDrag) st.drag = true; };
    const onMouseUp = () => { st.drag = false; };
    const onLockChange = () => {
      if (st.state === 'play' && !document.pointerLockElement && !usingDrag && !isTouch) pause();
    };
    const onLockError = () => { if (st.state === 'play') pause(); };
    const onFSChange = () => { setTimeout(resize, 60); if (!fsEl() && st.state === 'play' && !wrap.classList.contains('hz-pseudofs') && !isTouch) pause(); };
    const onBlur = () => { if (st.state === 'play') pause(); };
    const onVis = () => { if (document.hidden && st.state === 'play') pause(); };

    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove); wrap.addEventListener('mousedown', onMouseDown); document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onLockChange); document.addEventListener('pointerlockerror', onLockError);
    document.addEventListener('fullscreenchange', onFSChange); document.addEventListener('webkitfullscreenchange', onFSChange);
    window.addEventListener('resize', resize); window.addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onVis);
    $('.hz-fsbtn').addEventListener('click', e => { e.stopPropagation(); toggleFS(); });
    $('.hz-go-fs').addEventListener('click', () => begin(true));
    $('.hz-go').addEventListener('click', () => begin(false));
    $('.hz-resume').addEventListener('click', resume);

    // tactile : stick flottant à gauche, regard à droite, boutons
    if (isTouch) {
      const zl = $('.hz-zl'), zr = $('.hz-zr'), stick = $('.hz-stick'), knob = $('.hz-knob');
      let sId = null, sx = 0, sy = 0, lId = null, lx = 0, ly = 0;
      zl.addEventListener('pointerdown', e => { sId = e.pointerId; sx = e.clientX; sy = e.clientY; zl.setPointerCapture(sId); const r = zl.getBoundingClientRect(); stick.style.display = 'block'; stick.style.left = (sx - r.left) + 'px'; stick.style.top = (sy - r.top) + 'px'; knob.style.transform = ''; });
      zl.addEventListener('pointermove', e => {
        if (e.pointerId !== sId) return; let dx = (e.clientX - sx) / 48, dy = (e.clientY - sy) / 48; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        touchIn.x = dx; touchIn.y = -dy; touchIn.run = m > 1.15; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`;
      });
      const endS = e => { if (e.pointerId !== sId) return; sId = null; touchIn.x = touchIn.y = 0; touchIn.run = false; stick.style.display = 'none'; };
      zl.addEventListener('pointerup', endS); zl.addEventListener('pointercancel', endS);
      zr.addEventListener('pointerdown', e => { lId = e.pointerId; lx = e.clientX; ly = e.clientY; zr.setPointerCapture(lId); });
      zr.addEventListener('pointermove', e => { if (e.pointerId !== lId || st.state !== 'play') return; P.yaw -= (e.clientX - lx) * .0052; P.pitch = clamp(P.pitch - (e.clientY - ly) * .0052, -1.25, 1.25); lx = e.clientX; ly = e.clientY; });
      const endL = e => { if (e.pointerId === lId) lId = null; };
      zr.addEventListener('pointerup', endL); zr.addEventListener('pointercancel', endL);
      wrap.querySelectorAll('.hz-tb').forEach(b => {
        const k = b.dataset.k;
        b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (k === 'use') useAction(); else if (k === 'flash') toggleFlash(); else touchIn.run = true; });
        b.addEventListener('pointerup', () => { if (k === 'run') touchIn.run = false; });
        b.addEventListener('pointerleave', () => { if (k === 'run') touchIn.run = false; });
      });
    }

    // ------------------------------------------------------------
    // Nettoyage (appelé par stopAllGames dans main.js)
    // ------------------------------------------------------------
    window._horrorCleanup = function () {
      disposed = true; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onLockChange); document.removeEventListener('pointerlockerror', onLockError);
      document.removeEventListener('fullscreenchange', onFSChange); document.removeEventListener('webkitfullscreenchange', onFSChange);
      window.removeEventListener('resize', resize); window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis);
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
      try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { }
      try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) { }
      if (Au.ctx) { try { Au.ctx.close(); } catch (e) { } Au.ctx = null; }
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { }
      wrap.remove(); style.remove();
      gameCanvas.classList.remove('hidden'); container.style.maxWidth = prevMaxWidth;
      window._horrorCleanup = null;
    };

    resize(); setObj();
    st.score = 0;
    raf = requestAnimationFrame(frame);
  };
})();