/*
 * PHYSICS DRAW — Logic Physics Edition
 * Puzzle de dessin et physique, inspiré du genre des jeux de réflexion physique.
 * API conservée pour le site : startPhysicsGame() / _physicsCleanup().
 * Nécessite #game-canvas. Aucun moteur externe.
 */
(function () {
  'use strict';

  const W = 640;
  const H = 400;
  const FLOOR_Y = 388;
  const GRAVITY = 0.24;
  const BALL_RESTITUTION = 0.48;
  const SHAPE_RESTITUTION = 0.16;
  const LINE_RADIUS = 3.2;
  // La longueur du trait n'est pas limitée : seuls les points techniques sont simplifiés.
  const MAX_POINTS = 180;
  const MAX_RAW_POINTS = 1400;
  const START_DELAY_MS = 3000;
  const FIXED_DT = 1 / 60;

  let canvas = null;
  let ctx = null;
  let rafId = 0;
  let accumulator = 0;
  let lastTime = 0;
  let active = false;
  let disposed = false;
  let drawing = false;
  let pointerId = null;
  let ballAwake = false;
  let completed = false;
  let allCompleted = false;
  let currentLevel = 0;
  let levelTimer = 0;
  let toastTimer = 0;
  let resizeObserver = null;
  let cleanupHandlers = [];
  let drawnBodies = [];
  let draftPoints = [];
  let particles = [];
  let shake = 0;
  let hintTimer = 0;
  let uiRoot = null;
  let uiHost = null;
  let originalHostPosition = '';
  let hostPositionChanged = false;
  let levelIntroOpen = true;
  let progressOpen = false;
  let progressReturnToIntro = false;
  let lastIntroKind = 'start';
  let countdownActive = false;
  let countdownEndsAt = 0;
  const completedLevels = new Set();

  const ball = {
    x: 76, y: 70, vx: 0, vy: 0, r: 11,
    color: '#f06b3f', lastHit: 0
  };

const LEVELS = [
  // NIVEAU 1
  {
    title: '01 · Le passage',
    instruction: 'Dessine un bâton : il tombe et peut pousser la balle vers la cible.',
    maxStrokes: 1,
    start: { x: 78, y: 62 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 230, y: 170, w: 26, h: 218 },
      { x: 330, y: 282, w: 105, h: 13 },
      { x: 445, y: 241, w: 72, h: 13 }
    ]
  },

  // NIVEAU 2
  {
    title: '02 · Le détour',
    instruction: 'Utilise un trait comme levier pour faire contourner le bloc à la balle.',
    maxStrokes: 2,
    start: { x: 82, y: 72 },
    goal: { x: 524, y: 316, w: 68, h: 67 },
    obstacles: [
      { x: 185, y: 232, w: 142, h: 14 },
      { x: 320, y: 145, w: 26, h: 243 },
      { x: 398, y: 273, w: 88, h: 14 },
      { x: 455, y: 203, w: 24, h: 68 }
    ]
  },

  // NIVEAU 3
  {
    title: '03 · Le bon angle',
    instruction: 'Place un bâton incliné : son poids et sa rotation feront le travail.',
    maxStrokes: 3,
    start: { x: 80, y: 76 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 205, y: 133, w: 28, h: 255 },
      { x: 292, y: 226, w: 112, h: 13 },
      { x: 425, y: 164, w: 28, h: 224 },
      { x: 472, y: 288, w: 41, h: 13 }
    ]
  },

  // NIVEAU 4
  {
    title: '04 · Le dernier effort',
    instruction: 'Un seul trait peut suffire. Pense à son point d’équilibre.',
    maxStrokes: 1,
    start: { x: 73, y: 58 },
    goal: { x: 525, y: 316, w: 68, h: 67 },
    obstacles: [
      { x: 162, y: 205, w: 100, h: 13 },
      { x: 278, y: 123, w: 25, h: 265 },
      { x: 352, y: 288, w: 90, h: 13 },
      { x: 468, y: 188, w: 24, h: 200 }
    ]
  },

  // NIVEAU 5
  {
    title: '05 · Les escaliers',
    instruction: 'Fais progresser la balle d’une marche à l’autre.',
    maxStrokes: 2,
    start: { x: 70, y: 60 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 145, y: 305, w: 100, h: 13 },
      { x: 245, y: 265, w: 100, h: 13 },
      { x: 345, y: 225, w: 100, h: 13 },
      { x: 445, y: 267, w: 54, h: 13 }
    ]
  },

  // NIVEAU 6
  {
    title: '06 · Le slalom',
    instruction: 'Contourne les colonnes sans perdre le contrôle de la balle.',
    maxStrokes: 3,
    start: { x: 72, y: 58 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 160, y: 110, w: 23, h: 185 },
      { x: 248, y: 210, w: 23, h: 178 },
      { x: 340, y: 105, w: 23, h: 190 },
      { x: 430, y: 210, w: 23, h: 178 },
      { x: 468, y: 279, w: 38, h: 12 }
    ]
  },

  // NIVEAU 7
  {
    title: '07 · Le levier',
    instruction: 'Trouve le bon angle pour faire basculer ton trait.',
    maxStrokes: 2,
    start: { x: 75, y: 55 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 160, y: 310, w: 95, h: 13 },
      { x: 265, y: 270, w: 90, h: 13 },
      { x: 370, y: 230, w: 90, h: 13 },
      { x: 440, y: 155, w: 24, h: 75 }
    ]
  },

  // NIVEAU 8
  {
    title: '08 · Les étagères',
    instruction: 'Utilise les ouvertures entre les plateformes.',
    maxStrokes: 3,
    start: { x: 75, y: 65 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 145, y: 150, w: 130, h: 13 },
      { x: 305, y: 205, w: 150, h: 13 },
      { x: 175, y: 285, w: 125, h: 13 },
      { x: 365, y: 315, w: 95, h: 13 }
    ]
  },

  // NIVEAU 9
  {
    title: '09 · Le pont',
    instruction: 'Construis un passage pour rejoindre la cible de l’autre côté.',
    maxStrokes: 2,
    start: { x: 75, y: 70 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 125, y: 305, w: 115, h: 13 },
      { x: 285, y: 265, w: 90, h: 13 },
      { x: 415, y: 225, w: 75, h: 13 },
      { x: 245, y: 180, w: 23, h: 85 }
    ]
  },

  // NIVEAU 10
  {
    title: '10 · La tour',
    instruction: 'La tour bloque ton chemin. À toi de trouver comment la franchir.',
    maxStrokes: 3,
    start: { x: 70, y: 60 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 190, y: 190, w: 30, h: 198 },
      { x: 220, y: 190, w: 95, h: 13 },
      { x: 335, y: 245, w: 90, h: 13 },
      { x: 445, y: 180, w: 25, h: 140 }
    ]
  },

  // NIVEAU 11
  {
    title: '11 · Le zigzag',
    instruction: 'Chaque obstacle te force à changer de direction.',
    maxStrokes: 4,
    start: { x: 70, y: 55 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 135, y: 245, w: 105, h: 13 },
      { x: 240, y: 160, w: 105, h: 13 },
      { x: 345, y: 245, w: 105, h: 13 },
      { x: 455, y: 195, w: 24, h: 115 }
    ]
  },

  // NIVEAU 12
  {
    title: '12 · Les deux puits',
    instruction: 'Évite les pièges et utilise tes traits pour guider la balle.',
    maxStrokes: 2,
    start: { x: 75, y: 60 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 150, y: 275, w: 120, h: 13 },
      { x: 150, y: 315, w: 120, h: 13 },
      { x: 315, y: 220, w: 125, h: 13 },
      { x: 315, y: 260, w: 125, h: 13 },
      { x: 450, y: 170, w: 22, h: 110 }
    ]
  },

  // NIVEAU 13
  {
    title: '13 · Les colonnes',
    instruction: 'Trois colonnes te séparent de la cible. Trouve le bon passage.',
    maxStrokes: 3,
    start: { x: 70, y: 60 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 170, y: 160, w: 25, h: 180 },
      { x: 270, y: 80, w: 25, h: 205 },
      { x: 370, y: 160, w: 25, h: 180 },
      { x: 465, y: 265, w: 35, h: 13 }
    ]
  },

  // NIVEAU 14
  {
    title: '14 · La porte étroite',
    instruction: 'Fais passer la balle à travers les ouvertures.',
    maxStrokes: 4,
    start: { x: 75, y: 55 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 160, y: 110, w: 170, h: 13 },
      { x: 160, y: 110, w: 13, h: 145 },
      { x: 330, y: 210, w: 13, h: 145 },
      { x: 360, y: 265, w: 110, h: 13 },
      { x: 450, y: 135, w: 23, h: 130 }
    ]
  },

  // NIVEAU 15
  {
    title: '15 · La rampe',
    instruction: 'Dessine une rampe qui utilise la gravité pour propulser la balle.',
    maxStrokes: 3,
    start: { x: 75, y: 65 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 120, y: 310, w: 110, h: 13 },
      { x: 255, y: 280, w: 110, h: 13 },
      { x: 390, y: 250, w: 85, h: 13 },
      { x: 455, y: 165, w: 22, h: 85 }
    ]
  },

  // NIVEAU 16
  {
    title: '16 · Le passage secret',
    instruction: 'Le chemin direct est bloqué. Cherche une autre trajectoire.',
    maxStrokes: 4,
    start: { x: 75, y: 60 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 145, y: 180, w: 145, h: 13 },
      { x: 290, y: 180, w: 13, h: 120 },
      { x: 290, y: 300, w: 125, h: 13 },
      { x: 415, y: 190, w: 13, h: 110 },
      { x: 460, y: 245, w: 25, h: 70 }
    ]
  },

  // NIVEAU 17
  {
    title: '17 · Le double détour',
    instruction: 'Tu disposes de quatre traits pour contourner les deux obstacles.',
    maxStrokes: 4,
    start: { x: 75, y: 55 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 150, y: 245, w: 120, h: 13 },
      { x: 220, y: 150, w: 25, h: 95 },
      { x: 300, y: 190, w: 120, h: 13 },
      { x: 395, y: 203, w: 25, h: 100 },
      { x: 455, y: 290, w: 45, h: 13 }
    ]
  },

  // NIVEAU 18
  {
    title: '18 · L’équilibriste',
    instruction: 'Pense à l’équilibre et à la rotation de tes bâtons.',
    maxStrokes: 3,
    start: { x: 75, y: 65 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 150, y: 320, w: 110, h: 13 },
      { x: 260, y: 270, w: 100, h: 13 },
      { x: 360, y: 220, w: 90, h: 13 },
      { x: 450, y: 170, w: 23, h: 90 },
      { x: 470, y: 300, w: 35, h: 13 }
    ]
  },

  // NIVEAU 19
  {
    title: '19 · Le labyrinthe',
    instruction: 'Étudie les obstacles et choisis le meilleur endroit pour dessiner.',
    maxStrokes: 4,
    start: { x: 75, y: 55 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 130, y: 130, w: 125, h: 13 },
      { x: 255, y: 130, w: 13, h: 130 },
      { x: 180, y: 260, w: 140, h: 13 },
      { x: 320, y: 195, w: 13, h: 78 },
      { x: 355, y: 195, w: 100, h: 13 },
      { x: 455, y: 208, w: 13, h: 100 }
    ]
  },

  // NIVEAU 20
  {
    title: '20 · Le grand défi',
    instruction: 'Dernier niveau : combine les leviers, les chutes et les rebonds pour atteindre la cible.',
    maxStrokes: 5,
    start: { x: 68, y: 55 },
    goal: { x: 530, y: 316, w: 65, h: 67 },
    obstacles: [
      { x: 125, y: 290, w: 90, h: 13 },
      { x: 215, y: 215, w: 25, h: 88 },
      { x: 260, y: 265, w: 90, h: 13 },
      { x: 350, y: 170, w: 25, h: 108 },
      { x: 390, y: 230, w: 75, h: 13 },
      { x: 465, y: 165, w: 23, h: 75 },
      { x: 475, y: 292, w: 35, h: 13 }
    ]
  }
];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dot = (ax, ay, bx, by) => ax * bx + ay * by;
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  const hypot = Math.hypot;
  function random() { return Math.random(); }

  function addHandler(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    cleanupHandlers.push(() => target.removeEventListener(type, fn, options));
  }

  function lvl() { return LEVELS[currentLevel]; }

  function setHint(text) {
    const el = document.getElementById('controls-hint');
    if (el) el.textContent = text;
  }

  function notify(message) {
    let el = document.getElementById('physics-logic-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'physics-logic-toast';
      el.style.cssText = [
        'position:fixed', 'left:50%', 'top:16px', 'transform:translateX(-50%)',
        'z-index:999999', 'padding:9px 14px', 'border-radius:8px',
        'background:#20262d', 'color:#fff', 'font:600 13px system-ui,sans-serif',
        'box-shadow:0 3px 16px #0002', 'pointer-events:none',
        'opacity:0', 'transition:opacity .15s'
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (el) el.style.opacity = '0';
    }, 1600);
  }

  function startPhysicsGame() {
    stopPhysicsGame();
    canvas = document.getElementById('game-canvas');

    if (!canvas) {
      console.error('[Physics Draw] #game-canvas introuvable.');
      return;
    }

    ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('[Physics Draw] Canvas 2D indisponible.');
      return;
    }

    disposed = false;
    active = true;
    currentLevel = 0;
    completedLevels.clear();
    countdownActive = false;
    countdownEndsAt = 0;
    levelIntroOpen = true;
    progressOpen = false;

    if (canvas.style) canvas.style.touchAction = 'none';

    resizeContext();
    resetLevel(false);
    mountGameUI();
    bindEvents();
    showLevelIntro('start');

    if (window.GameMobile && typeof window.GameMobile.start === 'function') {
      try {
        window.GameMobile.start('physics');
      } catch (err) {
        console.warn('[Physics Draw] GameMobile.start :', err);
      }
    }

    lastTime = performance.now();
    accumulator = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stopPhysicsGame() {
    active = false;
    disposed = true;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    clearTimeout(levelTimer);
    clearTimeout(toastTimer);
    clearTimeout(hintTimer);

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    cleanupHandlers.splice(0).forEach(fn => {
      try { fn(); } catch (_) {}
    });

    drawing = false;
    pointerId = null;
    drawnBodies = [];
    draftPoints = [];
    particles = [];

    const toastEl = document.getElementById('physics-logic-toast');
    if (toastEl) toastEl.remove();

    if (uiRoot && uiRoot.parentNode) {
      uiRoot.parentNode.removeChild(uiRoot);
    }

    uiRoot = null;

    if (uiHost && uiHost !== document.body && hostPositionChanged) {
      uiHost.style.position = originalHostPosition;
    }

    hostPositionChanged = false;
    uiHost = null;

    const uiStyle = document.getElementById('physics-logic-ui-style');
    if (uiStyle) uiStyle.remove();
  }

  function resizeContext() {
    if (!canvas || !ctx) return;

    // Le monde reste en 640×400 et s'adapte à la taille du canvas.
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function bindEvents() {
    const down = e => {
      if (completed || allCompleted || levelIntroOpen || progressOpen) return;
      if (e.button !== undefined && e.button !== 0) return;

      e.preventDefault();

      if (drawnBodies.length >= lvl().maxStrokes) {
        notify(`Tu as utilisé les ${lvl().maxStrokes} trait(s) de ce niveau. Recommence pour réessayer.`);
        return;
      }

      drawing = true;
      pointerId = e.pointerId == null ? null : e.pointerId;
      draftPoints = [canvasPoint(e)];
      updateStrokeUI();

      if (canvas.setPointerCapture && e.pointerId != null) {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
    };

    const move = e => {
      if (!drawing) return;
      if (pointerId !== null && e.pointerId != null && e.pointerId !== pointerId) return;

      e.preventDefault();

      const p = canvasPoint(e);
      const last = draftPoints[draftPoints.length - 1];
      if (!last) return;

      const dx = p.x - last.x;
      const dy = p.y - last.y;

      if (hypot(dx, dy) < 2) return;

      // Aucune limite de longueur : on compacte seulement les points bruts
      // si le tracé est extrêmement complexe, sans terminer le trait.
      if (draftPoints.length >= MAX_RAW_POINTS) {
        const compact = [];

        for (let i = 0; i < draftPoints.length; i += 2) {
          compact.push(draftPoints[i]);
        }

        const previousEnd = draftPoints[draftPoints.length - 1];

        if (compact[compact.length - 1] !== previousEnd) {
          compact.push(previousEnd);
        }

        draftPoints = compact;
      }

      draftPoints.push(p);
      updateStrokeUI();
    };

    const up = e => {
      if (!drawing) return;
      if (pointerId !== null && e.pointerId != null && e.pointerId !== pointerId) return;
      if (e.preventDefault) e.preventDefault();
      finishStroke();
    };

    const keydown = e => {
      if (e.code === 'KeyR') {
        e.preventDefault();

        if (allCompleted) {
          currentLevel = 0;
          completedLevels.clear();
        }

        resetLevel(false);
        showLevelIntro('restart');
      }

      if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        drawnBodies.pop();
        updateStrokeUI();
      }
    };

    addHandler(canvas, 'pointerdown', down, { passive: false });
    addHandler(canvas, 'pointermove', move, { passive: false });
    addHandler(canvas, 'pointerup', up, { passive: false });
    addHandler(canvas, 'pointercancel', up, { passive: false });
    addHandler(canvas, 'lostpointercapture', up, { passive: false });
    addHandler(window, 'keydown', keydown);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resizeContext);
      resizeObserver.observe(canvas);
    } else {
      addHandler(window, 'resize', resizeContext);
    }
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: clamp((e.clientX - rect.left) * W / rect.width, 0, W),
      y: clamp((e.clientY - rect.top) * H / rect.height, 0, H)
    };
  }

  function resetLevel(showMessage = true) {
    clearTimeout(levelTimer);

    const data = lvl();

    ball.x = data.start.x;
    ball.y = data.start.y;
    ball.vx = 0;
    ball.vy = 0;
    ball.lastHit = 0;

    ballAwake = false;
    countdownActive = false;
    countdownEndsAt = 0;
    drawing = false;
    pointerId = null;
    completed = false;
    allCompleted = false;

    drawnBodies = [];
    draftPoints = [];
    particles = [];
    shake = 0;

    updateHint();
    updateProgressUI();
    updateStrokeUI();

    if (showMessage) notify('Niveau recommencé');
  }

  function updateHint() {
    if (allCompleted) {
      setHint('Tous les niveaux terminés ! Appuie sur R pour recommencer.');
      return;
    }

    setHint(`${lvl().title} — ${lvl().instruction} Maintiens le clic pour dessiner · R : recommencer`);
  }

  function finishStroke() {
    drawing = false;
    pointerId = null;

    const raw = draftPoints;
    draftPoints = [];

    if (!raw || raw.length < 2) {
      updateStrokeUI();
      return;
    }

    const maxStrokes = lvl().maxStrokes;

    if (drawnBodies.length >= maxStrokes) {
      notify(`Limite de ${maxStrokes} trait(s) atteinte pour ce niveau.`);
      updateStrokeUI();
      return;
    }

    // La longueur est libre. On réduit uniquement le nombre de points physiques.
    const sampled = resample(raw, 5.5);

    if (sampled.length < 2) return;

    const body = makeRigidBody(sampled);

    if (body.length < 16) {
      notify('Trait trop court : dessine un peu plus long.');
      updateStrokeUI();
      return;
    }

    drawnBodies.push(body);
    updateStrokeUI();

    notify(`Trait ajouté · ${Math.max(0, maxStrokes - drawnBodies.length)} restant(s)`);
  }

  function polylineLength(points) {
    let total = 0;

    for (let i = 1; i < points.length; i++) {
      total += hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y
      );
    }

    return total;
  }

  function resample(points, spacing) {
    // Pas de longueur maximale : pour les longs traits, l'espacement augmente
    // afin de conserver la forme sans dépasser le budget de points physiques.
    const totalLength = polylineLength(points);
    const effectiveSpacing = Math.max(spacing, totalLength / (MAX_POINTS - 2));

    const out = [{ x: points[0].x, y: points[0].y }];
    let carry = 0;
    let last = { x: points[0].x, y: points[0].y };

    for (let i = 1; i < points.length; i++) {
      const end = points[i];
      let dx = end.x - last.x;
      let dy = end.y - last.y;
      let dist = hypot(dx, dy);

      if (dist < 0.001) continue;

      while (carry + dist >= effectiveSpacing) {
        const needed = effectiveSpacing - carry;
        const t = needed / dist;

        last = {
          x: last.x + dx * t,
          y: last.y + dy * t
        };

        out.push(last);

        dx = end.x - last.x;
        dy = end.y - last.y;
        dist = hypot(dx, dy);
        carry = 0;

        if (out.length >= MAX_POINTS) return out;
      }

      carry += dist;
      last = { x: end.x, y: end.y };
    }

    const tail = points[points.length - 1];
    const lastOut = out[out.length - 1];

    if (
      hypot(tail.x - lastOut.x, tail.y - lastOut.y) > 1.5 &&
      out.length < MAX_POINTS
    ) {
      out.push({ x: tail.x, y: tail.y });
    }

    return out;
  }

  function makeRigidBody(points) {
    // Centre de masse pondéré par la longueur des segments.
    let length = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = hypot(b.x - a.x, b.y - a.y);

      if (len < 0.001) continue;

      length += len;
      cx += (a.x + b.x) * 0.5 * len;
      cy += (a.y + b.y) * 0.5 * len;
    }

    if (length < 0.001) return { length: 0 };

    cx /= length;
    cy /= length;

    const local = points.map(p => ({ x: p.x - cx, y: p.y - cy }));

    // Masse et inertie simplifiées.
    const mass = clamp(length / 35, 0.55, 7.5);
    const inertia = Math.max(85, mass * length * length / 12);

    return {
      local,
      x: cx,
      y: cy,
      angle: 0,
      vx: 0,
      vy: 0,
      omega: 0,
      length,
      mass,
      invMass: 1 / mass,
      inertia,
      invInertia: 1 / inertia,
      strokeRadius: LINE_RADIUS,
      bound: local.reduce((m, p) => Math.max(m, hypot(p.x, p.y)), 0),
      age: 0
    };
  }

  function worldPoint(body, localPoint) {
    const c = Math.cos(body.angle);
    const s = Math.sin(body.angle);

    return {
      x: body.x + localPoint.x * c - localPoint.y * s,
      y: body.y + localPoint.x * s + localPoint.y * c
    };
  }

  function bodyPoints(body, step = 1) {
    const result = [];

    for (let i = 0; i < body.local.length; i += step) {
      result.push(worldPoint(body, body.local[i]));
    }

    if ((body.local.length - 1) % step !== 0) {
      result.push(worldPoint(body, body.local[body.local.length - 1]));
    }

    return result;
  }

  function closestOnSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    const t = lenSq < 0.0001
      ? 0
      : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);

    return {
      x: a.x + dx * t,
      y: a.y + dy * t,
      t
    };
  }

  function pointVelocity(body, point) {
    const rx = point.x - body.x;
    const ry = point.y - body.y;

    return {
      x: body.vx - body.omega * ry,
      y: body.vy + body.omega * rx,
      rx,
      ry
    };
  }

  function applyBodyImpulse(body, ix, iy, point) {
    body.vx += ix * body.invMass;
    body.vy += iy * body.invMass;

    const rx = point.x - body.x;
    const ry = point.y - body.y;

    body.omega += cross(rx, ry, ix, iy) * body.invInertia;
    body.omega = clamp(body.omega, -0.18, 0.18);
  }

  function impulseAgainstStatic(body, nx, ny, point, restitution, friction = 0.32) {
    const v = pointVelocity(body, point);
    const vn = dot(v.x, v.y, nx, ny);

    if (vn < 0) {
      const rn = cross(v.rx, v.ry, nx, ny);
      const denom = body.invMass + rn * rn * body.invInertia;

      if (denom <= 0) return;

      const j = -(1 + restitution) * vn / denom;
      applyBodyImpulse(body, nx * j, ny * j, point);

      const tx = -ny;
      const ty = nx;
      const v2 = pointVelocity(body, point);
      const vt = dot(v2.x, v2.y, tx, ty);
      const rt = cross(v2.rx, v2.ry, tx, ty);
      const denomT = body.invMass + rt * rt * body.invInertia;

      if (denomT > 0) {
        const jt = clamp(-vt / denomT, -j * friction, j * friction);
        applyBodyImpulse(body, tx * jt, ty * jt, point);
      }
    }
  }

  function solveBodyAgainstRect(body, rect) {
    const samples = sampledWorldPoints(body, 8);
    let best = null;

    const r = body.strokeRadius;
    const left = rect.x - r;
    const right = rect.x + rect.w + r;
    const top = rect.y - r;
    const bottom = rect.y + rect.h + r;

    for (const p of samples) {
      if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;

      const choices = [
        { depth: p.x - left, nx: -1, ny: 0, px: left, py: p.y },
        { depth: right - p.x, nx: 1, ny: 0, px: right, py: p.y },
        { depth: p.y - top, nx: 0, ny: -1, px: p.x, py: top },
        { depth: bottom - p.y, nx: 0, ny: 1, px: p.x, py: bottom }
      ];

      choices.sort((a, b) => a.depth - b.depth);

      const c = choices[0];

      if (c.depth >= 0 && (!best || c.depth > best.depth)) {
        best = { ...c, p };
      }
    }

    if (!best) return;

    body.x += best.nx * (best.depth + 0.05) * 0.92;
    body.y += best.ny * (best.depth + 0.05) * 0.92;

    impulseAgainstStatic(body, best.nx, best.ny, best.p, SHAPE_RESTITUTION, 0.45);
  }

  function sampledWorldPoints(body, spacing = 7) {
    const result = [];

    for (let i = 0; i < body.local.length - 1; i++) {
      const a = worldPoint(body, body.local[i]);
      const b = worldPoint(body, body.local[i + 1]);

      if (i === 0) result.push(a);

      const dist = hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(dist / spacing));

      for (let j = 1; j <= steps; j++) {
        const t = j / steps;

        result.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t
        });
      }
    }

    return result;
  }

  function solveBodyAgainstBounds(body) {
    const samples = sampledWorldPoints(body, 7);
    let best = null;
    const r = body.strokeRadius;

    for (const p of samples) {
      let c = null;

      if (p.y + r > FLOOR_Y) {
        c = { depth: p.y + r - FLOOR_Y, nx: 0, ny: -1, px: p.x, py: FLOOR_Y };
      } else if (p.x - r < 0) {
        c = { depth: r - p.x, nx: 1, ny: 0, px: 0, py: p.y };
      } else if (p.x + r > W) {
        c = { depth: p.x + r - W, nx: -1, ny: 0, px: W, py: p.y };
      }

      if (c && (!best || c.depth > best.depth)) {
        best = { ...c, p };
      }
    }

    if (!best) return;

    body.x += best.nx * (best.depth + 0.05) * 0.94;
    body.y += best.ny * (best.depth + 0.05) * 0.94;

    impulseAgainstStatic(body, best.nx, best.ny, best.p, SHAPE_RESTITUTION, 0.65);

    if (Math.abs(body.vy) < 0.08 && Math.abs(body.omega) < 0.003 && best.ny < 0) {
      body.vy = 0;
      body.omega *= 0.8;
    }
  }

  function solveBallAgainstBody(c, body) {
    const pts = bodyPoints(body, 1);
    let best = null;
    const radius = c.r + body.strokeRadius;

    for (let i = 0; i < pts.length - 1; i++) {
      const q = closestOnSegment(c, pts[i], pts[i + 1]);
      const dx = c.x - q.x;
      const dy = c.y - q.y;
      const d2 = dx * dx + dy * dy;

      if (d2 >= radius * radius) continue;

      const d = Math.sqrt(d2) || 0.001;

      if (!best || radius - d > best.penetration) {
        let nx = dx / d;
        let ny = dy / d;

        if (d < 0.02) {
          const sx = pts[i + 1].x - pts[i].x;
          const sy = pts[i + 1].y - pts[i].y;
          const sl = hypot(sx, sy) || 1;

          nx = -sy / sl;
          ny = sx / sl;

          if (ny > 0) {
            nx *= -1;
            ny *= -1;
          }
        }

        best = { q, nx, ny, penetration: radius - d };
      }
    }

    if (!best) return;

    const invBall = 1;
    const totalInv = invBall + body.invMass;
    const correction = Math.max(0, best.penetration - 0.02);

    c.x += best.nx * correction * invBall / totalInv;
    c.y += best.ny * correction * invBall / totalInv;

    body.x -= best.nx * correction * body.invMass / totalInv;
    body.y -= best.ny * correction * body.invMass / totalInv;

    const vv = pointVelocity(body, best.q);
    const rvx = c.vx - vv.x;
    const rvy = c.vy - vv.y;
    const vn = dot(rvx, rvy, best.nx, best.ny);

    if (vn < 0) {
      const rx = best.q.x - body.x;
      const ry = best.q.y - body.y;
      const rn = cross(rx, ry, best.nx, best.ny);
      const denom = invBall + body.invMass + rn * rn * body.invInertia;
      const j = -(1 + BALL_RESTITUTION) * vn / Math.max(0.0001, denom);

      c.vx += best.nx * j;
      c.vy += best.ny * j;

      applyBodyImpulse(body, -best.nx * j, -best.ny * j, best.q);

      // Friction tangentielle : la balle roule au lieu de glisser sans fin.
      const tx = -best.ny;
      const ty = best.nx;
      const vAfter = pointVelocity(body, best.q);
      const rvx2 = c.vx - vAfter.x;
      const rvy2 = c.vy - vAfter.y;
      const vt = dot(rvx2, rvy2, tx, ty);
      const rt = cross(rx, ry, tx, ty);
      const denomT = invBall + body.invMass + rt * rt * body.invInertia;
      const jt = clamp(-vt / Math.max(0.0001, denomT), -j * 0.42, j * 0.42);

      c.vx += tx * jt;
      c.vy += ty * jt;

      applyBodyImpulse(body, -tx * jt, -ty * jt, best.q);

      c.lastHit = performance.now();
      spawnSparks(c.x, c.y, 2);
    }
  }

  function solveBodyPairs() {
    for (let i = 0; i < drawnBodies.length; i++) {
      const a = drawnBodies[i];

      for (let j = i + 1; j < drawnBodies.length; j++) {
        const b = drawnBodies[j];

        if (hypot(a.x - b.x, a.y - b.y) > a.bound + b.bound + 10) continue;

        const ap = sampledWorldPoints(a, 11);
        const bp = bodyPoints(b, 2);
        let best = null;
        const radius = a.strokeRadius + b.strokeRadius;

        for (const p of ap) {
          for (let k = 0; k < bp.length - 1; k++) {
            const q = closestOnSegment(p, bp[k], bp[k + 1]);
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const d2 = dx * dx + dy * dy;

            if (d2 >= radius * radius) continue;

            const d = Math.sqrt(d2) || 0.001;

            if (!best || radius - d > best.penetration) {
              best = { p, q, dx, dy, d, penetration: radius - d };
            }
          }
        }

        if (!best) continue;

        const nx = best.dx / best.d;
        const ny = best.dy / best.d;
        const invSum = a.invMass + b.invMass;

        if (invSum <= 0) continue;

        const correction = Math.max(0, best.penetration - 0.03) * 0.72;

        a.x += nx * correction * a.invMass / invSum;
        a.y += ny * correction * a.invMass / invSum;

        b.x -= nx * correction * b.invMass / invSum;
        b.y -= ny * correction * b.invMass / invSum;

        const va = pointVelocity(a, best.p);
        const vb = pointVelocity(b, best.q);
        const vn = dot(va.x - vb.x, va.y - vb.y, nx, ny);

        if (vn < 0) {
          const raX = best.p.x - a.x;
          const raY = best.p.y - a.y;
          const rbX = best.q.x - b.x;
          const rbY = best.q.y - b.y;

          const ran = cross(raX, raY, nx, ny);
          const rbn = cross(rbX, rbY, nx, ny);

          const denom = invSum
            + ran * ran * a.invInertia
            + rbn * rbn * b.invInertia;

          const impulse = -(1 + SHAPE_RESTITUTION) * vn / Math.max(0.0001, denom);

          applyBodyImpulse(a, nx * impulse, ny * impulse, best.p);
          applyBodyImpulse(b, -nx * impulse, -ny * impulse, best.q);
        }
      }
    }
  }

  function collideBallRect(c, r) {
    const left = r.x;
    const right = r.x + r.w;
    const top = r.y;
    const bottom = r.y + r.h;

    const qx = clamp(c.x, left, right);
    const qy = clamp(c.y, top, bottom);

    let dx = c.x - qx;
    let dy = c.y - qy;

    const d2 = dx * dx + dy * dy;

    if (d2 >= c.r * c.r) return;

    let nx;
    let ny;

    if (d2 < 0.0001) {
      const options = [
        { depth: Math.abs(c.x - left), nx: -1, ny: 0, x: left - c.r, y: c.y },
        { depth: Math.abs(right - c.x), nx: 1, ny: 0, x: right + c.r, y: c.y },
        { depth: Math.abs(c.y - top), nx: 0, ny: -1, x: c.x, y: top - c.r },
        { depth: Math.abs(bottom - c.y), nx: 0, ny: 1, x: c.x, y: bottom + c.r }
      ].sort((a, b) => a.depth - b.depth);

      const opt = options[0];

      c.x = opt.x;
      c.y = opt.y;
      nx = opt.nx;
      ny = opt.ny;
    } else {
      const d = Math.sqrt(d2);

      nx = dx / d;
      ny = dy / d;

      c.x = qx + nx * c.r;
      c.y = qy + ny * c.r;
    }

    const vn = dot(c.vx, c.vy, nx, ny);

    if (vn < 0) {
      c.vx -= (1 + 0.32) * vn * nx;
      c.vy -= (1 + 0.32) * vn * ny;

      c.vx *= 0.985;
      c.vy *= 0.985;

      spawnSparks(c.x, c.y, 2);
    }
  }

  function collideBallWithDraft(c, a, b) {
    const q = closestOnSegment(c, a, b);
    const dx = c.x - q.x;
    const dy = c.y - q.y;
    const radius = c.r + LINE_RADIUS;
    const d2 = dx * dx + dy * dy;

    if (d2 >= radius * radius) return;

    const d = Math.sqrt(d2) || 0.001;

    let nx = dx / d;
    let ny = dy / d;

    if (d < 0.02) {
      const sx = b.x - a.x;
      const sy = b.y - a.y;
      const sl = hypot(sx, sy) || 1;

      nx = -sy / sl;
      ny = sx / sl;

      if (ny > 0) {
        nx *= -1;
        ny *= -1;
      }
    }

    // La ligne en cours est déjà solide.
    const penetration = radius - d;

    c.x += nx * (penetration + 0.02);
    c.y += ny * (penetration + 0.02);

    const vn = dot(c.vx, c.vy, nx, ny);

    if (vn < 0) {
      const restitution = 0.28;

      c.vx -= (1 + restitution) * vn * nx;
      c.vy -= (1 + restitution) * vn * ny;

      c.vx *= 0.985;
      c.vy *= 0.985;
    }
  }

  function updatePhysics() {
    if (completed || allCompleted) {
      updateParticles();
      return;
    }

    // Le joueur peut dessiner pendant le compte à rebours de 3 secondes.
    if (countdownActive) {
      if (performance.now() < countdownEndsAt) {
        updateParticles();
        return;
      }

      countdownActive = false;
      ballAwake = true;
      notify('C’est parti ! La physique est activée.');
    }

    const data = lvl();

    if (ballAwake) {
      ball.vy = clamp(ball.vy + GRAVITY, -14, 14);
      ball.vx = clamp(ball.vx * 0.999, -12, 12);

      ball.x += ball.vx;
      ball.y += ball.vy;

      ball.vx *= 0.997;
    }

    // Les bâtons sont des corps rigides : ils se déplacent et tournent ensemble.
    for (const body of drawnBodies) {
      body.vy = clamp(body.vy + GRAVITY, -13, 13);
      body.vx *= 0.999;
      body.omega *= 0.998;

      body.x += body.vx;
      body.y += body.vy;
      body.angle += body.omega;
      body.age++;

      // Deux passes de collision pour stabiliser les appuis sur les blocs.
      for (let pass = 0; pass < 2; pass++) {
        for (const obs of data.obstacles) {
          solveBodyAgainstRect(body, obs);
        }

        solveBodyAgainstBounds(body);
      }

      if (Math.abs(body.vx) < 0.012) body.vx = 0;
      if (Math.abs(body.vy) < 0.012) body.vy = 0;
      if (Math.abs(body.omega) < 0.0004) body.omega = 0;
    }

    // Les traits se heurtent et peuvent s'empiler entre eux.
    solveBodyPairs();

    // Le trait sous le pointeur est immédiatement solide.
    if (ballAwake && drawing && draftPoints.length > 1) {
      for (let i = 0; i < draftPoints.length - 1; i++) {
        collideBallWithDraft(ball, draftPoints[i], draftPoints[i + 1]);
      }
    }

    // La balle entre en collision avec les traits mobiles et les obstacles.
    if (ballAwake) {
      for (const body of drawnBodies) {
        solveBallAgainstBody(ball, body);
      }

      for (const obs of data.obstacles) {
        collideBallRect(ball, obs);
      }

      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx) * 0.4;
      }

      if (ball.x + ball.r > W) {
        ball.x = W - ball.r;
        ball.vx = -Math.abs(ball.vx) * 0.4;
      }

      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy) * 0.4;
      }

      // Sol avec friction : la balle roule plutôt que de réinitialiser le niveau.
      if (ball.y + ball.r > FLOOR_Y) {
        ball.y = FLOOR_Y - ball.r;

        if (ball.vy > 0.25) ball.vy = -ball.vy * 0.12;
        else ball.vy = 0;

        ball.vx *= 0.90;

        if (Math.abs(ball.vx) < 0.035) ball.vx = 0;
      }

      if (ball.y > H + 45) {
        resetLevel(true);
        notify('La balle est tombée : réessaie !');
        return;
      }

      if (inGoal(ball, data.goal)) {
        winLevel();
      }
    }

    shake *= 0.84;
    updateParticles();
  }

  function inGoal(c, g) {
    // Zone d'arrivée de la cible.
    return c.x > g.x + 8 &&
      c.x < g.x + g.w - 8 &&
      c.y > g.y + 8 &&
      c.y < g.y + g.h - 1;
  }

  function winLevel() {
    if (completed || allCompleted) return;

    completed = true;
    completedLevels.add(currentLevel);
    spawnConfetti(ball.x, ball.y, 44);
    updateProgressUI();
    showLevelIntro('success');

    const score = (currentLevel + 1) * 100
      + Math.max(0, (lvl().maxStrokes - drawnBodies.length) * 2);

    if (typeof window.updateHighScore === 'function') {
      try {
        window.updateHighScore('physics', score);
      } catch (e) {
        console.warn(e);
      }
    }

    levelTimer = setTimeout(() => {
      if (!active) return;

      if (currentLevel + 1 < LEVELS.length) {
        currentLevel++;
        resetLevel(false);
        showLevelIntro('next');
      } else {
        allCompleted = true;
        ballAwake = false;

        updateHint();
        updateProgressUI();
        showLevelIntro('complete');

        if (typeof window.triggerGameOver === 'function') {
          try {
            window.triggerGameOver(score);
          } catch (e) {
            console.warn(e);
          }
        }
      }
    }, 1250);
  }

  function spawnSparks(x, y, count) {
    const colors = ['#f1ad48', '#f6d88a', '#d9dee3'];

    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2;
      const s = 0.5 + random() * 1.8;

      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 12 + random() * 9,
        maxLife: 21,
        size: 1 + random() * 1.5,
        color: colors[i % colors.length],
        type: 'dot'
      });
    }
  }

  function spawnConfetti(x, y, count) {
    const colors = ['#ef6f4b', '#38a89b', '#5c79cf', '#e5b448'];

    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (random() - 0.5) * 7,
        vy: -1 - random() * 5,
        life: 35 + random() * 35,
        maxLife: 70,
        size: 2 + random() * 3,
        color: colors[i % colors.length],
        rotation: random() * Math.PI,
        spin: (random() - 0.5) * 0.2,
        type: 'confetti'
      });
    }
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.type === 'confetti' ? 0.08 : 0.06;
      p.vx *= 0.99;
      p.life--;

      if (p.rotation !== undefined) {
        p.rotation += p.spin;
      }
    }
  }

  // ------------------------------ INTERFACE NIVEAUX ------------------------------

  function mountGameUI() {
    const old = document.getElementById('physics-logic-ui');
    if (old) old.remove();

    const oldStyle = document.getElementById('physics-logic-ui-style');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'physics-logic-ui-style';

    style.textContent = `
      #physics-logic-ui {
        position:absolute;
        inset:0;
        z-index:9999;
        pointer-events:none;
        font-family:system-ui,-apple-system,sans-serif;
        color:#222b34;
      }

      #physics-logic-ui .pl-click {
        pointer-events:auto;
        cursor:pointer;
        font:700 12px system-ui,sans-serif;
        border:1px solid #d7dde2;
        border-radius:9px;
        color:#29313a;
        background:#fff;
        padding:9px 12px;
        box-shadow:0 2px 8px #18232c12;
        transition:transform .15s,background .15s;
      }

      #physics-logic-ui .pl-click:hover {
        background:#f2f5f7;
        transform:translateY(-1px);
      }

      #physics-logic-ui .pl-topbar {
        position:absolute;
        z-index:20;
        top:10px;
        right:10px;
        display:flex;
        gap:7px;
        align-items:center;
        pointer-events:auto;
      }

      #physics-logic-ui .pl-progress-btn {
        background:#202933;
        color:#fff;
        border-color:#202933;
      }

      #physics-logic-ui .pl-progress-btn:hover {
        background:#364451;
      }

      #physics-logic-ui .pl-stroke-meter {
        position:absolute;
        top:48px;
        right:10px;
        width:166px;
        padding:7px 9px;
        background:rgba(255,255,255,.94);
        border:1px solid #d7dde2;
        border-radius:9px;
        box-shadow:0 2px 8px #18232c12;
        pointer-events:none;
      }

      #physics-logic-ui .pl-stroke-label {
        display:flex;
        justify-content:space-between;
        gap:8px;
        font-size:9px;
        font-weight:900;
        letter-spacing:.06em;
        color:#5b6570;
        margin-bottom:5px;
      }

      #physics-logic-ui .pl-stroke-track {
        width:100%;
        height:5px;
        background:#e6eaee;
        border-radius:9px;
        overflow:hidden;
      }

      #physics-logic-ui .pl-stroke-track i {
        display:block;
        height:100%;
        width:100%;
        background:#4e91e8;
        transition:width .1s linear;
      }

      #physics-logic-ui .pl-modal {
        position:absolute;
        z-index:10;
        inset:0;
        display:flex;
        justify-content:center;
        align-items:center;
        padding:16px;
        background:rgba(241,244,247,.80);
        backdrop-filter:blur(3px);
        pointer-events:auto;
        opacity:1;
        transition:opacity .22s;
      }

      #physics-logic-ui .pl-modal.pl-hidden {
        display:none;
      }

      #physics-logic-ui .pl-panel {
        width:min(390px,100%);
        max-height:92%;
        overflow:auto;
        background:#fff;
        border:1px solid #dfe4e8;
        border-radius:16px;
        padding:22px;
        box-shadow:0 18px 60px #23334420;
        animation:pl-pop .25s ease-out;
      }

      #physics-logic-ui .pl-kicker {
        font-size:10px;
        text-transform:uppercase;
        font-weight:900;
        letter-spacing:.15em;
        color:#78838d;
      }

      #physics-logic-ui .pl-panel h2 {
        font-size:24px;
        line-height:1.1;
        margin:8px 0 10px;
        letter-spacing:-.04em;
      }

      #physics-logic-ui .pl-panel p {
        font-size:13px;
        line-height:1.55;
        color:#5a6570;
        margin:8px 0 12px;
      }

      #physics-logic-ui .pl-tip {
        padding:10px 11px;
        background:#f3f6f8;
        border-radius:9px;
        font-size:11px;
        line-height:1.5;
        color:#52616c;
        margin:12px 0 15px;
      }

      #physics-logic-ui .pl-primary {
        width:100%;
        background:#29343e;
        color:#fff;
        border-color:#29343e;
        padding:12px;
      }

      #physics-logic-ui .pl-primary:hover {
        background:#40505e;
      }

      #physics-logic-ui .pl-level-list {
        display:flex;
        flex-direction:column;
        gap:7px;
        margin:16px 0;
      }

      #physics-logic-ui .pl-level-row {
        display:flex;
        align-items:center;
        gap:10px;
        text-align:left;
        width:100%;
        padding:10px;
        border:1px solid #e1e5e8;
        background:#fff;
        border-radius:10px;
        color:#303841;
        pointer-events:auto;
        cursor:pointer;
      }

      #physics-logic-ui .pl-level-row:disabled {
        opacity:.48;
        cursor:not-allowed;
      }

      #physics-logic-ui .pl-level-row.pl-current {
        border-color:#4e91e8;
        background:#eff6ff;
      }

      #physics-logic-ui .pl-level-row.pl-done {
        border-color:#acd7c0;
        background:#f1faf5;
      }

      #physics-logic-ui .pl-number {
        width:27px;
        height:27px;
        flex:0 0 27px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:#edf0f2;
        font-size:11px;
        font-weight:900;
      }

      #physics-logic-ui .pl-current .pl-number {
        background:#4e91e8;
        color:#fff;
      }

      #physics-logic-ui .pl-done .pl-number {
        background:#3d9c70;
        color:#fff;
      }

      #physics-logic-ui .pl-level-name {
        flex:1;
        font-size:12px;
        font-weight:800;
      }

      #physics-logic-ui .pl-level-status {
        font-size:9px;
        text-transform:uppercase;
        font-weight:900;
        color:#78838d;
      }

      #physics-logic-ui .pl-done .pl-level-status {
        color:#31825d;
      }

      #physics-logic-ui .pl-current .pl-level-status {
        color:#3378d0;
      }

      @keyframes pl-pop {
        from {
          opacity:0;
          transform:translateY(10px) scale(.97);
        }
        to {
          opacity:1;
          transform:translateY(0) scale(1);
        }
      }

      @media(max-width:520px) {
        #physics-logic-ui .pl-topbar {
          top:5px;
          right:5px;
          gap:4px;
        }

        #physics-logic-ui .pl-click {
          padding:7px 8px;
          font-size:10px;
        }

        #physics-logic-ui .pl-panel {
          padding:17px;
        }

        #physics-logic-ui .pl-panel h2 {
          font-size:21px;
        }

        #physics-logic-ui .pl-stroke-meter {
          top:42px;
          right:5px;
          width:145px;
        }
      }
    `;

    document.head.appendChild(style);

    uiHost = canvas.parentElement || document.body;
    originalHostPosition = uiHost.style.position;
    hostPositionChanged = false;

    if (
      uiHost !== document.body &&
      getComputedStyle(uiHost).position === 'static'
    ) {
      uiHost.style.position = 'relative';
      hostPositionChanged = true;
    }

    uiRoot = document.createElement('div');
    uiRoot.id = 'physics-logic-ui';
    uiRoot.style.position = uiHost === document.body ? 'fixed' : 'absolute';

    uiRoot.innerHTML = `
      <div class="pl-topbar">
        <button type="button" class="pl-click" id="pl-restart">↻ Recommencer</button>
        <button type="button" class="pl-click pl-progress-btn" id="pl-open-progress">NIVEAUX 0/4 ▦</button>
      </div>

      <div class="pl-stroke-meter" aria-label="Traits restants">
        <div class="pl-stroke-label">
          <span>TRAITS RESTANTS</span>
          <span id="pl-stroke-value">1 / 1</span>
        </div>
        <div class="pl-stroke-track">
          <i id="pl-stroke-bar"></i>
        </div>
      </div>

      <div class="pl-modal" id="pl-intro">
        <div class="pl-panel">
          <div class="pl-kicker" id="pl-intro-kicker">NIVEAU 1 / 4</div>
          <h2 id="pl-intro-title">Le passage</h2>
          <p id="pl-intro-description"></p>
          <div class="pl-tip" id="pl-intro-tip">
            La balle bouge dès le début. Tu peux dessiner pendant qu’elle tombe :
            ton trait en cours la pousse déjà.
          </div>
          <button type="button" class="pl-click pl-primary" id="pl-play">JOUER →</button>
        </div>
      </div>

      <div class="pl-modal pl-hidden" id="pl-progress">
        <div class="pl-panel">
          <div class="pl-kicker">TA PROGRESSION</div>
          <h2>Tous les niveaux</h2>
          <p id="pl-progress-summary">0 niveau terminé sur 4</p>
          <div class="pl-level-list" id="pl-level-list"></div>
          <button type="button" class="pl-click pl-primary" id="pl-close-progress">
            RETOURNER AU JEU
          </button>
        </div>
      </div>
    `;

    uiHost.appendChild(uiRoot);

    uiRoot.querySelector('#pl-play').addEventListener('click', startLevelFromIntro);
    uiRoot.querySelector('#pl-open-progress').addEventListener('click', openProgress);
    uiRoot.querySelector('#pl-close-progress').addEventListener('click', closeProgress);

    uiRoot.querySelector('#pl-restart').addEventListener('click', () => {
      if (allCompleted) {
        currentLevel = 0;
        completedLevels.clear();
      }

      resetLevel(false);
      showLevelIntro('restart');
    });

    updateProgressUI();
    updateStrokeUI();
  }

  function showLevelIntro(kind) {
    if (!uiRoot) return;

    lastIntroKind = kind;
    progressReturnToIntro = false;
    levelIntroOpen = true;
    progressOpen = false;

    const intro = uiRoot.querySelector('#pl-intro');
    const progress = uiRoot.querySelector('#pl-progress');

    progress.classList.add('pl-hidden');
    intro.classList.remove('pl-hidden');

    const title = uiRoot.querySelector('#pl-intro-title');
    const kicker = uiRoot.querySelector('#pl-intro-kicker');
    const description = uiRoot.querySelector('#pl-intro-description');
    const tip = uiRoot.querySelector('#pl-intro-tip');
    const button = uiRoot.querySelector('#pl-play');

    if (kind === 'success') {
      kicker.textContent = 'NIVEAU VALIDÉ';
      title.textContent = 'Bien joué !';
      description.textContent = 'La balle a atteint la cible. Le niveau suivant arrive…';
      tip.textContent = 'Ouvre « Niveaux » en haut à droite pour voir les défis et ceux déjà terminés.';
      button.textContent = 'CONTINUER…';
      button.disabled = true;
      button.style.opacity = '0.5';
    } else if (kind === 'complete' || allCompleted) {
      kicker.textContent = 'PARCOURS TERMINÉ';
      title.textContent = 'Bravo, tu as tout terminé !';
      description.textContent = 'Tu as réussi les quatre énigmes. Tu peux rejouer le parcours ou consulter tes niveaux.';
      tip.textContent = 'La balle bouge pendant que tu dessines. Quand tu relâches, le trait devient un bâton qui tombe et tourne.';
      button.textContent = 'REJOUER →';
      button.disabled = false;
      button.style.opacity = '1';
    } else {
      kicker.textContent = `NIVEAU ${currentLevel + 1} / ${LEVELS.length}`;
      title.textContent = lvl().title.replace(/^\d+\s*·\s*/, '');
      description.textContent = lvl().instruction;
      tip.textContent = `Après JOUER, tu as 3 secondes pour dessiner. Ce niveau autorise ${lvl().maxStrokes} trait(s), sans limite de longueur. Puis la physique démarre automatiquement.`;
      button.textContent = kind === 'next' ? 'COMMENCER CE NIVEAU →' : 'JOUER →';
      button.disabled = false;
      button.style.opacity = '1';
    }

    updateProgressUI();
  }

  function startLevelFromIntro() {
    if (allCompleted) {
      currentLevel = 0;
      completedLevels.clear();
      allCompleted = false;
      resetLevel(false);
    }

    levelIntroOpen = false;
    progressOpen = false;
    ballAwake = false;
    countdownActive = true;
    countdownEndsAt = performance.now() + START_DELAY_MS;

    if (uiRoot) {
      uiRoot.querySelector('#pl-intro').classList.add('pl-hidden');
      uiRoot.querySelector('#pl-progress').classList.add('pl-hidden');
    }

    // Pendant trois secondes, le joueur prépare son trait sans gravité.
    lastTime = performance.now();
    accumulator = 0;
    updateHint();

    notify('3… Dessine ton trait maintenant !');
  }

  function openProgress() {
    if (!uiRoot) return;

    progressReturnToIntro = levelIntroOpen;
    progressOpen = true;
    levelIntroOpen = false;

    uiRoot.querySelector('#pl-intro').classList.add('pl-hidden');
    uiRoot.querySelector('#pl-progress').classList.remove('pl-hidden');

    updateProgressUI();
  }

  function closeProgress() {
    if (!uiRoot) return;

    progressOpen = false;
    uiRoot.querySelector('#pl-progress').classList.add('pl-hidden');
    lastTime = performance.now();

    if (progressReturnToIntro) {
      showLevelIntro(lastIntroKind);
      return;
    }

    levelIntroOpen = false;
  }

  function updateProgressUI() {
    if (!uiRoot) return;

    const button = uiRoot.querySelector('#pl-open-progress');
    const summary = uiRoot.querySelector('#pl-progress-summary');
    const list = uiRoot.querySelector('#pl-level-list');

    button.textContent = `NIVEAUX ${completedLevels.size}/${LEVELS.length} ▦`;

    summary.textContent =
      `${completedLevels.size} niveau${completedLevels.size === 1 ? '' : 'x'} terminé${completedLevels.size === 1 ? '' : 's'} sur ${LEVELS.length}`;

    list.innerHTML = '';

    LEVELS.forEach((levelData, index) => {
      const done = completedLevels.has(index);
      const current = index === currentLevel && !allCompleted && !done;
      const unlocked = done || index <= currentLevel;

      const row = document.createElement('button');
      row.type = 'button';
      row.className =
        'pl-level-row' +
        (done ? ' pl-done' : '') +
        (current ? ' pl-current' : '');

      row.disabled = !unlocked;

      const number = document.createElement('span');
      number.className = 'pl-number';
      number.textContent = done ? '✓' : String(index + 1);

      const name = document.createElement('span');
      name.className = 'pl-level-name';
      name.textContent =
        `${levelData.title.replace(/^\d+\s*·\s*/, '')} · ${levelData.maxStrokes} trait${levelData.maxStrokes > 1 ? 's' : ''}`;

      const state = document.createElement('span');
      state.className = 'pl-level-status';
      state.textContent = done
        ? 'Terminé'
        : current
          ? 'En cours'
          : unlocked
            ? 'Disponible'
            : 'Verrouillé';

      row.append(number, name, state);

      row.addEventListener('click', () => {
        if (!unlocked) return;

        currentLevel = index;
        allCompleted = false;

        resetLevel(false);
        showLevelIntro('jump');
      });

      list.appendChild(row);
    });
  }

  function updateStrokeUI() {
    if (!uiRoot) return;

    const maximum = lvl().maxStrokes;
    const draftCounts = drawing && draftPoints.length > 1 ? 1 : 0;
    const used = drawnBodies.length + draftCounts;
    const remaining = Math.max(0, maximum - used);

    const label = uiRoot.querySelector('#pl-stroke-value');
    const bar = uiRoot.querySelector('#pl-stroke-bar');

    if (label) {
      label.textContent = `${remaining} / ${maximum}`;
    }

    if (bar) {
      bar.style.width = `${(remaining / maximum) * 100}%`;
      bar.style.background = remaining <= 0 ? '#db6b55' : '#4e91e8';
    }
  }

  // ------------------------------ STYLE MINIMAL ------------------------------

  function drawBackground() {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0.5; x <= W; x += 20) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }

    for (let y = 0.5; y <= H; y += 20) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }

    ctx.stroke();

    // Bas du monde, très discret.
    ctx.fillStyle = '#e5e8eb';
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    ctx.fillStyle = '#b8c0c7';
    ctx.fillRect(0, FLOOR_Y, W, 2);
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function drawObstacle(o) {
    ctx.save();

    ctx.fillStyle = '#e5e8eb';
    roundRect(o.x, o.y, o.w, o.h, 3);
    ctx.fill();

    ctx.strokeStyle = '#aab2b9';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Petit reflet discret.
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(o.x + 3, o.y + 2);
    ctx.lineTo(o.x + o.w - 3, o.y + 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawGoal(g, t) {
    ctx.save();

    const pulse = 1 + Math.sin(t / 240) * 0.025;

    ctx.translate(g.x + g.w / 2, g.y + g.h / 2);
    ctx.scale(pulse, pulse);

    const x = -g.w / 2;
    const y = -g.h / 2;

    ctx.fillStyle = 'rgba(63,166,119,.08)';
    roundRect(x + 5, y + 5, g.w - 10, g.h - 8, 6);
    ctx.fill();

    // Coupe ouverte en haut.
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#49a87d';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + 3, y + g.h - 3);
    ctx.lineTo(x + g.w - 3, y + g.h - 3);
    ctx.lineTo(x + g.w - 3, y + 3);
    ctx.stroke();

    ctx.fillStyle = '#409c72';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CIBLE', 0, y + g.h + 13);

    ctx.restore();
  }

  function drawBody(body, current = false) {
    const points = bodyPoints(body, 1);

    if (points.length < 2) return;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Ombre légère.
    ctx.beginPath();
    ctx.moveTo(points[0].x + 1, points[0].y + 2);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x + 1, points[i].y + 2);
    }

    ctx.strokeStyle = 'rgba(31,40,49,.12)';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.strokeStyle = current ? '#4e91e8' : '#343b43';
    ctx.lineWidth = current ? 5 : 6;
    ctx.stroke();

    ctx.restore();
  }

  function drawBall() {
    ctx.save();

    ctx.fillStyle = 'rgba(22,32,43,.10)';
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, FLOOR_Y - 1, 11, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f06b3f';
    ctx.strokeStyle = '#b94b2d';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.beginPath();
    ctx.arc(ball.x - 3.3, ball.y - 4, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();

      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;

      if (p.type === 'confetti') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawOverlay() {
    if (countdownActive) {
      const remaining = Math.max(
        0,
        (countdownEndsAt - performance.now()) / 1000
      );

      const number = Math.max(1, Math.ceil(remaining));

      ctx.save();

      ctx.fillStyle = 'rgba(255,255,255,.94)';
      roundRect(218, 40, 204, 66, 10);
      ctx.fill();

      ctx.strokeStyle = '#d5dce2';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#27323b';
      ctx.textAlign = 'center';
      ctx.font = '800 12px system-ui,sans-serif';
      ctx.fillText('DESSINE TON TRAIT !', W / 2, 61);

      ctx.font = '900 25px system-ui,sans-serif';
      ctx.fillText(String(number), W / 2, 91);

      ctx.restore();
    } else if (!ballAwake && !completed && !allCompleted) {
      ctx.fillStyle = '#68737d';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'La balle attend le départ : prépare ton trait.',
        W / 2,
        22
      );
    }

    if (completed || allCompleted) {
      ctx.fillStyle = 'rgba(248,249,250,.78)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#28323b';
      ctx.textAlign = 'center';
      ctx.font = '700 24px system-ui, sans-serif';

      ctx.fillText(
        allCompleted ? 'Tous les niveaux terminés !' : 'Niveau réussi !',
        W / 2,
        H / 2 - 8
      );

      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#5a6570';

      ctx.fillText(
        allCompleted
          ? 'Appuie sur R pour rejouer'
          : 'Préparation du niveau suivant…',
        W / 2,
        H / 2 + 20
      );
    }
  }

  function draw() {
    if (!ctx || !canvas) return;

    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();

    if (shake > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    drawBackground();

    const data = lvl();

    drawGoal(data.goal, performance.now());
    data.obstacles.forEach(drawObstacle);

    for (const body of drawnBodies) {
      drawBody(body, false);
    }

    if (draftPoints.length > 1) {
      ctx.save();

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4e91e8';
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.moveTo(draftPoints[0].x, draftPoints[0].y);

      for (let i = 1; i < draftPoints.length; i++) {
        ctx.lineTo(draftPoints[i].x, draftPoints[i].y);
      }

      ctx.stroke();
      ctx.restore();
    }

    drawParticles();
    drawBall();
    drawOverlay();

    ctx.restore();
  }

  function frame(now) {
    if (!active || disposed) return;

    rafId = requestAnimationFrame(frame);

    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    accumulator += dt;

    let steps = 0;

    while (accumulator >= FIXED_DT && steps < 4) {
      if (!levelIntroOpen && !progressOpen) {
        updatePhysics();
      } else {
        updateParticles();
      }

      accumulator -= FIXED_DT;
      steps++;
    }

    if (steps === 4 && accumulator > FIXED_DT * 3) {
      accumulator = FIXED_DT;
    }

    draw();
  }

  // Fonctions attendues par le site.
  window.startPhysicsGame = startPhysicsGame;
  window._physicsCleanup = stopPhysicsGame;
})();