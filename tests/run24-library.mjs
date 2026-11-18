// The Library: the notes sidebar holds Notes, Graphs (island › topic › graph) and Watering, each folding away.
// A graph opens on a 2D board in the main area: numbers pick, Enter or double-click opens it in its graph,
// what needs water is ringed in ochre. Every idea is the same size. On the beta, H in the knowledge view marks
// what needs water in ochre.
import { start, state } from "./lib.mjs";

const t = await start("run24-library", 4324, { channel: "beta" });
const page = await t.page({ viewport: { width: 1300, height: 860 } }, "#/notes");
await page.waitForSelector("body[data-ready]"); await page.waitForTimeout(500);

t.eq(await page.$$eval(".lhead", (h) => h.map((x) => x.childNodes[1].textContent)), ["Notes", "Graphs", "Watering"], "the Library has Notes, Graphs and Watering");
t.eq(await page.textContent("#lcount-graphs"), String(await state(page, () => bonsai.S.trees.length)), "Graphs counts every graph");

// island › topic › graph
await page.click('#glist .nrow.shelf[data-shelf="i:found"] .nname');
await page.click('#glist .nrow.shelf[data-shelf^="t:"] .nname >> nth=0');
const tid = await page.getAttribute("#glist .nrow.graph >> nth=0", "data-tree");
t.eq(await state(page, (id) => bonsai.S.trees.find((x) => x.id === id).zoneId, tid) != null, true, "a topic opens to its graphs");
await page.click("#glist .nrow.graph >> nth=0 >> .nname");
await page.waitForSelector(".gboard canvas");
t.eq(await page.evaluate(() => decodeURIComponent(location.hash)), "#/notes/g:" + tid, "a graph opens in the Library");
t.eq(await page.isVisible("#nedit .page"), false, "in place of a note page");
await page.screenshot({ path: "tests/shots/library-board.png" });

// numbers pick, Enter opens it in its graph
await page.keyboard.press("2");
const picked = await state(page, () => bonsai.S.gsel);
t.eq(await state(page, (id) => bonsai.S.num.get(id), picked), 2, "a number picks an idea");
t.eq((await page.textContent("#gfoot b")) === (await state(page, (id) => bonsai.S.byId.get(id).title, picked)), true, "its name shows at the foot");
await page.keyboard.press("Escape");
t.eq(await state(page, () => bonsai.S.gsel), null, "Esc lets go");
await page.keyboard.press("2"); await page.keyboard.press("Enter");
await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.sel === id, picked);
await page.evaluate(() => history.back()); await page.waitForSelector(".gboard canvas");

// double-click an idea on the board
const at = await state(page, (id) => bonsai.S.board.screenOf(id), picked);
await page.mouse.dblclick(at.x, at.y);
await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.sel === id, picked);
await page.evaluate(() => history.back()); await page.waitForSelector(".gboard canvas");

// Watering: what needs water, most first
const water = await page.$$eval("#wlist .nrow.graph", (r) => r.map((x) => [x.dataset.tree, +x.querySelector(".thirst").textContent]));
const want = await state(page, () => bonsai.S.trees.map((tr) => [tr.id, (bonsai.S.byTree.get(tr.id) || []).filter((n) => !n.ghost && bonsai.thirst(n) !== "ok").length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]));
t.eq(water.map((w) => w[1]), want.map((w) => w[1]), "Watering lists what needs water, most first");

// sections fold away and stay so
await page.click("#lib-water");
t.eq(await page.$("#wlist"), null, "a section folds away");
await page.reload(); await page.waitForSelector(".lhead");
t.eq(await page.$("#wlist"), null, "and stays folded");
await page.click("#lib-water");

// search finds graphs too
await page.fill("#notesSearch", "newton");
t.eq(await page.$$eval("#glist .nrow.graph .nt", (r) => r.map((x) => x.textContent)), ["Newton's laws"], "search finds graphs by name");
await page.fill("#notesSearch", "");

// every idea the same size
t.eq(await state(page, async () => { const { nodeRadius } = await import("./layout.js"); return [nodeRadius(1, true), nodeRadius(40, false)]; }), [0.26, 0.26], "the first idea is the same size as the rest");

// beta: H marks what needs water in ochre in the knowledge view
await page.evaluate(() => { location.hash = "#/forest"; }); await page.waitForFunction(() => bonsai.S.view === "forest");
t.eq(await page.getAttribute("#viewThirsty", "aria-pressed"), "false", "Thirsty starts off");
await page.keyboard.press("h");
t.eq(await page.getAttribute("#viewThirsty", "aria-pressed"), "true", "H turns it on");
t.eq(await state(page, () => localStorage.getItem("bonsai-beta.thirsty")), "1", "and it's remembered");
await page.screenshot({ path: "tests/shots/library-thirsty.png" });
await page.keyboard.press("h");
await t.end();
