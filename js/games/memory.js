function startMemoryGame() {
  const board = document.getElementById('memory-board');
  board.innerHTML = '';
  
  const emojis = ['🚀', '👾', '🤖', '🎮', '💥', '⭐', '🔮', '🕹️'];
  const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  
  let flippedCards = [];
  let matchedPairs = 0;
  let score = 100;

  cards.forEach((emoji, idx) => {
    const card = document.createElement('div');
    card.classList.add('memory-card');
    card.dataset.emoji = emoji;
    
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
}