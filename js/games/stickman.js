/* GASTON BÂTON : Le Casse du Musée — aventure à choix (6 fins) en 100 % JavaScript.
 * Lancement : startStickmanGame()
 * Utilise : #game-canvas, #current-score (affiche le nombre de fins découvertes)
 * Contrôles : toucher / clic sur les choix, ou touches 1-2-3. Espace/Entrée pour continuer.
 */
function startStickmanGame() {
  if (window.__stickStop) { try { window.__stickStop(); } catch (e) {} }
  const cv = document.getElementById('game-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d'), scoreEl = document.getElementById('current-score');
  cv.style.touchAction = 'none';
  /* ----- Plein écran (bouton ⛶ dans le canvas, touche F) ----- */
  const FSK = (function () {
    const box = cv.parentElement || cv, bsaved = box.getAttribute('style');
    let pseudo = false, on = false;
    const nat = () => document.fullscreenElement || document.webkitFullscreenElement;
    const req = box.requestFullscreen || box.webkitRequestFullscreen;
    function sync() {
      const now = !!nat() || pseudo;
      if (pseudo) box.style.cssText = (bsaved || '') + ';position:fixed;inset:0;z-index:9999;width:100vw;height:100vh;max-width:none;margin:0;background:#000';
      else if (box !== cv) { if (bsaved === null) box.removeAttribute('style'); else box.setAttribute('style', bsaved); }
      if (now) {
        if (cv.dataset.os === undefined) cv.dataset.os = cv.getAttribute('style') || '';
        cv.style.cssText = cv.dataset.os + ';display:block;width:100%;height:100%;max-width:none;max-height:none;aspect-ratio:auto;border-radius:0;margin:0;touch-action:none';
      } else if (cv.dataset.os !== undefined) {
        const o = cv.dataset.os; delete cv.dataset.os;
        if (o) cv.setAttribute('style', o); else cv.removeAttribute('style');
        cv.style.touchAction = 'none'; cv.width = 600; cv.height = 400;
      }
      on = now;
    }
    function toggle() {
      if (nat()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
      else if (pseudo) { pseudo = false; sync(); }
      else if (req) { try { const r = req.call(box); if (r && r.catch) r.catch(() => { pseudo = true; sync(); }); } catch (e) { pseudo = true; sync(); } }
      else { pseudo = true; sync(); }
    }
    function fit() {
      if (!on) return;
      const d = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
      if (w > 0 && h > 0 && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
    }
    const rect = () => { const k = Math.max(1, Math.min(cv.width, cv.height) / 400); return { x: cv.width - 42 * k, y: 8 * k, s: 32 * k, k }; };
    function draw(c) {
      const r = rect(), cx = r.x + r.s / 2, cy = r.y + r.s / 2, a = 8 * r.k, b = 3 * r.k;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = .8; c.fillStyle = 'rgba(0,0,0,.45)';
      c.beginPath(); c.arc(cx, cy, r.s / 2, 0, 6.283); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2 * r.k; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(cx + sx * a, cy + sy * b); c.lineTo(cx + sx * a, cy + sy * a); c.lineTo(cx + sx * b, cy + sy * a); c.stroke(); }
      c.restore();
    }
    function hit(e) {
      const rc = cv.getBoundingClientRect(), px = (e.clientX - rc.left) * cv.width / rc.width, py = (e.clientY - rc.top) * cv.height / rc.height, r = rect();
      return px >= r.x - 6 && px <= r.x + r.s + 6 && py >= r.y - 6 && py <= r.y + r.s + 6;
    }
    function off() {
      document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync);
      if (pseudo) { pseudo = false; sync(); }
    }
    document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return { toggle, fit, draw, hit, off };
  })();
  const isTyping = e => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  const snd = (f, d, t) => { try { if (typeof playSound === 'function') playSound(f, d, t); } catch (e) {} };
  const restartClick = () => { const b = document.getElementById('btn-restart'); if (b) b.click(); };

  const LW = 800, LH = 450, G = 330, K = '#16161d', RD = Math.PI / 180;
  const FONT = '"Comic Sans MS","Chalkboard SE","Trebuchet MS",sans-serif', IMP = 'Impact,"Arial Black",sans-serif';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u, rnd = (a, b) => a + Math.random() * (b - a);
  let W, H, S, OX, OY, raf = 0, alive = true, lastT = performance.now(), pt = 0, T = 0, st = 'title', N = null, ct = 0,
    fired = [], alN = -1, ft = 0, newEnd = false, hov = -1, P = {}, ends = [];
  try { ends = JSON.parse(localStorage.getItem('stick_ends') || '[]'); } catch (e) {}
  if (scoreEl) scoreEl.textContent = ends.length;

  const beep = (f, d = .12, ty = 'square') => snd(f, d, ty);

  /* ---------- Poses (angles en degrés, 0 = vers le bas, + = vers l'avant) ---------- */
  const D = { lean: 0, nod: 0, a1: 8, a2: 6, b1: -8, b2: -6, l1: 4, l2: 0, m1: -4, m2: 0, bob: 0, rot: 0, sy: 1, mo: 's', ey: 'n' };
  const PO = {
    idle: t => ({ bob: Math.sin(t * 3), a1: 8 + Math.sin(t * 3) * 3, b1: -8 - Math.sin(t * 3) * 3 }),
    walk: t => { const p = t * 8, w = Math.sin(p), c = Math.cos(p); return { bob: -Math.abs(w) * 2.5, lean: 5, l1: 35 * w, l2: -45 * Math.max(0, c), m1: -35 * w, m2: -45 * Math.max(0, -c), a1: -32 * w, a2: 14, b1: 32 * w, b2: 14 }; },
    run: t => { const p = t * 14, w = Math.sin(p), c = Math.cos(p); return { bob: -Math.abs(w) * 4, lean: 18, l1: 55 * w, l2: -70 * Math.max(0, c), m1: -55 * w, m2: -70 * Math.max(0, -c), a1: -55 * w, a2: 75, b1: 55 * w, b2: 75, mo: 'o' }; },
    sneak: t => { const w = Math.sin(t * 5); return { bob: 7, lean: 22, nod: -10, l1: 24 + 20 * w, l2: -42, m1: 24 - 20 * w, m2: -42, a1: 20, a2: 60, b1: 20, b2: 60 }; },
    jump: () => ({ a1: 150, b1: 140, l1: 38, l2: -50, m1: -6, m2: -62, mo: 'o', sy: 1.08, bob: -4 }),
    fall: t => { const s = Math.sin(t * 20); return { a1: 150 + s * 30, b1: 140 - s * 30, l1: 40 * Math.sin(t * 18), l2: -40, m1: -40 * Math.sin(t * 18), m2: -40, rot: Math.sin(t * 8) * 40, mo: 'o', ey: 'o' }; },
    hands: t => ({ a1: 170, a2: -8, b1: 165, b2: 8, mo: 'o', ey: 'o', bob: Math.sin(t * 30) }),
    shrug: t => ({ a1: -40, a2: -110, b1: 40, b2: 110, nod: Math.sin(t * 3) * 6, mo: 'm' }),
    dance: t => { const s = Math.sin(t * 10); return { bob: -Math.abs(s) * 5, rot: Math.sin(t * 5) * 8, a1: 100 + s * 60, a2: 30, b1: 100 - s * 60, b2: 30, l1: 25 * s, m1: -25 * s, l2: -20, m2: -20 }; },
    laugh: t => ({ bob: Math.sin(t * 25) * 2, lean: -12, nod: -15, a1: 30, a2: 70, b1: 30, b2: 70, mo: 'o', ey: '^' }),
    knock: () => ({ rot: -90, bob: 30, ey: 'x', mo: 'o', a1: 20, b1: -20, l1: 10, m1: -10 }),
    sleep: () => ({ rot: -90, bob: 28, ey: '-', a1: 20, b1: -20 }),
    point: () => ({ b1: 92, b2: 0, a1: 10, lean: 3 }),
    cuff: () => ({ a1: 45, a2: 60, b1: 45, b2: 60, mo: 'f', nod: 8 }),
    wave: t => ({ b1: 165, b2: Math.sin(t * 10) * 35 }),
    hang: t => ({ a1: 172, b1: 166, l1: 8 + Math.sin(t * 3) * 4, m1: -8, mo: 'o' })
  };
  const gp = (n, t) => Object.assign({}, D, (PO[n] || PO.idle)(t));
  function mix(a, b, u) { const o = {}; u = u * u * (3 - 2 * u); for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], u) : (u < .5 ? a[k] : b[k]); return o; }
  const DEF = {
    hero: { c: '#e63946', h: 'beanie', hc: '#ff9f1c', sf: '#ffd166' },
    guard: { c: '#2b59c3', h: 'cap', hc: '#1c3d8f' },
    boss: { c: '#8e44ad', h: 'hair', hc: '#3b2314' }
  };

  /* ---------- Dessin du personnage ---------- */
  function fig(s) {
    const po = s.po, A = s.st, sc = (A.s || 1) * 1.1;
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 24 * sc, 5 * sc, 0, 0, 6.283); ctx.fill();
    if (s.pn === 'run' || s.pn === 'fall') {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const ox = -s.f * (34 + ((T * 90 + i * 25) % 40)); ctx.beginPath(); ctx.moveTo(ox, -30 - i * 22); ctx.lineTo(ox - s.f * 26, -30 - i * 22); ctx.stroke(); }
    }
    ctx.scale(sc * s.f, sc * po.sy); ctx.translate(0, -40 + po.bob); ctx.rotate(po.rot * RD);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const P2 = (x, y, a, l) => [x + Math.sin(a * RD) * l, y + Math.cos(a * RD) * l];
    const limb = (x, y, a1, a2, l1, l2, w, foot) => {
      const m = P2(x, y, a1, l1), e = P2(m[0], m[1], a1 + a2, l2);
      ctx.strokeStyle = K; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(m[0], m[1]); ctx.lineTo(e[0], e[1]);
      if (foot) ctx.lineTo(e[0] + 7, e[1]); ctx.stroke();
    };
    const tx = Math.sin(po.lean * RD) * 34, ty = -Math.cos(po.lean * RD) * 34, sx = tx * .85, sy = ty * .85;
    limb(sx, sy, po.a1, po.a2, 16, 15, 5); limb(0, 0, po.l1, po.l2, 20, 19, 6, 1);
    ctx.strokeStyle = A.c; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, ty); ctx.stroke();
    if (A.sf) {
      ctx.strokeStyle = A.sf; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(tx, ty + 2);
      ctx.lineTo(tx - 10, ty + 6 + Math.sin(T * 8) * 3); ctx.lineTo(tx - 20, ty + 3 + Math.sin(T * 8 + 1) * 4); ctx.stroke();
    }
    const hx = tx + Math.sin((po.lean + po.nod) * RD) * 14, hy = ty - Math.cos((po.lean + po.nod) * RD) * 14;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(hx, hy, 12, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = A.hc || K; ctx.lineWidth = 2.5;
    if (A.h === 'beanie' || A.h === 'cap' || A.h === 'hair') {
      ctx.beginPath(); ctx.arc(hx, hy - 1, 12.5, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (A.h === 'beanie') { ctx.beginPath(); ctx.arc(hx, hy - 14, 4, 0, 6.283); ctx.fill(); ctx.stroke(); }
      if (A.h === 'cap') ctx.fillRect(hx + 4, hy - 3, 13, 3.5);
      if (A.h === 'hair') { ctx.beginPath(); ctx.arc(hx - 9, hy - 9, 5, 0, 6.283); ctx.fill(); ctx.stroke(); }
    } else if (A.h === 'crown') {
      ctx.beginPath(); [[-9, -10], [-9, -21], [-4, -15], [0, -23], [4, -15], [9, -21], [9, -10]].forEach((q, i) => i ? ctx.lineTo(hx + q[0], hy + q[1]) : ctx.moveTo(hx + q[0], hy + q[1]));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = K; ctx.strokeStyle = K; ctx.lineWidth = 2;
    const e1 = [hx + 3, hy - 2], e2 = [hx + 9, hy - 2], ey = po.ey, blink = ey === 'n' && (T % 3.4) < .1;
    for (const q of [e1, e2]) {
      ctx.beginPath();
      if (ey === 'o') { ctx.lineWidth = 1.5; ctx.arc(q[0], q[1], 3.3, 0, 6.283); ctx.stroke(); ctx.beginPath(); ctx.arc(q[0] + 1, q[1], 1.2, 0, 6.283); ctx.fill(); }
      else if (ey === '^') ctx.arc(q[0], q[1] + 2, 2.6, Math.PI, 0);
      else if (ey === 'x') { ctx.moveTo(q[0] - 2, q[1] - 2); ctx.lineTo(q[0] + 2, q[1] + 2); ctx.moveTo(q[0] + 2, q[1] - 2); ctx.lineTo(q[0] - 2, q[1] + 2); }
      else if (ey === '-' || blink) { ctx.moveTo(q[0] - 2.5, q[1]); ctx.lineTo(q[0] + 2.5, q[1]); }
      else ctx.arc(q[0], q[1], 2.1, 0, 6.283);
      if (ey === 'n' && !blink) ctx.fill(); else if (ey !== 'o') ctx.stroke();
    }
    ctx.lineWidth = 2; ctx.beginPath();
    const mx = hx + 6, my = hy + 5.5;
    if (po.mo === 'o') { ctx.arc(mx, my, 2.8, 0, 6.283); ctx.fill(); }
    else if (po.mo === 'f') { ctx.arc(mx, my + 3, 3.5, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
    else if (po.mo === 'm') { ctx.moveTo(mx - 3, my); ctx.lineTo(mx + 3, my); ctx.stroke(); }
    else { ctx.arc(mx, my - 1.5, 3.5, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
    limb(0, 0, po.m1, po.m2, 20, 19, 6, 1); limb(sx, sy, po.b1, po.b2, 16, 15, 5);
    ctx.restore();
  }
  function rat(s) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.f, 1);
    const b = s.pn === 'run' ? Math.sin(T * 20) * 2 : 0;
    ctx.fillStyle = '#7d7d86'; ctx.strokeStyle = K; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -9 + b, 15, 8, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(15, -10 + b, 8, 5, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, -17 + b, 4, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = K; ctx.beginPath(); ctx.arc(19, -12 + b, 1.6, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#e8a0a0'; ctx.beginPath(); ctx.moveTo(-15, -8 + b); ctx.quadraticCurveTo(-30, -2, -36, -12 + Math.sin(T * 8) * 4); ctx.stroke();
    ctx.restore();
  }

  /* ---------- Décors ---------- */
  function gem(x, y, s, col) {
    ctx.fillStyle = col || '#6fe3ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - s, y - s * .4); ctx.lineTo(x - s * .5, y - s); ctx.lineTo(x + s * .5, y - s); ctx.lineTo(x + s, y - s * .4); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s, y - s * .4); ctx.lineTo(x + s, y - s * .4); ctx.moveTo(x - s * .5, y - s); ctx.lineTo(x, y + s); ctx.lineTo(x + s * .5, y - s); ctx.stroke();
  }
  function bg(k, tt) {
    const C = { street: ['#0a0e2e', '#38449a', '#2a2a3c'], roof: ['#0a0e2e', '#38449a', '#3a3a52'], sewer: ['#16251f', '#25423a', '#3b4a44'], hall: ['#efe3c8', '#e0d0ac', '#8d6e4f'], vault: ['#150d26', '#2a1a4a', '#2d2245'], city: ['#ff9e5e', '#7b3fa0', '#3b2d4f'] }[k];
    const g = ctx.createLinearGradient(0, 0, 0, G); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, LW, G); ctx.fillStyle = C[2]; ctx.fillRect(0, G, LW, LH - G);
    if (k === 'street' || k === 'roof') {
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${.5 + .5 * Math.sin(T * 2 + i)})`; ctx.fillRect((i * 137) % 800, (i * 59) % 200, 2, 2); }
      ctx.fillStyle = '#fff6d5'; ctx.beginPath(); ctx.arc(90, 70, 28, 0, 6.283); ctx.fill();
    }
    if (k === 'street') {
      ctx.fillStyle = '#e0d8c5'; ctx.beginPath(); ctx.moveTo(430, 120); ctx.lineTo(625, 60); ctx.lineTo(820, 120); ctx.fill();
      ctx.fillStyle = '#cfc7b4'; ctx.fillRect(450, 120, 350, G - 120);
      ctx.fillStyle = '#efe9db'; for (let i = 0; i < 5; i++) ctx.fillRect(470 + i * 65, 130, 22, G - 135);
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(600, G - 95, 50, 95); ctx.fillStyle = '#ffd166'; ctx.fillRect(640, G - 50, 4, 4);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(130, 150); ctx.lineTo(130, G); ctx.stroke();
      const lg = ctx.createRadialGradient(130, 145, 2, 130, 145, 70); lg.addColorStop(0, 'rgba(255,230,150,.7)'); lg.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = lg; ctx.fillRect(40, 70, 180, 160);
    }
    if (k === 'roof') {
      ctx.fillStyle = '#7a4b3a'; ctx.fillRect(120, G - 90, 40, 90);
      ctx.fillStyle = 'rgba(140,200,255,.65)'; ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(470, G); ctx.lineTo(490, G - 40); ctx.lineTo(560, G - 40); ctx.lineTo(580, G); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (k === 'sewer') {
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
      for (let y = 0; y < G; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LW, y); ctx.stroke(); for (let x = (y / 30 % 2) * 30; x < LW; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 30); ctx.stroke(); } }
      ctx.fillStyle = '#6b7a77'; ctx.fillRect(0, 70, LW, 26); ctx.fillStyle = '#7a8a86'; ctx.fillRect(600, 70, 34, G - 70);
      ctx.fillStyle = '#5a6866'; for (let y = 120; y < G; y += 50) ctx.fillRect(596, y, 42, 8);
      ctx.fillStyle = '#2f6b5a'; ctx.fillRect(0, G + 14, LW, LH);
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * 110 + Math.sin(T + i) * 10, G + 26); ctx.lineTo(i * 110 + 40 + Math.sin(T + i) * 10, G + 26); ctx.stroke(); }
    }
    if (k === 'hall') {
      ctx.fillStyle = '#b08968'; ctx.fillRect(0, G - 70, LW, 70);
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; for (let x = 0; x < LW; x += 80) { ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x - 30, LH); ctx.stroke(); }
      for (let i = 0; i < 3; i++) {
        const x = 140 + i * 220; ctx.fillStyle = '#7a5a2a'; ctx.fillRect(x - 6, 54, 132, 102);
        ctx.fillStyle = ['#8fd3ff', '#f4d6a0', '#c9b6e4'][i]; ctx.fillRect(x, 60, 120, 90);
        ctx.fillStyle = ['#6bbf59', '#a0522d', '#e76f51'][i];
        ctx.beginPath(); if (i === 0) ctx.arc(x + 40, 150, 50, Math.PI, 0); else if (i === 1) ctx.ellipse(x + 60, 110, 24, 32, 0, 0, 6.283); else { ctx.moveTo(x + 20, 140); ctx.lineTo(x + 60, 75); ctx.lineTo(x + 100, 140); }
        ctx.fill();
      }
      if (N && N.L && !(N.loff && tt > N.loff)) {
        for (let i = 0; i < 5; i++) {
          const y = G - 20 - i * 34 + Math.sin(T * 3 + i) * 4;
          ctx.strokeStyle = `rgba(255,40,60,${.6 + .4 * Math.sin(T * 20 + i)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(250, y); ctx.lineTo(520, y); ctx.stroke();
          ctx.fillStyle = '#444'; ctx.fillRect(244, y - 5, 8, 10); ctx.fillRect(518, y - 5, 8, 10);
        }
      }
      if (N && N.box) { ctx.fillStyle = '#6c757d'; ctx.fillRect(735, G - 130, 40, 60); ctx.fillStyle = '#ffd166'; ctx.fillRect(751, G - 118, 8, 22); }
    }
    if (k === 'vault') {
      ctx.fillStyle = 'rgba(255,255,220,.12)'; ctx.beginPath(); ctx.moveTo(600, 0); ctx.lineTo(530, G); ctx.lineTo(670, G); ctx.fill();
      ctx.fillStyle = '#d9d2e9'; ctx.fillRect(570, G - 110, 60, 110); ctx.fillRect(560, G - 118, 80, 10);
      const nd = N && N.nd, hide = nd && tt > nd[0] && tt < nd[1];
      if (!hide) { gem(600, G - 140, 22, nd && tt >= nd[1] && nd[1] < 100 ? '#9ec5ff' : '#6fe3ff'); const a = Math.sin(T * 4); ctx.fillStyle = '#fff'; ctx.fillRect(580 + a * 8, G - 160, 3, 3); ctx.fillRect(622 - a * 8, G - 130, 3, 3); }
    }
    if (k === 'city') {
      for (let l = 0; l < 2; l++) {
        ctx.fillStyle = l ? '#4a2f6b' : '#5d3a82';
        for (let i = 0; i < 14; i++) { const w = 60 + (i * 37) % 50, h = (l ? 70 : 110) + (i * 53) % 120, x = (((i * 110 - T * (l ? 160 : 60)) % 1540) + 1540) % 1540 - 140; ctx.fillRect(x, G - h, w, h); }
      }
      ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(600, 170, 46, 0, 6.283); ctx.fill();
      ctx.fillStyle = C[2]; ctx.fillRect(0, G, LW, 20);
      for (const gp2 of (N.gaps || [])) { const gx = 250 + (gp2[0] - tt) * 220; ctx.fillStyle = '#120a1f'; ctx.fillRect(gx - gp2[1] / 2, G, gp2[1], LH - G); }
    }
  }

  /* ---------- Effets, bulles ---------- */
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function bubble(x, y, txt) {
    const L = txt.split('|'); ctx.font = `bold 15px ${FONT}`;
    let w = 0; for (const l of L) w = Math.max(w, ctx.measureText(l).width); w += 22;
    const h = L.length * 19 + 12, bx = clamp(x - w / 2, 6, LW - w - 6); let by = y - h - 14; if (by < 6) by = 6;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = K; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 8, by + h - 2); ctx.lineTo(x, by + h + 13); ctx.lineTo(x + 7, by + h - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    rr(bx, by, w, h, 10); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 6, by + h - 3, 12, 5);
    ctx.fillStyle = K; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    L.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 20 + i * 19)); ctx.textAlign = 'left';
  }
  function pop(x, y, tx, a) {
    const sc = Math.min(1, a / .12) * (1 + .06 * Math.sin(a * 28)), al = a > .8 ? clamp((1.1 - a) / .3, 0, 1) : 1;
    ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(-.12); ctx.scale(sc, sc);
    ctx.font = `900 28px ${IMP}`; const w = ctx.measureText(tx).width / 2 + 26;
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#e63946'; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i < 20; i++) { const r = i % 2 ? .72 : 1, an = i / 20 * 6.283; ctx.lineTo(Math.cos(an) * w * r, Math.sin(an) * 40 * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = K; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tx, 0, 2); ctx.restore();
  }
  function starsFx(x, y) {
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#e09f00'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = T * 5 + i * 2.09, px = x + Math.cos(a) * 26, py = y - 70 + Math.sin(a) * 7; ctx.beginPath();
      for (let j = 0; j < 10; j++) { const r = j % 2 ? 3 : 7, b = j / 10 * 6.283 - 1.57; ctx.lineTo(px + Math.cos(b) * r, py + Math.sin(b) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  function zzz(x, y, a) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.font = `900 26px ${IMP}`;
    for (let i = 0; i < 3; i++) { const q = a - i * .5; if (q < 0) continue; ctx.globalAlpha = clamp(1 - q / 1.8, 0, 1); ctx.strokeText('Z', x + i * 14 + Math.sin(q * 4) * 4, y - q * 36); ctx.fillText('Z', x + i * 14 + Math.sin(q * 4) * 4, y - q * 36); }
    ctx.globalAlpha = 1;
  }

  /* ---------- Histoire ---------- */
  const ENDS = {
    disguise: { t: 'Le Parfait Cambrioleur', d: 'Gaston est sorti par la grande porte, salué par la police elle-même. Mission accomplie, avec style.' },
    skate: { t: 'Vol en Montgolfière', d: 'Gaston s’envole au coucher du soleil, diamant en poche. La police regarde les nuages.' },
    fish: { t: 'Conservateur Honoraire', d: 'Mme Dupont l’a engagé comme gardien de nuit. Le seul voleur qui protège ce qu’il voulait voler.' },
    jail: { t: 'Prison Quatre Étoiles', d: 'Gaston a été arrêté, mais la prison a une piscine et un buffet à volonté. Il hésite à s’évader.' },
    nap: { t: 'La Sieste Royale', d: 'Gaston a dormi jusqu’au matin. Il a fini par payer son billet d’entrée, comme tout le monde.' },
    rat: { t: 'Roi des Égouts', d: 'Gaston règne sur 4 000 rats. Moins brillant qu’un diamant, mais beaucoup plus fidèles.' }
  };
  const EK = Object.keys(ENDS);
  const NODES = {
    intro: { bg: 'street', d: 6.5, n: 'Cette nuit, Gaston Bâton, cambrioleur pas très doué, va voler l’Étoile de Marseille.',
      A: { hero: { k: [[0, -40, G, 'walk'], [2.8, 330, G, 'sneak'], [3.2, 330, G, 'point']] } },
      say: [[3.4, 'hero', 'Le Musée Dupont…|Du gâteau !', 2.6]],
      ch: { q: 'Comment entrer dans le musée ?', o: [['Par la porte principale', 'door'], ['Grimper sur le toit', 'roof'], ['Passer par les égouts', 'sewer']] } },
    door: { bg: 'street', d: 8.5, n: '',
      A: { hero: { k: [[0, 330, G, 'point'], [2.2, 590, G, 'walk'], [2.6, 590, G, 'shrug'], [5, 590, G, 'hands'], [5.4, 590, G, 'run'], [7.4, -60, G, 'run']] },
        guard: { k: [[3.2, 640, G, 'idle'], [5, 640, G, 'point'], [5.4, 640, G, 'run'], [8, -80, G, 'run']] } },
      say: [[2.7, 'hero', 'Livraison de pizzas !', 1.6], [4, 'guard', 'À 3 h du matin ?|Vraiment ?', 1.8]],
      fx: [[3.2, 'pop', 640, 150, '?!'], [5, 'pop', 600, 120, 'PIIIIT !'], [5, 'shake']],
      fail: 'Livrer des pizzas à 3 h du matin… Gérard n’est pas né de la dernière pluie.', back: 'intro' },
    roof: { bg: 'roof', d: 5.5, n: 'Sur le toit, une lucarne mal fermée…',
      A: { hero: { k: [[0, -40, G, 'walk'], [2, 440, G, 'sneak'], [2.4, 440, G, 'point']] } },
      say: [[2.6, 'hero', 'Une lucarne !|Et maintenant ?', 2.6]],
      ch: { q: 'Que fait Gaston ?', o: [['Casser la vitre', 'glass'], ['L’ouvrir doucement', 'hall']] } },
    glass: { bg: 'roof', d: 5.5, n: '',
      A: { hero: { k: [[0, 440, G, 'point'], [.8, 440, G, 'sneak'], [1.4, 500, G, 'jump', 40], [2, 520, G, 'fall'], [3, 540, G + 170, 'fall']] } },
      fx: [[1.5, 'pop', 540, 230, 'CRAC !'], [1.6, 'shake'], [1.8, 'alarm']],
      fail: 'Briser une vitre blindée avec le coude, c’était audacieux. Et très bruyant.', back: 'roof' },
    sewer: { bg: 'sewer', d: 6.5, n: 'Dans les égouts, ça sent… l’aventure.',
      A: { hero: { k: [[0, -40, G, 'walk'], [2, 260, G, 'walk'], [2.4, 260, G, 'shrug']] }, rat: { k: [[2.2, 840, G, 'run'], [3.4, 520, G, 'idle']] } },
      say: [[3.5, 'hero', 'Beurk. Un rat.|Il me regarde…', 2.4]],
      ch: { q: 'Que fait Gaston ?', o: [['Escalader le gros tuyau', 'hall'], ['Suivre le rat', 'rat'], ['Faire une petite sieste', 'nap']] } },
    rat: { bg: 'sewer', d: 8, n: '',
      A: { hero: { sty: [[3.4, { h: 'crown', hc: '#ffd23f' }]], k: [[0, 260, G, 'walk'], [2, 480, G, 'walk'], [3, 480, G, 'shrug'], [4.5, 480, G, 'dance']] },
        rat: { k: [[0, 420, G, 'run'], [2, 600, G, 'run']] }, rat2: { k: [[2.6, 840, G, 'run'], [3.6, 560, G, 'idle']] },
        rat3: { k: [[2.9, -40, G, 'run'], [3.8, 380, G, 'idle']] }, rat4: { k: [[3.2, 840, G, 'run'], [4.2, 650, G, 'idle']] } },
      say: [[2.2, 'hero', 'Où est-ce qu’il|m’emmène ?', 1.6]],
      fx: [[3.4, 'flash'], [3.5, 'pop', 480, 120, 'VIVE LE ROI !']], end: 'rat' },
    nap: { bg: 'sewer', d: 7, n: '',
      A: { hero: { k: [[0, 260, G, 'shrug'], [1, 260, G, 'sneak'], [2, 260, G + 4, 'sleep']] } },
      say: [[.2, 'hero', 'Juste cinq minutes…', 1.6]],
      fx: [[2.4, 'zzz', 270, 270], [4, 'zzz', 270, 270], [5.2, 'flash'], [5.3, 'pop', 400, 140, 'Le matin !']], end: 'nap' },
    hall: { bg: 'hall', L: 1, d: 6, n: 'Dans la grande salle, des lasers gardent le couloir…',
      A: { hero: { k: [[0, 150, -30, 'hang'], [1.2, 150, G, 'idle'], [2, 150, G, 'shrug']] } },
      X: (c, t, p) => { if (t < 1.3) { c.strokeStyle = '#8a6a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.hero.x, 0); c.lineTo(p.hero.x, p.hero.y - 75); c.stroke(); } },
      say: [[2.2, 'hero', 'Des lasers…|Évidemment.', 2.2]],
      ch: { q: 'Comment passer les lasers ?', o: [['Danser entre les rayons', 'dance'], ['Ramper sous les rayons', 'roll'], ['Couper le courant', 'breaker']] } },
    dance: { bg: 'hall', L: 1, d: 6.5, n: '',
      A: { hero: { k: [[0, 150, G, 'dance'], [1, 230, G, 'dance'], [5.2, 570, G, 'dance'], [5.8, 610, G, 'idle']] } },
      say: [[1.2, 'hero', 'Ça se danse très bien,|un laser.', 2.2]], fx: [[3.6, 'pop', 400, 140, 'OLÉ !']], go: 'vault' },
    roll: { bg: 'hall', L: 1, d: 5.5, n: '',
      A: { hero: { k: [[0, 150, G, 'idle'], [.6, 150, G, 'sneak'], [2.4, 300, G, 'sneak'], [2.6, 300, G, 'knock'], [5, 300, G, 'knock']] } },
      fx: [[2.6, 'pop', 300, 210, 'BZZZT !'], [2.6, 'shake'], [2.7, 'stars', 300, G - 40]],
      fail: 'Le laser du bas était posé au ras du sol. Évidemment.', back: 'hall' },
    breaker: { bg: 'hall', L: 1, loff: 3, box: 1, d: 9, n: '',
      A: { hero: { k: [[0, 150, G, 'walk'], [2.6, 720, G, 'walk'], [3, 720, G, 'point'], [3.6, 720, G, 'hands'], [6.4, 720, G, 'cuff']] },
        guard: { k: [[4, -40, G, 'walk'], [5.6, 480, G, 'point']] } },
      X: (c, t, p) => {
        if (t < 3) return;
        const g = p.guard, cx = g ? g.x + 55 : -999, cy = g ? g.y - 60 : 200;
        const gr = c.createRadialGradient(cx, cy, 20, cx, cy, g ? 280 : 25);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,.9)');
        c.fillStyle = gr; c.fillRect(0, 0, LW, LH);
      },
      say: [[.4, 'hero', 'Disjoncteur, à nous deux !', 2], [5.7, 'guard', 'Bonsoir Gaston.|Thé ou café ?', 2.6]],
      fx: [[3, 'pop', 600, 150, 'CLAC !'], [6.4, 'flash']], end: 'jail' },
    vault: { bg: 'vault', d: 6, n: 'Voilà l’Étoile de Marseille, la plus grosse pierre de la ville.',
      A: { hero: { k: [[0, -40, G, 'walk'], [2.2, 440, G, 'sneak'], [2.8, 440, G, 'point']] } },
      say: [[3, 'hero', 'Elle est encore plus|belle en vrai…', 2.4]],
      ch: { q: 'Comment prendre le diamant ?', o: [['Attraper le diamant', 'grab'], ['Échanger avec un faux', 'swap'], ['Le pêcher à la canne', 'fish']] } },
    grab: { bg: 'vault', nd: [1.9, 1e9], d: 6, n: '',
      A: { hero: { k: [[0, 440, G, 'point'], [1.4, 560, G, 'sneak'], [1.9, 560, G, 'point'], [2.4, 560, G, 'hands']] } },
      X: (c, t) => { if (t > 2.1) { const y = Math.min(G, -120 + (t - 2.1) * 900); c.strokeStyle = '#bbb'; c.lineWidth = 4; for (let i = 0; i <= 6; i++) { const x = 508 + i * 20; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y); c.stroke(); } c.beginPath(); c.moveTo(508, y); c.lineTo(628, y); c.stroke(); } },
      fx: [[2.5, 'pop', 568, 150, 'CLANG !'], [2.5, 'shake'], [2.7, 'alarm']],
      fail: 'Un piège à cage ! Personne ne laisse un diamant sans protection.', back: 'vault' },
    swap: { bg: 'vault', nd: [1.8, 2.8], d: 6, n: '',
      A: { hero: { k: [[0, 440, G, 'sneak'], [1.4, 560, G, 'sneak'], [1.8, 560, G, 'point'], [2.8, 560, G, 'point'], [3.2, 560, G, 'laugh'], [4.6, 560, G, 'laugh']] } },
      say: [[.2, 'hero', 'Un faux, acheté|chez le brocanteur !', 2], [3.3, 'hero', 'Hi hi hi !', 1.4]],
      fx: [[2.8, 'flash'], [2.8, 'pop', 600, 140, 'CLING !']], go: 'escape' },
    fish: { bg: 'vault', nd: [1.6, 1e9], d: 9, n: '',
      A: { hero: { k: [[0, 100, G, 'walk'], [1, 360, G, 'sneak'], [1.4, 360, G, 'point'], [3.2, 360, G, 'laugh'], [7, 360, G, 'laugh']] },
        boss: { k: [[4, 840, G, 'walk'], [5.4, 520, G, 'walk'], [5.6, 520, G, 'point'], [9, 520, G, 'point']] } },
      X: (c, t, p) => {
        const hx = p.hero.x + 34, hy = p.hero.y - 70, tipx = hx + 60, tipy = hy - 40;
        c.strokeStyle = '#7a5a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(hx - 6, hy + 6); c.lineTo(tipx, tipy); c.stroke();
        const u = clamp((t - 1.6) / 1.6, 0, 1), gx = lerp(600, hx + 10, u), gy = lerp(G - 140, hy - 4, u);
        if (t >= 1.4) { c.strokeStyle = '#eee'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tipx, tipy); c.lineTo(gx, gy - 14); c.stroke(); }
        if (t >= 1.6) gem(gx, gy, 12);
      },
      say: [[3.4, 'hero', 'Pêcheur de diamants,|c’est mon métier !', 2.2], [5.8, 'boss', 'Quelle dextérité !|Je vous engage !', 2.8]],
      fx: [[3.2, 'flash'], [3.2, 'pop', 420, 120, 'HOP !']], end: 'fish' },
    escape: { bg: 'street', d: 6.5, n: 'Diamant en poche, Gaston sort du musée. Des sirènes approchent !',
      A: { hero: { k: [[0, 625, G, 'walk'], [1.8, 400, G, 'walk'], [2.2, 400, G, 'hands']] } },
      fx: [[1.2, 'alarm']], say: [[2.4, 'hero', 'Les sirènes…|Vite, une idée !', 2.4]],
      ch: { q: 'Comment s’échapper ?', o: [['Se déguiser en garde', 'disguise'], ['Fuir en skateboard', 'skate'], ['Appeler un taxi', 'taxi']] } },
    disguise: { bg: 'street', d: 9.5, n: '',
      A: { hero: { sty: [[1.2, { c: '#2b59c3', h: 'cap', hc: '#1c3d8f', sf: null }]],
          k: [[0, 400, G, 'hands', 0, -1], [1, 400, G, 'idle', 0, -1], [3.4, 400, G, 'point', 0, 1], [4.8, 400, G, 'point', 0, 1], [5.4, 400, G, 'idle', 0, -1], [5.8, 400, G, 'walk'], [8.6, -60, G, 'walk']] },
        guard: { k: [[2, -60, G, 'run'], [3, 330, G, 'run'], [3.1, 330, G, 'point', 0, 1], [4.9, 330, G, 'idle', 0, 1], [5, 330, G, 'run'], [7, 900, G, 'run']] } },
      say: [[3.2, 'guard', 'Collègue ! Un voleur|est passé par ici ?', 1.7], [4.9 - .2, 'hero', 'Par là, vite !', 1], [6.6, 'hero', 'Bonne nuit, collègue !', 2]],
      fx: [[1.2, 'flash'], [1.3, 'pop', 400, 120, 'DÉGUISÉ !']], end: 'disguise' },
    skate: { bg: 'city', d: 9.5, n: '', gaps: [[1.95, 90], [3.95, 90], [5.7, 700]],
      A: { hero: { k: [[0, 250, G, 'sneak'], [1.5, 250, G, 'jump', 110], [2.4, 250, G, 'sneak'], [3.5, 250, G, 'jump', 110], [4.4, 250, G, 'sneak'], [5, 250, G, 'jump', 230], [6, 520, 120, 'hang'], [9.5, 660, -10, 'hang']] } },
      X: (c, t, p) => {
        const h = p.hero;
        if (t < 5.1) { c.fillStyle = '#ffb703'; c.fillRect(h.x - 24, h.y, 48, 5); c.fillStyle = K; c.beginPath(); c.arc(h.x - 14, h.y + 7, 4, 0, 6.283); c.arc(h.x + 14, h.y + 7, 4, 0, 6.283); c.fill(); }
        if (t > 5.4) {
          const bx = h.x, by = h.y - 150; c.strokeStyle = '#6b4e2e'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(bx - 40, by + 40); c.lineTo(h.x - 8, h.y - 85); c.moveTo(bx + 40, by + 40); c.lineTo(h.x + 8, h.y - 85); c.stroke();
          const cols = ['#e63946', '#ffd166', '#e63946', '#ffd166', '#e63946'];
          for (let i = 0; i < 5; i++) { c.fillStyle = cols[i]; c.beginPath(); c.ellipse(bx + (i - 2) * 16, by, 16, 55, 0, 0, 6.283); c.fill(); }
          c.strokeStyle = K; c.lineWidth = 2.5; c.beginPath(); c.ellipse(bx, by, 56, 56, 0, 0, 6.283); c.stroke();
        }
      },
      say: [[.3, 'hero', 'Les toits, c’est mon rayon !', 1.8], [6.2, 'hero', 'Au revoir, la police !', 2.4]],
      fx: [[1.2, 'alarm'], [5, 'pop', 350, 150, 'WOUHOU !']], end: 'skate' },
    taxi: { bg: 'street', d: 7.5, n: '',
      A: { hero: { k: [[0, 500, G, 'wave'], [2.8, 500, G, 'wave'], [3, 500, G, 'hands']] }, guard: { k: [[2.8, 330, G, 'idle'], [3.8, 430, G, 'point']] } },
      X: (c, t) => {
        const tx = lerp(-200, 300, 1 - Math.pow(1 - clamp(t / 1.6, 0, 1), 2));
        c.fillStyle = '#ffcc00'; rr(tx - 80, G - 42, 160, 34, 8); c.fill(); rr(tx - 45, G - 72, 90, 34, 10); c.fill();
        c.fillStyle = '#9fd3ff'; c.fillRect(tx - 36, G - 66, 32, 22); c.fillRect(tx + 2, G - 66, 32, 22);
        c.fillStyle = K; c.beginPath(); c.arc(tx - 45, G - 6, 12, 0, 6.283); c.arc(tx + 45, G - 6, 12, 0, 6.283); c.fill();
        c.fillStyle = t > 3.8 && Math.sin(t * 14) > 0 ? '#ff2a2a' : '#fff'; c.fillRect(tx - 10, G - 82, 20, 10);
      },
      say: [[1.8, 'hero', 'Taxi ! Taxi !', 1], [3.1, 'guard', 'Gérard, taxi de nuit…|et gardien de jour !', 2.8]],
      fx: [[2.8, 'pop', 340, 150, '!?'], [3.8, 'alarm']],
      fail: 'Le chauffeur de taxi, c’était Gérard, le gardien. Il cumule deux emplois.', back: 'escape' }
  };

  /* ---------- Moteur de scène ---------- */
  function getAct(id, a, tt) {
    const k = a.k; if (tt < k[0][0]) return null;
    let i = 0; while (i < k.length - 1 && tt >= k[i + 1][0]) i++;
    const A0 = k[i], B0 = k[Math.min(i + 1, k.length - 1)], u = B0[0] > A0[0] ? clamp((tt - A0[0]) / (B0[0] - A0[0]), 0, 1) : 1;
    const x = lerp(A0[1], B0[1], u), y = lerp(A0[2], B0[2], u) - (A0[4] || 0) * 4 * u * (1 - u);
    let f = A0[5];
    if (f === undefined) { f = a.f || 1; for (let j = Math.min(i, k.length - 2); j >= 0; j--) { const dx = k[j + 1][1] - k[j][1]; if (Math.abs(dx) > 1) { f = dx > 0 ? 1 : -1; break; } } }
    const off = a.o || 0, pn = A0[3];
    const po = (i > 0 && tt - A0[0] < .18) ? mix(gp(k[i - 1][3], T + off), gp(pn, T + off), (tt - A0[0]) / .18) : gp(pn, T + off);
    const type = id.replace(/\d+$/, ''), s0 = Object.assign({}, DEF[type] || {}, a);
    for (const q of (a.sty || [])) if (tt >= q[0]) Object.assign(s0, q[1]);
    return { x, y, f, po, st: s0, pn, rat: type === 'rat' };
  }
  function drawScene(tt) {
    let sx = 0, sy = 0;
    for (const e of (N.fx || [])) if (e[1] === 'shake') { const a = tt - e[0]; if (a >= 0 && a < .5) { const m = 8 * (1 - a / .5); sx += rnd(-m, m); sy += rnd(-m, m); } }
    ctx.save(); ctx.translate(sx, sy);
    bg(N.bg, tt); P = {};
    for (const id in N.A) { const s = getAct(id, N.A[id], tt); if (!s) continue; P[id] = s; if (s.rat) rat(s); else fig(s); }
    if (N.X) { ctx.save(); N.X(ctx, tt, P); ctx.restore(); }
    ctx.font = `bold 15px ${FONT}`;
    for (const q of (N.say || [])) if (tt >= q[0] && tt < q[0] + q[3] && P[q[1]]) bubble(P[q[1]].x, P[q[1]].y - 124, q[2]);
    for (const e of (N.fx || [])) {
      const a = tt - e[0]; if (a < 0) continue; const ty = e[1];
      if (ty === 'pop' && a < 1.1) pop(e[2], e[3], e[4], a);
      else if (ty === 'stars' && a < 1.6) starsFx(e[2], e[3]);
      else if (ty === 'zzz' && a < 2.4) zzz(e[2], e[3], a);
      else if (ty === 'flash' && a < .35) { ctx.fillStyle = `rgba(255,255,255,${1 - a / .35})`; ctx.fillRect(0, 0, LW, LH); }
      else if (ty === 'alarm' && a < 2) { ctx.fillStyle = `rgba(255,0,40,${Math.sin(a * 14) > 0 ? .22 : 0})`; ctx.fillRect(0, 0, LW, G); }
    }
    ctx.restore();
  }
  function bar() { ctx.fillStyle = K; ctx.fillRect(0, 372, LW, 78); ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 372, LW, 4); }
  function wrap(t, maxW) {
    const w = t.split(' '), L = []; let l = '';
    for (const x of w) { if (ctx.measureText(l + x).width > maxW && l) { L.push(l.trim()); l = ''; } l += x + ' '; }
    L.push(l.trim()); return L;
  }
  function btns() {
    if (st === 'choice') { const o = N.ch.o, n = o.length, w = (LW - 24 - (n - 1) * 10) / n; return o.map((a, i) => ({ x: 12 + i * (w + 10), y: 404, w, h: 36, l: a[0], g: a[1] })); }
    if (st === 'end') return [{ x: 200, y: 404, w: 190, h: 36, l: 'Recommencer', g: 'intro' }, { x: 410, y: 404, w: 190, h: 36, l: 'Menu', g: 'title' }];
    return [];
  }
  function drawBtns() {
    ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    btns().forEach((b, i) => {
      ctx.fillStyle = hov === i ? '#ffd23f' : '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; rr(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = K; ctx.fillText((st === 'choice' ? (i + 1) + '. ' : '') + b.l, b.x + b.w / 2, b.y + b.h / 2 + 1);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  function title() {
    N = { bg: 'street', A: {} }; bg('street', 0);
    const s = { x: 220, y: G, f: 1, po: gp('dance', T), st: DEF.hero, pn: 'dance' }; fig(s);
    ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `900 64px ${IMP}`; ctx.strokeStyle = K; ctx.lineWidth = 9; ctx.strokeText('GASTON BÂTON', 400, 120); ctx.fillStyle = '#ffd23f'; ctx.fillText('GASTON BÂTON', 400, 120);
    ctx.font = `900 28px ${IMP}`; ctx.lineWidth = 6; ctx.strokeText('Le Casse du Musée', 400, 160); ctx.fillStyle = '#fff'; ctx.fillText('Le Casse du Musée', 400, 160);
    bar(); ctx.fillStyle = '#fff'; ctx.font = `bold ${18 + Math.sin(T * 5)}px ${FONT}`;
    ctx.fillText('Touche l’écran pour jouer', 400, 402);
    for (let i = 0; i < EK.length; i++) { ctx.fillStyle = ends.includes(EK[i]) ? '#ffd23f' : '#444'; ctx.beginPath(); ctx.arc(340 + i * 24, 428, 8, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.translate(OX, OY); ctx.scale(S, S); ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();
    if (st === 'title') { title(); return; }
    drawScene(st === 'play' ? ct : N.d); bar();
    ctx.textBaseline = 'alphabetic';
    if (st === 'play') {
      if (N.n) { ctx.font = `bold 17px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; const L = wrap(N.n.slice(0, Math.floor(ct * 45)), 740); L.forEach((l, i) => ctx.fillText(l, 400, 400 + i * 22)); ctx.textAlign = 'left'; }
      ctx.font = `bold 13px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.textAlign = 'left'; ctx.fillText('Passer ▶▶', 14, 24);
    } else if (st === 'choice') {
      ctx.font = `bold 16px ${FONT}`; ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center'; ctx.fillText(N.ch.q, 400, 394); ctx.textAlign = 'left'; drawBtns();
    } else if (st === 'fail') {
      ctx.fillStyle = 'rgba(120,0,10,.35)'; ctx.fillRect(0, 0, LW, G);
      ctx.save(); ctx.translate(400, 140 + Math.max(0, 1 - ft * 5) * -60); ctx.rotate(-.07); const sc = Math.min(1, ft * 6) * (1 + .03 * Math.sin(ft * 10));
      ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.font = `900 96px ${IMP}`; ctx.strokeStyle = K; ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeText('RATÉ !', 0, 0); ctx.fillStyle = '#ff3b3b'; ctx.fillText('RATÉ !', 0, 0); ctx.restore();
      ctx.font = `bold 16px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; wrap(N.fail, 740).forEach((l, i) => ctx.fillText(l, 400, 398 + i * 22)); ctx.textAlign = 'left';
    } else if (st === 'end') {
      const e = ENDS[N.end]; ctx.fillStyle = `rgba(10,10,25,${Math.min(.82, ft * .8)})`; ctx.fillRect(0, 0, LW, G);
      if (ft > .5) {
        ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round'; const sc = Math.min(1, (ft - .5) * 4);
        ctx.translate(400, 0); ctx.scale(sc, sc);
        ctx.font = `bold 18px ${FONT}`; ctx.fillStyle = newEnd ? '#7fff7f' : '#ccc'; ctx.fillText(newEnd ? 'NOUVELLE FIN DÉCOUVERTE !' : 'FIN DÉJÀ DÉCOUVERTE', 0, 70);
        ctx.font = `900 46px ${IMP}`; ctx.strokeStyle = K; ctx.lineWidth = 8; ctx.strokeText(e.t, 0, 130); ctx.fillStyle = '#ffd23f'; ctx.fillText(e.t, 0, 130);
        ctx.font = `bold 17px ${FONT}`; ctx.fillStyle = '#fff'; wrap(e.d, 560).forEach((l, i) => ctx.fillText(l, 0, 175 + i * 24));
        for (let i = 0; i < EK.length; i++) { ctx.fillStyle = ends.includes(EK[i]) ? '#ffd23f' : '#555'; ctx.beginPath(); ctx.arc((i - 2.5) * 30, 270, 10, 0, 6.283); ctx.fill(); }
        ctx.font = `bold 14px ${FONT}`; ctx.fillStyle = '#ccc'; ctx.fillText(`Fins découvertes : ${ends.length}/${EK.length}`, 0, 305);
        ctx.restore();
      }
      if (ft > .8) drawBtns();
    }
  }

  /* ---------- Logique ---------- */
  function go(id) { N = NODES[id]; ct = 0; fired = []; alN = -1; ft = 0; st = 'play'; hov = -1; }
  function after() {
    if (N.ch) st = 'choice';
    else if (N.fail) { st = 'fail'; ft = 0; beep(120, .5, 'sawtooth', .1); }
    else if (N.end) {
      st = 'end'; ft = 0; newEnd = !ends.includes(N.end);
      if (newEnd) { ends.push(N.end); try { localStorage.setItem('stick_ends', JSON.stringify(ends)); } catch (e) {} }
      if (scoreEl) scoreEl.textContent = ends.length;
      try { if (typeof updateHighScore === 'function' && typeof currentGameId !== 'undefined') updateHighScore(currentGameId, ends.length); } catch (e) {}
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .25, 'triangle', .1), i * 140));
    } else if (N.go) go(N.go);
  }
  function backToChoice() { N = NODES[N.back]; ct = N.d; st = 'choice'; hov = -1; }
  function tick(dt) {
    T += dt; ft += dt;
    if (st === 'play') {
      ct += dt;
      (N.fx || []).forEach((e, i) => {
        if (!fired[i] && ct >= e[0]) { fired[i] = 1; const t = e[1]; if (t === 'pop') beep(180, .15); else if (t === 'flash') beep(1200, .12, 'sine'); else if (t === 'zzz') beep(260, .25, 'sine'); else if (t === 'stars') beep(150, .25);
          if (t === 'alarm') alN = -1; }
        if (e[1] === 'alarm' && ct >= e[0] && ct - e[0] < 2) { const n = Math.floor((ct - e[0]) * 4); if (n !== alN) { alN = n; beep(n % 2 ? 700 : 900, .12, 'square', .06); } }
      });
      if (ct >= N.d) after();
    } else if (st === 'fail' && ft > 3.4) backToChoice();
  }
  function press(x, y) {
    if (st === 'title') { go('intro'); return; }
    if (st === 'play') { if (x < 120 && y < 50) ct = N.d; return; }
    if (st === 'fail') { if (ft > .5) backToChoice(); return; }
    const b = btns().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (b) { beep(500, .08, 'triangle', .1); if (b.g === 'title') { st = 'title'; } else go(b.g); }
  }
  const lp = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * (W / r.width) - OX) / S, ((e.clientY - r.top) * (H / r.height) - OY) / S]; };
  const onDown = e => { e.preventDefault(); if (FSK.hit(e)) return; const p = lp(e); press(p[0], p[1]); };
  const onClick = e => { if (FSK.hit(e)) FSK.toggle(); };
  const onMove = e => { const p = lp(e); hov = btns().findIndex(b => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h); };
  const stale = () => !cv.isConnected || (!document.hidden && performance.now() - lastT > 3000);
  const onKey = e => {
    if (stale()) { cleanup(); return; }
    if (isTyping(e)) return;
    if (e.code === 'KeyF') { FSK.toggle(); return; }
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (st === 'title' || st === 'fail') press(0, 0); else if (st === 'play') ct = N.d; else if (st === 'end' && ft > .8) go('intro');
    } else if (/^Digit[1-3]$/.test(e.code) && st === 'choice') { const b = btns()[+e.code.slice(5) - 1]; if (b) press(b.x + 1, b.y + 1); }
  };
  function cleanup() {
    alive = false; cancelAnimationFrame(raf);
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('click', onClick); FSK.off(); cv.removeEventListener('pointermove', onMove); window.removeEventListener('keydown', onKey);
    if (window.__stickStop === cleanup) window.__stickStop = null;
  }
  window.__stickStop = cleanup;
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('click', onClick); cv.addEventListener('pointermove', onMove); window.addEventListener('keydown', onKey);

  function loop(ts) {
    if (!alive) return;
    lastT = performance.now();
    const dt = Math.min(.033, (ts - pt) / 1000 || 0); pt = ts;
    FSK.fit(); W = cv.width; H = cv.height; S = Math.min(W / LW, H / LH); OX = (W - LW * S) / 2; OY = (H - LH * S) / 2;
    tick(dt); ctx.save(); draw(); ctx.restore(); FSK.draw(ctx);
    raf = requestAnimationFrame(loop);
    try { currentGameLoop = raf; } catch (e) {}
  }
  N = NODES.intro; raf = requestAnimationFrame(loop);
  try { currentGameLoop = raf; } catch (e) {}
}