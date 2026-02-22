/**
 * admin.js
 * ========
 * Admin-Panel — Guthaben-Schulden-Spiel Pro Edition
 * Funktionen: Benutzer verwalten, Nachrichten, Geräte, Logs, gleiche Passwörter erkennen
 */

import {
  getAllUsers, sendMessageToUser, getUserProfile,
  updateUserProfile, deleteUser, adminUpdateUserStats,
  adminBanUser, adminUnbanUser, getAllMessages,
} from './firebase-config.js';

// ─── Panel Öffnen/Schließen ──────────────────────────────────────────────────
export function openAdminPanel() {
  const overlay = document.getElementById('adminOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  document.body.style.overflow = 'hidden';
  loadAdminTab('stats');
}

export function closeAdminPanel() {
  const overlay = document.getElementById('adminOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  document.body.style.overflow = '';
}

// ─── Tab-Steuerung ───────────────────────────────────────────────────────────
export function loadAdminTab(tab) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active-admin-tab', btn.dataset.tab === tab);
  });

  ['stats', 'users', 'messages', 'allmsgs', 'devices', 'logs'].forEach(name => {
    const el = document.getElementById(`admin-pane-${name}`);
    if (el) el.classList.toggle('hidden', name !== tab);
  });

  switch (tab) {
    case 'stats':    renderAdminStats();    break;
    case 'users':    renderUsersList();     break;
    case 'messages': renderAdminMessages(); break;
    case 'allmsgs':  renderAllMessages();   break;
    case 'devices':  renderDevices();       break;
    case 'logs':     renderAdminLogs();     break;
  }
}

