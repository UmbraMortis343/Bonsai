// Update flow: install version A, publish version B on the same address, and
// check the app shows "Update to B", and that tapping it switches to B.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { serve } from "../scripts/serve.mjs";

const PORT = 4302, URL = `http://localhost:${PORT}/Bonsai/`;
const A = "0.0.1-testa", B = "0.0.2-testb";
execFileSync("node", ["scripts/build.mjs", "tests/.out/a", A], { stdio: "ignore" });
execFileSync("node", ["scripts/build.mjs", "tests/.out/b", B], { stdio: "ignore" });
let dir = "tests/.out/a";
const server = await serve(() => dir, PORT);
const browser = await chromium.launch();
const fail = (m) => { console.error("FAIL run02:", m); process.exitCode = 1; };

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  const ver = () => page.evaluate(() => bonsaiShell.version);
  await page.goto(URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  if ((await ver()) !== A) fail("didn't start on version A");
  if (await page.isVisible("#updateBar")) fail("update bar showing with no update");
  if ((await page.evaluate(() => bonsaiShell.check())) !== "latest") fail("check doesn't report latest");

  // Release B
  dir = "tests/.out/b";
  await page.evaluate(() => bonsaiShell.check());
  await page.waitForSelector("#updateBar:not([hidden])", { timeout: 10000 }).catch(() => fail("update bar never appeared"));
  const label = (await page.textContent("#updateBtn")).trim();
  if (label !== `Update to ${B}`) fail(`button says "${label}"`);
  await page.screenshot({ path: "tests/shots/update-ready.png" });

  await Promise.all([page.waitForEvent("load"), page.click("#updateBtn")]);
  await page.waitForFunction((v) => window.bonsaiShell?.version === v, B, { timeout: 10000 }).catch(() => fail("still on the old version after Update"));
  if (await page.isVisible("#updateBar")) fail("update bar still showing after updating");
  await ctx.close();
} finally {
  await browser.close(); server.close();
}
if (!process.exitCode) console.log("PASS run02 update");
