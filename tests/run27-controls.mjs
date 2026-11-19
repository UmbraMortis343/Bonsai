// The controls revamp: one set of rules. In the knowledge rings a click picks a graph and a double-click opens it;
// right-click gives a graph's or an idea's menu; on the board a link can be picked, deleted with Del (Undo) or from
// its menu; the card lists links with a delete; V is the other view everywhere; Shift+Tab from the garden shows
// what's picked there; no fly keys.
import { start, state } from "./lib.mjs";

const t = await start("run27-controls", 4327, { channel: "beta" });
const page = await t.page({ viewport: { width: 1300, height: 860 } }, "#/forest");
await page.waitForSelector("body[data-ready]"); await page.waitForFunction(() => bonsai.S.view === "forest" && bonsai.S.forest);
await page.waitForTimeout(1500);

// rings: click picks, double-click opens
const lbl = await page.$eval('.lbl.tree:has-text("Numbers")', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, e.dataset.id]; }).catch(() => null);
if (lbl) {
  await page.mouse.click(lbl[0], lbl[1]);
  t.eq(await state(page, () => [bonsai.S.view, bonsai.S.fsel]), ["forest", lbl[2]], "a click on a graph picks it");
  await page.mouse.click(lbl[0], lbl[1], { button: "right" }); await page.waitForSelector(".menu");
  t.eq(await page.textContent(".menu .mi >> nth=0"), "Open↵", "right-click gives the graph's menu");
  await page.keyboard.press("Escape");
  await page.mouse.dblclick(lbl[0], lbl[1]);
  await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.tree?.id === id, lbl[2]);
  t.eq(true, true, "a double-click opens it");
} else t.fail("couldn't find the Numbers graph's name");

// in a graph: right-click an idea for its menu; V takes it to the board
await page.waitForTimeout(800);
const sp = await state(page, () => { const id = bonsai.S.byNum[1], p = bonsai.stage.screenOf(bonsai.S.flora.pos.get(id)), r = bonsai.stage.container.getBoundingClientRect(); return { id, x: r.left + p.x, y: r.top + p.y }; });
await page.mouse.click(sp.x, sp.y, { button: "right" }); await page.waitForSelector(".menu");
const items = await page.$$eval(".menu .mi span", (s) => s.map((x) => x.textContent));
t.eq(["Add under", "Rename", "Link to…", "Graft onto…", "On the board"].every((x) => items.includes(x)), true, "right-click on an idea gives its menu");
await page.keyboard.press("Escape");
t.eq(await state(page, (id) => bonsai.S.sel, sp.id), sp.id, "and picks it");
const r0 = await state(page, () => bonsai.stage.target.x);
await page.keyboard.down("d"); await page.waitForTimeout(400); await page.keyboard.up("d");
t.eq(await state(page, () => bonsai.stage.target.x), r0, "WASD no longer fly");
await page.keyboard.press("v");
await page.waitForFunction(() => bonsai.S.view === "notes" && bonsai.S.board);
t.eq(await state(page, () => bonsai.S.gsel), sp.id, "V opens the graph on the board with the same idea picked");

