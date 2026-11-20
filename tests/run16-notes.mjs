// Notes, the third window: folders and pages on their own (no topics, no graphs), properties and tags, search,
// a Notion-style block editor, growing a page into a topic with Claude's reply, and the drawer beside a graph.
import { readFileSync } from "node:fs";
import { start, state } from "./lib.mjs";
import { readGrow, planGrow, growPrompt } from "../src/notes.js";

const t = await start("run16-notes", 4316, { channel: "beta" });
const reply = readFileSync("tests/fixtures/grow-mechanics.txt", "utf8");

// The reply reader on its own.
{
  const r = readGrow("bonsai grow\ngraph: G\nA | a\n    B | b\n        > more\n    = A\nlink: B -> A");
  t.eq(r.graphs[0].items.map((i) => [i.depth, i.title, i.ref]), [[0, "A", false], [1, "B", false], [1, "A", true]], "reads indents of four spaces");
  t.eq(r.graphs[0].items[1].body, "more", "keeps > lines as notes");
  const p = planGrow(r, {});
  t.eq([p.trees.length, p.nodes.length, p.links.length], [1, 1, 0], "a new graph starts on its first idea, A isn't made twice, and a link along a string is dropped");
  t.eq(growPrompt({ topic: "X", page: { title: "P", text: "hello" } }).includes("hello"), true, "the prompt carries the page");
}

const page = await t.page({ permissions: ["clipboard-read", "clipboard-write"] }, "#/");
await page.waitForFunction(() => bonsai.S.pages.length >= 6);
const ids = await state(page, () => { const z = (n) => bonsai.S.zones.find((x) => x.name === n).id, g = (n) => bonsai.S.trees.find((x) => x.name === n).id; return { mech: z("Mechanics"), em: g("Energy and momentum") }; });
const pg = (title) => state(page, async (x) => (await bonsai.store.listPages()).find((p) => p.title === x), title);
const view = () => state(page, () => bonsai.S.view);
const blocks = (title) => state(page, async (x) => (await bonsai.store.listPages()).find((p) => p.title === x)?.blocks.map((b) => [b.type, b.indent, b.html]), title);
const k = (key) => page.keyboard.press(key), type = (s) => page.keyboard.type(s);

// Plain text in and out of blocks.
const round = await page.evaluate(async () => {
  const m = await import("./blocks.js");
  const bl = m.textToBlocks("# Head\n- one\n  - two **bold**\n1. first\n- [x] done\n> said\n---\n```\nx = 1\n```");
  return { types: bl.map((b) => [b.type, b.indent]), bold: bl[2].html, text: m.blocksToText(bl), clean: m.cleanHtml('<b>ok</b><script>x</script><a href="javascript:1">no</a><a href="https://a.b">yes</a><span style="font-weight:700">w</span>') };
});
t.eq(round.types, [["h1", 0], ["bullet", 0], ["bullet", 1], ["number", 0], ["todo", 0], ["quote", 0], ["divider", 0], ["code", 0]], "Markdown outlines become blocks");
t.eq(round.bold, "two <b>bold</b>", "inline Markdown");
t.eq(round.text.split("\n").slice(0, 3), ["# Head", "- one", "  - two **bold**"], "blocks become an outline again");
t.eq(round.clean, '<b>ok</b>xno<a href="https://a.b" target="_blank" rel="noopener">yes</a><b>w</b>', "pasted HTML is cleaned");

// Garden → Knowledge → Notes → Garden with Shift+Tab, and a switch in the top bar.
await k("Shift+Tab"); await page.waitForFunction(() => bonsai.S.view === "forest");
await k("Shift+Tab"); await page.waitForSelector("#notes:not([hidden]) #nlist");
t.eq([await view(), await page.getAttribute("#winNotes", "aria-pressed")], ["notes", "true"], "Shift+Tab goes on to notes");
await k("Shift+Tab"); await page.waitForFunction(() => bonsai.S.view === "isles");
await page.click("#winNotes"); await page.waitForSelector("#notes:not([hidden]) #nlist");

