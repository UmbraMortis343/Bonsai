// Handwriting to text (Bonsai Desktop 0.2.0+; here a stand-in bridge that can see pictures): on a pen page, X
// sends a picture of the ink to Claude, the transcript lands in the dialog, and keeping it makes a typed page
// beside the pen page, which is left as it was. An older desktop says to update.
import { start, state } from "./lib.mjs";

const t = await start("run30-inktext", 4330, { channel: "beta" });
const bridge = ({ images }) => {
  const asked = [];
  window.bonsaiDesktop = { update: async () => null, features: images ? ["images"] : [], claude: {
    status: async () => ({ found: true, loggedIn: true }), onEvent: () => () => {}, cancel: () => {},
    ask: async (req) => { asked.push({ prompt: req.prompt, images: (req.images || []).map((i) => [i.media_type, i.data.length > 200]) }); await new Promise((r) => setTimeout(r, 60));
      return { ok: true, text: "# Momentum\n- p = mv\n  - conserved in collisions\n> Diagram: two carts with arrows" }; },
  } };
  window.__asked = asked;
};
const strokes = Array.from({ length: 6 }, (_, k) => ({ id: "s" + k, t: "pen", c: 0, p: [100 + k * 60, 120, 3, 140 + k * 60, 160, 3, 170 + k * 60, 130, 3] }));
const open = async (images) => {
  const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge, { images });
  const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
  await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
  const id = await page.evaluate(async (strokes) => { const p = await bonsai.store.addPage({ title: "Lecture scrawl", kind: "ink" }); await bonsai.store.updatePage(p.id, { ink: { paper: "lined", strokes } }); return p.id; }, strokes);
  await page.evaluate((id) => { location.hash = "#/notes/" + id; location.reload(); }, id); await page.waitForSelector("body[data-ready]"); await page.waitForSelector("#ink-text");
  return { page, id, ctx };
};

const { page, id, ctx } = await open(true);
t.eq(await page.getAttribute("#ink-text", "title"), "To text (X)", "the rail has To text, with its key");
await page.keyboard.press("x"); await page.waitForSelector("#inkReply");
await page.waitForFunction(() => document.querySelector("#inkReply").value.startsWith("# Momentum"));
t.eq(await state(page, () => [__asked.length, __asked[0].images, __asked[0].prompt.startsWith("Transcribe my handwritten notes")]), [1, [["image/png", true]], true], "it asks at once, with a picture of the ink");
await page.screenshot({ path: "tests/shots/ink-text.png" });
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction(() => bonsai.S.pages.some((p) => p.title === "Lecture scrawl (typed)"));
const made = await state(page, (id) => { const p = bonsai.S.pages.find((x) => x.title === "Lecture scrawl (typed)"), ink = bonsai.S.pages.find((x) => x.id === id);
  return { types: p.blocks.map((b) => b.type), kind: p.kind, inkKept: ink.ink.strokes.length, open: bonsai.S.npage === p.id }; }, id);
t.eq(made, { types: ["h1", "bullet", "bullet", "quote"], kind: "page", inkKept: 6, open: true }, "a typed page beside it, opened; the ink stays");
await ctx.close();

const old = await open(false);
await old.page.keyboard.press("x"); await old.page.waitForSelector("#toast");
t.eq([(await old.page.textContent("#toast")).includes("Update Bonsai Desktop"), await old.page.evaluate(() => __asked.length)], [true, 0], "an older desktop app is asked to update, and nothing is sent");
await old.ctx.close();
await t.end();
