// Review scheduling. Pure functions, no storage.
const DAY = 86400000;
export const RATINGS = ["again", "hard", "good", "easy"];

// An idea is worth reviewing if there's something to recall.
export const reviewable = (node, childCount) => !!((node.note || "").trim() || (node.body || "").trim() || childCount > 0);
export const dueAt = (node) => node.srs?.due || new Date(Date.parse(node.createdAt) + DAY).toISOString();
export const isDue = (node, now = Date.now()) => Date.parse(dueAt(node)) <= now;

export function rate(node, rating, now = Date.now()) {
  const s = { interval: 0, ease: 2.5, reps: 0, lapses: 0, passes: 0, ...(node.srs || {}) };
  if (rating === "again") {
    s.reps = 0; s.lapses++; s.ease = Math.max(1.3, s.ease - 0.2); s.interval = 0;
    s.due = new Date(now + 10 * 60000).toISOString();
    return s;
  }
  if (rating === "hard") { s.interval = Math.max(1, s.interval * 1.2); s.ease = Math.max(1.3, s.ease - 0.15); }
  else if (rating === "good") s.interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : s.interval * s.ease;
  else if (rating === "easy") { s.interval = s.reps === 0 ? 3 : Math.max(4, s.interval * s.ease * 1.3); s.ease += 0.15; }
  else throw new Error("Unknown rating");
  s.interval = Math.round(s.interval * 10) / 10; s.reps++; s.passes++;
  s.due = new Date(now + s.interval * DAY).toISOString();
  return s;
}

// fresh: made or reviewed in the last 2 days. overdue: due more than a day ago.
export function status(node, childCount, now = Date.now()) {
  if (now - Date.parse(node.reviewedAt || node.createdAt) < 2 * DAY) return "fresh";
  if (reviewable(node, childCount) && Date.parse(dueAt(node)) + DAY <= now) return "overdue";
  return "ok";
}
export function dueLabel(node, now = Date.now()) {
  const d = Math.round((Date.parse(dueAt(node)) - now) / DAY);
  return d <= 0 ? "Due" : d === 1 ? "Due tomorrow" : `Due in ${d} days`;
}
