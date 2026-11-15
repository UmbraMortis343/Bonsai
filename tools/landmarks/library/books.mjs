// Books (literature, languages): a stack of big closed books turned at different angles, an open book on top
// with a ribbon, on a low stone dais.
function book(a, cx, y0, cz, w, d, h, ang, cover) {   // w along its spine (x before turning), d across, h thick
  const c = Math.cos(ang), s = Math.sin(ang), K = Math.ceil(Math.hypot(w, d) / 2) + 1;
  for (let dz = -K; dz <= K; dz++) for (let dx = -K; dx <= K; dx++) {
    const u = dx * c + dz * s, v = -dx * s + dz * c;                  // into the book's own frame
    if (Math.abs(u) > w / 2 || Math.abs(v) > d / 2) continue;
    const spine = v < -d / 2 + 1.5, edge = Math.abs(u) > w / 2 - 1 || v > d / 2 - 1;
    for (let i = 0; i < h; i++) {
      const page = i > 0 && i < h - 1 && !spine;
      a.set(cx + dx, y0 + i, cz + dz, page ? (edge ? "stone" : "stone") : spine && i > 0 && i < h - 1 && Math.abs(u) % 6 < 1 ? "metal" : cover);
    }
  }
}
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-12, 1, -12, 12, 1, 12, "stone");
  book(a, 0, 2, 0, 22, 16, 5, 0.1, "roof2");
  book(a, -1, 7, 1, 20, 14, 5, -0.25, "accent");
  book(a, 1, 12, 0, 18, 13, 4, 0.35, "wood");
  book(a, 0, 16, 0, 16, 12, 4, 0, "roof");
  // open book on top: two pages rising from the gutter, covers under them, a ribbon hanging out
  for (let z = -6; z <= 6; z++) for (let x = -8; x <= 8; x++) {
    const lift = Math.round(Math.abs(z) * 0.35);
    a.set(x, 20 + lift, z, Math.abs(x) === 8 || Math.abs(z) === 6 ? "accent" : "accent");
    if (Math.abs(x) < 8 && Math.abs(z) < 6 && z !== 0) a.box(x, 21 + lift, z, x, 21 + lift + (Math.abs(z) < 2 ? 1 : 0), z, "stone");
  }
  for (let x = -6; x <= 5; x += 2) for (const z of [-4, -2, 2, 4]) if ((x + z) % 4) a.set(x, 22 + Math.round(Math.abs(z) * 0.35), z, "trim");   // lines of text
  a.box(0, 21, 0, 0, 23, 0, "dark");
  a.line(1, 22, 0, 9, 14, 2, 0.8, "roof2");                           // ribbon
}
