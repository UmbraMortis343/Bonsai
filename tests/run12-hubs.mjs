// Hubs: a map made elsewhere is imported, giving hubs of islands. Uncharted land
// lies under mist, keys step hub → island → topic, and a topic past 200% can be
// split onto an island of its own.
import { start, seed, state } from "./lib.mjs";
import { readMap, missing, mergeMap, centreOf } from "../src/gardenmap.js";

const t = await start("run12-hubs", 4312);

// ----- the map logic on its own -----
{
  let threw = false; try { readMap("hello"); } catch { threw = true; }
  t.eq(threw, true, "text that isn't a map is refused");
  t.eq([centreOf("Stone Arches"), centreOf("The Academy"), centreOf("amphitheater"), centreOf("pond")], ["arches", "academy", "amphitheatre", null], "centrepieces are read from words");
  const topics = "abcdefgh".split("").map((c) => ({ id: "t" + c, name: c.toUpperCase() }));
  const map = readMap({ hubs: [{ id: "h", name: "Hub", islands: [{ id: "big", name: "Big", centre: "statue", topics }] }] });
  const zones = [], g = { islands: [{ id: "home", name: "Home", landmark: "arches", zoneIds: [] }], zone: {} };
  for (const m of missing(g, map, zones)) { const id = "z" + m.mapId; g.zone[id] = { mapId: m.mapId, fromMap: true }; zones.push({ id, name: m.name, trees: 0 }); }
  const r = mergeMap(g, map, zones);
  t.eq(r.garden.islands.map((i) => [i.name, i.landmark, i.zoneIds.length]), [["Big", "statue", 6], ["Big 2", "statue", 2]], "more topics than fit spill onto a second island");
  const again = mergeMap(r.garden, map, zones);
  t.eq(again.garden.islands.map((i) => i.zoneIds), r.garden.islands.map((i) => i.zoneIds), "importing the same map again changes nothing");
}

const MAP = { bonsaiMap: 1, hubs: [
  { id: "h-acad", name: "Academics", islands: [
    { id: "i-found", name: "Foundations", centre: "Arches", topics: [] },
    { id: "i-sci", name: "Sciences", centre: "Academy", topics: [{ id: "t-phys", name: "Physics" }, { id: "t-elec", name: "Electronics" }, { id: "t-math", name: "Maths" }] },
    { id: "i-arts", name: "Arts", centre: "Amphitheatre", topics: [{ id: "t-music", name: "Music" }, { id: "t-writing", name: "Writing" }] }] },
  { id: "h-work", name: "Work", islands: [] },
  { id: "h-play", name: "Play", islands: [{ id: "i-games", name: "Games", centre: "Statue", topics: [{ id: "t-chess", name: "Chess" }] }] }] };
const key = (page, k) => page.keyboard.press(k);
const importMap = async (page, map) => {
  const was = await state(page, () => bonsai.S.garden.mapAt || "");
  await page.click("#moreBtn"); await page.click(".menu >> text=Import map"); await page.waitForSelector(".dialog textarea");
  await page.fill(".dialog textarea", JSON.stringify(map)); await page.click(".dialog button.primary");
  await page.waitForFunction((w) => bonsai.S.garden.mapAt && bonsai.S.garden.mapAt !== w && bonsai.S.view === "isles" && !document.querySelector(".dialog"), was);
  await page.waitForSelector("body[data-isles=ready]", { timeout: 90000 });
};
const shape = (page) => state(page, () => bonsai.S.hubs.map((h) => [h.name, h.isles.map((i) => [bonsai.S.model[i].name, bonsai.S.model[i].landmark, bonsai.S.model[i].topics.map((q) => q.name + (q.mist ? "~" : ""))])]));

