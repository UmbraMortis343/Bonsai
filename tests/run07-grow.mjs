// Review grows roots, patches and stitching, the timeline, the inbox, grafting
// between trees, and merging a zone then splitting it back.
import { start, seed, openTree, state } from "./lib.mjs";

const t = await start("run07-grow", 4307);
const page = await t.page();
const ids = await seed(page);
const key = (k) => page.keyboard.press(k);

// Nothing is due on day one; a day later the forest shows what's due.
if (await page.isVisible("#reviewBtn")) t.fail("review due on the first day");
await page.evaluate(async () => {
  const b = await bonsai.store.exportAll(), old = new Date(Date.now() - 3 * 86400000).toISOString();
  b.nodes.forEach((n, i) => { n.createdAt = new Date(Date.parse(old) + (n.parentId === null ? 0 : (i + 1) * 60000)).toISOString(); });
  await bonsai.store.importAll(b); await bonsai.refresh();
});
await page.waitForSelector("#reviewBtn");
await openTree(page, ids.basic);
const due = await state(page, () => document.querySelector("#reviewBtn").textContent);
t.eq(due, "Review 3", "due in this tree");   // trunk, Resistors, Capacitors have something to recall
const limbsBefore = await state(page, () => bonsai.S.flora.limbMesh.count);
await page.click("#reviewBtn"); await page.waitForSelector("#showAnswer");
t.eq(await state(page, () => document.querySelectorAll(".lbl:not([style*='display: none'])").length), 1, "labels shown during review");
for (let i = 0; i < 3; i++) { await key(" "); await page.waitForSelector(".rate"); await key("3"); await page.waitForFunction((n) => !bonsai.S.review || bonsai.S.review.i === n, i + 1); }
await page.waitForSelector("#review", { state: "hidden" });
t.eq(await state(page, () => bonsai.S.nodes.reduce((a, n) => a + (n.srs?.passes || 0), 0)), 3, "passes");
if (!((await state(page, () => bonsai.S.flora.limbMesh.count)) > limbsBefore)) t.fail("roots didn't grow after passing reviews");
if (await page.isVisible("#reviewBtn")) t.fail("still due after reviewing");
await page.waitForTimeout(500); await page.screenshot({ path: "tests/shots/tree-roots.png" });

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
