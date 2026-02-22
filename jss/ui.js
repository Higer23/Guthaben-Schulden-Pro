/**
 * ui.js
 * =====
 * UI module — 60fps animations via requestAnimationFrame.
 * FIXES:
 *   HATA 13 : renderInstruction — null guard
 *   HATA 14 : i18n desteği — action/itemType metinleri t() ile
 */

import { ACHIEVEMENTS, LEVELS, formatSigned } from './gameLogic.js';
import { t } from './i18n.js';

// ─── Particle / Background ──────────────────────────────────
let bgCtx, bgW, bgH, particles = [];

function resizeBg() {
  const c = document.getElementById('bgCanvas');
  if (!c) return;
  bgW = c.width  = window.innerWidth;
  bgH = c.height = window.innerHeight;
}

export function initBackground() {
  const c = document.getElementById('bgCanvas');
  if (!c) return;
  bgCtx = c.getContext('2d');
  resizeBg();
  window.addEventListener('resize', resizeBg);
  for (let i = 0; i < 55; i++) {
    particles.push({
      x:     Math.random() * bgW,
      y:     Math.random() * bgH,
      r:     Math.random() * 1.6 + 0.3,
      dx:    (Math.random() - 0.5) * 0.25,
      dy:    (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.4 + 0.1,
    });
  }
  requestAnimationFrame(bgLoop);
}

function bgLoop() {
  if (!bgCtx) return;
  bgCtx.clearRect(0, 0, bgW, bgH);
  for (const p of particles) {
    bgCtx.beginPath();
    bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(0,212,255,${p.alpha})`;
    bgCtx.fill();
    p.x += p.dx; p.y += p.dy;
    if (p.x < 0) p.x = bgW;
    if (p.x > bgW) p.x = 0;
    if (p.y < 0) p.y = bgH;
    if (p.y > bgH) p.y = 0;
  }
  requestAnimationFrame(bgLoop);
}

// ─── Confetti ───────────────────────────────────────────────
let confCtx, confW, confH, confParticles = [], confRunning = false;

export function initConfetti() {
  const c = document.getElementById('confettiCanvas');
  if (!c) return;
  confCtx = c.getContext('2d');
  const resize = () => { confW = c.width = window.innerWidth; confH = c.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
}

export function triggerConfetti() {
  if (!confCtx) return;
  const colors = ['#00d4ff','#a855f7','#00ff88','#ffe500','#ff9500','#ff3d3d'];
  confParticles = Array.from({ length: 80 }, () => ({
    x:     Math.random() * confW,
    y:     -10,
    vx:    (Math.random() - 0.5) * 4,
    vy:    Math.random() * 5 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    w:     Math.random() * 8 + 4,
    h:     Math.random() * 5 + 3,
    r:     Math.random() * Math.PI * 2,
    dr:    (Math.random() - 0.5) * 0.2,
    life:  1,
  }));
  if (!confRunning) { confRunning = true; confLoop(); }
}

function confLoop() {
  confCtx.clearRect(0, 0, confW, confH);
  confParticles = confParticles.filter((p) => p.life > 0.01);
  for (const p of confParticles) {
    p.x += p.vx; p.y += p.vy; p.r += p.dr; p.life -= 0.008;
    confCtx.save();
    confCtx.translate(p.x, p.y);
    confCtx.rotate(p.r);
    confCtx.globalAlpha = p.life;
    confCtx.fillStyle   = p.color;
    confCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confCtx.restore();
  }
  if (confParticles.length > 0) {
    requestAnimationFrame(confLoop);
  } else {
    confRunning = false;
    confCtx.clearRect(0, 0, confW, confH);
  }
}

// ─── DOM Shortcuts ──────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── Instruction Rendering ──────────────────────────────────
/**
 * FIX HATA 13: null guard — instruction null ise crash önlendi.
 * FIX HATA 14: i18n desteği — action/itemType dil değişimine duyarlı.
 */
export function renderInstruction(instruction, turn) {
  // FIX HATA 13
  if (!instruction) {
    console.warn('renderInstruction: null instruction, skipping');
    return;
  }

  const { action, itemType, amount } = instruction;

  const actionEl = $('actionWord');
  const amountEl = $('amountDisplay');
  const itemEl   = $('itemWord');
  const ticketEl = $('ticketVisual');

  if (!actionEl) return;

  [actionEl, amountEl, itemEl].forEach((el) => {
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; }
  });

  requestAnimationFrame(() => {
    // FIX HATA 14: i18n t() kullanılarak dil desteği
    const actionKey = action.math === 1 ? 'nehmen' : 'abgeben';
    const itemKey   = itemType.math === 1 ? 'positiv' : 'negativ';
    if (actionEl) actionEl.textContent = t(actionKey).toUpperCase();
    if (amountEl) amountEl.textContent = amount;
    if (itemEl)   itemEl.textContent   = `${t(itemKey)} Ticket${amount !== 1 ? 's' : ''}`;

    if (actionEl) {
      actionEl.style.color      = action.math === 1 ? 'var(--cyan)' : 'var(--orange-neon)';
      actionEl.style.textShadow = action.math === 1
        ? '0 0 20px rgba(0,212,255,0.5)'
        : '0 0 20px rgba(255,149,0,0.5)';
    }
    if (itemEl) itemEl.style.color = itemType.math === 1 ? 'var(--green-neon)' : 'var(--red-neon)';

    [actionEl, amountEl, itemEl].forEach((el, i) => {
      if (!el) return;
      el.style.transition = `opacity 0.3s ease ${i * 60}ms, transform 0.3s ease ${i * 60}ms`;
      el.style.opacity    = '1';
      el.style.transform  = 'translateY(0)';
    });

    if (ticketEl) {
      ticketEl.innerHTML = '';
      const displayCount = Math.min(amount, 8);
      for (let i = 0; i < displayCount; i++) {
        const ticket = document.createElement('span');
        ticket.classList.add('ticket', itemType.class);
        ticket.textContent      = itemType.emoji;
        ticket.style.animationDelay = `${i * 60}ms`;
        ticketEl.appendChild(ticket);
      }
      if (amount > 8) {
        const more = document.createElement('span');
        more.classList.add('ticket', itemType.class);
        more.textContent = `+${amount - 8}`;
        ticketEl.appendChild(more);
      }
    }
  });

  renderTurnBadge(turn);
}

export function renderTurnBadge(turn) {
  const badge    = $('turnBadge');
  const userCard = $('userCard');
  const userInd  = $('userTurnIndicator');
  const compInd  = $('computerTurnIndicator');
  if (!badge) return;

  if (turn === 'user' || turn == null) {
    badge.innerHTML = `🎮 ${t('your_turn_badge')}`;
    badge.className = 'px-3 py-1 rounded-full text-xs font-orbitron font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    userCard?.classList.add('active-turn');
    userInd?.classList.remove('hidden');
    compInd?.classList.add('hidden');
  } else {
    badge.textContent = `🤖 ${t('computer')}`;
    badge.className   = 'px-3 py-1 rounded-full text-xs font-orbitron font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30';
    userCard?.classList.remove('active-turn');
    userInd?.classList.add('hidden');
    compInd?.classList.remove('hidden');
  }
}

// ─── Balance Animation ───────────────────────────────────────
function animateBalance(el, from, to, duration = 600) {
  if (!el) return;
  const start = performance.now();
  const diff  = to - from;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease    = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + diff * ease);

    el.textContent = current;
    el.className   = el.className.replace(/\bpositive\b|\bnegative\b/g, '').trim();
    if (current > 0) el.classList.add('positive');
    else if (current < 0) el.classList.add('negative');

    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = to;
  }
  requestAnimationFrame(tick);
}

export function updateBalances(userBal, compBal) {
  const uEl = $('userBalance');
  const cEl = $('computerBalance');
  const uFrom = parseInt(uEl?.textContent || '0');
  const cFrom = parseInt(cEl?.textContent || '0');
  animateBalance(uEl, uFrom, userBal);
  animateBalance(cEl, cFrom, compBal);
}

export function setBalancesImmediate(user, comp) {
  const uel = $('userBalance');
  const cel = $('computerBalance');
  if (uel) { uel.textContent = user; uel.className = uel.className.replace(/\b(positive|negative)\b/g, '').trim(); }
  if (cel) { cel.textContent = comp; cel.className = cel.className.replace(/\b(positive|negative)\b/g, '').trim(); }
}

// ─── Score / Progress UI ────────────────────────────────────
export function updateScoreUI(state, progress) {
  if (!state) return;
  const lvl = LEVELS[state.currentLevel] ?? LEVELS[0];

  if ($('levelDisplay')) $('levelDisplay').textContent = lvl.level;
  if ($('levelName'))    $('levelName').textContent    = lvl.name;
  if ($('levelRange'))   $('levelRange').textContent   = `Zahlen: ${lvl.range[0]}–${lvl.range[1]}`;
  if ($('scoreDisplay')) $('scoreDisplay').textContent = state.score;
  if ($('streakCount'))  $('streakCount').textContent  = state.currentStreak;

  const bar = $('progressBar');
  if (bar) bar.style.width = `${progress.pct}%`;
  if ($('progressLabel')) {
    $('progressLabel').textContent = progress.atMax
      ? '✦ Maximales Level erreicht!'
      : `${progress.current} / ${progress.target} bis Level ${lvl.level + 1}`;
  }
  if ($('progressPct')) $('progressPct').textContent = `${progress.pct}%`;

  const flame = $('streakFlame');
  if (flame && state.currentStreak > 0) {
    flame.classList.remove('pulse');
    void flame.offsetWidth;
    flame.classList.add('pulse');
  }
}

export function setHighScoreDisplay(score) {
  if ($('highScore')) $('highScore').textContent = score;
}

// ─── Feedback ────────────────────────────────────────────────
export function showSuccess(pts, instruction) {
  const area  = $('feedbackArea');
  const icon  = $('feedbackIcon');
  const title = $('feedbackTitle');
  const msg   = $('feedbackMessage');
  if (!area) return;

  area.className = 'feedback-area rounded-2xl p-5 success';
  area.classList.remove('hidden');
  if (icon)  icon.textContent  = '✅';
  if (title) title.textContent = t('correct_title');
  if (msg && instruction) {
    msg.textContent = `${instruction.correctExpression} = ${instruction.newBalance > 0 ? '+' : ''}${instruction.newBalance}. +${pts} Punkte!`;
  }
}

export function showError(message) {
  const area  = $('feedbackArea');
  const icon  = $('feedbackIcon');
  const title = $('feedbackTitle');
  const msg   = $('feedbackMessage');
  if (!area) return;

  area.className = 'feedback-area rounded-2xl p-5 error';
  area.classList.remove('hidden');
  if (icon)  icon.textContent = '❌';
  if (title) title.textContent = t('incorrect_title');
  if (msg)   msg.innerHTML = message;
}

export function showComputerResult(instruction, newBal) {
  const area  = $('feedbackArea');
  const icon  = $('feedbackIcon');
  const title = $('feedbackTitle');
  const msg   = $('feedbackMessage');
  if (!area) return;

  area.className = 'feedback-area rounded-2xl p-5';
  area.style.borderColor = 'rgba(168,85,247,0.25)';
  area.style.background  = 'rgba(168,85,247,0.06)';
  area.classList.remove('hidden');
  if (icon)  icon.textContent  = '🤖';
  if (title) title.textContent = 'Computer gespielt';
  if (msg && instruction) {
    // Use action/itemType text safely
    const actionText  = instruction.action?.de  || '';
    const itemText    = instruction.itemType?.de || '';
    msg.innerHTML = `${actionText} ${instruction.amount} ${itemText} → <strong>${instruction.correctExpression}</strong> = <strong>${newBal}</strong>`;
  }
}

export function hideFeedback() {
  const area = $('feedbackArea');
  if (area) {
    area.classList.add('hidden');
    area.style.borderColor = '';
    area.style.background  = '';
  }
}

// ─── Input Area Toggle ───────────────────────────────────────
export function showUserInputArea() {
  $('inputArea')?.classList.remove('hidden');
  $('computerThinking')?.classList.add('hidden');
  const ex = $('expressionInput');
  const bl = $('balanceInput');
  // FIX UX 1: inputs temizleniyor, focus ayarlanıyor
  if (ex) { ex.value = ''; ex.classList.remove('input-correct','input-error'); }
  if (bl) { bl.value = ''; bl.classList.remove('input-correct','input-error'); }
  if (ex) ex.focus();
}

export function showComputerThinking() {
  $('inputArea')?.classList.add('hidden');
  $('computerThinking')?.classList.remove('hidden');
}

/**
 * FIX: highlightInputs artık (instruction) bekliyor —
 * validateAnswer sonucu değil, instruction objesi.
 * Ama önceden exprOk/balOk alıyordu. Geriye dönük uyumlu hale getirildi.
 */
export function highlightInputs(exprOkOrInstruction, balOk) {
  const ex = $('expressionInput');
  const bl = $('balanceInput');
  // If called with instruction (object), just clear styles
  if (exprOkOrInstruction && typeof exprOkOrInstruction === 'object') {
    if (ex) ex.classList.remove('input-correct', 'input-error');
    if (bl) bl.classList.remove('input-correct', 'input-error');
    return;
  }
  const exprOk = exprOkOrInstruction;
  if (ex) { ex.classList.remove('input-correct','input-error'); ex.classList.add(exprOk ? 'input-correct' : 'input-error'); }
  if (bl) { bl.classList.remove('input-correct','input-error'); bl.classList.add(balOk  ? 'input-correct' : 'input-error'); }
}

export function getInputValues() {
  return {
    expression: $('expressionInput')?.value ?? '',
    balance:    $('balanceInput')?.value    ?? '',
  };
}

export function setCheckBtnEnabled(enabled) {
  const btn = $('checkBtn');
  if (btn) btn.disabled = !enabled;
}

// ─── Game Log ────────────────────────────────────────────────
export function addLogEntry(html, who, correct) {
  const log = $('gameLog');
  if (!log) return;

  const placeholder = log.querySelector('p');
  if (placeholder) placeholder.remove();

  const entry = document.createElement('div');
  entry.className = `game-log-entry ${who === 'computer' ? 'computer' : correct ? 'correct' : 'incorrect'}`;
  entry.innerHTML = html;
  log.prepend(entry);

  while (log.children.length > 30) log.removeChild(log.lastChild);
}

export function clearGameLog() {
  const log = $('gameLog');
  if (log) log.innerHTML = `<p class="text-slate-500 text-sm text-center py-4">${t('no_moves')}</p>`;
}

// ─── Achievements ────────────────────────────────────────────
export function renderAchievements(unlockedSet) {
  const grid = $('achievementsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const ach of ACHIEVEMENTS) {
    const unlocked = unlockedSet instanceof Set ? unlockedSet.has(ach.id) : false;
    const div = document.createElement('div');
    div.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
    div.title = `${ach.name}: ${ach.description}`;
    div.innerHTML = `
      <span class="achievement-icon" style="opacity:${unlocked ? 1 : 0.25}">${ach.icon}</span>
      <span class="achievement-name">${unlocked ? ach.name.toUpperCase() : '???'}</span>
    `;
    grid.appendChild(div);
  }
}

export function showAchievementToast(ach) {
  const container = $('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <span class="text-3xl flex-shrink-0">${ach.icon}</span>
    <div>
      <div class="font-orbitron text-xs font-bold text-yellow-300 uppercase tracking-widest">Abzeichen freigeschaltet!</div>
      <div class="font-semibold text-white text-sm">${ach.name}</div>
      <div class="text-slate-400 text-xs">${ach.description}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ─── Score Popup ─────────────────────────────────────────────
export function showScorePopup(score) {
  const popup = document.createElement('div');
  popup.className   = 'score-popup';
  popup.textContent = `+${score}`;
  const ref = $('scoreDisplay');
  if (ref) {
    const rect = ref.getBoundingClientRect();
    popup.style.left = `${rect.left + rect.width / 2 - 30}px`;
    popup.style.top  = `${rect.top + window.scrollY - 10}px`;
  } else {
    popup.style.left = '50%';
    popup.style.top  = '40%';
  }
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1500);
}

// ─── Level Up ────────────────────────────────────────────────
export function showLevelUp(levelIndex) {
  const lvl = LEVELS[levelIndex] ?? LEVELS[0];

  const flash = document.createElement('div');
  flash.className = 'levelup-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 900);

  const container = $('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.style.borderColor = 'rgba(0,212,255,0.4)';
  toast.style.background  = 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))';
  toast.innerHTML = `
    <span class="text-3xl">🚀</span>
    <div>
      <div class="font-orbitron text-xs font-bold text-cyan-300 uppercase tracking-widest">Level Up!</div>
      <div class="font-semibold text-white text-sm">Level ${lvl.level}: ${lvl.name}</div>
      <div class="text-slate-400 text-xs">Zahlen bis ${lvl.range[1]}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 400); }, 3500);
}

