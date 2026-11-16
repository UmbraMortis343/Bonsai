// Pure logic: the 3D layout keeps ideas apart and above ground, review
// scheduling, and the Markdown renderer's safety.
import { layoutTree, layoutRings, layoutTiers, crowding, nodeRadius } from "../src/layout.js";
import * as srs from "../src/srs.js";
import { md } from "../src/md.js";

let failed = false;
const ok = (c, m) => { if (!c) { console.error("FAIL run09:", m); failed = true; } };
const at = "2026-01-01T00:00:00.000Z";
const nodes = [{ id: "r", parentId: null, order: 1, createdAt: at }];
let n = 0;
const grow = (parent, depth) => { if (depth > 3) return; for (let i = 0; i < (depth === 1 ? 5 : 3); i++) { const id = "n" + n++; nodes.push({ id, parentId: parent, order: i, createdAt: at }); grow(id, depth + 1); } };
grow("r", 1);
const L = layoutTree(nodes, "r"), P = [...L.pos.values()];
ok(P.length === nodes.length, "every idea has a place");
ok(P.every((p) => p[1] > 0.5), "an idea is at or below the ground");
ok(L.pos.get("r")[0] === 0 && L.pos.get("r")[2] === 0, "the stem isn't upright");
let closest = Infinity;
for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) closest = Math.min(closest, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]));
ok(closest > 0.3, `two ideas are almost on top of each other (${closest.toFixed(2)})`);
ok(JSON.stringify([...layoutTree(nodes, "r").pos]) === JSON.stringify([...L.pos]), "layout changes between runs");
ok(P.every((p) => Math.hypot(p[0] - L.center[0], p[1] - L.center[1], p[2] - L.center[2]) <= L.radius), "bounds don't contain the tree");

// Links inside a graph are straight bonds: over many graphs of every shape, no bond (or stick) may pass through an idea
// it doesn't join, two ideas never touch, and the same graph always settles the same way.
let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const random = (count, links) => {
  const ns = [{ id: "r", parentId: null, order: 0, createdAt: at }];
  for (let i = 1; i < count; i++) ns.push({ id: "n" + i, parentId: ns[Math.floor(Math.pow(rnd(), 0.7) * ns.length)].id, order: i, createdAt: at });
  const ls = []; for (let i = 0; i < links; i++) { const a = ns[Math.floor(rnd() * count)].id, b = ns[Math.floor(rnd() * count)].id; if (a !== b) ls.push({ a, b }); }
  return [ns, ls];
};
let crowded = 0, touching = 0, bonds = 0, slow = 0;
for (let k = 0; k < 250; k++) {
  const count = 3 + Math.floor(rnd() * (k % 10 ? 40 : 150)), [ns, ls] = random(count, Math.floor(rnd() * Math.max(1, count / 4)));
  const t0 = Date.now(), G = layoutTree(ns, "r", ls); slow = Math.max(slow, Date.now() - t0); bonds += G.bonds.length;
  if (crowding(G) || G.tight) crowded++;
  const Q = [...G.pos];
  for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) if (Math.hypot(Q[i][1][0] - Q[j][1][0], Q[i][1][1] - Q[j][1][1], Q[i][1][2] - Q[j][1][2]) < nodeRadius(G.size.get(Q[i][0]), Q[i][0] === "r") + nodeRadius(G.size.get(Q[j][0]), Q[j][0] === "r") + 0.1) touching++;
  if (Q.some(([, p]) => p.some((v) => !isFinite(v)) || p[1] < 0.7)) ok(false, "an idea is nowhere, or under its disc");
}
ok(bonds > 500 && crowded === 0, `a bond passes through an idea in ${crowded} of 250 graphs (${bonds} bonds)`);
ok(touching === 0, `${touching} pairs of ideas touch`);
ok(slow < 1500, `a graph took ${slow} ms to settle`);
const [ns, ls] = random(40, 8);
ok(JSON.stringify([...layoutTree(ns, "r", ls).pos]) === JSON.stringify([...layoutTree(ns, "r", ls).pos]), "a linked graph settles differently between runs");
const chain = [{ id: "r", parentId: null, order: 0, createdAt: at }, { id: "a", parentId: "r", order: 0, createdAt: at }, { id: "b", parentId: "a", order: 0, createdAt: at }];
ok(layoutTree(chain, "r", [{ a: "r", b: "a" }, { a: "b", b: "b" }]).bonds.length === 0, "a link along a stick, or to itself, became a bond");

