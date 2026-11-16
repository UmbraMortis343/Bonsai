// Wind turbine (energy): a tall white tower, a nacelle with a band of the topic's colour, three long blades, and
// a row of solar panels at its foot.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.cyl(0, 1, 0, 4, 2, "stone2");
  for (let y = 3; y <= 33; y++) a.cyl(0, y, 0, 2.6 - (y - 3) * 0.035, 1, y === 12 || y === 24 ? "trim" : "stone");
  a.box(-4, 33, -2, 3, 36, 2, "stone"); a.box(-4, 34, -2, 3, 34, 2, "accent");   // nacelle
  a.ball(5, 34.5, 0, 2, "trim");                                      // hub, facing +x
  for (const ang of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 + 4.189]) {
    const cz = Math.cos(ang), cy = Math.sin(ang), nz = -cy, ny = cz;   // along the blade, and across it
    for (let r = 1.5; r <= 13; r += 0.4) { const w = r < 4 ? 2.4 : Math.max(0.6, 2.4 - (r - 4) * 0.2);
      for (let q = -w * 0.3; q <= w; q += 0.4) { const y = Math.round(34.5 + cy * r + ny * q), z = Math.round(cz * r + nz * q); a.box(5, y, z, 6, y, z, r > 11.5 ? "accent" : "stone"); } }
  }
  a.box(2, 3, -1, 2, 6, 1, "dark");                                   // door
  a.box(6, 1, -11, 10, 5, -6, "trim"); a.box(6, 6, -11, 10, 6, -6, "accent");   // substation
}
