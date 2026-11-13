import * as THREE from "three";
import { Figure, HEAT, GAS, V3, UP, circle, ring, hArc, smooth } from "../figure.js?v=f251d2ad";
import { InkSet, inkMaterial } from "../ink.js?v=f251d2ad";
import { glassMaterial } from "../paper.js?v=f251d2ad";
import { LIFT_GLSL } from "../lift.js?v=f251d2ad";
import { sectionUniforms, sectionMaterials } from "../section.js?v=f251d2ad";
import { linesOf, cohesiveOf, journeyPath, journeyAt, DIP, FURNACES, hearthLevel, STOPS } from "../model.js?v=f251d2ad";
import { Flow } from "../flow.js?v=f251d2ad";

// The blast furnace complex, drawn at 6 mm to the metre: BF-3 with its published volumes (useful
// 1,400 m³, working 1,204 m³), its bell-less top, its twin tapholes and rocking runners (PIB 2002),
// three hot blast stoves (one cut open), the gas train (uptakes, downcomer, dust catcher, scrubber,
// clean gas main back to the stoves), the cast house, two torpedo tracks and slag granulation.
// The furnace itself can be cut along its axis; the cut face is drawn by section.js from the model.

export const S = 6; // figure mm per metre
export const FX = 300, FZ = -92; // the furnace axis in figure space
export const Y0 = 57.6; // the taphole, 9.6 m above the ground
const FLOOR = 54; // cast house floor, 9 m
const SHELL = 0.14, SUMP = 1.6, PAD = 3.4;
const BF = FURNACES[1];

function linerAt(y, L) { return y < L.yT ? 1.15 : y < L.yBosh ? 0.75 : y < L.yStack ? 0.78 : 0.5; }
function rinAt(y, L) {
  if (y <= L.yT) return L.rH;
  if (y <= L.yBosh) return L.rH + (L.rB - L.rH) * ((y - L.yT) / L.hBosh);
  if (y <= L.yBelly) return L.rB;
  if (y <= L.yStack) return L.rB + (L.rT - L.rB) * ((y - L.yBelly) / L.hStack);
  if (y <= L.yStock + 2.2) return L.rT;
  return L.rT + (1.25 - L.rT) * Math.min(1, (y - L.yStock - 2.2) / 3.2);
}

