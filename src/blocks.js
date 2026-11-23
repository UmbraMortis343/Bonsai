// A Notion-style block editor for notes pages.
// A page is a flat list of blocks; nesting is each block's indent, so Tab and Shift+Tab move a block in and out,
// and a block's children are the blocks after it with a deeper indent (they move, hide and delete with it).
// block {id, type, html, indent, checked, open, color, pageId, icon}
//   type: text h1 h2 h3 bullet number todo toggle quote callout code divider page table
//   a table keeps its cells as rows: [[html, …], …] and head (the first row is a header)
//   an image keeps fileId (the picture, saved apart: opts.files), w and h (its pixels), width (% of the page) and caption
import { el, put, menu, dialog, overlayOpen } from "./dom.js";
import { datePicker, isoDay, relDate, longDate } from "./datepick.js";
import { shrinkImage, urlOf, pngOf, isImage } from "./images.js";

export const TYPES = [
  ["text", "Text", "Aa"], ["h1", "Heading 1", "H1"], ["h2", "Heading 2", "H2"], ["h3", "Heading 3", "H3"],
  ["bullet", "Bulleted list", "•"], ["number", "Numbered list", "1."], ["todo", "To-do list", "☐"], ["toggle", "Toggle list", "▸"],
  ["quote", "Quote", "❝"], ["callout", "Callout", "💡"], ["code", "Code", "</>"], ["divider", "Divider", "—"], ["table", "Table", "▦"], ["page", "Page", "▤"],
];
const DATES = [["today", "Today", "▦"], ["tomorrow", "Tomorrow", "▦"], ["yesterday", "Yesterday", "▦"], ["week", "Next Monday", "▦"], ["pick", "Pick a date…", "▦"]];
export const COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const TEXTY = new Set(["text", "h1", "h2", "h3", "bullet", "number", "todo", "toggle", "quote", "callout", "code"]);
const LISTS = new Set(["bullet", "number", "todo", "toggle"]);
const KEPT = new Set(["table", "image"]);   // solid blocks a Backspace or Delete next door steps into rather than deletes
const MAX_INDENT = 8;
const uid = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const newBlock = (type = "text", extra = {}) => ({ id: uid(), type, html: "", indent: 0, ...extra });
export const tableBlock = (rows = [["", "", ""], ["", "", ""]], head = true, extra = {}) => {
  const w = Math.max(1, ...rows.map((r) => r.length));
  return newBlock("table", { rows: rows.map((r) => [...r, ...Array(w - r.length).fill("")]), head, ...extra });
};

// Only simple inline formatting survives: bold, italic, underline, strike, code, links, line breaks, date tags and
// actions (<mark data-action="id">: words marked as something to do, listed on the Actions page).
const KEEP = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", S: "s", STRIKE: "s", DEL: "s", CODE: "code", A: "a", BR: "br", TIME: "time", MARK: "mark" };
export const ACTION_ID = /^a[a-z0-9]{4,30}$/;
export const actionId = () => "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html"), out = document.createElement("div");
  const walk = (from, to) => {
    for (const n of from.childNodes) {
      if (n.nodeType === 3) { to.append(n.textContent); continue; }
      if (n.nodeType !== 1) continue;
      const tag = KEEP[n.tagName];
      if (n.tagName === "SPAN" && /font-weight:\s*(bold|[6-9]00)/.test(n.getAttribute("style") || "")) { const b = document.createElement("b"); walk(n, b); to.append(b); continue; }
      if (!tag) { if (/^(DIV|P|LI)$/.test(n.tagName) && to.childNodes.length) to.append(document.createElement("br")); walk(n, to); continue; }
      const e = document.createElement(tag);
      if (tag === "a") { const h = n.getAttribute("href") || ""; if (!/^(https?:|mailto:)/i.test(h)) { walk(n, to); continue; } e.setAttribute("href", h); e.setAttribute("target", "_blank"); e.setAttribute("rel", "noopener"); }
      if (tag === "mark") { const id = n.getAttribute("data-action") || ""; if (!ACTION_ID.test(id)) { walk(n, to); continue; } e.setAttribute("data-action", id); }
      if (tag === "time") { const d = n.getAttribute("datetime") || ""; if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { walk(n, to); continue; } e.setAttribute("datetime", d); e.setAttribute("contenteditable", "false"); e.textContent = relDate(d); to.append(e); continue; }
      if (tag !== "br") walk(n, e);
      to.append(e);
    }
  };
  walk(doc.body.firstChild, out);
  return out.innerHTML.replace(/(<br>)+$/, "");
}
const plain = (html) => { const d = document.createElement("div"); d.innerHTML = html || ""; return d.textContent; };

// ---------- caret helpers ----------
function caretOffset(node) {
  const s = getSelection(); if (!s.rangeCount || !node.contains(s.anchorNode)) return -1;
  const r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(node); r.setEnd(s.anchorNode, s.anchorOffset);
  return r.toString().length;
}
function setCaret(node, at) {
  const s = getSelection(), r = document.createRange();
  if (at === "end" || at == null || at < 0) { r.selectNodeContents(node); r.collapse(false); }
  else {
    let left = at, done = false;
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (done) return;
        if (c.nodeType === 3) { if (c.textContent.length >= left) { r.setStart(c, left); done = true; return; } left -= c.textContent.length; }
        else walk(c);
      }
    };
    walk(node);
    if (!done) { r.selectNodeContents(node); r.collapse(false); } else r.collapse(true);
  }
  s.removeAllRanges(); s.addRange(r);
}
const atLine = (node, top) => {   // is the caret on the first (top) or last line of the block?
  const s = getSelection(); if (!s.rangeCount) return true;
  const rects = s.getRangeAt(0).getClientRects(), box = node.getBoundingClientRect();
  if (!rects.length) return true;
  const r = rects[0], lh = parseFloat(getComputedStyle(node).lineHeight) || 22;
  return top ? r.top - box.top < lh * 0.8 : box.bottom - r.bottom < lh * 0.8;
};

const focusAtLine = (node, top) => {   // is the selection's moving end on the block's first (top) or last line?
  const s = getSelection(); if (!s.rangeCount || !s.focusNode) return true;
  const r = document.createRange(); try { r.setStart(s.focusNode, s.focusOffset); } catch { return true; }
  r.collapse(true);
  let rect = r.getClientRects()[0]; if (!rect) { rect = r.getBoundingClientRect(); if (!rect.height) return true; }
  const box = node.getBoundingClientRect(), lh = parseFloat(getComputedStyle(node).lineHeight) || 22;
  return top ? rect.top - box.top < lh * 0.8 : box.bottom - rect.bottom < lh * 0.8;
};

// ---------- undo ----------
// The editor keeps its own history: each step is the whole list of blocks plus where the caret was. The browser's
// own undo can't be used, since every structural change draws the blocks afresh and its history points at gone nodes.
// Histories outlive the editor (keyed by page), so a page drawn again, or opened again, can still be undone.
const HIST = new Map(), HIST_MAX = 200, BURST_MS = 1000;
const clone = (x) => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

