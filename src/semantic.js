// Maths for the meaning view. Pure functions, shared by the app, the worker
// and the tests. Vectors are unit length, packed in one Float32Array (n * dim).
export const DIM = 384;
export const MODEL = "all-MiniLM-L6-v2";

export function hashText(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }
export function seeded(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// What gets embedded for an idea: its title, where it sits, and its notes.
export function textFor(node, parent, tree) {
  const body = String(node.body || "").replace(/[#*`>\[\]()!_-]+/g, " ").replace(/\s+/g, " ").slice(0, 1200);
  return `${node.title}${parent ? ", part of " + parent.title : ""}${tree ? " (" + tree.name + ")" : ""}. ${node.note || ""} ${body}`.trim();
}

export const dot = (a, i, b, j, dim = DIM) => { let s = 0; for (let k = 0; k < dim; k++) s += a[i * dim + k] * b[j * dim + k]; return s; };

// The k most similar pairs with cosine >= min: [[i, j, cos], ...], best first.
export function topPairs(v, n, k = 300, min = 0.35, dim = DIM) {
  const out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const c = dot(v, i, v, j, dim); if (c >= min) out.push([i, j, c]); }
  return out.sort((a, b) => b[2] - a[2]).slice(0, k);
}

// Principal components: n points in dim dimensions down to 3. Deterministic.
export function pca3(v, n, dim = DIM) {
  const out = new Float32Array(n * 3); if (n < 2) return out;
  const mean = new Float64Array(dim), x = new Float64Array(n * dim);
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) mean[k] += v[i * dim + k] / n;
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) x[i * dim + k] = v[i * dim + k] - mean[k];
  const rnd = seeded(7), comps = [];
  for (let c = 0; c < Math.min(3, n - 1); c++) {
    let w = Float64Array.from({ length: dim }, () => rnd() - 0.5);
    for (let it = 0; it < 40; it++) {
      const next = new Float64Array(dim);
      for (let i = 0; i < n; i++) { let p = 0; for (let k = 0; k < dim; k++) p += x[i * dim + k] * w[k]; for (let k = 0; k < dim; k++) next[k] += p * x[i * dim + k]; }
      for (const u of comps) { let p = 0; for (let k = 0; k < dim; k++) p += next[k] * u[k]; for (let k = 0; k < dim; k++) next[k] -= p * u[k]; }
      const len = Math.hypot(...next) || 1; for (let k = 0; k < dim; k++) next[k] /= len;
      w = next;
    }
    comps.push(w);
    for (let i = 0; i < n; i++) { let p = 0; for (let k = 0; k < dim; k++) p += x[i * dim + k] * w[k]; out[i * 3 + c] = p; }
  }
  return out;
}

// Centres a 3D layout, scales it to suit the number of points, and lifts it
// off the floor. Returns the same array.
export function settle(pos, n) {
  if (!n) return pos;
  const c = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += pos[i * 3 + k] / n;
  let far = 1e-9;
  for (let i = 0; i < n; i++) { let d = 0; for (let k = 0; k < 3; k++) { pos[i * 3 + k] -= c[k]; d += pos[i * 3 + k] ** 2; } far = Math.max(far, Math.sqrt(d)); }
  const R = 2.4 * Math.cbrt(n) + 1.5, s = R / far;
  for (let i = 0; i < n; i++) { pos[i * 3] *= s; pos[i * 3 + 1] = pos[i * 3 + 1] * s + R + 1.2; pos[i * 3 + 2] *= s; }
  return pos;
}
