// WEIGHT/LOG service worker — makes the installed app open offline.
// All user data lives in localStorage, so caching the app shell + static assets is enough.
//
// Versioning: the page registers "/sw.js?v=<build id>". A new build → new script URL →
// the browser installs a fresh worker, which owns caches named with that build id and
// deletes the previous build's caches on activate.

const PREFIX = "weightlog-";
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`;
const ASSET_CACHE = `${PREFIX}assets-${VERSION}`;
const ASSET_LIMIT = 120; // hashed chunks/fonts/icons kept per build

const SHELL_URL = "/";
const PRECACHE = [SHELL_URL, "/manifest.json", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

/** Build files the shell HTML references directly: JS chunks, CSS, preloaded fonts. */
const shellAssets = (html) => [...new Set(html.match(/\/_next\/static\/[\w\-.~%/]+/g) ?? [])];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      // cache: "reload" bypasses the HTTP cache so the shell matches this build
      await shell.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })));
      // Precache the shell's own JS/CSS too. Without them, an offline launch after the
      // browser has evicted its HTTP cache only shows the static "LOADING" HTML.
      // Kept in the shell cache (never trimmed); best-effort so one miss can't block install.
      const res = await shell.match(SHELL_URL);
      const assets = shellAssets(res ? await res.text() : "");
      await Promise.allSettled(assets.map((u) => shell.add(u)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // only touch this app's caches, never anything else on the origin
            .filter((k) => k.startsWith(PREFIX) && k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Keep the asset cache bounded (oldest entries first). */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

const cacheable = (res) => res && res.ok && res.type === "basic";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first, refresh the cached shell, fall back to it offline.
  // The app is a single page, so any navigation (including start_url "/?source=pwa") maps to "/".
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (cacheable(res) && url.pathname === SHELL_URL && !res.redirected) {
            const copy = res.clone();
            event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(SHELL_URL, copy)));
          }
          return res;
        } catch {
          const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Immutable build assets (hashed), self-hosted fonts and icons: cache first.
  const isAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/media/") ||
    url.pathname.startsWith("/icons/");
  if (isAsset) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (cacheable(res)) {
          const copy = res.clone();
          event.waitUntil(
            caches
              .open(ASSET_CACHE)
              .then((c) => c.put(req, copy))
              .then(() => trim(ASSET_CACHE, ASSET_LIMIT))
          );
        }
        return res;
      })()
    );
  }
  // Everything else (RSC payloads, manifest, etc.) goes straight to the network.
});
