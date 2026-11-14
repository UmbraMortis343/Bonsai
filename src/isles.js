// The garden: floating islands drawn from isles-world.js, with bridges, animals,
// weather and labels. One island per field; a biome on it per topic. Islands
// gather into hubs, and what a map has named but nobody has charted lies under mist.
import * as THREE from "./vendor/three.module.min.js";
import { buildWorld, hash2, lerp, clamp } from "./isles-world.js";

export const QUALITY = {
  low: { n: 104, shadow: 2048, dpr: 1.5, motes: 80 },
  medium: { n: 152, shadow: 2048, dpr: 2, motes: 180 },
  high: { n: 200, shadow: 4096, dpr: 2, motes: 320 },
};

// opts: { canvas, sky, tags, quality, onHub(h), onIsland(i), onTopic(i, k), onReady() }
export function createIsles(opts) {
  let ISLANDS = [], LINKS = [], HUBS = [], PAIRS = [];
  // ---------- stage ----------
  const canvas = opts.canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false;   // nothing that casts a shadow moves, so shadows are drawn once per rebuild
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -900, 1400);
  const MID = new THREE.Vector3(0, 26, 0); let SPAN = 60;   // middle of the islands, and how far they reach from it
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.7); sun.castShadow = true; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.45;

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a4466, 1.25);
  scene.add(sun, sun.target, hemi);
  let foc = -1, fhub = -1, tick = 0, ALL = 100, yaw = 0.45, pitch = 0.6, zoom = 60, panX = 0, panZ = 0, tgtY = 30, goal = null, parts = null, fauna = null, night = false, world = null, TOPICS = [], quality = opts.quality || "medium", active = false, raf = 0;
  const still = false;
  const NIGHT = { value: 0.1 }, TIME = { value: 0 }, PULSE = { value: 0.3 }, AUR = { value: 0 };
  const landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // at night the ground picks up the colour of whatever glows nearby
  landMat.onBeforeCompile = (sh) => { sh.uniforms.uNight = NIGHT; sh.vertexShader = "attribute vec3 aGlow;\nvarying vec3 vGlow;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vGlow = aGlow;"); sh.fragmentShader = "varying vec3 vGlow;\nuniform float uNight;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vGlow * uNight;"); };
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  // each light breathes at its own pace and phase, like fireflies
  glowMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = TIME; sh.uniforms.uPulse = PULSE; sh.vertexShader = "attribute vec3 aGlow;\nuniform float uTime;\nuniform float uPulse;\n" + sh.vertexShader.replace("#include <color_vertex>", "#include <color_vertex>\n float pw = 0.5 + 0.5 * sin(uTime * (0.6 + fract(aGlow.x * 7.31) * 2.6) + aGlow.x * 6.2832);\n vColor.rgb *= mix(1.0, 0.22 + 1.05 * pw * pw, uPulse);"); };
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x49b6e6, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.8 });
  const hazeMat = new THREE.MeshBasicMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0.23, depthWrite: false });   // mist over land that is named but not yet charted
  const BOX = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D(), tint = new THREE.Color();

  function setNight(on) {
    night = on;
    sun.intensity = on ? 0.55 : 2.7; sun.color.set(on ? 0x8fa8ff : 0xfff0d6);
    hemi.intensity = on ? 0.6 : 1.25; hemi.color.set(on ? 0x6f80c8 : 0xcfe0ff); hemi.groundColor.set(on ? 0x2a2850 : 0x4a4466);
    waterMat.color.set(on ? 0x2f7fc0 : 0x49b6e6); NIGHT.value = on ? 0.8 : 0.06; PULSE.value = on ? 0.9 : 0.3;
    hazeMat.color.set(on ? 0x8fa2d8 : 0xf4f8ff); hazeMat.opacity = on ? 0.13 : 0.23;

  }

  function dome(y, r) {
    const g = new THREE.Group();
    const ico = new THREE.IcosahedronGeometry(r, r > 35 ? 3 : 2), p = new THREE.WireframeGeometry(ico).attributes.position, keep = [];
    for (let i = 0; i < p.count; i += 2) if (p.getY(i) > -0.5 && p.getY(i + 1) > -0.5) keep.push(p.getX(i), Math.max(0, p.getY(i)), p.getZ(i), p.getX(i + 1), Math.max(0, p.getY(i + 1)), p.getZ(i + 1));
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.2 })));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false }));
    g.add(shell); g.position.y = y; ico.dispose();
    return g;
  }

  // ---------- aurora: ribbons of light that hang under each dome at night, where the birds fly by day ----------
  const RIBBON = new THREE.PlaneGeometry(1, 1, 80, 1);
  const auroraMat = (seed) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: TIME, uFade: AUR, uSeed: { value: seed }, uRad: { value: 1 }, uH: { value: 1 }, uAmp: { value: 1 }, uA0: { value: 0 }, uA1: { value: 1 } },
    vertexShader: `uniform float uTime, uSeed, uRad, uH, uAmp, uA0, uA1; varying vec2 vUv;
      void main() { vUv = uv; float u = uv.x, a = mix(uA0, uA1, u);
        float rr = uRad + sin(u * 9.0 + uTime * 0.22 + uSeed) * uAmp + sin(u * 21.0 - uTime * 0.17 + uSeed * 2.3) * uAmp * 0.4;
        vec3 p = vec3(cos(a) * rr, uv.y * uH * (0.8 + 0.3 * sin(u * 7.0 + uTime * 0.2 + uSeed * 3.0)) + sin(u * 3.0 + uTime * 0.1 + uSeed) * uH * 0.1, sin(a) * rr);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime, uSeed, uFade; varying vec2 vUv;
      void main() { float u = vUv.x, v = vUv.y;
        float rays = 0.5 + 0.5 * sin(u * 110.0 + uTime * 0.8 + uSeed * 9.0) * sin(u * 31.0 - uTime * 0.5 + uSeed);
        float band = 0.5 + 0.5 * sin(u * 9.0 + uTime * 0.3 + uSeed * 4.0);
        float vert = smoothstep(0.0, 0.07, v) * pow(1.0 - v, 1.7), ends = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
        vec3 col = mix(vec3(0.2, 1.0, 0.55), vec3(0.5, 0.3, 1.0), smoothstep(0.1, 0.8, v));
        gl_FragColor = vec4(col, vert * ends * (0.45 + 0.55 * rays) * (0.5 + 0.5 * band) * uFade * 1.5); }` });
  // two arcs of light on the open side of each dome, started above whatever stands beneath them so they never cut through it
  function aurora(isl) {
    const w = isl.world, r = w.radius, g = new THREE.Group(), base = Math.max(w.top + r * 0.3, w.ringPeak + 1.5), hgt = clamp(w.top + r * 0.76 - base, r * 0.1, r * 0.3); isl.aur ||= [auroraMat(isl.seed * 0.7 + 0.4), auroraMat(isl.seed * 0.7 + 1.9)];
    isl.aur.forEach((m, k) => { const U = m.uniforms; U.uRad.value = r * (k ? 0.56 : 0.4); U.uH.value = hgt * (k ? 0.8 : 1); U.uAmp.value = r * 0.04; U.uA0.value = k ? 0.75 : 0.3; U.uA1.value = k ? 2.4 : 2.85; const mesh = new THREE.Mesh(RIBBON, m); mesh.position.y = base; mesh.frustumCulled = false; mesh.renderOrder = 5; g.add(mesh); });
    isl.aurora = g; return g;
  }

  // ---------- bridges between islands that share cross-links: more links, a wider bridge with more torches and flower beds ----------
  const links = { group: new THREE.Group(), flameAt: [], flames: null }; let linksStale = true;
  scene.add(links.group);
  const FLOWERS = [0xf48fb8, 0xffd84a, 0xb58cf0, 0xffffff, 0xff8f6b];
  function buildLinks() {
    for (const ch of [...links.group.children]) { links.group.remove(ch); ch.dispose(); }
    linksStale = false; links.flameAt = []; links.flames = null;
    const G = 26, items = [], flames = [], up = new THREE.Vector3(0, 1, 0);
    const add = (p, sx, sy, sz, col, to, ry = 0) => items.push({ p, sx, sy, sz, col, to, ry });
    for (const [ia, ib, count] of LINKS) {
      const A = ISLANDS[ia], B = ISLANDS[ib], dx = B.pos[0] - A.pos[0], dz = B.pos[2] - A.pos[2], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, ry = Math.atan2(ux, uz), side = new THREE.Vector3(uz, 0, -ux), along = new THREE.Vector3(ux, 0, uz);
      const a = new THREE.Vector3(A.pos[0] + ux * (A.R - 0.6), A.pos[1] + G + 2.7, A.pos[2] + uz * (A.R - 0.6)), b = new THREE.Vector3(B.pos[0] - ux * (B.R - 0.6), B.pos[1] + G + 2.7, B.pos[2] - uz * (B.R - 0.6));
      const len = a.distanceTo(b), sag = 0.8 + len * 0.03, wd = 2.1 + count * 0.6, at = (t, off = 0, lift = 0) => a.clone().lerp(b, t).setY(lerp(a.y, b.y, t) - sag * 4 * t * (1 - t) + lift).addScaledVector(side, off);
      const n = Math.max(5, Math.round(len / 1.15)), np = Math.max(2, Math.round(len / 5));
      for (let i = 0; i < n; i++) add(at((i + 0.5) / n), wd, 0.3, (len / n) * 0.84, i % 2 ? 0x8a6240 : 0x76522f, at((i + 1) / n));   // planks
      for (const sd of [-1, 1]) {
        const e = sd * (wd / 2 - 0.12);
        for (let i = 0; i < n; i++) add(at((i + 0.5) / n, e, 1.25), 0.09, 0.09, (len / n) * 1.04, 0xe8dcc0, at((i + 1) / n, e, 1.25));   // rope rail
        for (let k = 0; k <= np; k++) { const t = k / np, torch = (k + (sd > 0 ? 0 : 1)) % 2 === 0, p0 = at(t, e);
          add(p0.clone().addScaledVector(up, torch ? 1.35 : 0.7), 0.26, torch ? 2.7 : 1.4, 0.26, 0x5f3f28, null, ry);   // post
          if (torch) { add(p0.clone().addScaledVector(up, 2.72), 0.56, 0.2, 0.56, 0x3a3340, null, ry); flames.push({ p: p0.clone().addScaledVector(up, 3.05), ph: hash2(k, ia * 7 + ib, 97 + sd) }); }
          else if (k > 0 && k < np && (count > 1 || k % 2)) { const pb = at(t, e - sd * 0.5, 0.42); add(pb, 0.7, 0.5, 1.7, 0x4a3524, null, ry); for (let f = 0; f < 5; f++) add(pb.clone().addScaledVector(along, (f - 2) * 0.32).addScaledVector(up, 0.38 + (f % 2) * 0.1), 0.3, 0.34, 0.3, FLOWERS[(k + f + ia) % 5], null, ry); add(pb.clone().addScaledVector(up, 0.27), 0.62, 0.1, 1.6, 0x4f9a52, null, ry); }   // flower bed
        }
      }
      for (const q of [a, b]) for (const sd of [-1, 1]) { const g0 = q.clone().addScaledVector(side, sd * (wd / 2 + 0.4)); add(g0.clone().addScaledVector(up, 1.5), 0.95, 4.4, 0.95, 0xb9b3a6, null, ry); add(g0.clone().addScaledVector(up, 3.9), 1.25, 0.45, 1.25, 0x9d978a, null, ry); flames.push({ p: g0.clone().addScaledVector(up, 4.5), ph: hash2(sd, ia + ib * 3, 98) }); }   // stone gateposts, each with a brazier
    }
    const lit = new THREE.InstancedMesh(BOX, new THREE.MeshStandardMaterial({ roughness: 0.9 }), items.length); lit.castShadow = lit.receiveShadow = true; lit.frustumCulled = false;
    items.forEach((it, i) => { dummy.position.copy(it.p); dummy.rotation.set(0, it.ry, 0); if (it.to) dummy.lookAt(it.to); dummy.scale.set(it.sx, it.sy, it.sz); dummy.updateMatrix(); lit.setMatrixAt(i, dummy.matrix); lit.setColorAt(i, tint.setHex(it.col)); });
    links.flameAt = flames; links.flames = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({ toneMapped: false }), flames.length * 2); links.flames.frustumCulled = false;
    flames.forEach((f, i) => { links.flames.setColorAt(i * 2, tint.setHex(0xff8a2a)); links.flames.setColorAt(i * 2 + 1, tint.setHex(0xffe08a)); });
    links.group.add(lit, links.flames); renderer.shadowMap.needsUpdate = true;
  }
  function drawLinks(t) {
    links.flameAt.forEach((f, i) => { const fl = 0.75 + 0.25 * Math.sin(t * (9 + f.ph * 6) + f.ph * 40) * Math.sin(t * 3.1 + f.ph * 9), k = (night ? 1 : 0.75) * fl;
      dummy.rotation.set(0, t * 0.6 + f.ph * 6, 0); dummy.position.set(f.p.x, f.p.y + 0.1 * k, f.p.z); dummy.scale.set(0.42 * k, 0.62 * k, 0.42 * k); dummy.updateMatrix(); links.flames.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.y = f.p.y + 0.02; dummy.scale.set(0.22 * k, 0.4 * k, 0.22 * k); dummy.updateMatrix(); links.flames.setMatrixAt(i * 2 + 1, dummy.matrix); });
    if (links.flames) links.flames.instanceMatrix.needsUpdate = true;
  }

  // ---------- animals: a few boxes each, placed by where their biome is alive ----------
  const COAT = { highland: 0xf2f2ee, tropical: 0xf08a3c, bloom: 0xfff1dc, lantern: 0xc9965a, glowcap: 0x3f8fb0, fern: 0x8a6fd0 };
  function populate() {
    const list = [], pick = (arr, j, i, salt) => arr[Math.floor(hash2(j, i, salt) * arr.length)], sc = world.radius / 43.68;
    TOPICS.forEach((t, i) => {
      const sp = world.spots[i]; if (!sp.length) return;
      const life = t.health * (0.35 + 0.65 * Math.min(t.growth, 1.5)) * (0.4 + 0.6 * sc);
      for (let j = 0; j < Math.round(7 * life); j++) list.push({ k: "grazer", p: pick(sp, j, i, 71), ph: hash2(j, i, 72) * 6.28, sp: 0.22 + hash2(j, i, 73) * 0.2, col: COAT[t.biome], sc: 1.05 + hash2(j, i, 74) * 0.55 });
      if (t.biome === "glowcap" || t.biome === "fern") for (let j = 0; j < Math.round(6 * life); j++) list.push({ k: "drifter", p: pick(sp, j, i, 75), ph: hash2(j, i, 76) * 6.28, sp: 0.18 + hash2(j, i, 77) * 0.15, col: t.biome === "fern" ? 0x9fd8ff : 0xa8ffe6 });
      if (t.biome === "bloom" || t.biome === "tropical") for (let j = 0; j < Math.round(10 * life); j++) list.push({ k: "moth", p: pick(sp, j, i, 78), ph: hash2(j, i, 79) * 6.28, sp: 0.5 + hash2(j, i, 80) * 0.5, col: [0xffe066, 0x8fd0ff, 0xffffff, 0xff9ad0][j % 4] });
    });
    TOPICS.forEach((t, i) => { if (t.health < 0.3) for (let j = 0; j < 3; j++) list.push({ k: "bird", c: world.seeds[i], r: 4.5 + j * 1.6, y: world.seeds[i].y + 11 + j * 1.5, ph: j * 2.1, sp: 0.35, col: 0x26242c }); });
    for (let j = 0; j < 3 && world.heartSpots.length; j++) list.push({ k: "drifter", p: pick(world.heartSpots, j, 9, 83), ph: j * 2, sp: 0.2, col: 0xc8fff2 });
    for (let j = 0; j < Math.max(3, Math.round(7 * sc)); j++) list.push({ k: "bird", c: new THREE.Vector3(0, 0, 1), r: (10 + j * 2.6) * sc, y: world.ground + (30 + j * 1.2) * sc, ph: j * 1.05, sp: 0.22, col: 0xffffff });
    if (world.river.length) for (let j = 0; j < 5; j++) list.push({ k: "fish", ph: j / 5, col: j % 2 ? 0xffa64d : 0xdfe8f2 });
    return list;
  }
  const PARTS = { grazer: [4, 0], drifter: [0, 4], moth: [0, 2], bird: [3, 0], fish: [1, 0] };
  function drawFauna(t, paint) {
    let li = 0, gi = 0;
    const emit = (glow, x, y, z, sx, sy, sz, ry, rz, col) => { const mesh = glow ? fauna.glow : fauna.lit, i = glow ? gi++ : li++; dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, rz); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); if (paint) mesh.setColorAt(i, tint.setHex(col)); };
    for (const a of fauna.list) {
      if (a.k === "grazer") {
        const q = t * a.sp + a.ph, x = a.p.x + Math.cos(q) * 1.8, z = a.p.z + Math.sin(q * 1.31 + a.ph) * 1.8, ry = Math.atan2(-Math.sin(q), Math.cos(q * 1.31 + a.ph) * 1.31), fx = Math.sin(ry), fz = Math.cos(ry), k = a.sc, y = world.heightAt(x, z) + Math.abs(Math.sin(q * 9)) * 0.18 * k;
        emit(0, x, y + 0.95 * k, z, 0.7 * k, 0.7 * k, 1.5 * k, ry, 0, a.col);
        emit(0, x + fx * 0.95 * k, y + 1.4 * k, z + fz * 0.95 * k, 0.5 * k, 0.5 * k, 0.6 * k, ry, 0, a.col);
        emit(0, x + fx * 0.45 * k, y + 0.3 * k, z + fz * 0.45 * k, 0.72 * k, 0.6 * k, 0.2 * k, ry, 0, 0x4a4038);
        emit(0, x - fx * 0.45 * k, y + 0.3 * k, z - fz * 0.45 * k, 0.72 * k, 0.6 * k, 0.2 * k, ry, 0, 0x4a4038);
      } else if (a.k === "drifter") {
        const q = t * a.sp + a.ph, x = a.p.x + Math.sin(q) * 3, y = a.p.y + 4.5 + Math.sin(q * 1.7) * 1.4, z = a.p.z + Math.cos(q * 0.8) * 3, pulse = 1 + Math.sin(t * 2 + a.ph) * 0.12;
        emit(1, x, y, z, 0.95 * pulse, 0.5, 0.95 * pulse, 0, 0, a.col);
        for (let j = 0; j < 3; j++) emit(1, x + Math.cos(j * 2.1) * 0.3 + Math.sin(t * 1.5 + j) * 0.08, y - 0.75, z + Math.sin(j * 2.1) * 0.3, 0.12, 1, 0.12, 0, Math.sin(t * 1.5 + j) * 0.2, a.col);
      } else if (a.k === "moth") {
        const q = t * a.sp + a.ph, x = a.p.x + Math.sin(q) * 2.2, y = a.p.y + 1.6 + Math.sin(q * 3.1) * 0.7, z = a.p.z + Math.cos(q * 1.3) * 2.2, flap = Math.sin(t * 16 + a.ph) * 0.9;
        emit(1, x, y, z, 0.34, 0.05, 0.24, q, flap, a.col); emit(1, x, y, z, 0.34, 0.05, 0.24, q + Math.PI, flap, a.col);
      } else if (a.k === "bird") {
        const q = t * a.sp + a.ph, x = a.c.x + Math.cos(q) * a.r, z = a.c.z + Math.sin(q) * a.r, y = a.y + Math.sin(q * 2) * 1.2, flap = Math.sin(t * 7 + a.ph) * 0.55;
        emit(0, x, y, z, 0.3, 0.22, 0.95, -q, 0, a.col); emit(0, x, y + 0.05, z, 0.85, 0.08, 0.4, -q, flap, a.col); emit(0, x, y + 0.05, z, 0.85, 0.08, 0.4, -q + Math.PI, flap, a.col);
      } else if (a.k === "fish") {
        const R = world.river, u = ((t * 0.02 + a.ph) % 1) * (R.length - 1), p0 = R[Math.floor(u)], p1 = R[Math.min(R.length - 1, Math.floor(u) + 1)], jp = (t * 0.45 + a.ph * 3.7) % 1, up = jp < 0.3 ? Math.sin((jp / 0.3) * Math.PI) : -1;
        emit(0, p0.x, p0.y - 0.3 + up * 1.5, p0.z, up < 0 ? 0 : 0.22, up < 0 ? 0 : 0.3, up < 0 ? 0 : 0.75, Math.atan2(p1.x - p0.x, p1.z - p0.z), 0, a.col);
      }
    }
    fauna.lit.count = li; fauna.glow.count = gi; fauna.lit.instanceMatrix.needsUpdate = fauna.glow.instanceMatrix.needsUpdate = true;
    if (paint) { if (fauna.lit.instanceColor) fauna.lit.instanceColor.needsUpdate = true; if (fauna.glow.instanceColor) fauna.glow.instanceColor.needsUpdate = true; }
  }

  // ---------- mist: a hub with no islands yet is only a bank of it ----------
  const BANK = 30;
  function bank(hub) {
    const g = new THREE.Group(), n = 170, m = new THREE.InstancedMesh(BOX, hazeMat, n); m.frustumCulled = false; g.add(m);
    let seed = 0; for (const ch of String(hub.id)) seed = (seed * 31 + ch.charCodeAt(0)) % 97;
    g.userData = { mesh: m, at: Array.from({ length: n }, (_, j) => { const a = hash2(j, seed, 301) * 6.2832, r = BANK * Math.sqrt(hash2(j, seed, 302)), up = hash2(j, seed, 303); return { x: Math.cos(a) * r, y: 20 + up * up * 20 * (1 - (r / BANK) ** 2 * 0.75), z: Math.sin(a) * r, ph: hash2(j, seed, 304) * 6.2832, w: 0.7 + hash2(j, seed, 305) * 0.8 }; }) };
    return g;
  }
  function drawBank(g, t) {
    const { mesh, at } = g.userData;
    at.forEach((p, j) => { dummy.position.set(p.x + Math.sin(t * 0.05 + p.ph) * 3, p.y + Math.sin(t * 0.09 + p.ph * 2) * 0.7, p.z + Math.cos(t * 0.04 + p.ph) * 3); dummy.rotation.set(0, p.ph, 0); dummy.scale.set(6.4 * p.w, 2 * p.w, 5.2 * p.w); dummy.updateMatrix(); mesh.setMatrixAt(j, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
  }

  const use = (isl) => { TOPICS = isl.topics; world = isl.world; parts = isl.parts; fauna = isl.fauna; };
  function make(i) {
    const isl = ISLANDS[i], Q = QUALITY[quality], t0 = performance.now(), group = isl.group;
    for (const ch of [...group.children]) { ch.traverse((o) => { if (o.geometry && o.geometry !== BOX && o.geometry !== RIBBON) o.geometry.dispose(); }); group.remove(ch); }
    TOPICS = isl.topics;
    isl.E = Math.round((1 + 0.3 * clamp(Math.max(...isl.topics.map((t) => t.growth)) - 1, 0, 1)) * 20) / 20;   // a topic that outgrows its plot pushes the whole shoreline out
    world = isl.world = buildWorld(isl, Math.max(40, Math.round(Q.n * isl.size * isl.E * detail(isl, i) / 2) * 2));

    const land = new THREE.Mesh(world.land, landMat), glow = new THREE.Mesh(world.glow, glowMat), wet = new THREE.Mesh(world.wet, waterMat);
    land.castShadow = land.receiveShadow = true; glow.castShadow = true; wet.receiveShadow = true;
    group.add(land, glow, wet, dome(world.top, world.radius), aurora(isl));
    if (Math.abs(isl.R - world.radius) > 0.01) { isl.R = world.radius; linksStale = true; }
    if (sun.shadow.mapSize.x !== Q.shadow) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    renderer.shadowMap.needsUpdate = true;
    const inst = (cap, material) => { const m = new THREE.InstancedMesh(BOX, material, Math.max(1, cap)); m.count = cap; m.frustumCulled = false; group.add(m); return m; };
    const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
    const nF = Math.min(260, world.falls.length), nGlint = Math.min(180, world.river.length), all = world.spots.flat().concat(world.heartSpots), nFly = Math.min(Math.round(Q.motes * isl.size), all.length);
    parts = isl.parts = { fall: inst(nF * 3 + (world.exit ? 24 : 0), basic(0xf2fbff, 0.9)), mist: inst(world.mists.length ? 60 : 0, basic(0xffffff, 0.32)), glint: inst(nGlint, basic(0xd8f4ff, 0.75)), fly: inst(nFly, new THREE.MeshBasicMaterial({ color: 0xfff0a0, toneMapped: false })), cloud: inst(15, basic(0xffffff, 0.8)),
      fallAt: Array.from({ length: nF }, (_, k) => world.falls[Math.floor((k + 0.5) * world.falls.length / nF)]),
      flyAt: Array.from({ length: nFly }, (_, k) => all[Math.floor(hash2(k, 7, 31) * all.length)]) };
    const haze = [], wedge = (Math.PI * 2) / isl.topics.length;
    isl.topics.forEach((t, k) => {
      if (!t.mist) return; const sd = world.seeds[k], a0 = Math.atan2(sd.z, sd.x), m = Math.round(170 / isl.topics.length) + 24;
      for (let j = 0; j < m; j++) { const a = a0 + (hash2(j, k, 61) - 0.5) * wedge * 0.94, r = world.radius * (0.17 + 0.7 * Math.sqrt(hash2(j, k, 62))), x = Math.cos(a) * r, z = Math.sin(a) * r; haze.push({ x, z, y: world.heightAt(x, z) + 1.2 + hash2(j, k, 63) ** 2 * 6.5, ph: hash2(j, k, 64) * 6.2832, w: 0.75 + hash2(j, k, 65) * 0.65 }); }
    });
    parts.haze = inst(haze.length, hazeMat); parts.hazeAt = haze;
    const list = populate(); let nl = 0, ng = 0; for (const a of list) { nl += PARTS[a.k][0]; ng += PARTS[a.k][1]; }
    fauna = isl.fauna = { list, lit: inst(nl, new THREE.MeshStandardMaterial({ roughness: 0.9 })), glow: inst(ng, new THREE.MeshBasicMaterial({ toneMapped: false })) };
    drawFauna(0, true);
    isl.ms = Math.round(performance.now() - t0);

    isl.tags?.forEach((e, k) => { const bar = e.querySelector("b"); if (bar && isl.topics[k]) bar.style.width = Math.round(isl.topics[k].health * 100) + "%"; });
  }

  const PUFF = [[0, 0, 0, 7, 1.3, 4], [-1, 1.3, 0.2, 4, 1.3, 2.6], [2.2, 1.3, -0.4, 2.4, 1.3, 2], [-3.6, -0.1, 1.2, 2.6, 1.1, 2], [3.4, -0.1, -1.2, 2.2, 1.1, 2.2]];
  function animate(t) {
    const P = parts, s = world.s, sc = world.radius / 43.68; let i = 0;
    const place = (mesh, k, x, y, z, sx, sy, sz, ry = 0) => { dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix); };
    for (const f of P.fallAt) for (let j = 0; j < 3; j++, i++) { const ph = (t * (0.5 + hash2(i, 1, 41) * 0.5) + hash2(i, 2, 41)) % 1; place(P.fall, i, f.at.x + (hash2(i, 3, 41) - 0.5) * s, lerp(f.hi, f.lo, ph * ph), f.at.z + (hash2(i, 4, 41) - 0.5) * s, 0.16, 0.5 + ph, 0.16); }
    if (world.exit) for (let j = 0; j < 24; j++, i++) { const ph = (t * 0.7 + j / 24) % 1; place(P.fall, i, world.exit.x + (hash2(j, 5, 43) - 0.5) * 2.6, world.exit.y - ph * ph * 18, world.exit.z + (hash2(j, 6, 43) - 0.5) * 2 + ph * 2.5, 0.3, 0.5 + ph * 1.4, 0.3); }
    for (let j = 0; j < P.mist.count; j++) { const m = world.mists[j % world.mists.length], ph = (t * 0.25 + j / 60) % 1, a = j * 2.4; place(P.mist, j, m.x + Math.cos(a) * (0.8 + ph * 2.6), m.y + 0.5 + ph * 4.5, m.z + Math.sin(a) * (0.8 + ph * 2.4), 0.4 + ph, 0.4 + ph, 0.4 + ph); }
    const R = world.river, n = P.glint.count;
    for (let j = 0; j < n; j++) { const u = ((t * 0.03 + j / n) % 1) * (R.length - 1), a = R[Math.floor(u)], b = R[Math.min(R.length - 1, Math.floor(u) + 1)], f = u % 1, off = (hash2(j, 9, 47) - 0.5) * 2.6; place(P.glint, j, lerp(a.x, b.x, f) + off * 0.6, a.y, lerp(a.z, b.z, f) + off * 0.6, 0.12, 0.04, 0.8 + hash2(j, 2, 47), Math.atan2(b.x - a.x, b.z - a.z)); }
    P.flyAt.forEach((p, j) => { const a = t * (0.4 + hash2(j, 1, 53) * 0.5) + j, bl = 0.5 + 0.5 * Math.sin(t * (0.9 + hash2(j, 3, 53) * 2.4) + hash2(j, 4, 53) * 6.28), sz = (night ? 0.26 : 0.13) * (0.25 + 0.9 * bl * bl); place(P.fly, j, p.x + Math.sin(a) * 1.4, p.y + 1.2 + Math.sin(a * 1.7 + j) * 1 + hash2(j, 2, 53) * 3, p.z + Math.cos(a * 0.8) * 1.4, sz, sz, sz); });
    for (let cI = 0; cI < 3; cI++) { const a = t * 0.025 + cI * 2.2 + 0.6, r = (16 + cI * 7) * sc, cy = world.top + Math.sqrt(world.radius ** 2 - r * r) - (7 + cI * 2) * sc; PUFF.forEach((u, j) => place(P.cloud, cI * 5 + j, Math.cos(a) * r + u[0] * sc, cy + u[1] * sc, Math.sin(a) * r + u[2] * sc, u[3] * sc, u[4] * sc, u[5] * sc)); }
    P.hazeAt.forEach((p, j) => place(P.haze, j, p.x + Math.sin(t * 0.06 + p.ph) * 2.4 * sc, p.y + Math.sin(t * 0.1 + p.ph * 2) * 0.5, p.z + Math.cos(t * 0.05 + p.ph) * 2.4 * sc, 7.4 * p.w * sc, 1.5 * p.w * sc, 6 * p.w * sc, p.ph));
    for (const m of [P.fall, P.mist, P.glint, P.fly, P.cloud, P.haze]) m.instanceMatrix.needsUpdate = true;
    P.cloud.material.opacity = night ? 0.25 : 0.8;
    drawFauna(t, false);
  }

  // ---------- night sky: stars that drift as you turn ----------
  const sky = opts.sky, sctx = sky.getContext("2d");
  const STARS = Array.from({ length: 560 }, (_, i) => ({ x: hash2(i, 1, 201), y: Math.pow(hash2(i, 2, 201), 1.25), r: 0.7 + hash2(i, 3, 201) ** 3 * 1.9, ph: hash2(i, 4, 201) * 6.28, sp: 0.5 + hash2(i, 5, 201) * 2.6, c: ["#ffffff", "#cfe0ff", "#ffe9c8", "#bfe9ff"][i % 4] }));
  let skyFade = 0;
  function drawSky(t, dt) {
    skyFade = still ? (night ? 1 : 0) : Math.min(1, Math.max(0, skyFade + (night ? dt : -dt) * 1.2));
    if (sky.width !== W || sky.height !== Hh) { sky.width = W; sky.height = Hh; }
    AUR.value = skyFade; for (const isl of ISLANDS) if (isl.aurora) isl.aurora.visible = skyFade > 0.01;
    sctx.clearRect(0, 0, W, Hh); if (skyFade <= 0) return;
    const drift = yaw * 0.11;
    for (const st of STARS) { const x = ((((st.x + drift) % 1) + 1) % 1) * W, tw = 0.5 + 0.5 * Math.sin(t * st.sp + st.ph); sctx.globalAlpha = skyFade * (0.25 + 0.75 * tw) * (0.4 + 0.6 * (1 - st.y)); sctx.fillStyle = st.c; sctx.fillRect(x, st.y * Hh, st.r, st.r); }
    sctx.globalAlpha = 1;
  }

  let W = 1, Hh = 1;
  function resize() {
    W = canvas.clientWidth; Hh = canvas.clientHeight; renderer.setSize(W, Hh, false);
    const a = W / Hh, fit = zoom * Math.max(1, 1.18 / a); cam.left = -fit * a; cam.right = fit * a; cam.top = fit; cam.bottom = -fit; cam.updateProjectionMatrix();
  }

  // ---------- camera ----------
  const v3 = new THREE.Vector3(), tagsEl = opts.tags;
  function overview() { goal = { x: MID.x, z: MID.z, y: 30, zoom: SPAN }; setFocus(-1, -1); }
  function flyHub(h) { const hub = HUBS[h]; if (!hub || HUBS.length < 2) return overview(); goal = { x: hub.pos[0], z: hub.pos[2], y: 30, zoom: hub.R * 1.12 + 10 }; setFocus(-1, h); }
  function flyTo(i) { const isl = ISLANDS[i]; if (!isl) return overview(); goal = { x: isl.pos[0], z: isl.pos[2], y: isl.pos[1] + 34, zoom: 8 + isl.R * 0.88 }; setFocus(i, isl.hub); }
  // the island being looked at is built fine, the rest coarser; shadows are fitted to the hub being looked at
  function setFocus(i, h) { if (i === foc && h === fhub) return; const hubWas = fhub; foc = i; fhub = h; for (const isl of ISLANDS) check(isl); if (hubWas !== fhub) fitShadow(); showTags(); }
  function fitShadow() {
    const hub = HUBS.length > 1 ? HUBS[fhub] : null, cx = hub ? hub.pos[0] : MID.x, cz = hub ? hub.pos[2] : MID.z, half = hub ? hub.R + 36 : ALL, sc = sun.shadow.camera;
    sun.position.set(cx - half * 0.56, MID.y + half * 1.12, cz + half * 0.52); sun.target.position.set(cx, MID.y, cz);
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 10; sc.far = half * 3.2; sc.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }
  // with many islands in the sky the ones not being looked at are built coarser still, and land wholly under mist coarsest
  const far = () => (ISLANDS.length <= 6 ? 0.62 : ISLANDS.length <= 12 ? 0.5 : 0.42);
  const detail = (isl, k) => (k === foc ? 1 : isl.topics.every((t) => t.mist) ? Math.min(far(), 0.42) : far());

  // ---------- building: one island a frame, so the page never freezes for long ----------
  const queue = []; let ready = false;
  const sigOf = (isl, k) => JSON.stringify([quality, detail(isl, k), isl.landmark, isl.patron, isl.mountain, isl.topics.map((t) => [t.biome, Math.round(t.health * 20), Math.round(Math.min(2, t.growth) * 20), t.mark, t.color, t.color2, t.color3, !!t.mist])]);
  function check(isl) { const k = ISLANDS.indexOf(isl), sig = sigOf(isl, k); if (isl.sig !== sig && !queue.includes(isl)) { if (k === foc) queue.unshift(isl); else queue.push(isl); } }
  function buildNext() {
    const isl = queue.shift(); if (!isl) return; const k = ISLANDS.indexOf(isl); if (k < 0) return;
    isl.sig = sigOf(isl, k); make(k);
    if (!queue.length) { if (linksStale) buildLinks(); if (!ready) { ready = true; opts.onReady?.(); } }
  }

  // ---------- where the islands sit: in each hub the first in the middle and the rest in a ring around it; the hubs in a ring of their own ----------
  function place() {
    ISLANDS.forEach((isl) => { isl.size = Math.sqrt(Math.max(3, isl.topics.length) / 6); isl.R ||= 96 * isl.size * 0.455; });   // at least three topics' worth of land, so the centrepiece fits
    for (const hub of HUBS) {
      const list = hub.list; if (!list.length) { hub.R = BANK + 6; continue; }
      const R0 = list[0].R * 1.3, rest = list.slice(1), maxR = Math.max(0, ...rest.map((q) => q.R * 1.3)), ring = Math.max(R0 + maxR + 30, rest.reduce((a, q) => a + q.R * 2.6 + 16, 0) / (2 * Math.PI));
      list[0].off = [0, 0, 0];
      rest.forEach((isl, k) => { const a = 0.35 + (k / rest.length) * Math.PI * 2; isl.off = [Math.cos(a) * ring, [12, -8, 8, -12, 4, -4][k % 6], Math.sin(a) * ring]; });
      hub.R = rest.length ? ring + maxR : R0;
    }
    // each hub gets a share of the circle to match its size, and the circle is wide enough that neighbours never touch
    const n = HUBS.length, w = HUBS.map((h) => h.R + 16), W = w.reduce((a, b) => a + b, 0), span = w.map((x) => (x / W) * Math.PI * 2); let ring = 0, a = -Math.PI / 2;
    const angle = HUBS.map((_, k) => { if (k) a += (span[k - 1] + span[k]) / 2; return a; });
    if (n > 1) HUBS.forEach((_, k) => { const j = (k + 1) % n, gap = n === 2 ? Math.PI : (span[k] + span[j]) / 2; ring = Math.max(ring, (w[k] + w[j]) / (2 * Math.max(0.2, Math.sin(Math.min(gap, Math.PI * 2 - gap) / 2 + 1e-9)))); });
    HUBS.forEach((hub, k) => {
      hub.pos = [Math.cos(angle[k]) * ring, 0, Math.sin(angle[k]) * ring];
      for (const isl of hub.list) { isl.pos = [hub.pos[0] + isl.off[0], isl.off[1], hub.pos[2] + isl.off[2]]; isl.group.position.set(...isl.pos); }
      if (!hub.list.length) { if (!hub.bank) { hub.bank = bank(hub); scene.add(hub.bank); } hub.bank.position.set(...hub.pos); }
      else if (hub.bank) { scene.remove(hub.bank); hub.bank.userData.mesh.dispose(); hub.bank = null; }
    });
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const grow = (p, r) => { x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); z0 = Math.min(z0, p[2] - r); z1 = Math.max(z1, p[2] + r); };
    for (const q of ISLANDS) grow(q.pos, q.R * 1.35);
    for (const h of HUBS) if (!h.list.length) grow(h.pos, BANK * 1.2);
    if (x0 > x1) { x0 = z0 = -60; x1 = z1 = 60; }
    MID.set((x0 + x1) / 2, 26, (z0 + z1) / 2); SPAN = Math.max(x1 - x0, z1 - z0) * 0.44 + 6;
    ALL = Math.max(x1 - x0, z1 - z0) / 2 + 30; fitShadow();
    linksStale = true;
  }
  // Bridges: in a hub every island to the one in the middle; neighbouring hubs by their two nearest islands; then any two islands whose ideas are linked.
  function wire() {
    const idx = new Map(ISLANDS.map((q, i) => [q.id, i])), n = new Map(), key = (i, j) => (i < j ? i + "|" + j : j + "|" + i), out = [];
    for (const [a, b, c] of PAIRS) if (idx.has(a) && idx.has(b)) n.set(key(idx.get(a), idx.get(b)), c);
    const take = (p, q) => { const i = ISLANDS.indexOf(p), j = ISLANDS.indexOf(q), k = key(i, j), c = n.get(k) || 0; n.delete(k); out.push([i, j, 1 + Math.min(3, c)]); };
    for (const hub of HUBS) hub.list.slice(1).forEach((q) => take(hub.list[0], q));
    const full = HUBS.filter((h) => h.list.length);
    for (let a = 0; a < (full.length > 2 ? full.length : full.length - 1); a++) {
      const A = full[a], B = full[(a + 1) % full.length]; let best = null, bd = 1e9;
      for (const p of A.list) for (const q of B.list) { const d = Math.hypot(p.pos[0] - q.pos[0], p.pos[2] - q.pos[2]) - p.R - q.R; if (d < bd) { bd = d; best = [p, q]; } }
      take(...best);
    }
    for (const [k, c] of n) out.push([...k.split("|").map(Number), Math.min(4, c)]);
    return out;
  }

  // ---------- labels: every island and topic has a tag with the key that jumps to it ----------
  let selTopic = -1;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function makeTags() {
    tagsEl.replaceChildren();
    HUBS.forEach((hub, h) => { hub.tag = mk("button", "tag hub"); hub.tag.append(mk("kbd", "", String(h + 1)), mk("span", "", hub.name)); hub.tag.dataset.hub = h; hub.tag.addEventListener("click", () => opts.onHub?.(h)); tagsEl.append(hub.tag); });
    ISLANDS.forEach((isl, i) => {
      isl.tag = mk("button", "tag isle"); isl.tag.append(mk("kbd", "", String(isl.nth + 1)), mk("span", "", isl.name)); isl.tag.dataset.isle = i; isl.tag.addEventListener("click", () => opts.onIsland?.(i));
      isl.tags = isl.topics.map((t, k) => { const e = mk("button", "tag topic" + (t.mist ? " mist" : "")); e.dataset.isle = i; e.dataset.topic = k; const bar = mk("i"); bar.append(mk("b")); bar.firstChild.style.width = Math.round(t.health * 100) + "%"; e.append(mk("kbd", "", String(k + 1)), mk("span", "", t.name), bar); e.addEventListener("click", () => opts.onTopic?.(i, k)); if (!t.name) e.hidden = true; return e; });
      tagsEl.append(isl.tag, ...isl.tags);
    });
    showTags();
  }
  // With several hubs: from far off only the hubs are named; inside a hub, its islands; on an island, its topics.
  function showTags() {
    const many = HUBS.length > 1;
    HUBS.forEach((hub, h) => { hub.tag?.classList.toggle("off", !many || h === fhub); hub.tag?.classList.toggle("keys", fhub < 0 && h < 9); });
    ISLANDS.forEach((isl, i) => {
      const near = !many || isl.hub === fhub;
      isl.tag?.classList.toggle("off", !near); isl.tag?.classList.toggle("on", i === foc); isl.tag?.classList.toggle("keys", foc < 0 && near && isl.nth < 9);
      isl.tags?.forEach((e, k) => { e.classList.toggle("show", i === foc); e.classList.toggle("sel", i === foc && k === selTopic); });
    });
  }

  // ---------- drawing ----------
  let last = performance.now(), idle = 9;
  function frame(now) {
    raf = 0; if (!active) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; idle += dt;
    if (queue.length) buildNext();
    if (opts.spin !== false && idle > 6 && !goal) yaw += dt * 0.03;
    if (goal) { const k = 1 - Math.pow(0.002, dt); panX = lerp(panX, goal.x, k); panZ = lerp(panZ, goal.z, k); tgtY = lerp(tgtY, goal.y, k); zoom = lerp(zoom, goal.zoom, k); resize(); if (Math.abs(zoom - goal.zoom) < 0.05 && Math.abs(panX - goal.x) < 0.05) goal = null; }
    cam.position.set(panX + Math.sin(yaw) * Math.cos(pitch) * 400, Math.sin(pitch) * 400 + tgtY, panZ + Math.cos(yaw) * Math.cos(pitch) * 400); cam.lookAt(panX, tgtY, panZ);
    const t = now / 1000; TIME.value = t; waterMat.opacity = 0.78 + Math.sin(t * 1.3) * 0.03;
    // far-off land moves at half pace when the sky is crowded, and other hubs hold still while one is being looked at
    tick++; ISLANDS.forEach((isl, i) => { if (isl.world && (fhub >= 0 && HUBS.length > 1 ? isl.hub === fhub : ISLANDS.length <= 8 || (i + tick) % 2 === 0)) { use(isl); animate(t); } });
    for (const hub of HUBS) if (hub.bank) drawBank(hub.bank, t);
    if (links.flames) drawLinks(t);
    drawSky(t, dt);
    renderer.render(scene, cam);
    const at = (e, v, lift) => { e.style.transform = `translate(${((v.x + 1) / 2 * W).toFixed(1)}px,${((1 - v.y) / 2 * Hh).toFixed(1)}px) translate(-50%,${lift})`; };
    ISLANDS.forEach((isl, i) => {
      if (!isl.world) return;
      if (i === foc) isl.tags.forEach((e, k) => { v3.copy(isl.world.anchors[k]).add(isl.group.position).project(cam); at(e, v3, "-100%"); });
      v3.set(isl.pos[0], isl.pos[1] + 29 + isl.R, isl.pos[2]).project(cam); at(isl.tag, v3, "-120%");
    });
    if (HUBS.length > 1) for (const hub of HUBS) { v3.set(hub.pos[0], 29 + (hub.list[0] ? hub.list[0].R + 22 : BANK), hub.pos[2]).project(cam); at(hub.tag, v3, "-120%"); }
    raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  // ---------- pointer: drag to turn, right-drag or two fingers to pan, wheel or pinch to zoom, tap to choose ----------
  const ptr = new Map(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); let pinch = 0, moved = 0;
  const pan = (dx, dy) => { const k = (cam.right - cam.left) / W, f = dy * k / Math.sin(pitch), lim = SPAN * 1.6; panX = clamp(panX - Math.cos(yaw) * dx * k - Math.sin(yaw) * f, MID.x - lim, MID.x + lim); panZ = clamp(panZ + Math.sin(yaw) * dx * k - Math.cos(yaw) * f, MID.z - lim, MID.z + lim); };
  function tap(e) {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    let best = -1, bd = 1e9;
    ISLANDS.forEach((isl, i) => { plane.constant = -(isl.pos[1] + 30); if (!ray.ray.intersectPlane(plane, hit)) return; const d = Math.hypot(hit.x - isl.pos[0], hit.z - isl.pos[2]); if (d < isl.R * 1.05 && d < bd) { bd = d; best = i; } });
    if (best < 0) { HUBS.forEach((hub, h) => { if (hub.list.length) return; plane.constant = -(hub.pos[1] + 30); if (ray.ray.intersectPlane(plane, hit) && Math.hypot(hit.x - hub.pos[0], hit.z - hub.pos[2]) < BANK * 1.1) best = h; }); if (best >= 0) opts.onHub?.(best); return; }
    if (HUBS.length > 1 && ISLANDS[best].hub !== fhub) return opts.onHub?.(ISLANDS[best].hub);
    if (best !== foc) return opts.onIsland?.(best);
    const isl = ISLANDS[best]; plane.constant = -(isl.pos[1] + 30); ray.ray.intersectPlane(plane, hit);
    let k = -1, kd = 1e9; isl.world.seeds.forEach((sd, q) => { const d = Math.hypot(hit.x - isl.pos[0] - sd.x, hit.z - isl.pos[2] - sd.z); if (d < kd) { kd = d; k = q; } });
    if (k >= 0 && isl.topics[k].name) opts.onTopic?.(best, k);
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => { ptr.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); idle = 0; moved = 0; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  canvas.addEventListener("pointermove", (e) => {
    const p = ptr.get(e.pointerId); if (!p) return; idle = 0;
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) goal = null;
    if (ptr.size === 1 && moved > 6) { if (e.buttons & 2 || e.shiftKey) pan(dx, dy); else { yaw -= dx * 0.006; pitch = clamp(pitch + dy * 0.005, 0.2, 1.25); } }
    p[0] = e.clientX; p[1] = e.clientY;
    if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) { zoom = clamp(zoom * pinch / d, 8, SPAN * 1.8); resize(); } pinch = d; pan(dx / 2, dy / 2); }
  });
  const up = (e) => { const was = ptr.size; ptr.delete(e.pointerId); pinch = 0; if (was === 1 && moved <= 6 && e.type === "pointerup") tap(e); };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); idle = 0; goal = null; zoom = clamp(zoom * Math.exp(e.deltaY * 0.0012), 8, SPAN * 1.8); resize(); }, { passive: false });
  new ResizeObserver(() => { if (active) resize(); }).observe(canvas);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) opts.spin = false;
  setNight(false);

  return {
    // islands: [{ id, name, landmark, patron, mountain, topics: [{ name, biome, health, growth, mark, color, color2, color3 }] }]; pairs: [[idA, idB, links]]
    // hubs: [{ id, name }]; each island names its hub by position in that list. With no hubs given, everything is one hub.
    setData(islands, pairs = [], hubs = null) {
      const shapeOf = () => HUBS.map((h) => h.id + "[" + h.list.map((q) => q.id + ":" + q.topics.length).join() + "]").join("|");
      const old = new Map(ISLANDS.map((q) => [q.id, q])), oldHubs = new Map(HUBS.map((h) => [h.id, h])), shape = ISLANDS.length || HUBS.length ? shapeOf() : "";
      HUBS = (hubs && hubs.length ? hubs : [{ id: "", name: "" }]).map((d) => { const hub = oldHubs.get(d.id) || {}; oldHubs.delete(d.id); return Object.assign(hub, { id: d.id, name: d.name, list: [] }); });
      for (const gone of oldHubs.values()) if (gone.bank) { scene.remove(gone.bank); gone.bank.userData.mesh.dispose(); }
      ISLANDS = islands.map((d) => { const isl = old.get(d.id) || { group: new THREE.Group() }; old.delete(d.id); if (!isl.group.parent) scene.add(isl.group); Object.assign(isl, d); isl.hub = HUBS[d.hub] ? d.hub : 0; isl.nth = HUBS[isl.hub].list.push(isl) - 1; let h = 0; for (const ch of String(d.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; isl.seed = d.seed ?? h % 40; return isl; });
      for (const gone of old.values()) { gone.group.traverse((o) => { if (o.geometry && o.geometry !== BOX && o.geometry !== RIBBON) o.geometry.dispose(); }); scene.remove(gone.group); }
      const first = !shape, changed = shape !== shapeOf();
      if (changed) { for (const isl of ISLANDS) isl.R = 0; if (foc >= ISLANDS.length) foc = -1; if (fhub >= HUBS.length || HUBS.length < 2) fhub = foc >= 0 ? ISLANDS[foc].hub : -1; place(); }
      PAIRS = pairs; const next = wire();
      if (JSON.stringify(next) !== JSON.stringify(LINKS)) { LINKS = next; linksStale = true; }
      for (const isl of ISLANDS) check(isl);
      makeTags();
      if (first) { panX = MID.x; panZ = MID.z; zoom = SPAN; resize(); } else if (changed && foc < 0 && fhub < 0) goal = { x: MID.x, z: MID.z, y: 30, zoom: SPAN };
      if (!queue.length && linksStale && ISLANDS.every((q) => q.world)) buildLinks();
      if (!ISLANDS.length && !ready) { ready = true; opts.onReady?.(); }
      wake();
    },
    focus(i) { if (i == null || i < 0) overview(); else flyTo(i); wake(); },
    focusHub(h) { if (h == null || h < 0) overview(); else flyHub(h); wake(); },
    // turn the camera to a set angle: yaw, and pitch up to straight down (for pictures and checks; dragging stops short of that)
    look(y, p) { yaw = y; pitch = clamp(p, 0.2, Math.PI / 2 - 0.004); idle = 0; wake(); },
    select(k) { selTopic = k; showTags(); },
    setActive(on) { active = on; if (on) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[quality].dpr)); resize(); wake(); } },
    setNight(on) { setNight(on); },
    setQuality(q) { if (!QUALITY[q] || q === quality) return; quality = q; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[q].dpr)); resize(); for (const isl of ISLANDS) check(isl); wake(); },
    get focused() { return foc; }, get hub() { return fhub; }, get spots() { return { hubs: HUBS.map((h) => ({ pos: h.pos, R: h.R, mist: !!h.bank })), islands: ISLANDS.map((q) => ({ pos: q.pos, R: q.R, hub: q.hub })), links: LINKS }; }, get night() { return night; }, get quality() { return quality; }, get ready() { return ready && !queue.length; }, get faces() { return ISLANDS.reduce((a, q) => a + (q.world ? q.world.quads : 0), 0); },
  };
}
