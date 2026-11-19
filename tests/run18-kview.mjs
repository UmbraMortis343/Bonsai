// The knowledge view: graphs as ball-and-stick structures on discs, set out in rings (a topic's graphs round its
// name, an island's topics round its name); links inside a graph as straight bonds that pass through no idea;
// numbered ideas reached by typing the number; a bar where every button shows its key; cards in the idea's panel;
// the watering screen in the same picture; night following the garden; and no trees, zones, trunks or branches in the words.
import { start, seed, openTree, state } from "./lib.mjs";

const t = await start("run18-kview", 4318);
const page = await t.page();
const ids = await seed(page);
const key = (k) => page.keyboard.press(k);
const picked = () => state(page, () => bonsai.S.num.get(bonsai.S.sel));
const old = /\b(zones?|trunks?|branch(es)?|forest|plant(ed)?)\b|(?<!tech )\btrees?\b/i;
const words = async (sel, what) => { const s = (await page.locator(sel).allTextContents()).join(" | "); if (old.test(s)) t.fail(`${what} still says ${s.match(old)[0]}: ${s}`); };

// three links inside Basic electronics, one across to another graph
await page.evaluate(async (i) => {
  const s = bonsai.store;
  await s.addLink(i.Series, i.Charge); await s.addLink(i["Voltage divider"], i.Sources); await s.addLink(i.Parallel, i["RC time constant"]); await s.addLink(i.Resistors, i.Inverting);
  await bonsai.refresh();
}, ids);

// ---- rings
await page.waitForSelector(".lbl.isle");
const r = await state(page, (i) => {
  const f = bonsai.S.forest.fl, d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), z = f.zones.get(i.zone), isle = [...f.isles.values()][0];
  return { graphs: [d(f.trees.get(i.basic), z), d(f.trees.get(i.op), z)], topics: [d(z, isle), d(f.zones.get(i.zone2), isle)], apart: d(f.trees.get(i.basic), f.trees.get(i.op)), bonds: bonsai.S.flora.bonds.length, arcs: bonsai.S.flora.links.length };
}, ids);
if (Math.abs(r.graphs[0] - r.graphs[1]) > 1e-6 || r.graphs[0] < 2) t.fail("a topic's graphs aren't on one ring round its name: " + r.graphs);
if (Math.abs(r.topics[0] - r.topics[1]) > 1e-6 || r.topics[0] < 3) t.fail("an island's topics aren't on one ring round its name: " + r.topics);
if (r.apart < 4) t.fail("two graphs of a topic overlap");
t.eq([r.bonds, r.arcs], [3, 1], "links inside a graph are bonds, links between graphs are arcs");
t.eq(await state(page, () => [[...document.querySelectorAll(".lbl.zone")].map((e) => e.textContent).sort(), [...document.querySelectorAll(".lbl.isle")].map((e) => e.textContent)]), [["Electronics", "Music"], ["Home"]], "topics and the island are named in the middle of their rings");
await page.waitForTimeout(700); await page.screenshot({ path: "tests/shots/kview-rings.png" });
await page.click("#addBtn"); await words(".menu", "the add menu"); await key("Escape");

// an island's name narrows to it; a topic's menu offers only that topic
// graph names show however far out the view is; the bar opens the tech tree on what's in view
t.eq(await state(page, () => [...document.querySelectorAll(".lbl.tree")].every((e) => e.style.opacity !== "0" && +getComputedStyle(e).opacity > 0.5)), true, "every graph is named");
await page.click("#viewTech"); await page.waitForFunction(() => bonsai.S.view === "tech"); await page.evaluate(() => history.back()); await page.waitForFunction(() => bonsai.S.view === "forest");
await page.click(".lbl.isle"); await page.waitForFunction(() => bonsai.S.fscope?.kind === "isle");
t.eq(await page.textContent("#top h1"), "Home", "clicking an island's name shows only that island");
await page.click('.lbl.zone:text-is("Electronics")'); await page.waitForSelector(".menu"); await words(".menu", "the topic menu");
await page.click('.mi:has-text("Only this topic")'); await page.waitForFunction(() => bonsai.S.fscope?.kind === "topic");
t.eq(await state(page, () => [bonsai.S.forest.fl.zones.size, bonsai.S.forest.fl.trees.size]), [1, 2], "one topic, its two graphs");
await page.waitForTimeout(700); await page.screenshot({ path: "tests/shots/kview-topic.png" });

