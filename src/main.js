// Bonsai: the 3D forest, the 3D tree, and everything you do in them.
import * as store from "./store.js";
import * as srs from "./srs.js";
import { Stage, THREE } from "./stage.js";
import { Flora, grid, ring, pot } from "./flora.js";
import { layoutTree, layoutForest } from "./layout.js";
import { md } from "./md.js";
import * as ai from "./ai.js";
import { textFor, hashText } from "./semantic.js";
import { $, el, put, toast, dialog, menu, overlayOpen, closeTop, closeAll } from "./dom.js";
import { createIsles, QUALITY } from "./isles.js";
import { readMap, missing, mergeMap, ISLE_MAX } from "./gardenmap.js";
import { createTechTree } from "./techtree.js";
import { CHANNEL } from "./channel.js";
import { demoBackup } from "./demo.js";
import { growPrompt, readGrow, planGrow, growSummary } from "./notes.js";
import { createEditor, textToBlocks, blocksToText } from "./blocks.js";
import { datePicker, longDate } from "./datepick.js";

const PALETTE = [["Blue", "#3b82f6"], ["Violet", "#8b5cf6"], ["Pink", "#ec4899"], ["Red", "#ef4444"], ["Orange", "#f97316"], ["Amber", "#f59e0b"], ["Green", "#22c55e"], ["Teal", "#14b8a6"], ["Cyan", "#06b6d4"]];
const SWATCHES = [["Auto", ""], ...PALETTE];
// Garden colours: how well each idea is being kept alive.
const G = { leaf: "#22c55e", thirsty: "#f59e0b", dry: "#a8a29e", stem: "#65a30d", pot: "#c2714f" };
const DAY = 86400000;
const ICON = {
  back: "M15 5l-7 7 7 7", fold: "M6 9l6 6 6-6", unfold: "M6 15l6-6 6 6", close: "M6 6l12 12M18 6L6 18", plus: "M12 5v14M5 12h14", more: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4", panel: "M4 5h16v14H4zM15 5v14", side: "M4 5h16v14H4zM9 5v14", drop: "M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z", page: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5", folder: "M3 6h6l2 2h10v11H3z", graph: "M7 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM21 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM6.3 7.6l4.7 8.6M17.6 9.6l-4.6 6.8M7 6.2l10 1.6", sprout: "M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z", inbox: "M4 13l3-8h10l3 8v6H4zM4 13h5a3 3 0 0 0 6 0h5", play: "M8 5l11 7-11 7z", pause: "M8 5v14M16 5v14",
};
const icon = (d) => el("span", { class: "ic", html: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>` });
const ib = (id, label, d, onclick) => el("button", { class: "ib", id, title: label, "aria-label": label, onclick }, icon(d));
const shell = window.bonsaiShell || { version: "dev", check: async () => "latest", canInstall: () => false, install() {} };

const S = {
  view: "", zones: [], trees: [], nodes: [], links: [], inbox: [], patches: [], pages: [], allZones: [], allTrees: [], nzone: null, npage: null, nside: false,
  byId: new Map(), kids: new Map(), byTree: new Map(), near: new Set(), lastChild: new Map(),
  tree: null, sel: null, panel: null, pick: null, quick: null, review: null, cutoff: null, stitch: false, editBody: false,
  flora: null, lay: null, forest: null, fsel: null, pendingSel: null,
  scope: null, mean: null, suggest: null, aiOn: false,
  garden: null, model: [], hubs: [], hub: -1, isle: -1, topic: -1, treeBack: "#/", meanBack: "#/", techBack: "#/", hashNow: null, water: undefined,
};
const ideaView = () => S.view === "tree" || S.view === "meaning";
let stage, isles, tech, T, labelEls = new Map(), decor = [], selMesh, playTimer = 0;

// Scene colours come from the stylesheet, so light and dark stay in step.
function theme() {
  const css = getComputedStyle(document.documentElement), v = (k) => css.getPropertyValue(k).trim();
  return { sky: v("--bg"), grid: v("--grid"), limb: v("--limb"), link: v("--sap"), ring: v("--ring"), root: v("--trunk"), ink: v("--ink") };
}
const byOrder = (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt);
const kidsOf = (id) => S.kids.get(id) || [];
const treeOf = (id) => S.trees.find((t) => t.id === id);
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const fmtDate = (x) => new Date(x).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const safely = async (fn) => { try { return await fn(); } catch (e) { toast(e.message || "Something went wrong"); return undefined; } };
const goTree = (id) => { location.hash = "#/tree/" + encodeURIComponent(id); };
function pathOf(n) {
  const t = S.allTrees.find((x) => x.id === n.treeId), z = t && S.allZones.find((x) => x.id === t.zoneId);
  return [z?.name, t?.name].filter(Boolean).join(" › ");
}

// ---------- data ----------
async function load() {
  const [zones, trees, nodes, links, inbox, patches, pages] = await Promise.all([store.allZones(), store.allTrees(), store.allNodes(), store.allLinks(), store.listInbox(), store.listPatches(), store.listPages()]);
  S.allZones = zones; S.allTrees = trees; S.nodes = nodes; S.links = links; S.inbox = inbox; S.patches = patches;
  S.pages = pages.map((p) => ({ ...p, kind: p.kind || "page", parentId: p.parentId || null, props: p.props || [], blocks: p.blocks || textToBlocks(p.text || "") }));   // early beta pages were plain text in a topic
  S.zones = zones.filter((z) => !z.archived).sort(byOrder);
  const ok = new Set(S.zones.map((z) => z.id));
  S.trees = trees.filter((t) => !t.archived && ok.has(t.zoneId)).sort(byOrder);
  S.byId = new Map(nodes.map((n) => [n.id, n])); S.kids = new Map(); S.byTree = new Map();
  for (const n of nodes) {
    if (!S.byTree.has(n.treeId)) S.byTree.set(n.treeId, []); S.byTree.get(n.treeId).push(n);
    if (n.parentId != null) { if (!S.kids.has(n.parentId)) S.kids.set(n.parentId, []); S.kids.get(n.parentId).push(n); }
  }
  for (const l of S.kids.values()) l.sort(byOrder);
  await loadGarden();
}
function dueList(treeId) {
  const live = new Set(S.trees.map((t) => t.id)), now = Date.now();
  return S.nodes.filter((n) => (treeId ? n.treeId === treeId : live.has(n.treeId)) && srs.reviewable(n, kidsOf(n.id).length) && srs.isDue(n, now)).sort((a, b) => srs.dueAt(a).localeCompare(srs.dueAt(b)));
}
function shownNodes(tree) {
  const all = S.byTree.get(tree.id) || [];
  if (S.cutoff == null) return all;
  const out = [], stack = [S.byId.get(tree.rootId)];
  while (stack.length) {
    const n = stack.pop(); if (!n) continue;
    if (n.id !== tree.rootId && Date.parse(n.createdAt) > S.cutoff) continue;
    out.push(n); for (const c of kidsOf(n.id)) stack.push(c);
  }
  return out;
}
// thirsty: due for review. dry: due more than a day ago.
function thirst(n, now = Date.now()) {
  if (!srs.reviewable(n, kidsOf(n.id).length)) return "ok";
  const due = Date.parse(srs.dueAt(n));
  return due + DAY <= now ? "dry" : due <= now ? "thirsty" : "ok";
}
function looksFor(tree, nodes, garden) {
  const m = new Map(), now = Date.now(), memo = new Map();
  if (garden) {
    for (const n of nodes) { const t = thirst(n, now); m.set(n.id, { color: t === "dry" ? G.dry : t === "thirsty" ? G.thirsty : n.id === tree.rootId ? G.stem : G.leaf, status: "ok" }); }
    return m;
  }
  // An idea takes its own colour, else its parent's. With no colours set, the
  // trunk is neutral and each main branch gets its own colour.
  const main = kidsOf(tree.rootId);
  const colorOf = (n) => {
    if (!n || n.id === tree.rootId) return n?.color || tree.color || T.root;
    if (n.color) return n.color;
    if (!memo.has(n.id)) {
      const parent = S.byId.get(n.parentId);
      memo.set(n.id, parent && parent.id === tree.rootId && !parent.color && !tree.color ? PALETTE[Math.max(0, main.indexOf(n)) % PALETTE.length][1] : colorOf(parent));
    }
    return memo.get(n.id);
  };
  for (const n of nodes) m.set(n.id, { color: colorOf(n), status: "ok" });
  return m;
}
const passesOf = (treeId) => (S.byTree.get(treeId) || []).reduce((a, n) => a + (n.srs?.passes || 0), 0);

// ---------- scene ----------
function clearScene() {
  S.flora?.dispose(); S.flora = null;
  for (const d of decor) { d.removeFromParent(); d.geometry.dispose(); d.material.dispose(); }
  decor = []; stage.pickables = []; labelEls = new Map();
}
const addDecor = (m) => { decor.push(m); stage.world.add(m); return m; };
const linkLabel = (l, pos) => ({ el: el("div", { class: "lbl link", dataset: { kind: "link", id: l.id }, text: l.label }), pos, kind: "link", id: l.id, anchor: "translate(-50%,-50%)" });

function buildTree(animate) {
  const tree = S.tree, all = S.byTree.get(tree.id) || [];
  const lay = (S.lay = layoutTree(all, tree.rootId));
  const nodes = shownNodes(tree), ids = new Set(nodes.map((n) => n.id));
  const links = S.links.filter((l) => ids.has(l.fromId) && ids.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId, label: l.label }));
  const oldPos = animate && S.flora ? new Map([...S.flora.pos].map(([k, v]) => [k, v.clone()])) : null;
  clearScene();
  const flora = (S.flora = new Flora([{ tree, nodes, layout: lay, offset: [0, 0], looks: looksFor(tree, nodes), passes: 0 }], links, T));
  stage.world.add(flora.group); stage.pickables = [flora.nodeMesh];
  addDecor(grid(Math.max(40, lay.footprint * 6), T.grid));
  const labels = nodes.map((n) => {
    const e = el("div", { class: "lbl node" + (n.id === tree.rootId ? " trunk" : ""), dataset: { kind: "node", id: n.id }, text: n.title });
    labelEls.set(n.id, e);
    return { el: e, pos: flora.pos.get(n.id), kind: "node", id: n.id, depth: lay.depth.get(n.id), r: flora.radii.get(n.id), tidy: true };
  });
  for (const l of links) if (l.label) labels.push(linkLabel(l, flora.linkMid.get(l.id)));
  stage.setLabels(labels);
  if (S.sel && !flora.pos.has(S.sel)) S.sel = null;
  if (oldPos) tween(flora, oldPos);
  markSel();
}
function tween(flora, oldPos) {
  const from = new Map();
  for (const [id, home] of flora.home) {
    let p = oldPos.get(id), n = S.byId.get(id);
    while (!p && n) { n = S.byId.get(n.parentId); p = n && oldPos.get(n.id); }
    from.set(id, (p || home).clone()); flora.pos.get(id).copy(p || home);
  }
  flora.apply();
  if (stage.reduced) { for (const [id, home] of flora.home) flora.pos.get(id).copy(home); flora.apply(); return; }
  let t = 0;
  const step = (dt) => {
    if (S.flora !== flora) { stage.tickers.delete(step); return false; }
    t = Math.min(1, t + dt / 0.42);
    const k = 1 - Math.pow(1 - t, 3);
    for (const [id, home] of flora.home) flora.pos.get(id).lerpVectors(from.get(id), home, k);
    flora.apply(); placeSel();
    if (t >= 1) { stage.tickers.delete(step); return false; }
    return true;
  };
  stage.tickers.add(step); stage.invalidate();
}

function treeSpot(id) {
  const p = S.forest?.fl.trees.get(id), lay = S.forest?.lays.get(id);
  return p ? { target: new THREE.Vector3(p.x + lay.center[0], lay.center[1], p.z + lay.center[2]), radius: stage.fitDistance(lay.radius) * 0.88 } : null;
}
// Draws every tree on the floor: the knowledge forest, or (garden) the same
// trees as plants coloured by how thirsty they are, with roots and pots.
function buildForest(garden = S.view === "garden") {
  clearScene();
  const cut = garden ? null : S.cutoff, born = (x) => cut == null || Date.parse(x.createdAt) <= cut;
  const groups = S.zones.filter(born).map((z) => ({ z, trees: S.trees.filter((t) => t.zoneId === z.id && (born(t) || shownNodes(t).length > 1)) }));
  const lays = new Map();
  for (const g of groups) for (const t of g.trees) lays.set(t.id, layoutTree(S.byTree.get(t.id) || [], t.rootId));
  const fl = layoutForest(groups.map((g) => ({ id: g.z.id, trees: g.trees.map((t) => ({ id: t.id, footprint: lays.get(t.id).footprint })) })));
  S.forest = { fl, lays };
  const items = [], shown = new Set(), labels = [], sags = new Map();
  for (const g of groups) {
    const zp = fl.zones.get(g.z.id);
    const d = addDecor(ring(zp.r, g.z.color || T.ring)); d.position.x = zp.x; d.position.z = zp.z;
    labels.push({ el: el("div", { class: "lbl zone", dataset: { kind: "zone", id: g.z.id }, text: g.z.name }), pos: new THREE.Vector3(zp.x, 0.05, zp.z + zp.r), kind: "zone", id: g.z.id, anchor: "translate(-50%,4px)" });
    for (const t of g.trees) {
      const p = fl.trees.get(t.id), lay = lays.get(t.id), nodes = shownNodes(t);
      for (const n of nodes) shown.add(n.id);
      items.push({ tree: t, nodes, layout: lay, offset: [p.x, p.z], looks: looksFor(t, nodes, garden), passes: garden ? passesOf(t.id) : 0 });
      const dry = garden ? nodes.filter((n) => thirst(n) !== "ok").length : 0;
      const e = el("div", { class: "lbl tree", dataset: { kind: "tree", id: t.id } }, t.name, dry ? el("span", { class: "thirst", text: String(dry) }) : null); labelEls.set(t.id, e);
      // A plant sags as more of it dries out.
      const sag = garden ? 1 - 0.3 * (dry / Math.max(1, nodes.length)) : 1; sags.set(t.id, sag);
      labels.push({ el: e, pos: new THREE.Vector3(p.x, lay.height * sag + 0.75, p.z), kind: "tree", id: t.id });
      if (garden) { const pt = addDecor(pot(G.pot)); pt.position.x = p.x; pt.position.z = p.z; }
    }
  }
  const g = addDecor(grid(fl.radius * 3 + 60, T.grid)); g.position.x = Math.round(fl.center.x / 2) * 2; g.position.z = Math.round(fl.center.z / 2) * 2;
  const links = garden ? [] : S.links.filter((l) => shown.has(l.fromId) && shown.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId, label: l.label }));
  const flora = (S.flora = new Flora(items, links, garden ? { ...T, limb: G.stem } : T));
  if (garden) { for (const it of items) for (const n of it.nodes) { const v = flora.pos.get(n.id); if (v) v.y *= sags.get(it.tree.id); } flora.apply(); }
  stage.world.add(flora.group); stage.pickables = [flora.nodeMesh];
  stage.setLabels(labels); markSel();
}
const rebuild = () => (S.view === "tree" ? buildTree(false) : S.view === "meaning" ? S.mean && buildMeaning() : buildForest());

// ---------- meaning view ----------
// Ideas placed by what they mean (an on-device model), for one zone or for
// everything. Colour marks the tree (in a zone) or the zone (everything).
const scopeNodes = (zoneId) => { const ok = new Set(S.trees.filter((t) => !zoneId || t.zoneId === zoneId).map((t) => t.id)); return S.nodes.filter((n) => ok.has(n.treeId)); };
const aiItems = (nodes) => nodes.map((n) => ({ id: n.id, text: textFor(n, S.byId.get(n.parentId), treeOf(n.treeId)) }));
function setStatus(text) { const e = $("#status"); e.hidden = !text; e.textContent = text || ""; }
const progressText = (p) => (p.stage === "model" ? `Loading model ${Math.round((100 * p.done) / (p.total || 1))}%` : p.stage === "embed" ? `Reading ${p.done}/${p.total}` : "Arranging");
async function aiAllowed() {
  if (S.aiOn) return true;
  if (!(await dialog({ title: "The meaning view runs a small model on this device. It is a one-time 45 MB download.", ok: "Download" }))) return false;
  S.aiOn = true; await store.setMeta("ai", true);
  return true;
}
let meanRun = 0;
const meanCache = new Map();
async function showMeaning(scope) {
  const run = ++meanRun, jumpTo = S.pendingSel; S.pendingSel = null;
  S.view = "meaning"; S.scope = S.zones.some((z) => z.id === scope) ? scope : null;
  S.tree = null; S.lay = null; S.sel = null; S.panel = null; S.mean = null; S.suggest = null;
  document.body.dataset.meaning = "";
  clearScene(); stage.setLabels([]); addDecor(grid(60, T.grid)); placeSel(); renderChrome();
  if (!(await aiAllowed())) { if (run === meanRun) location.hash = S.meanBack; return; }
  const nodes = scopeNodes(S.scope), ids = nodes.map((n) => n.id), items = aiItems(nodes);
  try {
    setStatus("Starting");
    await ai.ensure(items, (p) => run === meanRun && setStatus(progressText(p)));
    if (run !== meanRun) return;
    const key = hashText(items.map((it) => it.id + hashText(it.text)).join());
    if (!meanCache.has(key)) { setStatus("Arranging"); meanCache.set(key, ids.length ? await ai.project(ids, 1, (p) => run === meanRun && setStatus(progressText(p))) : new Float32Array(0)); }
    if (run !== meanRun) return;
    const flat = meanCache.get(key);
    S.mean = { ids, pos: new Map(ids.map((id, i) => [id, [flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2]]])) };
    S.sel = jumpTo && S.mean.pos.has(jumpTo) ? jumpTo : null;
    setStatus(""); buildMeaning();
    stage.setView({ target: vec(S.lay.center), radius: stage.fitDistance(S.lay.radius), phi: 1.3 });
    renderChrome(); document.body.dataset.meaning = "ready";
    ai.forget(new Set(S.nodes.map((n) => n.id))).catch(() => {});
  } catch (e) { if (run === meanRun) { setStatus(""); toast(e.message || "The model couldn't load"); } }
}
function buildMeaning() {
  clearScene();
  const M = S.mean, trees = S.trees.filter((t) => !S.scope || t.zoneId === S.scope);
  const groups = S.scope ? trees.map((t) => ({ id: t.id, name: t.name, color: t.color, trees: [t] }))
    : S.zones.map((z) => ({ id: z.id, name: z.name, color: z.color, trees: trees.filter((t) => t.zoneId === z.id) }));
  const items = [], heads = [], shown = new Set(), depth = new Map(), all = [];
  groups.forEach((g, gi) => {
    const color = g.color || PALETTE[gi % PALETTE.length][1], sum = [0, 0, 0]; let k = 0, top = 0;
    for (const t of g.trees) {
      const every = S.byTree.get(t.id) || [], nodes = every.filter((n) => M.pos.has(n.id)); if (!nodes.length) continue;
      const real = layoutTree(every, t.rootId);
      items.push({ tree: t, nodes, layout: { pos: M.pos, size: real.size, rootId: null }, offset: [0, 0], looks: new Map(nodes.map((n) => [n.id, { color, status: "ok" }])), passes: 0 });
      for (const n of nodes) { const p = M.pos.get(n.id); shown.add(n.id); depth.set(n.id, real.depth.get(n.id) || 0); all.push(p); sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; k++; top = Math.max(top, p[1]); }
    }
    if (k) heads.push({ el: el("div", { class: "lbl tree group", dataset: { kind: "group", id: g.id }, text: g.name, style: `color:${color}` }), pos: new THREE.Vector3(sum[0] / k, top + 0.9, sum[2] / k), kind: "group", id: g.id });
  });
  const c = [0, 0, 0]; for (const p of all) for (let i = 0; i < 3; i++) c[i] += p[i] / (all.length || 1);
  S.lay = { center: all.length ? c : [0, 3, 0], radius: Math.max(3, ...all.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]))) + 1 };
  const links = S.links.filter((l) => shown.has(l.fromId) && shown.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId, label: l.label }));
  const flora = (S.flora = new Flora(items, links, T));
  stage.world.add(flora.group); stage.pickables = [flora.nodeMesh];
  addDecor(grid(Math.max(40, S.lay.radius * 5), T.grid));
  const labels = [...heads];
  for (const it of items) for (const n of it.nodes) {
    const e = el("div", { class: "lbl node", dataset: { kind: "node", id: n.id }, text: n.title }); labelEls.set(n.id, e);
    labels.push({ el: e, pos: flora.pos.get(n.id), kind: "node", id: n.id, depth: depth.get(n.id), r: flora.radii.get(n.id), tidy: true });
  }
  for (const l of links) if (l.label) labels.push(linkLabel(l, flora.linkMid.get(l.id)));
  stage.setLabels(labels);
  if (S.sel && !flora.pos.has(S.sel)) S.sel = null;
  markSel();
}
const goMeaning = (zoneId) => { location.hash = "#/meaning" + (zoneId ? "/" + encodeURIComponent(zoneId) : ""); };
async function openSuggest() {
  const M = S.mean; if (!M) return;
  S.panel = "suggest"; S.suggest = null; renderPanel();
  const raw = await ai.pairs(M.ids).catch(() => []);
  const dismissed = new Set((await store.getMeta("dismissed")) || []), linked = new Set(S.links.map((l) => [l.fromId, l.toId].sort().join("|")));
  const out = [];
  for (const [i, j, c] of raw) {
    const a = S.byId.get(M.ids[i]), b = S.byId.get(M.ids[j]); if (!a || !b) continue;
    if (a.parentId === b.id || b.parentId === a.id || (a.parentId != null && a.parentId === b.parentId)) continue;
    const key = [a.id, b.id].sort().join("|"); if (dismissed.has(key) || linked.has(key)) continue;
    out.push({ a: a.id, b: b.id, c, key, score: c + (a.treeId !== b.treeId ? 0.08 : 0) });
  }
  S.suggest = out.sort((x, y) => y.score - x.score).slice(0, 15);
  if (S.panel === "suggest") renderPanel();
}
function suggestPanel() {
  const rows = (S.suggest || []).filter((x) => S.byId.has(x.a) && S.byId.has(x.b));
  const chip = (id) => el("button", { class: "chip", text: S.byId.get(id).title, title: pathOf(S.byId.get(id)), onclick: () => select(id, { fly: true }) });
  return [
    el("div", { class: "ph" }, el("h2", { text: "Suggested links" }), panelClose()),
    S.suggest == null ? el("p", { class: "muted", text: "Looking" }) : !rows.length ? el("p", { class: "muted", id: "noSuggest", text: "Nothing close enough" }) : null,
    rows.map((x) => el("div", { class: "sug" }, el("div", { class: "chips" }, chip(x.a), chip(x.b), el("span", { class: "muted", text: `${Math.round(x.c * 100)}%` })),
      el("button", { class: "btn", text: "Link", onclick: async () => { if (await safely(() => store.addLink(x.a, x.b))) { S.suggest = S.suggest.filter((y) => y !== x); refresh(); } } }),
      ib(null, "Dismiss", ICON.close, async () => { await store.setMeta("dismissed", [...((await store.getMeta("dismissed")) || []), x.key]); S.suggest = S.suggest.filter((y) => y !== x); renderPanel(); }))),
  ];
}

function markSel() {
  S.near = new Set();
  const n = ideaView() ? S.byId.get(S.sel) : null;
  if (n) {
    for (let p = n; p; p = S.byId.get(p.parentId)) S.near.add(p.id);
    for (const c of kidsOf(n.id)) S.near.add(c.id);
    for (const c of kidsOf(n.parentId)) S.near.add(c.id);
  }
  const on = ideaView() ? S.sel : S.fsel;
  for (const [id, e] of labelEls) e.classList.toggle("sel", id === on);
  placeSel(); stage.invalidate();
}
function placeSel() {
  if (!selMesh) { selMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: T.ink, side: THREE.BackSide })); stage.scene.add(selMesh); }
  const p = ideaView() && S.sel && S.flora?.pos.get(S.sel);
  selMesh.visible = !!p;
  if (p) { selMesh.position.copy(p); selMesh.scale.setScalar(S.flora.radii.get(S.sel) * 1.16 + 0.03); }
}
function labelOpacity(L, dist) {
  if (S.view === "meaning") return L.kind === "group" || L.id === S.sel ? 1 : THREE.MathUtils.clamp(2.3 - dist / (stage.radius * 0.85), 0, 1);
  if (S.view !== "tree") return L.kind === "zone" ? 1 : THREE.MathUtils.clamp(3.2 - dist / Math.max(30, stage.radius), 0, 1);
  if (S.review) return L.id === S.sel ? 1 : 0;
  if (L.kind === "link") return THREE.MathUtils.clamp(2 - dist / (stage.radius * 1.1), 0, 1);
  if (L.id === S.sel || S.near.has(L.id)) return 1;
  if (stage.labels.length > 40) {
    const zoom = S.lay.radius / stage.radius;
    if (L.depth > (zoom < 0.42 ? 1 : zoom < 0.75 ? 2 : zoom < 1.2 ? 3 : 99)) return 0;
  }
  return THREE.MathUtils.clamp(2.6 - (dist / stage.radius) * 1.3, 0, 1);
}

// ---------- views ----------
async function go() {
  await flushPage(); closeAll(); S.pick?.finish(null); stopPlay();
  if (!/^#\/notes/.test(location.hash)) { S.ed?.destroy(); S.ed = null; }
  S.quick = null; S.review = null; S.cutoff = null; S.stitch = false;
  await load();
  const m = location.hash.match(/^#\/tree\/([^/?]+)/), id = m && decodeURIComponent(m[1]);
  const mm = location.hash.match(/^#\/meaning(?:\/([^/?]+))?/), tm = location.hash.match(/^#\/techtree(?:\/([^/?]+))?/), nm = location.hash.match(/^#\/notes(?:\/([^/?]+))?/);
  meanRun++; setStatus(""); document.body.dataset.meaning = "";
  // remember where a graph or the meaning view was opened from, so Back returns there
  const from = S.hashNow; S.hashNow = location.hash;
  const origin = from == null || /^#\/(tree|meaning)/.test(from) ? null : from || "#/";
  if (origin && mm && S.view !== "meaning") S.meanBack = origin;
  if (origin && id && S.view !== "tree") S.treeBack = origin;
  if (from != null && tm && !/^#\/(tree|techtree)/.test(from)) S.techBack = from || "#/";
  const home = !mm && !tm && !nm && !location.hash.startsWith("#/garden") && !location.hash.startsWith("#/forest") && !(id && treeOf(id));
  showWindow(home, !!tm, !!nm);
  if (home) { if (id) history.replaceState(null, "", "#/"); showIsles(); }
  else if (nm) showNotes(nm[1] && decodeURIComponent(nm[1]));
  else if (tm) showTech(tm[1] && decodeURIComponent(tm[1]));
  else if (mm) showMeaning(mm[1] && decodeURIComponent(mm[1]));
  else if (location.hash.startsWith("#/garden")) showGarden();
  else if (id) showTree(id);
  else showForest();
}
function showTree(id) {
  const from = S.view;
  S.view = "tree"; S.tree = treeOf(id); S.fsel = id;
  const jump = S.pendingSel && S.byId.get(S.pendingSel)?.treeId === id ? S.pendingSel : null;
  S.sel = jump || S.tree.rootId; S.pendingSel = null;
  if (S.panel !== "node" || !jump) S.panel = null;
  buildTree(false);
  stage.setView({ target: vec(S.lay.center), radius: stage.fitDistance(S.lay.radius) * 0.88, theta: from === "forest" ? stage.theta : 0.6, phi: 1.2 });
  renderChrome();
}
function showForest() {
  const fromTree = S.view === "tree" ? S.tree?.id : null;
  S.view = "forest"; S.tree = null; S.sel = null; S.lay = null;
  if (S.panel !== "inbox") S.panel = null;
  buildForest();
  const over = forestView();
  const at = fromTree && treeSpot(fromTree);
  if (at) { stage.setView({ ...at, phi: 1.2 }); stage.flyTo(over, 650); } else stage.setView({ ...over, theta: 0.6 });
  renderChrome();
}
function showGarden() {
  const from = S.view === "tree" ? S.tree?.id : null;
  S.view = "garden"; S.tree = null; S.sel = null; S.lay = null; S.panel = null;
  if (from) S.fsel = from;
  buildForest(true);
  const at = from && treeSpot(from);
  stage.setView(at ? { ...at, radius: at.radius * 1.5, phi: 1.1 } : { ...forestView(), theta: stage.theta });
  renderChrome();
  if (S.water !== undefined) { const w = S.water; S.water = undefined; if (w.treeId) S.fsel = w.treeId; reviewIds(w.ids); }
}
// Shift+Tab: round the windows, garden → knowledge → notes.
function toggleWindow() { goWindow({ garden: "knowledge", knowledge: "notes", notes: "garden" }[winOf(S.view)]); }
function pickPlant(id) {
  S.fsel = treeOf(id) ? id : null; markSel(); renderActions();
  const at = S.fsel && treeSpot(S.fsel); if (at) stage.flyTo({ ...at, radius: at.radius * 1.5 }, 420);
}
async function refresh({ animate = false, panel = true } = {}) {
  await load();
  if (S.view === "isles") { drawIsles(); renderTop(); renderEmpty(); return; }
  if (S.view === "tech") { tech.setData(techData()); renderTop(); renderActions(); return; }
  if (S.view === "notes") { renderTop(); renderActions(); drawPageList(); return; }
  if (S.view === "meaning") { if (S.mean) buildMeaning(); }
  else if (S.view === "tree") {
    const t = treeOf(S.tree.id);
    if (!t) { location.hash = "#/"; return; }
    S.tree = t; buildTree(animate);
    // Until the camera is moved by hand, keep the whole tree in view as it grows.
    if (animate && !stage.userMoved) stage.flyTo({ target: vec(S.lay.center), radius: stage.fitDistance(S.lay.radius) * 0.88 }, 420);
  } else {
    // Re-frame the forest when a zone or tree was added or removed.
    const before = S.forest && `${S.forest.fl.zones.size}/${S.forest.fl.trees.size}`;
    buildForest();
    if (before !== `${S.forest.fl.zones.size}/${S.forest.fl.trees.size}` && S.cutoff == null) stage.flyTo(forestView());
  }
  renderTop(); renderActions(); if (panel) renderPanel(); renderTimeline(); renderEmpty();
}
function renderChrome() { renderTop(); renderActions(); renderPanel(); renderReview(); renderTimeline(); renderEmpty(); renderSide(); }
let opening = false;
async function openTree(id) {
  if (opening) return; opening = true;
  const at = treeSpot(id); if (at) await stage.flyTo({ ...at, phi: 1.2 }, 560);
  opening = false; goTree(id);
}
function fitView() {
  if (S.view === "tech") return tech.fit();
  stage.userMoved = false;
  if (S.lay) stage.flyTo({ target: vec(S.lay.center), radius: stage.fitDistance(S.lay.radius) * 0.88, phi: 1.2 });
  else if (S.forest) stage.flyTo(forestView());
}
function forestView() {
  const f = S.forest.fl;
  return { target: new THREE.Vector3(f.center.x, 1.5, f.center.z), radius: Math.min(520, stage.fitDistance(f.radius * 0.8 + 2)), phi: 1.02 };
}

// ---------- selection ----------
function select(id, { fly = false } = {}) {
  S.sel = id && S.byId.has(id) ? id : null; S.editBody = false; hideHover();
  markSel(); renderActions();
  if (S.panel === "node") renderPanel();
  if (fly && S.sel && S.flora?.home.has(S.sel)) stage.flyTo({ target: S.flora.home.get(S.sel), radius: Math.min(stage.radius, stage.fitDistance(S.lay.radius)) }, 380);
}
function ensureVisible(id) {
  const home = S.flora?.home.get(id); if (!home) return;
  const p = stage.screenOf(home), right = stage.w - (S.panel && stage.w > 700 ? 380 : 0);
  if (p.x < stage.w * 0.1 || p.x > right - stage.w * 0.08 || p.y < stage.h * 0.16 || p.y > stage.h * 0.86) stage.flyTo({ target: home }, 360);
}
function nav(key) {
  const n = S.byId.get(S.sel); if (!n) return S.tree && select(S.tree.rootId);
  let to = null;
  if (key === "ArrowDown") { to = n.parentId; if (to) S.lastChild.set(to, n.id); }
  else if (key === "ArrowUp") { const ks = kidsOf(n.id); to = (ks.find((c) => c.id === S.lastChild.get(n.id)) || ks[0])?.id; }
  else { const sib = kidsOf(n.parentId); if (sib.length > 1) to = sib[(sib.indexOf(n) + (key === "ArrowRight" ? 1 : -1) + sib.length) % sib.length].id; }
  if (to) { select(to); ensureVisible(to); }
}
function stepForest(dir) {
  if (!S.trees.length) return;
  const i = S.trees.findIndex((t) => t.id === S.fsel);
  S.fsel = S.trees[(i + dir + S.trees.length) % S.trees.length].id; markSel();
  const p = S.forest.fl.trees.get(S.fsel); if (p) stage.flyTo({ target: new THREE.Vector3(p.x, 2, p.z) }, 320);
}

// ---------- hover card ----------
function hideHover() { $("#hover").hidden = true; }
function showHover(id, x, y) {
  const n = S.byId.get(id); if (!n || S.review) return hideHover();
  const h = $("#hover"); put(h, el("b", { text: n.title }), n.note && el("span", { text: n.note })); h.hidden = false;
  h.style.left = Math.max(8, Math.min(innerWidth - h.offsetWidth - 8, x + 14)) + "px";
  h.style.top = (y + 18 + h.offsetHeight > innerHeight ? y - h.offsetHeight - 12 : y + 18) + "px";
}

// ---------- top bar and menus ----------
function renderTop() {
  const due = dueList(null).length;
  const search = ib("searchBtn", "Search", ICON.search, () => (S.view === "notes" ? $("#notesSearch")?.focus() : find()));
  const swap = winSwitch(), beta = CHANNEL ? el("span", { class: "channel", text: CHANNEL }) : null;
  const brand = el("div", { class: "brand" }, el("img", { src: "icons/icon-192.png", alt: "", width: 24, height: 24 }), el("h1", { text: "Bonsai" }));
  const more = (run = appMenu) => ib("moreBtn", "Menu", ICON.more, (e) => run(e.currentTarget));
  const waterBtn = (run) => (due ? el("button", { class: "btn water", id: "waterAll", title: "Water", onclick: run }, icon(ICON.drop), el("span", { class: "wl", text: "Water" }), el("span", { class: "thirst", text: String(due) })) : null);
  const add = (items) => ib("addBtn", "Add", ICON.plus, (e) => menu(e.currentTarget, items));
  const back = (to, label = "Back") => ib("backBtn", label, ICON.back, () => { location.hash = to; });
  if (S.view === "notes") {
    put($("#top"), brand, beta, el("div", { class: "crumb sub" }, el("h1", { text: "Notes" })), el("span", { class: "grow" }), swap, search,
      add([{ label: "New page", key: "N", run: () => newPage() }, { label: "New folder", key: "F", run: () => newPage(null, "folder") }]), more());
  } else if (S.view === "tech") {
    put($("#top"), back(S.techBack), el("div", { class: "crumb" }, el("h1", { text: "Tech tree" })), beta, el("span", { class: "grow" }), swap, search);
  } else if (S.view === "meaning") {
    const pick = el("select", { id: "scopeSel", "aria-label": "Show", onchange: (e) => goMeaning(e.target.value) }, el("option", { value: "", text: "Everything", selected: !S.scope }), S.zones.map((z) => el("option", { value: z.id, text: z.name, selected: z.id === S.scope })));
    put($("#top"), back(S.meanBack), el("div", { class: "crumb" }, el("h1", { text: "Meaning" }), pick), beta,
      el("span", { class: "grow" }), S.mean && el("button", { class: "btn", id: "suggestBtn", text: "Suggest", onclick: openSuggest }), swap, search);
  } else if (S.view === "tree") {
    const zone = S.zones.find((z) => z.id === S.tree.zoneId);
    put($("#top"), back(S.treeBack), el("div", { class: "crumb" }, el("h1", { text: S.tree.name }), el("span", { text: zone?.name || "" })), beta,
      el("span", { class: "grow" }), el("button", { class: "btn" + (S.nside ? " on" : ""), id: "notesBtn", title: "Notes beside the graph (O)", "aria-label": "Notes beside the graph", "aria-pressed": String(!!S.nside), onclick: toggleSide }, icon(ICON.side), el("kbd", { text: "O" })),
      swap, search, more(treeMenu));
  } else if (S.view === "isles") {
    const all = S.model.flatMap((q) => q.topics).filter((q) => q.id), ideas = S.nodes.filter((n) => treeOf(n.treeId)).length;
    put($("#top"), brand, beta,
      el("div", { class: "tstats", id: "gstats" }, el("span", {}, el("b", { text: String(ideas) }), " ideas"), el("span", {}, el("b", { text: String(S.trees.length) }), " graphs"), el("span", {}, el("b", { text: String(all.length) }), " topics")),
      el("span", { class: "grow" }), waterBtn(() => water(null)),
      swap, search, add([{ label: "New knowledge graph", key: "N", run: () => newGraph() }, { label: "New topic", key: "Z", run: newZone }, { label: "Capture a thought", key: "I", run: capture }]),
      ib("gFold", gfold ? "Show the panel" : "Hide the panel", ICON.panel, () => { gfold = !gfold; renderGarden(); renderTop(); }), more());
  } else if (S.view === "garden") {
    put($("#top"), back("#/", "Garden"), el("div", { class: "crumb" }, el("h1", { text: "Watering" })), beta, el("span", { class: "grow" }),
      waterBtn(() => startReview(null)), swap, more());
  } else {
    put($("#top"), brand, beta, el("span", { class: "grow" }),
      S.inbox.length ? el("button", { class: "btn", id: "inboxBtn", onclick: () => { S.panel = S.panel === "inbox" ? null : "inbox"; renderPanel(); } }, "Inbox", el("span", { class: "thirst", text: String(S.inbox.length) })) : null,
      swap, search, add([{ label: "New tree", key: "N", run: () => newTree() }, { label: "New zone", key: "Z", run: newZone }, { label: "Capture a thought", key: "I", run: capture }]), more());
  }
}
// Beta only: put the demo islands back, as they were when the beta first opened.
async function resetDemo() {
  if (!(await dialog({ title: "Put the beta back to the demo islands?", ok: "Reset", danger: true }))) return;
  await safely(() => store.importAll(demoBackup())); await load(); location.hash = "#/"; refresh();
}
function appMenu(anchor) {
  const archived = [...S.allZones.filter((z) => z.archived), ...S.allTrees.filter((t) => t.archived)];
  menu(anchor, [
    (S.view === "forest" || S.view === "isles") && { label: "Meaning view", key: "M", run: () => goMeaning() },
    S.view !== "tech" && { label: "Tech tree", key: "K", run: openTech },
    S.view !== "notes" && S.view !== "tree" && { label: "Notes", key: "O", run: openNotes },
    S.view === "forest" && { label: "Timeline", key: "T", run: toggleTimeline },
    archived.length && { label: "Archived", run: () => menu(anchor, archived.map((x) => ({ label: `Restore ${x.name}`, run: async () => { await safely(() => (x.rootId ? store.updateTree : store.updateZone)(x.id, { archived: false })); refresh(); } }))) },
    "-", S.view === "isles" && { label: "Import map", run: importMap }, { label: "Export backup", run: exportBackup }, { label: "Restore backup", run: () => $("#importFile").click() },
    CHANNEL && { label: "Reset demo data", run: resetDemo },
    "-", { label: "Shortcuts", key: "?", run: shortcuts },
    { label: "Check for updates", run: async () => { const r = await shell.check(); if (r !== "update") toast(r === "latest" ? "Up to date" : "Offline"); } },
    { label: "What's new", run: () => window.open("https://github.com/UmbraMortis343/Bonsai/releases", "_blank", "noopener") },
    shell.canInstall() && { label: "Install app", run: () => shell.install() },
    { label: `Bonsai ${CHANNEL ? CHANNEL + " " : ""}${shell.version}`, disabled: true },
  ]);
}
function treeMenu(anchor) {
  const t = S.tree;
  menu(anchor, [
    { label: "Patches", key: "P", run: togglePatches }, { label: "Timeline", key: "T", run: toggleTimeline },
    { label: "Meaning view", key: "M", run: () => { S.pendingSel = S.sel; goMeaning(t.zoneId); } }, { label: "Tech tree", key: "K", run: openTech }, { label: "Fit view", key: "0", run: fitView },
    "-", { label: "Rename", run: () => renameThing(t, store.updateTree, "Tree") }, { label: "Colour", run: () => colourThing(t, store.updateTree) },
    S.zones.length > 1 && { label: "Move to zone", run: async () => {
      const v = await dialog({ title: `Move ${t.name}`, fields: [{ name: "zoneId", label: "Zone", type: "select", value: t.zoneId, options: S.zones.map((z) => [z.id, z.name]) }], ok: "Move" });
      if (v && (await safely(() => store.updateTree(t.id, { zoneId: v.zoneId })))) refresh();
    } },
    { label: "Graft onto…", key: "G", run: graftWholeTree },
    { label: "Archive", run: async () => { if (await safely(() => store.updateTree(t.id, { archived: true }))) { toast(`Archived ${t.name}`); location.hash = S.treeBack; } } },
    { label: "Delete", danger: true, run: async () => {
      const n = (S.byTree.get(t.id) || []).length;
      if (await dialog({ title: `Delete ${t.name} and its ${n} idea${n === 1 ? "" : "s"}?`, ok: "Delete", danger: true })) { await safely(() => store.deleteTree(t.id)); location.hash = S.treeBack; }
    } },
    "-", { label: "Shortcuts", key: "?", run: shortcuts },
  ]);
}
function zoneMenu(id, anchor) {
  const z = S.zones.find((x) => x.id === id); if (!z) return;
  const trees = S.trees.filter((t) => t.zoneId === id);
  menu(anchor, [
    { label: "New tree", run: () => newTree(id) }, { label: "Meaning view", run: () => goMeaning(id) },
    { label: "Rename", run: () => renameThing(z, store.updateZone, "Zone") }, { label: "Colour", run: () => colourThing(z, store.updateZone) },
    trees.length > 1 && { label: "Merge into one tree", run: async () => {
      const v = await dialog({ title: `Merge ${z.name}`, fields: [{ name: "into", label: "Trunk", type: "select", value: trees[0].id, options: trees.map((t) => [t.id, t.name]) }], ok: "Merge" });
      if (v && (await safely(() => store.mergeZone(id, v.into))) !== undefined) { await load(); goTree(v.into); }
    } },
    { label: "Archive", run: async () => { if (await safely(() => store.updateZone(id, { archived: true }))) { toast(`Archived ${z.name}`); refresh(); } } },
    { label: "Delete", danger: true, run: async () => {
      if (await dialog({ title: `Delete ${z.name}${trees.length ? ` and its ${trees.length} tree${trees.length === 1 ? "" : "s"}` : ""}?`, ok: "Delete", danger: true })) { await safely(() => store.deleteZone(id)); refresh(); }
    } },
  ]);
}
async function renameThing(x, update, what) {
  const v = await dialog({ title: `Rename ${what.toLowerCase()}`, fields: [{ name: "name", label: what, value: x.name, max: 80 }] });
  if (v && (await safely(() => update(x.id, { name: v.name })))) refresh();
}
async function colourThing(x, update) {
  const v = await dialog({ title: x.name, fields: [{ name: "color", label: "Colour", type: "color", value: x.color || "", options: SWATCHES }] });
  if (v && (await safely(() => update(x.id, { color: v.color || null })))) refresh();
}
async function newZone() {
  const v = await dialog({ title: "New zone", fields: [{ name: "name", label: "Subject", max: 80 }], ok: "Add" });
  const z = v && (await safely(() => store.createZone({ name: v.name })));
  if (!z) return;
  await refresh(); newTree(z.id);
}
async function newTree(zoneId) {
  if (!S.zones.length) return newZone();
  zoneId = zoneId || treeOf(S.fsel)?.zoneId || S.zones[0].id;
  const v = await dialog({ title: "New tree", ok: "Plant", fields: [{ name: "name", label: "Topic", max: 80 }, { name: "core", label: "Core idea", required: false },
    S.zones.length > 1 && { name: "zoneId", label: "Zone", type: "select", value: zoneId, options: S.zones.map((z) => [z.id, z.name]) }].filter(Boolean) });
  const t = v && (await safely(() => store.createTree({ zoneId: v.zoneId || zoneId, name: v.name, core: v.core })));
  if (t) { await load(); goTree(t.id); }
}
async function capture() {
  const v = await dialog({ title: "Capture", fields: [{ name: "text", label: "Thought" }], ok: "Save" });
  if (v && (await safely(() => store.addInbox(v.text)))) { await refresh(); toast("In the inbox"); }
}
function shortcuts() {
  const rows = [["↑ ↓ ← →", "Child, parent, siblings"], ["Tab", "Add a branch"], ["Enter", "Add a sibling"], ["R", "Rename"], ["Del", "Delete"], ["Space", "Notes"],
    ["L", "Link"], ["G", "Graft"], ["C", "Colour"], ["F", "Fly to idea"], ["0", "Fit view"], ["W A S D  Q E", "Fly"], ["/", "Search"], ["I", "Capture"],
    ["1–9", "Garden: go to a hub, an island, then a topic"], ["0  Esc", "Garden: step back out"], ["W", "Garden: water"], ["D", "Garden: day or night"], ["S", "Garden: split a topic past 200%"], ["P", "Patches"], ["T", "Timeline"], ["M", "Meaning view"], ["K", "Tech tree"], ["1–9  Enter", "Tech tree: pick, then go in or open"], ["Space", "Tech tree: open or close an idea"], ["Esc", "Tech tree: let go, then step back a tier"], ["T  A  H", "Tech tree: this tier only, show all, back to the start"], ["B", "Tech tree: what an island grows from"], ["L", "Tech tree: tree or web"], ["Y", "Tech tree: simple or organic look"], ["J", "Tech tree web: jiggle while dragging, or hold still"], ["N  Z", "New tree, new zone"], ["O", "Notes; in a graph, notes beside it"], ["N  G", "Notes: new page, grow with Claude"], ["1–9  ↑ ↓", "Notes: pick a page"], ["← →", "Notes: topics"], ["A", "Notes: attach the page to a graph"], ["/", "Notes, while writing: blocks"], ["Tab  Shift+Tab", "Notes, while writing: indent a block"], ["Ctrl+B I U E K", "Notes, while writing: bold, italic, underline, code, link"], ["Ctrl+Shift+↑ ↓", "Notes, while writing: move a block"], ["Shift+Tab", "Garden, knowledge, notes"], ["Enter  V", "Garden: water the plant, water everything"], ["Esc", "Back"]];
  dialog({ title: "Shortcuts", ok: null, cancel: "Close", body: el("table", { class: "keys" }, rows.map(([k, d]) => el("tr", {}, el("td", {}, el("kbd", { text: k })), el("td", { text: d })))) });
}
async function exportBackup() {
  const data = await safely(() => store.exportAll()); if (!data) return;
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" })), download: `bonsai-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Backup saved");
}
async function importBackup(file) {
  let data; try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (data?.app !== "bonsai") return toast("Not a Bonsai backup");
  const n = (data.nodes || []).length;
  if (!(await dialog({ title: `Replace this device's forest with the backup (${n} idea${n === 1 ? "" : "s"})?`, ok: "Replace", danger: true }))) return;
  if ((await safely(async () => { await store.importAll(data); return true; }))) { toast("Restored"); if (location.hash && location.hash !== "#/") location.hash = "#/"; else go(); }
}

// ---------- actions on the selected idea ----------
function renderActions() {
  const a = $("#actions");
  if (S.quick) {
    const q = S.quick, rename = q.kind === "rename";
    const input = el("input", { id: "quickInput", value: rename ? S.byId.get(q.id)?.title || "" : "", placeholder: rename ? "Name" : "New idea", maxLength: 140, autocomplete: "off", "aria-label": rename ? "Rename" : "New idea" });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !rename) { e.preventDefault(); commitQuick(input.value, "child"); }
      else if (e.key === "Enter" && e.shiftKey && !rename) { e.preventDefault(); commitQuick(input.value, "sibling"); }
    });
    put(a, el("form", { class: "quick", onsubmit: (e) => { e.preventDefault(); commitQuick(input.value); } }, input, el("button", { class: "btn primary", text: rename ? "Save" : "Add" }),
      ib("quickCancel", "Cancel", ICON.close, (e) => { e.preventDefault(); S.quick = null; renderActions(); })));
    a.hidden = false; input.focus(); input.select();
    return;
  }
  if (S.view === "tech") return techBar(a);
  if (S.view === "notes") { a.hidden = true; a.replaceChildren(); return; }
  const plant = S.view === "garden" && !S.review ? treeOf(S.fsel) : null;
  if (plant) {
    const nodes = S.byTree.get(plant.id) || [], dry = nodes.filter((x) => thirst(x) !== "ok");
    put(a, el("div", { class: "plant" }, el("b", { text: plant.name }), el("span", { class: "muted", text: `${nodes.length} idea${nodes.length === 1 ? "" : "s"}${dry.length ? ` · ${dry.length} thirsty` : ""}` })),
      el("button", { class: "btn primary", id: "waterBtn", onclick: () => startReview(plant.id) }, dry.length ? `Water ${dry.length}` : "Practise"),
      dry.length ? el("button", { class: "btn", id: "allGood", text: "All good", onclick: () => passAll(dry.map((x) => x.id)) }) : null,
      el("button", { class: "btn", id: "openTree", text: "Open", onclick: () => goTree(plant.id) }));
    a.hidden = false;
    return;
  }
  const idea = S.view === "meaning" && !S.pick ? S.byId.get(S.sel) : null;
  if (idea) {
    put(a, el("div", { class: "plant" }, el("b", { text: idea.title }), el("span", { class: "muted", text: pathOf(idea) })),
      el("button", { class: "btn", dataset: { act: "open" }, text: "Open", onclick: () => { S.pendingSel = idea.id; goTree(idea.treeId); } }),
      el("button", { class: "btn", dataset: { act: "note" }, text: "Note", onclick: togglePanel }), el("button", { class: "btn", dataset: { act: "link" }, text: "Link", onclick: linkFrom }));
    a.hidden = false;
    return;
  }
  const n = S.view === "tree" && !S.review && !S.pick && S.cutoff == null ? S.byId.get(S.sel) : null;
  if (!n) { a.hidden = true; a.replaceChildren(); return; }
  const b = (act, text, run) => el("button", { class: "btn", dataset: { act }, text, onclick: run });
  put(a, b("add", "+ Branch", () => quick("child")), b("note", "Note", togglePanel), b("link", "Link", linkFrom), b("graft", "Graft", graft),
    ib("nodeMore", "More", ICON.more, (e) => menu(e.currentTarget, [
      { label: "Rename", key: "R", run: () => quick("rename") }, { label: "Add sibling", key: "Enter", run: () => quick("sibling") },
      n.parentId != null && { label: n.wasTree ? `Split ${n.wasTree.name} back out` : "Make its own tree", run: () => splitOut(n) },
      n.parentId != null && { label: "Delete", key: "Del", danger: true, run: () => removeNode(n.id) }])));
  a.hidden = false;
}
function quick(kind) {
  if (S.view !== "tree" || S.cutoff != null || S.review) return;
  const n = S.byId.get(S.sel) || S.byId.get(S.tree.rootId); if (!n) return;
  S.quick = { kind, id: n.id, parentId: kind === "sibling" ? n.parentId ?? n.id : n.id }; renderActions();
}
async function commitQuick(value, then) {
  const q = S.quick, v = value.trim(); S.quick = null;
  if (!q || !v) return renderActions();
  if (q.kind === "rename") { await safely(() => store.updateNode(q.id, { title: v })); await refresh(); return; }
  const n = await safely(() => store.addNode(q.parentId, { title: v }));
  if (!n) return renderActions();
  S.sel = n.id; await refresh({ animate: true }); if (stage.userMoved) ensureVisible(n.id);
  if (then) quick(then);
}
function togglePanel() {
  if (!ideaView()) return;
  S.panel = S.panel === "node" ? null : S.byId.get(S.sel) ? "node" : S.panel; renderPanel();
}
function togglePatches() { if (S.view !== "tree") return; S.panel = S.panel === "patches" ? null : "patches"; S.stitch = false; renderPanel(); }
async function removeNode(id) {
  const n = S.byId.get(id); if (!n || n.parentId == null) return;
  const snap = await safely(() => store.deleteNode(id)); if (!snap) return;
  S.sel = n.parentId; await refresh({ animate: true });
  toast(snap.nodes.length > 1 ? `Deleted ${n.title} and ${snap.nodes.length - 1} more` : `Deleted ${n.title}`, { label: "Undo", run: async () => { await safely(() => store.restoreRows(snap)); S.sel = id; await refresh({ animate: true }); } });
}
async function cycleColour(n) {
  const i = PALETTE.findIndex(([, hex]) => hex === n.color);
  await safely(() => store.updateNode(n.id, { color: i + 1 < PALETTE.length ? PALETTE[i + 1][1] : null })); refresh();
}
async function linkFrom() {
  const n = S.byId.get(S.sel); if (!n) return;
  const taken = new Set([n.id, ...S.links.filter((l) => l.fromId === n.id || l.toId === n.id).map((l) => (l.fromId === n.id ? l.toId : l.fromId))]);
  const to = await pickNode({ title: `Link ${n.title} to`, exclude: taken }); if (to == null) return;
  if (await safely(() => store.addLink(n.id, to))) { S.panel = "node"; await refresh(); }
}
async function graft() {
  const n = S.byId.get(S.sel); if (!n) return;
  if (n.parentId == null) return graftWholeTree();
  const ex = new Set(store.subtreeIds(S.byTree.get(n.treeId), n.id)); ex.add(n.parentId);
  const to = await pickNode({ title: `Graft ${n.title} onto`, exclude: ex }); if (to == null) return;
  const from = n.parentId, target = S.byId.get(to);
  if ((await safely(() => store.moveNode(n.id, to))) === undefined) return;
  if (target.treeId !== S.tree.id) S.sel = from;
  await refresh({ animate: true });
  toast(`Grafted onto ${target.title}`, { label: "Undo", run: async () => { await safely(() => store.moveNode(n.id, from)); S.sel = n.id; await refresh({ animate: true }); } });
}
async function graftWholeTree() {
  const t = S.tree, ex = new Set((S.byTree.get(t.id) || []).map((n) => n.id));
  const to = await pickNode({ title: `Graft ${t.name} onto`, exclude: ex }); if (to == null) return;
  const target = S.byId.get(to);
  if ((await safely(() => store.graftTree(t.id, to))) === undefined) return;
  S.pendingSel = t.rootId; goTree(target.treeId);
}
async function splitOut(n) {
  const t = await safely(() => store.splitToTree(n.id)); if (!t) return;
  S.sel = n.parentId; await refresh({ animate: true });
  toast(`Planted ${t.name}`, { label: "Open", run: () => goTree(t.id) });
}

