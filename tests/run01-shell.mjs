// The shell loads at phone and laptop sizes, is installable, takes control
// without reloading, works offline, and shows no leftover placeholder text.
import { readFileSync } from "node:fs";
import { start } from "./lib.mjs";

const t = await start("run01-shell", 4301);
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
for (const [name, viewport] of [["phone", { width: 390, height: 800 }], ["laptop", { width: 1280, height: 800 }]]) {
  let loads = 0;
  const page = await t.page({ viewport });
  page.on("load", () => loads++);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  await page.waitForTimeout(400);
  t.eq(loads, 0, `${name}: reloads after first visit`);
  t.eq(await page.evaluate(() => bonsaiShell.version), version, `${name}: version`);
  if (!(await page.isVisible("#zoneName"))) t.fail(`${name}: no first-zone form`);
  const text = await page.evaluate(() => document.body.innerText);
  if (/null|undefined|__[A-Z]+__/.test(text)) t.fail(`${name}: stray text on screen: ${text.slice(0, 80)}`);
  if (text.trim().split(/\s+/).length > 12) t.fail(`${name}: too much text on the empty screen (${text.trim().split(/\s+/).length} words)`);
  const manifest = await page.evaluate(async () => (await fetch("manifest.webmanifest")).json());
  if (manifest.display !== "standalone" || !manifest.icons.some((i) => i.sizes === "512x512")) t.fail("manifest incomplete");
  await page.screenshot({ path: `tests/shots/empty-${name}.png` });
  if (name === "phone") {
    await page.context().setOffline(true);
    await page.reload(); await page.waitForSelector("body[data-ready]");
    if (!(await page.isVisible("#zoneName"))) t.fail("doesn't load offline");
  }
  await page.context().close();
}
await t.end();
