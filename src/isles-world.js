// The garden's islands, made of voxels in code: terrain, water, plants,
// landmarks and bones for one island, returned as meshes ready to draw.
// Nothing here touches the page; isles.js draws and animates the result.
import * as THREE from "./vendor/three.module.min.js";

// ---------- noise ----------
const hash2 = (x, z, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const hash3 = (x, y, z) => hash2(x * 31 + y * 17, z * 13 + y * 7, 5);
function vnoise(x, z, s) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z, s) => vnoise(x, z, s) * 0.5 + vnoise(x * 2, z * 2, s + 1) * 0.25 + vnoise(x * 4, z * 4, s + 2) * 0.125 + vnoise(x * 8, z * 8, s + 3) * 0.0625;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- materials: name, colour, brightness jitter, glows. A "tone" also gets a lit and a shaded variant ----------
const MATS = [null], M = {}, T3 = {}, WHITE = new THREE.Color(0xffffff);
const mat = (name, hex, jit = 0.03, glow = 0) => { const c = hex.isColor ? hex : new THREE.Color(hex); M[name] = MATS.length; MATS.push([c.r, c.g, c.b, jit, glow]); T3[name] = [M[name], M[name], M[name]]; };
const tone = (name, hex, jit = 0.025) => { const c = new THREE.Color(hex); mat(name, c, jit); mat(name + "Hi", c.clone().multiplyScalar(1.16).lerp(WHITE, 0.03), jit); mat(name + "Lo", c.clone().multiplyScalar(0.68), jit); T3[name] = [M[name + "Lo"], M[name], M[name + "Hi"]]; };
[["stone", "#8d94a3"], ["stone2", "#737a8a"], ["stone3", "#5d6274"], ["dirt", "#6b4c34"], ["snow", "#f4f8ff", .015], ["sand", "#f0deaa"], ["rim", "#c9cdd6", .02], ["bank", "#d8c9a0"], ["mud", "#5b4a3c"], ["red", "#b9684a", .04],
 ["arch1", "#aaa18d", .04], ["arch2", "#8f8674", .04], ["arch3", "#716a5c", .04], ["moss", "#6fa24e", .04], ["moss2", "#8cbd5c", .04], ["vine", "#4f9a52", .04],
 ["lichenO", "#d9903a", .04], ["lichenY", "#c4c84e", .04], ["lichenG", "#8fb07a", .04], ["lichenP", "#d98aa0", .04],
 ["obs1", "#bdb7a8", .03], ["obs2", "#9d978a", .03], ["copper", "#5fae98", .03], ["copper2", "#3f8f7c", .03], ["bronze", "#a8743a", .03], ["glass", "#9fd3f2", .02], ["brass", "#d9a441", .03], ["gold", "#f0c040", .03], ["gold2", "#c9962a", .03], ["goldGlow", "#ffe28a", .02, 1], ["bronze2", "#855a2c", .03], ["roofT", "#b8603f", .03], ["roofT2", "#96492f", .03], ["marble", "#eeece4", .02], ["marble2", "#d6d3c8", .02], ["chart", "#8fd8ff", .02, 1],
 ["stat1", "#c9c6ba", .03], ["stat2", "#a9a69b", .03], ["orb", "#ffe9a8", .02, 1],
 ["fallow", "#a9ad98", .025], ["heart", "#6fbf73", .035],
 ["dry", "#b79a5c", .04], ["cracked", "#74614f", .03], ["ash", "#584b42", .03], ["crack", "#1f1815", .02], ["bone", "#ece5d2", .025], ["deadwood", "#93877b", .04],
 ["wood", "#5f3f28", .04], ["woodDark", "#4a2f3d", .04], ["palmTrunk", "#8a6a46", .04], ["bao", "#8a6240", .04],
 ["gHigh", "#9fbcae", .025], ["gBloom", "#98dc8a", .025], ["gCap", "#27495c", .03], ["gCap2", "#2e3d6b", .03], ["gTrop", "#a8da6c", .025], ["gTrop2", "#95cd60", .025], ["gLantern", "#e2c868", .025], ["gFern", "#a9dcc6", .025], ["gFern2", "#bfe3b0", .025],
 ["crystal", "#7ae8f2", .03, 1], ["crystal2", "#b79cff", .03, 1], ["tendril", "#ffe0ee", .02], ["petal", "#fff0f8", .02, 1], ["stem", "#ece4d2", .025], ["gill", "#c6f0e8", .025], ["spore", "#d2fff4", .02, 1],
 ["frondTip", "#62d6b4", .03], ["fruit", "#ffe27a", .02, 1], ["fruit2", "#a8ffc0", .02, 1], ["coral", "#ff8fa3", .03], ["coral2", "#ffb36b", .03], ["lantern", "#ffb347", .03, 1], ["lantern2", "#ff7a3d", .03, 1], ["tuft", "#c9ae4e", .04],
 ["fernTip", "#6ef0ff", .02, 1], ["fYellow", "#ffd84a", .03], ["fWhite", "#ffffff", .015], ["fViolet", "#b58cf0", .03], ["shroom", "#e5484d", .03], ["reed", "#8fae52", .04], ["glowpod", "#9dffd0", .02, 1],
].forEach((a) => mat(...a));
[["pink", "#f48fb8"], ["rose", "#e0558f"], ["blush", "#ffc2d8"], ["lilac", "#c79bf0"], ["teal", "#1fc2b2"], ["violet", "#8f63e0"], ["azure", "#3f9fe8"],
 ["j1", "#1f7a48"], ["j2", "#2e9e58"], ["j3", "#157062"], ["j4", "#5fae3f"], ["sp1", "#2b6a66"], ["sp2", "#1f5550"], ["sp3", "#4a8a80"],
 ["indigo", "#4b4fbf"], ["fviolet", "#7a4fd0"], ["fblue", "#2f6fd0"], ["olive", "#8fa046"], ["frond", "#3fae62"], ["fan", "#2f9a8a"], ["wiltA", "#b08a4a"], ["wiltB", "#a8683a"],
].forEach((a) => tone(...a));
// six topic slots, four tones each, recoloured for whichever island is being built: a topic's main colour is the user's to choose
const HS = [0, 1, 2, 3, 4, 5].map((k) => ["a", "b", "c", "d", "g", "h"].map((q) => { if (q < "g") tone("t" + k + q, "#888888"); else mat("t" + k + q, "#ffffff", 0.02, 1); return "t" + k + q; }));   // a b c d: plant tones; g h: glow
// a topic has three colours to choose: primary (main plants), secondary (accent plants), tertiary (glow and small details). Unchosen ones are derived
const MAIN = { bloom: "#f48fb8", glowcap: "#1fc2b2", tropical: "#2e9e58", fern: "#4b4fbf", lantern: "#8fa046", highland: "#d9903a" };
const GLOW = { bloom: "#fff0f8", glowcap: "#d2fff4", tropical: "#ffe27a", fern: "#6ef0ff", lantern: "#ffb347", highland: "#7ae8f2" };
// how tones are derived from the primary: [hue shift in degrees, saturation x, lightness x]; the first is the default secondary
const FAMILY = { bloom: [[0, 1.1, 0.8], [-45, 0.9, 1.03], [0, 0.85, 1.18]], glowcap: [[36, 0.85, 1.3], [95, 0.9, 1.2], [0, 1, 0.82]], tropical: [[-18, 1, 1.25], [22, 1.05, 0.82], [-34, 0.9, 1.4]], fern: [[35, 1, 1.05], [-24, 1.05, 1], [0, 0.9, 1.2]], lantern: [[12, 1, 0.85], [-14, 1, 1.1], [0, 0.9, 1.2]], highland: [[0, 1, 0.72], [14, 1, 1.05], [0, 0.85, 1.2]] };
const HSL = { h: 0, s: 0, l: 0 }, shift = (hex, dh, sm, lm) => { const c = new THREE.Color(hex); c.getHSL(HSL, THREE.SRGBColorSpace); return c.setHSL((HSL.h + dh / 360 + 1) % 1, Math.min(1, HSL.s * sm), Math.min(0.88, HSL.l * lm), THREE.SRGBColorSpace); };
const colours = (t) => [t.color || MAIN[t.biome], t.color2 || (t.biome === "highland" ? "#2b6a66" : "#" + shift(t.color || MAIN[t.biome], ...FAMILY[t.biome][0]).getHexString()), t.color3 || GLOW[t.biome]];
const setTone = (name, c) => { const w = (id, q) => { MATS[id][0] = q.r; MATS[id][1] = q.g; MATS[id][2] = q.b; }; w(M[name], c); if (M[name + "Hi"]) { w(M[name + "Hi"], c.clone().multiplyScalar(1.16).lerp(WHITE, 0.03)); w(M[name + "Lo"], c.clone().multiplyScalar(0.68)); } };
function retint(topics) {
  topics.forEach((t, k) => { const [c1, c2, c3] = colours(t), F = FAMILY[t.biome];
    setTone(HS[k][0], new THREE.Color(c1)); setTone(HS[k][1], new THREE.Color(c2)); setTone(HS[k][2], shift(c1, ...F[1])); setTone(HS[k][3], shift(c1, ...F[2]));
    setTone(HS[k][4], new THREE.Color(c3)); setTone(HS[k][5], shift(c3, 38, 1, 0.92)); });
}
M.water = 255;
const GROUND = { highland: ["gHigh", "gHigh"], bloom: ["gBloom", "gBloom"], glowcap: ["gCap", "gCap2"], tropical: ["gTrop", "gTrop2"], lantern: ["gLantern", "tuft"], fern: ["gFern", "gFern2"] };
// scratch buffers for the mesher, reused between rebuilds
const mkBuf = (cap) => ({ pos: new Float32Array(cap * 12), col: new Float32Array(cap * 12), nor: new Float32Array(cap * 12), ext: new Float32Array(cap * 12), idx: new Uint32Array(cap * 6), v: 0, i: 0 });
const growBuf = (b) => { for (const k of ["pos", "col", "nor", "ext", "idx"]) { const a = new b[k].constructor(b[k].length * 2); a.set(b[k]); b[k] = a; } };
const BUFS = [mkBuf(80000), mkBuf(4000), mkBuf(4000)], FIELDS = new Map(), GRIDS = new Map();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- one island ----------
let TOPICS = [];
// isl: { id, landmark, patron, mountain, size, E, topics: [{ name, biome, health, growth, mark, color, color2, color3 }] }; N: voxels across
export function buildWorld(isl, N) {
  TOPICS = isl.topics;
  const E = isl.E || 1, SIZE = 96 * isl.size * E, s = SIZE / N, V = (w) => w / s, Rw = 96 * isl.size * 0.455, Re = Rw * E, R = Rw / s, c = N / 2;   // Rw: the island as first made; Re: its edge now
  const G = 26, W1 = G + 0.8, W0 = G - 4.5, H = Math.ceil(V(82));           // ground, upper and lower water levels (world units)
  const gk = N + "x" + H; let grid = GRIDS.get(gk); if (grid) grid.fill(0); else GRIDS.set(gk, (grid = new Uint8Array(N * H * N)));
  const I = (x, y, z) => (y * N + z) * N + x, J = (x, z) => z * N + x;
  const ht = new Int16Array(N * N).fill(-1), bot = new Int16Array(N * N), ymin = new Int16Array(N * N).fill(H), ymax = new Int16Array(N * N).fill(-1);
  const dryness = new Float32Array(N * N), dev = new Uint8Array(N * N), flag = new Uint8Array(N * N), steepA = new Uint8Array(N * N), hw = new Float32Array(N * N), crackA = new Uint8Array(N * N), glowVox = [];
  const tm = [performance.now()], mark = (name) => tm.push(name, performance.now());
  const inb = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < N && z < N && y < H;
  const get = (x, y, z) => (inb(x, y, z) ? grid[I(x, y, z)] : 0);
  const put = (x, y, z, m) => { grid[I(x, y, z)] = m; const j = J(x, z); if (y > ymax[j]) ymax[j] = y; if (y < ymin[j]) ymin[j] = y; };
  const set = (x, y, z, m) => { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (inb(x, y, z) && grid[I(x, y, z)] === 0) { put(x, y, z, m); if (MATS[m][4]) glowVox.push(I(x, y, z)); } };
  const n = TOPICS.length, seeds = TOPICS.map((t, i) => { const a = (-90 + (360 / n) * i) * Math.PI / 180; return [Math.cos(a) * 0.62, Math.sin(a) * 0.62, a]; });
  const arches = isl.landmark === "arches", MT = [0, -0.66], HOL = arches ? [0, 0.03] : [0, 0], HOLR = 6.5, heartR = arches ? 0.235 : Math.max(0.235, ({ academy: 15.5, amphitheatre: 16.5 }[isl.landmark] || 11) / Rw), paved = isl.landmark === "academy" || isl.landmark === "amphitheatre";
  retint(TOPICS);
  const pts = [[0.02, -0.42], [-0.13, -0.3], [0.08, -0.16], [0, 0.03], [-0.07, 0.22], [0.12, 0.42], [-0.03, 0.62], [0.1, 0.84], [0.16, 1.1], [0.2, 1.45], [0.27, 1.85]];

  // --- everything that doesn't depend on health or growth is worked out once per island and resolution, and kept ---
  const key = isl.id + "|" + N + "|" + E + "|" + isl.landmark + "|" + (isl.mountain ? 1 : 0) + (isl.patron && isl.patron !== "none" ? 1 : 0) + TOPICS.map((t) => t.biome).join();
  let F = FIELDS.get(key);
  if (!F) {
    const wd = new Float32Array(N * N).fill(99), wl = new Float32Array(N * N), wc = new Float32Array(N * N), wb = new Float32Array(N * N), wt = new Int8Array(N * N).fill(-1);
    const biome = new Int8Array(N * N).fill(-2), edge = new Float32Array(N * N), seedD = new Float32Array(N * N), h0 = new Float32Array(N * N), crk = new Float32Array(N * N).fill(99), botW = new Float32Array(N * N), rim = new Uint8Array(N * N), path = [], feats = [];
    const ox = (isl.seed || 0) * 37.3, fb = (x, z, sd) => fbm(x + ox, z - ox * 0.6, sd);
    let enter = 0;
    if (arches) {   // a river from the mountain pool, dropping into a sunken hollow at the centre and out through a gorge
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        for (let t = 0; t < 1; t += 0.03) { const t2 = t * t, t3 = t2 * t, f = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3); path.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
      }
      enter = path.findIndex(([x, z]) => Math.hypot(x - HOL[0], z - HOL[1]) * Rw < HOLR - 0.5);
      path.forEach(([px, pz], i) => feats.push({ x: c + px * R, z: c + pz * R, r: i < 5 ? 4.2 : 1.9, level: i < enter ? W1 : W0, carve: i < 5 ? 4 : i < enter ? 6 : 3, bed: 1.5, topic: -1 }));
      feats.push({ x: c + HOL[0] * R, z: c + HOL[1] * R, r: HOLR, level: W0, carve: 3.5, bed: 2.4, topic: -1 });
    }
    if (isl.landmark === "statue") feats.push({ x: c, z: c, r: 8.4, level: G + 0.9, carve: 4, bed: 1.2, topic: -1 });   // the statue stands in a pool
    TOPICS.forEach((t, i) => {
      const a = seeds[i][2], pond = (rr, da, r) => feats.push({ x: c + Math.cos(a + da) * rr * R, z: c + Math.sin(a + da) * rr * R, r: r * Math.sqrt(isl.size), level: G + 0.9, carve: 5, bed: 1.3, topic: i });
      if (t.biome === "tropical") pond(0.56, 0.05, 4.2);
      if (t.biome === "fern") { pond(0.56, -0.2, 2.3); pond(0.75, 0.22, 2); }
    });
    for (const f of feats) { const rad = Math.ceil(V(f.r + f.carve + 1)); for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { const x = Math.round(f.x + dx), z = Math.round(f.z + dz); if (x < 0 || z < 0 || x >= N || z >= N) continue; const d = Math.hypot(x - f.x, z - f.z) * s - f.r, j = J(x, z); if (d < wd[j]) { wd[j] = d; wl[j] = f.level; wc[j] = f.carve; wb[j] = f.bed; wt[j] = f.topic; } } }
    // ground: base height, which topic owns it, how exposed it is to drying, how far growth has to reach
    const crackAt = (X, Z) => { const cs = 6, gx = Math.floor(X / cs), gz = Math.floor(Z / cs); let f1 = 99, f2 = 99; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const qx = (gx + a + hash2(gx + a, gz + b, 61)) * cs, qz = (gz + b + hash2(gx + a, gz + b, 62)) * cs, d = Math.hypot(X - qx, Z - qz); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; } return f2 - f1; };
    const rimW = 2.2 / Rw, depth = 20 * Math.pow(isl.size * E, 0.8);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const px = (x - c) / R, pz = (z - c) / R, o = Math.hypot(px, pz), j = J(x, z); if (o > E) continue;
      const mm = isl.mountain ? Math.pow(sstep(0.5, 0.02, Math.hypot(px - MT[0], (pz - MT[1]) * (pz > MT[1] ? 2.4 : 1.15))), 1.25) : 0;
      const wx = px + (fb(px * 3 + 9, pz * 3, 4) - 0.47) * 0.2, wz = pz + (fb(px * 3, pz * 3 + 7, 5) - 0.47) * 0.2;
      let d1 = 9, d2 = 9, b = 0;
      for (let i = 0; i < n; i++) { const d = Math.hypot(wx - seeds[i][0], wz - seeds[i][1]) - (i === 0 ? mm * 0.5 : 0) + (hash2(x, z, 3) - 0.5) * 0.03; if (d < d1) { d2 = d1; d1 = d; b = i; } else if (d < d2) d2 = d; }
      const heart = mm < 0.05 && Math.hypot(wx - HOL[0], wz - HOL[1]) < heartR, B = TOPICS[b].biome, rc = o * Rw;
      biome[j] = heart ? -1 : b;
      edge[j] = -sstep(0, 0.3, d2 - d1) * 0.7 + (fb(px * 6, pz * 6, 9) - 0.47) * 0.5;
      seedD[j] = Math.hypot(wx - seeds[b][0], wz - seeds[b][1]) + (fb(px * 7, pz * 7, 13) - 0.47) * 0.14;
      let h = G + fb(px * 2.3 + 3, pz * 2.3, 1) * 5;
      if (isl.mountain) { h += 26 * mm * (0.82 + fb(px * 7, pz * 7, 2) * 0.36); h += 13 * Math.pow(sstep(0.28, 0.02, Math.hypot(px + 0.3, (pz + 0.66) * 1.3)), 1.2) * (0.8 + fb(px * 9, pz * 9, 22) * 0.4); }
      else if (!heart && B === "highland") h += Math.max(0, fb(px * 4.5, pz * 4.5, 23) - 0.52) * 30;   // crags
      if (!heart && B === "lantern") h += Math.max(0, fb(px * 5, pz * 5, 12) - 0.56) * 24;
      if (isl.landmark === "academy") h = lerp(h, G + 4.5, sstep(21, 15, rc));   // the academy stands on a low flat hill
      if (isl.landmark === "amphitheatre") h = lerp(h, G + 1.5, sstep(21, 16, rc));
      let d = wd[j];
      if (isl.landmark === "statue" && rc < 4.4) { d = wd[j] = 0.6; h = G + 1.7; }   // islet for the plinth
      else if (arches && isl.patron && isl.patron !== "none" && Math.hypot(px - HOL[0], pz - HOL[1]) * Rw < 3) { d = wd[j] = 0.6; h = W0 + 0.9; }   // a rock in the hollow for the figure under the arches
      else if (d < 0) h = wl[j] - wb[j];
      else if (d < wc[j]) h = lerp(wl[j] + 0.6, h, sstep(0, wc[j], d));
      h0[j] = h;
      if (!heart && d > 1.5 && h < G + 12) crk[j] = crackAt(px * Rw, pz * Rw);
      rim[j] = o > E - rimW - 0.6 / R && d > 1.5 ? 1 : 0;
      botW[j] = G - 4 - depth * Math.sqrt(Math.max(0, 1 - (o / E) * (o / E))) * (0.7 + fb(px * 4, pz * 4, 16) * 0.6) + (hash2(x, z, 19) - 0.5) * 3;   // floating island: a rough rock bowl underneath
    }
    F = { wd, wl, wc, wb, wt, biome, edge, seedD, h0, crk, botW, rim, path, enter }; FIELDS.set(key, F);
    const mine = [...FIELDS.keys()].filter((q) => q.startsWith(isl.id + "|")); while (mine.length > 4) FIELDS.delete(mine.shift());   // keep only the last few sizes of this island
  }
  const { wd, wl, wc, wb, wt, biome, path, enter } = F, crackW = Math.max(0.75, s * 1.2);
  mark("fields");
  for (let j = 0; j < N * N; j++) {
    const b = biome[j]; if (b === -2) continue;
    if (b < 0) { dryness[j] = -1; dev[j] = 1; } else { const T = TOPICS[b]; dryness[j] = (1 - T.health) * 1.4 + F.edge[j]; dev[j] = F.seedD[j] < 0.08 + 0.56 * T.growth ? 1 : 0; }   // neglect dries a biome from its edges inward; growth spreads from its heart outward
    let h = F.h0[j];
    if (dryness[j] > 0.62 && F.crk[j] < crackW) { h -= Math.max(1.3, s * 2); crackA[j] = 1; }
    if (F.rim[j]) { h = G + 2; flag[j] = 1; crackA[j] = 0; }
    hw[j] = h; ht[j] = Math.max(2, Math.round(V(h))); bot[j] = Math.max(0, Math.min(ht[j] - 2, Math.round(V(F.botW[j]))));
  }
  // waterfall: a spring two thirds of the way up the mountain spills down the south face into the pool
  const falls = [];
  if (isl.mountain) {
    const W1v = Math.round(V(W1)), fx = Math.round(c + pts[0][0] * R), sz0 = Math.round(c + MT[1] * R), lipLevel = W1v + (ht[J(fx, sz0)] - W1v) * 0.68, fw = Math.max(1, Math.round(V(1.1))); let lipZ = sz0;
    for (let z = sz0; z < c; z++) if (ht[J(fx, z)] <= lipLevel) { lipZ = z; break; }
    const lipH = ht[J(fx, lipZ)], back = Math.max(2, Math.round(V(1.6)));
    for (let dx = -fw; dx <= fw; dx++) { const x = fx + dx; for (let z = lipZ - back; z < c; z++) { const j = J(x, z); if (z <= lipZ) { ht[j] = lipH - 1; flag[j] = 2; continue; } if (ht[j] <= W1v || wd[j] < 0) break; flag[j] = 3; } }
  }

  // --- fill the columns ---
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const j = J(x, z), h = ht[j]; if (h < 0) continue;
    const b = biome[j], B = b < 0 ? "heart" : TOPICS[b].biome, dry = dryness[j], d = wd[j], f = flag[j], hWu = hw[j], r = hash2(x, z, 6);
    let slope = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = ht[J(Math.min(N - 1, Math.max(0, x + dx)), Math.min(N - 1, Math.max(0, z + dz)))]; if (q >= 0) slope = Math.max(slope, h - q); }
    const steep = slope * s >= 2.2; steepA[j] = steep ? 1 : 0;
    const driedPond = d < 0 && wt[j] >= 0 && dryness[j] > 0.5, wet = d < 0 && !driedPond;
    let top;
    if (f === 1) top = M.rim;
    else if (driedPond) top = r < 0.3 ? M.crack : M.mud;
    else if (wet) top = B === "tropical" ? (r < 0.1 ? M.coral : r < 0.18 ? M.coral2 : M.sand) : (r < 0.2 ? M.stone : M.bank);
    else if (crackA[j]) top = M.crack;
    else if (hWu > G + 17 && dry < 0.55 && hash2(x, z, 8) > (steep ? 0.4 : 0)) top = M.snow;
    else if (B === "highland" && hWu > G + 4 && dry < 0.25 && hash2(x, z, 57) > 0.18 && fbm(x * s * 0.9, z * s * 0.9, 51) + (dev[j] ? 0.05 : -0.08) > 0.44 + 0.22 * clamp((hWu - G - 7) / 13, 0, 1)) top = T3[HS[b][0]][fbm(x * s * 0.5 + 9, z * s * 0.5, 52) > 0.5 ? 1 : 0];   // lichen: speckles on the ledges, thinning toward the snow
    else if (steep) top = B === "lantern" ? M.red : (h + (hash2(x >> 3, z >> 3, 8) * 3 | 0)) % 6 === 0 ? M.stone3 : hash2(x, z, 8) < 0.3 ? M.stone2 : M.stone;
    else if (d < 1.2) top = B === "tropical" ? M.sand : M.bank;
    else if (B === "tropical" && d < 3.4 && dry < 0.6) top = M.sand;
    else if (b < 0) top = paved ? (fbm(x * s * 0.5, z * s * 0.5, 55) > 0.58 ? M.moss : (x * s * 0.5 | 0) + (z * s * 0.5 | 0) & 1 ? M.obs1 : M.obs2) : r < 0.18 ? M.moss2 : M.heart;
    else if (dry > 0.6) top = fbm(x * s * 0.3, z * s * 0.3, 35) > 0.52 ? M.ash : M.cracked;
    else if (dry > 0.25 && r < (dry - 0.25) * 3) top = M.dry;
    else if (!dev[j]) top = r < 0.1 ? M[GROUND[B][0]] : M.fallow;
    else if (B === "highland" && hWu > G + 11) top = M.stone;
    else top = M[GROUND[B][fbm(x * s * 0.35, z * s * 0.35, 33) > 0.56 ? 1 : 0]];
    const sub = top === M.snow ? M.snow : B === "lantern" ? M.sand : B === "highland" ? M.stone : M.dirt, subD = Math.max(2, Math.round(V(1.6))), deepY = V(G - 9);
    // rock in bands, so only the exposed faces cost anything to look at
    const off = (hash2(x >> 3, z >> 3, 7) * 4) | 0, o2 = (hash2(x >> 1, z >> 1, 9) * 4) | 0, y0 = bot[j]; let gi = (y0 * N + z) * N + x;
    for (let y = y0; y < h; y++, gi += N * N) grid[gi] = f === 1 && y >= h - 1 ? M.rim : y > h - subD ? sub : (((y * s) | 0) + off) % 7 === 0 ? M.stone3 : y < deepY ? ((y + o2) & 2 ? M.stone3 : M.stone2) : (y + o2) % 3 === 0 ? M.stone2 : M.stone;
    grid[gi] = top; if (y0 < ymin[j]) ymin[j] = y0; if (h > ymax[j]) ymax[j] = h;
    if (wet) { const lv = Math.round(V(wl[j])); for (let y = h + 1; y <= lv; y++) put(x, y, z, M.water); }
    if (f === 2) put(x, h + 1, z, M.water);
    if (f === 3) { const up = ht[J(x, z - 1)] + (flag[J(x, z - 1)] === 2 ? 1 : 0), hi = Math.max(h + 1, up); for (let y = h + 1; y <= hi; y++) put(x, y, z, M.water); falls.push([x, z, h, hi]); }
  }
  // where high water meets low water, hang a curtain of falling water
  const cascade = [];
  if (arches) for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) { const j = J(x, z); if (wd[j] >= 0 || wt[j] >= 0) continue; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = J(x + dx, z + dz); if (wd[q] < 0 && wt[q] < 0 && wl[q] > wl[j] + 1) { const lo = Math.round(V(wl[j])), hi = Math.round(V(wl[q])); for (let y = lo + 1; y <= hi; y++) if (!grid[I(x, y, z)]) put(x, y, z, M.water); cascade.push([x, z, lo, hi]); break; } } }
  mark("terrain");

  // --- shapes ---
  const disc = (x, y, z, r, m) => { const k = Math.ceil(r); x = Math.round(x); z = Math.round(z); for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) if (dx * dx + dz * dz <= r * r + 0.3) (typeof m === "function" ? m : set)(x + dx, y, z + dz, m); };
  const box = (x, y, z, w, m) => { x = Math.round(x); z = Math.round(z); for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) set(x + a - ((w - 1) >> 1), y, z + b - ((w - 1) >> 1), m); };
  const blob = (cx, cy, cz, rx, ry, fn) => { const kx = Math.ceil(rx), ky = Math.ceil(ry); for (let dy = -ky; dy <= ky; dy++) for (let dz = -kx; dz <= kx; dz++) for (let dx = -kx; dx <= kx; dx++) { const q = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry); if (q <= 1.05) fn(Math.round(cx) + dx, Math.round(cy) + dy, Math.round(cz) + dz, q, dy); } };
  // leaves respond to drought: 0 alive, 1 wilting (thin, ochre, no glow), 2 gone. t: +1 top of the plant, -1 underside
  let HU = HS[0];   // tones of the topic being planted
  const rnd = (x, z, k) => hash2(x * 7 + k, z * 13 - k, 100 + k), pickOf = (x, z, k, arr) => arr[(rnd(x, z, k) * arr.length) | 0];
  const leafer = (st, x, z) => { const wn = rnd(x, z, 31) < 0.5 ? "wiltA" : "wiltB"; return (X, Y, Z, name, t = 0) => { if (st === 2) return; if (st === 1) { if (MATS[M[name]][4] || hash3(X, Y, Z) < 0.4) return; name = wn; } set(X, Y, Z, T3[name][t > 0.5 ? 2 : t < -0.2 ? 0 : 1]); }; };

  const PLANT = {
    bloom(x, y, z, u, st) {
      const L = leafer(st, x, z), hue = pickOf(x, z, 11, [HU[0], HU[0], HU[1], HU[3], HU[2]]), th = Math.max(2, Math.round(3.2 * u)), rad = Math.max(1.5, 2.4 * u), tw = Math.max(1, Math.round(0.4 * u)), wood = st === 2 ? M.deadwood : M.woodDark;
      for (let i = 0; i < th + rad * 0.6; i++) box(x, y + i, z, tw, wood);
      const cy = y + th + rad * 0.55, ry = rad * 0.8;
      blob(x, cy, z, rad, ry, (X, Y, Z, q, dy) => { L(X, Y, Z, q > 0.6 && hash3(Z, Y, X) < 0.028 ? HU[4] : hue, dy / ry); if (st === 0 && q > 0.72 && dy < -ry * 0.25 && hash3(X, Z, Y) < 0.16) { const len = 1 + hash3(Z, X, Y) * 2.4 * u; for (let k = 1; k <= len; k++) set(X, Y - k, Z, k > len - 1 ? M[HU[4]] : M.tendril); } });
      if (st === 2) for (let b = 0; b < 3; b++) { const a = b * 2.1 + rnd(x, z, 1) * 6; for (let k = 1; k <= rad * 0.9; k++) box(x + Math.cos(a) * k, Math.round(y + th + k * 0.7), z + Math.sin(a) * k, Math.max(1, tw - 1), wood); }
    },
    glowcap(x, y, z, u, st) {
      const L = leafer(st, x, z), hue = pickOf(x, z, 3, [HU[0], HU[0], HU[2], HU[1]]), hgt = Math.max(2, Math.round((2.8 + rnd(x, z, 2) * 1.6) * u)), capR = Math.max(1.5, 2.7 * u), capH = Math.max(1, Math.round(1.5 * u)), sr = Math.max(0.5, 0.42 * u);
      for (let i = 0; i < (st === 2 ? Math.ceil(hgt * 0.6) : hgt); i++) disc(x, y + i, z, sr * (1 + 0.3 * (1 - i / hgt)), st === 2 ? M.deadwood : M.stem);
      if (st === 2) return;
      disc(x, y + hgt - 1, z, capR * 0.72, (X, Y, Z) => L(X, Y, Z, "gill"));
      for (let dy = 0; dy <= capH; dy++) { const rr = capR * Math.sqrt(1 - (dy / (capH + 0.6)) ** 2); disc(x, y + hgt + dy, z, rr, (X, Y, Z) => { const e = Math.hypot(X - x, Z - z) > rr - 1.3; L(X, Y, Z, st === 0 && !e && hash3(X, Y, Z) < 0.1 ? HU[4] : hue, e ? -1 : dy >= capH * 0.6 ? 1 : 0); }); }
    },
    spire(x, y, z, u, st) {
      const L = leafer(st, x, z), hue = HU[1], hgt = Math.max(3, Math.round(6.2 * u)), br = Math.max(1, 1.5 * u), t0 = Math.max(1, Math.round(1.1 * u)), tier = Math.max(2, Math.round(1.5 * u));
      for (let i = 0; i < hgt * 0.92; i++) set(x, y + i, z, st === 2 ? M.deadwood : M.wood);
      for (let i = t0; i <= hgt; i++) { const tf = ((i - t0) % tier) / tier, rr = br * (1 - (i - t0) / (hgt - t0 + 1)) * (1.15 - tf * 0.5) + 0.35; disc(x, y + i, z, rr, (X, Y, Z) => L(X, Y, Z, hue, tf === 0 ? -1 : i > hgt * 0.75 ? 1 : 0)); }
    },
    crystal(x, y, z, u, st) {
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + rnd(x, z, 4) * 6, off = k ? 0.9 * u : 0, hgt = Math.max(2, (k ? 1.6 + rnd(x, z, 5 + k) * 2 : 3.4 + rnd(x, z, 5) * 2.2) * u), w = Math.max(1, Math.round((k ? 0.5 : 0.75) * u)), lean = (k ? 0.9 : 0.25) * u, m = st ? M.stone3 : (k + (rnd(x, z, 9) < 0.5 ? 1 : 0)) % 2 ? M[HU[5]] : M[HU[4]];
        for (let i = 0; i < hgt; i++) box(x + Math.cos(a) * (off + lean * i / hgt), y + i, z + Math.sin(a) * (off + lean * i / hgt), i > hgt * 0.8 ? Math.max(1, w - 1) : w, m); }
    },
    palm(x, y, z, u, st) {
      const L = leafer(st, x, z), hgt = Math.max(4, Math.round((4.8 + rnd(x, z, 2) * 1.8) * u)), a = rnd(x, z, 1) * 6.28, lean = 1.9 * u, tw = Math.max(1, Math.round(0.34 * u)); let tx = x, tz = z;
      for (let i = 0; i < (st === 2 ? hgt * 0.6 : hgt); i++) { const f = i / hgt; tx = x + Math.cos(a) * lean * f * f; tz = z + Math.sin(a) * lean * f * f; box(tx, y + i, tz, tw, st === 2 ? M.deadwood : M.palmTrunk); }
      if (st === 2) return;
      const fl = Math.max(2, 3 * u);
      for (let k = 0; k < 3; k++) L(Math.round(tx + Math.cos(k * 2.1 + a) * tw), y + hgt - 1 - (k & 1), Math.round(tz + Math.sin(k * 2.1 + a) * tw), k & 1 ? HU[5] : HU[4]);   // glowing fruit under the crown
      for (let k = 0; k < 7; k++) { const fa = (k / 7) * 6.28 + a; for (let q = 0; q <= fl; q += 0.5) { const f = q / fl, X = tx + Math.cos(fa) * q, Z = tz + Math.sin(fa) * q, Y = y + hgt + 0.6 * u * Math.sin(f * 2.6) - f * f * 1.7 * u; L(Math.round(X), Math.round(Y), Math.round(Z), f > 0.78 ? "frondTip" : HU[1], 1); if (u > 1.4 && f < 0.7) L(Math.round(X), Math.round(Y) - 1, Math.round(Z), HU[1], -1); } }
      blob(tx, y + hgt, tz, Math.max(1, 0.5 * u), Math.max(1, 0.5 * u), (X, Y, Z) => L(X, Y, Z, HU[2]));
    },
    jungle(x, y, z, u, st) {
      const L = leafer(st, x, z), hue = pickOf(x, z, 7, [HU[0], HU[1], HU[2], HU[3], HU[0]]), fr = rnd(x, z, 15) < 0.5 ? HU[4] : HU[5], th = Math.max(2, Math.round(2.6 * u)), rad = Math.max(1.5, 2.1 * u), tw = Math.max(1, Math.round(0.4 * u));
      for (let i = 0; i < th + rad * 0.5; i++) box(x, y + i, z, tw, st === 2 ? M.deadwood : M.wood);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + rnd(x, z, 6) * 6, o = k ? rad * 0.6 : 0, rr = rad * (k ? 0.7 : 1); blob(x + Math.cos(a) * o, y + th + rad * (k ? 0.35 : 0.65), z + Math.sin(a) * o, rr, rr * 0.75, (X, Y, Z, q, dy) => L(X, Y, Z, q > 0.65 && hash3(Z, Y, X) < 0.04 ? fr : hue, dy / (rr * 0.75))); }
    },
    bush(x, y, z, u, st, hues = [HU[0], HU[1], HU[3]]) { const L = leafer(st, x, z), hue = pickOf(x, z, 13, hues), r = Math.max(1, 0.95 * u); if (st === 2) return set(x, y, z, M.deadwood); blob(x, y + r * 0.5, z, r, r * 0.8, (X, Y, Z, q, dy) => L(X, Y, Z, hue, dy / (r * 0.8))); },
    baobab(x, y, z, u, st) {
      const L = leafer(st, x, z), hgt = Math.max(3, Math.round(3.8 * u)), trunk = st === 2 ? M.deadwood : M.bao, nb = 4 + (rnd(x, z, 2) < 0.5 ? 1 : 0);
      for (let i = 0; i < hgt; i++) disc(x, y + i, z, Math.max(0.5, (0.95 - 0.45 * i / hgt) * u), trunk);
      for (let b = 0; b < nb; b++) { const a = (b / nb) * 6.28 + rnd(x, z, 3) * 6, len = Math.max(2, Math.round(1.8 * u)); let bx = x, by = y + hgt - 1, bz = z;
        for (let k = 1; k <= len; k++) { bx = Math.round(x + Math.cos(a) * (0.4 * u + k)); bz = Math.round(z + Math.sin(a) * (0.4 * u + k)); by = y + hgt - 1 + Math.round(k * 0.55); set(bx, by, bz, trunk); }
        if (st === 2) continue;
        disc(bx, by + 1, bz, Math.max(1, 1.05 * u), (X, Y, Z) => L(X, Y, Z, HU[0], Math.hypot(X - bx, Z - bz) < 0.6 * u ? 1 : 0));
        const ps = Math.max(1, Math.round(0.5 * u)), pm = st ? M.wiltB : b % 2 ? M[HU[5]] : M[HU[4]]; set(bx, by - 1, bz, trunk);
        for (let dy = 0; dy < ps; dy++) for (let dx = 0; dx < ps; dx++) for (let dz = 0; dz < ps; dz++) set(bx + dx - ((ps - 1) >> 1), by - 2 - dy, bz + dz - ((ps - 1) >> 1), pm); }
    },
    fiddle(x, y, z, u, st) {
      const H3 = T3[pickOf(x, z, 14, [HU[0], HU[0], HU[1], HU[2]])], hgt = Math.max(3, Math.round((3.8 + rnd(x, z, 2) * 1.6) * u)), a = rnd(x, z, 1) * 6.28, dx = Math.cos(a), dz = Math.sin(a), tw = Math.max(1, Math.round(0.36 * u)), body = st === 2 ? M.deadwood : st === 1 ? M.wiltA : H3[0]; let tx = x, tz = z;
      for (let i = 0; i < (st === 2 ? hgt * 0.5 : hgt); i++) { const l = 0.5 * u * (i / hgt) ** 2; tx = x - dx * l; tz = z - dz * l; box(tx, y + i, tz, tw, body); if (st === 0 && i > hgt * 0.3 && i % 2 === 0) set(tx + (i % 4 ? -dz : dz) * tw, y + i, tz + (i % 4 ? dx : -dx) * tw, M.fan); }
      if (st === 2) return;
      const R0 = 1.3 * u, cx = tx + dx * R0, cy = y + hgt - 1, cz = tz + dz * R0, end = Math.PI * 3.2;
      for (let p = 0; p < end; p += 0.35 / Math.max(1, R0)) { const f = p / end, rho = R0 * (1 - 0.78 * f), m = st ? (f > 0.5 ? M.wiltB : M.wiltA) : f > 0.8 ? M[HU[4]] : Math.sin(p) > 0.2 ? H3[2] : H3[1]; box(cx - dx * Math.cos(p) * rho, Math.round(cy + Math.sin(p) * rho), cz - dz * Math.cos(p) * rho, f > 0.6 ? Math.max(1, tw - 1) : tw, m); }
    },
    fan(x, y, z, u, st) { const L = leafer(st, x, z); if (st === 2) return; const len = Math.max(2, 1.7 * u); for (let b = 0; b < 5; b++) { const a = b * 1.256 + rnd(x, z, 8) * 6; for (let k = 0; k <= len; k += 0.6) L(Math.round(x + Math.cos(a) * k * 0.75), Math.round(y + Math.sin((k / len) * 2.3) * 1.1 * u), Math.round(z + Math.sin(a) * k * 0.75), k > len * 0.8 ? "frondTip" : "fan", k > len * 0.4 ? 1 : 0); } },
  };
  const ELDER = { bloom: "bloom", glowcap: "glowcap", tropical: "jungle", lantern: "baobab", fern: "fiddle", highland: "crystal" };

  // --- landmarks: one library of shapes, built large at the centre of an island and small inside a topic that has filled its plot ---
  const markVox = [], clearings = [], groundAt = (x, z) => { x = Math.min(N - 1, Math.max(0, Math.round(x))); z = Math.min(N - 1, Math.max(0, Math.round(z))); return ht[J(x, z)]; };
  let mossy = true;
  const stamp = (x, y, z, m) => { if (!m) return; x = Math.round(x); y = Math.round(y); z = Math.round(z); if (inb(x, y, z) && grid[I(x, y, z)] === 0) { put(x, y, z, m); if (MATS[m][4]) glowVox.push(I(x, y, z)); else if (mossy) markVox.push(I(x, y, z)); } };
  const blocked = (x, z) => { for (const q of clearings) if ((x - q[0]) ** 2 + (z - q[1]) ** 2 < q[2] * q[2]) return true; return false; };
  const R1 = (v) => Math.max(1, Math.round(v)), adiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const cyl = (x, y, z, r, h, m) => { for (let i = 0; i < h; i++) disc(x, y + i, z, r, (X, Y, Z) => stamp(X, Y, Z, typeof m === "function" ? m(i) : m)); };
  const slab = (x0, x1, y, h, z0, z1, m) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) for (let z = Math.round(z0); z <= Math.round(z1); z++) for (let i = 0; i < h; i++) stamp(x, y + i, z, typeof m === "function" ? m(x, i, z) : m); };
  const ball = (x, y, z, r, m) => blob(x, y, z, Math.max(0.7, r), Math.max(0.7, r), (X, Y, Z) => stamp(X, Y, Z, m));
  const rod = (x0, y0, z0, x1, y1, z1, r, m) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * 2) + 1; for (let i = 0; i <= n; i++) { const f = i / n; if (r < 0.7) stamp(lerp(x0, x1, f), lerp(y0, y1, f), lerp(z0, z1, f), m); else ball(lerp(x0, x1, f), lerp(y0, y1, f), lerp(z0, z1, f), r, m); } };
  const figure = (x, z, base, u, P, bh = 9.5) => { const n = R1(bh * u); for (let i = 0; i < n; i++) { const f = i / n, r = (f < 0.6 ? lerp(2.2, 1.35, f / 0.6) : f < 0.86 ? lerp(1.35, 2.0, (f - 0.6) / 0.26) : lerp(2.0, 0.9, (f - 0.86) / 0.14)) * u, rz = r * 0.72, k = Math.ceil(r); for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) if ((dx * dx) / (r * r) + (dz * dz) / (rz * rz) <= 1) stamp(x + dx, base + i, z + dz, (dx + Math.round(i * 0.35)) % Math.max(3, Math.round(1.6 * u)) === 0 && f < 0.6 ? P.b : P.a); } ball(x, base + n + 1.0 * u, z, 1.25 * u, P.a); return base + n; };
  // every shape: (x, z of its centre, y of its floor, u = voxels per unit at this scale, P = its materials)
  const LM = {
    observatory(x, z, y0, u, P) {   // drum wall with a doorway, ribbed dome with a viewing slit, and the telescope pointing out through it
      const Rv = 8.2 * u, wallH = R1(5.5 * u), th = Math.max(1.2, 1.1 * u), slit = 0.9, band = Math.max(2, Math.round(1.2 * u)), K = Math.ceil(Rv);
      for (let dz = -K; dz <= K; dz++) for (let dx = -K; dx <= K; dx++) {
        const d = Math.hypot(dx, dz), a = Math.atan2(dz, dx); if (d > Rv + 0.3) continue;
        const fallen = adiff(a, 4.0) < 0.9, ragged = fbm(a * 2.6, 1.5, 77);
        if (d > Rv - th) { const hgt = fallen ? wallH * (0.25 + ragged * 0.7) : wallH + (ragged > 0.62 ? -1 : 0), door = adiff(a, 1.57) < 1.8 / Rv; for (let y = 0; y < hgt; y++) { if (door && y < wallH * 0.62) continue; stamp(x + dx, y0 + y, z + dz, y % band === 0 || y >= wallH - 1 ? P.b : P.a); } }
        for (let dy = 0; dy <= K; dy++) { const dd = Math.hypot(dx, dy, dz); if (dd > Rv + 0.3 || dd < Rv - th * 0.9) continue;
          const ribv = adiff((a + Math.PI * 2) % (Math.PI / 3), Math.PI / 6) > Math.PI / 6 - 0.6 / Math.max(2, d) || dy === 0, open = adiff(a, slit) < 0.34 && dy > Rv * 0.15, gone = fallen && fbm(a * 3 + dy * 0.2, dy * 0.3, 78) > 0.4;
          if (open || (gone && !ribv)) continue; if (ribv && fallen && fbm(a * 5, dy * 0.4, 80) > 0.62) continue;
          stamp(x + dx, y0 + wallH + dy, z + dz, ribv ? P.metal : P.roof); }
      }
      cyl(x, y0, z, 1.6 * u, R1(3.4 * u), P.b);
      const el = 0.82, tx = Math.cos(slit) * Math.cos(el), tz = Math.sin(slit) * Math.cos(el), ty = Math.sin(el), len = 22.5 * u;
      for (let k = -1.5 * u; k <= len; k += 0.5) ball(x + tx * k, y0 + 3.8 * u + ty * k, z + tz * k, Math.max(0.8, (k > len - 2.6 * u ? 1.9 : k < 3 * u ? 1.5 : 1.25) * u), k > len - 1 ? M.glass : ((k / (2.4 * u)) | 0) % 3 === 0 ? P.trim : P.metal);
    },
    statue(x, z, y0, u, P) {   // a hooded figure on a plinth, one arm raised with a light, the other broken off
      const pl = R1(2.2 * u), base = y0 + pl; for (let y = 0; y < pl; y++) disc(x, y0 + y, z, (y < pl - 1 ? 2.7 : 2.4) * u, (X, Y, Z) => stamp(X, Y, Z, y === pl - 1 ? P.b : P.trim));
      const top = figure(x, z, base, u, P), bh = top - base;
      blob(x, top + 1.2 * u, z - 0.5 * u, 1.5 * u, 1.5 * u, (X, Y, Z, q) => { if (q > 0.55 && Z < z + 0.3 * u) stamp(X, Y, Z, P.b); });
      for (let k = 0; k <= 5.2 * u; k += 0.5) { const f = k / (5.2 * u); ball(x + (1.8 + 1.5 * f) * u, base + bh * 0.84 + (f * 4.4 + Math.sin(f * 3.1) * 0.6) * u, z + 0.6 * u * f, 0.62 * u, P.a); }
      ball(x + 3.4 * u, base + bh * 0.84 + 5.6 * u, z + 0.6 * u, 0.95 * u, P.glow || M.orb);
      rod(x - 1.8 * u, base + bh * 0.82, z, x - 2.6 * u, base + bh * 0.82 - 1.2 * u, z, 0.6 * u, P.b);
    },
    academy(x, z, y0, u, P) {   // a colonnaded hall on steps, with a tiled roof and a brass dome; one corner has fallen in
      const st = R1(0.6 * u), hw = 8 * u, hd = 3.6 * u, ch = R1(6 * u), col = Math.max(0.6, 0.48 * u), ow = hw + 2 * u, od = hd + 2 * u;
      for (let i = 0; i < 3; i++) slab(x - ow - (2 - i) * 0.9 * u, x + ow + (2 - i) * 0.9 * u, y0 + i * st, st, z - od - (2 - i) * 0.9 * u, z + od + (2 - i) * 0.9 * u, i % 2 ? P.b : P.a);
      const y1 = y0 + 3 * st, broken = (k) => hash2(k, 7, 131) < 0.16; let k = 0;
      slab(x - hw, x + hw, y1, ch, z - hd, z + hd, (X, i) => (i % R1(1.5 * u) === 0 ? P.b : P.a));
      for (let cx = -ow + 0.6 * u; cx <= ow - 0.5 * u; cx += 2.3 * u) for (const sz of [-1, 1]) cyl(x + cx, y1, z + sz * (od - 0.6 * u), col, broken(k++) ? R1(ch * 0.4) : ch, P.a);
      for (let cz = -od + 2.9 * u; cz <= od - 2.8 * u; cz += 2.3 * u) for (const sx of [-1, 1]) cyl(x + sx * (ow - 0.6 * u), y1, z + cz, col, broken(k++) ? R1(ch * 0.5) : ch, P.a);
      const y2 = y1 + ch, ah = R1(0.9 * u), rh = R1(3.4 * u), ruin = (X, Z) => X > x + hw * 0.5 && Z < z + hd * 0.2 && fbm(X * s * 0.4, Z * s * 0.4, 132) > 0.47;
      slab(x - ow, x + ow, y2, ah, z - od, z + od, (X, i, Z) => (ruin(X, Z) ? 0 : P.b));
      for (let i = 0; i < rh; i++) { const f = 1 - i / rh; slab(x - ow, x + ow, y2 + ah + i, 1, z - od * f, z + od * f, (X, q, Z) => (ruin(X, Z) ? 0 : Math.abs(X - x) > ow - 1 ? P.b : (X + i) % R1(1.3 * u) === 0 ? P.roof2 : P.roof)); }
      const dy0 = y2 + ah + rh + R1(1.4 * u); cyl(x, y2 + ah + R1(rh * 0.4), z, 2.7 * u, dy0 - (y2 + ah + R1(rh * 0.4)), (i) => (i % R1(1.2 * u) === 0 ? P.b : P.a));
      blob(x, dy0, z, 2.95 * u, 2.95 * u, (X, Y, Z, q, dy) => { if (dy >= 0) stamp(X, Y, Z, P.metal); });
      cyl(x, dy0 + R1(2.9 * u), z, 0.5, R1(1.2 * u), P.metal); ball(x, dy0 + R1(2.9 * u) + R1(1.2 * u) + 0.5 * u, z, 0.75 * u, P.glow || P.metal);
    },
    amphitheatre(x, z, y0, u, P) {   // tiers of stone seats around a round floor, facing a ruined stage wall
      const r0 = 5.2 * u, r1 = 14.5 * u, tw = 1.5 * u, th = R1(0.85 * u), K = Math.ceil(r1);
      for (let dz = -K; dz <= K; dz++) for (let dx = -K; dx <= K; dx++) { const d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
        if (Math.abs(d - 4.5 * u) < 0.7) stamp(x + dx, y0, z + dz, P.trim);
        if (d < r0 || d > r1 || adiff(a, Math.PI / 2) < 0.95) continue;
        const t = Math.floor((d - r0) / tw); let hgt = (t + 1) * th; if (adiff(a, 3.75) < 0.3) hgt = Math.round(hgt * (0.2 + fbm(dx * s * 0.5, dz * s * 0.5, 133) * 0.7));
        const aisle = adiff(a, -Math.PI / 2) < 0.06 || adiff(a, -0.3) < 0.045 || adiff(a, Math.PI + 0.3) < 0.045;
        for (let i = 0; i < (aisle ? Math.max(1, hgt - th + 1) : hgt); i++) stamp(x + dx, y0 + i, z + dz, i >= hgt - 1 ? (t % 2 ? P.a : P.b) : P.b); }
      const wz = z + 7.8 * u, wh = R1(7 * u), ww = 9.5 * u;
      slab(x - ww, x + ww, y0, R1(0.7 * u), wz - 3.2 * u, wz - 1, P.b);
      slab(x - ww, x + ww, y0, wh, wz, wz + R1(1.3 * u), (X, i) => { const fx = (X - x) / u; if ([-5.5, 0, 5.5].some((q) => Math.abs(fx - q) < (q ? 1.1 : 1.5) && i < ((q ? 3.2 : 4.4) - Math.abs(fx - q) * 0.7) * u)) return 0; if (i > wh * (0.5 + fbm(X * s * 0.35, 3.3, 134) * 0.8)) return 0; return i % R1(1.6 * u) === 0 ? P.trim : P.a; });
      for (let q = -3; q <= 3; q++) if (q) cyl(x + q * 2.6 * u, y0 + R1(0.7 * u), wz - 1.6 * u, Math.max(0.6, 0.45 * u), hash2(q, 3, 135) < 0.3 ? R1(2.2 * u) : R1(5 * u), (i) => (i === 0 ? P.b : P.a));
    },
    pipes(x, z, y0, u, P) {   // organ pipes
      const bh = R1(1.1 * u); slab(x - 5.4 * u, x + 5.4 * u, y0, bh, z - 1.5 * u, z + 1.5 * u, P.b);
      for (let i = -3; i <= 3; i++) { const hgt = R1((11 - Math.abs(i) * 1.7) * u), mouth = R1(1.3 * u); cyl(x + i * 1.5 * u, y0 + bh, z, Math.max(0.6, 0.58 * u), hgt, (k) => (k === mouth ? M.crack : k >= hgt - R1(0.8 * u) ? P.trim : P.metal)); }
      for (const sd of [-1, 1]) cyl(x + sd * 5.2 * u, y0 + bh, z, Math.max(0.6, 0.5 * u), R1(4 * u), P.a);
      ball(x, y0 + bh + R1(11 * u) + 0.9 * u, z, 0.75 * u, P.glow);
    },
    lighthouse(x, z, y0, u, P) {
      const h = R1(11 * u), bandH = R1(2.2 * u), cap = R1(1.6 * u), lamp = R1(1.7 * u); for (let i = 0; i < h; i++) disc(x, y0 + i, z, lerp(2.1, 1.35, i / h) * u, (X, Y, Z) => stamp(X, Y, Z, ((i / bandH) | 0) % 2 ? P.trim : P.a));
      disc(x, y0 + h, z, 2.3 * u, (X, Y, Z) => stamp(X, Y, Z, P.b)); cyl(x, y0 + h + 1, z, 1.2 * u, lamp, P.glow || P.b);
      for (let i = 0; i < cap; i++) disc(x, y0 + h + 1 + lamp + i, z, 1.6 * u * (1 - i / cap) + 0.3, (X, Y, Z) => stamp(X, Y, Z, P.roof));
    },
    windmill(x, z, y0, u, P) {
      const h = R1(8 * u); for (let i = 0; i < h; i++) disc(x, y0 + i, z, lerp(2.2, 1.4, i / h) * u, (X, Y, Z) => stamp(X, Y, Z, i % R1(2.5 * u) === 0 ? P.b : P.a));
      ball(x, y0 + h + 0.4 * u, z, 1.6 * u, P.roof); const hy = y0 + h - 0.2 * u, hz = z + 2 * u; ball(x, hy, hz, 0.6 * u, P.metal);
      for (let b = 0; b < 4; b++) { const a = b * Math.PI / 2 + 0.5, ca = Math.cos(a), sa = Math.sin(a), L = 6 * u; rod(x, hy, hz, x + ca * L, hy + sa * L, hz, 0.4, P.metal); for (let k = 1.4 * u; k < L; k += 0.5) for (let w = 1; w <= R1(1.2 * u); w++) stamp(x + ca * k - sa * w, hy + sa * k + ca * w, hz, P.trim); }
    },
    coil(x, z, y0, u, P) {   // a mast with rings and a glowing ball
      const bh = R1(1.3 * u), h = R1(8 * u); slab(x - 2.2 * u, x + 2.2 * u, y0, bh, z - 2.2 * u, z + 2.2 * u, P.b); cyl(x, y0 + bh, z, Math.max(0.7, 0.75 * u), h, (k) => (k % R1(1.4 * u) === 0 ? P.b : P.metal));
      [[3, 2.6], [5, 2.1], [6.8, 1.6]].forEach(([hh, rr]) => { const K = Math.ceil(rr * u) + 1; for (let dz = -K; dz <= K; dz++) for (let dx = -K; dx <= K; dx++) if (Math.abs(Math.hypot(dx, dz) - rr * u) < 0.62) stamp(x + dx, y0 + bh + R1(hh * u), z + dz, P.trim); });
      ball(x, y0 + bh + h + 1.1 * u, z, 1.6 * u, P.glow || P.metal);
    },
    solids(x, z, y0, u, P) {   // a stepped pyramid with a solid floating over it
      const th = R1(1.5 * u); [4.8, 3.7, 2.6, 1.5].forEach((hw, i) => slab(x - hw * u, x + hw * u, y0 + i * th, th, z - hw * u, z + hw * u, (X, q) => (q === th - 1 ? (i % 2 ? P.b : P.trim) : i % 2 ? P.a : P.b)));
      const cy = y0 + 4 * th + R1(2.4 * u), r = R1(1.5 * u); for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= r) stamp(x + dx, cy + dy, z + dz, P.glow || P.metal);
    },
    colonnade(x, z, y0, u, P) {
      const st = R1(0.7 * u), h = R1(6.5 * u), col = Math.max(0.6, 0.55 * u), cx = (i) => x + (i - 2.5) * 2.4 * u, at = R1(0.9 * u); slab(x - 7.2 * u, x + 7.2 * u, y0, st, z - 1.7 * u, z + 1.7 * u, P.b);
      for (let i = 0; i < 6; i++) { const hh = i === 4 ? R1(h * 0.5) : i === 5 ? R1(h * 0.25) : h; cyl(cx(i), y0 + st, z, col, hh, (k) => (k === 0 || k >= hh - 1 ? P.b : P.a)); }
      slab(cx(0) - u, cx(3) + u, y0 + st + h, at, z - u, z + u, P.b); slab(cx(0) - u, cx(3) + u, y0 + st + h + at, R1(0.5 * u), z - 1.2 * u, z + 1.2 * u, P.trim); ball(cx(1.5), y0 + st + h + at + R1(0.5 * u) + 0.6 * u, z, 0.65 * u, P.glow);
    },
    circle(x, z, y0, u, P) {   // standing stones
      const n = 8, rr = 4.6 * u, tops = []; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + 0.2, hh = R1((3.2 + hash2(i, 5, 136) * 1.2) * u), sx = x + Math.cos(a) * rr, sz = z + Math.sin(a) * rr; cyl(sx, y0, sz, Math.max(0.7, 0.62 * u), hh, P.a); tops.push([sx, y0 + hh, sz]); }
      for (const i of [0, 2, 5]) { const p = tops[i], q = tops[(i + 1) % n], hy = Math.max(p[1], q[1]); rod(p[0], hy, p[2], q[0], hy, q[2], Math.max(0.7, 0.5 * u), P.b); }
      cyl(x, y0, z, 1.3 * u, R1(0.8 * u), P.trim); ball(x, y0 + R1(0.8 * u) + 0.7 * u, z, 0.8 * u, P.glow || P.b);
    },
    kit(x, z, y0, u, P, v = 0) {   // for a subject with nothing of its own in the library: an obelisk, a tiered tower or a domed pavilion
      if (v === 0) { const h = R1(10 * u), ph = R1(1.4 * u); for (let i = 0; i < h; i++) { const w = lerp(2.4, 1.1, i / h) * u / 2; slab(x - w, x + w, y0 + i, 1, z - w, z + w, i % R1(3 * u) === 0 ? P.trim : P.a); } for (let i = 0; i < ph; i++) disc(x, y0 + h + i, z, 0.9 * u * (1 - i / ph) + 0.3, (X, Y, Z) => stamp(X, Y, Z, P.glow || P.metal)); }
      else if (v === 1) { let y = y0; [[3, 3], [2.3, 2.6], [1.6, 2.4]].forEach(([hw, hh]) => { slab(x - hw * u, x + hw * u, y, R1(hh * u), z - hw * u, z + hw * u, P.a); y += R1(hh * u); slab(x - (hw + 0.8) * u, x + (hw + 0.8) * u, y, R1(0.5 * u), z - (hw + 0.8) * u, z + (hw + 0.8) * u, P.roof); y += R1(0.5 * u); }); ball(x, y + 0.6 * u, z, 0.75 * u, P.glow || P.metal); }
      else { const fh = R1(0.7 * u), h = R1(4.5 * u); slab(x - 3 * u, x + 3 * u, y0, fh, z - 3 * u, z + 3 * u, P.b); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(x + a * 2.3 * u, y0 + fh, z + b * 2.3 * u, Math.max(0.6, 0.5 * u), h, P.a); slab(x - 3 * u, x + 3 * u, y0 + fh + h, fh, z - 3 * u, z + 3 * u, P.b); blob(x, y0 + 2 * fh + h, z, 2.8 * u, 2.6 * u, (X, Y, Z, q, dy) => { if (dy >= 0) stamp(X, Y, Z, P.metal); }); ball(x, y0 + fh + 1.2 * u, z, 0.8 * u, P.glow || P.trim); }
    },
    athena(x, z, y0, u, P) {   // helmet with a crest, spear, round shield
      const pl = R1(1.2 * u), base = y0 + pl; cyl(x, y0, z, 2.3 * u, pl, P.b); const top = figure(x, z, base, u, P, 8.5), bh = top - base, hy = top + 1.0 * u, sr = 2 * u, kk = Math.ceil(sr);
      blob(x, hy + 0.3 * u, z, 1.45 * u, 1.3 * u, (X, Y, Z, q, dy) => { if (dy >= 0 || Z < z) stamp(X, Y, Z, P.metal); });
      for (let k = -1.7 * u; k <= 1.2 * u; k += 0.5) for (let dy = 0; dy < R1(1.1 * u); dy++) stamp(x, hy + 1.4 * u + dy, z + k, P.trim);
      rod(x + 2.9 * u, base, z + 0.6 * u, x + 2.9 * u, top + 3.4 * u, z + 0.6 * u, 0.4, P.metal); ball(x + 2.9 * u, top + 3.8 * u, z + 0.6 * u, 0.55 * u, P.glow || P.metal);
      rod(x + 1.5 * u, base + bh * 0.84, z, x + 2.8 * u, base + bh * 0.62, z + 0.6 * u, 0.55 * u, P.a);
      for (let dy = -kk; dy <= kk; dy++) for (let dx = -kk; dx <= kk; dx++) { const d = Math.hypot(dx, dy); if (d <= sr) for (let t = 0; t < R1(0.4 * u); t++) stamp(x - 1.9 * u + dx, base + bh * 0.5 + dy, z + 1.5 * u + t, d < sr * 0.3 || d > sr - 1 ? P.trim : P.metal); }
    },
    saraswati(x, z, y0, u, P) {   // seated on a lotus with a veena, a halo behind her, a swan beside
      const lh = R1(0.9 * u); for (let i = 0; i < lh; i++) disc(x, y0 + i, z, (2.8 + (0.3 * i) / lh) * u, (X, Y, Z) => stamp(X, Y, Z, ((Math.atan2(Z - z, X - x) * 5 + 20) | 0) % 2 ? M.pink : M.blush));
      const b = y0 + lh, th = R1(3.3 * u); blob(x, b + 0.9 * u, z, 2.3 * u, 1.05 * u, (X, Y, Z) => stamp(X, Y, Z, P.a));
      for (let i = 0; i < th; i++) { const r = lerp(1.5, 1.15, i / th) * u, k = Math.ceil(r); for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) if ((dx * dx) / (r * r) + (dz * dz) / (r * r * 0.56) <= 1) stamp(x + dx, b + R1(1.6 * u) + i, z + dz, (dx + i) % R1(1.8 * u) === 0 ? P.trim : P.a); }
      const sh = b + R1(1.6 * u) + th, hy = sh + 1.0 * u, cr = R1(1.3 * u), hr = 1.9 * u, hk = Math.ceil(hr) + 1; ball(x, hy, z, 1.0 * u, P.a);
      for (let i = 0; i < cr; i++) disc(x, Math.round(hy + 0.9 * u) + i, z, 0.7 * u * (1 - i / cr) + 0.3, (X, Y, Z) => stamp(X, Y, Z, P.metal));
      for (let dy = -hk; dy <= hk; dy++) for (let dx = -hk; dx <= hk; dx++) if (Math.abs(Math.hypot(dx, dy) - hr) < 0.6) stamp(x + dx, hy + dy, z - 1.2 * u, P.glow || P.metal);
      rod(x - 2.6 * u, b + 1.5 * u, z + 1.6 * u, x + 2.9 * u, sh + 0.9 * u, z + 1.2 * u, 0.4, M.wood); ball(x - 2.6 * u, b + 1.4 * u, z + 1.6 * u, 0.95 * u, P.metal); ball(x + 2.5 * u, sh + 0.6 * u, z + 1.2 * u, 0.6 * u, P.metal);
      rod(x - 1.3 * u, sh - 0.4 * u, z + 0.3 * u, x - 1.5 * u, b + 2.2 * u, z + 1.4 * u, 0.5 * u, P.a); rod(x + 1.3 * u, sh - 0.4 * u, z + 0.3 * u, x + 1.6 * u, sh - 1.5 * u, z + 1.2 * u, 0.5 * u, P.a);
      for (const sd of [-1, 1]) { rod(x + sd * 1.4 * u, sh, z, x + sd * 2.4 * u, sh + 1.5 * u, z, 0.45 * u, P.a); ball(x + sd * 2.5 * u, sh + 2 * u, z, 0.5 * u, P.trim); }
      ball(x + 3.7 * u, y0 + 0.8 * u, z + 2.3 * u, 0.9 * u, M.marble); rod(x + 3.9 * u, y0 + 1.3 * u, z + 2.7 * u, x + 4.2 * u, y0 + 2.7 * u, z + 3 * u, 0.4, M.marble); stamp(x + 4.2 * u, y0 + 2.7 * u, z + 3 * u + 1, M.brass);
    },
  };
  const CENTRAL = { a: M.marble, b: M.marble2, trim: M.obs2, metal: M.brass, glow: M.goldGlow, roof: M.roofT, roof2: M.roofT2 };
  // a topic's landmark is weathered stone at 100%, clean stone with the topic's colour at 130%, bronze at 160% and gold at 200%
  const tierOf = (g) => (g >= 2 ? 3 : g >= 1.6 ? 2 : g >= 1.3 ? 1 : 0);
  const tierPal = (g, k) => [{ a: M.obs1, b: M.obs2, trim: M.obs2, metal: M.stone3, glow: 0, roof: M.obs1, roof2: M.obs2 }, { a: M.marble, b: M.marble2, trim: M[HS[k][0]], metal: M.bronze, glow: M[HS[k][4]], roof: M[HS[k][0]], roof2: M[HS[k][1]] }, { a: M.bronze, b: M.bronze2, trim: M[HS[k][0]], metal: M.brass, glow: M[HS[k][4]], roof: M.bronze2, roof2: M.bronze }, { a: M.gold, b: M.gold2, trim: M[HS[k][0]], metal: M.gold2, glow: M.goldGlow, roof: M.gold2, roof2: M.gold }][tierOf(g)];
  if (arches) {   // weathered stone ribs spanning the hollow, with a figure beneath them if one has been chosen
    const hollowX = c + HOL[0] * R, hollowZ = c + HOL[1] * R;
    const rib = (ax, az, bx, bz, hgt, r, lx, lz, t0 = 0, t1 = Math.PI) => {
      const A = [hollowX + V(ax), hollowZ + V(az)], B = [hollowX + V(bx), hollowZ + V(bz)], ya = groundAt(A[0], A[1]) - V(1.5), yb = groundAt(B[0], B[1]) - V(1.5), steps = Math.ceil((V(Math.hypot(bx - ax, bz - az)) + V(hgt) * 2) * 1.6);
      for (let i = 0; i <= steps; i++) { const t = lerp(t0, t1, i / steps), f = (1 - Math.cos(t)) / 2, sn = Math.sin(t), brk = t0 > 0 ? t - t0 : t1 < Math.PI ? t1 - t : 9, rr = V(r) * (1.3 - 0.5 * sn) * (0.55 + 0.45 * Math.min(1, brk * 1.4));
        const cx = lerp(A[0], B[0], f) + V(lx) * sn, cz = lerp(A[1], B[1], f) + V(lz) * sn, cy = lerp(ya, yb, f) + V(hgt) * sn;
        blob(cx, cy, cz, rr, Math.max(1, rr * 0.8), (X, Y, Z) => { const bnd = Math.round(t * 9 + hash2(X >> 2, Z >> 2, 71) * 1.5); stamp(X, Y, Z, bnd % 5 === 0 ? M.arch3 : hash3(X >> 1, Y >> 1, Z >> 1) < 0.4 ? M.arch2 : M.arch1); }); }
    };
    rib(-16, 0.5, 17, 0, 25, 1.9, 0, 0.5);
    rib(-12, -2.5, 13, -3.5, 19.5, 1.7, 0, -2.5);
    rib(-12.5, 2, 13.5, 3.5, 15, 1.6, 0, 1.5);
    rib(-11, 5.5, 10.5, 9.5, 10.5, 1.4, 0, 3.5);
    rib(-9.5, -6, 9.5, -10.5, 12.5, 1.3, 0, -4.5);
    rib(-14.5, 7, 6, 15, 15, 1.25, 0, 3, 0, Math.PI * 0.5);            // broken ribs
    rib(-4, -15, 15, -7.5, 17, 1.25, 0, -3, Math.PI * 0.42, Math.PI);
    if (LM[isl.patron]) { const hx = Math.round(hollowX), hz = Math.round(hollowZ); mossy = false; LM[isl.patron](hx, hz, groundAt(hx, hz) + 1, V(0.8), { a: M.marble, b: M.marble2, trim: M.gold, metal: M.brass, glow: M.goldGlow }); mossy = true; }
  } else {
    const st = isl.landmark === "statue"; LM[isl.landmark](c, c, groundAt(c, c) + 1, V(st ? 1.4 : 1), st ? { a: M.stat1, b: M.stat2, trim: M.obs2, metal: M.brass, glow: M.orb } : CENTRAL);
    clearings.push([c, c, V({ academy: 15, amphitheatre: 16 }[isl.landmark] || 9.5)]);
  }
  const SCALE = { observatory: 0.46, pipes: 0.72, lighthouse: 0.8, windmill: 0.8, coil: 0.8, solids: 0.78, colonnade: 0.75, circle: 0.85, kit: 0.75 }, FOOT = { observatory: 8.5, pipes: 5.6, colonnade: 7.4, circle: 5.4, solids: 5 };
  TOPICS.forEach((t, i) => {   // a topic that has filled its plot gets a landmark of its own
    if (t.growth < 1 || !LM[t.mark]) return;
    const a = seeds[i][2], q = t.biome === "highland" && isl.mountain ? [0.3, -0.36] : [Math.cos(a + 0.42) * 0.8, Math.sin(a + 0.42) * 0.8], sc = SCALE[t.mark] * (1 + 0.1 * tierOf(t.growth)), fr = Math.round(V((FOOT[t.mark] || 3.4) * sc));
    let best = null, bv = 1e9;
    for (let k = 0; k < 50; k++) { const X = Math.round(c + q[0] * R + (hash2(k, i, 141) - 0.5) * V(k < 8 ? 2 : 10)), Z = Math.round(c + q[1] * R + (hash2(k, i, 142) - 0.5) * V(k < 8 ? 2 : 10)); if (X < fr + 2 || Z < fr + 2 || X > N - fr - 3 || Z > N - fr - 3) continue;
      let lo = 1e9, hi = -1e9, bad = false; for (let e = -1; e <= 1; e++) for (let f = -1; f <= 1; f++) { const jj = J(X + e * fr, Z + f * fr); if (ht[jj] < 0 || wd[jj] < 2 || flag[jj]) bad = true; lo = Math.min(lo, ht[jj]); hi = Math.max(hi, ht[jj]); }
      const v = hi - lo + (biome[J(X, Z)] === i ? 0 : V(4)) + k * 0.02; if (!bad && v < bv) { bv = v; best = [X, Z, hi]; } }
    if (!best) return;
    const [X, Z, hi] = best, P = tierPal(t.growth, i); mossy = tierOf(t.growth) === 0;
    for (let dz = -fr; dz <= fr; dz++) for (let dx = -fr; dx <= fr; dx++) if (dx * dx + dz * dz <= fr * fr * 1.2) { const jj = J(X + dx, Z + dz); if (ht[jj] >= 0) for (let y = ht[jj] + 1; y <= hi; y++) stamp(X + dx, y, Z + dz, P.b); }   // a footing, so it stands level
    LM[t.mark](X, Z, hi + 1, V(sc), P, (t.name.length + i) % 3); mossy = true; clearings.push([X, Z, fr * 1.35]);
  });

  // --- plants ---
  const spots = TOPICS.map(() => []), heartSpots = [], stateAt = (j) => (dryness[j] > 0.6 ? 2 : dryness[j] > 0.25 ? 1 : 0), u0 = V(1);
  const free = (x, z) => { const j = J(x, z), h = ht[j]; return h >= 0 && !blocked(x, z) && !flag[j] && wd[j] > 1.4 && !steepA[j] && !crackA[j] && get(x, h + 1, z) === 0; };
  if (E > 1.05) for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {   // where the island used to end
    const px = (x - c) / R, pz = (z - c) / R, o = Math.hypot(px, pz); if (Math.abs(o - 1) * Rw > 0.8) continue;
    const j = J(x, z), a = Math.atan2(pz, px); if (ht[j] < 0 || wd[j] < 1.8 || flag[j] || fbm(a * 5 + 3, 2.5, 88) < 0.46) continue;
    const hgt = V(0.7 + 2.6 * fbm(a * 17, 4.5, 89) * sstep(1.05, 1.2, E)); for (let y = 1; y <= hgt; y++) stamp(x, ht[j] + y, z, (y + x + z) % 5 === 0 ? M.obs2 : M.rim);
  }
  TOPICS.forEach((t, i) => {   // an elder at the heart of each well-grown biome, and another out in the new land once it has outgrown its plot
    HU = HS[i];
    if (t.growth > 1.3) { const a = seeds[i][2]; let x = Math.round(c + Math.cos(a) * 1.13 * R), z = Math.round(c + Math.sin(a) * 1.13 * R); for (let k = 0; k < 30 && !(inb(x, 0, z) && free(x, z)); k++) { x += Math.round((hash2(k, i, 83) - 0.5) * V(4)); z += Math.round((hash2(k, i, 84) - 0.5) * V(4)); x = clamp(x, 1, N - 2); z = clamp(z, 1, N - 2); } if (free(x, z)) PLANT[ELDER[t.biome]](x, ht[J(x, z)] + 1, z, u0 * (1.2 + 1.2 * (t.growth - 1.3)), stateAt(J(x, z))); }
    if (t.growth <= 0.5) return;
    const p = t.biome === "highland" && isl.mountain ? [-0.2, -0.42] : seeds[i]; let x = Math.round(c + p[0] * R), z = Math.round(c + p[1] * R);
    for (let k = 0; k < 40 && !free(x, z); k++) { x += Math.round((hash2(k, i, 81) - 0.5) * V(5)); z += Math.round((hash2(k, i, 82) - 0.5) * V(5)); x = Math.min(N - 2, Math.max(1, x)); z = Math.min(N - 2, Math.max(1, z)); }
    if (free(x, z)) PLANT[ELDER[t.biome]](x, ht[J(x, z)] + 1, z, u0 * (1.1 + 1.5 * (Math.min(t.growth, 1.5) - 0.5)), stateAt(J(x, z)));
  });
  const gs = Math.max(2, Math.round(V(1.9)));
  for (let gz = 0; gz < N / gs; gz++) for (let gx = 0; gx < N / gs; gx++) {
    const x = Math.min(N - 2, gx * gs + ((hash2(gx, gz, 41) * gs) | 0)), z = Math.min(N - 2, gz * gs + ((hash2(gx, gz, 42) * gs) | 0)); if (x < 1 || z < 1 || !free(x, z)) continue;
    const j = J(x, z), b = biome[j], y = ht[j] + 1, r = hash2(gx, gz, 43), r2 = hash2(gx, gz, 44);
    if (b < 0) { if (r < 0.3) PLANT.fan(x, y, z, u0 * (0.7 + r2 * 0.5), 0); else if (r < 0.42) PLANT.bush(x, y, z, u0 * (0.7 + r2 * 0.4), 0, ["moss", "moss2", "j2"]); continue; }
    const T = TOPICS[b], B = T.biome, g = Math.min(T.growth, 1.25), st = stateAt(j); HU = HS[b];
    if (st === 2 && r2 < 0.55) continue;
    if (!dev[j]) { if (r < 0.05 && st < 2) PLANT.bush(x, y, z, u0 * 0.5, st, ["moss", "moss2"]); continue; }
    const open = fbm(x * s * 0.11 + 40, z * s * 0.11, 37) > 0.6;
    const u = u0 * (0.4 + 0.42 * g) * (0.75 + 0.5 * r2), p = (open ? r * 6 : r) / (0.45 + 0.55 * g);
    if (B === "bloom") { if (p < 0.22) PLANT.bloom(x, y, z, u, st); }
    else if (B === "glowcap") { if (p < 0.12) PLANT.glowcap(x, y, z, u, st); else if (p < 0.34) PLANT.glowcap(x, y, z, u * 0.45, st); }
    else if (B === "highland") { if (hw[j] < G + 13 && p < 0.26) PLANT.spire(x, y, z, u, st); else if (hw[j] < G + 13 ? p < 0.34 : p < 0.035) PLANT.crystal(x, y, z, u * 0.8, st); }
    else if (B === "tropical") { if (wd[j] < 4 ? p < 0.3 : p < 0.13) PLANT.palm(x, y, z, u, st); else if (wd[j] >= 4 && p < 0.42) PLANT.jungle(x, y, z, u, st); else if (wd[j] >= 3 && p < 0.75) PLANT.bush(x, y, z, u, st); }
    else if (B === "lantern") { if (p < 0.11) PLANT.baobab(x, y, z, u, st); else if (p < 0.2) PLANT.bush(x, y, z, u * 0.55, st, ["tuft", HU[0]]); }
    else if (B === "fern") { if (p < 0.2) PLANT.fiddle(x, y, z, u, st); else if (p < 0.55) PLANT.fan(x, y, z, u * 0.8, st); }
  }
  mark("plants");
  const clear = (x, z) => { const q = Math.round(V(2.2)), lim = V(1.2); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const jj = J(Math.min(N - 1, Math.max(0, x + a * q)), Math.min(N - 1, Math.max(0, z + b * q))); if (ht[jj] < 0 || ymax[jj] - ht[jj] > lim || Math.abs(ht[jj] - ht[J(x, z)]) > lim || wd[jj] < 1) return false; } return true; };
  // small things, and places where animals can live
  for (let z = 2; z < N - 2; z++) for (let x = 2; x < N - 2; x++) {
    const j = J(x, z), h = ht[j]; if (h < 0 || flag[j] || wd[j] < 0 || crackA[j]) continue;
    const b = biome[j], st = b < 0 ? 0 : stateAt(j), p0 = hash2(x, z, 21), near = wd[j] < 1.4;
    if (near) { if (st < 2 && hash2(x, z, 23) < 0.2) { set(x, h + 1, z, M.reed); if (hash2(x, z, 24) < 0.5) set(x, h + 2, z, M.reed); } continue; }
    if (steepA[j] || get(x, h + 1, z)) continue;
    if (b < 0) { if (hash2(x, z, 17) < 1800 / (N * N)) heartSpots.push([x, h + 1, z]); if (p0 < 0.03) { set(x, h + 1, z, M.vine); set(x, h + 2, z, M.glowpod); } else if (p0 < 0.1 && arches) set(x, h + 1, z, M.moss2); continue; }
    const T = TOPICS[b], B = T.biome, g = Math.min(T.growth, 1.2), p = p0 / (g * g + 0.05);
    if (st === 0 && dev[j] && wd[j] > 5 && hash2(x, z, 17) < 6000 / (N * N) && spots[b].length < 400 && clear(x, z)) spots[b].push([x, h + 1, z]);
    if (st === 2) { if (p0 < 0.01) set(x, h + 1, z, M.deadwood); else if (p0 < 0.016) set(x, h + 1, z, M.bone); continue; }
    if (st === 1) { if (p0 < 0.03) set(x, h + 1, z, M.wiltA); continue; }
    if (!dev[j]) { if (p0 < 0.012) set(x, h + 1, z, M.moss); continue; }
    if (B === "bloom" && p < 0.13) set(x, h + 1, z, p < 0.04 ? M.fYellow : p < 0.07 ? M.fWhite : p < 0.085 ? M[HS[b][4]] : M.fViolet);
    else if (B === "glowcap" && p < 0.05) set(x, h + 1, z, p < 0.02 ? M[HS[b][4]] : p < 0.035 ? M[HS[b][2]] : M.stem);
    else if (B === "highland" && p < 0.02 && hw[j] < G + 13) set(x, h + 1, z, p < 0.006 ? M[HS[b][4]] : M.fWhite);
    else if (B === "tropical" && p < 0.1 && wd[j] > 3.4) set(x, h + 1, z, p < 0.02 ? M[HS[b][4]] : p < 0.03 ? M[HS[b][5]] : p < 0.045 ? M.coral : M[HS[b][1]]);
    else if (B === "lantern" && p < 0.07) { set(x, h + 1, z, M.tuft); if (p < 0.02) set(x, h + 2, z, M.tuft); }
    else if (B === "fern" && p < 0.06) set(x, h + 1, z, p < 0.015 ? M[HS[b][4]] : M.fan);
  }
  // moss, shrubs and hanging vines on the landmark
  for (const i of markVox) { const x = i % N, z = ((i / N) | 0) % N, y = (i / (N * N)) | 0, r = hash3(x, y, z);
    if (y + 1 < H && grid[i + N * N] === 0) { if (fbm(x * s * 0.5, z * s * 0.5, 91) + r * 0.25 > (arches ? 0.6 : 0.82)) grid[i] = r < 0.2 ? M.moss2 : M.moss; if (r < 0.012) PLANT.bush(x, y + 1, z, u0 * (0.5 + r * 30), 0, ["j1", "moss", "moss2"]); else if (r < 0.03 && arches) { set(x, y + 1, z, M.vine); set(x, y + 2, z, M.glowpod); } }
    else if (y > 0 && grid[i - N * N] === 0 && r < 0.018) { const len = V(1.5 + hash3(z, y, x) * (arches ? 6 : 3)); for (let k = 1; k <= len; k++) { if (get(x, y - k, z)) break; set(x, y - k, z, k > len - 1 ? M.glowpod : M.vine); } } }
  // bones in the dead places: small skeletons on the surface, bigger ones mostly buried, shells set into the ground
  const skeleton = (x, z, ang, sc, sink) => {
    const u = u0 * sc, dx = Math.cos(ang), dz = Math.sin(ang), L = 9 * u, w = Math.max(1, Math.round(0.4 * u)), g0 = groundAt(x, z) + 1 - Math.round(sink * 3.2 * u), bone = (X, Y, Z) => { for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) for (let e = 0; e < w; e++) set(Math.round(X) + a, Math.round(Y) + b, Math.round(Z) + e, M.bone); };
    for (let k = -L / 2 - 3 * u; k <= L / 2; k += 0.5) bone(x + dx * k, g0 + (k < -L / 2 ? 0 : Math.round(0.5 * u)), z + dz * k);
    for (let k = -L * 0.32; k <= L * 0.34; k += Math.max(2, 1.5 * u)) { const rr = (2.8 - 1.5 * Math.abs(k) / (L * 0.34)) * u; for (let p = 0.05; p < Math.PI - 0.05; p += 0.4 / Math.max(1, rr)) { if (Math.abs(p - Math.PI / 2) < 0.2) continue; bone(x + dx * k - dz * Math.cos(p) * rr, g0 + Math.sin(p) * rr * 1.2, z + dz * k + dx * Math.cos(p) * rr); } }
    const hk = L / 2 + 1.4 * u, hx = x + dx * hk, hz = z + dz * hk, sr = Math.max(1, 1.05 * u);
    blob(hx, g0 + sr * 0.8, hz, sr * 1.15, sr, (X, Y, Z) => set(X, Y, Z, M.bone));
    for (const sd of [-1, 1]) for (let k = 0; k < 2.2 * u; k += 0.5) bone(hx - dz * sd * (sr + k * 0.5) - dx * k * 0.5, g0 + sr * 1.5 + k * 0.7, hz + dx * sd * (sr + k * 0.5) - dz * k * 0.5);
  };
  const shell = (x, z, ang, sc) => { const r0 = 2 * u0 * sc, g0 = groundAt(x, z), end = Math.PI * 5; for (let p = 0; p < end; p += 0.3 / Math.max(1, r0)) { const rr = r0 * (0.12 + 0.88 * p / end), X = Math.round(x + Math.cos(p + ang) * rr), Z = Math.round(z + Math.sin(p + ang) * rr); if (X < 1 || Z < 1 || X >= N - 1 || Z >= N - 1) continue; const jj = J(X, Z), h = ht[jj]; if (h >= 0 && Math.abs(h - g0) <= 2 && wd[jj] > 1 && !flag[jj]) grid[I(X, h, Z)] = M.bone; } };
  TOPICS.forEach((t, i) => {
    if (t.health > 0.6) return; const a = seeds[i][2]; let placed = 0;
    for (let k = 0; k < 40 && placed < 9; k++) {
      const rad = 0.3 + hash2(k, i, 91) * 0.66, an = a + (hash2(k, i, 92) - 0.5) * 1.0, x = Math.round(c + Math.cos(an) * rad * R), z = Math.round(c + Math.sin(an) * rad * R); if (x < 8 || z < 8 || x > N - 8 || z > N - 8) continue;
      const j = J(x, z), q = Math.round(V(1.6)); if (biome[j] !== i || dryness[j] < 0.62 || wd[j] < 2.5 || flag[j] || steepA[j] || get(x, ht[j] + 1, z)) continue;
      let flat = true; for (const [ex, ez] of [[q, 0], [-q, 0], [0, q], [0, -q]]) { const jj = J(x + ex, z + ez); if (ht[jj] < 0 || Math.abs(ht[jj] - ht[j]) > V(1)) flat = false; } if (!flat) continue;
      const kind = placed % 3, rot = hash2(k, i, 93) * 6.28;
      if (kind === 0) shell(x, z, rot, 0.7 + hash2(k, i, 94) * 0.6); else if (kind === 1) skeleton(x, z, rot, 0.38 + hash2(k, i, 94) * 0.14, 0); else skeleton(x, z, rot, 0.6 + hash2(k, i, 94) * 0.25, 0.5);
      placed++;
    }
  });
  mark("detail");

  // --- light from everything that glows, pooled on the ground around it; it shows at night ---
  const lm = new Float32Array(N * N * 3), lr = Math.max(2, Math.round(V(2.8))), lr2 = lr * lr, gain = 0.7 * Math.pow(s, 2.5);
  for (const i of glowVox) { const pal = MATS[grid[i]]; if (!pal || !pal[4]) continue; const x = i % N, z = ((i / N) | 0) % N;
    for (let dz = -lr; dz <= lr; dz++) { const zz = z + dz; if (zz < 0 || zz >= N) continue; for (let dx = -lr; dx <= lr; dx++) { const xx = x + dx, d2 = dx * dx + dz * dz; if (d2 > lr2 || xx < 0 || xx >= N) continue; const w = 1 - d2 / lr2, k = w * w * gain, q = (zz * N + xx) * 3; lm[q] += pal[0] * k; lm[q + 1] += pal[1] * k; lm[q + 2] += pal[2] * k; } } }
  mark("light");

  // --- mesh: visible faces only, corner shading baked in ---
  const solid = (x, y, z) => { if (x < 0 || z < 0 || y < 0 || x >= N || z >= N || y >= H) return 0; const m = grid[(y * N + z) * N + x]; return m !== 0 && m !== 255 ? 1 : 0; };
  const FACES = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  const SHADE = [0.5, 0.68, 0.85, 1], FLAT = [0.82, 0.82, 1, 0.62, 0.9, 0.72], [land, glow, wet] = BUFS, ao = [0, 0, 0, 0];
  for (const b of BUFS) { b.v = 0; b.i = 0; }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const j = J(x, z); let lo = 1, hi = 0;
    if (ht[j] >= 0 && x > 0 && z > 0 && x < N - 1 && z < N - 1) { hi = Math.min(ht[j], ht[j - 1], ht[j + 1], ht[j - N], ht[j + N]) - 1; lo = Math.max(bot[j], bot[j - 1], bot[j + 1], bot[j - N], bot[j + N]) + 1; }   // rock walled in on every side has no faces: skip it
    for (let y = ymin[j]; y <= ymax[j]; y++) {
    if (y >= lo && y < hi) { y = hi - 1; continue; }
    const m = grid[(y * N + z) * N + x]; if (!m) continue;
    const isWater = m === 255, pal = isWater ? null : MATS[m], isGlow = !isWater && pal[4], out = isWater ? wet : isGlow ? glow : land, jit = isWater ? 0 : (hash3(x, y, z) - 0.5) * 2 * pal[3], phase = isGlow ? hash3(x >> 1, y >> 1, z >> 1) : 0, lf = ht[j] < 0 ? 1 : clamp(1 - ((ht[j] - y) * s - 1) / 2.5, 0, 1);
    for (let fi = 0; fi < 6; fi++) {
      const face = FACES[fi], nn = face[0], u = face[1], v = face[2], ox = x + nn[0], oy = y + nn[1], oz = z + nn[2], nb = ox < 0 || oz < 0 || oy < 0 || ox >= N || oz >= N || oy >= H ? 0 : grid[(oy * N + oz) * N + ox];
      if (isWater ? nb !== 0 : nb !== 0 && nb !== 255) continue;
      if (y === 0 && nn[1] === -1) continue;
      if ((out.v + 4) * 3 > out.pos.length) growBuf(out);
      const b0 = out.v, P = out.pos, C = out.col, Nn = out.nor, E = out.ext; let p = b0 * 3;
      for (let i = 0; i < 4; i++, p += 3) {
        const a = i === 1 || i === 2 ? 1 : 0, bb = i >= 2 ? 1 : 0, vx = x + (nn[0] > 0 ? 1 : 0) + u[0] * a + v[0] * bb, vz = z + (nn[2] > 0 ? 1 : 0) + u[2] * a + v[2] * bb;
        P[p] = (vx - c) * s; P[p + 1] = (y + (nn[1] > 0 ? 1 : 0) + u[1] * a + v[1] * bb) * s; P[p + 2] = (vz - c) * s;
        Nn[p] = nn[0]; Nn[p + 1] = nn[1]; Nn[p + 2] = nn[2];
        let sh = 1;
        if (isGlow) { sh = FLAT[fi]; E[p] = phase; }
        else if (!isWater) { const su = a ? 1 : -1, sv = bb ? 1 : -1, s1 = solid(ox + u[0] * su, oy + u[1] * su, oz + u[2] * su), s2 = solid(ox + v[0] * sv, oy + v[1] * sv, oz + v[2] * sv); sh = s1 && s2 ? 0.5 : SHADE[3 - (s1 + s2 + solid(ox + u[0] * su + v[0] * sv, oy + u[1] * su + v[1] * sv, oz + u[2] * su + v[2] * sv))];
          const q = ((vz < N ? vz : N - 1) * N + (vx < N ? vx : N - 1)) * 3; const l0 = lm[q], l1 = lm[q + 1], l2 = lm[q + 2], lk = lf * 0.55 / (0.5 + Math.max(l0, l1, l2)); E[p] = l0 * lk; E[p + 1] = l1 * lk; E[p + 2] = l2 * lk; }
        ao[i] = sh;
        if (isWater) { C[p] = 1; C[p + 1] = 1; C[p + 2] = 1; } else { C[p] = Math.min(1, (pal[0] + jit) * sh); C[p + 1] = Math.min(1, (pal[1] + jit) * sh); C[p + 2] = Math.min(1, (pal[2] + jit) * sh); }
      }
      const X = out.idx, q = out.i;
      if (ao[0] + ao[2] > ao[1] + ao[3]) { X[q] = b0; X[q + 1] = b0 + 1; X[q + 2] = b0 + 2; X[q + 3] = b0; X[q + 4] = b0 + 2; X[q + 5] = b0 + 3; } else { X[q] = b0 + 1; X[q + 1] = b0 + 2; X[q + 2] = b0 + 3; X[q + 3] = b0 + 1; X[q + 4] = b0 + 3; X[q + 5] = b0; }
      out.v += 4; out.i += 6;
    }
  } }
  const geo = (o, ext) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(o.pos.slice(0, o.v * 3), 3)); g.setAttribute("normal", new THREE.BufferAttribute(o.nor.slice(0, o.v * 3), 3)); g.setAttribute("color", new THREE.BufferAttribute(o.col.slice(0, o.v * 3), 3)); if (ext) g.setAttribute("aGlow", new THREE.BufferAttribute(o.ext.slice(0, o.v * 3), 3)); g.setIndex(new THREE.BufferAttribute(o.idx.slice(0, o.i), 1)); return g; };
  mark("mesh");
  const Wp = (x, y, z) => new THREE.Vector3((x - c + 0.5) * s, y * s, (z - c + 0.5) * s);
  const inside = path.map((p, i) => [p, i]).filter(([[px, pz]]) => Math.hypot(px, pz) < E), last = inside.length ? inside[inside.length - 1][0] : null;
  const lowest = (list) => list.reduce((a, b) => (b[2] < a[2] ? b : a), list[0]), foot1 = falls.length ? lowest(falls) : null, mid = cascade.length ? cascade[cascade.length >> 1] : null;
  return {
    land: geo(land, true), glow: geo(glow, true), wet: geo(wet, false), quads: (land.i + glow.i + wet.i) / 6, timing: tm.slice(1).reduce((o, v, k, arr) => (k % 2 ? o : o + `${v} ${Math.round(arr[k + 1] - (k ? arr[k - 1] : tm[0]))}  `), ""), s, top: G + 3, ground: G, radius: Re, ringPeak: (() => { let m = 0; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const o = Math.hypot(x - c, z - c) / R; if (o > 0.25 && o < 0.75 * E && z > c - 0.1 * R && ymax[J(x, z)] > m) m = ymax[J(x, z)]; } return m * s; })(),
    heightAt: (wx, wz) => { const x = Math.floor(wx / s + c), z = Math.floor(wz / s + c); if (x < 0 || z < 0 || x >= N || z >= N) return G; const h = ht[J(x, z)]; return h < 0 ? G : (h + 1) * s; },
    anchors: TOPICS.map((t, i) => { const x = Math.round(c + seeds[i][0] * R), z = Math.round(c + seeds[i][1] * R); return Wp(x, 0, z).setY(hw[J(x, z)] + (t.biome === "highland" && isl.mountain ? 4 : 11)); }),
    seeds: TOPICS.map((t, i) => { const x = Math.round(c + seeds[i][0] * R), z = Math.round(c + seeds[i][1] * R); return Wp(x, 0, z).setY(hw[J(x, z)]); }),
    falls: falls.concat(cascade).map(([x, z, lo, hi]) => ({ at: Wp(x, 0, z), lo: lo * s, hi: (hi + 1) * s })),
    mists: [foot1 && Wp(foot1[0], foot1[2], foot1[1] + V(1)), mid && Wp(mid[0], mid[2], mid[1])].filter(Boolean),
    river: inside.map(([[px, pz], i]) => new THREE.Vector3(px * Rw, (i < enter ? W1 : W0) + s + 0.03, pz * Rw)),
    exit: last && new THREE.Vector3(last[0] * Rw, W0, last[1] * Rw),
    spots: spots.map((l) => l.map(([x, y, z]) => Wp(x, y, z))), heartSpots: heartSpots.map(([x, y, z]) => Wp(x, y, z)),
  };
}

export { hash2, lerp, clamp, MAIN, colours };
