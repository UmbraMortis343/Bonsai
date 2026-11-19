// The papers: what Claude is asked when it sets and marks one, and how its replies are read.
// Pure logic; the exams page is built from this file and src/exams.js (tools/exams/build.mjs).
import { ideaKey, linkKey } from "../../src/exams.js";

const about = (map, g) => `The subject is ${map.topic}, pitched at ${map.source || map.tier} (${map.tier}).${g ? ` The section is "${g.name}".` : ""}`;
const sheet = (ideas) => ideas.map((i) => `${i.key} | ${"  ".repeat(i.depth)}${i.title} | ${i.note}`).join("\n");
const STRICT = [
  "Mark as a fair, strict examiner.",
  "- An idea is shown only when my answer states its substance correctly or uses it correctly. Naming it is not enough. Never credit a wrong statement.",
  "- A spoken answer comes through dictation: ignore mis-heard words, filler and loose grammar when the meaning is clear.",
  "- A handwritten answer comes as photos: read it carefully, and don't credit what you can't read.",
  "- \"why\" is under 15 words, said to me (\"you...\"): what earned it, or what was missing.",
].join("\n");
const answerText = (text, photos) => [photos ? `My answer is handwritten in the ${photos} attached photo${photos === 1 ? "" : "s"}.` : "", text ? "My answer:\n\"\"\"\n" + text.trim().slice(0, 12000) + "\n\"\"\"" : ""].filter(Boolean).join("\n\n");
const MARKS = `Reply with only JSON in this shape:\n{"marks": [{"key": "k1abc", "shown": true, "why": "..."}], "feedback": "two sentences at most", "follow": ""}`;

// Recall: one multiple-choice question per key idea.
export const recallIdeas = (g) => g.ideas.filter((i) => i.kind === "key");
export function recallPrompt(map, g, ideas = recallIdeas(g)) {
  return [
    "Set a quick multiple-choice paper for me. " + about(map, g),
    "",
    "Write one question for each idea below (key | idea | what it is).",
    "- Test whether I understand the idea, not whether I recognise its name: ask what it means, does or implies, and keep the idea's own title out of the correct option.",
    "- Four options, exactly one correct. Put the correct one FIRST; the page shuffles them. The wrong ones must be plausible, clearly wrong to someone who knows it, and about as long as the right one.",
    "- Question under 200 characters, each option under 110. No diagrams, no calculator needed.",
    "",
    "Reply with only a JSON array, one object per idea, in the order given:",
    `[{"key": "k1abc", "q": "...", "options": ["correct", "wrong", "wrong", "wrong"]}]`,
    "",
    sheet(ideas),
  ].join("\n");
}
export function readRecall(value, g) {
  const ideas = new Map(recallIdeas(g).map((i) => [i.key, i])), out = [], seen = new Set();
  for (const x of Array.isArray(value) ? value : value?.questions || []) {
    const idea = ideas.get(x?.key), opts = Array.isArray(x?.options) ? x.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
    if (!idea || seen.has(idea.key) || !String(x.q || "").trim() || opts.length !== 4 || new Set(opts.map((o) => o.toLowerCase())).size !== 4) continue;
    seen.add(idea.key); out.push({ key: idea.key, title: idea.title, q: String(x.q).trim(), options: opts });
  }
  return out;
}
// The order the options are shown in; the correct one is options[0].
export function shuffle(n, rnd = Math.random) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Explain: an adaptive oral, like an interviewer. Claude asks one question at a time, read aloud, keeps a private
// tally of what I've shown, probes what I haven't and pushes "why" on shaky answers, and stops when it has
// covered the section. Nothing is marked until the end, in its own call over the whole transcript.
export const ORAL_MAX = 12;
export const explainIdeas = (g) => g.ideas.filter((i) => i.kind !== "apply");
export const oralOpen = (g) => `Tell me about ${g.name}. What is it about, and how do its main ideas fit together?`;
const transcript = (turns, photos = 0) => turns.map((t, k) => {
  const last = k === turns.length - 1, hand = last ? photos : 0;
  const a = hand ? answerText(t.a, hand) : t.read ? `My answer was handwritten; it read: "${t.read}"${t.a ? "\n" + answerText(t.a) : ""}` : t.a ? answerText(t.a) : "My answer: (nothing)";
  return `Question ${k + 1}: ${t.q}\n${a}`;
}).join("\n\n");
export function oralPrompt(map, g, turns, { photos = 0, shown = [] } = {}) {
  const n = turns.length, last = n >= ORAL_MAX;
  return [
    "Interview me: an adaptive oral exam. " + about(map, g),
    "I'm a graduate mapping what I already know, not sitting a real exam. The ideas below are what the section covers. Find out which of them I really understand.",
    "",
    "How to interview:",
    "- One question at a time, under 30 words, in plain spoken English. It is read aloud, so no symbols, formulas, lists or markdown.",
    "- Start broad, then narrow onto ideas I haven't shown. When an answer is vague, shaky or only names something, ask why or how, or for an example.",
    "- Never give an answer away, hint at what an idea says, or tell me whether I was right. No praise, marks or feedback.",
    "- If I say I don't know, or stay stuck, move on to another part of the section.",
    `- Cover the whole section in about 6 to ${ORAL_MAX} questions. Stop when every idea is shown or has been probed and missed.`,
    "- A spoken answer comes through dictation: ignore mis-heard words, filler and loose grammar when the meaning is clear. A handwritten one comes as photos.",
    "",
    "Reply with only JSON in this shape:",
    `{"read": "", "shown": ["k1abc"], "next": "...", "done": false}`,
    `- "read": if my latest answer is handwritten in the attached photo${photos === 1 ? "" : "s"}, what it says in under 600 characters; else "".`,
    `- "shown": the keys of every idea I've shown so far in the whole interview: stated or used correctly, not merely named.${shown.length ? " Last time you had: " + shown.join(", ") + "." : ""}`,
    last ? `- This was question ${n}, the last: "done": true, "next": "".` : `- "next": the next question; "done": true and "next": "" when you have enough. This was question ${n} of at most ${ORAL_MAX}.`,
    "",
    "The ideas (key | idea | what it is):",
    sheet(explainIdeas(g)),
    "",
    transcript(turns, photos),
  ].join("\n");
}
export function readOral(value, g) {
  const keys = new Set(explainIdeas(g).map((i) => i.key));
  const next = String(value?.next || "").trim().slice(0, 400);
  return {
    read: String(value?.read || "").trim().slice(0, 800),
    shown: [...new Set((Array.isArray(value?.shown) ? value.shown : []).filter((k) => keys.has(k)))],
    next, done: value?.done === true || !next,
  };
}
export function oralMarkPrompt(map, g, turns) {
  return [
    "Mark my oral exam. " + about(map, g),
    "An examiner interviewed me on the section, one question at a time; the transcript is below.",
    "",
    STRICT,
    `- Include every idea in "marks", in the order given. Credit an idea shown anywhere in the interview.`,
    `- "feedback": how I did overall and what to work on, two sentences at most. "follow": "".`,
    "",
    MARKS,
    "",
    "The ideas (key | idea | what it is):",
    sheet(explainIdeas(g)),
    "",
    transcript(turns),
  ].join("\n");
}

