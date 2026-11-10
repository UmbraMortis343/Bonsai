// Bonsai: the 3D forest, the 3D tree, and everything you do in them.
import * as store from "./store.js";
import * as srs from "./srs.js";
import { Stage, THREE } from "./stage.js";
import { Flora, grid, ring, pot } from "./flora.js";
import { layoutTree, layoutForest } from "./layout.js";
import { md } from "./md.js";
import { $, el, put, toast, dialog, menu, overlayOpen, closeTop, closeAll } from "./dom.js";

const PALETTE = [["Blue", "#3b82f6"], ["Violet", "#8b5cf6"], ["Pink", "#ec4899"], ["Red", "#ef4444"], ["Orange", "#f97316"], ["Amber", "#f59e0b"], ["Green", "#22c55e"], ["Teal", "#14b8a6"], ["Cyan", "#06b6d4"]];
const SWATCHES = [["Auto", ""], ...PALETTE];
// Garden colours: how well each idea is being kept alive.
const G = { leaf: "#22c55e", thirsty: "#f59e0b", dry: "#a8a29e", stem: "#65a30d", pot: "#c2714f" };
const DAY = 86400000;
const ICON = {
  back: "M15 5l-7 7 7 7", close: "M6 6l12 12M18 6L6 18", plus: "M12 5v14M5 12h14", more: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4", inbox: "M4 13l3-8h10l3 8v6H4zM4 13h5a3 3 0 0 0 6 0h5", play: "M8 5l11 7-11 7z", pause: "M8 5v14M16 5v14",
};
const icon = (d) => el("span", { class: "ic", html: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>` });
const ib = (id, label, d, onclick) => el("button", { class: "ib", id, title: label, "aria-label": label, onclick }, icon(d));
const shell = window.bonsaiShell || { version: "dev", check: async () => "latest", canInstall: () => false, install() {} };

const S = {
  view: "", zones: [], trees: [], nodes: [], links: [], inbox: [], patches: [], allZones: [], allTrees: [],
  byId: new Map(), kids: new Map(), byTree: new Map(), near: new Set(), lastChild: new Map(),
  tree: null, sel: null, panel: null, pick: null, quick: null, review: null, cutoff: null, stitch: false, editBody: false,
  flora: null, lay: null, forest: null, fsel: null, pendingSel: null,
};
let stage, T, labelEls = new Map(), decor = [], selMesh, playTimer = 0;

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
  const [zones, trees, nodes, links, inbox, patches] = await Promise.all([store.allZones(), store.allTrees(), store.allNodes(), store.allLinks(), store.listInbox(), store.listPatches()]);
  S.allZones = zones; S.allTrees = trees; S.nodes = nodes; S.links = links; S.inbox = inbox; S.patches = patches;
  S.zones = zones.filter((z) => !z.archived).sort(byOrder);
  const ok = new Set(S.zones.map((z) => z.id));
  S.trees = trees.filter((t) => !t.archived && ok.has(t.zoneId)).sort(byOrder);
  S.byId = new Map(nodes.map((n) => [n.id, n])); S.kids = new Map(); S.byTree = new Map();
  for (const n of nodes) {
    if (!S.byTree.has(n.treeId)) S.byTree.set(n.treeId, []); S.byTree.get(n.treeId).push(n);
    if (n.parentId != null) { if (!S.kids.has(n.parentId)) S.kids.set(n.parentId, []); S.kids.get(n.parentId).push(n); }
  }
  for (const l of S.kids.values()) l.sort(byOrder);
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
const rebuild = () => (S.view === "tree" ? buildTree(false) : buildForest());

function markSel() {
  S.near = new Set();
  const n = S.view === "tree" ? S.byId.get(S.sel) : null;
  if (n) {
    for (let p = n; p; p = S.byId.get(p.parentId)) S.near.add(p.id);
    for (const c of kidsOf(n.id)) S.near.add(c.id);
    for (const c of kidsOf(n.parentId)) S.near.add(c.id);
  }
  const on = S.view === "tree" ? S.sel : S.fsel;
  for (const [id, e] of labelEls) e.classList.toggle("sel", id === on);
  placeSel(); stage.invalidate();
}
function placeSel() {
  if (!selMesh) { selMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: T.ink, side: THREE.BackSide })); stage.scene.add(selMesh); }
  const p = S.view === "tree" && S.sel && S.flora?.pos.get(S.sel);
  selMesh.visible = !!p;
  if (p) { selMesh.position.copy(p); selMesh.scale.setScalar(S.flora.radii.get(S.sel) * 1.16 + 0.03); }
}
function labelOpacity(L, dist) {
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
  closeAll(); S.pick?.finish(null); stopPlay();
  S.quick = null; S.review = null; S.cutoff = null; S.stitch = false;
  await load();
  const m = location.hash.match(/^#\/tree\/([^/?]+)/), id = m && decodeURIComponent(m[1]);
  if (location.hash.startsWith("#/garden")) showGarden();
  else if (id && treeOf(id)) showTree(id);
  else { if (id) history.replaceState(null, "", "#/"); showForest(); }
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
}
// Shift+Tab: swap between the knowledge window and the garden.
function toggleWindow() {
  if (S.review || S.pick) return;
  if (S.view === "garden") location.hash = S.lastKnowledge || "#/";
  else { S.lastKnowledge = location.hash || "#/"; location.hash = "#/garden"; }
}
function pickPlant(id) {
  S.fsel = treeOf(id) ? id : null; markSel(); renderActions();
  const at = S.fsel && treeSpot(S.fsel); if (at) stage.flyTo({ ...at, radius: at.radius * 1.5 }, 420);
}
async function refresh({ animate = false, panel = true } = {}) {
  await load();
  if (S.view === "tree") {
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
function renderChrome() { renderTop(); renderActions(); renderPanel(); renderReview(); renderTimeline(); renderEmpty(); }
let opening = false;
async function openTree(id) {
  if (opening) return; opening = true;
  const at = treeSpot(id); if (at) await stage.flyTo({ ...at, phi: 1.2 }, 560);
  opening = false; goTree(id);
}
function fitView() {
  stage.userMoved = false;
  if (S.view === "tree") stage.flyTo({ target: vec(S.lay.center), radius: stage.fitDistance(S.lay.radius) * 0.88, phi: 1.2 });
  else stage.flyTo(forestView());
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
  const n = S.byId.get(S.sel); if (!n) return select(S.tree.rootId);
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
  const search = ib("searchBtn", "Search", ICON.search, () => find());
  const swap = el("button", { class: "btn pill plain", id: "switchBtn", title: "Shift+Tab", onclick: toggleWindow }, S.view === "garden" ? "Knowledge" : "Garden", S.view !== "garden" && due ? el("span", { class: "thirst", text: String(due) }) : null);
  const brand = el("div", { class: "brand" }, el("img", { src: "icons/icon-192.png", alt: "", width: 26, height: 26 }), el("h1", { text: "Bonsai" }));
  if (S.view === "tree") {
    const zone = S.zones.find((z) => z.id === S.tree.zoneId);
    put($("#top"), ib("backBtn", "Forest", ICON.back, () => { location.hash = "#/"; }),
      el("div", { class: "crumb" }, el("h1", { text: S.tree.name }), el("span", { text: zone?.name || "" })),
      el("span", { class: "grow" }), swap, search, ib("moreBtn", "Tree menu", ICON.more, (e) => treeMenu(e.currentTarget)));
  } else if (S.view === "garden") {
    put($("#top"), brand, el("span", { class: "grow" }),
      due ? el("button", { class: "btn pill", id: "waterAll", onclick: () => startReview(null) }, `Water ${due}`) : null,
      swap, ib("moreBtn", "Menu", ICON.more, (e) => appMenu(e.currentTarget)));
  } else {
    put($("#top"), brand, el("span", { class: "grow" }),
      S.inbox.length ? el("button", { class: "btn pill", id: "inboxBtn", onclick: () => { S.panel = S.panel === "inbox" ? null : "inbox"; renderPanel(); } }, `Inbox ${S.inbox.length}`) : null,
      swap, search, ib("addBtn", "Add", ICON.plus, (e) => menu(e.currentTarget, [
        { label: "New tree", key: "N", run: () => newTree() }, { label: "New zone", key: "Z", run: newZone }, { label: "Capture a thought", key: "I", run: capture }])),
      ib("moreBtn", "Menu", ICON.more, (e) => appMenu(e.currentTarget)));
  }
}
function appMenu(anchor) {
  const archived = [...S.allZones.filter((z) => z.archived), ...S.allTrees.filter((t) => t.archived)];
  menu(anchor, [
    S.view === "forest" && { label: "Timeline", key: "T", run: toggleTimeline },
    archived.length && { label: "Archived", run: () => menu(anchor, archived.map((x) => ({ label: `Restore ${x.name}`, run: async () => { await safely(() => (x.rootId ? store.updateTree : store.updateZone)(x.id, { archived: false })); refresh(); } }))) },
    "-", { label: "Export backup", run: exportBackup }, { label: "Restore backup", run: () => $("#importFile").click() },
    "-", { label: "Shortcuts", key: "?", run: shortcuts },
    { label: "Check for updates", run: async () => { const r = await shell.check(); if (r !== "update") toast(r === "latest" ? "Up to date" : "Offline"); } },
    { label: "What's new", run: () => window.open("https://github.com/UmbraMortis343/Bonsai/releases", "_blank", "noopener") },
    shell.canInstall() && { label: "Install app", run: () => shell.install() },
    { label: `Bonsai ${shell.version}`, disabled: true },
  ]);
}
function treeMenu(anchor) {
  const t = S.tree;
  menu(anchor, [
    { label: "Patches", key: "P", run: togglePatches }, { label: "Timeline", key: "T", run: toggleTimeline },
    { label: "Fit view", key: "0", run: fitView },
    "-", { label: "Rename", run: () => renameThing(t, store.updateTree, "Tree") }, { label: "Colour", run: () => colourThing(t, store.updateTree) },
    S.zones.length > 1 && { label: "Move to zone", run: async () => {
      const v = await dialog({ title: `Move ${t.name}`, fields: [{ name: "zoneId", label: "Zone", type: "select", value: t.zoneId, options: S.zones.map((z) => [z.id, z.name]) }], ok: "Move" });
      if (v && (await safely(() => store.updateTree(t.id, { zoneId: v.zoneId })))) refresh();
    } },
    { label: "Graft onto…", key: "G", run: graftWholeTree },
    { label: "Archive", run: async () => { if (await safely(() => store.updateTree(t.id, { archived: true }))) { toast(`Archived ${t.name}`); location.hash = "#/"; } } },
    { label: "Delete", danger: true, run: async () => {
      const n = (S.byTree.get(t.id) || []).length;
      if (await dialog({ title: `Delete ${t.name} and its ${n} idea${n === 1 ? "" : "s"}?`, ok: "Delete", danger: true })) { await safely(() => store.deleteTree(t.id)); location.hash = "#/"; }
    } },
    "-", { label: "Shortcuts", key: "?", run: shortcuts },
  ]);
}
function zoneMenu(id, anchor) {
  const z = S.zones.find((x) => x.id === id); if (!z) return;
  const trees = S.trees.filter((t) => t.zoneId === id);
  menu(anchor, [
    { label: "New tree", run: () => newTree(id) },
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
    ["P", "Patches"], ["T", "Timeline"], ["N  Z", "New tree, new zone"], ["Shift+Tab", "Knowledge or garden"], ["Enter  V", "Garden: water the plant, water everything"], ["Esc", "Back"]];
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
  if (S.view !== "tree") return;
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
    let results = [], idx = 0;
    const input = el("input", { id: "pickInput", placeholder: "Search", autocomplete: "off", "aria-label": title || "Search" }), list = el("div", { class: "results" });
    const finish = (id) => { S.pick = null; box.hidden = true; box.replaceChildren(); renderActions(); resolve(id); };
    const draw = () => put(list, ...results.map((n, i) => el("button", { type: "button", class: "res" + (i === idx ? " on" : ""), onclick: () => finish(n.id) }, el("b", { text: n.title }), el("span", { text: pathOf(n) }))));
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase(), score = (n) => { const t = n.title.toLowerCase(); return t.startsWith(q) ? 0 : t.includes(q) ? 1 : deep && `${n.note || ""} ${n.body || ""}`.toLowerCase().includes(q) ? 2 : 9; };
      results = q ? S.nodes.filter((n) => live.has(n.treeId) && !exclude.has(n.id)).map((n) => [score(n), n]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title)).slice(0, 8).map(([, n]) => n) : [];
      idx = 0; draw();
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
  if (S.view === "tree" && S.tree.id === n.treeId) select(id, { fly: true });
  else { S.pendingSel = id; goTree(n.treeId); }
}

// ---------- side panel ----------
function renderPanel() {
  const p = $("#panel");
  S.flush?.(); S.flush = null;
  if (S.panel === "node" && !(S.view === "tree" && S.byId.get(S.sel))) S.panel = null;
  if (S.panel === "patches" && S.view !== "tree") S.panel = null;
  if (!S.panel) { p.hidden = true; p.replaceChildren(); document.body.dataset.panel = ""; return; }
  p.hidden = false; document.body.dataset.panel = S.panel;
  put(p, ...(S.panel === "node" ? nodePanel(S.byId.get(S.sel)) : S.panel === "patches" ? patchesPanel() : inboxPanel()).flat().filter(Boolean));
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
  if (S.view === "garden") return;
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
function renderEmpty() {
  const box = $("#empty"), show = S.view === "forest" && !S.zones.length && S.cutoff == null;
  box.hidden = !show;
  if (!show || box.firstChild) return;
  const input = el("input", { id: "zoneName", placeholder: "First subject", maxLength: 80, required: true, "aria-label": "Zone name", autocomplete: "off" });
  box.append(el("form", { class: "row", onsubmit: async (e) => {
    e.preventDefault();
    const z = await safely(() => store.createZone({ name: input.value })); if (!z) return;
    input.value = ""; await refresh(); newTree(z.id);
  } }, input, el("button", { class: "btn primary", text: "Add zone" })));
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
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return document.activeElement.blur();
  if (S.review) return endReview();
  if (S.cutoff != null) return toggleTimeline();
  if (S.panel) { S.panel = null; return renderPanel(); }
  if (S.view === "garden" && S.fsel) return pickPlant(null);
  if (S.view !== "forest") location.hash = S.view === "garden" ? S.lastKnowledge || "#/" : "#/";
}
function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); return back(); }
  if (e.ctrlKey || e.metaKey || e.altKey || overlayOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, stop = () => e.preventDefault();
  if (S.review) {
    const r = S.review;
    if (k === " " || k === "Enter") { stop(); if (!r.shown) { r.shown = true; renderReview(); } }
    else if (r.shown && "1234".includes(k)) rateNow(srs.RATINGS[+k - 1]);
    return;
  }
  if (S.pick) return;
  if (k === "Tab" && e.shiftKey) { stop(); return toggleWindow(); }
  if (k === "/") { stop(); return find(); }
  if (k === "?") { stop(); return shortcuts(); }
  if (k === "i") { stop(); return capture(); }
  if (k === "t") { stop(); return toggleTimeline(); }
  if (k === "0") { stop(); return fitView(); }
  if (S.cutoff != null) return;
  if (S.view === "garden") {
    if (k === "v") { stop(); return startReview(null); }
    if (k.startsWith("Arrow")) { stop(); stepForest(k === "ArrowRight" || k === "ArrowUp" ? 1 : -1); return renderActions(); }
    if (k === "Enter" && treeOf(S.fsel)) { stop(); return startReview(S.fsel); }
    return;
  }
  if (S.view === "forest") {
    if (k === "n") { stop(); return newTree(); }
    if (k === "z") { stop(); return newZone(); }
    if (k.startsWith("Arrow")) { stop(); return stepForest(k === "ArrowRight" || k === "ArrowUp" ? 1 : -1); }
    if (k === "Enter" && treeOf(S.fsel)) { stop(); return openTree(S.fsel); }
    return;
  }
  const n = S.byId.get(S.sel);
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

// ---------- start ----------
async function init() {
  T = theme();
  try { stage = new Stage($("#stage")); }
  catch { $("#empty").hidden = false; put($("#empty"), el("p", { text: "3D is turned off in this browser." })); return; }
  stage.setTheme(T);
  stage.isPaused = () => overlayOpen() || !!S.review;
  stage.onTap = onTap; stage.labelOpacity = labelOpacity;
  stage.labelRank = (L) => (L.id === S.sel ? 0 : S.near.has(L.id) ? 1 + L.depth * 0.01 : 2 + L.depth);
  stage.onHover = (hit, e) => {
    stage.container.style.cursor = hit && !(S.view === "forest" && hit.kind === "link") ? "pointer" : "";
    if (hit?.kind === "node" && S.view === "tree") showHover(hit.id, e.clientX, e.clientY); else hideHover();
  };
  stage.container.addEventListener("pointerdown", hideHover);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { T = theme(); stage.setTheme(T); selMesh?.material.color.set(T.ink); rebuild(); });
  window.addEventListener("hashchange", go);
  window.addEventListener("keydown", (e) => { if (e.key === "Tab" && e.shiftKey && document.activeElement === document.body) e.preventDefault(); onKey(e); });
  $("#importFile").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importBackup(f); });
  store.requestPersistence();
  window.bonsai = { S, store, refresh, get stage() { return stage; } };
  await go();
  document.body.dataset.ready = "1";
}
init();