// ---- one graph
await openTree(page, ids.basic);
const g = await state(page, () => {
  const S = bonsai.S, f = S.flora, P = f.pos, clear = [];
  const sticks = S.byTree.get(S.tree.id).filter((n) => n.parentId != null).map((n) => [n.parentId, n.id]), all = [...sticks, ...f.bonds.map((b) => [b.a, b.b])];
  for (const [a, b] of all) for (const id of f.ids) {
    if (id === a || id === b) continue;
    const A = P.get(a), B = P.get(b), C = P.get(id), ab = B.clone().sub(A), tt = Math.min(1, Math.max(0, C.clone().sub(A).dot(ab) / ab.lengthSq()));
    clear.push(C.distanceTo(A.clone().add(ab.multiplyScalar(tt))) - f.radii.get(id));
  }
  return { tight: S.lay.tight, bonds: f.bonds.length, least: Math.min(...clear), nums: [...document.querySelectorAll(".lbl.node")].map((e) => +e.dataset.n).sort((x, y) => x - y), first: document.querySelector(".lbl.trunk").dataset.n,
    mids: f.bonds.every((b) => f.linkMid.get(b.id).distanceTo(P.get(b.a).clone().add(P.get(b.b)).multiplyScalar(0.5)) < 1e-6) };
});
t.eq([g.tight, g.bonds, g.mids], [0, 3, true], "three straight bonds, and the structure settled clear");
if (!(g.least > 0.12)) t.fail(`a bond or stick comes within ${g.least.toFixed(3)} of an idea it doesn't join`);
t.eq([g.nums, g.first], [[1, 2, 3, 4, 5, 6, 7, 8, 9], "1"], "every idea is numbered, from the graph's start");
t.eq(await state(page, () => { const b = [...document.querySelectorAll("#actions .btn")]; return [b.length > 6, b.every((x) => x.querySelector("kbd"))]; }), [true, true], "every button in the bar shows its key");
await words("#actions", "the bar");
await page.waitForTimeout(600); await page.screenshot({ path: "tests/shots/kview-graph.png" });

// typing a number goes to that idea; two digits typed together make one number
await key("3"); t.eq(await picked(), 3, "3 goes to idea 3");
await page.evaluate(async (i) => { for (const x of ["Tolerance", "Colour bands", "Power rating"]) await bonsai.store.addNode(i.Resistors, { title: x }); await bonsai.refresh(); }, ids);
t.eq(await state(page, () => bonsai.S.byNum.length), 12, "twelve ideas");
await key("1"); t.eq(await picked(), 1, "1 lands on idea 1 at once");
await key("2"); t.eq(await picked(), 12, "a 2 straight after makes it 12");
await page.waitForTimeout(1000); await key("2"); t.eq(await picked(), 2, "after a pause the next digit starts again");
await page.waitForTimeout(1000); await key("0"); t.eq(await picked(), 2, "0 alone still fits the view");
await page.click('[data-act="goto"]'); await page.fill("#quickInput", "5"); await key("Enter"); t.eq(await picked(), 5, "Go to takes a number");

