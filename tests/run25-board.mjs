// Building on the Library's board: places are kept, Tab/Enter add with the name typed on the board, R renames,
// dragging moves an idea with what hangs from it, dropping it on another grafts it, the + knob pulls out a new idea
// or a link, Del deletes (Undo), right-click gives the menu, and graphs dragged in the Library stitch or move.
import { start, state } from "./lib.mjs";

const t = await start("run25-board", 4325, { channel: "beta" });
const page = await t.page({ viewport: { width: 1300, height: 860 } }, "#/notes");
await page.waitForSelector("body[data-ready]");
const tid = await state(page, () => bonsai.S.trees.find((x) => x.name === "Numbers").id);
await page.evaluate((id) => { location.hash = "#/notes/g:" + id; }, tid);
await page.waitForSelector(".gboard canvas"); await page.waitForTimeout(600);
const node = (title) => state(page, (title) => bonsai.S.nodes.find((n) => n.title === title), title);
const stored = (id) => state(page, async (id) => (await bonsai.store.exportAll()).nodes.find((n) => n.id === id), id);
const at = (id) => state(page, (id) => bonsai.S.board.screenOf(id), id);
const root = await state(page, (id) => bonsai.S.trees.find((x) => x.id === id).rootId, tid);

// every idea gets a place of its own the first time, and keeps it
await page.waitForFunction(async (id) => (await bonsai.store.exportAll()).nodes.filter((n) => n.treeId === id).every((n) => Array.isArray(n.xy)), tid);
t.eq(true, true, "every idea has its place saved");

// Tab adds under, the name typed on the board; Enter then offers one beside
await page.keyboard.press("Tab");
await page.waitForSelector("#boardAsk");
await page.keyboard.type("Primes"); await page.keyboard.press("Enter");
await page.waitForFunction(() => bonsai.S.nodes.some((n) => n.title === "Primes"));
const primes = await node("Primes");
t.eq(primes.parentId, root, "Tab adds under the first idea when nothing is picked");
t.eq(Array.isArray((await stored(primes.id)).xy), true, "where it sits is kept");
await page.waitForSelector("#boardAsk");
await page.keyboard.press("Escape");
t.eq(await page.$("#boardAsk"), null, "Esc leaves the next one unmade");
await page.screenshot({ path: "tests/shots/board-added.png" });

// pick it, rename it (R)
let p = await at(primes.id); await page.mouse.click(p.x, p.y);
t.eq(await state(page, () => bonsai.S.gsel), primes.id, "a click picks");
await page.keyboard.press("r"); await page.waitForSelector("#boardAsk");
await page.fill("#boardAsk", "Prime numbers"); await page.keyboard.press("Enter");
await page.waitForFunction((id) => bonsai.S.byId.get(id)?.title === "Prime numbers", primes.id);

// drag it somewhere: it moves, and stays
const before = (await stored(primes.id)).xy;
p = await at(primes.id);
await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 60, p.y + 90, { steps: 8 }); await page.mouse.up();
await page.waitForFunction(async ([id, x]) => (await bonsai.store.exportAll()).nodes.find((n) => n.id === id).xy[0] !== x, [primes.id, before[0]]);
const after = (await stored(primes.id)).xy;
if (Math.abs(after[0] - before[0] - 60 / 1) > 60 || after[1] === before[1]) t.fail(`dragging moves it: ${before} → ${after}`);

// drop it on Counting: grafted there
const counting = await node("Counting");
p = await at(primes.id); const q = await at(counting.id);
await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y, { steps: 10 }); await page.mouse.up();
await page.waitForFunction(([id, c]) => bonsai.S.byId.get(id)?.parentId === c, [primes.id, counting.id]);
t.eq(true, true, "dropping an idea on another grafts it there");
await page.click(".toast button"); 
await page.waitForFunction(([id, r]) => bonsai.S.byId.get(id)?.parentId === r, [primes.id, root]);
t.eq(true, true, "and Undo puts it back");

