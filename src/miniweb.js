// A flat web of one knowledge graph, drawn like the tech tree's web view: dots in each idea's colour,
// strings to the idea it hangs off, dashed links, the picked idea ringed and labelled.
// createMiniWeb({ host, onPick(id), onOpen(id), num(id), ring(id), mask(id), edit, … }) → { setData({ nodes, links, rootId, colour(id) }), select(id), resize(), destroy() }
// Drag to pan, wheel to zoom, click an idea to pick it, double-click to open it. num gives an idea its number, ring an
// extra ring's colour (the Library marks what needs water in ochre). Every idea is the same size.
// With edit (the Library's board): an idea's place is its own (node.xy, kept by onMove); dragging an idea moves it
// and what hangs from it; dropping it on another idea grafts it there (onDrop); the + knob on the picked idea, or an
// Alt-drag, pulls out a string: let go on empty paper for a new idea there (onNew), on an idea to link them (onLink).
// Right-click asks for a menu (onMenu); a graph dragged in from the Library and dropped on an idea is onDropTree.
// Links can be picked too (onPickLink): hovered and picked ones are drawn bolder; right-click on one gives onMenu(null, …, linkId).
export function createMiniWeb({ host, onPick, onOpen, num = () => null, ring = () => null, mask = () => null, edit = false, onMove, onDrop, onNew, onLink, onMenu, onDropTree, onPickLink }) {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  canvas.className = "miniweb"; canvas.setAttribute("aria-label", "Graph"); host.append(canvas);
  let W = 1, H = 1, dpr = 1, P = new Map(), kids = new Map(), links = [], sel = null, hov = null, colour = () => "#888", sig = "";
  let view = { x: 0, y: 0, k: 1 }, drag = null, pull = null, over = null, root = null, fresh = true, selLink = null, hovLink = null;
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
  // nudge only the given ideas apart from everything else and toward what they hang off
  function settle(only) {
    const all = [...P.values()], move = all.filter((p) => only.has(p.n.id));
    for (let it = 0; it < 120; it++) {
      for (const a of move) for (const b of all) { if (a === b) continue; const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + 0.01; if (d2 > 140 * 140) continue; const f = 900 / d2, d = Math.sqrt(d2); a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; }
      for (const a of move) { const par = P.get(a.n.parentId); if (!par) continue; const dx = a.x - par.x, dy = a.y - par.y, d = Math.hypot(dx, dy) || 1, f = (d - 70) * 0.08; a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; }
      for (const a of move) { a.x += Math.max(-8, Math.min(8, a.vx)); a.y += Math.max(-8, Math.min(8, a.vy)); a.vx *= 0.5; a.vy *= 0.5; }
    }
  }
  const under = (id) => { const out = [id]; for (let i = 0; i < out.length; i++) for (const c of kids.get(out[i]) || []) out.push(c.id); return out; };
  const knob = () => { const p = edit && P.get(sel); if (!p) return null; const z = Math.max(0.6, Math.min(1.4, view.k)); return { x: SX(p.x) + 5 * z + 14, y: SY(p.y) - 5 * z - 14 }; };
  const toWorld = (x, y) => ({ x: (x - W / 2) / view.k + view.x, y: (y - H / 2) / view.k + view.y });
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
      const lit = l.id && (l.id === selLink || l.id === hovLink), on = lit || (f0 && (l.a === f0.n.id || l.b === f0.n.id));
      ctx.globalAlpha = lit ? 1 : f0 && !on ? 0.08 : on ? 0.9 : 0.35; ctx.strokeStyle = lit ? C.accent : C.muted; ctx.lineWidth = lit ? 2.4 : 1.1;
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
      const nb = num(p.n.id), mk = mask(p.n.id); let s = (nb ? nb + "  " : "") + (mk ?? p.n.title); const full = s;   // mask: a name kept back while a question waits
      while (s.length > 4 && ctx.measureText(s).width > 150) s = s.slice(0, -2); if (s !== full) s = s.trimEnd() + "…";
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
    if (over) { const p = P.get(over); if (p) { ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(SX(p.x), SY(p.y), 13, 0, Math.PI * 2); ctx.stroke(); } }
    if (pull) { const a = P.get(pull.from); if (a) { ctx.strokeStyle = C.accent; ctx.lineWidth = 1.6; ctx.setLineDash(over ? [4, 4] : []); ctx.beginPath(); ctx.moveTo(SX(a.x), SY(a.y)); ctx.lineTo(pull.x, pull.y); ctx.stroke(); ctx.setLineDash([]); if (!over) { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(pull.x, pull.y, 4, 0, Math.PI * 2); ctx.fill(); } } }
    const kb = !pull && !drag?.ids && knob();
    if (kb) {   // the + knob on the picked idea: pull it out for a new idea or a link
      ctx.fillStyle = C.bg; ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(kb.x - 8, kb.y - 8, 16, 16, 4) : ctx.rect(kb.x - 8, kb.y - 8, 16, 16); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(kb.x - 4, kb.y); ctx.lineTo(kb.x + 4, kb.y); ctx.moveTo(kb.x, kb.y - 4); ctx.lineTo(kb.x, kb.y + 4); ctx.stroke();
    }
  }
  // the link under the pointer: within a few pixels of its curve
  const curve = (l) => { const a = P.get(l.a), b = P.get(l.b); if (!a || !b) return null; const x0 = SX(a.x), y0 = SY(a.y), x1 = SX(b.x), y1 = SY(b.y); return [x0, y0, (x0 + x1) / 2 - (y1 - y0) * 0.14, (y0 + y1) / 2 + (x1 - x0) * 0.14, x1, y1]; };
  const hitLink = (mx, my) => {
    let best = null, bd = 6 * 6;
    for (const l of links) { if (!l.id) continue; const c = curve(l); if (!c) continue;
      for (let i = 2; i <= 18; i++) { const t = i / 20, u = 1 - t, x = u * u * c[0] + 2 * u * t * c[2] + t * t * c[4], y = u * u * c[1] + 2 * u * t * c[3] + t * t * c[5], d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = l.id; } } }
    return best;
  };
  const hit = (mx, my) => { let best = null, bd = 14 * 14; for (const p of P.values()) { const d = (SX(p.x) - mx) ** 2 + (SY(p.y) - my) ** 2; if (d < bd) { bd = d; best = p.n.id; } } return best; };
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const [x, y] = at(e), kb = knob(), h = hit(x, y); canvas.setPointerCapture(e.pointerId);
    if (edit && ((kb && Math.abs(x - kb.x) < 10 && Math.abs(y - kb.y) < 10) || (e.altKey && h))) { pull = { from: kb && Math.abs(x - kb.x) < 10 ? sel : h, x, y }; return draw(); }
    if (edit && h) { const ids = under(h); drag = { x, y, id: h, ids, start: new Map(ids.map((i) => [i, { x: P.get(i).x, y: P.get(i).y }])), moved: false }; return; }
    drag = { x, y, vx: view.x, vy: view.y, moved: false };
  });
  canvas.addEventListener("pointermove", (e) => {
    const [x, y] = at(e);
    if (pull) { pull.x = x; pull.y = y; const h = hit(x, y); over = h && h !== pull.from ? h : null; return draw(); }
    if (drag?.ids) {   // moving an idea and what hangs from it; over another idea, letting go grafts it there
      if (Math.hypot(x - drag.x, y - drag.y) > 4) drag.moved = true; if (!drag.moved) return;
      const dx = (x - drag.x) / view.k, dy = (y - drag.y) / view.k;
      for (const i of drag.ids) { const p = P.get(i), s0 = drag.start.get(i); p.x = s0.x + dx; p.y = s0.y + dy; }
      let o = null, bd = 16 * 16; for (const p of P.values()) { if (drag.ids.includes(p.n.id)) continue; const d = (SX(p.x) - x) ** 2 + (SY(p.y) - y) ** 2; if (d < bd) { bd = d; o = p.n.id; } }
      over = o && o !== P.get(drag.id).n.parentId ? o : null; canvas.style.cursor = over ? "copy" : "grabbing"; return draw();
    }
    if (drag) { if (Math.hypot(x - drag.x, y - drag.y) > 4) drag.moved = true; if (drag.moved) { view.x = drag.vx - (x - drag.x) / view.k; view.y = drag.vy - (y - drag.y) / view.k; draw(); } return; }
    const h = hit(x, y), kb = knob(), onKnob = kb && Math.abs(x - kb.x) < 10 && Math.abs(y - kb.y) < 10;
    const hl = !h && edit && onPickLink ? hitLink(x, y) : null;
    canvas.style.cursor = onKnob ? "crosshair" : h ? (edit ? "grab" : "pointer") : hl ? "pointer" : "grab";
    if (h !== hov || hl !== hovLink) { hov = h; hovLink = hl; draw(); }
  });
  canvas.addEventListener("pointerup", (e) => {
    const [x, y] = at(e);
    if (pull) { const p = pull, o = over; pull = null; over = null; draw(); if (o) onLink?.(p.from, o); else if (Math.hypot(x - SX(P.get(p.from)?.x ?? 0), y - SY(P.get(p.from)?.y ?? 0)) > 24) { const w = toWorld(x, y); onNew?.(p.from, Math.round(w.x), Math.round(w.y)); } return; }
    const d = drag; drag = null;
    if (d?.ids) {
      const o = over; over = null; canvas.style.cursor = "";
      if (!d.moved) { onPick?.(d.id); return; }
      if (o) {   // grafted: the moved ideas sit out from their new idea
        const t = P.get(o), r = P.get(d.id), ang = Math.atan2(r.y - t.y, r.x - t.x) || 0, ox = t.x + Math.cos(ang) * 75 - r.x, oy = t.y + Math.sin(ang) * 75 - r.y;
        for (const i of d.ids) { const p = P.get(i); p.x += ox; p.y += oy; }
      }
      draw(); onMove?.(d.ids.map((i) => [i, Math.round(P.get(i).x), Math.round(P.get(i).y)]));
      if (o) onDrop?.(d.id, o);
      return;
    }
    if (d && !d.moved) { const h = hit(x, y), hl = !h && edit && onPickLink ? hitLink(x, y) : null; if (h) onPick?.(h); else if (hl) onPickLink(hl); else if (edit) onPick?.(null); }
  });
  canvas.addEventListener("contextmenu", (e) => { if (!edit) return; e.preventDefault(); const [x, y] = at(e), h = hit(x, y), hl = !h && onPickLink ? hitLink(x, y) : null, w = toWorld(x, y); onMenu?.(h, e.clientX, e.clientY, Math.round(w.x), Math.round(w.y), hl); });
  // a graph dragged in from the Library
  canvas.addEventListener("dragover", (e) => { if (!edit || !e.dataTransfer.types.includes("application/x-bonsai-tree")) return; e.preventDefault(); const [x, y] = at(e), h = hit(x, y); if (h !== over) { over = h; draw(); } });
  canvas.addEventListener("dragleave", () => { if (over) { over = null; draw(); } });
  canvas.addEventListener("drop", (e) => { const t = e.dataTransfer.getData("application/x-bonsai-tree"); if (!edit || !t) return; e.preventDefault(); const [x, y] = at(e), h = hit(x, y); over = null; draw(); if (h) onDropTree?.(t, h); });
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
      colour = c || colour; links = ls; root = rootId;
      const s = rootId + ":" + nodes.map((n) => n.id + n.parentId).join(",");
      if (!edit) { if (s !== sig) { sig = s; P = layout(nodes, rootId); fit(); } else for (const n of nodes) { const p = P.get(n.id); if (p) p.n = n; } return draw(); }
      // the board: what has a place keeps it; what's new goes out from what it hangs off and is settled in among the rest
      const had = P, saved = nodes.filter((n) => Array.isArray(n.xy)), auto = !had.size && !saved.length ? layout(nodes, rootId) : null;
      kids = new Map(); for (const n of nodes) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
      for (const l of kids.values()) l.sort((a, b) => a.order - b.order);
      P = new Map(); const placed = [];
      const put = (n, depth) => {
        const o = had.get(n.id), a = auto?.get(n.id);
        if (Array.isArray(n.xy)) P.set(n.id, { x: n.xy[0], y: n.xy[1], vx: 0, vy: 0, n, depth });
        else if (o) P.set(n.id, { ...o, n, depth });
        else if (a) { P.set(n.id, { ...a, n, depth }); placed.push(n.id); }
        else {
          const par = P.get(n.parentId), gp = par && P.get(par.n.parentId), sib = (kids.get(n.parentId) || []).indexOf(n);
          let ang = par && gp ? Math.atan2(par.y - gp.y, par.x - gp.x) : -Math.PI / 2; ang += (sib - ((kids.get(n.parentId) || []).length - 1) / 2) * 0.55;
          P.set(n.id, { x: (par?.x ?? 0) + Math.cos(ang) * 70, y: (par?.y ?? 0) + Math.sin(ang) * 70, vx: 0, vy: 0, n, depth }); placed.push(n.id);
        }
        for (const c of kids.get(n.id) || []) put(c, depth + 1);
      };
      const r0 = nodes.find((n) => n.id === rootId); if (r0) put(r0, 0);
      if (placed.length && !auto) settle(new Set(placed));
      if (placed.length) onMove?.([...P.values()].filter((p) => placed.includes(p.n.id) || !Array.isArray(p.n.xy)).map((p) => [p.n.id, Math.round(p.x), Math.round(p.y)]));
      if (fresh) { fresh = false; fit(); }
      sig = s; draw();
    },
    get view() { return { ...view }; }, set view(v) { if (v) { view = { ...v }; fresh = false; draw(); } },
    toScreen(x, y) { const r = canvas.getBoundingClientRect(); return { x: r.left + SX(x), y: r.top + SY(y) }; },
    placeOf(id) { const p = P.get(id); return p && { x: p.x, y: p.y }; },
    // a free spot for something new under an idea, out away from what that idea hangs off
    spotFor(pid) {
      const par = P.get(pid); if (!par) return { x: 0, y: 0 };
      const gp = P.get(par.n.parentId), base = gp ? Math.atan2(par.y - gp.y, par.x - gp.x) : -Math.PI / 2;
      for (let i = 0; i < 24; i++) { const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.4, x = par.x + Math.cos(a) * 75, y = par.y + Math.sin(a) * 75;
        if ([...P.values()].every((p) => Math.hypot(p.x - x, p.y - y) > 40)) return { x, y }; }
      return { x: par.x + Math.cos(base) * 75, y: par.y + Math.sin(base) * 75 };
    },
    selectLink(id) { selLink = id || null; draw(); },
    linkAt(id) { const l = links.find((x) => x.id === id), c = l && curve(l), r = canvas.getBoundingClientRect(); if (!c) return null; const t = 0.5, u = 0.5; return { x: r.left + u * u * c[0] + 2 * u * t * c[2] + t * t * c[4], y: r.top + u * u * c[1] + 2 * u * t * c[3] + t * t * c[5] }; },   // for tests
    select(id) { sel = id; const p = P.get(id); if (p && (SX(p.x) < 30 || SX(p.x) > W - 30 || SY(p.y) < 20 || SY(p.y) > H - 20)) { view.x = p.x; view.y = p.y; } draw(); },
    attach(newHost) { if (canvas.parentElement !== newHost) { ro.unobserve(host); host = newHost; newHost.append(canvas); ro.observe(newHost); } resize(); },
    resize, fit() { fit(); draw(); }, redraw: () => draw(),
    screenOf(id) { const p = P.get(id), r = canvas.getBoundingClientRect(); return p && { x: r.left + SX(p.x), y: r.top + SY(p.y) }; },   // for tests
    destroy() { ro.disconnect(); canvas.remove(); },
  };
}
