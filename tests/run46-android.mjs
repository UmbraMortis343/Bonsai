// Bonsai for Android, as the page sees it: in the app (here a stand-in for its bridge, `window.bonsaiAndroid`) Today
// has Reminders, saved through the bridge; the widget is handed the streak and what's left whenever Today changes;
// Share → Bonsai opens a picker (New page first, then pages, search at the top) that makes a page or adds to the
// end of one, typed or pen, with Undo; the phone can open Today; the menu shows a newer APK. In a browser none of
// it shows. android/ is built by .github/workflows/android.yml; the phone-only parts are tried on the phone.
import { start, state } from "./lib.mjs";

const t = await start("run46-android", 4347, { channel: "beta" });
const RELEASES = [
  { tag_name: "v0.41.0", html_url: "https://github.com/UmbraMortis343/Bonsai/releases/tag/v0.41.0", draft: false },
  { tag_name: "android-v0.2.0", html_url: "https://github.com/UmbraMortis343/Bonsai/releases/tag/android-v0.2.0", draft: false },
  { tag_name: "android-v0.1.0", html_url: "https://github.com/UmbraMortis343/Bonsai/releases/tag/android-v0.1.0", draft: false },
  { tag_name: "desktop-v0.9.0", html_url: "https://github.com/UmbraMortis343/Bonsai/releases/tag/desktop-v0.9.0", draft: false },
];
const bridge = () => {
  const D = (window.__droid = { today: [], reminders: { morningOn: false, morning: "07:30", eveningOn: false, evening: "19:00", allowed: true }, take: null, saved: [], copied: [], opened: [] });
  window.bonsaiAndroid = {
    info: () => JSON.stringify({ version: "0.1.0", code: 1, channel: "beta", features: ["reminders", "widget", "share", "save"] }),
    take: () => { const x = D.take; D.take = null; return JSON.stringify(x || {}); },
    reminders: () => JSON.stringify(D.reminders),
    setReminders: (s) => { Object.assign(D.reminders, JSON.parse(s)); return JSON.stringify(D.reminders); },
    today: (s) => { D.today.push(JSON.parse(s)); },
    copy: (x) => { D.copied.push(x); return true; },
    save: (name, type, b64) => { D.saved.push({ name, type, size: b64.length }); return true; },
    open: (u) => { D.opened.push(u); },
  };
};
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const open = async (droid, path = "#/notes") => {
  const ctx = await t.browser.newContext(phone);
  let asked = 0;
  await ctx.route("https://api.github.com/**", (r) => { asked++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RELEASES) }); });
  if (droid) await ctx.addInitScript(bridge);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => t.fail("page error: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) t.fail("console error: " + m.text()); });
  await page.goto(t.url + path); await page.waitForSelector("body[data-ready]");
  await page.evaluate(() => bonsai.isles?.setActive(false));
  return { page, asked: () => asked };
};
const menuLabels = async (page) => { await page.click("#moreBtn"); const l = await page.$$eval(".menu .mi span", (x) => x.map((e) => e.textContent)); await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" }); return l; };
const lastToday = (page) => state(page, () => __droid.today.at(-1));
const poke = (page, take) => page.evaluate((x) => { __droid.take = x; window.bonsaiAndroidPoke(); }, take);
const undo = async (page) => { await page.click("#toast .link"); };

// ----- in a browser: nothing of the phone's -----
{
  const { page, asked } = await open(false);
  t.eq(await state(page, () => document.body.dataset.android || ""), "", "a browser isn't the Android app");
  await page.evaluate(() => bonsai.today.show()); await page.waitForSelector("#today #todayStreak");
  t.eq(await page.$$("#todayRemind").then((x) => x.length), 0, "no Reminders in Today");
  await page.evaluate(() => bonsai.today.close());
  const labels = await menuLabels(page);
  t.eq([labels.includes("Reminders"), labels.some((x) => x.startsWith("Bonsai Android")), asked()], [false, false, 0], "nor in the menu, and no release check");
  // the open-Today address works anywhere
  await page.evaluate(() => { location.hash = "#/?today=1"; });
  await page.waitForSelector("#today #todayStreak");
  t.eq(await state(page, () => [location.hash, bonsai.S.view, bonsai.today.open]), ["#/", "isles", true], "#/?today=1 opens Today over the garden and tidies the address");
  await page.context().close();
}

// ----- in the Android app -----
const { page } = await open(true);
t.eq(await state(page, () => document.body.dataset.android), "1", "the page knows it's in the Android app");

// the widget gets today's numbers
await page.waitForFunction(() => __droid.today.length > 0);
const w0 = await lastToday(page), day = w0.day;
t.eq([typeof w0.streak, w0.left > 0, w0.done, w0.next?.left >= 0, typeof w0.next?.streak, w0.next.day > w0.day], ["number", true, false, true, "number", true], "the widget is told the streak, what's left, and tomorrow");

// reminders: in Today, set through the bridge
await page.evaluate(() => bonsai.today.show()); await page.waitForSelector("#today #todayRemind");
await page.click("#todayRemind"); await page.waitForSelector("#remBody");
t.eq(await page.$eval("#rem-morning", (e) => e.value), "07:30", "morning at half past seven to start");
await page.check("#rem-morningOn"); await page.fill("#rem-morning", "07:15"); await page.check("#rem-eveningOn");
await page.screenshot({ path: "tests/shots/android-reminders.png" });
await page.click(".dialog .btn.primary");
t.eq(await state(page, () => __droid.reminders), { morningOn: true, morning: "07:15", eveningOn: true, evening: "19:00", allowed: true }, "saved on the phone");
t.eq(await page.textContent("#toast"), "Reminders 07:15, 19:00", "and said so");

// the widget follows Today: one rated, then all
const n = await state(page, () => bonsai.today.pick().ids.length), calls = await state(page, () => __droid.today.length);
await page.click("#todayGo"); await page.waitForSelector("#today #tq #tqShow");
for (let i = 0; i < n; i++) {
  await page.waitForFunction((k) => bonsai.S.tq?.i === k && bonsai.S.tq.phase === "ask", i);
  await page.keyboard.press(" "); await page.waitForSelector("#tqRate");
  await page.keyboard.press("1"); await page.waitForFunction((k) => !bonsai.S.tq || bonsai.S.tq.i === k, i + 1);
  if (i === 0) { await page.waitForFunction((m) => __droid.today.at(-1).left === m - 1, n); t.eq(true, true, "one rated: one fewer left"); }
}
await page.waitForSelector("#today #todayScore");
await page.waitForFunction(() => __droid.today.at(-1).done);
t.eq(await lastToday(page).then((x) => [x.day, x.left, x.done, x.streak, x.next.streak]), [day, 0, true, 1, 1], "all done: the widget shows Done and a streak of one");
t.eq(await state(page, (c) => __droid.today.length > c, calls), true, "sent as it changed");
await page.waitForTimeout(400);
const sent = await state(page, () => __droid.today.length); await state(page, () => bonsai.refresh()); await page.waitForTimeout(400);
t.eq(await state(page, () => __droid.today.length), sent, "and not again when nothing changed");

// the back button closes Today, then lets the page's history have it
t.eq(await state(page, () => window.bonsaiBack()), true, "back closes Today");
t.eq(await state(page, () => [bonsai.today.open, window.bonsaiBack()]), [false, false], "then it's the history's");

// the phone opens Today (the widget, a reminder)
await poke(page, { open: "today" }); await page.waitForSelector("#today #todayStreak");
t.eq(await state(page, () => bonsai.S.view), "notes", "Today opens where he is");
await page.evaluate(() => window.bonsaiBack());

// the menu offers the newer APK
const labels = await menuLabels(page);
t.eq([labels.includes("Reminders"), labels.includes("Bonsai Android 0.2.0")], [true, true], "Reminders in the menu too, and a newer Bonsai for Android");
await page.click("#moreBtn"); await page.click('.mi:has-text("Bonsai Android 0.2.0")');
t.eq(await state(page, () => __droid.opened), ["https://github.com/UmbraMortis343/Bonsai/releases/tag/android-v0.2.0"], "which opens in the phone's browser");

// ----- share: a new page from text and a link -----
const pagesBefore = await state(page, () => bonsai.S.pages.length);
await poke(page, { share: { subject: "", text: "Momentum notes\nInteresting read https://example.com/momentum.", images: [] } });
await page.waitForSelector("#sharePick #shareList .grow2");
t.eq(await page.$$eval("#shareList .grow2 .gl", (x) => x.slice(0, 1).map((e) => e.textContent)), ["New page"], "New page first");
t.eq(await page.$eval("#shareList .grow2.new .gw", (e) => e.textContent), "Momentum notes", "named from the first line");
const rows = await page.$$eval("#shareList .grow2", (x) => x.length);
t.eq(rows > 4, true, "then the pages");
t.eq(await page.$eval("#shareWhat .shtext", (e) => e.textContent), "Momentum notes", "what's shared shows at the top");
await page.screenshot({ path: "tests/shots/android-share.png" });
await page.keyboard.press("Enter");
await page.waitForFunction(() => bonsai.S.view === "notes" && !document.querySelector("#sharePick"));
await page.waitForFunction((b) => bonsai.S.pages.length === b + 1, pagesBefore);
const made = await state(page, () => { const p = bonsai.S.pages.find((x) => x.id === bonsai.S.npage); return { title: p.title, src: p.props.find((x) => x.type === "url")?.value, html: p.blocks.map((b) => b.html).join("|") }; });
t.eq([made.title, made.src, made.html], ["Momentum notes", "https://example.com/momentum", 'Interesting read <a href="https://example.com/momentum" target="_blank" rel="noopener">https://example.com/momentum</a>.'], "a new page: the title, the rest as blocks, the link a link and its Source");
t.eq(await page.$eval("#pageTitle", (e) => e.value ?? e.textContent), "Momentum notes", "and it opens");
await undo(page);
await page.waitForFunction((b) => bonsai.S.pages.length === b, pagesBefore);
t.eq(await state(page, () => bonsai.S.pages.some((p) => p.title === "Momentum notes")), false, "Undo takes it away");

// ----- a picture into a new page -----
const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 300; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#3e7a4b"; g.fillRect(0, 0, 300, 200); return c.toDataURL("image/png").split(",")[1]; });
await poke(page, { share: { subject: "Whiteboard", text: "", images: [{ type: "image/png", data: png }] } });
await page.waitForSelector("#sharePick #shareWhat .shthumb");
await page.click("#shareList .grow2.new");
await page.waitForFunction((b) => bonsai.S.pages.length === b + 1, pagesBefore);
const pic = await state(page, async () => { const p = bonsai.S.pages.find((x) => x.id === bonsai.S.npage), b = p.blocks.find((x) => x.type === "image"); return { title: p.title, n: p.blocks.length, w: b?.w, h: b?.h, file: !!(b && (await bonsai.store.getFile(b.fileId))?.data) }; });
t.eq(pic, { title: "Whiteboard", n: 1, w: 300, h: 200, file: true }, "a picture becomes an image block, kept as a file");
await page.waitForSelector(".page figure img");

// ----- added to the end of a typed page, found by search -----
const lect = await state(page, () => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")));
await poke(page, { share: { subject: "", text: "Appended from the phone", images: [] } });
await page.waitForSelector("#sharePick");
await page.fill("#shareSearch", "lecture 6");
await page.waitForFunction((n) => document.querySelectorAll("#shareList .grow2").length < n, rows);
const found = await page.$$eval("#shareList .grow2", (x) => x.map((e) => [e.querySelector(".gl").textContent, e.querySelector(".gw").textContent]));
t.eq([found[0][0], found[1][0], found.slice(2).every(([, w]) => w.toLowerCase().includes("lecture 6"))], ["New page", lect.title, true], "search narrows the pages: by name, then what's inside");
await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
await page.waitForFunction((id) => bonsai.S.npage === id && !document.querySelector("#sharePick"), lect.id);
const after = await state(page, (id) => bonsai.S.pages.find((p) => p.id === id).blocks.map((b) => b.html), lect.id);
t.eq([after.length, after.at(-1)], [lect.blocks.length + 1, "Appended from the phone"], "added at the end of the page");
t.eq(await page.textContent("#toast span"), `Added to ${lect.title}`, "and said where");
await undo(page);
await page.waitForFunction((a) => bonsai.S.pages.find((p) => p.id === a.id).blocks.length === a.n, { id: lect.id, n: lect.blocks.length });
t.eq(true, true, "Undo takes it off again");

// ----- added under what's on a pen page -----
const pen = await state(page, async () => { const p = await bonsai.store.addPage({ kind: "ink", title: "Pen share", ink: { paper: "lined", strokes: [{ id: "s1", t: "pen", c: 0, p: [10, 10, 2, 120, 200, 2] }], items: [] } }); await bonsai.refresh(); return p.id; });
await poke(page, { share: { subject: "", text: "Seen on the bus\nhttps://example.com/bus", images: [{ type: "image/png", data: png }] } });
await page.waitForSelector("#sharePick");
t.eq(await page.$eval("#shareList .grow2:nth-child(2)", (e) => e.dataset.id), pen, "the page edited last comes first after New page");
await page.click(`#shareList .grow2[data-id="${pen}"]`);
await page.waitForFunction((id) => bonsai.S.npage === id && bonsai.S.pages.find((p) => p.id === id).ink.items.length === 2, pen);
const items = await state(page, (id) => bonsai.S.pages.find((p) => p.id === id).ink.items, pen);
t.eq([items[0].t, items[0].html, items[0].y >= 236, items[1].t, items[1].y > items[0].y + 36, items[1].src.startsWith("data:image/")], ["text", "Seen on the bus<br>https://example.com/bus", true, "img", true, true], "a pen page gets a text box under the ink, then the picture under that");
t.eq(await state(page, (id) => bonsai.S.pages.find((p) => p.id === id).ink.strokes.length, pen), 1, "the ink is untouched");
await page.waitForSelector(".inkitems .inktext");
await undo(page);
await page.waitForFunction((id) => bonsai.S.pages.find((p) => p.id === id).ink.items.length === 0, pen);
t.eq(true, true, "Undo takes them off");

// ----- cancelling and saving files -----
await poke(page, { share: { subject: "", text: "Never mind", images: [] } });
await page.waitForSelector("#sharePick");
t.eq(await state(page, () => window.bonsaiBack()), true, "back closes the picker");
t.eq(await page.$$("#sharePick").then((x) => x.length), 0, "and nothing is made");
await page.click("#moreBtn"); await page.click('.mi:has-text("Export backup")');
await page.waitForFunction(() => __droid.saved.length === 1);
t.eq(await state(page, () => [__droid.saved[0].name.startsWith("bonsai-"), __droid.saved[0].type, __droid.saved[0].size > 1000]), [true, "application/json", true], "a backup is saved through the phone");
await state(page, () => navigator.clipboard.writeText("copied on the phone"));
t.eq(await state(page, () => __droid.copied), ["copied on the phone"], "the clipboard goes through the phone");
await t.end();
