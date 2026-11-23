// Discuss with Claude, pure logic: the prompt for each turn of a conversation about a note page or words picked in it.
// Bonsai Desktop asks Claude Code with no saved session, so every turn carries the whole conversation, the words
// and the page (trimmed to fit). Conversations are kept per page in meta "talk:<pageId>" (main.js), which syncs.
// talk { id, at, quote, blockIds, whole, turns: [{ who: "you" | "claude", text, at }] }
export const TALK_SYSTEM = "You are a study partner inside Bonsai, a notes and knowledge-retention app. The person is reading their own notes and wants to understand them. Write plainly and briefly, to them as \"you\". Short paragraphs or a short list; Markdown is fine (bold, lists, inline code), no big headings, no preamble or sign-off.";
export const PAGE_MAX = 12000, QUOTE_MAX = 4000, TURN_MAX = 4000, TALK_MAX = 24000, TALKS_KEPT = 60;

const clip = (s, n) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n).trimEnd() + " …" : s; };
const squash = (s) => String(s || "").replace(/\s+/g, " ").trim();
// The page, cut down to about max characters around the words picked (or from its start).
export function trimAround(page, quote = "", max = PAGE_MAX) {
  page = String(page || "");
  if (page.length <= max) return page;
  const probe = squash(quote).slice(0, 40), flat = page.replace(/\s+/g, " ");
  let at = probe ? flat.indexOf(probe) : -1;
  if (at < 0 && probe) at = flat.toLowerCase().indexOf(probe.toLowerCase());
  if (at < 0) return page.slice(0, max).trimEnd() + "\n…";
  // map the place in the squashed text back to the page (whitespace runs count once)
  let i = 0, j = 0; while (i < page.length && j < at) { if (/\s/.test(page[i])) { while (i + 1 < page.length && /\s/.test(page[i + 1])) i++; } i++; j++; }
  const start = Math.max(0, Math.min(page.length - max, i - Math.floor(max / 2)));
  return (start > 0 ? "…\n" : "") + page.slice(start, start + max).trim() + (start + max < page.length ? "\n…" : "");
}
// Earlier turns, kept under TALK_MAX: the first reply and the latest ones stay, the middle goes first.
export function transcript(turns, max = TALK_MAX) {
  const said = (turns || []).filter((t) => t && String(t.text || "").trim()).map((t) => `${t.who === "you" ? "Me" : "You"}: ${clip(t.text, TURN_MAX)}`);
  const keep = said.slice(), size = () => keep.join("\n\n").length; let cut = false;
  while (keep.length > 3 && size() > max) { keep.splice(cut ? 2 : 1, 1); if (!cut) { keep.splice(1, 0, "(…)"); cut = true; } }
  return keep.join("\n\n");
}
// The message for the next turn. With no turns yet, Claude opens: explains, connects, finds gaps, asks one question.
export function talkPrompt({ title = "", page = "", quote = "", whole = false, turns = [] } = {}) {
  const part = whole ? "this page" : "the part I picked out";
  const out = [`My notes page "${title || "Untitled"}":\n<page>\n${trimAround(page, quote) || "(empty)"}\n</page>`];
  if (!whole && quote) out.push(`The part I picked out:\n<selection>\n${clip(quote, QUOTE_MAX)}\n</selection>`);
  const said = (turns || []).filter((t) => String(t?.text || "").trim());
  if (!said.length) {
    out.push(`Help me understand and think about ${part}: explain anything unclear, connect it to what else is on the page, point out gaps or mistakes, and end with one question I could test myself with. Keep it concise and plain, and write to me as "you".`);
  } else {
    out.push(`Our conversation so far (you opened by going through ${part} with me):\n<conversation>\n${transcript(said)}\n</conversation>`);
    out.push(`Reply to my last message. Keep it short and plain, written to me as "you".`);
  }
  return out.join("\n\n");
}
// The prompt for claude.ai, when there's no Bonsai Desktop: the same opening, as one message to paste.
export const pastePrompt = (o) => talkPrompt({ ...o, turns: [] });
export const talkId = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const lastAt = (t) => t.turns?.at(-1)?.at || t.at || "";
// newest first, at most TALKS_KEPT
export const sortTalks = (list) => (list || []).slice().sort((a, b) => lastAt(b).localeCompare(lastAt(a))).slice(0, TALKS_KEPT);
