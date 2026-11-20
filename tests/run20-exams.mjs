// Exams: the topic maps are sound, the exams page (a page inside Claude, here with a stand-in for Claude's
// side) sets and marks papers and exports what was shown, and the app adds that: shown ideas as real ones,
// the rest greyed, not counted and not reviewed until a re-sit shows them.
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { start, state } from "./lib.mjs";
import { readMap, checkMaps, progress, exportExam, readExam, planExam, ideaKey } from "../src/exams.js";
import { recallPrompt, readRecall, readMarks, oralPrompt, readOral, oralMarkPrompt, ORAL_MAX, connectPairs } from "../src/paper.js";

const t = await start("run20-exams", 4320);
const dir = "tools/exams/maps/", rows = readdirSync(dir).map((f) => readFileSync(dir + f, "utf8")).map((text) => ({ ...readMap(text), text }));

// ----- the maps and the pure logic -----
const physics = rows.filter((m) => m.topic === "Physics").sort((a, b) => a.order - b.order), lead = rows.filter((m) => m.topic === "Leadership");
t.eq([physics.map((m) => m.tier), lead.length], [["IGCSE", "AS Level", "A Level"], 3], "three tiers each for Physics and Leadership");
t.eq([checkMaps(physics), checkMaps(lead)], [[], []], "no idea is named twice and every link lands on an idea of its tier or an earlier one");
t.eq(checkMaps([readMap("map: x\ntopic: T\ntier: One\ngraph: G\nA | a\n  B | b\n  A | again\nlink: A -> Z")]).length, 2, "a repeated idea and a link to nowhere are caught");
const ig = physics[0], forces = ig.graphs.find((g) => g.name === "Forces");
t.eq(forces.ideas.filter((i) => i.title === "Using F = ma").map((i) => [i.kind, i.depth, forces.ideas.find((p) => p.key === i.parent).title]), [["apply", 2, "Resultant force"]], "an apply idea hangs off the idea it uses");
t.eq(readRecall([{ key: forces.ideas[0].key, q: "Q?", options: ["a", "b", "c", "d"] }, { key: "nope", q: "Q?", options: ["a", "b", "c", "d"] }, { key: forces.ideas[1].key, q: "Q?", options: ["a", "a", "c", "d"] }], forces).length, 1, "a question for an unknown idea or with a repeated option is dropped");
t.eq(recallPrompt(ig, forces).includes(forces.ideas[1].key + " | "), true, "the paper names each idea by its key");
const turn = (n) => Array.from({ length: n }, (_, k) => ({ q: "Q" + k, a: "a" + k }));
t.eq([oralPrompt(ig, forces, turn(3)).includes("This was question 3 of at most"), oralPrompt(ig, forces, turn(ORAL_MAX)).includes('"done": true, "next": "".')], [true, true], "the oral counts its questions and must stop at the last");
t.eq(oralPrompt(ig, forces, [{ q: "Q", a: "", photos: 1 }], { photos: 1 }).includes("handwritten in the 1 attached photo"), true, "a handwritten answer is sent to be read");
t.eq(oralMarkPrompt(ig, forces, [{ q: "Q", a: "", read: "F = ma" }]).includes('it read: "F = ma"'), true, "the marker sees what a handwritten answer said");
t.eq([readOral({ next: "Why?", shown: [forces.ideas[0].key, "zz"] }, forces), readOral({ next: "" }, forces).done], [{ read: "", shown: [forces.ideas[0].key], next: "Why?", done: false }, true], "the interviewer's tally keeps only real keys, and no next question means done");
t.eq(readMarks({ marks: [{ key: "a", shown: "yes" }, { key: "zz", shown: true }, { key: "b", shown: true, why: "ok" }] }, ["a", "b", "c"]).marks.map((m) => m.shown), [false, true, false], "only a plain true counts as shown, and only for what was asked");
const some = { ideas: { [ideaKey("Acceleration")]: 1, [ideaKey("Force and acceleration")]: 2 }, links: {} };
t.eq(connectPairs(ig, (k) => !!some.ideas[k], some).map((p) => p.a), ["Acceleration"], "a connection opens once both its ideas are shown");
const exam0 = readExam(JSON.stringify(exportExam([ig], { [ig.id]: some })));
const plan0 = planExam(exam0);
t.eq([plan0.counts.shown, plan0.counts.greyed, plan0.counts.graphs, progress(ig).of], [2, 279, 12, 281], "an export carries every idea of the tier, shown or not");
t.eq((() => { try { readExam("{}"); } catch (e) { return e.message; } })(), "That isn't a Bonsai exam.", "anything else is refused");

