/**
 * firebase-config.js
 * ==================
 * Firebase Realtime Database Setup & All DB Operations
 * Guthaben-Schulden-Spiel Pro Edition
 *
 * ⚠️  SETUP REQUIRED: Replace the config below with YOUR Firebase project config.
 *    See README.md for step-by-step Firebase setup instructions.
 */

// ─── FIREBASE CONFIGURATION ──────────────────────────────────────────────────
// Replace these values with your Firebase project settings
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


// ─── DATABASE ROOT PATH ──────────────────────────────────────────────────────
export const DB_ROOT = "guthaben-schulden-spiel-db";

// ─── FIREBASE STATE ──────────────────────────────────────────────────────────
let _db    = null;
let _ready = false;

// ─── INIT ────────────────────────────────────────────────────────────────────
export async function initFirebase() {
  try {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    const { getDatabase, ref, set, get, update, push, remove, onValue, off, serverTimestamp }
      = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");

    if (!getApps().length) {
      initializeApp(FIREBASE_CONFIG);
    }
    _db = getDatabase();
    _ready = true;

    // Store firebase refs globally for convenience
    window._fbRef   = ref;
    window._fbSet   = set;
    window._fbGet   = get;
    window._fbUpdate = update;
    window._fbPush  = push;
    window._fbRemove = remove;
    window._fbOnValue = onValue;
    window._fbOff   = off;
    window._fbDB    = _db;
    window._fbServerTs = serverTimestamp;

    console.log('%c🔥 Firebase connected', 'color:#ff9900;font-family:monospace');
    return true;
  } catch (err) {
    console.error('Firebase init failed:', err);
    return false;
  }
}

export function isFirebaseReady() { return _ready; }
export function getDB()          { return _db; }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function dbRef(path) {
  return window._fbRef(window._fbDB, `${DB_ROOT}/${path}`);
}

