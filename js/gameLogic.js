/**
 * gameLogic.js
 * ============
 * Pure game logic module — Guthaben-Schulden-Spiel Pro Edition
 * FIXES:
 *   HATA 11 : validateAnswer — null guard
 *   HATA 12 : computerPlay  — newComputerBal included in return
 *   BUG 1   : createInitialState — totalGamesPlayed alanı eklendi
 */

// ─── Level Configuration ─────────────────────────────────────────────────────
export const LEVELS = [
  { level: 1, name: 'Anfänger',    range: [1, 5],  streakRequired: 0,  scorePerCorrect: 10 },
  { level: 2, name: 'Entdecker',   range: [1, 8],  streakRequired: 3,  scorePerCorrect: 15 },
  { level: 3, name: 'Lernender',   range: [1, 12], streakRequired: 6,  scorePerCorrect: 20 },
  { level: 4, name: 'Fortgeschr.', range: [1, 15], streakRequired: 10, scorePerCorrect: 25 },
  { level: 5, name: 'Profi',       range: [1, 20], streakRequired: 15, scorePerCorrect: 35 },
  { level: 6, name: 'Meister',     range: [1, 25], streakRequired: 22, scorePerCorrect: 50 },
];

export const STREAK_TO_NEXT_LEVEL = [3, 3, 4, 5, 7];

// ─── Achievement Definitions ─────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  { id: 'first_correct',      name: 'Erste Antwort!',     icon: '🎯', description: 'Erste richtige Antwort',      condition: (s) => s.totalCorrect >= 1 },
  { id: 'streak_5',           name: '5er Streak',          icon: '🔥', description: '5 richtige in Folge',         condition: (s) => s.maxStreak >= 5 },
  { id: 'streak_10',          name: '10er Streak',         icon: '⚡', description: '10 richtige in Folge',        condition: (s) => s.maxStreak >= 10 },
  { id: 'negative_master',    name: 'Negativ-Meister',     icon: '🧮', description: '10x -(-n) korrekt gelöst',   condition: (s) => s.negativeNegativeCorrect >= 10 },
  { id: 'level_3',            name: 'Aufsteiger',          icon: '🚀', description: 'Level 3 erreicht',            condition: (s) => s.maxLevel >= 3 },
  { id: 'level_5',            name: 'Pro-Spieler',         icon: '🏆', description: 'Level 5 erreicht',            condition: (s) => s.maxLevel >= 5 },
  { id: 'level_6',            name: 'Legenden-Status',     icon: '👑', description: 'Höchstes Level erreicht!',   condition: (s) => s.maxLevel >= 6 },
  { id: 'score_200',          name: '200 Punkte',          icon: '💎', description: '200 Punkte erzielt',          condition: (s) => s.score >= 200 },
  { id: 'score_500',          name: '500 Punkte',          icon: '🌟', description: '500 Punkte erzielt',          condition: (s) => s.score >= 500 },
];

// ─── Game Actions / Item Types ────────────────────────────────────────────────
export const ACTIONS = [
  { de: 'Nehmen',  tr: 'Almak',  math: 1  },
  { de: 'Abgeben', tr: 'Vermek', math: -1 },
];

export const ITEM_TYPES = [
  { de: 'Positive', tr: 'Pozitif', math: 1,  class: 'positive', emoji: '+' },
  { de: 'Negative', tr: 'Negatif', math: -1, class: 'negative', emoji: '−' },
];

// ─── Initial Game State ───────────────────────────────────────────────────────
/**
 * FIX BUG 1: totalGamesPlayed eklendi.
 * @returns {GameState}
 */
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
    totalGamesPlayed:        0,  // FIX BUG 1
    negativeNegativeCorrect: 0,
    unlockedAchievements:    new Set(),
    gameRound:               0,
    phase:                   'idle',
    turnStartTime:           null,
  };
}

// ─── Instruction Generator ────────────────────────────────────────────────────
/**
 * Generates a random instruction.
 * @param {number} levelIndex
 * @param {number} [currentBalance=0]
 * @returns {Instruction}
 */
export function generateInstruction(levelIndex, currentBalance = 0) {
  const level      = LEVELS[levelIndex] ?? LEVELS[0];
  const [min, max] = level.range;

  // Level 5–6: Üslü ifadeler veya parantezli bileşik işlemler
  if (levelIndex >= 4) {
    return Math.random() < 0.5
      ? _genPower(levelIndex, currentBalance, min, max)
      : _genCompound(levelIndex, currentBalance, min, max);
  }

  // Level 3–4: Çarpma veya bölme
  if (levelIndex >= 2) {
    return Math.random() < 0.5
      ? _genMultiply(levelIndex, currentBalance, min, max)
      : _genDivide(levelIndex, currentBalance, min, max);
  }

  // Level 1–2: Mevcut toplama/çıkarma davranışı
  const amount     = randomInt(min, max);
  const action     = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const itemType   = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  const mathResult = action.math * itemType.math * amount;

  const actionSign = action.math === 1 ? '+' : '-';
  const itemSign   = itemType.math === 1 ? '+' : '-';
  const correctExpression = `${actionSign}(${itemSign}${amount})`;
  const newBalance = currentBalance + mathResult;

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
    operatorType: 'addsubtract',
  };
}