// Ideas moved by hand stay exactly where they were put, and the rest still settles clear of every bond around them
// (bar the odd case where two things were pinned into each other, which is the mover's choice).
let moved = 0, jammed = 0;
for (let k = 0; k < 200; k++) {
  const count = 4 + Math.floor(rnd() * 40), [ps, pl] = random(count, Math.floor(count / 5)), pins = new Map();
  for (let j = 0; j < 1 + Math.floor(rnd() * 3); j++) { const c = ps[1 + Math.floor(rnd() * (count - 1))]; c.pin = [(rnd() - 0.5) * 10, 0.75 + rnd() * 6, (rnd() - 0.5) * 10]; pins.set(c.id, c.pin); }
  const G = layoutTree(ps, "r", pl);
  for (const [id, pin] of pins) { const q = G.pos.get(id); if (Math.hypot(q[0] - pin[0], q[1] - pin[1], q[2] - pin[2]) > 1e-9 || !G.pinned.has(id)) moved++; }
  if (crowding(G)) jammed++;
  if ([...G.pos.values()].some((q) => q.some((v) => !isFinite(v)))) ok(false, "an idea is nowhere after pinning");
}
ok(moved === 0, `${moved} pinned ideas were moved by the layout`);
ok(jammed <= 12, `${jammed} of 200 pinned graphs are left with a bond through an idea`);
{ const [ps] = random(12, 0), kid = ps.find((n) => n.parentId === "n1") || ps[2], par = ps.find((n) => n.id === kid.parentId), free = layoutTree(ps, "r").pos.get(kid.id).slice();
  par.pin = [6, 3, 6]; const q = layoutTree(ps, "r").pos.get(kid.id);
  ok(par.id === "r" || Math.hypot(q[0] - free[0], q[2] - free[2]) > 2, "what hangs from a moved idea didn't come along"); }

// Rings: a topic's graphs sit round its name, all the same way out; an island's topics round the island's; nothing overlaps.
const isle = { id: "isle", kind: "isle", kids: [{ id: "a", kind: "topic", kids: [{ id: "t1", kind: "graph", r: 4 }, { id: "t2", kind: "graph", r: 3 }, { id: "t3", kind: "graph", r: 5 }] }, { id: "b", kind: "topic", kids: [{ id: "t4", kind: "graph", r: 2 }] }, { id: "c", kind: "topic", kids: [] }] };
const F = layoutRings(isle).at, far = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
const za = F.get("a"), zb = F.get("b"), zc = F.get("c"), mid = F.get("isle");
ok(far(za, zb) > za.r + zb.r && far(za, zc) > za.r + zc.r && far(zb, zc) > zb.r + zc.r, "topics overlap");
ok(Math.abs(far(za, mid) - far(zb, mid)) < 1e-6 && Math.abs(far(zc, mid) - far(zb, mid)) < 1e-6 && far(za, mid) > 2, "topics aren't on one ring round the island's name");
const d1 = far(F.get("t1"), za), d2 = far(F.get("t2"), za), d3 = far(F.get("t3"), za);
ok(Math.abs(d1 - d2) < 1e-6 && Math.abs(d1 - d3) < 1e-6 && d1 > 5, "a topic's graphs aren't on one ring round its name");
ok(far(F.get("t1"), F.get("t3")) >= 9 && far(F.get("t1"), F.get("t2")) >= 7 && far(F.get("t2"), F.get("t3")) >= 8, "graphs in a topic overlap");
ok(far(F.get("t4"), zb) > 2, "a topic's only graph sits on its name");
const all = layoutRings({ id: "all", kind: "all", kids: [1, 2, 3].map((h) => ({ id: "h" + h, kind: "hub", kids: [{ id: "i" + h, kind: "isle", kids: [{ id: "z" + h, kind: "topic", kids: Array.from({ length: h * 2 }, (_, k) => ({ id: `g${h}${k}`, kind: "graph", r: 3 })) }] }] })) });
ok(far(all.at.get("z1"), all.at.get("z2")) > all.at.get("z1").r + all.at.get("z2").r && far(all.at.get("z3"), all.at.get("z2")) > all.at.get("z3").r + all.at.get("z2").r, "hubs overlap");
ok([...all.at.values()].every((p) => p.kind !== "graph" || Math.hypot(p.x - all.center.x, p.z - all.center.z) <= all.radius), "the frame doesn't hold every graph");

