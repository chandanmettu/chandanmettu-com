import * as THREE from "three";
import { InkSet, inkMaterial, penUniforms } from "./ink.js?v=f9d0af7e";
import { paperMaterial, glowMaterial, surfaceUniforms, fadingShadowDepth } from "./paper.js?v=f9d0af7e";
import { pageUniforms, printEye } from "./lift.js?v=f9d0af7e";

// One plant unit as a pop-up figure printed on the poster. Figure space: millimetres, x along the
// poster, y up from the paper, z toward the reader with the front (hinge) line at z = 0 and the
// depth going back (-z). Each figure prints flat on the sheet until its chapter opens, then its
// ink draws itself standing up and its paper surfaces fade in (the Reynolds and Sénarmont engine).

export const HEAT = "#ff7a1c"; // heat: the one colour for anything hot
export const GAS = "#18b8d6"; // reducing and fuel gas: the second colour, always moving

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const UP = V3(0, 1, 0);
export const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function basisOf(axis) {
  const a = axis.clone().normalize();
  const t = Math.abs(a.y) < 0.9 ? UP.clone() : V3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(a, t).normalize();
  const v = new THREE.Vector3().crossVectors(a, u).normalize();
  return { a, u, v };
}
export function circle(centre, axis, r, n = 40, from = 0, span = Math.PI * 2) {
  const { u, v } = basisOf(axis);
  const pts = [];
  const closed = span >= Math.PI * 2 - 1e-6;
  const count = closed ? n : Math.max(2, Math.ceil(n * span / (Math.PI * 2)) + 1);
  for (let i = 0; i < count; i++) {
    const t = from + span * (i / (closed ? n : count - 1));
    pts.push(centre.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(v, Math.sin(t) * r));
  }
  return { pts, closed };
}
// a horizontal circle (or arc) about a vertical axis; angle anticlockwise from +x seen from above
export const ring = (cx, y, cz, r, a) => V3(cx + r * Math.cos(a), y, cz - r * Math.sin(a));
export function hArc(cx, y, cz, r, a0, a1, n = 48) {
  const pts = [];
  const k = Math.max(2, Math.ceil(n * Math.abs(a1 - a0) / (Math.PI * 2)) + 1);
  for (let i = 0; i < k; i++) pts.push(ring(cx, y, cz, r, a0 + (a1 - a0) * (i / (k - 1))));
  return pts;
}
export function rAt(profile, s) {
  for (let i = 1; i < profile.length; i++) {
    const [s0, r0] = profile[i - 1], [s1, r1] = profile[i];
    if (s <= s1 + 1e-9) return r0 + (r1 - r0) * ((s - s0) / Math.max(1e-9, s1 - s0));
  }
  return profile[profile.length - 1][1];
}

export class Figure {
  constructor({ frame, name, spill, shadows = true, total = 3.2 }) {
    this.name = name;
    this.frame = frame;
    this.total = total;
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(frame);
    this.group.updateMatrixWorld(true);
    this.page = pageUniforms(frame);
    this.pen = penUniforms();
    this.surf = surfaceUniforms();
    if (spill) Object.assign(this.surf, spill);
    const shared = { ...this.pen, ...this.page };
    this.shared = shared;
    this.inkMain = inkMaterial({ shared, widthPx: 1.45, widthMm: 0.32 });
    this.inkFine = inkMaterial({ shared, widthPx: 0.95, widthMm: 0.18, alpha: 0.88 });
    this.inkBold = inkMaterial({ shared, widthPx: 2.0, widthMm: 0.45 });
    this.inkMats = [this.inkMain, this.inkFine, this.inkBold];
    this.main = new InkSet(this.inkMain);
    this.fine = new InkSet(this.inkFine);
    this.bold = new InkSet(this.inkBold);
    const silMat = inkMaterial({ shared, widthPx: 1.5, widthMm: 0.32 });
    this.inkMats.push(silMat);
    this.sil = new InkSet(silMat, { capacity: 24000 });
    this.sets = [this.main, this.fine, this.bold];
    this.extraSil = []; // further silhouette sets with their own print copies
    this.parentOf = new Map();
    this.sweeps = [];
    this.occluders = [];
    this.surfaces = [];
    this.glowMats = [];
    this.lines = [];
    this.slot = 0;
    this.mats = {};
    this.shadowDepth = shadows ? fadingShadowDepth() : null;
    this.inkMats.forEach((m) => (m.userData.basePx = m.uniforms.uWidthPx.value));
    // the lift: print → peel (the pen draws) → shade (paper fades in) → live; undraw folds it back
    this.phase = "print"; this.t = 0;
    this.surfA = 0; this.lift3 = 1; this.copy = 1; this.stand = 1;
    this.onLive = null;
  }

