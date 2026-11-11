// The garden is the home screen: topics become biomes on islands, with number
// keys to reach an island, then a topic, then one of its graphs.
import { start, seed, state } from "./lib.mjs";

const t = await start("run11-isles", 4311);
const page = await t.page({}, "#/");
const key = (k) => page.keyboard.press(k);
t.eq(await state(page, () => bonsai.S.view), "isles", "the garden is the home screen");
await page.waitForSelector("#zoneName");   // nothing planted yet

const ids = await seed(page);
await page.waitForSelector("body[data-isles=ready]", { timeout: 60000 });
t.eq(await state(page, () => bonsai.S.model.map((i) => [i.name, i.landmark, i.topics.map((q) => [q.name, q.ideas, q.trees.length])])), [["Home", "arches", [["Electronics", 12, 2], ["Music", 3, 1]]]], "topics sit on the first island");
t.eq(await page.locator(".tag.isle").count(), 1, "one island tag");
t.eq(await page.textContent("#gpanel .stats"), "15 ideas3 graphs2 topics", "stats in the panel");
await page.waitForTimeout(800); await page.screenshot({ path: "tests/shots/isles-home.png" });

// 1 goes to the island, 1 again to its first topic, 2 opens that topic's second graph.
await key("1"); t.eq(await state(page, () => [bonsai.S.isle, bonsai.S.topic]), [0, -1], "1 goes to the island");
t.eq(await page.locator(".tag.topic.show").count(), 2, "topic tags show on the island in focus");
await key("1"); t.eq(await state(page, () => bonsai.S.topic), 0, "1 picks the first topic");
t.eq(await page.textContent("#gpanel h2"), "Electronics", "panel shows the topic");
await page.waitForTimeout(1500); await page.screenshot({ path: "tests/shots/isles-topic.png" });
await key("2"); await page.waitForSelector(".lbl.trunk");
t.eq(await state(page, () => bonsai.S.tree.name), "Op-amps", "2 opens the second graph");
await key("Escape"); await page.waitForSelector("#gpanel:not([hidden])");
t.eq(await state(page, () => [bonsai.S.view, bonsai.S.isle, bonsai.S.topic]), ["isles", 0, 0], "Esc returns to the same topic in the garden");
await key("Escape"); await key("Escape");
t.eq(await state(page, () => [bonsai.S.isle, bonsai.S.topic]), [-1, -1], "Esc steps back out to all islands");

// A new graph asks only for its topic and its name.
await key("n"); await page.waitForSelector(".dialog");
t.eq(await page.locator(".dialog label").allTextContents().then((l) => l.map((x) => x.trim().match(/^(Topic|Name)/)?.[0])), ["Topic", "Name"], "new graph asks for topic and name");
await page.selectOption(".dialog select", ids.zone2); await page.fill(".dialog input", "Filters"); await key("Enter");
await page.waitForSelector(".lbl.trunk");
t.eq(await state(page, () => [bonsai.S.tree.name, bonsai.S.zones.find((z) => z.id === bonsai.S.tree.zoneId).name]), ["Filters", "Music"], "graph created in the chosen topic");
await key("Escape"); await page.waitForSelector("#gpanel:not([hidden])");

// Moving a topic to a new island adds a second island with a bridge; the arrangement is remembered.
await key("1"); await key("2"); await page.click("#topicMore"); await page.click('.menu >> text=Move to island'); await page.click('.menu >> text=New island');
await page.fill(".dialog input", "Arts"); await key("Enter");
await page.waitForFunction(() => bonsai.S.model.length === 2);
t.eq(await state(page, () => bonsai.S.model.map((i) => [i.name, i.topics.map((q) => q.name)])), [["Home", ["Electronics"]], ["Arts", ["Music"]]], "topic moved to a new island");
await page.reload(); await page.waitForSelector("body[data-ready]"); await page.waitForSelector("body[data-isles=ready]", { timeout: 60000 });
t.eq(await page.locator(".tag.isle").count(), 2, "two islands after reload");
await page.waitForTimeout(1200); await page.screenshot({ path: "tests/shots/isles-two.png" });
await key("2"); t.eq(await page.textContent("#gpanel h2"), "Arts", "2 goes to the second island");
await key("d"); t.eq(await state(page, () => document.querySelector("#isles").classList.contains("night")), true, "D switches to night");
await page.waitForTimeout(1500); await page.screenshot({ path: "tests/shots/isles-night.png" });
await t.end();
