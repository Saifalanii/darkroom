const CACHE_NAME = 'darkroom-shell-v1';
const SHARE_CACHE = 'darkroom-shared-v1';
const SHELL_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SHARE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle a photo shared in from the OS share sheet (gallery -> Share -> Darkroom)
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('photo');
          if (file) {
            const cache = await caches.open(SHARE_CACHE);
            await cache.put('/shared-photo', new Response(file, {
              headers: { 'Content-Type': file.type || 'image/jpeg' },
            }));
          }
        } catch (err) {
          // fall through to redirect regardless — index.html handles the "no shared photo" case fine
        }
        return Response.redirect('./index.html?shared=1', 303);
      })()
    );
    return;
  }

  // App shell: cache-first, falling back to network, falling back to the cached shell if offline
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).catch(() => caches.match('./index.html'));
      })
    );
  }
});
