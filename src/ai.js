// The on-device model, from the app's side: a worker that turns ideas into
// vectors, arranges them in 3D and finds similar pairs. Vectors are cached in
// the store and only recomputed when an idea's text changes.
import * as store from "./store.js";
import { DIM, MODEL, hashText, dot } from "./semantic.js";

let worker = null, seq = 0;
const waiting = new Map();
export const cache = new Map();   // idea id -> { hash, v: Float32Array }
let loaded = null;

function call(type, payload, onProgress, transfer = []) {
  if (!worker) {
    worker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id); if (!w) return;
      if (e.data.progress) return w.onProgress?.(e.data.progress);
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data.result);
    };
    worker.onerror = (e) => { for (const w of waiting.values()) w.reject(new Error(e.message || "The model couldn't start.")); waiting.clear(); worker = null; };
  }
  return new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject, onProgress }); worker.postMessage({ id, type, ...payload }, transfer); });
}

export function loadCache() {
  if (!loaded) loaded = store.allVectors().then((rows) => { for (const r of rows) if (r.model === MODEL) cache.set(r.id, { hash: r.hash, v: r.v }); });
  return loaded;
}

// items: [{id, text}]. Embeds whatever is new or changed; returns when every item has a vector.
export async function ensure(items, onProgress) {
  await loadCache();
  const stale = items.filter((it) => cache.get(it.id)?.hash !== hashText(it.text));
  if (stale.length) {
    const out = await call("embed", { texts: stale.map((s) => s.text) }, onProgress);
    const rows = stale.map((s, i) => ({ id: s.id, model: MODEL, hash: hashText(s.text), v: out.slice(i * DIM, (i + 1) * DIM) }));
    await store.putVectors(rows);
    for (const r of rows) cache.set(r.id, { hash: r.hash, v: r.v });
  }
  return stale.length;
}
export function pack(ids) {
  const v = new Float32Array(ids.length * DIM);
  ids.forEach((id, i) => v.set(cache.get(id).v, i * DIM));
  return v;
}
export const project = (ids, seed, onProgress) => call("project", { vectors: pack(ids), n: ids.length, seed }, onProgress);
export const pairs = (ids) => call("pairs", { vectors: pack(ids), n: ids.length });
// Ranks cached ideas against a query: [[id, cosine], ...], best first.
export async function search(query, ids, k = 6) {
  const q = await call("embed", { texts: [query] });
  return ids.filter((id) => cache.has(id)).map((id) => [id, dot(q, 0, cache.get(id).v, 0)]).sort((a, b) => b[1] - a[1]).slice(0, k);
}
export async function forget(alive) {
  await loadCache();
  const gone = [...cache.keys()].filter((id) => !alive.has(id));
  if (gone.length) { await store.deleteVectors(gone); for (const id of gone) cache.delete(id); }
}
