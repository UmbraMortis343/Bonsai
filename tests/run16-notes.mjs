// Notes: pages per topic, bullets in the editor, growing a page with Claude's reply, the drawer beside a graph.
import { readFileSync } from "node:fs";
import { start, state } from "./lib.mjs";
import { readGrow, planGrow, growPrompt } from "../src/notes.js";

const t = await start("run16-notes", 4316, { channel: "beta" });
const reply = readFileSync("tests/fixtures/grow-mechanics.txt", "utf8");

// The reader on its own: indents of any width, refs, bodies, links, and nothing made twice.
{
  const r = readGrow("bonsai grow\ngraph: G\nA | a\n    B | b\n        > more\n    = A\nlink: B -> A");
  t.eq(r.graphs[0].items.map((i) => [i.depth, i.title, i.ref]), [[0, "A", false], [1, "B", false], [1, "A", true]], "reads indents of four spaces");
  t.eq(r.graphs[0].items[1].body, "more", "keeps > lines as notes");
  const p = planGrow(r, {});
  t.eq([p.trees.length, p.nodes.length, p.links.length], [1, 1, 0], "a new graph starts on its first idea, A isn't made twice and the link back is already the string");
  t.eq(readGrow("no format here").graphs.length, 1, "loose lines still read as ideas");
  t.eq(growPrompt({ topic: "X", page: { title: "P", text: "hello" } }).includes("hello"), true, "the prompt carries the page");
}

const page = await t.page({ permissions: ["clipboard-read", "clipboard-write"] }, "#/");
await page.waitForFunction(() => bonsai.S.pages.length >= 2);
const ids = await state(page, () => { const z = (n) => bonsai.S.zones.find((x) => x.name === n).id; return { mech: z("Mechanics"), coach: z("Coaching"), em: bonsai.S.trees.find((x) => x.name === "Energy and momentum").id }; });

// O opens the notes window on a topic; the demo has a lecture in Mechanics.
await page.keyboard.press("o");
await page.waitForSelector("#notes:not([hidden]) #nlist");
await page.evaluate((z) => { location.hash = "#/notes/" + z; }, ids.mech);
await page.waitForFunction(() => document.querySelector("#pageText")?.value.includes("Momentum p = mv"));
t.eq(await page.inputValue("#pageTitle"), "Lecture 6: Momentum", "the lecture opens");
t.eq(await page.isVisible("#pageGrow"), true, "Grow shows with its key");

// A new page by keyboard, with bullets: Enter carries on the bullet, Tab indents, Enter on an empty one steps out.
await page.keyboard.press("n");
await page.waitForFunction(() => document.activeElement?.id === "pageTitle");
await page.keyboard.type("Lecture 7"); await page.keyboard.press("Enter");
await page.keyboard.type("- Work"); await page.keyboard.press("Enter"); await page.keyboard.press("Tab"); await page.keyboard.type("W = Fd");
await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await page.keyboard.type("Power");
t.eq(await page.inputValue("#pageText"), "- Work\n  - W = Fd\n- Power", "bullets in the editor");
await page.waitForTimeout(900);
t.eq(await state(page, async () => (await bonsai.store.listPages()).find((p) => p.title === "Lecture 7")?.text), "- Work\n  - W = Fd\n- Power", "the page is saved");
await page.keyboard.press("Escape");
t.eq(await state(page, () => bonsai.S.view), "notes", "Esc leaves the editor first");
t.eq(await page.locator("#nlist .nrow").count(), 2, "two pages in the topic");
await page.keyboard.press("Delete");
await page.waitForFunction(() => document.querySelectorAll("#nlist .nrow").length === 1);
await page.click("#toast .link");
await page.waitForFunction(() => document.querySelectorAll("#nlist .nrow").length === 2);

