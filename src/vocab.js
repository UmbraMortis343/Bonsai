// Vocab: terms you keep, underlined wherever they appear in your notes, and nested panels that open on hover,
// after Marginalia's glossary. Hover a term for its panel; hover a term inside that panel for the next one.
// A panel stays open while the pointer is on its term, on it, or on a panel opened from it; pin one to keep it.
//
// The underlines in a note are drawn with the CSS Custom Highlight API over ranges of the page's own text, so the
// editor's DOM is never touched and typing is never disturbed. Inside panels the terms are ordinary <mark>s.
//
// A term: { id, term, aliases: [], def, source, at, editedAt }

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Abbreviations and very short terms only count with the same capitals, so "US" doesn't catch "us".
export function matchCase(t) {
  const s = String(t).trim(), caps = (s.match(/\p{Lu}/gu) || []).length;
  return s.length <= 3 || (caps >= 2 && s.length <= 10);
}

// The index: one pattern for terms matched in any case, one for terms matched only with the same capitals.
export function buildIndex(terms) {
  const map = new Map(), loose = [], exact = [];
  for (const g of terms) for (const t of [g.term, ...(g.aliases || [])]) {
    const k = norm(t); if (k.length < 2 || map.has(k)) continue;
    map.set(k, g.id); (matchCase(t) ? exact : loose).push(t.trim());
  }
  const re = (alts, flags, plural) => {
    if (!alts.length) return null;
    alts.sort((a, b) => b.length - a.length);   // longest first, so "electric field" beats "field"
    return new RegExp("(?<![\\p{L}\\p{N}])(" + alts.map((a) => escRe(a).replace(/\s+/g, "\\s+")).join("|") + ")" + plural + "(?![\\p{L}\\p{N}])", flags);
  };
  return { map, loose: re(loose, "giu", "(?:e?s)?"), exact: re(exact, "gu", "s?") };
}

// Every term named in a piece of text: [{ i, n, id }] (start, length, term), earliest first, longer winning on overlap.
export function findTerms(text, ix, skipId) {
  const hits = [];
  for (const re of [ix.loose, ix.exact]) { if (!re) continue; re.lastIndex = 0; let m; while ((m = re.exec(text))) hits.push({ i: m.index, s: m[0], k: m[1] }); }
  hits.sort((a, b) => a.i - b.i || b.s.length - a.s.length);
  const out = []; let last = 0;
  for (const h of hits) { if (h.i < last) continue; const id = ix.map.get(norm(h.k)); if (!id || id === skipId) continue; out.push({ i: h.i, n: h.s.length, id }); last = h.i + h.s.length; }
  return out;
}
// Which term does this text name exactly, if any? Handles simple plurals.
export function termFor(text, ix) {
  const k = norm(text);
  if (ix.map.has(k)) return ix.map.get(k);
  for (const suf of ["es", "s"]) if (k.endsWith(suf) && ix.map.has(k.slice(0, -suf.length))) return ix.map.get(k.slice(0, -suf.length));
  return null;
}

