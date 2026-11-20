// Questions of five kinds: watering asks a question instead of showing the idea's name, Space shows the answer,
// and the rating is as before. Q writes one on the picked idea (the board's idea card lists them); Rebuild hides
// what hangs from an idea; a question that can't be used now falls back to the name. In Bonsai Desktop (a stand-in
// bridge here) a graph's menu has Write questions: Claude writes them, he ticks which to keep. Grow writes them too.
import { readFileSync } from "node:fs";
import { start, state } from "./lib.mjs";

const t = await start("run34-questions", 4335, { channel: "beta" });
const bridge = () => {
  const asked = [];
  window.bonsaiDesktop = { update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: () => () => {}, cancel: () => {},
    ask: async (req) => {
      asked.push(req.prompt); await new Promise((r) => setTimeout(r, 60));
      // read the sheet of ideas back: "N. Title | note", then "under it:" and "linked to:" lines
      const ideas = []; let cur = null;
      for (const line of req.prompt.split("\n")) {
        let m;
        if ((m = line.match(/^(\d+)\. (.+?)(?: \| .*)?$/))) ideas.push((cur = { k: +m[1], title: m[2], kids: [], links: [] }));
        else if (cur && (m = line.match(/^ {3}under it: (.+)$/))) cur.kids = m[1].split("; ");
        else if (cur && (m = line.match(/^ {3}linked to: (.+)$/))) cur.links = m[1].split("; ").map((x) => x.replace(/ \(.*\)$/, ""));
      }
      const questions = ideas.map((i) => i.links.length ? { idea: i.k, kind: "connect", q: `How does it relate to ${i.links[0]}?`, a: "They share a cause", link: i.links[0] }
        : i.kids.length >= 2 ? { idea: i.k, kind: "rebuild", q: "", hide: i.kids.slice(0, 2) }
        : { idea: i.k, kind: i.k % 2 ? "recall" : "why", q: `Question ${i.k}?`, a: "" });
      questions.push({ idea: 999, kind: "recall", q: "Nowhere" }, { idea: 1, kind: "sing", q: "Bad kind" });
      return { ok: true, text: "```json\n" + JSON.stringify({ questions }) + "\n```" };
    },
  } };
  window.__asked = asked;
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge);
const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));

