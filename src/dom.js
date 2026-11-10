// Small DOM helpers: element builder, toast, dialogs and menus.
export const $ = (s, r = document) => r.querySelector(s);
export function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat(3)) if (k != null && k !== false) e.append(k);
  return e;
}

// Replaces a node's children, skipping empty values.
export const put = (node, ...kids) => node.replaceChildren(...kids.flat(3).filter((k) => k != null && k !== false && k !== 0 && k !== ""));

let toastTimer;
export function toast(msg, act) {
  const t = $("#toast");
  put(t, el("span", { text: msg }), act && el("button", { class: "link", text: act.label, onclick: () => { t.hidden = true; act.run(); } }));
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), act ? 7000 : 2600);
}

const stack = [];
export const overlayOpen = () => stack.length > 0;
export function closeTop() { const o = stack.pop(); if (o) o.close(); return !!o; }
export function closeAll() { while (closeTop()); }
function open(node, onClose) {
  const entry = { close: () => { node.remove(); onClose(); } };
  stack.push(entry); $("#overlay").append(node);
  return () => { const i = stack.indexOf(entry); if (i >= 0) { stack.splice(i, 1); entry.close(); } };
}

// fields: [{name, label, value, type: text | textarea | select | color, options, required, max}]
export function dialog({ title, fields = [], ok = "Save", danger = false, body = null, cancel = "Cancel" }) {
  return new Promise((resolve) => {
    let result = null;
    const inputs = {};
    const form = el("form", { class: "dialog", role: "dialog", "aria-label": title }, el("h2", { text: title }));
    for (const f of fields) {
      const id = "f-" + f.name; let input, field;
      if (f.type === "select") input = el("select", { id }, f.options.map(([v, t]) => el("option", { value: v, text: t, selected: v === f.value })));
      else if (f.type === "textarea") input = el("textarea", { id, value: f.value || "", rows: 5, placeholder: f.placeholder });
      else if (f.type === "color") {
        input = el("input", { type: "hidden", id, value: f.value || "" });
        field = el("div", { class: "swatches" }, f.options.map(([name, hex]) => el("button", { type: "button", class: "sw" + ((f.value || "") === hex ? " on" : "") + (hex ? "" : " none"), title: name, "aria-label": name, style: hex ? `background:${hex}` : "",
          onclick: (e) => { input.value = hex; for (const b of field.children) b.classList.toggle("on", b === e.currentTarget); } })));
      } else input = el("input", { type: "text", id, value: f.value || "", maxLength: f.max || 140, required: f.required !== false, autocomplete: "off", placeholder: f.placeholder });
      inputs[f.name] = input;
      form.append(el("label", { for: id }, el("span", { text: f.label }), input, field));
    }
    if (body) form.append(body);
    form.append(el("div", { class: "row end" }, el("button", { type: "button", class: "btn", text: cancel, onclick: () => finish(null) }), ok ? el("button", { class: "btn " + (danger ? "danger-fill" : "primary"), text: ok }) : null));
    const scrim = el("div", { class: "scrim", onpointerdown: (e) => { if (e.target === scrim) finish(null); } }, form);
    const close = open(scrim, () => resolve(result));
    function finish(v) { result = v; close(); }
    form.addEventListener("submit", (e) => { e.preventDefault(); const out = {}; for (const [k, i] of Object.entries(inputs)) out[k] = i.value; finish(out); });
    const first = form.querySelector("input[type=text],textarea,select") || form.querySelector("button.primary,button.danger-fill");
    first?.focus(); first?.select?.();
  });
}

// items: [{label, run, key, danger, disabled} | "-"]
export function menu(anchor, items) {
  let close;
  const m = el("div", { class: "menu", role: "menu" }, items.filter(Boolean).map((it) => it === "-" ? el("hr") :
    el("button", { class: "mi" + (it.danger ? " danger" : ""), role: "menuitem", disabled: !!it.disabled, onclick: () => { close(); it.run?.(); } }, el("span", { text: it.label }), it.key ? el("kbd", { text: it.key }) : null)));
  const scrim = el("div", { class: "scrim clear", onpointerdown: (e) => { if (e.target === scrim) close(); } }, m);
  close = open(scrim, () => {});
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor, w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w < 8 ? r.left : r.right - w)) + "px";
  m.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.bottom + 6)) + "px";
  m.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  m.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault(); e.stopPropagation();
    const bs = [...m.querySelectorAll("button:not(:disabled)")], i = bs.indexOf(document.activeElement);
    bs[(i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length]?.focus();
  });
}
