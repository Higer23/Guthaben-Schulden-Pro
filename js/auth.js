 /**
 * auth.js
 * =======
 * Kimlik Doğrulama Modülü
 * Düzeltme: Firebase fonksiyonlarını yeni yapıdan doğru şekilde import eder.
 */

import {
  getUserByUsername, createUser, setCurrentUser,
  clearCurrentUser, getCurrentUser as fbGetCurrentUser,
  recordDevice, dbUpdate, getUserProfile
} from './firebase-config.js';

// ─── Super-Admin Yapılandırması ─────────────────────────────────────────────
const SUPER_ADMIN = {
  username: 'Higer',
  password: '19105887638', // İsteğiniz üzerine düz metin şifre
  uid:      '__admin__',
};

const SESSION_KEY = 'gss_session_v4';

// ─── Giriş İşlemi ───────────────────────────────────────────────────────────
export async function loginUser(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Kullanıcı adı ve şifre gereklidir.' };
  }

  try {
    // 1. Super Admin Kontrolü
    if (username === SUPER_ADMIN.username) {
      if (password !== SUPER_ADMIN.password) {
        return { success: false, error: 'Hatalı şifre.' };
      }
      const adminUser = {
        uid: SUPER_ADMIN.uid,
        profile: {
          username: 'Higer',
          displayName: 'Administrator',
          isAdmin: true,
          avatar: '👑',
        },
      };
      setCurrentUser(adminUser);
      saveSession(adminUser);
      return { success: true, isAdmin: true };
    }

    // 2. Normal Kullanıcı Kontrolü
    const userData = await getUserByUsername(username);
    
    if (!userData) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    // Şifre Kontrolü (Düz Metin)
    if (userData.profile?.password !== password) {
      return { success: false, error: 'Hatalı şifre.' };
    }

    // Ban Kontrolü
    if (userData.profile?.banned) {
      return { success: false, error: 'Hesabınız askıya alınmıştır.' };
    }

    const user = {
      uid: userData.uid,
      profile: userData.profile,
    };
    
    setCurrentUser(user);
    saveSession(user);

    // Son giriş zamanını güncelle (Hata olsa bile devam et)
    dbUpdate(`users/${userData.uid}/profile`, {
      lastLogin: Date.now(),
      loginCount: (userData.profile?.loginCount || 0) + 1,
    }).catch(console.error);

    recordDevice(userData.uid).catch(console.error);

    return { success: true };

  } catch (e) {
    console.error('Login Hatası:', e);
    return { success: false, error: 'Giriş yapılamadı: ' + e.message };
  }
}

// ─── Kayıt İşlemi ───────────────────────────────────────────────────────────
export async function signupUser(username, password, email) {
  if (!username || username.trim().length < 3) {
    return { success: false, error: 'Kullanıcı adı en az 3 karakter olmalı.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Şifre en az 6 karakter olmalı.' };
  }
  
  // Yasaklı isimler
  if (username.toLowerCase() === 'admin' || username === SUPER_ADMIN.username) {
    return { success: false, error: 'Bu kullanıcı adı alınamaz.' };
  }
  
  if (!/^[a-zA-Z0-9_äöüÄÖÜß.-]+$/.test(username)) {
    return { success: false, error: 'Kullanıcı adı geçersiz karakterler içeriyor.' };
  }

  try {
    const existing = await getUserByUsername(username);
    if (existing) {
      return { success: false, error: 'Bu kullanıcı adı zaten alınmış.' };
    }

    const uid = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = Date.now();

    const userData = {
      profile: {
        username:      username.trim(),
        email:         email?.trim() || '',
        password:      password, // Admin görsün diye düz metin
        isAdmin:       false,
        banned:        false,
        createdAt:     now,
        lastLogin:     now,
        loginCount:    1,
        theme:         'dark',
        dailyStreak:   0,
        lastDailyClaim: 0,
      },
      gameStats: {
        totalScore:       0,
        maxLevel:         1,
        maxStreak:        0,
        currentStreak:    0,
        currentLevel:     0,
        totalGamesPlayed: 0,
        totalCorrect:     0,
        totalAttempts:    0,
        updatedAt:        now,
      },
    };

    await createUser(uid, userData);

    const user = { uid, profile: userData.profile };
    setCurrentUser(user);
    saveSession(user);
    recordDevice(uid).catch(() => {});

    return { success: true };

  } catch (e) {
    console.error('Kayıt Hatası:', e);
    return { success: false, error: 'Kayıt başarısız: ' + e.message };
  }
}

// ─── Oturum Yönetimi ────────────────────────────────────────────────────────
function saveSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      uid: user.uid,
      username: user.profile?.username,
      savedAt: Date.now(),
    }));
  } catch (_) {}
}

export async function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    
    const sess = JSON.parse(raw);
    if (!sess.uid) return false;

    // Oturum süresi (30 gün)
    if (Date.now() - (sess.savedAt || 0) > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    // Admin Session
    if (sess.uid === SUPER_ADMIN.uid) {
      setCurrentUser({
        uid: SUPER_ADMIN.uid,
        profile: { username: 'Higer', displayName: 'Administrator', isAdmin: true, avatar: '👑' },
      });
      return true;
    }

    // Kullanıcı verisini Firebase'den taze çek
    const userData = await getUserProfile(sess.uid);
    if (!userData) { 
      localStorage.removeItem(SESSION_KEY); 
      return false; 
    }

    if (userData.profile?.banned) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    setCurrentUser({ uid: sess.uid, profile: userData.profile });
    return true;

  } catch (e) {
    console.warn("Session restore hatası:", e);
    return false;
  }
}

export function logoutUser() {
  clearCurrentUser();
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  return fbGetCurrentUser();
}

export function isAdmin() {
  return getCurrentUser()?.profile?.isAdmin === true;
}
