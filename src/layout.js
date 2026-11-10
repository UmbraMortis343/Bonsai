// Lays a tree out in 3D. The trunk rises from the ground to the core idea;
// each idea's branches fan out around its own direction, with more room for
// bigger sub-branches, and everything leans upward like a real tree.
const GOLD = 2.399963229728653;
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function layoutTree(nodes, rootId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = byId.get(rootId) || nodes.find((n) => n.parentId == null);
  const kids = new Map();
  for (const n of nodes) if (n.parentId != null && byId.has(n.parentId)) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
  for (const l of kids.values()) l.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const out = { pos: new Map(), depth: new Map(), size: new Map(), kids, rootId: root?.id, center: [0, 1, 0], radius: 2, footprint: 1.5, height: 2 };
  if (!root) return out;

  // Sub-branch sizes, leaves first.
  const order = []; const stack = [root];
  while (stack.length) { const n = stack.pop(); order.push(n); for (const c of kids.get(n.id) || []) stack.push(c); }
  for (let i = order.length - 1; i >= 0; i--) out.size.set(order[i].id, 1 + (kids.get(order[i].id) || []).reduce((a, c) => a + out.size.get(c.id), 0));

  const trunk = 1.5 + 0.45 * Math.log2(out.size.get(root.id) + 1);
  const dir = new Map([[root.id, [0, 1, 0]]]);
  out.pos.set(root.id, [0, trunk, 0]); out.depth.set(root.id, 0);
  for (const n of order) {
    const ks = kids.get(n.id); if (!ks) continue;
    const d = out.depth.get(n.id) + 1, pd = dir.get(n.id), p = out.pos.get(n.id);
    const u = norm(cross(pd, Math.abs(pd[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(pd, u);
    const total = ks.reduce((a, c) => a + out.size.get(c.id), 0);
    let acc = 0;
    ks.forEach((c, i) => {
      const w = out.size.get(c.id) / total, phi = d * GOLD + (acc + w / 2) * Math.PI * 2; acc += w;
      const inner = ks.length > 4 && i % 2 === 1;
      let tilt = ks.length === 1 ? (d === 1 ? 0.32 : 0.24) : (d === 1 ? 1.0 : 0.74);
      if (inner) tilt *= 0.6;
      const ct = Math.cos(tilt), st = Math.sin(tilt), cp = Math.cos(phi), sp = Math.sin(phi);
      let dv = [pd[0] * ct + (u[0] * cp + v[0] * sp) * st, pd[1] * ct + (u[1] * cp + v[1] * sp) * st + 0.22, pd[2] * ct + (u[2] * cp + v[2] * sp) * st];
      if (dv[1] < 0.08) dv[1] = 0.08;
      dv = norm(dv);
      const len = 1.9 * Math.pow(0.84, d - 1) * (1 + 0.2 * Math.log2(out.size.get(c.id))) * (inner ? 0.75 : 1);
      dir.set(c.id, dv); out.depth.set(c.id, d);
      out.pos.set(c.id, [p[0] + dv[0] * len, p[1] + dv[1] * len, p[2] + dv[2] * len]);
    });
  }
  let min = [0, 0, 0], max = [0, 0, 0], foot = 0;
  for (const p of out.pos.values()) { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); } foot = Math.max(foot, Math.hypot(p[0], p[2])); }
  out.center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  out.radius = Math.max(2, ...[...out.pos.values()].map((p) => Math.hypot(p[0] - out.center[0], p[1] - out.center[1], p[2] - out.center[2]))) + 0.6;
  out.radius = Math.max(out.radius, Math.hypot(out.center[0], out.center[1], out.center[2]) + 0.4);
  out.footprint = Math.max(1.5, foot + 0.8); out.height = max[1];
  return out;
}

// Trees in a zone sit on a sunflower spiral; zones are packed without overlap.
export function layoutForest(zones) {
  // zones: [{id, trees: [{id, footprint}]}] -> {zones: Map(id -> {x, z, r}), trees: Map(id -> {x, z})}
  const out = { zones: new Map(), trees: new Map(), radius: 10, center: { x: 0, z: 0 } };
  const placed = [];
  zones.forEach((z, zi) => {
    const fp = Math.max(1.5, ...z.trees.map((t) => t.footprint));
    const step = fp * 1.15, local = [];
    z.trees.forEach((t, i) => { const r = z.trees.length === 1 ? 0 : step * Math.sqrt(i + 0.6), a = i * GOLD; local.push([t.id, r * Math.cos(a), r * Math.sin(a)]); });
    const zr = Math.max(3, ...local.map(([, x, y], i) => Math.hypot(x, y) + z.trees[i].footprint)) + 1;
    let x = 0, y = 0;
    for (let k = 0; k < 4000; k++) {
      const r = 0.9 * Math.sqrt(k) * 2, a = k * GOLD + zi;
      x = k ? r * Math.cos(a) : 0; y = k ? r * Math.sin(a) : 0;
      if (placed.every((p) => Math.hypot(p.x - x, p.z - y) > p.r + zr + 1.5)) break;
    }
    placed.push({ x, z: y, r: zr });
    out.zones.set(z.id, { x, z: y, r: zr });
    for (const [id, lx, ly] of local) out.trees.set(id, { x: x + lx, z: y + ly });
  });
  if (placed.length) {
    const x0 = Math.min(...placed.map((p) => p.x - p.r)), x1 = Math.max(...placed.map((p) => p.x + p.r)), z0 = Math.min(...placed.map((p) => p.z - p.r)), z1 = Math.max(...placed.map((p) => p.z + p.r));
    out.center = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    out.radius = Math.max(6, ...placed.map((p) => Math.hypot(p.x - out.center.x, p.z - out.center.z) + p.r));
  }
  return out;
}
