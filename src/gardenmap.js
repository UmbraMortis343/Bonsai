// The garden's layout can come from a map drawn elsewhere: hubs hold islands and
// islands hold topics. This reads such a map and folds it into the arrangement
// kept beside the data. No browser needed, so the tests can run it directly.
export const CENTRE_IDS = ["arches", "academy", "amphitheatre", "statue"];
export const ISLE_MAX = 6;   // topics an island has room for

const WORDS = [["arch", "arches"], ["academ", "academy"], ["school", "academy"], ["universit", "academy"], ["amphi", "amphitheatre"], ["theatre", "amphitheatre"], ["theater", "amphitheatre"], ["statue", "statue"], ["sculpt", "statue"]];
// The map names a centrepiece in words; the garden knows four.
export const centreOf = (text) => { const s = String(text || "").toLowerCase(); return WORDS.find(([w]) => s.includes(w))?.[1] || null; };
const low = (s) => String(s).trim().toLowerCase();
const text = (x, max) => (typeof x === "string" || typeof x === "number" ? String(x).trim().slice(0, max) : "");

// Checks a pasted or loaded map and returns it tidied: { hubs: [{ id, name, islands: [{ id, name, centre, topics: [{ id, name }] }] }] }
export function readMap(input) {
  let d = input;
  if (typeof d === "string") { try { d = JSON.parse(d.slice(d.indexOf("{"), d.lastIndexOf("}") + 1)); } catch { d = null; } }
  if (!d || !Array.isArray(d.hubs)) throw new Error("That isn't a Bonsai map.");
  const seen = new Set(), ident = (x, fallback) => { let id = text(x, 60) || fallback; while (seen.has(id)) id += "~"; seen.add(id); return id; };
  const hubs = d.hubs.filter((h) => h && typeof h === "object").map((h, a) => ({
    id: ident(h.id, "h" + a), name: text(h.name, 40) || `Hub ${a + 1}`,
    islands: (Array.isArray(h.islands) ? h.islands : []).filter((i) => i && typeof i === "object").map((i, b) => ({
      id: ident(i.id, `i${a}-${b}`), name: text(i.name, 40) || `Island ${b + 1}`, centre: text(i.centre, 40),
      topics: (Array.isArray(i.topics) ? i.topics : []).filter((t) => t && text(t.name, 80)).map((t, c) => ({ id: ident(t.id, `t${a}-${b}-${c}`), name: text(t.name, 80) })),
    })),
  }));
  if (!hubs.length) throw new Error("That map is empty.");
  return { hubs };
}

// Which topic of ours each topic on the map is: one tied to it by an earlier import, else an untied one of the same name.
function pair(garden, map, zones) {
  const tied = new Map(), have = new Set(zones.map((z) => z.id));
  for (const [zid, o] of Object.entries(garden?.zone || {})) if (o?.mapId && have.has(zid) && !tied.has(o.mapId)) tied.set(o.mapId, zid);
  const taken = new Set(tied.values()), out = new Map();
  for (const h of map.hubs) for (const i of h.islands) for (const t of i.topics) {
    let zid = tied.get(t.id);
    if (!zid) { const z = zones.find((q) => !taken.has(q.id) && !garden?.zone?.[q.id]?.mapId && low(q.name) === low(t.name)); if (z) { zid = z.id; taken.add(zid); } }
    out.set(t.id, zid || null);
  }
  return out;
}
// Topics on the map that don't exist here yet. Create them, note each as { mapId, fromMap: true } under garden.zone, then merge.
export function missing(garden, map, zones) {
  const got = pair(garden, map, zones), out = [];
  for (const h of map.hubs) for (const i of h.islands) for (const t of i.topics) if (!got.get(t.id)) out.push({ mapId: t.id, name: t.name });
  return out;
}

