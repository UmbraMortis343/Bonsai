// Pen pages: a canvas you write on, after reMarkable and OneNote, with the tools on a rail docked right.
// Ink is kept as strokes in page units, so it stays sharp at any zoom and can be moved. The page is an endless canvas,
// like a OneNote page: it starts at its top-left corner (0, 0) and runs on without end to the right and downward; the
// paper fills the view wherever you are. At 100% a page unit is a CSS pixel. Pages made when the page was a sheet W
// wide keep their ink where it was. A stroke: { id, t: "pen" | "pencil" | "marker" | "hl", c, p: [x, y, w, x, y, w, …] }, where c is a
// colour role 0–3 (drawn per theme, so writing reads the same by day and night) or a fixed "#rrggbb".
// Beside the ink the page holds items: text boxes { id, t: "text", x, y, w, html, c } and pictures
// { id, t: "img", x, y, w, h, src }. Pictures are drawn under the ink, text boxes over it.
// Pen draws (always, unless the Text tool is on); the mouse draws when dragged and makes or opens a text box when
// clicked; touch pans and pinches (never draws unless Touch draws is on). Palm rejection: while the pen is on the
// page, and for a moment after it lifts, touch is ignored and any touch in progress is dropped; a touch resting
// there before the pen came near is dropped when it arrives; a contact patch the size of a palm is ignored; a finger
// only pans once it has really moved. The pen's eraser end, or its barrel button, erases.

export const W = 1000;   // the width pages had when they were sheets; nothing is held to it now
export const PAPERS = ["blank", "lined", "grid", "dots"];
// what the paper menu offers, with its keys; dots stays for old pages that have it
export const PAPER_MENU = [["blank", "None", "1"], ["lined", "Ruled", "2"], ["grid", "Grid", "3"]];
const PAPER_ICON = { lined: "M4 7h16M4 12h16M4 17h16", grid: "M4 4h16v16H4zM4 12h16M12 4v16", dots: "M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01", blank: "M5 4h14v16H5z" };
export const ZOOM = [0.25, 4];
const FAR = 1e6;   // as far as the view goes: endless for any page anyone writes
// The paper a new pen page starts on: the one last picked (kept with the pen's settings), else ruled.
export function lastPaper(store = "bonsai.ink") {
  try { const p = JSON.parse(localStorage.getItem(store) || "null")?.paper; return PAPER_MENU.some(([id]) => id === p) ? p : "lined"; } catch { return "lined"; }
}
export const BRUSHES = ["pen", "pencil", "marker", "hl"];
const SIZES = { pen: [1.6, 2.8, 5], pencil: [1.4, 2.4, 3.8], marker: [3.2, 5.5, 9], hl: [14, 22, 34] };
// [day, night] per role
const INK = [["#1f1e1b", "#ecebe6"], ["#3d6a37", "#93c383"], ["#a06d24", "#dcab5e"], ["#7c786f", "#aaa69c"]];
const HI = [["#e6be4e", "#b8913a"], ["#a9d095", "#5e8a4f"], ["#d9cfbf", "#5b574f"], ["#e9a58c", "#9a5a46"]];
// fixed colours, the same by day and night: earth tones from the app's palette family
export const EXTRA = ["#b5483e", "#c46a3a", "#c9962e", "#6f7a35", "#2f6b45", "#2f5d5a", "#7a4a68", "#5b4636"];
const PAPER = { day: { bg: "#fbfaf7", line: "#e4e0d6" }, night: { bg: "#1d1d1b", line: "#34332f" } };
const GAP = 36;   // between lines, grid squares and dots; a text box's line height, so typing sits on the lines
const FONT = 22;

export const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
export const inkColour = (s, night) => (isHex(s.c) ? s.c : (s.t === "hl" ? HI : INK)[(((Math.trunc(+s.c) || 0) % 4) + 4) % 4][night ? 1 : 0]);
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
// Lasso: a stroke is caught when most of its points are inside; a box when most of its corners and middle are.
export const caught = (poly, s) => { let n = 0; for (let i = 0; i < s.p.length; i += 3) if (inPoly(poly, s.p[i], s.p[i + 1])) n++; return n * 3 >= s.p.length * 0.6; };
export const caughtBox = (poly, b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1], [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]].filter(([x, y]) => inPoly(poly, x, y)).length >= 3;
// Width from pressure and tilt: harder is wider, and a pen held over on its side lays a broader line, like a pencil.
// The marker and highlighter keep one width.
export function widthFor(base, e, tool) {
  if (tool === "hl" || tool === "marker") return base;
  const pr = e.pointerType === "mouse" || !e.pressure ? 0.5 : e.pressure;
  const tilt = Math.min(1, Math.hypot(e.tiltX || 0, e.tiltY || 0) / 70);
  if (tool === "pencil") return base * (0.5 + 0.9 * pr) * (1 + 1.8 * tilt * tilt);
  return base * (0.35 + 1.3 * pr) * (1 + 1.1 * tilt * tilt);
}
// A text box keeps only bold, italic, underline and line breaks.
const KEEP = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", BR: "br", DIV: "div", P: "div", LI: "div" };
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function cleanText(html) {
  const t = document.createElement("template"); t.innerHTML = html || "";
  const walk = (n) => {
    let o = "";
    for (const c of n.childNodes) {
      if (c.nodeType === 3) o += esc(c.textContent);
      else if (c.nodeType === 1) { const k = KEEP[c.tagName], inner = walk(c); o += k === "br" ? "<br>" : k ? `<${k}>${inner}</${k}>` : inner; }
    }
    return o;
  };
  return walk(t.content).replace(/(<br>|<div>(<br>)?<\/div>)+$/, "");
}
export const textHtml = (text) => esc(text.replace(/\r\n?/g, "\n")).replace(/\n/g, "<br>");
const plain = (html) => { const t = document.createElement("template"); t.innerHTML = html || ""; return t.content.textContent.trim(); };
const okItem = (it) => it && typeof it.id === "string" && isFinite(it.x) && isFinite(it.y) && isFinite(it.w) &&
  ((it.t === "text" && typeof it.html === "string") || (it.t === "img" && isFinite(it.h) && /^data:image\/(png|jpeg|webp|gif);base64,/.test(it.src || "")));
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// The pencil's grain: each pixel either holds the colour or doesn't, so where a stroke's pieces overlap it never darkens.
const grains = new Map();
function grainTile(col) {
  let c = grains.get(col); if (c) return c;
  c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), d = g.createImageData(64, 64), [r, gg, b] = hexRgb(col);
  let seed = 11;
  for (let i = 0; i < 64 * 64; i++) { seed = (seed * 16807) % 2147483647; d.data.set([r, gg, b, seed / 2147483647 < 0.78 ? 255 : 0], i * 4); }
  g.putImageData(d, 0, 0); grains.set(col, c); return c;
}
function grain(g, col, px) { const pat = g.createPattern(grainTile(col), "repeat"); pat.setTransform?.(new DOMMatrix().scale(1 / px)); return pat; }

