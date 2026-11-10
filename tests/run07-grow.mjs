// Review grows roots, patches and stitching, the timeline, the inbox, grafting
// between trees, and merging a zone then splitting it back.
import { start, seed, openTree, state } from "./lib.mjs";

const t = await start("run07-grow", 4307);
const page = await t.page();
const ids = await seed(page);
const key = (k) => page.keyboard.press(k);

// Nothing is thirsty on day one; a few days later the garden shows what is.
if (await page.isVisible("#switchBtn .thirst")) t.fail("something thirsty on the first day");
await page.evaluate(async () => {
  const b = await bonsai.store.exportAll(), old = new Date(Date.now() - 3 * 86400000).toISOString();
  b.nodes.forEach((n, i) => { n.createdAt = new Date(Date.parse(old) + (n.parentId === null ? 0 : (i + 1) * 60000)).toISOString(); });
  await bonsai.store.importAll(b); await bonsai.refresh();
});
t.eq(await page.textContent("#switchBtn .thirst"), "5", "thirsty count on the Garden button");   // 3 trunks, Resistors, Capacitors
await page.keyboard.press("Shift+Tab");
await page.waitForSelector("#waterAll");
t.eq(await state(page, () => [bonsai.S.view, location.hash]), ["garden", "#/garden"], "Shift+Tab opens the garden");
await page.click('.lbl.tree:has-text("Basic electronics")');
await page.waitForSelector("#waterBtn");
t.eq(await page.textContent("#waterBtn"), "Water 3", "thirsty in this plant");
const limbsBefore = await state(page, () => bonsai.S.flora.limbMesh.count);
await page.screenshot({ path: "tests/shots/garden-thirsty.png" });
await page.click("#waterBtn"); await page.waitForSelector("#showAnswer");
for (let i = 0; i < 3; i++) { await key(" "); await page.waitForSelector(".rate"); await key("3"); await page.waitForFunction((n) => !bonsai.S.review || bonsai.S.review.i === n, i + 1); }
await page.waitForSelector("#review", { state: "hidden" });
const passes = () => state(page, () => bonsai.S.nodes.reduce((a, n) => a + (n.srs?.passes || 0), 0));
t.eq(await passes(), 3, "passes after watering");
if (!((await state(page, () => bonsai.S.flora.limbMesh.count)) > limbsBefore)) t.fail("roots didn't grow after watering");
t.eq(await page.textContent("#waterBtn"), "Practise", "plant still thirsty after watering");

// "All good" passes a whole plant in one tap, and can be undone.
await page.click('.lbl.tree:has-text("Op-amps")'); await page.waitForSelector("#allGood");
await page.click("#allGood"); await page.waitForFunction(() => !document.querySelector("#allGood"));
t.eq(await passes(), 4, "passes after All good");
await page.click("#toast .link"); await page.waitForSelector("#allGood");
t.eq(await passes(), 3, "passes after undo");
await page.waitForTimeout(500); await page.screenshot({ path: "tests/shots/garden-laptop.png" });

// Back in the knowledge window the trees carry no roots or fading.
await page.keyboard.press("Shift+Tab");
await page.waitForSelector("#addBtn");
t.eq(await state(page, () => bonsai.S.view), "forest", "Shift+Tab returns to knowledge");
await openTree(page, ids.basic);
t.eq(await state(page, () => [bonsai.S.flora.limbMesh.count, bonsai.S.flora.ids.length]), [9, 9], "knowledge tree has no roots");
if (await page.$("#reviewBtn")) t.fail("review button in the knowledge window");

// Patches attach to the ideas they mention; a stitch lands in the trunk's notes.
await key("p"); await page.fill("#patchText", "Resistors drop voltage in proportion"); await page.click('.stack .btn.primary');
await page.waitForSelector('.patch .chip:text-is("Resistors")');
await page.fill("#patchText", "Capacitors resist sudden change"); await page.click('.stack .btn.primary');
await page.waitForFunction(() => document.querySelectorAll(".patch").length === 2);
await page.click("#stitchBtn"); await page.fill("#stitchText", "Everything is a ratio of voltages"); await page.click('.stack .btn.primary');
await page.waitForSelector("#nodeBodyView");
if (!(await state(page, () => bonsai.S.byId.get(bonsai.S.tree.rootId).body)).includes("Everything is a ratio")) t.fail("stitch not saved to the trunk");
await key("Escape");

