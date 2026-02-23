/**
 * app.js — Guthaben-Schulden-Spiel Pro Edition
 * =============================================
 * Main Entry Point — All bugs fixed (Hata 1–21 + Güvenlik + Mimari)
 * Fixes:
 *   HATA 1  : startUserTurn — generateInstruction doğru çağrı
 *   HATA 2  : handleCheck  — validateAnswer parametre sırası + null guard
 *   HATA 3  : computerPlay — doğru argümanlar
 *   HATA 4  : calculateScore — doğru parametre sırası
 *   HATA 5  : renderDashboard — state ile çağrı
 *   HATA 6  : Dil toggle — sadece DE/TR
 *   HATA 7  : recordAttempt — tam instruction objesi
 *   HATA 8  : recordSession — obje formatı
 *   HATA 9  : isNegNeg tracking düzeltildi
 *   HATA 10 : event listener duplikasyonu — replaceWith clone
 *   BUG 1   : totalGamesPlayed tanımlı
 *   BUG 2   : timer duplikasyonu önlendi (startTimer önce stopTimer)
 *   BUG 3   : getInbox null guard
 *   BUG 5   : profileOverlay flex class temizleniyor
 *   BUG 7   : crash screen localStorage temizliyor
 *   UX 3    : offline banner duplikasyon koruması
 *   UX 4    : saveProfile loading state
 *   GÜV 5  : XSS — sanitize() tüm user input innerHTML'de
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
  syncSession, clearStats, exportUserData,
} from './storage.js';

import { initI18n, setLang, t } from './i18n.js';

import {
  initAudio, setAudioEnabled, isAudioEnabled, unlockAudio,
  playSuccess, playError, playLevelUp, playClick,
  playAchievement,
} from './audio.js';

import {
  recordAttempt as statsRecordAttempt,
  recordSession as statsRecordSession,
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

// ─── XSS GUARD ───────────────────────────────────────────────────────────────
/**
 * Sanitize user-supplied strings before inserting into innerHTML.
 * FIX: GÜVENLİK 5 — XSS koruması
 */
function sanitize(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

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

  // FIX HATA 20: initAudio() boolean döndürüp icon güncellemesi
  const audioOn = initAudio();
  updateAudioIcon(typeof audioOn === 'boolean' ? audioOn : isAudioEnabled());

  // Apply saved theme
  applyTheme(localStorage.getItem('gss_theme') || 'dark');

  showLoadingOverlay(true);
  _firebaseReady = await initFirebase();
  showLoadingOverlay(false);

  if (!_firebaseReady) showFirebaseError();

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

  if (_firebaseReady && user && user.uid !== '__admin__') {
    const cloudStats = await loadStatsFromFirebase(user.uid);
    if (cloudStats) {
      const saved = loadSave();
      saved.maxStreak = Math.max(saved.maxStreak || 0, cloudStats.maxStreak || 0);
      saved.maxLevel  = Math.max(saved.maxLevel  || 0, cloudStats.maxLevel  || 1);
    }
    if (user.profile?.theme) applyTheme(user.profile.theme);
  }

  updateUserHeader();

  if (_firebaseReady && user && user.uid !== '__admin__') {
    checkAndShowInboxOnLogin(user.uid);
    startNotificationListener();
  }

  const savedData = loadSave();
  state = createInitialState();
  // FIX BUG 1: totalGamesPlayed createInitialState'de tanımlı olmayabilir
  state.totalGamesPlayed        = savedData.totalGamesPlayed || 0;
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

  const isAdm     = checkIsAdmin();
  // FIX GÜVENLİK 5: username sanitize edildi
  const safeUser  = sanitize(user.profile?.username?.charAt(0)?.toUpperCase() || '?');
  const safeName  = sanitize(user.profile?.username || '');

  headerUser.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
        ${safeUser}
      </div>
      <span class="hidden md:inline text-sm font-semibold text-slate-200">${safeName}</span>
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

  // Note: innerHTML recreates elements, so new listeners are fresh (no duplication)
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

  document.getElementById('showSignup')?.addEventListener('click', () => {
    document.getElementById('loginPanel').classList.add('hidden');
    document.getElementById('signupPanel').classList.remove('hidden');
  });
  document.getElementById('showLogin')?.addEventListener('click', () => {
    document.getElementById('signupPanel').classList.add('hidden');
    document.getElementById('loginPanel').classList.remove('hidden');
  });

  document.getElementById('guestPlayBtn')?.addEventListener('click', () => {
    hideAuthScreen();
    initOfflineGame();
  });
}

