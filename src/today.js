// Today (card "Today: streak, calendar and the day's 10"), pure logic: which ideas are asked today, which kind of
// question each gets, the streak, the month's grid and a day's log. No browser needed.
//
// The day's 10 replace watering as something to click: due ideas only, longest overdue first and spread across
// topics, about 7 from Focus and 3 from Keep (either fills in when the other is short), and on about one day in
// five a bonus 11th from Settled. Kinds aim for about 6 Recall or Why, 2 Connect, 1 Rebuild, 1 Apply where the
// ideas have them. The pick is made once a day and kept in meta `today`, so the phone and the laptop agree.
import { isSunday, dayOf } from "./sunday.js";

export const DAILY = 10;
export const SHARE = { focus: 7, keep: 3 };
export const MIX = { apply: 1, rebuild: 1, connect: 2 };   // the rest Recall or Why
export const BONUS_EVERY = 5;
const seed = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// A bonus day, seeded by the date so every device agrees.
export const bonusDay = (day) => seed("bonus:" + day) % BONUS_EVERY === 0;

// Longest overdue first, taking turns between topics: the topic whose oldest idea has waited longest goes first,
// then the next, and round again. Among ideas due the same day, one with a written question goes before one with
// none (so the question bank is used), but a day overdue always outranks that. items: [{ id, zone, due (ms), kinds }].
const DAY = 86400000;
const asks = (x) => (x.kinds?.length ? 0 : 1);
export const before = (a, b) => Math.floor(a.due / DAY) - Math.floor(b.due / DAY) || asks(a) - asks(b) || a.due - b.due || String(a.id).localeCompare(String(b.id));
export function spread(items) {
  const by = new Map();
  for (const it of [...items].sort(before)) { if (!by.has(it.zone)) by.set(it.zone, []); by.get(it.zone).push(it); }
  const lanes = [...by.values()], out = [];
  for (let k = 0; lanes.some((l) => l.length > k); k++) {
    const row = lanes.filter((l) => l[k]).map((l) => l[k]).sort(before);
    out.push(...row);
  }
  return out;
}

// Kinds for the picked ideas: the rare ones first, each to the idea with the fewest other choices; the rest Recall
// or Why where they have one (turn about, seeded), else whatever they have. items: [{ id, kinds: [kind] }].
export function assignKinds(items, day) {
  const out = {}, free = new Set(items.map((x) => x.id)), kinds = new Map(items.map((x) => [x.id, new Set(x.kinds || [])]));
  for (const [kind, want] of Object.entries(MIX)) {
    const can = items.filter((x) => free.has(x.id) && kinds.get(x.id).has(kind)).sort((a, b) => kinds.get(a.id).size - kinds.get(b.id).size);
    for (const x of can.slice(0, want)) { out[x.id] = kind; free.delete(x.id); }
  }
  for (const x of items) {
    if (!free.has(x.id)) continue;
    const k = kinds.get(x.id), both = k.has("recall") && k.has("why");
    out[x.id] = both ? (seed(day + x.id) % 2 ? "why" : "recall") : k.has("recall") ? "recall" : k.has("why") ? "why" : null;
    if (!out[x.id]) delete out[x.id];
  }
  return out;
}

// The day's pick. pool: { focus, keep, settled }, each [{ id, zone, due, kinds }] of ideas due now.
// Returns { day, ids, kinds: { id: kind }, bonus: id | null, rated: {} }.
export function pickToday(pool, day, n = DAILY) {
  const f = spread(pool.focus || []), k = spread(pool.keep || []);
  const a = f.slice(0, SHARE.focus), b = k.slice(0, SHARE.keep), room = n - a.length - b.length;
  const more = [...f.slice(SHARE.focus), ...k.slice(SHARE.keep)].slice(0, Math.max(0, room));
  const picked = spread([...a, ...b, ...more]);   // taking turns between topics again, so one topic doesn't come in a block
  let bonus = null;
  if (bonusDay(day)) { const s = spread(pool.settled || [])[0]; if (s) { picked.push(s); bonus = s.id; } }
  return { day, ids: picked.map((x) => x.id), kinds: assignKinds(picked, day), bonus, rated: {} };
}

