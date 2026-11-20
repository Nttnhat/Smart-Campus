// Service worker: dùng được khi mạng yếu / mất mạng tạm thời trong khuôn viên.
// - Tile OSM: cache-first (giới hạn số lượng) -> không cần lưu ảnh bản đồ trong repo.
// - Dữ liệu bản đồ công khai (địa điểm, đồ thị đường, OSM): dùng bản cache ngay, cập nhật nền.
// - CSS/JS/ảnh/thư viện: stale-while-revalidate.
// - Trang PHP: mạng trước, mất mạng thì trả bản đã cache.
// - API cá nhân/ghi dữ liệu (user, admin, log, login): KHÔNG cache.
const VERSION = 'v2';
const STATIC_CACHE = `sc-static-${VERSION}`;
const DATA_CACHE = `sc-data-${VERSION}`;
const TILE_CACHE = 'sc-osm-tiles';
const DRIVE_CACHE = 'sc-drive-images';
const MAX_TILES = 800;
const MAX_DRIVE_IMAGES = 200;
const PUBLIC_DATA = ['api/places.php', 'api/road-graph.php', 'api/osm-campus.php', 'api/categories.php'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(['home.php', 'campus-map.php', 'navigation.php', 'css/style.css', 'image/logo.svg']).catch(() => {})));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, DATA_CACHE, TILE_CACHE, DRIVE_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone());
    if (cacheName === TILE_CACHE) trimCache(TILE_CACHE, MAX_TILES);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
      if (cacheName === DRIVE_CACHE) trimCache(DRIVE_CACHE, MAX_DRIVE_IMAGES);
    }
    return response;
  }).catch(() => hit);
  return hit || network;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: false }) || await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }
  // Ảnh sơ đồ tầng / ảnh địa điểm lấy qua Google Drive: trả bản cache ngay (Drive tự sinh
  // thumbnail khá chậm), cập nhật nền -> ảnh admin vừa đổi có thể cũ 1 lúc tới khi cache mới về.
  if (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail') {
    event.respondWith(staleWhileRevalidate(request, DRIVE_CACHE));
    return;
  }
  if (url.hostname === 'unpkg.com' || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (PUBLIC_DATA.some(p => path.endsWith(p))) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }
  if (path.includes('/api/')) return; // dữ liệu cá nhân / admin: luôn lấy từ mạng
  if (/\.(css|js|svg|png|jpg|webp|woff2?)$/.test(path)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
  if (request.mode === 'navigate' && !path.endsWith('admin.php')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
  }
});
