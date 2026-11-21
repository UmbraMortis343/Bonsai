// Bonsai: the garden, the knowledge graphs in 3D, the tech tree, notes, and everything you do in them.
import * as store from "./store.js";
import * as srs from "./srs.js";
import { Stage, THREE } from "./stage.js";
import { Flora, grid, ground } from "./flora.js";
import { layoutTree, layoutRings, layoutTiers } from "./layout.js";
import { md } from "./md.js";
import * as ai from "./ai.js";
import { textFor, hashText } from "./semantic.js";
import { $, el, put, toast, dialog, menu, overlayOpen, closeTop, closeAll } from "./dom.js";
import { createIsles, QUALITY } from "./isles.js";
import { readMap, missing, mergeMap, ISLE_MAX } from "./gardenmap.js";
import { createTechTree, HUES, shade } from "./techtree.js";
import { CHANNEL } from "./channel.js";
import { demoBackup } from "./demo.js";
import { growPrompt, readGrow, planGrow, growSummary } from "./notes.js";
import { createEditor, textToBlocks, blocksToText } from "./blocks.js";
import { datePicker, longDate, relDate } from "./datepick.js";
import { createMiniWeb } from "./miniweb.js";
import { MARK_LIST, assignMarks } from "./marks.js";
import { readExam, planExam, LEVELS } from "./exams.js";
import { createVocab, createQuick, fleshPrompt, readFlesh } from "./vocab.js";
import { desktop, canSee, liveStatus, liveProblem, askClaude, desktopUpdate } from "./live.js";
import { oralOpen, oralPrompt, readOral, oralMarkPrompt, readMarks } from "./paper.js";
import { weekOf, sundayOpen, sundayPrompt, readTurn, stitchPrompt, readStitch, tally, isSunday, dayOf, SUNDAY_MAX } from "./sunday.js";
import * as sync from "./sync.js";
import { KINDS, KIND_NAME, REBUILD_Q, questionFor, usableQs, pickHide, questionsPrompt, readQuestions, dayNumber } from "./questions.js";
import { createInk } from "./ink.js";
import * as focus from "./focus.js";
import { createHistory } from "./history.js";

