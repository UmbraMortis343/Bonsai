// Lays a knowledge graph out in 3D as a ball-and-stick structure standing on a disc: a stem rises to the
// first idea, and each idea's own ideas fan out around the way it points. Links between two ideas of the
// same graph are straight bonds, so the structure then settles until no bond passes through another idea.
// Also places graphs in rings: a topic's graphs around its name, an island's topics around its name, and so on.
const GOLD = 2.399963229728653, FLOOR = 0.75;
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

export const nodeRadius = () => 0.26;   // every idea the same size (his call, 2026-11-19: the first one isn't bigger)
export const GAP = 0.2;      // clear space kept between a bond and any idea it doesn't join
const APART = 0.34;          // and between two ideas

// links: [{ a, b }] between ideas; only those with both ends in this graph shape it.
export function layoutTree(nodes, rootId, links = []) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = byId.get(rootId) || nodes.find((n) => n.parentId == null);
  const kids = new Map();
  for (const n of nodes) if (n.parentId != null && byId.has(n.parentId)) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
  for (const l of kids.values()) l.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const out = { pos: new Map(), depth: new Map(), size: new Map(), kids, rootId: root?.id, center: [0, 1, 0], radius: 2, footprint: 1.5, height: 2, bonds: [], tight: 0, pinned: new Set() };
  if (!root) return out;

  // How much hangs off each idea, leaves first.
  const order = []; const stack = [root];
  while (stack.length) { const n = stack.pop(); order.push(n); for (const c of kids.get(n.id) || []) stack.push(c); }
  for (let i = order.length - 1; i >= 0; i--) out.size.set(order[i].id, 1 + (kids.get(order[i].id) || []).reduce((a, c) => a + out.size.get(c.id), 0));

  const stem = 1.3 + 0.36 * Math.log2(out.size.get(root.id) + 1);   // how high the first idea floats over its disc
  const dir = new Map([[root.id, [0, 1, 0]]]), rest = new Map();
  out.pos.set(root.id, [0, stem, 0]); out.depth.set(root.id, 0);
  for (const n of order) {
    const ks = kids.get(n.id); if (!ks) continue;
    const d = out.depth.get(n.id) + 1, pd = dir.get(n.id), p = out.pos.get(n.id);
    const u = norm(cross(pd, Math.abs(pd[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(pd, u);
    const total = ks.reduce((a, c) => a + out.size.get(c.id), 0);
    let acc = 0;
    ks.forEach((c, i) => {
      const w = out.size.get(c.id) / total, phi = d * GOLD + (acc + w / 2) * Math.PI * 2; acc += w;
      const inner = ks.length > 5 && i % 2 === 1;
      // one idea carries on with a kink, like a chain; several spread wide around the way their parent points
      let tilt = ks.length === 1 ? 0.5 : d === 1 ? 1.15 : 0.95;
      if (inner) tilt *= 0.55;
      const ct = Math.cos(tilt), st = Math.sin(tilt), cp = Math.cos(phi), sp = Math.sin(phi);
      let dv = [pd[0] * ct + (u[0] * cp + v[0] * sp) * st, pd[1] * ct + (u[1] * cp + v[1] * sp) * st + 0.1, pd[2] * ct + (u[2] * cp + v[2] * sp) * st];
      if (dv[1] < -0.3) dv[1] = -0.3;
      dv = norm(dv);
      const big = Math.log2(out.size.get(c.id));
      const len = Math.max(1.05, 1.75 * Math.pow(0.9, d - 1) * (1 + 0.16 * big) * (inner ? 0.72 : 1));
      // an idea moved by hand sits where it was put, and what hangs from it fans out from there
      const pin = Array.isArray(c.pin) && c.pin.length === 3 && c.pin.every(Number.isFinite) ? [c.pin[0], Math.max(FLOOR, c.pin[1]), c.pin[2]] : null;
      if (pin) { const to = [pin[0] - p[0], pin[1] - p[1], pin[2] - p[2]], l = Math.hypot(to[0], to[1], to[2]); if (l > 1e-3) { dv = [to[0] / l, to[1] / l, to[2] / l]; out.pinned.add(c.id); rest.set(c.id, l); } }
      dir.set(c.id, dv); out.depth.set(c.id, d); if (!out.pinned.has(c.id)) rest.set(c.id, len);
      out.pos.set(c.id, out.pinned.has(c.id) ? pin : [p[0] + dv[0] * len, Math.max(FLOOR, p[1] + dv[1] * len), p[2] + dv[2] * len]);
    });
  }
  const seen = new Set();
  const own = links.filter((l) => l.a !== l.b && out.pos.has(l.a) && out.pos.has(l.b) && byId.get(l.a).parentId !== l.b && byId.get(l.b).parentId !== l.a && !seen.has([l.a, l.b].sort().join("|")) && seen.add([l.a, l.b].sort().join("|")));
  out.tight = settle(out, order, rest, own);
  out.bonds = own.map((l) => ({ a: l.a, b: l.b }));

  let min = [0, 0, 0], max = [0, 0, 0], foot = 0;
  for (const p of out.pos.values()) { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); } foot = Math.max(foot, Math.hypot(p[0], p[2])); }
  out.center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  out.radius = Math.max(2, ...[...out.pos.values()].map((p) => Math.hypot(p[0] - out.center[0], p[1] - out.center[1], p[2] - out.center[2]))) + 0.6;
  out.radius = Math.max(out.radius, Math.hypot(out.center[0], out.center[1], out.center[2]) + 0.4);
  out.footprint = Math.max(1.5, foot + 0.8); out.height = max[1];
  return out;
}

// Where on the bond a→b is closest to c, and how far away that is.
function nearest(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1e-9;
  const t = Math.min(1, Math.max(0, ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / l2));
  const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
  return { t, q, d: Math.hypot(c[0] - q[0], c[1] - q[1], c[2] - q[2]), ab };
}
// How many ideas a bond comes too close to: 0 once the structure is clear. For tests and for settle to know when to stop.
export function crowding(L, gap = GAP * 0.9) {
  const ids = [...L.pos.keys()], P = L.pos, R = (id) => nodeRadius(L.size.get(id), id === L.rootId);
  const bonds = [...L.bonds]; for (const [pid, ks] of L.kids) for (const c of ks) if (P.has(pid) && P.has(c.id)) bonds.push({ a: pid, b: c.id });
  let n = 0;
  for (const e of bonds) for (const id of ids) { if (id === e.a || id === e.b) continue; if (nearest(P.get(e.a), P.get(e.b), P.get(id)).d < R(id) + gap) n++; }
  return n;
}

// Settles the structure. Sticks keep their length, a link draws its two ideas within reach of each other,
// ideas keep apart, and any idea in the way of a bond is moved aside (the bond's ends give a little too).
// Nothing here is random, so a graph always settles the same way. Returns how many crowded spots are left (0 when clear).
function settle(L, order, rest, links) {
  const ids = order.map((n) => n.id), N = ids.length;
  if (N < 3) return 0;
  const ix = new Map(ids.map((id, i) => [id, i])), root = ix.get(L.rootId);
  const X = new Float64Array(N), Y = new Float64Array(N), Z = new Float64Array(N), R = new Float64Array(N);
  ids.forEach((id, i) => { const p = L.pos.get(id); X[i] = p[0]; Y[i] = p[1]; Z[i] = p[2]; R[i] = nodeRadius(L.size.get(id), i === root); });
  const sticks = order.filter((n) => n.id !== L.rootId).map((n) => [ix.get(n.parentId), ix.get(n.id), rest.get(n.id)]);
  const ties = links.map((l) => [ix.get(l.a), ix.get(l.b)]), bonds = [...sticks, ...ties];
  const reach = 2.6 + 0.25 * Math.log2(N);   // a link is happy at this length or shorter
  const fixed = new Uint8Array(N); fixed[root] = 1; for (const id of L.pinned) fixed[ix.get(id)] = 1;   // the first idea, and any idea placed by hand
  const move = (i, dx, dy, dz) => { if (fixed[i]) return; X[i] += dx; Y[i] = Math.max(FLOOR, Y[i] + dy); Z[i] += dz; };
  const side = (ab, key) => {   // a steady sideways direction for an idea sitting dead on a bond
    const n = norm(cross(ab, Math.abs(ab[1]) > 0.9 * Math.hypot(ab[0], ab[1], ab[2]) ? [1, 0, 0] : [0, 1, 0])), m = norm(cross(ab, n)), a = hash(key) * Math.PI * 2;
    return [n[0] * Math.cos(a) + m[0] * Math.sin(a), n[1] * Math.cos(a) + m[1] * Math.sin(a), n[2] * Math.cos(a) + m[2] * Math.sin(a)];
  };
  // One round of moving apart whatever is too close. Returns how many things had to move.
  const clear = (act) => {
    let moved = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let dx = X[j] - X[i], dy = Y[j] - Y[i], dz = Z[j] - Z[i]; const want = R[i] + R[j] + APART;
      if (dx > want || dx < -want || dy > want || dy < -want || dz > want || dz < -want) continue;
      let d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d >= want) continue;
      if (!act) return 1;
      if (d < 1e-6) { [dx, dy, dz] = side([0, 1, 0], ids[i] + ids[j]); d = 1; }
      const k = (0.5 * (want - d)) / d, wi = fixed[i] ? 0 : fixed[j] ? 2 : 1, wj = 2 - wi;
      move(i, -dx * k * wi, -dy * k * wi, -dz * k * wi); move(j, dx * k * wj, dy * k * wj, dz * k * wj); moved++;
    }
    for (const [a, b] of bonds) {
      const ax = X[a], ay = Y[a], az = Z[a], bx = X[b] - ax, by = Y[b] - ay, bz = Z[b] - az, l2 = bx * bx + by * by + bz * bz || 1e-9;
      const x0 = Math.min(ax, ax + bx) - 0.8, x1 = Math.max(ax, ax + bx) + 0.8, y0 = Math.min(ay, ay + by) - 0.8, y1 = Math.max(ay, ay + by) + 0.8, z0 = Math.min(az, az + bz) - 0.8, z1 = Math.max(az, az + bz) + 0.8;
      for (let c = 0; c < N; c++) {
        if (c === a || c === b) continue;
        const cx = X[c], cy = Y[c], cz = Z[c]; if (cx < x0 || cx > x1 || cy < y0 || cy > y1 || cz < z0 || cz > z1) continue;
        const t = Math.min(1, Math.max(0, ((cx - ax) * bx + (cy - ay) * by + (cz - az) * bz) / l2));
        const qx = cx - ax - bx * t, qy = cy - ay - by * t, qz = cz - az - bz * t, d = Math.sqrt(qx * qx + qy * qy + qz * qz), want = R[c] + GAP + 0.04;
        if (d >= want) continue;
        if (!act) return 1;
        const n = d < 1e-5 ? side([bx, by, bz], ids[c] + ids[a] + ids[b]) : [qx / d, qy / d, qz / d];
        const push = want - d, kc = fixed[c] ? 0 : fixed[a] && fixed[b] ? 1 : 0.65, ke = (1 - kc) * push;
        move(c, n[0] * push * kc, n[1] * push * kc, n[2] * push * kc);
        move(a, -n[0] * ke * (1 - t), -n[1] * ke * (1 - t), -n[2] * ke * (1 - t)); move(b, -n[0] * ke * t, -n[1] * ke * t, -n[2] * ke * t);
        moved++;
      }
    }
    return moved;
  };
  // with no links the first placing is nearly always clear already: only settle when something is in the way
  if (!ties.length && !clear(false)) return 0;
  const MAX = 150;
  for (let it = 0; it < MAX; it++) {
    const soft = it < MAX * 0.5;   // links pull early on; the last rounds only clear and straighten
    let pull = 0;
    if (soft) for (const [a, b] of ties) {
      const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; if (d <= reach) continue;
      const k = (0.16 * (d - reach)) / d; move(a, dx * k, dy * k, dz * k); move(b, -dx * k, -dy * k, -dz * k); pull = Math.max(pull, 0.16 * (d - reach));
    }
    for (const [a, b, len] of sticks) {
      const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const k = (0.5 * (d - len)) / d, wa = fixed[a] ? 0 : fixed[b] ? 1 : 0.3, wb = fixed[b] ? 0 : fixed[a] ? 1 : 0.7;
      move(a, dx * k * wa, dy * k * wa, dz * k * wa); move(b, -dx * k * wb, -dy * k * wb, -dz * k * wb);
    }
    if (!clear(true) && (!soft || pull < 0.004)) break;
  }
  ids.forEach((id, i) => { const p = L.pos.get(id); p[0] = X[i]; p[1] = Y[i]; p[2] = Z[i]; });
  return crowding({ ...L, bonds: links }, GAP * 0.9);
}

