// A stand-in for Supabase's auth and REST endpoints as sync.js uses them: email codes (always 123456), sessions,
// and the rows table with push()'s rule that a change only lands if it's as new as what's there. Holds everything
// in memory. Items with id "reject-me" make a batch fail, to check one bad record can't hold up the rest.
import { createServer } from "node:http";

export function fakeSupabase(port) {
  const rows = new Map(), codes = new Map(), log = [];
  let tick = Date.parse("2026-01-01T00:00:00Z");
  const userOf = (req) => { const t = (req.headers.authorization || "").replace("Bearer ", ""); return t.startsWith("tok-") ? t.slice(4) : null; };
  const server = createServer(async (req, res) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type, prefer", "access-control-allow-methods": "GET, POST, OPTIONS" };
    const send = (code, body) => { res.writeHead(code, { ...cors, "content-type": "application/json" }); res.end(body == null ? "" : JSON.stringify(body)); };
    if (req.method === "OPTIONS") return send(204);
    let raw = ""; for await (const c of req) raw += c; const body = raw ? JSON.parse(raw) : null;
    const url = new URL(req.url, "http://x"); log.push(req.method + " " + url.pathname);
    if (url.pathname === "/auth/v1/otp") { codes.set(body.email, "123456"); return send(200, {}); }
    if (url.pathname === "/auth/v1/verify") {
      if (codes.get(body.email) !== body.token) return send(403, { msg: "Token has expired or is invalid" });
      return send(200, { access_token: "tok-" + body.email, refresh_token: "ref-" + body.email, expires_in: 3600, user: { id: "u-" + body.email, email: body.email } });
    }
    if (url.pathname === "/auth/v1/token") { const e = String(body.refresh_token).replace("ref-", ""); return send(200, { access_token: "tok-" + e, refresh_token: "ref-" + e, expires_in: 3600, user: { id: "u-" + e, email: e } }); }
    const user = userOf(req); if (!user) return send(401, { message: "JWT expired" });
    if (url.pathname === "/rest/v1/rpc/push") {
      if (body.items.some((i) => i.id === "reject-me")) return send(400, { message: "bad row" });
      let n = 0;
      for (const i of body.items) {
        const k = [user, i.channel, i.store, i.id].join("|"), cur = rows.get(k);
        if (cur && i.client_at < cur.client_at) continue;
        rows.set(k, { user, channel: i.channel, store: i.store, id: i.id, data: i.data, deleted: !!i.deleted, client_at: i.client_at, device: i.device, updated_at: new Date((tick += 10)).toISOString() }); n++;
      }
      return send(200, n);
    }
    if (url.pathname === "/rest/v1/rows") {
      const channel = (url.searchParams.get("channel") || "").replace(/^eq\./, ""), since = (url.searchParams.get("updated_at") || "gt.1970").replace(/^gt\./, ""), limit = Number(url.searchParams.get("limit") || 1000);
      const out = [...rows.values()].filter((r) => r.user === user && r.channel === channel && r.updated_at > since).sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1)).slice(0, limit)
        .map(({ store, id, data, deleted, client_at, updated_at }) => ({ store, id, data, deleted, client_at, updated_at }));
      return send(200, out);
    }
    send(404, { message: "no such route" });
  });
  return new Promise((ok) => server.listen(port, () => ok({ rows, log, close: () => server.close() })));
}
