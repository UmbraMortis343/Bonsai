// Strength (his call, 2026-11-25): the garden, Shaky (H) and the month follow how his answers go, not what's overdue.
// A topic's health is its answers of the last 30 days (right 1, partly 0.5, missed 0; the weight halving every 10
// days); under 5 answers, or Settled, it's lush; weak bottoms out pale but alive. Shaky marks an idea whose latest
// answer was missed, or 2 of whose last 4 were missed or partly. The month lists its shakiest topics with Practise
// (⇧1–3). Today shows "+N waiting" when more is due than a week of Today takes, and B sets a topic to Keep or Settled.
import { start, state } from "./lib.mjs";
import { answersFrom, strengthOf, healthOf, isShaky, shakiest, FLOOR, MIN } from "../src/strength.js";
import { backlog, BACKLOG_DAYS, DAILY } from "../src/today.js";
import { createHistory } from "../src/history.js";

const t = await start("run50-strength", 4350, { channel: "beta" });
const DAY = 86400000, H = 3600000, iso = (x) => new Date(x).toISOString();

// ----- pure -----
{
  const T = Date.parse("2026-11-25T10:00:00Z"), ev = (ref, ago, type, v) => ({ type, ref, at: iso(T - ago), data: type === "node.review" ? { rating: v } : { mark: v } });
  const A = answersFrom([ev("a", DAY, "node.review", "again"), ev("a", 2 * DAY, "node.practise", "right"), ev("a", 3 * DAY, "node.review", "hard"), ev("a", 3 * DAY, "node.review", "void"), ev("a", 3 * DAY, "node.edit", "x")]);
  t.eq(A.get("a").map((x) => x.s), [0.5, 1, 0], "answers: reviews and practice scored 0.5, 1, 0, oldest first; void and edits aren't answers");
  const L = (list) => list.map(([ago, s]) => ({ at: T - ago * DAY, s })).sort((x, y) => x.at - y.at);
  const late = L([[25, 1], [24, 1], [23, 1], [1, 0], [0.5, 0]]), early = L([[25, 0], [24, 0], [23, 0], [1, 1], [0.5, 1]]);
  const sl = strengthOf([late], T).score, se = strengthOf([early], T).score;
  t.eq([sl < 0.5, se > 0.5, sl < se], [true, true, true], "recent answers weigh more: the same marks, the misses late or early");
  t.eq([strengthOf([L([[1, 0], [2, 0], [3, 0], [4, 0]])], T), MIN], [{ n: 4, score: null }, 5], "under 5 answers: no strength");
  t.eq(strengthOf([L([[1, 1], [2, 1], [3, 1], [4, 1], [40, 0], [50, 0]])], T).score, null, "answers older than 30 days don't count");
  t.eq(strengthOf([L([[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]), L([[-1, 0], [-2, 0]])], T).score, 1, "nor do later ones (the timelapse asks for a moment)");
  t.eq([healthOf(null), healthOf(1), healthOf(0.85), healthOf(0.2), healthOf(0) >= 0.3, Math.round(healthOf(0.625) * 100) / 100], [1, 1, 1, FLOOR, true, 0.73], "health: neutral, full from 85%, pale but alive at worst");
  t.eq([isShaky(L([[3, 1], [1, 0]]), T), isShaky(L([[5, 0.5], [4, 1], [3, 0.5], [1, 1]]), T), isShaky(L([[3, 1], [2, 0.5], [1, 1]]), T), isShaky(L([[40, 0]]), T), isShaky(L([[9, 0], [8, 0], [5, 1], [4, 1], [3, 1], [1, 1]]), T), isShaky([], T)],
    [true, true, false, false, false, false], "Shaky: the latest missed, or 2 of the last 4 weak; one partly, a miss long ago, misses since put right, or no answers: not");
  const evs = [..."aaaa"].map((_, i) => ev("p" + i, H * (i + 1), "node.review", i ? "good" : "again")).concat([..."bbbbb"].map((_, i) => ev("q" + i, H * (i + 1), "node.practise", i < 3 ? "missed" : "right")), [ev("r0", H, "node.review", "again"), ev("r1", H, "node.review", "again")], [..."cccc"].map((_, i) => ev("s" + i, H, "node.review", "good")));
  const top = (id) => ({ p: "P", q: "Q", r: "R", s: "S" })[id[0]];
  t.eq(shakiest(evs, top, T - DAY, T + 1).map((x) => [x.id, x.pct, x.n, x.missed]), [["Q", 40, 5, 3], ["P", 75, 4, 1]], "the shakiest: lowest share right first; under 4 answers or all right left out");
  const item = (id, zone) => ({ id, zone });
  const pool = { focus: Array.from({ length: 75 }, (_, i) => item("f" + i, i < 50 ? "z1" : "z2")), keep: Array.from({ length: 6 }, (_, i) => item("k" + i, "z3")), settled: [item("s", "z4")] };
  const b = backlog(pool, { ids: ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "k0", "k1", "k2"] });
  t.eq([b.n, b.show, b.topics, BACKLOG_DAYS * DAILY], [71, true, [{ id: "z1", n: 43 }, { id: "z2", n: 25 }, { id: "z3", n: 3 }], 70], "the backlog: due beyond today's pick, Focus and Keep, more than a week's worth");
  t.eq(backlog({ focus: pool.focus.slice(0, 80) }, { ids: pool.focus.slice(0, 10).map((x) => x.id) }).show, false, "70 waiting is a week's: hidden");
  const h = createHistory({ zones: [{ id: "z", createdAt: iso(T - 30 * DAY) }], trees: [{ id: "t", zoneId: "z", rootId: "a", createdAt: iso(T - 30 * DAY) }], nodes: [{ id: "a", treeId: "t", createdAt: iso(T - 30 * DAY), note: "x" }],
    events: [5, 4, 3, 2, 1].map((d) => ev("a", d * DAY, "node.review", "again")) }, T);
  t.eq([strengthOf([h.at(T - 6 * DAY).answers.get("a")], T - 6 * DAY).score, strengthOf([h.at(T).answers.get("a")], T).score], [null, 0], "the timelapse carries the answers, and strength at a moment counts only those before it");
}