// ---------- picking another idea (search, link, graft, file) ----------
function pickNode({ title = "", exclude = new Set(), deep = false }) {
  return new Promise((resolve) => {
    S.pick?.finish(null);
    const box = $("#picker"), live = new Set(S.trees.map((t) => t.id));
    let results = [], idx = 0, semTimer = 0;
    const input = el("input", { id: "pickInput", placeholder: "Search", autocomplete: "off", "aria-label": title || "Search" }), list = el("div", { class: "results" });
    const finish = (id) => { S.pick = null; box.hidden = true; box.replaceChildren(); renderActions(); resolve(id); };
    const sem = new Set();
    const draw = () => put(list, ...results.map((n, i) => el("button", { type: "button", class: "res" + (i === idx ? " on" : "") + (sem.has(n.id) ? " sem" : ""), onclick: () => finish(n.id) }, el("b", { text: n.title }), el("span", { text: pathOf(n) }))));
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase(), score = (n) => { const t = n.title.toLowerCase(); return t.startsWith(q) ? 0 : t.includes(q) ? 1 : deep && `${n.note || ""} ${n.body || ""}`.toLowerCase().includes(q) ? 2 : 9; };
      results = q ? S.nodes.filter((n) => live.has(n.treeId) && !exclude.has(n.id)).map((n) => [score(n), n]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title)).slice(0, 8).map(([, n]) => n) : [];
      idx = 0; sem.clear(); draw();
      // With the model on, add ideas that match by meaning.
      clearTimeout(semTimer);
      if (deep && S.aiOn && ai.cache.size && q.length > 2) semTimer = setTimeout(async () => {
        const hits = await ai.search(q, S.nodes.filter((n) => live.has(n.treeId) && !exclude.has(n.id)).map((n) => n.id), 6).catch(() => []);
        if (S.pick?.finish !== finish || input.value.trim().toLowerCase() !== q) return;
        for (const [id, c] of hits) if (c > 0.25 && results.length < 8 && !results.some((n) => n.id === id)) { results.push(S.byId.get(id)); sem.add(id); }
        draw(); box.dataset.sem = q;
      }, 250);
    });
    input.addEventListener("keydown", (e) => {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && results.length) { e.preventDefault(); idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length; draw(); }
      else if (e.key === "Enter") { e.preventDefault(); if (results[idx]) finish(results[idx].id); }
    });
    put(box, title ? el("div", { class: "pick-title", text: title }) : null, el("div", { class: "row" }, input, ib("pickCancel", "Cancel", ICON.close, () => finish(null))), list);
    box.hidden = false; S.pick = { finish, exclude }; S.quick = null; renderActions(); input.focus();
  });
}
async function find() { const id = await pickNode({ deep: true }); if (id != null) jump(id); }
function jump(id) {
  const n = S.byId.get(id); if (!n) return;
  if ((S.view === "tree" && S.tree.id === n.treeId) || (S.view === "meaning" && S.mean?.pos.has(id))) select(id, { fly: true });
  else { S.pendingSel = id; goTree(n.treeId); }
}