const PALETTE = [["Blue", "#3b82f6"], ["Violet", "#8b5cf6"], ["Pink", "#ec4899"], ["Red", "#ef4444"], ["Orange", "#f97316"], ["Amber", "#f59e0b"], ["Green", "#22c55e"], ["Teal", "#14b8a6"], ["Cyan", "#06b6d4"]];
const SWATCHES = [["Auto", ""], ...PALETTE];
const DAY = 86400000;
const ICON = {
  pin: "M9 3h6l-1 7 3 3H7l3-3zM12 13v8", swap: "M4 8h13l-3-3M20 16H7l3 3", ink: "M6 3h9l4 4v14H6zM9 16c1.5-3 3-1 4-2.5s1-2.5 2-2.5", sideOff: "M4 4h16v16H4zM9 4v16M15 9l-3 3 3 3", sideOn: "M4 4h16v16H4zM9 4v16M12 9l3 3-3 3",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11",
  back: "M15 5l-7 7 7 7", fold: "M6 9l6 6 6-6", unfold: "M6 15l6-6 6 6", close: "M6 6l12 12M18 6L6 18", plus: "M12 5v14M5 12h14", more: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4", panel: "M4 5h16v14H4zM15 5v14", side: "M4 5h16v14H4zM9 5v14", drop: "M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z", page: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5", folder: "M3 6h6l2 2h10v11H3z", graph: "M7 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM21 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM6.3 7.6l4.7 8.6M17.6 9.6l-4.6 6.8M7 6.2l10 1.6", sprout: "M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z", inbox: "M4 13l3-8h10l3 8v6H4zM4 13h5a3 3 0 0 0 6 0h5", play: "M8 5l11 7-11 7z", video: "M3 7h12v10H3zM15 11l6-3v8l-6-3", pause: "M8 5v14M16 5v14",
};
const icon = (d) => el("span", { class: "ic", html: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>` });
const ib = (id, label, d, onclick) => el("button", { class: "ib", id, title: label, "aria-label": label, onclick }, icon(d));
const shell = window.bonsaiShell || { version: "dev", check: async () => "latest", canInstall: () => false, install() {} };

const S = {
  view: "", zones: [], trees: [], nodes: [], links: [], inbox: [], patches: [], pages: [], allZones: [], allTrees: [], nzone: null, npage: null, nside: false,
  byId: new Map(), kids: new Map(), byTree: new Map(), near: new Set(), lastChild: new Map(),
  tree: null, sel: null, panel: null, pick: null, quick: null, review: null, cutoff: null, editBody: false, sun: null, sundays: [],
  flora: null, lay: null, forest: null, fsel: null, pendingSel: null, hues: new Map(), isleHues: new Map(), linksIn: new Map(), num: new Map(), byNum: [], jump: "", move: false, joined: false,
  scope: null, mean: null, suggest: null, aiOn: false,
  garden: null, model: [], hubs: [], hub: -1, isle: -1, topic: -1, treeBack: "#/", meanBack: "#/", techBack: "#/", hashNow: null, water: undefined,
};
const ideaView = () => S.view === "tree" || S.view === "meaning";
let stage, isles, tech, T, labelEls = new Map(), decor = [], selMesh;

// Scene colours come from the stylesheet, so light and dark stay in step.
function theme() {
  const css = getComputedStyle(document.body), v = (k) => css.getPropertyValue(k).trim();   // the body, so the night colours count
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
  const [zones, trees, nodes, links, inbox, patches, pages, sundays] = await Promise.all([store.allZones(), store.allTrees(), store.allNodes(), store.allLinks(), store.listInbox(), store.listPatches(), store.listPages(), store.listSundays().catch(() => [])]);
  S.allZones = zones; S.allTrees = trees; S.nodes = nodes; S.links = links; S.inbox = inbox; S.patches = patches; S.sundays = sundays;
  S.pages = pages.map((p) => { const kind = p.kind || "page"; return { ...p, kind, parentId: p.parentId || null, props: kind === "page" ? withStd(p.props) : p.props || [], blocks: p.blocks || textToBlocks(p.text || "") }; });   // early beta pages were plain text in a topic
  S.vocab = (await store.getMeta("vocab").catch(() => null)) || []; vocab?.reindex();
  S.zones = zones.filter((z) => !z.archived).sort(byOrder);
  const ok = new Set(S.zones.map((z) => z.id));
  S.trees = trees.filter((t) => !t.archived && ok.has(t.zoneId)).sort(byOrder);
  S.byId = new Map(nodes.map((n) => [n.id, n])); S.kids = new Map(); S.byTree = new Map();
  for (const n of nodes) {
    if (!S.byTree.has(n.treeId)) S.byTree.set(n.treeId, []); S.byTree.get(n.treeId).push(n);
    if (n.parentId != null) { if (!S.kids.has(n.parentId)) S.kids.set(n.parentId, []); S.kids.get(n.parentId).push(n); }
  }
  for (const l of S.kids.values()) l.sort(byOrder);
  S.linksIn = new Map();
  for (const l of links) { const t = S.byId.get(l.fromId)?.treeId; if (t && t === S.byId.get(l.toId)?.treeId) { if (!S.linksIn.has(t)) S.linksIn.set(t, []); S.linksIn.get(t).push({ a: l.fromId, b: l.toId }); } }
  await loadGarden(); readLevels();
  // a topic's colour is the tech tree's: its island's, turned a little for each topic on it
  S.hues = new Map(); S.isleHues = new Map();
  S.garden.islands.forEach((q, i) => { const hue = HUES[i % HUES.length]; S.isleHues.set(q.id, hue); q.zoneIds.forEach((id, k) => S.hues.set(id, shade(hue, k))); });
}
const tint = (hex, k) => (/^#[0-9a-f]{6}$/i.test(hex) ? shade(hex, k) : hex);
// A graph's shape, worked out once and kept until its ideas or the links between them change.
const layCache = new Map();
// A graph built on the Library's board is drawn in 3D from where its ideas sit there (node.xy): the board's plane
// becomes the ground, and each step out from the first idea a little higher. Ideas with no place yet fan out as before.
const XY = 0.025;   // board units to 3D: an idea's 70-unit string on the board is a 1.75 stick
function xyPins(nodes, rootId) {
  const r = nodes.find((n) => n.id === rootId); if (!r?.xy || !nodes.some((n) => n !== r && n.xy)) return nodes;
  const by = new Map(nodes.map((n) => [n.id, n])), depth = (n) => { let d = 0; for (let p = n; p && p.parentId != null && d < 64; p = by.get(p.parentId)) d++; return d; };
  const stem = 1.3 + 0.36 * Math.log2(nodes.length + 1);
  return nodes.map((n) => (n === r || !n.xy ? n : { ...n, pin: [(n.xy[0] - r.xy[0]) * XY, stem + 0.42 * depth(n), (n.xy[1] - r.xy[1]) * XY] }));
}
function layOf(tree) {
  const nodes = S.byTree.get(tree.id) || [], links = S.linksIn.get(tree.id) || [];
  const sig = tree.rootId + "|" + nodes.map((n) => n.id + ":" + n.parentId + ":" + n.order + (n.pin ? "@" + n.pin : "") + (n.xy ? "#" + n.xy : "")).join() + "|" + links.map((l) => l.a + ">" + l.b).join();
  const hit = layCache.get(tree.id); if (hit?.sig === sig) return hit.lay;
  const lay = layoutTree(xyPins(nodes, tree.rootId), tree.rootId, links); layCache.set(tree.id, { sig, lay });
  return lay;
}
const discR = (lay) => Math.min(3.2, Math.max(1, lay.footprint * 0.5));
// Ideas are numbered outward from the graph's start, so any of them can be reached by typing its number.
function numberGraph(tree) {
  S.num = new Map(); S.byNum = [];
  const q = [S.byId.get(tree.rootId)];
  for (let i = 0; i < q.length; i++) { const n = q[i]; if (!n) continue; S.byNum.push(n.id); S.num.set(n.id, S.byNum.length); for (const c of kidsOf(n.id)) q.push(c); }
}
const numTag = (id) => (S.view === "tree" && S.num.has(id) ? el("i", { class: "num", text: String(S.num.get(id)) }) : null);
const ghostly = (n) => n.ghost && !S.oral?.lit?.has(n.id);   // a greyed idea, unless the oral running has heard it
// What a watering round takes: Focus first, then Keep, oldest first in each; Settled ideas are left out (focus levels).
function dueList(treeId) {
  const live = new Set(S.trees.map((t) => t.id)), now = Date.now(), at = new Map();
  for (const n of S.nodes) {
    if (!(treeId ? n.treeId === treeId : live.has(n.treeId))) continue;
    const lv = levelOfNode(n); if (lv === "settled" || !srs.reviewable(n, kidsOf(n.id).length)) continue;
    const due = Date.parse(srs.dueAt(n, focus.multOf(lv))); if (due <= now) at.set(n, [RANK[lv], due]);
  }
  return [...at.keys()].sort((a, b) => at.get(a)[0] - at.get(b)[0] || at.get(a)[1] - at.get(b)[1]);
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
// thirsty: due for review. dry: due more than a day ago (three on a Keep topic). A Settled topic never thirsts.
function thirst(n, now = Date.now()) {
  const lv = levelOfNode(n);
  if (lv === "settled" || !srs.reviewable(n, kidsOf(n.id).length)) return "ok";
  const due = Date.parse(srs.dueAt(n, focus.multOf(lv)));
  return due + focus.dryAfter(lv) * DAY <= now ? "dry" : due <= now ? "thirsty" : "ok";
}
function looksFor(tree, nodes, garden) {
  const m = new Map(), now = Date.now(), memo = new Map(), hue = tree.color || S.hues.get(tree.zoneId) || T.root;
  // Watering: the topic's colour while an idea is kept, ochre once it needs water, grey when it has dried out.
  if (garden) {
    for (const n of nodes) { const t = thirst(n, now); m.set(n.id, { color: ghostly(n) ? T.ring : t === "dry" ? T.limb : t === "thirsty" ? T.link : hue, status: "ok" }); }
    return m;
  }
  // An idea takes its own colour, else the colour of the idea above it. With none set, a graph is its topic's
  // colour (the tech tree's), turned a little for each idea hanging off the start so they can be told apart.
  const main = kidsOf(tree.rootId);
  const colorOf = (n) => {
    if (!n || n.id === tree.rootId) return n?.color || hue;
    if (n.color) return n.color;
    if (!memo.has(n.id)) {
      const parent = S.byId.get(n.parentId);
      memo.set(n.id, parent && parent.id === tree.rootId && !parent.color ? tint(hue, Math.max(0, main.indexOf(n))) : colorOf(parent));
    }
    return memo.get(n.id);
  };
  // beta: H marks what needs water in ochre in the knowledge views, so we can judge it against the watering screen
  const dryOn = S.thirsty;
  for (const n of nodes) m.set(n.id, { color: ghostly(n) ? T.ring : dryOn && thirst(n, now) !== "ok" ? T.link : colorOf(n), status: "ok" });
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
const linkLabel = (l, pos) => ({ el: el("div", { class: "lbl link", dataset: { kind: "link", id: l.id }, text: l.label }), pos, kind: "link", id: l.id, depth: 8, tidy: true, dy: 10, anchor: "translate(-50%,-50%)" });   // a link's label gives way to every idea's name

function buildTree(animate) {
  const tree = S.tree, lay = (S.lay = layOf(tree)); numberGraph(tree);
  const nodes = shownNodes(tree), ids = new Set(nodes.map((n) => n.id)), hue = tree.color || S.hues.get(tree.zoneId) || T.limb;
  const links = S.links.filter((l) => ids.has(l.fromId) && ids.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId, label: l.label }));
  const oldPos = animate && S.flora ? new Map([...S.flora.pos].map(([k, v]) => [k, v.clone()])) : null;
  clearScene();
  const flora = (S.flora = new Flora([{ tree, nodes, layout: lay, offset: [0, 0], looks: looksFor(tree, nodes) }], links, T));
  stage.world.add(flora.group); stage.pickables = [flora.nodeMesh];
  for (const m of ground({ glows: [{ x: 0, z: 0, r: Math.max(7, lay.footprint * 1.8), color: hue, k: 0.11 }], discs: [{ x: 0, z: 0, r: discR(lay), color: hue }] }, T.sky)) addDecor(m);
  const labels = nodes.map((n) => {
    const e = el("div", { class: "lbl node" + (n.id === tree.rootId ? " trunk" : "") + (ghostly(n) ? " ghost" : ""), dataset: { kind: "node", id: n.id, n: S.num.get(n.id) }, text: n.title });
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
    if (S.flora !== flora || flora.held) { stage.tickers.delete(step); return false; }
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
// The knowledge view can show just a hub, an island or a topic (#/forest/<id>), opened from the garden with G.
function scopeOf(id) {
  if (!id || !S.garden) return null;
  const z = S.zones.find((x) => x.id === id); if (z) return { id, kind: "topic", name: z.name, zones: new Set([id]) };
  const isl = S.garden.islands.find((q) => q.id === id); if (isl) return { id, kind: "isle", name: isl.name, zones: new Set(isl.zoneIds) };
  const hub = (S.garden.hubs || []).find((h) => h.id === id); if (hub) return { id, kind: "hub", name: hub.name, zones: new Set(S.garden.islands.filter((q) => hubKey(q) === id).flatMap((q) => q.zoneIds)) };
  return null;
}
const openScope = (id) => { location.hash = "#/forest" + (id ? "/" + encodeURIComponent(id) : ""); };
// Every graph in view stands on its disc, set out in rings: a topic's graphs round its name, an island's topics
// round its name, a hub's islands round its name. Watering is the same picture, coloured by what needs water.
function buildForest(garden = S.view === "garden") {
  if (!garden && S.joined) return buildJoined();
  clearScene();
  const cut = garden ? null : S.cutoff, born = (x) => cut == null || Date.parse(x.createdAt) <= cut;
  const sc = garden ? null : S.fscope, g = S.garden, zoneBy = new Map(S.zones.map((z) => [z.id, z])), lays = new Map();
  const far = !sc || sc.kind === "hub";   // looking at more than one island: topics a map named but nobody has filled stay out
  const topic = (z) => { const trees = S.trees.filter((t) => t.zoneId === z.id && (born(t) || shownNodes(t).length > 1)); for (const t of trees) lays.set(t.id, layOf(t)); return { id: z.id, kind: "topic", z, trees, kids: trees.map((t) => ({ id: t.id, kind: "graph", r: lays.get(t.id).footprint })) }; };
  const isle = (q) => ({ id: "isle:" + q.id, kind: "isle", q, kids: q.zoneIds.map((id) => zoneBy.get(id)).filter((z) => z && born(z) && (!sc || sc.zones.has(z.id))).map(topic).filter((t) => t.kids.length || !(far && charted())) });
  const hub = (h) => ({ id: "hub:" + h.id, kind: "hub", h, kids: g.islands.filter((q) => hubKey(q) === h.id).map(isle).filter((q) => q.kids.length) });
  let top;
  if (sc?.kind === "topic") top = topic(zoneBy.get(sc.id));
  else if (sc?.kind === "isle") top = isle(g.islands.find((q) => q.id === sc.id));
  else if (sc?.kind === "hub") top = hub(hubsOf(g).find((h) => h.id === sc.id));
  else { const hs = hubsOf(g).map(hub).filter((h) => h.kids.length); top = hs.length === 1 ? hs[0] : { id: "all", kind: "all", kids: hs }; }
  const R = layoutRings(top), at = R.at, fl = { zones: new Map(), trees: new Map(), isles: new Map(), radius: R.radius, center: R.center };
  S.forest = { fl, lays, rings: new Map() };
  const items = [], shown = new Set(), labels = [], glows = [], discs = [], spokes = [];
  const spoke = (a, b, from, to, color) => { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d > from + to + 0.3) spokes.push({ x0: a.x + (dx / d) * from, z0: a.z + (dz / d) * from, x1: b.x - (dx / d) * to, z1: b.z - (dz / d) * to, color }); };
  // names lie on the ground at the middle of their ring; where rings share a middle (an island with one topic) they stack
  const name = (kind, id, text, p, depth, style, lift = 0, more = null) => labels.push({ el: el("div", { class: "lbl " + kind, dataset: { kind, id }, style }, text, more), pos: new THREE.Vector3(p.x, 0.05, p.z), kind, id, depth, tidy: true, dy: 10 - lift * 22, anchor: `translate(-50%,${-50 - lift * 120}%)` });
  const walk = (t) => {
    const p = at.get(t.id);
    if (t.kind === "topic") {
      const hue = S.hues.get(t.id) || T.limb; fl.zones.set(t.id, p);
      glows.push({ x: p.x, z: p.z, r: p.r * 1.05, color: hue, k: 0.13 });
      const waiting = garden ? t.trees.reduce((a, tr) => a + shownNodes(tr).filter((n) => thirst(n) !== "ok").length, 0) : 0;   // seen from far off, where the graphs' own names have faded
      name("zone", t.id, t.z.name, p, -0.5, "", 0, waiting ? el("span", { class: "thirst", text: String(waiting) }) : null);
      for (const tr of t.trees) {
        const q = at.get(tr.id), lay = lays.get(tr.id), nodes = shownNodes(tr), r = discR(lay); fl.trees.set(tr.id, q);
        for (const n of nodes) shown.add(n.id);
        items.push({ tree: tr, nodes, layout: lay, offset: [q.x, q.z], looks: looksFor(tr, nodes, garden) });
        const dry = garden ? nodes.filter((n) => thirst(n) !== "ok").length : 0;
        // a graph's disc: an ochre rim while anything on it needs water, and a ring inside for reviews passed
        const rings = garden ? Math.min(4, Math.floor(Math.sqrt(passesOf(tr.id)))) : 0; S.forest.rings.set(tr.id, rings);
        discs.push({ x: q.x, z: q.z, r, color: tr.color || hue, rim: dry ? T.link : null, rings });
        spoke(p, q, 1.5, r, hue);
        const e = el("div", { class: "lbl tree", dataset: { kind: "tree", id: tr.id } }, tr.name, dry ? el("span", { class: "thirst", text: String(dry) }) : null); labelEls.set(tr.id, e);
        // a graph's name floats over it; where that would run into another name it drops to the far side of its disc from the topic's name
        const out = Math.hypot(q.x - p.x, q.z - p.z) || 1, ax = q.x + ((q.x - p.x) / out) * r, az = q.z + ((q.z - p.z) / out) * r;
        labels.push({ el: e, pos: new THREE.Vector3(q.x, lay.height + 0.75, q.z), kind: "tree", id: tr.id, depth: 1, tidy: true, alt: { pos: new THREE.Vector3(ax, 0.05, az), anchor: "translate(-50%,2px)", dy: 22 } });
      }
      return 1;
    }
    const text = t.kind === "isle" ? t.q.name : t.kind === "hub" ? t.h.name : "", id = t.kind === "isle" ? t.q.id : t.kind === "hub" ? t.h.id : "";
    if (t.kind === "isle") fl.isles.set(id, p);
    let under = 0;
    for (const k of t.kids) { const n = walk(k); if (p.ring) spoke(p, at.get(k.id), t.kind === "isle" ? 2 : 2.6, t.kind === "isle" ? 1.5 : 2.2, t.kind === "isle" ? S.isleHues.get(id) || T.limb : T.limb); else under = n; }
    if (text) name(t.kind, id, text, p, t.kind === "hub" ? -2 : -1.5, "", under);
    return text ? under + 1 : under;
  };
  walk(top);
  for (const m of ground({ glows, discs, spokes }, T.sky)) addDecor(m);
  const links = garden ? [] : S.links.filter((l) => shown.has(l.fromId) && shown.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId, label: l.label }));
  const flora = (S.flora = new Flora(items, links, T));
  stage.world.add(flora.group); stage.pickables = [flora.nodeMesh];
  stage.setLabels(labels); markSel();
}
// ---------- joined: everything in view read as one structure ----------
// A view only: nothing is saved and the graphs stay as they are. What's in scope is strung together the way the
// tech tree joins it. An island leads to its topics, a topic to the ideas its graphs start from, and an island
// that grows from another (`after`) hangs from the idea it grows from (`from`), or from that island itself when
// no idea was named, and so on down. Made-up ideas stand in for the start, hubs, islands and topics: their ids
// are "s:", "h:<hub>", "i:<island>", "t:<topic>". Each island with all that is on it is one part; parts are set
// out in tiers (layoutTiers), each laid out in itself like any graph, so its inner links are straight bonds.
function joinedParts(sc) {
  const g = S.garden, zoneBy = new Map(S.zones.map((z) => [z.id, z])), parts = [], have = new Map(), hue = new Map(), kind = new Map(), done = new Set();
  let order = 0;
  const part = (id, parent, hang, colour) => { const p = { id, parent, hang, hue: colour, ideas: [], root: null }; parts.push(p); return p; };
  const made = (p, id, parentId, title, k, colour) => { p.ideas.push({ id, parentId, title, order: order++, createdAt: "", made: k }); if (parentId == null) p.root = id; have.set(id, p.id); kind.set(id, k); hue.set(id, colour); };
  const grown = new Map(); for (const q of g.islands) if (q.after) { if (!grown.has(q.after)) grown.set(q.after, []); grown.get(q.after).push(q); }
  const topic = (p, z, parentId) => {
    if (done.has(z.id)) return; done.add(z.id);
    const tid = "t:" + z.id; made(p, tid, parentId, z.name, "topic", S.hues.get(z.id) || T.limb);
    for (const tr of S.trees.filter((t) => t.zoneId === z.id)) {
      const nodes = shownNodes(tr), looks = looksFor(tr, nodes);
      for (const n of nodes) { p.ideas.push(n.parentId == null ? { ...n, parentId: tid, order: order++, pin: null } : { ...n, pin: null }); have.set(n.id, p.id); kind.set(n.id, n.parentId == null ? "start" : "idea"); hue.set(n.id, looks.get(n.id).color); }
    }
  };
  const isle = (q, parent, hang) => {
    if (done.has(q.id)) return; done.add(q.id);
    const p = part("i:" + q.id, parent, hang, S.isleHues.get(q.id) || T.limb);
    made(p, "i:" + q.id, null, q.name, "isle", p.hue);
    for (const z of q.zoneIds.map((id) => zoneBy.get(id))) if (z && (!charted() || S.trees.some((t) => t.zoneId === z.id))) topic(p, z, "i:" + q.id);
    grow(q.id, p.id);
  };
  // an island that grows from this one hangs from the idea named for it, if that idea is in view
  const grow = (id, pid, strict) => { for (const c of grown.get(id) || []) { if (c.from && have.has(c.from)) isle(c, have.get(c.from), c.from); else if (!strict) isle(c, pid, pid); } };
  if (sc?.kind === "topic") {
    const z = zoneBy.get(sc.id), home = g.islands.find((q) => q.zoneIds.includes(sc.id)), p = part("t:" + z.id, null, null, S.hues.get(z.id) || T.limb);
    topic(p, z, null); if (home) { done.add(home.id); grow(home.id, p.id, true); }
  } else if (sc?.kind === "isle") isle(g.islands.find((q) => q.id === sc.id), null, null);
  else {
    // a hub, or everything: what grows from nothing in view hangs from the top
    const hub = sc?.kind === "hub" ? hubsOf(g).find((h) => h.id === sc.id) : null, mine = hub ? g.islands.filter((q) => hubKey(q) === hub.id) : g.islands, ids = new Set(mine.map((q) => q.id));
    const first = mine.filter((q) => !q.after || !ids.has(q.after));
    if (first.length === 1 && !hub) isle(first[0], null, null);   // one start: it is the top itself
    else {
      const top = hub ? "h:" + hub.id : "s:", p = part(top, null, null, T.root); made(p, top, null, hub ? hub.name || "Garden" : "Start", hub ? "hub" : "start0", T.root);
      for (const q of first) isle(q, top, top);
      for (const q of mine) isle(q, top, top);   // any left over by a loop in what grows from what
    }
  }
  return { parts: parts.filter((p) => p.root), hue, kind, have };
}
function buildJoined() {
  clearScene();
  const J = joinedParts(S.fscope), where = J.have;
  const links = S.links.filter((l) => where.has(l.fromId) && where.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId, label: l.label }));
  // worked out again only when what's joined changes
  const sig = J.parts.map((p) => p.id + "<" + p.hang + ":" + p.ideas.map((n) => n.id + ">" + n.parentId).join()).join("|") + "|" + links.map((l) => l.a + ">" + l.b).join();
  if (joinedLay?.sig !== sig) {
    const lays = new Map(J.parts.map((p) => [p.id, layoutTree(p.ideas, p.root, links.filter((l) => where.get(l.a) === p.id && where.get(l.b) === p.id))]));
    const tiers = layoutTiers(J.parts.map((p) => { const at = p.parent && lays.get(p.parent).pos.get(p.hang); return { id: p.id, parent: p.parent, r: lays.get(p.id).footprint, fromAt: at ? [at[0], at[2]] : null }; }));
    // each part turned to face the way its offshoots grow
    for (const p of J.parts) { const t = tiers.get(p.id), L = lays.get(p.id), c = Math.cos(t.rot), sn = Math.sin(t.rot); lays.set(p.id, { ...L, pos: new Map([...L.pos].map(([id, q]) => [id, [q[0] * c - q[2] * sn, q[1], q[0] * sn + q[2] * c]])) }); }
    joinedLay = { sig, lays, tiers, tight: [...lays.values()].reduce((a, L) => a + L.tight, 0) };
  }
  const { lays, tiers } = joinedLay;
  const items = J.parts.map((p) => { const t = tiers.get(p.id); return { tree: { id: p.id, rootId: p.root }, nodes: p.ideas, layout: lays.get(p.id), offset: [t.x, t.z], lift: t.lift, looks: new Map(p.ideas.map((n) => [n.id, { color: J.hue.get(n.id), status: "ok" }])) }; });
  const flora = (S.flora = new Flora(items, links, T, J.parts.filter((p) => p.hang).map((p) => ({ from: p.hang, to: p.root, color: p.hue }))));
  stage.world.add(flora.group); stage.pickables = [flora.nodeMesh];
  // on the ground, a glow under each part and a disc under the first
  const glows = J.parts.map((p) => { const t = tiers.get(p.id); return { x: t.x, z: t.z, r: lays.get(p.id).footprint * 1.15, color: p.hue, k: 0.12 }; }), t0 = tiers.get(J.parts[0].id);
  for (const m of ground({ glows, discs: [{ x: t0.x, z: t0.z, r: discR(lays.get(J.parts[0].id)), color: J.parts[0].hue }] }, T.sky)) addDecor(m);
  // names: islands and hubs always, topics from further off than the ideas graphs start from, the rest from close in
  const CLS = { start0: "hub", hub: "hub", isle: "isle", topic: "zone", start: "tree", idea: "node" }, DEPTH = { start0: -2, hub: -2, isle: -0.95, topic: -0.5, start: 1, idea: 3 };   // an island's name gives way only to the top's; a topic's to an island's; and so on down
  const labels = J.parts.flatMap((p) => p.ideas.map((n) => { const k = J.kind.get(n.id); return { el: el("div", { class: "lbl " + CLS[k], dataset: { kind: "node", id: n.id }, text: n.title }), pos: flora.pos.get(n.id), kind: "node", as: CLS[k], id: n.id, depth: DEPTH[k] + (k === "idea" ? lays.get(p.id).depth.get(n.id) * 0.01 : 0), r: flora.radii.get(n.id), tidy: true }; }));
  // the frame: the ball round everything
  const box = new THREE.Box3(); for (const v of flora.home.values()) box.expandByPoint(v); box.expandByPoint(new THREE.Vector3(t0.x, 0, t0.z));
  const mid = box.getCenter(new THREE.Vector3()), far = Math.max(4, ...[...flora.home.values()].map((v) => v.distanceTo(mid))) + 1;
  S.forest = { fl: { zones: new Map(), trees: new Map(), isles: new Map(), radius: far, center: { x: mid.x, z: mid.z } }, lays: new Map(), rings: new Map(), joined: { ...J, tiers, tight: joinedLay.tight },
    view: { target: mid, radius: Math.min(590, stage.fitDistance(far) * 0.84), phi: 0.95 } };
  stage.setLabels(labels); markSel();
}
let joinedLay = null;
// A tap in the joined view: an idea opens in its own graph; a topic's, island's or hub's stand-in narrows the view to it.
function joinedTap(id) {
  const n = S.byId.get(id);
  if (n) { S.pendingSel = id; return openTree(n.treeId); }
  const m = /^([hit]):(.*)$/.exec(id); if (m && m[2] !== S.fscope?.id) openScope(m[2]);
}
// The Knowledge window's three looks over what's in scope: Separate, Joined and Meaning.
function setLook(look) {
  if (look === "meaning") { if (S.view !== "meaning") goMeaning(S.fscope?.id); return; }
  if (S.view === "meaning") { S.joined = look === "joined"; setPref("joined", S.joined ? "1" : "0"); return openScope(S.fscope?.id); }
  toggleJoined(look === "joined");
}
function lookSeg() {
  const b = (id, text, k, look, on) => el("button", { class: "btn" + (on ? " on" : ""), id, "aria-pressed": String(on), onclick: () => setLook(look) }, text, el("kbd", { text: k }));
  const m = S.view === "meaning";
  return el("div", { class: "seg keys", role: "group", "aria-label": "View" }, b("viewApart", "Separate", "V", "apart", !m && !S.joined), b("viewJoined", "Joined", "V", "joined", !m && S.joined), b("viewMeaning", "Meaning", "M", "meaning", m));
}
function toggleJoined(on = !S.joined) {
  if (S.view !== "forest" || on === S.joined) return;
  S.joined = on; setPref("joined", on ? "1" : "0"); S.fsel = null;
  buildForest(); stage.flyTo(forestView(), 500); renderChrome();
}

const rebuild = () => (S.view === "tree" ? buildTree(false) : S.view === "meaning" ? S.mean && buildMeaning() : buildForest());

// ---------- meaning view ----------
// Ideas placed by what they mean (an on-device model), for one zone or for
// everything. Colour marks the tree (in a zone) or the zone (everything).
const inScope = (zoneId) => !S.fscope || S.fscope.zones.has(zoneId);
const scopeNodes = () => { const ok = new Set(S.trees.filter((t) => inScope(t.zoneId)).map((t) => t.id)); return S.nodes.filter((n) => ok.has(n.treeId)); };
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
  S.view = "meaning"; S.fscope = scopeOf(scope);   // the same scopes as the Knowledge window: a hub, an island, a topic or everything
  S.scope = S.fscope?.kind === "topic" ? S.fscope.id : null;
  S.tree = null; S.lay = null; S.sel = null; S.panel = null; S.mean = null; S.suggest = null;
  document.body.dataset.meaning = "";
  clearScene(); stage.setLabels([]); addDecor(grid(60, T.grid)); placeSel(); renderChrome();
  if (!(await aiAllowed())) { if (run === meanRun) location.hash = S.meanBack; return; }
  const nodes = scopeNodes(), ids = nodes.map((n) => n.id), items = aiItems(nodes);
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
  const M = S.mean, trees = S.trees.filter((t) => inScope(t.zoneId));
  const groups = S.scope ? trees.map((t) => ({ id: t.id, name: t.name, color: t.color, trees: [t] }))
    : S.zones.filter((z) => inScope(z.id)).map((z) => ({ id: z.id, name: z.name, color: z.color, trees: trees.filter((t) => t.zoneId === z.id) }));
  const items = [], heads = [], shown = new Set(), depth = new Map(), all = [];
  groups.forEach((g, gi) => {
    const color = g.color || PALETTE[gi % PALETTE.length][1], sum = [0, 0, 0]; let k = 0, top = 0;
    for (const t of g.trees) {
      const every = S.byTree.get(t.id) || [], nodes = every.filter((n) => M.pos.has(n.id)); if (!nodes.length) continue;
      const real = layOf(t);
      items.push({ tree: t, nodes, layout: { pos: M.pos, size: real.size, rootId: null }, offset: [0, 0], looks: new Map(nodes.map((n) => [n.id, { color, status: "ok" }])), passes: 0 });
      for (const n of nodes) { const p = M.pos.get(n.id); shown.add(n.id); depth.set(n.id, real.depth.get(n.id) || 0); all.push(p); sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; k++; top = Math.max(top, p[1]); }
    }
    if (k) heads.push({ el: el("div", { class: "lbl tree group", dataset: { kind: "group", id: g.id }, text: g.name }), pos: new THREE.Vector3(sum[0] / k, top + 0.9, sum[2] / k), kind: "group", id: g.id });
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
  if (p) { selMesh.position.copy(p); selMesh.scale.setScalar(S.flora.radii.get(S.sel) * 1.1 + 0.025); }
}
function labelOpacity(L, dist) {
  if (S.review && masked(L.id)) return 0;   // a question waits on it
  if (S.view === "meaning") return L.kind === "group" || L.id === S.sel ? 1 : THREE.MathUtils.clamp(2.3 - dist / (stage.radius * 0.85), 0, 1);
  // rings read like a map: islands and hubs always named, topics from closer in, graphs from closer still
  if (L.as) return L.as === "hub" || L.as === "isle" ? 1 : L.as === "zone" ? THREE.MathUtils.clamp((330 - dist) / 60, 0, 1) : L.as === "tree" ? THREE.MathUtils.clamp((130 - dist) / 20, 0, 1) : THREE.MathUtils.clamp((48 - dist) / 10, 0, 1);
  if (S.view !== "tree") return L.kind === "hub" || L.kind === "isle" ? 1 : L.kind === "zone" ? THREE.MathUtils.clamp((520 - dist) / 60, 0, 1) : 1;   // graph names stay at any distance (his call, 0.18.1); they only give way where they'd touch
  if (S.review) return L.id === S.sel && !masked(L.id) ? 1 : 0;
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
  await flushPage(); closeAll(); S.pick?.finish(null); tlClose(true);
  if (!/^#\/notes/.test(location.hash)) { S.ed?.destroy(); S.ed = null; }
  S.quick = null; S.review = null; S.cutoff = null; endJump(); if (S.move) toggleMove(false);
  await load();
  const m = location.hash.match(/^#\/tree\/([^/?]+)/), id = m && decodeURIComponent(m[1]);
  const mm = location.hash.match(/^#\/meaning(?:\/([^/?]+))?/), tm = location.hash.match(/^#\/techtree(?:\/([^/?]+))?/), nm = location.hash.match(/^#\/notes(?:\/([^/?]+))?/);
  meanRun++; setStatus(""); document.body.dataset.meaning = "";
  // remember where a graph or the meaning view was opened from, so Back returns there
  const from = S.hashNow; S.hashNow = location.hash;
  const origin = from == null || /^#\/(tree|meaning)/.test(from) ? null : from || "#/";
  if (origin && mm && S.view !== "meaning") S.meanBack = /^#\/forest/.test(origin) ? (S.fscope ? S.forestBack || "#/" : "#/") : origin;
  if (origin && id && S.view !== "tree") S.treeBack = origin;
  if (from != null && tm && !/^#\/(tree|techtree)/.test(from)) S.techBack = from || "#/";
  const fm = location.hash.match(/^#\/forest(?:\/([^/?]+))?/);
  if (fm) { S.fscope = scopeOf(fm[1] && decodeURIComponent(fm[1])); if (from != null && !/^#\/(tree|forest|meaning)/.test(from)) S.forestBack = from || "#/"; else if (/^#\/meaning/.test(from || "")) S.forestBack = S.meanBack; }
  const home = !mm && !tm && !nm && !location.hash.startsWith("#/garden") && !location.hash.startsWith("#/forest") && !(id && treeOf(id));
  showWindow(home, !!tm, !!nm);
  if (home) { if (id) history.replaceState(null, "", "#/"); showIsles(); }
  else if (nm) showNotes(nm[1] && decodeURIComponent(nm[1]));
  else if (tm) showTech(tm[1] && decodeURIComponent(tm[1]));
  else if (mm) showMeaning(mm[1] && decodeURIComponent(mm[1]));
  else if (location.hash.startsWith("#/garden")) return location.replace("#/forest");   // the watering screen went in 0.28.0
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
  stage.setView({ target: vec(S.lay.center), radius: stage.fitDistance(S.lay.radius) * 0.88, theta: from === "forest" ? stage.theta : 0.6, phi: 1.12 });
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
  stage.setView(at ? { ...at, radius: at.radius * 1.5, phi: 1.05 } : { ...forestView(), theta: stage.theta });
  renderChrome();
  if (S.water !== undefined) { const w = S.water; S.water = undefined; if (w.treeId) S.fsel = w.treeId; reviewIds(w.ids); }
}
// Shift+Tab: round the windows, garden → knowledge → notes.
function toggleWindow() { goWindow({ garden: "knowledge", knowledge: "notes", notes: "garden" }[winOf(S.view)]); }
function pickPlant(id) {
  S.fsel = treeOf(id) ? id : null; markSel(); renderActions();
  // bring its whole topic into view, so the graphs beside it can be picked next
  const z = S.fsel && S.forest?.fl.zones.get(treeOf(S.fsel).zoneId), at = S.fsel && treeSpot(S.fsel);
  if (z && at) stage.flyTo({ target: new THREE.Vector3(z.x, 1.5, z.z), radius: Math.max(at.radius * 1.5, stage.fitDistance(z.r * 0.85)) }, 420);
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
    // Frame the rings again when a topic or graph was added or removed.
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
  if (S.forest.view) return { ...S.forest.view, target: S.forest.view.target.clone() };
  const f = S.forest.fl;
  return { target: new THREE.Vector3(f.center.x, 1.2, f.center.z), radius: Math.min(580, stage.fitDistance(f.radius * 0.76 + 2)), phi: 0.9 };
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
  const p = stage.screenOf(home), right = stage.w;   // the stage already ends where a docked panel begins
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
  const list = S.trees.filter((t) => S.forest?.fl.trees.has(t.id)); if (!list.length) return;
  const i = list.findIndex((t) => t.id === S.fsel);
  S.fsel = list[(i + dir + list.length) % list.length].id; markSel();
  const p = S.forest.fl.trees.get(S.fsel); if (p) stage.flyTo({ target: new THREE.Vector3(p.x, 2, p.z) }, 320);
}
// Typing a number goes to that idea. Each digit lands at once; a second digit within a moment makes it a longer number.
let jumpTimer = 0;
function endJump() { clearTimeout(jumpTimer); if (S.jump) { S.jump = ""; if (S.view === "tree") renderActions(); } }
function jumpDigit(d) {
  const max = S.byNum.length; let buf = S.jump + d;
  if (+buf < 1 || +buf > max) { buf = d; if (+buf < 1 || +buf > max) return endJump(); }
  clearTimeout(jumpTimer); S.jump = +buf * 10 <= max ? buf : "";
  if (S.jump) jumpTimer = setTimeout(endJump, 900);
  const id = S.byNum[+buf - 1]; select(id); ensureVisible(id);
}

// ---------- hover card ----------
function hideHover() { $("#hover").hidden = true; }
function showHover(id, x, y) {
  const n = S.byId.get(id); if (!n || S.review) return hideHover();
  const h = $("#hover"); put(h, el("b", {}, numTag(id), n.title), n.note && el("span", { text: n.note })); h.hidden = false;
  h.style.left = Math.max(8, Math.min(innerWidth - h.offsetWidth - 8, x + 14)) + "px";
  h.style.top = (y + 18 + h.offsetHeight > innerHeight ? y - h.offsetHeight - 12 : y + 18) + "px";
}

// ---------- top bar and menus ----------
function renderTop() {
  S.backTo = null;   // set by back() when this screen has a back arrow
  const due = dueList(null).length;
  const search = ib("searchBtn", "Go to (/)", ICON.search, () => find());
  const swap = winSwitch(), beta = CHANNEL ? el("span", { class: "channel", text: CHANNEL }) : null;
  const brand = el("div", { class: "brand" }, el("img", { src: "icons/icon-192.png", alt: "", width: 24, height: 24 }), el("h1", { text: "Bonsai" }));
  const more = (run = appMenu) => ib("moreBtn", "Menu", ICON.more, (e) => run(e.currentTarget));
  const waterBtn = (run) => (due ? el("button", { class: "btn water", id: "waterAll", title: "Water", onclick: run }, icon(ICON.drop), el("span", { class: "wl", text: "Water" }), el("span", { class: "thirst", text: String(due) }), el("kbd", { text: "W" })) : null);
  const add = (items) => ib("addBtn", "Add", ICON.plus, (e) => menu(e.currentTarget, items));
  const back = (to, label = "Back") => { S.backTo = to; return el("button", { class: "ib keyed", id: "backBtn", type: "button", title: `${label} (Esc; Shift+Esc goes straight back)`, "aria-label": label, onclick: () => { location.hash = to; } }, icon(ICON.back), el("kbd", { text: "Esc" })); };
  if (S.view === "notes") {
    put($("#top"), brand, beta, el("div", { class: "crumb sub" }, el("h1", { text: "Library" })), el("span", { class: "grow" }), swap, search,
      add([{ label: "New page", key: "N", run: () => newPage() }, { label: "New folder", key: "F", run: () => newPage(null, "folder") }]), more());
  } else if (S.view === "tech") {
    put($("#top"), back(S.techBack), el("div", { class: "crumb" }, el("h1", { text: "Tech tree" })), beta, el("span", { class: "grow" }), swap, search);
  } else if (S.view === "tree") {
    const zone = S.zones.find((z) => z.id === S.tree.zoneId);
    put($("#top"), back(S.treeBack), el("div", { class: "crumb" }, el("h1", { text: S.tree.name }), el("span", { text: zone?.name || "" })), beta,
      el("span", { class: "grow" }), el("button", { class: "btn" + (S.nside ? " on" : ""), id: "notesBtn", title: "Notes beside the graph (O or [)", "aria-label": "Notes beside the graph", "aria-pressed": String(!!S.nside), onclick: toggleSide }, icon(ICON.side), el("kbd", { text: "O" })),
      (() => { const d = dueList(S.tree.id).length; return d ? el("button", { class: "btn water", id: "waterTree", title: "Water this graph", onclick: () => water(null, S.tree.id) }, icon(ICON.drop), el("span", { class: "wl", text: "Water" }), el("span", { class: "thirst", text: String(d) }), el("kbd", { text: "W" })) : null; })(),
      swap, search, more(treeMenu));
  } else if (S.view === "isles") {
    const all = S.model.flatMap((q) => q.topics).filter((q) => q.id), ideas = S.nodes.filter((n) => treeOf(n.treeId)).length;
    put($("#top"), brand, beta,
      el("div", { class: "tstats", id: "gstats" }, el("span", {}, el("b", { text: String(ideas) }), " ideas"), el("span", {}, el("b", { text: String(S.trees.length) }), " graphs"), el("span", {}, el("b", { text: String(all.length) }), " topics")),
      el("span", { class: "grow" }), sunBtn(), waterBtn(() => water(null)),
      swap, search, add([{ label: "New knowledge graph", key: "N", run: () => newGraph() }, { label: "New topic", key: "Z", run: newZone }, { label: "Capture a thought", key: "I", run: capture }]),
      ib("gFold", (gfold ? "Show the panel" : "Hide the panel") + " (])", ICON.panel, () => { gfold = !gfold; renderGarden(); renderTop(); }), more());
  } else if (S.view === "garden") {
    put($("#top"), back("#/", "Garden"), el("div", { class: "crumb" }, el("h1", { text: "Watering" })), beta, el("span", { class: "grow" }),
      waterBtn(() => startReview(null)), swap, more());
  } else if (S.fscope) {
    const m = S.view === "meaning";
    put($("#top"), back(m ? S.meanBack : S.forestBack || "#/"), el("div", { class: "crumb" }, el("h1", { text: S.fscope.name }), el("button", { class: "link", id: "scopeAll", type: "button", text: "Show all", onclick: () => (m ? goMeaning() : openScope()) })), beta, el("span", { class: "grow" }),
      sunBtn(), waterBtn(() => water(null)), swap, search, add([{ label: "New knowledge graph", key: "N", run: () => newGraph() }, { label: "New topic", key: "Z", run: newZone }, { label: "Capture a thought", key: "I", run: capture }]), more());
  } else {
    put($("#top"), brand, beta, el("span", { class: "grow" }),
      S.inbox.length ? el("button", { class: "btn", id: "inboxBtn", onclick: () => { S.panel = S.panel === "inbox" ? null : "inbox"; renderPanel(); } }, "Inbox", el("span", { class: "thirst", text: String(S.inbox.length) })) : null,
      sunBtn(), waterBtn(() => water(null)), swap, search, add([{ label: "New knowledge graph", key: "N", run: () => newGraph() }, { label: "New topic", key: "Z", run: newZone }, { label: "Capture a thought", key: "I", run: capture }]), more());
  }
}
// Beta only: put the demo islands back, as they were when the beta first opened.
async function resetDemo() {
  if (!(await dialog({ title: "Put the beta back to the demo islands?", ok: "Reset", danger: true }))) return;
  await safely(() => store.importAll(demoBackup())); await load(); location.hash = "#/"; refresh();
}
// ---------- sync between devices (sync.js) ----------
function syncAgo() { const t = sync.lastSync(); if (!t) return "not yet"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : relDate(new Date(t).toISOString().slice(0, 10)); }
const syncDone = (r) => toast(r && (r.sent || r.got) ? `Synced: ${r.sent} sent, ${r.got} in` : "Synced");
async function syncDialog() {
  if (sync.signedIn()) {
    const waiting = await store.pendingCount().catch(() => 0);
    const out = el("button", { type: "button", class: "btn", id: "syncOut", text: "Sign out", onclick: () => { sync.signOut(); out.closest(".scrim")?.querySelector(".row.end .btn")?.click(); toast("Signed out. Everything stays on this device"); } });
    const body = el("div", { class: "growd" }, el("p", { class: "muted", id: "syncWho", text: `${sync.email()} · ${syncAgo()}${waiting ? ` · ${waiting} waiting` : ""}` }), el("div", { class: "row" }, out));
    if (await dialog({ title: "Sync", ok: "Sync now", cancel: "Close", body })) syncNowUI();
    return;
  }
  const a = await dialog({ title: "Sync devices", fields: [{ name: "email", label: "Email", placeholder: "you@example.com" }], ok: "Send code" }); if (!a?.email?.includes("@")) return;
  try { await sync.sendCode(a.email); } catch (e) { return toast(e.message || "The code couldn't be sent"); }
  for (let tries = 0; tries < 3; tries++) {
    const b = await dialog({ title: `Code sent to ${a.email.trim()}`, fields: [{ name: "code", label: "Code", placeholder: "From the email", max: 10 }], ok: "Sign in" }); if (!b?.code) return;
    try { syncDone(await sync.signIn(a.email, b.code)); await refresh(); renderChrome(); return; } catch (e) { toast(e.message || "That code didn't work"); }
  }
}
function syncNowUI() { sync.syncNow().then((r) => { syncDone(r); }).catch((e) => toast(e.message || "Sync failed")); }
let syncErr = "";
const syncStart = () => sync.start({
  onChange: async () => { await refresh(); renderChrome(); },
  onError: (e) => { if (e instanceof TypeError || !navigator.onLine) return; const m = e.message || "Sync failed"; if (m !== syncErr) { syncErr = m; toast(m.startsWith("Sync") ? m : "Sync: " + m); } },
});
const DESKTOP_URL = "https://github.com/UmbraMortis343/Bonsai/releases?q=desktop&expanded=true";
function appMenu(anchor) {
  const archived = [...S.allZones.filter((z) => z.archived), ...S.allTrees.filter((t) => t.archived)];
  menu(anchor, [
    (S.view === "forest" || S.view === "isles") && { label: "Meaning view", key: "M", run: () => goMeaning() },
    S.view !== "tech" && { label: "Tech tree", key: "K", run: openTech },
    S.view !== "notes" && S.view !== "tree" && { label: "Notes", key: "O", run: openNotes },
    (S.view === "forest" || S.view === "isles") && { label: "Timelapse", key: "T", run: tlToggle },
    desktop && { label: "Sunday session", key: "U", run: startSunday },
    archived.length && { label: "Archived", run: () => menu(anchor, archived.map((x) => ({ label: `Restore ${x.name}`, run: async () => { await safely(() => (x.rootId ? store.updateTree : store.updateZone)(x.id, { archived: false })); refresh(); } }))) },
    "-", S.view === "isles" && { label: "Import map", run: importMap }, { label: "Import exam", run: importExam }, { label: "Export backup", run: exportBackup }, { label: "Restore backup", run: () => $("#importFile").click() },
    CHANNEL && { label: "Reset demo data", run: resetDemo },
    "-", { label: "Shortcuts", key: "?", run: shortcuts },
    { label: "Check for updates", run: async () => { const r = await shell.check(); if (r !== "update") toast(r === "latest" ? "Up to date" : "Offline"); } },
    { label: "What's new", run: () => window.open("https://github.com/UmbraMortis343/Bonsai/releases", "_blank", "noopener") },
    shell.canInstall() && { label: "Install app", run: () => shell.install() },
    { label: sync.signedIn() ? `Sync · ${syncAgo()}` : "Sync devices", run: syncDialog },
    S.desk && { label: `Bonsai Desktop ${S.desk.latest}`, run: () => window.open(S.desk.url, "_blank", "noopener") },
    !desktop && /Windows/.test(navigator.userAgent) && { label: "Bonsai for Windows", run: () => window.open(DESKTOP_URL, "_blank", "noopener") },
    { label: `Bonsai ${CHANNEL ? CHANNEL + " " : ""}${shell.version}`, disabled: true },
  ]);
}
function treeMenu(anchor) {
  const t = S.tree;
  menu(anchor, [
    { label: "Timelapse", key: "T", run: tlToggle },
    { label: "Meaning view", key: "M", run: () => { S.pendingSel = S.sel; goMeaning(t.zoneId); } }, { label: "Tech tree", key: "K", run: openTech }, { label: "Fit view", key: "0", run: fitView },
    "-", { label: "Rename", run: () => renameThing(t, store.updateTree, "Knowledge graph") }, { label: "Colour", run: () => colourThing(t, store.updateTree) },
    S.zones.length > 1 && { label: "Move to topic", run: async () => {
      const v = await dialog({ title: `Move ${t.name}`, fields: [{ name: "zoneId", label: "Topic", type: "select", value: t.zoneId, options: S.zones.map((z) => [z.id, z.name]) }], ok: "Move" });
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
    { label: "New knowledge graph", run: () => newGraph(id) }, { label: "Only this topic", run: () => openScope(id) }, { label: "Meaning view", run: () => goMeaning(id) },
    { label: "Rename", run: () => renameThing(z, store.updateZone, "Topic") }, { label: "Colour", run: () => colourThing(z, store.updateZone) },
    trees.length > 1 && { label: "Merge into one graph", run: async () => {
      const v = await dialog({ title: `Merge ${z.name}`, fields: [{ name: "into", label: "Into", type: "select", value: trees[0].id, options: trees.map((t) => [t.id, t.name]) }], ok: "Merge" });
      if (v && (await safely(() => store.mergeZone(id, v.into))) !== undefined) { await load(); goTree(v.into); }
    } },
    { label: "Archive", run: async () => { if (await safely(() => store.updateZone(id, { archived: true }))) { toast(`Archived ${z.name}`); refresh(); } } },
    { label: "Delete", danger: true, run: async () => {
      if (await dialog({ title: `Delete ${z.name}${trees.length ? ` and its ${trees.length} knowledge graph${trees.length === 1 ? "" : "s"}` : ""}?`, ok: "Delete", danger: true })) { await safely(() => store.deleteZone(id)); refresh(); }
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
  const v = await dialog({ title: "New topic", fields: [{ name: "name", label: "Topic", max: 80 }], ok: "Add" });
  const z = v && (await safely(() => store.createZone({ name: v.name })));
  if (!z) return;
  await refresh(); newGraph(z.id);
}
async function capture() {
  const v = await dialog({ title: "Capture", fields: [{ name: "text", label: "Thought" }], ok: "Save" });
  if (v && (await safely(() => store.addInbox(v.text)))) { await refresh(); toast("In the inbox"); }
}
// One set of rules everywhere (0.27.0): the mouse picks, goes in, asks for a menu; the keys do the same.
function shortcuts() {
  const groups = [
    ["Everywhere", [["Click", "Pick"], ["Double-click  ↵", "Go in, open"], ["Right-click", "Its menu (tech tree: open or close what's under it)"], ["Drag", "Move what you hold; on empty space, turn or pan"],
      ["Wheel", "Zoom"], ["1–9  ← ↑ ↓ →", "Pick by number, or the next one"], ["Esc", "Let go, then step back out"], ["⇧Esc", "Straight back"], ["0", "Fit"], ["V", "The other view: board and 3D, separate and joined, tree and web"], ["M", "Meaning: ideas arranged by what they mean"],
      ["⇧Tab", "Garden, Knowledge, Library (Knowledge shows what's picked; Tab alone in the garden)"], ["[  ]", "The panel on the left, on the right"], ["/", "Search"], ["I", "Capture a thought"], ["K", "Tech tree"], ["O", "Notes beside a graph"], ["U", "Sunday session (Bonsai Desktop)"], ["?", "These keys"]]],
    ["Building a graph", [["Tab", "Add under"], ["↵", "Add beside"], ["R", "Rename"], ["Del", "Delete (a picked link too)"], ["L", "Link"], ["G", "Graft"], ["X", "Make its own graph"], ["C", "Colour"], ["Q", "Add a question"], ["Space", "Notes"], ["⇧↵", "Open the board's graph in 3D"],
      ["Drag", "Move an idea; drop it on another to graft"], ["+ or Alt-drag", "Pull out a new idea, or a link"]]],
    ["Garden", [["W", "Water"], ["D", "Day or night"], ["N  Z", "New graph, new topic"], ["S", "Split a full topic"], ["⇧1–3  ⇧0", "Focus, Keep, Settled; a topic back to its island's"]]],
    ["Timelapse", [["T", "Open or close"], ["Space", "Play or pause"], ["← →", "A day back or on"], ["⇧← ⇧→", "The marks: Sundays and big days"], ["⇧T", "Save as video"], ["Esc", "Back to now"]]],
    ["Tech tree", [["Space", "Open or close"], ["↵", "Put in the middle; again to open"], ["H  A", "Whole tree, everything open"], ["B", "What an island grows from"]]],
    ["Library", [["N  F  W", "New page, folder, pen page"], ["⇧V", "Vocab"], ["P H E L", "Pen page: pen, highlighter, eraser, lasso"], ["C  S  B  T", "Pen page: colour, size, paper, touch"]]],
  ];
  dialog({ title: "Shortcuts", ok: null, cancel: "Close", body: el("div", { class: "keygroups" }, groups.map(([h, rows]) => el("section", {}, el("h3", { text: h }),
    el("table", { class: "keys" }, rows.map(([k, d]) => el("tr", {}, el("td", {}, el("kbd", { text: k })), el("td", { text: d }))))))) });
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
  if (!(await dialog({ title: `Replace everything on this device with the backup (${n} idea${n === 1 ? "" : "s"})?`, ok: "Replace", danger: true }))) return;
  if ((await safely(async () => { await store.importAll(data); return true; }))) { toast("Restored"); if (location.hash && location.hash !== "#/") location.hash = "#/"; else go(); }
}

// ---------- actions on the selected idea ----------
function renderActions() {
  const a = $("#actions");
  if (S.quick) {
    const q = S.quick, rename = q.kind === "rename", goto = q.kind === "goto", what = rename ? "Name" : goto ? "Number" : "New idea";
    const input = el("input", { id: "quickInput", value: rename ? S.byId.get(q.id)?.title || "" : "", placeholder: what, maxLength: 140, autocomplete: "off", inputMode: goto ? "numeric" : null, "aria-label": rename ? "Rename" : what });
    input.addEventListener("keydown", (e) => {
      if (rename || goto) return;
      if (e.key === "Tab") { e.preventDefault(); commitQuick(input.value, "child"); }
      else if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); commitQuick(input.value, "sibling"); }
    });
    put(a, el("form", { class: "quick", onsubmit: (e) => { e.preventDefault(); commitQuick(input.value); } }, input, el("button", { class: "btn primary", text: rename ? "Save" : goto ? "Go" : "Add" }),
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
      el("button", { class: "btn primary", id: "waterBtn", onclick: () => startReview(plant.id) }, dry.length ? `Water ${dry.length}` : "Practise", el("kbd", { text: "↵" })),
      dry.length ? el("button", { class: "btn", id: "allGood", onclick: () => passAll(dry.map((x) => x.id)) }, "All good", el("kbd", { text: "A" })) : null,
      el("button", { class: "btn", id: "openTree", onclick: () => goTree(plant.id) }, "Open", el("kbd", { text: "⇧↵" })));
    a.hidden = false;
    return;
  }
  if (S.view === "forest" && S.cutoff == null && !S.pick && S.trees.length) {
    const b = (id, text, k, run, on) => el("button", { class: "btn" + (on ? " on" : ""), id, "aria-pressed": on == null ? null : String(on), onclick: run }, text, el("kbd", { text: k }));
    put(a, lookSeg(), el("span", { class: "sep" }), b("viewFit", "Fit", "0", fitView), S.fscope ? b("viewAll", "Show all", "A", () => openScope()) : null, b("viewThirsty", "Thirsty", "H", toggleThirsty, !!S.thirsty), el("span", { class: "sep" }), b("viewTech", "Tech tree", "K", openTech));
    a.hidden = false; return;
  }
  const idea = S.view === "meaning" && !S.pick ? S.byId.get(S.sel) : null;
  if (S.view === "meaning" && !idea && !S.pick && S.mean) {
    const b = (id, text, k, run, on) => el("button", { class: "btn" + (on ? " on" : ""), id, "aria-pressed": on == null ? null : String(on), onclick: run }, text, el("kbd", { text: k }));
    put(a, lookSeg(), el("span", { class: "sep" }), b("viewFit", "Fit", "0", fitView), S.fscope ? b("viewAll", "Show all", "A", () => goMeaning()) : null, b("suggestBtn", "Suggest", "S", openSuggest), el("span", { class: "sep" }), b("viewTech", "Tech tree", "K", openTech));
    a.hidden = false; return;
  }
  if (idea) {
    put(a, el("div", { class: "plant" }, el("b", { text: idea.title }), el("span", { class: "muted", text: pathOf(idea) })),
      el("button", { class: "btn", dataset: { act: "open" }, onclick: () => { S.pendingSel = idea.id; goTree(idea.treeId); } }, "Open", el("kbd", { text: "↵" })),
      el("button", { class: "btn", dataset: { act: "note" }, onclick: togglePanel }, "Notes", el("kbd", { text: "Space" })), el("button", { class: "btn", dataset: { act: "link" }, onclick: linkFrom }, "Link", el("kbd", { text: "L" })));
    a.hidden = false;
    return;
  }
  const n = S.view === "tree" && !S.review && !S.pick && S.cutoff == null ? S.byId.get(S.sel) : null;
  if (!n) { a.hidden = true; a.replaceChildren(); return; }
  const key = (act, text, k, run, lap, off) => el("button", { class: "btn" + (lap ? " lap" : ""), dataset: { act }, disabled: !!off, onclick: run }, text, el("kbd", { text: k }));
  const top = n.parentId == null;
  if (S.move) {   // moving ideas: drag one, or nudge the picked one with the arrows
    const moved = (S.byTree.get(S.tree.id) || []).filter((x) => x.pin).length;
    put(a, el("div", { class: "plant" }, el("b", { text: "Move" }), el("span", { class: "muted", text: moved ? `${moved} moved` : "Drag an idea" })),
      el("button", { class: "btn primary", dataset: { act: "moveDone" }, onclick: () => toggleMove(false) }, "Done", el("kbd", { text: "V" })),
      el("span", { class: "btn lap", "aria-hidden": "true", style: "pointer-events:none" }, "Nudge", el("kbd", { text: "← ↑ ↓ →" })),
      key("unpin", "Put back", "U", () => unpin(false), false, !n.pin), key("unpinAll", "Put all back", "⇧U", () => unpin(true), false, !moved));
    a.hidden = false; return;
  }
  put(a, key("add", "Add", "Tab", () => quick("child")), key("beside", "Beside", "↵", () => quick("sibling"), true), key("rename", "Rename", "R", () => quick("rename"), true),
    key("note", "Notes", "Space", togglePanel), key("link", "Link", "L", linkFrom), key("graft", "Graft", "G", graft),
    el("span", { class: "sep lap" }), key("goto", "Go to", S.jump ? S.jump + "…" : "1–9", () => quick("goto"), true), key("fit", "Fit", "0", fitView, true), key("board", "Board", "V", openOnBoard, true),
    ib("nodeMore", "More", ICON.more, (e) => menu(e.currentTarget, ideaItems(n))));
  a.hidden = false;
}
// Everything that can be done to an idea in a graph: the ⋯ menu and right-click both show it
function ideaItems(n) {
  const top = n.parentId == null;
  return [
    { label: "Add under", key: "Tab", run: () => quick("child") }, !top && { label: "Add beside", key: "↵", run: () => quick("sibling") },
    { label: "Rename", key: "R", run: () => quick("rename") }, { label: "Notes", key: "Space", run: () => { S.panel = "node"; renderPanel(); } },
    { label: "Link to…", key: "L", run: linkFrom }, { label: "Graft onto…", key: "G", run: graft },
    !top && { label: n.wasTree ? `Split ${n.wasTree.name} back out` : "Make its own graph", key: "X", run: () => splitOut(n) },
    { label: "Colour", key: "C", run: () => cycleColour(n) }, { label: "Add question", key: "Q", run: () => editQuestion(n, -1) },
    n.pin && { label: "Put back where it was", run: () => unpin(false) },
    { label: "On the board", key: "V", run: openOnBoard }, { label: "Tech tree", key: "K", run: openTech },
    !top && "-", !top && { label: "Delete", key: "Del", danger: true, run: () => removeNode(n.id) }];
}
// V in a graph: the same graph on the Library's board, the same idea picked
function openOnBoard() { const t = S.tree; if (!t) return; S.gsel = S.sel || null; location.hash = notesHash(GP + t.id); }
// ---------- move mode: put ideas where you want them ----------
// A moved idea is pinned there (node.pin, measured from the middle of its graph's disc) and the rest settles round it.
function toggleMove(on = !S.move) {
  if (S.view !== "tree" || S.cutoff != null) on = false;
  S.move = on; S.quick = null; document.body.toggleAttribute("data-move", on); hideHover(); renderActions();
}
// Saves where an idea now sits; anything under it that was itself moved by hand goes along by the same amount.
async function pinAt(id, to) {
  const n = S.byId.get(id), was = S.lay.pos.get(id); if (!n || !was || id === S.tree.rootId) return;
  if (n.xy && S.byId.get(S.tree.rootId)?.xy) {   // placed on the board: moving it here moves it there, with what hangs from it
    const dx = Math.round((to.x - was[0]) / XY), dy = Math.round((to.z - was[2]) / XY);
    stage.userMoved = true;
    await safely(() => store.placeNodes(store.subtreeIds(S.byTree.get(S.tree.id), id).map((x) => S.byId.get(x)).filter((m) => m?.xy).map((m) => [m.id, m.xy[0] + dx, m.xy[1] + dy])));
    return refresh({ animate: true });
  }
  const d = [to.x - was[0], Math.max(0.75, to.y) - was[1], to.z - was[2]];
  stage.userMoved = true;   // keep the view where it is: re-framing after a move would pull the idea out from under the hand
  await safely(async () => {
    for (const x of store.subtreeIds(S.byTree.get(S.tree.id), id)) { const m = S.byId.get(x); if (x !== id && m?.pin) await store.updateNode(x, { pin: [m.pin[0] + d[0], m.pin[1] + d[1], m.pin[2] + d[2]] }); }
    await store.updateNode(id, { pin: [to.x, Math.max(0.75, to.y), to.z] });
  });
  await refresh({ animate: true });
}
async function unpin(all) {
  const ids = all ? (S.byTree.get(S.tree.id) || []).filter((x) => x.pin).map((x) => x.id) : S.byId.get(S.sel)?.pin ? [S.sel] : [];
  if (!ids.length) return;
  await safely(async () => { for (const id of ids) await store.updateNode(id, { pin: null }); });
  await refresh({ animate: true });
}
// Arrow keys shift the picked idea across the screen: right and up as the camera sees them.
function nudge(dx, dy) {
  const p = S.flora?.pos.get(S.sel); if (!p || S.sel === S.tree.rootId) return;
  const m = stage.camera.matrixWorld.elements, k = 0.3;
  return pinAt(S.sel, new THREE.Vector3(p.x + (m[0] * dx + m[4] * dy) * k, p.y + (m[1] * dx + m[5] * dy) * k, p.z + (m[2] * dx + m[6] * dy) * k));
}
// Dragging an idea in move mode: it slides in the plane facing the camera, carrying what hangs from it.
// Dragging an idea in a graph moves it, with what hangs from it; dragging anywhere else turns the view.
function grabIdea(hit, e) {
  if (S.view !== "tree" || S.review || S.pick || S.cutoff != null || hit?.kind !== "node" || hit.id === S.tree.rootId || !S.flora?.pos.has(hit.id)) return null;
  const f = S.flora, id = hit.id, ids = store.subtreeIds(S.byTree.get(S.tree.id), id).filter((x) => f.pos.has(x));
  f.held = true; for (const [x, home] of f.home) f.pos.get(x).copy(home);   // stop any settling still in motion
  const start = new Map(ids.map((x) => [x, f.pos.get(x).clone()])), normal = stage.camera.getWorldDirection(new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, start.get(id)), first = new THREE.Vector3(), now = new THREE.Vector3(), reach = Math.max(14, S.lay.footprint * 3);
  if (!stage.rayAt(e.clientX, e.clientY).intersectPlane(plane, first)) return null;
  let picked = false;   // picked once it really moves: a plain tap is left to pick it the usual way
  return {
    move(ev) {
      if (!picked) { picked = true; if (S.sel !== id) select(id); }
      if (!stage.rayAt(ev.clientX, ev.clientY).intersectPlane(plane, now)) return;
      const d = now.clone().sub(first), to = start.get(id).clone().add(d);
      if (Math.hypot(to.x, to.z) > reach) return;   // not off into the distance
      for (const x of ids) { const q = f.pos.get(x).copy(start.get(x)).add(d); if (q.y < 0.75) q.y = 0.75; }
      f.apply(); placeSel(); stage.invalidate();
    },
    end(cancelled) {
      if (cancelled) { f.held = false; for (const x of ids) f.pos.get(x).copy(start.get(x)); f.apply(); placeSel(); return stage.invalidate(); }
      pinAt(id, f.pos.get(id).clone());
    },
  };
}

function flyToSel() { const home = S.flora?.home.get(S.sel); if (home) stage.flyTo({ target: home, radius: Math.min(stage.radius, 8) }); }
function editNotes() {
  if (!ideaView() || !S.byId.get(S.sel)) return;
  S.panel = "node"; S.editBody = true; renderPanel(); $("#nodeBody")?.focus();
}
function quick(kind) {
  if (S.view !== "tree" || S.cutoff != null || S.review) return;
  const n = S.byId.get(S.sel) || S.byId.get(S.tree.rootId); if (!n) return;
  S.quick = { kind, id: n.id, parentId: kind === "sibling" ? n.parentId ?? n.id : n.id }; renderActions();
}
async function commitQuick(value, then) {
  const q = S.quick, v = value.trim(); S.quick = null;
  if (!q || !v) return renderActions();
  if (q.kind === "goto") { const id = S.byNum[parseInt(v, 10) - 1]; renderActions(); if (id) { select(id); ensureVisible(id); } return; }
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
  toast(`${t.name} is its own graph`, { label: "Open", run: () => goTree(t.id) });
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
// "/" goes anywhere in one step: type a few letters of an island, topic, graph, idea or note and press Enter.
// Islands and topics open in the garden, graphs on their board, ideas in their graph, notes in Notes.
function places(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const out = [], add = (kind, label, where, go) => { const t = label.toLowerCase(), i = t.indexOf(q); if (i >= 0) out.push({ kind, label, where, go, score: (i === 0 ? 0 : t[i - 1] === " " ? 1 : 2) + label.length / 200 }); };
  for (const q2 of S.garden?.islands || []) add("Island", q2.name, "Garden", () => toGarden({ isle: q2.id }));
  for (const z of S.zones) add("Topic", z.name, S.garden?.islands.find((x) => x.zoneIds.includes(z.id))?.name || "", () => toGarden({ topic: z.id }));
  for (const t of S.trees) add("Graph", t.name || "Untitled", S.zones.find((z) => z.id === t.zoneId)?.name || "", () => { location.hash = notesHash(GP + t.id); });
  for (const n of S.nodes) if (!n.ghost) { add("Idea", n.title, treeOf(n.treeId)?.name || "", () => jump(n.id)); if (out.at(-1)?.label === n.title && !out.at(-1).id) out.at(-1).id = n.id; }
  for (const pg of S.pages || []) if (!isFolder(pg)) add("Note", pg.title || "Untitled", "Notes", () => { location.hash = notesHash(pg.id); });
  const rank = { Island: 0, Topic: 1, Graph: 2, Note: 3, Idea: 4 };
  return out.sort((a, b) => a.score - b.score || rank[a.kind] - rank[b.kind]).slice(0, 12);
}
function find() {
  document.querySelector(".goto")?.remove();
  let hits = [], at = 0, semT = 0;
  const list = el("div", { class: "glist2", role: "listbox", id: "gotoList" }), close = () => box.remove();
  const go = (h) => { close(); h?.go(); };
  const draw = () => put(list, hits.map((h, i) => el("button", { class: "grow2 res" + (i === at ? " on" : "") + (h.sem ? " sem" : ""), type: "button", role: "option", onmousedown: (e) => e.preventDefault(), onclick: () => go(h) },
    el("span", { class: "gk", text: h.kind }), el("span", { class: "gl", text: h.label }), el("span", { class: "muted gw", text: h.where }))));
  const input = el("input", { id: "gotoInput", placeholder: "Go to an island, topic, graph, idea or note", "aria-label": "Go to", autocomplete: "off",
    oninput: () => {
      const q = input.value.trim().toLowerCase(); hits = places(q); at = 0; draw();
      // with the model on, ideas that match by meaning follow
      clearTimeout(semT);
      if (S.aiOn && ai.cache.size && q.length > 2) semT = setTimeout(async () => {
        const live = new Set(S.trees.map((t) => t.id)), found = await ai.search(q, S.nodes.filter((n) => live.has(n.treeId) && !n.ghost).map((n) => n.id), 6).catch(() => []);
        if (!box.isConnected || input.value.trim().toLowerCase() !== q) return;
        for (const [id, c] of found) { const n = S.byId.get(id); if (n && c > 0.25 && hits.length < 14 && !hits.some((h) => h.id === id)) hits.push({ kind: "Idea", label: n.title, where: treeOf(n.treeId)?.name || "", go: () => jump(id), id, sem: true }); }
        draw();
      }, 250);
    },
    onkeydown: (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); at = (at + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % Math.max(1, hits.length); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); go(hits[at]); }
    }, onblur: () => setTimeout(close, 150) });
  const box = el("div", { class: "goto", role: "dialog", "aria-label": "Go to" }, el("div", { class: "grow1" }, icon(ICON.search), input, el("kbd", { text: "Esc" })), list);
  document.body.append(box); input.focus();
}
function jump(id) {
  const n = S.byId.get(id); if (!n) return;
  if ((S.view === "tree" && S.tree.id === n.treeId) || (S.view === "meaning" && S.mean?.pos.has(id))) select(id, { fly: true });
  else { S.pendingSel = id; goTree(n.treeId); }
}

// ---------- side panel ----------
// With a notes page open on the left, the idea panel on the right covers the rest of the screen (no sliver of graph between),
// and shows the graph as a flat web to pick ideas from.
const isWide = () => S.view === "tree" && !!S.panel && document.body.dataset.nside === "page" && !matchMedia("(max-width:700px)").matches;
function renderPanel() {
  const p = $("#panel");
  S.flush?.(); S.flush = null;
  if (S.panel === "node" && !(ideaView() && S.byId.get(S.sel))) S.panel = null;
  if (S.panel === "suggest" && S.view !== "meaning") S.panel = null;
  const wide = isWide(); document.body.dataset.wide = wide ? "1" : "";
  if (!S.panel) { p.hidden = true; p.replaceChildren(); document.body.dataset.panel = ""; document.body.dataset.wide = ""; return; }
  p.hidden = false; document.body.dataset.panel = S.panel;
  const body = (S.panel === "node" ? nodePanel(S.byId.get(S.sel)) : S.panel === "suggest" ? suggestPanel() : inboxPanel()).flat().filter(Boolean);
  if (!wide || S.panel !== "node") return put(p, ...body);
  const host = el("div", { class: "wideweb" }), tree = S.tree, nodes = S.byTree.get(tree.id) || [], ids = new Set(nodes.map((n) => n.id)), looks = looksFor(tree, nodes, false);
  put(p, el("div", { class: "wide" }, host, el("div", { class: "widecard" }, ...body)));
  if (!S.mw) S.mw = createMiniWeb({ host, onPick: (id) => select(id) }); else S.mw.attach(host);
  S.mw.setData({ nodes, rootId: tree.rootId, links: S.links.filter((l) => ids.has(l.fromId) && ids.has(l.toId)).map((l) => ({ a: l.fromId, b: l.toId })), colour: (id) => looks.get(id)?.color || T.limb });
  S.mw.select(S.sel);
}
// a close button with its key shown: [ for the left side, ] for the right
const closeBtn = (id, label, key, run) => el("button", { class: "ib keyed", id, type: "button", title: `${label} (${key})`, "aria-label": label, onclick: run }, icon(ICON.close), el("kbd", { text: key }));
const panelClose = () => closeBtn("panelClose", "Close", "]", () => { S.panel = null; renderPanel(); });
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
  const trail = []; for (let q = S.byId.get(n.parentId); q; q = S.byId.get(q.parentId)) trail.unshift(q);
  const under = S.view === "tree" ? kidsOf(n.id) : [], go = (id) => { select(id); ensureVisible(id); };
  return [
    S.view === "tree" && trail.length ? el("div", { class: "trail" }, trail.map((q) => el("button", { class: "chip", type: "button", title: q.title, onclick: () => go(q.id) }, numTag(q.id), q.title))) : null,
    n.oral ? el("div", { class: "examrow", id: "oralTag" }, el("span", { class: "chip" + (n.oral.shown ? "" : " ghost"), text: n.oral.shown ? "Oral: shown" : "Oral: missed" }), el("span", { class: "muted", text: n.oral.why })) : null,
    n.ghost || n.exam ? el("div", { class: "examrow" }, el("span", { class: "chip" + (n.ghost ? " ghost" : ""), id: "examTag", text: n.ghost ? "Not shown yet" : LEVELS[(n.exam.level || 1) - 1] }), el("span", { class: "muted", text: n.exam?.tier || "" })) : null,
    el("div", { class: "ph" }, numTag(n.id), el("input", { id: "nodeTitle", class: "title", value: n.title, maxLength: 140, "aria-label": "Title",
      onchange: (e) => (e.target.value.trim() ? save({ title: e.target.value }) : (e.target.value = n.title)) }), panelClose()),
    el("input", { id: "nodeNote", class: "short", value: n.note || "", maxLength: 500, placeholder: "Short note", "aria-label": "Short note", onchange: (e) => save({ note: e.target.value }) }),
    bodyBox,
    el("div", { class: "swatches" }, SWATCHES.map(([name, hex]) => el("button", { class: "sw" + ((n.color || "") === hex ? " on" : "") + (hex ? "" : " none"), title: name, "aria-label": name, style: hex ? `background:${hex}` : "", onclick: () => save({ color: hex || null }, true) }))),
    questionsBox(n),
    links.length && el("section", {}, el("h3", { text: "Links" }), links.map((l) => {
      const other = S.byId.get(l.fromId === n.id ? l.toId : l.fromId); if (!other) return null;
      return el("div", { class: "linkrow" }, el("button", { class: "chip", text: other.title, title: pathOf(other), onclick: () => jump(other.id) }),
        el("input", { value: l.label || "", placeholder: "Label", maxLength: 60, "aria-label": `Label for link to ${other.title}`, onchange: async (e) => { await safely(() => store.updateLink(l.id, { label: e.target.value })); refresh({ panel: false }); } }),
        ib(null, "Remove link", ICON.close, () => removeLink(l.id)));
    })),
    patches.length && el("section", {}, el("h3", { text: "Patches" }), patches.map((p) => el("blockquote", {}, el("time", { text: fmtDate(p.createdAt) }), el("p", { text: p.text })))),
    under.length ? el("section", { class: "ncards" }, under.map((k) => { const c = kidsOf(k.id).length; return el("button", { class: "ncard", type: "button", dataset: { id: k.id }, onclick: () => go(k.id) },
      el("div", { class: "row" }, numTag(k.id), el("b", { text: k.title }), c ? el("span", { class: "muted", text: `+${c}` }) : null), k.note ? el("span", { class: "muted", text: k.note }) : null); })) : null,
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
  if (S.view === "tree" && S.tree?.id === n.treeId) select(n.id, { fly: true });
  if (S.view === "notes" && S.boardTree === n.treeId) S.boardPick?.(n.id);
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
  if (S.sun) return renderSunday();
  if (S.oral) return renderOral();
  const box = $("#review"), r = S.review, n = r && S.byId.get(r.ids[r.i]);
  box.classList.remove("oral", "sunday"); unmaskBoard();
  if (!n) { box.hidden = true; box.replaceChildren(); return; }
  const parent = S.byId.get(n.parentId), kids = kidsOf(n.id), ask = reviewAsk(), qk = ask && !ask.fallback ? ask : null;
  box.hidden = false;
  const rateRow = () => el("div", { class: "row rate" }, srs.RATINGS.map((x, i) => el("button", { class: "btn", dataset: { rate: x }, onclick: () => rateNow(x) }, x[0].toUpperCase() + x.slice(1), el("kbd", { text: String(i + 1) }))));
  const showB = () => el("button", { class: "btn primary", id: "showAnswer", onclick: () => { r.shown = true; renderReview(); } }, "Show", el("kbd", { text: "Space" }));
  let body;
  if (!qk) body = [el("h2", { text: n.title }), ...(r.shown ? [
      n.note && el("p", { class: "rv-note", text: n.note }), n.body && el("div", { class: "md", html: md(n.body) }),
      kids.length && el("ul", { class: "rv-kids" }, kids.map((k) => el("li", { text: k.title }))), rateRow(),
    ] : [showB()])];
  else if (qk.kind === "rebuild") {   // the idea with blanks where the hidden ideas hang
    const hid = new Set(qk.hide);
    body = [el("h2", { id: "reviewQ", text: n.title }), qk.q !== REBUILD_Q ? el("p", { class: "muted", text: qk.q }) : null,
      el("ul", { class: "rv-kids rebuild", id: "rebuildList" }, kids.map((k) => hid.has(k.id) ? el("li", { class: r.shown ? "hid" : "blank", text: r.shown ? k.title : "" }) : el("li", { text: k.title }))),
      r.shown ? rateRow() : showB()];
  } else body = [el("h2", { id: "reviewQ", text: qk.q }), ...(r.shown ? [
      el("div", { class: "rv-ans", id: "reviewAns" }, el("b", { text: n.title }), n.note ? el("span", { text: n.note }) : null, qk.a ? el("p", { text: qk.a }) : null),
      n.body && el("div", { class: "md", html: md(n.body) }), rateRow(),
    ] : [showB()])];
  put(box,
    el("div", { class: "row" }, qk ? el("span", { class: "qkind", id: "reviewKind", text: KIND_NAME[qk.kind] }) : null, el("span", { class: "muted grow", text: [pathOf(n), parent?.title].filter(Boolean).join(" › ") }), el("span", { class: "muted", text: `${r.i + 1}/${r.ids.length}` }), el("button", { class: "link", id: "reviewAllGood", text: "All good", onclick: () => passAll(r.ids.slice(r.i)) }), desktop ? el("button", { class: "link", id: "reviewOral", onclick: () => startOral(n.treeId, r.ids.slice(r.i)) }, "Oral", el("kbd", { text: "E" })) : null, ib("reviewClose", "Stop", ICON.close, endReview)),
    ...body.filter(Boolean));
}
async function rateNow(rating) {
  const r = S.review; if (!r || r.busy) return; r.busy = true;
  const ask = reviewAsk();
  await safely(() => store.reviewNode(r.ids[r.i], rating, { asked: ask && !ask.fallback ? ask.kind : "" }));
  r.n++; r.i++; r.shown = false; r.busy = false; await load();
  if (r.i >= r.ids.length) return endReview();
  stepReview();
}
async function endReview() {
  const n = S.review?.n; S.review = null;
  await refresh({ animate: true }); renderReview();
  if (n) toast(`Watered ${n}`);
}

// ---------- questions ----------
// Watering asks a question instead of showing an idea's name (card "Questions of five kinds", questions.js): he
// answers in his head, shows the answer and rates as before. Questions live on the idea (node.qs), so the phone
// asks them without Claude. Q adds one on the picked idea; in Bonsai Desktop a graph's menu has Write questions,
// where Claude writes them for ideas with none and he ticks which to keep. Grow writes them as it goes.
const qctx = (n) => ({ kids: kidsOf(n.id), links: S.links.filter((l) => l.fromId === n.id || l.toId === n.id).map((l) => ({ id: l.id, label: l.label || "", other: S.byId.get(l.fromId === n.id ? l.toId : l.fromId) })).filter((l) => l.other) });
// The question to ask today for an idea ({ kind: "name", fallback: true } when it has none it can use). For Morning recall too.
const askFor = (n, day = dayNumber()) => questionFor(n, qctx(n), day);
function reviewAsk() { const r = S.review, n = r && S.byId.get(r.ids[r.i]); if (!n) return null; r.asks ||= {}; return (r.asks[r.i] ||= askFor(n)); }
// A name kept back while a question waits: the idea asked about, or a Rebuild's hidden ideas.
function masked(id) {
  const r = S.review; if (!r || r.shown || S.oral) return false;
  const a = reviewAsk(); if (!a || a.fallback) return false;
  return a.kind === "rebuild" ? a.hide.includes(id) : id === r.ids[r.i];
}
// the board, its foot and the idea card follow what's masked
function unmaskBoard() {
  if (S.view !== "notes" || !S.board) return;
  S.board.redraw(); const tr = treeOf(S.boardTree); if (tr) drawGraphFoot($("#gfoot"), tr);
  if (S.gpanes?.card) delete S.gpanes.card.dataset.id; drawIdeaCard();
}
const afterQuestion = () => (S.view === "notes" ? boardRedraw() : refresh());
// The Questions section of the idea panel and the board's idea card: each question, + to add (Q), × to delete.
function questionsBox(n) {
  const qs = n.qs || [], ok = new Set(usableQs(n, qctx(n)).map((x) => x.i));
  return el("section", { class: "qsec", id: "qsec" },
    el("div", { class: "row" }, el("h3", { class: "grow", text: "Questions" }), el("button", { class: "btn small", type: "button", id: "qAdd", title: "Add a question (Q)", onclick: () => editQuestion(n, -1) }, "+", el("kbd", { text: "Q" }))),
    qs.map((q, i) => el("div", { class: "qrow" + (ok.has(i) ? "" : " off"), dataset: { i } },
      el("span", { class: "qkind", text: KIND_NAME[q.kind] || q.kind }),
      el("button", { class: "qtext", type: "button", text: q.q, title: q.a || "", onclick: () => editQuestion(n, i) }),
      ib(null, "Delete question", ICON.close, () => deleteQuestion(n, i)))));
}
// Writing or changing one question. i: its place in node.qs, -1 for a new one.
async function editQuestion(n, i = -1) {
  n = S.byId.get(n.id) || n;
  const was = (n.qs || [])[i], c = qctx(n);
  const kind = el("select", { id: "qKind", "aria-label": "Kind", onchange: () => show() }, KINDS.map((k) => el("option", { value: k, text: KIND_NAME[k], selected: k === (was?.kind || "recall"), disabled: (k === "connect" && !c.links.length) || (k === "rebuild" && !c.kids.length) })));
  const q = el("textarea", { id: "qText", rows: 3, placeholder: "Question", "aria-label": "Question", value: was?.q || "" });
  const a = el("textarea", { id: "qAnswer", rows: 2, placeholder: "Answer", "aria-label": "Answer", value: was?.a || "" });
  const link = el("select", { id: "qLink", "aria-label": "Link" }, c.links.map((l) => el("option", { value: l.id, text: l.other.title + (l.label ? ` (${l.label})` : ""), selected: l.id === was?.linkId })));
  const hide0 = new Set(was?.hide?.length ? was.hide : pickHide(c.kids, n.id));
  const ticks = el("div", { class: "qticks", id: "qHide" }, c.kids.map((k) => el("label", { class: "qtick" }, el("input", { type: "checkbox", value: k.id, checked: hide0.has(k.id) }), el("span", { text: k.title }))));
  const rows = { link: el("label", {}, el("span", { text: "Link" }), link), hide: el("div", { class: "qhide" }, el("span", { class: "meta", text: "Hidden" }), ticks) };
  const show = () => { const k = kind.value; rows.link.hidden = k !== "connect"; rows.hide.hidden = k !== "rebuild"; q.placeholder = k === "rebuild" ? REBUILD_Q : "Question"; };
  const body = el("div", { class: "qform" }, el("label", {}, el("span", { text: "Kind" }), kind), q, a, rows.link, rows.hide);
  show(); setTimeout(() => q.focus(), 0);
  q.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); q.form?.requestSubmit(); } });
  const ok = await dialog({ title: `${n.title}`, ok: "Save", body });
  if (!ok) return;
  const entry = { kind: kind.value, q: q.value.trim(), a: a.value.trim(), by: was?.by || "you", at: was?.at };
  if (entry.kind === "connect") entry.linkId = link.value;
  if (entry.kind === "rebuild") { entry.hide = [...ticks.querySelectorAll("input:checked")].map((x) => x.value); if (!entry.hide.length) return toast("Tick what to hide"); }
  else if (!entry.q) return toast("Write the question");
  const list = [...(n.qs || [])]; if (i >= 0 && list[i]) list[i] = entry; else list.push(entry);
  if (await safely(() => store.setQuestions(n.id, list))) afterQuestion();
}
async function deleteQuestion(n, i) {
  const before = S.byId.get(n.id) || n, list = [...(before.qs || [])]; if (!list[i]) return;
  list.splice(i, 1);
  if (!(await safely(() => store.setQuestions(n.id, list)))) return;
  await afterQuestion();
  toast("Question deleted", { label: "Undo", run: async () => { await safely(() => store.restoreRows({ nodes: [before] })); afterQuestion(); } });
}
// Bonsai Desktop: Claude writes a question for each idea in a graph that has none; he ticks which to keep.
const WRITE_MAX = 40;
async function writeQuestions(treeId) {
  const tree = treeOf(treeId); if (!tree) return;
  if (!desktop) return toast("Writing questions runs in Bonsai Desktop");
  const bad = liveProblem(await liveStatus()); if (bad) return toast(bad);
  const all = (S.byTree.get(tree.id) || []).filter((n) => !n.ghost && !(n.qs || []).length);
  if (!all.length) return toast("Every idea has a question");
  const pick = all.slice(0, WRITE_MAX), zone = S.zones.find((z) => z.id === tree.zoneId);
  const ideas = pick.map((n) => { const c = qctx(n); return { id: n.id, title: n.title, note: n.note || "", parent: S.byId.get(n.parentId)?.title || "", kids: c.kids.map((k) => ({ id: k.id, title: k.title })), links: c.links.map((l) => ({ id: l.id, other: l.other.title, label: l.label })) }; });
  const status = el("p", { class: "muted", id: "wqStatus", text: "Claude is writing" }), list = el("div", { class: "wqlist", id: "wqList" });
  let found = [];
  const body = el("div", { class: "wq" }, status, list);
  const job = askClaude(questionsPrompt({ topic: zone?.name || "", graph: tree.name, ideas })); let over = false;
  const done = dialog({ title: `Questions for ${tree.name}`, ok: "Keep", body });
  const okBtn = body.closest("form")?.querySelector("button.primary"); if (okBtn) okBtn.disabled = true;
  job.done.then((r) => {
    over = true; if (!body.isConnected) return;
    if (!r.ok) { status.textContent = r.code === "cancelled" ? "Stopped" : r.message || "Claude didn't answer"; return; }
    let read; try { read = readQuestions(r.text, ideas); } catch (e) { status.textContent = e.message; return; }
    found = read.list;
    status.textContent = "Nothing Bonsai could use"; status.hidden = !!found.length;
    put(list, found.map((f, k) => { const n = S.byId.get(f.id); return el("label", { class: "wqrow" }, el("input", { type: "checkbox", checked: true, dataset: { k } }),
      el("span", { class: "qkind", text: KIND_NAME[f.q.kind] }), el("span", { class: "wqbody" }, el("b", { text: f.q.q }), el("span", { class: "muted", text: [n?.title, f.q.kind === "rebuild" ? f.q.hide.map((id) => S.byId.get(id)?.title).join(", ") : f.q.a].filter(Boolean).join(" · ") }))); }));
    if (okBtn) okBtn.disabled = !found.length;
    okBtn?.focus();
  });
  const ok = await done;
  if (!over) job.cancel();
  if (!ok || !found.length) return;
  const keep = [...list.querySelectorAll("input:checked")].map((x) => found[+x.dataset.k]).filter(Boolean);
  if (!keep.length) return;
  const by = new Map(); for (const f of keep) { if (!by.has(f.id)) by.set(f.id, []); by.get(f.id).push(f.q); }
  const before = await safely(() => store.addQuestions([...by].map(([id, qs]) => ({ id, qs })))); if (!before) return;
  await afterQuestion();
  toast(`Kept ${keep.length} question${keep.length === 1 ? "" : "s"}`, { label: "Undo", run: async () => { await safely(() => store.restoreRows({ nodes: before })); afterQuestion(); } });
}

// ---------- oral ----------
// Watering by talking (Bonsai Desktop, card t-examport): Claude asks about the ideas waiting in a graph, one
// question at a time, shown and read aloud, and probes until it has heard enough; marks come only at the end.
// The same oral sits an exam: greyed ideas (not shown yet) are asked about too, and light up as Claude hears
// them. Saving: shown wakes a greyed idea or waters it (good), missed brings it back sooner (again). The prompts
// are the Bonsai Exams page's own (paper.js). Speak with the computer's dictation (Win+H on Windows).
const ORAL_IDEAS = 20;
const tts = () => (window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null);
const voiceOn = () => pref("voice", "1") !== "0";
function sayAloud(text) {
  const sp = tts(); if (!sp || !text) return;
  try {
    sp.cancel(); if (!voiceOn()) return;
    const vs = sp.getVoices?.() || [], en = vs.filter((v) => /^en[-_]/i.test(v.lang)), v = en.find((x) => /^en[-_](NZ|AU|GB)/i.test(x.lang)) || en.find((x) => x.default) || en[0];
    const u = new SpeechSynthesisUtterance(text); if (v) { u.voice = v; u.lang = v.lang; } sp.speak(u);
  } catch {}
}
const hush = () => { try { tts()?.cancel(); } catch {} };
const depthOf = (n) => { let d = 0, p = n; while (p?.parentId && d < 8) { p = S.byId.get(p.parentId); d++; } return d; };
// The JSON in a reply, wherever Claude put it.
function jsonIn(text) {
  const t = String(text || "").replace(/```(?:json)?/g, ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("Claude's reply had nothing Bonsai could read");
  return JSON.parse(t.slice(a, b + 1));
}
async function startOral(treeId, ids) {
  const tree = treeOf(treeId); if (!tree) return toast("Pick a graph first");
  if (!desktop) return toast("Orals run in Bonsai Desktop");
  const bad = liveProblem(await liveStatus()); if (bad) return toast(bad);
  const all = S.byTree.get(tree.id) || [], due = new Set(dueList(tree.id).map((n) => n.id));
  let pick = ids?.length ? ids.map((id) => S.byId.get(id)).filter(Boolean) : all.filter((n) => n.ghost || due.has(n.id));
  if (!pick.length) pick = all;   // nothing waiting: practise the whole graph
  pick = pick.slice(0, ORAL_IDEAS);
  const zone = S.zones.find((z) => z.id === tree.zoneId);
  const g = { name: tree.name, ideas: pick.map((n) => ({ key: n.id, title: n.title, note: (n.note || "").slice(0, 200), depth: depthOf(n), kind: "key" })) };
  S.review = null; S.panel = null;
  S.oral = { treeId: tree.id, g, m: { topic: zone?.name || tree.name, tier: tree.exam?.tier || "" }, turns: [], shown: [], lit: new Set(), q: oralOpen(g), max: Math.max(3, Math.min(12, pick.length + 1)), busy: "", marks: null };
  renderChrome(); sayAloud(S.oral.q); setTimeout(() => $("#oralAnswer")?.focus(), 50);
}
function stopOral() { const o = S.oral; if (!o) return; o.job?.cancel(); hush(); S.oral = null; refresh(); renderChrome(); }
function oralKey(k, stop) {
  const o = S.oral;
  if (k === "Enter") { stop(); return o.marks ? saveOralMarks() : sendOral(); }
  if (k === "f" && !o.marks && o.turns.length) { stop(); return finishOral(); }
  if (k === "r" && !o.marks) { stop(); return sayAloud(o.q); }
}
function oralAsk(prompt, label) {
  const o = S.oral; o.busy = label; renderOral();
  o.job = askClaude(prompt);
  return o.job.done.then((r) => {
    o.job = null; o.busy = ""; if (S.oral !== o) return null;
    if (!r.ok) { if (r.code !== "cancelled") toast(r.message || "Claude didn't answer"); renderOral(); return null; }
    return r.text;
  });
}
const ORAL_WHY = "I'm keeping what I've learnt fresh: these are ideas of mine due for review, or not shown yet. Find out which of them I still really understand.";
async function sendOral() {
  const o = S.oral, a = ($("#oralAnswer")?.value || "").trim();
  if (!o || o.busy) return; if (!a) return toast("Say or type an answer first");
  hush();
  const turns = [...o.turns, { q: o.q, a }];
  const back = () => { renderOral(); const t = $("#oralAnswer"); if (t) t.value = a; };
  const text = await oralAsk(oralPrompt(o.m, o.g, turns, { shown: o.shown, max: o.max, why: ORAL_WHY }), "Thinking");
  if (text == null) { if (S.oral === o) back(); return; }
  let r; try { r = readOral(jsonIn(text), o.g); } catch (e) { toast(e.message); return back(); }
  o.turns = turns; o.shown = r.shown; o.lit = new Set(r.shown); refresh();
  if (r.done || turns.length >= o.max) return finishOral();
  o.q = r.next; renderOral(); sayAloud(o.q); $("#oralAnswer")?.focus();
}
async function finishOral() {
  const o = S.oral; if (!o || o.busy) return; hush();
  const a = ($("#oralAnswer")?.value || "").trim(); if (a && !o.marks) o.turns.push({ q: o.q, a });
  if (!o.turns.length) return stopOral();
  const text = await oralAsk(oralMarkPrompt(o.m, o.g, o.turns), "Marking"); if (text == null) return;
  let r; try { r = readMarks(jsonIn(text), o.g.ideas.map((i) => i.key)); } catch (e) { return toast(e.message); }
  o.marks = o.g.ideas.map((i, k) => ({ id: i.key, title: i.title, shown: !!r.marks[k]?.shown, why: r.marks[k]?.why || "" })); o.feedback = r.feedback || "";
  o.lit = new Set(o.marks.filter((m) => m.shown).map((m) => m.id)); refresh(); renderOral();
}
async function saveOralMarks() {
  const o = S.oral; if (!o?.marks) return;
  const before = await safely(() => store.saveOral(o.marks)); if (!before) return;
  const ok = o.marks.filter((m) => m.shown).length, n = o.marks.length;
  S.oral = null; hush(); await refresh({ animate: true }); renderChrome();
  toast(`Oral: ${ok} of ${n} shown`, { label: "Undo", run: async () => { await safely(() => store.restoreRows({ nodes: before })); refresh(); } });
}
function renderOral() {
  const box = $("#review"), o = S.oral; if (!o) return;
  const tree = treeOf(o.treeId), b = (id, text, k, run, cls = "btn") => el("button", { class: cls, id, onclick: run }, text, k ? el("kbd", { text: k }) : null);
  box.hidden = false; box.classList.add("oral"); box.classList.remove("sunday");
  const head = el("div", { class: "row" }, el("span", { class: "muted grow", text: [tree?.name, o.marks ? "Marks" : `Question ${o.turns.length + 1}`].filter(Boolean).join(" › ") }), ib("oralClose", "Stop", ICON.close, stopOral));
  if (o.busy) return put(box, head, el("p", { class: "muted", id: "oralBusy", text: o.busy }), el("div", { class: "row" }, b("oralStop", "Stop", "Esc", () => (o.job ? o.job.cancel() : stopOral()))));
  if (o.marks) {
    const ok = o.marks.filter((m) => m.shown).length;
    return put(box, head, el("h2", { id: "oralScore", text: `${ok} / ${o.marks.length}` }), o.feedback ? el("p", { class: "muted", text: o.feedback }) : null,
      el("ul", { class: "oralmarks" }, o.marks.map((m) => el("li", { class: "mark" + (m.shown ? " shown" : "") + (m.changed ? " changed" : ""), title: "Click to change", onclick: () => { m.shown = !m.shown; m.changed = !m.changed; o.lit = new Set(o.marks.filter((x) => x.shown).map((x) => x.id)); refresh(); renderOral(); } },
        el("b", { text: (m.shown ? "✓ " : "✗ ") + m.title }), m.why ? el("span", { class: "muted", text: " " + m.why }) : null))),
      el("div", { class: "row" }, b("oralSave", "Save", "↵", saveOralMarks, "btn primary"), b("oralDiscard", "Discard", "Esc", stopOral)));
  }
  const ta = el("textarea", { id: "oralAnswer", rows: 3, placeholder: "Answer here. Win+H to speak. ↵ sends, ⇧↵ new line" });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); sendOral(); } });
  put(box, head, el("h2", { id: "oralQ", text: o.q }), ta,
    el("div", { class: "row" }, b("oralSend", "Send", "↵", sendOral, "btn primary"), tts() ? b("oralRepeat", "Repeat", "R", () => sayAloud(o.q)) : null,
      tts() ? el("button", { class: "btn", id: "oralVoice", onclick: () => { setPref("voice", voiceOn() ? "0" : "1"); voiceOn() ? sayAloud(o.q) : hush(); renderOral(); } }, voiceOn() ? "Voice on" : "Voice off") : null,
      o.turns.length ? b("oralFinish", "Finish", "F", finishOral) : null, el("span", { class: "grow" }), el("span", { class: "muted", id: "oralHeard", text: `${o.shown.length} of ${o.g.ideas.length} heard` })));
}

