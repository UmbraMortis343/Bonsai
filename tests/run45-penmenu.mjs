// Quick actions with the pen: the barrel (side) button opens a quick menu at the nib (hovering or touching) and
// neither draws nor erases; the eraser button still erases; Side button (⇧E, pref penbtn) puts the barrel back to
// erasing; holding the pen still opens the menu and drops its dot, a moving press draws; every tile works by a pen
// tap; the menu's closing rules; Q opens it from the keys. Then the lasso's bar: under the pick, following a move,
// To text and Discuss through a stand-in Bonsai Desktop, Copy as picture, Colour, Duplicate, Delete, all undoable;
// Discuss without the desktop; and a phone-width screen.
import { start, state } from "./lib.mjs";
import { EXTRA } from "../src/ink.js";

const t = await start("run45-penmenu", 4346, { channel: "beta" });
const bridge = () => {
  const subs = new Set(), asked = [];
  window.bonsaiDesktop = { version: "0.2.0", channel: "beta", features: ["images"], update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true, version: "2.1.0" }),
    onEvent: (fn) => { subs.add(fn); return () => subs.delete(fn); }, cancel: () => {},
    ask: async (req) => {
      asked.push({ prompt: req.prompt, system: req.system, images: (req.images || []).map((i) => [i.media_type, i.data.length > 200]) });
      const reply = req.prompt.startsWith("Transcribe") ? "# Momentum\n- p = mv" : "Your note says **p = mv**. What is impulse?";
      await new Promise((r) => setTimeout(r, 80)); subs.forEach((f) => f({ reqId: req.reqId, type: "text", text: reply }));
      return { ok: true, text: reply };
    },
  } };
  window.__asked = asked;
};
const noDesktop = () => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; };
// a few lines of "writing": zigzags in rows
const strokes = [];
for (let r = 0; r < 3; r++) for (let w = 0; w < 4; w++) {
  const x = 120 + w * 110, y = 140 + r * 72, p = [];
  for (let i = 0; i < 9; i++) p.push(x + i * 9, y + (i % 2 ? -14 : 10) + r, 2.6);
  strokes.push({ id: `s${r}${w}`, t: "pen", c: r === 1 ? 1 : 0, p });
}
async function open(viewport, init) {
  const ctx = await t.browser.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => t.fail("page error: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
  await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
  const id = await page.evaluate(async (strokes) => { const p = await bonsai.store.addPage({ title: "Momentum scrawl", kind: "ink" }); await bonsai.store.updatePage(p.id, { ink: { paper: "lined", strokes } }); return p.id; }, strokes);
  await page.evaluate((id) => { location.hash = "#/notes/" + id; location.reload(); }, id);
  await page.waitForSelector("body[data-ready]"); await page.waitForSelector(".inkrail"); await page.waitForTimeout(400);
  await page.evaluate(() => bonsai.isles?.setActive?.(false));
  const I = (fn, arg) => page.evaluate(fn, arg);
  // pointer events as one pen would send them, at page units: [type, x, y, extra]
  const pen = (evs) => I((evs) => {
    const ink = bonsai.S.ed.ink, cv = document.querySelector(".inkc");
    for (const [type, x, y, ex = {}] of evs) {
      const [cx, cy] = ink.toScreen(x, y), up = type === "pointerup";
      (ex.on ? document.querySelector(ex.on) : cv).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: ex.id ?? 3, pointerType: ex.kind || "pen", clientX: cx, clientY: cy,
        buttons: ex.buttons ?? (up ? 0 : 1), button: ex.button ?? (type === "pointermove" ? -1 : 0), pressure: ex.pressure ?? (up || !(ex.buttons ?? 1) ? 0 : 0.5), isPrimary: true }));
    }
  }, evs);
  // a pen tap on an element: down and up at its middle (no click: a pen's click may never come)
  const tap = (sel, kind = "pen") => I(([sel, kind]) => {
    const b = document.querySelector(sel), r = b.getBoundingClientRect(), o = { bubbles: true, cancelable: true, composed: true, pointerId: 3, pointerType: kind, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, isPrimary: true };
    b.dispatchEvent(new PointerEvent("pointerdown", { ...o, buttons: 1, button: 0, pressure: 0.5 }));
    b.dispatchEvent(new PointerEvent("pointerup", { ...o, buttons: 0, button: 0, pressure: 0 }));
  }, [sel, kind]);
  const box = (sel) => I((sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
  const scr = (x, y) => I(([x, y]) => bonsai.S.ed.ink.toScreen(x, y), [x, y]);
  const n = () => I(() => bonsai.S.ed.ink.doc.strokes.length);
  const ink = (k) => I((k) => bonsai.S.ed.ink[k], k);
  return { ctx, page, id, I, pen, tap, box, scr, n, ink };
}

// ---------------- Bonsai Desktop ----------------
let P = await open({ width: 1280, height: 800 }, bridge);
let { page, pen, tap, box, scr, n, ink, I } = P;
const n0 = await n();
const k = (key) => page.keyboard.press(key);
const quiet = () => page.waitForTimeout(400);

// ---- 1. the barrel button, hovering: the menu at the nib, nothing drawn or erased
await pen([["pointermove", 330, 420, { buttons: 0 }], ["pointerdown", 330, 420, { buttons: 2, button: 2, pressure: 0 }]]);
t.eq([await ink("menuOpen"), await n()], [true, n0], "the barrel button, hovering, opens the menu and draws nothing");
{
  const [nx, ny] = await scr(330, 420), b = await box(".inkqm");
  if (!(b.l > nx && b.l < nx + 30 && b.t > ny && b.t < ny + 30)) t.fail(`the menu sits just below-right of the nib: ${JSON.stringify(b)} vs ${nx},${ny}`);
  t.eq(await page.$$eval(".inkqm .iqt", (x) => x.map((b) => [b.id.slice(3), b.querySelector("kbd").textContent])),
    [["pen", "P"], ["pencil", "⇧P"], ["marker", "M"], ["hl", "H"], ["eraser", "E"], ["lasso", "L"], ["text", "A"], ["snip", "⇧S"], ["undo", "Ctrl+Z"], ["colour", "⇧C"]], "ten tiles, each with its key");
  t.eq(await page.$$eval(".inkqm .iqt.on", (x) => x.map((b) => b.id)), ["qm-pen"], "the tool in hand is marked");
  const g = await page.$eval(".inkqm", (e) => { const s = getComputedStyle(e); return [s.gridTemplateColumns.split(" ").length, Math.round(e.getBoundingClientRect().height / e.querySelector(".iqt").offsetHeight)]; });
  t.eq(g[0], 5, "two rows of five");
  const radius = await page.$eval(".inkqm .iqt", (e) => parseFloat(getComputedStyle(e).borderRadius));
  if (!(radius >= 3 && radius <= 6)) t.fail("tiles have slight corners, got " + radius);
}
await page.screenshot({ path: "tests/shots/penmenu-nib.png" });
await pen([["pointerup", 330, 420, { buttons: 0, button: 2 }]]);
t.eq([await ink("menuOpen"), await n()], [true, n0], "letting the barrel go leaves the menu open");
await k("Escape");
t.eq(await ink("menuOpen"), false, "Esc closes it");
// pressed on a pointermove while hovering (how some pens report it)
await pen([["pointermove", 500, 300, { buttons: 0 }], ["pointermove", 501, 300, { buttons: 2 }]]);
t.eq(await ink("menuOpen"), true, "the barrel reported on a hover move opens it too");
await pen([["pointermove", 502, 300, { buttons: 0 }]]); await k("Escape");
// while writing: the stroke under way goes
await pen([["pointerdown", 150, 560], ["pointermove", 190, 570], ["pointermove", 230, 560], ["pointermove", 232, 561, { buttons: 3 }], ["pointermove", 280, 580, { buttons: 3 }], ["pointerup", 280, 580]]);
t.eq([await ink("menuOpen"), await n()], [true, n0], "the barrel while writing opens the menu; the stroke goes and nothing more is drawn");
await k("Escape"); await quiet();

// ---- 2. the eraser button still erases
await pen([["pointerdown", 160, 120, { buttons: 32, button: 5 }], ["pointermove", 160, 165, { buttons: 32 }], ["pointerup", 160, 165, { button: 5 }]]);
t.eq([await n(), await ink("menuOpen"), await ink("tool")], [n0 - 1, false, "pen"], "the eraser button erases, and no menu");
await k("Control+z"); t.eq(await n(), n0, "and that undoes");
await quiet();

// ---- 3. Side button: Erase
t.eq(await page.getAttribute("#ink-penbtn", "title"), "Side button: menu (⇧E)", "the rail shows what the side button does");
await k("Shift+E");
t.eq([await ink("penbtn"), await page.getAttribute("#ink-penbtn", "title"), await I(() => localStorage.getItem("bonsai-beta.penbtn"))], ["erase", "Side button: erase (⇧E)", "erase"], "⇧E sets it to erase, kept as pref penbtn");
await pen([["pointerdown", 160, 120, { buttons: 2, button: 2 }], ["pointermove", 160, 165, { buttons: 2 }], ["pointerup", 160, 165, { button: 2 }]]);
t.eq([await n(), await ink("menuOpen")], [n0 - 1, false], "set to erase, the barrel erases again");
await k("Control+z"); await quiet();
await page.click("#ink-penbtn");
t.eq(await ink("penbtn"), "menu", "the rail button puts it back to the menu");

// ---- 4. holding the pen still
await pen([["pointermove", 600, 470, { buttons: 0 }], ["pointerdown", 600, 470], ["pointermove", 601, 471]]);
await page.waitForTimeout(800);
t.eq(await ink("menuOpen"), true, "the pen held still opens the menu");
await pen([["pointerup", 601, 471]]);
t.eq(await n(), n0, "and the dot it made goes");
await k("Escape"); await quiet();
await pen([["pointerdown", 600, 470], ["pointermove", 615, 474], ["pointermove", 640, 480]]);
await page.waitForTimeout(800);
await pen([["pointerup", 640, 480]]);
t.eq([await ink("menuOpen"), await n()], [false, n0 + 1], "a press that moves draws as ever");
await pen([["pointerdown", 700, 470], ["pointerup", 700, 470]]);
t.eq(await n(), n0 + 2, "a quick tap still leaves a dot");
await k("Control+z"); await k("Control+z"); await quiet();

// ---- 5. each tile, tapped with the pen
const viaMenu = async (tile) => { await pen([["pointermove", 400, 520, { buttons: 0 }], ["pointerdown", 400, 520, { buttons: 2, button: 2 }], ["pointerup", 400, 520, { button: 2 }]]); await tap("#qm-" + tile); };
for (const [tile, tool] of [["pencil", "pencil"], ["marker", "marker"], ["hl", "hl"], ["eraser", "eraser"], ["lasso", "lasso"], ["text", "text"], ["pen", "pen"]]) {
  await viaMenu(tile);
  t.eq([await ink("tool"), await ink("menuOpen")], [tool, false], `the ${tile} tile picks it and closes the menu`);
}
await viaMenu("snip"); t.eq(await ink("tool"), "snip", "the snip tile"); await k("Escape");
t.eq(await ink("tool"), "pen", "Esc leaves the snip for the tool before");
await pen([["pointerdown", 150, 600], ["pointermove", 250, 610], ["pointerup", 250, 610]]); await quiet();
await viaMenu("undo");
t.eq([await n(), await ink("menuOpen")], [n0, false], "the undo tile undoes");
await viaMenu("colour");
{
  const b = await box(".inkpal");
  t.eq([await ink("palOpen"), await page.$eval(".inkpal", (e) => e.classList.contains("at"))], [true, true], "the colour tile opens the colours there");
  const [nx] = await scr(400, 520); if (!b || Math.abs(b.l - nx) > 60) t.fail("the colours open where the menu was: " + JSON.stringify(b));
}
await k("2");
t.eq([await ink("colour"), await ink("palOpen")], [EXTRA[1], false], "a colour picked from there");
await I(() => bonsai.S.ed.ink.setColour(0));
// the mouse clicks tiles too
await I(() => bonsai.S.ed.ink.openMenu(300, 300)); await page.click("#qm-marker");
t.eq([await ink("tool"), await ink("menuOpen")], ["marker", false], "a mouse click on a tile works too");
await I(() => bonsai.S.ed.ink.setTool("pen"));

// ---- 6. closing
await viaMenu.call(null, "pen");
await pen([["pointermove", 400, 520, { buttons: 0 }], ["pointerdown", 400, 520, { buttons: 2, button: 2 }], ["pointerup", 400, 520, { button: 2 }]]);
await pen([["pointermove", 520, 560, { buttons: 0 }]]);
t.eq(await ink("menuOpen"), true, "hovering over the menu keeps it");
await pen([["pointermove", 900, 700, { buttons: 0 }]]);
t.eq(await ink("menuOpen"), false, "taking the pen well away closes it");
await pen([["pointermove", 400, 520, { buttons: 0 }], ["pointerdown", 400, 520, { buttons: 2, button: 2 }], ["pointerup", 400, 520, { button: 2 }]]);
await pen([["pointerdown", 160, 640], ["pointermove", 260, 650], ["pointerup", 260, 650]]);
t.eq([await ink("menuOpen"), await n()], [false, n0], "a press elsewhere only closes it");
await pen([["pointermove", 400, 520, { buttons: 0 }], ["pointerdown", 400, 520, { buttons: 2, button: 2 }], ["pointerup", 400, 520, { button: 2 }]]);
await page.click("#ink-in");
t.eq(await ink("menuOpen"), false, "the rail closes it"); await k("0");

// ---- 7. Q, from the keys
await pen([["pointermove", 250, 300, { buttons: 0 }]]);
await I(() => bonsai.S.ed.ink.focus()); await k("q");
{
  const [nx, ny] = await scr(250, 300), b = await box(".inkqm");
  if (!b || Math.abs(b.l - nx - 14) > 3 || Math.abs(b.t - ny - 14) > 3) t.fail("Q opens it by the pen: " + JSON.stringify(b));
}
t.eq(await I(() => document.activeElement.id), "qm-pen", "the tool in hand has the focus");
await k("ArrowRight"); await k("ArrowDown");
t.eq(await I(() => document.activeElement.id), "qm-text", "arrows go round the tiles");
await k("Enter");
t.eq([await ink("tool"), await ink("menuOpen")], ["text", false], "↵ presses the tile");
await k("q"); await k("q"); t.eq(await ink("menuOpen"), false, "Q again closes it");
await k("p");

// ---- 8. the lasso's bar
const lassoAll = async () => { await I(() => bonsai.S.ed.ink.setTool("lasso")); await pen([["pointerdown", 100, 105], ["pointermove", 540, 105], ["pointermove", 540, 175], ["pointermove", 100, 175], ["pointermove", 100, 107], ["pointerup", 100, 107]]); };
await lassoAll();
const picked = await ink("selected");
t.eq(picked.length, 4, "the lasso catches the first line");
t.eq(await page.$$eval(".inklb .iqt", (x) => x.map((b) => [b.id, b.querySelector("kbd").textContent])),
  [["lb-text", "X"], ["lb-talk", "Alt+6"], ["lb-copy", "C"], ["lb-colour", "⇧C"], ["lb-dup", "D"], ["lb-del", "Del"]], "the bar's actions, keys shown");
const under = async () => {
  const b = await box(".inklb"), sb = await I(() => { const ink = bonsai.S.ed.ink, s = ink.doc.strokes.filter((x) => ink.selected.includes(x.id)); let y1 = -1e9, x0 = 1e9; for (const k of s) for (let i = 0; i < k.p.length; i += 3) { y1 = Math.max(y1, k.p[i + 1] + k.p[i + 2] / 2); x0 = Math.min(x0, k.p[i] - k.p[i + 2] / 2); } return [...ink.toScreen(x0, y1)]; });
  return { b, sb };
};
{
  const { b, sb } = await under();
  if (!b || b.t < sb[1] || b.t > sb[1] + 40 || Math.abs(b.l - sb[0]) > 20) t.fail(`the bar sits just under the pick: ${JSON.stringify(b)} vs ${sb}`);
}
await page.screenshot({ path: "tests/shots/penmenu-lasso.png" });
{ // it follows a move
  const b0 = await box(".inklb");
  await pen([["pointerdown", 300, 140], ["pointermove", 360, 190], ["pointermove", 400, 240], ["pointerup", 400, 240]]);
  const b1 = await box(".inklb");
  if (!b1 || Math.abs(b1.l - b0.l - 100) > 3 || Math.abs(b1.t - b0.t - 100) > 3) t.fail(`the bar follows the pick: ${JSON.stringify(b0)} → ${JSON.stringify(b1)}`);
  await k("Control+z"); await lassoAll();
}
// Copy as picture
await tap("#lb-copy");
await page.waitForFunction(() => bonsai.S.ed.ink.snip?.copied != null);
t.eq((await ink("snip")).copied, true, "Copy as picture puts it on the clipboard");
{
  const got = await I(async () => { const it = (await navigator.clipboard.read())[0], b = await it.getType("image/png"), bmp = await createImageBitmap(b); return [it.types, bmp.width > 800, bmp.height > 100]; });
  t.eq(got, [["image/png"], true, true], "a sharp PNG of the pick");
}
await k("Escape");
t.eq(await ink("selected"), picked, "Esc closes the copied bar first; the pick stays");
// Colour
await tap("#lb-colour");
t.eq([await ink("palOpen"), await page.$eval(".inkpal", (e) => e.classList.contains("at"))], [true, true], "Colour opens the colours by the bar");
await page.click('.inkpal .iswatch[data-c="' + EXTRA[0] + '"]');
t.eq(await I((ids) => bonsai.S.ed.ink.doc.strokes.filter((s) => ids.includes(s.id)).map((s) => s.c), picked), picked.map(() => EXTRA[0]), "and recolours the pick");
await k("Control+z");
t.eq(await I((ids) => bonsai.S.ed.ink.doc.strokes.filter((s) => ids.includes(s.id)).map((s) => s.c), picked), [0, 0, 0, 0], "undone");
await I(() => bonsai.S.ed.ink.setColour(0)); await lassoAll();
// Duplicate (D)
await k("d");
{
  const s = await I(() => { const ink = bonsai.S.ed.ink; return { n: ink.doc.strokes.length, sel: ink.selected, x: ink.doc.strokes.filter((x) => ink.selected.includes(x.id)).map((x) => x.p[0]) }; });
  t.eq([s.n, s.sel.length, s.sel.some((id) => picked.includes(id))], [n0 + 4, 4, false], "D duplicates the pick, and picks the copy");
  t.eq(s.x, [120, 230, 340, 450].map((x) => x + 24), "a little down and right");
  t.eq(await I(() => document.querySelector(".inkview").classList.contains("propsopen")), false, "D with a pick doesn't fold the properties");
}
await k("Control+z"); t.eq(await n(), n0, "duplicate undoes");
await lassoAll(); await tap("#lb-dup"); t.eq(await n(), n0 + 4, "the Duplicate tile"); await k("Control+z");
// Delete
await lassoAll(); await tap("#lb-del");
t.eq([await n(), await box(".inklb")], [n0 - 4, null], "Delete takes the pick, and the bar goes");
await k("Control+z"); t.eq(await n(), n0, "delete undoes");
// To text (X)
await lassoAll(); await tap("#lb-text");
await page.waitForSelector("#inkReply"); await page.waitForFunction(() => document.querySelector("#inkReply").value.startsWith("# Momentum"));
t.eq([await page.textContent(".dialog h2, .dialog .title, .dialog header").catch(() => ""), await I(() => __asked.at(-1).images)].map((x, i) => (i ? x : /Selection to text/.test(x))), [true, [["image/png", true]]], "To text reads the pick from a picture");
await k("Escape"); await page.waitForSelector(".dialog", { state: "detached" });
// Discuss (Alt+6)
await lassoAll(); await I(() => bonsai.S.ed.ink.focus());
const asked0 = await I(() => __asked.length);
await k("Alt+6");
await page.waitForSelector("#talk .tkturn.claude:not(.live)");
{
  const a = await I(() => __asked.at(-1));
  t.eq([await I(() => __asked.length) - asked0, a.images, a.prompt.startsWith('My handwritten notes page "Momentum scrawl"'), a.prompt.includes("the part I picked out")], [1, [["image/png", true]], true, true], "Alt+6 discusses the pick, sending a picture of it");
  t.eq([await page.isVisible("#talk .tkquote img"), await page.isVisible("#talk .tkins")], [true, false], "the panel shows the ink talked about (no Insert on a pen page)");
}
await page.fill("#talkInput", "And impulse?"); await k("Enter");
await page.waitForFunction(() => __asked.length >= 3 && !document.querySelector("#talk .tkturn.live"));
t.eq(await I(() => [__asked.at(-1).images.length, __asked.at(-1).prompt.includes("And impulse?")]), [1, true], "a reply carries the conversation and the picture again");
await page.waitForTimeout(300);
{
  const kept = await I(async (id) => (await bonsai.store.getMeta("talk:" + id))?.list, P.id);
  t.eq([kept?.length, kept?.[0].inkIds?.length, kept?.[0].whole], [1, 4, false], "kept like a typed page's talk, with what it was about");
}
await page.click("#talkList");
t.eq(await page.$$eval("#talkRows .tkq", (x) => x.map((e) => e.textContent)), ["Selection"], "listed as the selection");
await page.click("#talkClose");
await P.ctx.close();

// ---------------- in a browser: no Bonsai Desktop ----------------
P = await open({ width: 1280, height: 800 }, noDesktop);
({ page, pen, tap, box, n, ink, I } = P);
await I(() => bonsai.S.ed.ink.setTool("lasso"));
await pen([["pointerdown", 100, 105], ["pointermove", 540, 105], ["pointermove", 540, 175], ["pointermove", 100, 175], ["pointermove", 100, 107], ["pointerup", 100, 107]]);
t.eq(await page.$$eval(".inklb .iqt", (x) => x.map((b) => b.id)), ["lb-talk", "lb-copy", "lb-colour", "lb-dup", "lb-del"], "no To text without the desktop");
await tap("#lb-talk");
await page.waitForFunction(() => __opened.length);
{
  const got = await I(async () => { const it = (await navigator.clipboard.read())[0]; return [__opened, it.types.slice().sort(), (await (await it.getType("text/plain")).text()).startsWith("My handwritten notes page")]; });
  t.eq(got, [["https://claude.ai/new"], ["image/png", "text/plain"], true], "Discuss copies the picture and the words for claude.ai, and opens it");
  t.eq(await I(async (id) => (await bonsai.store.getMeta("talk:" + id))?.list?.length || 0, P.id), 0, "and keeps nothing");
}
await P.ctx.close();

// ---------------- a phone-width screen ----------------
P = await open({ width: 390, height: 780 }, noDesktop);
({ page, pen, tap, box, n, ink, I } = P);
{
  const w = await box(".inkwrap");
  if (!w || w.r - w.l < 200) t.fail("the page shows at phone width: " + JSON.stringify(w));
  await I(([x, y]) => bonsai.S.ed.ink.openMenu(x, y), [w.r - w.l - 10, w.b - w.t - 10]);
  const b = await box(".inkqm");
  if (!b || b.l < w.l || b.r > w.r || b.t < w.t || b.b > w.b) t.fail(`the menu stays on screen: ${JSON.stringify(b)} in ${JSON.stringify(w)}`);
  await tap("#qm-lasso", "touch");
  t.eq([await ink("tool"), await ink("menuOpen")], ["lasso", false], "a finger taps a tile");
  await I(() => bonsai.S.ed.ink.setView({ sx: 300, sy: 60 }));
  await pen([["pointerdown", 330, 105], ["pointermove", 560, 105], ["pointermove", 560, 175], ["pointermove", 330, 175], ["pointermove", 330, 107], ["pointerup", 330, 107]]);
  const l = await box(".inklb");
  if (!l || l.l < w.l || l.r > w.r) t.fail(`the lasso's bar stays on screen: ${JSON.stringify(l)} in ${JSON.stringify(w)}`);
  await page.screenshot({ path: "tests/shots/penmenu-phone.png" });
}
await P.ctx.close();
await t.end();