// opts: { terms() → the list, onEdit(id), seenIn(id) → [{ id, title }], openPage(id), el (the app's element helper) }
export function createVocab(opts) {
  const el = opts.el;
  let ix = buildIndex([]), roots = new Set(), hits = [], hl = null, timer = 0;
  const P = { list: [], z: 40, openTimer: 0, sweepTimer: 0, over: null };
  const has = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  if (has) { hl = new Highlight(); CSS.highlights.set("vocab", hl); }

  // ---- underlining ----
  function markRoot(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest(".t-code, code, .plink, [data-ph]:empty") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n; (n = walker.nextNode()); ) for (const h of findTerms(n.nodeValue, ix)) {
      const r = document.createRange(); r.setStart(n, h.i); r.setEnd(n, h.i + h.n);
      hits.push({ node: n, s: h.i, e: h.i + h.n, id: h.id, range: r });
    }
  }
  function remark() {
    clearTimeout(timer); hits = [];
    for (const r of [...roots]) { if (!r.el.isConnected) { r.mo.disconnect(); roots.delete(r); continue; } markRoot(r.el); }
    if (hl) { hl.clear(); for (const h of hits) hl.add(h.range); }
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(remark, 220); };
  // underline the terms in this element, and keep doing so as it changes
  function watch(elm) {
    const mo = new MutationObserver(soon); mo.observe(elm, { childList: true, subtree: true, characterData: true });
    roots.add({ el: elm, mo }); soon();
  }
  function reindex() { ix = buildIndex(opts.terms()); remark(); refreshPanels(); }

  // the underlined term under a point on the screen
  function hitAt(x, y) {
    const c = document.caretRangeFromPoint?.(x, y); if (!c) return null;
    for (const h of hits) if (h.node === c.startContainer && c.startOffset >= h.s && c.startOffset <= h.e) {
      for (const b of h.range.getClientRects()) if (x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 2 && y <= b.bottom + 2) return h;
    }
    return null;
  }

  // ---- panels ----
  const rectOf = (a) => (a?.range ? a.range.getBoundingClientRect() : a?.getBoundingClientRect ? a.getBoundingClientRect() : null);
  const anchorHovered = (p) => (p.anchor?.range ? P.over === p.anchor : p.anchor?.isConnected && p.anchor.matches(":hover"));
  function open(id, anchor, { locked = false } = {}) {
    const g = opts.terms().find((t) => t.id === id); if (!g) return null;
    const parent = anchor && !anchor.range && anchor.closest ? anchor.closest(".vpanel")?._panel || null : null;
    const same = P.list.find((p) => p.id === id && p.parent === parent);
    if (same) { if (locked) pin(same, true); same.el.style.zIndex = ++P.z; return same; }
    for (const p of [...P.list]) if (p.parent === parent && !p.locked) close(p);
    const node = el("div", { class: "vpanel", role: "dialog", "aria-label": "Vocab: " + g.term });
    const panel = { el: node, id, anchor, parent, depth: parent ? parent.depth + 1 : 0, locked: false };
    node._panel = panel;
    node.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) closeAll(true); else close(panel); });
    node.addEventListener("pointerleave", sweepSoon);
    fill(panel); document.body.append(node); node.style.zIndex = ++P.z;
    place(node, rectOf(anchor));
    P.list.push(panel); if (locked) pin(panel, true);
    return panel;
  }
  function fill(panel) {
    const g = opts.terms().find((t) => t.id === panel.id); if (!g) return close(panel);
    const crumbs = []; for (let q = panel.parent; q; q = q.parent) { const t = opts.terms().find((x) => x.id === q.id); if (t) crumbs.unshift(t.term); }
    const def = el("div", { class: "vdef" });
    for (const par of (g.def || "").split(/\n{2,}/)) if (par.trim()) def.append(marked(par.trim(), g.id));
    if (!g.def) def.append(el("p", { class: "muted", text: "No definition yet" }));
    const seen = opts.seenIn(g.id);
    const pinBtn = el("button", { class: "ib vpin", type: "button", title: "Keep open", "aria-label": "Keep open", "aria-pressed": String(panel.locked), onclick: () => pin(panel, !panel.locked) }, opts.pinIcon ? opts.pinIcon() : "Pin");
    const head = el("div", { class: "vhead" }, el("span", { class: "vcrumb", text: crumbs.length ? crumbs.join(" › ") + " ›" : "Vocab" }), el("span", { class: "grow" }), pinBtn,
      el("button", { class: "ib", type: "button", title: "Close (Esc)", "aria-label": "Close", onclick: () => close(panel) }, "×"));
    head.addEventListener("pointerdown", (e) => drag(e, panel));
    panel.el.replaceChildren(head, el("div", { class: "vbody" }, el("h3", { text: g.term }), g.aliases?.length ? el("div", { class: "muted vaka", text: "Also " + g.aliases.join(", ") }) : null, def, g.quote ? el("blockquote", { class: "vquote", text: g.quote }) : null),
      el("div", { class: "vfoot" }, seen.length ? el("span", { class: "vseen" }, seen.slice(0, 4).map((p) => el("button", { class: "link", type: "button", text: p.title || "Untitled", onclick: () => { closeAll(true); opts.openPage(p.id); } }))) : el("span", { class: "muted", text: g.source || "" }),
        el("span", { class: "grow" }), ...(opts.panelActions ? opts.panelActions(g, () => closeAll(true)) : []), el("button", { class: "btn", type: "button", onclick: () => { closeAll(true); opts.onEdit(g.id); } }, "Edit")));
  }
  // text with the terms in it as <mark>s, which open the next panel
  function marked(text, skipId) {
    const p = el("p"); let last = 0;
    for (const h of findTerms(text, ix, skipId)) { if (h.i > last) p.append(text.slice(last, h.i)); p.append(el("mark", { class: "vt", dataset: { term: h.id }, text: text.slice(h.i, h.i + h.n) })); last = h.i + h.n; }
    if (last < text.length) p.append(text.slice(last));
    return p;
  }
  function place(node, r) {
    const w = node.offsetWidth, h = node.offsetHeight, m = 10;
    let x, y;
    if (r) { x = r.left - 8; y = r.bottom + 6; if (y + h > innerHeight - m) y = r.top - h - 6; } else { x = (innerWidth - w) / 2; y = innerHeight * 0.2; }
    node.style.left = Math.max(m, Math.min(innerWidth - w - m, x)) + "px"; node.style.top = Math.max(m, Math.min(innerHeight - h - m, y)) + "px";
  }
  function pin(p, v) { p.locked = v; p.el.classList.toggle("locked", v); p.el.querySelector(".vpin")?.setAttribute("aria-pressed", String(v)); if (!v) sweepSoon(); }
  function close(p) { for (const c of P.list.filter((c) => c.parent === p)) close(c); p.el.remove(); P.list = P.list.filter((q) => q !== p); }
  function closeAll(force) { for (const p of [...P.list]) if (force || !p.locked) close(p); }
  function closeTop() { const top = P.list.at(-1); if (!top) return false; close(top); return true; }
  function refreshPanels() { for (const p of [...P.list]) if (P.list.includes(p)) { if (!opts.terms().some((t) => t.id === p.id)) close(p); else { fill(p); pin(p, p.locked); } } }
  const keep = (p) => p.locked || p.el.matches(":hover") || anchorHovered(p) || P.list.some((c) => c.parent === p && keep(c));
  function sweep() { for (const p of [...P.list].reverse()) if (P.list.includes(p) && !keep(p)) close(p); }
  function sweepSoon() { clearTimeout(P.sweepTimer); P.sweepTimer = setTimeout(sweep, 300); }
  function drag(e, panel) {
    if (e.target.closest("button")) return;
    if (!panel.locked) pin(panel, true);   // dragging a panel keeps it
    const r = panel.el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev) => { panel.el.style.left = Math.max(0, Math.min(innerWidth - 40, ev.clientX - dx)) + "px"; panel.el.style.top = Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy)) + "px"; };
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move); addEventListener("pointerup", up); e.preventDefault();
  }

  // hover: a term in a note (by its range) or in a panel (a <mark>) opens its panel after a moment.
  // Looking up the range under the pointer is held to one every 50ms, with the last move always looked at.
  let last = 0, trail = 0;
  function onMove(e) {
    const m = e.target.closest?.("mark.vt");
    const h = m ? null : hits.length && e.target.closest?.(".blocks") ? hitAt(e.clientX, e.clientY) : null;
    const was = P.over; P.over = h;
    if (m || h) {
      clearTimeout(P.openTimer);
      const target = m || h, id = m ? m.dataset.term : h.id;
      if (P.list.some((p) => p.anchor === target)) return;
      P.openTimer = setTimeout(() => { const still = m ? m.matches(":hover") : P.over === h; if (still && getSelection().isCollapsed) open(id, target); }, 320);
    } else { clearTimeout(P.openTimer); if (was || P.list.length) sweepSoon(); }
  }
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || e.buttons) return;
    clearTimeout(trail);
    const now = performance.now();
    if (now - last < 50) { trail = setTimeout(() => { last = performance.now(); onMove(e); }, 60); return; }
    last = now; onMove(e);
  });
  // a click on a term inside a panel keeps its panel open
  document.addEventListener("click", (e) => { const m = e.target.closest?.("mark.vt"); if (m) { e.preventDefault(); open(m.dataset.term, m, { locked: true }); } });
  addEventListener("resize", () => closeAll(false));

  return {
    watch, reindex, remark, closeTop, closeAll, open, marked, findIn: (text, skip) => findTerms(text, ix, skip), termFor: (text) => termFor(text, ix),
    get panels() { return P.list; }, get hits() { return hits; }, hitAt,
  };
}

