const setupPanel = document.querySelector("#setup-panel");
const gamePanel = document.querySelector("#game-panel");
const leaderboardPanel = document.querySelector("#leaderboard-panel");
const setupForm = document.querySelector("#setup-form");
const chatFile = document.querySelector("#chat-file");
const playerCount = document.querySelector("#player-count");
const roundCount = document.querySelector("#round-count");
const playersList = document.querySelector("#players-list");
const parseStatus = document.querySelector("#parse-status");
const roundLabel = document.querySelector("#round-label");
const turnLabel = document.querySelector("#turn-label");
const quoteCard = document.querySelector("#quote-card");
const optionsGrid = document.querySelector("#options-grid");
const result = document.querySelector("#result");
const nextTurn = document.querySelector("#next-turn");
const leaderboard = document.querySelector("#leaderboard");
const leaderboardTitle = document.querySelector("#leaderboard-title");
const playAgain = document.querySelector("#play-again");

let messages = [];
let people = [];
let players = [];
let rounds = 5;
let currentRound = 1;
let currentPlayer = 0;
let currentMessage = null;
let usedMessageIndexes = new Set();
let tieMode = false;
let tiePlayers = [];
let tieTurn = 0;
let tieCorrect = [];
let chatTitleSender = "";

function renderPlayerInputs() {
  const count = Number(playerCount.value);
  const inputs = Array.from({ length: count }, (_, index) => {
    const label = document.createElement("label");
    const span = document.createElement("span");
    const input = document.createElement("input");

    span.textContent = `player ${index + 1}`;
    input.type = "text";
    input.value = `Player ${index + 1}`;
    input.required = true;
    input.className = "player-name";

    label.append(span, input);
    return label;
  });

  playersList.replaceChildren(...inputs);
}

function cleanText(text) {
  return text
    .replace(/\u200e/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseChatExport(text) {
  const entryRegex = /^[\u200e\s]*\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+\d{1,2}:\d{2}(?::\d{2})?\]\s+([^:]+):\s*([\s\S]*)$/;
  const parsed = [];

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const match = line.match(entryRegex);

    if (match) {
      parsed.push({
        sender: cleanText(match[2]),
        text: cleanText(match[3]),
      });
      return;
    }

    const last = parsed[parsed.length - 1];
    if (last && line.trim()) {
      last.text = cleanText(`${last.text} ${line}`);
    }
  });

  return parsed;
}

function hasEnoughContent(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const letters = text.match(/\p{L}/gu) || [];
  const alphanumerics = text.match(/[\p{L}\p{N}]/gu) || [];
  return words.length >= 4 && letters.length >= 8 && alphanumerics.length >= 12;
}

function isPseudoSender(sender) {
  const normalized = sender.toLowerCase().trim();
  const blockedSenders = ["you", "meta ai", "whatsapp"];
  return blockedSenders.includes(normalized) || normalized === chatTitleSender;
}

function isSystemOrMediaMessage(message) {
  const text = message.text.toLowerCase();
  const banned = [
    "messages and calls are end-to-end encrypted",
    "this message was deleted",
    "image omitted",
    "video omitted",
    "audio omitted",
    "sticker omitted",
    "gif omitted",
    "document omitted",
    "contact card omitted",
    "poll omitted",
    "created group",
    "changed this group's icon",
    "changed the group description",
    "tap to change who can add other members",
    "added you",
    " added ",
    " left",
    " removed ",
  ];

  return banned.some((phrase) => text.includes(phrase));
}

function getPlayableMessages(parsed) {
  return parsed
    .map((message, index) => ({ ...message, index }))
    .filter((message) => !isPseudoSender(message.sender))
    .filter((message) => !isSystemOrMediaMessage(message))
    .filter((message) => hasEnoughContent(message.text));
}

function getPeople(playableMessages) {
  return [...new Set(playableMessages.map((message) => message.sender))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getRandomMessage() {
  if (usedMessageIndexes.size >= messages.length) {
    usedMessageIndexes.clear();
  }

  const available = messages.filter((message) => !usedMessageIndexes.has(message.index));
  const message = available[Math.floor(Math.random() * available.length)];
  usedMessageIndexes.add(message.index);
  return message;
}

function getCurrentPlayer() {
  return tieMode ? tiePlayers[tieTurn] : players[currentPlayer];
}

function renderQuestion() {
  currentMessage = getRandomMessage();
  const player = getCurrentPlayer();

  roundLabel.textContent = tieMode ? "tiebreaker" : `round ${currentRound} of ${rounds}`;
  turnLabel.textContent = `${player.name}'s turn`;
  quoteCard.textContent = currentMessage.text;
  result.textContent = "";
  nextTurn.hidden = true;

  const options = shuffle(people);
  const buttons = options.map((name) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.type = "button";
    button.textContent = name;
    button.addEventListener("click", () => handleGuess(name));
    return button;
  });

  optionsGrid.replaceChildren(...buttons);
}

function lockOptions() {
  optionsGrid.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
    if (button.textContent === currentMessage.sender) {
      button.classList.add("correct");
    }
  });
}

