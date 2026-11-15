// Notes, the third window: nested pages per topic, a Notion-style block editor, attaching pages to graphs,
// growing a page with Claude's reply, and the drawer of attached pages beside a graph.
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
await page.waitForFunction(() => bonsai.S.pages.length >= 3);
const ids = await state(page, () => { const z = (n) => bonsai.S.zones.find((x) => x.name === n).id, g = (n) => bonsai.S.trees.find((x) => x.name === n).id; return { mech: z("Mechanics"), coach: z("Coaching"), em: g("Energy and momentum"), kin: g("Kinematics") }; });
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

// The demo lecture: blocks, a page inside it, and the graph it's attached to.
await page.evaluate((z) => { location.hash = "#/notes/" + z; }, ids.mech);
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Lecture 6: Momentum");
t.eq(await page.locator("#nedit .blk.t-bullet").count() > 10, true, "the lecture's bullets are blocks");
t.eq(await page.textContent("#nedit .gchip .link"), "Energy and momentum", "attached to its graph");
t.eq(await page.locator("#nedit .blk.t-page").count(), 1, "the page inside it shows as a link");
await page.click('#nlist .nrow[data-id] .chev[aria-expanded="false"]');
await page.waitForSelector('#nlist .nrow:has-text("Problem sheet 6")');
await page.click('#nlist .nrow:has-text("Problem sheet 6") .nname');
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Problem sheet 6");
t.eq([await page.locator("#nedit .blk.t-h2").count(), await page.locator("#nedit .blk.t-todo").count(), (await page.textContent(".pcrumb")).includes("Lecture 6")], [2, 2, true], "headings, to-dos, and where it sits");
await page.screenshot({ path: "tests/shots/notes-subpage.png" });

// Writing a page by keyboard: Markdown shortcuts, Enter, Tab, the / menu, bold.
await k("Escape"); await k("n");
await page.waitForFunction(() => document.activeElement?.id === "pageTitle");
await type("Lecture 7"); await k("Enter");
await type("# Work and energy"); await k("Enter");
await type("- W = Fd"); await k("Enter"); await k("Tab"); await type("F along the motion"); await k("Enter"); await k("Enter"); await k("Enter");
await type("/to");
await page.waitForSelector(".slash .si.on");
t.eq(await page.textContent(".slash .si.on"), "☐To-do list", "the / menu filters as you type");
await page.screenshot({ path: "tests/shots/notes-slash.png" });
await k("Enter"); await type("Revise");
await k("Shift+Home"); await page.waitForSelector(".fmtbar:not([hidden])"); await k("Control+b"); await k("End");
await page.waitForTimeout(700);
t.eq(await blocks("Lecture 7"), [["h1", 0, "Work and energy"], ["bullet", 0, "W = Fd"], ["bullet", 1, "F along the motion"], ["todo", 0, "<b>Revise</b>"]], "the blocks as written");
await k("Control+Shift+ArrowUp"); await page.waitForTimeout(600);
t.eq((await blocks("Lecture 7")).map((b) => b[2]), ["Work and energy", "<b>Revise</b>", "W = Fd", "F along the motion"], "Ctrl+Shift+↑ moves a block over the whole block above");
// drag the bullet (and the one inside it) to the top by its handle
const h = page.locator('#nedit .blk.t-bullet').first();
await h.hover(); const hb = await h.locator(".hdl").boundingBox(), top = await page.locator("#nedit .blk.t-h1").boundingBox();
await page.mouse.move(hb.x + 5, hb.y + 5); await page.mouse.down(); await page.mouse.move(hb.x + 5, top.y + 10, { steps: 6 }); await page.mouse.move(hb.x + 5, top.y + 3, { steps: 2 }); await page.mouse.up();
await page.waitForTimeout(600);
t.eq((await blocks("Lecture 7")).map((b) => b[2]), ["W = Fd", "F along the motion", "Work and energy", "<b>Revise</b>"], "dragging moves a block with what's inside it");
// a page inside this one, from the / menu
await page.click("#nedit .blk.t-todo .tx"); await k("End"); await k("Enter"); await k("Enter"); await type("/page"); await k("Enter");
await page.waitForFunction(() => bonsai.S.pages.find((p) => p.id === bonsai.S.npage)?.parentId);
await type("Worked examples");
await page.click(".pcrumb .link:has-text('Lecture 7')");
await page.waitForSelector("#nedit .blk.t-page .plink:has-text('Worked examples')");
// attach Lecture 7 to Kinematics
await k("Escape"); await k("a"); await page.click('.mi:has-text("Kinematics")');
await page.waitForSelector('#nedit .gchip:has-text("Kinematics")');

