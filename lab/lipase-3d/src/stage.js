// The water the enzyme floats in: a deep blue-ink field that darkens with depth, soft studio boxes for
// the ribbons to catch, a cool key from above (light comes from the water surface), a warm rim from the
// oil below, and bloom that only the oil, the oxyanion and the product reach.
// After the stage of the Durgapur Blast Furnace and TEM builds (teardown skill, MIT): one camera rig with a
// target, azimuth, elevation, distance and a screen shift that keeps the subject clear of the cards.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export const INK = { top: "#16293a", mid: "#0f1b26", low: "#0a121a" };

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const bg = (() => {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 512;
    const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, INK.top); gr.addColorStop(0.5, INK.mid); gr.addColorStop(1, INK.low);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  scene.background = bg;
  scene.fog = new THREE.FogExp2("#0d1823", 0.0016);
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 20000);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.4, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // studio boxes for glossy ribbons
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color("#1a2733");
    const box = (w, h, pos, k, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.copy(pos); m.lookAt(0, 0, 0); env.add(m);
    };
    box(16, 10, new THREE.Vector3(-2, 14, 6), 1.8, "#e8f4ff");
    box(4, 14, new THREE.Vector3(-13, 3, 5), 1.2, "#d6ecff");
    box(4, 12, new THREE.Vector3(12, -4, -5), 0.7, "#ffd9a8");
    box(22, 3, new THREE.Vector3(0, -10, 10), 0.35, "#ffc27a");
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.85;
    pm.dispose();
  }
  const key = new THREE.DirectionalLight("#eaf4ff", 2.4);
  key.position.set(-30, 90, 50);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffd6a6", 0.55);
  rim.position.set(40, -60, -30);
  scene.add(rim);
  const fill = new THREE.DirectionalLight("#9fc8ff", 0.5);
  fill.position.set(60, 20, 40);
  scene.add(fill);
  const hemi = new THREE.HemisphereLight("#b9d4e6", "#3a3020", 0.7);
  scene.add(hemi);

  const size = { w: 1600, h: 900 };
  const resize = (w, h, pr) => {
    size.w = w; size.h = h;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const D2R = Math.PI / 180;
  const place = (cam) => {
    const { tx, ty, tz, d } = cam;
    const az = cam.az * D2R, el = cam.el * D2R;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    // near/far follow the chapter's framing distance (ref), not the moving camera, so depth precision stays put
    const ref = cam.ref ?? d;
    const near = Math.max(0.3, ref * 0.02), far = ref * 80 + 2000;
    if (near !== camera.near || far !== camera.far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0) * size.w, -(cam.sy ?? 0) * size.h, size.w, size.h);
    camera.updateMatrixWorld();
  };
  const pv = new THREE.Vector3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1 || pv.z < -1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  return { renderer, scene, camera, composer, bloom, bg, key, rim, hemi, resize, place, project, size, render: () => composer.render() };
}
