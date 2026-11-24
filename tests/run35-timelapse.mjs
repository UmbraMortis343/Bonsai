// The timelapse (T): one slider for the past in the garden and in Knowledge, with ticks for Sundays and big days,
// play, steps of a day, Esc back to now, and a video of a play-through. Nothing is written while it runs.
import { start, state } from "./lib.mjs";
import { statSync } from "node:fs";

const t = await start("run35-timelapse", 4336, { channel: "beta" });
const page = await t.page({ acceptDownloads: true }, "#/");
await page.waitForSelector("body[data-ready]");
await page.waitForFunction(() => bonsai.S.model?.some((i) => i.name === "Workshop"), null, { timeout: 120000 });
const key = (k) => page.keyboard.press(k);
const DAY = 86400000;

// ---- the history helper, on made-up records ----
const H = await state(page, async () => {
  const { createHistory } = await import("./history.js"), D = 86400000, now = Date.parse("2026-11-21T12:00:00Z"), iso = (d) => new Date(now - d * D).toISOString();
  const zones = [{ id: "z1", createdAt: iso(30) }, { id: "z2", createdAt: iso(10) }];
  const trees = [{ id: "t1", zoneId: "z1", createdAt: iso(30) }, { id: "t2", zoneId: "z2", createdAt: iso(10) }];
  const nodes = [{ id: "a", treeId: "t1", parentId: null, title: "A", note: "x", createdAt: iso(30), reviewedAt: iso(2), srs: { interval: 3, ease: 2.5, reps: 2, lapses: 0, passes: 2, due: new Date(now + 3 * D).toISOString() } }];
  for (let i = 0; i < 24; i++) nodes.push({ id: "b" + i, treeId: "t1", parentId: "a", title: "B" + i, note: "y", createdAt: new Date(now - 20 * D + i * 60000).toISOString() });
  nodes.push({ id: "c", treeId: "t2", parentId: null, title: "C", note: "", createdAt: iso(10) }, { id: "g", treeId: "t2", parentId: "c", title: "G", note: "z", ghost: true, createdAt: iso(10) });
  const events = [{ id: "e1", at: iso(25), type: "node.review", ref: "a", data: { rating: "good" } }];
  const h = createHistory({ zones, trees, nodes, links: [{ id: "l", fromId: "a", toId: "c", createdAt: iso(10) }], events }, now);
  const { isDue } = await import("./srs.js");
  const at = (d) => { const s = h.at(now - d * D), a = s.nodes.find((n) => n.id === "a"); return [s.zones.size, s.trees.size, s.nodes.length, s.links.length, a ? !isDue(a, now - d * D) : null]; };
  return { at: [40, 29.5, 26, 24.5, 15, 5, 1, 0].map(at), count: [h.count(now - 21 * D), h.count(now - 19 * D)], min: h.min === now - 30 * D,
    ticks: h.ticks().map((x) => x.kind).filter((k) => k !== "sunday"), sundays: h.ticks().filter((x) => x.kind === "sunday").every((x) => new Date(x.at).getDay() === 0) && h.ticks().filter((x) => x.kind === "sunday").length >= 4 };
});
t.eq(H.at[0], [0, 0, 0, 0, null], "nothing before the first record");
t.eq(H.at[1], [1, 1, 1, 0, true], "29.5 days ago: one topic, one graph, one idea, not due yet (a day after it came)");
t.eq(H.at[2][4], false, "26 days ago it had waited more than a day: due");
t.eq(H.at[3][4], true, "24.5 days ago: watered by the logged review the day before");
t.eq(H.at[4], [1, 1, 25, 0, false], "15 days ago: the ideas made 20 days ago are there, and the first is due again");
t.eq(H.at[5], [2, 2, 26, 1, false], "5 days ago: both topics, the greyed idea left out, the link there");
t.eq(H.at[6][4], true, "a day ago: the review kept only as reviewedAt (2 days ago) counts");
t.eq(H.at[7], [2, 2, 26, 1, true], "now: as now");
t.eq(H.count, [1, 25], "count says how many ideas had come");
t.eq(H.min, true, "the range starts at the first record");
t.eq(H.ticks, ["big"], "a day with many new ideas is a big day");
t.eq(H.sundays, true, "Sundays are marked");

// ---- the garden ----
const pend = () => state(page, () => bonsai.store.pendingCount());
const before = await pend();
const now = await state(page, () => ({ topics: bonsai.S.model.reduce((a, q) => a + q.topics.filter((x) => x.id).length, 0), growth: bonsai.S.model.reduce((a, q) => a + q.topics.reduce((b, x) => b + x.growth, 0), 0) }));
await key("t"); await page.waitForSelector("#timeline:not([hidden]) #timeRange");
const bar = await state(page, () => ({ ticks: document.querySelectorAll("#timeline .tick").length, sundays: document.querySelectorAll("#timeline .tick.sunday").length, big: document.querySelectorAll("#timeline .tick.big,#timeline .tick.grow,#timeline .tick.exam").length,
  keys: [...document.querySelectorAll("#timeline kbd")].map((k) => k.textContent), at: bonsai.S.tl.t >= bonsai.S.tl.max - 1000, where: bonsai.S.tl.where }));
t.eq([bar.where, bar.at, bar.sundays >= 7, bar.big >= 1], ["garden", true, true, true], "T opens the slider in the garden at now, with Sundays and big days marked");
t.eq(bar.keys, ["Space", "← →", "⇧T", "Esc"], "its keys are shown");

