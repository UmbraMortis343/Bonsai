// Today (Y): watering as something to click is gone; the day's 10 questions, the streak and the month take its
// place. The pick (due ideas only, longest overdue first, spread across topics, mostly Focus, some Keep, a rare
// Settled bonus) is kept for the day; a round runs through the review box and comes back with the score; the
// calendar shows each day's score and opens a day's log. A topic only dries after long neglect.
import { start, state } from "./lib.mjs";
import { pickToday, streak, recordOf, assignKinds, monthGrid, bonusDay, scoreTier } from "../src/today.js";

const t = await start("run37-today", 4338, { channel: "beta" });

// ----- pure -----
const it = (id, zone, due, kinds = ["recall"]) => ({ id, zone, due, kinds });
const pool = { focus: Array.from({ length: 12 }, (_, i) => it("f" + i, "z" + (i % 3), 100 - i)), keep: Array.from({ length: 5 }, (_, i) => it("k" + i, "zk", 50 - i)), settled: [it("s0", "zs", 0)] };
const p1 = pickToday(pool, "2026-11-23");
t.eq([p1.ids.length, p1.ids.filter((x) => x[0] === "f").length, p1.ids.filter((x) => x[0] === "k").length], [10, 7, 3], "ten a day: seven Focus, three Keep");
t.eq(p1.ids.filter((x) => x[0] === "f").sort(), ["f11", "f10", "f9", "f8", "f7", "f6", "f5"].sort(), "the longest overdue");
t.eq(new Set(p1.ids.slice(0, 4).map((id) => [...pool.focus, ...pool.keep].find((x) => x.id === id).zone)).size, 4, "taking turns between topics");
t.eq(pickToday({ focus: pool.focus.slice(0, 2), keep: pool.keep.slice(0, 3) }, "2026-11-23").ids.length, 5, "fewer due, fewer asked");
t.eq(pickToday({ focus: pool.focus.slice(0, 2), keep: pool.keep }, "2026-11-23").ids.length, 7, "Keep fills in when Focus is short");
const bonusDays = Array.from({ length: 60 }, (_, i) => `2026-${String(10 + Math.floor(i / 30)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`).filter(bonusDay);
t.eq(bonusDays.length > 4 && bonusDays.length < 24, true, "a bonus about one day in five");
const pb = pickToday(pool, bonusDays[0]);
t.eq([pb.ids.length, pb.bonus, pb.ids.at(-1)], [11, "s0", "s0"], "on a bonus day an 11th from Settled");
const kinds = assignKinds([it("a", "z", 0, ["recall", "apply"]), it("b", "z", 0, ["connect", "recall"]), it("c", "z", 0, ["connect"]), it("d", "z", 0, ["rebuild", "why"]), it("e", "z", 0, ["connect", "why"]), it("f", "z", 0, [])], "2026-11-23");
t.eq([kinds.a, kinds.c, kinds.d, Object.values(kinds).filter((k) => k === "connect").length, kinds.f], ["apply", "connect", "rebuild", 2, undefined], "kinds: Apply, Rebuild and two Connects where they can be, the rest Recall or Why");
t.eq(recordOf({ ids: ["a", "b", "c"], rated: { a: "good", b: "again" } }), { n: 3, asked: 2, good: 1, done: false }, "the score is good or easy out of those asked");
// 2026-11-22 is a Sunday: left undone it doesn't break the run
const D = (k) => ({ n: 10, asked: 10, good: 8, done: !!k });
t.eq(streak({ "2026-11-23": D(1), "2026-11-21": D(1), "2026-11-20": D(1) }, "2026-11-23"), 3, "a missed Sunday doesn't break the streak");
t.eq(streak({ "2026-11-23": D(1), "2026-11-19": D(1) }, "2026-11-23"), 1, "a missed weekday does");
t.eq(streak({ "2026-11-22": D(1), "2026-11-21": D(1) }, "2026-11-23"), 2, "today not done yet doesn't break it");
t.eq([{ n: 11, asked: 11, good: 11 }, { n: 11, asked: 11, good: 10 }, { n: 10, asked: 10, good: 10 }, { n: 10, asked: 10, good: 9 }, { n: 4, asked: 4, good: 4 }, { n: 10, asked: 0, good: 0 }].map(scoreTier), ["perfect", "good", "good", "short", "good", ""], "11 of 11 purple, ten or more green, fewer yellow, nothing asked nothing");
t.eq(monthGrid(2026, 10)[0].map((c) => c.d), [26, 27, 28, 29, 30, 31, 1], "the month starts on a Monday");

// ----- in the app -----
const page = await t.page({ viewport: { width: 1280, height: 800 } }, "#/notes");
await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));
const key = (k) => page.keyboard.press(k);

