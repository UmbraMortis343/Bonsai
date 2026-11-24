// Strength (his call, 2026-11-25): the garden, Shaky (H) and the month follow how well he answers, not what's
// overdue. Today picks the questions (longest waiting first), so being overdue is no longer his doing; how his
// answers go is. Pure logic, no browser.
//
// An answer is any rated go at an idea the log keeps: a review (Today's round, a review round, an oral, a Sunday's
// fuzzy idea; node.review with a rating) or a practice answer (node.practise with a mark). Each scores
//   right, good, easy 1    partly, hard 0.5    missed, again 0    (a vague question, "void", isn't an answer)
//
// A topic's strength: its ideas' answers from the last WINDOW (30) days, each weighted by how recent it is (the
// weight halves every HALF = 10 days), averaged. Fewer than MIN (5) answers in the window: no strength (null), and
// the topic looks as a new one should, lush.
// The garden's health from strength: FULL (85%) or better is full health; at LOW (40%) or worse it bottoms out at
// FLOOR (0.45): dry-edged, sparse and pale, but never dead (isles-world.js draws bones, and isles.js circling birds,
// only below 0.3, which strength never reaches).
// A Settled topic is always full health (it isn't being studied).
// Shaky (H): among an idea's answers in the last WINDOW days, the latest was missed, or at least 2 of the last 4
// were missed or only partly right.
export const DAY = 86400000;
export const WINDOW = 30;
export const HALF = 10;
export const MIN = 5;
export const FULL = 0.85;
export const LOW = 0.4;
export const FLOOR = 0.45;
export const SHAKY_OF = 4;      // the last answers Shaky looks at
export const SHAKY_WEAK = 2;    // missed or partly among them that make an idea shaky
export const MONTH_MIN = 4;     // answers a topic needs in a month to be among its shakiest
export const SCORE = { easy: 1, good: 1, right: 1, hard: 0.5, partly: 0.5, again: 0, missed: 0 };

// One event's answer, or null: { at (ms), s (score) }.
export function answerOf(e) {
  const r = e?.type === "node.review" ? e.data?.rating : e?.type === "node.practise" ? e.data?.mark : null;
  const s = r ? SCORE[r] : undefined, at = Date.parse(e?.at || "");
  return s === undefined || !(at >= 0) ? null : { at, s };
}
// Every idea's answers from the log: Map id → [{ at, s }], oldest first.
export function answersFrom(events = []) {
  const m = new Map();
  for (const e of events) { const a = answerOf(e); if (!a) continue; if (!m.has(e.ref)) m.set(e.ref, []); m.get(e.ref).push(a); }
  for (const l of m.values()) l.sort((a, b) => a.at - b.at);
  return m;
}
const inWindow = (list, now) => (list || []).filter((a) => a.at <= now && a.at > now - WINDOW * DAY);

// The strength of a set of ideas (a topic's): lists, their answer lists. { n, score (0–1, or null below MIN) }.
export function strengthOf(lists, now = Date.now()) {
  let n = 0, w = 0, sw = 0;
  for (const l of lists) for (const a of inWindow(l, now)) { const k = Math.pow(0.5, (now - a.at) / DAY / HALF); n++; w += k; sw += k * a.s; }
  return { n, score: n >= MIN && w > 0 ? sw / w : null };
}
// What the garden draws from a strength (null: neutral, full health).
export function healthOf(score) {
  if (score == null) return 1;
  return FLOOR + (1 - FLOOR) * Math.min(1, Math.max(0, (score - LOW) / (FULL - LOW)));
}
// Is an idea shaky? list: its answers, oldest first.
export function isShaky(list, now = Date.now()) {
  const r = inWindow(list, now); if (!r.length) return false;
  if (r[r.length - 1].s === 0) return true;
  return r.slice(-SHAKY_OF).filter((a) => a.s < 1).length >= SHAKY_WEAK;
}
// A span's shakiest topics: those with at least MONTH_MIN answers and something not right, lowest share right
// first, then most missed. events: the log; topicOf(id) → zone id; from/to: ms. [{ id, n, right, missed, pct }].
export function shakiest(events, topicOf, from, to, min = MONTH_MIN) {
  const by = new Map();
  for (const e of events) {
    const a = answerOf(e); if (!a || a.at < from || a.at >= to) continue;
    const z = topicOf(e.ref); if (!z) continue;
    const o = by.get(z) || { id: z, n: 0, right: 0, missed: 0 };
    o.n++; if (a.s === 1) o.right++; else if (a.s === 0) o.missed++;
    by.set(z, o);
  }
  return [...by.values()].filter((o) => o.n >= min && o.right < o.n).map((o) => ({ ...o, pct: Math.round((o.right / o.n) * 100) }))
    .sort((a, b) => a.right / a.n - b.right / b.n || b.missed - a.missed || String(a.id).localeCompare(String(b.id)));
}