// Rings within rings. Each thing is { id, kind, r } (a graph, r its footprint) or { id, kind, kids: [...] }.
// A thing with kids keeps its middle free for its name and sets the kids around it, the first one at the back,
// each given the arc its size needs. → { at: Map(id → { x, z, r, kind, ring }), radius, center }
const ROOM = { topic: 1.3, isle: 2, hub: 2.6, all: 0 }, PAD = { topic: 0.3, isle: 0.8, hub: 1.5, all: 0 }, BETWEEN = { topic: 0.4, isle: 1, hub: 2.4, all: 4 };
export function layoutRings(top) {
  const at = new Map();
  const size = (t) => {
    if (!t.kids) return (t.R = Math.max(0.8, t.r));
    const rs = t.kids.map(size), gap = BETWEEN[t.kind] ?? 1, room = ROOM[t.kind] ?? 1;
    if (!rs.length) { t.ring = 0; return (t.R = room + 0.6); }
    // hubs have no name between them to sit around, so they are packed close: the biggest first, each next one as near the middle as it fits
    if (t.kind === "all" && rs.length > 1) {
      const put = []; t.spots = new Array(rs.length);
      for (const i of rs.map((_, k) => k).sort((a, b) => rs[b] - rs[a])) {
        let best = put.length ? null : { x: 0, z: 0 };
        for (const p of put) for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2, d = p.r + rs[i] + gap, c = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
          if (put.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= o.r + rs[i] + gap - 1e-6) && (!best || Math.hypot(c.x, c.z) < Math.hypot(best.x, best.z) - 1e-6)) best = c;
        }
        put.push({ ...best, r: rs[i] }); t.spots[i] = best;
      }
      t.ring = 0; return (t.R = Math.max(...put.map((p) => Math.hypot(p.x, p.z) + p.r)));
    }
    // a lone island or hub fills the middle; a lone graph still sits beside its topic's name
    if (rs.length === 1 && t.kind !== "topic") { t.ring = 0; return (t.R = rs[0] + (PAD[t.kind] ?? 0)); }
    const big = Math.max(...rs), fits = (R) => rs.reduce((a, r) => a + 2 * Math.asin(Math.min(1, (r + gap / 2) / R)), 0) <= Math.PI * 2;
    let lo = room + big, hi = lo;
    if (!fits(lo)) { while (!fits(hi)) hi *= 1.5; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; } lo = hi; }
    t.ring = lo; return (t.R = lo + big + (PAD[t.kind] ?? 0));
  };
  const place = (t, x, z) => {
    at.set(t.id, { x, z, r: t.R, kind: t.kind, ring: t.ring || 0 });
    if (!t.kids?.length) return;
    if (t.spots) return t.kids.forEach((k, i) => place(k, x + t.spots[i].x, z + t.spots[i].z));
    if (!t.ring) return place(t.kids[0], x, z);
    const gap = BETWEEN[t.kind] ?? 1, arcs = t.kids.map((k) => 2 * Math.asin(Math.min(1, (k.R + gap / 2) / t.ring)));
    const spare = (Math.PI * 2 - arcs.reduce((a, b) => a + b, 0)) / t.kids.length;
    let a = -Math.PI / 2 - arcs[0] / 2 - spare / 2;
    t.kids.forEach((k, i) => { const mid = a + (arcs[i] + spare) / 2; a += arcs[i] + spare; place(k, x + Math.cos(mid) * t.ring, z + Math.sin(mid) * t.ring); });
  };
  size(top); place(top, 0, 0);
  // what the camera should frame: the circle round everything placed, which is rarely centred on the outermost ring
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of at.values()) { if (p.kind !== "graph" && p.kind !== "topic") continue; x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r); z0 = Math.min(z0, p.z - p.r); z1 = Math.max(z1, p.z + p.r); }
  if (!isFinite(x0)) return { at, radius: Math.max(6, top.R), center: { x: 0, z: 0 } };
  const center = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 }; let radius = 6;
  for (const p of at.values()) if (p.kind === "graph" || p.kind === "topic") radius = Math.max(radius, Math.hypot(p.x - center.x, p.z - center.z) + p.r);
  return { at, radius, center };
}

