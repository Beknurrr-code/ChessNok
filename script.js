let board, game;
let constructorBoard;
let chosenSide = 'white';
let allowHints = false;
let allowUndo = false;
let hintSquares = [];
let isHint = false;
let evaluations = [];
let aiDepth = 4;
let whiteTime = 600;
let blackTime = 600;
let whiteTimer, blackTimer;
let activeColor = 'w';
let selectedTime = 600;
let chart = null;
let currentDifficulty = 'medium';
let aiEnabled = true;
let assistantGame = new Chess();



function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  const backButton = document.querySelector('.back-button');
  if (backButton) {
    backButton.style.display = (screenId === 'start-screen') ? 'none' : 'inline-block';
  }
}


function openSettings() {
  showScreen('settings-screen');
}

function selectSide(side) {
  chosenSide = side;
  document.querySelectorAll('.side-button').forEach(btn => btn.classList.remove('active-button'));
  document.getElementById(side + '-button').classList.add('active-button');
}

function selectDifficulty(level) {
  currentDifficulty = level;
  document.querySelectorAll('.difficulty-button').forEach(btn => btn.classList.remove('active-button'));
  document.getElementById(level.replace(" ", "-") + '-button').classList.add('active-button');

  aiDepth = {
    'very easy': 1,
    'easy': 2,
    'medium': 3,
    'hard': 4,
    'very hard': 6
  }[level];
}

function toggleAI() {
  aiEnabled = !aiEnabled;
}

function lozzaThink(fen = null) {
  if (!aiEnabled) return;

  const currentFen = fen || game.fen();

  if (currentDifficulty === 'very easy') {
    const possibleMoves = game.moves();
    if (possibleMoves.length === 0) return;
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    game.move(randomMove);
    board.position(game.fen());
    updateMoveHistory();
    switchTimers();
    return;
  }

  docmd('position fen ' + currentFen);
  docmd(`go depth ${aiDepth}`);
}


// Конструктор позиции и остальные функции остаются без изменений...

// === Конструктор позиции ===

const defaultConstructorFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";




function openConstructor() {
  showScreen("constructor-screen");

  setTimeout(() => {
    if (!constructorBoard) {
      constructorBoard = Chessboard("constructor-board", {
        draggable: true,
        sparePieces: true,
        dropOffBoard: "trash",
        position: "start",
        pieceTheme: "libs/img/{piece}.png",
        onDragStart: onConstructorDragStart,
        onDrop: onConstructorDrop,
        onSnapEnd: onConstructorSnapEnd
      });
    }
  }, 50);
}


function clearConstructorBoard() {
  if (constructorBoard) {
    constructorBoard.position('8/8/8/8/8/8/8/8');
  }
}

function resetConstructorBoard() {
  if (constructorBoard) {
    constructorBoard.start();
  }
}

function onDragStart(source, piece) {
  if (!game || game.game_over()) return false;
  if (!piece) return false;
  if (!aiEnabled) return true;

  const color = piece[0];
  return color === (chosenSide === 'white' ? 'w' : 'b');
}

function onDrop(source, target) {
  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (!move) return 'snapback';

  board.position(game.fen());
  updateMoveHistory();
  clearHint();
  switchTimers();

  if (!game.game_over()) {
    setTimeout(() => {
      isHint = false;
      lozzaThink(game.fen());  // теперь AI реально делает ход
    }, 300);
  } else {
    endGame(false);
  }
}


