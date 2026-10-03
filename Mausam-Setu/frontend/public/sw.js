/* precache:start */
const CACHE_NAME = "mausam-shell-development";
const PRECACHE_URLS = ["/", "/favicon.svg", "/manifest.webmanifest"];
/* precache:end */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const previousVersions = names.filter(
        (name) => name.startsWith("mausam-shell-") && name !== CACHE_NAME,
      );
      await Promise.all(previousVersions.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api")
  )
    return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.status >= 500) throw new Error("Server unavailable");
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => {}),
          );
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        // Vite/CDNs can add Vary: Origin. A font first requested offline may
        // have an Origin header absent from install-time precaching. These
        // explicitly public, same-origin assets have no personalized variant.
        const saved = await cache.match(request, {
          ignoreVary: PRECACHE_URLS.includes(url.pathname),
        });
        if (saved) return saved;
        if (request.mode === "navigate") {
          const shell = await cache.match("/");
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});

// Web Push receiver. A deployed sender must enforce the same consent/dedup policy.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data?.json();
      } catch {
        return;
      }
      if (
        !payload ||
        !["live", "estimated"].includes(payload.status) ||
        !Number.isFinite(Date.parse(payload.expires_at)) ||
        Date.parse(payload.expires_at) <= Date.now()
      )
        return;
      await self.registration.showNotification(
        String(payload.title || "Mausam Setu").slice(0, 100),
        {
          body: String(payload.message || "").slice(0, 500),
          tag: String(payload.id || "weather").slice(0, 100),
          data: { url: "/" },
        },
      );
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const existing = windows.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) return existing.focus();
        return clients.openWindow("/");
      }),
  );
});