// ---------- side panel ----------
function renderPanel() {
  const p = $("#panel");
  S.flush?.(); S.flush = null;
  if (S.panel === "node" && !(ideaView() && S.byId.get(S.sel))) S.panel = null;
  if (S.panel === "suggest" && S.view !== "meaning") S.panel = null;
  if (S.panel === "patches" && S.view !== "tree") S.panel = null;
  if (!S.panel) { p.hidden = true; p.replaceChildren(); document.body.dataset.panel = ""; return; }
  p.hidden = false; document.body.dataset.panel = S.panel;
  put(p, ...(S.panel === "node" ? nodePanel(S.byId.get(S.sel)) : S.panel === "patches" ? patchesPanel() : S.panel === "suggest" ? suggestPanel() : inboxPanel()).flat().filter(Boolean));
}
const panelClose = () => ib("panelClose", "Close", ICON.close, () => { S.panel = null; renderPanel(); });
function nodePanel(n) {
  const save = async (patch, redraw) => { await safely(() => store.updateNode(n.id, patch)); await refresh({ panel: !!redraw }); };
  let body = n.body || "", pending = null;
  // If the panel is redrawn while notes are being typed, keep what was typed.
  S.flush = () => { if (pending != null && pending !== body) { body = pending; store.updateNode(n.id, { body }).catch(() => {}); } };
  const bodyBox = el("div", { class: "body" });
  const drawBody = () => {
    if (S.editBody || !body) {
      put(bodyBox, el("textarea", { id: "nodeBody", value: body, placeholder: "Notes", "aria-label": "Notes", rows: 9,
        oninput: (e) => { pending = e.target.value; },
        onblur: async (e) => { const v = e.target.value; S.editBody = false; pending = null; if (v !== body) { body = v; await save({ body: v }); } if (body && S.panel === "node" && S.sel === n.id) drawBody(); } }));
    } else {
      put(bodyBox, el("div", { class: "md", id: "nodeBodyView", tabIndex: 0, html: md(body),
        onclick: (e) => { if (e.target.closest("a")) return; S.editBody = true; drawBody(); bodyBox.firstChild.focus(); } }));
    }
  };
  drawBody();
  const links = S.links.filter((l) => l.fromId === n.id || l.toId === n.id);
  const patches = S.patches.filter((p) => p.nodeIds.includes(n.id));
  return [
    el("div", { class: "ph" }, el("input", { id: "nodeTitle", class: "title", value: n.title, maxLength: 140, "aria-label": "Title",
      onchange: (e) => (e.target.value.trim() ? save({ title: e.target.value }) : (e.target.value = n.title)) }), panelClose()),
    el("input", { id: "nodeNote", class: "short", value: n.note || "", maxLength: 500, placeholder: "Short note", "aria-label": "Short note", onchange: (e) => save({ note: e.target.value }) }),
    bodyBox,
    el("div", { class: "swatches" }, SWATCHES.map(([name, hex]) => el("button", { class: "sw" + ((n.color || "") === hex ? " on" : "") + (hex ? "" : " none"), title: name, "aria-label": name, style: hex ? `background:${hex}` : "", onclick: () => save({ color: hex || null }, true) }))),
    links.length && el("section", {}, el("h3", { text: "Links" }), links.map((l) => {
      const other = S.byId.get(l.fromId === n.id ? l.toId : l.fromId); if (!other) return null;
      return el("div", { class: "linkrow" }, el("button", { class: "chip", text: other.title, title: pathOf(other), onclick: () => jump(other.id) }),
        el("input", { value: l.label || "", placeholder: "Label", maxLength: 60, "aria-label": `Label for link to ${other.title}`, onchange: async (e) => { await safely(() => store.updateLink(l.id, { label: e.target.value })); refresh({ panel: false }); } }),
        ib(null, "Remove link", ICON.close, async () => { await safely(() => store.deleteLink(l.id)); refresh(); }));
    })),
    patches.length && el("section", {}, el("h3", { text: "Patches" }), patches.map((p) => el("blockquote", {}, el("time", { text: fmtDate(p.createdAt) }), el("p", { text: p.text })))),
  ];
}
function patchesPanel() {
  const tree = S.tree, ps = S.patches.filter((p) => p.treeId === tree.id), root = S.byId.get(tree.rootId);
  const text = el("textarea", { id: "patchText", rows: 4, placeholder: "What clicked?", "aria-label": "New patch" });
  const add = async (e) => {
    e.preventDefault();
    const low = text.value.toLowerCase(), ids = (S.byTree.get(tree.id) || []).filter((n) => n.title.length >= 3 && low.includes(n.title.toLowerCase())).map((n) => n.id);
    if (S.sel && S.sel !== tree.rootId) ids.push(S.sel);
    if (await safely(() => store.addPatch({ treeId: tree.id, text: text.value, nodeIds: ids }))) refresh();
  };
  const stitch = el("textarea", { id: "stitchText", rows: 5, placeholder: "The bigger pattern", "aria-label": "Stitch" });
  const saveStitch = async (e) => {
    e.preventDefault(); const v = stitch.value.trim(); if (!v) return;
    const body = `${root.body ? root.body + "\n\n" : ""}## Stitch · ${fmtDate(Date.now())}\n${v}`;
    if (await safely(() => store.updateNode(root.id, { body }))) { S.stitch = false; S.panel = "node"; S.sel = root.id; await refresh(); toast("Stitched into the trunk"); }
  };
  return [
    el("div", { class: "ph" }, el("h2", { text: "Patches" }), ps.length >= 2 && el("button", { class: "btn", id: "stitchBtn", text: "Stitch", onclick: () => { S.stitch = !S.stitch; renderPanel(); } }), panelClose()),
    S.stitch && el("form", { class: "stack", onsubmit: saveStitch }, stitch, el("button", { class: "btn primary", text: "Save to trunk" })),
    ps.map((p) => el("article", { class: "patch" }, el("div", { class: "row" }, el("time", { text: fmtDate(p.createdAt) }), el("span", { class: "grow" }),
      ib(null, "Delete patch", ICON.close, async () => { await safely(() => store.deletePatch(p.id)); refresh(); })), el("p", { text: p.text }),
      el("div", { class: "chips" }, p.nodeIds.filter((id) => S.byId.get(id)?.treeId === tree.id).map((id) => el("button", { class: "chip", text: S.byId.get(id).title, onclick: () => select(id, { fly: true }) }))))),
    !S.stitch && el("form", { class: "stack", onsubmit: add }, text, el("button", { class: "btn primary", text: "Add patch" })),
  ];
}
function inboxPanel() {
  const input = el("input", { id: "inboxText", placeholder: "Thought", maxLength: 140, "aria-label": "Thought", autocomplete: "off" });
  return [
    el("div", { class: "ph" }, el("h2", { text: "Inbox" }), panelClose()),
    S.inbox.map((it) => el("div", { class: "inboxrow" }, el("span", { text: it.text }),
      el("button", { class: "btn", text: "File", onclick: async () => {
        const to = await pickNode({ title: `File ${it.text} under` }); if (to == null) return;
        if (await safely(() => store.addNode(to, { title: it.text }))) { await store.deleteInbox(it.id); await refresh(); toast(`Filed under ${S.byId.get(to)?.title}`); }
      } }),
      ib(null, "Delete", ICON.close, async () => { await store.deleteInbox(it.id); refresh(); }))),
    el("form", { class: "row", onsubmit: async (e) => { e.preventDefault(); if (await safely(() => store.addInbox(input.value))) refresh(); } }, input, el("button", { class: "btn primary", text: "Add" })),
  ];
}

