// Focus levels: an island sets Focus, Keep or Settled for its topics; a topic can keep its own. Keep and Settled
// stretch intervals, Settled never withers and stays out of watering rounds, exam topics start at Keep, and the
// garden panel (or ⇧0–3) sets them.
import { start, state } from "./lib.mjs";
import { levelOf, setLevel, multOf } from "../src/focus.js";
import { dueAt } from "../src/srs.js";

const t = await start("run33-focus", 4334, { channel: "beta" });

// ----- pure -----
const g = { islands: [{ id: "a", zoneIds: ["x", "y"] }], zone: {} };
t.eq([levelOf("x", g), levelOf("x", g, true)], ["focus", "keep"], "no level is Focus; an exam topic starts at Keep");
setLevel(g, { isleId: "a", level: "settled" });
t.eq([levelOf("x", g), levelOf("x", g, true)], ["settled", "keep"], "an island's level reaches its topics, but not an exam topic's own Keep");
setLevel(g, { zoneId: "x", level: null, exam: true });
t.eq(levelOf("x", g, true), "settled", "an exam topic told to follow its island does");
const day = 86400000, n = { createdAt: new Date(0).toISOString(), srs: { interval: 10, due: new Date(20 * day).toISOString() } };
t.eq([1, 2, 4].map((m) => (Date.parse(dueAt(n, m)) - 10 * day) / day), [10, 20, 40], "Keep doubles the interval since last seen, Settled makes it four times");
t.eq([multOf("focus"), multOf("keep"), multOf("settled")], [1, 2, 4], "the multipliers");

// ----- in the app -----
const page = await t.page({}, "#/");
await page.evaluate(() => bonsai.isles?.setActive(false));
const where = await state(page, () => { const S = bonsai.S, i = S.garden.islands.findIndex((q) => q.zoneIds.filter((id) => S.trees.some((x) => x.zoneId === id)).length >= 2), isl = S.garden.islands[i];
  const [a, b] = isl.zoneIds.filter((id) => S.trees.some((x) => x.zoneId === id)); return { i, isle: isl.id, a, b, ka: isl.zoneIds.indexOf(a), kb: isl.zoneIds.indexOf(b) }; });
// Every idea in the two topics was seen 4 days ago and came due two hours ago.
await page.evaluate(async ({ a, b }) => { const S = bonsai.S, now = Date.now(), zs = new Set([a, b]);
  const nodes = S.nodes.filter((n) => zs.has(S.trees.find((x) => x.id === n.treeId)?.zoneId)).map((n) => ({ ...n, srs: { interval: 4, ease: 2.5, reps: 2, lapses: 0, passes: 2, due: new Date(now - 2 * 3600000).toISOString() }, reviewedAt: new Date(now - 4 * 86400000).toISOString() }));
  await bonsai.store.restoreRows({ nodes }); await bonsai.refresh(); }, where);
const look = () => state(page, ({ a, b }) => { const S = bonsai.S, z = (id) => S.trees.filter((x) => x.zoneId === id).map((x) => x.id), inZ = (id) => (n) => z(id).includes(n.treeId), d = bonsai.dueByLevel();
  const topic = (id) => S.model.flatMap((q) => q.topics).find((q) => q.id === id), one = (id) => S.nodes.find((n) => inZ(id)(n) && n.srs && (n.note || "").trim());
  return { la: bonsai.zoneLevel(a), lb: bonsai.zoneLevel(b), focus: d.focus.filter(inZ(a)).length + d.focus.filter(inZ(b)).length, keep: d.keep.filter(inZ(a)).length + d.keep.filter(inZ(b)).length, settled: d.settled.filter(inZ(a)).length + d.settled.filter(inZ(b)).length,
    ha: topic(a).health, hb: topic(b).health, dueA: topic(a).due.length, dueB: topic(b).due.length, ta: bonsai.thirst(one(a)), tb: bonsai.thirst(one(b)) };
}, where);
const s0 = await look();
t.eq([s0.la, s0.lb, s0.focus > 0, s0.keep, s0.ha < 1, s0.ta], ["focus", "focus", true, 0, true, "thirsty"], "with no level set everything is Focus, and what came due is thirsty");

// The island to Keep with its panel's control: both topics follow, and a 4-day interval now comes due in 8.
await page.$eval(`.tag.isle[data-isle="${where.i}"]`, (e) => e.click());
await page.waitForSelector("#isleLevel");
t.eq(await page.$$eval("#isleLevel button", (b) => b.map((x) => [x.textContent, x.getAttribute("aria-pressed")])), [["Focus", "true"], ["Keep", "false"], ["Settled", "false"]], "an island shows Focus, Keep, Settled");
await page.click('#isleLevel button[data-level="keep"]');
await page.waitForFunction((id) => bonsai.zoneLevel(id) === "keep", where.a);
const s1 = await look();
t.eq([s1.la, s1.lb, s1.focus, s1.keep, s1.ha, s1.ta], ["keep", "keep", 0, 0, 1, "ok"], "Keep: the island's topics take it, and their intervals double");
await page.screenshot({ path: "tests/shots/focus-isle.png" });

