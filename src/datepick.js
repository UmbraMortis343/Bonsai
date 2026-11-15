// A small calendar that drops down from whatever opened it, for date properties and @ dates in notes.
// datePicker(anchor, "2026-11-15" | "", pick(iso | "")) — arrows move by day or week, Enter picks, Esc closes.
import { el, put } from "./dom.js";

export const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromIso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
export const longDate = (s) => { const d = fromIso(s); return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : ""; };
export const shortDate = (s) => { const d = fromIso(s); return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""; };
// "Today", "Tomorrow", "Yesterday" for the days around now, otherwise the date
export function relDate(s) {
  const d = fromIso(s); if (!d) return "";
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.round((d - t) / 86400000);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : shortDate(s);
}

export function datePicker(anchor, value, pick) {
  let at = fromIso(value) || new Date(); at.setHours(0, 0, 0, 0);
  let month = new Date(at.getFullYear(), at.getMonth(), 1);
  const head = el("div", { class: "dphead" }), grid = el("div", { class: "dpgrid", role: "grid" });
  const box = el("div", { class: "menu datepop", role: "dialog", "aria-label": "Date", tabIndex: -1 }, head, grid,
    el("div", { class: "dpfoot" },
      el("button", { type: "button", class: "btn", id: "dpToday", onclick: () => done(isoDay(new Date())) }, "Today"),
      value ? el("button", { type: "button", class: "btn", id: "dpClear", onclick: () => done("") }, "Clear") : null));
  const scrim = el("div", { class: "scrim clear", onpointerdown: (e) => { if (e.target === scrim) close(); } }, box);
  const close = () => { scrim.remove(); document.removeEventListener("keydown", keys, true); };
  const done = (v) => { close(); pick(v); };
  const draw = () => {
    const today = isoDay(new Date());
    put(head, el("button", { type: "button", class: "ib", "aria-label": "Previous month", text: "‹", onclick: () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); draw(); } }),
      el("b", { text: month.toLocaleDateString(undefined, { month: "long", year: "numeric" }) }),
      el("button", { type: "button", class: "ib", "aria-label": "Next month", text: "›", onclick: () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); draw(); } }));
    const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));   // weeks start on Monday
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    put(grid, ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((w) => el("span", { class: "dpw", text: w })),
      days.map((d) => { const iso = isoDay(d);
        return el("button", { type: "button", class: "dpd" + (d.getMonth() !== month.getMonth() ? " out" : "") + (iso === today ? " today" : "") + (iso === value ? " on" : "") + (iso === isoDay(at) ? " at" : ""),
          dataset: { day: iso }, text: String(d.getDate()), onclick: () => done(iso) }); }));
  };
  const keys = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) { e.preventDefault(); e.stopPropagation(); at = new Date(at); at.setDate(at.getDate() + step); month = new Date(at.getFullYear(), at.getMonth(), 1); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(isoDay(at)); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  };
  document.addEventListener("keydown", keys, true);
  (document.querySelector("#overlay") || document.body).append(scrim);
  draw();
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  box.style.left = Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, r.left)) + "px";
  box.style.top = (r.bottom + 4 + box.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - box.offsetHeight - 4) : r.bottom + 4) + "px";
  box.focus();
  return close;
}
