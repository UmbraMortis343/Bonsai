// The 3D stage: renderer, camera (orbit, pan, zoom, fly), picking and the
// HTML labels that follow points in the scene.
import * as THREE from "./vendor/three.module.min.js";
export { THREE };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FLY = {};   // flying with WASD went in the controls revamp (0.27.0): the mouse turns, pans and zooms

export class Stage {
  constructor(container) {
    this.container = container;
    this.canvas = container.querySelector("canvas");
    this.labelLayer = container.querySelector(".labels");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 2000);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.9);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(6, 12, 5);
    this.scene.add(this.hemi, this.sun);
    this.world = new THREE.Group(); this.scene.add(this.world);

    this.target = new THREE.Vector3(0, 2, 0); this.radius = 12; this.theta = 0.6; this.phi = 1.2;
    this.labels = []; this.pickables = []; this.tickers = new Set(); this.keys = new Set();
    this.labelOpacity = () => 1; this.labelRank = () => 1; this.onTap = () => {}; this.onHover = () => {}; this.onDouble = () => {}; this.onMenu = null;
    this.ray = new THREE.Raycaster(); this._v = new THREE.Vector3(); this._ndc = new THREE.Vector2();
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.frame = this.frame.bind(this); this.last = 0; this.raf = 0;

    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container);
    this.resize(); this.bind();
  }

  setTheme(t) {
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.sky, 70, 460);
    this.invalidate();
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.focal = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.invalidate();
  }

  // Distance at which a sphere of radius r fills the view.
  fitDistance(r) {
    const v = THREE.MathUtils.degToRad(this.camera.fov), hfov = 2 * Math.atan(Math.tan(v / 2) * this.camera.aspect);
    return (r / Math.sin(Math.min(v, hfov) / 2)) * 1.02;
  }

  setView({ target, radius, theta, phi }) {
    if (target) this.target.copy(target);
    if (radius != null) this.radius = radius;
    if (theta != null) this.theta = theta;
    if (phi != null) this.phi = phi;
    this.anim = null; this.userMoved = false; this.invalidate();
  }

  flyTo({ target, radius, theta, phi }, ms = 520) {
    if (this.reduced || ms <= 0) { this.setView({ target, radius, theta, phi }); return Promise.resolve(); }
    return new Promise((done) => {
      if (this.anim) this.anim.done();
      this.anim = { t: 0, ms, done, from: { target: this.target.clone(), radius: this.radius, theta: this.theta, phi: this.phi },
        to: { target: target ? target.clone() : this.target.clone(), radius: radius ?? this.radius, theta: theta ?? this.theta, phi: phi ?? this.phi } };
      this.invalidate();
    });
  }

  applyCamera() {
    const sp = Math.sin(this.phi);
    this.camera.position.set(this.target.x + this.radius * sp * Math.sin(this.theta), Math.max(0.2, this.target.y + this.radius * Math.cos(this.phi)), this.target.z + this.radius * sp * Math.cos(this.theta));
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    // the haze keeps its distance as the view pulls back, so a wide ring of graphs doesn't fade out
    if (this.scene.fog) { this.scene.fog.near = Math.max(70, this.radius * 1.6); this.scene.fog.far = Math.max(460, this.radius * 5); }
  }

  invalidate() { if (!this.raf) this.raf = requestAnimationFrame(this.frame); }

  frame(now) {
    this.raf = 0;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    let active = false;
    if (this.anim) {
      const a = this.anim; a.t = Math.min(1, a.t + ((dt * 1000) / a.ms || 0.02));
      const k = ease(a.t);
      this.target.lerpVectors(a.from.target, a.to.target, k);
      this.radius = a.from.radius + (a.to.radius - a.from.radius) * k;
      this.theta = a.from.theta + (a.to.theta - a.from.theta) * k;
      this.phi = a.from.phi + (a.to.phi - a.from.phi) * k;
      if (a.t >= 1) { this.anim = null; a.done(); } else active = true;
    }
    if (this.keys.size) {
      const f = this._v.set(-Math.sin(this.theta), 0, -Math.cos(this.theta)), speed = Math.max(2, this.radius) * 0.9 * dt;
      for (const k of this.keys) {
        const m = FLY[k]; if (!m) continue;
        this.target.x += (f.x * m[2] - f.z * m[0]) * speed; this.target.z += (f.z * m[2] + f.x * m[0]) * speed;
        this.target.y = Math.max(0, this.target.y + m[1] * speed);
      }
      active = true;
    }
    for (const fn of this.tickers) if (fn(dt, now)) active = true;
    this.applyCamera();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    if (active) this.invalidate(); else this.last = 0;
  }

  // ---- labels ----
  setLabels(list) {
    this.labelLayer.replaceChildren(...list.map((l) => l.el));
    for (const l of list) { l.shown = true; l.w = l.tidy ? l.el.offsetWidth : 0; }
    this.labels = list; this.invalidate();
  }
  // Places each label over its point. Labels marked tidy give way to more
  // important ones (labelRank: lower wins) when they would overlap.
  updateLabels() {
    const v = this._v, cam = this.camera, live = [];
    for (const L of this.labels) {
      v.copy(L.pos); const dist = v.distanceTo(cam.position); v.project(cam);
      const on = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      L.op = on ? this.labelOpacity(L, dist) : 0;
      if (L.op < 0.03) continue;
      L.sx = (v.x * 0.5 + 0.5) * this.w; L.cy = (-v.y * 0.5 + 0.5) * this.h; L.rr = L.r ? (L.r / dist) * this.focal : 0;
      L.sy = L.cy - (L.r ? L.rr + 4 : 0);
      L.rank = L.tidy ? this.labelRank(L) + dist * 1e-4 : -1;
      live.push(L);
    }
    live.sort((a, b) => a.rank - b.rank);
    const kept = [], balls = live.filter((L) => L.rr > 3);
    // a name may not sit on another idea's ball either
    const onBall = (self, x0, x1, y0, y1) => balls.some((B) => B !== self && (Math.max(x0, Math.min(B.sx, x1)) - B.sx) ** 2 + (Math.max(y0, Math.min(B.cy, y1)) - B.cy) ** 2 < (B.rr + 1) ** 2);
    for (const L of live) {
      if (L.tidy) {
        let x0 = L.sx - L.w / 2, x1 = L.sx + L.w / 2, y1 = L.sy + (L.dy || 0), y0 = y1 - 20;   // dy: where the label's foot sits when it isn't right over its point
        // no two names may touch: the lesser one moves to its second place if it has one (alt), else goes,
        // when their boxes come within a few pixels of each other
        const onName = () => kept.some((k) => x0 < k[1] + 6 && x1 > k[0] - 6 && y0 < k[3] + 2 && y1 > k[2] - 2), hits = () => onName() || onBall(L, x0, x1, y0, y1);
        const home = [x0, x1, y0, y1, onName(), L.sx, L.sy];   // over its own ball; if only balls are in the way everywhere, it stays here
        L.at = null;
        if (L.rank >= 1 && hits()) {
          let ok = false;
          if (L.alt) {
            v.copy(L.alt.pos).project(cam); const sx = (v.x * 0.5 + 0.5) * this.w, sy = (-v.y * 0.5 + 0.5) * this.h;
            x0 = sx - L.w / 2; x1 = sx + L.w / 2; y1 = sy + (L.alt.dy || 0); y0 = y1 - 20;
            if (!hits()) { ok = true; L.sx = sx; L.sy = sy; L.at = L.alt.anchor; }
          } else if (L.rr) {   // an idea's name can go under its own ball, or to either side of it
            const tries = [
              [L.sx - L.w / 2, L.cy + L.rr + 3, L.sx, L.cy + L.rr + 3, "translate(-50%,0)"],
              [L.sx + L.rr + 4, L.cy - 10, L.sx + L.rr + 4, L.cy, "translate(0,-50%)"],
              [L.sx - L.rr - 4 - L.w, L.cy - 10, L.sx - L.rr - 4, L.cy, "translate(-100%,-50%)"],
            ];
            for (const [bx, by, px, py, at] of tries) {
              x0 = bx; x1 = bx + L.w; y0 = by; y1 = by + 20;
              if (!hits()) { ok = true; L.sx = px; L.sy = py; L.at = at; break; }
            }
          }
          if (!ok && !home[4]) { [x0, x1, y0, y1] = home; L.sx = home[5]; L.sy = home[6]; L.at = null; ok = true; }
          if (!ok) { L.op = 0; continue; }
        }
        kept.push([x0, x1, y0, y1]);
      }
    }
    for (const L of this.labels) {
      if (L.op < 0.03) { if (L.shown) { L.el.style.display = "none"; L.shown = false; } continue; }
      if (!L.shown) { L.el.style.display = ""; L.shown = true; }
      L.el.style.transform = `translate(${L.sx.toFixed(1)}px,${L.sy.toFixed(1)}px) ${L.at || L.anchor || "translate(-50%,-100%)"}`;
      L.el.style.opacity = L.op > 0.97 ? "" : L.op.toFixed(2);
    }
  }
  screenOf(pos) {
    const v = this._v.copy(pos).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  // The line into the scene under a point on the screen.
  rayAt(clientX, clientY) {
    const r = this.container.getBoundingClientRect();
    this._ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this._ndc, this.camera);
    return this.ray.ray;
  }
  // ---- picking ----
  pick(clientX, clientY) {
    const r = this.container.getBoundingClientRect();
    this._ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this._ndc, this.camera);
    let best = null;
    for (const m of this.pickables) {
      const hit = this.ray.intersectObject(m, false)[0];
      if (hit && (!best || hit.distance < best.distance)) best = { distance: hit.distance, kind: m.userData.kind, id: m.userData.ids ? m.userData.ids[hit.instanceId] : m.userData.id };
    }
    return best;
  }

  bind() {
    const c = this.container, ptr = new Map();
    let moved = 0, downTarget = null, pinch = 0, mid = null, grabbed = null;
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input,textarea,button,a")) return;
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
      if (ptr.size === 1) {
        moved = 0; downTarget = e.target; grabbed = null;
        // onGrab(hit, e) may hand back { move(e), end(cancelled) } to take this drag instead of turning the view
        if (this.onGrab && e.button === 0 && !e.shiftKey) { const lbl = e.target.closest?.(".lbl"); grabbed = this.onGrab(lbl ? { kind: lbl.dataset.kind, id: lbl.dataset.id } : this.pick(e.clientX, e.clientY), e) || null; }
      }
      if (ptr.size === 2 && grabbed) { grabbed.end(true); grabbed = null; }
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; moved = 99; }
      try { c.setPointerCapture(e.pointerId); } catch {}
      if (this.anim) { this.anim.done(); this.anim = null; }
    });
    c.addEventListener("pointermove", (e) => {
      const p = ptr.get(e.pointerId);
      if (!p) { if (e.pointerType === "mouse") this.hoverAt(e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptr.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved < 6) return;
        if (grabbed) { grabbed.move(e); this.invalidate(); return; }
        this.userMoved = true;
        if (p.button === 2 || p.button === 1 || p.shift) this.pan(dx, dy);
        else { this.theta -= dx * 0.006; this.phi = clamp(this.phi - dy * 0.006, 0.08, 1.56); }
      } else if (ptr.size === 2) {
        const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.userMoved = true;
        if (pinch) this.radius = clamp(this.radius * (pinch / d), 1.2, 600);
        this.pan(m.x - mid.x, m.y - mid.y); pinch = d; mid = m;
      }
      this.invalidate();
    });
    const up = (e) => {
      const p = ptr.get(e.pointerId); if (!p) return;
      ptr.delete(e.pointerId);
      if (grabbed) { const g = grabbed; grabbed = null; if (moved >= 6) return g.end(e.type !== "pointerup"); g.end(true); }
      if (e.type === "pointerup" && ptr.size === 0 && moved < 6 && (p.button === 0 || (p.button === 2 && this.onMenu))) {
        const lbl = downTarget?.closest?.(".lbl");
        const hit = lbl ? { kind: lbl.dataset.kind, id: lbl.dataset.id } : this.pick(e.clientX, e.clientY);
        if (p.button === 2) this.onMenu(hit, e); else this.onTap(hit, e);   // a right-click that didn't drag asks for the thing's menu
      }
    };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") this.onHover(null); });
    c.addEventListener("dblclick", (e) => { if (e.target.closest("input,textarea,button,a")) return; const lbl = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".lbl");   // the drag's pointer capture makes the container the target, so look under the pointer
      this.onDouble(lbl ? { kind: lbl.dataset.kind, id: lbl.dataset.id } : this.pick(e.clientX, e.clientY), e); });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.anim) { this.anim.done(); this.anim = null; }
      this.userMoved = true;
      this.radius = clamp(this.radius * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012)), 1.2, 600); this.invalidate();
    }, { passive: false });
    const kd = (e) => {
      if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || (this.isPaused && this.isPaused()) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      this.keys.add(e.code); this.userMoved = true; this.invalidate();
    }, ku = (e) => this.keys.delete(e.code), bl = () => this.keys.clear();
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", bl);
    this.unbind = () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", bl); };
  }
  // a second stage (the Library's 3D view) is taken down when its page closes
  destroy() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.ro?.disconnect(); this.unbind?.(); this.tickers.clear();
    this.world.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.renderer.dispose(); this.renderer.forceContextLoss?.();
  }
  pan(dx, dy) {
    const k = this.radius * 0.0016, m = this.camera.matrixWorld.elements;
    this.target.x -= (m[0] * dx - m[4] * dy) * k; this.target.y = Math.max(0, this.target.y - (m[1] * dx - m[5] * dy) * k); this.target.z -= (m[2] * dx - m[6] * dy) * k;
  }
  hoverAt(e) {
    const now = performance.now(); if (now - (this._h || 0) < 40) return; this._h = now;
    const lbl = e.target.closest?.(".lbl");
    const hit = lbl ? { kind: lbl.dataset.kind, id: lbl.dataset.id } : this.pick(e.clientX, e.clientY);
    this.onHover(hit, e);
  }
}