// ---------- the pure rules (questions.js) ----------
const rules = await page.evaluate(async () => {
  const Q = await import(new URL("questions.js", location.href));
  const n = (qs) => ({ id: "n1", title: "Impulse", qs });
  const kids = [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }], links = [{ id: "l1", other: { title: "Momentum" } }];
  const out = {};
  out.none = Q.questionFor(n(), {}, 5).kind;
  out.connectNoLink = Q.questionFor(n([{ kind: "connect", q: "How?" }]), { links: [] }, 5).kind;
  out.connectGone = Q.questionFor(n([{ kind: "connect", q: "How?", linkId: "l9" }]), { links }, 5).kind;
  out.connectOk = Q.questionFor(n([{ kind: "connect", q: "How?", linkId: "l1" }]), { links }, 5).kind;
  out.rebuildNoKids = Q.questionFor(n([{ kind: "rebuild", q: "Fill the blanks", hide: ["c1"] }]), { kids: [] }, 5).kind;
  const rb = Q.questionFor(n([{ kind: "rebuild", q: "Fill the blanks", hide: ["gone"] }]), { kids }, 5);
  out.rebuildRepick = [rb.kind, rb.hide.length, rb.hide.every((h) => kids.some((k) => k.id === h))];
  out.emptyQ = Q.questionFor(n([{ kind: "why", q: "  " }]), {}, 5).kind;
  const many = n([{ kind: "recall", q: "A?" }, { kind: "why", q: "B?" }, { kind: "apply", q: "C?" }]);
  out.varies = new Set([0, 1, 2, 3, 4, 5].map((d) => Q.questionFor(many, {}, d).kind)).size;
  out.made = [Q.makeQuestion({ kind: "rebuild", hide: ["a", "a", "b"] }), Q.makeQuestion({ kind: "nope", q: "x" }), Q.makeQuestion({ kind: "recall", q: "" })];
  const ideas = [{ id: "x1", title: "Lenz's law", kids: [], links: [{ id: "L", other: "Faraday's law" }] }, { id: "x2", title: "Induction", kids: [{ id: "k1", title: "Coils" }, { id: "k2", title: "Cores" }], links: [] }];
  const r = Q.readQuestions('Sure:\n```json\n{"questions":[{"idea":1,"kind":"connect","q":"How?","link":"faraday\'s law"},{"idea":2,"kind":"rebuild","q":"","hide":["Cores"]},{"idea":2,"kind":"connect","q":"No links"},{"idea":3,"kind":"why","q":"?"}]}\n```', ideas);
  out.read = [r.list.map((x) => [x.id, x.q.kind, x.q.linkId || x.q.hide?.join() || "", x.q.by]), r.bad];
  out.prompt = Q.questionsPrompt({ topic: "Physics", graph: "Electromagnetism", ideas }).includes("2. Induction\n   under it: Coils; Cores");
  // Grow: question lines under new ideas; old replies read as before
  const N = await import(new URL("notes.js", location.href));
  const g = N.readGrow("```\nbonsai grow\ngraph: Waves\nWave | A travelling disturbance\n  ? What carries energy without carrying matter?\n  Frequency | Waves per second\n    ? why: Why is pitch set by frequency? | The ear hears rate of vibration\n    ? apply: A 2 m wave at 5 Hz: speed? | 10 m/s\n= Old idea\n  ? Not mine\n```");
  out.grow = [g.graphs[0].items.map((i) => (i.qs || []).map((q) => q.kind + ":" + q.q + (q.a ? "=" + q.a : ""))), g.bad];
  const plan = N.planGrow(g, {});
  out.growPlan = [plan.trees[0].qs?.length, plan.nodes.find((x) => x.title === "Frequency")?.qs?.length];
  out.prompt2 = N.growPrompt({ topic: "T", page: { title: "p", text: "x" } }).includes('"why:"');
  return out;
});
t.eq(rules.none, "name", "no question: the name is the cue");
t.eq([rules.connectNoLink, rules.connectGone, rules.connectOk], ["name", "name", "connect"], "Connect only with its link there");
t.eq(rules.rebuildNoKids, "name", "Rebuild only for an idea with ideas under it");
t.eq(rules.rebuildRepick, ["rebuild", 3, true], "Rebuild hides afresh when what it hid is gone");
t.eq(rules.emptyQ, "name", "an empty question isn't asked");
t.eq(rules.varies, 3, "the kind asked changes from day to day");
t.eq([rules.made[0].hide, rules.made[0].q, rules.made[1], rules.made[2]], [["a", "b"], "Fill the blanks", null, null], "questions are tidied as they're made");
t.eq(rules.read, [[["x1", "connect", "L", "claude"], ["x2", "rebuild", "k2", "claude"]], 2], "Claude's reply read against the ideas asked about");
t.eq(rules.prompt, true, "the prompt lists each idea with what hangs from it");
t.eq(rules.grow, [[["recall:What carries energy without carrying matter?"], ["why:Why is pitch set by frequency?=The ear hears rate of vibration", "apply:A 2 m wave at 5 Hz: speed?=10 m/s"], []], 1], "Grow's question lines are read under their idea");
t.eq(rules.growPlan, [1, 2], "Grow's plan carries the questions");
t.eq(rules.prompt2, true, "Grow asks for questions");
const old = await page.evaluate(async (text) => { const N = await import(new URL("notes.js", location.href)); const r = N.readGrow(text); return [r.graphs.map((g) => g.items.length), r.links.length, r.bad, r.graphs.some((g) => g.items.some((i) => i.qs))]; }, readFileSync("tests/fixtures/grow-mechanics.txt", "utf8"));
t.eq(old, [[7, 4], 2, 0, false], "an old Grow reply still reads, with no questions");

// ---------- Grow saves them on the ideas it makes ----------
const grown = await page.evaluate(async () => {
  const N = await import(new URL("notes.js", location.href)), S = bonsai.S, z = S.zones[0];
  const p = await bonsai.store.addPage({ title: "Waves" });
  const plan = N.planGrow(N.readGrow("bonsai grow\ngraph: Waves test\nWave | A disturbance\n  ? What moves through a medium?\n  Crest | Top of a wave\n    ? why: Why? | Because"), { trees: [], nodes: [], allNodes: S.nodes, links: S.links });
  const made = await bonsai.store.growPage(p.id, plan, z.id); await bonsai.refresh();
  return made.nodeIds.map((id) => bonsai.S.byId.get(id)).map((n) => [n.title, (n.qs || []).map((q) => q.kind + "/" + q.by)]);
});
t.eq(grown, [["Wave", ["recall/claude"]], ["Crest", ["why/claude"]]], "Grow keeps the questions it wrote, by Claude");