// Timeline: at the start only the trunk exists.
await key("t"); await page.waitForSelector("#timeRange");
await page.evaluate(() => { const r = document.querySelector("#timeRange"); r.value = r.min; r.dispatchEvent(new Event("input")); });
t.eq(await state(page, () => bonsai.S.flora.ids.length), 1, "ideas at the start of the timeline");
await key("Escape");
t.eq(await state(page, () => bonsai.S.flora.ids.length), 9, "ideas after closing the timeline");

// Graft a branch onto another tree, then undo.
await page.click('.lbl.node:text-is("Capacitors")'); await key("Escape");
await key("g"); await page.waitForSelector("#pickInput"); await page.keyboard.type("Golden"); await page.waitForSelector(".res"); await key("Enter");
await page.waitForSelector('.lbl.node:text-is("Capacitors")', { state: "detached" });
t.eq(await state(page, () => [bonsai.S.byTree.get(bonsai.S.tree.id).length, bonsai.S.nodes.find((n) => n.title === "Charge").treeId !== bonsai.S.tree.id]), [6, true], "after graft");
await page.click("#toast .link"); await page.waitForSelector('.lbl.node:text-is("Charge")');

// Inbox: capture, then file under an idea.
await key("Escape");
await page.waitForSelector(".lbl.zone");
await key("i"); await page.fill("#f-text", "Kirchhoff's laws"); await key("Enter");
await page.click("#inboxBtn"); await page.click('.inboxrow .btn'); await page.keyboard.type("Sources"); await page.waitForSelector(".res"); await key("Enter");
await page.waitForFunction(() => bonsai.S.inbox.length === 0);
t.eq(await state(page, () => { const n = bonsai.S.nodes.find((x) => x.title === "Kirchhoff's laws"); return bonsai.S.byId.get(n.parentId).title; }), "Sources", "filed under");
await key("Escape");

// Merge the zone into one tree, then split a grafted tree back out.
await page.click('.lbl.zone:text-is("Electronics")'); await page.click('.mi:has-text("Merge into one tree")');
await page.waitForSelector(".dialog"); await page.click(".dialog .btn.primary");
await page.waitForSelector('.lbl.node:text-is("Negative feedback")');
t.eq(await state(page, () => bonsai.S.trees.length), 2, "trees after merge");
await page.screenshot({ path: "tests/shots/tree-merged.png" });
await page.click('.lbl.node:text-is("Negative feedback")'); await key("Escape");
await page.click("#nodeMore"); await page.click('.mi:has-text("Split Op-amps back out")');
await page.waitForSelector('.lbl.node:text-is("Negative feedback")', { state: "detached" });
t.eq(await state(page, () => bonsai.S.trees.map((x) => x.name).sort()), ["Basic electronics", "Op-amps", "Synthesis"], "trees after split");

// Archive and restore a tree; back up and check the backup holds everything.
await page.click("#moreBtn"); await page.click('.mi:has-text("Archive")');
await page.waitForSelector(".lbl.zone");
t.eq(await state(page, () => bonsai.S.trees.length), 2, "trees after archive");
await page.click("#moreBtn"); await page.click('.mi:has-text("Archived")'); await page.click('.mi:has-text("Restore Basic electronics")');
await page.waitForFunction(() => bonsai.S.trees.length === 3);
const backup = await state(page, async () => { const b = await bonsai.store.exportAll(); return [b.schema, b.patches.length, b.nodes.length > 10]; });
t.eq(backup, [2, 2, true], "backup");
await page.waitForTimeout(700); await page.screenshot({ path: "tests/shots/forest-laptop.png" });
await t.end();
