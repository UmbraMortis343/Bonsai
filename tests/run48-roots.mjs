// Foundations credit (roots.js): a right answer keeps the ideas beneath it fresh, a little. One step down gets half
// the answer's interval gain, two steps a quarter, never past the idea's own interval (its wait at most doubled);
// hard and missed give nothing and take nothing; a direct review clears it; an idea kept fresh that way is asked as
// Why when it comes due, with a small Foundation tag; the idea's panel and the day's log say so quietly.
import { start, state, seed, openTree } from "./lib.mjs";
import { beneath, foundations, giveCredit, creditFor, creditDays, wasCredited, liveCredit, creditAt, keptBy, SHARE } from "../src/roots.js";
import { dueAt, rate } from "../src/srs.js";
import { assignKinds, pickToday, dayLog } from "../src/today.js";
import { createHistory } from "../src/history.js";

const t = await start("run48-roots", 4381);
const DAY = 86400000, NOW = Date.parse("2026-11-24T09:00:00Z"), iso = (x) => new Date(x).toISOString();

// ----- pure: what's beneath -----
const node = (id, treeId, parentId, extra = {}) => ({ id, treeId, parentId, title: id.toUpperCase(), createdAt: iso(NOW - 30 * DAY), ...extra });
const N = [
  node("a", "t1", null), node("b", "t1", "a"), node("c", "t1", "b"), node("d", "t1", "c"),   // a › b › c › d
  node("g", "t1", "a", { ghost: true }), node("h", "t1", "g"),                                // a › g (greyed) › h
  node("r2", "t2", null), node("k", "t2", "r2"),                                             // graph on island B, after A from b
  node("r3", "t3", null),                                                                    // island C: after A, from an idea not on A
];
const byId = new Map(N.map((n) => [n.id, n]));
const trees = new Map([["t1", { id: "t1", zoneId: "z1", rootId: "a" }], ["t2", { id: "t2", zoneId: "z2", rootId: "r2" }], ["t3", { id: "t3", zoneId: "z3", rootId: "r3" }]]);
const garden = { islands: [{ id: "A", zoneIds: ["z1"] }, { id: "B", zoneIds: ["z2"], after: "A", from: "b" }, { id: "C", zoneIds: ["z3"], after: "A", from: "k" }] };
const links = [{ fromId: "d", toId: "r3" }];
const ctx = { byId, trees, garden, links };
const ids = (id) => foundations(byId.get(id), ctx).map((r) => `${r.id}${r.step}`);
t.eq(ids("d"), ["c1", "b2"], "an idea's parent one step down, grandparent two");
t.eq(ids("b"), ["a1"], "under the graph's first idea, only that");
t.eq(ids("a"), [], "a first idea on an island that grows from nothing has none");
t.eq(ids("r2"), ["b1", "a2"], "a graph's first idea: the idea its island grows from, on the island it grows after");
t.eq(ids("k"), ["r21", "b2"], "and what hangs off it reaches across too");
t.eq(ids("r3"), [], "a from on another island than after doesn't count");
t.eq(ids("h"), ["a2"], "a greyed idea gets nothing, but what's under it still counts");
t.eq(beneath(byId.get("r3"), ctx), null, "links never count");

