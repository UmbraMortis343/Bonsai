// A forest saved by Bonsai 0.2 (data format 1) opens in this version intact.
import { start, state } from "./lib.mjs";

const t = await start("run08-upgrade", 4308);
const page = await t.page({}, "version.json");
await page.evaluate(() => new Promise((res, rej) => {
  const req = indexedDB.open("bonsai", 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    db.createObjectStore("zones", { keyPath: "id" });
    db.createObjectStore("trees", { keyPath: "id" }).createIndex("zoneId", "zoneId");
    const n = db.createObjectStore("nodes", { keyPath: "id" }); n.createIndex("treeId", "treeId"); n.createIndex("parentId", "parentId");
    const l = db.createObjectStore("links", { keyPath: "id" }); l.createIndex("fromId", "fromId"); l.createIndex("toId", "toId");
    db.createObjectStore("events", { keyPath: "id" }).createIndex("at", "at");
    db.createObjectStore("meta", { keyPath: "key" });
  };
  req.onsuccess = () => {
    const db = req.result, at = "2026-11-10T01:00:00.000Z", tx = db.transaction(["zones", "trees", "nodes"], "readwrite");
    tx.objectStore("zones").put({ id: "z1", name: "Electronics", color: null, order: 1, archived: false, createdAt: at, updatedAt: at });
    tx.objectStore("trees").put({ id: "t1", zoneId: "z1", name: "Basic electronics", color: null, rootId: "n1", order: 1, archived: false, createdAt: at, updatedAt: at });
    tx.objectStore("nodes").put({ id: "n1", treeId: "t1", parentId: null, title: "Ohm's law", note: "", body: "", color: null, order: 1, createdAt: at, updatedAt: at, reviewedAt: null });
    tx.objectStore("nodes").put({ id: "n2", treeId: "t1", parentId: "n1", title: "Resistors", note: "Limit current", body: "", color: null, order: 1, createdAt: at, updatedAt: at, reviewedAt: null });
    tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error);
  };
  req.onerror = () => rej(req.error);
}));
await page.goto(t.url + "#/forest"); await page.waitForSelector("body[data-ready]");
await page.waitForSelector('.lbl.tree:text-is("Basic electronics")');
await page.click('.lbl.tree:text-is("Basic electronics")');
await page.waitForSelector('.lbl.node:text-is("Resistors")');
t.eq(await state(page, async () => { await bonsai.store.addPatch({ treeId: "t1", text: "works" }); await bonsai.store.reviewNode("n2", "good"); return [(await bonsai.store.listPatches("t1")).length, bonsai.S.nodes.length]; }), [1, 2], "old forest after upgrade");
await t.end();
