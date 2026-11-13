// Ruined classical temple: intact pediment front toward +x, broken colonnade at the back.
export default function build(a) {
  a.box(-13, 0, -12, 13, 1, 12, "stone2");                 // paved base
  a.box(-12, 2, -9, 12, 2, 9, "stone");                    // stylobate steps
  a.box(-11, 3, -8, 11, 3, 8, "stone");
  // cella wall (low, ruined toward the back)
  a.box(-6, 4, -4, 6, 10, 4, "stone2");
  a.box(-5, 4, -3, 5, 10, 3, null);
  a.box(6, 4, -1, 6, 8, 1, "dark");                         // door facing +x
  a.box(-6, 8, -4, -1, 10, 4, null); a.box(-6, 4, -4, -6, 7, 4, "stone2");
  a.cyl(0, 4, 0, 1, 2, "trim"); a.set(0, 6, 0, "glow"); a.set(0, 7, 0, "glow");  // altar flame
  // columns: [x, z, height]  full height = 14 (y 4..17)
  const cols = [];
  for (const x of [-10, -6, -2, 2, 6, 10]) for (const z of [-7, 7]) cols.push([x, z]);
  for (const z of [-3.5, 0, 3.5]) { cols.push([10, z]); cols.push([-10, z]); }
  const broken = { "2,7": 7, "6,-7": 11, "-2,7": 12, "-10,-7": 5, "-6,7": 8, "-10,0": 3, "-10,3.5": 9, "-2,-7": 10, "-6,-7": 14, "-10,7": 6, "-10,-3.5": 0 };
  for (const [x, z] of cols) {
    let h = broken[`${x},${z}`]; if (h === undefined) h = 14;
    if (h === 0) continue;
    a.cyl(x, 4, z, 1.2, h, "stone");
    a.box(x - 1, 4, z - 1, x + 1, 4, z + 1, "stone2");      // base
    if (h === 14) a.box(x - 1, 17, z - 1, x + 1, 17, z + 1, "stone2");  // capital
    else a.set(x + 1, 4 + h, z, null);                       // jagged break
  }
  // entablature + roof only over the front part (x >= -3)
  a.box(-3, 18, -8, 11, 19, 8, "stone2");
  a.box(-3, 20, -8, 11, 20, 8, "accent");                   // frieze band carries topic colour
  for (let i = 0; i <= 7; i++) {                             // gable roof, ridge along x
    a.box(-3, 21 + i, -8 + i, 11, 21 + i, 8 - i, "roof");
    a.box(11, 21 + i, -8 + i, 11, 21 + i, 8 - i, "stone");   // pediment at +x
    a.box(-3, 21 + i, -8 + i, -3, 21 + i, 8 - i, "stone2");  // broken end at back
  }
  a.box(11, 22, -3, 11, 24, 3, "accent");                    // pediment relief
  // jagged broken back edge of roof and a collapsed corner
  for (let z = -8; z <= 8; z++) { const d = 2 + ((z * 7 + 3) % 4 + 4) % 4; a.box(-3, 18, z, -3 + d, 28, z, null); }
  a.box(9, 24, -8, 11, 28, -2, null); a.box(7, 26, -8, 11, 28, -1, null);
  a.box(10, 18, 6, 11, 22, 8, null);
  // fallen entablature block and column drums on the ground at the back
  a.box(-9, 2, 9, -3, 3, 11, "stone2");
  a.line(-14, 3, -4, -14, 3, 4, 1.2, "stone"); a.box(-15, 2, -10, -12, 3, -8, "stone2");
}
