// Smoke test: the shell loads at phone and laptop sizes, the manifest is valid,
// the service worker takes control, and the app works offline.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { serve } from "../scripts/serve.mjs";

const PORT = 4301, URL = `http://localhost:${PORT}/Bonsai/`;
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
execFileSync("node", ["scripts/build.mjs", "tests/.out/shell"], { stdio: "ignore" });
mkdirSync("tests/shots", { recursive: true });
const server = await serve(() => "tests/.out/shell", PORT);
const browser = await chromium.launch();
const fail = (m) => { console.error("FAIL run01:", m); process.exitCode = 1; };

try {
  for (const [name, vp] of [["phone", { width: 390, height: 800 }], ["laptop", { width: 1280, height: 800 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let loads = 0;
    page.on("load", () => loads++);
    await page.goto(URL);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
    await page.waitForTimeout(500);
    if (loads !== 1) fail(`${name}: first visit reloaded the page (${loads} loads)`);
    if ((await page.textContent("#ver")).trim() !== version) fail(`${name}: version shown isn't ${version}`);
    if (!(await page.isVisible("text=Start with a zone"))) fail(`${name}: empty state missing`);
    if (errors.length) fail(`${name}: page errors: ${errors.join("; ")}`);
    const manifest = await page.evaluate(async () => (await fetch("manifest.webmanifest")).json());
    if (manifest.display !== "standalone" || !manifest.icons.some((i) => i.sizes === "512x512")) fail("manifest incomplete");
    await page.screenshot({ path: `tests/shots/shell-${name}.png` });

    if (name === "phone") {
      // Reload once so the worker controls the page, then go offline.
      await page.reload();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await ctx.setOffline(true);
      await page.reload();
      if (!(await page.isVisible("text=Start with a zone"))) fail("doesn't load offline");
      await ctx.setOffline(false);
    }
    await ctx.close();
  }
} finally {
  await browser.close(); server.close();
}
if (!process.exitCode) console.log("PASS run01 shell");
