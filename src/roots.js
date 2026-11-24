// Foundations credit (card "Using an idea counts for its foundations (carefully)", agreed 2026-11-21), pure.
//
// Recalling an idea well keeps the ideas beneath it fresh, a little: they wait longer before they're asked. But
// knowing that x does y isn't knowing why, so the credit is small and capped, and an idea kept fresh this way is
// asked as a Why question when it does come up.
//
// Beneath (`beneath`, `foundations`): one step down from an idea is the idea it hangs from in its graph; for a
// graph's first idea it's the idea named in its island's `from`, on the island it grows `after` (the tech tree's
// own rule: `from` counts only when that idea is on the `after` island). Two steps down is one step from there, so
// a graph's first idea and the idea its island grows from both count for what hangs off it. Links never count.
//
// Credit (`giveCredit`): an idea answered right (good or easy) gives each foundation one step down half its own
// interval gain (new interval − old, in days), two steps down a quarter (`SHARE`). Hard, again and a vague question
// give nothing and take nothing. It's kept on the foundation as `credit = { due, days, at, from: [{ id, step, days,
// at }] }`: `days` are added to its wait when its due date is read (srs.dueAt, times the focus level's `mult`, so it
// composes with Keep and Settled); ease, interval and the stored due date are never touched. Credit from several
// ideas adds up but never past the idea's own interval (`CAP`), so its wait is at most twice what it was given.
// Credit only goes to an idea that isn't due yet (counting credit it already has): once it's due it's asked
// directly. An idea never reviewed, just missed (interval 0) or greyed gets none.
//
// `due` ties the credit to the review it stretches: any new review of the foundation (Today, an oral, a Sunday
// "sooner", an exam) gives it a new due date, and the credit stops counting at once (`liveCredit`), even on a
// device that synced the review without clearing the field. store.reviewNode also clears it.
//
// Asked as Why (`wasCredited`): an idea with live credit that comes due was last kept fresh through what hangs off
// it rather than by being asked, so the day's 10 ask it as Why when it has a Why question (today.js `assignKinds`)
// and the round shows a small Foundation tag.
//
// Who gives credit: store.reviewNode gives it only when called with `roots` (main.js `rootsFor`), so a review that
// isn't recall (Practise, All good, an oral, a Sunday) gives none unless it asks to. Practise: don't pass `roots`.
export const SHARE = [0, 0.5, 0.25];   // by step: one step down 50% of the gain, two steps 25%
export const STEPS = 2;
export const CAP = 1;                  // credit is at most CAP × the idea's own interval: its wait at most 2×
export const KEEP_FROM = 6;            // who gave it, newest last, for the panel's line and the timelapse
export const GIVES = new Set(["good", "easy"]);
const DAY = 86400000;
const round2 = (x) => Math.round(x * 100) / 100;

// The island a topic (zone) sits on.
const isleOf = (zoneId, garden) => (garden?.islands || []).find((q) => (q.zoneIds || []).includes(zoneId)) || null;

// One step beneath an idea, or null. ctx: { byId: Map id → node, trees: Map id → tree, garden }.
export function beneath(node, { byId, trees, garden } = {}) {
  if (!node) return null;
  if (node.parentId != null) return byId.get(node.parentId) || null;
  const tree = trees?.get(node.treeId), isl = tree && isleOf(tree.zoneId, garden);
  if (!isl?.after || !isl.from) return null;
  const f = byId.get(isl.from); if (!f || f.id === node.id) return null;
  const ft = trees.get(f.treeId), fi = ft && isleOf(ft.zoneId, garden);
  return fi?.id === isl.after ? f : null;
}
// An idea's foundations, nearest first: [{ id, step }], one and two steps down (STEPS). A greyed idea is passed
// through (what's beneath it still counts) but never listed.
export function foundations(node, ctx, steps = STEPS) {
  const out = [], seen = new Set([node?.id]);
  let at = node;
  for (let step = 1; step <= steps; step++) {
    at = beneath(at, ctx); if (!at || seen.has(at.id)) break;
    seen.add(at.id);
    if (!at.ghost) out.push({ id: at.id, step });
  }
  return out;
}

