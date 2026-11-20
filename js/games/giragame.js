/* ============================================================
   GIRA GAME — le "Dino game" de Chrome, version girafe 🦒
   Noir et blanc, pixel art, tout simple (comme l'original).

   Pour Arbest Arcade : remplace js/games/giragame.js
   (même fonction d'entrée : startGirafe, aucun changement dans main.js).

   - utilise #game-canvas (600x400) comme les autres jeux du site
   - fin de partie : triggerGameOver(score) → écran + record du site
   - son : playSound() du site (respecte le bouton SON)
   - nettoyage : window._girafeCleanup (appelé par stopAllGames)

   Contrôles :
     PC      Espace / ↑ / Z / clic = sauter · ↓ / S = se baisser
     Mobile  toucher = sauter · maintenir sous la ligne du sol = se baisser
   ============================================================ */
(function () {
  'use strict';

  var P = 3;                      // taille d'un "pixel" du sprite
  var W0 = 600, H0 = 400;         // zone de jeu logique (= canvas du site)
  var GROUND = 310;               // hauteur du sol

  /* ---------- sprites (# = noir, o = trou, . = vide) ---------- */
  var STAND_BODY = [
    '...............#..#.....',
    '...............#..#.....',
    '..............########..',
    '..............####o#####',
    '..............##########',
    '..............########..',
    '.............#####......',
    '.............#o###......',
    '.............####o......',
    '.............#####......',
    '............#####.......',
    '............#o###.......',
    '............###o#.......',
    '............#####.......',
    '...........#####........',
    '...........#o###........',
    '...........###o#........',
    '...........#####........',
    '..........#####.........',
    '.#.#############........',
    '##.#o###o####o###.......',
    '#..##############.......',
    '...###o#####o####.......',
    '...##############.......',
    '....############........',
    '.....##########.........'
  ];
  var L_FULL = '.....##.##.##.##........';
  var L_A    = '.....##....##...........';
  var L_B    = '........##....##........';

  var DUCK_BODY = [
    '.......................#..#...',
    '.......................#..#...',
    '......................#######.',
    '............###########o######',
    '............##################',
    '#..##############.....######..',
    '#..#o###o###o####.............',
    '...##############.............',
    '...##o#####o#####.............',
    '...##############.............',
    '....############..............',
    '.....##########...............'
  ];
  var D_FULL = '.....##.##.##.##..............';
  var D_A    = '.....##....##.................';
  var D_B    = '........##....##..............';

  function rep(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a; }

  function parse(rows) {
    var runs = [], holes = [];
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y], x = 0;
      while (x < row.length) {
        if (row[x] === '#' || row[x] === 'o') {
          var s = x;
          while (x < row.length && (row[x] === '#' || row[x] === 'o')) { if (row[x] === 'o') holes.push([x, y]); x++; }
          runs.push([s, y, x - s]);
        } else x++;
      }
    }
    return { runs: runs, holes: holes, w: rows[0].length, h: rows.length };
  }

  var SP = {
    stand: [
      parse(STAND_BODY.concat(rep(L_FULL, 8))),
      parse(STAND_BODY.concat(rep(L_FULL, 4), rep(L_A, 4))),
      parse(STAND_BODY.concat(rep(L_FULL, 4), rep(L_B, 4)))
    ],
    duck: [
      parse(DUCK_BODY.concat(rep(D_FULL, 8))),
      parse(DUCK_BODY.concat(rep(D_FULL, 4), rep(D_A, 4))),
      parse(DUCK_BODY.concat(rep(D_FULL, 4), rep(D_B, 4)))
    ]
  };

  /* ---------- couleurs : jour / nuit (comme Chrome) ---------- */
  var DAY = { bg: '#f7f7f7', fg: '#535353', soft: '#d6d6d6', mid: '#8a8a8a' };
  var NIGHT = { bg: '#1a1a1a', fg: '#dedede', soft: '#383838', mid: '#8f8f8f' };
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  /* ============================================================
     Point d'entrée appelé par le site (initFn: 'startGirafe')
     ============================================================ */
  window.startGirafe = function () {
    var cv = document.getElementById('game-canvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');

    var state = 'ready';                       // ready | run | dead
    var running = true, raf = 0, last = 0, t = 0;
    var night = 0, speed = 360, elapsed = 0, dist = 0, score = 0;
    var jumpY = 0, vy = 0, onGround = true, ducking = false;
    var keyDuck = false, pointers = {};
    var obstacles = [], spawnIn = 600, deadAt = 0;
    var blinkT = 0, lastMile = 0, lastShown = -1;
    var clouds = [], bumps = [], stars = [];
    var hi = 0;
    try { hi = parseInt(localStorage.getItem('hs_Giragame'), 10) || 0; } catch (e) {}
    var scoreEl = document.getElementById('current-score');
    var prevTouchAction = cv.style.touchAction;
    cv.style.touchAction = 'none';

    var gx = 40;

    function col(k) { return mix(DAY[k], NIGHT[k], night); }

    function init() {
      var i;
      clouds = []; for (i = 0; i < 4; i++) clouds.push({ x: rand(0, W0), y: rand(40, 150) });
      bumps = [];  for (i = 0; i < 28; i++) bumps.push({ x: rand(0, W0), y: rand(6, 16), w: rand(2, 12) });
      stars = [];  for (i = 0; i < 14; i++) stars.push({ x: rand(20, W0 - 20), y: rand(30, 170) });
    }

    function reset() {
      obstacles = []; elapsed = 0; dist = 0; score = 0; speed = 360;
      jumpY = 0; vy = 0; onGround = true; ducking = false;
      spawnIn = 600; blinkT = 0; lastMile = 0;
    }

    function snd(f, d) { if (typeof playSound === 'function') playSound(f, d, 'square'); }

    function jump() {
      if (state !== 'run' || !onGround) return;
      vy = 900; onGround = false;
      snd(520, 0.09);
    }

    function die() {
      state = 'dead'; deadAt = performance.now();
      var s = Math.floor(score);
      if (s > hi) hi = s;
      if (typeof triggerGameOver === 'function') triggerGameOver(s);
    }

    function restart() {
      var b = document.getElementById('btn-restart');
      if (b && typeof triggerGameOver === 'function') b.click();
      else { reset(); state = 'run'; }
    }

    function press() {
      if (state === 'ready') { reset(); state = 'run'; jump(); }
      else if (state === 'run') jump();
      else if (state === 'dead' && performance.now() - deadAt > 400) restart();
    }

    function wantDuck() {
      if (keyDuck) return true;
      for (var id in pointers) if (pointers[id] === 'duck') return true;
      return false;
    }

    /* ---------- obstacles ---------- */
    function spawn() {
      var o, r = Math.random();
      if (score >= 200 && r < 0.25) {
        o = { kind: 'bird', w: 20 * P, h: 11 * P, bottom: Math.random() < 0.5 ? 70 : 20 };
      } else {
        var k = Math.random(), parts = [];
        if (k < 0.35) parts = [{ ox: 0, th: 15, aL: Math.random() < 0.6, aR: Math.random() < 0.6 }];
        else if (k < 0.65) parts = [{ ox: 0, th: 22, aL: true, aR: true }];
        else if (k < 0.88 || score < 400) parts = [{ ox: 0, th: 15, aL: false, aR: true }, { ox: 14 * P, th: 15, aL: true, aR: false }];
        else parts = [{ ox: 0, th: 15, aL: false, aR: true }, { ox: 14 * P, th: 22, aL: true, aR: true }, { ox: 28 * P, th: 15, aL: true, aR: false }];
        var h = 0;
        for (var i = 0; i < parts.length; i++) h = Math.max(h, parts[i].th * P);
        o = { kind: 'cactus', parts: parts, w: parts[parts.length - 1].ox + 13 * P, h: h, bottom: 0 };
      }
      o.x = W0 + 20;
      o.frame = 0;
      obstacles.push(o);
    }

    function giraffeBoxes() {
      var b = [];
      if (ducking) {
        var y0 = GROUND - SP.duck[0].h * P;
        b.push({ x: gx + 12 * P + 2, y: y0 + 2 * P + 2, w: 18 * P - 4, h: 4 * P - 4 });
        b.push({ x: gx + 3 * P + 2, y: y0 + 5 * P + 2, w: 14 * P - 4, h: 15 * P - 2 });
      } else {
        var y1 = GROUND - jumpY - SP.stand[0].h * P;
        b.push({ x: gx + 14 * P + 2, y: y1 + 2 * P + 2, w: 10 * P - 4, h: 4 * P - 4 });
        b.push({ x: gx + 11 * P + 2, y: y1 + 6 * P, w: 7 * P - 4, h: 13 * P });
        b.push({ x: gx + 3 * P + 2, y: y1 + 19 * P + 2, w: 13 * P - 4, h: 15 * P - 2 });
      }
      return b;
    }

    function obstacleBox(o) {
      var top = GROUND - o.bottom - o.h;
      if (o.kind === 'bird') return { x: o.x + 2 * P, y: top + 3 * P, w: 16 * P, h: 5 * P };
      return { x: o.x + 2, y: top + 2, w: o.w - 4, h: o.h - 2 };
    }

    /* ---------- mise à jour ---------- */
    function update(dt) {
      t += dt;
      var i;
      var targetNight = (state === 'run' && Math.floor(score / 700) % 2) ? 1 : (state === 'run' ? 0 : night > 0.5 ? 1 : 0);
      night += (targetNight - night) * Math.min(1, dt * 1.5);
      if (blinkT > 0) blinkT = Math.max(0, blinkT - dt);

      var cs = state === 'run' ? speed * 0.15 : 12;
      for (i = 0; i < clouds.length; i++) {
        clouds[i].x -= cs * dt;
        if (clouds[i].x < -60) { clouds[i].x = W0 + rand(10, 120); clouds[i].y = rand(40, 150); }
      }
      if (state !== 'run') return;

      elapsed += dt;
      speed = Math.min(360 + elapsed * 5, 760);
      dist += speed * dt;
      score = dist * 0.025;

      var m = Math.floor(score / 100);
      if (m > lastMile) { lastMile = m; blinkT = 0.9; snd(880, 0.08); setTimeout(function () { snd(1180, 0.08); }, 90); }

      ducking = onGround && wantDuck();
      if (!onGround) {
        var g = 2600;
        if (wantDuck()) g *= 2.8;               // chute rapide
        vy -= g * dt;
        jumpY += vy * dt;
        if (jumpY <= 0) { jumpY = 0; vy = 0; onGround = true; }
      }

      for (i = 0; i < bumps.length; i++) {
        bumps[i].x -= speed * dt;
        if (bumps[i].x < -14) { bumps[i].x = W0 + rand(0, 40); bumps[i].y = rand(6, 16); bumps[i].w = rand(2, 12); }
      }

      for (i = obstacles.length - 1; i >= 0; i--) {
        var o = obstacles[i];
        o.x -= (o.kind === 'bird' ? speed + 50 : speed) * dt;
        if (o.kind === 'bird') o.frame = Math.floor(t / 0.13) % 2;
        if (o.x + o.w < -10) obstacles.splice(i, 1);
      }
      spawnIn -= speed * dt;
      if (spawnIn <= 0) {
        spawn();
        var minGap = 200 + speed * 0.55;
        spawnIn = obstacles[obstacles.length - 1].w + rand(minGap, minGap * 1.7);
      }

      var gb = giraffeBoxes();
      for (i = 0; i < obstacles.length; i++) {
        var hb = obstacleBox(obstacles[i]);
        for (var k = 0; k < gb.length; k++) if (overlap(gb[k], hb)) { die(); return; }
      }
    }

    /* ---------- dessin ---------- */
    function drawSprite(sp, x, y, fg, bg) {
      var i;
      ctx.fillStyle = fg;
      for (i = 0; i < sp.runs.length; i++) {
        var r = sp.runs[i];
        ctx.fillRect(Math.round(x + r[0] * P), Math.round(y + r[1] * P), r[2] * P, P);
      }
      ctx.fillStyle = bg;
      for (i = 0; i < sp.holes.length; i++) {
        var h = sp.holes[i];
        ctx.fillRect(Math.round(x + h[0] * P), Math.round(y + h[1] * P), P, P);
      }
    }

    function drawGiraffe(fg, bg) {
      var dead = state === 'dead';
      var frame = 0;
      if (state === 'run' && onGround) frame = 1 + (Math.floor(t / 0.1) % 2);
      var isDuck = ducking && !dead;
      var sp = isDuck ? SP.duck[frame] : SP.stand[onGround ? frame : 0];
      var x = gx, y = GROUND - jumpY - sp.h * P;
      drawSprite(sp, x, y, fg, bg);
      if (dead) {                                  // yeux en croix
        var ex = Math.round(x + 18 * P), ey = Math.round(y + 3 * P);
        ctx.fillStyle = fg;
        ctx.fillRect(ex, ey, 1, 1); ctx.fillRect(ex + 2, ey, 1, 1); ctx.fillRect(ex + 1, ey + 1, 1, 1);
        ctx.fillRect(ex, ey + 2, 1, 1); ctx.fillRect(ex + 2, ey + 2, 1, 1);
      }
    }

    function drawCactusPart(x, base, th, aL, aR) {
      var u = P, top = base - th * u;
      ctx.fillRect(x + 4 * u, top + u, 5 * u, th * u - u);
      ctx.fillRect(x + 5 * u, top, 3 * u, u);
      if (aL) {
        var ay = top + 4 * u;
        ctx.fillRect(x, ay, 3 * u, 8 * u);
        ctx.fillRect(x, ay + 5 * u, 5 * u, 3 * u);
      }
      if (aR) {
        var ay2 = top + 6 * u;
        ctx.fillRect(x + 10 * u, ay2, 3 * u, 8 * u);
        ctx.fillRect(x + 8 * u, ay2 + 5 * u, 5 * u, 3 * u);
      }
    }

    function drawBird(o, bg) {
      var u = P, x = Math.round(o.x), y = Math.round(GROUND - o.bottom - o.h);
      ctx.fillRect(x, y + 5 * u, 4 * u, 2 * u);              // queue
      ctx.fillRect(x + 4 * u, y + 4 * u, 10 * u, 4 * u);     // corps
      ctx.fillRect(x + 13 * u, y + 3 * u, 4 * u, 4 * u);     // tête
      ctx.fillRect(x + 17 * u, y + 4 * u, 3 * u, 2 * u);     // bec
      if (o.frame === 0) {                                   // aile en haut
        ctx.fillRect(x + 7 * u, y, 3 * u, u);
        ctx.fillRect(x + 6 * u, y + u, 5 * u, u);
        ctx.fillRect(x + 5 * u, y + 2 * u, 7 * u, 2 * u);
      } else {                                               // aile en bas
        ctx.fillRect(x + 5 * u, y + 8 * u, 7 * u, 2 * u);
        ctx.fillRect(x + 6 * u, y + 10 * u, 5 * u, u);
      }
      ctx.fillStyle = bg;
      ctx.fillRect(x + 15 * u, y + 4 * u, u, u);             // œil
      ctx.fillStyle = col('fg');
    }

    function pad(n, l) { var s = String(n); while (s.length < l) s = '0' + s; return s; }

    function draw() {
      var i, fg = col('fg'), bg = col('bg');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
      var s = Math.min(cv.width / W0, cv.height / H0);
      ctx.setTransform(s, 0, 0, s, (cv.width - W0 * s) / 2, (cv.height - H0 * s) / 2);

      // étoiles + lune (nuit)
      if (night > 0.05) {
        ctx.globalAlpha = night;
        ctx.fillStyle = fg;
        for (i = 0; i < stars.length; i++) ctx.fillRect(Math.round(stars[i].x), Math.round(stars[i].y), 3, 3);
        ctx.beginPath(); ctx.arc(480, 80, 14, 0, 6.2832); ctx.fill();
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(487, 75, 12, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // nuages
      ctx.fillStyle = col('soft');
      for (i = 0; i < clouds.length; i++) {
        var c = Math.round(clouds[i].x), cy = Math.round(clouds[i].y);
        ctx.fillRect(c + 12, cy, 18, 3);
        ctx.fillRect(c + 6, cy + 3, 30, 3);
        ctx.fillRect(c, cy + 6, 48, 3);
        ctx.fillRect(c + 3, cy + 9, 42, 3);
      }

      // sol
      ctx.fillStyle = fg;
      ctx.fillRect(0, GROUND, W0, 2);
      for (i = 0; i < bumps.length; i++) ctx.fillRect(Math.round(bumps[i].x), GROUND + bumps[i].y, Math.round(bumps[i].w), 2);

      // obstacles
      for (i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        ctx.fillStyle = fg;
        if (o.kind === 'bird') drawBird(o, bg);
        else for (var k = 0; k < o.parts.length; k++) {
          var p = o.parts[k];
          drawCactusPart(Math.round(o.x + p.ox), GROUND, p.th, p.aL, p.aR);
        }
      }

      drawGiraffe(fg, bg);

      // score
      var show = !(blinkT > 0 && Math.floor(blinkT * 8) % 2 === 0);
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.textBaseline = 'top'; ctx.textAlign = 'right';
      ctx.fillStyle = col('mid');
      ctx.fillText('HI ' + pad(hi, 5), 480, 20);
      if (show) { ctx.fillStyle = fg; ctx.fillText(pad(Math.floor(score), 5), 580, 20); }

      if (state === 'ready') {
        ctx.textAlign = 'center'; ctx.fillStyle = col('mid');
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillText('ESPACE / TOUCHER POUR SAUTER', W0 / 2, 110);
        ctx.fillText('BAS / TOUCHER SOUS LE SOL POUR SE BAISSER', W0 / 2, 132);
      } else if (state === 'dead') {
        ctx.textAlign = 'center'; ctx.fillStyle = fg;
        ctx.font = 'bold 26px "Courier New", monospace';
        ctx.fillText('G A M E   O V E R', W0 / 2, 110);
        ctx.strokeStyle = fg; ctx.lineWidth = 4; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(W0 / 2, 175, 17, 0.45, 5.6); ctx.stroke();
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.moveTo(W0 / 2 + 22, 170); ctx.lineTo(W0 / 2 + 8, 168); ctx.lineTo(W0 / 2 + 19, 181); ctx.closePath(); ctx.fill();
      }

      var sc = Math.floor(score);
      if (scoreEl && sc !== lastShown) { scoreEl.innerText = sc; lastShown = sc; }
    }

    /* ---------- boucle ---------- */
    function frame(ts) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min(0.05, Math.max(0, (ts - last) / 1000)) : 0.016;
      last = ts;
      update(dt);
      draw();
    }

    /* ---------- entrées ---------- */
    function onKeyDown(e) {
      var c = e.code;
      if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW' || c === 'Enter') {
        e.preventDefault();
        if (!e.repeat) press();
      } else if (c === 'ArrowDown' || c === 'KeyS') {
        e.preventDefault(); keyDuck = true;
      }
    }
    function onKeyUp(e) {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keyDuck = false;
    }
    function onPointerDown(e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      var ly = (e.clientY - r.top) / r.height;
      var duckZone = e.pointerType === 'touch' && state === 'run' && ly > 0.74;
      pointers[e.pointerId] = duckZone ? 'duck' : 'jump';
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      if (!duckZone) press();
    }
    function onPointerUp(e) { delete pointers[e.pointerId]; }
    function swallow(e) { e.preventDefault(); }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerUp);
    cv.addEventListener('touchstart', swallow, { passive: false });
    cv.addEventListener('touchmove', swallow, { passive: false });

    /* ---------- nettoyage (appelé par stopAllGames) ---------- */
    window._girafeCleanup = function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cv.removeEventListener('pointerdown', onPointerDown);
      cv.removeEventListener('pointerup', onPointerUp);
      cv.removeEventListener('pointercancel', onPointerUp);
      cv.removeEventListener('touchstart', swallow);
      cv.removeEventListener('touchmove', swallow);
      cv.style.touchAction = prevTouchAction;
      window._girafeCleanup = null;
    };

    init();
    raf = requestAnimationFrame(frame);
  };
})();