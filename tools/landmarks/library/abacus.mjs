// Giant abacus: upright wooden frame facing +x, five rods of chunky beads pushed into groups.
export default function build(a) {
  a.box(-9, 0, -14, 9, 0, 14, "stone2");                 // paved base
  a.box(-8, 1, -13, 8, 1, 13, "stone");
  // frame
  for (const z0 of [-13, 11]) {
    a.box(-2, 2, z0, 2, 33, z0 + 2, "wood");             // posts
    a.box(-7, 2, z0, 7, 3, z0 + 2, "wood");              // feet
    a.box(-3, 34, z0 - 1, 3, 35, z0 + 3, "metal");       // caps
    a.ball(0, 37, z0 + 1, 1.6, "glow");
  }
  a.box(-2, 2, -13, 2, 4, 13, "wood");                   // bottom rail
  a.box(-2, 31, -13, 2, 33, 13, "wood");                 // top rail
  a.box(2, 31, -10, 3, 33, 10, "roof2");                 // top rail facing
  a.box(-3, 31, -10, -2, 33, 10, "roof2");
  const rows = [7, 12, 17, 22, 27];
  const left = [2, 4, 1, 3, 0];                          // beads pushed left; rest pushed right
  const cols = ["accent", "metal", "accent", "roof", "accent"];
  rows.forEach((y, i) => {
    a.box(0, y, -10, 0, y, 10, "trim");                  // rod
    const n = 5, zs = [];
    for (let k = 0; k < left[i]; k++) zs.push(-10 + k * 3);
    for (let k = 0; k < n - left[i]; k++) zs.push(8 - k * 3);
    for (const zc of zs) {
      const c = cols[i];
      a.box(-1, y - 1, zc, 1, y + 1, zc + 2, c);          // bead body
      a.box(-2, y - 1, zc + 1, 2, y + 1, zc + 1, c);       // fat middle
      a.box(-1, y - 2, zc + 1, 1, y + 2, zc + 1, c);
    }
  });
}
