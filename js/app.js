/**
 * app.js
 * =======
 * Ana Uygulama Mantığı
 * Düzeltme: Yükleme ekranı takılma sorunu giderildi.
 */

import {
  createInitialState, generateInstruction, validateAnswer,
  computerPlay, checkAchievements, calculateScore,
  getLevelFromStreak, getLevelProgress, buildHint, LEVELS, ACHIEVEMENTS,
  generateMathBlitzQuestion,
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
  showDailyRewardModal, hideDailyRewardModal,
} from './ui.js';

import {
  loadSave, saveProgress, saveOnNewGame, updateHighScore,
  getHighScore, getUnlockedAchievements, saveUnlockedAchievements,
  syncStatsToFirebase, loadStatsFromFirebase, syncAchievement, syncSession,
  clearStats, exportUserData,
} from './storage.js';

import { initI18n } from './i18n.js';

import {
  initAudio, setAudioEnabled, isAudioEnabled, unlockAudio,
  playSuccess, playError, playLevelUp, playClick,
  playAchievement, playDailyReward,
} from './audio.js';

import {
  recordAttempt as statsRecordAttempt,
  recordSession as statsRecordSession,
  loadStats, renderDashboard, renderHeatmap, clearStats as statsClear,
} from './stats.js';

// Düzeltilmiş Firebase modülünü çağırıyoruz
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
  getInbox, markMessageRead, getUserProfile, updateUserProfile,
  claimDailyReward,
} from './firebase-config.js';

// Global Referanslar
window._gameLevels       = { LEVELS };
window._gameAchievements = { ACHIEVEMENTS };