// The sidebar: folders first, no topic anywhere.
t.eq(await page.$$eval("#nlist .nrow .nt", (r) => r.map((x) => x.textContent)), ["Physics", "Leadership", "Reading list"], "folders, then pages, at the top level");
t.eq(await page.isVisible("#notesTopic"), false, "no topic picker");
await page.click('#nlist .nrow:has-text("Physics") .chev');
await page.click('#nlist .nrow:has-text("Lecture 6") .nname');
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Lecture 6: Momentum");
t.eq((await page.textContent("#pbar .pcrumb")).replace(/\s+/g, " ").trim(), "Physics/Lecture 6: Momentum", "the bar over the page shows where it sits");
t.eq(await page.$$eval("#props .prow .pname > span:last-child", (r) => r.map((x) => x.textContent)), ["Tags", "Date", "Status", "Source", "Created"], "every page has the same properties");
t.eq(await page.$$eval("#props .tagc", (r) => r.map((x) => x.textContent)), ["lecture", "momentum", "physics 120"], "its tags");
t.eq(await page.locator("#nedit .blk.t-bullet").count() > 10, true, "the lecture's bullets are blocks");
t.eq(await page.isVisible(".gchip, #attachBtn"), false, "nothing ties it to a graph");
await page.screenshot({ path: "tests/shots/notes-laptop.png" });

// Search by name and by tag.
await k("Escape"); await page.click("#notesSearch");
t.eq(await state(page, () => document.activeElement?.id), "notesSearch", "the sidebar's search");
await type("#coaching");
t.eq(await page.$$eval("#nlist .nrow .nt", (r) => r.map((x) => x.textContent)), ["Workshop: GROW model"], "found by tag");
await page.fill("#notesSearch", "sheet");
t.eq(await page.$$eval("#nlist .nrow .nt", (r) => r.map((x) => x.textContent)), ["Problem sheet 6"], "found by name, with where it sits");
await page.screenshot({ path: "tests/shots/notes-search.png" });
await k("Enter");
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Problem sheet 6");
await page.fill("#notesSearch", ""); await page.dispatchEvent("#notesSearch", "input");

