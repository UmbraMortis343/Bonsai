// Pen pages as canvases: the pen always draws (the pointer cases that lost strokes), touch pans reliably next to a
// hovering pen, a click makes a text box, pastes become pictures or text, a box over the page becomes a picture on
// the clipboard, and the pencil, marker and more colours.
import { start, state } from "./lib.mjs";
import { inkColour, isHex, widthFor, caughtBox } from "../src/ink.js";

const t = await start("run39-canvas", 4339, { channel: "beta" });

// ---- pure parts
t.eq(inkColour({ t: "pen", c: "#b5483e" }, true), "#b5483e", "a fixed colour is the same at night");
t.eq([inkColour({ t: "pen", c: 1 }, false), inkColour({ t: "pen", c: 1 }, true)], ["#3d6a37", "#93c383"], "an old stroke's colour role still reads per theme");
if (isHex(2) || !isHex("#00ff00")) t.fail("isHex");
t.eq(widthFor(5, { pointerType: "pen", pressure: 1 }, "marker"), 5, "the marker keeps one width");
if (!(widthFor(2, { pointerType: "pen", pressure: 1 }, "pencil") > widthFor(2, { pointerType: "pen", pressure: 0.1 }, "pencil") * 1.5)) t.fail("the pencil follows pressure");
if (!caughtBox([0, 0, 100, 0, 100, 100, 0, 100], { x0: 10, y0: 10, x1: 60, y1: 60 }) || caughtBox([0, 0, 30, 0, 30, 30, 0, 30], { x0: 10, y0: 10, x1: 90, y1: 90 })) t.fail("caughtBox");

const page = await t.page({ viewport: { width: 1280, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true }, "#/notes");
await page.waitForSelector("body[data-ready]");
t.eq(await page.evaluate(async () => { const { cleanText } = await import("./ink.js"); return [cleanText('<b>a</b><span style="x">b</span><script>x</script><img src=x onerror=alert(1)><div>c</div><div><br></div>'), cleanText("<strong>x</strong><em>y</em>")]; }), ["<b>a</b>bx<div>c</div>", "<b>x</b><i>y</i>"], "a text box keeps only b, i, u and lines");
const ink = await state(page, () => bonsai.S.pages.find((p) => p.kind === "ink").id);
await page.evaluate((id) => { location.hash = "#/notes/" + id; }, ink);
await page.waitForSelector(".inkrail"); await page.waitForTimeout(500);
await page.evaluate(() => bonsai.isles?.setActive?.(false));
const I = (fn, arg) => page.evaluate(fn, arg);
const n = () => I(() => bonsai.S.ed.ink.doc.strokes.length);
const sy = () => I(() => bonsai.S.ed.ink.view.sy);
const at = (x, y) => I(([x, y]) => bonsai.S.ed.ink.toScreen(x, y), [x, y]);
// Fire a run of pointer events in one go, as one device would: [type, kind, pageX, pageY, extra]
const run = (evs, target) => I(([evs, target]) => {
  const ink = bonsai.S.ed.ink, def = target ? document.querySelector(target) : document.querySelector(".inkc");
  const pts = evs.map(([, , x, y]) => ink.toScreen(x, y));   // where the fingers are on the screen, whatever the view does
  for (const [j, [type, kind, , , ex = {}]] of evs.entries()) {
    const [cx, cy] = pts[j], up = type === "pointerup" || type === "pointercancel";
    const on = ex.on === "body" ? document.body : ex.on ? document.querySelector(ex.on) : def;
    on.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: ex.id ?? (kind === "touch" ? 20 : kind === "pen" ? 3 : 1), pointerType: kind, clientX: cx, clientY: cy,
      buttons: ex.buttons ?? (up ? 0 : 1), button: type === "pointermove" ? -1 : ex.button ?? 0, pressure: ex.pressure ?? (up ? 0 : 0.5), width: ex.w ?? 1, height: ex.w ?? 1, isPrimary: true }));
  }
}, [evs, target]);
const stroke = (kind, pts, ex = {}) => [["pointerdown", kind, ...pts[0], ex], ...pts.slice(1).map((p) => ["pointermove", kind, ...p, ex]), ["pointerup", kind, ...pts.at(-1), ex]];
const quiet = () => page.waitForTimeout(450);   // past the moment after a pen lifts when touch is ignored

