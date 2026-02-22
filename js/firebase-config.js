/**
 * firebase-config.js
 * ==================
 * Firebase Realtime Database — zentrales Datenbankmodul
 *
 * Firebase-Struktur (hierarchisch & aufgeräumt):
 *   /users/{uid}/profile        — Benutzerprofil
 *   /users/{uid}/gameStats      — Spielstatistiken
 *   /users/{uid}/achievements   — Errungenschaften
 *   /users/{uid}/inbox          — Eingehende Nachrichten (Admin → User)
 *   /users/{uid}/devices        — Geräteprotokolle
 *   /users/{uid}/log            — Login-Aktivitätslogs
 *   /users/{uid}/sessions       — Spielsitzungen
 *   /users/{uid}/friends        — Freundesliste
 *   /users_by_username/{name}   → uid (Index für schnelle Suche)
 *   /leaderboard/{uid}          — Ranglisten-Eintrag
 *   /chats/{chatId}/messages    — User-zu-User Nachrichten
 *   /friendRequests/{uid}       — Freundschaftsanfragen
 */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB6dLJ5VYAM8LaqQxy0vZDHL-xlMjf6qrU",
  authDomain:        "guthaben-schulden-spiel.firebaseapp.com",
  databaseURL:       "https://guthaben-schulden-spiel-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "guthaben-schulden-spiel",
  storageBucket:     "guthaben-schulden-spiel.firebasestorage.app",
  messagingSenderId: "925520444668",
  appId:             "1:925520444668:web:f2b6be19772199848d2b79",
};

// ─── Modul-Scope Firebase-Referenzen ────────────────────────────────────────
let _db = null;
let _ref, _get, _set, _update, _push, _remove, _onValue, _off, _query, _orderByChild, _limitToLast;
let _currentUser = null;

// ─── Initialisierung ────────────────────────────────────────────────────────
export async function initFirebase() {
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const fb = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

    if (!getApps().length) initializeApp(FIREBASE_CONFIG);
    _db           = fb.getDatabase();
    _ref          = fb.ref;
    _get          = fb.get;
    _set          = fb.set;
    _update       = fb.update;
    _push         = fb.push;
    _remove       = fb.remove;
    _onValue      = fb.onValue;
    _off          = fb.off;
    _query        = fb.query;
    _orderByChild = fb.orderByChild;
    _limitToLast  = fb.limitToLast;
    return true;
  } catch (e) {
    console.warn('[Firebase] Initialisierung fehlgeschlagen:', e.message);
    return false;
  }
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────
export function dbRef(path) { return _ref(_db, path); }

export async function dbGet(path) {
  const snap = await _get(dbRef(path));
  return snap.exists() ? snap.val() : null;
}

export async function dbSet(path, value) {
  await _set(dbRef(path), value);
}

export async function dbUpdate(path, value) {
  await _update(dbRef(path), value);
}

export async function dbPush(path, value) {
  return await _push(dbRef(path), value);
}

export function dbOnValue(path, callback) {
  return _onValue(dbRef(path), snap => callback(snap.exists() ? snap.val() : null));
}

export function dbOff(path) {
  _off(dbRef(path));
}

// ─── Aktueller Benutzer ─────────────────────────────────────────────────────
export function getCurrentUser()      { return _currentUser; }
export function setCurrentUser(user)  { _currentUser = user; }
export function clearCurrentUser()    { _currentUser = null; }
export function isAdmin()             { return _currentUser?.profile?.isAdmin === true; }

// ─── Authentifizierung ──────────────────────────────────────────────────────
export async function getUserByUsername(username) {
  try {
    const uid = await dbGet(`users_by_username/${username.toLowerCase()}`);
    if (uid) {
      const userData = await dbGet(`users/${uid}`);
      return userData ? { uid, ...userData } : null;
    }
    // Fallback: vollständiger Scan (für alte Daten)
    const users = await dbGet('users');
    if (!users) return null;
    for (const [uid, user] of Object.entries(users)) {
      if (user.profile?.username?.toLowerCase() === username.toLowerCase()) {
        return { uid, ...user };
      }
    }
    return null;
  } catch (e) {
    console.warn('getUserByUsername Fehler:', e);
    return null;
  }
}