// ----- the exams page -----
execFileSync("node", ["tools/exams/build.mjs", "tests/.out/run20-exams/exams.html"], { stdio: "ignore" });
const stub = ({ maps, marks }) => {
  const store = new Map([...maps.map((r) => ["maps/" + r.id, r]), ...Object.entries(marks).map(([id, m]) => ["marks/" + id, m])]), subs = [];
  const snap = (prefix) => ({ docs: [...store].filter(([k]) => k.startsWith(prefix + "/")).map(([k, v]) => ({ id: k.slice(prefix.length + 1), exists: true, data: () => v })) });
  const db = {
    doc: (path) => ({ set: async (d) => { store.set(path, JSON.parse(JSON.stringify(d))); for (const s of subs) if (path.startsWith(s.prefix + "/")) s.cb(snap(s.prefix)); } }),
    collection: (prefix) => ({ get: async () => snap(prefix), onSnapshot: (cb) => { subs.push({ prefix, cb }); setTimeout(() => cb(snap(prefix)), 0); return () => {}; }, add: async (d) => { store.set(prefix + "/s" + store.size, JSON.parse(JSON.stringify(d))); } }),
  };
  const asked = [], sheet = (p) => [...p.matchAll(/^(k[a-z0-9]+) \|\s+(.+?) \| /gm)].map((m) => ({ key: m[1], title: m[2] }));
  const mine = (p) => (p.split('My answer:\n"""\n').slice(1).map((x) => x.split('\n"""')[0]).join(" ") || "").toLowerCase();
  const json = async (prompt, opts = {}) => {
    asked.push({ prompt, images: opts.images?.length || 0 }); await new Promise((r) => setTimeout(r, 30));
    if (prompt.startsWith("Set a quick")) return sheet(prompt).map((i) => ({ key: i.key, q: `What is ${i.title}?`, options: ["right: " + i.title, "wrong one", "wrong two", "wrong three"] }));
    if (prompt.startsWith("Interview me")) { const said = mine(prompt), n = (prompt.match(/^Question \d+:/gm) || []).length; return { read: opts.images?.length ? "Written answer" : "", shown: sheet(prompt).filter((i) => said.includes(i.title.toLowerCase())).map((i) => i.key), next: n < 3 ? (n === 1 ? "Why does averaging help?" : "How would you time one swing?") : "", done: n >= 3 }; }
    if (prompt.startsWith("Mark my oral exam")) { const said = mine(prompt), marks = sheet(prompt).map((i) => ({ key: i.key, shown: said.includes(i.title.toLowerCase()), why: "you said it" })); return { marks, feedback: "Clear on measuring." }; }
    if (prompt.startsWith("Set problems")) return sheet(prompt).map((i) => ({ key: i.key, q: `Work out ${i.title}.`, guide: "The answer is 42." }));
    if (prompt.startsWith("Mark my answers")) return { marks: [...prompt.matchAll(/key (k[a-z0-9]+) \(/g)].map((m) => ({ key: m[1], shown: mine(prompt).includes("42"), why: "method right" })), feedback: "" };
    if (prompt.startsWith("Mark how well")) return { marks: [...prompt.matchAll(/key (k[a-z0-9]+_k[a-z0-9]+):[^\n]*\n[^\n]*\n\s*I said: ([^\n]*)/g)].map((m) => ({ key: m[1], shown: m[2].includes("because"), why: "a real link" })), feedback: "" };
    throw { code: "upstream_error" };
  };
  const sample = Object.assign(async () => ({ text: "" }), { json, limits: async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 2e7, mediaTypes: ["image/png"] } }) });
  const on = { final: [], partial: [], state: [] }; let live = false;
  const dictation = { active: () => live, onFinal: (h) => on.final.push(h), onPartial: (h) => on.partial.push(h), onState: (h) => on.state.push(h),
    start: async () => { live = true; on.state.forEach((h) => h({ state: "listening" })); on.final.forEach((h) => h({ text: " Measuring multiples and volume by displacement." })); },
    stop: async () => { live = false; on.state.forEach((h) => h({ state: "idle", reason: "stopped" })); } };
  const saved = [], downloads = { save: async (f) => { saved.push(f); return { status: "saved" }; } };
  const spoken = [];
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak: (u) => spoken.push(u.text), cancel: () => {}, getVoices: () => [] } });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.claude = { use: async (name) => ({ db, sample, dictation, downloads })[name] ?? null };
  window.__t = { store, asked, saved, spoken };
};
const seeded = { [lead.find((m) => m.order === 1).id]: { ideas: { [ideaKey("Asking for feedback")]: 1, [ideaKey("Receiving feedback")]: 1 }, links: {} } };
const ctx = await t.browser.newContext({ viewport: { width: 1100, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] }), page = await ctx.newPage();
page.on("pageerror", (e) => t.fail("exams page error: " + e.message));
await page.addInitScript(stub, { maps: [], marks: seeded });   // the maps are built into the page
await page.goto(t.url + "exams.html#physics");
await page.waitForSelector(".tier");
t.eq(await page.$$eval(".tier", (x) => x.map((s) => [s.querySelector("h2").textContent, s.querySelectorAll(".row").length, s.querySelector(".n").textContent])), [["IGCSE", 12, "0 / 281"], ["AS Level", 11, "0 / 121"], ["A Level", 12, "0 / 144"]], "a topic opens on its tiers, a row per graph");
t.eq(await page.$$eval(".row.on .cell", (c) => c.map((x) => x.textContent)), ["0/5", "0/7", "0/2"], "each row shows how far its three papers have got");
t.eq(await page.isDisabled("#connect-physics-igcse"), true, "Connect waits until both ideas of a pair are shown");
await page.screenshot({ path: "tests/shots/exams-home.png" });