// the + knob: pull it out to empty paper for a new idea there
await page.waitForTimeout(300);
p = await at(primes.id); await page.mouse.click(p.x, p.y);
const kb = { x: p.x + 5 + 14, y: p.y - 5 - 14 };
await page.mouse.move(kb.x, kb.y); await page.mouse.down(); await page.mouse.move(kb.x + 120, kb.y - 40, { steps: 8 }); await page.mouse.up();
await page.waitForSelector("#boardAsk");
await page.keyboard.type("Sieve"); await page.keyboard.press("Enter");
await page.waitForFunction(() => bonsai.S.nodes.some((n) => n.title === "Sieve"));
t.eq((await node("Sieve")).parentId, primes.id, "the knob pulls out a new idea under the picked one");
await page.keyboard.press("Escape");
// and onto an idea for a link
await page.waitForTimeout(300);
p = await at(primes.id); await page.mouse.click(p.x, p.y);
const zero = await node("Zero"), z = await at(zero.id);
await page.mouse.move(p.x + 19, p.y - 19); await page.mouse.down(); await page.mouse.move(z.x, z.y, { steps: 10 }); await page.mouse.up();
await page.waitForFunction(([a, b]) => bonsai.S.links.some((l) => l.fromId === a && l.toId === b), [primes.id, zero.id]);
t.eq(true, true, "the knob dropped on an idea links them");
await page.screenshot({ path: "tests/shots/board-built.png" });

// right-click: the menu
p = await at(primes.id); await page.mouse.click(p.x, p.y, { button: "right" });
await page.waitForSelector(".menu");
t.eq((await page.$$eval(".menu .mi span", (s) => s.map((x) => x.textContent))).slice(0, 5), ["Add under", "Add beside", "Rename", "Link to…", "Graft onto…"], "right-click gives the idea's menu");
await page.keyboard.press("Escape");

// Del deletes it and what hangs from it; Undo brings them back
await page.mouse.click(p.x, p.y);
await page.keyboard.press("Delete");
await page.waitForFunction((id) => !bonsai.S.byId.get(id), primes.id);
await page.click(".toast button");
await page.waitForFunction(() => bonsai.S.nodes.some((n) => n.title === "Sieve"));
t.eq(true, true, "Del deletes and Undo restores");

// stitching: a graph dragged from the Library onto an idea on the board
if (!(await page.$("#glist"))) { await page.click("#lib-graphs"); await page.waitForSelector("#glist"); }
await page.click('#glist .nrow.shelf[data-shelf="i:found"] .nname');
await page.click('#glist .nrow.shelf[data-shelf^="t:"] >> text=Patterns');
const pat = await state(page, () => bonsai.S.trees.find((x) => x.name === "Patterns"));
const arith = await node("Arithmetic"), ar = await at(arith.id);
await page.dragAndDrop(`#glist .nrow.graph[data-tree="${pat.id}"]`, ".gboard canvas", { targetPosition: { x: ar.x - (await page.$eval(".gboard canvas", (c) => c.getBoundingClientRect().left)), y: ar.y - (await page.$eval(".gboard canvas", (c) => c.getBoundingClientRect().top)) } });
await page.waitForFunction((id) => !bonsai.S.trees.some((x) => x.id === id), pat.id);
t.eq((await state(page, (id) => bonsai.S.byId.get(id).parentId, pat.rootId)), arith.id, "a graph dropped on an idea is stitched there");
await page.screenshot({ path: "tests/shots/board-stitched.png" });
await page.click(".toast button");
await page.waitForFunction(() => bonsai.S.trees.some((x) => x.name === "Patterns"));
t.eq(true, true, "Undo makes it its own graph again");

// a graph dragged onto a topic moves there
const pat2 = await state(page, () => bonsai.S.trees.find((x) => x.name === "Patterns"));
const shapes = await state(page, () => bonsai.S.zones.find((z) => z.name === "Shapes and space").id);
await page.dragAndDrop(`#glist .nrow.graph[data-tree="${pat2.id}"]`, `#glist .nrow.shelf[data-shelf="t:${shapes}"]`);
await page.waitForFunction(([id, z]) => bonsai.S.trees.find((x) => x.id === id)?.zoneId === z, [pat2.id, shapes]);
t.eq(true, true, "a graph dropped on a topic moves there");

// Shift+Enter opens it in 3D
await page.keyboard.press("Shift+Enter");
await page.waitForFunction(() => bonsai.S.view === "tree");
await t.end();
