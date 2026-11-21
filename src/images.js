// Pictures in typed pages: a screenshot pasted or a file dropped is shrunk to at most MAX pixels on its long side,
// kept as WebP (PNG where the browser can't write WebP), and saved once by id (store.putFile: meta key "file:<id>"),
// so a page's saves carry only the id. Shown through object URLs, made once per picture.
export const MAX = 2000;
const LIMIT = 3_000_000;   // at most this much base64 per picture, well under a synced row's limit
const urls = new Map();

const toB64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b64, type) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type }); };
const blobOf = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));
export const isImage = (f) => !!f && /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.type || "");

async function bitmap(blob) {
  if (typeof createImageBitmap === "function") { try { return await createImageBitmap(blob); } catch {} }
  const url = URL.createObjectURL(blob), img = new Image();
  try { img.src = url; await img.decode(); return img; } finally { URL.revokeObjectURL(url); }
}

// a file or blob → { type, data (base64), w, h }
export async function shrinkImage(blob, max = MAX) {
  const src = await bitmap(blob), w0 = src.width, h0 = src.height;
  if (!w0 || !h0) throw new Error("That picture couldn't be read");
  // small enough already, and already compact: kept as it came (a GIF keeps its frames)
  if (Math.max(w0, h0) <= max && /^image\/(png|jpeg|webp|gif)$/.test(blob.type) && blob.size * 1.37 < LIMIT && (blob.type !== "image/png" || blob.size < 400_000))
    return { type: blob.type, data: toB64(await blob.arrayBuffer()), w: w0, h: h0 };
  for (let side = max, q = 0.86; ; side = Math.round(side * 0.8), q = Math.max(0.6, q - 0.08)) {
    const k = Math.min(1, side / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, w, h);
    let out = await blobOf(c, "image/webp", q);
    if (!out || out.type !== "image/webp") out = await blobOf(c, "image/png");
    const data = toB64(await out.arrayBuffer());
    if (data.length < LIMIT || side < 400) return { type: out.type, data, w, h };
  }
}
// a kept picture → a URL to show it by
export function urlOf(id, rec) {
  if (urls.has(id)) return urls.get(id);
  if (!rec?.data) return "";
  const u = URL.createObjectURL(fromB64(rec.data, rec.type || "image/png")); urls.set(id, u); return u;
}
// for the clipboard, which takes PNG
export async function pngOf(rec) {
  const blob = fromB64(rec.data, rec.type || "image/png");
  if (blob.type === "image/png") return blob;
  const src = await bitmap(blob), c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0); return blobOf(c, "image/png");
}