// Apply: Claude sets a problem per idea, then marks my working.
export const applyIdeas = (g) => g.ideas.filter((i) => i.kind === "apply");
export function applySetPrompt(map, g, ideas = applyIdeas(g)) {
  return [
    "Set problems for me. " + about(map, g),
    "",
    "Write one problem for each idea below (key | idea | what it is).",
    "- Each must make me USE the idea: a short calculation with the numbers given, or a concrete situation to handle. Not a definition question.",
    "- Doable in two to four minutes, spoken aloud or on one sheet of paper. Give any constants needed.",
    "- \"guide\" is the worked answer, or what a good answer must include, in under 60 words. I don't see it.",
    "",
    "Reply with only a JSON array, in the order given:",
    `[{"key": "k1abc", "q": "...", "guide": "..."}]`,
    "",
    sheet(ideas),
  ].join("\n");
}
export function readProblems(value, g) {
  const ideas = new Map(applyIdeas(g).map((i) => [i.key, i])), out = [], seen = new Set();
  for (const x of Array.isArray(value) ? value : value?.problems || []) {
    const idea = ideas.get(x?.key); if (!idea || seen.has(idea.key) || !String(x.q || "").trim()) continue;
    seen.add(idea.key); out.push({ key: idea.key, title: idea.title, q: String(x.q).trim(), guide: String(x.guide || "").trim() });
  }
  return out;
}
export function applyMarkPrompt(map, g, problems, text, { photos = 0 } = {}) {
  return [
    "Mark my answers to these problems. " + about(map, g),
    "",
    STRICT,
    "- A problem's idea is shown when my method is right and I reach the answer, allowing a small slip in arithmetic. A right number with no method doesn't show it.",
    `- "marks" has one entry per problem, in order. "follow": "".`,
    "",
    MARKS,
    "",
    "The problems:",
    ...problems.map((p, k) => `${k + 1}. key ${p.key} (${p.title})\n   ${p.q}\n   Marking guide: ${p.guide}`),
    "",
    answerText(text, photos),
  ].join("\n");
}

// Connect: how two ideas I've shown are related.
export function connectPairs(map, known, marks = {}) {
  return map.links.filter((l) => known(ideaKey(l.a)) && known(ideaKey(l.b))).map((l) => ({ key: linkKey(l.a, l.b), a: l.a, b: l.b, label: l.label, done: !!marks.links?.[linkKey(l.a, l.b)] }));
}
export function connectMarkPrompt(map, pairs) {
  return [
    "Mark how well I connected pairs of ideas. " + about(map),
    "For each pair I was asked how the two are connected.",
    "",
    STRICT,
    "- A connection is shown when I give a correct, real relationship between the two. It needn't be the one in the guide, but it must be more than \"they're related\".",
    `- "marks" has one entry per pair, in order. "follow": "".`,
    "",
    MARKS,
    "",
    ...pairs.map((p, k) => `${k + 1}. key ${p.key}: ${p.a} and ${p.b}\n   Guide: ${p.label || "any sound connection"}\n   I said: ${String(p.answer || "").trim().slice(0, 1500) || "(nothing)"}`),
  ].join("\n");
}

// Reads a marking reply against the keys that were asked about. Anything not marked counts as not shown.
export function readMarks(value, keys) {
  const got = new Map();
  for (const m of Array.isArray(value?.marks) ? value.marks : []) if (m && keys.includes(m.key) && !got.has(m.key)) got.set(m.key, { shown: m.shown === true, why: String(m.why || "").trim().slice(0, 200) });
  return {
    marks: keys.map((key) => ({ key, shown: false, why: "", ...got.get(key) })),
    feedback: String(value?.feedback || "").trim().slice(0, 600), follow: String(value?.follow || "").trim().slice(0, 300),
  };
}
