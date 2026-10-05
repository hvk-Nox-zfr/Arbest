function startMemoryGame() {
  if (window.GameMobile) GameMobile.reset();
  const board = document.getElementById('memory-board');
  board.innerHTML = '';
  board.dataset.game = 'memory';

  // Nettoie les styles laissés par un autre jeu (ex : l'échiquier)
  ['width', 'maxWidth', 'height', 'aspectRatio', 'margin', 'border', 'borderRadius', 'boxShadow',
   'boxSizing', 'background', 'display', 'flexDirection', 'alignItems', 'justifyContent',
   'gridTemplateColumns', 'gridTemplateRows'].forEach(p => { board.style[p] = ''; });

  // Plateau 4x4 carré qui s'adapte à l'écran
  board.style.display = 'grid';
  board.style.gridTemplateColumns = 'repeat(4, 1fr)';
  board.style.gridTemplateRows = 'repeat(4, 1fr)';
  board.style.gap = 'min(2.4vw, 10px)';
  board.style.width = '100%';
  board.style.maxWidth = 'min(94vw, 460px)';
  board.style.aspectRatio = '1 / 1';
  board.style.margin = '0 auto';
  board.style.boxSizing = 'border-box';

  const emojis = ['🚀', '👾', '🤖', '🎮', '💥', '⭐', '🔮', '🕹️'];
  const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  
  let flippedCards = [];
  let matchedPairs = 0;
  let score = 100;

  cards.forEach((emoji, idx) => {
    const card = document.createElement('div');
    card.classList.add('memory-card');
    card.dataset.emoji = emoji;

    // Cartes carrées, emoji proportionné à l'écran, tactile sans zoom
    card.style.width = '100%';
    card.style.height = '100%';
    card.style.minWidth = '0';
    card.style.minHeight = '0';
    card.style.aspectRatio = '1 / 1';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'center';
    card.style.fontSize = 'clamp(1.5rem, 9vmin, 2.8rem)';
    card.style.touchAction = 'manipulation';
    card.style.userSelect = 'none';
    card.style.boxSizing = 'border-box';
    
    card.onclick = () => {
      if (flippedCards.length < 2 && !card.classList.contains('flipped')) {
        card.classList.add('flipped');
        card.innerText = emoji;
        flippedCards.push(card);
        playSound(500);

        if (flippedCards.length === 2) {
          if (flippedCards[0].dataset.emoji === flippedCards[1].dataset.emoji) {
            matchedPairs++;
            flippedCards = [];
            playSound(800);
            if (matchedPairs === emojis.length) {
              triggerGameOver(score);
            }
          } else {
            score = Math.max(0, score - 5);
            document.getElementById('current-score').innerText = score;
            setTimeout(() => {
              flippedCards.forEach(c => {
                c.classList.remove('flipped');
                c.innerText = '';
              });
              flippedCards = [];
            }, 700);
          }
        }
      }
    };
    board.appendChild(card);
  });

  if (window.GameMobile) GameMobile.start('memory', { board: true });
}