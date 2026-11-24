// The Sunday session (Bonsai Desktop; here a stand-in bridge): offered in the top bar on a Sunday only, U or the
// menu any day. Claude gets the week (ideas added, ideas missed in watering), asks one question at a time until it
// has enough, then proposes the stitch; what's ticked is saved in one go, Undo takes it back, and the session is
// recorded. The old Patches panel and Stitch button are gone; old patches still show on their ideas.
import { start, state } from "./lib.mjs";

const t = await start("run36-sunday", 4337, { channel: "beta" });
const bridge = () => {
  const subs = new Set(), asked = [];
  window.__sun = {};
  const keyOf = (p, title) => p.match(new RegExp("^([ab]\\d+) \\| " + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\| ", "m"))?.[1];
  window.bonsaiDesktop = { update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: (fn) => { subs.add(fn); return () => subs.delete(fn); }, cancel: () => {},
    ask: async (req) => {
      asked.push(req.prompt); await new Promise((r) => setTimeout(r, 60));
      const p = req.prompt; let out;
      if (p.startsWith("Run my Sunday session")) { const n = (p.match(/^Question \d+:/gm) || []).length; out = n >= 4 ? { next: "", done: true } : { next: `How does question ${n + 1} connect?`, done: false }; }
      else {
        const one = keyOf(p, "Sunday idea one"), two = keyOf(p, "Sunday idea two"), miss = keyOf(p, __sun.missed), old = p.match(/^(b\d+) \| /m)?.[1];
        out = { links: [{ a: one, b: old, label: "builds on" }, { a: two, b: old, label: "unticked" }],
          notes: [{ key: miss, mode: "replace", text: "Fixed short note" }, { key: one, mode: "add", text: "What I said on Sunday." }],
          questions: [{ key: miss, kind: "why", q: "Why does it hold?", a: "Because." }], fuzzy: [one, "zz"], summary: "You tied the week's ideas to older ones." };
      }
      return { ok: true, text: "```json\n" + JSON.stringify(out) + "\n```" };
    },
  } };
  window.__asked = asked;
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge);
const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
await page.goto(t.url); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));

// This week: two ideas added to a graph, and an older idea missed in watering.
const w = await state(page, async () => {
  const S = bonsai.S, s = bonsai.store, tr = S.trees[0], kids = S.nodes.filter((n) => n.treeId === tr.id && n.parentId === tr.rootId);
  const one = await s.addNode(tr.rootId, { title: "Sunday idea one" }), two = await s.addNode(tr.rootId, { title: "Sunday idea two" });
  const missed = kids[0]; await s.reviewNode(missed.id, "again");
  await s.addPatch({ treeId: tr.id, text: "An old patch", nodeIds: [missed.id] });
  await bonsai.refresh();
  return { tree: tr.id, one: one.id, two: two.id, missed: missed.id, missedTitle: missed.title, missedNote: missed.note };
});
await page.evaluate((title) => { __sun.missed = title; }, w.missedTitle);

// The offer: a Sunday shows it, a Monday doesn't.
const sunday = new Date(); sunday.setHours(10, 0, 0, 0); while (sunday.getDay() !== 0) sunday.setDate(sunday.getDate() + 1);
const monday = new Date(sunday); monday.setDate(sunday.getDate() + 1);
await page.evaluate((x) => bonsai.sunday.setClock(x), monday.getTime());
t.eq(await page.$$("#sundayGo").then((x) => x.length), 0, "no offer on a Monday");
await page.evaluate((x) => bonsai.sunday.setClock(x), sunday.getTime());
await page.waitForSelector("#sundayGo");
t.eq(await page.textContent("#sundayGo"), "SundayU", "a quiet offer in the top bar on a Sunday, with its key");
await page.screenshot({ path: "tests/shots/sunday-offer.png", clip: { x: 0, y: 0, width: 1280, height: 56 } });

// Any day from the menu (and U); stopping before the stitch keeps no record.
await page.evaluate((x) => bonsai.sunday.setClock(x), monday.getTime());
await page.click("#moreBtn"); await page.click('.mi:has-text("Sunday session")');
await page.waitForSelector("#sunQ");
await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
await page.waitForFunction(() => !bonsai.S.sun);
await page.keyboard.press("u"); await page.waitForSelector("#sunQ");
await page.click("#sunClose"); await page.waitForFunction(() => !bonsai.S.sun);
t.eq((await page.evaluate(() => bonsai.sunday.list())).length, 0, "a session stopped mid-talk isn't recorded");

