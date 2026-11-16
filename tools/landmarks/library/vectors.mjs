// Vectors (linear algebra): a cube frame on a plinth with three arrows, the basis vectors, bursting out of it from
// a glowing origin, and a sheared copy of the cube inside to show a transformation.
function arrow(a, x0, y0, z0, dx, dy, dz, len, m) {
  a.line(x0, y0, z0, x0 + dx * (len - 4), y0 + dy * (len - 4), z0 + dz * (len - 4), 1, m);
  for (let k = 0; k < 4; k++) { const r = 2.6 - k * 0.6, cx = x0 + dx * (len - 4 + k), cy = y0 + dy * (len - 4 + k), cz = z0 + dz * (len - 4 + k);
    for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) if (u * u + v * v <= r * r) { if (dx) a.set(cx, cy + u, cz + v, m); else if (dy) a.set(cx + u, cy, cz + v, m); else a.set(cx + u, cy + v, cz, m); } }
}
export default function build(a) {
  a.box(-12, 0, -12, 12, 1, 12, "stone2");
  a.box(-8, 2, -8, 8, 2, 8, "stone");
  const edges = (x0, y0, z0, s, m, shear = 0) => {
    const P = (i, j, k) => [x0 + i * s + j * shear, y0 + j * s, z0 + k * s];
    for (const [p, q] of [[[0, 0, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 0, 1]], [[1, 1, 1], [0, 1, 1]], [[1, 1, 1], [1, 0, 1]], [[1, 1, 1], [1, 1, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 0, 0], [1, 0, 1]], [[0, 1, 0], [1, 1, 0]], [[0, 1, 0], [0, 1, 1]], [[0, 0, 1], [1, 0, 1]], [[0, 0, 1], [0, 1, 1]]])
      a.line(...P(...p), ...P(...q), 0.9, m);
  };
  edges(-7, 3, -7, 14, "metal");
  edges(-4, 6, -4, 8, "accent", 0.4);
  a.ball(0, 10, 0, 1.8, "glow");
  arrow(a, 0, 10, 0, 1, 0, 0, 15, "roof");
  arrow(a, 0, 10, 0, 0, 1, 0, 26, "glass");
  arrow(a, 0, 10, 0, 0, 0, 1, 15, "trim");
}
