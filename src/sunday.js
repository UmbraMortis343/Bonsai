// The Sunday session, pure logic (no browser needed): his week as a compact summary for Claude, the prompts for the
// talk (one question a turn, like the oral) and for the stitch at the end, and the readers of Claude's replies.
// main.js runs it through Bonsai Desktop (`startSunday`); store.saveSunday saves what he keeps.

export const SUNDAY_MAX = 6;   // questions in a talk, at most
export const QKINDS = ["recall", "why", "connect", "rebuild", "apply"];
const DAY = 86400000;
const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
export const isSunday = (d) => new Date(d).getDay() === 0;
export const dayOf = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

// What happened in the seven days up to `now`: ideas and graphs added, ideas edited, ideas missed in watering
// (rated again or hard, or missed in an oral), and older ideas from elsewhere to link to. Each idea Claude may name
// gets a short key (a1… this week's, b1… older ones); `keys` maps them back to ids.
export function weekOf({ zones = [], trees = [], nodes = [], events = [], links = [] }, now = Date.now(), caps = {}) {
  const { added: maxAdded = 40, missed: maxMissed = 25, edited: maxEdited = 15, older: maxOlder = 60 } = caps;
  const to = +new Date(now), from = to - 7 * DAY, inWeek = (x) => { const t = Date.parse(x || ""); return t >= from && t <= to; };
  const zoneOf = new Map(zones.filter((z) => !z.archived).map((z) => [z.id, z]));
  const treeOf = new Map(trees.filter((t) => !t.archived && zoneOf.has(t.zoneId)).map((t) => [t.id, t]));
  const live = nodes.filter((n) => treeOf.has(n.treeId)), byId = new Map(live.map((n) => [n.id, n]));
  const where = (n) => { const t = treeOf.get(n.treeId); return [t?.name, zoneOf.get(t?.zoneId)?.name].filter(Boolean).join(" › "); };
  const evs = events.filter((e) => inWeek(e.at));
  const made = new Set(evs.filter((e) => e.type === "node.create").map((e) => e.ref));
  const addedAll = live.filter((n) => !n.ghost && (inWeek(n.createdAt) || made.has(n.id))).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const graphs = [...treeOf.values()].filter((t) => inWeek(t.createdAt)).map((t) => ({ id: t.id, name: t.name, topic: zoneOf.get(t.zoneId)?.name || "" }));
  const edits = new Map(), isNew = new Set(addedAll.map((n) => n.id));
  for (const e of evs) if (e.type === "node.edit" && byId.has(e.ref) && !isNew.has(e.ref)) edits.set(e.ref, (edits.get(e.ref) || 0) + 1);
  const miss = new Map();   // id → { again, hard, oral }
  const hit = (id) => { if (!miss.has(id)) miss.set(id, { again: 0, hard: 0, oral: "" }); return miss.get(id); };
  for (const e of evs) if (e.type === "node.review" && byId.has(e.ref) && (e.data?.rating === "again" || e.data?.rating === "hard") && e.data?.by !== "oral" && e.data?.by !== "sunday") hit(e.ref)[e.data.rating]++;
  for (const n of live) if (n.oral && n.oral.shown === false && inWeek(n.oral.at)) hit(n.id).oral = n.oral.why || "missed";
  const missedAll = [...miss].map(([id, m]) => ({ n: byId.get(id), ...m })).sort((a, b) => (b.again * 2 + b.hard + (b.oral ? 2 : 0)) - (a.again * 2 + a.hard + (a.oral ? 2 : 0)));

  const keys = {}, keyOf = new Map(); let ka = 0, kb = 0;
  const give = (n, older) => { if (keyOf.has(n.id)) return keyOf.get(n.id); const k = older ? "b" + ++kb : "a" + ++ka; keyOf.set(n.id, k); keys[k] = n.id; return k; };
  const idea = (n, older = false) => ({ key: give(n, older), id: n.id, title: n.title, note: cut(n.note, 120), where: where(n) });
  const added = addedAll.slice(0, maxAdded).map((n) => idea(n));
  const missed = missedAll.slice(0, maxMissed).map((m) => ({ ...idea(m.n), again: m.again, hard: m.hard, oral: cut(m.oral, 100) }));
  const edited = [...edits].sort((a, b) => b[1] - a[1]).slice(0, maxEdited).map(([id, c]) => ({ ...idea(byId.get(id)), edits: c }));
  // Older ideas to link to: the start of each graph and what hangs straight off it, from graphs other than this
  // week's first, then the rest; nothing already keyed.
  const busy = new Set([...added, ...missed, ...edited].map((i) => byId.get(i.id)?.treeId));
  const kids = new Map(); for (const n of live) if (n.parentId) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
  const cands = [];
  for (const t of [...treeOf.values()].sort((a, b) => busy.has(a.id) - busy.has(b.id))) {
    const root = byId.get(t.rootId); if (!root) continue;
    for (const n of [root, ...(kids.get(root.id) || []).sort((a, b) => (a.order || 0) - (b.order || 0))]) if (!n.ghost && !keyOf.has(n.id)) cands.push(n);
  }
  const older = cands.slice(0, maxOlder).map((n) => idea(n, true));
  const pairs = new Set(links.map((l) => [l.fromId, l.toId].sort().join("|")));
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), added, addedCount: addedAll.length, graphs, edited, missed, missedCount: missedAll.length, older, keys, pairs: [...pairs].filter((p) => p.split("|").every((id) => keyOf.has(id))) };
}

