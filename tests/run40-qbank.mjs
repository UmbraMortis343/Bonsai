// The question bank and Today's round in its own box. In Bonsai Desktop (a stand-in bridge here) Claude writes three
// questions per idea in batches, saved as each arrives, so closing the app mid-way loses only the batch under way;
// the prompt carries the idea's note, notes, neighbours and links and asks for a recall that doesn't name the idea.
// Today's round stays in the Today box over a blurred screen: with Claude, a typed answer is marked (Right, Partly,
// Missed, his to overrule); without, Space shows the answer and Got it / Missed. The calendar's scores are numbers.
import { start, state } from "./lib.mjs";

const t = await start("run40-qbank", 4341, { channel: "beta" });
const bridge = () => {
  const asked = [], wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hang = sessionStorage.getItem("hangAfter");
  window.bonsaiDesktop = { update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: () => () => {}, cancel: () => {},
    ask: async (req) => {
      asked.push(req.prompt); await wait(40);
      if (req.prompt.startsWith("Mark my answer")) {
        const ans = (/^My answer: (.*)$/m.exec(req.prompt) || [])[1] || "";
        const mark = /right/i.test(ans) ? "right" : /half/i.test(ans) ? "partly" : "missed";
        return { ok: true, text: JSON.stringify({ mark, why: "Marked " + mark }) };
      }
      if (hang != null && asked.length > +hang) return new Promise(() => {});   // the app is closed while this batch is under way
      const ideas = []; let cur = null;
      for (const line of req.prompt.split("\n")) {
        let m;
        if ((m = line.match(/^(\d+)\. (.+?)(?: \| .*)?$/))) ideas.push((cur = { k: +m[1], title: m[2], kids: [], links: [] }));
        else if (cur && (m = line.match(/^ {3}under it: (.+)$/))) cur.kids = m[1].split("; ");
        else if (cur && (m = line.match(/^ {3}linked to: (.+)$/))) cur.links = m[1].split("; ").map((x) => x.replace(/ \(.*\)$/, ""));
      }
      const questions = ideas.flatMap((i) => [
        { idea: i.k, kind: "recall", q: `Which idea does card ${i.k} describe?`, a: "It's the one on the card" },
        { idea: i.k, kind: "recall", q: `What is ${i.title}?`, a: "Names itself" },   // dropped: a recall naming its idea
        { idea: i.k, kind: "why", q: `Why does card ${i.k} hold?`, a: "Because it follows" },
        i.links.length ? { idea: i.k, kind: "connect", q: `How does it relate to ${i.links[0]}?`, a: "They share a cause", link: i.links[0] }
          : i.kids.length ? { idea: i.k, kind: "rebuild", q: "", hide: i.kids.slice(0, 2) }
          : { idea: i.k, kind: "apply", q: `Work problem ${i.k}`, a: "42" },
      ]);
      return { ok: true, text: "```json\n" + JSON.stringify({ questions }) + "\n```" };
    },
  } };
  window.__asked = asked;
  localStorage.setItem("bonsai-beta.bankauto", "1");
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge);
const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
const ideasIn = (p) => (p.match(/^\d+\. /gm) || []).length;
// first open: the bank starts by itself; here its first batch never comes back, so nothing is written yet
await page.goto(t.url + "#/notes"); await page.evaluate(() => sessionStorage.setItem("hangAfter", "0"));
await page.reload(); await page.waitForSelector("body[data-ready]");
await page.waitForFunction(() => __asked.length === 1, null, { timeout: 20000 });
const short0 = await state(page, () => bonsai.bank.short());
t.eq(short0 > 50, true, "the demo's ideas are short of questions");
// open again: two batches come back, the third is under way when the app is closed
await page.evaluate(() => sessionStorage.setItem("hangAfter", "2"));
await page.reload(); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));
await page.waitForFunction(() => __asked.length >= 3, null, { timeout: 30000 });
await page.waitForTimeout(300);
const first = await state(page, () => ({ asked: __asked.slice(0, 2), short: bonsai.bank.short(), on: bonsai.bank.on }));
const a2 = first.asked.map(ideasIn);
t.eq([first.on, a2.every((n) => n > 0 && n <= 25), first.short], [true, true, short0 - a2[0] - a2[1]], "batches of at most 25, each saved as it arrives");
const p0 = first.asked[0];
t.eq([p0.startsWith("Write review questions"), p0.includes("Write 3 questions for each idea"), p0.includes("Never put the idea's title"), /^ {3}(notes|hangs from|under it): /m.test(p0), /topic "[^"]+"/.test(p0)], [true, true, true, true, true], "the prompt asks for three kinds, a recall without the name, with the idea's topic and surroundings");
const kinds = await state(page, () => { const n = bonsai.S.nodes.find((x) => (x.qs || []).filter((q) => q.by === "claude").length >= 3); return { kinds: n.qs.filter((q) => q.by === "claude").map((q) => q.kind), named: n.qs.some((q) => q.kind === "recall" && q.q.includes(n.title)) }; });
t.eq([new Set(kinds.kinds).size, kinds.kinds.length, kinds.named], [3, 3, false], "three of different kinds; a recall naming its idea is dropped");
// the app closes and opens again: the bank carries on with what's left, not what was written
await page.evaluate(() => sessionStorage.removeItem("hangAfter"));
await page.reload(); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));
await page.waitForFunction(() => __asked.length > 0 && !bonsai.bank.on, null, { timeout: 60000 });
const after = await state(page, () => ({ c: bonsai.bank.count(), short: bonsai.bank.short(), asked: __asked }));
t.eq([after.c.done, after.short], [after.c.total, 0], "the bank finishes: three for every idea");
t.eq(after.asked.map(ideasIn).reduce((a, b) => a + b, 0), first.short, "and only the ideas left were asked about");
t.eq(await state(page, () => bonsai.store.pendingCount()) > 0, true, "the questions wait to sync with the rest");
// nothing missing: opening again asks nothing; Write questions in the menu runs it for everything and says so
await page.reload(); await page.waitForSelector("body[data-ready]"); await page.waitForTimeout(2200);
t.eq(await state(page, () => __asked.length), 0, "nothing missing, nothing asked");
await page.click("#moreBtn"); await page.click('.mi:has-text("Write questions")');
await page.waitForSelector("#toast"); t.eq(await page.textContent("#toast span"), "Every idea has its questions", "Write questions in the menu");
await page.keyboard.press("Escape");

