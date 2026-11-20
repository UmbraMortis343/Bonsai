// Bonsai Desktop end to end, under a virtual display: the real Electron app opens a local build of Bonsai Beta,
// the bridge reaches a stand-in Claude Code CLI (test/fake-claude.mjs), and Flesh out fills its reply by itself.
//   cd desktop && npm install && xvfb-run -a node test/smoke.mjs
import { _electron as electron } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url)), desk = join(here, ".."), root = join(desk, "..");
const { serve } = await import(join(root, "scripts/serve.mjs"));
const site = join(root, "tests/.out/desktop");
execFileSync("node", ["scripts/build.mjs", "tests/.out/desktop", "", "beta"], { cwd: root, stdio: "ignore" });
const port = 4391, server = await serve(() => site, port);
const data = mkdtempSync(join(tmpdir(), "bonsai-desk-")), log = join(data, "claude.log");
let failed = false; const fail = (m) => { console.error("FAIL desktop:", m); failed = true; };
const eq = (got, want, m) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${m}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };

const reply = "Rockets: A rocket pushes gas out the back, and the gas pushes it forward.\n\nAlso: rocket engine";
const app = await electron.launch({
  executablePath: createRequire(join(desk, "package.json"))("electron"), args: [desk, "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  env: { ...process.env, BONSAI_URL: `http://localhost:${port}/Bonsai/`, BONSAI_DATA: data, BONSAI_CLAUDE: join(here, "fake-claude.mjs"), FAKE_LOG: log, FAKE_REPLY: reply, ANTHROPIC_API_KEY: "sk-should-not-pass" },
});
const page = await app.firstWindow();
page.on("pageerror", (e) => fail("page error: " + e.message)); page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.waitForSelector("body[data-ready]", { timeout: 60000, state: "attached" }).catch(async (e) => { console.error(page.url(), await page.evaluate(() => document.body?.outerHTML.slice(0, 400))); throw e; });
eq(await page.evaluate(() => typeof window.bonsaiDesktop?.claude?.ask), "function", "the page has the bridge");
eq(await page.evaluate(() => bonsaiDesktop.claude.status(true).then((s) => [s.found, s.loggedIn, s.version])), [true, true, "2.1.0"], "Claude Code is found and signed in");

// The bridge on its own: the reply streams, then resolves.
const r = await page.evaluate(async () => { const seen = []; const off = bonsaiDesktop.claude.onEvent((e) => seen.push(e.text)); const res = await bonsaiDesktop.claude.ask({ reqId: "t1", system: "s", prompt: "Grow this\nmore" }); off(); return { res, seen }; });
eq([r.res.ok, r.res.text, r.seen.length >= 2], [true, reply, true], "a reply streams back and resolves");
const calls = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((c) => c.args[0] === "-p");
const a = calls[0].args;
eq([a[a.indexOf("--tools") + 1], a.includes("--no-session-persistence"), calls[0].key, calls[0].cwd.includes("claude-workspace")], ["", true, false, true], "no tools, no saved session, no API key, a quiet folder");

// A picture goes through too (handwriting to text), as one stream-json message with the image first.
const pic = await page.evaluate(() => bonsaiDesktop.claude.ask({ reqId: "t2", system: "s", prompt: "Transcribe", images: [{ media_type: "image/png", data: "iVBORw0KGgo=" }, { media_type: "text/html", data: "x" }] }));
eq([pic.ok, pic.text, await page.evaluate(() => bonsaiDesktop.features)], [true, "ECHO: IMAGES 1 image/png", ["images"]], "a picture reaches Claude Code; anything not an image is dropped");

// In the app: Flesh out asks Claude by itself, and the reply goes to the term's editor as before.
const lect = await page.evaluate(() => bonsai.S.pages.find((p) => p.title.startsWith("Lecture 6")).id);
await page.evaluate((id) => { location.hash = "#/notes/" + id; }, lect); await page.waitForSelector(".blocks"); await page.waitForTimeout(500);
await page.evaluate((w) => {
  const tx = [...document.querySelectorAll(".blocks .tx")].find((e) => e.textContent.includes(w)), walk = document.createTreeWalker(tx, NodeFilter.SHOW_TEXT); let n;
  while ((n = walk.nextNode())) { const i = n.data.indexOf(w); if (i >= 0) { const g = document.createRange(); g.setStart(n, i); g.setEnd(n, i + w.length); tx.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(g); return; } }
}, "rockets");
await page.waitForSelector(".qpanel"); await page.keyboard.press("Alt+3");
await page.waitForSelector("#askClaude");
eq(await page.$$eval(".dialog .growd .row .btn", (b) => b.map((x) => x.textContent.replace("Stop", "Ask Claude"))), ["Ask Claude", "Copy for Claude"], "in the desktop app Ask Claude leads; no Open Claude");
await page.waitForFunction((w) => document.querySelector("#fleshReply")?.value === w && document.querySelector("#askClaude").textContent === "Ask Claude", reply);
await page.screenshot({ path: join(root, "tests/shots/desktop-flesh.png") });
await page.click(".dialog .row.end button.primary"); await page.waitForSelector("#f-def");
eq(await page.inputValue("#f-aka"), "rocket engine", "Claude's reply reaches the term's editor");

await app.close(); server.close();
if (failed) process.exit(1); console.log("PASS desktop");