// heat on a stove's checkers, a gradient up the column (top hottest); one material per stove
function checkerGlowMaterial(fig) {
  return new THREE.ShaderMaterial({
    uniforms: { ...fig.surf, ...fig.page, uColor: { value: new THREE.Color(HEAT) }, uHot: { value: new THREE.Color("#ffd27a") }, uLevel: { value: 0.6 }, uY0: { value: 0 }, uY1: { value: 200 } },
    vertexShader: /* glsl */ `
${LIFT_GLSL}
uniform float uLiftSurf;
varying float vY; varying vec2 vUv;
void main() {
  vY = position.y; vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(liftToPage(w.xyz, uLiftSurf), 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor, uHot; uniform float uLevel, uY0, uY1, uSurfAlpha;
varying float vY; varying vec2 vUv;
void main() {
  float h = clamp((vY - uY0) / (uY1 - uY0), 0.0, 1.0);
  float heat = clamp(uLevel * (0.35 + 0.75 * h), 0.0, 1.0);
  float flue = 0.55 + 0.45 * step(0.5, fract(vUv.x * 46.0));   // the checker flues, as stripes
  float a = heat * 0.55 * flue * uSurfAlpha;
  vec3 c = mix(uColor, uHot, smoothstep(0.7, 1.0, heat));
  gl_FragColor = vec4(c * a * 1.3, a);
}`,
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

export class Furnace extends Figure {
  constructor({ frame, spill }) {
    super({ frame, name: "furnace", spill, total: 3.6 });
    this.L = linesOf(BF);
    this.cz = cohesiveOf(this.L);
    this.path = journeyPath(this.L, 0.55);
    this.sil = new InkSet(this.sil.material, { capacity: 60000 });
    // the furnace's own ink and clip: the knife cuts only the furnace, never the plant round it
    this.knife = { d: 99, to: 99, on: false };
    this.fClip = { value: new THREE.Vector4(0, 0, 0, -1) };
    const fshared = { ...this.shared, uClip: this.fClip };
    this.fInkMain = inkMaterial({ shared: fshared, widthPx: 1.45, widthMm: 0.32 });
    this.fInkFine = inkMaterial({ shared: fshared, widthPx: 0.95, widthMm: 0.18, alpha: 0.88 });
    this.fInkBold = inkMaterial({ shared: fshared, widthPx: 2.0, widthMm: 0.45 });
    this.inkMats.push(this.fInkMain, this.fInkFine, this.fInkBold);
    [this.fInkMain, this.fInkFine, this.fInkBold].forEach((m) => (m.userData.basePx = m.uniforms.uWidthPx.value));
    this.fMain = new InkSet(this.fInkMain); this.fFine = new InkSet(this.fInkFine); this.fBold = new InkSet(this.fInkBold);
    this.sets.push(this.fMain, this.fFine, this.fBold);
    this.fSil = new InkSet(inkMaterial({ shared: fshared, widthPx: 1.5, widthMm: 0.32 }), { capacity: 40000 });
    this.inkMats.push(this.fSil.material); this.fSil.material.userData.basePx = 1.5;
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5);
    this.state = { hours: 0, castPhase: 0.2, stove: 0, chute: 0, blast: 1 };
    this.build();
  }

  fPaper(name, opts) {
    const m = this.paper(name, opts);
    m.clippingPlanes = [this.clipPlane];
    return m;
  }

  // ---- the build ----
  build() {
    const L = this.L;
    const yw = (y) => Y0 + y * S; // furnace height (m above the taphole) → figure mm
    const steel = this.fPaper("steel", { color: "#ece9e1", hatchA: [0.15, 1, 0.25], hatchB: [1, 0.25, -0.3], spacing: 1.3, shade: 0.2, seed: 3 });
    const steelOut = this.paper("steelOut", { color: "#ece9e1", hatchA: [0.15, 1, 0.25], hatchB: [1, 0.25, -0.3], spacing: 1.3, shade: 0.2, seed: 4 });
    const brick = this.paper("brick", { color: "#f1e9dc", hatchA: [0.62, 0.74, 0.45], spacing: 1.4, shade: 0.16, seed: 5 });
    const conc = this.paper("concrete", { color: "#f3efe6", hatchA: [0.62, 0.74, 0.45], hatchB: [-0.7, 0.4, 0.6], spacing: 1.6, shade: 0.14, seed: 7 });
    const lining = this.fPaper("lining", { color: "#f4ede2", hatchA: [1, 0.2, 0.2], spacing: 1.0, shade: 0.1, seed: 9, side: THREE.DoubleSide });
    const water = this.paper("water", { color: "#eef2f2", hatchA: [1, 0.05, 0.3], spacing: 1.1, shade: 0.06, hatch: 0.5, seed: 13 });
    this.steel = steel;
    const L2 = (set, pts, o) => this.line(set, pts, o);
    const flat = { wobble: 0, overshoot: 0, taper: false };

    // ---------- the ground and the cast house ----------
    this.part();
    this.box(FX - 122, FX + 118, FLOOR - 4, FLOOR, -172, -8, conc, { set: this.bold });
    for (const [x, z] of [[FX - 116, -166], [FX - 116, -14], [FX + 112, -166], [FX + 112, -14], [FX - 30, -14], [FX + 40, -14]]) {
      this.box(x - 3, x + 3, 0, FLOOR - 4, z - 3, z + 3, conc, { set: this.fine });
    }
    // the floor's hatch of plates, and the furnace's foundation under it
    for (let x = FX - 110; x < FX + 118; x += 20) L2(this.fine, [V3(x, FLOOR + 0.02, -170), V3(x, FLOOR + 0.02, -150)], flat);

    // ---------- the furnace shell ----------
    this.part();
    const prof = [];
    const add = (y, r) => prof.push([yw(y), r * S]);
    const top = L.yStock + 5.4;
    add(-SUMP - PAD, L.rH + 1.15 + SHELL + 0.25);
    add(L.yT - 0.02, L.rH + 1.15 + SHELL + 0.25);
    add(L.yT + 0.3, rinAt(L.yT + 0.3, L) + 0.75 + SHELL);
    for (const y of [L.yBosh, L.yBelly, L.yStack, L.yStock + 2.2]) add(y, rinAt(y, L) + linerAt(y - 0.01, L) + SHELL);
    add(top, 1.25 + 0.5 + SHELL);
    this.profile = prof;
    // the shell as a lathe about the axis; its rings at the zone lines, its stave rows on the stack
    const axisO = V3(FX, 0, FZ);
    const shell = this.lathe(axisO, UP, prof, steel, { rings: [], sil: false, segments: 72 });
    this.shellMesh = shell;
    this.fSweep(prof.map(([y, r]) => ({ c: V3(FX, y, FZ), t: UP.clone(), r })));
    const ringY = [yw(-SUMP - PAD), yw(L.yT), yw(L.yBosh), yw(L.yBelly), yw(L.yStack), yw(L.yStock + 2.2), yw(top)];
    for (const y of ringY) {
      const r = rOf(prof, y);
      this.line(this.fMain, circle(V3(FX, y, FZ), UP, r, 96).pts, { closed: true, wobble: 0.06, overshoot: 0 });
    }
    this.part(0.5);
    for (let y = L.yBelly + 1.6; y < L.yStack - 0.5; y += 1.6) {
      const r = rOf(prof, yw(y)) + 0.05;
      this.line(this.fFine, circle(V3(FX, yw(y), FZ), UP, r, 96).pts, { closed: true, wobble: 0.04, overshoot: 0 });
    }
    // the hearth jacket's cooling rings
    for (let y = -SUMP - PAD + 0.9; y < L.yT - 0.3; y += 0.9) {
      const r = rOf(prof, yw(y)) + 0.05;
      this.line(this.fFine, circle(V3(FX, yw(y), FZ), UP, r, 96).pts, { closed: true, wobble: 0.04, overshoot: 0 });
    }
    // a platform round the furnace at the belly and one at the throat
    this.part(0.5);
    for (const [y, w] of [[L.yBelly + 0.2, 1.6], [L.yStock + 0.5, 1.4]]) {
      const r0 = rOf(prof, yw(y)), r1 = r0 + w * S;
      const plat = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72, 1), this.fPaper("plate", { color: "#eeebe4", hatchA: [1, 0.1, 0.3], spacing: 1.2, shade: 0.1, seed: 15, side: THREE.DoubleSide }));
      plat.rotation.x = -Math.PI / 2; plat.position.set(FX, yw(y), FZ);
      this.surface(plat);
      this.line(this.fFine, circle(V3(FX, yw(y), FZ), UP, r1, 96).pts, { closed: true, wobble: 0.05, overshoot: 0 });
      this.line(this.fFine, circle(V3(FX, yw(y) + 6, FZ), UP, r1, 96).pts, { closed: true, wobble: 0.05, overshoot: 0 });
      for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; this.line(this.fFine, [ring(FX, yw(y), FZ, r1, a), ring(FX, yw(y) + 6, FZ, r1, a)], flat); }
    }

    this.lathe(V3(FX, 0, FZ), UP, [[0, rOf(prof, yw(-SUMP - PAD)) + 5], [yw(-SUMP - PAD), rOf(prof, yw(-SUMP - PAD)) + 5]], conc, { rings: [0, yw(-SUMP - PAD)] });

    // ---------- tuyeres, blowpipes and the bustle pipe ----------
    this.part();
    const bustleY = yw(L.yT + 3.9), bustleR = (L.rH + 1.15 + SHELL + 0.25 + 2.6) * S, bustleT = 0.85 * S;
    this.bustle = { y: bustleY, R: bustleR };
    const glassU = glassMaterial(this.surf, this.page, { tint: "#e2ebef", base: 0.07, edge: 0.4 });
    glassU.clippingPlanes = [this.clipPlane];
    this.glassMats = [glassU];
    const torus = new THREE.Mesh(new THREE.TorusGeometry(bustleR, bustleT, 12, 96), glassU);
    torus.rotation.x = Math.PI / 2; torus.position.set(FX, bustleY, FZ); torus.renderOrder = 6;
    this.group.add(torus); this.surfaces.push(torus);
    for (const off of [-bustleT, bustleT]) this.line(this.fMain, circle(V3(FX, bustleY, FZ), UP, bustleR + off, 120).pts, { closed: true, wobble: 0.05, overshoot: 0 });
    this.line(this.fFine, circle(V3(FX, bustleY + bustleT, FZ), UP, bustleR, 120).pts, { closed: true, wobble: 0.05, overshoot: 0 });
    this.tuyeres = [];
    const NT = 16;
    const rNose = L.rH * S, rWall = (L.rH + 1.15 + SHELL + 0.25) * S;
    for (let k = 0; k < NT; k++) {
      const a = (k / NT) * Math.PI * 2 + Math.PI / NT;
      const p0 = ring(FX, bustleY - bustleT * 0.6, FZ, bustleR, a);
      const p1 = ring(FX, bustleY - 9, FZ, bustleR - 2, a);
      const p2 = ring(FX, yw(L.yT) + 2.5, FZ, rWall + 7, a);
      const p3 = ring(FX, yw(L.yT), FZ, rWall + 1, a);
      this.fPipe([p0, p1, p2, p3], 0.9, steel);
      this.tuyeres.push({ a, nose: ring(FX, yw(L.yT), FZ, rNose, a), wall: p3 });
    }
    // the hot blast main from the stoves to the bustle pipe (glass, so the blast shows)
    this.part();
    const bAng = (3 * Math.PI) / 4;
    const bIn = ring(FX, bustleY, FZ, bustleR + bustleT * 0.2, bAng);
    const hbY = 80;

    // ---------- the top: cone, bell-less charging top with its rotating chute, uptakes ----------
    this.part();
    const topY = yw(top);
    this.fCyl(V3(FX, topY, FZ), V3(FX, topY + 4.5 * S, FZ), 1.9 * S, steel);
    this.fCyl(V3(FX, topY + 4.5 * S, FZ), V3(FX, topY + 6.0 * S, FZ), 2.6 * S, steel);
    // the two top hoppers that feed the chute in turn, and the receiving hopper above them
    for (const dx of [-2.2, 2.2]) {
      this.fLathe(V3(FX + dx * S, topY + 6.0 * S, FZ), UP, [[0, 0.6 * S], [1.6 * S, 1.7 * S], [5.2 * S, 1.7 * S]], steel, { rings: [0, 1.6 * S, 5.2 * S] });
    }
    this.fLathe(V3(FX, topY + 11.2 * S, FZ), UP, [[0, 0.8 * S], [1.8 * S, 2.6 * S], [3.2 * S, 2.6 * S]], steel, { rings: [0, 1.8 * S, 3.2 * S] });
    this.topEquipY = topY + 14.4 * S;
    // four uptakes from the cone, joined over the top into the downcomer
    this.part();
    const upY0 = yw(L.yStock + 3.6), upTop = topY + 10 * S;
    const ups = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    const jY = upTop + 2 * S;
    const joint = V3(FX, jY, FZ - 9 * S);
    for (const a of ups) {
      const p0 = ring(FX, upY0, FZ, 2.6 * S, a), p1 = ring(FX, upY0 + 6 * S, FZ, 3.6 * S, a);
      const p2 = ring(FX, upTop, FZ, 3.3 * S, a);
      const p3 = V3(FX + (p2.x - FX) * 0.4, jY, (p2.z + joint.z) / 2);
      this.fPipe([p0, p1, p2, p3], 0.75 * S, steel, { tension: 0.4 });
    }
    // bleeder valves on the joint
    for (const dx of [-8, 8]) this.cylinder(V3(FX + dx, jY, FZ - 9 * S), V3(FX + dx, jY + 22, FZ - 9 * S), 2.2, steelOut, { rings: [0, 22] });

    // ---------- the gas train: downcomer, dust catcher, scrubber, clean gas main ----------
    this.part();
    const DC = { x: FX + 150, z: -218, r: 28, y0: 60, y1: 168 };
    const glass = glassMaterial(this.surf, this.page, { tint: "#e2ebef", base: 0.07, edge: 0.4 });
    this.glassMats.push(glass);
    const downPts = [joint.clone(), V3(FX + 40, jY - 10, -170), V3(DC.x - 8, DC.y1 + 32, DC.z + 8), V3(DC.x, DC.y1 + 10, DC.z)];
    this.glassPipe(downPts, 0.95 * S, glass);
    this.part(0.5);
    this.lathe(V3(DC.x, DC.y0, DC.z), UP, [[-28, 6], [0, DC.r], [DC.y1 - DC.y0, DC.r], [DC.y1 - DC.y0 + 16, 10]], steelOut, { rings: [0, DC.y1 - DC.y0, DC.y1 - DC.y0 + 16] });
    for (const [dx, dz] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) this.box(DC.x + dx - 2, DC.x + dx + 2, 0, DC.y0 + 4, DC.z + dz - 2, DC.z + dz + 2, steelOut, { set: this.fine });
    this.part(0.5);
    const SC = { x: FX + 232, z: -196, r: 15, y1: 176 };
    this.cylinder(V3(SC.x, 0, SC.z), V3(SC.x, SC.y1, SC.z), SC.r, steelOut, { rings: [0, 40, 120, SC.y1] });
    this.lathe(V3(SC.x, SC.y1, SC.z), UP, [[0, SC.r], [10, 6]], steelOut, { rings: [10] });
    this.glassPipe([V3(DC.x, DC.y0 + 30, DC.z + DC.r - 4), V3(DC.x + 40, 70, -210), V3(SC.x - 10, 60, SC.z)], 0.9 * S, glass);
    // the clean gas main: from the scrubber along the back of the plant to the stoves' burners
    this.part(0.5);
    const gmY = 186;
    const STOVES = [{ x: 40, z: -150 }, { x: 92, z: -150 }, { x: 144, z: -150 }];
    this.stovesAt = STOVES;
    const gasMain = [V3(SC.x, SC.y1 + 10, SC.z), V3(SC.x, gmY + 18, SC.z - 30), V3(SC.x - 60, gmY, -250), V3(140, gmY, -250), V3(12, gmY, -250), V3(8, gmY - 40, -200), V3(8, 30, -112), V3(150, 26, -112)];
    this.glassPipe(gasMain, 0.8 * S, glass, { tension: 0.25 });

    // ---------- the stoves: three, one cut open to its checkers ----------
    this.part();
    const ST = { r: 22, h: 204 };
    this.stoveGlow = [];
    STOVES.forEach((p, i) => {
      const cut = i === 2;
      const prof2 = [[0, ST.r], [ST.h, ST.r]];
      const phi0 = cut ? 0 : 0, phiLen = cut ? Math.PI * 1.5 : Math.PI * 2;
      // phi 0..1.5π leaves the quarter facing front-right open
      this.lathe(V3(p.x, 0, p.z), UP, prof2, steelOut, { rings: cut ? [] : [0, 60, 140, ST.h], sil: !cut, phi0: cut ? Math.PI / 2 : phi0, phiLen, segments: 60 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(ST.r, 40, 16, cut ? Math.PI : 0, phiLen, 0, Math.PI / 2), steelOut);
      dome.position.set(p.x, ST.h, p.z);
      this.surface(dome);
      if (!cut) this.sweep([{ c: V3(p.x, 0, p.z), t: UP.clone(), r: ST.r }, { c: V3(p.x, ST.h, p.z), t: UP.clone(), r: ST.r }]);
      for (let k = 1; k <= 6; k++) {
        const t = (k / 6) * (Math.PI / 2);
        const y = ST.h + ST.r * Math.sin(t), r = ST.r * Math.cos(t);
        if (cut) this.line(this.main, hArc(p.x, y, p.z, r, 0, Math.PI * 1.5, 60), { wobble: 0.05, overshoot: 0 });
        else if (k % 2 === 0) this.line(this.fine, circle(V3(p.x, y, p.z), UP, r, 48).pts, { closed: true, wobble: 0.05, overshoot: 0 });
      }
      if (cut) {
        // the open quarter: outer arc rings, the two cut edges, the checker column and the
        // combustion chamber beside it; the checkers glow with their stored heat
        for (const y of [0, 60, 140, ST.h]) this.line(this.main, hArc(p.x, y, p.z, ST.r, 0, Math.PI * 1.5, 60), { wobble: 0.05, overshoot: 0 });
        for (const a of [0, Math.PI * 1.5]) {
          const o = ring(p.x, 0, p.z, ST.r, a);
          this.line(this.main, [o, V3(o.x, ST.h, o.z)], { wobble: 0.08 });
          this.line(this.main, [V3(p.x, 0, p.z), o], { wobble: 0.05 });
          this.line(this.fine, [V3(p.x, ST.h, p.z), V3(o.x, ST.h, o.z)], { wobble: 0.05 });
        }
        this.line(this.main, [V3(p.x, 0, p.z), V3(p.x, ST.h, p.z)], { wobble: 0.08 });
        this.sweep([{ c: V3(p.x, 0, p.z), t: UP.clone(), r: ST.r }, { c: V3(p.x, ST.h, p.z), t: UP.clone(), r: ST.r }]);
        // checker column: a lathe of lining with a glow skin on its cut faces
        const ck = new THREE.Mesh(new THREE.CylinderGeometry(ST.r - 2.5, ST.r - 2.5, ST.h - 26, 40, 1, true, Math.PI / 2, Math.PI * 1.5), brick);
        ck.position.set(p.x, 13 + (ST.h - 26) / 2, p.z); this.surface(ck);
        const faces = new THREE.Group();
        for (const [dir, n] of [[V3(1, 0, 0), V3(0, 0, 1)], [V3(0, 0, 1), V3(1, 0, 0)]]) {
          const g = new THREE.PlaneGeometry(ST.r - 2.5, ST.h - 26, 1, 1);
          const m = new THREE.Mesh(g, this.paper("checker", { color: "#f2e8da", hatchA: [1, 0, 0], spacing: 0.9, shade: 0.05, hatch: 0.9, seed: 19, side: THREE.DoubleSide }));
          m.position.set(p.x + dir.x * (ST.r - 2.5) / 2, 13 + (ST.h - 26) / 2, p.z + dir.z * (ST.r - 2.5) / 2);
          m.lookAt(m.position.clone().add(n));
          this.surface(m);
          const gm = new THREE.Mesh(g, checkerGlowMaterial(this));
          gm.position.copy(m.position).addScaledVector(n, 0.15); gm.quaternion.copy(m.quaternion);
          gm.material.uniforms.uY0.value = -(ST.h - 26) / 2; gm.material.uniforms.uY1.value = (ST.h - 26) / 2;
          gm.userData.glow = true; gm.renderOrder = 5;
          faces.add(gm);
          this.glowMats.push(gm.material);
          this.stoveGlow.push(gm.material);
        }
        this.group.add(faces);
        // the combustion chamber: a shaft at the back of the stove where the gas burns
        this.cylinder(V3(p.x - 6, 6, p.z - 10), V3(p.x - 6, ST.h - 10, p.z - 10), 7, brick, { rings: [0, ST.h - 16] });
        this.flame = this.glowMesh(new THREE.CylinderGeometry(4.5, 3, 40, 20, 1, true), HEAT, { gain: 1.4, alpha: 0.85 });
        this.flame.position.set(p.x - 6, 32, p.z - 10);
      }
      // the burner and the hot blast outlet on each stove
      this.cylinder(V3(p.x, 26, p.z + ST.r - 1), V3(p.x, 26, p.z + ST.r + 9), 4, steelOut, { rings: [10] });
      this.cylinder(V3(p.x, hbY, p.z + ST.r - 1), V3(p.x, hbY, -120), 3.4, steelOut, { rings: [] });
    });
    this.part(0.5);
    const hbMain = [V3(40, hbY, -120), V3(144, hbY, -120), V3(FX - 70, hbY + 6, -120), V3(bIn.x - 12, bustleY + 6, bIn.z - 10), bIn];
    this.glassPipe(hbMain, 1.0 * S, glass);
    this.hbPath = hbMain;
    this.gasMain = gasMain;
    this.downPts = downPts;
    this.dcToScrub = [V3(DC.x, DC.y0 + 30, DC.z + DC.r - 4), V3(DC.x + 40, 70, -210), V3(SC.x - 10, 60, SC.z)];

    // ---------- charging incline from the stock house behind ----------
    this.part();
    const iA = V3(FX, 0, -252), iB = V3(FX, this.topEquipY - 4, FZ - 6);
    const dir = iB.clone().sub(iA);
    const len = dir.length(); dir.normalize();
    const side = V3(1, 0, 0);
    for (const o of [-6, 6]) {
      const a = iA.clone().addScaledVector(side, o), b = iB.clone().addScaledVector(side, o);
      this.cylinder(a, b, 1.1, steelOut, { rings: [] });
    }
    const nT = Math.round(len / 14);
    for (let k = 0; k <= nT; k++) {
      const c = iA.clone().addScaledVector(dir, (k / nT) * len);
      this.line(this.fine, [c.clone().addScaledVector(side, -6), c.clone().addScaledVector(side, 6)], flat);
      if (k < nT) {
        const n = iA.clone().addScaledVector(dir, ((k + 1) / nT) * len);
        this.line(this.fine, [c.clone().addScaledVector(side, -6), n.clone().addScaledVector(side, 6)], flat);
      }
    }
    // the skip car on the incline (moves with the charging clock)
    this.skip = this.mover("skip");
    this.box(-5, 5, -3, 4, -6, 6, steelOut, { set: this.skip.userData.ink.main, parent: this.skip });
    this.incline = { a: iA, b: iB, dir, len };
    // the stock house it climbs from
    this.box(FX - 28, FX + 28, 0, 26, -266, -240, conc, { set: this.main });

    // ---------- the cast house: tapholes, runners, skimmer, rocking runners, torpedoes ----------
    this.part();
    const tapX = FX + (L.rH + 1.15 + SHELL + 0.25) * S;
    this.tap = { x: tapX, y: FLOOR, z: FZ };
    const trough = (x0, x1, z0, z1, y = FLOOR) => {
      const w = 0.01;
      this.box(x0, x1, y, y + 2.6, z0, z1, brick, { set: this.main });
      void w;
    };
    trough(tapX, FX + 92, FZ - 5, FZ + 5);
    trough(FX + 92, FX + 116, FZ - 3.5, FZ + 3.5);
    // skimmer plate across the main trough
    this.box(FX + 80, FX + 82, FLOOR + 2.6, FLOOR + 9, FZ - 6, FZ + 6, steelOut, { set: this.main });
    // slag runner toward the front, to the slag rocking runner over the granulation tank
    trough(FX + 70, FX + 76, FZ + 5, -24);
    this.box(FX + 58, FX + 92, 0, 18, -26, -2, water, { set: this.main });
    for (let k = 0; k < 5; k++) this.line(this.fine, [V3(FX + 62 + k * 6.5, 18.02, -24), V3(FX + 62 + k * 6.5, 18.02, -4)], flat);
    // the iron rocking runner: tilts to pour into one of two torpedoes on parallel tracks
    this.rocker = this.mover("rocker");
    this.rocker.position.set(FX + 126, FLOOR - 1, FZ);
    this.box(-10, 10, -2, 1.5, -3, 3, brick, { set: this.rocker.userData.ink.main, parent: this.rocker });
    this.trackX = [FX + 136, FX + 168];
    for (const x of this.trackX) {
      for (const o of [-4.5, 4.5]) this.line(this.main, [V3(x + o, 0.1, -6), V3(x + o, 0.1, -176)], { wobble: 0.05, overshoot: 0 });
      for (let z = -10; z > -176; z -= 7) this.line(this.fine, [V3(x - 6.5, 0.08, z), V3(x + 6.5, 0.08, z)], flat);
    }
    // two torpedo ladles: a long refractory-lined vessel on bogies with a mouth on top
    this.torpedoes = [];
    for (const x of this.trackX) {
      const t = this.mover("torpedo");
      t.position.set(x, 0, FZ);
      const R = 11, Lt = 96;
      this.lathe(V3(0, 18, -Lt / 2), V3(0, 0, 1), [[0, 3], [14, R], [Lt - 14, R], [Lt, 3]], steelOut, { parent: t, set: t.userData.ink.main, rings: [14, Lt - 14] });
      this.cylinder(V3(0, 18 + R - 1, 0), V3(0, 18 + R + 4, 0), 3.6, steelOut, { parent: t, set: t.userData.ink.main, rings: [5] });
      for (const z of [-34, 34]) this.box(-6, 6, 1, 7, z - 9, z + 9, steelOut, { parent: t, set: t.userData.ink.fine });
      const mouth = this.glowMesh(new THREE.CircleGeometry(3.2, 20), HEAT, { gain: 1.6, alpha: 0.9, parent: t });
      mouth.rotation.x = -Math.PI / 2; mouth.position.set(0, 18 + R + 4.05, 0);
      t.userData.mouth = mouth;
      this.torpedoes.push(t);
    }
    // the second taphole on the far side, plugged while the first one casts (twin tapholes)
    this.part(0.5);
    const tap2 = FX - (L.rH + 1.15 + SHELL + 0.25) * S;
    trough(FX - 92, tap2, FZ - 5, FZ + 5);
    this.box(FX - 100, FX - 84, FLOOR, FLOOR + 10, FZ - 22, FZ - 10, steelOut, { set: this.main }); // the mud gun
    this.cylinder(V3(FX - 86, FLOOR + 6, FZ - 14), V3(tap2 - 1, FLOOR + 5, FZ - 4), 1.6, steelOut, { rings: [] });

    // ---------- liquids: the taphole stream and the runners glow while a cast runs ----------
    this.castGlow = [];
    const runGlow = (x0, x1, z0, z1, y) => {
      const g = this.glowMesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), HEAT, { gain: 1.5, alpha: 0.9 });
      g.rotation.x = -Math.PI / 2; g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      this.castGlow.push(g);
      return g;
    };
    runGlow(tapX, FX + 80, FZ - 3.6, FZ + 3.6, FLOOR + 2.7).userData.kind = "iron";
    runGlow(FX + 82, FX + 116, FZ - 2.3, FZ + 2.3, FLOOR + 2.7).userData.kind = "iron";
    runGlow(FX + 71, FX + 75, FZ + 5, -24, FLOOR + 2.7).userData.kind = "slag";
    const fall = this.glowMesh(new THREE.CylinderGeometry(1.4, 1.1, 1, 10, 1, true), HEAT, { gain: 1.6, alpha: 0.9 });
    fall.userData.kind = "pour";
    this.pour = fall;
    this.castGlow.push(fall);

    // ---------- inside: the burden top, the throat lining and the chute (seen through the cut) ----------
    this.part();
    const inner = [];
    for (let y = L.yStock - 2.5; y <= top + 0.001; y += 0.4) inner.push([yw(y), rinAt(y, L) * S]);
    const throatIn = new THREE.Mesh(new THREE.LatheGeometry(inner.map(([y, r]) => new THREE.Vector2(r, y)), 64, Math.PI / 2, Math.PI), lining);
    throatIn.position.set(FX, 0, FZ);
    this.surface(throatIn, { occlude: false, cast: false });
    this.inside = [throatIn];
    const surfPts = [];
    for (let i = 0; i <= 16; i++) { const r = (i / 16) * L.rT * 0.985; surfPts.push(new THREE.Vector2(Math.max(0.01, r * S), yw(L.yStock - DIP * (1 - r / L.rT)))); }
    const burden = new THREE.Mesh(new THREE.LatheGeometry(surfPts, 64, Math.PI / 2, Math.PI), this.fPaper("burdenTop", { color: "#efe9df", hatchA: [0.62, 0.74, 0.45], spacing: 0.9, shade: 0.16, seed: 23, side: THREE.DoubleSide }));
    burden.position.set(FX, 0, FZ);
    this.surface(burden, { occlude: false, cast: false });
    this.inside.push(burden);
    this.chute = this.mover("chute");
    this.chute.position.set(FX, yw(L.yStock + 4.4), FZ);
    const chuteMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * S, 0.45 * S, 3.2 * S, 16, 1, true, 0, Math.PI), this.fPaper("chuteSteel", { color: "#e7e3da", hatchA: [0.15, 1, 0.25], spacing: 1.1, shade: 0.2, seed: 29, side: THREE.DoubleSide }));
    chuteMesh.position.set(0, -1.6 * S, 0);
    this.chuteArm = new THREE.Group();
    this.chuteArm.add(chuteMesh);
    this.chute.add(this.chuteArm);
    this.chuteArm.rotation.z = 0.75;
    this.surfaces.push(chuteMesh);
    chuteMesh.renderOrder = 2;
    this.inside.push(chuteMesh);

    // ---------- the cut face, drawn from the model ----------
    this.secU = sectionUniforms(L, { S, FX, Y0 });
    const czU = this.cz;
    this.secU.uCzApex.value = czU.apex; this.secU.uCzRoot.value = czU.root; this.secU.uCzThick.value = czU.thick;
    this.secU.uDip.value = DIP;
    const { paperMat, glowMat } = sectionMaterials(this.secU, this.surf, this.page);
    this.secMats = { paperMat, glowMat };
    const w = (L.rB + 2.2) * 2 * S, yBot = yw(-SUMP - PAD) - 1, yTop = yw(top) + 3;
    const g = new THREE.PlaneGeometry(w, yTop - yBot, 1, 1);
    g.translate(FX, (yBot + yTop) / 2, 0);
    this.secPaper = new THREE.Mesh(g, paperMat);
    this.secGlow = new THREE.Mesh(g, glowMat);
    this.secGlow.userData.glow = true;
    this.secPaper.renderOrder = 3; this.secGlow.renderOrder = 5;
    this.group.add(this.secPaper, this.secGlow);
    this.glowMats.push(glowMat);
    // the cut edges of the shell and lining, inked on the face (shown only while cut)
    this.cutInk = new InkSet(this.inkMain);
    this.cutInk.noPrint = true;
    this.sets.push(this.cutInk);
    const edge = (sign) => {
      const out = [], inn = [];
      for (let y = -SUMP - PAD; y <= top + 0.001; y += 0.25) {
        const ri = y < 0 ? L.rH : rinAt(y, L);
        out.push(V3(FX + sign * (ri + linerAt(y, L) + SHELL) * S, yw(y), FZ + 0.6));
        if (y >= -SUMP) inn.push(V3(FX + sign * ri * S, yw(y), FZ + 0.6));
      }
      return [out, inn];
    };
    for (const sgn of [-1, 1]) for (const pts of edge(sgn)) this.line(this.cutInk, pts, { wobble: 0.05, overshoot: 0, slot: 0 });
    this.line(this.cutInk, [V3(FX - (L.rH + 1.15 + SHELL + 0.25) * S, yw(-SUMP - PAD), FZ + 0.6), V3(FX + (L.rH + 1.15 + SHELL + 0.25) * S, yw(-SUMP - PAD), FZ + 0.6)], { wobble: 0.05, slot: 0 });
    this.cutInk.mesh.renderOrder = 12;

    // ---------- your lump: a marked piece of sinter that rides the burden down ----------
    this.lump = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), this.paper("lump", { color: "#fbf3e4", hatchA: [0.62, 0.74, 0.45], spacing: 0.6, shade: 0.2, seed: 31 }));
    this.lump.renderOrder = 6;
    this.group.add(this.lump);
    this.lumpRing = this.glowMesh(new THREE.RingGeometry(2.6, 3.4, 32), HEAT, { gain: 1.6, alpha: 0.95 });

    // ---------- flows: the gas up the furnace and round the loop, the hot blast in ----------
    this.flows = new Flow({ figure: this });
    this.buildFlows();

    // ---------- tags on the cast house floor ----------
    this.part();
    this.tags = {
      lump: this.tag({ x0: FX - 118, x1: FX - 76, h: 20, z: -12, y: FLOOR + 0.3 }),
      metal: this.tag({ x0: FX - 70, x1: FX - 34, h: 20, z: -12, y: FLOOR + 0.3 }),
    };
    this.finish();
    this.setKnife(99, true);
  }

  // furnace-only helpers: their ink sits in the clipped sets
  fSweep(samples) { (this.fSweeps ||= []).push({ samples: densify(samples), slot: this.slot }); }
  fLathe(origin, axis, profile, mat, opts = {}) {
    this.lathe(origin, axis, profile, mat, { ...opts, set: this.fMain, sil: false });
    this._fLatheSil(origin, axis, profile);
  }
  _fLatheSil(origin, axis, profile) { const a = axis.clone().normalize(); this.fSweep(profile.map(([s, r]) => ({ c: origin.clone().addScaledVector(a, s), t: a.clone(), r }))); return true; }
  fCyl(p0, p1, r, mat) {
    const axis = p1.clone().sub(p0), len = axis.length();
    this.lathe(p0, axis, [[0, r], [len, r]], mat, { set: this.fMain, sil: false, rings: [0, len] });
    this._fLatheSil(p0, axis, [[0, r], [len, r]]);
  }
  fPipe(points, r, mat, { tension = 0.3 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", tension);
    const len = curve.getLength();
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(len / 3)), r, 10, false), mat);
    this.surface(mesh);
    const k = Math.max(4, Math.round(len / 2.5));
    this.fSweep(curve.getSpacedPoints(k).map((c, i) => ({ c, t: curve.getTangentAt(Math.min(1, i / k)), r })));
    return curve;
  }
  glassPipe(points, r, mat, { tension = 0.3 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", tension);
    const len = curve.getLength();
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(len / 3)), r, 14, false), mat);
    mesh.renderOrder = 6;
    this.group.add(mesh); this.surfaces.push(mesh);
    const k = Math.max(4, Math.round(len / 2.5));
    this.sweep(curve.getSpacedPoints(k).map((c, i) => ({ c, t: curve.getTangentAt(Math.min(1, i / k)), r })));
    for (const u of [0, 1]) this.line(this.main, circle(curve.getPointAt(u), curve.getTangentAt(u), r, 18).pts, { closed: true, wobble: 0.04, overshoot: 0 });
    return curve;
  }
  fSilhouettes(eye) {
    const saved = this.sweeps;
    this.sweeps = this.fSweeps || [];
    const out = this.silhouettes(eye);
    this.sweeps = saved;
    return out;
  }
  finish() {
    // schedule the furnace's sweeps with the rest
    for (const s of this.fSweeps || []) this.sweeps.push({ ...s, _f: true });
    const all = this.sweeps;
    super.finish();
    // the shared finish wrote every sweep into the figure's silhouettes: keep only the plant's there
    this.fSweeps = all.filter((s) => s._f);
    this.sweeps = all.filter((s) => !s._f);
    this.sil.setFlat(this.silhouettes(null));
    this.fSil.setFlat(this.fSilhouettes(null));
    this.extraSil.push(this.fSil);
    for (const set of [this.fMain, this.fFine, this.fBold, this.cutInk, this.fSil]) this.group.add(set.mesh, set.flat);
    this.applyPhase();
  }
  updateSilhouettes(camera) {
    super.updateSilhouettes(camera);
    const eye = this.group.worldToLocal(camera.position.clone());
    this.fSil.setLines(this.fSilhouettes(eye));
  }
  applyPhase() {
    super.applyPhase();
    if (!this.fSil) return;
    const showCopy = this.phase !== "live" && this.phase !== "shade";
    this.fSil.flat.visible = showCopy;
    this.fSil.mesh.visible = this.phase !== "print";
    const cutOn = this.knife && this.knife.d < 50 && this.phase === "live";
    if (this.secPaper) {
      this.secPaper.visible = this.secGlow.visible = cutOn;
      this.cutInk.mesh.visible = cutOn && this.knife.d < 0.05;
      for (const m of this.inside) m.visible = cutOn;
      this.lump.visible = this.lumpRing.visible = cutOn;
    }
    if (this.cutInk) this.cutInk.flat.visible = false;
  }

  buildFlows() {
    const L = this.L, F = this.flows;
    const yw = (y) => Y0 + y * S;
    // inside the furnace, on the cut face: from each raceway up through the coke, out through
    // the coke slits of the cohesive zone and up through the layers to the top
    const z = FZ + 0.8;
    this.gasInside = [];
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const f = (k + 0.5) / 5;
        const rTop = (0.08 + 0.86 * f) * L.rT;
        const rCz = (0.05 + 0.9 * f) * L.rB;
        const yCz = this.cz.lower(rCz) + this.cz.thick * 0.5;
        const pts = [
          [L.rH - 0.9, L.yT + 0.1], [L.rH - 1.6 - 1.2 * (1 - f), L.yT + 1.6], [Math.max(0.3, rCz * 0.7), yCz - 1.6], [rCz, yCz],
          [Math.min(rCz * 1.04 + 0.4, L.rB - 0.3), yCz + 1.6], [rTop * 1.02, L.yBelly + L.hStack * 0.7], [rTop, L.yStock - DIP * (1 - rTop / L.rT) - 0.1],
        ].map(([r, y]) => V3(FX + sgn * r * S, yw(y), z));
        // the gas leaves the raceway near white hot and full of CO, and comes out at the top cool and
        // dull with CO₂: the beads change on the way up (the gas colour stays the gas colour)
        this.gasInside.push(F.add(pts, { color: GAS, count: 5, speed: 22, size: 2.3, group: "inside", grad: ["#effdff", GAS, "#6f9ea8"], shrink: 0.6 }));
      }
    }
    // round the loop: uptakes to downcomer to dust catcher to scrubber to the stoves
    F.add(this.downPts, { color: GAS, count: 14, speed: 30, size: 3.6, group: "loop" });
    F.add(this.dcToScrub, { color: GAS, count: 7, speed: 26, size: 3.4, group: "loop" });
    F.add(this.gasMain, { color: GAS, count: 30, speed: 34, size: 3.4, group: "loop" });
    // the hot blast: from the stove on blast along the main into the bustle pipe and round it
    F.add(this.hbPath, { color: HEAT, count: 22, speed: 34, size: 3.8, group: "blast" });
    const bus = [];
    for (let i = 0; i <= 64; i++) bus.push(ring(FX, this.bustle.y, FZ, this.bustle.R, (3 * Math.PI) / 4 + (i / 64) * Math.PI * 2));
    F.add(bus, { color: HEAT, count: 26, speed: 30, size: 3.4, group: "blast", clip: true });
  }

  // the handwritten tags on the cast house floor
  drawTags(ctx) {
    const J = this.journey;
    if (!J || this.phase !== "live") return;
    const fmt = ctx.fmt;
    drawTag(this.tags.lump, { title: "Your lump", big: `${fmt(J.T)} °C`, color: J.T > 1000 ? "#c4520c" : "#1c2433", note: `${J.hours.toFixed(1)} h in · ${J.zone.toLowerCase()}` });
    drawTag(this.tags.metal, { title: "BF-3 makes", big: `${fmt(1.82 * 1204)} t`, note: "hot metal a day · 1.82 × 1,204" });
  }

  setKnife(d, now = false) {
    this.knife.to = d;
    if (now) this.knife.d = d;
  }

  // the chemistry lens on the cut face: mode "ride" (plain), "react" (a reaction stop lit, its specks
  // on) or "heat" (isotherms strong); stop is an index into STOPS or -1
  setChem(mode, stop = -1) {
    const u = this.secU;
    this.chem = { mode, stop, to: mode === "ride" ? 0 : 1, iso: mode === "heat" ? 1 : 0 };
    const s = STOPS[stop];
    if (mode === "react" && s) {
      const mask = s.regs.reduce((m, r) => m + 2 ** (r - 5), 0);
      u.uFocus.value.set(s.band[0], s.band[1], mask, u.uFocus.value.w);
      u.uFocusGas.value = s.gas ? 1 : 0;
      this.chem.focus = 1;
    } else this.chem.focus = 0;
  }

  // ---- every frame ----
  update(dt, { hours, castPhase, stovePhase, live, still, clockHours }) {
    const L = this.L;
    const k = this.knife;
    k.d += (k.to - k.d) * (still ? 1 : 1 - Math.exp(-dt * 2.2));
    if (Math.abs(k.d - k.to) < 0.01) k.d = k.to;
    const cut = k.d < 50 && this.phase === "live";
    const zc = FZ + Math.min(k.d, 40) * S;
    // world-space plane: discard the front, z > zc
    const zWorld = this.frame.elements[14] + zc;
    this.clipPlane.constant = cut ? zWorld : 1e5;
    this.fClip.value.set(0, 0, cut ? 1 : 0, cut ? -zWorld : -1);
    this.secU.uD.value = Math.max(0, Math.min(k.d, 40));
    this.secPaper.position.z = this.secGlow.position.z = zc;
    this.applyPhase();
    // burden layers move with the same volume flow as the lump
    const J = journeyAt(L, this.path, hours);
    const vol = J.solid * this.path.total;
    this.secU.uLayer.value = vol / (Math.PI * L.rT * L.rT * this.secU.uPair.value) - this.secU.uOre.value / 2;
    this.secU.uTime.value += dt;
    // the chemistry lens eases in and out
    const ch = this.chem || { to: 0, iso: 0, focus: 0 };
    const ease = still ? 1 : 1 - Math.exp(-dt * 4);
    this.secU.uChem.value += (ch.to - this.secU.uChem.value) * ease;
    this.secU.uIsoBoost.value += (ch.iso - this.secU.uIsoBoost.value) * ease;
    this.secU.uFocus.value.w += (ch.focus - this.secU.uFocus.value.w) * ease;
    const lev = hearthLevel(castPhase);
    this.secU.uIron.value = -SUMP + (L.yT - 0.6 + SUMP) * lev * 0.55;
    this.secU.uSlag.value = this.secU.uIron.value + 0.5 + 0.9 * lev;
    // the lump: on the left half of the cut face
    const lp = V3(FX - J.r * S, Y0 + J.y * S, zc + 1.6);
    this.lump.position.copy(lp);
    this.lumpRing.position.copy(lp).add(V3(0, 0, 0.2));
    this.lumpRing.material.uniforms.uOn.value = 0.35 + 0.5 * Math.min(1, Math.max(0, (J.T - 400) / 1100));
    this.journey = J;
    // the chute turns and steps its tilt ring by ring (bell-less top)
    this.state.chute += dt * 1.4;
    this.chute.rotation.y = this.state.chute;
    this.chuteArm.rotation.z = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(this.state.chute * 0.23));
    // the skip climbs and drops in a cycle
    const sk = 0.5 - 0.5 * Math.cos((clockHours * 6) % (Math.PI * 2));
    const I = this.incline;
    this.skip.position.copy(I.a.clone().addScaledVector(I.dir, 8 + sk * (I.len - 18)));
    this.skip.lookAt(this.skip.position.clone().add(I.dir));
    // the cast: the taphole runs during the last part of the cycle; the rocker tips to one torpedo
    const casting = castPhase % 1 > 0.7;
    const castK = casting ? smooth(((castPhase % 1) - 0.7) / 0.03) * (1 - smooth(((castPhase % 1) - 0.98) / 0.02)) : 0;
    const which = Math.floor(castPhase) % 2;
    this.rocker.rotation.z = (which ? -1 : 1) * 0.22 * castK;
    for (const g of this.castGlow) g.material.uniforms.uOn.value = castK * (g.userData.kind === "slag" ? (((castPhase % 1) - 0.74) > 0 ? 0.9 : 0) : 1);
    const tx = this.trackX[which];
    this.pour.position.set(FX + 126 + (tx - FX - 126) * 0.65, (FLOOR + 30) / 2, FZ);
    this.pour.scale.set(1, FLOOR - 32, 1);
    this.pour.rotation.z = which ? -0.35 : 0.35;
    this.torpedoes.forEach((t, i) => {
      const fill = i === which ? castK : 0;
      t.userData.mouth.material.uniforms.uOn.value = Math.max(0.12 * (i === which ? 1 : 0.4), fill);
    });
    // the stoves: one on blast (cooling), two on gas (heating); the cut stove's checkers show it
    const ph = stovePhase % 3;
    const onBlast = Math.floor(ph);
    const sp = ph - onBlast;
    const cutState = onBlast === 2 ? "blast" : "gas";
    const level = cutState === "blast" ? 0.95 - 0.5 * sp : 0.45 + 0.5 * ((ph + (onBlast < 2 ? 0 : 0)) / 2);
    this.stoveState = { onBlast, cutState, level: Math.min(1, Math.max(0.3, level)) };
    for (const m of this.stoveGlow) m.uniforms.uLevel.value = this.stoveState.level;
    if (this.flame) this.flame.material.uniforms.uOn.value = cutState === "gas" ? 0.75 + 0.2 * Math.sin(this.secU.uTime.value * 9) : 0.04;
    // flows
    const gasOn = live ? 1 : 0;
    this.flows.update(dt, { inside: cut ? gasOn : 0, loop: gasOn, blast: gasOn }, this.surfA, cut ? zc : 1e9);
  }
}