// scrub back: fewer topics, less grown
const scrub = (f) => page.evaluate((f) => { const r = document.querySelector("#timeRange"), tl = bonsai.S.tl; r.value = tl.min + (tl.max - tl.min) * f; r.dispatchEvent(new Event("input")); }, f);
const settled = () => page.waitForFunction(() => !bonsai.isles.busy && !bonsai.S.tl?.dirty, null, { timeout: 120000 });
const garden = () => state(page, () => ({ topics: bonsai.S.model.reduce((a, q) => a + q.topics.filter((x) => x.id).length, 0), growth: bonsai.S.model.reduce((a, q) => a + q.topics.reduce((b, x) => b + x.growth, 0), 0), isles: bonsai.S.model.length }));
await scrub(0.3); await settled();
const g30 = await garden();
await scrub(0.7); await settled();
const g70 = await garden();
if (!(g30.topics < g70.topics && g70.topics <= now.topics)) t.fail(`topics should appear over time: ${g30.topics}, ${g70.topics}, ${now.topics}`);
if (!(g30.growth < g70.growth && g70.growth < now.growth)) t.fail(`growth should rise over time: ${g30.growth}, ${g70.growth}, ${now.growth}`);
t.eq(g30.isles, 7, "every island is there, bare rock until its topics come");
await scrub(0.45); await settled();
await page.screenshot({ path: "tests/shots/timelapse-garden.png" });

// a day at a time, and the marks
const t0 = await state(page, () => bonsai.S.tl.t);
await key("ArrowRight"); t.eq(Math.round((await state(page, () => bonsai.S.tl.t)) - t0), DAY, "→ steps a day on");
await key("ArrowLeft"); await key("ArrowLeft"); t.eq(Math.round((await state(page, () => bonsai.S.tl.t)) - t0), -DAY, "← steps a day back");
await key("Shift+ArrowRight");
const next = await state(page, () => { const tl = bonsai.S.tl; return tl.ticks.some((k) => k.at === tl.t); });
t.eq(next, true, "⇧→ jumps to the next mark");
await page.click("#timeline .tick.big, #timeline .tick.grow, #timeline .tick.exam");
t.eq(await state(page, () => { const tl = bonsai.S.tl; return tl.ticks.some((k) => k.kind !== "sunday" && k.at === tl.t); }), true, "clicking a big day goes there");

// play runs on and stops at now
await page.evaluate(() => { bonsai.timelapse.secs = 3; });
await scrub(0.8); await key(" ");
t.eq(await state(page, () => bonsai.S.tl.playing), true, "Space plays");
await page.waitForFunction(() => !bonsai.S.tl.playing, null, { timeout: 60000 });
t.eq(await state(page, () => bonsai.S.tl.t === bonsai.S.tl.max), true, "play stops at now");
await settled();
t.eq((await garden()).topics, now.topics, "at now, the garden as it is");

// Esc: back to now
await scrub(0.2); await settled();
await key("Escape");
t.eq(await state(page, () => [bonsai.S.tl, document.querySelector("#timeline").hidden]), [null, true], "Esc closes it");
t.eq((await garden()).topics, now.topics, "and the garden is now again");
t.eq(await pend(), before, "nothing was written");

// ---- video (⇧T): a play-through recorded and offered as a file ----
const rec = await state(page, () => typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream);
if (rec) {
  await page.evaluate(() => { bonsai.timelapse.secs = 2; });
  const dl = page.waitForEvent("download", { timeout: 240000 });
  await key("Shift+T");
  await page.waitForFunction(() => bonsai.S.tl?.rec, null, { timeout: 30000 });
  t.eq(await state(page, () => document.querySelector("#timeVideo").getAttribute("aria-pressed")), "true", "the video button shows it is recording");
  const file = await dl;
  const size = statSync(await file.path()).size;
  t.eq([/^bonsai-timelapse-\d{4}-\d\d-\d\d\.(webm|mp4)$/.test(file.suggestedFilename()), size > 1000], [true, true], `the video is offered as a file (${file.suggestedFilename()}, ${size} bytes)`);
  t.eq(await state(page, () => [bonsai.S.tlVideo?.size > 1000, !bonsai.S.tl.rec]), [true, true], "and kept as a Blob");
  await key("Escape");
} else console.log("run35: no MediaRecorder here; video not tried");
t.eq(await pend(), before, "still nothing written");

// ---- Knowledge: the same slider over the rings ----
await page.evaluate(() => { location.hash = "#/forest"; });
await page.waitForFunction(() => [...document.querySelectorAll(".lbl.zone")].some((l) => l.offsetParent && getComputedStyle(l).visibility !== "hidden" && +getComputedStyle(l).opacity > 0), null, { timeout: 60000 });   // any topic name showing (which comes first depends on the camera)
const all = await state(page, () => bonsai.S.flora.ids.length);
await key("t"); await page.waitForSelector("#timeline:not([hidden]) #timeRange");
t.eq(await state(page, () => [bonsai.S.tl.where, bonsai.S.cutoff != null, document.querySelectorAll("#timeline .tick").length > 5]), ["knowledge", true, true], "T opens the same slider in Knowledge");
await scrub(0.5);
const half = await state(page, () => bonsai.S.flora.ids.length);
if (!(half < all && half > 0)) t.fail(`halfway should show fewer ideas: ${half} of ${all}`);
await page.waitForTimeout(600); await page.screenshot({ path: "tests/shots/timelapse-knowledge.png" });
await page.evaluate(() => { bonsai.timelapse.secs = 2; }); await key(" ");
await page.waitForFunction(() => !bonsai.S.tl.playing, null, { timeout: 60000 });
t.eq(await state(page, () => bonsai.S.flora.ids.length), all, "played to now, everything is there");
await key("Escape");
t.eq(await state(page, () => [bonsai.S.tl, bonsai.S.cutoff, bonsai.S.flora.ids.length]), [null, null, all], "Esc goes back to now");
t.eq(await pend(), before, "nothing written in Knowledge either");
await t.end();
