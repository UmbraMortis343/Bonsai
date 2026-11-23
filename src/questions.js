// Questions on ideas (card "Questions of five kinds"). Watering asks a question instead of showing an idea's
// name; he answers in his head, reveals, and rates as before. Pure logic, no browser needed, so the phone (no
// Claude there) shows what's stored on the data.
//
// node.qs = [{ kind, q, a, pts?, linkId?, hide?, by: "you" | "claude", at, flag?, flagAt? }]
//   recall   "What is impulse equal to?"
//   why      for foundations: "Why does a changing current induce a voltage?"
//   connect  from one of the idea's links: "How does Faraday's law relate to Lenz's law?" (linkId)
//   rebuild  the idea with 1–3 of what hangs from it hidden (hide: node ids); name them
//   apply    a quick problem, where a topic suits it (physics, circuits); a is the worked answer
// An idea with no question it can use is cued by its name, as before.

export const KINDS = ["recall", "why", "connect", "rebuild", "apply"];
export const KIND_NAME = { recall: "Recall", why: "Why", connect: "Connect", rebuild: "Rebuild", apply: "Apply", name: "" };
export const MAX_QS = 12;   // per idea
const DAY = 86400000;
const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const seed = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const REBUILD_Q = "Fill the blanks";

// Today as a whole number of local days, so the question asked changes from one day to the next.
export const dayNumber = (now = Date.now()) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / DAY);

// One question, tidied, or null when it can't be one. by: who wrote it.
// pts: 1–3 key points a full answer needs (Claude marks point by point; older questions have none). flag: "vague"
// (he said so in the round) or "overruled" (he overruled Claude's mark), with flagAt; the bank rewrites those first.
export const MAX_PTS = 3;
export function makeQuestion(x, by = "you", at = new Date().toISOString()) {
  if (!x || !KINDS.includes(x.kind)) return null;
  const q = { kind: x.kind, q: clip(x.q, 300), a: clip(x.a, 600), by: x.by === "claude" || x.by === "you" ? x.by : by, at: x.at || at };
  if (x.kind === "connect" && x.linkId) q.linkId = String(x.linkId);
  if (x.kind === "rebuild") { q.hide = [...new Set((x.hide || []).map(String))].slice(0, 3); if (!q.q) q.q = REBUILD_Q; }
  const pts = cleanPts(x.pts); if (pts.length && x.kind !== "rebuild") q.pts = pts;
  if (FLAGS.includes(x.flag)) { q.flag = x.flag; q.flagAt = x.flagAt || at; }
  if (!q.q) return null;
  return q;
}
export const FLAGS = ["vague", "overruled"];
export const cleanPts = (list) => (Array.isArray(list) ? list : typeof list === "string" ? list.split("\n") : []).map((p) => clip(String(p ?? "").replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\s+/g, " "), 160)).filter(Boolean).slice(0, MAX_PTS);
export const cleanQs = (list, by) => (Array.isArray(list) ? list : []).map((x) => makeQuestion(x, by)).filter(Boolean).slice(0, MAX_QS);
// A question the bank should write again: flagged, or Claude's from before key points (a rebuild has its hidden
// ideas as its points). His own are never rewritten unasked.
export const isStale = (q) => !!q && q.by !== "you" && q.kind !== "rebuild" && !q.pts?.length;
export const needsRedo = (q) => !!q && q.by !== "you" && (!!q.flag || isStale(q));
// The points a question is marked on: its own, or a rebuild's hidden ideas (titles given by the caller).
export const pointsOf = (q, titles = []) => (q?.kind === "rebuild" ? titles.filter(Boolean) : q?.pts || []);

// Which of what hangs from an idea to hide for a Rebuild: up to three, at least two when there are two.
export function pickHide(kids, key = "") {
  const ids = kids.map((k) => k.id ?? k), n = Math.min(3, ids.length);
  return [...ids].sort((a, b) => seed(key + a) - seed(key + b)).slice(0, n);
}

// The questions an idea can use now. ctx: { kids: [node], links: [{ id, other: node }] }.
// Connect needs a link (its own, if it names one, still there); Rebuild needs what hangs from the idea, and hides
// only what still does (none left: it picks again).
export function usableQs(node, ctx = {}) {
  const kids = ctx.kids || [], links = ctx.links || [], out = [];
  (node?.qs || []).forEach((x, i) => {
    if (!x || !KINDS.includes(x.kind) || !String(x.q || "").trim()) return;
    if (x.kind === "connect") {
      if (!links.length) return;
      if (x.linkId && !links.some((l) => l.id === x.linkId)) return;
    }
    let hide;
    if (x.kind === "rebuild") {
      if (!kids.length) return;
      const here = new Set(kids.map((k) => k.id));
      hide = (x.hide || []).filter((id) => here.has(id));
      if (!hide.length) hide = pickHide(kids, node.id);
    }
    out.push({ ...x, i, ...(hide ? { hide } : {}) });
  });
  return out;
}

