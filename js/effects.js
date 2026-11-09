/* ============================================================
   ARBEST ARCADE - Effets "wow"
   Placer ce fichier à côté de main.js (js/effects.js) et le charger APRÈS main.js.
   Tout est coupé pendant une partie (body.in-game) et sur mobile quand c'est lourd.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var isSmall = window.matchMedia('(max-width: 768px)').matches;

  /* ---------- 1. Écran de démarrage "INSERT COIN" (1 fois par session) ---------- */
  function bootScreen() {
    try { if (sessionStorage.getItem('arbest_boot')) return; sessionStorage.setItem('arbest_boot', '1'); } catch (e) {}
    var el = document.createElement('div');
    el.className = 'boot-screen';
    el.innerHTML =
      '<div class="boot-inner">' +
        '<img class="boot-logo" src="images/logo.png" alt="" onerror="this.remove()">' +
        '<div class="boot-title">ARBEST<span>ARCADE</span></div>' +
        '<div class="boot-bar"><i></i></div>' +
        '<div class="boot-coin">INSERT COIN</div>' +
      '</div>';
    document.body.appendChild(el);
    var done = false;
    function close() {
      if (done) return; done = true;
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 600);
    }
    el.addEventListener('click', close);
    setTimeout(close, reduceMotion ? 200 : 1700);
  }

  /* ---------- 2. Particules néon en fond ---------- */
  function particles() {
    if (reduceMotion) return;
    var host = document.querySelector('.cyber-bg');
    if (!host) return;
    var cv = document.createElement('canvas');
    cv.className = 'fx-particles';
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    var colors = ['#00f3ff', '#ff0055', '#a100ff', '#ffe600'];
    var w = 0, h = 0, dots = [], mx = 0, my = 0;
    var count = isSmall ? 28 : 60;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function make() {
      return {
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.8 + 0.6,
        v: Math.random() * 0.35 + 0.1,
        d: Math.random() * 0.6 + 0.2,
        c: colors[(Math.random() * colors.length) | 0],
        t: Math.random() * 6.28
      };
    }
    resize();
    for (var i = 0; i < count; i++) dots.push(make());
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', function (e) { mx = e.clientX / w - 0.5; my = e.clientY / h - 0.5; }, { passive: true });

    function frame() {
      requestAnimationFrame(frame);
      if (document.hidden || document.body.classList.contains('in-game')) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < dots.length; i++) {
        var p = dots[i];
        p.y -= p.v; p.t += 0.02;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        var x = p.x + Math.sin(p.t) * 12 - mx * 40 * p.d;
        var y = p.y - my * 40 * p.d;
        ctx.globalAlpha = 0.35 + Math.sin(p.t * 2) * 0.25;
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    frame();
  }

  /* ---------- 3. Cartes 3D : inclinaison + reflet qui suit la souris ---------- */
  function tilt() {
    if (!canHover || reduceMotion) return;
    var grid = document.getElementById('game-grid');
    if (!grid) return;
    var active = null;
    grid.addEventListener('mousemove', function (e) {
      var card = e.target.closest('.game-card');
      if (!card || card.classList.contains('disabled')) return;
      if (active && active !== card) reset(active);
      active = card;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    });
    grid.addEventListener('mouseleave', function () { if (active) reset(active); active = null; });
    function reset(c) { c.classList.remove('tilting'); c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); }
  }

  /* ---------- 4. Sous-titre machine à écrire ---------- */
  function typewriter() {
    var el = document.querySelector('.hero .subtitle');
    if (!el || reduceMotion) return;
    var phrases = [
      el.textContent.trim(),
      'Des jeux gratuits, directement dans ton navigateur',
      'Bats les records et grimpe au sommet',
      'Aucune installation. Juste du fun.'
    ];
    el.classList.add('typing');
    var pi = 0, ci = 0, del = false;
    (function step() {
      var txt = phrases[pi];
      ci += del ? -2 : 1;
      el.textContent = txt.slice(0, Math.max(ci, 0));
      var wait = del ? 18 : 38;
      if (!del && ci >= txt.length) { del = true; wait = 2200; }
      else if (del && ci <= 0) { del = false; pi = (pi + 1) % phrases.length; wait = 400; }
      setTimeout(step, wait);
    })();
  }

  /* ---------- 5. Compteurs animés ---------- */
  function counters() {
    var box = document.querySelector('.hero-stats');
    if (!box) return;
    if (typeof GAMES_REGISTRY !== 'undefined') {
      var vals = Object.keys(GAMES_REGISTRY).map(function (k) { return GAMES_REGISTRY[k]; });
      var g = box.querySelector('[data-stat="games"]');
      var c = box.querySelector('[data-stat="cats"]');
      if (g) g.dataset.count = vals.length;
      if (c) c.dataset.count = new Set(vals.map(function (v) { return v.category; })).size;
    }
    box.querySelectorAll('[data-count]').forEach(function (n) {
      var target = parseInt(n.dataset.count, 10) || 0, suffix = n.dataset.suffix || '', t0 = null;
      if (reduceMotion) { n.textContent = target + suffix; return; }
      function tick(t) {
        if (!t0) t0 = t;
        var k = Math.min((t - t0) / 1400, 1);
        n.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ---------- 6. Étincelles au clic ---------- */
  function sparks() {
    if (reduceMotion) return;
    var cols = ['#00f3ff', '#ff0055', '#ffe600', '#00ff88'];
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.btn-neon, .filter-btn, .game-card, .btn-stealth')) return;
      for (var i = 0; i < 10; i++) {
        var s = document.createElement('i');
        s.className = 'fx-spark';
        s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
        s.style.background = cols[i % cols.length];
        s.style.boxShadow = '0 0 8px ' + cols[i % cols.length];
        document.body.appendChild(s);
        var a = Math.random() * 6.283, d = 30 + Math.random() * 50;
        var anim = s.animate(
          [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
           { transform: 'translate(calc(-50% + ' + Math.cos(a) * d + 'px), calc(-50% + ' + Math.sin(a) * d + 'px)) scale(0)', opacity: 0 }],
          { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' });
        anim.onfinish = (function (n) { return function () { n.remove(); }; })(s);
      }
    }, { passive: true });
  }

  /* ---------- 7. Bouton "Surprends-moi" (jeu au hasard) ---------- */
  function randomGame() {
    var btn = document.getElementById('random-game');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (typeof GAMES_REGISTRY === 'undefined' || typeof openGame !== 'function') return;
      var ids = Object.keys(GAMES_REGISTRY).filter(function (k) { return !GAMES_REGISTRY[k].disabled; });
      if (ids.length) openGame(ids[(Math.random() * ids.length) | 0]);
    });
  }

  /* ---------- 8. En-tête qui s'illumine au scroll ---------- */
  function headerScroll() {
    var hd = document.querySelector('.glass-header');
    if (!hd) return;
    var on = false;
    window.addEventListener('scroll', function () {
      var now = window.scrollY > 20;
      if (now !== on) { on = now; hd.classList.toggle('scrolled', on); }
    }, { passive: true });
  }

  /* ---------- 9. Easter egg : Konami code => mode arc-en-ciel ---------- */
  function konami() {
    var seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'], pos = 0;
    document.addEventListener('keydown', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = (k === seq[pos]) ? pos + 1 : (k === seq[0] ? 1 : 0);
      if (pos === seq.length) {
        pos = 0;
        document.body.classList.add('rainbow-mode');
        var t = document.createElement('div');
        t.className = 'fx-toast'; t.textContent = '🌈 MODE SECRET DÉBLOQUÉ !';
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 3000);
        setTimeout(function () { document.body.classList.remove('rainbow-mode'); }, 12000);
      }
    });
  }

  bootScreen();
  particles();
  tilt();
  typewriter();
  counters();
  sparks();
  randomGame();
  headerScroll();
  konami();
})();