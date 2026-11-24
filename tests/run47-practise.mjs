// Practise anything, any time (his card, 2026-11-21): a round of up to 10 from a graph, a topic or an island, due or
// not, in the Today box. Not a review: right moves the idea's due date later by a quarter of its interval (capped at
// a full good review's), partly leaves it, missed brings it to the start of tomorrow and takes 0.1 off its ease.
// Nothing else on the schedule moves, and Today's pick, score, streak and days never see it. The day's log lists it.
import { start, state } from "./lib.mjs";
import { practised, pickPractise, practiseRecord, PUSH } from "../src/practise.js";
import { rate } from "../src/srs.js";
import { dayLog } from "../src/today.js";
import { createHistory } from "../src/history.js";

const t = await start("run47-practise", 4357, { channel: "beta" });
const DAY = 86400000, iso = (x) => new Date(x).toISOString();
const midnight = (x) => { const d = new Date(x); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d.getTime(); };

// ----- pure -----
const T = Date.parse("2026-11-24T10:00:00Z");
const node = (srs, extra = {}) => ({ id: "a", createdAt: "2026-10-01T00:00:00Z", note: "x", srs, ...extra });
const S8 = { interval: 8, ease: 2.5, reps: 3, lapses: 0, passes: 3, due: iso(T + 3 * DAY) };
t.eq(practised(node(S8), "right", T).due, iso(T + 3 * DAY + PUSH * 8 * DAY), "right: a quarter of the interval later");
t.eq(practised(node({ ...S8, due: iso(T - 5 * DAY) }), "right", T).due, iso(T + 2 * DAY), "right when overdue: counted from now");
const near = { ...S8, interval: 1, reps: 1, due: iso(T + 2.9 * DAY) };   // a good review now would give 3 days
t.eq(practised(node(near), "right", T).due, iso(T + 3 * DAY), "right: never past a full good review's date");
t.eq(practised(node({ ...near, due: iso(T + 10 * DAY) }), "right", T), null, "right never brings a date in");
t.eq(practised(node(S8), "partly", T), null, "partly: nothing moves");
const miss = practised(node(S8), "missed", T);
t.eq([miss.due, miss.ease, miss.interval, miss.reps, miss.lapses], [iso(midnight(T)), 2.4, 8, 3, 0], "missed: the start of tomorrow, ease 0.1 down, nothing else");
t.eq(practised(node({ ...S8, due: iso(T - DAY) }), "missed", T).due, iso(T - DAY), "missed never pushes a date out");
t.eq(practised(node({ ...S8, ease: 1.3 }), "missed", T).ease, 1.3, "the ease stops at 1.3");
t.eq([practised(node(undefined), "right", T), practised(node(undefined), "missed", T), practised(node(S8, { ghost: true }), "missed", T)], [null, null, null], "no schedule yet, or greyed: nothing");
// Keep (×2): the rules work on the date as read, and store it back without the stretch
const kr = practised(node(S8), "right", T, 2), km = practised(node(S8), "missed", T, 2);
t.eq([Date.parse(kr.due) + 8 * DAY, Date.parse(km.due) + 8 * DAY], [T + 3 * DAY + 8 * DAY + PUSH * 16 * DAY, midnight(T)], "Keep: a quarter of the stretched interval; missed is due tomorrow as read");
t.eq(rate({ srs: S8 }, "good", T).interval, 20, "(the cap: srs's good interval)");
// the pick: longest unseen and weakest first, taking turns between groups, ten at most, never twice in a sitting
const items = Array.from({ length: 14 }, (_, i) => ({ id: "n" + i, group: "g" + (i % 2), seen: T - (i + 2) * DAY, reviewed: true, ease: 2.5, lapses: 0 }));
items.push({ id: "weak", group: "g0", seen: T - 2 * DAY, reviewed: true, ease: 1.5, lapses: 2 });
const p1 = pickPractise(items, { now: T });
t.eq([p1.length, p1[0].id, p1.some((x) => x.id === "weak"), p1.some((x) => x.id === "n0")], [10, "n13", true, false], "ten, the oldest first, the weak one in, the freshest out");
t.eq(p1.slice(0, 4).map((x) => x.group), ["g1", "g0", "g1", "g0"], "taking turns between groups");
const p2 = pickPractise(items, { now: T, skip: new Set(p1.map((x) => x.id)) });
t.eq([p2.length, p2.some((x) => p1.includes(x))], [5, false], "another round: what's left");
t.eq(practiseRecord(["a", "b", "c", "d"], { a: "right", b: "partly", c: "void" }), { n: 2, asked: 2, good: 1, done: true }, "the score: right ones of those answered");
// the day's log and the timelapse
const L = dayLog("2026-11-24", { events: [{ type: "node.practise", ref: "a", at: "2026-11-24T01:00:00", data: { mark: "missed" } }, { type: "node.practise", ref: "a", at: "2026-11-24T02:00:00", data: { mark: "right" } }], nodes: [{ id: "a", title: "A", createdAt: "2026-01-01" }] });
t.eq([L.practised, L.reviewed], [[{ id: "a", title: "A", mark: "right" }], []], "the day's log: practised, the last mark; not reviewed");
const H = createHistory({ nodes: [{ id: "a", createdAt: iso(T - 20 * DAY), srs: { ...S8, due: iso(T + 5 * DAY) } }], events: [{ type: "node.review", ref: "a", at: iso(T - 10 * DAY), data: { rating: "good" } }, { type: "node.practise", ref: "a", at: iso(T - 5 * DAY), data: { mark: "right", due: iso(T - 2 * DAY) } }, { type: "node.review", ref: "a", at: iso(T - DAY), data: { rating: "good" } }] }, T);
t.eq([H.at(T - 7 * DAY).nodes[0].srs.due, H.at(T - 4 * DAY).nodes[0].srs.due], [rate({}, "good", T - 10 * DAY).due, iso(T - 2 * DAY)], "the timelapse replays a practice's move");

