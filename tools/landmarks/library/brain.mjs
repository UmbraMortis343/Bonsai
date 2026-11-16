// Brain (psychology, neuroscience, memory): a brain on a stone pedestal, two folded hemispheres with a deep
// groove between them, the cerebellum behind, and sparks where neurons fire.
export default function build(a) {
  a.cyl(0, 0, 0, 12, 1, "stone2");
  a.cyl(0, 1, 0, 6, 2, "stone"); a.cyl(0, 3, 0, 3.4, 6, "stone"); a.cyl(0, 9, 0, 5, 1, "accent");
  a.cyl(-3, 10, 0, 1.8, 5, "roof2");                                  // brain stem
  a.ellipsoid(-7, 13, 0, 3.5, 2.6, 5.5, "roof2");                       // cerebellum
  for (const s of [-1, 1]) for (let x = -12; x <= 12; x++) for (let y = 10; y <= 31; y++) for (let z = -12; z <= 12; z++) {
    const dx = x / 12, dy = (y - 19) / 7.5, dz = (z - s * 5.4) / 5.8, d = dx * dx + dy * dy + dz * dz;
    if (d > 1 || s * z < 0.6) continue;
    const fold = d > 0.72 && Math.sin(x * 1.1 + Math.sin(y * 0.9) * 2) * Math.cos(z * 1.2 + y * 0.5) > 0.25;   // grooves between the folds
    a.set(x, y, z, fold ? "roof2" : "roof");
  }
  for (const [x, y, z] of [[6, 25, 5], [-4, 26, -6], [10, 19, -6], [0, 27, 4], [-9, 21, 7]]) a.ball(x, y, z, 1, "glow");   // firing
}
