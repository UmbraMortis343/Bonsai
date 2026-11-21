// Pen notes 1: a page you write on. Pen and mouse draw (pressure and tilt set the width), touch pans and is ignored
// while a pen is near, the pen's eraser end erases whole strokes, the lasso picks strokes to move, recolour or delete,
// everything undoes, ink is saved as strokes, colours follow day and night, and the rail docks right with its keys.
import { start, state } from "./lib.mjs";
import { strokeNear, caught, widthFor, strokeBox } from "../src/ink.js";

const t = await start("run23-ink", 4323, { channel: "beta" });

// ---- pure parts
const s = { t: "pen", c: 0, p: [0, 0, 2, 100, 0, 2] };
if (!strokeNear(s, 50, 4, 4) || strokeNear(s, 50, 10, 4)) t.fail("strokeNear checks the segment between points");
if (!caught([-10, -10, 110, -10, 110, 10, -10, 10], s) || caught([40, -10, 60, -10, 60, 10, 40, 10], s)) t.fail("the lasso catches a stroke when most of it is inside");
const hard = widthFor(3, { pointerType: "pen", pressure: 1, tiltX: 0, tiltY: 0 }), soft = widthFor(3, { pointerType: "pen", pressure: 0.1, tiltX: 0, tiltY: 0 }), tilted = widthFor(3, { pointerType: "pen", pressure: 1, tiltX: 60, tiltY: 0 });
if (!(hard > soft * 2 && tilted > hard * 1.4)) t.fail(`pressure and tilt widen the line: ${soft} ${hard} ${tilted}`);
t.eq(strokeBox(s), { x0: -1, y0: -1, x1: 101, y1: 1 }, "a stroke's box includes its width");

// ---- in the app
const page = await t.page({ viewport: { width: 1280, height: 1100 } }, "#/notes");
await page.waitForSelector("body[data-ready]");
const ink = await state(page, () => bonsai.S.pages.find((p) => p.kind === "ink").id);
await page.evaluate((id) => { location.hash = "#/notes/" + id; }, ink);
await page.waitForSelector(".inkrail"); await page.waitForTimeout(500);
await page.screenshot({ path: "tests/shots/ink-demo.png" });
t.eq(await page.$$eval(".inkrail .ibtn kbd", (k) => k.map((x) => x.textContent)), ["P", "⇧P", "M", "H", "E", "L", "A", "⇧S", "S", "Ctrl+Z", "Ctrl+Y", "+", "−", "0", "B", "T"], "every tool on the rail shows its key");
const box = await page.$eval(".inkrail", (r) => { const b = r.getBoundingClientRect(); return [Math.round(innerWidth - b.right), Math.round(b.bottom)]; });
t.eq(box[0], 0, "the rail is docked to the right edge");
const n0 = await state(page, () => bonsai.S.ed.ink.doc.strokes.length);

// The page in screen pixels
const at = (x, y) => page.evaluate(([x, y]) => bonsai.S.ed.ink.toScreen(x, y), [x, y]);
// Fire pointer events as a given device (Playwright's mouse is only ever a mouse)
const fire = (type, kind, x, y, extra = {}) => page.evaluate(([type, kind, x, y, extra]) => {
  const c = document.querySelector(".inkc");
  c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: kind === "touch" ? 7 + (extra.finger || 0) : kind === "pen" ? 3 : 1, pointerType: kind, clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : extra.buttons ?? 1, button: type === "pointermove" ? -1 : extra.button ?? 0, pressure: extra.pressure ?? (type === "pointerup" ? 0 : 0.5), tiltX: extra.tiltX || 0, isPrimary: true }));
}, [type, kind, x, y, extra]);
async function draw(kind, pts, extra) {
  const ps = []; for (const [x, y] of pts) ps.push(await at(x, y));
  await fire("pointerdown", kind, ...ps[0], extra);
  for (const p of ps.slice(1)) await fire("pointermove", kind, ...p, extra);
  await fire("pointerup", kind, ...ps.at(-1), extra);
}

// A pen stroke, hard then soft
await draw("pen", [[150, 700], [250, 720], [350, 700], [450, 730]], { pressure: 0.9 });
await draw("pen", [[150, 800], [450, 800]], { pressure: 0.15 });
const strokes = await state(page, () => bonsai.S.ed.ink.doc.strokes.slice(-2));
if (strokes.length !== 2 || strokes[0].t !== "pen") t.fail("pen strokes weren't kept");
if (!(strokes[0].p[2] > strokes[1].p[2] * 2)) t.fail("a harder press doesn't draw wider");