// ----- the app (the beta's demo garden) -----
const page = await t.page({}, "#/");
await page.evaluate(() => bonsai.isles?.setActive(false));
// answers are written into the log as the app would, at chosen times
const putEvents = (list) => state(page, async (list) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open("bonsai-beta"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction("events", "readwrite"); for (const e of list) tx.objectStore("events").put(e); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close(); await bonsai.refresh();
}, list);
const G = await state(page, () => {
  const S = bonsai.S, z = (name) => S.zones.find((x) => x.name === name), ideas = (name) => S.nodes.filter((n) => !n.ghost && S.trees.some((tr) => tr.id === n.treeId && tr.zoneId === z(name).id)).map((n) => n.id);
  const isle = (name) => S.garden.islands.find((q) => q.name === name);
  const of = (isl) => isl.zoneIds.map((id) => S.zones.find((x) => x.id === id)?.name).filter(Boolean);
  const mech = S.trees.filter((tr) => tr.zoneId === z("Mechanics").id).map((tr) => ({ id: tr.id, n: (S.byTree.get(tr.id) || []).filter((n) => n.parentId).map((n) => n.id) })).find((x) => x.n.length >= 5);
  return { found: of(isle("Foundations")).flatMap(ideas), maths: of(isle("Maths")).flatMap(ideas), music: of(isle("Music")).map((n) => [n, z(n).id, ideas(n)]), shop: of(isle("Workshop")).map((n) => [n, z(n).id, ideas(n)]), matter: [z("Matter").id, ideas("Matter")], energy: [z("Energy").id, ideas("Energy")], living: [z("Living things").id, ideas("Living things")], mech };
});
const now = Date.now(), E = [];
let k = 0; const ans = (ref, ago, rating, type = "node.review") => E.push({ id: "t50-" + k++, at: iso(now - ago), type, ref, data: type === "node.review" ? { rating } : { mark: rating } });
for (const [, , ids] of G.music) for (const id of ids) { ans(id, 3 * H, "good"); ans(id, 2 * H, "right", "node.practise"); }
for (const [, , ids] of G.shop) for (const id of ids) { ans(id, 2 * H, "again"); ans(id, H, "hard"); }
for (const id of G.matter[1].slice(0, 4)) ans(id, H, "again");
for (const id of G.found) { ans(id, 2 * DAY, "good"); ans(id, H, "easy"); }   // for the picture: a lush island beside a shaky one
for (const id of G.maths) { ans(id, 2 * DAY, "again"); ans(id, H, "missed", "node.practise"); }
for (const id of G.energy[1].slice(0, 5)) { ans(id, 25 * DAY, "good"); ans(id, DAY, "again"); }
for (const id of G.living[1].slice(0, 5)) { ans(id, 25 * DAY, "again"); ans(id, DAY, "good"); }
const [a, b, c, d, e] = G.mech.n;
ans(a, 3 * DAY, "good"); ans(a, DAY, "again");
ans(b, 5 * DAY, "partly", "node.practise"); ans(b, 4 * DAY, "good"); ans(b, 3 * DAY, "hard"); ans(b, DAY, "good");
ans(c, 3 * DAY, "good"); ans(c, 2 * DAY, "partly", "node.practise"); ans(c, DAY, "good");
ans(d, 40 * DAY, "again");
ans(e, 2 * DAY, "good"); ans(e, DAY, "easy");
await putEvents(E);
// every Music idea long past due (60 days): no matter, its answers are good
await state(page, async (ids) => { const S = bonsai.S, due = new Date(Date.now() - 60 * 86400000).toISOString(), set = new Set(ids);
  await bonsai.store.restoreRows({ nodes: S.nodes.filter((n) => set.has(n.id)).map((n) => ({ ...n, srs: { interval: 3, ease: 2.5, reps: 2, lapses: 0, passes: 2, due }, reviewedAt: new Date(Date.now() - 63 * 86400000).toISOString() })) }); await bonsai.refresh(); }, G.music.flatMap((x) => x[2]));

