// Example landmark: a lighthouse. Banded tower that narrows, a gallery, a glowing lamp room, a pointed cap.
export default function build(a) {
  a.cyl(0, 0, 0, 5, 2, "stone2");                                   // footing
  const h = 22;
  for (let y = 0; y < h; y++) a.cyl(0, 2 + y, 0, 4 - (y / h) * 1.6, 1, Math.floor(y / 4) % 2 ? "accent" : "stone");
  a.box(0, 2, 4, 0, 5, 4, "dark");                                  // door, facing +z
  a.cyl(0, 24, 0, 4.4, 1, "stone2");                                // gallery
  a.cyl(0, 25, 0, 2.2, 3, "glow");                                  // lamp
  for (const [x, z] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) a.box(x, 25, z, x, 27, z, "trim");
  for (let y = 0; y < 4; y++) a.cyl(0, 28 + y, 0, 3 - y * 0.8, 1, "roof");
  a.set(0, 32, 0, "metal");
}
