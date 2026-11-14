// Tech tree: a web that recentres. One island in the middle as a hex with its key ideas; the islands that grow
// out of it sit on the ring as boundary cells. Step in, step back (the route stays lit), tier only, show all,
// the start, Grows from, light and dark, and the web view. Runs as the beta so it has the demo islands.
import { start, state } from "./lib.mjs";

const t = await start("run14-techtree", 4314, { channel: "beta" });
const key = (page, k) => page.keyboard.press(k);
const snap = (page) => state(page, () => bonsai.tech.snapshot());
const settle = (page) => page.waitForFunction(() => bonsai.tech.snapshot().settled, null, { timeout: 60000 });
const ids = (page) => state(page, () => Object.fromEntries(bonsai.S.nodes.map((n) => [n.title, n.id])));
const numOf = (s, k) => +Object.entries(s.nums).find(([, v]) => v === k)?.[0];

const page = await t.page();
await page.waitForFunction(() => window.bonsai && bonsai.S.zones.length > 0);
const I = await ids(page);

// ----- K opens it on the first island -----
await key(page, "k");
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech && location.hash === "#/techtree");
t.eq(await page.isVisible("#tech canvas"), true, "the tech tree shows");
let s = await snap(page);
t.eq([s.centre, s.chain], ["found", ["found"]], "Foundations is in the middle");
t.eq(s.cells.sort(), ["gensci", "maths"], "the islands that grow out of it sit on its ring");
t.eq(s.shown.includes(I.Numbers) && s.shown.includes(I.Patterns) && !s.shown.includes(I.Zero), true, "its key ideas show, what's inside them waits");
t.eq(s.nums[1], I.Numbers, "key ideas are numbered");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-centre.png" });

// ----- a number picks a boundary cell, Enter steps into it -----
await key(page, String(numOf(s, "i:gensci"))); await key(page, "Enter");
s = await snap(page);
t.eq([s.centre, s.cells], ["gensci", ["phys"]], "General science takes the middle, Physics on its ring");
await key(page, String(numOf(s, "i:phys"))); await key(page, "Enter");
s = await snap(page);
t.eq(s.centre, "phys", "then Physics");
t.eq(s.shown.includes(I["Newton's laws"]) && s.shown.includes(I.Kinematics), true, "Physics' key ideas show");

// ----- Space opens a key idea -----
await key(page, String(numOf(s, I["Newton's laws"]))); await key(page, " ");
s = await snap(page);
t.eq([s.shown.includes(I["2nd law"]), s.shown.includes(I.Acceleration)], [true, true], "opening Newton's laws shows the laws and what comes out of them");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-open.png" });

// ----- Esc in layers: let go of the pick, then step back a tier with the route lit -----
await key(page, "Escape");
t.eq((await snap(page)).pick, null, "Esc lets go of the pick first");
await key(page, "Escape");
s = await snap(page);
t.eq([s.centre, s.chain, s.hl], ["gensci", ["gensci", "phys"], true], "then steps back: General science in the middle, Physics out on its ring");
t.eq([s.lit.includes(I["Newton's laws"]), s.lit.includes(I.Energy), s.lit.includes(I["Living things"])], [true, true, false], "the route from the middle to Physics stays lit, the rest dims");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-back.png" });
await page.mouse.click(1240, 120);
t.eq((await snap(page)).hl, false, "clicking away shows the whole web");

// ----- T: this tier only -----
await key(page, "t");
s = await snap(page);
t.eq([s.tier, s.shown.includes(I["Newton's laws"]), s.cells.includes("phys")], [true, false, true], "tier only hides what grows beyond the boundary cells");
await key(page, "t");

// ----- H: back to the start -----
await key(page, "h");
s = await snap(page);
t.eq([s.centre, s.chain], ["start", ["start", "found", "gensci", "phys"]], "H puts the start in the middle");
t.eq(s.cells.includes("found") && s.cells.includes("lead") && s.cells.includes("music"), true, "islands that grow from nothing sit on the start's ring");
t.eq(s.links.length > 0, true, "links between islands are drawn between whatever shows");
await page.mouse.click(1240, 120);
await settle(page);
await page.screenshot({ path: "tests/shots/tech-start.png" });