// Properties: add a tag with the picker, add a property, change a checkbox.
await page.click('#nlist .nrow:has-text("Reading list") .nname');
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Reading list");
await page.click("#props .prow .pv.chips"); await page.waitForSelector(".tagpop input");
await type("books"); await k("Enter"); await k("Escape");
// Every page has Tags, Date, Status, Source and Created, empty until filled; + adds a text property.
t.eq(await page.$$eval("#props .prow", (r) => r.map((x) => x.dataset.type)), ["tags", "date", "status", "url", "created"], "the same properties on every page");
t.eq(await page.$$eval("#props .prow .pv .empty", (r) => r.length), 1, "Date shows Empty until set");
await page.click('#props .prow[data-type="url"] input'); await type("example.org/slides");
await page.click('#props .prow[data-type="date"] .pv'); await page.waitForSelector(".datepop"); await page.click("#dpToday");
await page.click('#props .prow[data-type="status"] .pv');
t.eq(await page.$$eval(".menu .mi", (r) => r.map((x) => x.textContent.replace("✓ ", ""))), ["Raw", "Tidied", "Grown"], "a note's statuses");
await page.click('.menu .mi:has-text("Tidied")');
await page.click("#propAdd"); await type("Chapter 3");
await page.click('#props .prow[data-type="status"] .pname'); t.eq(await page.$$eval(".menu .mi", (r) => r.map((x) => x.textContent)), ["Rename"], "the standard ones can be renamed, not removed"); await k("Escape");
await page.waitForTimeout(900);
const today = await state(page, () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
t.eq((await pg("Reading list")).props.map((x) => [x.name, x.value]), [["Tags", ["reading", "books"]], ["Date", today], ["Status", "Tidied"], ["Source", "example.org/slides"], ["Created", ""], ["Text", "Chapter 3"]], "properties are saved");
t.eq((await page.textContent('#props .prow[data-type="created"] .pv')).length > 6, true, "Created shows the date it was made");
await page.fill("#notesSearch", "#books"); await page.dispatchEvent("#notesSearch", "input");
t.eq(await page.$$eval("#nlist .nrow .nt", (r) => r.map((x) => x.textContent)), ["Reading list"], "a new tag is searchable");
await page.fill("#notesSearch", ""); await page.dispatchEvent("#notesSearch", "input");
await page.screenshot({ path: "tests/shots/notes-props.png" });
await page.click('.nfilter .nf[data-status="Tidied"]');
t.eq(await page.$$eval("#nlist .nrow .nt", (r) => r.map((x) => x.textContent)), ["Reading list", "Lecture 6: Momentum"], "the Tidied filter, newest date first");
await page.click('.nfilter .nf[data-status="Raw"]');
t.eq(await page.$$eval("#nlist .nrow .nt", (r) => r.map((x) => x.textContent)), ["Problem sheet 6", "Workshop: GROW model"], "the Raw filter");
await page.click('.nfilter .nf[data-status=""]');

// Backspacing a page to nothing leaves an ordinary empty line; @ makes a date tag.
await page.click("#nedit .blk .tx >> nth=-1"); await k("End");
for (let i = 0; i < 150; i++) await k("Backspace");
t.eq(await state(page, () => [...document.querySelectorAll("#nedit .blk")].map((b) => getComputedStyle(b).position)), ["relative"], "an emptied page keeps one ordinary line");
await type("Read by @tom"); await page.waitForSelector(".slash .si.on"); await k("Enter"); await type("then review");
await page.waitForTimeout(800);
const tomorrow = await state(page, () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
t.eq((await pg("Reading list")).blocks[0].html.includes(`<time datetime="${tomorrow}" contenteditable="false">Tomorrow</time>`), true, "@tomorrow makes a date tag");
await page.click("#nedit .tx time"); await page.waitForSelector(".datepop"); await k("ArrowRight"); await k("Enter");
await page.waitForTimeout(800);
t.eq((await pg("Reading list")).blocks[0].html.includes("<time datetime"), true, "clicking the tag picks another day");
await page.screenshot({ path: "tests/shots/notes-date.png" });

// A folder, then a page in it, written by keyboard: Markdown shortcuts, Enter, Tab, the / menu, bold, moving blocks.
await page.click("#nedit"); await k("Escape"); await page.evaluate(() => document.activeElement?.blur());
await k("f");
await page.waitForFunction(() => document.activeElement?.id === "pageTitle");
await type("Maths"); await k("Escape");
await k("n");
await page.waitForFunction(() => document.activeElement?.id === "pageTitle");
await type("Vectors"); await k("Enter");
t.eq((await state(page, () => { const p = bonsai.S.pages.find((x) => x.id === bonsai.S.npage); return bonsai.S.pages.find((x) => x.id === p.parentId)?.title; })), "Maths", "a new page goes in the open folder");
await type("# Work and energy"); await k("Enter");
await type("- W = Fd"); await k("Enter"); await k("Tab"); await type("F along the motion"); await k("Enter"); await k("Enter"); await k("Enter");
await type("/to");
await page.waitForSelector(".slash .si.on");
t.eq(await page.textContent(".slash .si.on"), "☐To-do list", "the / menu filters as you type");
await page.screenshot({ path: "tests/shots/notes-slash.png" });
await k("Enter"); await type("Revise");
await k("Shift+Home"); await page.waitForSelector(".fmtbar:not([hidden])"); await k("Control+b"); await k("End");
await page.waitForTimeout(800);
t.eq((await pg("Vectors")).blocks.map((b) => [b.type, b.indent, b.html]), [["h1", 0, "Work and energy"], ["bullet", 0, "W = Fd"], ["bullet", 1, "F along the motion"], ["todo", 0, "<b>Revise</b>"]], "the blocks as written");
await k("Control+Shift+ArrowUp"); await page.waitForTimeout(700);
t.eq((await pg("Vectors")).blocks.map((b) => b.html), ["Work and energy", "<b>Revise</b>", "W = Fd", "F along the motion"], "Ctrl+Shift+↑ moves a block over the whole block above");
const h = page.locator("#nedit .blk.t-bullet").first();
await h.hover(); const hb = await h.locator(".hdl").boundingBox(), top = await page.locator("#nedit .blk.t-h1").boundingBox();
await page.mouse.move(hb.x + 5, hb.y + 5); await page.mouse.down(); await page.mouse.move(hb.x + 5, top.y + 10, { steps: 6 }); await page.mouse.move(hb.x + 5, top.y + 3, { steps: 2 }); await page.mouse.up();
await page.waitForTimeout(700);
t.eq((await pg("Vectors")).blocks.map((b) => b.html), ["W = Fd", "F along the motion", "Work and energy", "<b>Revise</b>"], "dragging moves a block with what's inside it");

// Moving pages: drag one onto a folder in the sidebar, and back to the top level from its menu.
await page.dragAndDrop('#nlist .nrow:has-text("Reading list")', '#nlist .nrow:has-text("Maths")');
await page.waitForFunction(() => bonsai.S.pages.find((p) => p.title === "Reading list")?.parentId === bonsai.S.pages.find((p) => p.title === "Maths").id);
await page.click('#nlist .nrow:has-text("Reading list") .nname'); await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Reading list");
await page.click("#pageMore"); await page.click('.mi:has-text("Move to")'); await page.click('.mi:has-text("Top level")');
await page.waitForFunction(() => !bonsai.S.pages.find((p) => p.title === "Reading list")?.parentId);

// Grow the lecture into a topic with Claude's reply: pick the topic, copy, paste, see what it adds, grow, undo, grow again.
await page.click('#nlist .nrow:has-text("Lecture 6") .nname');
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Lecture 6: Momentum");
const before = await state(page, () => [bonsai.S.nodes.length, bonsai.S.links.length]);
await page.click("#pageMore"); await page.click('.mi:has-text("Grow into a knowledge graph")'); await page.waitForSelector("#growReply");
await page.selectOption("#growTopic", ids.mech);
await page.click("#growCopy");
const copied = await page.evaluate(() => navigator.clipboard.readText());
t.eq(copied.includes("bonsai grow") && copied.includes("- Momentum p = mv") && copied.includes("graph: Energy and momentum"), true, "the prompt has the format, the page as an outline and the topic's graphs");
await page.fill("#growReply", reply);
t.eq(await page.textContent("#growSum"), "Energy and momentum +5 · Newton's laws +2 · 2 links", "what the reply adds");
await page.screenshot({ path: "tests/shots/notes-grow.png" });
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction((n) => bonsai.S.nodes.length === n + 7, before[0]);
const grown = await state(page, () => { const by = (x) => bonsai.S.nodes.find((n) => n.title === x), S = bonsai.S;
  return { inelastic: S.byId.get(by("Perfectly inelastic collision").parentId).title, body: by("Conservation of momentum").body.includes("recoil"), links: S.links.length, page: Object.keys(S.pages.find((p) => p.title.startsWith("Lecture 6"))).filter((k) => /tree|zone/i.test(k)) }; });
t.eq(grown, { inelastic: "Inelastic collision", body: true, links: before[1] + 2, page: [] }, "ideas strung onto the right ones; the page stays untied");
await page.waitForFunction(() => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).props.find((x) => x.type === "status")?.value === "Grown");
t.eq(await page.textContent('#props .prow[data-type="status"] .stat'), "Grown", "growing a page marks it Grown");
await page.click("#toast .link");
await page.waitForFunction((n) => bonsai.S.nodes.length === n, before[0]);
await page.waitForFunction(() => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).props.find((x) => x.type === "status")?.value === "Tidied");
await k("g"); await page.waitForSelector("#growReply");
t.eq(await page.inputValue("#growTopic"), ids.mech, "it remembers the topic");
await page.fill("#growReply", reply); await k("Control+Enter");
await page.waitForFunction((n) => bonsai.S.nodes.length === n + 7, before[0]);
await k("g"); await page.fill("#growReply", reply);
t.eq(await page.textContent("#growSum"), "Nothing new", "the same reply again adds nothing");
await k("Escape");

