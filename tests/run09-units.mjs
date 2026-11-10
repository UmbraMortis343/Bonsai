// Pure logic: the 3D layout keeps ideas apart and above ground, review
// scheduling, and the Markdown renderer's safety.
import { layoutTree, layoutForest } from "../src/layout.js";
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
ok(L.pos.get("r")[0] === 0 && L.pos.get("r")[2] === 0, "trunk isn't upright");
let closest = Infinity;
for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) closest = Math.min(closest, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]));
ok(closest > 0.3, `two ideas are almost on top of each other (${closest.toFixed(2)})`);
ok(JSON.stringify([...layoutTree(nodes, "r").pos]) === JSON.stringify([...L.pos]), "layout changes between runs");
ok(P.every((p) => Math.hypot(p[0] - L.center[0], p[1] - L.center[1], p[2] - L.center[2]) <= L.radius), "bounds don't contain the tree");

const F = layoutForest([{ id: "a", trees: [{ id: "t1", footprint: 4 }, { id: "t2", footprint: 3 }, { id: "t3", footprint: 5 }] }, { id: "b", trees: [{ id: "t4", footprint: 2 }] }, { id: "c", trees: [] }]);
const za = F.zones.get("a"), zb = F.zones.get("b"), zc = F.zones.get("c");
ok(Math.hypot(za.x - zb.x, za.z - zb.z) > za.r + zb.r && Math.hypot(za.x - zc.x, za.z - zc.z) > za.r + zc.r, "zones overlap");
const t1 = F.trees.get("t1"), t3 = F.trees.get("t3");
ok(Math.hypot(t1.x - t3.x, t1.z - t3.z) > 5, "trees in a zone overlap");

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
