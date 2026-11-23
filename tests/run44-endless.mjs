// Pen pages as endless canvases, like a OneNote page: no sheet edge, the paper fills the view wherever you are, the
// page runs on to the right and downward from its top-left corner (never left of it or above it), the wheel, Shift+wheel,
// Space+drag, the middle button and touch move the view, Ctrl+wheel zooms at the pointer, 0 goes home, each page keeps
// its view; the paper menu (None, Ruled, Grid; old dots pages keep dots), new pages on the paper last picked; the
// Text tool shows itself; snip and the picture for Claude reach past the old sheet's width; and the phone.
import { start, state } from "./lib.mjs";
import { PAPER_MENU, ZOOM } from "../src/ink.js";

const t = await start("run44-endless", 4364, { channel: "beta" });
t.eq(PAPER_MENU.map(([id, label, key]) => [id, label, key]), [["blank", "None", "1"], ["lined", "Ruled", "2"], ["grid", "Grid", "3"]], "the paper menu offers None, Ruled, Grid");
t.eq(ZOOM, [0.25, 4], "zoom runs from 25% to 400%");

const page = await t.page({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] }, "#/notes");
await page.waitForSelector("body[data-ready]");
await page.evaluate(() => bonsai.isles?.setActive?.(false));
const I = (fn, arg) => page.evaluate(fn, arg);
const demo = await I(async () => { const p = bonsai.S.pages.find((x) => x.kind === "ink"); return { id: p.id, ink: (await bonsai.store.listPages()).find((x) => x.id === p.id).ink }; });
await I((id) => { location.hash = "#/notes/" + id; }, demo.id);
await page.waitForSelector(".inkrail"); await page.waitForTimeout(500);
const view = () => I(() => { const v = bonsai.S.ed.ink.view; return [Math.round(v.sx * 10) / 10, Math.round(v.sy * 10) / 10, Math.round(v.zoom * 1000) / 1000]; });
const setView = (v) => I((v) => bonsai.S.ed.ink.setView(v), v);
const n = () => I(() => bonsai.S.ed.ink.doc.strokes.length);
const at = (x, y) => I(([x, y]) => bonsai.S.ed.ink.toScreen(x, y), [x, y]);
const run = (evs) => I((evs) => {
  const ink = bonsai.S.ed.ink, c = document.querySelector(".inkc"), pts = evs.map(([, , x, y, ex = {}]) => (ex.screen ? [x, y] : ink.toScreen(x, y)));
  for (const [j, [type, kind, , , ex = {}]] of evs.entries()) {
    const [cx, cy] = pts[j], up = type === "pointerup";
    c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: ex.id ?? (kind === "touch" ? 20 : kind === "pen" ? 3 : 1), pointerType: kind, clientX: cx, clientY: cy,
      buttons: ex.buttons ?? (up ? 0 : 1), button: type === "pointermove" ? -1 : ex.button ?? 0, pressure: up ? 0 : 0.5, width: 1, height: 1, isPrimary: true }));
  }
}, evs);
const stroke = (kind, pts, ex = {}) => [["pointerdown", kind, ...pts[0], ex], ...pts.slice(1).map((p) => ["pointermove", kind, ...p, ex]), ["pointerup", kind, ...pts.at(-1), ex]];
const quiet = () => page.waitForTimeout(450);
const mid = await page.$eval(".inkwrap", (w) => { const r = w.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
// the canvas's colour at a page point (red channel, darkest within a pixel either way)
const shade = (x, y) => I(([x, y]) => {
  const c = document.querySelector(".inkc"), r = c.getBoundingClientRect(), [sx, sy] = bonsai.S.ed.ink.toScreen(x, y), d = devicePixelRatio;
  const px = Math.round((sx - r.left) * d), py = Math.round((sy - r.top) * d), img = c.getContext("2d").getImageData(px - 1, py - 1, 3, 3).data;
  let m = 255; for (let i = 0; i < img.length; i += 4) m = Math.min(m, img[i]); return m;
}, [x, y]);

// ---- old pages keep their ink where it was, and open at the top left at 100%
t.eq(await view(), [0, 0, 1], "a page opens at its top left at 100%");
t.eq(await I(() => bonsai.S.ed.ink.doc.strokes.map((s) => s.p)), demo.ink.strokes.map((s) => s.p), "an old page's strokes are where they were");
const s0 = demo.ink.strokes[0].p;
if (!((await shade(s0[0], s0[1])) < 120)) t.fail("the old page's first stroke isn't drawn where it lies");
const o = await I(() => { const r = document.querySelector(".inkc").getBoundingClientRect(); return [bonsai.S.ed.ink.toScreen(0, 0), [r.left, r.top]]; });
t.eq(o[0], o[1], "the page's start is the view's top-left corner");
t.eq(await I(() => getComputedStyle(document.querySelector(".inkrail")).position !== "absolute" && Math.round(innerWidth - document.querySelector(".inkrail").getBoundingClientRect().right)), 0, "the rail stays docked right");

// ---- the paper fills the whole view, ruled lines run its full width, no sheet edge
const W0 = await page.$eval(".inkwrap", (w) => w.clientWidth);
if (!((await shade(W0 - 4, 36 * 5)) < 247)) t.fail("a ruled line doesn't reach the view's right edge");
if (!((await shade(W0 - 4, 36 * 5 + 18)) > 247)) t.fail("the paper between the lines isn't plain");
await page.screenshot({ path: "tests/shots/endless-ruled.png" });

// ---- the wheel scrolls down and up, Shift+wheel and a sideways scroll go across, never past the start
await page.mouse.move(...mid);
await page.mouse.wheel(0, 300); await page.waitForTimeout(150);
t.eq(await view(), [0, 300, 1], "the wheel scrolls down");
await page.keyboard.down("Shift"); await page.mouse.wheel(0, 200); await page.keyboard.up("Shift"); await page.waitForTimeout(150);
t.eq(await view(), [200, 300, 1], "Shift+wheel goes sideways");
await page.mouse.wheel(150, 0); await page.waitForTimeout(150);
t.eq(await view(), [350, 300, 1], "a sideways scroll goes across");
await page.mouse.wheel(-2000, -2000); await page.waitForTimeout(150);
t.eq(await view(), [0, 0, 1], "nothing above or left of the start");
await setView({ sx: -500, sy: -300 });
t.eq(await view(), [0, 0, 1], "the view can't be put before the start");

// ---- Ctrl+wheel zooms round the pointer, within 25%–400%
await setView({ sx: 600, sy: 800, zoom: 1 });
const under = async () => I(([x, y]) => { const r = document.querySelector(".inkc").getBoundingClientRect(), v = bonsai.S.ed.ink.view; return [(x - r.left) / v.scale + v.sx, (y - r.top) / v.scale + v.sy]; }, mid);
const u0 = await under();
await page.keyboard.down("Control"); await page.mouse.wheel(0, -200); await page.keyboard.up("Control"); await page.waitForTimeout(150);
const z1 = (await view())[2], u1 = await under();
if (!(z1 > 1.2)) t.fail("Ctrl+wheel doesn't zoom in: " + z1);
if (Math.hypot(u1[0] - u0[0], u1[1] - u0[1]) > 1) t.fail(`the point under the pointer moved while zooming: ${u0} → ${u1}`);
await page.keyboard.down("Control"); for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -600); await page.keyboard.up("Control"); await page.waitForTimeout(150);
t.eq((await view())[2], 4, "zoom stops at 400%");
await setView({ zoom: 0.01 });
t.eq((await view())[2], 0.25, "and at 25%");

// ---- 0 goes back to the top left at 100%
await page.keyboard.press("0");
t.eq(await view(), [0, 0, 1], "0 goes back to the top left at 100%");

// ---- Space+drag and the middle button move the view, and draw nothing
await I(() => bonsai.S.ed.ink.focus());
await setView({ sx: 400, sy: 400 });
let c0 = await n();
await page.keyboard.down("Space");
t.eq([await I(() => document.querySelector(".inkwrap").dataset.pan), await I(() => getComputedStyle(document.querySelector(".inkc")).cursor)], ["ready", "grab"], "holding Space shows a hand");
await page.mouse.move(...mid); await page.mouse.down(); await page.mouse.move(mid[0] - 150, mid[1] - 100, { steps: 5 }); await page.mouse.up();
await page.keyboard.up("Space");
t.eq([await view(), await n()], [[550, 500, 1], c0], "Space+drag pans with the mouse");
await page.keyboard.down("Space");
await run(stroke("pen", [[700, 700], [650, 650], [600, 600]]));
await page.keyboard.up("Space");
t.eq([await view(), await n()], [[650, 600, 1], c0], "and with the pen");
await quiet();
await page.mouse.move(...mid); await page.mouse.down({ button: "middle" }); await page.mouse.move(mid[0] + 100, mid[1] + 50, { steps: 5 }); await page.mouse.up({ button: "middle" });
t.eq([await view(), await n()], [[550, 550, 1], c0], "the middle button pans");
t.eq(await I(() => document.querySelector(".inkwrap").dataset.pan ?? null), null, "the hand goes when Space is let go");
await page.mouse.move(...mid); await page.mouse.down(); await page.mouse.move(mid[0] + 80, mid[1] + 20, { steps: 4 }); await page.mouse.up();
t.eq(await n(), c0 + 1, "without Space the mouse draws again");
await page.keyboard.press("Control+z");

// ---- touch: one finger pans either way, two fingers pinch
await quiet();
await run(stroke("touch", [[800, 800], [780, 790], [700, 750], [600, 700]], { id: 41 }));
const tv = await view();
if (!(tv[0] > 550 + 150 && tv[1] > 550 + 80)) t.fail("a finger doesn't pan across and down: " + tv);
{
  const v = await I(() => bonsai.S.ed.ink.view), m = [mid[0], mid[1]];
  await run([["pointerdown", "touch", m[0] - 50, m[1], { id: 51, screen: true }], ["pointerdown", "touch", m[0] + 50, m[1], { id: 52, screen: true }],
    ["pointermove", "touch", m[0] - 70, m[1], { id: 51, screen: true }], ["pointermove", "touch", m[0] + 70, m[1], { id: 52, screen: true }],
    ["pointermove", "touch", m[0] - 150, m[1], { id: 51, screen: true }], ["pointermove", "touch", m[0] + 150, m[1], { id: 52, screen: true }],
    ["pointerup", "touch", m[0] - 150, m[1], { id: 51, screen: true }], ["pointerup", "touch", m[0] + 150, m[1], { id: 52, screen: true }]]);
  if (!((await view())[2] > v.zoom * 1.5)) t.fail("two fingers don't pinch");
}

// ---- far to the right and far down: ink, text boxes, the lasso and pictures all work there
await setView({ sx: 2700, sy: 0, zoom: 1 });
c0 = await n();
await run(stroke("pen", [[3000, 300], [3100, 330], [3200, 310]]));
const far = await I(() => bonsai.S.ed.ink.doc.strokes.at(-1));
t.eq([await n(), Math.round(far.p[0]), Math.round(far.p[1])], [c0 + 1, 3000, 300], "the pen draws at x = 3000");
const items = () => I(() => bonsai.S.ed.ink.doc.items.map((x) => ({ id: x.id, t: x.t, html: x.html, x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.w) })));
await page.mouse.click(...(await at(3050, 400)));
await page.keyboard.type("Far right"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
const fbox = (await items()).at(-1);
t.eq([fbox.t, fbox.html, fbox.x, fbox.y], ["text", "Far right", 3046, 396], "a click far to the right makes a text box there, on the lines");
await I(() => bonsai.S.ed.ink.setTool("lasso"));
await run(stroke("mouse", [[2950, 260], [3400, 260], [3400, 470], [2950, 470], [2950, 262]]));
t.eq((await I(() => bonsai.S.ed.ink.selected)).sort(), [far.id, fbox.id].sort(), "the lasso catches them out there");
await run(stroke("mouse", [[3100, 320], [3150, 340], [3200, 360]]));
t.eq((await items()).find((x) => x.id === fbox.id).x, 3046 + 100, "and moves them");
// dragged far past the start, a pick stops at the page's left edge
await setView({ sx: 2000, sy: 0, zoom: 0.25 });
await run(stroke("mouse", [[3150, 360], [-2000, 360]]));
const lb = await I(() => { const ink = bonsai.S.ed.ink, s = ink.doc.strokes.find((x) => ink.selected.includes(x.id)), it = ink.doc.items.find((x) => ink.selected.includes(x.id)); let m = Infinity; for (let i = 0; i < s.p.length; i += 3) m = Math.min(m, s.p[i] - s.p[i + 2] / 2); return [Math.round(Math.min(m, it.x) * 10) / 10]; });
t.eq(lb, [0], "a pick dragged left stops at the start");
await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z"); await page.keyboard.press("Escape");
await I(() => bonsai.S.ed.ink.setTool("pen"));
t.eq((await items()).find((x) => x.id === fbox.id).x, 3046, "undo puts it back far right");
// far down
await setView({ sx: 0, sy: 5000, zoom: 1 });
await run(stroke("pen", [[200, 5200], [400, 5230]]));
t.eq(await I(() => Math.round(bonsai.S.ed.ink.doc.strokes.at(-1).p[1])), 5200, "the pen draws far down");
await page.mouse.click(...(await at(220, 5300)));
await page.keyboard.type("Far down"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
t.eq([(await items()).at(-1).html, (await items()).at(-1).y], ["Far down", 5292], "a text box far down");
// a picture pasted while looking far right lands there
await setView({ sx: 2700, sy: 0, zoom: 1 });
await I(async () => {
  const c = document.createElement("canvas"); c.width = 300; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#2f6b45"; g.fillRect(0, 0, 300, 200);
  const blob = await new Promise((r) => c.toBlob(r, "image/png")), dt = new DataTransfer(); dt.items.add(new File([blob], "x.png", { type: "image/png" }));
  document.querySelector(".inkc").focus(); document.querySelector(".inkc").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForFunction(() => bonsai.S.ed.ink.doc.items.some((x) => x.t === "img"));
if (!((await items()).find((x) => x.t === "img").x > 2700)) t.fail("a picture pasted far right isn't placed in view");
await page.keyboard.press("Escape");

// ---- nothing can be drawn left of the start or above it
await setView({ sx: 0, sy: 0, zoom: 1 });
const r0 = await I(() => { const r = document.querySelector(".inkc").getBoundingClientRect(); return [r.left, r.top]; });
await run(stroke("pen", [[r0[0] - 60, r0[1] - 40], [r0[0] + 60, r0[1] + 30], [r0[0] + 120, r0[1] + 60]], { screen: true }));
const edge = await I(() => { const p = bonsai.S.ed.ink.doc.strokes.at(-1).p; let x = Infinity, y = Infinity; for (let i = 0; i < p.length; i += 3) { x = Math.min(x, p[i]); y = Math.min(y, p[i + 1]); } return [x, y]; });
t.eq(edge, [0, 0], "a stroke started off the page's start is held to it");
await page.keyboard.press("Control+z");

// ---- the picture for Claude and snip reach past x = 1000
const pic = await I(async () => {
  const ink = bonsai.S.ed.ink, b = ink.bounds, p = ink.picture();
  const m = new Image(); m.src = "data:image/png;base64," + p.data; await m.decode();
  const c = document.createElement("canvas"); c.width = m.width; c.height = m.height; const g = c.getContext("2d"); g.drawImage(m, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; let right = 0;
  for (let y = 0; y < c.height; y++) for (let x = Math.floor(c.width * 0.85); x < c.width; x++) if (d[(y * c.width + x) * 4] < 120) right++;
  return { b: [Math.round(b.x1), Math.round(b.y1)], ratio: Math.round((m.width / m.height) / ((b.x1 - b.x0 + 48) / (b.y1 - b.y0 + 48)) * 100), right };
});
if (!(pic.b[0] > 3200 && pic.b[1] > 5200)) t.fail("the page's bounds miss what's far out: " + pic.b);
t.eq(pic.ratio, 100, "the picture for Claude covers the content's real bounds");
if (!(pic.right > 50)) t.fail("the picture for Claude leaves out what's far right: " + pic.right);
await setView({ sx: 2800, sy: 200, zoom: 1 });
await page.keyboard.press("Shift+S");
await run(stroke("mouse", [[2950, 260], [3300, 360], [3420, 470]]));
await page.waitForFunction(() => bonsai.S.ed.ink.snip?.copied != null);
const snip = await I(async () => { const s = bonsai.S.ed.ink.snip, m = document.querySelector(".inksnip img"), i = new Image(); i.src = m.src; await i.decode();
  const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 120) dark++; return [s.width >= 470 * 2, dark > 100]; });
t.eq(snip, [true, true], "a snip far right holds what's there");
await page.keyboard.press("Escape");

// ---- the Text tool shows itself: on on the rail, an I-beam over the paper, the boxes' edges
await page.keyboard.press("a");
t.eq(await I(() => { const b = document.querySelector("#ink-textbox"), c = document.querySelector(".inkc"), x = document.querySelector(".inktext"); return [b.classList.contains("on"), b.getAttribute("aria-pressed"), getComputedStyle(c).cursor, getComputedStyle(x, "::before").content !== "none"]; }),
  [true, "true", "text", true], "with the Text tool on, the rail shows it, the paper gives an I-beam and the boxes show their edges");
await page.screenshot({ path: "tests/shots/endless-text.png" });
await page.keyboard.press("p");
t.eq(await I(() => [getComputedStyle(document.querySelector(".inkc")).cursor, getComputedStyle(document.querySelector(".inktext"), "::before").content]), ["crosshair", "none"], "and not with the pen");

// ---- a page keeps its view, across pages and a reload
await setView({ sx: 1234, sy: 2345, zoom: 1.5 });
await page.waitForTimeout(500);
const other = await I(() => bonsai.S.pages.find((p) => p.kind !== "ink" && p.kind !== "folder").id);
await I((id) => { location.hash = "#/notes/" + id; }, other); await page.waitForSelector(".inkrail", { state: "detached" });
await I((id) => { location.hash = "#/notes/" + id; }, demo.id); await page.waitForSelector(".inkrail"); await page.waitForTimeout(300);
t.eq(await view(), [1234, 2345, 1.5], "a page opens where it was left");
await page.waitForTimeout(900);
await page.reload(); await page.waitForSelector(".inkrail"); await page.waitForTimeout(400);
t.eq(await view(), [1234, 2345, 1.5], "and after a reload");
t.eq(await I(() => [bonsai.S.ed.ink.doc.strokes.some((s) => s.p[0] >= 3000), bonsai.S.ed.ink.doc.items.some((x) => x.html === "Far right" && x.x === 3046)]), [true, true], "what's far out is saved");

// ---- a wide view of it all
await setView({ sx: 0, sy: 0, zoom: 0.25 });
await page.waitForTimeout(300);
await page.screenshot({ path: "tests/shots/endless-wide.png" });
await page.keyboard.press("0");

// ---- the paper menu: None 1, Ruled 2, Grid 3, the page's own marked; B toggles it
const rows = () => page.$$eval(".inkpm .iprow", (r) => r.map((x) => [x.querySelector(".ipl").textContent, x.querySelector("kbd")?.textContent || "", x.classList.contains("on"), x.getAttribute("aria-checked")]));
await page.click("#ink-paper");
t.eq(await page.isVisible(".inkpm"), true, "the rail's paper button opens the menu");
t.eq(await rows(), [["None", "1", false, "false"], ["Ruled", "2", true, "true"], ["Grid", "3", false, "false"]], "it shows None, Ruled, Grid with their keys, the current one marked");
t.eq(await I(() => document.querySelector("#ink-paper").getAttribute("aria-expanded")), "true", "the button says it's open");
await page.screenshot({ path: "tests/shots/endless-menu.png" });
await page.keyboard.press("b");
t.eq(await page.isVisible(".inkpm"), false, "B closes it");
await page.keyboard.press("b"); await page.keyboard.press("1");
t.eq([await I(() => bonsai.S.ed.ink.doc.paper), await page.isVisible(".inkpm")], ["blank", false], "B then 1: no ruling");
if (!((await shade(W0 - 4, 36 * 5)) > 247)) t.fail("plain paper still shows lines");
await page.screenshot({ path: "tests/shots/endless-none.png" });
await page.keyboard.press("b"); await page.keyboard.press("3");
t.eq(await I(() => bonsai.S.ed.ink.doc.paper), "grid", "B then 3: a grid");
await setView({ sx: 4000, sy: 3000 });
if (!((await shade(36 * 120, 3050)) < 247 && (await shade(36 * 120 + 18, 36 * 84 + 18)) > 247)) t.fail("the grid doesn't run on far out");
await page.keyboard.press("0");
await page.screenshot({ path: "tests/shots/endless-grid.png" });
await page.click("#ink-paper"); await page.click('.inkpm .iprow[data-paper="lined"]');
t.eq(await I(() => bonsai.S.ed.ink.doc.paper), "lined", "a click on Ruled picks it");
await page.keyboard.press("Escape");

// ---- an old page on dots keeps its dots, shown marked in the menu; dots isn't offered otherwise
const dots = await I(async () => { const p = await bonsai.store.addPage({ title: "Dotted", kind: "ink" }); await bonsai.store.updatePage(p.id, { ink: { paper: "dots", strokes: [{ id: "z", t: "pen", c: 0, p: [100, 100, 3, 300, 120, 3] }] } }); await bonsai.refresh?.(); return p.id; });
await page.reload(); await page.waitForSelector("body[data-ready]");
await I((id) => { location.hash = "#/notes/" + id; }, dots); await page.waitForFunction(() => bonsai.S.ed?.ink?.doc.paper === "dots"); await page.waitForTimeout(400);
if (!((await shade(36 * 8, 36 * 8)) < 247 && (await shade(36 * 8 + 18, 36 * 8)) > 247)) t.fail("a dots page doesn't show dots");
await page.keyboard.press("b");
t.eq(await rows(), [["None", "1", false, "false"], ["Ruled", "2", false, "false"], ["Grid", "3", false, "false"], ["Dots", "", true, "true"]], "a dots page shows Dots, marked");
await page.keyboard.press("2");
await page.keyboard.press("b");
t.eq((await rows()).map((r) => r[0]), ["None", "Ruled", "Grid"], "once changed, dots isn't offered");
await page.keyboard.press("3");   // the last picked: grid

// ---- a new pen page starts on the paper last picked
await page.keyboard.press("w");
await page.waitForFunction((n) => bonsai.S.pages.filter((p) => p.kind === "ink").length === n, 3);
await page.keyboard.press("Enter"); await page.waitForTimeout(300);
const fresh = await I(async () => { const id = bonsai.S.npage; return [bonsai.S.ed.ink.doc.paper, (await bonsai.store.listPages()).find((p) => p.id === id).ink?.paper]; });
t.eq(fresh, ["grid", "grid"], "a new pen page starts on the grid, the paper last picked");
await page.keyboard.press("b"); await page.keyboard.press("1");
await page.keyboard.press("w");
await page.waitForFunction((n) => bonsai.S.pages.filter((p) => p.kind === "ink").length === n, 4);
await page.keyboard.press("Enter"); await page.waitForTimeout(300);
t.eq(await I(() => bonsai.S.ed.ink.doc.paper), "blank", "and then on none");
t.eq(await I(async () => { const { lastPaper } = await import("./ink.js"); return lastPaper("nothing-kept-here"); }), "lined", "with nothing picked yet a new page is ruled");

// ---- the phone: the same canvas, two fingers pan and pinch
const phone = await t.page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "#/notes");
await phone.waitForSelector("body[data-ready]");
const pid = await phone.evaluate(() => bonsai.S.pages.find((p) => p.kind === "ink").id);
await phone.evaluate((id) => { location.hash = "#/notes/" + id; }, pid);
await phone.waitForSelector(".inkrail"); await phone.waitForTimeout(500);
const pv = () => phone.evaluate(() => { const v = bonsai.S.ed.ink.view; return [Math.round(v.sx), Math.round(v.sy), Math.round(v.zoom * 100) / 100]; });
t.eq(await pv(), [0, 0, 1], "on the phone too a page opens at its top left at 100%");
const pr = await phone.$eval(".inkwrap", (w) => { const r = w.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, Math.round(innerWidth - document.querySelector(".inkrail").getBoundingClientRect().right)]; });
t.eq(pr[2], 0, "the rail is docked right on the phone");
const two = (a, b, id = 70) => phone.evaluate(([a, b, id]) => {
  const c = document.querySelector(".inkc"), ev = (type, i, [x, y]) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id + i, pointerType: "touch", clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1, width: 8, height: 8, isPrimary: !i }));
  a.forEach((p, k) => { ev(k ? "pointermove" : "pointerdown", 0, p); ev(k ? "pointermove" : "pointerdown", 1, b[k]); });
  ev("pointerup", 0, a.at(-1)); ev("pointerup", 1, b.at(-1));
}, [a, b, id]);
const [px, py] = pr;
const c1 = await phone.evaluate(() => bonsai.S.ed.ink.doc.strokes.length);
await two([[px - 40, py], [px - 50, py - 10], [px - 140, py - 160]], [[px + 40, py], [px + 30, py - 10], [px - 60, py - 160]]);
const pv1 = await pv();
if (!(pv1[0] > 60 && pv1[1] > 100)) t.fail("two fingers don't pan the phone's page: " + pv1);
t.eq(await phone.evaluate(() => bonsai.S.ed.ink.doc.strokes.length), c1, "and draw nothing");
await two([[px - 30, py], [px - 40, py], [px - 120, py]], [[px + 30, py], [px + 40, py], [px + 120, py]], 80);
if (!((await pv())[2] > 1.5)) t.fail("two fingers don't pinch on the phone");
await phone.click("#sideHide"); await phone.waitForTimeout(300);
t.eq(await phone.$eval(".inkrail", (r) => r.getBoundingClientRect().width <= 60), true, "the phone keeps the rail narrow");
await phone.evaluate(() => bonsai.S.ed.ink.setView({ sx: 0, sy: 0, zoom: 0.6 })); await phone.waitForTimeout(300);
await phone.screenshot({ path: "tests/shots/endless-phone.png" });
await t.end();