// ─── XSS-Schutz ─────────────────────────────────────────────────────────────
function sanitize(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── Admin-Statistiken ───────────────────────────────────────────────────────
async function renderAdminStats() {
  const pane = document.getElementById('admin-pane-stats');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users     = await getAllUsers();
    const usersArr  = Object.values(users || {});
    const userCount = usersArr.length;
    const totalScore = usersArr.reduce((s, u) => s + (u.gameStats?.totalScore || 0), 0);
    const totalGames = usersArr.reduce((s, u) => s + (u.gameStats?.totalGamesPlayed || 0), 0);
    const avgScore   = userCount > 0 ? Math.round(totalScore / userCount) : 0;
    const bannedCount = usersArr.filter(u => u.profile?.banned).length;
    const activeToday = usersArr.filter(u => {
      const last = u.profile?.lastLogin || 0;
      return Date.now() - last < 24 * 60 * 60 * 1000;
    }).length;

    // Gleiche Passwörter finden
    const pwMap = {};
    for (const [uid, user] of Object.entries(users || {})) {
      const pw = user.profile?.password;
      if (!pw) continue;
      if (!pwMap[pw]) pwMap[pw] = [];
      pwMap[pw].push({ uid, username: user.profile?.username });
    }
    const duplicatePwGroups = Object.entries(pwMap).filter(([, users]) => users.length > 1);

    pane.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        ${adminStat('👥 Benutzer', userCount, 'cyan')}
        ${adminStat('🎮 Spiele', totalGames, 'purple')}
        ${adminStat('🏆 Ges. Punkte', totalScore.toLocaleString('de-DE'), 'yellow')}
        ${adminStat('📊 Ø Punkte', avgScore, 'green')}
        ${adminStat('🚫 Gesperrt', bannedCount, 'red')}
        ${adminStat('✅ Heute aktiv', activeToday, 'orange')}
      </div>

      ${duplicatePwGroups.length > 0 ? `
        <div class="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <h3 class="font-orbitron text-sm text-red-400 mb-3 flex items-center gap-2">
            <i class="fas fa-exclamation-triangle"></i> Gleiche Passwörter erkannt (${duplicatePwGroups.length} Gruppen)
          </h3>
          <div class="space-y-2">
            ${duplicatePwGroups.map(([pw, uList]) => `
              <div class="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div class="text-xs text-red-300 mb-2">Passwort: <span class="font-mono bg-red-500/20 px-1 rounded">${sanitize(pw)}</span>
                  — ${uList.length} Benutzer
                </div>
                <div class="flex flex-wrap gap-2">
                  ${uList.map(u => `
                    <span class="flex items-center gap-1 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                      <span class="text-red-300">${sanitize(u.username)}</span>
                      <button onclick="window.adminBanUserById('${sanitize(u.uid)}', '${sanitize(u.username)}')"
                        class="ml-1 text-red-400 hover:text-red-200 hover:bg-red-500/30 px-1.5 py-0.5 rounded text-xs font-orbitron">
                        Sperren
                      </button>
                    </span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center text-green-400 text-sm mb-4">
          <i class="fas fa-check-circle mr-2"></i> Keine doppelten Passwörter gefunden
        </div>
      `}

      <div class="text-xs text-slate-500 text-center">
        Letzte Aktualisierung: ${new Date().toLocaleString('de-DE')}
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderAdminStats Fehler:', err);
  }
}

// ─── Benutzerliste ───────────────────────────────────────────────────────────
async function renderUsersList() {
  const pane = document.getElementById('admin-pane-users');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users    = await getAllUsers();
    const usersArr = Object.entries(users || {}).sort(
      (a, b) => (b[1].gameStats?.totalScore || 0) - (a[1].gameStats?.totalScore || 0)
    );

    if (usersArr.length === 0) {
      pane.innerHTML = '<p class="text-slate-500 text-center py-8">Noch keine Benutzer vorhanden.</p>';
      return;
    }

    // Passwort-Duplikat-Erkennung
    const pwMap = {};
    for (const [uid, user] of usersArr) {
      const pw = user.profile?.password;
      if (pw) {
        if (!pwMap[pw]) pwMap[pw] = [];
        pwMap[pw].push(uid);
      }
    }
    const duplicateUids = new Set(
      Object.values(pwMap).filter(arr => arr.length > 1).flat()
    );

    pane.innerHTML = `
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <input id="userSearchInput" type="text" placeholder="Benutzer suchen…"
          class="game-input px-3 py-2 rounded-xl text-sm flex-1 max-w-xs"
          oninput="window.filterUsers(this.value)" />
        <span class="text-xs text-slate-500">${usersArr.length} Benutzer</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[700px]">
          <thead>
            <tr class="text-left text-xs font-orbitron text-slate-500 uppercase tracking-widest border-b border-white/5">
              <th class="pb-3 pr-3">#</th>
              <th class="pb-3 pr-3">Benutzer</th>
              <th class="pb-3 pr-3">Punkte</th>
              <th class="pb-3 pr-3">Level</th>
              <th class="pb-3 pr-3">Streak</th>
              <th class="pb-3 pr-3">Status</th>
              <th class="pb-3">Aktionen</th>
            </tr>
          </thead>
          <tbody id="usersTableBody"></tbody>
        </table>
      </div>`;

    const tbody = document.getElementById('usersTableBody');
    usersArr.forEach(([uid, user], i) => {
      const gs      = user.gameStats || {};
      const pro     = user.profile   || {};
      const isDup   = duplicateUids.has(uid);
      const isBanned = pro.banned;

      const tr = document.createElement('tr');
      tr.className = `user-row border-b border-white/5 hover:bg-white/3 transition-colors ${isDup ? 'bg-red-500/5' : ''} ${isBanned ? 'opacity-50' : ''}`;
      tr.dataset.search = (pro.username || '').toLowerCase();
      tr.innerHTML = `
        <td class="py-3 pr-3 text-slate-500 text-xs">${i + 1}</td>
        <td class="py-3 pr-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              ${sanitize(pro.username?.charAt(0)?.toUpperCase() || '?')}
            </div>
            <div>
              <div class="text-slate-200 font-semibold flex items-center gap-1">
                ${sanitize(pro.username || 'Unbekannt')}
                ${isDup ? '<span class="text-xs text-red-400 bg-red-500/20 px-1 rounded" title="Doppeltes Passwort">⚠️ DupPW</span>' : ''}
                ${isBanned ? '<span class="text-xs text-red-400 bg-red-500/20 px-1 rounded">🚫 Gesperrt</span>' : ''}
              </div>
              <div class="text-xs text-slate-500">${sanitize(pro.email || 'Keine E-Mail')}</div>
            </div>
          </div>
        </td>
        <td class="py-3 pr-3 font-orbitron text-cyan-400">${(gs.totalScore || 0).toLocaleString('de-DE')}</td>
        <td class="py-3 pr-3 text-yellow-400 font-bold">${gs.maxLevel || 1}</td>
        <td class="py-3 pr-3 text-orange-400">🔥 ${gs.maxStreak || 0}</td>
        <td class="py-3 pr-3">
          <span class="text-xs ${pro.lastLogin && (Date.now() - pro.lastLogin) < 86400000 ? 'text-green-400' : 'text-slate-500'}">
            ${pro.lastLogin ? new Date(pro.lastLogin).toLocaleDateString('de-DE') : 'Nie'}
          </span>
        </td>
        <td class="py-3">
          <div class="flex items-center gap-1 flex-wrap">
            <button class="admin-btn-sm border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              onclick="window.adminEditUser('${sanitize(uid)}')" title="Bearbeiten">
              <i class="fas fa-edit text-xs"></i>
            </button>
            <button class="admin-btn-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onclick="window.adminMessageUser('${sanitize(uid)}', '${sanitize(pro.username)}')" title="Nachricht senden">
              <i class="fas fa-envelope text-xs"></i>
            </button>
            ${!isBanned ? `
              <button class="admin-btn-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                onclick="window.adminBanUserById('${sanitize(uid)}', '${sanitize(pro.username)}')" title="Sperren">
                <i class="fas fa-ban text-xs"></i>
              </button>
            ` : `
              <button class="admin-btn-sm border-green-500/30 text-green-400 hover:bg-green-500/10"
                onclick="window.adminUnbanUserById('${sanitize(uid)}', '${sanitize(pro.username)}')" title="Entsperren">
                <i class="fas fa-unlock text-xs"></i>
              </button>
            `}
            <button class="admin-btn-sm border-red-700/30 text-red-600 hover:bg-red-900/20"
              onclick="window.adminDeleteUser('${sanitize(uid)}', '${sanitize(pro.username)}')" title="Löschen">
              <i class="fas fa-trash text-xs"></i>
            </button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderUsersList Fehler:', err);
  }
}

// ─── Nachrichten senden (Admin) ──────────────────────────────────────────────
async function renderAdminMessages() {
  const pane = document.getElementById('admin-pane-messages');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users    = await getAllUsers();
    const usersArr = Object.entries(users || {});

    pane.innerHTML = `
      <div class="space-y-4">
        <div class="glass-panel rounded-xl p-5 border border-white/10">
          <h3 class="font-orbitron text-sm text-slate-300 mb-4">
            <i class="fas fa-broadcast-tower mr-2 text-cyan-400"></i>Nachricht senden
          </h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-slate-400 mb-1 block">Empfänger</label>
              <select id="msgTarget" class="game-input w-full px-3 py-2.5 rounded-xl text-sm">
                <option value="all">📢 Alle Benutzer (${usersArr.length})</option>
                ${usersArr.map(([uid, u]) =>
                  `<option value="${sanitize(uid)}">${sanitize(u.profile?.username || uid)}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-400 mb-1 block">Betreff</label>
              <input id="msgSubject" type="text" placeholder="Betreff der Nachricht…"
                class="game-input w-full px-3 py-2.5 rounded-xl text-sm" />
            </div>
            <div>
              <label class="text-xs text-slate-400 mb-1 block">Nachricht</label>
              <textarea id="msgBody" rows="4" placeholder="Nachrichteninhalt…"
                class="game-input w-full px-3 py-2.5 rounded-xl text-sm resize-none"></textarea>
            </div>
            <button onclick="window.adminSendMessage()"
              class="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-orbitron text-sm hover:bg-cyan-500/30 transition-all">
              <i class="fas fa-paper-plane mr-2"></i>Senden
            </button>
          </div>
        </div>
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
  }
}

// ─── Alle Nachrichten anzeigen (Admin-Posteingang) ───────────────────────────
async function renderAllMessages() {
  const pane = document.getElementById('admin-pane-allmsgs');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const messages = await getAllMessages();

    if (messages.length === 0) {
      pane.innerHTML = '<p class="text-slate-500 text-center py-8">Noch keine Nachrichten im System.</p>';
      return;
    }

    pane.innerHTML = `
      <div class="mb-3 text-xs text-slate-500 flex items-center gap-2">
        <i class="fas fa-eye text-cyan-400"></i>
        Alle Systembenachrichtigungen (${messages.length} gesamt)
      </div>
      <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        ${messages.map(msg => `
          <div class="admin-card rounded-xl p-4 ${!msg.isRead ? 'border-l-2 border-cyan-500' : ''}">
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <span class="font-semibold text-slate-200 text-sm">${sanitize(msg.subject || 'Kein Betreff')}</span>
                <span class="text-xs text-slate-500 ml-2">
                  → ${sanitize(msg.recipientName)}
                </span>
              </div>
              <div class="text-xs text-slate-500 flex-shrink-0">
                ${msg.sentAt ? new Date(msg.sentAt).toLocaleString('de-DE') : '—'}
              </div>
            </div>
            <p class="text-slate-400 text-sm leading-relaxed">${sanitize(msg.body || '')}</p>
            <div class="mt-2 flex items-center gap-3 text-xs text-slate-600">
              <span>Von: ${sanitize(msg.fromName || msg.from || 'Unbekannt')}</span>
              <span>${msg.isRead ? '✅ Gelesen' : '📩 Ungelesen'}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderAllMessages Fehler:', err);
  }
}

// ─── Geräte-Panel ────────────────────────────────────────────────────────────
async function renderDevices() {
  const pane = document.getElementById('admin-pane-devices');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users   = await getAllUsers();
    const devices = [];
    for (const [uid, user] of Object.entries(users || {})) {
      const devMap = user.devices || {};
      for (const [did, dev] of Object.entries(devMap)) {
        devices.push({ uid, username: user.profile?.username, did, ...dev });
      }
    }
    devices.sort((a, b) => (b.loginTime || 0) - (a.loginTime || 0));

    if (devices.length === 0) {
      pane.innerHTML = '<p class="text-slate-500 text-center py-8">Keine Geräte protokolliert.</p>';
      return;
    }

    pane.innerHTML = `
      <div class="space-y-2 max-h-[65vh] overflow-y-auto">
        ${devices.map(d => `
          <div class="admin-card rounded-xl p-4">
            <div class="flex items-center justify-between gap-4 mb-2 flex-wrap">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <i class="fas fa-${d.touchPoints > 0 ? 'mobile-alt' : 'laptop'} text-slate-400 text-xs"></i>
                </div>
                <div>
                  <span class="text-sm text-slate-200 font-semibold">${sanitize(d.username || 'Unbekannt')}</span>
                  <span class="text-xs text-slate-500 ml-2">${sanitize(d.loginTimeHuman || '—')}</span>
                </div>
              </div>
              <span class="text-xs font-mono text-slate-500">${d.screenWidth}×${d.screenHeight}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              ${deviceField('Browser', d.userAgent?.match(/(Firefox|Chrome|Safari|Edge|OPR)\/?[\d.]+/)?.[0] || 'Unbekannt')}
              ${deviceField('OS/Plattform', d.platform || '—')}
              ${deviceField('Sprache', d.language || '—')}
              ${deviceField('Zeitzone', d.timezone || '—')}
              ${deviceField('RAM', d.ram || '—')}
              ${deviceField('CPU-Kerne', d.cores || '—')}
              ${deviceField('Verbindung', d.connectionType || '—')}
              ${deviceField('Akku', d.battery || '—')}
              ${deviceField('Pixel-Ratio', d.pixelRatio || '—')}
            </div>
            <details class="mt-2">
              <summary class="text-xs text-slate-600 cursor-pointer hover:text-slate-400">User-Agent anzeigen</summary>
              <p class="text-xs text-slate-500 mt-1 font-mono break-all">${sanitize(d.userAgent || '—')}</p>
            </details>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderDevices Fehler:', err);
  }
}

function deviceField(label, value) {
  return `<div class="bg-white/3 rounded-lg p-2">
    <div class="text-slate-500 text-xs">${label}</div>
    <div class="text-slate-300 text-xs font-medium mt-0.5 truncate">${sanitize(String(value))}</div>
  </div>`;
}

// ─── Aktivitäts-Logs ─────────────────────────────────────────────────────────
async function renderAdminLogs() {
  const pane = document.getElementById('admin-pane-logs');
  if (!pane) return;
  pane.innerHTML = loadingHtml();

  try {
    const users    = await getAllUsers();
    const sessions = [];

    for (const [uid, user] of Object.entries(users || {})) {
      const sesMap = user.sessions || {};
      for (const s of Object.values(sesMap)) {
        sessions.push({ uid, username: user.profile?.username, ...s });
      }
      const logMap = user.log || {};
      for (const l of Object.values(logMap)) {
        sessions.push({ uid, username: user.profile?.username, ...l, isLoginLog: true });
      }
    }
    sessions.sort((a, b) => (b.timestamp || b.startTime || 0) - (a.timestamp || a.startTime || 0));

    if (sessions.length === 0) {
      pane.innerHTML = '<p class="text-slate-500 text-center py-8">Noch keine Logs vorhanden.</p>';
      return;
    }

    pane.innerHTML = `
      <div class="space-y-1.5 max-h-[65vh] overflow-y-auto">
        ${sessions.slice(0, 100).map(s => `
          <div class="admin-card rounded-xl px-4 py-3 flex items-center justify-between text-sm flex-wrap gap-2">
            <div class="flex items-center gap-3">
              <div class="w-1.5 h-1.5 rounded-full ${s.isLoginLog ? 'bg-green-400' : 'bg-cyan-400'} flex-shrink-0"></div>
              <div>
                <span class="font-semibold text-slate-300">${sanitize(s.username || 'Unbekannt')}</span>
                <span class="ml-2 text-slate-500 text-xs">
                  ${s.isLoginLog ? 'Login' : 'Spielsitzung'} ·
                  ${new Date(s.timestamp || s.startTime || 0).toLocaleString('de-DE')}
                </span>
              </div>
            </div>
            ${!s.isLoginLog ? `
              <div class="flex gap-4 text-xs font-orbitron">
                <span class="text-cyan-400">${s.score || 0} Pkt.</span>
                <span class="text-green-400">${s.correctAnswers || 0}/${s.questionsAnswered || 0}</span>
              </div>
            ` : ''}
          </div>`).join('')}
      </div>`;
  } catch (err) {
    pane.innerHTML = errorHtml(err.message);
    console.error('renderAdminLogs Fehler:', err);
  }
}

// ─── Admin-Aktionen ──────────────────────────────────────────────────────────
window.adminEditUser = async function(uid) {
  const subModal   = document.getElementById('adminSubModal');
  const subContent = document.getElementById('adminSubContent');
  if (!subModal || !subContent) return;

  subContent.innerHTML = loadingHtml();
  subModal.classList.remove('hidden');
  subModal.classList.add('flex');

  try {
    const user = await getUserProfile(uid);
    const gs   = user?.gameStats || {};
    const pro  = user?.profile   || {};

    subContent.innerHTML = `
      <h2 class="font-orbitron text-lg text-yellow-400 mb-5 flex items-center gap-2">
        <i class="fas fa-user-cog"></i> ${sanitize(pro.username || uid)} bearbeiten
      </h2>

      <div class="grid grid-cols-2 gap-3 mb-5">
        ${adminStat('Punkte', gs.totalScore || 0, 'cyan')}
        ${adminStat('Level', gs.maxLevel || 1, 'yellow')}
        ${adminStat('Streak', gs.maxStreak || 0, 'orange')}
        ${adminStat('Spiele', gs.totalGamesPlayed || 0, 'purple')}
      </div>

      <div class="space-y-4 mb-5">
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Punkte setzen</label>
            <input id="editScore" type="number" value="${gs.totalScore || 0}" min="0"
              class="game-input w-full px-3 py-2 rounded-xl text-sm text-center font-orbitron" />
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Level setzen</label>
            <input id="editLevel" type="number" value="${gs.maxLevel || 1}" min="1" max="6"
              class="game-input w-full px-3 py-2 rounded-xl text-sm text-center font-orbitron" />
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Streak setzen</label>
            <input id="editStreak" type="number" value="${gs.maxStreak || 0}" min="0"
              class="game-input w-full px-3 py-2 rounded-xl text-sm text-center font-orbitron" />
          </div>
        </div>

        <div>
          <label class="text-xs text-slate-400 mb-1 block">Bio</label>
          <textarea id="editBio" rows="2"
            class="game-input w-full px-3 py-2 rounded-xl text-sm resize-none">${sanitize(pro.bio || '')}</textarea>
        </div>

        <div class="flex items-center gap-3">
          <label class="text-sm text-slate-300">Passwort:</label>
          <span class="font-mono text-yellow-400 text-sm bg-yellow-500/10 px-2 py-1 rounded">${sanitize(pro.password || '—')}</span>
        </div>
      </div>

      <div class="flex gap-3">
        <button onclick="window.adminSaveUser('${sanitize(uid)}')"
          class="flex-1 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-orbitron text-sm hover:bg-cyan-500/30 transition-all">
          <i class="fas fa-save mr-2"></i>Speichern
        </button>
        <button onclick="window.closeAdminSubModal()"
          class="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm hover:bg-white/10">
          Abbrechen
        </button>
      </div>`;
  } catch (err) {
    subContent.innerHTML = errorHtml(err.message);
  }
};

window.adminSaveUser = async function(uid) {
  const score  = document.getElementById('editScore')?.value;
  const level  = document.getElementById('editLevel')?.value;
  const streak = document.getElementById('editStreak')?.value;
  const bio    = document.getElementById('editBio')?.value?.trim();

  try {
    await adminUpdateUserStats(uid, { score, level, streak });
    await updateUserProfile(uid, { bio: bio || '' });
    window.closeAdminSubModal();
    showAdminToast('Benutzerdaten gespeichert ✓', 'green');
    // Benutzerliste neu laden
    setTimeout(() => renderUsersList(), 500);
  } catch (err) {
    showAdminToast('Fehler: ' + err.message, 'red');
  }
};

window.adminMessageUser = function(uid, username) {
  const subModal   = document.getElementById('adminSubModal');
  const subContent = document.getElementById('adminSubContent');
  if (!subModal || !subContent) return;

  subModal.classList.remove('hidden');
  subModal.classList.add('flex');

  subContent.innerHTML = `
    <h2 class="font-orbitron text-lg text-purple-400 mb-5 flex items-center gap-2">
      <i class="fas fa-envelope"></i> Nachricht an ${sanitize(username)}
    </h2>
    <div class="space-y-3 mb-4">
      <div>
        <label class="text-xs text-slate-400 mb-1 block">Betreff</label>
        <input id="dmSubject" type="text" placeholder="Betreff…"
          class="game-input w-full px-3 py-2.5 rounded-xl text-sm" />
      </div>
      <div>
        <label class="text-xs text-slate-400 mb-1 block">Nachricht</label>
        <textarea id="dmBody" rows="4" placeholder="Nachrichteninhalt…"
          class="game-input w-full px-3 py-2.5 rounded-xl text-sm resize-none"></textarea>
      </div>
    </div>
    <div class="flex gap-3">
      <button onclick="window.adminSendDM('${sanitize(uid)}')"
        class="flex-1 py-3 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-orbitron text-sm hover:bg-purple-500/30 transition-all">
        <i class="fas fa-paper-plane mr-2"></i>Senden
      </button>
      <button onclick="window.closeAdminSubModal()"
        class="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm hover:bg-white/10">
        Abbrechen
      </button>
    </div>`;
};

window.adminSendDM = async function(uid) {
  const subject = document.getElementById('dmSubject')?.value?.trim();
  const body    = document.getElementById('dmBody')?.value?.trim();
  if (!subject || !body) {
    showAdminToast('Betreff und Inhalt sind erforderlich.', 'red');
    return;
  }
  try {
    await sendMessageToUser(uid, { subject, body, fromName: 'Admin (Higer)' }, '__admin__');
    window.closeAdminSubModal();
    showAdminToast('Nachricht gesendet ✓', 'green');
  } catch (err) {
    showAdminToast('Fehler: ' + err.message, 'red');
  }
};

window.adminSendMessage = async function() {
  const target  = document.getElementById('msgTarget')?.value;
  const subject = document.getElementById('msgSubject')?.value?.trim();
  const body    = document.getElementById('msgBody')?.value?.trim();
  if (!subject || !body) {
    showAdminToast('Betreff und Inhalt sind erforderlich.', 'red');
    return;
  }

  try {
    if (target === 'all') {
      const users = await getAllUsers();
      const sends = Object.keys(users).map(uid =>
        sendMessageToUser(uid, { subject, body, fromName: 'Admin (Higer)' }, '__admin__').catch(() => {})
      );
      await Promise.allSettled(sends);
      showAdminToast(`Nachricht an ${Object.keys(users).length} Benutzer gesendet ✓`, 'green');
    } else {
      await sendMessageToUser(target, { subject, body, fromName: 'Admin (Higer)' }, '__admin__');
      showAdminToast('Nachricht gesendet ✓', 'green');
    }
    document.getElementById('msgSubject').value = '';
    document.getElementById('msgBody').value    = '';
  } catch (err) {
    showAdminToast('Fehler: ' + err.message, 'red');
  }
};

window.adminBanUserById = async function(uid, username) {
  if (!confirm(`Benutzer "${username}" wirklich sperren?`)) return;
  try {
    await adminBanUser(uid);
    showAdminToast(`${username} wurde gesperrt.`, 'red');
    renderUsersList();
  } catch (err) {
    showAdminToast('Fehler: ' + err.message, 'red');
  }
};

window.adminUnbanUserById = async function(uid, username) {
  try {
    await adminUnbanUser(uid);
    showAdminToast(`${username} wurde entsperrt.`, 'green');
    renderUsersList();
  } catch (err) {
    showAdminToast('Fehler: ' + err.message, 'red');
  }
};

window.adminDeleteUser = async function(uid, username) {
  if (!confirm(`Benutzer "${username}" dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden!`)) return;
  try {
    await deleteUser(uid);
    showAdminToast(`${username} wurde gelöscht.`, 'red');
    renderUsersList();
  } catch (err) {
    showAdminToast('Fehler: ' + err.message, 'red');
  }
};

window.closeAdminSubModal = function() {
  const m = document.getElementById('adminSubModal');
  if (!m) return;
  m.classList.add('hidden');
  m.classList.remove('flex');
};

window.filterUsers = function(query) {
  const rows = document.querySelectorAll('.user-row');
  const q    = query.toLowerCase();
  rows.forEach(row => {
    row.classList.toggle('hidden', !row.dataset.search?.includes(q));
  });
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function loadingHtml() {
  return `<div class="flex items-center justify-center py-12 gap-3">
    <div class="w-7 h-7 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
    <span class="text-slate-400 font-orbitron text-sm">Wird geladen…</span>
  </div>`;
}

function errorHtml(msg) {
  return `<div class="text-red-400 p-4 text-sm font-orbitron border border-red-500/20 rounded-xl bg-red-500/5">
    <i class="fas fa-exclamation-triangle mr-2"></i>Fehler: ${sanitize(msg)}
  </div>`;
}

function adminStat(label, value, color) {
  const colors = {
    cyan: 'text-cyan-400', yellow: 'text-yellow-400', orange: 'text-orange-400',
    purple: 'text-purple-400', green: 'text-green-400', red: 'text-red-400',
  };
  return `<div class="admin-card rounded-xl p-3 text-center">
    <div class="font-orbitron text-lg font-black ${colors[color] || 'text-slate-300'}">${sanitize(String(value))}</div>
    <div class="text-xs text-slate-500 mt-0.5">${label}</div>
  </div>`;
}

function showAdminToast(msg, type = 'green') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const colors = {
    green: 'border-green-500/40 text-green-300 bg-green-500/10',
    red:   'border-red-500/40 text-red-300 bg-red-500/10',
    cyan:  'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
  };
  const el = document.createElement('div');
  el.className = `glass-panel border ${colors[type] || colors.cyan} px-4 py-3 rounded-xl text-sm font-semibold pointer-events-auto`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
