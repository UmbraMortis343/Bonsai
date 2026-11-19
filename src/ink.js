// Pen notes: a page you write on, after reMarkable, with the tools on a rail docked right.
// Ink is kept as strokes in page units (the page is W wide and grows downward), so it stays sharp at any zoom
// and can be moved. A stroke: { id, t: "pen" | "hl", c: colour role, p: [x, y, w, x, y, w, …] }.
// Colours are roles, drawn per theme, so writing reads the same by day and night.
// Pen and mouse draw; touch pans and pinches (never draws unless Touch draws is on). Palm rejection: any pen
// activity, hover included, drops every touch in progress and ignores new ones for a while; a big contact patch
// is a palm and is ignored for good; a finger only pans once it has really moved. The pen's eraser end, or its barrel button, erases.

export const W = 1000;
export const PAPERS = ["lined", "grid", "dots", "blank"];
const PEN = [1.6, 2.8, 5], HL = [14, 22, 34];
// [day, night] per role
const INK = [["#1f1e1b", "#ecebe6"], ["#3d6a37", "#93c383"], ["#a06d24", "#dcab5e"], ["#7c786f", "#aaa69c"]];
const HI = [["#e6be4e", "#b8913a"], ["#a9d095", "#5e8a4f"], ["#d9cfbf", "#5b574f"], ["#e9a58c", "#9a5a46"]];
const PAPER = { day: { bg: "#fbfaf7", line: "#e4e0d6", edge: "#ece9e1" }, night: { bg: "#1d1d1b", line: "#34332f", edge: "#2a2a27" } };
const GAP = 36;   // between lines, grid squares and dots

export const inkColour = (s, night) => (s.t === "hl" ? HI : INK)[s.c % 4][night ? 1 : 0];
export const strokeBox = (s) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < s.p.length; i += 3) { const r = s.p[i + 2] / 2; x0 = Math.min(x0, s.p[i] - r); y0 = Math.min(y0, s.p[i + 1] - r); x1 = Math.max(x1, s.p[i] + r); y1 = Math.max(y1, s.p[i + 1] + r); }
  return { x0, y0, x1, y1 };
};
// Does a stroke come within r of (x, y)? Checks its segments, not just its points.
export function strokeNear(s, x, y, r) {
  const p = s.p;
  for (let i = 0; i < p.length; i += 3) {
    const ax = p[i], ay = p[i + 1], rr = r + p[i + 2] / 2;
    if (i + 3 >= p.length) { if ((ax - x) ** 2 + (ay - y) ** 2 <= rr * rr) return true; break; }
    const bx = p[i + 3], by = p[i + 4], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    if ((ax + t * dx - x) ** 2 + (ay + t * dy - y) ** 2 <= rr * rr) return true;
  }
  return false;
}
export function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Lasso: a stroke is caught when most of its points are inside.
export const caught = (poly, s) => { let n = 0; for (let i = 0; i < s.p.length; i += 3) if (inPoly(poly, s.p[i], s.p[i + 1])) n++; return n * 3 >= s.p.length * 0.6; };
// Width from pressure and tilt: harder is wider, and a pen held over on its side lays a broader line, like a pencil.
export function widthFor(base, e, tool) {
  if (tool === "hl") return base;
  const pr = e.pointerType === "mouse" || !e.pressure ? 0.5 : e.pressure;
  const tilt = Math.min(1, Math.hypot(e.tiltX || 0, e.tiltY || 0) / 70);
  return base * (0.35 + 1.3 * pr) * (1 + 1.1 * tilt * tilt);
}

