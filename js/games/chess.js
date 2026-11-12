// ============================================================
// CYBER CHESS - VERSION CORRIGÉE & IA AVANCÉE
// ============================================================

let chessBoardState = [];
let selectedSquare = null;
let validMoves = [];
let isPlayerTurn = true;
let chessScore = 0;
let inCheckStatus = { white: false, black: false };
let aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'


// Multijoueur en ligne (même principe que le Morpion Arbest : code à 6 chiffres)
let chessMode = 'menu'; // 'menu', 'ai', 'online'
let chessHumanSide = 'white'; // blanc pour l'hôte, noir pour l'invité
let chessGameOver = false;
let chessPeer = null;
let chessConnection = null;
let chessPeerScriptPromise = null;
let chessConnectionTimer = null;
let chessOnlineHost = false;
let chessOnlineConnected = false;
let chessRoomCode = '';
const CHESS_PEER_PREFIX = 'arbest-chess-';
const CHESS_PEER_OPTIONS = { host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 0 };

const PIECE_SYMBOLS = {
  'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟', // IA (Rose)
  'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'  // Joueur (Cyan)
};

const PIECE_VALUES = {
  p: 10, n: 30, b: 30, r: 50, q: 90, k: 900,
  P: -10, N: -30, B: -30, R: -50, Q: -90, K: -900
};

// Tables d'évaluation positionnelle
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5,  5,  5,  5,  5,  5,  5,  5],
  [1,  1,  2,  3,  3,  2,  1,  1],
  [0,  0,  1,  4,  4,  1,  0,  0],
  [0,  0,  1,  4,  4,  1,  0,  0],
  [1, -1, -1,  0,  0, -1, -1,  1],
  [1,  1,  1, -2, -2,  1,  1,  1],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_TABLE = [
  [-5, -4, -3, -3, -3, -3, -4, -5],
  [-4, -2,  0,  0,  0,  0, -2, -4],
  [-3,  0,  1,  1,  1,  1,  0, -3],
  [-3,  0,  1,  2,  2,  1,  0, -3],
  [-3,  0,  1,  2,  2,  1,  0, -3],
  [-3,  0,  1,  1,  1,  1,  0, -3],
  [-4, -2,  0,  1,  1,  0, -2, -4],
  [-5, -4, -3, -3, -3, -3, -4, -5]
];

function startChessGame() {
  cleanupChessOnline();
  chessMode = 'menu';
  chessGameOver = false;
  if (window.GameMobile) GameMobile.reset();
  const canvas = document.getElementById('game-canvas');
  const memoryBoard = document.getElementById('memory-board');

  if (canvas) canvas.classList.add('hidden');
  if (memoryBoard) {
    memoryBoard.dataset.game = 'chess';
    memoryBoard.style.touchAction = 'manipulation';
    memoryBoard.classList.remove('hidden');
    memoryBoard.style.width = '100%';
    memoryBoard.style.maxWidth = '520px';
    memoryBoard.style.height = 'auto';
    memoryBoard.style.aspectRatio = '1 / 1';
    memoryBoard.style.margin = '0 auto';
    memoryBoard.style.border = '3px solid #00eaff';
    memoryBoard.style.borderRadius = '12px';
    memoryBoard.style.boxShadow = '0 0 28px rgba(0,234,255,.22)';
    memoryBoard.style.boxSizing = 'border-box';
    memoryBoard.style.background = '#090d16';
  }

  removeChessStatusPanel();
  renderDifficultyMenu();

  // Le runtime Arbest retire les écouteurs à la fermeture du jeu : on réinstalle
  // donc le gestionnaire à chaque ouverture.
  if (window.__chessResizeHandler) window.removeEventListener('resize', window.__chessResizeHandler);
  window.__chessResizeHandler = () => {
    const b = document.getElementById('memory-board');
    if (b && b.dataset.game === 'chess' && b.style.display === 'grid' && chessBoardState.length) renderChessBoard();
  };
  window.addEventListener('resize', window.__chessResizeHandler);
  if (window.GameMobile) GameMobile.start('chess', { board: true });
}

