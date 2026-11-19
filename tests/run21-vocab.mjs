// Vocab: the Vocab row at the foot of the notes sidebar opens the vocab page; terms are underlined in note pages
// without touching the page's text; hovering one opens its panel, hovering a term inside it opens the next;
// pin, drag, Esc and right-click; add, edit and remove terms; the page's search and sorts; nothing lost on reload.
import { start, state } from "./lib.mjs";

const t = await start("run21-vocab", 4321, { channel: "beta" });
const page = await t.page({}, "#/notes");
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.waitForSelector("body[data-ready]"); await page.waitForSelector("#vocabBtn");
const key = (k) => page.keyboard.press(k);
const lect = await state(page, () => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).id);
const blocksBefore = await state(page, (id) => JSON.stringify(bonsai.S.pages.find((p) => p.id === id).blocks), lect);

// ---- underlines in a note
await page.evaluate((id) => { location.hash = "#/notes/" + id; }, lect); await page.waitForSelector(".blocks"); await page.waitForTimeout(600);
const hits = await state(page, () => bonsai.vocab.hits.map((h) => h.range.toString()));
for (const w of ["Momentum", "Impulse", "Newton's 2nd law", "inelastic", "KE"]) if (!hits.some((h) => h.toLowerCase() === w.toLowerCase())) t.fail(`"${w}" isn't underlined: ${hits.join(", ")}`);
if (hits.some((h) => h === "p")) t.fail("a one-letter alias matched on its own");
t.eq(await state(page, () => document.querySelectorAll(".blocks mark").length), 0, "the page's own text is left as it was");

