// Bonsai service worker. A new version = new cache. The new worker waits until
// the person taps Update, then takes over and the page reloads.
const VERSION = "__VERSION__";
const CHANNEL = "__CHANNEL__" === "beta" ? "beta" : "";   // the beta lives at /beta/ with its own worker and cache
const CACHE = "bonsai-" + (CHANNEL ? CHANNEL + "-" : "") + VERSION;
const MINE = CHANNEL ? new RegExp("^bonsai-" + CHANNEL + "-") : /^bonsai-\d/;
const SHELL = __FILES__;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (MINE.test(k) && k !== CACHE) await caches.delete(k);
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
  if (!CHANNEL && url.pathname.includes("/beta/")) return;   // the beta copy answers for itself
  // Always ask the network for the version file, so update checks are fresh.
  if (url.pathname.endsWith("/version.json")) return;
  // The model runtime is big and optional: fetched on first use, then kept across updates.
  if (url.pathname.includes("/vendor/ai/")) {
    e.respondWith((async () => {
      const keep = await caches.open("ai-bonsai-1"), hit = await keep.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) keep.put(req, res.clone());
      return res;
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (hit) return hit;
    try { return await fetch(req); }
    catch { return new Response("Offline", { status: 503, statusText: "Offline" }); }
  })());
});
