// The Library: the notes sidebar holds Notes, Graphs (island › topic › graph) and Watering, each folding away.
// A graph opens on a 2D board in the main area: numbers pick, Shift+Enter or double-click opens it in its graph,
// what needs water is ringed in ochre. Every idea is the same size. On the beta, H in the knowledge view marks
// what needs water in ochre.
import { start, state } from "./lib.mjs";

const t = await start("run24-library", 4324, { channel: "beta" });
const page = await t.page({ viewport: { width: 1300, height: 860 } }, "#/notes");
await page.waitForSelector("body[data-ready]"); await page.waitForTimeout(500);

t.eq(await page.$$eval(".ltab", (h) => h.map((x) => x.firstChild.textContent)), ["Notes", "Graphs", "Watering"], "the Library has tabs for Notes, Graphs and Watering");
t.eq(await page.$("#glist"), null, "it opens on Notes");
// one + Page button that asks: page or pen page
await page.click("#newPageBtn"); await page.waitForSelector(".menu .mi");
t.eq(await page.$$eval(".menu .mi", (m) => m.map((x) => x.textContent)), ["PageN", "Pen pageW"], "+ Page asks which kind");
await page.click(".menu .mi >> nth=1");
await page.waitForFunction(() => bonsai.S.pages.find((p) => p.id === bonsai.S.npage)?.kind === "ink");
t.eq(true, true, "and makes a pen page");
// right-click a page in the list for its quick actions
await page.click('#nlist .nrow[data-id] .nname >> nth=0', { button: "right" }); await page.waitForSelector(".menu .mi");
const pm = await page.$$eval(".menu .mi", (m) => m.map((x) => x.textContent));
if (!pm.some((x) => x.startsWith("Rename")) || !pm.some((x) => x.startsWith("Delete"))) t.fail("a page's right-click menu misses Rename or Delete: " + pm.join(", "));
await page.keyboard.press("Escape");
await page.keyboard.press("Shift+Digit2"); await page.waitForSelector("#glist");
t.eq(await page.getAttribute("#lib-graphs", "aria-selected"), "true", "Shift+2 goes to Graphs");
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

// right-click a graph in the list
await page.click("#glist .nrow.graph >> nth=0 >> .nname", { button: "right" }); await page.waitForSelector(".menu .mi");
t.eq(await page.textContent(".menu .mi >> nth=0"), "Open on the board↵", "a graph's right-click menu starts with Open on the board");
await page.keyboard.press("Escape");
await page.click('#glist .nrow.shelf[data-shelf^="t:"] .nname >> nth=0', { button: "right" }); await page.waitForSelector(".menu .mi");
t.eq(await page.textContent(".menu .mi >> nth=0"), "New knowledge graph hereN", "a topic's right-click menu adds a graph there");
await page.keyboard.press("Escape");

// numbers pick, Shift+Enter opens it in its graph
await page.keyboard.press("2");
const picked = await state(page, () => bonsai.S.gsel);
t.eq(await state(page, (id) => bonsai.S.num.get(id), picked), 2, "a number picks an idea");
t.eq((await page.textContent("#gfoot b")) === (await state(page, (id) => bonsai.S.byId.get(id).title, picked)), true, "its name shows at the foot");
await page.keyboard.press("Escape");
t.eq(await state(page, () => bonsai.S.gsel), null, "Esc lets go");
await page.keyboard.press("2"); await page.keyboard.press("Shift+Enter");
await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.sel === id, picked);
await page.evaluate(() => history.back()); await page.waitForSelector(".gboard canvas");

// double-click an idea on the board
const at = await state(page, (id) => bonsai.S.board.screenOf(id), picked);
await page.mouse.dblclick(at.x, at.y);
await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.sel === id, picked);
await page.evaluate(() => history.back()); await page.waitForSelector(".gboard canvas");

// Graphs filter: only those waiting for water, or only those watered
await page.click('.nfilter[data-f="g"] [data-v="wait"]');
t.eq(await page.$$eval("#glist .nrow.graph", (r) => r.every((x) => x.querySelector(".thirst"))), true, "Waiting shows only graphs with ideas waiting");
await page.click('.nfilter[data-f="g"] [data-v="ok"]');
t.eq(await page.$$eval("#glist .nrow.graph", (r) => r.some((x) => x.querySelector(".thirst"))), false, "Watered shows only the rest");
await page.click('.nfilter[data-f="g"] [data-v=""]');

// Watering: island › topic › what needs water, open to start with, most first in each topic
await page.click("#lib-water"); await page.waitForSelector("#wlist .nrow.graph");
const water = await page.$$eval("#wlist .nrow.graph", (r) => r.map((x) => [x.dataset.tree, +x.querySelector(".thirst").textContent]));
const want = await state(page, () => bonsai.S.trees.map((tr) => [tr.id, (bonsai.S.byTree.get(tr.id) || []).filter((n) => !n.ghost && bonsai.thirst(n) !== "ok").length]).filter(([, n]) => n));
t.eq(water.map((w) => w[0]).sort(), want.map((w) => w[0]).sort(), "Watering lists every graph with ideas waiting");
t.eq(await page.$$eval("#wlist .nrow.shelf", (r) => r.length > 0 && r.every((x) => x.getAttribute("aria-expanded") === "true")), true, "under its island and topic, open");
await page.click('.nfilter[data-f="w"] [data-v="dry"]');
const dry = await state(page, () => bonsai.S.trees.filter((tr) => (bonsai.S.byTree.get(tr.id) || []).some((n) => !n.ghost && bonsai.thirst(n) === "dry")).map((t) => t.id).sort());
t.eq((await page.$$eval("#wlist .nrow.graph", (r) => r.map((x) => x.dataset.tree))).sort(), dry, "Dry shows only graphs with dried-out ideas");
await page.click('.nfilter[data-f="w"] [data-v=""]');
await page.screenshot({ path: "tests/shots/library-water.png" });

// the tab is remembered
await page.reload(); await page.waitForSelector("#wlist");
t.eq(await page.getAttribute("#lib-water", "aria-selected"), "true", "and the tab stays");
await page.click("#lib-graphs"); await page.waitForSelector("#glist");

// search finds graphs too
await page.fill("#notesSearch", "newton");
t.eq(await page.$$eval("#glist .nrow.graph .nt", (r) => r.map((x) => x.textContent)), ["Newton's laws"], "search finds graphs by name");
await page.fill("#notesSearch", "");

// every idea the same size
t.eq(await state(page, async () => { const { nodeRadius } = await import("./layout.js"); return [nodeRadius(1, true), nodeRadius(40, false)]; }), [0.26, 0.26], "the first idea is the same size as the rest");

// H shows or hides the ochre for what needs water in the knowledge view
await page.evaluate(() => { location.hash = "#/forest"; }); await page.waitForFunction(() => bonsai.S.view === "forest");
t.eq(await page.getAttribute("#viewThirsty", "aria-pressed"), "true", "Thirsty starts on");
await page.keyboard.press("h");
t.eq(await page.getAttribute("#viewThirsty", "aria-pressed"), "false", "H turns it off");
t.eq(await state(page, () => localStorage.getItem("bonsai-beta.thirsty")), "0", "and it's remembered");
await page.keyboard.press("h");
await page.screenshot({ path: "tests/shots/library-thirsty.png" });
await t.end();