// ---------- the editor ----------
// opts: { host, blocks, onChange(blocks), pageTitle(id), openPage(id), newSubpage() -> id, readOnly, key (for the history),
//         files: { save(rec) -> id, load(id) -> rec } for pictures, notify(message) }
export function createEditor(opts) {
  let B = (opts.blocks || []).map((b) => clone(b));
  if (!B.length) B = [newBlock()];
  const root = el("div", { class: "blocks", role: "textbox", "aria-multiline": "true", "aria-label": "Page" });
  opts.host.append(root);
  let slash = null, drag = null, quiet = false;
  let H = opts.key != null ? HIST.get(opts.key) : null;
  if (!H || JSON.stringify(H.cur.blocks) !== JSON.stringify(B)) H = { undo: [], redo: [], cur: { blocks: clone(B), focus: null }, burst: null };
  H.burst = null; if (opts.key != null) HIST.set(opts.key, H);
  const save = () => opts.onChange?.(B.map((b) => clone(b)));   // the page saves shortly after typing stops
  // every change comes through here once it's made: a step of its own, or (typing) part of a burst in one block
  const changed = (step = true, typed = null) => {
    const now = Date.now(), bu = H.burst;
    if (step && JSON.stringify(B) === JSON.stringify(H.cur.blocks)) { H.burst = null; return save(); }   // nothing new (a format command's own input event)
    if (step || !typed || !bu || bu.id !== typed.id || bu.kind !== typed.kind || now - bu.at > BURST_MS) {
      H.undo.push(H.cur); if (H.undo.length > HIST_MAX) H.undo.shift();
      H.cur = { blocks: clone(B), focus: H.cur.focus };
    } else {   // still typing in the same block: the step's end moves on
      const bid = typed.bid || typed.id, i = H.cur.blocks.findIndex((x) => x.id === bid), b = B[idx(bid)];
      if (i >= 0 && b) { H.cur.blocks = H.cur.blocks.slice(); H.cur.blocks[i] = clone(b); } else H.cur = { blocks: clone(B), focus: H.cur.focus };
    }
    H.redo = []; H.burst = typed ? { ...typed, at: now } : null;
    save();
  };
  function travel(from, to) {
    closeSlash(); clearPick(true);
    const s = from.pop(); if (!s) return false;
    to.push(H.cur); H.cur = s; H.burst = null;
    B = clone(s.blocks); save();
    render(s.focus && B.some((b) => b.id === s.focus.id) ? s.focus : { id: B[0].id, at: 0 });
    return true;
  }
  const undo = () => travel(H.undo, H.redo), redo = () => travel(H.redo, H.undo);
  const caretNow = () => {   // where the caret is, as a block and an offset into its text
    const s = getSelection(); if (!s.rangeCount) return null;
    const tx = (s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement)?.closest?.(".tx, .cell"), row = tx?.closest(".blk");
    if (!tx || !root.contains(tx)) return null;
    return { id: row.dataset.id, at: caretOffset(tx), ...(tx.classList.contains("cell") ? { cell: [+tx.dataset.r, +tx.dataset.c] } : {}) };
  };
  const undoKey = (e) => {
    const k = e.key.toLowerCase(); if (!(e.ctrlKey || e.metaKey) || e.altKey || !(k === "z" || k === "y")) return false;
    e.preventDefault(); e.stopPropagation();
    if (k === "y" || e.shiftKey) redo(); else undo();
    return true;
  };
  root.addEventListener("keydown", (e) => {
    if (e.isComposing || undoKey(e)) return;
    const x = crossSel(); if (!x) return;   // words selected across blocks: the editor deletes them itself
    if (e.key === "Escape" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); return setPick(x.a.dataset.id, x.z.dataset.id); }
    const mod = e.ctrlKey || e.metaKey, ch = e.key.length === 1 && !mod && !e.altKey;
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "Enter" || ch) {
      e.preventDefault(); e.stopPropagation();
      const at = cutAcross(x);
      if (ch) { quiet = true; document.execCommand("insertText", false, e.key); quiet = false; const b = B[idx(at.id)], tx = txOf(at.id); if (b && tx) { sync(b, tx); changed(false, { id: b.id, kind: "ins" }); } }
    }
  }, true);
  root.addEventListener("cut", (e) => { const x = crossSel(); if (!x) return; e.preventDefault(); e.clipboardData?.setData("text/plain", getSelection().toString()); cutAcross(x); }, true);
  // a selection that starts in one block and ends in another
  function crossSel() {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null;
    const r = s.getRangeAt(0), rowAt = (n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(".blk");
    const a = rowAt(r.startContainer), z = rowAt(r.endContainer);
    if (!a || !z || a === z || !root.contains(a) || !root.contains(z)) return null;
    return { r, a, z };
  }
  // deletes what's selected across blocks: the first block keeps its words before the selection and takes the last one's after it
  function cutAcross({ r, a, z }) {
    let i = idx(a.dataset.id), j = idx(z.dataset.id); const first = B[i], last = B[j];
    const part = (tx, fromStart) => {
      if (!tx) return "";
      const q = document.createRange(); q.selectNodeContents(tx);
      if (fromStart) { if (tx.contains(r.startContainer)) q.setEnd(r.startContainer, r.startOffset); }
      else if (tx.contains(r.endContainer)) q.setStart(r.endContainer, r.endOffset); else return tx.innerHTML;
      const d = document.createElement("div"); d.append(q.cloneContents()); return first.type === "code" ? d.textContent : d.innerHTML;
    };
    const atx = a.querySelector(".tx"), ztx = z.querySelector(".tx");
    if (KEPT.has(first.type) || KEPT.has(last.type)) {   // a table or picture at either end stays; only what lies between goes, and the text ends are cut
      if (TEXTY.has(first.type)) first.html = first.type === "code" ? part(atx, true) : cleanHtml(part(atx, true));
      if (TEXTY.has(last.type)) last.html = last.type === "code" ? part(ztx, false) : cleanHtml(part(ztx, false));
      B.splice(i + 1, j - i - 1);
      const f = TEXTY.has(first.type) ? { id: first.id, at: "end" } : TEXTY.has(last.type) ? { id: last.id, at: 0 } : { id: first.id };
      changed(true); render(f); return f;
    }
    const head = TEXTY.has(first.type) ? part(atx, true) : "", tail = TEXTY.has(last.type) && ztx && ztx.contains(r.endContainer) ? part(ztx, false) : "";
    const keep = TEXTY.has(first.type) ? first : newBlock("text", { indent: first.indent });
    keep.html = keep.type === "code" ? head + tail : cleanHtml(head + tail);
    const at = keep.type === "code" ? head.length : plain(head).length;
    B.splice(i, j - i + 1, keep);
    changed(true); render({ id: keep.id, at });
    return { id: keep.id, at };
  }
  root.addEventListener("beforeinput", (e) => {   // Undo from the browser's own menu
    if (e.inputType === "historyUndo" || e.inputType === "historyRedo") { e.preventDefault(); e.inputType === "historyUndo" ? undo() : redo(); }
  }, true);
  const idx = (id) => B.findIndex((b) => b.id === id);
  const kidsEnd = (i) => { let j = i + 1; while (j < B.length && B[j].indent > B[i].indent) j++; return j; };   // end of a block's group
  const rowOf = (id) => root.querySelector(`.blk[data-id="${id}"]`);
  const txOf = (id) => rowOf(id)?.querySelector(".tx");
  const cellOf = (id, r, c) => rowOf(id)?.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);

  function hidden() {   // blocks inside a closed toggle
    const out = new Set(); let closedAt = -1;
    B.forEach((b, i) => {
      if (closedAt >= 0 && b.indent > closedAt) { out.add(b.id); return; }
      closedAt = -1;
      if (b.type === "toggle" && !b.open) closedAt = b.indent;
    });
    return out;
  }
  function numberOf(i) {
    let n = 1;
    for (let j = i - 1; j >= 0; j--) { if (B[j].indent > B[i].indent) continue; if (B[j].indent < B[i].indent || B[j].type !== "number") break; n++; }
    return n;
  }
  function render(focus) {
    const hide = hidden();
    put(root, B.map((b, i) => rowFor(b, i, hide.has(b.id))));
    if (pick) showPick();
    drawMarks();
    if (focus) { place(focus.id, focus.at, focus.cell); H.cur.focus = { ...focus }; }
  }
  function rowFor(b, i, isHidden) {
    const row = el("div", { class: `blk t-${b.type}` + (b.color ? ` c-${b.color}` : "") + (b.checked ? " done" : "") + (b.open ? " open" : ""), dataset: { id: b.id }, style: `--i:${b.indent}`, hidden: isHidden });
    const handle = el("button", { class: "hdl", type: "button", tabIndex: -1, title: "Drag to move, click for options", "aria-label": "Block options", text: "⋮⋮" });
    handle.addEventListener("pointerdown", (e) => startDrag(e, b.id));
    row.append(handle);
    if (b.type === "bullet") row.append(el("span", { class: "mark", text: ["•", "◦", "▪"][b.indent % 3] }));
    else if (b.type === "number") row.append(el("span", { class: "mark", text: numberOf(i) + "." }));
    else if (b.type === "todo") row.append(el("input", { type: "checkbox", class: "mark", checked: !!b.checked, "aria-label": "Done", onchange: (e) => { b.checked = e.target.checked; row.classList.toggle("done", b.checked); changed(true); } }));
    else if (b.type === "toggle") row.append(el("button", { class: "mark tg", type: "button", "aria-label": b.open ? "Close" : "Open", "aria-expanded": String(!!b.open), onclick: () => { b.open = !b.open; changed(true); render({ id: b.id, at: "end" }); } }));
    else if (b.type === "callout") row.append(el("button", { class: "mark ico", type: "button", text: b.icon || "💡", "aria-label": "Icon", onclick: async () => { const v = await dialog({ title: "Icon", fields: [{ name: "i", label: "Emoji", value: b.icon || "💡", max: 4 }] }); if (v) { b.icon = v.i.trim() || "💡"; changed(true); render(); } } }));
    if (b.type === "table") { row.append(tableFor(b)); return row; }
    if (b.type === "image") return imageRow(b, row);
    if (b.type === "divider") { row.tabIndex = 0; row.append(el("hr")); row.addEventListener("keydown", (e) => solidKey(e, b)); return row; }
    if (b.type === "page") {
      row.tabIndex = 0;
      row.append(el("button", { class: "plink", type: "button", onclick: () => opts.openPage?.(b.pageId) }, el("span", { class: "pico", text: "▤" }), el("span", { text: opts.pageTitle?.(b.pageId) || "Untitled" })));
      row.addEventListener("keydown", (e) => solidKey(e, b));
      return row;
    }
    const tx = el("div", { class: "tx", contentEditable: opts.readOnly ? "false" : b.type === "code" ? "plaintext-only" : "true", spellcheck: b.type !== "code", html: b.type === "code" ? escapeCode(b.html) : b.html,
      dataset: { ph: placeholder(b, i) } });
    tx.querySelectorAll("time[datetime]").forEach((t) => { t.textContent = relDate(t.getAttribute("datetime")); t.contentEditable = "false"; t.title = longDate(t.getAttribute("datetime")); });
    tx.addEventListener("input", (e) => onInput(e, b, tx));
    tx.addEventListener("beforeinput", (e) => onBefore(e, b, tx));
    tx.addEventListener("keydown", (e) => onKey(e, b, tx));
    tx.addEventListener("paste", (e) => onPaste(e, b, tx));
    tx.addEventListener("focus", () => { clearPick(true); root.querySelectorAll(".blk.focus").forEach((x) => x.classList.remove("focus")); row.classList.add("focus"); });
    tx.addEventListener("blur", () => { row.classList.remove("focus"); setTimeout(() => { if (!root.contains(document.activeElement)) closeSlash(); }, 150); });
    row.append(tx);
    return row;
  }
  const escapeCode = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function placeholder(b, i) {
    if (b.type === "h1" || b.type === "h2" || b.type === "h3") return TYPES.find((t) => t[0] === b.type)[1];
    if (b.type === "todo") return "To-do"; if (b.type === "toggle") return "Toggle"; if (b.type === "quote") return "Quote"; if (LISTS.has(b.type)) return "List";
    return B.length === 1 && i === 0 ? "Type / for blocks" : "";
  }
  const textOf = (b, tx) => (b.type === "code" ? tx.textContent : tx.innerHTML);
  function sync(b, tx) {
    if (tx.classList.contains("cell")) { b.rows[+tx.dataset.r][+tx.dataset.c] = cleanHtml(cleanInline(tx.innerHTML)); return; }
    b.html = b.type === "code" ? tx.textContent : cleanInline(tx.innerHTML);
  }
  const cleanInline = (h) => (h === "<br>" ? "" : h);
  function place(id, at = "end", cell) {
    const b = B[idx(id)];
    if (b?.type === "table") {   // into a cell: the one asked for, else the first (or the last, coming up from below)
      const [r, c] = cell || (at === "end" ? [b.rows.length - 1, b.rows[0].length - 1] : [0, 0]), x = cellOf(id, r, c);
      if (x) { x.focus({ preventScroll: false }); setCaret(x, at); x.scrollIntoView({ block: "nearest" }); return; }
    }
    const tx = txOf(id);
    if (tx) { tx.focus({ preventScroll: false }); setCaret(tx, at); tx.scrollIntoView({ block: "nearest" }); return; }
    rowOf(id)?.focus();
  }
  function insertAfter(i, b) { B.splice(i + 1, 0, b); return b; }

  // ---------- typing ----------
  function onBefore(e, b, tx) {
    if (e.inputType !== "insertText" || e.data !== " " || b.type === "code") return;
    const at = caretOffset(tx), before = tx.textContent.slice(0, at);
    const md = { "#": "h1", "##": "h2", "###": "h3", "-": "bullet", "*": "bullet", "+": "bullet", "[]": "todo", "[ ]": "todo", "[x]": "todo", ">": "toggle", "\"": "quote", "1.": "number" }[before];
    const num = !md && /^\d+[.)]$/.test(before) ? "number" : null;
    if (!(md || num) || at !== before.length) return;
    e.preventDefault();
    const r = document.createRange(), s = getSelection(); setCaret(tx, 0); r.setStart(s.anchorNode, s.anchorOffset); setCaret(tx, at); r.setEnd(s.anchorNode, s.anchorOffset); r.deleteContents();
    sync(b, tx); turnInto(b, md || num, { checked: before === "[x]" });
  }
  function onInput(e, b, tx) {
    sync(b, tx);
    if (quiet) return;
    const t = tx.textContent;
    if (b.type !== "code" && t === "---") { b.type = "divider"; b.html = ""; const n = insertAfter(idx(b.id), newBlock("text", { indent: b.indent })); changed(); return render({ id: n.id }); }
    if (b.type !== "code" && t === "```") { b.type = "code"; b.html = ""; changed(); return render({ id: b.id }); }
    if (e.inputType === "insertText" && (e.data === "/" || e.data === "@")) { const at = caretOffset(tx); const prev = t[at - 2]; if (at === 1 || prev === " " || prev === "\u00a0") openSlash(b, tx, at - 1, e.data === "@" ? "date" : "block"); }
    else if (slash) updateSlash();
    tx.parentElement.classList.toggle("blank", !t);   // not "empty": that's the empty-garden box's class
    const it = e.inputType || "";
    if (/Paste|Drop|Cut|format|history/.test(it)) return changed(true);
    changed(false, { id: b.id, kind: it.startsWith("delete") ? "del" : "ins" });
  }
  function onPaste(e, b, tx) {
    const x = crossSel(); if (x) cutAcross(x);
    const got = b.type === "code" ? null : blocksFrom(e.clipboardData);
    if (got) {   // blocks copied from a page: they come back as blocks, after this one (in place of an empty line)
      e.preventDefault();
      const cur = B[idx(caretNow()?.id)] || B[idx(b.id)] || B.at(-1), i = idx(cur.id), made = rebase(got, cur.indent);
      if (TEXTY.has(cur.type) && !plain(cur.html).trim()) B.splice(i, 1, ...made); else B.splice(kidsEnd(i), 0, ...made);
      changed(true); return render({ id: made.at(-1).id, at: "end" });
    }
    const grid = b.type === "code" ? null : gridFrom(e.clipboardData);
    if (grid) {   // a table from a web page or a spreadsheet: a table block (in place of an empty line)
      e.preventDefault();
      const n = tableBlock(grid.rows, grid.head, { indent: b.indent }), i = idx(b.id);
      if (!plain(b.html).trim() && TEXTY.has(b.type)) B.splice(i, 1, n); else B.splice(i + 1, 0, n);
      changed(true); return render({ id: n.id, cell: [grid.rows.length - 1, grid.rows.at(-1).length - 1], at: "end" });
    }
    const pics = filesIn(e.clipboardData);
    if (pics.length && opts.files) { e.preventDefault(); return addImages(pics, { id: b.id, replace: true }); }   // a screenshot: a picture block
    const text = e.clipboardData?.getData("text/plain"); if (text == null) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n");
    H.burst = null;   // a paste is a step of its own
    if (lines.length === 1 || b.type === "code") { document.execCommand("insertText", false, text); H.burst = null; return; }
    // several lines: the first joins this block, the rest become blocks of their own, read like a Markdown outline
    quiet = true; document.execCommand("insertText", false, lines[0]); quiet = false; sync(b, tx);
    const made = textToBlocks(lines.slice(1).join("\n")).map((x) => ({ ...x, indent: Math.min(MAX_INDENT, x.indent + b.indent) }));
    B.splice(idx(b.id) + 1, 0, ...made); changed(true); render({ id: made.at(-1)?.id || b.id });
  }
  function onKey(e, b, tx) {
    if (slash && slashKey(e)) return;
    const i = idx(b.id), k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === "Escape" && !e.shiftKey && !getSelection().isCollapsed) { e.preventDefault(); e.stopPropagation(); return setPick(b.id); }   // words picked: now the block
    if (mod && !e.shiftKey && !e.altKey && k.toLowerCase() === "a") {   // Ctrl+A: the block's words, then every block
      e.preventDefault(); const s = getSelection();
      if (!tx.textContent || s.toString().length >= tx.textContent.length) return pickAll();
      const r = document.createRange(); r.selectNodeContents(tx); s.removeAllRanges(); s.addRange(r); return;
    }
    if ((k === "ArrowUp" || k === "ArrowDown") && e.shiftKey && !mod && !e.altKey && focusAtLine(tx, k === "ArrowUp")) {   // off the block's edge: whole blocks
      const j = k === "ArrowUp" ? prevVisible(i) : nextVisible(i);
      if (j >= 0) { e.preventDefault(); return setPick(b.id, B[j].id); }
    }
    if (mod && !e.shiftKey && !e.altKey) {
      const cmd = { b: "bold", i: "italic", u: "underline" }[k.toLowerCase()];
      if (cmd && b.type !== "code") { e.preventDefault(); document.execCommand(cmd); sync(b, tx); return changed(); }
      if (k.toLowerCase() === "e" && b.type !== "code") { e.preventDefault(); return inlineCode(b, tx); }
      if (k.toLowerCase() === "k" && b.type !== "code") { e.preventDefault(); return linkIt(b, tx); }
      if (k.toLowerCase() === "d") { e.preventDefault(); return duplicate(b); }
      if (k === "Enter") { e.preventDefault(); if (b.type === "todo") { b.checked = !b.checked; changed(true); return render({ id: b.id, at: caretOffset(tx) }); } if (b.type === "toggle") { b.open = !b.open; changed(true); return render({ id: b.id, at: caretOffset(tx) }); } if (b.type === "code") { const n = insertAfter(kidsEnd(i) - 1, newBlock("text", { indent: b.indent })); changed(true); return render({ id: n.id }); } return; }
    }
    if (mod && e.shiftKey && k.toLowerCase() === "s" && b.type !== "code") { e.preventDefault(); document.execCommand("strikeThrough"); sync(b, tx); return changed(); }
    if (mod && e.shiftKey && (k === "ArrowUp" || k === "ArrowDown")) { e.preventDefault(); return moveGroup(b.id, k === "ArrowUp" ? -1 : 1, caretOffset(tx)); }
    if (k === "Tab") { e.preventDefault(); return indentBy(b, e.shiftKey ? -1 : 1, caretOffset(tx)); }
    if (k === "Enter" && !e.shiftKey && !mod) {
      if (b.type === "code") return;   // a new line inside the code
      e.preventDefault();
      const empty = !tx.textContent && !tx.querySelector("br,img");
      if (empty && LISTS.has(b.type) || empty && (b.type === "quote" || b.type === "callout")) {   // Enter on an empty list item steps out
        if (b.indent > 0 && LISTS.has(b.type)) return indentBy(b, -1, 0);
        return turnInto(b, "text");
      }
      // "| a | b |" and Enter: a table with that row as its header
      const bars = b.type === "text" ? tableRow(tx.textContent) : null;
      if (bars && bars.length >= 2 && caretOffset(tx) === tx.textContent.length) {
        Object.assign(b, { type: "table", html: "", rows: [bars.map(esc), bars.map(() => "")], head: true });
        changed(true); return render({ id: b.id, cell: [1, 0], at: 0 });
      }
      // split at the caret: what follows goes to a new block
      const s = getSelection(); if (s.rangeCount) s.getRangeAt(0).deleteContents();
      const r = document.createRange(); r.setStart(s.anchorNode, s.anchorOffset); r.setEnd(tx, tx.childNodes.length);
      const tail = el("div"); tail.append(r.extractContents()); sync(b, tx);
      const cont = LISTS.has(b.type) ? b.type : b.type === "quote" || b.type === "callout" ? "text" : "text";
      const atEndOfOpenToggle = b.type === "toggle" && b.open;
      const n = newBlock(atEndOfOpenToggle ? "text" : cont, { html: cleanHtml(tail.innerHTML), indent: atEndOfOpenToggle ? Math.min(MAX_INDENT, b.indent + 1) : b.indent });
      if (/^h[123]$/.test(b.type) && !tx.textContent && n.html) { n.type = b.type; b.type = "text"; }   // Enter at the start of a heading pushes it down
      const at = b.type === "toggle" && !b.open ? kidsEnd(i) - 1 : i;
      insertAfter(at, n); changed(true); return render({ id: n.id, at: 0 });
    }
    if (k === "Enter" && e.shiftKey && b.type !== "code") { e.preventDefault(); document.execCommand("insertLineBreak"); sync(b, tx); return changed(); }
    if (k === "Backspace" && !mod) {
      const at = caretOffset(tx), s = getSelection();
      if (at !== 0 || !s.isCollapsed) return;
      e.preventDefault();
      if (b.type !== "text") return turnInto(b, "text");
      if (b.indent > 0) return indentBy(b, -1, 0);
      if (i === 0) return;
      const p = prevVisible(i);
      if (p < 0) return;
      const prev = B[p];
      if (KEPT.has(prev.type)) { if (!tx.textContent && !b.html) { B.splice(i, 1); changed(true); } return render({ id: prev.id, at: "end" }); }   // a table or picture above: step into it (an empty line goes)
      if (!TEXTY.has(prev.type)) { B.splice(p, 1); changed(true); return render({ id: b.id, at: 0 }); }   // a divider or page link above goes
      const join = plain(prev.html).length;
      prev.html = prev.type === "code" ? prev.html + tx.textContent : cleanHtml(prev.html + b.html);
      B.splice(i, 1); changed(true); return render({ id: prev.id, at: join });
    }
    if (k === "Delete" && !mod) {
      const at = caretOffset(tx); if (at !== tx.textContent.length || !getSelection().isCollapsed) return;
      const n = B[i + 1]; if (!n) return; e.preventDefault();
      if (KEPT.has(n.type)) return place(n.id, 0);
      if (!TEXTY.has(n.type)) { B.splice(i + 1, 1); changed(true); return render({ id: b.id, at }); }
      b.html = cleanHtml(b.html + n.html); B.splice(i + 1, 1); changed(true); return render({ id: b.id, at });
    }
    if ((k === "ArrowUp" || k === "ArrowDown") && !mod && !e.shiftKey) {
      if (!atLine(tx, k === "ArrowUp")) return;
      const j = k === "ArrowUp" ? prevVisible(i) : nextVisible(i); if (j < 0) return;
      e.preventDefault(); return place(B[j].id, k === "ArrowUp" ? "end" : 0);
    }
    if (k === "ArrowLeft" && caretOffset(tx) === 0 && getSelection().isCollapsed) { const j = prevVisible(i); if (j >= 0) { e.preventDefault(); place(B[j].id, "end"); } }
    if (k === "ArrowRight" && caretOffset(tx) === tx.textContent.length && getSelection().isCollapsed) { const j = nextVisible(i); if (j >= 0) { e.preventDefault(); place(B[j].id, 0); } }
  }
  // keys on a divider or a page link, which have no text
  function solidKey(e, b) {
    const i = idx(b.id), k = e.key;
    if (k === "Backspace" || k === "Delete") { e.preventDefault(); B.splice(i, 1); if (!B.length) B.push(newBlock()); changed(true); const j = Math.max(0, Math.min(B.length - 1, k === "Backspace" ? i - 1 : i)); return render({ id: B[j].id, at: "end" }); }
    if (k === "Enter") { e.preventDefault(); if (b.type === "page") return opts.openPage?.(b.pageId); const n = insertAfter(i, newBlock("text", { indent: b.indent })); changed(true); return render({ id: n.id }); }
    if (k === "ArrowUp" || k === "ArrowDown") { const j = k === "ArrowUp" ? prevVisible(i) : nextVisible(i); if (j >= 0) { e.preventDefault(); place(B[j].id, k === "ArrowUp" ? "end" : 0); } }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "ArrowUp" || k === "ArrowDown")) { e.preventDefault(); moveGroup(b.id, k === "ArrowUp" ? -1 : 1); }
  }
  function prevVisible(i) { const h = hidden(); for (let j = i - 1; j >= 0; j--) if (!h.has(B[j].id)) return j; return -1; }
  function nextVisible(i) { const h = hidden(); for (let j = i + 1; j < B.length; j++) if (!h.has(B[j].id)) return j; return -1; }

  // ---------- block changes ----------
  function turnInto(b, type, extra = {}) {
    const i = idx(b.id);
    if (type === "page") return makeSubpage(i, b);
    if (type === "divider") { b.type = "divider"; b.html = ""; const n = insertAfter(i, newBlock("text", { indent: b.indent })); changed(true); return render({ id: n.id }); }
    if (type === "table") {
      const first = b.type === "code" ? escapeCode(b.html) : b.html || "";
      Object.assign(b, { type: "table", html: "", rows: [[first, "", ""], ["", "", ""]], head: true }); delete b.checked; delete b.open;
      changed(true); return render({ id: b.id, cell: [0, 0], at: "end" });
    }
    if (b.type === "code" && type !== "code") b.html = escapeCode(b.html).replace(/\n/g, "<br>");
    if (type === "code" && b.type !== "code") b.html = plain(b.html);
    b.type = type; if (type === "todo") b.checked = !!extra.checked; else delete b.checked;
    if (type === "toggle") b.open = true;
    changed(true); render({ id: b.id, at: "end" });
  }
  async function makeSubpage(i, b) {
    const id = await opts.newSubpage?.(); if (!id) return;
    const n = { id: uid(), type: "page", pageId: id, html: "", indent: b.indent };
    if (b && !plain(b.html).trim() && TEXTY.has(b.type)) B.splice(i, 1, n); else B.splice(i + 1, 0, n);
    changed(true); render();
    opts.openPage?.(id);
  }
  function indentBy(b, d, at) {
    const i = idx(b.id), end = kidsEnd(i), pv = prevVisible(i), max = pv >= 0 ? B[pv].indent + 1 : 0;
    const to = Math.max(0, Math.min(MAX_INDENT, d > 0 ? Math.min(max, b.indent + 1) : b.indent - 1)), step = to - b.indent;
    if (!step) return;
    for (let j = i; j < end; j++) B[j].indent = Math.max(0, Math.min(MAX_INDENT, B[j].indent + step));
    changed(true); render({ id: b.id, at });
  }
  function moveGroup(id, dir, at) {
    const i = idx(id), end = kidsEnd(i), group = B.slice(i, end);
    if (dir < 0) {
      const j = prevVisible(i); if (j < 0) return;
      let s = j; while (s > 0 && B[s].indent > group[0].indent) s--;   // jump over the whole block above, children and all
      B.splice(i, group.length); B.splice(s, 0, ...group);
    } else {
      if (end >= B.length) return;
      const after = kidsEnd(end);
      B.splice(i, group.length); B.splice(after - group.length, 0, ...group);
    }
    changed(true); render({ id, at });
  }
  function duplicate(b) {
    const i = idx(b.id), end = kidsEnd(i), copy = B.slice(i, end).map((x) => ({ ...clone(x), id: uid() })).filter((x) => x.type !== "page");
    B.splice(end, 0, ...copy); changed(true); render({ id: copy[0]?.id || b.id });
  }
  function remove(b) {
    const i = idx(b.id), end = kidsEnd(i); B.splice(i, end - i); if (!B.length) B.push(newBlock());
    changed(true); render({ id: B[Math.max(0, i - 1)].id });
  }
  function inlineCode(b, tx) {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0), inCode = r.commonAncestorContainer.parentElement?.closest("code");
    if (inCode && tx.contains(inCode)) { inCode.replaceWith(...inCode.childNodes); }
    else { const c = document.createElement("code"); c.append(r.extractContents()); r.insertNode(c); s.selectAllChildren(c); }
    sync(b, tx); changed();
  }
  async function linkIt(b, tx) {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0).cloneRange();
    const v = await dialog({ title: "Link", fields: [{ name: "url", label: "Address", placeholder: "https://", max: 2000 }], ok: "Link" });
    tx.focus(); s.removeAllRanges(); s.addRange(r);
    if (!v) return;
    const url = /^(https?:|mailto:)/i.test(v.url.trim()) ? v.url.trim() : "https://" + v.url.trim();
    document.execCommand("createLink", false, url); sync(b, tx); b.html = cleanHtml(b.html); changed(true);
  }

  // ---------- tables ----------
  // Each cell is a little editable box of its own (plain rich text, like a line); the block keeps them as rows of html.
  const tcur = new Map();   // the cell last in use per table, for the handle's menu
  const TKEYS = { rowBelow: "Alt+Shift+↓", rowAbove: "Alt+Shift+↑", colRight: "Alt+Shift+→", colLeft: "Alt+Shift+←", delRow: "Alt+Shift+Backspace", delCol: "Alt+Shift+Delete", head: "Alt+Shift+H" };
  function tableFor(b) {
    const body = el("tbody", {}, b.rows.map((cells, r) => el("tr", {}, cells.map((html, c) => {
      const cell = el("div", { class: "cell", contentEditable: opts.readOnly ? "false" : "true", html, dataset: { r, c }, role: "textbox", "aria-label": `Row ${r + 1}, column ${c + 1}` });
      cell.addEventListener("input", (e) => { sync(b, cell); if (quiet) return; const it = e.inputType || ""; if (/Paste|Drop|Cut|format|history/.test(it)) return changed(true); changed(false, { id: `${b.id}:${r}:${c}`, bid: b.id, kind: it.startsWith("delete") ? "del" : "ins" }); });
      cell.addEventListener("keydown", (e) => cellKey(e, b, cell));
      cell.addEventListener("paste", (e) => cellPaste(e, b, cell));
      cell.addEventListener("focus", () => { clearPick(true); tcur.set(b.id, [r, c]); root.querySelectorAll(".blk.focus").forEach((x) => x.classList.remove("focus")); cell.closest(".blk").classList.add("focus"); });
      return el(b.head && r === 0 ? "th" : "td", {}, cell);
    }))));
    const add = (cls, label, key, run) => el("button", { class: "tadd " + cls, type: "button", tabIndex: -1, title: `${label} (${key})`, "aria-label": label, text: "+", onpointerdown: (e) => { e.preventDefault(); run(); } });
    return el("div", { class: "tblwrap" }, el("div", { class: "tblgrid" }, el("table", { class: "tbl" + (b.head ? " head" : "") }, body),
      add("col", "Add a column", TKEYS.colRight, () => addCol(b, b.rows[0].length, 0)),
      add("row", "Add a row", TKEYS.rowBelow, () => addRow(b, b.rows.length, 0))));
  }
  const where = (b) => { const [r, c] = tcur.get(b.id) || [b.rows.length - 1, 0]; return [Math.min(r, b.rows.length - 1), Math.min(c, b.rows[0].length - 1)]; };
  function addRow(b, at, c = where(b)[1]) { b.rows.splice(at, 0, b.rows[0].map(() => "")); changed(true); render({ id: b.id, cell: [at, c], at: 0 }); }
  function addCol(b, at, r = where(b)[0]) { for (const row of b.rows) row.splice(at, 0, ""); changed(true); render({ id: b.id, cell: [r, at], at: 0 }); }
  function delRow(b, r = where(b)[0]) {
    if (b.rows.length <= 1) return remove(b);
    b.rows.splice(r, 1); changed(true); render({ id: b.id, cell: [Math.min(r, b.rows.length - 1), where(b)[1]], at: "end" });
  }
  function delCol(b, c = where(b)[1]) {
    if (b.rows[0].length <= 1) return remove(b);
    for (const row of b.rows) row.splice(c, 1); changed(true); render({ id: b.id, cell: [where(b)[0], Math.min(c, b.rows[0].length - 1)], at: "end" });
  }
  function toggleHead(b) { b.head = !b.head; changed(true); const [r, c] = where(b); render({ id: b.id, cell: [r, c], at: "end" }); }
  function tableItems(b) {
    const [r, c] = where(b);
    return [{ label: "Add a row below", key: TKEYS.rowBelow, run: () => addRow(b, r + 1, c) }, { label: "Add a row above", key: TKEYS.rowAbove, run: () => addRow(b, r, c) },
      { label: "Add a column right", key: TKEYS.colRight, run: () => addCol(b, c + 1, r) }, { label: "Add a column left", key: TKEYS.colLeft, run: () => addCol(b, c, r) },
      { label: "Delete row", key: TKEYS.delRow, run: () => delRow(b, r) }, { label: "Delete column", key: TKEYS.delCol, run: () => delCol(b, c) },
      { label: (b.head ? "✓ " : "") + "Header row", key: TKEYS.head, run: () => toggleHead(b) }, "-"];
  }
  function cellKey(e, b, cell) {
    if (slash && slashKey(e)) return;
    const r = +cell.dataset.r, c = +cell.dataset.c, R = b.rows.length, C = b.rows[0].length, k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === "Escape" && !e.shiftKey && !getSelection().isCollapsed) { e.preventDefault(); e.stopPropagation(); return setPick(b.id); }
    if (mod && !e.shiftKey && !e.altKey && k.toLowerCase() === "a" && getSelection().toString().length >= cell.textContent.length) { e.preventDefault(); return pickAll(); }
    const go = (rr, cc, at = "end") => { e.preventDefault(); tcur.set(b.id, [rr, cc]); const x = cellOf(b.id, rr, cc); if (x) { x.focus(); setCaret(x, at); } };
    const out = (dir) => { const i = idx(b.id), j = dir < 0 ? prevVisible(i) : nextVisible(i); e.preventDefault(); if (j >= 0) return place(B[j].id, dir < 0 ? "end" : 0); if (dir > 0) { const n = insertAfter(i, newBlock("text", { indent: b.indent })); changed(true); render({ id: n.id }); } };
    if (e.altKey && e.shiftKey && !mod) {
      const run = { ArrowDown: () => addRow(b, r + 1, c), ArrowUp: () => addRow(b, r, c), ArrowRight: () => addCol(b, c + 1, r), ArrowLeft: () => addCol(b, c, r), Backspace: () => delRow(b, r), Delete: () => delCol(b, c) }[k] || (e.code === "KeyH" ? () => toggleHead(b) : null);
      if (run) { e.preventDefault(); return run(); }
    }
    if (mod && !e.shiftKey && !e.altKey) {
      const cmd = { b: "bold", i: "italic", u: "underline" }[k.toLowerCase()];
      if (cmd) { e.preventDefault(); document.execCommand(cmd); sync(b, cell); return changed(); }
      if (k.toLowerCase() === "e") { e.preventDefault(); return inlineCode(b, cell); }
      if (k.toLowerCase() === "k") { e.preventDefault(); return linkIt(b, cell); }
      if (k.toLowerCase() === "d") { e.preventDefault(); return duplicate(b); }
      if (k === "Enter") return out(1);
    }
    if (mod && e.shiftKey && k.toLowerCase() === "s") { e.preventDefault(); document.execCommand("strikeThrough"); sync(b, cell); return changed(); }
    if (mod && e.shiftKey && (k === "ArrowUp" || k === "ArrowDown")) { e.preventDefault(); return moveGroup(b.id, k === "ArrowUp" ? -1 : 1); }
    if (k === "Tab") {
      if (e.shiftKey) return r || c ? go(c ? r : r - 1, c ? c - 1 : C - 1) : e.preventDefault();
      if (c < C - 1) return go(r, c + 1); if (r < R - 1) return go(r + 1, 0);
      e.preventDefault(); return addRow(b, R, 0);   // Tab in the last cell: a new row
    }
    if (k === "Enter" && e.shiftKey) { e.preventDefault(); document.execCommand("insertLineBreak"); sync(b, cell); return changed(); }
    if (k === "Enter") { if (r === R - 1) { e.preventDefault(); return addRow(b, R, 0); } return go(r + 1, c); }   // Enter in the last row adds one
    if (mod || e.altKey || e.shiftKey) return;
    const s = getSelection(), at = caretOffset(cell), len = cell.textContent.length;
    if (k === "ArrowUp" && atLine(cell, true)) return r ? go(r - 1, c) : out(-1);
    if (k === "ArrowDown" && atLine(cell, false)) return r < R - 1 ? go(r + 1, c, 0) : out(1);
    if (k === "ArrowLeft" && at === 0 && s.isCollapsed) return c ? go(r, c - 1) : r ? go(r - 1, C - 1) : out(-1);
    if (k === "ArrowRight" && at === len && s.isCollapsed) return c < C - 1 ? go(r, c + 1, 0) : r < R - 1 ? go(r + 1, 0, 0) : out(1);
    if ((k === "Backspace" || k === "Delete") && s.isCollapsed && b.rows.every((row) => row.every((x) => !plain(x)))) { e.preventDefault(); return remove(b); }   // an empty table goes
  }
  // a table pasted into a cell fills the cells from there on, growing the table to fit
  function cellPaste(e, b, cell) {
    const grid = gridFrom(e.clipboardData);
    if (!grid) { const text = e.clipboardData?.getData("text/plain"); if (text == null) return; e.preventDefault(); H.burst = null; document.execCommand("insertText", false, text.replace(/\r?\n/g, " ")); H.burst = null; return; }
    e.preventDefault();
    const r0 = +cell.dataset.r, c0 = +cell.dataset.c, w = Math.max(b.rows[0].length, c0 + Math.max(...grid.rows.map((x) => x.length)));
    for (const row of b.rows) while (row.length < w) row.push("");
    grid.rows.forEach((cells, i) => { const r = r0 + i; while (b.rows.length <= r) b.rows.push(Array(w).fill("")); cells.forEach((h, j) => { b.rows[r][c0 + j] = h; }); });
    changed(true); render({ id: b.id, cell: [r0 + grid.rows.length - 1, c0 + grid.rows.at(-1).length - 1], at: "end" });
  }

  // ---------- pictures ----------
  // A pasted screenshot or a dropped file becomes an image block; the picture itself is shrunk and saved apart (images.js).
  const IKEYS = { view: "Space", copy: "Ctrl+C", size: "Alt+Shift+← →" };
  function imageRow(b, row) {
    row.tabIndex = 0;
    const img = el("img", { alt: plain(b.caption) || "", draggable: false, onclick: () => viewImage(b) });
    if (b.w && b.h) img.style.aspectRatio = `${b.w} / ${b.h}`;
    const grip = (side) => { const g = el("div", { class: "imgrip " + side, title: `Drag to resize (${IKEYS.size})` }); g.addEventListener("pointerdown", (e) => resizeImage(e, b, row, fig)); return g; };
    const cap = el("div", { class: "cap", contentEditable: opts.readOnly ? "false" : "true", html: b.caption || "", dataset: { ph: "Caption" }, role: "textbox", "aria-label": "Caption" });
    cap.addEventListener("input", (e) => { b.caption = cleanHtml(cleanInline(cap.innerHTML)); img.alt = plain(b.caption); changed(false, { id: b.id + ":cap", bid: b.id, kind: (e.inputType || "").startsWith("delete") ? "del" : "ins" }); });
    cap.addEventListener("keydown", (e) => capKey(e, b, cap));
    cap.addEventListener("paste", (e) => { const t = e.clipboardData?.getData("text/plain"); if (t == null) return; e.preventDefault(); document.execCommand("insertText", false, t.replace(/\s*\n\s*/g, " ")); });
    const fig = el("figure", { class: "imgfig", style: `width:${b.width || 100}%` }, el("div", { class: "iframe" }, img, grip("l"), grip("r")), cap);
    const shown = urlOf(b.fileId);
    if (shown) img.src = shown;
    else opts.files?.load(b.fileId).then((rec) => { const u = urlOf(b.fileId, rec); if (u) img.src = u; else fig.classList.add("missing"); }).catch(() => fig.classList.add("missing"));
    row.append(fig);
    row.addEventListener("keydown", (e) => { if (e.target === row) imageKey(e, b); });
    row.addEventListener("contextmenu", (e) => { if (e.target.closest(".cap")) return; e.preventDefault(); row.focus(); blockMenu(b.id, { left: e.clientX, right: e.clientX + 1, top: e.clientY, bottom: e.clientY }); });
    return row;
  }
  function imageKey(e, b) {
    const i = idx(b.id), k = e.key, mod = e.ctrlKey || e.metaKey, stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (mod && !e.shiftKey && k.toLowerCase() === "c") { stop(); return copyImage(b); }
    if (mod && !e.shiftKey && k.toLowerCase() === "d") { stop(); return duplicate(b); }
    if (mod && e.shiftKey && (k === "ArrowUp" || k === "ArrowDown")) { stop(); return moveGroup(b.id, k === "ArrowUp" ? -1 : 1); }
    if (e.altKey && e.shiftKey && (k === "ArrowLeft" || k === "ArrowRight")) { stop(); return sizeImage(b, (b.width || 100) + (k === "ArrowRight" ? 10 : -10)); }
    if (mod || e.altKey) return;
    if (k === "Backspace" || k === "Delete") { stop(); return remove(b); }
    if (k === "Enter") { stop(); const n = insertAfter(i, newBlock("text", { indent: b.indent })); changed(true); return render({ id: n.id }); }
    if (k === " ") { stop(); return viewImage(b); }
    if (k === "ArrowDown" || k === "ArrowRight") { stop(); const c = rowOf(b.id)?.querySelector(".cap"); if (c) { c.focus(); setCaret(c, 0); } return; }
    if (k === "ArrowUp" || k === "ArrowLeft") { const j = prevVisible(i); stop(); if (j >= 0) place(B[j].id, "end"); }
  }
  function capKey(e, b, cap) {
    const i = idx(b.id), k = e.key, at = caretOffset(cap), mod = e.ctrlKey || e.metaKey;
    if (mod || e.altKey) return;
    if (k === "Enter") { e.preventDefault(); const n = insertAfter(i, newBlock("text", { indent: b.indent })); changed(true); return render({ id: n.id }); }
    if ((k === "ArrowUp" && atLine(cap, true)) || ((k === "Backspace" || k === "ArrowLeft") && at === 0 && getSelection().isCollapsed)) { e.preventDefault(); return rowOf(b.id)?.focus(); }
    if ((k === "ArrowDown" && atLine(cap, false)) || (k === "ArrowRight" && at === cap.textContent.length)) { const j = nextVisible(i); if (j >= 0) { e.preventDefault(); place(B[j].id, 0); } }
  }
  function sizeImage(b, w) { w = Math.max(15, Math.min(100, Math.round(w))); if (w === (b.width || 100)) return; b.width = w; changed(true); render({ id: b.id }); }
  // drag either edge: the picture stays centred and grows or shrinks on both sides
  function resizeImage(e, b, row, fig) {
    if (e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    const g = e.currentTarget; g.setPointerCapture(e.pointerId);
    const rr = row.getBoundingClientRect(), cs = getComputedStyle(row), left = rr.left + parseFloat(cs.paddingLeft), wide = rr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), mid = left + wide / 2;
    let pct = b.width || 100;
    const move = (ev) => { pct = Math.max(15, Math.min(100, Math.round((Math.abs(ev.clientX - mid) * 2) / wide * 100))); fig.style.width = pct + "%"; };
    const up = () => { g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up); if (pct !== (b.width || 100)) { b.width = pct; changed(true); render({ id: b.id }); } };
    g.addEventListener("pointermove", move); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
  }
  function viewImage(b) {
    const u = urlOf(b.fileId); if (!u) return;
    const back = document.activeElement;
    const box = el("div", { class: "imgview", role: "dialog", "aria-label": plain(b.caption) || "Picture" }, el("figure", {}, el("img", { src: u, alt: plain(b.caption) || "" }), b.caption ? el("figcaption", { html: b.caption }) : null));
    const close = () => { box.remove(); document.removeEventListener("keydown", key, true); back?.focus?.(); };
    const key = (e) => { if (e.key === "Escape" || e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); close(); } };
    box.addEventListener("click", close); document.addEventListener("keydown", key, true);
    document.body.append(box);
  }
  async function copyImage(b) {
    try {
      const rec = await opts.files?.load(b.fileId); if (!rec) throw new Error();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": await pngOf(rec) })]);
      opts.notify?.("Picture copied");
    } catch { opts.notify?.("The picture couldn't be copied"); }
  }
  // pictures in, after the block given (or in place of it, when it's an empty line)
  async function addImages(files, at) {
    if (!opts.files) return;
    const made = [], wide = Math.max(300, root.clientWidth - 30), dpr = window.devicePixelRatio || 1;
    for (const f of files) {
      try {
        const rec = await shrinkImage(f), id = await opts.files.save(rec); urlOf(id, rec);
        made.push(newBlock("image", { fileId: id, w: rec.w, h: rec.h, width: Math.max(15, Math.min(100, Math.round((rec.w / dpr / wide) * 100))), caption: "" }));
      } catch (e) { opts.notify?.(e.message || "That picture couldn't be read"); }
    }
    if (!made.length) return;
    let i = idx(at.id); if (i < 0) i = B.length - 1;
    const ref = B[i]; for (const m of made) m.indent = ref?.indent || 0;
    if (at.replace && ref?.type === "text" && !plain(ref.html).trim()) B.splice(i, 1, ...made);
    else B.splice(at.before ? i : i + 1, 0, ...made);
    changed(true); render({ id: made.at(-1).id });
  }
  const filesIn = (dt) => [...(dt?.files || [])].filter(isImage);
  root.addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.items || [])].some((x) => x.kind === "file")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }, true);
  root.addEventListener("drop", (e) => {
    const fs = filesIn(e.dataTransfer); if (!fs.length) return;
    e.preventDefault(); e.stopPropagation();
    const rows = [...root.querySelectorAll(".blk:not([hidden])")];
    let at = { id: B.at(-1).id };
    for (const r of rows) { const bx = r.getBoundingClientRect(); if (e.clientY < bx.bottom) { at = { id: r.dataset.id, before: e.clientY < bx.top + bx.height / 2 }; break; } }
    addImages(fs, at);
  }, true);

  // ---------- the / menu ----------
  function openSlash(b, tx, start, kind = "block") {
    closeSlash();
    const box = el("div", { class: "slash", role: "listbox", "aria-label": kind === "date" ? "Date" : "Blocks" });
    document.body.append(box);
    slash = { b, tx, start, box, pick: 0, list: [], kind };
    updateSlash();
  }
  function updateSlash() {
    const s = slash; if (!s) return;
    const at = caretOffset(s.tx), t = s.tx.textContent;
    if (at <= s.start || t[s.start] !== (s.kind === "date" ? "@" : "/")) return closeSlash();
    const q = t.slice(s.start + 1, at).toLowerCase();
    if (q.length > 18 || /\s{2}/.test(q)) return closeSlash();
    s.list = (s.kind === "date" ? DATES : TYPES).filter(([type, name]) => !q || name.toLowerCase().includes(q) || type.startsWith(q) || name.toLowerCase().split(" ").some((w) => w.startsWith(q)));
    if (!s.list.length) return closeSlash();
    s.pick = Math.min(s.pick, s.list.length - 1);
    put(s.box, s.list.map(([type, name, ico], k) => el("button", { class: "si" + (k === s.pick ? " on" : ""), type: "button", role: "option", "aria-selected": String(k === s.pick), dataset: { type },
      onpointerdown: (e) => { e.preventDefault(); s.pick = k; chooseSlash(); } }, el("span", { class: "sico", text: ico }), el("span", { text: name }))));
    const r = getSelection().rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : s.tx.getBoundingClientRect();
    const h = s.box.offsetHeight, top = r.bottom + 6 + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    s.box.style.left = Math.max(8, Math.min(innerWidth - s.box.offsetWidth - 8, (r.left || s.tx.getBoundingClientRect().left))) + "px"; s.box.style.top = top + "px";
    s.box.querySelector(".si.on")?.scrollIntoView({ block: "nearest" });
  }
  function slashKey(e) {
    const s = slash;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); s.pick = (s.pick + (e.key === "ArrowDown" ? 1 : -1) + s.list.length) % s.list.length; updateSlash(); return true; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); chooseSlash(); return true; }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeSlash(); return true; }
    return false;
  }
  function chooseSlash() {
    const s = slash; if (!s) return; const [type] = s.list[s.pick]; closeSlash();
    if (s.kind === "date") return chooseDate(s, type);
    // take the "/query" out, then turn this block into the type, or add one below if this block has words in it
    const at = caretOffset(s.tx), sel = getSelection(), r = document.createRange();
    setCaret(s.tx, s.start); r.setStart(sel.anchorNode, sel.anchorOffset); setCaret(s.tx, at); r.setEnd(sel.anchorNode, sel.anchorOffset); r.deleteContents();
    sync(s.b, s.tx);
    if (!s.tx.textContent.trim()) { s.b.html = ""; return turnInto(s.b, type); }
    const i = idx(s.b.id), n = newBlock(type === "page" ? "text" : type, { indent: s.b.indent });
    insertAfter(i, n);
    if (type === "page") return makeSubpage(i + 1, n);
    if (type === "divider") return turnInto(n, "divider");
    if (type === "table") return turnInto(n, "table");
    if (type === "toggle") n.open = true;
    changed(true); render({ id: n.id });
  }
  function closeSlash() { slash?.box.remove(); slash = null; }
  // @today, @tomorrow, … or a picked day: a date tag in the text
  function chooseDate(s, when) {
    const at = caretOffset(s.tx), sel = getSelection(), r = document.createRange();
    setCaret(s.tx, s.start); r.setStart(sel.anchorNode, sel.anchorOffset); setCaret(s.tx, at); r.setEnd(sel.anchorNode, sel.anchorOffset); r.deleteContents();
    const caret = r.cloneRange();
    const insert = (iso) => {
      s.tx.focus(); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(caret);
      if (iso) document.execCommand("insertHTML", false, `<time datetime="${iso}" contenteditable="false">${relDate(iso)}</time>\u00a0`);
      sync(s.b, s.tx); s.b.html = cleanHtml(s.b.html); changed();
    };
    if (when === "pick") return datePicker(s.tx.getBoundingClientRect(), "", insert);
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (when === "tomorrow") d.setDate(d.getDate() + 1);
    if (when === "yesterday") d.setDate(d.getDate() - 1);
    if (when === "week") d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));   // next Monday
    insert(isoDay(d));
  }

  // ---------- dragging, and the handle's menu ----------
  function startDrag(e, id) {
    if (e.button > 0) return;
    e.preventDefault();
    const h = e.currentTarget, x0 = e.clientX, y0 = e.clientY;
    h.setPointerCapture(e.pointerId);
    const span = () => { const pr = pick && pickedIds().includes(id) ? pickRange() : null, i = pr ? pr[0] : idx(id); return [i, pr ? pr[1] + 1 : kidsEnd(i)]; };   // the picked blocks go together
    drag = { id, moved: false, line: null, to: null };
    const move = (ev) => {
      if (!drag.moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      if (!drag.moved) { drag.moved = true; root.classList.add("dragging"); const [i, end] = span(); for (let j = i; j < end; j++) rowOf(B[j].id)?.classList.add("lift"); drag.line = el("div", { class: "dropline" }); root.append(drag.line); }
      const rows = [...root.querySelectorAll(".blk:not([hidden]):not(.lift)")];
      let to = null, y = 0;
      for (const r of rows) { const b = r.getBoundingClientRect(); if (ev.clientY < b.top + b.height / 2) { to = r.dataset.id; y = b.top; break; } y = b.bottom; }
      drag.to = to; const top = root.getBoundingClientRect().top;
      drag.line.style.top = y - top - 1 + "px";
    };
    const up = () => {
      h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
      root.classList.remove("dragging"); drag.line?.remove();
      const d = drag; drag = null;
      if (!d.moved) { root.querySelectorAll(".lift").forEach((r) => r.classList.remove("lift")); return blockMenu(id, h); }
      const [i, end] = span(), group = B.splice(i, end - i), kept = !!pick;
      let at = d.to ? idx(d.to) : B.length; if (at < 0) at = B.length;
      const above = B[at - 1], base = above ? (above.type === "toggle" && above.open ? above.indent + 1 : Math.min(above.indent + (LISTS.has(above.type) ? 0 : 0), MAX_INDENT)) : 0;
      const shift = (above ? Math.min(group[0].indent, base) : 0) - group[0].indent;
      for (const g of group) g.indent = Math.max(0, g.indent + shift);
      B.splice(at, 0, ...group); changed(true);
      if (kept && pick) { render(); armTrap(); } else render({ id, at: "end" });
    };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  }
  function blockMenu(id, anchor) {
    const b = B[idx(id)]; if (!b) return;
    const ids = pickedIds();
    if (ids.length > 1 && ids.includes(id)) return menu(anchor, [   // several blocks picked: the menu is for them all
      { label: "Turn into", run: () => menu(anchor, TYPES.filter(([t]) => TEXTY.has(t)).map(([t, name]) => ({ label: name, run: () => eachPicked((x) => retype(x, t)) }))) },
      { label: "Colour", run: () => menu(anchor, [{ label: "Default", run: () => eachPicked((x) => { delete x.color; }) },
        ...COLORS.map((c) => ({ label: c[0].toUpperCase() + c.slice(1), run: () => eachPicked((x) => { x.color = c; }) })),
        "-", ...COLORS.map((c) => ({ label: c[0].toUpperCase() + c.slice(1) + " background", run: () => eachPicked((x) => { x.color = c + "-bg"; }) }))]) },
      { label: "Duplicate", key: "Ctrl+D", run: dupRange },
      { label: "Move up", key: "Ctrl+Shift+↑", run: () => moveRange(-1) },
      { label: "Move down", key: "Ctrl+Shift+↓", run: () => moveRange(1) },
      "-", { label: "Delete", key: "Del", danger: true, run: deleteRange },
    ]);
    menu(anchor, [
      ...(b.type === "table" ? tableItems(b) : []),
      ...(b.type === "image" ? [{ label: "View larger", key: IKEYS.view, run: () => viewImage(b) }, { label: "Copy image", key: IKEYS.copy, run: () => copyImage(b) },
        { label: "Caption", run: () => { const c = rowOf(b.id)?.querySelector(".cap"); c?.focus(); if (c) setCaret(c, "end"); } }, "-"] : []),
      TEXTY.has(b.type) && { label: "Turn into", run: () => menu(anchor, TYPES.filter(([t]) => t !== b.type && t !== "divider").map(([t, name]) => ({ label: name, run: () => turnInto(b, t) }))) },
      b.type !== "image" && { label: "Colour", run: () => menu(anchor, [{ label: (b.color ? "" : "✓ ") + "Default", run: () => { delete b.color; changed(true); render(); } },
        ...COLORS.flatMap((c) => [{ label: (b.color === c ? "✓ " : "") + c[0].toUpperCase() + c.slice(1), run: () => { b.color = c; changed(true); render(); } }]),
        "-", ...COLORS.map((c) => ({ label: (b.color === c + "-bg" ? "✓ " : "") + c[0].toUpperCase() + c.slice(1) + " background", run: () => { b.color = c + "-bg"; changed(true); render(); } }))]) },
      { label: "Duplicate", key: "Ctrl+D", run: () => duplicate(b) },
      { label: "Move up", key: "Ctrl+Shift+↑", run: () => moveGroup(b.id, -1) },
      { label: "Move down", key: "Ctrl+Shift+↓", run: () => moveGroup(b.id, 1) },
      "-", { label: "Delete", key: "Del", danger: true, run: () => remove(b) },
    ]);
  }

  // ---------- the toolbar over selected text ----------
  const bar = el("div", { class: "fmtbar", hidden: true, role: "toolbar", "aria-label": "Format" },
    [["bold", "B", "Ctrl+B"], ["italic", "I", "Ctrl+I"], ["underline", "U", "Ctrl+U"], ["strikeThrough", "S", "Ctrl+Shift+S"], ["code", "<>", "Ctrl+E"], ["link", "Link", "Ctrl+K"]].map(([cmd, label, key]) =>
      el("button", { type: "button", class: "fb f-" + cmd.toLowerCase(), title: `${label} (${key})`, "aria-label": label, text: label, onpointerdown: (e) => {
        e.preventDefault(); const tx = getSelection().anchorNode?.parentElement?.closest(".tx, .cell"); const b = tx && B[idx(tx.closest(".blk").dataset.id)]; if (!b) return;
        if (cmd === "code") inlineCode(b, tx); else if (cmd === "link") linkIt(b, tx); else { document.execCommand(cmd); sync(b, tx); changed(); }
      } })));
  document.body.append(bar);
  const onSel = () => {
    const s = getSelection(), tx = s.anchorNode && s.anchorNode.parentElement?.closest?.(".tx, .cell");
    if (s.rangeCount && s.isCollapsed) { const c = caretNow(); if (c) H.cur.focus = c; }
    if (!s.rangeCount || s.isCollapsed || !tx || !root.contains(tx) || tx.closest(".t-code")) { bar.hidden = true; return; }
    const r = s.getRangeAt(0).getBoundingClientRect(); bar.hidden = false;
    bar.style.left = Math.max(8, Math.min(innerWidth - bar.offsetWidth - 8, r.left + r.width / 2 - bar.offsetWidth / 2)) + "px";
    bar.style.top = Math.max(8, r.top - bar.offsetHeight - 8) + "px";
  };
  document.addEventListener("selectionchange", onSel);

  // the box before an action ticks it
  root.addEventListener("click", (e) => {
    const m = e.target.closest?.("mark[data-action]"); if (!m || !opts.onTick) return;
    const r = m.getClientRects()[0]; if (r && e.clientX < r.left + 18) { e.preventDefault(); opts.onTick(m.dataset.action); }
  });
  // clicking a date tag picks another day
  root.addEventListener("click", (e) => {
    const t = e.target.closest?.("time[datetime]"), tx = t?.closest(".tx"); if (!t || !tx || opts.readOnly) return;
    const b = B[idx(tx.closest(".blk").dataset.id)]; if (!b) return;
    datePicker(t, t.getAttribute("datetime"), (iso) => { if (iso) { t.setAttribute("datetime", iso); t.textContent = relDate(iso); } else t.remove(); sync(b, tx); b.html = cleanHtml(b.html); changed(); });
  });
  // clicking below the last block puts the caret at the end, or starts a new block after a heading, list or solid block
  const belowLast = () => {
    const last = B.at(-1);
    if (last.type === "text" && !plain(last.html)) return place(last.id);
    const n = B.push(newBlock()) && B.at(-1); changed(true); render({ id: n.id });
  };

  // ---------- picking whole blocks, as in Notion ----------
  // A drag out of one block's words into another, a box drawn from the margin, Shift+click, Shift+↑↓ off a block's edge,
  // Ctrl+A twice and Esc over words all pick whole blocks; a block's children come with it (a closed toggle's hidden ones too).
  // While blocks are picked the keys go to a hidden box holding their text, so copy, cut and paste come as events.
  let pick = null, sweep = null, box = null, marks = new Map();   // pick: { a: where it started, z: where it reaches }
  const trap = el("textarea", { class: "bkeys", tabIndex: -1, "aria-label": "Picked blocks", spellcheck: false });
  opts.host.append(trap);
  function pickRange() {
    if (!pick) return null;
    let i = idx(pick.a), j = idx(pick.z); if (i < 0 || j < 0) return null;
    if (i > j) [i, j] = [j, i];
    let end = j; for (let k = i; k <= end; k++) end = Math.max(end, kidsEnd(k) - 1);
    return [i, end];
  }
  const pickedIds = () => { const r = pickRange(); return r ? B.slice(r[0], r[1] + 1).map((b) => b.id) : []; };
  function showPick() {
    const ids = new Set(pickedIds());
    root.querySelectorAll(".blk").forEach((r) => r.classList.toggle("picked", ids.has(r.dataset.id)));
    root.classList.toggle("haspick", ids.size > 0);
  }
  function setPick(a, z, { focus = true } = {}) {
    if (idx(a) < 0) return;
    pick = { a, z: z && idx(z) >= 0 ? z : a }; showPick();
    if (focus) { armTrap(); opts.onPick?.(); }
  }
  function armTrap() {
    const r = pickRange(); if (!r) return;
    trap.value = blocksToText(B.slice(r[0], r[1] + 1), opts.pageTitle) || " ";
    getSelection().removeAllRanges(); trap.focus({ preventScroll: true }); trap.select();
  }
  function clearPick(quiet) {
    if (!pick) return;
    pick = null; showPick();
    if (document.activeElement === trap && !quiet) trap.blur();
    opts.onPick?.();
  }
  const pickAll = () => setPick(B[0].id, B.at(-1).id);
  const visRows = () => [...root.querySelectorAll(".blk:not([hidden])")];
  function rowAtY(y) { const rows = visRows(); for (const r of rows) if (y < r.getBoundingClientRect().bottom) return r; return rows.at(-1) || null; }
  const scroller = () => root.closest(".nedit") || opts.host.parentElement;
  function edgeScroll(y) { const l = scroller(); if (!l) return; const r = l.getBoundingClientRect(); if (y < r.top + 32) l.scrollTop -= 16; else if (y > r.bottom - 32) l.scrollTop += 16; }
  // what's picked, for the quick bar: its text, and the last block reached (the bar goes under it)
  function picked() {
    const r = pickRange(); if (!r) return null;
    const list = B.slice(r[0], r[1] + 1), text = blocksToText(list, opts.pageTitle), flat = text.replace(/\s+/g, " ").trim();
    const at = rowOf(pick.z) || rowOf(list[0].id);
    return { text: flat, full: text, ids: list.map((b) => b.id), blocks: list.map((b) => clone(b)), long: flat.length > 120 || flat.split(" ").length > 8, rect: at?.getBoundingClientRect() || root.getBoundingClientRect() };
  }

  // a press in a block's words may become a sweep across blocks; Shift+click reaches from the caret's block to this one
  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch" || opts.readOnly) return;
    const row = e.target.closest?.(".blk"); if (!row || !root.contains(row) || e.target.closest(".hdl, .tmark")) return;
    if (e.shiftKey) {
      const from = pick ? pick.a : caretNow()?.id || H.cur.focus?.id;
      if (from && idx(from) >= 0 && (from !== row.dataset.id || pick)) { e.preventDefault(); return setPick(from, row.dataset.id); }
      return;
    }
    if (e.target.closest(".tx, .cell, .cap")) sweep = { from: row.dataset.id, on: false };
  });
  // anywhere else on the page: let go of what's picked, and a press in the margin may draw a box
  const onDown = (e) => {
    if (!root.isConnected) return;
    if (pick && !e.shiftKey && !e.target.closest?.(".qpanel, .menu, .dialog, .talkp, .blk.picked .hdl")) clearPick(true);
    if (e.button !== 0 || e.pointerType === "touch" || opts.readOnly || box) return;
    const lane = scroller(); if (!lane?.contains(e.target)) return;
    if (e.target.closest?.(".tx, .cell, .cap, button, input, textarea, select, a, label, .props, .imgfig, [contenteditable]")) return;
    const lr = lane.getBoundingClientRect(); if (e.clientX >= lr.left + lane.clientWidth || e.clientY >= lr.top + lane.clientHeight) return;   // its scrollbar
    if (e.clientY < root.getBoundingClientRect().top - 4) return;   // the title and properties
    const lastRow = rowOf(B.at(-1).id), below = e.target === root && lastRow && e.clientY > lastRow.getBoundingClientRect().bottom;
    if (below) e.preventDefault();
    box = { x: e.clientX, y: e.clientY + lane.scrollTop, lane, on: false, el: null, click: below ? belowLast : null };
  };
  const onMove = (e) => {
    if (sweep) {
      if (!(e.buttons & 1)) { sweep = null; root.classList.remove("sweeping"); return; }
      const r = rowAtY(e.clientY); if (!r) return;
      if (r.dataset.id !== sweep.from) {
        if (!sweep.on) { sweep.on = true; root.classList.add("sweeping"); }
        setPick(sweep.from, r.dataset.id, { focus: false }); getSelection().removeAllRanges();
      } else if (sweep.on) { sweep.on = false; root.classList.remove("sweeping"); clearPick(true); }   // back in the first block: words again
      edgeScroll(e.clientY);
      return;
    }
    if (!box) return;
    if (!(e.buttons & 1)) return onUp();
    const y0 = box.y - box.lane.scrollTop;
    if (!box.on) {
      if (Math.hypot(e.clientX - box.x, e.clientY - y0) < 6) return;
      box.on = true; box.click = null; box.lane.classList.add("boxing"); box.el = el("div", { class: "bbox" }); document.body.append(box.el); getSelection().removeAllRanges();
    }
    const top = Math.min(y0, e.clientY), bot = Math.max(y0, e.clientY), left = Math.min(box.x, e.clientX);
    Object.assign(box.el.style, { left: left + "px", top: top + "px", width: Math.abs(e.clientX - box.x) + "px", height: bot - top + "px" });
    const hit = visRows().filter((r) => { const b = r.getBoundingClientRect(); return b.bottom > top && b.top < bot; });
    if (!hit.length) clearPick(true);
    else if (e.clientY < y0) setPick(hit.at(-1).dataset.id, hit[0].dataset.id, { focus: false });
    else setPick(hit[0].dataset.id, hit.at(-1).dataset.id, { focus: false });
    edgeScroll(e.clientY);
  };
  const onUp = () => {
    if (sweep) { const s = sweep; sweep = null; root.classList.remove("sweeping"); if (s.on && pick) { armTrap(); opts.onPick?.(); } }
    if (box) { const b = box; box = null; b.el?.remove(); b.lane.classList.remove("boxing"); if (b.on) { if (pick) { armTrap(); opts.onPick?.(); } } else b.click?.(); }
  };
  const onCancel = () => { sweep = null; root.classList.remove("sweeping"); if (box) { box.el?.remove(); box.lane.classList.remove("boxing"); box = null; } };
  document.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pointercancel", onCancel); root.addEventListener("dragstart", onCancel);

  // keys while blocks are picked
  trap.addEventListener("keydown", (e) => {
    if (e.isComposing || overlayOpen()) return;
    if (undoKey(e)) return;
    const r = pickRange(); if (!r) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, stop = () => { e.preventDefault(); e.stopPropagation(); }, [i, j] = r;
    if (k === "Escape" && !e.shiftKey) { stop(); return clearPick(); }
    if (mod && !e.altKey && ["c", "x", "v"].includes(k.toLowerCase())) return;   // they come as copy, cut and paste
    if (mod && !e.shiftKey && !e.altKey && k.toLowerCase() === "a") { stop(); return pickAll(); }
    if (mod && !e.shiftKey && !e.altKey && k.toLowerCase() === "d") { stop(); return dupRange(); }
    if (mod && e.shiftKey && (k === "ArrowUp" || k === "ArrowDown")) { stop(); return moveRange(k === "ArrowUp" ? -1 : 1); }
    if (mod || e.altKey) return;
    if (k === "Tab") { stop(); return indentRange(e.shiftKey ? -1 : 1); }
    if (k === "Backspace" || k === "Delete") { stop(); return deleteRange(); }
    if (k === "ArrowUp" || k === "ArrowDown") {
      stop(); const up = k === "ArrowUp";
      if (e.shiftKey) {   // the far end moves: past what's picked when growing, back toward where it started when shrinking
        const a = idx(pick.a), h = idx(pick.z), n = up ? prevVisible(h > a ? h : i) : nextVisible(h < a ? h : j);
        if (n >= 0) setPick(pick.a, B[n].id); return;
      }
      const n = up ? prevVisible(i) : nextVisible(j); return setPick(B[n >= 0 ? n : up ? i : idx(pick.z)].id);
    }
    if (k === "Enter") { stop(); const h = B[idx(pick.z)] || B[j]; clearPick(true); return place(h.id, "end"); }
    if (k.length === 1) { stop(); return typeOver(k); }
  });
  trap.addEventListener("beforeinput", (e) => { e.preventDefault(); if (pick && e.data && /^insert(Text|ReplacementText|CompositionText)?$/.test(e.inputType)) typeOver(e.data); });   // dictation and the like
  trap.addEventListener("copy", (e) => { const r = pickRange(); if (!r || !e.clipboardData) return; e.preventDefault(); putClip(e.clipboardData, B.slice(r[0], r[1] + 1)); });
  trap.addEventListener("cut", (e) => { const r = pickRange(); if (!r || !e.clipboardData) return; e.preventDefault(); putClip(e.clipboardData, B.slice(r[0], r[1] + 1)); deleteRange(); });
  trap.addEventListener("paste", (e) => {
    if (!pickRange()) return; e.preventDefault();
    const got = blocksFrom(e.clipboardData) || textToBlocks(e.clipboardData?.getData("text/plain") || "");
    if (got.length) replaceRange(got);
  });
  function putClip(dt, list) {
    const json = JSON.stringify(list.map((b) => clone(b)));
    dt.setData("text/plain", blocksToText(list, opts.pageTitle));
    dt.setData("text/html", `<div data-bonsai-blocks="${encodeURIComponent(json)}">${blocksToHtml(list)}</div>`);
    try { dt.setData(BLOCKS_MIME, json); } catch {}
  }
  // what's picked, changed
  const rebase = (list, base) => { const min = Math.min(...list.map((b) => b.indent || 0)); return list.map((b) => ({ ...b, id: uid(), indent: Math.min(MAX_INDENT, base + (b.indent || 0) - min) })); };
  function deleteRange() {
    const r = pickRange(); if (!r) return; const [i, j] = r, p = prevVisible(i);
    pick = null; B.splice(i, j - i + 1); if (!B.length) B.push(newBlock());
    changed(true); render(p >= 0 ? { id: B[p].id, at: "end" } : { id: B[0].id, at: 0 }); opts.onPick?.();
  }
  function replaceRange(list) {
    const [i, j] = pickRange(), made = rebase(list, B[i].indent);
    pick = null; B.splice(i, j - i + 1, ...made); changed(true); render({ id: made.at(-1).id, at: "end" }); opts.onPick?.();
  }
  const typeOver = (ch) => replaceRange([newBlock("text", { html: esc(ch) })]);
  function indentRange(d) {
    const [i, j] = pickRange(), pv = prevVisible(i), max = pv >= 0 ? B[pv].indent + 1 : 0, list = B.slice(i, j + 1);
    if (d > 0 && (B[i].indent + 1 > max || list.some((b) => b.indent >= MAX_INDENT))) return;
    if (d < 0 && !list.some((b) => b.indent > 0)) return;
    for (const b of list) b.indent = Math.max(0, b.indent + d);
    changed(true); render(); armTrap();
  }
  function moveRange(dir) {
    const r = pickRange(); if (!r) return; const [i, j] = r, group = B.slice(i, j + 1);
    if (dir < 0) { const p = prevVisible(i); if (p < 0) return; let s = p; while (s > 0 && B[s].indent > group[0].indent) s--; B.splice(i, group.length); B.splice(s, 0, ...group); }
    else { const end = j + 1; if (end >= B.length) return; const after = kidsEnd(end); B.splice(i, group.length); B.splice(after - group.length, 0, ...group); }
    changed(true); render(); armTrap();
  }
  function dupRange() {
    const r = pickRange(); if (!r) return; const [i, j] = r;
    const copy = B.slice(i, j + 1).filter((x) => x.type !== "page").map((x) => ({ ...clone(x), id: uid() })); if (!copy.length) return;
    B.splice(j + 1, 0, ...copy); changed(true); pick = { a: copy[0].id, z: copy.at(-1).id }; render(); armTrap(); opts.onPick?.();
  }
  function eachPicked(fn) { const r = pickRange(); if (!r) return; B.slice(r[0], r[1] + 1).forEach(fn); changed(true); render(); armTrap(); }
  function retype(b, type) {
    if (!TEXTY.has(b.type) || b.type === type) return;
    if (b.type === "code") b.html = escapeCode(b.html).replace(/\n/g, "<br>");
    if (type === "code") b.html = plain(b.html);
    b.type = type; if (type === "todo") b.checked = !!b.checked; else delete b.checked;
    if (type === "toggle") b.open = true;
  }
  // words marked as actions, one per picked block (or, when every one is marked already, unmarked)
  function markPicked() {
    const r = pickRange(); if (!r) return null;
    const list = B.slice(r[0], r[1] + 1).filter((b) => TEXTY.has(b.type) && b.type !== "code" && plain(b.html).trim()); if (!list.length) return null;
    const whole = (b) => /^<mark data-action="[^"]+">[\s\S]*<\/mark>$/.test(b.html) && (b.html.match(/<mark /g) || []).length === 1;
    const off = list.every(whole), ids = [];
    for (const b of list) {
      const d = document.createElement("div"); d.innerHTML = b.html; d.querySelectorAll("mark[data-action]").forEach((m) => m.replaceWith(...m.childNodes));
      if (off) b.html = cleanHtml(d.innerHTML); else { const id = actionId(); ids.push(id); b.html = cleanHtml(`<mark data-action="${id}">${d.innerHTML}</mark>`); }
    }
    changed(true); render(); armTrap();
    return off ? "" : ids[0];
  }
  // a small mark in the margin beside blocks something refers to (a discussion): blockId → { title }
  function drawMarks() {
    root.querySelectorAll(".tmark").forEach((m) => m.remove());
    for (const [id, m] of marks) {
      const row = rowOf(id); if (!row || row.hidden) continue;
      row.append(el("button", { class: "tmark", type: "button", tabIndex: -1, title: m.title || "Discussion", "aria-label": m.title || "Discussion", onpointerdown: (e) => e.preventDefault(), onclick: () => opts.onMark?.(id) }, opts.markIcon?.()));
    }
  }

  render();
  return {
    el: root,
    get blocks() { return B.map((b) => ({ ...b })); },
    focus(at = "start") { const b = at === "end" ? B.at(-1) : B[0]; if (b) place(b.id, at === "end" ? "end" : 0); },
    refreshPages() { root.querySelectorAll(".t-page").forEach((r) => { const b = B[idx(r.dataset.id)]; const s = r.querySelector(".plink span:last-child"); if (b && s) s.textContent = opts.pageTitle?.(b.pageId) || "Untitled"; }); },
    flush() { save(); },
    undo, redo,
    // words in one block marked as an action (or, inside one already, unmarked); returns the action's id, "" when unmarked, null when it can't
    markAction(range, id = actionId()) {
      const r = range || (getSelection().rangeCount ? getSelection().getRangeAt(0) : null); if (!r) return null;
      const host = (n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(".tx, .cell, .cap");
      const tx = host(r.startContainer); if (!tx || tx !== host(r.endContainer) || !root.contains(tx) || tx.closest(".t-code")) return null;
      const b = B[idx(tx.closest(".blk").dataset.id)]; if (!b) return null;
      const inMark = (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement).closest("mark[data-action]");
      if (inMark && tx.contains(inMark)) { inMark.replaceWith(...inMark.childNodes); id = ""; }
      else {
        if (r.collapsed) return null;
        const m = document.createElement("mark"); m.dataset.action = id;
        m.append(r.extractContents()); m.querySelectorAll("mark[data-action]").forEach((x) => x.replaceWith(...x.childNodes));
        r.insertNode(m); const after = document.createRange(); after.setStartAfter(m); after.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(after);
      }
      if (tx.classList.contains("cap")) b.caption = cleanHtml(cleanInline(tx.innerHTML)); else sync(b, tx);
      if (b.type !== "code" && !tx.classList.contains("cell") && !tx.classList.contains("cap")) b.html = cleanHtml(b.html);
      changed(true); const at = caretOffset(tx); if (!tx.classList.contains("cap")) H.cur.focus = { id: b.id, at: at < 0 ? "end" : at, ...(tx.classList.contains("cell") ? { cell: [+tx.dataset.r, +tx.dataset.c] } : {}) };
      return id;
    },
    picked, pickAll, markPicked, clearPick: () => clearPick(),
    get pickedIds() { return pickedIds(); },
    // what's selected: the picked blocks, or the words, with the blocks they're in
    selection() {
      const r = pickRange();
      if (r) { const list = B.slice(r[0], r[1] + 1); return { ids: list.map((b) => b.id), text: blocksToText(list, opts.pageTitle) }; }
      const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null;
      const rg = s.getRangeAt(0), rowAt = (n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(".blk");
      const a = rowAt(rg.startContainer), z = rowAt(rg.endContainer); if (!a || !root.contains(a)) return null;
      const i = idx(a.dataset.id), j = z && root.contains(z) ? idx(z.dataset.id) : i;
      return { ids: B.slice(i, j + 1).map((b) => b.id), text: s.toString() };
    },
    // blocks put in after the last of the blocks named (and what's inside it), or at the end; one undo step
    insertBlocks(ids, list) {
      if (!list?.length) return [];
      const at = Math.max(-1, ...(ids || []).map(idx)), base = at >= 0 ? B[at].indent : 0, made = rebase(list, base);
      B.splice(at >= 0 ? kidsEnd(at) : B.length, 0, ...made); changed(true); render({ id: made.at(-1).id, at: "end" });
      rowOf(made[0].id)?.scrollIntoView({ block: "nearest" });
      return made.map((b) => b.id);
    },
    setMarks(m) { marks = new Map(m || []); drawMarks(); },
    destroy() {
      closeSlash(); bar.remove(); trap.remove(); box?.el?.remove(); document.removeEventListener("selectionchange", onSel); document.removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onCancel); root.remove();
    },
  };
}

