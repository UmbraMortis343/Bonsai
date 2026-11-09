// Bonsai app shell: install button, update checks and the Update button.
(() => {
  const APP_VERSION = "__VERSION__";
  const $ = (id) => document.getElementById(id);
  const updateBar = $("updateBar"), updateBtn = $("updateBtn"), updateText = $("updateText");
  const checkMsg = $("checkMsg");
  let waitingWorker = null;

  // ---- Install ("Add to home screen" / desktop install) ----
  let installEvent = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; $("installBtn").hidden = false; });
  $("installBtn").addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    try { await installEvent.userChoice; } catch {}
    installEvent = null; $("installBtn").hidden = true;
  });
  window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });

  // ---- Updates ----
  async function latestVersion() {
    try {
      const r = await fetch("version.json", { cache: "no-store" });
      if (!r.ok) return null;
      return (await r.json()).version || null;
    } catch { return null; }
  }

  async function showUpdate(worker) {
    waitingWorker = worker;
    const v = await latestVersion();
    updateText.textContent = v ? `Bonsai ${v} is ready.` : "A new version is ready.";
    updateBtn.textContent = v ? `Update to ${v}` : "Update";
    updateBar.hidden = false;
    checkMsg.textContent = "";
  }

  updateBtn.addEventListener("click", () => {
    if (!waitingWorker) return;
    updateBtn.disabled = true; updateBtn.textContent = "Updating…";
    waitingWorker.postMessage("skipWaiting");
  });

  if (!("serviceWorker" in navigator)) {
    $("checkBtn").hidden = true;
    return;
  }

  // Reload only after the person tapped Update, not when the first install takes control.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !updateBtn.disabled) return; reloading = true; location.reload();
  });

  navigator.serviceWorker.register("sw.js").then((reg) => {
    const watch = (w) => w && w.addEventListener("statechange", () => {
      if (w.state === "installed" && navigator.serviceWorker.controller) showUpdate(w);
    });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));

    const check = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 60 * 60 * 1000);

    $("checkBtn").addEventListener("click", async () => {
      checkMsg.textContent = "Checking…";
      await check();
      const v = await latestVersion();
      if (reg.waiting || (v && v !== APP_VERSION)) {
        checkMsg.textContent = "";
        if (reg.waiting) showUpdate(reg.waiting);
        else checkMsg.textContent = `Bonsai ${v} is downloading…`;
      } else if (v === null) {
        checkMsg.textContent = "Couldn't reach the server. Try again when you're online.";
      } else {
        checkMsg.textContent = "You're on the latest version.";
      }
    });
  }).catch(() => { $("checkBtn").hidden = true; });
})();
