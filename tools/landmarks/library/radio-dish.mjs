// Radio telescope: big white parabolic dish tilted to the sky on an alt-az yoke, quadrupod struts holding a feed horn at the focus.
export default function build(a) {
  const el = 50 * Math.PI / 180;                        // elevation of the dish axis
  const ax = [0, Math.sin(el), Math.cos(el)];           // axis (points up and toward +z)
  const bx = [1, 0, 0];                                 // in-dish horizontal
  const by = [0, Math.cos(el), -Math.sin(el)];          // in-dish "up-ish"
  const V = [0, 22, -3];                                // vertex of the paraboloid
  const R = 13, f = 10;                                 // radius, focal length (rim depth = R^2/4f ~ 4.2)
  const P = (u, v, w) => [V[0] + u * bx[0] + v * by[0] + w * ax[0], V[1] + u * bx[1] + v * by[1] + w * ax[1], V[2] + u * bx[2] + v * by[2] + w * ax[2]];

  // base and pedestal
  a.cyl(0, 0, -1, 7, 1, "stone2");
  a.cyl(0, 1, -1, 5.5, 1, "stone2");
  for (let y = 2; y <= 11; y++) a.cyl(0, y, -1, 3.8 - (y - 2) * 0.12, 1, "stone");
  a.cyl(0, 9, -1, 3.7, 1, "accent");
  a.box(-1, 2, 2, 1, 5, 2, "dark");                     // door
  a.cyl(0, 12, -1, 5, 1, "trim");                       // turntable
  a.cyl(0, 13, -1, 4.2, 1, "trim");

  // yoke arms up to the elevation bearing behind the dish
  const B = P(0, 0, -2.5);
  for (const sx of [-1, 1]) {
    a.line(sx * 4, 14, -1, sx * 6, B[1], B[2], 1, "trim");
    a.ball(sx * 6.5, B[1], B[2], 1.3, "metal");
  }
  a.line(-6, B[1], B[2], 6, B[1], B[2], 0.5, "metal"); // axle

  // dish shell: test every voxel against the paraboloid in dish coordinates
  for (let y = 0; y < 48; y++) for (let z = -16; z < 16; z++) for (let x = -16; x < 16; x++) {
    const d = [x - V[0], y - V[1], z - V[2]];
    const u = d[0] * bx[0] + d[1] * bx[1] + d[2] * bx[2];
    const v = d[0] * by[0] + d[1] * by[1] + d[2] * by[2];
    const w = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2];
    const r = Math.hypot(u, v);
    if (r > R + 0.4) continue;
    const s = (r * r) / (4 * f), dw = w - s;
    if (dw > -0.6 && dw <= 0.8) {                       // inner (front) surface
      a.set(x, y, z, r > R - 0.8 ? "trim" : "stone");
    } else if (dw > -1.6 && dw <= -0.6) {               // back skin
      a.set(x, y, z, "stone2");
    }
  }
  // back truss: a cone from the rim's back to the bearing
  for (let k = 0; k < 8; k++) {
    const t = k * Math.PI / 4, ru = Math.cos(t) * 7, rv = Math.sin(t) * 7;
    const Q = P(ru, rv, (49) / (4 * f) - 1.5);
    a.line(Q[0], Q[1], Q[2], B[0], B[1], B[2], 0.5, "trim");
  }

  // quadrupod: four struts from the rim to the feed at the focus
  const Fp = P(0, 0, f - 0.5);
  for (let k = 0; k < 4; k++) {
    const t = k * Math.PI / 2 + Math.PI / 4, ru = Math.cos(t) * (R - 1), rv = Math.sin(t) * (R - 1);
    const Q = P(ru, rv, ((R - 1) ** 2) / (4 * f) + 0.5);
    a.line(Q[0], Q[1], Q[2], Fp[0], Fp[1], Fp[2], 0.5, "trim");
  }
  // feed horn cabin
  const F0 = P(0, 0, f - 2.5), F1 = P(0, 0, f + 0.5);
  a.line(F0[0], F0[1], F0[2], F1[0], F1[1], F1[2], 1.7, "accent");
  const Ft = P(0, 0, f + 2);
  a.ball(Ft[0], Ft[1], Ft[2], 0.9, "glow");
  const Fl = P(0, 0, f - 4);
  a.set(Fl[0], Fl[1], Fl[2], "dark");
}
