// Picking whole blocks in a note (drag across blocks, a box from the margin, Shift+click, Shift+↓, Ctrl+A twice, Esc),
// what can be done with them (copy and paste as blocks, delete, Tab, move, type over, all undoable), and Discuss with
// Claude: the quick bar's Discuss (Alt+6), the panel docked right, the first reply streamed, a follow-up carrying the
// conversation, Insert, the margin mark, reopening after a reload, delete with Undo; and without Bonsai Desktop the
// prompt copied for claude.ai with nothing kept. The bridge is a stand-in, as in run28-live.
import { start, state } from "./lib.mjs";

const t = await start("run41-discuss", 4344, { channel: "beta" });
const bridge = () => {
  const subs = new Set(), asked = [];
  window.bonsaiDesktop = { version: "0.2.0", channel: "beta", features: ["images"], update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: true, version: "2.1.0" }),
    onEvent: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    cancel: () => {},
    ask: async (req) => {
      asked.push(req); const n = asked.length;
      const reply = `Reply ${n}: **momentum** is mass times velocity.\n\n- point ${n}a\n- point ${n}b\n\nWhat is impulse?`;
      for (const k of [12, 30, reply.length]) { await new Promise((r) => setTimeout(r, 120)); subs.forEach((f) => f({ reqId: req.reqId, type: "text", text: reply.slice(0, k) })); }
      return { ok: true, text: reply };
    },
  } };
  window.__asked = asked;
};
const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });
await ctx.addInitScript(bridge);
let page = await ctx.newPage();
page.on("pageerror", (e) => t.fail("page error: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
const k = (key) => page.keyboard.press(key);
const htmls = () => state(page, () => bonsai.S.ed.blocks.map((b) => b.html));
const kinds = () => state(page, () => bonsai.S.ed.blocks.map((b) => [b.type, b.indent, b.html]));
const picked = () => state(page, () => bonsai.S.ed.pickedIds.map((id) => bonsai.S.ed.blocks.find((b) => b.id === id).html));
const quick = async () => { await page.waitForSelector(".qpanel"); return page.$$eval(".qpanel button", (b) => b.map((x) => x.dataset.act)); };
const open = async (title, text) => {
  const id = await state(page, async ([title, text]) => {
    const m = await import("./blocks.js");
    const p = await bonsai.store.addPage({ title, blocks: m.textToBlocks(text) });
    await bonsai.refresh(); location.hash = "#/notes/" + p.id; return p.id;
  }, [title, text]);
  await page.waitForFunction((x) => document.querySelector("#pageTitle")?.value === x && document.querySelectorAll("#nedit .blk").length > 1, title);
  return id;
};
const tx = (n) => page.locator("#nedit .blk .tx").nth(n);
const spot = async (n, dx = 12) => { const b = await tx(n).boundingBox(); return [b.x + Math.min(dx, b.width - 2), b.y + b.height / 2]; };
const drag = async (from, to, steps = 8) => { await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(...to, { steps }); await page.mouse.up(); await page.waitForTimeout(250); };
const TEXT = "Alpha one\nBeta two\nGamma three\n- Delta four\n  - Epsilon five\nZeta six";
const dragId = await open("Drag", TEXT);
const start0 = await kinds();

// ---------- 1. a drag from one block's words into another picks the blocks ----------
await drag(await spot(0, 20), await spot(2, 30));
t.eq(await picked(), ["Alpha one", "Beta two", "Gamma three"], "a drag across blocks picks them");
t.eq(await state(page, () => [document.querySelectorAll("#nedit .blk.picked").length, document.querySelector("#nedit .blocks").contains(getSelection().anchorNode), document.activeElement?.classList.contains("bkeys")]), [3, false, true], "they show picked, with no words selected, and the keys go to them");
const acts = await quick();
t.eq(acts.includes("discuss") && acts.includes("action"), true, "the quick bar shows for picked blocks, with Discuss and Action");
await page.screenshot({ path: "tests/shots/discuss-blocks.png" });
await k("Escape"); await page.waitForTimeout(100);
t.eq([await page.$(".qpanel"), (await picked()).length], [null, 3], "Esc closes the bar first");
await k("Escape");
t.eq(await picked(), [], "then lets go of the blocks");
// within one block a drag still selects words
await drag(await spot(1, 2), await spot(1, 60));
t.eq([(await picked()).length, (await state(page, () => getSelection().toString())).length > 2], [0, true], "a drag inside one block selects its words");
await k("Escape"); await k("Escape");

// ---------- 2. Shift+click, Shift+↓, Ctrl+A twice, Esc over words ----------
await tx(1).click(); await page.keyboard.down("Shift"); await tx(3).click(); await page.keyboard.up("Shift");
t.eq(await picked(), ["Beta two", "Gamma three", "Delta four", "Epsilon five"], "Shift+click picks from the caret's block, children and all");
await k("Shift+ArrowDown");
t.eq((await picked()).at(-1), "Zeta six", "Shift+↓ reaches further");
await k("Escape");
await tx(0).click(); await k("End"); await k("Shift+ArrowDown");
t.eq(await picked(), ["Alpha one", "Beta two"], "Shift+↓ on a block's last line picks whole blocks");
await k("Escape");
await tx(2).click(); await k("Control+a");
t.eq([await state(page, () => getSelection().toString()), (await picked()).length], ["Gamma three", 0], "Ctrl+A selects the block's words");
await k("Control+a");
t.eq((await picked()).length, 6, "Ctrl+A again picks every block");
await k("Escape");
await tx(4).click(); await k("Home"); await k("Shift+End"); await k("Escape"); await page.waitForTimeout(250);
if (await page.$(".qpanel")) await k("Escape");
t.eq(await picked(), ["Epsilon five"], "Esc over words picks their block");
await k("Escape");

// a closed toggle brings what's hidden in it
{
  const tg = await state(page, async () => {
    const p = await bonsai.store.addPage({ title: "Toggles", blocks: [{ id: "bt1", type: "toggle", html: "Fold", indent: 0, open: false }, { id: "bt2", type: "text", html: "Hidden", indent: 1 }, { id: "bt3", type: "text", html: "After", indent: 0 }] });
    await bonsai.refresh(); location.hash = "#/notes/" + p.id; return p.id;
  });
  await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Toggles");
  await tx(0).click(); await page.keyboard.down("Shift"); await page.locator("#nedit .blk .tx").filter({ hasText: "After" }).click(); await page.keyboard.up("Shift");
  t.eq(await picked(), ["Fold", "Hidden", "After"], "a closed toggle is picked with what's hidden in it");
  await k("Backspace");
  t.eq(await htmls(), [""], "and deleted with it");
  await k("Control+z");
  t.eq(await htmls(), ["Fold", "Hidden", "After"], "undo brings them back");
  await state(page, (id) => { location.hash = "#/notes/" + id; }, dragId);
  await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Drag");
}

// ---------- 3. a box drawn from the margin ----------
{
  const b1 = await tx(1).boundingBox(), b3 = await tx(3).boundingBox(), page0 = await page.locator("#nedit .page").boundingBox();
  await drag([page0.x - 60, b1.y + 4], [page0.x + 60, b3.y + b3.height / 2], 10);
  t.eq(await picked(), ["Beta two", "Gamma three", "Delta four", "Epsilon five"], "a box from the margin picks the blocks it crosses");
  await k("Escape"); if ((await picked()).length) await k("Escape");
}

// ---------- 4. delete, Tab, move, type over: all undoable ----------
const pickRange = async (a, b) => { await tx(a).click(); await page.keyboard.down("Shift"); await tx(b).click(); await page.keyboard.up("Shift"); };
await pickRange(1, 2); await k("Backspace");
t.eq(await htmls(), ["Alpha one", "Delta four", "Epsilon five", "Zeta six"], "Backspace deletes the picked blocks");
await k("Control+z");
t.eq(await kinds(), start0, "undo brings them back");
await pickRange(1, 2); await k("Tab");
t.eq((await kinds()).map((x) => x[1]), [0, 1, 1, 0, 1, 0], "Tab indents them all");
t.eq((await picked()).length, 2, "and they stay picked");
await k("Shift+Tab");
t.eq(await kinds(), start0, "Shift+Tab takes them back out");
await k("Control+Shift+ArrowDown");
t.eq((await htmls()).slice(0, 5), ["Alpha one", "Delta four", "Epsilon five", "Beta two", "Gamma three"], "Ctrl+Shift+↓ moves them together, past the next block and its children");
await k("Control+z");
t.eq(await kinds(), start0, "undo moves them back");
await pickRange(1, 2); await page.keyboard.type("Xy");
t.eq(await htmls(), ["Alpha one", "Xy", "Delta four", "Epsilon five", "Zeta six"], "typing replaces them with a new block");
await k("Control+z"); await k("Control+z");
t.eq(await kinds(), start0, "and undo puts them back");
// the handle menu works on them all
await pickRange(0, 1);
const h0 = page.locator("#nedit .blk").nth(0);
await h0.hover(); await h0.locator(".hdl").click();
await page.click('.menu .mi:has-text("Turn into")'); await page.click('.menu .mi:has-text("Heading 2")');
t.eq((await kinds()).slice(0, 3).map((x) => x[0]), ["h2", "h2", "text"], "the handle's Turn into turns every picked block");
await k("Control+z");
t.eq(await kinds(), start0, "and undo turns them back");
await k("Escape");

// ---------- 5. copy picked blocks, paste them into another page ----------
await pickRange(3, 5); await k("Control+c"); await page.waitForTimeout(150);
const clip = await page.evaluate(() => navigator.clipboard.readText());
t.eq(clip, "- Delta four\n  - Epsilon five\nZeta six", "Ctrl+C copies them as an outline");
await k("Escape");
await open("Target", "First line\nLast line");
await tx(0).click(); await k("End"); await k("Control+v");
t.eq(await kinds().then((x) => x.map(([a, b, c]) => [a, b, c])), [["text", 0, "First line"], ["bullet", 0, "Delta four"], ["bullet", 1, "Epsilon five"], ["text", 0, "Zeta six"], ["text", 0, "Last line"]], "a paste into another page brings back the blocks");
await k("Control+z");
t.eq(await htmls(), ["First line", "Last line"], "and undo takes the paste back");
// cut picked blocks, and paste over picked ones
await pickRange(0, 1); await k("Control+x");
t.eq(await htmls(), [""], "Ctrl+X cuts the picked blocks");
await k("Control+z");

// ---------- 6. Discuss ----------
await state(page, (id) => { location.hash = "#/notes/" + id; }, dragId);
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Drag");
await drag(await spot(1, 20), await spot(2, 30));
await quick(); await k("Alt+6");
await page.waitForSelector("#talk .tkturn.claude");
await page.waitForFunction(() => document.querySelector("#talk .tkturn.claude .md")?.textContent.includes("What is impulse?") && document.querySelector("#talkSend")?.textContent.startsWith("Send"));
const ask0 = await state(page, () => __asked[0]);
t.eq([ask0.prompt.includes("<selection>\n- Beta two") || ask0.prompt.includes("<selection>\nBeta two"), ask0.prompt.includes('My notes page "Drag"'), ask0.prompt.includes("Zeta six"), ask0.prompt.includes("one question I could test myself with"), ask0.system.includes("study partner")],
  [true, true, true, true, true], "the first ask carries the picked blocks, the page and what to do");
t.eq(await state(page, () => [document.body.dataset.talk, document.querySelector("#talk .tkquote").textContent.includes("Beta two"), !!document.querySelector("#talk .tkturn.claude .md strong")]), ["1", true, true], "the panel docks right with the words quoted and the reply in Markdown");
const pageBox = await page.locator("#nedit").boundingBox(), talkBox = await page.locator("#talk").boundingBox();
t.eq([Math.round(talkBox.y), Math.round(talkBox.x) >= Math.round(pageBox.x + pageBox.width) - 1, Math.round(talkBox.y + talkBox.height)], [52, true, 800], "it's full height, beside the page");
await page.fill("#talkInput", "Why does direction matter?");
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelectorAll("#talk .tkturn.claude").length === 2 && document.querySelector("#talkSend")?.textContent.startsWith("Send"));
const ask1 = await state(page, () => __asked[1].prompt);
t.eq([ask1.includes("You: Reply 1"), ask1.includes("Me: Why does direction matter?"), ask1.includes("Reply to my last message"), ask1.includes("<selection>")], [true, true, true, true], "a follow-up carries the conversation, the words and the page");
await page.screenshot({ path: "tests/shots/discuss-panel.png" });
await page.locator("#talk .tkturn.claude .tkins").last().click();
t.eq((await htmls()).slice(0, 7), ["Alpha one", "Beta two", "Gamma three", "Reply 2: <b>momentum</b> is mass times velocity.", "point 2a", "point 2b", "What is impulse?"], "Insert puts the reply in under what was talked about");
await page.click("#toast .link");
t.eq(await kinds(), start0, "and its Undo takes it out");
await page.waitForFunction(() => document.querySelectorAll("#nedit .tmark").length === 1);
t.eq(await state(page, () => document.querySelector("#nedit .tmark").closest(".blk").textContent.includes("Beta two")), true, "a mark in the margin beside the block talked about");
await page.focus("#talkInput"); await k("Escape");
t.eq(await state(page, () => [document.body.dataset.talk, !!document.querySelector("#talk")]), ["", false], "Esc in the reply box closes the panel");
await page.waitForTimeout(700);

// after a reload: the page bar counts it, and it opens again
await page.reload(); await page.waitForSelector("body[data-ready]");
await page.waitForFunction(() => document.querySelector("#pageTitle")?.value === "Drag");
await page.waitForFunction(() => document.querySelector("#talksBtn .tcount")?.textContent === "1");
await page.click("#talksBtn");
await page.waitForSelector("#talk .tkrow");
t.eq(await page.$$eval("#talk .tkrow .tkq", (r) => r.map((x) => x.textContent.slice(0, 8))), ["Beta two"], "the page bar lists its discussions");
await page.click("#talk .tkrow .tkopen");
t.eq(await page.$$eval("#talk .tkturn", (r) => r.map((x) => x.classList[1])), ["claude", "you", "claude"], "one opens again where it was left");
await page.fill("#talkInput", "And momentum?"); await k("Enter");
await page.waitForFunction(() => document.querySelectorAll("#talk .tkturn.claude").length === 3 && document.querySelector("#talkSend")?.textContent.startsWith("Send"));
t.eq(await state(page, () => __asked[0].prompt.includes("Me: Why does direction matter?") && __asked[0].prompt.includes("Me: And momentum?")), true, "and carries on, with the whole conversation sent");
// the margin mark opens it too; the list deletes, with Undo
await k("Escape"); await page.waitForFunction(() => !document.querySelector("#talk"));
await page.click("#nedit .tmark");
await page.waitForSelector("#talk .tkturn.claude");
await page.click("#talkList");
await page.locator("#talk .tkrow").hover(); await page.click("#talk .tkdel");
await page.waitForFunction(() => document.querySelectorAll("#talk .tkrow").length === 0, null, { timeout: 3000 }).catch(() => t.fail("a discussion can be deleted"));
await page.click("#toast .link");
await page.waitForFunction(() => document.querySelectorAll("#talk .tkrow").length === 1);
t.eq((await state(page, (id) => bonsai.store.getMeta("talk:" + id), dragId)).list[0].turns.length, 5, "Undo brings it back, kept in meta");
await page.waitForTimeout(300); await page.mouse.move(5, 400);
await page.screenshot({ path: "tests/shots/discuss-list.png" });
// the whole page, from the list
await page.click("#talkWhole");
await page.waitForFunction(() => document.querySelector("#talk .tkquote.whole") && document.querySelector("#talkSend")?.textContent.startsWith("Send"));
t.eq(await state(page, () => [__asked.at(-1).prompt.includes("<selection>"), __asked.at(-1).prompt.includes("think about this page")]), [false, true], "Discuss this page asks about the whole page");

// phone width
await page.setViewportSize({ width: 390, height: 800 });
await page.waitForTimeout(300);
const pb = await page.locator("#talk").boundingBox();
t.eq([Math.round(pb.x), Math.round(pb.width)], [0, 390], "on a phone the panel covers the page");
await page.screenshot({ path: "tests/shots/discuss-phone.png" });
await page.setViewportSize({ width: 1280, height: 800 });
await ctx.close();

// ---------- 7. no Bonsai Desktop: the prompt is copied for claude.ai, and nothing is kept ----------
const plain = await t.browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });
await plain.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
page = await plain.newPage();
page.on("pageerror", (e) => t.fail("page error: " + e.message));
await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
const lect = await state(page, () => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).id);
await state(page, (id) => { location.hash = "#/notes/" + id; }, lect); await page.waitForSelector(".blocks"); await page.waitForTimeout(400);
await state(page, () => {
  const el = [...document.querySelectorAll(".blocks .tx")].find((e) => e.textContent.includes("crumple zones")), w = "crumple zones";
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
  while ((n = walk.nextNode())) { const i = n.data.indexOf(w); if (i >= 0) { el.focus(); getSelection().setBaseAndExtent(n, i, n, i + w.length); return; } }
});
t.eq((await page.waitForSelector(".qpanel").then(() => page.$$eval(".qpanel button", (b) => b.map((x) => x.dataset.act)))).at(-1), "discuss", "Discuss is on the bar without Bonsai Desktop too");
await page.keyboard.press("Alt+6");
await page.waitForFunction(() => window.__opened.length === 1);
const pasted = await page.evaluate(() => navigator.clipboard.readText());
t.eq([pasted.includes("<selection>\ncrumple zones"), pasted.includes("Lecture 6"), pasted.includes("test myself"), await state(page, () => window.__opened[0]), !!(await page.$("#talk"))],
  [true, true, true, "https://claude.ai/new", false], "it copies a prompt with the words and the page, opens claude.ai, and shows no panel");
t.eq(await state(page, (id) => bonsai.store.getMeta("talk:" + id), lect), undefined, "nothing is kept");
await t.end();
