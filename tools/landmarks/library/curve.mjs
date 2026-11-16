// Curve (calculus): a rising curve as a thick ribbon over a sheet of graph paper, the area under it filled with
// Riemann bars, and a tangent rod touching it at a glowing point.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  for (let x = -11; x <= 11; x++) for (let z = -12; z <= 12; z++) a.set(x, 1, z, (x % 4 === 0 || z % 4 === 0) ? "trim" : "stone");   // graph paper
  a.box(-2, 2, -12, 2, 2, 12, "dark"); a.box(-1, 2, -12, 1, 26, -12, "trim");   // axes
  const f = (z) => 3 + ((z + 12) * (z + 12)) / 22;
  for (let z = -10; z <= 8; z += 3) a.box(-1, 3, z, 1, Math.floor(f(z)), z + 1, (z / 3) % 2 ? "stone2" : "accent");   // Riemann bars
  for (let z = -12; z <= 11.5; z += 0.25) a.box(-2, Math.round(f(z)), Math.round(z), 2, Math.round(f(z)) + 1, Math.round(z), "metal");   // the curve
  const z0 = 4, y0 = f(z0), m = (2 * (z0 + 12)) / 22;                 // tangent at z0
  a.line(3, y0 - m * 6, z0 - 6, 3, y0 + m * 6, z0 + 6, 0.9, "roof");
  a.ball(3, y0, z0, 1.6, "glow");
}
