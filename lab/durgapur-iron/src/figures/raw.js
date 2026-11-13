import * as THREE from "three";
import { Figure, V3, UP } from "../figure.js?v=f9d0af7e";
import { LIFT_GLSL } from "../lift.js?v=f9d0af7e";
import { drawTag } from "./coke.js?v=f9d0af7e";

// The raw materials handling plant, shortened: a wagon tippler over its pit and hopper, a
// conveyor to a stacker on rails, a blending bed built in chevron layers, and a bridge reclaimer
// that cuts across the bed's end. The bed's end face shows its layers, drawn from one number:
// how many passes the stacker has made. Each pass lays a thin layer over the whole pile, so any
// slice the reclaimer cuts holds a little of every layer, and the chemistry evens out.

const BED = { x0: 72, x1: 214, w: 52, h: 22, z: -40 };
const MAXL = 40;

const END_VERT = /* glsl */ `
${LIFT_GLSL}
uniform float uLiftSurf;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(liftToPage(w.xyz, uLiftSurf), 1.0);
}`;
const END_FRAG = /* glsl */ `
uniform float uN, uMax, uW, uH, uSurfAlpha;
uniform vec3 uInk;
varying vec2 vP; // z across the bed (from its centre line), y up, in mm
float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  // the bed drawn complete; uN is how many passes built it, so each layer is 1/uN of its section
  float hw = uW * 0.5, h = uH;
  float lam = abs(vP.x) / max(0.01, hw) + vP.y / max(0.01, h);
  if (lam > 1.0 || vP.y < 0.0) discard;
  // layer k holds the points between the k-1 th and k th nested triangle: area grows by one layer each
  float k = ceil(uN * lam * lam);
  float lot = hash11(k);                           // each layer from a different lot of ore
  float c = uN * lam * lam;
  float fw = max(fwidth(c), 1e-4);
  float d = abs(fract(c + 0.5) - 0.5);
  float line = 1.0 - smoothstep(0.08 - fw, 0.08 + fw, d);
  float tone = 0.08 + 0.22 * lot;
  vec3 base = mix(vec3(0.98, 0.96, 0.92), vec3(0.83, 0.78, 0.72), tone);
  float ink = max(line * 0.75, 0.0);
  ink = max(ink, step(0.985, fract((vP.x + vP.y) * 1.3 + lot * 7.0)) * 0.4 * lot);
  vec3 col = mix(base, uInk, ink);
  gl_FragColor = vec4(col, uSurfAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Raw extends Figure {
  constructor({ frame, spill }) {
    super({ frame, name: "raw", spill, total: 3.0 });
    this.layers = 14; this.auto = true; this.reclaim = null; this.tip = 0;
    this.build();
  }

  build() {
    const steel = this.paper("steel", { color: "#ece9e1", hatchA: [0.15, 1, 0.25], hatchB: [1, 0.25, -0.3], spacing: 1.0, shade: 0.2, seed: 3 });
    const conc = this.paper("conc", { color: "#f3efe6", hatchA: [0.62, 0.74, 0.45], spacing: 1.4, shade: 0.14, seed: 7 });
    const ore = this.paper("ore", { color: "#e9e1d4", hatchA: [0.9, 0.3, 0.3], hatchB: [-0.4, 0.9, 0.2], spacing: 0.7, shade: 0.24, seed: 41 });
    const flat = { wobble: 0, overshoot: 0, taper: false };

    // ---------- the wagon tippler: a ring cradle that rolls a wagon over onto its side ----------
    this.part();
    this.box(6, 58, 0, 3, -70, -14, conc, { set: this.main }); // the pit's rim
    for (const z of [-60, -24]) this.line(this.main, [V3(0, 3.05, z), V3(64, 3.05, z)], flat);
    this.cradle = this.mover("cradle");
    this.cradle.position.set(32, 16, -42);
    const ringG = new THREE.TorusGeometry(15, 1.4, 8, 40);
    for (const x of [-20, 20]) {
      const r = new THREE.Mesh(ringG, steel);
      r.position.x = x; r.rotation.y = Math.PI / 2;
      this.surface(r, { parent: this.cradle });
    }
    this.box(-22, 22, -9, 9, -8, 8, steel, { set: this.cradle.userData.ink.main, parent: this.cradle });
    for (let k = -18; k <= 18; k += 6) this.line(this.cradle.userData.ink.fine, [V3(k, -8.9, 8.02), V3(k, 8.9, 8.02)], flat);
    // the hopper under it and the conveyor up to the stacker
    this.lathe(V3(32, 0, -42), UP, [[-1, 4], [1, 14]], steel, { rings: [1], segments: 4 });
    this.part();
    const beltA = V3(32, 4, -14), beltB = V3(BED.x0 - 4, 26, BED.z + BED.w / 2 + 8);
    this.pipe([beltA, V3(48, 10, -6), beltB], 1.6, steel, { tension: 0.1 });

    // ---------- the blending bed and its chevron end ----------
    this.part();
    const prof = new THREE.Shape([new THREE.Vector2(-BED.w / 2, 0), new THREE.Vector2(BED.w / 2, 0), new THREE.Vector2(0, BED.h)]);
    this.bedMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: BED.x1 - BED.x0, bevelEnabled: false }), ore);
    this.bedMesh.rotation.y = Math.PI / 2;
    this.bedMesh.position.set(BED.x0, 0, BED.z);
    this.surface(this.bedMesh);
    for (const [a, b] of [[V3(BED.x0, 0, BED.z - BED.w / 2), V3(BED.x1, 0, BED.z - BED.w / 2)], [V3(BED.x0, 0, BED.z + BED.w / 2), V3(BED.x1, 0, BED.z + BED.w / 2)], [V3(BED.x0, BED.h, BED.z), V3(BED.x1, BED.h, BED.z)]]) this.line(this.main, [a, b], { wobble: 0.15 });
    this.line(this.main, [V3(BED.x0, 0, BED.z - BED.w / 2), V3(BED.x0, BED.h, BED.z), V3(BED.x0, 0, BED.z + BED.w / 2)], { wobble: 0.1 });
    this.line(this.main, [V3(BED.x1, 0, BED.z - BED.w / 2), V3(BED.x1, BED.h, BED.z), V3(BED.x1, 0, BED.z + BED.w / 2)], { wobble: 0.1 });
    this.endU = { ...this.surf, ...this.page, uN: { value: this.layers }, uMax: { value: MAXL }, uW: { value: BED.w }, uH: { value: BED.h }, uInk: { value: new THREE.Color("#1c2433") } };
    const tri = new THREE.ShapeGeometry(prof);
    const end = new THREE.Mesh(tri, new THREE.ShaderMaterial({ uniforms: this.endU, vertexShader: END_VERT, fragmentShader: END_FRAG, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    end.rotation.y = Math.PI / 2;
    end.position.set(BED.x1 + 0.1, 0, BED.z);
    this.surface(end, { occlude: false, cast: false });
    this.end = end;
    // the stacker on its rails along the bed, with its boom over the crest
    this.part();
    for (const z of [BED.z + BED.w / 2 + 6, BED.z + BED.w / 2 + 12]) this.line(this.main, [V3(BED.x0 - 6, 0.05, z), V3(BED.x1 + 6, 0.05, z)], flat);
    this.stacker = this.mover("stacker");
    this.stacker.position.set(BED.x0 + 20, 0, BED.z + BED.w / 2 + 9);
    this.box(-6, 6, 0, 14, -5, 5, steel, { set: this.stacker.userData.ink.main, parent: this.stacker });
    this.cylinder(V3(0, 14, 0), V3(0, BED.h + 10, -(BED.w / 2 + 9)), 1.3, steel, { parent: this.stacker, set: this.stacker.userData.ink.main, rings: [] });
    this.stream = this.mover("stream", this.stacker);
    this.line(this.stream.userData.ink.fine, [V3(0, BED.h + 9, -(BED.w / 2 + 9)), V3(0, BED.h + 1, -(BED.w / 2 + 9))], { dash: 1.4 });
    // the bridge reclaimer at the far end: a bridge across the bed with a harrow that rakes the face
    this.part();
    this.reclaimer = this.mover("reclaimer");
    this.reclaimer.position.set(BED.x1 + 10, 0, BED.z);
    const R = this.reclaimer, ri = R.userData.ink;
    for (const z of [-BED.w / 2 - 6, BED.w / 2 + 6]) this.box(-4, 4, 0, BED.h + 6, z - 3, z + 3, steel, { set: ri.main, parent: R });
    this.box(-3, 3, BED.h + 6, BED.h + 10, -BED.w / 2 - 9, BED.w / 2 + 9, steel, { set: ri.main, parent: R });
    // the harrow: a triangle of tines matching the bed's end
    this.line(ri.main, [V3(-4.5, 0.5, -BED.w / 2), V3(-4.5, BED.h, 0), V3(-4.5, 0.5, BED.w / 2)], { wobble: 0.05 });
    for (let k = -4; k <= 4; k++) { const z = (k / 4) * BED.w * 0.45, y = BED.h * (1 - Math.abs(z) / (BED.w / 2)); this.line(ri.fine, [V3(-4.5, Math.max(1, y - 1), z), V3(-7.5, Math.max(1, y - 3), z)], flat); }
    // the reclaimed belt out to the sinter plant
    this.part();
    this.pipe([V3(BED.x1 + 6, 3, BED.z + BED.w / 2 + 2), V3(BED.x1 + 26, 6, BED.z + BED.w / 2 + 14), V3(BED.x1 + 30, 8, -2)], 1.4, steel, { tension: 0.1 });

    this.tags = { bed: this.tag({ x0: 96, x1: 136, h: 18, z: -2, y: 0.3 }) };
    this.finish();
  }

  startReclaim() { if (this.reclaim) return false; this.reclaim = { t: 0, n: Math.round(this.layers) }; return true; }

  update(dt, { live }) {
    const on = live && this.phase === "live";
    // the stacker runs end to end; each pass lays one more layer (to a full bed of 40)
    this.tTotal = (this.tTotal || 0) + (on ? dt : 0);
    const pass = 6.0; // s per pass, for the eye
    const u = (this.tTotal % (2 * pass)) / pass;
    const along = u < 1 ? u : 2 - u;
    this.stacker.position.x = BED.x0 + 8 + along * (BED.x1 - BED.x0 - 16);
    void pass;
    this.endU.uN.value = Math.max(1, this.layers);
    this.stream.visible = on && !this.reclaim;
    // the tippler rolls a wagon over every so often
    this.tip += on ? dt : 0;
    const k = (this.tip % 10) / 10;
    this.cradle.rotation.x = k < 0.6 ? -Math.sin((k / 0.6) * Math.PI) * 2.6 : 0;
    // the reclaimer rakes the end face: it comes in, rakes, the bed shortens a little
    if (this.reclaim) {
      this.reclaim.t += dt;
      const t = this.reclaim.t;
      this.reclaimer.position.x = BED.x1 + 10 - Math.sin(Math.min(1, t / 4) * Math.PI) * 6;
      if (t > 4.2) this.reclaim = null;
    }
  }

  drawTags(ctx) {
    if (this.phase !== "live") return;
    const n = Math.floor(this.layers);
    drawTag(this.tags.bed, { title: "Layers in the bed", big: `${n}`, note: "one per pass of the stacker" });
  }
}
export { BED as RAW_BED, MAXL as RAW_MAX };