// the idea's panel: its number, the way back to the start, a card for each idea under it
await key("2"); await page.waitForTimeout(950); await key(" "); await page.waitForSelector("#nodeTitle");
t.eq(await state(page, () => [document.querySelector("#nodeTitle").value, document.querySelector(".ph .num").textContent, document.querySelectorAll(".trail .chip").length, document.querySelectorAll(".ncard").length]), ["Resistors", "2", 1, 6], "the panel shows the idea, its number, what it hangs from and a card for each idea under it");
await page.hover('.lbl.trunk'); await page.waitForSelector("#hover:not([hidden]) .num");
t.eq(await page.inputValue("#nodeTitle"), "Resistors", "hovering shows a card on the graph and leaves the panel alone");
await page.click(".ncard >> nth=0"); await page.waitForFunction(() => document.querySelector("#nodeTitle")?.value === "Series");
t.eq(await picked(), await state(page, (i) => bonsai.S.num.get(i.Series), ids), "a card goes to its idea");
await page.waitForTimeout(500); await page.screenshot({ path: "tests/shots/kview-panel.png" });
await key("Escape"); await key("n"); await page.waitForFunction(() => document.activeElement?.id === "nodeBody"); await key("Escape");
await page.click("#nodeMore"); await page.waitForSelector(".menu"); await words(".menu", "the idea's menu");
t.eq(await page.locator(".menu .mi kbd").count(), await page.locator(".menu .mi").count(), "every line of the idea's menu shows its key"); await key("Escape");
await page.click("#moreBtn"); await page.waitForSelector(".menu"); await words(".menu", "the graph's menu"); await key("Escape");
await key("?"); await page.waitForSelector(".dialog .keys");   // (the tech tree's own Tree mode keeps its name)
if (/\b(zone|trunk|branch|sibling|plant)\b|new tree/i.test(await page.textContent(".dialog .keys"))) t.fail("the shortcuts list still uses the old words"); await key("Escape");
// ---- dragging an idea moves it, no mode needed: it stays there, what hangs from it comes along, the view doesn't turn
await key("Escape"); await page.waitForTimeout(900);   // let the panel close and the view settle before aiming
const where = (title) => page.evaluate((x) => { const S = bonsai.S, n = S.nodes.find((q) => q.title === x && q.treeId === S.tree.id), p = S.flora.pos.get(n.id), q = bonsai.stage.screenOf(p), r = bonsai.stage.container.getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y, p: [p.x, p.y, p.z], id: n.id, pin: n.pin, theta: bonsai.stage.theta }; }, title);
const far = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
const c0 = await where("Capacitors"), k0 = await where("Charge");
await page.mouse.move(c0.x, c0.y); await page.mouse.down(); await page.mouse.move(c0.x + 50, c0.y - 30, { steps: 5 }); await page.mouse.move(c0.x + 130, c0.y - 80, { steps: 8 }); await page.mouse.up();
await page.waitForFunction((id) => bonsai.S.byId.get(id)?.pin, c0.id); await page.waitForTimeout(800);
const c1 = await where("Capacitors"), k1 = await where("Charge");
if (Math.hypot(c1.x - (c0.x + 130), c1.y - (c0.y - 80)) > 14) t.fail(`the idea isn't where it was dropped: ${[c1.x - c0.x, c1.y - c0.y].map(Math.round)}`);
t.eq([c1.theta === c0.theta, far(c1, { p: c1.pin }) < 0.01, far(k1, k0) > 0.4], [true, true, true], "dragging moves the idea, pins it, brings along what hangs from it");
await page.waitForTimeout(300); await page.screenshot({ path: "tests/shots/kview-move.png" });
// right-click: the idea's menu, with Put back
await page.mouse.click(c1.x, c1.y, { button: "right" }); await page.waitForSelector(".menu");
await page.click('.menu .mi:has-text("Put back where it was")');
await page.waitForFunction((id) => !bonsai.S.byId.get(id).pin, c0.id); await page.waitForTimeout(700);
if (far(await where("Capacitors"), c0) > 0.05) t.fail("Put back didn't return the idea to where the layout had it");
// double-click an idea flies to it
const k2 = await where("Charge"); const r0 = await state(page, () => bonsai.stage.radius);
await page.mouse.dblclick(k2.x, k2.y); await page.waitForTimeout(900);
t.eq(await state(page, (id) => bonsai.S.sel === id, k2.id), true, "double-click picks the idea and flies to it");
await key("Escape");   // the click opened its notes; put them away