// ----- the app, with a stand-in Claude that marks as the answer says -----
const bridge = () => {
  window.bonsaiDesktop = { update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: () => () => {}, cancel: () => {},
    ask: async (req) => {
      await new Promise((r) => setTimeout(r, 20));
      const said = (req.prompt.match(/My answer: (\w+)/) || [])[1] || "missed";
      return { ok: true, text: JSON.stringify({ mark: said, why: "Marked " + said }) };
    },
  } };
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge);
const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));
const key = (k) => page.keyboard.press(k);

// Numbers (15 ideas, Focus): every idea a schedule and a last review, one weak, one greyed, one with nothing to recall
const NOW = Math.floor(Date.now() / 1000) * 1000;
const G = "t-t";
const set = await state(page, async ({ G, NOW, DAY }) => {
  const S = bonsai.S, iso = (x) => new Date(x).toISOString();
  bonsai.today.setClock(NOW);
  const list = S.nodes.filter((n) => n.treeId === G).sort((a, b) => a.id.localeCompare(b.id));
  const leaf = list.find((n) => n.parentId && !S.nodes.some((x) => x.parentId === n.id));
  const rows = list.map((n, k) => ({ ...n, reviewedAt: iso(NOW - (k + 2) * DAY), srs: { interval: 8, ease: 2.5, reps: 3, lapses: 0, passes: 3, due: iso(NOW + ((k % 5) + 1) * DAY) } }));
  const weak = rows.find((n, k) => k >= 3 && n.id !== leaf.id), ghost = rows.find((n) => n.id !== leaf.id && n.parentId && n !== weak && rows.indexOf(n) > 5);
  weak.reviewedAt = iso(NOW - DAY); weak.srs = { ...weak.srs, ease: 1.5, lapses: 2 };
  ghost.ghost = true; delete ghost.srs;
  const bare = rows.find((n) => n.id === leaf.id); bare.note = ""; bare.body = "";
  await bonsai.store.restoreRows({ nodes: rows }); await bonsai.refresh();
  return { ids: list.map((n) => n.id), weak: weak.id, ghost: ghost.id, bare: bare.id, zone: S.trees.find((x) => x.id === G).zoneId, level: bonsai.zoneLevel(S.trees.find((x) => x.id === G).zoneId) };
}, { G, NOW, DAY });
t.eq(set.level, "focus", "(Numbers is on Focus)");
const pool = await state(page, (G) => bonsai.practise.pool(G), G);
t.eq([pool.length, pool.includes(set.ghost), pool.includes(set.bare)], [13, false, false], "the pool: no greyed idea, none with nothing to recall");

