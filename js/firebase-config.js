/**
 * firebase-config.js
 * ==================
 * Firebase Realtime Database — Bağlantı ve Veri Yönetimi
 * Düzeltme: Standart ES Modülleri kullanıldı ve Config güncellendi.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getDatabase, ref, get, set, update, push, remove, 
  onValue, off, query, orderByChild, limitToLast 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Konsolundan alınan güncel yapılandırma
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB6dLJ5VYAM8LaqQxy0vZDHL-xlMjf6qrU",
  authDomain:        "guthaben-schulden-spiel.firebaseapp.com",
  databaseURL:       "https://guthaben-schulden-spiel-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "guthaben-schulden-spiel",
  storageBucket:     "guthaben-schulden-spiel.firebasestorage.app",
  messagingSenderId: "925520444668",
  appId:             "1:925520444668:web:f2b6be19772199848d2b79",
  measurementId:     "G-8D53J7JYEC"
};

// ─── Global Değişkenler ─────────────────────────────────────────────────────
let _app = null;
let _db = null;
let _currentUser = null;
let _isOfflineMode = false;

// ─── Initialisierung (Başlatma) ─────────────────────────────────────────────
export async function initFirebase() {
  try {
    console.log("[Firebase] Bağlantı başlatılıyor...");
    
    // Firebase uygulamasını başlat
    _app = initializeApp(FIREBASE_CONFIG);
    
    // Veritabanı örneğini al
    _db = getDatabase(_app);

    // Bağlantı testi yap
    const connectedRef = ref(_db, ".info/connected");
    
    // Bağlantıyı bekle (3 saniye zaman aşımı ile)
    const isConnected = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      onValue(connectedRef, (snap) => {
        clearTimeout(timeout);
        const val = snap.val();
        if (val === true) {
          console.log("[Firebase] ✅ Bağlantı başarılı!");
          resolve(true);
        } else {
          // İlk bağlantı false gelebilir, beklemeye devam etmiyoruz,
          // onValue dinlemeye devam eder ama UI için resolve ediyoruz.
        }
      }, { onlyOnce: true });
    });

    return true; // SDK yüklendiği sürece true dönüyoruz, bağlantı kopuk olsa bile.

  } catch (e) {
    console.error("[Firebase] Kritik Hata:", e);
    _isOfflineMode = true;
    return false;
  }
}

// ─── Veritabanı Yardımcı Fonksiyonları (Wrapper) ────────────────────────────
// Bu fonksiyonlar app.js ve diğer dosyalardaki yapıyı bozmadan modern SDK'yı kullanır.

export function dbRef(path) { 
  if (!_db) return null;
  return ref(_db, path); 
}

export async function dbGet(path) {
  if (_isOfflineMode || !_db) return null;
  try {
    const snapshot = await get(ref(_db, path));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (e) {
    console.warn(`dbGet hatası (${path}):`, e);
    return null;
  }
}

export async function dbSet(path, value) {
  if (_isOfflineMode || !_db) return;
  await set(ref(_db, path), value);
}

export async function dbUpdate(path, value) {
  if (_isOfflineMode || !_db) return;
  await update(ref(_db, path), value);
}

export async function dbPush(path, value) {
  if (_isOfflineMode || !_db) return null;
  return await push(ref(_db, path), value);
}

export async function dbRemove(path) {
  if (_isOfflineMode || !_db) return;
  await remove(ref(_db, path));
}

export function dbOnValue(path, callback) {
  if (_isOfflineMode || !_db) return () => {};
  return onValue(ref(_db, path), (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });
}

export function dbOff(path) {
  if (_isOfflineMode || !_db) return;
  off(ref(_db, path));
}

// ─── Kullanıcı Yönetimi (State) ─────────────────────────────────────────────
export function getCurrentUser()      { return _currentUser; }
export function setCurrentUser(user)  { _currentUser = user; }
export function clearCurrentUser()    { _currentUser = null; }
export function isAdmin()             { return _currentUser?.profile?.isAdmin === true; }

// ─── Authentifizierung (Kimlik Doğrulama) ───────────────────────────────────
export async function getUserByUsername(username) {
  try {
    // Önce index üzerinden dene
    const uid = await dbGet(`users_by_username/${username.toLowerCase()}`);
    if (uid) {
      const userData = await dbGet(`users/${uid}`);
      return userData ? { uid, ...userData } : null;
    }
    
    // Fallback: Tüm kullanıcıları tara (Eski veri yapısı için)
    const users = await dbGet('users');
    if (!users) return null;
    for (const [uid, user] of Object.entries(users)) {
      if (user.profile?.username?.toLowerCase() === username.toLowerCase()) {
        return { uid, ...user };
      }
    }
    return null;
  } catch (e) {
    console.warn('getUserByUsername Hatası:', e);
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

// ─── İstatistikler ve Oyun Verileri ─────────────────────────────────────────
export async function updateUserGameStats(uid, stats) {
  await dbUpdate(`users/${uid}/gameStats`, stats);
  // Leaderboard güncelle
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

// ─── Admin İşlevleri ────────────────────────────────────────────────────────
export async function adminUpdateUserStats(uid, { score, level, streak }) {
  const updates = {};
  if (score  !== undefined) updates.totalScore   = parseInt(score);
  if (level  !== undefined) updates.maxLevel     = parseInt(level);
  if (streak !== undefined) updates.maxStreak    = parseInt(streak);
  
  if (level !== undefined) updates.currentLevel = Math.max(0, parseInt(level) - 1);
  if (streak !== undefined) updates.currentStreak = parseInt(streak);

  await dbUpdate(`users/${uid}/gameStats`, updates);
  
  await dbUpdate(`leaderboard/${uid}`, {
    totalScore: updates.totalScore,
    maxLevel:   updates.maxLevel,
    maxStreak:  updates.maxStreak,
    updatedAt:  Date.now(),
  });
}

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

// ─── Mesajlaşma ve Bildirimler ──────────────────────────────────────────────
export async function getInbox(uid) {
  try { return await dbGet(`users/${uid}/inbox`) || {}; }
  catch { return {}; }
}

export async function markMessageRead(uid, msgKey) {
  await dbUpdate(`users/${uid}/inbox/${msgKey}`, { isRead: true, readAt: Date.now() });
}

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

// ─── Günlük Ödül ────────────────────────────────────────────────────────────
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
  const reward = Math.min(50 + streak * 10, 200);

  await dbUpdate(`users/${uid}/profile`, {
    lastDailyClaim: now,
    dailyStreak: streak,
  });
  
  const currentScore = (await dbGet(`users/${uid}/gameStats/totalScore`)) || 0;
  await dbUpdate(`users/${uid}/gameStats`, {
    totalScore: currentScore + reward,
  });

  return { success: true, reward, streak };
}

// ─── Cihaz Kaydı ────────────────────────────────────────────────────────────
export async function recordDevice(uid) {
  try {
    const nav = window.navigator;
    const deviceData = {
      userAgent: nav.userAgent,
      platform: nav.platform,
      language: nav.language,
      screenWidth: window.screen.width,
      loginTime: Date.now()
    };
    const deviceKey = `dev_${Date.now()}`;
    await dbUpdate(`users/${uid}/devices/${deviceKey}`, deviceData);
  } catch (e) {
    console.warn('Cihaz kaydı yapılamadı:', e);
  }
}

// ─── Arkadaşlık ve Sohbet ───────────────────────────────────────────────────
export async function sendFriendRequest(fromUid, toUid) {
  await dbSet(`friendRequests/${toUid}/${fromUid}`, {
    from: fromUid, sentAt: Date.now(), status: 'pending'
  });
}

export async function getFriendRequests(uid) {
  return await dbGet(`friendRequests/${uid}`) || {};
}

export async function getUserFriends(uid) {
  return await dbGet(`users/${uid}/friends`) || {};
}

export async function acceptFriendRequest(uid, requestorUid) {
  await dbUpdate(`users/${uid}/friends`, { [requestorUid]: { since: Date.now(), status: 'accepted' } });
  await dbUpdate(`users/${requestorUid}/friends`, { [uid]: { since: Date.now(), status: 'accepted' } });
  await dbSet(`friendRequests/${uid}/${requestorUid}`, null);
}

// Sohbet
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export async function sendChatMessage(fromUid, toUid, text) {
  const chatId = getChatId(fromUid, toUid);
  const sender = getCurrentUser();
  await dbPush(`chats/${chatId}/messages`, {
    from: fromUid,
    fromName: sender?.profile?.username || '?',
    to: toUid,
    text: text.trim(),
    sentAt: Date.now(),
    isRead: false
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

export async function getLeaderboard() {
  return await dbGet('leaderboard') || {};
}