// ---------- review ----------
// Watering is review. treeId: one plant; null: everything that's thirsty.
function startReview(treeId) {
  let q = dueList(treeId);
  if (!q.length && treeId) q = (S.byTree.get(treeId) || []).filter((n) => srs.reviewable(n, kidsOf(n.id).length));
  if (!q.length) return toast("Nothing to water");
  S.review = { ids: q.map((n) => n.id), i: 0, shown: false, n: 0 }; S.panel = null; S.quick = null;
  stepReview();
}
function reviewIds(ids) {
  if (!ids.length) return toast("Nothing to water");
  S.review = { ids, i: 0, shown: false, n: 0 }; S.panel = null; S.quick = null;
  stepReview();
}
function stepReview() {
  const r = S.review, n = r && S.byId.get(r.ids[r.i]);
  if (!n) return endReview();
  if (S.view === "garden") { rebuild(); if (S.fsel !== n.treeId) pickPlant(n.treeId); }
  renderChrome();
}
// "All good": pass every listed idea in one go. Can be undone.
async function passAll(ids) {
  const before = ids.map((id) => S.byId.get(id)).filter(Boolean);
  if (!before.length) return;
  for (const n of before) await safely(() => store.reviewNode(n.id, "good"));
  if (S.review) { S.review.n = 0; S.review = null; }
  await refresh(); renderReview();
  toast(`Watered ${before.length}`, { label: "Undo", run: async () => { await safely(() => store.restoreRows({ nodes: before })); refresh(); } });
}
function renderReview() {
  const box = $("#review"), r = S.review, n = r && S.byId.get(r.ids[r.i]);
  if (!n) { box.hidden = true; box.replaceChildren(); return; }
  const parent = S.byId.get(n.parentId), kids = kidsOf(n.id);
  box.hidden = false;
  put(box, 
    el("div", { class: "row" }, el("span", { class: "muted grow", text: [pathOf(n), parent?.title].filter(Boolean).join(" › ") }), el("span", { class: "muted", text: `${r.i + 1}/${r.ids.length}` }), el("button", { class: "link", id: "reviewAllGood", text: "All good", onclick: () => passAll(r.ids.slice(r.i)) }), ib("reviewClose", "Stop", ICON.close, endReview)),
    el("h2", { text: n.title }),
    ...(r.shown ? [
      n.note && el("p", { class: "rv-note", text: n.note }), n.body && el("div", { class: "md", html: md(n.body) }),
      kids.length && el("ul", { class: "rv-kids" }, kids.map((k) => el("li", { text: k.title }))),
      el("div", { class: "row rate" }, srs.RATINGS.map((x, i) => el("button", { class: "btn", dataset: { rate: x }, onclick: () => rateNow(x) }, x[0].toUpperCase() + x.slice(1), el("kbd", { text: String(i + 1) })))),
    ] : [el("button", { class: "btn primary", id: "showAnswer", onclick: () => { r.shown = true; renderReview(); } }, "Show", el("kbd", { text: "Space" }))]).filter(Boolean));
}
async function rateNow(rating) {
  const r = S.review; if (!r || r.busy) return; r.busy = true;
  await safely(() => store.reviewNode(r.ids[r.i], rating));
  r.n++; r.i++; r.shown = false; r.busy = false; await load();
  if (r.i >= r.ids.length) return endReview();
  stepReview();
}
async function endReview() {
  const n = S.review?.n; S.review = null;
  await refresh({ animate: true }); renderReview();
  if (n) toast(`Watered ${n}`);
}

// ---------- timeline ----------
function timeRange() {
  const xs = S.view === "tree" ? [S.tree, ...(S.byTree.get(S.tree.id) || [])] : [...S.zones, ...S.trees];
  const min = Math.min(Date.now() - 1000, ...xs.map((x) => Date.parse(x.createdAt)));
  return [min, Date.now()];
}
function stopPlay() { clearInterval(playTimer); playTimer = 0; }
function toggleTimeline() {
  if (S.view === "garden" || S.view === "meaning") return;
  stopPlay();
  if (S.cutoff != null) S.cutoff = null;
  else { S.cutoff = Date.now(); S.panel = null; S.quick = null; S.review = null; }
  rebuild(); renderChrome();
}
function renderTimeline() {
  const bar = $("#timeline");
  if (S.cutoff == null) { bar.hidden = true; bar.replaceChildren(); return; }
  const [min, max] = timeRange();
  const label = el("span", { class: "when" }), count = () => (S.view === "tree" ? shownNodes(S.tree).length : S.flora.ids.length);
  const range = el("input", { type: "range", id: "timeRange", min, max, step: Math.max(1, Math.round((max - min) / 400)), value: Math.min(max, S.cutoff), "aria-label": "Timeline" });
  const show = () => { label.textContent = `${new Date(S.cutoff).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${count()}`; };
  const set = (v) => { S.cutoff = v; range.value = v; rebuild(); show(); };
  range.addEventListener("input", () => { stopPlay(); set(+range.value); });
  const play = ib("timePlay", "Play", ICON.play, () => {
    if (playTimer) return stopPlay();
    let v = min; set(v);
    playTimer = setInterval(() => { v += (max - min) / 90; if (v >= max) { set(max); stopPlay(); } else set(v); }, 60);
  });
  put(bar, play, range, label, ib("timeClose", "Close timeline", ICON.close, toggleTimeline));
  bar.hidden = false; show();
}