// no water anywhere
const noWater = () => page.$$eval("#waterAll, #waterTree, #gWater, #libWater, #waterTopic, #lib-water, #reviewAllGood, #winGarden .thirst", (x) => x.length);
t.eq(await noWater(), 0, "no water buttons in the Library");
const tr0 = await state(page, () => bonsai.S.trees[0].id);
const menuLabels = await state(page, (id) => bonsai.graphItems(bonsai.S.trees.find((x) => x.id === id)).filter((x) => x && x.label).map((x) => x.label), tr0);
t.eq(menuLabels.some((x) => /water|all good/i.test(x)), false, "nor in a graph's menu");
await page.evaluate((id) => { location.hash = "#/tree/" + id; }, tr0); await page.waitForSelector(".lbl.trunk");
t.eq(await noWater(), 0, "nor in a graph");
await key("w"); await page.waitForTimeout(200);
t.eq(await state(page, () => !!bonsai.S.review), false, "W waters nothing");
await page.evaluate(() => { location.hash = "#/notes"; }); await page.waitForFunction(() => bonsai.S.view === "notes");

// the mark: things are due today
await page.waitForSelector("#todayBtn #todayDot");
t.eq(await page.textContent("#todayBtn kbd"), "Y", "Today's button shows its key");
// an idea added today, for the log
const added = await state(page, async () => { const tr = bonsai.S.trees[0], n = await bonsai.store.addNode(tr.rootId, { title: "Added for today" }); await bonsai.refresh(); return n.id; });

await key("y"); await page.waitForSelector("#today #todayGo");
const pick = await state(page, () => bonsai.today.pick());
const due = await state(page, () => { const p = bonsai.today.pool(); return { focus: p.focus.map((x) => x.id), keep: p.keep.map((x) => x.id), settled: p.settled.map((x) => x.id), zone: Object.fromEntries([...p.focus, ...p.keep, ...p.settled].map((x) => [x.id, x.zone])) }; });
const lv = (id) => (due.focus.includes(id) ? "focus" : due.keep.includes(id) ? "keep" : due.settled.includes(id) ? "settled" : "");
t.eq([pick.ids.length >= Math.min(10, due.focus.length + due.keep.length), pick.ids.every((id) => lv(id)), new Set(pick.ids.map((id) => due.zone[id])).size > 2], [true, true, true], "ten due ideas, from several topics");
t.eq(pick.ids.filter((id) => lv(id) === "focus").length >= Math.min(7, due.focus.length), true, "mostly Focus");
t.eq(await page.$$eval("#todayQs .tdq", (q) => q.length), pick.ids.length, "a square for each");
await page.screenshot({ path: "tests/shots/today-start.png" });
// fixed for the day
await key("Escape"); await page.waitForSelector("#today", { state: "hidden" });
await key("y"); await page.waitForSelector("#today #todayGo");
t.eq((await state(page, () => bonsai.today.pick())).ids, pick.ids, "the pick stays for the day");
t.eq(await state(page, async () => (await bonsai.store.getMeta("today")).ids), pick.ids, "and is kept in meta, to sync");

// the round: ↵ starts it in the Today box; no Claude here, so Space shows the answer and Got it (1) or Missed (2)
const round = async (mark) => {
  await key("Enter"); await page.waitForSelector("#today #tq #tqShow");
  const n = await state(page, () => bonsai.S.tq.ids.length);
  for (let i = 0; i < n; i++) {
    await page.waitForFunction((k) => bonsai.S.tq?.i === k && bonsai.S.tq.phase === "ask", i);
    await key(" "); await page.waitForSelector("#tqRate");
    await key(String(mark(i))); await page.waitForFunction((k) => !bonsai.S.tq || bonsai.S.tq.i === k, i + 1);
  }
  await page.waitForSelector("#today #todayScore");
  return n;
};
const asked = await round((i) => (i < 2 ? 2 : 1));
const n0 = pick.ids.length;
t.eq(await page.textContent("#todayScore"), String(n0 - 2), "back on Today with the score, the number right only");
t.eq(await page.$$("#todayDot").then((x) => x.length), 0, "and the mark has gone");
t.eq(await page.textContent("#todayStreak b"), "1", "a streak of one");
const today = pick.day;
t.eq(await state(page, (d) => bonsai.today.days()[d], today), { n: n0, asked: n0, good: n0 - 2, done: true }, "the day's record");
t.eq(await page.$eval(`.tdday[data-day="${today}"]`, (e) => [e.classList.contains("today"), e.querySelector(".s")?.textContent, e.querySelector(".s")?.className]), [true, String(n0 - 2), "s short"], "the calendar shows today's score as a number, yellow under ten");

// the log: today's reviews and what was added; a Sunday session held shows on the calendar and in the log
await state(page, (d) => bonsai.store.addSunday({ day: d, turns: [], summary: "", kept: { links: 2, notes: 1, questions: 0, fuzzy: 0 }, saved: true }), today);
await state(page, () => bonsai.refresh());
await page.waitForSelector("#todayLog #logReviewed");
t.eq(await page.$$eval("#logReviewed li", (r) => r.length), Math.min(12, asked), "the log lists what was reviewed");
t.eq(await page.$$eval("#logReviewed .tdrate", (r) => r.map((x) => x.textContent).filter((x) => x === "Again" || x === "Hard").length), 2, "and how it went");
t.eq(await page.$$eval("#logAdded li", (r) => r.some((x) => x.textContent.includes("Added for today"))), true, "what was added");
t.eq(await page.textContent("#logSunday p"), "2 links · 1 note", "and the Sunday session's kept changes");
t.eq(await page.$eval(`.tdday[data-day="${today}"]`, (e) => e.classList.contains("held")), true, "a session held is marked on its day");
await page.screenshot({ path: "tests/shots/today-desktop.png" });

