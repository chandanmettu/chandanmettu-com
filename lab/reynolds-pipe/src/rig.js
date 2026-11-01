import * as THREE from "three";
import { InkSet, inkMaterial, penUniforms } from "./ink.js?v=39d479d9";
import { paperMaterial, glassMaterial, glowMaterial, surfaceUniforms, fadingShadowDepth } from "./paper.js?v=39d479d9";
import { pageUniforms, printEye } from "./lift.js?v=39d479d9";
import { dyeVolume } from "./dye.js?v=39d479d9";
import { RIG } from "./model.js?v=39d479d9";

// Reynolds' apparatus as a pop-up figure. Figure space: millimetres, x along the page, y up from
// the paper, z toward the reader with the front (hinge) line at z = 0. Real lengths are drawn at
// 1 : 13.5; the tube is drawn about four times wider than its ½-inch bore so the dye reads.

export const SCALE = 1000 / 13.5; // figure mm per real metre
const AY = 22, AZ = -33; // tube axis
const RI = 2.1, RO = 2.6; // drawn bore and wall
export const TUBE_X0 = 34;
export const TUBE_X1 = TUBE_X0 + RIG.L * SCALE; // 145
const TAPS = RIG.taps.map((x) => TUBE_X0 + x * SCALE);
const PIEZO_TOP = AY + 40;
const OX = 160; // the outlet elbow
const BEAKER = { x: OX + 1.5, z: AZ, r: 6.6, h: 13, cap: 2.0e-3 };
export const DYE_COLOR = "#7a3cff";
export const HEAD_COLOR = "#14b8d8";

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);

