import * as THREE from "three";
import { Figure, HEAT, GAS, V3, UP, circle } from "../figure.js?v=f9d0af7e";
import { InkSet } from "../ink.js?v=f9d0af7e";
import { LIFT_GLSL } from "../lift.js?v=f9d0af7e";
import { Flow } from "../flow.js?v=f9d0af7e";
import { burnThrough } from "../model.js?v=f9d0af7e";
import { drawTag } from "./coke.js?v=f9d0af7e";

// A sinter strand, shortened, with its bed drawn three times deeper than life so the flame front
// reads: feed hopper and drum, ignition hood, the moving pallets over a row of wind boxes, the
// waste gas main to the fan and chimney, the breaker at the discharge end and a circular cooler.
// The near side wall of the bed is cut away; on it a shader draws the flame front from the model.

const ST = { x0: 22, x1: 206, top: 40, bed: 10, z0: -46, z1: -18, ign: 46 };

const FACE_VERT = /* glsl */ `
${LIFT_GLSL}
uniform float uLiftSurf;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(liftToPage(w.xyz, uLiftSurf), 1.0);
}`;
const FACE_COMMON = /* glsl */ `
uniform float uX0, uX1, uIgn, uBtp, uTop, uBed, uShift, uSurfAlpha;
varying vec2 vP;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// depth (0 top .. 1 grate) the flame front has reached at this x
float frontAt(float x) { return clamp((x - uIgn) / max(1.0, uBtp - uIgn), 0.0, 1.2); }
`;
const FACE_PAPER = /* glsl */ `
${FACE_COMMON}
uniform vec3 uInk;
float lines(float c, float w) { float fw = max(fwidth(c), 1e-4); float d = abs(fract(c + 0.5) - 0.5); return 1.0 - smoothstep(w - 0.7 * fw, w + 0.7 * fw, d); }
void main() {
  float d = (uTop - vP.y) / uBed;          // 0 at the bed's top, 1 at the grate
  if (d < 0.0 || d > 1.0) discard;
  float f = frontAt(vP.x);
  vec2 m = vec2(vP.x - uShift, vP.y);      // the bed's own coordinates: it rides along
  float ink;
  vec3 base;
  if (d < f) { // sintered: a porous cake with cracks
    ink = lines((m.x * 0.6 + m.y) / 0.9, 0.12) * 0.45 + step(0.9, hash12(floor(m * 1.6))) * 0.5;
    base = vec3(0.93, 0.91, 0.87);
  } else {     // raw mix: little balls of ore, flux, breeze
    vec2 g = fract(m * 1.4) - 0.5; float r = length(g);
    ink = (1.0 - smoothstep(0.26, 0.34, abs(r - 0.28) * 4.0)) * 0.55;
    base = vec3(0.97, 0.95, 0.91);
  }
  // the pallets' joints under the bed ride with it
  ink = max(ink, (1.0 - smoothstep(0.0, 0.25, abs(fract(m.x / 7.0) - 0.5) * 7.0)) * step(0.94, d) * 0.9);
  gl_FragColor = vec4(mix(base, uInk, ink), uSurfAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const FACE_GLOW = /* glsl */ `