// ----- pure: credit -----
const sched = (interval, due = NOW + interval * DAY) => ({ interval, ease: 2.5, reps: 3, lapses: 0, passes: 3, due: iso(due) });
const f10 = { ...node("f", "t1", null), srs: sched(10) };
const g1 = giveCredit(f10, { gain: 4, step: 1, from: "x", now: NOW }), g2 = giveCredit(f10, { gain: 4, step: 2, from: "x", now: NOW });
t.eq([SHARE[1], SHARE[2], g1.days, g2.days], [0.5, 0.25, 2, 1], "half the gain one step down, a quarter two");
t.eq(Date.parse(dueAt(g1.node)) - Date.parse(f10.srs.due), 2 * DAY, "it waits that much longer");
t.eq([g1.node.srs, g1.node.credit.due], [f10.srs, f10.srs.due], "its schedule is untouched");
let f = f10;
for (let i = 0; i < 12; i++) f = giveCredit(f, { gain: 6, step: 1, from: "c" + i, now: NOW })?.node || f;
t.eq([creditDays(f), Date.parse(dueAt(f)) - Date.parse(f10.srs.due)], [10, 10 * DAY], "credit from many adds up only to its own interval");
t.eq(Date.parse(dueAt(f)) - (Date.parse(f10.srs.due) - 10 * DAY), 20 * DAY, "so its wait is at most twice what it was");
t.eq(giveCredit(f, { gain: 6, step: 1, from: "z", now: NOW }), null, "at the cap: no more");
t.eq([f.credit.from.length, keptBy(f)], [4, "c3"], "who kept it fresh, newest last (none after the cap)");
// with Focus levels: the stretch is times the level's mult, the cap still twice its (stretched) wait
const k2 = giveCredit(f10, { gain: 4, step: 1, from: "x", mult: 2, now: NOW }).node;
t.eq(Date.parse(dueAt(k2, 2)) - Date.parse(dueAt(f10, 2)), 4 * DAY, "on Keep the credit stretches twice as far, as its wait does");
t.eq(Date.parse(dueAt(f, 4)) - Date.parse(dueAt(f10, 4)), 40 * DAY, "and on Settled four times, still capped at its own wait");
// due already: asked directly; never reviewed, just missed, or greyed: nothing
t.eq(giveCredit({ ...f10, srs: sched(10, NOW - DAY) }, { gain: 4, step: 1, from: "x", now: NOW }), null, "an idea already due gets none");
t.eq(giveCredit({ ...f10, srs: sched(10, NOW + 2 * DAY) }, { gain: 4, step: 1, from: "x", mult: 1, now: NOW + 3 * DAY }), null, "nor once its date has passed");
t.eq([giveCredit({ ...f10, srs: undefined }, { gain: 4, step: 1, now: NOW }), giveCredit({ ...f10, srs: sched(0, NOW + DAY) }, { gain: 4, step: 1, now: NOW }), giveCredit({ ...f10, ghost: true }, { gain: 4, step: 1, now: NOW })], [null, null, null], "never reviewed, just missed, greyed: none");
// what an answer gives
const child = { srs: sched(3) }, after = rate(child, "good", NOW), roots2 = [{ node: f10, step: 1 }, { node: { ...f10, id: "f2" }, step: 2 }];
const given = creditFor({ rating: "good", before: child.srs, after, from: "c", roots: roots2, now: NOW });
t.eq(given.map((g) => g.days), [(after.interval - 3) / 2, (after.interval - 3) / 4].map((x) => Math.round(x * 100) / 100), "good: half and a quarter of the gain");
t.eq(["hard", "again"].map((r) => creditFor({ rating: r, before: child.srs, after: rate(child, r, NOW), from: "c", roots: roots2, now: NOW }).length), [0, 0], "partly and missed give nothing (and take nothing)");
// a new review voids it, even when the field is still there (a synced review)
const reviewed = { ...g1.node, srs: rate(g1.node, "good", NOW) };
t.eq([liveCredit(reviewed), wasCredited(reviewed), dueAt(reviewed)], [null, false, reviewed.srs.due], "a direct review leaves the credit void");

