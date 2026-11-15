// The landmark library: the baked data matches tools/landmarks/library, every library landmark decodes to the
// blocks its file lays, stands on an island at every tier, and topics with no landmark picked get one from
// their name. Node only.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildWorld, libModel } from "../src/isles-world.js";
import { LIBRARY } from "../src/marks-lib.js";
import { MARK_LIST, guessMark } from "../src/marks.js";
import { makeGrid, stats } from "../tools/landmarks/kit.mjs";

let failed = false;
const ok = (c, m) => { if (!c) { console.error("FAIL run17-marks:", m); failed = true; } };

const fresh = join(mkdtempSync(join(tmpdir(), "marks-")), "marks-lib.js");
execFileSync("node", ["tools/landmarks/bake.mjs", fresh], { stdio: "ignore" });
ok(readFileSync(fresh, "utf8") === readFileSync("src/marks-lib.js", "utf8"), "src/marks-lib.js is stale: run node tools/landmarks/bake.mjs");

const ids = Object.keys(LIBRARY);
ok(ids.length >= 22, `only ${ids.length} landmarks in the library`);
for (const id of ids) {
  const grid = makeGrid(); (await import(pathToFileURL(`tools/landmarks/library/${id}.mjs`).href)).default(grid.a);
  const L = libModel(id), want = stats(grid).voxels; let got = 0; for (const v of L.g) if (v) got++;
  ok(got === want, `${id}: decoded ${got} blocks, the file lays ${want}`);
  ok(MARK_LIST.some(([v]) => v === id), `${id} isn't offered in the picker`);
}

// each one stands on an island, on a small island and a full one, at 100% and at 200%
const world = (mark, growth, n) => buildWorld({ id: `m-${mark}-${growth}-${n}`, landmark: "academy", size: Math.sqrt(Math.max(3, n) / 6), E: 1, seed: 4, topics: Array.from({ length: n }, (_, k) => ({ name: "T" + k, biome: ["highland", "bloom", "fern", "tropical", "glowcap", "lantern"][k], growth: k === 1 ? growth : 0.3, health: 1, mark: k === 1 ? mark : "none" })) }, Math.round(104 * Math.sqrt(Math.max(3, n) / 6) / 2) * 2);
for (const id of ids) for (const g of [1, 2]) for (const n of [3, 6]) { const m = world(id, g, n).marks; ok(m.length === 1 && m[0].mark === id, `${id} at ${g * 100}% found no ground on a ${n}-topic island`); }

for (const [name, want] of [["Physics", "atom"], ["Leadership", "lectern"], ["Music", "synth"], ["Maths", "abacus"], ["World history", "ruined-temple"], ["Knitting", "yarn"], ["Organic chemistry", "flask"], ["Something else", "kit"]]) ok(guessMark(name) === want, `${name} guessed ${guessMark(name)}, want ${want}`);

if (failed) process.exit(1);
console.log(`PASS run17-marks (${ids.length} landmarks)`);