// opts: { host, el, icon, doc: { paper, strokes }, onChange(doc), night() }
export function createInk(opts) {
  const { el } = opts;
  const doc = { paper: PAPERS.includes(opts.doc?.paper) ? opts.doc.paper : "lined", strokes: (opts.doc?.strokes || []).map((s) => ({ ...s, p: s.p.slice() })) };
  let pre = (() => { try { return JSON.parse(localStorage.getItem(opts.store || "bonsai.ink") || "null") || {}; } catch { return {}; } })();
  const st = { tool: "pen", c: pre.c ?? 0, size: pre.size ?? 1, touchDraws: pre.touchDraws ?? matchMedia("(pointer: coarse)").matches, zoom: 1, sx: 0, sy: 0 };
  const undo = [], redo = [];
  let sel = null;          // { ids: Set, box }
  let live = null, lasso = null, drag = null, penAt = 0, dirty = 0, raf = 0;
  const PALM_MS = 1500, PALM_PX = 30, SLOP = 12, palms = new Set();
  const penNear = () => performance.now() - penAt < PALM_MS;
  const sawPen = () => { penAt = performance.now(); if (touches.size) { for (const id of touches.keys()) { palms.add(id); try { canvas.releasePointerCapture(id); } catch {} } touches.clear(); pinch = null; } };
  const bigContact = (e) => (e.width || 0) > PALM_PX || (e.height || 0) > PALM_PX;
  const touches = new Map(); let pinch = null;

  const canvas = el("canvas", { class: "inkc", tabIndex: 0, "aria-label": "Page to write on" });
  const wrap = el("div", { class: "inkwrap" }, canvas);
  const ctx = canvas.getContext("2d");
  const layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  const night = () => !!opts.night?.();
  const out = () => ({ paper: doc.paper, strokes: doc.strokes.map(({ id, t, c, p }) => ({ id, t, c, p })) });
  const save = () => { clearTimeout(dirty); dirty = setTimeout(() => { dirty = 0; opts.onChange?.(out()); }, 400); };
  const keep = () => { try { localStorage.setItem(opts.store || "bonsai.ink", JSON.stringify({ c: st.c, size: st.size, touchDraws: st.touchDraws })); } catch {} };

  // ---- view: page units → canvas pixels
  const fit = () => Math.max(0.2, (wrap.clientWidth - 32) / W);
  const scale = () => fit() * st.zoom;
  const ox = () => { const s = scale(), w = wrap.clientWidth; return W * s < w ? (w - W * s) / 2 : 16 - st.sx * s; };
  const toPage = (cx, cy) => { const s = scale(); return [(cx - ox()) / s, (cy - 16) / s + st.sy]; };
  const pageH = () => { let h = 1400; for (const s of doc.strokes) for (let i = 1; i < s.p.length; i += 3) h = Math.max(h, s.p[i] + 700); return Math.ceil(h / GAP) * GAP; };
  function clampView() {
    const s = scale(), H = pageH();
    st.sy = Math.max(0, Math.min(st.sy, H - (wrap.clientHeight - 32) / s));
    const over = W - (wrap.clientWidth - 32) / s; st.sx = over > 0 ? Math.max(0, Math.min(st.sx, over)) : 0;
  }
  function zoomAt(z, cx, cy) {
    const [px, py] = toPage(cx, cy);
    st.zoom = Math.max(0.5, Math.min(6, z));
    const s = scale(); st.sy = py - (cy - 16) / s; st.sx = px - (cx - 16) / s;
    clampView(); full();
  }

  // ---- drawing
  function size() {
    const r = devicePixelRatio || 1, w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return false;
    for (const c of [canvas, layer]) if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    return true;
  }
  function trace(g, s, from = 0) {
    const p = s.p, n = p.length / 3;
    if (s.t === "hl") {   // one path at one width, so a highlighter never darkens where it crosses itself
      g.lineWidth = p[2]; g.beginPath(); g.moveTo(p[0], p[1]);
      for (let i = 1; i < n; i++) g.lineTo(p[i * 3], p[i * 3 + 1]);
      if (n === 1) g.lineTo(p[0] + 0.01, p[1]);
      g.stroke(); return;
    }
    if (n === 1) { g.beginPath(); g.arc(p[0], p[1], p[2] / 2, 0, 7); g.fill(); return; }
    // segments through the midpoints, each at its own width
    for (let i = Math.max(1, from); i < n; i++) {
      const ax = i > 1 ? (p[i * 3 - 6] + p[i * 3 - 3]) / 2 : p[0], ay = i > 1 ? (p[i * 3 - 5] + p[i * 3 - 2]) / 2 : p[1];
      const bx = i < n - 1 ? (p[i * 3 - 3] + p[i * 3]) / 2 : p[i * 3], by = i < n - 1 ? (p[i * 3 - 2] + p[i * 3 + 1]) / 2 : p[i * 3 + 1];
      g.lineWidth = (p[i * 3 - 1] + p[i * 3 + 2]) / 2;
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(p[i * 3 - 3], p[i * 3 - 2], bx, by); g.stroke();
    }
  }
  function paint(g, s) {
    const nt = night();
    g.strokeStyle = g.fillStyle = inkColour(s, nt);
    g.globalAlpha = s.t === "hl" ? (nt ? 0.42 : 0.5) : 1;
    g.globalCompositeOperation = s.t === "hl" ? (nt ? "screen" : "multiply") : "source-over";
    trace(g, s);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
  // the page and everything kept on it, into the layer
  function full() {
    if (!size()) return;
    const r = devicePixelRatio || 1, s = scale(), nt = night(), P = PAPER[nt ? "night" : "day"], w = wrap.clientWidth, h = wrap.clientHeight;
    const g = lctx; g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h);
    g.translate(ox(), 16); g.scale(s, s); g.translate(0, -st.sy);
    const top = st.sy, bot = st.sy + h / s, H = pageH();
    g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = P.edge; g.lineWidth = 1 / s; g.strokeRect(0, 0, W, H);
    g.strokeStyle = g.fillStyle = P.line; g.lineWidth = Math.max(0.6, 1 / s);
    const y0 = Math.max(GAP, Math.floor(top / GAP) * GAP), y1 = Math.min(H, bot);
    if (doc.paper === "lined") { g.beginPath(); for (let y = Math.max(GAP * 2, y0); y < y1; y += GAP) { g.moveTo(GAP, y); g.lineTo(W - GAP, y); } g.stroke(); }
    if (doc.paper === "grid") { g.beginPath(); for (let y = y0; y < y1; y += GAP) { g.moveTo(0, y); g.lineTo(W, y); } for (let x = GAP; x < W; x += GAP) { g.moveTo(x, Math.max(0, top)); g.lineTo(x, y1); } g.stroke(); }
    if (doc.paper === "dots") for (let y = y0; y < y1; y += GAP) for (let x = GAP; x < W; x += GAP) { g.beginPath(); g.arc(x, y, Math.max(1.3, 1.4 / s), 0, 7); g.fill(); }
    g.lineCap = g.lineJoin = "round";
    for (const t of ["hl", "pen"]) for (const k of doc.strokes) if (k.t === t) { const b = k._b || (k._b = strokeBox(k)); if (b.y1 >= top && b.y0 <= bot) paint(g, k); }
    frame();
  }
  // the layer, then what's being drawn now
  function frame() {
    cancelAnimationFrame(raf); raf = 0;
    const r = devicePixelRatio || 1, s = scale(), w = wrap.clientWidth, h = wrap.clientHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(layer, 0, 0);
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.translate(ox(), 16); ctx.scale(s, s); ctx.translate(0, -st.sy);
    ctx.lineCap = ctx.lineJoin = "round";
    if (live && !live.eraser) paint(ctx, live);
    const acc = getComputedStyle(wrap).getPropertyValue("--accent").trim() || "#3d6a37";
    if (lasso) { ctx.strokeStyle = acc; ctx.lineWidth = 1.5 / s; ctx.setLineDash([6 / s, 5 / s]); ctx.beginPath(); for (let i = 0; i < lasso.length; i += 2) ctx[i ? "lineTo" : "moveTo"](lasso[i], lasso[i + 1]); ctx.stroke(); ctx.setLineDash([]); }
    if (sel) { const b = sel.box; ctx.strokeStyle = acc; ctx.lineWidth = 1.5 / s; ctx.setLineDash([6 / s, 5 / s]); ctx.strokeRect(b.x0 - 8, b.y0 - 8, b.x1 - b.x0 + 16, b.y1 - b.y0 + 16); ctx.setLineDash([]); }
    if (st.tool === "eraser" && eraserAt) { ctx.strokeStyle = INK[3][night() ? 1 : 0]; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.arc(eraserAt[0], eraserAt[1], eraseR(), 0, 7); ctx.stroke(); }
  }
  const later = () => { if (!raf) raf = requestAnimationFrame(frame); };
  let eraserAt = null;
  const eraseR = () => 9 + 7 * st.size;

  // ---- edits, each undoable
  function commit(op) { op.redo(); undo.push(op); if (undo.length > 200) undo.shift(); redo.length = 0; save(); full(); bar(); }
  const addOp = (s) => ({ redo: () => doc.strokes.push(s), undo: () => { const i = doc.strokes.indexOf(s); if (i >= 0) doc.strokes.splice(i, 1); } });
  const removeOp = (gone) => { const at = gone.map((s) => doc.strokes.indexOf(s)); return { redo: () => { doc.strokes = doc.strokes.filter((s) => !gone.includes(s)); }, undo: () => { gone.forEach((s, i) => doc.strokes.splice(Math.min(at[i], doc.strokes.length), 0, s)); } }; };
  const moveOp = (list, dx, dy) => { const by = (k) => () => { for (const s of list) { for (let i = 0; i < s.p.length; i += 3) { s.p[i] += k * dx; s.p[i + 1] += k * dy; } s._b = null; } }; return { redo: by(1), undo: by(-1), done: true }; };
  const colourOp = (list, c) => { const was = list.map((s) => s.c); return { redo: () => list.forEach((s) => { s.c = c; }), undo: () => list.forEach((s, i) => { s.c = was[i]; }) }; };
  function step(from, to) { const op = from.pop(); if (!op) return; op[from === undo ? "undo" : "redo"](); to.push(op); clearSel(); save(); full(); bar(); }
  const picked = () => (sel ? doc.strokes.filter((s) => sel.ids.has(s.id)) : []);
  function selBox(list) { const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; for (const s of list) { const k = s._b || (s._b = strokeBox(s)); b.x0 = Math.min(b.x0, k.x0); b.y0 = Math.min(b.y0, k.y0); b.x1 = Math.max(b.x1, k.x1); b.y1 = Math.max(b.y1, k.y1); } return b; }
  function clearSel() { if (!sel) return; sel = null; frame(); bar(); }
  let nid = 0; const sid = () => Date.now().toString(36) + (nid++).toString(36);

  // ---- pointers
  const capture = (e) => { try { canvas.setPointerCapture(e.pointerId); } catch {} };
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const erasing = (e) => e.pointerType === "pen" && ((e.buttons & 32) || e.button === 5 || (e.buttons & 2));
  function eraseAt(x, y) {
    const r = eraseR(), hit = doc.strokes.filter((s) => { const b = s._b || (s._b = strokeBox(s)); return x >= b.x0 - r && x <= b.x1 + r && y >= b.y0 - r && y <= b.y1 + r && strokeNear(s, x, y, r); });
    if (!hit.length) return;
    for (const s of hit) { live.gone.push([doc.strokes.indexOf(s) + live.gone.length, s]); doc.strokes.splice(doc.strokes.indexOf(s), 1); }
    full();
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") sawPen();
    if (e.pointerType === "touch") {
      if (penNear() || bigContact(e) || live) { palms.add(e.pointerId); e.preventDefault(); return; }   // a palm
      if (!st.touchDraws || touches.size) {
        const at = local(e); at.start = at.slice(); at.moved = false;
        touches.set(e.pointerId, at); capture(e);
        if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: st.zoom, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], on: false }; }
        if (touches.size > 2) { for (const id of touches.keys()) palms.add(id); touches.clear(); pinch = null; }   // three or more contacts: a hand, not fingers
        return;
      }
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (live || drag || lasso) return;
    e.preventDefault(); canvas.focus({ preventScroll: true }); capture(e);
    const [x, y] = toPage(...local(e));
    const tool = erasing(e) ? "eraser" : st.tool;
    if (sel && tool === "lasso") { const b = sel.box; if (x >= b.x0 - 8 && x <= b.x1 + 8 && y >= b.y0 - 8 && y <= b.y1 + 8) { drag = { id: e.pointerId, x, y, dx: 0, dy: 0 }; return; } }
    clearSel();
    if (tool === "lasso") { lasso = [x, y]; lasso.id = e.pointerId; return; }
    if (tool === "eraser") { live = { eraser: true, id: e.pointerId, gone: [] }; eraserAt = [x, y]; eraseAt(x, y); return; }
    const base = (st.tool === "hl" ? HL : PEN)[st.size];
    live = { id: sid(), t: st.tool === "hl" ? "hl" : "pen", c: st.c, p: [x, y, widthFor(base, e, st.tool)], pid: e.pointerId };
    frame();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "pen") sawPen();
    if (palms.has(e.pointerId)) return;
    if (e.pointerType === "touch" && bigContact(e) && touches.has(e.pointerId)) { palms.add(e.pointerId); touches.delete(e.pointerId); pinch = null; return; }
    if (touches.has(e.pointerId)) {
      const was = touches.get(e.pointerId), now = local(e); now.start = was.start; now.moved = was.moved || Math.hypot(now[0] - was.start[0], now[1] - was.start[1]) > SLOP;
      touches.set(e.pointerId, now);
      if (!now.moved) return;   // a resting finger or palm doesn't nudge the page
      if (touches.size === 2 && pinch) {
        const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (!pinch.on) { pinch.on = true; pinch.d = d; pinch.m = m; pinch.z = st.zoom; return; }   // start from here, not from where the fingers landed
        const s = scale(); st.sy -= (m[1] - pinch.m[1]) / s; st.sx -= (m[0] - pinch.m[0]) / s; pinch.m = m;
        zoomAt(pinch.z * d / pinch.d, m[0], m[1]);
      } else if (touches.size === 1) { const s = scale(); st.sy -= (now[1] - was[1]) / s; st.sx -= (now[0] - was[0]) / s; clampView(); full(); }
      return;
    }
    if (e.pointerType === "touch") return;
    const [x, y] = toPage(...local(e));
    if (st.tool === "eraser" && !live) { eraserAt = [x, y]; later(); }
    if (drag && e.pointerId === drag.id) { const ddx = x - drag.x, ddy = y - drag.y; drag.x = x; drag.y = y; drag.dx += ddx; drag.dy += ddy; moveOp(picked(), ddx, ddy).redo(); sel.box = selBox(picked()); full(); return; }
    if (lasso && e.pointerId === lasso.id) { lasso.push(x, y); later(); return; }
    if (!live) return;
    if (live.eraser) { eraserAt = [x, y]; eraseAt(x, y); return; }
    if (e.pointerId !== live.pid) return;
    const base = (live.t === "hl" ? HL : PEN)[st.size];
    const co = e.getCoalescedEvents?.();
    for (const c of co?.length ? co : [e]) {
      const [px, py] = toPage(...local(c)), p = live.p, lx = p[p.length - 3], ly = p[p.length - 2];
      if ((px - lx) ** 2 + (py - ly) ** 2 < 0.5) continue;
      const w = widthFor(base, c, live.t === "hl" ? "hl" : "pen"), lw = p[p.length - 1];
      p.push(px, py, lw + (w - lw) * 0.35);   // ease the width so a pressure jitter doesn't show
    }
    later();
  });
  const up = (e) => {
    if (palms.delete(e.pointerId)) return;
    if (touches.delete(e.pointerId)) { if (touches.size < 2) pinch = null; return; }
    if (drag && e.pointerId === drag.id) {
      const op = moveOp(picked(), drag.dx, drag.dy), moved = drag.dx || drag.dy; drag = null;
      if (moved) { undo.push(op); redo.length = 0; save(); bar(); }   // already moved while dragging
      return;
    }
    if (lasso && e.pointerId === lasso.id) {
      const poly = lasso; lasso = null;
      const list = poly.length > 6 ? doc.strokes.filter((s) => caught(poly, s)) : [];
      sel = list.length ? { ids: new Set(list.map((s) => s.id)), box: selBox(list) } : null;
      frame(); bar(); return;
    }
    if (!live) return;
    const s = live; live = null;
    if (s.eraser) {   // put them back where they were, then take them out as one undoable step
      eraserAt = null; if (!s.gone.length) return frame();
      for (const [i, g] of [...s.gone].sort((a, b) => a[0] - b[0])) doc.strokes.splice(Math.min(i, doc.strokes.length), 0, g);
      return commit(removeOp(s.gone.map((g) => g[1])));
    }
    if (e.pointerId !== s.pid) return;
    delete s.pid; s.p = s.p.map((v) => Math.round(v * 10) / 10);
    commit(addOp(s));
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  const penAnywhere = (e) => { if (e.pointerType === "pen") sawPen(); };
  document.addEventListener("pointermove", penAnywhere, true); document.addEventListener("pointerover", penAnywhere, true);
  canvas.addEventListener("pointerleave", () => { if (eraserAt && !live) { eraserAt = null; frame(); } });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [cx, cy] = local(e);
    if (e.ctrlKey || e.metaKey) return zoomAt(st.zoom * Math.exp(-e.deltaY * 0.0022), cx, cy);
    const s = scale(), k = e.deltaMode === 1 ? 32 : 1;
    if (e.shiftKey) st.sx += (e.deltaY * k) / s; else { st.sy += (e.deltaY * k) / s; st.sx += (e.deltaX * k) / s; }
    clampView(); full();
  }, { passive: false });

  // ---- the rail
  const tools = [["pen", "Pen", "P", "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"], ["hl", "Highlighter", "H", "M9 14l7-7 3 3-7 7H9zM9 14l-4 4v2h4l3-3M4 21h16"], ["eraser", "Eraser", "E", "M8 20h11M4 15l9-9 6 6-7 7H8z"], ["lasso", "Lasso", "L", "M12 5c4.4 0 8 2.2 8 5s-3.6 5-8 5-8-2.2-8-5 3.6-5 8-5zM7 14c-1 1.5-1.5 3-.5 5"]];
  const rail = el("aside", { class: "inkrail", "aria-label": "Pen tools" });
  function bar() {
    const nt = night(), btn = (id, label, key, d, on, run, extra) => el("button", { class: "ibtn" + (on ? " on" : ""), type: "button", id, title: `${label} (${key})`, "aria-label": label, "aria-pressed": on == null ? null : String(!!on), onclick: () => { run(); canvas.focus({ preventScroll: true }); } },
      extra || opts.icon(d), el("kbd", { text: key }));
    const sw = (c) => el("button", { class: "iswatch" + (st.c === c ? " on" : ""), type: "button", dataset: { c }, title: `Colour ${c + 1} (C)`, "aria-label": `Colour ${c + 1}`, "aria-pressed": String(st.c === c),
      onclick: () => { setColour(c); canvas.focus({ preventScroll: true }); } }, el("span", { style: "background:" + (st.tool === "hl" ? HI : INK)[c][nt ? 1 : 0] }));
    rail.replaceChildren(
      el("div", { class: "igroup" }, tools.map(([id, label, key, d]) => btn("ink-" + id, label, key, d, st.tool === id, () => setTool(id)))),
      el("div", { class: "igroup" }, [0, 1, 2, 3].map(sw), el("kbd", { class: "ikey", text: "C" })),
      el("div", { class: "igroup" }, btn("ink-size", "Size", "S", null, null, () => setSize((st.size + 1) % 3), el("span", { class: "isize" }, [0, 1, 2].map((k) => el("i", { class: k === st.size ? "on" : "", style: `width:${4 + k * 3}px;height:${4 + k * 3}px` }))))),
      el("div", { class: "igroup" },
        btn("ink-undo", "Undo", "Ctrl+Z", "M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12", null, () => step(undo, redo)),
        btn("ink-redo", "Redo", "Ctrl+Y", "M15 7l5 5-5 5M20 12H10a6 6 0 0 0 0 12", null, () => step(redo, undo))),
      el("div", { class: "igroup" },
        btn("ink-in", "Zoom in", "+", "M11 5v12M5 11h12M16 16l4 4", null, () => zoomBy(1.25)),
        btn("ink-out", "Zoom out", "−", "M5 11h12M16 16l4 4", null, () => zoomBy(0.8)),
        btn("ink-fit", "Fit width", "0", "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", null, () => { st.zoom = 1; st.sx = 0; clampView(); full(); })),
      el("div", { class: "igroup" },
        btn("ink-paper", "Paper: " + doc.paper, "B", { lined: "M4 7h16M4 12h16M4 17h16", grid: "M4 4h16v16H4zM4 12h16M12 4v16", dots: "M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01", blank: "M5 4h14v16H5z" }[doc.paper], null, nextPaper),
        btn("ink-touch", st.touchDraws ? "Touch draws" : "Touch pans", "T", "M9 11V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v2M17 12a2 2 0 0 1 4 0v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-3l-2.5-4a2 2 0 0 1 3.4-2L9 14", st.touchDraws, () => { st.touchDraws = !st.touchDraws; keep(); bar(); })));
    rail.querySelector("#ink-undo").disabled = !undo.length; rail.querySelector("#ink-redo").disabled = !redo.length;
  }
  function setTool(t) { st.tool = t; if (t !== "lasso") clearSel(); eraserAt = null; bar(); frame(); }
  function setColour(c) {
    st.c = c; keep();
    const list = picked(); if (list.length) commit(colourOp(list, c)); else bar();
  }
  function setSize(k) { st.size = k; keep(); bar(); }
  function nextPaper() { doc.paper = PAPERS[(PAPERS.indexOf(doc.paper) + 1) % PAPERS.length]; save(); full(); bar(); }
  function zoomBy(k) { zoomAt(st.zoom * k, wrap.clientWidth / 2, wrap.clientHeight / 2); }
  function del() { const list = picked(); if (!list.length) return false; sel = null; commit(removeOp(list)); return true; }

  // keys, while the page is open and you're not typing in a box
  const typing = () => { const a = document.activeElement; return a && a !== canvas && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  function onKey(e) {
    if (typing() || document.querySelector(".dialog") || e.altKey || !wrap.isConnected) return;
    // beside a graph its keys stay the graph's unless you're on the page
    if (opts.global === false && !wrap.contains(document.activeElement) && !rail.contains(document.activeElement)) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, done = () => { e.preventDefault(); e.stopPropagation(); };
    if (mod && !e.shiftKey && (k === "z" || k === "Z")) { done(); return step(undo, redo); }
    if (mod && (k === "y" || ((k === "z" || k === "Z") && e.shiftKey))) { done(); return step(redo, undo); }
    if (mod && (k === "=" || k === "+")) { done(); return zoomBy(1.25); }
    if (mod && k === "-") { done(); return zoomBy(0.8); }
    if (mod) return;
    const tool = { p: "pen", h: "hl", e: "eraser", l: "lasso" }[k.toLowerCase()];
    if (tool && !e.shiftKey) { done(); return setTool(tool); }
    if (k === "c" || k === "C") { done(); return setColour((st.c + (e.shiftKey ? 3 : 1)) % 4); }
    if (k === "s") { done(); return setSize((st.size + 1) % 3); }
    if (k === "b") { done(); return nextPaper(); }
    if (k === "t") { done(); st.touchDraws = !st.touchDraws; keep(); return bar(); }
    if (k === "+" || k === "=") { done(); return zoomBy(1.25); }
    if (k === "-") { done(); return zoomBy(0.8); }
    if (k === "0") { done(); st.zoom = 1; st.sx = 0; clampView(); return full(); }
    if ((k === "Delete" || k === "Backspace") && (sel || document.activeElement === canvas)) { done(); return del(); }   // never the page itself from here
    if (k === "Escape" && sel && !e.shiftKey) { done(); return clearSel(); }
    if (k === "PageDown" || k === "PageUp" || (document.activeElement === canvas && (k === "ArrowDown" || k === "ArrowUp"))) {
      done(); st.sy += ((k === "PageDown" || k === "ArrowDown" ? 1 : -1) * (k.startsWith("Page") ? wrap.clientHeight * 0.85 : 60)) / scale(); clampView(); return full();
    }
  }
  document.addEventListener("keydown", onKey, true);
  const ro = new ResizeObserver(() => { clampView(); full(); }); ro.observe(wrap);
  const mo = new MutationObserver(() => { full(); bar(); }); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  const mq = matchMedia("(prefers-color-scheme: dark)"), onMq = () => { full(); bar(); }; mq.addEventListener?.("change", onMq);
  bar(); requestAnimationFrame(full);
  opts.host.append(wrap, rail);

  return {
    wrap, rail, canvas,
    get doc() { return doc; }, get tool() { return st.tool; }, get colour() { return st.c; }, get size() { return st.size; }, get zoom() { return st.zoom; }, get selected() { return picked().map((s) => s.id); },
    get view() { return { zoom: st.zoom, sx: st.sx, sy: st.sy, scale: scale(), ox: ox() }; },
    toScreen: (x, y) => { const r = canvas.getBoundingClientRect(), s = scale(); return [r.left + ox() + x * s, r.top + 16 + (y - st.sy) * s]; },
    setTool, setColour, setSize, undo: () => step(undo, redo), redo: () => step(redo, undo), redraw: () => { full(); bar(); },
    flush: () => { if (dirty) { clearTimeout(dirty); dirty = 0; opts.onChange?.(out()); } },
    focus: () => canvas.focus({ preventScroll: true }),
    destroy: () => { document.removeEventListener("pointermove", penAnywhere, true); document.removeEventListener("pointerover", penAnywhere, true); document.removeEventListener("keydown", onKey, true); ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", onMq); cancelAnimationFrame(raf); },
  };
}
