/**
 * app.js (Firebase Edition)
 * =========================
 * Main Entry Point — Guthaben-Schulden-Spiel Pro Edition
 * Adds: Firebase Auth, Leaderboard, Friends, Admin, Notifications, Dark/Light Mode
 */

import {
  createInitialState, generateInstruction, validateAnswer,
  computerPlay, checkAchievements, calculateScore,
  getLevelFromStreak, getLevelProgress, buildHint, LEVELS,
} from './gameLogic.js';

import {
  initBackground, initConfetti, triggerConfetti,
  renderInstruction, updateBalances, setBalancesImmediate,
  updateScoreUI, showSuccess, showError, showComputerResult,
  hideFeedback, showUserInputArea, showComputerThinking,
  highlightInputs, getInputValues, setCheckBtnEnabled,
  addLogEntry, clearGameLog, renderAchievements,
  showAchievementToast, showLevelUp, showScorePopup,
  setHighScoreDisplay, updateTicketStack,
} from './ui.js';

import {
  loadSave, saveProgress, saveOnNewGame, updateHighScore,
  getHighScore, getUnlockedAchievements, saveUnlockedAchievements,
  syncStatsToFirebase, loadStatsFromFirebase, syncAchievement,
  syncSession, recordAttempt, recordSession, clearStats, exportUserData,
} from './storage.js';

import { initI18n, setLang, t } from './i18n.js';

import {
  initAudio, setAudioEnabled, isAudioEnabled, unlockAudio,
  playSuccess, playError, playLevelUp, playClick,
  playTicket, playStreak, playAchievement,
} from './audio.js';

import {
  recordAttempt as statsRecordAttempt, recordSession as statsRecordSession,
  loadStats, renderDashboard, renderHeatmap, clearStats as statsClear,
} from './stats.js';

import { initFirebase } from './firebase-config.js';
import {
  loginUser, signupUser, logoutUser, restoreSession,
  getCurrentUser, isAdmin as checkIsAdmin,
} from './auth.js';
import { openAdminPanel, closeAdminPanel, loadAdminTab } from './admin.js';
import {
  renderLeaderboard, renderFriendsPanel,
  renderNotifications, startNotificationListener,
} from './social.js';
import {
  getInbox, markMessageRead, replyToMessage,
  getUserProfile, updateUserProfile,
} from './firebase-config.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
let state;
let _sessionStartTime = Date.now();
let _sessionCorrect   = 0;
let _sessionTotal     = 0;

const teacher = {
  active: false, lockedLevel: -1,
  timerSecs: 0, cheatSheet: false,
  customMin: 1, customMax: 10,
};
let _timerInterval = null;
let _firebaseReady = false;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  console.log('%c🎮 Guthaben-Schulden-Spiel – Pro Edition', 'color:#00d4ff;font-family:monospace;font-size:1.2em;font-weight:bold;');

  initI18n();
  initBackground();
  initConfetti();
  const audioOn = initAudio();
  updateAudioIcon(audioOn);

  // Apply saved theme
  applyTheme(localStorage.getItem('gss_theme') || 'dark');

  // Init Firebase
  showLoadingOverlay(true);
  _firebaseReady = await initFirebase();
  showLoadingOverlay(false);

  if (!_firebaseReady) {
    showFirebaseError();
  }

  // Try restore session
  const restored = _firebaseReady ? await restoreSession() : false;

  if (restored) {
    await afterLogin();
  } else {
    showAuthScreen();
  }

  bindGlobalEvents();
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function showAuthScreen() {
  document.getElementById('authOverlay').classList.remove('hidden');
  document.getElementById('authOverlay').classList.add('flex');
  document.getElementById('appWrapper').classList.add('hidden');
}

function hideAuthScreen() {
  document.getElementById('authOverlay').classList.add('hidden');
  document.getElementById('authOverlay').classList.remove('flex');
  document.getElementById('appWrapper').classList.remove('hidden');
}