// months and days by key
const month0 = await page.textContent("#todayMonth");
await key("ArrowLeft"); t.eq((await page.textContent("#todayMonth")) !== month0, true, "← a month back");
await key("ArrowRight"); t.eq(await page.textContent("#todayMonth"), month0, "→ a month on");
await key("ArrowUp"); await page.waitForFunction((d) => document.querySelector("#todayLog")?.dataset.day !== d, today);
const yday = await page.getAttribute("#todayLog", "data-day");
t.eq(await page.$eval(`.tdday[data-day="${yday}"]`, (e) => e.classList.contains("pick")), true, "↑ picks the day before, and its log");
await key("0"); await page.waitForFunction((d) => document.querySelector("#todayLog")?.dataset.day === d, today);
await page.click(`.tdday[data-day="${yday}"]`); await page.waitForFunction((d) => document.querySelector("#todayLog")?.dataset.day === d, yday);
t.eq(true, true, "a click picks a day");

// tomorrow: a new pick, the mark again, the streak carries on, and doing it makes two
const later = await state(page, () => Date.now() + 86400000 + 3600000);
await page.evaluate((x) => bonsai.today.setClock(x), later);
await key("Escape"); await page.waitForSelector("#today", { state: "hidden" });
await page.waitForSelector("#todayBtn #todayDot");
await key("y"); await page.waitForSelector("#today #todayGo");
const pick2 = await state(page, () => bonsai.today.pick());
t.eq([pick2.day !== today, await page.textContent("#todayStreak b")], [true, "1"], "tomorrow's pick, and the streak still stands");
await round(() => 1);
t.eq(await page.textContent("#todayStreak b"), "2", "two days in a row");
t.eq(await page.textContent("#todayScore"), String(pick2.ids.length), "all easy, all good");
await key("Escape"); await page.evaluate(() => bonsai.today.setClock(null));

// overdue never dries a topic now (strength.js: the garden follows answers): ten days or four weeks past due look the same
await page.evaluate(() => { location.hash = "#/"; }); await page.waitForFunction(() => bonsai.S.view === "isles");
await page.evaluate(() => bonsai.isles?.setActive(false));
const zone = await state(page, () => { const S = bonsai.S; return S.model.flatMap((q) => q.topics).find((q) => q.id && q.level === "focus" && q.ideas > 4).id; });
const health = (days) => state(page, async ({ zone, days }) => {
  const S = bonsai.S, now = Date.now(), trees = new Set(S.trees.filter((x) => x.zoneId === zone).map((x) => x.id));
  const nodes = S.nodes.filter((n) => trees.has(n.treeId)).map((n) => ({ ...n, srs: { interval: 3, ease: 2.5, reps: 2, lapses: 0, passes: 2, due: new Date(now - days * 86400000).toISOString() } }));
  await bonsai.store.restoreRows({ nodes }); await bonsai.refresh();
  return S.model.flatMap((q) => q.topics).find((q) => q.id === zone).health;
}, { zone, days });
const h10 = await health(10), h25 = await health(25);
t.eq([h10 === h25, h25 >= 0.45], [true, true], "however long past due, the topic's look follows its answers");
t.eq(await noWater(), 0, "no water in the garden");

// ----- the phone: Today fits, and so does the top bar with its button -----
const ctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), phone = await ctx.newPage();
phone.on("pageerror", (e) => t.fail("phone page error: " + e.message));
await phone.goto(t.url + "#/notes"); await phone.waitForSelector("body[data-ready]");
t.eq(await state(phone, () => document.querySelector("#top").scrollWidth <= 390), true, "the Library's top bar fits the phone");
await phone.tap("#todayBtn"); await phone.waitForSelector("#today #todayGo");
t.eq(await state(phone, () => [document.querySelector("#today").scrollWidth <= 390, document.querySelector("#todayCal").getBoundingClientRect().right <= 390]), [true, true], "Today fits the phone");
await phone.screenshot({ path: "tests/shots/today-phone.png" });
await phone.tap("#todayGo"); await phone.waitForSelector("#today #tq #tqShow");
const rv = await phone.locator("#today").boundingBox();
t.eq([rv.x, rv.y <= 1, Math.round(rv.width), rv.height >= 800], [0, true, 390, true], "the question fills the phone");
await phone.screenshot({ path: "tests/shots/today-phone-question.png" });
await phone.tap("#tqStop"); await phone.waitForSelector("#today #todayGo");
t.eq(true, true, "stopping goes back to Today");
for (const h of ["#/", "#/forest"]) { await phone.evaluate((x) => { location.hash = x; }, h); await phone.waitForTimeout(400); t.eq(await state(phone, () => document.querySelector("#top").scrollWidth <= 390), true, `the top bar fits the phone at ${h}`); }
await t.end();