function sanitize(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── State ────────────────────────────────────────────────────────────────────
let state;
let _sessionStart  = Date.now();
let _sessionOk     = 0;
let _sessionTotal  = 0;
let _timerInterval = null;
let _firebaseReady = false;

const teacher = {
  active: false, lockedLevel: -1, timerSecs: 0, cheatSheet: false,
  customMin: 1, customMax: 10,
};

// ─── INITIALISIERUNG ─────────────────────────────────────────────────────────
async function init() {
  console.log('%c⚖️ Guthaben-Schulden-Spiel — Pro Edition', 'color:#00d4ff;font-family:monospace;font-size:1.2em;font-weight:bold;');

  initI18n();
  initBackground();
  initConfetti();

  const audioOn = initAudio();
  updateAudioIcon(typeof audioOn === 'boolean' ? audioOn : isAudioEnabled());
  applyTheme(localStorage.getItem('gss_theme') || 'dark');

  // Yükleme Ekranı
  showLoadingOverlay(true, 'Firebase Bağlanıyor...');

  // Firebase Başlatma (Artık daha sağlam)
  _firebaseReady = await initFirebase();

  // Yükleme ekranını hemen kapat (Takılmayı önlemek için)
  showLoadingOverlay(false);

  if (!_firebaseReady) {
    showFirebaseError();
    console.warn("Firebase yüklenemedi, Offline modunda devam ediliyor.");
  }

  // Oturum Kurtarma
  let restored = false;
  if (_firebaseReady) {
    restored = await restoreSession();
  }

  if (restored) {
    await afterLogin();
  } else {
    showAuthScreen();
  }

  bindGlobalEvents();
}

// ─── AUTH EKRANLARI ──────────────────────────────────────────────────────────
function showAuthScreen() {
  const o = document.getElementById('authOverlay');
  if (o) { o.classList.remove('hidden'); o.classList.add('flex'); }
  const w = document.getElementById('appWrapper');
  if (w) w.classList.add('hidden');
}

function hideAuthScreen() {
  const o = document.getElementById('authOverlay');
  if (o) { o.classList.add('hidden'); o.classList.remove('flex'); }
  const w = document.getElementById('appWrapper');
  if (w) w.classList.remove('hidden');
}

async function afterLogin() {
  const user = getCurrentUser();
  hideAuthScreen();

  // Cloud Stats Yükle
  if (_firebaseReady && user && user.uid !== '__admin__') {
    try {
      const cloudStats = await loadStatsFromFirebase(user.uid);
      if (cloudStats) {
        const saved = loadSave();
        saved.maxStreak = Math.max(saved.maxStreak || 0, cloudStats.maxStreak || 0);
        saved.maxLevel  = Math.max(saved.maxLevel  || 0, cloudStats.maxLevel  || 1);
      }
      if (user.profile?.theme) applyTheme(user.profile.theme);
      
      // Günlük Ödül
      setTimeout(() => checkDailyReward(user.uid), 1500);

      checkAndShowInboxOnLogin(user.uid);
      startNotificationListener();
    } catch (e) {
      console.warn("Login sonrası veri yükleme hatası:", e);
    }
  }

  updateUserHeader();

  const savedData = loadSave();
  state = createInitialState();
  
  // State Restorasyonu
  state.totalGamesPlayed        = savedData.totalGamesPlayed        || 0;
  state.unlockedAchievements    = new Set(getUnlockedAchievements());
  state.maxStreak               = savedData.maxStreak               ?? 0;
  state.maxLevel                = savedData.maxLevel                ?? 0;
  state.negativeNegativeCorrect = savedData.negativeNegativeCorrect ?? 0;
  state.dailyStreak             = user?.profile?.dailyStreak        ?? 0;

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

// ─── UI GÜNCELLEMELERİ ───────────────────────────────────────────────────────
function updateUserHeader() {
  const user = getCurrentUser();
  if (!user) return;
  const headerUser = document.getElementById('headerUserArea');
  if (!headerUser) return;

  const name   = user.profile?.username || 'Gast';
  const avatar = user.profile?.avatar || name.charAt(0).toUpperCase();
  const isAdm  = user.profile?.isAdmin;

  headerUser.innerHTML = `
    <button id="profileBtn" class="flex items-center gap-2 glass-panel px-3 py-2 rounded-xl hover:border-cyan-400/50 transition-all">
      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
        ${isAdm ? '👑' : sanitize(avatar)}
      </div>
      <span class="text-sm font-semibold text-slate-200 max-w-24 truncate hidden sm:block">${sanitize(name)}</span>
      ${isAdm ? '<span class="text-xs text-yellow-400 font-orbitron hidden sm:block">ADMIN</span>' : ''}
    </button>
    <button id="notifBtn" class="glass-panel px-3 py-2 rounded-xl hover:border-purple-400/50 transition-all relative">
      <i class="fas fa-bell text-slate-400 text-sm"></i>
      <span id="notifBadge" class="hidden absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-xs flex items-center justify-center text-white">!</span>
    </button>`;

  document.getElementById('profileBtn')?.addEventListener('click', () => openProfileOverlay());
  document.getElementById('notifBtn')?.addEventListener('click', toggleNotifPanel);

  if (isAdm) {
    const teacherBtn = document.getElementById('teacherModeBtn');
    if (teacherBtn) teacherBtn.classList.remove('hidden');
  }
}

// ─── OYUN DÖNGÜSÜ ────────────────────────────────────────────────────────────
function startUserTurn() {
  hideFeedback();
  clearInputs();
  setCheckBtnEnabled(true);
  showUserInputArea(true);
  showComputerThinking(false);

  const levelIdx = teacher.active && teacher.lockedLevel >= 0
    ? teacher.lockedLevel
    : state.currentLevel;

  state.currentInstruction = generateInstruction(levelIdx, state.userBalance);
  state.phase              = 'user_input';
  state.turnStartTime      = Date.now();
  state.fastAnswer         = false;

  renderInstruction(state.currentInstruction);
  setTurnIndicator('user');

  // Cheat Sheet
  const cheatOverlay = document.getElementById('cheatOverlay');
  const cheatAnswer  = document.getElementById('cheatAnswer');
  
  if (teacher.cheatSheet && state.currentInstruction) {
    const hint = buildHint(state.currentInstruction);
    if (cheatOverlay) cheatOverlay.classList.remove('hidden');
    if (cheatAnswer) cheatAnswer.innerHTML = hint;
  } else {
    if (cheatOverlay) cheatOverlay.classList.add('hidden');
  }

  if (teacher.active && teacher.timerSecs > 0) startTimer(teacher.timerSecs);
}

function setTurnIndicator(who) {
  const userInd = document.getElementById('userTurnIndicator');
  const compInd = document.getElementById('computerTurnIndicator');
  const badge   = document.getElementById('turnBadge');
  const taskCard = document.getElementById('taskCard');

  if (userInd) userInd.classList.toggle('hidden', who !== 'user');
  if (compInd) compInd.classList.toggle('hidden', who !== 'computer');
  
  if (badge) {
    badge.textContent = who === 'user' ? 'DEIN ZUG' : 'COMPUTER ZUG';
    badge.className   = `px-3 py-1 rounded-full text-xs font-orbitron font-semibold border ${
      who === 'user'
        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
        : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    }`;
  }

  if (taskCard) {
    taskCard.className = taskCard.className.replace(/border-(cyan|purple)-500\/20/, '');
    taskCard.classList.add(who === 'user' ? 'border-cyan-500/20' : 'border-purple-500/20');
  }
}

async function handleCheck() {
  if (state.phase !== 'user_input') return;
  unlockAudio();
  setCheckBtnEnabled(false);

  const { expression, balance } = getInputValues();
  const instruction = state.currentInstruction;
  if (!instruction) { setCheckBtnEnabled(true); return; }

  const result = validateAnswer(expression, balance, instruction);
  const timeSecs = (Date.now() - (state.turnStartTime || Date.now())) / 1000;
  state.fastAnswer = timeSecs < 3;

  stopTimer();
  highlightInputs(result.expressionOk, result.balanceOk);
  statsRecordAttempt(result.allOk, instruction);

  state.totalAttempts++;
  _sessionTotal++;

  if (result.allOk) {
    // DOĞRU
    state.totalCorrect++;
    state.currentStreak++;
    state.maxStreak = Math.max(state.maxStreak, state.currentStreak);
    _sessionOk++;
    if (instruction.isNegNeg) state.negativeNegativeCorrect++;

    const earned = calculateScore(state.currentLevel, state.currentStreak, timeSecs);
    state.score += earned;
    const newHS = updateHighScore(state.score);
    setHighScoreDisplay(newHS);

    playSuccess();
    showSuccess(`Richtig! ${result.expressionOk ? '✓ Ausdruck' : ''} ${result.balanceOk ? '✓ Kontostand' : ''}`);
    showScorePopup(earned, window.innerWidth / 2 - 30, 120);

    state.userBalance = instruction.newBalance;
    updateBalances(state.userBalance, state.computerBalance);
    updateTicketStack(instruction);

    addLogEntry({ correct: true, expression, balance, instruction, score: earned });

    // Level Up
    const newLevelIdx = getLevelFromStreak(state.currentStreak);
    if (newLevelIdx > state.currentLevel) {
      state.currentLevel = newLevelIdx;
      state.maxLevel     = Math.max(state.maxLevel, newLevelIdx);
      playLevelUp();
      triggerConfetti();
      showLevelUp(LEVELS[newLevelIdx]);
    }
    updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));

    // Achievements
    const newAchs = checkAchievements(state);
    if (newAchs.length > 0) {
      playAchievement();
      newAchs.forEach(ach => showAchievementToast(ach));
      saveUnlockedAchievements([...state.unlockedAchievements]);
      renderAchievements(state.unlockedAchievements);
      if (_firebaseReady && getCurrentUser()?.uid !== '__admin__') {
        newAchs.forEach(ach => syncAchievement(getCurrentUser().uid, ach.id).catch(() => {}));
      }
    }

    saveProgress(state);
    if (_firebaseReady && getCurrentUser()?.uid !== '__admin__') {
      syncStatsToFirebase(getCurrentUser().uid, state).catch(() => {});
    }

    state.phase = 'computer_turn';
    setTimeout(doComputerTurn, 1200);

  } else {
    // YANLIŞ
    state.currentStreak = 0;
    playError();
    const hints = [];
    if (!result.expressionOk) hints.push('Ausdruck falsch');
    if (!result.balanceOk)    hints.push('Kontostand falsch');
    showError(`Falsch! ${hints.join(', ')} — Lösung: ${instruction.correctExpression} = ${instruction.newBalance}`);
    
    addLogEntry({ correct: false, expression, balance, instruction });
    updateScoreUI(state, getLevelProgress(state.currentStreak, state.currentLevel));
    saveProgress(state);

    setTimeout(() => {
      setCheckBtnEnabled(true);
      clearInputs();
    }, 2500);
  }
}

