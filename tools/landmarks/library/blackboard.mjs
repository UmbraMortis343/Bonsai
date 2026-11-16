// Blackboard (algebra): a chalkboard in a wooden frame on an A-frame stand, an equation chalked on it, a ledge
// with chalk and a duster.
const GLYPH = { x: ["101", "101", "010", "101", "101"], y: ["101", "101", "111", "001", "111"], "+": ["000", "010", "111", "010", "000"], "=": ["000", "111", "000", "111", "000"], 2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "111", "001", "111"], 7: ["111", "001", "010", "010", "010"], "^": ["010", "101", "000", "000", "000"] };
function write(a, text, y0, z0, x) {   // reads left to right from the front (+x), so z goes from +z to -z
  let z = z0; for (const ch of text) { const g = GLYPH[ch]; if (g) g.forEach((row, r) => [...row].forEach((c, k) => { if (c === "1") a.set(x, y0 - r, z - k, "stone"); })); z -= 4; }
}
export default function build(a) {
  a.box(-12, 0, -12, 12, 0, 12, "stone2");
  for (const z of [-11, 11]) { a.line(4, 1, z, 0, 30, z, 1, "wood"); a.line(-4, 1, z, 0, 30, z, 1, "wood"); }   // A-frame legs
  a.box(0, 30, -12, 0, 31, 12, "wood");
  a.box(0, 11, -11, 0, 29, 11, "wood");                               // frame
  a.box(0, 12, -10, 0, 28, 10, "dark");                               // board, both sides
  a.box(1, 11, -10, 2, 11, 10, "wood");                               // ledge
  a.box(1, 12, -8, 2, 12, -6, "stone"); a.box(1, 12, 4, 2, 13, 8, "accent");   // chalk and duster
  write(a, "x+y=7", 26, 9, 1);
  write(a, "2x^3", 19, 7, 1);
  write(a, "x+y=7", 26, -9, -1); for (let r = 0; r < 5; r++) for (let z = -9; z <= 9; z++) if (a.get(-1, 26 - r, z)) a.set(-1, 26 - r, z, null);   // the back is wiped
  for (let z = -8; z <= 8; z += 3) a.set(-1, 22, z, "stone2");       // smudges
}
