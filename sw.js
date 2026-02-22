/**
 * sw.js — Service Worker
 * Guthaben-Schulden-Spiel Pro Edition
 */

const CACHE_NAME = 'gss-pro-v4';
const ASSETS     = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/admin.js',
  '/js/i18n.js',
  '/js/gameLogic.js',
  '/js/storage.js',
  '/js/stats.js',
  '/js/ui.js',
  '/js/audio.js',
  '/js/social.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firebasedatabase') || e.request.url.includes('googleapis')) return;
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
      .catch(() => caches.match('/index.html'))
  );
});