// links on the board: pick one, Del deletes it, Undo brings it back
await page.waitForTimeout(500);
const tid = await state(page, () => bonsai.S.boardTree);
const link = await state(page, (tid) => { const ids = new Set(bonsai.S.nodes.filter((n) => n.treeId === tid).map((n) => n.id)); return bonsai.S.links.find((l) => ids.has(l.fromId) && ids.has(l.toId)); }, tid);
let at = await state(page, (id) => bonsai.S.board.linkAt(id), link.id);
await page.mouse.click(at.x, at.y);
t.eq(await state(page, () => bonsai.S.glink), link.id, "a click on a link picks it");
t.eq(await page.isVisible("#gLinkDel"), true, "the foot offers Delete link");
await page.screenshot({ path: "tests/shots/controls-link.png" });
await page.keyboard.press("Delete");
await page.waitForFunction((id) => !bonsai.S.links.some((l) => l.id === id), link.id);
await page.click(".toast button");
await page.waitForFunction(([a, b]) => bonsai.S.links.some((l) => l.fromId === a && l.toId === b), [link.fromId, link.toId]);
t.eq(true, true, "Del deletes the picked link and Undo brings it back");
// right-click a link: its menu
await page.waitForTimeout(300);
const back = await state(page, ([a, b]) => bonsai.S.links.find((l) => l.fromId === a && l.toId === b).id, [link.fromId, link.toId]);
at = await state(page, (id) => bonsai.S.board.linkAt(id), back);
await page.mouse.click(at.x, at.y, { button: "right" }); await page.waitForSelector(".menu");
t.eq(await page.$$eval(".menu .mi span", (s) => s.map((x) => x.textContent).slice(1)), ["Label…", "Delete link"], "right-click on a link gives Label and Delete");
await page.click('.menu .mi:has-text("Delete link")');
await page.waitForFunction((id) => !bonsai.S.links.some((l) => l.id === id), back);
await page.click(".toast button");
await page.waitForFunction(([a, b]) => bonsai.S.links.some((l) => l.fromId === a && l.toId === b), [link.fromId, link.toId]);
// the card lists an idea's links, each with a delete
await state(page, (id) => bonsai.S.boardPick(id), link.fromId);
await page.waitForSelector("#gcard .linkrow");
const n0 = await state(page, () => bonsai.S.links.length);
await page.click("#gcard .linkrow .ib >> nth=0");
await page.waitForFunction((n) => bonsai.S.links.length === n - 1, n0);
t.eq(true, true, "the card's × deletes a link");

// Shift+Tab from the garden shows what's picked there
await page.evaluate(() => { location.hash = "#/"; }); await page.waitForFunction(() => bonsai.S.view === "isles");
await page.keyboard.press("1"); await page.waitForTimeout(300); await page.keyboard.press("1"); await page.waitForTimeout(300);
const picked = await state(page, () => { const isl = bonsai.S.model[bonsai.S.isle]; return isl?.topics[bonsai.S.topic]?.id || isl?.id; });
await page.keyboard.press("Shift+Tab");
await page.waitForFunction(() => bonsai.S.view === "forest");
t.eq(await state(page, () => bonsai.S.fscope?.id), picked, "Shift+Tab from the garden shows what's picked in Knowledge");

// "/" goes anywhere in one step: a graph to its board, then the board's path back to the garden in one click
await page.keyboard.press("/"); await page.waitForSelector("#gotoInput");
await page.keyboard.type("newton");
t.eq(await page.$eval("#gotoList .res .gk", (e) => e.textContent), "Graph", "a graph comes before its ideas");
await page.keyboard.press("Enter");
await page.waitForFunction(() => bonsai.S.view === "notes" && bonsai.S.board && bonsai.S.trees.find((x) => x.id === bonsai.S.boardTree)?.name === "Newton's laws");
t.eq(true, true, "Enter goes straight to its board");
await page.click(".pcrumb .sl0.link >> nth=1");
await page.waitForFunction(() => bonsai.S.view === "isles" && bonsai.S.model[bonsai.S.isle]?.topics[bonsai.S.topic]?.name === "Mechanics");
t.eq(true, true, "the topic in the board's path opens it in the garden");
await page.keyboard.press("/"); await page.keyboard.type("Inertia"); await page.keyboard.press("Enter");
await page.waitForFunction(() => bonsai.S.view === "tree" && bonsai.S.byId.get(bonsai.S.sel)?.title === "Inertia");
t.eq(true, true, "an idea opens in its graph, picked");

// the shortcuts list is grouped
await page.keyboard.press("?"); await page.waitForSelector(".keygroups");
t.eq(await page.$$eval(".keygroups h3", (h) => h.map((x) => x.textContent)), ["Everywhere", "Building a graph", "Garden", "Tech tree", "Notes"], "one list of rules, grouped");
await page.screenshot({ path: "tests/shots/controls-keys.png" });
await t.end();
