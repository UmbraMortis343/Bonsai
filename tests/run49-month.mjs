// Month in review (⇧Y; offered after a month ends, from the Today calendar's month name and the menu): the month's
// numbers, its timelapse (played from the month's first day to its last; ⇧T saves it as a video), the month's stitch
// (Bonsai Desktop, here a stand-in bridge: Claude's pattern and cross-topic links to tick, kept in one save with
// Undo) and the story so far (a chapter a month, written to "you", in a Story folder in the Library; earlier chapters
// go into the prompt; Rewrite asks first; without the desktop app, copy the prompt and paste the reply).
import { start, state } from "./lib.mjs";
import { statSync } from "node:fs";

const t = await start("run49-month", 4349, { channel: "beta" });

// ---- the pure logic, on made-up records ----
{
  const page = await t.page({}, "#/forest");
  await page.waitForFunction(() => window.bonsai);
  const P = await state(page, async () => {
    const M = await import("./month.js"), d = (s) => new Date(s).toISOString();
    const zones = [{ id: "z1", name: "Physics", createdAt: d("2026-09-01T10:00") }, { id: "z2", name: "Music", createdAt: d("2026-09-01T10:00") }];
    const trees = [{ id: "t1", zoneId: "z1", name: "Forces", rootId: "n1", createdAt: d("2026-09-02T10:00") }, { id: "t2", zoneId: "z2", name: "Synths", rootId: "n5", createdAt: d("2026-10-03T10:00") }];
    const nodes = [
      { id: "n1", treeId: "t1", parentId: null, title: "Newton", note: "laws", createdAt: d("2026-09-02T10:00"), reviewedAt: d("2026-10-25T10:00"), srs: { interval: 9, ease: 2.5, reps: 3, lapses: 0, passes: 3, due: d("2026-11-25T10:00") } },
      { id: "n2", treeId: "t1", parentId: "n1", title: "Inertia", note: "x", createdAt: d("2026-10-05T10:00") },
      { id: "n3", treeId: "t1", parentId: "n1", title: "F=ma", note: "x", createdAt: d("2026-10-06T10:00") },
      { id: "n4", treeId: "t1", parentId: "n1", title: "Greyed", note: "x", ghost: true, createdAt: d("2026-10-06T10:00") },
      { id: "n5", treeId: "t2", parentId: null, title: "Oscillator", note: "x", createdAt: d("2026-10-03T10:00") },
      { id: "n6", treeId: "t2", parentId: "n5", title: "Filter", note: "x", createdAt: d("2026-11-03T10:00") },
    ];
    const links = [{ id: "l1", fromId: "n2", toId: "n5", label: "both move", by: "sunday", createdAt: d("2026-10-04T11:00") }];
    const events = [
      { type: "node.review", ref: "n1", at: d("2026-10-10T10:00"), data: { rating: "again" } }, { type: "node.review", ref: "n2", at: d("2026-10-10T10:01"), data: { rating: "good" } },
      { type: "node.review", ref: "n3", at: d("2026-10-04T10:00"), data: { rating: "again", by: "sunday" } },
      { type: "node.practise", ref: "n2", at: d("2026-10-11T10:00"), data: { mark: "right" } }, { type: "node.practise", ref: "n3", at: d("2026-10-11T10:05"), data: { mark: "right" } }, { type: "node.practise", ref: "n3", at: d("2026-10-12T10:05"), data: { mark: "missed" } },
    ];
    const days = { "2026-10-01": { n: 10, asked: 10, good: 9, done: true }, "2026-10-02": { n: 10, asked: 10, good: 10, done: true }, "2026-10-03": { n: 10, asked: 4, good: 4, done: false }, "2026-11-01": { n: 10, asked: 10, good: 10, done: true } };
    const pages = [{ id: "p1", kind: "page", title: "Lecture", createdAt: d("2026-10-07T10:00") }, { id: "p2", kind: "folder", title: "F", createdAt: d("2026-10-07T10:00") }, { id: "p3", kind: "page", title: "Chapter", createdAt: d("2026-10-30T10:00") }];
    const m = M.monthOf({ zones, trees, nodes, links, pages }, events, days, [{ day: "2026-10-04", summary: "You tied forces to sound", kept: { links: 1 } }, { day: "2026-11-01", summary: "x" }], "2026-10", { now: Date.parse("2026-11-24T10:00"), skipPages: new Set(["p3"]) });
    const text = M.monthText(m), prompt = M.monthPrompt(m), key = (title) => prompt.match(new RegExp("^([ab]\\d+) \\| " + title + " \\| ", "m"))?.[1];
    const read = M.readMonth({ pattern: "  You joined   forces and sound. ", links: [{ a: key("Inertia"), b: key("Oscillator"), label: "already" }, { a: key("F=ma"), b: key("Oscillator"), label: "both oscillate" }, { a: key("F=ma"), b: key("Inertia"), label: "same topic" }, { a: "zz", b: key("Inertia") }] }, m);
    const story = M.storyPrompt([{ ym: "2026-09", title: "September 2026", text: "You began with Newton." }], M.monthText(m), { name: m.name, pattern: "forces and sound" });
    return {
      nums: [m.name, m.ideas, m.graphs, m.pages, m.links, m.today, m.score, m.streak, m.sundays, m.answered, m.practised, m.rounds],
      grew: m.grew.map((g) => [g.name, g.n]), shaky: m.shaky.map((x) => [x.name, x.pct, x.n, x.missed]), shakyText: text.includes("Shakiest topics: Physics (50% right of 6, 3 missed)"), tiers: [M.scoreTier(m), M.daysTier(m)],
      text: [text.includes("Forces: Inertia; F=ma"), text.includes("Synths: Oscillator"), text.includes("You tied forces to sound"), text.includes("Inertia ↔ Oscillator (both move)"), text.includes("Newton (Forces › Physics): again ×1"), text.includes("Greyed"), text.includes("Filter")],
      prompt: [prompt.startsWith("Look back over my month"), !!key("Inertia"), !!key("Oscillator"), /Already linked: .*–/.test(prompt)],
      read: [read.pattern, read.links.map((l) => [l.a, l.b, l.label])],
      story: [story.includes("## September 2026\nYou began with Newton."), story.includes('"# October 2026"'), story.includes("forces and sound"), M.storyPrompt([], "x", { name: "May 2026" }).includes("(none yet")],
      chapter: [M.readChapter("```markdown\n# October 2026\n\nThis month you **built**.\n\nThen more.\n```"), M.readChapter("# Only a title"), M.readChapter("No title here.")],
      offer: [M.monthOffer(Date.parse("2026-12-01T09:00"), {}, Date.parse("2026-10-01")), M.monthOffer(Date.parse("2026-12-07T09:00"), {}, 0), M.monthOffer(Date.parse("2026-12-08T09:00"), {}, 0), M.monthOffer(Date.parse("2026-12-02T09:00"), { "2026-11": { seen: "x" } }, 0), M.monthOffer(Date.parse("2026-12-02T09:00"), {}, Date.parse("2026-12-01T08:00"))],
      months: [M.addMonths("2026-01", -1), M.addMonths("2026-12", 1), M.monthName("2026-03")],
    };
  });
  t.eq(P.nums, ["October 2026", 3, 1, 1, 1, { due: 3, done: 2 }, { good: 23, asked: 24, pct: 96 }, { best: 2, end: 0 }, 1, 2, 3, 2],
    "the numbers: ideas (not greyed, not next month's), graphs, notes (not folders or chapters), links, mornings done of due, score, streaks, Sundays, answered (not Sunday's), practice answers and rounds");
  t.eq(P.grew, [["Physics", 2], ["Music", 1]], "topics that grew, most first");
  t.eq([P.shaky, P.shakyText], [[["Physics", 50, 6, 3]], true], "the shakiest topic: its share right of the month's reviews and practice, its misses; Music had no answers");
  t.eq(P.tiers, ["good", "short"], "the score and the mornings take Today's tiers");
  t.eq(P.text, [true, true, true, true, true, false, false], "the month as text: ideas by graph and topic, the Sundays and their stitches, what was missed; nothing greyed or from another month");
  t.eq(P.prompt, [true, true, true, true], "the stitch prompt keys the month's ideas and lists what's already linked");
  t.eq(P.read, ["You joined forces and sound.", [["n3", "n5", "both oscillate"]]], "only new links across topics between known ideas are kept");
  t.eq(P.story, [true, true, true, true], "the story prompt carries the earlier chapters, the title line to use and the month's pattern");
  t.eq(P.chapter, [{ title: "October 2026", body: "This month you **built**.\n\nThen more." }, null, { title: "", body: "No title here." }], "the chapter read from the reply");
  t.eq(P.offer, ["2026-11", "2026-11", null, null, null], "offered in the first week after a month ends, until opened, if anything came before it");
  t.eq(P.months, ["2025-12", "2027-01", "March 2026"], "month arithmetic");
  await page.context().close();
}