const SERIF = '"Source Serif 4", Georgia, serif', HAND = '"Caveat", cursive';
function drawTag(tag, lines) {
  const key = JSON.stringify(lines);
  if (tag.last === key) return;
  tag.last = key;
  const c = tag.canvas, g = c.getContext("2d"), s = c.width / tag.w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, c.width, c.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  g.textBaseline = "alphabetic";
  g.font = `600 2.6px ${SERIF}`; g.fillStyle = "#1c2433";
  g.fillText(lines.title, 2.8, 4.6);
  g.font = `600 ${lines.size || 8.2}px ${HAND}`; g.fillStyle = lines.color || "#1c2433";
  g.fillText(lines.big, 2.8, 13.4);
  g.font = `italic 400 2.3px ${SERIF}`; g.fillStyle = "#4c5466";
  g.fillText(lines.note, 2.8, tag.h - 2.6);
  tag.tex.needsUpdate = true;
}

function rOf(prof, y) {
  for (let i = 1; i < prof.length; i++) {
    const [y0, r0] = prof[i - 1], [y1, r1] = prof[i];
    if (y <= y1 + 1e-9) return r0 + (r1 - r0) * ((y - y0) / Math.max(1e-9, y1 - y0));
  }
  return prof[prof.length - 1][1];
}
function densify(samples) {
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
  return fine;
}
