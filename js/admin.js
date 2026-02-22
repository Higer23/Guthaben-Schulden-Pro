/**
 * admin.js
 * ========
 * Admin Panel: Full Management Interface
 * Guthaben-Schulden-Spiel Pro Edition
 */

import {
  getAllUsers, deleteUser, updateUserProfile, updateUserGameStats,
  getUserDevices, banDevice, getSystemStats, logAdminAction,
  sendMessage, getSentMessages, getInbox, getAdminLogs,
  getUserProfile, getUserAchievements,
} from './firebase-config.js';
import { getCurrentUser } from './auth.js';

// ─── OPEN ADMIN PANEL ────────────────────────────────────────────────────────
export function openAdminPanel() {
  const overlay = document.getElementById('adminOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  loadAdminTab('stats');
}

export function closeAdminPanel() {
  const overlay = document.getElementById('adminOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

// ─── TAB SWITCHER ────────────────────────────────────────────────────────────
export function loadAdminTab(tab) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.toggle('active-admin-tab', b.dataset.tab === tab);
  });
  document.querySelectorAll('.admin-tab-pane').forEach(p => {
    p.classList.toggle('hidden', p.dataset.pane !== tab);
  });

  switch (tab) {
    case 'stats':    renderAdminStats();   break;
    case 'users':    renderUsersList();    break;
    case 'messages': renderAdminMessages(); break;
    case 'devices':  renderDevices();      break;
    case 'logs':     renderAdminLogs();    break;
  }
}

