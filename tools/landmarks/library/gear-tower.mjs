// Gear tower (engineering), steampunk: a riveted copper boiler tower banded in brass, portholes and a glowing
// furnace door, a big brass cog and a smaller one turning on its side, copper pipes with valve wheels, a
// pressure gauge, a brass dome and gallery, and an iron smokestack puffing steam.
function cog(a, cy, cx, z, R, teeth, m, phase = 0) {               // upright, two thick; cx runs along the face, z is the face's plane: x = z, facing +x
  for (let x = Math.floor(cx - R - 3); x <= cx + R + 3; x++) for (let y = Math.floor(cy - R - 3); y <= cy + R + 3; y++) {
    const u = x - cx, v = y - cy, d = Math.hypot(u, v), ang = Math.atan2(v, u) + phase;
    let m2 = null;
    if (d <= R && d > R - 2.2) m2 = m;
    else if (d > R && d <= R + 1.8 && Math.floor((ang / (2 * Math.PI) + 1) * teeth * 2) % 2 === 0) m2 = m;
    else if (d <= 1.6) m2 = "dark";
    else if (d <= 2.6) m2 = m;
    else if (d < R - 2) for (let k = 0; k < 5; k++) { const s = k * 2 * Math.PI / 5 + phase; if (u * Math.cos(s) + v * Math.sin(s) > 0 && Math.abs(-u * Math.sin(s) + v * Math.cos(s)) < 1) m2 = m; }
    if (m2) for (const dz of [0, 1]) a.set(z + dz, y, x, m2);
  }
}
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");                            // paving
  a.cyl(0, 1, 0, 9, 2, "dark");                                       // iron foundation
  for (let k = 0; k < 16; k++) { const t = k * Math.PI / 8; a.set(Math.round(Math.cos(t) * 9), 2, Math.round(Math.sin(t) * 9), "metal"); }   // bolts

  for (let y = 3; y <= 24; y++) a.cyl(0, y, 0, 6, 1, (y - 3) % 5 === 0 ? "metal" : "roof");   // copper boiler with brass bands
  for (const y of [3, 8, 13, 18, 23]) for (let k = 0; k < 20; k++) { const t = k * Math.PI / 10; a.set(Math.round(Math.cos(t) * 6.7), y, Math.round(Math.sin(t) * 6.7), "metal"); }   // riveted rims
  for (let y = 4; y <= 24; y++) if ((y - 3) % 5) for (let k = 0; k < 12; k++) if ((k + y) % 3 === 0) { const t = k * Math.PI / 6 + 0.26; a.set(Math.round(Math.cos(t) * 6), y, Math.round(Math.sin(t) * 6), "roof2"); }   // seams

  a.box(-7, 3, -2, -6, 7, 2, "dark"); a.box(-7, 4, -1, -7, 5, 1, "glow");   // furnace door at the back, glowing
  for (const [x, y, z] of [[-6, 15, 0], [0, 20, 6], [0, 20, -6]]) {      // portholes
    for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) { const d = Math.hypot(u, v); if (d > 2.4) continue; const m = d > 1.4 ? "metal" : "glass"; x ? a.set(x + Math.sign(x), y + v, z + u, m) : a.set(x + u, y + v, z + Math.sign(z), m); }
  }
  // pressure gauge on the +z side, between the pipes
  for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) { const d = Math.hypot(u, v); if (d <= 2.5) a.set(u, 13 + v, 7, d > 1.6 ? "metal" : "stone"); }
  a.set(0, 13, 8, "dark"); a.set(1, 14, 8, "dark");

  // on the front: a big brass cog and a smaller accent cog meshing above it, on iron brackets
  cog(a, 11, -3, 7, 7.5, 12, "metal");
  cog(a, 21, 7, 7, 3.4, 7, "accent", 0.3);
  a.box(6, 3, -4, 6, 11, -2, "dark"); a.box(6, 19, 6, 6, 22, 8, "dark");

  // copper pipes up the +z side, bending into the boiler, with valve wheels
  a.line(-4, 1, 9, -4, 17, 9, 0.9, "roof2"); a.line(-4, 17, 9, -4, 17, 6, 0.9, "roof2");
  a.line(4, 1, 9, 4, 9, 9, 0.9, "roof2"); a.line(4, 9, 9, 4, 9, 6, 0.9, "roof2");
  for (const [x, y] of [[-4, 7], [4, 5]]) for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) { const d = Math.hypot(u, v); if ((d > 1.4 && d < 2.5) || u === 0 || v === 0) a.set(x + u, y + v, 11, "accent"); }

  // gallery, dome, smokestack and steam
  a.cyl(0, 25, 0, 8, 1, "dark");
  for (let k = 0; k < 24; k++) { const t = k * Math.PI / 12; a.box(Math.round(Math.cos(t) * 7.6), 26, Math.round(Math.sin(t) * 7.6), Math.round(Math.cos(t) * 7.6), 27, Math.round(Math.sin(t) * 7.6), "metal"); }   // railing
  for (let y = 26; y <= 31; y++) { const r = Math.sqrt(Math.max(0, 1 - ((y - 25.5) / 6) ** 2)) * 6; if (r > 0.5) a.cyl(0, y, 0, r, 1, y % 2 ? "metal" : "roof"); }   // brass dome with copper ribs
  a.cyl(-2, 28, -2, 1.9, 9, "dark"); for (const y of [30, 33]) a.cyl(-2, y, -2, 2.3, 1, "metal");
  a.cyl(-2, 37, -2, 2.7, 1, "dark");
  for (const [x, y, z, r] of [[-2, 40, -2, 1.8], [-1, 43, -3, 2.2], [0, 46, -2, 1.6]]) a.ball(x, y, z, r, "stone");   // steam
  a.box(2, 31, 2, 2, 36, 2, "metal"); a.ball(2, 37, 2, 1, "glow");   // lightning rod
}