// ----- importing a map -----
{
  const page = await t.page({}, "#/");
  const ids = await seed(page);
  await page.waitForSelector("body[data-isles=ready]", { timeout: 60000 });
  t.eq(await page.locator("#isleAdd").count(), 1, "before a map, islands are added by hand");
  await importMap(page, MAP);
  t.eq(await shape(page), [
    ["Academics", [["Foundations", "arches", ["~"]], ["Sciences", "academy", ["Physics~", "Electronics", "Maths~"]], ["Arts", "amphitheatre", ["Music", "Writing~"]]]],
    ["Work", []],
    ["Play", [["Games", "statue", ["Chess~"]]]]], "hubs, islands, centrepieces and topics come from the map; topics with no ideas are under mist");
  t.eq(await state(page, () => [bonsai.S.zones.find((z) => z.name === "Electronics").id, bonsai.S.zones.filter((z) => z.name === "Electronics").length]), [ids.zone, 1], "a topic already here is matched by name, not made twice");
  t.eq(await page.locator("#isleAdd").count(), 0, "after a map, no Add island button");
  t.eq(await page.locator(".tag.hub:not(.off)").count(), 3, "every hub is named from far off");
  t.eq(await page.locator(".tag.isle:not(.off)").count(), 0, "islands aren't named until a hub is chosen");
  const spots = await state(page, () => bonsai.isles.spots);
  let apart = true; for (const a of spots.islands) for (const b of spots.islands) if (a !== b && Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]) < a.R + b.R) apart = false;
  t.eq(apart, true, "no two islands overlap");
  t.eq([spots.hubs.map((h) => h.mist), spots.links.length], [[false, true, false], 3], "an empty hub is a bank of mist; two bridges inside Academics and one across to Play");
  await page.waitForTimeout(1500); await page.screenshot({ path: "tests/shots/hubs-all.png" });

  // 1 goes to the first hub, 2 to its second island, 2 to that island's second topic.
  await key(page, "1"); t.eq(await state(page, () => [bonsai.S.hub, bonsai.S.isle]), [0, -1], "1 goes to the first hub");
  t.eq([await page.textContent("#gpanel h2"), await page.locator("#gpanel .grow-row").count(), await page.locator(".tag.isle.keys:not(.off)").count()], ["Academics", 3, 3], "the hub lists its islands, each with a key");
  await page.waitForTimeout(1800); await page.screenshot({ path: "tests/shots/hubs-hub.png" });
  await key(page, "2"); t.eq(await page.textContent("#gpanel h2"), "Sciences", "2 goes to the hub's second island");
  await page.waitForTimeout(2500); await page.screenshot({ path: "tests/shots/hubs-island.png" });
  await page.click("#isleMore");
  t.eq(await page.locator(".menu button").allTextContents(), ["Mountain"], "an island from the map can't be renamed here, but can be given a mountain");
  await page.click(".menu >> text=Mountain"); await page.waitForFunction(() => bonsai.S.model[1].mountain === true);
  await page.waitForFunction(() => bonsai.isles.ready, null, { timeout: 90000 });
  await key(page, "2"); t.eq(await page.textContent("#gpanel h2"), "Electronics", "2 picks the island's second topic");
  await key(page, "Escape"); await key(page, "Escape");
  t.eq(await state(page, () => [bonsai.S.hub, bonsai.S.isle]), [0, -1], "Esc steps back to the hub");
  await key(page, "ArrowRight"); t.eq([await page.textContent("#gpanel h2"), await page.textContent("#gpanel p.muted")], ["Work", "No islands yet."], "arrows step from hub to hub, and an empty hub can still be visited");
  await key(page, "0"); t.eq(await state(page, () => [bonsai.S.hub, bonsai.S.isle]), [-1, -1], "0 goes back out to every hub");

  // A topic moved by hand stays where it was put; the map only moves what moved on the map.
  await key(page, "1"); await key(page, "3"); await key(page, "1"); await page.click("#topicMore"); await page.click(".menu >> text=Move to island"); await page.click(".menu >> text=Academics › Sciences");
  await page.waitForFunction(() => bonsai.S.model.find((q) => q.name === "Sciences").topics.length === 4);
  const next = structuredClone(MAP);
  next.hubs[0].islands[1].name = "Science"; next.hubs[0].islands[1].topics = next.hubs[0].islands[1].topics.filter((q) => q.name !== "Maths");   // renamed; Maths dropped
  next.hubs[2].islands[0].topics.push(next.hubs[0].islands[1].topics.pop());                                                                   // Electronics moves to Games
  next.hubs[1].islands.push({ id: "i-craft", name: "Craft", centre: "", topics: [{ id: "t-teach", name: "Teaching" }] });
  await key(page, "0"); await importMap(page, next);
  t.eq(await shape(page), [
    ["Academics", [["Foundations", "arches", ["~"]], ["Science", "academy", ["Physics~", "Music"]], ["Arts", "amphitheatre", ["Writing~"]]]],
    ["Work", [["Craft", "academy", ["Teaching~"]]]],
    ["Play", [["Games", "statue", ["Chess~", "Electronics"]]]]], "a second import follows the map's changes and leaves the hand-moved topic alone");
  t.eq(await state(page, () => bonsai.S.allZones.some((z) => z.name === "Maths")), false, "a topic the map made and then dropped, never used, is removed");
  t.eq(await state(page, async () => { const g = await bonsai.store.getMeta("garden"); return g.hubs.map((h) => g.islands.filter((i) => i.hubId === h.id).length); }), [3, 1, 1], "the arrangement is saved");
  await page.context().close();
}