// Tiers, for the joined view: parts (an island's whole structure each) that grow one from another, set out as a
// tech tree in 3D. The first part sits in the middle; what grows from it stands on a ring round it, a step higher;
// what grows from those on the next ring, higher again. A part stands out beyond the idea it grows from, and is
// turned so that the ideas its own offshoots grow from face outward. Nothing overlaps seen from above.
// parts: [{ id, parent (a part's id, null for the first), r (how far it reaches sideways), fromAt: [x, z] | null
// (where, in the parent's own frame, the idea it grows from sits) }], the first one first, parents before children.
// → Map(id → { x, z, lift, rot, tier, angle })
export function layoutTiers(parts, gap = 2.5) {
  const out = new Map(), kids = new Map(), turn = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  if (!parts.length) return out;
  for (const p of parts) if (p.parent != null) { if (!kids.has(p.parent)) kids.set(p.parent, []); kids.get(p.parent).push(p); }
  // a part is turned so the ideas its offshoots grow from point the way it faces
  const rotFor = (p, angle) => { let sx = 0, sz = 0; for (const c of kids.get(p.id) || []) if (c.fromAt && Math.hypot(c.fromAt[0], c.fromAt[1]) > 0.3) { const l = Math.hypot(c.fromAt[0], c.fromAt[1]); sx += c.fromAt[0] / l; sz += c.fromAt[1] / l; } return Math.hypot(sx, sz) > 0.2 ? angle - Math.atan2(sz, sx) : 0; };
  out.set(parts[0].id, { x: 0, z: 0, lift: 0, rot: 0, tier: 0, angle: 0 });
  let tier = [parts[0]], ring = 0, reach = parts[0].r, lift = 0;
  for (let k = 1; tier.length; k++) {
    const next = tier.flatMap((p) => kids.get(p.id) || []); if (!next.length) break;
    const big = Math.max(...next.map((p) => p.r));
    ring = Math.max(ring + reach + big + gap, next.reduce((a, p) => a + 2 * p.r + gap, 0) / (Math.PI * 2 * 0.72));
    lift += 0.3 * (reach + big); reach = big;
    // where each would like to stand: straight out past the idea it grows from
    const want = next.map((p, i) => {
      const P = out.get(p.parent), at = p.fromAt ? turn(p.fromAt, P.rot) : [0, 0], w = [P.x + at[0], P.z + at[1]];
      return Math.hypot(w[0], w[1]) > 0.5 ? Math.atan2(w[1], w[0]) : P.tier ? P.angle : (i / next.length) * Math.PI * 2 - Math.PI / 2;
    });
    const half = next.map((p) => Math.asin(Math.min(1, (p.r + gap / 2) / ring)));
    const idx = next.map((_, i) => i).sort((a, b) => want[a] - want[b]), ang = idx.map((i) => want[i]);
    // then moved apart round the ring until none overlap
    for (let it = 0; it < 200 && idx.length > 1; it++) {
      let moved = false;
      for (let a = 0; a < idx.length; a++) {
        const b = (a + 1) % idx.length, need = half[idx[a]] + half[idx[b]]; let d = ang[b] - ang[a] + (b === 0 ? Math.PI * 2 : 0);
        if (idx.length === 2 && b === 0) d = Math.PI * 2 - (ang[1] - ang[0]);
        if (d < need - 1e-4) { const push = (need - d) / 2; ang[a] -= push; ang[b] += push; moved = true; }
      }
      if (!moved) break;
    }
    idx.forEach((i, a) => { const p = next[i], angle = ang[a]; out.set(p.id, { x: Math.cos(angle) * ring, z: Math.sin(angle) * ring, lift, rot: 0, tier: k, angle }); });
    for (const p of next) out.get(p.id).rot = rotFor(p, out.get(p.id).angle);
    tier = next;
  }
  for (const p of parts) if (!out.has(p.id)) out.set(p.id, { x: 0, z: 0, lift: 0, rot: 0, tier: 0, angle: 0 });   // cut off from the first by a missing parent
  return out;
}
