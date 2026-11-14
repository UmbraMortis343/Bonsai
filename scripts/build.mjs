// Copies src/ to dist/ (or the folder given as the first argument), stamps the
// version from package.json into text files, and writes version.json.
// Usage: node scripts/build.mjs [outDir] [versionOverride] [channel]
// channel "beta" builds the test copy: its own name, database, settings and demo data.
import { readFile, writeFile, mkdir, readdir, rm, copyFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const out = join(root, process.argv[2] || "dist");
const version = process.argv[3] || pkg.version;
const channel = process.argv[4] === "beta" ? "beta" : "main";
const TEXT = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg"]);

await rm(out, { recursive: true, force: true });

async function copyDir(from, to) {
  await mkdir(to, { recursive: true });
  for (const e of await readdir(from, { withFileTypes: true })) {
    const a = join(from, e.name), b = join(to, e.name);
    if (e.isDirectory()) await copyDir(a, b);
    else if (TEXT.has(extname(e.name)) && !/vendor|models/.test(a)) {
      await writeFile(b, (await readFile(a, "utf8")).replaceAll("__VERSION__", version).replaceAll("__CHANNEL__", channel));
    } else await copyFile(a, b);
  }
}
await copyDir(join(root, "src"), out);
if (channel === "beta") {   // a separate name, so the beta installs as its own app
  const m = JSON.parse(await readFile(join(out, "manifest.webmanifest"), "utf8"));
  Object.assign(m, { name: "Bonsai Beta", short_name: "Bonsai β" }); await writeFile(join(out, "manifest.webmanifest"), JSON.stringify(m, null, 2));
  await writeFile(join(out, "index.html"), (await readFile(join(out, "index.html"), "utf8")).replace("<title>Bonsai</title>", "<title>Bonsai Beta</title>"));
}
// The service worker caches every file in the build for offline use.
// Big, optional files (the embedding model and its runtime) are fetched only when used.
const LAZY = ["models/", "vendor/ai/"];
async function listFiles(dir, base = "") {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!LAZY.includes(base + e.name + "/")) out.push(...await listFiles(join(dir, e.name), base + e.name + "/")); }
    else if (!["sw.js", "index.html"].includes(base + e.name) && !e.name.endsWith(".txt")) out.push(base + e.name);
  }
  return out;
}
const files = ["./", "index.html", ...(await listFiles(out)).sort()];
await writeFile(join(out, "sw.js"), (await readFile(join(out, "sw.js"), "utf8")).replace("__FILES__", JSON.stringify(files)));
await writeFile(join(out, "version.json"), JSON.stringify({ version, builtAt: new Date().toISOString() }) + "\n");
// GitHub Pages: serve files as-is.
await writeFile(join(out, ".nojekyll"), "");
console.log(`Built Bonsai ${channel === "beta" ? "beta " : ""}${version} → ${out}`);
