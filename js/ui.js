/**
 * ui.js
 * =====
 * UI-Modul — Guthaben-Schulden-Spiel Pro Edition
 * Vollständig auf Deutsch, alle Bugs behoben
 */

// ─── Canvas-Hintergrund ──────────────────────────────────────────────────────
let _bgCtx, _bgCanvas, _particles = [];

export function initBackground() {
  _bgCanvas = document.getElementById('bgCanvas');
  if (!_bgCanvas) return;
  _bgCtx    = _bgCanvas.getContext('2d');
  resizeBg();
  window.addEventListener('resize', resizeBg);
  requestAnimationFrame(animateBg);
}

function resizeBg() {
  if (!_bgCanvas) return;
  _bgCanvas.width  = window.innerWidth;
  _bgCanvas.height = window.innerHeight;
  _particles = Array.from({ length: 60 }, () => createParticle());
}

function createParticle() {
  return {
    x:    Math.random() * window.innerWidth,
    y:    Math.random() * window.innerHeight,
    r:    Math.random() * 1.5 + 0.3,
    vx:   (Math.random() - 0.5) * 0.3,
    vy:   (Math.random() - 0.5) * 0.3,
    a:    Math.random() * 0.6 + 0.1,
    hue:  Math.random() > 0.5 ? 190 : 270,
  };
}

function animateBg() {
  if (!_bgCtx || !_bgCanvas) return;
  _bgCtx.clearRect(0, 0, _bgCanvas.width, _bgCanvas.height);
  for (const p of _particles) {
    _bgCtx.beginPath();
    _bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    _bgCtx.fillStyle = `hsla(${p.hue},80%,70%,${p.a})`;
    _bgCtx.fill();
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > _bgCanvas.width)  p.vx *= -1;
    if (p.y < 0 || p.y > _bgCanvas.height) p.vy *= -1;
  }
  requestAnimationFrame(animateBg);
}

// ─── Konfetti ────────────────────────────────────────────────────────────────
let _confCtx, _confCanvas, _pieces = [], _confActive = false;

export function initConfetti() {
  _confCanvas = document.getElementById('confettiCanvas');
  if (!_confCanvas) return;
  _confCtx    = _confCanvas.getContext('2d');
  window.addEventListener('resize', () => {
    _confCanvas.width  = window.innerWidth;
    _confCanvas.height = window.innerHeight;
  });
  _confCanvas.width  = window.innerWidth;
  _confCanvas.height = window.innerHeight;
}

export function triggerConfetti() {
  if (!_confCtx) return;
  _pieces = Array.from({ length: 80 }, () => ({
    x:      Math.random() * window.innerWidth,
    y:      -10,
    vx:     (Math.random() - 0.5) * 6,
    vy:     Math.random() * 4 + 2,
    color:  `hsl(${Math.random() * 360},85%,65%)`,
    size:   Math.random() * 8 + 4,
    rot:    Math.random() * 360,
    rotV:   (Math.random() - 0.5) * 6,
    life:   1,
  }));
  if (!_confActive) { _confActive = true; animateConf(); }
}