// ----- pure: Today asks a foundation as Why -----
const kinds = assignKinds([{ id: "p", kinds: ["recall", "why", "apply"], root: true }, { id: "q", kinds: ["recall", "apply"], root: true }, { id: "s", kinds: ["recall", "why"] }], "2026-11-24");
t.eq([kinds.p, kinds.q], ["why", "apply"], "a foundation is asked as Why when it has one, else as usual");
const pk = pickToday({ focus: [{ id: "p", zone: "z", due: 1, kinds: ["why"], root: true }, { id: "s", zone: "z", due: 2, kinds: ["recall"] }] }, "2026-11-24");
t.eq(pk.roots, ["p"], "the pick says which are foundations");
// the day's log
const L = dayLog("2026-11-24", { events: [{ type: "node.credit", ref: "b", at: "2026-11-24T10:00:00", data: { from: "d" } }, { type: "node.credit", ref: "b", at: "2026-11-24T11:00:00" }, { type: "node.credit", ref: "a", at: "2026-11-23T11:00:00" }], nodes: N });
t.eq(L.kept.map((x) => x.title), ["B"], "the log lists what was kept fresh that day, once each");
// the timelapse: credit given after t isn't there yet
const fc = { ...f10, credit: { due: f10.srs.due, days: 3, at: iso(NOW), from: [{ id: "x", days: 1, at: iso(NOW - 2 * DAY) }, { id: "y", days: 2, at: iso(NOW) }] } };
t.eq([creditAt(fc, NOW).credit.days, creditAt(fc, NOW - DAY).credit.days, creditAt(fc, NOW - 3 * DAY).credit], [3, 1, undefined], "credit replays by when it was given");
const H = createHistory({ nodes: [{ ...fc, reviewedAt: iso(NOW - 10 * DAY), createdAt: iso(NOW - 40 * DAY) }], events: [{ type: "node.review", ref: "f", at: iso(NOW - 20 * DAY), data: { rating: "good" } }] }, NOW);
const past = (x) => H.at(x).nodes[0];
const p15 = past(NOW - 15 * DAY);
t.eq([creditDays(past(NOW)), creditDays(past(NOW - DAY)), p15.credit, dueAt(p15) === p15.srs.due], [3, 1, undefined, true], "the timelapse keeps it to its own review and time");

// ----- in the app -----
const page = await t.page({ viewport: { width: 1280, height: 800 } });
await page.waitForFunction(() => window.bonsai?.store);
const ids2 = await seed(page);
await page.evaluate(() => bonsai.isles?.setActive(false));
// a schedule for each: Resistors and Ohm's law waiting 10 days out, Voltage divider at 3
const put = (rows) => state(page, async (rows) => { const S = bonsai.S, now = Date.now();
  const nodes = rows.map(([id, interval, dueIn]) => ({ ...S.byId.get(id), srs: { interval, ease: 2.5, reps: 3, lapses: 0, passes: 3, due: new Date(now + dueIn * 86400000).toISOString() }, reviewedAt: new Date(now - (interval - dueIn) * 86400000).toISOString() }));
  await bonsai.store.restoreRows({ nodes }); await bonsai.refresh(); }, rows);
await put([[ids2.Resistors, 10, 6], [ids2.basicRoot, 10, 6], [ids2["Voltage divider"], 3, 0]]);
const R = ids2.Resistors, O = ids2.basicRoot, V = ids2["Voltage divider"];
t.eq(await state(page, (id) => bonsai.rootsFor(id).map((r) => [r.id, r.step]), V), [[R, 1], [O, 2]], "in the app: parent and grandparent");
// missed: nothing
await state(page, async (id) => { await bonsai.store.reviewNode(id, "again", { roots: bonsai.rootsFor(id) }); await bonsai.refresh(); }, V);
t.eq([!!(await state(page, (id) => bonsai.S.byId.get(id).credit, R)), !!(await state(page, (id) => bonsai.S.byId.get(id).credit, O))], [false, false], "a miss gives nothing and takes nothing");
await put([[V, 3, 0]]);
const due0 = await state(page, (id) => bonsai.S.byId.get(id).srs.due, R);
await state(page, async (id) => { await bonsai.store.reviewNode(id, "good", { roots: bonsai.rootsFor(id) }); await bonsai.refresh(); }, V);
const gain = await state(page, (id) => bonsai.S.byId.get(id).srs.interval - 3, V);
const cr = await state(page, (ids) => ids.map((id) => bonsai.S.byId.get(id).credit), [R, O]);
t.eq([cr[0]?.days, cr[1]?.days, cr[0]?.due], [Math.round(gain * 50) / 100, Math.round(gain * 25) / 100, due0], "a right answer: half the gain to its parent, a quarter to the next");
// Practise (and any review that passes no roots) gives none
await put([[V, 3, 0]]);
await state(page, async (id) => { await bonsai.store.reviewNode(id, "good"); await bonsai.refresh(); }, V);
t.eq(await state(page, (id) => bonsai.S.byId.get(id).credit.days, R), cr[0].days, "a review without roots gives none");