${FACE_COMMON}
uniform vec3 uHeat, uHot;
void main() {
  float d = (uTop - vP.y) / uBed;
  if (d < 0.0 || d > 1.0) discard;
  float f = frontAt(vP.x);
  float band = 1.0 - smoothstep(0.0, 0.12, abs(d - f));            // the flame front, about 1,300 °C
  float behind = step(d, f) * exp(-(f - d) * 2.2) * 0.45;           // the cake cools behind it
  float ign = (1.0 - smoothstep(0.0, 6.0, abs(vP.x - uIgn - 3.0))) * (1.0 - smoothstep(0.0, 0.25, d));
  float a = max(band * step(vP.x, uX1) * step(uIgn, vP.x) * step(f, 1.0) * 0.95, max(behind * step(uIgn, vP.x), ign * 0.9));
  a *= uSurfAlpha;
  vec3 c = mix(uHeat, uHot, band);
  gl_FragColor = vec4(c * a * 1.3, a);
}`;

export class Sinter extends Figure {
  constructor({ frame, spill }) {
    super({ frame, name: "sinter", spill, total: 3.0 });
    this.speed = 1.0; this.shift = 0;
    this.build();
  }

  build() {
    const steel = this.paper("steel", { color: "#ece9e1", hatchA: [0.15, 1, 0.25], hatchB: [1, 0.25, -0.3], spacing: 1.0, shade: 0.2, seed: 3 });
    const conc = this.paper("conc", { color: "#f3efe6", hatchA: [0.62, 0.74, 0.45], spacing: 1.4, shade: 0.14, seed: 7 });
    const brick = this.paper("brick", { color: "#f1e9dc", hatchA: [0.62, 0.74, 0.45], spacing: 1.2, shade: 0.16, seed: 5 });
    const flat = { wobble: 0, overshoot: 0, taper: false };
    const { x0, x1, top, bed, z0, z1 } = ST;

    // ---------- the strand on its frame ----------
    this.part();
    for (const x of [x0 + 6, (x0 + x1) / 2, x1 - 6]) for (const z of [z0 + 2, z1 - 2]) this.box(x - 1.5, x + 1.5, 0, top - bed - 9, z - 1.5, z + 1.5, steel, { set: this.fine });
    this.box(x0, x1, top - bed - 9, top - bed - 6, z0, z1, steel, { set: this.main }); // the frame under the pallets
    // the bed: far wall and top as paper; the near wall is the cut face, drawn by the shader
    this.box(x0, x1, top - bed - 6, top - bed, z0, z1, steel, { set: this.main }); // pallets
    this.box(x0, x1, top - bed, top, z0, z0 + 2, steel, { set: this.fine }); // far side wall
    const bedTop = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0 - 2), this.paper("bedtop", { color: "#efe9df", hatchA: [1, 0.1, 0.4], spacing: 0.8, shade: 0.12, seed: 21 }));
    bedTop.rotation.x = -Math.PI / 2; bedTop.position.set((x0 + x1) / 2, top, (z0 + 2 + z1) / 2);
    this.surface(bedTop, { cast: false });
    this.line(this.main, [V3(x0, top, z1), V3(x1, top, z1)], { wobble: 0.08 });
    this.line(this.main, [V3(x0, top - bed, z1), V3(x1, top - bed, z1)], { wobble: 0.08 });
    this.faceU = {
      ...this.surf, ...this.page,
      uX0: { value: x0 }, uX1: { value: x1 }, uIgn: { value: ST.ign }, uBtp: { value: 180 }, uTop: { value: top }, uBed: { value: bed }, uShift: { value: 0 },
      uInk: { value: new THREE.Color("#1c2433") }, uHeat: { value: new THREE.Color(HEAT) }, uHot: { value: new THREE.Color("#ffd27a") },
    };
    const g = new THREE.PlaneGeometry(x1 - x0, bed, 1, 1);
    g.translate((x0 + x1) / 2, top - bed / 2, 0);
    const face = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.faceU, vertexShader: FACE_VERT, fragmentShader: FACE_PAPER, transparent: true }));
    face.position.z = z1; face.renderOrder = 3;
    this.surface(face, { occlude: false, cast: false });
    const glow = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.faceU, vertexShader: FACE_VERT, fragmentShader: FACE_GLOW, transparent: true, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    glow.position.z = z1 + 0.05; glow.userData.glow = true; glow.renderOrder = 5;
    this.group.add(glow);
    this.glowMats.push(glow.material);
    // the pallets' joints on the near side ride along (a moving ink set)
    this.joints = new InkSet(this.inkFine, { capacity: 1200 });
    this.joints.noPrint = true; // a fixed-capacity set: kept out of the shared build, added after finish

    // ---------- feed hopper, drum feeder, ignition hood ----------
    this.part();
    this.lathe(V3(x0 + 10, top + 4, (z0 + z1) / 2), UP, [[0, 5], [12, 12], [20, 12]], steel, { rings: [0, 12, 20] });
    this.cylinder(V3(x0 + 10, top + 2.4, z0), V3(x0 + 10, top + 2.4, z1), 2.4, steel, { rings: [0, z1 - z0] });
    this.box(ST.ign - 3, ST.ign + 13, top + 1, top + 12, z0 - 1, z1 + 1, brick, { set: this.main });
    this.hood = this.glowMesh(new THREE.PlaneGeometry(14, 3), HEAT, { gain: 1.6, alpha: 0.95 });
    this.hood.position.set(ST.ign + 5, top + 1.8, z1 + 1.1);

    // ---------- wind boxes, the waste gas main, fan and chimney ----------
    this.part();
    const wbN = 12, wbW = (x1 - x0 - 20) / wbN;
    for (let k = 0; k < wbN; k++) {
      const a = x0 + 8 + k * wbW;
      this.lathe(V3(a + wbW / 2, top - bed - 18, (z0 + z1) / 2), UP, [[0, 1.4], [9, 4.6]], steel, { rings: [9], segments: 16 });
    }
    const mainPts = [V3(x0 + 8, top - bed - 20, (z0 + z1) / 2), V3(x1 - 10, top - bed - 20, (z0 + z1) / 2), V3(x1 + 4, top - bed - 20, -66), V3(150, 8, -82)];
    this.pipe(mainPts, 3.2, steel, { tension: 0.2 });
    this.box(120, 150, 0, 22, -96, -70, conc, { set: this.main }); // the electrostatic precipitator
    this.lathe(V3(104, 0, -86), V3(0, 0, 1), [[-8, 7], [8, 7]], steel, { rings: [-8, 8] }); // the fan
    this.cylinder(V3(84, 0, -86), V3(84, 112, -86), 5.2, brick, { rings: [0, 50, 112] });

    // ---------- the discharge: breaker, the hot sinter falling, the circular cooler ----------
    this.part();
    this.box(x1 - 2, x1 + 12, top - bed - 22, top - 2, z0, z1, steel, { set: this.main });
    this.cooler = this.mover("cooler");
    this.cooler.position.set(x1 + 40, 0, -44);
    this.lathe(V3(0, 0, 0), UP, [[0, 30], [14, 30]], steel, { parent: this.cooler, set: this.cooler.userData.ink.main, rings: [0, 14], sil: false });
    this.sweep([{ c: V3(x1 + 40, 0, -44), t: UP.clone(), r: 30 }, { c: V3(x1 + 40, 14, -44), t: UP.clone(), r: 30 }]);
    const ringTop = new THREE.Mesh(new THREE.RingGeometry(14, 29.5, 48, 1), this.paper("coolerTop", { color: "#efe9df", hatchA: [1, 0.1, 0.4], spacing: 0.8, shade: 0.12, seed: 22, side: THREE.DoubleSide }));
    ringTop.rotation.x = -Math.PI / 2; ringTop.position.y = 14.05;
    this.surface(ringTop, { parent: this.cooler, cast: false });
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; this.line(this.cooler.userData.ink.fine, [V3(14 * Math.cos(a), 14.1, 14 * Math.sin(a)), V3(29.5 * Math.cos(a), 14.1, 29.5 * Math.sin(a))], flat); }
    this.line(this.cooler.userData.ink.main, circle(V3(0, 14.1, 0), UP, 14, 40).pts, { closed: true, ...flat });
    this.coolGlow = this.glowMesh(new THREE.RingGeometry(16, 28, 48, 1, 0, Math.PI * 0.9), HEAT, { gain: 1.3, alpha: 0.7 });
    this.coolGlow.rotation.x = -Math.PI / 2; this.coolGlow.position.set(x1 + 40, 14.3, -44);
    this.fall = this.glowMesh(new THREE.BoxGeometry(4, top - 16, 14), HEAT, { gain: 1.4, alpha: 0.7 });
    this.fall.position.set(x1 + 8, (top + 16) / 2 - 6, (z0 + z1) / 2);

    // the air pulled down through the bed: into the wind boxes, along the main, up the chimney
    this.flows = new Flow({ figure: this });
    for (let k = 0; k < 4; k++) {
      const xa = ST.ign + 10 + k * 34;
      this.flows.add([V3(xa, top + 6, (z0 + z1) / 2 + 4), V3(xa, top - bed - 14, (z0 + z1) / 2 + 4), V3(xa + 12, top - bed - 20, (z0 + z1) / 2)], { color: GAS, count: 4, speed: 18, size: 2, group: "air" });
    }
    this.flows.add([...mainPts, V3(104, 6, -86), V3(84, 10, -86), V3(84, 120, -86)], { color: GAS, count: 16, speed: 30, size: 2.2, group: "air" });

    this.tags = { btp: this.tag({ x0: 30, x1: 70, h: 18, z: -2, y: 0.3 }) };
    this.finish();
    this.group.add(this.joints.mesh);
  }

  update(dt, { live }) {
    const B = burnThrough(this.speed);
    this.btp = B;
    const { x0, x1, ign } = ST;
    // the strand's length from ignition to the discharge is "1"; the front reaches the grate at btp
    const btpX = ign + (x1 - ign) * B.btp;
    this.faceU.uBtp.value += (btpX - this.faceU.uBtp.value) * Math.min(1, dt * 3);
    if (live && this.phase === "live") this.shift += dt * 5 * this.speed;
    this.faceU.uShift.value = this.shift;
    this.joints.mesh.visible = this.phase === "live";
    if (this.phase === "live") {
      const lines = [];
      const step = 7, off = ((this.shift % step) + step) % step;
      for (let x = x0 + off; x < x1; x += step) lines.push({ points: [V3(x, ST.top - ST.bed - 6, ST.z1 + 0.05), V3(x, ST.top - ST.bed - 0.2, ST.z1 + 0.05)], wobble: 0, overshoot: 0, taper: false, t0: 0, dur: 0.01 });
      this.joints.setLines(lines);
    }
    this.hood.material.uniforms.uOn.value = 0.8 + 0.15 * Math.sin(performance.now() / 160);
    this.cooler.rotation.y += dt * 0.12;
    this.flows.update(dt, { air: live ? 1 : 0 }, this.surfA);
    // hot sinter falls off the end only when it is burnt through
    this.fall.material.uniforms.uOn.value = B.under ? 0.25 : 0.7;
    this.coolGlow.material.uniforms.uOn.value = 0.6;
  }

  drawTags(ctx) {
    if (this.phase !== "live" || !this.btp) return;
    const pct = Math.round(this.btp.btp * 100);
    drawTag(this.tags.btp, { title: "Burn-through point", big: this.btp.under ? "not yet!" : `${pct} %`, color: this.btp.ok ? "#1c2433" : "#c4520c", note: this.btp.under ? "raw mix leaves the strand" : "of the way to the discharge" });
  }
}
export { ST as SINTER_STRAND };
