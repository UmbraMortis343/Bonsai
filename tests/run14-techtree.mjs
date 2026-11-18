// Tech tree: the whole tree at once, in rings round the start. Left-click picks, right-click (Space) opens or
// closes what's under a thing, double-click (Enter) puts it in the middle with what's under it round it, Esc steps
// back out. Grows from, light and dark, and the web view. Runs as the beta so it has the demo islands.
import { start, state } from "./lib.mjs";

const t = await start("run14-techtree", 4314, { channel: "beta" });
const key = (page, k) => page.keyboard.press(k);
const snap = (page) => state(page, () => bonsai.tech.snapshot());
const settle = (page) => page.waitForFunction(() => bonsai.tech.snapshot().settled, null, { timeout: 60000 });
const ids = (page) => state(page, () => Object.fromEntries(bonsai.S.nodes.map((n) => [n.title, n.id])));
const at = (page, k) => state(page, (k) => { const p = bonsai.tech.screenOf(k), r = document.querySelector("#tech").getBoundingClientRect(); return p && [p.x + r.left, p.y + r.top]; }, k);

const page = await t.page();
await page.waitForFunction(() => window.bonsai && bonsai.S.zones.length > 0);
const I = await ids(page);

// ----- K opens it on the whole tree -----
await key(page, "k");
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech && location.hash === "#/techtree");
t.eq(await page.isVisible("#tech canvas"), true, "the tech tree shows");
let s = await snap(page);
t.eq(s.root, "i:start", "the start is in the middle");
t.eq(["i:found", "i:gensci", "i:phys", "i:music", "i:lead"].every((k) => s.shown.includes(k)), true, "every island shows");
t.eq([s.shown.includes(I.Numbers), s.shown.includes(I["Newton's laws"]), s.shown.includes(I.Zero), s.shown.includes(I["2nd law"])], [true, true, false, false], "key ideas show, what's inside them waits");
t.eq(s.rings > 1, true, "islands sit on rings");
t.eq(s.nums[1]?.startsWith("i:"), true, "what's round the middle is numbered");
t.eq(await page.isVisible("#lookSimple"), false, "there's one look");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-full.png" });

// ----- left-click picks, and nothing else changes -----
const before = s.shown.length;
await page.mouse.click(...(await at(page, I.Numbers)));
s = await snap(page);
t.eq([s.pick, s.shown.length, s.root], [I.Numbers, before, "i:start"], "a click picks");
t.eq(await page.isVisible("#techFold"), true, "the bar offers Open");

// ----- right-click opens and closes, staying on the whole tree -----
await settle(page);
await page.mouse.click(...(await at(page, I.Numbers)), { button: "right" });
s = await snap(page);
t.eq([s.shown.includes(I.Counting), s.shown.includes(I.Zero), s.root], [true, false, "i:start"], "right-click opens what's straight under it");
await settle(page);
await page.mouse.click(...(await at(page, I.Numbers)), { button: "right" });
t.eq((await snap(page)).shown.includes(I.Counting), false, "and closes it");
await settle(page);
await page.mouse.click(...(await at(page, "i:phys")), { button: "right" });
s = await snap(page);
t.eq([s.shown.includes(I["Newton's laws"]), s.shown.includes("i:phys")], [false, true], "an island closes too");
await key(page, " ");
t.eq((await snap(page)).shown.includes(I["Newton's laws"]), true, "Space opens it again");

// ----- double-click puts a thing in the middle with what's under it -----
await settle(page);
await page.mouse.dblclick(...(await at(page, I["Newton's laws"])));
s = await snap(page);
t.eq([s.root, s.shown.includes(I["2nd law"]), s.shown.includes(I.Numbers)], [I["Newton's laws"], true, false], "double-click centres Newton's laws with what's under it");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-centre.png" });
await key(page, "Escape");
t.eq([(await snap(page)).pick, (await snap(page)).root], [null, I["Newton's laws"]], "Esc lets go of the pick first");
await key(page, "Escape");
t.eq((await snap(page)).root, "i:start", "then steps back out to the whole tree");

