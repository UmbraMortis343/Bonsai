// Exams: a topic's map of ideas, drafted from a syllabus, is sat as papers on the Bonsai Exams page
// (a page inside Claude). The page exports what was shown; the app reads that and adds the ideas:
// shown ones as real ideas, the rest greyed until a re-sit shows them.
// Pure logic, no browser needed. The exams page is built from this same file (tools/exams/build.mjs).
//
// A map, as text:
//   map: physics-igcse        its id          topic: Physics       tier: IGCSE
//   order: 1                  tiers in order  source: Cambridge IGCSE Physics (0625)
//   graph: Forces             starts a knowledge graph
//   Forces | short note       an idea; indenting strings it to the idea above it
//     ! Using F = ma | note   an idea you show by doing (the Apply level)
//   link: Idea -> Idea | label    a connection across the strings, to this tier or an earlier one

export const LEVELS = ["Recall", "Explain", "Apply", "Connect"];
export const EXAM_TAG = "bonsaiExam";

export const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
// A short stable name for an idea, safe as a field name whatever its title holds.
export function ideaKey(title) { let h = 5381; for (const c of norm(title)) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return "k" + h.toString(36); }
export const linkKey = (a, b) => ideaKey(a) + "_" + ideaKey(b);
const text = (x, max) => (typeof x === "string" || typeof x === "number" ? String(x).trim().slice(0, max) : "");

// Reads a map. Each idea: { key, title, note, depth, parent (key or null), kind: "key" | "fine" | "apply" }.
// Key ideas are a graph's first idea and the ones hanging straight off it.
export function readMap(src) {
  const map = { id: "", topic: "", tier: "", order: 0, source: "", graphs: [], links: [], bad: [] };
  let g = null, indents = [], stack = [];
  for (const raw of String(src || "").replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/\t/g, "  "), body = line.trim();
    if (!body || body.startsWith("#")) continue;
    const head = body.match(/^(map|topic|tier|order|source|graph|link):\s*(.*)$/);
    if (head && head[1] === "graph") { g = { name: text(head[2], 80), ideas: [] }; map.graphs.push(g); indents = []; stack = []; continue; }
    if (head && head[1] === "link") {
      const m = head[2].match(/^(.+?)\s+->\s+(.+?)(?:\s*\|\s*(.*))?$/);
      if (m) map.links.push({ a: m[1].trim(), b: m[2].trim(), label: text(m[3], 60) }); else map.bad.push(body);
      continue;
    }
    if (head && !g) { if (head[1] === "order") map.order = Number(head[2]) || 0; else map[head[1] === "map" ? "id" : head[1]] = text(head[2], 120); continue; }
    if (!g) { map.bad.push(body); continue; }
    const width = line.length - line.trimStart().length;
    while (indents.length && indents.at(-1) >= width) { indents.pop(); stack.pop(); }
    const apply = body.startsWith("!"), [title, note = ""] = body.replace(/^!\s*/, "").split(/\s*\|\s*(.*)/s);
    if (!title.trim() || (!stack.length && g.ideas.length)) { map.bad.push(body); continue; }   // a graph starts from one idea
    const depth = stack.length, idea = { key: ideaKey(title), title: text(title, 140), note: text(note, 500), depth, parent: stack.at(-1) || null, kind: apply ? "apply" : depth <= 1 ? "key" : "fine" };
    g.ideas.push(idea); indents.push(width); stack.push(idea.key);
  }
  map.graphs = map.graphs.filter((x) => x.ideas.length);
  return map;
}

// What's wrong with a set of maps for one topic: ideas named twice, links to nowhere. Empty when sound.
export function checkMaps(maps) {
  const out = [], seen = new Map();
  for (const m of [...maps].sort((a, b) => a.order - b.order)) {
    if (!m.id || !m.topic || !m.tier) out.push(`${m.id || "?"}: needs map, topic and tier`);
    for (const line of m.bad) out.push(`${m.id}: can't read "${line}"`);
    for (const g of m.graphs) for (const i of g.ideas) { if (seen.has(i.key)) out.push(`${m.id}: "${i.title}" is already in ${seen.get(i.key)}`); else seen.set(i.key, m.id); }
    for (const l of m.links) for (const t of [l.a, l.b]) if (!seen.has(ideaKey(t))) out.push(`${m.id}: link to "${t}", which isn't in this tier or an earlier one`);
  }
  return out;
}

// How far each paper has got. marks: { ideas: { key: level }, links: { linkKey: 1 } } for this map;
// known(key) says whether an idea is shown in any tier (links reach back to earlier ones).
export function progress(map, marks = {}, known = (k) => (marks.ideas?.[k] || 0) > 0) {
  const lv = (k) => marks.ideas?.[k] || 0, count = (list, test) => ({ of: list.length, n: list.filter(test).length });
  const graphs = map.graphs.map((g) => ({
    name: g.name,
    recall: count(g.ideas.filter((i) => i.kind === "key"), (i) => lv(i.key) >= 1),
    explain: count(g.ideas.filter((i) => i.kind !== "apply"), (i) => lv(i.key) >= 2),
    apply: count(g.ideas.filter((i) => i.kind === "apply"), (i) => lv(i.key) >= 3),
  }));
  const ready = map.links.filter((l) => known(ideaKey(l.a)) && known(ideaKey(l.b)));
  const ideas = map.graphs.flatMap((g) => g.ideas);
  return { graphs, connect: { of: map.links.length, ready: ready.length, n: map.links.filter((l) => marks.links?.[linkKey(l.a, l.b)]).length }, shown: ideas.filter((i) => lv(i.key) > 0).length, of: ideas.length };
}

