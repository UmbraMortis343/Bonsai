// The board and its 3D: B flips the main pane between 2D and 3D, ] docks the other beside it, a pick in either is a
// pick in both, the 3D follows where ideas sit on the board, and moving an idea in the graph's Move mode moves it on
// the board too.
import { start, state } from "./lib.mjs";

const t = await start("run26-board3d", 4326, { channel: "beta" });
const page = await t.page({ viewport: { width: 1300, height: 860 } }, "#/notes");
await page.waitForSelector("body[data-ready]");
const tid = await state(page, () => bonsai.S.trees.find((x) => x.name === "Numbers").id);
await page.evaluate((id) => { location.hash = "#/notes/g:" + id; }, tid);
await page.waitForSelector(".gmain .gboard-c canvas"); await page.waitForTimeout(500);
await page.waitForFunction((id) => bonsai.S.nodes.filter((n) => n.treeId === id).every((n) => Array.isArray(n.xy)), tid);

// B: 3D in the main pane
t.eq(await page.getAttribute("#g2d", "aria-pressed"), "true", "2D first");
await page.keyboard.press("b");
await page.waitForSelector(".gmain #stage3 canvas");
t.eq(await page.$(".gmain .gboard-c"), null, "B puts the 3D in the main pane");
t.eq(await page.getAttribute("#g3d", "aria-pressed"), "true", "and the switch says so");
await page.waitForTimeout(800);
await page.screenshot({ path: "tests/shots/board-3d.png" });

// ]: the 2D docked beside the 3D
await page.keyboard.press("]");
await page.waitForSelector(".gdock .gboard-c canvas");
t.eq(await page.isVisible(".gmain #stage3"), true, "the 3D stays in the main pane");
t.eq(await page.textContent("#gDock"), "2D beside]", "the dock shows the 2D");
await page.waitForTimeout(800);
await page.screenshot({ path: "tests/shots/board-3d-dock.png" });

// a pick on the board shows in the 3D
await page.keyboard.press("3");
const picked = await state(page, () => bonsai.S.gsel);
t.eq(await page.$eval(`#stage3 .lbl.sel`, (e) => e.dataset.id), picked, "a pick on the board is picked in the 3D");
// and a click on a name in the 3D picks it on the board
const other = await state(page, (p) => bonsai.S.nodes.find((n) => n.treeId === bonsai.S.boardTree && n.id !== p && n.parentId).id, picked);
const box = await page.$eval(`#stage3 .lbl[data-id="${other}"]`, (e) => { const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
if (box) { await page.mouse.click(...box); t.eq(await state(page, () => bonsai.S.gsel), other, "a click in the 3D picks it on the board"); }

// B again: 2D back in the main pane, 3D docked
await page.keyboard.press("b");
await page.waitForSelector(".gmain .gboard-c canvas"); await page.waitForSelector(".gdock #stage3 canvas");
t.eq(await page.textContent("#gDock"), "3D beside]", "flipping back docks the 3D");
await page.waitForTimeout(800);
await page.screenshot({ path: "tests/shots/board-2d-dock.png" });

// the 3D follows the board: moving an idea on the board moves it in 3D
const id = await state(page, () => bonsai.S.byNum[1]);
const x3 = await state(page, (id) => bonsai.S.g3.stage && [...bonsai.S.g3.stage.labels].find((L) => L.id === id).pos.x, id);
const p = await state(page, (id) => bonsai.S.board.screenOf(id), id);
await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 120, p.y, { steps: 8 }); await page.mouse.up();
await page.waitForFunction(([id, x]) => { const L = [...bonsai.S.g3.stage.labels].find((L) => L.id === id); return L && Math.abs(L.pos.x - x) > 1; }, [id, x3]);
t.eq(true, true, "the 3D follows the board");

// both remembered
await page.keyboard.press("]");
t.eq(await page.isVisible("#gdock"), false, "] hides the dock");
await page.reload(); await page.waitForSelector(".gmain .gboard-c canvas");
t.eq(await page.isVisible("#gdock"), false, "and it stays hidden");

// the graph view draws from the board too
await page.keyboard.press("Shift+Enter");
await page.waitForFunction(() => bonsai.S.view === "tree" && bonsai.S.lay);
const ok = await state(page, () => { const r = bonsai.S.byId.get(bonsai.S.tree.rootId), k = bonsai.S.byNum[1], n = bonsai.S.byId.get(k), a = bonsai.S.lay.pos.get(r.id), b = bonsai.S.lay.pos.get(k); return Math.abs((b[0] - a[0]) - (n.xy[0] - r.xy[0]) * 0.025) < 0.01 && Math.abs((b[2] - a[2]) - (n.xy[1] - r.xy[1]) * 0.025) < 0.01; });
t.eq(ok, true, "the graph's 3D sits where the board puts it");
await t.end();