const topic = (id) => state(page, (id) => { const x = bonsai.S.model.flatMap((q) => q.topics).find((q) => q.id === id); return { health: x.health, strength: x.strength, due: x.due.length }; }, id);
const music = await Promise.all(G.music.map((x) => topic(x[1]))), shop = await Promise.all(G.shop.map((x) => topic(x[1])));
t.eq([music.every((x) => x.health === 1 && x.strength === 1), music.some((x) => x.due > 0)], [true, true], "long overdue but answered well: lush");
t.eq(shop.map((x) => x.health === FLOOR), shop.map(() => true), "missed and partly: pale, as far as it goes");
t.eq(shop.every((x) => x.health >= 0.3), true, "never so far that bones or birds come");
const matter = await topic(G.matter[0]);
t.eq([matter.health, matter.strength], [1, null], "four answers, all missed: too few to judge, lush");
const energy = await topic(G.energy[0]), living = await topic(G.living[0]);
t.eq([energy.health < living.health, living.health > 0.95, energy.health], [true, true, FLOOR], "the same marks weigh by when: misses yesterday pale it, misses weeks ago hardly");
await state(page, (id) => bonsai.setLevel({ zoneId: id, level: "settled" }), G.shop[0][1]);
t.eq((await topic(G.shop[0][1])).health, 1, "Settled: lush whatever the answers");
await state(page, (id) => bonsai.setLevel({ zoneId: id, level: null }), G.shop[0][1]);
t.eq((await topic(G.shop[0][1])).health, FLOOR, "and back");
// the garden panel says how it's going
await page.$eval('.tag.hub[data-hub="2"]', (x) => x.click());
await page.waitForFunction(() => bonsai.S.hub === 2);
const wsIsle = await state(page, () => bonsai.S.model.findIndex((q) => q.name === "Workshop"));
await page.$eval(`.tag.topic[data-isle="${wsIsle}"][data-topic="0"]`, (x) => x.click());
await page.waitForSelector("#topicStrength");
t.eq(await page.textContent("#topicStrength"), "25% right", "the topic's panel: its strength");
await page.keyboard.press("Escape"); await page.waitForTimeout(200); await page.keyboard.press("Escape");
await page.waitForFunction(() => bonsai.S.isle < 0);
// the pictures: Academics, Foundations answered well beside Maths missed; then the two close up
await page.$eval('.tag.hub[data-hub="0"]', (x) => x.click());
await page.waitForFunction(() => bonsai.S.hub === 0);
await page.evaluate(() => bonsai.isles.setActive(true));
await page.waitForTimeout(3000);
await page.screenshot({ path: "tests/shots/strength-garden.png" });
for (const name of ["Foundations", "Maths"]) {
  await page.evaluate((name) => bonsai.isles.focus(bonsai.S.model.findIndex((q) => q.name === name)), name);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `tests/shots/strength-garden-${name.toLowerCase()}.png` });
}
await page.evaluate(() => bonsai.isles.setActive(false));