// Touch pans, never draws; and a touch while the pen is near does nothing at all
const n1 = await state(page, () => bonsai.S.ed.ink.doc.strokes.length);
const sy0 = await state(page, () => bonsai.S.ed.ink.view.sy);
await page.waitForTimeout(1600);
await draw("touch", [[300, 600], [300, 500], [300, 400]]);
t.eq(await state(page, () => bonsai.S.ed.ink.doc.strokes.length), n1, "a finger doesn't draw");
if (!((await state(page, () => bonsai.S.ed.ink.view.sy)) > sy0)) t.fail("a finger doesn't scroll the page");
await draw("pen", [[150, 900], [300, 900]]);
const sy1 = await state(page, () => bonsai.S.ed.ink.view.sy);
{ // the pen lifting, then a palm landing, all at once so a slow machine can't put time between them
  const [a, b, c] = [await at(300, 950), await at(300, 600), await at(300, 400)];
  await page.evaluate(([a, b, c]) => {
    const cv = document.querySelector(".inkc"), ev = (type, kind, [x, y], buttons) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: kind === "pen" ? 3 : 7, pointerType: kind, clientX: x, clientY: y, buttons, pressure: buttons ? 0.5 : 0 }));
    ev("pointerdown", "pen", a, 1); ev("pointerup", "pen", a, 0); ev("pointerdown", "touch", b, 1); ev("pointermove", "touch", c, 1); ev("pointerup", "touch", c, 0);
  }, [a, b, c]);
  await page.keyboard.press("Control+z");   // the dot the pen made
}
t.eq(await state(page, () => bonsai.S.ed.ink.view.sy), sy1, "a palm on the screen right after the pen lifts is ignored");
{ // a palm that lands before the pen comes near: it's dropped when the pen shows up; a big contact patch never counts; a resting finger doesn't nudge
  await page.waitForTimeout(1600);
  const [a, b, c, d] = [await at(300, 950), await at(300, 600), await at(300, 400), await at(300, 606)];
  const sy = await page.evaluate(([a, b, c, d]) => {
    const cv = document.querySelector(".inkc"), ink = bonsai.S.ed.ink, ev = (type, kind, [x, y], buttons, id, w = 10) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: kind, clientX: x, clientY: y, buttons, width: w, height: w }));
    const out = [];
    ev("pointerdown", "touch", b, 1, 21); ev("pointermove", "touch", d, 1, 21); out.push(ink.view.sy);   // resting: under the slop
    ev("pointermove", "pen", a, 0, 3); ev("pointermove", "touch", c, 1, 21); out.push(ink.view.sy); ev("pointerup", "touch", c, 0, 21);   // the pen arrives: the palm is dropped
    return out;
  }, [a, b, c, d]);
  t.eq(sy, [sy1, sy1], "a palm that was there first neither nudges the page nor pans once the pen comes near");
  await page.waitForTimeout(1600);
  const sy2 = await page.evaluate(([b, c]) => {
    const cv = document.querySelector(".inkc"), ev = (type, [x, y], buttons) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 22, pointerType: "touch", clientX: x, clientY: y, buttons, width: 60, height: 60 }));
    ev("pointerdown", b, 1); ev("pointermove", c, 1); ev("pointerup", c, 0); return bonsai.S.ed.ink.view.sy;
  }, [b, c]);
  t.eq(sy2, sy1, "a contact the size of a palm is ignored");
}
await page.keyboard.press("Control+z");
t.eq(await state(page, () => bonsai.S.ed.ink.doc.strokes.length), n1, "undo takes back the last stroke");
await page.evaluate(() => { bonsai.S.ed.ink.redraw(); });

// The pen's eraser end erases a whole stroke, and that undoes too
await page.waitForTimeout(200);
await draw("pen", [[300, 790], [300, 810]], { buttons: 32, button: 5 });
t.eq(await state(page, () => bonsai.S.ed.ink.doc.strokes.length), n1 - 1, "the eraser end takes out the stroke it crosses");
if (await state(page, () => bonsai.S.ed.ink.tool) !== "pen") t.fail("flipping the pen shouldn't change the tool");
await page.keyboard.press("Control+z");
t.eq(await state(page, () => bonsai.S.ed.ink.doc.strokes.length), n1, "an erase undoes");

// Highlighter (H), colours (C), size (S)
for (let i = 0; i < 4; i++) await page.keyboard.press("PageUp");
await page.keyboard.press("h"); await page.keyboard.press("c"); await page.keyboard.press("s");
t.eq(await state(page, () => [bonsai.S.ed.ink.tool, bonsai.S.ed.ink.colour, bonsai.S.ed.ink.size]), ["hl", 1, 2], "H, C and S pick the tool, colour and size");
await page.mouse.move(...(await at(140, 620))); await page.mouse.down(); await page.mouse.move(...(await at(460, 620)), { steps: 6 }); await page.mouse.up();
const hl = await state(page, () => bonsai.S.ed.ink.doc.strokes.at(-1));
t.eq([hl.t, hl.c, hl.p[2]], ["hl", 1, 34], "the mouse draws with the highlighter at a fixed width");