// Today's pick and days, made before
await key("y"); await page.waitForSelector("#today #todayStreak"); await key("Escape");
const snap = () => state(page, () => ({ pick: JSON.stringify(bonsai.today.pick()), days: JSON.stringify(bonsai.today.days()), streak: document.querySelector("#todayStreak b")?.textContent ?? null, srs: Object.fromEntries(bonsai.S.nodes.map((n) => [n.id, JSON.stringify(n.srs || null)])), nodes: Object.fromEntries(bonsai.S.nodes.map((n) => [n.id, n])) }));
const before = await snap();
const evs = (type) => state(page, async (type) => (await bonsai.store.eventsSince("2000-01-01")).filter((e) => e.type === type).map((e) => ({ ref: e.ref, ...e.data })), type);
const reviewsBefore = (await evs("node.review")).length;

// 1. from a graph's menu in the Library's Graphs tab
await page.keyboard.press("Shift+Digit2");
await page.waitForSelector(`[data-shelf="i:found"]`);
if (!(await page.$(`.nrow.graph[data-tree="${G}"]`))) {
  if ((await page.getAttribute(`[data-shelf="i:found"]`, "aria-expanded")) !== "true") await page.click(`[data-shelf="i:found"] .nname`);
  if ((await page.getAttribute(`[data-shelf="t:${set.zone}"]`, "aria-expanded")) !== "true") await page.click(`[data-shelf="t:${set.zone}"] .nname`);
}
await page.click(`.nrow.graph[data-tree="${G}"]`, { button: "right" }); await page.waitForSelector(".menu");
const item = await page.$$eval(".menu .mi", (b) => b.map((x) => [x.querySelector("span").textContent, x.querySelector("kbd")?.textContent || ""]).find((x) => x[0] === "Practise"));
t.eq(item, ["Practise", "P"], "a graph's menu: Practise P");
await page.click(".menu .mi:has-text('Practise')");
await page.waitForSelector("#tq #tqAnswer");
const r1 = await state(page, () => ({ ids: bonsai.S.tq.ids, scope: bonsai.practise.state.scope.kind, name: document.querySelector("#prScope")?.textContent, count: document.querySelector("#tqCount")?.textContent }));
const want = pickPractise(pool.map((id) => { const n = before.nodes[id]; return { id, group: "", seen: Date.parse(n.reviewedAt), reviewed: true, ease: n.srs.ease, lapses: n.srs.lapses }; }), { now: NOW }).map((x) => x.id);
t.eq([r1.scope, r1.name, r1.count, r1.ids.length], ["graph", "Numbers", "1/10", 10], "a round of ten, the graph's name over it");
t.eq(r1.ids, want, "in order: longest unseen and weakest first");
t.eq([r1.ids.includes(set.weak), r1.ids.includes(set.ghost)], [true, false], "the weak one in, no greyed one");
await page.screenshot({ path: "tests/shots/practise-round.png" });

const answer = async (text) => { await page.waitForFunction(() => document.activeElement?.id === "tqAnswer"); await page.keyboard.type(text); await key("Enter"); await page.waitForSelector("#tqMark"); await key("Enter"); };
await answer("right"); await page.waitForFunction(() => bonsai.S.tq?.i === 1 && bonsai.S.tq.phase === "ask");
await answer("partly"); await page.waitForFunction(() => bonsai.S.tq?.i === 2 && bonsai.S.tq.phase === "ask");
await answer("missed"); await page.waitForFunction(() => bonsai.S.tq?.i === 3 && bonsai.S.tq.phase === "ask");
await key("Escape"); await page.waitForSelector("#prEnd #prScore");
t.eq([await page.textContent("#prScore"), await page.getAttribute("#prScore", "class"), await page.$$eval("#prQs .tdq", (q) => q.map((x) => x.className.replace("tdq ", "")))], ["1", "tdscore short", ["ok", "hard", "miss"]], "stopped: one right, coloured as Today's, a square each");
t.eq(await page.$$eval("#prEnd button", (b) => b.map((x) => x.textContent)), ["Esc", "Another 3↵", "DoneEsc"], "Another 3 ↵ (three left), Done Esc");
await page.screenshot({ path: "tests/shots/practise-end.png" });

