// Temporary outline view: zones and trees on the home screen, and each tree as
// an indented outline. The 3D forest and 3D tree replace this in later releases.
import * as store from "./store.js";

const view = document.getElementById("view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let selected = null;   // selected node id in the outline
let adding = null;     // node id we're adding a branch under
let renaming = null;   // node id being renamed
let armed = null;      // id of something waiting for a second tap to delete

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
async function safely(fn) {
  try { return await fn(); } catch (e) { toast(e.message || "Something went wrong."); }
}

function route() {
  const m = location.hash.match(/^#\/tree\/(.+)$/);
  return m ? { name: "tree", id: decodeURIComponent(m[1]) } : { name: "home" };
}
async function render() {
  const r = route();
  if (r.name === "tree") return renderTree(r.id);
  return renderHome();
}

// ---------- home ----------
async function renderHome() {
  const zones = await store.listZones();
  const trees = await store.listTrees();
  const sizes = {};
  for (const t of trees) sizes[t.id] = (await store.treeNodes(t.id)).length;
  let h = `<section class="home"><div class="home-head"><h1>Your forest</h1><span class="saved" id="saved">Saved on this device</span></div>`;
  if (!zones.length) {
    h += `<div class="empty">
      <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true"><ellipse cx="60" cy="84" rx="50" ry="5" class="ground"/><path d="M38 64h44l-6 18H44z" class="pot"/><path d="M60 64c-2-8 1-12 4-16s0-10-4-16" class="trunk"/><ellipse cx="60" cy="26" rx="22" ry="11" class="leaf"/><ellipse cx="42" cy="42" rx="14" ry="7" class="leaf2"/><ellipse cx="78" cy="38" rx="14" ry="7" class="leaf2"/></svg>
      <h2>Start with a zone</h2><p>A zone is a subject, like Electronics or Music theory. Trees inside it are topics.</p></div>`;
  }
  for (const z of zones) {
    const zt = trees.filter((t) => t.zoneId === z.id);
    h += `<article class="zone" data-zone="${esc(z.id)}">
      <div class="zone-head"><h2>${esc(z.name)}</h2>
        <button class="link" data-act="zone-rename" data-id="${esc(z.id)}">Rename</button>
        <button class="link danger" data-act="zone-delete" data-id="${esc(z.id)}">${armed === z.id ? `Tap again to delete ${zt.length ? "zone and its trees" : "zone"}` : "Delete"}</button></div>
      <ul class="trees">${zt.map((t) => `<li><a href="#/tree/${encodeURIComponent(t.id)}" class="tree-row"><span class="tree-name">${esc(t.name)}</span><span class="tree-size">${sizes[t.id]} idea${sizes[t.id] === 1 ? "" : "s"}</span></a></li>`).join("") || `<li class="muted">No trees yet.</li>`}</ul>
      <form class="inline" data-form="plant" data-zone="${esc(z.id)}">
        <input name="name" placeholder="New tree (topic), e.g. Basic electronics" aria-label="Tree name" maxlength="80" required>
        <input name="core" placeholder="Core idea (the trunk)" aria-label="Core idea" maxlength="140">
        <button class="btn">Plant tree</button>
      </form>
    </article>`;
  }
  h += `<form class="inline new-zone" data-form="zone"><input name="name" placeholder="New zone (subject), e.g. Electronics" aria-label="Zone name" maxlength="80" required><button class="btn primary">Add zone</button></form></section>`;
  view.innerHTML = h;
  store.requestPersistence().then((p) => {
    const el = document.getElementById("saved");
    if (el && p === "best-effort") el.textContent = "Saved on this device. Install the app so the browser keeps it safe.";
  });
}

// ---------- tree outline ----------
async function renderTree(id) {
  const tree = await store.getTree(id);
  if (!tree) { location.hash = "#/"; return; }
  const zone = await store.getZone(tree.zoneId);
  const nodes = await store.treeNodes(id);
  const linkCount = {};
  for (const l of await store.allLinks()) { linkCount[l.fromId] = (linkCount[l.fromId] || 0) + 1; linkCount[l.toId] = (linkCount[l.toId] || 0) + 1; }
  const row = (n, depth) => {
    const kids = store.childrenOf(nodes, n.id);
    const isTrunk = n.parentId === null, sel = selected === n.id;
    let h = `<li class="node${sel ? " sel" : ""}${isTrunk ? " trunk-node" : ""}" style="--d:${depth}">
      <div class="node-row" data-node="${esc(n.id)}" tabindex="0">
        ${renaming === n.id
          ? `<form class="inline tight" data-form="rename" data-id="${esc(n.id)}"><input name="title" value="${esc(n.title)}" aria-label="Rename idea" maxlength="140" required autofocus><button class="btn">Save</button></form>`
          : `<span class="node-title">${esc(n.title)}</span>${isTrunk ? `<span class="tag">trunk · core idea</span>` : ""}${linkCount[n.id] ? `<span class="tag">${linkCount[n.id]} link${linkCount[n.id] > 1 ? "s" : ""}</span>` : ""}`}
      </div>`;
    if (sel && renaming !== n.id) {
      h += `<div class="node-acts">
        <button class="btn" data-act="add" data-id="${esc(n.id)}">+ Branch</button>
        <button class="btn" data-act="rename" data-id="${esc(n.id)}">Rename</button>
        ${isTrunk ? "" : `<button class="btn danger" data-act="delete" data-id="${esc(n.id)}">${armed === n.id ? `Tap again to delete${kids.length ? " with its branches" : ""}` : "Delete"}</button>`}
      </div>`;
    }
    if (adding === n.id) {
      h += `<form class="inline tight add-form" data-form="add" data-id="${esc(n.id)}"><input name="title" placeholder="New idea under “${esc(n.title)}”" aria-label="New idea" maxlength="140" required autofocus><button class="btn primary">Add</button></form>`;
    }
    if (kids.length) h += `<ul>${kids.map((k) => row(k, depth + 1)).join("")}</ul>`;
    return h + `</li>`;
  };
  const root = nodes.find((n) => n.id === tree.rootId) || nodes.find((n) => n.parentId === null);
  view.innerHTML = `<section class="tree-view">
    <a href="#/" class="back">← Forest</a>
    <div class="tree-head"><h1>${esc(tree.name)}</h1><span class="muted">${esc(zone?.name || "")} · ${nodes.length} idea${nodes.length === 1 ? "" : "s"}</span>
      <button class="link danger" data-act="tree-delete" data-id="${esc(tree.id)}">${armed === tree.id ? "Tap again to delete this tree" : "Delete tree"}</button></div>
    <p class="hint">Tap an idea to branch from it. This outline is temporary; the 3D tree replaces it.</p>
    <ul class="outline">${root ? row(root, 0) : ""}</ul>
  </section>`;
  const f = view.querySelector("[autofocus]"); if (f) { f.focus(); f.select?.(); }
}

// ---------- events ----------
view.addEventListener("click", async (e) => {
  const act = e.target.closest("[data-act]");
  const nodeRow = e.target.closest(".node-row");
  if (act) {
    const id = act.dataset.id, a = act.dataset.act;
    if (a === "add") { adding = id; renaming = null; armed = null; }
    if (a === "rename") { renaming = id; adding = null; armed = null; }
    if (a === "delete") {
      if (armed !== id) armed = id;
      else { armed = null; const n = await safely(() => store.deleteNode(id)); if (n) { toast(`Deleted ${n} idea${n > 1 ? "s" : ""}`); selected = null; } }
    }
    if (a === "tree-delete") {
      if (armed !== id) armed = id;
      else { armed = null; await safely(() => store.deleteTree(id)); location.hash = "#/"; return; }
    }
    if (a === "zone-delete") {
      if (armed !== id) armed = id;
      else { armed = null; await safely(() => store.deleteZone(id)); }
    }
    if (a === "zone-rename") {
      const h2 = act.closest(".zone-head").querySelector("h2");
      h2.innerHTML = `<form class="inline tight" data-form="zone-rename" data-id="${esc(id)}"><input name="name" value="${esc(h2.textContent)}" aria-label="Rename zone" maxlength="80" required><button class="btn">Save</button></form>`;
      h2.querySelector("input").focus();
      return;
    }
    return render();
  }
  if (nodeRow && !e.target.closest("form")) {
    const id = nodeRow.dataset.node;
    selected = selected === id ? null : id; adding = null; renaming = null; armed = null;
    return render();
  }
});
view.addEventListener("keydown", (e) => {
  const nodeRow = e.target.closest(".node-row");
  if (nodeRow && e.target === nodeRow && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); nodeRow.click(); }
  if (e.key === "Escape" && (adding || renaming || armed)) { adding = renaming = armed = null; render(); }
});
view.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f)), k = f.dataset.form;
  let ok;
  if (k === "zone") ok = await safely(() => store.createZone({ name: d.name }));
  if (k === "zone-rename") ok = await safely(() => store.updateZone(f.dataset.id, { name: d.name }));
  if (k === "plant") {
    const t = await safely(() => store.createTree({ zoneId: f.dataset.zone, name: d.name, core: d.core }));
    if (t) { location.hash = `#/tree/${encodeURIComponent(t.id)}`; return; }
  }
  if (k === "add") { const n = await safely(() => store.addNode(f.dataset.id, { title: d.title })); if (n) { ok = n; selected = n.id; adding = null; } }
  if (k === "rename") { ok = await safely(() => store.updateNode(f.dataset.id, { title: d.title })); if (ok) renaming = null; }
  if (ok !== undefined) render();
});
window.addEventListener("hashchange", () => { selected = adding = renaming = armed = null; render(); });

// ---------- backup ----------
document.getElementById("exportBtn").addEventListener("click", async () => {
  const data = await safely(() => store.exportAll()); if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `bonsai-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Backup saved to your downloads");
});
const importInput = document.getElementById("importFile");
let pendingImport = null;
importInput.addEventListener("change", async () => {
  const file = importInput.files[0]; importInput.value = "";
  if (!file) return;
  try { pendingImport = JSON.parse(await file.text()); } catch { return toast("That file isn't a Bonsai backup."); }
  if (pendingImport?.app !== "bonsai") { pendingImport = null; return toast("That file isn't a Bonsai backup."); }
  const btn = document.getElementById("importBtn");
  btn.textContent = `Tap again to replace this device's forest with the backup (${(pendingImport.nodes || []).length} ideas)`;
  btn.dataset.armed = "1";
});
document.getElementById("importBtn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (btn.dataset.armed !== "1" || !pendingImport) return importInput.click();
  btn.dataset.armed = ""; btn.textContent = "Restore backup";
  const ok = await safely(async () => { await store.importAll(pendingImport); return true; });
  pendingImport = null;
  if (ok) { toast("Backup restored"); location.hash = "#/"; render(); }
});

render();
