// Builds the 3D meshes for one or many knowledge graphs, as ball-and-stick structures floating over a disc
// (nothing joins the first idea to the ground): ideas as smooth spheres, thin sticks between an idea and the ones under it, links inside a graph as straight bonds, and
// links from one graph to another as arcs. Also the flat ground under them: glows, discs and spokes.
import { THREE } from "./stage.js";
import { nodeRadius } from "./layout.js";
export { nodeRadius };

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();
const SPHERE = new THREE.SphereGeometry(1, 28, 18);
const LIMB = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
const ARC = 14;

function seg(m, a, b, r) {
  _d.subVectors(b, a); const len = _d.length() || 1e-4;
  _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / len)); _s.set(r, len, r);
  return m.compose(a, _q, _s);
}
export const limbRadius = (size) => Math.min(0.06, 0.016 + 0.007 * Math.sqrt(size));
const BOND = 0.019;

export class Flora {
  // items: [{tree, nodes, layout, offset: [x, z], looks: Map(id -> {color, status})}]
  // links: [{id, a, b}] where both ideas are among the items
  constructor(items, links, theme) {
    this.group = new THREE.Group(); this.items = items; this.theme = theme;
    this.ids = []; this.index = new Map(); this.home = new Map(); this.radii = new Map();
    const limbs = [], graphOf = new Map(), sky = new THREE.Color(theme.sky);
    items.forEach((it, k) => {
      const base = new THREE.Vector3(it.offset[0], 0, it.offset[1]), L = it.layout, shown = new Set(it.nodes.map((n) => n.id));
      for (const n of it.nodes) {
        const p = L.pos.get(n.id); if (!p) continue;
        this.index.set(n.id, this.ids.length); this.ids.push(n.id); graphOf.set(n.id, k);
        this.home.set(n.id, new THREE.Vector3(p[0] + base.x, p[1], p[2] + base.z));
        this.radii.set(n.id, nodeRadius(L.size.get(n.id), n.id === L.rootId));
        const parentShown = n.parentId != null && L.pos.has(n.parentId) && shown.has(n.parentId), color = it.looks.get(n.id)?.color || theme.limb;
        if (parentShown) limbs.push({ from: n.parentId, to: n.id, r: limbRadius(L.size.get(n.id)), color });
      }
    });
    this.limbs = limbs;
    const n = this.ids.length;
    this.nodeMesh = new THREE.InstancedMesh(SPHERE, new THREE.MeshPhongMaterial({ shininess: 40, specular: 0x222222 }), Math.max(1, n));
    this.nodeMesh.count = n; this.nodeMesh.userData = { kind: "node", ids: this.ids }; this.nodeMesh.frustumCulled = false;
    for (const it of items) for (const nd of it.nodes) {
      const i = this.index.get(nd.id); if (i == null) continue;
      const look = it.looks.get(nd.id); _c.set(look.color);
      if (look.status === "overdue") _c.lerp(sky, 0.66);
      this.nodeMesh.setColorAt(i, _c);
    }
    // Links: a straight bond inside one graph, an arc between two.
    const live = links.filter((l) => this.index.has(l.a) && this.index.has(l.b));
    this.bonds = live.filter((l) => graphOf.get(l.a) === graphOf.get(l.b)); this.links = live.filter((l) => graphOf.get(l.a) !== graphOf.get(l.b));
    // sticks take their idea's colour, let back toward the page so the ideas stand out; bonds take the link colour
    this.limbMesh = new THREE.InstancedMesh(LIMB, new THREE.MeshBasicMaterial(), Math.max(1, limbs.length + this.bonds.length));
    this.limbMesh.count = limbs.length + this.bonds.length; this.limbMesh.frustumCulled = false;
    limbs.forEach((l, i) => this.limbMesh.setColorAt(i, _c.set(l.color).lerp(sky, 0.32)));
    this.bonds.forEach((l, i) => this.limbMesh.setColorAt(limbs.length + i, _c.set(theme.link).lerp(sky, 0.12)));
    this.linkGeo = new THREE.BufferGeometry();
    this.linkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, this.links.length) * ARC * 6), 3));
    this.linkGeo.setDrawRange(0, this.links.length * ARC * 2);
    this.linkMesh = new THREE.LineSegments(this.linkGeo, new THREE.LineBasicMaterial({ color: theme.link, transparent: true, opacity: 0.32 }));
    this.linkMesh.frustumCulled = false;
    this.linkMid = new Map(live.map((l) => [l.id, new THREE.Vector3()]));
    this.group.add(this.limbMesh, this.nodeMesh, this.linkMesh);
    this.pos = new Map([...this.home].map(([k, v]) => [k, v.clone()]));
    this.apply();
  }

  // Writes this.pos (id -> Vector3) into the meshes.
  apply() {
    const P = this.pos, nl = this.limbs.length;
    this.ids.forEach((id, i) => { const r = this.radii.get(id); _m.compose(P.get(id), _q.identity(), _s.set(r, r, r)); this.nodeMesh.setMatrixAt(i, _m); });
    this.limbs.forEach((l, i) => this.limbMesh.setMatrixAt(i, seg(_m, typeof l.from === "string" ? P.get(l.from) : l.from, P.get(l.to), l.r)));
    this.bonds.forEach((l, i) => { const a = P.get(l.a), b = P.get(l.b); this.limbMesh.setMatrixAt(nl + i, seg(_m, a, b, BOND)); this.linkMid.get(l.id).addVectors(a, b).multiplyScalar(0.5); });
    const arr = this.linkGeo.attributes.position.array; let o = 0;
    for (const l of this.links) {
      const a = P.get(l.a), b = P.get(l.b), d = a.distanceTo(b);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + Math.min(14, d * 0.2) + 0.4, cz = (a.z + b.z) / 2;
      let px = a.x, py = a.y, pz = a.z;
      for (let k = 1; k <= ARC; k++) {
        const t = k / ARC, u = 1 - t;
        const x = u * u * a.x + 2 * u * t * cx + t * t * b.x, y = u * u * a.y + 2 * u * t * cy + t * t * b.y, z = u * u * a.z + 2 * u * t * cz + t * t * b.z;
        arr[o++] = px; arr[o++] = py; arr[o++] = pz; arr[o++] = x; arr[o++] = y; arr[o++] = z; px = x; py = y; pz = z;
        if (k === ARC / 2) this.linkMid.get(l.id).set(x, y, z);
      }
    }
    this.linkGeo.attributes.position.needsUpdate = true;
    for (const m of [this.nodeMesh, this.limbMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.nodeMesh.computeBoundingSphere();
  }

  dispose() {
    for (const m of [this.nodeMesh, this.limbMesh]) { m.material.dispose(); m.dispose(); }
    this.linkGeo.dispose(); this.linkMesh.material.dispose();
    this.group.removeFromParent();
  }
}

// The flat ground, in the tech tree's manner: a soft glow under each topic, a disc under each graph with a
// rim (and a ring inside it for reviews passed), and thin spokes from a name to what sits around it.
// glows: [{ x, z, r, color, k }]   discs: [{ x, z, r, color, rim, rings }]   spokes: [{ x0, z0, x1, z1, color }]
// → meshes to add to the scene (each has its own geometry and material)
export function ground({ glows = [], discs = [], spokes = [] }, sky) {
  const bg = new THREE.Color(sky), col = new THREE.Color(), out = [], SEG = 40;
  const dim = bg.r + bg.g + bg.b < 1 ? 0.4 : 1;   // on a dark page a colour shows far more for the same share, so the glow is held back
  const fan = (list, y, inner, outer, radius) => {
    const pos = [], cols = [];
    for (const g of list) {
      const c0 = col.set(g.color).lerp(bg, 1 - inner(g)).toArray(), c1 = col.set(g.color).lerp(bg, 1 - outer(g)).toArray(), r = radius(g);
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2, b = ((i + 1) / SEG) * Math.PI * 2;
        pos.push(g.x, y, g.z, g.x + Math.cos(b) * r, y, g.z + Math.sin(b) * r, g.x + Math.cos(a) * r, y, g.z + Math.sin(a) * r); cols.push(...c0, ...c1, ...c1);
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = -2 + y; out.push(m);
  };
  fan(glows, 0, (g) => (g.k ?? 0.13) * dim, () => 0, (g) => g.r);
  fan(discs, 0.012, () => 0.2 * (dim < 1 ? 0.6 : 1), () => 0.12 * (dim < 1 ? 0.6 : 1), (g) => g.r);
  const pos = [], cols = [];
  const line = (x0, z0, x1, z1, c) => { pos.push(x0, 0.02, z0, x1, 0.02, z1); cols.push(...c, ...c); };
  const loop = (x, z, r, c) => { for (let i = 0; i < SEG; i++) { const a = (i / SEG) * Math.PI * 2, b = ((i + 1) / SEG) * Math.PI * 2; line(x + Math.cos(a) * r, z + Math.sin(a) * r, x + Math.cos(b) * r, z + Math.sin(b) * r, c); } };
  for (const s of spokes) line(s.x0, s.z0, s.x1, s.z1, col.set(s.color).lerp(bg, 0.5).toArray());
  for (const d of discs) {
    loop(d.x, d.z, d.r, col.set(d.rim || d.color).lerp(bg, d.rim ? 0.1 : 0.35).toArray());
    for (let k = 1; k <= (d.rings || 0); k++) loop(d.x, d.z, d.r * (1 - k * 0.17), col.set(d.color).lerp(bg, 0.55).toArray());
  }
  if (pos.length) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthWrite: false })); m.frustumCulled = false; m.renderOrder = -1; out.push(m);
  }
  return out;
}

// A faint floor grid, for the meaning view.
export function grid(size, color) {
  const cells = Math.min(240, Math.max(10, Math.round(size / 2)));
  const g = new THREE.GridHelper(cells * 2, cells, color, color);
  g.position.y = -0.01;
  return g;
}
