// A flat web of one knowledge graph, drawn like the tech tree's web view: dots in each idea's colour,
// strings to the idea it hangs off, dashed links, the picked idea ringed and labelled.
// createMiniWeb({ host, onPick(id), onOpen(id), num(id), ring(id) }) → { setData({ nodes, links, rootId, colour(id) }), select(id), resize(), destroy() }
// Drag to pan, wheel to zoom, click an idea to pick it, double-click to open it. num gives an idea its number, ring an
// extra ring's colour (the Library marks what needs water in ochre). Every idea is the same size.
export function createMiniWeb({ host, onPick, onOpen, num = () => null, ring = () => null }) {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  canvas.className = "miniweb"; canvas.setAttribute("aria-label", "Graph"); host.append(canvas);
  let W = 1, H = 1, dpr = 1, P = new Map(), kids = new Map(), links = [], sel = null, hov = null, colour = () => "#888", sig = "";
  let view = { x: 0, y: 0, k: 1 }, drag = null;
  const css = () => { const s = getComputedStyle(document.body), v = (k, d) => s.getPropertyValue(k).trim() || d; return { bg: v("--bg", "#fff"), ink: v("--ink", "#111"), muted: v("--muted", "#777"), accent: v("--accent", "#3d6a37") }; };
  let C = css();
  const SX = (x) => W / 2 + (x - view.x) * view.k, SY = (y) => H / 2 + (y - view.y) * view.k;

  // a radial tree to start from, then a short spring settle so it reads as a web
  function layout(nodes, rootId) {
    kids = new Map(); for (const n of nodes) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
    for (const l of kids.values()) l.sort((a, b) => a.order - b.order);
    const leaves = (id) => { const k = kids.get(id) || []; return k.length ? k.reduce((a, c) => a + leaves(c.id), 0) : 1; };
    const pos = new Map();
    const place = (n, depth, a0, a1) => {
      const a = (a0 + a1) / 2, r = depth * 70; pos.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, n, depth });
      let at = a0; const total = leaves(n.id);
      for (const c of kids.get(n.id) || []) { const span = ((a1 - a0) * leaves(c.id)) / total; place(c, depth + 1, at, at + span); at += span; }
    };
    const root = nodes.find((n) => n.id === rootId); if (!root) return pos;
    place(root, 0, -Math.PI, Math.PI);
    const all = [...pos.values()];
    for (let it = 0; it < 160; it++) {
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + 0.01;
        if (d2 > 160 * 160) continue; const f = 900 / d2, d = Math.sqrt(d2);
        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      }
      for (const p of all) {
        const par = pos.get(p.n.parentId); if (!par) continue;
        const dx = p.x - par.x, dy = p.y - par.y, d = Math.hypot(dx, dy) || 1, f = (d - 62) * 0.06;
        p.vx -= (dx / d) * f; p.vy -= (dy / d) * f; par.vx += (dx / d) * f * 0.5; par.vy += (dy / d) * f * 0.5;
      }
      for (const p of all) { if (p.depth === 0) { p.vx = p.vy = 0; continue; } p.x += Math.max(-8, Math.min(8, p.vx)); p.y += Math.max(-8, Math.min(8, p.vy)); p.vx *= 0.5; p.vy *= 0.5; }
    }
    return pos;
  }
  function fit() {
    const all = [...P.values()]; if (!all.length) return;
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y), w = Math.max(...xs) - Math.min(...xs) + 160, h = Math.max(...ys) - Math.min(...ys) + 80;
    view = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, k: Math.min(1.6, Math.max(0.3, Math.min(W / w, H / h))) };
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); C = css();
    const f0 = P.get(hov) || P.get(sel), near = new Set();
    if (f0) { near.add(f0.n.id); if (f0.n.parentId) near.add(f0.n.parentId); for (const c of kids.get(f0.n.id) || []) near.add(c.id); for (const l of links) { if (l.a === f0.n.id) near.add(l.b); if (l.b === f0.n.id) near.add(l.a); } }
    const z = Math.max(0.6, Math.min(1.4, view.k)), al = (on) => (f0 ? (on ? 0.85 : 0.3) : 0.5);
    ctx.lineCap = "round";
    for (const p of P.values()) {
      const q = P.get(p.n.parentId); if (!q) continue;
      ctx.globalAlpha = al(near.has(p.n.id) && near.has(q.n.id)); ctx.strokeStyle = colour(p.n.id); ctx.lineWidth = (p.depth <= 1 ? 2.2 : 1.4) * z;
      ctx.beginPath(); ctx.moveTo(SX(q.x), SY(q.y)); ctx.lineTo(SX(p.x), SY(p.y)); ctx.stroke();
    }
    ctx.setLineDash([4, 4]);
    for (const l of links) {
      const a = P.get(l.a), b = P.get(l.b); if (!a || !b) continue;
      const on = f0 && (l.a === f0.n.id || l.b === f0.n.id); ctx.globalAlpha = f0 && !on ? 0.08 : on ? 0.9 : 0.35; ctx.strokeStyle = C.muted; ctx.lineWidth = 1.1;
      const x0 = SX(a.x), y0 = SY(a.y), x1 = SX(b.x), y1 = SY(b.y); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 - (y1 - y0) * 0.14, (y0 + y1) / 2 + (x1 - x0) * 0.14, x1, y1); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const p of P.values()) {
      const x = SX(p.x), y = SY(p.y), r = 5 * z, rc = ring(p.n.id);
      ctx.globalAlpha = f0 && !near.has(p.n.id) && p.depth > 0 ? 0.55 : 1; ctx.fillStyle = colour(p.n.id); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (rc) { ctx.strokeStyle = rc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.stroke(); }
      if (p.n.id === sel) { ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
    }
    // labels: the picked idea, what's near it, then the rest where they don't collide
    const rank = (p) => (p.n.id === sel ? 0 : p.depth === 0 ? 1 : p.n.id === hov ? 1 : near.has(p.n.id) ? 2 : p.depth === 1 ? 4 : 5);
    const boxes = [], free = (b) => boxes.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
    ctx.textBaseline = "middle";
    for (const p of [...P.values()].sort((a, b) => rank(a) - rank(b))) {
      const rk = rank(p), font = rk <= 1 || p.depth === 0 ? "600 12px system-ui,sans-serif" : "500 11px system-ui,sans-serif"; ctx.font = font;
      const nb = num(p.n.id); let s = (nb ? nb + "  " : "") + p.n.title; const full = s; while (s.length > 4 && ctx.measureText(s).width > 150) s = s.slice(0, -2); if (s !== full) s = s.trimEnd() + "…";
      // right of the dot, else left, else below, else above; the picked idea and the graph's start always get one
      const w = ctx.measureText(s).width, cx = SX(p.x), cy = SY(p.y);
      const spots = [[cx + 9, cy], [cx - 9 - w, cy], [cx - w / 2, cy + 16], [cx - w / 2, cy - 16]].map(([x, y]) => ({ x, y, b: { x0: x - 5, y0: y - 10, x1: x + w + 5, y1: y + 10 } }));
      const spot = spots.find((o) => free(o.b)) || (rk <= 1 ? spots[0] : null);
      if (!spot) continue; boxes.push(spot.b); const { x, y } = spot;
      ctx.globalAlpha = f0 && !near.has(p.n.id) && rk > 1 ? 0.6 : 1;
      if (p.n.id === sel) { ctx.lineWidth = 3; ctx.strokeStyle = C.bg; ctx.strokeText(s, x, y + 0.5); ctx.fillStyle = C.ink; ctx.fillText(s, x, y + 0.5); ctx.fillStyle = C.accent; ctx.fillRect(x, y + 8, w, 2); }   // the pick: underlined
      else { ctx.lineWidth = 3; ctx.strokeStyle = C.bg; ctx.strokeText(s, x, y + 0.5); ctx.fillStyle = p.depth > 1 ? C.muted : C.ink; ctx.fillText(s, x, y + 0.5); }
    }
    ctx.globalAlpha = 1;
  }
  const hit = (mx, my) => { let best = null, bd = 14 * 14; for (const p of P.values()) { const d = (SX(p.x) - mx) ** 2 + (SY(p.y) - my) ** 2; if (d < bd) { bd = d; best = p.n.id; } } return best; };
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointerdown", (e) => { const [x, y] = at(e); drag = { x, y, vx: view.x, vy: view.y, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    const [x, y] = at(e);
    if (drag) { if (Math.hypot(x - drag.x, y - drag.y) > 4) drag.moved = true; if (drag.moved) { view.x = drag.vx - (x - drag.x) / view.k; view.y = drag.vy - (y - drag.y) / view.k; draw(); } return; }
    const h = hit(x, y); if (h !== hov) { hov = h; canvas.style.cursor = h ? "pointer" : "grab"; draw(); }
  });
  canvas.addEventListener("pointerup", (e) => { const d = drag; drag = null; if (d && !d.moved) { const [x, y] = at(e), h = hit(x, y); if (h) onPick?.(h); } });
  canvas.addEventListener("dblclick", (e) => { const [x, y] = at(e), h = hit(x, y); if (h) onOpen?.(h); });
  canvas.addEventListener("pointerleave", () => { if (hov) { hov = null; draw(); } });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = at(e), k0 = view.k, k = Math.max(0.25, Math.min(3, k0 * Math.exp(-e.deltaY * 0.0015)));
    view.x += (x - W / 2) / k0 - (x - W / 2) / k; view.y += (y - H / 2) / k0 - (y - H / 2) / k; view.k = k; draw(); }, { passive: false });
  function resize() { const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px"; draw(); }
  const ro = new ResizeObserver(() => { const had = W; resize(); if (had <= 1) { fit(); draw(); } }); ro.observe(host);
  return {
    el: canvas,
    // keeps the layout (and where you've panned) while the graph is the same shape
    setData({ nodes, links: ls = [], rootId, colour: c }) {
      colour = c || colour; links = ls;
      const s = rootId + ":" + nodes.map((n) => n.id + n.parentId).join(",");
      if (s !== sig) { sig = s; P = layout(nodes, rootId); fit(); }
      else for (const n of nodes) { const p = P.get(n.id); if (p) p.n = n; }
      draw();
    },
    select(id) { sel = id; const p = P.get(id); if (p && (SX(p.x) < 30 || SX(p.x) > W - 30 || SY(p.y) < 20 || SY(p.y) > H - 20)) { view.x = p.x; view.y = p.y; } draw(); },
    attach(newHost) { if (canvas.parentElement !== newHost) { ro.unobserve(host); host = newHost; newHost.append(canvas); ro.observe(newHost); } resize(); },
    resize, fit() { fit(); draw(); },
    screenOf(id) { const p = P.get(id), r = canvas.getBoundingClientRect(); return p && { x: r.left + SX(p.x), y: r.top + SY(p.y) }; },   // for tests
    destroy() { ro.disconnect(); canvas.remove(); },
  };
}
