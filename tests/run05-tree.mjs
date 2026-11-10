// Laptop, keyboard first: plant a tree, grow it with Tab and Enter, move with
// arrows, rename, write notes, link, colour, delete and undo, search, and go
// between the forest and the tree.
import { start, state } from "./lib.mjs";

const t = await start("run05-tree", 4305);
const page = await t.page();
const sel = (title) => page.waitForSelector(`.lbl.sel:text-is("${title}")`);
const key = (k) => page.keyboard.press(k);
const add = async (k, title, commit = "Enter") => { await key(k); await page.waitForSelector("#quickInput"); await page.keyboard.type(title); await key(commit); };

await page.fill("#zoneName", "Electronics"); await page.press("#zoneName", "Enter");
await page.fill("#f-name", "Basic electronics"); await page.fill("#f-core", "Ohm's law"); await page.press("#f-core", "Enter");
await sel("Ohm's law");
if (!(await page.isVisible('[data-act="add"]'))) t.fail("no action bar for the trunk");

await add("Tab", "Resistors"); await sel("Resistors");
await add("Enter", "Capacitors"); await sel("Capacitors");
await key("Tab"); await page.waitForSelector("#quickInput"); await page.keyboard.type("Charge"); await key("Tab");   // commit, then a child of Charge
await page.waitForSelector('.lbl.sel:text-is("Charge")'); await page.waitForSelector("#quickInput"); await page.keyboard.type("Coulombs"); await key("Enter");
await sel("Coulombs");
t.eq(await state(page, () => bonsai.S.nodes.length), 5, "ideas after typing");

await key("ArrowDown"); await sel("Charge");
await key("ArrowDown"); await sel("Capacitors");
await key("ArrowLeft"); await sel("Resistors");
await key("ArrowDown"); await sel("Ohm's law");
await key("ArrowUp"); await sel("Resistors");

await key("r"); await page.waitForSelector("#quickInput"); await page.fill("#quickInput", "Resistance"); await key("Enter"); await sel("Resistance");

await key(" "); await page.waitForSelector("#nodeTitle");
t.eq(await page.inputValue("#nodeTitle"), "Resistance", "panel title");
await page.fill("#nodeNote", "Limits current"); await page.fill("#nodeBody", "**V = IR**\n- ohms\n<script>x</script>"); await page.click(".ph");
await page.waitForSelector("#nodeBodyView strong");
if (await page.$("#nodeBodyView script")) t.fail("notes allowed raw HTML");
const saved = await state(page, () => { const n = bonsai.S.byId.get(bonsai.S.sel); return [n.note, n.body.startsWith("**V = IR**")]; });
t.eq(saved, ["Limits current", true], "note saved");

await page.click('.sw[title="Plum"]');
await page.waitForFunction(() => bonsai.S.byId.get(bonsai.S.sel)?.color === "#8a6bb0");

await key("Escape");
await key("l"); await page.waitForSelector("#pickInput"); await page.keyboard.type("Coul"); await page.waitForSelector(".res"); await key("Enter");
await page.waitForSelector(".linkrow");
await page.fill(".linkrow input", "analogy"); await page.click(".ph");
await page.waitForSelector('.lbl.link:text-is("analogy")');
t.eq(await state(page, () => bonsai.S.links.length), 1, "links");

await page.hover('.lbl.node:text-is("Resistance")');
await page.waitForSelector("#hover:not([hidden])");
if (!(await page.textContent("#hover")).includes("Limits current")) t.fail("hover card has no short note");
await page.screenshot({ path: "tests/shots/tree-laptop.png" });

await key("Escape");
await page.click('.lbl.node:text-is("Charge")'); await sel("Charge");
await key("Escape"); await key("Delete");
await page.waitForSelector('.lbl.node:text-is("Charge")', { state: "detached" });
t.eq(await state(page, () => [bonsai.S.nodes.length, bonsai.S.links.length]), [3, 0], "after delete");
await page.click("#toast .link");
await page.waitForSelector('.lbl.node:text-is("Coulombs")');
t.eq(await state(page, () => [bonsai.S.nodes.length, bonsai.S.links.length]), [5, 1], "after undo");

await key("Escape");
await page.waitForSelector('.lbl.tree:text-is("Basic electronics")');
if ((await page.textContent("#top")).includes("null")) t.fail("stray text in the top bar");
await page.screenshot({ path: "tests/shots/forest-one-tree.png" });
await key("ArrowRight"); await key("Enter");
await page.waitForSelector(".lbl.trunk");
await key("/"); await page.keyboard.type("coul"); await page.waitForSelector(".res"); await key("Enter");
await sel("Coulombs");

await page.reload(); await page.waitForSelector("body[data-ready]"); await page.waitForSelector('.lbl.node:text-is("Coulombs")');
await key("Escape");
await page.click('.lbl.tree:text-is("Basic electronics")');
await page.waitForSelector(".lbl.trunk");
await t.end();
