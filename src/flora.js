// Builds the 3D meshes for one or many trees: ideas as spheres, branches and
// surface roots as tapered cylinders, cross-links as glowing arcs.
import { THREE } from "./stage.js";

const UP = new THREE.Vector3(0, 1, 0), GOLD = 2.399963229728653;
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();
const SPHERE = new THREE.IcosahedronGeometry(1, 2);
const LIMB = new THREE.CylinderGeometry(0.62, 1, 1, 7, 1, false).translate(0, 0.5, 0);
const ARC = 14;

function seg(m, a, b, r) {
  _d.subVectors(b, a); const len = _d.length() || 1e-4;
  _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / len)); _s.set(r, len, r);
  return m.compose(a, _q, _s);
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
export const nodeRadius = (size, isRoot) => (isRoot ? 0.3 : 0.15) + 0.045 * Math.log2(size);
export const limbRadius = (size) => Math.min(0.34, 0.03 + 0.028 * Math.sqrt(size));

export class Flora {
  // items: [{tree, nodes, layout, offset: [x, z], looks: Map(id -> {color, status}), passes}]
  // links: [{id, a, b}] where both ideas are among the items
  constructor(items, links, theme) {
    this.group = new THREE.Group(); this.items = items; this.theme = theme;
    this.ids = []; this.index = new Map(); this.home = new Map(); this.radii = new Map();
    const limbs = [], statics = [];
    for (const it of items) {
      const base = new THREE.Vector3(it.offset[0], 0, it.offset[1]), L = it.layout, shown = new Set(it.nodes.map((n) => n.id));
      for (const n of it.nodes) {
        const p = L.pos.get(n.id); if (!p) continue;
        this.index.set(n.id, this.ids.length); this.ids.push(n.id);
        this.home.set(n.id, new THREE.Vector3(p[0] + base.x, p[1], p[2] + base.z));
        this.radii.set(n.id, nodeRadius(L.size.get(n.id), n.id === L.rootId));
        const parentShown = n.parentId != null && L.pos.has(n.parentId) && shown.has(n.parentId);
        if (n.id === L.rootId) limbs.push({ from: base, to: n.id, r: limbRadius(L.size.get(n.id)) * 1.25 });
        else if (parentShown) limbs.push({ from: n.parentId, to: n.id, r: limbRadius(L.size.get(n.id)) });
      }
      // Surface roots: more and longer with every passed review.
      const passes = it.passes || 0;
      if (passes > 0 && L.rootId) {
        const count = Math.min(14, 3 + Math.floor(Math.sqrt(passes) * 1.5)), reach = Math.min(L.footprint * 1.1, 0.7 + 0.4 * Math.sqrt(passes));
        const r0 = limbRadius(L.size.get(L.rootId)) * 0.9, h0 = hash(it.tree.id);
        for (let j = 0; j < count; j++) {
          let a = j * GOLD + h0 * 6.28, len = reach * (0.6 + 0.4 * hash(it.tree.id + j)), prev = new THREE.Vector3(base.x, 0.16, base.z);
          for (let k = 0; k < 3; k++) {
            a += (hash(it.tree.id + j + "k" + k) - 0.5) * 0.9;
            const next = new THREE.Vector3(prev.x + Math.cos(a) * len / 3, Math.max(0.02, 0.1 - 0.05 * k), prev.z + Math.sin(a) * len / 3);
            statics.push(seg(new THREE.Matrix4(), prev, next, r0 * (1 - k * 0.28))); prev = next;
          }
        }
      }
    }
    this.limbs = limbs;
    const n = this.ids.length;
    this.nodeMesh = new THREE.InstancedMesh(SPHERE, new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 }), Math.max(1, n));
    this.nodeMesh.count = n; this.nodeMesh.userData = { kind: "node", ids: this.ids }; this.nodeMesh.frustumCulled = false;
    this.limbMesh = new THREE.InstancedMesh(LIMB, new THREE.MeshStandardMaterial({ color: theme.bark, roughness: 0.9 }), Math.max(1, limbs.length + statics.length));
    this.limbMesh.count = limbs.length + statics.length; this.limbMesh.frustumCulled = false;
    statics.forEach((m, i) => this.limbMesh.setMatrixAt(limbs.length + i, m));
    // Glow for fresh ideas.
    const fresh = [];
    for (const it of items) for (const nd of it.nodes) if (it.looks.get(nd.id)?.status === "fresh" && this.index.has(nd.id)) fresh.push(nd.id);
    this.freshIds = fresh;
    this.haloMesh = new THREE.InstancedMesh(SPHERE, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }), Math.max(1, fresh.length));
    this.haloMesh.count = fresh.length; this.haloMesh.frustumCulled = false;
    const sky = new THREE.Color(theme.sky);
    for (const it of items) for (const nd of it.nodes) {
      const i = this.index.get(nd.id); if (i == null) continue;
      const look = it.looks.get(nd.id); _c.set(look.color);
      if (look.status === "overdue") _c.lerp(sky, 0.62);
      this.nodeMesh.setColorAt(i, _c);
    }
    fresh.forEach((id, i) => { const it = items.find((x) => x.looks.has(id)); this.haloMesh.setColorAt(i, _c.set(it.looks.get(id).color)); });
    // Cross-links.
    this.links = links.filter((l) => this.index.has(l.a) && this.index.has(l.b));
    this.linkGeo = new THREE.BufferGeometry();
    this.linkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, this.links.length) * ARC * 6), 3));
    this.linkGeo.setDrawRange(0, this.links.length * ARC * 2);
    this.linkMesh = new THREE.LineSegments(this.linkGeo, new THREE.LineBasicMaterial({ color: theme.link, transparent: true, opacity: 0.9 }));
    this.linkMesh.frustumCulled = false;
    this.linkMid = new Map(this.links.map((l) => [l.id, new THREE.Vector3()]));
    this.group.add(this.limbMesh, this.nodeMesh, this.haloMesh, this.linkMesh);
    this.pos = new Map([...this.home].map(([k, v]) => [k, v.clone()]));
    this.apply();
  }

  // Writes this.pos (id -> Vector3) into the meshes.
  apply() {
    const P = this.pos;
    this.ids.forEach((id, i) => { const r = this.radii.get(id); _m.compose(P.get(id), _q.identity(), _s.set(r, r, r)); this.nodeMesh.setMatrixAt(i, _m); });
    this.limbs.forEach((l, i) => this.limbMesh.setMatrixAt(i, seg(_m, typeof l.from === "string" ? P.get(l.from) : l.from, P.get(l.to), l.r)));
    this.freshIds.forEach((id, i) => { const r = this.radii.get(id) * 1.9; _m.compose(P.get(id), _q.identity(), _s.set(r, r, r)); this.haloMesh.setMatrixAt(i, _m); });
    const arr = this.linkGeo.attributes.position.array; let o = 0;
    for (const l of this.links) {
      const a = P.get(l.a), b = P.get(l.b), d = a.distanceTo(b);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + d * 0.28 + 0.4, cz = (a.z + b.z) / 2;
      let px = a.x, py = a.y, pz = a.z;
      for (let k = 1; k <= ARC; k++) {
        const t = k / ARC, u = 1 - t;
        const x = u * u * a.x + 2 * u * t * cx + t * t * b.x, y = u * u * a.y + 2 * u * t * cy + t * t * b.y, z = u * u * a.z + 2 * u * t * cz + t * t * b.z;
        arr[o++] = px; arr[o++] = py; arr[o++] = pz; arr[o++] = x; arr[o++] = y; arr[o++] = z; px = x; py = y; pz = z;
        if (k === ARC / 2) this.linkMid.get(l.id).set(x, y, z);
      }
    }
    this.linkGeo.attributes.position.needsUpdate = true;
    for (const m of [this.nodeMesh, this.limbMesh, this.haloMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.nodeMesh.computeBoundingSphere();
  }

  dispose() {
    for (const m of [this.nodeMesh, this.limbMesh, this.haloMesh]) { m.material.dispose(); m.dispose(); }
    this.linkGeo.dispose(); this.linkMesh.material.dispose();
    this.group.removeFromParent();
  }
}

export function disc(radius, color, y = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y;
  return m;
}