// Grow adds ideas: the bank writes for them straight after
const grown = await state(page, async () => {
  const N = await import(new URL("notes.js", location.href)), S = bonsai.S;
  const plan = N.planGrow(N.readGrow("bonsai grow\ngraph: Bank test\nTides | The sea rising and falling\n  Spring tide | Sun and moon in line"), { trees: [], nodes: [], allNodes: S.nodes, links: S.links });
  const p = await bonsai.store.addPage({ title: "Tides" });
  const made = await bonsai.store.growPage(p.id, plan, S.zones[0].id); await bonsai.refresh(); await bonsai.bank.run();
  return made.nodeIds.map((id) => (bonsai.S.byId.get(id).qs || []).length);
});
t.eq(grown, [3, 3], "new ideas get their three");

// Today prefers, among ideas due the same day, those with a written question
const pref = await page.evaluate(async () => {
  const T = await import(new URL("today.js", location.href)), D = 86400000;
  const pool = { focus: [{ id: "none", zone: "a", due: 10 * D + 5, kinds: [] }, { id: "has", zone: "a", due: 10 * D + 9, kinds: ["recall"] }, { id: "old", zone: "a", due: 2 * D, kinds: [] }] };
  return T.pickToday(pool, "2026-11-23").ids;
});
t.eq(pref, ["old", "has", "none"], "Today picks the long overdue first, then among the same day one with a question");

// ---------- Today's round in its own box, Claude marking ----------
await page.evaluate(() => { location.hash = "#/notes"; }); await page.waitForFunction(() => bonsai.S.view === "notes");
await page.evaluate(() => { document.querySelector("#toast").hidden = true; document.activeElement?.blur?.(); });
await page.keyboard.press("y"); await page.waitForSelector("#today:not([hidden])");
await page.waitForSelector("#today #todayGo", { timeout: 8000 }).catch(async () => t.fail("Today: " + (await page.textContent("#today")).slice(0, 200)));
const blur = await state(page, () => { const b = document.querySelector("#todayBlur"), r = b.getBoundingClientRect(), cs = getComputedStyle(b), top = document.querySelector("#top");
  return [cs.backdropFilter.includes("blur"), r.top <= 0 && r.left <= 0 && r.right >= innerWidth, +cs.zIndex > +getComputedStyle(top).zIndex, document.elementFromPoint(innerWidth - 20, 20) === b]; });
