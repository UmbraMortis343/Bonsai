// Builds the Bonsai Exams page (a page inside Claude) from page.html, with the app's exam logic and the
// paper logic written into it, so the page and the app read maps the same way.
//   node tools/exams/build.mjs [out.html]     then publish the file as the Bonsai Exams artifact
// The maps in tools/exams/maps are written into the page. A map can also be added or replaced without a rebuild,
// as a row { text } in the page's `maps` collection:
//   node tools/exams/build.mjs --seed         prints the maps as such rows
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readMap, checkMaps } from "../../src/exams.js";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "../..");
const maps = readdirSync(join(here, "maps")).filter((f) => f.endsWith(".txt")).map((f) => ({ text: readFileSync(join(here, "maps", f), "utf8") })).map((m) => ({ ...m, map: readMap(m.text) }));
for (const topic of new Set(maps.map((m) => m.map.topic))) { const bad = checkMaps(maps.filter((m) => m.map.topic === topic).map((m) => m.map)); if (bad.length) { console.error(bad.join("\n")); process.exit(1); } }

if (process.argv[2] === "--seed") {
  console.log(JSON.stringify(maps.map((m) => ({ op: "set", path: "maps/" + m.map.id, data: { id: m.map.id, topic: m.map.topic, tier: m.map.tier, order: m.map.order, text: m.text } }))));
} else {
  const strip = (src) => src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
  const logic = strip(readFileSync(join(root, "src/exams.js"), "utf8")) + "\n" + strip(readFileSync(join(root, "src/paper.js"), "utf8"));
  const out = process.argv[2] || join(here, "dist/index.html"); mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, readFileSync(join(here, "page.html"), "utf8").replace("/*__LOGIC__*/", () => logic).replace("/*__MAPS__*/[]", () => JSON.stringify(maps.map((m) => m.text)).replace(/</g, "\\u003c")));
  console.log(`exams page → ${out} (${maps.length} maps)`);
}
