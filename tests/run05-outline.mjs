// Outline view: add a zone, plant a tree with a core idea, branch, rename,
// delete with a second tap, and everything is still there after a reload.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { serve } from "../scripts/serve.mjs";

const PORT = 4305, URL = `http://localhost:${PORT}/Bonsai/`;
execFileSync("node", ["scripts/build.mjs", "tests/.out/outline"], { stdio: "ignore" });
mkdirSync("tests/shots", { recursive: true });
const server = await serve(() => "tests/.out/outline", PORT);
const browser = await chromium.launch();
let failed = false;
const fail = (m) => { console.error("FAIL run05:", m); failed = true; };
const check = async (cond, m) => { if (!(await cond)) fail(m); };

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForSelector("text=Start with a zone");

  await page.fill('[data-form="zone"] input[name="name"]', "Electronics");
  await page.click('[data-form="zone"] button');
  await page.waitForSelector(".zone h2:text('Electronics')");

  await page.fill('[data-form="plant"] input[name="name"]', "Basic electronics");
  await page.fill('[data-form="plant"] input[name="core"]', "Ohm's law");
  await page.click('[data-form="plant"] button');
  await page.waitForSelector(".tree-head h1:text('Basic electronics')");
  await check(page.isVisible(".trunk-node .node-title:text(\"Ohm's law\")"), "trunk not shown as the core idea");

  // Branch from the trunk, then branch again.
  const addUnder = async (parent, title) => {
    const row = page.locator(`li.node:has(> .node-row .node-title:text-is("${parent}"))`).first();
    if (!(await row.evaluate((el) => el.classList.contains("sel")))) await row.locator("> .node-row").click();
    await page.click('[data-act="add"]');
    await page.fill('[data-form="add"] input', title);
    await page.press('[data-form="add"] input', "Enter");
    await page.waitForSelector(`.node-title:text-is("${title}")`);
  };
  await addUnder("Ohm's law", "Resistors");
  await addUnder("Resistors", "Series");
  await addUnder("Resistors", "Parallel");
  await check(page.isVisible(".tree-head .muted:text('4 ideas')"), "idea count wrong");
  await page.screenshot({ path: "tests/shots/outline-phone.png", fullPage: true });

  // Rename
  await page.click('.node-row:has(.node-title:text-is("Series"))');
  await page.click('.node-row:has(.node-title:text-is("Parallel"))');
  await page.click('[data-act="rename"]');
  await page.fill('[data-form="rename"] input', "Parallel circuits");
  await page.press('[data-form="rename"] input', "Enter");
  await page.waitForSelector('.node-title:text-is("Parallel circuits")');

  // Delete needs two taps.
  await page.click('.node-row:has(.node-title:text-is("Series"))');
  await page.click('[data-act="delete"]');
  await check(page.isVisible('.node-title:text-is("Series")'), "deleted on the first tap");
  await page.click('[data-act="delete"]');
  await page.waitForSelector('.node-title:text-is("Series")', { state: "detached" });

  // Survives reload
  await page.reload();
  await page.waitForSelector('.node-title:text-is("Parallel circuits")');
  await check(page.isVisible(".tree-head .muted:text('3 ideas')"), "lost ideas after reload");

  // Back to the forest shows the tree with its size
  await page.click("text=← Forest");
  await page.waitForSelector(".tree-row:has-text('Basic electronics'):has-text('3 ideas')");
  await page.screenshot({ path: "tests/shots/home-phone.png", fullPage: true });

  const lap = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const lp = await lap.newPage(); await lp.goto(URL); await lp.waitForSelector("text=Start with a zone");
  await lp.screenshot({ path: "tests/shots/home-laptop-empty.png" });
  await lap.close();
  if (errors.length) fail("page errors: " + errors.join("; "));
} finally {
  await browser.close(); server.close();
}
if (failed) process.exit(1);
console.log("PASS run05 outline");