// ---------- sunday session ----------
// About ten minutes with Claude on the week (Bonsai Desktop): it knows what was added, edited and missed in
// watering (sunday.js `weekOf`), asks one question at a time like the oral (shown and read aloud; his answers are
// the patches), then proposes the stitch: links, note fixes, questions, ideas to bring back sooner. He ticks what
// to keep; ↵ saves it all in one go (store.saveSunday), with Undo. Offered quietly in the top bar on a Sunday
// until one is held that day; U or the menu any day. Each session is recorded in meta `sundays` (store.listSundays).
let sunClock = null;   // tests set the date (bonsai.sunday.setClock)
const clockNow = () => sunClock ?? Date.now();
const sundayDue = () => desktop && isSunday(clockNow()) && !S.sundays.some((r) => r.day === dayOf(clockNow()));
const sunBtn = () => (sundayDue() && !S.sun ? el("button", { class: "btn", id: "sundayGo", title: "Sunday session (U)", onclick: () => startSunday() }, "Sunday", el("kbd", { text: "U" })) : null);
async function startSunday() {
  if (S.sun) return;
  if (!desktop) return toast("Sunday sessions run in Bonsai Desktop");
  const bad = liveProblem(await liveStatus()); if (bad) return toast(bad);
  const at = clockNow(), events = await store.eventsSince(new Date(at - 7 * DAY).toISOString()).catch(() => []);
  const week = weekOf({ zones: S.allZones, trees: S.allTrees, nodes: S.nodes, events, links: S.links }, at);
  if (S.oral) stopOral(); S.review = null;
  S.sun = { week, at: new Date(at).toISOString(), day: dayOf(at), turns: [], q: sundayOpen(week), busy: "", stitch: null };
  renderChrome(); sayAloud(S.sun.q); setTimeout(() => $("#sunAnswer")?.focus(), 50);
}
async function stopSunday() {
  const u = S.sun; if (!u) return; u.job?.cancel(); hush(); S.sun = null;
  if (u.stitch) await safely(() => store.addSunday({ day: u.day, turns: u.turns, summary: u.stitch.summary, kept: tally([]), saved: false }));   // held, nothing kept
  await refresh(); renderChrome();
}
function sunAsk(prompt, label) {
  const u = S.sun; u.busy = label; renderSunday();
  u.job = askClaude(prompt);
  return u.job.done.then((r) => {
    u.job = null; u.busy = ""; if (S.sun !== u) return null;
    if (!r.ok) { if (r.code !== "cancelled") toast(r.message || "Claude didn't answer"); renderSunday(); return null; }
    return r.text;
  });
}
async function sendSunday() {
  const u = S.sun, a = ($("#sunAnswer")?.value || "").trim();
  if (!u || u.busy || u.stitch) return; if (!a) return toast("Say or type an answer first");
  hush();
  const turns = [...u.turns, { q: u.q, a }];
  const back = () => { renderSunday(); const t = $("#sunAnswer"); if (t) t.value = a; };
  const text = await sunAsk(sundayPrompt(u.week, turns), "Thinking");
  if (text == null) { if (S.sun === u) back(); return; }
  let r; try { r = readTurn(jsonIn(text)); } catch (e) { toast(e.message); return back(); }
  u.turns = turns;
  if (r.done || turns.length >= SUNDAY_MAX) return stitchSunday();
  u.q = r.next; renderSunday(); sayAloud(u.q); $("#sunAnswer")?.focus();
}
async function stitchSunday() {
  const u = S.sun; if (!u || u.busy) return; hush();
  const a = ($("#sunAnswer")?.value || "").trim(); if (a && !u.stitch) u.turns.push({ q: u.q, a });
  if (!u.turns.length) return stopSunday();
  const text = await sunAsk(stitchPrompt(u.week, u.turns), "Stitching"); if (text == null) return;
  try { u.stitch = readStitch(jsonIn(text), u.week); } catch (e) { return toast(e.message); }
  renderSunday();
}
async function saveSundayStitch() {
  const u = S.sun; if (!u?.stitch || u.busy) return;
  const kept = u.stitch.items.filter((x) => x.on), sum = tally(kept);
  const made = await safely(() => store.saveSunday(kept, { day: u.day, turns: u.turns, summary: u.stitch.summary, kept: sum })); if (!made) return;
  S.sun = null; hush(); await refresh({ animate: true }); renderChrome();
  const said = [sum.links && `${sum.links} link${sum.links === 1 ? "" : "s"}`, sum.notes && `${sum.notes} note${sum.notes === 1 ? "" : "s"}`, sum.questions && `${sum.questions} question${sum.questions === 1 ? "" : "s"}`, sum.fuzzy && `${sum.fuzzy} sooner`].filter(Boolean).join(", ");
  toast(`Stitched${said ? ": " + said : ""}`, { label: "Undo", run: async () => { await safely(() => store.undoSunday(made)); await refresh(); renderChrome(); } });
}
function sunKey(k, stop) {
  const u = S.sun;
  if (k === "Enter") { stop(); return u.stitch ? saveSundayStitch() : sendSunday(); }
  if (u.stitch && /^[1-9]$/.test(k)) { stop(); const x = u.stitch.items[+k - 1]; if (x) { x.on = !x.on; renderSunday(); } return; }
  if (k === "f" && !u.stitch && u.turns.length) { stop(); return stitchSunday(); }
  if (k === "r" && !u.stitch) { stop(); return sayAloud(u.q); }
}
const ideaName = (id) => S.byId.get(id)?.title || "?";
function stitchRow(x, i) {
  const k = i < 9 ? el("kbd", { text: String(i + 1) }) : null;
  const body = x.kind === "link" ? [el("b", { text: `${ideaName(x.a)} ↔ ${ideaName(x.b)}` }), x.label ? el("span", { class: "muted", text: " " + x.label }) : null]
    : x.kind === "note" ? [el("b", { text: ideaName(x.id) }), el("span", { class: "muted", text: x.mode === "replace" ? " → " : " + " }), el("span", { text: x.text })]
    : x.kind === "question" ? [el("b", { text: ideaName(x.id) }), el("span", { class: "muted", text: ` ${x.qk} ` }), el("span", { text: x.q })]
    : [el("b", { text: ideaName(x.id) })];
  return el("li", { class: "mark" + (x.on ? " shown" : ""), dataset: { kind: x.kind }, title: x.kind === "question" && x.a ? x.a : "", onclick: () => { x.on = !x.on; renderSunday(); } },
    el("span", { class: "tick", text: x.on ? "✓" : "" }), el("span", { class: "grow" }, ...body), k);
}
function renderSunday() {
  const box = $("#review"), u = S.sun; if (!u) return;
  const b = (id, text, k, run, cls = "btn") => el("button", { class: cls, id, onclick: run }, text, k ? el("kbd", { text: k }) : null);
  box.hidden = false; box.classList.add("oral", "sunday");
  const head = el("div", { class: "row" }, el("span", { class: "muted grow", text: ["Sunday", u.stitch ? "Stitch" : `Question ${u.turns.length + 1}`].join(" › ") }),
    el("span", { class: "muted", id: "sunWeek", text: `${u.week.addedCount} added · ${u.week.missedCount} missed` }), ib("sunClose", "Stop", ICON.close, stopSunday));
  if (u.busy) return put(box, head, el("p", { class: "muted", id: "sunBusy", text: u.busy }), el("div", { class: "row" }, b("sunStop", "Stop", "Esc", () => (u.job ? u.job.cancel() : stopSunday()))));
  if (u.stitch) {
    const groups = [["link", "Links"], ["note", "Notes"], ["question", "Questions"], ["fuzzy", "Sooner"]], items = u.stitch.items;
    return put(box, head, u.stitch.summary ? el("h2", { id: "sunSummary", text: u.stitch.summary }) : null,
      el("div", { class: "sunstitch", id: "sunStitch" }, items.length ? groups.map(([kind, name]) => {
        const xs = items.map((x, i) => [x, i]).filter(([x]) => x.kind === kind); if (!xs.length) return null;
        return el("section", {}, el("h3", { text: name }), el("ul", { class: "oralmarks" }, xs.map(([x, i]) => stitchRow(x, i))));
      }) : el("p", { class: "muted", text: "Nothing to stitch" })),
      el("div", { class: "row" }, b("sunSave", "Save", "↵", saveSundayStitch, "btn primary"), b("sunDiscard", "Discard", "Esc", stopSunday)));
  }
  const ta = el("textarea", { id: "sunAnswer", rows: 3, placeholder: "Answer here. Win+H to speak. ↵ sends, ⇧↵ new line" });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); sendSunday(); } });
  put(box, head, el("h2", { id: "sunQ", text: u.q }), ta,
    el("div", { class: "row" }, b("sunSend", "Send", "↵", sendSunday, "btn primary"), tts() ? b("sunRepeat", "Repeat", "R", () => sayAloud(u.q)) : null,
      tts() ? el("button", { class: "btn", id: "sunVoice", onclick: () => { setPref("voice", voiceOn() ? "0" : "1"); voiceOn() ? sayAloud(u.q) : hush(); renderSunday(); } }, voiceOn() ? "Voice on" : "Voice off") : null,
      u.turns.length ? b("sunFinish", "Stitch", "F", stitchSunday) : null, el("span", { class: "grow" }), el("span", { class: "muted", text: `${u.turns.length + 1} / ${SUNDAY_MAX}` })));
}