// the timelapse replays it: before the answers the Workshop was lush
const past = await state(page, async (id) => {
  const { createHistory } = await import("./history.js"), S = bonsai.S, events = await bonsai.store.listEvents(), now = Date.now();
  const h = createHistory({ zones: S.allZones, trees: S.allTrees, nodes: S.nodes, links: S.links, events, pages: S.pages }, now);
  const at = (t) => bonsai.strength.model(h.at(t)).flatMap((q) => q.topics).find((x) => x.id === id)?.health;
  return [at(now - 2 * 86400000), at(now)];
}, G.shop[0][1]);
t.eq(past, [1, FLOOR], "the timelapse: lush before the misses, pale after");

// ----- Shaky (H) in the knowledge view -----
await page.evaluate(() => { location.hash = "#/forest"; }); await page.waitForFunction(() => bonsai.S.view === "forest");
t.eq([await page.getAttribute("#viewShaky", "aria-pressed"), await state(page, (id) => bonsai.strength.marked(id), G.mech.id)], ["false", []], "Shaky starts off: nothing ochre");
await page.keyboard.press("h");
t.eq(await page.getAttribute("#viewShaky", "aria-pressed"), "true", "H turns it on");
t.eq((await state(page, (id) => bonsai.strength.marked(id), G.mech.id)).sort(), [a, b].sort(), "exactly the shaky ideas go ochre: the latest missed, 2 of the last 4 weak");
await page.evaluate((id) => { location.hash = "#/tree/" + id; }, G.mech.id); await page.waitForSelector(".lbl.trunk");
await page.waitForFunction(() => bonsai.S.view === "tree");
const pick = async (id) => { const n = await state(page, (id) => bonsai.S.num.get(id), id); await page.keyboard.type(String(n)); await page.waitForFunction((id) => bonsai.S.sel === id, id); await page.waitForTimeout(950); };
await pick(c);
t.eq(await page.$$eval('#actions [data-act="practise"]', (x) => x.length), 0, "a steady idea: no Practise in its bar");
await pick(a);
t.eq(await page.$$eval('#actions [data-act="practise"]', (x) => x.length), 1, "a shaky idea picked: Practise P in its bar");
await page.keyboard.press(" "); await page.waitForSelector("#shakyTag");
t.eq(await page.textContent("#shakyTag .chip"), "Shaky", "and its panel says so, with Practise");
await page.waitForTimeout(600);
await page.screenshot({ path: "tests/shots/strength-shaky.png" });
await page.click("#shakyPractise");
await page.waitForFunction(() => bonsai.practise.state);
t.eq(await state(page, () => bonsai.practise.state.scope.id), G.mech.id, "Practise from it practises its graph");
await page.keyboard.press("Escape"); await page.waitForFunction(() => !bonsai.today.open);
await page.keyboard.press("h");
t.eq(await state(page, () => localStorage.getItem("bonsai-beta.shaky")), "0", "H again: off, remembered");

