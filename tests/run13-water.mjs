// Water keeps clear of whatever stands in the middle of an island: for each
// centrepiece, on islands of every size, with and without a mountain and with
// each biome on each plot, no pond, lake or stream lies under its blocks.
import { buildWorld, centreSpan } from "../src/isles-world.js";

const BIOMES = ["highland", "tropical", "fern", "bloom", "glowcap", "lantern"], SECTORS = 32;
let failed = false, worst = 1e9, built = 0;
for (const landmark of ["academy", "amphitheatre"]) {
  const span = centreSpan(landmark);
  if (!(span.max > 3)) { console.error("FAIL run13-water:", landmark, "wasn't measured"); failed = true; }
  for (let n = 1; n <= 6; n++) for (const mountain of [false, true]) for (const E of [1, 1.3]) for (let turn = 0; turn < 3; turn++) {
    const isl = { id: `w-${landmark}-${n}-${mountain}-${E}-${turn}`, landmark, mountain, size: Math.sqrt(Math.max(3, n) / 6), E, seed: 5 + turn * 7,
      topics: Array.from({ length: n }, (_, k) => ({ biome: n < 3 ? ["tropical", "fern", "highland"][(k + turn) % 3] : BIOMES[(k + turn * 2) % 6], name: "Topic " + k, growth: E > 1 ? 1.6 : 0.3, health: 1, mark: "kit" })) };
    const world = buildWorld(isl, 2 * Math.round((104 * isl.size * E) / 2)), p = world.wet.attributes.position; built++;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), k = ((Math.round((Math.atan2(z, x) / (Math.PI * 2)) * SECTORS) % SECTORS) + SECTORS) % SECTORS;
      const reach = Math.max(span.dir[(k + SECTORS - 1) % SECTORS], span.dir[k], span.dir[(k + 1) % SECTORS]), gap = Math.hypot(x, z) - reach;
      if (gap < worst) worst = gap;
      if (gap < 0.3) { console.error(`FAIL run13-water: water ${gap.toFixed(1)} from the ${landmark} on ${isl.id}`); failed = true; break; }
    }
  }
}
if (failed) process.exit(1);
console.log(`PASS run13-water (${built} islands, closest water ${worst.toFixed(1)} from a centrepiece)`);
