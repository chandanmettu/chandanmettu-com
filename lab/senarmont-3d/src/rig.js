import * as THREE from "three";
import { InkSet, inkMaterial, penUniforms } from "./ink.js?v=325f87e0";
import { paperMaterial, glowMaterial, surfaceUniforms, fadingShadowDepth } from "./paper.js?v=325f87e0";
import { pageUniforms, printEye, LIFT_GLSL } from "./lift.js?v=325f87e0";
import { PLATE, AIR, WAX } from "./model.js?v=325f87e0";

// Sénarmont's bench as a pop-up figure. Figure space: millimetres, x along the page, y up from the
// paper, z toward the reader with the front (hinge) line at z = 0. The crystal plate is drawn at
// 1.5 times its 40 mm size; the stand and the control box are drawn to suit it.
//
// Heat is the only colour: the stylus coil and tip, the pilot lamp, and the plate's temperature
// field glowing through the wax, with an isotherm every 20 K. The melt front is inked from the
// same field, so the drawing and the readings come from one model.

export const DRAW = 1500; // figure mm per real metre on the plate (1.5 : 1)
export const HEAT_COLOR = "#ff7a1c";
export const CX = 96, CZ = -52; // the stage axis
const BASE_Y = 6;
const RING_TOP = 9.5, DISC_TOP = 12.1;
export const PY = 18.6; // the wax surface
const PR = PLATE.R * DRAW, FLAT = PLATE.flat * DRAW;
export const LIFT_MM = 12;
const ARM_Y = 74;
const COL = { x: 26, z: -78 };
const BOX = { x0: 8, x1: 44, y0: BASE_Y, y1: 24, z0: -44, z1: -20 };
const GAUGE = { x: 32, y: 15.6 }, KNOB = { x: 17, y: 15.6 };
export const GAUGE_RANGE = [0, 350], SET_RANGE = [120, 320], SWEEP = (135 * Math.PI) / 180;

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
// a point on a horizontal circle, angle measured anticlockwise seen from above, from +x toward -z
const onRing = (cx, y, cz, r, a) => V3(cx + r * Math.cos(a), y, cz - r * Math.sin(a));

// the plate outline in its own frame: a 40 mm disc with the reference flat (crystal axis 1 runs
// along it). Shape coordinates are crystal coordinates in drawn mm: x along axis 1, y along axis 2.
function plateOutline(n = 120) {
  const pts = [];
  const from = Math.asin(-FLAT / PR), to = Math.PI - from; // over the top, from one end of the flat to the other
  for (let i = 0; i <= n; i++) {
    const t = from + (to - from) * (i / n);
    pts.push(new THREE.Vector2(PR * Math.cos(t), PR * Math.sin(t)));
  }
  return pts; // closes along the flat
}

// The wax: paper that melts. Inside the 62 °C isotherm it turns glassy and loses its hatching, and
// the melt front is inked from the field itself. Shape coordinates (vObj.xy) are crystal mm.
function waxMaterial(surf, page, heat) {
  const m = paperMaterial(surf, page, { color: "#fbf3e1", hatchA: [0.3, 1, 0.7], spacing: 1.2, shade: 0.1, hatch: 0.55, seed: 21 });
  Object.assign(m.userData.uniforms, heat);
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (s) => {
    base(s);
    Object.assign(s.uniforms, heat);
    s.fragmentShader = s.fragmentShader
      .replace("varying vec3 vObj; varying vec3 vWorldEj;", `varying vec3 vObj; varying vec3 vWorldEj;
uniform sampler2D uHeat; uniform float uHeatSpan, uRise, uHeatOn;`)
      .replace("vec3 ejPaper = diffuseColor.rgb * (1.0 - uShade * ejDark);", `vec3 ejPaper = diffuseColor.rgb * (1.0 - uShade * ejDark);
  float spT = texture2D(uHeat, vObj.xy / uHeatSpan + 0.5).r * uHeatOn;
  float spFw = max(fwidth(spT), 1e-3);
  float spMelt = smoothstep(uRise - 0.6 * spFw, uRise + 0.6 * spFw, spT);
  // molten wax goes clear: the darker plate shows through, with a soft sheen
  ejPaper = mix(ejPaper, vec3(0.83, 0.80, 0.74) + 0.06 * smoothstep(0.55, 0.95, ejForm), spMelt);
  ejCov *= 1.0 - 0.85 * spMelt;
  // the melt front, inked; just outside it a faint ridge where the wax heaped up
  float spFront = 1.0 - smoothstep(0.7, 1.7, abs(spT - uRise) / spFw);
  float spRidge = smoothstep(uRise - 14.0, uRise - 2.0, spT) * (1.0 - spMelt);
  ejPaper *= 1.0 - 0.06 * spRidge;
  ejCov = max(ejCov, spFront * 0.95 * step(uRise * 0.5, spT + 1e-3));`);
  };
  m.customProgramCacheKey = () => "sp-wax";
  return m;
}

