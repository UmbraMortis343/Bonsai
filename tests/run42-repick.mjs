// Beta only (0.37.1): Repick today's questions draws a fresh ten from every idea that can be asked, due or not,
// from the menu, from Today (⇧R) or its button; the main app has none of it.
import { start, state } from "./lib.mjs";

const t = await start("run42-repick", 4342, { channel: "beta" });
const page = await t.page({}, "#/");
await page.waitForSelector("body[data-ready]");
await page.keyboard.press("y"); await page.waitForSelector("#todayRepick");
const before = await state(page, () => bonsai.S.todayPick?.ids || []);
let changed = false;
for (let i = 0; i < 4 && !changed; i++) {
  await page.keyboard.press("Shift+R");
  await page.waitForFunction((b) => JSON.stringify(bonsai.S.todayPick?.ids) !== b, JSON.stringify(before), { timeout: 5000 }).then(() => { changed = true; }).catch(() => {});
}
const after = await state(page, () => ({ ids: bonsai.S.todayPick.ids, rated: Object.keys(bonsai.S.todayPick.rated || {}).length }));
t.eq([changed, after.ids.length > 0, after.rated], [true, true, 0], "⇧R in Today repicks the day's questions, none rated yet");
await page.click("#todayRepick"); await page.waitForTimeout(300);
t.eq(await state(page, () => bonsai.S.todayPick.ids.length > 0), true, "the button repicks too");
await page.screenshot({ path: "tests/shots/repick-today.png" });
await page.keyboard.press("y");
await page.click("#moreBtn"); t.eq(await page.locator(".menu >> text=Repick today's questions").count(), 1, "Repick is in the menu on the beta");
await page.keyboard.press("Escape");

const m = await start("run42-repick-main", 4343);
const mp = await m.page({}, "#/");
await mp.waitForSelector("body[data-ready]");
await mp.keyboard.press("y"); await mp.waitForSelector("#today");
t.eq(await mp.locator("#todayRepick").count(), 0, "no Repick in the main app");
await m.end();
await t.end();
