// A Notion-style block editor for notes pages.
// A page is a flat list of blocks; nesting is each block's indent, so Tab and Shift+Tab move a block in and out,
// and a block's children are the blocks after it with a deeper indent (they move, hide and delete with it).
// block {id, type, html, indent, checked, open, color, pageId, icon}
//   type: text h1 h2 h3 bullet number todo toggle quote callout code divider page
import { el, put, menu, dialog } from "./dom.js";

export const TYPES = [
  ["text", "Text", "Aa"], ["h1", "Heading 1", "H1"], ["h2", "Heading 2", "H2"], ["h3", "Heading 3", "H3"],
  ["bullet", "Bulleted list", "•"], ["number", "Numbered list", "1."], ["todo", "To-do list", "☐"], ["toggle", "Toggle list", "▸"],
  ["quote", "Quote", "❝"], ["callout", "Callout", "💡"], ["code", "Code", "</>"], ["divider", "Divider", "—"], ["page", "Page", "▤"],
];
export const COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const TEXTY = new Set(["text", "h1", "h2", "h3", "bullet", "number", "todo", "toggle", "quote", "callout", "code"]);
const LISTS = new Set(["bullet", "number", "todo", "toggle"]);
const MAX_INDENT = 8;
const uid = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const newBlock = (type = "text", extra = {}) => ({ id: uid(), type, html: "", indent: 0, ...extra });

// Only simple inline formatting survives: bold, italic, underline, strike, code, links, line breaks.
const KEEP = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", S: "s", STRIKE: "s", DEL: "s", CODE: "code", A: "a", BR: "br" };
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

// ---------- the editor ----------
// opts: { host, blocks, onChange(blocks), pageTitle(id), openPage(id), newSubpage() -> id, readOnly }
export function createEditor(opts) {
  let B = (opts.blocks || []).map((b) => ({ ...b }));
  if (!B.length) B = [newBlock()];
  const root = el("div", { class: "blocks", role: "textbox", "aria-multiline": "true", "aria-label": "Page" });
  opts.host.append(root);
  let slash = null, drag = null;
  const changed = () => opts.onChange?.(B.map((b) => ({ ...b })));   // the page saves shortly after typing stops
  const idx = (id) => B.findIndex((b) => b.id === id);
  const kidsEnd = (i) => { let j = i + 1; while (j < B.length && B[j].indent > B[i].indent) j++; return j; };   // end of a block's group
  const rowOf = (id) => root.querySelector(`.blk[data-id="${id}"]`);
  const txOf = (id) => rowOf(id)?.querySelector(".tx");

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
    if (focus) place(focus.id, focus.at);
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
    if (b.type === "divider") { row.tabIndex = 0; row.append(el("hr")); row.addEventListener("keydown", (e) => solidKey(e, b)); return row; }
    if (b.type === "page") {
      row.tabIndex = 0;
      row.append(el("button", { class: "plink", type: "button", onclick: () => opts.openPage?.(b.pageId) }, el("span", { class: "pico", text: "▤" }), el("span", { text: opts.pageTitle?.(b.pageId) || "Untitled" })));
      row.addEventListener("keydown", (e) => solidKey(e, b));
      return row;
    }
    const tx = el("div", { class: "tx", contentEditable: opts.readOnly ? "false" : b.type === "code" ? "plaintext-only" : "true", spellcheck: b.type !== "code", html: b.type === "code" ? escapeCode(b.html) : b.html,
      dataset: { ph: placeholder(b, i) } });
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
  function sync(b, tx) { b.html = b.type === "code" ? tx.textContent : cleanInline(tx.innerHTML); }
  const cleanInline = (h) => (h === "<br>" ? "" : h);
  function place(id, at = "end") {
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
    const t = tx.textContent;
    if (b.type !== "code" && t === "---") { b.type = "divider"; b.html = ""; const n = insertAfter(idx(b.id), newBlock("text", { indent: b.indent })); changed(); return render({ id: n.id }); }
    if (b.type !== "code" && t === "```") { b.type = "code"; b.html = ""; changed(); return render({ id: b.id }); }
    if (e.inputType === "insertText" && e.data === "/") { const at = caretOffset(tx); const prev = t[at - 2]; if (at === 1 || prev === " " || prev === " ") openSlash(b, tx, at - 1); }
    else if (slash) updateSlash();
    tx.parentElement.classList.toggle("empty", !t);
    changed();
  }
  function onPaste(e, b, tx) {
    const text = e.clipboardData?.getData("text/plain"); if (text == null) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.length === 1 || b.type === "code") { document.execCommand("insertText", false, text); return; }
    // several lines: the first joins this block, the rest become blocks of their own, read like a Markdown outline
    document.execCommand("insertText", false, lines[0]); sync(b, tx);
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
      if (!TEXTY.has(prev.type)) { B.splice(p, 1); changed(true); return render({ id: b.id, at: 0 }); }   // a divider or page link above goes
      const join = plain(prev.html).length;
      prev.html = prev.type === "code" ? prev.html + tx.textContent : cleanHtml(prev.html + b.html);
      B.splice(i, 1); changed(true); return render({ id: prev.id, at: join });
    }
    if (k === "Delete" && !mod) {
      const at = caretOffset(tx); if (at !== tx.textContent.length || !getSelection().isCollapsed) return;
      const n = B[i + 1]; if (!n) return; e.preventDefault();
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
    const i = idx(b.id), end = kidsEnd(i), copy = B.slice(i, end).map((x) => ({ ...x, id: uid() })).filter((x) => x.type !== "page");
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

  // ---------- the / menu ----------
  function openSlash(b, tx, start) {
    closeSlash();
    const box = el("div", { class: "slash", role: "listbox", "aria-label": "Blocks" });
    document.body.append(box);
    slash = { b, tx, start, box, pick: 0, list: [] };
    updateSlash();
  }
  function updateSlash() {
    const s = slash; if (!s) return;
    const at = caretOffset(s.tx), t = s.tx.textContent;
    if (at <= s.start || t[s.start] !== "/") return closeSlash();
    const q = t.slice(s.start + 1, at).toLowerCase();
    if (q.length > 18 || /\s{2}/.test(q)) return closeSlash();
    s.list = TYPES.filter(([type, name]) => !q || name.toLowerCase().includes(q) || type.startsWith(q) || name.toLowerCase().split(" ").some((w) => w.startsWith(q)));
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
    // take the "/query" out, then turn this block into the type, or add one below if this block has words in it
    const at = caretOffset(s.tx), sel = getSelection(), r = document.createRange();
    setCaret(s.tx, s.start); r.setStart(sel.anchorNode, sel.anchorOffset); setCaret(s.tx, at); r.setEnd(sel.anchorNode, sel.anchorOffset); r.deleteContents();
    sync(s.b, s.tx);
    if (!s.tx.textContent.trim()) { s.b.html = ""; return turnInto(s.b, type); }
    const i = idx(s.b.id), n = newBlock(type === "page" ? "text" : type, { indent: s.b.indent });
    insertAfter(i, n);
    if (type === "page") return makeSubpage(i + 1, n);
    if (type === "divider") return turnInto(n, "divider");
    if (type === "toggle") n.open = true;
    changed(true); render({ id: n.id });
  }
  function closeSlash() { slash?.box.remove(); slash = null; }

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
        e.preventDefault(); const tx = getSelection().anchorNode?.parentElement?.closest(".tx"); const b = tx && B[idx(tx.closest(".blk").dataset.id)]; if (!b) return;
        if (cmd === "code") inlineCode(b, tx); else if (cmd === "link") linkIt(b, tx); else { document.execCommand(cmd); sync(b, tx); changed(); }
      } })));
  document.body.append(bar);
  const onSel = () => {
    const s = getSelection(), tx = s.anchorNode && s.anchorNode.parentElement?.closest?.(".tx");
    if (!s.rangeCount || s.isCollapsed || !tx || !root.contains(tx) || tx.closest(".t-code")) { bar.hidden = true; return; }
    const r = s.getRangeAt(0).getBoundingClientRect(); bar.hidden = false;
    bar.style.left = Math.max(8, Math.min(innerWidth - bar.offsetWidth - 8, r.left + r.width / 2 - bar.offsetWidth / 2)) + "px";
    bar.style.top = Math.max(8, r.top - bar.offsetHeight - 8) + "px";
  };
  document.addEventListener("selectionchange", onSel);

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
    flush() { opts.onChange?.(B.map((b) => ({ ...b }))); },
    destroy() { closeSlash(); bar.remove(); document.removeEventListener("selectionchange", onSel); root.remove(); },
  };
}

