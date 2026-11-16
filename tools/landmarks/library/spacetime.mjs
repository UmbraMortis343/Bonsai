// Spacetime (relativity, gravity): a gridded sheet of spacetime held up on four posts, sagging into a well around
// a heavy planet, with a small moon circling it.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { a.box(sx * 12, 1, sz * 12, sx * 11, 19, sz * 11, "trim"); a.ball(sx * 11.5, 20, sz * 11.5, 1.3, "metal"); }
  const h = (x, z) => 19 - 13 / (1 + (x * x + z * z) / 14);           // the sheet's height: flat at the edge, a deep well in the middle
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
    const line = x % 3 === 0 || z % 3 === 0;
    const y = Math.round(h(x, z)), yn = Math.max(Math.round(h(x + 1, z)), Math.round(h(x, z + 1)), Math.round(h(x - 1, z)), Math.round(h(x, z - 1)));
    if (line) for (let k = y; k <= Math.max(y, yn - 1); k++) a.set(x, k, z, "metal");   // only the grid lines, so you see down into the well
  }
  a.ball(0, 10, 0, 4.5, "accent");                                        // the planet in the well
  for (let k = 0; k < 90; k++) { const t = (k / 90) * Math.PI * 2; a.set(Math.round(Math.cos(t) * 8), Math.round(17 + Math.sin(t) * 2), Math.round(Math.sin(t) * 8), "dark"); }   // the moon's path
  a.ball(8, 17, 0, 1.6, "glow");
}
