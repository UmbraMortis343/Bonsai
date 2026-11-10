// Bonsai data store, kept on this device in IndexedDB.
//
// zone  {id, name, color, order, archived, createdAt, updatedAt}
// tree  {id, zoneId, name, color, rootId, order, archived, createdAt, updatedAt}
// node  {id, treeId, parentId, title, note, body, color, order,
//        createdAt, updatedAt, reviewedAt}
//        The tree's root node (parentId null) is its trunk: the core idea.
// link  {id, fromId, toId, label, note, createdAt, updatedAt}
//        A cross-link ("leap") between any two nodes, even in different trees.
//        srs {due, interval, ease, reps, lapses, passes} is the review schedule.
//        wasTree {name, color} marks a trunk that was grafted in as a branch.
// event {id, at, type, ref, data}  Append-only log for the growth timeline.
// patch {id, treeId, text, nodeIds, createdAt}  A short reflection (Patchwork Text).
// inbox {id, text, createdAt}  Quick-captured thoughts waiting to be filed.
// vector {id, model, hash, v}  An idea's embedding. Recomputable, so not in backups.

import { rate } from "./srs.js";

export const SCHEMA_VERSION = 3;
const DB_NAME = "bonsai";
const STORES = ["zones", "trees", "nodes", "links", "events", "meta", "patches", "inbox"];   // what a backup holds

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore("zones", { keyPath: "id" });
        db.createObjectStore("trees", { keyPath: "id" }).createIndex("zoneId", "zoneId");
        const n = db.createObjectStore("nodes", { keyPath: "id" });
        n.createIndex("treeId", "treeId");
        n.createIndex("parentId", "parentId");
        const l = db.createObjectStore("links", { keyPath: "id" });
        l.createIndex("fromId", "fromId");
        l.createIndex("toId", "toId");
        db.createObjectStore("events", { keyPath: "id" }).createIndex("at", "at");
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (e.oldVersion < 2) {
        db.createObjectStore("patches", { keyPath: "id" }).createIndex("treeId", "treeId");
        db.createObjectStore("inbox", { keyPath: "id" });
      }
      if (e.oldVersion < 3) db.createObjectStore("vectors", { keyPath: "id" });
      // Future schema changes go here as `if (e.oldVersion < 4) { ... }`.
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Close Bonsai in your other tabs, then reload."));
  });
  return dbPromise;
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// Runs fn(stores) inside one transaction. Everything in it saves together or not at all.
async function tx(names, mode, fn) {
  const db = await open();
  const t = db.transaction(names, mode);
  const s = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
  const done = new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("Save cancelled")); });
  done.catch(() => {}); // a refused save is reported by the throw below, not as a stray error
  let out;
  try { out = await fn(s, t); } catch (e) { try { t.abort(); } catch {} throw e; }
  await done;
  return out;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const clean = (s, max = 200) => String(s ?? "").trim().slice(0, max);

function logEvent(s, type, ref, data) {
  s.events.put({ id: uid(), at: now(), type, ref, data: data || null });
}

