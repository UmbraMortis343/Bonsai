// Bonsai: the tech tree. A flat map of everything you know.
// Tree: a radial map grown from a start in the middle. Each topic is a cell on a ring; a topic sits one
// ring further out than the topics it builds on. Open a cell and it grows, filling with a small map of its
// ideas (trunks in the middle, branches outward), and the rest of the map is pushed out to make room.
// Links between ideas are drawn between whatever is showing, so closed cells still show how topics connect.
// Web: every idea at once, laid out by its connections, clustered by island; drag to reshape, positions kept.
// Drawn on a 2D canvas so it stays light on a phone. Positions scale with zoom; dots and words keep their size.

const HUES = ["#5b8def", "#9a7cf0", "#e0709f", "#e8834f", "#d4a23a", "#4fb286", "#35a9b6", "#8a9b48"];
const START = 70, GAP = 70, RIN = 40, STEP = 54, LABEL = 150, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const topicKey = (id) => "z:" + id;
const wrap = (a) => ((a % TAU) + TAU) % TAU;

export function createTechTree({ host, saved = {}, onSelect = () => {}, onOpen = () => {}, onHover = () => {}, onState = () => {}, onLayout = () => {} }) {
  const cv = document.createElement("canvas"); cv.setAttribute("aria-label", "Tech tree"); host.append(cv);
  const ctx = cv.getContext("2d");
  let W = 1, H = 1, dpr = 1, active = false, raf = 0, last = 0, C = colours();
  let mode = saved.mode === "web" ? "web" : "tree", level = [0, 1, 2].includes(saved.level) ? saved.level : 1, auto = false, frames = 0;
  let sel = null, hov = null, drag = null, alpha = 0, settled = true, framed = { tree: false, web: false };
  const cells = new Map(Object.entries(saved.cells || {})), view = { x: 0, y: 0, k: 1 }, goal = { x: 0, y: 0, k: 1, on: false };
  let N = new Map(), topics = [], isles = [], hubs = [], raw = [], pairs = [], rings = [], after = {}, shown = [];
  let pos = saved.pos || {}, pin = new Set(saved.pin || []);
  const widths = new Map();

  function colours() {
    const css = getComputedStyle(document.documentElement), v = (k) => css.getPropertyValue(k).trim(), ink = v("--ink") || "#000000";
    const rgb = /^#[0-9a-f]{6}$/i.test(ink) ? [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16)).join(",") : "0,0,0";
    return { bg: v("--bg") || "#fff", ink, soft: `rgba(${rgb},.72)`, faint: `rgba(${rgb},.16)`, muted: v("--muted") || "#888", line: v("--line") || "#ddd", sap: v("--sap") || "#d97706", dark: matchMedia("(prefers-color-scheme: dark)").matches };
  }
  const FONT = { topic: "small-caps 600 15px Georgia,'Times New Roman',serif", root: "600 12.5px Georgia,'Times New Roman',serif", idea: "12px Georgia,'Times New Roman',serif" };
  function fit(text, kind, max) {
    const key = kind + "|" + max + "|" + text; if (widths.has(key)) return widths.get(key);
    ctx.font = FONT[kind]; let s = text, w = ctx.measureText(s).width;
    if (w > max) { while (s.length > 1 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1); s = s.trimEnd() + "…"; w = ctx.measureText(s).width; }
    const r = { s, w }; widths.set(key, r); return r;
  }
  const kindOf = (n) => (n.kind === "topic" ? "topic" : n.depth === 0 ? "root" : "idea");
  const alphaHex = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // ---------- data ----------
  function setData(d) {
    const old = N; N = new Map(); C = colours(); widths.clear(); after = d.after || {};
    hubs = d.hubs?.length ? d.hubs : [{ id: "", name: "" }];
    isles = d.islands.map((q, i) => ({ ...q, i, hue: HUES[i % HUES.length], topics: [] }));
    const rec = (id, o) => { const p = old.get(id); const r = { id, kids: [], parent: null, vis: false, a: 0, ta: 0, x: 0, y: 0, tx: 0, ty: 0, wx: 0, wy: 0, vx: 0, vy: 0, desc: 0, ...o }; if (p) for (const k of ["x", "y", "a", "wx", "wy", "wplaced", "placed", "ang", "R", "drc"]) r[k] = p[k]; N.set(id, r); return r; };
    topics = d.topics.map((t) => { const isl = isles[t.isle] || isles[0], r = rec(topicKey(t.id), { kind: "topic", zoneId: t.id, title: t.name, isle: isl.i, hue: isl.hue, depth: -1, growth: t.growth || 0, mist: !!t.mist, ideas: t.ideas || 0 }); isl.topics.push(r); return r; });
    const treeOf = new Map(d.trees.map((t) => [t.id, t])), byParent = new Map();
    for (const n of d.nodes) { const t = treeOf.get(n.treeId); if (!t || !N.has(topicKey(t.zoneId))) continue; const top = N.get(topicKey(t.zoneId)); rec(n.id, { kind: "idea", st: n.st || "ok", title: n.title || "Untitled", note: n.note || "", treeId: n.treeId, zoneId: t.zoneId, isle: top.isle, hue: top.hue, src: n }); }
    for (const n of d.nodes) { const r = N.get(n.id); if (!r) continue; const pid = n.parentId != null && N.has(n.parentId) ? n.parentId : topicKey(r.zoneId); if (!byParent.has(pid)) byParent.set(pid, []); byParent.get(pid).push(r); }
    const treeAt = new Map(d.trees.map((t, i) => [t.id, i])), by = (a, b) => (a.parentId ? 0 : treeAt.get(a.treeId) - treeAt.get(b.treeId)) || (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt));
    for (const [pid, kids] of byParent) { const p = N.get(pid); kids.sort((a, b) => by(a.src, b.src)); p.kids = kids; for (const k of kids) k.parent = p; }
    const walk = (n, depth) => { n.depth = depth; let c = 0; for (const k of n.kids) c += 1 + walk(k, depth + 1); n.desc = c; return c; };
    for (const t of topics) walk(t, -1);
    for (const r of N.values()) { delete r.src; r.top = r.kind === "topic" ? r : N.get(topicKey(r.zoneId)); }
    for (const z of [...cells.keys()]) if (!N.has(z)) cells.delete(z);
    if (sel && !N.has(sel)) sel = null; if (hov && !N.has(hov)) hov = null;
    raw = d.links.filter((l) => N.has(l.fromId) && N.has(l.toId) && l.fromId !== l.toId).map((l) => ({ id: l.id, a: N.get(l.fromId), b: N.get(l.toId), label: l.label || "" }));
    layout(); if (mode === "web") webStart(false);
    if (!framed[mode]) { home(true); framed[mode] = true; }
    kick();
  }

  // ---------- tree: rings of cells around a start ----------
  const cellLevel = (t) => (cells.has(t.id) ? cells.get(t.id) : level);
  // A topic's ring: one past the furthest topic it builds on. Loops are ignored.
  function tiers() {
    const memo = new Map(), busy = new Set();
    const tier = (t) => {
      if (memo.has(t)) return memo.get(t); if (busy.has(t)) return 0; busy.add(t);
      let m = 0; for (const p of t.after) m = Math.max(m, tier(p)); busy.delete(t); memo.set(t, m + 1); return m + 1;
    };
    for (const t of topics) t.after = (after[t.zoneId] || []).map((z) => N.get(topicKey(z))).filter((p) => p && p !== t);
    for (const t of topics) t.tier = tier(t);
  }
  // Inside a cell: the topic in the middle, its trunks on the first ring, branches further out.
  function inner(t) {
    const L = cellLevel(t), show = (n) => L >= 2 || n.depth <= 1;
    const vis = []; let deep = 0;
    const leaves = (n) => { const ks = n.kids.filter(show); n.vk = ks; n.leaves = ks.length ? ks.reduce((a, k) => a + leaves(k), 0) : 1; return n.leaves; };
    if (L === 0 || !t.kids.length) { t.rc = 18 + 5 * Math.min(2, t.growth); t.inner = []; return; }
    leaves(t);
    const perDepth = [];
    const walk = (n) => { for (const k of n.vk) { vis.push(k); deep = Math.max(deep, k.depth); perDepth[k.depth] = (perDepth[k.depth] || 0) + 1; walk(k); } };
    walk(t);
    let step = STEP;   // spread the rings out until the busiest one has room for its dots and words
    for (let dd = 0; dd <= deep; dd++) { const need = ((perDepth[dd] || 0) * (dd === deep ? 17 : 26)) / TAU; if (need > RIN + dd * step) step = Math.max(step, (need - RIN) / Math.max(1, dd)); }
    const place = (n, a0, span) => { let a = a0; for (const k of n.vk) { const s = (span * k.leaves) / n.leaves; k.la = a + s / 2; k.lr = RIN + k.depth * step; place(k, a, s); a += s; } };
    place(t, 0, TAU);
    t.inner = vis; t.rc = RIN + deep * step + (L >= 2 ? 64 : 76);
  }
  function layout() {
    tiers();
    for (const r of N.values()) { r.vis = false; r.ta = 0; }
    for (const t of topics) inner(t);
    // island sectors, with a wider gap between hubs
    const many = hubs.length > 1, order = [...isles].sort((a, b) => (a.hub || 0) - (b.hub || 0) || a.i - b.i).filter((q) => q.topics.length);
    const weight = (q) => Math.max(1, ...[...new Set(q.topics.map((t) => t.tier))].map((tt) => q.topics.filter((t) => t.tier === tt).reduce((a, t) => a + t.rc, 0) / 30));
    const gapOf = (q, i) => (i && many && (q.hub || 0) !== (order[i - 1].hub || 0) ? 2.2 : 0.6);
    const total = order.reduce((a, q, i) => a + weight(q) + gapOf(q, i), 0) + (many && order.length ? 2.2 : 0.6);
    let a = -Math.PI / 2;
    order.forEach((q, i) => { a += (gapOf(q, i) / total) * TAU; q.a0 = a; a += (weight(q) / total) * TAU; q.a1 = a; });
    // rings: radius from the cells on them; angles spread inside each island's sector, ordered under what they build on
    rings = []; const max = Math.max(0, ...topics.map((t) => t.tier));
    let R = 0, prevMax = 0;
    for (let tt = 1; tt <= max; tt++) {
      const on = topics.filter((t) => t.tier === tt); if (!on.length) { rings.push(null); continue; }
      const big = Math.max(...on.map((t) => t.rc));
      R = tt === 1 || !prevMax ? START + big : R + prevMax + big + GAP;
      for (const q of order) {
        const mine = on.filter((t) => t.isle === q.i), bary = (t) => (t.after.length ? Math.atan2(t.after.reduce((s, p) => s + Math.sin(p.ang), 0), t.after.reduce((s, p) => s + Math.cos(p.ang), 0)) : null);
        const keyOf = (t) => { const b = bary(t); return b == null ? q.topics.indexOf(t) / q.topics.length : wrap(b - q.a0) / Math.max(1e-6, q.a1 - q.a0); };
        mine.sort((x, y) => keyOf(x) - keyOf(y)).forEach((t, j) => { t.ang = q.a0 + ((j + 0.5) / mine.length) * (q.a1 - q.a0); });
      }
      const need = on.reduce((s, t) => s + 2 * t.rc + GAP * 0.5, 0) / TAU; if (need > R) R = need;
      on.sort((x, y) => x.ang - y.ang);
      for (let it = 0; it < 40 && on.length > 1; it++) {   // push neighbours apart along the ring until no two cells overlap
        let moved = false;
        for (let j = 0; j < on.length; j++) {
          const p = on[j], q = on[(j + 1) % on.length], want = (p.rc + q.rc + GAP * 0.5) / R, d = wrap(q.ang - p.ang) || (j === on.length - 1 ? TAU : 0);
          if (d < want) { const push = (want - d) / 2; p.ang -= push; q.ang += push; moved = true; }
        }
        if (!moved) break;
      }
      for (const t of on) { t.R = R; t.tx = R * Math.cos(t.ang); t.ty = R * Math.sin(t.ang); }
      rings.push(R); prevMax = big;
    }
    shown = [];
    for (const t of topics) {
      t.vis = true; t.ta = 1; shown.push(t);
      const rot = t.ang + Math.PI / 2;   // the cell's map is turned so it opens away from the start
      for (const n of t.inner) { n.vis = true; n.ta = 1; n.tx = t.tx + n.lr * Math.cos(n.la + rot); n.ty = t.ty + n.lr * Math.sin(n.la + rot); shown.push(n); }
    }
    for (const r of N.values()) if (!r.vis) { r.tx = r.top.tx; r.ty = r.top.ty; }
    for (const t of topics) if (!t.placed) { t.x = t.tx; t.y = t.ty; t.placed = true; t.a = 1; }
    for (const r of N.values()) if (r.vis && r.a === 0 && r.kind === "idea") { r.x = r.top.x; r.y = r.top.y; }   // new ideas grow out of the middle of their cell
    pairs = lift();
  }
  // A link between two ideas is drawn between the nearest things that are showing.
  function lift() {
    const showing = (r) => { if (mode === "web") return r; while (r && !r.vis) r = r.parent; return r; };
    const m = new Map();
    for (const l of raw) {
      const a = showing(l.a), b = showing(l.b); if (!a || !b || a === b) continue;
      const k = a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
      const p = m.get(k) || { a, b, n: 0, label: "", direct: false }; p.n++; if (a === l.a && b === l.b) { p.direct = true; p.label ||= l.label; } m.set(k, p);
    }
    return [...m.values()];
  }

  // ---------- web: everything, by its connections ----------
  let rnd = 1; const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
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
    pairs = lift();
  }
  const sub = (n) => { const out = []; const go = (x) => { for (const k of x.kids) { out.push(k); go(k); } }; go(n); return out; };
  function tick() {
    const all = [...N.values()], cell = 90, grid = new Map(), A = alpha;
    const spring = (a, b, len, s) => { const dx = b.wx - a.wx, dy = b.wy - a.wy, d = Math.hypot(dx, dy) || 0.01, f = ((d - len) / d) * s * A; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; };
    for (const r of all) if (r.parent) spring(r, r.parent, r.parent.kind === "topic" ? 62 : r.depth === 1 ? 42 : 30, 0.22);
    for (const l of raw) spring(l.a, l.b, 150, 0.025);
    for (const r of all) { const k = Math.floor(r.wx / cell) + "," + Math.floor(r.wy / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(r); }
    for (const r of all) {
      const gx = Math.floor(r.wx / cell), gy = Math.floor(r.wy / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of grid.get(gx + i + "," + (gy + j)) || []) {
        if (o === r) continue; const dx = r.wx - o.wx, dy = r.wy - o.wy, d2 = dx * dx + dy * dy || 0.01; if (d2 > cell * cell * 2) continue;
        const f = ((o.kind === "topic" ? (r.kind === "topic" ? 2600 : 900) : 260) / d2) * A; r.vx += dx * f; r.vy += dy * f;
      }
    }
    for (const q of isles) {   // keep each island together, and islands apart
      const m = q.topics.flatMap((t) => [t, ...sub(t)]); if (!m.length) continue;
      let cx = 0, cy = 0; for (const r of m) { cx += r.wx; cy += r.wy; } cx /= m.length; cy /= m.length;
      let rr = 0; for (const r of m) rr += (r.wx - cx) ** 2 + (r.wy - cy) ** 2; q.mx = cx; q.my = cy; q.mr = Math.sqrt(rr / m.length) * 1.5 + 40; q.members = m;
      for (const r of m) { r.vx += (cx - r.wx) * 0.012 * A; r.vy += (cy - r.wy) * 0.012 * A; }
    }
    const live = isles.filter((q) => q.members?.length);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const p = live[i], q = live[j], dx = q.mx - p.mx, dy = q.my - p.my, d = Math.hypot(dx, dy) || 1, gap = p.mr + q.mr + 50 - d;
      if (gap > 0) { const f = (gap / d) * 0.04 * A; for (const r of p.members) { r.vx -= dx * f; r.vy -= dy * f; } for (const r of q.members) { r.vx += dx * f; r.vy += dy * f; } }
    }
    for (const r of all) { r.vx += -r.wx * 0.0006 * A; r.vy += -r.wy * 0.0006 * A; }
    for (const r of all) { if (r.pin || r === drag?.r) { r.vx = r.vy = 0; continue; } r.vx *= 0.58; r.vy *= 0.58; r.wx += clamp(r.vx, -30, 30); r.wy += clamp(r.vy, -30, 30); }
    alpha *= 0.985;
  }
  function saveLayout() { pos = {}; for (const r of N.values()) pos[r.id] = [Math.round(r.wx), Math.round(r.wy)]; onLayout({ pos, pin: [...pin] }); }

  // ---------- frame ----------
  function frame(t) {
    raf = 0; const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    let moving = false; const e = 1 - Math.exp(-dt * 9);
    if (mode === "tree") {
      for (const r of N.values()) {
        r.x += (r.tx - r.x) * e; r.y += (r.ty - r.y) * e; r.a += (r.ta - r.a) * Math.min(1, e * 1.5);
        if (Math.abs(r.tx - r.x) > 0.3 || Math.abs(r.ty - r.y) > 0.3 || Math.abs(r.ta - r.a) > 0.01) moving = true; else { r.x = r.tx; r.y = r.ty; r.a = r.ta; }
      }
      for (const t of topics) { t.drc = t.drc == null ? t.rc : t.drc + (t.rc - t.drc) * e; if (Math.abs(t.rc - t.drc) > 0.3) moving = true; else t.drc = t.rc; }
    } else if (alpha > 0.015 || drag) {
      for (let i = 0; i < 2; i++) tick(); for (const r of N.values()) { r.x = r.wx; r.y = r.wy; r.a = 1; } moving = true;
      if (auto && !drag && ++frames % 6 === 0) home();   // keep the whole web in view while it settles, until you move it yourself
    } else if (!settled) { settled = true; saveLayout(); }
    if (goal.on) {
      for (const k of ["x", "y", "k"]) view[k] += (goal[k] - view[k]) * e;
      if (Math.abs(goal.x - view.x) + Math.abs(goal.y - view.y) < 0.5 && Math.abs(goal.k - view.k) < 0.002) { Object.assign(view, { x: goal.x, y: goal.y, k: goal.k }); goal.on = false; } else moving = true;
    }
    draw();
    if (moving && active) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  // ---------- drawing: dark, after the Path of Exile passive tree ----------
  // Carved bronze paths between gold-ringed nodes. Ideas you know are lit; ideas due for watering go dim.
  // Picking something lights its path back to the start in blue.
  const GOLD = "#c9a45c", GOLD_HI = "#f0d896", BRONZE = "#6b5a3a", CARVE = "#2a241a", BLUE = "#8fd8ff", FILL = "#0d1017";
  let stars = null; const sprites = new Map();
  const X = (r) => r.x * view.k + view.x, Y = (r) => r.y * view.k + view.y;
  function glow(colour, r, x, y, a = 1) {   // a soft light, drawn from a cached sprite so it stays cheap
    let s = sprites.get(colour); if (!s) { s = document.createElement("canvas"); s.width = s.height = 64; const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, alphaHex(colour, 0.55)); gr.addColorStop(0.35, alphaHex(colour, 0.18)); gr.addColorStop(1, alphaHex(colour, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); sprites.set(colour, s); }
    ctx.globalAlpha *= a; ctx.drawImage(s, x - r, y - r, r * 2, r * 2); ctx.globalAlpha /= a || 1;
  }
  function backdrop() {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 1.6); g.addColorStop(0, "#151b27"); g.addColorStop(1, "#05070b"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!stars || stars.w !== W || stars.h !== H) { let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); stars = { w: W, h: H, p: Array.from({ length: Math.round((W * H) / 9000) }, () => [r() * W, r() * H, r() * 0.9 + 0.3, r() * 0.35 + 0.08]) }; }
    for (const [x, y, sz, a] of stars.p) { ctx.fillStyle = `rgba(220,230,255,${a})`; ctx.fillRect(x, y, sz, sz); }
  }
  function focusSet() {
    const focus = N.get(hov) || N.get(sel), near = new Set(), path = new Set();
    if (focus) {
      near.add(focus); for (const p of pairs) { if (p.a === focus) near.add(p.b); if (p.b === focus) near.add(p.a); }
      if (focus.parent) near.add(focus.parent); for (const c of focus.kids) near.add(c);
      if (focus.kind === "topic" && mode === "tree") { for (const p of focus.after) near.add(p); for (const t of topics) if (t.after.includes(focus)) near.add(t); }
      // the way back to the start: up the branches to the topic, then through everything it builds on
      let r = focus; while (r) { path.add(r); r = r.parent; }
      if (mode === "tree") { const up = (t) => { for (const p of t.after) if (!path.has(p)) { path.add(p); up(p); } }; up(focus.top); }
    }
    return { focus, near, path };
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; backdrop();
    if (mode === "web") drawWeb(); else drawTree();
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.textAlign = "left";
  }
  // A path: a dark groove with a bronze line in it; gold when both ends are known; blue and glowing on the picked path.
  function carved(x0, y0, x1, y1, how, w = 1) {
    ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    if (how === "path") { ctx.strokeStyle = alphaHex(BLUE, 0.25); ctx.lineWidth = 7 * w; ctx.stroke(); ctx.strokeStyle = BLUE; ctx.lineWidth = 2 * w; ctx.stroke(); return; }
    ctx.strokeStyle = CARVE; ctx.lineWidth = 4 * w; ctx.stroke();
    ctx.strokeStyle = how === "lit" ? alphaHex(GOLD, 0.75) : alphaHex(BRONZE, 0.75); ctx.lineWidth = 1.4 * w; ctx.stroke();
  }
  function paintLink(p, c, on, dim) {
    const same = p.a.isle === p.b.isle, al = dim ? 0.07 : on ? 0.95 : same ? 0.4 : 0.5;
    if (same) ctx.strokeStyle = alphaHex(p.a.hue, al);
    else { const g = ctx.createLinearGradient(c[0], c[1], c[6], c[7]); g.addColorStop(0, alphaHex(p.a.hue, al)); g.addColorStop(1, alphaHex(p.b.hue, al)); ctx.strokeStyle = g; }
    ctx.lineWidth = Math.min(4.5, 1.1 + Math.log2(p.n) * 0.9) * (on ? 1.3 : 1); ctx.setLineDash(same ? [2, 5] : [6, 5]);
    ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]); ctx.stroke(); ctx.setLineDash([]);
    if (on && p.direct && p.label) { const m = bez(c, 0.5); ctx.font = "italic 500 11px Georgia,serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; halo(p.label, m[0], m[1] - 7, GOLD_HI); ctx.textAlign = "left"; }
  }
  const bowed = (ax, ay, bx, by, f = 0.14) => { const mx = (ax + bx) / 2, my = (ay + by) / 2, ox = -(by - ay) * f, oy = (bx - ax) * f; return [ax, ay, mx + ox, my + oy, mx + ox, my + oy, bx, by]; };
  const bez = (c, t) => { const u = 1 - t; return [u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6], u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7]]; };
  const toward = (r, x, y, gap) => { const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy) || 1; return [r.x + (dx / d) * gap, r.y + (dy / d) * gap]; };
  const known = (r) => r.kind === "topic" ? !r.mist : r.st === "ok";
  // An idea: a small passive. A trunk: a notable, with a second ring. Lit ones glow.
  function passive(r, x, y, onPath, isSel) {
    const R = radius(r), lit = known(r), notable = r.depth === 0;
    if (lit || onPath) glow(onPath ? BLUE : r.hue, R * (notable ? 4.2 : 3.4), x, y, onPath ? 0.9 : 0.55);
    ctx.fillStyle = FILL; dot(x, y, R + 1.5);
    ctx.fillStyle = alphaHex(r.hue, lit ? 0.9 : 0.28); dot(x, y, R - (notable ? 2.2 : 1.2));
    ctx.strokeStyle = onPath ? BLUE : lit ? GOLD : BRONZE; ctx.lineWidth = notable ? 1.6 : 1.2; ring(x, y, R + 1);
    if (notable) { ctx.strokeStyle = alphaHex(onPath ? BLUE : lit ? GOLD_HI : BRONZE, 0.6); ctx.lineWidth = 0.8; ring(x, y, R + 3.6); }
    if (r.st === "dry") { ctx.strokeStyle = "rgba(200,90,60,.7)"; ctx.lineWidth = 1; ring(x, y, R + (notable ? 5.6 : 3.4)); }
    if (isSel) { ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 1.4; ring(x, y, R + (notable ? 7 : 5.5)); }
  }
  // A topic: a keystone with an ornate frame when closed; a ringed socket holding its ideas when open.
  function keystone(t, x, y, R, open, onPath, isSel) {
    const c = onPath ? BLUE : GOLD;
    if (t.mist) { ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgba(160,160,170,.5)"; ctx.lineWidth = 1.2; ring(x, y, R); ctx.setLineDash([]); return; }
    if (open) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, alphaHex(t.hue, 0.1)); g.addColorStop(0.85, alphaHex(t.hue, 0.04)); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; dot(x, y, R);
      ctx.strokeStyle = alphaHex(c, 0.55); ctx.lineWidth = 1.4; ring(x, y, R); ctx.strokeStyle = alphaHex(c, 0.22); ctx.lineWidth = 1; ring(x, y, R - 5);
      ticks(x, y, R + 2, R + 6, Math.round(clamp((R * TAU) / 18, 24, 160)), alphaHex(c, 0.35));
      glow(onPath ? BLUE : t.hue, 22, x, y, 0.8); ctx.fillStyle = FILL; dot(x, y, 7); ctx.strokeStyle = c; ctx.lineWidth = 1.6; ring(x, y, 7); ctx.fillStyle = t.hue; dot(x, y, 3.6);
    } else {
      glow(onPath ? BLUE : t.hue, R * 2.4, x, y, 0.7);
      ctx.fillStyle = FILL; dot(x, y, R);
      const g = ctx.createRadialGradient(x, y - R * 0.3, 0, x, y, R); g.addColorStop(0, alphaHex(t.hue, 0.55)); g.addColorStop(1, alphaHex(t.hue, 0.12)); ctx.fillStyle = g; dot(x, y, R - 4);
      ctx.strokeStyle = c; ctx.lineWidth = 2.4; ring(x, y, R); ctx.strokeStyle = alphaHex(c, 0.5); ctx.lineWidth = 1; ring(x, y, R - 4);
      ticks(x, y, R + 2, R + 5.5, 24, alphaHex(c, 0.55));
    }
    if (isSel) { ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 1.4; ring(x, y, R + 9); }
  }
  function ticks(x, y, r0, r1, n, colour) { ctx.strokeStyle = colour; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a); ctx.moveTo(x + c * r0, y + s * r0); ctx.lineTo(x + c * r1, y + s * r1); } ctx.stroke(); }

  function drawTree() {
    const k = view.k, { focus, near, path } = focusSet(), ox = view.x, oy = view.y;
    const sx = (x) => x * k + ox, sy = (y) => y * k + oy, inView = (x, y, m = 80) => x > -m && x < W + m && y > -m && y < H + m;
    const rcOf = (t) => t.drc ?? t.rc, dim = (r) => !!focus && !near.has(r) && !path.has(r) && r.top !== focus.top;
    // the rings, drawn like the faint arcs behind the passive tree
    for (const R of rings) if (R) { const r = R * k; ctx.strokeStyle = "rgba(201,164,92,.09)"; ctx.lineWidth = 1; ring(ox, oy, r); ring(ox, oy, r + 4); if (r > 40) ticks(ox, oy, r + 4, r + 8, Math.round(clamp((r * TAU) / 16, 24, 400)), "rgba(201,164,92,.07)"); }
    for (const t of topics) { const x = sx(t.x), y = sy(t.y), R = rcOf(t) * k * (cellLevel(t) && t.kids.length ? 1.25 : 3); if (inView(x, y, R)) glow(t.hue, R, x, y, 0.35); }
    // the start, and what each topic builds on
    for (const t of topics) {
      for (const p of t.after.length ? t.after : [null]) {
        const [ax, ay] = p ? toward(p, t.x, t.y, rcOf(p) + 6) : toward({ x: 0, y: 0 }, t.x, t.y, 24), [bx, by] = toward(t, p ? p.x : 0, p ? p.y : 0, rcOf(t) + 6);
        const lit = path.has(t) && (p ? path.has(p) : true);
        ctx.globalAlpha = focus && !lit && !near.has(t) ? 0.35 : 1; carved(sx(ax), sy(ay), sx(bx), sy(by), lit ? "path" : known(t) && (!p || known(p)) ? "lit" : "", p ? 1.25 : 1); ctx.globalAlpha = 1;
      }
    }
    start(ox, oy, focus);
    // cells
    for (const t of topics) {
      const x = sx(t.x), y = sy(t.y), R = rcOf(t) * k; if (!inView(x, y, R)) continue;
      ctx.globalAlpha = dim(t) ? 0.45 : 1; keystone(t, x, y, R, cellLevel(t) && t.kids.length, path.has(t), t.id === sel); ctx.globalAlpha = 1;
    }
    // inside the cells: paths, links, nodes
    for (const r of N.values()) {
      if (r.kind !== "idea" || r.a < 0.02) continue;
      const p = r.parent, x0 = sx(p.x), y0 = sy(p.y), x1 = sx(r.x), y1 = sy(r.y); if (!inView(x0, y0) && !inView(x1, y1)) continue;
      const [ax, ay] = p.kind === "topic" ? [x0 + ((x1 - x0) / (Math.hypot(x1 - x0, y1 - y0) || 1)) * 8, y0 + ((y1 - y0) / (Math.hypot(x1 - x0, y1 - y0) || 1)) * 8] : [x0, y0];
      ctx.globalAlpha = r.a * (dim(r) ? 0.35 : 1); carved(ax, ay, x1, y1, path.has(r) ? "path" : known(r) && (p.kind === "topic" || known(p)) ? "lit" : "", r.depth === 0 ? 0.9 : 0.75); ctx.globalAlpha = 1;
    }
    for (const p of pairs) {
      if (p.a.a < 0.3 || p.b.a < 0.3) continue;
      const on = !!focus && (p.a === focus || p.b === focus || (focus.kind === "topic" && (p.a.top === focus || p.b.top === focus))), ga = p.a.kind === "topic" ? rcOf(p.a) + 6 : 6, gb = p.b.kind === "topic" ? rcOf(p.b) + 6 : 6;
      const [ax, ay] = toward(p.a, p.b.x, p.b.y, ga), [bx, by] = toward(p.b, p.a.x, p.a.y, gb);
      paintLink(p, bowed(sx(ax), sy(ay), sx(bx), sy(by), 0.12), on, !!focus && !on);
    }
    for (const r of N.values()) {
      if (r.kind !== "idea" || r.a < 0.02) continue; const x = sx(r.x), y = sy(r.y); if (!inView(x, y)) continue;
      ctx.globalAlpha = r.a * (dim(r) ? 0.4 : 1); passive(r, x, y, path.has(r), r.id === sel); ctx.globalAlpha = 1;
    }
    // words: the most important first, and none that would land on one already placed
    const boxes = [], free = (b) => boxes.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
    const rank = (r) => (r.id === sel ? 0 : r === focus ? 1 : r.kind === "topic" ? 2 : near.has(r) || path.has(r) ? 3 : r.depth === 0 ? 4 : r.depth === 1 ? 5 : 6);
    const want = (r) => r.a > 0.5 && (rank(r) <= 4 || (r.depth === 1 && k >= 0.55) || k >= 0.9);
    for (const r of shown.filter(want).sort((a, b) => rank(a) - rank(b))) {
      const x = sx(r.x), y = sy(r.y); if (!inView(x, y)) continue;
      const kind = kindOf(r), f = fit(r.title, kind, LABEL); let lx, ly = y;
      if (r.kind === "topic") { const R = rcOf(r) * k, open = cellLevel(r) && r.kids.length; lx = x - f.w / 2; ly = open ? y + 20 : y + R + 16; }
      else { const out = Math.cos(Math.atan2(r.y - r.top.y, r.x - r.top.x)) >= -0.05, R = radius(r) + (r.depth === 0 ? 6 : 4); lx = out ? x + R + 4 : x - R - 4 - f.w; }   // words sit on the outer side of their node
      const b = { x0: lx - 3, y0: ly - 8, x1: lx + f.w + 3, y1: ly + 8 };
      if (rank(r) > 2 && !free(b)) continue; boxes.push(b);
      ctx.globalAlpha = dim(r) ? 0.45 : 1; label(r, f, kind, lx, ly); ctx.globalAlpha = 1;
    }
    // island names at the outer edge of their sector
    for (const q of isles) {
      if (!q.topics.length) continue;
      const out = Math.max(...q.topics.map((t) => t.R + rcOf(t))) + 30, a = (q.a0 + q.a1) / 2, x = ox + Math.cos(a) * out * k, y = oy + Math.sin(a) * out * k;
      ctx.font = "small-caps 600 15px Georgia,'Times New Roman',serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
      ctx.globalAlpha = focus && !q.topics.includes(focus.top) && !q.topics.some((t) => near.has(t) || path.has(t)) ? 0.4 : 0.9; halo(q.name.toLowerCase(), x, y, q.hue); ctx.globalAlpha = 1;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"; ctx.textAlign = "left";
    }
  }
  // The start: a compass star, as at the foot of the passive tree.
  function start(x, y, focus) {
    const lit = !!focus, c = lit ? BLUE : "#bfe6ff";
    glow(c, 60, x, y, lit ? 0.9 : 0.6);
    ctx.strokeStyle = alphaHex(GOLD, 0.8); ctx.lineWidth = 1.4; ring(x, y, 17); ctx.strokeStyle = alphaHex(GOLD, 0.35); ctx.lineWidth = 1; ring(x, y, 21);
    ticks(x, y, 23, 26, 32, alphaHex(GOLD, 0.4));
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, l = i % 4 === 0 ? 34 : i % 2 ? 14 : 22; ctx.strokeStyle = alphaHex(c, i % 4 === 0 ? 0.85 : 0.5); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    ctx.fillStyle = GOLD_HI; dot(x, y, 3.2);
  }
  function label(r, f, kind, lx, ly) {
    ctx.font = FONT[kind]; ctx.textBaseline = "middle";
    if (r.id === sel) { ctx.fillStyle = GOLD; pill(lx - 6, ly - 10, f.w + 12, 20, 4); ctx.fillStyle = "#14100a"; ctx.fillText(f.s, lx, ly + 0.5); return; }
    const colour = r.mist ? "#7d7a72" : r.kind === "topic" ? "#ecdcb2" : r.depth === 0 ? "#dccfae" : known(r) ? "#b7ad96" : "#7e776a";
    halo(f.s, lx, ly + 0.5, colour);
  }

  // Web: the same look; positions scale with zoom, nodes and words keep their size, crowded words are left out.
  function drawWeb() {
    const k = view.k, { focus, near, path } = focusSet();
    const inView = (x, y) => x > -80 && x < W + 80 && y > -40 && y < H + 40;
    for (const q of isles) {
      if (!q.members?.length) continue;
      const x = q.mx * k + view.x, y = q.my * k + view.y, R = q.mr * k; glow(q.hue, R, x, y, 0.45);
      ctx.font = "small-caps 600 15px Georgia,'Times New Roman',serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
      ctx.globalAlpha = focus && ![...near].some((r) => r.isle === q.i) ? 0.45 : 0.9; halo(q.name.toLowerCase(), x, y - R * 0.72, q.hue); ctx.globalAlpha = 1;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"; ctx.textAlign = "left";
    }
    for (const r of N.values()) {
      if (!r.parent) continue; const p = r.parent, x0 = X(p), y0 = Y(p), x1 = X(r), y1 = Y(r);
      if (!inView(x0, y0) && !inView(x1, y1)) continue;
      ctx.globalAlpha = focus && !(near.has(r) && near.has(p)) && !path.has(r) ? 0.25 : 1; carved(x0, y0, x1, y1, path.has(r) && path.has(p) ? "path" : known(r) && known(p) ? "lit" : "", 0.7); ctx.globalAlpha = 1;
    }
    for (const p of pairs) { const on = !!focus && (p.a === focus || p.b === focus); paintLink(p, bowed(X(p.a), Y(p.a), X(p.b), Y(p.b)), on, !!focus && !on); }
    const all = [...N.values()];
    for (const r of all) {
      const x = X(r), y = Y(r); if (!inView(x, y)) continue;
      ctx.globalAlpha = focus && !near.has(r) && !path.has(r) ? (hov ? 0.3 : 0.55) : 1;
      if (r.kind === "topic") keystone(r, x, y, 9 + 2.5 * Math.min(2, r.growth), false, path.has(r), r.id === sel); else passive(r, x, y, path.has(r), r.id === sel);
      ctx.globalAlpha = 1;
    }
    const rank = (r) => (r.id === sel ? 0 : r === focus ? 1 : near.has(r) ? 2 : r.kind === "topic" ? 3 : r.depth === 0 ? 4 : r.depth === 1 ? 5 : 6);
    const want = (r) => rank(r) <= 3 || (r.depth === 0 && k >= 0.7) || (r.depth === 1 && k >= 1.3) || k >= 2;
    const boxes = [], free = (b) => boxes.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
    for (const r of all.filter(want).sort((a, b) => rank(a) - rank(b))) {
      const x = X(r), y = Y(r); if (!inView(x, y)) continue;
      const kind = kindOf(r), f = fit(r.title, kind, LABEL), lx = x + (r.kind === "topic" ? 18 + 2.5 * Math.min(2, r.growth) : radius(r) + 9), b = { x0: lx - 4, y0: y - 9, x1: lx + f.w + 4, y1: y + 9 };
      if (rank(r) > 1 && !free(b)) continue; boxes.push(b);
      ctx.globalAlpha = focus && !near.has(r) ? (hov ? 0.35 : 0.65) : 1; label(r, f, kind, lx, y); ctx.globalAlpha = 1;
    }
  }
  const radius = (r) => (r.kind === "topic" ? 6 + 2.2 * Math.min(2, r.growth) : r.depth === 0 ? 5.5 : 3.6);
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fill(); };
  const ring = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.stroke(); };
  const pill = (x, y, w, h, r = h / 2) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); };
  function halo(s, x, y, colour) { ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(5,7,11,.92)"; ctx.lineWidth = 4; ctx.strokeText(s, x, y); ctx.fillStyle = colour; ctx.fillText(s, x, y); }

  // ---------- view ----------
  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; draw(); kick();
  }
  const pad = () => ({ t: 64, b: 86, l: 16, r: 16 });
  function extent() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    if (mode === "tree") { for (const t of topics) { const m = t.rc + 30; x0 = Math.min(x0, t.tx - m); y0 = Math.min(y0, t.ty - m); x1 = Math.max(x1, t.tx + m); y1 = Math.max(y1, t.ty + m); } }
    else for (const r of N.values()) { x0 = Math.min(x0, r.wx); y0 = Math.min(y0, r.wy); x1 = Math.max(x1, r.wx + 60); y1 = Math.max(y1, r.wy); }
    return isFinite(x0) ? { x0: x0 - 30, y0: y0 - 40, x1: x1 + 30, y1: y1 + 30 } : { x0: -100, y0: -100, x1: 100, y1: 100 };
  }
  function to(x, y, k, now) { Object.assign(goal, { x, y, k, on: !now }); if (now) Object.assign(view, { x, y, k }); kick(); }
  function home(now) {
    const b = extent(), p = pad(), w = W - p.l - p.r, h = H - p.t - p.b, k = clamp(Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0)), 0.15, 1.4);
    auto = mode === "web";
    to(p.l + w / 2 - ((b.x0 + b.x1) / 2) * k, p.t + h / 2 - ((b.y0 + b.y1) / 2) * k, k, now);
  }
  // Bring something into view; a cell that has just opened is fitted whole.
  function show(r, now, whole = false) {
    if (!r) return; const p = pad(), x = mode === "tree" ? r.tx : r.wx, y = mode === "tree" ? r.ty : r.wy;
    let k = goal.on ? goal.k : view.k;
    if (whole && r.kind === "topic") k = clamp(Math.min((W - 40) / (2 * r.rc + 40), (H - p.t - p.b) / (2 * r.rc + 40)), 0.2, 1.3);
    else k = Math.max(k, 0.6);
    const sx = x * k + view.x, sy = y * k + view.y;
    if (!whole && k === view.k && sx > p.l + 40 && sx < W - p.r - 160 && sy > p.t + 30 && sy < H - p.b - 30) return;
    to(W / 2 - x * k, p.t + (H - p.t - p.b) / 2 - y * k, k, now);
  }
  function zoomAt(sx, sy, f) { auto = false; const k = clamp(view.k * f, 0.08, 4); goal.on = false; view.x = sx - ((sx - view.x) * k) / view.k; view.y = sy - ((sy - view.y) * k) / view.k; view.k = k; draw(); }

  // ---------- picking and input ----------
  function hit(sx, sy) {
    let best = null, bd = Infinity;
    for (const r of N.values()) {
      if (r.a < 0.5 || (mode === "tree" && !r.vis)) continue;
      const d = Math.hypot(sx - X(r), sy - Y(r)), open = cellLevel(r.top) && r.top.kids.length;
      const reach = r.kind === "topic" ? (mode === "web" ? 16 : open ? 12 : Math.max(12, (r.drc ?? r.rc) * view.k + 2)) : radius(r) + 7;
      if (d < reach && d < bd) { best = r; bd = d; }
    }
    if (!best && mode === "tree") for (const t of topics) if (cellLevel(t) && t.kids.length && Math.hypot(sx - X(t), sy - Y(t)) < (t.drc ?? t.rc) * view.k) return { cell: t };
    return best;
  }
  const pts = new Map(); let press = null, pinch = null;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; press = null; drag = null; return; }
    const r = hit(e.offsetX, e.offsetY);
    press = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, r, moved: false };
    if (mode === "web" && r && !r.cell) drag = { r }; goal.on = false; auto = false; onHover(null);
  });
  cv.addEventListener("pointermove", (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * d) / pinch.d / view.k); return; }
    if (press) {
      const dx = e.offsetX - press.x, dy = e.offsetY - press.y; if (Math.hypot(dx, dy) > 4) press.moved = true; if (!press.moved) return;
      if (drag) { const r = drag.r; r.wx = r.x = (e.offsetX - view.x) / view.k; r.wy = r.y = (e.offsetY - view.y) / view.k; r.pin = true; pin.add(r.id); alpha = Math.max(alpha, 0.18); settled = false; kick(); }
      else { view.x = press.vx + dx; view.y = press.vy + dy; draw(); }
      return;
    }
    if (e.pointerType === "mouse") { const h = hit(e.offsetX, e.offsetY), r = h && !h.cell ? h : null, id = r?.id || null; cv.style.cursor = r ? "pointer" : ""; if (id !== hov) { hov = id; draw(); } onHover(r ? info(r) : null, e.clientX, e.clientY); }
  });
  cv.addEventListener("pointerup", (e) => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    const p = press; press = null; const d = drag; drag = null;
    if (!p) return;
    if (d && p.moved) { settled = false; alpha = Math.max(alpha, 0.05); kick(); return; }
    if (!p.moved) tap(p.r);
  });
  cv.addEventListener("pointercancel", (e) => { pts.delete(e.pointerId); press = null; drag = null; pinch = null; });
  cv.addEventListener("pointerleave", () => { if (hov) { hov = null; draw(); } onHover(null); });
  cv.addEventListener("dblclick", (e) => { const r = hit(e.offsetX, e.offsetY); if (r && r.kind === "idea") onOpen(info(r)); });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0016))); }, { passive: false });
  // Tapping a topic opens its cell, or closes it again. Tapping an idea picks it.
  function tap(r) {
    if (!r || r.cell) { select(null); return; }
    if (mode === "tree" && r.kind === "topic" && r.kids.length) { sel = r.id; toggle(r.id); onSelect(info(r)); return; }
    select(r.id);
  }

  // ---------- actions ----------
  function info(r) {
    if (!r) return null; const q = isles[r.isle];
    return { id: r.kind === "topic" ? r.zoneId : r.id, kind: r.kind, title: r.title, note: r.note || "", zoneId: r.zoneId, treeId: r.treeId, island: q?.name || "", topic: r.top?.title || "", open: r.kind === "topic" ? cellLevel(r) > 0 : false, ideas: r.kind === "topic" ? r.ideas : r.desc, after: r.kind === "topic" ? (after[r.zoneId] || []) : [] };
  }
  const key = (id) => (N.has(id) ? id : N.has(topicKey(id)) ? topicKey(id) : null);
  function select(id) {
    const k = id && key(id); sel = k || null; const r = N.get(sel);
    if (r && mode === "tree" && !r.vis) { cells.set(r.top.id, 2); layout(); onState(ui()); }
    onSelect(info(r)); if (r) show(r); draw(); kick();
  }
  // A cell opens to everything in it, and closes back to what the level shows (or shut, when the level shows everything).
  function toggle(id, on) {
    const k = key(id); if (!k) return; const t = N.get(k).top; if (!t.kids.length) return;
    const want = on ?? cellLevel(t) < 2;
    if (want) cells.set(t.id, 2); else if (level < 2) cells.delete(t.id); else cells.set(t.id, 0);
    if (sel && N.get(sel)?.top === t && N.get(sel) !== t && !want) sel = t.id;
    if (mode === "tree") { layout(); show(t, false, want); kick(); }
    onState(ui()); if (sel) onSelect(info(N.get(sel)));
  }
  function setLevel(l) {
    level = l; cells.clear();
    const r = N.get(sel); if (r && r.kind === "idea" && !(l >= 2 || r.depth <= 1)) sel = r.top.id;
    if (mode === "tree") { layout(); home(); kick(); }
    onState(ui()); onSelect(info(N.get(sel)));
  }
  function setMode(m) {
    if (m === mode) return; mode = m;
    if (mode === "web") webStart(false); else { for (const r of N.values()) { r.x = r.tx; r.y = r.ty; r.a = r.ta; } pairs = lift(); }
    if (!framed[mode] || !sel) { framed[mode] = true; home(true); } else show(N.get(sel), true);
    onState(ui()); draw(); kick();
  }
  function resetLayout() { if (mode !== "web") return; webStart(true); saveLayout(); home(); kick(); }
  const ui = () => ({ mode, level, cells: Object.fromEntries(cells) });
  // Arrows move to the nearest thing showing in that direction.
  function step(k) {
    const r = N.get(sel), list = mode === "tree" ? shown : [...N.values()];
    if (!r) { const first = [...topics].sort((a, b) => (a.R || 0) - (b.R || 0) || a.ang - b.ang)[0]; if (first) select(first.id); return; }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k]; let best = null, bs = Infinity;
    for (const o of list) { if (o === r) continue; const dx = X(o) - X(r), dy = Y(o) - Y(r), d = Math.hypot(dx, dy) || 1, c = (dx * dir[0] + dy * dir[1]) / d; if (c < 0.5) continue; const s = d * (2 - c); if (s < bs) { bs = s; best = o; } }
    if (best) select(best.id);
  }

  new ResizeObserver(resize).observe(host);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { C = colours(); widths.clear(); draw(); });
  return {
    setData, setMode, setLevel, toggle, select, step, resetLayout, resize,
    get mode() { return mode; }, get level() { return level; }, get selected() { return info(N.get(sel)); },
    setActive(on) { active = on; if (on) { resize(); kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    fit(now) { home(now); }, zoom(f) { zoomAt(W / 2, H / 2, f); },
    focus(id) { const k = key(id); if (!k) return; const r = N.get(k); if (r.kind === "topic") { sel = k; if (r.kids.length) toggle(k, true); else show(r); onSelect(info(r)); } else select(k); },
    // for tests and pictures
    state: () => ({ mode, level, sel, cells: Object.fromEntries(cells), shown: shown.map((r) => r.id), pairs: pairs.map((p) => ({ a: p.a.id, b: p.b.id, n: p.n })), settled: mode === "tree" ? !goal.on && [...N.values()].every((r) => Math.abs(r.tx - r.x) < 0.5 && Math.abs(r.ty - r.y) < 0.5 && Math.abs(r.ta - r.a) < 0.02) : settled,
      topics: Object.fromEntries(topics.map((t) => [t.zoneId, { tier: t.tier, R: Math.round(t.R), rc: Math.round(t.rc) }])) }),
    screenOf(id) { const r = N.get(key(id)); return r && { x: X(r), y: Y(r) }; },
  };
}