// ----- B: what an island grows from -----
await key(page, String(numOf(s, "i:music")));
t.eq(await page.isVisible("#techFrom"), true, "the bar offers Grows from for an island");
await key(page, "b"); await page.waitForSelector(".dialog select");
await page.selectOption(".dialog select", "found"); await page.click(".dialog button.primary");
await page.waitForFunction(() => document.querySelector(".dialog h2, .dialog .title")?.textContent.includes("Which idea"));
await page.selectOption(".dialog select", I.Patterns); await page.click(".dialog button.primary");
await page.waitForFunction(() => !document.querySelector(".dialog"));
await page.waitForFunction(async () => (await bonsai.store.getMeta("garden")).islands.find((q) => q.id === "music").after === "found");
const music = await state(page, async () => (await bonsai.store.getMeta("garden")).islands.find((q) => q.id === "music"));
t.eq([music.after, music.from], ["found", I.Patterns], "Music now grows from Foundations' Patterns");

// ----- an idea opens in its graph, and Back returns -----
await state(page, (id) => bonsai.tech.focus(id), I.Acceleration);
s = await snap(page);
t.eq([s.centre, s.pick, s.shown.includes(I.Acceleration)], ["phys", I.Acceleration, true], "opening on an idea puts its island in the middle and opens its key idea");
await key(page, "Enter");
await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.sel === id, I.Acceleration);
await key(page, "Escape");
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
t.eq((await snap(page)).centre, "phys", "back from the graph returns to the same island");

// ----- A: show everything -----
await key(page, "a");
s = await snap(page);
t.eq(s.shown.includes(I.Inertia) && s.shown.includes(I["Coulomb's law"]), true, "show all opens every key idea");
await key(page, "a");

// ----- Y: the look; the map stays the same -----
const before = await snap(page);
t.eq(before.look, "neuron", "it starts looking like a nerve cell");
t.eq(before.shown.some((k) => k.startsWith("z:")), true, "topics sit between the island and its key ideas");
await key(page, "y");
let after = await snap(page);
t.eq([after.look, await page.getAttribute("#lookPoe", "aria-pressed")], ["poe", "true"], "Y switches to the carved look");
t.eq([after.shown, after.nums, after.centre], [before.shown, before.nums, before.centre], "the look changes nothing else");
t.eq(await state(page, () => JSON.parse(localStorage.getItem("bonsai-beta.tech")).look), "poe", "the look is kept");
await page.click("#lookNeuron");
t.eq((await snap(page)).look, "neuron", "and back");
// pictures of the islands come from the garden's renderer, made on demand
await page.waitForFunction(() => bonsai.isles && bonsai.isles.hasData, null, { timeout: 60000 });
t.eq(await state(page, () => { const c = bonsai.isles.snap("found", { size: 64 }); const d = c.getContext("2d").getImageData(0, 0, 64, 64).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 400; }), true, "an island's picture has the island in it");
t.eq(await state(page, () => bonsai.S.view), "tech", "taking pictures leaves the tech tree where it was");

// ----- night: follows the garden -----
await state(page, () => localStorage.setItem("bonsai-beta.night", "1"));
await page.evaluate(() => { location.hash = "#/forest"; }); await page.waitForFunction(() => bonsai.S.view === "forest");
await page.evaluate(() => { location.hash = "#/techtree"; }); await page.waitForFunction(() => bonsai.S.view === "tech");
t.eq(await state(page, () => document.body.classList.contains("night-ui")), true, "at night the tech tree is dark");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-night.png" });
await state(page, () => localStorage.removeItem("bonsai-beta.night"));

// ----- L: the web -----
await key(page, "l");
t.eq((await snap(page)).mode, "web", "L switches to the web");
await page.waitForFunction(() => bonsai.tech.snapshot().settled, null, { timeout: 90000 });
await page.screenshot({ path: "tests/shots/tech-web.png" });
const p0 = await state(page, (id) => bonsai.tech.screenOf(id), I.Harmonics);
await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 60, p0.y + 50, { steps: 6 }); await page.mouse.up();
await page.waitForFunction(() => bonsai.tech.snapshot().settled, null, { timeout: 90000 });
t.eq((await state(page, () => bonsai.store.getMeta("techtree")))?.pin?.length, 1, "a dragged idea stays where it was put");
await key(page, "l");

// ----- Esc at the start, with nothing picked, leaves -----
await key(page, "h"); await page.mouse.click(1240, 120); await key(page, "Escape");
await page.waitForFunction(() => bonsai.S.view !== "tech");

// ----- phone -----
const phone = await t.page({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
await phone.waitForFunction(() => window.bonsai && bonsai.S.zones.length > 0);
await phone.evaluate(() => { location.hash = "#/techtree"; });
await phone.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
await settle(phone);
await phone.screenshot({ path: "tests/shots/tech-phone.png" });

await t.end();