// ---------- plain text in and out ----------
// Reads a Markdown-ish outline (as older pages, pastes and the demo are written) into blocks.
export function textToBlocks(text) {
  const out = [];
  let code = null;
  for (const raw of String(text || "").replace(/\r/g, "").replace(/\t/g, "  ").split("\n")) {
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
  const md = (html) => { const d = document.createElement("div"); d.innerHTML = html || ""; d.querySelectorAll("br").forEach((b) => b.replaceWith("\n")); d.querySelectorAll("b").forEach((b) => b.replaceWith(`**${b.textContent}**`)); d.querySelectorAll("code").forEach((c) => c.replaceWith("`" + c.textContent + "`")); return d.textContent; };
  for (const b of blocks || []) {
    const pad = "  ".repeat(b.indent || 0);
    n = b.type === "number" ? n + 1 : 0;
    const t = b.type === "code" ? b.html : md(b.html);
    const pre = { h1: "# ", h2: "## ", h3: "### ", bullet: "- ", number: `${n}. `, todo: b.checked ? "- [x] " : "- [ ] ", toggle: "- ", quote: "> ", callout: (b.icon || "💡") + " " }[b.type] || "";
    if (b.type === "divider") lines.push(pad + "---");
    else if (b.type === "page") lines.push(pad + `(page: ${pageTitle(b.pageId) || "Untitled"})`);
    else if (b.type === "code") lines.push(pad + "```", ...t.split("\n").map((l) => pad + l), pad + "```");
    else lines.push(...t.split("\n").map((l, k) => pad + (k ? "  " : pre) + l));
  }
  return lines.join("\n");
}