// Grow the lecture with Claude's reply: copy, paste, see what it adds, grow, undo, grow again.
await k("1");
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Lecture 6: Momentum");
const before = await state(page, () => [bonsai.S.nodes.length, bonsai.S.links.length]);
await k("g"); await page.waitForSelector("#growReply");
await page.click("#growCopy");
const copied = await page.evaluate(() => navigator.clipboard.readText());
t.eq(copied.includes("bonsai grow") && copied.includes("- Momentum p = mv") && copied.includes("graph: Energy and momentum"), true, "the prompt has the format, the page as an outline and the topic's graphs");
await page.fill("#growReply", reply);
t.eq(await page.textContent("#growSum"), "Energy and momentum +5 · Newton's laws +2 · 2 links", "what the reply adds");
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction((n) => bonsai.S.nodes.length === n + 7, before[0]);
const grown = await state(page, () => { const by = (x) => bonsai.S.nodes.find((n) => n.title === x), S = bonsai.S;
  return { inelastic: S.byId.get(by("Perfectly inelastic collision").parentId).title, body: by("Conservation of momentum").body.includes("recoil"), links: S.links.length, attached: S.pages.find((p) => p.title.startsWith("Lecture 6")).treeIds.map((id) => S.trees.find((t) => t.id === id).name).sort() }; });
t.eq(grown, { inelastic: "Inelastic collision", body: true, links: before[1] + 2, attached: ["Energy and momentum", "Newton's laws"] }, "ideas strung onto the right ones, and the page attached to what it grew");
await page.click("#toast .link");
await page.waitForFunction((n) => bonsai.S.nodes.length === n, before[0]);
await k("g"); await page.fill("#growReply", reply); await k("Control+Enter");
await page.waitForFunction((n) => bonsai.S.nodes.length === n + 7, before[0]);
await k("g"); await page.fill("#growReply", reply);
t.eq(await page.textContent("#growSum"), "Nothing new", "the same reply again adds nothing");
await k("Escape");
await page.screenshot({ path: "tests/shots/notes-laptop.png" });

// Beside a graph, O shows the pages attached to it; typing there is saved; Esc closes it.
await page.evaluate((id) => { location.hash = "#/tree/" + id; }, ids.kin);
await page.waitForSelector(".lbl.trunk"); await k("o");
await page.waitForSelector("#nside:not([hidden]) #sideTitle");
t.eq(await page.inputValue("#sideTitle"), "Lecture 7", "Kinematics shows the page attached to it");
await page.evaluate((id) => { location.hash = "#/tree/" + id; }, ids.em);
await page.waitForFunction(() => document.querySelector("#sideTitle")?.value === "Lecture 6: Momentum");
await page.click("#nside .blk.t-bullet >> nth=-1"); await k("End"); await k("Enter"); await type("Momentum in 2D");
await page.waitForTimeout(700);
await page.screenshot({ path: "tests/shots/notes-beside.png" });
await k("Escape"); await k("Escape");
t.eq(await state(page, () => [bonsai.S.view, document.querySelector("#nside").hidden]), ["tree", true], "Esc closes the drawer, not the graph");
t.eq((await blocks("Lecture 6: Momentum")).some((b) => b[0] === "bullet" && b[2] === "Momentum in 2D"), true, "typing beside the graph is saved");

// Deleting a page takes the pages inside it too, and undo brings them all back.
await page.click("#winNotes"); await page.waitForSelector("#nlist");
await page.click('#nlist .nrow:has-text("Lecture 7") .nname'); await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Lecture 7");
await k("Escape"); await k("Delete");
await page.waitForFunction(() => !bonsai.S.pages.some((p) => p.title === "Lecture 7" || p.title === "Worked examples"));
await page.click("#toast .link");
await page.waitForFunction(() => bonsai.S.pages.some((p) => p.title === "Worked examples"));

const b = await state(page, async () => { const x = await bonsai.store.exportAll(); return [x.schema, x.pages.length]; });
t.eq(b, [4, 5], "backup has schema 4 and the pages");

// Dark, and phone.
const dark = await t.page({ colorScheme: "dark" }, "#/");
await dark.evaluate((z) => { location.hash = "#/notes/" + z; }, ids.coach);
await dark.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Workshop: GROW model");
await dark.screenshot({ path: "tests/shots/notes-dark.png" });
const phone = await t.page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, "#/");
await phone.evaluate((z) => { location.hash = "#/notes/" + z; }, ids.mech);
await phone.waitForFunction(() => document.querySelector("#pageTitle")?.value);
t.eq(await state(phone, () => document.querySelector("#top").scrollWidth <= 390), true, "top bar fits the phone");
await phone.screenshot({ path: "tests/shots/notes-phone.png" });
await t.end();