function analyzeConstructorPosition() {
  const piecePlacement = constructorBoard.fen();
  const fen = `${piecePlacement} w KQkq - 0 1`;

  const validation = new Chess().validate_fen(fen);
  if (!validation.valid) {
    alert("Ошибка в позиции:\n" + validation.error);
    return;
  }

  game = new Chess(fen);
  window.game = game;
  aiEnabled = true;

  const level = document.getElementById('constructor-difficulty')?.value || 'medium';
  currentDifficulty = level;
  aiDepth = {
    'very easy': 1,
    'easy': 2,
    'medium': 3,
    'hard': 4,
    'very hard': 6
  }[level];

  chosenSide = game.turn() === 'w' ? 'white' : 'black';

  showScreen("game-screen");
  document.getElementById('board').innerHTML = '';

  setTimeout(() => {
    board = Chessboard('board', {
      draggable: true,
      position: fen,
      orientation: chosenSide,
      pieceTheme: 'libs/img/{piece}.png',
      onDragStart: onDragStart,
      onDrop: onDrop,
      onMouseoverSquare: onMouseoverSquare,
      onMouseoutSquare: onMouseoutSquare
    });

    document.getElementById("timers").style.display = "none";
    clearHint();
    updateMoveHistory();

    if (selectedTime > 0) {
      startTimer(game.turn());
      document.getElementById("timers").style.display = "flex";
    }

    // 👉 AI делает первый ход, если он на очереди
    const isAItoMove = (game.turn() === 'w' && chosenSide === 'black') || (game.turn() === 'b' && chosenSide === 'white');
    if (isAItoMove) {
      setTimeout(() => {
        lozzaThink(game.fen());
      }, 300);
    }

  }, 50);
}


// === Инициализация lozza.js как Web Worker ===
if (typeof Worker === "function") {
  var lozzaWorker = new Worker("libs/lozza.js");

  lozzaWorker.onmessage = function (e) {
    const data = e.data;

    if (data.startsWith("bestmove")) {
      const bestMove = data.split(" ")[1];
      if (!bestMove || bestMove === '(none)') return;

      const move = game.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: 'q' });
      if (move) {
        board.position(game.fen());
        updateMoveHistory();
        switchTimers();
        if (game.game_over()) endGame(false);
      }
    }
  };

  function docmd(command) {
    lozzaWorker.postMessage(command);
  }
}



function goBack() {
  showScreen('start-screen');
}

function startGame() {
  allowHints = document.getElementById('hints').checked;
  allowUndo = document.getElementById('undo').checked;
  selectedTime = parseInt(document.getElementById('time-select').value);
  whiteTime = selectedTime;
  blackTime = selectedTime;

  // Скрыть или показать таймер
  const timerElement = document.getElementById('timers');
  if (selectedTime === 0) {
    timerElement.style.display = 'none';
  } else {
    timerElement.style.display = 'flex';
    updateTimers();
  }

  evaluations = [];
  showScreen('game-screen');

  game = new Chess();
  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    orientation: chosenSide,
    pieceTheme: 'libs/img/{piece}.png',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoverSquare: onMouseoverSquare,
    onMouseoutSquare: onMouseoutSquare
  });

  lozzaHost = 0;
  document.getElementById('hint-button').style.display = allowHints ? 'inline-block' : 'none';
  document.getElementById('undo-button').style.display = allowUndo ? 'inline-block' : 'none';

  clearHint();
  updateMoveHistory();
  activeColor = 'w';

  if (chosenSide === 'black') {
    setTimeout(() => lozzaThink(game.fen()), 300);
    if (selectedTime > 0) startTimer('w');
  }
}

function onConstructorDragStart(source, piece, position, orientation) {
  // Разрешаем перетаскивать любую фигуру
  return true;
}

function onConstructorDrop(source, target) {
  if (source === target) return;

  const pos = constructorBoard.position();
  pos[target] = pos[source];
  delete pos[source];
  constructorBoard.position(pos);
}


function onConstructorSnapEnd() {
  constructorBoard.position(constructorBoard.fen());
}




function onMouseoverSquare(square, piece) {
  if (!piece || piece[0] !== game.turn()) return;
  const moves = game.moves({ square: square, verbose: true });
  if (!moves) return;

  moves.forEach(move => {
    const el = document.querySelector(`.square-${move.to}`);
    if (el) {
      const dot = document.createElement('div');
      dot.style.width = '15px';
      dot.style.height = '15px';
      dot.style.background = 'rgba(0, 255, 0, 0.7)';
      dot.style.borderRadius = '50%';
      dot.style.position = 'absolute';
      dot.style.top = '50%';
      dot.style.left = '50%';
      dot.style.transform = 'translate(-50%, -50%)';
      dot.classList.add('green-dot');
      el.appendChild(dot);
    }
  });
}

