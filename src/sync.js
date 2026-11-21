// Sync between devices through Supabase (project "bonsai", Sydney; table public.rows, function public.push, in
// supabase/migrations). Sign in with an emailed 6-digit code, once per device. Every save on this device is noted
// in the outbox (store.js); sync sends those, then pulls what other devices sent since last time. The newer change
// wins, record by record. Bonsai Beta syncs on its own channel, so the demo never meets the real garden.
// Plain fetch to Supabase's REST and auth endpoints: no library, and it works the same in Bonsai Desktop.
import * as store from "./store.js";
import { CHANNEL } from "./channel.js";

const PREF = CHANNEL ? `bonsai-${CHANNEL}.sync.` : "bonsai.sync.";
const ls = { get: (k) => { try { return localStorage.getItem(PREF + k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(PREF + k) : localStorage.setItem(PREF + k, v); } catch {} } };
const URL0 = "https://afrejqhcfdqxrkxpqtla.supabase.co", KEY0 = "sb_publishable_dvXv8SVuOjNpiz6VBU3T6Q_Zn3-mpOB";
const base = () => ls.get("url") || URL0, key = () => ls.get("key") || KEY0;   // tests point these at a stand-in
const BATCH = 200, PAGE = 1000, OVERLAP = 5000, BYTES = 4_000_000;

const device = () => { let d = ls.get("device"); if (!d) { d = (navigator.userAgent.match(/Android|iPhone|iPad|Windows|Mac|Linux/)?.[0] || "device") + "-" + Math.random().toString(36).slice(2, 8); ls.set("device", d); } return d; };
let session = (() => { try { return JSON.parse(ls.get("session") || "null"); } catch { return null; } })();
const keep = (s) => { session = s; ls.set("session", s ? JSON.stringify(s) : null); };
export const signedIn = () => !!session?.refresh_token;
export const email = () => session?.email || "";
export const lastSync = () => Number(ls.get("at") || 0) || null;

async function call(path, { method = "GET", body, auth = true, prefer } = {}) {
  const headers = { apikey: key(), "content-type": "application/json" };
  if (auth) headers.authorization = "Bearer " + (await token());
  if (prefer) headers.prefer = prefer;
  const res = await fetch(base() + path, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) { const e = new Error(data?.msg || data?.message || data?.error_description || "Sync failed (" + res.status + ")"); e.status = res.status; e.data = data; throw e; }
  return data;
}
const fromAuth = (d, mail) => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user: d.user?.id, email: d.user?.email || mail });
async function token() {
  if (!session) throw Object.assign(new Error("Not signed in"), { status: 401 });
  if (Date.now() < session.expires_at - 60000) return session.access_token;
  try { keep(fromAuth(await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", auth: false, body: { refresh_token: session.refresh_token } }), session.email)); }
  catch (e) { if (e.status === 400 || e.status === 401) keep(null); throw e; }
  return session.access_token;
}

// ---------- signing in ----------
export async function sendCode(mail) { await call("/auth/v1/otp", { method: "POST", auth: false, body: { email: mail.trim(), create_user: true } }); }
export async function signIn(mail, code) {
  const d = await call("/auth/v1/verify", { method: "POST", auth: false, body: { type: "email", email: mail.trim(), token: String(code).trim() } });
  if (!d?.access_token) throw new Error("That code didn't work");
  keep(fromAuth(d, mail.trim()));
  if (ls.get("for") !== session.user) { ls.set("cursor", null); ls.set("for", session.user); }   // a first sync for this account: send everything here
  ls.set("full", "1");
  return syncNow();
}
export function signOut() { keep(null); ls.set("at", null); }

// ---------- syncing ----------
let running = null, changed = () => {}, failed = () => {};
// One run at a time. Asking while one is going queues one more after it (only one), so a change made during a run
// isn't missed; everyone asking then waits for that.
let queued = null;
export function syncNow() {
  if (!signedIn()) return Promise.resolve(null);
  if (!running) { running = run().finally(() => { running = null; }); return running; }
  return (queued ||= running.catch(() => {}).then(() => { queued = null; return syncNow(); }));
}
async function run() {
  const out = { sent: 0, got: 0, skipped: 0 };
  if (ls.get("full")) { await store.noteAll(); ls.set("full", null); }
  // send, a batch at a time; a batch that fails goes again row by row, so one bad record can't hold up the rest
  for (let round = 0; round < 50; round++) {
    const list = await store.pending(BATCH); if (!list.length) break;
    const row = (o) => ({ channel: CHANNEL || "", store: o.store, id: o.id, data: o.data, deleted: o.data == null, client_at: o.at, device: device() });
    // pictures (meta "file:…") are big: a request carries at most about BYTES
    const parts = []; let part = [], size = 0;
    for (const o of list) { const n = (JSON.stringify(o.data) || "").length + 200; if (part.length && size + n > BYTES) { parts.push(part); part = []; size = 0; } part.push(o); size += n; }
    if (part.length) parts.push(part);
    let stuck = false;
    for (const items of parts) {
      try { await call("/rest/v1/rpc/push", { method: "POST", body: { items: items.map(row) } }); await store.sent(items); out.sent += items.length; }
      catch (e) {
        if (e.status === 401 || !navigator.onLine || e instanceof TypeError) throw e;
        const ok = [];
        for (const o of items) { try { await call("/rest/v1/rpc/push", { method: "POST", body: { items: [row(o)] } }); ok.push(o); } catch { out.skipped++; } }
        await store.sent(ok); out.sent += ok.length;
        if (!ok.length) stuck = true;
      }
    }
    if (stuck) break;   // a part where nothing went: leave the rest for next time
    if (list.length < BATCH) break;
  }
  // pull what changed since last time (with a little overlap; applying twice changes nothing)
  let cursor = ls.get("cursor") || "1970-01-01T00:00:00Z";
  for (let page = 0; page < 100; page++) {
    const since = new Date(Date.parse(cursor) - OVERLAP).toISOString();
    const rows = await call(`/rest/v1/rows?select=store,id,data,deleted,client_at,updated_at&channel=eq.${encodeURIComponent(CHANNEL || "")}&updated_at=gt.${encodeURIComponent(since)}&order=updated_at.asc&limit=${PAGE}`);
    if (!rows?.length) break;
    out.got += await store.applyRemote(rows);
    const last = rows[rows.length - 1].updated_at; if (last <= cursor && rows.length < PAGE) break;
    cursor = last; ls.set("cursor", cursor);
    if (rows.length < PAGE) break;
  }
  ls.set("at", String(Date.now()));
  if (out.got) await changed(out);
  return out;
}

// Sync on start, a few seconds after each save, every minute while Bonsai is in view, when the network comes back,
// and when it's put away.
let timer = 0;
export function start({ onChange, onError } = {}) {
  changed = onChange || changed; failed = onError || failed;
  const go = () => syncNow().catch((e) => failed(e));
  const soon = () => { clearTimeout(timer); timer = setTimeout(go, 4000); };
  store.onWrite(() => { if (signedIn()) soon(); });
  addEventListener("online", go);
  document.addEventListener("visibilitychange", () => { if (signedIn()) go(); });
  setInterval(() => { if (signedIn() && document.visibilityState === "visible") go(); }, 60000);
  if (signedIn()) go();
}