// opts: { host, el, icon, doc: { paper, strokes, items }, onChange(doc), night(), store, key (the page's id, for its view), global, toText, name() }
export function createInk(opts) {
  const { el } = opts;
  const doc = {
    paper: PAPERS.includes(opts.doc?.paper) ? opts.doc.paper : lastPaper(opts.store),
    strokes: (opts.doc?.strokes || []).filter((s) => s && Array.isArray(s.p) && s.p.length >= 3).map((s) => ({ ...s, t: BRUSHES.includes(s.t) ? s.t : "pen", p: s.p.slice() })),
    items: (opts.doc?.items || []).filter(okItem).map((it) => ({ ...it })),
  };
  const pre = (() => { try { return JSON.parse(localStorage.getItem(opts.store || "bonsai.ink") || "null") || {}; } catch { return {}; } })();
  const coarseOnly = matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;   // a phone: no mouse or pen to draw with
  const st = { tool: "pen", c: isHex(pre.c) || [0, 1, 2, 3].includes(pre.c) ? pre.c : 0, size: pre.size ?? 1, touchDraws: pre.touchDraws ?? coarseOnly, zoom: 1, sx: 0, sy: 0, extra: isHex(pre.extra) ? pre.extra : null, custom: (pre.custom || []).filter(isHex).slice(0, 4), back: "pen", paper: PAPER_MENU.some(([id]) => id === pre.paper) ? pre.paper : null };
  const undo = [], redo = [];
  let sel = null;          // { ids: Set, box }
  let G = null;            // what the pointer on the page is doing: { k: stroke | erase | lasso | drag | resize | snip | tap, id, … }
  let dirty = 0, raf = 0, editing = null, palOpen = false, paperOpen = false, snipped = null, snipTimer = 0, spaceDown = false;
  const log = [];          // the last pointer events, for checking a device: bonsai.S.ed.ink.log
  const note = (e) => { log.push([Math.round(e.timeStamp), e.type.slice(7), e.pointerType, e.pointerId, e.buttons, Math.round((e.pressure || 0) * 100) / 100, Math.round(e.width || 0), Math.round(e.height || 0)]); if (log.length > 240) log.splice(0, 40); };

  // ---- palm rejection
  const PALM_MS = 300, NEAR_MS = 1500, PALM_PX = 50, SLOP = 10, SLOP_NEAR = 18;
  let penDown = 0, penUpAt = -Infinity, hoverAt = -Infinity;
  const now = () => performance.now();
  const penBusy = () => !!penDown || now() - penUpAt < PALM_MS;     // on the page, or only just lifted
  const penNear = () => now() - hoverAt < NEAR_MS;
  const bigContact = (e) => Math.max(e.width || 0, e.height || 0) > PALM_PX;
  const touches = new Map(); let pinch = null, panning = false;
  const palms = new Set();
  const toPalms = (ids) => { for (const id of ids) { palms.add(id); try { wrap.releasePointerCapture(id); } catch {} } };
  function dropTouches(all) {   // all: the pen is down. Otherwise only those resting there before the pen came near.
    const gone = [...touches].filter(([, t]) => all || !t.moved).map(([id]) => id);
    if (!gone.length) return;
    toPalms(gone); for (const id of gone) touches.delete(id);
    pinch = null; if (!touches.size) panning = false;
  }
  function penSeen(e) {
    const t = now();
    if (e.buttons === 0) {
      if (t - hoverAt >= NEAR_MS) dropTouches(false);   // the pen arrives: a resting touch is a palm
      if (penDown && !(G && G.id === penDown)) { penDown = 0; penUpAt = t; }   // hovering again, so it lifted
    }
    hoverAt = t;
  }
  function penContact(e) {
    penDown = e.pointerId; hoverAt = now(); dropTouches(true);
    if (G?.touch) { if (G.k === "stroke") later(); G = null; }   // a palm that had started drawing by touch
  }

  const canvas = el("canvas", { class: "inkc", tabIndex: 0, "aria-label": "Page to write on" });
  const layerEl = el("div", { class: "inkitems" });
  const handle = el("div", { class: "ihandle", hidden: true, title: "Size" });
  layerEl.append(handle);
  const wrap = el("div", { class: "inkwrap" }, canvas, layerEl);
  const ctx = canvas.getContext("2d");
  const layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  const night = () => !!opts.night?.();
  const r1 = (v) => Math.round(v * 10) / 10;
  const out = () => ({
    paper: doc.paper, strokes: doc.strokes.map(({ id, t, c, p }) => ({ id, t, c, p })),
    items: doc.items.map((it) => (it.t === "img" ? { id: it.id, t: "img", x: r1(it.x), y: r1(it.y), w: r1(it.w), h: r1(it.h), src: it.src } : { id: it.id, t: "text", x: r1(it.x), y: r1(it.y), w: r1(it.w), html: it.html, c: it.c ?? 0 })),
  });
  const save = () => { clearTimeout(dirty); dirty = setTimeout(() => { dirty = 0; opts.onChange?.(out()); }, 400); };
  const keep = () => { try { localStorage.setItem(opts.store || "bonsai.ink", JSON.stringify({ c: st.c, size: st.size, touchDraws: st.touchDraws, extra: st.extra, custom: st.custom, paper: st.paper })); } catch {} };
  // where each page was looked at, kept on this device: { pageId: [sx, sy, zoom, at] }, the latest 200
  const VIEWS = (opts.store || "bonsai.ink") + "view";
  const views = () => { try { return JSON.parse(localStorage.getItem(VIEWS) || "null") || {}; } catch { return {}; } };
  let viewTimer = 0, viewWas = "";
  function keepView(now) {
    if (!opts.key) return;
    const v = [Math.round(st.sx * 10) / 10, Math.round(st.sy * 10) / 10, Math.round(st.zoom * 1000) / 1000], k = v.join();
    if (k === viewWas) return;
    clearTimeout(viewTimer);
    const put = () => { viewTimer = 0; viewWas = k; const all = views(); all[opts.key] = [...v, Date.now()]; const ids = Object.keys(all); if (ids.length > 200) ids.sort((a, b) => (all[a][3] || 0) - (all[b][3] || 0)).slice(0, ids.length - 200).forEach((id) => delete all[id]); try { localStorage.setItem(VIEWS, JSON.stringify(all)); } catch {} };
    if (now) put(); else viewTimer = setTimeout(put, 300);
  }
  { const v = opts.key && views()[opts.key]; if (Array.isArray(v) && v.slice(0, 3).every(isFinite)) { st.sx = v[0]; st.sy = v[1]; st.zoom = v[2]; viewWas = v.slice(0, 3).join(); } }

  // ---- view: page units → canvas pixels. (sx, sy) is the page point at the view's top-left corner; never left of 0 or above it.
  const scale = () => st.zoom;
  const ox = () => -st.sx * scale(), oy = () => -st.sy * scale();
  const toPage = (cx, cy) => { const s = scale(); return [cx / s + st.sx, cy / s + st.sy]; };
  const seen = () => { const s = scale(); return { x0: st.sx, y0: st.sy, x1: st.sx + wrap.clientWidth / s, y1: st.sy + wrap.clientHeight / s }; };
  const nodes = new Map();   // text item id → its element
  const hOf = (it) => (it.t === "img" ? it.h : Math.max(GAP, nodes.get(it.id)?.offsetHeight || GAP));
  const boxOf = (it) => ({ x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + hOf(it) });
  const meets = (b, v) => b.x1 >= v.x0 && b.x0 <= v.x1 && b.y1 >= v.y0 && b.y0 <= v.y1;
  function clampView() {
    st.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], +st.zoom || 1));
    st.sx = Math.max(0, Math.min(FAR, +st.sx || 0)); st.sy = Math.max(0, Math.min(FAR, +st.sy || 0));
  }
  function zoomAt(z, cx, cy) {
    const [px, py] = toPage(cx, cy);
    st.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], z));
    const s = scale(); st.sx = px - cx / s; st.sy = py - cy / s;
    clampView(); full();
  }
  function panBy(dx, dy) { const s = scale(); st.sx += dx / s; st.sy += dy / s; clampView(); full(); }   // in screen pixels
  function home() { st.zoom = 1; st.sx = 0; st.sy = 0; full(); }
  clampView();

  // ---- drawing
  function size() {
    const r = devicePixelRatio || 1, w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return false;
    for (const c of [canvas, layer]) if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    return true;
  }
  function trace(g, s) {
    const p = s.p, n = p.length / 3;
    if (s.t === "hl" || s.t === "marker") {   // one path at one width, so a highlighter never darkens where it crosses itself
      g.lineWidth = p[2]; g.beginPath(); g.moveTo(p[0], p[1]);
      for (let i = 1; i < n; i++) g.lineTo(p[i * 3], p[i * 3 + 1]);
      if (n === 1) g.lineTo(p[0] + 0.01, p[1]);
      g.stroke(); return;
    }
    if (n === 1) { g.beginPath(); g.arc(p[0], p[1], p[2] / 2, 0, 7); g.fill(); return; }
    // segments through the midpoints, each at its own width
    for (let i = 1; i < n; i++) {
      const ax = i > 1 ? (p[i * 3 - 6] + p[i * 3 - 3]) / 2 : p[0], ay = i > 1 ? (p[i * 3 - 5] + p[i * 3 - 2]) / 2 : p[1];
      const bx = i < n - 1 ? (p[i * 3 - 3] + p[i * 3]) / 2 : p[i * 3], by = i < n - 1 ? (p[i * 3 - 2] + p[i * 3 + 1]) / 2 : p[i * 3 + 1];
      g.lineWidth = (p[i * 3 - 1] + p[i * 3 + 2]) / 2;
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(p[i * 3 - 3], p[i * 3 - 2], bx, by); g.stroke();
    }
  }
  // px: device pixels per page unit, so the pencil's grain stays one pixel fine at any zoom
  function paint(g, s, nt, px) {
    const col = inkColour(s, nt);
    g.strokeStyle = g.fillStyle = s.t === "pencil" ? grain(g, col, px) : col;
    g.globalAlpha = s.t === "hl" ? (nt ? 0.42 : 0.5) : 1;
    g.globalCompositeOperation = s.t === "hl" ? (nt ? "screen" : "multiply") : "source-over";
    trace(g, s);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
  // the paper over v (page units), wherever that is: ruled lines run the whole width; a grid and dots every GAP
  function drawPaper(g, P, s, v) {
    g.fillStyle = P.bg; g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    g.strokeStyle = g.fillStyle = P.line; g.lineWidth = Math.max(0.6, 1 / s);
    const ys = Math.max(GAP, Math.ceil(v.y0 / GAP) * GAP), xs = Math.max(GAP, Math.ceil(v.x0 / GAP) * GAP);
    if (doc.paper === "lined") { g.beginPath(); for (let y = Math.max(GAP * 2, ys); y <= v.y1; y += GAP) { g.moveTo(v.x0, y); g.lineTo(v.x1, y); } g.stroke(); }
    if (doc.paper === "grid") { g.beginPath(); for (let y = ys; y <= v.y1; y += GAP) { g.moveTo(v.x0, y); g.lineTo(v.x1, y); } for (let x = xs; x <= v.x1; x += GAP) { g.moveTo(x, v.y0); g.lineTo(x, v.y1); } g.stroke(); }
    if (doc.paper === "dots") { const r = Math.max(1.3, 1.4 / s); g.beginPath(); for (let y = ys; y <= v.y1; y += GAP) for (let x = xs; x <= v.x1; x += GAP) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); } g.fill(); }
  }
  const imgs = new Map();
  function imgOf(it) {
    let m = imgs.get(it.src);
    if (!m) { m = new Image(); m.onload = () => full(); m.src = it.src; imgs.set(it.src, m); }
    return m.complete && m.naturalWidth ? m : null;
  }
  function drawImages(g, v, nt) {
    for (const it of doc.items) if (it.t === "img" && meets(boxOf(it), v)) {
      const m = imgOf(it);
      if (m) g.drawImage(m, it.x, it.y, it.w, it.h); else { g.fillStyle = PAPER[nt ? "night" : "day"].line; g.fillRect(it.x, it.y, it.w, it.h); }
    }
  }
  function drawStrokes(g, v, nt, px, only) {
    g.lineCap = g.lineJoin = "round";
    for (const hl of [true, false]) for (const k of doc.strokes) if ((k.t === "hl") === hl && (!only || only.has(k.id))) { const b = k._b || (k._b = strokeBox(k)); if (meets(b, v)) paint(g, k, nt, px); }
  }
  // the paper and everything kept on it, into the layer; text boxes are elements over it, moved with the view
  function full() {
    if (!size()) return;
    const r = devicePixelRatio || 1, s = scale(), nt = night(), P = PAPER[nt ? "night" : "day"], w = wrap.clientWidth, h = wrap.clientHeight;
    const g = lctx; g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h);
    g.scale(s, s); g.translate(-st.sx, -st.sy);
    const v = seen();
    drawPaper(g, P, s, v);
    drawImages(g, v, nt);
    drawStrokes(g, v, nt, r * s);
    layerEl.style.transform = `translate(${ox()}px,${oy()}px) scale(${s})`; layerEl.style.setProperty("--s", s);
    drawItems();
    frame();
    keepView();
  }
  // the layer, then what's being drawn now
  function frame() {
    cancelAnimationFrame(raf); raf = 0;
    const r = devicePixelRatio || 1, s = scale();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(layer, 0, 0);
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.scale(s, s); ctx.translate(-st.sx, -st.sy);
    ctx.lineCap = ctx.lineJoin = "round";
    if (G?.k === "stroke") paint(ctx, G.s, night(), r * s);
    const acc = getComputedStyle(wrap).getPropertyValue("--accent").trim() || "#3d6a37";
    const dashed = (fn) => { ctx.strokeStyle = acc; ctx.lineWidth = 1.5 / s; ctx.setLineDash([6 / s, 5 / s]); ctx.beginPath(); fn(); ctx.stroke(); ctx.setLineDash([]); };
    if (G?.k === "lasso") dashed(() => { const l = G.poly; for (let i = 0; i < l.length; i += 2) ctx[i ? "lineTo" : "moveTo"](l[i], l[i + 1]); });
    if (G?.k === "snip") { const b = snipBox(G); ctx.fillStyle = acc; ctx.globalAlpha = 0.08; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.globalAlpha = 1; dashed(() => ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)); }
    if (sel) { const b = sel.box; dashed(() => ctx.rect(b.x0 - 8, b.y0 - 8, b.x1 - b.x0 + 16, b.y1 - b.y0 + 16)); }
    if (st.tool === "eraser" && eraserAt) { ctx.strokeStyle = INK[3][night() ? 1 : 0]; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.arc(eraserAt[0], eraserAt[1], eraseR(), 0, 7); ctx.stroke(); }
    const one = sel?.ids.size === 1 && itemById([...sel.ids][0]);
    handle.hidden = !one;
    if (one) { const b = boxOf(one); handle.style.left = b.x1 + "px"; handle.style.top = b.y1 + "px"; }
  }
  const later = () => { if (!raf) raf = requestAnimationFrame(frame); };
  let eraserAt = null;
  const eraseR = () => 9 + 7 * st.size;

  // ---- text boxes
  const itemById = (id) => doc.items.find((it) => it.id === id);
  function textNode(it) {
    const tx = el("div", { class: "itx", spellcheck: false });
    const n = el("div", { class: "inktext", dataset: { id: it.id } }, tx, el("div", { class: "igrip", title: "Move" }), el("div", { class: "iwid", title: "Width" }));
    tx.addEventListener("input", () => { if (editing?.n === n) { it.html = cleanText(tx.innerHTML); n._html = it.html; save(); } });
    tx.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finishEdit(true); }
      else if (e.key === "Tab") e.preventDefault();
    });
    tx.addEventListener("focusout", (e) => { if (editing?.n === n && !n.contains(e.relatedTarget) && document.hasFocus()) finishEdit(); });
    return n;
  }
  function drawItems() {
    const seen = new Set(), nt = night();
    for (const it of doc.items) {
      if (it.t !== "text") continue;
      seen.add(it.id);
      let n = nodes.get(it.id);
      if (!n) { n = textNode(it); nodes.set(it.id, n); layerEl.insertBefore(n, handle); }
      if (editing?.it !== it && n._html !== it.html) { n.firstChild.innerHTML = cleanText(it.html); n._html = it.html; }
      n.style.left = it.x + "px"; n.style.top = it.y + "px"; n.style.width = it.w + "px"; n.style.color = inkColour(it, nt);
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { if (editing?.n === n) editing = null; n.remove(); nodes.delete(id); }
  }
  const itemAt = (x, y, pad = 4) => { for (let i = doc.items.length - 1; i >= 0; i--) { const b = boxOf(doc.items[i]); if (x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad) return doc.items[i]; } return null; };
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p?.offsetNode) return null; const r = document.createRange(); r.setStart(p.offsetNode, p.offset); return r; }
    return document.caretRangeFromPoint?.(x, y) || null;
  }
  function editText(it, cx, cy, fresh = false) {
    if (editing?.it === it) return;
    finishEdit(); clearSel(); drawItems();
    const n = nodes.get(it.id); if (!n) return;
    const tx = n.firstChild;
    n.classList.add("edit"); tx.contentEditable = "true";
    editing = { it, n, was: it.html, fresh };
    tx.focus({ preventScroll: true });
    const r = cx != null ? caretAt(cx, cy) : null, s = getSelection();
    s.removeAllRanges();
    if (r && tx.contains(r.startContainer)) s.addRange(r); else { const e = document.createRange(); e.selectNodeContents(tx); e.collapse(false); s.addRange(e); }
    bar();
  }
  function finishEdit(pick) {
    const E = editing; if (!E) return; editing = null;
    const { it, n } = E, tx = n.firstChild;
    const html = cleanText(tx.innerHTML);
    tx.contentEditable = "false"; n.classList.remove("edit");
    if (n.contains(document.activeElement)) canvas.focus({ preventScroll: true });
    getSelection()?.removeAllRanges();
    it.html = html; n._html = html;
    if (!plain(html)) {   // emptied: gone (and an old box's going undoes)
      if (E.fresh) { const i = doc.items.indexOf(it); if (i >= 0) doc.items.splice(i, 1); save(); full(); bar(); return; }
      it.html = E.was; n._html = null; return commit(removeOp([], [it]));
    }
    if (E.fresh) { undo.push(addItemOp(it)); redo.length = 0; }
    else if (html !== E.was) { undo.push(textOp(it, E.was, html)); redo.length = 0; }
    if (E.fresh || html !== E.was) save();
    full(); if (pick) select([], [it]); else bar();
  }
  function newText(x, y, html = "") {
    const w = Math.max(160, Math.min(440, seen().x1 - 12 - x));   // as wide as the view leaves room for
    const it = { id: sid(), t: "text", x: Math.max(0, x - 4), y: Math.max(0, Math.floor(y / GAP) * GAP), w, html, c: 0 };
    doc.items.push(it); drawItems();
    return it;
  }

  // ---- pictures
  async function addImage(file) {
    let bmp; try { bmp = await createImageBitmap(file); } catch { return; }
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const webp = c.toDataURL("image/webp", 0.88), png = c.toDataURL("image/png");
    const src = webp.startsWith("data:image/webp") && webp.length < png.length ? webp : png;
    const s = scale(), dw = Math.max(60, Math.min(600, bmp.width / (devicePixelRatio || 1) / s)), dh = dw * bmp.height / bmp.width;
    const [cx, cy] = toPage(wrap.clientWidth / 2, wrap.clientHeight / 2);
    const it = { id: sid(), t: "img", x: Math.max(0, cx - dw / 2), y: Math.max(0, cy - dh / 2), w: dw, h: dh, src };
    finishEdit(); commit(addItemOp(it)); select([], [it]);
  }
  function onPaste(e) {
    if (!wrap.isConnected || document.querySelector(".dialog")) return;
    const a = document.activeElement, inBox = !!editing && editing.n.contains(a);
    if (!inBox && typing()) return;
    if (opts.global === false && !wrap.contains(a) && !rail.contains(a)) return;
    const cd = e.clipboardData; if (!cd) return;
    const file = Array.from(cd.items || []).find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile() || Array.from(cd.files || []).find((f) => f.type.startsWith("image/"));
    if (file) { e.preventDefault(); addImage(file); return; }
    const text = cd.getData("text/plain"); if (!text?.trim()) return;
    e.preventDefault();
    if (inBox) { document.execCommand("insertText", false, text); return; }
    const [cx, cy] = toPage(wrap.clientWidth / 2, wrap.clientHeight / 3);
    const it = newText(Math.max(0, cx - 200), cy, textHtml(text.trim()));
    doc.items.pop(); commit(addItemOp(it)); select([], [it]);
  }

  // ---- edits, each undoable
  function commit(op) { op.redo(); undo.push(op); if (undo.length > 200) undo.shift(); redo.length = 0; save(); full(); bar(); }
  const addOp = (s) => ({ redo: () => doc.strokes.push(s), undo: () => { const i = doc.strokes.indexOf(s); if (i >= 0) doc.strokes.splice(i, 1); } });
  const addItemOp = (it) => ({ redo: () => { if (!doc.items.includes(it)) doc.items.push(it); }, undo: () => { const i = doc.items.indexOf(it); if (i >= 0) doc.items.splice(i, 1); } });
  const removeOp = (gone, goneItems = []) => {
    const at = gone.map((s) => doc.strokes.indexOf(s)), atI = goneItems.map((it) => doc.items.indexOf(it));
    return {
      redo: () => { doc.strokes = doc.strokes.filter((s) => !gone.includes(s)); doc.items = doc.items.filter((it) => !goneItems.includes(it)); },
      undo: () => { gone.forEach((s, i) => doc.strokes.splice(Math.min(at[i], doc.strokes.length), 0, s)); goneItems.forEach((it, i) => doc.items.splice(Math.min(atI[i], doc.items.length), 0, it)); },
    };
  };
  const moveOp = (list, items, dx, dy) => { const by = (k) => () => { for (const s of list) { for (let i = 0; i < s.p.length; i += 3) { s.p[i] += k * dx; s.p[i + 1] += k * dy; } s._b = null; } for (const it of items) { it.x += k * dx; it.y += k * dy; } }; return { redo: by(1), undo: by(-1) }; };
  const colourOp = (list, items, c) => { const was = list.map((s) => s.c), wasI = items.map((it) => it.c); return { redo: () => { list.forEach((s) => { s.c = c; }); items.forEach((it) => { it.c = c; }); }, undo: () => { list.forEach((s, i) => { s.c = was[i]; }); items.forEach((it, i) => { it.c = wasI[i]; }); } }; };
  const sizeOp = (it, from, to) => ({ redo: () => Object.assign(it, to), undo: () => Object.assign(it, from) });
  const textOp = (it, from, to) => ({ redo: () => { it.html = to; }, undo: () => { it.html = from; } });
  function step(from, to) { finishEdit(); const op = from.pop(); if (!op) return; op[from === undo ? "undo" : "redo"](); to.push(op); clearSel(); save(); full(); bar(); }
  const picked = () => (sel ? doc.strokes.filter((s) => sel.ids.has(s.id)) : []);
  const pickedItems = () => (sel ? doc.items.filter((it) => sel.ids.has(it.id)) : []);
  function selBox(list, items = []) {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const k of [...list.map((s) => s._b || (s._b = strokeBox(s))), ...items.map(boxOf)]) { b.x0 = Math.min(b.x0, k.x0); b.y0 = Math.min(b.y0, k.y0); b.x1 = Math.max(b.x1, k.x1); b.y1 = Math.max(b.y1, k.y1); }
    return b;
  }
  function select(list, items = []) { sel = list.length || items.length ? { ids: new Set([...list, ...items].map((x) => x.id)), box: selBox(list, items) } : null; frame(); bar(); }
  function clearSel() { if (!sel) return; sel = null; frame(); bar(); }
  let nid = 0; const sid = () => Date.now().toString(36) + (nid++).toString(36);

  // ---- pointers: down on the page; moves and lifts are followed on the window, so none is missed if capture fails
  const capture = (e) => { try { wrap.setPointerCapture(e.pointerId); } catch {} };
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const erasing = (e) => e.pointerType === "pen" && ((e.buttons & 32) || e.button === 5 || (e.buttons & 2));
  const inBox = (b, x, y, pad) => x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad;
  const snipBox = (g) => ({ x0: Math.max(0, Math.min(g.x0, g.x)), y0: Math.max(0, Math.min(g.y0, g.y)), x1: Math.max(0, g.x0, g.x), y1: Math.max(0, g.y0, g.y) });
  const onPage = ([x, y]) => [Math.max(0, x), Math.max(0, y)];   // nothing goes left of the page's start or above it
  function eraseAt(x, y) {
    const r = eraseR(), hit = doc.strokes.filter((s) => { const b = s._b || (s._b = strokeBox(s)); return inBox(b, x, y, r) && strokeNear(s, x, y, r); });
    if (!hit.length) return;
    for (const s of hit) { G.gone.push([doc.strokes.indexOf(s) + G.gone.length, s]); doc.strokes.splice(doc.strokes.indexOf(s), 1); }
    full();
  }
  function down(e) {
    note(e);
    if (e.target.closest?.(".inksnip, .inkpal, .inkpm")) return;
    const kind = e.pointerType;
    if (palOpen) togglePal(false);
    if (paperOpen) togglePaper(false);
    // the mouse's middle button, or the mouse or pen with Space held, moves the view
    if (kind !== "touch" && (spaceDown || (kind === "mouse" && e.button === 1))) {
      if (kind === "pen") penContact(e);
      if (G) end(null);
      e.preventDefault(); capture(e);
      G = { k: "pan", id: e.pointerId, last: local(e) }; wrap.dataset.pan = "grab";
      return;
    }
    const grip = e.target.closest?.(".igrip, .iwid, .ihandle");
    // a text box being written in keeps the mouse, a finger and the Text tool for itself; the pen writes over it
    if (!grip && editing && editing.n.contains(e.target) && (kind !== "pen" || st.tool === "text")) return;
    if (kind === "touch" && !grip && !touchStarts(e)) return;
    if (kind === "mouse" && e.button !== 0) return;
    if (kind === "pen") penContact(e);
    const ended = !!editing; finishEdit();   // a click that only ends the typing doesn't start a new box
    if (G) { if (G.id === e.pointerId || kind !== "touch") end(null); else return; }   // a lift we never heard about
    hideSnip();
    e.preventDefault(); canvas.focus({ preventScroll: true }); capture(e);
    const [cx, cy] = local(e), [x, y] = onPage(toPage(cx, cy)), id = e.pointerId, touch = kind === "touch";
    if (grip) {
      const it = itemById(grip.closest(".inktext")?.dataset.id || [...(sel?.ids || [])][0]); if (!it) return;
      select([], [it]);
      G = grip.classList.contains("igrip") ? { k: "drag", id, x, y, dx: 0, dy: 0 } : { k: "resize", id, it, x, from: { w: it.w, h: it.h } };
      return;
    }
    const tool = erasing(e) ? "eraser" : st.tool;
    if (sel && inBox(sel.box, x, y, 8) && (tool === "lasso" || tool === "text" || kind === "mouse")) { G = { k: "drag", id, x, y, dx: 0, dy: 0, sx: cx, sy: cy, far: 0, kind }; return; }
    if (tool === "text") { G = { k: "tap", id, x, y, sx: cx, sy: cy, far: 0, ended }; return; }
    if (tool === "snip") { G = { k: "snip", id, x0: x, y0: y, x, y }; frame(); return; }
    clearSel();
    if (tool === "lasso") { G = { k: "lasso", id, poly: [x, y] }; return; }
    if (tool === "eraser") { G = { k: "erase", id, gone: [] }; eraserAt = [x, y]; eraseAt(x, y); return; }
    const t = BRUSHES.includes(st.tool) ? st.tool : "pen";
    G = { k: "stroke", id, kind, touch, ended, at: now(), sx: cx, sy: cy, last: [cx, cy], far: 0, s: { id: sid(), t, c: st.c, p: [x, y, widthFor(SIZES[t][st.size], e, t)] } };
    frame();
  }
  // Touch: is this one for drawing (Touch draws, or the Text or Snip tool)? Otherwise it pans, or it's a palm.
  function touchStarts(e) {
    const id = e.pointerId;
    palms.delete(id);
    if (penBusy() || bigContact(e)) { palms.add(id); return false; }
    if (G?.touch) {   // a second finger soon after the first: they meant to pan, not draw
      if (G.k === "stroke" && !touches.size && now() - G.at < 350) {
        const a = G.last.slice(); a.start = a.slice(); a.moved = true; touches.set(G.id, a); G = null; frame();
      } else { palms.add(id); return false; }
    } else if (!touches.size && !G && (st.touchDraws || st.tool === "text" || st.tool === "snip")) return true;
    const at = local(e); at.start = at.slice(); at.moved = false; at.slop = penNear() ? SLOP_NEAR : SLOP;
    touches.set(id, at); capture(e);
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: st.zoom, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], on: false }; }
    if (touches.size > 2) { toPalms(touches.keys()); touches.clear(); pinch = null; panning = false; }   // three or more contacts: a hand, not fingers
    return false;
  }
  function touchMove(e) {
    const id = e.pointerId;
    if (bigContact(e)) { palms.add(id); touches.delete(id); pinch = null; if (!touches.size) panning = false; return; }
    const was = touches.get(id), at = local(e); at.start = was.start; at.slop = was.slop;
    at.moved = was.moved || panning || Math.hypot(at[0] - was.start[0], at[1] - was.start[1]) > was.slop;
    touches.set(id, at);
    if (!at.moved) return;   // a resting finger or palm doesn't nudge the page
    panning = true;
    if (touches.size === 2 && pinch) {
      const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!pinch.on) { pinch.on = true; pinch.d = d || 1; pinch.m = m; pinch.z = st.zoom; return; }   // start from here, not from where the fingers landed
      const s = scale(); st.sy -= (m[1] - pinch.m[1]) / s; st.sx -= (m[0] - pinch.m[0]) / s; pinch.m = m;
      zoomAt(pinch.z * d / pinch.d, m[0], m[1]);
    } else if (touches.size === 1) panBy(was[0] - at[0], was[1] - at[1]);
  }
  function move(e) {
    if (e.pointerType === "pen") penSeen(e);
    const id = e.pointerId;
    if (palms.has(id)) return;
    if (touches.has(id)) { note(e); return touchMove(e); }
    if (!G || G.id !== id) {
      if (!wrap.isConnected || !wrap.contains(e.target)) return;
      // a pen already pressing on the page whose down never came: start the stroke now
      if (!G && e.pointerType === "pen" && (e.buttons & 1) && e.pressure > 0 && e.target === canvas) { note(e); return down(e); }
      if (e.pointerType === "touch" || e.buttons) return;
      const [x, y] = toPage(...local(e));
      if (st.tool === "eraser") { eraserAt = [x, y]; later(); }
      if (e.target === canvas) { const it = !wrap.dataset.pan && BRUSHES.includes(st.tool) && e.pointerType === "mouse" ? itemAt(x, y) : null; canvas.style.cursor = it ? (it.t === "text" ? "text" : "move") : ""; }
      return;
    }
    note(e);
    // the pen or mouse has lifted without telling us
    if (e.pointerType !== "touch" && e.buttons === 0 && !e.pressure) return end(e);
    const [cx, cy] = local(e);
    if (G.k === "pan") { panBy(G.last[0] - cx, G.last[1] - cy); G.last = [cx, cy]; return; }
    const [x, y] = toPage(cx, cy);
    if (G.sx != null) G.far = Math.max(G.far, Math.hypot(cx - G.sx, cy - G.sy));
    if (G.k === "drag") {
      if (G.kind === "mouse" && G.far < 4) return;
      // never past the page's start: the pick stops at its left and top edges
      const b = G.b || (G.b = { ...sel.box }), tx = Math.max(x - G.x, -b.x0), ty = Math.max(y - G.y, -b.y0), ddx = tx - G.dx, ddy = ty - G.dy;
      G.dx = tx; G.dy = ty; moveOp(picked(), pickedItems(), ddx, ddy).redo(); sel.box = selBox(picked(), pickedItems()); full(); return;
    }
    if (G.k === "resize") { const it = G.it, w = Math.max(it.t === "img" ? 40 : 80, Math.min(4000, G.from.w + x - G.x)); it.w = w; if (it.t === "img") it.h = w * G.from.h / G.from.w; full(); sel && (sel.box = selBox([], [it])); frame(); return; }
    if (G.k === "snip") { [G.x, G.y] = onPage([x, y]); later(); return; }
    if (G.k === "tap") return;
    if (G.k === "lasso") { G.poly.push(x, y); later(); return; }
    if (G.k === "erase") { eraserAt = [x, y]; eraseAt(x, y); return; }
    G.last = [cx, cy];
    const t = G.s.t, base = SIZES[t][st.size];
    const co = e.getCoalescedEvents?.();
    for (const c of co?.length ? co : [e]) {
      const [px, py] = onPage(toPage(...local(c))), p = G.s.p, lx = p[p.length - 3], ly = p[p.length - 2];
      if ((px - lx) ** 2 + (py - ly) ** 2 < 0.5) continue;
      const w = widthFor(base, c, t), lw = p[p.length - 1];
      p.push(px, py, t === "marker" || t === "hl" ? base : lw + (w - lw) * 0.35);   // ease the width so a pressure jitter doesn't show
    }
    later();
  }
  function up(e) {
    if (e.pointerType === "pen" && penDown === e.pointerId) { penDown = 0; penUpAt = now(); }
    const id = e.pointerId;
    if (palms.delete(id)) return;
    if (touches.delete(id)) { note(e); if (touches.size < 2) pinch = null; if (!touches.size) panning = false; return; }
    if (G && G.id === id) { note(e); end(e); }
  }
  // what the pointer was doing, finished (e: the lift, or null when it's being given up)
  function end(e) {
    const g = G; G = null; if (!g) return;
    if (penDown === g.id) { penDown = 0; penUpAt = now(); }
    if (g.k === "pan") { if (spaceDown) wrap.dataset.pan = "ready"; else delete wrap.dataset.pan; return; }
    if (g.k === "drag") {
      const moved = g.dx || g.dy;
      if (moved) { undo.push(moveOp(picked(), pickedItems(), g.dx, g.dy)); redo.length = 0; save(); bar(); }   // already moved while dragging
      else if (e && g.far < (g.kind === "mouse" ? 4 : 8)) { const it = itemAt(g.x, g.y); if (it?.t === "text") { clearSel(); editText(it, e.clientX, e.clientY); } }
      return;
    }
    if (g.k === "resize") { const to = { w: g.it.w, h: g.it.h }; if (to.w !== g.from.w) { undo.push(sizeOp(g.it, g.from, to)); redo.length = 0; save(); bar(); } return; }
    if (g.k === "snip") { const b = snipBox(g); setTool(st.back); if (e) doSnip(b); return; }
    if (g.k === "tap") { if (e && g.far < 8) tapAt(g.x, g.y, e.clientX, e.clientY, true, g.ended); return; }
    if (g.k === "lasso") {
      const poly = g.poly;
      if (poly.length > 6) select(doc.strokes.filter((s) => caught(poly, s)), doc.items.filter((it) => caughtBox(poly, boxOf(it))));
      else {   // a tap with the lasso picks what's under it
        const it = itemAt(poly[0], poly[1]), s = !it && doc.strokes.findLast((s) => strokeNear(s, poly[0], poly[1], 6));
        select(s ? [s] : [], it ? [it] : []);
      }
      return;
    }
    if (g.k === "erase") {   // put them back where they were, then take them out as one undoable step
      eraserAt = null; if (!g.gone.length) return frame();
      for (const [i, s] of [...g.gone].sort((a, b) => a[0] - b[0])) doc.strokes.splice(Math.min(i, doc.strokes.length), 0, s);
      return commit(removeOp(g.gone.map((x) => x[1])));
    }
    // a stroke; but a mouse click that didn't move is for typing, not a dot
    if (g.kind === "mouse" && g.far < 4) { frame(); if (e) tapAt(g.s.p[0], g.s.p[1], e.clientX, e.clientY, false, g.ended); return; }
    const s = g.s; s.p = s.p.map((v) => Math.round(v * 10) / 10);
    commit(addOp(s));
  }
  // a click or a Text tool tap: open the text box there, pick the picture, or start a new box
  function tapAt(x, y, cx, cy, textTool, ended) {
    const it = itemAt(x, y);
    if (it?.t === "text") return editText(it, cx, cy);
    if (it?.t === "img") return select([], [it]);
    if (ended || (sel && !textTool)) return clearSel();
    clearSel(); editText(newText(x, y), null, null, true);
  }
  wrap.addEventListener("pointerdown", down);
  addEventListener("pointermove", move, true); addEventListener("pointerup", up, true); addEventListener("pointercancel", up, true);
  const penOver = (e) => { if (e.pointerType === "pen") penSeen(e); };
  document.addEventListener("pointerover", penOver, true);
  canvas.addEventListener("pointerleave", () => { if (eraserAt && !G) { eraserAt = null; frame(); } });
  wrap.addEventListener("contextmenu", (e) => { if (!editing?.n.contains(e.target)) e.preventDefault(); });
  wrap.addEventListener("dragstart", (e) => e.preventDefault());
  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [cx, cy] = local(e);
    if (e.ctrlKey || e.metaKey) return zoomAt(st.zoom * Math.exp(-e.deltaY * 0.0022), cx, cy);
    // the wheel scrolls down and up; Shift+wheel, or a trackpad sideways, goes across
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? wrap.clientHeight : 1;
    if (e.shiftKey && !e.deltaX) panBy(e.deltaY * k, 0); else panBy(e.deltaX * k, e.deltaY * k);
  }, { passive: false });
  document.addEventListener("paste", onPaste);

  // ---- a picture of the page: for Claude to read (picture) and for the clipboard (snip)
  function drawTexts(g, list, nt) {
    const s = scale();
    for (const it of list) {
      const n = nodes.get(it.id); if (!n) continue;
      const nr = n.getBoundingClientRect(), fam = getComputedStyle(n).fontFamily, col = inkColour(it, nt);
      g.fillStyle = g.strokeStyle = col; g.textBaseline = "alphabetic";
      const walker = document.createTreeWalker(n.firstChild, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const p = t.parentElement, b = p.closest("b, strong"), i = p.closest("i, em"), u = p.closest("u");
        g.font = `${i ? "italic" : "normal"} ${b ? 700 : 400} ${FONT}px ${fam}`;
        const desc = g.measureText("Hg").fontBoundingBoxDescent ?? FONT * 0.22;
        const put = (start, end) => {
          const r = document.createRange(); r.setStart(t, start); r.setEnd(t, end);
          const rects = r.getClientRects();
          if (rects.length > 1 && end - start > 1) { for (let k = start; k < end; k++) put(k, k + 1); return; }
          const q = rects[0]; if (!q) return;
          const x = it.x + (q.left - nr.left) / s, base = it.y + (q.bottom - nr.top) / s - desc, word = t.data.slice(start, end);
          g.fillText(word, x, base);
          if (u) { g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, base + 3); g.lineTo(x + q.width / s, base + 3); g.stroke(); }
        };
        for (const m of t.data.matchAll(/\S+/g)) put(m.index, m.index + m[0].length);
      }
    }
  }
  // b: the area in page units; k: pixels per page unit; paper: the page's paper in day colours, else white; want: ids to show
  function render(b, k, paper, want) {
    const w = Math.max(1, Math.ceil((b.x1 - b.x0) * k)), h = Math.max(1, Math.ceil((b.y1 - b.y0) * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.scale(k, k); g.translate(-b.x0, -b.y0);
    if (paper) drawPaper(g, PAPER.day, k, b);
    const items = want ? doc.items.filter((it) => want.has(it.id)) : doc.items;
    for (const it of items) if (it.t === "img") { const m = imgOf(it); if (m) g.drawImage(m, it.x, it.y, it.w, it.h); }
    drawStrokes(g, b, false, k, want);
    drawItems(); drawTexts(g, items.filter((it) => it.t === "text"), false);
    return c;
  }
  function doSnip(b) {
    const s = scale(), w = b.x1 - b.x0, h = b.y1 - b.y0;
    if (w * s < 6 || h * s < 6) return;
    const k = Math.max(0.5, Math.min(Math.max(2, s * (devicePixelRatio || 1) * 2.5), Math.sqrt(16e6 / (w * h)), 16384 / Math.max(w, h)));
    const c = render(b, k, true);
    const blob = new Promise((res) => c.toBlob(res, "image/png"));
    const shot = { width: c.width, height: c.height, copied: null, blob, url: c.toDataURL("image/png") };
    snipped = shot; showSnip(shot);
    let write;
    try { write = navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); } catch (err) { write = Promise.reject(err); }
    write.then(() => { shot.copied = true; }, () => { shot.copied = false; }).then(() => { if (snipped === shot) showSnip(shot); });
  }
  const snipBar = el("div", { class: "inksnip", role: "status", hidden: true });
  wrap.append(snipBar);
  function showSnip(shot) {
    clearTimeout(snipTimer);
    snipBar.replaceChildren(el("img", { src: shot.url, alt: "" }),
      el("span", { id: "inkSnipSaid", text: shot.copied == null ? "Copying" : shot.copied ? "Copied" : "Not copied" }), el("span", { class: "grow" }),
      el("button", { type: "button", class: "btn", id: "inkSnipSave", onclick: () => saveSnip() }, "Save", el("kbd", { text: "↵" })),
      el("button", { type: "button", class: "btn", id: "inkSnipClose", onclick: () => hideSnip() }, "Close", el("kbd", { text: "Esc" })));
    snipBar.hidden = false;
    if (shot.copied) snipTimer = setTimeout(() => hideSnip(), 12000);
  }
  function hideSnip() { clearTimeout(snipTimer); if (snipBar.hidden) return; snipBar.hidden = true; snipped = null; }
  async function saveSnip() {
    const shot = snipped; if (!shot) return;
    const blob = await shot.blob; if (!blob) return;
    const a = el("a", { href: URL.createObjectURL(blob), download: `${(opts.name?.() || "Pen page").replace(/[\\/:*?"<>|]+/g, " ").trim() || "Pen page"}.png` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    hideSnip();
  }

  // ---- the rail
  const TOOLS = [
    ["pen", "Pen", "P", "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"],
    ["pencil", "Pencil", "⇧P", "M4 20l1.5-5L16 4.5l3.5 3.5L9 18.5zM14 6.5l3.5 3.5M5.5 15l3.5 3.5"],
    ["marker", "Marker", "M", "M8 14l-3 3v3h3l3-3M8 14l8-8 3 3-8 8zM14 8l3 3"],
    ["hl", "Highlighter", "H", "M9 14l7-7 3 3-7 7H9zM9 14l-4 4v2h4l3-3M4 21h16"],
    ["eraser", "Eraser", "E", "M8 20h11M4 15l9-9 6 6-7 7H8z"],
    ["lasso", "Lasso", "L", "M12 5c4.4 0 8 2.2 8 5s-3.6 5-8 5-8-2.2-8-5 3.6-5 8-5zM7 14c-1 1.5-1.5 3-.5 5"],
    ["text", "Text", "A", "M5 20L12 4l7 16M8 14h8"],
    ["snip", "Picture of an area", "⇧S", "M7 3v14h14M3 7h14v14"],
  ];
  const rail = el("aside", { class: "inkrail", "aria-label": "Pen tools" });
  const pal = el("div", { class: "inkpal", hidden: true, role: "dialog", "aria-label": "Colours" });
  const pmenu = el("div", { class: "inkpm", hidden: true, role: "menu", "aria-label": "Paper" });
  wrap.append(pal, pmenu);
  const palette = () => [...EXTRA, ...st.custom.filter((c) => !EXTRA.includes(c))];
  function bar() {
    const nt = night(), btn = (id, label, key, d, on, run, extra) => el("button", { class: "ibtn" + (on ? " on" : ""), type: "button", id, title: `${label} (${key})`, "aria-label": label, "aria-pressed": on == null ? null : String(!!on), onclick: () => { run(); if (!palOpen && !paperOpen) canvas.focus({ preventScroll: true }); } },
      extra || opts.icon(d), el("kbd", { text: key }));
    const sw = (c) => el("button", { class: "iswatch" + (st.c === c ? " on" : ""), type: "button", dataset: { c }, title: `Colour ${c + 1} (C)`, "aria-label": `Colour ${c + 1}`, "aria-pressed": String(st.c === c),
      onclick: () => { setColour(c); canvas.focus({ preventScroll: true }); } }, el("span", { style: "background:" + (st.tool === "hl" ? HI : INK)[c][nt ? 1 : 0] }));
    const more = isHex(st.c) ? st.c : st.extra;
    rail.replaceChildren(
      el("div", { class: "igroup tools" }, TOOLS.map(([id, label, key, d]) => btn(id === "text" ? "ink-textbox" : "ink-" + id, label, key, d, st.tool === id, () => setTool(id)))),
      el("div", { class: "igroup" }, [0, 1, 2, 3].map(sw),
        el("button", { class: "iswatch more" + (isHex(st.c) ? " on" : "") + (palOpen ? " open" : ""), type: "button", id: "ink-more", title: "More colours (⇧C)", "aria-label": "More colours", "aria-expanded": String(palOpen), onclick: () => togglePal() },
          el("span", { style: more ? "background:" + more : "background:linear-gradient(90deg," + EXTRA.slice(0, 4).join(",") + ")" })),
        el("kbd", { class: "ikey", text: "C" })),
      el("div", { class: "igroup" }, btn("ink-size", "Size", "S", null, null, () => setSize((st.size + 1) % 3), el("span", { class: "isize" }, [0, 1, 2].map((k) => el("i", { class: k === st.size ? "on" : "", style: `width:${4 + k * 3}px;height:${4 + k * 3}px` }))))),
      el("div", { class: "igroup" },
        btn("ink-undo", "Undo", "Ctrl+Z", "M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12", null, () => step(undo, redo)),
        btn("ink-redo", "Redo", "Ctrl+Y", "M15 7l5 5-5 5M20 12H10a6 6 0 0 0 0 12", null, () => step(redo, undo))),
      el("div", { class: "igroup" },
        btn("ink-in", "Zoom in", "+", "M11 5v12M5 11h12M16 16l4 4", null, () => zoomBy(1.25)),
        btn("ink-out", "Zoom out", "−", "M5 11h12M16 16l4 4", null, () => zoomBy(0.8)),
        btn("ink-home", "Top left, 100%", "0", "M4 20V4h16M4 4l7 7M8 4H4v4", null, home)),
      el("div", { class: "igroup" },
        btn("ink-paper", "Paper", "B", PAPER_ICON[doc.paper], null, () => togglePaper()),
        opts.toText ? btn("ink-text", "To text", "X", "M4 6h16M12 6v13M8 19h8", null, () => opts.toText()) : null,
        btn("ink-touch", st.touchDraws ? "Touch draws" : "Touch pans", "T", "M9 11V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v2M17 12a2 2 0 0 1 4 0v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-3l-2.5-4a2 2 0 0 1 3.4-2L9 14", st.touchDraws, () => { st.touchDraws = !st.touchDraws; keep(); bar(); })));
    rail.querySelector("#ink-undo").disabled = !undo.length; rail.querySelector("#ink-redo").disabled = !redo.length;
    const pb = rail.querySelector("#ink-paper"); pb.setAttribute("aria-haspopup", "menu"); pb.setAttribute("aria-expanded", String(paperOpen)); pb.classList.toggle("open", paperOpen);
    wrap.dataset.tool = st.tool;
    if (palOpen) drawPal();
    if (paperOpen) drawPaperMenu();
  }
  // Paper: a small menu off the rail, None, Ruled, Grid (1–3); an old page on dots shows that too, marked
  function drawPaperMenu() {
    const rows = [...PAPER_MENU, ...(doc.paper === "dots" ? [["dots", "Dots", ""]] : [])];
    pmenu.replaceChildren(...rows.map(([id, label, key]) => el("button", { type: "button", class: "iprow" + (doc.paper === id ? " on" : ""), role: "menuitemradio", "aria-checked": String(doc.paper === id), dataset: { paper: id },
      onclick: () => setPaper(id) }, opts.icon(PAPER_ICON[id]), el("span", { text: label }), key ? el("kbd", { text: key }) : el("span"))));
    const b = rail.querySelector("#ink-paper"); if (b) pmenu.style.top = Math.max(4, Math.min(wrap.clientHeight - 150, b.getBoundingClientRect().top - wrap.getBoundingClientRect().top - 6)) + "px";
  }
  function togglePaper(on = !paperOpen) {
    if (on && palOpen) { palOpen = false; pal.hidden = true; }
    paperOpen = on; pmenu.hidden = !on; bar();
    if (on) (pmenu.querySelector(".iprow.on") || pmenu.querySelector(".iprow"))?.focus({ preventScroll: true }); else canvas.focus({ preventScroll: true });
  }
  function setPaper(p) {
    if (PAPER_MENU.some(([id]) => id === p)) { st.paper = p; keep(); }   // new pen pages start on it
    if (doc.paper !== p) { doc.paper = p; save(); full(); }
    togglePaper(false);
  }
  // More colours: the fixed ones, then any picked by hand (1–9); the last cell picks a colour of your own (0).
  function drawPal() {
    const list = palette().slice(0, 9);
    const custom = el("input", { type: "color", id: "ink-custom", value: isHex(st.c) ? st.c : "#3e7a4b", "aria-label": "Your own colour", onchange: (e) => { const c = e.target.value.toLowerCase(); st.custom = [c, ...st.custom.filter((x) => x !== c)].slice(0, 4); setColour(c); togglePal(false); } });
    pal.replaceChildren(...list.map((c, i) => el("button", { type: "button", class: "iswatch" + (st.c === c ? " on" : ""), dataset: { c }, title: `${c} (${i + 1})`, "aria-label": `Colour ${c}`, onclick: () => { setColour(c); togglePal(false); } }, el("span", { style: "background:" + c }), el("kbd", { text: String(i + 1) }))),
      el("label", { class: "iswatch own", title: "Your own colour (0)" }, custom, el("span", { class: "plus", text: "+" }), el("kbd", { text: "0" })));
    const b = rail.querySelector("#ink-more"); if (b) pal.style.top = Math.max(4, Math.min(wrap.clientHeight - 140, b.getBoundingClientRect().top - wrap.getBoundingClientRect().top - 6)) + "px";
  }
  function togglePal(on = !palOpen) { if (on && paperOpen) { paperOpen = false; pmenu.hidden = true; } palOpen = on; pal.hidden = !on; bar(); if (on) pal.querySelector(".iswatch")?.focus({ preventScroll: true }); else canvas.focus({ preventScroll: true }); }
  function setTool(t) { if (t === "snip" && st.tool !== "snip") st.back = st.tool; finishEdit(); st.tool = t; if (t !== "lasso" && t !== "text") clearSel(); eraserAt = null; bar(); frame(); }
  function setColour(c) {
    st.c = c; if (isHex(c)) st.extra = c; keep();
    const list = picked(), items = pickedItems(); if (list.length || items.length) commit(colourOp(list, items, c)); else bar();
  }
  function setSize(k) { st.size = k; keep(); bar(); }
  function zoomBy(k) { zoomAt(st.zoom * k, wrap.clientWidth / 2, wrap.clientHeight / 2); }
  function del() { const list = picked(), items = pickedItems(); if (!list.length && !items.length) return false; sel = null; commit(removeOp(list, items)); return true; }

  // keys, while the page is open and you're not typing in a box
  const typing = () => { const a = document.activeElement; return a && a !== canvas && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  function onKey(e) {
    if (!wrap.isConnected || document.querySelector(".dialog") || e.altKey) return;
    if (typing() && !(palOpen && pal.contains(document.activeElement))) return;
    if (e.key === " " && document.activeElement?.closest?.(".inkpm, .inkpal")) return;   // Space presses the menu's button
    // beside a graph its keys stay the graph's unless you're on the page
    if (opts.global === false && !wrap.contains(document.activeElement) && !rail.contains(document.activeElement)) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, done = () => { e.preventDefault(); e.stopPropagation(); };
    if (palOpen && !mod) {
      if (k === "Escape" || (k === "C" && e.shiftKey)) { done(); return togglePal(false); }
      if (/^[1-9]$/.test(k)) { const c = palette()[+k - 1]; done(); if (c) { setColour(c); togglePal(false); } return; }
      if (k === "0") { done(); const i = pal.querySelector("#ink-custom"); try { i.showPicker(); } catch { i.click(); } return; }
    }
    if (paperOpen && !mod) {
      if (k === "Escape" || k === "b" || k === "B") { done(); return togglePaper(false); }
      const row = PAPER_MENU.find(([, , key]) => key === k); if (row) { done(); return setPaper(row[0]); }
      if (k === "ArrowDown" || k === "ArrowUp") { done(); const rs = [...pmenu.querySelectorAll(".iprow")], i = rs.indexOf(document.activeElement); rs[(i + (k === "ArrowDown" ? 1 : rs.length - 1)) % rs.length]?.focus(); return; }
    }
    if (!snipBar.hidden && !mod) {
      if (k === "Enter") { done(); return saveSnip(); }
      if (k === "Escape") { done(); return hideSnip(); }
    }
    if (mod && !e.shiftKey && (k === "z" || k === "Z")) { done(); return step(undo, redo); }
    if (mod && (k === "y" || ((k === "z" || k === "Z") && e.shiftKey))) { done(); return step(redo, undo); }
    if (mod && (k === "=" || k === "+")) { done(); return zoomBy(1.25); }
    if (mod && k === "-") { done(); return zoomBy(0.8); }
    if (mod) return;
    const low = k.toLowerCase();
    if (low === "p" && e.shiftKey) { done(); return setTool("pencil"); }
    if (low === "s" && e.shiftKey) { done(); return setTool("snip"); }
    if (low === "c" && e.shiftKey) { done(); return togglePal(); }
    const tool = { p: "pen", m: "marker", h: "hl", e: "eraser", l: "lasso", a: "text" }[low];
    if (tool && !e.shiftKey) { done(); return setTool(tool); }
    if (low === "c") { done(); return setColour(isHex(st.c) ? 0 : (st.c + 1) % 4); }
    if (k === "s") { done(); return setSize((st.size + 1) % 3); }
    if (k === "b") { done(); return togglePaper(); }
    if (k === " ") { done(); if (!spaceDown) { spaceDown = true; wrap.dataset.pan = G?.k === "pan" ? "grab" : "ready"; } return; }   // held: the mouse or pen moves the view
    if (k === "t") { done(); st.touchDraws = !st.touchDraws; keep(); return bar(); }
    if (k === "x" && opts.toText) { done(); return opts.toText(); }
    if (k === "+" || k === "=") { done(); return zoomBy(1.25); }
    if (k === "-") { done(); return zoomBy(0.8); }
    if (k === "0") { done(); return home(); }
    if ((k === "Delete" || k === "Backspace") && (sel || document.activeElement === canvas)) { done(); return del(); }   // never the page itself from here
    if (k === "Enter" && sel?.ids.size === 1) { const it = itemById([...sel.ids][0]); if (it?.t === "text") { done(); return editText(it); } }
    if (k === "Escape" && !e.shiftKey) {
      if (G?.k === "snip") { done(); G = null; setTool(st.back); return; }
      if (st.tool === "snip") { done(); return setTool(st.back); }
      if (sel) { done(); return clearSel(); }
    }
    if (k === "PageDown" || k === "PageUp" || (document.activeElement === canvas && (k === "ArrowDown" || k === "ArrowUp"))) {
      done(); return panBy(0, (k === "PageDown" || k === "ArrowDown" ? 1 : -1) * (k.startsWith("Page") ? wrap.clientHeight * 0.85 : 60));
    }
    if (document.activeElement === canvas && (k === "ArrowLeft" || k === "ArrowRight")) { done(); return panBy((k === "ArrowRight" ? 1 : -1) * 60, 0); }
  }
  const spaceUp = (e) => { if (e.key !== " " || !spaceDown) return; spaceDown = false; if (G?.k !== "pan") delete wrap.dataset.pan; e.preventDefault(); };
  const spaceGone = () => { spaceDown = false; if (G?.k !== "pan") delete wrap.dataset.pan; };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("keyup", spaceUp, true); addEventListener("blur", spaceGone);
  const ro = new ResizeObserver(() => { clampView(); full(); }); ro.observe(wrap);
  const mo = new MutationObserver(() => { full(); bar(); }); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  const mq = matchMedia("(prefers-color-scheme: dark)"), onMq = () => { full(); bar(); }; mq.addEventListener?.("change", onMq);
  bar(); requestAnimationFrame(full);
  opts.host.append(wrap, rail);

  return {
    wrap, rail, canvas, log,
    get doc() { return doc; }, get tool() { return st.tool; }, get colour() { return st.c; }, get size() { return st.size; }, get zoom() { return st.zoom; }, get touchDraws() { return st.touchDraws; },
    get selected() { return sel ? [...sel.ids].filter((id) => doc.strokes.some((s) => s.id === id) || doc.items.some((it) => it.id === id)) : []; },
    get view() { return { zoom: st.zoom, sx: st.sx, sy: st.sy, scale: scale(), ox: ox(), oy: oy(), seen: seen() }; },
    get paperOpen() { return paperOpen; },
    // the box round everything on the page, in page units (null when it's empty)
    get bounds() { return doc.strokes.length || doc.items.length ? selBox(doc.strokes, doc.items) : null; },
    setView: (v) => { Object.assign(st, v); clampView(); full(); }, setPaper, home,
    get editing() { return editing?.it.id || null; }, get snip() { return snipped && { width: snipped.width, height: snipped.height, copied: snipped.copied }; },
    // A picture of some strokes and items (all when none are named) in day ink on white, for Claude to read: PNG as base64.
    picture(ids, maxW = 1600) {
      finishEdit();
      const want = ids?.length ? new Set(ids) : null, list = doc.strokes.filter((s) => !want || want.has(s.id)), items = doc.items.filter((it) => !want || want.has(it.id));
      if (!list.length && !items.length) return null;
      const b = selBox(list, items), pad = 24, box = { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad };
      const k = Math.min(2, maxW / (box.x1 - box.x0), 8000 / (box.y1 - box.y0));
      const c = render(box, k, false, new Set([...list, ...items].map((x) => x.id)));
      return { media_type: "image/png", data: c.toDataURL("image/png").split(",")[1], width: c.width, height: c.height };
    },
    toScreen: (x, y) => { const r = canvas.getBoundingClientRect(), s = scale(); return [r.left + (x - st.sx) * s, r.top + (y - st.sy) * s]; },
    setTool, setColour, setSize, undo: () => step(undo, redo), redo: () => step(redo, undo), redraw: () => { full(); bar(); }, addImage,
    flush: () => { if (editing) { editing.it.html = cleanText(editing.n.firstChild.innerHTML); save(); } if (dirty) { clearTimeout(dirty); dirty = 0; opts.onChange?.(out()); } },
    focus: () => canvas.focus({ preventScroll: true }),
    destroy: () => {
      removeEventListener("pointermove", move, true); removeEventListener("pointerup", up, true); removeEventListener("pointercancel", up, true);
      document.removeEventListener("pointerover", penOver, true); document.removeEventListener("keydown", onKey, true); document.removeEventListener("paste", onPaste);
      document.removeEventListener("keyup", spaceUp, true); removeEventListener("blur", spaceGone); if (viewTimer) keepView(true);
      ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", onMq); cancelAnimationFrame(raf); clearTimeout(snipTimer);
    },
  };
}