async function dbGet(path) {
  try {
    const snap = await window._fbGet(dbRef(path));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
}

async function dbSet(path, value) {
  try { await window._fbSet(dbRef(path), value); return true; }
  catch (e) { console.error('dbSet error', e); return false; }
}

async function dbUpdate(path, value) {
  try { await window._fbUpdate(dbRef(path), value); return true; }
  catch (e) { console.error('dbUpdate error', e); return false; }
}

async function dbPush(path, value) {
  try {
    const r = await window._fbPush(dbRef(path), value);
    return r.key;
  } catch (e) { console.error('dbPush error', e); return null; }
}

async function dbRemove(path) {
  try { await window._fbRemove(dbRef(path)); return true; }
  catch { return false; }
}

// ─── USER OPERATIONS ─────────────────────────────────────────────────────────

export async function getAllUsers() {
  const data = await dbGet('users');
  return data || {};
}

export async function getUserByUsername(username) {
  const users = await getAllUsers();
  for (const [uid, user] of Object.entries(users)) {
    if (user.profile?.username?.toLowerCase() === username.toLowerCase()) {
      return { uid, ...user };
    }
  }
  return null;
}

export async function createUser(userData) {
  const uid = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const profile = {
    username:  userData.username,
    email:     userData.email || '',
    password:  userData.password,
    createdAt: Date.now(),
    lastLogin: Date.now(),
    isAdmin:   false,
    status:    'active',
    theme:     'dark',
    avatar:    '',
    bio:       '',
  };
  const game = {
    stats: {
      totalScore:       0,
      currentLevel:     1,
      maxLevel:         1,
      currentStreak:    0,
      maxStreak:        0,
      totalGamesPlayed: 0,
      totalCorrect:     0,
      totalAttempts:    0,
    },
    sessions: {},
    achievements: {},
    questionHistory: {},
  };
  await dbSet(`users/${uid}/profile`, profile);
  await dbSet(`users/${uid}/game`, game);
  await dbSet(`users/${uid}/devices`, {});
  await dbSet(`users/${uid}/messages/inbox`, {});
  await dbSet(`users/${uid}/messages/sent`, {});
  await dbSet(`users/${uid}/friends`, {});
  await dbSet(`users/${uid}/notifications`, {});

  // Update system stats
  const totalUsers = (await dbGet('admin/logs/system/totalUsers')) || 0;
  await dbSet('admin/logs/system/totalUsers', totalUsers + 1);

  return uid;
}

export async function updateUserProfile(uid, updates) {
  return await dbUpdate(`users/${uid}/profile`, updates);
}

export async function updateUserGameStats(uid, stats) {
  return await dbUpdate(`users/${uid}/game/stats`, stats);
}

export async function getUserProfile(uid) {
  return await dbGet(`users/${uid}/profile`);
}

export async function getUserGameStats(uid) {
  return await dbGet(`users/${uid}/game/stats`);
}

export async function deleteUser(uid) {
  return await dbRemove(`users/${uid}`);
}

// ─── DEVICE OPERATIONS ───────────────────────────────────────────────────────

export async function getUserDevices(uid) {
  return (await dbGet(`users/${uid}/devices`)) || {};
}

export async function upsertDevice(uid, deviceInfo) {
  const devices = await getUserDevices(uid);
  // Find existing device with same deviceId
  let existingKey = null;
  for (const [key, dev] of Object.entries(devices)) {
    if (dev.deviceId === deviceInfo.deviceId) {
      existingKey = key;
      break;
    }
  }
  if (existingKey) {
    await dbUpdate(`users/${uid}/devices/${existingKey}`, {
      lastLogin:  Date.now(),
      loginCount: (devices[existingKey].loginCount || 0) + 1,
      ipAddress:  deviceInfo.ipAddress,
    });
    return devices[existingKey].isBanned || false;
  } else {
    const devKey = `device_${Date.now()}`;
    await dbSet(`users/${uid}/devices/${devKey}`, {
      ...deviceInfo,
      firstLogin: Date.now(),
      lastLogin:  Date.now(),
      loginCount: 1,
      isBanned:   false,
    });
    return false;
  }
}

export async function banDevice(uid, deviceKey, banned) {
  return await dbUpdate(`users/${uid}/devices/${deviceKey}`, { isBanned: banned });
}

// ─── SESSION OPERATIONS ──────────────────────────────────────────────────────

export async function saveGameSession(uid, sessionData) {
  const key = `session_${Date.now()}`;
  await dbSet(`users/${uid}/game/sessions/${key}`, sessionData);
  return key;
}

// ─── MESSAGE OPERATIONS ──────────────────────────────────────────────────────

export async function sendMessage(fromUid, toUid, subject, body, fromName, toName) {
  const msgData = {
    from:    fromUid,
    fromName,
    to:      toUid,
    toName,
    subject,
    body,
    sentAt:  Date.now(),
    isRead:  false,
    reply:   null,
  };
  const key = `msg_${Date.now()}`;
  await dbSet(`users/${toUid}/messages/inbox/${key}`, msgData);
  await dbSet(`users/${fromUid}/messages/sent/${key}`, msgData);
  // Notification
  await pushNotification(toUid, {
    type:    'message',
    title:   `Yeni Mesaj: ${subject}`,
    body:    `${fromName} sana mesaj gönderdi.`,
    sentAt:  Date.now(),
    isRead:  false,
  });
  return key;
}

export async function getInbox(uid) {
  return (await dbGet(`users/${uid}/messages/inbox`)) || {};
}

export async function markMessageRead(uid, msgKey) {
  return await dbUpdate(`users/${uid}/messages/inbox/${msgKey}`, { isRead: true });
}

export async function replyToMessage(uid, msgKey, replyText) {
  return await dbUpdate(`users/${uid}/messages/inbox/${msgKey}`, { reply: replyText });
}

export async function getSentMessages(uid) {
  return (await dbGet(`users/${uid}/messages/sent`)) || {};
}

// ─── NOTIFICATION OPERATIONS ─────────────────────────────────────────────────

export async function pushNotification(uid, notifData) {
  return await dbPush(`users/${uid}/notifications`, notifData);
}

export async function getNotifications(uid) {
  return (await dbGet(`users/${uid}/notifications`)) || {};
}

export async function markNotifRead(uid, notifKey) {
  return await dbUpdate(`users/${uid}/notifications/${notifKey}`, { isRead: true });
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

export async function getLeaderboard() {
  const users = await getAllUsers();
  const board = [];
  for (const [uid, user] of Object.entries(users)) {
    if (!user.profile) continue;
    board.push({
      uid,
      username:    user.profile.username,
      avatar:      user.profile.avatar || '',
      totalScore:  user.game?.stats?.totalScore     || 0,
      maxStreak:   user.game?.stats?.maxStreak      || 0,
      maxLevel:    user.game?.stats?.maxLevel       || 1,
      gamesPlayed: user.game?.stats?.totalGamesPlayed || 0,
    });
  }
  return board.sort((a, b) => b.totalScore - a.totalScore);
}

// ─── FRIENDS OPERATIONS ──────────────────────────────────────────────────────

export async function getFriends(uid) {
  return (await dbGet(`users/${uid}/friends`)) || {};
}

export async function addFriend(uid, friendUid, friendUsername) {
  await dbSet(`users/${uid}/friends/${friendUid}`, {
    username: friendUsername,
    addedAt:  Date.now(),
    status:   'pending',
  });
  await dbSet(`users/${friendUid}/friends/${uid}`, {
    username: (await getUserProfile(uid))?.username || 'Bilinmiyor',
    addedAt:  Date.now(),
    status:   'pending',
  });
  await pushNotification(friendUid, {
    type:   'friend_request',
    title:  'Arkadaşlık İsteği',
    body:   `${(await getUserProfile(uid))?.username} seni arkadaş olarak ekledi.`,
    sentAt: Date.now(),
    isRead: false,
  });
}

export async function acceptFriend(uid, friendUid) {
  await dbUpdate(`users/${uid}/friends/${friendUid}`, { status: 'accepted' });
  await dbUpdate(`users/${friendUid}/friends/${uid}`, { status: 'accepted' });
}

export async function sendChallenge(fromUid, toUid, score) {
  const fromProfile = await getUserProfile(fromUid);
  await pushNotification(toUid, {
    type:        'challenge',
    title:       'Meydan Okuma!',
    body:        `${fromProfile?.username} seni meydan okuyor! Hedef puan: ${score}`,
    challengeBy: fromUid,
    targetScore: score,
    sentAt:      Date.now(),
    isRead:      false,
  });
}

// ─── ADMIN OPERATIONS ────────────────────────────────────────────────────────

export async function getAdminLogs() {
  return (await dbGet('admin/logs')) || {};
}

export async function logAdminAction(adminUid, action, targetUid) {
  const key = `action_${Date.now()}`;
  await dbSet(`admin/logs/all_actions/${key}`, {
    admin:     adminUid,
    action,
    target:    targetUid || null,
    timestamp: Date.now(),
  });
}

export async function getSystemStats() {
  const users = await getAllUsers();
  const now   = Date.now();
  const day   = 24 * 60 * 60 * 1000;

  let totalUsers   = 0;
  let activeToday  = 0;
  const browserMap = {};
  const osMap      = {};

  for (const [, user] of Object.entries(users)) {
    totalUsers++;
    if (user.profile?.lastLogin > now - day) activeToday++;
    const devs = user.devices || {};
    for (const dev of Object.values(devs)) {
      const b = (dev.browser || 'Unknown').split(' ')[0];
      const o = dev.os || 'Unknown';
      browserMap[b] = (browserMap[b] || 0) + 1;
      osMap[o]      = (osMap[o] || 0) + 1;
    }
  }

  return { totalUsers, activeToday, browserMap, osMap };
}

// ─── QUESTION HISTORY ────────────────────────────────────────────────────────

export async function saveQuestion(uid, question, userAnswer, isCorrect, timeTaken) {
  const key = `q_${Date.now()}`;
  await dbSet(`users/${uid}/game/questionHistory/${key}`, {
    question,
    userAnswer,
    isCorrect,
    timestamp: Date.now(),
    timeTaken,
  });
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

export async function unlockAchievement(uid, achievementId) {
  await dbSet(`users/${uid}/game/achievements/${achievementId}`, {
    unlocked:   true,
    unlockedAt: Date.now(),
  });
  await pushNotification(uid, {
    type:   'achievement',
    title:  '🏆 Yeni Rozet!',
    body:   `"${achievementId}" rozetini kazandın!`,
    sentAt: Date.now(),
    isRead: false,
  });
}

export async function getUserAchievements(uid) {
  return (await dbGet(`users/${uid}/game/achievements`)) || {};
}

// ─── REAL-TIME LISTENER ──────────────────────────────────────────────────────

export function listenToNotifications(uid, callback) {
  const r = window._fbRef(window._fbDB, `${DB_ROOT}/users/${uid}/notifications`);
  window._fbOnValue(r, (snap) => {
    callback(snap.val() || {});
  });
  return r; // return ref for cleanup
}

export function listenToInbox(uid, callback) {
  const r = window._fbRef(window._fbDB, `${DB_ROOT}/users/${uid}/messages/inbox`);
  window._fbOnValue(r, (snap) => callback(snap.val() || {}));
  return r;
}
