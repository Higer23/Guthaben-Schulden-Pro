/**
 * auth.js
 * =======
 * Authentifizierungsmodul — Benutzername/Passwort-basierter Login
 *
 * HINWEIS: Passwörter werden im Klartext gespeichert (wie gewünscht),
 * damit der Admin doppelte Passwörter erkennen und Benutzer sperren kann.
 */

import {
  getUserByUsername, createUser, setCurrentUser,
  clearCurrentUser, getCurrentUser as fbGetCurrentUser,
  recordDevice, dbUpdate,
} from './firebase-config.js';

// ─── Super-Admin Konfiguration ───────────────────────────────────────────────
const SUPER_ADMIN = {
  username: 'Higer',
  password: '19105887638',
  uid:      '__admin__',
};

const SESSION_KEY = 'gss_session_v4';

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginUser(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Benutzername und Passwort sind erforderlich.' };
  }

  try {
    // Super-Admin-Prüfung (Hardcoded)
    if (username === SUPER_ADMIN.username) {
      if (password !== SUPER_ADMIN.password) {
        return { success: false, error: 'Falsches Passwort.' };
      }
      const adminUser = {
        uid:     SUPER_ADMIN.uid,
        profile: {
          username: 'Higer',
          displayName: 'Administrator',
          isAdmin:  true,
          avatar:   '👑',
        },
      };
      setCurrentUser(adminUser);
      saveSession(adminUser);
      return { success: true, isAdmin: true };
    }

    const userData = await getUserByUsername(username);
    if (!userData) {
      return { success: false, error: 'Benutzer nicht gefunden.' };
    }

    // Passwort-Prüfung im Klartext
    if (userData.profile?.password !== password) {
      return { success: false, error: 'Falsches Passwort.' };
    }

    // Gesperrte Benutzer prüfen
    if (userData.profile?.banned) {
      return { success: false, error: 'Dein Konto wurde gesperrt. Wende dich an den Administrator.' };
    }

    const user = {
      uid:     userData.uid,
      profile: userData.profile,
    };
    setCurrentUser(user);
    saveSession(user);

    // Letzten Login + Aktivitätsprotokoll aktualisieren
    await dbUpdate(`users/${userData.uid}/profile`, {
      lastLogin:  Date.now(),
      loginCount: (userData.profile?.loginCount || 0) + 1,
    }).catch(() => {});

    // Gerätedaten erfassen
    recordDevice(userData.uid).catch(() => {});

    return { success: true };
  } catch (e) {
    console.error('loginUser Fehler:', e);
    return { success: false, error: 'Anmeldefehler: ' + e.message };
  }
}

// ─── Registrierung ───────────────────────────────────────────────────────────
export async function signupUser(username, password, email) {
  if (!username || username.trim().length < 3) {
    return { success: false, error: 'Benutzername muss mindestens 3 Zeichen lang sein.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Passwort muss mindestens 6 Zeichen lang sein.' };
  }
  if (username.toLowerCase() === 'admin' || username === SUPER_ADMIN.username) {
    return { success: false, error: 'Dieser Benutzername ist nicht verfügbar.' };
  }
  if (!/^[a-zA-Z0-9_äöüÄÖÜß.-]+$/.test(username)) {
    return { success: false, error: 'Benutzername darf nur Buchstaben, Zahlen und _ enthalten.' };
  }

  try {
    const existing = await getUserByUsername(username);
    if (existing) {
      return { success: false, error: 'Dieser Benutzername ist bereits vergeben.' };
    }

    const uid      = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now      = Date.now();

    const userData = {
      profile: {
        username:      username.trim(),
        email:         email?.trim() || '',
        password,       // Klartext-Passwort (wie gewünscht für Admin-Vergleich)
        isAdmin:        false,
        banned:         false,
        createdAt:      now,
        lastLogin:      now,
        loginCount:     1,
        theme:          'dark',
        bio:            '',
        avatar:         '',
        dailyStreak:    0,
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

    // Gerätedaten erfassen
    recordDevice(uid).catch(() => {});

    return { success: true };
  } catch (e) {
    console.error('signupUser Fehler:', e);
    return { success: false, error: 'Registrierungsfehler: ' + e.message };
  }
}

// ─── Session-Persistenz ─────────────────────────────────────────────────────
function saveSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      uid:      user.uid,
      username: user.profile?.username,
      savedAt:  Date.now(),
    }));
  } catch (_) {}
}

export async function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const sess = JSON.parse(raw);
    if (!sess.uid) return false;

    // Session läuft nach 30 Tagen ab
    if (Date.now() - (sess.savedAt || 0) > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    if (sess.uid === SUPER_ADMIN.uid) {
      setCurrentUser({
        uid:     SUPER_ADMIN.uid,
        profile: { username: 'Higer', displayName: 'Administrator', isAdmin: true, avatar: '👑' },
      });
      return true;
    }

    const { getUserProfile } = await import('./firebase-config.js');
    const userData = await getUserProfile(sess.uid);
    if (!userData) { localStorage.removeItem(SESSION_KEY); return false; }

    if (userData.profile?.banned) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

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
