// Camera (photography): an old box camera on a tripod, its big lens facing out with glass in front, a flash
// on top and a strap hanging from one side.
export default function build(a) {
  a.cyl(0, 0, 0, 12.5, 1, "stone2");
  // tripod: three legs from under the body to the ground, and the centre column
  for (const ang of [Math.PI, Math.PI / 3, -Math.PI / 3]) a.line(0, 18, 0, Math.cos(ang) * 10, 1, Math.sin(ang) * 10, 0.9, "wood");
  for (const ang of [Math.PI, Math.PI / 3, -Math.PI / 3]) a.ball(Math.cos(ang) * 10, 1, Math.sin(ang) * 10, 1.2, "metal");
  a.box(-1, 12, -1, 1, 19, 1, "metal");
  // body
  a.box(-4, 20, -7, 4, 30, 7, "dark");
  a.box(-4, 31, -7, 4, 31, 7, "trim");
  a.box(-4, 20, -7, 4, 20, 7, "trim");
  for (const z of [-7, 7]) a.box(-3, 22, z, 3, 28, z, "wood");         // leather sides
  a.box(-2, 32, -2, 2, 34, 2, "dark"); a.box(3, 32, -2, 4, 33, 2, "glass");   // viewfinder hump with a window
  a.box(-1, 32, 4, 1, 33, 6, "accent");                                 // shutter dial
  a.box(-1, 32, -6, 1, 35, -5, "metal"); a.ball(0, 37, -5.5, 1.8, "glow");     // flash
  // lens barrel facing +x: stepped rings, then the glass
  for (const [x0, x1, r, m] of [[5, 6, 5, "metal"], [7, 8, 4.4, "dark"], [9, 10, 3.8, "metal"], [11, 11, 3.2, "dark"]]) for (let x = x0; x <= x1; x++) for (let y = -6; y <= 6; y++) for (let z = -6; z <= 6; z++) if (Math.hypot(y, z) <= r) a.set(x, 25 + y, z, m);
  for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) if (Math.hypot(y, z) <= 2.6) a.set(11, 25 + y, z, Math.hypot(y + 1, z + 1) < 1 ? "stone" : "glass");
  a.line(0, 29, 7, 1, 18, 9, 0.8, "accent");                            // strap
}