/** Level 3–4: Tamsayı çarpma */
function _genMultiply(levelIndex, currentBalance, min, max) {
  const a = randomInt(min, Math.min(max, 9));
  const bSign = Math.random() < 0.5 ? 1 : -1;
  const b = randomInt(min, Math.min(max, 9));
  const mathResult = a * bSign * b;
  const bStr = bSign === -1 ? `(−${b})` : `${b}`;
  const correctExpression = `${a}×${bStr}`;
  const newBalance = currentBalance + mathResult;
  return {
    action: ACTIONS[0], itemType: ITEM_TYPES[0],
    amount: a, mathResult, correctExpression,
    newBalance, currentBalance, levelIndex,
    isNegNeg: false, operatorType: 'multiply',
  };
}

/** Level 3–4: Tamsayı bölme (yalnızca tam bölünen) */
function _genDivide(levelIndex, currentBalance, min, max) {
  const divisor = randomInt(2, Math.min(max, 6));
  const quotientSign = Math.random() < 0.5 ? 1 : -1;
  const quotient = randomInt(min, Math.min(max, 6));
  const dividend = divisor * quotient * quotientSign;
  const mathResult = quotientSign * quotient;
  const dividendStr = dividend < 0 ? `(−${Math.abs(dividend)})` : `${dividend}`;
  const correctExpression = `${dividendStr}÷${divisor}`;
  const newBalance = currentBalance + mathResult;
  return {
    action: ACTIONS[0], itemType: ITEM_TYPES[0],
    amount: Math.abs(dividend), mathResult, correctExpression,
    newBalance, currentBalance, levelIndex,
    isNegNeg: false, operatorType: 'divide',
  };
}

/** Level 5–6: Üslü ifadeler */
function _genPower(levelIndex, currentBalance, min, max) {
  const base = randomInt(-Math.min(max, 5), Math.min(max, 5)) || 2;
  const exp = Math.random() < 0.5 ? 2 : 3;
  const mathResult = Math.pow(base, exp);
  const baseStr = base < 0 ? `(−${Math.abs(base)})` : `${base}`;
  const expStr = exp === 2 ? '²' : '³';
  const correctExpression = `${baseStr}${expStr}`;
  const newBalance = currentBalance + mathResult;
  return {
    action: ACTIONS[0], itemType: ITEM_TYPES[0],
    amount: Math.abs(base), mathResult, correctExpression,
    newBalance, currentBalance, levelIndex,
    isNegNeg: false, operatorType: 'power',
  };
}

/** Level 5–6: Parantezli bileşik işlemler */
function _genCompound(levelIndex, currentBalance, min, max) {
  const a = randomInt(min, Math.min(max, 8));
  const bSign = Math.random() < 0.5 ? 1 : -1;
  const b = randomInt(min, Math.min(max, 8));
  const multiplier = randomInt(2, Math.min(max, 5)) * (Math.random() < 0.5 ? 1 : -1);
  const inner = a + bSign * b;
  const mathResult = inner * multiplier;
  const bStr = bSign === -1 ? `(−${b})` : `+${b}`;
  const mStr = multiplier < 0 ? `(−${Math.abs(multiplier)})` : `${multiplier}`;
  const correctExpression = `(${a}${bStr})×${mStr}`;
  const newBalance = currentBalance + mathResult;
  return {
    action: ACTIONS[0], itemType: ITEM_TYPES[0],
    amount: Math.abs(inner), mathResult, correctExpression,
    newBalance, currentBalance, levelIndex,
    isNegNeg: false, operatorType: 'compound',
  };
}

// ─── Answer Validation ────────────────────────────────────────────────────────
/**
 * Validates the user's inputs.
 * FIX HATA 11: null/undefined guard eklendu.
 *
 * @param {string}       rawExpression
 * @param {string|number} rawBalance
 * @param {Instruction}  instruction
 * @returns {{ expressionOk: boolean, balanceOk: boolean, allOk: boolean }}
 */
export function validateAnswer(rawExpression, rawBalance, instruction) {
  // FIX HATA 11 — null guards
  if (!instruction) {
    return { expressionOk: false, balanceOk: false, allOk: false };
  }
  if (rawExpression == null || rawBalance == null) {
    return { expressionOk: false, balanceOk: false, allOk: false };
  }

  const { correctExpression, newBalance, mathResult } = instruction;

  // Normalize expression — neue Operatoren unterstützen
  const normalised = String(rawExpression)
    .trim()
    .replace(/\s/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/²/g, '**2')
    .replace(/³/g, '**3');

  const expressionOk = isValidExpression(normalised, correctExpression, mathResult);

  // Balance validation
  const parsedBalance = parseFloat(String(rawBalance).replace(',', '.'));
  const balanceOk = !isNaN(parsedBalance) && Math.round(parsedBalance) === Math.round(newBalance);

  return {
    expressionOk,
    balanceOk,
    allOk: expressionOk && balanceOk,
  };
}

