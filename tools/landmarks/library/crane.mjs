// Crane (engineering, construction): a tower crane, its lattice mast rising beside a half-built wall, a long jib
// with a concrete counterweight, a cab, and a steel beam swinging on the hook.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-5, 1, -5, 5, 2, 5, "stone");                                 // footing
  for (let y = 3; y <= 33; y++) for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) a.set(x, y, z, "metal");   // mast corners
  for (let y = 3; y <= 33; y += 4) for (let k = 0; k <= 4; k++) { a.set(-2 + k, y + k * 0.5 + 1, -2, "metal"); a.set(-2 + k, y + k * 0.5 + 1, 2, "metal"); a.set(-2, y + k * 0.5 + 1, -2 + k, "metal"); a.set(2, y + k * 0.5 + 1, -2 + k, "metal"); }   // bracing
  a.box(-2, 33, -2, 2, 34, 2, "metal");
  a.box(-1, 35, -2, 2, 38, 1, "glass"); a.box(-1, 38, -2, 2, 38, 1, "accent");   // cab
  a.box(-1, 39, -15, 1, 40, 15, "metal");                             // jib
  for (let z = -14; z <= 14; z += 2) a.set(0, 41, z, "metal");
  a.line(0, 46, 0, 0, 41, 14, 0.6, "dark"); a.line(0, 46, 0, 0, 41, -12, 0.6, "dark");   // ties
  a.box(0, 41, 0, 0, 46, 0, "metal");
  a.box(-2, 35, -15, 2, 38, -11, "stone2");                           // counterweight
  a.box(-1, 37, 10, 1, 38, 11, "dark");                               // trolley
  a.line(0, 37, 10.5, 0, 20, 10.5, 0.5, "dark");                      // cable
  a.box(-1, 19, 10, 1, 19, 11, "accent");                             // hook block
  a.box(-5, 17, 9, 5, 18, 12, "dark");                                // steel beam
  for (let y = 3; y <= 12; y++) for (let x = -11; x <= 11; x++) if (y < 12 - Math.abs(x) * 0.4) a.box(x, y, -11, x, y, -10, (x + y) % 3 === 0 ? "roof2" : "roof");   // half-built brick wall
  a.box(6, 1, -11, 10, 5, -7, "wood");                                // pallet of bricks
}
