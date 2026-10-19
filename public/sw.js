/* MAYA Service Worker — v4.6.0 (FULL ES5 — old Android System WebView par bhi parse hota hai)
   Network-first for HTML (so updates apply immediately),
   cache-first for static assets. */
var CACHE = 'maya-v5.10.1';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icons/icon-96.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML pages: network-first (fresh content always)
  var accept = req.headers.get('accept') || '';
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html') || accept.indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(req).then(function(res) {
        var copy = res.clone();
        caches.open(CACHE).then(function(c) { return c.put(req, copy); });
        return res;
      }).catch(function() { return caches.match(req, { ignoreSearch: true }); })
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function(hit) {
      if (hit) return hit;
      return fetch(req).then(function(res) {
        var copy = res.clone();
        caches.open(CACHE).then(function(c) { return c.put(req, copy); });
        return res;
      }).catch(function() { return caches.match('./index.html'); });
    })
  );
});
