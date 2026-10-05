/* ============================================================
   GAMEMOBILE — adaptation mobile commune à tous les jeux

   - Téléphone en PAYSAGE  -> le jeu passe automatiquement en plein écran
     (calque plein écran + vrai mode plein écran dès le premier toucher)
   - Bouton "PLEIN ÉCRAN" sous le jeu pour l'activer à la main (portrait aussi)
   - Boutons tactiles (croix directionnelle, actions) qui envoient de vrais
     événements clavier -> les jeux restent jouables au clavier sans changement
   - Mise à l'échelle du canvas + score affiché par-dessus en plein écran

   Utilisation dans chaque jeu :
     GameMobile.reset();            // au début de startXxxGame()
     GameMobile.start('nom', opts); // à la fin de startXxxGame()
   ============================================================ */
(function () {
  'use strict';
  if (window.GameMobile) return;

  function mq(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; }

  const isTouch = mq('(pointer: coarse)').matches ||
    ((navigator.maxTouchPoints || 0) > 0 && !mq('(hover: hover)').matches);
  const mqLand = mq('(orientation: landscape)');

  // ---------- meta viewport (encoche / barres système) ----------
  (function ensureViewport() {
    let m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.name = 'viewport';
      m.content = 'width=device-width, initial-scale=1';
      document.head.appendChild(m);
    }
    if (!/viewport-fit/.test(m.content)) m.content += ', viewport-fit=cover';
  })();

  // ---------- CSS ----------
  const css = `
#game-canvas{touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
#game-canvas.gm-fixed{max-width:100%;height:auto}
#memory-board{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
html.gm-lock,body.gm-lock{overflow:hidden!important;overscroll-behavior:none}

#gm-stage{position:fixed;top:0;right:0;bottom:0;left:0;z-index:9000;background:#000;touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#gm-view{position:absolute;box-sizing:border-box;top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px);display:flex;align-items:center;justify-content:center;overflow:hidden}
#gm-view>canvas{display:block}
#gm-ui{position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none}

.gm-btn{-webkit-tap-highlight-color:transparent;touch-action:none;-webkit-user-select:none;user-select:none;font:700 22px/1 'Rajdhani',system-ui,sans-serif;color:#00f3ff;background:rgba(5,5,16,.55);border:2px solid rgba(0,243,255,.6);border-radius:16px;width:62px;height:62px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,243,255,.25);pointer-events:auto;padding:0;cursor:pointer}
.gm-btn.on{background:rgba(0,243,255,.38)}
.gm-btn.big{width:86px;height:86px;font-size:32px;border-radius:50%}

.gm-bar{touch-action:none;display:flex;flex-direction:column;gap:8px;align-items:stretch;margin:8px auto 0;max-width:100%;box-sizing:border-box}
.gm-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 6px}
.gm-hint{display:none;flex:1;color:#9aa4b8;font:600 13px/1.25 'Rajdhani',system-ui,sans-serif}
@media (orientation:portrait){.gm-hint{display:block}}
.gm-fsbtn{margin-left:auto;font:700 13px/1 'Rajdhani',system-ui,sans-serif;letter-spacing:1px;color:#00f3ff;background:rgba(5,5,16,.7);border:1px solid rgba(0,243,255,.6);border-radius:8px;padding:9px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}

.gm-controls{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;padding:6px 10px 10px;box-sizing:border-box;width:100%;touch-action:none}
#gm-stage .gm-controls{position:absolute;left:0;right:0;bottom:0;width:auto;pointer-events:none;padding:12px calc(18px + env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) calc(18px + env(safe-area-inset-left,0px))}
.gm-side{display:flex;align-items:flex-end;gap:10px;pointer-events:none}
.gm-row{display:flex;gap:10px;align-items:flex-end}
.gm-dpad{display:grid;grid-template-columns:repeat(3,62px);grid-template-rows:repeat(2,62px);gap:6px}
.gm-dpad .up{grid-column:2;grid-row:1}.gm-dpad .left{grid-column:1;grid-row:2}
.gm-dpad .down{grid-column:2;grid-row:2}.gm-dpad .right{grid-column:3;grid-row:2}

#gm-exit{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));width:34px;height:34px;font-size:15px;border-radius:10px;opacity:.55;z-index:3}
#gm-score{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));padding:5px 10px;border-radius:8px;background:rgba(5,5,16,.6);border:1px solid rgba(0,243,255,.45);color:#fff;font:700 14px/1 'Rajdhani',system-ui,sans-serif;letter-spacing:1px;pointer-events:none}

@media (max-height:430px){
  .gm-btn{width:54px;height:54px;font-size:20px}
  .gm-btn.big{width:76px;height:76px}
  .gm-dpad{grid-template-columns:repeat(3,54px);grid-template-rows:repeat(2,54px)}
}`;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---------- état ----------
  const SAVED = ['width', 'height', 'maxWidth', 'margin'];
  const S = {
    active: false, over: false, forced: false, suppress: false, tried: false, realFS: false,
    opts: {}, canvas: null, anchor: null, bar: null, ctl: null,
    stage: null, view: null, moved: [], scoreObs: null, cleanup: []
  };

  // ---------- utilitaires ----------
  function isShown(el) { return !!el && el.isConnected && el.getClientRects().length > 0; }

  function mainNodes() {
    const list = [];
    ['game-canvas', 'memory-board', 'mc-hud-container'].forEach(id => {
      const el = document.getElementById(id);
      if (isShown(el)) list.push(el);
    });
    return list;
  }

  function inGameTarget(t) {
    return !!t && (t === S.canvas || (t.closest && !!t.closest('#gm-stage')));
  }

  function sendKey(type, def) {
    try {
      window.dispatchEvent(new KeyboardEvent(type, {
        key: def.key, code: def.code || def.key, bubbles: true, cancelable: true
      }));
    } catch (e) { /* ignore */ }
  }

  // ---------- boutons tactiles ----------
  function mkBtn(def) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gm-btn' + (def.cls ? ' ' + def.cls : '');
    b.textContent = def.label;
    b.setAttribute('aria-label', def.aria || def.label);
    let down = false, t1 = null, t2 = null;

    const fire = () => { if (def.key) sendKey('keydown', def); if (def.down) def.down(); };
    const release = () => {
      if (!down) return;
      down = false;
      clearTimeout(t1); clearInterval(t2);
      b.classList.remove('on');
      if (def.key) sendKey('keyup', def);
      if (def.up) def.up();
    };

    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (down) return;
      down = true;
      b.classList.add('on');
      try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      fire();
      if (def.repeat) t1 = setTimeout(() => { t2 = setInterval(fire, def.repeat); }, def.delay || 180);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, release));
    ['touchstart', 'mousedown'].forEach(ev => b.addEventListener(ev, e => e.stopPropagation()));
    b.addEventListener('contextmenu', e => e.preventDefault());
    return b;
  }

  function mkDpad() {
    const d = document.createElement('div');
    d.className = 'gm-dpad';
    [['up', '▲', 'ArrowUp'], ['left', '◀', 'ArrowLeft'], ['down', '▼', 'ArrowDown'], ['right', '▶', 'ArrowRight']]
      .forEach(([cls, label, key]) => d.appendChild(mkBtn({ label, key, code: key, cls })));
    return d;
  }

  function mkGroup(g) {
    if (!g) return null;
    if (g.dpad) return mkDpad();
    const r = document.createElement('div');
    r.className = 'gm-row';
    (g.row || []).forEach(b => r.appendChild(mkBtn(b)));
    return r;
  }

  function buildControls() {
    if (!S.opts.left && !S.opts.right) return null;
    const c = document.createElement('div');
    c.className = 'gm-controls';
    const l = document.createElement('div'); l.className = 'gm-side';
    const r = document.createElement('div'); r.className = 'gm-side';
    const lg = mkGroup(S.opts.left), rg = mkGroup(S.opts.right);
    if (lg) l.appendChild(lg);
    if (rg) r.appendChild(rg);
    c.appendChild(l); c.appendChild(r);
    return c;
  }

  // Glisser le doigt = flèches (snake)
  function bindSwipe() {
    if (!S.opts.swipe) return;
    let sx = 0, sy = 0, on = false;
    const ts = e => {
      const t = e.target;
      if (!inGameTarget(t) || (t.closest && t.closest('.gm-btn'))) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; on = true;
    };
    const tm = e => {
      if (!on || !e.touches.length) return;
      if (e.cancelable) e.preventDefault();
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
      const k = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
      sendKey('keydown', { key: k, code: k });
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    };
    const te = () => { on = false; };
    window.addEventListener('touchstart', ts, { passive: true });
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', te);
    window.addEventListener('touchcancel', te);
    S.cleanup.push(() => {
      window.removeEventListener('touchstart', ts);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', te);
      window.removeEventListener('touchcancel', te);
    });
  }

  // ---------- vrai plein écran (quand le navigateur le permet) ----------
  function reqFS() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn || document.fullscreenElement || document.webkitFullscreenElement) return Promise.resolve(false);
    try {
      const p = fn.call(el, { navigationUI: 'hide' });
      return (p && p.then ? p : Promise.resolve()).then(() => true).catch(() => false);
    } catch (e) { return Promise.resolve(false); }
  }

  function exitFS() {
    S.realFS = false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) { /* ignore */ }
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ }
  }

  function tryFullscreen() {
    return reqFS().then(ok => {
      if (ok && S.opts.hint && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
      return ok;
    });
  }

  function onFSChange() {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (on) { S.realFS = true; return; }
    if (S.realFS) {            // l'utilisateur a quitté le plein écran (geste retour)
      S.realFS = false;
      if (S.stage) { S.suppress = true; exitStage(); }
    }
  }
  document.addEventListener('fullscreenchange', onFSChange);
  document.addEventListener('webkitfullscreenchange', onFSChange);

  // ---------- barre sous le jeu (bouton plein écran + aide + contrôles) ----------
  function placeInline() {
    if (!S.bar || !S.anchor || !S.anchor.isConnected) return;
    if (S.anchor.nextElementSibling !== S.bar) S.anchor.insertAdjacentElement('afterend', S.bar);
    if (S.ctl && S.ctl.parentNode !== S.bar) S.bar.appendChild(S.ctl);
  }

  function buildInline() {
    const nodes = mainNodes();
    if (!nodes.length) return;
    S.anchor = nodes[0].parentElement;

    const bar = document.createElement('div');
    bar.className = 'gm-bar';

    const top = document.createElement('div');
    top.className = 'gm-top';
    if (S.opts.hint) {
      const h = document.createElement('div');
      h.className = 'gm-hint';
      h.textContent = '📱 Mets ton téléphone en paysage : le jeu passe en plein écran.';
      top.appendChild(h);
    }
    const fsb = document.createElement('button');
    fsb.type = 'button';
    fsb.className = 'gm-fsbtn';
    fsb.textContent = '⛶ PLEIN ÉCRAN';
    fsb.addEventListener('click', () => {
      if (S.over) return;
      S.forced = true; S.suppress = false;
      tryFullscreen();
      evaluate();
    });
    top.appendChild(fsb);
    bar.appendChild(top);

    S.bar = bar;
    S.ctl = buildControls();
    if (S.ctl) bar.appendChild(S.ctl);
    placeInline();
  }

  // ---------- calque plein écran ----------
  function fit() {
    if (!S.stage) return;
    const view = S.view;
    const vw = view.clientWidth;
    let vh = view.clientHeight;   // hauteur totale (padding inclus, box-sizing: border-box)
    const reserve = (vh > vw && S.ctl) ? 140 : 0;   // place pour les boutons en portrait
    view.style.paddingBottom = reserve + 'px';
    vh -= reserve;

    S.moved.forEach(({ n }) => {
      if (n.id === 'game-canvas') {
        n.style.maxWidth = 'none';
        if (S.opts.fluid) { n.style.width = '100%'; n.style.height = '100%'; }
        else {
          const cw = n.width || vw, ch = n.height || vh;
          const sc = Math.min(vw / cw, vh / ch);
          n.style.width = Math.floor(cw * sc) + 'px';
          n.style.height = Math.floor(ch * sc) + 'px';
        }
      } else if (n.id === 'memory-board') {
        const s = Math.floor(Math.min(vw, vh));
        n.style.maxWidth = 'none';
        n.style.width = s + 'px';
        n.style.height = s + 'px';
        n.style.margin = '0 auto';
      }
    });
  }

  function enterStage() {
    if (S.stage) return;
    const nodes = mainNodes();
    if (!nodes.length) return;

    const stage = document.createElement('div'); stage.id = 'gm-stage';
    const view = document.createElement('div'); view.id = 'gm-view';
    const ui = document.createElement('div'); ui.id = 'gm-ui';
    stage.appendChild(view); stage.appendChild(ui);

    S.moved = nodes.map(n => {
      const ph = document.createElement('span');
      ph.className = 'gm-ph';
      ph.style.cssText = 'display:block;width:0;height:0;overflow:hidden;';
      n.parentNode.insertBefore(ph, n);
      const saved = {};
      SAVED.forEach(p => { saved[p] = n.style[p]; });
      view.appendChild(n);
      return { n, ph, saved };
    });

    // bouton quitter
    const ex = document.createElement('button');
    ex.id = 'gm-exit'; ex.type = 'button'; ex.className = 'gm-btn'; ex.textContent = '✕';
    ex.setAttribute('aria-label', 'Quitter le plein écran');
    ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => ex.addEventListener(ev, e => e.stopPropagation()));
    ex.addEventListener('click', () => { S.suppress = true; S.forced = false; exitStage({ exitFS: true }); });
    ui.appendChild(ex);

    // score en surimpression
    const src = document.getElementById('current-score');
    if (src && !S.opts.noScore) {
      const sc = document.createElement('div');
      sc.id = 'gm-score';
      const upd = () => { sc.textContent = 'SCORE ' + (src.textContent || '0'); };
      upd();
      S.scoreObs = new MutationObserver(upd);
      S.scoreObs.observe(src, { childList: true, characterData: true, subtree: true });
      ui.appendChild(sc);
    }

    if (S.ctl) ui.appendChild(S.ctl);

    // empêche le défilement de la page
    stage.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });

    // premier toucher en paysage -> vrai plein écran (geste utilisateur requis)
    const once = () => { if (S.tried) return; S.tried = true; tryFullscreen(); };
    stage.addEventListener('touchend', once);
    stage.addEventListener('pointerup', once);

    document.body.appendChild(stage);
    document.documentElement.classList.add('gm-lock');
    document.body.classList.add('gm-lock');
    S.stage = stage; S.view = view;

    fit();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  }

  function exitStage(o) {
    if (!S.stage) return;
    if (S.ctl && S.bar) S.bar.appendChild(S.ctl);
    S.moved.slice().reverse().forEach(m => {
      if (m.ph.isConnected) {
        SAVED.forEach(p => { m.n.style[p] = m.saved[p] || ''; });
        m.ph.replaceWith(m.n);
      } else if (m.n.parentNode) {
        m.n.remove();
      }
    });
    S.moved = [];
    if (S.scoreObs) { S.scoreObs.disconnect(); S.scoreObs = null; }
    S.stage.remove();
    S.stage = S.view = null;
    document.documentElement.classList.remove('gm-lock');
    document.body.classList.remove('gm-lock');
    if (o && o.exitFS) exitFS();
    placeInline();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  }

  function wantStage() {
    return isTouch && !S.over && !S.suppress &&
      (S.forced || (mqLand.matches && window.innerHeight <= 700));
  }

  function evaluate() {
    if (!S.active) return;
    if (S.stage) {
      const m = S.moved[0];
      if (!m || !m.ph.isConnected || m.ph.getClientRects().length === 0) {
        exitStage({ exitFS: true });           // l'écran de jeu a été fermé
      } else if (!wantStage()) {
        exitStage();
      } else {
        fit();
      }
    } else if (wantStage() && mainNodes().length) {
      enterStage();
    }
  }

  function teardown() {
    S.active = false;
    exitStage();
    S.cleanup.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
    S.cleanup = [];
    if (S.bar) { S.bar.remove(); S.bar = null; }
    S.ctl = null;
    if (S.canvas) S.canvas.classList.remove('gm-fixed');
    S.anchor = null;
  }

  function hookGameOver() {
    const f = window.triggerGameOver;
    if (typeof f === 'function' && !f.__gm) {
      const w = function () { GM.gameOver(); return f.apply(this, arguments); };
      w.__gm = true;
      try { window.triggerGameOver = w; } catch (e) { /* ignore */ }
    }
  }


  // ---------- anti-zoom / anti-défilement pendant une partie ----------
  const GUARD_SEL = '#game-canvas, #memory-board, #gm-stage, .gm-bar, #mc-hud-container';
  const SCROLLABLE_SEL = '#mc-pause-menu, #custom-menu-modal';

  function installTouchGuard() {
    // 1) Le navigateur n'a plus le droit de zoomer pendant la partie
    const vp = document.querySelector('meta[name="viewport"]');
    const prevVp = vp ? vp.content : null;
    if (vp) {
      vp.content = prevVp.replace(/,?\s*(maximum-scale|minimum-scale|user-scalable)=[^,]*/g, '') +
        ', maximum-scale=1, minimum-scale=1, user-scalable=no';
    }

    const inGuard = t => !!(t && t.closest && t.closest(GUARD_SEL) && !t.closest(SCROLLABLE_SEL));
    let lastEnd = 0;

    // 2) Pas de pincement (zoom) sur la zone de jeu
    const ts = e => { if (e.touches.length > 1 && inGuard(e.target) && e.cancelable) e.preventDefault(); };
    // 3) Un doigt qui glisse sur le jeu ne fait plus défiler la page
    const tm = e => { if (inGuard(e.target) && e.cancelable) e.preventDefault(); };
    // 4) Double-tap rapide (spam) = pas de zoom. On ne bloque pas les "click" des jeux à plateau (échecs, memory)
    const te = e => {
      const t = e.target;
      const canvasLike = t && t.closest && t.closest('#game-canvas, #gm-stage, .gm-btn');
      const now = Date.now();
      if (canvasLike && inGuard(t) && now - lastEnd < 400 && e.cancelable) e.preventDefault();
      lastEnd = now;
    };
    // 5) Safari iOS : gestes de zoom natifs
    const gs = e => { if (e.cancelable) e.preventDefault(); };

    document.addEventListener('touchstart', ts, { passive: false });
    document.addEventListener('touchmove', tm, { passive: false });
    document.addEventListener('touchend', te, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, gs, { passive: false }));

    S.cleanup.push(() => {
      document.removeEventListener('touchstart', ts);
      document.removeEventListener('touchmove', tm);
      document.removeEventListener('touchend', te);
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.removeEventListener(ev, gs));
      if (vp && prevVp !== null) vp.content = prevVp;
    });
  }

  // ---------- API publique ----------
  const GM = {
    isTouch,

    /** À appeler au tout début de startXxxGame() : nettoie la session précédente. */
    reset() { teardown(); },

    /** À appeler à la fin de startXxxGame() (quand le canvas / plateau est visible). */
    start(name, opts) {
      if (!isTouch) return;
      teardown();
      S.opts = opts || {};
      S.over = false; S.forced = false; S.suppress = false; S.tried = false;
      S.canvas = document.getElementById('game-canvas');
      if (S.canvas && !S.opts.fluid && !S.opts.board) S.canvas.classList.add('gm-fixed');
      hookGameOver();
      buildInline();
      bindSwipe();
      installTouchGuard();
      S.active = true;
      evaluate();
    },

    /** À appeler quand la partie est terminée (fait quitter le plein écran avant l'écran de fin). */
    gameOver() {
      S.over = true;
      exitStage();
    },

    /** Convertit des coordonnées écran en coordonnées du canvas (tient compte de la mise à l'échelle). */
    canvasPoint(clientX, clientY, canvas) {
      const c = canvas || document.getElementById('game-canvas');
      const r = c.getBoundingClientRect();
      return { x: (clientX - r.left) * (c.width / r.width), y: (clientY - r.top) * (c.height / r.height) };
    },

    /** Le toucher est-il sur la zone de jeu (et pas sur un bouton / un menu) ? */
    inGame(target) { return inGameTarget(target) && !(target.closest && target.closest('.gm-btn')); }
  };
  window.GameMobile = GM;

  // ---------- réactions aux changements d'écran ----------
  const onMq = () => { S.suppress = false; S.forced = false; evaluate(); };
  if (mqLand.addEventListener) mqLand.addEventListener('change', onMq);
  else if (mqLand.addListener) mqLand.addListener(onMq);
  window.addEventListener('resize', evaluate);
  window.addEventListener('orientationchange', () => setTimeout(evaluate, 150));
  setInterval(evaluate, 500);   // détecte aussi la fermeture de l'écran de jeu
})();