// Writing: a giant quill pen standing in an inkwell, with a written sheet in front.
export default function build(a) {
  // plinth
  a.box(-13, 0, -13, 12, 1, 12, "stone2");
  a.box(-12, 1, -12, 11, 1, 11, "stone");
  for (const [x, z] of [[-12, -12], [-12, 11], [11, -12], [11, 11]]) a.set(x, 1, z, "glow");

  // inkwell (topic colour), centred slightly back so the sheet fits in front
  const ix = -2, iz = 1;
  a.cyl(ix, 2, iz, 6.5, 1, "dark");               // foot
  a.cyl(ix, 3, iz, 6.5, 6, "accent");             // body
  a.cyl(ix, 5, iz, 6.6, 1, "metal");              // band
  a.cyl(ix, 9, iz, 5.5, 1, "accent");             // shoulder
  a.cyl(ix, 10, iz, 4.2, 1, "accent");
  a.cyl(ix, 11, iz, 3.6, 2, "metal");             // neck rim
  a.cyl(ix, 12, iz, 2.6, 1, "dark");              // ink surface
  a.set(ix, 12, iz, null);

  // quill: shaft from inside the ink, leaning back toward -z and slightly -x, with a gentle curve
  const P0 = [ix, 9, iz], P1 = [ix - 2, 46, iz - 11];
  const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]);
  const d = [(P1[0] - P0[0]) / L, (P1[1] - P0[1]) / L, (P1[2] - P0[2]) / L];
  const n = [0, -d[2], d[1]]; const nl = Math.hypot(...n); n[1] /= nl; n[2] /= nl;   // in-plane, across the feather
  const at = (t) => { const bend = 2.2 * Math.sin(Math.PI * t); return [P0[0] + d[0] * L * t + n[0] * bend, P0[1] + d[1] * L * t + n[1] * bend, P0[2] + d[2] * L * t + n[2] * bend]; };
  // nib (metal) just above the ink, then bare quill
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = at(t);
    a.ball(p[0], p[1], p[2], 1.1, t < 0.12 ? "metal" : "trim");
  }
  // vanes: asymmetric feather shape from t=0.22 to the tip
  const v0 = 0.22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; if (t < v0) continue;
    const s = (t - v0) / (1 - v0);                       // 0 at vane start, 1 at tip
    const shape = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.7)), 0.8);
    const wA = 7.5 * shape, wB = 4.5 * shape;            // wide side toward +n, narrow side toward -n
    const p = at(t);
    for (let w = -wB; w <= wA; w += 0.5) {
      if (Math.abs(w) < 1.3) continue;
      // a few notches on the edges so it reads as a feather
      const notch = (Math.floor(s * 14) % 4 === 0) && Math.abs(w) > (w > 0 ? wA : wB) - 2;
      if (notch) continue;
      const x = p[0], y = p[1] + n[1] * w, z = p[2] + n[2] * w;
      const tipBand = s > 0.78;
      const m = tipBand ? "accent" : "stone";
      for (let dx = -0.6; dx <= 0.6; dx += 0.6) a.set(x + dx, y, z, m);
    }
  }

  // written sheet lying on the plinth in front (+x)
  a.box(6, 2, -8, 11, 2, 7, "stone");
  a.cyl(0, 0, 0, 0, 0, "stone");
  for (let x = 6; x <= 11; x++) { a.set(x, 3, -9, "stone"); a.set(x, 3, 8, "stone"); a.set(x, 2, -9, "stone2"); a.set(x, 2, 8, "stone2"); }
  for (let z = -6; z <= 5; z += 2) for (let x = 7; x <= 10; x++) if (!(z === 5 && x > 8)) a.set(x, 2, z, "dark");
}
