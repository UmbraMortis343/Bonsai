// Bonsai service worker. A new version = new cache. The new worker waits until
// the person taps Update, then takes over and the page reloads.
const VERSION = "__VERSION__";
const CACHE = "bonsai-" + VERSION;
const SHELL = [
  "./", "index.html", "app.js", "styles.css", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png",
  "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("bonsai-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
  if (e.data === "version" && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Always ask the network for the version file, so update checks are fresh.
  if (url.pathname.endsWith("/version.json")) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (hit) return hit;
    try { return await fetch(req); }
    catch { return new Response("Offline", { status: 503, statusText: "Offline" }); }
  })());
});
