// Shared test setup: build the app, serve it, open pages, report failures.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { serve } from "../scripts/serve.mjs";

export async function start(name, port, { channel = "" } = {}) {
  const dir = `tests/.out/${name}`;
  execFileSync("node", ["scripts/build.mjs", dir, "", channel], { stdio: "ignore" });
  mkdirSync("tests/shots", { recursive: true });
  const server = await serve(() => dir, port), browser = await chromium.launch();
  const t = {
    url: `http://localhost:${port}/Bonsai/`, browser, failed: false,
    fail(m) { console.error(`FAIL ${name}:`, m); t.failed = true; },
    eq(got, want, m) { if (JSON.stringify(got) !== JSON.stringify(want)) t.fail(`${m}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); },
    async page(opts = {}, path = "") {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts }), page = await ctx.newPage();
      page.on("pageerror", (e) => t.fail("page error: " + e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
      await page.goto(t.url + (path || "#/forest"));   // most tests start in the knowledge window; the garden is the home
      if (!path || path === "#/") await page.waitForSelector("body[data-ready]");
      return page;
    },
    async end() { await browser.close(); server.close(); if (t.failed) process.exit(1); console.log(`PASS ${name}`); },
  };
  process.on("unhandledRejection", (e) => { console.error(`FAIL ${name}:`, e); process.exit(1); });
  return t;
}

// A small forest: Electronics (Basic electronics, Op-amps) and Music (Synthesis).
export const seed = (page) => page.evaluate(async () => {
  const s = bonsai.store, ids = {};
  const mk = async (parent, titles) => { for (const x of titles) ids[x] = (await s.addNode(parent, { title: x })).id; };
  const z = await s.createZone({ name: "Electronics" }), z2 = await s.createZone({ name: "Music" });
  const basic = await s.createTree({ zoneId: z.id, name: "Basic electronics", core: "Ohm's law" });
  await mk(basic.rootId, ["Resistors", "Capacitors", "Sources"]);
  await mk(ids.Resistors, ["Series", "Parallel", "Voltage divider"]);
  await mk(ids.Capacitors, ["Charge", "RC time constant"]);
  await s.updateNode(ids.Resistors, { note: "Limit current", body: "**V = IR**" });
  await s.updateNode(ids.Capacitors, { note: "Store charge" });
  const op = await s.createTree({ zoneId: z.id, name: "Op-amps", core: "Negative feedback" });
  await mk(op.rootId, ["Inverting", "Golden rules"]);
  const syn = await s.createTree({ zoneId: z2.id, name: "Synthesis", core: "Subtractive" });
  await mk(syn.rootId, ["Oscillators", "Envelopes"]);
  await bonsai.refresh();
  return { ...ids, zone: z.id, zone2: z2.id, basic: basic.id, basicRoot: basic.rootId, op: op.id, opRoot: op.rootId, syn: syn.id };
});
export const openTree = async (page, id) => { await page.evaluate((i) => { location.hash = "#/tree/" + i; }, id); await page.waitForSelector(".lbl.trunk"); };
export const state = (page, fn) => page.evaluate(fn);