// ─── STATS TAB ───────────────────────────────────────────────────────────────
async function renderAdminStats() {
  const pane = document.getElementById('admin-pane-stats');
  pane.innerHTML = `<div class="flex items-center justify-center h-40 text-slate-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Yükleniyor...</div>`;

  const [stats, users] = await Promise.all([getSystemStats(), getAllUsers()]);

  const usersArr = Object.entries(users).map(([uid, u]) => ({ uid, ...u }));
  const sorted   = usersArr.filter(u => u.profile).sort((a, b) =>
    (b.game?.stats?.totalScore || 0) - (a.game?.stats?.totalScore || 0));

  const recent = usersArr.filter(u => u.profile)
    .sort((a, b) => (b.profile?.lastLogin || 0) - (a.profile?.lastLogin || 0))
    .slice(0, 10);

  const topBrowser = Object.entries(stats.browserMap).sort((a, b) => b[1] - a[1])[0];
  const topOS      = Object.entries(stats.osMap).sort((a, b) => b[1] - a[1])[0];

  pane.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${statCard('👥 Toplam Kullanıcı', stats.totalUsers, 'cyan')}
      ${statCard('✅ Aktif (24s)', stats.activeToday, 'green')}
      ${statCard('🌐 En Çok Browser', topBrowser ? `${topBrowser[0]} (${topBrowser[1]})` : '—', 'purple')}
      ${statCard('💻 En Çok OS', topOS ? `${topOS[0]} (${topOS[1]})` : '—', 'yellow')}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="admin-card p-5 rounded-xl">
        <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">🏆 En Çok Oynayan</h3>
        <div class="space-y-2">
          ${sorted.slice(0, 10).map((u, i) => `
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-400">${i + 1}.</span>
              <span class="flex-1 ml-2 text-slate-200 font-semibold">${u.profile.username}</span>
              <span class="text-cyan-400 font-orbitron">${(u.game?.stats?.totalScore || 0).toLocaleString()}</span>
            </div>`).join('') || '<p class="text-slate-500 text-sm">Henüz yok</p>'}
        </div>
      </div>
      <div class="admin-card p-5 rounded-xl">
        <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">🕐 En Son Giriş</h3>
        <div class="space-y-2">
          ${recent.map(u => `
            <div class="flex items-center justify-between text-sm">
              <span class="flex-1 text-slate-200">${u.profile.username}</span>
              <span class="text-slate-400">${fmtTime(u.profile.lastLogin)}</span>
            </div>`).join('') || '<p class="text-slate-500 text-sm">Henüz yok</p>'}
        </div>
      </div>
    </div>

    <div class="mt-6 admin-card p-5 rounded-xl">
      <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">📊 Cihaz İstatistikleri</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-slate-500 mb-2">Browser Dağılımı</p>
          ${Object.entries(stats.browserMap).sort((a,b)=>b[1]-a[1]).map(([k,v]) =>
            `<div class="flex justify-between text-sm mb-1"><span class="text-slate-300">${k}</span><span class="text-cyan-400">${v}</span></div>`
          ).join('') || '<p class="text-slate-500 text-sm">Veri yok</p>'}
        </div>
        <div>
          <p class="text-xs text-slate-500 mb-2">İşletim Sistemi Dağılımı</p>
          ${Object.entries(stats.osMap).sort((a,b)=>b[1]-a[1]).map(([k,v]) =>
            `<div class="flex justify-between text-sm mb-1"><span class="text-slate-300">${k}</span><span class="text-purple-400">${v}</span></div>`
          ).join('') || '<p class="text-slate-500 text-sm">Veri yok</p>'}
        </div>
      </div>
    </div>`;
}

function statCard(label, value, color) {
  const c = { cyan: 'text-cyan-400 border-cyan-500/20', green: 'text-green-400 border-green-500/20',
               purple: 'text-purple-400 border-purple-500/20', yellow: 'text-yellow-400 border-yellow-500/20' }[color] || 'text-slate-200';
  return `<div class="admin-card border ${c.split(' ')[1] || ''} rounded-xl p-4 text-center">
    <div class="font-orbitron text-2xl font-black ${c.split(' ')[0]} mb-1">${value}</div>
    <div class="text-xs text-slate-400 uppercase tracking-wide">${label}</div>
  </div>`;
}

// ─── USERS LIST TAB ───────────────────────────────────────────────────────────
async function renderUsersList() {
  const pane = document.getElementById('admin-pane-users');
  pane.innerHTML = `<div class="flex items-center justify-center h-40 text-slate-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Kullanıcılar yükleniyor...</div>`;

  const users = await getAllUsers();

  const rows = await Promise.all(Object.entries(users).map(async ([uid, u]) => {
    if (!u.profile) return '';
    const devCount = Object.keys(u.devices || {}).length;
    return `
      <tr class="border-b border-white/5 hover:bg-white/3 transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              ${u.profile.username?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div class="font-semibold text-slate-200 text-sm">${u.profile.username}</div>
              <div class="text-xs text-slate-500">${u.profile.email || '—'}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-xs text-slate-400">${fmtDate(u.profile.createdAt)}</td>
        <td class="px-4 py-3 text-xs text-slate-400">${fmtTime(u.profile.lastLogin)}</td>
        <td class="px-4 py-3 text-center font-orbitron text-sm text-cyan-400">${u.game?.stats?.currentLevel || 1}</td>
        <td class="px-4 py-3 text-center font-orbitron text-sm text-yellow-400">${(u.game?.stats?.totalScore || 0).toLocaleString()}</td>
        <td class="px-4 py-3 text-center text-slate-400 text-sm">${devCount}</td>
        <td class="px-4 py-3">
          <div class="flex gap-2 justify-end">
            <button onclick="window.adminEditUser('${uid}')" class="admin-btn-sm text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="window.adminMsgUser('${uid}','${u.profile.username}')" class="admin-btn-sm text-green-400 border-green-500/30 hover:bg-green-500/10">
              <i class="fas fa-envelope"></i>
            </button>
            <button onclick="window.adminDeleteUser('${uid}','${u.profile.username}')" class="admin-btn-sm text-red-400 border-red-500/30 hover:bg-red-500/10">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }));

  pane.innerHTML = `
    <div class="flex items-center gap-4 mb-4">
      <input id="userSearchInput" type="text" placeholder="Kullanıcı ara..." 
        class="game-input flex-1 px-4 py-2 rounded-xl text-sm" oninput="window.filterUserTable(this.value)" />
      <span class="text-slate-400 text-sm">${Object.keys(users).length} kullanıcı</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm" id="usersTable">
        <thead>
          <tr class="border-b border-white/10">
            <th class="px-4 py-3 text-left text-slate-400 text-xs uppercase tracking-wider">Kullanıcı</th>
            <th class="px-4 py-3 text-left text-slate-400 text-xs uppercase tracking-wider">Kayıt</th>
            <th class="px-4 py-3 text-left text-slate-400 text-xs uppercase tracking-wider">Son Giriş</th>
            <th class="px-4 py-3 text-center text-slate-400 text-xs uppercase tracking-wider">Seviye</th>
            <th class="px-4 py-3 text-center text-slate-400 text-xs uppercase tracking-wider">Puan</th>
            <th class="px-4 py-3 text-center text-slate-400 text-xs uppercase tracking-wider">Cihaz</th>
            <th class="px-4 py-3 text-right text-slate-400 text-xs uppercase tracking-wider">İşlemler</th>
          </tr>
        </thead>
        <tbody id="usersTableBody">
          ${rows.join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── EDIT USER MODAL ─────────────────────────────────────────────────────────
window.adminEditUser = async function(uid) {
  const users = await getAllUsers();
  const user  = users[uid];
  if (!user) return;
  const p = user.profile;
  const g = user.game?.stats || {};
  const devices = await getUserDevices(uid);

  const modal = document.getElementById('adminSubModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  modal.querySelector('#adminSubContent').innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h3 class="font-orbitron text-xl text-cyan-400">Kullanıcı Düzenle: ${p.username}</h3>
      <button onclick="document.getElementById('adminSubModal').classList.add('hidden')" class="text-slate-400 hover:text-white text-2xl">×</button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Profil Bilgileri</h4>
        <label class="block text-xs text-slate-400">Kullanıcı Adı</label>
        <input id="edit_username" value="${p.username}" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
        <label class="block text-xs text-slate-400">E-posta</label>
        <input id="edit_email" value="${p.email || ''}" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
        <label class="block text-xs text-slate-400">Yeni Şifre (boş bırak = değiştirme)</label>
        <input id="edit_password" type="password" placeholder="••••••" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
        <label class="block text-xs text-slate-400">Durum</label>
        <select id="edit_status" class="game-input w-full px-3 py-2 rounded-lg text-sm">
          <option value="active" ${p.status === 'active' ? 'selected' : ''}>Aktif</option>
          <option value="banned" ${p.status === 'banned' ? 'selected' : ''}>Yasaklı</option>
        </select>
      </div>
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Oyun İstatistikleri</h4>
        <label class="block text-xs text-slate-400">Toplam Puan</label>
        <input id="edit_score" type="number" value="${g.totalScore || 0}" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
        <label class="block text-xs text-slate-400">Mevcut Seviye</label>
        <input id="edit_level" type="number" value="${g.currentLevel || 1}" min="1" max="20" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
        <label class="block text-xs text-slate-400">Maks Streak</label>
        <input id="edit_streak" type="number" value="${g.maxStreak || 0}" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
        <label class="block text-xs text-slate-400">Toplam Oyun</label>
        <input id="edit_games" type="number" value="${g.totalGamesPlayed || 0}" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
      </div>
    </div>

    <div class="mb-6">
      <h4 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Cihaz Geçmişi</h4>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead><tr class="border-b border-white/10">
            <th class="text-left text-slate-400 py-2 pr-4">Browser</th>
            <th class="text-left text-slate-400 py-2 pr-4">OS</th>
            <th class="text-left text-slate-400 py-2 pr-4">IP</th>
            <th class="text-left text-slate-400 py-2 pr-4">Son Giriş</th>
            <th class="text-left text-slate-400 py-2">İşlem</th>
          </tr></thead>
          <tbody>
            ${Object.entries(devices).map(([devKey, dev]) => `
              <tr class="border-b border-white/5">
                <td class="py-2 pr-4 text-slate-300">${dev.browser || '—'}</td>
                <td class="py-2 pr-4 text-slate-300">${dev.os || '—'}</td>
                <td class="py-2 pr-4 text-slate-400">${dev.ipAddress || '—'}</td>
                <td class="py-2 pr-4 text-slate-400">${fmtTime(dev.lastLogin)}</td>
                <td class="py-2">
                  <button onclick="window.adminBanDev('${uid}','${devKey}',${!dev.isBanned})"
                    class="text-xs px-2 py-1 rounded border ${dev.isBanned ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}">
                    ${dev.isBanned ? 'Yasağı Kaldır' : 'Yasakla'}
                  </button>
                </td>
              </tr>`).join('') || '<tr><td colspan="5" class="text-slate-500 py-2">Cihaz yok</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex gap-3 justify-end">
      <button onclick="window.adminSaveUser('${uid}')"
        class="px-6 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30">
        <i class="fas fa-save mr-2"></i>Kaydet
      </button>
      <button onclick="window.adminDeleteUser('${uid}','${p.username}')"
        class="px-6 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-semibold hover:bg-red-500/30">
        <i class="fas fa-trash mr-2"></i>Hesabı Sil
      </button>
    </div>`;
};

window.adminSaveUser = async function(uid) {
  const updates = {
    username: document.getElementById('edit_username').value,
    email:    document.getElementById('edit_email').value,
    status:   document.getElementById('edit_status').value,
  };
  const pw = document.getElementById('edit_password').value;
  if (pw) updates.password = pw;

  const gameStats = {
    totalScore:       parseInt(document.getElementById('edit_score').value) || 0,
    currentLevel:     parseInt(document.getElementById('edit_level').value) || 1,
    maxStreak:        parseInt(document.getElementById('edit_streak').value) || 0,
    totalGamesPlayed: parseInt(document.getElementById('edit_games').value) || 0,
  };

  await Promise.all([
    updateUserProfile(uid, updates),
    updateUserGameStats(uid, gameStats),
  ]);
  await logAdminAction('__admin__', 'edit_user', uid);

  document.getElementById('adminSubModal').classList.add('hidden');
  showAdminToast('Kullanıcı güncellendi ✓', 'green');
  renderUsersList();
};

window.adminBanDev = async function(uid, devKey, banned) {
  await banDevice(uid, devKey, banned);
  await adminEditUser(uid);
};

window.adminDeleteUser = async function(uid, username) {
  const confirmed = confirm(`"${username}" hesabını silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz!`);
  if (!confirmed) return;
  await deleteUser(uid);
  await logAdminAction('__admin__', 'delete_user', uid);
  document.getElementById('adminSubModal')?.classList.add('hidden');
  showAdminToast('Kullanıcı silindi.', 'red');
  renderUsersList();
};

// ─── MESSAGES TAB ─────────────────────────────────────────────────────────────
async function renderAdminMessages() {
  const pane = document.getElementById('admin-pane-messages');

  const users = await getAllUsers();
  const userOptions = Object.entries(users)
    .filter(([, u]) => u.profile)
    .map(([uid, u]) => `<option value="${uid}">${u.profile.username}</option>`)
    .join('');

  // Get all sent messages from admin perspective
  const sentMsgs = await getSentMessages('__admin__').catch(() => ({}));

  pane.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="admin-card p-5 rounded-xl">
        <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">✉️ Mesaj Gönder</h3>
        <div class="space-y-3">
          <select id="msgToUser" class="game-input w-full px-3 py-2 rounded-lg text-sm">
            <option value="">Kullanıcı seç...</option>
            ${userOptions}
          </select>
          <input id="msgSubject" placeholder="Konu" class="game-input w-full px-3 py-2 rounded-lg text-sm" />
          <textarea id="msgBody" rows="5" placeholder="Mesaj içeriği..." class="game-input w-full px-3 py-2 rounded-lg text-sm resize-none"></textarea>
          <button onclick="window.adminSendMsg()" class="w-full py-2 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 text-sm font-semibold hover:bg-green-500/30">
            <i class="fas fa-paper-plane mr-2"></i>Gönder
          </button>
        </div>
      </div>
      <div class="admin-card p-5 rounded-xl overflow-y-auto max-h-80">
        <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">📤 Gönderilen Mesajlar</h3>
        <div class="space-y-2" id="adminSentList">
          ${Object.entries(sentMsgs).reverse().map(([, m]) => `
            <div class="bg-white/5 rounded-lg p-3 text-xs border border-white/5">
              <div class="flex justify-between mb-1">
                <span class="text-green-400 font-semibold">→ ${m.toName || m.to}</span>
                <span class="text-slate-500">${fmtTime(m.sentAt)}</span>
              </div>
              <div class="text-slate-300 font-medium mb-1">${m.subject}</div>
              <div class="text-slate-400">${m.body?.substring(0, 100)}...</div>
              ${m.reply ? `<div class="mt-2 pl-2 border-l-2 border-cyan-500/40 text-cyan-300">💬 ${m.reply}</div>` : ''}
            </div>`).join('') || '<p class="text-slate-500 text-sm">Henüz mesaj gönderilmedi.</p>'}
        </div>
      </div>
    </div>`;
}

window.adminMsgUser = function(uid, username) {
  loadAdminTab('messages');
  setTimeout(() => {
    const sel = document.getElementById('msgToUser');
    if (sel) sel.value = uid;
  }, 500);
};

window.adminSendMsg = async function() {
  const toUid   = document.getElementById('msgToUser').value;
  const subject = document.getElementById('msgSubject').value.trim();
  const body    = document.getElementById('msgBody').value.trim();
  if (!toUid || !subject || !body) { showAdminToast('Tüm alanları doldurun.', 'red'); return; }

  const users    = await getAllUsers();
  const toName   = users[toUid]?.profile?.username || 'Kullanıcı';
  await sendMessage('__admin__', toUid, subject, body, 'Admin (Halil)', toName);
  await logAdminAction('__admin__', `send_message:${subject}`, toUid);

  document.getElementById('msgSubject').value = '';
  document.getElementById('msgBody').value    = '';
  showAdminToast('Mesaj gönderildi ✓', 'green');
  renderAdminMessages();
};

// ─── DEVICES TAB ─────────────────────────────────────────────────────────────
async function renderDevices() {
  const pane  = document.getElementById('admin-pane-devices');
  pane.innerHTML = `<div class="flex items-center justify-center h-40 text-slate-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Cihazlar yükleniyor...</div>`;

  const users = await getAllUsers();
  let rows = '';
  for (const [uid, u] of Object.entries(users)) {
    if (!u.profile) continue;
    const devs = u.devices || {};
    for (const [devKey, dev] of Object.entries(devs)) {
      rows += `
        <tr class="border-b border-white/5 hover:bg-white/3">
          <td class="px-3 py-3 text-sm text-slate-200">${u.profile.username}</td>
          <td class="px-3 py-3 text-xs text-slate-400 font-mono">${dev.deviceId || '—'}</td>
          <td class="px-3 py-3 text-xs text-slate-300">${dev.browser || '—'}</td>
          <td class="px-3 py-3 text-xs text-slate-300">${dev.os || '—'}</td>
          <td class="px-3 py-3 text-xs text-slate-400">${dev.ipAddress || '—'}</td>
          <td class="px-3 py-3 text-xs text-slate-400">${fmtTime(dev.lastLogin)}</td>
          <td class="px-3 py-3 text-center">${dev.loginCount || 1}</td>
          <td class="px-3 py-3 text-center">
            <span class="text-xs px-2 py-1 rounded-full ${dev.isBanned ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}">
              ${dev.isBanned ? 'Yasaklı' : 'Aktif'}
            </span>
          </td>
          <td class="px-3 py-3 text-center">
            <button onclick="window.adminBanDev('${uid}','${devKey}',${!dev.isBanned})"
              class="text-xs px-2 py-1 rounded border ${dev.isBanned ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'} hover:bg-white/5">
              ${dev.isBanned ? 'Kaldır' : 'Yasakla'}
            </button>
          </td>
        </tr>`;
    }
  }

  pane.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-white/10">
          <th class="px-3 py-3 text-left text-slate-400 text-xs uppercase">Kullanıcı</th>
          <th class="px-3 py-3 text-left text-slate-400 text-xs uppercase">Device ID</th>
          <th class="px-3 py-3 text-left text-slate-400 text-xs uppercase">Browser</th>
          <th class="px-3 py-3 text-left text-slate-400 text-xs uppercase">OS</th>
          <th class="px-3 py-3 text-left text-slate-400 text-xs uppercase">IP</th>
          <th class="px-3 py-3 text-left text-slate-400 text-xs uppercase">Son Giriş</th>
          <th class="px-3 py-3 text-center text-slate-400 text-xs uppercase">Giriş #</th>
          <th class="px-3 py-3 text-center text-slate-400 text-xs uppercase">Durum</th>
          <th class="px-3 py-3 text-center text-slate-400 text-xs uppercase">İşlem</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="9" class="text-slate-500 text-center py-8">Kayıtlı cihaz yok</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ─── LOGS TAB ─────────────────────────────────────────────────────────────────
async function renderAdminLogs() {
  const pane = document.getElementById('admin-pane-logs');
  const logs = await getAdminLogs();
  const actions = Object.entries(logs.all_actions || {})
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 50);

  pane.innerHTML = `
    <h3 class="font-orbitron text-sm text-slate-400 uppercase tracking-widest mb-4">📋 Son 50 Admin Eylemi</h3>
    <div class="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
      ${actions.map(([, a]) => `
        <div class="bg-white/3 rounded-lg px-4 py-3 text-xs flex justify-between items-center border border-white/5">
          <span class="text-purple-400 font-semibold">${a.admin}</span>
          <span class="text-slate-300 mx-3">${a.action}</span>
          ${a.target ? `<span class="text-cyan-400">${a.target}</span>` : ''}
          <span class="text-slate-500 ml-auto">${fmtTime(a.timestamp)}</span>
        </div>`).join('') || '<p class="text-slate-500">Log kaydı yok.</p>'}
    </div>`;
}

// ─── GLOBAL HELPERS ───────────────────────────────────────────────────────────
window.filterUserTable = function(q) {
  const rows = document.querySelectorAll('#usersTableBody tr');
  rows.forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
};

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function showAdminToast(msg, color = 'cyan') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  const colors = { cyan: 'border-cyan-500/40 text-cyan-300', green: 'border-green-500/40 text-green-300', red: 'border-red-500/40 text-red-300' };
  t.className = `glass-panel border ${colors[color] || colors.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
