// Newton's cradle (mechanics): a row of steel balls hung from a brass frame on a wooden base, the end one swung
// out mid-motion.
export default function build(a) {
  a.box(-12, 0, -13, 12, 0, 13, "stone2");
  a.box(-7, 1, -13, 7, 3, 13, "wood"); a.box(-7, 3, -13, 7, 3, 13, "roof2");
  for (const x of [-6, 6]) for (const z of [-12, 12]) a.line(x, 4, z, x * 0.6, 32, z, 1, "metal");   // posts, leaning in
  for (const x of [-3.6, 3.6]) a.box(x, 32, -12, x, 33, 12, "metal");  // top rails
  for (const z of [-12, 12]) a.box(-4, 32, z, 4, 33, z, "metal");
  const balls = [[-14, 17, "accent"], [-4.8, 13, "trim"], [0, 13, "trim"], [4.8, 13, "trim"], [9.6, 13, "trim"]];
  balls.forEach(([z, y, m], i) => {
    for (const x of [-3.6, 3.6]) a.line(x, 32, i === 0 ? -9.6 : z, 0, y + 2.4, z, 0.5, "stone");   // strings
    a.ball(0, y, z, 2.6, m);
  });
  a.ball(0, 13, -9.6, 0, null);
}