async function afterLogin() {
  const user = getCurrentUser();
  hideAuthScreen();

  // Load cloud stats if available
  if (_firebaseReady && user && user.uid !== '__admin__') {
    const cloudStats = await loadStatsFromFirebase(user.uid);
    if (cloudStats) {
      // Merge into local save
      const saved = loadSave();
      saved.maxStreak = Math.max(saved.maxStreak || 0, cloudStats.maxStreak || 0);
      saved.maxLevel  = Math.max(saved.maxLevel  || 0, cloudStats.maxLevel  || 1);
    }
    // Apply user theme preference
    if (user.profile?.theme) applyTheme(user.profile.theme);
  }

  // Update header
  updateUserHeader();

  // Check for inbox messages
  if (_firebaseReady && user && user.uid !== '__admin__') {
    checkAndShowInboxOnLogin(user.uid);
    startNotificationListener();
  }

  // Init game
  const savedData = loadSave();
  state = createInitialState();
  state.unlockedAchievements    = new Set(getUnlockedAchievements());
  state.maxStreak               = savedData.maxStreak ?? 0;
  state.maxLevel                = savedData.maxLevel  ?? 0;
  state.negativeNegativeCorrect = savedData.negativeNegativeCorrect ?? 0;

  setBalancesImmediate(0, 0);
  setHighScoreDisplay(getHighScore());
  renderAchievements(state.unlockedAchievements);
  updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));

  bindGameEvents();
  bindTeacherSecretKey();
  bindTabEvents();

  if (getHighScore() === 0 && !savedData.lastPlayed) {
    openRulesModal();
  } else {
    startUserTurn();
  }
}

