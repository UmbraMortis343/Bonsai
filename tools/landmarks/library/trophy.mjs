// Trophy (sport, competition): a big two-handled cup on a stepped base with a plaque in the topic's colour,
// a star on the lid.
export default function build(a) {
  a.box(-12, 0, -12, 12, 0, 12, "stone2");
  a.box(-8, 1, -8, 8, 4, 8, "wood");                                   // base
  a.box(-9, 1, -9, 9, 1, 9, "dark");
  a.box(-6, 5, -6, 6, 8, 6, "wood"); a.box(-7, 8, -7, 7, 8, 7, "trim");
  a.box(8, 2, -4, 8, 3, 4, "accent"); a.box(6, 6, -3, 6, 7, 3, "accent");   // plaques on the front
  a.cyl(0, 9, 0, 4, 1, "metal"); a.cyl(0, 10, 0, 2.6, 1, "metal");     // foot and stem with a knot
  a.cyl(0, 11, 0, 1.5, 4, "metal"); a.cyl(0, 13, 0, 2.4, 1, "metal");
  for (let y = 15; y <= 30; y++) {                                     // bowl: round below, flaring to the rim
    const f = (y - 15) / 15, r = f < 0.4 ? 3 + Math.sqrt(f / 0.4) * 5 : 8 + (f - 0.4) * 2.2;
    a.cyl(0, y, 0, r, 1, y === 30 ? "trim" : "metal");
    if (y > 15) a.cyl(0, y, 0, r - 1.6, 1, y >= 24 ? "dark" : "metal");
  }
  for (let y = 21; y <= 26; y++) for (let z = -4; z <= 4; z++) if (Math.abs(z) + Math.abs(y - 23.5) < 4) a.set(Math.round(Math.sqrt(Math.max(0, 81 - z * z))) - 0, y, z, "accent");   // band on the front
  for (const s of [-1, 1]) {                                            // handles, looping out from the sides
    for (let k = 0; k <= 24; k++) { const t = (k / 24) * Math.PI, z = s * (9 + Math.sin(t) * 4.5), y = 18 + (1 - Math.cos(t)) * 5.5; a.ball(0, y, z, 0.9, "metal"); }
  }
  for (let y = 31; y <= 32; y++) a.cyl(0, y, 0, 2, 1, "metal");          // lid knob and star
  for (const [dy, dz] of [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, -1], [2, 1], [2, -2], [2, 2], [1, -1], [1, 1], [3, -1], [3, 1]]) a.box(0, 33 + dy, dz, 1, 33 + dy, dz, "glow");
}
