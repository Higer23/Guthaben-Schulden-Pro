/**
 * gameLogic.js
 * ============
 * Reine Spiellogik — Guthaben-Schulden-Spiel Pro Edition
 * Vollständig auf Deutsch
 */

// ─── Level-Konfiguration ─────────────────────────────────────────────────────
export const LEVELS = [
  { level: 1, name: 'Anfänger',       range: [1, 5],  streakRequired: 0,  scorePerCorrect: 10 },
  { level: 2, name: 'Entdecker',      range: [1, 8],  streakRequired: 3,  scorePerCorrect: 15 },
  { level: 3, name: 'Lernender',      range: [1, 12], streakRequired: 6,  scorePerCorrect: 20 },
  { level: 4, name: 'Fortgeschritt.', range: [1, 15], streakRequired: 10, scorePerCorrect: 25 },
  { level: 5, name: 'Profi',          range: [1, 20], streakRequired: 15, scorePerCorrect: 35 },
  { level: 6, name: 'Meister',        range: [1, 25], streakRequired: 22, scorePerCorrect: 50 },
];

// ─── Errungenschafts-Definitionen ────────────────────────────────────────────
export const ACHIEVEMENTS = [
  { id: 'first_correct',   name: 'Erste Antwort!',    icon: '🎯', desc: 'Erste richtige Antwort',        condition: s => s.totalCorrect >= 1         },
  { id: 'streak_5',        name: '5er Streak',         icon: '🔥', desc: '5 richtige in Folge',           condition: s => s.maxStreak >= 5            },
  { id: 'streak_10',       name: '10er Streak',        icon: '⚡', desc: '10 richtige in Folge',          condition: s => s.maxStreak >= 10           },
  { id: 'streak_20',       name: '20er Streak',        icon: '🌟', desc: '20 richtige in Folge',          condition: s => s.maxStreak >= 20           },
  { id: 'negative_master', name: 'Negativ-Meister',    icon: '🧮', desc: '10× -(-n) korrekt gelöst',     condition: s => s.negativeNegativeCorrect >= 10 },
  { id: 'level_3',         name: 'Aufsteiger',         icon: '🚀', desc: 'Level 3 erreicht',              condition: s => s.maxLevel >= 3             },
  { id: 'level_5',         name: 'Pro-Spieler',        icon: '🏆', desc: 'Level 5 erreicht',              condition: s => s.maxLevel >= 5             },
  { id: 'level_6',         name: 'Legenden-Status',    icon: '👑', desc: 'Höchstes Level erreicht!',      condition: s => s.maxLevel >= 6             },
  { id: 'score_200',       name: '200 Punkte',         icon: '💎', desc: '200 Punkte erzielt',            condition: s => s.score >= 200              },
  { id: 'score_500',       name: '500 Punkte',         icon: '💰', desc: '500 Punkte erzielt',            condition: s => s.score >= 500              },
  { id: 'score_1000',      name: '1000 Punkte',        icon: '🌈', desc: '1000 Punkte erzielt',           condition: s => s.score >= 1000             },
  { id: 'games_10',        name: 'Fleißiger Spieler',  icon: '🎮', desc: '10 Spiele gespielt',            condition: s => s.totalGamesPlayed >= 10    },
  { id: 'daily_7',         name: '7-Tage-Einlogger',   icon: '📅', desc: '7 Tage in Folge eingeloggt',   condition: s => (s.dailyStreak || 0) >= 7   },
  { id: 'speed_demon',     name: 'Blitzrechner',       icon: '⚡', desc: 'Antwort in unter 3 Sekunden',  condition: s => s.fastAnswer === true       },
];

// ─── Spielaktionen / Typen ───────────────────────────────────────────────────
export const ACTIONS = [
  { de: 'Nehmen',  math: 1  },
  { de: 'Abgeben', math: -1 },
];

export const ITEM_TYPES = [
  { de: 'Positive', math: 1,  class: 'positive', emoji: '+' },
  { de: 'Negative', math: -1, class: 'negative', emoji: '−' },
];

