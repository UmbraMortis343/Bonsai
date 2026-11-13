// Usage: node render.mjs <landmark.mjs> <out.png>     Builds the landmark and saves a picture of it from two sides.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { makeGrid, picture, stats } from "./kit.mjs";
const [file, out] = process.argv.slice(2);
if (!file || !out) { console.error("usage: node render.mjs <landmark.mjs> <out.png>"); process.exit(2); }
try {
  const mod = await import(pathToFileURL(resolve(file)).href + "?t=" + Date.now()), grid = makeGrid();
  if (typeof mod.default !== "function") throw new Error("the file must `export default function build(a) { ... }`");
  mod.default(grid.a); picture(grid, out); console.log(JSON.stringify(stats(grid)));
} catch (e) { console.error("FAILED:", e.message); process.exit(1); }