const after1 = await snap();
const [a, b, c] = r1.ids, sa = JSON.parse(before.srs[a]), sc = JSON.parse(before.srs[c]);
t.eq(JSON.parse(after1.srs[a]).due, iso(Math.min(Math.max(Date.parse(sa.due), NOW) + PUSH * Math.max(sa.interval, 1) * DAY, Date.parse(rate({ srs: sa }, "good", NOW).due))), "right: due a quarter of its interval later");
t.eq(JSON.parse(after1.srs[a]), practised(before.nodes[a], "right", NOW), "(as practise.js says)");
t.eq(after1.srs[b], before.srs[b], "partly: unchanged");
t.eq([JSON.parse(after1.srs[c]).due, JSON.parse(after1.srs[c]).ease], [iso(Math.min(Date.parse(sc.due), midnight(NOW))), Math.round((sc.ease - 0.1) * 100) / 100], "missed: due tomorrow, ease down 0.1");
const others = Object.keys(before.srs).filter((id) => ![a, c].includes(id) && before.srs[id] !== after1.srs[id]);
t.eq(others, [], "nothing else on the schedule moved");
t.eq([after1.pick === before.pick, after1.days === before.days], [true, true], "Today's pick and days untouched");
t.eq([(await evs("node.review")).length - reviewsBefore, (await evs("node.practise")).map((e) => e.ref + ":" + e.mark).sort()], [0, [a + ":right", b + ":partly", c + ":missed"].sort()], "logged as practice, not reviews");
t.eq(await state(page, (ids) => ids.map((id) => !!bonsai.S.byId.get(id).practisedAt), [a, b, c]), [true, true, true], "practisedAt kept for the next pick");

// 2. Another 3: the rest, never one already asked; then no more
await key("Enter"); await page.waitForSelector("#tq #tqAnswer");
const r2 = await state(page, () => bonsai.S.tq.ids);
t.eq([r2.length, r2.some((id) => r1.ids.includes(id)), [...r1.ids, ...r2].sort().join() === [...pool].sort().join()], [3, false, true], "Another: the three left");
for (let i = 0; i < 3; i++) { await key(" "); await page.waitForSelector("#tqRate"); await key("1"); await page.waitForFunction((i) => !bonsai.S.tq || bonsai.S.tq.i === i + 1, i); }
await page.waitForSelector("#prEnd #prScore");
t.eq([await page.textContent("#prScore"), await page.getAttribute("#prScore", "class"), !!(await page.$("#prMore")), await page.textContent("#prDone")], ["3", "tdscore good", false, "Done↵"], "all three right; nothing left, Done ↵");
await key("Enter"); await page.waitForFunction(() => !bonsai.S.pr && !document.querySelector("#prEnd"));
const after2 = await snap();
t.eq([after2.pick === before.pick, after2.days === before.days, after2.streak], [true, true, before.streak], "Today's pick, days and streak untouched");
t.eq(Object.keys(before.srs).filter((id) => before.srs[id] !== after2.srs[id]).sort(), [a, c, ...r2].sort(), "only the practised ones that were right or missed moved");

// 3. the calendar's day log
await key("y"); await page.waitForSelector("#todayLog #logPractised");
t.eq(await page.$$eval("#logPractised li", (l) => l.length), 6, "Today's log: Practised, six");
t.eq(await page.$$eval("#logPractised .tdrate", (l) => l.map((x) => x.textContent).sort()), ["Missed", "Partly", "Right", "Right", "Right", "Right"], "each with its mark");
t.eq(await page.$("#logReviewed"), null, "and none as reviewed");
await key("Escape");

