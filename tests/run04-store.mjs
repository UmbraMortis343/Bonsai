// Data store: zones, trees with a trunk, branches, links, cascade deletes,
// safe moves between trees, persistence across reloads, backup round trip.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { serve } from "../scripts/serve.mjs";

const PORT = 4304, URL = `http://localhost:${PORT}/Bonsai/`;
execFileSync("node", ["scripts/build.mjs", "tests/.out/store"], { stdio: "ignore" });
const server = await serve(() => "tests/.out/store", PORT);
const browser = await chromium.launch();
let failed = false;
const fail = (m) => { console.error("FAIL run04:", m); failed = true; };

try {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);

  const r = await page.evaluate(async () => {
    const s = await import("./store.js");
    const out = {};
    const elec = await s.createZone({ name: "Electronics" });
    const basic = await s.createTree({ zoneId: elec.id, name: "Basic electronics", core: "Ohm's law" });
    const adv = await s.createTree({ zoneId: elec.id, name: "Advanced electronics", core: "Op-amps" });
    let nodes = await s.treeNodes(basic.id);
    out.trunkIsCore = nodes.length === 1 && nodes[0].parentId === null && nodes[0].title === "Ohm's law" && nodes[0].id === basic.rootId;
    const trunk = basic.rootId;
    const res = await s.addNode(trunk, { title: "Resistors", note: "Limit current" });
    const ser = await s.addNode(res.id, { title: "Series" });
    const par = await s.addNode(res.id, { title: "Parallel" });
    const fb = await s.addNode(adv.rootId, { title: "Feedback" });
    out.childOrder = s.childrenOf(await s.treeNodes(basic.id), res.id).map((n) => n.title).join(",");
    out.timestamps = !!(res.createdAt && res.updatedAt && res.reviewedAt === null);

    // Cross-link across trees, with no duplicates either way.
    const link = await s.addLink(par.id, fb.id, { label: "analogy" });
    out.dupBlocked = await s.addLink(fb.id, par.id).then(() => false, () => true);
    out.selfBlocked = await s.addLink(fb.id, fb.id).then(() => false, () => true);
    out.linkLabel = (await s.linksFor(fb.id))[0]?.label;

    // Trunk can't be deleted; moving under own branch is refused.
    out.trunkProtected = await s.deleteNode(trunk).then(() => false, () => true);
    out.cycleBlocked = await s.moveNode(res.id, ser.id).then(() => false, () => true);

    // Graft "Feedback" from Advanced onto Resistors in Basic: branch changes tree.
    await s.addNode(fb.id, { title: "Negative feedback" });
    out.movedCount = await s.moveNode(fb.id, res.id);
    const basicNow = await s.treeNodes(basic.id);
    out.graftedInBasic = basicNow.filter((n) => ["Feedback", "Negative feedback"].includes(n.title)).length;
    out.advLeft = (await s.treeNodes(adv.id)).length;
    out.linkSurvivesMove = (await s.linksFor(fb.id)).length === 1;

    // Deleting a branch deletes everything under it and its links.
    out.deletedCount = await s.deleteNode(res.id);
    out.linksGone = (await s.allLinks()).length === 0;
    out.basicLeft = (await s.treeNodes(basic.id)).length;

    // Validation
    out.emptyTitleBlocked = await s.addNode(trunk, { title: "   " }).then(() => false, () => true);

    // Backup round trip
    await s.addNode(trunk, { title: "Capacitors" });
    const backup = await s.exportAll();
    out.backupNodes = backup.nodes.length;
    await s.deleteZone(elec.id);
    out.afterZoneDelete = JSON.stringify(await s.counts());
    await s.importAll(backup);
    out.afterImport = JSON.stringify(await s.counts());
    out.badImportBlocked = await s.importAll({ app: "other" }).then(() => false, () => true);
    out.events = (await s.listEvents()).length;
    return out;
  });

  const want = {
    trunkIsCore: true, childOrder: "Series,Parallel", timestamps: true, dupBlocked: true, selfBlocked: true,
    linkLabel: "analogy", trunkProtected: true, cycleBlocked: true, movedCount: 2, graftedInBasic: 2, advLeft: 1,
    linkSurvivesMove: true, deletedCount: 5, linksGone: true, basicLeft: 1, emptyTitleBlocked: true, backupNodes: 3,
    afterZoneDelete: JSON.stringify({ zones: 0, trees: 0, nodes: 0, links: 0 }),
    afterImport: JSON.stringify({ zones: 1, trees: 2, nodes: 3, links: 0 }), badImportBlocked: true,
  };
  for (const [k, v] of Object.entries(want)) if (r[k] !== v) fail(`${k}: got ${JSON.stringify(r[k])}, want ${JSON.stringify(v)}`);
  if (!(r.events > 10)) fail(`growth log has only ${r.events} events`);

  // Survives a reload (and the browser restarting would be the same storage).
  await page.reload();
  const after = await page.evaluate(async () => JSON.stringify(await (await import("./store.js")).counts()));
  if (after !== want.afterImport) fail(`after reload: ${after}`);
  if (errors.length) fail("page errors: " + errors.join("; "));
} finally {
  await browser.close(); server.close();
}
if (failed) process.exit(1);
console.log("PASS run04 store");
