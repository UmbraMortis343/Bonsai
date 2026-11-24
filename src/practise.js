// Practise (card "Practise anything, any time", his ask 2026-11-21): revise a graph, a topic, an island or a hub for
// fun, due or not. Pure logic: which ideas a round asks, and how an answer moves an idea's next review. No browser.
//
// A practice answer is not a review. The day's 10 (today.js) and their score, streak and calendar never see it, and
// it never rewrites an idea's interval, reps or lapses. It only moves the one idea's due date a little:
//   right   the due date moves later by a quarter of the idea's interval (at least a quarter of a day), counted from
//           the later of its due date and now, but never past where a full "good" review now would put it
//           (srs.rate's next interval), and never earlier than it was.
//   partly  nothing changes.
//   missed  the due date comes in to the start of tomorrow (local midnight) if it was later, so tomorrow's Today can
//           pick it, and its ease drops by 0.1 (half what a lapse in srs.rate takes; floor 1.3).
// The focus stretch (focus.js `mult`) is applied when a due date is read, so these rules work on the date as read
// (`srs.dueAt(n, mult)`) and store it back without the stretch: a Keep idea missed is due tomorrow, not tomorrow plus
// its stretch. An idea with no schedule yet (never reviewed, or greyed) gets none: practising it changes nothing.
import { rate, dueAt } from "./srs.js";

export const DAY = 86400000;
export const ROUND = 10;        // ideas a round asks
export const PUSH = 0.25;       // right: a quarter of the interval later
export const EASE_DROP = 0.1;   // missed: the ease falls this much
export const MARKS = ["right", "partly", "missed"];

const startOfTomorrow = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d.getTime(); };

// The idea's srs after a practice answer, or null when nothing changes. mult: its focus level's stretch.
export function practised(node, mark, now = Date.now(), mult = 1) {
  const s = node?.srs;
  if (!s?.due || node.ghost || !MARKS.includes(mark) || mark === "partly") return null;
  const I = s.interval || 0, stretch = (mult - 1) * I * DAY, read = Date.parse(dueAt(node, mult));
  let due;
  if (mark === "right") {
    const good = rate(node, "good", now), cap = Date.parse(good.due) + (mult - 1) * good.interval * DAY;
    const want = Math.max(read, now) + PUSH * Math.max(I, 1) * mult * DAY;
    due = Math.max(read, Math.min(want, cap));
    if (due === read) return null;
    return { ...s, due: new Date(due - stretch).toISOString() };
  }
  due = Math.min(read, startOfTomorrow(now));
  const ease = Math.max(1.3, Math.round(((s.ease ?? 2.5) - EASE_DROP) * 100) / 100);
  if (due === read && ease === s.ease) return null;
  return { ...s, due: new Date(due - stretch).toISOString(), ease };
}

// How weak an idea looks from its schedule: a low ease and lapses count against it; never reviewed counts a little.
export const weakness = (x) => (x.reviewed ? Math.max(0, 2.5 - (x.ease ?? 2.5)) * 2 + (x.lapses || 0) * 0.5 : 1);
// Longest unseen and weakest first: days since it was last reviewed or practised (or made), times 1 + weakness.
export const priority = (x, now) => (Math.max(0, now - (x.seen || 0)) / DAY + 1) * (1 + weakness(x));

// The round's ideas, in order. items: [{ id, group, seen (ms), reviewed, ease, lapses }] (group: what to take turns
// between, so one graph or topic doesn't come in a block); skip: ids already asked this sitting.
export function pickPractise(items, { now = Date.now(), n = ROUND, skip = new Set() } = {}) {
  const by = new Map(), ranked = items.filter((x) => !skip.has(x.id)).map((x) => ({ x, p: priority(x, now) }))
    .sort((a, b) => b.p - a.p || String(a.x.id).localeCompare(String(b.x.id)));
  for (const r of ranked) { const g = r.x.group ?? ""; if (!by.has(g)) by.set(g, []); by.get(g).push(r); }
  const lanes = [...by.values()], out = [];
  for (let k = 0; out.length < n && lanes.some((l) => l.length > k); k++) {
    out.push(...lanes.filter((l) => l[k]).map((l) => l[k]).sort((a, b) => b.p - a.p).map((r) => r.x));
  }
  return out.slice(0, n);
}

// A sitting's score, coloured as Today's are (today.js scoreTier): results { id: right | partly | missed | void }.
export function practiseRecord(ids, results = {}) {
  const asked = ids.filter((id) => results[id] && results[id] !== "void");
  return { n: asked.length, asked: asked.length, good: asked.filter((id) => results[id] === "right").length, done: true };
}