t.eq(blur, [true, true, true, true], "Today floats over a blur that covers everything, the top bar too");
await page.keyboard.press("Enter"); await page.waitForSelector("#tq #tqAnswer");
await page.waitForFunction(() => document.activeElement?.id === "tqAnswer", null, { timeout: 3000 }).catch(() => {});
t.eq(await state(page, () => document.activeElement?.id), "tqAnswer", "the answer box takes the keys");
t.eq(await page.$$eval("#tq kbd", (k) => k.map((x) => x.textContent)).then((k) => ["Esc", "↵", "Space", "Win+H"].every((x) => k.includes(x))), true, "keys shown: Esc, ↵, Space, Win+H");
t.eq(await state(page, () => !!document.querySelector("#review:not([hidden])")), false, "the round doesn't leave for the review box");
const q1 = await state(page, () => ({ id: bonsai.S.tq.ids[0], q: document.querySelector("#tqQ").textContent }));
await page.screenshot({ path: "tests/shots/qbank-desktop-question.png" });
await page.keyboard.type("The right answer, I think");
const n0 = await state(page, () => __asked.length);
await page.keyboard.press("Enter"); await page.waitForSelector("#tqMark");
const mp = await state(page, () => __asked.at(-1));
t.eq([mp.startsWith("Mark my answer"), mp.includes("My answer: The right answer, I think"), mp.includes(q1.q.slice(0, 30)), await state(page, () => __asked.length) - n0], [true, true, true, 1], "one small call marks it: the question, the answer, what's expected");
t.eq([await page.textContent("#tqMark b"), await page.textContent("#tqMark span"), !!(await page.$("#tqAns")), await page.$eval('#tqRate .btn[data-mark="right"]', (b) => b.classList.contains("on"))], ["Right", "Marked right", true, true], "the mark, why, and the stored answer");
await page.screenshot({ path: "tests/shots/qbank-desktop-marked.png" });
await page.keyboard.press("3");   // he overrules: missed
await page.waitForFunction(() => bonsai.S.tq?.i === 1 && bonsai.S.tq.phase === "ask");
t.eq(await state(page, (id) => bonsai.today.pick().rated[id], q1.id), "again", "overruled to Missed: again");
await page.waitForFunction(() => document.activeElement?.id === "tqAnswer"); await page.keyboard.type("about half of it");
await page.keyboard.press("Enter"); await page.waitForSelector("#tqMark");
t.eq(await page.textContent("#tqMark b"), "Partly", "partly");
const q2 = await state(page, () => bonsai.S.tq.ids[1]);
await page.keyboard.press("Enter"); await page.waitForFunction(() => bonsai.S.tq?.i === 2 && bonsai.S.tq.phase === "ask");
t.eq(await state(page, (id) => bonsai.today.pick().rated[id], q2), "hard", "↵ takes Claude's mark: partly is hard");
await page.waitForFunction(() => document.activeElement?.id === "tqAnswer"); const before3 = await state(page, () => __asked.length);
await page.keyboard.press(" "); await page.waitForSelector("#tqRate");
t.eq([await page.$$eval("#tqRate .btn", (b) => b.map((x) => x.dataset.mark)), await state(page, () => __asked.length) - before3], [["right", "partly", "missed"], 0], "Space with nothing typed shows the answer to mark yourself");
const q3 = await state(page, () => bonsai.S.tq.ids[2]);
await page.keyboard.press("1"); await page.waitForFunction(() => bonsai.S.tq?.i === 3);
t.eq(await state(page, (id) => bonsai.today.pick().rated[id], q3), "good", "Right is good");
await page.keyboard.press("Escape"); await page.waitForFunction(() => !bonsai.S.tq);
t.eq([await state(page, () => bonsai.today.open), await page.textContent("#todayProgress")], [true, "3/" + (await state(page, () => bonsai.today.pick().ids.length))], "Esc stops the round, back to Today");
await page.keyboard.press("Escape"); await page.waitForSelector("#today", { state: "hidden" });
t.eq(await page.$eval("#todayBlur", (b) => b.hidden), true, "and Esc again closes it");

