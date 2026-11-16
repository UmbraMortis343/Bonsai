// Drum (rhythm, percussion): a big bass drum on its side facing out, a snare on a stand, a cymbal on a tall stand
// and a pair of crossed sticks resting on top.
function drumX(a, cx, cy, cz, R, depth, shell) {   // drumhead facing +x
  for (let x = cx - depth; x <= cx + depth; x++) for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++) for (let z = Math.floor(cz - R - 1); z <= cz + R + 1; z++) {
    const d = Math.hypot(y - cy, z - cz); if (d > R + 0.3) continue;
    const head = Math.abs(x - cx) === depth, rim = d > R - 1 && (Math.abs(x - cx) >= depth - 1);
    a.set(x, y, z, rim ? "metal" : head ? (d < 1.5 ? "glow" : "stone") : (d > R - 1 ? ((Math.round(Math.atan2(y - cy, z - cz) * 4) % 2) ? "metal" : shell) : null));
  }
}
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-8, 1, -7, 8, 1, 7, "roof2");                                 // rug
  drumX(a, 0, 12, 0, 10, 4, "accent");                                // bass drum
  a.line(4, 1, -7, 3, 5, -6, 0.8, "metal"); a.line(4, 1, 7, 3, 5, 6, 0.8, "metal");   // spurs
  a.line(-4, 23, -2, 6, 25, 6, 0.8, "wood"); a.line(-4, 23, 2, 6, 25, -6, 0.8, "wood");   // sticks on top
  // snare on a stand
  a.line(6, 1, 10, 6, 13, 10, 0.8, "trim");
  a.cyl(6, 14, 10, 3.5, 3, "accent"); a.cyl(6, 17, 10, 3.5, 1, "stone"); a.cyl(6, 14, 10, 3.8, 1, "metal");
  // cymbal on a tall stand
  a.line(6, 1, -10, 6, 27, -10, 0.8, "trim");
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const d = Math.hypot(x, z); if (d <= 4.3) a.set(6 + x, 28 + Math.round(-d * 0.15 + x * 0.25), -10 + z, "metal"); }
  a.set(6, 29, -10, "dark");
}