function renderDifficultyMenu() {
  const boardElem = document.getElementById('memory-board');
  if (!boardElem) return;

  removeChessStatusPanel();
  boardElem.style.display = 'flex';
  boardElem.style.flexDirection = 'column';
  boardElem.style.alignItems = 'center';
  boardElem.style.justifyContent = 'center';
  boardElem.style.gridTemplateColumns = 'none';
  boardElem.style.gridTemplateRows = 'none';
  boardElem.style.aspectRatio = 'auto';
  boardElem.style.minHeight = '390px';
  boardElem.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-height:390px;text-align:center;color:#f2f7ff;font-family:'Rajdhani',sans-serif;padding:clamp(16px,4vw,30px);box-sizing:border-box;background:radial-gradient(ellipse at 50% 0%,rgba(0,234,255,.12),transparent 60%),linear-gradient(145deg,#101b2d,#080e19);border-radius:9px;">
      <div style="font:800 11px Orbitron,Arial,sans-serif;letter-spacing:3px;color:#7c91ae;margin-bottom:10px">ARBEST ARCADE · STRATÉGIE</div>
      <h2 style="color:#00eaff;text-shadow:0 0 14px rgba(0,234,255,.45);margin:0 0 8px;font:900 clamp(25px,7vw,34px) Orbitron,Arial,sans-serif;letter-spacing:2px">CYBER CHESS</h2>
      <p style="color:#9fb1c9;margin:0 0 24px;font-size:15px">Choisis ton adversaire</p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:min(100%,390px)">
        <button type="button" class="btn-neon" onclick="selectDifficulty('easy')" style="padding:14px 10px;min-height:55px;font-size:14px;cursor:pointer">🤖 BOT FACILE</button>
        <button type="button" class="btn-neon" onclick="selectDifficulty('medium')" style="padding:14px 10px;min-height:55px;font-size:14px;border-color:#ffaa00;color:#ffaa00;cursor:pointer">🧠 BOT MOYEN</button>
        <button type="button" class="btn-neon" onclick="selectDifficulty('hard')" style="padding:14px 10px;min-height:55px;font-size:14px;border-color:#ff557e;color:#ff7898;cursor:pointer">🔥 BOT DIFFICILE</button>
        <button type="button" class="btn-neon" onclick="startChessOnlineMenu()" style="padding:14px 10px;min-height:55px;border-color:#28c7a5;color:#55e4c2;font-size:14px;cursor:pointer">🌐 EN LIGNE</button>
      </div>
      <p style="color:#778ba7;font-size:12px;line-height:1.5;margin:18px 0 0">En ligne : crée une partie et partage le code à 6 chiffres avec ton ami.</p>
    </div>
  `;
}

function removeChessStatusPanel() {
  const panel = document.getElementById('chess-status-panel');
  if (panel) panel.remove();
}

function ensureChessStatusPanel() {
  let panel = document.getElementById('chess-status-panel');
  if (panel) return panel;
  const boardElem = document.getElementById('memory-board');
  if (!boardElem || !boardElem.parentNode) return null;
  panel = document.createElement('div');
  panel.id = 'chess-status-panel';
  panel.style.cssText = 'width:min(100%,520px);margin:12px auto 0;padding:12px 14px;border:1px solid rgba(0,234,255,.22);border-radius:10px;background:linear-gradient(145deg,#101d30,#0a1220);color:#e8f4ff;font:600 15px Rajdhani,Arial,sans-serif;text-align:center;box-sizing:border-box;';
  const label = document.createElement('div');
  label.id = 'chess-status-text';
  label.setAttribute('aria-live', 'polite');
  label.style.cssText = 'font-weight:700;letter-spacing:.4px;';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← MENU ÉCHECS';
  back.style.cssText = 'margin-top:10px;padding:8px 14px;border-radius:7px;border:1px solid rgba(0,234,255,.4);background:#10263a;color:#dffaff;font:700 12px Orbitron,Arial,sans-serif;cursor:pointer;';
  back.addEventListener('click', () => {
    cleanupChessOnline();
    chessMode = 'menu';
    renderDifficultyMenu();
  });
  panel.append(label, back);
  boardElem.insertAdjacentElement('afterend', panel);
  return panel;
}

function setChessStatus(message, isError = false) {
  ensureChessStatusPanel();
  const label = document.getElementById('chess-status-text');
  if (label) {
    label.textContent = message;
    label.style.color = isError ? '#ff8095' : '#dffaff';
  }
}

function startChessOnlineMenu() {
  cleanupChessOnline();
  chessMode = 'menu';
  const boardElem = document.getElementById('memory-board');
  if (!boardElem) return;
  removeChessStatusPanel();
  boardElem.style.display = 'flex';
  boardElem.style.flexDirection = 'column';
  boardElem.style.alignItems = 'stretch';
  boardElem.style.justifyContent = 'center';
  boardElem.style.gridTemplateColumns = 'none';
  boardElem.style.gridTemplateRows = 'none';
  boardElem.style.aspectRatio = 'auto';
  boardElem.style.minHeight = '390px';
  boardElem.innerHTML = `
    <div style="width:100%;min-height:390px;padding:clamp(15px,4vw,25px);box-sizing:border-box;background:radial-gradient(ellipse at 50% 0%,rgba(0,234,255,.12),transparent 60%),linear-gradient(145deg,#101b2d,#080e19);border-radius:9px;color:#f2f7ff;font-family:'Rajdhani',sans-serif;">
      <div style="text-align:center;font:800 11px Orbitron,Arial,sans-serif;letter-spacing:2px;color:#7c91ae">ARBEST ARCADE · MULTIJOUEUR</div>
      <h2 style="text-align:center;color:#00eaff;font:900 clamp(22px,6vw,30px) Orbitron,Arial,sans-serif;margin:12px 0 5px">DUEL EN LIGNE</h2>
      <p style="text-align:center;color:#9fb1c9;margin:0 0 20px;font-size:14px">Un code à 6 chiffres pour jouer avec ton ami.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px;max-width:460px;margin:0 auto">
        <div style="padding:15px;border:1px solid rgba(0,234,255,.24);border-radius:10px;background:rgba(15,35,55,.72)">
          <h3 style="margin:0 0 8px;color:#e8f7ff;font:800 14px Orbitron,Arial,sans-serif">CRÉER</h3>
          <p style="color:#91a7c4;font-size:13px;margin:0 0 12px">Génère un code et attends ton ami.</p>
          <button id="chess-create-room" type="button" class="btn-neon" style="width:100%;padding:11px;cursor:pointer">GÉNÉRER UN CODE</button>
          <div id="chess-host-code-wrap" style="display:none;margin-top:12px">
            <div style="font-size:11px;color:#91a7c4;letter-spacing:1px;margin-bottom:5px">TON CODE DE PARTIE</div>
            <input id="chess-host-code" readonly aria-label="Code de partie" style="width:100%;box-sizing:border-box;padding:12px;text-align:center;letter-spacing:7px;font:900 27px Orbitron,Arial,sans-serif;color:#55e4ff;background:#07111e;border:1px solid #28516c;border-radius:8px">
            <button id="chess-copy-code" type="button" style="width:100%;margin-top:8px;padding:10px;border:1px solid #2b6076;border-radius:7px;background:#10283a;color:#e6faff;font-weight:800;cursor:pointer">📋 COPIER LE CODE</button>
            <p style="color:#91a7c4;font-size:12px;margin:10px 0 0">En attente de ton ami…</p>
          </div>
        </div>
        <div style="padding:15px;border:1px solid rgba(0,234,255,.24);border-radius:10px;background:rgba(15,35,55,.72)">
          <h3 style="margin:0 0 8px;color:#e8f7ff;font:800 14px Orbitron,Arial,sans-serif">REJOINDRE</h3>
          <p style="color:#91a7c4;font-size:13px;margin:0 0 12px">Entre le code reçu de ton ami.</p>
          <input id="chess-join-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Code à six chiffres" style="width:100%;box-sizing:border-box;padding:12px;text-align:center;letter-spacing:7px;font:900 27px Orbitron,Arial,sans-serif;color:#55e4ff;background:#07111e;border:1px solid #28516c;border-radius:8px">
          <button id="chess-join-room" type="button" class="btn-neon" style="width:100%;margin-top:8px;padding:11px;cursor:pointer">REJOINDRE LA PARTIE</button>
        </div>
      </div>
      <div id="chess-network-status" role="status" aria-live="polite" style="max-width:460px;margin:15px auto 0;min-height:20px;text-align:center;color:#91a7c4;font-size:13px">Prêt à créer ou rejoindre une partie.</div>
      <p style="max-width:460px;margin:12px auto 0;color:#6f829c;font-size:11px;line-height:1.5;text-align:center">La mise en relation passe par PeerJS Cloud. Les coups sont ensuite échangés directement entre les deux navigateurs.</p>
      <div style="text-align:center;margin-top:18px"><button id="chess-back-modes" type="button" style="padding:9px 14px;border-radius:7px;border:1px solid rgba(130,165,200,.28);background:#101d2d;color:#d6e5f5;font-weight:700;cursor:pointer">← RETOUR AUX MODES</button></div>
    </div>
  `;
  document.getElementById('chess-create-room').addEventListener('click', createChessRoom);
  document.getElementById('chess-join-room').addEventListener('click', joinChessRoom);
  document.getElementById('chess-copy-code').addEventListener('click', copyChessRoomCode);
  document.getElementById('chess-back-modes').addEventListener('click', () => {
    cleanupChessOnline();
    renderDifficultyMenu();
  });
  const joinInput = document.getElementById('chess-join-code');
  joinInput.addEventListener('input', () => { joinInput.value = joinInput.value.replace(/\D/g, '').slice(0, 6); });
}
function selectDifficulty(level) {
  cleanupChessOnline();
  chessMode = 'ai';
  chessHumanSide = 'white';
  chessGameOver = false;
  aiDifficulty = level;
  initChessBoard();

  const boardElem = document.getElementById('memory-board');
  if (!boardElem) return;
  removeChessStatusPanel();
  boardElem.style.display = 'grid';
  boardElem.style.gridTemplateColumns = 'repeat(8, 1fr)';
  boardElem.style.gridTemplateRows = 'repeat(8, 1fr)';
  boardElem.style.aspectRatio = '1 / 1';
  boardElem.style.minHeight = '0';
  renderChessBoard();
  setChessStatus('À toi de jouer · Tu as les blancs.');
}

function initChessBoard() {
  chessBoardState = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
  ];
  selectedSquare = null;
  validMoves = [];
  isPlayerTurn = true;
  chessScore = 0;
  chessGameOver = false;
  updateCheckStatus();
}

function renderChessBoard() {
  const boardElem = document.getElementById('memory-board');
  if (!boardElem) return;
  boardElem.innerHTML = '';

  // Taille des pièces proportionnelle à la taille réelle de l'échiquier
  const cellPx = boardElem.clientWidth / 8;
  const pieceFont = cellPx > 8 ? Math.max(16, Math.floor(cellPx * 0.7)) : 36;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement('div');
      const isDark = (r + c) % 2 === 1;
      const piece = chessBoardState[r][c];

      square.style.width = '100%';
      square.style.height = '100%';
      square.style.boxSizing = 'border-box';
      square.style.display = 'flex';
      square.style.alignItems = 'center';
      square.style.justifyContent = 'center';
      square.style.fontSize = pieceFont + 'px';
      square.style.cursor = 'pointer';
      square.style.userSelect = 'none';
      square.style.overflow = 'hidden';
      square.style.background = isDark ? '#0f172a' : '#1e293b';

      if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
        square.style.background = '#0284c7';
      } else if (validMoves.some(m => m.r === r && m.c === c)) {
        square.style.background = isDark ? '#064e3b' : '#047857';
        const dot = document.createElement('div');
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.background = '#34d399';
        dot.style.boxShadow = '0 0 6px #34d399';
        square.appendChild(dot);
      }

      if ((piece === 'K' && inCheckStatus.white) || (piece === 'k' && inCheckStatus.black)) {
        square.style.background = '#991b1b';
        square.style.boxShadow = 'inset 0 0 12px #ef4444';
      }

      if (piece && (!validMoves.some(m => m.r === r && m.c === c) || square.children.length === 0)) {
        const pieceSpan = document.createElement('span');
        pieceSpan.innerText = PIECE_SYMBOLS[piece] || '';
        pieceSpan.style.lineHeight = '1';
        if (piece === piece.toUpperCase()) {
          pieceSpan.style.color = '#38bdf8';
          pieceSpan.style.filter = 'drop-shadow(0 0 4px #0284c7)';
        } else {
          pieceSpan.style.color = '#f43f5e';
          pieceSpan.style.filter = 'drop-shadow(0 0 4px #e11d48)';
        }
        square.appendChild(pieceSpan);
      }

      square.addEventListener('click', () => handleSquareClick(r, c));
      boardElem.appendChild(square);
    }
  }
}

function isHumanPiece(piece) {
  if (!piece) return false;
  if (chessMode !== 'online') return piece === piece.toUpperCase();
  return chessHumanSide === 'white'
    ? piece === piece.toUpperCase()
    : piece === piece.toLowerCase();
}

function handleSquareClick(r, c) {
  if (!isPlayerTurn || chessGameOver) return;
  if (chessMode === 'online' && (!chessOnlineConnected || !chessConnection || !chessConnection.open)) return;

  const piece = chessBoardState[r][c];

  if (piece && isHumanPiece(piece)) {
    selectedSquare = { r, c };
    validMoves = getStrictLegalMoves(r, c, chessBoardState);
    renderChessBoard();
    return;
  }

  if (selectedSquare) {
    const from = { r: selectedSquare.r, c: selectedSquare.c };
    const to = { r, c };
    const isMoveValid = validMoves.some(m => m.r === r && m.c === c);
    if (!isMoveValid) return;

    makeMove(from, to);
    selectedSquare = null;
    validMoves = [];
    updateCheckStatus();
    renderChessBoard();

    if (chessMode === 'online') {
      sendChessMessage({ type: 'move', from, to });
      const opponentIsWhite = chessHumanSide === 'black';
      if (isCheckmate(opponentIsWhite)) {
        chessGameOver = true;
        isPlayerTurn = false;
        const isCheck = isKingUnderAttack(chessBoardState, opponentIsWhite);
        setChessStatus(isCheck ? 'Échec et mat : tu as gagné !' : 'Pat : partie nulle.');
        sendChessMessage({ type: 'finish', result: isCheck ? 'mate' : 'draw' });
        return;
      }
      isPlayerTurn = false;
      setChessStatus(inCheckStatus.white || inCheckStatus.black ? 'Coup envoyé · À ton adversaire de jouer.' : 'Coup envoyé · À ton adversaire de jouer.');
      return;
    }

    if (isCheckmate(false)) {
      chessGameOver = true;
      setChessStatus('Échec et mat : tu as gagné !');
      if (typeof triggerGameOver === 'function') triggerGameOver(chessScore + 2000);
      return;
    }

    isPlayerTurn = false;
    setChessStatus('Le bot réfléchit…');
    setTimeout(() => {
      if (chessMode !== 'ai' || chessGameOver) return;
      makeAIMove();
      updateCheckStatus();
      renderChessBoard();

      if (isCheckmate(true)) {
        chessGameOver = true;
        setChessStatus('Échec et mat : le bot a gagné.');
        if (typeof triggerGameOver === 'function') triggerGameOver(chessScore);
        return;
      }

      isPlayerTurn = true;
      setChessStatus('À toi de jouer · Tu as les blancs.');
    }, 300);
  }
}

function makeMove(from, to) {
  const piece = chessBoardState[from.r][from.c];
  const target = chessBoardState[to.r][to.c];

  if (target) {
    chessScore += Math.abs(PIECE_VALUES[target] || 10) * 10;
    const currentScoreElem = document.getElementById('current-score');
    if (currentScoreElem) currentScoreElem.innerText = chessScore;
    if (typeof playSound === 'function') playSound(520, 0.1, 'square');
  } else {
    if (typeof playSound === 'function') playSound(260, 0.05, 'sine');
  }

  chessBoardState[to.r][to.c] = piece;
  chessBoardState[from.r][from.c] = '';

  if (piece === 'P' && to.r === 0) chessBoardState[to.r][to.c] = 'Q';
  if (piece === 'p' && to.r === 7) chessBoardState[to.r][to.c] = 'q';
}

function getStrictLegalMoves(r, c, board) {
  const pseudoMoves = getPseudoMoves(r, c, board);
  const legalMoves = [];
  const isWhite = board[r][c] === board[r][c].toUpperCase();

  pseudoMoves.forEach(m => {
    const temp = board[m.r][m.c];
    board[m.r][m.c] = board[r][c];
    board[r][c] = '';

    if (!isKingUnderAttack(board, isWhite)) {
      legalMoves.push(m);
    }

    board[r][c] = board[m.r][m.c];
    board[m.r][m.c] = temp;
  });

  return legalMoves;
}

function getPseudoMoves(r, c, board) {
  const piece = board[r][c];
  if (!piece) return [];

  const moves = [];
  const isWhite = piece === piece.toUpperCase();
  const dir = isWhite ? -1 : 1;

  const addMove = (nr, nc) => {
    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return false;
    const target = board[nr][nc];
    if (!target) {
      moves.push({ r: nr, c: nc });
      return true;
    }
    if (isWhite ? target === target.toLowerCase() : target === target.toUpperCase()) {
      moves.push({ r: nr, c: nc });
    }
    return false;
  };

  if (piece.toLowerCase() === 'p') {
    if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
      moves.push({ r: r + dir, c });
      if ((isWhite && r === 6) || (!isWhite && r === 1)) {
        if (!board[r + 2 * dir][c]) moves.push({ r: r + 2 * dir, c });
      }
    }
    [-1, 1].forEach(dc => {
      const nr = r + dir, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const target = board[nr][nc];
        if (target && (isWhite ? target === target.toLowerCase() : target === target.toUpperCase())) {
          moves.push({ r: nr, c: nc });
        }
      }
    });
  }

  if (piece.toLowerCase() === 'n') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
  }

  const directions = {
    'r': [[-1,0],[1,0],[0,-1],[0,1]],
    'b': [[-1,-1],[-1,1],[1,-1],[1,1]],
    'q': [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]],
    'k': [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
  };

  const type = piece.toLowerCase();
  if (directions[type]) {
    directions[type].forEach(([dr, dc]) => {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const keepGoing = addMove(nr, nc);
        if (!keepGoing || type === 'k') break;
        nr += dr; nc += dc;
      }
    });
  }

  return moves;
}

function isKingUnderAttack(board, isWhite) {
  let kingPos = null;
  const targetKing = isWhite ? 'K' : 'k';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === targetKing) {
        kingPos = { r, c };
        break;
      }
    }
  }

  if (!kingPos) return true;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && (isWhite ? piece === piece.toLowerCase() : piece === piece.toUpperCase())) {
        const moves = getPseudoMoves(r, c, board);
        if (moves.some(m => m.r === kingPos.r && m.c === kingPos.c)) {
          return true;
        }
      }
    }
  }

  return false;
}

function updateCheckStatus() {
  inCheckStatus.white = isKingUnderAttack(chessBoardState, true);
  inCheckStatus.black = isKingUnderAttack(chessBoardState, false);
}

function isCheckmate(isWhite) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = chessBoardState[r][c];
      if (piece && (isWhite ? piece === piece.toUpperCase() : piece === piece.toLowerCase())) {
        const moves = getStrictLegalMoves(r, c, chessBoardState);
        if (moves.length > 0) return false;
      }
    }
  }
  return true;
}

// ============================================================
// IA AVANCÉE : MINIMAX & ÉLAGAGE ALPHA-BÊTA
// ============================================================

function makeAIMove() {
  let depth = 1;
  if (aiDifficulty === 'medium') depth = 2;
  if (aiDifficulty === 'hard') depth = 3;

  const bestMove = minimaxRoot(depth, chessBoardState, true);
  if (bestMove) {
    makeMove(bestMove.from, bestMove.to);
  }
}

function minimaxRoot(depth, board, isMaximizing) {
  let bestMove = null;
  let bestValue = -9999;
  let moves = getAllPossibleMoves(board, false);

  if (aiDifficulty === 'easy') {
    moves.sort(() => Math.random() - 0.5);
  }

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const temp = board[move.to.r][move.to.c];
    board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
    board[move.from.r][move.from.c] = '';

    const value = minimax(depth - 1, board, -10000, 10000, false);

    board[move.from.r][move.from.c] = board[move.to.r][move.to.c];
    board[move.to.r][move.to.c] = temp;

    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }
  return bestMove;
}

function minimax(depth, board, alpha, beta, isMaximizing) {
  if (depth === 0) return evaluateBoard(board);

  const moves = getAllPossibleMoves(board, !isMaximizing);

  if (isMaximizing) {
    let maxEval = -9999;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const temp = board[move.to.r][move.to.c];
      board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
      board[move.from.r][move.from.c] = '';

      const evaluation = minimax(depth - 1, board, alpha, beta, false);

      board[move.from.r][move.from.c] = board[move.to.r][move.to.c];
      board[move.to.r][move.to.c] = temp;

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = 9999;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const temp = board[move.to.r][move.to.c];
      board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
      board[move.from.r][move.from.c] = '';

      const evaluation = minimax(depth - 1, board, alpha, beta, true);

      board[move.from.r][move.from.c] = board[move.to.r][move.to.c];
      board[move.to.r][move.to.c] = temp;

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getAllPossibleMoves(board, isWhite) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && (isWhite ? piece === piece.toUpperCase() : piece === piece.toLowerCase())) {
        const valid = getStrictLegalMoves(r, c, board);
        valid.forEach(m => moves.push({ from: { r, c }, to: m }));
      }
    }
  }
  return moves;
}

function evaluateBoard(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      let val = PIECE_VALUES[piece] || 0;

      if (piece === 'p') val += PAWN_TABLE[r][c];
      if (piece === 'P') val -= PAWN_TABLE[7 - r][c];
      if (piece === 'n') val += KNIGHT_TABLE[r][c];
      if (piece === 'N') val -= KNIGHT_TABLE[7 - r][c];

      score += val;
    }
  }
  return score;
}

// ============================================================
// MULTIJOUEUR EN LIGNE — code de salon à 6 chiffres
// ============================================================
const CHESS_PEERJS_URL = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';

function chessNetworkStatus(message, isError = false) {
  const el = document.getElementById('chess-network-status');
  if (el) {
    el.textContent = message;
    el.style.color = isError ? '#ff8095' : '#91a7c4';
  }
}

function loadChessPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (chessPeerScriptPromise) return chessPeerScriptPromise;
  chessPeerScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHESS_PEERJS_URL;
    script.async = true;
    script.onload = () => window.Peer ? resolve(window.Peer) : reject(new Error('PeerJS ne s’est pas chargé.'));
    script.onerror = () => reject(new Error('Impossible de charger PeerJS. Vérifie ta connexion Internet.'));
    document.head.appendChild(script);
  }).catch(error => {
    chessPeerScriptPromise = null;
    throw error;
  });
  return chessPeerScriptPromise;
}

function waitForChessPeerOpen(peer, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('Le service de connexion ne répond pas. Réessaie.')), timeoutMs);
    const finish = (error, id) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(id);
    };
    peer.on('open', id => finish(null, id));
    peer.on('error', error => {
      if (!settled) finish(error);
      else if (chessPeer === peer) chessNetworkStatus(chessPeerErrorMessage(error), true);
    });
  });
}

function chessPeerErrorMessage(error) {
  const type = error && error.type;
  if (type === 'peer-unavailable') return 'Partie introuvable. Vérifie les 6 chiffres.';
  if (type === 'unavailable-id') return 'Ce code est déjà utilisé, génération d’un autre code…';
  if (type === 'network') return 'Connexion au service impossible. Vérifie Internet.';
  if (type === 'server-error') return 'Le service de connexion rencontre un problème. Réessaie.';
  if (type === 'browser-incompatible') return 'Ce navigateur ne prend pas en charge la connexion WebRTC.';
  return (error && error.message) || 'Une erreur de connexion est survenue.';
}

function chessRandomRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createChessRoom() {
  cleanupChessOnline();
  chessOnlineHost = true;
  chessNetworkStatus('Connexion au service…');
  const button = document.getElementById('chess-create-room');
  if (button) button.disabled = true;
  try {
    const Peer = await loadChessPeerJS();
    let opened = false;
    let lastError = null;
    for (let attempt = 0; attempt < 10 && !opened; attempt++) {
      const code = chessRandomRoomCode();
      const peer = new Peer(CHESS_PEER_PREFIX + code, CHESS_PEER_OPTIONS);
      chessPeer = peer;
      peer.on('connection', connection => {
        if (chessPeer !== peer || !chessOnlineHost || chessOnlineConnected || chessConnection) {
          connection.close();
          return;
        }
        setupChessConnection(connection);
      });
      try {
        await waitForChessPeerOpen(peer, 15000);
        if (chessPeer !== peer) return;
        chessRoomCode = code;
        opened = true;
        const codeWrap = document.getElementById('chess-host-code-wrap');
        const codeField = document.getElementById('chess-host-code');
        if (codeField) codeField.value = code;
        if (codeWrap) codeWrap.style.display = 'block';
        chessNetworkStatus('Partie prête ! Envoie le code à ton ami et garde cette fenêtre ouverte.');
      } catch (error) {
        lastError = error;
        try { peer.destroy(); } catch (_) {}
        if (chessPeer === peer) chessPeer = null;
        if (!error || error.type !== 'unavailable-id') throw error;
      }
    }
    if (!opened) throw lastError || new Error('Impossible de créer le salon. Réessaie.');
  } catch (error) {
    chessNetworkStatus(chessPeerErrorMessage(error), true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function joinChessRoom() {
  const input = document.getElementById('chess-join-code');
  const code = String(input ? input.value : '').replace(/\D/g, '').slice(0, 6);
  if (input) input.value = code;
  if (!/^\d{6}$/.test(code)) {
    chessNetworkStatus('Entre exactement 6 chiffres.', true);
    return;
  }
  cleanupChessOnline();
  chessOnlineHost = false;
  chessNetworkStatus('Recherche de la partie ' + code + '…');
  const button = document.getElementById('chess-join-room');
  if (button) button.disabled = true;
  try {
    const Peer = await loadChessPeerJS();
    const peer = new Peer(CHESS_PEER_OPTIONS);
    chessPeer = peer;
    await waitForChessPeerOpen(peer, 15000);
    if (chessPeer !== peer) return;
    const connection = peer.connect(CHESS_PEER_PREFIX + code, { reliable: true });
    setupChessConnection(connection);
    chessConnectionTimer = setTimeout(() => {
      chessConnectionTimer = null;
      if (chessPeer === peer && !chessOnlineConnected) chessNetworkStatus('Aucune partie trouvée avec ce code. Vérifie-le puis réessaie.', true);
    }, 18000);
  } catch (error) {
    chessNetworkStatus(chessPeerErrorMessage(error), true);
  } finally {
    if (button) button.disabled = false;
  }
}

function setupChessConnection(connection) {
  chessConnection = connection;
  connection.on('open', () => {
    if (chessConnection !== connection) return;
    if (chessConnectionTimer) { clearTimeout(chessConnectionTimer); chessConnectionTimer = null; }
    chessOnlineConnected = true;
    chessMode = 'online';
    chessHumanSide = chessOnlineHost ? 'white' : 'black';
    chessGameOver = false;
    initChessBoard();
    isPlayerTurn = chessOnlineHost;
    selectedSquare = null;
    validMoves = [];
    const boardElem = document.getElementById('memory-board');
    if (boardElem) {
      boardElem.style.display = 'grid';
      boardElem.style.gridTemplateColumns = 'repeat(8, 1fr)';
      boardElem.style.gridTemplateRows = 'repeat(8, 1fr)';
      boardElem.style.aspectRatio = '1 / 1';
      boardElem.style.minHeight = '0';
    }
    renderChessBoard();
    setChessStatus(chessOnlineHost ? 'Connecté ! Tu joues les blancs. À toi de commencer.' : 'Connecté ! Tu joues les noirs. En attente des blancs…');
  });
  connection.on('data', handleChessNetworkData);
  connection.on('close', () => {
    if (chessConnection !== connection) return;
    chessOnlineConnected = false;
    isPlayerTurn = false;
    setChessStatus('Ton adversaire a quitté la partie.', true);
  });
  connection.on('error', error => chessNetworkStatus(chessPeerErrorMessage(error), true));
}

function sendChessMessage(message) {
  if (!chessConnection || !chessConnection.open) {
    setChessStatus('Connexion interrompue. Impossible d’envoyer le coup.', true);
    return false;
  }
  try {
    chessConnection.send(message);
    return true;
  } catch (_) {
    setChessStatus('Envoi impossible : la connexion a été interrompue.', true);
    return false;
  }
}

function handleChessNetworkData(data) {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (_) { return; }
  }
  if (!data || typeof data !== 'object' || chessMode !== 'online' || !chessOnlineConnected) return;

  if (data.type === 'move') {
    if (isPlayerTurn || chessGameOver || !data.from || !data.to) return;
    const { from, to } = data;
    const validCoords = [from.r, from.c, to.r, to.c].every(Number.isInteger) &&
      from.r >= 0 && from.r < 8 && from.c >= 0 && from.c < 8 &&
      to.r >= 0 && to.r < 8 && to.c >= 0 && to.c < 8;
    if (!validCoords) return;
    const piece = chessBoardState[from.r][from.c];
    const remotePiece = chessHumanSide === 'white'
      ? piece && piece === piece.toLowerCase()
      : piece && piece === piece.toUpperCase();
    if (!remotePiece) return;
    const legal = getStrictLegalMoves(from.r, from.c, chessBoardState);
    if (!legal.some(move => move.r === to.r && move.c === to.c)) return;

    makeMove(from, to);
    selectedSquare = null;
    validMoves = [];
    updateCheckStatus();
    renderChessBoard();
    const localIsWhite = chessHumanSide === 'white';
    if (isCheckmate(localIsWhite)) {
      chessGameOver = true;
      isPlayerTurn = false;
      const inCheck = isKingUnderAttack(chessBoardState, localIsWhite);
      setChessStatus(inCheck ? 'Échec et mat : tu as perdu.' : 'Pat : partie nulle.');
      return;
    }
    isPlayerTurn = true;
    const checked = chessHumanSide === 'white' ? inCheckStatus.white : inCheckStatus.black;
    setChessStatus(checked ? 'À toi de jouer · Échec !' : 'À toi de jouer.');
  } else if (data.type === 'finish') {
    chessGameOver = true;
    isPlayerTurn = false;
    setChessStatus(data.result === 'mate' ? 'Échec et mat : tu as perdu.' : 'Pat : partie nulle.');
  }
}

async function copyChessRoomCode() {
  const field = document.getElementById('chess-host-code');
  if (!field || !field.value) {
    chessNetworkStatus('Aucun code à copier.', true);
    return;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(field.value);
    else throw new Error('Clipboard unavailable');
    chessNetworkStatus('Code copié ! Envoie-le à ton ami.');
  } catch (_) {
    field.focus();
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (__) {}
    chessNetworkStatus(copied ? 'Code copié !' : 'Code sélectionné : copie-le manuellement.');
  }
}

function cleanupChessOnline() {
  chessOnlineConnected = false;
  chessRoomCode = '';
  if (chessConnectionTimer) { clearTimeout(chessConnectionTimer); chessConnectionTimer = null; }
  if (chessConnection) {
    try { chessConnection.close(); } catch (_) {}
  }
  if (chessPeer) {
    try { chessPeer.destroy(); } catch (_) {}
  }
  chessConnection = null;
  chessPeer = null;
  chessGameOver = false;
}

// Exposition globale pour le chargeur Arbest et son système de nettoyage.
window.startChessGame = startChessGame;
window.selectDifficulty = selectDifficulty;
window.renderDifficultyMenu = renderDifficultyMenu;
window.startChessOnlineMenu = startChessOnlineMenu;
window._chessCleanup = cleanupChessOnline;