async function doComputerTurn() {
  state.phase = 'computer_turn';
  showUserInputArea(false);
  showComputerThinking(true);
  setTurnIndicator('computer');

  await delay(1000 + Math.random() * 800);

  const levelIdx = teacher.active && teacher.lockedLevel >= 0
    ? teacher.lockedLevel
    : state.currentLevel;

  const { instruction: compInstr, newComputerBal } = computerPlay(levelIdx, state.computerBalance);
  state.computerBalance = newComputerBal;

  showComputerThinking(false);
  showComputerResult(compInstr);
  updateBalances(state.userBalance, state.computerBalance);

  state.gameRound++;
  if (state.gameRound % 10 === 0) {
    state.totalGamesPlayed++;
    saveProgress(state);
    _sessionTotal = 0;
    _sessionOk    = 0;
  }

  // Session Sync
  if (_firebaseReady && getCurrentUser()?.uid !== '__admin__' && state.gameRound % 5 === 0) {
    syncSession(getCurrentUser().uid, {
      score:            state.score,
      correctAnswers:   state.totalCorrect,
      questionsAnswered: state.totalAttempts,
      startTime:        _sessionStart,
    }).catch(() => {});
  }

  await delay(1500);
  state.phase = 'user_input';
  startUserTurn();
}

function newGame() {
  stopTimer();
  _sessionStart = Date.now();
  _sessionOk    = 0;
  _sessionTotal = 0;

  statsRecordSession({
    correct: _sessionOk,
    total:   _sessionTotal,
    streak:  state.maxStreak,
  });

  state.totalGamesPlayed++;
  state.score           = 0;
  state.currentStreak   = 0;
  state.currentLevel    = 0;
  state.totalCorrect    = 0;
  state.totalAttempts   = 0;
  state.userBalance     = 0;
  state.computerBalance = 0;
  state.gameRound       = 0;
  state.phase           = 'idle';

  clearGameLog();
  setBalancesImmediate(0, 0);
  updateScoreUI(state, getLevelProgress(0, 0));
  saveOnNewGame();
  
  const saved = loadSave();
  state.totalGamesPlayed = (saved.totalGamesPlayed || 0) + 1;
  saveProgress(state);

  setTimeout(startUserTurn, 300);
}