function basisOf(axis) {
  const a = axis.clone().normalize();
  const t = Math.abs(a.y) < 0.9 ? UP.clone() : V3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(a, t).normalize();
  const v = new THREE.Vector3().crossVectors(a, u).normalize();
  return { a, u, v };
}
function circle(centre, axis, r, n = 40, from = 0, span = Math.PI * 2) {
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

export class Rig {
  constructor({ frame, shadows = true }) {
    this.frame = frame;
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(frame);
    this.group.updateMatrixWorld(true);

    this.page = pageUniforms(frame);
    this.pen = penUniforms();
    this.surf = surfaceUniforms();
    const shared = { ...this.pen, ...this.page };
    this.inkMain = inkMaterial({ shared, widthPx: 1.55, widthMm: 0.3 });
    this.inkFine = inkMaterial({ shared, widthPx: 1.05, widthMm: 0.18, alpha: 0.9 });
    this.inkBold = inkMaterial({ shared, widthPx: 2.0, widthMm: 0.42 });
    this.main = new InkSet(this.inkMain);
    this.fine = new InkSet(this.inkFine);
    this.bold = new InkSet(this.inkBold);
    this.sil = new InkSet(inkMaterial({ shared, widthPx: 1.6, widthMm: 0.32 }), { capacity: 9000 });
    this.wheelInk = new InkSet(this.inkMain);
    // the tags are live instruments, not part of the printed figure: their lines never print
    this.tagInk = new InkSet(this.inkMain);
    this.tagFine = new InkSet(this.inkFine);
    this.tagInk.noPrint = this.tagFine.noPrint = true;
    this.sets = [this.main, this.fine, this.bold, this.wheelInk, this.tagInk, this.tagFine];
    this.sweeps = [];
    this.occluders = [];
    this.surfaces = [];
    this.glassMats = [];
    this.glowMats = [];
    this.waterMats = [];
    this.lines = []; // every static line, for scheduling
    this.slot = 0;
    this.shadowDepth = shadows ? fadingShadowDepth() : null;
    this.mats = {};
    this.build();
  }

  // ---- materials ----
  paper(name, opts) {
    if (!this.mats[name]) this.mats[name] = paperMaterial(this.surf, this.page, opts);
    return this.mats[name];
  }
  get glass() {
    if (!this._glass) { this._glass = glassMaterial(this.surf, this.page); this.glassMats.push(this._glass); }
    return this._glass;
  }
  waterMaterial() {
    const m = glassMaterial(this.surf, this.page, { tint: "#9fc4dc", base: 0.16, edge: 0.3 });
    this.waterMats.push(m);
    return m;
  }

  // ---- scheduling: each part gets a slot; its lines draw together ----
  part(gap = 1) { this.slot += gap; return this.slot; }
  line(set, pts, opts = {}) {
    const entry = { set, pts, opts: { wobble: 0.22, overshoot: 0.5, ...opts, slot: opts.slot ?? this.slot } };
    this.lines.push(entry);
    return entry;
  }

  // ---- solids ----
  surface(mesh, { occlude = true, cast = true } = {}) {
    mesh.renderOrder = 2;
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    mesh.userData.cast = cast;
    if (this.shadowDepth) mesh.customDepthMaterial = this.shadowDepth;
    this.group.add(mesh);
    this.surfaces.push(mesh);
    if (occlude) this.occluders.push(mesh);
    return mesh;
  }

  box(x0, x1, y0, y1, z0, z1, mat, { set = this.main, edges = true, occlude = true, cast = true, width = 1 } = {}) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.surface(m, { occlude, cast });
    if (edges) {
      const c = (x, y, z) => V3(x, y, z);
      this.line(set, [c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)], { closed: true, width });
      this.line(set, [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)], { closed: true, width });
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) this.line(set, [c(x, y0, z), c(x, y1, z)], { width });
    }
    return m;
  }

  // a round part along any axis from a profile [[s, r], ...]; rings drawn at the listed s values
  lathe(origin, axis, profile, mat, { rings = null, sil = true, segments = 40, open = false, occlude = true, set = this.main, cast = true, glass = false } = {}) {
    const { a } = basisOf(axis);
    const pts = profile.map(([s, r]) => new THREE.Vector2(Math.max(r, 1e-3), s));
    const g = new THREE.LatheGeometry(pts, segments);
    const m = new THREE.Mesh(g, mat);
    m.quaternion.setFromUnitVectors(UP, a);
    m.position.copy(origin);
    if (glass) { m.renderOrder = 6; this.group.add(m); }
    else this.surface(m, { occlude, cast });
    const ringAt = rings ?? [profile[0][0], profile[profile.length - 1][0]];
    for (const s of ringAt) {
      const r = rAt(profile, s);
      const c = circle(origin.clone().addScaledVector(a, s), a, r, Math.max(24, Math.round(r * 9)));
      this.line(set, c.pts, { closed: true, wobble: 0.08, overshoot: 0 });
    }
    if (sil) this.sweep(profile.map(([s, r]) => ({ c: origin.clone().addScaledVector(a, s), t: a.clone(), r })));
    return m;
  }

  cylinder(p0, p1, r, mat, opts = {}) {
    const axis = p1.clone().sub(p0);
    const len = axis.length();
    const n = Math.max(2, Math.ceil(len / 2.5));
    const profile = [];
    for (let i = 0; i <= n; i++) profile.push([(len * i) / n, r]);
    return this.lathe(p0, axis, profile, mat, { rings: opts.rings ?? [0, len], ...opts });
  }

  // silhouettes of a swept round body: computed each frame from the eye, once for the print
  sweep(samples, { slot = this.slot } = {}) {
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
    this.sweeps.push({ samples: fine, slot });
  }

  // ---- the apparatus ----
  build() {
    const wood = this.paper("wood", { color: "#f4ecdc", hatchA: [0, 1, 0.15], hatchB: [0.2, 0.3, 1], spacing: 1.3, seed: 3 });
    const panel = this.paper("panel", { color: "#f7f2e7", hatchA: [0.62, 0.74, 0.45], spacing: 1.5, seed: 5 });
    const metal = this.paper("metal", { color: "#eeece6", hatchA: [0.1, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.1, shade: 0.22, seed: 9 });
    const card = this.paper("card", { color: "#fbf6ea", hatch: 0.25, shade: 0.06, seed: 11 });

    // the bench: a board on two trestles, a ruler along its front edge, a label plate
    this.part();
    this.box(4, 151, 7, 10, -48, -18, wood);
    for (const x of [10, 145]) {
      this.part(0.4);
      this.box(x - 1.6, x + 1.6, 0, 7, -46, -43, wood);
      this.box(x - 1.6, x + 1.6, 0, 7, -23, -20, wood);
      this.box(x - 1.2, x + 1.2, 2.2, 3.6, -43, -23, wood, { set: this.fine });
    }
    this.part(0.6);
    for (let i = 0; i <= 30; i++) {
      const x = TUBE_X0 + (i * 0.05) * SCALE;
      const len = i % 10 === 0 ? 2.2 : i % 2 === 0 ? 1.4 : 0.9;
      this.line(this.fine, [V3(x, 10, -18), V3(x, 10 - len, -18)], { wobble: 0.04, overshoot: 0, taper: false });
    }
    this.line(this.fine, [V3(TUBE_X0, 9.6, -18), V3(TUBE_X1, 9.6, -18)], { wobble: 0.05 });
    // label plate with three rule lines and four screws
    this.box(8, 26, 7.6, 9.6, -18, -17.7, card, { set: this.fine });
    for (let k = 0; k < 3; k++) this.line(this.fine, [V3(10, 9.1 - k * 0.5, -17.68), V3(24 - k * 3, 9.1 - k * 0.5, -17.68)], { wobble: 0, overshoot: 0, taper: false });
    for (const [x, z] of [[6, -46], [149, -46], [6, -20], [149, -20]]) this.line(this.fine, circle(V3(x, 10.02, z), UP, 0.45, 10).pts, { closed: true, wobble: 0, overshoot: 0 });

    // the constant-head tank: frame, back and side panels, a glass front, water inside
    this.part(1.2);
    const T = { x0: 12, x1: 36, y0: 10, y1: 64, z0: -46, z1: -20 };
    this.box(T.x0, T.x1, T.y0, T.y0 + 1.5, T.z0, T.z1, panel);
    this.box(T.x0, T.x1, T.y0 + 1.5, T.y1, T.z0, T.z0 + 1.2, panel);
    this.box(T.x0, T.x0 + 1.2, T.y0 + 1.5, T.y1, T.z0 + 1.2, T.z1, panel);
    this.box(T.x1 - 1.2, T.x1, T.y0 + 1.5, T.y1, T.z0 + 1.2, T.z1, panel);
    this.part(0.5);
    for (const [x, z] of [[T.x0, T.z0], [T.x1, T.z0], [T.x0, T.z1], [T.x1, T.z1]]) {
      const sx = x === T.x0 ? 1 : -1, sz = z === T.z0 ? 1 : -1;
      this.box(Math.min(x, x + sx * 2), Math.max(x, x + sx * 2), T.y0, T.y1 + 0.8, Math.min(z, z + sz * 2), Math.max(z, z + sz * 2), wood, { set: this.bold });
    }
    this.box(T.x0, T.x1, T.y1, T.y1 + 0.8, T.z1 - 2, T.z1, wood, { set: this.fine });
    this.box(T.x0, T.x1, T.y1, T.y1 + 0.8, T.z0, T.z0 + 2, wood, { set: this.fine });
    // glass front and water
    const front = new THREE.Mesh(new THREE.PlaneGeometry(T.x1 - T.x0 - 4, T.y1 - T.y0 - 1.5), this.glass);
    front.position.set((T.x0 + T.x1) / 2, (T.y0 + 1.5 + T.y1) / 2, T.z1 - 0.3);
    front.renderOrder = 6;
    this.group.add(front);
    const WL = AY + RIG.H * SCALE; // water surface: the head above the tube axis
    this.waterTop = WL;
    const water = new THREE.Mesh(new THREE.BoxGeometry(T.x1 - T.x0 - 2.6, WL - T.y0 - 1.5, T.z1 - T.z0 - 2.6), this.waterMaterial());
    water.position.set((T.x0 + T.x1) / 2, (T.y0 + 1.5 + WL) / 2, (T.z0 + T.z1) / 2);
    water.renderOrder = 4;
    this.group.add(water);
    this.part(0.4);
    this.line(this.main, [V3(T.x0 + 2, WL, T.z1 - 0.4), V3(T.x1 - 2, WL, T.z1 - 0.4)], { wobble: 0.12 });
    for (let k = 1; k <= 3; k++) this.line(this.fine, [V3(T.x0 + 3 + k * 1.6, WL - k * 1.2, T.z1 - 0.4), V3(T.x1 - 7 - k * 2.4, WL - k * 1.2, T.z1 - 0.4)], { wobble: 0.1 });

    // bell-mouth inside the tank, then the glass tube through the wall to the valve
    this.part(0.8);
    const flare = [];
    for (let i = 0; i <= 12; i++) {
      const s = (i / 12) * 10;
      const r = RO + (6 - RO) * Math.pow(1 - i / 12, 2.2);
      flare.push([s, r]);
    }
    this.lathe(V3(24, AY, AZ), V3(1, 0, 0), flare, this.glass, { glass: true, rings: [0, 10] });
    this.part(0.6);
    this.tubeStart = V3(TUBE_X0, AY, AZ);
    this.cylinder(V3(TUBE_X0, AY, AZ), V3(TUBE_X1, AY, AZ), RO, this.glass, { glass: true, rings: [0, TUBE_X1 - TUBE_X0] });
    // the dye in the bore
    this.dye = dyeVolume({ radius: RI, length: TUBE_X1 - TUBE_X0, cells: 128, color: DYE_COLOR });
    this.dye.mesh.position.set((TUBE_X0 + TUBE_X1) / 2, AY, AZ);
    this.group.add(this.dye.mesh);

    // two tube clamps on posts
    for (const x of [82, 112]) {
      this.part(0.35);
      this.box(x - 1, x + 1, 10, AY - RO - 0.6, AZ - 1, AZ + 1, metal, { set: this.fine });
      this.cylinder(V3(x - 1.1, AY, AZ), V3(x + 1.1, AY, AZ), RO + 0.6, metal, { rings: [0, 2.2] });
    }

    // piezometers: glass columns at the taps, a graduated strip behind each, glowing water inside
    this.columns = [];
    for (const x of TAPS) {
      this.part(0.6);
      this.cylinder(V3(x, AY + RO - 0.3, AZ), V3(x, AY + RO + 1.4, AZ), 1.9, metal, { rings: [0, 1.7] });
      this.cylinder(V3(x, AY + RO + 1.4, AZ), V3(x, PIEZO_TOP, AZ), 1.25, this.glass, { glass: true, rings: [0, PIEZO_TOP - AY - RO - 1.4] });
      this.box(x - 3.2, x + 3.2, AY + RO + 3, PIEZO_TOP, AZ - 3.6, AZ - 2.8, card, { set: this.fine });
      this.box(x - 0.8, x + 0.8, 10, AY + RO + 3, AZ - 3.6, AZ - 2.8, wood, { set: this.fine });
      for (let k = 0; k <= 10; k++) {
        const y = AY + k * 0.05 * SCALE;
        if (y < AY + RO + 3.3 || y > PIEZO_TOP - 0.3) continue;
        const major = k % 2 === 0;
        this.line(this.fine, [V3(x - 3.2, y, AZ - 2.78), V3(x - 3.2 + (major ? 1.8 : 1.0), y, AZ - 2.78)], { wobble: 0, overshoot: 0, taper: false });
      }
      const gm = glowMaterial(this.surf, this.page, HEAD_COLOR, { gain: 1.5, alpha: 0.9 });
      this.glowMats.push(gm);
      const geo = new THREE.CylinderGeometry(0.82, 0.82, 1, 20, 1, false);
      geo.translate(0, 0.5, 0);
      const col = new THREE.Mesh(geo, gm);
      col.position.set(x, AY, AZ);
      col.renderOrder = 5;
      col.userData.glow = true;
      this.group.add(col);
      this.columns.push(col);
    }

    // the valve: body on the tube, a stem toward the reader and a handwheel facing them
    this.part(0.8);
    const VX = 149;
    this.lathe(V3(TUBE_X1 - 0.2, AY, AZ), V3(1, 0, 0), [[0, 3.1], [1.2, 3.1], [1.6, 4.2], [6.8, 4.2], [7.2, 3.1], [8.6, 3.1]], metal, { rings: [0, 1.6, 6.8, 8.6] });
    this.lathe(V3(VX, AY, AZ), V3(0, 0, 1), [[0, 2.6], [5.5, 2.6], [6, 1.9], [9.6, 1.9], [10, 1.2], [12.2, 1.2]], metal, { rings: [5.5, 9.6, 12.2] });
    this.part(0.4);
    this.wheel = new THREE.Group();
    this.wheel.position.set(VX, AY, AZ + 12.4);
    this.group.add(this.wheel);
    this.wheel.add(this.wheelInk.mesh, this.wheelInk.flat);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.75, 12, 48), metal);
    this.wheelSurface(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.6, 20), metal);
    hub.rotation.x = Math.PI / 2;
    this.wheelSurface(hub);
    for (let k = 0; k < 4; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.9, 0.9), metal);
      const a = (k * Math.PI) / 2;
      spoke.position.set(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0);
      spoke.rotation.z = a;
      this.wheelSurface(spoke);
    }
    const wl = (pts, o = {}) => this.line(this.wheelInk, pts, { wobble: 0.05, overshoot: 0, ...o });
    for (const [r, z] of [[7.15, 0], [5.65, 0]]) wl(circle(V3(0, 0, z + 0.55), V3(0, 0, 1), r, 56).pts, { closed: true });
    wl(circle(V3(0, 0, 0.82), V3(0, 0, 1), 1.7, 20).pts, { closed: true });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), n = V3(-s, c, 0);
      for (const side of [-0.45, 0.45]) wl([V3(c * 1.75, s * 1.75, 0.46).addScaledVector(n, side), V3(c * 5.6, s * 5.6, 0.46).addScaledVector(n, side)], { taper: false });
    }
    // a knob on the rim to turn it by
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.2, 12), metal);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(6.4, 0, 1.8);
    this.wheelSurface(knob);
    wl(circle(V3(6.4, 0, 3.4), V3(0, 0, 1), 0.75, 12).pts, { closed: true });
    this.wheelHit = new THREE.Mesh(new THREE.CircleGeometry(8.4, 32), new THREE.MeshBasicMaterial({ visible: false }));
    this.wheel.add(this.wheelHit);

    // outlet: a short stub and an elbow down over the beaker
    this.part(0.6);
    this.cylinder(V3(TUBE_X1 + 8.4, AY, AZ), V3(OX, AY, AZ), 1.7, metal, { rings: [0, OX - TUBE_X1 - 8.4] });
    const elbow = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      elbow.push({ c: V3(OX + Math.sin(a) * 1.5, AY - 1.5 + Math.cos(a) * 1.5, AZ), t: V3(Math.cos(a), -Math.sin(a), 0), r: 1.7 });
    }
    const curve = new THREE.CatmullRomCurve3(elbow.map((e) => e.c));
    const elbowMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 1.7, 16, false), metal);
    this.surface(elbowMesh);
    this.sweep(elbow);
    this.cylinder(V3(OX + 1.5, AY - 1.5, AZ), V3(OX + 1.5, 16.4, AZ), 1.7, metal, { rings: [AY - 1.5 - 16.4] });
    this.nozzle = V3(OX + 1.5, 16.4, AZ);

    // the beaker on the page, and the falling jet
    this.part(0.7);
    const B = BEAKER;
    this.lathe(V3(B.x, 0, B.z), UP, [[0, B.r - 0.6], [0.6, B.r], [B.h, B.r], [B.h + 0.2, B.r + 0.5]], this.glass, { glass: true, rings: [0.6, B.h + 0.2] });
    this.line(this.main, circle(V3(B.x, 0.02, B.z), UP, B.r - 0.6, 36).pts, { closed: true, wobble: 0.05, overshoot: 0 });
    for (let k = 1; k <= 4; k++) {
      const y = k * 2.6;
      this.line(this.fine, circle(V3(B.x, y, B.z), UP, B.r + 0.02, 30, Math.PI * 0.32, Math.PI * 0.22).pts, { wobble: 0, overshoot: 0, taper: false });
    }
    const bw = this.waterMaterial();
    const bgeo = new THREE.CylinderGeometry(B.r - 0.5, B.r - 0.5, 1, 32);
    bgeo.translate(0, 0.5, 0);
    this.beakerWater = new THREE.Mesh(bgeo, bw);
    this.beakerWater.position.set(B.x, 0.7, B.z);
    this.beakerWater.renderOrder = 4;
    this.group.add(this.beakerWater);
    const jetGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    jetGeo.translate(0, -0.5, 0);
    this.jet = new THREE.Mesh(jetGeo, this.waterMaterial());
    this.jet.position.copy(this.nozzle);
    this.jet.renderOrder = 4;
    this.group.add(this.jet);

    // the dye reservoir: a flask on a bridge over the tank, a stopcock, the feed tube to the needle
    this.part(1);
    this.box(T.x0 - 0.5, T.x1 + 0.5, T.y1 + 0.8, T.y1 + 2.4, AZ - 2, AZ + 2, wood);
    this.part(0.5);
    const FX = 20;
    this.cylinder(V3(FX, T.y1 + 2.4, AZ), V3(FX, 71, AZ), 1.5, this.glass, { glass: true, rings: [0, 71 - T.y1 - 2.4] });
    this.lathe(V3(FX, 70.5, AZ), UP, sphereProfile(6.2, 1.5), this.glass, { glass: true, rings: [], sil: false });
    this.flaskCentre = V3(FX, 76.7, AZ);
    this.sphereSil = { c: this.flaskCentre.clone(), r: 6.2, slot: this.slot };
    this.cylinder(V3(FX, 82.6, AZ), V3(FX, 85, AZ), 1.3, metal, { rings: [0, 2.4] });
    this.part(0.4);
    this.box(FX - 1.6, FX + 1.6, 66.4, 68.4, AZ - 1.6, AZ + 1.6, metal, { set: this.fine });
    this.box(FX + 1.6, FX + 5.2, 67, 67.8, AZ - 0.5, AZ + 0.5, metal, { set: this.fine });
    const dyeIn = glowMaterial(this.surf, this.page, DYE_COLOR, { gain: 1.05, alpha: 0.88 });
    this.glowMats.push(dyeIn);
    this.feedMat = dyeIn;
    const feedPts = [V3(FX, 66.4, AZ), V3(FX, 30, AZ), V3(FX + 0.6, 24.6, AZ), V3(FX + 3, AY, AZ), V3(26.2, AY, AZ)];
    const feed = new THREE.CatmullRomCurve3(feedPts, false, "catmullrom", 0.2);
    const feedSamples = feed.getSpacedPoints(48);
    const feedMesh = new THREE.Mesh(new THREE.TubeGeometry(feed, 64, 0.34, 8, false), dyeIn);
    feedMesh.renderOrder = 5;
    feedMesh.userData.glow = true;
    this.group.add(feedMesh);
    // the thread leaves the needle and crosses the bell-mouth to the bore, where the volume takes over
    const threadGeo = new THREE.CylinderGeometry(0.2, 0.2, TUBE_X0 + 0.6 - 26.2, 8, 1, true);
    threadGeo.rotateZ(-Math.PI / 2);
    const thread = new THREE.Mesh(threadGeo, dyeIn);
    thread.position.set((26.2 + TUBE_X0 + 0.6) / 2, AY, AZ);
    thread.renderOrder = 5;
    thread.userData.glow = true;
    this.group.add(thread);
    this.part(0.3);
    this.sweep(feedSamples.map((c, i) => ({ c, t: feed.getTangentAt(i / 48), r: 0.6 })));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(5.2, 28, 18, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), dyeIn);
    bulb.position.copy(this.flaskCentre);
    bulb.renderOrder = 5;
    bulb.userData.glow = true;
    this.group.add(bulb);
    this.flaskDye = bulb;
    this.line(this.fine, circle(V3(FX, 76.7 - 5.2 * Math.cos(Math.PI * 0.42), AZ), UP, 5.2 * Math.sin(Math.PI * 0.42), 32).pts, { closed: true, wobble: 0.05, overshoot: 0 });

    // two handwritten tags on easels in front of the bench
    this.part(1);
    this.tags = {
      re: this.tag({ x0: 46, x1: 88, h: 19, z: -6, lean: 0.62, card }),
      dh: this.tag({ x0: 96, x1: 132, h: 19, z: -6, lean: 0.62, card }),
    };

    this.finish();
  }

  wheelSurface(mesh) {
    mesh.renderOrder = 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.cast = true;
    if (this.shadowDepth) mesh.customDepthMaterial = this.shadowDepth;
    this.wheel.add(mesh);
    this.surfaces.push(mesh);
    this.occluders.push(mesh);
  }

  tag({ x0, x1, h, z, lean, card }) {
    const w = x1 - x0;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * 16);
    canvas.height = Math.round(h * 16);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = paperMaterial(this.surf, this.page, { color: "#ffffff", hatch: 0.0, shade: 0.05, map: tex, side: THREE.DoubleSide });
    const pivot = new THREE.Group();
    pivot.position.set((x0 + x1) / 2, 0.3, z);
    pivot.rotation.x = -lean;
    this.group.add(pivot);
    const plane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), [card, card, card, card, mat, card]);
    plane.position.set(0, h / 2, 0);
    pivot.add(plane);
    plane.renderOrder = 2;
    plane.castShadow = true;
    plane.receiveShadow = true;
    plane.userData.cast = true;
    if (this.shadowDepth) plane.customDepthMaterial = this.shadowDepth;
    this.surfaces.push(plane);
    this.occluders.push(plane);
    // the easel strut behind it
    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.2, h * 0.86, 0.8), card);
    const back = V3((x0 + x1) / 2, 0.3, z - h * 0.62);
    // the strut meets the card's back face, never its front
    const top = V3(0, h * 0.82, -0.7).applyEuler(pivot.rotation).add(pivot.position);
    strut.position.copy(back.clone().lerp(top, 0.5));
    strut.lookAt(top);
    strut.rotateX(Math.PI / 2);
    this.surface(strut);
    // outlines in the tilted frame
    const toFig = (lx, ly, lz) => V3(lx, ly, lz).applyEuler(pivot.rotation).add(pivot.position);
    const hw = w / 2;
    this.line(this.tagInk, [toFig(-hw, 0, 0.26), toFig(hw, 0, 0.26), toFig(hw, h, 0.26), toFig(-hw, h, 0.26)], { closed: true, width: 1.05 });
    this.line(this.tagFine, [toFig(-hw + 1.2, 1.2, 0.27), toFig(hw - 1.2, 1.2, 0.27), toFig(hw - 1.2, h - 1.2, 0.27), toFig(-hw + 1.2, h - 1.2, 0.27)], { closed: true, wobble: 0.04 });
    this.line(this.tagFine, [back, top], { wobble: 0.05 });
    return { canvas, tex, w, h, last: "" };
  }

  // schedule: slots become start times, then everything is fitted to `total` seconds
  finish(total = 3.2) {
    const slots = [...new Set([...this.lines.map((l) => l.opts.slot), ...this.sweeps.map((s) => s.slot), this.sphereSil.slot])].sort((a, b) => a - b);
    const maxSlot = slots[slots.length - 1] || 1;
    const speed = 150; // mm per second, before fitting
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
    this.sphereSil.t0 = startOf(this.sphereSil.slot);
    this.sphereSil.dur = 0.35;
    for (const l of this.lines) l.set.add(l.pts, l.opts);
    for (const set of this.sets) set.build();
    this.drawEnd = Math.max(end, this.sphereSil.t0 + this.sphereSil.dur);
    // the print copy of the silhouettes, seen from the print eye
    this.sil.setFlat(this.silhouettes(null));
    for (const set of [this.main, this.fine, this.bold, this.tagInk, this.tagFine, this.sil]) this.group.add(set.mesh, set.flat);
  }

  // silhouette lines for an eye in figure space (null: the print eye, a direction)
  silhouettes(eye) {
    const pe = printEye();
    const lines = [];
    const n = new THREE.Vector3(), v = new THREE.Vector3();
    for (const s of this.sweeps) {
      const a = [], b = [];
      for (const k of s.samples) {
        if (eye) v.copy(eye).sub(k.c).normalize(); else v.copy(pe);
        n.crossVectors(k.t, v);
        if (n.lengthSq() < 1e-8) n.copy(basisOf(k.t).u);
        n.normalize();
        a.push(k.c.clone().addScaledVector(n, k.r));
        b.push(k.c.clone().addScaledVector(n, -k.r));
      }
      for (const pts of [a, b]) lines.push({ points: pts, t0: s.t0, dur: s.dur, wobble: 0, overshoot: 0, taper: true, step: 1.6 });
    }
    // the flask bulb: a circle facing the eye
    const c = this.sphereSil.c;
    if (eye) v.copy(eye).sub(c).normalize(); else v.copy(pe);
    const ring = circle(c, v, this.sphereSil.r, 48);
    lines.push({ points: ring.pts, closed: true, t0: this.sphereSil.t0, dur: this.sphereSil.dur, wobble: 0, overshoot: 0 });
    return lines;
  }

  // hidden lines stay hidden in the print: test each point against the solids toward the print eye
  computePrintVisibility() {
    const ray = new THREE.Raycaster();
    const dir = printEye().transformDirection(this.group.matrixWorld);
    const sides = this.occluders.map((m) => (Array.isArray(m.material) ? m.material.map((x) => x.side) : m.material.side));
    const setSide = (m, s) => { if (Array.isArray(m.material)) m.material.forEach((x, i) => (x.side = Array.isArray(s) ? s[i] : s)); else m.material.side = s; };
    this.occluders.forEach((m) => setSide(m, THREE.DoubleSide));
    this.group.updateMatrixWorld(true);
    const test = (p, parent) => {
      const w = parent.localToWorld(p.clone()).addScaledVector(dir, 0.25);
      ray.set(w, dir);
      ray.near = 0.05;
      ray.far = 400;
      return ray.intersectObjects(this.occluders, false).length ? 0 : 1;
    };
    for (const set of this.sets) {
      const parent = set === this.wheelInk ? this.wheel : this.group;
      for (const line of set.lines) line.vis = line.pts.map((p) => test(p, parent));
      set._write(set.geometry, set.lines);
    }
    for (const line of this.sil.flatLines) line.vis = line.pts.map((p) => test(p, this.group));
    this.sil.rewriteFlat();
    this.occluders.forEach((m, i) => setSide(m, sides[i]));
  }

  // ---- live updates ----
  updateSilhouettes(camera) {
    const eye = this.group.worldToLocal(camera.position.clone());
    this.sil.setLines(this.silhouettes(eye));
  }

  update(flow, R, dt, camera, { valveTurns }) {
    // dye
    this.dye.update(flow);
    const u = this.dye.material.uniforms;
    u.uCam.value.copy(this.dye.mesh.worldToLocal(camera.position.clone()));
    const vModel = flow.V * SCALE; // mm/s in the drawing
    u.uTime.value += dt;
    u.uFlowX.value += vModel * dt;
    u.uThreadX.value += flow.centre * SCALE * dt * 0.25;
    this.feedMat.uniforms.uOn.value += ((flow.dye ? 1 : 0.18) - this.feedMat.uniforms.uOn.value) * Math.min(1, dt * 4);
    // piezometer columns from the heads
    const heads = [R.ha, R.hb];
    this.columns.forEach((col, i) => { col.scale.y = Math.max(0.2, heads[i] * SCALE); });
    // handwheel
    this.wheel.rotation.z = valveTurns * Math.PI * 2;
    // the jet and the beaker
    const Qml = R.Q * 1e6;
    const r = Math.min(1.25, 0.18 + 0.11 * Math.sqrt(Math.max(0, Qml)));
    const level = 0.7 + Math.min(1, (flow.collected % BEAKER.cap) / BEAKER.cap) * (BEAKER.h - 1.8);
    this.beakerWater.scale.y = Math.max(0.05, level - 0.7);
    this.jet.scale.set(Qml > 0.5 ? r : 0.001, Math.max(0.1, this.nozzle.y - level), Qml > 0.5 ? r : 0.001);
  }
}

function rAt(profile, s) {
  for (let i = 1; i < profile.length; i++) {
    const [s0, r0] = profile[i - 1], [s1, r1] = profile[i];
    if (s <= s1 + 1e-9) return r0 + (r1 - r0) * ((s - s0) / Math.max(1e-9, s1 - s0));
  }
  return profile[profile.length - 1][1];
}

// a round-bottom flask from its neck down: [s, r] with s measured up from the bottom
function sphereProfile(R, neck) {
  const out = [];
  const a0 = Math.asin(neck / R); // polar angle (from the top) where the neck leaves the bulb
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - (Math.PI - a0) * (i / 16);
    out.push([R + R * Math.cos(a), Math.max(0.01, R * Math.sin(a))]);
  }
  return out;
}