// ---------- empty forest ----------
// ---------- the garden: islands of topics ----------
const BIOMES = [["highland", "Highlands"], ["tropical", "Jungle"], ["bloom", "Blossom"], ["lantern", "Lantern trees"], ["glowcap", "Mushrooms"], ["fern", "Ferns"]];
const CENTRES = [["arches", "Stone arches"], ["academy", "Academy"], ["amphitheatre", "Amphitheatre"], ["statue", "Statue"]];
const MARKS = [["kit", "Monument"], ["observatory", "Observatory"], ["pipes", "Organ pipes"], ["lighthouse", "Lighthouse"], ["windmill", "Windmill"], ["coil", "Coil mast"], ["solids", "Pyramid"], ["colonnade", "Colonnade"], ["circle", "Standing stones"]];
const FULL_PLOT = 150;   // ideas that fill a topic's plot; past this the island grows
const PREF = CHANNEL ? `bonsai-${CHANNEL}.` : "bonsai.";   // the beta keeps its own settings
const pref = (k, d) => { try { return localStorage.getItem(PREF + k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(PREF + k, v); } catch {} };
const newId = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Which island each topic sits on, and which hub each island belongs to, is kept beside the data.
// A topic new to it joins the island being looked at, else the last island with room in the hub being looked at.
const hubsOf = (g) => (g.hubs?.length ? g.hubs : [{ id: "", name: "" }]), hubKey = (isl) => isl.hubId ?? "";
async function loadGarden() {
  const g = (await store.getMeta("garden").catch(() => null)) || { islands: [], zone: {}, patron: "none" };
  g.zone ||= {}; const live = new Set(S.zones.map((z) => z.id)), seen = new Set(), hubs = hubsOf(g), known = new Set(hubs.map((h) => h.id)); let dirty = false;
  const here = S.model[S.isle]?.id, hubNow = S.model[S.isle] ? hubs[S.model[S.isle].hub]?.id : hubs[S.hub]?.id;
  for (const isl of g.islands) {
    const keep = isl.zoneIds.filter((id) => live.has(id) && !seen.has(id) && seen.add(id)); if (keep.length !== isl.zoneIds.length) { isl.zoneIds = keep; dirty = true; }
    if (!known.has(hubKey(isl))) { isl.hubId = hubs[0].id; dirty = true; }
  }
  if (!g.islands.length && !g.mapAt) { g.islands.push({ id: "home", name: "Home", landmark: "arches", hubId: hubs[0].id, zoneIds: [] }); dirty = true; }
  for (const z of S.zones) if (!seen.has(z.id)) {
    const hub = known.has(hubNow) ? hubNow : hubs[0].id, inHub = g.islands.filter((q) => hubKey(q) === hub), free = (q) => q.zoneIds.length < ISLE_MAX;
    let isl = g.islands.find((q) => q.id === here && free(q)) || [...inHub].reverse().find(free) || (g.hubs?.length ? null : [...g.islands].reverse().find(free));
    if (!isl) { isl = { id: newId(), name: inHub.length ? `Island ${g.islands.length + 1}` : hubs.find((h) => h.id === hub).name || "Home", landmark: CENTRES[inHub.length ? 1 + ((g.islands.length - 1) % 3) : 0][0], hubId: hub, zoneIds: [] }; g.islands.push(isl); }
    isl.zoneIds.push(z.id); dirty = true;
  }
  const at = new Map(hubs.map((h, k) => [h.id, k])), sorted = g.islands.map((q, k) => [q, k]).sort((a, b) => at.get(hubKey(a[0])) - at.get(hubKey(b[0])) || a[1] - b[1]).map((x) => x[0]);
  if (sorted.some((q, k) => q !== g.islands[k])) { g.islands = sorted; dirty = true; }
  S.garden = g;
  if (dirty) await store.setMeta("garden", g).catch(() => {});
}
const saveGarden = async () => { await safely(() => store.setMeta("garden", S.garden)); await refresh(); };
// What the garden draws: growth is how full a topic's plot is, health is the share of its ideas not waiting to be watered.
// A topic with no ideas yet is uncharted, and lies under mist.
function gardenModel() {
  const zone = new Map(S.zones.map((z) => [z.id, z])), now = Date.now(), hubs = hubsOf(S.garden), at = new Map(hubs.map((h, k) => [h.id, k]));
  const model = S.garden.islands.map((isl, i) => {
    const topics = isl.zoneIds.map((id) => zone.get(id)).filter(Boolean).map((z, k) => {
      const trees = S.trees.filter((t) => t.zoneId === z.id), nodes = trees.flatMap((t) => S.byTree.get(t.id) || []), rev = nodes.filter((n) => srs.reviewable(n, kidsOf(n.id).length)), due = rev.filter((n) => srs.isDue(n, now)), o = S.garden.zone[z.id] || {};
      return { id: z.id, name: z.name, biome: o.biome || BIOMES[k % 6][0], mark: o.mark || "kit", growth: Math.min(2, Math.pow(nodes.length / FULL_PLOT, 0.6)), health: rev.length ? 1 - due.length / rev.length : 1, ideas: nodes.length, mist: !nodes.length && charted(), due: due.map((n) => n.id), trees };
    });
    if (!topics.length) topics.push({ id: null, name: "", biome: "bloom", mark: "kit", growth: 0.04, health: 1, ideas: 0, mist: charted(), due: [], trees: [] });
    return { id: isl.id, name: isl.name, hub: at.get(hubKey(isl)) || 0, landmark: isl.landmark, patron: i === 0 && isl.landmark === "arches" ? S.garden.patron || "none" : undefined, mountain: isl.landmark === "arches" || !!isl.mountain, topics };
  });
  S.hubs = hubs.map((h, k) => ({ id: h.id, name: h.name, isles: model.map((q, i) => (q.hub === k ? i : -1)).filter((i) => i >= 0) }));
  return model;
}
const multi = () => (S.garden?.hubs?.length || 0) > 1, charted = () => !!S.garden?.mapAt;   // mist only means something once a map says what should be there
// How many links run between ideas on two different islands; the garden widens those bridges.
function crossLinks() {
  const where = new Map(); S.model.forEach((isl) => isl.topics.forEach((t) => where.set(t.id, isl.id)));
  const isleOf = (nodeId) => where.get(treeOf(S.byId.get(nodeId)?.treeId)?.zoneId), n = new Map();
  for (const l of S.links) { const a = isleOf(l.fromId), b = isleOf(l.toId); if (a && b && a !== b) { const k = [a, b].sort().join("|"); n.set(k, (n.get(k) || 0) + 1); } }
  return [...n].map(([k, c]) => [...k.split("|"), c]);
}
function showWindow(garden, flat = false, notes = false) {
  $("#notes").hidden = !notes; flat ||= notes;
  $("#stage").hidden = garden || flat; $("#isles").hidden = !garden; $("#tech").hidden = !flat || notes; if (!flat || notes) { tech?.setActive(false); document.body.classList.remove("night-ui"); } $("#gpanel").hidden = !garden; document.body.dataset.window = garden ? "garden" : notes ? "notes" : "";
  if (!garden) { isles?.setActive(false); stage.resize(); }   // the stage has no size while hidden; measure it again before anything is framed
}
// The garden's renderer, made when first needed: by the garden, or by the tech tree for its pictures.
function ensureIsles() {
  if (isles) return isles;
  try { isles = createIsles({ canvas: $("#igl"), sky: $("#sky"), tags: $("#tags"), quality: pref("detail", matchMedia("(pointer: coarse)").matches ? "low" : "medium"), onIsland: (i) => pickIsle(i), onHub: (h) => pickHub(h), onTopic: (i, k) => { if (S.isle !== i) pickIsle(i); pickTopic(k); }, onReady: () => { document.body.dataset.isles = "ready"; } }); }
  catch { return null; }
  isles.setNight(pref("night", "") === "1"); $("#isles").classList.toggle("night", isles.night);
  return isles;
}
function showIsles() {
  S.view = "isles"; S.tree = null; S.sel = null; S.lay = null; S.panel = null; clearScene();
  if (!ensureIsles()) { location.hash = "#/forest"; return; }
  isles.setActive(true); drawIsles(); renderChrome();
  if (S.pendingTopic) { goTopic(S.pendingTopic); S.pendingTopic = null; }
  if (S.pendingIsle) { const i = S.model.findIndex((q) => q.id === S.pendingIsle); S.pendingIsle = null; if (i >= 0) pickIsle(i); }
}
function drawIsles() {
  const was = S.model[S.isle]?.id, wasHub = S.hubs[S.hub]?.id;
  S.model = gardenModel();
  if (was != null && S.model[S.isle]?.id !== was) { S.isle = S.model.findIndex((q) => q.id === was); if (S.isle < 0) S.topic = -1; }
  if (wasHub != null && S.hubs[S.hub]?.id !== wasHub) S.hub = S.hubs.findIndex((h) => h.id === wasHub);
  if (S.isle >= S.model.length) { S.isle = -1; S.topic = -1; }
  if (S.isle >= 0 && S.topic >= S.model[S.isle].topics.length) S.topic = -1;
  if (!multi() || S.hub >= S.hubs.length) S.hub = -1;
  if (S.isle >= 0) S.hub = multi() ? S.model[S.isle].hub : -1;
  isles.setData(S.model, crossLinks(), S.hubs); isles.select(S.topic); renderGarden();
}
// Stepping in: every hub, then one hub, then one island, then one topic. A garden with a single hub skips the hub step.
function pickHub(h) { S.hub = multi() && S.hubs[h] ? h : -1; S.isle = -1; S.topic = -1; isles.focusHub(S.hub); isles.select(-1); renderGarden(); }
function pickIsle(i) {
  if (!S.model[i]) { S.isle = -1; S.topic = -1; if (S.hub >= 0) isles.focusHub(S.hub); else isles.focus(-1); isles.select(-1); return renderGarden(); }
  S.isle = i; S.hub = multi() ? S.model[i].hub : -1; S.topic = -1; isles.focus(i); isles.select(-1); renderGarden();
}
function pickTopic(k) { const t = S.model[S.isle]?.topics[k]; S.topic = t && t.id ? k : -1; isles.select(S.topic); renderGarden(); }
const goTopic = (zoneId) => { const i = S.model.findIndex((isl) => isl.topics.some((t) => t.id === zoneId)); if (i < 0) return; if (S.isle !== i) pickIsle(i); pickTopic(S.model[i].topics.findIndex((t) => t.id === zoneId)); };
function water(ids, treeId) { S.water = { ids: ids || dueList(null).map((n) => n.id), treeId }; location.hash = "#/garden"; }
const pct = (x) => Math.round(x * 100) + "%";
let gfold = matchMedia("(max-width:700px)").matches;   // on a phone the panel starts as a strip, so the garden shows
function renderGarden() {
  const box = $("#gpanel"), isl = S.model[S.isle], t = isl?.topics[S.topic];
  document.body.dataset.gfold = gfold ? "1" : "";
  const seg = (label, opts, now, run) => el("div", { class: "seg", role: "group", "aria-label": label }, opts.map(([v, text]) => el("button", { text, "aria-pressed": String(v === now), onclick: () => run(v) })));
  const act = (id, text, key, run, primary) => el("button", { class: "btn" + (primary ? " primary" : ""), id, onclick: run }, text, key ? el("kbd", { text: key }) : null);
  const row = (key, name, meta, due, run) => el("button", { class: "grow-row", onclick: run }, key ? el("kbd", { text: key }) : null, el("b", { text: name }), el("span", { class: "muted", text: meta }), due ? el("span", { class: "thirst", text: String(due) }) : null);
  const ctl = el("div", { class: "gctl" },
    seg("Time", [["", "Day"], ["1", "Night"]], isles.night ? "1" : "", (v) => { isles.setNight(v === "1"); setPref("night", v); $("#isles").classList.toggle("night", isles.night); renderGarden(); }),
    seg("Detail", Object.keys(QUALITY).map((q) => [q, q[0].toUpperCase() + q.slice(1)]), isles.quality, (v) => { isles.setQuality(v); setPref("detail", v); renderGarden(); }));
  // the name: click it (or Enter on it) to rename in place
  const name = (text, rename) => {
    const h = el("h2", { text, class: rename ? "gname" : null, title: rename ? "Rename" : null, tabIndex: rename ? 0 : null });
    if (rename) {
      const edit = () => {
        const input = el("input", { class: "gname-in", value: text, maxLength: 80, "aria-label": "Name" });
        let done = false; const finish = async (save) => { if (done) return; done = true; const v = input.value.trim(); if (save && v && v !== text) await rename(v); else renderGarden(); };
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); } });
        input.addEventListener("blur", () => finish(true));
        h.replaceWith(input); input.focus(); input.select();
      };
      h.addEventListener("click", edit); h.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); edit(); } });
    }
    return h;
  };
  const head = (back, h, more) => el("div", { class: "ph gph" }, back ? ib("gBack", "Back", ICON.back, back) : null, h, more);
  const pickRow = (id, label, opts, now, set) => el("label", { class: "gsrow" }, el("span", { text: label }), el("select", { id, onchange: (e) => set(e.target.value) }, opts.map(([v, text]) => el("option", { value: v, text, selected: v === now }))));
  if (t) {
    const due = t.due.length, o = (S.garden.zone[t.id] ||= {});
    put(box, head(() => pickTopic(-1), name(t.name, async (v) => { if (await safely(() => store.updateZone(t.id, { name: v }))) refresh(); }), ib("topicMore", "Move to island", ICON.more, (e) => topicMenu(t, e.currentTarget))),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, due ? act("waterTopic", `Water ${due}`, "W", () => water(t.due), true) : null, act("newGraph", "New knowledge graph", "N", () => newGraph(t.id), !due), act("topicMap", "Meaning map", "M", () => goMeaning(t.id)), act("techBtn", "Tech tree", "K", openTech), t.growth >= 2 ? act("splitTopic", "Split", "S", () => splitTopic(t)) : null)),
      el("div", { class: "stats" }, el("span", {}, el("b", { text: String(t.ideas) }), ` idea${t.ideas === 1 ? "" : "s"}`), el("span", {}, el("b", { text: pct(t.growth) }), " grown"), el("span", {}, el("b", { text: pct(t.health) }), " healthy")),
      el("h3", { text: "Knowledge graphs" }),
      t.trees.length ? el("div", { class: "rows" }, t.trees.map((tr, k) => { const n = (S.byTree.get(tr.id) || []).length; return row(k < 9 ? String(k + 1) : "", tr.name, `${n} idea${n === 1 ? "" : "s"}`, dueList(tr.id).length, () => goTree(tr.id)); })) : el("p", { class: "muted", text: "None yet." }),
      el("div", { class: "gset" }, pickRow("topicBiome", "Biome", BIOMES, t.biome, (v) => { o.biome = v; saveGarden(); }), pickRow("topicMark", "Landmark", MARKS, t.mark, (v) => { o.mark = v; saveGarden(); })));
  } else if (isl) {
    const rec = S.garden.islands[S.isle], items = isleItems(S.isle);
    put(box, head(() => pickIsle(-1), name(isl.name, rec.mapId ? null : (v) => { rec.name = v; saveGarden(); }), items.length ? ib("isleMore", "Island menu", ICON.more, (e) => isleMenu(S.isle, e.currentTarget)) : null),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, act("newTopic", "New topic", "Z", newZone, true), act("isleTech", "Tech tree", "K", openTech))),
      el("h3", { text: "Topics" }),
      isl.topics[0].id ? el("div", { class: "rows" }, isl.topics.map((q, k) => row(String(k + 1), q.name, pct(q.growth), q.due.length, () => pickTopic(k)))) : el("p", { class: "muted", text: "No topics here yet." }),
      el("div", { class: "gset" },
        rec.mapId ? null : pickRow("isleCentre", "Centrepiece", CENTRES, rec.landmark, (v) => { rec.landmark = v; saveGarden(); }),
        S.isle === 0 && rec.landmark === "arches" ? pickRow("islePatron", "Figure", [["none", "None"], ["athena", "Athena"], ["saraswati", "Saraswati"]], S.garden.patron || "none", (v) => { S.garden.patron = v; saveGarden(); }) : null,
        rec.landmark !== "arches" ? el("label", { class: "gsrow" }, el("span", { text: "Mountain" }), el("input", { type: "checkbox", id: "isleMountain", checked: !!rec.mountain, onchange: (e) => { rec.mountain = e.target.checked; saveGarden(); } })) : null));
  } else if (S.hub >= 0) {
    const hub = S.hubs[S.hub];
    put(box, head(() => pickHub(-1), name(hub.name, null)),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, act("newTopic", "New topic", "Z", newZone, true), act("techBtn", "Tech tree", "K", openTech))),
      el("h3", { text: "Islands" }),
      hub.isles.length ? el("div", { class: "rows" }, hub.isles.map((i, k) => { const q = S.model[i], n = q.topics.filter((x) => x.id).length; return row(k < 9 ? String(k + 1) : "", q.name, `${n} topic${n === 1 ? "" : "s"}`, q.topics.reduce((a, x) => a + x.due.length, 0), () => pickIsle(i)); })) : el("p", { class: "muted", text: "No islands yet." }));
  } else {
    const all = S.model.flatMap((q) => q.topics).filter((q) => q.id), thirsty = all.filter((q) => q.due.length).sort((a, b) => b.due.length - a.due.length), top = Math.max(1, ...all.map((q) => q.ideas));
    put(box, head(null, name("Garden", null), S.garden.mapAt ? null : ib("isleAdd", "New island", ICON.plus, newIsle)),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, act("newGraph", "New knowledge graph", "N", () => newGraph(), true), act("mapBtn", "Meaning map", "M", () => goMeaning()), act("techBtn", "Tech tree", "K", openTech))),
      el("h3", { text: "Needs watering" }),
      thirsty.length ? el("div", { class: "rows" }, thirsty.slice(0, 6).map((q) => row("", q.name, "", q.due.length, () => goTopic(q.id)))) : el("p", { class: "muted", text: "Nothing right now." }),
      all.length ? el("details", { class: "fold", id: "spread", open: pref("spread", "") === "1", ontoggle: (e) => setPref("spread", e.target.open ? "1" : "") }, el("summary", {}, el("h3", { text: "Knowledge spread" })), el("div", { class: "spread" }, all.map((q) => el("button", { class: "bar", title: `${q.name}: ${q.ideas}`, onclick: () => goTopic(q.id) }, el("span", { text: q.name }), el("i", {}, el("b", { style: `width:${Math.max(3, (100 * q.ideas) / top)}%` })))))) : null);
  }
}
// A new graph asks only for its topic and its name.
async function newGraph(zoneId) {
  const NEW = "\u0000new", has = S.zones.length > 0;
  const v = await dialog({ title: "New knowledge graph", ok: "Create", fields: [
    has ? { name: "zoneId", label: "Topic", type: "select", value: zoneId || S.model[S.isle]?.topics[Math.max(0, S.topic)]?.id || S.zones[0].id, options: [...S.zones.map((z) => [z.id, z.name]), [NEW, "New topic…"]] } : { name: "topic", label: "Topic", max: 80 },
    { name: "name", label: "Name", max: 80 }] });
  if (!v) return;
  let zid = v.zoneId;
  if (!has || zid === NEW) {
    const name = has ? (await dialog({ title: "New topic", fields: [{ name: "name", label: "Topic", max: 80 }], ok: "Add" }))?.name : v.topic; if (!name) return;
    zid = (await safely(() => store.createZone({ name })))?.id; if (!zid) return;
  }
  const t = await safely(() => store.createTree({ zoneId: zid, name: v.name }));
  if (t) { await load(); goTree(t.id); }
}
// Once a map has been imported, islands are made, named and given their centrepiece there, not here.
function isleItems(i) {
  const rec = S.garden.islands[i]; if (!rec) return [];
  return [
    !S.garden.mapAt && { label: "New island", run: newIsle },
    i > 0 && !rec.mapId && !rec.zoneIds.length && { label: "Remove island", danger: true, run: () => { S.garden.islands.splice(i, 1); S.isle = -1; isles.focus(-1); saveGarden(); } },
  ].filter(Boolean);
}
function isleMenu(i, anchor) { menu(anchor, isleItems(i).map((it) => (it === "-" ? it : { ...it, run: () => it.run(anchor) }))); }
async function newIsle() {
  const v = await dialog({ title: "New island", ok: "Add", fields: [{ name: "name", label: "Island", max: 40 }, { name: "landmark", label: "Centrepiece", type: "select", value: "academy", options: CENTRES }] });
  if (!v) return;
  S.garden.islands.push({ id: newId(), name: v.name, landmark: v.landmark, hubId: hubsOf(S.garden)[0].id, zoneIds: [] }); await saveGarden(); pickIsle(S.garden.islands.length - 1);
}
function topicMenu(t, anchor) {
  const here = S.garden.islands[S.isle];
  const move = (to) => { here.zoneIds = here.zoneIds.filter((id) => id !== t.id); to.zoneIds.push(t.id); S.topic = -1; saveGarden(); };
  menu(anchor, [{ label: "Move to island", disabled: true },
    ...S.garden.islands.filter((q) => q !== here && q.zoneIds.length < ISLE_MAX).map((q) => ({ label: (multi() ? hubsOf(S.garden).find((h) => h.id === q.hubId).name + " › " : "") + q.name, run: () => move(q) })),
    !S.garden.mapAt && { label: "New island…", run: async () => { const v = await dialog({ title: "New island", ok: "Move", fields: [{ name: "name", label: "Island", max: 40 }] }); if (!v) return; const q = { id: newId(), name: v.name, landmark: "academy", hubId: here.hubId, zoneIds: [] }; S.garden.islands.push(q); move(q); } }].filter(Boolean));
}
function islesKey(k, stop) {
  const isl = S.model[S.isle], t = isl?.topics[S.topic], hub = S.hub >= 0 ? S.hubs[S.hub] : null, list = hub ? hub.isles : S.model.map((_, i) => i);
  if (/^[1-9]$/.test(k)) { stop(); const i = +k - 1; if (t) { const tr = t.trees[i]; if (tr) goTree(tr.id); } else if (isl) pickTopic(i); else if (multi() && !hub) pickHub(i); else if (list[i] != null) pickIsle(list[i]); return; }
  if (k === "ArrowRight" || k === "ArrowLeft") {
    stop(); const d = k === "ArrowRight" ? 1 : -1, step = (n, at) => ((at < 0 ? (d > 0 ? -1 : 0) : at) + d + n) % n;
    if (isl && S.topic >= 0) pickTopic(step(isl.topics.length, S.topic));
    else if (isl || !multi()) { if (list.length) pickIsle(list[step(list.length, list.indexOf(S.isle))]); }
    else pickHub(step(S.hubs.length, S.hub));
    return;
  }
  if (k === "ArrowDown" || k === "Enter") { stop(); if (t) { if (t.trees[0]) goTree(t.trees[0].id); else newGraph(t.id); } else if (isl) pickTopic(0); else if (multi() && !hub) pickHub(0); else if (list.length) pickIsle(list[0]); return; }
  if (k === "ArrowUp") { stop(); return back(); }
  if (k === "n") { stop(); return newGraph(t?.id); }
  if (k === "z") { stop(); return newZone(); }
  if (k === "m") { stop(); return goMeaning(t?.id); }
  if (k === "s" && t && t.growth >= 2) { stop(); return splitTopic(t); }
  if (k === "w" || k === "v") { stop(); return t ? (t.due.length ? water(t.due) : toast("Nothing to water")) : water(null); }
  if (k === "d") { stop(); $("#gpanel .seg button[aria-pressed=false]")?.click(); }
}