// Lasso (L): catch the first pen stroke, move it, recolour it, delete it
await page.keyboard.press("l");
const target = strokes[0].id;
await draw("mouse", [[120, 660], [480, 660], [480, 760], [120, 760], [120, 662]]);
t.eq(await state(page, () => bonsai.S.ed.ink.selected), [target], "the lasso picks the stroke inside it");
const x0 = await state(page, (id) => bonsai.S.ed.ink.doc.strokes.find((s) => s.id === id).p[0], target);
await draw("mouse", [[300, 710], [340, 740], [400, 760]]);
const x1 = await state(page, (id) => bonsai.S.ed.ink.doc.strokes.find((s) => s.id === id).p[0], target);
if (Math.abs(x1 - x0 - 100) > 2) t.fail(`dragging the pick moves it: ${x0} → ${x1}`);
await page.keyboard.press("c");
t.eq(await state(page, (id) => bonsai.S.ed.ink.doc.strokes.find((s) => s.id === id).c, target), 2, "C recolours what's picked");
await page.keyboard.press("Delete");
if (await state(page, (id) => bonsai.S.ed.ink.doc.strokes.some((s) => s.id === id), target)) t.fail("Delete doesn't remove what's picked");
if (!(await state(page, (id) => bonsai.S.pages.some((p) => p.id === id), ink))) t.fail("Delete took the page");
await page.keyboard.press("Control+z");
if (!(await state(page, (id) => bonsai.S.ed.ink.doc.strokes.some((s) => s.id === id), target))) t.fail("undo doesn't bring it back");

// Paper (B), zoom (+, 0)
const paper = await state(page, () => bonsai.S.ed.ink.doc.paper);
await page.keyboard.press("b");
t.eq(await state(page, () => bonsai.S.ed.ink.doc.paper), paper === "lined" ? "grid" : "dots", "B changes the paper");
await page.keyboard.press("+");
if (!((await state(page, () => bonsai.S.ed.ink.zoom)) > 1)) t.fail("+ doesn't zoom in");
await page.keyboard.press("0");
t.eq(await state(page, () => bonsai.S.ed.ink.zoom), 1, "0 fits the width");
await page.keyboard.press("b"); await page.keyboard.press("b"); await page.keyboard.press("b");

// Saved as strokes, and still there after a reload
await page.keyboard.press("p");
await page.waitForTimeout(1200);
const saved = await state(page, async (id) => (await bonsai.store.listPages()).find((p) => p.id === id).ink, ink);
t.eq(saved.strokes.length, n0 + 3, "the strokes are saved");
if (saved.strokes.some((s) => "_b" in s)) t.fail("working state leaks into what's saved");
await page.reload(); await page.waitForSelector(".inkrail"); await page.waitForTimeout(500);
t.eq(await state(page, () => bonsai.S.ed.ink.doc.strokes.length), n0 + 3, "the ink comes back after a reload");
t.eq(await state(page, () => bonsai.S.ed.ink.colour), 2, "the pen keeps its colour");

// The sidebar arrow ([) gives the page the whole width
const w0 = await page.$eval(".inkwrap", (e) => e.clientWidth);
await page.click("#sideHide");
await page.waitForTimeout(300);
const w1 = await page.$eval(".inkwrap", (e) => e.clientWidth);
if (!(w1 > w0 + 200)) t.fail(`hiding the sidebar doesn't widen the page: ${w0} → ${w1}`);
await page.screenshot({ path: "tests/shots/ink-wide.png" });
await page.keyboard.press("[");
if (await page.evaluate(() => document.body.dataset.nbar === "off")) t.fail("[ doesn't bring the sidebar back");

// Properties fold away (D); + Pen (W) makes a new one
if (await page.isVisible(".inkhead .props")) t.fail("properties should start folded");
await page.keyboard.press("d");
if (!(await page.isVisible(".inkhead .props"))) t.fail("D doesn't open the properties");
await page.keyboard.press("d");
await page.keyboard.press("w");
await page.waitForFunction(() => bonsai.S.pages.filter((p) => p.kind === "ink").length === 2);
t.eq(await page.evaluate(() => document.activeElement.id || document.activeElement.className), "pageTitle", "a new pen page starts on its title");
await page.keyboard.press("Enter");
t.eq(await page.evaluate(() => document.activeElement.className), "inkc", "Enter goes from the title to the page");

// Night: the same strokes in their night colours
await page.evaluate((id) => { location.hash = "#/notes/" + id; }, ink); await page.waitForSelector(".inkrail");
await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(400);
await page.screenshot({ path: "tests/shots/ink-night.png" });
const px = await page.evaluate(() => { const c = document.querySelector(".inkc"), g = c.getContext("2d"), d = g.getImageData(c.width / 2, c.height - 20, 1, 1).data; return d[0]; });
if (px > 80) t.fail("the page isn't dark at night: " + px);
await t.end();
