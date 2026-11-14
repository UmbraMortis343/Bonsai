// Tech tree: a flat map of hubs, islands and topics that opens out to key ideas and every idea,
// with links drawn between whatever is open, and a web of every idea that keeps where you drag things.
import { start, state } from "./lib.mjs";

const t = await start("run14-techtree", 4314);
const key = (page, k) => page.keyboard.press(k);
const tt = (page) => state(page, () => bonsai.tech.state());
const settle = (page) => page.waitForFunction(() => bonsai.tech.state().settled, null, { timeout: 60000 });

// Two hubs; Physics has four topics, so links run inside Physics and out to Maths and Music.
export const seedMap = (page) => page.evaluate(async () => {
  const s = bonsai.store, ids = {}, zones = {};
  const graph = async (zone, name, core, branches) => {
    const tr = await s.createTree({ zoneId: zones[zone], name, core }); ids[core] = tr.rootId;
    for (const [b, leaves] of branches) { const n = await s.addNode(tr.rootId, { title: b, note: b + " in short" }); ids[b] = n.id; for (const l of leaves) ids[l] = (await s.addNode(n.id, { title: l })).id; }
    return tr;
  };
  for (const z of ["Mechanics", "Electromagnetism", "Waves", "Thermodynamics", "Calculus", "Linear algebra", "Synthesis", "Harmony"]) zones[z] = (await s.createZone({ name: z })).id;
  ids.mechTree = (await graph("Mechanics", "Newtonian mechanics", "Newton's laws", [["Kinematics", ["Velocity", "Acceleration", "Projectiles"]], ["Forces", ["Friction", "Tension", "Free-body diagrams"]], ["Energy", ["Work", "Power", "Conservation of energy"]], ["Momentum", ["Impulse", "Collisions"]]])).id;
  await graph("Mechanics", "Rotation", "Torque", [["Angular momentum", ["Moment of inertia"]], ["Circular motion", ["Centripetal force"]]]);
  await graph("Electromagnetism", "Fields", "Maxwell's equations", [["Electric field", ["Coulomb's law", "Gauss's law"]], ["Magnetic field", ["Lorentz force", "Ampère's law"]], ["Induction", ["Faraday's law", "Lenz's law"]]]);
  await graph("Waves", "Waves", "Wave equation", [["Superposition", ["Interference", "Standing waves"]], ["Electromagnetic waves", ["Light", "Polarisation"]], ["Fourier analysis", ["Harmonics", "Spectra"]]]);
  await graph("Thermodynamics", "Heat", "Laws of thermodynamics", [["Entropy", ["Heat engines"]], ["Ideal gas", ["Kinetic theory"]]]);
  await graph("Calculus", "Calculus", "Limits", [["Derivatives", ["Chain rule", "Rates of change"]], ["Integrals", ["Area under a curve", "Fundamental theorem"]], ["Differential equations", ["Harmonic oscillator"]]]);
  await graph("Linear algebra", "Linear algebra", "Vectors", [["Matrices", ["Eigenvalues"]], ["Vector spaces", ["Basis"]]]);
  await graph("Synthesis", "Synthesis", "Subtractive synthesis", [["Oscillators", ["Sawtooth", "Square"]], ["Filters", ["Resonance", "Cutoff"]], ["Envelopes", ["ADSR"]]]);
  await graph("Harmony", "Harmony", "Intervals", [["Tuning", ["Just intonation", "12-TET"]], ["Chords", ["Triads"]]]);
  const L = [["Velocity", "Derivatives", "rate of change"], ["Acceleration", "Rates of change"], ["Harmonic oscillator", "Standing waves"], ["Electromagnetic waves", "Maxwell's equations", "predicted by"],
    ["Fourier analysis", "Oscillators"], ["Harmonics", "Just intonation"], ["Spectra", "Filters"], ["Conservation of energy", "Laws of thermodynamics"], ["Lorentz force", "Forces"], ["Free-body diagrams", "Vectors"],
    ["Eigenvalues", "Standing waves"], ["Gauss's law", "Integrals"], ["Kinetic theory", "Collisions"], ["Sawtooth", "Harmonics"]];
  for (const [a, b, label] of L) await s.addLink(ids[a], ids[b], { label: label || "" });
  const isle = (id, name, landmark, hubId, zs) => ({ id, name, landmark, hubId, zoneIds: zs.map((z) => zones[z]) });
  await s.setMeta("garden", { hubs: [{ id: "acad", name: "Academics" }, { id: "play", name: "Hobbies" }], zone: {}, patron: "none", islands: [
    isle("phys", "Physics", "academy", "acad", ["Mechanics", "Electromagnetism", "Waves", "Thermodynamics"]), isle("maths", "Maths", "statue", "acad", ["Calculus", "Linear algebra"]), isle("music", "Music", "amphitheatre", "play", ["Synthesis", "Harmony"])] });
  await bonsai.refresh();
  return { ids, zones };
});

const page = await t.page();
const { ids, zones } = await seedMap(page);

