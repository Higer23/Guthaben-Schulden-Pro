/**
 * social.js
 * =========
 * Leaderboard, Friends, Challenges, Notifications
 * Guthaben-Schulden-Spiel Pro Edition
 */

import {
  getLeaderboard, getFriends, addFriend, acceptFriend,
  sendChallenge, getNotifications, markNotifRead,
  getUserProfile, getAllUsers, getUserGameStats,
  listenToNotifications,
} from './firebase-config.js';
import { getCurrentUser } from './auth.js';

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

export async function renderLeaderboard(containerId = 'leaderboardContainer') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-slate-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Sıralaması yükleniyor...</div>`;

  const board = await getLeaderboard();
  const me    = getCurrentUser();
  const myRank = board.findIndex(u => u.uid === me?.uid) + 1;

  const tabs = ['totalScore', 'maxStreak', 'maxLevel'];
  const tabLabels = { totalScore: '🏆 Puan', maxStreak: '🔥 Streak', maxLevel: '⭐ Seviye' };

  let activeSort = 'totalScore';

  function renderBoard(sort) {
    activeSort = sort;
    const sorted = [...board].sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
    return sorted.slice(0, 50).map((u, i) => {
      const isMe = u.uid === me?.uid;
      const medals = ['🥇', '🥈', '🥉'];
      const rank = i + 1;
      return `
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isMe
          ? 'border-cyan-500/40 bg-cyan-500/10'
          : 'border-white/5 bg-white/3 hover:bg-white/5'}">
          <span class="font-orbitron text-lg w-8 text-center ${rank <= 3 ? 'text-2xl' : 'text-slate-400'}">
            ${medals[rank - 1] || rank}
          </span>
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            ${u.username?.charAt(0)?.toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-slate-200 text-sm truncate">${u.username}${isMe ? ' (Sen)' : ''}</div>
            <div class="text-xs text-slate-500">${u.gamesPlayed} oyun</div>
          </div>
          <div class="text-right">
            <div class="font-orbitron font-bold text-cyan-400 text-sm">${(u[sort] || 0).toLocaleString()}</div>
            <div class="text-xs text-slate-500">${tabLabels[sort]?.split(' ')[1]}</div>
          </div>
        </div>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="mb-4 flex gap-2 flex-wrap">
      ${tabs.map(t => `
        <button class="lb-tab-btn px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${t === activeSort
          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
          : 'border-white/10 text-slate-400 hover:border-cyan-500/30'}" data-sort="${t}">${tabLabels[t]}</button>
      `).join('')}
    </div>

    ${myRank ? `<div class="mb-4 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm">
      <span class="text-purple-300">Senin Sıralaması:</span>
      <span class="font-orbitron text-purple-400 ml-2">#${myRank}</span>
    </div>` : ''}

    <div id="lbBoardList" class="space-y-2 max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
      ${renderBoard('totalScore')}
    </div>`;

  el.querySelectorAll('.lb-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.lb-tab-btn').forEach(b => {
        b.className = 'lb-tab-btn px-4 py-2 rounded-xl border text-sm font-semibold transition-all border-white/10 text-slate-400 hover:border-cyan-500/30';
      });
      btn.className = 'lb-tab-btn px-4 py-2 rounded-xl border text-sm font-semibold transition-all bg-cyan-500/20 border-cyan-500/40 text-cyan-300';
      document.getElementById('lbBoardList').innerHTML = renderBoard(btn.dataset.sort);
    });
  });
}

// ─── FRIENDS PANEL ────────────────────────────────────────────────────────────

export async function renderFriendsPanel(containerId = 'friendsContainer') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const me = getCurrentUser();
  if (!me) return;

  el.innerHTML = `<div class="flex items-center justify-center h-32 text-slate-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Arkadaşlar yükleniyor...</div>`;

  const friends = await getFriends(me.uid);
  const friendsArr = Object.entries(friends);

  // Get stats for each friend
  const friendStats = await Promise.all(
    friendsArr.map(async ([uid, f]) => {
      const stats = await getUserGameStats(uid);
      return { uid, ...f, stats };
    })
  );

  el.innerHTML = `
    <div class="flex gap-3 mb-6">
      <input id="friendSearchInput" placeholder="Kullanıcı adı ile ara..." class="game-input flex-1 px-4 py-2 rounded-xl text-sm" />
      <button onclick="window.searchAndAddFriend()" class="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30">
        <i class="fas fa-user-plus mr-2"></i>Ekle
      </button>
    </div>

    <div class="space-y-3" id="friendsList">
      ${friendStats.length === 0 ? '<p class="text-slate-500 text-sm text-center py-8">Henüz arkadaş eklenmedi.</p>' : ''}
      ${friendStats.map(f => `
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-all">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            ${f.username?.charAt(0)?.toUpperCase()}
          </div>
          <div class="flex-1">
            <div class="font-semibold text-slate-200">${f.username}</div>
            <div class="text-xs text-slate-500">Puan: <span class="text-cyan-400">${(f.stats?.totalScore || 0).toLocaleString()}</span></div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-400">Seviye ${f.stats?.currentLevel || 1}</div>
            <span class="text-xs px-2 py-0.5 rounded-full ${f.status === 'accepted'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'}">
              ${f.status === 'accepted' ? 'Arkadaş' : 'Beklemede'}
            </span>
          </div>
          ${f.status === 'accepted' ? `
            <button onclick="window.challengeFriend('${f.uid}','${f.username}')"
              class="ml-2 px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs hover:bg-orange-500/30">
              <i class="fas fa-bolt mr-1"></i>Meydan Oku
            </button>` : f.status === 'pending' ? `
            <button onclick="window.acceptFriendReq('${f.uid}')"
              class="ml-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-xs hover:bg-green-500/30">
              Kabul Et
            </button>` : ''}
        </div>`).join('')}
    </div>`;
}