// ─── Initialer Spielzustand ──────────────────────────────────────────────────
export function createInitialState() {
  return {
    userBalance:             0,
    computerBalance:         0,
    currentTurn:             'user',
    currentInstruction:      null,
    currentLevel:            0,
    currentStreak:           0,
    maxStreak:               0,
    score:                   0,
    maxLevel:                0,
    totalCorrect:            0,
    totalAttempts:           0,
    totalGamesPlayed:        0,
    negativeNegativeCorrect: 0,
    unlockedAchievements:    new Set(),
    gameRound:               0,
    phase:                   'idle',
    turnStartTime:           null,
    fastAnswer:              false,
    dailyStreak:             0,
  };
}

// ─── Aufgaben-Generator ──────────────────────────────────────────────────────
export function generateInstruction(levelIndex, currentBalance = 0) {
  const level          = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
  const [min, max]     = level.range;
  const amount         = randomInt(min, max);
  const action         = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const itemType       = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  const mathResult     = action.math * itemType.math * amount;

  const actionSign      = action.math === 1 ? '+' : '-';
  const itemSign        = itemType.math === 1 ? '+' : '-';
  const correctExpression = `${actionSign}(${itemSign}${amount})`;
  const newBalance      = currentBalance + mathResult;

  return {
    action,
    itemType,
    amount,
    mathResult,
    correctExpression,
    newBalance,
    currentBalance,
    levelIndex,
    isNegNeg: action.math === -1 && itemType.math === -1,
  };
}

// ─── Antwortvalidierung ──────────────────────────────────────────────────────
export function validateAnswer(rawExpression, rawBalance, instruction) {
  if (!instruction) return { expressionOk: false, balanceOk: false, allOk: false };
  if (rawExpression == null || rawBalance == null) return { expressionOk: false, balanceOk: false, allOk: false };

  const { correctExpression, newBalance, mathResult } = instruction;

  const normalised = String(rawExpression)
    .trim()
    .replace(/\s/g, '')
    .replace(/×/g, '*')
    .replace(/−/g, '-');

  const expressionOk = isValidExpression(normalised, correctExpression, mathResult);
  const parsedBalance = parseFloat(String(rawBalance).replace(',', '.'));
  const balanceOk    = !isNaN(parsedBalance) && Math.round(parsedBalance) === Math.round(newBalance);

  return { expressionOk, balanceOk, allOk: expressionOk && balanceOk };
}

function isValidExpression(userExpr, canonical, expected) {
  if (userExpr.toLowerCase() === canonical.toLowerCase()) return true;
  try {
    if (!/^[0-9+\-().]+$/.test(userExpr)) return false;
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + userExpr + ')')();
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result) === Math.round(expected);
    }
  } catch (_) {}
  return false;
}

// ─── Level-Berechnung ────────────────────────────────────────────────────────
export function getLevelFromStreak(streak) {
  let levelIdx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (streak >= LEVELS[i].streakRequired) { levelIdx = i; break; }
  }
  return levelIdx;
}

export function getLevelProgress(streak, levelIndex) {
  const atMax = levelIndex >= LEVELS.length - 1;
  if (atMax) return { pct: 100, current: streak, target: streak, atMax: true };
  const currentReq = LEVELS[levelIndex].streakRequired;
  const nextReq    = LEVELS[levelIndex + 1].streakRequired;
  const progressIn = streak - currentReq;
  const rangeIn    = nextReq - currentReq;
  const pct = Math.min(100, Math.max(0, Math.round((progressIn / rangeIn) * 100)));
  return { pct, current: progressIn, target: rangeIn, atMax: false };
}

