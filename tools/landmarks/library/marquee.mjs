// Marquee (events): a round striped tent with its door open to the front, a flag on the centre pole, and strings
// of bunting running down to stakes.
export default function build(a) {
  a.cyl(0, 0, 0, 13, 1, "stone2");
  for (let y = 1; y <= 9; y++) for (let k = 0; k < 160; k++) { const t = (k / 160) * Math.PI * 2; a.set(Math.round(Math.cos(t) * 9.5), y, Math.round(Math.sin(t) * 9.5), Math.floor((t / (Math.PI * 2)) * 16) % 2 ? "accent" : "stone"); }
  for (let y = 10; y <= 26; y++) { const r = 10.5 * (1 - (y - 10) / 17); for (let k = 0; k < 160; k++) { const t = (k / 160) * Math.PI * 2; a.set(Math.round(Math.cos(t) * r), y, Math.round(Math.sin(t) * r), Math.floor((t / (Math.PI * 2)) * 16) % 2 ? "accent" : "stone"); } }
  for (let k = 0; k < 160; k++) { const t = (k / 160) * Math.PI * 2; a.set(Math.round(Math.cos(t) * 10.8), 10, Math.round(Math.sin(t) * 10.8), (k % 10) < 5 ? "roof" : "stone"); }   // scalloped trim
  a.box(9, 1, -2, 10, 7, 2, "dark"); a.box(8, 1, -2, 8, 7, 2, "dark");   // door
  a.box(0, 26, 0, 0, 33, 0, "wood"); a.ball(0, 34, 0, 0.8, "metal");
  for (let y = 29; y <= 32; y++) for (let z = 1; z <= 1 + (32 - y) * 1.5; z++) a.set(0, y, z, "roof");   // flag
  for (const ang of [0.8, 2.4, 3.9, 5.5]) {                            // bunting
    const sx = Math.cos(ang) * 14, sz = Math.sin(ang) * 14;
    a.box(Math.round(sx), 1, Math.round(sz), Math.round(sx), 3, Math.round(sz), "wood");
    for (let k = 0; k <= 24; k++) { const f = k / 24, x = sx * f * 0.85 + 0, z = sz * f * 0.85, y = 27 - f * 24 - Math.sin(f * Math.PI) * 2; a.set(x * 1.05, y, z * 1.05, "dark"); if (k % 3 === 1 && f > 0.3) a.set(x * 1.05, y - 1, z * 1.05, k % 2 ? "accent" : "metal"); }
  }
}
