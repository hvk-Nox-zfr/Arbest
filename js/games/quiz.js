window.startQuizGame = function () {
  if (window.__quizStop) window.__quizStop();
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const QUESTIONS = [
    {
      q: "Quelle réforme de 2018 a provoqué une vague historique de blocages ?",
      options: [
        "A) Parcoursup & la réforme du Bac",
        "B) La réforme des retraites",
        "C) L'uniforme obligatoire",
        "D) L'interdiction des smartphones"
      ],
      answer: 0,
      expl: "La fin des filières (S/ES/L) et la sélection sur Parcoursup ont cristallisé la colère."
    },
    {
      q: "Quel élément est devenu le symbole universel des barricades lycéennes ?",
      options: [
        "A) Les chaises de classe",
        "B) Les conteneurs de poubelles roulants",
        "C) Les grilles de chantier",
        "D) Les caddies de supermarché"
      ],
      answer: 1,
      expl: "Incontournables et maniables, les conteneurs sont l'élément de base de toute barricade."
    },
    {
      q: "Où est débattue et votée démocratiquement la reconduite d'un blocage ?",
      options: [
        "A) En Conseil de Classe",
        "B) En Assemblée Générale (AG)",
        "C) Dans le bureau du CVL",
        "D) En salle des professeurs"
      ],
      answer: 1,
      expl: "L'AG rassemble tous les élèves mobilisés pour décider des actions à mener."
    },
    {
      q: "Quel projet de contrat en 2006 a poussé les lycéens à bloquer aux côtés des étudiants ?",
      options: [
        "A) La loi Travail (El Khomri)",
        "B) Le CPE (Contrat Première Embauche)",
        "C) La réforme des retraites",
        "D) Le SNU (Service National Universel)"
      ],
      answer: 1,
      expl: "La mobilisation massive contre le CPE avait contraint le gouvernement à retirer la loi."
    },
    {
      q: "Comment appelle-t-on le blocage qui permet de tracter tout en laissant entrer les élèves ?",
      options: [
        "A) Le blocage filtrant", "B) Le sit-in passif",
        "C) La grève des cours", "D) La manifestation volante"
      ],
      answer: 0,
      expl: "Le blocage filtrant vise à sensibiliser et discuter sans imposer la fermeture totale."
    }
  ];

  let qIndex = 0;
  let score = 0;
  let selectedOption = -1;
  let feedbackTimer = 0;
  let gameOver = false;
  let hoverOption = -1;
  let particles = [];
  let raf = 0;

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function getOptionBounds(i) {
    return { x: 45, y: 125 + i * 54, w: 510, h: 42 };
  }

  function addParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 4 + 2,
        color,
        life: 30
      });
    }
  }

  function onMouseMove(e) {
    if (feedbackTimer > 0 || gameOver) {
      canvas.style.cursor = 'default';
      hoverOption = -1;
      return;
    }
    const { x, y } = getMousePos(e);
    let found = -1;
    for (let i = 0; i < 4; i++) {
      const b = getOptionBounds(i);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        found = i;
        break;
      }
    }
    hoverOption = found;
    canvas.style.cursor = found !== -1 ? 'pointer' : 'default';
  }

  function onMouseDown(e) {
    const { x, y } = getMousePos(e);

    if (gameOver) {
      qIndex = 0;
      score = 0;
      gameOver = false;
      return;
    }

    if (feedbackTimer > 0) return;

    for (let i = 0; i < 4; i++) {
      const b = getOptionBounds(i);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        selectedOption = i;
        const isCorrect = i === QUESTIONS[qIndex].answer;
        if (isCorrect) {
          score += 200;
          addParticles(x, y, '#4ade80');
        } else {
          addParticles(x, y, '#ff0055');
        }
        feedbackTimer = 90;
        break;
      }
    }
  }

  function update() {
    if (feedbackTimer > 0) {
      feedbackTimer--;
      if (feedbackTimer === 0) {
        qIndex++;
        selectedOption = -1;
        if (qIndex >= QUESTIONS.length) {
          gameOver = true;
          if (typeof updateHighScore === 'function') {
            updateHighScore('quiz', score);
          }
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.fillStyle = '#05050d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grille de fond subtile style CRT
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    if (gameOver) {
      ctx.save();
      ctx.textAlign = 'center';
      
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ff0055';
      ctx.font = '900 28px Rajdhani, sans-serif';
      ctx.fillText('FIN DU SONDAGE / BLOCUS', canvas.width / 2, 130);

      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 22px Rajdhani, sans-serif';
      ctx.fillText(`SCORE FINAL : ${score} PTS`, canvas.width / 2, 190);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8a8ab0';
      ctx.font = '16px Rajdhani, sans-serif';
      const msg = score >= 800 ? "Niveau de conscience politique : Expert du Mouvement !" : "Niveau d'implication : À retravailler en AG !";
      ctx.fillText(msg, canvas.width / 2, 230);

      ctx.fillStyle = '#00f3ff';
      ctx.font = 'bold 15px Rajdhani, sans-serif';
      ctx.fillText('► Clique n\'importe où pour recommencer', canvas.width / 2, 310);
      ctx.restore();
      return;
    }

    const cur = QUESTIONS[qIndex];

    // HUD - En-tête
    ctx.fillStyle = '#8a8ab0';
    ctx.font = 'bold 13px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`QUESTION ${qIndex + 1} / ${QUESTIONS.length}`, 45, 35);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe600';
    ctx.fillText(`SCORE : ${score}`, 555, 35);

    // Barre de progression
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(45, 45, 510, 4);
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 8;
    ctx.fillRect(45, 45, 510 * ((qIndex + 1) / QUESTIONS.length), 4);
    ctx.shadowBlur = 0;

    // Énoncé de la question
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cur.q, canvas.width / 2, 85);

    // Choix de réponses
    for (let i = 0; i < 4; i++) {
      const b = getOptionBounds(i);
      let bg = 'rgba(15, 15, 30, 0.8)';
      let border = 'rgba(0, 243, 255, 0.3)';
      let textColor = '#ffffff';
      let blur = 0;

      if (feedbackTimer > 0) {
        if (i === cur.answer) {
          bg = 'rgba(74, 222, 128, 0.2)';
          border = '#4ade80';
          textColor = '#4ade80';
          blur = 10;
        } else if (i === selectedOption) {
          bg = 'rgba(255, 0, 85, 0.2)';
          border = '#ff0055';
          textColor = '#ff0055';
          blur = 10;
        }
      } else if (i === hoverOption) {
        bg = 'rgba(0, 243, 255, 0.15)';
        border = '#00f3ff';
        blur = 12;
      }

      ctx.save();
      ctx.shadowColor = border;
      ctx.shadowBlur = blur;
      ctx.fillStyle = bg;
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = textColor;
      ctx.font = 'bold 14px Rajdhani, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(cur.options[i], b.x + 18, b.y + 26);
      ctx.restore();
    }

    // Affichage de l'explication après réponse
    if (feedbackTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#8a8ab0';
      ctx.font = 'italic 13px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`💡 ${cur.expl}`, canvas.width / 2, 362);
      ctx.restore();
    }

    // Particules
    for (let p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  raf = requestAnimationFrame(loop);

  window.__quizStop = function () {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.style.cursor = 'default';
    window.__quizStop = null;
  };
};