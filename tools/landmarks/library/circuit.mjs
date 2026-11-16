// Circuit (electronics, computing): a microchip on a circuit board with copper traces, a tall glowing valve, two
// capacitors and a striped resistor.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-12, 1, -12, 12, 2, 12, "accent");                            // board
  for (const z of [-9, -5, 5, 9]) a.box(-12, 3, z, 12, 3, z, "metal"); // traces
  for (const x of [-9, 9]) a.box(x, 3, -12, x, 3, 12, "metal");
  a.box(-5, 3, -5, 5, 7, 5, "dark");                                  // chip
  for (let k = -4; k <= 4; k += 2) { a.box(6, 3, k, 6, 5, k, "metal"); a.box(-6, 3, k, -6, 5, k, "metal"); a.box(k, 3, 6, k, 5, 6, "metal"); a.box(k, 3, -6, k, 5, -6, "metal"); }   // pins
  a.box(-1, 8, -1, 1, 8, 1, "glow"); a.set(4, 8, 4, "stone");
  // valve at the back corner: base, glass envelope, glowing filament
  a.cyl(-8, 3, -8, 3, 3, "dark");
  for (let y = 6; y <= 26; y++) { const r = y < 22 ? 3.2 : 3.2 - (y - 21) * 0.6; a.cyl(-8, y, -8, r, 1, "glass"); }
  a.box(-8, 8, -8, -8, 21, -8, "glow"); a.set(-8, 27, -8, "metal");
  // capacitors and a resistor
  a.cyl(8, 3, -8, 2.2, 9, "roof"); a.cyl(8, 12, -8, 2.2, 1, "metal");
  a.cyl(8, 3, -3, 1.6, 6, "trim"); a.cyl(8, 9, -3, 1.6, 1, "metal");
  for (let z = 3; z <= 10; z++) a.box(8, 4, z, 9, 5, z, [3, 5, 7].includes(z) ? "roof2" : z === 9 ? "metal" : "wood");
}
