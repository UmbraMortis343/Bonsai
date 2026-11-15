// Flask (chemistry): a big conical flask on a tiled bench, coloured liquid in the bottom, glowing bubbles
// rising from the neck, and a small round flask on a ring stand beside it.
export default function build(a) {
  a.box(-12, 0, -12, 12, 1, 12, "stone2");                            // bench
  for (let x = -12; x <= 12; x += 3) for (let z = -12; z <= 12; z += 3) a.set(x, 1, z, "trim");
  const base = 2, top = 22;
  for (let y = base; y < top; y++) {                                  // cone, flat bottom
    const f = (y - base) / (top - base), r = 9.5 - f * 6.8;
    a.cyl(0, y, 0, r, 1, y < 11 ? "accent" : y === 11 ? "trim" : "glass");
  }
  a.cyl(0, top, 0, 2.6, 8, "glass");                                  // neck
  a.cyl(0, top + 8, 0, 3.3, 2, "stone");                              // lip
  a.cyl(0, top + 8, 0, 1.5, 2, "dark");
  for (const [y, n] of [[5, 3], [8, 2], [14, 2], [17, 1]]) for (let i = 0; i < n; i++) a.set(Math.round(9.5 - ((y - base) / 20) * 6.8) + 1, y, i - 1, "dark");   // marks
  for (const [x, y, z, r] of [[0, 34, 0, 1.6], [1, 38, 1, 1.3], [-1, 42, 0, 1.6], [1, 45, -1, 1]]) a.ball(x, y, z, r, "glow");   // bubbles
  // ring stand with a small round flask, off to the back corner
  a.box(-9, 2, -9, -5, 2, -5, "dark"); a.box(-9, 3, -9, -9, 18, -9, "metal");
  a.line(-9, 13, -9, -6, 13, -6, 0.8, "metal");
  a.ball(-6, 12, -6, 3.2, "accent"); a.ball(-6, 14, -6, 2.6, "glass"); a.cyl(-6, 15, -6, 1.2, 5, "glass");
}
