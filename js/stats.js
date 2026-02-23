/**
 * stats.js
 * ========
 * Dynamic Statistics & Analytics Dashboard
 * FIXES:
 *   HATA 15 : updateStatCards — state undefined guard
 *   HATA 16 : renderHeatmap  — argümansız çağrıldığında loadStats() ile fallback
 */

const STATS_KEY = 'gleichgewicht_stats_v2';

// ─── Default Stats ────────────────────────────────────────────
function defaultStats() {
  return {
    sessions: [],
    operationErrors: {
      'take|positive': { correct: 0, total: 0 },
      'take|negative': { correct: 0, total: 0 },
      'give|positive': { correct: 0, total: 0 },
      'give|negative': { correct: 0, total: 0 },
    },
    totalCorrect:  0,
    totalAttempts: 0,
    maxStreak:     0,
  };
}

// ─── Load / Save ─────────────────────────────────────────────
export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    return { ...defaultStats(), ...parsed };
  } catch (_) {
    return defaultStats();
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (_) {}
}

export function clearStats() {
  localStorage.removeItem(STATS_KEY);
}

// ─── Record Attempt ───────────────────────────────────────────
/**
 * FIX HATA 7: instruction objesi bekleniyor (string type değil).
 * @param {boolean}     correct
 * @param {Instruction} instruction - tam instruction objesi
 */
export function recordAttempt(correct, instruction) {
  if (!instruction) return;  // guard
  const stats = loadStats();

  stats.totalAttempts++;
  if (correct) stats.totalCorrect++;

  // Only process if instruction has proper action/itemType objects
  if (instruction.action && instruction.itemType) {
    const actionKey = instruction.action.math === 1 ? 'take' : 'give';
    const itemKey   = instruction.itemType.math === 1 ? 'positive' : 'negative';
    const opKey     = `${actionKey}|${itemKey}`;

    if (!stats.operationErrors[opKey]) {
      stats.operationErrors[opKey] = { correct: 0, total: 0 };
    }
    stats.operationErrors[opKey].total++;
    if (correct) stats.operationErrors[opKey].correct++;
  }

  saveStats(stats);
}

/**
 * FIX HATA 8: obje formatı — { correct, total, streak }
 * @param {{ correct: number, total: number, streak: number }} session
 */
export function recordSession(session) {
  if (!session || typeof session !== 'object') return;
  const stats = loadStats();
  stats.sessions.push({
    date:    new Date().toISOString(),
    correct: session.correct ?? 0,
    total:   session.total   ?? 0,
    streak:  session.streak  ?? 0,
  });
  if (stats.sessions.length > 30) stats.sessions.splice(0, stats.sessions.length - 30);
  stats.maxStreak = Math.max(stats.maxStreak, session.streak ?? 0);
  saveStats(stats);
}

// ─── Charts ──────────────────────────────────────────────────
let _accuracyChart = null;
let _opsChart      = null;

/**
 * FIX HATA 5 / 15: state parametresi bekleniyor; state undefined crash önlendi.
 * @param {GameState|undefined} state
 */
export function renderDashboard(state) {
  const stats = loadStats();
  updateStatCards(state, stats);
  renderAccuracyChart(stats);
  renderOpsChart(stats);
  renderHeatmap(stats);
}

/**
 * FIX HATA 15: state undefined guard — safeState kullanılıyor.
 */
function updateStatCards(state, stats) {
  // FIX HATA 15 — guard
  const safeState  = (state && typeof state === 'object') ? state : {};
  const total      = safeState.totalAttempts  ?? stats.totalAttempts  ?? 0;
  const correct    = safeState.totalCorrect   ?? stats.totalCorrect   ?? 0;
  const accuracy   = total > 0 ? Math.round((correct / total) * 100) : 0;
  const maxStreak  = Math.max(safeState.maxStreak ?? 0, stats.maxStreak ?? 0);

  const el = (id) => document.getElementById(id);
  if (el('statTotalCorrect')) el('statTotalCorrect').textContent = correct;
  if (el('statAccuracy'))     el('statAccuracy').textContent     = `${accuracy}%`;
  if (el('statMaxStreak'))    el('statMaxStreak').textContent    = maxStreak;
}

