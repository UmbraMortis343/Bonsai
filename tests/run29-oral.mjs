// The oral in the app (Bonsai Desktop; here a stand-in bridge): from watering, E turns the round into an oral on
// the ideas waiting. Questions are shown, Enter sends, Claude's tally lights greyed ideas as it hears them, marks
// come only at the end, any can be overruled, and saving waters what was shown and brings back what was missed.
import { start, state } from "./lib.mjs";

const t = await start("run29-oral", 4329, { channel: "beta" });
const bridge = () => {
  const subs = new Set(), asked = [];
  const sheet = (p) => [...p.matchAll(/^(\S+) \| \s*(.+?) \| /gm)].map((m) => ({ key: m[1], title: m[2] }));
  const said = (p) => [...p.matchAll(/"""\n([\s\S]*?)\n"""/g)].map((m) => m[1]).join(" ").toLowerCase();
  window.bonsaiDesktop = { update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: (fn) => { subs.add(fn); return () => subs.delete(fn); }, cancel: () => {},
    ask: async (req) => {
      asked.push(req.prompt); await new Promise((r) => setTimeout(r, 60));
      const p = req.prompt, ideas = sheet(p), heard = ideas.filter((i) => said(p).includes(i.title.toLowerCase())).map((i) => i.key);
      let out;
      if (p.startsWith("Interview me")) { const n = (p.match(/^Question \d+:/gm) || []).length; out = { read: "", shown: heard, next: n < 2 ? "Why does that matter?" : "", done: n >= 2 }; }
      else out = { marks: ideas.map((i) => ({ key: i.key, shown: heard.includes(i.key), why: heard.includes(i.key) ? "you explained it" : "not mentioned" })), feedback: "Solid on the basics." };
      return { ok: true, text: "Here you go:\n```json\n" + JSON.stringify(out) + "\n```" };
    },
  } };
  window.__asked = asked;
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge);
const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
await page.goto(t.url); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive(false));

// A graph with ideas waiting, and one idea greyed as an exam would leave it.
const g = await state(page, () => { const S = bonsai.S, now = Date.now();
  const tr = S.trees.map((x) => ({ x, d: S.nodes.filter((n) => n.treeId === x.id && n.srs && Date.parse(n.srs.due) <= now).length })).sort((a, b) => b.d - a.d)[0].x;
  const nodes = S.nodes.filter((n) => n.treeId === tr.id); return { id: tr.id, nodes: nodes.map((n) => n.id), ghost: nodes.find((n) => n.id !== tr.rootId && !n.parentId === false && !(n.srs && Date.parse(n.srs.due) <= now))?.id };
});
await page.evaluate(async ({ ghost }) => { const S = bonsai.S, n = S.byId.get(ghost); await bonsai.store.restoreRows({ nodes: [{ ...n, ghost: true, srs: null }] }); await bonsai.refresh(); }, g);
await page.evaluate((id) => bonsai.openTree(id), g.id); await page.waitForFunction(() => bonsai.S.view === "tree");
await page.evaluate((id) => bonsai.water(null, id), g.id); await page.waitForSelector("#reviewOral");
t.eq(await page.textContent("#reviewOral"), "OralE", "a round offers an oral, with its key");
await page.keyboard.press("e"); await page.waitForSelector("#oralQ");
const q1 = await page.textContent("#oralQ");
t.eq([q1.startsWith("Tell me about "), await page.$$("#oralFinish").then((x) => x.length)], [true, 0], "it opens broad, with nothing to finish yet");
const sheetKeys = await page.evaluate(() => bonsai.S.oral.g.ideas.map((i) => i.key));
const ghostName = await page.evaluate((id) => bonsai.S.byId.get(id).title, g.ghost);
t.eq(sheetKeys.includes(g.ghost), false, "the oral from watering covers what was waiting");

// Exam-style: the graph's own Oral (its menu) also asks about the greyed idea, which lights up once heard.
await page.click("#oralClose");
await page.evaluate((id) => bonsai.graphItems(bonsai.S.trees.find((x) => x.id === id)).find((i) => i && i.label === "Oral").run(), g.id);
await page.waitForSelector("#oralQ");
t.eq(await page.evaluate((id) => bonsai.S.oral.g.ideas.some((i) => i.key === id), g.ghost), true, "the graph's Oral asks about greyed ideas too");
await page.fill("#oralAnswer", `It is mostly about ${ghostName}.`); await page.press("#oralAnswer", "Enter");
await page.waitForFunction(() => document.querySelector("#oralQ")?.textContent === "Why does that matter?");
await page.waitForFunction((id) => !document.querySelector(`.lbl.node[data-id="${id}"]`)?.classList.contains("ghost"), g.ghost, { timeout: 5000 }).catch(() => {});   // the graph redraws just after the question shows
t.eq([await page.textContent("#oralHeard"), await page.evaluate((id) => !document.querySelector(`.lbl.node[data-id="${id}"]`)?.classList.contains("ghost"), g.ghost)], [`1 of ${await page.evaluate(() => bonsai.S.oral.g.ideas.length)} heard`, true], "Claude's tally lights up the greyed idea it heard");
await page.fill("#oralAnswer", "Because it explains the rest."); await page.press("#oralAnswer", "Enter");
await page.waitForSelector("#oralScore");
t.eq(await state(page, () => [__asked.filter((p) => p.startsWith("Interview me")).length, __asked.at(-1).startsWith("Mark my oral exam"), document.querySelector("#oralScore").textContent.startsWith("1 / ")]), [2, true, true], "when Claude has enough it stops, and marks once");
await page.screenshot({ path: "tests/shots/oral-marks.png" });
// overrule the second mark (missed → shown), then save
await page.click(".oralmarks .mark:not(.shown)");
const marks = await page.evaluate(() => bonsai.S.oral.marks.map((m) => [m.id, m.shown]));
await page.keyboard.press("Enter"); await page.waitForSelector("#toast");
t.eq((await page.textContent("#toast")).startsWith("Oral: 2 of "), true, "saving says how it went, with Undo");
const after = await state(page, (marks) => marks.map(([id, shown]) => { const n = bonsai.S.byId.get(id); return [!!n.ghost, n.oral?.shown === shown, shown ? Date.parse(n.srs.due) > Date.now() + 86400000 : Date.parse(n.srs?.due || 0) < Date.now() + 2 * 86400000]; }), marks);
t.eq(after.every(([ghost, kept, due]) => !ghost && kept && due), true, "shown ideas wake or are watered for later; missed ones come back soon; each keeps what the oral said");
await page.click("#toast .link");
await page.waitForFunction((id) => bonsai.S.byId.get(id)?.ghost === true, g.ghost);
t.eq(true, true, "Undo puts them back");
await ctx.close();
await t.end();