// ----- a topic past 200% -----
{
  const page = await t.page({}, "#/");
  await page.evaluate(async () => {
    bonsai.isles.setActive(false);   // drawing in software is slow enough to starve hundreds of small writes
    const s = bonsai.store, z = await s.createZone({ name: "Physics" });
    const fill = async (parent, n, label) => { let at = parent; for (let i = 0; i < n; i++) { const x = await s.addNode(i % 6 ? at : parent, { title: `${label} ${i}` }); if (i % 6 === 0) at = x.id; } };
    const a = await s.createTree({ zoneId: z.id, name: "Classical", core: "Motion" });
    const mech = await s.addNode(a.rootId, { title: "Mechanics" }), em = await s.addNode(a.rootId, { title: "Electromagnetism" }); await s.addNode(a.rootId, { title: "Units" });
    await fill(mech.id, 200, "m"); await fill(em.id, 150, "e");
    const b = await s.createTree({ zoneId: z.id, name: "Quantum", core: "Quanta" }); await fill(b.rootId, 130, "q");
    bonsai.isles.setActive(true); await bonsai.refresh();
  });
  await page.waitForFunction(() => bonsai.isles.ready, null, { timeout: 90000 });
  await key(page, "1"); await key(page, "1");
  t.eq(await page.textContent("#gpanel .stats"), "485 ideas200% grown100% healthy", "the topic has passed 200%");
  t.eq(await page.locator("#splitTopic").count(), 1, "Split is offered past 200%");
  await key(page, "s"); await page.waitForSelector(".dialog #splitParts");
  t.eq(await page.locator("#splitParts .grow-row").allTextContents(), ["Mechanics201", "Electromagnetism151", "Quantum131"], "the split shows the main branches of the topic read as one graph");
  await page.screenshot({ path: "tests/shots/split-dialog.png" });
  await page.click(".dialog button.primary");
  await page.waitForFunction(() => bonsai.S.model.length === 2, null, { timeout: 90000 });
  t.eq(await state(page, () => bonsai.S.model.map((i) => [i.name, i.topics.map((q) => [q.name, q.ideas, q.trees.length])])), [["Home", [["", 0, 0]]], ["Physics", [["Physics", 2, 1], ["Mechanics", 201, 1], ["Electromagnetism", 151, 1], ["Quantum", 131, 1]]]], "the topic has its own island and its main branches are topics there");
  t.eq(await state(page, () => bonsai.S.links.length), 3, "the trunk stays linked to each branch that left");
  await page.evaluate(() => document.querySelector("#toast button").click()); await page.waitForFunction(() => bonsai.S.model.length === 1, null, { timeout: 90000 });   // the toast can time out while slow software drawing rebuilds the islands
  t.eq(await state(page, () => [bonsai.S.model[0].topics.map((q) => [q.name, q.ideas, q.trees.length]), bonsai.S.links.length, bonsai.S.zones.length]), [[["Physics", 485, 2]], 0, 1], "Undo puts everything back");
}
await t.end();
