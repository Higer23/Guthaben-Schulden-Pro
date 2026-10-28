# ⚖️ Guthaben-Schulden-Spiel — Pro Edition

> **An interactive game that teaches positive and negative numbers — Firebase for online play, PWA with offline support**

[![Version](https://img.shields.io/badge/version-3.0.0--fixed-cyan)](#)
[![License](https://img.shields.io/badge/license-MIT-purple)](#)
[![PWA](https://img.shields.io/badge/PWA-ready-green)](#)
[![Bugs Fixed](https://img.shields.io/badge/bugs%20fixed-21%2B-red)](#bug-fixes)

---

## 🚀 Features

- **6 levels** — progression from "Anfänger" (beginner) to "Meister" (master)
- **Streaks & achievements** — 9 badges
- **Computer opponent** — AI rival player
- **Statistics dashboard** — Chart.js charts and heatmap
- **Firebase Auth** — sign in with username and password
- **PWA** — playable offline (Service Worker)
- **DE/TR** — German and Turkish language support
- **Teacher mode** — timer, level locking, cheat sheet
- **Leaderboard** — global ranking
- **Admin panel** — user management, bulk messages

---

## 📁 File Structure

```
gss-pro/
├── index.html          # Main HTML (all UI)
├── css/
│   └── styles.css      # Custom styles (glassmorphism, animations)
├── js/
│   ├── app.js          # ⭐ Main entry point — all game logic
│   ├── gameLogic.js    # Pure game logic (no DOM, testable)
│   ├── ui.js           # DOM and animation layer
│   ├── stats.js        # Statistics and chart engine
│   ├── i18n.js         # Multi-language support (DE/TR)
│   ├── audio.js        # Web Audio API sound synthesis
│   ├── storage.js      # LocalStorage + Firebase sync
│   ├── admin.js        # Admin panel (user management)
│   ├── auth.js         # Authentication
│   ├── social.js       # Leaderboard, friends
│   └── firebase-config.js  # Firebase wrapper
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (offline)
└── README.md           # This file
```

---

## ⚙️ Setup

### 1. Create a Firebase project

1. [Firebase Console](https://console.firebase.google.com) → New project
2. **Realtime Database** → Create → start in test mode
3. Project settings → Add a web app → copy the config

### 2. Update firebase-config.js

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIza...",
  authDomain:        "project-id.firebaseapp.com",
  databaseURL:       "https://project-id-default-rtdb.firebaseio.com",
  projectId:         "project-id",
  storageBucket:     "project-id.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc",
};
```

### 3. Firebase Security Rules

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "$uid === auth.uid || root.child('users').child(auth.uid).child('profile/isAdmin').val() === true",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('profile/isAdmin').val() === true"
      }
    },
    "users_by_username": {
      ".read":  true,
      ".write": "auth != null"
    },
    "leaderboard": {
      ".read":  true,
      ".write": "auth != null"
    }
  }
}
```

### 4. Web server

```bash
# Local run with Python
python3 -m http.server 8080
# or
npx serve .
```

Browser: `http://localhost:8080`

---

## 🐛 Fixed Bugs

This release fixes **21 critical/medium bugs and 10+ additional issues**:

### 🔴 Critical fixes (game crashes)

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | app.js | `generateInstruction` called incorrectly | `generateInstruction(levelIndex, balance)` |
| 2 | app.js | `validateAnswer` parameter order | `(expression, balance, instruction)` |
| 3 | app.js | `computerPlay` wrong argument | `computerPlay(levelIndex, computerBalance)` |
| 4 | app.js | `calculateScore` parameter order | `(levelIndex, streak)` |
| 5 | app.js | `renderDashboard` called without arguments | `renderDashboard(state)` |
| 11 | gameLogic.js | `validateAnswer` null crash | Null guard added |
| 13 | ui.js | `renderInstruction` null crash | Null guard added |
| 15 | stats.js | `updateStatCards` undefined state | Guarded with `safeState` |
| 17 | admin.js | No try-catch around Firebase | All async functions wrapped |

### 🟡 Medium fixes

| # | Bug | Fix |
|---|-----|-----|
| 6 | EN language → 3-way toggle | DE/TR only |
| 7 | `recordAttempt` wrong parameters | Full `instruction` object |
| 8 | `recordSession` wrong format | `{ correct, total, streak }` object |
| 9 | `isNegNeg` tracking wrong | Uses the `.isNegNeg` property |
| 10 | Duplicate event listeners | `replaceWith(clone)` pattern |
| 12 | `computerBalance` never updated | `state.computerBalance = compResult.newComputerBal` |
| 14 | Missing i18n for some text | action/itemType texts via `t()` |
| 16 | `renderHeatmap` called without arguments | Falls back to `loadStats()` |
| 18 | Body scroll lock | `openAdminPanel` / `closeAdminPanel` |
| 19 | Admin pane ID mismatch | Selected via `getElementById` |
| 20 | `initAudio` return value | Returns `boolean` |
| 21 | `document.documentElement.lang` | Set by `initI18n()` and `setLang()` |

### 🔒 Security fixes

- **XSS protection:** all user input written to innerHTML goes through `sanitize()`
- **getUserByUsername:** uses a `users_by_username` index (avoids downloading the whole database)
- **Global `window._fb*`:** moved into module scope

### 🐛 Additional bug fixes

- `totalGamesPlayed` is now defined in `createInitialState()`
- Timer duplication: `startTimer()` calls `stopTimer()` first
- Null guard for `getInbox(uid) ?? {}`
- `profileOverlay` flex class is cleaned up
- Crash screen restarts by removing `localStorage.removeItem('gss_save_v3')`
- Offline banner duplication protection

---

## 🎮 Game Rules

The game generates four operation combinations:

| Operation | Meaning |
|-----------|---------|
| `+(+n)` — Take positive (Nehmen Positiv) | `+n` |
| `+(-n)` — Take negative (Nehmen Negativ) | `-n` |
| `-(+n)` — Give positive (Abgeben Positiv) | `-n` |
| `-(-n)` — Give negative (Abgeben Negativ) | `+n` ✨ |

Players must enter both the **mathematical expression** (for example `-(-5)`) and the **new balance** (for example `7`) correctly.

---

## 🔐 Security Notes

> ⚠️ **Before going to production:**

1. Move the admin password in `auth.js` into an environment variable
2. Configure Firebase Security Rules (use the example above)
3. Password hashing: this version uses SHA-256; for production, use **bcrypt**
4. HTTPS is required (PWA and Firebase need it)

---

## 📊 Technical Architecture

```
index.html
    │
    └── js/app.js (ES module, type="module")
           ├── gameLogic.js  (pure logic, no DOM)
           ├── ui.js          (DOM + RAF animations)
           ├── stats.js       (Chart.js dashboard)
           ├── i18n.js        (DE/TR translations)
           ├── audio.js       (Web Audio API)
           ├── storage.js     (LocalStorage + Firebase)
           ├── auth.js        (sign in / sign up)
           ├── admin.js       (admin panel)
           ├── social.js      (leaderboard / friends)
           └── firebase-config.js (DB wrapper)
```

---

## 🛠️ Developer Notes

### Adding a new level

Add to the `LEVELS` array in `gameLogic.js`:
```js
{ level: 7, name: 'Grand Master', range: [1, 50], streakRequired: 30, scorePerCorrect: 75 }
```

### Adding a new achievement

Add to the `ACHIEVEMENTS` array in `gameLogic.js`:
```js
{ id: 'score_1000', name: '1000 Points', icon: '💯', description: '1000 points!',
  condition: (s) => s.score >= 1000 }
```

### Adding a new language

Add to the `TRANSLATIONS` object in `i18n.js`:
```js
fr: { nehmen: 'PRENDRE', abgeben: 'DONNER', ... }
```
Then update the language toggle in `app.js`: `curr === 'de' ? 'tr' : curr === 'tr' ? 'fr' : 'de'`

---

## 📝 License

MIT License — use, modify and distribute freely.

---

*Made with ❤️ by Higer · Firebase Pro Edition · 2025*