// ---------- reads ----------
export async function listZones() {
  const zs = await tx(["zones"], "readonly", (s) => reqP(s.zones.getAll()));
  return zs.filter((z) => !z.archived).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
export async function listTrees(zoneId) {
  const ts = await tx(["trees"], "readonly", (s) => reqP(zoneId ? s.trees.index("zoneId").getAll(zoneId) : s.trees.getAll()));
  return ts.filter((t) => !t.archived).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
export const getZone = (id) => tx(["zones"], "readonly", (s) => reqP(s.zones.get(id)));
export const getTree = (id) => tx(["trees"], "readonly", (s) => reqP(s.trees.get(id)));
export const getNode = (id) => tx(["nodes"], "readonly", (s) => reqP(s.nodes.get(id)));
export const treeNodes = (treeId) => tx(["nodes"], "readonly", (s) => reqP(s.nodes.index("treeId").getAll(treeId)));
export async function linksFor(nodeId) {
  return tx(["links"], "readonly", async (s) => {
    const a = await reqP(s.links.index("fromId").getAll(nodeId));
    const b = await reqP(s.links.index("toId").getAll(nodeId));
    return [...a, ...b];
  });
}
export const allNodes = () => tx(["nodes"], "readonly", (s) => reqP(s.nodes.getAll()));
export const allZones = () => tx(["zones"], "readonly", (s) => reqP(s.zones.getAll()));
export const allTrees = () => tx(["trees"], "readonly", (s) => reqP(s.trees.getAll()));
export const allLinks = () => tx(["links"], "readonly", (s) => reqP(s.links.getAll()));
export const listEvents = () => tx(["events"], "readonly", (s) => reqP(s.events.index("at").getAll()));

// Children of a node, in order.
export function childrenOf(nodes, parentId) {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

// ---------- zones ----------
export async function createZone({ name, color = null }) {
  name = clean(name, 80); if (!name) throw new Error("Give the zone a name.");
  return tx(["zones", "events"], "readwrite", async (s) => {
    const all = await reqP(s.zones.getAll());
    const z = { id: uid(), name, color, order: all.length ? Math.max(...all.map((x) => x.order)) + 1 : 1, archived: false, createdAt: now(), updatedAt: now() };
    s.zones.put(z); logEvent(s, "zone.create", z.id, { name });
    return z;
  });
}
export async function updateZone(id, patch) {
  return tx(["zones"], "readwrite", async (s) => {
    const z = await reqP(s.zones.get(id)); if (!z) throw new Error("That zone no longer exists.");
    if ("name" in patch) { patch.name = clean(patch.name, 80); if (!patch.name) throw new Error("Give the zone a name."); }
    const next = { ...z, ...pick(patch, ["name", "color", "order", "archived"]), updatedAt: now() };
    s.zones.put(next); return next;
  });
}
// Deletes a zone and everything in it.
export async function deleteZone(id) {
  const trees = await listTreesRaw(id);
  for (const t of trees) await deleteTree(t.id);
  await tx(["zones", "events"], "readwrite", (s) => { s.zones.delete(id); logEvent(s, "zone.delete", id); });
}
const listTreesRaw = (zoneId) => tx(["trees"], "readonly", (s) => reqP(s.trees.index("zoneId").getAll(zoneId)));

// ---------- trees ----------
// A tree always starts with its trunk: the core idea.
export async function createTree({ zoneId, name, core, color = null }) {
  name = clean(name, 80); if (!name) throw new Error("Give the tree a name.");
  return tx(["zones", "trees", "nodes", "events"], "readwrite", async (s) => {
    if (!(await reqP(s.zones.get(zoneId)))) throw new Error("That zone no longer exists.");
    const siblings = await reqP(s.trees.index("zoneId").getAll(zoneId));
    const t = { id: uid(), zoneId, name, color, rootId: null, order: siblings.length ? Math.max(...siblings.map((x) => x.order)) + 1 : 1, archived: false, createdAt: now(), updatedAt: now() };
    const root = newNode(t.id, null, { title: clean(core, 140) || name }, 1);
    t.rootId = root.id;
    s.trees.put(t); s.nodes.put(root);
    logEvent(s, "tree.create", t.id, { name, zoneId }); logEvent(s, "node.create", root.id, { treeId: t.id, parentId: null });
    return t;
  });
}
export async function updateTree(id, patch) {
  return tx(["trees", "zones"], "readwrite", async (s) => {
    const t = await reqP(s.trees.get(id)); if (!t) throw new Error("That tree no longer exists.");
    if ("name" in patch) { patch.name = clean(patch.name, 80); if (!patch.name) throw new Error("Give the tree a name."); }
    if ("zoneId" in patch && !(await reqP(s.zones.get(patch.zoneId)))) throw new Error("That zone no longer exists.");
    const next = { ...t, ...pick(patch, ["name", "color", "order", "archived", "zoneId"]), updatedAt: now() };
    s.trees.put(next); return next;
  });
}
export async function deleteTree(id) {
  return tx(["trees", "nodes", "links", "events", "patches"], "readwrite", async (s) => {
    const nodes = await reqP(s.nodes.index("treeId").getAll(id));
    await removeNodes(s, nodes.map((n) => n.id));
    for (const p of await reqP(s.patches.index("treeId").getAll(id))) s.patches.delete(p.id);
    s.trees.delete(id); logEvent(s, "tree.delete", id);
  });
}

// Grafts a whole tree onto an idea in another tree. Its trunk becomes a branch.
export async function graftTree(treeId, parentId) {
  return tx(["trees", "nodes", "patches", "events"], "readwrite", async (s) => {
    const t = await reqP(s.trees.get(treeId)); const p = await reqP(s.nodes.get(parentId));
    if (!t || !p) throw new Error("That no longer exists.");
    if (p.treeId === treeId) throw new Error("A tree can't be grafted onto itself.");
    const nodes = await reqP(s.nodes.index("treeId").getAll(treeId));
    const sibs = await reqP(s.nodes.index("parentId").getAll(parentId));
    const order = sibs.length ? Math.max(...sibs.map((x) => x.order)) + 1 : 1;
    for (const n of nodes) {
      const isRoot = n.id === t.rootId || n.parentId === null;
      s.nodes.put({ ...n, treeId: p.treeId, ...(isRoot ? { parentId, order, wasTree: { name: t.name, color: t.color } } : {}), updatedAt: now() });
    }
    for (const pt of await reqP(s.patches.index("treeId").getAll(treeId))) s.patches.put({ ...pt, treeId: p.treeId });
    s.trees.delete(treeId);
    logEvent(s, "tree.graft", t.rootId, { name: t.name, onto: parentId, toTree: p.treeId, size: nodes.length });
    return nodes.length;
  });
}

// Turns a branch into its own tree, with that idea as the trunk.
export async function splitToTree(nodeId, { name, zoneId } = {}) {
  return tx(["trees", "nodes", "patches", "events"], "readwrite", async (s) => {
    const n = await reqP(s.nodes.get(nodeId)); if (!n) throw new Error("That idea no longer exists.");
    if (n.parentId === null) throw new Error("This is already a trunk.");
    const from = await reqP(s.trees.get(n.treeId));
    const all = await reqP(s.nodes.index("treeId").getAll(n.treeId));
    const branch = subtreeIds(all, nodeId);
    const zone = zoneId || from.zoneId;
    const sibs = await reqP(s.trees.index("zoneId").getAll(zone));
    const t = { id: uid(), zoneId: zone, name: clean(name, 80) || n.wasTree?.name || n.title, color: n.wasTree?.color ?? null, rootId: n.id,
      order: sibs.length ? Math.max(...sibs.map((x) => x.order)) + 1 : 1, archived: false, createdAt: now(), updatedAt: now() };
    for (const id of branch) {
      const b = all.find((x) => x.id === id);
      const next = { ...b, treeId: t.id, updatedAt: now() };
      if (id === nodeId) { next.parentId = null; next.order = 1; delete next.wasTree; }
      s.nodes.put(next);
    }
    // Patches written only about this branch go with it.
    const inBranch = new Set(branch);
    for (const p of await reqP(s.patches.index("treeId").getAll(from.id))) if (p.nodeIds.length && p.nodeIds.every((id) => inBranch.has(id))) s.patches.put({ ...p, treeId: t.id });
    s.trees.put(t); logEvent(s, "tree.split", t.id, { from: from.id, size: branch.length });
    return t;
  });
}

// Merges every other tree in a zone onto one tree's trunk.
export async function mergeZone(zoneId, intoTreeId) {
  const trees = (await listTrees(zoneId)).filter((t) => t.id !== intoTreeId);
  const into = await getTree(intoTreeId); if (!into) throw new Error("That tree no longer exists.");
  for (const t of trees) await graftTree(t.id, into.rootId);
  return trees.length;
}

// ---------- nodes ----------
function newNode(treeId, parentId, { title, note = "", body = "", color = null }, order) {
  return { id: uid(), treeId, parentId, title: clean(title, 140), note: clean(note, 500), body: String(body || "").slice(0, 200000),
    color, order, createdAt: now(), updatedAt: now(), reviewedAt: null };
}
export async function addNode(parentId, fields) {
  if (!clean(fields?.title, 140)) throw new Error("Give the idea a title.");
  return tx(["nodes", "events"], "readwrite", async (s) => {
    const parent = await reqP(s.nodes.get(parentId)); if (!parent) throw new Error("That idea no longer exists.");
    const sibs = await reqP(s.nodes.index("parentId").getAll(parentId));
    const n = newNode(parent.treeId, parentId, fields, sibs.length ? Math.max(...sibs.map((x) => x.order)) + 1 : 1);
    s.nodes.put(n); logEvent(s, "node.create", n.id, { treeId: n.treeId, parentId });
    return n;
  });
}
export async function updateNode(id, patch) {
  return tx(["nodes", "events"], "readwrite", async (s) => {
    const n = await reqP(s.nodes.get(id)); if (!n) throw new Error("That idea no longer exists.");
    const p = pick(patch, ["title", "note", "body", "color", "order"]);
    if ("title" in p) { p.title = clean(p.title, 140); if (!p.title) throw new Error("Give the idea a title."); }
    if ("note" in p) p.note = clean(p.note, 500);
    if ("body" in p) p.body = String(p.body || "").slice(0, 200000);
    const next = { ...n, ...p, updatedAt: now() };
    s.nodes.put(next); logEvent(s, "node.edit", id, { fields: Object.keys(p) });
    return next;
  });
}
// Deletes an idea, everything branching from it, and any links touching them.
// The trunk can't be deleted on its own; delete the tree instead.
export async function deleteNode(id) {
  return tx(["nodes", "links", "events"], "readwrite", async (s) => {
    const n = await reqP(s.nodes.get(id)); if (!n) return { nodes: [], links: [] };
    if (n.parentId === null) throw new Error("This is the trunk. Delete the whole tree instead.");
    const all = await reqP(s.nodes.index("treeId").getAll(n.treeId));
    const ids = subtreeIds(all, id);
    const set = new Set(ids);
    return { nodes: all.filter((x) => set.has(x.id)), links: await removeNodes(s, ids) };
  });
}
// Puts back what deleteNode returned (undo).
export async function restoreRows({ nodes = [], links = [] }) {
  return tx(["nodes", "links", "events"], "readwrite", async (s) => {
    for (const n of nodes) s.nodes.put(n);
    for (const l of links) s.links.put(l);
    if (nodes.length) logEvent(s, "node.restore", nodes[0].id, { count: nodes.length });
  });
}
// Records a review. rating: again | hard | good | easy.
export async function reviewNode(id, rating) {
  return tx(["nodes", "events"], "readwrite", async (s) => {
    const n = await reqP(s.nodes.get(id)); if (!n) throw new Error("That idea no longer exists.");
    const next = { ...n, srs: rate(n, rating), reviewedAt: now() };
    s.nodes.put(next); logEvent(s, "node.review", id, { rating });
    return next;
  });
}
// Moves an idea (and its branch) under a new parent, possibly in another tree.
// This is what grafting builds on.
export async function moveNode(id, newParentId) {
  return tx(["nodes", "events"], "readwrite", async (s) => {
    const n = await reqP(s.nodes.get(id)); const p = await reqP(s.nodes.get(newParentId));
    if (!n || !p) throw new Error("That idea no longer exists.");
    if (n.parentId === null) throw new Error("The trunk can't be moved.");
    const sameTree = await reqP(s.nodes.index("treeId").getAll(n.treeId));
    const branch = subtreeIds(sameTree, id);
    if (branch.includes(newParentId)) throw new Error("An idea can't be moved under its own branch.");
    const sibs = await reqP(s.nodes.index("parentId").getAll(newParentId));
    const order = sibs.length ? Math.max(...sibs.map((x) => x.order)) + 1 : 1;
    for (const bid of branch) {
      const b = bid === id ? n : sameTree.find((x) => x.id === bid);
      s.nodes.put({ ...b, treeId: p.treeId, ...(bid === id ? { parentId: newParentId, order } : {}), updatedAt: now() });
    }
    logEvent(s, "node.move", id, { from: n.parentId, to: newParentId, fromTree: n.treeId, toTree: p.treeId, size: branch.length });
    return branch.length;
  });
}
export function subtreeIds(nodes, rootId) {
  const kids = new Map();
  for (const n of nodes) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n.id); }
  const out = [], stack = [rootId];
  while (stack.length) { const x = stack.pop(); out.push(x); stack.push(...(kids.get(x) || [])); }
  return out;
}
async function removeNodes(s, ids) {
  const gone = new Map();
  for (const id of ids) {
    for (const l of [...await reqP(s.links.index("fromId").getAll(id)), ...await reqP(s.links.index("toId").getAll(id))]) { gone.set(l.id, l); s.links.delete(l.id); }
    s.nodes.delete(id);
  }
  if (ids.length) logEvent(s, "node.delete", ids[0], { count: ids.length });
  return [...gone.values()];
}

// ---------- links ----------
export async function addLink(fromId, toId, { label = "", note = "" } = {}) {
  if (fromId === toId) throw new Error("Pick two different ideas to link.");
  return tx(["nodes", "links", "events"], "readwrite", async (s) => {
    if (!(await reqP(s.nodes.get(fromId))) || !(await reqP(s.nodes.get(toId)))) throw new Error("That idea no longer exists.");
    const existing = await reqP(s.links.index("fromId").getAll(fromId));
    const back = await reqP(s.links.index("fromId").getAll(toId));
    if (existing.some((l) => l.toId === toId) || back.some((l) => l.toId === fromId)) throw new Error("Those ideas are already linked.");
    const l = { id: uid(), fromId, toId, label: clean(label, 60), note: clean(note, 2000), createdAt: now(), updatedAt: now() };
    s.links.put(l); logEvent(s, "link.create", l.id, { fromId, toId });
    return l;
  });
}
export async function updateLink(id, patch) {
  return tx(["links"], "readwrite", async (s) => {
    const l = await reqP(s.links.get(id)); if (!l) throw new Error("That link no longer exists.");
    const p = pick(patch, ["label", "note"]);
    if ("label" in p) p.label = clean(p.label, 60);
    if ("note" in p) p.note = clean(p.note, 2000);
    const next = { ...l, ...p, updatedAt: now() }; s.links.put(next); return next;
  });
}
export const deleteLink = (id) => tx(["links", "events"], "readwrite", (s) => { s.links.delete(id); logEvent(s, "link.delete", id); });

// ---------- patches and inbox ----------
export async function addPatch({ treeId, text, nodeIds = [] }) {
  text = String(text || "").trim().slice(0, 4000); if (!text) throw new Error("Write something first.");
  return tx(["patches", "events"], "readwrite", (s) => {
    const p = { id: uid(), treeId, text, nodeIds: [...new Set(nodeIds)], createdAt: now() };
    s.patches.put(p); logEvent(s, "patch.create", p.id, { treeId });
    return p;
  });
}
export async function listPatches(treeId) {
  const ps = await tx(["patches"], "readonly", (s) => reqP(treeId ? s.patches.index("treeId").getAll(treeId) : s.patches.getAll()));
  return ps.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export const deletePatch = (id) => tx(["patches"], "readwrite", (s) => { s.patches.delete(id); });
export async function addInbox(text) {
  text = clean(text, 140); if (!text) throw new Error("Write something first.");
  return tx(["inbox"], "readwrite", (s) => { const i = { id: uid(), text, createdAt: now() }; s.inbox.put(i); return i; });
}
export async function listInbox() {
  return (await tx(["inbox"], "readonly", (s) => reqP(s.inbox.getAll()))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export const deleteInbox = (id) => tx(["inbox"], "readwrite", (s) => { s.inbox.delete(id); });

// ---------- vectors and settings ----------
export const allVectors = () => tx(["vectors"], "readonly", (s) => reqP(s.vectors.getAll()));
export const putVectors = (rows) => tx(["vectors"], "readwrite", (s) => { for (const r of rows) s.vectors.put(r); });
export const deleteVectors = (ids) => tx(["vectors"], "readwrite", (s) => { for (const id of ids) s.vectors.delete(id); });
export const getMeta = async (key) => (await tx(["meta"], "readonly", (s) => reqP(s.meta.get(key))))?.value;
export const setMeta = (key, value) => tx(["meta"], "readwrite", (s) => { s.meta.put({ key, value }); });

// ---------- backup ----------
export async function exportAll() {
  const data = await tx(STORES, "readonly", async (s) => {
    const out = {};
    for (const n of STORES) out[n] = await reqP(s[n].getAll());
    return out;
  });
  return { app: "bonsai", schema: SCHEMA_VERSION, exportedAt: now(), ...data };
}
// Replaces everything on this device with a backup.
export async function importAll(backup) {
  if (!backup || backup.app !== "bonsai") throw new Error("That file isn't a Bonsai backup.");
  if (backup.schema > SCHEMA_VERSION) throw new Error("This backup is from a newer Bonsai. Update the app first.");
  await tx([...STORES, "vectors"], "readwrite", async (s) => {
    for (const n of STORES) { await reqP(s[n].clear()); for (const row of backup[n] || []) s[n].put(row); }
    await reqP(s.vectors.clear());
  });
}
export async function counts() {
  return tx(["zones", "trees", "nodes", "links"], "readonly", async (s) => ({
    zones: await reqP(s.zones.count()), trees: await reqP(s.trees.count()), nodes: await reqP(s.nodes.count()), links: await reqP(s.links.count()),
  }));
}

// Ask the browser not to clear Bonsai's data when space runs low.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return "unknown";
    if (await navigator.storage.persisted()) return "kept";
    return (await navigator.storage.persist()) ? "kept" : "best-effort";
  } catch { return "unknown"; }
}

function pick(o, keys) { const r = {}; for (const k of keys) if (o && k in o) r[k] = o[k]; return r; }