// Recall: a quick multiple-choice sweep, by keyboard
await page.keyboard.press("1"); await page.waitForSelector(".opt");
t.eq(await page.textContent(".top h1"), "Measurement", "the paper is named for its graph");
await page.screenshot({ path: "tests/shots/exams-recall.png" });
for (let i = 0; i < 4; i++) { const n = await page.$$eval(".opt span", (o) => o.findIndex((x) => x.textContent.startsWith("right"))); await page.keyboard.press(String(n + 1)); await page.waitForFunction((k) => document.querySelector(".muted")?.textContent.startsWith(k + " /") || document.querySelector("#marks"), i + 2); }
await page.keyboard.press("0"); await page.waitForSelector("#marks");
t.eq(await page.textContent("#score"), "4 / 5", "four right and one not known");
await page.keyboard.press("Enter"); await page.waitForSelector(".tier");
t.eq(await page.$$eval(".row.on .cell", (c) => c.map((x) => x.textContent)), ["4/5", "0/7", "0/2"], "saving records what was shown");

// Explain: an adaptive oral. Questions are shown and read aloud, Enter sends, Claude decides when it's done; marks only at the end
await page.keyboard.press("2"); await page.waitForSelector("#answer");
t.eq([await page.textContent("#ask"), await page.textContent("#qn"), await page.evaluate(() => __t.spoken.at(-1))], ["Tell me about Measurement. What is it about, and how do its main ideas fit together?", "Question 1", "Tell me about Measurement. What is it about, and how do its main ideas fit together?"], "the oral opens broad, and the question is read aloud");
await page.keyboard.press("s"); await page.waitForFunction(() => document.querySelector("#answer").value.includes("Measuring multiples"));
t.eq(await page.textContent("#speak"), "StopS", "speaking fills the answer and the button offers Stop");
await page.focus("#answer"); await page.keyboard.type(" Averaging readings cuts random error."); await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelector("#ask")?.textContent === "Why does averaging help?");
t.eq([await page.$$eval(".turn", (x) => x.length), await page.textContent("#qn"), await page.evaluate(() => __t.spoken.at(-1)), await page.$$("#marks").then((x) => x.length)], [1, "Question 2", "Why does averaging help?", 0], "Enter sends; the next question comes back, spoken, with no marks yet");
await page.fill("#answer", "Random errors cancel out."); await page.keyboard.press("Escape"); await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelector("#ask")?.textContent === "How would you time one swing?");
t.eq(await page.evaluate(() => __t.asked.at(-1).prompt.includes("Last time you had: ")), true, "the interviewer is reminded of its tally");
await page.screenshot({ path: "tests/shots/exams-oral.png" });
await page.fill("#answer", "Time twenty swings and divide."); await page.keyboard.press("Enter");
await page.waitForSelector("#marks");
t.eq([await page.textContent("#score"), await page.$$eval(".mark.shown .t", (x) => x.map((e) => e.firstChild.textContent)), await page.evaluate(() => __t.asked.at(-1).prompt.startsWith("Mark my oral exam"))], ["3 / 7", ["Measuring multiples", "Volume by displacement", "Averaging readings"], true], "when Claude has enough it stops, and the whole interview is marked once");
await page.keyboard.press("1");
t.eq([await page.textContent("#score"), await page.$$eval(".mark.changed", (x) => x.length)], ["4 / 7", 1], "he can overrule a mark before saving");
await page.screenshot({ path: "tests/shots/exams-results.png" });
await page.keyboard.press("Enter"); await page.waitForSelector(".tier");
t.eq(await page.$$eval(".row.on .cell", (c) => c.map((x) => x.textContent)), ["5/5", "4/7", "0/2"], "an idea explained also counts as recalled");