// ---- hover a term: its panel; hover a term inside it: the next panel
const at = (text) => page.evaluate((w) => { const h = bonsai.vocab.hits.find((x) => x.range.toString().toLowerCase() === w.toLowerCase()); const r = h.range.getClientRects()[0]; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, text);
let p = await at("Impulse"); await page.mouse.move(p.x - 30, p.y); await page.mouse.move(p.x, p.y, { steps: 3 });
await page.waitForSelector(".vpanel");
t.eq(await page.textContent(".vpanel h3"), "Impulse", "hovering a term opens its panel");
const inner = page.locator('.vpanel mark.vt:text-is("momentum")').first();
const b = await inner.boundingBox(); await page.mouse.move(b.x + 4, b.y + b.height / 2, { steps: 6 }); await page.mouse.move(b.x + 6, b.y + b.height / 2);
await page.waitForFunction(() => document.querySelectorAll(".vpanel").length === 2);
t.eq(await state(page, () => [...document.querySelectorAll(".vpanel h3")].map((h) => h.textContent).concat(document.querySelectorAll(".vpanel .vcrumb")[1].textContent)), ["Impulse", "Momentum", "Impulse ›"], "a term inside a panel opens the next, which shows where it came from");
await page.waitForTimeout(400); await page.screenshot({ path: "tests/shots/vocab-panels.png" });
// moving away closes both
await page.mouse.move(5, 400, { steps: 4 }); await page.waitForFunction(() => !document.querySelector(".vpanel"), null, { timeout: 4000 });

// pin: stays when the pointer leaves; drag it; Esc closes the top one
p = await at("Momentum"); await page.mouse.move(p.x, p.y, { steps: 3 }); await page.waitForSelector(".vpanel");
await page.click(".vpanel .vpin"); const h0 = await page.locator(".vpanel .vhead").boundingBox();
await page.mouse.move(h0.x + 60, h0.y + 10); await page.mouse.down(); await page.mouse.move(h0.x + 160, h0.y + 90, { steps: 5 }); await page.mouse.up();
await page.mouse.move(5, 400, { steps: 3 }); await page.waitForTimeout(800);
const h1 = await page.locator(".vpanel").boundingBox();
t.eq([await page.locator(".vpanel").count(), Math.abs(h1.x - h0.x - 100) < 3, Math.abs(h1.y - h0.y - 80) < 3], [1, true, true], "a pinned panel stays and can be dragged");
await key("Escape"); t.eq(await page.locator(".vpanel").count(), 0, "Esc closes it");
// right-click closes too
p = await at("Impulse"); await page.mouse.move(p.x, p.y, { steps: 3 }); await page.waitForSelector(".vpanel");
await page.click(".vpanel .vbody", { button: "right" }); t.eq(await page.locator(".vpanel").count(), 0, "right-click closes a panel");

// typing in the note keeps the underlines up to date and saves the text as written
await page.locator(".blocks .tx").last().click(); await key("End"); await page.keyboard.type(" — check the impulse again"); await page.waitForTimeout(700);
if (!(await state(page, () => bonsai.vocab.hits.filter((h) => h.range.toString() === "impulse").length))) t.fail("a term typed into a note isn't underlined");
await page.click("#notesSearch"); await page.waitForTimeout(600);
if (!(await state(page, (id) => JSON.stringify(bonsai.S.pages.find((p) => p.id === id).blocks), lect)).includes("check the impulse again") || /mark|highlight/.test(await state(page, (id) => JSON.stringify(bonsai.S.pages.find((p) => p.id === id).blocks), lect))) t.fail("the note didn't save as typed");
if (blocksBefore.includes("check the impulse again")) t.fail("bad test");
await page.evaluate(() => document.activeElement.blur());

// ---- the vocab page: Shift+V, or the row at the foot of the sidebar
await key("Shift+V"); await page.waitForSelector(".page.vocab");
t.eq([await page.evaluate(() => location.hash), await page.locator(".vcard").count(), await page.getAttribute("#vocabBtn", "class")], ["#/notes/vocab", 6, "nvocab on"], "Shift+V opens the vocab page with every term");
t.eq(await page.locator(".vcard").first().locator("b").textContent(), "GROW", "A–Z first");
await page.click('.vsort [data-sort="page"]');
t.eq(await state(page, () => [...document.querySelectorAll(".vgroup h3")].map((h) => h.textContent)), ["Lecture 6: Momentum", "Workshop: GROW model"], "By page groups terms under the page they're first met in");
await page.screenshot({ path: "tests/shots/vocab-page.png" });
await page.click('.vsort [data-sort="az"]');
await key("f"); await page.keyboard.type("energy"); t.eq(await page.locator(".vcard").count(), 2, "search looks in meanings too"); await key("Escape"); await page.click(".page.vocab h1");

// add a term with N; it underlines at once wherever it appears
await key("n"); await page.waitForSelector(".dialog #f-term");
await page.fill("#f-term", "Conservation of momentum"); await page.fill("#f-def", "With no outside force, total momentum stays the same."); await page.click(".dialog .btn.primary");
await page.waitForFunction(() => bonsai.S.vocab.length === 7);
t.eq(await state(page, () => bonsai.S.vocab.find((x) => x.term === "Conservation of momentum").def), "With no outside force, total momentum stays the same.", "a new term");
// edit by clicking its name; a second term of the same name edits the first instead
await page.click('.vterm:has-text("Kinetic energy")'); await page.waitForSelector(".dialog #f-aka"); await page.fill("#f-aka", "KE, kinetic"); await page.click(".dialog .btn.primary");
await page.waitForFunction(() => bonsai.S.vocab.find((x) => x.term === "Kinetic energy").aliases.length === 2);
await page.click("#newTerm"); await page.waitForSelector(".dialog #f-term"); await page.fill("#f-term", "grow"); await page.fill("#f-def", "Goal, Reality, Options, Way forward."); await page.click(".dialog .btn.primary");
await page.waitForFunction(() => bonsai.S.vocab.find((x) => x.term === "grow"));
t.eq(await state(page, () => bonsai.S.vocab.length), 7, "a term already there is edited, not added twice");
// remove, with undo
await page.click('.vcard:has(b:text-is("Impulse")) .ib'); await page.waitForFunction(() => bonsai.S.vocab.length === 6);
await page.click(".toast button"); await page.waitForFunction(async () => (await bonsai.store.getMeta("vocab")).length === 7);

// kept after a reload, and the lecture is underlined with the new term
await page.reload(); await page.waitForSelector("body[data-ready]");
t.eq(await state(page, () => [bonsai.S.vocab.length, bonsai.S.npage]), [7, "vocab"], "kept on reload, still on the vocab page");
await page.evaluate((id) => { location.hash = "#/notes/" + id; }, lect); await page.waitForSelector(".blocks"); await page.waitForTimeout(600);
if (!(await state(page, () => bonsai.vocab.hits.some((h) => h.range.toString() === "Conservation of momentum")))) t.fail("the longer new term isn't underlined over the shorter one");
await page.screenshot({ path: "tests/shots/vocab-note.png" });
t.eq(errs, [], "no errors");
await t.end();
