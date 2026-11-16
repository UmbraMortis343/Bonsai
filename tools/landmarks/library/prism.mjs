// Prism (optics, light): a glass prism on a stone stand splitting a white beam from a lamp into a fan of colours.
export default function build(a) {
  a.box(-13, 0, -13, 13, 0, 13, "stone2");
  a.box(-5, 1, -6, 5, 4, 6, "stone"); a.box(-6, 5, -7, 6, 5, 7, "trim");
  for (let y = 6; y <= 22; y++) { const half = 8 * (1 - (y - 6) / 17); for (let z = -Math.floor(half); z <= Math.floor(half); z++) a.box(-4, y, z, 4, y, z, "glass"); }   // triangular prism, facing the front
  // lamp on a post to the left, its beam into the prism's left face
  a.box(-1, 1, -13, 1, 14, -12, "metal"); a.box(-2, 15, -14, 2, 18, -11, "dark"); a.box(-1, 16, -10, 1, 17, -10, "glow");
  a.line(0, 16.5, -10, 0, 13, -4, 1, "stone");
  // the fan of colours out of the right face, spreading down to the ground
  ["roof", "metal", "glow", "accent", "glass", "trim"].forEach((m, i) => { a.line(0, 13 - i * 0.5, 4, 0, 1, 9 + i * 1.1, 0.9, m); for (let x = -6 + i; x <= 6 - i; x++) a.set(x, 1, Math.round(9 + i * 1.1), m); });   // and a rainbow cast on the ground
}
