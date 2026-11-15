// Notes: pages written per topic (lectures, reading) before anything goes into a knowledge graph.
// Growing a page goes through Claude: the app copies a prompt with the page and the topic's ideas,
// Claude replies in the small format below, and the reply is pasted back and read here.
// Pure logic, no browser needed.
//
// Reply format, one block in a code fence:
//   graph: Name              add to the topic's graph of that name, or start a new one
//   Idea | short note        an idea; indenting strings it to the idea above it
//     > fuller note          lines kept as the idea's notes
//   = Existing idea          an idea already in the topic; what's indented under it strings to it
//   link: Idea -> Idea | label    any other connection

export const GROW_TAG = "bonsai grow";
const MAX_IDEAS_SHOWN = 600;   // the topic's ideas listed in the prompt, so Claude can reuse them

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

// The topic's graphs as indented title outlines, for the prompt.
function outline(trees, nodes) {
  const kids = new Map(); for (const n of nodes) { const k = n.parentId ?? ""; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(n); }
  for (const l of kids.values()) l.sort((a, b) => a.order - b.order);
  let left = MAX_IDEAS_SHOWN; const out = [];
  for (const t of trees) {
    out.push(`graph: ${t.name}`);
    const walk = (id, d) => { if (left-- <= 0) return; const n = nodes.find((x) => x.id === id); if (!n) return; out.push("  ".repeat(d) + n.title); for (const c of kids.get(id) || []) walk(c.id, d + 1); };
    walk(t.rootId, 0); out.push("");
  }
  return out.join("\n").trim();
}

// What Claude is given. grownTitles: ideas earlier grows of this page already made.
export function growPrompt({ topic, page, trees = [], nodes = [], grownTitles = [] }) {
  const have = outline(trees, nodes);
  return [
    `Turn my notes into ideas for my knowledge graphs in Bonsai, a knowledge-retention app. The topic is "${topic}".`,
    "",
    "An idea is one concept, fact, method or question worth remembering. Ideas are strung together: each new idea hangs off the idea it most directly builds on. Other connections are links.",
    "",
    "Rules:",
    "- Titles short (under 60 characters). Short note: one plain sentence saying what it is (under 140 characters).",
    "- Keep details from my notes that are worth reviewing (definitions, formulas, examples, steps) as \"> \" lines under a new idea. Leave out logistics, admin and filler.",
    "- Don't repeat ideas I already have. To hang new ideas off one of mine, write \"= \" and its exact title, then indent the new ideas under it.",
    "- Add to one of my graphs when the notes fit it; start a new graph (a new name after \"graph:\") only for a new area. The first idea of a new graph is where it starts.",
    "- Add \"link:\" lines for connections that cross the strings, including to my existing ideas.",
    "- Reply with only one code block, starting with the line \"" + GROW_TAG + "\", in exactly this format (the content here is only an example):",
    "",
    "```",
    GROW_TAG,
    "graph: Cells",
    "= Cell",
    "  Mitochondria | Organelles that release energy from food by respiration",
    "    > Has its own DNA; inner membrane folded into cristae",
    "    ATP | The molecule cells use to carry energy",
    "graph: Respiration",
    "Respiration | Releasing energy from glucose inside cells",
    "  Anaerobic respiration | Respiration without oxygen; makes lactic acid in muscles",
    "link: ATP -> Respiration | made by",
    "```",
    "",
    have ? "My graphs in this topic now:\n\n```\n" + have + "\n```" : "I have no graphs in this topic yet.",
    grownTitles.length ? "\nIdeas already made from this page before (don't add them again): " + grownTitles.join("; ") : "",
    "",
    `My notes, "${page.title || "Untitled"}":`,
    "",
    "```",
    String(page.text || "").trim(),
    "```",
  ].join("\n");
}

