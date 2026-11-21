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

// ---------- 2. tables ----------
const cells = () => state(page, () => bonsai.S.ed.blocks.filter((b) => b.type === "table").map((b) => ({ rows: b.rows, head: b.head })));
const paste = (sel, data) => state(page, ([sel, data]) => {
  const dt = new DataTransfer(); for (const [k, v] of Object.entries(data)) dt.setData(k, v);
  const n = document.querySelector(sel); n.focus(); getSelection().selectAllChildren(n); getSelection().collapseToEnd();
  n.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
}, [sel, data]);
await open("Tables", "Particles");
await at(0).click(); await k("End"); await k("Enter"); await type("/table");
await page.waitForSelector('.slash .si.on[data-type="table"]'); await k("Enter");
await page.waitForSelector("#nedit .tbl .cell");
t.eq(await cells(), [{ rows: [["", "", ""], ["", "", ""]], head: true }], "/table makes a table with a header row");
await type("Name"); await k("Tab"); await type("Mass"); await k("Tab"); await type("Charge"); await k("Tab");
await type("Proton"); await k("Tab"); await type("938"); await k("Tab"); await type("+1"); await k("Enter");
await type("Electron"); await k("Shift+Tab"); await k("Tab"); await k("Tab"); await k("Tab"); await type("-1");
t.eq((await cells())[0].rows, [["Name", "Mass", "Charge"], ["Proton", "938", "+1"], ["Electron", "", "-1"]], "Tab moves between cells, Enter in the last row adds one");
await k("Alt+Shift+ArrowRight"); await type("Spin");
t.eq((await cells())[0].rows.map((r) => r.length), [4, 4, 4], "Alt+Shift+→ adds a column");
await k("Control+z");
t.eq((await cells())[0].rows[2][3], "", "undo takes back typing in a cell");
await k("Control+z");
t.eq((await cells())[0].rows.map((r) => r.length), [3, 3, 3], "undo takes back the new column");
await k("Control+Shift+z");
t.eq((await cells())[0].rows.map((r) => r.length), [4, 4, 4], "redo puts it back");
await k("Alt+Shift+Delete");
t.eq((await cells())[0].rows.map((r) => r.length), [3, 3, 3], "Alt+Shift+Delete deletes the column");
await page.locator("#nedit .cell").nth(3).click(); await k("Control+a"); await k("Control+b");
t.eq((await cells())[0].rows[1][0], "<b>Proton</b>", "formatting in a cell");
await k("Alt+Shift+h");
t.eq((await cells())[0].head, false, "Alt+Shift+H turns the header row off");
await k("Alt+Shift+h");
const tb = page.locator("#nedit .blk.t-table"); await tb.hover(); await tb.locator(".hdl").click();
t.eq((await page.$$eval(".menu .mi", (r) => r.map((x) => x.textContent).filter((x) => /row|column|Header/.test(x)))).length, 7, "the handle menu adds and deletes rows and columns");
await page.click('.menu .mi:has-text("Add a row above")');
t.eq((await cells())[0].rows.length, 4, "a row from the menu");
await k("Alt+Shift+Backspace");
t.eq((await cells())[0].rows.length, 3, "Alt+Shift+Backspace deletes the row");
await page.waitForTimeout(700);
t.eq((await saved("Tables")).find((b) => b.type === "table").rows[2], ["Electron", "", "-1"], "the table is saved as rows");
await page.screenshot({ path: "tests/shots/pages-table.png" });
// out to Markdown and back, so Grow and pastes read it
const md = await state(page, async () => { const m = await import("./blocks.js"); const text = m.blocksToText(bonsai.S.ed.blocks); const back = m.textToBlocks(text).find((b) => b.type === "table"); return { text, back: back && { rows: back.rows, head: back.head } }; });
t.eq(md.text.split("\n").slice(1, 4), ["| Name | Mass | Charge |", "| --- | --- | --- |", "| **Proton** | 938 | +1 |"], "a table goes out as a Markdown table");
t.eq(md.back, { rows: [["Name", "Mass", "Charge"], ["<b>Proton</b>", "938", "+1"], ["Electron", "", "-1"]], head: true }, "and reads back the same");
// typing a Markdown row and Enter makes a table
await page.locator("#nedit .cell").last().click(); await k("Control+Enter");
await type("| Quark | Charge |"); await k("Enter"); await type("up");
t.eq((await cells())[1], { rows: [["Quark", "Charge"], ["up", ""]], head: true }, "| a | b | and Enter makes a table");
// pasting a table from a web page, and from a spreadsheet
await k("Control+Enter");
await paste("#nedit .blk:last-child .tx", { "text/html": "<table><thead><tr><th>Planet</th><th>Moons</th></tr></thead><tbody><tr><td><b>Mars</b></td><td>2</td></tr></tbody></table>", "text/plain": "Planet\tMoons\nMars\t2" });
t.eq((await cells())[2], { rows: [["Planet", "Moons"], ["<b>Mars</b>", "2"]], head: true }, "an HTML table pasted makes a table block");
await k("Control+Enter");
await paste("#nedit .blk:last-child .tx", { "text/plain": "a\tb\tc\n1\t2\t3\n" });
t.eq((await cells())[3], { rows: [["a", "b", "c"], ["1", "2", "3"]], head: false }, "tab-separated lines from a spreadsheet make a table");
await k("Control+z");
t.eq((await cells()).length, 3, "undo takes the pasted table back");
// a grid pasted into a cell fills from there
await state(page, () => { const dt = new DataTransfer(); dt.setData("text/plain", "x\ty\nz\tw"); const c = document.querySelectorAll("#nedit .blk.t-table")[2].querySelector('.cell[data-r="1"][data-c="1"]'); c.focus(); c.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
t.eq((await cells())[2].rows, [["Planet", "Moons", ""], ["<b>Mars</b>", "x", "y"], ["", "z", "w"]], "a grid pasted into a cell fills the cells from there, growing the table");

// ---------- 3. pictures ----------
const pics = () => state(page, () => bonsai.S.ed.blocks.filter((b) => b.type === "image").map((b) => ({ fileId: b.fileId, w: b.w, h: b.h, width: b.width, caption: b.caption })));
// a "screenshot": a big PNG made on a canvas, pasted from the clipboard
const shot = (w, h, how, sel) => state(page, async ([w, h, how, sel]) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.fillStyle = "#f4f3ef"; g.fillRect(0, 0, w, h); g.fillStyle = "#3e7a4b"; g.fillRect(w * 0.1, h * 0.2, w * 0.5, h * 0.4); g.fillStyle = "#1d1d1b"; g.font = `${h / 8}px sans-serif`; g.fillText("Screenshot", w * 0.15, h * 0.85);
  const blob = await new Promise((r) => c.toBlob(r, "image/png")), file = new File([blob], "shot.png", { type: "image/png" });
  const dt = new DataTransfer(); dt.items.add(file);
  const n = document.querySelector(sel);
  if (how === "paste") { n.focus(); n.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }
  else { const r = n.getBoundingClientRect(); n.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.bottom - 2 })); }
}, [w, h, how, sel]);
await open("Pictures", "Before\n\nAfter");
await at(1).click();
await shot(3000, 1500, "paste", "#nedit .blk:nth-child(2) .tx");
await page.waitForSelector("#nedit .blk.t-image img[src^=blob]");
const p1 = (await pics())[0];
t.eq([p1.w, p1.h, (await htmls()).length], [2000, 1000, 3], "a pasted screenshot is a picture block, shrunk to 2000 px on its long side");
const file = await state(page, (id) => bonsai.store.getFile(id).then((f) => ({ type: f.type, kb: Math.round(f.data.length / 1024) })), p1.fileId);
t.eq([file.type, file.kb < 600], ["image/webp", true], "kept as WebP, apart from the page");
await page.waitForTimeout(700);
t.eq(JSON.stringify(await saved("Pictures")).length < 2000, true, "the page's own save holds only the picture's id");
// size: keys and dragging an edge
await page.locator("#nedit .blk.t-image").focus();
const w0 = p1.width;
await k("Alt+Shift+ArrowLeft");
t.eq((await pics())[0].width, w0 - 10, "Alt+Shift+← makes it narrower");
const grip = await page.locator("#nedit .blk.t-image .igrip.r").boundingBox(), fig = await page.locator("#nedit .blk.t-image figure").boundingBox();
await page.locator("#nedit .blk.t-image").hover();
await page.mouse.move(grip.x + 3, grip.y + 10); await page.mouse.down(); await page.mouse.move(grip.x - fig.width / 4, grip.y + 10, { steps: 5 }); await page.mouse.up();
const w1 = (await pics())[0].width;
t.eq(w1 < w0 - 15 && w1 >= 15, true, "dragging its edge resizes it");
// a caption
await page.locator("#nedit .blk.t-image").focus(); await k("ArrowDown"); await type("A test card");
t.eq((await pics())[0].caption, "A test card", "a caption under it");
// bigger, then back
await page.click("#nedit .blk.t-image img"); await page.waitForSelector(".imgview img");
await page.screenshot({ path: "tests/shots/pages-image-view.png" });
await k("Escape");
t.eq([await page.isVisible(".imgview"), await state(page, () => bonsai.S.view)], [false, "notes"], "click shows it bigger, Esc closes only that");
// copy it
await page.locator("#nedit .blk.t-image").click({ button: "right", position: { x: 40, y: 40 } });
await page.click('.menu .mi:has-text("Copy image")');
await page.waitForFunction(() => document.querySelector("#toast")?.textContent.includes("copied"));
t.eq(await state(page, async () => (await navigator.clipboard.read())[0].types.includes("image/png")), true, "Copy image puts a PNG on the clipboard");
// delete and undo
await page.locator("#nedit .blk.t-image").focus(); await k("Backspace");
t.eq((await pics()).length, 0, "Backspace on a picked picture deletes it");
await k("Control+z");
await page.waitForSelector("#nedit .blk.t-image img[src^=blob]");
t.eq((await pics())[0]?.caption, "A test card", "undo brings it back");
// dropping a file onto the page
await shot(400, 300, "drop", "#nedit .blk:last-child");
await page.waitForFunction(() => document.querySelectorAll("#nedit .blk.t-image").length === 2);
t.eq((await pics())[1].w, 400, "a dropped picture is kept at its own size when small");
await page.waitForTimeout(700);
await page.screenshot({ path: "tests/shots/pages-image.png" });
t.eq(await state(page, async () => (await import("./blocks.js")).blocksToText(bonsai.S.ed.blocks).includes("(picture: A test card)")), true, "pictures show in the outline for Grow");

await t.end();