// ---------- the map: hubs, islands and topics laid out elsewhere and brought in as text or a file ----------
function importMap() {
  const file = el("input", { type: "file", accept: "application/json,.json,text/plain", hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; const text = await f.text(); closeTop(); applyMap(text); } });
  dialog({ title: "Import map", ok: "Import", fields: [{ name: "text", label: "Map", type: "textarea", placeholder: "Paste" }], body: el("div", { class: "row" }, file, el("button", { type: "button", class: "btn", id: "mapFile", text: "Choose file", onclick: () => file.click() })) })
    .then((v) => { if (v) applyMap(v.text); });
}
async function applyMap(text) {
  let map; try { map = readMap(text); } catch (e) { return toast(e.message); }
  const g = S.garden, zones = S.allZones.map((z) => ({ id: z.id, name: z.name, trees: S.allTrees.filter((t) => t.zoneId === z.id).length }));
  isles.setActive(false);   // many small writes: the garden stops drawing until they are done
  const done = await safely(async () => {
    for (const m of missing(g, map, zones)) { const z = await store.createZone({ name: m.name }); g.zone[z.id] = { mapId: m.mapId, fromMap: true }; zones.push({ id: z.id, name: z.name, trees: 0 }); }
    const r = mergeMap(g, map, zones);
    for (const x of r.rename) await store.updateZone(x.id, { name: x.name });
    for (const id of r.drop) await store.deleteZone(id);
    await store.setMeta("garden", r.garden);
    return r.garden;
  });
  isles.setActive(S.view === "isles");
  if (!done) return;
  S.hub = -1; S.isle = -1; S.topic = -1; await refresh(); isles.focus(-1);
  const n = done.islands.length; toast(`${done.hubs.length} hub${done.hubs.length === 1 ? "" : "s"}, ${n} island${n === 1 ? "" : "s"}`);
}

// ---------- a topic past 200% moves onto an island of its own ----------
// Its graphs are read as one graph under the trunk picked, and the biggest main branches of that graph become the topics there.
const SPLIT_MAX = ISLE_MAX - 1;
function splitPlan(t, intoId) {
  const into = t.trees.find((x) => x.id === intoId) || t.trees[0], nodes = S.byTree.get(into.id) || [];
  const own = kidsOf(into.rootId).map((n) => ({ name: n.wasTree?.name || n.title, size: store.subtreeIds(nodes, n.id).length, nodeId: n.id }));
  const rest = t.trees.filter((x) => x !== into).map((x) => ({ name: x.name, size: (S.byTree.get(x.id) || []).length, nodeId: x.rootId }));
  return { into, parts: [...own, ...rest].filter((p) => p.size > 1).sort((a, b) => b.size - a.size).slice(0, SPLIT_MAX) };
}
async function splitTopic(t) {
  const here = S.garden.islands[S.isle]; if (!here || !t.trees.length) return;
  const big = [...t.trees].sort((a, b) => (S.byTree.get(b.id) || []).length - (S.byTree.get(a.id) || []).length)[0];
  const list = el("div", { class: "rows", id: "splitParts" }), show = (id) => put(list, splitPlan(t, id).parts.map((p) => el("div", { class: "grow-row" }, el("b", { text: p.name }), el("span", { class: "muted", text: String(p.size) }))));
  show(big.id);
  const ask = dialog({ title: `Split ${t.name}`, ok: "Split", fields: t.trees.length > 1 ? [{ name: "into", label: "Trunk", type: "select", value: big.id, options: t.trees.map((x) => [x.id, x.name]) }] : [], body: list });
  $("#f-into")?.addEventListener("change", (e) => show(e.target.value));
  const v = await ask; if (!v) return;
  const plan = splitPlan(t, v.into || big.id); if (!plan.parts.length) return toast("Nothing to split");
  const before = await safely(() => store.exportAll()); if (!before) return;
  isles.setActive(false);
  const made = await safely(async () => {
    if (t.trees.length > 1) await store.mergeZone(t.id, plan.into.id);
    const ids = [];
    for (const p of plan.parts) {
      const z = await store.createZone({ name: p.name }); await store.splitToTree(p.nodeId, { zoneId: z.id, name: p.name });
      await store.addLink(plan.into.rootId, p.nodeId); ids.push(z.id);
    }
    return ids;
  });
  isles.setActive(S.view === "isles");
  if (!made) return refresh();
  const g = S.garden, at = g.islands.indexOf(here), rec = { id: newId(), name: t.name, landmark: CENTRES[1 + (g.islands.length % 3)][0], hubId: here.hubId, split: t.id, after: here.id, zoneIds: [t.id, ...made] };   // it grows out of the island it split from
  here.zoneIds = here.zoneIds.filter((id) => id !== t.id); g.islands.splice(at + 1, 0, rec);
  await store.setMeta("garden", g); await refresh(); pickIsle(S.model.findIndex((q) => q.id === rec.id));
  toast(`${t.name} has its own island`, { label: "Undo", run: async () => { if ((await safely(async () => { await store.importAll(before, { keepVectors: true }); return true; }))) { S.isle = -1; S.topic = -1; await refresh(); isles.focus(-1); } } });
}

function renderEmpty() {
  const box = $("#empty"), show = (S.view === "forest" || S.view === "isles") && !S.zones.length && S.cutoff == null;
  box.hidden = !show;
  if (!show || box.firstChild) return;
  const input = el("input", { id: "zoneName", placeholder: "First subject", maxLength: 80, required: true, "aria-label": "Zone name", autocomplete: "off" });
  box.append(el("form", { class: "row", onsubmit: async (e) => {
    e.preventDefault();
    const z = await safely(() => store.createZone({ name: input.value })); if (!z) return;
    input.value = ""; await refresh(); newTree(z.id);
  } }, input, el("button", { class: "btn primary", text: "Add zone" })));
}

// ---------- the tech tree: a flat map of every topic and idea ----------
function techData() {
  const model = gardenModel(), rec = new Map(S.garden.islands.map((q) => [q.id, q]));
  artSig = new Map(model.map((q) => [q.id, JSON.stringify([q.landmark, q.mountain, q.topics.map((t) => [t.biome, t.mark, Math.round(t.health * 10), Math.round(t.growth * 10), !!t.mist])])])); artFresh = false;
  return { islands: model.map((q) => ({ id: q.id, name: q.name, hub: q.hub, after: rec.get(q.id)?.after || null, from: rec.get(q.id)?.from || null })),
    topics: model.flatMap((q, i) => q.topics.filter((t) => t.id).map((t) => ({ id: t.id, name: t.name, isle: i, ideas: t.ideas, growth: t.growth, mist: t.mist }))),
    trees: S.trees, nodes: S.nodes.map((n) => ({ ...n, st: thirst(n) })), links: S.links };
}
// Pictures of islands and topics for the tech tree, taken by the garden's renderer one at a time between frames.
const arts = new Map(), artWant = []; let artSig = new Map(), artFresh = false, artTimer = 0;
function techArt(id, slot, night) {
  const key = `${id}|${slot}|${night ? 1 : 0}|${artSig.get(id) || ""}`;
  if (arts.has(key)) return arts.get(key);
  if (!artWant.some((w) => w.key === key)) artWant.push({ key, id, slot, night });
  if (!artTimer) artTimer = setTimeout(takeArt, 30);
  return null;
}
function takeArt() {
  artTimer = 0; if (S.view !== "tech") { artWant.length = 0; return; }
  const w = artWant.shift(); if (!w) return;
  let img = null;
  if (ensureIsles()) {
    if (!artFresh) { S.model = gardenModel(); isles.setData(S.model, crossLinks(), S.hubs); artFresh = true; }
    try { img = isles.snap(w.id, { topic: w.slot, size: w.slot >= 0 ? 112 : 176, night: w.night }); } catch { img = null; }
  }
  if (arts.size > 300) arts.clear();
  arts.set(w.key, img); tech?.redraw();
  if (artWant.length) artTimer = setTimeout(takeArt, 30);
}
function openTech() {
  if (S.view === "tree" || S.view === "meaning") { S.pendingSel = S.sel; location.hash = "#/techtree"; return; }
  const t = S.view === "isles" ? S.model[S.isle]?.topics[S.topic] : null, isl = S.view === "isles" ? S.model[S.isle] : null;
  const at = t?.id || isl?.id;   // a topic opens on its island's tier with it picked; an island opens on its own tier
  location.hash = "#/techtree" + (at ? "/" + encodeURIComponent(at) : "");
}
// The tech tree is dark when the garden is at night, or when the device is dark.
const techNight = () => pref("night", "") === "1";
async function showTech(focus) {
  S.view = "tech"; S.tree = null; S.sel = null; S.lay = null; S.panel = null; clearScene(); hideHover();
  document.body.classList.toggle("night-ui", techNight());
  if (!tech) {
    let saved = {}; try { saved = JSON.parse(pref("tech", "{}")); } catch {}
    Object.assign(saved, (await store.getMeta("techtree").catch(() => null)) || {});
    tech = createTechTree({ host: $("#tech"), saved, art: techArt,
      onSelect: () => renderActions(),
      onOpen: (x) => openFromTech(x),
      onHover: (x, cx, cy) => (x ? techHover(x, cx, cy) : hideHover()),
      onState: (ui) => { setPref("tech", JSON.stringify(ui)); renderActions(); },
      onLayout: (lay) => store.setMeta("techtree", lay).catch(() => {}) });
  }
  tech.setActive(true); tech.setData(techData());
  const at = S.pendingSel || focus; S.pendingSel = null;
  if (at) { if (S.garden?.islands.some((q) => q.id === at)) tech.goTo(at); else tech.focus(at); }
  renderChrome();
}
function techHover(x, cx, cy) {
  const h = $("#hover"), meta = x.kind === "island" ? (x.start ? "" : `${x.topics} topic${x.topics === 1 ? "" : "s"} · ${x.ideas} key idea${x.ideas === 1 ? "" : "s"}${x.fromTitle ? " · from " + x.fromTitle : ""}`) : x.kind === "topic" ? x.island : x.note || x.topic;
  put(h, el("b", { text: x.title }), meta && el("span", { text: meta })); h.hidden = false;
  h.style.left = Math.max(8, Math.min(innerWidth - h.offsetWidth - 8, cx + 14)) + "px";
  h.style.top = (cy + 18 + h.offsetHeight > innerHeight ? cy - h.offsetHeight - 12 : cy + 18) + "px";
}
function openFromTech(x) {
  if (!x) return;
  if (x.kind === "island") { if (x.start) return; S.pendingIsle = x.id; location.hash = "#/"; return; }
  if (x.kind === "topic") { S.pendingTopic = x.zoneId; location.hash = "#/"; return; }
  S.pendingSel = x.id; goTree(x.treeId);
}
function techBar(a) {
  const x = tech.selected, web = tech.mode === "web", f = tech.flags;
  const key = (id, text, k, run, on) => el("button", { class: "btn" + (on ? " on" : ""), id, "aria-pressed": on == null ? null : String(on), onclick: run }, text, el("kbd", { text: k }));
  const sub = x ? (x.kind === "island" ? (x.start ? "" : x.afterName ? `from ${x.fromTitle || x.afterName}` : "") : x.kind === "topic" ? x.island : x.topic) : "";
  put(a,
    x ? el("div", { class: "plant" }, el("b", { text: x.title }), sub ? el("span", { class: "muted", text: sub }) : null) : null,
    x && x.kind === "island" && !x.centre ? key("techIn", "Go in", "↵", () => tech.goTo(x.id)) : null,
    x && x.kind === "idea" ? key("techOpen", "Open", "↵", () => openFromTech(x)) : null,
    x && x.kind === "idea" && x.kids && !web ? key("techInside", x.open ? "Close" : "Inside", "Space", () => tech.key(" ")) : null,
    x && x.kind === "island" && !x.start && !web ? key("techFrom", "Grows from", "B", () => growsFrom(x)) : null,
    x && (x.kind === "island" && !x.start || x.kind === "topic") ? key("techGarden", "Garden", "G", () => openFromTech(x)) : null,
    x ? el("span", { class: "sep" }) : null,
    web ? null : key("techBack", "Back", "Esc", () => techEsc()),
    web ? null : key("techTier", "Tier", "T", () => tech.key("t"), f.tier),
    web ? null : key("techAll", "All", "A", () => tech.key("a"), f.all),
    web ? null : key("techStart", "Start", "H", () => tech.key("h")),
    el("div", { class: "seg keys", role: "group", "aria-label": "Mode" }, key("modeTree", "Tree", "L", () => techMode("tree"), !web), key("modeWeb", "Web", "L", () => techMode("web"), web)),
    web ? key("techReset", "Tidy", "R", () => tech.key("r")) : null,
    web ? key("techLoose", "Jiggle", "J", () => tech.key("j"), f.loose) : null,
    el("div", { class: "seg keys", role: "group", "aria-label": "Look" }, key("lookSimple", "Simple", "Y", () => techLook("simple"), f.look !== "organic"), key("lookOrganic", "Organic", "Y", () => techLook("organic"), f.look === "organic")),
    key("techFit", "Fit", "0", () => tech.fit()));
  a.hidden = false;
}
// Which island an island grows from, and the idea on it that leads here. A judgement, not a fact, so it's yours to set.
async function growsFrom(x) {
  const rec = S.garden.islands.find((q) => q.id === x.id); if (!rec) return;
  const later = new Set([x.id]); let grew = true;
  while (grew) { grew = false; for (const q of S.garden.islands) if (q.after && later.has(q.after) && !later.has(q.id)) { later.add(q.id); grew = true; } }
  const isl = S.garden.islands.filter((q) => !later.has(q.id));
  const v = await dialog({ title: `${x.title} grows from`, ok: "Save", fields: [{ name: "after", label: "Island", type: "select", value: rec.after || "", options: [["", "The start"], ...isl.map((q) => [q.id, q.name])] }] });
  if (!v) return;
  const prev = S.garden.islands.find((q) => q.id === v.after);
  let from = "";
  if (prev) {
    const keys = prev.zoneIds.flatMap((z) => S.trees.filter((t) => t.zoneId === z).map((t) => S.byId.get(t.rootId))).filter(Boolean);
    const w = keys.length ? await dialog({ title: `Which idea on ${prev.name} leads to ${x.title}?`, ok: "Save", fields: [{ name: "from", label: "Idea", type: "select", value: rec.after === v.after ? rec.from || "" : "", options: [["", "None in particular"], ...keys.map((n) => [n.id, n.title])] }] }) : { from: "" };
    if (!w) return; from = w.from;
  }
  rec.after = v.after || null; rec.from = from || null;
  await saveGarden();
}
function techLook(m) { if (tech.flags.look !== m) tech.key("y"); }
function techMode(m) { tech.setMode(m); renderActions(); }
function techEsc() { if (!tech.key("Escape")) location.hash = S.techBack; }
function techKey(k, stop) {
  const x = tech.selected;
  if (k === "l") { stop(); return techMode(tech.mode === "web" ? "tree" : "web"); }
  if (k === "b" && x?.kind === "island" && !x.start && tech.mode === "tree") { stop(); return growsFrom(x); }
  if (k === "g" && x && (x.kind === "topic" || (x.kind === "island" && !x.start))) { stop(); return openFromTech(x); }
  if (tech.key(k === " " ? " " : k)) stop();
}

// ---------- input ----------
function onTap(hit, e) {
  hideHover();
  if (S.pick) { if (hit?.kind === "node" && !S.pick.exclude.has(hit.id)) S.pick.finish(hit.id); return; }
  if (S.view === "garden") {
    if (S.review) return;
    return pickPlant(!hit ? null : hit.kind === "tree" ? hit.id : hit.kind === "node" ? S.byId.get(hit.id)?.treeId : null);
  }
  if (S.view === "forest") {
    if (!hit) return;
    if (hit.kind === "zone") return zoneMenu(hit.id, { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY });
    const treeId = hit.kind === "tree" ? hit.id : hit.kind === "node" ? S.byId.get(hit.id)?.treeId : S.byId.get(S.links.find((l) => l.id === hit.id)?.fromId)?.treeId;
    if (treeId) openTree(treeId);
    return;
  }
  if (S.review || S.cutoff != null) return;
  if (S.quick) { S.quick = null; }
  if (!hit) return select(null);
  if (hit.kind === "group") { const L = stage.labels.find((x) => x.kind === "group" && x.id === hit.id); if (L) stage.flyTo({ target: L.pos, radius: Math.min(stage.radius, stage.fitDistance(S.lay.radius) * 0.5) }); return; }
  if (hit.kind === "link") { const l = S.links.find((x) => x.id === hit.id); if (l) { S.panel = "node"; select(l.fromId); } return; }
  if (e.pointerType === "mouse" || S.sel === hit.id) { S.panel = "node"; select(hit.id); }
  else {
    select(hit.id);
    const p = stage.screenOf(S.flora.pos.get(hit.id)), r = stage.container.getBoundingClientRect();
    showHover(hit.id, r.left + p.x - 14, r.top + p.y);
  }
}
function back() {
  if (closeTop()) return;
  if (S.pick) return S.pick.finish(null);
  if (S.quick) { S.quick = null; return renderActions(); }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return document.activeElement.blur();
  if (S.review) return endReview();
  if (S.cutoff != null) return toggleTimeline();
  if (S.panel) { S.panel = null; return renderPanel(); }
  if (S.nside && S.view === "tree") return toggleSide();
  if (S.view === "garden" && S.fsel) return pickPlant(null);
  if (S.view === "notes") return;   // a window of its own: nothing to step back to
  if (S.view === "isles") { if (S.topic >= 0) return pickTopic(-1); if (S.isle >= 0) return pickIsle(-1); if (S.hub >= 0) pickHub(-1); return; }
  if (S.view === "tech") return techEsc();
  location.hash = S.view === "tree" ? S.treeBack : S.view === "meaning" ? S.meanBack : "#/";
}
function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); return back(); }
  if (e.ctrlKey || e.metaKey || e.altKey || overlayOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || e.target?.isContentEditable || document.activeElement?.isContentEditable) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, stop = () => e.preventDefault();
  if (S.review) {
    const r = S.review;
    if (k === " " || k === "Enter") { stop(); if (!r.shown) { r.shown = true; renderReview(); } }
    else if (r.shown && "1234".includes(k)) rateNow(srs.RATINGS[+k - 1]);
    return;
  }
  if (S.pick) return;
  if (k === "Tab" && e.shiftKey) { stop(); return toggleWindow(); }
  if (k === "/") { stop(); return S.view === "notes" ? $("#notesSearch")?.focus() : find(); }
  if (k === "?") { stop(); return shortcuts(); }
  if (k === "i") { stop(); return capture(); }
  if (k === "k") { stop(); return openTech(); }
  if (k === "o") { stop(); return openNotes(); }
  if (S.view === "tech") return techKey(k, stop);
  if (S.view === "notes") return notesKey(k, stop);
  if (k === "t" && S.view !== "isles") { stop(); return toggleTimeline(); }
  if (k === "0") { stop(); return S.view === "isles" ? pickHub(-1) : fitView(); }
  if (S.cutoff != null) return;
  if (S.view === "isles") return islesKey(k, stop);
  if (S.view === "garden") {
    if (k === "v") { stop(); return startReview(null); }
    if (k.startsWith("Arrow")) { stop(); stepForest(k === "ArrowRight" || k === "ArrowUp" ? 1 : -1); return renderActions(); }
    if (k === "Enter" && treeOf(S.fsel)) { stop(); return startReview(S.fsel); }
    return;
  }
  if (S.view === "forest") {
    if (k === "m") { stop(); return goMeaning(); }
    if (k === "n") { stop(); return newTree(); }
    if (k === "z") { stop(); return newZone(); }
    if (k.startsWith("Arrow")) { stop(); return stepForest(k === "ArrowRight" || k === "ArrowUp" ? 1 : -1); }
    if (k === "Enter" && treeOf(S.fsel)) { stop(); return openTree(S.fsel); }
    return;
  }
  const n = S.byId.get(S.sel);
  if (S.view === "meaning") {
    if (k === "m") { stop(); location.hash = S.meanBack; }
    else if (k === "Enter" && n) { stop(); S.pendingSel = n.id; goTree(n.treeId); }
    else if (k === " ") { stop(); togglePanel(); }
    else if (k === "l") { stop(); linkFrom(); }
    else if (k === "f" && n) stage.flyTo({ target: S.flora.home.get(n.id), radius: Math.min(stage.radius, 8) });
    else if (k.startsWith("Arrow")) { stop(); nav(k); }
    return;
  }
  if (k === "m") { stop(); S.pendingSel = S.sel; return goMeaning(S.tree.zoneId); }
  if (k === "Tab") { stop(); quick("child"); }
  else if (k === "Enter") { stop(); quick("sibling"); }
  else if (k === "r" || k === "F2") { stop(); if (n) quick("rename"); }
  else if (k === "Delete" || k === "Backspace") { stop(); if (n) removeNode(n.id); }
  else if (k === " ") { stop(); togglePanel(); }
  else if (k === "f") { if (n) stage.flyTo({ target: S.flora.home.get(n.id), radius: Math.min(stage.radius, 8) }); }
  else if (k === "l") { stop(); linkFrom(); }
  else if (k === "g") { stop(); graft(); }
  else if (k === "c") { if (n) cycleColour(n); }
  else if (k === "p") { stop(); togglePatches(); }
  else if (k.startsWith("Arrow")) { stop(); nav(k); }
}