export async function createUser(uid, userData) {
  await dbSet(`users/${uid}`, userData);
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

// ─── Spielstatistiken ───────────────────────────────────────────────────────
export async function updateUserGameStats(uid, stats) {
  await dbUpdate(`users/${uid}/gameStats`, stats);
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
  await dbPush(`users/${uid}/sessions`, { ...session, timestamp: Date.now() });
}

// ─── Admin: Spielerdaten ändern ─────────────────────────────────────────────
export async function adminUpdateUserStats(uid, { score, level, streak }) {
  const updates = {};
  if (score  !== undefined) updates.totalScore   = parseInt(score);
  if (level  !== undefined) updates.maxLevel     = parseInt(level);
  if (streak !== undefined) updates.maxStreak    = parseInt(streak);
  updates.currentLevel  = level  !== undefined ? parseInt(level) - 1 : undefined;
  updates.currentStreak = streak !== undefined ? parseInt(streak) : undefined;
  // Entferne undefined-Werte
  Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
  await dbUpdate(`users/${uid}/gameStats`, updates);
  // Rangliste aktualisieren
  await dbUpdate(`leaderboard/${uid}`, {
    totalScore: updates.totalScore,
    maxLevel:   updates.maxLevel,
    maxStreak:  updates.maxStreak,
    updatedAt:  Date.now(),
  });
}

export async function adminBanUser(uid) {
  await dbUpdate(`users/${uid}/profile`, { banned: true, bannedAt: Date.now() });
}

export async function adminUnbanUser(uid) {
  await dbUpdate(`users/${uid}/profile`, { banned: false });
}

// ─── Errungenschaften ───────────────────────────────────────────────────────
export async function getUserAchievements(uid) {
  return await dbGet(`users/${uid}/achievements`) || {};
}

export async function unlockAchievement(uid, achievementId) {
  await dbUpdate(`users/${uid}/achievements`, { [achievementId]: Date.now() });
}

// ─── Postfach / Nachrichten ─────────────────────────────────────────────────
export async function getInbox(uid) {
  try { return await dbGet(`users/${uid}/inbox`) || {}; }
  catch { return {}; }
}

export async function markMessageRead(uid, msgKey) {
  await dbUpdate(`users/${uid}/inbox/${msgKey}`, { isRead: true, readAt: Date.now() });
}

export async function sendMessageToUser(targetUid, msg, fromUid = null) {
  const sender = getCurrentUser();
  const msgData = {
    subject:  msg.subject  || 'Nachricht',
    body:     msg.body     || '',
    from:     fromUid || (sender?.uid || 'admin'),
    fromName: msg.fromName || (sender?.profile?.username || 'Admin'),
    sentAt:   Date.now(),
    isRead:   false,
  };
  await dbPush(`users/${targetUid}/inbox`, msgData);
}

// ─── Alle Nachrichten abrufen (Admin) ───────────────────────────────────────
export async function getAllMessages() {
  const users = await dbGet('users') || {};
  const allMessages = [];
  for (const [uid, user] of Object.entries(users)) {
    const inbox = user.inbox || {};
    for (const [msgId, msg] of Object.entries(inbox)) {
      allMessages.push({
        msgId, uid,
        recipientName: user.profile?.username || uid,
        ...msg,
      });
    }
  }
  return allMessages.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
}

// ─── Admin ──────────────────────────────────────────────────────────────────
export async function getAllUsers() {
  return await dbGet('users') || {};
}

export async function deleteUser(uid) {
  const user = await dbGet(`users/${uid}/profile`);
  await dbSet(`users/${uid}`, null);
  if (user?.username) {
    await dbSet(`users_by_username/${user.username.toLowerCase()}`, null);
  }
  await dbSet(`leaderboard/${uid}`, null);
}

// ─── Rangliste ───────────────────────────────────────────────────────────────
export async function getLeaderboard() {
  try { return await dbGet('leaderboard') || {}; }
  catch { return {}; }
}

// ─── Geräteprotokoll (Login-Daten sammeln) ───────────────────────────────────
export async function recordDevice(uid) {
  try {
    const nav   = window.navigator;
    const conn  = nav.connection || nav.mozConnection || nav.webkitConnection;
    const bat   = await navigator.getBattery?.().catch(() => null);

    const deviceData = {
      userAgent:        nav.userAgent,
      platform:         nav.platform,
      language:         nav.language,
      languages:        nav.languages?.join(', ') || '',
      screenWidth:      screen.width,
      screenHeight:     screen.height,
      colorDepth:       screen.colorDepth,
      pixelRatio:       window.devicePixelRatio,
      timezone:         Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset:   new Date().getTimezoneOffset(),
      ram:              nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Unbekannt',
      cores:            nav.hardwareConcurrency || 'Unbekannt',
      connectionType:   conn?.effectiveType || conn?.type || 'Unbekannt',
      downlink:         conn?.downlink ? `${conn.downlink} Mbps` : 'Unbekannt',
      cookiesEnabled:   nav.cookieEnabled,
      battery:          bat ? `${Math.round(bat.level * 100)}% (${bat.charging ? 'lädt' : 'Akku'})` : 'Unbekannt',
      touchPoints:      nav.maxTouchPoints,
      doNotTrack:       nav.doNotTrack || 'Unbekannt',
      loginTime:        Date.now(),
      loginTimeHuman:   new Date().toLocaleString('de-DE'),
    };

    const deviceKey = `dev_${Date.now()}`;
    await dbUpdate(`users/${uid}/devices/${deviceKey}`, deviceData);
    await dbPush(`users/${uid}/log`, {
      type:      'login',
      timestamp: Date.now(),
      ip:        'N/A',
      device:    nav.userAgent.slice(0, 80),
    });
  } catch (e) {
    console.warn('Geräteprotokoll fehlgeschlagen:', e.message);
  }
}

// ─── Freundessystem ──────────────────────────────────────────────────────────
export async function sendFriendRequest(fromUid, toUid) {
  await dbSet(`friendRequests/${toUid}/${fromUid}`, {
    from:      fromUid,
    sentAt:    Date.now(),
    status:    'pending',
  });
}

export async function acceptFriendRequest(uid, requestorUid) {
  await dbUpdate(`users/${uid}/friends`, { [requestorUid]: { since: Date.now(), status: 'accepted' } });
  await dbUpdate(`users/${requestorUid}/friends`, { [uid]: { since: Date.now(), status: 'accepted' } });
  await dbSet(`friendRequests/${uid}/${requestorUid}`, null);
}

export async function getFriendRequests(uid) {
  return await dbGet(`friendRequests/${uid}`) || {};
}

export async function getUserFriends(uid) {
  return await dbGet(`users/${uid}/friends`) || {};
}

// ─── User-zu-User Chat ───────────────────────────────────────────────────────
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export async function sendChatMessage(fromUid, toUid, text) {
  const chatId  = getChatId(fromUid, toUid);
  const sender  = getCurrentUser();
  await dbPush(`chats/${chatId}/messages`, {
    from:      fromUid,
    fromName:  sender?.profile?.username || 'Unbekannt',
    to:        toUid,
    text:      text.trim(),
    sentAt:    Date.now(),
    isRead:    false,
  });
}

export function listenChatMessages(fromUid, toUid, callback) {
  const chatId = getChatId(fromUid, toUid);
  return dbOnValue(`chats/${chatId}/messages`, callback);
}

export function stopListenChatMessages(fromUid, toUid) {
  const chatId = getChatId(fromUid, toUid);
  dbOff(`chats/${chatId}/messages`);
}

// ─── Tägliche Belohnung ──────────────────────────────────────────────────────
export async function claimDailyReward(uid) {
  const profile = await dbGet(`users/${uid}/profile`);
  const lastClaim = profile?.lastDailyClaim || 0;
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (now - lastClaim < oneDayMs) {
    const remaining = oneDayMs - (now - lastClaim);
    return { success: false, remaining };
  }

  const streak = (profile?.dailyStreak || 0) + 1;
  const reward = Math.min(50 + streak * 10, 200); // Max 200 Punkte

  await dbUpdate(`users/${uid}/profile`, {
    lastDailyClaim: now,
    dailyStreak: streak,
  });
  await dbUpdate(`users/${uid}/gameStats`, {
    totalScore: (await dbGet(`users/${uid}/gameStats/totalScore`) || 0) + reward,
  });

  return { success: true, reward, streak };
}

// ─── Systemstatistiken ───────────────────────────────────────────────────────
export async function getSystemStats() {
  return await dbGet('systemStats') || {};
}
