// Light bulb (design, ideas, invention): a giant light bulb on its screw cap, a glowing filament drawn on the
// glass, and rays of light around it.
export default function build(a) {
  a.box(-12, 0, -12, 12, 0, 12, "stone2");
  a.cyl(0, 1, 0, 6, 2, "stone");
  for (let y = 3; y <= 10; y++) a.cyl(0, y, 0, y % 2 ? 4 : 3.6, 1, y % 2 ? "metal" : "trim");   // screw threads
  a.cyl(0, 3, 0, 2, 1, "dark");
  for (let y = 11; y <= 14; y++) a.cyl(0, y, 0, 4.4 + (y - 11) * 0.9, 1, "glass");   // neck
  a.ball(0, 23, 0, 9.5, "glass");
  for (const s of [-1, 1]) {                                          // filament on both faces of the glass
    const pts = [[-3, 15], [-3, 21], [-1.5, 24], [0, 21], [1.5, 24], [3, 21], [3, 15]];
    for (let i = 0; i + 1 < pts.length; i++) { const [z0, y0] = pts[i], [z1, y1] = pts[i + 1], x0 = s * Math.sqrt(Math.max(0, 9.5 ** 2 - z0 ** 2 - (y0 - 23) ** 2)), x1 = s * Math.sqrt(Math.max(0, 9.5 ** 2 - z1 ** 2 - (y1 - 23) ** 2)); a.line(x0, y0, z0, x1, y1, z1, 0.8, "glow"); }
  }
  for (const ang of [0.3, 1.0, 1.6, 2.2, 2.85]) { const c = Math.cos(ang), s = Math.sin(ang); a.line(0, 23 + s * 11.5, c * 11.5, 0, 23 + s * 14.5, c * 14.5, 0.8, "accent"); }   // rays
}
