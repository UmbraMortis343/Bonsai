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
// page  {id, kind, parentId, title, blocks, props, order, createdAt, updatedAt, grown: [{at, zoneId, treeIds, nodeIds, linkIds}]}
//        Notes stand on their own, apart from topics and graphs. kind: "page" or "folder"; parentId: the folder or page it's in.
//        blocks is the editor's content (blocks.js); props are Notion-style properties [{id, name, type, value}].
//        Early beta pages had zoneId, treeIds and plain text; they're read as top-level pages.
//        Growing a page with Claude adds ideas to a topic; grown records what each grow made.
// vector {id, model, hash, v}  An idea's embedding. Recomputable, so not in backups.
// outbox {k, store, id, at}  What changed here and hasn't reached the cloud yet (sync.js); k is "store|id".
//        Every readwrite transaction notes each put and delete on a synced store, in the same transaction.

import { CHANNEL } from "./channel.js";
import { rate } from "./srs.js";

export const SCHEMA_VERSION = 5;
const DB_NAME = CHANNEL ? "bonsai-" + CHANNEL : "bonsai";   // the beta never sees the real garden
const STORES = ["zones", "trees", "nodes", "links", "events", "meta", "patches", "inbox", "pages"];   // what a backup holds

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
      if (e.oldVersion < 4) db.createObjectStore("pages", { keyPath: "id" }).createIndex("zoneId", "zoneId");
      if (e.oldVersion < 5) db.createObjectStore("outbox", { keyPath: "k" });
      // Future schema changes go here as `if (e.oldVersion < 6) { ... }`.
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
// In a readwrite one, every put and delete on a synced store is noted in the outbox too, so sync knows what to send
// (quiet: changes that came from the cloud, which mustn't be sent back).
export const SYNCED = STORES;
const keyOf = (name, v) => (name === "meta" ? v?.key : v?.id);
const LOCAL_META = new Set(["ai", "demo"]);   // about this device only (the meaning model's download, the beta's demo flag): never synced
const local = (name, id) => name === "meta" && LOCAL_META.has(id);
const listeners = new Set();
export const onWrite = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function noting(name, st, ob, wrote) {
  const note = (id) => { if (id == null || local(name, id)) return; wrote.n++; ob.put({ k: name + "|" + id, store: name, id: String(id), at: Date.now() }); };
  return new Proxy(st, { get(t, p) {
    if (p === "put" || p === "add") return (v, k) => { const r = t[p](v, k); note(k ?? keyOf(name, v)); return r; };
    if (p === "delete") return (k) => { const r = t.delete(k); if (typeof k === "string" || typeof k === "number") note(k); return r; };
    const v = t[p]; return typeof v === "function" ? v.bind(t) : v;
  } });
}
async function tx(names, mode, fn, { quiet = false } = {}) {
  const db = await open();
  const track = mode === "readwrite" && !quiet && names.some((n) => SYNCED.includes(n));
  const all = track && !names.includes("outbox") ? [...names, "outbox"] : names;
  const t = db.transaction(all, mode), wrote = { n: 0 };
  const ob = track ? t.objectStore("outbox") : null;
  const s = Object.fromEntries(names.map((n) => [n, track && SYNCED.includes(n) ? noting(n, t.objectStore(n), ob, wrote) : t.objectStore(n)]));
  const done = new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("Save cancelled")); });
  done.catch(() => {}); // a refused save is reported by the throw below, not as a stray error
  let out;
  try { out = await fn(s, t); } catch (e) { try { t.abort(); } catch {} throw e; }
  await done;
  if (wrote.n) for (const f of listeners) try { f(); } catch {}
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
  name = clean(name, 80); if (!name) throw new Error("Give the topic a name.");
  return tx(["zones", "events"], "readwrite", async (s) => {
    const all = await reqP(s.zones.getAll());
    const z = { id: uid(), name, color, order: all.length ? Math.max(...all.map((x) => x.order)) + 1 : 1, archived: false, createdAt: now(), updatedAt: now() };
    s.zones.put(z); logEvent(s, "zone.create", z.id, { name });
    return z;
  });
}
export async function updateZone(id, patch) {
  return tx(["zones"], "readwrite", async (s) => {
    const z = await reqP(s.zones.get(id)); if (!z) throw new Error("That topic no longer exists.");
    if ("name" in patch) { patch.name = clean(patch.name, 80); if (!patch.name) throw new Error("Give the topic a name."); }
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
  name = clean(name, 80); if (!name) throw new Error("Give the knowledge graph a name.");
  return tx(["zones", "trees", "nodes", "events"], "readwrite", async (s) => {
    if (!(await reqP(s.zones.get(zoneId)))) throw new Error("That topic no longer exists.");
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
    const t = await reqP(s.trees.get(id)); if (!t) throw new Error("That knowledge graph no longer exists.");
    if ("name" in patch) { patch.name = clean(patch.name, 80); if (!patch.name) throw new Error("Give the knowledge graph a name."); }
    if ("zoneId" in patch && !(await reqP(s.zones.get(patch.zoneId)))) throw new Error("That topic no longer exists.");
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
    if (p.treeId === treeId) throw new Error("A graph can't be grafted onto itself.");
    const nodes = await reqP(s.nodes.index("treeId").getAll(treeId));
    const sibs = await reqP(s.nodes.index("parentId").getAll(parentId));
    const order = sibs.length ? Math.max(...sibs.map((x) => x.order)) + 1 : 1;
    for (const n of nodes) {
      const isRoot = n.id === t.rootId || n.parentId === null;
      const next = { ...n, treeId: p.treeId, ...(isRoot ? { parentId, order, wasTree: { name: t.name, color: t.color } } : {}), updatedAt: now() };
      delete next.xy;   // its places were on its own board; the board it joins finds them new ones
      s.nodes.put(next);
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
    if (n.parentId === null) throw new Error("This idea already starts its graph.");
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
      delete next.pin;   // a place given by hand belonged to the graph it has just left
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
  const into = await getTree(intoTreeId); if (!into) throw new Error("That knowledge graph no longer exists.");
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
    const p = pick(patch, ["title", "note", "body", "color", "order", "pin"]);
    if ("title" in p) { p.title = clean(p.title, 140); if (!p.title) throw new Error("Give the idea a title."); }
    // pin: where the idea was moved to by hand, [x, y, z] from the middle of its graph's disc; null puts it back
    if ("pin" in p) p.pin = Array.isArray(p.pin) && p.pin.length === 3 && p.pin.every((v) => Number.isFinite(v)) ? p.pin.map((v) => Math.round(v * 1000) / 1000) : null;
    if ("note" in p) p.note = clean(p.note, 500);
    if ("body" in p) p.body = String(p.body || "").slice(0, 200000);
    const next = { ...n, ...p, updatedAt: now() };
    s.nodes.put(next); logEvent(s, "node.edit", id, { fields: Object.keys(p) });
    return next;
  });
}
// Where ideas sit on the Library's board: [[id, x, y], …] in one go. Not logged: it's arrangement, not knowledge.
export async function placeNodes(list) {
  return tx(["nodes"], "readwrite", async (s) => {
    for (const [id, x, y] of list) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const n = await reqP(s.nodes.get(id)); if (n) s.nodes.put({ ...n, xy: [Math.round(x), Math.round(y)] });
    }
    return list.length;
  });
}
// Deletes an idea, everything branching from it, and any links touching them.
// The trunk can't be deleted on its own; delete the tree instead.
export async function deleteNode(id) {
  return tx(["nodes", "links", "events"], "readwrite", async (s) => {
    const n = await reqP(s.nodes.get(id)); if (!n) return { nodes: [], links: [] };
    if (n.parentId === null) throw new Error("This idea starts the graph. Delete the whole graph instead.");
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
// What an oral found, saved in one go: [{ id, shown, why }]. A greyed idea shown wakes (one pass, as an exam
// would), an idea shown counts as watered (good), one missed comes back sooner (again). Each keeps `oral`
// ({ at, shown, why }) for its panel. Returns the rows as they were, for Undo.
export async function saveOral(results) {
  return tx(["nodes", "events"], "readwrite", async (s) => {
    const before = []; let k = 0;
    for (const r of results) {
      const n = await reqP(s.nodes.get(r.id)); if (!n) continue;
      before.push(n);
      const next = { ...n, oral: { at: now(), shown: !!r.shown, why: clean(r.why, 160) }, updatedAt: now() };
      if (n.ghost) { if (r.shown) { delete next.ghost; Object.assign(next, passed(2, k++)); logEvent(s, "node.create", n.id, { treeId: n.treeId, parentId: n.parentId }); } }
      else { next.srs = rate(n, r.shown ? "good" : "again"); next.reviewedAt = now(); logEvent(s, "node.review", n.id, { rating: r.shown ? "good" : "again", by: "oral" }); }
      s.nodes.put(next);
    }
    return before;
  });
}
// Moves an idea (and its branch) under a new parent, possibly in another tree.
// This is what grafting builds on.
export async function moveNode(id, newParentId) {
  return tx(["nodes", "events"], "readwrite", async (s) => {
    const n = await reqP(s.nodes.get(id)); const p = await reqP(s.nodes.get(newParentId));
    if (!n || !p) throw new Error("That idea no longer exists.");
    if (n.parentId === null) throw new Error("The idea a graph starts from can't be moved.");
    const sameTree = await reqP(s.nodes.index("treeId").getAll(n.treeId));
    const branch = subtreeIds(sameTree, id);
    if (branch.includes(newParentId)) throw new Error("An idea can't be moved under itself.");
    const sibs = await reqP(s.nodes.index("parentId").getAll(newParentId));
    const order = sibs.length ? Math.max(...sibs.map((x) => x.order)) + 1 : 1;
    for (const bid of branch) {
      const b = bid === id ? n : sameTree.find((x) => x.id === bid);
      const next = { ...b, treeId: p.treeId, ...(bid === id ? { parentId: newParentId, order } : {}), updatedAt: now() };
      delete next.pin;   // a place given by hand belonged to where it hung before
      s.nodes.put(next);
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

// ---------- notes pages ----------
export const listPages = async () => (await tx(["pages"], "readonly", (s) => reqP(s.pages.getAll()))).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
export async function addPage({ title = "", blocks = [], parentId = null, kind = "page", props = [] } = {}) {
  return tx(["pages"], "readwrite", async (s) => {
    const all = await reqP(s.pages.getAll()), sibs = all.filter((x) => (x.parentId || null) === parentId);
    const p = { id: uid(), kind, parentId, title: clean(title, 120), blocks, props, order: sibs.length ? Math.max(...sibs.map((x) => x.order || 0)) + 1 : 1, createdAt: now(), updatedAt: now(), grown: [] };
    s.pages.put(p); return p;
  });
}
export async function updatePage(id, patch) {
  return tx(["pages"], "readwrite", async (s) => {
    const p = await reqP(s.pages.get(id)); if (!p) throw new Error("That page no longer exists.");
    const q = pick(patch, ["title", "blocks", "order", "parentId", "props", "kind", "ink"]);
    if ("ink" in q && JSON.stringify(q.ink).length > 8000000) throw new Error("That page has too much ink.");
    if ("title" in q) q.title = clean(q.title, 120);
    if ("blocks" in q && JSON.stringify(q.blocks).length > 2000000) throw new Error("That page is too long.");
    if ("parentId" in q && q.parentId) {   // never inside itself
      const all = await reqP(s.pages.getAll());
      if (q.parentId === id || descendants(all, id).some((d) => d.id === q.parentId)) throw new Error("A page can't go inside itself.");
    }
    const next = { ...p, ...q, updatedAt: now() }; s.pages.put(next); return next;
  });
}
const descendants = (all, id) => { const out = [], st = [id]; while (st.length) { const x = st.pop(); for (const c of all.filter((p) => p.parentId === x)) { out.push(c); st.push(c.id); } } return out; };
// Deletes a page and the pages inside it; returns them all, for undo.
export const deletePage = (id) => tx(["pages"], "readwrite", async (s) => {
  const p = await reqP(s.pages.get(id)); if (!p) return [];
  const gone = [p, ...descendants(await reqP(s.pages.getAll()), id)];
  for (const x of gone) s.pages.delete(x.id);
  return gone;
});
export const putPages = (list) => tx(["pages"], "readwrite", (s) => { for (const p of [].concat(list)) s.pages.put(p); });

// Adds what planGrow (notes.js) worked out, all in one save, and records it on the page so it can be taken back.
export async function growPage(pageId, plan, zoneId) {
  return tx(["pages", "zones", "trees", "nodes", "links", "events"], "readwrite", async (s) => {
    const page = await reqP(s.pages.get(pageId)); if (!page) throw new Error("That page no longer exists.");
    if (!(await reqP(s.zones.get(zoneId)))) throw new Error("That topic no longer exists.");
    const ids = new Map(), treeOfKey = new Map(), made = { at: now(), zoneId, treeIds: [], nodeIds: [], linkIds: [] };
    const sibs = await reqP(s.trees.index("zoneId").getAll(zoneId));
    let order = sibs.length ? Math.max(...sibs.map((x) => x.order)) : 0;
    for (const t of plan.trees) {
      const tree = { id: uid(), zoneId, name: clean(t.name, 80) || clean(t.title, 80), color: null, rootId: null, order: ++order, archived: false, createdAt: now(), updatedAt: now() };
      const root = newNode(tree.id, null, t, 1); tree.rootId = root.id;
      s.trees.put(tree); s.nodes.put(root); ids.set(t.root, root.id); treeOfKey.set(t.root, tree.id);
      made.treeIds.push(tree.id); made.nodeIds.push(root.id);
      logEvent(s, "tree.create", tree.id, { name: tree.name, zoneId }); logEvent(s, "node.create", root.id, { treeId: tree.id, parentId: null });
    }
    const nextOrder = new Map();
    for (const n of plan.nodes) {
      const parentId = ids.get(n.parent) || n.parent;
      let treeId = treeOfKey.get(n.parent);
      if (!treeId) { const parent = await reqP(s.nodes.get(parentId)); if (!parent) continue; treeId = parent.treeId; }
      if (!nextOrder.has(parentId)) { const kids = await reqP(s.nodes.index("parentId").getAll(parentId)); nextOrder.set(parentId, kids.length ? Math.max(...kids.map((x) => x.order)) : 0); }
      nextOrder.set(parentId, nextOrder.get(parentId) + 1);
      const node = newNode(treeId, parentId, n, nextOrder.get(parentId));
      s.nodes.put(node); ids.set(n.key, node.id); treeOfKey.set(n.key, treeId); made.nodeIds.push(node.id);
      logEvent(s, "node.create", node.id, { treeId, parentId });
    }
    for (const l of plan.links) {
      const fromId = ids.get(l.from) || l.from, toId = ids.get(l.to) || l.to;
      if (fromId === toId || !(await reqP(s.nodes.get(fromId))) || !(await reqP(s.nodes.get(toId)))) continue;
      const link = { id: uid(), fromId, toId, label: clean(l.label, 60), note: "", createdAt: now(), updatedAt: now() };
      s.links.put(link); made.linkIds.push(link.id); logEvent(s, "link.create", link.id, { fromId, toId });
    }
    s.pages.put({ ...page, grown: [...(page.grown || []), made], updatedAt: now() });
    return made;
  });
}
// Takes back a page's latest grow: the graphs, ideas and links it made, and anything since hung off them.
export async function ungrowPage(pageId) {
  return tx(["pages", "trees", "nodes", "links", "events", "patches"], "readwrite", async (s) => {
    const page = await reqP(s.pages.get(pageId)); const made = page?.grown?.at(-1); if (!made) return null;
    for (const id of made.linkIds) s.links.delete(id);
    const ids = new Set();
    for (const id of made.nodeIds) { const n = await reqP(s.nodes.get(id)); if (!n) continue; for (const x of subtreeIds(await reqP(s.nodes.index("treeId").getAll(n.treeId)), id)) ids.add(x); }
    await removeNodes(s, [...ids]);
    for (const id of made.treeIds) { for (const p of await reqP(s.patches.index("treeId").getAll(id))) s.patches.delete(p.id); s.trees.delete(id); }
    s.pages.put({ ...page, grown: page.grown.slice(0, -1), updatedAt: now() });
    return made;
  });
}

// ---------- exams ----------
// An idea an exam showed counts as reviewed once. First reviews are spread over the coming days (later for a
// deeper level), so a whole paper doesn't dry out on the same morning.
const DAY = 86400000;
function passed(level, k) {
  const interval = 4 + (k % 10) + 4 * Math.max(0, level - 1);
  return { reviewedAt: now(), srs: { interval, ease: 2.5, reps: 1, lapses: 0, passes: 1, due: new Date(Date.now() + interval * DAY).toISOString() } };
}
// Adds what planExam (exams.js) worked out, all in one save. Ideas not shown yet go in greyed (`ghost`): they
// don't count toward growth and aren't reviewed. Returns what it did, for undoExam.
export async function importExam(zoneId, plan) {
  return tx(["zones", "trees", "nodes", "links", "events"], "readwrite", async (s) => {
    if (!(await reqP(s.zones.get(zoneId)))) throw new Error("That topic no longer exists.");
    const ids = new Map(), treeOfKey = new Map(), made = { at: now(), zoneId, treeIds: [], nodeIds: [], linkIds: [], woke: [] };
    let k = 0;
    const dress = (node, n) => { node.exam = n.exam; if (n.ghost) node.ghost = true; else Object.assign(node, passed(n.exam.level, k++)); return node; };
    const sibs = await reqP(s.trees.index("zoneId").getAll(zoneId));
    let order = sibs.length ? Math.max(...sibs.map((x) => x.order)) : 0;
    for (const t of plan.trees) {
      const tree = { id: uid(), zoneId, name: clean(t.name, 80) || clean(t.title, 80), color: null, rootId: null, order: ++order, archived: false, exam: { map: t.exam.map, tier: t.tier }, createdAt: now(), updatedAt: now() };
      const root = dress(newNode(tree.id, null, t, 1), t); tree.rootId = root.id;
      s.trees.put(tree); s.nodes.put(root); ids.set(t.root, root.id); treeOfKey.set(t.root, tree.id);
      made.treeIds.push(tree.id); made.nodeIds.push(root.id);
      logEvent(s, "tree.create", tree.id, { name: tree.name, zoneId }); logEvent(s, "node.create", root.id, { treeId: tree.id, parentId: null });
    }
    const nextOrder = new Map();
    for (const n of plan.nodes) {
      const parentId = ids.get(n.parent) || n.parent;
      let treeId = treeOfKey.get(n.parent);
      if (!treeId) { const parent = await reqP(s.nodes.get(parentId)); if (!parent) continue; treeId = parent.treeId; }
      if (!nextOrder.has(parentId)) { const kids = await reqP(s.nodes.index("parentId").getAll(parentId)); nextOrder.set(parentId, kids.length ? Math.max(...kids.map((x) => x.order)) : 0); }
      nextOrder.set(parentId, nextOrder.get(parentId) + 1);
      const node = dress(newNode(treeId, parentId, n, nextOrder.get(parentId)), n);
      s.nodes.put(node); ids.set(n.key, node.id); treeOfKey.set(n.key, treeId); made.nodeIds.push(node.id);
      if (!node.ghost) logEvent(s, "node.create", node.id, { treeId, parentId });
    }
    for (const w of [...plan.wake, ...plan.raise]) {
      const node = await reqP(s.nodes.get(w.id)); if (!node) continue;
      made.woke.push({ id: node.id, ghost: !!node.ghost, exam: node.exam || null, srs: node.srs || null, reviewedAt: node.reviewedAt || null });
      const next = { ...node, exam: w.exam, updatedAt: now() };
      if (node.ghost) { delete next.ghost; Object.assign(next, passed(w.exam.level, k++)); logEvent(s, "node.create", node.id, { treeId: node.treeId, parentId: node.parentId }); }
      s.nodes.put(next);
    }
    for (const l of plan.links) {
      const fromId = ids.get(l.from) || l.from, toId = ids.get(l.to) || l.to;
      if (fromId === toId || !(await reqP(s.nodes.get(fromId))) || !(await reqP(s.nodes.get(toId)))) continue;
      const link = { id: uid(), fromId, toId, label: clean(l.label, 60), note: "", createdAt: now(), updatedAt: now() };
      s.links.put(link); made.linkIds.push(link.id); logEvent(s, "link.create", link.id, { fromId, toId });
    }
    return made;
  });
}
// Takes an exam import back: what it added goes, and what it woke is greyed again.
export async function undoExam(made) {
  return tx(["trees", "nodes", "links", "events", "patches"], "readwrite", async (s) => {
    for (const id of made.linkIds) s.links.delete(id);
    for (const w of made.woke) {
      const node = await reqP(s.nodes.get(w.id)); if (!node) continue;
      const back = { ...node, exam: w.exam, srs: w.srs, reviewedAt: w.reviewedAt, updatedAt: now() };
      if (w.ghost) back.ghost = true; if (!w.exam) delete back.exam; if (!w.srs) delete back.srs;
      s.nodes.put(back);
    }
    const ids = new Set();
    for (const id of made.nodeIds) { const n = await reqP(s.nodes.get(id)); if (!n) continue; for (const x of subtreeIds(await reqP(s.nodes.index("treeId").getAll(n.treeId)), id)) ids.add(x); }
    await removeNodes(s, [...ids]);
    for (const id of made.treeIds) { for (const p of await reqP(s.patches.index("treeId").getAll(id))) s.patches.delete(p.id); s.trees.delete(id); }
  });
}

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
export async function importAll(backup, { keepVectors = false } = {}) {
  if (!backup || backup.app !== "bonsai") throw new Error("That file isn't a Bonsai backup.");
  if (backup.schema > SCHEMA_VERSION) throw new Error("This backup is from a newer Bonsai. Update the app first.");
  await tx([...STORES, "vectors"], "readwrite", async (s) => {
    for (const n of STORES) { await reqP(s[n].clear()); for (const row of backup[n] || []) s[n].put(row); }
    if (!keepVectors) await reqP(s.vectors.clear());
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

// ---------- sync (sync.js does the talking) ----------
const atOf = (r) => Date.parse(r?.updatedAt || r?.createdAt || r?.at || "") || 1;
// Everything here, noted as changed when it was last changed: for a device's first sync, so older records lose to newer ones.
export async function noteAll() {
  return tx([...STORES, "outbox"], "readwrite", async (s) => {
    let n = 0;
    for (const name of STORES) for (const r of await reqP(s[name].getAll())) { const id = keyOf(name, r); if (id == null || local(name, id)) continue; s.outbox.put({ k: name + "|" + id, store: name, id: String(id), at: atOf(r) }); n++; }
    return n;
  }, { quiet: true });
}
// Up to `limit` waiting changes, each with the record as it is now (null when it's gone).
export async function pending(limit = 300) {
  return tx([...STORES, "outbox"], "readonly", async (s) => {
    const list = (await reqP(s.outbox.getAll())).slice(0, limit);
    for (const o of list) o.data = (await reqP(s[o.store].get(o.store === "meta" ? o.id : o.id))) ?? null;
    return list;
  });
}
export const pendingCount = () => tx(["outbox"], "readonly", (s) => reqP(s.outbox.count()));
// Sent: forget those changes, unless the record changed again since.
export async function sent(list) {
  return tx(["outbox"], "readwrite", async (s) => {
    for (const o of list) { const cur = await reqP(s.outbox.get(o.k)); if (cur && cur.at === o.at) s.outbox.delete(o.k); }
  });
}
// Changes from the cloud: [{ store, id, data, deleted, client_at }]. A change made here later, not yet sent, wins.
// Returns how many records changed.
export async function applyRemote(rows) {
  return tx([...STORES, "outbox"], "readwrite", async (s) => {
    let n = 0;
    for (const r of rows) {
      if (!STORES.includes(r.store) || local(r.store, r.id)) continue;
      const mine = await reqP(s.outbox.get(r.store + "|" + r.id));
      if (mine && mine.at > r.client_at) continue;
      if (r.deleted || !r.data) { if (await reqP(s[r.store].get(r.id))) { s[r.store].delete(r.id); n++; } }
      else { s[r.store].put(r.data); n++; }
      if (mine) s.outbox.delete(mine.k);
    }
    return n;
  }, { quiet: true });
}
