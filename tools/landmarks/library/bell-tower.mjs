// Bell tower, after Big Ben (the Elizabeth Tower): a tall slender Gothic tower of pale stone ribbed with vertical
// panels, a wider clock stage with a gold-framed dial on every side, an arcaded belfry with corner pinnacles,
// and a steep slate spire with gold ribs.
export default function build(a) {
  const F = (dir, u, y, d, R, m) => [() => a.set(R + d, y, u, m), () => a.set(-R - d, y, -u, m), () => a.set(-u, y, R + d, m), () => a.set(u, y, -R - d, m)][dir]();

  a.box(-12, 0, -12, 12, 0, 12, "stone2");                           // plinth
  a.box(-9, 1, -9, 9, 1, 9, "stone");
  a.box(-5, 2, -5, 5, 3, 5, "stone2");                               // base course

  const R = 4;                                                       // shaft: x and z -4..4
  a.box(-R, 4, -R, R, 20, R, "stone");
  for (let dir = 0; dir < 4; dir++) {
    for (const u of [-3, -1, 1, 3]) for (let y = 4; y <= 20; y++) F(dir, u, y, 0, R, "stone2");      // vertical panel ribs
    for (const u of [-2, 0, 2]) for (const y0 of [7, 12, 17]) for (let y = y0; y <= y0 + 2; y++) F(dir, u, y, 0, R, "dark");   // lancet windows
    for (const y of [11, 16, 20]) for (let u = -R; u <= R; u++) F(dir, u, y, 0, R, "stone2");        // string courses
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.box(sx * R, 4, sz * R, sx * R, 20, sz * R, "stone2");
  a.box(R, 4, -1, R, 7, 1, "dark");                                   // door

  a.box(-5, 21, -5, 5, 21, 5, "stone2");                             // cornice
  a.box(-5, 22, -5, 5, 31, 5, "stone");                              // clock stage
  for (let dir = 0; dir < 4; dir++) {
    for (let u = -4; u <= 4; u++) for (let y = 22; y <= 30; y++) {
      const r = Math.hypot(u, y - 26);
      F(dir, u, y, 1, 5, r > 4.2 ? "metal" : r > 3.5 ? "dark" : "stone");   // gold corners, black ring, big white dial
    }
    for (const [u, y] of [[0, 27], [0, 28], [0, 29], [1, 26], [2, 26], [3, 26]]) F(dir, u, y, 1, 5, "dark");   // hands
    F(dir, 0, 26, 2, 5, "metal");                                     // the boss in the middle
  }
  a.box(-6, 32, -6, 6, 32, 6, "metal");                              // gilded band
  a.box(-4, 33, -4, 4, 35, 4, "stone");                              // belfry
  for (let dir = 0; dir < 4; dir++) for (const u of [-2, 0, 2]) for (let y = 33; y <= 34; y++) F(dir, u, y, 0, 4, "dark");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { a.box(sx * 5, 33, sz * 5, sx * 5, 36, sz * 5, "stone2"); a.set(sx * 5, 37, sz * 5, "metal"); }   // pinnacles
  const spire = [4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1];                   // tall, slim slate spire, gold on the edges
  spire.forEach((s, i) => { a.box(-s, 36 + i, -s, s, 36 + i, s, "trim"); for (const t of [-s, s]) { a.set(t, 36 + i, t, "metal"); a.set(t, 36 + i, -t, "metal"); a.set(-t, 36 + i, t, "metal"); } });
  for (let dir = 0; dir < 4; dir++) for (const y of [38, 39]) F(dir, 0, y, 0, 3, "dark");   // dormers
  a.box(0, 47, 0, 0, 47, 0, "metal");
}
