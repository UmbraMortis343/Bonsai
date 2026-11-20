// Questions on ideas (card "Questions of five kinds"). Watering asks a question instead of showing an idea's
// name; he answers in his head, reveals, and rates as before. Pure logic, no browser needed, so the phone (no
// Claude there) shows what's stored on the data.
//
// node.qs = [{ kind, q, a, linkId?, hide?, by: "you" | "claude", at }]
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
export function makeQuestion(x, by = "you", at = new Date().toISOString()) {
  if (!x || !KINDS.includes(x.kind)) return null;
  const q = { kind: x.kind, q: clip(x.q, 300), a: clip(x.a, 600), by: x.by === "claude" || x.by === "you" ? x.by : by, at: x.at || at };
  if (x.kind === "connect" && x.linkId) q.linkId = String(x.linkId);
  if (x.kind === "rebuild") { q.hide = [...new Set((x.hide || []).map(String))].slice(0, 3); if (!q.q) q.q = REBUILD_Q; }
  if (!q.q) return null;
  return q;
}
export const cleanQs = (list, by) => (Array.isArray(list) ? list : []).map((x) => makeQuestion(x, by)).filter(Boolean).slice(0, MAX_QS);

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
export function questionFor(node, ctx = {}, day = dayNumber()) {
  const qs = usableQs(node, ctx);
  if (!qs.length) return { kind: "name", q: node?.title || "", a: "", fallback: true, i: -1 };
  const kinds = KINDS.filter((k) => qs.some((x) => x.kind === k)), s = seed(node.id || node.title);
  const kind = kinds[(day + s) % kinds.length], mine = qs.filter((x) => x.kind === kind);
  return mine[(Math.floor(day / kinds.length) + s) % mine.length];
}

// ---------- Claude writes questions for a batch of ideas (Bonsai Desktop) ----------
// ideas: [{ id, title, note, parent (title), kids: [{ id, title }], links: [{ id, other (title), label }] }]
export function questionsPrompt({ topic = "", graph = "", ideas = [] }) {
  const sheet = ideas.map((x, k) => [
    `${k + 1}. ${x.title}${x.note ? " | " + clip(x.note, 200) : ""}`,
    x.parent ? `   hangs from: ${x.parent}` : "",
    x.kids?.length ? `   under it: ${x.kids.map((c) => c.title).join("; ")}` : "",
    x.links?.length ? `   linked to: ${x.links.map((l) => l.other + (l.label ? ` (${l.label})` : "")).join("; ")}` : "",
  ].filter(Boolean).join("\n")).join("\n");
  return [
    `Write review questions for ideas in my knowledge graph "${graph}"${topic ? `, topic "${topic}"` : ""}, in Bonsai, a knowledge-retention app.`,
    "",
    "When I water an idea I see your question, answer it in my head, then see the answer and rate myself. Write one question per idea. Kinds:",
    "- recall: asks for the idea itself (\"What is impulse equal to?\")",
    "- why: asks why a foundation holds (\"Why does a changing current induce a voltage?\")",
    "- connect: asks how the idea relates to one it is linked to; give that idea's exact title as \"link\"",
    "- rebuild: for an idea with ideas under it; I name the hidden ones. Give 2 or 3 of their exact titles as \"hide\"",
    "- apply: a quick problem with numbers, only where the topic suits it (physics, circuits, maths); \"a\" is the worked answer",
    "",
    "Mix the kinds across the batch. Don't put the idea's title in a recall or why question. Questions under 200 characters; answers short (under 300), and leave \"a\" empty when the idea's title and note already answer it.",
    "",
    "Reply with only JSON, in this shape:",
    '{"questions":[{"idea":1,"kind":"why","q":"…","a":"…"},{"idea":2,"kind":"connect","q":"…","a":"…","link":"…"},{"idea":3,"kind":"rebuild","q":"…","hide":["…","…"]}]}',
    "",
    "The ideas:",
    "",
    sheet,
  ].join("\n");
}

// Reads Claude's reply (parsed JSON, or text holding it) against the ideas it was asked about.
// Returns { list: [{ id, q }], bad } where q is a question ready to keep (by: "claude").
export function readQuestions(reply, ideas) {
  let data = reply;
  if (typeof reply === "string") {
    const t = reply.replace(/```(?:json)?/g, ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("Claude's reply had nothing Bonsai could read");
    data = JSON.parse(t.slice(a, b + 1));
  }
  const rows = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
  if (!rows) throw new Error("Claude's reply had no questions");
  const list = [], at = new Date().toISOString(); let bad = 0;
  for (const r of rows) {
    const idea = ideas[(Number(r?.idea) || 0) - 1];
    const kind = norm(r?.kind);
    if (!idea || !KINDS.includes(kind)) { bad++; continue; }
    const x = { kind, q: r.q, a: r.a };
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
    list.push({ id: idea.id, q });
  }
  return { list, bad };
}
