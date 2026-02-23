/**
 * admin.js
 * ========
 * Admin Panel — Guthaben-Schulden-Spiel Pro Edition
 * FIXES:
 *   HATA 17: try-catch — Firebase crash koruması
 *   HATA 18: body scroll kilidi — openAdminPanel/closeAdminPanel
 *   HATA 19: admin-pane ID eşleşmesi — getElementById kullanımı
 */

import { getAllUsers, getSystemStats, sendMessageToUser, getUserProfile, updateUserProfile, deleteUser } from './firebase-config.js';

// ─── Panel Open/Close ─────────────────────────────────────────
/**
 * FIX HATA 18: body scroll kilidi eklendi.
 */
export function openAdminPanel() {
  const overlay = document.getElementById('adminOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  // FIX HATA 18
  document.body.style.overflow = 'hidden';
  loadAdminTab('stats');
}

/**
 * FIX HATA 18: body scroll kilidi kaldırıldı.
 */
export function closeAdminPanel() {
  const overlay = document.getElementById('adminOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  // FIX HATA 18
  document.body.style.overflow = '';
}

// ─── Tab Loading ──────────────────────────────────────────────
/**
 * FIX HATA 19: getElementById kullanımı — data-pane yerine id ile eşleşme.
 */
export function loadAdminTab(tab) {
  // Update tab button styles
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active-admin-tab', btn.dataset.tab === tab);
  });

  // FIX HATA 19 — ID ile pane seçimi
  ['stats', 'users', 'messages', 'devices', 'logs'].forEach(name => {
    const el = document.getElementById(`admin-pane-${name}`);
    if (el) el.classList.toggle('hidden', name !== tab);
  });

  // Load tab content
  switch (tab) {
    case 'stats':    renderAdminStats();    break;
    case 'users':    renderUsersList();     break;
    case 'messages': renderAdminMessages(); break;
    case 'devices':  renderDevices();       break;
    case 'logs':     renderAdminLogs();     break;
  }
}

