// Focus levels, pure. An island sets the level of its topics; a topic can keep its own.
//   focus:   normal intervals (this term's subjects)
//   keep:    intervals about twice as long
//   settled: intervals four times as long, left out of the day's 10 (a rare bonus question), always lush on the garden
// Stored in the garden meta: `islands[i].level` and `zone[id].level` ("isle" for a topic told to follow its island
// when it would otherwise start at its own default). An exam topic starts at Keep.
// The stretch is worked out when an idea's due date is read (srs.dueAt with `mult`), not saved on the idea, so
// moving a topic to another level moves its ideas' dates at once and nothing has to be rewritten.
export const LEVELS = ["focus", "keep", "settled"];
export const NAMES = { focus: "Focus", keep: "Keep", settled: "Settled" };
// Levels only stretch the schedule now: what's overdue no longer dries the garden (2026-11-25, his call: Today picks
// the questions, so a backlog isn't his doing). The garden follows how his answers go (strength.js).
const SPEC = {
  focus: { mult: 1 },
  keep: { mult: 2 },
  settled: { mult: 4 },
};
export const isLevel = (v) => LEVELS.includes(v);
const isleOf = (zoneId, garden) => (garden?.islands || []).find((q) => (q.zoneIds || []).includes(zoneId));
// The island's own level (Focus when none is set).
export const isleLevel = (isl) => (isLevel(isl?.level) ? isl.level : "focus");
// The topic's own level, or null when it follows its island. exam: the topic holds graphs from an exam import.
export function ownLevel(zoneId, garden, exam = false) {
  const v = garden?.zone?.[zoneId]?.level;
  if (isLevel(v)) return v;
  return v !== "isle" && exam ? "keep" : null;
}
export const levelOf = (zoneId, garden, exam = false) => ownLevel(zoneId, garden, exam) || isleLevel(isleOf(zoneId, garden));
export const multOf = (level) => SPEC[level]?.mult ?? 1;
// Every topic's level at once: Map zoneId → level. exams: Set of zone ids holding exam graphs.
export function levelMap(garden, zoneIds, exams = new Set()) {
  const m = new Map();
  for (const id of zoneIds) m.set(id, levelOf(id, garden, exams.has(id)));
  return m;
}
// Sets a level in the garden (mutates it). zoneId null: the island's. level null: a topic follows its island again.
export function setLevel(garden, { isleId, zoneId, level, exam = false }) {
  if (zoneId) {
    const o = (garden.zone ||= {})[zoneId] ||= {};
    if (isLevel(level)) o.level = level;
    else if (exam) o.level = "isle";
    else delete o.level;
    return garden;
  }
  const isl = (garden.islands || []).find((q) => q.id === isleId);
  if (isl) { if (isLevel(level) && level !== "focus") isl.level = level; else delete isl.level; }
  return garden;
}
// Due ideas split by level, oldest first in each. items: [{ node, level, due }] already found due.
export function byLevel(items) {
  const out = { focus: [], keep: [], settled: [] };
  for (const it of [...items].sort((a, b) => a.due - b.due)) (out[it.level] || out.focus).push(it.node);
  return out;
}
