// Phone, touch only: open a tree from the forest, tap to select, add a branch
// from the action bar, tap again for notes in a bottom sheet.
import { start, seed, state } from "./lib.mjs";

const t = await start("run06-phone", 4306);
const page = await t.page({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
await seed(page);
await page.waitForSelector('.lbl.tree:text-is("Synthesis")');
await page.screenshot({ path: "tests/shots/forest-phone.png" });
await page.tap('.lbl.tree:text-is("Basic electronics")');
await page.waitForSelector(".lbl.trunk");

await page.tap('.lbl.node:text-is("Resistors")');
await page.waitForSelector('.lbl.sel:text-is("Resistors")');
if (await page.isVisible("#panel")) t.fail("first tap opened the notes");
await page.waitForSelector("#hover:not([hidden])");
if (!(await page.textContent("#hover")).includes("Limit current")) t.fail("first tap didn't show the short note");
const bar = await page.locator("#actions").boundingBox();
if (bar.x < 0 || bar.x + bar.width > 390) t.fail("action bar wider than the screen");

await page.tap('[data-act="add"]'); await page.fill("#quickInput", "Colour code"); await page.tap(".quick .btn.primary");
await page.waitForSelector('.lbl.sel:text-is("Colour code")');
t.eq(await state(page, () => bonsai.S.byId.get(bonsai.S.byId.get(bonsai.S.sel).parentId).title), "Resistors", "new branch parent");

await page.tap('.lbl.node:text-is("Resistors")'); await page.waitForSelector('.lbl.sel:text-is("Resistors")');
await page.tap('.lbl.node:text-is("Resistors")');
await page.waitForSelector("#panel:not([hidden]) #nodeTitle");
const box = await page.locator("#panel").boundingBox();
if (Math.abs(box.width - 390) > 2 || Math.abs(box.y + box.height - 800) > 2) t.fail("notes aren't a bottom sheet on the phone");
await page.waitForSelector("#nodeBodyView strong");
await page.screenshot({ path: "tests/shots/tree-phone.png" });

await page.tap("#panelClose");
await page.tap("#moreBtn"); await page.waitForSelector(".menu");
await page.tap('.mi:has-text("Patches")'); await page.waitForSelector("#patchText");
await page.tap("#panelClose"); await page.tap("#backBtn");
await page.waitForSelector('.lbl.tree:text-is("Op-amps")');
await t.end();
