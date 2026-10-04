'use strict';
// App shell only. No API, localhost, credentials, or application-state caching.
const ROOT = new URL('./', self.location.href);
const PREFIX = 'rww2-shell-' + ROOT.pathname + '-';
const CACHE = PREFIX + '2.1.1';
const ASSETS = ['index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'].map(p => new URL(p, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // No skipWaiting: never replace a running processing session automatically.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== ROOT.origin) return;
  const shell = req.mode === 'navigate' && (url.pathname === ROOT.pathname || url.pathname === ROOT.pathname + 'index.html');
  const clean = url.origin + url.pathname;
  if (!shell && (!ASSETS.includes(clean) || url.search)) return;
  // Version-coherent installed shell. Updates are staged by a changed sw.js.
  const key = shell ? new URL('index.html', ROOT).href : clean;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(req);
    if (response.ok && response.type === 'basic') {
      try { await cache.put(key, response.clone()); } catch (_) { /* Successful network response still usable. */ }
    }
    return response;
  }));
});
