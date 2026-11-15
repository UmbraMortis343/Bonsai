// Gear tower (engineering): a stone column threaded with flat cogs that shrink toward the top and turn
// against each other, with a glowing cap. Flat cogs show their teeth from every side.
function cog(a, cx, y, cz, R, teeth, m, holes = true, phase = 0) {
  for (let x = Math.floor(cx - R - 3); x <= cx + R + 3; x++) for (let z = Math.floor(cz - R - 3); z <= cz + R + 3; z++) {
    const u = x - cx, v = z - cz, d = Math.hypot(u, v), ang = Math.atan2(v, u) + phase;
    let on = d <= R || (d <= R + 2 && Math.floor((ang / (2 * Math.PI) + 1) * teeth * 2) % 2 === 0);
    if (holes && d > 4 && d < R - 2.2) {                              // window between six spokes
      let spoke = false; for (let k = 0; k < 6; k++) { const s = k * Math.PI / 3 + phase; if (u * Math.cos(s) + v * Math.sin(s) > 0 && Math.abs(-u * Math.sin(s) + v * Math.cos(s)) < 1.3) spoke = true; }
      if (!spoke) on = false;
    }
    if (on) a.box(x, y, z, x, y + 1, z, m);
  }
}
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");                           // paved base
  a.cyl(0, 1, 0, 12.5, 1, "stone");
  a.cyl(0, 2, 0, 5, 2, "stone2");
  a.cyl(0, 2, 0, 3, 31, "stone");                                    // column
  for (const y of [4, 10, 18, 26, 32]) a.cyl(0, y, 0, 3.6, 1, "trim");
  cog(a, 0, 6, 0, 10.5, 14, "metal");
  cog(a, 0, 14, 0, 7.8, 11, "accent", false, 0.2);
  cog(a, 0, 22, 0, 5.6, 9, "metal", false);
  cog(a, 0, 29, 0, 3.8, 7, "accent", false, 0.3);
  a.ball(0, 33, 0, 2.2, "glow");                                     // cap
  a.box(0, 35, 0, 0, 37, 0, "metal");
}