// Beside a graph, O shows the page last open; typing there is saved; Esc closes it.
await page.evaluate((id) => { location.hash = "#/tree/" + id; }, ids.em);
await page.waitForSelector(".lbl.trunk"); await k("o");
await page.waitForSelector("#nside #nlist .nrow");
t.eq(await state(page, () => [document.body.dataset.nside, !!document.querySelector("#sideTitle"), !!document.querySelector("#nside #notesSearch")]), ["list", false, true], "O opens the notes sidebar, no page open yet");
await page.click('#nside .nrow:has-text("Lecture 6") .nname');
await page.waitForFunction(() => document.querySelector("#sideTitle")?.value === "Lecture 6: Momentum");
t.eq(await state(page, () => document.body.dataset.nside), "page", "a picked page opens beside the sidebar");
await page.click("#nside .blk.t-bullet >> nth=-1"); await k("End"); await k("Enter"); await type("Momentum in 2D");
await page.waitForTimeout(800);
await page.screenshot({ path: "tests/shots/notes-beside.png" });
await k("Escape"); await k("Escape");
t.eq(await state(page, () => [bonsai.S.view, document.querySelector("#nside").hidden]), ["tree", true], "Esc closes the drawer, not the graph");
t.eq((await pg("Lecture 6: Momentum")).blocks.some((b) => b.type === "bullet" && b.html === "Momentum in 2D"), true, "typing beside the graph is saved");