// ─── Ticket Stack Visual Engine ──────────────────────────────
let _stackTickets = [];

export function updateTicketStack(toBalance, instruction) {
  const area     = $('ticketStackArea');
  const balEl    = $('stackBalance');
  const emptyEl  = $('stackEmptyMsg');
  const lastOpEl = $('lastOpDisplay');
  const svgArea  = $('ticketFlightSVG');

  if (!area) return;

  if (lastOpEl && instruction) {
    lastOpEl.textContent = instruction.correctExpression + ' = ' + (toBalance > 0 ? '+' : '') + toBalance;
  }

  if (balEl) {
    balEl.textContent = (toBalance > 0 ? '+' : '') + toBalance;
    balEl.style.color = toBalance > 0 ? 'var(--green-neon)' : toBalance < 0 ? 'var(--red-neon)' : 'var(--cyan)';
  }

  const target = Math.max(-20, Math.min(20, toBalance));

  if (svgArea && instruction) {
    animateTicketFlight(svgArea, instruction);
  }

  _stackTickets.forEach((t) => {
    if (t.el.parentNode) t.el.classList.add('fly-out');
    setTimeout(() => t.el.remove(), 400);
  });
  _stackTickets = [];

  setTimeout(() => {
    if (!area) return;
    const type  = target >= 0 ? 'positive' : 'negative';
    const count = Math.abs(target);
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className  = `stack-ticket ${type} fly-in`;
      el.textContent = type === 'positive' ? '+' : '−';
      el.style.animationDelay = `${i * 30}ms`;
      area.appendChild(el);
      _stackTickets.push({ type, el });
    }
    if (emptyEl) emptyEl.style.display = count === 0 ? 'flex' : 'none';
  }, 450);
}