// ---------- notes: the third window. Folders and pages as in Notion, properties at the top of a page, nothing tied to graphs ----------
const pageOf = (id) => S.pages.find((p) => p.id === id);
const isFolder = (p) => p?.kind === "folder";
const topLevel = (p) => !p.parentId || !pageOf(p.parentId);
const byPageOrder = (a, b) => (isFolder(b) - isFolder(a)) || (a.order || 0) - (b.order || 0) || a.createdAt.localeCompare(b.createdAt);   // folders first, as in a file list
const kidPages = (id) => S.pages.filter((p) => (id ? p.parentId === id : topLevel(p))).sort(byPageOrder);
const pageTitle = (id) => (pageOf(id) ? pageOf(id).title || "Untitled" : "");
const pagePath = (p) => { const out = []; for (let q = pageOf(p?.parentId); q; q = pageOf(q.parentId)) out.unshift(q); return out; };
const tagsOf = (p) => (p.props || []).filter((x) => x.type === "tags" || x.type === "select" || x.type === "status").flatMap((x) => [].concat(x.value || []));
// [type, name it starts with, icon]; created and edited fill themselves in
const PI = { text: "M4 7h16M4 12h16M4 17h10", number: "M9 4L7 20M17 4l-2 16M4 9h16M3 15h16", select: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 10l4 4 4-4", tags: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  status: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1", date: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", checkbox: "M4 4h16v16H4zM8 12l3 3 5-6",
  url: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1", email: "M3 6h18v12H3zM3 6l9 7 9-7", phone: "M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z",
  created: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", edited: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" };