// With a page open beside the graph, the idea panel covers the rest and shows the graph as a web to pick from; [ and ] close each side.
await k("o"); await page.waitForSelector("#nside #nlist .nrow");
await page.click('#nside .nrow:has-text("Lecture 6") .nname'); await page.waitForFunction(() => document.body.dataset.nside === "page");
await page.evaluate(() => document.activeElement?.blur());
await k(" "); await page.waitForSelector("#panel .wideweb canvas");
t.eq(await state(page, () => [document.body.dataset.wide, getComputedStyle(document.querySelector("#stage")).visibility, Math.round(document.querySelector("#panel").getBoundingClientRect().left) === Math.round(document.querySelector("#nside").getBoundingClientRect().right)]), ["1", "hidden", true], "the panel covers the graph, from the notes to the edge");
const pick = await state(page, () => { const n = bonsai.S.nodes.find((x) => x.title === "Collisions"); return { id: n.id, at: bonsai.S.mw.screenOf(n.id) }; });
await page.mouse.click(pick.at.x, pick.at.y);
await page.waitForFunction((id) => bonsai.S.sel === id, pick.id);
t.eq(await page.inputValue("#nodeTitle"), "Collisions", "clicking an idea in the web opens it");
await page.screenshot({ path: "tests/shots/wide-panel.png" });
t.eq(await page.isVisible("#panelClose kbd") && await page.isVisible("#sideClose kbd"), true, "the close buttons show their keys");
await k("]"); await page.waitForFunction(() => !bonsai.S.panel && document.body.dataset.wide === "");
await k("["); await page.waitForFunction(() => document.querySelector("#nside").hidden);

// Deleting a folder takes what's in it, and undo brings it all back.
await page.click("#winNotes"); await page.waitForSelector("#nlist");
await page.click('#nlist .nrow:has-text("Physics") .nname'); await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Physics");
t.eq(await page.locator("#nedit .frow").count(), 3, "a folder lists what's in it");
await page.evaluate(() => document.activeElement?.blur()); await k("Delete");
await page.waitForFunction(() => !bonsai.S.pages.some((p) => p.title === "Problem sheet 6"));
await page.click("#toast .link");
await page.waitForFunction(() => bonsai.S.pages.some((p) => p.title === "Problem sheet 6"));
const b = await state(page, async () => { const x = await bonsai.store.exportAll(); return [x.schema, x.pages.length]; });
t.eq(b, [5, 9], "backup has schema 5 and the pages");

