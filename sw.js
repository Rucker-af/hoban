// オフラインでも遊べるようにするキャッシュ。ファイルを更新したら VERSION を上げる。
const VERSION = 'hoban-v1.0';
const FILES = [
  './',
  'index.html',
  'style.css',
  'engine.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'assets/A_b.webp',
  'assets/A_w.webp',
  'assets/D_b.webp',
  'assets/D_w.webp',
  'assets/F_b.webp',
  'assets/F_w.webp',
  'assets/I_b.webp',
  'assets/I_w.webp',
  'assets/K_b.webp',
  'assets/K_w.webp',
  'assets/N_b.webp',
  'assets/N_w.webp',
  'assets/P1_b.webp',
  'assets/P1_w.webp',
  'assets/P2_b.webp',
  'assets/P2_w.webp',
  'assets/P3_b.webp',
  'assets/P3_w.webp',
  'assets/P_b.webp',
  'assets/P_w.webp',
  'assets/R_b.webp',
  'assets/R_w.webp',
  'assets/S_b.webp',
  'assets/S_w.webp'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('fonts.g'))) {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => hit)));
});
