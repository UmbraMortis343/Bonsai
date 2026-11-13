// DNA double helix: two thick backbones twisting up from a round base, joined by two-coloured base-pair rungs.
export default function build(a) {
  a.cyl(0, 0, 0, 13, 1, "stone2");                       // base
  a.cyl(0, 1, 0, 11, 1, "stone");
  a.cyl(0, 2, 0, 4, 1, "trim");
  const R = 8, y0 = 3, y1 = 43, period = 30;
  const pt = (y, off) => { const t = ((y - y0) / period) * 2 * Math.PI + off; return [Math.cos(t) * R, y, Math.sin(t) * R]; };
  // rungs first so the backbones sit on top
  const pairs = [["roof", "metal"], ["glass", "stone"], ["metal", "roof"], ["stone", "glass"]];
  let k = 0;
  for (let y = y0 + 1; y <= y1 - 1; y += 4, k++) {
    const [ax, , az] = pt(y, 0), [bx, , bz] = pt(y, Math.PI), [ca, cb] = pairs[k % 4];
    a.line(ax, y, az, ax * 0.05, y, az * 0.05, 1.3, ca);
    a.line(bx, y, bz, bx * 0.05, y, bz * 0.05, 1.3, cb);
  }
  for (const [off, m] of [[0, "accent"], [Math.PI, "stone2"]]) {
    for (let y = y0; y < y1; y += 0.5) {
      const p = pt(y, off), q = pt(y + 0.5, off);
      a.line(p[0], p[1], p[2], q[0], q[1], q[2], 1.5, m);
    }
  }
  const [tx, , tz] = pt(y1, 0), [ux, , uz] = pt(y1, Math.PI);
  a.ball(tx, y1, tz, 2, "glow");
  a.ball(ux, y1, uz, 2, "glow");
}
