window.startDadaGame = function () {
  if (window.__dadaStop) window.__dadaStop();
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // ================= CONSTANTES & ÉTAT =================
  const TRACK_LEN = 52;
  const START_POS = [0, 13, 26, 39]; // Bleu (0), Rouge (1), Vert (2), Jaune (3)
  const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04']; // Couleurs franches et lisibles
  const LIGHT_COLORS = ['#dbeafe', '#fee2e2', '#dcfce7', '#fef9c3'];
  const PLAYER_NAMES = ['BLEU (TOI)', 'ROUGE (IA)', 'VERT (IA)', 'JAUNE (IA)'];

  // Coordonnées de la piste (52 cases)
  const trackCoords = [];
  function buildTrack() {
    const ox = 150, oy = 20, sz = 24;
    const path = [
      [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
      [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
      [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],
      [6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
      [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],
      [10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
      [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],
      [8,10],[8,11],[8,12],[8,13],[8,14],[7,14]
    ];
    path.forEach(([gx, gy]) => {
      trackCoords.push({ x: ox + gx * sz + sz / 2, y: oy + gy * sz + sz / 2 });
    });
  }
  buildTrack();

  // Écuries
  const stables = [
    [{ x: 180, y: 320 }, { x: 210, y: 320 }], // Bleu
    [{ x: 180, y: 50 },  { x: 210, y: 50 }],  // Rouge
    [{ x: 450, y: 50 },  { x: 480, y: 50 }],  // Vert
    [{ x: 450, y: 320 }, { x: 480, y: 320 }]  // Jaune
  ];

  // Escaliers finaux
  const stairs = [
    Array.from({ length: 6 }, (_, i) => ({ x: 318, y: 332 - i * 24 })), // Bleu
    Array.from({ length: 6 }, (_, i) => ({ x: 174 + i * 24, y: 188 })), // Rouge
    Array.from({ length: 6 }, (_, i) => ({ x: 318, y: 44 + i * 24 })),  // Vert
    Array.from({ length: 6 }, (_, i) => ({ x: 462 - i * 24, y: 188 }))  // Jaune
  ];

  let players = [
    { id: 0, isAI: false, pawns: [{ state: 'home', pos: -1 }, { state: 'home', pos: -1 }] },
    { id: 1, isAI: true,  pawns: [{ state: 'home', pos: -1 }, { state: 'home', pos: -1 }] },
    { id: 2, isAI: true,  pawns: [{ state: 'home', pos: -1 }, { state: 'home', pos: -1 }] },
    { id: 3, isAI: true,  pawns: [{ state: 'home', pos: -1 }, { state: 'home', pos: -1 }] }
  ];

  let turn = 0;
  let diceValue = 0;
  let canRoll = true;
  let selectablePawns = [];
  let message = "À toi de jouer ! Clique sur le Dé.";
  let gameOver = false;
  let raf = 0;

  // ================= MOTEUR DU JEU =================
  function rollDice() {
    if (!canRoll || gameOver) return;
    canRoll = false;

    let rolls = 0;
    const interval = setInterval(() => {
      diceValue = Math.floor(Math.random() * 6) + 1;
      rolls++;
      if (rolls > 8) {
        clearInterval(interval);
        handleTurn();
      }
    }, 50);
  }

  function handleTurn() {
    const p = players[turn];
    selectablePawns = getValidMoves(p, diceValue);

    if (selectablePawns.length === 0) {
      message = `${PLAYER_NAMES[turn]} a fait un ${diceValue}. Aucun coup possible !`;
      setTimeout(nextTurn, 1000);
    } else if (p.isAI) {
      message = `${PLAYER_NAMES[turn]} réfléchit... (Dé: ${diceValue})`;
      setTimeout(() => {
        let chosenPawn = selectablePawns[0];
        for (let idx of selectablePawns) {
          if (p.pawns[idx].state === 'home' && diceValue === 6) { chosenPawn = idx; break; }
        }
        movePawn(turn, chosenPawn);
      }, 800);
    } else {
      message = `Tu as fait un ${diceValue} ! Clique sur un de tes dadas.`;
    }
  }

  function getValidMoves(player, dice) {
    const valid = [];
    player.pawns.forEach((pawn, idx) => {
      if (pawn.state === 'home' && dice === 6) valid.push(idx);
      else if (pawn.state === 'track') {
        if (pawn.pos + dice <= TRACK_LEN) valid.push(idx);
      } else if (pawn.state === 'stair') {
        if (pawn.pos + 1 === dice) valid.push(idx);
      }
    });
    return valid;
  }

  function movePawn(playerIdx, pawnIdx) {
    const p = players[playerIdx];
    const pawn = p.pawns[pawnIdx];

    if (pawn.state === 'home' && diceValue === 6) {
      pawn.state = 'track';
      pawn.pos = 0;
      checkCapture(playerIdx, getAbsoluteTrackPos(playerIdx, 0));
    } else if (pawn.state === 'track') {
      pawn.pos += diceValue;
      if (pawn.pos >= TRACK_LEN) {
        pawn.state = 'stair';
        pawn.pos = 0;
      } else {
        checkCapture(playerIdx, getAbsoluteTrackPos(playerIdx, pawn.pos));
      }
    } else if (pawn.state === 'stair') {
      pawn.pos++;
      if (pawn.pos === 6) pawn.state = 'finished';
    }

    if (p.pawns.every(pw => pw.state === 'finished')) {
      gameOver = true;
      message = `${PLAYER_NAMES[playerIdx]} A GAGNÉ ! 🏆`;
      if (playerIdx === 0 && typeof updateHighScore === 'function') updateHighScore('dada', 1000);
      return;
    }

    if (diceValue === 6 && !gameOver) {
      message = `${PLAYER_NAMES[playerIdx]} rejoue grâce au 6 !`;
      canRoll = true;
      if (p.isAI) setTimeout(rollDice, 700);
    } else {
      nextTurn();
    }
  }

  function checkCapture(moverIdx, absPos) {
    players.forEach((pl, pIdx) => {
      if (pIdx === moverIdx) return;
      pl.pawns.forEach(pawn => {
        if (pawn.state === 'track' && getAbsoluteTrackPos(pIdx, pawn.pos) === absPos) {
          pawn.state = 'home';
          pawn.pos = -1;
          message = `${PLAYER_NAMES[moverIdx]} a MANGÉ un dada de ${PLAYER_NAMES[pIdx]} !`;
        }
      });
    });
  }

  function getAbsoluteTrackPos(playerIdx, localPos) {
    return (START_POS[playerIdx] + localPos) % TRACK_LEN;
  }

  function nextTurn() {
    turn = (turn + 1) % 4;
    canRoll = true;
    selectablePawns = [];
    if (players[turn].isAI && !gameOver) {
      setTimeout(rollDice, 500);
    } else {
      message = "À toi de jouer ! Clique sur le Dé.";
    }
  }

  function getPawnScreenCoords(playerIdx, pawnIdx) {
    const pawn = players[playerIdx].pawns[pawnIdx];
    if (pawn.state === 'home') return stables[playerIdx][pawnIdx];
    if (pawn.state === 'track') return trackCoords[getAbsoluteTrackPos(playerIdx, pawn.pos)];
    if (pawn.state === 'stair' || pawn.state === 'finished') return stairs[playerIdx][Math.min(5, pawn.pos)];
    return { x: 0, y: 0 };
  }

  // ================= ENTRÉES SOURIS =================
  function handleClick(e) {
    if (gameOver) {
      players.forEach(p => p.pawns.forEach(pw => { pw.state = 'home'; pw.pos = -1; }));
      turn = 0; gameOver = false; canRoll = true; message = "À toi de jouer ! Clique sur le Dé.";
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (canRoll && turn === 0) {
      if (x >= 15 && x <= 125 && y >= 150 && y <= 240) {
        rollDice();
        return;
      }
    }

    if (turn === 0 && !canRoll) {
      selectablePawns.forEach(pawnIdx => {
        const pt = getPawnScreenCoords(0, pawnIdx);
        if (Math.hypot(x - pt.x, y - pt.y) < 18) {
          movePawn(0, pawnIdx);
        }
      });
    }
  }

  // ================= RENDU CLAIRE ET LISIBLE =================
  function draw() {
    // Fond bois/carton clair
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cadre général du plateau
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(140, 10, 355, 355, 12);
    ctx.fill();
    ctx.stroke();

    // Dessin des cases de la piste
    trackCoords.forEach((pt, i) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Cases de départ
      START_POS.forEach((sPos, cIdx) => {
        if (i === sPos) {
          ctx.fillStyle = COLORS[cIdx];
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2); ctx.fill();
        }
      });
    });

    // Dessin des escaliers (marches numérotées)
    stairs.forEach((st, pIdx) => {
      st.forEach((pt, stepIdx) => {
        ctx.fillStyle = LIGHT_COLORS[pIdx];
        ctx.strokeStyle = COLORS[pIdx];
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        ctx.fillStyle = COLORS[pIdx];
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stepIdx + 1, pt.x, pt.y + 3.5);
      });
    });

    // Dessin des écuries (coins)
    stables.forEach((st, pIdx) => {
      st.forEach(pt => {
        ctx.fillStyle = LIGHT_COLORS[pIdx];
        ctx.strokeStyle = COLORS[pIdx];
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    });

    // Dessin des Pions (Chevaux)
    players.forEach((p, pIdx) => {
      p.pawns.forEach((pawn, pwIdx) => {
        const pt = getPawnScreenCoords(pIdx, pwIdx);
        const isSelectable = pIdx === 0 && selectablePawns.includes(pwIdx) && !canRoll;

        // Contour de surbrillance si sélectionnable
        if (isSelectable) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.fillStyle = COLORS[pIdx];
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Tête du cheval
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🐴', pt.x, pt.y + 3.5);
      });
    });

    // Panneau de contrôle du Dé (Gauche)
    ctx.fillStyle = turn === 0 && canRoll ? '#eff6ff' : '#ffffff';
    ctx.strokeStyle = turn === 0 ? COLORS[0] : '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(15, 150, 110, 90, 10); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(canRoll && turn === 0 ? 'CLIQUE ICI !' : 'DÉ', 70, 172);

    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = COLORS[turn];
    ctx.fillText(diceValue > 0 ? diceValue : '?', 70, 220);

    // Barre d'information en haut
    ctx.fillStyle = COLORS[turn];
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`TOUR : ${PLAYER_NAMES[turn]}`, 15, 30);

    ctx.fillStyle = '#334155';
    ctx.font = '500 13px sans-serif';
    ctx.fillText(message, 15, 52);
  }

  function loop() {
    draw();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener('mousedown', handleClick);
  raf = requestAnimationFrame(loop);

  window.__dadaStop = function () {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('mousedown', handleClick);
    window.__dadaStop = null;
  };
};