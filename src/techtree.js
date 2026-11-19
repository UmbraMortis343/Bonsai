// Bonsai: the tech tree. A flat map of everything you know, in the app's own colours, light or dark, with tapered arms.
// Tree: everything at once, in rings round the start. Islands that grow from nothing sit on the first ring, each
// with its key ideas (the first ideas of its knowledge graphs) fanned out past it and the islands that grow from it
// further out. Click to pick, right-click (or Space) to open or close what's under a thing, double-click (or Enter)
// to put a thing in the middle with what's under it round it; Esc steps back out to the whole tree.
// Web: every idea at once, laid out by its connections, clustered by island; drag to reshape, positions kept.
// Drawn on a 2D canvas: circles joined by tapered arms. Positions scale with zoom; dots and words keep their size.

export const HUES = ["#378ADD", "#7F77DD", "#1D9E75", "#D85A30", "#D4537E", "#BA7517", "#0F9BA8", "#639922"];
const TAU = Math.PI * 2, LABEL = 150;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (a) => ((a % TAU) + TAU) % TAU;
const FONT = { isle: '600 13px system-ui,"Segoe UI",Roboto,sans-serif', key: '600 12px system-ui,"Segoe UI",Roboto,sans-serif', idea: '500 11.5px system-ui,"Segoe UI",Roboto,sans-serif', num: '600 10.5px system-ui,"Segoe UI",Roboto,sans-serif' };

