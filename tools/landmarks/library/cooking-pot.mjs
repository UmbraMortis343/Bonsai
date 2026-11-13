// Cooking: a big pot hanging from a wooden frame over a campfire, with steam rising.
export default function build(a) {
  // paved base
  a.cyl(-0.5, 0, -0.5, 13.5, 1, "stone2");
  a.cyl(-0.5, 1, -0.5, 12.5, 1, "stone");
  // fire ring of stones
  for (let k = 0; k < 14; k++) { const t = k / 14 * Math.PI * 2; a.box(Math.round(6.5 * Math.cos(t)), 2, Math.round(6.5 * Math.sin(t)), Math.round(6.5 * Math.cos(t)), 3, Math.round(6.5 * Math.sin(t)), "trim"); }
  // crossed logs
  a.line(-5, 3, -4, 5, 3, 4, 1.1, "wood");
  a.line(-5, 3, 4, 5, 3, -4, 1.1, "wood");
  // flames: orange outside, yellow/glow core
  a.ellipsoid(0, 6, 0, 4, 4, 4, "roof");
  a.ellipsoid(0, 7, 0, 2.6, 4, 2.6, "metal");
  a.ellipsoid(0, 7, 0, 1.6, 3, 1.6, "glow");
  for (const [x, z, h] of [[3, 1, 9], [-2, 3, 10], [1, -3, 11], [-3, -2, 9]]) a.line(x, 6, z, x * 0.6, h, z * 0.6, 1, "roof");

  // A-frame legs at z = +-11, crossbar along z
  for (const z of [-11, 11]) {
    a.line(-6, 2, z, 0, 34, z, 1, "wood");
    a.line(6, 2, z, 0, 34, z, 1, "wood");
  }
  a.line(0, 35, -13, 0, 35, 13, 1, "wood");
  // chain and bail handle
  a.box(0, 30, 0, 0, 34, 0, "trim");
  a.line(0, 30, 0, 0, 26, -7, 0.5, "metal");
  a.line(0, 30, 0, 0, 26, 7, 0.5, "metal");
  a.line(0, 29, 0, -0.01, 29, 0, 0.5, "metal");

  // the pot (topic colour), deep round belly with a narrower dark rim
  a.ellipsoid(0, 18, 0, 8.5, 8.5, 8.5, "accent");
  a.box(-9, 24, -9, 9, 30, 9, null);                // cut the top
  a.cyl(0, 22, 0, 6.6, 3, "dark");                  // thick rim
  a.cyl(0, 25, 0, 6.9, 1, "dark");                  // lip
  a.cyl(0, 21, 0, 5.2, 5, null);                    // hollow mouth
  a.cyl(0, 21, 0, 5.2, 1, "roof2");                 // stew, sunk inside
  a.cyl(0, 15, 0, 8.7, 1, "dark");                  // belly band
  for (const z of [-7, 7]) a.box(-1, 24, z, 1, 26, z, "dark"); // lugs
  for (const [x, z] of [[2, 1], [-2, -2], [0, -3]]) a.set(x, 22, z, "roof");
  a.cyl(0, 9, 0, 3, 1, "dark");                     // base of the pot
  // steam puffs rising
  a.ball(1, 28, 1, 1.6, "stone");
  a.ball(-2, 32, -1, 2.4, "stone");
  a.ball(1, 37, 1, 2.6, "stone");
  a.ball(-1, 42, 0, 2.2, "stone");
}
