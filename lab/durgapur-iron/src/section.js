import * as THREE from "three";
import { LIFT_GLSL } from "./lift.js?v=d8f12ce5";

// The furnace's cut face, drawn from the model in one shader. Coordinates in the plane are figure
// millimetres; the shader turns them into metres about the axis (r, y) and decides, pixel by pixel,
// what is there: shell, lining, layered burden, cohesive zone, coke, raceway, deadman, slag, iron.
// The knife can stand off the axis by uD metres; then r = √(dx² + d²), so the face is the true chord
// section of the round furnace. A second mesh on the glow layer adds the heat, from the same rules.

const COMMON = /* glsl */ `
uniform float uS, uD, uFX, uY0;
uniform float uRH, uRB, uRT, uYT, uYBosh, uYBelly, uYStack, uYStock;
uniform float uCzApex, uCzRoot, uCzThick;
uniform float uLayer, uPair, uOre, uDip;
uniform float uIron, uSlag, uRace, uTime, uSurfAlpha;
uniform float uChem, uIsoBoost, uFocusGas;
uniform vec4 uFocus; // the reaction stop in view: burden temperature band (x..y; y <= x for any), region mask, strength
varying vec2 vP;
// region kinds 5..12 as bits 0..7 of the focus mask
bool hasReg(float mask, float reg) { return mod(floor(mask / exp2(reg - 5.0)), 2.0) > 0.5; }
bool inFocus(float reg, float T) { return uFocus.w > 0.001 && hasReg(uFocus.z, reg) && (uFocus.y <= uFocus.x || (T >= uFocus.x && T <= uFocus.y)); }

float Rin(float y) {
  if (y <= uYT) return uRH;
  if (y <= uYBosh) return mix(uRH, uRB, (y - uYT) / (uYBosh - uYT));
  if (y <= uYBelly) return uRB;
  if (y <= uYStack) return mix(uRB, uRT, (y - uYBelly) / (uYStack - uYBelly));
  if (y <= uYStock + 2.2) return uRT;
  float k = clamp((y - uYStock - 2.2) / 3.2, 0.0, 1.0);
  return mix(uRT, 1.25, k);
}
float lining(float y) {
  if (y < uYT) return 1.15;
  if (y < uYBosh) return 0.75;
  if (y < uYStack) return 0.78;
  return 0.5;
}
const float SHELL = 0.14;
const float SUMP = 1.6;     // the hearth floor below the taphole, m
const float PAD = 3.4;      // the hearth pad below that, m
float topY() { return uYStock + 2.2 + 3.2; }
float frust(float a, float b, float ra, float rb) { return 3.14159265 * (b - a) / 3.0 * (ra * ra + ra * rb + rb * rb); }
// volume from height y up to the stockline, m³
float volAbove(float y) {
  float v = 0.0;
  if (y < uYStock) v += 3.14159265 * uRT * uRT * (uYStock - max(y, uYStack));
  if (y < uYStack) { float a = max(y, uYBelly); v += frust(a, uYStack, Rin(a), uRT); }
  if (y < uYBelly) v += 3.14159265 * uRB * uRB * (uYBelly - max(y, uYBosh));
  if (y < uYBosh) { float a = max(y, uYT); v += frust(a, uYBosh, Rin(a), uRB); }
  return v;
}
float czLower(float r) { return uCzApex - (uCzApex - uCzRoot) * pow(min(1.0, r / uRB), 1.15); }
float burdenTop(float r) { return uYStock - uDip * (1.0 - min(1.0, r / uRT)); }
// typical temperatures (the model's temperatureAt, the same numbers)
float tempAt(float r, float y) {
  float lo = czLower(r), hi = lo + uCzThick;
  if (y >= hi) {
    float s = (y - hi) / max(0.1, uYStock - hi);
    if (s < 0.14) return 1200.0 - 200.0 * (s / 0.14);
    if (s < 0.62) return 1000.0 - 120.0 * ((s - 0.14) / 0.48);
    return 880.0 - 680.0 * pow(clamp((s - 0.62) / 0.38, 0.0, 1.0), 0.8);
  }
  if (y >= lo) return 1200.0 + 200.0 * (1.0 - (y - lo) / uCzThick);
  float d = max(0.0, (lo - y) / max(0.5, lo - uYT));
  return 1400.0 + 380.0 * min(1.0, d);
}
// the raceway: a balloon of burning coke in front of each tuyere
float raceway(float r, float y) {
  float c = uRH - 0.95 * uRace;
  vec2 q = vec2((r - c) / (1.05 * uRace + 0.01), (y - uYT - 0.1) / (0.72 * uRace + 0.01));
  return length(q);
}
float deadman(float r, float y) { return y - (uYT + 3.6 - 3.6 * pow(r / (uRH * 0.82), 1.6)); } // < 0 inside
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// what is here: 0 outside, 1 shell, 2 lining, 3 pad, 4 gas space, 5 ore layer, 6 coke layer,
// 7 softening ore, 8 active coke, 9 raceway, 10 deadman, 11 slag, 12 iron
float regionAt(float r, float y, out float u) {
  u = 0.0;
  float top = topY();
  if (y > top + 0.5 || y < -SUMP - PAD) return 0.0;
  float ri = y < 0.0 ? uRH : Rin(y);
  float lin = lining(y);
  float ro = ri + lin + SHELL;
  if (y > top) { if (r < 1.25 + 0.5) return 1.0; return 0.0; }
  if (r > ro) return 0.0;
  if (y < -SUMP) return r > ro - SHELL ? 1.0 : 3.0;
  if (r > ri + lin) return 1.0;
  if (r > ri) return 2.0;
  // inside the furnace
  if (y < uIron) return 12.0;
  if (y < uSlag) return 11.0;
  if (raceway(r, y) < 1.0) return 9.0;
  if (y > burdenTop(r)) return 4.0;
  float lo = czLower(r);
  float yeq = y + uDip * (1.0 - min(1.0, r / max(0.1, ri)));
  u = volAbove(min(yeq, uYStock)) / (3.14159265 * uRT * uRT * uPair) - uLayer;
  bool ore = fract(u) < uOre;
  if (y > lo + uCzThick) return ore ? 5.0 : 6.0;
  if (y > lo) return ore ? 7.0 : 6.0;
  if (deadman(r, y) < 0.0) return 10.0;
  return 8.0;
}
`;

