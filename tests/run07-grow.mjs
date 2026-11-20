// Review grows roots, patches and stitching, the timeline, the inbox, grafting
// between trees, and merging a zone then splitting it back.
import { start, seed, openTree, state } from "./lib.mjs";

const t = await start("run07-grow", 4307);
const page = await t.page();
const ids = await seed(page);
const key = (k) => page.keyboard.press(k);

// Nothing is thirsty on day one; a few days later the garden shows what is.
if (await page.isVisible("#winGarden .thirst")) t.fail("something thirsty on the first day");
await page.evaluate(async () => {
  const b = await bonsai.store.exportAll(), old = new Date(Date.now() - 3 * 86400000).toISOString();
  b.nodes.forEach((n, i) => { n.createdAt = new Date(Date.parse(old) + (n.parentId === null ? 0 : (i + 1) * 60000)).toISOString(); });
  await bonsai.store.importAll(b); await bonsai.refresh();
});
t.eq(await page.textContent("#winGarden .thirst"), "5", "thirsty count on the Garden button");   // 3 trunks, Resistors, Capacitors
await page.click("#winGarden");
await page.waitForFunction(() => bonsai.S.view === "isles"); await page.waitForSelector("#waterAll");
t.eq(await state(page, () => location.hash), "#/", "the switch opens the garden");
await page.click("#waterAll"); await page.waitForSelector("#showAnswer");
t.eq(await state(page, () => [bonsai.S.view, bonsai.S.review.ids.length]), ["isles", 5], "Water starts a round where you are");
await key("Escape"); await page.waitForSelector("#review", { state: "hidden" });

// a graph waters from its own bar (W), and its menu has All good
await openTree(page, ids.basic); await page.waitForSelector("#waterTree");
t.eq(await page.textContent("#waterTree .thirst"), "3", "thirsty in this graph");
await key("w"); await page.waitForSelector("#showAnswer");
for (let i = 0; i < 3; i++) { await key(" "); await page.waitForSelector(".rate"); await key("3"); await page.waitForFunction((n) => !bonsai.S.review || bonsai.S.review.i === n, i + 1); }
await page.waitForSelector("#review", { state: "hidden" });
const passes = () => state(page, () => bonsai.S.nodes.reduce((a, n) => a + (n.srs?.passes || 0), 0));
t.eq(await passes(), 3, "passes after watering");
if (await page.$("#waterTree")) t.fail("graph still thirsty after watering");
await state(page, (id) => bonsai.openTree(id), ids.op); await page.waitForSelector("#waterTree");
const opItems = await state(page, (id) => bonsai.graphItems(bonsai.S.trees.find((x) => x.id === id)).filter(Boolean).map((x) => x.label), ids.op);
if (!opItems.includes("All good")) t.fail("All good not in the graph's menu");
await state(page, (id) => bonsai.graphItems(bonsai.S.trees.find((x) => x.id === id)).find((x) => x?.label === "All good").run(), ids.op);
await page.waitForFunction(() => !document.querySelector("#waterTree"));
t.eq(await passes(), 4, "passes after All good");
await page.click("#toast .link"); await page.waitForSelector("#waterTree");
t.eq(await passes(), 3, "passes after undo");
await page.keyboard.press("Escape");

// a graph carries no roots or fading
await openTree(page, ids.basic);
t.eq(await state(page, () => [bonsai.S.flora.limbMesh.count, bonsai.S.flora.ids.length]), [8, 9], "a stick between ideas and nothing else: none down to the ground");
if (await page.$("#reviewBtn")) t.fail("review button in the knowledge window");

// The old Patches panel went with the Sunday session (run36-sunday): P opens nothing.
await key("p"); await page.waitForTimeout(150);
if (await page.$("#patchText")) t.fail("P still opens the old Patches panel");
// old patches are still kept (and backed up)
await state(page, async (id) => { for (const text of ["Resistors drop voltage", "Capacitors resist change"]) await bonsai.store.addPatch({ treeId: id, text, nodeIds: [] }); }, ids.basic);

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
await page.evaluate(() => { location.hash = "#/forest"; });
await page.waitForSelector(".lbl.zone");
await key("i"); await page.fill("#f-text", "Kirchhoff's laws"); await key("Enter");
await page.click("#inboxBtn"); await page.click('.inboxrow .btn'); await page.keyboard.type("Sources"); await page.waitForSelector(".res"); await key("Enter");
await page.waitForFunction(() => bonsai.S.inbox.length === 0);
t.eq(await state(page, () => { const n = bonsai.S.nodes.find((x) => x.title === "Kirchhoff's laws"); return bonsai.S.byId.get(n.parentId).title; }), "Sources", "filed under");
await key("Escape");

// Merge the zone into one tree, then split a grafted tree back out.
await page.click('.lbl.zone:text-is("Electronics")'); await page.click('.mi:has-text("Merge into one graph")');
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
t.eq(backup, [5, 2, true], "backup");
await page.waitForTimeout(700); await page.screenshot({ path: "tests/shots/forest-laptop.png" });
await t.end();
