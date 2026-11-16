// Orrery (astrophysics, cosmology): a brass orrery on a wooden drum, the glowing sun on its central column and
// planets on arms at their own heights, one with a ring.
export default function build(a) {
  a.cyl(0, 0, 0, 12.5, 1, "stone2");
  a.cyl(0, 1, 0, 8, 4, "wood"); a.cyl(0, 5, 0, 8.6, 1, "metal");
  for (let k = 0; k < 24; k++) { const t = (k / 24) * Math.PI * 2; a.set(Math.round(Math.cos(t) * 8.6), 6, Math.round(Math.sin(t) * 8.6), k % 2 ? "metal" : null); }   // cog teeth round the top
  a.cyl(0, 6, 0, 1.2, 14, "metal");
  a.ball(0, 23, 0, 3.6, "glow");                                       // sun
  const planets = [[5, 20, 0.4, 1.3, "trim"], [8.5, 17, 2.2, 1.8, "accent"], [12, 14, 3.9, 2, "roof"], [13.5, 11, 5.3, 2.4, "metal"]];
  for (const [r, y, ang, size, m] of planets) {
    const x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
    a.line(0, y - 4, 0, x, y - 4, z, 0.6, "metal"); a.line(x, y - 4, z, x, y, z, 0.6, "metal");   // arm out, stalk up
    a.ball(x, y, z, size, m);
  }
  const [r, y, ang] = planets[3], sx = Math.round(Math.cos(ang) * r), sz = Math.round(Math.sin(ang) * r);
  for (let k = 0; k < 40; k++) { const t = (k / 40) * Math.PI * 2; a.set(sx + Math.round(Math.cos(t) * 4), y + Math.round(Math.sin(t) * 1), sz + Math.round(Math.sin(t) * 4), "stone"); }   // ring
}
