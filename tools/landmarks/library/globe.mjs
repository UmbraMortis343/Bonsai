// Globe (geography): a tilted globe with blue seas and continents in the topic's colour, held in a brass
// meridian ring on a turned wooden stand.
export default function build(a) {
  a.cyl(0, 0, 0, 12, 1, "stone2");                                   // round paved base
  a.cyl(0, 1, 0, 10, 1, "stone");
  a.cyl(0, 2, 0, 5.5, 1, "wood"); a.cyl(0, 3, 0, 4.5, 1, "wood");    // turned stand
  a.cyl(0, 4, 0, 2, 5, "wood"); a.cyl(0, 9, 0, 3, 1, "trim");
  const cy = 20, R = 9, tilt = 0.4, ct = Math.cos(tilt), st = Math.sin(tilt);
  // continents: caps on the sphere, given as [longitude, latitude, size] in the globe's own frame
  const land = [[0.3, 0.5, 0.55], [0.9, 0.15, 0.4], [-0.6, 0.65, 0.5], [-1.4, -0.35, 0.42], [2.2, 0.35, 0.6], [2.9, -0.45, 0.33], [1.4, -0.75, 0.3], [-2.4, 0.1, 0.35]];
  const dirs = land.map(([lo, la, r]) => [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo), Math.cos(r)]);
  for (let y = cy - R; y <= cy + R; y++) for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x, y - cy, z); if (d > R + 0.3) continue;
    const X = x / d, Y = (y - cy) / d, Z = z / d, gx = X * ct + Y * st, gy = -X * st + Y * ct;   // into the tilted frame
    const isLand = dirs.some(([lx, ly, lz, c]) => gx * lx + gy * ly + Z * lz > c);
    a.set(x, y, z, Math.abs(gy) > 0.93 ? "stone" : isLand ? "accent" : "glass");
  }
  // meridian ring around it, facing the sides, tilted with the axis, with pivots at the poles
  for (let k = 0; k < 360; k += 2) {
    const t = (k * Math.PI) / 180, rx = Math.cos(t) * 11, ry = Math.sin(t) * 11;
    const x = rx * ct - ry * st, y = rx * st + ry * ct;
    if (y < -10.5) continue;                                            // the ring opens at the stand
    a.box(x, cy + y, -1, x, cy + y, 0, "metal");
  }
  for (const s of [-1, 1]) a.ball(-st * 10 * s, cy + ct * 10 * s, 0, 1.2, "metal");
  a.line(0, 10, 0, -st * -10, cy - ct * 10, 0, 1, "metal");           // arm from the stand to the lower pivot
}