  // ---- materials ----
  paper(name, opts) {
    if (!this.mats[name]) this.mats[name] = paperMaterial(this.surf, this.page, opts);
    return this.mats[name];
  }
  glow(color = HEAT, gain = 1.6, alpha = 0.92) {
    const m = glowMaterial(this.surf, this.page, color, { gain, alpha });
    this.glowMats.push(m);
    return m;
  }
  glowMesh(geo, color = HEAT, { gain = 1.5, alpha = 0.9, parent = this.group } = {}) {
    const m = new THREE.Mesh(geo, this.glow(color, gain, alpha));
    m.renderOrder = 5; m.userData.glow = true;
    parent.add(m);
    return m;
  }

  // ---- moving parts carry their own ink ----
  mover(name, parent = this.group) {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    const main = new InkSet(this.inkMain), fine = new InkSet(this.inkFine);
    g.add(main.mesh, main.flat, fine.mesh, fine.flat);
    this.sets.push(main, fine);
    this.parentOf.set(main, g); this.parentOf.set(fine, g);
    g.userData.ink = { main, fine };
    return g;
  }

  // ---- scheduling: each part gets a slot; its lines draw together ----
  part(gap = 1) { this.slot += gap; return this.slot; }
  line(set, pts, opts = {}) {
    const entry = { set, pts, opts: { wobble: 0.22, overshoot: 0.5, ...opts, slot: opts.slot ?? this.slot } };
    this.lines.push(entry);
    return entry;
  }
  poly(set, pts, opts = {}) { return this.line(set, pts, { wobble: 0.12, overshoot: 0.3, ...opts }); }

  // ---- solids ----
  surface(mesh, { occlude = true, cast = true, parent = this.group } = {}) {
    mesh.renderOrder = 2;
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    mesh.userData.cast = cast;
    if (this.shadowDepth && !mesh.isInstancedMesh) mesh.customDepthMaterial = this.shadowDepth;
    parent.add(mesh);
    this.surfaces.push(mesh);
    if (occlude) this.occluders.push(mesh);
    return mesh;
  }