// Made overdue by more than the doubled interval: Keep thirsts, but it weighs half on the garden.
await page.evaluate(async ({ a, b }) => { const S = bonsai.S, now = Date.now(), zs = new Set([a, b]);
  const nodes = S.nodes.filter((n) => zs.has(S.trees.find((x) => x.id === n.treeId)?.zoneId)).map((n) => ({ ...n, srs: { ...n.srs, due: new Date(now - 6 * 86400000).toISOString() } }));
  await bonsai.store.restoreRows({ nodes }); await bonsai.refresh(); }, where);
const s2 = await look();
t.eq([s2.keep > 0, s2.ta, Math.abs(s2.ha - 0.5) < 0.01], [true, "thirsty", true], "Keep: overdue ideas are waiting (not yet dry), and the topic only half withers");

// Topic b to Settled with ⇧3 on its own: it never withers and leaves the watering round, but the bonus pool has it.
await page.$eval(`.tag.topic[data-isle="${where.i}"][data-topic="${where.kb}"]`, (e) => e.click());
await page.waitForSelector("#topicLevel");
t.eq(await page.$$eval("#topicLevel button", (b) => b.map((x) => [x.textContent, x.getAttribute("aria-pressed"), x.dataset.via || ""])), [["Island", "true", ""], ["Focus", "false", ""], ["Keep", "false", "1"], ["Settled", "false", ""]], "a topic follows its island, whose level is marked");
await page.screenshot({ path: "tests/shots/focus-panel.png" });
await page.keyboard.press("Shift+Digit3");
await page.waitForFunction((id) => bonsai.zoneLevel(id) === "settled", where.b);
// long overdue: seen 4 days apart, due 20 days ago (Settled's four times still leaves it due)
await page.evaluate(async ({ a, b }) => { const S = bonsai.S, now = Date.now(), zs = new Set([a, b]);
  const nodes = S.nodes.filter((n) => zs.has(S.trees.find((x) => x.id === n.treeId)?.zoneId)).map((n) => ({ ...n, srs: { ...n.srs, due: new Date(now - 20 * 86400000).toISOString() } }));
  await bonsai.store.restoreRows({ nodes }); await bonsai.refresh(); }, where);
const s3 = await look();
t.eq([s3.lb, s3.hb, s3.dueB, s3.tb], ["settled", 1, 0, "ok"], "Settled: no withering, nothing to water, no ochre");
const inRound = await state(page, (b) => { const S = bonsai.S, z = S.trees.filter((x) => x.zoneId === b).map((x) => x.id), d = bonsai.dueByLevel(); return [d.settled.filter((n) => z.includes(n.treeId)).length > 0, d.focus.concat(d.keep).some((n) => z.includes(n.treeId))]; }, where.b);
t.eq(inRound, [true, false], "a Settled topic's overdue ideas are kept apart, for a bonus question");
// the round W starts leaves Settled ideas out
await page.keyboard.press("Escape");
await page.keyboard.press("w"); await page.waitForSelector("#review:not([hidden])");
t.eq(await state(page, (b) => { const S = bonsai.S, z = S.trees.filter((x) => x.zoneId === b).map((x) => x.id); return S.review.ids.some((id) => z.includes(S.byId.get(id).treeId)); }, where.b), false, "watering everything skips Settled");
await page.click("#reviewClose"); await page.waitForSelector("#review[hidden]", { state: "attached" });

// The island back to Focus: topic a follows, b keeps its own Settled.
await page.evaluate((id) => { const i = bonsai.S.garden.islands.findIndex((q) => q.id === id); document.querySelector(`.tag.isle[data-isle="${i}"]`).click(); }, where.isle);
await page.waitForSelector("#isleLevel");
await page.keyboard.press("Shift+Digit1");
await page.waitForFunction((id) => bonsai.zoneLevel(id) === "focus", where.a);
const s4 = await look();
t.eq([s4.la, s4.lb], ["focus", "settled"], "a topic with its own level keeps it when the island changes");
// ⇧0 sends it back to its island's
await page.$eval(`.tag.topic[data-isle="${where.i}"][data-topic="${where.kb}"]`, (e) => e.click());
await page.waitForSelector("#topicLevel");
await page.keyboard.press("Shift+Digit0");
await page.waitForFunction((id) => bonsai.zoneLevel(id) === "focus", where.b);
t.eq(await state(page, (id) => "level" in (bonsai.S.garden.zone[id] || {}), where.b), false, "⇧0: the topic follows its island again");
t.eq(await page.$eval("#topicLevel button[aria-pressed=true]", (b) => b.dataset.level), "isle", "and the control shows it");

// An exam topic starts at Keep, whatever its island says.
const ex = await state(page, async () => {
  const E = await import("./exams.js"), map = E.readMap("map: focus-test\ntopic: Optics\ntier: One\ngraph: Light\nReflection | bounces\n  Mirror | flat"), key = E.ideaKey("Reflection");
  const exam = E.readExam(JSON.stringify(E.exportExam([map], { [map.id]: { ideas: { [key]: 1 }, links: {} } })));
  const z = await bonsai.store.createZone({ name: "Optics" }); await bonsai.store.importExam(z.id, E.planExam(exam)); await bonsai.refresh();
  return [bonsai.zoneLevel(z.id), bonsai.S.garden.zone[z.id]?.level ?? null];
});
t.eq(ex, ["keep", null], "an exam topic starts at Keep without anything saved");
await t.end();