// Grow the lecture: copy the prompt for Claude, paste its reply, see what it adds, grow, undo, grow again.
await page.keyboard.press("1");
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Lecture 6: Momentum");
const before = await state(page, () => [bonsai.S.nodes.length, bonsai.S.links.length]);
await page.keyboard.press("g");
await page.waitForSelector("#growReply");
await page.click("#growCopy");
const copied = await page.evaluate(() => navigator.clipboard.readText());
t.eq(copied.includes("bonsai grow") && copied.includes("Lecture 6: Momentum") && copied.includes("graph: Energy and momentum"), true, "the prompt has the format, the page and the topic's graphs");
await page.fill("#growReply", reply);
t.eq(await page.textContent("#growSum"), "Energy and momentum +5 · Newton's laws +2 · 2 links", "what the reply adds");
await page.screenshot({ path: "tests/shots/notes-grow.png" });
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction((n) => bonsai.S.nodes.length === n + 7, before[0]);
const grown = await state(page, () => {
  const by = (x) => bonsai.S.nodes.find((n) => n.title === x), S = bonsai.S;
  return { inelastic: S.byId.get(by("Perfectly inelastic collision").parentId).title, f: S.byId.get(by("Force is rate of change of momentum").parentId).title,
    body: by("Conservation of momentum").body.includes("recoil"), links: S.links.length, marked: !!document.querySelector("#nlist .nrow.on .grown") };
});
t.eq(grown, { inelastic: "Inelastic collision", f: "2nd law", body: true, links: before[1] + 2, marked: true }, "the ideas string onto the right ones");
await page.click("#toast .link");
await page.waitForFunction((n) => bonsai.S.nodes.length === n, before[0]);
t.eq(await state(page, () => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).grown.length), 0, "undo takes the grow back");
await page.keyboard.press("g"); await page.fill("#growReply", reply); await page.keyboard.press("Control+Enter");
await page.waitForFunction((n) => bonsai.S.nodes.length === n + 7, before[0]);
await page.keyboard.press("g"); await page.fill("#growReply", reply);
t.eq(await page.textContent("#growSum"), "Nothing new", "growing the same reply again adds nothing");
t.eq(await page.inputValue("#growPrompt"), await state(page, () => bonsai.S.lastPrompt), "the prompt is there to copy by hand");
t.eq((await page.inputValue("#growPrompt")).includes("already made from this page before"), true, "a regrow tells Claude what this page made");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300);
await page.screenshot({ path: "tests/shots/notes-laptop.png" });

// In a graph, O pulls the topic's notes up beside it; Esc puts them away.
await page.evaluate((id) => { location.hash = "#/tree/" + id; }, ids.em);
await page.waitForSelector(".lbl.trunk");
await page.keyboard.press("o");
await page.waitForSelector("#nside:not([hidden]) #pageText");
t.eq(await page.inputValue("#nside #pageTitle"), "Lecture 6: Momentum", "the topic's page is beside the graph");
t.eq(await page.locator("#sidePage option").count(), 2, "with its other pages to pick");
await page.click("#nside #pageText"); await page.keyboard.press("Control+End"); await page.keyboard.press("Enter"); await page.keyboard.type("Momentum in 2D");
await page.waitForTimeout(800);
await page.screenshot({ path: "tests/shots/notes-beside.png" });
await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
t.eq(await state(page, () => [bonsai.S.view, document.querySelector("#nside").hidden]), ["tree", true], "Esc closes the drawer, not the graph");
t.eq(await state(page, async () => (await bonsai.store.listPages()).find((p) => p.title.startsWith("Lecture 6")).text.endsWith("- Momentum in 2D")), true, "typing beside the graph is saved");

// Backups carry the pages.
const b = await state(page, async () => { const x = await bonsai.store.exportAll(); return [x.schema, x.pages.length]; });
t.eq(b, [4, 3], "backup has schema 4 and the pages");

// Phone.
const phone = await t.page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, "#/");
await phone.evaluate((z) => { location.hash = "#/notes/" + z; }, ids.coach);
await phone.waitForFunction(() => document.querySelector("#pageText")?.value.includes("GROW"));
await phone.screenshot({ path: "tests/shots/notes-phone.png" });
await t.end();
