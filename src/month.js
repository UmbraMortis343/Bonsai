// Month in review (card "Month in review and the story so far"), pure logic: a month's numbers from what Bonsai
// keeps, the month as a compact outline for Claude, the month's stitch (its big pattern and cross-topic links to
// tick) and one chapter of the story so far, written to "you", a chapter a month. No browser needed.
// main.js shows it (`monthShow`, ⇧Y) and keeps what's made in meta `months` ({ "YYYY-MM": { at, pattern, links,
// chapterPageId, seen } }); chapters are Library pages in a Story folder.
import { createHistory, DAY } from "./history.js";
import { streak, addDays } from "./today.js";
import { dayOf } from "./sunday.js";
import { reviewable, dueAt } from "./srs.js";
import { dryAfter, multOf } from "./focus.js";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MAX_LINKS = 8;
const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const ms = (x) => (x ? Date.parse(x) : NaN);

// "YYYY-MM" of a time; a month on or back; its name ("November 2026"); its bounds in local time.
export const ymOf = (t) => dayOf(t).slice(0, 7);
const parts = (ym) => ym.split("-").map(Number);
export const addMonths = (ym, d) => { const [y, m] = parts(ym); return ymOf(new Date(y, m - 1 + d, 1, 12)); };
export const monthName = (ym) => { const [y, m] = parts(ym); return `${MONTHS[m - 1]} ${y}`; };
export const monthRange = (ym) => { const [y, m] = parts(ym); return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 1).getTime() }; };

// Practice answers more than this apart are separate rounds.
const ROUND_GAP = 30 * 60000;
// A topic dried when its share of ideas left long past due (focus.js `dry`) rose by at least this much.
const DRIED = 0.05;

