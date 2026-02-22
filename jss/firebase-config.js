/**
 * firebase-config.js
 * ==================
 * Firebase Realtime Database wrapper.
 * Configure your Firebase project below.
 *
 * SECURITY NOTE:
 *   - Never store admin password in source code (Güvenlik 2)
 *   - Use Firebase Security Rules to protect data (Güvenlik 3)
 *   - Use users_by_username index for login (Güvenlik 4)
 */

// ─── YOUR FIREBASE CONFIG HERE ────────────────────────────────
// Replace with your actual Firebase project config
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB6dLJ5VYAM8LaqQxy0vZDHL-xlMjf6qrU",
  authDomain:        "guthaben-schulden-spiel.firebaseapp.com",
  databaseURL:       "https://guthaben-schulden-spiel-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "guthaben-schulden-spiel",
  storageBucket:     "guthaben-schulden-spiel.firebasestorage.app",
  messagingSenderId: "925520444668",
  appId:             "1:925520444668:web:f2b6be19772199848d2b79",
  measurementId:     "G-8D53J7JYEC" // İsteğe bağlı (Analytics için)
};


// ─── Module-scoped Firebase references (FIX MİMARİ 1) ────────
// No global window._fb* — all kept in module scope
let _db   = null;
let _ref, _get, _set, _update, _push, _remove, _onValue, _off, _serverTs;

let _currentUser = null;

// ─── Init ─────────────────────────────────────────────────────
export async function initFirebase() {
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getDatabase, ref, get, set, update, push, remove, onValue, off, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

    if (!getApps().length) initializeApp(FIREBASE_CONFIG);
    _db        = getDatabase();
    _ref       = ref;
    _get       = get;
    _set       = set;
    _update    = update;
    _push      = push;
    _remove    = remove;
    _onValue   = onValue;
    _off       = off;
    _serverTs  = serverTimestamp;
    return true;
  } catch (e) {
    console.warn('[Firebase] Init failed:', e.message);
    return false;
  }
}

// ─── Low-level helpers ────────────────────────────────────────
function dbRef(path) { return _ref(_db, path); }

async function dbGet(path) {
  const snap = await _get(dbRef(path));
  return snap.exists() ? snap.val() : null;
}

async function dbSet(path, value) {
  await _set(dbRef(path), value);
}

async function dbUpdate(path, value) {
  await _update(dbRef(path), value);
}

// ─── Current User ─────────────────────────────────────────────
export function getCurrentUser()         { return _currentUser; }
export function setCurrentUser(user)     { _currentUser = user; }
export function clearCurrentUser()       { _currentUser = null; }
export function isAdmin()                { return _currentUser?.profile?.isAdmin === true; }

// ─── Auth ─────────────────────────────────────────────────────
/**
 * FIX GÜVENLİK 4: getUserByUsername — users_by_username index kullanır.
 */
export async function getUserByUsername(username) {
  try {
    // Try fast index lookup first
    const uid = await dbGet(`users_by_username/${username.toLowerCase()}`);
    if (uid) {
      const userData = await dbGet(`users/${uid}`);
      return userData ? { uid, ...userData } : null;
    }
    // Fallback: scan (for legacy data)
    const users = await dbGet('users');
    if (!users) return null;
    for (const [uid, user] of Object.entries(users)) {
      if (user.profile?.username?.toLowerCase() === username.toLowerCase()) {
        return { uid, ...user };
      }
    }
    return null;
  } catch (e) {
    console.warn('getUserByUsername error:', e);
    return null;
  }
}

export async function createUser(uid, userData) {
  await dbSet(`users/${uid}`, userData);
  // FIX GÜVENLİK 4: username index
  if (userData.profile?.username) {
    await dbSet(`users_by_username/${userData.profile.username.toLowerCase()}`, uid);
  }
}

export async function getUserProfile(uid) {
  return await dbGet(`users/${uid}`);
}

export async function updateUserProfile(uid, updates) {
  await dbUpdate(`users/${uid}/profile`, updates);
}

// ─── Game Stats ───────────────────────────────────────────────
export async function updateUserGameStats(uid, stats) {
  await dbUpdate(`users/${uid}/gameStats`, stats);
  // FIX PERFORMANS 1: leaderboard hafif koleksiyonu güncelle
  const user = await dbGet(`users/${uid}/profile`);
  await dbUpdate(`leaderboard/${uid}`, {
    username:    user?.username || '?',
    totalScore:  stats.totalScore  || 0,
    maxStreak:   stats.maxStreak   || 0,
    maxLevel:    stats.maxLevel    || 1,
    gamesPlayed: stats.totalGamesPlayed || 0,
    updatedAt:   Date.now(),
  });
}

export async function getUserGameStats(uid) {
  return await dbGet(`users/${uid}/gameStats`);
}

export async function saveGameSession(uid, session) {
  const sessRef = dbRef(`users/${uid}/sessions`);
  await _push(sessRef, { ...session, timestamp: Date.now() });
}

// ─── Achievements ─────────────────────────────────────────────
export async function getUserAchievements(uid) {
  return await dbGet(`users/${uid}/achievements`) || [];
}

export async function unlockAchievement(uid, achievementId) {
  await dbUpdate(`users/${uid}/achievements`, { [achievementId]: Date.now() });
}

// ─── Inbox / Messaging ────────────────────────────────────────
export async function getInbox(uid) {
  try {
    return await dbGet(`users/${uid}/inbox`) || {};
  } catch (_) {
    return {};
  }
}

export async function markMessageRead(uid, msgKey) {
  await dbUpdate(`users/${uid}/inbox/${msgKey}`, { isRead: true });
}

export async function replyToMessage(uid, msgKey, reply) {
  await dbUpdate(`users/${uid}/inbox/${msgKey}`, { reply, repliedAt: Date.now() });
}

export async function sendMessageToUser(uid, msg) {
  const msgRef = dbRef(`users/${uid}/inbox`);
  await _push(msgRef, {
    subject:  msg.subject,
    body:     msg.body,
    from:     'admin',
    fromName: 'Admin',
    sentAt:   Date.now(),
    isRead:   false,
  });
}

// ─── Admin ────────────────────────────────────────────────────
export async function getAllUsers() {
  return await dbGet('users') || {};
}

export async function getSystemStats() {
  return await dbGet('systemStats') || {};
}

export async function deleteUser(uid) {
  await dbSet(`users/${uid}`, null);
  const user = await dbGet(`users/${uid}/profile`);
  if (user?.username) {
    await dbSet(`users_by_username/${user.username.toLowerCase()}`, null);
  }
}

// ─── Leaderboard ──────────────────────────────────────────────
/**
 * FIX PERFORMANS 1: hafif leaderboard koleksiyonu.
 */
export async function getLeaderboard() {
  try {
    return await dbGet('leaderboard') || {};
  } catch (_) {
    return {};
  }
}

// ─── Devices ─────────────────────────────────────────────────
export async function recordDevice(uid) {
  const deviceId = `${navigator.platform}_${Date.now()}`;
  await dbUpdate(`users/${uid}/devices/${deviceId}`, {
    userAgent: navigator.userAgent,
    lastSeen:  Date.now(),
    platform:  navigator.platform,
  });
}
