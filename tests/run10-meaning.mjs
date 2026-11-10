// Meaning view with the real on-device model: ideas are embedded and placed in
// 3D, related ideas score as closer, links are suggested, and search finds
// ideas by meaning.
import { start, seed, state } from "./lib.mjs";

const t = await start("run10-meaning", 4310);
const page = await t.page();
const ids = await seed(page);
const key = (k) => page.keyboard.press(k);

await key("m");
await page.waitForSelector(".dialog"); await page.click(".dialog .btn.primary");
await page.waitForSelector('body[data-meaning="ready"]', { timeout: 90000 });
t.eq(await state(page, () => [bonsai.S.view, bonsai.S.mean.ids.length, bonsai.S.flora.ids.length, bonsai.S.nodes.length]), ["meaning", 15, 15, 15], "every idea is placed");
t.eq(await state(page, () => [...document.querySelectorAll(".lbl.group")].map((e) => e.textContent).sort()), ["Electronics", "Music"], "zone labels");
const sim = await state(page, async () => {
  const ai = await import("./ai.js"), { dot } = await import("./semantic.js");
  const id = (title) => bonsai.S.nodes.find((n) => n.title === title).id, c = (a, b) => dot(ai.cache.get(id(a)).v, 0, ai.cache.get(id(b)).v, 0);
  return { near: c("Resistors", "Voltage divider"), far: c("Resistors", "Envelopes"), stored: (await bonsai.store.allVectors()).length };
});
if (!(sim.near > sim.far + 0.1)) t.fail(`related ideas don't score closer: ${sim.near.toFixed(2)} vs ${sim.far.toFixed(2)}`);
t.eq(sim.stored, 15, "vectors saved");
const spread = await state(page, () => { const ys = [...bonsai.S.mean.pos.values()].map((p) => p[1]); return [Math.min(...ys) > 0, new Set([...bonsai.S.mean.pos.values()].map((p) => p.map((x) => x.toFixed(1)).join())).size]; });
t.eq(spread, [true, 15], "ideas float above the floor, none stacked");
await page.waitForTimeout(400); await page.screenshot({ path: "tests/shots/meaning-all.png" });

// One zone: coloured and labelled by tree.
await page.selectOption("#scopeSel", ids.zone);
await page.waitForFunction(() => document.body.dataset.meaning === "ready" && bonsai.S.scope);
t.eq(await state(page, () => [bonsai.S.mean.ids.length, [...document.querySelectorAll(".lbl.group")].map((e) => e.textContent).sort()]), [12, ["Basic electronics", "Op-amps"]], "zone scope");
await page.waitForTimeout(300); await page.screenshot({ path: "tests/shots/meaning-zone.png" });

// Click an idea: its notes open here too, and Enter opens it in its tree.
await page.evaluate(() => { bonsai.S.sel = bonsai.S.nodes.find((n) => n.title === "Capacitors").id; });
await key("ArrowUp"); await page.waitForSelector('.lbl.sel');
await key(" "); await page.waitForSelector("#nodeTitle");
await key("Escape");

// Suggestions: accept one, dismiss one.
await page.click("#suggestBtn");
await page.waitForFunction(() => bonsai.S.suggest !== null);
const n = await state(page, () => bonsai.S.suggest.length);
if (n < 2) t.fail(`only ${n} suggestions`);
else {
  await page.click(".sug .btn"); await page.waitForFunction(() => bonsai.S.links.length === 1);
  await page.click('.sug [aria-label="Dismiss"]'); await page.waitForFunction((k) => bonsai.S.suggest.length === k - 2, n);
  t.eq(await state(page, async () => (await bonsai.store.getMeta("dismissed")).length), 1, "dismissed pairs are remembered");
}
await key("Escape");

// Search by meaning: no word in common with the idea it should find.
await key("/"); await page.keyboard.type("sound wave generator");
await page.waitForSelector(".res.sem", { timeout: 30000 });
const found = await state(page, () => [...document.querySelectorAll(".res.sem")].map((e) => e.textContent));
if (!found.some((x) => x.includes("Synthesis"))) t.fail("search by meaning missed the synthesis ideas: " + found.join(" | "));
await key("Escape");

// Reopening is instant: nothing is embedded twice.
await key("Escape"); await page.waitForSelector("#addBtn");
const before = await state(page, async () => JSON.stringify((await bonsai.store.allVectors()).map((v) => v.hash).sort()));
await key("m"); await page.waitForSelector('body[data-meaning="ready"]');
t.eq(await state(page, async () => JSON.stringify((await bonsai.store.allVectors()).map((v) => v.hash).sort())) === before, true, "vectors reused");
if (await page.$(".dialog")) t.fail("asked about the download twice");
await t.end();
