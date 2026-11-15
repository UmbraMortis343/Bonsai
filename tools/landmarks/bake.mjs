// Bakes every landmark in library/ into src/marks-lib.js, the voxel data the app draws them from.
// Usage: node tools/landmarks/bake.mjs [out.js]      (run it after adding or changing a landmark)
// Format of one entry: { name, size: [w, h, d], at: [x0, z0], rle } — the landmark's blocks cropped to their
// bounds, y-major then z then x, as base64 of (material, run length) byte pairs; material 0 is empty and
// 1.. follow MATS (the kit's material names, in order).
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeGrid, MATERIALS, SIZE, HEIGHT } from "./kit.mjs";

const here = dirname(fileURLToPath(import.meta.url)), lib = join(here, "library"), out = resolve(process.argv[2] || join(here, "../../src/marks-lib.js"));
// what each landmark is called in the app; a file without a name here is named from its file name
const NAMES = { abacus: "Abacus", atom: "Atom", "bell-tower": "Bell tower", books: "Books", camera: "Camera", "cooking-pot": "Cooking pot", "dna-helix": "DNA helix", easel: "Easel", flask: "Flask", "gear-tower": "Gear tower", globe: "Globe", lectern: "Lectern", lighthouse: "Lighthouse", observatory: "Observatory", quill: "Quill", "radio-dish": "Radio dish", "ruined-temple": "Ruined temple", scales: "Scales", "seated-figure": "Seated scholar", synth: "Synth", trophy: "Trophy", yarn: "Yarn" };
const H = SIZE / 2, entries = [];
for (const f of readdirSync(lib).filter((f) => f.endsWith(".mjs")).sort()) {
  const id = f.slice(0, -4), grid = makeGrid();
  (await import(pathToFileURL(join(lib, f)).href)).default(grid.a);
  let x0 = 99, x1 = -99, z0 = 99, z1 = -99, y1 = -1;
  for (let y = 0; y < HEIGHT; y++) for (let z = -H; z < H; z++) for (let x = -H; x < H; x++) if (grid.g[grid.I(x, y, z)]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y1 = y; }
  const w = x1 - x0 + 1, h = y1 + 1, d = z1 - z0 + 1, bytes = [];
  let cur = -1, run = 0;
  const flush = () => { if (run) bytes.push(cur, run); };
  for (let y = 0; y < h; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const m = grid.g[grid.I(x, y, z)];
    if (m === cur && run < 255) run++; else { flush(); cur = m; run = 1; }
  }
  flush();
  entries.push(`  ${JSON.stringify(id)}: { name: ${JSON.stringify(NAMES[id] || id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()))}, size: [${w}, ${h}, ${d}], at: [${x0}, ${z0}], rle: "${Buffer.from(bytes).toString("base64")}" },`);
}
writeFileSync(out, `// Made by tools/landmarks/bake.mjs from tools/landmarks/library — don't edit by hand; change a landmark there and bake again.
export const MATS = ${JSON.stringify(Object.keys(MATERIALS))};
export const LIBRARY = {
${entries.join("\n")}
};
`);
console.log(`baked ${entries.length} landmarks into ${out}`);
