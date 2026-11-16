// Dice (probability, statistics): two big dice, one in the topic's colour lying flat and a white one balanced
// on top at an angle, pips on every face.
const PIPS = { 1: [[5, 5]], 2: [[2.5, 2.5], [7.5, 7.5]], 3: [[2.5, 2.5], [5, 5], [7.5, 7.5]], 4: [[2.5, 2.5], [7.5, 7.5], [2.5, 7.5], [7.5, 2.5]], 5: [[2.5, 2.5], [7.5, 7.5], [2.5, 7.5], [7.5, 2.5], [5, 5]], 6: [[2.5, 2.5], [7.5, 7.5], [2.5, 7.5], [7.5, 2.5], [2.5, 5], [7.5, 5]] };
const pip = (n, p, q) => PIPS[n].some(([a, b]) => Math.abs(p - a) <= 1 && Math.abs(q - b) <= 1);
// a die of side S with its corner at (x0, y0, z0); faces as on a real die (opposite faces add up to 7)
function die(a, x0, y0, z0, S, body, dot) {
  const k = 10 / (S - 1);
  for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) {
    const ex = x === 0 || x === S - 1, ey = y === 0 || y === S - 1, ez = z === 0 || z === S - 1;
    if (!ex && !ey && !ez) continue;
    if (ex + ey + ez >= 2) { if (ex && ez) continue; }               // rounded upright edges
    let m = body;
    if (y === S - 1 && pip(5, x * k, z * k)) m = dot; else if (x === S - 1 && pip(3, z * k, y * k)) m = dot; else if (x === 0 && pip(4, z * k, y * k)) m = dot;
    else if (z === S - 1 && pip(1, x * k, y * k)) m = dot; else if (z === 0 && pip(6, x * k, y * k)) m = dot;
    a.set(x0 + x, y0 + y, z0 + z, m);
  }
}
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-12, 1, -12, 12, 1, 12, "stone");
  die(a, -11, 2, -11, 13, "accent", "stone");
  die(a, -8, 15, -8, 9, "stone", "dark");
  die(a, 2, 2, 2, 9, "stone", "dark");
}