// What the page hands to the app: every idea of the chosen tiers with the level it was shown at (0 = not yet).
export function exportExam(maps, marksById, at = new Date().toISOString()) {
  const tiers = [...maps].sort((a, b) => a.order - b.order);
  return {
    [EXAM_TAG]: 1, at, topic: tiers[0]?.topic || "",
    tiers: tiers.map((m) => ({
      id: m.id, tier: m.tier, order: m.order, source: m.source,
      graphs: m.graphs.map((g) => ({ name: g.name, ideas: g.ideas.map((i) => ({ t: i.title, n: i.note, d: i.depth, ...(i.kind === "apply" ? { a: 1 } : {}), l: marksById[m.id]?.ideas?.[i.key] || 0 })) })),
      links: m.links.map((l) => ({ a: l.a, b: l.b, label: l.label, l: marksById[m.id]?.links?.[linkKey(l.a, l.b)] ? 4 : 0 })),
    })),
  };
}

// Checks a pasted or loaded export and returns it tidied.
export function readExam(input) {
  let d = input;
  if (typeof d === "string") { try { d = JSON.parse(d.slice(d.indexOf("{"), d.lastIndexOf("}") + 1)); } catch { d = null; } }
  if (!d || d[EXAM_TAG] !== 1 || !Array.isArray(d.tiers)) throw new Error("That isn't a Bonsai exam.");
  const level = (x) => Math.max(0, Math.min(4, Math.floor(Number(x) || 0)));
  const tiers = d.tiers.filter((t) => t && Array.isArray(t.graphs)).map((t) => ({
    id: text(t.id, 60), tier: text(t.tier, 60), order: Number(t.order) || 0, source: text(t.source, 120),
    graphs: t.graphs.filter((g) => g && text(g.name, 80) && Array.isArray(g.ideas)).map((g) => ({
      name: text(g.name, 80),
      ideas: g.ideas.filter((i) => i && text(i.t, 140)).map((i) => ({ title: text(i.t, 140), note: text(i.n, 500), depth: Math.max(0, Math.floor(Number(i.d) || 0)), apply: !!i.a, level: level(i.l) })),
    })).filter((g) => g.ideas.length),
    links: (Array.isArray(t.links) ? t.links : []).filter((l) => l && text(l.a, 140) && text(l.b, 140)).map((l) => ({ a: text(l.a, 140), b: text(l.b, 140), label: text(l.label, 60), level: level(l.l) })),
  })).filter((t) => t.graphs.length).sort((a, b) => a.order - b.order);
  if (!tiers.length) throw new Error("That exam is empty.");
  return { topic: text(d.topic, 80) || "Exam", at: text(d.at, 40), tiers };
}

// Works out what an exam adds to a topic. trees, nodes and links are the topic's own (links: any touching it).
// Ideas already there (by title) are kept as they are; a greyed one that has now been shown wakes up.
// Returns { trees, nodes, wake, raise, links, counts } in the shape store.importExam takes.
export function planExam(exam, { trees = [], nodes = [], links = [] } = {}) {
  let k = 0; const fresh = () => "x" + ++k;
  const out = { trees: [], nodes: [], wake: [], raise: [], links: [], counts: { shown: 0, greyed: 0, woken: 0, links: 0, graphs: 0 } };
  const have = new Map(); for (const n of nodes) if (!have.has(norm(n.title))) have.set(norm(n.title), n);
  const ref = new Map();   // title → an existing idea's id, or the key of one this plan makes
  const upOf = new Map(nodes.map((n) => [n.id, n.parentId])), pair = (a, b) => [a, b].sort().join(" ");
  const joined = new Set([...links.map((l) => pair(l.fromId, l.toId)), ...nodes.filter((n) => n.parentId).map((n) => pair(n.parentId, n.id))]);
  for (const t of exam.tiers) {
    for (const g of t.graphs) {
      const tree = trees.find((x) => norm(x.name) === norm(g.name)); const chain = [];
      for (const i of g.ideas) {
        chain.length = i.depth;
        const old = have.get(norm(i.title)), stamp = { map: t.id, tier: t.tier, level: i.level, ...(i.apply ? { apply: true } : {}) };
        let at;
        if (old) {
          at = old.id;
          if (old.ghost && i.level) { out.wake.push({ id: old.id, exam: stamp }); out.counts.woken++; }
          else if (!old.ghost && old.exam && i.level > (old.exam.level || 0)) out.raise.push({ id: old.id, exam: { ...old.exam, level: i.level } });
        } else if (ref.has(norm(i.title))) at = ref.get(norm(i.title));
        else {
          at = fresh(); const row = { key: at, title: i.title, note: i.note, ghost: !i.level, exam: stamp };
          const parent = chain[i.depth - 1] ?? (tree ? tree.rootId : null);
          if (parent == null) { out.trees.push({ ...row, root: at, name: g.name, tier: t.tier }); out.counts.graphs++; }
          else { out.nodes.push({ ...row, parent }); upOf.set(at, parent); }
          out.counts[i.level ? "shown" : "greyed"]++;
        }
        ref.set(norm(i.title), at); chain[i.depth] = at;
      }
    }
    for (const l of t.links) {
      if (!l.level) continue;
      const a = ref.get(norm(l.a)) ?? have.get(norm(l.a))?.id, b = ref.get(norm(l.b)) ?? have.get(norm(l.b))?.id;
      if (!a || !b || a === b || joined.has(pair(a, b)) || upOf.get(a) === b || upOf.get(b) === a) continue;
      joined.add(pair(a, b)); out.links.push({ from: a, to: b, label: l.label }); out.counts.links++;
    }
  }
  return out;
}
