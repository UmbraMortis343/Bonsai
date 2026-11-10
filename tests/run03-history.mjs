// Version history: the current version has a CHANGELOG entry, versions are
// valid and newest first, and the app links to the release history.
import { readFileSync } from "node:fs";

const fail = (m) => { console.error("FAIL run03:", m); process.exitCode = 1; };
const v = JSON.parse(readFileSync("package.json", "utf8")).version;
const log = readFileSync("CHANGELOG.md", "utf8");
const versions = [...log.matchAll(/^## (\d+\.\d+\.\d+) — \d{4}-\d{2}-\d{2}$/gm)].map((m) => m[1]);

if (!/^\d+\.\d+\.\d+$/.test(v)) fail(`package.json version "${v}" isn't x.y.z`);
if (versions[0] !== v) fail(`CHANGELOG's newest entry is ${versions[0]}, package.json is ${v}`);
const num = (s) => s.split(".").map(Number);
for (let i = 1; i < versions.length; i++) {
  const [a, b] = [num(versions[i - 1]), num(versions[i])];
  const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  if (newer <= 0) fail(`CHANGELOG out of order: ${versions[i - 1]} before ${versions[i]}`);
}
if (!readFileSync("src/main.js", "utf8").includes("github.com/UmbraMortis343/Bonsai/releases")) fail("no What's new link");
if (!process.exitCode) console.log("PASS run03 history");