// ---------- Flesh out with Claude: a copy and paste round trip, until there's a live connection ----------
// The sentence the words were met in, from the text around a selection.
export function sentenceAround(text, start, end) {
  const before = text.slice(0, start), after = text.slice(end);
  const a = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "), before.lastIndexOf("\n"));
  const m = after.search(/[.?!](\s|$)|\n/);
  return text.slice(a < 0 ? 0 : a + (before[a] === "\n" ? 1 : 2), m < 0 ? text.length : end + m + 1).trim().slice(0, 400);
}
export function fleshPrompt({ term, quote = "", page = "", def = "", known = [] }) {
  return [
    `I keep a vocab list in my notes app. Explain the term "${term}" for it.`,
    quote ? `I met it in this sentence${page ? ` (my notes, "${page}")` : ""}:\n> ${quote}` : page ? `It came up in my notes, "${page}".` : "",
    def ? `What I've written about it so far:\n> ${def.replace(/\n/g, "\n> ")}` : "",
    known.length ? `Other terms already in my list (name any that help, spelled as here, so they link up): ${known.slice(0, 80).join(", ")}.` : "",
    `Reply in exactly this shape and nothing else:`,
    `Also: other names or abbreviations, comma between (leave this line out if there are none)`,
    `Then the meaning: two to four plain sentences, as you'd explain it to a classmate. A blank line, then one short example if it helps.`,
  ].filter(Boolean).join("\n\n");
}
// Claude's reply → { aliases, def }. Strips fences, headings and a leading restatement of the term.
export function readFlesh(text, term = "") {
  let t = String(text || "").replace(/^```\w*\n?|```$/gm, "").replace(/^#+\s.*$/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
  let aliases = [];
  t = t.replace(/^also\s*:\s*(.*)$/im, (_, a) => { aliases = a.split(",").map((x) => x.trim().replace(/\.$/, "")).filter((x) => x && !/^none$/i.test(x)); return ""; }).trim();
  if (term) t = t.replace(new RegExp("^" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:—-]\\s*", "i"), "");
  t = t.replace(/^meaning\s*:\s*/i, "").replace(/\n{3,}/g, "\n\n").trim();
  return { aliases: aliases.slice(0, 8), def: t };
}

// ---------- the quick panel on selected words ----------
// opts: { el, roots() → elements the panel works in, actions(sel) → [{ id, label, key, run }] }, where sel is
// { text, quote, long (more than a term could be), range, rect }. Alt+1… run them while the panel shows, so typing over the selection still works.
export function createQuick(opts) {
  const el = opts.el; let box = null, sel = null, timer = 0, acts = [];
  const inside = (node) => { const e = node?.nodeType === 1 ? node : node?.parentElement; return e && opts.roots().some((r) => r.contains(e)); };
  function read() {
    const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null;
    const r = s.getRangeAt(0); if (!inside(r.commonAncestorContainer)) return null;
    const text = s.toString().replace(/\s+/g, " ").trim(); if (!text || text.length > 600) return null;
    const long = text.length > 120 || text.split(" ").length > 8;   // a sentence or more: no use as a term, but it can be an action
    const blk = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest(".tx") || r.startContainer.parentElement;
    let quote = "";
    if (blk) { const pre = document.createRange(); pre.selectNodeContents(blk); pre.setEnd(r.startContainer, r.startOffset); const a = pre.toString().length, full = blk.textContent; quote = sentenceAround(full, a, a + s.toString().length); }
    return { text, quote, long, range: r.cloneRange(), rect: r.getBoundingClientRect() };
  }
  function show() {
    sel = read(); if (!sel) return hide();
    acts = opts.actions(sel).filter(Boolean);
    const n = el("div", { class: "qpanel", role: "toolbar", "aria-label": "Selection" }, acts.map((a, i) => el("button", { class: "btn", type: "button", dataset: { act: a.id }, title: `${a.label} (Alt+${i + 1})`,
      onmousedown: (e) => e.preventDefault(), onclick: () => run(i) }, a.label, el("kbd", { text: "Alt+" + (i + 1) }))));
    box?.remove(); box = n; document.body.append(n);
    const w = n.offsetWidth, h = n.offsetHeight, r = sel.rect;
    // below the words, since the editor's format bar sits above them
    let y = r.bottom + 8; if (y + h > innerHeight - 8) y = r.top - h - 8;
    n.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px"; n.style.top = y + "px";
  }
  function hide() { box?.remove(); box = null; sel = null; acts = []; }
  function run(i) { const a = acts[i], s = sel; if (!a) return; hide(); a.run(s); }
  document.addEventListener("selectionchange", () => { clearTimeout(timer); timer = setTimeout(() => { if (document.querySelector(".dialog")) return; show(); }, 180); });
  document.addEventListener("keydown", (e) => { if (box && e.key === "Escape" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); return hide(); } if (!box || !e.altKey || e.ctrlKey || e.metaKey) return; const i = +e.key - 1; if (i >= 0 && i < acts.length) { e.preventDefault(); e.stopPropagation(); run(i); } }, true);
  addEventListener("scroll", hide, true); addEventListener("resize", hide);
  return { hide, get shown() { return !!box; }, get sel() { return sel; } };
}
