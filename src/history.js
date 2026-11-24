// The past, worked out from what Bonsai keeps: when each topic, graph and idea came, and how its reviews went.
// Pure: nothing is read from or written to the store here. The timelapse draws the garden from `at(t)`.
//
// An idea came when it was made (createdAt), or later if it was woken from grey (an exam or an oral logs a
// node.create when it does). Its watering at t is replayed from the log's node.review events with srs.rate; a
// review older than the log (or never logged, as in the demo) is known only by reviewedAt, so the idea is taken
// to have had today's schedule from then. Before its first review an idea is due a day after it came, as now.
// Ideas deleted since are gone from the store and don't show in the past either; moves and grafts show where
// things are now. Every answer the log keeps (strength.js `answersFrom`) comes with each moment as `answers`, so the
// garden's strength at t is worked out from the answers before t, as it is now (strengthOf(…, t) ignores later ones).
import { rate } from "./srs.js";
import { creditAt } from "./roots.js";
import { answersFrom } from "./strength.js";

export const DAY = 86400000;
const ms = (x) => (x ? Date.parse(x) : NaN);
const iso = (t) => new Date(t).toISOString();
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

export function createHistory({ zones = [], trees = [], nodes = [], links = [], events = [], pages = [] }, now = Date.now()) {
  const woke = new Map(), logged = new Map();
  for (const e of events) {
    const at = ms(e.at); if (!(at >= 0)) continue;
    if (e.type === "node.create") woke.set(e.ref, Math.max(woke.get(e.ref) || 0, at));
    else if (e.type === "node.review" && e.data?.rating) { if (!logged.has(e.ref)) logged.set(e.ref, []); logged.get(e.ref).push({ at, rating: e.data.rating }); }
    else if (e.type === "node.practise" && e.data?.due) { if (!logged.has(e.ref)) logged.set(e.ref, []); logged.get(e.ref).push({ at, moved: e.data }); }   // practise.js: only the due date (and the ease on a miss) moved
  }
  const ideas = nodes.filter((n) => !n.ghost).map((n) => {
    const made = ms(n.createdAt), born = Math.min(now, Math.max(made >= 0 ? made : now, woke.get(n.id) || 0));
    const steps = (logged.get(n.id) || []).filter((r) => r.at >= born - 1000).sort((a, b) => a.at - b.at);
    const last = steps.length ? steps[steps.length - 1].at : -Infinity, seen = ms(n.reviewedAt);
    const snap = n.srs && seen >= born - 1000 && seen > last + 2000 ? seen : null;   // a review the log doesn't have
    // shown by an exam or an oral: one pass, as store.passed gives (its exact interval isn't kept)
    const pass = n.srs && (n.exam || (woke.get(n.id) || 0) > made + 1000) ? { interval: 4, ease: 2.5, reps: 1, lapses: 0, passes: 1, due: iso(born + 4 * DAY) } : undefined;
    const settled = Math.max(last, snap ?? -Infinity);   // from here on the idea is as it is now
    return { n, born, steps, pass, settled };
  });
  const borns = ideas.map((x) => x.born).sort((a, b) => a - b), answers = answersFrom(events);
  const first = Math.min(now, ...borns.slice(0, 1), ...zones.map((z) => ms(z.createdAt)).filter((t) => t >= 0), ...trees.map((t) => ms(t.createdAt)).filter((t) => t >= 0));
  const min = Math.min(first, now - DAY);

  // Foundations credit (roots.js) belongs to the idea's latest review: as it is now, less credit given after t;
  // before that review, none (it was given against a due date the idea didn't have yet).
  function ideaAt(x, t) {
    if (t >= x.settled) return x.n.srs ? creditAt(x.n, t) : { ...x.n, createdAt: iso(x.born) };
    let s = x.pass, seen = x.pass ? x.born : undefined;
    for (const r of x.steps) {
      if (r.at > t) break;
      if (r.moved) { if (s) s = { ...s, due: r.moved.due, ...(r.moved.ease != null ? { ease: r.moved.ease } : {}) }; continue; }
      s = rate({ srs: s }, r.rating, r.at); seen = r.at;
    }
    const out = { ...x.n, createdAt: iso(x.born), srs: s, reviewedAt: seen != null ? iso(seen) : null }; delete out.credit;
    return out;
  }
  return {
    min, max: now,
    // how many ideas had come by t (cheap, for telling whether anything changed)
    count(t) { let lo = 0, hi = borns.length; while (lo < hi) { const m = (lo + hi) >> 1; if (borns[m] <= t) lo = m + 1; else hi = m; } return lo; },
    // what there was at t: the topics, graphs and ideas, each idea with its watering as it was then
    at(t) {
      const list = [], byTree = new Map(), kids = new Map();
      for (const x of ideas) {
        if (x.born > t) continue;
        const n = ideaAt(x, t); list.push(n);
        if (!byTree.has(n.treeId)) byTree.set(n.treeId, []); byTree.get(n.treeId).push(n);
        if (n.parentId != null) kids.set(n.parentId, (kids.get(n.parentId) || 0) + 1);
      }
      const treeIds = new Set(trees.filter((tr) => ms(tr.createdAt) <= t || byTree.has(tr.id)).map((tr) => tr.id));
      const zoneIds = new Set(zones.filter((z) => ms(z.createdAt) <= t).map((z) => z.id)); for (const tr of trees) if (treeIds.has(tr.id)) zoneIds.add(tr.zoneId);
      const ids = new Set(list.map((n) => n.id));
      return { t, zones: zoneIds, trees: treeIds, nodes: list, byTree, kids, answers, links: links.filter((l) => !(ms(l.createdAt) > t) && ids.has(l.fromId) && ids.has(l.toId)) };
    },
    // marks to jump to: every Sunday, and big days (an exam brought in, a large Grow, or many ideas in one day)
    ticks(from = min, to = now) {
      const out = [], d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
      for (; d.getTime() <= to; d.setDate(d.getDate() + 7)) if (d.getTime() >= from) out.push({ at: d.getTime(), kind: "sunday" });
      const days = new Map(), day = (t) => { const k = dayKey(t); if (!days.has(k)) days.set(k, { n: 0, exam: 0, grow: 0, last: t }); const v = days.get(k); v.last = Math.max(v.last, t); return v; };
      for (const x of ideas) if (x.born >= from && x.born <= to) { const v = day(x.born); v.n++; if (x.n.exam) v.exam++; }
      for (const p of pages) for (const g of p.grown || []) { const at = ms(g.at); if (at >= from && at <= to && (g.nodeIds?.length || 0) >= 8) day(at).grow += g.nodeIds.length; }
      for (const v of days.values()) {
        const kind = v.exam >= 5 ? "exam" : v.grow ? "grow" : v.n >= 20 ? "big" : null;
        if (kind) out.push({ at: Math.min(to, v.last + 1000), kind, n: v.n });   // just after the day's last idea came
      }
      return out.sort((a, b) => a.at - b.at);
    },
  };
}
