// Yarn (knitting, crafts): a big ball of yarn in a woven basket, two knitting needles pushed through it, and
// a strand running out to a knitted swatch on the ground.
export default function build(a) {
  a.cyl(0, 0, 0, 13, 1, "stone2");
  for (let y = 1; y <= 7; y++) for (let z = -10; z <= 10; z++) for (let x = -10; x <= 10; x++) {   // basket: woven wall and a floor
    const d = Math.hypot(x, z); if (d > 9.6 || (y > 1 && d < 8.4)) continue;
    const ang = Math.atan2(z, x), weave = (Math.floor((ang + Math.PI) * 4) + y) % 2;
    a.set(x, y, z, y === 7 ? "roof2" : weave ? "wood" : "roof2");
  }
  // the ball, with grooves where strands wrap round it
  const cy = 13, R = 8.5;
  for (let y = cy - R; y <= cy + R; y++) for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x, y - cy, z); if (d > R + 0.3) continue;
    const X = x / d, Y = (y - cy) / d, Z = z / d;
    const groove = d > R - 1 && (Math.abs(Math.sin((X * 0.8 + Y * 0.6) * 9)) < 0.22 || Math.abs(Math.sin((Z * 0.7 - Y * 0.7) * 9)) < 0.18);
    if (!groove) a.set(x, y, z, "accent");
  }
  // needles: long rods with knobs on their ends
  a.line(-6, 6, -4, 7, 30, 4, 0.9, "metal"); a.ball(7, 30, 4, 1.5, "wood");
  a.line(5, 6, -6, -6, 31, 3, 0.9, "metal"); a.ball(-6, 31, 3, 1.5, "wood");
  // strand over the rim to a swatch in front
  a.line(7, 10, 2, 10, 7, 4, 0.8, "accent"); a.line(10, 7, 4, 11, 2, 6, 0.8, "accent");
  for (let x = 8; x <= 13; x++) for (let z = 5; z <= 12; z++) a.set(x, 1, z, (x + Math.abs(z % 2)) % 2 ? "accent" : "stone");
}
