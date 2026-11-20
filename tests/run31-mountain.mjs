// The mountain keeps off the centrepiece: on every island size, with each centrepiece, the ground no higher with a
// mountain than without one until 5 units past the centrepiece's reach, so the slope never crowds it. On a small island the mountain is set back, and made
// smaller only when there's no room. The arches island keeps its mountain where it was.
import { buildWorld, centreSpan } from "../src/isles-world.js";

const SECTORS = 32; let failed = false, built = 0, worst = 0;
for (const landmark of ["academy", "amphitheatre", "statue"]) {
  const span = centreSpan(landmark);
  for (let n = 1; n <= 6; n++) for (const E of [1, 1.3]) for (let turn = 0; turn < 2; turn++) {
    const base = { landmark, size: Math.sqrt(Math.max(3, n) / 6), E, seed: 3 + turn * 11,
      topics: Array.from({ length: n }, (_, k) => ({ biome: ["bloom", "fern", "glowcap", "lantern", "tropical", "highland"][(k + turn) % 6], name: "T" + k, growth: 0.3, health: 1, mark: "kit" })) };
    const N = 2 * Math.round((104 * base.size * E) / 2);
    const flat = buildWorld({ ...base, id: `m0-${landmark}-${n}-${E}-${turn}`, mountain: false }, N), hill = buildWorld({ ...base, id: `m1-${landmark}-${n}-${E}-${turn}`, mountain: true }, N); built += 2;
    const s = hill.s; let bad = 0;
    for (let k = 0; k < SECTORS; k++) {
      const a = (k / SECTORS) * Math.PI * 2, reach = span.dir[k] + 5;
      for (let r = 0; r <= reach; r += s / 2) { const x = Math.cos(a) * r, z = Math.sin(a) * r, d = hill.heightAt(x, z) - flat.heightAt(x, z); if (d > worst) worst = d; if (d > s * 1.01) bad++; }
    }
    if (bad) { console.error(`FAIL run31-mountain: the mountain rises into the ${landmark} at ${bad} points (${n} topics, E ${E}, turn ${turn})`); failed = true; }
  }
}
if (failed) process.exit(1);
console.log(`PASS run31-mountain (${built} islands, at most ${worst.toFixed(2)} higher under a centrepiece)`);