// ---------- blocks on the clipboard ----------
// Picked blocks are copied as Markdown-ish text, as HTML for other apps, and as the blocks themselves (in a type of
// their own, and inside the HTML too, which survives more clipboards), so a paste into a page brings the blocks back.
export const BLOCKS_MIME = "application/x-bonsai-blocks";
const KNOWN = new Set([...TYPES.map((t) => t[0]), "image"]);
const escHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
export function blocksFrom(dt) {
  let raw = ""; try { raw = dt?.getData?.(BLOCKS_MIME) || ""; } catch {}
  if (!raw) { const m = (dt?.getData?.("text/html") || "").match(/data-bonsai-blocks="([^"]+)"/); if (m) try { raw = decodeURIComponent(m[1]); } catch {} }
  if (!raw) return null;
  let list; try { list = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(list)) return null;
  const out = list.filter((b) => b && KNOWN.has(b.type)).slice(0, 2000).map((b) => {
    const n = newBlock(b.type, { indent: Math.max(0, Math.min(MAX_INDENT, +b.indent || 0)), html: b.type === "code" ? String(b.html || "") : cleanHtml(b.html) });
    if (b.type === "todo") n.checked = !!b.checked;
    if (b.type === "toggle") n.open = !!b.open;
    if (typeof b.color === "string" && COLORS.includes(b.color.replace(/-bg$/, ""))) n.color = b.color;
    if (b.type === "callout" && typeof b.icon === "string") n.icon = b.icon.slice(0, 4);
    if (b.type === "page") n.pageId = String(b.pageId || "");
    if (b.type === "table") { n.rows = (Array.isArray(b.rows) ? b.rows : [[""]]).map((r) => (Array.isArray(r) ? r : []).map((c) => cleanHtml(c))); n.head = !!b.head; }
    if (b.type === "image") Object.assign(n, { fileId: String(b.fileId || ""), w: +b.w || 0, h: +b.h || 0, width: Math.max(15, Math.min(100, +b.width || 100)), caption: cleanHtml(b.caption) });
    return n;
  });
  if (out.some((b) => b.type === "table")) for (const b of out) if (b.type === "table") { const w = Math.max(1, ...b.rows.map((r) => r.length)); b.rows = (b.rows.length ? b.rows : [[""]]).map((r) => [...r, ...Array(w - r.length).fill("")]); }
  return out.length ? out : null;
}
function blocksToHtml(list) {
  return list.map((b) => {
    const h = b.html || "";
    if (/^h[123]$/.test(b.type)) return `<${b.type}>${h}</${b.type}>`;
    if (b.type === "bullet" || b.type === "toggle") return `<ul><li>${h}</li></ul>`;
    if (b.type === "number") return `<ol><li>${h}</li></ol>`;
    if (b.type === "todo") return `<p>${b.checked ? "☑" : "☐"} ${h}</p>`;
    if (b.type === "quote") return `<blockquote>${h}</blockquote>`;
    if (b.type === "code") return `<pre>${escHtml(h)}</pre>`;
    if (b.type === "divider") return "<hr>";
    if (b.type === "table") return `<table>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
    if (b.type === "image") return b.caption ? `<p>${b.caption}</p>` : "";
    if (b.type === "page") return "";
    return `<p>${h}</p>`;
  }).join("");
}

// ---------- tables in and out ----------
// "| a | b |" → ["a", "b"] (a row of a Markdown table), else null; "\|" is a bar inside a cell
export function tableRow(line) {
  const t = String(line || "").trim(); if (!/^\|.*\|$/.test(t) || t.length < 3) return null;
  return t.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}
const isRule = (cells) => cells && cells.length && cells.every((c) => /^:?-{2,}:?$/.test(c));
// what's on the clipboard as a table: an HTML table (a web page, a spreadsheet) or tab-separated lines
export function gridFrom(data) {
  const html = data?.getData?.("text/html") || "";
  if (/<table[\s>]/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, "text/html"), t = doc.querySelector("table");
    const rows = [...t.rows].map((tr) => [...tr.cells].map((c) => cleanHtml(c.innerHTML).replace(/^(<br>)+|(<br>)+$/g, ""))).filter((r) => r.length);
    if (rows.length && (rows.length > 1 || rows[0].length > 1)) return { rows, head: !!t.querySelector("thead, tr:first-child > th") };
  }
  const text = (data?.getData?.("text/plain") || "").replace(/\r/g, "").replace(/\n+$/, "");
  const lines = text.split("\n");
  if (lines.length >= 1 && text.includes("\t") && lines.every((l) => l.includes("\t")) && (lines.length > 1 || lines[0].split("\t").length > 2))
    return { rows: lines.map((l) => l.split("\t").map((c) => esc(c.trim()))), head: false };
  return null;
}

// ---------- plain text in and out ----------
// Reads a Markdown-ish outline (as older pages, pastes and the demo are written) into blocks.
export function textToBlocks(text) {
  const out = [];
  let code = null, table = null;
  for (const raw of String(text || "").replace(/\r/g, "").replace(/\t/g, "  ").split("\n")) {
    const cells = code ? null : tableRow(raw);
    if (table && !cells) { out.push(table); table = null; }
    if (cells) {   // a Markdown table: a rule under the first row makes it a header
      if (!table) { table = newBlock("table", { indent: Math.min(MAX_INDENT, Math.floor(raw.match(/^ */)[0].length / 2)), rows: [], head: false }); }
      if (isRule(cells)) { if (table.rows.length === 1) table.head = true; continue; }
      table.rows.push(cells.map(inlineMd)); continue;
    }
    if (code) { if (raw.trim().startsWith("```")) { out.push(code); code = null; } else code.html += (code.html ? "\n" : "") + raw; continue; }
    const lead = raw.match(/^ */)[0].length, indent = Math.min(MAX_INDENT, Math.floor(lead / 2)), t = raw.trim();
    if (!t) continue;
    if (t.startsWith("```")) { code = newBlock("code", { indent }); continue; }
    if (/^(---+|\*\*\*+)$/.test(t)) { out.push(newBlock("divider", { indent })); continue; }
    let m, type = "text", body = t, extra = {};
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { type = "h" + m[1].length; body = m[2]; }
    else if ((m = t.match(/^[-*+•]\s+\[( |x|X)?\]\s*(.*)$/)) || (m = t.match(/^\[( |x|X)?\]\s+(.*)$/))) { type = "todo"; body = m[2]; extra.checked = !!(m[1] && m[1].trim()); }
    else if ((m = t.match(/^[-*+•]\s+(.*)$/))) { type = "bullet"; body = m[1]; }
    else if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { type = "number"; body = m[1]; }
    else if ((m = t.match(/^>\s?(.*)$/))) { type = "quote"; body = m[1]; }
    out.push(newBlock(type, { indent, html: inlineMd(body), ...extra }));
  }
  if (code) out.push(code);
  if (table) out.push(table);
  for (const b of out) if (b.type === "table") { const w = Math.max(1, ...b.rows.map((r) => r.length)); b.rows = b.rows.map((r) => [...r, ...Array(w - r.length).fill("")]); }
  return out;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inlineMd(s) {
  return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
// Blocks back to an indented outline, for Claude to read when growing a page.
export function blocksToText(blocks, pageTitle = () => "") {
  const lines = []; let n = 0;
  const md = (html) => { const d = document.createElement("div"); d.innerHTML = html || ""; d.querySelectorAll("br").forEach((b) => b.replaceWith("\n")); d.querySelectorAll("b").forEach((b) => b.replaceWith(`**${b.textContent}**`)); d.querySelectorAll("code").forEach((c) => c.replaceWith("`" + c.textContent + "`")); d.querySelectorAll("time[datetime]").forEach((t) => t.replaceWith(longDate(t.getAttribute("datetime")))); return d.textContent; };
  for (const b of blocks || []) {
    const pad = "  ".repeat(b.indent || 0);
    n = b.type === "number" ? n + 1 : 0;
    const t = b.type === "code" ? b.html : b.type === "table" ? "" : md(b.html);
    const pre = { h1: "# ", h2: "## ", h3: "### ", bullet: "- ", number: `${n}. `, todo: b.checked ? "- [x] " : "- [ ] ", toggle: "- ", quote: "> ", callout: (b.icon || "💡") + " " }[b.type] || "";
    if (b.type === "divider") lines.push(pad + "---");
    else if (b.type === "page") lines.push(pad + `(page: ${pageTitle(b.pageId) || "Untitled"})`);
    else if (b.type === "code") lines.push(pad + "```", ...t.split("\n").map((l) => pad + l), pad + "```");
    else if (b.type === "image") lines.push(pad + `(picture${b.caption ? ": " + md(b.caption) : ""})`);
    else if (b.type === "table") (b.rows || []).forEach((row, r) => {
      lines.push(pad + "| " + row.map((h) => md(h).replace(/\n/g, " ").replace(/\|/g, "\\|") || " ").join(" | ") + " |");
      if (r === 0 && b.head) lines.push(pad + "|" + row.map(() => " --- ").join("|") + "|");
    });
    else lines.push(...t.split("\n").map((l, k) => pad + (k ? "  " : pre) + l));
  }
  return lines.join("\n");
}
