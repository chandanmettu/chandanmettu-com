import * as THREE from "three";
import { LIFT_GLSL } from "./lift.js?v=d8f12ce5";
import { INK } from "./ink.js?v=d8f12ce5";

// Surfaces of the figure: near-white paper whose form comes from pen hatching computed on the GPU.
// Three's lights still run (so shadows land), but the colour is paper mixed toward ink.

const HATCH_GLSL = /* glsl */ `
uniform float uHatchQ;
float ejHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ejNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ejHash(i), ejHash(i + vec3(1, 0, 0)), f.x), mix(ejHash(i + vec3(0, 1, 0)), ejHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ejHash(i + vec3(0, 0, 1)), ejHash(i + vec3(1, 0, 1)), f.x), mix(ejHash(i + vec3(0, 1, 1)), ejHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// lines of constant on-screen width; denser than pixels they fade to their average tone (no moire)
float penLines(float c, float dark, float fw) {
  float d = abs(fract(c + 0.5) - 0.5);
  float hw = min(mix(0.05, 0.2, dark), mix(0.6, 1.2, dark) * fw);
  float line = 1.0 - smoothstep(hw - 0.7 * fw, hw + 0.7 * fw, d);
  return mix(line, 1.7 * hw, smoothstep(0.3, 0.7, fw));
}
float penHatch(vec3 p, vec3 dir, float spacing, float dark, float seed) {
  float c = dot(p, dir) / spacing + 0.32 * (ejNoise(p * 0.06 + seed) - 0.5);
  float fw = max(fwidth(c), 1e-4);
  float l = penLines(c, dark, fw);
  vec3 along = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  float a = dot(p, along) / 13.0;
  float brk = ejNoise(vec3(floor(c + 0.5) * 2.31 + seed, a, seed * 0.37));
  float bw = max(fwidth(a) * 0.6, 1e-3);
  l *= mix(1.0, smoothstep(0.1 - bw, 0.1 + bw, brk), uHatchQ);   // strokes, not stripes
  // close up the lines spread apart on screen: a finer level fades in between them
  float fine = smoothstep(0.11, 0.05, fw);
  if (fine > 0.0) l = max(l, penLines(c * 2.0, dark * 0.85, fw * 2.0) * fine);
  return l;
}`;

// uniforms every surface of one figure shares (and the page, for the spill light)
export function surfaceUniforms() {
  return {
    uLiftSurf: { value: 1 },
    uSurfAlpha: { value: 1 },
    uKeyView: { value: new THREE.Vector3(0, 1, 0) },
    uHatchQ: { value: 1 },
    uSpill: { value: null },
    uSpillRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uSpillGain: { value: 1.6 },
    uSpillTop: { value: 1e5 }, // world height above which the spill light fades out
  };
}

const KEY_CAPTURE = (src) => src.replace(
  /getDirectionalLightInfo\( directionalLight, directLight \);([\s\S]*?)RE_Direct\( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight \);/,
  (m, between) => `getDirectionalLightInfo( directionalLight, directLight );${between}if ( UNROLLED_LOOP_INDEX == 0 ) ejKeyVis = dot( directLight.color, vec3( 0.2126, 0.7152, 0.0722 ) ) / max( 1e-4, dot( directionalLights[ 0 ].color, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );`);

let paperId = 0;
export function paperMaterial(shared, page, {
  color = "#fbf7ee", ink = INK, hatchA = [0.62, 0.74, 0.45], hatchB = [-0.7, 0.4, 0.6],
  spacing = 1.5, shade = 0.16, hatch = 1, seed = 1, map = null, side = THREE.FrontSide,
} = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, map, side });
  const own = {
    uInkCol: { value: new THREE.Color(ink) },
    uHatchA: { value: new THREE.Vector3(...hatchA).normalize() },
    uHatchB: { value: new THREE.Vector3(...hatchB).normalize() },
    uSpacing: { value: spacing },
    uShade: { value: shade },
    uHatch: { value: hatch },
    uSeed: { value: seed },
  };
  m.userData.uniforms = { ...shared, ...page, ...own };
  m.transparent = true;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, m.userData.uniforms);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>
