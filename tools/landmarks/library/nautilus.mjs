// Nautilus (patterns, sequences): a large nautilus shell on a brass museum stand, standing on its edge. Each turn
// of its coil is three times the one before; the outer whorl wraps the inner ones, with a dark aperture at
// the end, tiger stripes swept along the coil, and the line of the last turn showing where it meets the coil.
export default function build(a) {
  a.cyl(0, 0, 0, 10, 1, "stone2");                                  // stand
  a.cyl(0, 1, 0, 6.5, 1, "stone");
  a.cyl(0, 2, 0, 4.5, 1, "accent");
  a.cyl(0, 3, 0, 1.3, 4, "metal");
  a.ellipsoid(0, 7, -0.5, 2.2, 1.2, 3.2, "metal");                   // cradle

  const Rend = 16, b = Math.log(3) / (2 * Math.PI), thEnd = -1.745, cz = 2, cy = 7.5 + 0.98 * Rend;
  const A = Rend * Math.exp(-b * thEnd), TAU = 2 * Math.PI;
  for (let y = 0; y < 48; y++) for (let z = -16; z <= 15; z++) {
    const dy = y - cy, dz = z - cz, rho = Math.hypot(dy, dz), th0 = Math.atan2(dy, dz);
    const back = (((thEnd - th0) % TAU) + TAU) % TAU, thu = thEnd - back, Rout = A * Math.exp(b * thu);
    if (rho > Rout + 0.3) continue;
    let hx = 0.4 * Rout * Math.pow(Math.max(0, 1 - (rho / Rout) ** 2), 0.5);
    if (rho < 1.8) hx *= 0.45;                                        // the dimple in the middle
    const seam = Math.abs(rho - Rout / 3) < 0.7 && back > 0.3;          // where the outer whorl meets the coil
    const stripe = rho > Rout * 0.38 && back > 1.1 && Math.sin(thu * 5 - Math.log(rho + 1) * 4) > 0.45;
    const mouth = back < 0.28 && rho > Rout / 3 + 1 && rho < Rout - 1.2;
    for (let x = -Math.round(hx); x <= Math.round(hx); x++) {
      const surface = Math.abs(x) >= Math.round(hx) - 1;
      a.set(x, y, z, mouth && Math.abs(x) < hx - 1.2 ? "dark" : seam && surface ? "stone2" : stripe && surface ? "roof2" : "stone");
    }
  }
  for (const s of [-1, 1]) a.set(s * 2, Math.round(cy), cz, "glow");   // the first chamber, glinting in the dimple
}