window.searchAndAddFriend = async function() {
  const query = document.getElementById('friendSearchInput').value.trim();
  if (!query) return;
  const me = getCurrentUser();

  const users = await getAllUsers();
  const found = Object.entries(users).find(([uid, u]) =>
    u.profile?.username?.toLowerCase() === query.toLowerCase() && uid !== me.uid
  );

  if (!found) { showToast('Kullanıcı bulunamadı.', 'red'); return; }

  const [friendUid, friendData] = found;
  await addFriend(me.uid, friendUid, friendData.profile.username);
  showToast(`${friendData.profile.username} arkadaşlık isteği gönderildi!`, 'green');
  renderFriendsPanel();
};

window.acceptFriendReq = async function(friendUid) {
  const me = getCurrentUser();
  await acceptFriend(me.uid, friendUid);
  showToast('Arkadaşlık isteği kabul edildi!', 'green');
  renderFriendsPanel();
};

window.challengeFriend = async function(friendUid, friendName) {
  const me = getCurrentUser();
  const myScore = me?.profile ? (await getUserGameStats(me.uid))?.totalScore || 0 : 0;
  await sendChallenge(me.uid, friendUid, myScore);
  showToast(`${friendName}'e meydan okuma gönderildi! Hedef: ${myScore.toLocaleString()} puan`, 'cyan');
};

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export async function renderNotifications(containerId = 'notificationsContainer') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const me = getCurrentUser();
  if (!me || me.uid === '__admin__') return;

  const notifs = await getNotifications(me.uid);
  const arr    = Object.entries(notifs).sort((a, b) => (b[1].sentAt || 0) - (a[1].sentAt || 0));

  const unread = arr.filter(([, n]) => !n.isRead);

  // Update badge
  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent = unread.length;
    badge.style.display = unread.length > 0 ? 'flex' : 'none';
  }

  el.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest">Bildirimler</h3>
      ${unread.length > 0 ? `<button onclick="window.markAllNotifsRead()" class="text-xs text-cyan-400 hover:underline">Tümünü okundu yap</button>` : ''}
    </div>
    <div class="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
      ${arr.length === 0 ? '<p class="text-slate-500 text-sm text-center py-6">Bildirim yok.</p>' : ''}
      ${arr.map(([key, n]) => `
        <div class="px-4 py-3 rounded-xl border transition-all cursor-pointer ${n.isRead
          ? 'border-white/5 bg-white/3'
          : 'border-cyan-500/20 bg-cyan-500/5'}" onclick="window.markOneNotif('${key}', this)">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-0.5">${notifIcon(n.type)}</span>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-slate-200 text-sm">${n.title}</div>
              <div class="text-xs text-slate-400">${n.body}</div>
              <div class="text-xs text-slate-600 mt-1">${fmtTime(n.sentAt)}</div>
            </div>
            ${!n.isRead ? '<div class="w-2 h-2 bg-cyan-400 rounded-full mt-1 flex-shrink-0"></div>' : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

window.markOneNotif = async function(key, el) {
  const me = getCurrentUser();
  if (!me) return;
  await markNotifRead(me.uid, key);
  el.className = el.className.replace('border-cyan-500/20 bg-cyan-500/5', 'border-white/5 bg-white/3');
  const dot = el.querySelector('.w-2.h-2');
  if (dot) dot.remove();
  renderNotifications();
};

window.markAllNotifsRead = async function() {
  const me = getCurrentUser();
  if (!me) return;
  const notifs = await getNotifications(me.uid);
  await Promise.all(
    Object.keys(notifs).map(k => markNotifRead(me.uid, k))
  );
  renderNotifications();
};

// ─── START REAL-TIME NOTIFICATION LISTENER ───────────────────────────────────
export function startNotificationListener() {
  const me = getCurrentUser();
  if (!me || me.uid === '__admin__') return;
  listenToNotifications(me.uid, () => {
    renderNotifications('notificationsContainer');
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function notifIcon(type) {
  const map = { message: '✉️', achievement: '🏆', friend_request: '👋', challenge: '⚡', system: '🔔' };
  return map[type] || '🔔';
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, color = 'cyan') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  const colors = {
    cyan:  'border-cyan-500/40 text-cyan-300',
    green: 'border-green-500/40 text-green-300',
    red:   'border-red-500/40 text-red-300',
  };
  t.className = `glass-panel border ${colors[color] || colors.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