// ---------- timelapse ----------
// One slider for the past (T), in the garden and in Knowledge, docked in the bottom bar. The garden is drawn from
// history.at(t) (src/history.js): topics come as they were made, plots grow and dry as they did; nothing is written.
// Knowledge keeps its cut (S.cutoff): what was made after t is left out. A month plays in about 10 s; longer spans
// go a little faster per month. Ticks mark Sundays and big days (an exam brought in, a large Grow, many new ideas).
// ⇧T records a play-through of what's showing as a video and offers the file.
let tlSecs = null, tlRaf = 0, tlLast = 0;   // tlSecs: a set play length, for tests
const tlWhere = () => (S.view === "isles" ? "garden" : S.view === "forest" || S.view === "tree" ? "knowledge" : null);
const tlPast = () => (S.tl?.where === "garden" && S.tl.t < S.tl.max ? S.tl.past : null);
const tlLength = (tl) => tlSecs ?? Math.min(40, Math.max(4, 10 * Math.sqrt((tl.max - tl.min) / (30 * DAY))));
const tlDate = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(new Date(t).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
const tlToggle = () => (S.tl ? tlClose() : tlOpen());
const below = (xs, t) => { let lo = 0, hi = xs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] <= t) lo = m + 1; else hi = m; } return lo; };
async function tlOpen() {
  const where = tlWhere(); if (!where || S.tl) return;
  const events = await store.listEvents().catch(() => []);
  if (S.tl || tlWhere() !== where) return;
  const hist = createHistory({ zones: S.allZones, trees: S.allTrees, nodes: S.nodes, links: S.links, events, pages: S.pages }), max = Date.now();
  // Knowledge reads its range as before: from the first topic or graph (in a graph, the graph) to now
  const xs = where === "garden" ? [] : S.view === "tree" ? [S.tree, ...(S.byTree.get(S.tree.id) || [])] : [...S.zones, ...S.trees];
  const min = where === "garden" ? hist.min : Math.min(max - 1000, ...xs.map((x) => Date.parse(x.createdAt)));
  const times = where === "garden" ? [] : (S.view === "tree" ? S.byTree.get(S.tree.id) || [] : [...S.zones, ...S.trees, ...S.nodes]).map((x) => Date.parse(x.createdAt)).sort((a, b) => a - b);
  S.tl = { where, hist, min, max, t: max, playing: false, ticks: hist.ticks(min, max), times, sig: null, dirty: false, drawn: 0, past: null, ui: null, rec: null };
  if (where === "knowledge") { S.cutoff = max; S.panel = null; S.quick = null; S.review = null; S.tl.sig = below(times, max); rebuild(); }
  else if (S.topic >= 0) pickTopic(-1);
  renderChrome(); tlLoop();
}
// quiet: when go() is about to draw everything again anyway
function tlClose(quiet = false) {
  const tl = S.tl; if (!tl) return;
  tlRecStop(false); S.tl = null; cancelAnimationFrame(tlRaf);
  if (quiet) return;
  if (tl.where === "knowledge") { S.cutoff = null; rebuild(); } else if (S.view === "isles") drawIsles();
  renderChrome();
}
// now: draw at once (scrubbing), else on the next frame
function tlSet(t, now = false) {
  const tl = S.tl; if (!tl) return;
  tl.t = Math.max(tl.min, Math.min(tl.max, t)); tl.dirty = true;
  if (now && !(tl.where === "garden" && isles?.busy)) tlDraw(performance.now()); else tlPaint();
}
function tlPlay(on = !S.tl?.playing) {
  const tl = S.tl; if (!tl) return;
  if (on && tl.t >= tl.max - 1) tlSet(tl.min, true);
  tl.playing = on; tlLast = 0; tlPaint();
}
function tlStep(k, shift) {
  const tl = S.tl, d = k === "ArrowRight" ? 1 : -1; tl.playing = false;
  if (!shift) return tlSet(tl.t + d * DAY, true);
  const next = d > 0 ? tl.ticks.find((x) => x.at > tl.t + 1000) : [...tl.ticks].reverse().find((x) => x.at < tl.t - 1000);
  tlSet(next ? next.at : d > 0 ? tl.max : tl.min, true);
}
function tlLoop() {
  cancelAnimationFrame(tlRaf); tlLast = 0;
  const step = (now) => {
    const tl = S.tl; if (!tl) return;
    if (tl.playing) {
      const dt = tlLast ? Math.min(0.1, (now - tlLast) / 1000) : 0;
      let t = tl.t + (dt * (tl.max - tl.min)) / tlLength(tl);
      if (t >= tl.max) { t = tl.max; tl.playing = false; if (tl.rec) tlRecFinish(tl); }
      tlSet(t);
    }
    tlLast = now;
    // the garden rebuilds an island a frame; the next step waits until they are all done
    if (tl.dirty && now - tl.drawn > (tl.playing ? 90 : 30) && !(tl.where === "garden" && isles?.busy)) tlDraw(now);
    tlRaf = requestAnimationFrame(step);
  };
  tlRaf = requestAnimationFrame(step);
}
function tlDraw(now) {
  const tl = S.tl; tl.drawn = now; tl.dirty = false;
  if (tl.where === "knowledge") {
    S.cutoff = tl.t; const n = below(tl.times, tl.t);
    if (n !== tl.sig) { tl.sig = n; rebuild(); }
    return tlPaint();
  }
  tl.past = tl.t < tl.max ? tl.hist.at(tl.t) : null;
  const model = gardenModel(tl.past), sig = JSON.stringify([model.map((q) => q.topics.map((x) => [x.id, Math.round(x.growth * 20), Math.round(x.health * 20), x.mist])), tl.past?.links.length]);
  if (sig !== tl.sig) { tl.sig = sig; drawIsles(model); }
  tlPaint();
}
function tlPaint() {
  const tl = S.tl, ui = tl?.ui; if (!ui) return;
  ui.range.value = tl.t; ui.range.style.setProperty("--p", ((tl.t - tl.min) / Math.max(1, tl.max - tl.min)) * 100 + "%");
  const n = tl.where === "garden" ? tl.hist.count(tl.t) : S.view === "tree" ? shownNodes(S.tree).length : S.flora?.ids.length || 0;
  ui.label.textContent = `${tlDate(tl.t)} · ${n}`;
  if (ui.playing !== tl.playing) { ui.playing = tl.playing; ui.play.replaceChildren(icon(tl.playing ? ICON.pause : ICON.play), el("kbd", { text: "Space" })); ui.play.title = tl.playing ? "Pause (Space)" : "Play (Space)"; ui.play.setAttribute("aria-label", tl.playing ? "Pause" : "Play"); }
  ui.video.classList.toggle("on", !!tl.rec); ui.video.setAttribute("aria-pressed", String(!!tl.rec));
}
const TICK = { sunday: "Sunday", exam: "Exam", grow: "Grow", big: "" };
function renderTimeline() {
  const bar = $("#timeline"), tl = S.tl;
  if (!tl) { bar.hidden = true; bar.replaceChildren(); return; }
  if (tl.ui && bar.contains(tl.ui.range)) { bar.hidden = false; return tlPaint(); }
  const range = el("input", { type: "range", id: "timeRange", min: tl.min, max: tl.max, step: Math.max(1, Math.round((tl.max - tl.min) / 2000)), value: tl.t, "aria-label": "Time" });
  range.addEventListener("input", () => { tl.playing = false; tlSet(+range.value, true); });
  for (const ev of ["change", "pointerup"]) range.addEventListener(ev, () => range.blur());   // keys stay with the timelapse, not the slider
  const pos = (at) => ((at - tl.min) / Math.max(1, tl.max - tl.min)) * 100;
  const tip = (k) => `${tlDate(k.at)}${TICK[k.kind] ? " · " + TICK[k.kind] : ""}${k.n && k.kind !== "sunday" ? ` · ${k.n}` : ""}`;
  const ticks = el("div", { class: "tticks" }, tl.ticks.map((k) => el("button", { class: "tick " + k.kind, type: "button", tabIndex: -1, style: `left:${pos(k.at)}%`, title: tip(k), "aria-label": tip(k), onclick: () => { tl.playing = false; tlSet(k.at, true); } })));
  const keyed = (id, label, d, key, run) => el("button", { class: "ib keyed", id, type: "button", title: `${label} (${key})`, "aria-label": label, onclick: run }, icon(d), el("kbd", { text: key }));
  tl.ui = { range, label: el("span", { class: "when", id: "timeWhen" }), play: keyed("timePlay", "Play", ICON.play, "Space", () => tlPlay()), video: keyed("timeVideo", "Save as video", ICON.video, "⇧T", tlVideo), playing: false };
  put(bar, tl.ui.play, el("kbd", { class: "tstep", title: "A day back or on; with Shift, the marks", text: "← →" }), el("div", { class: "tlrail" }, range, ticks), tl.ui.label, tl.ui.video, closeBtn("timeClose", "Back to now", "Esc", () => tlClose()));
  bar.hidden = false; tlPaint();
}
// ⇧T: plays the timelapse from the start and records what's showing, then offers the file (webm where the browser makes it)
function tlVideo() {
  if (S.tl?.rec) return tlRecStop(false);
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) return toast("Video isn't available here");
  if (!S.tl) return tlOpen().then(() => S.tl && tlVideo());
  const tl = S.tl, garden = tl.where === "garden", src = garden ? $("#igl") : $("#gl");
  const k = Math.min(1, 1920 / Math.max(1, src.width)), cv = document.createElement("canvas");
  cv.width = Math.max(2, Math.round((src.width * k) / 2) * 2); cv.height = Math.max(2, Math.round((src.height * k) / 2) * 2);
  const ctx = cv.getContext("2d"), w = cv.width, h = cv.height, font = getComputedStyle(document.body).fontFamily;
  const sky = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.hypot(w / 2, h * 0.58));   // the garden's backdrop, as in .isles
  const night = isles?.night; sky.addColorStop(0, night ? "#141a3a" : "#252a45"); sky.addColorStop(0.75, night ? "#05060c" : "#12141f"); sky.addColorStop(1, night ? "#05060c" : "#12141f");
  const draw = () => {
    if (garden) { ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h); ctx.drawImage($("#sky"), 0, 0, w, h); }
    ctx.drawImage(src, 0, 0, w, h);
    const px = Math.max(12, Math.round(h / 34));
    ctx.font = `600 ${px}px ${font}`; ctx.fillStyle = garden || document.body.classList.contains("night-ui") ? "rgba(255,255,255,.85)" : "rgba(29,29,27,.85)";
    ctx.fillText(tlDate(S.tl?.t ?? Date.now()), px, h - px);
  };
  const keep = () => true, stream = cv.captureStream(30);
  const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((x) => MediaRecorder.isTypeSupported(x)) || "";
  let rec; try { rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 8e6 }); } catch { return toast("Video isn't available here"); }
  const chunks = [], r = { rec, keep: false };
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    if (garden) { if (isles) isles.onFrame = null; } else { stage.onRender = null; stage.tickers.delete(keep); }
    stream.getTracks().forEach((x) => x.stop());
    if (!r.keep || !chunks.length) return;
    const blob = (S.tlVideo = new Blob(chunks, { type: rec.mimeType || type || "video/webm" }));
    const a = el("a", { href: URL.createObjectURL(blob), download: `bonsai-timelapse-${new Date().toISOString().slice(0, 10)}.${/mp4/.test(blob.type) ? "mp4" : "webm"}` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast("Video saved");
  };
  if (garden) isles.onFrame = draw; else { stage.onRender = draw; stage.tickers.add(keep); stage.invalidate(); }
  tl.rec = r; rec.start(500); draw();
  tlSet(tl.min, true); tl.playing = true; tlLast = 0; tlPaint();
}
// the end reached: wait for the last islands to be built, hold a moment, then stop and keep the file
function tlRecFinish(tl, tries = 0) {
  if (S.tl !== tl || !tl.rec) return;
  if ((tl.dirty || (tl.where === "garden" && isles?.busy)) && tries < 60) { setTimeout(() => tlRecFinish(tl, tries + 1), 200); return; }
  setTimeout(() => { if (S.tl === tl && tl.rec) tlRecStop(true); }, 900);
}
function tlRecStop(keep) {
  const r = S.tl?.rec; if (!r) return;
  S.tl.rec = null; r.keep = keep;
  try { r.rec.stop(); } catch {}
  tlPaint();
}