  boxEdges(set, x0, x1, y0, y1, z0, z1, width = 1, { top = true, bottom = true, verts = true } = {}) {
    const c = V3;
    if (top) this.line(set, [c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)], { closed: true, width });
    if (bottom) this.line(set, [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)], { closed: true, width });
    if (verts) for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) this.line(set, [c(x, y0, z), c(x, y1, z)], { width });
  }

  box(x0, x1, y0, y1, z0, z1, mat, { set = this.main, edges = true, occlude = true, cast = true, width = 1, parent = this.group, bottom = false } = {}) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.surface(m, { occlude, cast, parent });
    if (edges) this.boxEdges(set, x0, x1, y0, y1, z0, z1, width, { bottom });
    return m;
  }

  // a round part along any axis from a profile [[s, r], ...]; rings drawn at the listed s values
  lathe(origin, axis, profile, mat, { rings = null, sil = true, segments = 40, occlude = true, set = this.main, cast = true, parent = this.group, phi0 = 0, phiLen = Math.PI * 2, ringN = null } = {}) {
    const { a } = basisOf(axis);
    const pts = profile.map(([s, r]) => new THREE.Vector2(Math.max(r, 1e-3), s));
    const g = new THREE.LatheGeometry(pts, segments, phi0, phiLen);
    const m = new THREE.Mesh(g, mat);
    m.quaternion.setFromUnitVectors(UP, a);
    m.position.copy(origin);
    this.surface(m, { occlude, cast, parent });
    const ringAt = rings ?? [profile[0][0], profile[profile.length - 1][0]];
    for (const s of ringAt) {
      const r = rAt(profile, s);
      const c = circle(origin.clone().addScaledVector(a, s), a, r, ringN ?? Math.max(24, Math.min(160, Math.round(r * 9))));
      this.line(set, c.pts, { closed: true, wobble: 0.08, overshoot: 0 });
    }
    if (sil) this.sweep(profile.map(([s, r]) => ({ c: origin.clone().addScaledVector(a, s), t: a.clone(), r })), { parent });
    return m;
  }

  cylinder(p0, p1, r, mat, opts = {}) {
    const axis = p1.clone().sub(p0);
    const len = axis.length();
    const n = Math.max(2, Math.ceil(len / 4));
    const profile = [];
    for (let i = 0; i <= n; i++) profile.push([(len * i) / n, r]);
    return this.lathe(p0, axis, profile, mat, { rings: opts.rings ?? [0, len], ...opts });
  }

  // a pipe along a curve: surface plus silhouettes
  pipe(points, r, mat, { tension = 0.3, segs = null, set = this.main, ends = true, cast = true, parent = this.group, occlude = true } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", tension);
    const len = curve.getLength();
    const n = segs ?? Math.max(8, Math.round(len / 3));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, n, r, 12, false), mat);
    this.surface(mesh, { cast, parent, occlude });
    const k = Math.max(4, Math.round(len / 2.5));
    this.sweep(curve.getSpacedPoints(k).map((c, i) => ({ c, t: curve.getTangentAt(Math.min(1, i / k)), r })), { parent });
    if (ends) for (const u of [0, 1]) {
      const c = circle(curve.getPointAt(u), curve.getTangentAt(u), r, Math.max(12, Math.round(r * 6)));
      this.line(set, c.pts, { closed: true, wobble: 0.04, overshoot: 0 });
    }
    return { mesh, curve };
  }

  sweep(samples, { slot = this.slot, parent = this.group } = {}) {
    const fine = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const A = samples[i], B = samples[i + 1];
      const n = Math.max(1, Math.ceil(A.c.distanceTo(B.c) / 2));
      for (let k = 0; k < n; k++) {
        const f = k / n;
        fine.push({ c: A.c.clone().lerp(B.c, f), t: A.t.clone().lerp(B.t, f).normalize(), r: A.r + (B.r - A.r) * f });
      }
    }
    fine.push(samples[samples.length - 1]);
    // a sweep on a moving part is stored in that part's frame and carried to the figure each frame
    this.sweeps.push({ samples: fine, slot, parent: parent === this.group ? null : parent });
  }

  // a handwritten tag on an easel; its canvas is redrawn by the page
  tag({ x0, x1, h, z, lean = 0.62, y = 0.3, parent = this.group }) {
    const card = this.paper("tagcard", { color: "#fbf6ea", hatch: 0.25, shade: 0.06, seed: 11 });
    const w = x1 - x0;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * 16);
    canvas.height = Math.round(h * 16);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = paperMaterial(this.surf, this.page, { color: "#ffffff", hatch: 0.0, shade: 0.05, map: tex, side: THREE.DoubleSide });
    const pivot = new THREE.Group();
    pivot.position.set((x0 + x1) / 2, y, z);
    pivot.rotation.x = -lean;
    parent.add(pivot);
    const plane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), [card, card, card, card, mat, card]);
    plane.position.set(0, h / 2, 0);
    pivot.add(plane);
    plane.renderOrder = 2;
    plane.castShadow = true;
    plane.receiveShadow = true;
    plane.userData.cast = true;
    if (this.shadowDepth) plane.customDepthMaterial = this.shadowDepth;
    this.surfaces.push(plane); // tags never print, so they never hide a printed line
    // tags live in the figure itself (not in a moving part) and never print
    const toFig = (lx, ly, lz) => V3(lx, ly, lz).applyEuler(pivot.rotation).add(pivot.position);
    const hw = w / 2;
    if (!this.tagInk) {
      this.tagInk = new InkSet(this.inkMain); this.tagFine = new InkSet(this.inkFine);
      this.tagInk.noPrint = this.tagFine.noPrint = true;
      this.sets.push(this.tagInk, this.tagFine);
    }
    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.2, h * 0.86, 0.8), card);
    const top = toFig(0, h * 0.82, -0.7);
    const foot = V3(pivot.position.x, y, z - h * 0.62);
    strut.position.copy(foot.clone().lerp(top, 0.5));
    strut.lookAt(top);
    strut.rotateX(Math.PI / 2);
    this.group.add(strut);
    strut.castShadow = true; strut.userData.cast = true; strut.renderOrder = 2;
    this.surfaces.push(strut);
    this.line(this.tagInk, [toFig(-hw, 0, 0.26), toFig(hw, 0, 0.26), toFig(hw, h, 0.26), toFig(-hw, h, 0.26)], { closed: true, width: 1.05 });
    this.line(this.tagFine, [toFig(-hw + 1.2, 1.2, 0.27), toFig(hw - 1.2, 1.2, 0.27), toFig(hw - 1.2, h - 1.2, 0.27), toFig(-hw + 1.2, h - 1.2, 0.27)], { closed: true, wobble: 0.04 });
    this.line(this.tagFine, [foot, top], { wobble: 0.05 });
    return { canvas, tex, w, h, last: "", pivot };
  }

  finish() {
    const total = this.total;
    const slots = [...new Set([...this.lines.map((l) => l.opts.slot), ...this.sweeps.map((s) => s.slot)])].sort((a, b) => a - b);
    const maxSlot = slots[slots.length - 1] || 1;
    const speed = 150;
    const startOf = (slot) => (slot / maxSlot) * total * 0.78;
    let end = 0;
    for (const l of this.lines) {
      const len = l.pts.reduce((s, p, i) => (i ? s + p.distanceTo(l.pts[i - 1]) : 0), 0) + (l.opts.closed ? l.pts[0].distanceTo(l.pts[l.pts.length - 1]) : 0);
      l.opts.t0 = startOf(l.opts.slot);
      l.opts.dur = Math.min(0.7, Math.max(0.12, len / speed));
      end = Math.max(end, l.opts.t0 + l.opts.dur);
    }
    for (const s of this.sweeps) {
      let len = 0;
      for (let i = 1; i < s.samples.length; i++) len += s.samples[i].c.distanceTo(s.samples[i - 1].c);
      s.t0 = startOf(s.slot);
      s.dur = Math.min(0.7, Math.max(0.12, len / speed));
      end = Math.max(end, s.t0 + s.dur);
    }
    for (const l of this.lines) l.set.add(l.pts, l.opts);
    for (const set of this.sets) set.build();
    this.drawEnd = end;
    this.sil.setFlat(this.silhouettes(null));
    for (const set of [this.main, this.fine, this.bold, this.sil, ...(this.tagInk ? [this.tagInk, this.tagFine] : [])]) this.group.add(set.mesh, set.flat);
    this.group.traverse((o) => { if (o.userData.glow) o.layers.enable(3); });
    this.applyPhase();
  }

  silhouettes(eye) {
    const pe = printEye();
    const lines = [];
    const n = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();
    for (const s of this.sweeps) {
      const a = [], b = [];
      if (s.parent && !s.parent.visible) continue;
      const m = s.parent ? this._toFig(s.parent).clone() : null;
      for (const k of s.samples) {
        c.copy(k.c); t.copy(k.t);
        if (m) { c.applyMatrix4(m); t.transformDirection(m); }
        if (eye) v.copy(eye).sub(c).normalize(); else v.copy(pe);
        n.crossVectors(t, v);
        if (n.lengthSq() < 1e-8) n.copy(basisOf(t).u);
        n.normalize();
        a.push(c.clone().addScaledVector(n, k.r));
        b.push(c.clone().addScaledVector(n, -k.r));
      }
      for (const pts of [a, b]) lines.push({ points: pts, t0: s.t0, dur: s.dur, wobble: 0, overshoot: 0, taper: true, step: 1.8 });
    }
    return lines;
  }

  // the matrix taking a nested group's local space into figure space
  _toFig(g) {
    if (!this._m) this._m = new THREE.Matrix4();
    this._m.identity();
    const chain = [];
    for (let o = g; o && o !== this.group; o = o.parent) chain.unshift(o);
    for (const o of chain) { o.updateMatrix(); this._m.multiply(o.matrix); }
    return this._m;
  }

  computePrintVisibility() {
    const ray = new THREE.Raycaster();
    const dir = printEye().transformDirection(this.group.matrixWorld);
    const occ = this.occluders.slice();
    const sides = occ.map((m) => (Array.isArray(m.material) ? m.material.map((x) => x.side) : m.material.side));
    const setSide = (m, s) => { if (Array.isArray(m.material)) m.material.forEach((x, i) => (x.side = Array.isArray(s) ? s[i] : s)); else m.material.side = s; };
    occ.forEach((m) => setSide(m, THREE.DoubleSide));
    this.group.updateMatrixWorld(true);
    const w = new THREE.Vector3();
    const test = (p, parent) => {
      w.copy(p); parent.localToWorld(w).addScaledVector(dir, 0.3);
      ray.set(w, dir);
      ray.near = 0.05;
      ray.far = 600;
      return ray.intersectObjects(occ, false).length ? 0 : 1;
    };
    for (const set of this.sets) {
      if (set.noPrint) continue;
      const parent = this.parentOf.get(set) || this.group;
      for (const line of set.lines) line.vis = line.pts.map((p) => test(p, parent));
      set._write(set.geometry, set.lines);
    }
    for (const sil of [this.sil, ...this.extraSil]) {
      for (const line of sil.flatLines) line.vis = line.pts.map((p) => test(p, this.group));
      sil.rewriteFlat();
    }
    occ.forEach((m, i) => setSide(m, sides[i]));
  }

  updateSilhouettes(camera) {
    const eye = this.group.worldToLocal(camera.position.clone());
    this.sil.setLines(this.silhouettes(eye));
  }

  setRes(size, dpr) {
    this.pen.uRes.value.copy(size);
    this.inkMats.forEach((m) => (m.uniforms.uWidthPx.value = m.userData.basePx * dpr));
  }

  // ---- the lift ----
  setPhase(p) {
    this.phase = p; this.t = 0;
    if (p === "print") { this.lift3 = 1; this.surfA = 0; this.copy = 1; this.stand = 1; }
    if (p === "live") { this.surfA = 1; this.copy = 0; this.stand = 1; this.lift3 = 1; }
    if (p === "peel") { this.copy = 1; this.stand = 1; this.lift3 = 1; this.surfA = 0; }
    this.applyPhase();
    if (p === "live" && this.onLive) this.onLive(this);
  }
  liftUp(still = false) {
    if (this.phase === "live" || this.phase === "peel" || this.phase === "shade") return;
    this.setPhase(still ? "live" : "peel");
  }
  foldDown(still = false) {
    if (this.phase === "print" || this.phase === "undraw") return;
    this.setPhase(still ? "print" : "undraw");
  }
  get standing() { return this.phase !== "print" && this.phase !== "undraw"; }
  get drawing() { return this.phase === "peel" && this.t < this.drawEnd; }

  step(dt) {
    this.t += dt;
    const u = this.pen;
    if (this.phase === "print") u.uClock.value = 0;
    if (this.phase === "peel") {
      u.uClock.value = this.t;
      this.copy = 1;
      if (this.t >= this.drawEnd) this.setPhase("shade");
    }
    if (this.phase === "shade") {
      u.uClock.value = 1e5;
      this.surfA = smooth(this.t / 0.5);
      if (this.t >= 0.5) this.setPhase("live");
    }
    if (this.phase === "live") u.uClock.value = 1e5;
    if (this.phase === "undraw") {
      u.uClock.value = 1e5;
      this.surfA = 1 - smooth(this.t / 0.15);
      const s = smooth((this.t - 0.15) / 0.45);
      this.lift3 = 1 - s;
      const r = smooth((s - 0.78) / 0.22);
      this.copy = r; this.stand = 1 - r;
      if (this.t >= 0.62) this.setPhase("print");
    }
    this.applyPhase();
  }

  applyPhase() {
    const u = this.pen;
    u.uLift.value = this.lift3;
    u.uCopyAll.value = this.phase === "peel" ? 0 : 1;
    u.uStandAlpha.value = this.stand;
    u.uCopyAlpha.value = this.copy;
    const showCopy = this.phase !== "live" && this.phase !== "shade";
    for (const set of [...this.sets, this.sil, ...(this.extraSil || [])]) {
      set.flat.visible = showCopy && !set.noPrint;
      set.mesh.visible = this.phase !== "print";
    }
    this.surf.uSurfAlpha.value = this.surfA;
    this.surf.uLiftSurf.value = this.phase === "undraw" ? this.lift3 : 1;
    if (this.shadowDepth) this.shadowDepth.opacity = this.surfA;
    const cast = this.surfA > 0.01;
    for (const m of this.surfaces) { m.castShadow = cast && m.userData.cast !== false; m.visible = this.surfA > 0.002 || this.phase === "undraw"; }
    for (const m of this.glowMats) m.uniforms.uSurfAlpha && (m.uniforms.uSurfAlpha.value = this.surfA);
  }
}
