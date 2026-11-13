// Landmark kit: a small voxel grid with a few shape helpers, and a picture of the result.
// A landmark file is an ES module:  export default function build(a) { ... }
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

export const SIZE = 32, HEIGHT = 48;   // x and z run -16..15, y runs 0..47 (y is up, y = 0 sits on the ground)
export const MATERIALS = { stone: "#e6e3da", stone2: "#c2beb2", trim: "#8f96a6", metal: "#d9a441", roof: "#b8603f", roof2: "#8f452c", glass: "#9fd3f2", wood: "#6f4b2f", glow: "#ffe28a", accent: "#2fbfae", dark: "#2a2d3a" };
const NAMES = Object.keys(MATERIALS);

export function makeGrid() {
  const g = new Uint8Array(SIZE * HEIGHT * SIZE), H = SIZE / 2;
  const ok = (x, y, z) => x >= -H && x < H && z >= -H && z < H && y >= 0 && y < HEIGHT, I = (x, y, z) => (y * SIZE + (z + H)) * SIZE + (x + H);
  const id = (m) => { if (m == null) return 0; const k = NAMES.indexOf(m); if (k < 0) throw new Error(`unknown material "${m}". Use one of: ${NAMES.join(", ")}`); return k + 1; };
  const a = {
    set(x, y, z, m) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (ok(x, y, z)) g[I(x, y, z)] = id(m); },   // m = null removes
    get(x, y, z) { x = Math.round(x); y = Math.round(y); z = Math.round(z); return ok(x, y, z) && g[I(x, y, z)] ? NAMES[g[I(x, y, z)] - 1] : null; },
    box(x0, y0, z0, x1, y1, z1, m) { for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) for (let z = Math.round(Math.min(z0, z1)); z <= Math.round(Math.max(z0, z1)); z++) for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) a.set(x, y, z, m); },
    cyl(cx, y0, cz, r, h, m) { for (let y = 0; y < h; y++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.3) a.set(x, y0 + y, z, m); },
    ellipsoid(cx, cy, cz, rx, ry, rz, m) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1.05) a.set(x, y, z, m); },
    ball(cx, cy, cz, r, m) { a.ellipsoid(cx, cy, cz, r, r, r, m); },
    line(x0, y0, z0, x1, y1, z1, r, m) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * 2) + 1; for (let i = 0; i <= n; i++) { const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, z = z0 + (z1 - z0) * f; if (r < 0.7) a.set(x, y, z, m); else a.ball(x, y, z, r, m); } },
  };
  return { a, g, ok, I };
}

// ---- picture: two views a quarter turn apart, drawn back to front ----
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function draw(buf, W, Hh, grid, ox, turn) {
  const { g, ok, I } = grid, H = SIZE / 2, c = 6, oy = Hh - 40 - SIZE * c / 2;
  const at = (x, y, z) => { const [rx, rz] = turn ? [z, -x - 1] : [x, z]; return ok(rx, y, rz) ? g[I(rx, y, rz)] : 0; };
  const px = (x, y, z) => [ox + (x - z) * c, oy + (x + z) * c / 2 - y * c];
  const quad = (pts, col) => { let y0 = Math.floor(Math.min(...pts.map((p) => p[1]))), y1 = Math.ceil(Math.max(...pts.map((p) => p[1]))); for (let y = Math.max(0, y0); y < Math.min(Hh, y1); y++) { let xa = 1e9, xb = -1e9; for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4]; if ((p[1] <= y + 0.5 && q[1] > y + 0.5) || (q[1] <= y + 0.5 && p[1] > y + 0.5)) { const x = p[0] + ((y + 0.5 - p[1]) / (q[1] - p[1])) * (q[0] - p[0]); xa = Math.min(xa, x); xb = Math.max(xb, x); } } for (let x = Math.max(0, Math.round(xa)); x < Math.min(W, Math.round(xb)); x++) { const k = (y * W + x) * 4; buf[k] = col[0]; buf[k + 1] = col[1]; buf[k + 2] = col[2]; buf[k + 3] = 255; } } };
  const face = (pts, rgb, sh) => quad(pts, rgb.map((v) => Math.round(v * sh)));
  const ground = hex("#566b52");
  for (let x = -H; x < H; x++) for (let z = -H; z < H; z++) if (Math.hypot(x + 0.5, z + 0.5) <= H - 0.5) face([px(x, 0, z), px(x + 1, 0, z), px(x + 1, 0, z + 1), px(x, 0, z + 1)], ground, ((x + z) & 1) ? 1 : 0.94);
  for (let x = -H; x < H; x++) for (let z = -H; z < H; z++) for (let y = 0; y < HEIGHT; y++) {
    const m = at(x, y, z); if (!m) continue; const rgb = hex(MATERIALS[NAMES[m - 1]]);
    if (!at(x, y + 1, z)) face([px(x, y + 1, z), px(x + 1, y + 1, z), px(x + 1, y + 1, z + 1), px(x, y + 1, z + 1)], rgb, 1);
    if (!at(x, y, z + 1)) face([px(x, y + 1, z + 1), px(x + 1, y + 1, z + 1), px(x + 1, y, z + 1), px(x, y, z + 1)], rgb, 0.8);
    if (!at(x + 1, y, z)) face([px(x + 1, y + 1, z), px(x + 1, y + 1, z + 1), px(x + 1, y, z + 1), px(x + 1, y, z)], rgb, 0.62);
  }
}
function png(buf, W, Hh) {
  const raw = Buffer.alloc((W * 4 + 1) * Hh); for (let y = 0; y < Hh; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(buf.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(W, 0); head.writeUInt32BE(Hh, 4); head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
export function picture(grid, out) {
  const W = 840, Hh = 520, buf = new Uint8Array(W * Hh * 4); for (let i = 0; i < W * Hh; i++) { buf[i * 4] = 26; buf[i * 4 + 1] = 29; buf[i * 4 + 2] = 44; buf[i * 4 + 3] = 255; }
  draw(buf, W, Hh, grid, 210, 0); draw(buf, W, Hh, grid, 630, 1); writeFileSync(out, png(buf, W, Hh));
}
export function stats(grid) {
  const { g } = grid, H = SIZE / 2, used = {}; let n = 0, top = -1, x0 = 99, x1 = -99, z0 = 99, z1 = -99;
  for (let y = 0; y < HEIGHT; y++) for (let z = -H; z < H; z++) for (let x = -H; x < H; x++) { const m = g[(y * SIZE + (z + H)) * SIZE + (x + H)]; if (!m) continue; n++; used[NAMES[m - 1]] = (used[NAMES[m - 1]] || 0) + 1; top = Math.max(top, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { voxels: n, height: top + 1, x: [x0, x1], z: [z0, z1], materials: used };
}
