/* ============================================================
   MobileKit - adaptation mobile commune à tous les jeux
   - plein écran automatique quand le téléphone passe en paysage
   - commandes tactiles (croix, joystick, boutons, glisser)
   - à charger AVANT les fichiers de jeux : <script src="mobile.js"></script>
   Chaque jeu appelle MobileKit.setup({...}) au début de sa fonction start...
   ============================================================ */
(function () {
  'use strict';
  if (window.MobileKit) return;

  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const isTouch = coarse || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820);

  const MK = {
    isTouch,
    joy: { x: 0, y: 0 },          // joystick (Cybercraft)
    look: { dx: 0, dy: 0 },       // glisser pour regarder (Cybercraft)
    hold: { mine: false, jump: false },
    actions: {}
  };
  window.MobileKit = MK;

  let cfg = null, stage = null, canvas = null, ui = null, backdrop = null;
  let fs = false, dismissed = false, forced = false, ended = false, useGuess = false;
  let ph = null, nativeTried = false, baseRatio = 1, lastKey = '', lastLand = null, timer = null, guard = false;
  const applied = new Map();
  let cleanups = [];

  // ---------- CSS ----------
  const css = document.createElement('style');
  css.textContent = `
    html.mk-playing, html.mk-playing body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
    html.mk-playing #game-canvas { touch-action: none; }
    html.mk-playing #memory-board { touch-action: manipulation; }
    #mk-backdrop { position: fixed; inset: 0; background: #050510; z-index: 9970; display: none; }
    html.mk-fs #mk-backdrop { display: block; }
    #mk-ui { position: fixed; inset: 0; pointer-events: none; z-index: 9985; font-family: 'Rajdhani', sans-serif; }
    #mk-ui .mk-side { position: absolute; bottom: max(14px, env(safe-area-inset-bottom)); display: flex; gap: 12px; align-items: flex-end; pointer-events: none; }
    #mk-ui .mk-left { left: max(14px, env(safe-area-inset-left)); }
    #mk-ui .mk-right { right: max(14px, env(safe-area-inset-right)); }
    #mk-ui .mk-btn { pointer-events: auto; touch-action: none; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 26px; font-weight: 700; color: #00f3ff; background: rgba(5,5,16,.45); border: 2px solid rgba(0,243,255,.7);
      box-shadow: 0 0 10px rgba(0,243,255,.35); user-select: none; -webkit-user-select: none; }
    #mk-ui .mk-btn.on { background: rgba(0,243,255,.35); }
    #mk-ui .mk-btn.alt { color: #ff0055; border-color: rgba(255,0,85,.75); box-shadow: 0 0 10px rgba(255,0,85,.35); }
    #mk-ui .mk-btn.small { width: 44px; height: 44px; font-size: 18px; }
    #mk-ui .mk-joy { pointer-events: auto; touch-action: none; width: 120px; height: 120px; border-radius: 50%; background: rgba(5,5,16,.35);
      border: 2px solid rgba(0,243,255,.6); display: flex; align-items: center; justify-content: center; }
    #mk-ui .mk-knob { width: 50px; height: 50px; border-radius: 50%; background: rgba(0,243,255,.45); border: 2px solid #00f3ff; }
    #mk-ui .mk-top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); display: flex; gap: 8px; align-items: center; }
    #mk-ui .mk-score { pointer-events: none; display: none; padding: 4px 12px; border-radius: 14px; background: rgba(5,5,16,.55);
      border: 1px solid rgba(0,243,255,.5); color: #fff; font-size: 16px; font-weight: 700; letter-spacing: 1px; }
    html.mk-fs #mk-ui .mk-score { display: block; }
    #mk-ui .mk-toast { position: absolute; left: 50%; bottom: 90px; transform: translateX(-50%); padding: 8px 14px; border-radius: 16px;
      background: rgba(5,5,16,.85); border: 1px solid #00f3ff; color: #fff; font-size: 14px; text-align: center; max-width: 80vw; transition: opacity .5s; }
  `;
  document.head.appendChild(css);

  // ---------- utilitaires ----------
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
  const vp = () => ({ w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) });

  function apply(node, props) {
    if (!node) return;
    let m = applied.get(node);
    if (!m) { m = new Map(); applied.set(node, m); }
    for (const k in props) {
      if (!m.has(k)) m.set(k, [node.style.getPropertyValue(k), node.style.getPropertyPriority(k)]);
      node.style.setProperty(k, props[k], 'important');
    }
  }
  function restore(node) {
    const m = applied.get(node);
    if (!m) return;
    m.forEach(([v, p], k) => { if (v) node.style.setProperty(k, v, p); else node.style.removeProperty(k); });
    applied.delete(node);
  }

  function fire(type, key, code) {
    window.dispatchEvent(new KeyboardEvent(type, { key, code: code || key, bubbles: true, cancelable: true }));
  }
  const tapKey = (key, code) => { fire('keydown', key, code); fire('keyup', key, code); };
  const mouse = (type) => window.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true }));

  function holdBtn(label, o) {
    const b = el('div', 'mk-btn ' + (o.cls || ''), label);
    let iv = null;
    const start = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (b.classList.contains('on')) return;
      b.classList.add('on');
      if (o.down) o.down();
      if (o.repeat) iv = setInterval(() => o.down && o.down(), o.repeat);
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const end = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (!b.classList.contains('on')) return;
      b.classList.remove('on');
      clearInterval(iv);
      if (o.up) o.up();
    };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('lostpointercapture', end);
    // empêche les jeux qui écoutent window.touchstart (ex. Worm) de lire ce doigt
    b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
    return b;
  }

  function joystick() {
    const z = el('div', 'mk-joy'), k = el('div', 'mk-knob');
    z.appendChild(k);
    let id = null, cx = 0, cy = 0;
    const R = 46;
    const move = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      k.style.transform = `translate(${dx}px,${dy}px)`;
      MK.joy.x = Math.abs(dx) < 8 ? 0 : dx / R;
      MK.joy.y = Math.abs(dy) < 8 ? 0 : dy / R;
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; MK.joy.x = 0; MK.joy.y = 0; k.style.transform = '';
    };
    z.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      id = e.pointerId;
      try { z.setPointerCapture(id); } catch (_) {}
      const r = z.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    return z;
  }

  // ---------- types de commandes ----------
  const BUILD = {
    tetris(L, R) {
      L.append(
        holdBtn('◀', { down: () => tapKey('ArrowLeft'), repeat: 110 }),
        holdBtn('▶', { down: () => tapKey('ArrowRight'), repeat: 110 })
      );
      R.append(
        holdBtn('↻', { down: () => tapKey('ArrowUp') }),
        holdBtn('▼', { down: () => tapKey('ArrowDown'), repeat: 60 }),
        holdBtn('⤓', { cls: 'alt', down: () => tapKey(' ', 'Space') })
      );
    },
    boost(L, R) {
      R.append(holdBtn('⚡', { cls: 'alt', down: () => mouse('mousedown'), up: () => mouse('mouseup') }));
    },
    cyber(L, R) {
      L.append(joystick());
      R.append(
        holdBtn('⤒', { down: () => { MK.hold.jump = true; }, up: () => { MK.hold.jump = false; } }),
        holdBtn('▣', { down: () => MK.actions.place && MK.actions.place() }),
        holdBtn('⛏', { cls: 'alt', down: () => { MK.hold.mine = true; }, up: () => { MK.hold.mine = false; } })
      );
      const menu = holdBtn('☰', { cls: 'small', down: () => MK.actions.menu && MK.actions.menu() });
      menu.dataset.mkTop = '1';
      R.dataset.menu = '1';
      ui.querySelector('.mk-top').appendChild(menu);
    }
  };

  // ---------- gestes sur le canvas ----------
  function attachGestures() {
    if (!canvas || !isTouch) return;
    const on = (type, fn, opt) => { canvas.addEventListener(type, fn, opt); cleanups.push(() => canvas.removeEventListener(type, fn, opt)); };

    if (cfg.controls === 'swipe') {
      let sx = 0, sy = 0, tid = null;
      on('touchstart', (e) => { const t = e.changedTouches[0]; tid = t.identifier; sx = t.clientX; sy = t.clientY; e.preventDefault(); }, { passive: false });
      on('touchmove', (e) => {
        if (tid === null) return;
        for (const t of e.changedTouches) {
          if (t.identifier !== tid) continue;
          const dx = t.clientX - sx, dy = t.clientY - sy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 22) {
            if (Math.abs(dx) > Math.abs(dy)) tapKey(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
            else tapKey(dy > 0 ? 'ArrowDown' : 'ArrowUp');
            sx = t.clientX; sy = t.clientY;
          }
        }
        e.preventDefault();
      }, { passive: false });
      on('touchend', () => { tid = null; });
    }

    if (cfg.controls === 'pointer') {
      const send = (e) => {
        const t = e.touches[0] || e.changedTouches[0];
        if (t && typeof window.onmousemove === 'function') window.onmousemove({ clientX: t.clientX, clientY: t.clientY });
      };
      on('touchstart', (e) => {
        e.preventDefault(); send(e);
        if (cfg.shoot && typeof window.onmousedown === 'function') window.onmousedown({});
      }, { passive: false });
      on('touchmove', (e) => { e.preventDefault(); send(e); }, { passive: false });
      const up = () => { if (cfg.shoot && typeof window.onmouseup === 'function') window.onmouseup({}); };
      on('touchend', up);
      on('touchcancel', up);
    }

    if (cfg.controls === 'cyber') {
      let lid = null, lx = 0, ly = 0;
      on('pointerdown', (e) => { e.preventDefault(); if (lid !== null) return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
      on('pointermove', (e) => {
        if (e.pointerId !== lid) return;
        MK.look.dx += e.clientX - lx; MK.look.dy += e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
      });
      const end = (e) => { if (e.pointerId === lid) lid = null; };
      on('pointerup', end);
      on('pointercancel', end);
    }
  }

  // ---------- interface (score, boutons) ----------
  function buildUI() {
    removeUI();
    backdrop = el('div'); backdrop.id = 'mk-backdrop';
    ui = el('div'); ui.id = 'mk-ui';
    const top = el('div', 'mk-top');
    const fsBtn = holdBtn('⛶', { cls: 'small', down: onFsButton });
    fsBtn.id = 'mk-fsbtn';
    const score = el('div', 'mk-score'); score.id = 'mk-score';
    top.append(fsBtn, score);
    const L = el('div', 'mk-side mk-left'), R = el('div', 'mk-side mk-right');
    L.id = 'mk-left'; R.id = 'mk-right';
    ui.append(top, L, R);
    document.body.append(backdrop, ui);
    if (BUILD[cfg.controls]) BUILD[cfg.controls](L, R);
  }
  function removeUI() {
    if (ui) ui.remove();
    if (backdrop) backdrop.remove();
    ui = backdrop = null;
  }
  function toast(msg) {
    if (!ui) return;
    const t = el('div', 'mk-toast', msg);
    ui.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 600); }, 3500);
  }

  function onFsButton() {
    if (fs) { dismissed = true; forced = false; leaveFs(); exitNative(); }
    else { dismissed = false; forced = true; tryNative(); refresh(); }
  }
  function tryNative() {
    const d = document.documentElement;
    if (document.fullscreenElement || !d.requestFullscreen) return;
    d.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    }).catch(() => {});
  }
  function exitNative() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  // ---------- plein écran (CSS) ----------
  function enterFs() {
    const { w: vw, h: vh } = vp();
    if (!fs && cfg.mode === 'board') {
      const r = stage.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) baseRatio = r.width / r.height;
    }
    detach();
    if (cfg.mode === 'fluid') {
      apply(stage, { position: 'fixed', top: '0', left: '0', width: vw + 'px', height: vh + 'px', 'max-width': 'none', 'max-height': 'none', margin: '0', padding: '0', 'z-index': '9980', background: '#000', overflow: 'hidden' });
      apply(canvas, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', 'max-width': 'none' });
    } else {
      const r = cfg.mode === 'canvas' ? canvas.width / canvas.height : (cfg.ratio || baseRatio);
      let w, h;
      if (r > vw / vh) { w = vw; h = vw / r; } else { h = vh; w = vh * r; }
      apply(stage, {
        position: 'fixed', left: Math.round((vw - w) / 2) + 'px', top: Math.round((vh - h) / 2) + 'px',
        width: Math.floor(w) + 'px', height: Math.floor(h) + 'px', 'max-width': 'none', 'max-height': 'none', margin: '0', 'z-index': '9980'
      });
    }
    fs = true;
    document.documentElement.classList.add('mk-fs');
    notifyResize();
  }
  function detach() {
    if (ph || !stage || !stage.parentNode) return;
    ph = document.createComment('mk-placeholder');
    stage.parentNode.insertBefore(ph, stage);
    document.body.appendChild(stage);
  }
  function reattach() {
    if (!ph) return;
    if (ph.parentNode && stage) ph.parentNode.insertBefore(stage, ph);
    ph.remove();
    ph = null;
  }
  function leaveFs() {
    if (!fs) return;
    restore(stage);
    if (canvas && cfg && cfg.mode === 'fluid') restore(canvas);
    reattach();
    fs = false;
    document.documentElement.classList.remove('mk-fs');
    portraitStyle();
    notifyResize();
  }
  function portraitStyle() {
    if (isTouch && cfg && cfg.mode === 'canvas') apply(canvas, { 'max-width': '100%', height: 'auto' });
  }
  function notifyResize() {
    const { w, h } = vp();
    const key = w + 'x' + h + (fs ? 'f' : 'n');
    if (key === lastKey) return;
    lastKey = key;
    guard = true;
    try {
      if (cfg && cfg.onResize) cfg.onResize();
      if (cfg && cfg.mode === 'fluid') window.dispatchEvent(new Event('resize'));
    } finally { guard = false; }
  }

  // ---------- état du jeu ----------
  function isActive() {
    if (!stage || !stage.isConnected) return false;
    const probe = (ph && ph.parentNode) ? ph.parentNode : stage;
    if (!probe.getClientRects().length) return false;
    return getComputedStyle(probe).visibility !== 'hidden';
  }
  function gameOverVisible() {
    if (!useGuess) return false;
    const n = document.querySelectorAll('[id*="game-over" i],[id*="gameover" i],[class*="game-over" i],[class*="gameover" i]');
    for (const e of n) {
      if (ui && ui.contains(e)) continue;
      if (e.getClientRects().length && getComputedStyle(e).opacity !== '0') return true;
    }
    return false;
  }

  function refresh() {
    if (!cfg) return;
    const act = isActive();
    document.documentElement.classList.toggle('mk-playing', act && isTouch);
    if (!act) { leaveFs(); if (ui) ui.style.display = 'none'; return; }

    if (!ended && gameOverVisible()) MK.gameEnded();
    if (ended) { leaveFs(); if (ui) ui.style.display = 'none'; return; }

    if (ui) ui.style.display = '';
    const { w, h } = vp();
    const land = w > h;
    if (lastLand !== land) { lastLand = land; dismissed = false; forced = false; }
    const want = isTouch && ((land && !dismissed) || forced);

    if (want) { enterFs(); } else if (fs) { leaveFs(); } else { portraitStyle(); }

    // commandes
    const paused = cfg.isPaused && cfg.isPaused();
    const hasCtl = isTouch && BUILD[cfg.controls];
    const left = document.getElementById('mk-left'), right = document.getElementById('mk-right');
    if (left) left.style.display = hasCtl && !paused ? '' : 'none';
    if (right) right.style.display = hasCtl && !paused ? '' : 'none';
    const topMenu = ui && ui.querySelector('[data-mk-top]');
    if (topMenu) topMenu.style.display = paused ? 'none' : '';

    const fsBtn = document.getElementById('mk-fsbtn');
    if (fsBtn) { fsBtn.style.display = isTouch ? '' : 'none'; fsBtn.textContent = fs ? '✕' : '⛶'; }
    const sc = document.getElementById('mk-score'), real = document.getElementById('current-score');
    if (sc && real) sc.textContent = 'SCORE ' + real.textContent;
  }

  // ---------- API ----------
  MK.setup = function (opts) {
    try { setupInner(opts); } catch (err) { console.error('[MobileKit] setup', err); try { MK.teardown(); } catch (_) {} }
  };
  function setupInner(opts) {
    MK.teardown();
    // un bouton gardant le focus relancerait le jeu quand on appuie sur Espace/Entrée
    const ae = document.activeElement;
    if (ae && ae !== document.body && /^(BUTTON|A|INPUT|SELECT)$/.test(ae.tagName)) ae.blur();
    // coupe l'ancienne boucle de jeu si le site ne l'a pas fait
    try { if (typeof currentGameLoop !== 'undefined' && currentGameLoop) cancelAnimationFrame(currentGameLoop); } catch (_) {}
    cfg = Object.assign({ mode: 'canvas', controls: 'none' }, opts || {});
    canvas = document.getElementById('game-canvas');
    stage = cfg.mode === 'board' ? document.getElementById('memory-board')
          : cfg.mode === 'fluid' ? (canvas && canvas.parentElement)
          : canvas;
    if (!stage) { cfg = null; return; }
    ended = false; dismissed = false; forced = false; lastKey = ''; lastLand = null;
    hookGameOver();
    buildUI();
    attachGestures();
    timer = setInterval(refresh, 250);
    refresh();
    if (isTouch && window.innerWidth < window.innerHeight && cfg.mode !== 'board') {
      toast('Tournez votre téléphone en paysage pour jouer en plein écran');
    }
  }

  MK.teardown = function () {
    clearInterval(timer);
    cleanups.forEach((f) => f()); cleanups = [];
    if (stage) restore(stage);
    if (canvas) restore(canvas);
    reattach();
    fs = false;
    document.documentElement.classList.remove('mk-fs', 'mk-playing');
    removeUI();
    MK.joy.x = MK.joy.y = 0; MK.look.dx = MK.look.dy = 0; MK.hold.mine = MK.hold.jump = false;
    MK.actions = {};
    cfg = null;
  };

  MK.gameEnded = function () {
    ended = true;
    if (cfg) { leaveFs(); if (ui) ui.style.display = 'none'; }
  };
  MK.isFullscreen = () => fs;
  // Taille à utiliser pour les jeux dont le canvas remplit son conteneur (Worm, Cybercraft)
  MK.size = function (parent) {
    if (fs && cfg && cfg.mode === 'fluid') return vp();
    return { w: parent ? parent.clientWidth : 0, h: parent ? parent.clientHeight : 0 };
  };

  function hookGameOver() {
    const f = window.triggerGameOver;
    if (typeof f === 'function') {
      if (!f.__mk) {
        const w = function () { MK.gameEnded(); return f.apply(this, arguments); };
        w.__mk = true;
        window.triggerGameOver = w;
      }
      useGuess = false;
    } else {
      useGuess = true; // triggerGameOver non accessible via window : détection par le DOM
    }
  }

  // plein écran natif (barre du navigateur masquée) au premier toucher en paysage
  document.addEventListener('pointerup', () => {
    if (cfg && fs && !nativeTried && isTouch) { nativeTried = true; tryNative(); }
  }, true);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) nativeTried = false; });

  const onRot = () => setTimeout(() => { if (!guard) refresh(); }, 120);
  window.addEventListener('resize', onRot);
  window.addEventListener('orientationchange', onRot);
})();