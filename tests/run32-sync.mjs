// Sync between devices (sync.js, store.js's outbox) against a stand-in Supabase (fake-supabase.mjs): two browser
// profiles are two devices. Sign in with an emailed code from the menu; what one adds, edits and deletes reaches
// the other; the newer of two edits wins; a record the server refuses doesn't hold up the rest; the meaning
// model's switch stays on its own device; everything goes on the app's channel, not the beta's.
import { start, state } from "./lib.mjs";
import { fakeSupabase } from "./fake-supabase.mjs";

const t = await start("run32-sync", 4332);
const fake = await fakeSupabase(4333);
const device = async () => {
  const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { localStorage.setItem("bonsai.sync.url", "http://localhost:4333"); localStorage.setItem("bonsai.sync.key", "test-key"); });
  const page = await ctx.newPage(); page.on("pageerror", (e) => t.fail("page error: " + e.message));
  await page.goto(t.url); await page.waitForSelector("body[data-ready]"); await page.evaluate(() => bonsai.isles?.setActive(false));
  return page;
};
const signIn = async (page) => {
  await page.click("#moreBtn"); await page.click('.mi:has-text("Sync devices")');
  await page.fill("#f-email", "me@example.com"); await page.keyboard.press("Enter");
  await page.waitForSelector("#f-code"); await page.fill("#f-code", "123456"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#toast")?.textContent.startsWith("Synced"));
};
const syncNow = (page) => page.evaluate(() => bonsai.sync.syncNow());
const node = (page, id) => page.evaluate((id) => { const n = bonsai.S.byId.get(id); return n ? { title: n.title, note: n.note } : null; }, id);

const A = await device(), B = await device();
// A has a topic, a graph and an idea before it ever syncs
const ids = await A.evaluate(async () => {
  const z = await bonsai.store.createZone({ name: "Electromagnetism" });
  const g = await bonsai.store.createTree({ zoneId: z.id, name: "Induction", core: "Faraday's law" });
  const n = await bonsai.store.addNode(g.rootId, { title: "Lenz's law", note: "opposes the change" });
  await bonsai.store.setMeta("ai", true); await bonsai.refresh(); return { z: z.id, g: g.id, n: n.id };
});
await signIn(A);
t.eq([[...fake.rows.values()].some((r) => r.store === "nodes" && r.id === ids.n && r.data.title === "Lenz's law"), [...fake.rows.values()].every((r) => r.channel === ""), [...fake.rows.values()].some((r) => r.store === "meta" && r.id === "ai")], [true, true, false],
  "signing in sends what was already here, on the app's channel; the meaning model's switch stays behind");

// B signs in and gets it all
await signIn(B);
t.eq([await node(B, ids.n), await B.evaluate((z) => bonsai.S.zones.some((x) => x.id === z), ids.z)], [{ title: "Lenz's law", note: "opposes the change" }, true], "the other device gets the topic, graph and idea");

// an edit on B reaches A; a delete on A reaches B
await B.evaluate((id) => bonsai.store.updateNode(id, { note: "the induced current opposes the change in flux" }), ids.n); await syncNow(B);
await syncNow(A);
t.eq((await node(A, ids.n)).note, "the induced current opposes the change in flux", "an edit travels");
const extra = await A.evaluate(async (root) => (await bonsai.store.addNode(root, { title: "Eddy currents" })).id, await A.evaluate((g) => bonsai.S.trees.find((x) => x.id === g).rootId, ids.g));
await syncNow(A); await syncNow(B);
t.eq((await node(B, extra))?.title, "Eddy currents", "a new idea travels");
await A.evaluate((id) => bonsai.store.deleteNode(id), extra); await syncNow(A); await syncNow(B);
t.eq(await node(B, extra), null, "a delete travels");

// both edit the same idea before syncing: the later edit wins on both
await A.evaluate((id) => bonsai.store.updateNode(id, { title: "Lenz (A)" }), ids.n);
await B.waitForTimeout(30);
await B.evaluate((id) => bonsai.store.updateNode(id, { title: "Lenz's law (B, later)" }), ids.n);
await syncNow(A); await syncNow(B); await syncNow(A);
t.eq([(await node(A, ids.n)).title, (await node(B, ids.n)).title], ["Lenz's law (B, later)", "Lenz's law (B, later)"], "the newer of two edits wins, on both devices");

// a record the server refuses doesn't stop the others; it waits to be tried again
await A.evaluate(async () => { await bonsai.store.createZone({ name: "Circuits" }); await bonsai.refresh(); await bonsai.store.setMeta("reject-me", 1); });
const r = await syncNow(A);
t.eq([r.skipped, [...fake.rows.values()].some((x) => x.store === "zones" && x.data?.name === "Circuits"), await A.evaluate(() => bonsai.store.pendingCount())], [1, true, 1], "one bad record is skipped and kept; the rest go");

// writes sync by themselves a few seconds later
await B.evaluate((id) => bonsai.store.updateNode(id, { note: "saved on B, nothing pressed" }), ids.n);
for (let i = 0; i < 60 && (await B.evaluate(() => bonsai.store.pendingCount())) > 0; i++) await B.waitForTimeout(250);
await syncNow(A);
t.eq((await node(A, ids.n)).note, "saved on B, nothing pressed", "a save goes up on its own a few seconds later");

// the menu says it's on, and signing out keeps everything here
await A.click("#moreBtn"); t.eq(await A.$$eval(".mi span", (s) => s.some((x) => x.textContent.startsWith("Sync · "))), true, "the menu shows when it last synced");
await A.click('.mi:has-text("Sync · ")'); await A.waitForSelector("#syncOut");
await A.screenshot({ path: "tests/shots/sync-dialog.png" });
await A.click("#syncOut");
t.eq([await A.evaluate(() => bonsai.sync.signedIn()), !!(await node(A, ids.n))], [false, true], "signing out keeps the data on the device");

fake.close();
await t.end();
