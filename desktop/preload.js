// The only bridge between the Bonsai page and this computer. The main process also checks every call comes
// from Bonsai's own pages. The page reads it as window.bonsaiDesktop (src/live.js).
const { contextBridge, ipcRenderer } = require("electron");
const invoke = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
const beta = process.argv?.includes?.("--beta") || false;

contextBridge.exposeInMainWorld("bonsaiDesktop", {
  version: "", channel: beta ? "beta" : "", features: ["images"],
  info: () => invoke("desktop:info"),
  update: () => invoke("desktop:update"),
  claude: {
    status: (force) => invoke("claude:status", !!force),
    ask: (req) => invoke("claude:ask", req),
    cancel: (id) => invoke("claude:cancel", id),
    onEvent: (fn) => { const h = (_e, ev) => fn(ev); ipcRenderer.on("claude:event", h); return () => ipcRenderer.removeListener("claude:event", h); },
  },
});
