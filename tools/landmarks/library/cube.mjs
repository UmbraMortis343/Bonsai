// Puzzle cube (logic, problem solving): a giant scrambled puzzle cube on a stepped plinth, black gaps between its
// pieces, its top layer turned a little as if mid-move.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-11, 1, -11, 11, 2, 11, "stone");
  const C = ["stone", "roof", "accent", "metal", "glass", "glow"], P = 6, G = 1, W = 3 * P + 2 * G, o = -Math.floor(W / 2);
  const hash = (i, j, k, f) => (((i * 73 + j * 31 + k * 17 + f * 11) * 2654435761) >>> 0) % 6;
  for (let x = 0; x < W; x++) for (let y = 0; y < W; y++) for (let z = 0; z < W; z++) {
    const cell = (v) => (v % (P + G) < P ? Math.floor(v / (P + G)) : -1), i = cell(x), j = cell(y), k = cell(z);
    const outer = x === 0 || x === W - 1 || y === 0 || y === W - 1 || z === 0 || z === W - 1;
    if (!outer) { a.set(o + x, 3 + y, o + z, "dark"); continue; }
    const gap = i < 0 || j < 0 || k < 0;
    let m = "dark";
    if (!gap) { const f = y === W - 1 ? 0 : x === W - 1 ? 1 : z === W - 1 ? 2 : x === 0 ? 3 : z === 0 ? 4 : 5; m = C[(hash(i, j, k, f) + f) % 6]; }
    let X = o + x, Z = o + z;
    if (y >= W - P) { const ang = 0.18, cx = X + 0.5, cz = Z + 0.5; X = Math.round(cx * Math.cos(ang) - cz * Math.sin(ang) - 0.5); Z = Math.round(cx * Math.sin(ang) + cz * Math.cos(ang) - 0.5); }   // top layer mid-turn
    a.set(X, 3 + y, Z, m);
  }
}
