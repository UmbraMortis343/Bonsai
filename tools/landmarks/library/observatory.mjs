// Observatory: round drum in the topic colour, white dome with an open slit, big telescope pointing out toward +x.
export default function build(a) {
  a.cyl(0, 0, 0, 13, 1, "stone2");                       // paved base
  a.cyl(0, 1, 0, 12, 1, "stone");
  a.cyl(0, 2, 0, 9, 10, "accent");                       // drum
  a.cyl(0, 2, 0, 9.4, 1, "stone2");                      // footing ring
  a.cyl(0, 11, 0, 9.6, 1, "trim");                       // cornice
  // door on +x, glowing windows all round
  a.box(9, 2, -1, 9, 6, 1, "dark");
  a.box(10, 2, -2, 10, 7, 2, "stone");
  a.box(10, 2, -1, 10, 6, 1, null);
  a.box(10, 2, -1, 10, 6, 1, "dark");
  for (const ang of [Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]) {
    const x = Math.round(Math.cos(ang) * 9), z = Math.round(Math.sin(ang) * 9);
    a.box(x, 6, z, x, 8, z, "glow");
  }
  // dome: white shell, dark inside
  for (let y = 12; y <= 21; y++) for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) {
    const d = Math.hypot(x, y - 12, z);
    if (d <= 9.2) a.set(x, y, z, d > 7.8 ? "stone" : "dark");
  }
  // dome ribs in trim
  for (let y = 12; y <= 21; y++) for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) {
    const d = Math.hypot(x, y - 12, z);
    if (d > 7.8 && d <= 9.2 && (x === 0 || z === 0 || Math.abs(x) === Math.abs(z)) && a.get(x, y, z)) a.set(x, y, z, "stone2");
  }
  // slit over the top and down the +x side
  for (let y = 13; y <= 22; y++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 10; x++) {
    const d = Math.hypot(x, y - 12, z);
    if (d > 6.5) a.set(x, y, z, null);
  }
  for (let y = 13; y <= 21; y++) for (const z of [-3, 3]) for (let x = -3; x <= 9; x++) {
    const d = Math.hypot(x, y - 12, z);
    if (d > 7.8 && d <= 9.2) a.set(x, y, z, "trim");      // slit edges
  }
  // telescope: pier and a fat tube aimed up and out toward +x
  a.box(-1, 12, -1, 1, 15, 1, "trim");
  a.line(-2, 13, 0, 12, 38, 0, 2.6, "stone2");
  for (const f of [0.45, 0.62, 0.8]) { const x = -2 + 14 * f, y = 13 + 25 * f; a.line(x, y, 0, x + 0.4, y + 0.7, 0, 3.0, f === 0.62 ? "metal" : "accent"); }
  a.line(11.0, 36.4, 0, 11.6, 37.4, 0, 3.0, "accent");
  a.line(12.2, 38.6, 0, 13.2, 40.4, 0, 1.8, "glass");
  a.set(13, 42, 0, "glow");
}