// ---- the screen, in Bonsai Desktop (a stand-in bridge) ----
const bridge = () => {
  const subs = new Set(), asked = [];
  window.bonsaiDesktop = { update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: (fn) => { subs.add(fn); return () => subs.delete(fn); }, cancel: () => {},
    ask: async (req) => {
      asked.push(req.prompt); await new Promise((r) => setTimeout(r, 60));
      const p = req.prompt;
      if (p.startsWith("Look back over my month")) {
        const rows = [...p.matchAll(/^([ab]\d+) \| [^|\n]+ \| [^\n|]*›\s*([^|\n]+?)\s*(?:\||$)/gm)].map((x) => ({ key: x[1], topic: x[2] }));
        const as = rows.filter((r) => r.key[0] === "a"), bs = rows.filter((r) => r.key[0] === "b"), out = [];
        const linked = new Set((p.match(/^Already linked: (.*)$/m)?.[1] || "").split(", ").map((x) => x.split("–").sort().join("|")));
        for (const a of as) { const b = bs.find((x) => x.topic !== a.topic && !out.some((o) => o.b === x.key) && !linked.has([a.key, x.key].sort().join("|"))); if (b) out.push({ a: a.key, b: b.key, label: "link " + (out.length + 1) }); if (out.length === 2) break; }
        const same = rows.find((r) => r !== as[0] && r.topic === as[0]?.topic);
        if (same) out.push({ a: as[0].key, b: same.key, label: "same topic" });
        window.__links = out;
        return { ok: true, text: "```json\n" + JSON.stringify({ pattern: "You kept coming back to the same few ideas from different sides.", links: out }) + "\n```" };
      }
      const name = p.match(/^Write this month's chapter of the story of my learning, for (.+)\.$/m)?.[1] || "?";
      const text = `# ${name}\n\nThis month you (${name}) kept going.\n\nYou also slipped a little.`;
      for (const fn of subs) fn({ reqId: req.reqId, type: "text", text });
      return { ok: true, text };
    },
  } };
  window.__asked = asked;
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true }); await ctx.addInitScript(bridge);
const page = await ctx.newPage();
page.on("pageerror", (e) => t.fail("page error: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
await page.goto(t.url + "#/"); await page.waitForSelector("body[data-ready]");
await page.waitForFunction(() => bonsai.S.model?.some((i) => i.name === "Workshop"), null, { timeout: 120000 });
const key = (k) => page.keyboard.press(k);

// The clock: the 1st of this month. The month before is offered; its records are made up below.
const R = await state(page, async () => {
  const S = bonsai.S, s = bonsai.store, n = new Date(), first = new Date(n.getFullYear(), n.getMonth(), 1, 10), pad = (x) => String(x).padStart(2, "0");
  const ymOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, prev = new Date(n.getFullYear(), n.getMonth() - 1, 1, 12), prev2 = new Date(n.getFullYear(), n.getMonth() - 2, 1, 12);
  const ym = ymOf(prev), day = (d) => `${ym}-${pad(d)}`;
  await s.setMeta("days", { [day(2)]: { n: 10, asked: 10, good: 10, done: true }, [day(3)]: { n: 10, asked: 10, good: 8, done: true }, [day(4)]: { n: 10, asked: 5, good: 5, done: false } });
  await s.setMeta("sundays", [{ id: "s1", day: day(5), at: new Date(prev.getFullYear(), prev.getMonth(), 5, 18).toISOString(), summary: "You tied the week together.", kept: { links: 1 }, saved: true }]);
  // a Sunday's link made in that month, between two ideas in different topics
  const zoneOf = (x) => S.trees.find((tr) => tr.id === x.treeId)?.zoneId, a = S.nodes.find((x) => !x.ghost && zoneOf(x)), b = S.nodes.find((x) => !x.ghost && zoneOf(x) && zoneOf(x) !== zoneOf(a));
  await s.restoreRows({ links: [{ id: "sunlink", fromId: a.id, toId: b.id, label: "sunday link", note: "", by: "sunday", createdAt: new Date(prev.getFullYear(), prev.getMonth(), 5, 19).toISOString(), updatedAt: new Date().toISOString() }] });
  await bonsai.refresh();
  const from = new Date(prev.getFullYear(), prev.getMonth(), 1).getTime(), to = new Date(n.getFullYear(), n.getMonth(), 1).getTime(), live = new Set(S.trees.map((x) => x.id));
  const ideas = S.nodes.filter((x) => live.has(x.treeId) && !x.ghost && Date.parse(x.createdAt) >= from && Date.parse(x.createdAt) < to);
  bonsai.today.setClock(first.getTime());
  return { ym, ym2: ymOf(prev2), cur: ymOf(n), first: first.getTime(), ideas: ideas.length, titles: ideas.slice(0, 3).map((x) => x.title), graphs: S.trees.filter((x) => Date.parse(x.createdAt) >= from && Date.parse(x.createdAt) < to).length, a: a.title, b: b.title, name: prev.toLocaleDateString("en-NZ", { month: "long" }) + " " + prev.getFullYear() };
});
t.eq(await state(page, () => bonsai.month.due), R.ym, "on the 1st the month before is offered");
await key("y"); await page.waitForSelector("#today:not([hidden])");
t.eq(await page.textContent("#monthOffer"), "Month in review⇧Y", "Today shows Month in review at the top, with its key");
t.eq(await state(page, () => !!document.querySelector("#todayDot")), true, "and Today's button carries the mark");
await page.click("#monthOffer");
await page.waitForSelector("#monthNums");
t.eq(await page.textContent("#monthName"), R.name, "it opens on that month");
const nums = await state(page, () => Object.fromEntries([...document.querySelectorAll("#monthNums .mvfig")].map((f) => [f.dataset.k, [f.querySelector("b").textContent, f.className.replace("mvfig", "").trim()]])));
t.eq(nums, { ideas: [String(R.ideas), ""], graphs: [String(R.graphs), ""], pages: [nums.pages[0], ""], mornings: ["2/3", "short"], score: ["92%", "good"], best: ["2", ""], streak: ["0", ""], sundays: ["1", ""], answered: [nums.answered[0], ""], rounds: [nums.rounds[0], ""] },
  "the numbers for the month: ideas and graphs added, 2 of 3 mornings, 23 of 25 right, a best streak of 2, one Sunday");
if (R.ideas < 1) t.fail("the demo should have ideas in last month");
t.eq(await state(page, () => [bonsai.month.due, bonsai.S.months[bonsai.S.mv.ym]?.seen != null]), [null, true], "opened: no longer offered, and kept as seen");
await page.waitForTimeout(300);
await page.screenshot({ path: "tests/shots/month-review.png" });

// back to Today: the offer has gone; the calendar's month name opens that month
await key("Escape"); await page.waitForSelector("#today:not([hidden])");
t.eq(await state(page, () => [!!document.querySelector("#monthOffer"), !bonsai.S.mv]), [false, true], "Esc goes back to Today, which no longer offers it");
await page.click("#todayMonthOpen"); await page.waitForSelector("#monthNums");
t.eq(await state(page, () => bonsai.S.mv.ym), R.cur, "the calendar's month name opens that month");
// navigation: ← → by month, never past this month
t.eq(await state(page, () => document.querySelector("#monthNext").disabled), true, "no month after this one");
await key("ArrowRight"); t.eq(await state(page, () => bonsai.S.mv.ym), R.cur, "→ stops at this month");
await key("ArrowLeft"); await page.waitForSelector("#monthNums");
t.eq(await page.textContent("#monthName"), R.name, "← a month back");
await key("ArrowLeft"); await page.waitForSelector("#monthNums");
t.eq(await state(page, () => bonsai.S.mv.ym), R.ym2, "and another");
await key("ArrowRight"); await page.waitForSelector("#monthNums");
t.eq(await state(page, () => bonsai.S.mv.ym), R.ym, "→ a month on");
await key("Escape"); await key("Escape");
t.eq(await state(page, () => [!bonsai.S.mv, bonsai.today.open]), [true, false], "Esc closes");
await page.keyboard.press("Shift+Y"); await page.waitForSelector("#monthNums");
t.eq(await state(page, () => [bonsai.S.mv.ym, bonsai.S.mv.from]), [R.ym, null], "⇧Y opens the last full month from anywhere");

// ---- the month's timelapse ----
await page.evaluate(() => { bonsai.timelapse.secs = 1; });
const pend = () => state(page, () => bonsai.store.pendingCount());
const before = await pend();
await key(" ");
await page.waitForFunction(() => bonsai.S.tl && !bonsai.S.mv, null, { timeout: 30000 });
const tl = await state(page, () => ({ min: bonsai.S.tl.min, max: bonsai.S.tl.max, month: bonsai.S.tl.month, where: bonsai.S.tl.where }));
const range = await state(page, (ym) => { const [y, m] = ym.split("-").map(Number); return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()]; }, R.ym);
t.eq([tl.where, tl.month, tl.min === range[0], tl.max >= range[1] - 2000 && tl.max < range[1]], ["garden", R.ym, true, true], "Space plays the garden from the month's first day to its last");
await page.waitForFunction(() => bonsai.S.tl && !bonsai.S.tl.playing && bonsai.S.tl.t >= bonsai.S.tl.max - 1, null, { timeout: 60000 });
await page.waitForFunction(() => !bonsai.isles.busy && !bonsai.S.tl?.dirty, null, { timeout: 120000 });
t.eq(await state(page, () => [!!bonsai.S.tl.past, document.querySelector("#timeWhen").textContent.length > 0]), [true, true], "played to the month's end, drawn as it was then");
await key("Escape");
await page.waitForSelector("#monthNums");
t.eq(await state(page, () => [bonsai.S.tl, bonsai.S.mv?.ym]), [null, R.ym], "Esc comes back to the month");
t.eq(await pend(), before, "nothing written by the timelapse");
const rec = await state(page, () => typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream);
if (rec) {
  const dl = page.waitForEvent("download", { timeout: 240000 });
  await page.keyboard.press("Shift+T");
  await page.waitForFunction(() => bonsai.S.tl?.rec, null, { timeout: 30000 });
  const file = await dl, size = statSync(await file.path()).size;
  t.eq([file.suggestedFilename().replace(/\.(webm|mp4)$/, ""), size > 1000], [`bonsai-month-${R.ym}`, true], `⇧T saves the month as a video (${file.suggestedFilename()}, ${size} bytes)`);
  await page.waitForFunction(() => !bonsai.S.tl?.rec, null, { timeout: 30000 });
  await key("Escape"); await page.waitForSelector("#monthNums");
} else console.log("run49: no MediaRecorder here; video not tried");

// ---- the month's stitch ----
const links0 = await state(page, () => bonsai.S.links.length);
await key("f");
await page.waitForSelector("#monthLinks");
const asked = await state(page, () => __asked.filter((p) => p.startsWith("Look back over my month")).at(-1));
t.eq([R.titles.every((x) => asked.includes(x)), asked.includes(`${R.a} ↔ ${R.b} (sunday link)`), asked.includes("You tied the week together.")], [true, true, true], "Claude gets the month's ideas, the Sundays and what they stitched");
const want = await state(page, () => __links.filter((l) => l.label !== "same topic").length);
t.eq(await page.$$eval("#monthLinks li", (xs) => xs.length), want, "the proposed links across topics are listed, ticked; one inside a topic is dropped");
t.eq(await page.textContent("#monthPattern"), "You kept coming back to the same few ideas from different sides.", "the month's pattern shows");
await page.screenshot({ path: "tests/shots/month-stitch.png" });
if (want > 1) await key("2");
await key("Enter");
await page.waitForFunction((n) => bonsai.S.links.length === n, links0 + 1, { timeout: 15000 });
t.eq(await state(page, (ym) => [bonsai.S.months[ym].links.length, !!bonsai.S.months[ym].pattern, bonsai.S.links.filter((l) => l.by === "month").length, !!document.querySelector("#monthLinks")], R.ym), [1, true, 1, false], "↵ keeps the ticked link and the pattern in one save");
await page.evaluate(() => document.querySelector("#toast button").click());
await page.waitForFunction((n) => bonsai.S.links.length === n, links0, { timeout: 15000 });
t.eq(await state(page, (ym) => [bonsai.S.months[ym]?.pattern || "", bonsai.S.months[ym]?.seen != null], R.ym), ["", true], "Undo takes the links and the pattern back");

// ---- the story so far ----
// two months back first, then the month: the second prompt carries the first chapter
await key("ArrowLeft"); await page.waitForFunction((ym) => bonsai.S.mv?.ym === ym && bonsai.S.mv.m, R.ym2);
await key("c");
await page.waitForFunction(() => document.querySelector("#storyReply")?.value.includes("kept going"), null, { timeout: 15000 });
t.eq(await state(page, () => __asked.at(-1).includes("(none yet: this is the first chapter)")), true, "the first chapter has none before it");
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction(() => bonsai.S.view === "notes" && /^#\/notes\//.test(location.hash) && document.querySelector("#pageTitle"), null, { timeout: 30000 });
const c1 = await state(page, (ym) => { const S = bonsai.S, id = S.months[ym].chapterPageId, p = S.pages.find((x) => x.id === id), f = S.pages.find((x) => x.id === p.parentId);
  return { title: p.title, folder: [f.kind, f.title, f.parentId], open: S.npage === id, text: p.blocks.map((b) => b.html).join("|"), date: p.props.find((x) => x.type === "date")?.value }; }, R.ym2);
t.eq([c1.folder, c1.open, c1.text.includes("kept going"), !c1.text.includes("# "), c1.date], [["folder", "Story", null], true, true, true, `${R.ym2}-01`], "the chapter is a page in a Story folder, opened, its title line dropped");
await page.keyboard.press("Shift+Y"); await page.waitForSelector("#monthNums");
t.eq(await state(page, () => bonsai.S.mv.ym), R.ym, "⇧Y from the Library");
await key("c");
await page.waitForFunction(() => document.querySelector("#storyReply")?.value.includes("kept going"), null, { timeout: 15000 });
t.eq(await state(page, (n) => __asked.at(-1).includes(`## ${n}\nThis month you (${n}) kept going.`), c1.title), true, "the next chapter's prompt carries the one before");
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction((ym) => bonsai.S.npage && bonsai.S.npage === bonsai.S.months[ym]?.chapterPageId, R.ym, { timeout: 30000 });
const c2 = await state(page, (ym) => { const S = bonsai.S, p = S.pages.find((x) => x.id === S.months[ym].chapterPageId), sibs = S.pages.filter((x) => x.parentId === p.parentId).sort((a, b) => a.order - b.order);
  return { title: p.title, sibs: sibs.map((x) => x.title), folders: S.pages.filter((x) => x.kind === "folder" && x.title === "Story").length }; }, R.ym);
t.eq([c2.title, c2.sibs.length, c2.sibs.at(-1), c2.folders], [R.name, 2, R.name, 1], "a second month adds its own page to the same folder, in month order");
await page.waitForTimeout(300);
await page.screenshot({ path: "tests/shots/month-story.png" });
// Rewrite: asks first, then replaces the page's text
await page.keyboard.press("Shift+Y"); await page.waitForSelector("#monthChapterOpen");
t.eq(await page.textContent("#monthChapter"), "RewriteC", "with a chapter written, C rewrites it");
await key("c"); await page.waitForSelector(".dialog .danger-fill");
await page.click(".dialog .danger-fill");
await page.waitForFunction(() => document.querySelector("#storyReply")?.value.includes("kept going"), null, { timeout: 15000 });
await page.fill("#storyReply", "# Whatever\n\nA second go at it.");
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction((ym) => { const S = bonsai.S, p = S.pages.find((x) => x.id === S.months[ym]?.chapterPageId); return p && p.blocks.some((b) => b.html.includes("A second go")); }, R.ym, { timeout: 15000 });
t.eq(await state(page, (ym) => [bonsai.S.pages.filter((x) => x.parentId === bonsai.S.pages.find((p) => p.id === bonsai.S.months[ym].chapterPageId).parentId).length, bonsai.S.pages.find((p) => p.id === bonsai.S.months[ym].chapterPageId).title], R.ym), [2, R.name], "the rewrite replaces the page, keeping its name");
await ctx.close();

// ---- in a browser (no Bonsai Desktop): no stitch; the chapter by copy and paste ----
{
  const p = await t.page({ viewport: { width: 1280, height: 800 } }, "#/forest");
  await p.waitForFunction(() => window.bonsai && document.body.dataset.ready);
  await p.keyboard.press("Shift+Y"); await p.waitForSelector("#monthNums");
  t.eq(await state(p, () => [!!document.querySelector("#monthStitch"), !!document.querySelector("#monthStitchSec"), !!document.querySelector("#monthChapter")]), [false, false, true], "no stitch without Bonsai Desktop; the chapter still");
  await p.keyboard.press("c"); await p.waitForSelector("#storyCopy");
  t.eq(await state(p, () => [!!document.querySelector('.dialog a[href="https://claude.ai/new"]'), !document.querySelector("#askClaude")]), [true, true], "Copy for Claude and Open Claude");
  await p.fill("#storyReply", "# Some month\n\nThis month you pasted it in.");
  await p.click(".dialog > .row.end .btn.primary");
  await p.waitForFunction(() => bonsai.S.view === "notes" && bonsai.S.pages.some((x) => x.kind === "folder" && x.title === "Story"), null, { timeout: 30000 });
  t.eq(await state(p, () => { const ym = Object.keys(bonsai.S.months).find((k) => bonsai.S.months[k].chapterPageId); const pg = bonsai.S.pages.find((x) => x.id === bonsai.S.months[ym].chapterPageId); return [pg.blocks[0].html, bonsai.S.npage === pg.id]; }), ["This month you pasted it in.", true], "the pasted chapter becomes the page and opens");
  await p.context().close();
}

// ---- the phone ----
{
  const p = await t.page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, "#/forest");
  await p.waitForFunction(() => window.bonsai && document.body.dataset.ready);
  await p.evaluate(() => bonsai.month.show()); await p.waitForSelector("#monthNums");
  const box = await state(p, () => { const r = document.querySelector("#month").getBoundingClientRect(), cols = getComputedStyle(document.querySelector("#month")).gridTemplateColumns.split(" ").length, f = document.querySelector("#monthNums .mvfig").getBoundingClientRect(); return [r.left, r.top, Math.round(r.width), cols, f.width > 80]; });
  t.eq(box, [0, 0, 390, 1, true], "on the phone the month fills the screen in one column");
  await p.screenshot({ path: "tests/shots/month-phone.png" });
  await p.context().close();
}
await t.end();
