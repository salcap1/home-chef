/* Minimal service worker so Android can treat the panel as installable.
 * Network-first for navigations; no aggressive offline caching of household data.
 * Bump CACHE when shell layout changes so installed PWAs drop stale responses.
 */
const CACHE = "chef-shell-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("chef-shell-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        return Response.error();
      }),
  );
});
