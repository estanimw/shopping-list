const CACHE_NAME = "compra-ligera-offline-v1";
const OFFLINE_DOCUMENT = "/offline";

function cacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon"
  );
}

async function warmOfflineShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(OFFLINE_DOCUMENT, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No pudimos preparar la pantalla offline.");
  }

  await cache.put(OFFLINE_DOCUMENT, response.clone());
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin && cacheableAsset(url));

  await Promise.all(
    assets.map(async (asset) => {
      try {
        const assetResponse = await fetch(asset, { cache: "no-store" });
        if (assetResponse.ok) {
          await cache.put(asset, assetResponse);
        }
      } catch {
        // A partial cache is still useful; later online visits will warm it again.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(warmOfflineShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "WARM_OFFLINE_SHELL") {
    event.waitUntil(warmOfflineShell().catch(() => undefined));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_DOCUMENT)));
    return;
  }

  if (!cacheableAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) {
        return cached;
      }
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
