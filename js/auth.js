/**
 * auth.js
 * =======
 * Authentication module — username/password based login.
 * SECURITY NOTE: Passwords should be hashed (bcrypt) before storing.
 * This is a simplified implementation for educational purposes.
 */

import {
  getUserByUsername, createUser, setCurrentUser,
  clearCurrentUser, getCurrentUser as fbGetCurrentUser,
  recordDevice,
} from './firebase-config.js';

const SESSION_KEY = 'gss_session_v2';

// ─── Simple hash (NOT cryptographically secure — use bcrypt in production) ──
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data    = encoder.encode(password + '_gss_salt_2024');
  const hash    = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Login ────────────────────────────────────────────────────
export async function loginUser(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Kullanıcı adı ve şifre zorunlu.' };
  }

  try {
    // ADMIN shortcut (FIX: admin password should not be hardcoded — use env/config)
    if (username === 'Higer') {
      const adminPwd = await hashPassword(19105887638'); // Change this!
      const inputPwd = await hashPassword(password);
      if (inputPwd !== adminPwd) {
        return { success: false, error: 'Yanlış şifre.' };
      }
      const adminUser = {
        uid: '__admin__',
        profile: { username: 'Admin', isAdmin: true },
      };
      setCurrentUser(adminUser);
      saveSession(adminUser);
      return { success: true };
    }

    const userData = await getUserByUsername(username);
    if (!userData) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    const inputHash = await hashPassword(password);
    if (userData.profile?.passwordHash !== inputHash) {
      return { success: false, error: 'Yanlış şifre.' };
    }

    const user = {
      uid:     userData.uid,
      profile: userData.profile,
    };
    setCurrentUser(user);
    saveSession(user);

    // Record device
    await recordDevice(userData.uid).catch(() => {});

    return { success: true };
  } catch (e) {
    console.error('loginUser error:', e);
    return { success: false, error: 'Giriş hatası: ' + e.message };
  }
}

// ─── Signup ───────────────────────────────────────────────────
export async function signupUser(username, password, email) {
  if (!username || username.length < 3) {
    return { success: false, error: 'Kullanıcı adı en az 3 karakter olmalı.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Şifre en az 6 karakter olmalı.' };
  }
  if (username.toLowerCase() === 'admin') {
    return { success: false, error: 'Bu kullanıcı adı kullanılamaz.' };
  }

  try {
    const existing = await getUserByUsername(username);
    if (existing) {
      return { success: false, error: 'Bu kullanıcı adı zaten alınmış.' };
    }

    const uid          = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const passwordHash = await hashPassword(password);

    const userData = {
      profile: {
        username,
        email:        email || '',
        passwordHash,
        isAdmin:      false,
        createdAt:    Date.now(),
        theme:        'dark',
        bio:          '',
      },
      gameStats: {
        totalScore:       0,
        maxLevel:         1,
        maxStreak:        0,
        totalGamesPlayed: 0,
        totalCorrect:     0,
        totalAttempts:    0,
      },
    };

    await createUser(uid, userData);

    const user = { uid, profile: userData.profile };
    setCurrentUser(user);
    saveSession(user);

    return { success: true };
  } catch (e) {
    console.error('signupUser error:', e);
    return { success: false, error: 'Kayıt hatası: ' + e.message };
  }
}

// ─── Session Persistence ──────────────────────────────────────
function saveSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: user.uid, username: user.profile?.username, savedAt: Date.now() }));
  } catch (_) {}
}

export async function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const sess = JSON.parse(raw);
    if (!sess.uid) return false;

    // Session expires after 30 days
    if (Date.now() - (sess.savedAt || 0) > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    if (sess.uid === '__admin__') {
      setCurrentUser({ uid: '__admin__', profile: { username: 'Admin', isAdmin: true } });
      return true;
    }

    const userData = await import('./firebase-config.js').then(m => m.getUserProfile(sess.uid));
    if (!userData) { localStorage.removeItem(SESSION_KEY); return false; }

    setCurrentUser({ uid: sess.uid, profile: userData.profile });
    return true;
  } catch (_) {
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
