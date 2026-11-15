/* =====================================================================
   BALL SORT — « Pop Tubes » — jeu de tri de balles (JS pur, canvas)
   Pour Arbest Arcade. Un seul fichier, aucune dépendance.

   Utilisation :
     startBallSort(canvasOuConteneur)   // canvas existant OU div conteneur : le jeu
                                        // prend la taille de TA zone de jeu
     startBallSort()                    // cherche #gameCanvas / #game-container… sinon
                                        // s'affiche dans une fenêtre centrée (Échap = fermer)
   Bouton plein écran intégré (API Fullscreen, avec repli pour iPhone).
   Retourne une fonction de fermeture (cleanup). Également disponible via
   window._ballSortCleanup() ; le jeu se ferme aussi tout seul si son canvas
   est retiré de la page.
   ===================================================================== */
(function () {
  'use strict';

  var CAP = 4; // balles par tube
  var PALETTE = ['#ff5c6c', '#ff9f43', '#ffd93d', '#8be04e', '#22c985',
                 '#38d6f5', '#4f86ff', '#a66bff', '#ff7ebd', '#b9805a'];
  var LS_KEY = 'arbest_ballsort_level';
  var FONT = "'Baloo 2','Fredoka','Comic Sans MS','Trebuchet MS',sans-serif";
  var PI = Math.PI;

  /* ---------- utilitaires ---------- */
  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(h, t, a) {
    var c = hex2rgb(h), k = hex2rgb(t);
    return 'rgb(' + c.map(function (v, i) { return Math.round(v + (k[i] - v) * a); }).join(',') + ')';
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function lerp(a, b, u) { return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }; }

  function startBallSort(target) {
    if (window._ballSortCleanup) { try { window._ballSortCleanup(); } catch (e) {} }

    /* ---------- canvas ---------- */
    var canvas, ownCanvas = false, overlay = false, passedCanvas = false, autoHeight = false;
    if (!(target && target.nodeType === 1)) {
      target = document.querySelector('#gameCanvas, #game-canvas, #game-container, #gameContainer, #game-area, #gameArea, .game-container, .game-area');
    }
    if (target && target.tagName === 'CANVAS') { canvas = target; passedCanvas = true; }
    else {
      canvas = document.createElement('canvas'); ownCanvas = true;
      if (target && target.appendChild) {
        autoHeight = target.clientHeight < 300;
        target.appendChild(canvas);
        canvas.style.cssText = 'display:block;width:100%;height:100%;border-radius:16px;';
      } else {
        // aucune zone trouvée : fenêtre centrée (et non plein écran)
        overlay = true;
        canvas.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
          'width:min(96vw,920px);height:min(92vh,680px);z-index:9999;border-radius:20px;' +
          'box-shadow:0 0 0 100vmax rgba(10,8,40,.78),0 20px 60px rgba(0,0,0,.5);';
        document.body.appendChild(canvas);
      }
    }
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.webkitTapHighlightColor = 'transparent';
    var ctx = canvas.getContext('2d');
    var cw = 400, ch = 700, dpr = 1;

    function resize() {
      if (ownCanvas && !overlay && autoHeight && !isFs() && canvas.parentNode) {
        var pw = canvas.parentNode.clientWidth || cw;
        canvas.style.height = Math.round(Math.max(420, Math.min(pw * 0.75, window.innerHeight * 0.85))) + 'px';
      }
      var r = canvas.getBoundingClientRect();
      if (passedCanvas) {
        if (!canvas.style.width) canvas.style.width = r.width + 'px';
        if (!canvas.style.height) canvas.style.height = r.height + 'px';
      }
      cw = r.width || canvas.width || 400;
      ch = r.height || canvas.height || 700;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
    }

    /* ---------- état du jeu ---------- */
    var lvl = 1, nc = 3, tubes = [], initial = [], history = [];
    var done = [], lift = [], shake = [], doneFlash = [];
    var selected = -1, moves = 0, state = 'play', winT = 0, stars = 3;
    var pending = false, particles = [], bubbles = [];
    var pos = [], D = 40, TW = 48, btns = [], winBtn = null;
    var muted = false, ac = null, raf = 0, lastT = performance.now(), now = lastT, alive = true;

    /* ---------- plein écran ---------- */
    var pseudoFs = false, savedCss = '';
    function isFs() {
      return pseudoFs || document.fullscreenElement === canvas || document.webkitFullscreenElement === canvas;
    }
    function enterPseudo() {
      if (pseudoFs) return;
      savedCss = canvas.style.cssText;
      canvas.style.cssText = savedCss + ';position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:99999;' +
        'transform:none;border-radius:0;box-shadow:none;max-width:none;max-height:none;';
      pseudoFs = true; resize();
    }
    function exitPseudo() {
      if (!pseudoFs) return;
      canvas.style.cssText = savedCss; pseudoFs = false; resize();
    }
    function toggleFs() {
      if (isFs()) {
        if (pseudoFs) exitPseudo();
        else { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) ex.call(document); }
        return;
      }
      var req = canvas.requestFullscreen || canvas.webkitRequestFullscreen;
      if (req) {
        try { var p = req.call(canvas); if (p && p.catch) p.catch(enterPseudo); } catch (e) { enterPseudo(); }
      } else enterPseudo();
    }
    function onFsChange() {
      if (!isFs() && ownCanvas) canvas.style.borderRadius = overlay ? '20px' : '16px';
      else if (isFs()) canvas.style.borderRadius = '0';
      resize();
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (pseudoFs) exitPseudo();
      else if (overlay && !isFs()) cleanup();
    }

    try { lvl = Math.max(1, parseInt(localStorage.getItem(LS_KEY), 10) || 1); } catch (e) {}
    try { muted = localStorage.getItem(LS_KEY + '_mute') === '1'; } catch (e) {}

    for (var i = 0; i < 16; i++) {
      bubbles.push({ x: Math.random(), y: Math.random(), r: 8 + Math.random() * 34, sp: 0.005 + Math.random() * 0.012, ph: Math.random() * 6 });
    }

    function newBall(c) { return { c: c, anim: null, land: -9999, bo: Math.random() * 6 }; }
    function isDone(t) { return t.length === CAP && t.every(function (b) { return b.c === t[0].c; }); }
    function snapshot() { return tubes.map(function (t) { return t.map(function (b) { return b.c; }); }); }

    function setTubes(arr) {
      tubes = arr.map(function (t) { return t.map(newBall); });
      done = tubes.map(isDone);
      lift = tubes.map(function () { return 0; });
      shake = tubes.map(function () { return 0; });
      doneFlash = tubes.map(function () { return -9999; });
      selected = -1; pending = false;
      layout();
    }

    function loadLevel(l) {
      lvl = l;
      try { localStorage.setItem(LS_KEY, String(l)); } catch (e) {}
      var rnd = mulberry32(l * 9973 + 11);
      nc = Math.min(10, 3 + Math.floor((l - 1) * 0.7));
      var cols = shuffle(PALETTE.map(function (_, i) { return i; }), rnd).slice(0, nc);
      var pool = [];
      cols.forEach(function (c) { for (var k = 0; k < CAP; k++) pool.push(c); });
      var arr, tries = 0;
      do {
        shuffle(pool, rnd); arr = [];
        for (var t = 0; t < nc; t++) arr.push(pool.slice(t * CAP, t * CAP + CAP));
        tries++;
      } while (arr.some(function (t) { return t.every(function (c) { return c === t[0]; }); }) && tries < 60);
      arr.push([], []);
      initial = arr.map(function (t) { return t.slice(); });
      history = []; moves = 0; state = 'play'; particles = [];
      setTubes(initial);
    }

    /* ---------- mise en page ---------- */
    function layout() {
      var n = tubes.length, W = cw, H = ch;
      if (!n) return;
      var topPad = Math.max(64, H * 0.11), botPad = Math.max(96, H * 0.15);
      var availH = Math.max(100, H - topPad - botPad);
      var hUnits = CAP * 1.06 + 0.4 + 1.0 + 0.35;
      var best = null;
      for (var r = 1; r <= 3; r++) {
        var cols = Math.ceil(n / r);
        var dW = (W * 0.95 / cols) / 1.5, dH = (availH / r) / hUnits;
        var d = Math.min(dW, dH, 110);
        if (!best || d > best.d + 0.5) best = { r: r, cols: cols, d: d };
      }
      D = best.d; TW = D * 1.22;
      var rowH = D * hUnits, startY = topPad + (availH - best.r * rowH) / 2;
      var cellW = Math.min(W * 0.95 / best.cols, D * 2.0);
      pos = [];
      for (var i = 0; i < n; i++) {
        var row = Math.floor(i / best.cols), cnt = Math.min(best.cols, n - row * best.cols), col = i - row * best.cols;
        var top = startY + row * rowH + D * 1.0;
        pos.push({ x: W / 2 + (col - (cnt - 1) / 2) * cellW, top: top, bottom: top + CAP * 1.06 * D + 0.4 * D, cw: cellW });
      }
      var br = Math.max(22, Math.min(34, Math.min(W, H) * 0.07));
      var by = H - Math.max(br + 16, botPad * 0.5), gap = Math.min(br * 2.7, W / 5.6), sx = W / 2 - 2 * gap;
      btns = [
        { id: 'undo', x: sx, y: by, r: br },
        { id: 'restart', x: sx + gap, y: by, r: br },
        { id: 'add', x: sx + gap * 2, y: by, r: br },
        { id: 'sound', x: sx + gap * 3, y: by, r: br },
        { id: 'fs', x: sx + gap * 4, y: by, r: br }
      ];
    }

    function slot(i, idx) { return { x: pos[i].x, y: pos[i].bottom - D * 0.7 - idx * D * 1.06 }; }
    function liftPos(i) { return { x: pos[i].x, y: pos[i].top - D * 0.75 }; }

    /* ---------- son ---------- */
    function initAudio() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    function tone(f, dur, type, vol, slide) {
      if (muted || !ac) return;
      try {
        var o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime;
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
        g.gain.setValueAtTime(vol || 0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(t0 + dur + 0.02);
      } catch (e) {}
    }
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function arpeggio(notes, step) { notes.forEach(function (f, k) { later(function () { tone(f, 0.22, 'triangle', 0.16); }, k * step); }); }

    /* ---------- actions ---------- */
    function tryMove(a, b) {
      var src = tubes[a], dst = tubes[b];
      if (a === b || !src.length) return false;
      var c = src[src.length - 1].c;
      if (dst.length && dst[dst.length - 1].c !== c) return false;
      if (dst.length >= CAP) return false;
      history.push(snapshot()); if (history.length > 80) history.shift();
      var k = 0, t0 = performance.now();
      while (src.length && src[src.length - 1].c === c && dst.length < CAP) {
        var ball = src.pop(), fromIdx = src.length;
        dst.push(ball);
        ball.anim = { a: a, b: b, fromIdx: fromIdx, toIdx: dst.length - 1, start: t0 + k * 75, dur: 440, lifted: k === 0 && lift[a] > 0.5 };
        k++;
      }
      lift[a] = 0; moves++; pending = true;
      tone(520, 0.1, 'sine', 0.12, 700);
      return true;
    }

    function addTube() {
      if (state !== 'play' || tubes.length > initial.length || pending) { tone(180, 0.15, 'square', 0.05); return; }
      history.push(snapshot());
      tubes.push([]); done.push(false); lift.push(0); shake.push(0); doneFlash.push(-9999);
      layout(); tone(700, 0.15, 'triangle', 0.15, 1000);
    }
    function undo() {
      if (state !== 'play' || pending || !history.length) { tone(180, 0.15, 'square', 0.05); return; }
      var snap = history.pop();
      tubes = snap.map(function (t) { return t.map(newBall); });
      done = tubes.map(isDone);
      lift = tubes.map(function () { return 0; });
      shake = tubes.map(function () { return 0; });
      doneFlash = tubes.map(function () { return -9999; });
      selected = -1; layout(); tone(420, 0.12, 'sine', 0.12, 300);
    }
    function restart() {
      history = []; moves = 0; state = 'play'; particles = [];
      setTubes(initial); tone(400, 0.2, 'triangle', 0.12, 250);
    }

    function starAt(x, y, c) {
      particles.push({ t: 's', x: x, y: y, vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 180, life: 0, max: 0.9 + Math.random() * 0.5, size: 6 + Math.random() * 8, col: c || '#ffe066' });
    }
    function celebrateTube(i) {
      doneFlash[i] = now;
      for (var k = 0; k < 16; k++) starAt(pos[i].x, pos[i].top, ['#ffe066', '#ffffff', '#ffb3d9'][k % 3]);
      arpeggio([523, 659, 784, 1047], 70);
    }
    function celebrateWin() {
      state = 'win'; winT = now;
      var par = Math.round(nc * 3.2);
      stars = moves <= par ? 3 : (moves <= par * 1.5 ? 2 : 1);
      for (var k = 0; k < 120; k++) {
        particles.push({ t: 'c', x: Math.random() * cw, y: -20 - Math.random() * ch * 0.4, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 160,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, life: 0, max: 4 + Math.random() * 2, size: 6 + Math.random() * 8,
          col: PALETTE[k % PALETTE.length] });
      }
      arpeggio([523, 659, 784, 1047, 784, 1047, 1319], 110);
    }
    function afterMove() {
      tubes.forEach(function (t, i) {
        var dn = isDone(t);
        if (dn && !done[i]) { done[i] = true; celebrateTube(i); }
        else if (!dn) done[i] = false;
      });
      if (tubes.filter(isDone).length === nc) later(celebrateWin, 450);
    }

    /* ---------- entrées ---------- */
    function onDown(e) {
      e.preventDefault();
      initAudio();
      var r = canvas.getBoundingClientRect();
      var px = (e.clientX - r.left) * (cw / r.width), py = (e.clientY - r.top) * (ch / r.height);

      for (var b = 0; b < btns.length; b++) {
        var bt = btns[b];
        if (Math.hypot(px - bt.x, py - bt.y) <= bt.r * 1.15) {
          if (bt.id === 'undo') undo();
          else if (bt.id === 'restart') restart();
          else if (bt.id === 'add') addTube();
          else if (bt.id === 'fs') { /* géré dans onClick (geste utilisateur requis) */ }
          else if (bt.id === 'sound') {
            muted = !muted;
            try { localStorage.setItem(LS_KEY + '_mute', muted ? '1' : '0'); } catch (er) {}
            tone(600, 0.1, 'sine', 0.12);
          }
          return;
        }
      }

      if (state === 'win') {
        if (now - winT > 700) { loadLevel(lvl + 1); tone(600, 0.15, 'triangle', 0.15, 900); }
        return;
      }
      if (pending) return;

      var hit = -1;
      for (var i = 0; i < pos.length; i++) {
        var p = pos[i];
        if (Math.abs(px - p.x) <= p.cw * 0.49 && py >= p.top - D * 1.3 && py <= p.bottom + D * 0.3) { hit = i; break; }
      }
      if (hit < 0) { selected = -1; return; }

      if (selected < 0) {
        if (tubes[hit].length && !done[hit]) { selected = hit; tone(660, 0.1, 'sine', 0.12, 880); }
        else shake[hit] = now;
      } else if (selected === hit) {
        selected = -1; tone(500, 0.08, 'sine', 0.1, 400);
      } else {
        var from = selected;
        if (tryMove(from, hit)) { selected = -1; }
        else if (tubes[hit].length && !done[hit] && tubes[hit].length > 0 &&
                 tubes[hit][tubes[hit].length - 1].c !== tubes[from][tubes[from].length - 1].c) {
          selected = hit; tone(660, 0.1, 'sine', 0.12, 880);
        } else { shake[hit] = now; tone(180, 0.15, 'square', 0.05); }
      }
    }
    function onClick(e) {
      var r = canvas.getBoundingClientRect();
      var px = (e.clientX - r.left) * (cw / r.width), py = (e.clientY - r.top) * (ch / r.height);
      for (var b = 0; b < btns.length; b++) {
        if (btns[b].id === 'fs' && Math.hypot(px - btns[b].x, py - btns[b].y) <= btns[b].r * 1.15) { toggleFs(); return; }
      }
    }
    function onTouchMove(e) { e.preventDefault(); }

    canvas.addEventListener('click', onClick);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { resize(); }); ro.observe(canvas); }

    /* ---------- dessin ---------- */
    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }
    function txt(s, x, y, size, fill, stroke, align) {
      ctx.font = '800 ' + size + 'px ' + FONT;
      ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      if (stroke) { ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
      ctx.fillStyle = fill; ctx.fillText(s, x, y);
    }
    function star(x, y, r, rot) {
      ctx.beginPath();
      for (var k = 0; k < 10; k++) {
        var rad = k % 2 ? r * 0.45 : r, a = rot + k * PI / 5 - PI / 2;
        ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      ctx.closePath();
    }

    function drawBall(x, y, r, c, mood, bo, sx, sy) {
      var col = PALETTE[c];
      ctx.save(); ctx.translate(x, y); ctx.scale(sx || 1, sy || 1);
      var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, mix(col, '#ffffff', 0.55)); g.addColorStop(0.55, col); g.addColorStop(1, mix(col, '#000000', 0.22));
      ctx.beginPath(); ctx.arc(0, 0, r, 0, PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = r * 0.1; ctx.strokeStyle = mix(col, '#000000', 0.38); ctx.stroke();
      // reflet
      ctx.save(); ctx.rotate(-0.7); ctx.beginPath(); ctx.ellipse(-r * 0.05, -r * 0.62, r * 0.2, r * 0.1, 0, 0, PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill(); ctx.restore();
      // visage
      var dark = '#3b2340', blink = ((now + bo * 1000) % 4300) < 140;
      var ex = r * 0.3, ey = -r * 0.02;
      ctx.lineCap = 'round';
      if (mood === 'happy') {
        ctx.strokeStyle = dark; ctx.lineWidth = r * 0.075;
        [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.arc(s * ex, ey + r * 0.06, r * 0.12, PI * 1.1, PI * 1.9); ctx.stroke(); });
      } else if (blink) {
        ctx.strokeStyle = dark; ctx.lineWidth = r * 0.07;
        [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * ex - r * 0.1, ey); ctx.lineTo(s * ex + r * 0.1, ey); ctx.stroke(); });
      } else {
        var rx = mood === 'excited' ? r * 0.14 : r * 0.11, ry = mood === 'excited' ? r * 0.19 : r * 0.15;
        [-1, 1].forEach(function (s) {
          ctx.beginPath(); ctx.ellipse(s * ex, ey, rx, ry, 0, 0, PI * 2); ctx.fillStyle = dark; ctx.fill();
          ctx.beginPath(); ctx.arc(s * ex - rx * 0.3, ey - ry * 0.35, r * 0.045, 0, PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        });
      }
      ctx.fillStyle = 'rgba(255,100,140,.5)';
      [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.ellipse(s * r * 0.54, r * 0.27, r * 0.13, r * 0.08, 0, 0, PI * 2); ctx.fill(); });
      if (mood === 'excited' || mood === 'happy') {
        var big = mood === 'happy';
        ctx.beginPath(); ctx.arc(0, r * (big ? 0.18 : 0.24), r * (big ? 0.2 : 0.13), 0, PI); ctx.closePath();
        ctx.fillStyle = '#5a1f2e'; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.beginPath(); ctx.arc(0, r * (big ? 0.38 : 0.37), r * 0.1, 0, PI * 2); ctx.fillStyle = '#ff7a98'; ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(0, r * 0.14, r * 0.15, 0.15 * PI, 0.85 * PI);
        ctx.strokeStyle = dark; ctx.lineWidth = r * 0.07; ctx.stroke();
      }
      ctx.restore();
    }

    function animPos(b) {
      var a = b.anim, t = (now - a.start) / a.dur;
      var P1 = liftPos(a.a), P2 = liftPos(a.b), P3 = slot(a.b, a.toIdx);
      var P0 = a.lifted ? P1 : slot(a.a, a.fromIdx);
      if (t <= 0) return P0;
      if (t >= 1) return P3;
      if (t < 0.25) return lerp(P0, P1, ease(t / 0.25));
      if (t < 0.6) { var u = ease((t - 0.25) / 0.35), p = lerp(P1, P2, u); p.y -= Math.sin(u * PI) * D * 0.35; return p; }
      var v = (t - 0.6) / 0.4; return lerp(P2, P3, v * v);
    }

    function tubePath(x, top, bottom, w) {
      var r = w / 2;
      ctx.beginPath(); ctx.moveTo(x - r, top); ctx.lineTo(x - r, bottom - r);
      ctx.arc(x, bottom - r, r, PI, 0, true); ctx.lineTo(x + r, top);
    }

    function drawBackground() {
      // fond uni profond avec un halo doux au centre
      var g = ctx.createRadialGradient(cw / 2, ch * 0.45, Math.min(cw, ch) * 0.1, cw / 2, ch * 0.45, Math.max(cw, ch) * 0.8);
      g.addColorStop(0, '#46479e'); g.addColorStop(1, '#22225a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      // motif de pois décalés, très discret et fixe
      var s = Math.max(44, D * 1.05), rr0 = s * 0.1, row = 0;
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      for (var y = s / 2; y < ch + s; y += s * 0.8, row++) {
        for (var x = (row % 2) * s / 2; x < cw + s; x += s) {
          ctx.beginPath(); ctx.arc(x, y, rr0, 0, PI * 2); ctx.fill();
        }
      }
    }

    function drawShelves() {
      var rows = {};
      pos.forEach(function (p) {
        var k = Math.round(p.bottom);
        if (!rows[k]) rows[k] = { minX: p.x, maxX: p.x, bottom: p.bottom };
        rows[k].minX = Math.min(rows[k].minX, p.x); rows[k].maxX = Math.max(rows[k].maxX, p.x);
      });
      Object.keys(rows).forEach(function (k) {
        var r = rows[k], x0 = r.minX - TW * 1.0, x1 = r.maxX + TW * 1.0, w = x1 - x0, y = r.bottom - D * 0.05, h = D * 0.42;
        ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(x0 + D * 0.05, y + D * 0.1, w, h, h * 0.4); ctx.fill();
        var g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#e9b27a'); g.addColorStop(0.18, '#d89a60'); g.addColorStop(1, '#a8683a');
        ctx.fillStyle = g; rr(x0, y, w, h, h * 0.4); ctx.fill();
        ctx.lineWidth = D * 0.04; ctx.strokeStyle = '#6e4121'; ctx.stroke();
        ctx.save(); rr(x0, y, w, h, h * 0.4); ctx.clip();
        ctx.strokeStyle = 'rgba(110,65,33,.35)'; ctx.lineWidth = D * 0.025; ctx.lineCap = 'round';
        for (var gx = x0 + D * 0.7, n = 0; gx < x1 - D * 0.4; gx += D * 1.7, n++) {
          ctx.beginPath(); ctx.moveTo(gx, y + h * (0.45 + (n % 2) * 0.2)); ctx.lineTo(gx + D * 0.7, y + h * (0.45 + (n % 2) * 0.2)); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x0, y + h * 0.05, w, h * 0.1);
        ctx.restore();
      });
    }

    function drawHUD() {
      var fs = Math.min(26, cw * 0.06 + 8), py = Math.max(64, ch * 0.11) * 0.5;
      var w = fs * 7, h = fs * 1.9;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(cw / 2 - w / 2, py - h / 2 + 4, w, h, h / 2); ctx.fill();
      ctx.fillStyle = '#fff'; rr(cw / 2 - w / 2, py - h / 2, w, h, h / 2); ctx.fill();
      txt('Niveau ' + lvl, cw / 2, py + 1, fs, '#6a4cff');
      txt('Coups : ' + moves, 14, py + 1, fs * 0.7, '#fff', 'rgba(20,15,60,.7)', 'left');
    }

    function drawIcon(id, x, y, r, col) {
      ctx.save();
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = r * 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      function head(px, py, dx, dy, s) {
        var nx = -dy, ny = dx;
        ctx.beginPath();
        ctx.moveTo(px + dx * s, py + dy * s);
        ctx.lineTo(px + nx * s * 0.75 - dx * s * 0.15, py + ny * s * 0.75 - dy * s * 0.15);
        ctx.lineTo(px - nx * s * 0.75 - dx * s * 0.15, py - ny * s * 0.75 - dy * s * 0.15);
        ctx.closePath(); ctx.fill();
      }
      var R = r * 0.42, a0, a1, px, py;
      if (id === 'undo') {
        a0 = -PI * 0.85; a1 = PI * 0.35;
        ctx.beginPath(); ctx.arc(x, y + r * 0.04, R, a0, a1, false); ctx.stroke();
        px = x + Math.cos(a0) * R; py = y + r * 0.04 + Math.sin(a0) * R;
        head(px, py, Math.sin(a0), -Math.cos(a0), r * 0.3);
      } else if (id === 'restart') {
        a0 = -PI * 0.35; a1 = PI * 1.15;
        ctx.beginPath(); ctx.arc(x, y, R, a0, a1, false); ctx.stroke();
        px = x + Math.cos(a1) * R; py = y + Math.sin(a1) * R;
        head(px, py, -Math.sin(a1), Math.cos(a1), r * 0.3);
      } else if (id === 'add') {
        var q = r * 0.4;
        ctx.beginPath(); ctx.moveTo(x - q, y); ctx.lineTo(x + q, y); ctx.moveTo(x, y - q); ctx.lineTo(x, y + q); ctx.stroke();
      } else if (id === 'sound') {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.4, y - r * 0.14); ctx.lineTo(x - r * 0.2, y - r * 0.14); ctx.lineTo(x + r * 0.04, y - r * 0.36);
        ctx.lineTo(x + r * 0.04, y + r * 0.36); ctx.lineTo(x - r * 0.2, y + r * 0.14); ctx.lineTo(x - r * 0.4, y + r * 0.14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (muted) {
          ctx.beginPath(); ctx.moveTo(x + r * 0.22, y - r * 0.16); ctx.lineTo(x + r * 0.5, y + r * 0.16);
          ctx.moveTo(x + r * 0.5, y - r * 0.16); ctx.lineTo(x + r * 0.22, y + r * 0.16); ctx.stroke();
        } else {
          ctx.lineWidth = r * 0.13;
          ctx.beginPath(); ctx.arc(x + r * 0.04, y, r * 0.26, -0.9, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(x + r * 0.04, y, r * 0.46, -0.9, 0.9); ctx.stroke();
        }
      } else if (id === 'fs') {
        var s = r * 0.38, len = r * 0.24, inward = isFs();
        for (var sx = -1; sx <= 1; sx += 2) for (var sy = -1; sy <= 1; sy += 2) {
          ctx.beginPath();
          if (!inward) {
            ctx.moveTo(x + sx * s, y + sy * (s - len)); ctx.lineTo(x + sx * s, y + sy * s); ctx.lineTo(x + sx * (s - len), y + sy * s);
          } else {
            var c = s * 0.35;
            ctx.moveTo(x + sx * c, y + sy * s); ctx.lineTo(x + sx * c, y + sy * c); ctx.lineTo(x + sx * s, y + sy * c);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawButtons() {
      btns.forEach(function (b) {
        var off = (b.id === 'undo' && (!history.length || pending)) || (b.id === 'add' && tubes.length > initial.length);
        ctx.beginPath(); ctx.arc(b.x, b.y + 4, b.r, 0, PI * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, PI * 2); ctx.fillStyle = off ? 'rgba(225,225,240,.55)' : '#fff'; ctx.fill();
        ctx.globalAlpha = off ? 0.4 : 1;
        drawIcon(b.id, b.x, b.y, b.r, '#3a3590');
        ctx.globalAlpha = 1;
      });
    }

    function drawTube(i, front) {
      var p = pos[i], x = p.x, top = p.top, bottom = p.bottom, w = TW;
      var sh = now - shake[i] < 350 ? Math.sin((now - shake[i]) / 35) * D * 0.08 * (1 - (now - shake[i]) / 350) : 0;
      x += sh;
      var isSel = selected === i, flash = Math.max(0, 1 - (now - doneFlash[i]) / 700);
      ctx.save();
      if (!front) {
        ctx.beginPath(); ctx.ellipse(x, bottom + D * 0.04, w * 0.55, D * 0.09, 0, 0, PI * 2);
        ctx.fillStyle = 'rgba(60,30,10,.35)'; ctx.fill();
        tubePath(x, top, bottom, w);
        var g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, 'rgba(255,255,255,.38)'); g.addColorStop(0.5, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,.32)');
        ctx.fillStyle = g; ctx.fill();
      } else {
        tubePath(x, top, bottom, w);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.lineWidth = D * 0.12; ctx.strokeStyle = 'rgba(90,60,170,.25)'; ctx.stroke();
        if (done[i] || isSel || flash > 0) { ctx.shadowColor = done[i] ? '#ffe066' : '#ffffff'; ctx.shadowBlur = D * (0.5 + flash); }
        ctx.lineWidth = D * 0.075; ctx.strokeStyle = done[i] ? '#ffe066' : (isSel ? '#fff7b0' : 'rgba(255,255,255,.95)'); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = D * 0.09;
        ctx.beginPath(); ctx.moveTo(x - w * 0.3, top + D * 0.45); ctx.lineTo(x - w * 0.3, bottom - D * 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - w * 0.3, bottom - D * 0.55, D * 0.04, 0, PI * 2); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
        ctx.fillStyle = done[i] ? '#fff2a8' : '#ffffff';
        rr(x - w / 2 - D * 0.07, top - D * 0.13, w + D * 0.14, D * 0.2, D * 0.1); ctx.fill();
        ctx.lineWidth = D * 0.04; ctx.strokeStyle = 'rgba(90,60,170,.25)'; ctx.stroke();
        if (done[i]) {
          ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#e0a800'; ctx.lineWidth = D * 0.05;
          star(x, top - D * 0.55 + Math.sin(now / 300 + i) * D * 0.06, D * 0.26, Math.sin(now / 500) * 0.3); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawParticles(dt) {
      for (var k = particles.length - 1; k >= 0; k--) {
        var p = particles[k]; p.life += dt;
        if (p.life > p.max || p.y > ch + 40) { particles.splice(k, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t === 's') {
          p.vy += 260 * dt;
          ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
          ctx.fillStyle = p.col; star(p.x, p.y, p.size, p.life * 3); ctx.fill();
        } else {
          p.rot += p.vr * dt; p.vx += Math.sin(p.life * 4 + k) * 40 * dt;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawWin() {
      var t = Math.min(1, (now - winT) / 500);
      ctx.fillStyle = 'rgba(40,20,90,' + (0.4 * t) + ')'; ctx.fillRect(0, 0, cw, ch);
      var pw = Math.min(cw * 0.86, 420), ph = Math.min(ch * 0.5, 300);
      var sc = 0.6 + 0.4 * (1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2));
      ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.scale(sc, sc); ctx.globalAlpha = t;
      ctx.fillStyle = 'rgba(80,50,160,.35)'; rr(-pw / 2, -ph / 2 + 8, pw, ph, 30); ctx.fill();
      ctx.fillStyle = '#fff'; rr(-pw / 2, -ph / 2, pw, ph, 30); ctx.fill();
      txt('Bravo !', 0, -ph * 0.3, Math.min(52, pw * 0.14), '#ff6fa5', '#fff');
      for (var s = 0; s < 3; s++) {
        var st = Math.max(0, Math.min(1, (now - winT - 350 - s * 220) / 300));
        var on = s < stars, r = Math.min(34, pw * 0.09) * (0.3 + 0.7 * ease(st));
        ctx.fillStyle = on ? '#ffd93d' : '#e4def5'; ctx.strokeStyle = on ? '#e0a800' : '#cfc6ec'; ctx.lineWidth = 4;
        star((s - 1) * pw * 0.22, -ph * 0.04 - (s === 1 ? 10 : 0), r, (1 - ease(st)) * 2); ctx.fill(); ctx.stroke();
      }
      txt(moves + ' coups', 0, ph * 0.14, Math.min(22, pw * 0.06), '#8a78c9');
      var bw = pw * 0.7, bh = Math.min(58, ph * 0.2), by = ph * 0.34, pulse = 1 + Math.sin(now / 250) * 0.03;
      ctx.save(); ctx.translate(0, by); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#1da565'; rr(-bw / 2, -bh / 2 + 5, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = '#3ddc97'; rr(-bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill();
      txt('Niveau suivant ▶', 0, 1, bh * 0.4, '#fff', '#1da565'); ctx.restore();
      ctx.restore(); ctx.globalAlpha = 1;
    }

    function frame(ts) {
      if (!alive) return;
      if (!canvas.isConnected) { cleanup(); return; }
      raf = requestAnimationFrame(frame);
      now = performance.now();
      var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;

      // fin d'animation des balles
      var busy = false;
      tubes.forEach(function (t) {
        t.forEach(function (b) {
          if (b.anim) {
            if (now >= b.anim.start + b.anim.dur) { b.anim = null; b.land = now; tone(300 + Math.random() * 60, 0.12, 'sine', 0.16, 150); }
            else busy = true;
          }
        });
      });
      if (pending && !busy) { pending = false; afterMove(); }

      tubes.forEach(function (_, i) {
        var target = (selected === i) ? 1 : 0;
        lift[i] += (target - lift[i]) * (1 - Math.pow(0.0004, dt));
      });

      drawBackground();
      drawHUD();
      drawShelves();

      for (var i = 0; i < tubes.length; i++) drawTube(i, false);

      var movers = [];
      for (i = 0; i < tubes.length; i++) {
        var t = tubes[i];
        for (var k = 0; k < t.length; k++) {
          var b = t[k];
          if (b.anim) { movers.push(b); continue; }
          var s = slot(i, k), isTop = k === t.length - 1, mood = 'normal';
          if (isTop && lift[i] > 0.02) { var q = lerp(s, liftPos(i), ease(lift[i])); s = q; if (lift[i] > 0.4) mood = 'excited'; s.y += Math.sin(now / 160) * D * 0.03 * lift[i]; }
          var hop = 0;
          if (done[i] || state === 'win') { mood = 'happy'; hop = -Math.abs(Math.sin(now / 230 + k * 0.6 + i)) * D * (state === 'win' ? 0.14 : 0.05); }
          var sx = 1, sy = 1, lk = (now - b.land) / 320;
          if (lk >= 0 && lk < 1) { var sq = Math.sin(lk * PI * 2) * (1 - lk) * 0.24; sx = 1 + sq; sy = 1 - sq; }
          drawBall(s.x, s.y + hop + Math.sin(now / 700 + b.bo) * D * 0.01, D * 0.5 * 0.98, b.c, mood, b.bo, sx, sy);
        }
      }

      for (i = 0; i < tubes.length; i++) drawTube(i, true);

      movers.forEach(function (b) {
        var p = animPos(b);
        var stretch = 1 + Math.min(0.12, Math.abs(Math.sin((now - b.anim.start) / b.anim.dur * PI)) * 0.12);
        drawBall(p.x, p.y, D * 0.5 * 0.98, b.c, 'excited', b.bo, 1 / stretch, stretch);
      });

      drawButtons();

      if (lvl === 1 && moves === 0 && state === 'play') {
        txt('Touche un tube, puis un autre !', cw / 2, btns.length ? btns[0].y - btns[0].r - 26 + Math.sin(now / 300) * 4 : ch - 120, Math.min(22, cw * 0.05 + 6), '#fff', 'rgba(20,15,60,.75)');
      }

      drawParticles(dt);
      if (state === 'win') drawWin();
    }

    /* ---------- fermeture ---------- */
    function cleanup() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      if (document.fullscreenElement === canvas && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('keydown', onKey);
      if (pseudoFs) { canvas.style.cssText = savedCss; pseudoFs = false; }
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      if (ro) ro.disconnect();
      if (ac) { try { ac.close(); } catch (e) {} ac = null; }
      if (ownCanvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (window._ballSortCleanup === cleanup) window._ballSortCleanup = null;
    }
    window._ballSortCleanup = cleanup;

    resize();
    loadLevel(lvl);
    raf = requestAnimationFrame(frame);
    return cleanup;
  }

  window.startBallSort = startBallSort;
  if (typeof module !== 'undefined' && module.exports) module.exports = startBallSort;
})();