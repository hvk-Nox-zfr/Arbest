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
  const canvas = document.getElementById('game-canvas');
  const memoryBoard = document.getElementById('memory-board');
  
  if (canvas) canvas.classList.add('hidden');
  if (memoryBoard) {
    memoryBoard.classList.remove('hidden');
    memoryBoard.style.width = '100%';
    memoryBoard.style.maxWidth = '520px';
    memoryBoard.style.height = 'auto';
    memoryBoard.style.aspectRatio = '1 / 1';
    memoryBoard.style.margin = '0 auto';
    memoryBoard.style.border = '3px solid #00f3ff';
    memoryBoard.style.borderRadius = '8px';
    memoryBoard.style.boxShadow = '0 0 25px rgba(0, 243, 255, 0.4)';
    memoryBoard.style.boxSizing = 'border-box';
    memoryBoard.style.background = '#090d16';
  }

  if (window.MobileKit) MobileKit.setup({ mode: 'board', controls: 'none', ratio: 1 });
  renderDifficultyMenu();
}

function renderDifficultyMenu() {
  const boardElem = document.getElementById('memory-board');
  if (!boardElem) return;

  boardElem.style.display = 'flex';
  boardElem.style.flexDirection = 'column';
  boardElem.style.alignItems = 'center';
  boardElem.style.justifyContent = 'center';
  boardElem.style.gridTemplateColumns = 'none';
  boardElem.style.gridTemplateRows = 'none';

  boardElem.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; text-align: center; color: #fff; font-family: 'Rajdhani', sans-serif; padding: 20px; box-sizing: border-box;">
      <h2 style="color: #00f3ff; text-shadow: 0 0 10px #00f3ff; margin: 0 0 8px 0; font-size: 30px; letter-spacing: 2px;">CYBER CHESS</h2>
      <p style="color: #aaa; margin: 0 0 25px 0; font-size: 15px; letter-spacing: 1px;">SÉLECTIONNEZ LE NIVEAU DE L'IA</p>
      
      <div style="display: flex; flex-direction: column; gap: 14px; width: 220px;">
        <button id="btn-easy" class="btn-neon" onclick="selectDifficulty('easy')" style="padding: 12px; font-size: 15px; cursor: pointer;">FACILE</button>
        <button id="btn-medium" class="btn-neon" onclick="selectDifficulty('medium')" style="padding: 12px; font-size: 15px; border-color: #ffaa00; color: #ffaa00; cursor: pointer;">MOYEN</button>
        <button id="btn-hard" class="btn-neon" onclick="selectDifficulty('hard')" style="padding: 12px; font-size: 15px; border-color: #ff0055; color: #ff0055; cursor: pointer;">DIFFICILE</button>
      </div>
    </div>
  `;

  setTimeout(() => {
    document.getElementById('btn-easy')?.addEventListener('click', () => selectDifficulty('easy'));
    document.getElementById('btn-medium')?.addEventListener('click', () => selectDifficulty('medium'));
    document.getElementById('btn-hard')?.addEventListener('click', () => selectDifficulty('hard'));
  }, 0);
}

function selectDifficulty(level) {
  aiDifficulty = level;
  initChessBoard();
  
  const boardElem = document.getElementById('memory-board');
  if (!boardElem) return;

  boardElem.style.display = 'grid';
  boardElem.style.gridTemplateColumns = 'repeat(8, 1fr)';
  boardElem.style.gridTemplateRows = 'repeat(8, 1fr)';
  
  renderChessBoard();
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
  updateCheckStatus();
}

function renderChessBoard() {
  const boardElem = document.getElementById('memory-board');
  if (!boardElem) return;
  boardElem.innerHTML = '';

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
      square.style.fontSize = 'min(6vw, 36px)';
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

function handleSquareClick(r, c) {
  if (!isPlayerTurn) return;

  const piece = chessBoardState[r][c];

  if (piece && piece === piece.toUpperCase()) {
    selectedSquare = { r, c };
    validMoves = getStrictLegalMoves(r, c, chessBoardState);
    renderChessBoard();
    return;
  }

  if (selectedSquare) {
    const isMoveValid = validMoves.some(m => m.r === r && m.c === c);
    if (isMoveValid) {
      makeMove(selectedSquare, { r, c });
      selectedSquare = null;
      validMoves = [];
      
      updateCheckStatus();
      renderChessBoard();

      if (isCheckmate(false)) {
        if (typeof triggerGameOver === 'function') triggerGameOver(chessScore + 2000);
        return;
      }

      isPlayerTurn = false;
      setTimeout(() => {
        makeAIMove();
        updateCheckStatus();
        renderChessBoard();

        if (isCheckmate(true)) {
          if (typeof triggerGameOver === 'function') triggerGameOver(chessScore);
          return;
        }

        isPlayerTurn = true;
      }, 300);
    }
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

// Exposition globale sur window pour compatibilité tout environnement
window.startChessGame = startChessGame;
window.selectDifficulty = selectDifficulty;
window.renderDifficultyMenu = renderDifficultyMenu;