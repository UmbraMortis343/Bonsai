// Runs the embedding model and the 3D arrangement off the main thread.
import { DIM, pca3, settle, seeded, topPairs } from "./semantic.js";

let pipe = null, Umap = null;
function model(report) {
  if (!pipe) pipe = (async () => {
    const tf = await import("./vendor/ai/transformers.min.js");
    tf.env.allowRemoteModels = false; tf.env.allowLocalModels = true;
    tf.env.localModelPath = new URL("./models/", self.location.href).href;
    // Named .js so every web host serves it as a script.
    const at = (f) => new URL("./vendor/ai/" + f, self.location.href).href;
    tf.env.backends.onnx.wasm.wasmPaths = { mjs: at("ort-wasm-simd-threaded.jsep.js"), wasm: at("ort-wasm-simd-threaded.jsep.wasm") };
    tf.env.backends.onnx.wasm.numThreads = 1;
    return tf.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8",
      progress_callback: (p) => { if (p.status === "progress" && String(p.file).endsWith(".onnx")) report({ stage: "model", done: p.loaded, total: p.total }); } });
  })().catch((e) => { pipe = null; throw e; });
  return pipe;
}
async function umap() {
  if (!Umap) { const m = { exports: {} }; new Function("module", "exports", await (await fetch(new URL("./vendor/umap-js.min.js", self.location.href))).text())(m, m.exports); Umap = m.exports.UMAP; }
  return Umap;
}

self.onmessage = async (e) => {
  const { id, type } = e.data, report = (progress) => self.postMessage({ id, progress });
  try {
    if (type === "embed") {
      const p = await model(report), texts = e.data.texts, out = new Float32Array(texts.length * DIM);
      for (let i = 0; i < texts.length; i += 8) {
        const t = await p(texts.slice(i, i + 8), { pooling: "mean", normalize: true });
        out.set(t.data, i * DIM); report({ stage: "embed", done: Math.min(texts.length, i + 8), total: texts.length });
      }
      self.postMessage({ id, result: out }, [out.buffer]);
    } else if (type === "project") {
      const { vectors, n } = e.data; let pos;
      if (n >= 12) {
        const U = await umap(), rows = [];
        for (let i = 0; i < n; i++) rows.push(Array.from(vectors.subarray(i * DIM, (i + 1) * DIM)));
        const u = new U({ nComponents: 3, nNeighbors: Math.min(15, n - 1), minDist: 0.3, spread: 1.4, random: seeded(e.data.seed || 1) });
        const epochs = u.initializeFit(rows);
        for (let i = 0; i < epochs; i++) { u.step(); if (i % 25 === 0) report({ stage: "arrange", done: i, total: epochs }); }
        pos = Float32Array.from(u.getEmbedding().flat());
      } else pos = pca3(vectors, n);
      settle(pos, n);
      self.postMessage({ id, result: pos }, [pos.buffer]);
    } else if (type === "pairs") {
      self.postMessage({ id, result: topPairs(e.data.vectors, e.data.n, 400, 0.4) });
    }
  } catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