function handleGuess(name) {
  const player = getCurrentPlayer();
  const correct = name === currentMessage.sender;

  if (correct) {
    player.score += tieMode ? 0 : 1;
    result.textContent = `Correct. It was ${currentMessage.sender}.`;
  } else {
    result.textContent = `Wrong. It was ${currentMessage.sender}.`;
  }

  if (tieMode) {
    tieCorrect.push({ player, correct });
  }

  lockOptions();
  nextTurn.hidden = false;
}

function advanceMainGame() {
  currentPlayer += 1;

  if (currentPlayer >= players.length) {
    currentPlayer = 0;
    currentRound += 1;
  }

  if (currentRound > rounds) {
    showLeaderboard();
    return;
  }

  renderQuestion();
}

function advanceTiebreaker() {
  tieTurn += 1;

  if (tieTurn < tiePlayers.length) {
    renderQuestion();
    return;
  }

  const correctPlayers = tieCorrect
    .filter((entry) => entry.correct)
    .map((entry) => entry.player);

  if (correctPlayers.length === 1) {
    showLeaderboard(correctPlayers[0]);
    return;
  }

  if (correctPlayers.length > 1) {
    tiePlayers = correctPlayers;
  }

  tieTurn = 0;
  tieCorrect = [];
  renderQuestion();
}

function showPanel(panel) {
  setupPanel.hidden = panel !== setupPanel;
  gamePanel.hidden = panel !== gamePanel;
  leaderboardPanel.hidden = panel !== leaderboardPanel;
}

function renderLeaderboardRows(winner = null) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const rows = sorted.map((player, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    if (winner === player) {
      row.classList.add("winner");
    }

    row.innerHTML = `
      <span>${index + 1}</span>
      <strong>${player.name}</strong>
      <span>${player.score}</span>
    `;
    return row;
  });

  leaderboard.replaceChildren(...rows);
}

function showLeaderboard(tiebreakWinner = null) {
  showPanel(leaderboardPanel);
  renderLeaderboardRows(tiebreakWinner);

  if (tiebreakWinner) {
    leaderboardTitle.textContent = `${tiebreakWinner.name} wins via tiebreak`;
    return;
  }

  const highScore = Math.max(...players.map((player) => player.score));
  const winners = players.filter((player) => player.score === highScore);

  if (winners.length >= 2) {
    leaderboardTitle.textContent = "tie for first";
    startTiebreaker(winners);
    return;
  }

  leaderboardTitle.textContent = `${winners[0].name} wins`;
}

function startTiebreaker(winners) {
  setTimeout(() => {
    tieMode = true;
    tiePlayers = winners;
    tieTurn = 0;
    tieCorrect = [];
    showPanel(gamePanel);
    renderQuestion();
  }, 1500);
}

function startGame() {
  players = [...document.querySelectorAll(".player-name")].map((input) => ({
    name: input.value.trim(),
    score: 0,
  }));
  rounds = Number(roundCount.value);
  currentRound = 1;
  currentPlayer = 0;
  tieMode = false;
  usedMessageIndexes.clear();
  showPanel(gamePanel);
  renderQuestion();
}

function getRequiredMessageCount() {
  return Number(playerCount.value) * Number(roundCount.value);
}

function updateMessageRequirementStatus() {
  if (!messages.length) {
    parseStatus.textContent = "No chat loaded yet.";
    return;
  }

  const required = getRequiredMessageCount();
  parseStatus.textContent = `${messages.length} good messages from ${people.length} people found. Need ${required} for this setup.`;
}

chatFile.addEventListener("change", async () => {
  const [file] = chatFile.files;
  if (!file) {
    return;
  }

  const text = await file.text();
  const parsed = parseChatExport(text);
  chatTitleSender = parsed[0]?.sender.toLowerCase().trim() || "";
  messages = getPlayableMessages(parsed);
  people = getPeople(messages);

  updateMessageRequirementStatus();
});

playerCount.addEventListener("input", () => {
  renderPlayerInputs();
  updateMessageRequirementStatus();
});

roundCount.addEventListener("input", updateMessageRequirementStatus);

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const required = getRequiredMessageCount();

  if (messages.length < 1 || people.length < 2) {
    parseStatus.textContent = "Need at least 1 good message and 2 people in the chat.";
    return;
  }

  if (messages.length < required) {
    parseStatus.textContent = `Need ${required} good messages for ${roundCount.value} rounds with ${playerCount.value} players. Found ${messages.length}.`;
    return;
  }

  startGame();
});

nextTurn.addEventListener("click", () => {
  if (tieMode) {
    advanceTiebreaker();
    return;
  }

  advanceMainGame();
});

playAgain.addEventListener("click", () => {
  showPanel(setupPanel);
});

renderPlayerInputs();
