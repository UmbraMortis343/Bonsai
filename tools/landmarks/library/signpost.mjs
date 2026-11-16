// Signpost (coaching, guidance): a tall wooden fingerpost on a grassy mound of stone, arms pointing every way,
// a lantern hung at the top.
function arm(a, y, ang, len, m) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let r = 1; r <= len; r += 0.5) { const w = r > len - 2.5 ? (len - r) * 0.8 : 2; for (let h = -w; h <= w; h += 0.5) a.box(Math.round(c * r), Math.round(y + h), Math.round(s * r), Math.round(c * r), Math.round(y + h), Math.round(s * r), m); }
  a.box(Math.round(c * 2), y, Math.round(s * 2), Math.round(c * (len - 3)), y, Math.round(s * (len - 3)), "dark");   // the writing
}
export default function build(a) {
  a.cyl(0, 0, 0, 12.5, 1, "stone2");
  a.ellipsoid(0, 0, 0, 8, 3, 8, "stone");
  a.box(-1, 2, -1, 1, 36, 1, "wood");
  arm(a, 31, 0.2, 14, "accent");
  arm(a, 27, 2.3, 13, "stone");
  arm(a, 23, -1.6, 13, "roof");
  arm(a, 19, 3.9, 12, "accent");
  arm(a, 15, 1.2, 11, "stone");
  a.box(-1, 37, -1, 1, 37, 1, "metal");
  a.box(0, 38, 0, 0, 39, 0, "metal"); a.box(-1, 40, -1, 1, 43, 1, "metal"); a.box(0, 41, -1, 0, 42, 1, "glow"); a.box(-1, 41, 0, 1, 42, 0, "glow"); a.box(0, 44, 0, 0, 44, 0, "metal");   // lantern
}
