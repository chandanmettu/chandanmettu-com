import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Colour is the only thing that glows: the dye and the measured water columns. They bloom, and
// they cast their colour onto the paper beneath them.

export const GLOW_LAYER = 3;

export class Post {
  constructor({ renderer, scene, camera }) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.bloomComposer = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.62, 0.45, 0.0);
    this.bloomComposer.addPass(this.bloom);
    this.final = new EffectComposer(renderer);
    this.final.addPass(new RenderPass(scene, camera));
    this.mix = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: this.bloomComposer.renderTarget2.texture }, uStrength: { value: 1 }, uVig: { value: 0.42 } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: /* glsl */ `
uniform sampler2D baseTexture, bloomTexture; uniform float uStrength, uVig; varying vec2 vUv;
void main() {
  vec4 base = texture2D(baseTexture, vUv);
  vec3 glow = texture2D(bloomTexture, vUv).rgb * uStrength;
  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  gl_FragColor = vec4((base.rgb + glow) * vig, base.a);
}`,
    }), "baseTexture");
    this.mix.needsSwap = true;
    this.final.addPass(this.mix);
    this.final.addPass(new OutputPass());
    this.dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.layer = new THREE.Layers(); this.layer.set(GLOW_LAYER);
    this.stash = new Map();
    this.enabled = true;
  }

  // css size and pixel ratio: the composers multiply them themselves
  setSize(w, h, dpr) {
    this.bloomComposer.setPixelRatio(dpr);
    this.final.setPixelRatio(dpr);
    this.bloomComposer.setSize(w, h);
    this.final.setSize(w, h);
  }

  // glow pass: everything that does not glow is black (if it hides glow) or gone (if it is ink or glass)
  _darken(obj) {
    if (!obj.isMesh && !obj.isLine && !obj.isPoints) return;
    if (obj.layers.test(this.layer)) return;
    const m = obj.material;
    const keepsDepth = obj.userData.page || (m && !Array.isArray(m) && m.userData && m.userData.uniforms && m.userData.uniforms.uSurfAlpha && m.userData.uniforms.uSurfAlpha.value > 0.5) || Array.isArray(m) || (m && m.isMeshStandardMaterial && !m.transparent);
    if (keepsDepth && obj.visible) { this.stash.set(obj, { material: m }); obj.material = this.dark; }
    else { this.stash.set(obj, { visible: obj.visible }); obj.visible = false; }
  }

  render() {
    if (!this.enabled) { this.renderer.setRenderTarget(null); this.mix.uniforms.uStrength.value = 0; this.final.render(); return; }
    const bg = this.scene.background;
    this.scene.background = null;
    const clear = this.renderer.getClearColor(new THREE.Color()), alpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0x000000, 1);
    this.scene.traverse((o) => this._darken(o));
    this.bloomComposer.render();
    for (const [obj, s] of this.stash) { if ("material" in s) obj.material = s.material; else obj.visible = s.visible; }
    this.stash.clear();
    this.scene.background = bg;
    this.renderer.setClearColor(clear, alpha);
    this.mix.uniforms.uStrength.value = 1;
    this.final.render();
  }
}

// The spill: the glow layer seen from straight above, blurred, laid on the paper as coloured light.
const BLUR = /* glsl */ `
uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb * 0.227;
  c += (texture2D(tMap, vUv + uDir * 1.38).rgb + texture2D(tMap, vUv - uDir * 1.38).rgb) * 0.316;
  c += (texture2D(tMap, vUv + uDir * 3.23).rgb + texture2D(tMap, vUv - uDir * 3.23).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Spill {
  constructor(renderer, { x0, x1, z0, z1, res = [256, 160], spread = 1.6 }) {
    this.renderer = renderer;
    this.spread = spread;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.a = new THREE.WebGLRenderTarget(res[0], res[1], opts);
    this.b = new THREE.WebGLRenderTarget(res[0], res[1], { type: THREE.HalfFloatType, depthBuffer: false });
    const w = x1 - x0, d = z1 - z0;
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 1, 2000);
    this.camera.position.set((x0 + x1) / 2, 800, (z0 + z1) / 2);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt((x0 + x1) / 2, 0, (z0 + z1) / 2);
    this.camera.layers.set(GLOW_LAYER);
    this.camera.updateMatrixWorld(true);
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: BLUR, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // the top camera looks down with "up" toward -z: x runs right and v = 1 at z0, so the rect runs
    // from z1 with a negative depth and the paper samples (x - x0) / w, (z1 - z) / d
    this.rect = new THREE.Vector4(x0, z1, w, -d);
  }
  get texture() { return this.a.texture; }
  render(scene) {
    const r = this.renderer, prev = r.getRenderTarget(), bg = scene.background;
    const clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha();
    scene.background = null;
    r.setClearColor(0x000000, 1);
    r.setRenderTarget(this.a); r.clear(); r.render(scene, this.camera);
    const px = new THREE.Vector2(1 / this.a.width, 1 / this.a.height);
    for (let i = 0; i < 3; i++) {
      const s = this.spread * (1 + i);
      this.blur.uniforms.tMap.value = this.a.texture; this.blur.uniforms.uDir.value.set(px.x * s, 0);
      r.setRenderTarget(this.b); r.render(this.quadScene, this.quadCam);
      this.blur.uniforms.tMap.value = this.b.texture; this.blur.uniforms.uDir.value.set(0, px.y * s);
      r.setRenderTarget(this.a); r.render(this.quadScene, this.quadCam);
    }
    scene.background = bg;
    r.setRenderTarget(prev);
    r.setClearColor(clear, alpha);
  }
}
