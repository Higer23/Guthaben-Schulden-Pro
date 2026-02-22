/**
 * social.js
 * =========
 * Soziales System: Rangliste, Freunde, User-zu-User Chat
 */

import {
  getLeaderboard, getAllUsers, getCurrentUser as getUser,
  sendFriendRequest, acceptFriendRequest, getFriendRequests,
  getUserFriends, getUserProfile, sendChatMessage,
  listenChatMessages, stopListenChatMessages,
} from './firebase-config.js';
import { playChatMessage } from './audio.js';

// ─── XSS-Schutz ─────────────────────────────────────────────────────────────
function sanitize(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function showToast(msg, color = 'cyan') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const cls = {
    cyan:   'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
    green:  'border-green-500/40 text-green-300 bg-green-500/10',
    red:    'border-red-500/40 text-red-300 bg-red-500/10',
  };
  const el  = document.createElement('div');
  el.className  = `glass-panel border ${cls[color] || cls.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Rangliste (mit Cache) ───────────────────────────────────────────────────
const _cache = { board: null, ts: 0 };
const CACHE_TTL = 60_000;

export async function renderLeaderboard() {
  const container = document.getElementById('leaderboardContent');
  if (!container) return;
  container.innerHTML = loadingHtml();

  try {
    const now = Date.now();
    let board;
    if (_cache.board && (now - _cache.ts) < CACHE_TTL) {
      board = _cache.board;
    } else {
      board       = await getLeaderboard();
      _cache.board = board;
      _cache.ts    = now;
    }

    const entries = Object.entries(board || {})
      .map(([uid, d]) => ({ uid, ...d }))
      .filter(e => e.username)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .slice(0, 50);

    if (entries.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-center py-8">Noch keine Ranglisten-Einträge.</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const currentUid = getUser()?.uid;

    container.innerHTML = `
      <div class="space-y-2">
        ${entries.map((e, i) => `
          <div class="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border
            ${e.uid === currentUid ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5'} hover:border-white/15 transition-colors">
            <div class="w-8 text-center font-orbitron font-black flex-shrink-0 ${i < 3 ? 'text-xl' : 'text-slate-500 text-sm'}">
              ${i < 3 ? medals[i] : `#${i + 1}`}
            </div>
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              ${sanitize(e.username?.charAt(0)?.toUpperCase() || '?')}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-slate-200 font-semibold truncate flex items-center gap-1">
                ${sanitize(e.username)}
                ${e.uid === currentUid ? '<span class="text-xs text-cyan-400">(du)</span>' : ''}
              </div>
              <div class="text-xs text-slate-500">Level ${e.maxLevel || 1} · ${e.gamesPlayed || 0} Spiele</div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="font-orbitron font-black text-cyan-400">${(e.totalScore || 0).toLocaleString('de-DE')}</div>
              <div class="text-xs text-slate-500">🔥 ${e.maxStreak || 0}</div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = errorHtml(err.message);
    console.error('renderLeaderboard Fehler:', err);
  }
}

// ─── Freunde-Panel ───────────────────────────────────────────────────────────
export async function renderFriendsPanel() {
  const container = document.getElementById('friendsContent');
  if (!container) return;
  container.innerHTML = loadingHtml();

  try {
    const user = getUser?.() || null;
    if (!user || user.uid === '__admin__') {
      container.innerHTML = '<p class="text-slate-500 text-center py-8">Freundes-System erfordert einen Login.</p>';
      return;
    }

    const [allUsers, friends, requests] = await Promise.all([
      getAllUsers(),
      getUserFriends(user.uid),
      getFriendRequests(user.uid),
    ]);

    const friendUids    = Object.keys(friends || {});
    const requestUids   = Object.keys(requests || {});
    const pendingUsers  = requestUids.map(uid => ({ uid, ...allUsers[uid] })).filter(u => u.profile);
    const friendList    = friendUids.map(uid => ({ uid, ...allUsers[uid] })).filter(u => u.profile);
    const otherUsers    = Object.entries(allUsers)
      .filter(([uid]) => uid !== user.uid && !friendUids.includes(uid) && !requestUids.includes(uid))
      .map(([uid, u]) => ({ uid, ...u }))
      .filter(u => u.profile?.username)
      .slice(0, 20);

    container.innerHTML = `
      <div class="space-y-5">
        ${pendingUsers.length > 0 ? `
          <div>
            <h3 class="font-orbitron text-sm text-yellow-400 mb-2 flex items-center gap-2">
              <i class="fas fa-user-clock"></i> Anfragen (${pendingUsers.length})
            </h3>
            <div class="space-y-2">
              ${pendingUsers.map(u => `
                <div class="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border border-yellow-500/20">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-sm font-bold text-white">
                    ${sanitize(u.profile?.username?.charAt(0)?.toUpperCase() || '?')}
                  </div>
                  <div class="flex-1 text-slate-200 font-semibold">${sanitize(u.profile?.username || '—')}</div>
                  <div class="flex gap-2">
                    <button onclick="window.acceptFriend('${sanitize(u.uid)}')"
                      class="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 font-orbitron">
                      <i class="fas fa-check mr-1"></i>Annehmen
                    </button>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        ` : ''}

        ${friendList.length > 0 ? `
          <div>
            <h3 class="font-orbitron text-sm text-cyan-400 mb-2 flex items-center gap-2">
              <i class="fas fa-user-friends"></i> Meine Freunde (${friendList.length})
            </h3>
            <div class="space-y-2">
              ${friendList.map(u => `
                <div class="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border border-white/5">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                    ${sanitize(u.profile?.username?.charAt(0)?.toUpperCase() || '?')}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-slate-200 font-semibold">${sanitize(u.profile?.username || '—')}</div>
                    <div class="text-xs text-slate-500">Level ${u.gameStats?.maxLevel || 1}</div>
                  </div>
                  <div class="font-orbitron text-sm text-cyan-400 mr-2">${(u.gameStats?.totalScore || 0).toLocaleString('de-DE')} Pkt.</div>
                  <button onclick="window.openChatWith('${sanitize(u.uid)}', '${sanitize(u.profile?.username || '—')}')"
                    class="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 font-orbitron">
                    <i class="fas fa-comment mr-1"></i>Chat
                  </button>
                </div>`).join('')}
            </div>
          </div>
        ` : ''}

        <div>
          <h3 class="font-orbitron text-sm text-slate-400 mb-2 flex items-center gap-2">
            <i class="fas fa-users"></i> Weitere Spieler
          </h3>
          ${otherUsers.length === 0 ? '<p class="text-slate-500 text-sm text-center py-4">Keine weiteren Spieler gefunden.</p>' : `
            <div class="space-y-2">
              ${otherUsers.map(u => `
                <div class="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border border-white/5">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold text-white">
                    ${sanitize(u.profile?.username?.charAt(0)?.toUpperCase() || '?')}
                  </div>
                  <div class="flex-1 text-slate-200 font-semibold">${sanitize(u.profile?.username || '—')}</div>
                  <div class="font-orbitron text-sm text-slate-400 mr-2">${(u.gameStats?.totalScore || 0).toLocaleString('de-DE')} Pkt.</div>
                  <button onclick="window.addFriend('${sanitize(u.uid)}')"
                    class="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 font-orbitron">
                    <i class="fas fa-user-plus mr-1"></i>Hinzufügen
                  </button>
                </div>`).join('')}
            </div>
          `}
        </div>
      </div>`;
  } catch (err) {
    container.innerHTML = errorHtml(err.message);
    console.error('renderFriendsPanel Fehler:', err);
  }
}

// ─── Freund hinzufügen / annehmen ────────────────────────────────────────────
window.addFriend = async function(targetUid) {
  const user = getUser?.();
  if (!user) return;
  try {
    await sendFriendRequest(user.uid, targetUid);
    showToast('Freundschaftsanfrage gesendet!', 'green');
    renderFriendsPanel();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'red');
  }
};

window.acceptFriend = async function(requestorUid) {
  const user = getUser?.();
  if (!user) return;
  try {
    await acceptFriendRequest(user.uid, requestorUid);
    showToast('Freundschaft bestätigt!', 'green');
    renderFriendsPanel();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'red');
  }
};

// ─── Chat öffnen ─────────────────────────────────────────────────────────────
let _activeChatUid  = null;
let _activeChatStop = null;

window.openChatWith = function(targetUid, targetName) {
  const user = getUser?.();
  if (!user) return;

  _activeChatUid = targetUid;
  if (_activeChatStop) _activeChatStop();

  const modal = document.getElementById('chatModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  document.getElementById('chatPartnerName').textContent = targetName;
  document.getElementById('chatMessages').innerHTML = loadingHtml();

  _activeChatStop = listenChatMessages(user.uid, targetUid, (messages) => {
    renderChatMessages(messages, user.uid);
  });
};

window.closeChatModal = function() {
  if (_activeChatStop) { _activeChatStop(); _activeChatStop = null; }
  const modal = document.getElementById('chatModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  _activeChatUid = null;
};

window.sendChatMsg = async function() {
  const user = getUser?.();
  const input = document.getElementById('chatInput');
  const text  = input?.value?.trim();
  if (!text || !user || !_activeChatUid) return;
  input.value = '';
  try {
    await sendChatMessage(user.uid, _activeChatUid, text);
  } catch (err) {
    showToast('Nachricht fehlgeschlagen: ' + err.message, 'red');
  }
};

function renderChatMessages(messages, myUid) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  if (!messages || Object.keys(messages).length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-6 text-sm">Noch keine Nachrichten. Schreib etwas!</p>';
    return;
  }

  const msgs = Object.entries(messages)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0));

  const lastMsg = msgs[msgs.length - 1];
  const isNew   = lastMsg && lastMsg.from !== myUid;

  container.innerHTML = msgs.map(msg => {
    const isMine = msg.from === myUid;
    const time   = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
    return `
      <div class="flex ${isMine ? 'justify-end' : 'justify-start'} mb-2">
        <div class="max-w-[75%]">
          <div class="px-4 py-2.5 rounded-2xl ${isMine
            ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 rounded-br-none'
            : 'bg-white/8 border border-white/10 text-slate-200 rounded-bl-none'}">
            <p class="text-sm leading-relaxed">${sanitize(msg.text || '')}</p>
          </div>
          <div class="text-xs text-slate-600 mt-1 ${isMine ? 'text-right' : 'text-left'}">${time}</div>
        </div>
      </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
  if (isNew) playChatMessage().catch(() => {});
}

// ─── Chat: Enter-Taste ───────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && document.getElementById('chatInput') === document.activeElement) {
    e.preventDefault();
    window.sendChatMsg();
  }
});

// ─── Benachrichtigungen ──────────────────────────────────────────────────────
export function startNotificationListener() {
  // Wird in app.js nach Login gestartet
}

export function renderNotifications(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = `
    <div class="p-3 text-center">
      <div class="font-orbitron text-xs text-slate-400 uppercase mb-2">Benachrichtigungen</div>
      <p class="text-slate-500 text-xs">Noch keine Benachrichtigungen.</p>
    </div>`;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function loadingHtml() {
  return `<div class="flex items-center justify-center py-10 gap-3">
    <div class="w-6 h-6 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
    <span class="text-slate-400 text-sm">Wird geladen…</span>
  </div>`;
}

function errorHtml(msg) {
  return `<div class="text-red-400 p-4 text-sm text-center">${sanitize(msg)}</div>`;
}