function animateConf() {
  if (!_confCtx) return;
  _confCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  _pieces = _pieces.filter(p => p.life > 0.01);
  for (const p of _pieces) {
    _confCtx.save();
    _confCtx.translate(p.x, p.y);
    _confCtx.rotate(p.rot * Math.PI / 180);
    _confCtx.globalAlpha = p.life;
    _confCtx.fillStyle   = p.color;
    _confCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    _confCtx.restore();
    p.x   += p.vx;
    p.y   += p.vy;
    p.vy  += 0.1;
    p.rot += p.rotV;
    p.life -= 0.012;
  }
  if (_pieces.length > 0) requestAnimationFrame(animateConf);
  else { _confActive = false; _confCtx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
}

// ─── Aufgaben-Anzeige ────────────────────────────────────────────────────────
export function renderInstruction(instruction) {
  if (!instruction) return;

  const { action, itemType, amount } = instruction;
  const actionEl = document.getElementById('actionWord');
  const itemEl   = document.getElementById('itemWord');
  const amountEl = document.getElementById('amountDisplay');
  const visual   = document.getElementById('ticketVisual');

  if (actionEl) {
    actionEl.textContent  = action.de;
    actionEl.className    = `font-orbitron text-3xl md:text-4xl font-black mb-2 ${action.math === 1 ? 'text-green-400' : 'text-red-400'}`;
  }
  if (amountEl) amountEl.textContent = amount;
  if (itemEl) {
    itemEl.textContent  = `${itemType.de} Tickets`;
    itemEl.className    = `font-orbitron text-xl md:text-2xl font-semibold ${itemType.math === 1 ? 'text-green-300' : 'text-red-300'}`;
  }

  if (visual) {
    visual.innerHTML = '';
    const max = Math.min(amount, 12);
    for (let i = 0; i < max; i++) {
      const t = document.createElement('div');
      t.className = `ticket-chip ${itemType.math === 1 ? 'ticket-pos' : 'ticket-neg'}`;
      t.textContent = itemType.math === 1 ? '+1' : '−1';
      t.style.animationDelay = `${i * 50}ms`;
      visual.appendChild(t);
    }
    if (amount > 12) {
      const more = document.createElement('div');
      more.className = 'ticket-chip ticket-more';
      more.textContent = `+${amount - 12}`;
      visual.appendChild(more);
    }
  }
}

// ─── Kontostand-Anzeige ──────────────────────────────────────────────────────
export function updateBalances(userBal, compBal) {
  animateBalance('userBalance', userBal);
  animateBalance('computerBalance', compBal);
}

export function setBalancesImmediate(userBal, compBal) {
  const u = document.getElementById('userBalance');
  const c = document.getElementById('computerBalance');
  if (u) u.textContent = userBal;
  if (c) c.textContent = compBal;
}

function animateBalance(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  const diff     = target - current;
  const steps    = 20;
  let i = 0;
  const interval = setInterval(() => {
    i++;
    const val = Math.round(current + diff * (i / steps));
    el.textContent = val;
    if (i >= steps) { clearInterval(interval); el.textContent = target; }
  }, 15);

  // Farbgebung
  el.className = el.className.replace(/text-(cyan|red|green|purple|slate)-\d+/g, '');
  if (target > 0)  el.classList.add('text-green-400');
  else if (target < 0) el.classList.add('text-red-400');
  else el.classList.add('text-slate-300');
}

// ─── Punktzahl-UI ────────────────────────────────────────────────────────────
export function updateScoreUI(state, levelProgress) {
  const { currentLevel, currentStreak, maxStreak, score } = state;
  const { LEVELS } = window._gameLevels || { LEVELS: [{ level: 1, name: 'Anfänger', range: [1, 5] }] };
  const levelData  = LEVELS?.[currentLevel] || LEVELS?.[0] || { level: 1, name: 'Anfänger', range: [1, 5] };

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('levelDisplay', levelData.level || 1);
  set('levelName',    levelData.name  || 'Anfänger');
  set('levelRange',   `Zahlen: ${levelData.range?.[0] || 1}–${levelData.range?.[1] || 5}`);
  set('scoreDisplay', score || 0);
  set('streakCount',  currentStreak || 0);

  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = `${levelProgress.pct || 0}%`;

  const label = document.getElementById('progressLabel');
  if (label) {
    if (levelProgress.atMax) label.textContent = '🏆 Höchstes Level erreicht!';
    else label.textContent = `${levelProgress.current}/${levelProgress.target} bis Level ${(levelData.level || 1) + 1}`;
  }
  const pct = document.getElementById('progressPct');
  if (pct) pct.textContent = `${levelProgress.pct || 0}%`;

  const flame = document.getElementById('streakFlame');
  if (flame) {
    if (currentStreak >= 15) flame.textContent = '🌟';
    else if (currentStreak >= 10) flame.textContent = '⚡';
    else if (currentStreak >= 5)  flame.textContent = '🔥';
    else flame.textContent = '🔥';
  }
}

// ─── Feedback-Anzeige ────────────────────────────────────────────────────────
export function showSuccess(msg) {
  showFeedback(msg, 'success');
}

export function showError(msg) {
  showFeedback(msg, 'error');
}

function showFeedback(msg, type) {
  const el = document.getElementById('feedbackArea');
  if (!el) return;
  el.className = `feedback-area feedback-${type} mb-4`;
  el.innerHTML = `<span class="text-lg mr-2">${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
  el.classList.remove('hidden');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => hideFeedback(), 3000);
}

export function hideFeedback() {
  const el = document.getElementById('feedbackArea');
  if (el) el.classList.add('hidden');
}

export function showComputerResult(instruction) {
  const el = document.getElementById('computerResult');
  if (!el || !instruction) return;
  const { action, itemType, amount, mathResult } = instruction;
  el.innerHTML = `
    <div class="text-xs text-slate-500 mb-1 font-orbitron uppercase">Computer-Zug</div>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="font-orbitron font-bold ${action.math === 1 ? 'text-green-400' : 'text-red-400'}">${action.de}</span>
      <span class="text-white font-bold">${amount}</span>
      <span class="${itemType.math === 1 ? 'text-green-300' : 'text-red-300'}">${itemType.de} Tickets</span>
      <span class="font-mono text-cyan-400">${instruction.correctExpression}</span>
      <span class="font-orbitron ${mathResult >= 0 ? 'text-green-400' : 'text-red-400'}">${mathResult >= 0 ? '+' : ''}${mathResult}</span>
    </div>`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ─── Spielereingabe-Bereich ───────────────────────────────────────────────────
export function showUserInputArea(show) {
  const el = document.getElementById('inputArea');
  if (el) el.classList.toggle('hidden', !show);
}

export function showComputerThinking(show) {
  const el = document.getElementById('computerThinking');
  if (el) el.classList.toggle('hidden', !show);
  if (show) showUserInputArea(false);
}

export function highlightInputs(expressionOk, balanceOk) {
  const exprEl = document.getElementById('expressionInput');
  const balEl  = document.getElementById('balanceInput');
  if (exprEl) {
    exprEl.classList.toggle('border-green-500/60', expressionOk);
    exprEl.classList.toggle('border-red-500/60',   !expressionOk);
  }
  if (balEl) {
    balEl.classList.toggle('border-green-500/60', balanceOk);
    balEl.classList.toggle('border-red-500/60',   !balanceOk);
  }
}

export function getInputValues() {
  const expr = document.getElementById('expressionInput')?.value || '';
  const bal  = document.getElementById('balanceInput')?.value || '';
  return { expression: expr, balance: bal };
}

export function setCheckBtnEnabled(enabled) {
  const btn = document.getElementById('checkBtn');
  if (btn) {
    btn.disabled = !enabled;
    btn.classList.toggle('opacity-50', !enabled);
    btn.classList.toggle('cursor-not-allowed', !enabled);
  }
}

// ─── Spielprotokoll ──────────────────────────────────────────────────────────
export function addLogEntry({ correct, expression, balance, instruction, score }) {
  const log = document.getElementById('gameLog');
  if (!log) return;

  const empty = log.querySelector('.log-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = `log-entry log-${correct ? 'correct' : 'wrong'}`;
  item.innerHTML = `
    <span class="log-icon">${correct ? '✅' : '❌'}</span>
    <span class="log-expr font-mono">${escapeHtml(expression)}</span>
    <span class="log-detail text-xs text-slate-500">= ${escapeHtml(String(balance))}</span>
    ${correct && score ? `<span class="log-score text-xs text-cyan-400 ml-auto">+${score}</span>` : ''}`;
  log.prepend(item);

  // Max. 20 Einträge
  while (log.children.length > 20) log.lastChild?.remove();
}

export function clearGameLog() {
  const log = document.getElementById('gameLog');
  if (!log) return;
  log.innerHTML = '<div class="log-empty text-slate-600 text-sm text-center py-4">Noch keine Züge gespielt.</div>';
}

// ─── Errungenschaften ────────────────────────────────────────────────────────
export function renderAchievements(unlockedSet) {
  const container = document.getElementById('achievementsGrid');
  if (!container) return;

  const { ACHIEVEMENTS } = window._gameAchievements || { ACHIEVEMENTS: [] };
  if (!ACHIEVEMENTS.length) return;

  container.innerHTML = ACHIEVEMENTS.map(ach => {
    const unlocked = unlockedSet.has(ach.id);
    return `
      <div class="achievement-card ${unlocked ? 'achievement-unlocked' : 'achievement-locked'}" title="${escapeHtml(ach.desc || '')}">
        <div class="achievement-icon">${unlocked ? ach.icon : '🔒'}</div>
        <div class="achievement-name text-xs text-center mt-1 leading-tight">${escapeHtml(ach.name)}</div>
        ${unlocked ? '<div class="achievement-glow"></div>' : ''}
      </div>`;
  }).join('');
}

export function showAchievementToast(achievement) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'achievement-toast pointer-events-auto';
  el.innerHTML = `
    <div class="text-2xl">${achievement.icon}</div>
    <div>
      <div class="text-xs text-yellow-400 font-orbitron uppercase tracking-wide">Errungenschaft</div>
      <div class="font-bold text-slate-100">${escapeHtml(achievement.name)}</div>
      <div class="text-xs text-slate-400">${escapeHtml(achievement.desc || '')}</div>
    </div>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

export function showLevelUp(levelData) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center pointer-events-none';
  overlay.innerHTML = `
    <div class="level-up-banner text-center animate-pop">
      <div class="text-5xl mb-2">🚀</div>
      <div class="font-orbitron text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
        LEVEL ${levelData.level}!
      </div>
      <div class="text-slate-300 mt-1">${escapeHtml(levelData.name || '')}</div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2200);
}

export function showScorePopup(score, x, y) {
  const el = document.createElement('div');
  el.className = 'score-popup';
  el.textContent = `+${score}`;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ─── Highscore ───────────────────────────────────────────────────────────────
export function setHighScoreDisplay(score) {
  const el = document.getElementById('highScore');
  if (el) el.textContent = score;
}

// ─── Ticket-Stack ────────────────────────────────────────────────────────────
export function updateTicketStack(instruction) {
  const container = document.getElementById('ticketStackVisual');
  if (!container || !instruction) return;

  const { action, itemType, amount } = instruction;
  const isAdding = (action.math * itemType.math) > 0;

  const chip = document.createElement('div');
  chip.className = `ticket-stack-item ${isAdding ? 'ticket-add' : 'ticket-remove'} ${itemType.math === 1 ? 'ticket-pos' : 'ticket-neg'}`;
  chip.textContent = `${isAdding ? '+' : '−'}${amount} ${itemType.de}`;
  container.prepend(chip);
  setTimeout(() => chip.classList.add('ticket-visible'), 50);

  while (container.children.length > 8) container.lastChild?.remove();
}

// ─── Tägliche Belohnung Animation ────────────────────────────────────────────
export function showDailyRewardModal(reward, streak) {
  const overlay = document.getElementById('dailyRewardOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');

  const el = document.getElementById('dailyRewardContent');
  if (el) {
    el.innerHTML = `
      <div class="text-6xl mb-4 animate-bounce">🎁</div>
      <h2 class="font-orbitron text-2xl font-black text-yellow-400 mb-2">Tagesbonus!</h2>
      <p class="text-slate-300 mb-4">Tag ${streak} in Folge eingeloggt</p>
      <div class="font-orbitron text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
        +${reward} Punkte
      </div>
      <div class="flex gap-1 justify-center mt-4">
        ${Array.from({ length: Math.min(streak, 7) }, (_, i) =>
          `<div class="w-8 h-8 rounded-full ${i < streak ? 'bg-yellow-400' : 'bg-slate-700'} flex items-center justify-center text-sm">
            ${i < streak ? '⭐' : '○'}
          </div>`
        ).join('')}
      </div>`;
  }
}

export function hideDailyRewardModal() {
  const overlay = document.getElementById('dailyRewardOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