function animateTicketFlight(svgEl, instruction) {
  svgEl.innerHTML = '';
  const isPositive = instruction.itemType.math === 1;
  const isTaking   = instruction.action.math === 1;
  const color  = isPositive ? '#00ff88' : '#ff3d3d';
  const count  = Math.min(instruction.amount, 6);

  for (let i = 0; i < count; i++) {
    const rect   = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const startX = isTaking ? 370 : 30;
    const endX   = isTaking ? 30  : 370;
    const y      = 20 + i * 16;

    rect.setAttribute('x', startX);
    rect.setAttribute('y', y);
    rect.setAttribute('width', 20);
    rect.setAttribute('height', 14);
    rect.setAttribute('rx', 3);
    rect.setAttribute('fill', color);
    rect.setAttribute('opacity', '0.85');
    svgEl.appendChild(rect);

    const delay    = i * 80;
    const duration = 600;
    let start = null;

    function animRect(ts) {
      if (!start) start = ts + delay;
      if (ts < start) { requestAnimationFrame(animRect); return; }
      const p    = Math.min((ts - start) / duration, 1);
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      const cx   = startX + (endX - startX) * ease;
      rect.setAttribute('x', cx);
      rect.setAttribute('opacity', p < 0.9 ? '0.85' : `${0.85 * (1 - (p - 0.9) / 0.1)}`);
      if (p < 1) requestAnimationFrame(animRect);
      else rect.remove();
    }
    requestAnimationFrame(animRect);
  }
}
