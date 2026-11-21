// Vocab 2: select words in a note for the quick panel (Alt+1… while it shows): Add to vocab keeps the sentence they
// were met in; Add context opens the term with Meaning ready; Flesh out copies a prompt for Claude and reads the reply
// back into the term's editor; over a term already kept, the panel opens that term. The term's panel has Claude and Google.
import { start, state } from "./lib.mjs";
import { sentenceAround, fleshPrompt, readFlesh } from "../src/vocab.js";

const t = await start("run22-quick", 4322, { channel: "beta" });

// ---- pure parts
const line = "Quiz on Friday. Same change in momentum over longer time → smaller force. Crumple zones help";
const s = line.indexOf("longer time");
t.eq(sentenceAround(line, s, s + 11), "Same change in momentum over longer time → smaller force.", "the sentence around a selection");
t.eq(readFlesh("**Impulse:** A push over time.\n\nAlso: J, impulse vector\n\nExample: a bat on a ball.", "Impulse"), { aliases: ["J", "impulse vector"], def: "A push over time.\n\nExample: a bat on a ball." }, "a reply is read into aliases and meaning");
t.eq(readFlesh("```\nAlso: none\nMeaning: Just this.\n```").def, "Just this.", "fences, 'none' and 'Meaning:' are dropped");
const pr = fleshPrompt({ term: "Impulse", quote: "Impulse = F × Δt", page: "Lecture 6", known: ["Momentum"] });
for (const w of ['"Impulse"', "> Impulse = F × Δt", "Lecture 6", "Momentum", "Also:"]) if (!pr.includes(w)) t.fail("the prompt lacks " + w);

// ---- in the app
const page = await t.page({}, "#/notes");
await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
await page.waitForSelector("body[data-ready]");
const lect = await state(page, () => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).id);
await page.evaluate((id) => { location.hash = "#/notes/" + id; }, lect); await page.waitForSelector(".blocks"); await page.waitForTimeout(500);
const select = (w) => page.evaluate((w) => {
  const tx = [...document.querySelectorAll(".blocks .tx")].find((e) => e.textContent.includes(w));
  const walk = document.createTreeWalker(tx, NodeFilter.SHOW_TEXT); let n;
  while ((n = walk.nextNode())) { const i = n.data.indexOf(w); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); tx.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } }
  return false;
}, w);
const panel = async () => { await page.waitForSelector(".qpanel"); return page.$$eval(".qpanel button", (b) => b.map((x) => x.dataset.act)); };

// Add to vocab
await select("crumple zones");
t.eq(await panel(), ["add", "context", "claude", "google", "action"], "the quick panel on new words");
await page.screenshot({ path: "tests/shots/vocab-quick.png" });
const blocksBefore = await state(page, (id) => JSON.stringify(bonsai.S.pages.find((p) => p.id === id).blocks), lect);
await page.keyboard.press("Alt+1");
await page.waitForFunction(() => bonsai.S.vocab.some((v) => v.term === "crumple zones"));
const cz = await state(page, () => bonsai.S.vocab.find((v) => v.term === "crumple zones"));
t.eq([cz.quote, cz.source], ["crumple zones, airbags, bending knees when landing", "Lecture 6: Momentum"], "Add to vocab keeps the sentence and the page");
if (await page.$(".qpanel")) t.fail("the panel stays after an action");
await page.waitForFunction(() => document.querySelector("#vocabBtn .vcount")?.textContent === "7", null, { timeout: 3000 }).catch(() => {});
t.eq(await page.textContent("#vocabBtn .vcount"), "7", "the Vocab row counts the new term");
await page.waitForTimeout(400);
t.eq(await state(page, (id) => JSON.stringify(bonsai.S.pages.find((p) => p.id === id).blocks), lect), blocksBefore, "the note's text is untouched");
if (!(await state(page, () => bonsai.vocab.hits.some((h) => h.range.toString() === "crumple zones")))) t.fail("the new term isn't underlined");

// Flesh out with Claude
await select("rockets");
await panel(); await page.keyboard.press("Alt+3");
await page.waitForSelector("#fleshReply");
await page.click("#fleshCopy");
const copied = await page.evaluate(() => navigator.clipboard.readText());
if (!copied.includes('"rockets"') || !copied.includes("mass changes, so use dp/dt")) t.fail("the copied prompt: " + copied.slice(0, 200));
await page.fill("#fleshReply", "Rockets: A rocket pushes gas out the back, and the gas pushes it forward.\n\nAlso: rocket engine\n\nIts mass falls as fuel burns, so F = ma doesn't hold.");
await page.click(".dialog .row.end button.primary");
await page.waitForSelector("#f-def");
t.eq(await page.inputValue("#f-aka"), "rocket engine", "Claude's other names go to Also called");
if (!(await page.inputValue("#f-def")).startsWith("A rocket pushes gas")) t.fail("Claude's meaning isn't in the editor");
t.eq(await page.evaluate(() => document.activeElement.id), "f-def", "the meaning has the focus");
await page.click(".dialog button.primary");
await page.waitForFunction(() => bonsai.S.vocab.some((v) => v.term === "rockets"));
t.eq(await state(page, () => bonsai.S.vocab.find((v) => v.term === "rockets").quote), "rockets: mass changes, so use dp/dt", "a fleshed-out term keeps its sentence");

// Add context on a term already kept: the panel opens that term
await select("Impulse");
t.eq(await panel(), ["open", "context", "claude", "google", "action"], "the quick panel on a kept term");
t.eq(await page.textContent(".qpanel button"), "ImpulseAlt+1", "it names the term");
await page.keyboard.press("Alt+2");
await page.waitForSelector("#f-def");
t.eq(await page.inputValue("#f-term"), "Impulse", "Add context edits the term that's there");
await page.keyboard.press("Escape"); await page.waitForTimeout(200);
await select("Impulse"); await panel(); await page.keyboard.press("Alt+1");
await page.waitForSelector(".vpanel");
t.eq(await page.$$eval(".vpanel .vfoot > button", (b) => b.map((x) => x.dataset.act || x.textContent)), ["claude", "google", "Edit"], "the term's panel has Claude, Google and Edit");
await page.screenshot({ path: "tests/shots/vocab-quick-panel.png" });

// Esc closes the panel and leaves the selection; a long selection gets no panel
await page.keyboard.press("Escape"); await page.waitForTimeout(200);
await select("Impulse"); await panel(); await page.keyboard.press("Escape");
if (await page.$(".qpanel")) t.fail("Esc doesn't close the quick panel");
t.eq(await page.evaluate(() => getSelection().toString()), "Impulse", "Esc leaves the selection");
await select("same change in momentum over longer time → smaller force");
t.eq(await panel(), ["action"], "a whole sentence gets only Action (run38-pages)");
await t.end();