// 4. a topic from the garden panel, an island with P
await page.evaluate(() => { location.hash = "#/"; }); await page.waitForFunction(() => bonsai.S.view === "isles");
await page.evaluate(() => bonsai.isles?.setActive(false));
for (let i = 0; i < 4 && (await state(page, () => bonsai.S.topic)) < 0; i++) { await key("1"); await page.waitForTimeout(150); }
const topic = await state(page, () => { const S = bonsai.S, isl = S.model[S.isle]; return { id: isl.topics[S.topic].id, isle: isl.id }; });
await page.waitForSelector("#practiseBtn");
t.eq(await page.textContent("#practiseBtn kbd"), "P", "the garden panel: Practise P");
await page.click("#practiseBtn"); await page.waitForSelector("#tq #tqAnswer");
const r3 = await state(page, (z) => ({ kind: bonsai.practise.state.scope.kind, id: bonsai.practise.state.scope.id, inTopic: bonsai.S.tq.ids.every((id) => bonsai.S.trees.find((t) => t.id === bonsai.S.byId.get(id).treeId).zoneId === z) }), topic.id);
t.eq(r3, { kind: "topic", id: topic.id, inTopic: true }, "a topic's round asks only its ideas");
await key("Escape"); await page.waitForFunction(() => !bonsai.S.pr && !bonsai.S.todayOpen);
t.eq(await page.$("#prEnd"), null, "stopped before any answer: straight out");
await key("Escape"); await page.waitForFunction(() => bonsai.S.topic < 0);
await page.waitForSelector("#practiseBtn");
await key("p"); await page.waitForSelector("#tq #tqAnswer");
const r4 = await state(page, () => ({ kind: bonsai.practise.state.scope.kind, id: bonsai.practise.state.scope.id, n: bonsai.S.tq.ids.length, pool: bonsai.practise.pool(bonsai.practise.state.scope.id).length }));
t.eq([r4.kind, r4.id, r4.n], ["isle", topic.isle, Math.min(10, r4.pool)], "P on an island: its round");
await key("Escape"); await page.waitForFunction(() => !bonsai.S.pr);

// 5. Knowledge: Practise P in its bar
await page.evaluate(() => { location.hash = "#/forest"; }); await page.waitForSelector("#viewPractise");
t.eq(await page.textContent("#viewPractise kbd"), "P", "Knowledge's bar: Practise P");
await state(page, () => bonsai.today.setClock(null));
await ctx.close();

// ----- the phone: Show, then Got it or Missed -----
const pctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), phone = await pctx.newPage();
phone.on("pageerror", (e) => t.fail("phone page error: " + e.message));
await phone.goto(t.url + "#/notes"); await phone.waitForSelector("body[data-ready]");
const P0 = Math.floor(Date.now() / 1000) * 1000;
const pb = await state(phone, async (P0) => { bonsai.today.setClock(P0); const S = bonsai.S; return Object.fromEntries(S.nodes.map((n) => [n.id, n])); }, P0);
await state(phone, () => bonsai.practise.start("t-2v"));
await phone.waitForSelector("#tq #tqShow");
t.eq(await phone.textContent("#prScope"), "Algebra", "the phone: the graph's name over the round");
const pids = await state(phone, () => bonsai.S.tq.ids);
await phone.tap("#tqShow"); await phone.waitForSelector("#tqRate");
t.eq(await phone.$$eval("#tqRate .btn", (b) => b.map((x) => x.firstChild.textContent)), ["Got it", "Missed"], "Got it or Missed");
await phone.tap("#tqRate [data-mark=right]"); await phone.waitForFunction(() => bonsai.S.tq?.i === 1);
await phone.tap("#tqShow"); await phone.waitForSelector("#tqRate");
await phone.tap("#tqRate [data-mark=missed]"); await phone.waitForFunction(() => bonsai.S.tq?.i === 2);
await phone.tap("#tqStop"); await phone.waitForSelector("#prEnd #prScore");
t.eq([await phone.textContent("#prScore"), await phone.$$eval("#prQs .tdq", (q) => q.length), await phone.textContent("#prMore")], ["1", 2, "Another 2↵"], "the phone's end: one right, Another 2");
await phone.screenshot({ path: "tests/shots/practise-phone.png" });
const pa = await state(phone, (ids) => ids.map((id) => bonsai.S.byId.get(id).srs), pids.slice(0, 2));
t.eq(pa, [practised(pb[pids[0]], "right", P0) || pb[pids[0]].srs, practised(pb[pids[1]], "missed", P0) || pb[pids[1]].srs], "Got it moves it later, Missed brings it in");
await phone.tap("#prDone"); await phone.waitForFunction(() => !bonsai.S.pr);
await pctx.close();
await t.end();