// ----- K opens it, at the key ideas -----
await key(page, "k");
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech && location.hash === "#/techtree");
t.eq(await page.isVisible("#tech canvas"), true, "the tech tree shows");
t.eq(await page.isVisible("#stage"), false, "the 3D stage is hidden");
let s = await tt(page);
t.eq(s.level, 1, "it opens at the key ideas");
t.eq([s.shown.includes(ids["Newton's laws"]), s.shown.includes(ids.Kinematics), s.shown.includes(ids.Velocity)], [true, true, false], "trunks and main branches show, deeper ideas wait");
t.eq(s.pairs.some((p) => [p.a, p.b].sort().join() === [ids.Kinematics, ids.Derivatives].sort().join()), true, "a link to a folded idea is drawn to its open branch");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-key.png" });

// ----- 1: topics only, links gathered between topics -----
await key(page, "1");
s = await tt(page);
t.eq(s.shown.length, 8, "only the eight topics show");
const zk = (z) => "z:" + zones[z], pair = (a, b) => s.pairs.find((p) => [p.a, p.b].sort().join() === [zk(a), zk(b)].sort().join());
t.eq(pair("Mechanics", "Calculus")?.n, 2, "two links between Mechanics and Calculus become one thicker line");
t.eq(!!pair("Electromagnetism", "Waves"), true, "links between topics inside Physics show");
t.eq(!!pair("Waves", "Synthesis"), true, "links between subjects show");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-topics.png" });

// ----- keys walk it like a list -----
await key(page, "ArrowDown");
t.eq((await tt(page)).sel, zk("Mechanics"), "the first arrow picks the first topic");
await key(page, "ArrowRight");
s = await tt(page);
t.eq([s.open.includes(zk("Mechanics")), s.shown.includes(ids["Newton's laws"]), s.shown.includes(ids.Kinematics)], [true, true, false], "→ opens a topic to its trunks");
await key(page, "ArrowRight"); await key(page, "ArrowRight");
t.eq((await tt(page)).open.includes(ids["Newton's laws"]), true, "→ again steps in and opens a trunk");
await key(page, "ArrowLeft");
t.eq((await tt(page)).open.includes(ids["Newton's laws"]), false, "← folds it");
t.eq(await page.isVisible("#techOpen"), true, "the bar offers to open what's picked");

// ----- 3: everything -----
await key(page, "3");
s = await tt(page);
t.eq(s.shown.length, await state(page, () => bonsai.S.nodes.length + 8), "every idea shows");
t.eq(s.pairs.length, 14, "every link is drawn between its own two ideas");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-all.png" });

// ----- clicking: a folded branch opens, Enter opens an idea in its graph -----
await key(page, "2");
const at = await page.evaluate((id) => bonsai.tech.screenOf(id), ids.Forces);
await page.mouse.click(at.x + 30, at.y);
s = await tt(page);
t.eq([s.sel, s.open.includes(ids.Forces)], [ids.Forces, true], "clicking a branch picks it and opens it");
await key(page, "Enter");
await page.waitForFunction((id) => bonsai.S.view === "tree" && bonsai.S.sel === id, ids.Forces);
await key(page, "Escape");
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
t.eq((await tt(page)).sel, ids.Forces, "back from the graph returns to the same spot");

// ----- L: the web of every connection -----
await key(page, "l");
s = await tt(page);
t.eq(s.mode, "web", "L switches to the web");
t.eq(s.pairs.length, 14, "the web draws every link");
t.eq(await page.isVisible("#lvTopics"), false, "the web has no levels");
await settle(page);
await page.screenshot({ path: "tests/shots/tech-web.png" });
const before = await page.evaluate((id) => bonsai.tech.screenOf(id), ids.Harmonics);
await page.mouse.move(before.x, before.y); await page.mouse.down(); await page.mouse.move(before.x + 60, before.y + 50, { steps: 6 }); await page.mouse.up();
await settle(page);
const lay = await state(page, () => bonsai.store.getMeta("techtree"));
t.eq(lay?.pin?.length, 1, "a dragged idea stays where it was put");

// ----- kept across a reload -----
await page.reload(); await page.waitForSelector("body[data-ready]");
await page.evaluate(() => { location.hash = "#/techtree"; });
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
s = await tt(page);
t.eq(s.mode, "web", "the mode is kept");
const p0 = lay.pos[ids.Harmonics], again = await state(page, () => bonsai.store.getMeta("techtree"));
t.eq(again.pos[ids.Harmonics], p0, "positions are kept");
await key(page, "l"); await key(page, "1");

// ----- from a topic in the garden, it opens on that topic -----
await page.evaluate(() => { location.hash = "#/"; });
await page.waitForSelector("body[data-isles=ready]", { timeout: 90000 });
await page.evaluate(() => bonsai.isles.setActive(false));
await page.evaluate((z) => { location.hash = "#/techtree/" + z; }, zones.Waves);
await page.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
s = await tt(page);
t.eq([s.sel, s.open.includes(zk("Waves"))], [zk("Waves"), true], "a topic opened from the garden is picked and opened");

// ----- phone -----
const phone = await t.page({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
await seedMap(phone);
await phone.evaluate(() => { location.hash = "#/techtree"; });
await phone.waitForFunction(() => bonsai.S.view === "tech" && bonsai.tech);
await settle(phone);
await phone.screenshot({ path: "tests/shots/tech-phone.png" });

await t.end();
