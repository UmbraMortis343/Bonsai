// Copies src/ to dist/ (or the folder given as the first argument), stamps the
// version from package.json into text files, and writes version.json.
// Usage: node scripts/build.mjs [outDir] [versionOverride]
import { readFile, writeFile, mkdir, readdir, rm, copyFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const out = join(root, process.argv[2] || "dist");
const version = process.argv[3] || pkg.version;
const TEXT = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg"]);

await rm(out, { recursive: true, force: true });

async function copyDir(from, to) {
  await mkdir(to, { recursive: true });
  for (const e of await readdir(from, { withFileTypes: true })) {
    const a = join(from, e.name), b = join(to, e.name);
    if (e.isDirectory()) await copyDir(a, b);
    else if (TEXT.has(extname(e.name))) {
      await writeFile(b, (await readFile(a, "utf8")).replaceAll("__VERSION__", version));
    } else await copyFile(a, b);
  }
}
await copyDir(join(root, "src"), out);
await writeFile(join(out, "version.json"), JSON.stringify({ version, builtAt: new Date().toISOString() }) + "\n");
// GitHub Pages: serve files as-is.
await writeFile(join(out, ".nojekyll"), "");
console.log(`Built Bonsai ${version} → ${out}`);