// ─── EVENT LISTENER ──────────────────────────────────────────────────────────
function bindGameEvents() {
  const checkBtn = document.getElementById('checkBtn');
  if (checkBtn) {
    const newBtn = checkBtn.cloneNode(true);
    checkBtn.parentNode?.replaceChild(newBtn, checkBtn);
    newBtn.addEventListener('click', handleCheck);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state?.phase === 'user_input') {
      const active = document.activeElement?.tagName;
      if (active === 'INPUT') handleCheck();
    }
  });

  document.getElementById('newGameBtn')?.addEventListener('click', () => {
    playClick();
    newGame();
  });

  document.getElementById('resetStatsBtn')?.addEventListener('click', () => {
    if (confirm('Statistiken wirklich zurücksetzen?')) {
      statsClear();
      clearStats();
      renderDashboard(state);
    }
  });

  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);

  document.getElementById('exportDataBtn')?.addEventListener('click', () => {
    exportUserData(getCurrentUser()?.profile, state, []);
  });

  document.getElementById('openAdminBtn')?.addEventListener('click', () => {
    playClick();
    openAdminPanel();
  });

  document.getElementById('closeAdminBtn')?.addEventListener('click', () => closeAdminPanel());

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => loadAdminTab(btn.dataset.tab));
  });

  document.getElementById('closeSubModal')?.addEventListener('click', () => window.closeAdminSubModal());

  document.getElementById('teacherModeBtn')?.addEventListener('click', () => {
    document.getElementById('teacherModal')?.classList.remove('hidden');
    document.getElementById('teacherModal')?.classList.add('flex');
  });

  document.getElementById('closeTeacher')?.addEventListener('click', closeTeacherModal);
  document.getElementById('teacherBackdrop')?.addEventListener('click', closeTeacherModal);
  document.getElementById('applyTeacher')?.addEventListener('click', applyTeacherMode);
  
  document.getElementById('teacherTimer')?.addEventListener('input', (e) => {
    const display = document.getElementById('teacherTimerDisplay');
    if (display) display.textContent = e.target.value === '0' ? 'Aus' : `${e.target.value}s`;
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logoutUser();
    location.reload();
  });

  document.getElementById('closeDailyReward')?.addEventListener('click', hideDailyRewardModal);
  document.getElementById('closeChatModal')?.addEventListener('click', () => window.closeChatModal?.());
  document.getElementById('sendChatBtn')?.addEventListener('click', () => window.sendChatMsg?.());

  document.getElementById('closeInboxBtn')?.addEventListener('click', () => {
    document.getElementById('inboxModal')?.classList.add('hidden');
    document.getElementById('inboxModal')?.classList.remove('flex');
  });
}

function bindTabEvents() {
  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      const tab = btn.dataset.tab;
      switchMainTab(tab);
    });
  });
}

