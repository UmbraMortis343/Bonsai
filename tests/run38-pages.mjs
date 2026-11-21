// Library pages (w2-pages): undo in the block editor, tables, images, actions, and the half-screen layout.
import { start, state } from "./lib.mjs";

const t = await start("run38-pages", 4338, { channel: "beta" });
const page = await t.page({ permissions: ["clipboard-read", "clipboard-write"] }, "#/");
await page.waitForFunction(() => bonsai.S.pages.length >= 6);
const k = (key) => page.keyboard.press(key), type = (s) => page.keyboard.type(s);
const htmls = () => state(page, () => bonsai.S.ed.blocks.map((b) => b.html));
const kinds = () => state(page, () => bonsai.S.ed.blocks.map((b) => [b.type, b.indent, b.html]));
const saved = (title) => state(page, async (x) => (await bonsai.store.listPages()).find((p) => p.title === x)?.blocks, title);
const open = async (title, blocks) => {
  await state(page, async ([title, text]) => {
    const m = await import("./blocks.js");
    const p = await bonsai.store.addPage({ title, blocks: m.textToBlocks(text).map((b) => (b.type === "quote" ? { ...b, type: "toggle", open: true } : b)) });
    await bonsai.refresh(); location.hash = "#/notes/" + p.id;
  }, [title, blocks]);
  await page.waitForFunction((x) => document.querySelector("#pageTitle")?.value === x, title);
};
const at = (n) => page.locator("#nedit .blk .tx").nth(n);
await page.click("#winNotes"); await page.waitForSelector("#notes:not([hidden]) #nlist");

// ---------- 1. undo brings back whatever was deleted ----------
await open("Undo", "one\ntwo\n- parent\n  - child\n  - child 2\nthree\n> toggle\n  hidden\nfour");
const start0 = await kinds();
// typing, then Ctrl+Z: the words go, and come back with Ctrl+Shift+Z
await at(0).click(); await k("End"); await type(" more");
await k("Control+z");
t.eq(await htmls().then((h) => h[0]), "one", "Ctrl+Z takes back typing");
await k("Control+Shift+z");
t.eq(await htmls().then((h) => h[0]), "one more", "Ctrl+Shift+Z puts it back");
await k("Control+z");
// Backspace at the start of a block joins it to the one above; undo splits it again
await at(1).click(); await k("Home"); await k("Backspace");
t.eq((await htmls()).slice(0, 2), ["onetwo", "parent"], "Backspace joins two blocks");
await k("Control+z");
t.eq(await kinds(), start0, "undo splits them again");
await k("Control+y");
t.eq((await htmls())[0], "onetwo", "Ctrl+Y redoes");
await k("Control+z");
// a selection across blocks deleted
await at(0).click();
await state(page, () => { const t = [...document.querySelectorAll("#nedit .blk .tx")]; getSelection().setBaseAndExtent(t[0].firstChild, 1, t[2].firstChild, 3); });
await k("Backspace");
t.eq((await htmls()).slice(0, 2), ["oent", "child"], "the words between go, the ends join");
await k("Control+z");
t.eq(await kinds(), start0, "and comes back with undo");
// a block with what's inside it, from the handle's menu
const parent = page.locator('#nedit .blk:has-text("parent")').first();
await parent.hover(); await parent.locator(".hdl").click(); await page.click('.menu .mi:has-text("Delete")');
t.eq((await htmls()).includes("child"), false, "Delete in the handle menu takes the children too");
await at(0).click(); await k("Control+z");
t.eq(await kinds(), start0, "undo brings the block and its children back");
// a closed toggle with hidden children, deleted with the handle's menu
await state(page, () => document.querySelector('#nedit .blk.t-toggle .tg').click());
const tog = page.locator("#nedit .blk.t-toggle").first();
await tog.hover(); await tog.locator(".hdl").click(); await page.click('.menu .mi:has-text("Delete")');
t.eq((await htmls()).includes("hidden"), false, "a closed toggle goes with what's hidden in it");
await at(0).click(); await k("Control+z");
t.eq((await kinds()).map((x) => x[2]), start0.map((x) => x[2]), "undo brings the toggle and its hidden children back");
// cut
await at(2).click(); await k("Home"); await k("Shift+End"); await k("Control+x");
t.eq((await htmls())[2], "", "cut takes the words");
await k("Control+z");
t.eq((await htmls())[2], "parent", "undo puts cut words back");
// typing then deleting quickly, then undo twice
await at(5).click(); await k("End"); await type("xyz"); for (let i = 0; i < 6; i++) await k("Backspace");
await k("Control+z"); await k("Control+z");
t.eq((await htmls())[5], "three", "quick typing and deleting undoes to where it was");
// the page saved and drawn again keeps its history
await page.waitForTimeout(700);
await at(0).click(); await k("End"); await type("!"); await at(1).click(); await k("Home"); await k("Backspace");
await page.waitForTimeout(700);
const undoId = await state(page, () => bonsai.S.npage);
await page.click('#nlist .nrow:has-text("Reading list") .nname'); await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Reading list");
await state(page, (id) => { location.hash = "#/notes/" + id; }, undoId); await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Undo");
await at(0).click(); await k("Control+z"); await k("Control+z");
t.eq((await htmls()).slice(0, 2), ["one", "two"], "after the page is drawn again, undo still works");
await page.waitForTimeout(700);
t.eq((await saved("Undo")).slice(0, 2).map((b) => b.html), ["one", "two"], "and what undo brought back is saved");

await t.end();