// The credit on an idea that still counts: for the review it was given against, on an idea that's been reviewed.
export const liveCredit = (n) => (n?.credit && !n.ghost && n.srs?.due && n.credit.due === n.srs.due && n.credit.days > 0 ? n.credit : null);
export const capOf = (n) => Math.max(0, (n?.srs?.interval || 0) * CAP);
// Days of credit an idea has (plain days, before the focus level's stretch).
export const creditDays = (n) => { const c = liveCredit(n); return c ? Math.min(c.days, capOf(n)) : 0; };
// How much later the idea is due, in ms, at a focus level's mult. srs.dueAt adds this.
export const stretchMs = (n, mult = 1) => creditDays(n) * mult * DAY;
// Kept fresh through what hangs off it since it was last asked: ask it as Why.
export const wasCredited = (n) => creditDays(n) > 0;
// The days an answer gained: the new interval less the old.
export const gainOf = (before, after) => Math.max(0, (after?.interval || 0) - (before?.interval || 0));

// Due (ms) with the focus level's stretch and the credit, as srs.dueAt works it out (kept here so this file needs
// nothing from srs.js, which imports it).
function dueMs(n, mult) {
  const base = Date.parse(n.srs.due) + (mult - 1) * (n.srs.interval || 0) * DAY;
  return base + stretchMs(n, mult);
}

// Gives a foundation its share of a gain. gain: days the answer gained; step: 1 or 2; from: the idea answered;
// mult: the foundation's focus level stretch; now: ms. Returns { node, days } (the foundation as it now is, and the
// days given) or null when it gets nothing.
export function giveCredit(node, { gain, step, from, mult = 1, now = Date.now() }) {
  if (!node || node.ghost || !node.srs?.due || !(node.srs.interval > 0)) return null;
  const add = (gain || 0) * (SHARE[step] || 0); if (!(add > 0)) return null;
  if (dueMs(node, mult) <= now) return null;   // already due: it's asked directly
  const cur = creditDays(node), room = capOf(node) - cur; if (room <= 0.005) return null;
  const days = round2(Math.min(add, room)); if (!(days > 0)) return null;
  const at = new Date(now).toISOString(), was = liveCredit(node)?.from || [];
  const credit = { due: node.srs.due, days: round2(cur + days), at, from: [...was, { id: from, step, days, at }].slice(-KEEP_FROM) };
  return { node: { ...node, credit }, days };
}

// Credit for a whole answer: [{ node, days, step }] for the foundations that get some. rating: what the answer was
// rated; before/after: the answered idea's srs as it was and as it is; roots: [{ node, step, mult }].
export function creditFor({ rating, before, after, from, roots = [], now = Date.now() }) {
  if (!GIVES.has(rating)) return [];
  const gain = gainOf(before, after); if (!(gain > 0)) return [];
  const out = [];
  for (const r of roots) { const g = giveCredit(r.node, { gain, step: r.step, from, mult: r.mult ?? 1, now }); if (g) out.push({ ...g, step: r.step }); }
  return out;
}

// The idea as it was at t, for the timelapse: credit given after t taken off (what `from` no longer lists is kept).
export function creditAt(n, t) {
  const c = n?.credit; if (!c) return n;
  if (Date.parse(c.at) <= t) return n;
  const later = (c.from || []).filter((f) => Date.parse(f.at) > t).reduce((s, f) => s + (f.days || 0), 0), days = round2(c.days - later);
  const out = { ...n };
  if (days > 0) out.credit = { ...c, days, from: (c.from || []).filter((f) => Date.parse(f.at) <= t) }; else delete out.credit;
  return out;
}
// Who kept it fresh last (an id), for the panel's line.
export const keptBy = (n) => liveCredit(n)?.from?.at(-1)?.id || null;