// The month's numbers. data: { zones, trees, nodes, links, pages }; events: the log (all of it, or at least from the
// month's start; older ones let the timelapse history replay what was due when the month began); days: meta `days`;
// sundays: meta `sundays`; ym: "YYYY-MM". opts: now, level(zoneId) → focus|keep|settled, skipPages (ids, e.g. the
// story's chapters), caps.
export function monthOf(data, events = [], days = {}, sundays = [], ym, opts = {}) {
  const { now = Date.now(), level = () => "focus", skipPages = new Set(), caps = {} } = opts;
  const { added: maxAdded = 80, missed: maxMissed = 20, older: maxOlder = 60 } = caps;
  const { zones = [], trees = [], nodes = [], links = [], pages = [] } = data;
  const { from, to } = monthRange(ym), end = Math.max(from, Math.min(to, now)), inMonth = (x) => { const t = typeof x === "number" ? x : ms(x); return t >= from && t < end; };
  const zoneOf = new Map(zones.filter((z) => !z.archived).map((z) => [z.id, z]));
  const treeOf = new Map(trees.filter((t) => !t.archived && zoneOf.has(t.zoneId)).map((t) => [t.id, t]));
  const live = nodes.filter((n) => treeOf.has(n.treeId)), byId = new Map(live.map((n) => [n.id, n]));
  const topicOf = (n) => treeOf.get(n?.treeId)?.zoneId;
  const where = (n) => { const t = treeOf.get(n.treeId); return [t?.name, zoneOf.get(t?.zoneId)?.name].filter(Boolean).join(" › "); };
  const evs = events.filter((e) => inMonth(e.at)).sort((a, b) => String(a.at).localeCompare(String(b.at)));

  // added: ideas made this month (or woken from grey by an exam or an oral), graphs and notes started
  const made = new Set(evs.filter((e) => e.type === "node.create").map((e) => e.ref));
  const addedAll = live.filter((n) => !n.ghost && (inMonth(n.createdAt) || made.has(n.id))).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const graphs = [...treeOf.values()].filter((t) => inMonth(t.createdAt));
  const notes = pages.filter((p) => p.kind !== "folder" && !skipPages.has(p.id) && inMonth(p.createdAt));
  const linksMade = links.filter((l) => inMonth(l.createdAt) && byId.has(l.fromId) && byId.has(l.toId));

  // Today: the days with something due, the days done, the score (right of asked), the streaks
  const keys = [];
  for (let k = dayOf(from), last = dayOf(end - 1); k <= last && keys.length < 31; k = addDays(k, 1)) keys.push(k);
  const recs = keys.map((k) => days[k]).filter(Boolean);
  const due = recs.filter((r) => r.n > 0).length, done = recs.filter((r) => r.done && r.n > 0).length;
  const asked = recs.reduce((a, r) => a + (r.asked || 0), 0), good = recs.reduce((a, r) => a + (r.good || 0), 0);
  const best = keys.reduce((a, k) => Math.max(a, streak(days, k)), 0), atEnd = keys.length ? streak(days, keys[keys.length - 1]) : 0;

  // reviews and practice
  const reviews = evs.filter((e) => e.type === "node.review" && e.data?.rating && e.data?.by !== "sunday");
  const tries = evs.filter((e) => e.type === "node.practise");
  let rounds = 0, last = -Infinity;
  for (const e of tries) { const t = ms(e.at); if (t - last > ROUND_GAP) rounds++; last = t; }
  const held = sundays.filter((s) => s.day && s.day >= dayOf(from) && s.day <= dayOf(end - 1));

  // topics: which grew (ideas added), which dried (more left long past due at the month's end than its start)
  const grewBy = new Map();
  for (const n of addedAll) { const z = topicOf(n); grewBy.set(z, (grewBy.get(z) || 0) + 1); }
  const grew = [...grewBy].map(([id, n]) => ({ id, name: zoneOf.get(id)?.name || "", n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const hist = createHistory({ zones, trees, nodes, links, events, pages }, now);
  const dryShare = (t) => {
    const past = hist.at(t), out = new Map();
    for (const n of past.nodes) {
      const z = topicOf(n); if (!z) continue;
      const lv = level(z); if (lv === "settled" || !reviewable(n, past.kids.get(n.id) || 0)) continue;
      const o = out.get(z) || { rev: 0, dry: 0 }; o.rev++;
      if (Date.parse(dueAt(n, multOf(lv))) + dryAfter(lv) * DAY <= t) o.dry++;
      out.set(z, o);
    }
    return out;
  };
  const a = dryShare(from), b = dryShare(end), share = (o) => (o?.rev ? o.dry / o.rev : 0);
  const dried = [...b].filter(([id, o]) => o.dry && share(o) - share(a.get(id)) >= DRIED)
    .map(([id, o]) => ({ id, name: zoneOf.get(id)?.name || "", was: share(a.get(id)), now: share(o), dry: o.dry })).sort((x, y) => (y.now - y.was) - (x.now - x.was));

  // what was missed: ideas rated again or hard in reviews, most first
  const miss = new Map();
  for (const e of reviews) if ((e.data.rating === "again" || e.data.rating === "hard") && byId.has(e.ref)) { const m = miss.get(e.ref) || { again: 0, hard: 0 }; m[e.data.rating]++; miss.set(e.ref, m); }
  const missedAll = [...miss].map(([id, m]) => ({ n: byId.get(id), ...m })).sort((x, y) => (y.again * 2 + y.hard) - (x.again * 2 + x.hard));

  // keys for Claude: a1… the month's ideas (and what was missed), b1… older ideas to link to
  const keyed = {}, keyOf = new Map(), topicKey = {}; let ka = 0, kb = 0;
  const give = (n, older) => { if (keyOf.has(n.id)) return keyOf.get(n.id); const k = older ? "b" + ++kb : "a" + ++ka; keyOf.set(n.id, k); keyed[k] = n.id; topicKey[k] = topicOf(n); return k; };
  const idea = (n, older = false) => ({ key: give(n, older), id: n.id, title: n.title, note: cut(n.note, 100), where: where(n) });
  const shown = addedAll.slice(0, maxAdded);
  const byTopic = new Map();
  for (const n of shown) {
    const z = topicOf(n); if (!byTopic.has(z)) byTopic.set(z, { id: z, name: zoneOf.get(z)?.name || "", graphs: [], ideas: [] });
    byTopic.get(z).ideas.push({ ...idea(n), graph: treeOf.get(n.treeId)?.name || "" });
  }
  for (const t of graphs) { if (!byTopic.has(t.zoneId)) byTopic.set(t.zoneId, { id: t.zoneId, name: zoneOf.get(t.zoneId)?.name || "", graphs: [], ideas: [] }); byTopic.get(t.zoneId).graphs.push(t.name); }
  const added = [...byTopic.values()].sort((x, y) => y.ideas.length - x.ideas.length || x.name.localeCompare(y.name));
  const missed = missedAll.slice(0, maxMissed).map((m) => ({ ...idea(m.n), again: m.again, hard: m.hard }));
  // older ideas from every topic: each graph's first idea and what hangs straight off it
  const kids = new Map(); for (const n of live) if (n.parentId) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
  const cands = [];
  for (const t of treeOf.values()) {
    const root = byId.get(t.rootId); if (!root || ms(root.createdAt) >= end) continue;
    for (const n of [root, ...(kids.get(root.id) || []).sort((x, y) => (x.order || 0) - (y.order || 0))]) if (!n.ghost && !keyOf.has(n.id) && ms(n.createdAt) < end) cands.push(n);
  }
  // take turns between topics, so one big topic doesn't crowd the rest out
  const lanes = new Map(); for (const n of cands) { const z = topicOf(n); if (!lanes.has(z)) lanes.set(z, []); lanes.get(z).push(n); }
  const fair = []; for (let k = 0; fair.length < cands.length; k++) for (const l of lanes.values()) if (l[k]) fair.push(l[k]);
  const older = fair.slice(0, maxOlder).map((n) => idea(n, true));

  // the Sundays: what each kept, and the links they stitched this month
  const stitched = links.filter((l) => l.by === "sunday" && inMonth(l.createdAt) && byId.has(l.fromId) && byId.has(l.toId))
    .map((l) => ({ a: byId.get(l.fromId).title, b: byId.get(l.toId).title, label: l.label || "" }));
  const pairs = new Set(links.map((l) => [l.fromId, l.toId].sort().join("|")));
  return {
    ym, name: monthName(ym), from, to, end,
    ideas: addedAll.length, graphs: graphs.length, pages: notes.length, links: linksMade.length,
    today: { due, done }, streak: { best, end: atEnd }, score: asked ? { good, asked, pct: Math.round((good / asked) * 100) } : null,
    sundays: held.length, answered: reviews.length, practised: tries.length, rounds,
    grew, dried, added, missed, missedCount: missedAll.length, older, stitched,
    held: held.map((s) => ({ day: s.day, summary: s.summary || "", kept: s.kept || {}, undone: !!s.undone })),
    keys: keyed, topicKey, pairs: [...pairs].filter((p) => p.split("|").every((id) => keyOf.has(id))),
  };
}

// How a figure is coloured, as Today's scores are: purple only for a perfect month, green for good, ochre short.
export function scoreTier(m) {
  if (!m.score) return "";
  return m.score.pct === 100 ? "perfect" : m.score.pct >= 80 ? "good" : "short";
}
export const daysTier = (m) => (!m.today.due ? "" : m.today.done === m.today.due ? "good" : "short");
// Is there anything in the month at all (to tell an empty month from a quiet one)?
export const anything = (m) => !!(m.ideas || m.graphs || m.pages || m.today.due || m.answered || m.practised || m.sundays || m.links);

// The numbers as a line of text.
export function numbersText(m) {
  return [
    `${m.ideas} idea${m.ideas === 1 ? "" : "s"} added`, `${m.graphs} graph${m.graphs === 1 ? "" : "s"} started`, `${m.pages} note page${m.pages === 1 ? "" : "s"} written`,
    m.today.due ? `the day's questions done on ${m.today.done} of ${m.today.due} days` : "",
    m.score ? `${m.score.pct}% right (${m.score.good} of ${m.score.asked})` : "",
    m.streak.best ? `best streak ${m.streak.best} day${m.streak.best === 1 ? "" : "s"}` : "",
    m.sundays ? `${m.sundays} Sunday session${m.sundays === 1 ? "" : "s"}` : "",
    m.practised ? `${m.practised} practice answer${m.practised === 1 ? "" : "s"} in ${m.rounds} round${m.rounds === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ") + ".";
}

// The month as a compact outline for a prompt: what was added per topic (idea names, with keys when asked for), the
// Sundays and what they stitched, what was missed, which topics dried; kept under `max` characters (older ideas,
// then the month's ideas past the first few per topic, are dropped first).
export function monthText(m, { keys = false, max = 9000, older = keys } = {}) {
  const k = (i) => (keys ? `${i.key} | ` : "");
  const line = (i, extra = "") => keys ? `${i.key} | ${i.title} | ${i.where}${i.note ? " | " + i.note : ""}${extra}` : `${i.title}${extra}`;
  const out = [`${m.name}. ${numbersText(m)}`];
  out.push("", "Added, by topic:");
  if (!m.added.length) out.push("(nothing)");
  for (const t of m.added) {
    out.push(`${t.name} (${t.ideas.length} idea${t.ideas.length === 1 ? "" : "s"}${t.graphs.length ? `; new graphs: ${t.graphs.join(", ")}` : ""})`);
    if (keys) out.push(...t.ideas.map((i) => line(i)));
    else {
      const by = new Map(); for (const i of t.ideas) { if (!by.has(i.graph)) by.set(i.graph, []); by.get(i.graph).push(i.title); }
      for (const [g, xs] of by) out.push(`  ${g}: ${xs.join("; ")}`);
    }
  }
  if (m.ideas > m.added.reduce((a, t) => a + t.ideas.length, 0)) out.push(`(and ${m.ideas - m.added.reduce((a, t) => a + t.ideas.length, 0)} more)`);
  if (m.held.length) {
    out.push("", "Sunday sessions:");
    for (const s of m.held) {
      const kept = [s.kept.links && `${s.kept.links} link${s.kept.links === 1 ? "" : "s"}`, s.kept.notes && `${s.kept.notes} note fix${s.kept.notes === 1 ? "" : "es"}`, s.kept.questions && `${s.kept.questions} question${s.kept.questions === 1 ? "" : "s"}`].filter(Boolean).join(", ");
      out.push(`${s.day}: ${s.summary || "held"}${kept ? ` (kept ${kept})` : ""}${s.undone ? " (taken back)" : ""}`);
    }
  }
  if (m.stitched.length) out.push("", "Links stitched on Sundays:", ...m.stitched.map((l) => `${l.a} ↔ ${l.b}${l.label ? ` (${l.label})` : ""}`));
  const how = (i) => [i.again && `again ×${i.again}`, i.hard && `hard ×${i.hard}`].filter(Boolean).join(", ");
  out.push("", `Missed in review (${m.missedCount}):`, ...(m.missed.length ? m.missed.map((i) => (keys ? line(i, ` | ${how(i)}`) : `${i.title} (${i.where}): ${how(i)}`)) : ["(none)"]));
  if (m.dried.length) out.push("", "Topics left to dry: " + m.dried.map((d) => `${d.name} (${Math.round(d.now * 100)}% long overdue, was ${Math.round(d.was * 100)}%)`).join(", "));
  if (m.grew.length) out.push("Topics that grew most: " + m.grew.slice(0, 5).map((g) => `${g.name} +${g.n}`).join(", "));
  let text = out.join("\n");
  if (older && m.older.length) {
    const head = ["", "Older ideas, across topics, to link to:"];
    for (const i of m.older) { const next = text + "\n" + [...head, k(i) + i.title + ` | ${i.where}`].join("\n"); if (next.length > max) break; head.push(k(i) + i.title + ` | ${i.where}`); }
    if (head.length > 2) text += "\n" + head.join("\n");
  }
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// The month's stitch: the big pattern in a few lines, and links between ideas in different topics to tick.
export function monthPrompt(m) {
  const name = (id) => Object.keys(m.keys).find((k) => m.keys[k] === id);
  return [
    `Look back over my month in Bonsai, ${m.name}: what I added, the Sunday sessions and what they stitched, what I missed. Find the big pattern, and propose links between ideas in different topics that belong together. I'll tick the links to keep.`,
    "",
    `- "pattern": 2 to 4 short sentences to me ("you…") on what the month added up to: the threads that ran through it across topics and Sundays, and where it is thin. Plain, no praise.`,
    `- "links": up to ${MAX_LINKS} pairs of ideas from different topics that are really connected and not yet linked; "label" says how, under 6 words. Use only the keys listed; at least one idea of each pair from this month (a…) where you can.`,
    "",
    "Reply with only JSON in this shape:",
    `{"pattern": "...", "links": [{"a": "a1", "b": "b2", "label": "..."}]}`,
    "",
    monthText(m, { keys: true }),
    "",
    "Already linked: " + (m.pairs.length ? m.pairs.map((p) => p.split("|").map(name).join("–")).join(", ") : "(none)"),
  ].join("\n");
}
// Reads the stitch reply: the pattern and the links, kept only between keys given, in different topics, not yet linked.
export function readMonth(value, m) {
  const id = (k) => m.keys[String(k || "").trim()] || null, topic = (k) => m.topicKey[String(k || "").trim()];
  const seen = new Set(m.pairs), links = [];
  for (const l of (Array.isArray(value?.links) ? value.links : []).slice(0, MAX_LINKS * 2)) {
    const a = id(l?.a), b = id(l?.b); if (!a || !b || a === b || topic(l.a) === topic(l.b)) continue;
    const pair = [a, b].sort().join("|"); if (seen.has(pair)) continue; seen.add(pair);
    links.push({ kind: "link", a, b, label: cut(l.label, 60), on: true }); if (links.length >= MAX_LINKS) break;
  }
  return { pattern: cut(value?.pattern, 700), links };
}

// One chapter of the story so far. prev: the earlier chapters, oldest first, [{ ym, title, text }]; text: monthText of
// this month (no keys); pattern: the month's stitch pattern, if there is one.
export function storyPrompt(prev, text, { name = "", pattern = "", max = 14000 } = {}) {
  // the chapter before in full, the ones before it shortened when the whole is too long
  const room = Math.max(2000, max - text.length - 2000), shown = [];
  let used = 0;
  for (const c of [...prev].reverse()) {
    const body = String(c.text || "").trim(); if (!body) continue;
    const left = room - used; if (left < 300) break;
    const t = body.length > left ? body.slice(0, left - 1) + "…" : body; used += t.length;
    shown.unshift(`## ${c.title}\n${t}`);
  }
  return [
    `Write this month's chapter of the story of my learning, for ${name}.`,
    "",
    "- It is one running story, a chapter a month. The earlier chapters are below: carry their threads on, refer back to them where it fits, and don't repeat them.",
    "- Written to me, in the second person (\"This month you…\"). 150 to 300 words. Plain and warm; honest, not flattering: say what slipped as well as what grew.",
    "- Draw on what I added, what I struggled with, the Sundays and the numbers; name real ideas and topics. No headings inside, no lists.",
    `- Reply in Markdown: the first line "# ${name}", then the chapter in a few paragraphs. Nothing else.`,
    "",
    "Earlier chapters:",
    shown.length ? shown.join("\n\n") : "(none yet: this is the first chapter)",
    "",
    "The month:",
    text,
    pattern ? `\nThe month's pattern, as we saw it: ${pattern}` : "",
  ].join("\n").trim();
}
// The chapter from Claude's reply: the title line dropped (the page is named for the month), the rest as Markdown.
export function readChapter(text) {
  let t = String(text || "").replace(/\r/g, "").trim();
  const fence = t.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/); if (fence) t = fence[1].trim();
  const lines = t.split("\n"), i = lines.findIndex((l) => l.trim());
  let title = "";
  if (i >= 0 && /^#\s+/.test(lines[i].trim())) { title = lines[i].trim().replace(/^#\s+/, ""); lines.splice(0, i + 1); }
  const body = lines.join("\n").trim();
  return body ? { title, body } : null;
}

// The month offered on the 1st: on any of the month's first `days` days, the month before, if Bonsai held anything
// before it began and it hasn't been opened. months: meta `months`; since: when the first thing was made (ms).
export function monthOffer(now, months = {}, since = Infinity, days = 7) {
  const d = new Date(now); if (d.getDate() > days) return null;
  const ym = addMonths(ymOf(now), -1);
  if (!(since < monthRange(ym).to) || months?.[ym]?.seen) return null;
  return ym;
}
