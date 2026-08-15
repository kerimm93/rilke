var CACHE_PREFIX = 'rilke-app-';
var CACHE_NAME = 'rilke-app-v1';
var APP_SHELL_URL = new URL('./index.html', self.location.href).href;
var STATIC_ASSET_URLS = [
  './manifest.json',
  './icons/rilke-192.png',
  './icons/rilke-512.png',
  './vendor/jszip-3.10.1.min.js'
].map(function(path) {
  return new URL(path, self.location.href).href;
});
var PRECACHE_URLS = [APP_SHELL_URL].concat(STATIC_ASSET_URLS);

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName.indexOf(CACHE_PREFIX) === 0 && cacheName !== CACHE_NAME;
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

function networkFirstNavigation(request) {
  return fetch(request).then(function(response) {
    if (!response || !response.ok || response.type === 'error') return response;

    var copy = response.clone();
    return caches.open(CACHE_NAME).then(function(cache) {
      return cache.put(APP_SHELL_URL, copy);
    }).catch(function() {
      return undefined;
    }).then(function() {
      return response;
    });
  }, function() {
    return caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(APP_SHELL_URL);
    }).then(function(cachedResponse) {
        if (cachedResponse) return cachedResponse;
        throw new Error('Rilke App-Shell ist offline nicht verfügbar.');
    });
  });
}

function cacheFirstStatic(request) {
  return caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(request).then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(function(response) {
        if (!response || !response.ok || response.type === 'error') return response;

        var copy = response.clone();
        return cache.put(request, copy);
      }).catch(function() {
        return undefined;
      }).then(function() {
        return response;
      });
    });
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (STATIC_ASSET_URLS.indexOf(requestUrl.href) !== -1) {
    event.respondWith(cacheFirstStatic(event.request));
  }
});
