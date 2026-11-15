// Lectern (leadership, teaching, speaking): a speaker's lectern on a stepped dais, an open book on its sloped
// top, and two tall banners in the topic's colour behind it.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-11, 1, -11, 9, 3, 11, "stone");                               // dais, with steps down the front
  a.box(10, 1, -6, 10, 2, 6, "stone"); a.box(11, 1, -6, 11, 1, 6, "stone");
  a.box(-11, 3, -11, 9, 3, 11, "trim");
  a.box(-1, 4, -10, 5, 4, 10, "accent");                               // carpet runner to the front
  // lectern: a narrow body, a wider sloped top facing +x, an emblem on the front
  a.box(0, 4, -3, 3, 14, 3, "wood");
  a.box(4, 6, -1, 4, 10, 1, "accent"); a.set(4, 8, 0, "glow");
  for (let x = -2; x <= 5; x++) { const y = 15 + Math.round((5 - x) * 0.5); a.box(x, 15, -4, x, y, 4, "wood"); a.box(x, y + 1, -3, x, y + 1, 3, x > -1 && x < 5 ? "stone" : "wood"); }
  a.box(1, 18, 0, 3, 18, 0, "dark");                                    // the book's gutter
  // banners on poles behind
  for (const z of [-8, 8]) {
    a.box(-8, 4, z, -8, 35, z, "wood");
    a.ball(-8, 36, z, 1.2, "metal");
    a.box(-8, 33, z - 3, -8, 33, z + 3, "metal");                       // crossbar
    for (let y = 18; y <= 32; y++) for (let dz = -3; dz <= 3; dz++) {
      if (y < 21 && Math.abs(dz) < 21 - y) continue;                    // swallowtail
      a.box(-7, y, z + dz, -7, y, z + dz, y === 32 ? "trim" : "accent");
    }
    a.box(-6, 26, z - 1, -6, 28, z + 1, "glow");
  }
}
