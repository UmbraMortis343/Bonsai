// Bell tower: square stone campanile on a stepped plinth, clock faces, tall open arched belfry with a big golden bell, steep spire.
export default function build(a) {
  const R = 5;                                  // shaft half-width (x,z in -5..5)
  // place on a face: u = along face, d = outward from face plane (d=0 is the wall surface)
  const F = (dir, u, y, d, m) => {
    if (dir === 0) a.set(u, y, R + d, m);
    else if (dir === 1) a.set(-u, y, -R - d, m);
    else if (dir === 2) a.set(R + d, y, -u, m);
    else a.set(-R - d, y, u, m);
  };

  // plinth steps
  a.box(-8, 0, -8, 8, 0, 8, "stone2");
  a.box(-7, 1, -7, 7, 1, 7, "stone2");

  // shaft
  a.box(-R, 2, -R, R, 20, R, "stone");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.box(sx * R, 2, sz * R, sx * (R - 1), 20, sz * (R - 1), "stone2"); // corner quoins
  a.box(-R - 1, 2, -R - 1, R + 1, 3, R + 1, "stone2");          // base course
  a.box(-R - 1, 11, -R - 1, R + 1, 11, R + 1, "trim");          // string course

  for (let dir = 0; dir < 4; dir++) {
    if (dir !== 0) for (let y = 5; y <= 8; y++) F(dir, 0, y, 0, "dark");   // lancet windows
    // clock face: white disc on the wall, accent rim, dark hands (pointing up and right)
    for (let u = -4; u <= 4; u++) for (let y = 12; y <= 20; y++) {
      const r = Math.hypot(u, y - 16);
      if (r <= 2.6) F(dir, u, y, 1, "stone");
      else if (r <= 3.6) F(dir, u, y, 1, "accent");
    }
    F(dir, 0, 16, 1, "dark"); F(dir, 0, 17, 1, "dark"); F(dir, 0, 18, 1, "dark"); F(dir, 1, 16, 1, "dark"); F(dir, 2, 16, 1, "dark");
  }
  // door facing +z with a step
  a.box(-1, 2, R, 1, 7, R, "dark"); a.set(0, 8, R, "dark");
  a.box(-1, 2, R + 1, 1, 3, R + 1, null);
  a.box(-2, 1, R + 1, 2, 1, R + 2, "stone2");

  // cornice under belfry
  a.box(-R - 1, 21, -R - 1, R + 1, 21, R + 1, "trim");

  // belfry: walls, hollow interior, wide arched openings on every side
  a.box(-R, 22, -R, R, 31, R, "stone");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.box(sx * R, 22, sz * R, sx * (R - 1), 31, sz * (R - 1), "stone2");
  a.box(-R + 1, 23, -R + 1, R - 1, 31, R - 1, null);
  for (let dir = 0; dir < 4; dir++) {
    for (let y = 23; y <= 28; y++) for (let u = -3; u <= 3; u++) F(dir, u, y, 0, null);
    for (let u = -2; u <= 2; u++) F(dir, u, 29, 0, null);
    for (let u = -1; u <= 1; u++) F(dir, u, 30, 0, null);
  }
  a.box(-R + 1, 31, -R + 1, R - 1, 31, R - 1, "stone");        // ceiling
  a.box(-R + 1, 22, -R + 1, R - 1, 22, R - 1, "dark");         // shadowed belfry floor
  // bell hanging from a beam
  a.box(-4, 30, 0, 4, 30, 0, "wood");
  const bell = [[29, 1.2], [28, 1.8], [27, 2.2], [26, 2.4], [25, 2.7], [24, 3.2], [23, 3.6]];
  for (const [y, r] of bell) a.cyl(0, y, 0, r, 1, "metal");
  a.cyl(0, 23, 0, 2.2, 1, null);
  a.set(0, 23, 0, "dark");

  // top cornice
  a.box(-R - 1, 32, -R - 1, R + 1, 32, R + 1, "trim");
  // corner pinnacles
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    a.box(sx * 6, 33, sz * 6, sx * 6, 34, sz * 6, "stone2");
    a.set(sx * 6, 35, sz * 6, "accent");
  }
  // steep spire
  const steps = [5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 0];
  steps.forEach((s, i) => a.box(-s, 33 + i, -s, s, 33 + i, s, i === 0 ? "roof2" : "roof"));
  for (let i = 1; i < steps.length; i++) { const s = steps[i]; if (s > 0) for (const t of [-s, s]) { a.set(t, 33 + i, t, "roof2"); a.set(t, 33 + i, -t, "roof2"); } } // hip ridges
  a.box(0, 45, 0, 0, 47, 0, "metal");
  a.box(1, 47, 0, 2, 47, 0, "accent");
}