// ---------- a graph to work on: one idea with a link, one with two or more under it ----------
const g = await state(page, () => {
  const S = bonsai.S;
  for (const tr of S.trees) {
    const ns = S.nodes.filter((n) => n.treeId === tr.id && n.parentId);
    const parent = ns.find((n) => (S.kids.get(n.id) || []).length >= 2);
    const leaf = ns.find((n) => n !== parent && !(S.kids.get(n.id) || []).length && (n.note || "").trim());
    if (parent && leaf) return { id: tr.id, parent: parent.id, kids: (S.kids.get(parent.id) || []).map((k) => k.id), leaf: leaf.id, leafTitle: leaf.title };
  }
});
if (!g) { t.fail("no graph in the demo to try questions on"); await t.end(); }
await page.evaluate((id) => { location.hash = "#/notes/g:" + id; }, g.id);
await page.waitForSelector(".gboard canvas"); await page.waitForTimeout(400);

// Q on the picked idea writes a question; the card lists it
await page.evaluate((id) => bonsai.S.boardPick(id), g.leaf); await page.waitForSelector("#gcard #qsec");
await page.keyboard.press("q"); await page.waitForSelector("#qText");
t.eq(await page.$eval("#qKind option[value=rebuild]", (o) => o.disabled), true, "Rebuild can't be picked for an idea with nothing under it");
await page.fill("#qText", "What is it?"); await page.fill("#qAnswer", "The answer");
await page.click(".dialog button.primary");
await page.waitForFunction((id) => bonsai.S.byId.get(id)?.qs?.length === 1, g.leaf);
t.eq(await state(page, (id) => { const q = bonsai.S.byId.get(id).qs[0]; return [q.kind, q.q, q.a, q.by]; }, g.leaf), ["recall", "What is it?", "The answer", "you"], "your own question is kept on the idea");
await page.waitForFunction(() => document.querySelectorAll("#gcard .qrow").length === 1);
t.eq(await page.textContent("#gcard .qrow .qtext"), "What is it?", "the card lists it");

// watering asks it: the name kept back on the board, Space shows the answer, a rating as before
await page.evaluate(({ id, leaf }) => bonsai.water([leaf], id), { id: g.id, leaf: g.leaf });
await page.waitForSelector("#reviewQ");
t.eq([await page.textContent("#reviewQ"), await page.textContent("#reviewKind"), await page.$("#reviewAns")], ["What is it?", "Recall", null], "the round asks the question, not the name");
t.eq([await page.textContent("#gfoot"), await page.$eval("#gcard", (c) => c.hidden)], ["?", true], "the name isn't shown on the board while the question waits");
await page.screenshot({ path: "tests/shots/questions-ask.png" });
await page.keyboard.press(" "); await page.waitForSelector("#reviewAns");
t.eq((await page.textContent("#reviewAns")).includes(g.leafTitle) && (await page.textContent("#reviewAns")).includes("The answer"), true, "Space shows the idea's name, note and answer");
await page.screenshot({ path: "tests/shots/questions-review.png" });
await page.keyboard.press("3"); await page.waitForSelector("#review", { state: "hidden" });
const ev = await state(page, async (id) => (await bonsai.store.listEvents()).filter((e) => e.type === "node.review" && e.ref === id).at(-1)?.data, g.leaf);
t.eq(ev, { rating: "good", asked: "recall" }, "rated as before; the log says what was asked");

// Rebuild: the idea with blanks where hidden ideas hang; Space fills them in
const hide = g.kids.slice(0, 2);
await page.evaluate(({ parent, hide }) => bonsai.store.setQuestions(parent, [{ kind: "rebuild", q: "", hide }]).then(() => bonsai.refresh()), { parent: g.parent, hide });
await page.evaluate(({ id, parent }) => bonsai.water([parent], id), { id: g.id, parent: g.parent });
await page.waitForSelector("#rebuildList");
t.eq([await page.$$eval("#rebuildList li.blank", (x) => x.length), await page.textContent("#reviewKind")], [2, "Rebuild"], "Rebuild shows blanks for the hidden ideas");
await page.screenshot({ path: "tests/shots/questions-rebuild-ask.png" });
await page.keyboard.press("Enter"); await page.waitForSelector("#rebuildList li.hid");
const filled = await page.$$eval("#rebuildList li.hid", (x) => x.map((l) => l.textContent));
t.eq(filled, await state(page, (ids) => ids.map((id) => bonsai.S.byId.get(id).title), hide), "Enter shows what was hidden");
await page.screenshot({ path: "tests/shots/questions-rebuild.png" });
await page.click("#reviewClose"); await page.waitForSelector("#review", { state: "hidden" });

