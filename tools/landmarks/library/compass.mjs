// Compass (geometry, shapes and space): a giant drafting compass standing on a sheet of paper, one point in the
// middle of the circle it has drawn, a set square standing beside it.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-11, 1, -11, 11, 1, 11, "stone");                            // the paper
  for (let k = 0; k < 120; k++) { const t = (k / 120) * Math.PI * 2; a.set(Math.round(Math.cos(t) * 9), 1, Math.round(-6 + Math.sin(t) * 9) + 0, "dark"); }   // the circle
  for (let z = -10; z <= 7; z++) a.set(0, 1, z, (z % 2 === 0) ? "trim" : "stone");   // a ruled line
  const top = [0, 28, 0];                                            // hinge
  a.line(0, 2, -6, ...top, 1.2, "metal");                             // the point leg, in the circle's middle
  a.line(0, 6, 8, ...top, 1.2, "metal");                              // the pencil leg, out to the circle's edge
  a.line(0, 2, 9, 0, 6, 8, 1, "wood"); a.set(0, 2, 9, "dark");          // pencil
  a.line(0, 15, -3, 0, 15, 4, 0.8, "trim");                            // the screw between the legs
  a.ball(...top, 2.4, "metal"); a.box(0, 30, 0, 0, 35, 0, "accent"); a.ball(0, 36, 0, 1.5, "accent");   // hinge and handle
  // set square standing on its edge at the front, a right triangle with a hole in it
  for (let z = -2; z <= 10; z++) for (let y = 2; y <= 14; y++) {
    const inside = y - 2 <= (10 - z), hole = y - 2 >= 3 && z >= 1 && y - 2 <= (10 - z) - 5;
    if (inside && !hole) a.box(-8, y, z, -7, y, z, "accent");
  }
}