// X makes the picked idea its own graph
await key("3"); await page.waitForTimeout(950); const before = await state(page, () => bonsai.S.trees.length);
await key("x"); await page.waitForFunction((n) => bonsai.S.trees.length === n + 1, before);
t.eq(await state(page, () => bonsai.S.trees.some((x) => x.name === "Capacitors")), true, "X makes the idea its own graph");

// every back arrow shows its key, and Shift+Esc goes straight back with things still open
t.eq(await page.textContent("#backBtn kbd"), "Esc", "the back arrow shows its key");
await key(" "); await page.waitForSelector("#nodeTitle"); await key("Shift+Escape"); await page.waitForFunction(() => bonsai.S.view === "forest");
await page.evaluate(() => history.back()); await page.waitForSelector(".lbl.trunk");
const ztech = await state(page, () => bonsai.S.tree.zoneId);
await key("k"); await page.waitForFunction(() => bonsai.S.view === "tech");
t.eq(await page.evaluate(() => location.hash), "#/techtree/" + encodeURIComponent(ztech), "K in a graph opens the tech tree on its topic");
await page.evaluate(() => history.back()); await page.waitForSelector(".lbl.trunk");

// ---- watering happens where you are: in a graph each idea comes up picked; Thirsty (H) shows what's waiting in ochre
await page.evaluate(() => { location.hash = "#/garden"; }); await page.waitForFunction(() => bonsai.S.view === "forest");
t.eq(await page.evaluate(() => location.hash), "#/forest", "the old watering screen lands in Knowledge");
t.eq(await page.getAttribute("#viewThirsty", "aria-pressed"), "true", "Thirsty is on");
await state(page, async () => { const old = new Date(Date.now() - 3 * 864e5).toISOString(); await bonsai.store.restoreRows({ nodes: bonsai.S.nodes.map((n) => ({ ...n, createdAt: old })) }); await bonsai.refresh(); });   // three days on: ideas are waiting for water
const syn = await state(page, () => bonsai.S.trees.find((x) => (bonsai.S.byTree.get(x.id) || []).some((n) => !n.ghost && bonsai.thirst(n) !== "ok")).id);
await page.evaluate((id) => { location.hash = "#/tree/" + id; }, syn); await page.waitForSelector(".lbl.trunk");
await page.waitForTimeout(600); await key("w");   // W waters the graph you're in
await page.waitForSelector("#review:not([hidden]) #showAnswer");
t.eq(await state(page, () => bonsai.S.sel === bonsai.S.review.ids[0]), true, "watering in a graph picks each idea as it comes up");
await page.waitForTimeout(700); await page.screenshot({ path: "tests/shots/kview-water.png" });
await key(" "); await key("3");
await page.waitForFunction(() => !bonsai.S.review || bonsai.S.review.i === 1 || !document.querySelector("#review:not([hidden])"));
await key("Escape"); await page.waitForTimeout(300); await key("Escape");

// ---- night follows the garden, as in the tech tree
const lum = () => state(page, () => { const c = bonsai.stage.scene.background; return [document.body.classList.contains("night-ui"), c.r + c.g + c.b < 0.6]; });
t.eq(await lum(), [false, false], "day");
await page.evaluate(() => { localStorage.setItem("bonsai.night", "1"); location.hash = "#/forest"; }); await page.waitForFunction(() => bonsai.S.view === "forest");
t.eq(await lum(), [true, true], "the knowledge view goes dark when the garden is at night");
await page.waitForTimeout(700); await page.screenshot({ path: "tests/shots/kview-night.png" });
await t.end();