function onMouseoutSquare() {
  removeHighlights();
  if (hintSquares.length > 0) highlightHint(hintSquares[0], hintSquares[1]);
}

function removeHighlights() {
  document.querySelectorAll('.green-dot, .hint-highlight').forEach(dot => dot.remove());
  document.querySelectorAll('.highlighted-square').forEach(square => {
    square.classList.remove('highlighted-square');
    square.style.background = '';
  });
}

function updateMoveHistory() {
  const history = document.getElementById('move-history');
  history.innerHTML = "";
  const moves = game.history({ verbose: true });

  for (let i = 0; i < moves.length; i += 2) {
    const moveRow = document.createElement('div');
    moveRow.innerHTML = `<strong>${(i / 2) + 1}.</strong> 
      ${moves[i] ? moves[i].from + "→" + moves[i].to + (game.in_check() && i === moves.length - 1 ? '#' : '') : ""} 
      ${moves[i + 1] ? moves[i + 1].from + "→" + moves[i + 1].to + (game.in_check() && i + 1 === moves.length - 1 ? '#' : '') : ""}`;
    history.appendChild(moveRow);
  }
}

function showHint() {
  if (!allowHints || game.game_over()) return;
  isHint = true;
  lozzaThink(game.fen());
}

function undoMove() {
  if (!allowUndo) return;
  game.undo();
  board.position(game.fen());
  updateMoveHistory();
  clearHint();
}

function clearHint() {
  hintSquares = [];
}

function highlightHint(from, to) {
  removeHighlights();
  [from, to].forEach(square => {
    const el = document.querySelector(`.square-${square}`);
    if (el) {
      el.classList.add('highlighted-square');
      el.style.background = 'rgba(0, 255, 255, 0.4)';
    }
  });
  hintSquares = [from, to];
}


function startTimer(color) {
  clearInterval(whiteTimer);
  clearInterval(blackTimer);

  if (color === 'w') {
    whiteTimer = setInterval(() => {
      whiteTime--;
      updateTimers();
      if (whiteTime <= 0) loseOnTime('white');
    }, 1000);
  } else {
    blackTimer = setInterval(() => {
      blackTime--;
      updateTimers();
      if (blackTime <= 0) loseOnTime('black');
    }, 1000);
  }
}

function switchTimers() {
  activeColor = activeColor === 'w' ? 'b' : 'w';
  startTimer(activeColor);
}

function updateTimers() {
  document.getElementById('white-timer').textContent = formatTime(whiteTime);
  document.getElementById('black-timer').textContent = formatTime(blackTime);
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function loseOnTime(color) {
  clearInterval(whiteTimer);
  clearInterval(blackTimer);
  showScreen('result-screen');
  const resultText = document.getElementById('result-text');
  resultText.textContent = color === 'white' ? 'Поражение белых по времени' : 'Поражение чёрных по времени';
}
function endGame(manual = false) {
  clearInterval(whiteTimer);
  clearInterval(blackTimer);

  const resultText = document.getElementById('result-text');
  const screen = document.getElementById('result-screen');

  if (manual) {
    screen.style.backgroundColor = '#0a1f33';
    resultText.textContent = 'Игра завершена';
  } else {
    const outcome = game.in_draw() ? 'draw' : (game.turn() === 'w' ? 'black' : 'white');
    if (outcome === 'draw') {
      screen.style.backgroundColor = '#0a1f33';
      resultText.textContent = 'Ничья';
    } else if (outcome === chosenSide) {
      screen.style.backgroundColor = '#003d1f';
      resultText.textContent = 'Победа!';
    } else {
      screen.style.backgroundColor = '#330000';
      resultText.textContent = 'Поражение';
    }
  }

  if (evaluations.length === 0) evaluations.push(0);

  if (chart) chart.destroy();
  const ctx = document.getElementById('evalChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: evaluations.map((_, index) => index + 1),
      datasets: [{
        label: 'Оценка позиции',
        data: evaluations,
        borderColor: 'cyan',
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointBackgroundColor: 'cyan'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          title: { display: true, text: 'Ходы (№)', color: '#ffffff' },
          ticks: { color: '#ffffff' }
        },
        y: {
          title: { display: true, text: 'Оценка', color: '#ffffff' },
          ticks: { color: '#ffffff' }
        }
      },
      plugins: {
        legend: { labels: { color: '#ffffff' } }
      }
    }
  });

  const evalDisplay = document.getElementById('final-eval');
  const finalEval = evaluations[evaluations.length - 1];
  evalDisplay.textContent = `Оценка финальной позиции: ${finalEval >= 0 ? '+' : ''}${finalEval.toFixed(2)}`;

  setTimeout(() => showScreen('result-screen'), 700);
}