/**
 * Checks if the expression is mathematically equivalent.
 * @param {string} userExpr   - normalized user expression
 * @param {string} canonical  - canonical e.g. "-(−5)"
 * @param {number} expected   - numerical result
 * @returns {boolean}
 */
function isValidExpression(userExpr, canonical, expected) {
  if (userExpr.toLowerCase() === canonical.toLowerCase()) return true;

  try {
    if (!/^[0-9+\-×÷²³\^*\/().]+$/.test(userExpr)) return false;
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + userExpr + ')')();
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result) === Math.round(expected);
    }
  } catch (_) {
    // evaluation failed
  }
  return false;
}

// ─── Level Progression ────────────────────────────────────────────────────────
/**
 * @param {number} streak
 * @returns {number} level index (0–5)
 */
export function getLevelFromStreak(streak) {
  let levelIdx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (streak >= LEVELS[i].streakRequired) {
      levelIdx = i;
      break;
    }
  }
  return levelIdx;
}

/**
 * @param {number} streak
 * @param {number} levelIndex
 * @returns {{ pct: number, current: number, target: number, atMax: boolean }}
 */
export function getLevelProgress(streak, levelIndex) {
  const atMax = levelIndex >= LEVELS.length - 1;
  if (atMax) return { pct: 100, current: streak, target: streak, atMax: true };

  const currentReq  = LEVELS[levelIndex].streakRequired;
  const nextReq     = LEVELS[levelIndex + 1].streakRequired;
  const progressIn  = streak - currentReq;
  const rangeIn     = nextReq - currentReq;
  const pct = Math.min(100, Math.max(0, Math.round((progressIn / rangeIn) * 100)));

  return { pct, current: progressIn, target: rangeIn, atMax: false };
}

// ─── Achievement Checker ──────────────────────────────────────────────────────
/**
 * @param {GameState} state
 * @returns {Achievement[]} newly unlocked achievements
 */
export function checkAchievements(state) {
  const stats = {
    totalCorrect:            state.totalCorrect,
    maxStreak:               state.maxStreak,
    negativeNegativeCorrect: state.negativeNegativeCorrect,
    maxLevel:                state.maxLevel + 1,
    score:                   state.score,
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

// ─── Computer AI ──────────────────────────────────────────────────────────────
/**
 * FIX HATA 3 + 12: correct params, newComputerBal properly returned.
 * @param {number} levelIndex
 * @param {number} computerBalance
 * @returns {{ instruction: Instruction, newComputerBal: number }}
 */
export function computerPlay(levelIndex, computerBalance) {
  const instruction    = generateInstruction(levelIndex, computerBalance);
  const newComputerBal = instruction.newBalance;
  return { instruction, newComputerBal };
}

// ─── Score Calculation ────────────────────────────────────────────────────────
/**
 * FIX HATA 4: parametre sırası doğru — (levelIndex, streak)
 * @param {number} levelIndex
 * @param {number} streak
 * @returns {number}
 */
export function calculateScore(levelIndex, streak) {
  const base        = LEVELS[Math.min(levelIndex, LEVELS.length - 1)].scorePerCorrect;
  const streakBonus = Math.floor(streak / 5) * 5;
  return base + streakBonus;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function formatSigned(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Builds a human-readable hint for the cheat sheet.
 * @param {Instruction} instruction
 * @returns {string}
 */
export function buildHint(instruction) {
  if (!instruction) return '';
  const { action, itemType, amount, mathResult, correctExpression, currentBalance, newBalance, operatorType } = instruction;

  const change = mathResult >= 0
    ? `steigt dein Guthaben um ${Math.abs(mathResult)}`
    : `sinkt dein Guthaben um ${Math.abs(mathResult)}`;
  const balanceStr = `${currentBalance} ${mathResult >= 0 ? '+' : '−'} ${Math.abs(mathResult)} = <strong>${newBalance}</strong>`;

  if (operatorType === 'multiply') {
    return `💡 Das Ergebnis von <strong>${correctExpression}</strong> ergibt ${mathResult}. Daher ${change}: ${balanceStr}.`;
  }
  if (operatorType === 'divide') {
    return `💡 Das Ergebnis von <strong>${correctExpression}</strong> ergibt ${mathResult}. Daher ${change}: ${balanceStr}.`;
  }
  if (operatorType === 'power') {
    return `💡 <strong>${correctExpression}</strong> bedeutet: die Zahl mit sich selbst multiplizieren. Das Ergebnis ist ${mathResult}. Daher ${change}: ${balanceStr}.`;
  }
  if (operatorType === 'compound') {
    return `💡 Zuerst den Klammerausdruck berechnen, dann multiplizieren: <strong>${correctExpression}</strong> = ${mathResult}. Daher ${change}: ${balanceStr}.`;
  }

  // addsubtract (Standard)
  const verb = action.math === 1 ? 'nimmst' : 'gibst';
  return `💡 Du ${verb} ${amount} ${itemType.de} Ticket${amount !== 1 ? 's' : ''} — das entspricht <strong>${correctExpression}</strong>. Daher ${change}: ${balanceStr}.`;
}
