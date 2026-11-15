// Synth (synthesis, music technology): a modular synth in a wooden case, two tiers of panels with knobs and
// glowing jacks, patch cables drooping between them, and a keyboard in front.
export default function build(a) {
  a.box(-13, 0, -13, 13, 1, 13, "stone2");
  // keyboard on a wooden case, keys running along z, facing +x
  a.box(2, 2, -12, 12, 5, 12, "wood");
  for (let z = -11; z <= 11; z++) a.box(6, 6, z, 12, 6, z, z % 3 === 0 ? "trim" : "stone");   // white keys
  for (let z = -11; z <= 11; z++) if ([1, 2, 4, 5, 7].includes(((z + 33) % 7))) a.box(6, 7, z, 9, 7, z, "dark");   // black keys
  a.box(2, 6, -12, 5, 7, 12, "wood");                                 // the strip behind the keys
  for (let z = -10; z <= 10; z += 4) a.set(5, 8, z, "metal");          // its knobs
  // the rack: lower tier, then an upper tier set back
  const tier = (x0, x1, y0, y1, z0, z1) => {
    a.box(x0, y0, z0, x1, y1, z1, "wood");
    a.box(x1, y0 + 1, z0 + 1, x1, y1 - 1, z1 - 1, "dark");             // panel face
    for (let z = z0 + 2; z <= z1 - 2; z += 3) for (let y = y0 + 2; y <= y1 - 2; y += 3) a.set(x1 + 1, y, z, (y + z) % 2 ? "metal" : "glow");
    for (let z = z0 + 1; z <= z1 - 1; z += 6) a.box(x1, y0 + 1, z, x1, y1 - 1, z, "trim");   // rails between modules
  };
  tier(-6, 1, 2, 16, -12, 12);
  tier(-12, -5, 16, 30, -11, 11);
  a.box(-12, 31, -11, -5, 31, 11, "trim");
  // patch cables, drooping between jacks
  const cable = (z0, y0, z1, y1, x0, x1) => { for (let i = 0; i <= 20; i++) { const f = i / 20, sag = Math.sin(f * Math.PI) * 4; a.ball(x0 + (x1 - x0) * f + 1.2, y0 + (y1 - y0) * f - sag, z0 + (z1 - z0) * f, 0.8, "accent"); } };
  cable(-10, 13, -4, 13, 1, 1);
  cable(5, 27, 8, 13, -5, 1);
  cable(-7, 28, 2, 27, -5, -5);
}
