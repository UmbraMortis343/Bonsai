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

// Explain: I talk through the section; Claude marks which ideas I showed and may ask one thing more.
export const explainIdeas = (g) => g.ideas.filter((i) => i.kind !== "apply");
export const explainCues = (g) => g.ideas.filter((i) => i.kind === "key" && i.depth === 1).map((i) => i.title);
export function explainPrompt(map, g, turns, { photos = 0, follows = 0, had = [] } = {}) {
  const said = turns.map((t, k) => (t.q ? `You asked: ${t.q}\n` : "") + answerText(t.a, k === turns.length - 1 ? photos : 0)).join("\n\n");
  return [
    "Mark my oral exam answer. " + about(map, g),
    "I was asked to talk through the section in my own words, without notes.",
    "",
    STRICT,
    `- Include every idea in "marks", in the order given.`,
    follows > 0
      ? `- "follow": one short question probing one or two ideas I haven't shown, without giving the answer away. "" if I've shown them all.`
      : `- "follow": "".`,
    had.length ? `- I showed these in an earlier answer; mark them shown and don't ask about them again: ${had.join(", ")}.` : "",
    "",
    MARKS,
    "",
    "The ideas (key | idea | what it is):",
    sheet(explainIdeas(g)),
    "",
    said,
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