// Reads Claude's reply. Returns { graphs: [{ name, items: [{ depth, title, note, body, ref }] }], links: [{ a, b, label }], bad }.
export function readGrow(text) {
  let src = String(text || "").replace(/\r/g, "");
  const fence = src.match(/```[^\n]*\n([\s\S]*?)```/g);
  if (fence) { const pick = fence.find((f) => f.includes(GROW_TAG)) || fence[0]; src = pick.replace(/^```[^\n]*\n/, "").replace(/```$/, ""); }
  const graphs = [], links = []; let g = null, bad = 0, last = null;
  const indents = [];   // indent widths seen in this graph, so 2, 3 or 4 spaces all work
  for (const raw of src.split("\n")) {
    const line = raw.replace(/\t/g, "  ");
    const body = line.trim();
    if (!body || body.toLowerCase() === GROW_TAG) continue;
    let m;
    if ((m = body.match(/^(?:graph\s*:|#+)\s*(.+)$/i))) { g = { name: m[1].trim().slice(0, 80), items: [] }; graphs.push(g); indents.length = 0; last = null; continue; }
    if ((m = body.match(/^link\s*:\s*(.+?)\s*(?:->|→|—>|<->)\s*(.+?)(?:\s*\|\s*(.*))?$/i))) { links.push({ a: m[1].trim(), b: m[2].trim(), label: (m[3] || "").trim().slice(0, 60) }); continue; }
    if (body.startsWith(">")) { if (last && !last.ref) last.body += (last.body ? "\n" : "") + body.replace(/^>\s?/, ""); else bad++; continue; }
    if (!g) { g = { name: "", items: [] }; graphs.push(g); }
    const width = line.match(/^ */)[0].length;
    while (indents.length && indents[indents.length - 1] > width) indents.pop();
    if (!indents.length || indents[indents.length - 1] < width) indents.push(width);
    const depth = indents.length - 1;
    let item = body.replace(/^[-*•]\s+/, "");
    const ref = /^=\s*/.test(item); if (ref) item = item.replace(/^=\s*/, "");
    const [title, ...rest] = item.split("|");
    if (!title.trim()) { bad++; continue; }
    last = { depth, title: title.trim().slice(0, 140), note: rest.join("|").trim().slice(0, 500), body: "", ref };
    g.items.push(last);
  }
  return { graphs: graphs.filter((x) => x.items.length), links, bad };
}

// Works out what a reply adds to a topic. ctx: { trees (this topic's), nodes (this topic's), allNodes, links }.
// Returns { trees: [{ key, name, root }], nodes: [{ key, parent, title, note, body }], links: [{ from, to, label }], added, graphs }
// where parent / from / to are an existing idea's id or a new idea's key ("k1", ...), and a new tree's root is the key of its first idea.
export function planGrow(read, { trees = [], nodes = [], allNodes = nodes, links = [] }) {
  let k = 0; const key = () => "k" + ++k;
  const out = { trees: [], nodes: [], links: [], graphs: [] };
  const byTitle = (list, t) => list.find((n) => norm(n.title) === norm(t));
  const made = [];   // { key, title, treeKey }
  const pair = (a, b) => [a, b].sort().join(" ");
  const linked = new Set([...links.map((l) => pair(l.fromId, l.toId)), ...allNodes.filter((n) => n.parentId).map((n) => pair(n.parentId, n.id))]);   // strings count as connections already
  const addLink = (a, b, label = "") => { if (!a || !b || a === b) return; const id = pair(a, b); if (linked.has(id)) return; linked.add(id); out.links.push({ from: a, to: b, label }); };
  for (const g of read.graphs) {
    const tree = g.name && trees.find((t) => norm(t.name) === norm(g.name));
    const inTree = tree ? nodes.filter((n) => n.treeId === tree.id) : [];
    const treeKey = tree ? tree.id : key();
    let root = tree ? tree.rootId : null, count = 0, startLink = null;
    const stack = [];   // [{ depth, at }] where at is an id or key
    for (const it of g.items) {
      while (stack.length && stack[stack.length - 1].depth >= it.depth) stack.pop();
      const up = stack.length ? stack[stack.length - 1].at : root;
      // an idea already there (asked for with "=", or the same title in this graph) is reused, not made again
      const mine = made.find((x) => x.treeKey === treeKey && norm(x.title) === norm(it.title));
      const old = (it.ref ? byTitle(inTree, it.title) || byTitle(nodes, it.title) || byTitle(allNodes, it.title) : byTitle(inTree, it.title));
      const at = mine ? mine.key : old ? old.id : null;
      if (at) {
        const isParent = old && old.parentId === up;
        if (stack.length && up !== at && !isParent) addLink(up, at);   // a bare "= idea" is only where to hang things; nested under another, it's a connection
        stack.push({ depth: it.depth, at });
        if (!root && !tree) startLink = at;   // a new graph can't start on an idea from elsewhere; it's linked to its start instead
        continue;
      }
      const nk = key();
      if (!tree && !root) { root = nk; out.trees.push({ key: treeKey, name: g.name || it.title, root: nk, title: it.title, note: it.note, body: it.body }); if (startLink) addLink(nk, startLink); }
      else { out.nodes.push({ key: nk, parent: up || root, title: it.title, note: it.note, body: it.body }); linked.add(pair(up || root, nk)); }
      made.push({ key: nk, title: it.title, treeKey }); count++;
      stack.push({ depth: it.depth, at: nk });
    }
    if (count) out.graphs.push({ name: tree ? tree.name : g.name || out.trees.find((t) => t.key === treeKey)?.name, fresh: !tree, count });
  }
  // links name ideas by title: this reply's new ideas first, then the topic, then anywhere
  const find = (t) => made.find((x) => norm(x.title) === norm(t))?.key || byTitle(nodes, t)?.id || byTitle(allNodes, t)?.id;
  for (const l of read.links) addLink(find(l.a), find(l.b), l.label);
  out.added = out.trees.length + out.nodes.length;
  return out;
}

// One line for the dialog: "Mechanics +6 · Collisions (new) 3 · 2 links".
export function growSummary(plan) {
  const parts = plan.graphs.map((g) => `${g.name}${g.fresh ? " (new)" : ""} +${g.count}`);
  if (plan.links.length) parts.push(`${plan.links.length} link${plan.links.length === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
