// Key points on questions (0.38.0, after his first rounds with real Claude): the question-writing prompt asks for a
// scoped question with one reading and 1–3 key points; Claude marks point by point (ticks and gaps); one nudge when
// some points are missing, then the whole is marked (right after a nudge scores right but is reviewed hard); the
// round's ⋯ menu: Vague (flagged, not counted), Rewrite now, Edit, Skip; overruling flags; the bank writes flagged
// and older pointless questions again, never his own; the phone shows the points; "Matter › Matter" shows once.
import { start, state } from "./lib.mjs";
import { questionsPrompt, readQuestions, cleanQs, markPrompt, readMark, needsRedo } from "../src/questions.js";
import { recordOf } from "../src/today.js";

const t = await start("run43-qpoints", 4344, { channel: "beta" });

// ----- pure -----
const P = questionsPrompt({ topic: "Maths", ideas: [{ id: "a", title: "Integrals", note: "Area under a curve", need: 3 }], per: 3 });
t.eq([/shape of the answer/.test(P), /exactly one reasonable reading/.test(P), /second meaning/.test(P), /"pts":\[/.test(P), /how many points/.test(P), /Never put the idea's title/.test(P)], [true, true, true, true, true, true], "the prompt asks for the answer's shape, one reading, how many points, and key points");
const kept = cleanQs([{ kind: "why", q: "Why? Give two reasons.", a: "x", pts: ["- one", "two", "three", "four"], by: "claude", flag: "vague", flagAt: "2026-11-23T00:00:00Z" }, { kind: "recall", q: "Old one", a: "y", by: "claude" }]);
t.eq([kept[0].pts, kept[0].flag, kept[1].pts, needsRedo(kept[0]), needsRedo(kept[1]), needsRedo({ kind: "recall", q: "Mine", by: "you" })], [["one", "two", "three"], "vague", undefined, true, true, false], "pts kept (three at most), flags kept, old ones still read; his own never redone");
const R = readQuestions(JSON.stringify({ questions: [{ idea: 1, kind: "recall", q: "Which rule?", a: "The chain rule" }, { idea: 1, kind: "why", q: "Why, in two points?", a: "…", pts: ["p", "q"], rewrites: 1 }] }), [{ id: "a", title: "X", need: 1, redo: [{ kind: "why", q: "Vague why", why: "vague" }] }]);
t.eq(R.list.map((x) => [x.q.kind, x.q.pts, x.replaces || ""]), [["recall", ["The chain rule"], ""], ["why", ["p", "q"], "Vague why"]], "a reply without points gets its answer as one; a rewrite says what it replaces");
const MP = markPrompt({ q: "Q?", pts: ["a", "b"], answer: "a", nudge: true });
t.eq([/Key points:\n1\. a\n2\. b/.test(MP), /"got"/.test(MP), /"nudge"/.test(MP), /"nudge"/.test(markPrompt({ q: "Q?", pts: ["a"], answer: "a", first: "x", hint: "h" }))], [true, true, true, false], "marking sends the points, asks got per point, and a nudge on a first try only");
t.eq(readMark('{"got":[true,false],"mark":"right","why":"w","nudge":"And b?"}', 2), { mark: "partly", why: "w", got: [true, false], nudge: "And b?" }, "the mark follows the points");
t.eq(recordOf({ ids: ["a", "b", "c"], rated: { a: "good", b: "void" } }), { n: 2, asked: 1, good: 1, done: false }, "a vague one leaves the day's count");

// ----- the app, with a stand-in Claude -----
const bridge = () => {
  const asked = [], wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.bonsaiDesktop = { update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: () => () => {}, cancel: () => {},
    ask: async (req) => {
      const p = req.prompt; asked.push(p); await wait(30);
      if (p.startsWith("Mark my answer")) {
        const pts = [], lines = p.split("\n"); let inPts = false;
        for (const l of lines) { if (l === "Key points:") { inPts = true; continue; } const m = inPts && l.match(/^\d+\. (.*)$/); if (m) pts.push(m[1]); else inPts = false; }
        const ans = lines.filter((l) => /^(My answer|My first answer|What I added): /.test(l)).join(" ").toLowerCase();
        const got = pts.map((x) => ans.includes(x.toLowerCase()));
        const mark = pts.length ? (got.every(Boolean) ? "right" : got.some(Boolean) ? "partly" : "missed") : /right/.test(ans) ? "right" : "missed";
        return { ok: true, text: JSON.stringify({ ...(pts.length ? { got } : {}), mark, why: "Marked " + mark, ...(mark === "partly" && p.includes('add "nudge"') ? { nudge: "And the other one?" } : {}) }) };
      }
      // writing questions: rewrites as asked, then new ones as each idea says
      const ideas = []; let cur = null;
      for (const l of p.split("\n")) {
        let m;
        if ((m = l.match(/^(\d+)\. (.+?)(?: \| .*)?$/))) ideas.push((cur = { k: +m[1], title: m[2], redo: [], has: [], need: 3 }));
        else if (cur && (m = l.match(/^ {3}rewrite (\d+) \((\w+)/))) cur.redo.push({ n: +m[1], kind: m[2] });
        else if (cur && (m = l.match(/^ {3}already has: (.*); write (\d+ new|no new ones)$/))) { cur.has = m[1].split(", "); cur.need = /^\d/.test(m[2]) ? +m[2].split(" ")[0] : 0; }
      }
      const only = p.includes("Write only the rewrites");
      const questions = ideas.flatMap((i) => [
        ...i.redo.map((r) => ({ idea: i.k, kind: r.kind, q: `Rewritten ${r.kind} ${r.n} for card ${i.k}: say which, in one line.`, a: "The one", pts: ["the one"], rewrites: r.n })),
        ...(only ? [] : ["recall", "why", "apply"].filter((k) => !i.has.includes(k)).slice(0, i.need).map((kind) => ({ idea: i.k, kind, q: `New ${kind} for card ${i.k}?`, a: "An answer", pts: ["an answer"] }))),
      ]);
      return { ok: true, text: JSON.stringify({ questions }) };
    },
  } };
  window.__asked = asked;
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge);
const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));

// seven leaf ideas, one question each, as today's pick; the first graph named like its topic
const Q = [
  { kind: "why", q: "Integrating what gives the area under a curve, and integrating what gives a volume? Give both.", a: "Height along x; cross-section area along the third axis.", pts: ["height along x", "cross-section area"] },
  { kind: "why", q: "Name both conditions. Give two.", a: "Alpha and beta.", pts: ["alpha", "beta"] },
  { kind: "recall", q: "Which law ties force to the rate of change of momentum?", a: "Newton's second law", pts: ["second law"] },
  { kind: "recall", q: "What happens when heating makes a solid turn to liquid?", a: "It melts at its melting point.", pts: ["melting point"] },
  { kind: "recall", q: "A loose old question?", a: "Something", by: "claude" },
  { kind: "recall", q: "One to edit?", a: "Edited", pts: ["edited"] },
  { kind: "recall", q: "One to skip?", a: "Skip", pts: ["skip"] },
];
const ids = await state(page, async (Q) => {
  const S = bonsai.S, kids = (id) => S.nodes.some((x) => x.parentId === id);
  const leaves = S.nodes.filter((n) => n.parentId && !kids(n.id) && !n.ghost && !S.links.some((l) => l.fromId === n.id || l.toId === n.id)).slice(0, Q.length);
  for (let i = 0; i < Q.length; i++) await bonsai.store.setQuestions(leaves[i].id, [{ by: "claude", at: "2026-11-0" + (i + 1) + "T00:00:00Z", ...Q[i] }]);
  const tr = S.trees.find((x) => x.id === leaves[0].treeId), z = S.zones.find((x) => x.id === tr.zoneId);
  await bonsai.store.updateTree(tr.id, { name: z.name });
  const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await bonsai.store.setMeta("today", { day, ids: leaves.map((n) => n.id), kinds: {}, bonus: null, rated: {} });
  await bonsai.refresh();
  return leaves.map((n) => n.id);
}, Q);
const reviews = (id) => state(page, async (id) => (await bonsai.store.eventsSince("2000-01-01")).filter((e) => e.type === "node.review" && e.ref === id).map((e) => e.data.rating), id);
const qOf = (id) => state(page, (id) => bonsai.S.byId.get(id).qs[0], id);
const typeSend = async (text) => { await page.waitForFunction(() => document.activeElement?.id === "tqAnswer"); await page.keyboard.type(text); await page.keyboard.press("Enter"); };
const at = (i) => page.waitForFunction((i) => bonsai.S.tq?.i === i && bonsai.S.tq.phase === "ask", i);

await page.keyboard.press("y"); await page.waitForSelector("#today #todayGo");
await page.keyboard.press("Enter"); await page.waitForSelector("#tq #tqAnswer");
const path = await page.textContent("#tq .tqpath");
t.eq([path.includes("›"), path.length > 0], [false, true], "a graph named like its topic shows the name once");
t.eq([await page.$$eval("#tqN i", (x) => x.length), await page.getAttribute("#tqN", "title")], [2, "2 points"], "two small squares under a two-point question");
t.eq(await page.$$eval("#tq .tdhead kbd", (k) => k.map((x) => x.textContent)), ["Alt+M", "Esc"], "the ⋯ menu and Stop show their keys");
await page.screenshot({ path: "tests/shots/qpoints-ask.png" });

// 1. some points → a nudge → the rest → right, but reviewed hard
await typeSend("integrate the cross-section area along the third axis");
await page.waitForSelector("#tqNudge");
t.eq([await page.textContent("#tqNudge"), await page.textContent("#tqSaid"), await state(page, () => document.activeElement?.id)], ["And the other one?", "integrate the cross-section area along the third axis", "tqAnswer"], "a nudge, his answer kept, the box ready again");
t.eq(await page.$$eval("#tq kbd", (k) => ["↵", "Esc"].every((x) => k.map((y) => y.textContent).includes(x))), true, "Send ↵ and Mark it Esc");
await page.screenshot({ path: "tests/shots/qpoints-nudge.png" });
const n1 = await state(page, () => __asked.length);
await typeSend("and the height along x for area");
await page.waitForSelector("#tqMark");
const mp2 = await state(page, () => __asked.at(-1));
t.eq([await state(page, () => __asked.length) - n1, mp2.includes("My first answer: integrate"), mp2.includes("Your hint: And the other one?"), mp2.includes("What I added: and the height"), mp2.includes('add "nudge"')], [1, true, true, true, false], "the second answer is marked with the first, no second nudge");
t.eq([await page.textContent("#tqMark b"), await page.$$eval("#tqPts li", (l) => l.map((x) => x.className))], ["Right", ["got", "got"]], "right, every point ticked");
await page.keyboard.press("Enter"); await at(1);
t.eq([await reviews(ids[0]), await state(page, (id) => bonsai.today.pick().rated[id], ids[0])], [["hard"], "good"], "right after a nudge: scored right, reviewed hard");

// 2. a nudge skipped with Esc: straight to the mark, point by point
await typeSend("alpha only");
await page.waitForSelector("#tqNudge");
await page.keyboard.press("Escape"); await page.waitForSelector("#tqMark");
t.eq([await page.textContent("#tqMark b"), await page.$$eval("#tqPts li", (l) => l.map((x) => [x.className, x.textContent])), !!(await page.$("#tqAns")), await state(page, () => !!bonsai.S.tq)], ["Partly", [["got", "alpha"], ["gap", "beta"]], true, true], "Esc skips the nudge: a tick and a gap, then the stored answer; the round goes on");
await page.screenshot({ path: "tests/shots/qpoints-marked.png" });
await page.keyboard.press("Enter"); await at(2);
t.eq(await reviews(ids[1]), ["hard"], "partly is hard");

// 3. right, overruled to Missed: the question is flagged
await typeSend("Newton's second law");
await page.waitForSelector("#tqMark"); t.eq(await page.textContent("#tqMark b"), "Right", "all points: right, no nudge");
await page.keyboard.press("3"); await at(3);
t.eq([(await qOf(ids[2])).flag, await reviews(ids[2])], ["overruled", ["again"]], "overruled: flagged, and his mark stands");

// 4. ⋯ → Vague: flagged, not counted, not reviewed
await page.keyboard.press("Alt+m"); await page.waitForSelector(".menu");
t.eq(await page.$$eval(".menu .mi", (b) => b.map((x) => [x.querySelector("span").textContent, x.querySelector("kbd")?.textContent || ""])), [["Vague question", "V"], ["Rewrite now", "R"], ["Edit question", "E"], ["Skip", "S"], ["Nudges off", "N"]], "the menu: Vague, Rewrite now, Edit, Skip, with keys");
await page.screenshot({ path: "tests/shots/qpoints-menu.png" });
const dayN = () => state(page, () => bonsai.today.days()[bonsai.today.pick().day]?.n);
const rec0 = { n: await dayN() };
await page.keyboard.press("v"); await at(4);
t.eq([(await qOf(ids[3])).flag, await reviews(ids[3]), await state(page, (id) => bonsai.today.pick().rated[id], ids[3])], ["vague", [], "void"], "Vague: flagged, not reviewed, off the day's count");
t.eq(await dayN(), rec0.n - 1, "the day asks one fewer");

// 5. ⋯ → Rewrite now: Claude writes it again, with points, and it's asked straight away
await page.click("#tqMenu"); await page.waitForSelector(".menu"); await page.keyboard.press("r");
await page.waitForFunction(() => bonsai.S.tq?.phase === "ask" && /^Rewritten/.test(document.querySelector("#tqQ")?.textContent || ""));
const rq = await qOf(ids[4]);
t.eq([rq.q.startsWith("Rewritten recall 1"), rq.pts, rq.by, await state(page, () => bonsai.S.tq.i), (await state(page, (id) => bonsai.S.byId.get(id).qs.length, ids[4]))], [true, ["the one"], "claude", 4, 1], "Rewrite now: replaced, with points, asked at once");
t.eq(await state(page, () => __asked.at(-1).includes("Write only the rewrites") && __asked.at(-1).includes("rewrite 1 (recall, I found it vague): A loose old question?")), true, "only that question, said to be vague");
await typeSend("the one");
await page.waitForSelector("#tqMark"); await page.keyboard.press("Enter"); await at(5);

// 6. ⋯ → Edit: the editor, then the edited question is asked; it's his now
await page.keyboard.press("Alt+m"); await page.waitForSelector(".menu"); await page.keyboard.press("e");
await page.waitForSelector("#qText");
t.eq(await page.inputValue("#qPts"), "edited", "the editor shows the key points");
await page.fill("#qText", "Which one did I edit? Name it."); await page.click(".dialog button.primary");
await page.waitForFunction(() => document.querySelector("#tqQ")?.textContent === "Which one did I edit? Name it.");
t.eq([(await qOf(ids[5])).by, await state(page, () => bonsai.S.tq.i)], ["you", 5], "edited: asked as changed, and his now");

// 7. ⋯ → Skip: on without a rating
await page.keyboard.press("Alt+m"); await page.waitForSelector(".menu"); await page.keyboard.press("s"); await at(6);
t.eq([await reviews(ids[5]), await state(page, (id) => bonsai.today.pick().rated[id] || "", ids[5])], [[], ""], "Skip: not rated, left for later");
await page.keyboard.press("Alt+m"); await page.waitForSelector(".menu"); await page.keyboard.press("s");
await page.waitForFunction(() => !bonsai.S.tq);
t.eq(await page.$$eval("#todayQs .tdq.void", (x) => x.length), 1, "the vague one shows as a dashed square");
await page.keyboard.press("Escape");

// ----- the bank writes flagged questions first, then what's missing, then old ones; never his -----
const setup = await state(page, async (ids) => {
  const S = bonsai.S;
  await bonsai.store.setQuestions(ids[6], [{ kind: "recall", q: "Stale recall?", a: "x", by: "claude", at: "2026-01-01T00:00:00Z" }, { kind: "why", q: "My own why?", a: "y", by: "you" }, { kind: "apply", q: "Good apply?", a: "z", pts: ["z"], by: "claude" }]);
  await bonsai.refresh();
  return { next: bonsai.bank.next(), redo: bonsai.bank.redo() };
}, ids);
t.eq([setup.next.tiers.every((x) => x === 0), setup.next.ids.includes(ids[2]) || setup.next.ids.includes(ids[3]), setup.next.ids.includes(ids[6])], [true, true, false], "the first batch is the flagged ones");
const before = await state(page, () => __asked.length);
await state(page, () => bonsai.bank.run({ all: true }));
await page.waitForFunction(() => !bonsai.bank.on, null, { timeout: 120000 });
const after = await state(page, (ids) => ({ asked: __asked.slice(0), redo: bonsai.bank.redo(), c: bonsai.bank.count(), q2: bonsai.S.byId.get(ids[2]).qs.map((q) => [q.q.slice(0, 18), q.flag || ""]), q6: bonsai.S.byId.get(ids[6]).qs.map((q) => [q.kind, q.by, q.q.slice(0, 18), !!q.pts]), q5: bonsai.S.byId.get(ids[5]).qs.map((q) => q.q) }), ids);
const mine = after.asked.slice(before);
const firstFlag = mine.findIndex((p) => p.includes("I overruled your mark") || p.includes("I found it vague")), stale = mine.findIndex((p) => p.includes("Stale recall?")), lastNew = mine.map((p, i) => (p.includes("Write only the rewrites") ? -1 : i)).filter((i) => i >= 0).at(-1);
t.eq([firstFlag, stale > lastNew, mine[stale].includes("older style, no key points")], [0, true, true], "flagged first, old ones after every idea short of questions");
t.eq(after.q2.some((x) => x[1]), false, "the flagged questions are written again, unflagged");
t.eq(after.q6, [["recall", "claude", "Rewritten recall 1", true], ["why", "you", "My own why?", false], ["apply", "claude", "Good apply?", true]], "the old recall rewritten in place, his own left alone");
t.eq(after.q5[0], "Which one did I edit? Name it.", "his edited one is never rewritten");
t.eq([after.redo, after.c.done, after.c.total], [0, after.c.total, after.c.total], "nothing left to write again; Questions N of M counts it all");
await ctx.close();

// ----- the phone: Show reveals the points as a list, then Got it or Missed -----
const pctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), phone = await pctx.newPage();
phone.on("pageerror", (e) => t.fail("phone page error: " + e.message));
await phone.goto(t.url + "#/notes"); await phone.waitForSelector("body[data-ready]");
await state(phone, async () => {
  const S = bonsai.S, n = S.nodes.find((x) => x.parentId && !S.nodes.some((y) => y.parentId === x.id) && !x.ghost);
  await bonsai.store.setQuestions(n.id, [{ kind: "why", q: "Why does it hold? Give two reasons.", a: "Because of one and two.", pts: ["Reason one", "Reason two"], by: "claude" }]);
  const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await bonsai.store.setMeta("today", { day, ids: [n.id], kinds: {}, bonus: null, rated: {} }); await bonsai.refresh();
});
await phone.tap("#todayBtn"); await phone.waitForSelector("#today #todayGo");
await phone.tap("#todayGo"); await phone.waitForSelector("#tq #tqShow");
t.eq(await phone.$$eval("#tqN i", (x) => x.length), 2, "the phone shows the count too");
await phone.tap("#tqShow"); await phone.waitForSelector("#tqRate");
t.eq([await phone.$$eval("#tqPts li", (l) => l.map((x) => x.textContent)), await phone.$$eval("#tqRate .btn", (b) => b.map((x) => x.firstChild.textContent))], [["Reason one", "Reason two"], ["Got it", "Missed"]], "Show: the points listed under the answer, then Got it or Missed");
await phone.screenshot({ path: "tests/shots/qpoints-phone.png" });
await phone.tap("#tqMenu"); await phone.waitForSelector(".menu");
t.eq(await phone.$$eval(".menu .mi span", (b) => b.map((x) => x.textContent)), ["Vague question", "Edit question", "Skip"], "the phone's menu has no Claude items");
await phone.keyboard.press("Escape");
await pctx.close();
await t.end();