const PROP_TYPES = [["text", "Text"], ["number", "Number"], ["select", "Select"], ["tags", "Tags"], ["status", "Status"], ["date", "Date"], ["checkbox", "Checkbox"], ["url", "URL"], ["email", "Email"], ["phone", "Phone"], ["created", "Created"], ["edited", "Last edited"]];
const PROP_SUGGEST = [["date", "Due date"], ["status", "Status"], ["select", "Priority"], ["tags", "Tags"], ["url", "Link"], ["date", "Date"]];
const PROP_OPTIONS = { Priority: ["High", "Medium", "Low"] };
const STATUSES = [["Not started", "gray"], ["In progress", "yellow"], ["Done", "green"]];
const TAG_COLOURS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const tagColour = (v) => { let h = 0; for (const c of String(v)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TAG_COLOURS[h % TAG_COLOURS.length]; };
const notesOpen = () => S.nopen || (S.nopen = new Set((() => { try { return JSON.parse(pref("notesOpen", "[]")); } catch { return []; } })()));
function setOpen(id, on) { const o = notesOpen(); if (on) o.add(id); else o.delete(id); setPref("notesOpen", JSON.stringify([...o])); }
const notesHash = (id = S.npage) => "#/notes" + (id ? "/" + encodeURIComponent(id) : "");
// the sidebar rows: the tree with open folders, or search results
function noteRows() {
  const q = (S.nq || "").trim().toLowerCase();
  if (q) {
    const tagOnly = q.startsWith("#"), w = tagOnly ? q.slice(1) : q;
    return S.pages.filter((p) => tagsOf(p).some((t) => t.toLowerCase().includes(w)) || (!tagOnly && (p.title || "Untitled").toLowerCase().includes(w)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({ p, depth: 0, hit: true }));
  }
  const out = [], open = notesOpen();
  const walk = (id, depth) => { for (const p of kidPages(id)) { out.push({ p, depth }); if (open.has(p.id)) walk(p.id, depth + 1); } };
  walk(null, 0); return out;
}
// O: the notes window, or in a knowledge graph the notes drawer beside it
function openNotes() {
  if (S.view === "tree") return toggleSide();
  if (S.view !== "notes") location.hash = S.lastNotes || notesHash();
}
function showNotes(id) {
  S.view = "notes"; S.tree = null; S.sel = null; S.lay = null; S.panel = null; clearScene(); hideHover();
  S.npage = pageOf(id) ? id : pageOf(S.npage) ? S.npage : noteRows()[0]?.p.id || null;
  for (const q of pagePath(pageOf(S.npage))) setOpen(q.id, true);   // show the way down to it
  const search = el("input", { id: "notesSearch", type: "text", placeholder: "Search pages or #tags", "aria-label": "Search notes", autocomplete: "off", value: S.nq || "",
    oninput: (e) => { S.nq = e.target.value; drawPageList(); },
    onkeydown: (e) => {
      const rows = noteRows();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const i = rows.findIndex((r) => r.p.id === S.npage); const r = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]; if (r) pickPage(r.p.id, { keepFocus: true }); }
      else if (e.key === "Enter") { e.preventDefault(); if (rows[0] && !rows.some((r) => r.p.id === S.npage)) pickPage(rows[0].p.id); e.target.blur(); S.ed?.focus("start"); }
      else if (e.key === "Escape" && e.target.value) { e.preventDefault(); e.stopPropagation(); S.nq = ""; e.target.value = ""; drawPageList(); }
    } });
  const tree = el("div", { class: "ntree", id: "nlist", role: "tree", "aria-label": "Pages",
    ondragover: (e) => { if (S.ndrag && e.target === tree) { e.preventDefault(); tree.classList.add("drop"); } }, ondragleave: () => tree.classList.remove("drop"),
    ondrop: (e) => { if (e.target !== tree) return; e.preventDefault(); tree.classList.remove("drop"); movePage(S.ndrag, null); } });
  const foot = el("div", { class: "nfoot" },
    el("button", { class: "btn", id: "newPageBtn", onclick: () => newPage() }, "+ Page", el("kbd", { text: "N" })),
    el("button", { class: "btn", id: "newFolderBtn", onclick: () => newPage(null, "folder") }, "+ Folder", el("kbd", { text: "F" })));
  put($("#notes"), el("nav", { class: "nside-bar", "aria-label": "Notes" }, el("div", { class: "nsearch" }, search, el("kbd", { text: "/" })), tree, foot),
    el("section", { class: "nmain" }, el("div", { class: "pbar", id: "pbar" }), el("div", { class: "nedit", id: "nedit" })));
  setNotesHash(); drawPageList(); drawEditor(); renderChrome();
}
function setNotesHash() { const h = notesHash(); history.replaceState(null, "", h); S.hashNow = h; S.lastNotes = h; }
function drawPageList() {
  const host = $("#nlist"); if (!host) return;
  const rows = noteRows(), open = notesOpen();
  put(host, rows.map(({ p, depth, hit }, i) => {
    const kids = kidPages(p.id).length, folder = isFolder(p), isOpen = open.has(p.id);
    const row = el("div", { class: "nrow" + (p.id === S.npage ? " on" : "") + (folder ? " folder" : ""), dataset: { id: p.id }, style: `--d:${depth}`, role: "treeitem", draggable: !hit,
      ondragstart: (e) => { S.ndrag = p.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); },
      ondragend: () => { S.ndrag = null; },
      ondragover: (e) => { if (S.ndrag && S.ndrag !== p.id) { e.preventDefault(); row.classList.add("drop"); } }, ondragleave: () => row.classList.remove("drop"),
      ondrop: (e) => { e.preventDefault(); row.classList.remove("drop"); if (S.ndrag) movePage(S.ndrag, p.id); } },
      hit ? null : el("button", { class: "chev" + (kids || folder ? "" : " none"), type: "button", tabIndex: -1, "aria-label": isOpen ? "Close" : "Open", "aria-expanded": kids || folder ? String(isOpen) : null, onclick: () => { if (kids || folder) { setOpen(p.id, !isOpen); drawPageList(); } } }),
      el("button", { class: "nname", type: "button", onclick: () => pickPage(p.id) },
        icon(folder ? ICON.folder : ICON.page), el("span", { class: "nt", text: p.title || (folder ? "New folder" : "Untitled") }),
        hit && pagePath(p).length ? el("span", { class: "npath", text: pagePath(p).map((q) => q.title || "Untitled").join(" / ") }) : null),
      el("kbd", { text: i < 9 ? String(i + 1) : "", class: i < 9 ? "" : "blank" }),
      hit ? null : el("button", { class: "nadd", type: "button", tabIndex: -1, title: folder ? "New page in this folder" : "New page inside", "aria-label": "New page inside", onclick: () => newPage(p.id) }, "+"));
    return row;
  }), !rows.length ? el("p", { class: "muted nnone", text: S.nq ? "No matches" : "No pages yet" }) : null);
}
// the bar over the page: where it sits, and its menu
function drawPageBar() {
  const bar = $("#pbar"); if (!bar) return;
  const p = pageOf(S.npage);
  if (!p) { bar.replaceChildren(); return; }
  put(bar, el("div", { class: "pcrumb" }, pagePath(p).map((q) => [el("button", { class: "link", type: "button", text: q.title || "Untitled", onclick: () => pickPage(q.id) }), el("span", { class: "sl", text: "/" })]),
      el("span", { class: "here", text: p.title || (isFolder(p) ? "New folder" : "Untitled") })),
    el("span", { class: "grow" }),
    p.grown?.length ? el("span", { class: "muted", text: `Grown ${p.grown.length}×` }) : null,
    ib("pageMore", "Page menu", ICON.more, (e) => pageMenu(p, e.currentTarget)));
}
function drawEditor() {
  const host = $("#nedit"); if (!host) return;
  S.ed?.destroy(); S.ed = null;
  drawPageBar();
  const p = pageOf(S.npage);
  if (!p) { put(host, el("div", { class: "page none" }, el("button", { class: "btn", id: "firstPage", onclick: () => newPage() }, "New page", el("kbd", { text: "N" })))); return; }
  put(host, isFolder(p) ? folderView(p) : pageView(p, false));
}
function folderView(p) {
  const kids = kidPages(p.id);
  return el("article", { class: "page" }, titleInput(p, false),
    el("div", { class: "flist" }, kids.map((k) => el("button", { class: "frow", type: "button", onclick: () => pickPage(k.id) }, icon(isFolder(k) ? ICON.folder : ICON.page), el("span", { text: k.title || (isFolder(k) ? "New folder" : "Untitled") }),
      el("span", { class: "muted", text: fmtDate(k.updatedAt) }))),
      el("button", { class: "frow add", type: "button", id: "folderAdd", onclick: () => newPage(p.id) }, "+ New page")));
}
function titleInput(p, side) {
  return el("input", { id: side ? "sideTitle" : "pageTitle", class: "ptitle", value: p.title || "", placeholder: isFolder(p) ? "New folder" : "Untitled", maxLength: 120, "aria-label": "Title", autocomplete: "off",
    oninput: (e) => { queuePage(p.id, { title: e.target.value }); const r = $(`#nlist .nrow[data-id="${p.id}"] .nt`); if (r) r.textContent = e.target.value || "Untitled"; const h = $("#pbar .here"); if (h && !side) h.textContent = e.target.value || "Untitled"; const o = $(`#sidePage option[value="${p.id}"]`); if (o) o.textContent = e.target.value || "Untitled"; },
    onkeydown: (e) => { if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); if (S.ed) S.ed.focus("start"); else e.target.blur(); } } });
}
function pageView(p, side) {
  const body = el("div", { class: "pbody" });
  const blocks = (p.blocks || []).filter((b) => b.type !== "page" || pageOf(b.pageId));
  S.ed = createEditor({ host: body, blocks, onChange: (bl) => queuePage(p.id, { blocks: bl }), pageTitle,
    openPage: (id) => (S.view === "notes" ? pickPage(id) : (location.hash = notesHash(id))),
    newSubpage: async () => { const c = await safely(() => store.addPage({ parentId: p.id })); if (!c) return null; S.pages.push(c); setOpen(p.id, true); return c.id; } });
  return el("article", { class: "page" + (side ? " side" : "") }, titleInput(p, side), propsView(p), body);
}
// ---- properties at the top of a page, as in Notion ----
const propIcon = (type) => el("span", { class: "pg" }, icon(PI[type] || PI.text));
function propsView(p) {
  const box = el("div", { class: "props", id: "props" });
  const save = () => { queuePage(p.id, { props: (p.props || []).map((x) => ({ ...x })) }); draw(); };
  const add = (type, label) => {
    const taken = new Set((p.props || []).map((x) => x.name)); let name = label, n = 2; while (taken.has(name)) name = `${label} ${n++}`;
    p.props = [...(p.props || []), { id: "pr" + Date.now().toString(36), name, type, value: type === "tags" ? [] : type === "checkbox" ? false : type === "status" ? "Not started" : "" }]; save();
    const last = [...box.querySelectorAll(".prow")].at(-1)?.querySelector(".pv"); if (last && type !== "checkbox" && type !== "created" && type !== "edited") (last.tagName === "INPUT" ? last.focus() : last.click());
  };
  const draw = () => put(box, (p.props || []).map((pr) => el("div", { class: "prow", dataset: { type: pr.type } },
      el("button", { class: "pname", type: "button", title: pr.name, onclick: (e) => propMenu(p, pr, e.currentTarget, save) }, propIcon(pr.type), el("span", { text: pr.name })),
      propValue(p, pr, save))),
    el("button", { class: "padd", type: "button", id: "propAdd", onclick: (e) => {
      const have = new Set((p.props || []).map((x) => x.name));
      menu(e.currentTarget, [...PROP_SUGGEST.filter(([, name]) => !have.has(name)).map(([type, label]) => ({ label, key: PROP_TYPES.find((t) => t[0] === type)[1], run: () => add(type, label) })), "-",
        ...PROP_TYPES.map(([type, label]) => ({ label, run: () => add(type, label) }))]);
    } }, el("span", { class: "pg" }, icon(ICON.plus)), el("span", { text: "Add a property" })));
  draw(); return box;
}
function propValue(p, pr, save) {
  const set = (v) => { pr.value = v; queuePage(p.id, { props: p.props.map((x) => ({ ...x })) }); };
  const empty = () => el("span", { class: "empty", text: "Empty" });
  if (pr.type === "checkbox") return el("label", { class: "pv chk" }, el("input", { type: "checkbox", checked: !!pr.value, "aria-label": pr.name, onchange: (e) => set(e.target.checked) }));
  if (pr.type === "created" || pr.type === "edited") return el("span", { class: "pv ro", text: longDate((pr.type === "created" ? p.createdAt : p.updatedAt).slice(0, 10)) });
  if (pr.type === "date") return el("button", { class: "pv", type: "button", "aria-label": pr.name, onclick: (e) => datePicker(e.currentTarget, pr.value || "", (v) => { set(v); save(); }) }, pr.value ? el("span", { text: longDate(pr.value) }) : empty());
  if (pr.type === "status") {
    const [name, c] = STATUSES.find((x) => x[0] === pr.value) || [pr.value, "gray"];
    return el("button", { class: "pv", type: "button", "aria-label": pr.name, onclick: (e) => menu(e.currentTarget, STATUSES.map(([v]) => ({ label: (pr.value === v ? "✓ " : "") + v, run: () => { set(v); save(); } }))) },
      name ? el("span", { class: "stat c-" + c, text: name }) : empty());
  }
  if (pr.type === "select" || pr.type === "tags") {
    const vals = [].concat(pr.value || []).filter(Boolean);
    return el("button", { class: "pv chips", type: "button", "aria-label": pr.name, onclick: (e) => tagPicker(p, pr, e.currentTarget, save) },
      vals.length ? vals.map((v) => el("span", { class: "tagc c-" + tagColour(v), text: v })) : empty());
  }
  const kind = { number: "number", url: "url", email: "email", phone: "tel" }[pr.type] || "text";
  const input = el("input", { class: "pv", type: kind, value: pr.value ?? "", placeholder: "Empty", "aria-label": pr.name, oninput: (e) => set(e.target.value) });
  const href = pr.type === "url" ? (/^https?:/i.test(pr.value) ? pr.value : "https://" + pr.value) : pr.type === "email" ? "mailto:" + pr.value : pr.type === "phone" ? "tel:" + pr.value : "";
  return href && pr.value ? el("div", { class: "pvwrap" }, input, el("a", { class: "ib small", href, target: pr.type === "url" ? "_blank" : null, rel: "noopener", title: "Open", "aria-label": "Open", text: "↗" })) : input;
}
function propMenu(p, pr, anchor, save) {
  menu(anchor, [
    { label: "Rename", run: async () => { const v = await dialog({ title: "Property", fields: [{ name: "n", label: "Name", value: pr.name, max: 40 }] }); if (v?.n.trim()) { pr.name = v.n.trim(); save(); } } },
    { label: "Type", run: () => menu(anchor, PROP_TYPES.map(([type, label]) => ({ label: (pr.type === type ? "✓ " : "") + label, run: () => {
      if (pr.type === type) return;
      const was = [].concat(pr.value ?? []).filter((x) => x !== "" && x != null && typeof x !== "boolean").map(String);
      pr.value = type === "tags" ? was : type === "select" ? was[0] || "" : type === "status" ? (STATUSES.some((x) => x[0] === was[0]) ? was[0] : "Not started") : type === "checkbox" ? false : type === "date" ? (/^\d{4}-\d{2}-\d{2}$/.test(was[0] || "") ? was[0] : "") : ["text", "url", "email", "phone"].includes(type) ? was.join(", ") : "";
      pr.type = type; save();
    } }))) },
    { label: "Move up", disabled: p.props[0] === pr, run: () => { const i = p.props.indexOf(pr); p.props.splice(i - 1, 0, ...p.props.splice(i, 1)); save(); } },
    "-", { label: "Delete property", danger: true, run: () => { p.props = p.props.filter((x) => x !== pr); save(); } },
  ]);
}
// choose tags or a select value: type to filter, Enter to make a new one; options come from every page's property of the same name
function tagPicker(p, pr, anchor, save) {
  const known = [...new Set([...(PROP_OPTIONS[pr.name] || []), ...S.pages.flatMap((q) => (q.props || []).filter((x) => x.name === pr.name && (x.type === "tags" || x.type === "select")).flatMap((x) => [].concat(x.value || [])))].filter(Boolean))];
  const multi = pr.type === "tags";
  let close;
  const input = el("input", { type: "text", placeholder: multi ? "Find or add a tag" : "Find or add an option", "aria-label": "Tag", autocomplete: "off" });
  const list = el("div", { class: "tlist" });
  const has = (v) => [].concat(pr.value || []).includes(v);
  const toggle = (v) => {
    if (multi) pr.value = has(v) ? pr.value.filter((x) => x !== v) : [...[].concat(pr.value || []), v]; else pr.value = has(v) ? "" : v;
    save(); if (!multi) close(); else draw();
  };
  const draw = () => {
    const q = input.value.trim(), hits = known.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
    put(list, hits.map((v) => el("button", { type: "button", class: "ti" + (has(v) ? " on" : ""), onclick: () => toggle(v) }, el("span", { class: "tagc c-" + tagColour(v), text: v }), has(v) ? el("span", { class: "muted", text: "✓" }) : null)),
      q && !known.some((v) => v.toLowerCase() === q.toLowerCase()) ? el("button", { type: "button", class: "ti new", onclick: () => { known.push(q); input.value = ""; toggle(q); } }, el("span", { class: "muted", text: "Create" }), el("span", { class: "tagc c-" + tagColour(q), text: q })) : null);
  };
  input.addEventListener("input", draw);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); const q = input.value.trim(); if (!q) return close(); const hit = known.find((v) => v.toLowerCase() === q.toLowerCase()); if (!hit) known.push(q); input.value = ""; toggle(hit || q); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  });
  const pop = el("div", { class: "menu tagpop", role: "dialog", "aria-label": pr.name }, input, list);
  const scrim = el("div", { class: "scrim clear", onpointerdown: (e) => { if (e.target === scrim) close(); } }, pop);
  close = () => { scrim.remove(); document.removeEventListener("keydown", esc, true); };
  const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener("keydown", esc, true);
  $("#overlay").append(scrim); draw();
  const r = anchor.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(innerWidth - 268, r.left)) + "px"; pop.style.top = Math.min(innerHeight - 260, r.bottom + 4) + "px";
  input.focus();
}
async function pickPage(id, { keepFocus = false } = {}) {
  const p = pageOf(id); if (!p) return;
  await flushPage(); S.npage = id;
  if (S.view === "notes") {
    if (!S.nq) for (const q of pagePath(p)) setOpen(q.id, true);
    setNotesHash(); drawPageList(); drawEditor(); renderActions();
    if (keepFocus) $("#notesSearch")?.focus();
  } else { S.sideFor = null; renderSide(); }
  if (!keepFocus && !p.title && !isFolder(p) && !(p.blocks || []).length) $(S.view === "notes" ? "#pageTitle" : "#sideTitle")?.focus();   // a fresh page: straight to its title
}
// typing is saved shortly after it stops, and before anything else is opened
let pageTimer = 0, pageDirty = null;
async function flushPage() {
  S.ed?.flush?.();
  clearTimeout(pageTimer); const d = pageDirty; pageDirty = null;
  if (d) await store.updatePage(d.id, d.patch).catch(() => {});
}
function queuePage(id, patch) {
  if (pageDirty && pageDirty.id !== id) { const d = pageDirty; pageDirty = null; store.updatePage(d.id, d.patch).catch(() => {}); }
  pageDirty = { id, patch: { ...(pageDirty?.patch || {}), ...patch } };
  const p = pageOf(id); if (p) Object.assign(p, patch);
  clearTimeout(pageTimer); pageTimer = setTimeout(() => { const d = pageDirty; pageDirty = null; if (d) store.updatePage(d.id, d.patch).catch(() => {}); }, 500);
}
async function newPage(parentId = null, kind = "page") {
  if (parentId === null && S.view === "notes" && isFolder(pageOf(S.npage)) && kind === "page") parentId = S.npage;   // new pages go in the open folder
  await flushPage();
  const p = await safely(() => store.addPage({ parentId, kind })); if (!p) return;
  const par = pageOf(parentId);
  if (par && !isFolder(par)) await safely(() => store.updatePage(parentId, { blocks: [...(par.blocks || []), { id: "b" + Date.now().toString(36), type: "page", pageId: p.id, html: "", indent: 0 }] }));   // like Notion: a link in the page it's in
  if (parentId) setOpen(parentId, true);
  await load(); S.npage = p.id; S.nq = ""; if ($("#notesSearch")) $("#notesSearch").value = "";
  if (S.view === "notes") { setNotesHash(); drawPageList(); drawEditor(); renderActions(); } else { S.nside = true; S.sideFor = null; renderSide(); }
  const ti = $(S.view === "notes" ? "#pageTitle" : "#sideTitle"); ti?.focus(); ti?.select();
}
async function movePage(id, toId) {
  const p = pageOf(id); if (!p || id === toId || (p.parentId || null) === (toId || null)) return;
  await flushPage();
  if (await safely(() => store.updatePage(id, { parentId: toId || null, order: Date.now() }))) { if (toId) setOpen(toId, true); await load(); S.npage = id; redrawNotes(); }
}
async function removePage(id) {
  await flushPage();
  const gone = await safely(() => store.deletePage(id)); if (!gone?.length) return;
  if (gone.some((g) => g.id === S.npage)) { const rows = noteRows().map((r) => r.p.id).filter((x) => !gone.some((g) => g.id === x)); S.npage = rows[0] || null; }
  S.ed?.destroy(); S.ed = null;
  await load(); redrawNotes();
  toast(gone.length > 1 ? `Deleted ${gone.length} pages` : isFolder(gone[0]) ? "Folder deleted" : "Page deleted", { label: "Undo", run: async () => { await store.putPages(gone); await load(); S.npage = gone[0].id; redrawNotes(); } });
}
function redrawNotes() {
  if (S.view === "notes") { setNotesHash(); drawPageList(); drawEditor(); renderActions(); renderTop(); }
  else { S.sideFor = null; renderSide(); }
}
// where a page can be moved to: the top level, or any folder or page that isn't inside it
function moveMenu(p, anchor) {
  const inside = new Set([p.id]); { const st = [p.id]; while (st.length) { const x = st.pop(); for (const c of S.pages.filter((q) => q.parentId === x)) { inside.add(c.id); st.push(c.id); } } }
  const spots = S.pages.filter((q) => !inside.has(q.id)).sort((a, b) => isFolder(b) - isFolder(a) || (a.title || "").localeCompare(b.title || ""));
  menu(anchor, [{ label: (p.parentId ? "" : "✓ ") + "Top level", run: () => movePage(p.id, null) }, "-",
    ...spots.map((q) => ({ label: (p.parentId === q.id ? "✓ " : "") + [...pagePath(q), q].map((x) => x.title || (isFolder(x) ? "New folder" : "Untitled")).join(" / "), run: () => movePage(p.id, q.id) }))]);
}
function pageMenu(p, anchor) {
  menu(anchor, [
    !isFolder(p) && { label: "Grow into a knowledge graph", key: "G", run: () => growDialog(p.id) },
    p.grown?.length && { label: "Take back the last grow", run: () => ungrow(p.id) },
    { label: isFolder(p) ? "New page in this folder" : "New page inside", run: () => newPage(p.id) },
    { label: "Move to", run: () => moveMenu(p, anchor) },
    "-", { label: isFolder(p) ? "Delete folder" : "Delete page", key: "Del", danger: true, run: () => removePage(p.id) },
  ]);
}
// Grow: Claude reads the page and says which ideas it holds and how they string onto a topic's graphs.
// For now that's a copy and paste round trip, so it runs on the Claude plan with no key.
async function growDialog(id) {
  await flushPage(); const page = pageOf(id); if (!page || isFolder(page)) return;
  const text = blocksToText(page.blocks, pageTitle);
  if (!text.trim()) return toast("Nothing to grow");
  const zones = notesTopics().flatMap((g) => g.zones); if (!zones.length) return toast("Make a topic first");
  let zoneId = [page.grown?.at(-1)?.zoneId, pref("growZone", "")].find((z) => zones.some((x) => x.id === z)) || zones[0].id, plan = null, prompt = "", trees = [], nodes = [];
  const sum = el("p", { class: "meta", id: "growSum", "aria-live": "polite" });
  const reply = el("textarea", { id: "growReply", rows: 8, placeholder: "Claude's reply", "aria-label": "Claude's reply", oninput: () => check(),
    onkeydown: (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); reply.form?.requestSubmit(); } } });
  const box = el("textarea", { id: "growPrompt", readOnly: true, rows: 4, hidden: true, "aria-label": "For Claude" });
  const copy = el("button", { type: "button", class: "btn primary", id: "growCopy", onclick: async () => {
    try { await navigator.clipboard.writeText(prompt); copy.textContent = "Copied"; } catch { box.hidden = false; box.focus(); box.select(); }
  } }, "Copy for Claude");
  const make = () => {
    const zone = zones.find((z) => z.id === zoneId); trees = S.trees.filter((t) => t.zoneId === zoneId); const inTopic = new Set(trees.map((t) => t.id));
    nodes = S.nodes.filter((n) => inTopic.has(n.treeId));
    const grownTitles = (page.grown || []).flatMap((g) => g.nodeIds).map((x) => S.byId.get(x)?.title).filter(Boolean);
    prompt = growPrompt({ topic: zone?.name || "", page: { title: page.title, text }, trees, nodes, grownTitles }); S.lastPrompt = prompt; box.value = prompt; copy.textContent = "Copy for Claude"; check();
  };
  const check = () => {
    const r = readGrow(reply.value);
    plan = r.graphs.length || r.links.length ? planGrow(r, { trees, nodes, allNodes: S.nodes, links: S.links }) : null;
    sum.textContent = plan ? (plan.added || plan.links.length ? growSummary(plan) : "Nothing new") : reply.value.trim() ? "Not a Bonsai reply" : "";
  };
  const topic = el("select", { id: "growTopic", "aria-label": "Topic", onchange: (e) => { zoneId = e.target.value; make(); } },
    notesTopics().map((g) => (g.name ? el("optgroup", { label: g.name }, g.zones.map((z) => el("option", { value: z.id, text: z.name, selected: z.id === zoneId }))) : g.zones.map((z) => el("option", { value: z.id, text: z.name, selected: z.id === zoneId })))));
  make();
  const body = el("div", { class: "growd" }, el("label", {}, el("span", { text: "Topic" }), topic), el("div", { class: "row" }, copy, el("a", { class: "btn", href: "https://claude.ai/new", target: "_blank", rel: "noopener", text: "Open Claude" })), reply, sum, box);
  const ok = await dialog({ title: "Grow into a knowledge graph", ok: "Grow", body });
  if (!ok) return;
  check();
  if (!plan || !(plan.added || plan.links.length)) return toast(plan ? "Nothing new" : "Not a Bonsai reply");
  setPref("growZone", zoneId);
  const made = await safely(() => store.growPage(page.id, plan, zoneId)); if (!made) return;
  await refresh(); redrawNotes();
  const n = made.nodeIds.length, l = made.linkIds.length;
  toast(`Grew ${n} idea${n === 1 ? "" : "s"}${l ? `, ${l} link${l === 1 ? "" : "s"}` : ""}`, { label: "Undo", run: () => ungrow(page.id) });
}
async function ungrow(id) {
  const made = await safely(() => store.ungrowPage(id)); if (!made) return;
  await refresh(); redrawNotes(); toast("Taken back");
}
// topics in garden order, grouped by island (for choosing where a page grows)
function notesTopics() {
  const seen = new Set(), groups = [], live = new Map(S.zones.map((z) => [z.id, z]));
  for (const isl of S.model || []) {
    const zs = isl.topics.map((t) => live.get(t.id)).filter((z) => z && !seen.has(z.id)); zs.forEach((z) => seen.add(z.id));
    if (zs.length) groups.push({ name: isl.name, zones: zs });
  }
  const rest = S.zones.filter((z) => !seen.has(z.id)); if (rest.length) groups.push({ name: groups.length ? "Other" : "", zones: rest });
  return groups;
}
function notesKey(k, stop) {
  const rows = noteRows().map((r) => r.p), i = rows.findIndex((p) => p.id === S.npage), p = pageOf(S.npage);
  if (k === "n") { stop(); return newPage(); }
  if (k === "f") { stop(); return newPage(null, "folder"); }
  if (k === "g" && p && !isFolder(p)) { stop(); return growDialog(p.id); }
  if ((k === "Delete" || k === "Backspace") && p) { stop(); return removePage(p.id); }
  if (k === "Enter" && p) { stop(); if (isFolder(p)) { setOpen(p.id, !notesOpen().has(p.id)); return drawPageList(); } return S.ed?.focus("end"); }
  if (/^[1-9]$/.test(k) && rows[+k - 1]) { stop(); return pickPage(rows[+k - 1].id); }
  if ((k === "ArrowDown" || k === "ArrowUp") && rows.length) { stop(); return pickPage(rows[Math.max(0, Math.min(rows.length - 1, i + (k === "ArrowDown" ? 1 : -1)))].id); }
  if ((k === "ArrowRight" || k === "ArrowLeft") && p) {   // open or close what's inside, as in a file tree
    stop(); const has = isFolder(p) || kidPages(p.id).length;
    if (k === "ArrowRight" && has) { setOpen(p.id, true); drawPageList(); }
    else if (k === "ArrowLeft") { if (has && notesOpen().has(p.id)) { setOpen(p.id, false); drawPageList(); } else if (p.parentId && pageOf(p.parentId)) pickPage(p.parentId); }
  }
}
// In a knowledge graph, O pulls notes up beside it: the page last open, any page to pick.
function toggleSide() { S.nside = !S.nside; S.sideFor = null; if (!S.nside) flushPage(); renderSide(); }
function renderSide() {
  const box = $("#nside"), on = S.nside && S.view === "tree" && S.tree;
  document.body.dataset.nside = on ? "1" : "";
  if (!on) { if (!box.hidden) { flushPage(); if (S.view !== "notes") { S.ed?.destroy(); S.ed = null; } box.hidden = true; box.replaceChildren(); S.sideFor = null; } return; }
  if (!pageOf(S.npage) || isFolder(pageOf(S.npage))) S.npage = S.pages.filter((x) => !isFolder(x)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id || null;
  const sig = S.npage + "/" + S.pages.length;
  if (S.sideFor === sig && !box.hidden) return;
  flushPage(); S.ed?.destroy(); S.ed = null;
  S.sideFor = sig; box.hidden = false;
  const p = pageOf(S.npage), opts = [];
  const walk = (id, d) => { for (const q of kidPages(id)) { opts.push(el("option", { value: q.id, text: " ".repeat(d) + (q.title || (isFolder(q) ? "New folder" : "Untitled")), disabled: isFolder(q), selected: q.id === S.npage })); walk(q.id, d + 1); } };
  walk(null, 0);
  put(box, el("div", { class: "ph" }, opts.length ? el("select", { id: "sidePage", "aria-label": "Page", onchange: (e) => pickPage(e.target.value) }, opts) : el("h2", { text: "Notes" }),
    ib("sideNew", "New page", ICON.plus, () => newPage()),
    p ? ib("sideMore", "Page menu", ICON.more, (e) => pageMenu(p, e.currentTarget)) : null,
    ib("sideClose", "Close (O)", ICON.close, toggleSide)),
    p ? pageView(p, true) : el("div", { class: "page none" }, el("button", { class: "btn", id: "sideFirst", onclick: () => newPage() }, "New page")));
}
// Garden, Knowledge and Notes are three windows; Shift+Tab goes round them.
const winOf = (v) => (v === "isles" || v === "garden" ? "garden" : v === "notes" ? "notes" : "knowledge");
function goWindow(w) {
  if (S.review || S.pick) return;
  const now = winOf(S.view); if (w === now) return;
  if (now === "knowledge") S.lastKnowledge = location.hash || "#/forest";
  location.hash = w === "garden" ? "#/" : w === "notes" ? S.lastNotes || notesHash() : S.lastKnowledge || "#/forest";
}
function winSwitch() {
  const now = winOf(S.view), due = dueList(null).length;
  const b = (w, id, label, d, extra) => el("button", { class: "ws" + (now === w ? " on" : ""), id, type: "button", title: `${label} (Shift+Tab)`, "aria-pressed": String(now === w), onclick: () => goWindow(w) }, icon(d), el("span", { class: "wl", text: label }), extra);
  return el("div", { class: "winseg", role: "group", "aria-label": "Window" },
    b("garden", "winGarden", "Garden", ICON.sprout, now !== "garden" && due ? el("span", { class: "thirst", text: String(due) }) : null),
    b("knowledge", "winKnowledge", "Knowledge", ICON.graph),
    b("notes", "winNotes", "Notes", ICON.page));
}

// ---------- start ----------
async function init() {
  T = theme();
  try { stage = new Stage($("#stage")); }
  catch { $("#empty").hidden = false; put($("#empty"), el("p", { text: "3D is turned off in this browser." })); return; }
  stage.setTheme(T);
  stage.isPaused = () => overlayOpen() || !!S.review || S.view === "tech";
  stage.onTap = onTap; stage.labelOpacity = labelOpacity;
  stage.labelRank = (L) => (L.id === S.sel ? 0 : S.near.has(L.id) ? 1 + L.depth * 0.01 : 2 + L.depth);
  stage.onHover = (hit, e) => {
    stage.container.style.cursor = hit && !(S.view === "forest" && hit.kind === "link") ? "pointer" : "";
    if (hit?.kind === "node" && ideaView()) showHover(hit.id, e.clientX, e.clientY); else hideHover();
  };
  stage.container.addEventListener("pointerdown", hideHover);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { T = theme(); stage.setTheme(T); selMesh?.material.color.set(T.ink); rebuild(); });
  window.addEventListener("hashchange", go);
  window.addEventListener("keydown", (e) => { if (e.key === "Tab" && e.shiftKey && document.activeElement === document.body) e.preventDefault(); onKey(e); });
  $("#importFile").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importBackup(f); });
  store.requestPersistence();
  S.aiOn = !!(await store.getMeta("ai").catch(() => false));
  if (S.aiOn) ai.loadCache().catch(() => {});
  if (CHANNEL) {   // the beta starts with demo islands to test against
    document.body.dataset.channel = CHANNEL;
    const c = await store.counts().catch(() => null);
    if (c && !c.zones && !(await store.getMeta("demo").catch(() => null))) await store.importAll(demoBackup());
  }
  window.bonsai = { S, store, refresh, get stage() { return stage; }, get isles() { return isles; }, get tech() { return tech; } };
  await go();
  document.body.dataset.ready = "1";
}
init();