// a topic's colour: its island's, turned a little per topic so topics on one island can be told apart
export function shade(hex, k) {
  if (!k) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0; const s = d ? (l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)) : 0;
  if (d) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : mx === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  h = (h + (k % 2 ? 1 : -1) * 0.022 * Math.ceil(k / 2) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return "#" + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function createTechTree({ host, saved = {}, onSelect = () => {}, onOpen = () => {}, onHover = () => {}, onState = () => {}, onLayout = () => {} }) {
  const cv = document.createElement("canvas"); cv.setAttribute("aria-label", "Tech tree"); host.append(cv);
  const ctx = cv.getContext("2d");
  let W = 1, H = 1, dpr = 1, active = false, raf = 0, last = 0, C = colours();
  let mode = saved.mode === "web" ? "web" : "tree";
  // what shows: islands are open unless shut, ideas are shut unless open (or all); root is what's in the middle
  const open = new Set(saved.open || []), shut = new Set(saved.shut || []);
  let all = !!saved.all, loose = saved.loose !== false, root = "i:start", roots = [], pick = null, hov = null, framedOnce = false;
  const view = { x: 0, y: 0, k: 1 }, goal = { x: 0, y: 0, k: 1, on: false };
  let N = new Map(), topics = [], isles = [], byIsle = new Map(), raw = [], START = null, H2 = new Map();
  let P = new Map(), E = [], rings = [], nums = new Map();
  let wpairs = [], alpha = 0, settled = true, drag = null, auto = false, frames = 0;
  let pos = saved.pos || {}; const pin = new Set(saved.pin || []);
  const widths = new Map();

  function colours() {
    const css = getComputedStyle(document.body), v = (k, d) => css.getPropertyValue(k).trim() || d;
    return { bg: v("--bg", "#f8fafc"), card: v("--card", "#fff"), ink: v("--ink", "#0f172a"), muted: v("--muted", "#64748b"), ring: v("--ring", "#cbd5e1"), sap: v("--sap", "#d97706"), accent: v("--accent", "#3d6a37") };
  }
  function fit(text, font, max) {
    const key = font + "|" + max + "|" + text; if (widths.has(key)) return widths.get(key);
    ctx.font = font; let s = text, w = ctx.measureText(s).width;
    if (w > max) { while (s.length > 1 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1); s = s.trimEnd() + "…"; w = ctx.measureText(s).width; }
    const r = { s, w }; widths.set(key, r); return r;
  }

  // ---------- data ----------
  function setData(d) {
    const old = N; N = new Map(); C = colours(); widths.clear();
    isles = d.islands.map((q, i) => ({ id: q.id, key: "i:" + q.id, name: q.name, afterId: q.after || null, fromId: q.from || null, i, hue: HUES[i % HUES.length], topics: [], kids: [], keys: [] }));
    byIsle = new Map(isles.map((q) => [q.id, q]));
    START = { id: "start", key: "i:start", name: "Start", start: true, topics: [], kids: [], keys: [], hue: C.ink };
    const rec = (id, o) => { const p = old.get(id); const r = { id, kids: [], parent: null, x: 0, y: 0, wx: 0, wy: 0, vx: 0, vy: 0, ...o }; if (p) for (const k of ["wx", "wy", "wplaced"]) r[k] = p[k]; N.set(id, r); return r; };
    topics = d.topics.map((t) => { const q = isles[t.isle] || isles[0], r = rec("z:" + t.id, { kind: "topic", zoneId: t.id, title: t.name, isle: q, depth: -1, growth: t.growth || 0, mist: !!t.mist }); r.hue = shade(q.hue, q.topics.length); r.slot = q.topics.length; r.top = r; q.topics.push(r); return r; });
    const treeOf = new Map(d.trees.map((t) => [t.id, t])), byParent = new Map();
    for (const n of d.nodes) { const t = treeOf.get(n.treeId), top = t && N.get("z:" + t.zoneId); if (!top) continue; rec(n.id, { kind: "idea", title: n.title || "Untitled", note: n.note || "", st: n.st || "ok", treeId: n.treeId, zoneId: t.zoneId, top, isle: top.isle, hue: top.hue, src: n }); }
    for (const n of d.nodes) { const r = N.get(n.id); if (!r) continue; const pid = n.parentId != null && N.has(n.parentId) ? n.parentId : r.top.id; if (!byParent.has(pid)) byParent.set(pid, []); byParent.get(pid).push(r); }
    const treeAt = new Map(d.trees.map((t, i) => [t.id, i])), by = (a, b) => (a.parentId ? 0 : treeAt.get(a.treeId) - treeAt.get(b.treeId)) || (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt));
    for (const [pid, kids] of byParent) { const p = N.get(pid); kids.sort((a, b) => by(a.src, b.src)); p.kids = kids; for (const k of kids) k.parent = p; }
    const walk = (n, depth) => { n.depth = depth; let h = 0; for (const k of n.kids) h = Math.max(h, 1 + walk(k, depth + 1)); n.height = h; return h; };
    for (const t of topics) walk(t, -1);
    for (const r of N.values()) delete r.src;
    for (const q of isles) q.keys = q.topics.flatMap((t) => t.kids);
    // which island each grows from; a loop is broken where it closes
    for (const q of isles) { q.after = byIsle.get(q.afterId) || null; if (q.after === q) q.after = null; }
    for (const q of isles) { const seen = new Set([q]); let u = q.after; while (u) { if (seen.has(u)) { q.after = null; break; } seen.add(u); u = u.after; } }
    for (const q of isles) { const f = N.get(q.fromId); q.from = f && q.after && f.isle === q.after ? f : null; (q.after || START).kids.push(q); }
    raw = d.links.filter((l) => N.has(l.fromId) && N.has(l.toId) && l.fromId !== l.toId).map((l) => ({ a: N.get(l.fromId), b: N.get(l.toId), label: l.label || "" }));
    for (const id of [...open]) if (!N.has(id)) open.delete(id);
    // the tree as one hierarchy: the start, then islands; an island holds its key ideas and the islands that grow from it
    H2 = new Map();
    const node = (key, o) => { const r = { key, kids: [], parent: null, ...o }; H2.set(key, r); return r; };
    const isleNode = (q) => { const r = node(q.key, { kind: q.start ? "start" : "isle", q, hue: q.hue }); return r; };
    const ideaNode = (rec, par) => { const r = node(rec.id, { kind: rec.depth === 0 ? "key" : "idea", rec, q: rec.isle, hue: rec.hue, parent: par }); r.kids = rec.kids.map((k) => ideaNode(k, r)); return r; };
    // an island that grows from one of these ideas sits straight after that idea's own slice, so its line stays short
    const keyOf = (f) => { while (f && f.depth > 0) f = f.parent; return f; };
    const build = (q, par) => {
      const r = isleNode(q); r.parent = par; const later = q.kids.filter((c) => !c.from), after = new Map();
      for (const c of q.kids) if (c.from) { const k = keyOf(c.from)?.id; if (!after.has(k)) after.set(k, []); after.get(k).push(c); }
      r.kids = [];
      for (const k of q.keys) { r.kids.push(ideaNode(k, r)); for (const c of after.get(k.id) || []) r.kids.push(build(c, r)); }
      for (const c of later) r.kids.push(build(c, r));
      return r;
    };
    build(START, null);
    if (!H2.has(root)) { root = "i:start"; roots = []; }
    roots = roots.filter((k) => H2.has(k));
    layout();
    if (mode === "web") webStart(false);
    if (!framedOnce) { framedOnce = true; home(true); }
    kick();
  }
  const isleOf = (id) => (id === "start" ? START : byIsle.get(id));
  const hasKids = (h) => h.kids.length > 0;
  const isOpen = (h) => (h.kind === "start" || h.kind === "isle" ? !shut.has(h.key) : all || open.has(h.key)) || h.key === root;

  // ---------- tree layout ----------
  // A radial tree: each thing gets a slice of the circle in proportion to what shows under it, and sits a step
  // further out than what it hangs from. Islands take a long step, key ideas a middle one, ideas a short one.
  const GAPS = { start: 0, isle: 150, key: 105, idea: 62 };
  function layout() {
    const r0 = H2.get(root) || H2.get("i:start"), T = new Map(); E = []; rings = [];
    const shown = (h) => (isOpen(h) ? h.kids : []);
    const leaves = new Map(); const count = (h) => { const ks = shown(h); const n = ks.length ? ks.reduce((s, k) => s + count(k), 0) : 1; leaves.set(h.key, n); return n; }; count(r0);
    // depth radii, grown until neighbours on the outermost ring are far enough apart
    const rad = new Map(); const reach = (h, r) => { rad.set(h.key, r); for (const k of shown(h)) reach(k, r + GAPS[k.kind] * (h === r0 && k.kind !== "isle" ? 1.2 : 1)); }; reach(r0, 0);
    // each thing needs about 26px of its ring to itself
    let scale = 1; const tot = leaves.get(r0.key); for (const [key, n] of leaves) { const r = rad.get(key); if (r) scale = Math.max(scale, 26 / (((TAU * n) / tot) * r)); }
    scale = Math.min(scale, 4);
    const place = (h, a0, a1) => {
      const a = (a0 + a1) / 2, r = rad.get(h.key) * scale;
      T.set(h.key, { key: h.key, h, tx: r * Math.cos(a), ty: r * Math.sin(a), ang: a, kind: h.kind });
      let s = a0; const ks = shown(h), tot = leaves.get(h.key);
      for (const k of ks) { const w = ((a1 - a0) * leaves.get(k.key)) / tot; place(k, s, s + w); s += w; }
    };
    place(r0, -Math.PI / 2, -Math.PI / 2 + TAU);
    // the middle sits in the middle; islands mark rings
    const mid = T.get(r0.key); mid.tx = 0; mid.ty = 0;
    const rr = new Set(); for (const x of T.values()) if (x.kind === "isle" && x.key !== r0.key) rr.add(Math.round(Math.hypot(x.tx, x.ty))); rings = [...rr].sort((a, b) => a - b);
    for (const x of T.values()) if (x.h.parent && T.has(x.h.parent.key) && x.key !== r0.key) {
      const from = x.kind === "isle" && x.h.q.from && T.has(x.h.q.from.id) ? x.h.q.from.id : x.h.parent.key;   // an island grows out of the idea it comes from, when that shows
      E.push({ a: from, b: x.key, hue: x.h.hue, kind: x.kind === "isle" ? "grow" : "branch" });
    }
    // numbers: what's round the middle
    nums = new Map(); let k = 1; for (const c of shown(r0)) if (k <= 9) nums.set(c.key, k++);
    // carry positions over so things move rather than jump; new things grow out of their parent
    for (const [key, x] of T) {
      const o = P.get(key); if (o) { x.x = o.x; x.y = o.y; x.a = o.a; continue; }
      let par = x.h.parent; while (par && !P.has(par.key)) par = par.parent;
      const pp = par && P.get(par.key); x.x = pp ? pp.x : x.tx; x.y = pp ? pp.y : x.ty; x.a = pp ? 0 : 1;
    }
    P = T;
    // links between ideas, drawn between whatever is showing: an idea, or the nearest thing above it that shows
    const showing = (r) => { let h = H2.get(r.id) || H2.get(r.isle?.key); while (h && !P.has(h.key)) h = h.parent; return h ? h.key : null; };
    const m = new Map();
    for (const l of raw) { const a = showing(l.a), b = showing(l.b); if (!a || !b || a === b) continue; const kk = a < b ? a + "|" + b : b + "|" + a; const p = m.get(kk) || { a, b, n: 0, label: "", direct: false, ha: l.a.hue, hb: l.b.hue }; p.n++; if (a === l.a.id && b === l.b.id) { p.direct = true; p.label ||= l.label; } m.set(kk, p); }
    for (const p of m.values()) E.push({ ...p, kind: "link" });
    if (pick && !P.has(pick)) pick = null;
  }

  // ---------- frame ----------
  function frame(t) {
    raf = 0; const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    let moving = false; const e = 1 - Math.exp(-dt * 10);
    if (mode === "tree") {
      for (const x of P.values()) {
        x.x += (x.tx - x.x) * e; x.y += (x.ty - x.y) * e; x.a += (1 - x.a) * Math.min(1, e * 1.4);
        if (Math.abs(x.tx - x.x) > 0.3 || Math.abs(x.ty - x.y) > 0.3 || x.a < 0.99) moving = true; else { x.x = x.tx; x.y = x.ty; x.a = 1; }
      }
    } else if (drag && !loose) { for (const r of N.values()) { r.x = r.wx; r.y = r.wy; } }
    else if (alpha > 0.015 || drag) {
      for (let i = 0; i < 2; i++) tick(); for (const r of N.values()) { r.x = r.wx; r.y = r.wy; } moving = true;
      if (auto && !drag && ++frames % 6 === 0) home();
    } else if (!settled) { settled = true; saveLayout(); }
    if (goal.on) {
      for (const k of ["x", "y", "k"]) view[k] += (goal[k] - view[k]) * e;
      if (Math.abs(goal.x - view.x) + Math.abs(goal.y - view.y) < 0.5 && Math.abs(goal.k - view.k) < 0.002) { Object.assign(view, { x: goal.x, y: goal.y, k: goal.k }); goal.on = false; } else moving = true;
    }
    draw();
    if (moving && active) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  // ---------- drawing ----------
  const SX = (x) => x * view.k + view.x, SY = (y) => y * view.k + view.y;
  const parse = (c) => { c = String(c).trim(); if (c[0] === "#") { const n = parseInt(c.length === 4 ? c.slice(1).split("").map((d) => d + d).join("") : c.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; } const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255]; };
  const mix = (a, b, t) => { const p = parse(a), q = parse(b); return "#" + p.map((x, i) => Math.round(clamp(x + (q[i] - x) * t, 0, 255)).toString(16).padStart(2, "0")).join(""); };
  const dark = () => { const [r, g, b] = parse(C.bg); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45; };
  const hsh = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  // an arm: tapered, bowed a little, filled flat
  function arm(x0, y0, x1, y1, w0, w1, bend) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, mx = (x0 + x1) / 2 - (dy / L) * bend * L, my = (y0 + y1) / 2 + (dx / L) * bend * L;
    const n = clamp(Math.round(L / 8), 5, 40), left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t, px = u * u * x0 + 2 * u * t * mx + t * t * x1, py = u * u * y0 + 2 * u * t * my + t * t * y1;
      let tx = u * (mx - x0) + t * (x1 - mx), ty = u * (my - y0) + t * (y1 - my); const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const w = ((w0 + (w1 - w0) * Math.pow(t, 0.7)) * (1 + 0.6 * Math.pow(u, 8))) / 2;
      left.push([px - ty * w, py + tx * w]); right.push([px + ty * w, py - tx * w]);
    }
    ctx.beginPath(); left.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](x, y)); for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath(); ctx.fill();
  }
  const armColour = (hue) => mix(hue, "#000000", dark() ? 0.12 : 0.38);
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (mode === "web") drawWeb(); else drawTree();
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.textAlign = "left";
  }
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fill(); };
  const ring = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.stroke(); };
  const box = (x, y, w, h) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 4); else ctx.rect(x, y, w, h); ctx.fill(); };
  function halo(s, x, y, colour) { ctx.lineJoin = "round"; ctx.strokeStyle = C.bg; ctx.lineWidth = 3.5; ctx.strokeText(s, x, y); ctx.fillStyle = colour; ctx.fillText(s, x, y); }
  const radiusOf = (x) => (x.kind === "start" ? 9 : x.kind === "isle" ? (x.key === root ? 20 : 14) : x.kind === "key" ? (x.key === root ? 13 : 8.5) : x.key === root ? 11 : 4);
  const titleOf = (x) => (x.kind === "start" || x.kind === "isle" ? x.h.q.name : x.h.rec.title);

  function drawTree() {
    const k = view.k, inView = (x, y, m = 60) => x > -m && x < W + m && y > -m && y < H + m, focusKey = hov || pick, z = clamp(k, 0.5, 1.5);
    // the rings islands sit on, round the middle
    ctx.strokeStyle = C.ring; ctx.lineWidth = 1; ctx.globalAlpha = 0.7; for (const r of rings) ring(SX(0), SY(0), r * k); ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    for (const e of E) {
      if (e.kind === "link") continue;
      const a = P.get(e.a), b = P.get(e.b); if (!a || !b) continue;
      const x0 = SX(a.x), y0 = SY(a.y), x1 = SX(b.x), y1 = SY(b.y); if (!inView(x0, y0, 400) && !inView(x1, y1, 400)) continue;
      // arms: tapered, bowed a little, filled flat and dark; thicker the nearer the middle
      ctx.globalAlpha = Math.min(a.a, b.a);
      const d = b.h.rec?.depth ?? 0, w = e.kind === "grow" ? [3.4, 2.6] : b.kind === "key" ? [4, 2.2] : [Math.max(1.4, 2.6 - 0.4 * d), Math.max(0.9, 1.5 - 0.3 * d)];
      ctx.fillStyle = armColour(e.hue); arm(x0, y0, x1, y1, w[0] * z, w[1] * z, ((hsh(e.a + e.b) % 1000) / 1000 - 0.5) * (e.kind === "grow" ? 0.12 : 0.28));
    }
    ctx.globalAlpha = 1;
    for (const e of E) {
      if (e.kind !== "link") continue;
      const a = P.get(e.a), b = P.get(e.b); if (!a || !b || a.a < 0.4 || b.a < 0.4) continue;
      const on = focusKey && (e.a === focusKey || e.b === focusKey), dim = focusKey && !on;
      const x0 = SX(a.x), y0 = SY(a.y), x1 = SX(b.x), y1 = SY(b.y), mx = (x0 + x1) / 2 - (y1 - y0) * 0.15, my = (y0 + y1) / 2 + (x1 - x0) * 0.15;
      const g = ctx.createLinearGradient(x0, y0, x1, y1), al = dim ? 0.08 : on ? 0.95 : 0.28; g.addColorStop(0, rgba(e.ha, al)); g.addColorStop(1, rgba(e.hb, al));
      ctx.strokeStyle = g; ctx.lineWidth = Math.min(4, 1 + Math.log2(e.n) * 0.8) * (on ? 1.3 : 1); ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke(); ctx.setLineDash([]);
      if (on && e.direct && e.label) { ctx.font = "italic 500 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; halo(e.label, (x0 + 2 * mx + x1) / 4, (y0 + 2 * my + y1) / 4 - 7, C.sap); ctx.textAlign = "left"; }
    }
    // things: circles; a thing with more under it that isn't showing has a second ring
    for (const x of [...P.values()].sort((a, b) => (a.key === pick) - (b.key === pick))) {
      const sx = SX(x.x), sy = SY(x.y); if (!inView(sx, sy)) continue;
      const hue = x.h.hue, r = radiusOf(x), n = nums.get(x.key), folded = hasKids(x.h) && !isOpen(x.h), st = x.h.rec?.st;
      ctx.globalAlpha = x.a;
      if (x.kind === "start") { ctx.fillStyle = C.ink; dot(sx, sy, r); }
      else if (x.kind === "isle") { ctx.fillStyle = C.card; dot(sx, sy, r); ctx.fillStyle = rgba(hue, 0.22); dot(sx, sy, r); ctx.strokeStyle = hue; ctx.lineWidth = 2.2; ring(sx, sy, r); }
      else if (st === "ghost") { ctx.fillStyle = C.card; dot(sx, sy, r); ctx.setLineDash([2.5, 2.5]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2; ring(sx, sy, r); ctx.setLineDash([]); }   // not shown in an exam yet
      else { ctx.fillStyle = x.kind === "key" && !folded && hasKids(x.h) ? hue : x.kind === "key" ? C.card : hue; dot(sx, sy, r); ctx.strokeStyle = x.kind === "key" ? armColour(hue) : hue; ctx.lineWidth = x.kind === "key" ? 1.6 : 1.1; ring(sx, sy, r); }
      if (st && st !== "ok" && st !== "ghost") { ctx.fillStyle = C.sap; dot(sx + r * 0.75, sy - r * 0.75, x.kind === "idea" ? 1.8 : 2.4); }   // due for watering
      if (folded && x.kind === "isle") { ctx.strokeStyle = hue; ctx.lineWidth = 1; ctx.globalAlpha = x.a * 0.7; ring(sx, sy, r + 3.5); ctx.globalAlpha = x.a; }   // an island with its ideas tucked away
      if (n) {
        ctx.font = FONT.num; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (x.kind === "isle" || x.kind === "key") { ctx.fillStyle = x.kind === "key" && !(hasKids(x.h) && !folded) ? hue : C.ink; ctx.fillText(String(n), sx, sy + 0.5); }
        else { const bx = sx + r + 5, by = sy - r - 5; ctx.fillStyle = C.card; dot(bx, by, 7); ctx.strokeStyle = hue; ctx.lineWidth = 1; ring(bx, by, 7); ctx.fillStyle = C.ink; ctx.fillText(String(n), bx, by + 0.5); }
        ctx.textAlign = "left";
      }
      if (x.key === pick) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ring(sx, sy, r + (folded ? 7.5 : 5)); }
      ctx.globalAlpha = 1;
    }
    // words, most important first; any that would land on one already placed are left out
    const boxes = [], free = (b) => boxes.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
    const rank = (x) => (x.key === pick ? 0 : x.key === hov ? 1 : x.key === root ? 2 : x.kind === "isle" || x.kind === "start" ? 3 : x.kind === "key" ? 4 : x.h.parent?.key === pick || x.h.parent?.key === root ? 5 : 6);
    for (const x of [...P.values()].sort((a, b) => rank(a) - rank(b))) {
      const sx = SX(x.x), sy = SY(x.y); if (!inView(sx, sy)) continue;
      if (x.kind === "idea" && rank(x) > 5 && k < 0.9) continue;   // little ideas only when you're close, or near what's picked
      const font = x.kind === "isle" || x.kind === "start" ? FONT.isle : x.kind === "key" ? FONT.key : FONT.idea, f = fit(titleOf(x), font, LABEL), r = radiusOf(x);
      let lx, ly = sy;
      if (x.key === root || x.kind === "start") { lx = sx - f.w / 2; ly = sy + r + 13; }
      else { const right = Math.cos(x.ang) >= -0.05, g = r + 6; lx = right ? sx + g : sx - g - f.w; }   // words sit on the outer side
      const b = { x0: lx - 3, y0: ly - 8, x1: lx + f.w + 3, y1: ly + 8 };
      if (rank(x) > 2 && !free(b)) continue; boxes.push(b);
      ctx.globalAlpha = x.a; ctx.font = font; ctx.textBaseline = "middle";
      if (x.key === pick) { halo(f.s, lx, ly + 0.5, C.ink); ctx.fillStyle = C.accent; ctx.fillRect(lx, ly + 8, f.w, 2); }   // the pick: the same name, underlined
      else halo(f.s, lx, ly + 0.5, x.kind === "idea" ? C.muted : C.ink);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- web: everything, by its connections ----------
  let rnd = 1; const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const sub = (n) => { const o = []; const go = (x) => { for (const k of x.kids) { o.push(k); go(k); } }; go(n); return o; };
  function webStart(reset) {
    if (reset) { pos = {}; pin.clear(); for (const r of N.values()) r.wplaced = false; }
    rnd = 7; const n = isles.length || 1, R = n > 1 ? 150 * Math.sqrt(n) + 140 : 0;
    isles.forEach((q, i) => { const a = (i / n) * TAU - Math.PI / 2; q.cx = R * Math.cos(a); q.cy = R * Math.sin(a); });
    let fresh = 0;
    const put = (r, x, y) => { const p = pos[r.id]; if (p) { r.wx = p[0]; r.wy = p[1]; } else if (!r.wplaced) { r.wx = x; r.wy = y; fresh++; } r.wplaced = true; r.vx = r.vy = 0; r.pin = pin.has(r.id); };
    for (const q of isles) q.topics.forEach((t, k) => {
      const a = (k / Math.max(1, q.topics.length)) * TAU + 0.4; put(t, q.cx + 95 * Math.cos(a), q.cy + 95 * Math.sin(a));
      const grow = (p) => p.kids.forEach((c) => { const b = rand() * TAU; put(c, p.wx + 26 * Math.cos(b), p.wy + 26 * Math.sin(b)); grow(c); }); grow(t);
    });
    for (const r of N.values()) { r.x = r.wx; r.y = r.wy; }
    alpha = fresh || reset ? 1 : Math.max(alpha, 0.08); settled = false;
    const m = new Map(); for (const l of raw) { const k = l.a.id < l.b.id ? l.a.id + "|" + l.b.id : l.b.id + "|" + l.a.id; if (!m.has(k)) m.set(k, { a: l.a, b: l.b, n: 0 }); m.get(k).n++; } wpairs = [...m.values()];
  }
  function tick() {
    const allR = [...N.values()], cell = 90, grid = new Map(), A = alpha;
    const spring = (a, b, len, s) => { const dx = b.wx - a.wx, dy = b.wy - a.wy, d = Math.hypot(dx, dy) || 0.01, f = ((d - len) / d) * s * A; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; };
    for (const r of allR) if (r.parent) spring(r, r.parent, r.parent.kind === "topic" ? 62 : r.depth === 1 ? 42 : 30, 0.22);
    for (const l of raw) spring(l.a, l.b, 150, 0.025);
    for (const r of allR) { const k = Math.floor(r.wx / cell) + "," + Math.floor(r.wy / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(r); }
    for (const r of allR) {
      const gx = Math.floor(r.wx / cell), gy = Math.floor(r.wy / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of grid.get(gx + i + "," + (gy + j)) || []) {
        if (o === r) continue; const dx = r.wx - o.wx, dy = r.wy - o.wy, d2 = dx * dx + dy * dy || 0.01; if (d2 > cell * cell * 2) continue;
        const f = ((o.kind === "topic" ? (r.kind === "topic" ? 2600 : 900) : 260) / d2) * A; r.vx += dx * f; r.vy += dy * f;
      }
    }
    for (const q of isles) {
      const m = q.topics.flatMap((t) => [t, ...sub(t)]); if (!m.length) continue;
      let cx = 0, cy = 0; for (const r of m) { cx += r.wx; cy += r.wy; } cx /= m.length; cy /= m.length;
      let rr = 0; for (const r of m) rr += (r.wx - cx) ** 2 + (r.wy - cy) ** 2; q.mx = cx; q.my = cy; q.mr = Math.sqrt(rr / m.length) * 1.5 + 40; q.members = m;
      for (const r of m) { r.vx += (cx - r.wx) * 0.012 * A; r.vy += (cy - r.wy) * 0.012 * A; }
    }
    const live = isles.filter((q) => q.members?.length);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const p = live[i], q = live[j], dx = q.mx - p.mx, dy = q.my - p.my, d = Math.hypot(dx, dy) || 1, g = p.mr + q.mr + 50 - d;
      if (g > 0) { const f = (g / d) * 0.04 * A; for (const r of p.members) { r.vx -= dx * f; r.vy -= dy * f; } for (const r of q.members) { r.vx += dx * f; r.vy += dy * f; } }
    }
    for (const r of allR) { r.vx += -r.wx * 0.0006 * A; r.vy += -r.wy * 0.0006 * A; }
    for (const r of allR) { if (r.pin || r === drag?.r) { r.vx = r.vy = 0; continue; } r.vx *= 0.58; r.vy *= 0.58; r.wx += clamp(r.vx, -30, 30); r.wy += clamp(r.vy, -30, 30); }
    alpha *= 0.985;
  }
  function saveLayout() { pos = {}; for (const r of N.values()) pos[r.id] = [Math.round(r.wx), Math.round(r.wy)]; onLayout({ pos, pin: [...pin] }); }
  function drawWeb() {
    const k = view.k, X = (r) => SX(r.x), Y = (r) => SY(r.y), inView = (x, y) => x > -80 && x < W + 80 && y > -40 && y < H + 40, z = clamp(k, 0.5, 1.5);
    const f0 = N.get(hov) || N.get(pick), near = new Set();
    if (f0) { near.add(f0); for (const p of wpairs) { if (p.a === f0) near.add(p.b); if (p.b === f0) near.add(p.a); } if (f0.parent) near.add(f0.parent); for (const c of f0.kids) near.add(c); }
    for (const q of isles) {
      if (!q.members?.length) continue;
      const x = SX(q.mx), y = SY(q.my), R = q.mr * k, g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgba(q.hue, 0.1)); g.addColorStop(1, rgba(q.hue, 0)); ctx.fillStyle = g; dot(x, y, R);
      ctx.font = "700 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; if ("letterSpacing" in ctx) ctx.letterSpacing = "1.4px";
      ctx.globalAlpha = f0 && ![...near].some((r) => r.isle === q) ? 0.45 : 1; halo(q.name.toUpperCase(), x, y - R * 0.72, q.hue); ctx.globalAlpha = 1;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"; ctx.textAlign = "left";
    }
    ctx.lineCap = "round";
    for (const r of N.values()) {
      if (!r.parent) continue; const p = r.parent, x0 = X(p), y0 = Y(p), x1 = X(r), y1 = Y(r); if (!inView(x0, y0) && !inView(x1, y1)) continue;
      const lit = f0 ? near.has(r) && near.has(p) : true;
      ctx.globalAlpha = lit ? 0.9 : 0.12; ctx.fillStyle = armColour(r.hue); arm(x0, y0, x1, y1, (r.depth <= 0 ? 4 : 2.2) * z, (r.depth <= 0 ? 1.8 : 1) * z, ((hsh(r.id) % 1000) / 1000 - 0.5) * 0.25); ctx.globalAlpha = 1;
    }
    for (const p of wpairs) {
      const on = f0 && (p.a === f0 || p.b === f0), al = f0 && !on ? 0.08 : on ? 0.95 : 0.4, x0 = X(p.a), y0 = Y(p.a), x1 = X(p.b), y1 = Y(p.b), mx = (x0 + x1) / 2 - (y1 - y0) * 0.14, my = (y0 + y1) / 2 + (x1 - x0) * 0.14;
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, rgba(p.a.hue, al)); g.addColorStop(1, rgba(p.b.hue, al)); ctx.strokeStyle = g; ctx.lineWidth = on ? 1.6 : 1.1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke(); ctx.setLineDash([]);
    }
    const allR = [...N.values()];
    for (const r of allR) {
      const x = X(r), y = Y(r); if (!inView(x, y)) continue;
      ctx.globalAlpha = f0 && !near.has(r) ? (hov ? 0.25 : 0.5) : 1;
      const rad = r.kind === "topic" ? 6 + 2.2 * Math.min(2, r.growth) : r.depth === 0 ? 4 : 2.6;
      if (r.mist) { ctx.setLineDash([2.5, 2.5]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2; ring(x, y, rad); ctx.setLineDash([]); }
      else { ctx.fillStyle = r.kind === "idea" && r.st !== "ok" ? C.card : r.hue; dot(x, y, rad); ctx.strokeStyle = r.st === "ghost" ? C.muted : r.hue; ctx.lineWidth = 1; ring(x, y, rad); }
      if (r.id === pick) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ring(x, y, rad + 4); }
      ctx.globalAlpha = 1;
    }
    const rank = (r) => (r.id === pick ? 0 : r === f0 ? 1 : near.has(r) ? 2 : r.kind === "topic" ? 3 : r.depth === 0 ? 4 : r.depth === 1 ? 5 : 6);
    const want = (r) => rank(r) <= 3 || (r.depth === 0 && k >= 0.7);   // the little ideas only near what is picked
    const boxes = [], free = (b) => boxes.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
    for (const r of allR.filter(want).sort((a, b) => rank(a) - rank(b))) {
      const x = X(r), y = Y(r); if (!inView(x, y)) continue;
      const font = r.kind === "topic" ? FONT.isle : r.depth === 0 ? FONT.key : FONT.idea, f = fit(r.title, font, LABEL), lx = x + (r.kind === "topic" ? 14 : 7), b = { x0: lx - 4, y0: y - 9, x1: lx + f.w + 4, y1: y + 9 };
      if (rank(r) > 1 && !free(b)) continue; boxes.push(b);
      ctx.globalAlpha = f0 && !near.has(r) ? (hov ? 0.3 : 0.6) : 1; ctx.font = font; ctx.textBaseline = "middle";
      if (r.id === pick) { halo(f.s, lx, y + 0.5, C.ink); ctx.fillStyle = C.accent; ctx.fillRect(lx, y + 8, f.w, 2); } else halo(f.s, lx, y + 0.5, r.depth > 1 ? C.muted : C.ink);
      ctx.globalAlpha = 1;
    }
  }
  // ---------- view ----------
  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; draw(); kick();
  }
  const pad = () => ({ t: 64, b: 92, l: 20, r: 20 });
  function extent() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    if (mode === "tree") { const R = rings.length ? rings[rings.length - 1] : 100; for (const x of P.values()) { x0 = Math.min(x0, x.tx); y0 = Math.min(y0, x.ty); x1 = Math.max(x1, x.tx); y1 = Math.max(y1, x.ty); } x0 = Math.min(x0, -R); y0 = Math.min(y0, -R); x1 = Math.max(x1, R); y1 = Math.max(y1, R); return { x0: x0 - 60, y0: y0 - 30, x1: x1 + 60, y1: y1 + 30 }; }
    for (const r of N.values()) { x0 = Math.min(x0, r.wx); y0 = Math.min(y0, r.wy); x1 = Math.max(x1, r.wx + 60); y1 = Math.max(y1, r.wy); }
    return isFinite(x0) ? { x0: x0 - 30, y0: y0 - 40, x1: x1 + 30, y1: y1 + 30 } : { x0: -100, y0: -100, x1: 100, y1: 100 };
  }
  function to(x, y, k, now) { Object.assign(goal, { x, y, k, on: !now }); if (now) Object.assign(view, { x, y, k }); kick(); }
  // fit everything; keep = never zoom out, just bring the middle back to the middle
  function home(now, keep) {
    const b = extent(), p = pad(), w = W - p.l - p.r, h = H - p.t - p.b, k = clamp(Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0)), 0.12, 2.2);
    auto = mode === "web";
    if (keep && view.k > k) { to(p.l + w / 2, p.t + h / 2, view.k, now); return; }
    to(p.l + w / 2 - ((b.x0 + b.x1) / 2) * k, p.t + h / 2 - ((b.y0 + b.y1) / 2) * k, k, now);
  }
  function show(key) {
    const x = mode === "tree" ? P.get(key) : N.get(key) && { tx: N.get(key).wx, ty: N.get(key).wy }; if (!x) return;
    const p = pad(), k = goal.on ? goal.k : view.k, sx = x.tx * k + (goal.on ? goal.x : view.x), sy = x.ty * k + (goal.on ? goal.y : view.y);
    if (sx > p.l + 40 && sx < W - p.r - 140 && sy > p.t + 30 && sy < H - p.b - 30) return;
    to(W / 2 - x.tx * k, p.t + (H - p.t - p.b) / 2 - x.ty * k, k);
  }
  function zoomAt(sx, sy, f) { auto = false; const k = clamp(view.k * f, 0.08, 4); goal.on = false; view.x = sx - ((sx - view.x) * k) / view.k; view.y = sy - ((sy - view.y) * k) / view.k; view.k = k; draw(); }

  // ---------- picking and input ----------
  function hit(sx, sy) {
    let best = null, bd = Infinity;
    if (mode === "tree") { for (const x of P.values()) { const d = Math.hypot(sx - SX(x.x), sy - SY(x.y)); if (d < radiusOf(x) + 7 && d < bd) { best = x.key; bd = d; } } return best; }
    for (const r of N.values()) { const rad = r.kind === "topic" ? 14 : 8, d = Math.hypot(sx - SX(r.x), sy - SY(r.y)); if (d < rad && d < bd) { best = r.id; bd = d; } }
    return best;
  }
  const pts = new Map(); let press = null, pinch = null;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; press = null; drag = null; return; }
    const h = hit(e.offsetX, e.offsetY);
    press = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, h, moved: false, button: e.button };
    if (mode === "web" && h && e.button === 0) { const r = N.get(h); drag = { r, kids: loose ? [] : sub(r).filter((c) => !c.pin) }; } goal.on = false; auto = false; onHover(null);
  });
  cv.addEventListener("pointermove", (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * d) / pinch.d / view.k); return; }
    if (press) {
      const dx = e.offsetX - press.x, dy = e.offsetY - press.y; if (Math.hypot(dx, dy) > 4) press.moved = true; if (!press.moved) return;
      if (drag?.r && loose) { const r = drag.r; r.wx = r.x = (e.offsetX - view.x) / view.k; r.wy = r.y = (e.offsetY - view.y) / view.k; r.pin = true; pin.add(r.id); alpha = Math.max(alpha, 0.18); settled = false; kick(); }
      else if (drag?.r) {   // held still: what you drag moves with everything under it; nothing else stirs
        const r = drag.r, nx = (e.offsetX - view.x) / view.k, ny = (e.offsetY - view.y) / view.k, dx = nx - r.wx, dy = ny - r.wy;
        r.wx = nx; r.wy = ny; for (const c of drag.kids) { c.wx += dx; c.wy += dy; } for (const c of [r, ...drag.kids]) { c.x = c.wx; c.y = c.wy; }
        r.pin = true; pin.add(r.id); alpha = 0; draw();
      }
      else { view.x = press.vx + dx; view.y = press.vy + dy; draw(); }
      return;
    }
    if (e.pointerType === "mouse") { const h = hit(e.offsetX, e.offsetY); cv.style.cursor = h ? "pointer" : ""; if (h !== hov) { hov = h; draw(); } onHover(h ? info(h) : null, e.clientX, e.clientY); }
  });
  cv.addEventListener("pointerup", (e) => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    const p = press; press = null; const d = drag; drag = null;
    if (!p) return;
    if (d?.r && p.moved) { if (loose) { settled = false; alpha = Math.max(alpha, 0.05); kick(); } else { settled = true; saveLayout(); } return; }
    if (!p.moved && p.button === 0) tap(p.h);
  });
  cv.addEventListener("pointercancel", (e) => { pts.delete(e.pointerId); press = null; drag = null; pinch = null; });
  cv.addEventListener("pointerleave", () => { if (hov) { hov = null; draw(); } onHover(null); });
  // right-click opens or closes what's under a thing; double-click puts it in the middle
  cv.addEventListener("contextmenu", (e) => { e.preventDefault(); const h = hit(e.offsetX, e.offsetY); if (h) fold(h); });
  cv.addEventListener("dblclick", (e) => { const h = hit(e.offsetX, e.offsetY); if (h) centre(h); });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0016))); }, { passive: false });
  function tap(h) {
    if (!h) { if (pick) { pick = null; changed(); } return; }
    select(h);
  }

  // ---------- actions ----------
  function info(key) {
    if (mode === "tree") {
      const x = H2.get(key); if (!x) return null;
      if (x.kind === "start" || x.kind === "isle") { const q = x.q; return { kind: "island", key, id: q.id, title: q.name, start: !!q.start, centre: key === root, ideas: q.keys.length, topics: q.topics.length, after: q.after?.id || null, from: q.from?.id || null, fromTitle: q.from?.title || "", afterName: q.after?.name || "", kids: x.kids.length, open: isOpen(x) }; }
      const r = x.rec;
      return { kind: "idea", key, id: r.id, title: r.title, note: r.note, treeId: r.treeId, zoneId: r.zoneId, topic: r.top.title, island: r.isle.name, keyIdea: r.depth === 0, centre: key === root, open: isOpen(x), kids: x.kids.length };
    }
    const r = N.get(key); if (!r) return null;
    if (r.kind === "topic") return { kind: "topic", key, id: r.zoneId, zoneId: r.zoneId, title: r.title, island: r.isle.name };
    return { kind: "idea", key, id: r.id, title: r.title, note: r.note, treeId: r.treeId, zoneId: r.zoneId, topic: r.top.title, island: r.isle.name, keyIdea: r.depth === 0, open: false, kids: r.kids.length };
  }
  const ui = () => ({ mode, open: [...open], shut: [...shut], all, loose });
  function changed(fit = false) { if (mode === "tree") { layout(); if (fit) home(false, fit === "keep"); } onState(ui()); onSelect(pick ? info(pick) : null); draw(); kick(); }
  function select(key) { pick = key || null; onSelect(pick ? info(pick) : null); if (pick) show(pick); draw(); kick(); }
  // open or close what's under a thing, staying where you are
  function fold(key) {
    const x = H2.get(key); if (!x) return;
    pick = key;
    if (x.kids.length && key !== root) {
      if (x.kind === "start" || x.kind === "isle") { if (shut.has(key)) shut.delete(key); else shut.add(key); }
      else if (all) { all = false; for (const h of H2.values()) if (h.kind === "key" || h.kind === "idea") open.add(h.key); open.delete(key); }
      else if (open.has(key)) open.delete(key); else open.add(key);
    }
    changed(); show(key);
  }
  // put a thing in the middle with what's under it round it; Esc comes back out
  function centre(key) {
    const x = H2.get(key); if (!x) return;
    if (key === root) { const i = info(key); if (i && !(i.kind === "island" && i.start)) onOpen(i); return; }   // in the middle already: go into it
    if (mode !== "tree") return;
    roots.push(root); root = key; pick = key;
    if (x.kind === "isle") shut.delete(key); else if (x.kind !== "start") open.add(key);
    changed(true);
  }
  function back() { if (root === "i:start" && !roots.length) return false; root = roots.pop() || "i:start"; pick = null; changed(true); return true; }
  function full() { if (root === "i:start") { home(); return; } roots = []; root = "i:start"; changed(true); }
  // make sure a thing shows: everything above it opened
  function reveal(key) { let h = H2.get(key)?.parent; while (h) { if (h.kind === "isle" || h.kind === "start") shut.delete(h.key); else open.add(h.key); h = h.parent; } }
  function step(dir) {
    const list = mode === "tree" ? [...P.values()].map((x) => ({ key: x.key, x: SX(x.x), y: SY(x.y) })) : [...N.values()].map((r) => ({ key: r.id, x: SX(r.x), y: SY(r.y) }));
    const cur = list.find((o) => o.key === pick);
    if (!cur) { const n1 = [...nums.entries()].find(([, n]) => n === 1); select(n1 ? n1[0] : list[0]?.key); return; }
    const v = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[dir]; let best = null, bs = Infinity;
    for (const o of list) { if (o === cur) continue; const dx = o.x - cur.x, dy = o.y - cur.y, d = Math.hypot(dx, dy) || 1, c = (dx * v[0] + dy * v[1]) / d; if (c < 0.5) continue; const s = d * (2 - c); if (s < bs) { bs = s; best = o; } }
    if (best) select(best.key);
  }
  // Keys: a number picks what's round the middle; Space opens or closes (right-click); Enter puts it in the middle
  // (double-click); Esc lets go of the pick, then steps back out; H the whole tree; A every idea open.
  function key(k) {
    if (mode === "tree") {
      if (/^[1-9]$/.test(k)) { const h = [...nums.entries()].find(([, n]) => n === +k); if (h) select(h[0]); return true; }
      if (k === "Enter" && pick) { centre(pick); return true; }
      if (k === " " && pick) { fold(pick); return true; }
      if (k === "Escape") { if (pick) { pick = null; changed(); return true; } return back(); }
      if (k === "Backspace") { back(); return true; }
      if (k === "h") { full(); return true; }
      if (k === "a") { all = !all; if (!all) open.clear(); changed(true); return true; }
    } else {
      if (k === "Enter" && pick) { onOpen(info(pick)); return true; }
      if (k === "Escape" && pick) { select(null); return true; }
      if (k === "r") { webStart(true); saveLayout(); home(); kick(); return true; }
      if (k === "j") { loose = !loose; onState(ui()); return true; }
    }
    if (k.startsWith("Arrow")) { step(k); return true; }
    if (k === "0") { home(); return true; }
    if (k === "=" || k === "+") { zoomAt(W / 2, H / 2, 1.2); return true; }
    if (k === "-") { zoomAt(W / 2, H / 2, 1 / 1.2); return true; }
    return false;
  }
  function setMode(m) {
    if (m === mode) return; mode = m; pick = null; hov = null;
    if (mode === "web") webStart(false); else layout();
    home(true); onState(ui()); onSelect(null); draw(); kick();
  }

  new ResizeObserver(resize).observe(host);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { C = colours(); widths.clear(); draw(); });
  return {
    setData, setMode, key, select, resize, back, centre, fold,
    get mode() { return mode; }, get selected() { return pick ? info(pick) : null; },
    get flags() { return { all, loose, root, full: root === "i:start" }; },
    redraw() { draw(); },
    restyle() { C = colours(); widths.clear(); draw(); },
    setActive(on) { active = on; if (on) { C = colours(); resize(); kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    fit() { home(); }, zoom(f) { zoomAt(W / 2, H / 2, f); },
    tap(h) { tap(h); },
    // Open on an island, a topic or an idea: the whole tree, with it showing and picked
    goTo(id) { const q = isleOf(id); if (!q) return; if (mode === "web") return; reveal(q.key); pick = q.key; changed(); show(q.key); },
    focus(id) {
      const r = N.get(id) || N.get("z:" + id); if (!r) return;
      if (mode === "web") { select(r.id); return; }
      const key = r.kind === "topic" ? r.kids[0]?.id || r.isle.key : r.id;
      reveal(key); pick = key; changed(); show(key);
    },
    // for tests and pictures
    snapshot: () => ({ mode, root, pick, all, open: [...open], shut: [...shut], shown: [...P.keys()], nums: Object.fromEntries([...nums].map(([kk, n]) => [n, kk])),
      rings: rings.length, links: E.filter((e) => e.kind === "link").map((e) => ({ a: e.a, b: e.b, n: e.n })),
      settled: mode === "tree" ? !goal.on && [...P.values()].every((x) => Math.abs(x.tx - x.x) < 0.5 && Math.abs(x.ty - x.y) < 0.5 && x.a > 0.99) : settled }),
    screenOf(key) { const x = mode === "tree" ? P.get(key) || P.get("i:" + key) : N.get(key); return x && { x: SX(x.x), y: SY(x.y) }; },
  };
}