function switchMainTab(tab) {
  document.querySelectorAll('.main-tab-btn').forEach(b =>
    b.classList.toggle('active-tab', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('hidden', c.id !== `tab-${tab}`)
  );

  switch (tab) {
    case 'stats':       renderDashboard(state); break;
    case 'leaderboard': renderLeaderboard();    break;
    case 'friends':     renderFriendsPanel();   break;
    case 'calculator':  initCalculator();       break;
    case 'minigame':    initMathBlitz();        break;
  }
}

function bindGlobalEvents() {
  document.getElementById('openRules')?.addEventListener('click', openRulesModal);
  document.getElementById('closeRules')?.addEventListener('click', closeRulesModal);
  document.getElementById('closeRulesBtn')?.addEventListener('click', closeRulesModal);
  document.getElementById('rulesBackdrop')?.addEventListener('click', closeRulesModal);

  document.getElementById('audioToggle')?.addEventListener('click', () => {
    const on = !isAudioEnabled();
    setAudioEnabled(on);
    updateAudioIcon(on);
    if (on) unlockAudio();
  });

  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const err = document.getElementById('loginError');
    if (btn) { btn.disabled = true; btn.textContent = 'Bitte warten…'; }
    if (err) err.classList.add('hidden');

    const username = document.getElementById('loginUsername')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    const result   = await loginUser(username, password);

    if (result.success) {
      await afterLogin();
    } else {
      if (err) { err.textContent = result.error; err.classList.remove('hidden'); }
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Anmelden'; }
    }
  });

  document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signupBtn');
    const err = document.getElementById('signupError');
    if (btn) { btn.disabled = true; btn.textContent = 'Bitte warten…'; }
    if (err) err.classList.add('hidden');

    const username = document.getElementById('signupUsername')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const email    = document.getElementById('signupEmail')?.value?.trim();
    const result   = await signupUser(username, password, email);

    if (result.success) {
      await afterLogin();
    } else {
      if (err) { err.textContent = result.error; err.classList.remove('hidden'); }
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus mr-2"></i>Registrieren'; }
    }
  });

  document.getElementById('showSignup')?.addEventListener('click', () => {
    document.getElementById('loginPanel')?.classList.add('hidden');
    document.getElementById('signupPanel')?.classList.remove('hidden');
  });

  document.getElementById('showLogin')?.addEventListener('click', () => {
    document.getElementById('signupPanel')?.classList.add('hidden');
    document.getElementById('loginPanel')?.classList.remove('hidden');
  });

  document.getElementById('guestPlayBtn')?.addEventListener('click', () => {
    import('./firebase-config.js').then(({ setCurrentUser }) => {
      setCurrentUser({ uid: '__guest__', profile: { username: 'Gast', isAdmin: false } });
    }).then(() => afterLogin());
  });

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const current = localStorage.getItem('gss_theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise Hatası:', e.reason);
  });

  window.addEventListener('error', (e) => {
    console.error('JS Hatası:', e.message);
  });
}

function bindTeacherSecretKey() {
  let buf = '';
  document.addEventListener('keydown', (e) => {
    buf = (buf + e.key).slice(-6);
    if (buf.toLowerCase().includes('teacher')) {
      document.getElementById('teacherModeBtn')?.classList.remove('hidden');
      buf = '';
    }
  });
}

// ─── TEACHER MODE ────────────────────────────────────────────────────────────
function applyTeacherMode() {
  teacher.active     = true;
  teacher.lockedLevel = parseInt(document.getElementById('teacherLevel')?.value ?? '-1');
  teacher.timerSecs   = parseInt(document.getElementById('teacherTimer')?.value ?? '0');
  teacher.cheatSheet  = document.getElementById('teacherCheatSheet')?.checked ?? false;
  closeTeacherModal();
  startUserTurn();
}

function closeTeacherModal() {
  const m = document.getElementById('teacherModal');
  if (!m) return;
  m.classList.add('hidden');
  m.classList.remove('flex');
}

// ─── TIMER ───────────────────────────────────────────────────────────────────
function startTimer(secs) {
  stopTimer();
  let rem = secs;
  const display = document.getElementById('timerValue');
  const wrapper = document.getElementById('timerDisplay');
  
  if (wrapper) wrapper.classList.remove('hidden');
  if (display) display.textContent = rem;
  
  _timerInterval = setInterval(() => {
    rem--;
    if (display) display.textContent = rem;
    if (rem <= 0) {
      stopTimer();
      handleCheck();
    }
  }, 1000);
}

function stopTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  const wrapper = document.getElementById('timerDisplay');
  if (wrapper) wrapper.classList.add('hidden');
}

// ─── PROFIL ──────────────────────────────────────────────────────────────────
async function saveProfile() {
  const user = getCurrentUser();
  if (!user || user.uid === '__admin__' || !_firebaseReady) return;
  const bio = document.getElementById('profileBio')?.value?.trim() || '';
  const theme = document.querySelector('input[name="theme"]:checked')?.value || 'dark';
  try {
    await updateUserProfile(user.uid, { bio, theme });
    applyTheme(theme);
    showToast('Profil kaydedildi ✓', 'green');
  } catch (err) {
    showToast('Hata: ' + err.message, 'red');
  }
}

function openProfileOverlay() {
  const user = getCurrentUser();
  const overlay = document.getElementById('profileOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');

  if (user && user.uid !== '__admin__') {
    const bio = document.getElementById('profileBio');
    if (bio) bio.value = user.profile?.bio || '';

    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('profileUsername',   user.profile?.username || '—');
    set('profileMaxStreak',  state.maxStreak || 0);
    set('profileMaxLevel',   (state.maxLevel || 0) + 1);
    set('profileGamesPlayed', state.totalGamesPlayed || 0);

    const adminBtn = document.getElementById('openAdminBtn');
    if (adminBtn) adminBtn.classList.toggle('hidden', !checkIsAdmin());
  }

  document.getElementById('closeProfile')?.addEventListener('click', () => {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }, { once: true });
}