function rematch() {
  evaluations = [];
  chosenSide = (chosenSide === 'white') ? 'black' : 'white';
  startGame();
}



// Показывает нужный экран
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// Открывает Ассистент-доску
function openAssistant() {
  showScreen("assistant-screen");

  let fen = "начальная позиция недоступна";
  try {
    if (game && typeof game.fen === "function") {
      fen = game.fen();
    }
  } catch (e) {
    // безопасно пропускаем
  }

}


// Разрешает перетаскивание
function onAssistantDragStart(source, piece) {
  return piece.startsWith('w') || piece.startsWith('b');
}

function onAssistantDrop(source, target) {
  if (!assistantGame) assistantGame = new Chess(); // защита

  const move = assistantGame.move({
    from: source,
    to: target,
    promotion: 'q'
  });

  if (move === null) return 'snapback';
  assistantBoard.position(assistantGame.fen());
  return true;
}


// Анализирует позицию с помощью движка
function analyzeCurrentPosition() {
  const fen = game.fen();
  addMessage("Анализирую текущую позицию...", "ai");

  docmd('position fen ' + fen);
  docmd('go depth 3');

  setTimeout(() => {
    const evalScore = evaluations.length > 0 ? evaluations[evaluations.length - 1] : 0;
    const evalText = `Оценка позиции: ${evalScore >= 0 ? '+' : ''}${evalScore.toFixed(2)}`;

    let analysis = `${evalText}\n\n`;

    if (evalScore > 1.5) analysis += "Белые имеют значительное преимущество";
    else if (evalScore > 0.5) analysis += "Белые немного лучше";
    else if (evalScore > -0.5) analysis += "Позиция примерно равная";
    else if (evalScore > -1.5) analysis += "Чёрные немного лучше";
    else analysis += "Чёрные имеют значительное преимущество";

    analysis += "\n\nРекомендации:\n";

    if (game.in_checkmate()) {
      analysis += "Мат! Игра закончена.";
    } else if (game.in_draw()) {
      analysis += "Ничья!";
    } else {
      const moves = game.moves({ verbose: true });
      const checks = moves.filter(m => m.san.includes('+'));
      const captures = moves.filter(m => m.san.includes('x'));

      if (checks.length > 0) {
        analysis += `• Рассмотрите шахующие ходы: ${checks.slice(0, 3).map(m => m.san).join(', ')}\n`;
      }
      if (captures.length > 0) {
        analysis += `• Возможные взятия: ${captures.slice(0, 3).map(m => m.san).join(', ')}\n`;
      }

      analysis += `• Всего возможных ходов: ${moves.length}`;
    }

    addMessage(analysis, "ai");
  }, 500);
}

