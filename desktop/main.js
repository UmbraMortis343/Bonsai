// Bonsai Desktop: a window on the live Bonsai (or Bonsai Beta with --beta), so the app updates itself as it
// does on the web, plus the one thing a web page can't do: ask Claude Code on this computer, on his plan.
// The page reaches that only through preload.js, and only when the page is Bonsai's own.
const { app, BrowserWindow, ipcMain, shell, net, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const claude = require("./claude");

const BETA = process.argv.includes("--beta");
const SITE = process.env.BONSAI_URL || "https://umbramortis343.github.io/Bonsai/";
const START = BETA ? new URL("beta/", SITE).href : SITE;
const ORIGIN = new URL(SITE).origin, ROOT = new URL(SITE).pathname;   // only pages under here are Bonsai's
const RELEASES = "https://api.github.com/repos/UmbraMortis343/Bonsai/releases?per_page=30";

// Bonsai and Bonsai Beta keep their own window, storage and single-instance lock.
if (BETA) { app.setName("Bonsai Beta"); app.setPath("userData", app.getPath("userData") + " Beta"); }
if (process.env.BONSAI_DATA) app.setPath("userData", process.env.BONSAI_DATA);   // tests
claude.setDataDir(app.getPath("userData"));
if (!app.requestSingleInstanceLock()) app.quit();

const ours = (url) => { try { const u = new URL(url); return u.origin === ORIGIN && u.pathname.startsWith(ROOT); } catch { return false; } };
const fromUs = (e) => ours(e.senderFrame?.url || "");

const boundsFile = () => path.join(app.getPath("userData"), "window.json");
function savedBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), "utf8"));
    if (screen.getAllDisplays().some((d) => b.x < d.bounds.x + d.bounds.width && b.x + b.width > d.bounds.x && b.y < d.bounds.y + d.bounds.height && b.y + b.height > d.bounds.y)) return b;
  } catch {}
  return { width: 1280, height: 820 };
}

let win = null;
function offline(url) {
  const html = `<!DOCTYPE html><meta charset="utf-8"><title>Bonsai</title><style>body{font:15px system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#fff;color:#1d1d1b}@media(prefers-color-scheme:dark){body{background:#151514;color:#ebeae6}}a{color:#3e7a4b}</style><p>Bonsai can't be reached. <a href="${url}">Try again</a></p>`;
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}
function open() {
  const b = savedBounds();
  win = new BrowserWindow({
    ...b, minWidth: 720, minHeight: 480, show: false, autoHideMenuBar: true, backgroundColor: "#ffffff", title: BETA ? "Bonsai Beta" : "Bonsai",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  if (b.max) win.maximize();
  win.setMenu(null);
  win.once("ready-to-show", () => win.show());
  const keep = () => { if (win.isMinimized()) return; const r = win.getNormalBounds(); try { fs.writeFileSync(boundsFile(), JSON.stringify({ ...r, max: win.isMaximized() })); } catch {} };
  win.on("close", keep);
  // Links out of Bonsai open in the browser; Bonsai's own pages stay here.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!ours(url) && !url.startsWith("data:")) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.webContents.on("did-fail-load", (_e, code, _d, url, main) => { if (main && code !== -3 && ours(url)) offline(url); });
  win.webContents.on("before-input-event", (e, i) => {
    if (i.type !== "keyDown") return;
    if ((i.control && i.key.toLowerCase() === "r") || i.key === "F5") { e.preventDefault(); win.webContents.reload(); }
    else if (i.control && i.shift && i.key.toLowerCase() === "i") { e.preventDefault(); win.webContents.toggleDevTools(); }
    else if (i.key === "F11") { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });
  win.loadURL(START);
}

// ---------- the bridge ----------
ipcMain.handle("desktop:info", (e) => (fromUs(e) ? { version: app.getVersion(), channel: BETA ? "beta" : "" } : null));
ipcMain.handle("claude:status", (e, force) => (fromUs(e) ? claude.status(!!force) : { found: false }));
ipcMain.handle("claude:ask", (e, req) => {
  if (!fromUs(e)) return { ok: false, code: "refused", message: "Not from Bonsai." };
  const to = e.sender;
  const images = (Array.isArray(req?.images) ? req.images : []).slice(0, 4).filter((i) => /^image\/(png|jpeg|webp)$/.test(i?.media_type) && typeof i.data === "string" && i.data.length < 14e6).map((i) => ({ media_type: i.media_type, data: i.data }));
  return claude.ask({ reqId: String(req?.reqId || ""), system: String(req?.system || ""), prompt: String(req?.prompt || ""), images }, (ev) => { if (!to.isDestroyed()) to.send("claude:event", ev); });
});
ipcMain.handle("claude:cancel", (e, id) => { if (fromUs(e)) claude.cancel(String(id)); });
// A newer Bonsai Desktop on GitHub (releases tagged desktop-v1.2.3).
const newer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
ipcMain.handle("desktop:update", async (e) => {
  if (!fromUs(e) || process.env.BONSAI_URL) return null;
  try {
    const res = await net.fetch(RELEASES, { headers: { accept: "application/vnd.github+json" } }); if (!res.ok) return null;
    const rel = (await res.json()).filter((r) => /^desktop-v\d+\.\d+\.\d+$/.test(r.tag_name) && !r.draft).map((r) => ({ v: r.tag_name.slice(9), url: r.html_url })).sort((a, b) => (newer(a.v, b.v) ? -1 : 1))[0];
    return rel ? { latest: rel.v, url: rel.url, newer: newer(rel.v, app.getVersion()) } : null;
  } catch { return null; }
});

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(open);
app.on("window-all-closed", () => app.quit());