// ─── Sanitize helper ─────────────────────────────────────────
function sanitize(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── Admin Stats ──────────────────────────────────────────────
/**
 * FIX HATA 17: try-catch — Firebase crash koruması.
 */
async function renderAdminStats() {
  const pane = document.getElementById('admin-pane-stats');
  if (!pane) return;
  pane.innerHTML = `<div class="flex items-center justify-center py-12">
    <div class="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
    <span class="ml-3 text-slate-400 font-orbitron text-sm">Yükleniyor...</span>
  </div>`;

  try {
    const [stats, users] = await Promise.all([
      getSystemStats().catch(() => ({})),
      getAllUsers().catch(() => ({})),
    ]);

    const userCount  = Object.keys(users || {}).length;
    const totalScore = Object.values(users || {}).reduce((sum, u) => sum + (u.gameStats?.totalScore || 0), 0);
    const totalGames = Object.values(users || {}).reduce((sum, u) => sum + (u.gameStats?.totalGamesPlayed || 0), 0);
    const avgScore   = userCount > 0 ? Math.round(totalScore / userCount) : 0;

    pane.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${adminStat('👥 Kullanıcılar', userCount, 'cyan')}
        ${adminStat('🎮 Toplam Oyun', totalGames, 'purple')}
        ${adminStat('🏆 Toplam Puan', totalScore.toLocaleString(), 'yellow')}
        ${adminStat('📊 Ort. Puan', avgScore, 'green')}
      </div>
      <div class="text-xs text-slate-500 text-center mt-4">
        Son güncelleme: ${new Date().toLocaleString('tr-TR')}
      </div>`;
  } catch (err) {
    pane.innerHTML = `<div class="text-red-400 p-4 text-sm font-orbitron">
      <i class="fas fa-exclamation-triangle mr-2"></i>Hata: ${sanitize(err.message)}
    </div>`;
    console.error('renderAdminStats error:', err);
  }
}

/**
 * FIX HATA 17: try-catch.
 */
async function renderUsersList() {
  const pane = document.getElementById('admin-pane-users');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users = await getAllUsers();
    const usersArr = Object.entries(users || {}).sort((a, b) =>
      (b[1].gameStats?.totalScore || 0) - (a[1].gameStats?.totalScore || 0)
    );

    if (usersArr.length === 0) {
      pane.innerHTML = '<p class="text-slate-500 text-center py-8">Henüz kullanıcı yok.</p>';
      return;
    }

    pane.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs font-orbitron text-slate-500 uppercase tracking-widest border-b border-white/5">
              <th class="pb-3 pr-4">#</th>
              <th class="pb-3 pr-4">Kullanıcı</th>
              <th class="pb-3 pr-4">Puan</th>
              <th class="pb-3 pr-4">Seviye</th>
              <th class="pb-3 pr-4">Streak</th>
              <th class="pb-3">İşlem</th>
            </tr>
          </thead>
          <tbody id="usersTableBody"></tbody>
        </table>
      </div>`;

    const tbody = document.getElementById('usersTableBody');
    usersArr.forEach(([uid, user], i) => {
      const gs  = user.gameStats || {};
      const pro = user.profile   || {};
      const tr  = document.createElement('tr');
      tr.className = 'border-b border-white/5 hover:bg-white/3 transition-colors';
      tr.innerHTML = `
        <td class="py-3 pr-4 text-slate-500">${i + 1}</td>
        <td class="py-3 pr-4">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              ${sanitize(pro.username?.charAt(0)?.toUpperCase() || '?')}
            </div>
            <div>
              <div class="text-slate-200 font-semibold">${sanitize(pro.username || 'Bilinmeyen')}</div>
              ${pro.isAdmin ? '<span class="text-xs text-yellow-400">Admin</span>' : ''}
            </div>
          </div>
        </td>
        <td class="py-3 pr-4 font-orbitron text-cyan-400">${(gs.totalScore || 0).toLocaleString()}</td>
        <td class="py-3 pr-4 text-yellow-400">${gs.maxLevel || 1}</td>
        <td class="py-3 pr-4 text-orange-400">${gs.maxStreak || 0}</td>
        <td class="py-3">
          <button class="admin-btn-sm border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            onclick="window.adminEditUser('${sanitize(uid)}')" title="Düzenle">
            <i class="fas fa-edit"></i>
          </button>
          <button class="admin-btn-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10 ml-1"
            onclick="window.adminMessageUser('${sanitize(uid)}', '${sanitize(pro.username)}')" title="Mesaj Gönder">
            <i class="fas fa-envelope"></i>
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderUsersList error:', err);
  }
}

/**
 * FIX HATA 17: try-catch.
 */
async function renderAdminMessages() {
  const pane = document.getElementById('admin-pane-messages');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users = await getAllUsers();
    const usersArr = Object.entries(users || {});

    pane.innerHTML = `
      <div class="space-y-4">
        <div class="glass-panel rounded-xl p-4 border border-white/10">
          <h3 class="font-orbitron text-sm text-slate-300 mb-3"><i class="fas fa-broadcast-tower mr-2 text-cyan-400"></i>Toplu Mesaj Gönder</h3>
          <div class="space-y-3">
            <input id="msgSubject" type="text" placeholder="Konu" class="game-input w-full px-3 py-2 rounded-xl text-sm" />
            <textarea id="msgBody" rows="3" placeholder="Mesaj içeriği..." class="game-input w-full px-3 py-2 rounded-xl text-sm resize-none"></textarea>
            <div class="flex gap-3">
              <select id="msgTarget" class="game-input flex-1 px-3 py-2 rounded-xl text-sm">
                <option value="all">Tüm Kullanıcılar (${usersArr.length})</option>
              </select>
              <button onclick="window.adminSendBroadcast()" class="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-orbitron hover:bg-cyan-500/30">
                <i class="fas fa-paper-plane mr-1"></i>Gönder
              </button>
            </div>
          </div>
        </div>
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderAdminMessages error:', err);
  }
}

/**
 * FIX HATA 17: try-catch.
 */
async function renderDevices() {
  const pane = document.getElementById('admin-pane-devices');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users = await getAllUsers();
    const devices = [];
    for (const [uid, user] of Object.entries(users || {})) {
      if (user.devices) {
        for (const [did, dev] of Object.entries(user.devices)) {
          devices.push({ uid, username: user.profile?.username, ...dev, did });
        }
      }
    }

    if (devices.length === 0) {
      pane.innerHTML = '<p class="text-slate-500 text-center py-8">Kayıtlı cihaz bulunamadı.</p>';
      return;
    }

    pane.innerHTML = `
      <div class="space-y-3">
        ${devices.map(d => `
          <div class="admin-card rounded-xl p-4 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <i class="fas fa-laptop text-slate-400 text-sm"></i>
              </div>
              <div>
                <div class="text-sm text-slate-200">${sanitize(d.username || 'Bilinmeyen')}</div>
                <div class="text-xs text-slate-500">${sanitize(d.userAgent?.slice(0, 60) || 'N/A')}</div>
              </div>
            </div>
            <div class="text-xs text-slate-500">${d.lastSeen ? new Date(d.lastSeen).toLocaleString('tr-TR') : 'N/A'}</div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderDevices error:', err);
  }
}

/**
 * FIX HATA 17: try-catch.
 */
async function renderAdminLogs() {
  const pane = document.getElementById('admin-pane-logs');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    // Logs are stored locally or in Firebase depending on implementation
    const users    = await getAllUsers();
    const sessions = [];
    for (const [uid, user] of Object.entries(users || {})) {
      if (user.sessions) {
        for (const [sid, s] of Object.entries(user.sessions)) {
          sessions.push({ uid, username: user.profile?.username, ...s });
        }
      }
    }
    sessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    if (sessions.length === 0) {
      pane.innerHTML = '<p class="text-slate-500 text-center py-8">Kayıtlı oturum bulunamadı.</p>';
      return;
    }

    pane.innerHTML = `
      <div class="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
        ${sessions.slice(0, 50).map(s => `
          <div class="admin-card rounded-xl px-4 py-3 flex items-center justify-between text-sm">
            <div>
              <span class="font-semibold text-slate-300">${sanitize(s.username || 'Bilinmeyen')}</span>
              <span class="ml-2 text-slate-500">${s.startTime ? new Date(s.startTime).toLocaleString('tr-TR') : ''}</span>
            </div>
            <div class="flex gap-4 text-xs font-orbitron">
              <span class="text-cyan-400">${s.score || 0}p</span>
              <span class="text-green-400">${s.correctAnswers || 0}/${s.questionsAnswered || 0}</span>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderAdminLogs error:', err);
  }
}

// ─── Admin Actions ────────────────────────────────────────────
window.adminEditUser = async function(uid) {
  const subModal  = document.getElementById('adminSubModal');
  const subContent = document.getElementById('adminSubContent');
  if (!subModal || !subContent) return;

  subContent.innerHTML = loadingHtml();
  subModal.classList.remove('hidden');
  subModal.classList.add('flex');

  try {
    const user = await getUserProfile(uid);
    const gs   = user?.gameStats || {};
    subContent.innerHTML = `
      <h2 class="font-orbitron text-lg text-yellow-400 mb-4">
        <i class="fas fa-user-edit mr-2"></i>Kullanıcı Düzenle: ${sanitize(user?.profile?.username || uid)}
      </h2>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          ${adminStat('Puan', gs.totalScore || 0, 'cyan')}
          ${adminStat('Level', gs.maxLevel || 1, 'yellow')}
          ${adminStat('Streak', gs.maxStreak || 0, 'orange')}
          ${adminStat('Oyun', gs.totalGamesPlayed || 0, 'purple')}
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Biyografi</label>
          <textarea id="editBio" class="game-input w-full px-3 py-2 rounded-xl text-sm resize-none" rows="2">${sanitize(user?.profile?.bio || '')}</textarea>
        </div>
        <div class="flex gap-3">
          <button onclick="window.adminSaveUser('${sanitize(uid)}')" class="flex-1 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-orbitron hover:bg-cyan-500/30">
            <i class="fas fa-save mr-1"></i>Kaydet
          </button>
          <button onclick="document.getElementById('adminSubModal').classList.add('hidden'); document.getElementById('adminSubModal').classList.remove('flex');"
            class="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm hover:bg-white/10">
            Vazgeç
          </button>
        </div>
      </div>`;
  } catch (err) {
    subContent.innerHTML = errorHtml(err.message);
  }
};

window.adminSaveUser = async function(uid) {
  const bio = document.getElementById('editBio')?.value?.trim();
  try {
    await updateUserProfile(uid, { bio });
    document.getElementById('adminSubModal')?.classList.add('hidden');
    document.getElementById('adminSubModal')?.classList.remove('flex');
  } catch (err) {
    alert('Kaydetme hatası: ' + err.message);
  }
};

window.adminMessageUser = function(uid, username) {
  const subject = prompt(`"${username}" kullanıcısına mesaj konusu:`);
  if (!subject) return;
  const body = prompt('Mesaj içeriği:');
  if (!body) return;
  // Message sending implementation via firebase-config
  import('./firebase-config.js').then(({ sendMessageToUser }) => {
    sendMessageToUser(uid, { subject, body }).then(() => {
      alert('Mesaj gönderildi ✓');
    }).catch(err => alert('Hata: ' + err.message));
  });
};

window.adminSendBroadcast = async function() {
  const subject = document.getElementById('msgSubject')?.value?.trim();
  const body    = document.getElementById('msgBody')?.value?.trim();
  if (!subject || !body) { alert('Konu ve içerik zorunlu.'); return; }

  try {
    const users = await getAllUsers();
    const { sendMessageToUser } = await import('./firebase-config.js');
    const sends = Object.keys(users).map(uid => sendMessageToUser(uid, { subject, body }).catch(() => {}));
    await Promise.allSettled(sends);
    alert(`${Object.keys(users).length} kullanıcıya mesaj gönderildi ✓`);
    document.getElementById('msgSubject').value = '';
    document.getElementById('msgBody').value    = '';
  } catch (err) {
    alert('Toplu gönderim hatası: ' + err.message);
  }
};

// ─── Helpers ─────────────────────────────────────────────────
function loadingHtml() {
  return `<div class="flex items-center justify-center py-12">
    <div class="w-8 h-8 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
    <span class="ml-3 text-slate-400 font-orbitron text-sm">Yükleniyor...</span>
  </div>`;
}

function errorHtml(msg) {
  return `<div class="text-red-400 p-4 text-sm font-orbitron border border-red-500/20 rounded-xl bg-red-500/5">
    <i class="fas fa-exclamation-triangle mr-2"></i>Hata: ${sanitize(msg)}
  </div>`;
}

function adminStat(label, value, color) {
  const colors = { cyan: 'text-cyan-400', yellow: 'text-yellow-400', orange: 'text-orange-400', purple: 'text-purple-400', green: 'text-green-400' };
  return `<div class="admin-card rounded-xl p-3 text-center">
    <div class="font-orbitron text-lg font-black ${colors[color] || 'text-slate-300'} mb-1">${sanitize(String(value))}</div>
    <div class="text-xs text-slate-500">${label}</div>
  </div>`;
}