// ---- 1. the pen always draws
await I(() => { bonsai.S.ed.ink.setTool("pen"); });
let c0 = await n();
await run(stroke("pen", [[150, 1000], [200, 1010], [260, 1000]], { pressure: 0 }));
t.eq(await n(), c0 + 1, "a pen whose first contact reads no pressure still draws");
c0 = await n();
await run([["pointerdown", "pen", 150, 1050], ["pointermove", "pen", 250, 1050]]);   // its lift is lost
await run(stroke("pen", [[150, 1090], [250, 1090]]));
t.eq(await n(), c0 + 2, "a pen down after a lift that never came keeps the old stroke and draws the new one");
c0 = await n();
await run([["pointerdown", "pen", 150, 1130], ["pointermove", "pen", 250, 1130], ["pointerup", "pen", 250, 1130, { on: "body" }]]);
t.eq(await n(), c0 + 1, "a pen lifting off the page still ends its stroke");
c0 = await n();
await run([["pointerdown", "pen", 150, 1170], ["pointermove", "pen", 250, 1170], ["pointermove", "pen", 260, 1150, { buttons: 0, pressure: 0 }]]);
t.eq(await I(() => [bonsai.S.ed.ink.doc.strokes.length]), [c0 + 1], "a pen hovering again ends a stroke whose lift was lost");
c0 = await n();
await run([["pointerdown", "pen", 150, 1210], ["pointermove", "pen", 200, 1210], ["pointerup", "mouse", 200, 1210, { id: 1 }], ["pointerup", "touch", 200, 1210, { id: 99 }], ["pointermove", "pen", 300, 1210], ["pointerup", "pen", 300, 1210]]);
const last = await I(() => bonsai.S.ed.ink.doc.strokes.at(-1).p);
if ((await n()) !== c0 + 1 || last[last.length - 3] < 290) t.fail("another pointer lifting cuts the pen's stroke short");
c0 = await n();
await run([["pointermove", "pen", 150, 1250, { pressure: 0.4 }], ["pointermove", "pen", 260, 1250, { pressure: 0.4 }], ["pointerup", "pen", 260, 1250]]);
t.eq(await n(), c0 + 1, "a pen pressing on the page whose down never came still draws");
c0 = await n();
await run([["pointerdown", "pen", 150, 1290], ["pointermove", "pen", 250, 1290], ["pointercancel", "pen", 250, 1290]]);
t.eq(await n(), c0 + 1, "a cancelled pen keeps what it drew");
c0 = await n();
await I(() => { bonsai.S.ed.ink.redraw(); });
{ // touch draws on: a palm lands first and starts a stroke, then the pen comes down: the pen draws, the palm's line goes
  await page.keyboard.press("t"); await quiet();
  await run([["pointerdown", "touch", 500, 1330, { id: 31 }], ["pointermove", "touch", 520, 1340, { id: 31 }], ...stroke("pen", [[150, 1330], [260, 1330]]), ["pointerup", "touch", 520, 1340, { id: 31 }]]);
  const got = await I(() => bonsai.S.ed.ink.doc.strokes.slice(-1)[0].p[0]);
  t.eq([await n(), Math.round(got)], [c0 + 1, 150], "a palm drawing by touch gives way to the pen");
  await page.keyboard.press("t");
}
t.eq(await I(() => ["inkc", "inkitems"].map((c) => getComputedStyle(document.querySelector("." + c)).touchAction)), ["none", "none"], "nothing on the page leaves touch to the browser");
t.eq(await I(() => bonsai.S.ed.ink.log.length > 10), true, "pointer events are logged for checking a device");