${LIFT_GLSL}
uniform float uLiftSurf; varying vec3 vObj; varying vec3 vWorldEj;`)
      .replace("#include <project_vertex>", `
  vObj = transformed;
  vec4 ejL = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  ejL = instanceMatrix * ejL;
  #endif
  vec4 ejW = modelMatrix * ejL;
  vWorldEj = ejW.xyz;
  vec4 mvPosition = viewMatrix * vec4(liftToPage(ejW.xyz, uLiftSurf), 1.0);
  gl_Position = projectionMatrix * mvPosition;`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
${HATCH_GLSL}
uniform vec3 uInkCol, uHatchA, uHatchB, uKeyView; uniform float uSpacing, uShade, uHatch, uSeed, uSurfAlpha, uSpillGain, uSpillTop;
uniform sampler2D uSpill; uniform vec4 uSpillRect;
varying vec3 vObj; varying vec3 vWorldEj;`)
      .replace("#include <lights_fragment_begin>", "float ejKeyVis = 1.0;\n" + KEY_CAPTURE(THREE.ShaderChunk.lights_fragment_begin))
      .replace("#include <opaque_fragment>", `
  float ejForm = saturate(dot(normal, uKeyView)) * 0.82 + 0.18;
  float ejDark = 1.0 - ejForm * mix(0.5, 1.0, smoothstep(0.12, 0.7, ejKeyVis));
  float ejH1 = penHatch(vObj, uHatchA, uSpacing, smoothstep(0.3, 1.0, ejDark), uSeed) * smoothstep(0.28, 0.45, ejDark);
  float ejH2 = penHatch(vObj, uHatchB, uSpacing * 1.12, smoothstep(0.82, 1.0, ejDark), uSeed + 5.0) * smoothstep(0.8, 0.92, ejDark) * uHatchQ;
  float ejCov = clamp(max(ejH1, ejH2) + 0.25 * min(ejH1, ejH2), 0.0, 1.0) * uHatch * 0.58;
  vec2 ejSq = (vWorldEj.xz - uSpillRect.xy) / uSpillRect.zw;
  float ejIn = step(0.0, ejSq.x) * step(0.0, ejSq.y) * step(ejSq.x, 1.0) * step(ejSq.y, 1.0);
  vec3 ejSpill = texture2D(uSpill, clamp(ejSq, 0.0, 1.0)).rgb * ejIn * uSpillGain * (1.0 - smoothstep(uSpillTop, uSpillTop + 26.0, vWorldEj.y));
  vec3 ejPaper = diffuseColor.rgb * (1.0 - uShade * ejDark);
  outgoingLight = mix(ejPaper + diffuseColor.rgb * ejSpill, uInkCol, ejCov);
  #include <opaque_fragment>
  gl_FragColor.a = uSurfAlpha;`);
  };
  m.customProgramCacheKey = () => "rp-paper";
  paperId++;
  return m;
}

// Shadows fade with the surfaces instead of popping: a dithered depth material.
export function fadingShadowDepth() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaHash: true, opacity: 1 });
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\n#if DEPTH_PACKING != 3200\nuniform float opacity;\n#endif")
      .replace("#include <alphahash_fragment>", "diffuseColor.a = opacity;\n#include <alphahash_fragment>");
  };
  m.customProgramCacheKey = () => "rp-fading-depth";
  return m;
}

// Glass: almost clear, brighter at grazing angles, with a soft highlight. Ink lines do the drawing.
export function glassMaterial(shared, page, { tint = "#d8e6ee", base = 0.05, edge = 0.32 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, ...page, uTint: { value: new THREE.Color(tint) }, uBase: { value: base }, uEdge: { value: edge } },
    vertexShader: /* glsl */ `
${LIFT_GLSL}
uniform float uLiftSurf;
varying vec3 vN, vV;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * vec4(liftToPage(w.xyz, uLiftSurf), 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uTint; uniform float uBase, uEdge, uSurfAlpha;
varying vec3 vN, vV;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float f = 1.0 - abs(dot(n, v));
  float a = uBase + uEdge * pow(f, 2.6);
  float shine = smoothstep(0.30, 0.38, f) * (1.0 - smoothstep(0.42, 0.52, f));
  vec3 c = mix(uTint, vec3(1.0), 0.35 + 0.65 * shine);
  gl_FragColor = vec4(c, (a + 0.35 * shine) * uSurfAlpha);
}`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// A liquid that glows (the measured quantity): bright core, softer rim, never pure flat colour.
export function glowMaterial(shared, page, color, { gain = 1.6, alpha = 0.92 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, ...page, uColor: { value: new THREE.Color(color) }, uGain: { value: gain }, uAlpha: { value: alpha }, uOn: { value: 1 } },
    vertexShader: /* glsl */ `
${LIFT_GLSL}
uniform float uLiftSurf;
varying vec3 vN, vV;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * vec4(liftToPage(w.xyz, uLiftSurf), 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor; uniform float uGain, uAlpha, uSurfAlpha, uOn;
varying vec3 vN, vV;
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  vec3 core = mix(uColor, vec3(1.0), 0.35 * pow(facing, 3.0));
  float a = uAlpha * mix(0.7, 1.0, facing) * uSurfAlpha * uOn;
  gl_FragColor = vec4(core * uGain * a, a);
}`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
}