// The question to ask for an idea today: kinds take turns from day to day (each idea starting at its own place),
// and within a kind its questions do. None usable: the name is the cue ({ kind: "name", fallback: true }).
// prefer: a kind to ask if the idea has one (the day's 10 spread the kinds, today.js); else the turn as usual.
export function questionFor(node, ctx = {}, day = dayNumber(), prefer = null) {
  const qs = usableQs(node, ctx);
  if (!qs.length) return { kind: "name", q: node?.title || "", a: "", fallback: true, i: -1 };
  const kinds = KINDS.filter((k) => qs.some((x) => x.kind === k)), s = seed(node.id || node.title);
  const kind = prefer && kinds.includes(prefer) ? prefer : kinds[(day + s) % kinds.length], mine = qs.filter((x) => x.kind === kind);
  return mine[(Math.floor(day / kinds.length) + s) % mine.length];
}

// ---------- Claude writes questions for a batch of ideas (Bonsai Desktop) ----------
// The question bank: every idea should carry BANK_PER written questions of different kinds, written by Claude in
// batches of BANK_BATCH on the laptop and kept on the idea (node.qs), so the phone asks them with no Claude there.
export const BANK_PER = 3;
export const BANK_BATCH = 25;
const line = (s, n) => clip(String(s ?? "").replace(/\*\*|__|`+/g, "").replace(/\s+/g, " "), n);
// ideas: [{ id, title, note, body, graph, parent (title), kids: [{ id, title }], links: [{ id, other (title), label }],
//   need (how many new ones to write), hasKinds (kinds it has), have (its questions' text, so none is written twice),
//   redo: [{ kind, q, why: "vague" | "overruled" | "old" }] (questions to write again, same kind) }]
// per: questions wanted for each idea (1: one each, the kinds mixed across the batch; 3: the bank's three kinds).
const WHY_REDO = { vague: "I found it vague", overruled: "I overruled your mark on it", old: "older style, no key points" };
export function questionsPrompt({ topic = "", graph = "", ideas = [], per = 1 }) {
  const graphs = new Set(ideas.map((x) => x.graph).filter(Boolean)), many = graphs.size > 1;
  const named = graph || (graphs.size === 1 ? [...graphs][0] : "");
  const redoing = ideas.some((x) => x.redo?.length), onlyRedo = redoing && ideas.every((x) => x.need === 0);
  const sheet = ideas.map((x, k) => [
    `${k + 1}. ${x.title}${x.note ? " | " + line(x.note, 200) : ""}`,
    many && x.graph ? `   in graph: ${x.graph}` : "",
    x.parent ? `   hangs from: ${x.parent}` : "",
    x.kids?.length ? `   under it: ${x.kids.map((c) => c.title).join("; ")}` : "",
    x.links?.length ? `   linked to: ${x.links.map((l) => l.other + (l.label ? ` (${l.label})` : "")).join("; ")}` : "",
    x.body ? `   notes: ${line(x.body, 500)}` : "",
    per > 1 && x.need != null && x.need < per && !onlyRedo ? `   already has: ${(x.hasKinds || []).join(", ") || "some"}; write ${x.need ? x.need + " new" : "no new ones"}` : "",
    ...(x.redo || []).map((r, j) => `   rewrite ${j + 1} (${r.kind}${WHY_REDO[r.why] ? ", " + WHY_REDO[r.why] : ""}): ${line(r.q, 300)}`),
  ].filter(Boolean).join("\n")).join("\n");
  const kinds = [
    "- recall: a precise cue with a single answer, so the answer is the idea. Never put the idea's title, or a form of it, in a recall question: not \"What is impulse?\" but \"What equals a force times the time it acts for? Name it.\" Not \"What happens when heating turns a solid to liquid?\" (\"a phase change\" fits as well as the answer meant) but \"What is the fixed temperature at which a pure solid melts called?\"",
    "- why: asks why it holds, or why it matters, and how many reasons: \"Give two reasons why…\", \"In one sentence, why…\"",
    "- apply: a quick problem to work with one answer, with numbers where the topic has them (physics, circuits, maths, music theory); \"a\" is the worked answer",
    "- connect: asks how the idea relates to one it is linked to, saying which way the relation runs and how many points to give; give that idea's exact title as \"link\"",
    "- rebuild: for an idea with ideas under it; I name the hidden ones. Give 2 or 3 of their exact titles as \"hide\"; \"q\" may be empty",
  ];
  const ask = onlyRedo
    ? ["Write only the rewrites: for each \"rewrite\" line, one new question of the same kind that asks for the same thing, clearly. Give \"rewrites\" as that line's number.", "", "Kinds:", ...kinds]
    : per > 1
      ? [`Write ${per} questions for each idea, each of a different kind: a recall, a why, and then an apply where the topic suits it, else a connect if the idea is linked to another, else a rebuild if it has ideas under it, else another why. Where an idea already has questions, write only as many as it says, of kinds it doesn't have.`, "", "Kinds:", ...kinds]
      : ["Write one question per idea, mixing the kinds across the batch. Kinds:", ...kinds];
  return [
    `Write review questions for ideas in my knowledge graph${many ? "s" : ""}${named ? ` "${named}"` : ""}${topic ? `, topic "${topic}"` : ""}, in Bonsai, a knowledge-retention app.`,
    "",
    "Each morning Bonsai asks me one question on an idea; I answer, typed or spoken, and my answer is marked against the key points you give, one by one. The questions should test whether I understand the idea and can use it, not whether I recognise its name. Build them from the idea's note, notes, and the ideas around it; keep to what's standard for the topic.",
    "",
    ...ask,
    "",
    "Every question (but a rebuild) must:",
    "- Say the shape of the answer it wants, so I know when I've answered fully: \"Name it and say what sets when it happens.\", \"Give both.\", \"In one sentence…\", \"Two reasons…\". A why, connect or apply says how many points it wants.",
    "- Have exactly one reasonable reading. Before you keep a question, read it as I might and look for a second meaning; if there is one, rephrase it. \"How are area and volume related to integrals?\" reads as \"how do area and volume relate to each other through integrals\" or as \"how does each relate to integrals\"; ask instead \"Integrating what gives the area under a curve, and integrating what gives a volume? Give both.\"",
    "- Ask for every key point it is marked on, and nothing it isn't.",
    "",
    "Key points (\"pts\"): the 1 to 3 things a full answer needs, each under 80 characters, in the order the question asks for them. A recall that asks only for the idea has one. A rebuild needs none.",
    "",
    ...(redoing && !onlyRedo ? ["Some ideas have \"rewrite\" lines: questions to replace. For each, write one new question of the same kind that asks for the same thing, clearly, and give \"rewrites\" as that line's number. These are on top of any new ones the idea asks for.", ""] : []),
    "Questions under 200 characters. Answers (\"a\") 1 or 2 sentences, under 300 characters; a rebuild needs none. No \"what is X?\" with X the idea.",
    "",
    "Reply with only JSON, in this shape:",
    '{"questions":[{"idea":1,"kind":"recall","q":"…","a":"…","pts":["…"]},{"idea":1,"kind":"why","q":"… Give two reasons.","a":"…","pts":["…","…"]},{"idea":2,"kind":"connect","q":"…","a":"…","pts":["…","…"],"link":"…"},{"idea":3,"kind":"rebuild","q":"","hide":["…","…"]}' + (redoing ? ',{"idea":4,"kind":"why","q":"…","a":"…","pts":["…"],"rewrites":1}' : "") + "]}",
    "",
    "The ideas:",
    "",
    sheet,
  ].join("\n");
}

// A recall that names its own idea gives the answer away.
export const namesItself = (q, title) => { const t = norm(title).replace(/[^\p{L}\p{N} ]/gu, ""), x = norm(q).replace(/[^\p{L}\p{N} ]/gu, ""); return t.length >= 3 && x.includes(t); };

// Reads Claude's reply (parsed JSON, or text holding it) against the ideas it was asked about.
// Returns { list: [{ id, q, replaces? }], bad } where q is a question ready to keep (by: "claude") and replaces the
// text of the question it is written to replace (from the idea's redo list; same kind, each once).
// A question without key points gets its answer as its one point, so every new one can be marked point by point.
export function readQuestions(reply, ideas) {
  let data = reply;
  if (typeof reply === "string") {
    const t = reply.replace(/```(?:json)?/g, ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("Claude's reply had nothing Bonsai could read");
    data = JSON.parse(t.slice(a, b + 1));
  }
  const rows = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
  if (!rows) throw new Error("Claude's reply had no questions");
  const list = [], at = new Date().toISOString(), seen = new Map(), got = new Map(), redone = new Set(); let bad = 0;
  for (const r of rows) {
    const idea = ideas[(Number(r?.idea) || 0) - 1];
    const kind = norm(r?.kind);
    if (!idea || !KINDS.includes(kind)) { bad++; continue; }
    if (kind === "recall" && namesItself(r.q, idea.title)) { bad++; continue; }
    if (!seen.has(idea.id)) seen.set(idea.id, new Set((idea.have || []).map(norm)));
    if (kind !== "rebuild" && seen.get(idea.id).has(norm(r.q))) { bad++; continue; }
    const k = Number(r?.rewrites) || 0, old = k ? idea.redo?.[k - 1] : null;
    if (k && (!old || old.kind !== kind || redone.has(idea.id + ":" + k))) { bad++; continue; }
    if (!old && idea.need != null && (got.get(idea.id) || 0) >= idea.need) { bad++; continue; }
    const x = { kind, q: r.q, a: r.a, pts: cleanPts(r.pts) };
    if (kind !== "rebuild" && !x.pts.length && String(r.a || "").trim()) x.pts = [line(r.a, 160)];
    if (kind === "connect") {
      const l = (idea.links || []).find((l) => norm(l.other) === norm(r.link)) || (idea.links?.length === 1 ? idea.links[0] : null);
      if (!l) { bad++; continue; }
      x.linkId = l.id;
    }
    if (kind === "rebuild") {
      if (!idea.kids?.length) { bad++; continue; }
      const want = new Set((Array.isArray(r.hide) ? r.hide : []).map(norm));
      x.hide = idea.kids.filter((c) => want.has(norm(c.title))).map((c) => c.id);
      if (!x.hide.length) x.hide = pickHide(idea.kids, idea.id);
    }
    const q = makeQuestion(x, "claude", at);
    if (!q) { bad++; continue; }
    seen.get(idea.id).add(norm(q.q));
    if (old) { redone.add(idea.id + ":" + k); list.push({ id: idea.id, q, replaces: old.q }); continue; }
    got.set(idea.id, (got.get(idea.id) || 0) + 1);
    list.push({ id: idea.id, q });
  }
  return { list, bad };
}

// ---------- Claude marks an answer (Today, Bonsai Desktop) ----------
// One quick call per answer: the question, its key points, what he wrote, the stored answer and the idea's note.
// The reply is { got: [true | false per point], mark: right | partly | missed, why: one short line, nudge? }.
// With points the mark follows them: every point right, some partly, none missed. nudge (asked for on a first try
// only): a one-line hint toward a missing point, without giving it; he gets one more go, then it's marked whole.
export const MARKS = ["right", "partly", "missed"];
export const MARK_NAME = { right: "Right", partly: "Partly", missed: "Missed" };
export const MARK_RATING = { right: "good", partly: "hard", missed: "again" };
export function markPrompt({ topic = "", title = "", note = "", kind = "", q = "", a = "", pts = [], answer = "", first = "", hint = "", nudge = false }) {
  const P = cleanPts(pts);
  return [
    "Mark my answer to a review question in Bonsai, a knowledge-retention app. Right: it has the substance, whatever the wording or spelling. Partly: some of it, but something key is missing or wrong. Missed: not really.",
    "",
    topic ? `Topic: ${topic}` : "",
    `Idea: ${title}${note ? " | " + line(note, 300) : ""}`,
    `Question${kind ? ` (${kind})` : ""}: ${line(q, 400)}`,
    P.length ? `Key points:\n${P.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "",
    a ? `Expected: ${line(a, 600)}` : "",
    first ? `My first answer: ${line(first, 1200)}` : "",
    first && hint ? `Your hint: ${line(hint, 200)}` : "",
    first ? `What I added: ${line(answer, 1200)}` : `My answer: ${line(answer, 1200)}`,
    "",
    first ? "Mark both answers together, as one." : "",
    P.length ? `For each key point, say whether my answer has it (true or false) in "got", in order. The mark follows: right with every point, partly with some, missed with none.` : "",
    nudge ? `If I got some of it but not all, add "nudge": one short line, under 70 characters, said to me, that points toward what I left out without giving it away (like "And for area?"). Otherwise leave it out.` : "",
    "",
    `Reply with only JSON: {${P.length ? `"got":[${P.map(() => "true|false").join(",")}],` : ""}"mark":"right"|"partly"|"missed","why":"one short line, under 100 characters, said to me"${nudge ? ',"nudge":"…"' : ""}}`,
  ].filter((x) => x !== "").join("\n");
}
// n: how many key points were sent (0: none). Returns { mark, why, got?, nudge? } or null.
export function readMark(text, n = 0) {
  const t = String(text || "").replace(/```(?:json)?/g, ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let d; try { d = JSON.parse(t.slice(a, b + 1)); } catch { return null; }
  let mark = norm(d?.mark);
  const got = n && Array.isArray(d?.got) && d.got.length === n ? d.got.map((x) => x === true || norm(x) === "true") : null;
  if (got) mark = got.every(Boolean) ? "right" : got.some(Boolean) ? "partly" : "missed";
  if (!MARKS.includes(mark)) return null;
  const out = { mark, why: clip(d.why, 160) };
  if (got) out.got = got;
  const nudge = clip(String(d.nudge ?? "").replace(/\s+/g, " "), 120);
  if (nudge && mark === "partly") out.nudge = nudge;
  return out;
}
