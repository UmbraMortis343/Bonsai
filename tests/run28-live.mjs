// The live Claude connection, as the page sees it: in Bonsai Desktop (here a stand-in bridge, `window.bonsaiDesktop`)
// Grow has Ask Claude, which streams Claude's reply into the reply box and on to the same check; a problem with
// Claude Code says what to do; without the bridge the copy and paste round trip is unchanged (run16, run22).
// desktop/test/smoke.mjs runs the real desktop app.
import { start, state } from "./lib.mjs";

const t = await start("run28-live", 4328, { channel: "beta" });
const reply = "```\nbonsai grow\ngraph: Live momentum\nMomentum from the desk | p = mv\n  Impulse from the desk | change in momentum\n```";
const bridge = ({ reply, signedIn }) => {
  const subs = new Set(), asked = [];
  window.bonsaiDesktop = { version: "0.1.0", channel: "beta", update: async () => null, claude: {
    status: async () => ({ found: true, loggedIn: signedIn, version: "2.1.0" }),
    onEvent: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    cancel: () => {},
    ask: async (req) => { asked.push(req); const half = reply.length >> 1;
      for (const text of [reply.slice(0, half), reply]) { await new Promise((r) => setTimeout(r, 80)); subs.forEach((f) => f({ reqId: req.reqId, type: "text", text })); }
      return { ok: true, text: reply }; },
  } };
  window.__asked = asked;
};
const open = async (signedIn) => {
  const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(bridge, { reply, signedIn });
  const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
  await page.goto(t.url + "#/notes"); await page.waitForSelector("body[data-ready]");
  const lect = await state(page, () => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).id);
  await page.evaluate((id) => { location.hash = "#/notes/" + id; }, lect); await page.waitForSelector("#pageTitle");
  await page.click("#pageMore"); await page.click('.mi:has-text("Grow into a knowledge graph")'); await page.waitForSelector("#growReply");
  return page;
};

const page = await open(true);
t.eq(await page.$$eval(".growd .row .btn", (b) => b.map((x) => x.textContent)), ["Ask Claude", "Copy for Claude"], "Ask Claude leads; Copy stays, Open Claude goes");
const before = await state(page, () => bonsai.S.nodes.length);
await page.click("#askClaude");
await page.waitForFunction(() => document.querySelector("#askClaude").textContent === "Stop");
await page.waitForFunction(() => document.querySelector("#growSum").textContent.includes("Live momentum (new) +2") && document.querySelector("#askClaude").textContent === "Ask Claude");
t.eq(await state(page, () => [__asked.length, __asked[0].prompt.includes("bonsai grow"), __asked[0].system.length > 0]), [1, true, true], "Bonsai's own prompt goes to Claude, with a system line asking for the format only");
await page.screenshot({ path: "tests/shots/live-grow.png" });
await page.click(".dialog > .row.end .btn.primary");
await page.waitForFunction((n) => bonsai.S.nodes.length === n + 2, before);
t.eq(await state(page, () => bonsai.S.nodes.some((n) => n.title === "Impulse from the desk")), true, "the reply grows as a pasted one would");
await page.context().close();

const out = await open(false);
await out.click("#askClaude"); await out.waitForSelector("#toast");
t.eq([(await out.textContent("#toast")).includes("isn't signed in"), await out.evaluate(() => __asked.length)], [true, 0], "signed out: it says what to do and asks nothing");
await t.end();
