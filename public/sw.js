const CACHE_NAME = 'macrohon-cache-v1';

const shouldCache = (url) => {
  return (
    /basemaps\.cartocdn\.com/.test(url) ||
    /api\.maptiler\.com/.test(url) ||
    /\/data\/tiles\//.test(url) ||
    /\/data\/Macrhon_Raster\.png/.test(url) ||
    /\/data\/Macrohon(_Text|_Boundary)?\.json/.test(url)
  );
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!shouldCache(url.href)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return new Response('Network error', { status: 503 });
      }
    }),
  );
});