const VERT = /* glsl */ `
${LIFT_GLSL}
uniform float uLiftSurf;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(liftToPage(w.xyz, uLiftSurf), 1.0);
}`;

const PAPER_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uInk, uPaper;
float lines(float c, float w) { float fw = max(fwidth(c), 1e-4); float d = abs(fract(c + 0.5) - 0.5); return 1.0 - smoothstep(w - 0.7 * fw, w + 0.7 * fw, d); }
float rings(vec2 p, float cell, float rad, float seed) {
  vec2 g = floor(p / cell), f = fract(p / cell) - 0.5;
  float best = 1e3;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 h = vec2(hash12(g + o + seed), hash12(g + o + seed + 7.1)) - 0.5;
    vec2 c = o + h * 0.55;
    float rr = rad * (0.7 + 0.5 * hash12(g + o + seed + 3.3));
    best = min(best, abs(length((f - c) * cell) - rr));
  }
  float fw = max(fwidth(p.x), 1e-4) * 0.9;
  return 1.0 - smoothstep(0.09, 0.09 + fw, best);
}
void main() {
  float dx = (vP.x - uFX) / uS;
  float r = sqrt(dx * dx + uD * uD);
  float y = (vP.y - uY0) / uS;
  float u;
  float reg = regionAt(r, y, u);
  if (reg < 0.5 || reg == 4.0) discard;
  vec2 mm = vP; // millimetres in the plane: patterns keep their size on the paper
  float ink = 0.0;
  vec3 base = uPaper;
  if (reg == 1.0) ink = 0.92;
  else if (reg == 2.0) { ink = lines((mm.x + mm.y) / 1.1, 0.13) * 0.85; base *= 0.97; }
  else if (reg == 3.0) {
    float row = floor(mm.y / 2.4);
    float brick = lines(mm.y / 2.4, 0.06) + lines(mm.x / 5.0 + 0.5 * mod(row, 2.0), 0.03);
    ink = clamp(brick, 0.0, 1.0) * 0.7 + lines((mm.x - mm.y) / 1.6, 0.08) * 0.25;
  }
  else if (reg == 5.0) { ink = lines((mm.x * 0.8 - mm.y) / 0.62, 0.16) * 0.62 + step(0.93, hash12(floor(mm * 2.6))) * 0.5; base = vec3(0.93, 0.9, 0.85); }
  else if (reg == 6.0) { ink = rings(mm, 1.5, 0.48, 1.0) * 0.8; base = vec3(0.985, 0.975, 0.95); }
  else if (reg == 7.0) { ink = 0.25 + lines((mm.x * 0.3 - mm.y) / 0.5, 0.2) * 0.45; base = vec3(0.88, 0.8, 0.72); }
  else if (reg == 8.0) { ink = rings(mm, 1.5, 0.48, 4.0) * 0.6; }
  else if (reg == 9.0) { ink = 0.0; base = vec3(1.0, 0.97, 0.9); }
  else if (reg == 10.0) { ink = max(rings(mm, 1.15, 0.38, 9.0) * 0.8, lines((mm.x - mm.y) / 1.3, 0.07) * 0.35); }
  else if (reg == 11.0) { ink = lines(mm.y / 0.9 + 0.25 * sin(mm.x * 0.8 + uTime * 0.6), 0.08) * 0.4; base = vec3(0.98, 0.9, 0.8); }
  else if (reg == 12.0) { ink = 0.0; base = vec3(1.0, 0.96, 0.88); }
  // the deadman's coke stands in the hearth liquids too: inked lumps over them
  if (reg >= 11.0 && deadman(r, y) < 0.0) ink = max(ink, rings(mm, 1.15, 0.38, 9.0) * 0.7);
  // the outlines of the zones, inked from the same rules
  float lo = czLower(r), hi = lo + uCzThick;
  float fwy = max(fwidth(y), 1e-4);
  bool inside = reg >= 5.0;
  if (inside && reg != 9.0 && reg < 11.0) {
    ink = max(ink, (1.0 - smoothstep(0.6, 1.6, abs(y - lo) / fwy)) * 0.9);
    ink = max(ink, (1.0 - smoothstep(0.6, 1.6, abs(y - hi) / fwy)) * 0.9);
  }
  if (reg == 9.0 || reg == 8.0) { float rw = raceway(r, y); float fr = max(fwidth(rw), 1e-4); ink = max(ink, (1.0 - smoothstep(0.6, 1.6, abs(rw - 1.0) / fr)) * 0.8); }
  if (reg >= 10.0) ink = max(ink, (1.0 - smoothstep(0.6, 1.6, abs(y - uSlag) / fwy)) * 0.75);
  // the reaction stop in view: its band edged in a marching dashed ink line, its region washed warm
  if (uFocus.w > 0.001 && inside && reg != 4.0) {
    float T = tempAt(r, y);
    bool inReg = hasReg(uFocus.z, reg);
    if (uFocus.y > uFocus.x && inReg) {
      float fwT = max(fwidth(T), 1e-3);
      float e = min(abs(T - uFocus.x), abs(T - uFocus.y)) / fwT;
      float dash = step(0.45, fract((mm.x + mm.y) * 0.32 - uTime * 0.7));
      ink = max(ink, (1.0 - smoothstep(0.8, 2.2, e)) * 0.95 * dash * uFocus.w);
    }
    if (inFocus(reg, T)) base = mix(base, vec3(1.0, 0.95, 0.86), 0.35 * uFocus.w);
  }
  vec3 col = mix(base, uInk, clamp(ink, 0.0, 1.0));
  gl_FragColor = vec4(col, uSurfAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const GLOW_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uHeat, uHot, uGasC;
uniform float uGlowOn;
// a sparse field of small dots drifting through a grid: the specks of the reactions
float specks(vec2 g, float keep, float rad) {
  vec2 cell = floor(g), f = fract(g) - 0.5;
  float h = hash12(cell);
  vec2 o = (vec2(h, fract(h * 7.31)) - 0.5) * 0.5;
  return (1.0 - smoothstep(rad * 0.5, rad, length(f - o))) * step(1.0 - keep, h);
}
void main() {
  float dx = (vP.x - uFX) / uS;
  float r = sqrt(dx * dx + uD * uD);
  float y = (vP.y - uY0) / uS;
  float u;
  float reg = regionAt(r, y, u);
  if (reg < 4.5) discard;
  float T = tempAt(r, y);
  float a = 0.0;
  float aG = 0.0; // gas-coloured light: the gas at work
  if (reg == 5.0 || reg == 6.0) a = 0.2 * smoothstep(820.0, 1250.0, T);
  if (reg == 7.0) a = 0.5 + 0.08 * sin(uTime * 1.3 + u * 3.0);
  if (reg == 8.0 || reg == 10.0) { a = 0.14 + 0.14 * smoothstep(1450.0, 1800.0, T); }
  if (reg == 9.0) { T = 1500.0 + 600.0 * (1.0 - smoothstep(0.0, 1.0, raceway(r, y))); a = 0.55 + 0.4 * (1.0 - smoothstep(0.1, 1.0, raceway(r, y))); }
  if (reg == 11.0) { T = 1300.0; a = 0.42; }
  if (reg == 12.0) { T = 1650.0; a = 0.72; }
  // the raceway: coke whirling round the hollow in front of the tuyere, white hot
  if (reg == 9.0) {
    float c = uRH - 0.95 * uRace;
    vec2 q = vec2((r - c) / (1.05 * uRace + 0.01), (y - uYT - 0.1) / (0.72 * uRace + 0.01));
    float ang = atan(q.y, q.x) / 6.2831853 + 0.5, rad = length(q);
    float spark = specks(vec2(ang * 16.0 - uTime * (2.4 - 1.4 * rad), rad * 5.0), 0.55, 0.32);
    a = min(1.0, a + spark * 0.45);
    T += spark * 500.0;
  }
  if (uChem > 0.001) {
    // near 800 °C: raw flux giving off CO₂, small bubbles rising through the ore layers
    if (reg == 5.0 && T > 740.0 && T < 910.0) aG = max(aG, specks(vec2(r * 7.0, y * 3.2 - uTime * 1.1), 0.18, 0.22) * 0.8 * uChem);
    // the thermal reserve zone: CO taking oxygen from wüstite, a fine twinkle in the ore
    if ((reg == 5.0 || reg == 6.0) && T >= 880.0 && T <= 1000.0) aG = max(aG, specks(vec2(r * 9.0 + 3.1, y * 6.0 - uTime * 2.0), 0.22, 0.2) * (0.55 + 0.45 * sin(uTime * 5.0 + r * 3.0)) * 0.7 * uChem);
    // above about 1,000 °C: solution loss eats the coke, which flickers and breathes out CO
    if (reg == 6.0 && T > 1000.0) {
      a = max(a, (0.12 + 0.1 * sin(uTime * 3.7 + u * 9.0 + r * 2.0)) * uChem);
      aG = max(aG, specks(vec2(r * 8.0 + 7.7, y * 5.0 - uTime * 1.8), 0.3, 0.22) * 0.75 * uChem);
    }
  }
  // droplets of iron and slag falling through the coke below the cohesive zone
  if (reg == 8.0) {
    vec2 g = vec2(r * 2.2, y * 1.1 + uTime * 0.9);
    vec2 cell = floor(g), f = fract(g) - 0.5;
    float h = hash12(cell);
    float drop = (1.0 - smoothstep(0.07, 0.13, length(f * vec2(1.0, 0.55) - vec2(h - 0.5, 0.0) * 0.5))) * step(0.66, h);
    a = max(a, drop * 0.9);
  }
  // isotherms every 200 °C through the burden
  if (reg >= 5.0 && reg <= 8.0) {
    float c = T / 200.0, fw = max(fwidth(c), 1e-4);
    float iso = (1.0 - smoothstep(0.5, 1.4 + 0.8 * uIsoBoost, abs(fract(c + 0.5) - 0.5) / fw)) * smoothstep(350.0 - 200.0 * uIsoBoost, 500.0 - 200.0 * uIsoBoost, T);
    a = max(a, iso * (0.5 + 0.4 * uIsoBoost));
  }
  // the reaction stop in view breathes, in the gas's colour if the gas does the work, else heat's
  if (inFocus(reg, T)) {
    float br = uFocus.w * (0.2 + 0.14 * sin(uTime * 2.6));
    if (uFocusGas > 0.5) aG = max(aG, br); else a = max(a, br + 0.06);
  }
  a *= uSurfAlpha * uGlowOn;
  aG *= uSurfAlpha * uGlowOn;
  vec3 col = mix(uHeat, uHot, smoothstep(1150.0, 1900.0, T));
  col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(1850.0, 2100.0, T) * 0.6);
  vec3 gas = mix(uGasC, vec3(0.85, 0.98, 1.0), 0.25);
  gl_FragColor = vec4(col * a * 1.3 + gas * aG * 1.3, max(a, aG));
}`;

export function sectionUniforms(L, { S, FX, Y0 }) {
  return {
    uS: { value: S }, uD: { value: 0 }, uFX: { value: FX }, uY0: { value: Y0 },
    uRH: { value: L.rH }, uRB: { value: L.rB }, uRT: { value: L.rT },
    uYT: { value: L.yT }, uYBosh: { value: L.yBosh }, uYBelly: { value: L.yBelly }, uYStack: { value: L.yStack }, uYStock: { value: L.yStock },
    uCzApex: { value: 0 }, uCzRoot: { value: 0 }, uCzThick: { value: 1.6 },
    uLayer: { value: 0 }, uPair: { value: 1.25 }, uOre: { value: 0.55 }, uDip: { value: 1.0 },
    uIron: { value: 0.6 }, uSlag: { value: 1.6 }, uRace: { value: 1.0 }, uTime: { value: 0 },
    uChem: { value: 0 }, uIsoBoost: { value: 0 }, uFocusGas: { value: 0 }, uFocus: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
}

export function sectionMaterials(uniforms, surf, page, { ink = "#1c2433", paper = "#fbf7ee", heat = "#ff7a1c", hot = "#ffd27a", gas = "#18b8d6" } = {}) {
  const paperMat = new THREE.ShaderMaterial({
    uniforms: { ...surf, ...page, ...uniforms, uInk: { value: new THREE.Color(ink) }, uPaper: { value: new THREE.Color(paper) } },
    vertexShader: VERT, fragmentShader: PAPER_FRAG,
    transparent: true, side: THREE.DoubleSide,
  });
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { ...surf, ...page, ...uniforms, uHeat: { value: new THREE.Color(heat) }, uHot: { value: new THREE.Color(hot) }, uGasC: { value: new THREE.Color(gas) }, uGlowOn: { value: 1 } },
    vertexShader: VERT, fragmentShader: GLOW_FRAG,
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return { paperMat, glowMat };
}
