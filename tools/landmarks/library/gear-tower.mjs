// Clockwork tower: square stone tower, big meshing gears on the +x and -x faces, clock faces, spire.
function disc(a, cx, cy, cz, axis, sgn, fn) {
  // draws in the plane of a tower face; u = along face, v = up; depth 2 outward
  for (let u = -12; u <= 12; u++) for (let v = -12; v <= 12; v++) {
    const m = fn(u, v); if (m === undefined) continue;
    for (const d of [0, 1]) axis === "x" ? a.set(cx + d * sgn, cy + v, cz + u, m) : a.set(cx + u, cy + v, cz + d * sgn, m);
  }
}
function gear(a, cx, cy, cz, r, teeth, axis, sgn, m, phase = 0) {
  disc(a, cx, cy, cz, axis, sgn, (u, v) => {
    const d = Math.hypot(u, v), t = ((Math.atan2(v, u) + phase) / (2 * Math.PI) + 1) * teeth * 2;
    if (d <= 1.2) return "glow";
    if (d <= 2.6) return "dark";
    if (d <= r - 2.4 && d > r - 3.6) return "dark";               // inner ring
    if (d <= r) return m;
    if (d <= r + 1.8 && Math.floor(t) % 2 === 0) return m;        // square teeth
  });
}
function clock(a, cx, cy, cz, axis, sgn) {
  disc(a, cx, cy, cz, axis, sgn, (u, v) => {
    const d = Math.hypot(u, v);
    if (d > 4.3) return;
    if (d > 3.4) return "metal";
    if ((u === 0 && v >= 0 && v <= 3) || (v === 0 && u >= 0 && u <= 2)) return "dark";
    return "glow";
  });
}
export default function build(a) {
  a.box(-13, 0, -13, 13, 1, 13, "stone2");                       // paved base
  a.box(-7, 2, -7, 7, 3, 7, "dark");
  a.box(-5, 4, -5, 5, 34, 5, "stone");                           // shaft
  for (const y of [4, 18, 34]) a.box(-6, y, -6, 6, y, 6, "trim");
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) a.box(x, 4, z, x, 34, z, "stone2");
  a.box(-1, 4, 5, 1, 9, 5, "dark"); a.box(-1, 4, -5, 1, 9, -5, "dark");   // doors on z sides
  a.box(-6, 35, -6, 6, 41, 6, "stone2");                         // clock stage
  a.box(-7, 41, -7, 7, 41, 7, "metal");
  for (const [x, z, ax, s] of [[6, 0, "x", 1], [-6, 0, "x", -1], [0, 6, "z", 1], [0, -6, "z", -1]]) clock(a, x, 38, z, ax, s);
  for (let i = 0; i < 5; i++) a.box(-5 + i, 42 + i, -5 + i, 5 - i, 42 + i, 5 - i, "roof");
  a.set(0, 47, 0, "metal");
  // big gear + meshing smaller gear on +x and -x faces
  for (const s of [1, -1]) {
    gear(a, 6 * s, 14, -3 * s, 8, 10, "x", s, "metal");
    gear(a, 6 * s, 26, 7 * s, 5, 7, "x", s, "accent", Math.PI / 7);
  }
  // narrow shaft windows on the z faces, so the back still reads as a tower
  for (const s of [-1, 1]) for (const y of [14, 24]) a.box(-1, y, 5 * s, 1, y + 4, 5 * s, "dark");
}
