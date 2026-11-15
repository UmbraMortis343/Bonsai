// Bell tower: a slim campanile on a stepped plinth, clock faces on every side, an open belfry
// where four corner piers hold a big golden bell in plain view, and a tall steep spire.
export default function build(a) {
  const R = 4;                                                       // shaft half-width: x and z run -4..4
  // a point on one face: dir 0 +x, 1 -x, 2 +z, 3 -z; u runs along the face, d outward from it
  const F = (dir, u, y, d, m) => [() => a.set(R + d, y, u, m), () => a.set(-R - d, y, -u, m), () => a.set(-u, y, R + d, m), () => a.set(u, y, -R - d, m)][dir]();

  a.box(-11, 0, -11, 11, 0, 11, "stone2");                           // stepped plinth
  a.box(-9, 1, -9, 9, 1, 9, "stone");
  a.box(-6, 2, -6, 6, 2, 6, "stone2");

  a.box(-R, 3, -R, R, 21, R, "stone");                               // shaft
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.box(sx * R, 3, sz * R, sx * (R - 1), 21, sz * (R - 1), "stone2");
  for (const y of [3, 11, 21]) a.box(-R - 1, y, -R - 1, R + 1, y, R + 1, "trim");
  for (let dir = 0; dir < 4; dir++) {
    for (let y = 5; y <= 8; y++) F(dir, 0, y, 0, "dark");             // slit windows
    for (let u = -3; u <= 3; u++) for (let y = 12; y <= 20; y++) {    // clock face standing out from the wall
      const r = Math.hypot(u, y - 16);
      if (r <= 3.6) F(dir, u, y, 1, r <= 2.7 ? "stone" : "accent");
    }
    for (const [u, y] of [[0, 16], [0, 17], [0, 18], [1, 16], [2, 16]]) F(dir, u, y, 1, "dark");
  }
  a.box(R, 4, -1, R, 8, 1, "dark"); F(0, 0, 9, 0, "dark");           // door on the front
  a.box(R + 1, 3, -2, R + 3, 3, 2, "stone2");                         // step up to it

  // belfry, wider than the shaft: a floor, four corner piers, round arches over wide open sides, a heavy cornice
  const B = 5;
  a.box(-B - 1, 22, -B - 1, B + 1, 22, B + 1, "stone2");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.box(sx * B, 23, sz * B, sx * (B - 1), 32, sz * (B - 1), "stone");
  for (let dir = 0; dir < 4; dir++) for (let u = -3; u <= 3; u++) {
    const top = 32 - [2, 2, 1, 0][Math.abs(u)];
    for (let y = top; y <= 32; y++) [() => a.set(B, y, u, "stone"), () => a.set(-B, y, u, "stone"), () => a.set(u, y, B, "stone"), () => a.set(u, y, -B, "stone")][dir]();
  }
  a.box(-B - 1, 33, -B - 1, B + 1, 33, B + 1, "trim");
  // the bell: flared mouth, waisted body, crown, hung from a beam, with a clapper below
  a.box(-B + 1, 32, 0, B - 1, 32, 0, "wood");
  const bell = [[31, 1.6], [30, 2.6], [29, 2.8], [28, 3.0], [27, 3.2], [26, 3.6], [25, 4.1], [24, 4.3]];
  for (const [y, r] of bell) a.cyl(0, y, 0, r, 1, "metal");
  a.cyl(0, 24, 0, 3.3, 2, null);                                    // hollow mouth
  a.box(0, 23, 0, 0, 25, 0, "dark");                                 // clapper

  // steep spire with corner pinnacles
  const spire = [5, 5, 4, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1];
  spire.forEach((s, i) => a.box(-s, 34 + i, -s, s, 34 + i, s, "roof"));
  spire.forEach((s, i) => { for (const t of [-s, s]) { a.set(t, 34 + i, t, "roof2"); a.set(t, 34 + i, -t, "roof2"); a.set(-t, 34 + i, t, "roof2"); } });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { a.box(sx * 6, 34, sz * 6, sx * 6, 35, sz * 6, "stone2"); a.set(sx * 6, 36, sz * 6, "accent"); }
  a.set(0, 47, 0, "metal");
}