// Tiers, for the joined view: what grows from a part stands on the next ring out and a step higher, out past the
// idea it grows from, and seen from above no two parts overlap, however many there are.
{
  const parts = [{ id: "a", parent: null, r: 6, fromAt: null }, { id: "b", parent: "a", r: 5, fromAt: [3, 0] }, { id: "c", parent: "a", r: 4, fromAt: [0, 3] }, { id: "d", parent: "b", r: 7, fromAt: [2, 2] }, { id: "e", parent: "a", r: 3, fromAt: [2.9, 0.4] }];
  const Tr = layoutTiers(parts), g = (id) => Tr.get(id), apart = (p, q) => Math.hypot(g(p).x - g(q).x, g(p).z - g(q).z);
  ok(g("a").tier === 0 && g("b").tier === 1 && g("c").tier === 1 && g("d").tier === 2, "tiers don't follow what grows from what");
  ok(g("a").lift < g("b").lift && g("b").lift < g("d").lift && g("b").lift === g("c").lift, "tiers don't step up");
  ok(Math.abs(Math.atan2(g("c").z, g("c").x) - Math.PI / 2) < 0.6 && Math.abs(Math.atan2(g("b").z, g("b").x)) < 0.9, "a part doesn't stand out past the idea it grows from");
  let over = 0; for (const p of parts) for (const q of parts) if (p.id < q.id && apart(p.id, q.id) < p.r + q.r) over++;
  ok(over === 0, `${over} parts overlap seen from above`);
  let bad = 0;
  for (let k = 0; k < 60; k++) {
    const many = [{ id: "p0", parent: null, r: 2 + rnd() * 8, fromAt: null }];
    for (let i = 1; i < 3 + Math.floor(rnd() * 25); i++) many.push({ id: "p" + i, parent: many[Math.floor(rnd() * many.length)].id, r: 1.5 + rnd() * 9, fromAt: rnd() < 0.7 ? [(rnd() - 0.5) * 8, (rnd() - 0.5) * 8] : null });
    const M = layoutTiers(many);
    for (let i = 0; i < many.length; i++) for (let j = i + 1; j < many.length; j++) { const a = M.get(many[i].id), b = M.get(many[j].id); if (Math.hypot(a.x - b.x, a.z - b.z) < many[i].r + many[j].r || !isFinite(a.x + b.x)) bad++; }
  }
  ok(bad === 0, `${bad} overlaps over 60 random sets of parts`);
}

const day = 86400000, now = Date.parse("2026-06-01T00:00:00Z"), node = { createdAt: new Date(now - 5 * day).toISOString(), note: "x" };
ok(srs.isDue(node, now) && srs.status(node, 0, now) === "overdue", "old unreviewed idea isn't overdue");
ok(srs.status({ createdAt: new Date(now - 3600000).toISOString(), note: "x" }, 0, now) === "fresh", "new idea isn't fresh");
ok(!srs.reviewable({ note: "", body: "" }, 0) && srs.reviewable({ note: "" }, 2), "what counts as reviewable");
let s = srs.rate(node, "good", now); ok(s.interval === 1 && s.passes === 1, "first good");
s = srs.rate({ ...node, srs: s }, "good", now); ok(s.interval === 3, "second good");
s = srs.rate({ ...node, srs: s }, "good", now); ok(s.interval === 7.5 && s.passes === 3, "third good");
const lapse = srs.rate({ ...node, srs: s }, "again", now); ok(lapse.reps === 0 && lapse.passes === 3 && Date.parse(lapse.due) - now === 600000, "again");
ok(srs.rate(node, "easy", now).interval === 3 && srs.dueLabel({ ...node, srs: s }, now) === "Due in 8 days", "easy and due label");

const html = md("# Title\n**bold** and *it* `<b>`\n- one\n- two\n\n[ok](https://a.b) [bad](javascript:alert(1)) <img src=x onerror=1>");
ok(html.includes("<h3>Title</h3>") && html.includes("<strong>bold</strong>") && html.includes("<em>it</em>") && html.includes("<li>two</li>"), "markdown basics");
ok(html.includes('<a href="https://a.b"') && !html.includes('href="javascript') && !html.includes("<img src=x") && html.includes("<code>&lt;b&gt;</code>"), "markdown safety");
if (failed) process.exit(1);
console.log("PASS run09 units");
