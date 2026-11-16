// Computer (computer science, programming, algorithms): an old desktop computer, a chunky monitor with lines of
// code glowing on its screen, a case with a disk slot and a keyboard in front.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-8, 1, -10, 6, 6, 10, "stone"); a.box(6, 3, -8, 6, 3, -2, "dark"); a.box(6, 2, 5, 6, 2, 8, "accent");   // case, disk slot, light
  a.box(-7, 7, -9, 5, 23, 9, "stone");                                // monitor
  a.box(-12, 9, -6, -8, 21, 6, "stone2");                             // the tube's bulge behind
  a.box(5, 8, -8, 5, 22, 8, "stone2");                                // bezel
  a.box(6, 9, -7, 6, 21, 7, "dark");                                  // screen
  const code = [[20, 6, 1], [18, 4, -3], [16, 4, 3], [14, 2, -5], [12, 6, -1], [10, 4, 1]];   // [y, indent, length] in screen columns
  for (const [y, ind, len] of code) for (let k = 0; k < 4 + len; k++) { const z = 6 - ind - k; if (z >= -6) a.set(6, y, z, k === 0 ? "glow" : "accent"); }
  a.set(6, 10, -2, "glow"); a.set(6, 10, -3, "glow");                 // cursor
  a.box(8, 1, -9, 12, 2, 9, "stone2");                                // keyboard
  for (let x = 8; x <= 12; x++) for (let z = -8; z <= 8; z++) if ((x + z) % 2 === 0) a.set(x, 3, z, x === 12 && Math.abs(z) < 4 ? "stone2" : "stone");
  a.line(-8, 4, 0, -12, 1, 4, 0.7, "dark");                           // cable
}