// Folds the map into the arrangement. The map decides hubs, islands, their names and centrepieces, and where its
// topics sit; a topic moved by hand here stays put until it moves on the map. Topics the map doesn't know keep their place.
// zones: [{ id, name, trees }]. Returns { garden, rename: [{ id, name }], drop: [zoneId] }.
export function mergeMap(garden, map, zones, stamp = new Date().toISOString()) {
  const g = structuredClone(garden || {}); g.islands ||= []; g.zone ||= {};
  const live = new Map(zones.map((z) => [z.id, z])), got = pair(g, map, zones), out = { garden: g, rename: [], drop: [] };
  const old = g.islands, byMap = new Map(old.filter((i) => i.mapId).map((i) => [i.mapId, i])), used = new Set();
  for (const i of old) i.zoneIds = (i.zoneIds || []).filter((id) => live.has(id));
  g.hubs = map.hubs.map((h) => ({ id: h.id, name: h.name }));
  const perHub = new Map(g.hubs.map((h) => [h.id, []])), parts = new Map(), all = () => [...new Set([...old, ...[...perHub.values()].flat()])];
  let made = 0;
  // an island of the map, and any overflow islands it grew when it had more topics than fit
  for (const h of map.hubs) for (const mi of h.islands) {
    const rec = byMap.get(mi.id) || old.find((i) => !i.mapId && !used.has(i) && low(i.name) === low(mi.name)) || { id: "m-" + mi.id, zoneIds: [] };
    Object.assign(rec, { mapId: mi.id, name: mi.name, hubId: h.id, landmark: centreOf(mi.centre) || rec.landmark || CENTRE_IDS[1 + (made % 3)] }); made++;
    const list = [rec]; used.add(rec);
    for (let k = 2; byMap.has(mi.id + "~" + k); k++) { const more = byMap.get(mi.id + "~" + k); Object.assign(more, { name: `${mi.name} ${k}`, hubId: h.id }); used.add(more); list.push(more); }
    parts.set(mi.id, list); perHub.get(h.id).push(...list);
  }
  const room = (mi, hubId) => {
    const list = parts.get(mi.id); let rec = list.find((r) => r.zoneIds.length < ISLE_MAX);
    if (!rec) { const k = list.length + 1; rec = { id: `m-${mi.id}~${k}`, mapId: `${mi.id}~${k}`, name: `${mi.name} ${k}`, hubId, landmark: list[0].landmark, zoneIds: [] }; const row = perHub.get(hubId); row.splice(row.indexOf(list[list.length - 1]) + 1, 0, rec); list.push(rec); }
    return rec;
  };
  const pull = (zid) => { for (const i of all()) i.zoneIds = i.zoneIds.filter((x) => x !== zid); };
  for (const h of map.hubs) for (const mi of h.islands) {
    for (const t of mi.topics) {
      const zid = got.get(t.id), z = live.get(zid); if (!z) continue;
      const o = (g.zone[zid] ||= {});
      if (o.mapName !== undefined && o.mapName !== t.name && z.name !== t.name) out.rename.push({ id: zid, name: t.name });
      const moved = o.mapIsle !== mi.id || !all().some((i) => i.zoneIds.includes(zid));
      Object.assign(o, { mapId: t.id, mapName: t.name, mapIsle: mi.id });
      if (moved) { pull(zid); room(mi, h.id).zoneIds.push(zid); }
    }
    // on an island that fits on one piece of land, topics follow the map's order
    const list = parts.get(mi.id), at = new Map(mi.topics.map((t, k) => [got.get(t.id), k]));
    if (list.length === 1) list[0].zoneIds = list[0].zoneIds.map((id, k) => [id, k]).sort((a, b) => (at.get(a[0]) ?? 1e6 + a[1]) - (at.get(b[0]) ?? 1e6 + b[1])).map((x) => x[0]);
  }
  // topics the map no longer has: ones it made that were never used go, the rest stay as ordinary topics
  const onMap = new Set(got.keys());
  for (const [zid, o] of Object.entries(g.zone)) {
    if (!o?.mapId || onMap.has(o.mapId)) continue;
    if (o.fromMap && live.get(zid)?.trees === 0) { out.drop.push(zid); pull(zid); delete g.zone[zid]; }
    else { delete o.mapId; delete o.mapName; delete o.mapIsle; delete o.fromMap; }
  }
  // islands the map doesn't have: kept while they hold topics (made here, or taken off the map), dropped once empty
  const first = g.hubs[0].id;
  for (const rec of old) {
    if (used.has(rec) || !rec.zoneIds.length) continue;
    delete rec.mapId; if (!perHub.has(rec.hubId)) rec.hubId = first;
    perHub.get(rec.hubId).push(rec);
  }
  g.islands = g.hubs.flatMap((h) => perHub.get(h.id)).filter((rec) => rec.zoneIds.length || !/~\d+$/.test(rec.mapId || ""));
  g.mapAt = stamp;
  return out;
}