// ─── HEADER UPDATE ────────────────────────────────────────────────────────────
function updateUserHeader() {
  const user = getCurrentUser();
  if (!user) return;

  const headerUser = document.getElementById('headerUserArea');
  if (!headerUser) return;

  const isAdm = checkIsAdmin();
  headerUser.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
        ${user.profile?.username?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <span class="hidden md:inline text-sm font-semibold text-slate-200">${user.profile?.username || ''}</span>
      ${isAdm ? '<span class="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Admin</span>' : ''}
    </div>
    ${isAdm ? `<button id="adminPanelBtn" class="glass-panel px-3 py-2 rounded-xl hover:border-yellow-400/50 transition-all text-xs font-orbitron text-yellow-400" title="Admin Paneli">
      <i class="fas fa-cog mr-1"></i>Admin
    </button>` : ''}
    <button id="profileBtn" class="glass-panel px-3 py-2 rounded-xl hover:border-purple-400/50 transition-all" title="Profil">
      <i class="fas fa-user text-purple-400"></i>
    </button>
    <button id="notifBtn" class="glass-panel px-3 py-2 rounded-xl hover:border-cyan-400/50 transition-all relative" title="Bildirimler">
      <i class="fas fa-bell text-cyan-400"></i>
      <span id="notifBadge" class="absolute -top-1 -right-1 hidden items-center justify-center w-4 h-4 bg-red-500 text-white text-xs rounded-full font-bold">0</span>
    </button>
    <button id="logoutBtn" class="glass-panel px-3 py-2 rounded-xl hover:border-red-400/50 transition-all text-xs font-orbitron text-red-400" title="Çıkış Yap">
      <i class="fas fa-sign-out-alt mr-1"></i>Çıkış
    </button>`;

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('adminPanelBtn')?.addEventListener('click', openAdminPanel);
  document.getElementById('profileBtn')?.addEventListener('click', openProfilePanel);
  document.getElementById('notifBtn')?.addEventListener('click', toggleNotificationPanel);
}

// ─── LOGIN/SIGNUP HANDLERS ────────────────────────────────────────────────────
function bindAuthEvents() {
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl    = document.getElementById('loginError');

    setAuthLoading(true, 'login');
    const result = await loginUser(username, password);
    setAuthLoading(false, 'login');

    if (!result.success) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    if (result.lowMatch) {
      const proceed = confirm('⚠️ Farklı bir cihazdan giriş yapıyorsunuz.\nDevam etmek istiyor musunuz?');
      if (!proceed) { logoutUser(); return; }
    }

    errEl.classList.add('hidden');
    await afterLogin();
  });

  document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const email    = document.getElementById('signupEmail').value.trim();
    const errEl    = document.getElementById('signupError');

    setAuthLoading(true, 'signup');
    const result = await signupUser(username, password, email);
    setAuthLoading(false, 'signup');

    if (!result.success) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    errEl.classList.add('hidden');
    await afterLogin();
  });

  // Tab switcher
  document.getElementById('showSignup')?.addEventListener('click', () => {
    document.getElementById('loginPanel').classList.add('hidden');
    document.getElementById('signupPanel').classList.remove('hidden');
  });
  document.getElementById('showLogin')?.addEventListener('click', () => {
    document.getElementById('signupPanel').classList.add('hidden');
    document.getElementById('loginPanel').classList.remove('hidden');
  });

  // Guest / offline play
  document.getElementById('guestPlayBtn')?.addEventListener('click', () => {
    hideAuthScreen();
    initOfflineGame();
  });
}

async function handleLogout() {
  // Sync before logout
  const user = getCurrentUser();
  if (_firebaseReady && user && user.uid !== '__admin__') {
    await syncStatsToFirebase(user.uid, { ...state, gamesPlayed: state.totalGamesPlayed });
  }
  logoutUser();
  location.reload();
}

// ─── PROFILE PANEL ────────────────────────────────────────────────────────────
function openProfilePanel() {
  const overlay = document.getElementById('profileOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  renderProfileContent();
}

async function renderProfileContent() {
  const user = getCurrentUser();
  if (!user) return;
  const pane = document.getElementById('profileContent');
  if (!pane) return;

  const profile = user.profile || {};
  const stats   = _firebaseReady && user.uid !== '__admin__'
    ? (await loadStatsFromFirebase(user.uid) || {})
    : {};

  pane.innerHTML = `
    <div class="flex flex-col md:flex-row gap-6">
      <!-- Avatar + Bio -->
      <div class="flex flex-col items-center gap-4 md:w-48">
        <div class="relative">
          <div id="profileAvatarDisplay" class="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white cursor-pointer hover:opacity-80 transition-opacity"
            onclick="document.getElementById('avatarInput').click()" title="Avatarı değiştir">
            ${profile.avatar ? `<img src="${profile.avatar}" class="w-full h-full rounded-full object-cover" />` : profile.username?.charAt(0)?.toUpperCase()}
          </div>
          <div class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center cursor-pointer" onclick="document.getElementById('avatarInput').click()">
            <i class="fas fa-camera text-white text-xs"></i>
          </div>
        </div>
        <input type="file" id="avatarInput" accept="image/*" class="hidden" onchange="window.handleAvatarUpload(event)" />
        <div class="text-center">
          <div class="font-orbitron font-bold text-xl text-slate-200">${profile.username}</div>
          ${profile.isAdmin ? '<span class="text-xs text-yellow-400">👑 Admin</span>' : ''}
        </div>
      </div>

      <!-- Info Form -->
      <div class="flex-1 space-y-4">
        <div>
          <label class="block text-xs text-slate-400 mb-1">Kullanıcı Adı</label>
          <input id="profileUsername" value="${profile.username || ''}" class="game-input w-full px-3 py-2 rounded-xl text-sm" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">E-posta</label>
          <input id="profileEmail" value="${profile.email || ''}" class="game-input w-full px-3 py-2 rounded-xl text-sm" type="email" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Biyografi</label>
          <textarea id="profileBio" class="game-input w-full px-3 py-2 rounded-xl text-sm resize-none" rows="3">${profile.bio || ''}</textarea>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Tema</label>
          <div class="flex gap-3">
            <button onclick="window.switchTheme('dark')" class="flex-1 py-2 rounded-xl border text-sm transition-all ${profile.theme !== 'light' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-white/10 text-slate-400'}">
              🌙 Dark
            </button>
            <button onclick="window.switchTheme('light')" class="flex-1 py-2 rounded-xl border text-sm transition-all ${profile.theme === 'light' ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' : 'border-white/10 text-slate-400'}">
              ☀️ Light
            </button>
          </div>
        </div>
        <button onclick="window.saveProfile()" class="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold font-orbitron hover:bg-cyan-500/30">
          <i class="fas fa-save mr-2"></i>Kaydet
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="mt-6 pt-6 border-t border-white/10">
      <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">Oyun İstatistikleri</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${profileStat('🏆 Toplam Puan', (stats.totalScore || getHighScore()).toLocaleString(), 'cyan')}
        ${profileStat('⭐ Maks Seviye', stats.maxLevel || 1, 'yellow')}
        ${profileStat('🔥 Maks Streak', stats.maxStreak || 0, 'orange')}
        ${profileStat('🎮 Toplam Oyun', stats.totalGamesPlayed || 0, 'purple')}
      </div>
    </div>

    <!-- Export Data -->
    <div class="mt-6 pt-6 border-t border-white/10">
      <button onclick="window.exportMyData()" class="text-xs text-slate-400 hover:text-slate-200 underline transition-colors">
        <i class="fas fa-download mr-1"></i>Verilerimi İndir (JSON/GDPR)
      </button>
    </div>`;
}

function profileStat(label, value, color) {
  const colors = { cyan: 'text-cyan-400', yellow: 'text-yellow-400', orange: 'text-orange-400', purple: 'text-purple-400' };
  return `<div class="bg-white/5 rounded-xl p-3 text-center border border-white/5">
    <div class="font-orbitron text-xl font-black ${colors[color]} mb-1">${value}</div>
    <div class="text-xs text-slate-500">${label}</div>
  </div>`;
}

window.saveProfile = async function() {
  const user = getCurrentUser();
  if (!user || user.uid === '__admin__') return;
  const updates = {
    username: document.getElementById('profileUsername').value.trim() || user.profile.username,
    email:    document.getElementById('profileEmail').value.trim(),
    bio:      document.getElementById('profileBio').value.trim(),
  };
  if (_firebaseReady) {
    await updateUserProfile(user.uid, updates);
    Object.assign(user.profile, updates);
  }
  updateUserHeader();
  showGameToast('Profil kaydedildi ✓', 'green');
};

window.switchTheme = function(theme) {
  applyTheme(theme);
  const user = getCurrentUser();
  if (_firebaseReady && user && user.uid !== '__admin__') {
    updateUserProfile(user.uid, { theme });
    user.profile.theme = theme;
  }
  renderProfileContent();
};

window.exportMyData = function() {
  const user  = getCurrentUser();
  const stats = loadStats();
  exportUserData(user?.profile, {}, stats.sessions);
};

window.handleAvatarUpload = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 200 * 1024) { showGameToast('Resim 200KB\'dan küçük olmalı.', 'red'); return; }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const dataUrl = ev.target.result;
    const user    = getCurrentUser();
    if (_firebaseReady && user && user.uid !== '__admin__') {
      await updateUserProfile(user.uid, { avatar: dataUrl });
      user.profile.avatar = dataUrl;
    }
    const disp = document.getElementById('profileAvatarDisplay');
    if (disp) disp.innerHTML = `<img src="${dataUrl}" class="w-full h-full rounded-full object-cover" />`;
    updateUserHeader();
  };
  reader.readAsDataURL(file);
};

// ─── NOTIFICATION PANEL ───────────────────────────────────────────────────────
function toggleNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    renderNotifications('notificationsContainer');
  }
}

// ─── INBOX ON LOGIN ───────────────────────────────────────────────────────────
async function checkAndShowInboxOnLogin(uid) {
  if (!_firebaseReady) return;
  const inbox  = await getInbox(uid);
  const unread = Object.entries(inbox).filter(([, m]) => !m.isRead);
  if (unread.length === 0) return;

  // Show first unread message
  const [key, msg] = unread[0];
  const modal = document.getElementById('inboxModal');
  if (!modal) return;
  modal.querySelector('#inboxMsgFrom').textContent    = msg.fromName || msg.from;
  modal.querySelector('#inboxMsgSubject').textContent = msg.subject;
  modal.querySelector('#inboxMsgBody').textContent    = msg.body;
  modal.querySelector('#inboxMsgDate').textContent    = new Date(msg.sentAt).toLocaleString('tr-TR');
  modal.querySelector('#inboxReplyInput').value       = msg.reply || '';
  modal.dataset.msgKey = key;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  await markMessageRead(uid, key);
}

// ─── THEME ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  localStorage.setItem('gss_theme', theme);
  document.documentElement.classList.toggle('dark', theme !== 'light');
  document.documentElement.classList.toggle('light-mode', theme === 'light');
}

// ─── LOADING OVERLAY ─────────────────────────────────────────────────────────
function showLoadingOverlay(show) {
  const el = document.getElementById('fbLoadingOverlay');
  if (el) el.classList.toggle('hidden', !show);
}

function showFirebaseError() {
  const el = document.getElementById('fbErrorBanner');
  if (el) el.classList.remove('hidden');
}

// ─── OFFLINE GAME ─────────────────────────────────────────────────────────────
function initOfflineGame() {
  document.getElementById('appWrapper').classList.remove('hidden');
  const savedData = loadSave();
  state = createInitialState();
  state.unlockedAchievements    = new Set(getUnlockedAchievements());
  state.maxStreak               = savedData.maxStreak ?? 0;
  state.maxLevel                = savedData.maxLevel  ?? 0;
  state.negativeNegativeCorrect = savedData.negativeNegativeCorrect ?? 0;

  setBalancesImmediate(0, 0);
  setHighScoreDisplay(getHighScore());
  renderAchievements(state.unlockedAchievements);
  updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));

  bindGameEvents();
  bindTeacherSecretKey();
  bindTabEvents();

  if (getHighScore() === 0 && !savedData.lastPlayed) {
    openRulesModal();
  } else {
    startUserTurn();
  }

  // Show offline banner
  const banner = document.createElement('div');
  banner.className = 'fixed bottom-4 left-4 z-50 glass-panel border border-yellow-500/30 text-yellow-300 text-xs px-3 py-2 rounded-lg';
  banner.textContent = '⚡ Çevrimdışı mod — ilerleme kaydedilmiyor';
  document.body.appendChild(banner);
}

// ─── GAME LOGIC (same as original app.js) ─────────────────────────────────────

function startUserTurn() {
  state = { ...state, ...generateInstruction(state, teacher) };
  state.phase = 'user';
  hideFeedback();
  clearGameLog();
  renderInstruction(state.currentInstruction);
  updateBalances(state.userBalance, state.computerBalance);
  showUserInputArea();
  setCheckBtnEnabled(true);
  state.turnStartTime = Date.now();

  if (teacher.timerSecs > 0) startTimer();
  const level = teacher.lockedLevel >= 0
    ? LEVELS[teacher.lockedLevel]
    : LEVELS[getLevelFromStreak(state.currentStreak)];
  highlightInputs(state.currentInstruction);

  if (teacher.cheatSheet) {
    const hint = buildHint(state.currentInstruction);
    document.getElementById('cheatOverlay')?.classList.remove('hidden');
    const cheatAns = document.getElementById('cheatAnswer');
    if (cheatAns) cheatAns.textContent = hint;
  }
}

async function handleCheck() {
  if (state.phase !== 'user') return;
  setCheckBtnEnabled(false);
  stopTimer();

  const { expression, balance } = getInputValues();
  const timeTaken = (Date.now() - (state.turnStartTime || Date.now())) / 1000;
  const result    = validateAnswer(state.currentInstruction, expression, balance);

  _sessionTotal++;
  state.totalAttempts = (state.totalAttempts || 0) + 1;

  if (result.correct) {
    _sessionCorrect++;
    state.totalCorrect = (state.totalCorrect || 0) + 1;
    playSuccess();
    const pts = calculateScore(state.currentStreak, timeTaken);
    state.score += pts;
    state.currentStreak++;
    if (state.currentStreak > state.maxStreak) state.maxStreak = state.currentStreak;

    const lvBefore = state.currentLevel;
    state.currentLevel = getLevelFromStreak(state.currentStreak);
    if (state.currentLevel > state.maxLevel) state.maxLevel = state.currentLevel;

    showSuccess(result, pts);
    addLogEntry(state.currentInstruction, true, pts);
    showScorePopup(pts);

    if (state.currentLevel > lvBefore) { playLevelUp(); showLevelUp(state.currentLevel); }

    // Achievements
    const prev = new Set(state.unlockedAchievements);
    checkAchievements(state).forEach(ach => {
      if (!prev.has(ach.id)) {
        state.unlockedAchievements.add(ach.id);
        showAchievementToast(ach);
        playAchievement();
        if (_firebaseReady) {
          const user = getCurrentUser();
          if (user && user.uid !== '__admin__') syncAchievement(user.uid, ach.id);
        }
      }
    });
    saveUnlockedAchievements([...state.unlockedAchievements]);
    renderAchievements(state.unlockedAchievements);
    updateHighScore(state.score);
    setHighScoreDisplay(getHighScore());

    if (state.currentInstruction?.action === 'abgeben' && state.currentInstruction?.type === 'negativ') {
      state.negativeNegativeCorrect = (state.negativeNegativeCorrect || 0) + 1;
    }

    statsRecordAttempt(true, state.currentInstruction?.type);
    recordAttempt(true, state.currentInstruction?.type);
  } else {
    playError();
    state.currentStreak = 0;
    state.currentLevel  = 0;
    showError(result);
    addLogEntry(state.currentInstruction, false, 0);
    statsRecordAttempt(false, state.currentInstruction?.type);
    recordAttempt(false, state.currentInstruction?.type);
  }

  updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));
  updateBalances(state.userBalance, state.computerBalance);
  updateTicketStack(state.currentInstruction, result.correct);
  saveProgress(state);

  // Sync to Firebase periodically (every 5 correct answers)
  if (result.correct && _sessionCorrect % 5 === 0) {
    const user = getCurrentUser();
    if (_firebaseReady && user && user.uid !== '__admin__') {
      syncStatsToFirebase(user.uid, {
        ...state,
        gamesPlayed:  state.totalGamesPlayed,
        score:        state.score,
      });
    }
  }

  // Computer turn
  await delay(1800);
  hideFeedback();
  state.phase = 'computer';
  showComputerThinking();
  await delay(1200);
  const compResult = computerPlay(state);
  showComputerResult(compResult);
  updateBalances(state.userBalance, state.computerBalance);
  await delay(1500);
  startUserTurn();
}

async function handleNewGame() {
  stopTimer();
  const user = getCurrentUser();

  // Save session stats
  if (_firebaseReady && user && user.uid !== '__admin__' && _sessionTotal > 0) {
    syncSession(user.uid, {
      startTime:        _sessionStartTime,
      endTime:          Date.now(),
      score:            state.score || 0,
      questionsAnswered: _sessionTotal,
      correctAnswers:   _sessionCorrect,
    });
    syncStatsToFirebase(user.uid, {
      ...state,
      gamesPlayed: (state.totalGamesPlayed || 0) + 1,
      score:       state.score,
    });
  }

  statsRecordSession(state.score, _sessionCorrect, _sessionTotal);
  recordSession(state.score, _sessionCorrect, _sessionTotal);
  saveOnNewGame();

  // Reset
  _sessionStartTime = Date.now();
  _sessionCorrect   = 0;
  _sessionTotal     = 0;

  const savedData = loadSave();
  state = createInitialState();
  state.unlockedAchievements    = new Set(getUnlockedAchievements());
  state.maxStreak               = savedData.maxStreak ?? 0;
  state.maxLevel                = savedData.maxLevel  ?? 0;
  state.negativeNegativeCorrect = savedData.negativeNegativeCorrect ?? 0;
  state.totalGamesPlayed        = (savedData.totalGamesPlayed || 0) + 1;

  setBalancesImmediate(0, 0);
  setHighScoreDisplay(getHighScore());
  renderAchievements(state.unlockedAchievements);
  updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));
  clearGameLog();
  startUserTurn();
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  let remaining = teacher.timerSecs;
  document.getElementById('timerDisplay')?.classList.remove('hidden');
  _timerInterval = setInterval(() => {
    remaining--;
    const el = document.getElementById('timerValue');
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      stopTimer();
      setCheckBtnEnabled(false);
      showError({ message: '⏰ Zeit abgelaufen!', correct: false });
      state.currentStreak = 0;
      state.currentLevel  = 0;
      updateScoreUI(state, getLevelProgress(0, 0));
      setTimeout(() => { hideFeedback(); startUserTurn(); }, 1800);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(_timerInterval);
  document.getElementById('timerDisplay')?.classList.add('hidden');
}

// ─── TAB EVENTS ───────────────────────────────────────────────────────────────
function bindTabEvents() {
  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active-tab'));
      btn.classList.add('active-tab');
      document.querySelectorAll('.tab-content').forEach(p => {
        p.classList.toggle('hidden', p.id !== `tab-${tab}`);
      });

      // Lazy load tab content
      if (tab === 'leaderboard') renderLeaderboard();
      if (tab === 'friends')     renderFriendsPanel();
      if (tab === 'stats')       { renderDashboard(); renderHeatmap(); }
    });
  });
}

// ─── GLOBAL EVENTS ────────────────────────────────────────────────────────────
function bindGlobalEvents() {
  bindAuthEvents();

  // Admin overlay close
  document.getElementById('closeAdminBtn')?.addEventListener('click', closeAdminPanel);
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => loadAdminTab(btn.dataset.tab));
  });

  // Profile overlay close
  document.getElementById('closeProfileBtn')?.addEventListener('click', () => {
    document.getElementById('profileOverlay')?.classList.add('hidden');
  });

  // Inbox modal reply
  document.getElementById('inboxReplyBtn')?.addEventListener('click', async () => {
    const user  = getCurrentUser();
    const modal = document.getElementById('inboxModal');
    const key   = modal?.dataset.msgKey;
    const reply = document.getElementById('inboxReplyInput')?.value.trim();
    if (!user || !key || !reply) return;
    await replyToMessage(user.uid, key, reply);
    modal.classList.add('hidden');
    showGameToast('Yanıt gönderildi ✓', 'green');
  });

  document.getElementById('closeInboxBtn')?.addEventListener('click', () => {
    document.getElementById('inboxModal')?.classList.add('hidden');
  });

  // Sub modal close (admin edit)
  document.getElementById('closeSubModal')?.addEventListener('click', () => {
    document.getElementById('adminSubModal')?.classList.add('hidden');
  });

  // Click outside notif panel
  document.addEventListener('click', (e) => {
    const panel  = document.getElementById('notifPanel');
    const btn    = document.getElementById('notifBtn');
    if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });

  // Rules modal
  document.getElementById('closeRules')?.addEventListener('click', closeRulesModal);
  document.getElementById('rulesBackdrop')?.addEventListener('click', closeRulesModal);
  document.getElementById('closeRulesBtn')?.addEventListener('click', () => { closeRulesModal(); startUserTurn(); });
  document.getElementById('openRules')?.addEventListener('click', openRulesModal);

  // Teacher modal
  document.getElementById('closeTeacher')?.addEventListener('click', closeTeacherModal);
  document.getElementById('teacherBackdrop')?.addEventListener('click', closeTeacherModal);
  document.getElementById('applyTeacher')?.addEventListener('click', applyTeacherMode);

  // Teacher range display
  document.getElementById('teacherTimer')?.addEventListener('input', function () {
    const el = document.getElementById('teacherTimerDisplay');
    if (el) el.textContent = this.value === '0' ? 'Aus' : `${this.value}s`;
  });

  // Audio toggle
  document.getElementById('audioToggle')?.addEventListener('click', () => {
    const on = !isAudioEnabled();
    setAudioEnabled(on);
    updateAudioIcon(on);
    if (on) unlockAudio();
  });

  // Lang toggle
  document.getElementById('langToggle')?.addEventListener('click', () => {
    const curr = document.documentElement.lang || 'de';
    const next = curr === 'de' ? 'tr' : curr === 'tr' ? 'en' : 'de';
    setLang(next);
    document.documentElement.lang = next;
  });

  // Stats reset
  document.getElementById('resetStats')?.addEventListener('click', () => {
    if (confirm('Tüm istatistikler silinsin mi?')) {
      clearStats(); statsClear(); renderDashboard(); renderHeatmap();
    }
  });
}

function bindGameEvents() {
  document.getElementById('checkBtn')?.addEventListener('click', () => { unlockAudio(); playClick(); handleCheck(); });
  document.getElementById('newGameBtn')?.addEventListener('click', () => { playClick(); handleNewGame(); });
  document.getElementById('expressionInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('balanceInput')?.focus(); }
  });
  document.getElementById('balanceInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { unlockAudio(); playClick(); handleCheck(); }
  });
}

function bindTeacherSecretKey() {
  let buffer = '';
  document.addEventListener('keydown', (e) => {
    buffer += e.key.toLowerCase();
    if (buffer.length > 10) buffer = buffer.slice(-10);
    if (buffer.includes('lehrer')) {
      buffer = '';
      document.getElementById('teacherModeBtn')?.classList.remove('hidden');
      document.getElementById('teacherModeBtn')?.addEventListener('click', openTeacherModal, { once: true });
      showGameToast('🎓 Lehrermodus freigeschaltet!', 'yellow');
    }
  });
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function openRulesModal()   { document.getElementById('rulesModal')?.classList.remove('hidden'); }
function closeRulesModal()  { document.getElementById('rulesModal')?.classList.add('hidden'); }
function openTeacherModal() { document.getElementById('teacherModal')?.classList.remove('hidden'); }
function closeTeacherModal(){ document.getElementById('teacherModal')?.classList.add('hidden'); }

function applyTeacherMode() {
  teacher.active     = true;
  teacher.lockedLevel = parseInt(document.getElementById('teacherLevel')?.value ?? '-1');
  teacher.timerSecs   = parseInt(document.getElementById('teacherTimer')?.value  ?? '0');
  teacher.cheatSheet  = document.getElementById('teacherCheatSheet')?.checked ?? false;
  teacher.customMin   = parseInt(document.getElementById('teacherMin')?.value ?? '1');
  teacher.customMax   = parseInt(document.getElementById('teacherMax')?.value ?? '10');
  closeTeacherModal();
  startUserTurn();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function updateAudioIcon(on) {
  const icon = document.getElementById('audioIcon');
  if (icon) icon.className = on ? 'fas fa-volume-up text-cyan-400' : 'fas fa-volume-mute text-slate-500';
}

function showGameToast(msg, color = 'cyan') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t   = document.createElement('div');
  const cls = { cyan: 'border-cyan-500/40 text-cyan-300', green: 'border-green-500/40 text-green-300',
                 red: 'border-red-500/40 text-red-300', yellow: 'border-yellow-500/40 text-yellow-300' };
  t.className = `glass-panel border ${cls[color] || cls.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function setAuthLoading(loading, form) {
  const btn = document.getElementById(form === 'login' ? 'loginBtn' : 'signupBtn');
  if (!btn) return;
  btn.disabled   = loading;
  btn.innerHTML  = loading
    ? '<i class="fas fa-spinner fa-spin mr-2"></i>Yükleniyor...'
    : form === 'login' ? '<i class="fas fa-sign-in-alt mr-2"></i>Giriş Yap'
                       : '<i class="fas fa-user-plus mr-2"></i>Kayıt Ol';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── BOOT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);

window.addEventListener('error', (e) => {
  console.error('[CRASH]', e.error);
  const screen = document.getElementById('crashScreen');
  const msg    = document.getElementById('crashMessage');
  if (screen && msg) {
    msg.textContent = `Fehler: ${e.message || 'Unbekannter Fehler'}`;
    screen.classList.remove('hidden');
    screen.classList.add('flex');
  }
});
