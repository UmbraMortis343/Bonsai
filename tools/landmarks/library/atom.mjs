// Atom (physics): a nucleus of protons and neutrons with three electron orbits tilted round it, glowing
// electrons on the rings, held up on a column.
export default function build(a) {
  a.cyl(0, 0, 0, 12, 1, "stone2");
  a.cyl(0, 1, 0, 6, 1, "stone");
  a.cyl(0, 2, 0, 3, 10, "stone"); a.cyl(0, 2, 0, 3.6, 1, "trim"); a.cyl(0, 11, 0, 3.6, 1, "trim");
  const cy = 28;
  const nuc = [[0, 0, 0], [2, 1, 0], [-2, 1, 1], [0, -2, 1], [1, 1, -2], [-1, -1, -2], [0, 2, 2], [2, -1, 2], [-2, -1, -1], [1, 3, -1], [-1, 3, 0]];
  nuc.forEach(([x, y, z], i) => a.ball(x * 1.2, cy + y * 1.2, z * 1.2, 2.1, i % 2 ? "accent" : "stone"));
  a.line(0, 12, 0, 0, cy - 4, 0, 1, "trim");                         // stalk up to the nucleus
  // three rings: an ellipse 26 across and 18 deep, turned 0, 120 and 240 degrees about the vertical, stood up steeply
  [0, 2.094, 4.189].forEach((spin, r) => {
    const cs = Math.cos(spin), sn = Math.sin(spin), tilt = 1.2, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let k = 0; k < 120; k++) {
      const t = (k / 120) * Math.PI * 2, ex = Math.cos(t) * 13, ez = Math.sin(t) * 9;
      const y = ez * st, z0 = ez * ct, x = ex * cs - z0 * sn, z = ex * sn + z0 * cs;
      a.ball(x, cy + y, z, 1, "metal");
    }
    const t = 0.7 + r * 2, ex = Math.cos(t) * 13, ez = Math.sin(t) * 9, y = ez * st, z0 = ez * ct;
    a.ball(ex * cs - z0 * sn, cy + y, ex * sn + z0 * cs, 1.9, "glow");
  });
}
