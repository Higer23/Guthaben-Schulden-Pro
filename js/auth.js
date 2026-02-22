/**
 * auth.js
 * =======
 * Authentication: Login / Signup / Device Detection / Session Management
 * Guthaben-Schulden-Spiel Pro Edition
 */

import {
  getUserByUsername, createUser, updateUserProfile,
  upsertDevice, getUserProfile, getUserDevices,
  getInbox, pushNotification, getNotifications, markNotifRead,
  listenToNotifications, listenToInbox,
} from './firebase-config.js';

// ─── ADMIN CREDENTIALS (client-side check only, also verified in DB) ─────────
const ADMIN_USERNAME = 'Halil';
const ADMIN_PASSWORD = '19105887638';

// ─── SESSION ──────────────────────────────────────────────────────────────────
export let currentUser = null;   // { uid, profile }

// ─── DEVICE INFO ─────────────────────────────────────────────────────────────
export function getDeviceInfo() {
  const ua = navigator.userAgent;

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('Edg/'))       browser = 'Edge ' + ua.match(/Edg\/([\d.]+)/)?.[1];
  else if (ua.includes('OPR/'))  browser = 'Opera ' + ua.match(/OPR\/([\d.]+)/)?.[1];
  else if (ua.includes('Chrome')) browser = 'Chrome ' + ua.match(/Chrome\/([\d.]+)/)?.[1];
  else if (ua.includes('Firefox')) browser = 'Firefox ' + ua.match(/Firefox\/([\d.]+)/)?.[1];
  else if (ua.includes('Safari'))  browser = 'Safari ' + ua.match(/Version\/([\d.]+)/)?.[1];

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows'))    os = 'Windows';
  else if (ua.includes('Mac OS X'))   os = 'macOS ' + ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.');
  else if (ua.includes('Linux'))      os = 'Linux';
  else if (ua.includes('Android'))    os = 'Android ' + ua.match(/Android ([\d.]+)/)?.[1];
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Generate deterministic device ID from UA + language + screen size
  const raw = ua + navigator.language + screen.width + screen.height + screen.colorDepth;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const deviceId = Math.abs(hash).toString(36);

  return {
    deviceId,
    browser:   browser || 'Unknown',
    os:        os || 'Unknown',
    userAgent: ua,
    ipAddress: 'pending', // filled after fetch
  };
}

export async function fetchIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    return d.ip || 'Unknown';
  } catch { return 'Unknown'; }
}

// ─── DEVICE MATCH SCORE ──────────────────────────────────────────────────────
function deviceMatchScore(stored, current) {
  let matches = 0;
  let total   = 3;
  if (stored.browser?.split(' ')[0] === current.browser?.split(' ')[0]) matches++;
  if (stored.os?.split(' ')[0] === current.os?.split(' ')[0]) matches++;
  if (stored.ipAddress && current.ipAddress && stored.ipAddress === current.ipAddress) matches++;
  return matches / total; // 0..1
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
export async function loginUser(username, password) {
  // Admin shortcut
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const deviceInfo = getDeviceInfo();
    deviceInfo.ipAddress = await fetchIP();
    currentUser = {
      uid:     '__admin__',
      profile: {
        username: ADMIN_USERNAME,
        isAdmin:  true,
        email:    '',
        theme:    'dark',
      },
      deviceInfo,
    };
    sessionStorage.setItem('gss_session', JSON.stringify({ uid: '__admin__', username: ADMIN_USERNAME, isAdmin: true }));
    return { success: true, isAdmin: true };
  }

  const userData = await getUserByUsername(username);
  if (!userData) return { success: false, error: 'Kullanıcı bulunamadı.' };
  if (userData.profile?.password !== password) return { success: false, error: 'Şifre yanlış.' };
  if (userData.profile?.status === 'banned') return { success: false, error: 'Hesabınız yasaklanmıştır.' };

  const deviceInfo = getDeviceInfo();
  deviceInfo.ipAddress = await fetchIP();

  // Check existing devices for match score
  const devices = await getUserDevices(userData.uid);
  let maxScore  = 0;
  let isBanned  = false;
  for (const dev of Object.values(devices)) {
    if (dev.isBanned && dev.deviceId === deviceInfo.deviceId) {
      isBanned = true; break;
    }
    const score = deviceMatchScore(dev, deviceInfo);
    if (score > maxScore) maxScore = score;
  }

  if (isBanned) return { success: false, error: 'Bu cihaz yasaklandı.' };

  // Upsert device
  await upsertDevice(userData.uid, deviceInfo);

  // Update last login
  await updateUserProfile(userData.uid, { lastLogin: Date.now() });

  currentUser = {
    uid:        userData.uid,
    profile:    { ...userData.profile, username },
    deviceInfo,
  };

  sessionStorage.setItem('gss_session', JSON.stringify({
    uid:      userData.uid,
    username: userData.profile.username,
    isAdmin:  false,
  }));

  // Device mismatch warning?
  const isNewDevice = Object.keys(devices).length === 0;
  const lowMatch    = !isNewDevice && maxScore < 0.5;

  return { success: true, isAdmin: false, lowMatch, matchScore: maxScore };
}

// ─── SIGNUP ──────────────────────────────────────────────────────────────────
export async function signupUser(username, password, email) {
  if (username.length < 3)  return { success: false, error: 'Kullanıcı adı en az 3 karakter olmalı.' };
  if (password.length < 6)  return { success: false, error: 'Şifre en az 6 karakter olmalı.' };
  if (username === ADMIN_USERNAME) return { success: false, error: 'Bu kullanıcı adı kullanılamaz.' };

  const existing = await getUserByUsername(username);
  if (existing) return { success: false, error: 'Bu kullanıcı adı zaten alınmış.' };

  const uid = await createUser({ username, password, email });
  const deviceInfo = getDeviceInfo();
  deviceInfo.ipAddress = await fetchIP();
  await upsertDevice(uid, deviceInfo);

  currentUser = {
    uid,
    profile: { username, email, isAdmin: false, theme: 'dark', avatar: '', bio: '', status: 'active' },
    deviceInfo,
  };
  sessionStorage.setItem('gss_session', JSON.stringify({ uid, username, isAdmin: false }));
  return { success: true };
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
export function logoutUser() {
  currentUser = null;
  sessionStorage.removeItem('gss_session');
}

// ─── RESTORE SESSION (page reload) ───────────────────────────────────────────
export async function restoreSession() {
  const saved = sessionStorage.getItem('gss_session');
  if (!saved) return false;
  try {
    const { uid, username, isAdmin } = JSON.parse(saved);
    if (isAdmin) {
      currentUser = { uid: '__admin__', profile: { username, isAdmin: true, theme: 'dark' } };
      return true;
    }
    const profile = await getUserProfile(uid);
    if (!profile) { sessionStorage.removeItem('gss_session'); return false; }
    currentUser = { uid, profile };
    return true;
  } catch { return false; }
}

export function isAdmin() {
  return currentUser?.profile?.isAdmin === true || currentUser?.uid === '__admin__';
}

export function getCurrentUser() { return currentUser; }