// an idea with no question is cued by its name, as before
const plain = await state(page, ({ id, leaf, parent }) => bonsai.S.nodes.find((n) => n.treeId === id && n.id !== leaf && n.id !== parent && !n.qs)?.id, g);
await page.evaluate(({ id, plain }) => bonsai.water([plain], id), { id: g.id, plain });
await page.waitForSelector("#showAnswer");
t.eq([await page.$("#reviewQ"), await page.textContent("#review h2")], [null, await state(page, (id) => bonsai.S.byId.get(id).title, plain)], "no question: the name, as before");
await page.click("#reviewClose"); await page.waitForSelector("#review", { state: "hidden" });

// deleting one from the card, with Undo
await page.evaluate((id) => bonsai.S.boardPick(id), g.leaf); await page.waitForSelector("#gcard .qrow");
await page.click("#gcard .qrow .ib");
await page.waitForFunction((id) => !bonsai.S.byId.get(id)?.qs, g.leaf);
await page.click("#toast .link");
await page.waitForFunction((id) => bonsai.S.byId.get(id)?.qs?.length === 1, g.leaf);
t.eq(true, true, "a question deleted comes back with Undo");

// ---------- Bonsai Desktop: Claude writes questions for ideas with none; he ticks which to keep ----------
const items = await state(page, (id) => bonsai.graphItems(bonsai.S.trees.find((x) => x.id === id)).filter(Boolean).map((x) => x.label || x), g.id);
t.eq(items.includes("Write questions"), true, "a graph's menu offers Write questions in Bonsai Desktop");
const without = await state(page, (id) => bonsai.S.nodes.filter((n) => n.treeId === id && !n.ghost && !(n.qs || []).length).length, g.id);
await page.evaluate((id) => { bonsai.graphItems(bonsai.S.trees.find((x) => x.id === id)).find((i) => i?.label === "Write questions").run(); }, g.id);   // don't wait on the dialog
await page.waitForSelector("#wqList .wqrow");
const rowsN = await page.$$eval("#wqList .wqrow", (x) => x.length);
t.eq([rowsN, await state(page, () => __asked.at(-1).startsWith("Write review questions"))], [Math.min(without, 40), true], "one proposal per idea with no question; the bad ones are dropped");
t.eq(await state(page, () => __asked.at(-1).includes("What is it?")), false, "ideas that have a question aren't asked about");
await page.screenshot({ path: "tests/shots/questions-write.png" });
await page.click("#wqList .wqrow input");   // untick the first
await page.click(".dialog button.primary");
await page.waitForSelector("#toast");
t.eq(await page.textContent("#toast span"), `Kept ${rowsN - 1} question${rowsN - 1 === 1 ? "" : "s"}`, "only the ticked ones are kept");
const byClaude = await state(page, (id) => bonsai.S.nodes.filter((n) => n.treeId === id && (n.qs || []).some((q) => q.by === "claude")).length, g.id);
t.eq(byClaude, rowsN - 1, "kept on their ideas, by Claude");
await page.click("#toast .link");
await page.waitForFunction((id) => !bonsai.S.nodes.some((n) => n.treeId === id && (n.qs || []).some((q) => q.by === "claude")), g.id);
t.eq(true, true, "Undo takes the batch back");

// the idea panel in the Knowledge window has them too, and Q there
await page.evaluate((id) => bonsai.openTree(id), g.id); await page.waitForFunction(() => bonsai.S.view === "tree");
await page.keyboard.press("1"); await page.waitForFunction(() => !!bonsai.S.sel);
await page.keyboard.press(" "); await page.waitForSelector("#panel #qsec");
await page.keyboard.press("q"); await page.waitForSelector("#qText");
await page.fill("#qText", "Why does it start here?"); await page.selectOption("#qKind", "why"); await page.click(".dialog button.primary");
await page.waitForFunction(() => bonsai.S.byId.get(bonsai.S.sel)?.qs?.at(-1)?.kind === "why");
await page.waitForFunction(() => [...document.querySelectorAll("#panel .qrow .qtext")].some((b) => b.textContent === "Why does it start here?"));
t.eq(true, true, "the idea panel lists questions and Q adds one there");

await ctx.close();
await t.end();