function renderAccuracyChart(stats) {
  const canvas = document.getElementById('accuracyChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = [];
  const data   = [];

  stats.sessions.slice(-15).forEach((s, i) => {
    labels.push(`S${i + 1}`);
    data.push(s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0);
  });

  if (labels.length === 0) { labels.push('–'); data.push(0); }

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Genauigkeit %',
        data,
        borderColor:          '#00d4ff',
        backgroundColor:      'rgba(0,212,255,0.08)',
        borderWidth:          2,
        pointBackgroundColor: '#00d4ff',
        pointRadius:          4,
        tension:              0.4,
        fill:                 true,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 0, max: 100,
          grid:   { color: 'rgba(255,255,255,0.04)' },
          ticks:  { color: '#64748b', font: { family: 'Orbitron', size: 10 }, callback: (v) => `${v}%` },
        },
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { family: 'Orbitron', size: 10 } },
        },
      },
    },
  };

  // Always destroy & recreate for clean render (FIX PERFORMANS 2)
  if (_accuracyChart) { _accuracyChart.destroy(); _accuracyChart = null; }
  _accuracyChart = new Chart(canvas, cfg);
}

function renderOpsChart(stats) {
  const canvas = document.getElementById('opsChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const ops    = stats.operationErrors;
  const labels = ['Nehmen+', 'Nehmen-', 'Abgeben+', 'Abgeben-'];
  const keys   = ['take|positive', 'take|negative', 'give|positive', 'give|negative'];
  const errors = keys.map((k) => {
    const o = ops[k] ?? { correct: 0, total: 0 };
    return o.total > 0 ? Math.round(((o.total - o.correct) / o.total) * 100) : 0;
  });

  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Fehlerquote %',
        data:             errors,
        backgroundColor:  ['rgba(0,212,255,0.3)','rgba(255,61,61,0.3)','rgba(0,255,136,0.3)','rgba(168,85,247,0.3)'],
        borderColor:      ['#00d4ff','#ff3d3d','#00ff88','#a855f7'],
        borderWidth:      1.5,
        borderRadius:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0, max: 100,
          grid:   { color: 'rgba(255,255,255,0.04)' },
          ticks:  { color: '#64748b', font: { family: 'Orbitron', size: 10 }, callback: (v) => `${v}%` },
        },
        x: {
          grid:  { display: false },
          ticks: { color: '#64748b', font: { family: 'Orbitron', size: 10 } },
        },
      },
    },
  };

  if (_opsChart) { _opsChart.destroy(); _opsChart = null; }
  _opsChart = new Chart(canvas, cfg);
}

/**
 * FIX HATA 16: argümansız çağrıldığında loadStats() ile fallback.
 * @param {Object|undefined} statsArg
 */
export function renderHeatmap(statsArg) {
  // FIX HATA 16 — argüman yoksa loadStats() kullan
  const stats    = (statsArg && typeof statsArg === 'object') ? statsArg : loadStats();
  const container = document.getElementById('heatmapGrid');
  if (!container) return;

  const ops   = stats.operationErrors;
  const cells = [
    { key: 'take|positive',  label: 'Nehmen\n+Positiv',  color: 'cyan'   },
    { key: 'take|negative',  label: 'Nehmen\n−Negativ',  color: 'purple' },
    { key: 'give|positive',  label: 'Abgeben\n+Positiv', color: 'green'  },
    { key: 'give|negative',  label: 'Abgeben\n−Negativ', color: 'orange' },
  ];

  container.innerHTML = '';
  for (const cell of cells) {
    const op       = ops[cell.key] ?? { correct: 0, total: 0 };
    const errRate  = op.total > 0 ? Math.round(((op.total - op.correct) / op.total) * 100) : 0;
    const heatAlpha = (errRate / 100) * 0.7;

    const div = document.createElement('div');
    div.className = 'heatmap-cell';
    div.style.background    = errRate > 50
      ? `rgba(255,61,61,${heatAlpha})`
      : errRate > 20
        ? `rgba(255,149,0,${heatAlpha})`
        : `rgba(0,255,136,${Math.max(0.05, heatAlpha)})`;
    div.style.borderColor   = errRate > 50 ? 'rgba(255,61,61,0.4)' : errRate > 20 ? 'rgba(255,149,0,0.4)' : 'rgba(0,255,136,0.4)';
    div.title = `${op.correct}/${op.total} korrekt`;

    div.innerHTML = `
      <div class="heatmap-count font-orbitron font-black" style="color:${errRate > 50 ? 'var(--red-neon)' : errRate > 20 ? 'var(--orange-neon)' : 'var(--green-neon)'}">${errRate}%</div>
      <div class="heatmap-label text-slate-400" style="white-space:pre-line;font-size:0.55rem;">${cell.label}</div>
      <div class="text-slate-500 text-xs">${op.total} Versuche</div>
    `;
    container.appendChild(div);
  }
}