// Простой ИИ-ответ
function askAssistant() {
  const input = document.getElementById('assistant-input');
  const question = input.value.trim();
  if (!question) return;

  addMessage(question, "user");
  input.value = '';

  setTimeout(() => {
    let response = "";

    if (question.toLowerCase().includes("какой ход лучший")) {
      docmd('position fen ' + game.fen());
      docmd('go depth 3');
      response = "Анализирую лучший ход... (глубина 3)";
    } else if (question.toLowerCase().includes("оценка")) {
      response = "Нажмите кнопку 'Анализировать позицию'.";
    } else if (question.toLowerCase().includes("мат")) {
      response = game.in_checkmate()
        ? "Да, это мат!"
        : "Нет, мата нет. " + (game.in_check() ? "Но есть шах!" : "Шаха тоже нет.");
    } else {
      response = getBotResponse(question);  // ✅ ← это главное!
    }

    addMessage(response, "ai");
  }, 800);
}



function sendAssistantMessage() {
  const input = document.getElementById("assistant-input");
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  setTimeout(() => {
    askAssistant(); // 👈 вызывает ИИ-ответ
  }, 500);
}


// Добавление сообщений в чат
function addMessage(text, sender) {
  const messagesDiv = document.getElementById('assistant-messages');
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender + '-message');
  messageDiv.textContent = text;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Назад в меню
function goBack() {
  evaluations = [];
  showScreen('start-screen');
}

// Подсветка хода (если будет нужно)
function highlightAssistantHint(from, to) {
  document.querySelectorAll('#assistant-board .highlighted-square').forEach(el => {
    el.classList.remove('highlighted-square');
    el.style.background = '';
  });

  [from, to].forEach(square => {
    const el = document.querySelector(`#assistant-board .square-${square}`);
    if (el) {
      el.classList.add('highlighted-square');
      el.style.background = 'rgba(255, 215, 0, 0.4)';
    }
  });
}
function openTutorial() {
  showScreen('tutorial-screen');
}


function openAbout() {
  showScreen('about-screen');
}
window.addEventListener('message', function(event) {
  const message = event.data.trim();

  if (message.startsWith('info depth')) {
    const evalMatch = message.match(/score cp (-?\d+)/);
    if (evalMatch) {
      let score = parseInt(evalMatch[1]) / 100;
      evaluations.push(game.turn() === 'w' ? score : -score);
    }
  }

  if (message.startsWith('bestmove')) {
    const parts = message.split(' ');
    const bestMove = parts[1];
    if (!bestMove || bestMove === '(none)') return;

    const from = bestMove.slice(0, 2);
    const to = bestMove.slice(2, 4);

    if (isHint) {
      highlightHint(from, to);
      isHint = false;
    } else {
      const move = game.move({ from, to, promotion: 'q' });
      if (move) {
        board.position(game.fen(), true);
        updateMoveHistory();
        switchTimers();
        if (game.game_over()) {
          endGame(false);
        }
      }
    }
  }
});