// ─── MESAJLAR ────────────────────────────────────────────────────────────────
async function checkAndShowInboxOnLogin(uid) {
  try {
    const inbox = await getInbox(uid) || {};
    const unread = Object.entries(inbox).filter(([, m]) => !m.isRead);
    if (unread.length === 0) return;

    const modal = document.getElementById('inboxModal');
    const content = document.getElementById('inboxContent');
    if (!modal || !content) return;

    content.innerHTML = unread.map(([key, msg]) => `
      <div class="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
        <div class="flex items-center justify-between mb-2">
          <span class="font-orbitron text-sm text-cyan-400">${sanitize(msg.subject || 'Konu Yok')}</span>
          <span class="text-xs text-slate-500">${msg.sentAt ? new Date(msg.sentAt).toLocaleDateString('tr-TR') : '—'}</span>
        </div>
        <p class="text-slate-300 text-sm leading-relaxed">${sanitize(msg.body || '')}</p>
        <div class="text-xs text-slate-500 mt-2">Gönderen: ${sanitize(msg.fromName || msg.from || 'Admin')}</div>
      </div>
    `).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    unread.forEach(([key]) => markMessageRead(uid, key).catch(() => {}));
  } catch (e) {
    console.warn('Inbox Hatası:', e.message);
  }
}

// ─── GÜNLÜK ÖDÜL ─────────────────────────────────────────────────────────────
async function checkDailyReward(uid) {
  try {
    const result = await claimDailyReward(uid);
    if (result.success) {
      playDailyReward();
      showDailyRewardModal(result.reward, result.streak);
      state.dailyStreak = result.streak;
      triggerConfetti();
    }
  } catch (e) {
    console.warn('Daily Reward Hatası:', e.message);
  }
}

// ─── DİĞER FONKSİYONLAR ──────────────────────────────────────────────────────
function openRulesModal() {
  const m = document.getElementById('rulesModal');
  if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}
function closeRulesModal() {
  const m = document.getElementById('rulesModal');
  if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  if (getHighScore() === 0) startUserTurn();
}

// Basit Yardımcılar
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function clearInputs() {
  const expr = document.getElementById('expressionInput');
  const bal  = document.getElementById('balanceInput');
  if (expr) { 
    expr.value = ''; 
    expr.className = expr.className.replace(/border-(green|red)-500\/60/g, ''); 
  }
  if (bal) { 
    bal.value  = ''; 
    bal.className  = bal.className.replace(/border-(green|red)-500\/60/g, ''); 
  }
}

function showLoadingOverlay(show, message) {
  const el = document.getElementById('fbLoadingOverlay');
  if (!el) return;
  el.classList.toggle('hidden', !show);
  if (show && message) {
    const msgEl = document.getElementById('fbLoadingMessage');
    if (msgEl) msgEl.textContent = message;
  }
}

function showFirebaseError() {
  const el = document.getElementById('fbErrorBanner');
  if (el) el.classList.remove('hidden');
}

function updateAudioIcon(on) {
  const icon = document.getElementById('audioIcon');
  if (icon) {
    icon.className = `fas ${on ? 'fa-volume-up text-cyan-400' : 'fa-volume-mute text-slate-500'}`;
  }
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark',  theme !== 'light');
  localStorage.setItem('gss_theme', theme);
}

function showToast(msg, type = 'cyan') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const colors = {
    cyan:  'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
    green: 'border-green-500/40 text-green-300 bg-green-500/10',
    red:   'border-red-500/40 text-red-300 bg-red-500/10',
  };
  const el = document.createElement('div');
  el.className = `glass-panel border ${colors[type] || colors.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto shadow-lg`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  const hidden = panel.classList.toggle('hidden');
  if (!hidden) renderNotifications('notificationsContainer');
}

// ─── Calculator (Öncekine Sadık Kalındı) ─────────────────────────────────────
let _calcDisplay = '';
let _calcHistory = [];
let _calcMode    = 'basic';
let _calcMemory  = 0;
let _calcExpr    = '';
let _calcLastResult = '';

