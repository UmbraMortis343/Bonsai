// A Notion-style block editor for notes pages.
// A page is a flat list of blocks; nesting is each block's indent, so Tab and Shift+Tab move a block in and out,
// and a block's children are the blocks after it with a deeper indent (they move, hide and delete with it).
// block {id, type, html, indent, checked, open, color, pageId, icon}
//   type: text h1 h2 h3 bullet number todo toggle quote callout code divider page table
//   a table keeps its cells as rows: [[html, …], …] and head (the first row is a header)
import { el, put, menu, dialog } from "./dom.js";
import { datePicker, isoDay, relDate, longDate } from "./datepick.js";

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

// Only simple inline formatting survives: bold, italic, underline, strike, code, links, line breaks.
const KEEP = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", S: "s", STRIKE: "s", DEL: "s", CODE: "code", A: "a", BR: "br", TIME: "time" };
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
  if (at === "end" || at == null) { r.selectNodeContents(node); r.collapse(false); }
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

// ---------- undo ----------
// The editor keeps its own history: each step is the whole list of blocks plus where the caret was. The browser's
// own undo can't be used, since every structural change draws the blocks afresh and its history points at gone nodes.
// Histories outlive the editor (keyed by page), so a page drawn again, or opened again, can still be undone.
const HIST = new Map(), HIST_MAX = 200, BURST_MS = 1000;
const clone = (x) => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

// ---------- the editor ----------
// opts: { host, blocks, onChange(blocks), pageTitle(id), openPage(id), newSubpage() -> id, readOnly, key (for the history) }
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
    closeSlash();
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
    tx.addEventListener("focus", () => { root.querySelectorAll(".blk.focus").forEach((x) => x.classList.remove("focus")); row.classList.add("focus"); });
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
    const grid = b.type === "code" ? null : gridFrom(e.clipboardData);
    if (grid) {   // a table from a web page or a spreadsheet: a table block (in place of an empty line)
      e.preventDefault();
      const n = tableBlock(grid.rows, grid.head, { indent: b.indent }), i = idx(b.id);
      if (!plain(b.html).trim() && TEXTY.has(b.type)) B.splice(i, 1, n); else B.splice(i + 1, 0, n);
      changed(true); return render({ id: n.id, cell: [grid.rows.length - 1, grid.rows.at(-1).length - 1], at: "end" });
    }
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
      cell.addEventListener("focus", () => { tcur.set(b.id, [r, c]); root.querySelectorAll(".blk.focus").forEach((x) => x.classList.remove("focus")); cell.closest(".blk").classList.add("focus"); });
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
    drag = { id, moved: false, line: null, to: null };
    const move = (ev) => {
      if (!drag.moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      if (!drag.moved) { drag.moved = true; root.classList.add("dragging"); const i = idx(id); for (let j = i; j < kidsEnd(i); j++) rowOf(B[j].id)?.classList.add("lift"); drag.line = el("div", { class: "dropline" }); root.append(drag.line); }
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
      const i = idx(id), group = B.splice(i, kidsEnd(i) - i);
      let at = d.to ? idx(d.to) : B.length; if (at < 0) at = B.length;
      const above = B[at - 1], base = above ? (above.type === "toggle" && above.open ? above.indent + 1 : Math.min(above.indent + (LISTS.has(above.type) ? 0 : 0), MAX_INDENT)) : 0;
      const shift = (above ? Math.min(group[0].indent, base) : 0) - group[0].indent;
      for (const g of group) g.indent = Math.max(0, g.indent + shift);
      B.splice(at, 0, ...group); changed(true); render({ id, at: "end" });
    };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  }
  function blockMenu(id, anchor) {
    const b = B[idx(id)]; if (!b) return;
    menu(anchor, [
      ...(b.type === "table" ? tableItems(b) : []),
      TEXTY.has(b.type) && { label: "Turn into", run: () => menu(anchor, TYPES.filter(([t]) => t !== b.type && t !== "divider").map(([t, name]) => ({ label: name, run: () => turnInto(b, t) }))) },
      { label: "Colour", run: () => menu(anchor, [{ label: (b.color ? "" : "✓ ") + "Default", run: () => { delete b.color; changed(true); render(); } },
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

  // clicking a date tag picks another day
  root.addEventListener("click", (e) => {
    const t = e.target.closest?.("time[datetime]"), tx = t?.closest(".tx"); if (!t || !tx || opts.readOnly) return;
    const b = B[idx(tx.closest(".blk").dataset.id)]; if (!b) return;
    datePicker(t, t.getAttribute("datetime"), (iso) => { if (iso) { t.setAttribute("datetime", iso); t.textContent = relDate(iso); } else t.remove(); sync(b, tx); b.html = cleanHtml(b.html); changed(); });
  });
  // clicking below the last block puts the caret at the end, or starts a new block after a heading, list or solid block
  root.addEventListener("pointerdown", (e) => {
    if (e.target !== root) return;
    const last = B.at(-1), lastRow = rowOf(last.id);
    if (lastRow && e.clientY > lastRow.getBoundingClientRect().bottom) {
      e.preventDefault();
      if (last.type === "text" && !plain(last.html)) return place(last.id);
      const n = B.push(newBlock()) && B.at(-1); changed(true); render({ id: n.id });
    }
  });

  render();
  return {
    el: root,
    get blocks() { return B.map((b) => ({ ...b })); },
    focus(at = "start") { const b = at === "end" ? B.at(-1) : B[0]; if (b) place(b.id, at === "end" ? "end" : 0); },
    refreshPages() { root.querySelectorAll(".t-page").forEach((r) => { const b = B[idx(r.dataset.id)]; const s = r.querySelector(".plink span:last-child"); if (b && s) s.textContent = opts.pageTitle?.(b.pageId) || "Untitled"; }); },
    flush() { save(); },
    undo, redo,
    destroy() { closeSlash(); bar.remove(); document.removeEventListener("selectionchange", onSel); root.remove(); },
  };
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
    else if (b.type === "table") (b.rows || []).forEach((row, r) => {
      lines.push(pad + "| " + row.map((h) => md(h).replace(/\n/g, " ").replace(/\|/g, "\\|") || " ").join(" | ") + " |");
      if (r === 0 && b.head) lines.push(pad + "|" + row.map(() => " --- ").join("|") + "|");
    });
    else lines.push(...t.split("\n").map((l, k) => pad + (k ? "  " : pre) + l));
  }
  return lines.join("\n");
}