// The session itself, on the Sunday.
await page.evaluate((x) => bonsai.sunday.setClock(x), sunday.getTime());
await page.click("#sundayGo"); await page.waitForSelector("#sunQ");
t.eq(await page.evaluate(() => [bonsai.S.sun.week.addedCount, bonsai.S.sun.week.missedCount]), [2, 1], "the week: two ideas added, one missed");
await page.screenshot({ path: "tests/shots/sunday-talk.png" });
for (let i = 0; i < 4; i++) {
  await page.fill("#sunAnswer", `Answer ${i + 1}: Sunday idea one leads on to ${w.missedTitle}.`); await page.press("#sunAnswer", "Enter");
  if (i < 3) await page.waitForFunction((n) => document.querySelector("#sunQ")?.textContent === `How does question ${n} connect?`, i + 2);
}
await page.waitForSelector("#sunStitch");
const asked = await page.evaluate(() => __asked);
const first = asked[0];
t.eq([first.includes("Sunday idea one"), first.includes("Sunday idea two"), new RegExp(`\\| ${w.missedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|.*again ×1`).test(first), first.includes("Answer 1:")], [true, true, true, true], "Claude gets the week: what was added, what was missed, and the answer");
t.eq([asked.filter((p) => p.startsWith("Run my Sunday session")).length, asked.at(-1).startsWith("We just had my Sunday session")], [4, true], "one question a turn until Claude has enough, then the stitch");
t.eq(await page.$$eval("#sunStitch li", (xs) => xs.map((x) => x.dataset.kind)), ["link", "link", "note", "note", "question", "fuzzy"], "the stitch lists links, notes, questions and sooner, all ticked; unknown keys dropped");
await page.keyboard.press("2");   // untick the second link
t.eq(await page.$$eval("#sunStitch li.shown", (xs) => xs.length), 5, "a number unticks a proposal");
await page.screenshot({ path: "tests/shots/sunday-stitch.png" });
await page.keyboard.press("Enter"); await page.waitForSelector("#toast .link");
t.eq((await page.textContent("#toast")).startsWith("Stitched: 1 link, 2 notes, 1 question, 1 sooner"), true, "saving says what was kept, with Undo");
const after = await state(page, (w) => {
  const S = bonsai.S, one = S.byId.get(w.one), miss = S.byId.get(w.missed);
  const linked = (a) => S.links.filter((l) => l.fromId === a || l.toId === a).length;
  return [linked(w.one), linked(w.two), miss.note, one.body, miss.qs?.length, miss.qs?.[0]?.kind, miss.qs?.[0]?.by, !!one.srs && Date.parse(one.srs.due) < Date.now() + 2 * 86400000];
}, w);
t.eq(after, [1, 0, "Fixed short note", "What I said on Sunday.", 1, "why", "claude", true], "links, note fixes, questions and the fuzzy idea are saved; the unticked link isn't");
const rec = await page.evaluate(() => bonsai.sunday.list());
const day = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
t.eq([rec.length, rec[0]?.day, rec[0]?.turns.length, rec[0]?.kept, rec[0]?.saved], [1, day, 4, { links: 1, notes: 2, questions: 1, fuzzy: 1 }, true], "the session is recorded");
t.eq(await page.$$("#sundayGo").then((x) => x.length), 0, "no offer once today's is held");

// Undo takes it all back.
await page.click("#toast .link");
await page.waitForFunction((id) => !bonsai.S.links.some((l) => l.fromId === id || l.toId === id), w.one);
const undone = await state(page, (w) => { const S = bonsai.S, one = S.byId.get(w.one), miss = S.byId.get(w.missed); return [miss.note, one.body, miss.qs?.length || 0, !!one.srs]; }, w);
t.eq(undone, [w.missedNote, "", 0, false], "Undo restores the ideas and removes the links");
t.eq((await page.evaluate(() => bonsai.sunday.list()))[0]?.undone, true, "the record says it was undone");

// P and Stitch are gone; the old patch still shows on its idea.
await page.evaluate((id) => bonsai.openTree(id), w.tree); await page.waitForFunction(() => bonsai.S.view === "tree");
await page.waitForTimeout(400);
await page.keyboard.press("p"); await page.waitForTimeout(200);
t.eq(await page.$$("#patchText, #stitchBtn").then((x) => x.length), 0, "P opens no patches");
if (await state(page, () => !!bonsai.S.todayOpen)) { await page.keyboard.press("Escape"); await page.waitForFunction(() => !bonsai.S.todayOpen); }   // P is Practise now (run47-practise)
await page.click("#moreBtn"); await page.waitForSelector(".menu");
t.eq(await page.$$eval(".menu .mi", (xs) => xs.some((x) => /Patches|Stitch/.test(x.textContent))), false, "no Patches or Stitch in the graph's menu");
await page.keyboard.press("Escape");
await page.evaluate((id) => { bonsai.S.sel = id; }, w.missed); await page.keyboard.press(" ");
await page.waitForSelector('#panel h3:text-is("Patches")');
t.eq(await page.textContent("#panel blockquote p"), "An old patch", "old patches stay readable on their ideas");
await ctx.close();
await t.end();