// The garden panel: the name comes first and renames in place; Tech tree opens at the island's tier.
await page.click("#winGarden"); await page.waitForSelector("body[data-isles=ready]");
await page.waitForFunction(() => document.querySelector("#gpanel h2")?.textContent === "Garden"); await page.waitForTimeout(400);
await k("1"); await k("2"); await k("1");
await page.waitForFunction(() => document.querySelector("#gpanel h2")?.textContent === "Matter");
t.eq(await state(page, () => document.querySelector("#gpanel").firstElementChild.className), "ph gph", "the name is at the top of the panel");
await page.click("#gpanel h2.gname"); await page.fill("#gpanel .gname-in", "Matter and materials"); await k("Enter");
await page.waitForFunction(() => bonsai.S.zones.some((z) => z.name === "Matter and materials"));
await page.selectOption("#topicBiome", "glowcap");
await page.waitForFunction(() => Object.values(bonsai.S.garden.zone).some((o) => o.biome === "glowcap"));
await page.screenshot({ path: "tests/shots/garden-topic-panel.png" });
await page.click("#techBtn"); await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech); await page.waitForTimeout(300);
t.eq(await state(page, () => { const s = bonsai.tech.snapshot(); return [s.root, !!s.pick]; }), ["i:start", true], "a topic's Tech tree opens on the whole tree, the topic picked");
await k("Escape"); await k("Escape"); await k("Escape"); await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector("#gpanel h2");
await k("0"); await page.waitForFunction(() => document.querySelector("#gpanel h2")?.textContent === "Garden");
await k("1"); await k("4"); await page.waitForFunction(() => document.querySelector("#gpanel h2")?.textContent === "Physics");
await page.click("#isleTech"); await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech); await page.waitForTimeout(300);
t.eq(await state(page, () => bonsai.tech.snapshot().pick), "i:phys", "an island's Tech tree opens with that island picked");
// Shift+Tab from the garden: the knowledge graphs of the island (or topic, or hub) picked, and only those.
await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector("#gpanel h2");
await k("0"); await page.waitForFunction(() => document.querySelector("#gpanel h2")?.textContent === "Garden");
await k("1"); await k("2"); await page.waitForFunction(() => document.querySelector("#gpanel h2")?.textContent === "General science");
await k("Shift+Tab"); await page.waitForFunction(() => bonsai.S.view === "forest" && bonsai.S.forest);   // Knowledge shows what's picked in the garden
t.eq(await state(page, () => [document.querySelector("#top h1").textContent, bonsai.S.forest.fl.zones.size]), ["General science", 4], "an island's graphs, its four topics");
await page.screenshot({ path: "tests/shots/scope-island.png" });
await page.evaluate((z) => { location.hash = "#/forest/" + z; }, ids.mech); await page.waitForFunction(() => document.querySelector("#top h1")?.textContent === "Mechanics");
t.eq(await state(page, () => [bonsai.S.forest.fl.zones.size, bonsai.S.forest.fl.trees.size]), [1, 3], "a topic's graphs");
await page.click("#scopeAll"); await page.waitForFunction(() => !bonsai.S.fscope && bonsai.S.forest.fl.zones.size > 10);

// Dark, phone, and the other windows in the new bars and colours.
const dark = await t.page({ colorScheme: "dark" }, "#/");
await dark.waitForFunction(() => bonsai.S.pages.length >= 6);
await dark.click("#winNotes"); await dark.waitForSelector("#nlist");
await dark.click('#nlist .nrow:has-text("Leadership") .chev'); await dark.click('#nlist .nrow:has-text("Workshop") .nname');
await dark.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Workshop: GROW model");
await dark.screenshot({ path: "tests/shots/notes-dark.png" });
await dark.click("#winGarden"); await dark.waitForSelector("body[data-isles=ready]"); await dark.waitForTimeout(1500);
await dark.screenshot({ path: "tests/shots/garden-dark.png" });
const phone = await t.page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, "#/");
await phone.waitForFunction(() => bonsai.S.pages.length >= 6);
t.eq(await state(phone, () => document.querySelector("#top").scrollWidth <= 390), true, "garden top bar fits the phone");
await phone.tap("#winNotes"); await phone.waitForSelector("#nlist .nrow");
t.eq(await state(phone, () => document.querySelector("#top").scrollWidth <= 390), true, "notes top bar fits the phone");
await phone.tap('#nlist .nrow:has-text("Reading list") .nname'); await phone.waitForFunction(() => document.querySelector("#pageTitle")?.value);
await phone.screenshot({ path: "tests/shots/notes-phone.png" });
await t.end();