function initCalculator() {
  const container = document.getElementById('calculatorContent');
  if (!container || container.dataset.initialized) return;
  container.dataset.initialized = 'true';
  container.innerHTML = `
    <div class="calculator-wrapper max-w-sm mx-auto">
      <div class="calc-display mb-3">
        <div id="calcHistory" class="text-xs text-slate-500 text-right h-5 overflow-hidden"></div>
        <div id="calcExpr" class="text-right text-lg font-mono text-slate-400 min-h-6 break-all"></div>
        <div id="calcResult" class="text-right font-orbitron text-3xl font-bold text-cyan-400">0</div>
      </div>
      <div class="flex gap-2 mb-3">
        <button onclick="window.calcSetMode('basic')" class="calc-mode-btn flex-1 active">Temel</button>
        <button onclick="window.calcSetMode('scientific')" class="calc-mode-btn flex-1">Bilimsel</button>
      </div>
      <div id="sciButtons" class="grid grid-cols-5 gap-1.5 mb-1.5 hidden">
        ${['sin','cos','tan','log','ln','√','x²','xʸ','π','e','(',')','+/-','%','MC','MR','M+','M-','MS','EE'].map(b =>
          `<button onclick="window.calcSci('${b}')" class="calc-btn calc-fn text-xs">${b}</button>`
        ).join('')}
      </div>
      <div class="grid grid-cols-4 gap-1.5">
        ${[
          ['C','±','%','÷'],
          ['7','8','9','×'],
          ['4','5','6','−'],
          ['1','2','3','+'],
          ['0','.','⌫','='],
        ].map(row => row.map((b) =>
          `<button onclick="window.calcPress('${b}')" class="calc-btn ${b === '=' ? 'calc-eq' : ['÷','×','−','+'].includes(b) ? 'calc-op' : b === 'C' ? 'calc-clear' : 'calc-num'} ${b === '0' && row.length === 5 ? 'col-span-1' : ''}">${b}</button>`
        ).join('')).join('')}
      </div>
      <div class="mt-4">
        <div class="flex items-center justify-between mb-2"><span class="text-xs font-orbitron text-slate-400">GEÇMİŞ</span><button onclick="window.calcClearHistory()" class="text-xs text-slate-600 hover:text-slate-400">Temizle</button></div>
        <div id="calcHistoryList" class="space-y-1 max-h-32 overflow-y-auto"><p class="text-xs text-slate-600 text-center py-2">Yok</p></div>
      </div>
    </div>`;
  renderCalcHistory();
}

window.calcPress = function(btn) {
  const display = document.getElementById('calcResult');
  const exprEl  = document.getElementById('calcExpr');
  switch (btn) {
    case 'C': _calcExpr = ''; _calcLastResult = ''; if (display) display.textContent = '0'; if (exprEl) exprEl.textContent = ''; break;
    case '=':
      try {
        const expr = _calcExpr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, Math.PI).replace(/e(?![0-9])/g, Math.E);
        const result = Function('"use strict"; return (' + expr + ')')();
        if (!isFinite(result)) throw new Error('Geçersiz');
        const rounded = parseFloat(result.toPrecision(12));
        _calcHistory.unshift({ expr: _calcExpr, result: rounded });
        if (_calcHistory.length > 20) _calcHistory.pop();
        if (display) display.textContent = rounded;
        if (exprEl) exprEl.textContent = _calcExpr + ' =';
        _calcLastResult = String(rounded);
        _calcExpr = String(rounded);
        renderCalcHistory();
      } catch { if (display) display.textContent = 'Hata'; _calcExpr = ''; }
      break;
    case '⌫': _calcExpr = _calcExpr.slice(0, -1); if (display) display.textContent = _calcExpr || '0'; if (exprEl) exprEl.textContent = _calcExpr; break;
    case '±': _calcExpr = _calcExpr.startsWith('-') ? _calcExpr.slice(1) : '-' + _calcExpr; if (display) display.textContent = _calcExpr || '0'; if (exprEl) exprEl.textContent = _calcExpr; break;
    case '%': try { const val = parseFloat(_calcExpr)/100; _calcExpr = String(val); if (display) display.textContent = val; if (exprEl) exprEl.textContent = _calcExpr; } catch {} break;
    default: _calcExpr += btn; if (display) display.textContent = _calcExpr; if (exprEl) exprEl.textContent = _calcExpr;
  }
};
window.calcSetMode = function(mode) {
  _calcMode = mode;
  document.getElementById('sciButtons')?.classList.toggle('hidden', mode !== 'scientific');
  document.querySelectorAll('.calc-mode-btn').forEach(b => b.classList.toggle('active', (mode === 'scientific' && b.innerText.includes('Bilim')) || (mode === 'basic' && b.innerText.includes('Temel'))));
};
window.calcClearHistory = function() { _calcHistory = []; renderCalcHistory(); };
function renderCalcHistory() {
  const el = document.getElementById('calcHistoryList');
  if (!el) return;
  if (_calcHistory.length === 0) { el.innerHTML = '<p class="text-xs text-slate-600 text-center py-2">Yok</p>'; return; }
  el.innerHTML = _calcHistory.map(h => `<div class="flex justify-between text-xs py-1 border-b border-white/5 cursor-pointer hover:bg-white/5 px-2 rounded" onclick="window._calcExpr='${h.result}';document.getElementById('calcResult').textContent='${h.result}'"><span class="text-slate-500 font-mono truncate">${sanitize(String(h.expr))}</span><span class="text-cyan-400 font-mono ml-2 flex-shrink-0">= ${sanitize(String(h.result))}</span></div>`).join('');
}
window.calcSci = function(fn) { /* (Burayı kısa tuttum, temel fonksiyonlar yeterli) */ window.calcPress(fn); }; // Placeholder