// ---------- the calendar: numbers only, purple for 11 of 11, green ten or more, yellow fewer ----------
const days = await state(page, async () => {
  const d = (k) => { const x = new Date(); x.setDate(k); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(k).padStart(2, "0")}`; };
  const keys = [d(3), d(4), d(5), d(6)];
  const days = { ...(await bonsai.store.getMeta("days")), [keys[0]]: { n: 11, asked: 11, good: 11, done: true }, [keys[1]]: { n: 10, asked: 10, good: 10, done: true }, [keys[2]]: { n: 10, asked: 10, good: 6, done: true }, [keys[3]]: { n: 10, asked: 0, good: 0, done: false } };
  await bonsai.store.setMeta("days", days); await bonsai.refresh(); return keys;
});
await page.keyboard.press("y"); await page.waitForSelector("#todayCal");
const cal = await page.evaluate((keys) => { const v = (n) => getComputedStyle(document.body).getPropertyValue(n).trim(), rgb = (c) => { const e = document.createElement("i"); e.style.color = c; document.body.append(e); const r = getComputedStyle(e).color; e.remove(); return r; };
  return { cells: keys.map((k) => { const s = document.querySelector(`.tdday[data-day="${k}"] .s`); return s ? [s.textContent, getComputedStyle(s).color] : null; }), want: ["--perfect", "--accent", "--fair"].map((x) => rgb(v(x))) }; }, days);
t.eq(cal.cells, [["11", cal.want[0]], ["10", cal.want[1]], ["6", cal.want[2]], null], "11 purple, 10 green, 6 yellow, nothing asked shows nothing");
await page.screenshot({ path: "tests/shots/qbank-calendar.png" });
await page.keyboard.press("Escape");

await ctx.close();

// ---------- the phone: no Claude; the note asks, the name is kept back; Show, then Got it or Missed ----------
const pctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), phone = await pctx.newPage();
phone.on("pageerror", (e) => t.fail("phone page error: " + e.message));
await phone.goto(t.url + "#/notes"); await phone.waitForSelector("body[data-ready]");
await phone.tap("#todayBtn"); await phone.waitForSelector("#today #todayGo");
await phone.tap("#todayGo"); await phone.waitForSelector("#tq #tqShow");
const cue = await state(phone, () => { const n = bonsai.S.byId.get(bonsai.S.tq.ids[0]), card = document.querySelector("#tq").textContent; return { note: (n.note || "").trim(), title: n.title, qs: (n.qs || []).length, kind: document.querySelector("#tqKind")?.textContent || "", q: document.querySelector("#tqQ").textContent, hidden: !card.includes(n.title) }; });
if (!cue.qs && cue.note) t.eq([cue.kind, cue.q, cue.hidden], ["Name", cue.note, true], "no question yet: its note asks, the name kept back");
t.eq(await phone.$("#tqAnswer"), null, "no answer box without Claude");
const box = await phone.locator("#today").boundingBox(), show = await phone.locator("#tqShow").boundingBox();
t.eq([Math.round(box.width), box.height >= 800, show.height >= 48], [390, true, true], "the box fills the phone, big buttons");
await phone.screenshot({ path: "tests/shots/qbank-phone-question.png" });
await phone.tap("#tqShow"); await phone.waitForSelector("#tqRate");
t.eq(await phone.$$eval("#tqRate .btn", (b) => b.map((x) => x.firstChild.textContent)), ["Got it", "Missed"], "Got it or Missed, no difficulty scale");
const pid = await state(phone, () => bonsai.S.tq.ids[0]);
await phone.screenshot({ path: "tests/shots/qbank-phone-answer.png" });
await phone.tap('#tqRate .btn[data-mark="missed"]'); await phone.waitForFunction(() => bonsai.S.tq?.i === 1);
t.eq(await state(phone, (id) => bonsai.today.pick().rated[id], pid), "again", "Missed is again");
await phone.tap("#tqStop"); await phone.waitForSelector("#today #todayGo");
await pctx.close();
await t.end();
