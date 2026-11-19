// The joined view (V in the knowledge view): what's in scope read as one structure, the way the tech tree joins it.
// An island leads to its topics and they to the ideas their graphs start from; an island that grows from another
// hangs from the idea it grows from, a tier further out and higher. A view only: nothing is saved.
import { start, state } from "./lib.mjs";

const t = await start("run19-joined", 4319, { channel: "beta" });
const page = await t.page({}, "#/forest/found");
await page.waitForSelector("body[data-ready]"); await page.waitForSelector(".lbl.zone");
const key = (k) => page.keyboard.press(k);
const count = () => state(page, async () => { const d = await bonsai.store.exportAll(); return [d.zones.length, d.trees.length, d.nodes.length, d.links.length, JSON.stringify(d.meta ?? null).length]; });
const before = await count();
t.eq(await state(page, () => [bonsai.S.joined, !!bonsai.S.forest.joined, document.querySelector("#viewApart").getAttribute("aria-pressed")]), [false, false, "true"], "the rings come first");

await key("v"); await page.waitForFunction(() => bonsai.S.forest?.joined);
const J = await state(page, () => {
  const S = bonsai.S, j = S.forest.joined, f = S.flora, title = (id) => S.byId.get(id)?.title || id, tier = (id) => j.tiers.get(id);
  const parts = j.parts.map((p) => ({ id: p.id, parent: p.parent, hang: p.hang && title(p.hang), tier: tier(p.id).tier, lift: tier(p.id).lift, n: p.ideas.length, r: Math.max(...p.ideas.map((n) => Math.hypot(f.home.get(n.id).x - tier(p.id).x, f.home.get(n.id).z - tier(p.id).z))), x: tier(p.id).x, z: tier(p.id).z }));
  const isles = ["found", "gensci", "maths", "phys"], zones = S.garden.islands.filter((q) => isles.includes(q.id)).flatMap((q) => q.zoneIds), ideas = S.nodes.filter((n) => zones.includes(S.trees.find((x) => x.id === n.treeId)?.zoneId)).length;
  const patterns = S.nodes.find((n) => n.title === "Patterns" && n.parentId == null) || S.nodes.find((n) => n.title === "Patterns");
  return { parts, ideas, made: f.ids.filter((id) => /^[shit]:/.test(id)).length, all: f.ids.length, tight: j.tight, join: f.limbs.some((l) => l.from === patterns.id && l.to === "i:gensci"), bonds: f.bonds.length, arcs: f.links.length,
    names: [...document.querySelectorAll(".lbl.isle")].map((e) => e.textContent).sort(), pressed: document.querySelector("#viewJoined").getAttribute("aria-pressed") };
});
const part = (id) => J.parts.find((p) => p.id === id);
t.eq(J.parts.map((p) => p.id).sort(), ["i:found", "i:gensci", "i:maths", "i:phys"], "Foundations and every island that grows out of it, and so on down");
t.eq([part("i:gensci").hang, part("i:maths").hang, part("i:phys").hang], ["Patterns", "Numbers", "Energy"], "each hangs from the idea it grows from");
t.eq([part("i:found").tier, part("i:gensci").tier, part("i:maths").tier, part("i:phys").tier], [0, 1, 1, 2], "tiers follow what grows from what");
if (!(part("i:found").lift < part("i:gensci").lift && part("i:gensci").lift < part("i:phys").lift)) t.fail("tiers don't step up");
t.eq([J.all - J.made, J.join, J.tight, J.pressed], [J.ideas, true, 0, "true"], "every idea of those islands is there, joined by a stick from the idea to the island, with no bond through an idea");
for (const a of J.parts) for (const b of J.parts) if (a.id < b.id && Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r - 0.5) t.fail(`${a.id} and ${b.id} overlap seen from above`);
t.eq(J.names, ["Foundations", "General science", "Maths", "Physics"], "the islands are named");
if (!(J.bonds > 3 && J.arcs > 3)) t.fail(`links inside an island should be bonds and links between islands arcs: ${J.bonds}, ${J.arcs}`);
await page.waitForTimeout(900); await page.screenshot({ path: "tests/shots/joined-island.png" });

// hovering an idea shows its card; tapping it opens it in its own graph
const idea = await state(page, () => { const S = bonsai.S, n = S.nodes.find((x) => x.title === "Fractions"), at = bonsai.stage.screenOf(S.flora.pos.get(n.id)), r = bonsai.stage.container.getBoundingClientRect(); return { id: n.id, tree: n.treeId, x: r.left + at.x, y: r.top + at.y }; });
await page.mouse.move(idea.x, idea.y); await page.mouse.move(idea.x + 1, idea.y);
await page.mouse.click(idea.x, idea.y); await page.waitForFunction(() => bonsai.S.view === "tree");
t.eq(await state(page, () => [bonsai.S.tree.id, bonsai.S.sel]), [idea.tree, idea.id], "an idea opens in its own graph, picked");
await key("Escape"); await page.waitForFunction(() => bonsai.S.view === "forest" && bonsai.S.forest?.joined);

// a topic: its graphs as one, with the island that grows from one of its ideas
const numbers = await state(page, () => bonsai.S.zones.find((z) => z.name === "Numbers").id);
await page.evaluate((id) => { location.hash = "#/forest/" + id; }, numbers); await page.waitForFunction((id) => bonsai.S.fscope?.id === id && bonsai.S.forest?.joined, numbers);
t.eq(await state(page, () => bonsai.S.forest.joined.parts.map((p) => [p.id.slice(0, 2), p.parent ? "grows" : "first"])), [["t:", "first"], ["i:", "grows"]], "a topic, and the island that grows from an idea of it");
await page.waitForTimeout(900); await page.screenshot({ path: "tests/shots/joined-topic.png" });

// everything: what grows from nothing hangs from the start
await key("a"); await page.waitForFunction(() => !bonsai.S.fscope && bonsai.S.forest?.joined);
const all = await state(page, () => ({ first: bonsai.S.forest.joined.parts[0].id, under: bonsai.S.forest.joined.parts.filter((p) => p.parent === "s:").map((p) => p.id).sort(), n: bonsai.S.forest.joined.parts.length, isles: bonsai.S.garden.islands.length }));
t.eq([all.first, all.under, all.n], ["s:", ["i:found", "i:lead", "i:make", "i:music"], all.isles + 1], "every island, the ones that grow from nothing under the start");
await page.waitForTimeout(1200); await page.screenshot({ path: "tests/shots/joined-all.png" });

// nothing was saved by any of it, the choice is remembered, and J goes back to the rings
t.eq(await count(), before, "the joined view saves nothing");
await page.reload(); await page.waitForSelector("body[data-ready]"); await page.waitForFunction(() => bonsai.S.forest);
t.eq(await state(page, () => [bonsai.S.joined, !!bonsai.S.forest.joined]), [true, true], "joined is remembered");
await key("v"); await page.waitForFunction(() => !bonsai.S.forest.joined);
t.eq(await state(page, () => [bonsai.S.joined, bonsai.S.forest.fl.zones.size > 5]), [false, true], "J goes back to the rings");
await t.end();
