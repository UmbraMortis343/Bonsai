// The beta: built as its own copy, with its own database and settings, and demo islands on first open.
import { start, state } from "./lib.mjs";

const t = await start("run15-beta", 4315, { channel: "beta" });
const page = await t.page();
t.eq(await page.title(), "Bonsai Beta", "the beta is named as such");
t.eq(await page.isVisible(".channel"), true, "a beta tag shows");
await page.waitForFunction(() => bonsai.S.zones.length > 0);
const s = await state(page, async () => ({ zones: bonsai.S.zones.map((z) => z.name), ideas: bonsai.S.nodes.length, links: bonsai.S.links.length,
  dbs: (await indexedDB.databases()).map((d) => d.name), islands: (await bonsai.store.getMeta("garden")).islands.map((i) => i.name) }));
t.eq(s.dbs.includes("bonsai-beta") && !s.dbs.includes("bonsai"), true, "it keeps its own database");
t.eq(s.islands, ["Foundations", "General science", "Maths", "Physics", "Leadership", "Music"], "the demo islands are loaded");
t.eq(s.zones.includes("Mechanics") && s.ideas > 150 && s.links > 15, true, "with topics, ideas and links");
const due = await state(page, () => bonsai.S.nodes.filter((n) => Date.parse(n.srs.due) <= Date.now()).length);
t.eq(due > 30 && due < 120, true, "some ideas are due, so watering and dim ideas can be tried");
await page.evaluate(() => { localStorage.clear(); });
await page.evaluate(() => bonsai.store.createZone({ name: "Scratch" }));
await page.reload(); await page.waitForFunction(() => window.bonsai && bonsai.S.zones.length > 0);
t.eq(await state(page, () => bonsai.S.zones.some((z) => z.name === "Scratch")), true, "the demo isn't loaded over changes made since");
const sw = await page.evaluate(() => fetch("sw.js").then((r) => r.text()));
t.eq(sw.includes('const CHANNEL = "beta" === "beta"'), true, "its worker knows it is the beta");
await t.end();
