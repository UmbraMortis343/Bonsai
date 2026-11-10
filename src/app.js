// App shell: installing, and updating to a new release.
(() => {
  const $ = (id) => document.getElementById(id);
  const updateBar = $("updateBar"), updateBtn = $("updateBtn"), updateText = $("updateText");
  let waiting = null, installEvent = null, reg = null;

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; });
  window.addEventListener("appinstalled", () => { installEvent = null; });

  async function latest() {
    try { const r = await fetch("version.json", { cache: "no-store" }); return r.ok ? (await r.json()).version || null : null; } catch { return null; }
  }
  async function showUpdate(worker) {
    waiting = worker;
    const v = await latest();
    updateText.textContent = v ? `Bonsai ${v}` : "New version";
    updateBtn.textContent = v ? `Update to ${v}` : "Update";
    updateBar.hidden = false;
  }
  updateBtn.addEventListener("click", () => {
    if (!waiting) return;
    updateBtn.disabled = true; updateBtn.textContent = "Updating…";
    waiting.postMessage("skipWaiting");
  });

  window.bonsaiShell = {
    version: "__VERSION__",
    canInstall: () => !!installEvent,
    async install() { if (!installEvent) return; installEvent.prompt(); try { await installEvent.userChoice; } catch {} installEvent = null; },
    // Resolves "update", "latest" or "offline".
    async check() {
      if (!reg) return "latest";
      await reg.update().catch(() => {});
      const v = await latest();
      if (reg.waiting) { await showUpdate(reg.waiting); return "update"; }
      if (v === null) return "offline";
      return v !== "__VERSION__" ? "update" : "latest";
    },
  };

  if (!("serviceWorker" in navigator)) return;
  // Reload only after Update was tapped, not when the first install takes control.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading || !updateBtn.disabled) return; reloading = true; location.reload(); });
  navigator.serviceWorker.register("sw.js").then((r) => {
    reg = r;
    const watch = (w) => w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdate(w); });
    if (r.waiting && navigator.serviceWorker.controller) showUpdate(r.waiting);
    watch(r.installing); r.addEventListener("updatefound", () => watch(r.installing));
    const check = () => r.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 60 * 60 * 1000);
  }).catch(() => {});
})();
