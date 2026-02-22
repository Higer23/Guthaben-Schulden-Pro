/**
 * storage.js
 * ==========
 * Local storage as primary, Firebase as cloud sync.
 * FIXES:
 *   MİMARİ 4: saveProgress — totalGamesPlayed kaydediliyor
 */

import {
  updateUserGameStats, getUserGameStats, saveGameSession,
  getUserAchievements, unlockAchievement as fbUnlockAchievement,
} from './firebase-config.js';

const KEY_SAVE       = 'gss_save_v3';
const KEY_HIGH_SCORE = 'gss_highscore_v2';
const KEY_UNLOCKED   = 'gss_achievements_v2';

// ─── LOCAL SAVE ──────────────────────────────────────────────
export function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(KEY_SAVE) || '{}');
  } catch { return {}; }
}

/**
 * FIX MİMARİ 4: totalGamesPlayed kaydediliyor.
 */
export function saveProgress(state) {
  const data = {
    maxStreak:               state.maxStreak               ?? 0,
    maxLevel:                state.maxLevel                ?? 0,
    negativeNegativeCorrect: state.negativeNegativeCorrect ?? 0,
    totalGamesPlayed:        state.totalGamesPlayed        ?? 0,
    lastPlayed:              Date.now(),
  };
  try {
    localStorage.setItem(KEY_SAVE, JSON.stringify(data));
  } catch (e) {
    console.warn('saveProgress failed:', e);
  }
}

export function saveOnNewGame() {
  const d = loadSave();
  d.lastPlayed = Date.now();
  try { localStorage.setItem(KEY_SAVE, JSON.stringify(d)); } catch (_) {}
}

export function getHighScore() {
  return parseInt(localStorage.getItem(KEY_HIGH_SCORE) || '0');
}

export function updateHighScore(score) {
  const cur = getHighScore();
  if (score > cur) {
    try { localStorage.setItem(KEY_HIGH_SCORE, String(score)); } catch (_) {}
  }
  return Math.max(score, cur);
}

export function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem(KEY_UNLOCKED) || '[]'); }
  catch { return []; }
}

export function saveUnlockedAchievements(arr) {
  try { localStorage.setItem(KEY_UNLOCKED, JSON.stringify(arr)); } catch (_) {}
}

// ─── STATS EXPORT ────────────────────────────────────────────
export function clearStats() {
  localStorage.removeItem('gleichgewicht_stats_v2');
}

export function exportUserData(profile, gameData, sessions) {
  const data = {
    exportedAt: new Date().toISOString(),
    profile:    profile || {},
    gameData:   gameData || {},
    sessions:   sessions || [],
    localStorage: {
      save:    loadSave(),
      highScore: getHighScore(),
      achievements: getUnlockedAchievements(),
    },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gss-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── FIREBASE SYNC ───────────────────────────────────────────
export async function syncStatsToFirebase(uid, state) {
  if (!uid || uid === '__admin__') return;
  try {
    await updateUserGameStats(uid, {
      totalScore:       state.score        || 0,
      currentLevel:     state.currentLevel || 0,
      maxLevel:         Math.max(state.maxLevel || 0, state.currentLevel || 0),
      currentStreak:    state.currentStreak || 0,
      maxStreak:        state.maxStreak     || 0,
      totalGamesPlayed: state.gamesPlayed   || state.totalGamesPlayed || 0,
      totalCorrect:     state.totalCorrect  || 0,
      totalAttempts:    state.totalAttempts || 0,
      updatedAt:        Date.now(),
    });
  } catch (e) {
    console.warn('Firebase sync failed (offline?):', e.message);
  }
}

export async function loadStatsFromFirebase(uid) {
  if (!uid || uid === '__admin__') return null;
  try { return await getUserGameStats(uid); }
  catch { return null; }
}

export async function syncAchievement(uid, achievementId) {
  if (!uid || uid === '__admin__') return;
  try { await fbUnlockAchievement(uid, achievementId); }
  catch (e) { console.warn('Achievement sync failed:', e.message); }
}

export async function syncSession(uid, session) {
  if (!uid || uid === '__admin__') return;
  try { await saveGameSession(uid, session); }
  catch (e) { console.warn('Session sync failed:', e.message); }
}