const tutorialPages = [
  `📘 Глава 1. Теория шахмат

1.1 История шахмат
Шахматы — древнейшая интеллектуальная игра, возникшая около VI века в Индии под названием чатуранга. Первоначально это была военная стратегическая игра. Через Персию и арабский мир шахматы попали в Европу и к XV веку приобрели современный облик. Первый чемпион мира — Вильгельм Стейниц (1886). Среди легенд: Алехин, Капабланка, Ботвинник, Фишер, Карпов, Каспаров, Карлсен.

1.2 Польза шахмат
Игра развивает логическое и стратегическое мышление, тренирует память и внимание, повышает концентрацию, учит дисциплине и принятию решений. У детей — развивает способности к обучению, у взрослых — помогает сохранить ясность ума.

1.3 Шахматы и здоровье
Шахматы замедляют деменцию, улучшают когнитивные функции и помогают справляться со стрессом. Это безопасный способ поддержания умственной активности в любом возрасте.`,

  `📘 Глава 2. Основы игры

2.1 Шахматная доска
Доска состоит из 64 клеток — 8 по вертикали и 8 по горизонтали. Поля чередуются по цвету. Левый нижний угол должен быть тёмным. Каждое поле имеет координату: от a1 до h8.

2.2 Фигуры и их ходы
У каждого игрока 16 фигур:
- 8 пешек — ходят только вперёд, но бьют по диагонали.
- 2 ладьи — по горизонтали и вертикали.
- 2 кони — «буквой Г».
- 2 слона — по диагонали.
- 1 ферзь — по вертикали, горизонтали и диагонали.
- 1 король — на одну клетку в любом направлении.

Особые правила: рокировка, взятие на проходе, превращение пешки.

2.3 Цель игры
Цель — поставить мат: угрожать королю и лишить его возможности спасения. Игра также может закончиться ничьей, патом, троекратным повторением позиции или по правилу 50 ходов.

2.4 Основные принципы
Контролируй центр, развивай фигуры, быстро рокируйся, избегай раннего выноса ферзя, не делай одни и те же ходы дважды.`,

  `📘 Глава 3. Дебюты, тактика и стратегия

3.1 Дебюты
Начальная стадия партии (первые 10–15 ходов). Цель — занять центр, развить фигуры и обезопасить короля.
Примеры дебютов:
- Испанская партия: 1.e4 e5 2.Nf3 Nc6 3.Bb5
- Сицилианская защита: 1.e4 c5
- Ферзевый гамбит: 1.d4 d5 2.c4
- Защита Каро-Канн: 1.e4 c6
- Итальянская партия: 1.e4 e5 2.Nf3 Nc6 3.Bc4

3.2 Гамбиты
Добровольная жертва пешки или фигуры ради инициативы:
- Гамбит короля: 1.e4 e5 2.f4
- Гамбит Эванса: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4
- Венский гамбит: 1.e4 e5 2.Nc3 Nf6 3.f4
- Гамбит Дамано: 1.e4 e5 2.Nf3 f6 3.Nxe5?!

3.3 Тактика
Краткосрочные приёмы для получения преимущества:
- Вилка — угроза двум фигурам.
- Связка — фигура не может уйти, иначе потеряется более ценная.
- Отвлечение — заставить фигуру покинуть важную позицию.
- Завлечение — заманить на невыгодное поле.
- Жертва — отдача материала ради атаки или позиции.

3.4 Стратегия
Долгосрочные идеи:
- Пешечная структура: избегай изолированных и сдвоенных пешек.
- Активные фигуры: ищи лучшие поля.
- Слабые поля: контролируй ключевые пункты.
- Хороший/плохой слон: зависит от цвета пешек.
- Планирование: оценивай позицию и строй план.`,

  `📘 Глава 4. Примеры и практика

4.1 Великие партии
- Морфи против герцога и графа (1858) — развитие, жертва, мат.
- Бессмертная партия (Андерсен, 1851) — комбинации и атака.
- Фишер – Спасский (1972) — матч века.
- Карлсен – Ананд (2013) — стратегия и позиционная игра.

4.2 Упражнения и задачи
- Маты в 1–3 хода.
- Найти тактические удары (вилки, связки, отвлечения).
- Упражнения на реализацию и защиту.
- Найди лучший ход в позиции.

4.3 Обучение на практике
- Изучение дебютных ловушек (например, ловушка на f7).
- Как реализовать лишнюю фигуру или пешку.
- Защита в плохих позициях и активная оборона.
- Анализ своих партий и выявление ошибок.`
];


let currentTutorialPage = 0;

function updateTutorialContent() {
  const content = document.getElementById("tutorial-content");
  if (content) content.innerText = tutorialPages[currentTutorialPage];
}

function nextTutorialPage() {
  if (currentTutorialPage < tutorialPages.length - 1) {
    currentTutorialPage++;
    updateTutorialContent();
  }
}

function prevTutorialPage() {
  if (currentTutorialPage > 0) {
    currentTutorialPage--;
    updateTutorialContent();
  }
}

window.onload = () => {
  updateTutorialContent();
};
