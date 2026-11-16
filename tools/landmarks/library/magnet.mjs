// Magnet (electromagnetism): a giant horseshoe magnet standing upright, red with steel poles, field lines looping
// between the poles, and iron filings on the ground.
export default function build(a) {
  a.cyl(0, 0, 0, 12.5, 1, "stone2");
  const cy = 13, R = 8.5, th = 3.5;
  for (let y = 1; y <= 34; y++) for (let z = -13; z <= 13; z++) {
    const inBend = y <= cy && Math.abs(Math.hypot(z, y - cy) - R) <= th / 2 + 0.3, inArm = y > cy && Math.abs(Math.abs(z) - R) <= th / 2 + 0.3;
    if (!inBend && !inArm) continue;
    const m = y >= 29 ? "trim" : (z < 0 ? "roof" : "accent");
    a.box(-2, y + 1, z, 2, y + 1, z, m);
  }
  for (const h of [4, 7, 10]) for (let k = 0; k <= 40; k++) { const t = (k / 40) * Math.PI; a.ball(0, 35 + Math.sin(t) * h, -Math.cos(t) * R, 0.6, "glass"); }   // field lines
  a.ball(0, 45, 0, 1.2, "glow");
  for (let k = 0; k < 60; k++) { const t = k * 2.4, r = 9 + (k % 4); a.set(Math.round(Math.cos(t) * r), 1, Math.round(Math.sin(t) * r), "dark"); }   // filings
}