// ---------- empty forest ----------
// ---------- the garden: islands of topics ----------
const BIOMES = [["highland", "Highlands"], ["tropical", "Jungle"], ["bloom", "Blossom"], ["lantern", "Lantern trees"], ["glowcap", "Mushrooms"], ["fern", "Ferns"]];
const CENTRES = [["arches", "Stone arches"], ["academy", "Academy"], ["amphitheatre", "Amphitheatre"], ["statue", "Statue"]];
const MARKS = MARK_LIST;
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
// (o.fill, beta only: the demo's Workshop topics count as fuller than they are, to show every landmark tier)
function gardenModel(past = null) {
  // past (timelapse): history.at(t), the garden as it was then; topics not there yet are left out, an island with none is bare rock
  const zone = new Map(S.zones.map((z) => [z.id, z])), now = past ? past.t : Date.now(), hubs = hubsOf(S.garden), at = new Map(hubs.map((h, k) => [h.id, k]));
  const marks = assignMarks(S.garden.islands.flatMap((isl) => isl.zoneIds).map((id) => zone.get(id)).filter(Boolean).map((z) => ({ id: z.id, name: z.name, picked: S.garden.zone[z.id]?.mark })));   // no two topics share a guessed landmark
  const ideasOf = (t) => (past ? past.byTree.get(t.id) || [] : S.byTree.get(t.id) || []).filter((n) => !n.ghost), kidN = (n) => (past ? past.kids.get(n.id) || 0 : kidsOf(n.id).length);
  const model = S.garden.islands.map((isl, i) => {
    const topics = isl.zoneIds.map((id) => zone.get(id)).filter(Boolean).map((z, k) => [z, k]).filter(([z]) => !past || past.zones.has(z.id)).map(([z, k]) => {
      const trees = S.trees.filter((t) => t.zoneId === z.id && (!past || past.trees.has(t.id))), nodes = trees.flatMap(ideasOf), rev = nodes.filter((n) => srs.reviewable(n, kidN(n))), o = S.garden.zone[z.id] || {};
      const level = zoneLevel(z.id), due = level === "settled" ? [] : rev.filter((n) => srs.isDue(n, now, focus.multOf(level)));   // Settled never withers; Keep's waiting ideas weigh half
      // the demo's pretend ideas grow in step with the real ones
      const fill = CHANNEL && o.fill ? (past ? Math.round(o.fill * nodes.length / Math.max(1, S.trees.filter((t) => t.zoneId === z.id).flatMap((t) => S.byTree.get(t.id) || []).filter((n) => !n.ghost).length)) : o.fill) : 0;
      return { id: z.id, name: z.name, level, biome: o.biome || BIOMES[k % 6][0], mark: marks.get(z.id), growth: Math.min(2, Math.pow((nodes.length + fill) / FULL_PLOT, 0.6)), health: rev.length ? 1 - (focus.weightOf(level) * due.length) / rev.length : 1, ideas: nodes.length, mist: !nodes.length && charted(), due: past ? [] : due.map((n) => n.id), trees };
    });
    if (!topics.length) topics.push({ id: null, name: "", biome: "bloom", mark: "kit", growth: 0.04, health: 1, ideas: 0, mist: !past && charted(), due: [], trees: [] });
    return { id: isl.id, name: isl.name, hub: at.get(hubKey(isl)) || 0, landmark: isl.landmark, patron: i === 0 && isl.landmark === "arches" ? S.garden.patron || "none" : undefined, mountain: isl.landmark === "arches" || !!isl.mountain, topics };
  });
  S.hubs = hubs.map((h, k) => ({ id: h.id, name: h.name, isles: model.map((q, i) => (q.hub === k ? i : -1)).filter((i) => i >= 0) }));
  return model;
}
const multi = () => (S.garden?.hubs?.length || 0) > 1, charted = () => !!S.garden?.mapAt;   // mist only means something once a map says what should be there
// How many links run between ideas on two different islands; the garden widens those bridges.
function crossLinks(links = S.links) {
  const where = new Map(); S.model.forEach((isl) => isl.topics.forEach((t) => where.set(t.id, isl.id)));
  const isleOf = (nodeId) => where.get(treeOf(S.byId.get(nodeId)?.treeId)?.zoneId), n = new Map();
  for (const l of links) { const a = isleOf(l.fromId), b = isleOf(l.toId); if (a && b && a !== b) { const k = [a, b].sort().join("|"); n.set(k, (n.get(k) || 0) + 1); } }
  return [...n].map(([k, c]) => [...k.split("|"), c]);
}
function showWindow(garden, flat = false, notes = false) {
  $("#notes").hidden = !notes; if (!notes) $("#notes").replaceChildren(); flat ||= notes;
  $("#stage").hidden = garden || flat; $("#isles").hidden = !garden; $("#tech").hidden = !flat || notes; if (!flat || notes) { tech?.setActive(false); document.body.classList.toggle("night-ui", !garden && !notes && techNight()); } $("#gpanel").hidden = !garden; document.body.dataset.window = garden ? "garden" : notes ? "notes" : "";
  if (!garden) { isles?.setActive(false); stage.resize(); }   // the stage has no size while hidden; measure it again before anything is framed
  if (!garden && !flat) retheme();
}
// The garden's renderer, made when first needed: by the garden, or by the tech tree for its pictures.
function ensureIsles() {
  if (isles) return isles;
  try { isles = createIsles({ canvas: $("#igl"), sky: $("#sky"), tags: $("#tags"), quality: pref("detail", matchMedia("(pointer: coarse)").matches ? "low" : "medium"), onIsland: (i) => pickIsle(i), onHub: (h) => pickHub(h), onTopic: (i, k) => { if (S.isle !== i) pickIsle(i); pickTopic(k); }, onReady: () => { document.body.dataset.isles = "ready"; } }); }
  catch { return null; }
  isles.setNight(pref("night", "") === "1"); $("#isles").classList.toggle("night", isles.night);
  return isles;
}
// to an island or a topic in the garden, from anywhere (already there: straight to it)
function toGarden({ isle, topic }) {
  S.pendingIsle = isle || null; S.pendingTopic = topic || null;
  if (S.view === "isles") { if (topic) { goTopic(topic); S.pendingTopic = null; } if (isle) { const i = S.model.findIndex((q) => q.id === isle); S.pendingIsle = null; if (i >= 0) pickIsle(i); } return; }
  location.hash = "#/";
}
function showIsles() {
  S.view = "isles"; S.tree = null; S.sel = null; S.lay = null; S.panel = null; clearScene();
  if (!ensureIsles()) { location.hash = "#/forest"; return; }
  isles.setActive(true); drawIsles(); renderChrome();
  if (S.pendingTopic) { goTopic(S.pendingTopic); S.pendingTopic = null; }
  if (S.pendingIsle) { const i = S.model.findIndex((q) => q.id === S.pendingIsle); S.pendingIsle = null; if (i >= 0) pickIsle(i); }
}
function drawIsles(model) {
  const was = S.model[S.isle]?.id, wasHub = S.hubs[S.hub]?.id, past = tlPast();
  S.model = model || gardenModel(past);
  if (was != null && S.model[S.isle]?.id !== was) { S.isle = S.model.findIndex((q) => q.id === was); if (S.isle < 0) S.topic = -1; }
  if (wasHub != null && S.hubs[S.hub]?.id !== wasHub) S.hub = S.hubs.findIndex((h) => h.id === wasHub);
  if (S.isle >= S.model.length) { S.isle = -1; S.topic = -1; }
  if (S.isle >= 0 && S.topic >= S.model[S.isle].topics.length) S.topic = -1;
  if (!multi() || S.hub >= S.hubs.length) S.hub = -1;
  if (S.isle >= 0) S.hub = multi() ? S.model[S.isle].hub : -1;
  isles.setData(S.model, crossLinks(past?.links), S.hubs); isles.select(S.topic); renderGarden();
}
// Stepping in: every hub, then one hub, then one island, then one topic. A garden with a single hub skips the hub step.
function pickHub(h) { S.hub = multi() && S.hubs[h] ? h : -1; S.isle = -1; S.topic = -1; isles.focusHub(S.hub); isles.select(-1); renderGarden(); }
function pickIsle(i) {
  if (!S.model[i]) { S.isle = -1; S.topic = -1; if (S.hub >= 0) isles.focusHub(S.hub); else isles.focus(-1); isles.select(-1); return renderGarden(); }
  S.isle = i; S.hub = multi() ? S.model[i].hub : -1; S.topic = -1; isles.focus(i); isles.select(-1); renderGarden();
}
function pickTopic(k) { const t = S.model[S.isle]?.topics[k]; S.topic = t && t.id ? k : -1; isles.select(S.topic); renderGarden(); }
const goTopic = (zoneId) => { const i = S.model.findIndex((isl) => isl.topics.some((t) => t.id === zoneId)); if (i < 0) return; if (S.isle !== i) pickIsle(i); pickTopic(S.model[i].topics.findIndex((t) => t.id === zoneId)); };
// Watering happens where you are (the watering screen went in 0.28.0): the cards come up over the garden, the
// knowledge view, a graph or its board; in a graph each idea is picked and flown to as it comes up.
function water(ids, treeId) { const q = ids || (treeId ? dueList(treeId) : dueList(null)).map((n) => n.id); if (treeId) S.fsel = treeId; reviewIds(q); }
// ---------- focus levels ----------
// How hard a topic is kept (focus.js): Focus, normal intervals; Keep, about twice as long, and what waits weighs half
// on the garden; Settled, four times as long, never withers and stays out of watering rounds. An island sets the
// level of its topics; a topic can take its own and then keeps it. An exam topic starts at Keep.
const RANK = { focus: 0, keep: 1, settled: 2 };
const examZones = () => new Set(S.trees.filter((t) => t.exam).map((t) => t.zoneId));
function readLevels() {
  S.levels = focus.levelMap(S.garden, S.zones.map((z) => z.id), examZones());
  S.treeLevel = new Map(S.trees.map((t) => [t.id, S.levels.get(t.zoneId) || "focus"]));
}
const zoneLevel = (id) => S.levels?.get(id) || "focus";
const levelOfNode = (n) => S.treeLevel?.get(n.treeId) || "focus";
// Every idea due now, by level, oldest first: Settled ones (due on their stretched dates) are the pool a morning
// recall can draw a rare bonus question from.
function dueByLevel(now = Date.now()) {
  const live = new Set(S.trees.map((t) => t.id)), items = [];
  for (const n of S.nodes) {
    if (!live.has(n.treeId) || !srs.reviewable(n, kidsOf(n.id).length)) continue;
    const level = levelOfNode(n), due = Date.parse(srs.dueAt(n, focus.multOf(level)));
    if (due <= now) items.push({ node: n, level, due });
  }
  return focus.byLevel(items);
}
// zoneId: the topic's own level (level null: follow its island again); else the island's.
async function setLevel({ isleId, zoneId, level }) {
  focus.setLevel(S.garden, { isleId, zoneId, level, exam: !!zoneId && examZones().has(zoneId) });
  await saveGarden();
}
// The row at the foot of the garden panel. A topic shows Island while it follows (its island's level is marked).
function levelRow(isl, t) {
  const opts = focus.LEVELS.map((v) => [v, focus.NAMES[v]]);
  let now, via = null, run;
  if (t) {
    const own = focus.ownLevel(t.id, S.garden, examZones().has(t.id));
    now = own || "isle"; via = own ? null : focus.isleLevel(isl); opts.unshift(["isle", "Island"]);
    run = (v) => setLevel({ zoneId: t.id, level: v === "isle" ? null : v });
  } else { now = focus.isleLevel(isl); run = (v) => setLevel({ isleId: isl.id, level: v }); }
  return el("div", { class: "gsrow", id: "levelRow" }, el("span", {}, "Level ", el("kbd", { text: t ? "⇧0–3" : "⇧1–3" })),
    el("div", { class: "seg lvseg", role: "group", "aria-label": "Level", id: t ? "topicLevel" : "isleLevel" },
      opts.map(([v, text]) => el("button", { text, dataset: v === via ? { level: v, via: "1" } : { level: v }, "aria-pressed": String(v === now), onclick: () => run(v) }))));
}
// In the garden, ⇧1–3 set what's picked to Focus, Keep, Settled; ⇧0 sends a topic back to its island's level.
function levelKey(e) {
  if (S.view !== "isles" || !e.shiftKey || !/^Digit[0-3]$/.test(e.code || "")) return false;
  const isl = S.garden.islands[S.isle], t = S.model[S.isle]?.topics[S.topic], d = +e.code.slice(5);
  if (!isl || (!t?.id && d === 0)) return false;
  e.preventDefault();
  setLevel(t?.id ? { zoneId: t.id, level: d ? focus.LEVELS[d - 1] : null } : { isleId: isl.id, level: focus.LEVELS[d - 1] });
  return true;
}
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
  const head = (back, h, more) => el("div", { class: "ph gph" }, back ? el("button", { class: "ib keyed", id: "gBack", type: "button", title: "Back (Esc)", "aria-label": "Back", onclick: back }, icon(ICON.back), el("kbd", { text: "Esc" })) : null, h, more);
  const pickRow = (id, label, opts, now, set) => el("label", { class: "gsrow" }, el("span", { text: label }), el("select", { id, onchange: (e) => set(e.target.value) }, opts.map(([v, text]) => el("option", { value: v, text, selected: v === now }))));
  if (t) {
    const due = t.due.length, o = (S.garden.zone[t.id] ||= {});
    put(box, head(() => pickTopic(-1), name(t.name, async (v) => { if (await safely(() => store.updateZone(t.id, { name: v }))) refresh(); }), ib("topicMore", "Move to island", ICON.more, (e) => topicMenu(t, e.currentTarget))),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, due ? act("waterTopic", `Water ${due}`, "W", () => water(t.due), true) : null, act("newGraph", "New knowledge graph", "N", () => newGraph(t.id), !due), act("scopeGraphs", "Knowledge graphs", "⇧Tab", () => openScope(t.id)), act("topicMap", "Meaning map", "M", () => goMeaning(t.id)), act("techBtn", "Tech tree", "K", openTech), t.growth >= 2 ? act("splitTopic", "Split", "S", () => splitTopic(t)) : null)),
      el("div", { class: "stats" }, el("span", {}, el("b", { text: String(t.ideas) }), ` idea${t.ideas === 1 ? "" : "s"}`), el("span", {}, el("b", { text: pct(t.growth) }), " grown"), el("span", {}, el("b", { text: pct(t.health) }), " healthy")),
      el("h3", { text: "Knowledge graphs" }),
      t.trees.length ? el("div", { class: "rows" }, t.trees.map((tr, k) => { const n = (S.byTree.get(tr.id) || []).length; return row(k < 9 ? String(k + 1) : "", tr.name, `${n} idea${n === 1 ? "" : "s"}`, dueList(tr.id).length, () => goTree(tr.id)); })) : el("p", { class: "muted", text: "None yet." }),
      el("div", { class: "gset" }, levelRow(S.garden.islands[S.isle], t), pickRow("topicBiome", "Biome", BIOMES, t.biome, (v) => { o.biome = v; saveGarden(); }), pickRow("topicMark", "Landmark", MARKS, t.mark, (v) => { o.mark = v; saveGarden(); })));
  } else if (isl) {
    const rec = S.garden.islands[S.isle], items = isleItems(S.isle);
    put(box, head(() => pickIsle(-1), name(isl.name, rec.mapId ? null : (v) => { rec.name = v; saveGarden(); }), items.length ? ib("isleMore", "Island menu", ICON.more, (e) => isleMenu(S.isle, e.currentTarget)) : null),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, act("newTopic", "New topic", "Z", newZone, true), act("scopeGraphs", "Knowledge graphs", "⇧Tab", () => openScope(isl.id)), act("isleTech", "Tech tree", "K", openTech))),
      el("h3", { text: "Topics" }),
      isl.topics[0].id ? el("div", { class: "rows" }, isl.topics.map((q, k) => row(String(k + 1), q.name, pct(q.growth), q.due.length, () => pickTopic(k)))) : el("p", { class: "muted", text: "No topics here yet." }),
      el("div", { class: "gset" }, levelRow(rec, null),
        rec.mapId ? null : pickRow("isleCentre", "Centrepiece", CENTRES, rec.landmark, (v) => { rec.landmark = v; saveGarden(); }),
        S.isle === 0 && rec.landmark === "arches" ? pickRow("islePatron", "Figure", [["none", "None"], ["athena", "Athena"], ["saraswati", "Saraswati"]], S.garden.patron || "none", (v) => { S.garden.patron = v; saveGarden(); }) : null,
        rec.landmark !== "arches" ? el("label", { class: "gsrow" }, el("span", { text: "Mountain" }), el("input", { type: "checkbox", id: "isleMountain", checked: !!rec.mountain, onchange: (e) => { rec.mountain = e.target.checked; saveGarden(); } })) : null));
  } else if (S.hub >= 0) {
    const hub = S.hubs[S.hub];
    put(box, head(() => pickHub(-1), name(hub.name, null)),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, act("newTopic", "New topic", "Z", newZone, true), act("scopeGraphs", "Knowledge graphs", "⇧Tab", () => openScope(hub.id)), act("techBtn", "Tech tree", "K", openTech))),
      el("h3", { text: "Islands" }),
      hub.isles.length ? el("div", { class: "rows" }, hub.isles.map((i, k) => { const q = S.model[i], n = q.topics.filter((x) => x.id).length; return row(k < 9 ? String(k + 1) : "", q.name, `${n} topic${n === 1 ? "" : "s"}`, q.topics.reduce((a, x) => a + x.due.length, 0), () => pickIsle(i)); })) : el("p", { class: "muted", text: "No islands yet." }));
  } else {
    const all = S.model.flatMap((q) => q.topics).filter((q) => q.id), thirsty = all.filter((q) => q.due.length).sort((a, b) => b.due.length - a.due.length), top = Math.max(1, ...all.map((q) => q.ideas));
    put(box, head(null, name("Garden", null), S.garden.mapAt ? null : ib("isleAdd", "New island", ICON.plus, newIsle)),
      el("div", { class: "gtop" }, ctl, el("div", { class: "gacts" }, act("newGraph", "New knowledge graph", "N", () => newGraph(), true), act("scopeGraphs", "Knowledge graphs", "⇧Tab", () => openScope()), act("mapBtn", "Meaning map", "M", () => goMeaning()), act("techBtn", "Tech tree", "K", openTech))),
      el("h3", { text: "Needs watering" }),
      thirsty.length ? el("div", { class: "rows" }, thirsty.slice(0, 6).map((q) => row("", q.name, "", q.due.length, () => goTopic(q.id)))) : el("p", { class: "muted", text: "Nothing right now." }),
      all.length ? el("details", { class: "fold", id: "spread", open: pref("spread", "") === "1", ontoggle: (e) => setPref("spread", e.target.open ? "1" : "") }, el("summary", {}, el("h3", { text: "Knowledge spread" })), el("div", { class: "spread" }, all.map((q) => el("button", { class: "bar", title: `${q.name}: ${q.ideas}`, onclick: () => goTopic(q.id) }, el("span", { text: q.name }), el("i", {}, el("b", { style: `width:${Math.max(3, (100 * q.ideas) / top)}%` })))))) : null);
  }
}
// A new graph asks only for its topic and its name.
async function newGraph(zoneId) {
  const NEW = "\u0000new", has = S.zones.length > 0;
  const v = await dialog({ title: "New knowledge graph", ok: "Create", fields: [
    has ? { name: "zoneId", label: "Topic", type: "select", value: zoneId || (S.view === "isles" ? S.model[S.isle]?.topics[Math.max(0, S.topic)]?.id : S.fscope?.kind === "topic" ? S.fscope.id : treeOf(S.fsel)?.zoneId) || S.zones[0].id, options: [...S.zones.map((z) => [z.id, z.name]), [NEW, "New topic…"]] } : { name: "topic", label: "Topic", max: 80 },
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
  if (k === "w") { stop(); return t ? (t.due.length ? water(t.due) : toast("Nothing to water")) : water(null); }
  if (k === "d") { stop(); $("#gpanel .seg[aria-label=Time] button[aria-pressed=false]")?.click(); }
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

// ---------- exams ----------
// The Bonsai Exams page (a page inside Claude) exports what an exam showed. Ideas shown go into the topic's
// graphs with their drafted notes; the rest go in greyed and don't count until a re-sit shows them.
function importExam() {
  const file = el("input", { type: "file", accept: "application/json,.json,text/plain", hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; const text = await f.text(); closeTop(); applyExam(text); } });
  dialog({ title: "Import exam", ok: "Next", fields: [{ name: "text", label: "Exam", type: "textarea", placeholder: "Paste" }], body: el("div", { class: "row" }, file, el("button", { type: "button", class: "btn", id: "examFile", text: "Choose file", onclick: () => file.click() })) })
    .then((v) => { if (v) applyExam(v.text); });
}
async function applyExam(text) {
  let exam; try { exam = readExam(text); } catch (e) { return toast(e.message); }
  const NEW = "+", same = S.zones.find((z) => z.name.trim().toLowerCase() === exam.topic.toLowerCase());
  const ideas = exam.tiers.flatMap((t) => t.graphs.flatMap((g) => g.ideas)), shown = ideas.filter((i) => i.level).length;
  const v = await dialog({ title: "Import exam", ok: "Import", fields: [{ name: "zone", label: "Topic", type: "select", value: same?.id || NEW, options: [[NEW, `New: ${exam.topic}`], ...S.zones.map((z) => [z.id, z.name])] }],
    body: el("p", { class: "meta", id: "examSum", text: `${exam.tiers.map((t) => t.tier).join(", ")} · ${shown} shown · ${ideas.length - shown} greyed` }) });
  if (!v) return;
  if (S.view === "isles") isles.setActive(false);
  const made = await safely(async () => {
    const zoneId = v.zone === NEW ? (await store.createZone({ name: exam.topic })).id : v.zone;
    const trees = S.trees.filter((t) => t.zoneId === zoneId), inTopic = new Set(trees.map((t) => t.id)), nodes = S.nodes.filter((n) => inTopic.has(n.treeId));
    return store.importExam(zoneId, planExam(exam, { trees, nodes, links: S.links }));
  });
  if (S.view === "isles") isles.setActive(true);
  if (!made) return;
  await refresh();
  const woke = made.woke.filter((w) => w.ghost).length, grey = made.nodeIds.filter((id) => S.byId.get(id)?.ghost).length, n = made.nodeIds.length - grey + woke;
  toast([`${n} idea${n === 1 ? "" : "s"} shown`, grey ? `${grey} greyed` : "", made.linkIds.length ? `${made.linkIds.length} link${made.linkIds.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(", "),
    { label: "Undo", run: async () => { await safely(() => store.undoExam(made)); refresh(); } });
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
  const ask = dialog({ title: `Split ${t.name}`, ok: "Split", fields: t.trees.length > 1 ? [{ name: "into", label: "Start from", type: "select", value: big.id, options: t.trees.map((x) => [x.id, x.name]) }] : [], body: list });
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
  const input = el("input", { id: "zoneName", placeholder: "First topic", maxLength: 80, required: true, "aria-label": "Topic", autocomplete: "off" });
  box.append(el("form", { class: "row", onsubmit: async (e) => {
    e.preventDefault();
    const z = await safely(() => store.createZone({ name: input.value })); if (!z) return;
    input.value = ""; await refresh(); newGraph(z.id);
  } }, input, el("button", { class: "btn primary", text: "Add topic" })));
}

// ---------- the tech tree: a flat map of every topic and idea ----------
function techData() {
  const model = gardenModel(), rec = new Map(S.garden.islands.map((q) => [q.id, q]));
  return { islands: model.map((q) => ({ id: q.id, name: q.name, hub: q.hub, after: rec.get(q.id)?.after || null, from: rec.get(q.id)?.from || null })),
    topics: model.flatMap((q, i) => q.topics.filter((t) => t.id).map((t) => ({ id: t.id, name: t.name, isle: i, ideas: t.ideas, growth: t.growth, mist: t.mist }))),
    trees: S.trees, nodes: S.nodes.map((n) => ({ ...n, st: n.ghost ? "ghost" : thirst(n) })), links: S.links };
}
function openTech() {
  if (S.view === "tree" || S.view === "meaning") { S.pendingSel = S.sel; const z = S.tree ? S.tree.zoneId : S.scope; location.hash = "#/techtree" + (z ? "/" + encodeURIComponent(z) : ""); return; }
  if (S.view === "forest" || S.view === "garden") {   // the knowledge view opens it on what's in view: a topic, an island, or a picked graph's topic
    const at = S.fscope && S.fscope.kind !== "hub" ? S.fscope.id : treeOf(S.fsel)?.zoneId;
    location.hash = "#/techtree" + (at ? "/" + encodeURIComponent(at) : ""); return;
  }
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
    tech = createTechTree({ host: $("#tech"), saved,
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
    x && !web && x.kids && !x.centre ? key("techFold", x.open ? "Close" : "Open", "Space", () => tech.key(" ")) : null,
    x && !web && !x.centre ? key("techCentre", "Centre", "↵", () => tech.key("Enter")) : null,
    x && (web || x.centre) && (x.kind === "idea" || x.kind === "topic" || (x.kind === "island" && !x.start)) ? key("techOpen", x.kind === "idea" ? "Open graph" : "Garden", "↵", () => openFromTech(x)) : null,
    x && x.kind === "island" && !x.start && !web ? key("techFrom", "Grows from", "B", () => growsFrom(x)) : null,
    x ? el("span", { class: "sep" }) : null,
    web || f.full ? null : key("techFull", "Whole tree", "H", () => tech.key("h")),
    web ? null : key("techAll", "All open", "A", () => tech.key("a"), f.all),
    el("div", { class: "seg keys", role: "group", "aria-label": "Mode" }, key("modeTree", "Tree", "V", () => techMode("tree"), !web), key("modeWeb", "Web", "V", () => techMode("web"), web)),
    web ? key("techReset", "Tidy", "R", () => tech.key("r")) : null,
    web ? key("techLoose", "Jiggle", "J", () => tech.key("j"), f.loose) : null,
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
function toggleThirsty() { S.thirsty = !S.thirsty; setPref("thirsty", S.thirsty ? "1" : "0"); if (S.view === "forest") buildForest(); else if (S.view === "tree") rebuild(); renderActions(); }
function techMode(m) { tech.setMode(m); renderActions(); }
function techEsc() { if (!tech.key("Escape")) location.hash = S.techBack; }
function techKey(k, stop) {
  const x = tech.selected;
  if (k === "v") { stop(); return techMode(tech.mode === "web" ? "tree" : "web"); }
  if (k === "b" && x?.kind === "island" && !x.start && tech.mode === "tree") { stop(); return growsFrom(x); }
  if (tech.key(k === " " ? " " : k)) stop();
}

function retheme() { T = theme(); stage.setTheme(T); selMesh?.material.color.set(T.ink); }

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
    if (S.forest?.joined) return hit.kind === "node" ? joinedTap(hit.id) : undefined;
    if (hit.kind === "zone") return zoneMenu(hit.id, { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY });
    if (hit.kind === "isle" || hit.kind === "hub") return openScope(hit.id);   // an island's or hub's name narrows the view to it
    const treeId = hit.kind === "tree" ? hit.id : hit.kind === "node" ? S.byId.get(hit.id)?.treeId : S.byId.get(S.links.find((l) => l.id === hit.id)?.fromId)?.treeId;
    if (!treeId) return;
    if (S.fsel === treeId && e.pointerType !== "mouse") return openTree(treeId);   // a second tap opens it, as a double-click does
    S.fsel = treeId; markSel(); renderActions();   // a click picks it; double-click or Enter opens it
    return;
  }
  if (S.review || S.cutoff != null) return;
  if (S.quick) { S.quick = null; }
  if (!hit) return S.view === "tree" ? renderActions() : select(null);   // in a graph an idea always stays picked
  if (hit.kind === "group") { const L = stage.labels.find((x) => x.kind === "group" && x.id === hit.id); if (L) stage.flyTo({ target: L.pos, radius: Math.min(stage.radius, stage.fitDistance(S.lay.radius) * 0.5) }); return; }
  if (hit.kind === "link") { const l = S.links.find((x) => x.id === hit.id); if (l) { S.panel = "node"; select(l.fromId); } return; }
  if (e.pointerType === "mouse" || S.sel === hit.id) { S.panel = "node"; select(hit.id); }
  else {
    select(hit.id);
    const p = stage.screenOf(S.flora.pos.get(hit.id)), r = stage.container.getBoundingClientRect();
    showHover(hit.id, r.left + p.x - 14, r.top + p.y);
  }
}
// Double-click goes into what's under the pointer: a graph from the rings, an idea flown to in a graph.
function onDouble(hit) {
  if (S.pick || S.review) return;
  const treeId = hit && (hit.kind === "tree" ? hit.id : hit.kind === "node" ? S.byId.get(hit.id)?.treeId : null);
  if (S.view === "forest" && !S.forest?.joined && treeId) return openTree(treeId);
  if (S.view === "garden" && treeId) return goTree(treeId);
  if (S.view === "tree" && hit?.kind === "node" && S.flora?.home.has(hit.id)) { select(hit.id); return stage.flyTo({ target: S.flora.home.get(hit.id), radius: Math.min(stage.radius, 8) }); }
}
// Right-click: the menu of whatever is under the pointer.
function onMenu(hit, e) {
  if (S.pick || S.review || S.cutoff != null) return;
  const at = { left: e.clientX, right: e.clientX + 1, top: e.clientY, bottom: e.clientY };
  if (S.view === "tree" && hit?.kind === "node" && S.byId.get(hit.id)) { select(hit.id); return menu(at, ideaItems(S.byId.get(hit.id))); }
  if (S.view === "tree" && hit?.kind === "link") return linkMenu(hit.id, at);
  if (S.view === "forest" && !S.forest?.joined && hit) {
    if (hit.kind === "zone") return zoneMenu(hit.id, at);
    const treeId = hit.kind === "tree" ? hit.id : hit.kind === "node" ? S.byId.get(hit.id)?.treeId : null, t = treeOf(treeId);
    if (t) { S.fsel = t.id; markSel(); renderActions(); return menu(at, graphItems(t)); }
  }
}
function graphItems(t) {
  return [
    { label: "Open", key: "↵", run: () => openTree(t.id) }, { label: "On the board", run: () => { location.hash = notesHash(GP + t.id); } },
    ...(() => { const d = dueList(t.id); return d.length ? [{ label: `Water ${d.length}`, key: "W", run: () => water(null, t.id) }, { label: "All good", run: () => passAll(d.map((n) => n.id)) }] : []; })(),
    desktop && { label: "Oral", key: "E", run: () => startOral(t.id) },
    desktop && { label: "Write questions", run: () => writeQuestions(t.id) },
    "-", { label: "Rename", run: () => renameThing(t, store.updateTree, "Knowledge graph") }, { label: "Colour", run: () => colourThing(t, store.updateTree) },
    S.zones.length > 1 && { label: "Move to topic", run: async () => {
      const v = await dialog({ title: `Move ${t.name}`, fields: [{ name: "zoneId", label: "Topic", type: "select", value: t.zoneId, options: S.zones.map((z) => [z.id, z.name]) }], ok: "Move" });
      if (v && (await safely(() => store.updateTree(t.id, { zoneId: v.zoneId })))) refresh(); } },
    { label: "Archive", run: async () => { if (await safely(() => store.updateTree(t.id, { archived: true }))) { toast(`Archived ${t.name}`); refresh(); } } },
  ];
}
// a link: its label, or gone (Undo brings it back)
function linkMenu(id, at) {
  const l = S.links.find((x) => x.id === id); if (!l) return;
  const a = S.byId.get(l.fromId), b = S.byId.get(l.toId);
  menu(at, [{ label: `${a?.title || "?"} — ${b?.title || "?"}`, disabled: true }, "-",
    { label: "Label…", run: () => labelLink(l) }, { label: "Delete link", key: "Del", danger: true, run: () => removeLink(l.id) }]);
}
async function labelLink(l) {
  const v = await dialog({ title: "Label the link", fields: [{ name: "label", label: "Label", value: l.label || "" }], ok: "Save" });
  if (v && (await safely(() => store.updateLink(l.id, { label: v.label })))) { await refresh(); if (S.view === "notes") boardRedraw(); }
}
async function removeLink(id) {
  const l = S.links.find((x) => x.id === id); if (!l) return;
  if (!(await safely(async () => { await store.deleteLink(id); return true; }))) return;
  if (S.glink === id) S.glink = null;
  await refresh(); if (S.view === "notes") boardRedraw();
  toast("Link deleted", { label: "Undo", run: async () => { await safely(() => store.addLink(l.fromId, l.toId, { label: l.label || "", note: l.note || "" })); await refresh(); if (S.view === "notes") boardRedraw(); } });
}
function back() {
  if (closeTop()) return;
  if (vocab?.closeTop()) return;
  if (S.pick) return S.pick.finish(null);
  if (S.quick) { S.quick = null; return renderActions(); }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return document.activeElement.blur();
  if (S.move) return toggleMove(false);
  if (S.view === "notes" && (S.gsel || S.glink) && graphPage(S.npage)) return S.boardPick?.(null);
  if (S.sun) return stopSunday();
  if (S.oral) return stopOral();
  if (S.review) return endReview();
  if (S.tl) return tlClose();
  if (S.panel) { S.panel = null; return renderPanel(); }
  if (S.nside && S.view === "tree") return toggleSide();
  if (S.view === "garden" && S.fsel) return pickPlant(null);
  if (S.view === "notes") return;   // a window of its own: nothing to step back to
  if (S.view === "isles") { if (S.topic >= 0) return pickTopic(-1); if (S.isle >= 0) return pickIsle(-1); if (S.hub >= 0) pickHub(-1); return; }
  if (S.view === "tech") return techEsc();
  if (S.view === "meaning" && S.sel) return select(null);   // let go first, then step out
  location.hash = S.view === "tree" ? S.treeBack : S.view === "meaning" ? S.meanBack : "#/";
}
function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); if (e.shiftKey && S.backTo && $("#backBtn") && !overlayOpen()) { location.hash = S.backTo; return; } return back(); }
  if (e.ctrlKey || e.metaKey || e.altKey || overlayOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || e.target?.isContentEditable || document.activeElement?.isContentEditable) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, stop = () => e.preventDefault();
  if (S.sun) return sunKey(k, stop);
  if (S.oral) return oralKey(k, stop);
  if (S.review) {
    const r = S.review;
    if (k === "e" && desktop) { stop(); return startOral(S.byId.get(r.ids[r.i])?.treeId, r.ids.slice(r.i)); }
    if (k === " " || k === "Enter") { stop(); if (!r.shown) { r.shown = true; renderReview(); } }
    else if (r.shown && "1234".includes(k)) rateNow(srs.RATINGS[+k - 1]);
    return;
  }
  if (S.pick) return;
  if (levelKey(e)) return;
  if (k === "Tab" && (e.shiftKey || S.view === "isles")) { stop(); return toggleWindow(); }   // in the garden Tab has nothing else to do
  if (k === "/") { stop(); return find(); }
  if (k === "?") { stop(); return shortcuts(); }
  if (k === "i") { stop(); return capture(); }
  if (k === "k") { stop(); return openTech(); }
  if (k === "o") { stop(); return openNotes(); }
  if (k === "u") { stop(); return startSunday(); }
  if (k === "[" || k === "]") { stop(); return sideKey(k === "["); }
  if (S.view === "tech") return techKey(k, stop);
  if (S.view === "notes") return notesKey(k, stop, e);
  if (S.view === "tree" && S.cutoff == null && /^[0-9]$/.test(k) && (S.jump || k !== "0")) { stop(); return jumpDigit(k); }
  if (k === "t" && tlWhere()) { stop(); return e.shiftKey ? tlVideo() : tlToggle(); }
  if (S.tl) {
    if (k === " ") { stop(); return tlPlay(); }
    if (k === "ArrowLeft" || k === "ArrowRight") { stop(); return tlStep(k, e.shiftKey); }
  }
  if (k === "0") { stop(); return S.view === "isles" ? pickHub(-1) : fitView(); }
  if (S.cutoff != null || S.tl) return;
  if (S.view === "isles") return islesKey(k, stop);
  if (S.view === "garden") {
    if (k === "w") { stop(); return startReview(null); }
    if (k.startsWith("Arrow")) { stop(); stepForest(k === "ArrowRight" || k === "ArrowUp" ? 1 : -1); return renderActions(); }
    if (k === "Enter" && e.shiftKey && treeOf(S.fsel)) { stop(); return goTree(S.fsel); }
    if (k === "Enter" && treeOf(S.fsel)) { stop(); return startReview(S.fsel); }
    if (k === "a" && treeOf(S.fsel)) { stop(); return passAll((S.byTree.get(S.fsel) || []).filter((x) => thirst(x) !== "ok").map((x) => x.id)); }
    return;
  }
  if (S.view === "forest") {
    if (k === "m") { stop(); return setLook("meaning"); }
    if (k === "n") { stop(); return newGraph(); }
    if (k === "v") { stop(); return toggleJoined(); }
    if (k === "h") { stop(); return toggleThirsty(); }
    if (k === "w") { stop(); return water(null); }
    if (k === "a" && S.fscope) { stop(); return openScope(); }
    if (k === "z") { stop(); return newZone(); }
    if (k.startsWith("Arrow")) { stop(); return stepForest(k === "ArrowRight" || k === "ArrowUp" ? 1 : -1); }
    if (k === "Enter" && treeOf(S.fsel)) { stop(); return openTree(S.fsel); }
    return;
  }
  const n = S.byId.get(S.sel);
  if (S.view === "meaning") {
    if (k === "v") { stop(); return setLook(S.joined ? "joined" : "apart"); }
    else if (k === "s" && S.mean) { stop(); openSuggest(); }
    else if (k === "a" && S.fscope) { stop(); goMeaning(); }
    else if (k === "Enter" && n) { stop(); S.pendingSel = n.id; goTree(n.treeId); }
    else if (k === " ") { stop(); togglePanel(); }
    else if (k === "l") { stop(); linkFrom(); }
    else if (k.startsWith("Arrow")) { stop(); nav(k); }
    return;
  }
  if (k === "v") { stop(); return openOnBoard(); }
  if (k === "w" && S.tree) { stop(); return dueList(S.tree.id).length ? water(null, S.tree.id) : toast("Nothing to water"); }
  if (k === "m") { stop(); S.pendingSel = S.sel; return goMeaning(S.tree.zoneId); }
  if (k === "Tab") { stop(); quick("child"); }
  else if (k === "Enter") { stop(); quick("sibling"); }
  else if (k === "r" || k === "F2") { stop(); if (n) quick("rename"); }
  else if (k === "Delete" || k === "Backspace") { stop(); if (n) removeNode(n.id); }
  else if (k === " ") { stop(); togglePanel(); }
  else if (k === "n") { stop(); editNotes(); }
  else if (k === "x") { if (n && n.parentId != null) splitOut(n); }
  else if (k === "l") { stop(); linkFrom(); }
  else if (k === "g") { stop(); graft(); }
  else if (k === "c") { if (n) cycleColour(n); }
  else if (k === "q") { stop(); if (n) editQuestion(n, -1); }
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
// the property types for notes; older pages may hold others (number, select, checkbox, email, phone, edited), which still show and edit
const PROP_TYPES = [["tags", "Tags"], ["date", "Date"], ["status", "Status"], ["url", "Source"], ["text", "Text"], ["created", "Created"]];
const ALL_TYPES = [...PROP_TYPES, ["number", "Number"], ["select", "Select"], ["checkbox", "Checkbox"], ["email", "Email"], ["phone", "Phone"], ["edited", "Last edited"]];

const PROP_OPTIONS = {};
// every page carries these, in this order, as in a Notion database; extra text properties can follow
const STD_PROPS = [["tags", "Tags", []], ["date", "Date", ""], ["status", "Status", "Raw"], ["url", "Source", ""], ["created", "Created", ""]];
function withStd(props = []) {
  const rest = [...props], std = STD_PROPS.map(([type, name, value]) => {
    const i = rest.findIndex((x) => x.type === type);
    return i >= 0 ? rest.splice(i, 1)[0] : { id: "std-" + type, name, type, value: Array.isArray(value) ? [] : value };
  });
  return [...std, ...rest];
}
const isStd = (p, pr) => p.props.indexOf(pr) < STD_PROPS.length;
// a note's life: written in a lecture, tidied up, grown into a knowledge graph (set by itself when you grow it)
const STATUSES = [["Raw", "gray"], ["Tidied", "yellow"], ["Grown", "green"]];
const statusOf = (p) => (p.props || []).find((x) => x.type === "status")?.value || "";
const dateOf = (p) => (p.props || []).find((x) => x.type === "date" && x.value)?.value || p.createdAt.slice(0, 10);
const TAG_COLOURS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const tagColour = (v) => { let h = 0; for (const c of String(v)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TAG_COLOURS[h % TAG_COLOURS.length]; };
const notesOpen = () => S.nopen || (S.nopen = new Set((() => { try { return JSON.parse(pref("notesOpen", "[]")); } catch { return []; } })()));
function setOpen(id, on) { const o = notesOpen(); if (on) o.add(id); else o.delete(id); setPref("notesOpen", JSON.stringify([...o])); }
const notesHash = (id = S.npage) => "#/notes" + (id ? "/" + encodeURIComponent(id) : "");
// the sidebar rows: the tree with open folders, or search results
function noteRows() {
  const q = (S.nq || "").trim().toLowerCase(), nf = S.nf || "";
  if (q || nf) {
    const tagOnly = q.startsWith("#"), w = tagOnly ? q.slice(1) : q;
    return S.pages.filter((p) => !isFolder(p) && (!nf || statusOf(p) === nf) && (!q || tagsOf(p).some((t) => t.toLowerCase().includes(w)) || (!tagOnly && (p.title || "Untitled").toLowerCase().includes(w))))
      .sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({ p, depth: 0, hit: true }));
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
  S.npage = id === VOCAB || pageOf(id) || graphPage(id) ? id : S.npage === VOCAB || pageOf(S.npage) || graphPage(S.npage) ? S.npage : noteRows()[0]?.p.id || null;
  for (const q of pagePath(pageOf(S.npage))) setOpen(q.id, true);   // show the way down to it
  put($("#notes"), notesSidebar(), el("section", { class: "nmain" }, el("div", { class: "pbar", id: "pbar" }), el("div", { class: "nedit", id: "nedit" })));
  setNotesHash(); drawPageList(); drawEditor(); renderChrome();
}
// the notes sidebar: search, status filter, the tree, new page and folder. The notes window and the drawer beside a graph share it.
function notesSidebar(close) {
  const search = el("input", { id: "notesSearch", type: "text", placeholder: "Search notes, graphs or #tags", "aria-label": "Search the library", autocomplete: "off", value: S.nq || "",
    oninput: (e) => { S.nq = e.target.value; drawPageList(); },
    onkeydown: (e) => {
      const rows = noteRows();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const i = rows.findIndex((r) => r.p.id === (S.view === "notes" ? S.npage : S.sp)); const r = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]; if (r) pickPage(r.p.id, { keepFocus: true }); }
      else if (e.key === "Enter") { e.preventDefault(); if (rows[0] && !rows.some((r) => r.p.id === S.npage)) pickPage(rows[0].p.id); e.target.blur(); S.ed?.focus("start"); }
      else if (e.key === "Escape" && e.target.value) { e.preventDefault(); e.stopPropagation(); S.nq = ""; e.target.value = ""; drawPageList(); }
    } });
  const tree = el("div", { class: "ntree", id: "nlist", role: "tree", "aria-label": "Pages",
    ondragover: (e) => { if (S.ndrag && e.target === tree) { e.preventDefault(); tree.classList.add("drop"); } }, ondragleave: () => tree.classList.remove("drop"),
    ondrop: (e) => { if (e.target !== tree) return; e.preventDefault(); tree.classList.remove("drop"); movePage(S.ndrag, null); } });
  const vrow = el("button", { class: "nvocab" + (S.view === "notes" && S.npage === VOCAB ? " on" : ""), id: "vocabBtn", type: "button", onclick: openVocab }, icon(ICON.book), el("span", { class: "nt", text: "Vocab" }),
    el("span", { class: "muted vcount", text: String((S.vocab || []).length || "") }), el("kbd", { text: "⇧V" }));
  const foot = el("div", { class: "nfoot" },
    el("button", { class: "btn", id: "newPageBtn", "aria-haspopup": "menu", onclick: (e) => menu(e.currentTarget, [
      { label: "Page", key: "N", run: () => newPage() }, { label: "Pen page", key: "W", run: () => newPage(null, "ink") }]) }, "+ Page", el("span", { class: "caret" }, "▾")),
    el("button", { class: "btn", id: "newFolderBtn", onclick: () => newPage(null, "folder") }, "+ Folder", el("kbd", { text: "F" })));
  const filter = el("div", { class: "nfilter", role: "group", "aria-label": "Status" }, [["", "All"], ...STATUSES.map(([v]) => [v, v])].map(([v, text]) =>
    el("button", { type: "button", class: "nf" + ((S.nf || "") === v ? " on" : ""), "aria-pressed": String((S.nf || "") === v), dataset: { status: v }, text,
      onclick: (e) => { S.nf = v; for (const b of e.currentTarget.parentElement.children) { const on = b.dataset.status === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); } drawPageList(); } })));
  // the Library: three tabs, Notes, Graphs (island › topic › graph) and Watering, each with its own filter and folds
  const tab = libTab(), chip = (key, opts, cur, set) => el("div", { class: "nfilter", role: "group", "aria-label": "Filter", dataset: { f: key } }, opts.map(([v, text]) =>
    el("button", { type: "button", class: "nf" + (cur === v ? " on" : ""), "aria-pressed": String(cur === v), dataset: { v }, text,
      onclick: (e) => { set(v); for (const b of e.currentTarget.parentElement.children) { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); } drawPageList(); } })));
  const tabs = el("div", { class: "ltabs", role: "tablist", "aria-label": "Library" }, LIBTABS.map(([id, label], k) =>
    el("button", { class: "ltab" + (tab === id ? " on" : ""), type: "button", role: "tab", id: "lib-" + id, "aria-selected": String(tab === id), title: `${label} (Shift+${k + 1})`, onclick: () => setLibTab(id) },
      el("span", { text: label }), el("span", { class: "muted lcount", id: "lcount-" + id, text: libCount(id) }), el("kbd", { text: "⇧" + (k + 1) }))));
  const glist = el("div", { class: "ntree glist", id: "glist", role: "tree", "aria-label": "Graphs" }), wlist = el("div", { class: "ntree wlist", id: "wlist", role: "tree", "aria-label": "Needs water" });
  const body = tab === "graphs" ? el("div", {}, chip("g", [["", "All"], ["wait", "Waiting"], ["ok", "Watered"]], S.gf || "", (v) => { S.gf = v; }), glist)
    : tab === "water" ? el("div", {}, chip("w", [["", "All"], ["thirsty", "Thirsty"], ["dry", "Dry"]], S.wf || "", (v) => { S.wf = v; }), wlist)
    : el("div", {}, filter, tree);
  const tail = tab === "notes" ? [vrow, foot]
    : tab === "graphs" ? [el("div", { class: "nfoot" }, el("button", { class: "btn", id: "newGraphBtn", onclick: () => newGraph() }, "+ Graph", el("kbd", { text: "N" })))]
    : thirstyGraphs().length ? [el("div", { class: "nfoot" }, el("button", { class: "btn water", id: "libWater", onclick: () => water(null) }, icon(ICON.drop), "Water all", el("kbd", { text: "W" })))] : [];
  return el("nav", { class: "nside-bar", "aria-label": "Library", dataset: { tab } }, el("div", { class: "nsearch" }, search, close ? null : el("kbd", { text: "/" }), close), tabs, el("div", { class: "nlib" }, body), ...tail);
}
function setNotesHash() { const h = notesHash(); history.replaceState(null, "", h); S.hashNow = h; S.lastNotes = h; }
// ---------- the Library's graphs and watering ----------
const GP = "g:";   // a graph opened in the Library: S.npage is "g:<treeId>"
const graphPage = (id) => (typeof id === "string" && id.startsWith(GP) ? treeOf(id.slice(GP.length)) || null : null);
const LIBTABS = [["notes", "Notes"], ["graphs", "Graphs"], ["water", "Watering"]];
const libTab = () => { const t = pref("libtab", "notes"); return LIBTABS.some(([id]) => id === t) ? t : "notes"; };
const libCount = (id) => String((id === "notes" ? (S.pages || []).filter((p) => !isFolder(p)).length : id === "graphs" ? S.trees.length : thirstyGraphs().length) || "");
function setLibTab(id) {
  setPref("libtab", id);
  const nav = document.querySelector(".nside-bar"); if (!nav) return;
  const close = nav.querySelector(".nsearch .keyed"); nav.replaceWith(notesSidebar(close || undefined)); drawPageList();
  document.getElementById("lib-" + id)?.focus({ preventScroll: true });
}
const thirstyOf = (tr) => (S.byTree.get(tr.id) || []).filter((n) => !n.ghost && thirst(n) !== "ok").length;
const thirstyGraphs = () => S.trees.map((tr) => [tr, thirstyOf(tr)]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
// islands, then their topics, then the graphs on each; topics on no island come last
function graphShelves() {
  const isl = (S.garden?.islands || []).map((q) => ({ id: q.id, name: q.name, zones: q.zoneIds.map((z) => S.zones.find((x) => x.id === z)).filter(Boolean) }));
  const seen = new Set(isl.flatMap((q) => q.zones.map((z) => z.id))), loose = S.zones.filter((z) => !seen.has(z.id));
  if (loose.length) isl.push({ id: "_loose", name: "Elsewhere", zones: loose });
  return isl.map((q) => ({ ...q, zones: q.zones.map((z) => ({ z, trees: S.trees.filter((t) => t.zoneId === z.id) })).filter((x) => x.trees.length) })).filter((q) => q.zones.length);
}
function openGraphPage(treeId) {
  if (S.view !== "notes") { if (S.view === "tree" && S.nside) return goTree(treeId); location.hash = notesHash(GP + treeId); return; }
  flushPage().then(() => { S.npage = GP + treeId; S.gsel = null; setNotesHash(); drawPageList(); drawEditor(); renderActions(); });
}
function graphRow(tr, depth, extra) {
  const on = S.view === "notes" && S.npage === GP + tr.id, dry = thirstyOf(tr);
  // drag a graph onto another to stitch it under that one's first idea, onto a topic to move it there, or onto the board
  return el("div", { class: "nrow graph" + (on ? " on" : ""), dataset: { tree: tr.id }, style: `--d:${depth}`, role: "treeitem", draggable: "true",
      ondragstart: (e) => { e.dataTransfer.setData("application/x-bonsai-tree", tr.id); e.dataTransfer.effectAllowed = "move"; },
      ondragover: (e) => { if (e.dataTransfer.types.includes("application/x-bonsai-tree")) { e.preventDefault(); e.currentTarget.classList.add("drop"); } },
      ondragleave: (e) => e.currentTarget.classList.remove("drop"),
      ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove("drop"); const from = e.dataTransfer.getData("application/x-bonsai-tree"); if (from && from !== tr.id) stitchGraphs(from, tr.id); },
      oncontextmenu: (e) => { e.preventDefault(); menu(atPointer(e), [{ label: "Open on the board", key: "↵", run: () => openGraphPage(tr.id) }, ...graphItems(tr).filter((x) => x && x.label !== "On the board").map((x) => (x.label === "Open" ? { ...x, label: "Open in 3D", key: "⇧↵" } : x))]); } },
    el("span", { class: "chev none" }),
    el("button", { class: "nname", type: "button", onclick: () => openGraphPage(tr.id) }, icon(ICON.graph), el("span", { class: "nt", text: tr.name || "Untitled" }), extra ? el("span", { class: "npath", text: extra }) : null),
    dry ? el("span", { class: "thirst", text: String(dry) }) : null);
}
// islands › topics › graphs, folding; the Graphs tab keeps its folds open by choice, Watering open until closed
function drawShelves(host, keep, { pre = "", shut = false, order } = {}) {
  const q = (S.nq || "").trim().toLowerCase();
  if (q) {   // searching: every graph whose name matches, with where it sits
    const hits = S.trees.filter((t) => keep(t) && (t.name || "").toLowerCase().includes(q));
    return put(host, hits.map((t) => graphRow(t, 0, S.zones.find((z) => z.id === t.zoneId)?.name)), hits.length ? null : el("p", { class: "muted nnone", text: "No matches" }));
  }
  const open = notesOpen(), rows = [], isOpen = (key) => (shut ? !open.has(pre + key) : open.has(pre + key)), flip = (key) => setOpen(pre + key, shut ? isOpen(key) : !isOpen(key));
  const fold = (key, depth, label, n) => { const on = isOpen(key);
    const zid = key.startsWith("t:") ? key.slice(2) : null;
    rows.push(el("div", { class: "nrow shelf", dataset: { shelf: pre + key }, style: `--d:${depth}`, role: "treeitem", "aria-expanded": String(on),
        ondragover: (e) => { if (zid && e.dataTransfer.types.includes("application/x-bonsai-tree")) { e.preventDefault(); e.currentTarget.classList.add("drop"); } },
        ondragleave: (e) => e.currentTarget.classList.remove("drop"),
        ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove("drop"); const from = e.dataTransfer.getData("application/x-bonsai-tree"); if (from && zid) moveGraph(from, zid); },
        oncontextmenu: (e) => shelfMenu(pre + key, e) },
      el("button", { class: "chev", type: "button", tabIndex: -1, "aria-label": on ? "Close" : "Open", "aria-expanded": String(on), onclick: () => { flip(key); drawPageList(); } }),
      el("button", { class: "nname", type: "button", onclick: () => { flip(key); drawPageList(); } }, el("span", { class: "nt", text: label })),
      el("span", { class: "muted lcount", text: String(n) })));
    return on; };
  for (const isl of graphShelves()) {
    const zones = isl.zones.map(({ z, trees }) => ({ z, trees: trees.filter(keep) })).filter((x) => x.trees.length); if (!zones.length) continue;
    if (!fold("i:" + isl.id, 0, isl.name, zones.reduce((a, z) => a + z.trees.length, 0))) continue;
    for (const { z, trees } of zones) { if (fold("t:" + z.id, 1, z.name, trees.length)) for (const t of order ? order(trees) : trees) rows.push(graphRow(t, 2)); }
  }
  put(host, rows, rows.length ? null : el("p", { class: "muted nnone", text: pre ? "Nothing waiting" : S.gf ? "None" : "No graphs yet" }));
}
const stateOf = (tr) => { let t = 0, d = 0; for (const n of S.byTree.get(tr.id) || []) { if (n.ghost) continue; const st = thirst(n); if (st === "dry") d++; else if (st === "thirsty") t++; } return { t, d }; };
function drawGraphList() {
  const host = $("#glist"); if (!host) return;
  const f = S.gf || "";
  drawShelves(host, (tr) => !f || (f === "wait") === thirstyOf(tr) > 0);
}
function drawWaterList() {
  const host = $("#wlist"), c = $("#lcount-water"); if (c) c.textContent = String(thirstyGraphs().length || "");
  if (!host) return;
  const f = S.wf || "";
  drawShelves(host, (tr) => { const { t, d } = stateOf(tr); return f === "thirsty" ? t > 0 : f === "dry" ? d > 0 : t + d > 0; },
    { pre: "w", shut: true, order: (ts) => [...ts].sort((a, b) => thirstyOf(b) - thirstyOf(a)) });
}
// A graph on a 2D board in the Library, where you build it (0.24.0). Places are the ideas' own (node.xy).
// Drag an idea to move it with what hangs from it; drop it on another to graft it there; pull the + knob (or Alt-drag)
// out to empty paper for a new idea there, or onto an idea to link them; right-click for the rest. Keys as in a graph:
// Tab adds under, Enter beside, R renames, Del deletes, L links, G grafts, X makes its own graph, C colour;
// Shift+Enter or a double-click opens it in 3D. A graph dragged in from the Library onto an idea is grafted there.
function boardData(tr) {
  const nodes = shownNodes(tr), looks = looksFor(tr, nodes), ids = new Set(nodes.map((n) => n.id));
  numberGraph(tr);
  return { nodes, rootId: tr.rootId, links: S.links.filter((l) => ids.has(l.fromId) && ids.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId })), colour: (id) => looks.get(id)?.color || T.root };
}
function graphBoard(tr) {
  const host = el("div", { class: "gboard-c" });
  const info = el("div", { class: "gfoot", id: "gfoot" });
  const pick = (id) => { S.gsel = id || null; S.glink = null; board.selectLink(null); board.select(S.gsel); S.g3?.select(S.gsel); drawGraphFoot(info, tr); drawIdeaCard(); };
  const pickLink = (id) => { S.glink = id; S.gsel = null; board.select(null); board.selectLink(id); S.g3?.select(null); drawGraphFoot(info, tr); drawIdeaCard(); };
  const board = createMiniWeb({ host, edit: true, onPick: pick, onOpen: (id) => openIdea(tr, id), num: (id) => S.num.get(id),
    ring: (id) => { const n = S.byId.get(id); return n && !n.ghost && thirst(n) !== "ok" ? T.link : null; }, mask: (id) => (masked(id) ? "?" : null),
    onMove: (list) => { for (const [id, x, y] of list) { const n = S.byId.get(id); if (n) n.xy = [x, y]; } safely(() => store.placeNodes(list)); S.g3?.rebuild(); },
    onDrop: (id, to) => boardGraft(id, to),
    onNew: (pid, x, y) => boardAsk({ parentId: pid, at: { x, y } }),
    onLink: (a, b) => boardLink(a, b),
    onMenu: (id, cx, cy, x, y, linkId) => (linkId ? (pickLink(linkId), linkMenu(linkId, { left: cx, right: cx + 1, top: cy, bottom: cy })) : boardMenu(id, cx, cy, x, y)),
    onPickLink: (id) => pickLink(id),
    onDropTree: (treeId, to) => boardGraftTree(treeId, to) });
  S.board = board; S.boardTree = tr.id; S.boardPick = pick; S.boardLink = pickLink; S.glink = null;
  if (S.boardView?.[tr.id]) board.view = S.boardView[tr.id];
  // the other view in a little window in the corner, like a video kept playing on a phone; the picked idea's card under it
  const main = el("div", { class: "gpane gmain" }), dock = el("div", { class: "gpane gpip", id: "gdock" }), card = el("div", { class: "gcard", id: "gcard" });
  const grip = el("div", { class: "pipbar" }, el("span", { class: "grow" }),
    el("button", { class: "ib keyed", type: "button", id: "pipSwap", title: "Swap (V)", "aria-label": "Swap", onclick: () => flipBoard() }, icon(ICON.swap), el("kbd", { text: "V" })),
    el("button", { class: "ib keyed", type: "button", id: "pipClose", title: "Close (])", "aria-label": "Close", onclick: () => toggleDock() }, icon(ICON.close), el("kbd", { text: "]" })));
  const pip = el("div", { class: "pipwin", id: "pipwin" }, dock, grip);
  const side = el("div", { class: "gside" + (pref("pipside", "r") === "l" ? " left" : ""), id: "gside" }, pip, card);
  pipDrag(grip, side);
  S.ed = { destroy: () => { (S.boardView ||= {})[tr.id] = board.view; board.destroy(); S.g3?.destroy(); S.g3 = null; if (S.board === board) S.board = null; }, flush: () => {}, focus: () => {} };
  board.setData(boardData(tr));
  if (S.gsel && S.byId.get(S.gsel)?.treeId === tr.id) board.select(S.gsel); else S.gsel = null;
  drawGraphFoot(info, tr);
  const out = el("div", { class: "gboard" }, el("div", { class: "gpanes" }, main, side), info);
  S.gpanes = { main, dock, host, pip, card };
  requestAnimationFrame(() => placePanes(tr));
  return out;
}
// 2D or 3D in the main pane (B), and the other one docked beside it (]); both follow the same pick
const g3On = () => pref("g3d", "") === "1", dockOn = () => pref("gdock", "") === "1";
function placePanes(tr = treeOf(S.boardTree)) {
  const P = S.gpanes; if (!P || !tr || !P.main.isConnected) return;
  const want3 = g3On() || dockOn();
  if (want3 && !S.g3) S.g3 = graph3D(tr);
  const two = S.g3?.el, [inMain, inDock] = g3On() ? [two, P.host] : [P.host, dockOn() ? two : null];
  if (inMain && inMain.parentElement !== P.main) P.main.replaceChildren(inMain);
  if (inDock) { if (inDock.parentElement !== P.dock) P.dock.replaceChildren(inDock); } else P.dock.replaceChildren();
  P.pip.hidden = !dockOn(); document.body.dataset.gdock = dockOn() ? "1" : "";
  if (two && two !== inMain && two !== inDock) two.remove();
  drawPageBar(); drawIdeaCard();
}
// drag the little window by its bar to the other side; it settles against the nearer edge
function pipDrag(grip, side) {
  grip.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const box = side.parentElement.getBoundingClientRect(), r0 = side.getBoundingClientRect(), dx = e.clientX - r0.left;
    grip.setPointerCapture(e.pointerId); side.classList.add("moving");
    const mv = (ev) => { side.style.left = Math.max(8, Math.min(box.width - r0.width - 8, ev.clientX - box.left - dx)) + "px"; side.style.right = "auto"; };
    const up = (ev) => {
      grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); side.classList.remove("moving");
      const left = ev.clientX - box.left < box.width / 2; side.style.left = side.style.right = ""; side.classList.toggle("left", left); setPref("pipside", left ? "l" : "r");
    };
    grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up);
  });
}
// the picked idea: its name, short note, notes and colour, under the little window
function drawIdeaCard() {
  const c = S.gpanes?.card; if (!c?.isConnected) return;
  const n = S.gsel && S.byId.get(S.gsel); c.hidden = !n || masked(n.id); if (c.hidden) { delete c.dataset.id; return c.replaceChildren(); }
  if (c.dataset.id === n.id && c.contains(document.activeElement)) return;   // don't redraw under the typing
  c.dataset.id = n.id;
  const save = async (patch) => { await safely(() => store.updateNode(n.id, patch)); boardRedraw(); };
  const bodyBox = el("div", { class: "body" }), body = n.body || "";
  const edit = () => put(bodyBox, el("textarea", { id: "cardBody", value: n.body || "", placeholder: "Notes", "aria-label": "Notes", rows: 6,
    onblur: (e) => { if (e.target.value !== (n.body || "")) save({ body: e.target.value }); else if (n.body) view(); } }));
  const view = () => put(bodyBox, el("div", { class: "md", id: "cardBodyView", tabIndex: 0, html: md(n.body || ""), onclick: (e) => { if (e.target.closest("a")) return; edit(); bodyBox.firstChild.focus(); } }));
  body ? view() : edit();
  put(c,
    el("div", { class: "ph" }, numTag(n.id), el("input", { id: "cardTitle", class: "title", value: n.title, maxLength: 140, "aria-label": "Title", onchange: (e) => (e.target.value.trim() ? save({ title: e.target.value }) : (e.target.value = n.title)) })),
    el("input", { id: "cardNote", class: "short", value: n.note || "", maxLength: 500, placeholder: "Short note", "aria-label": "Short note", onchange: (e) => save({ note: e.target.value }) }),
    bodyBox,
    el("div", { class: "swatches" }, SWATCHES.map(([name, hex]) => el("button", { class: "sw" + ((n.color || "") === hex ? " on" : "") + (hex ? "" : " none"), type: "button", title: name, "aria-label": name, style: hex ? `background:${hex}` : "", onclick: () => save({ color: hex || null }) }))),
    ...S.links.filter((l) => l.fromId === n.id || l.toId === n.id).map((l) => { const o = S.byId.get(l.fromId === n.id ? l.toId : l.fromId); if (!o) return null;
      return el("div", { class: "linkrow" }, el("button", { class: "chip", type: "button", text: o.title, onclick: () => S.boardLink?.(l.id) }), l.label ? el("span", { class: "muted", text: l.label }) : null, el("span", { class: "grow" }),
        ib(null, "Delete link", ICON.close, () => removeLink(l.id))); }),
    questionsBox(n));
}
function flipBoard() { setPref("g3d", g3On() ? "" : "1"); placePanes(); }
function toggleDock() { setPref("gdock", dockOn() ? "" : "1"); placePanes(); }
// The graph in 3D, in a stage of its own, built from the same layout as the graph view (so it follows the board).
function graph3D(tr) {
  const box = el("div", { class: "stage3", id: "stage3" }, el("canvas"), el("div", { class: "labels" }));
  const st = new Stage(box); st.setTheme(T); st.isPaused = () => true;   // no flying here: the keys are the board's
  let flora = null, decor3 = [], els = new Map(), framed = false;
  st.labelRank = (L) => (L.id === S.gsel ? 0 : 2 + (L.depth || 0)); st.labelOpacity = (L) => (masked(L.id) ? 0 : 1);
  st.onTap = (hit) => S.boardPick?.(hit?.kind === "node" ? hit.id : null);
  function build() {
    const t = treeOf(tr.id); if (!t) return;
    const lay = layOf(t), nodes = shownNodes(t), ids = new Set(nodes.map((n) => n.id)), hue = t.color || S.hues.get(t.zoneId) || T.limb;
    const links = S.links.filter((l) => ids.has(l.fromId) && ids.has(l.toId)).map((l) => ({ id: l.id, a: l.fromId, b: l.toId, label: l.label }));
    flora?.dispose(); flora?.group.removeFromParent(); for (const d of decor3) { d.removeFromParent(); d.geometry.dispose(); d.material.dispose(); }
    flora = new Flora([{ tree: t, nodes, layout: lay, offset: [0, 0], looks: looksFor(t, nodes) }], links, T);
    st.world.add(flora.group); st.pickables = [flora.nodeMesh];
    decor3 = ground({ glows: [{ x: 0, z: 0, r: Math.max(7, lay.footprint * 1.8), color: hue, k: 0.11 }], discs: [{ x: 0, z: 0, r: discR(lay), color: hue }] }, T.sky); for (const d of decor3) st.world.add(d);
    els = new Map();
    st.setLabels(nodes.map((n) => { const e = el("div", { class: "lbl node" + (n.id === t.rootId ? " trunk" : "") + (ghostly(n) ? " ghost" : "") + (n.id === S.gsel ? " sel" : ""), dataset: { kind: "node", id: n.id, n: S.num.get(n.id) }, text: n.title }); els.set(n.id, e);
      return { el: e, pos: flora.pos.get(n.id), kind: "node", id: n.id, depth: lay.depth.get(n.id), r: flora.radii.get(n.id), tidy: true }; }));
    if (!framed) { framed = true; st.setView({ target: vec(lay.center), radius: st.fitDistance(lay.radius) * 0.95, theta: 0.6, phi: 1.05 }); }
    st.invalidate();
  }
  build();
  return { el: box, stage: st, rebuild: build, select(id) { for (const [k, e] of els) e.classList.toggle("sel", k === id); st.invalidate(); }, destroy() { flora?.dispose(); st.destroy(); box.remove(); } };
}
// after a change: the same board, freshly read; a graph that's gone (grafted away) gives way to where it went
async function boardRedraw(goTo) {
  await refresh();
  if (goTo && goTo !== S.boardTree) return openGraphPage(goTo);
  const tr = treeOf(S.boardTree); if (!tr || !S.board) return drawEditor();
  S.board.setData(boardData(tr)); if (S.gsel && !S.byId.get(S.gsel)) S.gsel = null; if (S.glink && !S.links.some((x) => x.id === S.glink)) S.glink = null;
  S.board.select(S.gsel); S.board.selectLink(S.glink); S.g3?.rebuild(); drawGraphFoot($("#gfoot"), tr);
  if (S.gpanes?.card) delete S.gpanes.card.dataset.id; drawIdeaCard();
}
const boardKey = (label, key, run, id) => el("button", { class: "btn", id, onclick: run }, label, el("kbd", { text: key }));
function drawGraphFoot(info, tr) {
  if (!info) return;
  const l = S.glink && S.links.find((x) => x.id === S.glink);
  if (l) return put(info, el("b", { text: `${S.byId.get(l.fromId)?.title || "?"} — ${S.byId.get(l.toId)?.title || "?"}` }), l.label ? el("span", { class: "muted", text: l.label }) : null, el("span", { class: "grow" }),
    boardKey("Label", "R", () => labelLink(l), "gLinkLabel"), boardKey("Delete link", "Del", () => removeLink(l.id), "gLinkDel"));
  const n = S.gsel && S.byId.get(S.gsel);
  if (n && masked(n.id)) return put(info, el("b", { text: "?" }));   // a question waits on this idea
  const dry = thirstyOf(tr), waterB = dry ? el("button", { class: "btn water", id: "gWater", onclick: () => water(null, tr.id) }, icon(ICON.drop), el("span", { text: "Water" }), el("span", { class: "thirst", text: String(dry) }), el("kbd", { text: "W" })) : null;
  if (!n) return put(info, el("span", { class: "muted", text: `${(S.byTree.get(tr.id) || []).length} ideas` }), el("span", { class: "grow" }), waterB,
    boardKey("Add", "Tab", () => boardAsk({ parentId: tr.rootId }), "gAdd"), boardKey("Open", "⇧↵", () => openIdea(tr, tr.rootId), "gOpen"));
  const top = n.parentId == null;
  put(info, el("b", { text: n.title }), n.note ? el("span", { class: "muted", text: n.note.split("\n")[0].slice(0, 120) }) : null, el("span", { class: "grow" }),
    boardKey("Add under", "Tab", () => boardAsk({ parentId: n.id }), "gAdd"),
    top ? null : boardKey("Beside", "↵", () => boardAsk({ parentId: n.parentId }), "gBeside"),
    boardKey("Rename", "R", () => boardAsk({ id: n.id }), "gRename"),
    boardKey("Link", "L", () => boardLinkPick(n), "gLink"),
    boardKey("Graft", "G", () => boardGraftPick(n), "gGraft"),
    top ? null : boardKey("Delete", "Del", () => boardRemove(n.id), "gDel"),
    boardKey("Open", "⇧↵", () => openIdea(tr, n.id), "gOpen"), waterB);
}
// a name typed straight onto the board, where the idea will sit
function boardAsk({ parentId, id, at }) {
  const tr = treeOf(S.boardTree), b = S.board, host = $(".gboard-c"); if (!tr || !b) return;
  if (!host?.isConnected) {   // only the 3D showing: ask in a box instead of on the board
    const was = id ? S.byId.get(id) : null;
    return dialog({ title: was ? "Rename" : `New idea under ${S.byId.get(parentId)?.title || ""}`, fields: [{ name: "t", label: "Name", value: was?.title || "" }], ok: was ? "Rename" : "Add" }).then(async (v) => {
      const t = v?.t?.trim(); if (!t) return;
      if (was) { await safely(() => store.updateNode(id, { title: t })); return boardRedraw(); }
      const n = await safely(() => store.addNode(parentId, { title: t })); if (!n) return;
      const spot = at || b.spotFor(parentId); await safely(() => store.placeNodes([[n.id, spot.x, spot.y]])); S.gsel = n.id; boardRedraw();
    });
  }
  host.querySelector(".bask")?.remove();
  const was = id ? S.byId.get(id) : null, spot = was ? b.placeOf(id) : at || b.spotFor(parentId); if (!spot) return;
  const sc = b.toScreen(spot.x, spot.y), hr = host.getBoundingClientRect(), W = 200, H = 28;
  // beside the new idea, inside the board, and never under the idea card
  let x = sc.x - hr.left - 6, y = sc.y - hr.top - H / 2;
  const side = $(".gside")?.getBoundingClientRect();
  if (side?.width && x + hr.left < side.right + 8 && x + hr.left + W > side.left - 8 && y + hr.top < side.bottom && y + hr.top + H > side.top)
    x = side.left - hr.left > hr.width / 2 ? side.left - hr.left - W - 12 : side.right - hr.left + 12;
  x = Math.max(8, Math.min(hr.width - W - 8, x)); y = Math.max(8, Math.min(hr.height - H - 8, y));
  const inp = el("input", { class: "bask", id: "boardAsk", value: was?.title || "", placeholder: was ? "" : "New idea", maxLength: 140, "aria-label": was ? "Rename" : "New idea",
    style: `left:${Math.round(x)}px;top:${Math.round(y)}px` });
  let done = false;
  const finish = async (go, then) => {
    if (done) return; done = true; const v = inp.value.trim(); inp.remove();
    if (!go || !v) return $(".gboard-c canvas")?.focus();
    if (was) { await safely(() => store.updateNode(id, { title: v })); return boardRedraw(); }
    const n = await safely(() => store.addNode(parentId, { title: v })); if (!n) return;
    await safely(() => store.placeNodes([[n.id, spot.x, spot.y]])); S.gsel = n.id; await boardRedraw();
    if (then === "child") boardAsk({ parentId: n.id }); else if (then === "sibling") boardAsk({ parentId });
  };
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); finish(true, was ? null : "sibling"); }
    else if (e.key === "Tab") { e.preventDefault(); finish(true, was ? null : "child"); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  inp.addEventListener("blur", () => finish(true));
  host.append(inp); inp.focus(); inp.select();
}
async function boardLink(a, b) { if (S.links.some((l) => (l.fromId === a && l.toId === b) || (l.fromId === b && l.toId === a))) return toast("Already linked"); if (await safely(() => store.addLink(a, b))) { toast(`Linked to ${S.byId.get(b)?.title}`); boardRedraw(); } }
async function boardLinkPick(n) {
  const taken = new Set([n.id, ...S.links.filter((l) => l.fromId === n.id || l.toId === n.id).map((l) => (l.fromId === n.id ? l.toId : l.fromId))]);
  const to = await pickNode({ title: `Link ${n.title} to`, exclude: taken }); if (to != null) boardLink(n.id, to);
}
async function boardGraft(id, to) {
  const n = S.byId.get(id), target = S.byId.get(to); if (!n || !target) return boardRedraw();
  if (n.parentId == null) return boardGraftTree(n.treeId, to);
  if (store.subtreeIds(S.byTree.get(n.treeId), n.id).includes(to)) { toast("Not under itself"); return boardRedraw(); }
  const from = n.parentId;
  if ((await safely(() => store.moveNode(id, to))) === undefined) return boardRedraw();
  S.gsel = id; await boardRedraw(target.treeId);
  toast(`Grafted onto ${target.title}`, { label: "Undo", run: async () => { await safely(() => store.moveNode(id, from)); boardRedraw(); } });
}
async function boardGraftPick(n) {
  const ex = new Set(store.subtreeIds(S.byTree.get(n.treeId), n.id)); if (n.parentId) ex.add(n.parentId);
  const to = await pickNode({ title: `Graft ${n.title} onto`, exclude: ex }); if (to != null) boardGraft(n.id, to);
}
// stitching: a whole graph hung under an idea of another; Undo makes it its own graph again
async function boardGraftTree(treeId, to) {
  const t = treeOf(treeId), target = S.byId.get(to); if (!t || !target || target.treeId === treeId) return;
  if ((await safely(() => store.graftTree(treeId, to))) === undefined) return;
  S.gsel = t.rootId; await boardRedraw(target.treeId);
  toast(`${t.name} stitched onto ${target.title}`, { label: "Undo", run: async () => { const back = await safely(() => store.splitToTree(t.rootId, { name: t.name, zoneId: t.zoneId })); await refresh(); if (back && S.view === "notes") { drawPageList(); boardRedraw(); } } });
}
async function boardRemove(id) {
  const n = S.byId.get(id); if (!n || n.parentId == null) return;
  const snap = await safely(() => store.deleteNode(id)); if (!snap) return;
  S.gsel = n.parentId; await boardRedraw();
  toast(snap.nodes.length > 1 ? `Deleted ${n.title} and ${snap.nodes.length - 1} more` : `Deleted ${n.title}`, { label: "Undo", run: async () => { await safely(() => store.restoreRows(snap)); S.gsel = id; boardRedraw(); } });
}
async function boardSplit(n) { const t = await safely(() => store.splitToTree(n.id)); if (!t) return; S.gsel = n.parentId; await boardRedraw(); drawPageList(); toast(`${t.name} is its own graph`, { label: "Open", run: () => openGraphPage(t.id) }); }
function boardMenu(id, cx, cy, x, y) {
  const tr = treeOf(S.boardTree); if (!tr) return;
  const n = id && S.byId.get(id), under = n || S.byId.get(S.gsel) || S.byId.get(tr.rootId);
  if (n) { S.gsel = n.id; S.board.select(n.id); drawGraphFoot($("#gfoot"), tr); }
  const top = n && n.parentId == null;
  menu({ left: cx, right: cx + 1, top: cy, bottom: cy }, n ? [
    { label: "Add under", key: "Tab", run: () => boardAsk({ parentId: n.id }) },
    !top && { label: "Add beside", key: "↵", run: () => boardAsk({ parentId: n.parentId }) },
    { label: "Rename", key: "R", run: () => boardAsk({ id: n.id }) },
    { label: "Link to…", key: "L", run: () => boardLinkPick(n) },
    { label: "Graft onto…", key: "G", run: () => boardGraftPick(n) },
    !top && { label: "Make its own graph", key: "X", run: () => boardSplit(n) },
    { label: "Colour", key: "C", run: async () => { await cycleColour(n); boardRedraw(); } },
    { label: "Add question", key: "Q", run: () => editQuestion(n, -1) },
    { label: "Open in 3D", key: "⇧↵", run: () => openIdea(tr, n.id) },
    !top && { label: "Delete", key: "Del", danger: true, run: () => boardRemove(n.id) },
  ] : [{ label: `New idea here, under ${under.title}`, key: "", run: () => boardAsk({ parentId: under.id, at: { x, y } }) }]);
}
async function stitchGraphs(fromId, ontoId) {
  const a = treeOf(fromId), b = treeOf(ontoId); if (!a || !b) return;
  if (!(await dialog({ title: `Stitch ${a.name} onto ${b.name}?`, ok: "Stitch" }))) return;
  if (S.view === "notes" && S.boardTree === ontoId && S.board) return boardGraftTree(fromId, b.rootId);
  if ((await safely(() => store.graftTree(fromId, b.rootId))) === undefined) return;
  await refresh(); if (S.view === "notes") { if (S.boardTree === fromId) openGraphPage(ontoId); else drawPageList(); }
  toast(`${a.name} stitched onto ${b.name}`, { label: "Undo", run: async () => { await safely(() => store.splitToTree(a.rootId, { name: a.name, zoneId: a.zoneId })); await refresh(); if (S.view === "notes") { drawPageList(); boardRedraw(); } } });
}
async function moveGraph(treeId, zoneId) {
  const t = treeOf(treeId), z = S.zones.find((x) => x.id === zoneId); if (!t || !z || t.zoneId === zoneId) return;
  const was = t.zoneId;
  if (!(await safely(() => store.updateTree(treeId, { zoneId })))) return;
  await refresh(); if (S.view === "notes") { drawPageList(); drawPageBar(); }
  toast(`${t.name} moved to ${z.name}`, { label: "Undo", run: async () => { await safely(() => store.updateTree(treeId, { zoneId: was })); await refresh(); if (S.view === "notes") { drawPageList(); drawPageBar(); } } });
}
function openIdea(tr, id) { S.pendingSel = id; goTree(tr.id); }
function drawPageList() {
  drawGraphList(); drawWaterList();
  const host = $("#nlist"); if (!host) return;
  const rows = noteRows(), open = notesOpen();
  put(host, rows.map(({ p, depth, hit }, i) => {
    const kids = kidPages(p.id).length, folder = isFolder(p), isOpen = open.has(p.id);
    const row = el("div", { class: "nrow" + (p.id === (S.view === "notes" ? S.npage : S.sp) ? " on" : "") + (folder ? " folder" : ""), dataset: { id: p.id }, style: `--d:${depth}`, role: "treeitem", draggable: !hit,
      ondragstart: (e) => { S.ndrag = p.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); },
      ondragend: () => { S.ndrag = null; },
      ondragover: (e) => { if (S.ndrag && S.ndrag !== p.id) { e.preventDefault(); row.classList.add("drop"); } }, ondragleave: () => row.classList.remove("drop"),
      ondrop: (e) => { e.preventDefault(); row.classList.remove("drop"); if (S.ndrag) movePage(S.ndrag, p.id); }, oncontextmenu: (e) => pageRowMenu(p, e) },
      hit ? null : el("button", { class: "chev" + (kids || folder ? "" : " none"), type: "button", tabIndex: -1, "aria-label": isOpen ? "Close" : "Open", "aria-expanded": kids || folder ? String(isOpen) : null, onclick: () => { if (kids || folder) { setOpen(p.id, !isOpen); drawPageList(); } } }),
      el("button", { class: "nname", type: "button", onclick: () => pickPage(p.id) },
        icon(folder ? ICON.folder : p.kind === "ink" ? ICON.ink : ICON.page), el("span", { class: "nt", text: p.title || (folder ? "New folder" : "Untitled") }),
        hit && pagePath(p).length ? el("span", { class: "npath", text: pagePath(p).map((q) => q.title || "Untitled").join(" / ") }) : null),
      el("kbd", { text: i < 9 ? String(i + 1) : "", class: i < 9 ? "" : "blank" }),
      hit ? null : el("button", { class: "nadd", type: "button", tabIndex: -1, title: folder ? "New page in this folder" : "New page inside", "aria-label": "New page inside", onclick: () => newPage(p.id) }, "+"));
    return row;
  }), !rows.length ? el("p", { class: "muted nnone", text: S.nq ? "No matches" : "No pages yet" }) : null);
}
// the bar over the page: where it sits, and its menu
function drawPageBar() {
  const bar = $("#pbar"); if (!bar) return;
  const off = document.body.dataset.nbar === "off", g = graphPage(S.npage);
  const hide = () => el("button", { class: "ib sidehide", id: "sideHide", type: "button", title: (off ? "Show" : "Hide") + " the sidebar ([)", "aria-label": (off ? "Show" : "Hide") + " the sidebar", onclick: () => sideKey(true) }, icon(off ? ICON.sideOn : ICON.sideOff), el("kbd", { text: "[" }));
  if (g) {
    const z = S.zones.find((x) => x.id === g.zoneId), isl = S.garden?.islands.find((q) => q.zoneIds.includes(g.zoneId));
    const k3 = g3On(), seg = (id, label, on, run) => el("button", { class: "btn" + (on ? " on" : ""), id, "aria-pressed": String(on), onclick: run }, label);
    const crumb = (text, run) => el("button", { class: "sl0 link", type: "button", text, onclick: run });   // one click to the island or topic in the garden
    return put(bar, hide(), el("div", { class: "pcrumb" }, isl ? [crumb(isl.name, () => toGarden({ isle: isl.id })), el("span", { class: "sl", text: "/" })] : null, z ? [crumb(z.name, () => toGarden({ topic: z.id })), el("span", { class: "sl", text: "/" })] : null, el("span", { class: "here", text: g.name || "Untitled" })), el("span", { class: "grow" }),
      el("div", { class: "seg keys", role: "group", "aria-label": "View" }, seg("g2d", "2D", !k3, () => k3 && flipBoard()), seg("g3d", "3D", k3, () => !k3 && flipBoard()), el("kbd", { text: "V" })),
      el("button", { class: "btn" + (dockOn() ? " on" : ""), id: "gDock", "aria-pressed": String(dockOn()), title: "The other view in a little window (])", onclick: toggleDock }, k3 ? "Mini 2D" : "Mini 3D", el("kbd", { text: "]" })));
  }
  const p = pageOf(S.npage);
  if (!p) { bar.replaceChildren(); return; }
  put(bar, el("button", { class: "ib sidehide", id: "sideHide", type: "button", title: (off ? "Show" : "Hide") + " the sidebar ([)", "aria-label": (off ? "Show" : "Hide") + " the sidebar", onclick: () => sideKey(true) }, icon(off ? ICON.sideOn : ICON.sideOff), el("kbd", { text: "[" })),
    el("div", { class: "pcrumb" }, pagePath(p).map((q) => [el("button", { class: "link", type: "button", text: q.title || "Untitled", onclick: () => pickPage(q.id) }), el("span", { class: "sl", text: "/" })]),
      el("span", { class: "here", text: p.title || (isFolder(p) ? "New folder" : "Untitled") })),
    el("span", { class: "grow" }),
    p.grown?.length ? el("span", { class: "muted", text: `Grown ${p.grown.length}×` }) : null,
    ib("pageMore", "Page menu", ICON.more, (e) => pageMenu(p, e.currentTarget)));
}
function drawEditor() {
  const host = $("#nedit"); if (!host) return;
  S.ed?.destroy(); S.ed = null;
  drawPageBar();
  if (S.npage === VOCAB) return put(host, vocabView());
  const g = graphPage(S.npage); if (g) return put(host, graphBoard(g));
  const p = pageOf(S.npage);
  if (!p) { put(host, el("div", { class: "page none" }, el("button", { class: "btn", id: "firstPage", onclick: () => newPage() }, "New page", el("kbd", { text: "N" })))); return; }
  put(host, isFolder(p) ? folderView(p) : pageView(p, false));
}
function folderView(p) {
  const kids = kidPages(p.id);
  return el("article", { class: "page" }, titleInput(p, false),
    el("div", { class: "flist" }, kids.map((k) => el("button", { class: "frow", type: "button", onclick: () => pickPage(k.id) }, icon(isFolder(k) ? ICON.folder : k.kind === "ink" ? ICON.ink : ICON.page), el("span", { text: k.title || (isFolder(k) ? "New folder" : "Untitled") }),
      el("span", { class: "muted", text: fmtDate(k.updatedAt) }))),
      el("button", { class: "frow add", type: "button", id: "folderAdd", onclick: () => newPage(p.id) }, "+ New page")));
}
function titleInput(p, side) {
  return el("input", { id: side ? "sideTitle" : "pageTitle", class: "ptitle", value: p.title || "", placeholder: isFolder(p) ? "New folder" : "Untitled", maxLength: 120, "aria-label": "Title", autocomplete: "off",
    oninput: (e) => { queuePage(p.id, { title: e.target.value }); const r = $(`#nlist .nrow[data-id="${p.id}"] .nt`); if (r) r.textContent = e.target.value || "Untitled"; const h = $("#pbar .here"); if (h && !side) h.textContent = e.target.value || "Untitled"; const o = $(`#sidePage option[value="${p.id}"]`); if (o) o.textContent = e.target.value || "Untitled"; },
    onkeydown: (e) => { if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); if (S.ed) S.ed.focus("start"); else e.target.blur(); } } });
}
// A page to write on (ink.js): the title, properties folded away (D), then the page with the tool rail docked right.
const darkPage = () => { const c = getComputedStyle(document.body).getPropertyValue("--bg").trim(); return /^#/.test(c) && parseInt(c.slice(1, 3), 16) < 90; };
const inkPropsOpen = () => pref("inkprops", "0") === "1";
function foldInkProps() {
  setPref("inkprops", inkPropsOpen() ? "0" : "1");
  for (const v of document.querySelectorAll(".inkview")) { v.classList.toggle("propsopen", inkPropsOpen()); const b = v.querySelector(".inkfold"); b?.setAttribute("aria-expanded", String(inkPropsOpen())); }
  S.ed?.redraw?.();
}
function inkView(p, side) {
  const area = el("div", { class: "inkarea" });
  const ink = createInk({ host: area, el, store: PREF + "ink", global: !side, icon: (d) => icon(d), doc: p.ink, night: darkPage, onChange: (doc) => queuePage(p.id, { ink: doc }), toText: desktop ? () => inkToText(p, ink) : null });
  S.ed = { destroy: ink.destroy, flush: ink.flush, focus: ink.focus, redraw: ink.redraw, ink };
  const fold = el("button", { class: "inkfold", type: "button", "aria-expanded": String(inkPropsOpen()), title: "Properties (D)", onclick: foldInkProps }, icon(ICON.fold), el("span", { text: "Properties" }), el("kbd", { text: "D" }));
  return el("div", { class: "inkview" + (side ? " side" : "") + (inkPropsOpen() ? " propsopen" : "") }, el("article", { class: "page inkhead" + (side ? " side" : "") }, titleInput(p, side), fold, propsView(p)), area);
}
// Handwriting to text (Bonsai Desktop 0.2.0+, card n-ink2): Claude reads the page, or what the lasso holds, as a
// picture and writes it out as an outline; kept, it becomes a typed page beside the pen page, which stays as it is.
const INK_PROMPT = [
  "Transcribe my handwritten notes in the attached picture into a plain-text outline.",
  "- Keep my words and order. Fix only obvious slips of the pen; mark a word you can't read as [?].",
  "- Headings as \"# \", \"## \"; bullet points as \"- \", nested with two spaces; numbered lists as \"1. \"; a ticked or empty box as \"[x] \" or \"[] \".",
  "- Maths: write it inline in plain text, the way it would be typed (F = ma, v^2 = u^2 + 2as, ∫ f(x) dx).",
  "- A diagram: one line \"> Diagram: \" saying what it shows (boxes, arrows and labels), then carry on.",
  "- Reply with the outline only.",
].join("\n");
async function inkToText(p, ink) {
  if (!desktop) return toast("Handwriting to text runs in Bonsai Desktop");
  if (!canSee()) return toast("Update Bonsai Desktop to read handwriting");
  await flushPage();
  const sel = ink.selected, pic = ink.picture(sel); if (!pic) return toast("Nothing written yet");
  const reply = el("textarea", { id: "inkReply", rows: 10, placeholder: "The typed text", "aria-label": "The typed text",
    onkeydown: (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); reply.form?.requestSubmit(); } } });
  const copy = el("button", { type: "button", class: "btn", id: "inkCopy", hidden: true }, "Copy");
  const shot = el("img", { class: "inkshot", alt: "", src: "data:image/png;base64," + pic.data });
  const ok = await dialog({ title: sel.length ? "Selection to text" : p.title || "Page to text", ok: "Make a typed page", body: el("div", { class: "growd" }, shot, claudeRow(() => INK_PROMPT, reply, copy, { auto: true, images: [{ media_type: pic.media_type, data: pic.data }] }), reply) });
  const text = reply.value.trim(); if (!ok || !text) return;
  const page = await safely(() => store.addPage({ title: `${p.title || "Pen page"} (typed)`, parentId: p.parentId || null, blocks: textToBlocks(text), props: withStd([]) }));
  if (!page) return;
  S.pages.push({ ...page, props: withStd(page.props) }); drawPageList(); pickPage(page.id);
  toast("Typed page made", { label: "Undo", run: async () => { await safely(() => store.deletePage(page.id)); S.pages = S.pages.filter((x) => x.id !== page.id); pickPage(p.id); drawPageList(); } });
}
function pageView(p, side) {
  if (p.kind === "ink") return inkView(p, side);
  const body = el("div", { class: "pbody" });
  const blocks = (p.blocks || []).filter((b) => b.type !== "page" || pageOf(b.pageId));
  S.ed = createEditor({ host: body, blocks, key: p.id, onChange: (bl) => queuePage(p.id, { blocks: bl }), pageTitle,
    openPage: (id) => (S.view === "notes" ? pickPage(id) : (location.hash = notesHash(id))),
    newSubpage: async () => { const c = await safely(() => store.addPage({ parentId: p.id })); if (!c) return null; S.pages.push(c); setOpen(p.id, true); return c.id; } });
  vocab?.watch(body);
  return el("article", { class: "page" + (side ? " side" : "") }, titleInput(p, side), propsView(p), body);
}
// ---- properties at the top of a page, as in Notion ----
const propIcon = (type) => el("span", { class: "pg" }, icon(PI[type] || PI.text));
function propsView(p) {
  const box = el("div", { class: "props", id: "props" });
  const save = () => { p.props ||= []; queuePage(p.id, { props: p.props }); draw(); };
  const add = (type, label) => {
    const taken = new Set((p.props || []).map((x) => x.name)); let name = label, n = 2; while (taken.has(name)) name = `${label} ${n++}`;
    p.props = [...(p.props || []), { id: "pr" + Date.now().toString(36), name, type, value: type === "tags" ? [] : type === "checkbox" ? false : type === "status" ? "Raw" : "" }]; save();
    const last = [...box.querySelectorAll(".prow")].at(-1)?.querySelector(".pv"); if (last && type !== "checkbox" && type !== "created" && type !== "edited") (last.tagName === "INPUT" ? last.focus() : last.click());
  };
  const draw = () => put(box, (p.props || []).map((pr) => el("div", { class: "prow", dataset: { type: pr.type } },
      el("button", { class: "pname", type: "button", title: pr.name, onclick: (e) => propMenu(p, pr, e.currentTarget, save) }, propIcon(pr.type), el("span", { text: pr.name })),
      propValue(p, pr, save))),
    el("button", { class: "padd", type: "button", id: "propAdd", onclick: () => add("text", "Text") }, el("span", { class: "pg" }, icon(ICON.plus)), el("span", { text: "Add a property" })));
  draw(); return box;
}
function propValue(p, pr, save) {
  const set = (v) => { pr.value = v; queuePage(p.id, { props: p.props }); };   // the same objects, so the next keystroke edits what's saved
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
  const rename = { label: "Rename", run: async () => { const v = await dialog({ title: "Property", fields: [{ name: "n", label: "Name", value: pr.name, max: 40 }] }); if (v?.n.trim()) { pr.name = v.n.trim(); save(); } } };
  if (isStd(p, pr)) return menu(anchor, [rename]);
  menu(anchor, [
    { label: "Rename", run: async () => { const v = await dialog({ title: "Property", fields: [{ name: "n", label: "Name", value: pr.name, max: 40 }] }); if (v?.n.trim()) { pr.name = v.n.trim(); save(); } } },
    { label: "Type", run: () => menu(anchor, PROP_TYPES.map(([type, label]) => ({ label: (pr.type === type ? "✓ " : "") + label, run: () => {
      if (pr.type === type) return;
      const was = [].concat(pr.value ?? []).filter((x) => x !== "" && x != null && typeof x !== "boolean").map(String);
      pr.value = type === "tags" ? was : type === "select" ? was[0] || "" : type === "status" ? (STATUSES.some((x) => x[0] === was[0]) ? was[0] : "Raw") : type === "checkbox" ? false : type === "date" ? (/^\d{4}-\d{2}-\d{2}$/.test(was[0] || "") ? was[0] : "") : ["text", "url", "email", "phone"].includes(type) ? was.join(", ") : "";
      pr.type = type; save();
    } }))) },
    { label: "Move up", disabled: p.props.indexOf(pr) <= STD_PROPS.length, run: () => { const i = p.props.indexOf(pr); p.props.splice(i - 1, 0, ...p.props.splice(i, 1)); save(); } },
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
  await flushPage(); if (S.view === "notes") S.npage = id;
  if (S.view === "notes") {
    if (!S.nq) for (const q of pagePath(p)) setOpen(q.id, true);
    setNotesHash(); drawPageList(); drawEditor(); renderActions();
    if (keepFocus) $("#notesSearch")?.focus();
  } else {
    if (isFolder(p)) { setOpen(p.id, !notesOpen().has(p.id)); return drawPageList(); }
    S.sp = id; S.sideFor = null; renderSide();
  }
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
  if (parentId === null && S.view === "notes" && isFolder(pageOf(S.npage)) && kind !== "folder") parentId = S.npage;   // new pages go in the open folder
  await flushPage();
  const p = await safely(() => store.addPage({ parentId, kind })); if (!p) return;
  const par = pageOf(parentId);
  if (par && !isFolder(par)) await safely(() => store.updatePage(parentId, { blocks: [...(par.blocks || []), { id: "b" + Date.now().toString(36), type: "page", pageId: p.id, html: "", indent: 0 }] }));   // like Notion: a link in the page it's in
  if (parentId) setOpen(parentId, true);
  await load(); S.nq = ""; if ($("#notesSearch")) $("#notesSearch").value = "";
  if (S.view === "notes") { S.npage = p.id; setNotesHash(); drawPageList(); drawEditor(); renderActions(); } else { S.sp = kind === "folder" ? S.sp : p.id; S.nside = true; S.sideFor = null; renderSide(); }
  const ti = $(S.view === "notes" ? "#pageTitle" : "#sideTitle"); ti?.focus(); ti?.select();
}
async function movePage(id, toId) {
  const p = pageOf(id); if (!p || id === toId || (p.parentId || null) === (toId || null)) return;
  await flushPage();
  if (await safely(() => store.updatePage(id, { parentId: toId || null, order: Date.now() }))) { if (toId) setOpen(toId, true); await load(); if (S.view === "notes") S.npage = id; redrawNotes(); }
}
async function removePage(id) {
  await flushPage();
  const gone = await safely(() => store.deletePage(id)); if (!gone?.length) return;
  if (gone.some((g) => g.id === S.sp)) S.sp = null;
  if (gone.some((g) => g.id === S.npage)) { const rows = noteRows().map((r) => r.p.id).filter((x) => !gone.some((g) => g.id === x)); S.npage = rows[0] || null; }
  S.ed?.destroy(); S.ed = null;
  await load(); redrawNotes();
  toast(gone.length > 1 ? `Deleted ${gone.length} pages` : isFolder(gone[0]) ? "Folder deleted" : "Page deleted", { label: "Undo", run: async () => { await store.putPages(gone); await load(); if (S.view === "notes") S.npage = gone[0].id; redrawNotes(); } });
}
function redrawNotes() {
  if (S.view === "notes") { setNotesHash(); drawPageList(); drawEditor(); renderActions(); renderTop(); }
  else { S.sideFor = null; renderSide(); drawPageList(); }
}
// where a page can be moved to: the top level, or any folder or page that isn't inside it
function moveMenu(p, anchor) {
  const inside = new Set([p.id]); { const st = [p.id]; while (st.length) { const x = st.pop(); for (const c of S.pages.filter((q) => q.parentId === x)) { inside.add(c.id); st.push(c.id); } } }
  const spots = S.pages.filter((q) => !inside.has(q.id)).sort((a, b) => isFolder(b) - isFolder(a) || (a.title || "").localeCompare(b.title || ""));
  menu(anchor, [{ label: (p.parentId ? "" : "✓ ") + "Top level", run: () => movePage(p.id, null) }, "-",
    ...spots.map((q) => ({ label: (p.parentId === q.id ? "✓ " : "") + [...pagePath(q), q].map((x) => x.title || (isFolder(x) ? "New folder" : "Untitled")).join(" / "), run: () => movePage(p.id, q.id) }))]);
}
// right-click a row in the Library: what you can do with that page, graph, topic or island
const atPointer = (e) => ({ left: e.clientX, right: e.clientX + 1, top: e.clientY, bottom: e.clientY });
function pageRowMenu(p, e) {
  e.preventDefault(); const folder = isFolder(p);
  menu(atPointer(e), [
    !folder && { label: "Open", key: "↵", run: () => pickPage(p.id) },
    { label: "Rename", key: "R", run: async () => { const v = await dialog({ title: folder ? "Rename folder" : "Rename page", fields: [{ name: "t", label: "Name", value: p.title || "" }], ok: "Rename" }); if (v?.t?.trim()) { const t = v.t.trim(); queuePage(p.id, { title: t }); await flushPage(); p.title = t; drawPageList(); if (S.npage === p.id) drawEditor(); } } },
    { label: folder ? "New page in this folder" : "New page inside", run: () => newPage(p.id) },
    { label: folder ? "New pen page in this folder" : "New pen page inside", run: () => newPage(p.id, "ink") },
    folder && { label: "New folder inside", run: () => newPage(p.id, "folder") },
    { label: "Move to", run: () => moveMenu(p, atPointer(e)) },
    !folder && p.kind !== "ink" && { label: "Grow into a knowledge graph", key: "G", run: () => growDialog(p.id) },
    p.grown?.length && { label: "Take back the last grow", run: () => ungrow(p.id) },
    "-", { label: folder ? "Delete folder" : "Delete page", key: "Del", danger: true, run: () => removePage(p.id) },
  ]);
}
function shelfMenu(key, e) {
  e.preventDefault(); const k = key.replace(/^w/, ""), id = k.slice(2);
  if (k.startsWith("t:")) {
    const z = S.zones.find((x) => x.id === id), due = (S.trees.filter((t) => t.zoneId === id)).flatMap((t) => dueList(t.id)).map((n) => n.id);
    return menu(atPointer(e), [{ label: "New knowledge graph here", key: "N", run: () => newGraph(id) }, due.length && { label: `Water ${due.length}`, key: "W", run: () => water(due) },
      { label: "Show in the garden", run: () => toGarden({ topic: id }) }, { label: "Knowledge graphs", run: () => openScope(id) }, z && { label: "Tech tree", key: "K", run: () => { location.hash = "#/techtree/" + id; } }]);
  }
  if (k.startsWith("i:") && id !== "_loose") menu(atPointer(e), [{ label: "Show in the garden", run: () => toGarden({ isle: id }) }, { label: "Knowledge graphs", run: () => openScope(id) }]);
}
function pageMenu(p, anchor) {
  menu(anchor, [
    !isFolder(p) && p.kind !== "ink" && { label: "Grow into a knowledge graph", key: "G", run: () => growDialog(p.id) },
    p.grown?.length && { label: "Take back the last grow", run: () => ungrow(p.id) },
    { label: isFolder(p) ? "New page in this folder" : "New page inside", run: () => newPage(p.id) },
    { label: "Move to", run: () => moveMenu(p, anchor) },
    "-", { label: isFolder(p) ? "Delete folder" : "Delete page", key: "Del", danger: true, run: () => removePage(p.id) },
  ]);
}
// Asking Claude from a dialog. In Bonsai Desktop, Ask Claude fills the reply box straight from Claude Code on this
// computer (his plan, no key); elsewhere it's the copy and paste round trip. Either way he checks the reply before it's kept.
function claudeRow(getPrompt, reply, copy, { auto = false, images = null } = {}) {
  const open = el("a", { class: "btn", href: "https://claude.ai/new", target: "_blank", rel: "noopener", text: "Open Claude" });
  if (!desktop) return el("div", { class: "row" }, copy, open);
  copy.classList.remove("primary");
  let job = null; const hint = reply.placeholder;
  const fill = (t) => { if (!ask.isConnected) return job?.cancel(); reply.value = t; reply.dispatchEvent(new Event("input", { bubbles: true })); };
  const ask = el("button", { type: "button", class: "btn primary", id: "askClaude", onclick: async () => {
    if (job) return job.cancel();
    const bad = liveProblem(await liveStatus()); if (bad) return toast(bad);
    ask.textContent = "Stop"; reply.readOnly = true; reply.placeholder = "Claude is writing";
    job = askClaude(getPrompt(), { onText: fill, images });
    const r = await job.done; job = null;
    ask.textContent = "Ask Claude"; reply.readOnly = false; reply.placeholder = hint;
    if (r.ok) fill(r.text); else if (r.code !== "cancelled" && ask.isConnected) toast(r.message || "Claude didn't answer");
  } }, "Ask Claude");
  if (auto) setTimeout(() => ask.isConnected && ask.click(), 0);
  return el("div", { class: "row" }, ask, copy);
}
// Grow: Claude reads the page and says which ideas it holds and how they string onto a topic's graphs.
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
  const body = el("div", { class: "growd" }, el("label", {}, el("span", { text: "Topic" }), topic), claudeRow(() => prompt, reply, copy), reply, sum, box);
  const ok = await dialog({ title: "Grow into a knowledge graph", ok: "Grow", body });
  if (!ok) return;
  check();
  if (!plan || !(plan.added || plan.links.length)) return toast(plan ? "Nothing new" : "Not a Bonsai reply");
  setPref("growZone", zoneId);
  const made = await safely(() => store.growPage(page.id, plan, zoneId)); if (!made) return;
  await setPageStatus(page.id, "Grown");
  await refresh(); redrawNotes();
  const n = made.nodeIds.length, l = made.linkIds.length;
  toast(`Grew ${n} idea${n === 1 ? "" : "s"}${l ? `, ${l} link${l === 1 ? "" : "s"}` : ""}`, { label: "Undo", run: () => ungrow(page.id) });
}
async function setPageStatus(id, value) {
  await load(); const p = pageOf(id); if (!p) return;
  const props = (p.props || []).map((x) => ({ ...x })), st = props.find((x) => x.type === "status");
  if (st) st.value = value; else props.push({ id: "pr" + Date.now().toString(36), name: "Status", type: "status", value });
  await safely(() => store.updatePage(id, { props }));
}
async function ungrow(id) {
  const made = await safely(() => store.ungrowPage(id)); if (!made) return;
  await load(); const p = pageOf(id); if (p && !(p.grown || []).length && statusOf(p) === "Grown") await setPageStatus(id, "Tidied");
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
function notesKey(k, stop, e = {}) {
  if (e.shiftKey && /^Digit[123]$/.test(e.code || "")) { stop(); return setLibTab(LIBTABS[+e.code.slice(5) - 1][0]); }
  const rows = noteRows().map((r) => r.p), i = rows.findIndex((p) => p.id === S.npage), p = pageOf(S.npage);
  if (k === "v" && e.shiftKey) { stop(); return openVocab(); }
  if (S.npage === VOCAB) {
    if (k === "n") { stop(); return editTerm({}); }
    if (k === "f") { stop(); return $("#vocabSearch")?.focus(); }
  }
  const g = graphPage(S.npage);
  if (g) {
    const n = S.byId.get(S.gsel), top = n?.parentId == null, lk = S.glink && S.links.find((x) => x.id === S.glink);
    if (lk && (k === "Delete" || k === "Backspace")) { stop(); return removeLink(lk.id); }
    if (lk && (k === "r" || k === "F2")) { stop(); return labelLink(lk); }
    if (/^[1-9]$/.test(k)) { const id = [...S.num.entries()].find(([, x]) => x === +k)?.[0]; if (id) { stop(); return S.boardPick?.(id); } }
    if (k === "Enter" && e.shiftKey) { stop(); return openIdea(g, S.gsel || g.rootId); }
    if (k === "Tab") { stop(); return boardAsk({ parentId: n?.id || g.rootId }); }
    if (k === "Enter") { stop(); return boardAsk({ parentId: n && !top ? n.parentId : g.rootId }); }
    if (n) {
      if (k === "r" || k === "F2") { stop(); return boardAsk({ id: n.id }); }
      if (k === "Delete" || k === "Backspace") { stop(); return boardRemove(n.id); }
      if (k === "l") { stop(); return boardLinkPick(n); }
      if (k === "g") { stop(); return boardGraftPick(n); }
      if (k === "x" && !top) { stop(); return boardSplit(n); }
      if (k === "c") { stop(); return cycleColour(n).then(() => boardRedraw()); }
      if (k === "q") { stop(); return editQuestion(n, -1); }
    }
    if (k === "0") { stop(); return S.board?.fit(); }
    if (k === "v" && !e.shiftKey) { stop(); return flipBoard(); }
    if (k === "w") { stop(); return thirstyOf(g) ? water(null, g.id) : toast("Nothing to water"); }
    if (/^[nfwd]$/.test(k) || (k === "v" && e.shiftKey)) return;   // nothing else of the notes' own keys on a board, bar new note, folder, pen, vocab
  }
  if (k === "n" && libTab() === "graphs") { stop(); return newGraph(); }
  if (k === "w" && libTab() === "water") { stop(); return thirstyGraphs().length ? water(null) : toast("Nothing to water"); }
  if (k === "n") { stop(); return newPage(); }
  if (k === "f") { stop(); return newPage(null, "folder"); }
  if (k === "w") { stop(); return newPage(null, "ink"); }
  if (k === "d" && p?.kind === "ink") { stop(); return foldInkProps(); }
  if (k === "g" && p && !isFolder(p) && p.kind !== "ink") { stop(); return growDialog(p.id); }
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
// ---------- vocab: terms underlined across your notes, with nested panels (vocab.js) ----------
const VOCAB = "vocab";
let vocab = null, selPanel = null;
const google = (q) => window.open("https://www.google.com/search?q=" + encodeURIComponent(q), "_blank", "noopener");
const notePageTitle = () => (S.view === "notes" ? pageOf(S.npage) : pageOf(S.sp))?.title || "";
// The quick panel on words selected in a note (Alt+1… while it shows). Over a term already kept, it opens that term instead of adding.
function selActions(sel) {
  const id = vocab.termFor(sel.text), g = id && S.vocab.find((t) => t.id === id);
  return g ? [
    { id: "open", label: g.term, run: () => { getSelection()?.collapseToEnd(); vocab.open(g.id, { range: sel.range }, { locked: true }); } },
    { id: "context", label: "Add context", run: () => editTerm({ id: g.id, focus: "def" }) },
    { id: "claude", label: "Flesh out", run: () => fleshOut({ termId: g.id }) },
    { id: "google", label: "Google", run: () => google(sel.text) },
  ] : [
    { id: "add", label: "Add to vocab", run: () => quickAdd(sel) },
    { id: "context", label: "Add context", run: () => editTerm({ term: sel.text, quote: sel.quote, source: notePageTitle(), focus: "def" }) },
    { id: "claude", label: "Flesh out", run: () => fleshOut({ term: sel.text, quote: sel.quote, source: notePageTitle() }) },
    { id: "google", label: "Google", run: () => google(sel.text) },
  ];
}
async function quickAdd(sel) {
  const term = sel.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!term) return;
  const doc = { id: store.uid(), term, aliases: [], def: "", quote: sel.quote || "", source: notePageTitle(), at: new Date().toISOString(), editedAt: new Date().toISOString() };
  await saveVocab([...S.vocab, doc]);
  toast(`Added ${term}`, { label: "Edit", run: () => editTerm({ id: doc.id, focus: "def" }) });
}
// Flesh out with Claude: copy a prompt, paste the reply back, then check it in the term's editor before it's kept.
async function fleshOut({ termId, term, quote = "", source = "" }) {
  const g = termId && S.vocab.find((t) => t.id === termId), name = g?.term || term; if (!name) return;
  const prompt = fleshPrompt({ term: name, quote: g?.quote || quote, page: g?.source || source, def: g?.def || "", known: S.vocab.filter((t) => t !== g).map((t) => t.term) });
  const reply = el("textarea", { id: "fleshReply", rows: 7, placeholder: "Claude's reply", "aria-label": "Claude's reply",
    onkeydown: (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); reply.form?.requestSubmit(); } } });
  const box = el("textarea", { id: "fleshPrompt", readOnly: true, rows: 4, hidden: true, "aria-label": "For Claude", value: prompt });
  const copy = el("button", { type: "button", class: "btn primary", id: "fleshCopy", onclick: async () => { try { await navigator.clipboard.writeText(prompt); copy.textContent = "Copied"; } catch { box.hidden = false; box.focus(); box.select(); } } }, "Copy for Claude");
  S.lastPrompt = prompt;
  const ok = await dialog({ title: "Flesh out " + name, ok: "Use this", body: el("div", { class: "growd" }, claudeRow(() => prompt, reply, copy, { auto: true }), box, reply) });
  if (!ok) return;
  const r = readFlesh(reply.value, name); if (!r.def) return toast("Nothing in the reply");
  const def = g?.def ? g.def + "\n\n" + r.def : r.def, aliases = [...new Set([...(g?.aliases || []), ...r.aliases])].filter((a) => a.toLowerCase() !== name.toLowerCase());
  return editTerm({ id: g?.id, term: name, def, aliases, quote: g?.quote || quote, source: g?.source || source, focus: "def" });
}
async function openVocab() {
  if (S.view !== "notes") { location.hash = notesHash(VOCAB); return; }
  await flushPage(); S.npage = VOCAB; setNotesHash(); drawPageList(); drawEditor(); renderActions();
  for (const b of document.querySelectorAll(".nvocab")) b.classList.add("on");
}
const pageText = (p) => { const d = document.createElement("div"); d.innerHTML = (p.blocks || []).filter((b) => b.type !== "code").map((b) => b.html || "").join("\n"); return (p.title || "") + "\n" + d.textContent; };
// the pages a term appears in, in sidebar order
function seenIn(id) { return S.pages.filter((p) => !isFolder(p) && vocab.findIn(pageText(p)).some((h) => h.id === id)); }
async function saveVocab(list, note) {
  S.vocab = list; await safely(() => store.setMeta("vocab", list)); vocab.reindex();
  for (const c of document.querySelectorAll(".vcount")) c.textContent = String(list.length || "");
  if (S.view === "notes") { drawPageList(); if (S.npage === VOCAB) drawVocabList(); }
  if (note) toast(note.text, note.undo ? { label: "Undo", run: note.undo } : undefined);
}
async function editTerm({ id, term = "", def = "", source = "", quote = "", aliases = null, focus = "" }) {
  const was = (S.vocab || []).find((t) => t.id === id) || (term && (S.vocab || []).find((t) => t.term.toLowerCase() === term.trim().toLowerCase()));
  const v = await dialog({ title: was ? was.term : "New term", ok: was ? "Save" : "Add", fields: [
    { name: "term", label: "Term", value: was?.term || term, max: 120 },
    { name: "aka", label: "Also called", value: (aliases || was?.aliases || []).join(", "), required: false, placeholder: "Other names, abbreviations, comma between", max: 300 },
    { name: "def", label: "Meaning", type: "textarea", value: def || was?.def || "", autofocus: focus === "def", placeholder: "In your own words. Other terms you name here link to their own panels." },
    { name: "source", label: "Where from", value: was?.source || source, required: false, max: 300 }] });
  if (!v || !v.term.trim()) return;
  const t = v.term.trim(), dupe = !was && (S.vocab || []).find((x) => x.term.toLowerCase() === t.toLowerCase()), base = was || dupe;
  const doc = { id: base?.id || store.uid(), term: t, aliases: v.aka.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12), def: (v.def || "").trim(), source: (v.source || "").trim(), quote: base?.quote || quote || "", at: base?.at || new Date().toISOString(), editedAt: new Date().toISOString() };
  await saveVocab([...(S.vocab || []).filter((x) => x.id !== doc.id), doc]);
  return doc;
}
async function removeTerm(id) {
  const before = S.vocab, g = before.find((t) => t.id === id); if (!g) return;
  await saveVocab(before.filter((t) => t.id !== id), { text: `Removed ${g.term}`, undo: () => saveVocab(before) });
}
// The vocab page: search, sort, and a card per term
function vocabView() {
  const search = el("input", { id: "vocabSearch", type: "text", placeholder: "Search vocab", "aria-label": "Search vocab", autocomplete: "off", value: S.vq || "",
    oninput: (e) => { S.vq = e.target.value; drawVocabList(); }, onkeydown: (e) => { if (e.key === "Escape" && e.target.value) { e.preventDefault(); e.stopPropagation(); S.vq = ""; e.target.value = ""; drawVocabList(); } } });
  const sorts = [["az", "A–Z"], ["new", "Newest"], ["page", "By page"]], now = S.vsort || "az";
  const seg = el("div", { class: "nfilter vsort", role: "group", "aria-label": "Sort" }, sorts.map(([v, text]) => el("button", { class: "nf" + (v === now ? " on" : ""), type: "button", dataset: { sort: v }, "aria-pressed": String(v === now), text,
    onclick: (e) => { S.vsort = v; for (const b of e.currentTarget.parentElement.children) { b.classList.toggle("on", b.dataset.sort === v); b.setAttribute("aria-pressed", String(b.dataset.sort === v)); } drawVocabList(); } })));
  return el("article", { class: "page vocab" }, el("h1", { class: "ptitle", text: "Vocab" }),
    el("div", { class: "vtools" }, search, el("kbd", { text: "F" }), seg, el("span", { class: "grow" }), el("button", { class: "btn primary", id: "newTerm", type: "button", onclick: () => editTerm({}) }, "+ Term", el("kbd", { text: "N" }))),
    el("div", { class: "vlist", id: "vlist" }, vocabCards()));
}
function drawVocabList() { const host = $("#vlist"); if (host) put(host, vocabCards()); }
function vocabCards() {
  const q = (S.vq || "").trim().toLowerCase(), all = (S.vocab || []).filter((t) => !q || [t.term, ...(t.aliases || []), t.def || ""].some((x) => x.toLowerCase().includes(q)));
  if (!all.length) return [el("p", { class: "muted", text: q ? "No matches" : "No terms yet" })];
  const card = (t, seen) => el("div", { class: "vcard", dataset: { id: t.id } },
    el("div", { class: "row" }, el("button", { class: "vterm", type: "button", onclick: () => editTerm({ id: t.id }) }, el("b", { text: t.term }), t.aliases?.length ? el("span", { class: "muted", text: " · " + t.aliases.join(", ") }) : null),
      el("span", { class: "grow" }), ib(null, "Remove " + t.term, ICON.close, () => removeTerm(t.id))),
    t.def ? el("div", { class: "vdef" }, t.def.split(/\n{2,}/).filter((x) => x.trim()).map((x) => vocab.marked(x.trim(), t.id))) : el("p", { class: "muted", text: "No meaning yet" }),
    t.quote ? el("blockquote", { class: "vquote", text: t.quote }) : null,
    seen.length ? el("div", { class: "vseen" }, seen.map((p) => el("button", { class: "chip", type: "button", text: p.title || "Untitled", onclick: () => pickPage(p.id) }))) : null);
  const seen = new Map(all.map((t) => [t.id, seenIn(t.id)])), sort = S.vsort || "az";
  if (sort === "page") {
    const groups = new Map(); for (const t of all) { const p = seen.get(t.id)[0]; const k = p ? p.id : ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
    const order = [...S.pages.filter((p) => groups.has(p.id)).map((p) => p.id), ...(groups.has("") ? [""] : [])];
    return order.map((k) => el("section", { class: "vgroup" }, el("h3", { text: k ? pageOf(k)?.title || "Untitled" : "Not in a page yet" }), groups.get(k).sort((a, b) => a.term.localeCompare(b.term)).map((t) => card(t, seen.get(t.id)))));
  }
  const list = [...all].sort(sort === "new" ? (a, b) => (b.at || "").localeCompare(a.at || "") : (a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
  return list.map((t) => card(t, seen.get(t.id)));
}

// In a knowledge graph, O pulls notes up beside it: the same sidebar as the notes window, and a page beside it once one is picked.
function toggleSide() { S.nside = !S.nside; S.sp = null; S.sideFor = null; if (!S.nside) flushPage(); renderSide(); renderTop(); }
function renderSide() {
  const box = $("#nside"), on = S.nside && S.view === "tree" && S.tree;
  if (on && S.sp && (!pageOf(S.sp) || isFolder(pageOf(S.sp)))) S.sp = null;
  document.body.dataset.nside = on ? (S.sp ? "page" : "list") : "";
  if (S.panel && (document.body.dataset.wide === "1") !== isWide()) queueMicrotask(renderPanel);
  if (!on) { if (!box.hidden) { flushPage(); if (S.view !== "notes") { S.ed?.destroy(); S.ed = null; } box.hidden = true; box.replaceChildren(); S.sideFor = null; } return; }
  const sig = (S.sp || "") + "/" + S.pages.length;
  if (S.sideFor === sig && !box.hidden) return drawPageList();
  flushPage(); S.ed?.destroy(); S.ed = null;
  S.sideFor = sig; box.hidden = false;
  const p = pageOf(S.sp);
  put(box, notesSidebar(closeBtn("sideClose", "Close notes", "[", toggleSide)),
    p ? el("section", { class: "nmain" },
      el("div", { class: "pbar" }, el("div", { class: "pcrumb" }, pagePath(p).map((q) => [el("span", { text: q.title || "Untitled" }), el("span", { class: "sl", text: "/" })]), el("span", { class: "here", text: p.title || "Untitled" })),
        el("span", { class: "grow" }), ib("sideMore", "Page menu", ICON.more, (e) => pageMenu(p, e.currentTarget)), ib("sideShut", "Close the page", ICON.back, () => { flushPage(); S.sp = null; S.sideFor = null; renderSide(); })),
      el("div", { class: "nedit" }, pageView(p, true))) : null);
  drawPageList();
}
// [ closes or opens the menu on the left, ] the one on the right.
function sideKey(left) {
  if (S.view === "tree") { if (left) return toggleSide(); if (S.panel) { S.panel = null; return renderPanel(); } return togglePanel(); }
  if (S.view === "meaning" && !left) { if (S.panel) { S.panel = null; return renderPanel(); } return togglePanel(); }
  if (S.view === "notes" && !left && graphPage(S.npage)) return toggleDock();
  if (S.view === "notes" && left) { const off = document.body.dataset.nbar !== "off"; document.body.dataset.nbar = off ? "off" : ""; drawPageBar(); return; }
  if (S.view === "isles" && !left) { gfold = !gfold; renderGarden(); renderTop(); return; }
  if (S.panel && !left) { S.panel = null; renderPanel(); }
}
// Garden, Knowledge and Notes are three windows; Shift+Tab goes round them.
const winOf = (v) => (v === "isles" || v === "garden" ? "garden" : v === "notes" ? "notes" : "knowledge");
function goWindow(w) {
  if (S.review || S.pick) return;
  const now = winOf(S.view); if (w === now) return;
  if (now === "knowledge") S.lastKnowledge = location.hash || "#/forest";
  if (now === "garden" && w === "knowledge" && S.view === "isles") {   // from the garden, Knowledge shows what's picked there
    const isl = S.model?.[S.isle], t = isl?.topics[S.topic], hub = S.hub >= 0 ? S.hubs[S.hub] : null, id = t?.id || isl?.id || hub?.id;
    if (id) return openScope(id);
  }
  location.hash = w === "garden" ? "#/" : w === "notes" ? S.lastNotes || notesHash() : S.lastKnowledge || "#/forest";
}
function winSwitch() {
  const now = winOf(S.view), due = dueList(null).length;
  const b = (w, id, label, d, extra) => el("button", { class: "ws" + (now === w ? " on" : ""), id, type: "button", title: `${label} (Shift+Tab)`, "aria-pressed": String(now === w), onclick: () => goWindow(w) }, icon(d), el("span", { class: "wl", text: label }), extra);
  return el("div", { class: "winseg", role: "group", "aria-label": "Window" },
    b("garden", "winGarden", "Garden", ICON.sprout, now !== "garden" && due ? el("span", { class: "thirst", text: String(due) }) : null),
    b("knowledge", "winKnowledge", "Knowledge", ICON.graph),
    b("notes", "winNotes", "Library", ICON.page), el("kbd", { class: "wsk", text: "⇧Tab" }));
}

// ---------- start ----------
async function init() {
  T = theme();
  try { stage = new Stage($("#stage")); }
  catch { $("#empty").hidden = false; put($("#empty"), el("p", { text: "3D is turned off in this browser." })); return; }
  stage.setTheme(T);
  stage.isPaused = () => overlayOpen() || !!S.review || S.view === "tech";
  stage.onTap = onTap; stage.labelOpacity = labelOpacity; stage.onGrab = grabIdea; stage.onDouble = onDouble; stage.onMenu = onMenu;
  vocab = createVocab({ el, pinIcon: () => icon(ICON.pin), panelActions: (g, done) => [el("button", { class: "btn", type: "button", dataset: { act: "claude" }, onclick: () => { done(); fleshOut({ termId: g.id }); } }, "Claude"), el("button", { class: "btn", type: "button", dataset: { act: "google" }, onclick: () => google(g.term) }, "Google")], terms: () => S.vocab || [], onEdit: (id) => editTerm({ id }), seenIn, openPage: (id) => { if (S.view === "notes") pickPage(id); else location.hash = notesHash(id); } }); vocab.reindex();
  selPanel = createQuick({ el, roots: () => [...document.querySelectorAll(".page .blocks")], actions: selActions });
  S.joined = pref("joined", "0") === "1"; S.thirsty = pref("thirsty", "1") === "1";
  if (desktop) desktopUpdate().then((u) => { S.desk = u; });
  stage.labelRank = (L) => (L.id === S.sel || (!ideaView() && L.id === S.fsel) ? 0 : S.near.has(L.id) ? 1 + L.depth * 0.01 : 2 + L.depth);
  stage.onHover = (hit, e) => {
    stage.container.style.cursor = hit && !(S.view === "forest" && hit.kind === "link") ? "pointer" : "";
    if (hit?.kind === "node" && (ideaView() || (S.view === "forest" && S.forest?.joined && S.byId.has(hit.id)))) showHover(hit.id, e.clientX, e.clientY); else hideHover();
  };
  stage.container.addEventListener("pointerdown", hideHover);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { retheme(); rebuild(); });
  window.addEventListener("hashchange", go);
  window.addEventListener("keydown", (e) => { if (e.key === "Tab" && (e.shiftKey || S.view === "isles") && document.activeElement === document.body) e.preventDefault(); onKey(e); });
  $("#importFile").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importBackup(f); });
  store.requestPersistence();
  S.aiOn = !!(await store.getMeta("ai").catch(() => false));
  if (S.aiOn) ai.loadCache().catch(() => {});
  if (CHANNEL) {   // the beta starts with demo islands to test against
    document.body.dataset.channel = CHANNEL;
    const c = await store.counts().catch(() => null);
    if (c && !c.zones && !(await store.getMeta("demo").catch(() => null))) await store.importAll(demoBackup());
  }
  window.bonsai = { S, store, sync, refresh, get stage() { return stage; }, get isles() { return isles; }, get tech() { return tech; }, get vocab() { return vocab; }, thirst, water, openTree, graphItems, dueByLevel, setLevel, zoneLevel,
    timelapse: { set secs(v) { tlSecs = v; }, get state() { return S.tl; } },
    sunday: { list: () => store.listSundays(), start: startSunday, setClock: (t) => { sunClock = t == null ? null : +new Date(t); renderTop(); }, get due() { return sundayDue(); } } };
  await go();
  document.body.dataset.ready = "1";
  syncStart();
}
init();
