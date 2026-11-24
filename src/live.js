// The live Claude connection. In Bonsai Desktop (desktop/), the window has `window.bonsaiDesktop`, a bridge to
// Claude Code on this computer, which runs on the plan it's signed in with. Everywhere else (the phone, a
// browser) there's no bridge and the copy-and-paste round trip stays.
const D = typeof window !== "undefined" ? window.bonsaiDesktop : null;
export const desktop = !!D?.claude;
export const canSee = () => !!D?.features?.includes?.("images");   // Bonsai Desktop 0.2.0 and later can send pictures

const SYSTEM = "You are working inside Bonsai, a knowledge-retention app. The message says exactly what to reply with and in what format: reply with that and nothing else, no preamble or closing remarks.";

let last = null;
export async function liveStatus(force = false) {
  if (!desktop) return null;
  if (last && !force && Date.now() - last.at < 60000) return last.value;
  let value; try { value = await D.claude.status(force); } catch { value = { found: false }; }
  last = { at: Date.now(), value }; return value;
}
// What's wrong, in a line, or "" when Claude can be asked.
export function liveProblem(st) {
  if (!st || !st.found) return "Claude Code isn't on this computer. Install it from claude.com/code, then sign in.";
  if (!st.loggedIn) return "Claude Code isn't signed in. Open a terminal, run claude, and sign in with your Claude account.";
  return "";
}

let seq = 0;
// Ask Claude. onText gets the reply so far as it streams. Resolves { ok, text } or { ok: false, code, message }.
export function askClaude(prompt, { onText, system = SYSTEM, images } = {}) {
  const id = "q" + Date.now().toString(36) + (++seq);
  const off = D.claude.onEvent((e) => { if (e?.reqId === id && e.type === "text") onText?.(e.text); });
  const done = Promise.resolve(D.claude.ask({ reqId: id, system, prompt, ...(images?.length ? { images } : {}) })).catch((e) => ({ ok: false, code: "failed", message: e?.message || "That didn't go through." })).finally(() => off?.());
  return { done, cancel: () => D.claude.cancel(id) };
}

// A newer Bonsai Desktop on GitHub, if there is one: { latest, url } or null.
export async function desktopUpdate() { try { const u = await D?.update?.(); return u?.newer ? u : null; } catch { return null; } }

// ---------- Bonsai for Android (android/) ----------
// In the Android app the page has `window.bonsaiAndroid`, a bridge into the phone (MainActivity.Bridge): reminders
// for Today, the home-screen widget's numbers, what was shared into Bonsai, the clipboard and saving files. Its
// calls are synchronous and pass JSON as strings.
const A = typeof window !== "undefined" ? window.bonsaiAndroid : null;
const json = (s) => { try { return JSON.parse(s || "null"); } catch { return null; } };
export const android = !!A?.info;
export const androidInfo = () => (android ? json(A.info()) || {} : null);
// what's waiting for the page: { open: "today", share: { text, subject, images: [{ type, data }] } }
export const androidTake = () => (android ? json(A.take?.()) || {} : {});
export const reminders = () => (android ? json(A.reminders?.()) : null);
export const setReminders = (r) => (android ? json(A.setReminders?.(JSON.stringify(r))) : null);
let todaySent = "";
export function androidToday(t) {
  if (!android) return; const s = JSON.stringify(t); if (s === todaySent) return;
  todaySent = s; try { A.today?.(s); } catch {}
}

const RELEASES = "https://api.github.com/repos/UmbraMortis343/Bonsai/releases?per_page=30";
const newer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
// A newer Bonsai for Android on GitHub (releases tagged android-v1.2.3): { latest, url } or null.
export async function androidUpdate() {
  if (!android) return null;
  try {
    const mine = androidInfo()?.version || "0.0.0";
    const res = await fetch(RELEASES, { headers: { accept: "application/vnd.github+json" } }); if (!res.ok) return null;
    const rel = (await res.json()).filter((r) => /^android-v\d+\.\d+\.\d+$/.test(r.tag_name) && !r.draft).map((r) => ({ v: r.tag_name.slice(9), url: r.html_url })).sort((a, b) => (newer(a.v, b.v) ? -1 : 1))[0];
    return rel && newer(rel.v, mine) ? { latest: rel.v, url: rel.url } : null;
  } catch { return null; }
}

// Save a file the page made. A WebView can't download a blob: in the Android app it goes to Downloads/Bonsai
// through the bridge; elsewhere through a link, as before.
export async function saveBlob(blob, name) {
  if (android && A.save) {
    const u = new Uint8Array(await blob.arrayBuffer()); let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return !!A.save(name, blob.type || "", btoa(s));
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return true;
}

// The WebView's clipboard can refuse text; the bridge's never does.
if (android && A.copy && typeof navigator !== "undefined" && navigator.clipboard) {
  const write = navigator.clipboard.writeText?.bind(navigator.clipboard);
  try { Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async (t) => { if (A.copy(String(t))) return; if (write) return write(t); throw new Error("Not copied"); } }); } catch {}
}
// Links out of Bonsai open in the phone's browser (window.open in a WebView can't be relied on to).
if (android && A.open && typeof window !== "undefined") {
  const open = window.open.bind(window);
  window.open = (url, target, features) => {
    try { const u = new URL(String(url), location.href); if (/^https?:$/.test(u.protocol) && !u.href.startsWith(new URL(".", location.href).href.replace(/beta\/$/, ""))) { A.open(u.href); return null; } } catch {}
    return open(url, target, features);
  };
}