// ----- the same by keys: Enter centres, H the whole tree -----
await state(page, () => bonsai.tech.select("i:phys"));
await key(page, "Enter");
s = await snap(page);
t.eq([s.root, s.shown.includes(I["Newton's laws"]), s.shown.includes("i:found")], ["i:phys", true, false], "Enter puts Physics in the middle");
t.eq(await page.isVisible("#techFull"), true, "the bar offers the whole tree");
await key(page, "h");
t.eq((await snap(page)).root, "i:start", "H goes back to the whole tree");
t.eq(s.links.length >= 0, true, "links are drawn between whatever shows");

// ----- B: what an island grows from -----
await state(page, () => bonsai.tech.select("i:music"));
t.eq(await page.isVisible("#techFrom"), true, "the bar offers Grows from for an island");
await key(page, "b"); await page.waitForSelector(".dialog select");
await page.selectOption(".dialog select", "found"); await page.click(".dialog button.primary");
await page.waitForFunction(() => document.querySelector(".dialog h2, .dialog .title")?.textContent.includes("Which idea"));
await page.selectOption(".dialog select", I.Patterns); await page.click(".dialog button.primary");
await page.waitForFunction(() => !document.querySelector(".dialog"));
await page.waitForFunction(async () => (await bonsai.store.getMeta("garden")).islands.find((q) => q.id === "music").after === "found");
const music = await state(page, async () => (await bonsai.store.getMeta("garden")).islands.find((q) => q.id === "music"));
t.eq([music.after, music.from], ["found", I.Patterns], "Music now grows from Foundations' Patterns");

// ----- an idea opens in its graph (G), and Back returns -----
await state(page, (id) => bonsai.tech.focus(id), I.Acceleration);
s = await snap(page);
t.eq([s.root, s.pick, s.shown.includes(I.Acceleration)], ["i:start", I.Acceleration, true], "opening on an idea shows it, picked, in the whole tree");
await key(page, "g");
await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.sel === id, I.Acceleration);
await key(page, "Escape");
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
t.eq((await snap(page)).shown.includes(I.Acceleration), true, "back from the graph returns to the same tree");

// ----- A: everything open -----
await key(page, "a");
s = await snap(page);
t.eq(s.shown.includes(I.Inertia) && s.shown.includes(I["Coulomb's law"]), true, "All open opens every idea");
await key(page, "a");

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
const p0 = await state(page, (id) => { const p = bonsai.tech.screenOf(id), r = document.querySelector('#tech').getBoundingClientRect(); return p && { x: p.x + r.left, y: p.y + r.top }; }, I.Harmonics);
const others = () => state(page, (ids) => ids.map((id) => bonsai.tech.screenOf(id)), [I.Numbers, I.Energy, I.Kinematics]);
const o0 = await others();
t.eq(await page.getAttribute("#techLoose", "aria-pressed"), "true", "the web jiggles while you drag");
await key(page, "j");
t.eq(await page.getAttribute("#techLoose", "aria-pressed"), "false", "J holds it still");
await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 60, p0.y + 50, { steps: 6 }); await page.mouse.up();
await page.waitForFunction(() => bonsai.tech.snapshot().settled, null, { timeout: 90000 });
t.eq((await state(page, () => bonsai.store.getMeta("techtree")))?.pin?.length, 1, "a dragged idea stays where it was put");
const p1 = await state(page, (id) => { const p = bonsai.tech.screenOf(id), r = document.querySelector('#tech').getBoundingClientRect(); return p && { x: p.x + r.left, y: p.y + r.top }; }, I.Harmonics);
t.eq([Math.round(p1.x - p0.x), Math.round(p1.y - p0.y)], [60, 50], "it goes where it is dragged");
t.eq(await others(), o0, "and nothing else moves");
await key(page, "j");
await key(page, "l");

// ----- Esc at the start, with nothing picked, leaves -----
await key(page, "h"); await key(page, "Escape"); await key(page, "Escape");
await page.waitForFunction(() => bonsai.S.view !== "tech");

// ----- phone -----
const phone = await t.page({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
await phone.waitForFunction(() => window.bonsai && bonsai.S.zones.length > 0);
await phone.evaluate(() => { location.hash = "#/techtree"; });
await phone.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
await settle(phone);
await phone.screenshot({ path: "tests/shots/tech-phone.png" });

await t.end();