// the panel: one quiet line
await openTree(page, ids2.basic);
await page.keyboard.press("2"); await page.waitForFunction((id) => bonsai.S.sel === id, R);
await page.keyboard.press(" ");
await page.waitForSelector("#rootTag");
t.eq(/^Kept fresh by Voltage divider · due /.test(await page.textContent("#rootTag")), true, "the panel: kept fresh by what, and when it's due");
await page.screenshot({ path: "tests/shots/roots-panel.png" });

// it comes due: Today asks it as Why, with the Foundation tag
await state(page, async (id) => { await bonsai.store.setQuestions(id, [{ kind: "recall", q: "What limits current in a circuit?", a: "A resistor", pts: ["A resistor"] }, { kind: "why", q: "Why does a resistor limit current?", a: "It opposes the flow of charge", pts: ["Opposes the flow"] }]); await bonsai.refresh(); }, R);
const later = await state(page, (id) => { const n = bonsai.S.byId.get(id); return Date.parse(n.srs.due) + n.credit.days * 86400000 + 3600000; }, R);
await page.evaluate((x) => bonsai.today.setClock(x), later);
await page.evaluate(() => { location.hash = "#/notes"; }); await page.waitForFunction(() => bonsai.S.view === "notes");
await page.keyboard.press("y"); await page.waitForSelector("#today #todayGo");
const pick = await state(page, () => bonsai.today.pick());
t.eq([pick.ids.includes(R), pick.roots?.includes(R), pick.kinds[R]], [true, true, "why"], "come due, it's in the day's pick, as Why");
await page.click("#todayGo"); await page.waitForSelector("#tq");
for (let i = 0; i < pick.ids.length; i++) {
  const at = await state(page, () => bonsai.S.tq?.ids[bonsai.S.tq.i]);
  if (at === R) break;
  await page.keyboard.press(" "); await page.waitForSelector("#tqRate"); await page.keyboard.press("2");
  await page.waitForFunction((k) => !bonsai.S.tq || bonsai.S.tq.i === k, i + 1);
}
t.eq([await page.textContent("#tqKind"), await page.textContent("#tqRoot"), await page.textContent("#tqQ")], ["Why", "Foundation", "Why does a resistor limit current?"], "the round tags it Foundation and asks Why");
await page.screenshot({ path: "tests/shots/roots-round.png" });
await page.keyboard.press(" "); await page.waitForSelector("#tqRate"); await page.keyboard.press("1");
await page.waitForFunction((id) => !bonsai.S.byId.get(id).credit, R);
t.eq(await state(page, (id) => !!bonsai.S.byId.get(id).credit, R), false, "answered directly, its credit is cleared");
await page.keyboard.press("Escape").catch(() => {});
await page.evaluate(() => bonsai.today.setClock(null));

// the day's log lists what was kept fresh
await page.evaluate(() => { if (!bonsai.today.open) bonsai.today.show(); });
await page.waitForSelector("#todayLog #logKept");
t.eq((await page.textContent("#logKept p")).includes("Resistors"), true, "the day's log: kept fresh");
await page.screenshot({ path: "tests/shots/roots-log.png" });

await t.end();
