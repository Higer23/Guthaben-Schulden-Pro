/**
 * storage.js (Firebase-Synced Version)
 * =====================================
 * Local storage as primary, Firebase Realtime DB as cloud sync.
 * Guthaben-Schulden-Spiel Pro Edition
 */

import {
  updateUserGameStats, getUserGameStats, saveGameSession,
  getUserAchievements, unlockAchievement as fbUnlockAchievement,
  saveQuestion,
} from './firebase-config.js';

const KEY_SAVE        = 'gss_save_v3';
const KEY_HIGH_SCORE  = 'gss_highscore_v2';
const KEY_UNLOCKED    = 'gss_achievements_v2';
const KEY_STATS       = 'gss_stats_v2';

// ─── LOCAL SAVE ──────────────────────────────────────────────────────────────
export function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(KEY_SAVE) || '{}');
  } catch { return {}; }
}

export function saveProgress(state) {
  const data = {
    maxStreak:              state.maxStreak,
    maxLevel:               state.maxLevel,
    negativeNegativeCorrect: state.negativeNegativeCorrect,
    lastPlayed:             Date.now(),
  };
  localStorage.setItem(KEY_SAVE, JSON.stringify(data));
}

export function saveOnNewGame() {
  const d = loadSave();
  d.lastPlayed = Date.now();
  localStorage.setItem(KEY_SAVE, JSON.stringify(d));
}

export function getHighScore() {
  return parseInt(localStorage.getItem(KEY_HIGH_SCORE) || '0');
}

export function updateHighScore(score) {
  const cur = getHighScore();
  if (score > cur) localStorage.setItem(KEY_HIGH_SCORE, String(score));
  return Math.max(score, cur);
}

export function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem(KEY_UNLOCKED) || '[]'); }
  catch { return []; }
}

export function saveUnlockedAchievements(arr) {
  localStorage.setItem(KEY_UNLOCKED, JSON.stringify(arr));
}

// ─── FIREBASE SYNC ───────────────────────────────────────────────────────────

// Call after each game round to sync score/level to Firebase
export async function syncStatsToFirebase(uid, state) {
  if (!uid || uid === '__admin__') return;
  try {
    await updateUserGameStats(uid, {
      totalScore:       state.score || 0,
      currentLevel:     state.currentLevel || 1,
      maxLevel:         Math.max(state.maxLevel || 1, state.currentLevel || 1),
      currentStreak:    state.currentStreak || 0,
      maxStreak:        state.maxStreak || 0,
      totalGamesPlayed: state.gamesPlayed || 0,
      totalCorrect:     state.totalCorrect || 0,
      totalAttempts:    state.totalAttempts || 0,
    });
  } catch (e) {
    console.warn('Firebase sync failed (offline?):', e.message);
  }
}

// Load stats from Firebase on login
export async function loadStatsFromFirebase(uid) {
  if (!uid || uid === '__admin__') return null;
  try {
    return await getUserGameStats(uid);
  } catch { return null; }
}

// Save achievement to Firebase
export async function syncAchievement(uid, achievementId) {
  if (!uid || uid === '__admin__') return;
  try {
    await fbUnlockAchievement(uid, achievementId);
  } catch (e) {
    console.warn('Achievement sync failed:', e.message);
  }
}

// Save a game session
export async function syncSession(uid, sessionData) {
  if (!uid || uid === '__admin__') return;
  try {
    await saveGameSession(uid, sessionData);
  } catch (e) {
    console.warn('Session sync failed:', e.message);
  }
}

// ─── STATS (LOCAL) ───────────────────────────────────────────────────────────

export function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(KEY_STATS) || '{"attempts":[],"sessions":[]}');
  } catch { return { attempts: [], sessions: [] }; }
}

export function saveStats(s) {
  localStorage.setItem(KEY_STATS, JSON.stringify(s));
}

export function recordAttempt(isCorrect, type) {
  const s = loadStats();
  s.attempts = s.attempts || [];
  s.attempts.push({ ts: Date.now(), correct: isCorrect, type });
  if (s.attempts.length > 2000) s.attempts = s.attempts.slice(-2000);
  saveStats(s);
}

export function recordSession(score, correct, total) {
  const s = loadStats();
  s.sessions = s.sessions || [];
  s.sessions.push({ ts: Date.now(), score, correct, total });
  if (s.sessions.length > 200) s.sessions = s.sessions.slice(-200);
  saveStats(s);
}

export function clearStats() {
  localStorage.removeItem(KEY_STATS);
  localStorage.removeItem(KEY_SAVE);
  localStorage.removeItem(KEY_HIGH_SCORE);
  localStorage.removeItem(KEY_UNLOCKED);
}

// ─── EXPORT USER DATA (GDPR) ─────────────────────────────────────────────────
export function exportUserData(profile, gameStats, sessions) {
  const data = {
    exportedAt: new Date().toISOString(),
    profile: { username: profile?.username, email: profile?.email, createdAt: profile?.createdAt },
    gameStats,
    localSessions: sessions || [],
    achievements: getUnlockedAchievements(),
    highScore: getHighScore(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gss-verilerim-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