// The heat itself, glowing through the wax: brighter where it is hotter, with an isotherm every 20 K.
function heatMaterial(surf, page, heat) {
  return new THREE.ShaderMaterial({
    uniforms: { ...surf, ...page, ...heat, uColor: { value: new THREE.Color(HEAT_COLOR) } },
    vertexShader: /* glsl */ `
${LIFT_GLSL}
uniform float uLiftSurf;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(liftToPage(w.xyz, uLiftSurf), 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uHeat; uniform float uHeatSpan, uRise, uHeatOn, uSurfAlpha; uniform vec3 uColor;
varying vec2 vP;
void main() {
  float T = texture2D(uHeat, vP / uHeatSpan + 0.5).r * uHeatOn;
  float glow = pow(smoothstep(18.0, 260.0, T), 0.75);
  float c = T / 20.0, fw = max(fwidth(c), 1e-3);
  float iso = (1.0 - smoothstep(0.55, 1.4, abs(fract(c + 0.5) - 0.5) / fw)) * smoothstep(12.0, 30.0, T);
  float a = (0.62 * glow + 0.5 * iso) * uSurfAlpha;
  vec3 col = mix(uColor, vec3(1.0, 0.93, 0.78), 0.45 * smoothstep(150.0, 300.0, T));
  gl_FragColor = vec4(col * a * 1.35, a);
}`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export class Rig {
  constructor({ frame, model, shadows = true }) {
    this.frame = frame;
    this.model = model;
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
    // moving parts carry their own ink: the turning stage, the stylus that lifts, the dial needles
    this.stageInk = new InkSet(this.inkMain);
    this.stageFine = new InkSet(this.inkFine);
    this.heaterInk = new InkSet(this.inkMain);
    this.needleInk = new InkSet(this.inkBold);
    this.knobInk = new InkSet(this.inkMain);
    this.tagInk = new InkSet(this.inkMain);
    this.tagFine = new InkSet(this.inkFine);
    this.tagInk.noPrint = this.tagFine.noPrint = true;
    this.sets = [this.main, this.fine, this.bold, this.stageInk, this.stageFine, this.heaterInk, this.needleInk, this.knobInk, this.tagInk, this.tagFine];
    this.sweeps = [];
    this.occluders = [];
    this.surfaces = [];
    this.glowMats = [];
    this.lines = [];
    this.slot = 0;
    this.lift = new THREE.Vector3(); // the stylus's current lift, for its silhouettes
    this.shadowDepth = shadows ? fadingShadowDepth() : null;
    this.mats = {};

    // the plate's temperature field, uploaded every frame (rise above ambient, K)
    const N = model.N;
    this.heatData = new Uint16Array(N * N);
    this.heatTex = new THREE.DataTexture(this.heatData, N, N, THREE.RedFormat, THREE.HalfFloatType);
    this.heatTex.magFilter = this.heatTex.minFilter = THREE.LinearFilter;
    this.heatTex.wrapS = this.heatTex.wrapT = THREE.ClampToEdgeWrapping;
    this.heatTex.needsUpdate = true;
    this.heat = {
      uHeat: { value: this.heatTex },
      uHeatSpan: { value: model.span * DRAW },
      uRise: { value: WAX.Tm - AIR.T0 },
      uHeatOn: { value: 1 },
    };
    // cells outside the plate copy their nearest plate cell, so the bilinear field has no false cold rim
    this.nearest = new Int32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i;
      if (model.active[c]) { this.nearest[c] = c; continue; }
      let best = c, bestD = 1e9;
      for (let r = 1; r < 6 && best === c; r++) {
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
          const n = jj * N + ii, d = di * di + dj * dj;
          if (model.active[n] && d < bestD) { bestD = d; best = n; }
        }
      }
      this.nearest[c] = best;
    }
    this.build();
  }

  // ---- materials ----
  paper(name, opts) {
    if (!this.mats[name]) this.mats[name] = paperMaterial(this.surf, this.page, opts);
    return this.mats[name];
  }
  glow(gain = 1.6, alpha = 0.92) {
    const m = glowMaterial(this.surf, this.page, HEAT_COLOR, { gain, alpha });
    this.glowMats.push(m);
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
  surface(mesh, { occlude = true, cast = true, parent = this.group } = {}) {
    mesh.renderOrder = 2;
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    mesh.userData.cast = cast;
    if (this.shadowDepth) mesh.customDepthMaterial = this.shadowDepth;
    parent.add(mesh);
    this.surfaces.push(mesh);
    if (occlude) this.occluders.push(mesh);
    return mesh;
  }

  box(x0, x1, y0, y1, z0, z1, mat, { set = this.main, edges = true, occlude = true, cast = true, width = 1, parent = this.group } = {}) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.surface(m, { occlude, cast, parent });
    if (edges) {
      const c = (x, y, z) => V3(x, y, z);
      this.line(set, [c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)], { closed: true, width });
      this.line(set, [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)], { closed: true, width });
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) this.line(set, [c(x, y0, z), c(x, y1, z)], { width });
    }
    return m;
  }

  // a round part along any axis from a profile [[s, r], ...]; rings drawn at the listed s values
  lathe(origin, axis, profile, mat, { rings = null, sil = true, segments = 40, occlude = true, set = this.main, cast = true, parent = this.group, offset = null } = {}) {
    const { a } = basisOf(axis);
    const pts = profile.map(([s, r]) => new THREE.Vector2(Math.max(r, 1e-3), s));
    const g = new THREE.LatheGeometry(pts, segments);
    const m = new THREE.Mesh(g, mat);
    m.quaternion.setFromUnitVectors(UP, a);
    m.position.copy(origin);
    this.surface(m, { occlude, cast, parent });
    const ringAt = rings ?? [profile[0][0], profile[profile.length - 1][0]];
    for (const s of ringAt) {
      const r = rAt(profile, s);
      const c = circle(origin.clone().addScaledVector(a, s), a, r, Math.max(24, Math.round(r * 9)));
      this.line(set, c.pts, { closed: true, wobble: 0.08, overshoot: 0 });
    }
    // silhouettes live in figure space; a part in a moving group passes the group's offset
    if (sil) this.sweep(profile.map(([s, r]) => ({ c: origin.clone().addScaledVector(a, s), t: a.clone(), r })), { offset });
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

  sweep(samples, { slot = this.slot, offset = null } = {}) {
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
    this.sweeps.push({ samples: fine, slot, offset });
  }

  // ---- the bench ----
  build() {
    const iron = this.paper("iron", { color: "#efebe2", hatchA: [0.2, 1, 0.3], hatchB: [1, 0.3, -0.4], spacing: 1.25, shade: 0.2, seed: 3 });
    const metal = this.paper("metal", { color: "#eeece6", hatchA: [0.1, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.1, shade: 0.22, seed: 9 });
    const brass = this.paper("brass", { color: "#f3ead6", hatchA: [0.62, 0.74, 0.45], spacing: 1.2, shade: 0.18, seed: 13 });
    const card = this.paper("card", { color: "#fbf6ea", hatch: 0.25, shade: 0.06, seed: 11 });
    const enamel = this.paper("enamel", { color: "#f5f0e4", hatchA: [0.62, 0.74, 0.45], spacing: 1.5, shade: 0.12, seed: 5 });
    const crystal = this.paper("crystal", { color: "#eef0ee", hatchA: [1, 0.15, 0.4], spacing: 0.9, shade: 0.12, hatch: 0.7, seed: 17 });
    const L = (set, pts, o) => this.line(set, pts, o);
    const flat = { wobble: 0, overshoot: 0, taper: false };

    // the base: a cast plate with four screws and a label plate
    this.part();
    this.box(4, 150, 0, BASE_Y, -92, -10, iron, { set: this.bold });
    L(this.fine, [V3(6, BASE_Y, -12.2), V3(148, BASE_Y, -12.2)], { wobble: 0.05 });
    for (const [x, z] of [[7.5, -88.5], [146.5, -88.5], [146.5, -14.6], [52, -14.6]]) L(this.fine, circle(V3(x, BASE_Y + 0.02, z), UP, 0.6, 10).pts, { closed: true, ...flat });
    this.part(0.5);
    this.box(8, 28, BASE_Y, BASE_Y + 0.5, -17.6, -13.2, card, { set: this.fine });
    for (let k = 0; k < 3; k++) L(this.fine, [V3(10.4, BASE_Y + 0.52, -16.5 + k * 1.05), V3(22 - k * 3, BASE_Y + 0.52, -16.5 + k * 1.05)], flat);

    // the fixed bearing ring with its degree scale: 0° on the lab's x axis, anticlockwise from above
    this.part(1);
    this.lathe(V3(CX, BASE_Y, CZ), UP, [[0, 37], [RING_TOP - BASE_Y, 37]], iron, { rings: [0, RING_TOP - BASE_Y] });
    L(this.fine, circle(V3(CX, RING_TOP + 0.02, CZ), UP, 34.0, 96).pts, { closed: true, wobble: 0.05, overshoot: 0 });
    for (let d = 0; d < 360; d += 5) {
      const a = (d * Math.PI) / 180, major = d % 30 === 0, mid = d % 10 === 0;
      const r1 = major ? 36.6 : mid ? 35.6 : 35.0;
      L(major ? this.main : this.fine, [onRing(CX, RING_TOP + 0.03, CZ, 34.0, a), onRing(CX, RING_TOP + 0.03, CZ, r1, a)], flat);
    }
    // the arrow at the scale's zero: the bench's x axis, engraved in the base
    this.part(0.4);
    const AX0 = CX + 38.6, AX1 = CX + 51;
    L(this.main, [V3(AX0, BASE_Y + 0.02, CZ), V3(AX1, BASE_Y + 0.02, CZ)], { wobble: 0.04, overshoot: 0 });
    L(this.main, [V3(AX1 - 3.4, BASE_Y + 0.02, CZ - 1.6), V3(AX1 + 0.2, BASE_Y + 0.02, CZ), V3(AX1 - 3.4, BASE_Y + 0.02, CZ + 1.6)], { wobble: 0.03, overshoot: 0, taper: false });
    L(this.fine, circle(V3(AX0, BASE_Y + 0.02, CZ), UP, 0.6, 10).pts, { closed: true, ...flat });
    this.arrow = { from: V3(AX0, BASE_Y, CZ), to: V3(AX1, BASE_Y, CZ) };

    // the turning stage: a disc with an index notch, a grip, three standoffs and the waxed plate
    this.stage = new THREE.Group();
    this.stage.position.set(CX, 0, CZ);
    this.group.add(this.stage);
    this.stage.add(this.stageInk.mesh, this.stageInk.flat, this.stageFine.mesh, this.stageFine.flat);
    const S = this.stage;
    this.part(0.8);
    this.lathe(V3(0, RING_TOP, 0), UP, [[0, 33.6], [DISC_TOP - RING_TOP, 33.6]], brass, { parent: S, set: this.stageInk, rings: [0, DISC_TOP - RING_TOP], sil: false });
    // the disc is round, so its outline does not turn: its silhouettes live in the figure
    this.sweep([{ c: V3(CX, RING_TOP, CZ), t: UP.clone(), r: 33.6 }, { c: V3(CX, DISC_TOP, CZ), t: UP.clone(), r: 33.6 }]);
    // the index notch on axis 1 reads the scale; a tick marks axis 2
    L(this.stageInk, [V3(33.6, DISC_TOP + 0.02, 0), V3(29.6, DISC_TOP + 0.02, -1.6), V3(29.6, DISC_TOP + 0.02, 1.6)], { closed: true, wobble: 0, overshoot: 0 });
    L(this.stageFine, [V3(0, DISC_TOP + 0.02, -33.6), V3(0, DISC_TOP + 0.02, -31)], flat);
    this.part(0.4);
    this.box(-39.4, -33.2, RING_TOP + 0.6, DISC_TOP - 0.4, -2.4, 2.4, metal, { set: this.stageInk, parent: S });
    for (let k = -1.6; k <= 1.61; k += 0.8) L(this.stageFine, [V3(-39.4, RING_TOP + 0.9, k), V3(-39.4, DISC_TOP - 0.7, k)], flat);
    this.part(0.4);
    for (const deg of [90, 210, 330]) {
      const a = (deg * Math.PI) / 180, x = 24 * Math.cos(a), z = -24 * Math.sin(a);
      this.box(x - 1.3, x + 1.3, DISC_TOP, PY - 1.6, z - 1.3, z + 1.3, metal, { set: this.stageFine, parent: S });
    }
    // the crystal plate: 0.3 mm thick in life, drawn 1.6 mm so its edge reads
    this.part(0.8);
    const outline = plateOutline();
    const shape = new THREE.Shape(outline);
    const slab = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 1 });
    const plate = new THREE.Mesh(slab, crystal);
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = PY - 1.6;
    this.surface(plate, { parent: S });
    const toLocal = (p, y) => V3(p.x, y, -p.y); // crystal (x, y) mm → stage (x, y, z)
    for (const y of [PY + 0.01, PY - 1.6]) L(this.stageInk, outline.map((p) => toLocal(p, y)), { closed: true, wobble: 0.05, overshoot: 0 });
    for (const p of [outline[0], outline[outline.length - 1]]) L(this.stageInk, [toLocal(p, PY - 1.6), toLocal(p, PY)], flat);
    // the wax on top, then the heat glowing through it, then the stylus hole
    const waxGeo = new THREE.ShapeGeometry(shape, 1);
    this.wax = new THREE.Mesh(waxGeo, waxMaterial(this.surf, this.page, this.heat));
    this.wax.rotation.x = -Math.PI / 2;
    this.wax.position.y = PY + 0.02;
    this.surface(this.wax, { parent: S, cast: false });
    this.heatMesh = new THREE.Mesh(waxGeo, heatMaterial(this.surf, this.page, this.heat));
    this.heatMesh.rotation.x = -Math.PI / 2;
    this.heatMesh.position.y = PY + 0.06;
    this.heatMesh.renderOrder = 5;
    this.heatMesh.userData.glow = true;
    S.add(this.heatMesh);
    L(this.stageFine, circle(V3(0, PY + 0.05, 0), UP, PLATE.hole * DRAW, 14).pts, { closed: true, ...flat });

    // the stand: a column at the back, an arm over the stage, the boss the stylus slides in
    this.part(1.2);
    this.lathe(V3(COL.x, BASE_Y, COL.z), UP, [[0, 6.4], [2.4, 6.4], [2.4, 3.2], [3.2, 2.8]], iron, { rings: [0, 2.4] });
    this.cylinder(V3(COL.x, BASE_Y + 3.2, COL.z), V3(COL.x, ARM_Y + 14, COL.z), 2.8, metal, { rings: [ARM_Y + 14 - BASE_Y - 3.2] });
    this.lathe(V3(COL.x, ARM_Y + 14, COL.z), UP, [[0, 3.4], [1.6, 3.4], [2.2, 2.4]], metal, { rings: [0, 1.6] });
    this.part(0.5);
    this.lathe(V3(COL.x, ARM_Y - 4.5, COL.z), UP, [[0, 4.8], [9, 4.8]], metal);
    this.lathe(V3(COL.x, ARM_Y, COL.z - 4.8), V3(0, 0, -1), [[0, 1.1], [3, 1.1], [3, 2.4], [5.6, 2.4]], brass, { rings: [3, 5.6] });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      L(this.fine, [V3(COL.x + 2.4 * Math.cos(a), ARM_Y + 2.4 * Math.sin(a), COL.z - 7.8), V3(COL.x + 2.4 * Math.cos(a), ARM_Y + 2.4 * Math.sin(a), COL.z - 10.4)], flat);
    }
    this.part(0.5);
    const armA = V3(COL.x, ARM_Y, COL.z), armB = V3(CX, ARM_Y, CZ);
    const armDir = armB.clone().sub(armA).normalize();
    this.cylinder(armA.clone().addScaledVector(armDir, 4.6), armB.clone().addScaledVector(armDir, -4.4), 2.2, metal);
    this.lathe(V3(CX, ARM_Y - 4.5, CZ), UP, [[0, 4.4], [9, 4.4]], metal);

    // the stylus: rod, ceramic, the heater with its glowing coil, the collar and the hot tip
    this.heater = new THREE.Group();
    this.group.add(this.heater);
    this.heater.add(this.heaterInk.mesh, this.heaterInk.flat);
    const H = this.heater, hs = { parent: H, set: this.heaterInk, offset: this.lift };
    this.part(1);
    this.lathe(V3(CX, PY + 9, CZ), UP, [[0, 1.5], [3, 2.6], [6, 2.6]], metal, { ...hs, rings: [3, 6] });
    this.lathe(V3(CX, PY + 15, CZ), UP, [[0, 4.6], [18, 4.6]], metal, { ...hs, rings: [0, 18] });
    this.lathe(V3(CX, PY + 33, CZ), UP, [[0, 3.6], [6, 3.6]], enamel, { ...hs, rings: [0, 6] });
    for (let k = 1; k < 3; k++) this.line(this.heaterInk, circle(V3(CX, PY + 33 + k * 2, CZ), UP, 3.62, 28).pts, { closed: true, wobble: 0.05, overshoot: 0 });
    this.cylinder(V3(CX, PY + 39, CZ), V3(CX, ARM_Y + 9.8, CZ), 1.5, metal, { ...hs, rings: [ARM_Y + 9.8 - PY - 39] });
    this.lathe(V3(CX, ARM_Y + 9.8, CZ), UP, [[0, 2.6], [2.4, 2.6], [3, 1.8]], brass, { ...hs, rings: [0, 2.4] });
    // the tip: steel, with a glowing skin that brightens with its temperature
    this.part(0.4);
    this.lathe(V3(CX, PY, CZ), UP, [[0, 0.34], [9, 1.5]], metal, { ...hs, rings: [9] });
    const tipGlow = new THREE.Mesh(new THREE.ConeGeometry(1.62, 9.2, 20, 1, true), this.glow(1.5, 0.8));
    tipGlow.rotation.x = Math.PI;
    tipGlow.position.set(CX, PY + 4.6, CZ);
    tipGlow.renderOrder = 5; tipGlow.userData.glow = true;
    H.add(tipGlow);
    this.tipGlow = tipGlow;
    // the coil: seven turns round the heater body
    const coilPts = [];
    for (let i = 0; i <= 7 * 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      coilPts.push(V3(CX + 4.95 * Math.cos(a), PY + 16.6 + (i / (7 * 32)) * 14.8, CZ + 4.95 * Math.sin(a)));
    }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 7 * 40, 0.42, 6, false), this.glow(1.3, 0.9));
    coil.renderOrder = 5; coil.userData.glow = true;
    H.add(coil);
    this.coil = coil;

    // the control box: a thermostat with a set knob and a dial gauge reading the tip
    this.part(1.2);
    this.box(BOX.x0, BOX.x1, BOX.y0, BOX.y1, BOX.z0, BOX.z1, enamel, { set: this.bold });
    for (let k = 0; k < 5; k++) L(this.fine, [V3(BOX.x0 + 6 + k * 2.4, BOX.y1 + 0.02, BOX.z0 + 4), V3(BOX.x0 + 6 + k * 2.4, BOX.y1 + 0.02, BOX.z0 + 12)], { wobble: 0.04, overshoot: 0 });
    for (const [x, y] of [[BOX.x0 + 1.6, BOX.y0 + 1.6], [BOX.x1 - 1.6, BOX.y0 + 1.6], [BOX.x0 + 1.6, BOX.y1 - 1.6], [BOX.x1 - 1.6, BOX.y1 - 1.6]]) L(this.fine, circle(V3(x, y, BOX.z1 + 0.02), V3(0, 0, 1), 0.5, 10).pts, { closed: true, ...flat });
    // the gauge: bezel, a card face with its scale, the needle
    this.part(0.5);
    const FZ = BOX.z1;
    this.lathe(V3(GAUGE.x, GAUGE.y, FZ), V3(0, 0, 1), [[0, 7.2], [2.2, 7.2], [2.6, 6.5]], brass, { rings: [0, 2.2, 2.6] });
    const face = new THREE.Mesh(new THREE.CircleGeometry(6.4, 40), card);
    face.position.set(GAUGE.x, GAUGE.y, FZ + 1.6);
    this.surface(face, { cast: false });
    const dialAt = (v, range) => SWEEP - (2 * SWEEP * (v - range[0])) / (range[1] - range[0]); // angle from +y, anticlockwise
    const radial = (cx, cy, z, a, r0, r1) => [V3(cx - Math.sin(a) * r0, cy + Math.cos(a) * r0, z), V3(cx - Math.sin(a) * r1, cy + Math.cos(a) * r1, z)];
    for (let v = 0; v <= 350; v += 25) {
      const major = v % 50 === 0;
      L(major ? this.main : this.fine, radial(GAUGE.x, GAUGE.y, FZ + 1.62, dialAt(v, GAUGE_RANGE), major ? 4.3 : 4.9, 5.8), flat);
    }
    // the 62 °C mark: where the wax lets go
    L(this.fine, radial(GAUGE.x, GAUGE.y, FZ + 1.62, dialAt(WAX.Tm, GAUGE_RANGE), 3.2, 5.8), { ...flat, dash: 0.6 });
    this.needle = new THREE.Group();
    this.needle.position.set(GAUGE.x, GAUGE.y, FZ + 1.7);
    this.group.add(this.needle);
    this.needle.add(this.needleInk.mesh, this.needleInk.flat);
    this.line(this.needleInk, [V3(0, -1.2, 0), V3(0, 5.2, 0)], { wobble: 0, overshoot: 0, taper: true });
    L(this.main, circle(V3(GAUGE.x, GAUGE.y, FZ + 1.72), V3(0, 0, 1), 0.6, 10).pts, { closed: true, ...flat });
    this.dialAt = dialAt;
    // the set knob, knurled, with a scale round it on the panel
    this.part(0.5);
    this.lathe(V3(KNOB.x, KNOB.y, FZ), V3(0, 0, 1), [[0, 4.4], [3.4, 4.4], [4.0, 3.8]], metal, { rings: [0, 3.4, 4.0] });
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      L(this.fine, [V3(KNOB.x + 4.42 * Math.cos(a), KNOB.y + 4.42 * Math.sin(a), FZ + 0.4), V3(KNOB.x + 4.42 * Math.cos(a), KNOB.y + 4.42 * Math.sin(a), FZ + 3.0)], flat);
    }
    for (let v = 120; v <= 320; v += 20) {
      const major = v % 100 === 0;
      L(this.fine, radial(KNOB.x, KNOB.y, FZ + 0.02, dialAt(v, SET_RANGE), 5.2, major ? 6.8 : 6.0), flat);
    }
    this.knob = new THREE.Group();
    this.knob.position.set(KNOB.x, KNOB.y, FZ + 4.02);
    this.group.add(this.knob);
    this.knob.add(this.knobInk.mesh, this.knobInk.flat);
    this.line(this.knobInk, [V3(0, 0.6, 0), V3(0, 3.4, 0)], { wobble: 0, overshoot: 0, taper: false });
    // the pilot lamp: on while the stylus is down and drawing power
    this.part(0.3);
    this.lathe(V3(24.4, 21.9, FZ), V3(0, 0, 1), [[0, 1.6], [0.8, 1.6]], brass, { rings: [0.8] });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.glow(1.6, 0.95));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(24.4, 21.9, FZ + 0.8);
    lamp.renderOrder = 5; lamp.userData.glow = true;
    this.group.add(lamp);
    this.lamp = lamp;
    // the lead from the box along the base into the column, which carries it up to the heater
    this.part(0.6);
    const lead = new THREE.CatmullRomCurve3([V3(BOX.x0 + 8, BASE_Y + 3, BOX.z0), V3(BOX.x0 + 9, BASE_Y + 0.9, BOX.z0 - 10), V3(COL.x - 3, BASE_Y + 0.9, COL.z + 13), V3(COL.x - 0.6, BASE_Y + 1.4, COL.z + 5.8)], false, "catmullrom", 0.3);
    this.surface(new THREE.Mesh(new THREE.TubeGeometry(lead, 40, 0.9, 8, false), metal));
    this.sweep(lead.getSpacedPoints(30).map((c, i) => ({ c, t: lead.getTangentAt(i / 30), r: 0.9 })));

    // two handwritten tags on easels in front of the bench
    this.part(1);
    this.tags = {
      front: this.tag({ x0: 62, x1: 100, h: 19, z: -4, lean: 0.62, card }),
      stylus: this.tag({ x0: 104, x1: 136, h: 19, z: -4, lean: 0.62, card }),
    };

    this.finish();
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
    this.surfaces.push(plane); // tags never print, so they never hide a printed line
    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.2, h * 0.86, 0.8), card);
    const back = V3((x0 + x1) / 2, 0.3, z - h * 0.62);
    const top = V3(0, h * 0.82, -0.7).applyEuler(pivot.rotation).add(pivot.position);
    strut.position.copy(back.clone().lerp(top, 0.5));
    strut.lookAt(top);
    strut.rotateX(Math.PI / 2);
    this.surface(strut, { occlude: false });
    const toFig = (lx, ly, lz) => V3(lx, ly, lz).applyEuler(pivot.rotation).add(pivot.position);
    const hw = w / 2;
    this.line(this.tagInk, [toFig(-hw, 0, 0.26), toFig(hw, 0, 0.26), toFig(hw, h, 0.26), toFig(-hw, h, 0.26)], { closed: true, width: 1.05 });
    this.line(this.tagFine, [toFig(-hw + 1.2, 1.2, 0.27), toFig(hw - 1.2, 1.2, 0.27), toFig(hw - 1.2, h - 1.2, 0.27), toFig(-hw + 1.2, h - 1.2, 0.27)], { closed: true, wobble: 0.04 });
    this.line(this.tagFine, [back, top], { wobble: 0.05 });
    return { canvas, tex, w, h, last: "" };
  }

  finish(total = 3.2) {
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
    for (const set of [this.main, this.fine, this.bold, this.tagInk, this.tagFine, this.sil]) this.group.add(set.mesh, set.flat);
  }

  silhouettes(eye) {
    const pe = printEye();
    const lines = [];
    const n = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Vector3();
    for (const s of this.sweeps) {
      const a = [], b = [];
      for (const k of s.samples) {
        c.copy(k.c);
        if (s.offset) c.add(s.offset);
        if (eye) v.copy(eye).sub(c).normalize(); else v.copy(pe);
        n.crossVectors(k.t, v);
        if (n.lengthSq() < 1e-8) n.copy(basisOf(k.t).u);
        n.normalize();
        a.push(c.clone().addScaledVector(n, k.r));
        b.push(c.clone().addScaledVector(n, -k.r));
      }
      for (const pts of [a, b]) lines.push({ points: pts, t0: s.t0, dur: s.dur, wobble: 0, overshoot: 0, taper: true, step: 1.6 });
    }
    return lines;
  }

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
    const parentOf = new Map([[this.stageInk, this.stage], [this.stageFine, this.stage], [this.heaterInk, this.heater], [this.needleInk, this.needle], [this.knobInk, this.knob]]);
    for (const set of this.sets) {
      const parent = parentOf.get(set) || this.group;
      for (const line of set.lines) line.vis = line.pts.map((p) => test(p, parent));
      set._write(set.geometry, set.lines);
    }
    for (const line of this.sil.flatLines) line.vis = line.pts.map((p) => test(p, this.group));
    this.sil.rewriteFlat();
    this.occluders.forEach((m, i) => setSide(m, sides[i]));
  }

  updateSilhouettes(camera) {
    const eye = this.group.worldToLocal(camera.position.clone());
    this.sil.setLines(this.silhouettes(eye));
  }

  // the field into the texture: half floats, rise above ambient in K
  upload() {
    const { T } = this.model, N = this.model.N, out = this.heatData, near = this.nearest;
    for (let c = 0; c < N * N; c++) out[c] = THREE.DataUtils.toHalfFloat(T[near[c]]);
    this.heatTex.needsUpdate = true;
  }

  update({ theta, lift, tip, set, power, on }) {
    this.stage.rotation.y = theta;
    this.lift.set(0, lift * LIFT_MM, 0);
    this.heater.position.y = lift * LIFT_MM;
    this.needle.rotation.z = this.dialAt(Math.min(GAUGE_RANGE[1], Math.max(GAUGE_RANGE[0], tip)), GAUGE_RANGE);
    this.knob.rotation.z = this.dialAt(set, SET_RANGE);
    // the coil and tip glow with the tip's temperature; the lamp shows the stylus drawing power
    const hot = Math.min(1, Math.max(0, (tip - 60) / 220));
    this.coil.material.uniforms.uOn.value = 0.03 + 0.97 * hot;
    this.tipGlow.material.uniforms.uOn.value = hot * 0.9;
    const lampTo = on && power > 0.02 ? 1 : 0.08;
    const lu = this.lamp.material.uniforms.uOn;
    lu.value += (lampTo - lu.value) * 0.2;
    this.upload();
  }
}

function rAt(profile, s) {
  for (let i = 1; i < profile.length; i++) {
    const [s0, r0] = profile[i - 1], [s1, r1] = profile[i];
    if (s <= s1 + 1e-9) return r0 + (r1 - r0) * ((s - s0) / Math.max(1e-9, s1 - s0));
  }
  return profile[profile.length - 1][1];
}
