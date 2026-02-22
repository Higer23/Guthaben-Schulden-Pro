/**
 * stats.js
 * ========
 * Statistik-Dashboard — Responsive & Mobile-optimiert
 * Bug-Fix: Mobiler Ausrichtungsfehler behoben
 */

const STATS_KEY = 'gss_stats_v4';

// ─── Standard-Statistiken ────────────────────────────────────────────────────
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

// ─── Laden / Speichern ───────────────────────────────────────────────────────
export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    return { ...defaultStats(), ...JSON.parse(raw) };
  } catch (_) {
    return defaultStats();
  }
}

function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
}

export function clearStats() {
  localStorage.removeItem(STATS_KEY);
}

// ─── Versuch aufzeichnen ─────────────────────────────────────────────────────
export function recordAttempt(correct, instruction) {
  if (!instruction) return;
  const stats = loadStats();
  stats.totalAttempts++;
  if (correct) stats.totalCorrect++;

  if (instruction.action && instruction.itemType) {
    const actionKey = instruction.action.math === 1 ? 'take' : 'give';
    const itemKey   = instruction.itemType.math === 1 ? 'positive' : 'negative';
    const opKey     = `${actionKey}|${itemKey}`;
    if (!stats.operationErrors[opKey]) stats.operationErrors[opKey] = { correct: 0, total: 0 };
    stats.operationErrors[opKey].total++;
    if (correct) stats.operationErrors[opKey].correct++;
  }
  saveStats(stats);
}

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

// ─── Dashboard rendern ───────────────────────────────────────────────────────
let _accuracyChart = null;
let _opsChart      = null;

export function renderDashboard(state) {
  const stats = loadStats();
  updateStatCards(state, stats);
  renderAccuracyChart(stats);
  renderOpsChart(stats);
  renderHeatmap(stats);
}

function updateStatCards(state, stats) {
  const safeState = (state && typeof state === 'object') ? state : {};
  const total     = safeState.totalAttempts ?? stats.totalAttempts ?? 0;
  const correct   = safeState.totalCorrect  ?? stats.totalCorrect  ?? 0;
  const accuracy  = total > 0 ? Math.round((correct / total) * 100) : 0;
  const maxStreak = Math.max(safeState.maxStreak ?? 0, stats.maxStreak ?? 0);
  const games     = safeState.totalGamesPlayed ?? 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statTotalCorrect', correct);
  set('statAccuracy',     `${accuracy}%`);
  set('statMaxStreak',    maxStreak);
  set('statGamesPlayed',  games);
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

  if (_accuracyChart) {
    _accuracyChart.data.labels      = labels;
    _accuracyChart.data.datasets[0].data = data;
    _accuracyChart.update('active');
    return;
  }

  _accuracyChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:           'Genauigkeit %',
        data,
        borderColor:     'rgba(34,211,238,0.8)',
        backgroundColor: 'rgba(34,211,238,0.1)',
        fill:            true,
        tension:         0.4,
        pointBackgroundColor: 'rgba(34,211,238,1)',
        pointRadius:     4,
        borderWidth:     2,
      }],
    },
    options: chartOptions('Genauigkeit (%)', 0, 100),
  });
}

function renderOpsChart(stats) {
  const canvas = document.getElementById('opsChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const ops    = stats.operationErrors || {};
  const labels = [
    'Nehmen +', 'Nehmen −', 'Abgeben +', 'Abgeben −',
  ];
  const correct = [
    ops['take|positive']?.correct || 0,
    ops['take|negative']?.correct || 0,
    ops['give|positive']?.correct || 0,
    ops['give|negative']?.correct || 0,
  ];
  const wrong = [
    (ops['take|positive']?.total || 0) - (ops['take|positive']?.correct || 0),
    (ops['take|negative']?.total || 0) - (ops['take|negative']?.correct || 0),
    (ops['give|positive']?.total || 0) - (ops['give|positive']?.correct || 0),
    (ops['give|negative']?.total || 0) - (ops['give|negative']?.correct || 0),
  ];

  if (_opsChart) {
    _opsChart.data.datasets[0].data = correct;
    _opsChart.data.datasets[1].data = wrong;
    _opsChart.update('active');
    return;
  }

  _opsChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'Richtig',
          data:            correct,
          backgroundColor: 'rgba(34,197,94,0.7)',
          borderColor:     'rgba(34,197,94,1)',
          borderWidth:     1,
          borderRadius:    4,
        },
        {
          label:           'Falsch',
          data:            wrong,
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderColor:     'rgba(239,68,68,1)',
          borderWidth:     1,
          borderRadius:    4,
        },
      ],
    },
    options: chartOptions('Anzahl', 0),
  });
}

export function renderHeatmap(stats) {
  const container = document.getElementById('heatmapContainer');
  if (!container) return;

  const _stats   = stats || loadStats();
  const ops      = _stats.operationErrors || {};
  const cellData = [
    { action: 'Nehmen',  item: 'Positiv', key: 'take|positive' },
    { action: 'Nehmen',  item: 'Negativ', key: 'take|negative' },
    { action: 'Abgeben', item: 'Positiv', key: 'give|positive' },
    { action: 'Abgeben', item: 'Negativ', key: 'give|negative' },
  ];

  container.innerHTML = `
    <div class="heatmap-grid">
      ${cellData.map(cell => {
        const d        = ops[cell.key] || { correct: 0, total: 0 };
        const errorRate = d.total > 0 ? Math.round((1 - d.correct / d.total) * 100) : 0;
        const opacity  = Math.min(0.9, errorRate / 100 + 0.05);
        const color    = errorRate > 60 ? `rgba(239,68,68,${opacity})` :
                         errorRate > 30 ? `rgba(234,179,8,${opacity})` :
                         `rgba(34,197,94,${opacity})`;
        return `
          <div class="heatmap-cell" style="background:${color};">
            <div class="heatmap-action">${cell.action}</div>
            <div class="heatmap-item">${cell.item}</div>
            <div class="heatmap-rate">${errorRate}% Fehler</div>
            <div class="heatmap-count">${d.total} Versuche</div>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── Chart-Optionen ──────────────────────────────────────────────────────────
function chartOptions(yLabel, yMin = null, yMax = null) {
  const opts = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(148,163,184,0.9)', font: { size: 11 } } },
    },
    scales: {
      x: {
        ticks: { color: 'rgba(100,116,139,0.9)', font: { size: 10 } },
        grid:  { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        title: { display: !!yLabel, text: yLabel, color: 'rgba(100,116,139,0.9)', font: { size: 10 } },
        ticks: { color: 'rgba(100,116,139,0.9)', font: { size: 10 } },
        grid:  { color: 'rgba(255,255,255,0.04)' },
      },
    },
    animation: { duration: 600 },
  };
  if (yMin !== null) opts.scales.y.min = yMin;
  if (yMax !== null) opts.scales.y.max = yMax;
  return opts;
}