async function handleLogout() {
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
      <div class="flex flex-col items-center gap-4 md:w-48">
        <div class="relative">
          <div id="profileAvatarDisplay" class="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white cursor-pointer hover:opacity-80 transition-opacity"
            onclick="document.getElementById('avatarInput').click()" title="Avatarı değiştir">
            ${profile.avatar ? `<img src="${sanitize(profile.avatar)}" class="w-full h-full rounded-full object-cover" />` : sanitize(profile.username?.charAt(0)?.toUpperCase())}
          </div>
          <div class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center cursor-pointer" onclick="document.getElementById('avatarInput').click()">
            <i class="fas fa-camera text-white text-xs"></i>
          </div>
        </div>
        <input type="file" id="avatarInput" accept="image/*" class="hidden" onchange="window.handleAvatarUpload(event)" />
        <div class="text-center">
          <div class="font-orbitron font-bold text-xl text-slate-200">${sanitize(profile.username)}</div>
          ${profile.isAdmin ? '<span class="text-xs text-yellow-400">👑 Admin</span>' : ''}
        </div>
      </div>
      <div class="flex-1 space-y-4">
        <div>
          <label class="block text-xs text-slate-400 mb-1">Kullanıcı Adı</label>
          <input id="profileUsername" value="${sanitize(profile.username || '')}" class="game-input w-full px-3 py-2 rounded-xl text-sm" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">E-posta</label>
          <input id="profileEmail" value="${sanitize(profile.email || '')}" class="game-input w-full px-3 py-2 rounded-xl text-sm" type="email" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Biyografi</label>
          <textarea id="profileBio" class="game-input w-full px-3 py-2 rounded-xl text-sm resize-none" rows="3">${sanitize(profile.bio || '')}</textarea>
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
        <!-- FIX UX 4: loading state -->
        <button id="saveProfileBtn" onclick="window.saveProfile()" class="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold font-orbitron hover:bg-cyan-500/30 transition-all">
          <i class="fas fa-save mr-2"></i>Kaydet
        </button>
      </div>
    </div>
    <div class="mt-6 pt-6 border-t border-white/10">
      <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">Oyun İstatistikleri</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${profileStat('🏆 Toplam Puan', (stats.totalScore || getHighScore()).toLocaleString(), 'cyan')}
        ${profileStat('⭐ Maks Seviye', stats.maxLevel || 1, 'yellow')}
        ${profileStat('🔥 Maks Streak', stats.maxStreak || 0, 'orange')}
        ${profileStat('🎮 Toplam Oyun', stats.totalGamesPlayed || 0, 'purple')}
      </div>
    </div>
    <div class="mt-6 pt-6 border-t border-white/10">
      <button onclick="window.exportMyData()" class="text-xs text-slate-400 hover:text-slate-200 underline transition-colors">
        <i class="fas fa-download mr-1"></i>Verilerimi İndir (JSON/GDPR)
      </button>
    </div>`;
}

function profileStat(label, value, color) {
  const colors = { cyan: 'text-cyan-400', yellow: 'text-yellow-400', orange: 'text-orange-400', purple: 'text-purple-400' };
  return `<div class="bg-white/5 rounded-xl p-3 text-center border border-white/5">
    <div class="font-orbitron text-xl font-black ${colors[color]} mb-1">${sanitize(String(value))}</div>
    <div class="text-xs text-slate-500">${label}</div>
  </div>`;
}

// FIX UX 4: saveProfile — loading state, disabled during save
window.saveProfile = async function() {
  const user = getCurrentUser();
  if (!user || user.uid === '__admin__') return;
  const btn = document.getElementById('saveProfileBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Kaydediliyor...'; }
  try {
    const updates = {
      username: document.getElementById('profileUsername')?.value?.trim() || user.profile.username,
      email:    document.getElementById('profileEmail')?.value?.trim() || '',
      bio:      document.getElementById('profileBio')?.value?.trim() || '',
    };
    if (_firebaseReady) {
      await updateUserProfile(user.uid, updates);
      Object.assign(user.profile, updates);
    }
    updateUserHeader();
    showGameToast('Profil kaydedildi ✓', 'green');
  } catch (e) {
    showGameToast('Kaydetme hatası: ' + e.message, 'red');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-2"></i>Kaydet'; }
  }
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
    if (disp) disp.innerHTML = `<img src="${sanitize(dataUrl)}" class="w-full h-full rounded-full object-cover" />`;
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
// FIX BUG 3: inbox null guard
async function checkAndShowInboxOnLogin(uid) {
  if (!_firebaseReady) return;
  try {
    const inbox  = (await getInbox(uid)) ?? {};
    const unread = Object.entries(inbox).filter(([, m]) => !m.isRead);
    if (unread.length === 0) return;

    const [key, msg] = unread[0];
    const modal = document.getElementById('inboxModal');
    if (!modal) return;
    // FIX GÜVENLİK 5: textContent kullanıldı
    modal.querySelector('#inboxMsgFrom').textContent    = msg.fromName || msg.from || '';
    modal.querySelector('#inboxMsgSubject').textContent = msg.subject  || '';
    modal.querySelector('#inboxMsgBody').textContent    = msg.body     || '';
    modal.querySelector('#inboxMsgDate').textContent    = msg.sentAt ? new Date(msg.sentAt).toLocaleString('tr-TR') : '';
    modal.querySelector('#inboxReplyInput').value       = '';
    modal.dataset.msgKey = key;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await markMessageRead(uid, key);
  } catch (err) {
    console.warn('Inbox load error:', err);
  }
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

  // FIX UX 3: banner duplikasyonu önle
  const existingBanner = document.getElementById('offlineBanner');
  if (!existingBanner) {
    const banner = document.createElement('div');
    banner.id        = 'offlineBanner';
    banner.className = 'fixed bottom-4 left-4 z-50 glass-panel border border-yellow-500/30 text-yellow-300 text-xs px-3 py-2 rounded-lg';
    banner.textContent = '⚡ Çevrimdışı mod — ilerleme kaydedilmiyor';
    document.body.appendChild(banner);
  }

  const savedData = loadSave();
  state = createInitialState();
  // FIX BUG 1
  state.totalGamesPlayed        = savedData.totalGamesPlayed || 0;
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

// ─── GAME LOGIC ───────────────────────────────────────────────────────────────

/**
 * FIX HATA 1: startUserTurn — generateInstruction doğru çağrı
 * FIX BUG 2:  startTimer önce stopTimer ile eski timer temizleniyor
 */
function startUserTurn() {
  // FIX HATA 1: doğru argümanlar — (levelIndex, currentBalance)
  const levelIndex = teacher.lockedLevel >= 0
    ? teacher.lockedLevel
    : getLevelFromStreak(state.currentStreak);

  const instruction = generateInstruction(levelIndex, state.userBalance);
  state.currentInstruction = instruction;  // FIX: spread yerine direkt atama
  state.phase = 'user';
  hideFeedback();
  clearGameLog();
  renderInstruction(state.currentInstruction);
  updateBalances(state.userBalance, state.computerBalance);
  showUserInputArea();
  setCheckBtnEnabled(true);
  state.turnStartTime = Date.now();

  // FIX BUG 2: startTimer içinde önce stopTimer çağrılıyor
  if (teacher.timerSecs > 0) startTimer();
  highlightInputs(state.currentInstruction);

  if (teacher.cheatSheet) {
    const hint = buildHint(state.currentInstruction);
    document.getElementById('cheatOverlay')?.classList.remove('hidden');
    const cheatAns = document.getElementById('cheatAnswer');
    if (cheatAns) cheatAns.innerHTML = hint;
  }
}

/**
 * FIX HATA 2: handleCheck — validateAnswer parametre sırası + null guard
 * FIX HATA 3: computerPlay — doğru argümanlar
 * FIX HATA 4: calculateScore — doğru parametre sırası
 * FIX HATA 7: statsRecordAttempt — tam instruction objesi
 * FIX HATA 8: statsRecordSession — obje formatı
 * FIX HATA 9: isNegNeg tracking
 */
async function handleCheck() {
  if (state.phase !== 'user') return;

  // FIX HATA 2 — null guard
  if (!state.currentInstruction) {
    console.warn('handleCheck: no currentInstruction, skipping');
    return;
  }

  setCheckBtnEnabled(false);
  stopTimer();

  const { expression, balance } = getInputValues();
  const timeTaken = (Date.now() - (state.turnStartTime || Date.now())) / 1000;

  // FIX HATA 2 — parametre sırası: (expression, balance, instruction)
  const result = validateAnswer(expression, balance, state.currentInstruction);

  _sessionTotal++;
  state.totalAttempts = (state.totalAttempts || 0) + 1;

  // FIX HATA 2 — result.correct → result.allOk
  if (result.allOk) {
    _sessionCorrect++;
    state.totalCorrect = (state.totalCorrect || 0) + 1;
    playSuccess();

    // FIX HATA 4 — calculateScore doğru parametre sırası: (levelIndex, streak)
    const levelIndex = getLevelFromStreak(state.currentStreak);
    const pts = calculateScore(levelIndex, state.currentStreak);
    state.score += pts;
    state.currentStreak++;
    if (state.currentStreak > state.maxStreak) state.maxStreak = state.currentStreak;

    const lvBefore = state.currentLevel;
    state.currentLevel = getLevelFromStreak(state.currentStreak);
    if (state.currentLevel > state.maxLevel) state.maxLevel = state.currentLevel;

    showSuccess(pts, state.currentInstruction);
    addLogEntry(
      `✅ ${state.currentInstruction.correctExpression} = ${state.currentInstruction.newBalance}  <span class="text-cyan-400">+${pts}p</span>`,
      'user', true
    );
    showScorePopup(pts);
    triggerConfetti();

    if (state.currentLevel > lvBefore) { playLevelUp(); showLevelUp(state.currentLevel); }

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

    // FIX HATA 9 — isNegNeg tracking doğru alan
    if (state.currentInstruction?.isNegNeg) {
      state.negativeNegativeCorrect = (state.negativeNegativeCorrect || 0) + 1;
    }

    // FIX HATA 7 — tam instruction objesi geçildi
    statsRecordAttempt(true, state.currentInstruction);

  } else {
    playError();
    state.currentStreak = 0;
    state.currentLevel  = 0;

    // Build error message with correct answer
    const { correctExpression, newBalance } = state.currentInstruction;
    const errMsg = `❌ ${t('incorrect_title')} — Doğru: <strong class="text-green-400">${correctExpression}</strong> = <strong class="text-cyan-400">${newBalance}</strong>`;
    showError(errMsg);
    addLogEntry(errMsg, 'user', false);

    // FIX HATA 7
    statsRecordAttempt(false, state.currentInstruction);
  }

  updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));
  state.userBalance = state.currentInstruction.newBalance;
  updateBalances(state.userBalance, state.computerBalance);
  updateTicketStack(state.userBalance, state.currentInstruction);
  saveProgress(state);

  // Sync to Firebase periodically
  if (result.allOk && _sessionCorrect % 5 === 0) {
    const user = getCurrentUser();
    if (_firebaseReady && user && user.uid !== '__admin__') {
      syncStatsToFirebase(user.uid, {
        ...state,
        gamesPlayed: state.totalGamesPlayed,
        score:       state.score,
      });
    }
  }

  // Computer turn
  await delay(1800);
  hideFeedback();
  state.phase = 'computer';
  showComputerThinking();
  await delay(1200);

  // FIX HATA 3 — computerPlay doğru argümanlar: (levelIndex, computerBalance)
  const compLevelIndex = teacher.lockedLevel >= 0
    ? teacher.lockedLevel
    : getLevelFromStreak(state.currentStreak);
  const compResult = computerPlay(compLevelIndex, state.computerBalance);

  // FIX HATA 12 — computerBalance güncelleniyor
  state.computerBalance = compResult.newComputerBal ?? state.computerBalance;
  showComputerResult(compResult.instruction, state.computerBalance);
  addLogEntry(
    `🤖 ${compResult.instruction.correctExpression} = ${state.computerBalance}`,
    'computer', true
  );

  updateBalances(state.userBalance, state.computerBalance);
  updateTicketStack(state.computerBalance, compResult.instruction);
  await delay(1500);
  startUserTurn();
}

async function handleNewGame() {
  stopTimer();
  const user = getCurrentUser();

  if (_firebaseReady && user && user.uid !== '__admin__' && _sessionTotal > 0) {
    syncSession(user.uid, {
      startTime:         _sessionStartTime,
      endTime:           Date.now(),
      score:             state.score || 0,
      questionsAnswered: _sessionTotal,
      correctAnswers:    _sessionCorrect,
    });
    syncStatsToFirebase(user.uid, {
      ...state,
      gamesPlayed: (state.totalGamesPlayed || 0) + 1,
      score:       state.score,
    });
  }

  // FIX HATA 8 — recordSession obje formatı
  statsRecordSession({
    correct: _sessionCorrect,
    total:   _sessionTotal,
    streak:  state.maxStreak,
  });
  saveOnNewGame();

  _sessionStartTime = Date.now();
  _sessionCorrect   = 0;
  _sessionTotal     = 0;

  const savedData = loadSave();
  state = createInitialState();
  // FIX BUG 1
  state.totalGamesPlayed        = (savedData.totalGamesPlayed || 0) + 1;
  state.unlockedAchievements    = new Set(getUnlockedAchievements());
  state.maxStreak               = savedData.maxStreak ?? 0;
  state.maxLevel                = savedData.maxLevel  ?? 0;
  state.negativeNegativeCorrect = savedData.negativeNegativeCorrect ?? 0;

  setBalancesImmediate(0, 0);
  setHighScoreDisplay(getHighScore());
  renderAchievements(state.unlockedAchievements);
  updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));
  clearGameLog();
  startUserTurn();
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  // FIX BUG 2: önce eski timer durdur
  stopTimer();
  let remaining = teacher.timerSecs;
  document.getElementById('timerDisplay')?.classList.remove('hidden');
  _timerInterval = setInterval(() => {
    remaining--;
    const el = document.getElementById('timerValue');
    if (el) el.textContent = remaining;
    if (remaining <= 3) document.getElementById('timerDisplay')?.classList.add('warning');
    if (remaining <= 0) {
      stopTimer();
      setCheckBtnEnabled(false);
      showError('⏰ Zeit abgelaufen!');
      state.currentStreak = 0;
      state.currentLevel  = 0;
      updateScoreUI(state, getLevelProgress(0, 0));
      setTimeout(() => { hideFeedback(); startUserTurn(); }, 1800);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(_timerInterval);
  _timerInterval = null;
  document.getElementById('timerDisplay')?.classList.add('hidden');
  document.getElementById('timerDisplay')?.classList.remove('warning');
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

      if (tab === 'leaderboard') renderLeaderboard();
      if (tab === 'friends')     renderFriendsPanel();
      // FIX HATA 5 — renderDashboard(state) ile çağrı
      if (tab === 'stats') { renderDashboard(state); renderHeatmap(); }
    });
  });
}

// ─── GLOBAL EVENTS ────────────────────────────────────────────────────────────
function bindGlobalEvents() {
  bindAuthEvents();

  document.getElementById('closeAdminBtn')?.addEventListener('click', closeAdminPanel);
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => loadAdminTab(btn.dataset.tab));
  });

  // FIX BUG 5: profileOverlay flex class kaldırılıyor
  document.getElementById('closeProfileBtn')?.addEventListener('click', () => {
    const overlay = document.getElementById('profileOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  });

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

  document.getElementById('closeSubModal')?.addEventListener('click', () => {
    document.getElementById('adminSubModal')?.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const btn   = document.getElementById('notifBtn');
    if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });

  document.getElementById('closeRules')?.addEventListener('click', closeRulesModal);
  document.getElementById('rulesBackdrop')?.addEventListener('click', closeRulesModal);
  document.getElementById('closeRulesBtn')?.addEventListener('click', () => { closeRulesModal(); if (state) startUserTurn(); });
  document.getElementById('openRules')?.addEventListener('click', openRulesModal);

  document.getElementById('closeTeacher')?.addEventListener('click', closeTeacherModal);
  document.getElementById('teacherBackdrop')?.addEventListener('click', closeTeacherModal);
  document.getElementById('applyTeacher')?.addEventListener('click', applyTeacherMode);

  document.getElementById('teacherTimer')?.addEventListener('input', function () {
    const el = document.getElementById('teacherTimerDisplay');
    if (el) el.textContent = this.value === '0' ? 'Aus' : `${this.value}s`;
  });

  document.getElementById('audioToggle')?.addEventListener('click', () => {
    const on = !isAudioEnabled();
    setAudioEnabled(on);
    updateAudioIcon(on);
    if (on) unlockAudio();
  });

  // FIX HATA 6 — sadece DE/TR, EN kaldırıldı; icon güncelleniyor
  document.getElementById('langToggle')?.addEventListener('click', () => {
    const curr = document.documentElement.lang || 'de';
    const next = curr === 'de' ? 'tr' : 'de';
    setLang(next);
    document.documentElement.lang = next;
    const btn = document.getElementById('langToggle');
    if (btn) btn.textContent = next === 'tr' ? 'DE/TR 🇹🇷' : 'TR/DE 🇩🇪';
  });

  // FIX HATA 5 — renderDashboard(state) ile çağrı
  document.getElementById('resetStats')?.addEventListener('click', () => {
    if (confirm('Tüm istatistikler silinsin mi?')) {
      clearStats();
      statsClear();
      renderDashboard(state);
      renderHeatmap();
    }
  });
}

/**
 * FIX HATA 10 — event listener duplikasyonu: replaceWith clone
 */
function bindGameEvents() {
  // Clone butonları — eski listener'ları temizle
  const checkBtn   = document.getElementById('checkBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const exprInput  = document.getElementById('expressionInput');
  const balInput   = document.getElementById('balanceInput');

  if (checkBtn) {
    const fresh = checkBtn.cloneNode(true);
    checkBtn.replaceWith(fresh);
    fresh.addEventListener('click', () => { unlockAudio(); playClick(); handleCheck(); });
  }

  if (newGameBtn) {
    const fresh = newGameBtn.cloneNode(true);
    newGameBtn.replaceWith(fresh);
    fresh.addEventListener('click', () => { playClick(); handleNewGame(); });
  }

  if (exprInput) {
    const fresh = exprInput.cloneNode(true);
    exprInput.replaceWith(fresh);
    fresh.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('balanceInput')?.focus(); }
    });
  }

  if (balInput) {
    const fresh = balInput.cloneNode(true);
    balInput.replaceWith(fresh);
    fresh.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { unlockAudio(); playClick(); handleCheck(); }
    });
  }
}

function bindTeacherSecretKey() {
  let buffer = '';
  document.addEventListener('keydown', (e) => {
    buffer += e.key.toLowerCase();
    if (buffer.length > 10) buffer = buffer.slice(-10);
    if (buffer.includes('lehrer')) {
      buffer = '';
      const btn = document.getElementById('teacherModeBtn');
      btn?.classList.remove('hidden');
      btn?.addEventListener('click', openTeacherModal, { once: true });
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
  teacher.active      = true;
  teacher.lockedLevel = parseInt(document.getElementById('teacherLevel')?.value ?? '-1');
  teacher.timerSecs   = parseInt(document.getElementById('teacherTimer')?.value  ?? '0');
  teacher.cheatSheet  = document.getElementById('teacherCheatSheet')?.checked ?? false;
  teacher.customMin   = parseInt(document.getElementById('teacherMin')?.value ?? '1');
  teacher.customMax   = parseInt(document.getElementById('teacherMax')?.value ?? '10');
  closeTeacherModal();
  if (state) startUserTurn();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function updateAudioIcon(on) {
  const icon = document.getElementById('audioIcon');
  if (icon) icon.className = on ? 'fas fa-volume-up text-cyan-400' : 'fas fa-volume-mute text-slate-500';
}

function showGameToast(msg, color = 'cyan') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el  = document.createElement('div');
  const cls = {
    cyan:   'border-cyan-500/40 text-cyan-300',
    green:  'border-green-500/40 text-green-300',
    red:    'border-red-500/40 text-red-300',
    yellow: 'border-yellow-500/40 text-yellow-300',
  };
  el.className  = `glass-panel border ${cls[color] || cls.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function setAuthLoading(loading, form) {
  const btn = document.getElementById(form === 'login' ? 'loginBtn' : 'signupBtn');
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin mr-2"></i>Yükleniyor...'
    : form === 'login'
      ? '<i class="fas fa-sign-in-alt mr-2"></i>Giriş Yap'
      : '<i class="fas fa-user-plus mr-2"></i>Kayıt Ol';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── BOOT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);

// FIX BUG 7: crash screen localStorage temizliyor
window.addEventListener('error', (e) => {
  console.error('[CRASH]', e.error);
  const screen = document.getElementById('crashScreen');
  const msg    = document.getElementById('crashMessage');
  if (screen && msg) {
    msg.textContent = `Fehler: ${e.message || 'Unbekannter Fehler'}`;
    screen.classList.remove('hidden');
    screen.classList.add('flex');

    document.getElementById('crashRestart')?.addEventListener('click', () => {
      // Clear potentially corrupt save state before reload
      localStorage.removeItem('gss_save_v3');
      location.reload();
    }, { once: true });
  }
});