const GOOD = new Set(["good", "easy"]);
// A day's record from its pick: n ideas asked today, asked so far, good (rated good or easy), done when all are.
// live: ids still there (an idea deleted since the pick no longer counts). An idea rated "void" (he found its question
// vague, 0.38.0) leaves the day's count altogether: not against him, not for him.
export const VOID = "void";
export function recordOf(pick, live = null) {
  const r = pick?.rated || {}, ids = (pick?.ids || []).filter((id) => (!live || live.has(id)) && r[id] !== VOID);
  const asked = ids.filter((id) => r[id]).length, good = ids.filter((id) => GOOD.has(r[id])).length;
  return { n: ids.length, asked, good, done: asked === ids.length };
}

// How a day's score is coloured: every one right on a bonus day (11 of 11) is "perfect", ten or more right (or all
// of a smaller day) "good", fewer "short"; nothing asked, "" (the day shows no score).
export function scoreTier(r) {
  if (!r?.asked) return "";
  if (r.n > DAILY && r.good === r.n) return "perfect";
  return r.good >= Math.min(DAILY, r.n) ? "good" : "short";
}

// "YYYY-MM-DD" one day on (or back).
export function addDays(key, d) { const [y, m, x] = key.split("-").map(Number); return dayOf(new Date(y, m - 1, x + d, 12)); }
const dateOf = (key) => { const [y, m, x] = key.split("-").map(Number); return new Date(y, m - 1, x, 12); };

// Days in a row with the day's 10 done, up to today (today counts once it's done; until then it doesn't break
// the run). A Sunday left undone doesn't break it, nor does a day when nothing was due. days: { key: record }.
export function streak(days, today) {
  let n = 0, key = today;
  if (days[key]?.done && days[key].n > 0) n++;
  for (let i = 0; i < 3660; i++) {
    key = addDays(key, -1);
    const r = days[key];
    if (r?.done && r.n > 0) n++;
    else if (isSunday(dateOf(key)) || (r && r.n === 0)) continue;
    else break;
  }
  return n;
}

// The month as weeks from Monday: [[{ key, d, inMonth }]] (six rows at most). m: 0–11.
export function monthGrid(y, m) {
  const first = new Date(y, m, 1, 12), back = (first.getDay() + 6) % 7, weeks = [];
  let at = new Date(y, m, 1 - back, 12);
  do {
    const w = [];
    for (let i = 0; i < 7; i++) { w.push({ key: dayOf(at), d: at.getDate(), inMonth: at.getMonth() === m }); at = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, 12); }
    weeks.push(w);
  } while (at.getMonth() === m && weeks.length < 6);
  return weeks;
}

// What happened on a day, from what's kept: ideas and graphs added, notes changed, what was reviewed and how it
// went (the last rating of the day for each idea), what was practised (the last mark), and the Sunday session held that day.
export function dayLog(day, { events = [], nodes = [], trees = [], pages = [], sundays = [], record = null }) {
  const on = (iso) => !!iso && dayOf(iso) === day, byId = new Map(nodes.map((n) => [n.id, n]));
  const graphs = trees.filter((t) => on(t.createdAt) && !t.archived);
  const fresh = new Set(graphs.map((t) => t.rootId));
  const added = nodes.filter((n) => on(n.createdAt) && !n.ghost && !fresh.has(n.id));
  const notes = pages.filter((p) => p.kind !== "folder" && (on(p.updatedAt) || on(p.createdAt)));
  const seen = new Map(), tried = new Map();   // tried: practised that day (practise.js), the last mark for each idea
  for (const e of [...events].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    if (!on(e.at) || !byId.has(e.ref)) continue;
    if (e.type === "node.practise") { tried.delete(e.ref); tried.set(e.ref, { id: e.ref, title: byId.get(e.ref).title, mark: e.data?.mark || "" }); continue; }
    if (e.type !== "node.review") continue;
    seen.delete(e.ref); seen.set(e.ref, { id: e.ref, title: byId.get(e.ref).title, rating: e.data?.rating || "", asked: e.data?.asked || "", by: e.data?.by || "" });
  }
  const sunday = [...sundays].reverse().find((s) => s.day === day) || null;
  return { day, added, graphs, notes, reviewed: [...seen.values()], practised: [...tried.values()], sunday, record };
}
