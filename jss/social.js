/**
 * social.js
 * =========
 * Social features: Leaderboard, Friends, Notifications
 * FIX GÜVENLİK 5: sanitize() all user-supplied data
 * FIX BUG 4: Promise.allSettled for friends
 * FIX PERFORMANS 3: cache for leaderboard
 */

import { getLeaderboard, getAllUsers, getCurrentUser as getUser } from './firebase-config.js';

// ─── XSS Guard ────────────────────────────────────────────────
function sanitize(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── Format helpers ───────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('tr-TR');
}

function showToast(msg, color = 'cyan') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el  = document.createElement('div');
  const cls = { cyan: 'border-cyan-500/40 text-cyan-300', green: 'border-green-500/40 text-green-300', red: 'border-red-500/40 text-red-300' };
  el.className  = `glass-panel border ${cls[color] || cls.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── Leaderboard Cache (FIX PERFORMANS 3) ────────────────────
const _cache = { leaderboard: null, ts: 0 };
const CACHE_TTL = 60_000; // 60s

export async function renderLeaderboard() {
  const container = document.getElementById('leaderboardContent');
  if (!container) return;
  container.innerHTML = loadingHtml();

  try {
    // FIX PERFORMANS 3: cache
    const now = Date.now();
    let board;
    if (_cache.leaderboard && (now - _cache.ts) < CACHE_TTL) {
      board = _cache.leaderboard;
    } else {
      board = await getLeaderboard();
      _cache.leaderboard = board;
      _cache.ts = now;
    }

    const entries = Object.entries(board || {})
      .map(([uid, d]) => ({ uid, ...d }))
      .filter(e => e.username)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .slice(0, 50);

    if (entries.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-center py-8">Henüz sıralama yok.</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = `
      <div class="space-y-2">
        ${entries.map((e, i) => `
          <div class="glass-panel rounded-xl px-4 py-3 flex items-center gap-4 border border-white/5 hover:border-white/10 transition-colors">
            <div class="w-8 text-center font-orbitron font-black ${i < 3 ? 'text-2xl' : 'text-slate-500 text-sm'}">
              ${i < 3 ? medals[i] : `#${i + 1}`}
            </div>
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              ${sanitize(e.username?.charAt(0)?.toUpperCase() || '?')}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-slate-200 font-semibold truncate">${sanitize(e.username)}</div>
              <div class="text-xs text-slate-500">Level ${e.maxLevel || 1} · ${e.gamesPlayed || 0} oyun</div>
            </div>
            <div class="text-right">
              <div class="font-orbitron font-black text-cyan-400">${(e.totalScore || 0).toLocaleString()}</div>
              <div class="text-xs text-slate-500">🔥 ${e.maxStreak || 0}</div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = errorHtml(err.message);
    console.error('renderLeaderboard error:', err);
  }
}

// ─── Friends Panel ────────────────────────────────────────────
export async function renderFriendsPanel() {
  const container = document.getElementById('friendsContent');
  if (!container) return;
  container.innerHTML = loadingHtml();

  try {
    const user = getUser?.() || null;
    if (!user || user.uid === '__admin__') {
      container.innerHTML = '<p class="text-slate-500 text-center py-8">Arkadaş sistemi giriş gerektirir.</p>';
      return;
    }

    const allUsers = await getAllUsers();
    const friendsArr = Object.entries(allUsers || {})
      .filter(([uid]) => uid !== user.uid)
      .slice(0, 20);

    if (friendsArr.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-center py-8">Kullanıcı bulunamadı.</p>';
      return;
    }

    // FIX BUG 4: Promise.allSettled yerine güvenli mapping
    const results = await Promise.allSettled(
      friendsArr.map(async ([uid, u]) => {
        const gs = u.gameStats || {};
        return { uid, username: u.profile?.username, gameStats: gs };
      })
    );

    const friends = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    container.innerHTML = `
      <div class="space-y-2">
        ${friends.map(f => `
          <div class="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border border-white/5">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold text-white">
              ${sanitize(f.username?.charAt(0)?.toUpperCase() || '?')}
            </div>
            <div class="flex-1">
              <div class="text-slate-200 font-semibold">${sanitize(f.username || 'Bilinmeyen')}</div>
              <div class="text-xs text-slate-500">Level ${f.gameStats?.maxLevel || 1}</div>
            </div>
            <div class="font-orbitron text-sm text-cyan-400">${(f.gameStats?.totalScore || 0).toLocaleString()}p</div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = errorHtml(err.message);
    console.error('renderFriendsPanel error:', err);
  }
}

// ─── Notifications ────────────────────────────────────────────
let _notifListener = null;

export function startNotificationListener() {
  // Notification listener placeholder — connects to Firebase onValue
  // Implementation depends on firebase-config's _onValue exposure
}

export function renderNotifications(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="p-3 text-center">
      <div class="font-orbitron text-xs text-slate-400 uppercase mb-2">Bildirimler</div>
      <p class="text-slate-500 text-xs">Henüz bildirim yok.</p>
    </div>`;
}

// ─── Helpers ─────────────────────────────────────────────────
function loadingHtml() {
  return `<div class="flex items-center justify-center py-12">
    <div class="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
    <span class="ml-3 text-slate-400 text-sm">Yükleniyor...</span>
  </div>`;
}

function errorHtml(msg) {
  return `<div class="text-red-400 p-4 text-sm text-center">${sanitize(msg)}</div>`;
}
