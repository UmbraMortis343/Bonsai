// Nautilus (patterns, sequences): a nautilus shell standing on its edge, its spiral growing by the same ratio at
// every turn, striped, on a bed of sand.
export default function build(a) {
  a.cyl(0, 0, 0, 10, 1, "stone2");
  a.cyl(0, 1, 0, 7, 1, "stone");
  const cy = 17, cz = 0, A = 1.2, B = 0.19, T = 3.5 * Math.PI;
  for (let t = 0; t <= T; t += 0.05) {
    const rc = A * Math.exp(B * t), tr = Math.max(0.9, rc * 0.45), y = cy + Math.sin(t) * rc, z = cz + Math.cos(t) * rc;
    a.ellipsoid(0, y, z, Math.max(1.2, tr * 0.95), tr, tr, Math.floor(t * 1.3) % 2 ? "accent" : "stone");
  }
  const t = T, rc = A * Math.exp(B * t), tr = rc * 0.45;  // the opening, dark inside
  a.ellipsoid(0, cy + Math.sin(t) * rc, cz + Math.cos(t) * rc, tr * 0.55, tr * 0.7, tr * 0.7, "dark");
  a.ball(0, cy, cz, 1, "glow");                                       // the first chamber
}