// ----- Month in review: the shakiest topics, each with Practise -----
await page.evaluate(() => { location.hash = "#/"; }); await page.waitForFunction(() => bonsai.S.view === "isles");
await page.evaluate(() => bonsai.isles?.setActive(false));
const ym = await state(page, () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
await page.evaluate((ym) => bonsai.month.show(ym), ym);
await page.waitForSelector("#monthShaky");
const rows = await page.$$eval("#monthShaky .row", (r) => r.map((x) => [x.dataset.id, x.querySelector(".mvtag").textContent, x.querySelector("kbd").textContent]));
const m = await state(page, () => bonsai.month.state.m.shaky.slice(0, 3).map((x) => [x.id, x.pct, x.missed]));
t.eq([rows.length, rows.map((r) => r[0]), rows[0][2], rows[2][2], m[0][1]], [3, m.map((x) => x[0]), "⇧1", "⇧3", 0], "three shakiest, lowest share right and most missed first, keys ⇧1–3");
t.eq([m[0][1] <= m[1][1] && m[1][1] <= m[2][1], m[0][1] < m[1][1] || m[0][2] >= m[1][2], rows[0][1].endsWith(m[0][1] + "%")], [true, true, true], "lowest share right first, then most missed; the share shown");
t.eq(await page.$$eval("#monthDried, .mvtag.dry", (x) => x.length), 0, "nothing dried any more");
await page.waitForTimeout(300);
await page.screenshot({ path: "tests/shots/strength-month.png" });
await page.keyboard.press("Shift+Digit1");
await page.waitForFunction(() => bonsai.practise.state);
t.eq([await state(page, () => bonsai.practise.state.scope.id), await state(page, () => !!bonsai.month.state)], [rows[0][0], false], "⇧1 practises the shakiest; the month closes");
await page.keyboard.press("Escape"); await page.waitForFunction(() => !bonsai.today.open);

// ----- Today: the backlog -----
await page.evaluate(() => bonsai.today.show()); await page.waitForSelector("#today #todayStreak");
const bl = await state(page, () => bonsai.today.backlog());
t.eq(bl.n > 70 && bl.show, true, "the demo has more due than a week of Today");
t.eq(await page.textContent("#todayBacklog"), `+${bl.n} waitingB`, "Today's head: how many wait, key B");
const first = bl.topics[0];
await page.keyboard.press("b"); await page.waitForSelector(".menu");
const items = await page.$$eval(".menu .mi", (x) => x.map((b) => b.textContent));
t.eq([items.length <= 6, /· \d+ · Focus1$/.test(items[0])], [true, true], "the topics holding most, with their count and level");
await page.screenshot({ path: "tests/shots/strength-backlog.png" });
await page.keyboard.press("1"); await page.waitForFunction(() => [...document.querySelectorAll(".menu .mi")].some((b) => b.textContent.startsWith("Keep")));
await page.keyboard.press("k");
await page.waitForFunction((id) => bonsai.zoneLevel(id) === "keep", first.id);
const after = await state(page, () => bonsai.today.backlog().n);
t.eq(after < bl.n, true, "set to Keep there: fewer wait");
await page.waitForFunction(() => document.querySelector("#todayBacklog")?.textContent.startsWith("+" + bonsai.today.backlog().n + " ") || !document.querySelector("#todayBacklog"));
await page.click("#toast button");
await page.waitForFunction((id) => bonsai.zoneLevel(id) === "focus", first.id);
t.eq(await state(page, () => bonsai.today.backlog().n), bl.n, "Undo puts it back");
// a small backlog hides it: every island Settled but one small one
await state(page, async () => { for (const q of bonsai.S.garden.islands) await bonsai.setLevel({ isleId: q.id, level: q.name === "Leadership" ? "focus" : "settled" }); });
await page.evaluate(() => { bonsai.today.close(); return bonsai.today.show(); }); await page.waitForSelector("#today #todayStreak");
t.eq([await state(page, () => bonsai.today.backlog().show), await page.$$eval("#todayBacklog", (x) => x.length)], [false, 0], "a small backlog: nothing shown");
await t.end();