// The week as text for a prompt, kept under `max` characters (the older ideas are dropped first).
export function weekText(w, max = 9000) {
  const line = (i, extra = "") => `${i.key} | ${i.title} | ${i.where}${i.note ? " | " + i.note : ""}${extra}`;
  const day = (iso) => new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  const head = [
    `My week, ${day(w.from)} to ${day(w.to)}.`,
    `Ideas added (${w.addedCount}${w.addedCount > w.added.length ? `, the first ${w.added.length} shown` : ""}):`, ...(w.added.length ? w.added.map((i) => line(i)) : ["(none)"]),
    w.graphs.length ? "Graphs started: " + w.graphs.map((g) => `${g.name} (${g.topic})`).join(", ") : "",
    w.edited.length ? "Ideas edited:" : "", ...w.edited.map((i) => line(i, ` | ${i.edits} edit${i.edits === 1 ? "" : "s"}`)),
    `Missed in watering (${w.missedCount}):`, ...(w.missed.length ? w.missed.map((i) => line(i, " | " + [i.again && `again ×${i.again}`, i.hard && `hard ×${i.hard}`, i.oral && `oral: ${i.oral}`].filter(Boolean).join(", "))) : ["(none)"]),
  ].filter((x) => x !== "").join("\n");
  const old = ["Older ideas, from other graphs and topics, to link to:"];
  let out = head;
  for (const i of w.older) { const next = out + "\n" + [...old, line(i)].join("\n"); if (next.length > max) break; old.push(line(i)); }
  if (old.length > 1) out += "\n" + old.join("\n");
  return out.length > max ? out.slice(0, max) : out;
}

export const sundayOpen = (w) => w.addedCount ? "What did you learn this week, and how do the new ideas fit together?" : "What have you been thinking about this week, and what feels least clear?";
const transcript = (turns) => turns.map((t, k) => `Question ${k + 1}: ${t.q}\nMy answer: ${t.a ? `"""\n${String(t.a).trim().slice(0, 4000)}\n"""` : "(nothing)"}`).join("\n\n");
const SPOKEN = "A spoken answer comes through dictation: ignore mis-heard words, filler and loose grammar when the meaning is clear.";

// One turn of the talk: the transcript so far; Claude replies with the next question, or done.
export function sundayPrompt(w, turns, { max = SUNDAY_MAX } = {}) {
  const n = turns.length, last = n >= max;
  return [
    "Run my Sunday session: a short talk, about ten minutes, about what I learnt this week, so it sticks and joins up with what I already know.",
    "",
    "How to talk:",
    "- One question at a time, under 35 words, in plain spoken English. It is read aloud, so no symbols, lists or markdown.",
    `- About 4 to ${max} questions in all. Work through, roughly in order: how this week's ideas fit together; the ideas I missed in watering; links to older ideas and topics; what is still fuzzy.`,
    "- Build on what I just said. When an answer is vague or wrong, ask why or how, or for an example, rather than telling me the answer.",
    "- No praise, marks or lectures. If I say I don't know, move on.",
    "- " + SPOKEN,
    "",
    "Reply with only JSON in this shape:",
    `{"next": "...", "done": false}`,
    last ? `- This was question ${n}, the last: "done": true, "next": "".` : `- "next": the next question; "done": true and "next": "" when we have covered enough. This was question ${n} of at most ${max}.`,
    "",
    weekText(w),
    "",
    transcript(turns),
  ].join("\n");
}
export function readTurn(value) {
  const next = String(value?.next || "").trim().slice(0, 400);
  return { next, done: value?.done === true || !next };
}

