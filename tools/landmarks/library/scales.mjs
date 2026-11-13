// Balance scales: central pillar, long beam along z, two hanging pans, tilted slightly.
export default function build(a) {
  a.cyl(0, 0, 0, 12.5, 1, "stone2");                         // round base
  a.cyl(0, 1, 0, 11, 1, "stone");
  a.cyl(0, 2, 0, 6, 2, "dark");                               // pedestal
  a.cyl(0, 4, 0, 4.5, 2, "metal");
  a.cyl(0, 6, 0, 1.6, 26, "metal");                           // column
  for (const y of [12, 20, 27]) a.cyl(0, y, 0, 2.4, 1, "accent");
  a.ball(0, 33, 0, 2.6, "metal");                             // pivot hub
  a.set(0, 33, 3, "glow"); a.set(0, 33, -3, "glow"); a.set(3, 33, 0, "glow"); a.set(-3, 33, 0, "glow");
  a.cyl(0, 36, 0, 1, 3, "metal"); a.ball(0, 40, 0, 1.6, "glow"); // finial
  // beam along z, slightly tilted: +z side lower
  const L = 13, tilt = 1.5;
    a.line(0, 33, 0, 0, 33 - tilt, L, 1.3, "metal");
  a.line(0, 33, 0, 0, 33 + tilt, -L, 1.3, "metal");
  for (const [z, top, pan] of [[L, 33 - tilt, 13], [-L, 33 + tilt, 17]]) {
    a.ball(0, top, z, 1.4, "accent");
    // three chains to pan
    for (const [dx, dz] of [[4.5, 0], [-2.5, 3.8], [-2.5, -3.8]]) a.line(0, top - 1, z, dx, pan + 1, z + dz * (z > 0 ? 1 : 1), 0.5, "trim");
    for (let i = 0; i < 3; i++) a.cyl(0, pan - i, z, 6 - i * 1.6, 1, "metal");   // bowl
    a.cyl(0, pan + 1, z, 6, 1, "metal"); a.cyl(0, pan + 1, z, 5, 1, null);
  }
  a.ball(0, 15, 13, 1.8, "accent");                           // weight in the lower pan
}