// ─── Errungenschaften-Prüfer ─────────────────────────────────────────────────
export function checkAchievements(state) {
  const stats = {
    totalCorrect:            state.totalCorrect,
    maxStreak:               state.maxStreak,
    negativeNegativeCorrect: state.negativeNegativeCorrect,
    maxLevel:                state.maxLevel + 1,
    score:                   state.score,
    totalGamesPlayed:        state.totalGamesPlayed,
    dailyStreak:             state.dailyStreak,
    fastAnswer:              state.fastAnswer,
  };
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (!state.unlockedAchievements.has(ach.id) && ach.condition(stats)) {
      state.unlockedAchievements.add(ach.id);
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}

// ─── Computer-KI ─────────────────────────────────────────────────────────────
export function computerPlay(levelIndex, computerBalance) {
  const instruction    = generateInstruction(levelIndex, computerBalance);
  const newComputerBal = instruction.newBalance;
  return { instruction, newComputerBal };
}

// ─── Punktberechnung ─────────────────────────────────────────────────────────
export function calculateScore(levelIndex, streak, timeSecs = null) {
  const base        = LEVELS[Math.min(levelIndex, LEVELS.length - 1)].scorePerCorrect;
  const streakBonus = Math.floor(streak / 5) * 5;
  const speedBonus  = timeSecs !== null && timeSecs < 5 ? 10 : timeSecs !== null && timeSecs < 10 ? 5 : 0;
  return base + streakBonus + speedBonus;
}

// ─── Hinweis erstellen ───────────────────────────────────────────────────────
export function buildHint(instruction) {
  if (!instruction) return '';
  const { action, itemType, amount, mathResult, correctExpression, currentBalance, newBalance } = instruction;
  const verb   = action.math === 1 ? 'nimmst' : 'gibst';
  const change = mathResult >= 0
    ? `steigt dein Guthaben um ${Math.abs(mathResult)}`
    : `sinkt dein Guthaben um ${Math.abs(mathResult)}`;
  return `💡 Du ${verb} ${amount} ${itemType.de} Ticket${amount !== 1 ? 's' : ''} — das entspricht <strong>${correctExpression}</strong>. Daher ${change}: ${currentBalance} ${mathResult >= 0 ? '+' : '−'} ${Math.abs(mathResult)} = <strong>${newBalance}</strong>.`;
}

// ─── Mathe-Blitz Spiellogik (Neues Spiel) ────────────────────────────────────
export function generateMathBlitzQuestion(difficulty = 1) {
  const types = ['add', 'sub', 'mul', 'div', 'negneg'];
  const maxDiff = Math.min(difficulty, types.length);
  const type = types[Math.floor(Math.random() * maxDiff)];

  let a, b, answer, question;

  switch (type) {
    case 'add': {
      a = randomInt(1, 10 * difficulty);
      b = randomInt(1, 10 * difficulty);
      const sign = Math.random() > 0.5;
      a = sign ? a : -a;
      b = Math.random() > 0.5 ? b : -b;
      answer   = a + b;
      question = `${formatSigned(a)} + (${formatSigned(b)}) = ?`;
      break;
    }
    case 'sub': {
      a = randomInt(1, 10 * difficulty);
      b = randomInt(1, 8 * difficulty);
      a = Math.random() > 0.4 ? a : -a;
      b = Math.random() > 0.4 ? b : -b;
      answer   = a - b;
      question = `${formatSigned(a)} − (${formatSigned(b)}) = ?`;
      break;
    }
    case 'mul': {
      a = randomInt(2, 5 * difficulty);
      b = randomInt(2, 5 * difficulty);
      a = Math.random() > 0.5 ? a : -a;
      b = Math.random() > 0.5 ? b : -b;
      answer   = a * b;
      question = `(${formatSigned(a)}) × (${formatSigned(b)}) = ?`;
      break;
    }
    case 'div': {
      b = randomInt(2, 6);
      answer = randomInt(1, 10);
      a = b * answer;
      if (Math.random() > 0.5) { a = -a; answer = -answer; }
      question = `${formatSigned(a)} ÷ ${b} = ?`;
      break;
    }
    case 'negneg': {
      b = randomInt(1, 15);
      answer   = b;
      question = `−(−${b}) = ?`;
      break;
    }
    default:
      a = randomInt(1, 10); b = randomInt(1, 10);
      answer = a + b; question = `${a} + ${b} = ?`;
  }

  // Falsche Antworten generieren
  const wrong = new Set();
  while (wrong.size < 3) {
    const offset = randomInt(1, Math.max(4, Math.abs(answer) + 2));
    const candidate = Math.random() > 0.5 ? answer + offset : answer - offset;
    if (candidate !== answer) wrong.add(candidate);
  }

  const allOptions = [answer, ...wrong].sort(() => Math.random() - 0.5);
  return { question, answer, options: allOptions, type };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function formatSigned(n) {
  return n > 0 ? `+${n}` : `${n}`;
}