// Apply: problems, answered on paper and photographed
await page.keyboard.press("3"); await page.waitForSelector("#probs li");
t.eq(await page.$$eval("#probs li", (l) => l.length), 2, "a problem for each apply idea");
await page.setInputFiles("#photo", { name: "working.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
await page.waitForSelector(".shots img"); await page.fill("#answer", "The period is 42 s."); await page.click("#mark"); await page.waitForSelector("#marks");
t.eq([await page.textContent("#score"), await page.evaluate(() => __t.asked.at(-1).images)], ["2 / 2", 1], "the photo of his working goes to the marker");
await page.keyboard.press("Enter"); await page.waitForSelector(".tier");
t.eq(await page.textContent(".tier .n"), "9 / 281", "the tier's total follows");

// Connect, on the other topic, where two linked ideas are already shown
await page.keyboard.press("t"); await page.waitForFunction(() => document.querySelector(".tier h2")?.textContent === "Leading yourself");
await page.click("#connect-leadership-self"); await page.waitForSelector("#answer");
t.eq(await page.textContent("#ask"), "How are Asking for feedback and Receiving feedback connected?", "Connect asks how two shown ideas relate");
await page.fill("#answer", "You have to be able to hear it because asking invites it."); await page.click("#mark"); await page.waitForSelector("#marks");
await page.keyboard.press("Enter"); await page.waitForSelector(".tier");
t.eq((await page.textContent("#connect-leadership-self")).trim().startsWith("Connect 1/6"), true, "a connection shown is kept");
t.eq(await page.evaluate(() => [...__t.store.keys()].filter((k) => k.startsWith("sittings/")).length), 4, "each sitting is kept for looking back over the marking");
t.eq(await page.evaluate(() => [...__t.store].filter(([k]) => k.startsWith("sittings/")).flatMap(([, v]) => v.marks).filter((m) => m.changed).length), 1, "with the mark he overruled noted");

// Export for the app
await page.keyboard.press("t"); await page.waitForFunction(() => document.querySelector(".tier h2")?.textContent === "IGCSE");
await page.keyboard.press("e"); await page.waitForSelector("#copy");
t.eq(await page.$$eval(".plain li", (l) => l.map((x) => x.textContent)), ["IGCSE9 shown · 272 greyed · 0 links"], "the export covers the tiers he has sat");
await page.click("#copy"); await page.waitForFunction(() => document.querySelector("#said").textContent === "Copied");
const exported = await page.evaluate(() => navigator.clipboard.readText());
await page.click("#file");
t.eq(await page.evaluate(() => __t.saved.map((f) => f.filename)), ["bonsai-exam-physics.json"], "or saves it as a file");
await page.keyboard.press("w"); await page.waitForFunction(() => document.querySelectorAll(".plain li").length === 3);
await ctx.close();
for (const [name, opts] of [["exams-dark", { viewport: { width: 1100, height: 800 }, colorScheme: "dark" }], ["exams-phone", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true }]]) {
  const c = await t.browser.newContext(opts), p = await c.newPage(); p.on("pageerror", (e) => t.fail("exams page error: " + e.message));
  await p.addInitScript(stub, { maps: [{ id: "physics-uni", text: "map: physics-uni\ntopic: Physics\ntier: First year\norder: 4\ngraph: Vectors\nVector calculus | Fields and their derivatives" }], marks: { "physics-igcse": JSON.parse(exported).tiers[0].graphs.flatMap((g) => g.ideas).reduce((a, i) => (i.l ? { ideas: { ...a.ideas, [ideaKey(i.t)]: i.l } } : a), { ideas: {} }) } });
  await p.goto(t.url + "exams.html#physics"); await p.waitForSelector(".tier");
  t.eq(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ": nothing runs off the side");
  t.eq(await p.$$eval(".tier h2", (h) => h.map((x) => x.textContent)), ["IGCSE", "AS Level", "A Level", "First year"], name + ": a map added as a row shows beside the built-in ones");
  await p.screenshot({ path: `tests/shots/${name}.png` }); await c.close();
}

// ----- the app takes the export -----
const app = await t.page();
await app.waitForFunction(() => window.bonsai?.S?.zones); await app.waitForTimeout(400);
const importExam = async (text) => {
  await app.evaluate(() => { document.querySelector("#toast").hidden = true; });
  await app.click("#moreBtn"); await app.click(".menu >> text=Import exam"); await app.fill(".dialog textarea", text); await app.click(".dialog .btn.primary");
  await app.waitForSelector("#examSum"); const sum = await app.textContent("#examSum"), pick = await app.$eval("#f-zone", (s) => s.selectedOptions[0].textContent);
  await app.click(".dialog .btn.primary"); await app.waitForSelector("#toast:not([hidden])"); return [sum, pick];
};
t.eq(await importExam(exported), ["IGCSE · 9 shown · 272 greyed", "New: Physics"], "Import exam says what it holds and offers a new topic of that name");
const got = await state(app, () => { const S = bonsai.S, z = S.zones.find((x) => x.name === "Physics"), trees = S.trees.filter((x) => x.zoneId === z.id), ns = trees.flatMap((x) => S.byTree.get(x.id));
  const real = ns.filter((n) => !n.ghost), soon = Math.min(...real.map((n) => Date.parse(n.srs.due) - Date.now())) / 86400000;
  return { trees: trees.length, tier: trees[0].exam.tier, real: real.map((n) => n.title).sort(), ghosts: ns.filter((n) => n.ghost).length, notes: ns.every((n) => n.note), level: real.find((n) => n.title === "Measuring multiples").exam.level, soon: soon > 3.9, toast: document.querySelector("#toast span").textContent }; });
t.eq(got, { trees: 12, tier: "IGCSE", real: ["Averaging readings", "Length and volume", "Measurement", "Measuring multiples", "Scalars and vectors", "Time intervals", "Timing many swings", "Adding two vectors at right angles", "Volume by displacement"].sort(), ghosts: 272, notes: true, level: 2, soon: true, toast: "9 ideas shown, 272 greyed" },
  "shown ideas arrive as real ideas with their notes and a first review days away; the rest arrive greyed");
await app.evaluate(() => { location.hash = "#/"; }); await app.waitForSelector("body[data-ready]"); await app.waitForFunction(() => bonsai.S.model?.some((i) => i.topics.some((q) => q.name === "Physics")));
t.eq(await state(app, () => { const q = bonsai.S.model.flatMap((i) => i.topics).find((x) => x.name === "Physics"); return [q.ideas, q.due.length, q.growth < 0.25]; }), [9, 0, true], "greyed ideas don't count toward growth and are never due");
await app.evaluate(() => bonsai.isles.setActive(false));
const ids = await state(app, () => { const S = bonsai.S, by = (n) => S.trees.find((x) => x.name === n).id; return { measurement: by("Measurement"), motion: by("Motion") }; });
await app.evaluate((i) => { location.hash = "#/tree/" + i; }, ids.motion); await app.waitForSelector(".lbl.trunk");
t.eq(await app.$$eval(".lbl.node", (l) => [l.length, l.filter((x) => x.classList.contains("ghost")).length]), [12, 12], "a graph not sat yet is all greyed");
await app.keyboard.press("Space"); await app.waitForSelector("#examTag");
t.eq(await app.textContent("#examTag"), "Not shown yet", "a greyed idea says so in its panel");
await app.screenshot({ path: "tests/shots/exams-greyed.png" });
await app.evaluate((i) => { location.hash = "#/tree/" + i; }, ids.measurement); await app.waitForFunction(() => document.querySelectorAll(".lbl.node").length === 9);
t.eq(await app.$$eval(".lbl.node.ghost", (l) => l.length), 0, "a graph shown in full has none");

// a re-sit shows two more ideas and a link between ideas already there; undo takes it back
const resit = JSON.parse(exported); const motion = resit.tiers[0].graphs.find((g) => g.name === "Motion").ideas;
motion.find((i) => i.t === "Motion").l = 1; motion.find((i) => i.t === "Speed").l = 2; resit.tiers[0].links.push({ a: "Speed", b: "Measuring multiples", label: "measured with", l: 4 });
await app.evaluate(() => { location.hash = "#/forest"; }); await app.waitForSelector(".lbl.zone");
t.eq(await importExam(JSON.stringify(resit)), ["IGCSE · 11 shown · 270 greyed", "Physics"], "a re-sit goes into the same topic");
const after = () => state(app, () => { const S = bonsai.S; return [S.nodes.length, S.nodes.filter((n) => n.ghost).length, S.nodes.find((n) => n.title === "Speed").exam.level, S.links.length]; });
t.eq([await after(), await app.textContent("#toast span")], [[281, 270, 2, 1], "2 ideas shown, 1 link"], "it wakes the greyed ideas it showed, makes nothing twice, and adds the link");
await app.click("#toast .link"); await app.waitForFunction(() => bonsai.S.nodes.filter((n) => n.ghost).length === 272);
t.eq(await after(), [281, 272, 0, 0], "undo greys them again");
await t.end();
