// TRAINING LOG Service Worker: offline cache + Web Push
var CACHE = 'training-log-v4';
var CORE = ['./', 'index.html', 'manifest.json', 'push-config.js', 'IMG_9058.jpeg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var ok = url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ok) return;
  var fresh = req.mode === 'navigate' || /\/(index\.html|push-config\.js|manifest\.json)$/.test(url.pathname) || url.pathname.slice(-1) === '/';
  e.respondWith(caches.open(CACHE).then(function (cache) {
    if (fresh) {
      // 画面本体と設定は通信優先(更新・設定変更がすぐ反映される)。オフライン時はキャッシュ。
      return fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () { return cache.match(req, { ignoreSearch: true }); });
    }
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
self.addEventListener('push', function (event) {
  var payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(self.registration.showNotification(payload.title || '休憩終了', {
    body: payload.body || '休憩時間が終了しました。次のセットへ。',
    tag: payload.tag || 'training-log-rest',
    renotify: true,
    data: { url: payload.url || './' },
    icon: './IMG_9058.jpeg',
    badge: './IMG_9058.jpeg'
  }));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = new URL((event.notification.data && event.notification.data.url) || './', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
    for (var i = 0; i < clients.length; i++) {
      if ('focus' in clients[i]) return clients[i].focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});
