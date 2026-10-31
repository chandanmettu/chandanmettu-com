import * as THREE from "three";
import { LIFT_GLSL } from "./lift.js?v=aeed9ff6";

// Ink lines: screen-space ribbons with a pen that draws them along their length. Flat on the page
// a line is printed in millimetres; standing it is a pen of constant pixel weight. Each set has a
// standing mesh and a flat copy (the print) that shows only what the pen has not reached yet.

export const INK = "#1c2433";

const VERT = /* glsl */ `
${LIFT_GLSL}
uniform float uClock, uLift, uMode, uWidthPx, uWidthMm, uBias, uStandAlpha, uCopyAlpha;
uniform vec2 uRes;
attribute vec3 aPrev, aNext;
attribute vec2 aSide, aArc, aTime;
attribute float aVis, aDash;
varying float vD, vHalf, vS, vHead, vAlpha, vDash;
varying vec3 vWorld;
vec2 toPx(vec4 c) { return c.xy / c.w * 0.5 * uRes; }
vec4 clipOf(vec3 w) {
  vec4 v = viewMatrix * vec4(w, 1.0);
  v.xyz += normalize(-v.xyz) * uBias;
  return projectionMatrix * v;
}
void main() {
  float lift = uMode > 0.5 ? 0.0 : uLift;
  vec3 wP = liftToPage((modelMatrix * vec4(position, 1.0)).xyz, lift);
  vec3 wA = liftToPage((modelMatrix * vec4(aPrev, 1.0)).xyz, lift);
  vec3 wB = liftToPage((modelMatrix * vec4(aNext, 1.0)).xyz, lift);
  vWorld = wP;
  vec4 cP = clipOf(wP), cA = clipOf(wA), cB = clipOf(wB);
  vec2 sP = toPx(cP), sA = toPx(cA), sB = toPx(cB);
  vec2 t1 = sP - sA, t2 = sB - sP;
  float l1 = length(t1), l2 = length(t2);
  vec2 dir = vec2(1.0, 0.0);
  float miter = 1.0;
  if (l1 > 1e-4 && l2 > 1e-4) {
    vec2 a = t1 / l1, b = t2 / l2;
    dir = dot(a, b) < -0.6 ? b : normalize(a + b);
    miter = 1.0 / max(0.4, abs(dot(vec2(-dir.y, dir.x), vec2(-a.y, a.x))));
  } else if (l2 > 1e-4) dir = t2 / l2;
  else if (l1 > 1e-4) dir = t1 / l1;
  vec2 nrm = vec2(-dir.y, dir.x);
  float pxPerMm = 0.5 * uRes.y * projectionMatrix[1][1] / cP.w;
  float stand = smoothstep(0.0, 0.35, lift);
  float w = mix(uWidthMm * pxPerMm, uWidthPx, stand) * aSide.y;
  float hw = 0.5 * w;
  vAlpha = clamp(hw / 0.5, 0.0, 1.0);          // thinner than a pixel: fade instead of shimmer
  vAlpha *= uMode > 0.5 ? aVis * uCopyAlpha : uStandAlpha;
  hw = max(hw, 0.5);
  float ext = hw + 1.0;
  vD = aSide.x * ext;
  vHalf = hw;
  cP.xy += nrm * aSide.x * ext * min(miter, 2.5) / (0.5 * uRes) * cP.w;
  if (uMode > 0.5) cP.z = -cP.w * 0.999;       // the flat copy is print: nothing in the figure hides it
  float prog = clamp((uClock - aTime.x) / max(aTime.y, 1e-3), 0.0, 1.0);
  vHead = prog * aArc.y + (prog >= 1.0 ? 1.0 : 0.0);
  vS = aArc.x;
  vDash = aDash;
  gl_Position = cP;
}`;

const FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uMode, uAlpha, uCopyAll;
uniform vec4 uClip;
varying float vD, vHalf, vS, vHead, vAlpha, vDash;
varying vec3 vWorld;
void main() {
  if (dot(vec4(vWorld, 1.0), uClip) > 0.0) discard;   // cut-away: the half in front of the knife is gone
  if (uMode < 0.5 && vS > vHead) discard;              // standing: only what the pen has drawn
  if (uMode > 0.5 && uCopyAll < 0.5 && vS <= vHead) discard;   // print: only what the pen has not reached
  if (vDash > 0.0 && fract(vS / vDash) > 0.55) discard;
  float cov = clamp(vHalf + 0.5 - abs(vD), 0.0, 1.0) * vAlpha * uAlpha;
  if (cov < 0.003) discard;
  gl_FragColor = vec4(uInk, cov);
}`;

// shared pen state for every set of one figure
export function penUniforms() {
  return {
    uClock: { value: 1e6 },
    uLift: { value: 1 },
    uRes: { value: new THREE.Vector2(1600, 900) },
    uStandAlpha: { value: 1 },
    uCopyAlpha: { value: 1 },
    uCopyAll: { value: 1 },
    uClip: { value: new THREE.Vector4(0, 0, 0, -1) },
  };
}

export function inkMaterial({ shared, widthPx = 1.5, widthMm = 0.3, color = INK, bias = 0.35, alpha = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uMode: { value: 0 },
      uWidthPx: { value: widthPx },
      uWidthMm: { value: widthMm },
      uBias: { value: bias },
      uInk: { value: new THREE.Color(color) },
      uAlpha: { value: alpha },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
}

// ---- deterministic noise for the hand-drawn character ----
function hash(n) {
  let t = (n | 0) ^ 0x9e3779b9;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}
function noise1(seed, x) {
  const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  const a = hash(seed * 7919 + i), b = hash(seed * 7919 + i + 1);
  return a + (b - a) * s;
}
function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hash(((xi + a) * 73856093) ^ ((yi + b) * 19349663) ^ ((zi + c) * 83492791) ^ (seed * 2654435761));
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v),
    l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
}

function resample(points, step, closed) {
  const src = closed ? [...points, points[0]] : points;
  const out = [src[0].clone()];
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

// how a drawn line's weight varies: a little along its length, and tapered at open ends
function weight(seed, s, L, taper) {
  let w = 0.8 + 0.36 * noise1(seed, s / 34) + 0.1 * noise1(seed + 17, s / 7);
  if (taper) w *= Math.min(1, 0.42 + 0.58 * Math.min(1, s / 4.5)) * Math.min(1, 0.42 + 0.58 * Math.min(1, (L - s) / 4.5));
  return w;
}

// A pen that schedules lines one after another, overlapping a little, like a draughtsman.
export class Pen {
  constructor({ speed = 320, overlap = 0.55, start = 0 } = {}) {
    this.speed = speed; this.overlap = overlap; this.t = start; this.end = start;
  }
  take(length, { min = 0.05, max = 0.55, pause = 0 } = {}) {
    const dur = Math.min(max, Math.max(min, length / this.speed));
    const t0 = this.t + pause;
    this.t = t0 + dur * (1 - this.overlap);
    this.end = Math.max(this.end, t0 + dur);
    return { t0, dur };
  }
}

export class InkSet {
  constructor(material, { capacity = 0 } = {}) {
    this.material = material;
    this.lines = [];
    this.geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    const flatMat = material.clone();
    flatMat.uniforms = { ...material.uniforms, uMode: { value: 1 } };
    this.flatMaterial = flatMat;
    this.capacity = capacity;
    this.flatGeometry = capacity ? new THREE.BufferGeometry() : this.geometry;
    this.flat = new THREE.Mesh(this.flatGeometry, flatMat);
    this.flat.frustumCulled = false;
    this.flat.renderOrder = 11;
    if (capacity) { this._alloc(this.geometry, capacity); this._alloc(this.flatGeometry, capacity); }
  }

  // points: Vector3[] in figure space. opts: width, t0, dur, wobble, overshoot, taper, closed, seed, dash, step
  add(points, opts = {}) {
    this.lines.push(this.prep(points, opts, this.lines.length));
    return this;
  }

  prep(points, o, index) {
    let pts = points.map((p) => p.clone());
    const closed = !!o.closed;
    if (o.overshoot && !closed && pts.length > 1) {
      const a = pts[0], b = pts[1], z = pts[pts.length - 1], y = pts[pts.length - 2];
      pts[0] = a.clone().addScaledVector(a.clone().sub(b).normalize(), o.overshoot);
      pts[pts.length - 1] = z.clone().addScaledVector(z.clone().sub(y).normalize(), o.overshoot);
    }
    pts = resample(pts, o.step ?? 1.6, closed);
    const seed = o.seed ?? index * 31 + 7;
    if (o.wobble) {
      const k = o.wobble;
      for (const p of pts) {
        const u = p.x / 22, v = p.y / 22, w = p.z / 22;
        p.x += k * (noise3(u, v, w, seed) - 0.5);
        p.y += k * (noise3(u + 9, v, w, seed) - 0.5);
        p.z += k * (noise3(u, v + 9, w, seed) - 0.5);
      }
    }
    return { pts, closed, seed, width: o.width ?? 1, t0: o.t0 ?? 0, dur: o.dur ?? 0.4, taper: o.taper ?? !closed, dash: o.dash ?? 0, vis: null };
  }

  get vertexCount() { return this.lines.reduce((n, l) => n + l.pts.length * 2, 0); }

  _alloc(geo, points) {
    const n = points * 2;
    const attr = (size) => {
      const a = new THREE.BufferAttribute(new Float32Array(n * size), size);
      if (this.capacity) a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    geo.setAttribute("position", attr(3));
    geo.setAttribute("aPrev", attr(3));
    geo.setAttribute("aNext", attr(3));
    geo.setAttribute("aSide", attr(2));
    geo.setAttribute("aArc", attr(2));
    geo.setAttribute("aTime", attr(2));
    const vis = attr(1); vis.array.fill(1);
    geo.setAttribute("aVis", vis);
    geo.setAttribute("aDash", attr(1));
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(Math.max(1, points - 1) * 6);
    const index = new THREE.BufferAttribute(idx, 1);
    if (this.capacity) index.setUsage(THREE.DynamicDrawUsage);
    geo.setIndex(index);
  }

  _write(geo, lines) {
    const P = geo.attributes.position.array, A = geo.attributes.aPrev.array, B = geo.attributes.aNext.array;
    const S = geo.attributes.aSide.array, R = geo.attributes.aArc.array, T = geo.attributes.aTime.array;
    const V = geo.attributes.aVis.array, Dd = geo.attributes.aDash.array, I = geo.index.array;
    let v = 0, k = 0;
    for (const line of lines) {
      const p = line.pts, f = p.length;
      if (f < 2) continue;
      const arc = new Float32Array(f);
      for (let i = 1; i < f; i++) arc[i] = arc[i - 1] + p[i].distanceTo(p[i - 1]);
      const L = arc[f - 1], first = v;
      for (let i = 0; i < f; i++) {
        const ia = i > 0 ? i - 1 : line.closed ? f - 2 : 0;
        const ib = i < f - 1 ? i + 1 : line.closed ? 1 : f - 1;
        const w = line.width * weight(line.seed, arc[i], L, line.taper);
        const vis = line.vis ? line.vis[i] : 1;
        for (const side of [-1, 1]) {
          P.set([p[i].x, p[i].y, p[i].z], v * 3);
          A.set([p[ia].x, p[ia].y, p[ia].z], v * 3);
          B.set([p[ib].x, p[ib].y, p[ib].z], v * 3);
          S.set([side, w], v * 2);
          R.set([arc[i], L], v * 2);
          T.set([line.t0, line.dur], v * 2);
          V[v] = vis;
          Dd[v] = line.dash;
          v++;
        }
      }
      for (let i = 0; i < f - 1; i++) {
        const m = first + i * 2;
        I.set([m, m + 2, m + 1, m + 1, m + 2, m + 3], k);
        k += 6;
      }
    }
    for (const name of ["position", "aPrev", "aNext", "aSide", "aArc", "aTime", "aVis", "aDash"]) geo.attributes[name].needsUpdate = true;
    geo.index.needsUpdate = true;
    geo.setDrawRange(0, k);
  }

  build() {
    const points = this.lines.reduce((n, l) => n + l.pts.length, 0);
    this._alloc(this.geometry, Math.max(2, points));
    this._write(this.geometry, this.lines);
    return this;
  }

  // dynamic sets: standing lines change every frame, the print copy is written once
  setLines(lines) {
    const prepped = lines.map((l, i) => this.prep(l.points, l, i));
    const points = prepped.reduce((n, l) => n + l.pts.length, 0);
    if (points > this.capacity) throw new Error(`InkSet: ${points} points over capacity ${this.capacity}`);
    this._write(this.geometry, prepped);
    return prepped;
  }
  setFlat(lines) {
    this.flatLines = lines.map((l, i) => this.prep(l.points, l, i));
    this._write(this.flatGeometry, this.flatLines);
    return this.flatLines;
  }
  rewriteFlat() { this._write(this.flatGeometry, this.flatLines); }

  get end() {
    const all = this.capacity ? this.flatLines ?? [] : this.lines;
    return all.reduce((t, l) => Math.max(t, l.t0 + l.dur), 0);
  }
}
