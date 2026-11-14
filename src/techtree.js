// Bonsai: the tech tree. A flat map of everything you know.
// Tree: each island is a lane, its topics down the left, opening out to the key ideas of their
// graphs and on to every idea. Links between ideas are drawn between whatever is open, so a
// folded topic still shows what it connects to. Web: every idea at once, laid out by its
// connections, clustered by island; drag to reshape, positions are kept.
// Drawn on a 2D canvas so it stays light on a phone.

const HUES = ["#5b8def", "#9a7cf0", "#e0709f", "#e8834f", "#d4a23a", "#4fb286", "#35a9b6", "#8a9b48"];
const ROW = 24, TOPIC_X = 0, IDEA_X = 236, COL = 214, ARC = 104, ISLE_W = 260, LANE_GAP = 18, HUB_HEAD = 34, HUB_GAP = 30;
const LABEL = { topic: 172, idea: 146 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const topicKey = (id) => "z:" + id;

export function createTechTree({ host, saved = {}, onSelect = () => {}, onOpen = () => {}, onHover = () => {}, onState = () => {}, onLayout = () => {} }) {
  const cv = document.createElement("canvas"); cv.setAttribute("aria-label", "Tech tree"); host.append(cv);
  const ctx = cv.getContext("2d");
  let W = 1, H = 1, dpr = 1, active = false, raf = 0, last = 0, C = colours();
  let mode = saved.mode === "web" ? "web" : "tree", auto = false, frames = 0, sel = null, hov = null, drag = null, alpha = 0, settled = true, framed = { tree: false, web: false };
  const open = new Set(saved.open || []), view = { x: 0, y: 0, k: 1 }, goal = { x: 0, y: 0, k: 1, on: false };
  let N = new Map(), topics = [], isles = [], hubs = [], raw = [], pairs = [], lanes = [], heads = [], bounds = { x0: 0, y0: 0, x1: 1, y1: 1 }, order = [];
  let pos = saved.pos || {}, pin = new Set(saved.pin || []);
  const widths = new Map();

  function colours() {
    const css = getComputedStyle(document.documentElement), v = (k) => css.getPropertyValue(k).trim();
    const ink = v("--ink") || "#000000";
    return { bg: v("--bg") || "#fff", ink, soft: /^#[0-9a-f]{6}$/i.test(ink) ? `rgba(${parseInt(ink.slice(1, 3), 16)},${parseInt(ink.slice(3, 5), 16)},${parseInt(ink.slice(5), 16)},.78)` : ink, muted: v("--muted") || "#888", line: v("--line") || "#ddd", limb: v("--limb") || "#999", sap: v("--sap") || "#d97706", dark: matchMedia("(prefers-color-scheme: dark)").matches };
  }
  const font = (kind) => (kind === "topic" ? "600 13px " : kind === "root" ? "600 12px " : "500 12px ") + 'system-ui,"Segoe UI",Roboto,sans-serif';
  function fit(text, kind, max) {
    const key = kind + "|" + max + "|" + text; if (widths.has(key)) return widths.get(key);
    const isle = kind === "isle"; ctx.font = isle ? "700 12px system-ui,sans-serif" : font(kind); if (isle && "letterSpacing" in ctx) ctx.letterSpacing = "1.2px";
    let s = text, w = ctx.measureText(s).width;
    if (w > max) { while (s.length > 1 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1); s = s.trimEnd() + "…"; w = ctx.measureText(s).width; }
    if (isle && "letterSpacing" in ctx) ctx.letterSpacing = "0px";
    const r = { s, w }; widths.set(key, r); return r;
  }
  const kindOf = (n) => (n.kind === "topic" ? "topic" : n.depth === 0 ? "root" : "idea");

  // ---------- data ----------
  function setData(d) {
    const old = N; N = new Map(); C = colours(); widths.clear();
    hubs = d.hubs?.length ? d.hubs : [{ id: "", name: "" }];
    isles = d.islands.map((q, i) => ({ ...q, i, hue: HUES[i % HUES.length], topics: [] }));
    const rec = (id, o) => { const p = old.get(id); const r = { id, kids: [], parent: null, vis: false, a: 0, ta: 0, x: 0, y: 0, tx: 0, ty: 0, wx: 0, wy: 0, vx: 0, vy: 0, desc: 0, ...o }; if (p) { r.x = p.x; r.y = p.y; r.a = p.a; r.wx = p.wx; r.wy = p.wy; r.placed = p.placed; } N.set(id, r); return r; };
    topics = d.topics.map((t) => { const isl = isles[t.isle] || isles[0], r = rec(topicKey(t.id), { kind: "topic", zoneId: t.id, title: t.name, isle: isl.i, hue: isl.hue, depth: -1, growth: t.growth || 0, mist: !!t.mist, ideas: t.ideas || 0 }); isl.topics.push(r); return r; });
    const zoneOf = new Map(d.trees.map((t) => [t.id, t])), byParent = new Map();
    for (const n of d.nodes) { const t = zoneOf.get(n.treeId); if (!t || !N.has(topicKey(t.zoneId))) continue; const top = N.get(topicKey(t.zoneId)); rec(n.id, { kind: "idea", title: n.title || "Untitled", note: n.note || "", treeId: n.treeId, zoneId: t.zoneId, isle: top.isle, hue: top.hue, src: n }); }
    for (const n of d.nodes) { const r = N.get(n.id); if (!r) continue; const pid = n.parentId != null && N.has(n.parentId) ? n.parentId : topicKey(r.zoneId); if (!byParent.has(pid)) byParent.set(pid, []); byParent.get(pid).push(r); }
    const treeAt = new Map(d.trees.map((t, i) => [t.id, i])), by = (a, b) => (a.parentId ? 0 : treeAt.get(a.treeId) - treeAt.get(b.treeId)) || (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt));
    for (const [pid, kids] of byParent) { const p = N.get(pid); kids.sort((a, b) => by(a.src, b.src)); p.kids = kids; for (const k of kids) k.parent = p; }
    const walk = (n, depth) => { n.depth = depth; let c = 0; for (const k of n.kids) c += 1 + walk(k, depth + 1); n.desc = c; return c; };
    for (const t of topics) walk(t, -1);
    for (const id of [...open]) if (!N.has(id)) open.delete(id);
    if (sel && !N.has(sel)) sel = null; if (hov && !N.has(hov)) hov = null;
    raw = d.links.filter((l) => N.has(l.fromId) && N.has(l.toId) && l.fromId !== l.toId).map((l) => ({ id: l.id, a: N.get(l.fromId), b: N.get(l.toId), label: l.label || "" }));
    for (const r of N.values()) delete r.src;
    layout(); if (mode === "web") webStart(false);
    if (!framed[mode]) { home(true); framed[mode] = true; }
    kick();
  }

  // ---------- tree layout: lanes of islands, tidy rows inside ----------
  function layout() {
    for (const r of N.values()) { r.vis = false; r.ta = 0; }
    let y = 0; lanes = []; heads = []; order = [];
    const many = hubs.length > 1;
    const place = (n) => {
      n.vis = true; n.ta = 1; n.tx = n.kind === "topic" ? TOPIC_X : IDEA_X + n.depth * COL; order.push(n);
      const kids = open.has(n.id) ? n.kids : [];
      if (!kids.length) { n.ty = y + ROW / 2; y += ROW; return; }
      kids.forEach((c, i) => { if (n.kind === "topic" && i) y += 6; place(c); });
      n.ty = (kids[0].ty + kids[kids.length - 1].ty) / 2;
    };
    hubs.forEach((h, hi) => {
      const list = isles.filter((q) => (many ? (q.hub || 0) === hi : true)); if (many && hi > 0 && !list.length) return;
      if (many) { heads.push({ name: h.name || "Hub", y: y + 12 }); y += HUB_HEAD; }
      for (const q of list) {
        const top = y; y += 36;   // the island's name sits along the top of its lane
        if (!q.topics.length) y += ROW;
        q.topics.forEach((t, i) => { if (i) y += 6; place(t); });
        y += 8; lanes.push({ q, top, bottom: y }); y += LANE_GAP;
      }
      if (many) y += HUB_GAP;
    });
    for (const r of N.values()) if (!r.vis) { let v = r.parent; while (v && !v.vis) v = v.parent; v ||= r; r.tx = v.tx; r.ty = v.ty; }
    for (const r of N.values()) if (r.a === 0 && r.vis && r.parent) { let v = r.parent; while (v && v.a === 0 && v.parent) v = v.parent; r.x = v.x; r.y = v.y; }   // new rows grow out of their parent
    for (const r of N.values()) if (r.vis && r.kind === "topic" && r.a === 0 && !r.placed) { r.x = r.tx; r.y = r.ty; r.placed = true; }
    let x1 = IDEA_X; for (const n of order) x1 = Math.max(x1, n.tx + 24 + (n.kind === "topic" ? LABEL.topic : LABEL.idea));
    bounds = { x0: -ARC - 18, y0: -10, x1: x1 + 20, y1: y };
    pairs = lift();
  }
  // A link between two ideas is drawn between the nearest things that are open.
  function lift() {
    const shown = (r) => { if (mode === "web") return r; while (r && !r.vis) r = r.parent; return r; };
    const m = new Map();
    for (const l of raw) {
      const a = shown(l.a), b = shown(l.b); if (!a || !b || a === b) continue;
      const k = a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
      const p = m.get(k) || { a, b, n: 0, label: "", direct: false }; p.n++; if (a === l.a && b === l.b) { p.direct = true; p.label ||= l.label; } m.set(k, p);
    }
    return [...m.values()];
  }

  // ---------- web: everything, by its connections ----------
  let rnd = 1; const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  function webStart(reset) {
    if (reset) { pos = {}; pin.clear(); for (const r of N.values()) r.placed = false; }
    rnd = 7; const n = isles.length || 1, R = n > 1 ? 150 * Math.sqrt(n) + 140 : 0;
    isles.forEach((q, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; q.cx = R * Math.cos(a); q.cy = R * Math.sin(a); });
    let fresh = 0;
    const put = (r, x, y) => { const p = pos[r.id]; if (p) { r.wx = p[0]; r.wy = p[1]; } else if (!r.placed) { r.wx = x; r.wy = y; fresh++; } r.placed = true; r.vx = r.vy = 0; r.pin = pin.has(r.id); };
    for (const q of isles) q.topics.forEach((t, k) => {
      const a = (k / Math.max(1, q.topics.length)) * Math.PI * 2 + 0.4; put(t, q.cx + 95 * Math.cos(a), q.cy + 95 * Math.sin(a));
      const grow = (p) => p.kids.forEach((c) => { const b = rand() * Math.PI * 2; put(c, p.wx + 26 * Math.cos(b), p.wy + 26 * Math.sin(b)); grow(c); }); grow(t);
    });
    for (const r of N.values()) { r.x = r.wx; r.y = r.wy; }
    alpha = fresh || reset ? 1 : Math.max(alpha, 0.08); settled = false;
    pairs = lift();
  }
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
  const sub = (n) => { const out = []; const go = (x) => { for (const k of x.kids) { out.push(k); go(k); } }; go(n); return out; };
  function saveLayout() { pos = {}; for (const r of N.values()) pos[r.id] = [Math.round(r.wx), Math.round(r.wy)]; onLayout({ pos, pin: [...pin] }); }

  // ---------- frame ----------
  function frame(t) {
    raf = 0; const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    let moving = false; const e = 1 - Math.exp(-dt * 13);
    if (mode === "tree") {
      for (const r of N.values()) {
        r.x += (r.tx - r.x) * e; r.y += (r.ty - r.y) * e; r.a += (r.ta - r.a) * Math.min(1, e * 1.4);
        if (Math.abs(r.tx - r.x) > 0.3 || Math.abs(r.ty - r.y) > 0.3 || Math.abs(r.ta - r.a) > 0.01) moving = true; else { r.x = r.tx; r.y = r.ty; r.a = r.ta; }
      }
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

  // ---------- drawing ----------
  const alphaHex = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function focusSet() {
    const focus = N.get(hov) || N.get(sel), near = new Set();
    if (focus) { near.add(focus); for (const p of pairs) { if (p.a === focus) near.add(p.b); if (p.b === focus) near.add(p.a); } if (mode === "web") { if (focus.parent) near.add(focus.parent); for (const c of focus.kids) near.add(c); } }
    return { focus, near };
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (mode === "web") drawWeb(); else drawTree();
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.textAlign = "left";
  }
  function linkStroke(p, on, dim, px) {
    const a = p.a, b = p.b, same = a.isle === b.isle, al = dim ? 0.1 : on ? 0.95 : same ? 0.42 : 0.55, w = Math.min(4.5, 1.1 + Math.log2(p.n) * 0.9) * (on ? 1.3 : 1);
    return { same, al, w: Math.max(px, w), dash: same ? [3, 4] : [7, 4] };
  }
  function paintLink(p, c, st, ax, ay, bx, by) {
    if (st.same) ctx.strokeStyle = alphaHex(p.a.hue, st.al);
    else { const g = ctx.createLinearGradient(ax, ay, bx, by); g.addColorStop(0, alphaHex(p.a.hue, st.al)); g.addColorStop(1, alphaHex(p.b.hue, st.al)); ctx.strokeStyle = g; }
    ctx.lineWidth = st.w; ctx.setLineDash(st.dash); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]); ctx.stroke();
  }

  // Tree: drawn in the map's own units, so the whole thing scales like a picture.
  function drawTree() {
    const k = view.k, px = 1 / k, { focus } = focusSet(), text = k * 12 >= 7.5;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.x, dpr * view.y);
    const vy0 = -view.y / k - 40, vy1 = (H - view.y) / k + 40, vx0 = -view.x / k - 300, vx1 = (W - view.x) / k + 300;
    const inView = (r) => r.y > vy0 && r.y < vy1 && r.x > vx0 && r.x < vx1;
    drawLanes(k, text);
    ctx.lineCap = "round";
    for (const r of N.values()) {
      if (!r.parent || r.a < 0.02 || r.parent.a < 0.02) continue;
      const p = r.parent; if (!inView(r) && !inView(p)) continue;
      ctx.strokeStyle = alphaHex(r.hue, 0.42 * Math.min(r.a, p.a)); ctx.lineWidth = Math.max(px, 1.3);
      const sx = p.x + labelEnd(p) + 8, mx = (sx + r.x) / 2; ctx.beginPath(); ctx.moveTo(sx, p.y); ctx.bezierCurveTo(mx, p.y, mx, r.y, r.x - 6, r.y); ctx.stroke();
    }
    for (const p of pairs) {
      const a = p.a, b = p.b; if (a.a < 0.3 || b.a < 0.3) continue;
      if (Math.max(a.y, b.y) < vy0 - 200 || Math.min(a.y, b.y) > vy1 + 200) continue;
      const on = !!focus && (a === focus || b === focus), st = linkStroke(p, on, !!focus && !on, px), c = route(a, b);
      paintLink(p, c, st, a.x, a.y, b.x, b.y);
      if (on && p.direct && p.label && text) { const m = bez(c, 0.5); ctx.setLineDash([]); ctx.font = "italic 500 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; halo(p.label, m[0], m[1] - 7, C.sap); ctx.textAlign = "left"; }
    }
    ctx.setLineDash([]);
    const list = order.concat([...N.values()].filter((r) => !r.vis && r.a > 0.02)).filter((r) => r.id !== sel); if (N.get(sel)?.vis) list.push(N.get(sel));
    for (const r of list) {
      if (r.a < 0.02 || !inView(r)) continue;
      const rad = radius(r), folded = r.kids.length && !open.has(r.id);
      ctx.globalAlpha = r.a; node(r, r.x, r.y, rad, folded);
      if (r.kind === "topic" ? k * 13 >= 6.5 : text) {
        const kind = kindOf(r), f = fit(r.title, kind, r.kind === "topic" ? LABEL.topic : LABEL.idea), lx = r.x + rad + 7;
        label(r, f, kind, lx, r.y);
        if (folded && text) { ctx.font = "500 11px system-ui,sans-serif"; ctx.fillStyle = C.muted; ctx.fillText(String(r.kind === "topic" ? r.ideas : r.desc), lx + f.w + 7, r.y + 0.5); }
      }
      ctx.globalAlpha = 1;
    }
  }
  function node(r, x, y, rad, folded) {
    if (r.mist) { ctx.setLineDash([2.5, 2.5]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2; ring(x, y, rad); ctx.setLineDash([]); }
    else { if (folded) { ctx.fillStyle = alphaHex(r.hue, 0.18); dot(x, y, rad + 3.5); } ctx.fillStyle = r.depth > 0 ? alphaHex(r.hue, 0.85) : r.hue; dot(x, y, rad); }
    if (r.id === sel) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ring(x, y, rad + 4); }
  }
  function label(r, f, kind, lx, ly) {
    ctx.font = font(kind); ctx.textBaseline = "middle";
    if (r.id === sel) { ctx.fillStyle = C.ink; pill(lx - 5, ly - 10, f.w + 10, 20); ctx.fillStyle = C.bg; ctx.fillText(f.s, lx, ly + 0.5); }
    else halo(f.s, lx, ly + 0.5, r.mist ? C.muted : r.depth > 1 ? C.soft : C.ink);
  }
  function drawLanes(k, text) {
    ctx.textBaseline = "middle";
    for (const h of heads) {
      ctx.font = "700 11px system-ui,sans-serif"; if ("letterSpacing" in ctx) ctx.letterSpacing = "1.6px";
      ctx.fillStyle = C.muted; ctx.fillText(h.name.toUpperCase(), bounds.x0 + 4, h.y);
      const w = ctx.measureText(h.name.toUpperCase()).width; if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.strokeStyle = C.line; ctx.lineWidth = 1 / k; ctx.beginPath(); ctx.moveTo(bounds.x0 + w + 16, h.y); ctx.lineTo(bounds.x1, h.y); ctx.stroke();
    }
    for (const L of lanes) {
      const q = L.q; ctx.fillStyle = alphaHex(q.hue, C.dark ? 0.07 : 0.055); pill(bounds.x0, L.top, bounds.x1 - bounds.x0, L.bottom - L.top, 12);
      ctx.fillStyle = q.hue; ctx.fillRect(bounds.x0, L.top + 10, 3, Math.max(8, L.bottom - L.top - 20));
      if (k * 12 >= 5) {
        const f = fit(q.name.toUpperCase(), "isle", ISLE_W - 30); ctx.font = "700 12px system-ui,sans-serif"; if ("letterSpacing" in ctx) ctx.letterSpacing = "1.2px";
        ctx.fillStyle = q.hue; ctx.fillText(f.s, bounds.x0 + 18, L.top + 20); if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
        if (text) { ctx.font = "500 11px system-ui,sans-serif"; ctx.fillStyle = C.muted; const n = q.topics.length; ctx.fillText(n ? String(n) : "", bounds.x0 + 18 + f.w + 12, L.top + 20.5); }
      }
    }
  }
  // Where a link runs in the tree. Topic to topic: an arc in the gutter on the left. Two ideas in one column with
  // nothing open to their right: a bracket on the right, past their labels. Across columns: out of the left one's
  // label and into the right one's dot, like a branch but dashed. Otherwise a short bow on the left.
  function route(a, b) {
    const dy = Math.abs(a.y - b.y), free = (r) => !(r.kids.length && open.has(r.id)), end = (r) => r.x + labelEnd(r) + 6;
    if (a.kind === "topic" && b.kind === "topic") { const bow = Math.min(ARC - 14, 18 + dy * 0.2); return [a.x - radius(a) - 2, a.y, a.x - bow, a.y + (b.y - a.y) * 0.1, b.x - bow, b.y - (b.y - a.y) * 0.1, b.x - radius(b) - 2, b.y]; }
    if (Math.abs(a.x - b.x) < 1) {
      if (free(a) && free(b) && a.kind !== "topic") { const xa = end(a), xb = end(b), m = Math.max(xa, xb) + Math.min(70, 14 + dy * 0.08); return [xa, a.y, m, a.y, m, b.y, xb, b.y]; }
      const bow = Math.min(34, 10 + dy * 0.05); return [a.x - radius(a) - 2, a.y, a.x - bow, a.y, b.x - bow, b.y, b.x - radius(b) - 2, b.y];
    }
    const [l, r] = a.x < b.x ? [a, b] : [b, a], sx = free(l) ? end(l) : l.x + radius(l) + 2, ex = r.x - radius(r) - 3, d = Math.max(30, (ex - sx) * 0.5);
    const c = [sx, l.y, sx + d, l.y, ex - d, r.y, ex, r.y]; return a === l ? c : [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];
  }
  const bez = (c, t) => { const u = 1 - t; return [u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6], u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7]]; };

  // Web: positions scale with zoom, dots and words stay the same size on screen, and words that would collide are left out.
  function drawWeb() {
    const k = view.k, X = (r) => r.x * k + view.x, Y = (r) => r.y * k + view.y, { focus, near } = focusSet();
    const inView = (x, y) => x > -80 && x < W + 80 && y > -40 && y < H + 40;
    for (const q of isles) {
      if (!q.members?.length) continue;
      const x = q.mx * k + view.x, y = q.my * k + view.y, R = q.mr * k, g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, alphaHex(q.hue, C.dark ? 0.13 : 0.1)); g.addColorStop(1, alphaHex(q.hue, 0)); ctx.fillStyle = g; dot(x, y, R);
      ctx.font = "700 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; if ("letterSpacing" in ctx) ctx.letterSpacing = "1.4px";
      ctx.globalAlpha = focus && !near.has(q.topics[0]) && ![...near].some((r) => r.isle === q.i) ? 0.45 : 1; ctx.fillStyle = q.hue; ctx.fillText(q.name.toUpperCase(), x, y - R * 0.72); ctx.globalAlpha = 1;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"; ctx.textAlign = "left";
    }
    ctx.lineCap = "round";
    for (const r of N.values()) {
      if (!r.parent) continue; const p = r.parent, x0 = X(p), y0 = Y(p), x1 = X(r), y1 = Y(r);
      if (!inView(x0, y0) && !inView(x1, y1)) continue;
      ctx.strokeStyle = alphaHex(r.hue, focus ? (near.has(r) && near.has(p) ? 0.6 : 0.07) : 0.26); ctx.lineWidth = r.depth <= 0 ? 1.4 : 1;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    for (const p of pairs) {
      const ax = X(p.a), ay = Y(p.a), bx = X(p.b), by = Y(p.b), on = !!focus && (p.a === focus || p.b === focus), st = linkStroke(p, on, !!focus && !on, 1);
      const mx = (ax + bx) / 2, my = (ay + by) / 2, c = [ax, ay, mx - (by - ay) * 0.14, my + (bx - ax) * 0.14, mx - (by - ay) * 0.14, my + (bx - ax) * 0.14, bx, by];
      paintLink(p, c, st, ax, ay, bx, by);
      if (on && p.direct && p.label) { const m = bez(c, 0.5); ctx.setLineDash([]); ctx.font = "italic 500 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; halo(p.label, m[0], m[1] - 7, C.sap); ctx.textAlign = "left"; }
    }
    ctx.setLineDash([]);
    const all = [...N.values()];
    for (const r of all) {
      const x = X(r), y = Y(r); if (!inView(x, y)) continue;
      ctx.globalAlpha = focus && !near.has(r) ? (hov ? 0.22 : 0.5) : 1; node(r, x, y, radius(r), false); ctx.globalAlpha = 1;
    }
    // words, most important first; any that would overlap one already placed are skipped
    const rank = (r) => (r.id === sel ? 0 : r === focus ? 1 : near.has(r) ? 2 : r.kind === "topic" ? 3 : r.depth === 0 ? 4 : r.depth === 1 ? 5 : 6);
    const want = (r) => rank(r) <= 3 || (r.depth === 0 && k >= 0.7) || (r.depth === 1 && k >= 1.3) || k >= 2;
    const boxes = [], free = (b) => boxes.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
    for (const r of all.filter(want).sort((a, b) => rank(a) - rank(b))) {
      const x = X(r), y = Y(r); if (!inView(x, y)) continue;
      const kind = kindOf(r), f = fit(r.title, kind, r.kind === "topic" ? LABEL.topic : LABEL.idea), lx = x + radius(r) + 6, b = { x0: lx - 4, y0: y - 9, x1: lx + f.w + 4, y1: y + 9 };
      if (rank(r) > 1 && !free(b)) continue; boxes.push(b);
      ctx.globalAlpha = focus && !near.has(r) ? (hov ? 0.3 : 0.6) : 1; label(r, f, kind, lx, y); ctx.globalAlpha = 1;
    }
  }
  const radius = (r) => (r.kind === "topic" ? (mode === "web" ? 6 : 5.5) + 2.2 * Math.min(2, r.growth) : r.depth === 0 ? (mode === "web" ? 3.6 : 4.2) : mode === "web" ? 2.4 : 3.2);
  const labelEnd = (r) => radius(r) + 7 + fit(r.title, kindOf(r), r.kind === "topic" ? LABEL.topic : LABEL.idea).w + (r.kind === "topic" && r.kids.length && !open.has(r.id) ? 30 : 0);
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const ring = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
  const pill = (x, y, w, h, r = h / 2) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); };
  function halo(s, x, y, colour) { ctx.lineJoin = "round"; ctx.strokeStyle = C.bg; ctx.lineWidth = 3.5; ctx.strokeText(s, x, y); ctx.fillStyle = colour; ctx.fillText(s, x, y); }

  // ---------- view ----------
  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; draw(); kick();
  }
  const pad = () => ({ t: 64, b: 86, l: 16, r: 16 });
  function extent() {
    if (mode === "tree") return bounds;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of N.values()) { x0 = Math.min(x0, r.wx); y0 = Math.min(y0, r.wy); x1 = Math.max(x1, r.wx + 60); y1 = Math.max(y1, r.wy); }
    return isFinite(x0) ? { x0: x0 - 30, y0: y0 - 40, x1: x1 + 30, y1: y1 + 30 } : { x0: 0, y0: 0, x1: 1, y1: 1 };
  }
  function to(x, y, k, now) { Object.assign(goal, { x, y, k, on: !now }); if (now) Object.assign(view, { x, y, k }); kick(); }
  // Fit everything; a tall tree starts at its top at a readable size rather than shrunk to nothing.
  function home(now) {
    const b = extent(), p = pad(), w = W - p.l - p.r, h = H - p.t - p.b, fw = w / (b.x1 - b.x0), fh = h / (b.y1 - b.y0);
    const k = mode === "tree" ? clamp(Math.min(fw, Math.max(fh, 0.85)), W < 700 ? 0.82 : 0.62, 1.1) : clamp(Math.min(fw, fh), 0.2, 1.4); auto = mode === "web";
    const x = (b.x1 - b.x0) * k < w ? p.l + (w - (b.x1 - b.x0) * k) / 2 - b.x0 * k : p.l - b.x0 * k;
    const y = (b.y1 - b.y0) * k < h ? p.t + (h - (b.y1 - b.y0) * k) / 2 - b.y0 * k : p.t - b.y0 * k;
    to(x, y, k, now);
  }
  function show(r, now) {
    if (!r) return; const p = pad(), x = mode === "tree" ? r.tx : r.wx, y = mode === "tree" ? r.ty : r.wy, k = Math.max(goal.on ? goal.k : view.k, mode === "tree" ? 0.8 : 0.9), cx = view.x, cy = view.y;
    const sx = x * k + cx, sy = y * k + cy, right = mode === "tree" ? 180 : 80;
    if (sx > p.l + 30 && sx < W - p.r - right && sy > p.t + 20 && sy < H - p.b - 20 && k === view.k) return;
    to(clamp(W * 0.42 - x * k, -Infinity, Infinity), H * 0.45 - y * k, k, now);
  }
  function zoomAt(sx, sy, f) { auto = false; const k = clamp(view.k * f, 0.15, 3.5); goal.on = false; view.x = sx - ((sx - view.x) * k) / view.k; view.y = sy - ((sy - view.y) * k) / view.k; view.k = k; draw(); }

  // ---------- picking and input ----------
  function hit(sx, sy) {
    const x = (sx - view.x) / view.k, y = (sy - view.y) / view.k, web = mode === "web", slack = web ? 7 : 8 / view.k; let best = null, bd = Infinity;
    for (const r of N.values()) {
      if (r.a < 0.5 || (mode === "tree" && !r.vis)) continue;
      const rad = radius(r) + slack, dx = web ? sx - (r.x * view.k + view.x) : x - r.x, dy = web ? sy - (r.y * view.k + view.y) : y - r.y, d = Math.hypot(dx, dy);
      if (d < rad && d < bd) { best = r; bd = d; continue; }
      if (mode === "tree" && dx > 0 && dx < labelEnd(r) + 4 && Math.abs(dy) < ROW / 2 - 1 && bd === Infinity) best = r;
    }
    return best;
  }
  const pts = new Map(); let press = null, pinch = null;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; press = null; drag = null; return; }
    const r = hit(e.offsetX, e.offsetY);
    press = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, r, moved: false, type: e.pointerType };
    if (mode === "web" && r) drag = { r }; goal.on = false; auto = false; onHover(null);
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
    if (e.pointerType === "mouse") { const r = hit(e.offsetX, e.offsetY), id = r?.id || null; cv.style.cursor = r ? "pointer" : ""; if (id !== hov) { hov = id; draw(); } onHover(r ? info(r) : null, e.clientX, e.clientY); }
  });
  const up = (e) => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    const p = press; press = null; const d = drag; drag = null;
    if (!p) return;
    if (d && p.moved) { settled = false; alpha = Math.max(alpha, 0.05); kick(); return; }
    if (p.moved) return;
    tap(p.r, p.type);
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", (e) => { pts.delete(e.pointerId); press = null; drag = null; pinch = null; });
  cv.addEventListener("pointerleave", () => { if (hov) { hov = null; draw(); } onHover(null); });
  cv.addEventListener("dblclick", (e) => { const r = hit(e.offsetX, e.offsetY); if (r && r.kind === "idea") onOpen(info(r)); });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0016))); }, { passive: false });
  // A tap selects; tapping a folded branch opens it, tapping the open one folds it again.
  function tap(r, type) {
    if (!r) { select(null); return; }
    if (mode === "tree" && r.kids.length && (r.id === sel || type === "mouse")) toggle(r.id);
    select(r.id);
  }

  // ---------- actions ----------
  function info(r) {
    if (!r) return null; const q = isles[r.isle], t = N.get(topicKey(r.zoneId));
    return { id: r.kind === "topic" ? r.zoneId : r.id, kind: r.kind, title: r.title, note: r.note || "", zoneId: r.zoneId, treeId: r.treeId, island: q?.name || "", topic: t?.title || "", kids: r.kids.length, open: open.has(r.id), ideas: r.kind === "topic" ? r.ideas : r.desc };
  }
  const key = (id) => (N.has(id) ? id : N.has(topicKey(id)) ? topicKey(id) : null);
  function select(id, { reveal = false } = {}) {
    const k = id && key(id); sel = k || null;
    if (reveal && sel) { let p = N.get(sel).parent, grew = false; while (p) { if (!open.has(p.id)) { open.add(p.id); grew = true; } p = p.parent; } if (grew) { layout(); onState(ui()); } }
    onSelect(info(N.get(sel))); if (sel) show(N.get(sel)); draw(); kick();
  }
  function toggle(id, on) {
    const k = key(id); if (!k || !N.get(k).kids.length) return;
    const want = on ?? !open.has(k); if (want) open.add(k); else { open.delete(k); for (const d of sub(N.get(k))) open.delete(d.id); }
    if (mode === "tree") { layout(); kick(); } onState(ui()); if (sel) onSelect(info(N.get(sel)));
  }
  // 0: topics only; 1: topics opened to the key ideas (each graph's trunk and main branches); 2: everything.
  function setLevel(l) {
    open.clear();
    if (l >= 1) for (const t of topics) { if (t.kids.length) open.add(t.id); for (const c of t.kids) if (c.kids.length) open.add(c.id); }
    if (l >= 2) for (const r of N.values()) if (r.kids.length) open.add(r.id);
    if (sel && l < 2) { let r = N.get(sel); while (r && !(r.kind === "topic" || (l >= 1 && r.depth <= 1))) r = r.parent; sel = r?.id || null; onSelect(info(N.get(sel))); }
    if (mode === "tree") { layout(); if (sel) show(N.get(sel)); else home(); kick(); }
    onState(ui());
  }
  function level() {
    const exp = [...N.values()].filter((r) => r.kids.length), keyset = new Set(); for (const t of topics) { if (t.kids.length) keyset.add(t.id); for (const c of t.kids) if (c.kids.length) keyset.add(c.id); }
    if (!open.size) return 0; if (open.size === keyset.size && [...keyset].every((x) => open.has(x))) return 1; if (exp.every((r) => open.has(r.id))) return 2; return -1;
  }
  function setMode(m) {
    if (m === mode) return; mode = m;
    if (mode === "web") webStart(false); else { for (const r of N.values()) { r.x = r.tx; r.y = r.ty; r.a = r.ta; } pairs = lift(); }
    if (!framed[mode]) { framed[mode] = true; home(true); } else if (sel) show(N.get(sel), true); else home(true);
    onState(ui()); draw(); kick();
  }
  function resetLayout() { if (mode !== "web") return; webStart(true); saveLayout(); home(); kick(); }
  const ui = () => ({ mode, open: [...open] });
  // Keys: arrows walk the tree like a file list (→ opens, ← folds or steps out); in the web they move to the nearest idea that way.
  function step(k) {
    const r = N.get(sel);
    if (!r) { const first = mode === "tree" ? order[0] : topics[0]; if (first) select(first.id); return; }
    if (mode === "tree") {
      const i = order.indexOf(r);
      if (k === "ArrowDown" && order[i + 1]) select(order[i + 1].id);
      else if (k === "ArrowUp" && i > 0) select(order[i - 1].id);
      else if (k === "ArrowRight") { if (r.kids.length && !open.has(r.id)) toggle(r.id, true); else if (r.kids.length) select(r.kids[0].id); }
      else if (k === "ArrowLeft") { if (open.has(r.id)) toggle(r.id, false); else if (r.parent) select(r.parent.id); }
      return;
    }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k]; let best = null, bs = Infinity;
    for (const o of N.values()) { if (o === r) continue; const dx = o.wx - r.wx, dy = o.wy - r.wy, d = Math.hypot(dx, dy) || 1, c = (dx * dir[0] + dy * dir[1]) / d; if (c < 0.5) continue; const s = d * (2 - c); if (s < bs) { bs = s; best = o; } }
    if (best) select(best.id);
  }

  new ResizeObserver(resize).observe(host);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { C = colours(); widths.clear(); draw(); });
  return {
    setData, setMode, setLevel, level, toggle, select, step, resetLayout, resize,
    get mode() { return mode; }, get selected() { return info(N.get(sel)); },
    setActive(on) { active = on; if (on) { resize(); kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    fit(now) { home(now); }, zoom(f) { zoomAt(W / 2, H / 2, f); },
    focus(id) { const k = key(id); if (!k) return; select(k, { reveal: true }); const r = N.get(k); if (r.kids.length && !open.has(k)) toggle(k, true); show(r); },
    // for tests and pictures
    state: () => ({ mode, level: level(), sel, open: [...open], shown: order.map((r) => r.id), pairs: pairs.map((p) => ({ a: p.a.id, b: p.b.id, n: p.n })), settled: mode === "tree" ? !raf : settled, view: { ...view } }),
    screenOf(id) { const r = N.get(key(id)); return r && { x: r.x * view.k + view.x, y: r.y * view.k + view.y }; },
  };
}