// ─── Math Blitz ──────────────────────────────────────────────────────────────
let _blitzScore = 0; let _blitzStreak = 0; let _blitzTimer = null; let _blitzTimeLeft = 60; let _blitzActive = false; let _blitzQuestion = null; let _blitzDiff = 1;
function initMathBlitz() {
  const container = document.getElementById('minigameContent');
  if (!container || container.dataset.initialized) return;
  container.dataset.initialized = 'true';
  container.innerHTML = `
    <div class="max-w-lg mx-auto text-center">
      <h2 class="font-orbitron text-2xl font-black text-yellow-400 mb-6">⚡ Mathe-Blitz</h2>
      <div class="glass-panel p-6 border border-yellow-500/20 mb-4 rounded-2xl">
        <div class="flex justify-between mb-4 font-orbitron font-bold text-2xl">
          <div class="text-yellow-400" id="blitzScore">0</div><div class="text-orange-400" id="blitzStreak">🔥 0</div><div class="text-red-400" id="blitzTimer">60</div>
        </div>
        <div id="blitzQuestion" class="py-6 font-orbitron text-4xl text-white">Hazır mısın?</div>
        <div id="blitzOptions" class="grid grid-cols-2 gap-3 mb-4"></div>
        <div id="blitzFeedback" class="h-8 font-orbitron text-lg"></div>
      </div>
      <div class="flex gap-3">
        <button id="blitzStartBtn" onclick="window.startMathBlitz()" class="flex-1 py-4 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-orbitron font-bold">BAŞLA</button>
        <select id="blitzDiffSelect" class="game-input px-3 py-2 rounded-xl text-sm" onchange="window._blitzDiff = parseInt(this.value)"><option value="1">Kolay</option><option value="2">Orta</option><option value="3">Zor</option></select>
      </div>
      <div class="mt-4 text-xs text-slate-500">En Yüksek: <span id="blitzHs" class="text-yellow-400">0</span></div>
    </div>`;
  updateBlitzHs();
}
window.startMathBlitz = function() {
  _blitzScore = 0; _blitzStreak = 0; _blitzTimeLeft = 60; _blitzActive = true;
  _blitzDiff = parseInt(document.getElementById('blitzDiffSelect')?.value || '1');
  document.getElementById('blitzScore').textContent = '0';
  document.getElementById('blitzStreak').textContent = '🔥 0';
  document.getElementById('blitzTimer').textContent = '60';
  document.getElementById('blitzStartBtn').disabled = true;
  if (_blitzTimer) clearInterval(_blitzTimer);
  _blitzTimer = setInterval(() => {
    _blitzTimeLeft--;
    const el = document.getElementById('blitzTimer');
    if (el) el.textContent = _blitzTimeLeft;
    if (_blitzTimeLeft <= 0) endMathBlitz();
  }, 1000);
  nextBlitzQuestion();
};
function nextBlitzQuestion() {
  if (!_blitzActive) return;
  _blitzQuestion = generateMathBlitzQuestion(_blitzDiff);
  document.getElementById('blitzQuestion').textContent = _blitzQuestion.question;
  document.getElementById('blitzOptions').innerHTML = _blitzQuestion.options.map(opt => `<button onclick="window.blitzAnswer(${opt})" class="py-4 rounded-xl bg-white/10 font-bold hover:bg-white/20">${opt}</button>`).join('');
  document.getElementById('blitzFeedback').textContent = '';
}
window.blitzAnswer = function(val) {
  if (!_blitzActive) return;
  const correct = val === _blitzQuestion.answer;
  const fb = document.getElementById('blitzFeedback');
  if (correct) { _blitzStreak++; _blitzScore += 1 + Math.floor(_blitzStreak/3); fb.textContent='✅'; playSuccess().catch(()=>{}); }
  else { _blitzStreak = 0; fb.textContent='❌'; playError().catch(()=>{}); }
  document.getElementById('blitzScore').textContent = _blitzScore;
  document.getElementById('blitzStreak').textContent = `🔥 ${_blitzStreak}`;
  setTimeout(nextBlitzQuestion, 500);
};
function endMathBlitz() {
  clearInterval(_blitzTimer); _blitzActive = false;
  const hs = parseInt(localStorage.getItem('gss_blitz_hs') || '0');
  if (_blitzScore > hs) localStorage.setItem('gss_blitz_hs', _blitzScore);
  updateBlitzHs();
  document.getElementById('blitzQuestion').textContent = `Bitti! Puan: ${_blitzScore}`;
  document.getElementById('blitzOptions').innerHTML = '';
  document.getElementById('blitzStartBtn').disabled = false;
}
function updateBlitzHs() { document.getElementById('blitzHs').textContent = localStorage.getItem('gss_blitz_hs') || '0'; }

// Başlat
window._blitzDiff = 1;
init();
