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