// ---- 2. touch pans
for (let i = 0; i < 4; i++) await page.keyboard.press("PageUp");
await quiet();
let y0 = await sy();
{ // the pen hovering near while a finger pans
  const evs = [["pointermove", "pen", 600, 900, { buttons: 0, pressure: 0 }], ["pointerdown", "touch", 300, 900, { id: 41 }]];
  for (let i = 1; i <= 8; i++) evs.push(["pointermove", "pen", 600, 900 + i, { buttons: 0, pressure: 0 }], ["pointermove", "touch", 300, 900 - i * 20, { id: 41 }]);
  evs.push(["pointerup", "touch", 300, 740, { id: 41 }]);
  await run(evs);
}
if (!((await sy()) > y0 + 50)) t.fail(`a finger doesn't pan while the pen hovers: ${y0} → ${await sy()}`);
await quiet(); y0 = await sy();
await run(stroke("touch", [[300, 900], [300, 850], [300, 700]], { w: 40, id: 42 }));
if (!((await sy()) > y0 + 50)) t.fail("a thumb-sized contact doesn't pan");
y0 = await sy();
await run(stroke("touch", [[300, 900], [300, 850], [300, 700]], { w: 64, id: 43 }));
t.eq(await sy(), y0, "a palm-sized contact doesn't pan");
{ // a finger whose lift never reached the page, then one finger: it pans, it doesn't pinch
  await run([["pointerdown", "touch", 300, 900, { id: 44 }], ["pointermove", "touch", 300, 880, { id: 44 }], ["pointerup", "touch", 300, 880, { id: 44, on: "body" }]]);
  y0 = await sy(); const z0 = await I(() => bonsai.S.ed.ink.zoom);
  await run(stroke("touch", [[500, 900], [500, 860], [500, 760]], { id: 45 }));
  if (!((await sy()) > y0 + 40) || (await I(() => bonsai.S.ed.ink.zoom)) !== z0) t.fail("a lost finger lingers and turns the next pan into a pinch");
}
{ // just after the pen lifts a touch is a palm; a moment later it pans
  y0 = await sy();
  await run([...stroke("pen", [[150, 1370], [200, 1370]]), ...stroke("touch", [[300, 900], [300, 850], [300, 700]], { id: 46 })]);
  t.eq(await sy(), y0, "a touch right after the pen lifts is ignored");
  await page.keyboard.press("Control+z");
  for (let i = 0; i < 4; i++) await page.keyboard.press("PageUp");
  await quiet(); y0 = await sy();
  await run(stroke("touch", [[300, 900], [300, 850], [300, 700]], { id: 47 }));
  if (!((await sy()) > y0 + 50)) t.fail("touch doesn't pan once the pen has lifted");
}
{ // two fingers pinch
  const z0 = await I(() => bonsai.S.ed.ink.zoom);
  await run([["pointerdown", "touch", 400, 800, { id: 51 }], ["pointerdown", "touch", 500, 800, { id: 52 }], ["pointermove", "touch", 380, 800, { id: 51 }], ["pointermove", "touch", 520, 800, { id: 52 }],
    ["pointermove", "touch", 300, 800, { id: 51 }], ["pointermove", "touch", 600, 800, { id: 52 }], ["pointerup", "touch", 300, 800, { id: 51 }], ["pointerup", "touch", 600, 800, { id: 52 }]]);
  if (!((await I(() => bonsai.S.ed.ink.zoom)) > z0 * 1.5)) t.fail("two fingers don't pinch");
  await page.keyboard.press("0");
}
{ // touch draws on: two fingers landing together pan, they don't draw
  await page.keyboard.press("t"); c0 = await n(); y0 = await sy();
  await run([["pointerdown", "touch", 300, 900, { id: 61 }], ["pointerdown", "touch", 400, 900, { id: 62 }], ["pointermove", "touch", 300, 880, { id: 61 }], ["pointermove", "touch", 400, 880, { id: 62 }],
    ["pointermove", "touch", 300, 760, { id: 61 }], ["pointermove", "touch", 400, 760, { id: 62 }], ["pointerup", "touch", 300, 760, { id: 61 }], ["pointerup", "touch", 400, 760, { id: 62 }]]);
  t.eq(await n(), c0, "two fingers don't draw when touch draws");
  if (!((await sy()) > y0 + 40)) t.fail("two fingers don't pan when touch draws");
  await page.keyboard.press("t");
}