// The stitch: what to change in my graphs, from the talk and the week.
export function stitchPrompt(w, turns) {
  return [
    "We just had my Sunday session. From the talk and my week, propose small changes to my knowledge graphs. I'll tick the ones to keep.",
    "",
    "- \"links\": pairs of ideas that are really connected and not yet linked, especially across graphs and topics; \"label\" says how, under 6 words.",
    "- \"notes\": an idea's short note fixed (\"mode\": \"replace\", under 160 characters) when it is wrong or unclear, or a sentence or two from what I said added to its notes (\"mode\": \"add\", under 400 characters). Use my own words where they were good.",
    `- "questions": a question to ask me later about an idea, with its answer. "kind" is one of ${QKINDS.join(", ")}; use "why" for ideas I was shaky on. Question under 30 words, answer under 60.`,
    "- \"fuzzy\": keys of ideas still shaky after the talk, to bring back sooner in watering.",
    "- Use only the keys listed. At most 6 of each; fewer is fine; leave a list empty when nothing fits.",
    `- "summary": one sentence to me ("you…") on how the week came together.`,
    "",
    "Reply with only JSON in this shape:",
    `{"links": [{"a": "a1", "b": "b2", "label": "..."}], "notes": [{"key": "a1", "mode": "add", "text": "..."}], "questions": [{"key": "a3", "kind": "why", "q": "...", "a": "..."}], "fuzzy": ["a3"], "summary": "..."}`,
    "",
    weekText(w),
    "",
    "Already linked: " + (w.pairs.length ? w.pairs.map((p) => p.split("|").map((id) => Object.keys(w.keys).find((k) => w.keys[k] === id)).join("–")).join(", ") : "(none)"),
    "",
    transcript(turns),
  ].join("\n");
}
// Reads the stitch reply into proposals { kind, id(s), text, on }, keeping only what names keys given.
export function readStitch(value, w) {
  const id = (k) => w.keys[String(k || "").trim()] || null, out = [], seen = new Set(w.pairs);
  const take = (xs, n = 6) => (Array.isArray(xs) ? xs : []).slice(0, n * 2);
  let c = 0;
  for (const l of take(value?.links)) {
    const a = id(l?.a), b = id(l?.b); if (!a || !b || a === b) continue;
    const pair = [a, b].sort().join("|"); if (seen.has(pair)) continue; seen.add(pair);
    out.push({ kind: "link", a, b, label: cut(l.label, 60) }); if (++c >= 6) break;
  }
  c = 0; const noted = new Set();
  for (const x of take(value?.notes)) {
    const n = id(x?.key), text = String(x?.text || "").trim(), mode = x?.mode === "replace" ? "replace" : "add";
    if (!n || !text || noted.has(n + mode)) continue; noted.add(n + mode);
    out.push({ kind: "note", id: n, mode, text: mode === "replace" ? cut(text, 500) : text.slice(0, 2000) }); if (++c >= 6) break;
  }
  c = 0;
  for (const x of take(value?.questions)) {
    const n = id(x?.key), q = String(x?.q || "").trim(); if (!n || !q) continue;
    out.push({ kind: "question", id: n, qk: QKINDS.includes(x?.kind) ? x.kind : "why", q: q.slice(0, 300), a: String(x?.a || "").trim().slice(0, 600) }); if (++c >= 6) break;
  }
  c = 0; const fz = new Set();
  for (const k of take(value?.fuzzy)) { const n = id(typeof k === "object" ? k?.key : k); if (!n || fz.has(n)) continue; fz.add(n); out.push({ kind: "fuzzy", id: n }); if (++c >= 6) break; }
  return { items: out.map((x) => ({ ...x, on: true })), summary: cut(value?.summary, 300) };
}
// What a kept stitch adds up to, for the record and the toast.
export const tally = (items) => ({ links: items.filter((x) => x.kind === "link").length, notes: items.filter((x) => x.kind === "note").length, questions: items.filter((x) => x.kind === "question").length, fuzzy: items.filter((x) => x.kind === "fuzzy").length });
