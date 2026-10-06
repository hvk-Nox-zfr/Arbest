// ============================================================
// CYBER SURVIVORS — survivor-like : tu tires automatiquement, tu ramasses
// l'XP, tu montes de niveau et tu choisis une amélioration. Vagues sans fin.
// Contrôles : ZQSD / WASD / flèches, ou glisser le doigt (joystick flottant).
// ============================================================
function startSurvivorGame() {
  if (window.GameMobile) GameMobile.reset();
  if (window._survCleanup) window._survCleanup();

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  let lastSnd = 0;
  const snd = (f, d, t) => {
    const now = performance.now();
    if (now - lastSnd < 70 || typeof playSound !== 'function') return;
    lastSnd = now;
    playSound(f, d, t);
  };

  // ---------- état ----------
  const P = {
    x: 0, y: 0, r: 11, hp: 100, maxHp: 100, speed: 2.4, dmg: 12, rate: 0.6, cool: 0,
    shots: 1, pierce: 0, magnet: 70, blades: 0, ang: 0, regen: 0, inv: 0,
    xp: 0, lvl: 1, need: 5
  };
  let enemies = [], bullets = [], gems = [], parts = [];
  let time = 0, kills = 0, bonus = 0, score = 0;
  let spawnT = 0, bossT = 90, flash = 0;
  let over = false, deathT = 0, stopped = false, pendingLevels = 0;
  let choices = null;
  let lastTs = 0, scoreShown = -1;

  const keys = {};
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

  const TYPES = {
    grunt: { r: 11, hp: 20, sp: 0.9, dmg: 8, xp: 1, col: '#ff0055' },
    fast:  { r: 8,  hp: 10, sp: 1.75, dmg: 6, xp: 1, col: '#ffe600' },
    tank:  { r: 17, hp: 90, sp: 0.6, dmg: 14, xp: 4, col: '#9d00ff' },
    boss:  { r: 32, hp: 700, sp: 0.75, dmg: 22, xp: 30, col: '#ff6a00' }
  };

  const UPGRADES = [
    { name: 'DÉGÂTS +25%', desc: 'Tes tirs font plus mal.', apply: () => { P.dmg *= 1.25; } },
    { name: 'CADENCE +20%', desc: 'Tu tires plus vite.', apply: () => { P.rate *= 0.8; } },
    { name: 'TIR MULTIPLE', desc: '+1 projectile par salve.', ok: () => P.shots < 6, apply: () => { P.shots++; } },
    { name: 'PERFORANT', desc: 'Les tirs traversent +1 ennemi.', apply: () => { P.pierce++; } },
    { name: 'VITESSE +10%', desc: 'Tu cours plus vite.', ok: () => P.speed < 4.2, apply: () => { P.speed *= 1.1; } },
    { name: 'PV MAX +25', desc: 'Plus de vie, et tu te soignes de 25.', apply: () => { P.maxHp += 25; P.hp += 25; } },
    { name: 'AIMANT +50%', desc: "Ramasse l'XP de plus loin.", apply: () => { P.magnet *= 1.5; } },
    { name: 'LAMES ORBITALES', desc: '+1 lame qui tourne autour de toi.', ok: () => P.blades < 5, apply: () => { P.blades++; } },
    { name: 'RÉGÉNÉRATION', desc: '+0,8 PV par seconde.', apply: () => { P.regen += 0.8; } },
    { name: 'SOIN COMPLET', desc: 'Remet tous tes PV.', ok: () => P.hp < P.maxHp * 0.7, apply: () => { P.hp = P.maxHp; } }
  ];

  // ---------- entrées ----------
  const inGame = t => !!t && (t === canvas || (t.closest && !!t.closest('#gm-stage')));
  const pt = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };

  function cardRects() {
    const gap = 12, cw = Math.min(200, (W - gap * 4) / 3), ch = Math.min(150, H * 0.42);
    const total = cw * 3 + gap * 2, x0 = (W - total) / 2, y0 = H / 2 - ch / 2 + 14;
    return [0, 1, 2].map(i => ({ x: x0 + i * (cw + gap), y: y0, w: cw, h: ch }));
  }

  function choose(i) {
    if (!choices || !choices[i]) return;
    choices[i].apply();
    choices = null;
    snd(660, 0.1, 'triangle');
    if (pendingLevels > 0) openChoices();
  }

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (choices) {
      if (e.code === 'Digit1' || e.code === 'Numpad1') choose(0);
      if (e.code === 'Digit2' || e.code === 'Numpad2') choose(1);
      if (e.code === 'Digit3' || e.code === 'Numpad3') choose(2);
    }
  }
  const onKeyUp = e => { keys[e.code] = false; };

  function onPointerDown(e) {
    if (!inGame(e.target)) return;
    const p = pt(e);
    if (choices) {
      cardRects().forEach((c, i) => {
        if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) choose(i);
      });
      return;
    }
    if (joy.id !== null) return;
    joy.id = e.pointerId; joy.ox = joy.x = p.x; joy.oy = joy.y = p.y;
  }
  function onPointerMove(e) {
    if (e.pointerId !== joy.id) return;
    const p = pt(e);
    joy.x = p.x; joy.y = p.y;
    // le joystick suit le doigt s'il s'éloigne trop
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
    if (d > 70) { joy.ox = joy.x - dx / d * 70; joy.oy = joy.y - dy / d * 70; }
  }
  function onPointerUp(e) { if (e.pointerId === joy.id) joy.id = null; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  window._survCleanup = () => {
    stopped = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window._survCleanup = null;
  };

  // ---------- logique ----------
  function openChoices() {
    pendingLevels--;
    const pool = UPGRADES.filter(u => !u.ok || u.ok());
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    choices = pool.slice(0, 3);
    joy.id = null;
    snd(880, 0.15, 'sine');
  }

  function spawnEnemy(forced) {
    if (enemies.length >= 230) return;
    const a = Math.random() * TAU, d = Math.max(W, H) * 0.62 + rand(0, 80);
    let type = forced;
    if (!type) {
      const r = Math.random();
      type = 'grunt';
      if (time > 40 && r < 0.35) type = 'fast';
      if (time > 120 && r < 0.2) type = 'tank';
      if (time > 240 && r < 0.3) type = 'tank';
    }
    const def = TYPES[type], hm = 1 + time / 50;
    enemies.push({
      type, x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, r: def.r,
      hp: def.hp * hm, max: def.hp * hm, sp: def.sp * (1 + Math.min(0.5, time / 400)),
      dmg: def.dmg, xp: def.xp, col: def.col, bc: 0, kx: 0, ky: 0, dead: false
    });
  }

  function burst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      if (parts.length > 260) break;
      const a = Math.random() * TAU, s = rand(0.5, 3.2);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col });
    }
  }

  function killEnemy(e) {
    e.dead = true;
    kills++;
    if (e.type === 'boss') bonus += 500;
    gems.push({ x: e.x, y: e.y, v: e.xp });
    burst(e.x, e.y, e.col, e.type === 'boss' ? 40 : 7);
    snd(e.type === 'boss' ? 180 : 420, 0.05, 'square');
  }

  function fire() {
    let best = null, bd = 430 * 430;
    for (const e of enemies) {
      const dx = e.x - P.x, dy = e.y - P.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return false;
    const base = Math.atan2(best.y - P.y, best.x - P.x);
    for (let i = 0; i < P.shots; i++) {
      const a = base + (i - (P.shots - 1) / 2) * 0.18;
      bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 8.5, vy: Math.sin(a) * 8.5, life: 55, dmg: P.dmg, pierce: P.pierce, hit: new Set() });
    }
    snd(760, 0.03, 'square');
    return true;
  }

  function die() {
    over = true;
    deathT = 0;
    burst(P.x, P.y, '#00f3ff', 50);
    snd(120, 0.4, 'sawtooth');
  }

  function update(dt) {
    const k = dt * 60;
    time += dt;

    // déplacement
    let mx = 0, my = 0;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
    if (joy.id !== null) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
      if (d > 6) { const m = Math.min(1, d / 46); mx += dx / d * m; my += dy / d * m; }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    P.x += mx * P.speed * k;
    P.y += my * P.speed * k;

    P.inv = Math.max(0, P.inv - dt);
    P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
    P.ang += 0.05 * k;
    flash = Math.max(0, flash - dt * 3);

    // tir automatique
    P.cool -= dt;
    if (P.cool <= 0 && fire()) P.cool = P.rate;

    // apparition des ennemis
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = Math.max(0.12, 1.0 - time * 0.006);
      const n = 1 + Math.floor(time / 45);
      for (let i = 0; i < n; i++) spawnEnemy();
    }
    bossT -= dt;
    if (bossT <= 0) { bossT = 90; spawnEnemy('boss'); snd(100, 0.4, 'sawtooth'); }

    // lames orbitales
    const blades = [];
    for (let b = 0; b < P.blades; b++) {
      const a = P.ang + b * TAU / P.blades;
      blades.push({ x: P.x + Math.cos(a) * 56, y: P.y + Math.sin(a) * 56 });
    }

    // ennemis
    for (const e of enemies) {
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.x += dx / d * e.sp * k + e.kx * k;
      e.y += dy / d * e.sp * k + e.ky * k;
      e.kx *= 0.82; e.ky *= 0.82;
      if (e.bc > 0) e.bc -= dt;

      if (d < e.r + P.r && P.inv <= 0 && !over) {
        P.hp -= e.dmg; P.inv = 0.6; flash = 1;
        snd(130, 0.1, 'sawtooth');
        if (P.hp <= 0) { P.hp = 0; die(); }
      }
      if (e.bc <= 0) {
        for (const bl of blades) {
          if (Math.hypot(bl.x - e.x, bl.y - e.y) < e.r + 9) {
            e.hp -= P.dmg * 0.8; e.bc = 0.3;
            e.kx += (e.x - P.x) / d * 2; e.ky += (e.y - P.y) / d * 2;
            if (e.hp <= 0) killEnemy(e);
            break;
          }
        }
      }
    }

    // projectiles
    for (const b of bullets) {
      b.x += b.vx * k; b.y += b.vy * k; b.life -= k;
      if (b.life <= 0) { b.dead = true; continue; }
      for (const e of enemies) {
        if (e.dead || b.hit.has(e)) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) {
          b.hit.add(e);
          e.hp -= b.dmg; e.bc = Math.max(e.bc, 0.05);
          e.kx += b.vx * 0.12; e.ky += b.vy * 0.12;
          if (e.hp <= 0) killEnemy(e);
          if (b.pierce-- <= 0) { b.dead = true; break; }
        }
      }
    }
    enemies = enemies.filter(e => !e.dead);
    bullets = bullets.filter(b => !b.dead);

    // gemmes d'XP
    for (const g of gems) {
      const dx = P.x - g.x, dy = P.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (d < P.magnet) { g.x += dx / d * 5 * k; g.y += dy / d * 5 * k; }
      if (d < P.r + 8) {
        g.dead = true;
        P.xp += g.v;
        snd(900, 0.02, 'sine');
      }
    }
    gems = gems.filter(g => !g.dead);
    if (gems.length > 500) gems.splice(0, gems.length - 500);

    // montée de niveau
    while (P.xp >= P.need) {
      P.xp -= P.need;
      P.lvl++;
      P.need = Math.floor(P.need * 1.35 + 3);
      pendingLevels++;
    }
    if (pendingLevels > 0 && !choices) openChoices();

    // particules
    for (const p of parts) { p.x += p.vx * k; p.y += p.vy * k; p.life -= dt * 2; }
    parts = parts.filter(p => p.life > 0);

    // score
    score = kills * 10 + bonus + Math.floor(time) * 2;
    if (score !== scoreShown) {
      scoreShown = score;
      const el = document.getElementById('current-score');
      if (el) el.innerText = score;
    }
  }

  // ---------- rendu ----------
  function wrapText(text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, y);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 - P.x, H / 2 - P.y);

    // grille infinie
    const gs = 60;
    const x0 = Math.floor((P.x - W / 2) / gs) * gs, y0 = Math.floor((P.y - H / 2) / gs) * gs;
    ctx.strokeStyle = 'rgba(0,243,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x0 + W + gs; x += gs) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + H + gs); }
    for (let y = y0; y <= y0 + H + gs; y += gs) { ctx.moveTo(x0, y); ctx.lineTo(x0 + W + gs, y); }
    ctx.stroke();

    // gemmes
    ctx.fillStyle = '#00ff9d';
    for (const g of gems) {
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - 5); ctx.lineTo(g.x + 4, g.y); ctx.lineTo(g.x, g.y + 5); ctx.lineTo(g.x - 4, g.y);
      ctx.closePath(); ctx.fill();
    }

    // ennemis
    for (const e of enemies) {
      ctx.fillStyle = e.bc > 0.2 ? '#ffffff' : e.col;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      if (e.type === 'tank' || e.type === 'boss') {
        const bw = e.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, bw, 4);
        ctx.fillStyle = '#ff0055'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, bw * Math.max(0, e.hp / e.max), 4);
      }
    }

    // projectiles
    ctx.shadowBlur = 8; ctx.shadowColor = '#ffe600'; ctx.fillStyle = '#ffe600';
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, TAU); ctx.fill(); }

    // lames
    ctx.shadowColor = '#ff00aa'; ctx.fillStyle = '#ff00aa';
    for (let i = 0; i < P.blades; i++) {
      const a = P.ang + i * TAU / P.blades;
      ctx.beginPath(); ctx.arc(P.x + Math.cos(a) * 56, P.y + Math.sin(a) * 56, 8, 0, TAU); ctx.fill();
    }

    // joueur
    if (!over && (P.inv <= 0 || Math.floor(time * 20) % 2 === 0)) {
      ctx.shadowBlur = 16; ctx.shadowColor = '#00f3ff'; ctx.fillStyle = '#00f3ff';
      ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(P.x, P.y, 4, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // barre de vie sous le joueur
    if (!over) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(P.x - 18, P.y + 17, 36, 5);
      ctx.fillStyle = P.hp / P.maxHp > 0.3 ? '#00ff9d' : '#ff0055';
      ctx.fillRect(P.x - 18, P.y + 17, 36 * (P.hp / P.maxHp), 5);
    }

    // particules
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // flash de dégâts
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,0,85,${flash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD : barre d'XP + infos centrées
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, W, 7);
    ctx.fillStyle = '#00ff9d'; ctx.fillRect(0, 0, W * Math.min(1, P.xp / P.need), 7);
    const mm = Math.floor(time / 60), ss = Math.floor(time % 60);
    ctx.font = '700 15px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`NIV ${P.lvl}   •   ${mm}:${String(ss).padStart(2, '0')}   •   ${kills} KO`, W / 2, 28);

    // aide au début
    if (time < 6 && !over) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(W / 2 - 190, H - 70, 380, 44);
      ctx.fillStyle = '#ffe600'; ctx.font = '700 14px "Rajdhani", sans-serif';
      const touch = window.GameMobile && GameMobile.isTouch;
      ctx.fillText(touch ? 'GLISSE LE DOIGT POUR TE DÉPLACER' : 'ZQSD / FLÈCHES POUR TE DÉPLACER', W / 2, H - 52);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TU TIRES TOUT SEUL — SURVIS LE PLUS LONGTEMPS', W / 2, H - 34);
    }

    // joystick flottant
    if (joy.id !== null) {
      ctx.strokeStyle = 'rgba(0,243,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, TAU); ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy) || 1, m = Math.min(46, d);
      ctx.fillStyle = 'rgba(0,243,255,0.45)';
      ctx.beginPath(); ctx.arc(joy.ox + dx / d * m, joy.oy + dy / d * m, 20, 0, TAU); ctx.fill();
    }

    // choix d'amélioration
    if (choices) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe600'; ctx.font = '900 24px "Rajdhani", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`NIVEAU ${P.lvl} !  CHOISIS UNE AMÉLIORATION`, W / 2, cardRects()[0].y - 20);
      cardRects().forEach((c, i) => {
        ctx.fillStyle = 'rgba(9,13,22,0.95)'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 2; ctx.strokeRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = '#00f3ff'; ctx.font = '700 15px "Rajdhani", sans-serif';
        ctx.fillText(`${i + 1}. ${choices[i].name}`, c.x + c.w / 2, c.y + 28);
        ctx.fillStyle = '#d6dbe8'; ctx.font = '600 13px "Rajdhani", sans-serif';
        wrapText(choices[i].desc, c.x + c.w / 2, c.y + 58, c.w - 20, 17);
      });
    }

    // fin de partie
    if (over) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, deathT)})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff0055'; ctx.font = '900 34px "Rajdhani", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ÉLIMINÉ !', W / 2, H / 2);
    }
  }

  // ---------- boucle ----------
  function loop(ts) {
    if (stopped) return;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;

    if (over) {
      deathT += dt;
      for (const p of parts) { p.x += p.vx; p.y += p.vy; p.life -= dt * 1.5; }
      parts = parts.filter(p => p.life > 0);
      draw();
      if (deathT >= 1.1) {
        stopped = true;
        if (typeof triggerGameOver === 'function') triggerGameOver(score);
        return;
      }
    } else {
      if (!choices) update(dt);
      draw();
    }
    currentGameLoop = requestAnimationFrame(loop);
  }

  if (window.GameMobile) GameMobile.start('survivors', { hint: true });
  currentGameLoop = requestAnimationFrame(loop);
}