// ---- 3. a canvas: text boxes, pictures, pastes
await page.keyboard.press("PageUp"); await page.keyboard.press("PageUp"); await page.keyboard.press("PageUp");
await page.evaluate(() => { bonsai.S.ed.ink.setTool("pen"); });
const items = () => I(() => bonsai.S.ed.ink.doc.items.map((x) => ({ t: x.t, html: x.html, x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.w) })));
const i0 = (await items()).length;
await page.mouse.click(...(await at(560, 340)));
if (!(await I(() => bonsai.S.ed.ink.editing))) t.fail("a click on the paper doesn't open a text box");
await page.keyboard.type("Momentum is conserved");
await page.keyboard.press("Control+b"); await page.keyboard.type(" always");
await page.keyboard.press("Escape");
let its = await items();
t.eq([its.length, its.at(-1).t, its.at(-1).html, its.at(-1).y % 36], [i0 + 1, "text", "Momentum is conserved<b> always</b>", 0], "typing goes in a box that sits on the lines");
t.eq(await I(() => bonsai.S.ed.ink.selected.length), 1, "Esc leaves the box picked");
await page.keyboard.press("Escape");
await page.keyboard.press("Control+z");
t.eq((await items()).length, i0, "undo takes the box back");
await page.keyboard.press("Control+y");
t.eq((await items()).length, i0 + 1, "redo brings it back");
const box = await I(() => bonsai.S.ed.ink.doc.items.at(-1).id);
// a click on it opens it again; a mouse drag over it draws
await page.mouse.click(...(await at(600, 355)));
t.eq(await I(() => bonsai.S.ed.ink.editing), box, "a click on a box opens it");
await page.keyboard.press("End"); await page.keyboard.type("!");
await page.mouse.click(...(await at(500, 620)));   // ends the typing, opens nothing new
t.eq([await I(() => bonsai.S.ed.ink.editing), (await items()).length, (await items()).at(-1).html.endsWith("!</b>")], [null, i0 + 1, true], "a click outside ends the typing");
c0 = await n();
await page.mouse.move(...(await at(540, 330))); await page.mouse.down(); await page.mouse.move(...(await at(760, 380)), { steps: 6 }); await page.mouse.up();
t.eq([await n(), (await items()).length], [c0 + 1, i0 + 1], "a mouse drag draws, over a box too");
await page.keyboard.press("Control+z");
// a pen with the Text tool opens a box; with the pen it writes over a box, even one being typed in
await page.keyboard.press("a");
await run([["pointerdown", "pen", 150, 520], ["pointerup", "pen", 150, 520]]);
if (!(await I(() => bonsai.S.ed.ink.editing))) t.fail("a pen tap with the Text tool doesn't open a box");
await page.keyboard.type("Elastic");
await page.keyboard.press("p");   // typed, not a tool key
t.eq(await I(() => bonsai.S.ed.ink.tool), "text", "keys type into the box rather than changing tools");
c0 = await n();
await run(stroke("pen", [[160, 520], [260, 540]]), ".inktext.edit .itx");
t.eq(await n(), c0, "with the Text tool the pen stays in the box");
await I(() => { document.activeElement.blur(); bonsai.S.ed.ink.setTool("pen"); });
const pbox = await I(() => bonsai.S.ed.ink.doc.items.at(-1).id);
await page.mouse.click(...(await at(170, 535)));
t.eq(await I(() => bonsai.S.ed.ink.editing), pbox, "the box opens again");
await quiet(); c0 = await n();
await run(stroke("pen", [[160, 520], [230, 545], [300, 540]]), ".inktext.edit .itx");
t.eq([await n(), await I(() => bonsai.S.ed.ink.editing)], [c0 + 1, null], "the pen writes over a box being typed in");
await page.keyboard.press("Control+z");
// move a box by its grip, change its width, then lasso it with a stroke, move both, delete, undo
await page.mouse.click(...(await at(600, 355)));
const g = await page.$eval(".inktext.edit .igrip", (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
const s0 = await I(() => bonsai.S.ed.ink.view.scale);
await page.mouse.move(...g); await page.mouse.down(); await page.mouse.move(g[0] - 60 * s0, g[1] + 72 * s0, { steps: 5 }); await page.mouse.up();
its = await items();
t.eq([its.find((x) => x.html.startsWith("Momentum")).x - 556, its.find((x) => x.html.startsWith("Momentum")).y], [-60, 324 + 72], "the grip moves the box");
const hnd = await page.$eval(".ihandle", (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
const w0 = its.find((x) => x.html.startsWith("Momentum")).w;
await page.mouse.move(...hnd); await page.mouse.down(); await page.mouse.move(hnd[0] - 120 * s0, hnd[1], { steps: 4 }); await page.mouse.up();
t.eq((await items()).find((x) => x.html.startsWith("Momentum")).w, w0 - 120, "the handle sets its width");
await page.screenshot({ path: "tests/shots/canvas-text.png" });
await page.keyboard.press("Control+z");
t.eq((await items()).find((x) => x.html.startsWith("Momentum")).w, w0, "a width change undoes");
await page.keyboard.press("Escape");
await run(stroke("pen", [[620, 470], [760, 470]]));
await page.keyboard.press("l");
await run(stroke("mouse", [[580, 380], [1000, 380], [1000, 500], [580, 500], [580, 382]]));
t.eq(await I((box) => { const sel = bonsai.S.ed.ink.selected; return [sel.includes(box), sel.includes(bonsai.S.ed.ink.doc.strokes.at(-1).id)]; }, box), [true, true], "the lasso catches a box and a stroke");
await run(stroke("mouse", [[700, 430], [720, 440], [740, 450]]));
t.eq((await items()).find((x) => x.html.startsWith("Momentum")).x, 556 - 60 + 40, "the box moves with the lasso");
await page.keyboard.press("Delete");
t.eq((await items()).some((x) => x.html.startsWith("Momentum")), false, "Delete takes the box");
await page.keyboard.press("Control+z");
t.eq((await items()).some((x) => x.html.startsWith("Momentum")), true, "and undo brings it back");
await page.keyboard.press("Escape"); await page.keyboard.press("p");

// paste a picture, then text
const pasteImage = (w, h) => I(async ([w, h]) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.fillStyle = "#cfe3c8"; g.fillRect(0, 0, w, h); g.fillStyle = "#2f6b45"; g.fillRect(w * 0.1, h * 0.1, w * 0.3, h * 0.6); g.fillStyle = "#b5483e"; g.beginPath(); g.arc(w * 0.7, h * 0.5, h * 0.25, 0, 7); g.fill();
  const blob = await new Promise((r) => c.toBlob(r, "image/png")), dt = new DataTransfer(); dt.items.add(new File([blob], "shot.png", { type: "image/png" }));
  document.querySelector(".inkc").focus();
  document.querySelector(".inkc").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
}, [w, h]);
await pasteImage(3000, 1500);
await page.waitForFunction(() => bonsai.S.ed.ink.doc.items.some((x) => x.t === "img"));
const img = await I(() => { const it = bonsai.S.ed.ink.doc.items.find((x) => x.t === "img"); return { w: it.w, h: it.h, kind: it.src.slice(5, 15), sel: bonsai.S.ed.ink.selected.includes(it.id) }; });
const dims = await I(() => new Promise((r) => { const m = new Image(); m.onload = () => r([m.naturalWidth, m.naturalHeight]); m.src = bonsai.S.ed.ink.doc.items.find((x) => x.t === "img").src; }));
t.eq([dims, Math.round(img.w / img.h * 100), img.sel], [[2000, 1000], 200, true], "a pasted picture is kept at most 2000 px, in proportion, and picked");
const ih = await page.$eval(".ihandle", (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await page.mouse.move(...ih); await page.mouse.down(); await page.mouse.move(ih[0] - 100 * s0, ih[1], { steps: 4 }); await page.mouse.up();
const img2 = await I(() => { const it = bonsai.S.ed.ink.doc.items.find((x) => x.t === "img"); return [Math.round(it.w), Math.round(it.w / it.h * 100)]; });
t.eq(img2, [Math.round(img.w - 100), 200], "the handle resizes a picture in proportion");
await I(() => { const dt = new DataTransfer(); dt.setData("text/plain", "Pasted line one\nline two"); document.querySelector(".inkc").focus(); document.querySelector(".inkc").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
t.eq((await items()).at(-1).html, "Pasted line one<br>line two", "pasted text becomes a text box");
await page.keyboard.press("Escape");
// draw over the picture, then the picture for Claude holds text and picture too
await run(stroke("pen", [[100, 300], [900, 330]], { pressure: 0.9 }));
await page.waitForTimeout(200);
await page.screenshot({ path: "tests/shots/canvas-page.png" });
const pic = await I(async () => {
  const p = bonsai.S.ed.ink.picture([bonsai.S.ed.ink.doc.items.find((x) => x.html?.startsWith("Momentum")).id]);
  const m = new Image(); m.src = "data:image/png;base64," + p.data; await m.decode();
  const c = document.createElement("canvas"); c.width = m.width; c.height = m.height; const g = c.getContext("2d"); g.drawImage(m, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) dark++;
  return dark;
});
if (!(pic > 200)) t.fail("the picture for Claude leaves out text boxes: " + pic);
// kept, and back after a reload
await page.waitForTimeout(900);
const savedItems = await I(async (id) => (await bonsai.store.listPages()).find((p) => p.id === id).ink.items.map((x) => x.t).sort(), ink);
t.eq(savedItems.filter((x) => x === "img").length, 1, "the picture is saved");
await page.reload(); await page.waitForSelector(".inkrail"); await page.waitForTimeout(600);
t.eq((await items()).some((x) => x.html?.startsWith("Momentum")), true, "text boxes come back after a reload");
t.eq(await page.$$eval(".inktext", (e) => e.length), (await items()).filter((x) => x.t === "text").length, "each text box is on the page");

// ---- 4. a box over the page becomes a picture on the clipboard
await page.keyboard.press("Shift+S");
t.eq(await I(() => bonsai.S.ed.ink.tool), "snip", "⇧S picks the area tool");
await page.keyboard.press("Escape");
t.eq(await I(() => bonsai.S.ed.ink.tool), "pen", "Esc gives it up");
await page.keyboard.press("Shift+S");
await run([["pointerdown", "mouse", 500, 280], ["pointermove", "mouse", 800, 400], ["pointermove", "mouse", 950, 450]]);
await page.keyboard.press("Escape");
await run([["pointerup", "mouse", 950, 450]]);
t.eq(await I(() => [bonsai.S.ed.ink.snip, bonsai.S.ed.ink.tool]), [null, "pen"], "Esc cancels a box being drawn");
await page.keyboard.press("Shift+S");
await run(stroke("mouse", [[520, 300], [800, 400], [1000, 470]]));
await page.waitForFunction(() => bonsai.S.ed.ink.snip?.copied != null);
const snip = await I(() => bonsai.S.ed.ink.snip), sc = await I(() => bonsai.S.ed.ink.view.scale * devicePixelRatio);
t.eq([snip.copied, snip.width >= Math.floor(480 * sc * 2), snip.height >= Math.floor(170 * sc * 2)], [true, true, true], "the area is copied at more than twice the screen's pixels");
const clip = await I(async () => { const [it] = await navigator.clipboard.read(); const b = await it.getType("image/png"); return [it.types, b.size > 1000]; });
t.eq(clip, [["image/png"], true], "the clipboard holds a PNG");
t.eq([await page.textContent("#inkSnipSaid"), await I(() => bonsai.S.ed.ink.tool)], ["Copied", "pen"], "it says so, and the pen comes back");
await page.screenshot({ path: "tests/shots/canvas-snip.png" });
const [dl] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
if (!/\.png$/.test(dl.suggestedFilename())) t.fail("Save doesn't download a PNG: " + dl.suggestedFilename());
await dl.saveAs("tests/shots/canvas-snip-out.png");
t.eq(await page.isVisible(".inksnip"), false, "saving puts the bar away");
await I(() => { navigator.clipboard.write = () => Promise.reject(new Error("refused")); });
await page.keyboard.press("Shift+S");
await run(stroke("mouse", [[520, 300], [700, 400]]));
await page.waitForFunction(() => bonsai.S.ed.ink.snip?.copied === false);
t.eq([await page.textContent("#inkSnipSaid"), await page.isVisible("#inkSnipSave")], ["Not copied", true], "when the clipboard refuses, Save is offered");
await page.keyboard.press("Escape");
t.eq(await page.isVisible(".inksnip"), false, "Esc puts the bar away");

// ---- 5. pencil, marker, more colours
await page.keyboard.press("Shift+P");
await run(stroke("pen", [[100, 700], [200, 690], [300, 720], [400, 700]], { pressure: 0.9 }));
await page.keyboard.press("m");
await run(stroke("pen", [[100, 760], [200, 750], [300, 780], [400, 760]], { pressure: 0.2 }));
const [pc, mk] = await I(() => bonsai.S.ed.ink.doc.strokes.slice(-2).map((s) => ({ t: s.t, ws: [...new Set(s.p.filter((_, i) => i % 3 === 2))] })));
t.eq([pc.t, mk.t, mk.ws.length], ["pencil", "marker", 1], "⇧P draws in pencil, M in marker at one width");
await page.keyboard.press("Shift+C");
t.eq(await page.isVisible(".inkpal"), true, "⇧C opens more colours");
t.eq(await page.$$eval(".inkpal kbd", (k) => k.map((x) => x.textContent)), ["1", "2", "3", "4", "5", "6", "7", "8", "0"], "every colour shows its key");
await page.screenshot({ path: "tests/shots/canvas-colours.png" });
await page.keyboard.press("2");
t.eq([await page.isVisible(".inkpal"), await I(() => bonsai.S.ed.ink.colour)], [false, "#c46a3a"], "a number picks a colour");
await page.keyboard.press("Shift+P");
await run(stroke("pen", [[100, 820], [400, 830]], { pressure: 0.7, tiltX: 40 }));
t.eq(await I(() => bonsai.S.ed.ink.doc.strokes.at(-1).c), "#c46a3a", "the stroke keeps the colour as hex");
await page.click("#ink-more");
await page.$eval("#ink-custom", (i) => { i.value = "#123456"; i.dispatchEvent(new Event("change", { bubbles: true })); });
t.eq(await I(() => bonsai.S.ed.ink.colour), "#123456", "a colour of your own");
await page.keyboard.press("p");
await run(stroke("pen", [[100, 870], [400, 880]], { pressure: 0.7 }));
await page.keyboard.press("c");
t.eq(await I(() => bonsai.S.ed.ink.colour), 0, "C goes back to the page's own colours");
await page.waitForTimeout(300);
await page.screenshot({ path: "tests/shots/canvas-brushes.png" });
await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(400);
await page.screenshot({ path: "tests/shots/canvas-night.png" });
await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(400);
await page.emulateMedia({ colorScheme: "light" }); await page.waitForTimeout(300);
await page.screenshot({ path: "tests/shots/canvas-laptop.png" });
const railFits = await page.$eval(".inkrail", (r) => r.scrollHeight <= r.clientHeight + 1);
if (!railFits) t.fail("the rail scrolls on a laptop screen");
await t.end();
